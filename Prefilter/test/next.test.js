// The Előszűrő's next steps (2026-11-25): negation, work-line memory (prior), the UserPromptSubmit hook, the evaluation tools.
// Runs on the real repo index (cached in a temp folder); no network, nothing written outside temp folders.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), os = require('os'), path = require('path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'vrg-pf-next-'));
process.env.VRG_PREFILTER_CACHE = TMP;                                  // hook state, log and labels go here
const pf = require('../prefilter.js');
const hook = require('../hook.js');
const ev = require('../eval.js');
const REPO = path.resolve(__dirname, '..', '..');
const index = pf.loadIndex({ repo: REPO, full: path.join(TMP, 'no-full'), cacheDir: TMP });

test('negation: a negated name is damped and never an anchor; the same name without negation still anchors', () => {
  const neg = pf.analyze('ne a Plannerről beszéljünk, hanem a napelem inverterről', { index });
  assert.strictEqual(neg.verdict, 'independent', JSON.stringify(neg.signals));
  assert.ok(neg.signals.filter(s => /Planner/.test(s.text)).every(s => s.negated));
  assert.ok(!neg.anchors.some(a => /planner/i.test(a.title)));
  assert.match(neg.reasons.join(' '), /tagadva/);
  const pos = pf.analyze('beszéljünk a Plannerről', { index });
  assert.ok(pos.anchors.some(a => /planner/i.test(a.title)));
  assert.ok(pf.analyze('without the Planner, explain Dijkstra', { index }).signals.filter(s => /Planner/.test(s.text)).every(s => s.negated));
  assert.ok(pf.analyze('a Kapu nélkül', { index }).signals.filter(s => /Kapu/.test(s.text)).every(s => s.negated));
  const toks = pf.tokenize('ne a Plannert');
  assert.deepStrictEqual(pf.negationRanges(toks, { before: ['ne'], window: 3 }), [[3, 13]]);
});

test('prior: a bare "folytasd" takes the previous session\'s anchors; a prompt with its own anchors ignores it', () => {
  const bare = pf.analyze('folytasd', { index });
  assert.strictEqual(bare.verdict, 'unsure');
  const withPrior = pf.analyze('folytasd', { index, prior: { text: 'GO MOBILE folytasd az M16-ot', title: 'GO MOBILE M16' } });
  assert.strictEqual(withPrior.verdict, 'context', JSON.stringify(withPrior.signals));
  assert.ok(withPrior.anchors.some(a => a.title === 'GO MOBILE'));
  assert.match(withPrior.reasons.join(' '), /előző munkamenet: GO MOBILE M16/);
  const own = pf.analyze('folytasd a Kapu belépést', { index, prior: { text: 'GO MOBILE M16' } });
  assert.ok(!own.signals.some(s => s.kind === 'prior'));
  const anchorsGiven = pf.analyze('continue', { index, prior: { anchors: [{ id: 'planner', title: 'Varler Planner', kind: 'catalog', source: 'catalog' }] } });
  assert.ok(anchorsGiven.anchors.some(a => a.id === 'planner'));
  const noDeictic = pf.analyze('köszi', { index, prior: { text: 'GO MOBILE' } });
  assert.ok(!noDeictic.signals.some(s => s.kind === 'prior'));
});

test('hook: first prompt dressed, later ones quiet unless something new; dressed / slash / garbage left alone', () => {
  let st = null;
  const step = p => { const r = hook.judge(pf, index, p, st); st = r.state; return r; };
  const r1 = step('GO MOBILE hol tartunk az M16-tal?');
  assert.match(r1.context, /^\[VRG Előszűrő · kontextusfüggő/);
  assert.ok(r1.context.length < 9000);
  assert.strictEqual(step('folytasd').context, '');
  const r3 = step('és most nézzük a Kapu belépést');
  assert.match(r3.context, /új horgony\] Ez a kérés új területet érint: Kapu\./);
  assert.strictEqual(step('a Kapuban a jelszó mező').context, '');           // Kapu is known now
  assert.strictEqual(step('köszi, jó így').context, '');
  st = null;
  assert.match(step("what's the capital of Peru").context, /önálló kérés/);
  assert.match(step('javítsd a Planner routert').context, /eddig önálló volt/);
  assert.strictEqual(hook.judge(pf, index, '/compact', null).context, '');
  const dressed = hook.judge(pf, index, '[VRG Előszűrő · kontextusfüggő kérés]\nvalami\n\nGO MOBILE', null);
  assert.deepStrictEqual([dressed.context, dressed.rec.skip], ['', 'dressed']);
  assert.strictEqual(hook.run('not json'), '');
  assert.strictEqual(hook.run(JSON.stringify({ session_id: '../x', prompt: 'GO MOBILE' })), '');
  const out = JSON.parse(hook.run(JSON.stringify({ session_id: 'hook-test-1', prompt: 'GO PLANNER hol tart a C6?', hook_event_name: 'UserPromptSubmit' })));
  assert.strictEqual(out.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
  assert.match(out.hookSpecificOutput.additionalContext, /GO-PLANNER\.md/);
  const logged = fs.readFileSync(path.join(TMP, 'log.jsonl'), 'utf8');
  assert.ok(!logged.includes('hol tart a C6'), 'the log never holds the prompt text');
  process.env.VRG_PREFILTER_OFF = '1';
  assert.strictEqual(hook.run(JSON.stringify({ session_id: 'hook-test-2', prompt: 'GO PLANNER' })), '');
  delete process.env.VRG_PREFILTER_OFF;
  const e = hook.settingsEntry();
  assert.match(e.hooks[0].command, /hook\.js$/);
  assert.strictEqual(e.hooks[0].type, 'command');
  assert.strictEqual(hook.install({ dry: true }).entry.hooks[0].timeout, 10);
});

test('eval: cost weights, threshold fit, first prompt, labels; the seed set stays above its floor', () => {
  const rows = [{ text: 'a', label: 'context', score: 0.9 }, { text: 'b', label: 'context', score: 0.4 }, { text: 'c', label: 'independent', score: 0.1 }, { text: 'd', label: 'independent', score: 0.6 }];
  const e = ev.evaluate(rows, { context: 0.55, independent: 0.3 });
  assert.deepStrictEqual([e.n, e.correct, e.cost], [4, 2, 1.3]);
  assert.strictEqual(e.table.context.unsure, 1);
  const f = ev.fitThresholds(rows, { context: 0.55, independent: 0.3 });
  assert.ok(f.cost <= e.cost);
  assert.strictEqual(ev.firstPrompt(['{"type":"user","isMeta":true,"message":{"content":"x"}}', '{"type":"user","message":{"content":"<command-name>/clear</command-name>"}}',
    '{"type":"user","message":{"content":[{"type":"text","text":"  GO MOBILE  "}]}}'].join('\n')), 'GO MOBILE');
  assert.strictEqual(ev.firstPrompt('{"type":"user","message":{"content":"/compact"}}'), '');
  assert.ok(ev.appendLabel({ text: 'GO MOBILE', label: 'context', source: 'override', verdict: 'unsure' }));
  assert.ok(!ev.appendLabel({ text: 'x', label: 'maybe' }));
  assert.strictEqual(ev.sets('mine')[0].label, 'context');
  // the seed set: a floor, and never the expensive mistake (a context prompt judged independent)
  const pfRules = pf.loadRules();
  const seed = ev.sets('seed').map(r => ({ ...r, score: pf.analyze(r.text, { index }).score }));
  assert.ok(seed.length >= 40);
  const s = ev.evaluate(seed, pfRules.thresholds);
  assert.ok(s.accuracy >= 0.85, 'seed accuracy ' + s.accuracy + ' ' + JSON.stringify(s.misses.map(m => m.text)));
  assert.strictEqual(s.table.context.independent, 0, JSON.stringify(s.misses));
});
