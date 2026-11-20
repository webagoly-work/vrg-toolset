// VRG Stack — tests for the lens (Érintésnyom). Run:  node --test test/lens.test.js
// The browser resolver (lib/lens.js) must light what the recorder records: the same graph goes through
// lib/join.js resolveText and through the lens, and both must give the same nodes.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const LENS = require('../lib/lens');
const { join } = require('../lib/join');
const C = require('../lib/common');

const N = (id, layer, kind, title, own, extra = {}) => ({ id, layer, kind, title, own, text: '', t: extra.t || '', lane: extra.lane || '', tier: extra.tier || '', ...extra });
// a small stack: two C folders, a G document, a decision file and decision, an agent, a GO phrase, a commit, features and ideas
const layers = {
  F: { nodes: [N('F:planner', 'F', 'feature', 'Varler Planner wiring router', [], { tier: 1, lane: 'apps' }), N('F:map', 'F', 'feature', 'VRG Térkép offline map', [], { tier: 2, lane: 'apps' })], edges: [] },
  I: { nodes: [N('I:router', 'I', 'built', 'PCB style wiring router for the Planner', [], { t: '2026-10-01' })], edges: [] },
  Q: { nodes: [N('Q:file.visual', 'Q', 'decision file', 'docs/visual/README.md', ['p:docs/visual/README.md']), N('Q:VIS-Q5', 'Q', 'decision', 'Holo forms', ['q:VIS-Q5'])], edges: [{ a: 'Q:file.visual', b: 'Q:VIS-Q5', rel: 'holds' }] },
  L: { nodes: [N('L:route', 'L', 'line', 'Wiring router line', [], { t: '2026-10-02' })], edges: [] },
  A: { nodes: [N('A:agent.arnold', 'A', 'agent', 'Arnold design agent', ['p:.claude/agents/arnold.md']), N('A:go.PLANNER', 'A', 'codephrase (live)', 'GO PLANNER', ['go:PLANNER'])], edges: [] },
  R: { nodes: [N('R:3f2a9c1', 'R', 'commit', 'Inventory: CSV export', ['c:3f2a9c1'], { t: '2026-11-20' })], edges: [] },
  C: { nodes: [N('C:Planner', 'C', 'folder', 'Planner', ['p:Planner']), N('C:Planner/projects/varler-planner/src', 'C', 'folder', 'src', ['p:Planner/projects/varler-planner/src']),
    N('C:SessionCanvas', 'C', 'folder', 'SessionCanvas', ['p:SessionCanvas'])], edges: [{ a: 'C:Planner/projects/varler-planner/src', b: 'C:Planner', rel: 'part' }] },
  G: { nodes: [N('G:docs/visual/README.md', 'G', 'document', 'Látótér plan', ['p:docs/visual/README.md'])], edges: [] },
};
const files = ['Planner/projects/varler-planner/src/04-render.js', 'Planner/projects/varler-planner/src/06c-view-core.js', 'SessionCanvas/serve.js',
  'docs/visual/README.md', '.claude/agents/arnold.md', 'Stack/lib/lens.js'];
const facts = (() => {
  const paths = new Set(files), dirs = new Set();
  for (const f of files) { const p = f.split('/'); for (let i = 1; i < p.length; i++) dirs.add(p.slice(0, i).join('/')); }
  const basenames = new Map(files.map(f => [f.split('/').pop(), f]).filter(([b]) => !/^README|^serve/.test(b)));
  return { paths, dirs, basenames };
})();
const J = join(JSON.parse(JSON.stringify(layers)), facts);
// the page's view of the same graph: stack-data.js shape (edges as arrays) plus a pillar
const stack = {
  nodes: [...J.nodes.values()].map(n => ({ id: n.id, layer: n.layer, kind: n.kind, title: n.title, t: n.t, lane: n.lane, tier: n.tier, own: n.own,
    path: (n.own.find(k => k.startsWith('p:')) || '').slice(2) })).concat([{ id: 'E:planner', layer: 'E', kind: 'pillar', title: 'Planner', own: [] }]),
  edges: J.edges.map(e => [e.a, e.b, e.rel, e.v]).concat([['C:Planner/projects/varler-planner/src', 'E:planner', 'pillar', 2], ['F:planner', 'E:planner', 'pillar', 2], ['I:router', 'E:planner', 'pillar', 2]]),
  layers: [{ code: 'F', hu: 'Kirakat' }],
};
const index = { repo: C.REPO, full: C.FULL, basenames: Object.fromEntries(facts.basenames) };
const L = LENS.create(stack, index);
const same = (a, b) => assert.deepEqual([...a].sort(), [...b].sort());

test('lens: resolves like join.resolveText (the recorder) on the same graph', () => {
  const cases = [
    ['Read Planner/projects/varler-planner/src/04-render.js', ''],
    [C.REPO + '/Planner/projects/varler-planner/src/06c-view-core.js', ''],
    ['', 'node SessionCanvas/serve.js --port 8810'],
    ['', 'see VIS-Q5 and GO PLANNER, commit 3f2a9c1'],
    ['', 'edit 06c-view-core.js and docs/visual/README.md'],
  ];
  for (const [p, text] of cases) {
    const want = J.resolveText((p ? p + ' ' : '') + text);
    const got = L.resolve(p ? [p.replace(/^Read /, '')] : [], text);
    same(got, want);
  }
});

test('lens: Windows and cloud paths, the session folder, decision and agent keys', () => {
  same(L.resolve(['H:\\VRG\\Full\\Planner_VRG_U100\\Planner\\projects\\varler-planner\\src\\04-render.js'], ''), ['C:Planner/projects/varler-planner/src']);
  same(L.resolve(['/home/user/vrg-toolset/SessionCanvas/serve.js'], '', { cwd: '/home/user/vrg-toolset' }), ['C:SessionCanvas']);
  same(L.resolve(['/home/user/vrg-toolset/SessionCanvas/serve.js'], ''), []);   // without the session folder it is outside
  same(L.step({ name: 'Edit', input: { file_path: 'docs/visual/README.md', old_string: 'a', new_string: 'b' } }).exact, ['Q:file.visual', 'G:docs/visual/README.md']);
  same(L.step({ name: 'Agent', input: { subagent_type: 'arnold', description: 'plan the router', prompt: 'x' } }).exact, ['A:agent.arnold']);
  same(L.step({ name: 'Bash', input: { command: 'git log 3f2a9c1' } }).exact, ['R:3f2a9c1']);
  same(L.step({ name: 'WebSearch', input: { query: 'csv parser benchmark' } }).exact, []);
});

test('lens: inferred reach stays apart from the exact one', () => {
  const inf = L.infer('work on the wiring router for the Planner', []);
  assert.ok(inf.has('I:router') && inf.has('L:route'), 'title words reach the router idea and line: ' + [...inf.keys()]);
  assert.ok(![...inf.keys()].some(id => id.startsWith('C:')), 'inference never lands on code');
  const exact = ['I:router'], inf2 = L.infer('', exact);
  assert.ok(!inf2.has('I:router'), 'an exact node is never also inferred');
  const lit = L.light(['C:Planner/projects/varler-planner/src']);
  assert.ok(lit.exact.get('C:Planner/projects/varler-planner/src') === 1 && lit.exact.get('C:Planner') > 0, 'activation spreads over exact links');
  assert.equal(lit.inferred.size, 0);
  const pil = L.pillars(lit.exact);
  assert.ok(pil.get('E:planner') === 1, 'the touched folder lights its pillar');
});

test('lens: layout puts every plane top to bottom and pillars through the planes', () => {
  const { planes, entities } = L.layout();
  assert.deepEqual(planes.map(p => p.id), ['F', 'I', 'Q', 'L', 'A', 'R', 'C', 'G']);
  assert.equal(planes[0].name, 'F · Kirakat');
  const pillar = entities.find(e => e.id === 'E:planner');
  assert.ok(pillar && pillar.pillar && Object.keys(pillar.at).sort().join() === 'C,F,I', 'the pillar stands on C, F and I');
  for (const e of entities) for (const q of Object.values(e.at)) assert.ok(q.x >= 3 && q.x <= 97 && q.y >= 4 && q.y <= 96, e.id + ' inside its plane');
  const ids = new Set(entities.map(e => e.id));
  assert.ok(stack.nodes.filter(n => n.layer !== 'E').every(n => ids.has(n.id)), 'every node is drawn');
});
