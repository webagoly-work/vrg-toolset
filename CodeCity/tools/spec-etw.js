'use strict';

// Elevated ETW (P11, KV-23) on a throwaway repo, with a fake vrg-etw (a Node pipe server speaking the same lines) and a
// fake agents list holding one interactive Claude session with a pid: the exact cargo per process must reach the stream
// by dock and country with no address; a repo file read by a Bash child of that session must beam to the session; the
// session's own reads must not (its hook reports those); pipe off -> 'etw' off.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const net = require('net');
const { spawn, execFileSync } = require('child_process');

const CITY = path.resolve(__dirname, '..');
const fx = fs.mkdtempSync(path.join(os.tmpdir(), 'kv-etw-'));
const PIPE = '\\\\.\\pipe\\vrg-etw-spec-' + process.pid;
const put = (p, s) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };
let srv = null, raw = '', pipeConn = null, pipeServer = null;
const events = [];
const send = o => pipeConn.write(JSON.stringify(o) + '\n');
async function start() {
  if (srv) return srv;
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: fx });
  for (const f of ['companion.js', 'scan.js', 'sessions.js', 'agents-poll.js', 'ports.json']) put(path.join(fx, 'CodeCity', f), fs.readFileSync(path.join(CITY, f), 'utf8'));
  put(path.join(fx, 'CodeCity', 'dist', 'vrg-codecity.html'), '<!doctype html><html><head></head><body>fixture</body></html>');
  put(path.join(fx, 'a.txt'), 'a\n');
  const agent = [{ id: 'aaaa1111', pid: 4100, cwd: fx, kind: 'interactive', sessionId: 'aaaa1111-0000-4000-8000-000000000001', name: 'teszt', state: 'working', startedAt: 1 }];
  const cfg = path.join(fx, 'none.json');
  put(cfg, JSON.stringify({ downloads: path.join(fx, 'dl'), etwPipe: PIPE, transcripts: [path.join(fx, 'none')],
    agentsCmd: [process.execPath, '-e', 'console.log(' + JSON.stringify(JSON.stringify(agent)) + ')'],
    probeCmd: [process.execPath, '-e', 'process.stdin.resume()'] }));
  const connected = new Promise(resolve => { pipeServer = net.createServer(c => { pipeConn = c; resolve(); }); pipeServer.listen(PIPE); });
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
  http.request({ host: '127.0.0.1', port, path: '/api/stream', headers: { Host: '127.0.0.1:' + port, Cookie: cookie } }, res => {
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
  }).end();
  await connected;   // the segéd dials the pipe once a page listens
  return srv;
}
const waitFor = (pred, ms) => new Promise(resolve => { const t0 = Date.now(); const tick = () => { const e = events.find(pred); if (e || Date.now() - t0 > ms) resolve(e || null); else setTimeout(tick, 50); }; tick(); });

module.exports = [
  { name: 'etw: hello -> on; the exact cargo per process arrives by dock and country, without the address', async fn() {
    await start();
    send({ t: 'hello', v: 1, demo: false });
    send({ t: 'procs', list: [{ pid: 4100, ppid: 1, exe: 'claude.exe' }, { pid: 4200, ppid: 4100, exe: 'bash.exe' }, { pid: 4300, ppid: 4200, exe: 'git-remote-https.exe' }] });
    const on = await waitFor(e => e.name === 'etw' && e.data.state === 'on', 4000);
    assert.ok(on, JSON.stringify(events.filter(e => e.name === 'etw')));
    send({ t: 'net', list: [{ pid: 4300, exe: 'git-remote-https.exe', rx: 2500000, tx: 12000, to: [{ ip: '140.82.121.4', port: 443, proto: 'tcp', rx: 2500000, tx: 12000 }] },
      { pid: 9, exe: 'svchost.exe', rx: 100, tx: 100, to: [{ ip: '192.168.0.1', port: 53, proto: 'udp', rx: 100, tx: 100 }] }] });
    const c = await waitFor(e => e.name === 'etwcargo', 4000);
    assert.ok(c, 'no etwcargo');
    const git = c.data.list.find(p => p.exe === 'git-remote-https.exe'), sv = c.data.list.find(p => p.exe === 'svchost.exe');
    assert.ok(git.rx === 2500000 && git.tx === 12000 && git.docks.web === 2512000 && Object.values(git.docks).reduce((a, b) => a + b, 0) === 2512000, JSON.stringify(git));
    assert.ok(sv.docks.lan === 200 && sv.claude === false, JSON.stringify(sv));
    assert.ok(!/140\.82\.121\.4|192\.168\.0\.1/.test(raw), 'an address on the wire');
  } },
  { name: 'etw: a repo file read by a Bash child of a Claude session beams to that session; its own read does not', async fn() {
    await new Promise(r => setTimeout(r, 7000));   // the agents poll (every 6 s) must have named the session and its pid
    send({ t: 'file', list: [{ pid: 4100, exe: 'claude.exe', op: 'r', path: 'a.txt' }, { pid: 4200, exe: 'bash.exe', op: 'r', path: 'a.txt' }, { pid: 4200, exe: 'bash.exe', op: 'w', path: 'b.txt' }] });
    const read = await waitFor(e => e.name === 'beam' && e.data.p === 'a.txt', 4000);
    assert.ok(read && read.data.id === 'aaaa1111' && read.data.kind === 0 && read.data.via === 'bash.exe', JSON.stringify(events.filter(e => e.name === 'beam')));
    const write = await waitFor(e => e.name === 'beam' && e.data.p === 'b.txt', 2000);
    assert.ok(write && write.data.kind === 2, 'the write');
    assert.strictEqual(events.filter(e => e.name === 'beam' && e.data.p === 'a.txt').length, 1, 'claude.exe\'s own read beamed too');
    const n0 = events.length;
    send({ t: 'net', list: [{ pid: 4300, exe: 'git-remote-https.exe', rx: 10, tx: 10, to: [] }] });
    const c2 = await waitFor(e => e.name === 'etwcargo' && events.indexOf(e) >= n0, 3000);
    assert.ok(c2 && c2.data.list[0].claude === true, 'the clone is not marked as started by Claude');
    assert.ok(!/"pid"/.test(events.filter(e => e.name === 'agents').map(e => JSON.stringify(e.data)).join('')), 'the session pid reached the page');
  } },
  { name: 'etw: the pipe closing turns it off', async fn() {
    const from = events.length;
    pipeConn.destroy(); pipeServer.close();
    const off = await waitFor(e => e.name === 'etw' && e.data.state === 'off' && events.indexOf(e) >= from, 4000);
    assert.ok(off, 'not off');
  } }
];
