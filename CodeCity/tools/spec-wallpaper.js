'use strict';

// Wallpaper (P12 L0, KV-24) on a throwaway repo: a page listening with ?wallpaper=1 is a light listener — it gets the
// stream (hello), the probe is not started and `claude agents` runs at the slow pace; once a full page listens too, the
// probe starts and the poller goes back to every 6 s.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn, execFileSync } = require('child_process');

const CITY = path.resolve(__dirname, '..');
const fx = fs.mkdtempSync(path.join(os.tmpdir(), 'kv-wall-'));
const put = (p, s) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };
const probeRuns = path.join(fx, 'probe-runs.txt'), agentCalls = path.join(fx, 'agent-calls.txt');
let srv = null, cookie = '';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const calls = () => { try { return fs.readFileSync(agentCalls, 'utf8').trim().split('\n').filter(Boolean).length; } catch (e) { return 0; } };
async function start() {
  if (srv) return srv;
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: fx });
  for (const f of ['companion.js', 'scan.js', 'sessions.js', 'agents-poll.js']) put(path.join(fx, 'CodeCity', f), fs.readFileSync(path.join(CITY, f), 'utf8'));
  put(path.join(fx, 'CodeCity', 'dist', 'vrg-codecity.html'), '<!doctype html><html><head></head><body>fixture</body></html>');
  const cfg = path.join(fx, 'none.json');
  put(cfg, JSON.stringify({ downloads: path.join(fx, 'dl'), transcripts: [path.join(fx, 'none')],
    agentsCmd: [process.execPath, '-e', `require('fs').appendFileSync(${JSON.stringify(agentCalls)}, Date.now() + '\\n'); console.log('[]')`],
    probeCmd: [process.execPath, '-e', `require('fs').appendFileSync(${JSON.stringify(probeRuns)}, 'x'); process.stdin.resume()`] }));
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
  cookie = String((page.headers['set-cookie'] || [''])[0]).split(';')[0];
  return srv;
}
const listen = q => new Promise(resolve => {
  const r = http.request({ host: '127.0.0.1', port: srv.port, path: '/api/stream' + q, headers: { Host: '127.0.0.1:' + srv.port, Cookie: cookie } }, res => {
    let raw = ''; res.on('data', d => { raw += d; if (/event: hello/.test(raw)) resolve(r); });
  });
  r.on('error', () => {}); r.end();
});

module.exports = [
  { name: 'wallpaper: a ?wallpaper=1 listener gets the stream, but no probe, and claude agents only once in 9 s', async fn() {
    await start();
    await listen('?wallpaper=1');
    await sleep(9000);
    assert.ok(!fs.existsSync(probeRuns), 'the probe started for a wallpaper');
    assert.strictEqual(calls(), 1, 'claude agents calls in 9 s: ' + calls());
  } },
  { name: 'wallpaper: a full page joins — the probe starts and the poller is back to every 6 s', async fn() {
    const before = calls();
    await listen('');
    await sleep(8500);
    assert.ok(fs.existsSync(probeRuns), 'the probe did not start for a full page');
    assert.ok(calls() - before >= 2, 'claude agents calls in 8.5 s after the full page: ' + (calls() - before));
  } }
];
