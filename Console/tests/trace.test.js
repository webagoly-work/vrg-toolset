import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify, fromHook, parseJsonl, usageFromTail } from '../www/js/trace/events.js';
import { apply, createTrace, fold, heatOf, HALF_LIFE, visible } from '../www/js/trace/model.js';
import { emptyCounts, scrubEvent } from '../www/js/trace/privacy.js';
import { SAMPLE_EVENTS } from '../www/js/trace/sample.js';
import { replaySource, managedSource } from '../www/js/trace/sources.js';
import { scrubText } from '../www/js/core/redact.js';

const TOOLS = path.join(path.dirname(fileURLToPath(import.meta.url)), '../tools');

test('hook input becomes trace events', () => {
  const pre = fromHook({ hook_event_name: 'PreToolUse', session_id: 'abcdefgh1234', tool_name: 'Read', tool_input: { file_path: 'a/b.js' }, tool_use_id: 't1' }, 5);
  assert.equal(pre.kind, 'call');
  assert.equal(pre.sid, 'abcdefgh');
  assert.equal(pre.file, 'a/b.js');
  assert.equal(pre.agent, 'root');
  const sub = fromHook({ hook_event_name: 'PostToolUseFailure', session_id: 'x', agent_id: 'ab', agent_type: 'Explore', tool_name: 'Bash', error: 'Exit code 1', duration_ms: 9 });
  assert.equal(sub.agent, 'agent:ab');
  assert.equal(sub.error, 'Exit code 1');
  assert.equal(fromHook({ hook_event_name: 'SessionEnd' }), null);
});

test('targets: tools, MCP servers, skills', () => {
  assert.equal(classify('mcp__docs__search').id, 'mcp:docs');
  assert.equal(classify('Skill', { skill: 'debug' }).type, 'skill');
  assert.equal(classify('Edit').id, 'tool:Edit');
});

test('nodes appear on first use, edges carry totals', () => {
  const tr = fold(SAMPLE_EVENTS);
  for (const id of ['root', 'tool:Read', 'tool:Bash', 'skill:debug', 'mcp:docs', 'agent:scout001', 'file:limits.js'.replace('limits.js', 'www/js/core/limits.js')]) assert.ok(tr.nodes.has(id), id);
  const bash = tr.edges.get('root>tool:Bash');
  assert.equal(bash.errors, 1);
  assert.ok(bash.tokens > 0 && bash.ms > 0);
  assert.ok(tr.edges.has('root>agent:scout001'));
  assert.ok(tr.edges.has('agent:scout001>tool:Read'));
  assert.equal(tr.open.size, 0);
});

test('a message counts its tokens once', () => {
  const tr = createTrace();
  const target = { type: 'tool', id: 'tool:X', label: 'X' };
  for (const callId of ['a', 'b']) {
    apply(tr, { t: 1, kind: 'call', agent: 'root', target, callId });
    apply(tr, { t: 2, kind: 'result', agent: 'root', target, callId, usage: { id: 'm1', tokens: 100 } });
  }
  assert.equal(tr.edges.get('root>tool:X').tokens, 100);
});

test('heat fades by half each half-life; worn count stays', () => {
  const tr = createTrace();
  const target = { type: 'tool', id: 'tool:X', label: 'X' };
  apply(tr, { t: 1000, kind: 'call', agent: 'root', target });
  const e = tr.edges.get('root>tool:X');
  assert.ok(Math.abs(heatOf(e, 'calls', 1000 + HALF_LIFE) - 0.5) < 1e-9);
  assert.equal(e.count, 1);
});

test('replay folding is the same as live applying, at any point', () => {
  const live = createTrace();
  SAMPLE_EVENTS.forEach((ev, i) => {
    apply(live, ev);
    if (i % 7 === 0) assert.deepEqual([...fold(SAMPLE_EVENTS, i + 1).edges.keys()], [...live.edges.keys()]);
  });
});

test('filters: agent, type, time window', () => {
  const tr = fold(SAMPLE_EVENTS);
  const agent = visible(tr, { agent: 'agent:scout001' });
  assert.ok(agent.nodes.some((n) => n.id === 'tool:Bash'));
  assert.ok(!agent.nodes.some((n) => n.id === 'mcp:docs'));
  assert.ok(visible(tr, { type: 'mcp' }).nodes.every((n) => ['root', 'mcp', 'agent'].includes(n.type)));
  assert.ok(visible(tr, { windowMs: 1 }).edges.length < tr.edges.size);
});

test('pending questions open and close', () => {
  const tr = createTrace();
  apply(tr, { t: 1, kind: 'pending', callId: 'c' });
  assert.equal(tr.pending.size, 1);
  apply(tr, { t: 2, kind: 'resolved', callId: 'c' });
  assert.equal(tr.pending.size, 0);
});

test('redaction: names, contacts, streets, secrets, job folders', () => {
  const { text, counts } = scrubText('Kiss Béla, 1134 Budapest, Váci út 12/B, +36 30 123 4567, a@b.hu, token=abcd1234efgh, H:\\VRG\\Full\\jobs\\Kiss_Bela\\terv.pdf', { names: ['Kiss Béla'] });
  for (const gone of ['Kiss Béla', 'Váci', '123 4567', 'a@b.hu', 'abcd1234efgh', 'Kiss_Bela']) assert.ok(!text.includes(gone), gone);
  assert.ok(text.includes('Client-A'));
  assert.ok(text.includes('terv.pdf'));
  assert.deepEqual(Object.values(counts).map(Boolean), [true, true, true, true, true]);
  assert.equal(scrubText('npm test --filter a').text, 'npm test --filter a');
});

test('the sample event scrubs and the tally shows it', () => {
  const tally = emptyCounts();
  const clean = SAMPLE_EVENTS.map((e) => scrubEvent(e, [], tally));
  assert.ok(tally.contact >= 1 && tally.address >= 1 && tally.secret >= 1);
  assert.ok(!JSON.stringify(clean).includes('Minta utca'));
  assert.ok(!JSON.stringify(clean).includes('123 4567'));
});

test('a second pass adds nothing but keeps the first pass in the total', () => {
  const first = scrubEvent({ text: 'a@b.hu H:\\jobs\\Kiss\\x' });
  const tally = emptyCounts();
  const again = scrubEvent(first, [], tally);
  assert.equal(again.text, first.text);
  assert.equal(tally.contact, 1);
  assert.equal(tally.path, 1);
});

test('sources share one shape; the managed slot says it is not there yet', () => {
  const got = [];
  const r = replaySource([{ a: 1 }]);
  r.start((e) => got.push(e), () => {});
  assert.equal(got.length, 1);
  let st = '';
  managedSource().start(() => {}, (s) => { st = s; });
  assert.equal(st, 'unavailable');
});

test('usage comes from the newest transcript line; bad lines are skipped', () => {
  const tail = '{"type":"assistant","message":{"id":"a","usage":{"input_tokens":1,"output_tokens":2}}}\n{"message":{"id":"b","usage":{"input_tokens":3,"output_tokens":4}}}\n{"usage": broken';
  assert.deepEqual(usageFromTail(tail), { id: 'b', tokens: 7 });
  assert.equal(parseJsonl('{"v":1,"kind":"call"}\n{"half').length, 1);
});

const startRelay = (dir, port) => new Promise((resolve) => {
  const p = spawn(process.execPath, [path.join(TOOLS, 'trace-relay.js')], { env: { ...process.env, VC_TRACE_DIR: dir, VC_TRACE_PORT: String(port) } });
  p.stdout.on('data', (d) => { if (String(d).includes('Pairing code')) resolve(p); });
});

const runHook = (dir, port, input, args = []) => new Promise((resolve) => {
  const p = spawn(process.execPath, [path.join(TOOLS, 'trace-hook.js'), ...args], { env: { ...process.env, VC_TRACE_DIR: dir, VC_TRACE_PORT: String(port) } });
  let out = '';
  p.stdout.on('data', (d) => { out += d; });
  p.on('close', (code) => resolve({ code, out }));
  p.stdin.end(JSON.stringify(input));
});

test('hook with no relay: exit 0, silent, trace on disk, already scrubbed', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vc-trace-'));
  const r = spawnSync(process.execPath, [path.join(TOOLS, 'trace-hook.js'), '--gate=Bash'], {
    input: JSON.stringify({ hook_event_name: 'PreToolUse', session_id: 'sess0001', tool_name: 'Bash', tool_input: { command: 'curl a@b.hu' } }),
    env: { ...process.env, VC_TRACE_DIR: dir, VC_TRACE_PORT: '18139' }, encoding: 'utf8',
  });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
  assert.ok(!fs.readFileSync(path.join(dir, 'sess0001.jsonl'), 'utf8').includes('a@b.hu'));
  assert.equal(spawnSync(process.execPath, [path.join(TOOLS, 'trace-hook.js')], { input: 'not json', encoding: 'utf8' }).status, 0);
});

test('relay: a request needs the code, the right host and an allowed origin', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vc-trace-'));
  const port = 18135;
  const relay = await startRelay(dir, port);
  try {
    const code = fs.readFileSync(path.join(dir, '.code'), 'utf8').trim();
    const base = `http://127.0.0.1:${port}`;
    assert.equal((await fetch(base + '/ping')).status, 401);
    assert.equal((await fetch(base + '/ping', { headers: { 'x-trace-code': 'wrong' } })).status, 401);
    assert.equal((await fetch(base + '/ping', { headers: { 'x-trace-code': code } })).status, 200);
    assert.equal((await fetch(base + '/ping', { headers: { 'x-trace-code': code, origin: 'https://evil.example' } })).status, 403);
  } finally { relay.kill(); }
});

test('gate and prompt: approve reaches the hook, a queued prompt comes back at Stop', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vc-trace-'));
  const port = 18136;
  const relay = await startRelay(dir, port);
  try {
    const code = fs.readFileSync(path.join(dir, '.code'), 'utf8').trim();
    const base = `http://127.0.0.1:${port}`;
    const headers = { 'x-trace-code': code, 'content-type': 'application/json' };
    const noViewer = await runHook(dir, port, { hook_event_name: 'PreToolUse', session_id: 's1', tool_name: 'Bash', tool_use_id: 'u0', tool_input: { command: 'ls' } }, ['--gate=Bash']);
    assert.equal(noViewer.out, '');

    const stream = await fetch(base + '/stream?code=' + code);
    const reader = stream.body.getReader();
    const hook = runHook(dir, port, { hook_event_name: 'PreToolUse', session_id: 's1', tool_name: 'Bash', tool_use_id: 'u1', tool_input: { command: 'rm x' } }, ['--gate=Bash']);
    let seen = '';
    while (!seen.includes('"pending"')) seen += new TextDecoder().decode((await reader.read()).value);
    await fetch(base + '/answer', { method: 'POST', headers, body: JSON.stringify({ callId: 'u1', decision: 'deny', note: 'nem' }) });
    const out = JSON.parse((await hook).out);
    assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
    assert.equal(out.hookSpecificOutput.permissionDecisionReason, 'nem');

    await fetch(base + '/prompt', { method: 'POST', headers, body: JSON.stringify({ sid: 's1', text: 'Folytasd' }) });
    const stop = JSON.parse((await runHook(dir, port, { hook_event_name: 'Stop', session_id: 's1' })).out);
    assert.deepEqual(stop, { decision: 'block', reason: 'Folytasd' });
    assert.equal((await runHook(dir, port, { hook_event_name: 'Stop', session_id: 's1' })).out, '');
    reader.cancel();
  } finally { relay.kill(); }
});
