#!/usr/bin/env node
/* The session model, run outside the browser: it is the block between model:begin / model:end in
   vrg-munkavaszon.html. Fed the page's own demo session, then (optionally) a real transcript:
     node SessionCanvas/test/model.test.js [transcript.jsonl ...]                          */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const page = fs.readFileSync(path.join(__dirname, '..', 'vrg-munkavaszon.html'), 'utf8');
const src = page.slice(page.indexOf('/* model:begin */'), page.indexOf('/* model:end */'));
const box = { module: { exports: null } };
vm.runInNewContext(src + '\nmodule.exports = SCModel;', box);
const SC = box.module.exports;

let bad = 0;
const ok = (c, msg) => { console.log((c ? 'ok   ' : 'FAIL ') + msg); if (!c) bad++; };

const now = Date.parse('2026-11-20T12:00:00Z');
const m = SC.create();
SC.demo(now).forEach((x) => m.add(x.line, x.agent));
const S = m.S;
const calls = [...S.calls.values()];
ok(S.t0 === now - 27 * 60000 && S.tEnd <= now + 60000, 'demo spans its 27 minutes');
ok(S.turns === 3 && /CSV-exportot/.test(S.title), 'three prompts, the first is the title');
ok(calls.length >= 50, calls.length + ' tool calls');
ok(calls.every((c) => c.tEnd != null), 'every call got its result');
ok(calls.filter((c) => c.error).length === 1, 'the failing test is the one error');
ok(SC.catOf('mcp__vrg-stack__stack_search') === 'mcp' && SC.catOf('Edit') === 'edit' && SC.catOf('Nope') === 'other', 'kinds');
const build = calls.find((c) => c.name === 'Bash' && c.input.run_in_background);
ok(build && build.bg && build.bgId === 'bdemo1' && build.bgEnd > build.tEnd, 'background build: launched, then closed by its notification');
const agent = calls.find((c) => c.name === 'Agent');
ok(agent && agent.bg && agent.bgEnd != null, 'background agent closed by its notification');
ok(agent && agent.sub === 'a:a1demo' && S.agents.get('a:a1demo').n === 2, 'the subagent file is linked to its Agent call (2 calls)');
ok(S.tasks.size === 6 && [...S.tasks.values()].every((k) => k.subject.length > 5), 'six tasks with their subjects');
const p0 = m.progressAt(now);
ok(p0.done === 6 && p0.total === 6, 'all tasks done at the end');
const mid = S.tasks.get('2').hist.find((h) => h.status === 'in_progress').t + 5000;
const p1 = m.progressAt(mid);
ok(p1.done === 1 && p1.inprog.length === 1 && p1.eta > 0 && p1.avg > 0, 'mid-way: 1 of 3 done, ETA ' + Math.round(p1.eta / 1000) + ' s');
ok(m.progressAt(S.t0 + 1000).total === 0, 'before the first TaskCreate: no tasks');
ok(m.stateAt(now).state === 'idle', 'end: idle, your turn');
ok(m.stateAt(build.tEnd + 2000).bg.some((c) => c === build), 'background build open after its launch');
const b1 = calls.find((c) => c.name === 'Bash' && c.error);
ok(m.stateAt(b1.t + 1000).state === 'tool', 'during the test run: running a tool');
ok(m.expected(calls.find((c) => c.name === 'Bash')) > 0, 'expected Bash time from the finished ones');
ok(S.totals.add > 100 && S.totals.rem > 0, 'edited lines +' + S.totals.add + ' -' + S.totals.rem);
ok(S.items.filter((i) => i.kind === 'think').length >= 6, 'thinking blocks are items');
ok(S.items.filter((i) => i.kind === 'note' && i.note === 'bg').length === 2, 'two background-done notes');

// commands
const kinds = { '/deep-research': 'research', 'GO MAIN': 'go', '/batch': 'batch', '/plan': 'plan', '/code-review': 'review',
  '/compact': 'context', '/config': 'config', 'engineering:debug': 'build', '/frobnicate': 'command', 'anthropic-skills:deep-research': 'research' };
for (const [k, v] of Object.entries(kinds)) ok(SC.cmdKind(k) === v, `kind of ${k} = ${v} (${SC.cmdKind(k)})`);
ok(SC.cmdKind('dataviz', 'skill') === 'skill', 'an unknown skill stays a skill');
const plan = S.cmds.find((c) => c.kind === 'plan');
ok(plan && plan.tEnd != null && /CSV-író/.test(plan.plan), 'plan mode: opened by the prompt, closed by the approved ExitPlanMode, plan kept');
const dr = S.cmds.find((c) => c.name === '/deep-research');
ok(dr && dr.kind === 'research' && /CSV-könyvtár/.test(dr.args) && dr.tEnd > dr.t, '/deep-research: a research command until its turn ends');
ok(S.cmds.length === 2, 'two commands (plan mode, /deep-research): ' + S.cmds.map((c) => c.name));
// parallel groups
const G = m.groups(now), research = G.find((g) => g.calls.length === 4);
ok(research && research.name === 'research' && research.cmd === dr, 'the four Agent calls of one message are one research fan-out under /deep-research');
ok(research.agents.every((a) => a && a.parent), 'every researcher is linked to its transcript');
const writer = G.find((g) => g.name === 'write');
ok(writer && writer.cmd === dr && writer.agents[0] && writer.agents[0].n === 5, 'the report writer is its own step (5 calls)');
const fastest = Math.min(...research.calls.map((c) => c.tEnd)), slowest = Math.max(...research.calls.map((c) => c.tEnd));
const gs = m.groupStats(research, fastest + 1000);
ok(gs.done === 1 && gs.n === 4 && gs.eta > 0 && gs.end == null, `after the first researcher: 1/4 done, ETA ${Math.round(gs.eta / 1000)} s`);
const ge = m.groupStats(research, slowest + 10);
ok(ge.done === 4 && ge.end === slowest && ge.eta == null, 'all four done: the join is the slowest one');
const cs = m.cmdStats(dr, fastest + 1000);
ok(cs.agents === 4 && cs.agentsDone === 1 && cs.running, 'the command counts its agents mid-way');
const w = m.agentWork(research.agents[3], now);
ok(w.search === 3 && w.fetch === 2 && w.write === 1 && /jegyzet kész/.test(w.last.text), 'a researcher\'s work by kind and its last words');
// images
ok(S.images.length === 2 && S.images.every((i) => i.data && i.mime === 'image/svg+xml'), 'two screenshots taken from tool results');
ok(S.images.some((i) => i.agent === 'a:r1'), 'one of them inside a researcher');
ok(S.images.find((i) => i.agent === 'root').ref === calls.find((c) => c.name === 'Read' && c.input.file_path === 'export.png').id, 'the screenshot points at the Read that returned it');
const wm = SC.workflowMeta("export const meta = { name: 'review-changes', description: 'x', phases: [{ title: 'Review' }, { title: 'Verify', detail: 'y' }] }\nagent(p, {label: `verify:${f.file}`})");
ok(wm.name === 'review-changes' && wm.phases.join() === 'Review,Verify' && wm.labels[0] === 'verify:*', 'workflow meta read from the script text');

// a new prompt closes what the turn left open
const m2 = SC.create();
const L = (o) => m2.add(JSON.stringify(o));
L({ type: 'user', timestamp: '2026-11-20T10:00:00Z', message: { content: 'go' } });
L({ type: 'assistant', timestamp: '2026-11-20T10:00:05Z', message: { id: 'a', content: [{ type: 'tool_use', id: 'x', name: 'Bash', input: { command: 'sleep 99' } }] } });
L({ type: 'user', timestamp: '2026-11-20T10:01:00Z', message: { content: '[Request interrupted by user]' } });
L({ type: 'user', timestamp: '2026-11-20T10:01:10Z', message: { content: 'other' } });
ok(m2.S.calls.get('x').interrupted && m2.S.calls.get('x').tEnd != null, 'an interrupted call is closed by the next prompt');
m2.add('{broken'); ok(m2.S.bad === 1, 'a broken line is counted, not thrown');
L({ type: 'user', timestamp: '2026-11-20T10:02:00Z', message: { content: '/home/user/x.txt nézd meg' } });
L({ type: 'user', timestamp: '2026-11-20T10:03:00Z', message: { content: [{ type: 'text', text: 'GO PLANNER' }, { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'iVBORw0KGgo=' } }] } });
L({ type: 'assistant', timestamp: '2026-11-20T10:03:30Z', message: { id: 'b', stop_reason: 'end_turn', content: [{ type: 'text', text: 'ok' }] } });
L({ type: 'user', timestamp: '2026-11-20T10:04:00Z', message: { content: '/batch migrate all tests' } });
ok(m2.S.cmds.map((c) => c.name + ':' + c.kind).join() === 'GO PLANNER:go,/batch:batch', 'a path is not a command; GO and /batch are: ' + m2.S.cmds.map((c) => c.name));
ok(m2.S.cmds[0].tEnd != null && m2.S.cmds[1].tEnd == null, 'the GO turn ended, /batch still runs');
ok(m2.S.images.length === 1 && m2.S.images[0].from === 'prompt', 'a pasted image in a prompt');

for (const f of process.argv.slice(2)) {
  const r = SC.create(), t0 = Date.now();
  fs.readFileSync(f, 'utf8').split('\n').forEach((l) => r.add(l, /agent-/.test(path.basename(f)) ? path.basename(f, '.jsonl') : 'root'));
  const R = r.S, st = r.stateAt(R.tEnd), pr = r.progressAt(R.tEnd);
  console.log(`\n${path.basename(f)}: ${R.lines} lines (${R.bad} bad) in ${Date.now() - t0} ms · ${R.turns} prompts · ${R.calls.size} calls · ` +
    `${R.items.filter((i) => i.kind === 'say').length} texts · ${R.items.filter((i) => i.kind === 'think').length} thinking · ` +
    `tasks ${pr.done}/${pr.total} · out ${R.totals.out} tok · ctx max ${R.ctxMax} · state ${st.state} · open ${st.fg.map((c) => c.name)}`);
  const kinds = {}; R.calls.forEach((c) => { kinds[c.cat] = (kinds[c.cat] || 0) + 1; }); console.log('  kinds', JSON.stringify(kinds));
  const bgs = [...R.calls.values()].filter((c) => c.bg); console.log('  background', bgs.map((c) => c.name + ':' + (c.bgEnd ? 'done' : 'open')).join(' '));
}
console.log(bad ? `\n${bad} FAILED` : '\nall ok');
process.exit(bad ? 1 : 0);
