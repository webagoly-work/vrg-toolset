#!/usr/bin/env node
/* ServiceKit Phone — local HID bridge (ROOTED mode).
   Runs ON the phone (Termux + root). A loopback-only WebSocket server speaking the
   same line protocol the ServiceKit Phone app already uses — so in rooted mode the
   app's Vezérlés/Parancsok screens drive the USB HID keyboard through the very same
   UI, instead of talking to a PC bridge. Macros/commands become keystrokes typed
   into the PC via /dev/hidg0 (set up by skstick.sh `hid on`).

     su
     sh skstick.sh hid on            # or: both on
     node hid-bridge.js              # ws://127.0.0.1:47815  (loopback, no token)
   Then in the app pick "Rooted" mode and connect to 127.0.0.1:47815.

   UNTESTED ON HARDWARE for the actual typing (no rooted phone here); the protocol,
   framing and sequence-building are tested. Loopback only by design — never bind
   this off-localhost. */
'use strict';
const http = require('http'), crypto = require('crypto'), cp = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');

const A = { host: '127.0.0.1', port: 47815, dev: '/dev/hidg0', skhid: path.join(__dirname, 'skhid.py'), python: 'python3', once: null, mock: false };
for (let i = 2; i < process.argv.length; i++) {
  const k = process.argv[i];
  if (k === '--port') A.port = +process.argv[++i];
  else if (k === '--dev') A.dev = process.argv[++i];
  else if (k === '--python') A.python = process.argv[++i];
  else if (k === '--once') A.once = process.argv[++i];
  else if (k === '--mock') A.mock = true;
}
const VER = '1.0';
function log(...a) { if (!A.once) console.log('[sk-hid]', ...a); }

function loadMacros() { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'macros-hid.json'), 'utf8')).macros || []; } catch (e) { return []; } }
function san(s) { return String(s == null ? '' : s).replace(/[|\n\r]/g, (m) => (m === '|' ? '/' : ' ')); }
function L(tag, ...f) { return tag + (f.length ? '|' + f.map(san).join('|') : ''); }

// run skhid.py; cb(ok, message)
function runHid(args, cb) {
  if (A.mock) { log('MOCK skhid', args.join(' ')); return cb(true, 'mock'); }
  const full = [A.skhid, ...args, '--dev', A.dev];
  cp.execFile(A.python, full, { timeout: 30000 }, (err, so, se) => {
    if (err) cb(false, (se || err.message || 'hiba').toString().slice(0, 200));
    else cb(true, 'ok');
  });
}
function macroById(id) { return loadMacros().find((m) => m.id === id); }
function typeCommand(command, kind, cb) {
  const prefix = kind === 'ps' ? 'powershell -NoExit -Command ' : 'cmd /k ';
  const steps = [{ key: 'GUI+r' }, { delay: 450 }, { text: prefix + command }, { key: 'ENTER' }];
  const tmp = path.join(os.tmpdir(), 'skhid-seq-' + Date.now() + '.json');
  try { fs.writeFileSync(tmp, JSON.stringify(steps)); } catch (e) { return cb(false, 'tmp write failed'); }
  runHid(['seq', tmp], (ok, msg) => { try { fs.unlinkSync(tmp); } catch (e) {} cb(ok, msg); });
}

// parse "b64:<...>;kind:<cmd|ps>;confirm:1"
function parseRunArg(arg) {
  const o = {}; String(arg || '').split(';').forEach((kv) => { const i = kv.indexOf(':'); if (i > 0) o[kv.slice(0, i)] = kv.slice(i + 1); });
  let cmd = ''; try { cmd = Buffer.from(o.b64 || '', 'base64').toString('utf8'); } catch (e) {}
  return { cmd, kind: o.kind === 'ps' ? 'ps' : 'cmd' };
}

const clients = new Set();
function onLine(ln, c) {
  const p = ln.split('|'), tag = p[0];
  if (tag === 'PING') { c.send(L('HB', 1)); return; }
  if (tag === 'AUTH') { c.send(L('AUTHOK')); hello(c); return; }   // loopback: always OK
  if (tag === 'MACROS') { for (const m of loadMacros()) c.send(L('MAC', m.id, m.hu || m.id, m.danger ? 1 : 0, m.cat || '')); c.send(L('MACEND')); return; }
  if (tag === 'MACRO') {
    const m = macroById(p[1]); const cmdId = p[3] || '';
    if (!m) { c.send(L('WIZ', 'hid', '', 'fail', 'nincs ilyen makro')); return c.send(L('ACK', cmdId, 0, 'no-macro')); }
    c.send(L('WIZ', 'hid', '', 'info', 'Gepeles: ' + (m.hu || m.id)));
    runHid(['macro', m.id], (ok, msg) => { c.send(L('WIZ', 'hid', '', ok ? 'ok' : 'fail', ok ? 'Kesz' : msg)); c.send(L('ACK', cmdId, ok ? 1 : 0, msg)); });
    return;
  }
  if (tag === 'RUN') {
    const action = p[1], cmdId = p[3] || '';
    if (action === 'run') { const { cmd, kind } = parseRunArg(p[2]); if (!cmd) return c.send(L('ACK', cmdId, 0, 'empty'));
      c.send(L('WIZ', 'hid', '', 'info', 'Gepeles a gepbe...')); typeCommand(cmd, kind, (ok, msg) => c.send(L('ACK', cmdId, ok ? 1 : 0, msg))); return; }
    if (action === 'launch') { runHid(['macro', 'launch-kit'], (ok, msg) => c.send(L('ACK', cmdId, ok ? 1 : 0, msg))); return; }
    if (action === 'openkit') { runHid(['macro', 'open-kit-dir'], (ok, msg) => c.send(L('ACK', cmdId, ok ? 1 : 0, msg))); return; }
    c.send(L('ACK', cmdId, 0, 'n/a-in-hid'));
    return;
  }
  // DRIVES/LS/OPEN/PUSH* are not applicable to the HID bridge (the stick is the drive)
  if (tag === 'PUSHB' || tag === 'PUSHE') { c.send(L('ACK', p[p.length - 1] || '', 0, 'use-skstick')); return; }
}

function hello(c) {
  const hidReady = A.mock || fs.existsSync(A.dev);
  c.send(L('KIT', 0, '', ''));                       // stick handled by skstick, not here
  c.send(L('CAPS', 1, 'hid'));                        // run-on-PC = typing; always "on"
  if (!hidReady) c.send(L('WIZ', 'hid', '', 'warn', 'Nincs ' + A.dev + ' — eloszor: sh skstick.sh hid on'));
}

function startWs() {
  const server = http.createServer((req, res) => { res.writeHead(426); res.end('WebSocket only'); });
  server.on('upgrade', (req, sock) => {
    // refuse anything but loopback
    const ra = sock.remoteAddress || '';
    if (!(ra === '127.0.0.1' || ra === '::1' || ra === '::ffff:127.0.0.1')) { sock.destroy(); return; }
    const key = req.headers['sec-websocket-key']; if (!key) { sock.destroy(); return; }
    const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
    sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
    const c = { send(str) { const pb = Buffer.from(str + '\n', 'utf8'), n = pb.length; let h;
      if (n < 126) h = Buffer.from([0x81, n]); else if (n < 65536) h = Buffer.from([0x81, 126, (n >> 8) & 255, n & 255]); else { h = Buffer.alloc(10); h[0] = 0x81; h[1] = 127; h.writeUInt32BE(n, 6); }
      try { sock.write(Buffer.concat([h, pb])); } catch (e) {} } };
    let buf = Buffer.alloc(0), rx = '';
    sock.on('data', (d) => { buf = Buffer.concat([buf, d]);
      while (buf.length >= 2) {
        const op = buf[0] & 0x0f, masked = buf[1] & 0x80; let len = buf[1] & 0x7f, off = 2;
        if (len === 126) { if (buf.length < 4) break; len = buf.readUInt16BE(2); off = 4; } else if (len === 127) { if (buf.length < 10) break; len = Number(buf.readBigUInt64BE(2)); off = 10; }
        const need = off + (masked ? 4 : 0) + len; if (buf.length < need) break;
        let pl; if (masked) { const m = buf.slice(off, off + 4); pl = buf.slice(off + 4, off + 4 + len); for (let i = 0; i < pl.length; i++) pl[i] ^= m[i & 3]; } else pl = buf.slice(off, off + len);
        buf = buf.slice(need);
        if (op === 0x8) { sock.end(); return; }
        if (op === 0x1 || op === 0x0) { rx += pl.toString('utf8'); let nl; while ((nl = rx.indexOf('\n')) >= 0) { const ln = rx.slice(0, nl).replace(/\r$/, ''); rx = rx.slice(nl + 1); if (ln) onLine(ln, c); } }
      } });
    sock.on('close', () => { clients.delete(c); log('app disconnected'); });
    sock.on('error', () => {});
    clients.add(c);
    log('app connected');
    c.send(L('HELLO', 'ServiceKit-HID', VER, 'open'));
    hello(c);
  });
  server.listen(A.port, A.host, () => { log('HID bridge on ws://' + A.host + ':' + A.port + '/  (dev ' + A.dev + (A.mock ? ', MOCK' : '') + ')'); });
  const hb = setInterval(() => { for (const c of clients) c.send(L('HB', 1)); }, 15000);
  hb.unref && hb.unref();
  return server;
}

startWs();
