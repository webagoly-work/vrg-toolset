// VRG Stack — Jelzéstábla data (lib/signalboard.js). Run:  node --test test/signalboard.test.js
// The J nodes grouped by pillar (the worst first, the pillar-less last), the day each first appeared, the ones that
// went away, and which kinds carry their own action.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const SB = require('../lib/signalboard');

const J = (id, kind, state, title, brief = '') => ({ id, layer: 'J', kind, state, title, brief });
function graph(extra = []) {
  return {
    build: { no: 7 }, schema: 2,
    entities: [{ id: 'kapu', name: 'VRG Kapu', area: 'Front door' }, { id: 'planner', name: 'Planner', area: 'Design' }],
    nodes: [
      { id: 'P:suite.Hub/test', layer: 'P', kind: 'test suite', title: 'Hub/test', ent: ['kapu'] },
      { id: 'A:brief.planner', layer: 'A', kind: 'brief', title: 'Planner brief', ent: ['planner'] },
      { id: 'E:planner', layer: 'E', kind: 'pillar', title: 'Planner', ent: [] },
      J('J:test-fail.Hub/test', 'test-fail', 'red', 'Hub/test fails', 'last run 2026-11-26, 3 failed'),
      J('J:brief.planner', 'brief', 'amber', 'brief planner is stale', 'state stale, newest is 2026-11-09'),
      J('J:unverified.planner', 'unverified', 'amber', 'Planner: code that no test reaches'),
      J('J:health.x', 'health', 'amber', 'pillars: 1 thread has no pillar'),
      ...extra,
    ],
    edges: [['J:test-fail.Hub/test', 'P:suite.Hub/test', 'warns'], ['J:brief.planner', 'A:brief.planner', 'warns'], ['J:unverified.planner', 'E:planner', 'warns']],
  };
}

test('grouped by pillar, the worst first, the pillar-less last; the build stamp travels', () => {
  const { data } = SB.build(graph(), {}, '2026-11-27');
  assert.deepEqual(data.pillars.map(p => [p.id, p.worst, p.signals.length]), [['kapu', 'red', 1], ['planner', 'amber', 2], ['', 'amber', 1]]);
  assert.deepEqual(data.counts, { red: 1, amber: 3, info: 0, total: 4, pillars: 2 });
  assert.equal(data.build.no, 7);
  assert.deepEqual(data.signals[0].slice(0, 3), ['J:test-fail.Hub/test', 'test-fail', 'red'], 'red first');
  assert.deepEqual(data.about['A:brief.planner'], ['A', 'brief', 'Planner brief']);
  assert.equal(data.kinds['test-fail'].own, true, 'a failing test\'s brief says what to run again');
  assert.ok(!data.kinds.brief.own, 'a brief\'s problems are evidence; the action is the kind\'s');
});

test('first seen keeps its day; a signal that went away is cleared for 14 days; one that came back is not', () => {
  const first = SB.build(graph([J('J:look-drift.a.html', 'look-drift', 'amber', 'a.html drifted')]), {}, '2026-11-20');
  const second = SB.build(graph(), first.hist, '2026-11-27');
  assert.equal(second.data.signals.find(s => s[0] === 'J:brief.planner')[7], '2026-11-20', 'first seen on the 20th');
  assert.deepEqual(second.data.cleared.map(c => [c[0], c[3]]), [['J:look-drift.a.html', '2026-11-27']]);
  const later = SB.build(graph(), second.hist, '2026-12-20');
  assert.deepEqual(later.data.cleared, [], 'gone from the list after 14 days');
  const back = SB.build(graph([J('J:look-drift.a.html', 'look-drift', 'amber', 'a.html drifted')]), second.hist, '2026-11-28');
  assert.deepEqual(back.data.cleared, [], 'it came back: not cleared any more');
});
