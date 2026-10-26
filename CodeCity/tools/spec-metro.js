'use strict';

// Git as metro lines (P7, KV-16) on a throwaway repo: a branch that edits the same line of a.js as main (a
// conflict) and one that only adds c.js (clean). /api/gitmap must give both lines with ahead/behind and stations;
// /api/merge-preview must name a.js as the conflict and call the other clean; and nothing may move — main's
// commit and the working tree are the same afterwards (the preview merges in memory only).

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn, execFileSync } = require('child_process');

const CITY = path.resolve(__dirname, '..');
const fx = fs.mkdtempSync(path.join(os.tmpdir(), 'kv-metro-'));
const g = (...a) => execFileSync('git', ['-c', 'user.name=Teszt', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', ...a], { cwd: fx, encoding: 'utf8' }).trim();
const put = (p, s) => { fs.mkdirSync(path.dirname(path.join(fx, p)), { recursive: true }); fs.writeFileSync(path.join(fx, p), s); };

let srv = null, cookie = '';
async function start() {
  if (srv) return srv;
  g('init', '-q', '-b', 'main');
  for (const f of ['companion.js', 'scan.js', 'sessions.js', 'agents-poll.js']) put('CodeCity/' + f, fs.readFileSync(path.join(CITY, f), 'utf8'));
  put('CodeCity/dist/vrg-codecity.html', '<!doctype html><html><head></head><body>fixture</body></html>');
  put('.gitignore', 'CodeCity/.companion-token\n');
  put('a.js', 'one\ntwo\n'); g('add', '.'); g('commit', '-q', '-m', 'first');
  g('branch', 'fb'); g('branch', 'cb');
  put('a.js', 'one\nMAIN\n'); g('commit', '-q', '-am', 'main edits a');
  g('checkout', '-q', 'fb'); put('a.js', 'one\nBRANCH\n'); g('commit', '-q', '-am', 'fb edits a');
  g('checkout', '-q', 'cb'); put('c.js', 'sea\n'); g('add', 'c.js'); g('commit', '-q', '-m', 'cb adds c');
  g('checkout', '-q', 'main');
  const cfg = path.join(fx, 'none.json');
  fs.writeFileSync(cfg, JSON.stringify({ agentsCmd: [process.execPath, '-e', 'console.log("[]")'] }));
  const env = Object.assign({}, process.env); delete env.KP_DRY_RUN;
  const child = spawn(process.execPath, [path.join(fx, 'CodeCity', 'companion.js'), '--port', '0', '--no-open', '--no-terminal', '--no-watch', '--config', cfg], { env });
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
function get(p) {
  return new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port: srv.port, path: p, headers: { Host: '127.0.0.1:' + srv.port, Cookie: cookie } }, res => {
      let s = ''; res.on('data', d => { s += d; }); res.on('end', () => { let j = null; try { j = JSON.parse(s); } catch (e) { /* html */ } resolve({ status: res.statusCode, json: j, headers: res.headers }); });
    });
    r.on('error', reject); r.end();
  });
}

module.exports = [
  { name: 'metro: two lines with ahead/behind and their stations; the worktree list and the reflog', async fn() {
    await start();
    cookie = String(((await get('/')).headers['set-cookie'] || [''])[0]).split(';')[0];
    const m = (await get('/api/gitmap')).json;
    const fb = m.branches.find(b => b.name === 'fb'), cb = m.branches.find(b => b.name === 'cb');
    assert.strictEqual(m.main, 'main');
    assert.ok(fb && fb.ahead === 1 && fb.behind === 1 && fb.files.join() === 'a.js', JSON.stringify(fb));
    assert.ok(cb && cb.ahead === 1 && cb.files.join() === 'c.js', JSON.stringify(cb));
    assert.ok(m.worktrees.length === 1 && m.worktrees[0].main && m.reflog.length >= 2);
  } },
  { name: 'metro: the merge preview names a.js as the conflict, calls cb clean, refuses an unknown branch; nothing moved', async fn() {
    const head = g('rev-parse', 'main'), before = g('status', '--porcelain');
    const f = (await get('/api/merge-preview?branch=fb')).json;
    assert.ok(f.clean === false && f.conflicts.join() === 'a.js' && f.both.join() === 'a.js', JSON.stringify(f));
    const c = (await get('/api/merge-preview?branch=cb')).json;
    assert.ok(c.clean === true && c.conflicts.length === 0, JSON.stringify(c));
    assert.strictEqual((await get('/api/merge-preview?branch=' + encodeURIComponent('main; rm -rf x'))).status, 404);
    assert.strictEqual((await get('/api/merge-preview?branch=main')).status, 404);
    assert.strictEqual(g('rev-parse', 'main'), head, 'main did not move');
    assert.strictEqual(g('status', '--porcelain'), before, 'the working tree did not change');
    srv.child.kill();
  } }
];
