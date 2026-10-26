'use strict';

// Supervised jobs and the port street (P6, KV-14) on a throwaway repo: its own Planner/START.cmd lists one local
// server (LH1, a node script on a free port). Starting it through the segéd must stream its log and show its
// port as ours; stopping must kill the whole tree (the port is free again) and read 'leállítva'.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const http = require('http');
const { spawn, execFileSync } = require('child_process');

const CITY = path.resolve(__dirname, '..');
const fx = fs.mkdtempSync(path.join(os.tmpdir(), 'kv-jobs-'));
const put = (p, s) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };
const freePort = () => new Promise(res => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const listening = port => new Promise(res => { const c = net.connect(port, '127.0.0.1', () => { c.destroy(); res(true); }); c.on('error', () => res(false)); });

let srv = null, token = '', P = 0;
const events = [];
async function start() {
  if (srv) return srv;
  P = await freePort();
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: fx });
  for (const f of ['companion.js', 'scan.js', 'sessions.js', 'agents-poll.js']) put(path.join(fx, 'CodeCity', f), fs.readFileSync(path.join(CITY, f), 'utf8'));
  put(path.join(fx, 'CodeCity', 'dist', 'vrg-codecity.html'), '<!doctype html><html><head></head><body>fixture</body></html>');
  // the server starts a child of its own, so 'stop' must take a tree down, not one process
  put(path.join(fx, 'tools', 'srv.js'), `require('child_process').spawn(process.execPath, ['-e', 'setInterval(()=>{},1e9)'], { stdio: 'ignore' });\n` +
    `require('http').createServer((q, r) => r.end('ok')).listen(${P}, '127.0.0.1', () => console.log('fixture server on ${P}'));\n`);
  // a stand-in selftest: fails until CodeCity/tools/ok exists (the weather check of KV-15)
  put(path.join(fx, 'CodeCity', 'tools', 'selftest.js'), "const ok = require('fs').existsSync(__dirname + '/ok');\n" +
    "console.log(ok ? 'all passed' : 'FAIL  scanner\\n    at CodeCity/scan.js:12:5'); process.exit(ok ? 0 : 1);\n");
  put(path.join(fx, 'Planner', 'START.cmd'), ['@echo off', 'set "LH1_NAME=Proba szerver"', `set "LH1_PORT=${P}"`, 'set "LH1_PATH=/"', 'set "LH1_JS=tools\\srv.js"', 'set "LHCOUNT=1"', ''].join('\r\n'));
  const cfg = path.join(fx, 'none.json');
  put(cfg, JSON.stringify({ agentsCmd: [process.execPath, '-e', 'console.log("[]")'] }));
  const env = Object.assign({}, process.env); delete env.KP_DRY_RUN;
  const child = spawn(process.execPath, [path.join(fx, 'CodeCity', 'companion.js'), '--port', '0', '--no-open', '--no-terminal', '--no-watch', '--config', cfg], { env });
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
      let s = ''; res.on('data', d => { s += d; }); res.on('end', () => { let j = null; try { j = JSON.parse(s); } catch (e) { /* html */ } resolve({ status: res.statusCode, json: j, headers: res.headers }); });
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
const waitFor = (pred, ms) => new Promise(resolve => { const t0 = Date.now(); const tick = () => { const e = events.find(pred); if (e || Date.now() - t0 > ms) resolve(e || null); else setTimeout(tick, 50); }; tick(); });

module.exports = [
  { name: 'jobs: START.cmd\'s local server is a job; start streams its log and its port shows as ours', async fn() {
    await start();
    const page = await req('GET', '/');
    const cookie = String((page.headers['set-cookie'] || [''])[0]).split(';')[0];
    assert.strictEqual(await listen(cookie), 200);
    const list = (await req('GET', '/api/jobs', { cookie })).json.list;
    assert.ok(list.some(j => j.id === 'lh1' && j.port === P && j.state === 'áll'), JSON.stringify(list));
    assert.strictEqual((await req('POST', '/api/job-start', { body: { id: 'nope' } })).status, 404);
    const st = await req('POST', '/api/job-start', { body: { id: 'lh1' } });
    assert.strictEqual(st.json.state, 'fut', JSON.stringify(st.json));
    assert.ok(await waitFor(e => e.name === 'joblog' && e.data.lines.some(l => l.includes('fixture server on ' + P)), 5000), 'log line');
    assert.ok(await waitFor(e => e.name === 'ports' && e.data.list.some(p => p.port === P && p.job === 'lh1' && p.ours), 12000), 'port ' + P + ' ours');
    assert.strictEqual((await req('POST', '/api/job-start', { body: { id: 'lh1' } })).status, 409, 'not twice');
  } },
  { name: 'jobs: stop kills the whole tree; the port is free and the job reads leállítva', async fn() {
    const before = Number(execFileSync('powershell', ['-NoProfile', '-Command', `(Get-CimInstance Win32_Process -Filter "Name='node.exe'" | ? { $_.CommandLine -like '*setInterval*1e9*' } | measure).Count`], { encoding: 'utf8' }).trim());
    assert.strictEqual((await req('POST', '/api/job-stop', { body: { id: 'lh1' } })).status, 200);
    const e = await waitFor(x => x.name === 'job' && x.data.id === 'lh1' && x.data.state === 'leállítva', 6000);
    assert.ok(e, 'leállítva: ' + JSON.stringify(events.filter(x => x.name === 'job')));
    assert.strictEqual(await listening(P), false, 'port free');
    const after = Number(execFileSync('powershell', ['-NoProfile', '-Command', `(Get-CimInstance Win32_Process -Filter "Name='node.exe'" | ? { $_.CommandLine -like '*setInterval*1e9*' } | measure).Count`], { encoding: 'utf8' }).trim());
    assert.ok(after < before, `the server's own child died too (${before} -> ${after})`);
  } },
  { name: 'health: a failing selftest job reads hiba for its district, its log names the file; fixed it reads kész; pipes arrive', async fn() {
    assert.ok(events.some(e => e.name === 'pipes' && Array.isArray(e.data.list)), 'pipes on connect');
    assert.strictEqual((await req('POST', '/api/job-start', { body: { id: 'codecity-selftest' } })).status, 200);
    const bad = await waitFor(e => e.name === 'job' && e.data.id === 'codecity-selftest' && e.data.state === 'hiba', 8000);
    assert.ok(bad && bad.data.district === 'CodeCity', 'storm: ' + JSON.stringify(bad && bad.data));
    assert.ok(events.some(e => e.name === 'joblog' && e.data.id === 'codecity-selftest' && e.data.lines.some(l => l.includes('CodeCity/scan.js:12'))), 'the tunnel\'s file is in the log');
    fs.writeFileSync(path.join(fx, 'CodeCity', 'tools', 'ok'), '');
    events.length = 0;
    assert.strictEqual((await req('POST', '/api/job-start', { body: { id: 'codecity-selftest' } })).status, 200);
    assert.ok(await waitFor(e => e.name === 'job' && e.data.id === 'codecity-selftest' && e.data.state === 'kész', 8000), 'calm again');
    srv.stream.destroy(); srv.child.kill();
  } }
];
