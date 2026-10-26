'use strict';

const assert = require('assert');
const path = require('path');
const { kpLoad } = require('./load');

const SEED = require(path.join(__dirname, '..', 'data', 'topology.json'));
const m = kpLoad(['00-core.js', '10-model.js', '60-access.js', '41-search.js', '70-edit.js'], { TextEncoder, TextDecoder, atob, btoa });
const clone = v => JSON.parse(JSON.stringify(v));
const count = (t, view) => m.kpVisible(t, view).reduce((n, c) => n + c.programs.length, 0);

module.exports = [
  { name: 'set / add / hide / claim on the seed', fn() {
    const r = m.kpApply(SEED, [
      { op: 'set', id: 'planner', field: 'd', value: 'Új leírás' },
      { op: 'set', id: 'planner', field: 'open.url', value: 'https://example.test' },
      { op: 'add', parent: 'dept:IRO', node: { id: 'jegyzet', t: 'Jegyzetek', status: 'idea', d: 'x' } },
      { op: 'add', parent: 'prog:planner:agent', node: { t: 'ÚJ.md', d: 'y', repo: 'x.md' } },
      { op: 'claim', id: 'planner', claim: { by: 'webagoly-work', until: '2099-01-01' } },
      { op: 'set', id: 'dept:TERV', field: 't', value: 'Tervezés' }
    ]);
    const p = r.topo.programs.find(x => x.id === 'planner');
    assert.strictEqual(p.d, 'Új leírás');
    assert.strictEqual(p.open.url, 'https://example.test');
    assert.strictEqual(p.agent.length, SEED.programs.find(x => x.id === 'planner').agent.length + 1);
    assert.strictEqual(p.claim.by, 'webagoly-work');
    assert.strictEqual(r.topo.programs.find(x => x.id === 'jegyzet').dept, 'IRO');
    assert.strictEqual(r.topo.departments.find(d => d.id === 'TERV').t, 'Tervezés');
    assert.strictEqual(m.kpValidate(r.topo).ok, true);
    assert.strictEqual(SEED.programs.find(x => x.id === 'planner').d.startsWith('A fő'), true, 'input untouched');
  } },
  { name: 'after hide planner, now = 35 programs', fn() {
    assert.strictEqual(count(m.kpApply(SEED, [{ op: 'hide', id: 'planner' }]).topo, 'now'), 35);
  } },
  { name: 'conflict: remote mindmap.d + local planner.d -> both; deleted valena -> lost target', fn() {
    const remote = clone(SEED);
    remote.programs.find(p => p.id === 'mindmap').d = 'Távoli változás';
    remote.programs = remote.programs.filter(p => p.id !== 'valena');
    const r = m.kpApply(remote, [{ op: 'set', id: 'planner', field: 'd', value: 'Helyi' }, { op: 'set', id: 'valena', field: 'd', value: 'z' }]);
    assert.strictEqual(r.topo.programs.find(p => p.id === 'mindmap').d, 'Távoli változás');
    assert.strictEqual(r.topo.programs.find(p => p.id === 'planner').d, 'Helyi');
    assert.deepStrictEqual([...r.lost], ['elveszett célpont: valena']);
    const diff = m.kpTopoDiff(SEED, remote);
    assert.ok(diff.some(x => x.startsWith('módosítva: ')) && diff.some(x => x.startsWith('törölve: ')));
  } },
  { name: 'commit message: 7 ops on 7 ids lists 5 ids + …', fn() {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    assert.strictEqual(m.kpCommitMsg('webagoly-work', ids.map(id => ({ op: 'set', id, field: 'd', value: 'x' }))),
      'Kapu: webagoly-work — 7 változás (a, b, c, d, e, …)');
  } },
  { name: 'expired claim (until yesterday) is dropped by save prep; a live one stays', fn() {
    const r = m.kpSavePrep(SEED, [
      { op: 'claim', id: 'planner', claim: { by: 'x', until: '2026-10-21' } },
      { op: 'claim', id: 'mindmap', claim: { by: 'y', until: '2026-10-25' } }], 'webagoly-work', '2026-10-22');
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.topo.programs.find(p => p.id === 'planner').claim, undefined);
    assert.strictEqual(r.topo.programs.find(p => p.id === 'mindmap').claim.by, 'y');
    assert.strictEqual(r.topo.rev, (SEED.rev || 0) + 1);
    assert.strictEqual(r.topo.updatedBy, 'webagoly-work');
  } },
  { name: 'save prep refuses a topology that would not validate', fn() {
    const r = m.kpSavePrep(SEED, [{ op: 'set', id: 'planner', field: 'status', value: 'kész' }], 'x', '2026-10-22');
    assert.strictEqual(r.ok, false);
    assert.ok(r.errors.some(e => e.includes('bad status')));
  } },
  { name: 'UTF-8 base64 round trip (accents survive the PUT encoding)', fn() {
    const s = JSON.stringify({ t: 'Árvíztűrő tükörfúrógép — ő ű' });
    assert.strictEqual(m.kpUtf8B64(m.kpB64Utf8(s)), s);
  } }
];
