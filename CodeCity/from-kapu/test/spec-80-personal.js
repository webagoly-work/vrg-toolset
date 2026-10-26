'use strict';

const assert = require('assert');
const path = require('path');
const { kpLoad } = require('./load');
const { kpL5Merge, kpL5Report } = require('../src/js/80-personal.js');
const { kpResolveRefs, kpVisible } = require('../src/js/10-model.js');
const { kpLayout, kpOverlaps } = require('../src/js/20-layout.js');

const SEED = require(path.join(__dirname, '..', 'data', 'topology.json'));
const L = (id, extra) => Object.assign({ id, t: 'Link ' + id, url: 'https://example.test/' + id }, extra);

module.exports = [
  { name: 'import rejects javascript: (count 0)', fn() {
    const r = kpL5Merge([], [{ id: 'a', t: 'x', url: 'javascript:alert(1)' }]);
    assert.strictEqual(r.list.length, 0);
    assert.strictEqual(r.rejected, 1);
  } },
  { name: 'merge by id: a,b + b\',c -> a,b\',c, "1 új, 1 frissített"', fn() {
    const r = kpL5Merge([L('a'), L('b')], [L('b', { t: 'B új' }), L('c')]);
    assert.deepStrictEqual(r.list.map(k => k.id), ['a', 'b', 'c']);
    assert.strictEqual(r.list[1].t, 'B új');
    assert.strictEqual(kpL5Report(r), '1 új, 1 frissített');
  } },
  { name: 'file:/// links are accepted, other schemes not', fn() {
    const r = kpL5Merge([], [L('f', { url: 'file:///H:/x.html' }), L('d', { url: 'data:text/html,x' })]);
    assert.deepStrictEqual(r.list.map(k => k.id), ['f']);
  } },
  { name: 'L5 never reaches kpApply output or the save payload', fn() {
    const secret = 'https://only-mine.example.test/x';
    const ls = new Map();
    const m = kpLoad(['00-core.js', '10-model.js', '60-access.js', '41-search.js', '70-edit.js', '80-personal.js'],
      { TextEncoder, TextDecoder, atob, btoa, localStorage: { getItem: k => ls.get(k) ?? null, setItem: (k, v) => ls.set(k, String(v)), removeItem: k => ls.delete(k) } });
    m.kpStore.set('l5', [L('mine', { url: secret, attach: 'planner' })]);
    const prep = m.kpSavePrep(SEED, [{ op: 'set', id: 'planner', field: 'd', value: 'x' }], 'u', '2026-10-22');
    const payload = JSON.stringify(prep.topo, null, 2);
    assert.ok(!payload.includes(secret));
    assert.ok(!JSON.stringify(m.kpApply(SEED, []).topo).includes(secret));
  } },
  { name: 'layout: free links in a row, attached ones under their program, no overlaps', fn() {
    const links = [L('s1'), L('s2'), L('p1', { attach: 'planner', d: 'a Planner alá' }), L('p2', { attach: 'planner' }), L('x', { attach: 'nincs-ilyen' })];
    const lay = kpLayout(kpVisible(kpResolveRefs(SEED), 'now'), { personal: { links, folder: { name: 'Exportok' } } });
    const n = id => lay.nodes.find(x => x.id === id);
    const plannerX = lay.nodes.find(x => x.id === 'planner:L1').x;
    assert.strictEqual(n('l5:p1').x, plannerX);
    assert.ok(n('l5:p2').y > n('l5:p1').y);
    assert.strictEqual(n('l5:s1').y, n('l5:s2').y);
    assert.strictEqual(n('l5:x').y, n('l5:s1').y, 'unknown attach falls back to the Saját row');
    assert.strictEqual(n('l6:folder').full, 'Exportok');
    assert.ok(n('band:L6').y >= n('band:L5').y + n('band:L5').h);
    assert.strictEqual(kpOverlaps(lay).length, 0);
  } }
];
