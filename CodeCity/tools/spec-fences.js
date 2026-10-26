'use strict';

// Fences and the conflict radar (P4, KV-11) on a throwaway repo: two worktrees (wa, wb) both commit an edit to
// a.js, wb also has b.js uncommitted. The companion's 'fences' must flag a.js as a conflict (wa + wb) and fence
// b.js for wb alone; then a Claude session editing b.js (through the hook endpoint) makes b.js a conflict too,
// and an edit made inside a worktree's folder lands on the city's own path.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn, execFileSync } = require('child_process');

const CITY = path.resolve(__dirname, '..');
const fx = fs.mkdtempSync(path.join(os.tmpdir(), 'kv-fence-'));
const g = (cwd, ...a) => execFileSync('git', ['-c', 'user.name=Teszt', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', ...a], { cwd, encoding: 'utf8' });
const put = (p, s) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };

let srv = null, token = '';
const events = [];
async function start() {
  if (srv) return srv;
  g(fx, 'init', '-q', '-b', 'main');
  put(path.join(fx, 'a.js'), 'one\n'); put(path.join(fx, 'b.js'), 'bee\n'); put(path.join(fx, 'c.js'), 'sea\n');
  for (const f of ['companion.js', 'scan.js', 'sessions.js', 'agents-poll.js']) put(path.join(fx, 'CodeCity', f), fs.readFileSync(path.join(CITY, f), 'utf8'));
  put(path.join(fx, 'CodeCity', 'dist', 'vrg-codecity.html'), '<!doctype html><html><head></head><body>fixture</body></html>');
  put(path.join(fx, '.gitignore'), 'CodeCity/.companion-token\n.claude/worktrees/\n');
  g(fx, 'add', '.'); g(fx, 'commit', '-q', '-m', 'first');
  for (const w of ['wa', 'wb']) {
    const dir = path.join(fx, '.claude', 'worktrees', w);
    g(fx, 'worktree', 'add', '-q', '-b', w, dir);
    put(path.join(dir, 'a.js'), 'one\n' + w + '\n');
    g(dir, 'commit', '-q', '-am', w + ' edits a');
  }
  put(path.join(fx, '.claude', 'worktrees', 'wb', 'b.js'), 'bee\nwb, not committed\n');
  const env = Object.assign({}, process.env); delete env.KP_DRY_RUN;
  const cfg = path.join(fx, 'none.json');
  put(cfg, JSON.stringify({ agentsCmd: [process.execPath, '-e', 'console.log("[]")'] }));
  const child = spawn(process.execPath, [path.join(fx, 'CodeCity', 'companion.js'), '--port', '0', '--no-open', '--no-terminal', '--config', cfg], { env });
  const port = await new Promise((resolve, reject) => {
    let out = '';
    child.stdout.on('data', d => { out += d; const m = out.match(/port (\d+)/); if (m) resolve(+m[1]); });
    child.on('exit', c => reject(new Error('server exited ' + c)));
    setTimeout(() => reject(new Error('server did not start')), 5000);
  });
  srv = { child, port };
  token = fs.readFileSync(path.join(fx, 'CodeCity', '.companion-token'), 'utf8').trim();
  process.on('exit', () => { child.kill(); try { fs.rmSync(fx, { recursive: true, force: true }); } catch (e) { /* busy */ } });
  return srv;
}
function req(method, p, { cookie, body } = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null, headers = { Host: '127.0.0.1:' + srv.port, Cookie: cookie || '' };
    if (data) { headers['Content-Type'] = 'application/json'; headers['X-Kodvaros-Token'] = token; }
    const r = http.request({ host: '127.0.0.1', port: srv.port, method, path: p, headers }, res => {
      let s = ''; res.on('data', d => { s += d; }); res.on('end', () => resolve({ status: res.statusCode, text: s, headers: res.headers }));
    });
    r.on('error', reject); if (data) r.write(data); r.end();
  });
}
function listen(cookie) {
  return new Promise(resolve => {
    const r = http.request({ host: '127.0.0.1', port: srv.port, path: '/api/stream', headers: { Host: '127.0.0.1:' + srv.port, Cookie: cookie } }, res => {
      let buf = '';
      res.on('data', d => {
        buf += d;
        let k;
        while ((k = buf.indexOf('\n\n')) >= 0) {
          const ev = buf.slice(0, k); buf = buf.slice(k + 2);
          const name = (/^event: (.*)$/m.exec(ev) || [])[1], data = (/^data: (.*)$/m.exec(ev) || [])[1];
          if (name) events.push({ name, data: JSON.parse(data) });
        }
      });
      resolve(res.statusCode);
    });
    r.on('error', () => {}); r.end();
    srv.stream = r;
  });
}
const waitFor = (pred, ms) => new Promise(resolve => { const t0 = Date.now(); const tick = () => { const e = [...events].reverse().find(pred); if (e || Date.now() - t0 > ms) resolve(e || null); else setTimeout(tick, 50); }; tick(); });
const fileOf = (e, p) => e && e.data.list.find(x => x.p === p);
const owners = f => f ? f.owners.map(o => o.kind[0] + ':' + o.id).sort().join(',') : '';

module.exports = [
  { name: 'fences: two worktrees committing a.js -> a.js is a conflict (wa + wb); b.js uncommitted in wb -> wb only', async fn() {
    await start();
    const page = await req('GET', '/');
    assert.strictEqual(await listen(String((page.headers['set-cookie'] || [''])[0]).split(';')[0]), 200);
    const e = await waitFor(x => x.name === 'fences' && fileOf(x, 'a.js'), 8000);
    assert.ok(e, 'fences event: ' + JSON.stringify(events.map(x => x.name)));
    const a = fileOf(e, 'a.js'), b = fileOf(e, 'b.js');
    assert.ok(a.conflict && owners(a) === 'w:wa,w:wb', 'a.js: ' + JSON.stringify(a));
    assert.ok(b && !b.conflict && owners(b) === 'w:wb', 'b.js: ' + JSON.stringify(b));
  } },
  { name: 'fences: a session editing b.js (hook) makes it a conflict; an edit inside a worktree folder fences the city path', async fn() {
    assert.strictEqual((await req('POST', '/api/hook', { body: { sid: 'abcd1234', event: 'pre', kind: 2, paths: [path.join(fx, 'b.js')] } })).status, 200);
    assert.strictEqual((await req('POST', '/api/hook', { body: { sid: 'ef015678', event: 'pre', kind: 2, paths: [path.join(fx, '.claude', 'worktrees', 'wa', 'c.js')] } })).status, 200);
    assert.strictEqual((await req('POST', '/api/hook', { body: { sid: 'ef015678', event: 'pre', kind: 0, paths: [path.join(fx, 'a.js')] } })).status, 200);   // a read fences nothing
    const e = await waitFor(x => x.name === 'fences' && fileOf(x, 'c.js'), 4000);
    assert.ok(e, 'fences after the hooks');
    const b = fileOf(e, 'b.js'), c = fileOf(e, 'c.js'), a = fileOf(e, 'a.js');
    assert.ok(b.conflict && owners(b) === 's:abcd1234,w:wb', 'b.js: ' + JSON.stringify(b));
    assert.ok(c && !c.conflict && owners(c) === 's:ef015678', 'c.js (edited inside wa\'s folder): ' + JSON.stringify(c));
    assert.ok(owners(a) === 'w:wa,w:wb', 'a read does not fence: ' + JSON.stringify(a));
    srv.stream.destroy(); srv.child.kill();
  } }
];
