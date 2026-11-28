// VRG Stack — the gateway's threads editor ("mark done", lib/edit-threads.js). Run:  node --test test/edit-threads.test.js
// On throwaway copies in the temp folder, in the shapes a hand-kept threads.js takes.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const E = require('../lib/edit');

const HAND = `// notes/devlog/threads.js — the Thread Board's threads, by hand
const SCALE = { op: ['Operational', 5], high: ['High dev', 4] };

module.exports = {
  SCALE,
  NOW: ['**The front** is the Stack.'],
  AREAS: [
    { area: 'Seeing the work', rows: [
      { id: 'mindmap', n: 'MindMap', s: 'op', lines: ['mm'],
        d: ['MindMap A–E', 'Board view'],   // built
        t: [
          { l: 'Desktop Dashboard', h: 'the VRG Desktop Dashboard idea' },
          { l: 'Döntésnapló', h: 'the decision inbox page' },   // a page of its own
          { l: 'Export', h: 'png, svg' },
        ] },
      { id: 'stack', n: 'VRG Stack', s: 'high', lines: ['stack'],
        d: [
          '9 layers',
          'Search',
        ],
        t: [['Write-back', 'answers through one tool'], 'Session hooks — SessionStart prints L0', { l: "Founder's view", h: 'x' }] },
      { id: 'logo', n: 'Logo', s: 'mid', lines: [], t: [{ l: 'Döntésnapló', h: 'another thread, the same words: left alone' }] },
    ] },
  ],
};
`;
function sandbox(text = HAND) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vrg-threads-'));
  const file = path.join(dir, 'threads.js'); fs.writeFileSync(file, text);
  return { dir, file, ctx: { threadsFile: file, log: path.join(dir, 'events.jsonl'), now: () => new Date('2026-11-25T12:00:00Z') } };
}
const run = f => { delete require.cache[require.resolve(f)]; return require(f); };
const rowOf = (f, id) => run(f).AREAS.flatMap(a => a.rows).find(r => r.id === id);
const op = (thread, item, extra = {}) => ({ editor: 'threads', thread, item, page: 'test', ...extra });

test('mark done: the item leaves t with its line, its label ends d, nothing else changes', () => {
  const { file, ctx } = sandbox();
  const pv = E.preview(op('mindmap', 'Döntésnapló'), ctx);
  assert.equal(fs.readFileSync(file, 'utf8'), HAND, 'a preview writes nothing');
  assert.match(pv.diff, /^-          \{ l: 'Döntésnapló', h: 'the decision inbox page' \},   \/\/ a page of its own$/m);
  assert.match(pv.diff, /^-        d: \['MindMap A–E', 'Board view'\],   \/\/ built\n\+        d: \['MindMap A–E', 'Board view', 'Döntésnapló'\],   \/\/ built$/m, 'the old line, then the new');
  E.apply(op('mindmap', 'Döntésnapló'), pv.hash, ctx);
  const after = fs.readFileSync(file, 'utf8');
  assert.equal(after, HAND.replace("          { l: 'Döntésnapló', h: 'the decision inbox page' },   // a page of its own\n", '')
    .replace("d: ['MindMap A–E', 'Board view'],", "d: ['MindMap A–E', 'Board view', 'Döntésnapló'],"), 'exactly two textual changes, the file\'s own quotes and layout');
  const r = rowOf(file, 'mindmap');
  assert.deepEqual(r.t.map(x => x.l), ['Desktop Dashboard', 'Export']);
  assert.equal(rowOf(file, 'logo').t[0].l, 'Döntésnapló', 'the same words on another thread are left alone');
  const ev = JSON.parse(fs.readFileSync(ctx.log, 'utf8'));
  assert.deepEqual([ev.op, ev.id, ev.editor, ev.thread, ev.item, ev.toBuilt], ['edit', 'T:dontesnaplo', 'threads', 'mindmap', 'Döntésnapló', true]);
});

test('pairs, plain strings, a multi-line d with a trailing comma, an apostrophe in the label', () => {
  const { file, ctx } = sandbox();
  E.apply(op('stack', 'Write-back'), E.preview(op('stack', 'Write-back'), ctx).hash, ctx);
  let t = fs.readFileSync(file, 'utf8');
  assert.ok(t.includes("        t: ['Session hooks — SessionStart prints L0', { l: \"Founder's view\", h: 'x' }] },"), 'a pair cut with its comma from a one-line list');
  assert.ok(t.includes("          'Search',\n          'Write-back',\n        ],"), 'a new line in the multi-line d, its indent, its trailing comma');
  E.apply(op('stack', 'Session hooks'), E.preview(op('stack', 'Session hooks'), ctx).hash, ctx);
  E.apply(op('stack', "Founder's view"), E.preview(op('stack', "Founder's view"), ctx).hash, ctx);
  t = fs.readFileSync(file, 'utf8');
  assert.ok(t.includes('        t: [] },'), 'the last items leave an empty list');
  assert.ok(t.includes("          'Founder\\'s view',"), 'an apostrophe escaped in single quotes');
  assert.deepEqual(rowOf(file, 'stack').d, ['9 layers', 'Search', 'Write-back', 'Session hooks', "Founder's view"]);
});

test('a row with no d gets one; toBuilt false only takes the item off', () => {
  const { file, ctx } = sandbox();
  E.apply(op('logo', 'Döntésnapló'), E.preview(op('logo', 'Döntésnapló'), ctx).hash, ctx);
  assert.ok(fs.readFileSync(file, 'utf8').includes("lines: [], d: ['Döntésnapló'], t: [] },"));
  E.apply(op('mindmap', 'Export', { toBuilt: false }), E.preview(op('mindmap', 'Export', { toBuilt: false }), ctx).hash, ctx);
  const r = rowOf(file, 'mindmap');
  assert.deepEqual(r.t.map(x => x.l), ['Desktop Dashboard', 'Döntésnapló']); assert.deepEqual(r.d, ['MindMap A–E', 'Board view']);
});

test('the JSON-shaped file the sandbox builds (quoted keys, one line)', () => {
  const data = { SCALE: {}, AREAS: [{ area: 'A', rows: [{ id: 'mindmap', n: 'M', d: ['Board view'], t: [{ l: 'Döntésnapló', h: 'x' }, { l: 'Export', h: 'y' }] }] }] };
  const { file, ctx } = sandbox('module.exports = ' + JSON.stringify(data) + ';\n');
  E.apply(op('mindmap', 'Döntésnapló'), E.preview(op('mindmap', 'Döntésnapló'), ctx).hash, ctx);
  assert.equal(fs.readFileSync(file, 'utf8'), 'module.exports = {"SCALE":{},"AREAS":[{"area":"A","rows":[{"id":"mindmap","n":"M","d":["Board view", "Döntésnapló"],"t":[{"l":"Export","h":"y"}]}]}]};\n');
});

test('refused: an item not on the list, a changed file, an item the text cannot show, a broken file', () => {
  const { file, ctx } = sandbox();
  assert.throws(() => E.preview(op('mindmap', 'Nope'), ctx), e => e.code === 404);
  assert.throws(() => E.preview(op('nope', 'Export'), ctx), e => e.code === 404);
  const pv = E.preview(op('mindmap', 'Export'), ctx);
  fs.appendFileSync(file, '// a hand edit meanwhile\n');
  assert.throws(() => E.apply(op('mindmap', 'Export'), pv.hash, ctx), e => e.code === 409);
  assert.ok(rowOf(file, 'mindmap').t.some(x => x.l === 'Export'), 'nothing written on a conflict');
  // an item that is a computed value, not a literal: the editor cannot show it in the text, so it does not guess
  const c2 = sandbox(HAND.replace("{ l: 'Export', h: 'png, svg' },", "EXPORT,").replace('module.exports = {', "const EXPORT = { l: 'Export', h: 'png' };\nmodule.exports = {"));
  assert.throws(() => E.preview(op('mindmap', 'Export'), c2.ctx), e => e.code === 500);
  const c3 = sandbox('module.exports = { AREAS: [ ;\n');
  assert.throws(() => E.preview(op('mindmap', 'Export'), c3.ctx), e => e.code === 500 && /does not run/.test(e.message));
});
