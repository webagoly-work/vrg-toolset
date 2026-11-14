// node --test tools/test/council-debate.test.js
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { check, skeleton, parse } = require('../council-debate.js');

const GOOD = `# Debate: Should the Mobile relay keep its own pairing code?

- date: 2026-11-14
- seats: elsie, charlotte
- class: G3, asked the Founder 2026-11-14
- decides: COUNCIL-Q99

## R1 Restate
Question: keep a separate pairing code for the phone relay, or share the Console's?
Options: A keep separate / B share one / C no code on localhost
Out of scope: the cloud ring
Done when: one option, with what would make us reverse it

## R2 Positions
### elsie
Stance: A
- [FACT: docs/council/03_COUNCIL-CHARTER.md:89] the Hand checks usage at the start of each round
- [INFERENCE: from the line above] a second code costs one more prompt per pairing
- [ASSUMPTION] nobody pairs more than two phones

### charlotte
Stance: B
- [FACT: CLAUDE.md] one checkout, one place for every rule
- [UNKNOWN: ask the Founder how often he re-pairs] how often a code is typed

## R3 Cross-examination
### elsie
- Challenge → charlotte: [INFERENCE: from R2 elsie] one shared code leaks two services at once

### charlotte
- Challenge → elsie: [ASSUMPTION] two codes get written on the same sticky note anyway

## R4 Final stances
### elsie
Stance: A
Kept because: the leak argument was not answered

### charlotte
Stance: A
Changed because: one leak exposing both services outweighs one more prompt

## R5 Verdict
Decision: A
Dissent: none, because the cost point was answered by the leak case
Rests on assumptions:
- nobody pairs more than two phones
Unknowns:
- how often a code is typed
Kill criteria:
- a third phone gets paired
`;

const run = (text, decisions = 'COUNCIL-Q99 open') => check(text, { decisions });
const msgs = (r) => r.errors.map((e) => e.msg).join('\n');

test('a well-formed record passes and tallies its tags', () => {
  const r = run(GOOD);
  assert.deepStrictEqual(r.errors, [], msgs(r));
  assert.deepStrictEqual(r.counts, { FACT: 2, INFERENCE: 2, ASSUMPTION: 2, UNKNOWN: 1 });
  assert.strictEqual(r.unanimous, false);
});

test('the skeleton parses into five rounds and the seats asked for', () => {
  const doc = parse(skeleton({ question: 'Q?', seats: ['arnold', 'elsie'], date: '2026-11-14' }));
  assert.deepStrictEqual(doc.order, ['R1', 'R2', 'R3', 'R4', 'R5']);
  assert.deepStrictEqual(doc.seats, ['arnold', 'elsie']);
  // its placeholder FACT points nowhere, so an unedited skeleton never passes
  assert.match(msgs(check(skeleton({ seats: ['arnold', 'elsie'], date: '2026-11-14' }), { decisions: '' })), /does not exist/);
});

test('claims need a tag, and FACT / INFERENCE / UNKNOWN need their body', () => {
  assert.match(msgs(run(GOOD.replace('- [ASSUMPTION] nobody pairs', '- nobody pairs'))), /R2 elsie: untagged claim/);
  assert.match(msgs(run(GOOD.replace('[FACT: CLAUDE.md]', '[FACT]'))), /\[FACT\] needs a source/);
  assert.match(msgs(run(GOOD.replace('[INFERENCE: from the line above]', '[INFERENCE]'))), /needs what it follows from/);
  assert.match(msgs(run(GOOD.replace('[UNKNOWN: ask the Founder how often he re-pairs]', '[UNKNOWN:]'))), /needs how to find out/);
});

test('a FACT path must exist and its line must be inside the file', () => {
  assert.match(msgs(run(GOOD.replace('CLAUDE.md]', 'NOPE.md]'))), /NOPE\.md does not exist/);
  assert.match(msgs(run(GOOD.replace('03_COUNCIL-CHARTER.md:89', '03_COUNCIL-CHARTER.md:99999'))), /past the end/);
  // a URL or a measurement is taken as written
  assert.deepStrictEqual(run(GOOD.replace('[FACT: CLAUDE.md]', '[FACT: https://code.claude.com/docs measured 2026-11-14]')).errors, []);
});

test('a unanimous R2 needs a counter-case in R3', () => {
  const same = GOOD.replace('### charlotte\nStance: B', '### charlotte\nStance: A')
    .replace('Stance: A\nChanged because: one leak exposing both services outweighs one more prompt', 'Stance: A\nKept because: no new evidence');
  const r = run(same);
  assert.strictEqual(r.unanimous, true);
  assert.match(msgs(r), /R2 was unanimous/);
  const withCounter = same.replace('## R4 Final stances', '### counter-case (theresa)\n- [INFERENCE: from R2 charlotte] B saves a prompt per pairing\n\n## R4 Final stances');
  assert.deepStrictEqual(run(withCounter).errors, [], msgs(run(withCounter)));
});

test('cross-examination must name another seat in the debate', () => {
  assert.match(msgs(run(GOOD.replace('- Challenge → charlotte:', '- Reply:'))), /R3 elsie: no "- Challenge/);
  assert.match(msgs(run(GOOD.replace('Challenge → charlotte:', 'Challenge → elsie:'))), /challenges itself/);
  assert.match(msgs(run(GOOD.replace('Challenge → charlotte:', 'Challenge → arnold:'))), /not in this debate/);
});

test('R4 gives the right reason for keeping or changing a stance', () => {
  assert.match(msgs(run(GOOD.replace('Changed because: one leak', 'Kept because: one leak'))), /charlotte: stance changed from R2, so "Changed because:"/);
  assert.match(msgs(run(GOOD.replace('Kept because: the leak argument', 'Changed because: the leak argument'))), /elsie: stance kept from R2/);
});

test('the verdict names dissenters and carries assumptions, unknowns and kill criteria', () => {
  const holdout = GOOD.replace('Stance: A\nChanged because: one leak exposing both services outweighs one more prompt', 'Stance: B\nKept because: the cost stands');
  assert.match(msgs(run(holdout)), /charlotte ended on another stance and is not named/);
  assert.deepStrictEqual(run(holdout.replace('Dissent: none, because', 'Dissent: charlotte keeps B; the rest')).errors, []);
  assert.match(msgs(run(GOOD.replace('Kill criteria:\n- a third phone gets paired', 'Kill criteria:'))), /Kill criteria:" needs at least one bullet/);
  assert.match(msgs(run(GOOD.replace('Rests on assumptions:\n- nobody pairs more than two phones', 'Rests on assumptions:'))), /2 ASSUMPTION claim/);
  assert.match(msgs(run(GOOD.replace('Unknowns:\n- how often a code is typed\n', ''))), /"Unknowns:" missing/);
});

test('structure: five rounds in order, two seats, a class, a known decision id', () => {
  assert.match(msgs(run(GOOD.replace('## R3 Cross-examination', '## R9 Extra'))), /rounds must be R1 R2 R3 R4 R5/);
  assert.match(msgs(run(GOOD.replace('- seats: elsie, charlotte', '- seats: elsie'))), /at least two seats/);
  assert.match(msgs(run(GOOD.replace('- class: G3, asked the Founder 2026-11-14\n', ''))), /class:" missing/);
  assert.match(msgs(run(GOOD, 'nothing here')), /decides COUNCIL-Q99, which DECISIONS.md does not mention/);
});

test('warnings: sure words on a guess, no FACT, repeated claims, long sections', () => {
  const w = (t) => run(t).warnings.map((x) => x.msg).join('\n');
  assert.match(w(GOOD.replace('[ASSUMPTION] nobody pairs', '[ASSUMPTION] clearly nobody pairs')), /sure-sounding words on an ASSUMPTION/);
  assert.match(w(GOOD.replace('[FACT: CLAUDE.md]', '[ASSUMPTION]')), /R2 charlotte: no FACT behind this stance/);
  assert.match(w(GOOD.replace('Kept because: the leak argument was not answered', 'Kept because: the leak argument was not answered\n- [ASSUMPTION] nobody pairs more than two phones')), /repeats its own R2 claim/);
  const long = GOOD.replace('- [ASSUMPTION] nobody pairs more than two phones', Array.from({ length: 14 }, (_, i) => `- [ASSUMPTION] filler ${i}`).join('\n'));
  assert.match(w(long), /heads report in at most 15/);
  assert.deepStrictEqual(run(GOOD).warnings, []);
});
