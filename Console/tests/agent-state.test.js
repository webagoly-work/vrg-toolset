import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { emptyState, noticeFor, sessionState, step, stillHolds } from '../www/js/trace/state.js';
import { chime, message, parseArgs, run, settings, where } from '../tools/agent-notify.js';

const TOOLS = path.join(path.dirname(fileURLToPath(import.meta.url)), '../tools');
const ev = (t, kind, more = {}) => ({ v: 1, t, sid: 'abcd1234', agent: 'root', kind, ...more });

test('a turn goes working → blocked on a permission prompt → working → idle', () => {
  let s = emptyState();
  s = step(s, ev(1000, 'prompt'));
  assert.equal(s.state, 'working');
  s = step(s, ev(2000, 'call', { tool: 'Bash' }));
  s = step(s, ev(2100, 'notice', { notice: 'permission_prompt', text: 'Claude needs your permission to use Bash' }));
  assert.equal(s.state, 'blocked');
  assert.equal(s.why, 'permission');
  assert.equal(s.since, 2100);
  s = step(s, ev(9000, 'result', { tool: 'Bash' }));
  assert.equal(s.state, 'working');
  s = step(s, ev(70000, 'stop'));
  assert.equal(s.state, 'idle');
  assert.equal(s.turnAt, 1000);
});

test('questions and plans block; a subagent working meanwhile does not unblock', () => {
  let s = sessionState([ev(1, 'prompt'), ev(2, 'call', { tool: 'AskUserQuestion' })]);
  assert.deepEqual([s.state, s.why], ['blocked', 'question']);
  s = step(s, ev(3, 'call', { tool: 'Read', agent: 'agent:x' }));
  s = step(s, ev(4, 'result', { tool: 'Read', agent: 'agent:x' }));
  assert.equal(s.state, 'blocked');
  s = step(s, ev(5, 'result', { tool: 'AskUserQuestion' }));
  assert.equal(s.state, 'working');
  assert.equal(sessionState([ev(1, 'call', { tool: 'ExitPlanMode' })]).why, 'plan');
  assert.equal(sessionState([ev(1, 'pending', { tool: 'Bash' })]).why, 'approval');
  assert.equal(sessionState([ev(1, 'prompt'), ev(2, 'notice', { notice: 'idle_prompt' })]).state, 'working');
});

test('a turn that ends with background subagents running is waiting, not idle', () => {
  let s = sessionState([ev(1, 'prompt'), ev(2, 'agent-start', { agent: 'agent:a' }), ev(3, 'stop')]);
  assert.equal(s.state, 'waiting');
  s = sessionState([ev(4, 'agent-stop', { agent: 'agent:a' }), ev(5, 'call', { tool: 'Read' }), ev(6, 'stop')], s);
  assert.equal(s.state, 'idle');
  /* a subagent's stop is not the session's */
  assert.equal(sessionState([ev(1, 'prompt'), ev(2, 'stop', { agent: 'agent:a' })]).state, 'working');
});

test('only a new block or a long turn ending is worth a ping', () => {
  const working = sessionState([ev(1000, 'prompt'), ev(2000, 'call', { tool: 'Bash' })]);
  const notice = ev(2100, 'notice', { notice: 'permission_prompt' });
  assert.deepEqual(noticeFor(working, step(working, notice), notice), { kind: 'blocked', why: 'permission' });
  const blocked = step(working, notice);
  const again = ev(2200, 'notice', { notice: 'permission_prompt' });
  assert.equal(noticeFor(blocked, step(blocked, again), again), null);
  const quick = ev(30000, 'stop');
  assert.equal(noticeFor(working, step(working, quick), quick), null);
  const long = ev(91000, 'stop');
  assert.deepEqual(noticeFor(working, step(working, long), long), { kind: 'done', ms: 90000 });
  assert.equal(noticeFor(working, step(working, quick), quick, { doneAfterMs: 0 }).kind, 'done');
});

test('a ping still holds only while the same episode is on', () => {
  const idle = sessionState([ev(1, 'prompt'), ev(5, 'stop')]);
  assert.equal(stillHolds(idle, 'done', 5), true);
  assert.equal(stillHolds(step(idle, ev(7, 'prompt')), 'done', 5), false);
  const blocked = sessionState([ev(1, 'prompt'), ev(2, 'notice', { notice: 'permission_prompt' })]);
  assert.equal(stillHolds(blocked, 'blocked', 2), true);
  const reblocked = sessionState([ev(3, 'result'), ev(4, 'notice', { notice: 'permission_prompt' })], blocked);
  assert.equal(stillHolds(reblocked, 'blocked', 2), false);
});

test('notice text, folder names and the chime', () => {
  assert.equal(where('H:\\VRG\\Full\\Planner_VRG_U100\\.claude\\worktrees\\starred-repos-95735d'), 'starred-repos-95735d');
  assert.equal(where('H:/VRG/Full/Planner_VRG_U100'), 'Planner_VRG_U100');
  assert.equal(where(undefined), '');
  const b = message({ kind: 'blocked', why: 'permission', where: 'Planner', text: 'Bash' });
  assert.deepEqual(b, { title: 'Claude vár rád · Planner', text: 'A munkamenet engedélyre vár: Bash', level: 'info', from: 'claude' });
  const d = message({ kind: 'done', ms: 300000, where: '', text: 'Kész a  teszt.' });
  assert.equal(d.title, 'Claude kész');
  assert.equal(d.text, '5 perc munka után. Kész a teszt.');
  assert.equal(d.level, 'good');
  const wav = chime('done');
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
  assert.equal(wav.readUInt32LE(40), wav.length - 44);
  assert.ok(wav.length > 5000 && wav.length < 20000);
  assert.deepEqual(parseArgs(['--sid', 'a', '--kind', 'done']), { sid: 'a', kind: 'done' });
});

function tracesWith(events, cfg) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vc-notify-'));
  fs.writeFileSync(path.join(dir, 'abcd1234.jsonl'), events.map((e) => JSON.stringify(e)).join('\n') + '\n');
  if (cfg) fs.writeFileSync(path.join(dir, 'notify.json'), JSON.stringify(cfg));
  return dir;
}

test('the notifier chimes, then pings the phone, and stops when you came back', async () => {
  const calls = [];
  const io = { sleep: async () => {}, play: async (f) => { calls.push(['play', path.basename(f)]); }, phone: async (port, body) => { calls.push(['phone', port, body.title]); return 200; } };
  const dir = tracesWith([ev(1000, 'prompt'), ev(2000, 'notice', { notice: 'permission_prompt' })]);
  const did = await run({ sid: 'abcd1234', kind: 'blocked', at: '2000', why: 'permission', where: 'P', text: 'Bash' }, { dir, io });
  assert.deepEqual(did, ['sound', 'phone']);
  assert.deepEqual(calls, [['play', 'blocked.wav'], ['phone', 47291, 'Claude vár rád · P']]);
  assert.ok(fs.existsSync(path.join(dir, 'sounds', 'blocked.wav')));

  /* answered before the delay ran out: silent */
  fs.appendFileSync(path.join(dir, 'abcd1234.jsonl'), JSON.stringify(ev(2500, 'result', { tool: 'Bash' })) + '\n');
  assert.deepEqual(await run({ sid: 'abcd1234', kind: 'blocked', at: '2000' }, { dir, io }), []);

  /* settings: phone off, and VC_NOTIFY=0 turns everything off */
  const quiet = tracesWith([ev(1, 'prompt'), ev(5, 'stop')], { phone: false });
  assert.deepEqual(await run({ sid: 'abcd1234', kind: 'done', at: '5' }, { dir: quiet, io }), ['sound']);
  process.env.VC_NOTIFY = '0';
  try { assert.deepEqual(settings(quiet), { ...settings(dir), sound: false, phone: false }); } finally { delete process.env.VC_NOTIFY; }

  /* a relay that is not running is no error */
  const off = { ...io, phone: async () => null };
  assert.deepEqual(await run({ sid: 'abcd1234', kind: 'done', at: '5' }, { dir: quiet, io: off }), ['sound']);
});

test('the hook starts the notifier, which outlives it and reaches the phone relay', async () => {
  const got = [];
  const relay = http.createServer((req, res) => {
    let b = '';
    req.on('data', (d) => { b += d; });
    req.on('end', () => { got.push({ path: req.url, host: req.headers.host, body: JSON.parse(b) }); res.end('{"ok":true}'); });
  });
  await new Promise((r) => relay.listen(0, '127.0.0.1', r));
  const port = relay.address().port;
  try {
    const dir = tracesWith([ev(Date.now() - 120000, 'prompt'), ev(Date.now() - 110000, 'call', { tool: 'Bash' })], { sound: false, phone: true, phoneDelaySec: 0, port });
    const hook = (h) => spawnSync(process.execPath, [path.join(TOOLS, 'trace-hook.js')], { input: JSON.stringify(h), env: { ...process.env, VC_TRACE_DIR: dir, VC_TRACE_PORT: '1' }, encoding: 'utf8' });
    const r = hook({ hook_event_name: 'Stop', session_id: 'abcd1234xyz', cwd: 'H:/x/Planner', last_assistant_message: 'Megvan.' });
    assert.equal(r.status, 0);
    assert.equal(r.stdout, '');
    const lines = fs.readFileSync(path.join(dir, 'abcd1234.jsonl'), 'utf8').trim().split('\n');
    assert.equal(JSON.parse(lines.at(-1)).kind, 'stop');
    for (let i = 0; i < 100 && !got.length; i++) await new Promise((res) => setTimeout(res, 100));
    assert.equal(got.length, 1);
    assert.equal(got[0].path, '/notify');
    assert.equal(got[0].host, `localhost:${port}`);
    assert.equal(got[0].body.title, 'Claude kész · Planner');
    assert.match(got[0].body.text, /^2 perc munka után\. Megvan\.$/);

    /* a quick turn, and anything with everything off, starts nothing */
    hook({ hook_event_name: 'UserPromptSubmit', session_id: 'abcd1234xyz', prompt: 'még egyet' });
    hook({ hook_event_name: 'Stop', session_id: 'abcd1234xyz', cwd: 'H:/x/Planner' });
    fs.writeFileSync(path.join(dir, 'notify.json'), JSON.stringify({ sound: false, phone: false, port }));
    hook({ hook_event_name: 'Notification', session_id: 'abcd1234xyz', notification_type: 'permission_prompt', message: 'x' });
    await new Promise((res) => setTimeout(res, 1500));
    assert.equal(got.length, 1);
  } finally {
    relay.close();
  }
});
