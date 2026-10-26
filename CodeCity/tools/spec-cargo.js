'use strict';

// Cargo (P8, KV-19) on a throwaway repo with its own "Downloads" folder: a browser-style download (.crdownload growing
// to 100 MB, then renamed, then marked from the internet) must reach GET /api/stream as one cargo — growing, then
// arrived with customs saying "from the internet"; a small .exe with no mark arrives as a program with no mark; and the
// file names never travel (only the extension and the size).

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn, execFileSync } = require('child_process');

const CITY = path.resolve(__dirname, '..');
const fx = fs.mkdtempSync(path.join(os.tmpdir(), 'kv-cargo-')), dl = path.join(fx + '-dl');
const put = (p, s) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };
let srv = null, raw = '';
const events = [];
async function start() {
  if (srv) return srv;
  fs.mkdirSync(dl, { recursive: true });
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: fx });
  for (const f of ['companion.js', 'scan.js', 'sessions.js', 'agents-poll.js']) put(path.join(fx, 'CodeCity', f), fs.readFileSync(path.join(CITY, f), 'utf8'));
  put(path.join(fx, 'CodeCity', 'dist', 'vrg-codecity.html'), '<!doctype html><html><head></head><body>fixture</body></html>');
  const cfg = path.join(fx, 'none.json');
  put(cfg, JSON.stringify({ downloads: dl, agentsCmd: [process.execPath, '-e', 'console.log("[]")'] }));
  const env = Object.assign({}, process.env); delete env.KP_DRY_RUN;
  const child = spawn(process.execPath, [path.join(fx, 'CodeCity', 'companion.js'), '--port', '0', '--no-open', '--no-terminal', '--config', cfg], { env });
  const port = await new Promise((resolve, reject) => {
    let out = '';
    child.stdout.on('data', d => { out += d; const m = out.match(/port (\d+)/); if (m) resolve(+m[1]); });
    child.on('exit', c => reject(new Error('server exited ' + c)));
    setTimeout(() => reject(new Error('server did not start')), 5000);
  });
  srv = { child, port };
  process.on('exit', () => { child.kill(); for (const d of [fx, dl]) try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* busy */ } });
  const page = await new Promise((res, rej) => { const r = http.request({ host: '127.0.0.1', port, path: '/', headers: { Host: '127.0.0.1:' + port } }, x => { x.resume(); res(x); }); r.on('error', rej); r.end(); });
  const cookie = String((page.headers['set-cookie'] || [''])[0]).split(';')[0];
  await new Promise(resolve => {
    const r = http.request({ host: '127.0.0.1', port, path: '/api/stream', headers: { Host: '127.0.0.1:' + port, Cookie: cookie } }, res => {
      let buf = '';
      res.on('data', d => {
        buf += d; raw += d;
        let k;
        while ((k = buf.indexOf('\n\n')) >= 0) {
          const ev = buf.slice(0, k); buf = buf.slice(k + 2);
          const name = (/^event: (.*)$/m.exec(ev) || [])[1], data = (/^data: (.*)$/m.exec(ev) || [])[1];
          if (name) events.push({ name, data: JSON.parse(data) });
        }
      });
      resolve();
    });
    r.on('error', () => {}); r.end();
    srv.stream = r;
  });
  return srv;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const waitFor = (pred, ms) => new Promise(resolve => { const t0 = Date.now(); const tick = () => { const e = events.find(pred); if (e || Date.now() - t0 > ms) resolve(e || null); else setTimeout(tick, 50); }; tick(); });

module.exports = [
  { name: 'cargo: a 100 MB browser download grows as one cargo, then arrives as a .zip with customs "from the internet"', async fn() {
    await start();
    await sleep(800);
    const tmp = path.join(dl, 'titkos-nev.zip.crdownload'), chunk = Buffer.alloc(10 * 1048576, 7);
    for (let i = 0; i < 10; i++) { fs.appendFileSync(tmp, chunk); await sleep(250); }
    fs.renameSync(tmp, path.join(dl, 'titkos-nev.zip'));
    fs.writeFileSync(path.join(dl, 'titkos-nev.zip') + ':Zone.Identifier', '[ZoneTransfer]\r\nZoneId=3\r\n');
    const grow = await waitFor(e => e.name === 'cargo' && !e.data.done && e.data.size > 0, 4000);
    assert.ok(grow, 'growing: ' + JSON.stringify(events.filter(e => e.name === 'cargo')));
    const done = await waitFor(e => e.name === 'cargo' && e.data.done, 8000);
    assert.ok(done && done.data.size === 100 * 1048576 && done.data.ext === '.zip' && done.data.id === grow.data.id, JSON.stringify(done && done.data));
    assert.ok(done.data.customs.internet === true && done.data.customs.exec === false, JSON.stringify(done.data.customs));
  } },
  { name: 'cargo: a small .exe with no mark arrives as a program, no mark; no file name ever travels', async fn() {
    fs.writeFileSync(path.join(dl, 'masik-titok.exe'), Buffer.alloc(2048, 1));
    const done = await waitFor(e => e.name === 'cargo' && e.data.done && e.data.ext === '.exe', 8000);
    assert.ok(done && done.data.customs.exec === true && done.data.customs.internet === false, JSON.stringify(done && done.data));
    assert.ok(!/titkos|titok/.test(raw), 'no file name on the wire');
    srv.stream.destroy(); srv.child.kill();
  } }
];
