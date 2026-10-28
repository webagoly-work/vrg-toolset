#!/usr/bin/env node
// ==========================================================================
// phone-relay-server.js
//
// Local relay for the Varler Planner phone-camera link. Serves
// phone-sender.html over HTTP and rebroadcasts every WebSocket message to
// all OTHER connected clients — phone -> planner tab, and back if needed.
// No internet: works over home WiFi or a phone/PC hotspot.
//
// Run:
//   node phone-relay-server.js            (port 47291)
//   node phone-relay-server.js 50123      (explicit port)
//   set GYRO_PORT=50123 && node phone-relay-server.js
//
// The port comes from, in order: the command line, GYRO_PORT, then 47291.
// 47291 sits above the registered-service range and below 49152, where
// Windows starts handing out ephemeral ports on its own — so nothing else
// should ever be sitting on it.
//
// CHANGED 25 Aug: was 8080, which collided with something already running.
// It also now prints its own LAN addresses AFTER binding, and steps to the
// next free port if the chosen one is taken, so the address on screen is
// always the address that actually works.
//
// CHANGED 30 Aug — two features merged from two separate work threads:
//   * /whoami  (QR subsystem) — a file:// page cannot discover its own LAN
//     address. The Planner asks the relay instead, so it can render a
//     phone-connect QR code. CORS is wide open because file:// sends a null
//     Origin; this server is LAN-only and holds nothing secret.
//   * role-aware routing (2.0-a) — every envelope carries `from`. A message
//     is delivered only to clients of a DIFFERENT role, so two phones, or a
//     stale planner tab, cannot feed each other. Clients that never send a
//     hello have no known role and receive everything, which keeps legacy
//     one-way senders working unchanged.
//
// CHANGED 27 Oct — VRG Légegér (AirDeck/): one phone, several apps.
//   * `to` — an envelope may name the role it is for ({to:'codecity'}). It
//     then reaches only clients of that role. Without `to`, routing is as
//     before, except that two APP roles (anything but 'phone') no longer
//     feed each other: a Kódváros hello must not become the Planner's peer.
//   * focus — an app sends {type:'focus'} when its window gains focus. The
//     relay remembers the last one and tells every phone, so the phone can
//     switch to that app's layout.
//   * roster — on every hello and close, phones get {from:'relay',
//     type:'roster', payload:{peers, focus}}: which apps are on the line.
//   * hello replay — each app's last hello is kept and replayed to a phone
//     that says hello later. Before this, a phone that connected AFTER the
//     Planner never learnt its tool table.
//
// CHANGED 28 Oct — screenshots for the phone (Légegér 📸).
//   A phone sends {type:'screenshot.request', to:'relay', payload:{mode:'screen'|'window'}}. The relay
//   captures this PC (Windows: PowerShell + System.Drawing; macOS: screencapture; Linux: grim / import),
//   keeps the PNG under an unguessable name for 10 minutes and answers the asking phone only with
//   {from:'relay', type:'screenshot', payload:{ok, url:'/shot/<hex>.png', name, bytes}}; the phone
//   fetches it over HTTP and offers it for saving / sharing.
//   OFF unless started with --shots (or RELAY_SHOTS=1): anyone on the WiFi who can reach this port
//   could otherwise look at the screen. AirDeck\legeger.cmd starts the relay with it; START.cmd G
//   does not. Every capture is logged on the console with the asking address.
//   RELAY_SHOT_FILE=<png> answers with that file instead of capturing — tests and headless boxes.
// ==========================================================================

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { WebSocketServer } = require('ws');

const DEFAULT_PORT = 47291;
const MAX_TRIES = 8;                       // 47291..47298

const ARGS = process.argv.slice(2);
const wanted = Number(ARGS.find(a => /^\d+$/.test(a))) || Number(process.env.GYRO_PORT) || DEFAULT_PORT;
const SHOTS = ARGS.includes('--shots') || process.env.RELAY_SHOTS === '1';
const SENDER_PAGE = path.join(__dirname, '..', 'mobile', 'phone-sender.html');
const SENDER_FALLBACK = path.join(__dirname, 'phone-sender.html');

function senderPath() {
  if (fs.existsSync(SENDER_PAGE)) return SENDER_PAGE;
  if (fs.existsSync(SENDER_FALLBACK)) return SENDER_FALLBACK;
  return null;
}

/* ---- interface preference ----------------------------------------------
   The dev machine is dual-homed on purpose: Ethernet for the house LAN and
   a WiFi dongle for testing the phone link. os.networkInterfaces() lists
   Ethernet first, which made the banner and the /whoami fallback advertise
   an address the phone cannot reach.

   Order is deliberate, not incidental: wireless first, then everything
   else, then virtual adapters (VirtualBox / VMware / Hyper-V / WSL) dead
   last — those have LAN-looking addresses and reach nothing.

   Override with RELAY_IFACE=<substring>, e.g. RELAY_IFACE="WiFi 2". */

const IFACE_PREFER = process.env.RELAY_IFACE || null;
const WIRELESS_RE = /wi[-\s]?fi|wlan|wireless|wl\d/i;
const VIRTUAL_RE  = /virtualbox|vmware|hyper-v|vethernet|loopback|tailscale|zerotier|wsl|docker|bluetooth/i;

function ifaceRank(name) {
  if (IFACE_PREFER && name.toLowerCase().includes(IFACE_PREFER.toLowerCase())) return 0;
  if (VIRTUAL_RE.test(name)) return 3;
  if (WIRELESS_RE.test(name)) return 1;
  return 2;
}

function lanAddresses() {
  const out = [];
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const i of ifaces[name] || []) {
      if (i.family === 'IPv4' && !i.internal) {
        out.push({ name, address: i.address, netmask: i.netmask || null, rank: ifaceRank(name) });
      }
    }
  }
  out.sort((a, b) => a.rank - b.rank);
  return out;
}

/* ---- which of our addresses can a given client actually reach? ----------
   A dual-homed PC (Ethernet 192.168.0.x + WiFi 192.168.1.x) has more than
   one answer, and handing back the wrong one produces a QR code that scans
   perfectly and connects to nothing. The request itself carries the client's
   IP, so match it against each interface's netmask and answer with the
   address on THAT subnet. Falls back to the first address when nothing
   matches — better a guess than a null. */

function ipToInt(ip) {
  const p = String(ip).split('.');
  if (p.length !== 4) return null;
  let n = 0;
  for (const o of p) {
    const v = Number(o);
    if (!Number.isInteger(v) || v < 0 || v > 255) return null;
    n = (n * 256) + v;
  }
  return n;
}

function sameSubnet(a, b, mask) {
  const A = ipToInt(a), B = ipToInt(b), M = ipToInt(mask);
  if (A == null || B == null || M == null) return false;
  // >>> 0 keeps the result unsigned; bitwise ops in JS are signed 32-bit
  return ((A & M) >>> 0) === ((B & M) >>> 0);
}

function clientIp(req) {
  return (req.socket.remoteAddress || '').replace(/^::ffff:/, '');
}

function bestAddressFor(req, addrs) {
  const you = clientIp(req);
  if (you) {
    const hit = addrs.find(a => a.netmask && sameSubnet(you, a.address, a.netmask));
    if (hit) return { address: hit.address, matched: true, iface: hit.name };
  }
  // No subnet match: fall back to the highest-ranked interface. lanAddresses()
  // already sorted, so addrs[0] is the preferred one.
  return addrs.length
    ? { address: addrs[0].address, matched: false, iface: addrs[0].name }
    : { address: null, matched: false, iface: null };
}

/* ---- http + websocket --------------------------------------------------- */

const server = http.createServer((req, res) => {
  const url = (req.url || '').split('?')[0];
  if (url === '/' || url === '/phone-sender.html') {
    const p = senderPath();
    if (!p) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('phone-sender.html not found in mobile/ or next to this script');
      return;
    }
    fs.readFile(p, (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('could not read phone-sender.html: ' + err.message);
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store'          // always serve the current file
      });
      res.end(data);
    });
    return;
  }
  // ---- /whoami -----------------------------------------------------------
  // Answers: which addresses am I reachable on, and on what port. The
  // Planner runs from file:// and has no way to learn this by itself.
  if (url === '/whoami') {
    const port = (server.address() && server.address().port) || wanted;
    const addrs = lanAddresses();
    const best = bestAddressFor(req, addrs);
    const body = JSON.stringify({
      ok: true,
      port: port,
      addresses: addrs.map(a => a.address),
      interfaces: addrs,
      you: clientIp(req),              // the asking device, as we see it
      primary: best.address,           // the address THAT device can reach
      primaryIface: best.iface,
      subnetMatched: best.matched,     // false = we guessed; treat with suspicion
      url: best.address ? `http://${best.address}:${port}` : null,
      ws: best.address ? `ws://${best.address}:${port}` : null,
      clients: clients.size,
      roster: roster(),
      focus: lastFocus,
      shots: SHOTS,
      app: 'varler-phone-relay',
      v: 3
    });
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',        // file:// sends Origin: null
      'Cache-Control': 'no-store'
    });
    res.end(body);
    return;
  }

  // ---- /shot/<hex>.png — a capture made for a phone (see the 28 Oct note) --
  const sm = /^\/shot\/([0-9a-f]{32})\.png$/.exec(url);
  if (sm && SHOTS) {
    const file = path.join(SHOT_DIR, sm[1] + '.png');
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('expired'); return; }
      res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': data.length, 'Cache-Control': 'no-store' });
      res.end(data);
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

const wss = new WebSocketServer({ server });
const clients = new Set();

const PHONE = 'phone';
let relaySeq = 0;
let lastFocus = null;                      // { role, app, title, t } of the app last focused

function roleOf(ws) { return ws.__role || null; }
function isApp(role) { return !!role && role !== PHONE; }

function fromRelay(type, payload) {
  return JSON.stringify({ v: 1, from: 'relay', seq: ++relaySeq, t: Date.now(), type: type, payload: payload });
}

function roster() {
  const out = [];
  for (const c of clients) {
    if (c.readyState === c.OPEN && roleOf(c)) out.push({ role: roleOf(c), app: c.__app || null });
  }
  return out;
}

function toPhones(raw) {
  for (const c of clients) if (c.readyState === c.OPEN && roleOf(c) === PHONE) c.send(raw);
}

function sendRoster() { toPhones(fromRelay('roster', { peers: roster(), focus: lastFocus })); }

// Who gets a message from `ws`. Kept as one function so the rule is readable
// in one place: explicit target first, then no echo, then no app-to-app.
function deliverTo(ws, other, from, to) {
  if (other === ws || other.readyState !== other.OPEN) return false;
  const r = roleOf(other);
  if (to) return r === to;
  if (from && r && r === from) return false;          // same role: don't echo sideways
  if (isApp(from) && isApp(r)) return false;          // Planner and Kódváros don't talk to each other
  return true;
}

wss.on('connection', (ws, req) => {
  clients.add(ws);
  const ip = (req.socket.remoteAddress || '').replace(/^::ffff:/, '');
  console.log(`  + csatlakozott: ${ip}   (${clients.size} kliens)`);

  ws.on('message', raw => {
    const payload = raw.toString();

    // learn this client's role from its hello, and log it once
    let from = null, to = null, m = null;
    try {
      m = JSON.parse(payload);
      from = (m && m.from) || null;
      to = (m && typeof m.to === 'string' && m.to) || null;
    } catch (e) { m = null; /* not JSON: pass it through untouched */ }

    if (m && m.type === 'hello') {
      const first = !ws.__role;
      ws.__role = ws.__role || (m.payload && m.payload.role) || from || null;
      ws.__app = (m.payload && m.payload.app) || ws.__app || null;
      if (isApp(ws.__role)) ws.__hello = payload;     // replayed to phones that arrive later
      if (first) console.log(`    ${ip} = ${ws.__role} ${ws.__app || ''}`);
      if (ws.__role === PHONE) {
        for (const c of clients) {
          if (c !== ws && c.readyState === c.OPEN && c.__hello && isApp(roleOf(c))) ws.send(c.__hello);
        }
      }
    }

    if (m && m.type === 'screenshot.request' && to === 'relay') {
      if (roleOf(ws) !== PHONE) return;
      takeShot(ws, ip, (m.payload && m.payload.mode) === 'window' ? 'window' : 'screen');
      return;
    }

    if (m && m.type === 'focus' && isApp(from)) {
      lastFocus = {
        role: from,
        app: (m.payload && m.payload.app) || ws.__app || null,
        title: (m.payload && m.payload.title) || null,
        t: Date.now()
      };
    }

    for (const other of clients) {
      if (deliverTo(ws, other, from, to)) other.send(payload);
    }

    if (m && m.type === 'hello') sendRoster();
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`  - lecsatlakozott: ${ip}   (${clients.size} kliens)`);
    if (lastFocus && ws.__role === lastFocus.role &&
        ![...clients].some(c => roleOf(c) === lastFocus.role)) lastFocus = null;
    if (ws.__role) sendRoster();
  });

  ws.on('error', err => console.log(`  ! socket hiba: ${err.message}`));
});

/* ---- screenshots -------------------------------------------------------- */

const SHOT_DIR = path.join(os.tmpdir(), 'vrg-relay-shots');
const SHOT_TTL = 10 * 60 * 1000;
let shotBusy = false;

// Windows: one PowerShell run. DPI-aware first, so a 150 % display is captured at its real pixels;
// 'window' is the foreground window's rectangle, 'screen' the whole virtual desktop (all monitors).
const PS_SHOT = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
Add-Type @"
using System; using System.Runtime.InteropServices;
public static class VrgShot {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
}
"@
[VrgShot]::SetProcessDPIAware() | Out-Null
if ($env:VRG_SHOT_MODE -eq 'window') {
  $r = New-Object VrgShot+RECT
  [VrgShot]::GetWindowRect([VrgShot]::GetForegroundWindow(), [ref]$r) | Out-Null
  $x = $r.Left; $y = $r.Top; $w = $r.Right - $r.Left; $h = $r.Bottom - $r.Top
} else {
  $v = [System.Windows.Forms.SystemInformation]::VirtualScreen
  $x = $v.X; $y = $v.Y; $w = $v.Width; $h = $v.Height
}
$bmp = New-Object System.Drawing.Bitmap $w, $h
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($x, $y, 0, 0, $bmp.Size)
$bmp.Save($env:VRG_SHOT_OUT, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
`;

function captureTo(file, mode, done) {
  const env = Object.assign({}, process.env, { VRG_SHOT_OUT: file, VRG_SHOT_MODE: mode });
  const opts = { env, timeout: 20000, windowsHide: true };
  if (process.env.RELAY_SHOT_FILE) {
    fs.copyFile(process.env.RELAY_SHOT_FILE, file, done);
    return;
  }
  if (process.platform === 'win32') {
    const enc = Buffer.from(PS_SHOT, 'utf16le').toString('base64');
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', enc], opts, err => done(err));
    return;
  }
  if (process.platform === 'darwin') {
    execFile('screencapture', ['-x', file], opts, err => done(err));   // -W would wait for a click on the Mac
    return;
  }
  // Linux: Wayland's grim first, then ImageMagick's import on X11
  execFile('grim', [file], opts, err => {
    if (!err) return done(null);
    execFile('import', ['-window', 'root', file], opts, err2 => done(err2));
  });
}

function sweepShots() {
  fs.readdir(SHOT_DIR, (err, names) => {
    if (err) return;
    const now = Date.now();
    for (const n of names) {
      const f = path.join(SHOT_DIR, n);
      fs.stat(f, (e, st) => { if (!e && now - st.mtimeMs > SHOT_TTL) fs.unlink(f, () => {}); });
    }
  });
}

function stamp(d) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}

function takeShot(ws, ip, mode) {
  const answer = payload => { if (ws.readyState === ws.OPEN) ws.send(fromRelay('screenshot', payload)); };
  if (!SHOTS) {
    answer({ ok: false, reason: 'A képernyőkép ki van kapcsolva: a relét --shots kapcsolóval kell indítani (legeger.cmd → 1).' });
    return;
  }
  if (shotBusy) { answer({ ok: false, reason: 'Már készül egy kép.' }); return; }
  shotBusy = true;
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  sweepShots();
  const id = crypto.randomBytes(16).toString('hex');
  const file = path.join(SHOT_DIR, id + '.png');
  captureTo(file, mode, err => {
    shotBusy = false;
    if (err) {
      console.log(`  ! kepernyokep hiba (${ip}): ${err.message.split('\n')[0]}`);
      answer({ ok: false, reason: 'A kép nem készült el: ' + err.message.split('\n')[0] });
      return;
    }
    fs.stat(file, (e, st) => {
      if (e) { answer({ ok: false, reason: 'A kép nem készült el.' }); return; }
      console.log(`  [kep] kepernyokep (${mode}) -> ${ip}   ${Math.round(st.size / 1024)} KB`);
      answer({ ok: true, url: `/shot/${id}.png`, name: `kepernyo-${stamp(new Date())}.png`, bytes: st.size, mode });
    });
  });
}

process.on('exit', () => { try { fs.rmSync(SHOT_DIR, { recursive: true, force: true }); } catch (e) { } });
process.on('SIGINT', () => process.exit(0));

/* ---- binding, with a walk to the next free port ------------------------- */

let attempt = 0;

server.on('error', err => {
  if (err.code !== 'EADDRINUSE') throw err;

  const busy = wanted + attempt;
  attempt++;

  if (attempt >= MAX_TRIES) {
    console.error('');
    console.error(`  A ${wanted}..${busy} portok mind foglaltak.`);
    console.error('  Ki tartja? Parancssorban:');
    console.error(`     netstat -ano | findstr :${wanted}`);
    console.error('  Vagy adj meg egy másik portot a scripts\\_env.cmd fájlban');
    console.error('  (GYRO_PORT=...), vagy itt: node phone-relay-server.js 50123');
    console.error('');
    process.exit(1);
  }

  console.log(`  A ${busy} port foglalt — próbálom a ${wanted + attempt}-t...`);
  setTimeout(() => server.listen(wanted + attempt), 120);
});

server.on('listening', () => {
  const port = server.address().port;
  const addrs = lanAddresses();

  console.log('');
  console.log('  ===========================================');
  console.log('   A TELEFONON EZT NYISD MEG:');
  console.log('');
  if (addrs.length) {
    addrs.forEach((a, i) => console.log(
      `       http://${a.address}:${port}` + (i === 0 ? `   <-- ${a.name}` : `   (${a.name})`)
    ));
  } else {
    console.log('       (nincs WiFi/LAN cím — csatlakozz hálózatra,');
    console.log('        vagy kapcsold be a telefon hotspotot)');
  }
  console.log('');
  console.log('   Telefon és PC UGYANAZON a WiFi-n legyen.');
  console.log(SHOTS ? '   Képernyőkép a telefonra: BEKAPCSOLVA (--shots)' : '   Képernyőkép a telefonra: ki (indítás --shots kapcsolóval)');
  console.log('   Mobiladat nem jó.');
  console.log('  ===========================================');
  console.log('');
  if (!senderPath()) {
    console.log('  FIGYELEM: phone-sender.html nincs meg a mobile/ mappában —');
    console.log('  a telefon üres oldalt fog kapni.');
    console.log('');
  }
  console.log('  Leállítás: Ctrl+C');
  console.log('');
});

server.listen(wanted);
