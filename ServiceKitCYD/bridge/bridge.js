#!/usr/bin/env node
/*
  SK-CYD bridge — the smart half of the ServiceKit CYD companion.

  Talks the line protocol in protocol.md to a classic CYD over its USB-serial
  COM port, OR to the browser simulator over a WebSocket (no hardware needed).

    node bridge.js --sim                 serial off, WebSocket on :47800/cyd  (for sim/)
    node bridge.js --port COM5           real CYD on a serial port
    node bridge.js --port COM5 --sim     both at once
    node bridge.js --kit "E:\\ServiceKit" --sim

  Flags:
    --port <name>     serial device (COMx on Windows, /dev/ttyUSB0 on Linux)
    --baud <n>        default 115200
    --sim             open a WebSocket server the simulator connects to
    --wsport <n>      WebSocket port, default 47814
    --kit <path>      the mounted ServiceKit stick (auto-detected if omitted)
    --mock-pc         serve a fake set of PC drives/dirs (for testing off a PC)
    --once <line>     feed one CYD->bridge line, print the replies, exit (tests)

  PRIVACY: personal project. This bridge never emits real client data. Job client
  names are blanked to "—" unless a job is explicitly opted in; demo data is fake.

  serialport is optional — load it only when --port is given, so --sim/--once run
  with zero dependencies. The WebSocket server is a tiny built-in RFC6455 impl so
  there are no deps at all for the simulator path either.
*/
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const http = require('http');

const VER = '0.1.0';
const CHARSET_EXTRA = 'áéíóöőúüűÁÉÍÓÖŐÚÜŰ°–…·×';
const FOLD = { 'â':'a','ä':'a','à':'a','ã':'a','ê':'e','ë':'e','è':'e','î':'i','ï':'i','ì':'i','ô':'o','õ':'o','ò':'o','û':'u','ù':'u','ñ':'n','ç':'c','ß':'ss','’':"'",'“':'"','”':'"','—':'–','\t':' ' };

// ---------------------------------------------------------------- args
function parseArgs(argv) {
  const a = { baud: 115200, wsport: 47814, sim: false, mockPc: false };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--sim') a.sim = true;
    else if (k === '--mock-pc') a.mockPc = true;
    else if (k === '--port') a.port = argv[++i];
    else if (k === '--baud') a.baud = +argv[++i];
    else if (k === '--wsport') a.wsport = +argv[++i];
    else if (k === '--kit') a.kit = argv[++i];
    else if (k === '--once') a.once = argv[++i];
    else if (k === '--help' || k === '-h') a.help = true;
  }
  return a;
}
const ARGS = parseArgs(process.argv);
if (ARGS.help) { console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace('/*', '').trim()); process.exit(0); }
const IS_WIN = process.platform === 'win32';
if (ARGS.mockPc || (!IS_WIN && !ARGS.port)) ARGS.mockPc = ARGS.mockPc || !IS_WIN; // off-Windows testing uses mock PC

// ---------------------------------------------------------------- charset guard
function sanitizeField(s, maxBytes) {
  if (s === undefined || s === null) return '';
  s = String(s).replace(/[|\n\r]/g, (m) => (m === '|' ? '/' : ' '));
  let out = '';
  for (const ch of s) {
    if (ch >= ' ' && ch.charCodeAt(0) < 127) out += ch;
    else if (CHARSET_EXTRA.indexOf(ch) >= 0) out += ch;
    else if (FOLD[ch] !== undefined) out += FOLD[ch];
    // else: drop (emoji, CJK, box-drawing…)
  }
  if (maxBytes) {
    const buf = Buffer.from(out, 'utf8');
    if (buf.length > maxBytes) {
      let n = maxBytes;
      while (n > 0 && (buf[n] & 0xc0) === 0x80) n--; // don't cut mid-codepoint
      out = buf.slice(0, n).toString('utf8');
    }
  }
  return out;
}
function line(tag, ...fields) { return tag + (fields.length ? '|' + fields.map((f) => sanitizeField(f, 120)).join('|') : ''); }

// ---------------------------------------------------------------- transports
const clients = new Set();  // each: { send(str), name }
function broadcast(str) { for (const c of clients) { try { c.send(str); } catch (e) {} } }
function log(...a) { if (!ARGS.once) console.log('[bridge]', ...a); }

// --- minimal WebSocket server (RFC6455 text frames) ---
function startWsServer(port) {
  const server = http.createServer((req, res) => { res.writeHead(426); res.end('WebSocket only'); });
  server.on('upgrade', (req, socket) => {
    const key = req.headers['sec-websocket-key'];
    if (!key) { socket.destroy(); return; }
    const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
    socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
    const client = {
      name: 'sim',
      send(str) {
        const payload = Buffer.from(str + '\n', 'utf8');
        const len = payload.length;
        let header;
        if (len < 126) header = Buffer.from([0x81, len]);
        else if (len < 65536) { header = Buffer.from([0x81, 126, (len >> 8) & 255, len & 255]); }
        else { header = Buffer.alloc(10); header[0] = 0x81; header[1] = 127; header.writeUInt32BE(len, 6); }
        socket.write(Buffer.concat([header, payload]));
      }
    };
    let buf = Buffer.alloc(0), rx = '';
    socket.on('data', (d) => {
      buf = Buffer.concat([buf, d]);
      while (buf.length >= 2) {
        const op = buf[0] & 0x0f, masked = buf[1] & 0x80; let len = buf[1] & 0x7f, off = 2;
        if (len === 126) { if (buf.length < 4) break; len = buf.readUInt16BE(2); off = 4; }
        else if (len === 127) { if (buf.length < 10) break; len = Number(buf.readBigUInt64BE(2)); off = 10; }
        const need = off + (masked ? 4 : 0) + len;
        if (buf.length < need) break;
        let payload;
        if (masked) { const mask = buf.slice(off, off + 4); payload = buf.slice(off + 4, off + 4 + len); for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3]; }
        else payload = buf.slice(off, off + len);
        buf = buf.slice(need);
        if (op === 0x8) { socket.end(); return; }
        if (op === 0x1 || op === 0x0) { rx += payload.toString('utf8'); let nl; while ((nl = rx.indexOf('\n')) >= 0) { const ln = rx.slice(0, nl).replace(/\r$/, ''); rx = rx.slice(nl + 1); if (ln) onCydLine(ln, client); } }
      }
    });
    socket.on('close', () => { clients.delete(client); log('sim disconnected'); });
    socket.on('error', () => {});
    clients.add(client);
    log('sim connected');
    client.send(line('HELLO', PC_NAME, VER));
    sendKit(client);
  });
  server.listen(port, '127.0.0.1', () => log('simulator WebSocket on ws://127.0.0.1:' + port + '/'));
  return server;
}

// --- serial (optional dependency) ---
function startSerial(portName, baud) {
  let SerialPort;
  try { ({ SerialPort } = require('serialport')); }
  catch (e) { console.error('serialport not installed. Run `npm i serialport` for real hardware, or use --sim.'); process.exit(1); }
  const sp = new SerialPort({ path: portName, baudRate: baud });
  const client = { name: 'cyd', send(str) { sp.write(str + '\n'); } };
  let rx = '';
  sp.on('open', () => { log('serial open ' + portName + ' @' + baud); clients.add(client); client.send(line('HELLO', PC_NAME, VER)); sendKit(client); });
  sp.on('data', (d) => { rx += d.toString('utf8'); let nl; while ((nl = rx.indexOf('\n')) >= 0) { const ln = rx.slice(0, nl).replace(/\r$/, ''); rx = rx.slice(nl + 1); if (ln) onCydLine(ln, client); } });
  sp.on('close', () => { clients.delete(client); log('serial closed'); });
  sp.on('error', (e) => console.error('[serial]', e.message));
  return sp;
}

// ---------------------------------------------------------------- PC facts
const PC_NAME = os.hostname();

function listDrivesReal() {
  const out = [];
  if (IS_WIN) {
    // wmic is being retired; try PowerShell Get-PSDrive-ish via child_process would block.
    // Keep it dependency-free & synchronous: probe letters A..Z for existence + free space.
    const cp = require('child_process');
    try {
      const ps = cp.execSync('powershell -NoProfile -Command "Get-CimInstance Win32_LogicalDisk | ForEach-Object { \\"$($_.DeviceID)|$($_.VolumeName)|$($_.FreeSpace)|$($_.Size)|$($_.DriveType)\\" }"', { encoding: 'utf8', timeout: 8000 });
      const kind = { '2': 'removable', '3': 'fixed', '4': 'net', '5': 'cd' };
      for (const l of ps.split(/\r?\n/)) {
        const p = l.split('|'); if (p.length < 5 || !p[0]) continue;
        out.push({ id: p[0], label: p[1] || '', freeGB: +p[2] ? +(+p[2] / 1073741824).toFixed(1) : 0, totalGB: +p[3] ? +(+p[3] / 1073741824).toFixed(1) : 0, kind: kind[p[4]] || 'fixed' });
      }
    } catch (e) { log('drive probe failed:', e.message); }
  }
  return out;
}

const MOCK_FS = {
  drives: [
    { id: 'C:', label: 'Windows', freeGB: 48.2, totalGB: 475.9, kind: 'fixed' },
    { id: 'E:', label: 'SERVICEKIT', freeGB: 41.0, totalGB: 57.6, kind: 'removable' },
    { id: 'Z:', label: 'nas-share', freeGB: 1203.0, totalGB: 3700.0, kind: 'net' }
  ],
  tree: {
    'C:': { d: ['Users', 'Windows', 'Program Files'], f: [] },
    'C:/Users': { d: ['Public', 'minta'], f: [] },
    'E:': { d: ['core', 'launcher', 'tools', 'docs'], f: [['START.cmd', 120], ['SETUP.cmd', 140], ['PARANCSOK.html', 110000], ['README.md', 9000]] },
    'E:/tools': { d: ['sysinternals', 'crystaldiskinfo', '_inbox'], f: [] },
    'E:/docs': { d: [], f: [['OLVASS-README.txt', 400]] }
  }
};

function sendDrives(client) {
  const drives = ARGS.mockPc ? MOCK_FS.drives : listDrivesReal();
  for (const d of drives) client.send(line('DRV', d.id, d.label, d.freeGB, d.totalGB, d.kind));
}

function listDir(p) {
  // returns { entries:[{name,isDir,sizeKB,mtime}], truncated }
  const entries = []; let truncated = false;
  if (ARGS.mockPc) {
    const key = p.replace(/\\/g, '/').replace(/\/$/, '') || '';
    const node = MOCK_FS.tree[key];
    if (!node) return { entries, truncated };
    for (const d of node.d) entries.push({ name: d, isDir: 1, sizeKB: 0, mtime: '' });
    for (const f of node.f) entries.push({ name: f[0], isDir: 0, sizeKB: Math.round(f[1]), mtime: '2026-10-28' });
    return { entries, truncated };
  }
  let names;
  try { names = fs.readdirSync(p); } catch (e) { return { entries, truncated, error: e.code }; }
  for (const n of names) {
    if (entries.length >= 300) { truncated = true; break; }
    let st; try { st = fs.statSync(path.join(p, n)); } catch (e) { continue; }
    entries.push({ name: n, isDir: st.isDirectory() ? 1 : 0, sizeKB: st.isDirectory() ? 0 : Math.round(st.size / 1024), mtime: st.mtime.toISOString().slice(0, 10) });
  }
  entries.sort((a, b) => (b.isDir - a.isDir) || a.name.localeCompare(b.name));
  return { entries, truncated };
}

// ---------------------------------------------------------------- the ServiceKit stick
let KIT = { present: false, drive: '', path: '', ver: '' };
function detectKit() {
  if (ARGS.kit) { KIT.path = ARGS.kit; }
  else {
    const candidates = [];
    if (ARGS.mockPc) { KIT = { present: true, drive: 'E:', path: '(mock)E:/', ver: '1.2.0' }; return; }
    if (IS_WIN) { for (let c = 68; c <= 90; c++) candidates.push(String.fromCharCode(c) + ':\\ServiceKit'); }
    for (const c of candidates) if (fs.existsSync(path.join(c, 'core', 'catalog.json'))) { KIT.path = c; break; }
  }
  if (KIT.path && !ARGS.mockPc) {
    KIT.present = fs.existsSync(path.join(KIT.path, 'core', 'catalog.json'));
    KIT.drive = KIT.path.slice(0, 2);
    try { KIT.ver = JSON.parse(fs.readFileSync(path.join(KIT.path, 'core', 'catalog.json'), 'utf8')).version || ''; } catch (e) {}
  }
}
function sendKit(client) { (client ? [client] : [...clients]).forEach((c) => c.send(line('KIT', KIT.present ? 1 : 0, KIT.drive, KIT.ver))); }

// ---------------------------------------------------------------- ServiceKit live state (read-only mirror, privacy-guarded)
function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; } }
function pushState() {
  if (!KIT.present || ARGS.mockPc) return;
  const stateDir = path.join(KIT.path, 'state');
  const active = readJson(path.join(stateDir, 'active-job.json'));
  if (active && active.id) {
    const job = readJson(path.join(KIT.path, 'data', 'jobs', active.id + '.json'));
    if (job) {
      // Privacy: never emit the real client name unless the job opted in.
      const client = job.optIn ? (job.client && job.client.name) : '—';
      broadcast(line('JOB', client || '—', job.computer || '', job.status || '', jobMinutes(job)));
    }
  }
  const pb = readJson(path.join(stateDir, 'playbook-active.json'));
  if (pb && pb.id) {
    const run = readJson(path.join(stateDir, 'playbooks', pb.id, 'run.json'));
    if (run) {
      let done = 0, total = 0, running = 0, lastStatus = '', lastText = '';
      for (let i = 0; i < (run.steps || []).length; i++) {
        const r = readJson(path.join(stateDir, 'playbooks', pb.id, i + '.json'));
        if (!(run.steps[i].include === false)) total++;
        if (r && r.status && r.status !== 'running' && r.status !== 'pending') { done++; lastStatus = r.status; lastText = (r.summary && r.summary.hu) || ''; }
        if (r && r.status === 'running') running = 1;
      }
      broadcast(line('PB', (run.pbTitle && run.pbTitle.hu) || run.pb || '', done, total, running));
      if (lastText) broadcast(line('STEP', lastStatus, lastText));
    }
  }
  const prog = readJson(path.join(stateDir, 'progress.json'));
  if (prog && prog.running) broadcast(line('SETUP', prog.done || 0, prog.total || 0, (prog.current && prog.current.phase) || 'download'));
}
function jobMinutes(job) { try { return Math.max(0, Math.round((Date.now() - new Date(job.started)) / 60000)); } catch (e) { return 0; } }

// ---------------------------------------------------------------- deployer actions
function quote(p) { return '"' + String(p).replace(/"/g, '') + '"'; }
function runAction(actionId, arg, cmdId, client) {
  const argv = String(arg || '').split(';');
  const opts = {}; for (const a of argv) { const i = a.indexOf(':'); if (i > 0) opts[a.slice(0, i)] = a.slice(i + 1); }
  const confirm = opts.confirm === '1';
  const emit = (step, status, text) => broadcast(line('WIZ', actionId, step, status, text));
  const done = (ok, text) => client.send(line('ACK', cmdId || '', ok ? 1 : 0, text || ''));

  if (!KIT.present && actionId !== 'makeboot') { emit('', 'fail', 'Nincs ServiceKit pendrive.'); return done(false, 'no-kit'); }

  switch (actionId) {
    case 'verify': return actVerify(emit, done);
    case 'deploy': {
      if (!confirm) { emit('', 'warn', 'Megerősítés kell.'); return done(false, 'need-confirm'); }
      const dest = opts.dest || (IS_WIN ? 'C:\\ServiceKit' : path.join(os.tmpdir(), 'ServiceKit-deploy'));
      return actDeploy(dest, emit, done);
    }
    case 'launch': return actLaunch(opts.what || arg || 'dashboard', emit, done);
    case 'makeboot': return actOpen(findBootTool(), emit, done);
    case 'openkit': return actOpen(KIT.path, emit, done);
    case 'syncsd': emit('', 'warn', 'A CYD SD-t a firmware frissíti; a híd csak a kézi másoláshoz nyit mappát.'); return actOpen(path.join(KIT.path, 'launcher'), emit, done);
    default: emit('', 'fail', 'Ismeretlen művelet.'); return done(false, 'unknown');
  }
}

function manifestPath() { return path.join(__dirname, '..', 'sd-template', 'manifest.json'); }
function actVerify(emit, done) {
  emit('read', 'run', 'Manifest beolvasása…');
  const man = readJson(manifestPath());
  if (!man) { emit('read', 'fail', 'Nincs manifest.json.'); return done(false, 'no-manifest'); }
  let ok = 0, missing = 0, changed = 0;
  for (const item of man.files || []) {
    const full = path.join(KIT.path, item.path);
    if (ARGS.mockPc) { ok++; emit(item.path, 'ok', 'OK (mock)'); continue; }
    if (!fs.existsSync(full)) { missing++; emit(item.path, 'fail', 'hiányzik'); continue; }
    if (item.sha256) {
      try { const h = crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex'); if (h !== item.sha256) { changed++; emit(item.path, 'warn', 'megváltozott'); continue; } } catch (e) {}
    }
    ok++; emit(item.path, 'ok', 'OK');
  }
  const verdict = missing ? 'fail' : (changed ? 'warn' : 'ok');
  emit('', verdict, ok + ' OK · ' + missing + ' hiányzik · ' + changed + ' változott');
  done(missing === 0, verdict);
}

function actDeploy(dest, emit, done) {
  emit('prep', 'run', 'Másolás ide: ' + dest);
  try {
    if (ARGS.mockPc) { emit('copy', 'ok', 'Másolva (mock): ' + dest); emit('', 'ok', 'Kész.'); return done(true, dest); }
    copyTree(KIT.path, dest, emit);
    emit('', 'ok', 'Kész: ' + dest);
    done(true, dest);
  } catch (e) { emit('', 'fail', e.message); done(false, e.message); }
}
function copyTree(src, dest, emit) {
  fs.mkdirSync(dest, { recursive: true });
  let files = 0;
  const walk = (s, d) => {
    for (const n of fs.readdirSync(s)) {
      if (n === 'state' || n === 'logs') continue; // don't carry a machine's runtime state
      const ss = path.join(s, n), dd = path.join(d, n), st = fs.statSync(ss);
      if (st.isDirectory()) { fs.mkdirSync(dd, { recursive: true }); walk(ss, dd); }
      else { fs.copyFileSync(ss, dd); if (++files % 50 === 0) emit('copy', 'run', files + ' fájl…'); }
    }
  };
  walk(src, dest);
  emit('copy', 'ok', files + ' fájl másolva');
}

function findBootTool() {
  for (const sub of ['tools/rufus', 'tools/ventoy']) {
    const d = path.join(KIT.path, sub);
    if (fs.existsSync(d)) { const exe = fs.readdirSync(d).find((f) => /\.exe$/i.test(f)); if (exe) return path.join(d, exe); }
  }
  return KIT.path;
}
function actLaunch(what, emit, done) {
  const map = { dashboard: 'START.cmd', setup: 'SETUP.cmd', shell: 'KITSHELL.cmd' };
  const file = path.join(KIT.path, map[what] || 'START.cmd');
  if (!ARGS.mockPc && !fs.existsSync(file)) { emit('', 'fail', 'Nincs: ' + (map[what] || what)); return done(false, 'missing'); }
  emit('', 'ok', 'Indítva: ' + (map[what] || what));
  if (!ARGS.mockPc) spawnDetached(file);
  done(true, what);
}
function actOpen(target, emit, done) {
  if (!target) { emit('', 'fail', 'Nincs mit megnyitni.'); return done(false, 'none'); }
  emit('', 'ok', 'Megnyitva: ' + target);
  if (!ARGS.mockPc && IS_WIN) spawnDetached(target, true);
  done(true, target);
}
function spawnDetached(target, viaExplorer) {
  try {
    const cp = require('child_process');
    if (viaExplorer) cp.spawn('explorer.exe', [target], { detached: true, stdio: 'ignore' }).unref();
    else cp.spawn('cmd.exe', ['/c', 'start', '', target], { detached: true, stdio: 'ignore' }).unref();
  } catch (e) { log('spawn failed:', e.message); }
}

// ---------------------------------------------------------------- command router
function onCydLine(ln, client) {
  const parts = ln.split('|');
  const tag = parts[0];
  switch (tag) {
    case 'HI': log('CYD hello fw=' + parts[1] + ' sd=' + parts[2] + 'GB'); break;
    case 'PING': client.send(line('HB', 1)); break;
    case 'P': /* page context; nothing to tailor yet */ break;
    case 'DRIVES': sendDrives(client); break;
    case 'LS': {
      const p = parts[1] || '', cmdId = parts[2] || '';
      client.send(line('DBEG', p));
      const r = listDir(p ? toFsPath(p) : '');
      if (!p) { // roots
        const drives = ARGS.mockPc ? MOCK_FS.drives : listDrivesReal();
        for (const d of drives) client.send(line('D', d.id, 1, 0, ''));
        client.send(line('DEND', p, drives.length, 0));
      } else {
        for (const e of r.entries) client.send(line('D', e.name, e.isDir, e.sizeKB, e.mtime));
        client.send(line('DEND', p, r.entries.length, r.truncated ? 1 : 0));
      }
      if (cmdId) client.send(line('ACK', cmdId, r.error ? 0 : 1, r.error || ''));
      break;
    }
    case 'OPEN': { actOpen(toFsPath(parts[1] || ''), () => {}, (ok) => client.send(line('ACK', parts[2] || '', ok ? 1 : 0))); break; }
    case 'RUN': runAction(parts[1], parts[2], parts[3], client); break;
    default: log('unknown from CYD:', ln);
  }
}
function toFsPath(p) { return IS_WIN ? p.replace(/\//g, '\\') : p; }

// ---------------------------------------------------------------- --once test mode
if (ARGS.once) {
  ARGS.mockPc = true; detectKit();
  const outLines = [];
  const client = { name: 'test', send: (s) => outLines.push(s) };
  clients.add(client);
  onCydLine(ARGS.once, client);
  // give async nothing; everything here is sync
  process.stdout.write(outLines.join('\n') + (outLines.length ? '\n' : ''));
  process.exit(0);
}

// ---------------------------------------------------------------- start
detectKit();
log('kit ' + (KIT.present ? 'found ' + KIT.drive + ' v' + KIT.ver : 'not found') + (ARGS.mockPc ? ' [mock-pc]' : ''));
if (ARGS.sim) startWsServer(ARGS.wsport);
if (ARGS.port) startSerial(ARGS.port, ARGS.baud);
if (!ARGS.sim && !ARGS.port) { console.error('Nothing to do: pass --sim and/or --port. See --help.'); process.exit(1); }
setInterval(() => { broadcast(line('HB', 1)); sendKit(); pushState(); }, 1000);
