'use strict';

// The live repo (P3, KV-08) end to end on a throwaway repo: the companion is copied into a fixture under the
// OS temp folder (its REPO is the folder above CodeCity/), so nothing here touches this checkout. An edit
// must reach GET /api/stream as an 'fs' event within ~1 s, an ignored folder must stay quiet, a commit must
// raise a 'git' event, and GET /api/city must then answer with the new HEAD.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn, execFileSync } = require('child_process');

const CITY = path.resolve(__dirname, '..');
const fx = fs.mkdtempSync(path.join(os.tmpdir(), 'kv-live-'));
const g = (...a) => execFileSync('git', ['-c', 'user.name=Teszt', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', ...a], { cwd: fx, encoding: 'utf8' });
const put = (p, s) => { fs.mkdirSync(path.dirname(path.join(fx, p)), { recursive: true }); fs.writeFileSync(path.join(fx, p), s); };

let srv = null, stream = null;
const events = [];
async function start() {
  if (srv) return srv;
  g('init', '-q', '-b', 'main');
  put('a.js', 'one\n'); put('docs/b.md', '# b\n');
  for (const f of ['companion.js', 'scan.js', 'sessions.js', 'agents-poll.js']) put('CodeCity/' + f, fs.readFileSync(path.join(CITY, f), 'utf8'));
  put('CodeCity/dist/vrg-codecity.html', '<!doctype html><html><head></head><body>fixture</body></html>');
  put('.gitignore', 'CodeCity/.companion-token\nnode_modules/\n');
  g('add', '.'); g('commit', '-q', '-m', 'first');
  const env = Object.assign({}, process.env); delete env.KP_DRY_RUN;
  const child = spawn(process.execPath, [path.join(fx, 'CodeCity', 'companion.js'), '--port', '0', '--no-open', '--no-terminal', '--config', path.join(fx, 'none.json')], { env });
  const port = await new Promise((resolve, reject) => {
    let out = '';
    child.stdout.on('data', d => { out += d; const m = out.match(/port (\d+)/); if (m) resolve(+m[1]); });
    child.on('exit', c => reject(new Error('server exited ' + c)));
    setTimeout(() => reject(new Error('server did not start')), 5000);
  });
  srv = { child, port };
  process.on('exit', () => { child.kill(); try { fs.rmSync(fx, { recursive: true, force: true }); } catch (e) { /* busy */ } });
  return srv;
}
function get(p, cookie) {
  return new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port: srv.port, path: p, headers: { Host: '127.0.0.1:' + srv.port, Cookie: cookie || '' } }, res => {
      let s = ''; res.on('data', d => { s += d; }); res.on('end', () => resolve({ status: res.statusCode, text: s, headers: res.headers }));
    });
    r.on('error', reject); r.end();
  });
}
function listen(cookie) {
  return new Promise(resolve => {
    const r = http.request({ host: '127.0.0.1', port: srv.port, path: '/api/stream', headers: { Host: '127.0.0.1:' + srv.port, Cookie: cookie } }, res => {
      let raw = '';
      res.on('data', d => {
        raw += d;
        let k;
        while ((k = raw.indexOf('\n\n')) >= 0) {
          const ev = raw.slice(0, k); raw = raw.slice(k + 2);
          const name = (/^event: (.*)$/m.exec(ev) || [])[1], data = (/^data: (.*)$/m.exec(ev) || [])[1];
          if (name) events.push({ name, data: JSON.parse(data), at: Date.now() });
        }
      });
      resolve(res.statusCode);
    });
    r.on('error', () => {}); r.end();
    stream = r;
  });
}
const waitFor = (pred, ms) => new Promise(resolve => { const t0 = Date.now(); const tick = () => { const e = events.find(pred); if (e || Date.now() - t0 > ms) resolve(e || null); else setTimeout(tick, 50); }; tick(); });

let cookie = '';
module.exports = [
  { name: 'live: the stream needs the page cookie; with it, hello carries HEAD and watching: true', async fn() {
    await start();
    const page = await get('/');
    cookie = String((page.headers['set-cookie'] || [''])[0]).split(';')[0];
    assert.strictEqual((await get('/api/stream', 'kv_t=' + 'x'.repeat(48))).status, 401);
    assert.strictEqual(await listen(cookie), 200);
    const h = await waitFor(e => e.name === 'hello', 3000);
    assert.ok(h && h.data.watching === true && /^[0-9a-f]{7,}$/.test(h.data.head || g('rev-parse', '--short', 'HEAD').trim()), JSON.stringify(h));
  } },
  { name: 'live: an edit arrives as one fs event within ~1 s; node_modules stays quiet', async fn() {
    await new Promise(r => setTimeout(r, 300));
    const t0 = Date.now();
    put('node_modules/x/index.js', 'ignored\n');
    put('a.js', 'one\ntwo\n');
    const e = await waitFor(x => x.name === 'fs' && x.data.paths.some(p => p.p === 'a.js'), 3000);
    assert.ok(e, 'fs event for a.js: ' + JSON.stringify(events));
    assert.ok(e.at - t0 < 1500, 'within ~1 s (got ' + (e.at - t0) + ' ms)');
    assert.ok(!events.some(x => x.name === 'fs' && x.data.paths.some(p => p.p.startsWith('node_modules/'))), 'node_modules is ignored');
  } },
  { name: 'live: a commit raises a git event with the new HEAD; /api/city answers with that HEAD', async fn() {
    g('add', 'a.js'); g('commit', '-q', '-m', 'second');
    const head = g('rev-parse', '--short', 'HEAD').trim();
    const e = await waitFor(x => x.name === 'git' && x.data.head === head, 4000);
    assert.ok(e, 'git event with ' + head + ': ' + JSON.stringify(events.filter(x => x.name !== 'fs')));
    const c = await get('/api/city', cookie);
    assert.strictEqual(c.status, 200);
    const city = JSON.parse(c.text);
    assert.strictEqual(city.repo.head, head);
    assert.strictEqual(city.commits.length, 2);
    assert.strictEqual((await get('/api/city', '')).status, 401);
    stream.destroy(); srv.child.kill();
  } }
];
