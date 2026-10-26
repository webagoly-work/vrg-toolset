'use strict';

// The embedded terminal end to end (CITY-D15 C): a real companion (not a dry run) opens cmd.exe under
// ConPTY in CodeCity/, the stream carries its output over SSE with the page's cookie, typed input comes
// back, and close ends it. Run by CodeCity/tools/selftest.js through run-spec.js; skipped (one ok line
// saying so) when Vendor/node-pty is missing.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const CITY = path.resolve(__dirname, '..');
const REPO = path.resolve(CITY, '..');
const HAS_PTY = fs.existsSync(path.join(REPO, 'Vendor', 'node-pty', 'lib', 'index.js'));

let srv = null;
async function start() {
  if (srv) return srv;
  const cfg = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'kv-term-')), 'none.json');
  const env = Object.assign({}, process.env); delete env.KP_DRY_RUN;
  const child = spawn(process.execPath, [path.join(CITY, 'companion.js'), '--port', '0', '--no-open', '--config', cfg], { env });
  const port = await new Promise((resolve, reject) => {
    let out = '';
    child.stdout.on('data', d => { out += d; const m = out.match(/port (\d+)/); if (m) resolve(+m[1]); });
    child.on('exit', c => reject(new Error('server exited ' + c)));
    setTimeout(() => reject(new Error('server did not start')), 5000);
  });
  srv = { child, port, token: fs.readFileSync(path.join(CITY, '.companion-token'), 'utf8').trim() };
  process.on('exit', () => child.kill());
  return srv;
}
function req(method, p, { body, token, cookie, origin } = {}) {
  return new Promise((resolve, reject) => {
    const data = body !== undefined ? JSON.stringify(body) : null;
    const headers = { Host: '127.0.0.1:' + srv.port };
    if (data) headers['Content-Type'] = 'application/json';
    if (token) headers['X-Kodvaros-Token'] = token;
    if (cookie) headers.Cookie = cookie;
    if (origin) headers.Origin = origin;
    const r = http.request({ host: '127.0.0.1', port: srv.port, method, path: p, headers }, res => {
      let s = '';
      res.on('data', d => { s += d; });
      res.on('end', () => { let j = null; try { j = JSON.parse(s); } catch (e) { /* html */ } resolve({ status: res.statusCode, json: j, text: s, headers: res.headers }); });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}
const post = (a, body) => req('POST', '/api/' + a, { body, token: srv.token });

// read the SSE stream until `want` shows up in the decoded output (or time runs out)
function readStream(id, cookie, want, send) {
  return new Promise((resolve, reject) => {
    let raw = '', out = '';
    const r = http.request({ host: '127.0.0.1', port: srv.port, path: '/api/term-stream?id=' + id, headers: { Host: '127.0.0.1:' + srv.port, Cookie: cookie } }, res => {
      if (res.statusCode !== 200) { res.resume(); return resolve({ status: res.statusCode, out }); }
      send();
      res.on('data', d => {
        raw += d;
        let k;
        while ((k = raw.indexOf('\n\n')) >= 0) {
          const ev = raw.slice(0, k); raw = raw.slice(k + 2);
          const line = ev.split('\n').find(l => l.startsWith('data: '));
          if (line) try { out += JSON.parse(line.slice(6)); } catch (e) { /* retry: line */ }
        }
        if (out.includes(want)) { r.destroy(); resolve({ status: 200, out }); }
      });
    });
    r.on('error', e => (e.code === 'ECONNRESET' ? resolve({ status: 200, out }) : reject(e)));
    r.end();
    setTimeout(() => { r.destroy(); resolve({ status: 200, out, timeout: true }); }, 15000);
  });
}

module.exports = !HAS_PTY ? [{ name: 'terminal: skipped — Vendor/node-pty missing (node tools/fetch-vendor.js node-pty xterm xterm-fit)', async fn() {} }] : [
  { name: 'terminal: status says on; /vendor/xterm.js and xterm.css are served, anything else under /vendor/ is 404', async fn() {
    await start();
    assert.strictEqual((await req('GET', '/api/status')).json.terminal, true);
    assert.strictEqual((await req('GET', '/vendor/xterm.js')).status, 200);
    assert.strictEqual((await req('GET', '/vendor/xterm.css')).status, 200);
    assert.strictEqual((await req('GET', '/vendor/node-pty/lib/index.js')).status, 404);
    assert.strictEqual((await req('GET', '/vendor/..%2Fvendor-manifest.json')).status, 404);
  } },
  { name: 'terminal: open needs the token, a folder inside the roots and kind shell|claude', async fn() {
    await start();
    assert.strictEqual((await req('POST', '/api/term-open', { body: { dir: 'CodeCity', kind: 'shell' } })).status, 401);
    assert.strictEqual((await post('term-open', { dir: 'C:\\Windows', kind: 'shell' })).status, 403);
    assert.strictEqual((await post('term-open', { dir: 'CodeCity', kind: 'powershell' })).status, 400);
    assert.strictEqual((await post('term-open', { dir: 'CodeCity', kind: 'shell', exe: 'calc.exe' })).status, 400);
  } },
  { name: 'terminal: the stream needs the page cookie; typed input comes back over SSE; close ends it', async fn() {
    await start();
    const page = await req('GET', '/');
    const cookie = String((page.headers['set-cookie'] || [''])[0]).split(';')[0];
    assert.ok(/^kv_t=[0-9a-f]+$/.test(cookie), 'cookie set with the page');
    const o = await post('term-open', { dir: 'CodeCity', kind: 'shell' });
    assert.strictEqual(o.status, 200, JSON.stringify(o.json));
    assert.strictEqual((await readStream(o.json.id, 'kv_t=' + 'x'.repeat(48), 'never', () => {})).status, 401);
    const r = await readStream(o.json.id, cookie, 'KV-TERM-OK', () => post('term-input', { id: o.json.id, data: 'echo KV-TERM-' + 'OK\r' }));
    assert.ok(r.out.includes('KV-TERM-OK') && !r.timeout, 'echo came back: ' + JSON.stringify(r.out.slice(-200)));
    assert.ok(/codecity>/i.test(r.out), 'the prompt is in CodeCity');
    assert.strictEqual((await post('term-resize', { id: o.json.id, cols: 120, rows: 40 })).status, 200);
    assert.strictEqual((await post('term-close', { id: o.json.id })).status, 200);
    await new Promise(res => setTimeout(res, 800));
    assert.strictEqual((await post('term-input', { id: o.json.id, data: 'x' })).status, 404);
    srv.child.kill();
  } }
];
