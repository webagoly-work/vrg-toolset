'use strict';

// Live Claude (P4, KV-09) end to end without a real Claude: a fixture repo with the companion in it, a fake
// `agents --json` command (a node script) listing two sessions, and their transcripts in a fixture projects
// folder. Appending tool calls to a transcript must reach GET /api/stream as 'beam' events — the repo path
// for a file inside the repo, only an outside count for one outside it, and nothing of the call's content.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn, execFileSync } = require('child_process');

const CITY = path.resolve(__dirname, '..');
const fx = fs.mkdtempSync(path.join(os.tmpdir(), 'kv-agents-'));
const tx = path.join(fx + '-tx', 'projects');
const g = (...a) => execFileSync('git', ['-c', 'user.name=Teszt', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', ...a], { cwd: fx, encoding: 'utf8' });
const put = (p, s) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };
const S1 = '11111111-aaaa-4bbb-8ccc-000000000001', S2 = '22222222-aaaa-4bbb-8ccc-000000000002';
const T1 = path.join(tx, 'H--fixture', S1 + '.jsonl'), T2 = path.join(tx, 'C--elsewhere', S2 + '.jsonl');
const call = (sid, id, name, input, cwd) => JSON.stringify({ type: 'assistant', sessionId: sid, cwd, timestamp: new Date().toISOString(),
  message: { content: [{ type: 'text', text: 'SECRET-REPLY' }, { type: 'tool_use', id, name, input }] } }) + '\n';

let srv = null;
const events = [];
async function start() {
  if (srv) return srv;
  g('init', '-q', '-b', 'main');
  put(path.join(fx, 'a.js'), 'one\n');
  for (const f of ['companion.js', 'scan.js', 'sessions.js', 'agents-poll.js']) put(path.join(fx, 'CodeCity', f), fs.readFileSync(path.join(CITY, f), 'utf8'));
  put(path.join(fx, 'CodeCity', 'dist', 'vrg-codecity.html'), '<!doctype html><html><head></head><body>fixture</body></html>');
  put(path.join(fx, '.gitignore'), 'CodeCity/.companion-token\n');
  g('add', '.'); g('commit', '-q', '-m', 'first');
  const fake = path.join(fx + '-tx', 'agents.js');
  put(fake, 'console.log(JSON.stringify([' +
    `{ id: '11111111', sessionId: '${S1}', cwd: ${JSON.stringify(fx)}, kind: 'background', name: 'P4 teszt', state: 'working', startedAt: Date.now() },` +
    `{ id: '22222222', sessionId: '${S2}', cwd: 'C:\\\\Windows', kind: 'interactive', name: 'masik', state: 'blocked', startedAt: Date.now() }]));\n`);
  put(T1, call(S1, 'old1', 'Read', { file_path: path.join(fx, 'a.js') }, fx));   // history before the page joined: not replayed
  put(T2, '');
  const cfg = path.join(fx + '-tx', 'config.json');
  put(cfg, JSON.stringify({ agentsCmd: [process.execPath, fake], transcripts: [tx] }));
  const env = Object.assign({}, process.env); delete env.KP_DRY_RUN;
  const child = spawn(process.execPath, [path.join(fx, 'CodeCity', 'companion.js'), '--port', '0', '--no-open', '--no-terminal', '--no-watch', '--config', cfg], { env });
  const port = await new Promise((resolve, reject) => {
    let out = '';
    child.stdout.on('data', d => { out += d; const m = out.match(/port (\d+)/); if (m) resolve(+m[1]); });
    child.on('exit', c => reject(new Error('server exited ' + c)));
    setTimeout(() => reject(new Error('server did not start')), 5000);
  });
  srv = { child, port };
  process.on('exit', () => { child.kill(); for (const d of [fx, fx + '-tx']) try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* busy */ } });
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
let raw = '';
function listen(cookie) {
  return new Promise(resolve => {
    const r = http.request({ host: '127.0.0.1', port: srv.port, path: '/api/stream', headers: { Host: '127.0.0.1:' + srv.port, Cookie: cookie } }, res => {
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
      resolve(res.statusCode);
    });
    r.on('error', () => {}); r.end();
    srv.stream = r;
  });
}
const waitFor = (pred, ms) => new Promise(resolve => { const t0 = Date.now(); const tick = () => { const e = events.find(pred); if (e || Date.now() - t0 > ms) resolve(e || null); else setTimeout(tick, 50); }; tick(); });

module.exports = [
  { name: 'agents: a listening page gets both sessions — id, name, state, in the repo or not; no sessionId, no cwd', async fn() {
    await start();
    const page = await get('/');
    const cookie = String((page.headers['set-cookie'] || [''])[0]).split(';')[0];
    assert.strictEqual(await listen(cookie), 200);
    const e = await waitFor(x => x.name === 'agents', 8000);
    assert.ok(e, 'agents event: ' + JSON.stringify(events));
    const [a, b] = e.data.list;
    assert.deepStrictEqual([a.id, a.state, a.inRepo, b.id, b.state, b.inRepo], ['11111111', 'working', true, '22222222', 'blocked', false]);
    assert.ok(!('sid' in a) && !('cwd' in a) && !raw.includes(S1), 'no session id or cwd on the wire');
  } },
  { name: 'agents: new tool calls beam — the repo path for a Read, the folder for a Grep, only a count for outside; no content', async fn() {
    await new Promise(r => setTimeout(r, 1500));   // the tails start at the transcripts' current end
    fs.appendFileSync(T1, call(S1, 'n1', 'Read', { file_path: path.join(fx, 'a.js') }, fx));
    fs.appendFileSync(T1, call(S1, 'n2', 'Grep', { pattern: 'SECRET-PATTERN', path: 'CodeCity' }, fx));
    fs.appendFileSync(T2, call(S2, 'n3', 'Read', { file_path: 'C:\\Windows\\win.ini' }, 'C:\\Windows'));
    const r = await waitFor(x => x.name === 'beam' && x.data.p === 'a.js', 6000);
    assert.ok(r && r.data.id === '11111111' && r.data.kind === 0, 'read beam: ' + JSON.stringify(events.filter(x => x.name === 'beam')));
    const s = await waitFor(x => x.name === 'beam' && x.data.p === 'CodeCity', 3000);
    assert.ok(s && s.data.kind === 1, 'search beam on the folder');
    const o = await waitFor(x => x.name === 'beam' && x.data.outside, 3000);
    assert.ok(o && o.data.id === '22222222' && !('p' in o.data), 'outside: counted, no path');
    assert.ok(!events.some(x => x.name === 'beam' && x.data.p === 'a.js' && events.indexOf(x) < events.indexOf(r)), 'history before joining is not replayed');
    assert.ok(!/SECRET|win\.ini/.test(raw), 'no reply text, no pattern, no outside path on the wire');
    srv.stream.destroy(); srv.child.kill();
  } }
];
