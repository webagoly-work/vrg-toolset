// VRG Stack — tests for T · Teendők (lib/todo.js, S3). Run:  node --test test/todo.test.js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../lib/todo');
const S = require('../lib/strings');

const threads = { AREAS: [
  { area: 'Tools', rows: [
    { id: 'stack', s: 'high', lines: ['stack'], d: ['9 layers', 'Döntésnapló', 'Search'], t: [{ l: 'Code imports', h: 'step 2.8' }, ['More layers', 'step 2.9'], 'Write-back — answers through one tool'] },
    { id: 'mindmap', s: 'op', lines: ['mm'], d: ['Board view'], t: [{ l: 'Döntésnapló', h: 'the decision inbox page' }, { l: 'Board build', h: 'x' }, { l: 'Export', h: 'png' }] },
    { id: 'start', s: 'op', lines: [], d: ['One menu', 'Key registry'], t: [{ l: 'OTG menu', h: 'phase 3.6' }, { l: 'Register T1', h: '' }, { l: 'Export', h: 'zip' }] },
  ] },
] };
const lines = { LINES: [{ id: 'stack', remaining: ['code imports', 'Live build', 'Session hooks'] }] };
const roadmaps = [{ file: 'Stack/ROADMAP.md', text: '| Step | State |\n|---|---|\n| 2.7 write-back with approval | ✅ done |\n| 2.8 imports in Code | ✗ |\n| 2.9 more layers | ✗ |\n' }];

test('collect: every way a not-yet item is written, the ✗ rows only', () => {
  const { raw, built } = T.collect({ threads, lines, roadmaps });
  const labels = raw.map(r => r.label);
  assert.ok(labels.includes('Code imports') && labels.includes('More layers') && labels.includes('Write-back'), 'object, pair and "label — hint" string');
  assert.equal(raw.find(r => r.label === 'Write-back').hint, 'answers through one tool');
  assert.ok(labels.includes('imports in Code') && labels.includes('more layers'), 'ROADMAP ✗ rows, the step number dropped');
  assert.ok(!labels.some(l => /write-back with approval/.test(l)), 'a ✅ row is not open work');
  assert.ok(labels.includes('Live build'), 'lines.js remaining');
  assert.equal(built.length, 6, 'every thread\'s built list, for the check');
});

test('layer: the same item from several places is one node; vague labels stay apart across threads', () => {
  const { raw, built } = T.collect({ threads, lines, roadmaps });
  const L = T.layer(raw, built);
  const by = t => L.nodes.filter(n => n.title.toLowerCase() === t.toLowerCase());
  const ci = L.nodes.find(n => n.title === 'Code imports');
  assert.deepEqual(ci.extra.sources.sort(), ['Stack/ROADMAP.md:4', 'line stack', 'thread stack'].sort(), 'board + lines.js + ROADMAP, one node');
  assert.equal(by('More layers').length, 1, 'one telling word: the same text from the board and ROADMAP is one item');
  assert.equal(by('Export').length, 2, '"Export" on two threads: two items');
  const q = T.layer([{ label: 'E6-Q1–Q4', hint: '', from: { src: 'thread', id: 'rounds' }, threads: ['rounds'], lines: [] }, { label: 'Q1–Q4', hint: '', from: { src: 'thread', id: 'logo' }, threads: ['logo'], lines: [] },
    { label: 'FNM-Q1–Q4', hint: '', from: { src: 'thread', id: 'finom' }, threads: ['finom'], lines: [] }]);
  assert.equal(q.nodes.length, 3, 'different codes are different items, however close the words');
  assert.ok(L.edges.some(e => e.a === ci.id && e.b === 'L:stack' && e.rel === 'todo-of'));
  assert.ok(L.nodes.every(n => /^T:[a-z0-9-]+$/.test(n.id) && n.layer === 'T' && n.state === 'open'));
  assert.equal(new Set(L.nodes.map(n => n.id)).size, L.nodes.length, 'unique ids');
});

test('check: the Döntésnapló item looks done, with its evidence; near words are not evidence', () => {
  const { raw, built } = T.collect({ threads, lines, roadmaps });
  const L = T.layer(raw, built);
  const nodes = new Map(L.nodes.map(n => [n.id, n]));
  const add = n => nodes.set(n.id, n);
  add({ id: 'F:decisions', layer: 'F', kind: 'feature', title: 'Döntésnapló (decision inbox)', tier: 1 });
  add({ id: 'F:dash', layer: 'F', kind: 'feature', title: 'CYD dashboard firmware', tier: 1 });
  add({ id: 'F:livep', layer: 'F', kind: 'feature', title: 'Live build', tier: 3 });
  add({ id: 'R:aaa1111', layer: 'R', kind: 'commit', title: 'Stack live build (S5): a hand edit reaches the pages', t: '2026-11-25' });
  add({ id: 'R:bbb2222', layer: 'R', kind: 'commit', title: 'Stack: the live build announces itself', t: '2026-11-25' });
  add({ id: 'R:eee5555', layer: 'R', kind: 'commit', title: 'Stack session hooks: SessionStart prints L0', t: '2026-11-10' });
  add({ id: 'R:fff6666', layer: 'R', kind: 'commit', title: 'session hooks: Stop appends the nodes touched', t: '2026-11-11' });
  add({ id: 'R:ccc3333', layer: 'R', kind: 'commit', title: 'export the board', t: '2026-11-20' });
  add({ id: 'R:ddd4444', layer: 'R', kind: 'commit', title: 'zip export', t: '2026-11-21' });
  nodes.set('T:packaging', { id: 'T:packaging', layer: 'T', kind: 'todo', title: 'Packaging', state: 'open', extra: {} });
  add({ id: 'R:ggg7777', layer: 'R', kind: 'commit', title: 'Planner: import the Vázlat package', t: '2026-11-22' });
  add({ id: 'R:hhh8888', layer: 'R', kind: 'commit', title: 'Rajztár: the package wizard', t: '2026-11-23' });
  const edges = [];
  const { looksDone } = T.check(nodes, edges, built);
  const done = new Map(looksDone.map(t => [t.title, t]));
  const d = done.get('Döntésnapló');
  assert.ok(d, 'the stale Döntésnapló item is flagged');
  assert.equal(d.state, 'looks done');
  assert.deepEqual(d.evidence.map(e => e.kind).sort(), ['F', 'board']);
  assert.ok(edges.some(e => e.a === d.id && e.b === 'F:decisions' && e.rel === 'looks-done' && e.v === 1), 'the evidence becomes a vertical link');
  assert.ok(done.has('Session hooks'), 'two commits name every telling word');
  assert.deepEqual(done.get('Session hooks').evidence.map(e => e.id), ['R:fff6666', 'R:eee5555'], 'newest first');
  const extra = new Map([...nodes]);
  for (const [id, label] of [['T:x1', 'S6 look check'], ['T:x2', 'STK-Q1…Q6']]) extra.set(id, { id, layer: 'T', kind: 'todo', title: label, state: 'open', extra: {} });
  const r2 = T.check(extra, [], [{ label: 'S6 look', thread: 'sui' }, { label: 'KG-Q1–Q6', thread: 'kitgyar' }]);
  assert.deepEqual(r2.looksDone.map(t => t.title).filter(t => /S6|Q1/.test(t)), [], 'a built item missing a word, or with other codes, is not the same item');
  for (const no of ['OTG menu', 'Register T1', 'Board build', 'Export', 'More layers', 'Code imports', 'Live build', 'Packaging'])
    assert.ok(!done.has(no), no + ' is not done ("One menu", "Key registry", "Board view", one short word in commits, "9 layers", an F row in development)');
});

test('drift: the hand value two or more steps from the string makes a card, closer does not', () => {
  const N = (id, layer, extra = {}) => ({ id, layer, kind: extra.kind || 'x', title: extra.title || id, t: extra.t || '', tier: extra.tier || '', own: [], ...extra });
  const today = new Date().toISOString().slice(0, 10);
  const nodes = [
    N('E:kapu', 'E', { kind: 'pillar' }), N('F:kapu', 'F', { tier: 4, title: 'VRG Kapu' }), N('I:kapu', 'I'), N('R:k1', 'R', { t: '2026-01-01', kind: 'commit' }),
    N('C:Hub', 'C'), N('G:docs/hub/README.md', 'G'), N('L:hub', 'L'),
    N('E:cla', 'E', { kind: 'pillar' }), N('I:cla', 'I'), N('Q:CLA-Q1', 'Q'), N('G:cla', 'G'),
    N('E:near', 'E', { kind: 'pillar' }), N('F:near', 'F', { tier: 2 }), N('R:n1', 'R', { t: today, kind: 'commit' }), N('C:near', 'C'),
  ];
  const pil = (p, ms) => ms.map(m => [m, p, 'pillar', 2]);
  const edges = [...pil('E:kapu', ['F:kapu', 'I:kapu', 'R:k1', 'C:Hub', 'G:docs/hub/README.md', 'L:hub']), ...pil('E:cla', ['I:cla', 'Q:CLA-Q1', 'G:cla']), ...pil('E:near', ['F:near', 'R:n1', 'C:near'])];
  const graph = { nodes, edges, entities: [
    { id: 'kapu', name: 'VRG Kapu', members: ['F:kapu', 'I:kapu', 'R:k1', 'C:Hub', 'G:docs/hub/README.md', 'L:hub'] },
    { id: 'cla', name: 'CLA job', status: 'op', members: ['I:cla', 'Q:CLA-Q1', 'G:cla'] },
    { id: 'near', name: 'Near', members: ['F:near', 'R:n1', 'C:near'] },
  ] };
  const cards = T.drift(graph, S, {});
  const by = new Map(cards.map(c => [c.pillar, c]));
  assert.ok(by.has('kapu'), 'F tier 4 (planned: out) while the string reads Built, quiet (high): three steps');
  assert.equal(by.get('kapu').evidence, 'high'); assert.equal(by.get('kapu').hand, 'out'); assert.match(by.get('kapu').propose, /F tier 2 for VRG Kapu/);
  assert.ok(by.has('cla'), 'a hand status op on a pillar whose string is only Planned');
  assert.match(by.get('cla').propose, /status out in entities\.json/);
  assert.ok(!by.has('near'), 'F tier 2 (high) and In build (mid): one step, no card');
});
