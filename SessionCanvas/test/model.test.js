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
ok(S.t0 === now - 16 * 60000 && S.tEnd <= now + 60000, 'demo spans its 16 minutes');
ok(S.turns === 2 && /CSV-exportot/.test(S.title), 'two prompts, the first is the title');
ok(calls.length >= 30, calls.length + ' tool calls');
ok(calls.every((c) => c.tEnd != null), 'every call got its result');
ok(calls.filter((c) => c.error).length === 1, 'the failing test is the one error');
ok(SC.catOf('mcp__vrg-stack__stack_search') === 'mcp' && SC.catOf('Edit') === 'edit' && SC.catOf('Nope') === 'other', 'kinds');
const build = calls.find((c) => c.input.run_in_background);
ok(build && build.bg && build.bgId === 'bdemo1' && build.bgEnd > build.tEnd, 'background build: launched, then closed by its notification');
const agent = calls.find((c) => c.name === 'Agent');
ok(agent && agent.bg && agent.bgEnd != null, 'background agent closed by its notification');
ok(agent && agent.sub === 'a:a1demo' && S.agents.get('a:a1demo').n === 2, 'the subagent file is linked to its Agent call (2 calls)');
ok(S.tasks.size === 4 && [...S.tasks.values()].every((k) => k.subject.length > 5), 'four tasks with their subjects');
const p0 = m.progressAt(now);
ok(p0.done === 4 && p0.total === 4, 'all tasks done at the end');
const mid = S.tasks.get('3').hist.find((h) => h.status === 'in_progress').t + 5000;
const p1 = m.progressAt(mid);
ok(p1.done === 2 && p1.inprog.length === 1 && p1.eta > 0 && p1.avg > 0, 'mid-way: 2 of 4 done, ETA ' + Math.round(p1.eta / 1000) + ' s');
ok(m.progressAt(S.t0 + 1000).total === 0, 'before the first TaskCreate: no tasks');
ok(m.stateAt(now).state === 'idle', 'end: idle, your turn');
ok(m.stateAt(build.tEnd + 2000).bg.some((c) => c === build), 'background build open after its launch');
const b1 = calls.find((c) => c.name === 'Bash' && c.error);
ok(m.stateAt(b1.t + 1000).state === 'tool', 'during the test run: running a tool');
ok(m.expected(calls.find((c) => c.name === 'Bash')) > 0, 'expected Bash time from the finished ones');
ok(S.totals.add > 100 && S.totals.rem > 0, 'edited lines +' + S.totals.add + ' -' + S.totals.rem);
ok(S.items.filter((i) => i.kind === 'think').length >= 6, 'thinking blocks are items');
ok(S.items.filter((i) => i.kind === 'note' && i.note === 'bg').length === 2, 'two background-done notes');
// a new prompt closes what the turn left open
const m2 = SC.create();
const L = (o) => m2.add(JSON.stringify(o));
L({ type: 'user', timestamp: '2026-11-20T10:00:00Z', message: { content: 'go' } });
L({ type: 'assistant', timestamp: '2026-11-20T10:00:05Z', message: { id: 'a', content: [{ type: 'tool_use', id: 'x', name: 'Bash', input: { command: 'sleep 99' } }] } });
L({ type: 'user', timestamp: '2026-11-20T10:01:00Z', message: { content: '[Request interrupted by user]' } });
L({ type: 'user', timestamp: '2026-11-20T10:01:10Z', message: { content: 'other' } });
ok(m2.S.calls.get('x').interrupted && m2.S.calls.get('x').tEnd != null, 'an interrupted call is closed by the next prompt');
m2.add('{broken'); ok(m2.S.bad === 1, 'a broken line is counted, not thrown');

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
