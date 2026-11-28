// VRG Stack — Ki kicsoda data (lib/peoplepage.js). Run:  node --test test/peoplepage.test.js
// People by role with their Kapu layers, the seats with their agent, lines, signals and load, the unowned work, the
// pillars only one recorded session has touched.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const PP = require('../lib/peoplepage');

const g = {
  build: { no: 3 }, schema: 2,
  entities: [{ id: 'planner', name: 'Planner', area: 'Design', per: { C: 3 }, members: ['W:owns.arnold.planner'] },
    { id: 'stack', name: 'VRG Stack', area: 'Front door', per: { C: 4 }, members: [] }],
  nodes: [
    { id: 'W:person.owner', layer: 'W', kind: 'person', title: 'Founder (owner)', state: 'owner', w: { role: 'owner', layers: ['L1', 'L4'], signed: true } },
    { id: 'W:account.B', layer: 'W', kind: 'account', title: 'Claude account B', state: 'secondary', brief: 'its own config', w: { ownConfig: true } },
    { id: 'W:seat.arnold', layer: 'W', kind: 'seat', title: 'Arnold · Tervezőmérnök', state: 'held', w: { head: 'Arnold' } },
    { id: 'W:seat.lee', layer: 'W', kind: 'seat', title: 'Lee · Ügyfélreferens', state: 'vacant', w: { head: 'Lee' } },
    { id: 'W:owns.arnold.planner', layer: 'W', kind: 'ownership', title: 'Planner', ent: ['planner'] },
    { id: 'A:agent.arnold', layer: 'A', kind: 'agent', title: 'arnold', brief: 'Design Division' },
    { id: 'C:Planner', layer: 'C', kind: 'module', title: 'Planner', ent: ['planner'] },
    { id: 'C:Stack', layer: 'C', kind: 'module', title: 'Stack', ent: ['stack'] },
    { id: 'R:abc1234', layer: 'R', kind: 'commit', title: 'Planner: x', t: '2026-11-25', ent: ['planner'] },
    { id: 'J:brief.planner', layer: 'J', kind: 'brief', state: 'amber', title: 'brief planner is stale' },
    { id: 'J:test-fail.x', layer: 'J', kind: 'test-fail', state: 'red', title: 'x fails' },
    { id: 'U:run.aaaa1111', layer: 'U', kind: 'run', title: 's1', t: '2026-11-26', ent: [] },
    { id: 'U:run.bbbb2222', layer: 'U', kind: 'run', title: 's2', t: '2026-11-27', ent: [] },
  ],
  edges: [
    { a: 'W:seat.arnold', b: 'W:owns.arnold.planner', rel: 'owns' }, { a: 'W:seat.arnold', b: 'A:agent.arnold', rel: 'played-by' },
    { a: 'J:brief.planner', b: 'C:Planner', rel: 'warns' }, { a: 'J:test-fail.x', b: 'C:Planner', rel: 'warns' },
    { a: 'U:run.aaaa1111', b: 'C:Planner', rel: 'touched' }, { a: 'U:run.bbbb2222', b: 'C:Planner', rel: 'touched' },
    { a: 'U:run.aaaa1111', b: 'C:Stack', rel: 'touched' },
  ],
};

test('people with their Kapu layers by name; the seats with agent, lines, signals and load', () => {
  const D = PP.build(g);
  assert.deepEqual(D.people[0].layers, [['L1', 'programok', 'programs'], ['L4', 'Git', 'Git']]);
  assert.equal(D.signed, true); assert.equal(D.accounts[0].own, true);
  const ar = D.seats.find(s => s.head === 'Arnold');
  assert.equal(ar.agent.id, 'A:agent.arnold');
  assert.deepEqual(ar.lines[0].signals, { red: 1, amber: 1, info: 0 }); assert.equal(ar.lines[0].last, '2026-11-25');
  assert.deepEqual(ar.load, { lines: 1, pillars: 1, red: 1, amber: 1, info: 0 });
  assert.equal(D.seats.find(s => s.head === 'Lee').vacant, true);
  assert.equal(D.build.no, 3);
});

test('unowned work, and the pillars only one recorded session touched', () => {
  const D = PP.build(g);
  assert.deepEqual(D.unowned.map(u => u.id), ['E:stack'], 'the Stack has code and no owner here');
  assert.deepEqual(D.alone.map(a => [a.id, a.session]), [['E:stack', 'U:run.aaaa1111']], 'the Planner had two sessions');
  assert.equal(D.counts.sessions, 2);
});
