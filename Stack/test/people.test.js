// VRG Stack — W · Szereplők (lib/people.js, S19). Run:  node --test test/people.test.js
// On the repo: people by role from the signed access list (never a name, an email or a login), the accounts, the
// Council's seats and what each Head owns, the business units. A tampered list fails its signature: a red signal.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const W = require('../lib/people');
const SG = require('../lib/signals');

const ROOT = path.join(__dirname, '..', '..');
const r = W.read({ repo: ROOT });
const L = W.layer(r), n = id => L.nodes.find(x => x.id === id);
const access = JSON.parse(fs.readFileSync(path.join(ROOT, 'Hub', 'data', 'access.json'), 'utf8'));

test('people by role from the signed access list; nothing personal in the layer', () => {
  assert.equal(r.signed.ok, true, 'the list verifies, as node tools/hub-sign.js --verify says');
  assert.equal(n('W:person.owner').title, 'Founder (owner)');
  assert.ok(n('W:person.member'), 'the colleague');
  assert.deepEqual(n('W:person.owner').extra.layers, access.body.people.find(p => p.role === 'owner').layers);
  const all = JSON.stringify(L);
  for (const p of access.body.people) for (const v of [p.name, p.github, ...(p.emails || [])]) if (v) assert.ok(!all.includes(v), 'no name, login or email in W');
});

test('accounts, seats with their agents, what each Head owns, the business units', () => {
  assert.equal(n('W:account.B').extra.ownConfig, true, 'B signs in with its own CLAUDE_CONFIG_DIR');
  assert.equal(n('W:seat.arnold').state, 'held'); assert.equal(n('W:seat.stubbs').state, 'vacant');
  assert.ok(L.edges.some(e => e.a === 'W:seat.arnold' && e.b === 'A:agent.arnold' && e.rel === 'played-by'));
  assert.ok(!L.edges.some(e => e.a === 'W:seat.stubbs'), 'a vacant seat is played by no one');
  assert.equal(n('W:owns.arnold.planner').title, 'Planner', 'the program\'s own name, so the Planner pillar takes it in');
  assert.ok(L.edges.some(e => e.a === 'W:seat.elsie' && e.b === 'W:owns.elsie.kapu' && e.rel === 'owns'));
  assert.equal(L.nodes.filter(x => x.kind === 'business unit').length, require('../../docs/hub/hub-seed.json').departments.length);
});

test('a tampered access list fails its signature: a red signal; a vacant seat is info', () => {
  const T = fs.mkdtempSync(path.join(os.tmpdir(), 'vrg-people-'));
  for (const rel of ['Hub/data/access.json', 'Hub/src/access-pubkey.json', 'Hub/src/js/60-access.js']) { fs.mkdirSync(path.dirname(path.join(T, rel)), { recursive: true }); fs.copyFileSync(path.join(ROOT, rel), path.join(T, rel)); }
  const bad = JSON.parse(JSON.stringify(access)); bad.body.people[1].role = 'owner';   // a member made owner, not re-signed
  fs.writeFileSync(path.join(T, 'Hub/data/access.json'), JSON.stringify(bad));
  const x = W.read({ repo: T });
  assert.equal(x.signed.ok, false); assert.equal(x.signed.checked, true);
  const J = SG.detect({ nodes: new Map([...W.layer(x).nodes, ...L.nodes.filter(y => y.kind === 'seat')].map(y => [y.id, y])) });
  assert.equal(J.nodes.find(y => y.id === 'J:access-signature.hub').state, 'red');
  assert.equal(J.nodes.find(y => y.id === 'J:seat-vacant.stubbs').state, 'info');
  assert.equal(SG.detect({ nodes: new Map(L.nodes.map(y => [y.id, y])) }).nodes.filter(y => y.kind === 'access-signature').length, 0, 'the real list: no signal');
  fs.rmSync(T, { recursive: true, force: true });
});

test('the roster table reader', () => {
  const md = '# x\n## The Board and the Heads\n| Call | Cím |\n|---|---|\n| **A** | one |\n| *B* | two |\n## Next\n| x |\n';
  assert.deepEqual(W.table(md, /Board and the Heads/), [['**A**', 'one'], ['*B*', 'two']]);
});

test('unowned: a pillar with code the roster does not name, nor its area; a loose name or an owned area is enough', () => {
  const g = { nodes: [{ id: 'W:owns.charlotte.calculators', layer: 'W', kind: 'ownership', title: 'calculators' }, { id: 'W:owns.arnold.planner', layer: 'W', kind: 'ownership', title: 'Planner' }],
    entities: [
      { id: 'calculator', name: 'Calculators', words: ['calculator'], area: 'Money', per: { C: 2 }, members: [] },
      { id: 'sui', name: 'Simple UI (SUI)', words: ['simple ui'], area: 'Planner', per: { C: 1 }, members: [] },
      { id: 'planner', name: 'Planner', words: ['planner'], area: 'Design', per: { C: 9 }, members: ['W:owns.arnold.planner'] },
      { id: 'stack', name: 'VRG Stack (this)', words: ['vrg stack'], area: 'Front door', per: { C: 5 }, members: [] },
      { id: 'idea', name: 'An idea', words: ['idea'], area: 'Front door', per: { I: 1 }, members: [] }] };
  assert.deepEqual(W.unowned(g).map(p => p.id), ['stack'], 'calculators ≈ Calculators; SUI by its area; an idea with no code is no gap');
});
