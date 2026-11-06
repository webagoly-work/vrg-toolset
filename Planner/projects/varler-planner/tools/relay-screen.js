// ==========================================================================
// relay-screen.js — Képernyő, the PC's screen live on the phone (VRG Mobile, WP M13).
//
// The source: one long-running PowerShell process (not one per frame). It compiles a small C# class
// (VrgScreen, below) that keeps its bitmaps, loops over CopyFromScreen, draws the mouse cursor in
// (GetCursorInfo + DrawIconEx: CopyFromScreen leaves it out), scales to at most 1280 px on the long
// side, skips a frame identical to the last one (one frame every 5 s anyway, to prove the link alive)
// and writes JPEGs to stdout. It starts with the viewer and stops with it. The same process shows the
// PC's notice window, "A telefon látja a képernyőt: <telefon neve>" with a Leállítás button, always on
// top: it cannot outlive the stream, and there is no stream without it. Frames are never written to
// disk: they go stdout -> memory -> the socket.
//
//   stdout (PowerShell -> relay): [type:1][length:4 BE][payload]
//       'F' frame:  [width:2 BE][height:2 BE][keep-alive:1][JPEG]
//       ('S' {type:'bye', why} is its last word: 'stop', 'stdin closed', 'pc' or a write error)
//       'S' status: UTF-8 JSON  {type:'monitors', monitors:[{i,x,y,w,h,primary}], mode, monitor, quality}
//                                {type:'state', visible:false, reason} / {type:'state', visible:true}
//                                {type:'stopped', by:'pc'}               (Leállítás on the PC)
//   stdin  (relay -> PowerShell): "set <screen|window> <monitor> <low|high>\n", "stop\n"; EOF = stop.
//
// The phone's side, on its own WebSocket at /screen (binary, so it can never hold up the control link):
//   binary  [V S][version 1][flags][seq:4 BE][width:2 BE][height:2 BE][length:4 BE][JPEG]   (16-byte header)
//           flags bit 0 = a keep-alive repeat of an unchanged screen.
//   text    relay -> phone {type:'screen.monitors', ...} / {type:'screen.state', visible, reason}
//                          {type:'screen.end', reason:'pc'|'limit'|'unpaired'|'source'|'relay'|'replaced', text}
//           phone -> relay {type:'screen.set', mode:'screen'|'window', monitor:<n>, quality:'low'|'high'}
// Never a queue: while the socket's bufferedAmount is over MAX_BUFFERED, frames are dropped and the
// newest goes next. A slow phone gets fewer frames, not older ones.
//
// Who may watch (phone-relay-server.js enforces the control-link half; the rest is here):
//   * the relay was started with --shots (RELAY_SHOTS=1), as for Légegér's 📸;
//   * a trusted link asks screen.ticket: random 128-bit, one connection, 60 s, bound to the pairing,
//     sent in the X-VRG-Ticket header of the /screen upgrade, never in the URL;
//   * one viewer at a time: a second ticket is refused, naming the phone that is watching;
//   * removing the pairing (revoke) ends the stream at once; so do the 30-minute limit, the PC's
//     Leállítás and the phone leaving. Every start and stop is logged on the relay console.
//
// Windows only. Elsewhere screen.ticket answers with a clear refusal (📸 still works there).
// RELAY_FRAMES_DIR=<folder> plays the numbered JPEGs in it instead of capturing (tests, headless boxes),
// as RELAY_SHOT_FILE does for 📸; RELAY_FRAMES_MS sets its pace (default 200 ms).
// ==========================================================================

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const TICKET_TTL = 60 * 1000;
const LIMIT_MS = 30 * 60 * 1000;
const MAX_BUFFERED = 192 * 1024;          // about two frames at 1280 px
const MAX_PS_FRAME = 8 * 1024 * 1024;     // anything bigger from the capture process is a broken stream
const TICKET = /^[0-9a-f]{32}$/;
const TICKET_HEADER = 'x-vrg-ticket';
const HEADER_BYTES = 16;
const MODES = ['screen', 'window'];
const QUALITIES = ['low', 'high'];
const GAP_MS = 100;                       // at most 10 frames a second

const TEXT = {
  off: 'A képernyő élőben ki van kapcsolva: a relét --shots kapcsolóval kell indítani (Mobile\\mobile.cmd relay).',
  platform: 'A képernyő élőben csak Windowson működik; a Légegér 📸 képernyőképe itt is jó.',
  busy: name => `Már nézi valaki: ${name}. Egyszerre csak egy telefon láthatja.`,
  pc: 'A PC-n leállították (Leállítás).',
  limit: '30 perc letelt. Folytatás egy érintéssel.',
  unpaired: 'A párosítást törölték: a kép leállt.',
  source: 'A képernyő rögzítése leállt a PC-n.',
  relay: 'A relé leállt.',
  replaced: 'Új nézés indult.',
  hidden: 'A képernyő most nem látható (zárolás, UAC vagy biztonsági asztal).',
};

/* ---- the capture process (Windows) ------------------------------------------------------------ */

// C# 5 (Windows PowerShell 5.1's Add-Type): no string interpolation, no `out var`, no `?.`.
// The source reaches PowerShell through an environment variable (UTF-16), so its accents arrive intact.
const CS = String.raw`
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Forms;

public class VrgNoteForm : Form {
  protected override bool ShowWithoutActivation { get { return true; } }
}

public static class VrgScreen {
  [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
  [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h, int attr, out RECT r, int size);
  [DllImport("user32.dll")] static extern bool GetCursorInfo(ref CURSORINFO ci);
  [DllImport("user32.dll")] static extern bool GetIconInfo(IntPtr h, out ICONINFO ii);
  [DllImport("user32.dll")] static extern bool DrawIconEx(IntPtr hdc, int x, int y, IntPtr h, int cx, int cy, int step, IntPtr brush, int flags);
  [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr h);
  [DllImport("msvcrt.dll", CallingConvention = CallingConvention.Cdecl)] static extern int memcmp(byte[] a, byte[] b, UIntPtr n);

  [StructLayout(LayoutKind.Sequential)] struct RECT { public int Left, Top, Right, Bottom; }
  [StructLayout(LayoutKind.Sequential)] struct POINT { public int X, Y; }
  [StructLayout(LayoutKind.Sequential)] struct CURSORINFO { public int cbSize; public int flags; public IntPtr hCursor; public POINT pt; }
  [StructLayout(LayoutKind.Sequential)] struct ICONINFO { public bool fIcon; public int xHotspot; public int yHotspot; public IntPtr hbmMask; public IntPtr hbmColor; }

  static Stream outp;
  static readonly object qlock = new object();
  static readonly Queue<string> cmds = new Queue<string>();
  static volatile bool stopping;
  static string why = "";
  static string mode = "screen";
  static int monitor = 0;
  static string qname = "high";
  static int maxSide = 1280;
  static long quality = 60;
  static VrgNoteForm note;
  static Bitmap full, small;
  static byte[] cur, prev;
  static ImageCodecInfo jpeg;
  static Rectangle lastWin = Rectangle.Empty;
  static IntPtr cursorCache = IntPtr.Zero;
  static int hotX, hotY;

  public static int Run(string viewer, string m, int mon, string q, int gapMs, bool all, bool window) {
    SetProcessDPIAware();
    outp = Console.OpenStandardOutput();
    foreach (ImageCodecInfo c in ImageCodecInfo.GetImageEncoders()) if (c.MimeType == "image/jpeg") jpeg = c;
    Apply(m, mon, q);
    Thread reader = new Thread(ReadInput);
    reader.IsBackground = true;
    reader.Start();
    if (window) ShowNote(viewer);
    if (!Status(MonitorsJson())) return 1;
    Stopwatch sw = Stopwatch.StartNew();
    long lastSent = -100000, lastChange = 0;
    bool visible = true;
    while (!stopping) {
      long t0 = sw.ElapsedMilliseconds;
      Pump();
      if (stopping) break;
      byte[] jpg = null; int w = 0, h = 0; string err = null; bool changed = false;
      try { jpg = Grab(all || t0 - lastSent >= 5000, out w, out h, out changed); }
      catch (Exception e) { err = e.Message; }
      if (err != null) {
        prev = null;
        if (visible) { visible = false; if (!Status("{\"type\":\"state\",\"visible\":false,\"reason\":\"" + Esc(err) + "\"}")) break; }
        Wait(1000);
        continue;
      }
      if (!visible) { visible = true; if (!Status("{\"type\":\"state\",\"visible\":true}")) break; }
      if (changed) lastChange = t0;
      if (jpg != null) { if (!Frame(jpg, w, h, !changed)) break; lastSent = t0; }
      // a still screen for over a second: look four times a second instead of ten
      Wait((t0 - lastChange > 1000 ? Math.Max(gapMs, 250) : gapMs) - (int)(sw.ElapsedMilliseconds - t0));
    }
    if (note != null) { try { note.Close(); note.Dispose(); } catch (Exception) { } }
    Status("{\"type\":\"bye\",\"why\":\"" + Esc(why == "" ? "pc" : why) + "\"}");
    return 0;
  }

  static void ReadInput() {
    try {
      string line;
      while ((line = Console.In.ReadLine()) != null) { lock (qlock) cmds.Enqueue(line.Trim()); }
    } catch (Exception e) { why = "stdin: " + e.Message; }
    if (why == "") why = "stdin closed";
    lock (qlock) cmds.Enqueue("stop");
  }

  static void Pump() {
    Application.DoEvents();
    while (true) {
      string c;
      lock (qlock) { if (cmds.Count == 0) return; c = cmds.Dequeue(); }
      if (c == "stop") { if (why == "") why = "stop"; stopping = true; return; }
      string[] p = c.Split(' ');
      if (p.Length == 4 && p[0] == "set") {
        int mon; if (!int.TryParse(p[2], out mon)) mon = 0;
        Apply(p[1], mon, p[3]);
        Status(MonitorsJson());
      }
    }
  }

  static void Wait(int ms) {
    Stopwatch w = Stopwatch.StartNew();
    while (!stopping) {
      Pump();
      int left = ms - (int)w.ElapsedMilliseconds;
      if (left <= 0) return;
      Thread.Sleep(Math.Min(15, left));
    }
  }

  static void Apply(string m, int mon, string q) {
    mode = m == "window" ? "window" : "screen";
    monitor = Math.Max(0, Math.Min(Screen.AllScreens.Length - 1, mon));
    qname = q == "low" ? "low" : "high";
    if (qname == "low") { maxSide = 960; quality = 45; } else { maxSide = 1280; quality = 60; }
    prev = null;
  }

  static Rectangle Area() {
    Screen[] all = Screen.AllScreens;
    Rectangle mon = all[Math.Min(monitor, all.Length - 1)].Bounds;
    if (mode != "window") return mon;
    IntPtr h = GetForegroundWindow();
    if (h != IntPtr.Zero && (note == null || h != note.Handle) && !IsIconic(h)) {
      RECT r;
      if (DwmGetWindowAttribute(h, 9, out r, Marshal.SizeOf(typeof(RECT))) != 0) GetWindowRect(h, out r);
      Rectangle rr = Rectangle.FromLTRB(r.Left, r.Top, r.Right, r.Bottom);
      rr.Intersect(SystemInformation.VirtualScreen);
      if (rr.Width >= 16 && rr.Height >= 16) lastWin = rr;
    }
    return lastWin.Width >= 16 ? lastWin : mon;
  }

  static byte[] Grab(bool force, out int w, out int h, out bool changed) {
    Rectangle r = Area();
    if (full == null || full.Width != r.Width || full.Height != r.Height) {
      if (full != null) full.Dispose();
      full = new Bitmap(r.Width, r.Height, PixelFormat.Format32bppRgb);
      prev = null;
    }
    using (Graphics g = Graphics.FromImage(full)) {
      g.CopyFromScreen(r.X, r.Y, 0, 0, r.Size, CopyPixelOperation.SourceCopy);
      DrawCursor(g, r);
    }
    double k = Math.Min(1.0, (double)maxSide / Math.Max(r.Width, r.Height));
    Bitmap img = full;
    if (k < 1.0) {
      int sw = Math.Max(1, (int)Math.Round(r.Width * k)), sh = Math.Max(1, (int)Math.Round(r.Height * k));
      if (small == null || small.Width != sw || small.Height != sh) {
        if (small != null) small.Dispose();
        small = new Bitmap(sw, sh, PixelFormat.Format24bppRgb);
        prev = null;
      }
      using (Graphics g = Graphics.FromImage(small)) {
        g.InterpolationMode = k < 0.5 ? InterpolationMode.HighQualityBilinear : InterpolationMode.Bilinear;
        g.PixelOffsetMode = PixelOffsetMode.Half;
        g.DrawImage(full, 0, 0, sw, sh);
      }
      img = small;
    }
    w = img.Width; h = img.Height;
    BitmapData d = img.LockBits(new Rectangle(0, 0, img.Width, img.Height), ImageLockMode.ReadOnly, img.PixelFormat);
    int len = Math.Abs(d.Stride) * img.Height;
    if (cur == null || cur.Length != len) cur = new byte[len];
    Marshal.Copy(d.Scan0, cur, 0, len);
    img.UnlockBits(d);
    bool same = prev != null && prev.Length == len && memcmp(cur, prev, (UIntPtr)len) == 0;
    byte[] t = prev; prev = cur; cur = t;
    changed = !same;
    if (same && !force) return null;
    using (MemoryStream ms = new MemoryStream()) {
      EncoderParameters ep = new EncoderParameters(1);
      ep.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, quality);
      img.Save(ms, jpeg, ep);
      return ms.ToArray();
    }
  }

  static void DrawCursor(Graphics g, Rectangle r) {
    CURSORINFO ci = new CURSORINFO();
    ci.cbSize = Marshal.SizeOf(typeof(CURSORINFO));
    if (!GetCursorInfo(ref ci) || (ci.flags & 1) == 0 || ci.hCursor == IntPtr.Zero) return;
    if (ci.hCursor != cursorCache) {
      ICONINFO ii;
      if (GetIconInfo(ci.hCursor, out ii)) {
        hotX = ii.xHotspot; hotY = ii.yHotspot;
        if (ii.hbmMask != IntPtr.Zero) DeleteObject(ii.hbmMask);
        if (ii.hbmColor != IntPtr.Zero) DeleteObject(ii.hbmColor);
      } else { hotX = 0; hotY = 0; }
      cursorCache = ci.hCursor;
    }
    int x = ci.pt.X - hotX - r.X, y = ci.pt.Y - hotY - r.Y;
    if (x < -64 || y < -64 || x > r.Width || y > r.Height) return;
    IntPtr hdc = g.GetHdc();
    try { DrawIconEx(hdc, x, y, ci.hCursor, 0, 0, 0, IntPtr.Zero, 3); } finally { g.ReleaseHdc(hdc); }
  }

  static void ShowNote(string viewer) {
    float s;
    using (Graphics g = Graphics.FromHwnd(IntPtr.Zero)) s = g.DpiX / 96f;
    note = new VrgNoteForm();
    note.Text = "VRG Képernyő";
    note.FormBorderStyle = FormBorderStyle.FixedToolWindow;
    note.ControlBox = false;
    note.TopMost = true;
    note.ShowInTaskbar = true;
    note.StartPosition = FormStartPosition.Manual;
    note.BackColor = Color.FromArgb(11, 37, 51);
    note.ForeColor = Color.FromArgb(220, 239, 244);
    note.ClientSize = new Size((int)(400 * s), (int)(84 * s));
    Label l = new Label();
    l.Text = "● A telefon látja a képernyőt: " + (string.IsNullOrEmpty(viewer) ? "telefon" : viewer);
    l.Font = new Font("Segoe UI", 10f, FontStyle.Bold);
    l.ForeColor = Color.FromArgb(255, 92, 122);
    l.AutoSize = false;
    l.SetBounds((int)(12 * s), (int)(8 * s), (int)(376 * s), (int)(34 * s));
    Button b = new Button();
    b.Text = "Leállítás";
    b.Font = new Font("Segoe UI", 10f);
    b.ForeColor = Color.FromArgb(220, 239, 244);
    b.BackColor = Color.FromArgb(16, 48, 65);
    b.FlatStyle = FlatStyle.Flat;
    b.SetBounds((int)(12 * s), (int)(44 * s), (int)(120 * s), (int)(32 * s));
    b.Click += delegate { Status("{\"type\":\"stopped\",\"by\":\"pc\"}"); stopping = true; };
    note.Controls.Add(l);
    note.Controls.Add(b);
    Rectangle wa = Screen.PrimaryScreen.WorkingArea;
    note.Location = new Point(wa.Right - note.Width - (int)(16 * s), wa.Bottom - note.Height - (int)(16 * s));
    note.Show();
  }

  static string MonitorsJson() {
    StringBuilder b = new StringBuilder("{\"type\":\"monitors\",\"monitors\":[");
    Screen[] all = Screen.AllScreens;
    for (int i = 0; i < all.Length; i++) {
      Rectangle r = all[i].Bounds;
      if (i > 0) b.Append(',');
      b.Append("{\"i\":").Append(i).Append(",\"x\":").Append(r.X).Append(",\"y\":").Append(r.Y)
       .Append(",\"w\":").Append(r.Width).Append(",\"h\":").Append(r.Height)
       .Append(",\"primary\":").Append(all[i].Primary ? "true" : "false").Append('}');
    }
    b.Append("],\"mode\":\"").Append(mode).Append("\",\"monitor\":").Append(monitor).Append(",\"quality\":\"").Append(qname).Append("\"}");
    return b.ToString();
  }

  static string Esc(string s) {
    StringBuilder b = new StringBuilder();
    foreach (char c in s ?? "") {
      if (c == '"' || c == '\\') b.Append('\\').Append(c);
      else if (c < ' ') b.Append(' ');
      else b.Append(c);
    }
    return b.ToString();
  }

  static bool Write(byte type, byte[] payload) {
    try {
      byte[] head = new byte[5];
      head[0] = type;
      head[1] = (byte)(payload.Length >> 24); head[2] = (byte)(payload.Length >> 16);
      head[3] = (byte)(payload.Length >> 8); head[4] = (byte)payload.Length;
      lock (outp) { outp.Write(head, 0, 5); outp.Write(payload, 0, payload.Length); outp.Flush(); }
      return true;
    } catch (Exception e) { why = "stdout: " + e.Message; stopping = true; return false; }
  }

  static bool Status(string json) { return Write((byte)'S', Encoding.UTF8.GetBytes(json)); }

  static bool Frame(byte[] jpg, int w, int h, bool keepalive) {
    byte[] p = new byte[5 + jpg.Length];
    p[0] = (byte)(w >> 8); p[1] = (byte)w; p[2] = (byte)(h >> 8); p[3] = (byte)h; p[4] = (byte)(keepalive ? 1 : 0);
    Buffer.BlockCopy(jpg, 0, p, 5, jpg.Length);
    return Write((byte)'F', p);
  }
}
`;

// One line, run with -Command, NOT -EncodedCommand: on this PC (2026-11-06) every PowerShell child
// started with -EncodedCommand was killed after ~9.8 s with exit code 0, a trivial sleep loop too,
// while the same loop under -Command ran to its end. 📸 and the clipboard are short enough not to
// notice; a stream is not. Nothing from the phone is in this line: the settings come through the
// environment, and the C# source too.
const PS = [
  "$ErrorActionPreference = 'Stop'",
  "$ProgressPreference = 'SilentlyContinue'",
  'Add-Type -ReferencedAssemblies System.Drawing, System.Windows.Forms -TypeDefinition $env:VRG_SCREEN_CS',
  "exit [VrgScreen]::Run($env:VRG_SCREEN_VIEWER, $env:VRG_SCREEN_MODE, [int]$env:VRG_SCREEN_MONITOR, $env:VRG_SCREEN_QUALITY, [int]$env:VRG_SCREEN_GAP, ($env:VRG_SCREEN_ALL -eq '1'), ($env:VRG_SCREEN_NOTE -ne '0'))",
].join('; ');

/** Splits the capture process's stdout into {type:'F'|'S', payload}. Returns a push(chunk) function. */
function psParser(onPacket, onError) {
  let buf = Buffer.alloc(0);
  let broken = false;
  return chunk => {
    if (broken) return;
    buf = buf.length ? Buffer.concat([buf, chunk]) : chunk;
    while (buf.length >= 5) {
      const type = String.fromCharCode(buf[0]);
      const len = buf.readUInt32BE(1);
      if ((type !== 'F' && type !== 'S') || len > MAX_PS_FRAME) { broken = true; onError(new Error('a rögzítő hibás adatot küldött')); return; }
      if (buf.length < 5 + len) break;
      onPacket({ type, payload: buf.subarray(5, 5 + len) });
      buf = buf.subarray(5 + len);
    }
    if (!buf.length) buf = Buffer.alloc(0);
    else buf = Buffer.from(buf);              // never keep a big parent buffer alive behind a small tail
  };
}

/** The width and height in a JPEG's SOF segment, or {w:0, h:0}. */
function jpegSize(b) {
  if (!b || b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return { w: 0, h: 0 };
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
    if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
    i += 2 + b.readUInt16BE(i + 2);
  }
  return { w: 0, h: 0 };
}

/**
 * The Windows capture. on: {frame(jpeg, w, h), status(obj), exit(reason)}. opts: {viewer, mode,
 * monitor, quality, gap, all (every frame, for measuring), note (the PC window; default on)}.
 */
function captureSource(opts, on) {
  const env = Object.assign({}, process.env, {
    VRG_SCREEN_CS: CS,
    VRG_SCREEN_VIEWER: String(opts.viewer || 'telefon').slice(0, 60),
    VRG_SCREEN_MODE: MODES.includes(opts.mode) ? opts.mode : 'screen',
    VRG_SCREEN_MONITOR: String(Number.isInteger(opts.monitor) ? opts.monitor : 0),
    VRG_SCREEN_QUALITY: QUALITIES.includes(opts.quality) ? opts.quality : 'high',
    VRG_SCREEN_GAP: String(opts.gap || GAP_MS),
    VRG_SCREEN_ALL: opts.all ? '1' : '0',
    VRG_SCREEN_NOTE: opts.note === false ? '0' : '1',
  });
  const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-STA', '-ExecutionPolicy', 'Bypass', '-Command', PS],
    { env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  let ended = false, err = '';
  const end = reason => { if (!ended) { ended = true; on.exit(reason); } };
  const push = psParser(p => {
    if (p.type === 'F') {
      if (p.payload.length < 5) return;
      on.frame(p.payload.subarray(5), p.payload.readUInt16BE(0), p.payload.readUInt16BE(2), p.payload[4] === 1);
    } else {
      let o = null;
      try { o = JSON.parse(p.payload.toString('utf8')); } catch (e) { return; }
      if (!o) return;
      if (o.type === 'stopped') end('pc');
      else if (o.type === 'bye') { if (!ended && on.log && o.why !== 'stop') on.log('a rogzito leallt: ' + String(o.why).slice(0, 200)); }
      else on.status(o);
    }
  }, () => { try { child.kill(); } catch (e) { } end('source'); });
  child.stdout.on('data', push);
  child.stderr.on('data', d => { if (err.length < 4000) err += d.toString(); });
  child.on('error', () => end('source'));
  child.on('exit', code => {
    if (!ended && on.log) on.log(`a rogzito kilepett (${code})` + (err.trim() ? ': ' + err.trim().split('\n').slice(0, 3).join(' | ') : ''));
    end('source');
  });
  child.stdin.on('error', () => { });
  return {
    pid: child.pid,
    set(s) { if (!ended) child.stdin.write(`set ${s.mode} ${s.monitor} ${s.quality}\n`); },
    stop() {
      if (ended) return;
      ended = true;
      try { child.stdin.end('stop\n'); } catch (e) { }
      const t = setTimeout(() => { try { child.kill(); } catch (e) { } }, 3000);
      t.unref && t.unref();
      child.on('exit', () => clearTimeout(t));
    },
  };
}

/** RELAY_FRAMES_DIR: the folder's *.jpg in name order, read once into memory, played in a loop. */
function framesSource(dir, opts, on) {
  const names = fs.readdirSync(dir).filter(n => /\.jpe?g$/i.test(n)).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  const frames = names.map(n => fs.readFileSync(path.join(dir, n)));
  let i = 0, ended = false;
  let s = { mode: MODES.includes(opts.mode) ? opts.mode : 'screen', monitor: 0, quality: QUALITIES.includes(opts.quality) ? opts.quality : 'high' };
  const monitors = () => ({ type: 'monitors', monitors: [{ i: 0, x: 0, y: 0, w: 1280, h: 720, primary: true }, { i: 1, x: 1280, y: 0, w: 1280, h: 1024, primary: false }],
    mode: s.mode, monitor: s.monitor, quality: s.quality });
  setImmediate(() => { if (!ended) on.status(monitors()); });
  const timer = setInterval(() => {
    if (ended || !frames.length) return;
    const f = frames[i++ % frames.length];
    const d = jpegSize(f);
    on.frame(f, d.w, d.h);
  }, opts.frameMs || Number(process.env.RELAY_FRAMES_MS) || 200);
  return {
    pid: null,
    set(n) { s = n; if (!ended) on.status(monitors()); },
    stop() { ended = true; clearInterval(timer); },
  };
}

/** The 16-byte header the phone reads (kit-core ScreenFrame). */
function frameHeader(seq, w, h, len, keepalive) {
  const b = Buffer.alloc(HEADER_BYTES);
  b[0] = 0x56; b[1] = 0x53; b[2] = 1; b[3] = keepalive ? 1 : 0;
  b.writeUInt32BE(seq >>> 0, 4);
  b.writeUInt16BE(Math.min(w, 65535), 8);
  b.writeUInt16BE(Math.min(h, 65535), 10);
  b.writeUInt32BE(len, 12);
  return b;
}

/** A phone's screen.set, checked: {mode, monitor, quality} or null. */
function checkSettings(p, monitors) {
  if (!p || typeof p !== 'object') return null;
  const mode = MODES.includes(p.mode) ? p.mode : null;
  const quality = QUALITIES.includes(p.quality) ? p.quality : null;
  const n = Number(p.monitor);
  const count = Array.isArray(monitors) && monitors.length ? monitors.length : 16;
  const monitor = Number.isInteger(n) && n >= 0 && n < count ? n : null;
  if (mode == null || quality == null || monitor == null) return null;
  return { mode, monitor, quality };
}

/**
 * opts (all optional): enabled (--shots), platform, framesDir, frameMs, limitMs, ttl, now (ms clock),
 * isPaired(pairId), log(line), source(opts, on) (a stand-in for tests), WebSocketServer (the ws class).
 */
function createScreen(opts) {
  opts = opts || {};
  const now = opts.now || Date.now;
  const ttl = opts.ttl || TICKET_TTL;
  const limitMs = opts.limitMs || Number(process.env.RELAY_SCREEN_LIMIT_MS) || LIMIT_MS;
  const framesDir = opts.framesDir !== undefined ? opts.framesDir : (process.env.RELAY_FRAMES_DIR || null);
  const platform = opts.platform || process.platform;
  const log = opts.log || (line => console.log(line));
  const WSS = opts.WebSocketServer || require('ws').WebSocketServer;
  const wss = new WSS({ noServer: true, perMessageDeflate: false, maxPayload: 4096 });
  const tickets = new Map();             // ticket -> {pairId, viewer, expires}
  let live = null;                        // the one viewer: {ws, pairId, viewer, ip, src, seq, frames, bytes, dropped, started, timer, monitors}
  const stats = { started: 0, ended: 0, lastEnd: null };

  function sweep() { const t = now(); for (const [k, v] of tickets) if (v.expires <= t) tickets.delete(k); }

  function available() {
    if (!opts.enabled) return { ok: false, reason: TEXT.off };
    if (!framesDir && !opts.source && platform !== 'win32') return { ok: false, reason: TEXT.platform };
    return { ok: true };
  }

  function end(reason, code) {
    const v = live;
    if (!v) return;
    live = null;
    clearTimeout(v.timer);
    try { v.src.stop(); } catch (e) { }
    stats.ended++; stats.lastEnd = reason;
    const secs = Math.round((now() - v.started) / 1000);
    log(`  [kepernyo] vege (${reason}): ${v.viewer} ${v.ip}  ${secs} s, ${v.frames} kep, ${Math.round(v.bytes / 1024)} KB, ${v.dropped} eldobva`);
    if (v.ws.readyState === v.ws.OPEN) {
      try { v.ws.send(JSON.stringify({ type: 'screen.end', reason, text: TEXT[reason] || reason })); } catch (e) { }
      try { v.ws.close(code || 1000, reason); } catch (e) { }
    }
    const t = setTimeout(() => { try { v.ws.terminate(); } catch (e) { } }, 2000);
    t.unref && t.unref();
  }

  function sendFrame(v, jpeg, w, h, keepalive) {
    if (live !== v || v.ws.readyState !== v.ws.OPEN) return;
    if (v.ws.bufferedAmount > MAX_BUFFERED) { v.dropped++; return; }     // never queue: the newest goes next
    v.seq++;
    v.frames++; v.bytes += jpeg.length;
    v.ws.send(Buffer.concat([frameHeader(v.seq, w, h, jpeg.length, keepalive), jpeg]), { binary: true });
  }

  function start(ws, t, ip) {
    const v = { ws, pairId: t.pairId, viewer: t.viewer, ip, seq: 0, frames: 0, bytes: 0, dropped: 0, started: now(), monitors: null, src: null, timer: null,
      settings: { mode: 'screen', monitor: 0, quality: 'high' } };
    live = v;
    stats.started++;
    log(`  [kepernyo] nezi: ${t.viewer} ${ip}  (a PC-n ertesito ablak, legfeljebb ${Math.round(limitMs / 60000)} perc)`);
    const on = {
      frame: (jpeg, w, h, keepalive) => sendFrame(v, jpeg, w, h, !!keepalive),
      status: o => {
        if (live !== v || ws.readyState !== ws.OPEN) return;
        if (o.type === 'monitors') { v.monitors = o.monitors; ws.send(JSON.stringify(Object.assign({}, o, { type: 'screen.monitors' }))); }
        else if (o.type === 'state') ws.send(JSON.stringify({ type: 'screen.state', visible: !!o.visible, reason: o.visible ? null : TEXT.hidden }));
      },
      exit: reason => { if (live === v) end(reason === 'pc' ? 'pc' : 'source', reason === 'pc' ? 4000 : 4500); },
      log: line => log('  ! [kepernyo] ' + line),
    };
    const so = { viewer: t.viewer, mode: v.settings.mode, monitor: 0, quality: v.settings.quality, frameMs: opts.frameMs };
    try {
      v.src = opts.source ? opts.source(so, on) : framesDir ? framesSource(framesDir, so, on) : captureSource(so, on);
    } catch (e) {
      v.src = { stop() { } };
      log('  ! [kepernyo] a rogzites nem indult: ' + e.message);
      end('source', 4500);
      return;
    }
    v.timer = setTimeout(() => end('limit', 4408), limitMs);
    v.timer.unref && v.timer.unref();
    ws.on('message', (data, isBinary) => {
      if (isBinary || live !== v) return;
      let m = null;
      try { m = JSON.parse(data.toString()); } catch (e) { return; }
      if (!m || m.type !== 'screen.set') return;
      const s = checkSettings(m, v.monitors);
      if (!s) return;
      v.settings = s;
      v.src.set(s);
    });
    ws.on('close', () => { if (live === v) end('left'); });
    ws.on('error', () => { });
  }

  return {
    TEXT,
    /** --shots is on and this box can capture (or play RELAY_FRAMES_DIR). */
    get available() { return available().ok; },
    get live() { return live ? { viewer: live.viewer, pairId: live.pairId, frames: live.frames, dropped: live.dropped, bytes: live.bytes, buffered: live.ws.bufferedAmount } : null; },
    stats,

    /** A one-connection ticket for a trusted phone. viewer = its paired name, shown on the PC. */
    ticket(pairId, viewer) {
      sweep();
      const a = available();
      if (!a.ok) return a;
      if (live) return { ok: false, busy: true, viewer: live.viewer, reason: TEXT.busy(live.viewer) };
      const t = crypto.randomBytes(16).toString('hex');
      tickets.set(t, { pairId: pairId || null, viewer: String(viewer || 'telefon').slice(0, 60), expires: now() + ttl });
      return { ok: true, ticket: t, ttl, path: '/screen' };
    },

    /** The /screen upgrade. Anything but a valid, unused ticket of a still-paired phone gets a plain refusal. */
    upgrade(req, socket, head) {
      const ip = (req.socket.remoteAddress || '').replace(/^::ffff:/, '');
      const refuse = (status, why) => {
        log(`  ! [kepernyo] elutasitva: ${ip} (${why})`);
        const body = JSON.stringify({ ok: false, reason: why });
        try {
          socket.write(`HTTP/1.1 ${status} ${status === 409 ? 'Conflict' : status === 404 ? 'Not Found' : 'Forbidden'}\r\n` +
            `Content-Type: application/json; charset=utf-8\r\nContent-Length: ${Buffer.byteLength(body)}\r\nConnection: close\r\n\r\n${body}`);
        } catch (e) { }
        socket.destroy();
      };
      const a = available();
      if (!a.ok) { refuse(404, a.reason); return; }
      sweep();
      const raw = req.headers[TICKET_HEADER];
      const t = typeof raw === 'string' && TICKET.test(raw) ? tickets.get(raw) : null;
      if (t) tickets.delete(raw);
      if (!t) { refuse(403, 'Lejárt, használt vagy hiányzó jegy.'); return; }
      if (opts.isPaired && t.pairId && !opts.isPaired(t.pairId)) { refuse(403, TEXT.unpaired); return; }
      if (live) { refuse(409, TEXT.busy(live.viewer)); return; }
      wss.handleUpgrade(req, socket, head, ws => start(ws, t, ip));
    },

    /** A pairing removed: its tickets go, and its stream ends at once. */
    revoke(pairId) {
      for (const [k, v] of tickets) if (v.pairId === pairId) tickets.delete(k);
      if (live && live.pairId === pairId) end('unpaired', 4410);
    },

    /** The relay is stopping. */
    close() { end('relay', 1001); tickets.clear(); },
  };
}

module.exports = {
  createScreen, captureSource, framesSource, psParser, jpegSize, frameHeader, checkSettings,
  TICKET_TTL, LIMIT_MS, MAX_BUFFERED, HEADER_BYTES, TICKET_HEADER, MODES, QUALITIES, TEXT, CS, PS,
};
