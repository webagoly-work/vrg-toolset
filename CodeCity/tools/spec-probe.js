'use strict';

// Probe sidecar (P10, KV-21) on a throwaway repo with a fake vrg-probe (a Node script speaking the same JSON lines):
// Paint opening must reach GET /api/stream as an 'apps' entry in front, its closing must take it away, a crashed probe
// must be started again, and a window title must never travel.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn, execFileSync } = require('child_process');

const CITY = path.resolve(__dirname, '..');
const fx = fs.mkdtempSync(path.join(os.tmpdir(), 'kv-probe-'));
const put = (p, s) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };
const FAKE = `
const fs = require('fs'), runs = process.argv[2], n = (fs.existsSync(runs) ? +fs.readFileSync(runs, 'utf8') : 0) + 1;
fs.writeFileSync(runs, String(n));
const out = o => process.stdout.write(JSON.stringify(o) + '\\n');
let inbuf = '';
process.stdin.on('data', d => { inbuf += d; let k; while ((k = inbuf.indexOf('\\n')) >= 0) { fs.appendFileSync(runs + '.cmds', inbuf.slice(0, k) + '\\n'); inbuf = inbuf.slice(k + 1); } });
process.stdin.on('end', () => process.exit(0));
out({ t: 'hello', v: 2, pid: process.pid });
out({ t: 'audio', list: [{ key: 'spotify.exe', name: 'Spotify', vol: 0.5, mute: false, active: true, n: 1 }] });
out({ t: 'media', ok: true, list: [{ app: 'Spotify.exe', key: 'spotify.exe', status: 'playing', title: 'Dal', artist: 'Előadó', current: true }] });
out({ t: 'peaks', m: 0.4, s: { 'spotify.exe': 0.35 } });
out({ t: 'bt', list: [{ id: 'ab12', name: 'Fülhallgató', le: false, battery: 80, connected: true, last: null }] });
out({ t: 'usb', roots: 1, list: [{ id: 'cd34', name: 'USB 2.0 Hub', cls: 'USB', root: 0, chain: [3] }] });
out({ t: 'windows', list: [{ h: 10, pid: 1, exe: 'explorer.exe', name: 'Windows Explorer' }] });
out({ t: 'fg', h: 10 });
if (n === 1) {
  setTimeout(() => { out({ t: 'open', h: 20, pid: 2, exe: 'mspaint.exe', name: 'Paint', title: 'titkos-kep.png - Paint' }); out({ t: 'fg', h: 20 }); }, 400);
  setTimeout(() => { out({ t: 'close', h: 20 }); out({ t: 'fg', h: 10 }); }, 1200);
  setTimeout(() => process.exit(3), 1800);   // a crash: the segéd must start it again
}
`;
let srv = null, raw = '', token = '';
const events = [];
async function start() {
  if (srv) return srv;
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: fx });
  for (const f of ['companion.js', 'scan.js', 'sessions.js', 'agents-poll.js']) put(path.join(fx, 'CodeCity', f), fs.readFileSync(path.join(CITY, f), 'utf8'));
  put(path.join(fx, 'CodeCity', 'dist', 'vrg-codecity.html'), '<!doctype html><html><head></head><body>fixture</body></html>');
  put(path.join(fx, 'fake-probe.js'), FAKE);
  const cfg = path.join(fx, 'none.json');
  put(cfg, JSON.stringify({ downloads: path.join(fx, 'dl'), agentsCmd: [process.execPath, '-e', 'console.log("[]")'],
    probeCmd: [process.execPath, path.join(fx, 'fake-probe.js'), path.join(fx, 'runs.txt')] }));
  const env = Object.assign({}, process.env); delete env.KP_DRY_RUN;
  const child = spawn(process.execPath, [path.join(fx, 'CodeCity', 'companion.js'), '--port', '0', '--no-open', '--no-terminal', '--config', cfg], { env });
  const port = await new Promise((resolve, reject) => {
    let out = '';
    child.stdout.on('data', d => { out += d; const m = out.match(/port (\d+)/); if (m) resolve(+m[1]); });
    child.on('exit', c => reject(new Error('server exited ' + c)));
    setTimeout(() => reject(new Error('server did not start')), 5000);
  });
  srv = { child, port };
  process.on('exit', () => { child.kill(); try { fs.rmSync(fx, { recursive: true, force: true }); } catch (e) { /* busy */ } });
  const page = await new Promise((res, rej) => { const r = http.request({ host: '127.0.0.1', port, path: '/', headers: { Host: '127.0.0.1:' + port } }, x => { x.resume(); res(x); }); r.on('error', rej); r.end(); });
  const cookie = String((page.headers['set-cookie'] || [''])[0]).split(';')[0];
  token = fs.readFileSync(path.join(fx, 'CodeCity', '.companion-token'), 'utf8').trim();
  await new Promise(resolve => {
    const r = http.request({ host: '127.0.0.1', port, path: '/api/stream', headers: { Host: '127.0.0.1:' + port, Cookie: cookie } }, res => {
      let buf = '';
      res.on('data', d => {
        buf += d; raw += d;
        let k;
        while ((k = buf.indexOf('\n\n')) >= 0) {
          const ev = buf.slice(0, k); buf = buf.slice(k + 2);
          const name = (/^event: (.*)$/m.exec(ev) || [])[1], data = (/^data: (.*)$/m.exec(ev) || [])[1];
          if (name) events.push({ name, data: JSON.parse(data), at: Date.now() });
        }
      });
      resolve();
    });
    r.on('error', () => {}); r.end();
    srv.stream = r;
  });
  return srv;
}
const waitFor = (pred, ms, from = 0) => new Promise(resolve => { const t0 = Date.now(); const tick = () => { const e = events.slice(from).find(pred); if (e || Date.now() - t0 > ms) resolve(e || null); else setTimeout(tick, 50); }; tick(); });
const has = (e, key) => e.data.list.some(a => a.key === key);
const post = (action, body) => new Promise((resolve, reject) => {
  const data = JSON.stringify(body);
  const r = http.request({ host: '127.0.0.1', port: srv.port, path: '/api/' + action, method: 'POST',
    headers: { Host: '127.0.0.1:' + srv.port, 'Content-Type': 'application/json', 'X-Kodvaros-Token': token, 'Content-Length': Buffer.byteLength(data) } },
  res => { let s = ''; res.on('data', d => { s += d; }); res.on('end', () => resolve({ status: res.statusCode, json: JSON.parse(s || '{}') })); });
  r.on('error', reject); r.end(data);
});
const sleep = ms => new Promise(r => setTimeout(r, ms));

module.exports = [
  { name: 'probe: Paint opening raises an "apps" entry in front of Explorer; its closing takes it away', async fn() {
    await start();
    const open = await waitFor(e => e.name === 'apps' && has(e, 'mspaint.exe'), 5000);
    assert.ok(open, JSON.stringify(events.filter(e => e.name === 'apps').map(e => e.data)));
    const paint = open.data.list.find(a => a.key === 'mspaint.exe');
    assert.ok(open.data.state === 'on' && paint.name === 'Paint' && paint.fg === true && paint.n === 1, JSON.stringify(open.data));
    const closed = await waitFor(e => e.name === 'apps' && !has(e, 'mspaint.exe') && has(e, 'explorer.exe'), 3000, events.indexOf(open) + 1);
    assert.ok(closed && closed.data.list.find(a => a.key === 'explorer.exe').fg === true, JSON.stringify(closed && closed.data));
  } },
  { name: 'probe: a crashed probe is started again (state off, then on with its windows back)', async fn() {
    const off = await waitFor(e => e.name === 'apps' && e.data.state === 'off', 5000);
    assert.ok(off, 'no off state after the crash');
    const on = await waitFor(e => e.name === 'apps' && e.data.state === 'on' && has(e, 'explorer.exe'), 5000, events.indexOf(off) + 1);
    assert.ok(on, 'not started again');
    assert.strictEqual(fs.readFileSync(path.join(fx, 'runs.txt'), 'utf8'), '2');
  } },
  { name: 'probe: the stadium feeds (media, audio, peaks, bt, usb) reach the stream with ids hashed', async fn() {
    for (const t of ['media', 'audio', 'peaks', 'bt', 'usb']) assert.ok(events.some(e => e.name === t), 'no ' + t);
    const m = events.filter(e => e.name === 'media').pop().data.list[0];
    assert.ok(m.key === 'spotify.exe' && m.status === 'playing', JSON.stringify(m));
    assert.ok(events.filter(e => e.name === 'bt').pop().data.list[0].battery === 80);
  } },
  { name: 'probe: probe-volume reaches the probe for a tower; an unknown program, a bad volume or no token is refused', async fn() {
    const ok = await post('probe-volume', { key: 'spotify.exe', v: 0.7345 });
    assert.ok(ok.status === 200 && ok.json.ok, JSON.stringify(ok));
    const mute = await post('probe-mute', { key: 'spotify.exe', on: true });
    assert.strictEqual(mute.status, 200);
    assert.strictEqual((await post('probe-volume', { key: 'cmd.exe', v: 0.5 })).status, 404);
    assert.strictEqual((await post('probe-volume', { key: 'spotify.exe', v: 2 })).status, 400);
    assert.strictEqual((await post('probe-volume', { key: 'spotify.exe', v: 0.5, extra: 1 })).status, 400);
    const keep = token; token = 'x'.repeat(keep.length);
    assert.strictEqual((await post('probe-volume', { key: 'spotify.exe', v: 0.1 })).status, 401);
    token = keep;
    await sleep(300);
    const cmds = fs.readFileSync(path.join(fx, 'runs.txt.cmds'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
    assert.deepStrictEqual(cmds, [{ t: 'vol', key: 'spotify.exe', v: 0.73 }, { t: 'mute', key: 'spotify.exe', on: true }]);
  } },
  { name: 'probe: no window title ever reaches the stream', async fn() {
    assert.ok(!/titkos/.test(raw), 'a title on the wire');
  } }
];
