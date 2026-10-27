// vrg-probe — the Kódváros Tier A sidecar (P10, KV-21/22; report §1.4, CITY-D18 A, D25 A). Unelevated; reads, and
// changes nothing but a program's own volume or mute when the segéd asks.
//
// JSON lines on stdout: 'hello' once, 'windows' (the whole list, at start and every 15 s as a resync), then
// 'open' / 'close' / 'fg' as WinEvents arrive (SetWinEventHook needs a message loop, hence a sidecar). A window
// counts when it is a visible, uncloaked, titled top-level window that is not a tool window — what the taskbar
// shows. Only the handle, the process id, the exe name and the product name travel; never a window title.
// KV-22 adds 'audio' + 'peaks' (Audio.cs), 'media' (Media.cs, GSMTC), 'usb' + 'bt' (Devices.cs), each on its own thread.
// Stdin: one JSON command per line — {"t":"vol","key":"spotify.exe","v":0.4} or {"t":"mute","key":…,"on":true};
// KV-26 (the overlay's portal hand-off): {"t":"place","h":…,"x":…,"y":…,"w":…,"hh":…} moves one counted window onto a
// facade's screen rectangle and brings it to the front (its old placement kept in memory), {"t":"unplace","h":…} puts it
// back; each answers 'placed' / 'unplaced' with the rectangle the window really has.
// stdin closing (the companion gone) ends it. Nothing is written anywhere.
//
//   node CodeCity/tools/build-probe.js     -> CodeCity/probe/bin/publish/vrg-probe.exe
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;

static class Probe
{
    delegate void WinEventProc(IntPtr hook, uint ev, IntPtr hwnd, int idObject, int idChild, uint thread, uint time);
    delegate bool EnumProc(IntPtr hwnd, IntPtr lParam);

    [DllImport("user32.dll")] static extern IntPtr SetWinEventHook(uint min, uint max, IntPtr mod, WinEventProc proc, uint pid, uint tid, uint flags);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc proc, IntPtr lParam);
    [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr parent, EnumProc proc, IntPtr lParam);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr h, uint cmd);
    [DllImport("user32.dll")] static extern IntPtr GetAncestor(IntPtr h, uint flags);
    [DllImport("user32.dll")] static extern int GetWindowTextLengthW(IntPtr h);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassNameW(IntPtr h, StringBuilder sb, int max);
    [DllImport("user32.dll")] static extern long GetWindowLongPtrW(IntPtr h, int idx);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern int GetMessageW(out MSG m, IntPtr h, uint min, uint max);
    [DllImport("user32.dll")] static extern bool PostThreadMessageW(uint tid, uint msg, IntPtr w, IntPtr l);
    [DllImport("user32.dll")] static extern IntPtr SetTimer(IntPtr h, IntPtr id, uint ms, IntPtr fn);
    [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
    [DllImport("kernel32.dll")] static extern IntPtr OpenProcess(uint access, bool inherit, uint pid);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern bool QueryFullProcessImageNameW(IntPtr h, uint flags, StringBuilder sb, ref int size);
    [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h, int attr, out int value, int size);
    [DllImport("user32.dll")] static extern bool GetWindowPlacement(IntPtr h, ref WINDOWPLACEMENT p);
    [DllImport("user32.dll")] static extern bool SetWindowPlacement(IntPtr h, ref WINDOWPLACEMENT p);
    [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int w, int hh, uint flags);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int cmd);
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);
    [DllImport("user32.dll")] static extern void keybd_event(byte vk, byte scan, uint flags, IntPtr extra);
    [StructLayout(LayoutKind.Sequential)] struct RECT { public int l, t, r, b; }
    [StructLayout(LayoutKind.Sequential)] struct WINDOWPLACEMENT { public int length, flags, showCmd; public int minX, minY, maxX, maxY; public RECT normal; }
    static readonly Dictionary<IntPtr, WINDOWPLACEMENT> placed = new();

    [StructLayout(LayoutKind.Sequential)] struct MSG { public IntPtr hwnd; public uint message; public IntPtr wParam, lParam; public uint time; public int x, y; }

    const uint EVENT_SYSTEM_FOREGROUND = 0x0003, EVENT_OBJECT_DESTROY = 0x8001, EVENT_OBJECT_UNCLOAKED = 0x8018;
    const uint WINEVENT_OUTOFCONTEXT = 0, WINEVENT_SKIPOWNPROCESS = 2, WM_QUIT = 0x0012, WM_TIMER = 0x0113;
    const long WS_EX_TOOLWINDOW = 0x80;
    static readonly string[] Shell = { "Progman", "WorkerW", "Shell_TrayWnd", "Shell_SecondaryTrayWnd" };

    record Win(uint Pid, string Exe, string Name);
    static readonly Dictionary<IntPtr, Win> wins = new();
    static readonly Dictionary<uint, (string exe, string name)> procs = new();
    static readonly object outLock = new();
    static IntPtr fg;
    static WinEventProc? keep;   // the hook's delegate must outlive the hook

    static void Main()
    {
        Console.OutputEncoding = new UTF8Encoding(false);
        uint main = GetCurrentThreadId();
        new Thread(() => { try { string? l; while ((l = Console.In.ReadLine()) != null) Command(l); } catch { } PostThreadMessageW(main, WM_QUIT, 0, 0); }) { IsBackground = true }.Start();
        Emit(new { t = "hello", v = 2, pid = Environment.ProcessId });
        Resync(true);
        foreach (ThreadStart run in new ThreadStart[] { Audio.Run, Media.Run, Devices.Run })
            new Thread(() => { try { run(); } catch (Exception e) { Emit(new { t = "error", where = run.Method.DeclaringType?.Name, e = e.GetType().Name }); } }) { IsBackground = true }.Start();
        keep = OnEvent;
        SetWinEventHook(EVENT_SYSTEM_FOREGROUND, EVENT_SYSTEM_FOREGROUND, 0, keep, 0, 0, WINEVENT_OUTOFCONTEXT | WINEVENT_SKIPOWNPROCESS);
        SetWinEventHook(EVENT_OBJECT_DESTROY, EVENT_OBJECT_UNCLOAKED, 0, keep, 0, 0, WINEVENT_OUTOFCONTEXT | WINEVENT_SKIPOWNPROCESS);
        SetTimer(0, 0, 15000, 0);
        while (GetMessageW(out var m, 0, 0, 0) > 0) if (m.message == WM_TIMER) Resync(false);
    }

    // the only things the probe changes: one program's volume (0..1) or mute
    static void Command(string line)
    {
        try
        {
            using var d = JsonDocument.Parse(line);
            var r = d.RootElement;
            string t = r.GetProperty("t").GetString() ?? "";
            if (t == "place" || t == "unplace") { Place(t, r); return; }
            string key = r.GetProperty("key").GetString() ?? "";
            if (t == "vol") Audio.Command(key, (float)Math.Clamp(r.GetProperty("v").GetDouble(), 0, 1), null);
            else if (t == "mute") Audio.Command(key, null, r.GetProperty("on").GetBoolean());
        }
        catch { }
    }

    // the portal hand-off (KV-26): only a window the probe counts; the old placement is restored by 'unplace'
    static void Place(string t, JsonElement r)
    {
        IntPtr h = (IntPtr)r.GetProperty("h").GetInt64();
        if (!wins.ContainsKey(h)) { Emit(new { t = t + "d", h = (long)h, ok = false }); return; }
        if (t == "place")
        {
            var p = new WINDOWPLACEMENT { length = Marshal.SizeOf<WINDOWPLACEMENT>() };
            if (!placed.ContainsKey(h) && GetWindowPlacement(h, ref p)) placed[h] = p;
            ShowWindow(h, 9 /* SW_RESTORE: out of minimised or maximised */);
            SetWindowPos(h, 0 /* HWND_TOP */, r.GetProperty("x").GetInt32(), r.GetProperty("y").GetInt32(), r.GetProperty("w").GetInt32(), r.GetProperty("hh").GetInt32(), 0x0040 /* SWP_SHOWWINDOW */);
            // Windows only lets the foreground process hand the foreground on: a tap of Alt counts as user input
            keybd_event(0x12, 0, 0, 0); keybd_event(0x12, 0, 2, 0);
            SetForegroundWindow(h);
        }
        else if (placed.Remove(h, out var p)) SetWindowPlacement(h, ref p);
        GetWindowRect(h, out var rc);
        Emit(new { t = t + "d", h = (long)h, ok = true, x = rc.l, y = rc.t, w = rc.r - rc.l, hh = rc.b - rc.t });
    }

    static void OnEvent(IntPtr hook, uint ev, IntPtr h, int idObject, int idChild, uint thread, uint time)
    {
        if (h == 0 || idObject != 0 || idChild != 0) return;
        if (ev == EVENT_SYSTEM_FOREGROUND) { Foreground(); return; }
        if (ev != EVENT_OBJECT_DESTROY && GetAncestor(h, 2 /* GA_ROOT */) != h) return;
        Update(h, ev != EVENT_OBJECT_DESTROY && Counts(h));
        if (h == GetForegroundWindow()) Foreground();
    }

    static void Update(IntPtr h, bool counts)
    {
        bool had = wins.ContainsKey(h);
        if (counts && !had && Describe(h) is Win w) { wins[h] = w; Emit(new { t = "open", h = (long)h, pid = w.Pid, exe = w.Exe, name = w.Name }); }
        else if (!counts && had) { wins.Remove(h); Emit(new { t = "close", h = (long)h }); }
    }

    static void Foreground()
    {
        var h = GetForegroundWindow();
        if (h == fg) return;
        fg = h;
        Emit(new { t = "fg", h = wins.ContainsKey(h) ? (long)h : 0 });
    }

    // the whole list: at start, then every 15 s in case an event was missed
    static void Resync(bool first)
    {
        var now = new HashSet<IntPtr>();
        EnumWindows((h, _) => { if (Counts(h)) now.Add(h); return true; }, 0);
        foreach (var h in wins.Keys.Where(k => !now.Contains(k)).ToList()) Update(h, false);
        foreach (var h in now) Update(h, true);
        if (first) Emit(new { t = "windows", list = wins.Select(kv => new { h = (long)kv.Key, pid = kv.Value.Pid, exe = kv.Value.Exe, name = kv.Value.Name }) });
        Foreground();
    }

    static bool Counts(IntPtr h)
    {
        if (!IsWindowVisible(h) || GetWindow(h, 4 /* GW_OWNER */) != 0 || GetWindowTextLengthW(h) == 0) return false;
        if ((GetWindowLongPtrW(h, -20 /* GWL_EXSTYLE */) & WS_EX_TOOLWINDOW) != 0) return false;
        if (DwmGetWindowAttribute(h, 14 /* DWMWA_CLOAKED */, out int cloaked, 4) == 0 && cloaked != 0) return false;
        var cls = new StringBuilder(64); GetClassNameW(h, cls, 64);
        return !Shell.Contains(cls.ToString());
    }

    static Win? Describe(IntPtr h)
    {
        GetWindowThreadProcessId(h, out uint pid);
        if (pid == 0) return null;
        var (exe, name) = ProcName(pid);
        // a Store app lives in a frame owned by ApplicationFrameHost.exe: its real process owns a child window
        if (exe.Equals("ApplicationFrameHost.exe", StringComparison.OrdinalIgnoreCase))
        {
            uint inner = 0;
            EnumChildWindows(h, (c, _) => { GetWindowThreadProcessId(c, out uint p); if (p != pid && p != 0) { inner = p; return false; } return true; }, 0);
            if (inner != 0) { pid = inner; (exe, name) = ProcName(inner); }
        }
        return new Win(pid, exe, name);
    }

    // exe file name + product name of a process (cached; also used by the audio thread)
    public static (string exe, string name) ProcName(uint pid)
    {
        lock (procs) if (procs.TryGetValue(pid, out var c)) return c;
        string exe = "?", name = "?";
        IntPtr ph = OpenProcess(0x1000 /* PROCESS_QUERY_LIMITED_INFORMATION */, false, pid);
        if (ph != 0)
        {
            var sb = new StringBuilder(1024); int n = sb.Capacity;
            if (QueryFullProcessImageNameW(ph, 0, sb, ref n))
            {
                string full = sb.ToString();
                exe = Path.GetFileName(full);
                try { name = FileVersionInfo.GetVersionInfo(full).FileDescription ?? ""; } catch { name = ""; }
                if (string.IsNullOrWhiteSpace(name)) name = Path.GetFileNameWithoutExtension(full);
            }
            CloseHandle(ph);
        }
        var p = (exe, name.Trim());
        lock (procs) { if (procs.Count > 500) procs.Clear(); procs[pid] = p; }
        return p;
    }

    public static void Emit(object o) { string s = JsonSerializer.Serialize(o) + "\n"; lock (outLock) { Console.Out.Write(s); Console.Out.Flush(); } }
}
