// VRG Stack — J · Jelzések (lib/signals.js, S14). Run:  node --test test/signals.test.js
// Each detector on a small graph: the signal it makes, its severity, what it warns; stable ids; one count per pillar.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const SG = require('../lib/signals');
const S = require('../lib/strings');

const N = (id, layer, kind, title, o = {}) => ({ id, layer, kind, title, brief: '', state: '', t: '', own: [], ent: [], extra: {}, ...o });
function graph() {
  const list = [
    N('P:suite.Map/test', 'P', 'test suite', 'Map/test', { state: 'fail', extra: { path: 'Map/test', keys: ['W/M'], last: { at: '2026-11-26T10:00:00Z', pass: 3, fail: 1 } } }),
    N('P:suite.Hub/test', 'P', 'test suite', 'Hub/test', { state: 'stale', extra: { path: 'Hub/test', last: { at: '2026-11-20T10:00:00Z', pass: 9 } } }),
    N('P:suite.ui/test', 'P', 'test suite', 'ui/test', { state: 'no runner', extra: { path: 'ui/test' } }),
    N('P:suite.Stack/test', 'P', 'test suite', 'Stack/test', { state: 'pass', extra: { path: 'Stack/test', last: { at: '2026-11-26T10:00:00Z', pass: 90 } } }),
    N('S:cluster.ab12cd34', 'S', 'cluster', 'router wireway ×3', { state: 'open', brief: '3 asks in 2 sessions', extra: { sessions: 2 } }),
    N('S:cluster.ffff0000', 'S', 'cluster', 'build layer ×2', { state: 'landed', extra: { sessions: 2 } }),
    N('G:sig.c1', 'G', 'signal/contradiction', 'load 41 W vs 42 W', { state: 'confirmed' }),
    N('G:sig.c2', 'G', 'signal/contradiction', 'C5 conduit', { state: 'candidate' }),
    N('G:sig.c3', 'G', 'signal/contradiction', 'wrong match', { state: 'dismissed' }),
    N('G:sig.d1', 'G', 'signal/dark', 'an uncited doc', { state: 'candidate' }),
    N('G:BRIDGE/STD-001.md', 'G', 'document', 'STD-001', { ent: ['bridge'] }),
    N('A:brief.map', 'A', 'brief', 'Map brief', { ent: ['map'] }),
    N('A:brief.hub', 'A', 'brief', 'Hub brief'),
    N('T:map-offline-tiles', 'T', 'todo', 'offline tiles', { ent: ['map'] }),
    N('E:map', 'E', 'pillar', 'VRG Térkép'), N('E:bridge', 'E', 'pillar', 'BRIDGE'),
    N('C:Map', 'C', 'folder', 'Map'), N('C:Modder', 'C', 'folder', 'Modder'), N('E:modder', 'E', 'pillar', 'Modder'),
  ];
  const nodes = new Map(list.map(n => [n.id, n]));
  const edges = [{ a: 'G:sig.c1', b: 'G:BRIDGE/STD-001.md', rel: 'flags' }, { a: 'C:Map', b: 'E:map', rel: 'pillar', v: 2 }, { a: 'C:Modder', b: 'E:modder', rel: 'pillar', v: 2 },
    { a: 'P:suite.Map/test', b: 'C:Map', rel: 'ref:p', v: 1 }, { a: 'P:suite.Map/test', b: 'E:map', rel: 'pillar', v: 2 }];
  const entities = [{ id: 'map', name: 'VRG Térkép' }, { id: 'bridge', name: 'BRIDGE' }, { id: 'modder', name: 'Modder' }];
  return { nodes, edges, entities };
}
const run = (extra = {}) => { const g = graph(); return { g, J: SG.detect({ ...g, S, sopts: {}, ...extra }) }; };

test('P: a failing suite is red, a stale one and one nothing runs are amber, a passing one says nothing', () => {
  const { J } = run(), n = id => J.nodes.find(x => x.id === id);
  assert.equal(n('J:test-fail.Map/test').state, 'red'); assert.match(n('J:test-fail.Map/test').brief, /3 passed, 1 failed; run it again: START W\/M/);
  assert.equal(n('J:test-stale.Hub/test').state, 'amber'); assert.equal(n('J:no-runner.ui/test').state, 'amber');
  assert.ok(!J.nodes.some(x => /Stack\/test/.test(x.id)));
  assert.ok(J.edges.some(e => e.a === 'J:test-fail.Map/test' && e.b === 'P:suite.Map/test' && e.rel === 'warns'));
});

test('K, G, briefs, health, looks done: each to its own severity', () => {
  const { J } = run({ looksDone: [{ id: 'T:map-offline-tiles', title: 'offline tiles', evidence: [{ text: 'F row tier 2' }] }],
    briefs: { problems: { map: ['state stale, newest is 2026-11-09'], hub: ['state stale', 'missing path Hub/x'] } },
    checks: [{ kind: 'pillars', level: 'warn', msg: '3 Thread Board threads have no pillar' }, { kind: 'schema', level: 'ok', msg: 'fine' }, { kind: 'pipeline', level: 'fail', msg: 'layer A failed' }] });
  const st = id => (J.nodes.find(x => x.id === id) || {}).state;
  assert.equal(st('J:asked-again.cluster.ab12cd34'), 'amber'); assert.equal(st('J:asked-again.cluster.ffff0000'), undefined, 'landed: no signal');
  assert.equal(st('J:contradiction.c1'), 'red'); assert.equal(st('J:contradiction.c2'), 'amber'); assert.equal(st('J:contradiction.c3'), undefined, 'dismissed');
  assert.equal(st('J:solomon.d1'), 'info');
  assert.deepEqual(J.edges.filter(e => e.a === 'J:contradiction.c1').map(e => e.b), ['G:sig.c1', 'G:BRIDGE/STD-001.md'], 'the signal and the documents it flags');
  assert.equal(st('J:brief.map'), 'amber'); assert.equal(st('J:brief.hub'), 'red', 'a missing path is broken, not just stale');
  assert.equal(st('J:looks-done.map-offline-tiles'), 'info');
  const health = J.nodes.filter(x => x.kind === 'health');
  assert.deepEqual(health.map(x => x.state).sort(), ['amber', 'red'], 'warn and fail, not ok');
  assert.deepEqual(J.nodes.map(x => x.state), [...J.nodes.map(x => x.state)].sort((a, b) => SG.SEV[b] - SG.SEV[a]), 'the worst first');
});

test('ids name the trouble, not the build: the same warning with other numbers keeps its id', () => {
  const a = SG.detect({ checks: [{ kind: 'pillars', level: 'warn', msg: '3 Thread Board threads have no pillar: a, b' }] });
  const b = SG.detect({ checks: [{ kind: 'pillars', level: 'warn', msg: '4 Thread Board threads have no pillar: a, b' }] });
  assert.equal(a.nodes[0].id, b.nodes[0].id);
  const { J } = run(), again = run().J;
  assert.deepEqual(J.nodes.map(x => x.id), again.nodes.map(x => x.id));
  assert.ok(J.edges.every(e => graph().nodes.has(e.b)), 'warns only nodes that exist');
});

test('strings: a pillar whose code no test reaches is warned; byPillar counts a signal once per pillar', () => {
  const { g, J } = run();
  assert.ok(J.nodes.some(x => x.id === 'J:unverified.modder'), 'Modder has C and no P');
  assert.ok(!J.nodes.some(x => x.id === 'J:unverified.map'), 'Map has its tests');
  for (const n of J.nodes) g.nodes.set(n.id, n);
  const all = { nodes: [...g.nodes.values()], edges: [...g.edges, ...J.edges] };
  const m = SG.byPillar(all);
  assert.equal(m.get('bridge').red, 1, 'the contradiction warns the signal and a BRIDGE document: one red, not two');
  assert.equal(m.get('modder').worst, 'amber');
});
