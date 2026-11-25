// VRG Stack — tests for the write gateway (lib/edit.js, S6): decisions only, one fixed answer line.
// Run:  node --test test/edit.test.js       Works on throwaway copies in the temp folder, never on the repo.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const E = require('../lib/edit');
const LAY = require('../lib/layers');

const FILES = {
  // a table of questions, an open section, a bullet item, a heading item, and one already answered
  'docs/visual/DECISIONS.md': [
    '# Visual decisions', '', '## Open', '',
    '| Id | Question | Options |', '|---|---|---|',
    '| VIS-Q5 | Holo forms | **A** keep · B drop |', '| VIS-Q6 | Where the lens lives | A dock · B page |', '',
    '- **VIS-Q7** · Which colour is forecast?', '  A ice · B violet', '- **VIS-Q8** · Answered = B already', '',
    '### VIS-Q9 · Read-only first?', '', 'A yes · B no', '',
  ].join('\n') + '\n',
  // a namespaced file that writes its ids locally (Q-03 = HUB-Q3), with Windows line endings
  'docs/hub/DECISIONS.md': ['# Hub', '', 'Q-03 · Guest mode?', 'A on · B off', '', 'Q-04 · Shared folders?', ''].join('\r\n'),
  'docs/visual/README.md': '# not a decisions file\n',
};
function sandbox() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'vrg-edit-'));
  for (const [f, s] of Object.entries(FILES)) { fs.mkdirSync(path.dirname(path.join(repo, f)), { recursive: true }); fs.writeFileSync(path.join(repo, f), s); }
  return { repo, log: path.join(repo, 'data', 'events.jsonl'), now: () => new Date('2026-11-25T12:00:00Z') };
}
const read = (ctx, f) => fs.readFileSync(path.join(ctx.repo, f), 'utf8');
const state = (ctx, f, id) => { const it = LAY.parseDecisionFile(read(ctx, f), f).items.get(id); return it && it.answered; };
// the new file is the old one with lines inserted, and nothing else
function onlyInserted(before, after) {
  const a = before.split('\n'), b = after.split('\n'), extra = [];
  let i = 0; for (const l of b) { if (i < a.length && l === a[i]) i++; else extra.push(l); }
  assert.equal(i, a.length, 'every old line is still there, in order'); return extra;
}

test('a table row: the line goes after the table, the question reads answered, nothing else changes', () => {
  const ctx = sandbox(), f = 'docs/visual/DECISIONS.md', before = read(ctx, f);
  const op = { editor: 'decisions', file: f, id: 'VIS-Q5', choice: 'b', text: 'drop |', note: 'for now', date: '2026-11-25', page: 'test' };
  const pv = E.preview(op, ctx);
  assert.equal(read(ctx, f), before, 'a preview writes nothing');
  assert.equal(pv.answer, '> **VIS-Q5** answered 2026-11-25: **B** — drop · for now · _(Döntésnapló)_');
  assert.match(pv.diff, /^--- a\/docs\/visual\/DECISIONS\.md\n\+\+\+ b\/docs\/visual\/DECISIONS\.md\n@@ /);
  assert.ok(pv.diff.includes('\n+> **VIS-Q5** answered'));
  const r = E.apply(op, pv.hash, ctx);
  const after = read(ctx, f), extra = onlyInserted(before, after);
  assert.deepEqual(extra, [pv.answer, ''], 'the answer and a blank line (the old blank line after the table stays before it)');
  const lines = after.split('\n'); assert.equal(lines.indexOf(pv.answer), lines.indexOf('| VIS-Q6 | Where the lens lives | A dock · B page |') + 2, 'after the table and its blank line');
  assert.equal(state(ctx, f, 'VIS-Q5'), true); assert.equal(state(ctx, f, 'VIS-Q6'), false, 'the next row stays open');
  const ev = JSON.parse(fs.readFileSync(ctx.log, 'utf8').trim());
  assert.deepEqual([ev.op, ev.id, ev.answer, ev.valid, ev.seen, ev.page], ['edit', 'Q:VIS-Q5', 'B', '2026-11-25', '2026-11-25T12:00:00.000Z', 'test']);
  assert.equal(r.line, 7);
});

test('a bullet item and a heading item; an own answer; an answered one is refused', () => {
  const ctx = sandbox(), f = 'docs/visual/DECISIONS.md';
  let b = read(ctx, f);
  const p7 = E.preview({ editor: 'decisions', file: f, id: 'VIS-Q7', own: 'ice,\nbut dashed', date: '2026-11-25' }, ctx);
  E.apply({ editor: 'decisions', file: f, id: 'VIS-Q7', own: 'ice,\nbut dashed', date: '2026-11-25' }, p7.hash, ctx);
  let a = read(ctx, f);
  assert.deepEqual(onlyInserted(b, a), ['', '> **VIS-Q7** answered 2026-11-25: “ice, but dashed” · _(Döntésnapló)_', ''], 'after the item\'s own two lines, as its own block');
  assert.ok(a.includes('  A ice · B violet\n\n> **VIS-Q7**'));
  assert.equal(state(ctx, f, 'VIS-Q7'), true); assert.equal(state(ctx, f, 'VIS-Q9'), false);
  b = a;
  const p9 = E.preview({ editor: 'decisions', file: f, id: 'VIS-Q9', choice: 'A', text: 'yes', date: '2026-11-25' }, ctx);
  E.apply({ editor: 'decisions', file: f, id: 'VIS-Q9', choice: 'A', text: 'yes', date: '2026-11-25' }, p9.hash, ctx);
  a = read(ctx, f);
  assert.ok(a.includes('### VIS-Q9 · Read-only first?\n\n> **VIS-Q9** answered 2026-11-25: **A** — yes · _(Döntésnapló)_\n\nA yes · B no'), 'just under the heading, its own block');
  assert.equal(state(ctx, f, 'VIS-Q9'), true);
  assert.throws(() => E.preview({ editor: 'decisions', file: f, id: 'VIS-Q8', choice: 'A' }, ctx), e => e.code === 409, 'VIS-Q8 says Answered already');
  assert.throws(() => E.preview({ editor: 'decisions', file: f, id: 'VIS-Q9', choice: 'B' }, ctx), e => e.code === 409, 'and now VIS-Q9 too');
});

test('a local id in a namespaced file keeps its spelling and its CRLF line endings', () => {
  const ctx = sandbox(), f = 'docs/hub/DECISIONS.md', before = read(ctx, f);
  const op = { editor: 'decisions', file: f, id: 'HUB-Q3', choice: 'B', text: 'off', date: '2026-11-25' };
  const pv = E.preview(op, ctx); E.apply(op, pv.hash, ctx);
  const after = read(ctx, f);
  assert.equal(after, ['# Hub', '', 'Q-03 · Guest mode?', 'A on · B off', '', '> **Q-03** answered 2026-11-25: **B** — off · _(Döntésnapló)_', '', 'Q-04 · Shared folders?', ''].join('\r\n'));
  assert.ok(!/[^\r]\n/.test(after), 'CRLF everywhere');
  assert.equal(state(ctx, f, 'HUB-Q3'), true); assert.equal(state(ctx, f, 'HUB-Q4'), false);
  assert.ok(before.length < after.length);
});

test('refused: a changed file, a wrong path, a non-decisions file, an unknown id or editor, a bad choice', () => {
  const ctx = sandbox(), f = 'docs/visual/DECISIONS.md';
  const op = { editor: 'decisions', file: f, id: 'VIS-Q6', choice: 'A' };
  const pv = E.preview(op, ctx);
  fs.appendFileSync(path.join(ctx.repo, f), 'a hand edit meanwhile\n');
  assert.throws(() => E.apply(op, pv.hash, ctx), e => e.code === 409 && /changed since the preview/.test(e.message));
  assert.ok(!read(ctx, f).includes('VIS-Q6** answered'), 'nothing written on a conflict');
  assert.throws(() => E.apply(op, '', ctx), e => e.code === 409);
  const bad = [
    [{ ...op, file: '../outside/DECISIONS.md' }, 400], [{ ...op, file: 'docs/visual/README.md' }, 403], [{ ...op, file: 'H:/elsewhere/DECISIONS.md' }, 403],
    [{ ...op, file: 'docs/none/DECISIONS.md' }, 404], [{ ...op, id: 'VIS-Q99' }, 404], [{ ...op, editor: 'threads' }, 400], [{ ...op, choice: 'Z' }, 400],
  ];
  for (const [o, code] of bad) assert.throws(() => E.preview(o, ctx), e => e.code === code, JSON.stringify(o) + ' → ' + code);
});
