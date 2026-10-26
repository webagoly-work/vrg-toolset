'use strict';

// The companion runs for real on a random port, in dry-run mode: nothing is ever launched.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const HUB = path.resolve(__dirname, '..');
const REPO = path.resolve(HUB, '..');
const SERVER = path.join(HUB, 'companion', 'server.js');

let srv = null;
async function start() {
  if (srv) return srv;
  const cfg = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'kp-comp-')), 'none.json');   // no config: defaults
  const child = spawn(process.execPath, [SERVER, '--port', '0', '--no-open', '--config', cfg], { env: Object.assign({}, process.env, { KP_DRY_RUN: '1' }) });
  const port = await new Promise((resolve, reject) => {
    let out = '';
    child.stdout.on('data', d => { out += d; const m = out.match(/port (\d+)/); if (m) resolve(+m[1]); });
    child.on('exit', c => reject(new Error('server exited ' + c)));
    setTimeout(() => reject(new Error('server did not start')), 5000);
  });
  const token = fs.readFileSync(path.join(HUB, 'companion', '.token'), 'utf8').trim();
  srv = { child, port, token };
  process.on('exit', () => child.kill());
  return srv;
}

function req(method, p, { body, raw, token, host, origin } = {}) {
  return new Promise((resolve, reject) => {
    const data = raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : null;
    const headers = { Host: host || '127.0.0.1:' + srv.port };
    if (data) headers['Content-Type'] = 'application/json';
    if (token) headers['X-Kapu-Token'] = token;
    if (origin) headers.Origin = origin;
    const r = http.request({ host: '127.0.0.1', port: srv.port, method, path: p, headers }, res => {
      let s = '';
      res.on('data', d => { s += d; });
      res.on('end', () => { let j = null; try { j = JSON.parse(s); } catch (e) { /* html */ } resolve({ status: res.statusCode, json: j, text: s }); });
    });
    r.on('error', e => (e.code === 'ECONNRESET' || e.code === 'EPIPE' ? resolve({ status: 413 }) : reject(e)));
    if (data) r.write(data);
    r.end();
  });
}
const post = (action, body, extra) => req('POST', '/api/' + action, Object.assign({ body, token: srv.token }, extra));

module.exports = [
  { name: 'GET / with a foreign Host -> 403; with ours -> the page with the token injected', async fn() {
    await start();
    assert.strictEqual((await req('GET', '/', { host: 'evil.test' })).status, 403);
    const ok = await req('GET', '/');
    assert.strictEqual(ok.status, 200);
    assert.ok(ok.text.includes('window.KP_COMPANION={token:"' + srv.token + '"'));
  } },
  { name: 'POST without token -> 401; foreign Origin -> 403', async fn() {
    await start();
    assert.strictEqual((await req('POST', '/api/open-folder', { body: { dir: 'Hub' } })).status, 401);
    assert.strictEqual((await post('open-folder', { dir: 'Hub' }, { origin: 'https://evil.test' })).status, 403);
  } },
  { name: 'open-folder: C:\\Windows and <repo>/../../.. -> 403; <repo>/Hub -> 200 dry run', async fn() {
    await start();
    assert.strictEqual((await post('open-folder', { dir: 'C:\\Windows' })).status, 403);
    assert.strictEqual((await post('open-folder', { dir: path.join(REPO, '..', '..', '..') })).status, 403);
    const r = await post('open-folder', { dir: path.join(REPO, 'Hub') });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.json.dryRun, true);
    assert.strictEqual(r.json.exe, 'explorer.exe');
    assert.strictEqual(r.json.args[0].toLowerCase(), fs.realpathSync(path.join(REPO, 'Hub')).toLowerCase());
  } },
  { name: 'open-tool: MindMap page -> file URL last; CLAUDE.md -> 400', async fn() {
    await start();
    const r = await post('open-tool', { path: 'MindMap/vrg_mindmap.html' });
    assert.strictEqual(r.status, 200);
    assert.ok(/^file:\/\/\/.*\/MindMap\/vrg_mindmap\.html$/.test(r.json.args[r.json.args.length - 1]), JSON.stringify(r.json));
    assert.strictEqual((await post('open-tool', { path: 'CLAUDE.md' })).status, 400);
  } },
  { name: 'open-start: START.cmd in its own console, Planner as cwd; any field -> 400', async fn() {
    await start();
    const r = await post('open-start', {});
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual([r.json.exe, r.json.args], ['cmd.exe', ['/c', 'START.cmd']]);
    assert.ok(r.json.cwd.toLowerCase().endsWith(path.sep + 'planner'));
    assert.strictEqual((await post('open-start', { cmd: 'calc' })).status, 400);
  } },
  { name: 'terminal and Claude: the folder is the cwd, never an argument', async fn() {
    await start();
    const t = await post('open-terminal', { dir: 'Inventory' });
    assert.strictEqual(t.status, 200);
    assert.ok(t.json.cwd.toLowerCase().endsWith(path.sep + 'inventory'));
    assert.ok(!t.json.args.some(a => a.toLowerCase().includes('inventory')));
    const c = await post('open-claude', { dir: 'Inventory' });
    assert.ok(c.json.args.includes('/k') || c.json.args.includes('cmd'));
  } },
  { name: 'unknown action, extra field, bad git cmd -> 400; body > 16 KB -> 413', async fn() {
    await start();
    assert.strictEqual((await post('rm-rf', { dir: 'Hub' })).status, 400);
    assert.strictEqual((await post('open-folder', { dir: 'Hub', exe: 'calc.exe' })).status, 400);
    assert.strictEqual((await post('git', { cmd: 'rm' })).status, 400);
    assert.strictEqual((await post('git', { cmd: 'status' })).status, 200);
    assert.strictEqual((await post('open-folder', null, { raw: JSON.stringify({ dir: 'x'.repeat(17000) }) })).status, 413);
  } },
  { name: 'status answers; check-paths says which repo paths exist', async fn() {
    await start();
    const s = await req('GET', '/api/status');
    assert.strictEqual(s.json.ok, true);
    const c = await post('check-paths', { paths: ['Hub/README.md', 'Hub/nincs-ilyen.md', '../../../Windows'] });
    assert.deepStrictEqual(c.json, { 'Hub/README.md': true, 'Hub/nincs-ilyen.md': false, '../../../Windows': false });
    srv.child.kill();
  } }
];
