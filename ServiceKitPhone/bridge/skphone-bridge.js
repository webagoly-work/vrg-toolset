#!/usr/bin/env node
/*
  ServiceKit Phone bridge — the PC-side half for the phone app (and the CYD).

  The phone app connects over a WebSocket and speaks the same short TAG|a|b lines
  as the CYD (bridge/protocol.md), plus the phone extensions below. It reaches the
  PC over the USB cable one of two no-root ways:

    A) adb reverse  (USB debugging on):  on the PC run
         adb reverse tcp:47814 tcp:47814
       then the phone connects to ws://127.0.0.1:47814 — tunnelled down the cable
       to this bridge. No token needed (loopback only). `skphone-connect.cmd` does this.

    B) USB tethering / Wi-Fi:  this bridge binds to the LAN; the phone connects to
         ws://<PC-IP>:47814  and sends AUTH|<token>. Start with --host 0.0.0.0 --token.

  Run:
    node skphone-bridge.js                      adb-reverse mode (127.0.0.1, no token)
    node skphone-bridge.js --host 0.0.0.0 --token 123456    Wi-Fi/tethering, paired
    node skphone-bridge.js --allow-run          enable run-on-PC (macros / command DB)
    node skphone-bridge.js --kit "E:\\ServiceKit"
    node skphone-bridge.js --once "MACROS"      feed one line, print replies, exit (tests)

  SAFETY: run-on-PC is OFF unless --allow-run. Even on, it runs only on an
  authenticated socket, on the user's own PC, openly triggered from their phone —
  curated macros, or (if the app's command page is used) a command the user picked.
  No client data is ever read or sent; the status mirror blanks client names.
*/
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const http = require('http');
const cp = require('child_process');

const VER = '0.1.0';
const CHARSET_EXTRA = 'áéíóöőúüűÁÉÍÓÖŐÚÜŰ°–…·×';
const FOLD = { 'â':'a','ä':'a','à':'a','ã':'a','ê':'e','ë':'e','è':'e','î':'i','ï':'i','ì':'i','ô':'o','õ':'o','ò':'o','û':'u','ù':'u','ñ':'n','ç':'c','ß':'ss','’':"'",'—':'–','\t':' ' };
const IS_WIN = process.platform === 'win32';

// ---------------------------------------------------------------- args
const A = { baud: 115200, host: '127.0.0.1', wsport: 47814, allowRun: false, mockPc: false };
for (let i = 2; i < process.argv.length; i++) {
  const k = process.argv[i];
  if (k === '--host') A.host = process.argv[++i];
  else if (k === '--wsport') A.wsport = +process.argv[++i];
  else if (k === '--token') A.token = process.argv[++i];
  else if (k === '--kit') A.kit = process.argv[++i];
  else if (k === '--allow-run') A.allowRun = true;
  else if (k === '--mock-pc') A.mockPc = true;
  else if (k === '--once') A.once = process.argv[++i];
  else if (k === '--help' || k === '-h') A.help = true;
}
if (A.help) { console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace('/*', '').trim()); process.exit(0); }
if (!IS_WIN && !A.kit) A.mockPc = A.mockPc || true;      // off-Windows => mock PC for testing
// If binding non-loopback and no token given, mint one so it's never open.
const loopback = A.host === '127.0.0.1' || A.host === '::1' || A.host === 'localhost';
if (!loopback && !A.token && !A.once) { A.token = ('' + crypto.randomInt(0, 1000000)).padStart(6, '0'); }
const REQUIRE_AUTH = !!A.token;

// ---------------------------------------------------------------- charset / lines
function san(s, maxBytes) {
  if (s === undefined || s === null) return '';
  s = String(s).replace(/[|\n\r]/g, (m) => (m === '|' ? '/' : ' '));
  let out = '';
  for (const ch of s) { if (ch >= ' ' && ch.charCodeAt(0) < 127) out += ch; else if (CHARSET_EXTRA.indexOf(ch) >= 0) out += ch; else if (FOLD[ch] !== undefined) out += FOLD[ch]; }
  if (maxBytes) { const b = Buffer.from(out, 'utf8'); if (b.length > maxBytes) { let n = maxBytes; while (n > 0 && (b[n] & 0xc0) === 0x80) n--; out = b.slice(0, n).toString('utf8'); } }
  return out;
}
function L(tag, ...f) { return tag + (f.length ? '|' + f.map((x) => san(x, 900)).join('|') : ''); }
function log(...a) { if (!A.once) console.log('[skphone]', ...a); }

// ---------------------------------------------------------------- clients
const clients = new Set();
function broadcast(s) { for (const c of clients) if (c.authed) { try { c.send(s); } catch (e) {} } }

// ---------------------------------------------------------------- minimal WebSocket server
function startWs(host, port) {
  const server = http.createServer((req, res) => { res.writeHead(426); res.end('WebSocket only'); });
  server.on('upgrade', (req, sock) => {
    const key = req.headers['sec-websocket-key']; if (!key) { sock.destroy(); return; }
    const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
    sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
    const client = {
      authed: !REQUIRE_AUTH, up: { sz: 0, got: 0, chunks: [] },
      send(str) { const p = Buffer.from(str + '\n', 'utf8'), n = p.length; let h;
        if (n < 126) h = Buffer.from([0x81, n]); else if (n < 65536) h = Buffer.from([0x81, 126, (n >> 8) & 255, n & 255]); else { h = Buffer.alloc(10); h[0] = 0x81; h[1] = 127; h.writeUInt32BE(n, 6); }
        sock.write(Buffer.concat([h, p])); }
    };
    let buf = Buffer.alloc(0), rx = '';
    sock.on('data', (d) => { buf = Buffer.concat([buf, d]);
      while (buf.length >= 2) {
        const op = buf[0] & 0x0f, masked = buf[1] & 0x80; let len = buf[1] & 0x7f, off = 2;
        if (len === 126) { if (buf.length < 4) break; len = buf.readUInt16BE(2); off = 4; } else if (len === 127) { if (buf.length < 10) break; len = Number(buf.readBigUInt64BE(2)); off = 10; }
        const need = off + (masked ? 4 : 0) + len; if (buf.length < need) break;
        let pl; if (masked) { const m = buf.slice(off, off + 4); pl = buf.slice(off + 4, off + 4 + len); for (let i = 0; i < pl.length; i++) pl[i] ^= m[i & 3]; } else pl = buf.slice(off, off + len);
        buf = buf.slice(need);
        if (op === 0x8) { sock.end(); return; }
        if (op === 0x1 || op === 0x0) { rx += pl.toString('utf8'); let nl; while ((nl = rx.indexOf('\n')) >= 0) { const ln = rx.slice(0, nl).replace(/\r$/, ''); rx = rx.slice(nl + 1); if (ln) onLine(ln, client); } }
      } });
    sock.on('close', () => { clients.delete(client); log('client gone'); });
    sock.on('error', () => {});
    clients.add(client);
    log('client connected' + (REQUIRE_AUTH ? ' (awaiting AUTH)' : ''));
    client.send(L('HELLO', PC_NAME, VER, REQUIRE_AUTH ? 'auth' : 'open'));
    if (client.authed) hello(client);
  });
  server.listen(port, host, () => {
    log('phone WebSocket on ws://' + host + ':' + port + '/');
    if (REQUIRE_AUTH) log('PAIRING TOKEN: ' + A.token + '  (enter it in the phone app)');
    if (A.allowRun) log('run-on-PC ENABLED'); else log('run-on-PC disabled (pass --allow-run to enable macros/commands)');
  });
  return server;
}
function hello(c) { c.send(L('KIT', KIT.present ? 1 : 0, KIT.drive, KIT.ver)); c.send(L('CAPS', A.allowRun ? 1 : 0, IS_WIN ? 'win' : 'other')); sendState(c); }

// ---------------------------------------------------------------- PC facts
const PC_NAME = os.hostname();
let KIT = { present: false, drive: '', path: '', ver: '' };
function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; } }
function detectKit() {
  if (A.mockPc) { KIT = { present: true, drive: 'E:', path: '(mock)', ver: '1.2.0' }; return; }
  if (A.kit) KIT.path = A.kit;
  else if (IS_WIN) { for (let c = 68; c <= 90; c++) { const p = String.fromCharCode(c) + ':\\ServiceKit'; if (fs.existsSync(path.join(p, 'core', 'catalog.json'))) { KIT.path = p; break; } } }
  if (KIT.path) { KIT.present = fs.existsSync(path.join(KIT.path, 'core', 'catalog.json')); KIT.drive = KIT.path.slice(0, 2); try { KIT.ver = readJson(path.join(KIT.path, 'core', 'catalog.json')).version || ''; } catch (e) {} }
}
function sendState(c) {
  if (!KIT.present || A.mockPc) return;
  const sd = path.join(KIT.path, 'state');
  const aj = readJson(path.join(sd, 'active-job.json'));
  if (aj && aj.id) { const job = readJson(path.join(KIT.path, 'data', 'jobs', aj.id + '.json')); if (job) c.send(L('JOB', job.optIn ? (job.client && job.client.name) : '—', job.computer || '', job.status || '', jobMin(job))); }
  const pb = readJson(path.join(sd, 'playbook-active.json'));
  if (pb && pb.id) { const run = readJson(path.join(sd, 'playbooks', pb.id, 'run.json')); if (run) { let done = 0, total = 0, running = 0, ls = '', lt = '';
    for (let i = 0; i < (run.steps || []).length; i++) { const r = readJson(path.join(sd, 'playbooks', pb.id, i + '.json')); if (run.steps[i].include !== false) total++; if (r && r.status && r.status !== 'running' && r.status !== 'pending') { done++; ls = r.status; lt = (r.summary && r.summary.hu) || ''; } if (r && r.status === 'running') running = 1; }
    c.send(L('PB', (run.pbTitle && run.pbTitle.hu) || run.pb || '', done, total, running)); if (lt) c.send(L('STEP', ls, lt)); } }
}
function jobMin(j) { try { return Math.max(0, Math.round((Date.now() - new Date(j.started)) / 60000)); } catch (e) { return 0; } }

// ---------------------------------------------------------------- macros (curated quick actions)
function macrosFile() { return path.join(__dirname, 'macros.json'); }
function loadMacros() { return readJson(macrosFile()) || { macros: [] }; }

// ---------------------------------------------------------------- actions
function qot(p) { return '"' + String(p).replace(/"/g, '') + '"'; }
function spawnDetached(target, viaExplorer) { try { if (viaExplorer) cp.spawn('explorer.exe', [target], { detached: true, stdio: 'ignore' }).unref(); else cp.spawn('cmd.exe', ['/c', 'start', '', target], { detached: true, stdio: 'ignore' }).unref(); } catch (e) { log('spawn', e.message); } }

function runOnPc(command, kind, cb) {
  // kind: 'cmd' (cmd.exe /c) or 'ps' (powershell). Returns {code, out}.
  if (!A.allowRun) return cb({ code: -9, out: 'run-on-PC disabled' });
  if (A.mockPc || !IS_WIN) return cb({ code: 0, out: '(mock) ' + command });
  const file = kind === 'ps' ? 'powershell.exe' : 'cmd.exe';
  const args = kind === 'ps' ? ['-NoProfile', '-Command', command] : ['/c', command];
  let out = ''; const pr = cp.spawn(file, args, { windowsHide: true });
  pr.stdout.on('data', (d) => { if (out.length < 4000) out += d; }); pr.stderr.on('data', (d) => { if (out.length < 4000) out += d; });
  const to = setTimeout(() => { try { pr.kill(); } catch (e) {} }, 120000);
  pr.on('close', (code) => { clearTimeout(to); cb({ code, out: out.slice(0, 4000) }); });
  pr.on('error', (e) => { clearTimeout(to); cb({ code: -1, out: e.message }); });
}

function extractZip(zip, dest, cb) {
  fs.mkdirSync(dest, { recursive: true });
  const tries = IS_WIN
    ? [['tar', ['-xf', zip, '-C', dest]], ['powershell', ['-NoProfile', '-Command', 'Expand-Archive -Force -LiteralPath ' + qot(zip) + ' -DestinationPath ' + qot(dest)]]]
    : [['unzip', ['-o', zip, '-d', dest]], ['tar', ['-xf', zip, '-C', dest]]];
  let i = 0;
  const next = () => { if (i >= tries.length) return cb(false, 'no extractor'); const [c, a] = tries[i++]; const pr = cp.spawn(c, a, { stdio: 'ignore' }); pr.on('close', (code) => code === 0 ? cb(true) : next()); pr.on('error', next); };
  next();
}

function doAction(actionId, arg, cmdId, c) {
  const opts = {}; for (const p of String(arg || '').split(';')) { const i = p.indexOf(':'); if (i > 0) opts[p.slice(0, i)] = p.slice(i + 1); }
  const confirm = opts.confirm === '1';
  const emit = (step, status, text) => broadcast(L('WIZ', actionId, step, status, text));
  const ack = (ok, t) => c.send(L('ACK', cmdId || '', ok ? 1 : 0, t || ''));
  switch (actionId) {
    case 'launch': { const map = { dashboard: 'START.cmd', setup: 'SETUP.cmd', shell: 'KITSHELL.cmd' }; const f = KIT.present ? path.join(KIT.path, map[opts.what || arg] || 'START.cmd') : ''; if (!KIT.present) { emit('', 'fail', 'Nincs telepitett kit a gepen.'); return ack(false, 'no-kit'); } emit('', 'ok', 'Inditva: ' + (map[opts.what || arg] || arg)); if (!A.mockPc) spawnDetached(f); return ack(true); }
    case 'verify': return actVerify(emit, ack);
    case 'openkit': { if (!KIT.present) return ack(false, 'no-kit'); emit('', 'ok', 'Megnyitva'); if (!A.mockPc && IS_WIN) spawnDetached(KIT.path, true); return ack(true); }
    case 'run': {
      if (!A.allowRun) { emit('', 'fail', 'A futtatas a hidon ki van kapcsolva (--allow-run).'); return ack(false, 'run-disabled'); }
      if (!confirm) { emit('', 'warn', 'Megerositest ker.'); return ack(false, 'need-confirm'); }
      let command = ''; try { command = Buffer.from(opts.b64 || '', 'base64').toString('utf8'); } catch (e) {}
      if (!command) return ack(false, 'empty');
      emit('run', 'run', command.slice(0, 60));
      runOnPc(command, opts.kind === 'ps' ? 'ps' : 'cmd', (r) => { const tail = (r.out || '').split(/\r?\n/).filter(Boolean).slice(-3).join(' · '); emit('', r.code === 0 ? 'ok' : 'warn', 'kod ' + r.code + (tail ? ' · ' + tail : '')); ack(r.code === 0, tail); });
      return;
    }
    case 'macro': { const m = (loadMacros().macros || []).find((x) => x.id === opts.id || x.id === arg); if (!m) { emit('', 'fail', 'Ismeretlen makro.'); return ack(false, 'unknown'); }
      if (m.danger && !confirm) { emit('', 'warn', 'Megerositest ker.'); return ack(false, 'need-confirm'); }
      if (!A.allowRun) { emit('', 'fail', 'A makrokhoz --allow-run kell.'); return ack(false, 'run-disabled'); }
      emit('run', 'run', (m.hu || m.label || m.id)); runOnPc(m.cmd, m.kind === 'ps' ? 'ps' : 'cmd', (r) => { emit('', r.code === 0 ? 'ok' : 'warn', (m.hu || m.id) + ' · kod ' + r.code); ack(r.code === 0, '' + r.code); }); return; }
    case 'deploy': { if (!confirm) { emit('', 'warn', 'Megerositest ker.'); return ack(false, 'need-confirm'); } emit('', 'warn', 'A telepites a telefonrol feltoltott kitbol megy (PUSHB).'); return ack(false, 'use-push'); }
    default: emit('', 'fail', 'Ismeretlen muvelet.'); return ack(false, 'unknown');
  }
}
function actVerify(emit, ack) {
  emit('read', 'run', 'Manifest...'); const man = readJson(path.join(__dirname, '..', 'www', 'kit', 'manifest.json')) || readJson(path.join(__dirname, 'manifest.json'));
  if (!KIT.present) { emit('', 'fail', 'Nincs telepitett kit.'); return ack(false, 'no-kit'); }
  if (!man) { emit('', 'warn', 'Nincs manifest; csak a fo fajlokat nezem.'); }
  const files = (man && man.files) || [{ path: 'core/catalog.json' }, { path: 'START.cmd' }, { path: 'launcher/index.html' }];
  let ok = 0, miss = 0; for (const it of files) { const full = path.join(KIT.path, it.path); if (A.mockPc || fs.existsSync(full)) { ok++; } else { miss++; emit(it.path, 'fail', 'hianyzik'); } }
  emit('', miss ? 'fail' : 'ok', ok + ' OK · ' + miss + ' hianyzik'); ack(miss === 0);
}

// ---------------------------------------------------------------- kit push (phone -> PC)
function pushEnd(c, deploy, cmdId) {
  const up = c.up; const emit = (s, st, t) => c.send(L('WIZ', 'push', s, st, t));
  if (!up.chunks.length) { emit('', 'fail', 'Ures feltoltes.'); return c.send(L('ACK', cmdId, 0)); }
  const zipBuf = Buffer.concat(up.chunks); up.chunks = []; up.got = 0; up.sz = 0;
  const tmp = path.join(os.tmpdir(), 'servicekit-push-' + Date.now() + '.zip');
  try { fs.writeFileSync(tmp, zipBuf); } catch (e) { emit('', 'fail', e.message); return c.send(L('ACK', cmdId, 0)); }
  emit('save', 'ok', (zipBuf.length / 1024 | 0) + ' KB fogadva');
  if (!deploy) { c.send(L('ACK', cmdId, 1, tmp)); return; }
  const dest = IS_WIN ? 'C:\\ServiceKit' : path.join(os.tmpdir(), 'ServiceKit-deploy');
  emit('extract', 'run', 'Kicsomagolas: ' + dest);
  extractZip(tmp, path.dirname(dest), (ok, err) => {
    try { fs.unlinkSync(tmp); } catch (e) {}
    if (!ok) { emit('', 'fail', 'Kicsomagolas nem sikerult: ' + (err || '')); return c.send(L('ACK', cmdId, 0)); }
    detectKit();
    emit('', 'ok', 'Telepitve: ' + dest); c.send(L('KIT', KIT.present ? 1 : 0, KIT.drive, KIT.ver)); c.send(L('ACK', cmdId, 1, dest));
  });
}

// ---------------------------------------------------------------- directory listing (PC explorer, optional)
function listDir(p) {
  if (A.mockPc) { const t = { '': [['C:', 1], ['E:', 1]], 'C:/': [['Users', 1], ['Windows', 1]], 'E:/': [['ServiceKit', 1], ['README.md', 0]] }; return (t[p] || []).map(([n, d]) => ({ name: n, isDir: d, sizeKB: d ? 0 : 9 })); }
  try { return fs.readdirSync(p).slice(0, 300).map((n) => { let st; try { st = fs.statSync(path.join(p, n)); } catch (e) { return null; } return st ? { name: n, isDir: st.isDirectory() ? 1 : 0, sizeKB: st.isDirectory() ? 0 : Math.round(st.size / 1024) } : null; }).filter(Boolean); } catch (e) { return []; }
}

// ---------------------------------------------------------------- line router
function onLine(ln, c) {
  const p = ln.split('|'); const tag = p[0];
  if (!c.authed) {
    if (tag === 'AUTH') { if (p[1] === A.token) { c.authed = true; c.send(L('AUTHOK')); hello(c); log('client authed'); } else { c.send(L('AUTHFAIL')); } return; }
    c.send(L('AUTHFAIL')); return;   // nothing else before auth
  }
  switch (tag) {
    case 'AUTH': c.send(L('AUTHOK')); break;
    case 'PING': c.send(L('HB', 1)); break;
    case 'P': break;
    case 'CAPS?': c.send(L('CAPS', A.allowRun ? 1 : 0, IS_WIN ? 'win' : 'other')); break;
    case 'MACROS': { for (const m of (loadMacros().macros || [])) c.send(L('MAC', m.id, m.hu || m.label || m.id, m.danger ? 1 : 0, m.cat || '')); c.send(L('MACEND')); break; }
    case 'MACRO': doAction('macro', 'id:' + (p[1] || '') + (p[2] === '1' ? ';confirm:1' : ''), p[3] || '', c); break;
    case 'RUN': doAction(p[1], p[2], p[3], c); break;
    case 'DRIVES': { for (const d of listDir('')) c.send(L('DRV', d.name, '', 0, 0, 'fixed')); c.send(L('DEND', '', 0, 0)); break; }
    case 'LS': { const pa = p[1] || ''; c.send(L('DBEG', pa)); const es = listDir(IS_WIN ? pa.replace(/\//g, '\\') : pa); for (const e of es) c.send(L('D', e.name, e.isDir, e.sizeKB, '')); c.send(L('DEND', pa, es.length, 0)); break; }
    case 'OPEN': { if (A.allowRun && IS_WIN && !A.mockPc) spawnDetached((p[1] || '').replace(/\//g, '\\'), true); c.send(L('ACK', p[2] || '', 1)); break; }
    case 'PUSHB': { c.up = { sz: +p[1] || 0, got: 0, chunks: [], cmdId: p[2] || '' }; c.send(L('WIZ', 'push', 'begin', 'run', 'Feltoltes...')); break; }
    case 'PUSHC': { try { const b = Buffer.from(p[1] || '', 'base64'); c.up.chunks.push(b); c.up.got += b.length; if (c.up.sz) c.send(L('PUSHP', Math.min(100, Math.round(100 * c.up.got / c.up.sz)))); } catch (e) {} break; }
    case 'PUSHE': pushEnd(c, p[1] === '1', c.up.cmdId || ''); break;
    default: log('? ' + ln);
  }
}

// ---------------------------------------------------------------- --once test
if (A.once) {
  A.mockPc = true; A.allowRun = true; detectKit();
  const out = []; const c = { authed: true, up: {}, send: (s) => out.push(s) }; clients.add(c);
  onLine(A.once, c);
  setTimeout(() => { process.stdout.write(out.join('\n') + (out.length ? '\n' : '')); process.exit(0); }, 150);
} else {
  detectKit();
  log('kit ' + (KIT.present ? 'found ' + KIT.drive + ' v' + KIT.ver : 'not found') + (A.mockPc ? ' [mock-pc]' : ''));
  startWs(A.host, A.wsport);
  setInterval(() => { broadcast(L('HB', 1)); for (const c of clients) if (c.authed) { c.send(L('KIT', KIT.present ? 1 : 0, KIT.drive, KIT.ver)); sendState(c); } }, 1000);
}
