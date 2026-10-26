'use strict';

const assert = require('assert');
const path = require('path');
const { kpResolveRefs } = require('../src/js/10-model.js');
const { kpNorm, kpSearch } = require('../src/js/41-search.js');

const SEED = kpResolveRefs(require(path.join(__dirname, '..', 'data', 'topology.json')));

module.exports = [
  { name: 'kpNorm drops Hungarian accents', fn() {
    assert.strictEqual(kpNorm('Árvíztűrő tükörfúrógép'), 'arvizturo tukorfurogep');
  } },
  { name: '"kalk" in now: the three calculators first, in seed order', fn() {
    const r = kpSearch(SEED, 'kalk', 'now');
    assert.deepStrictEqual(r.slice(0, 3).map(x => x.progId), ['calc-panel', 'calc-general', 'calc-led']);
    assert.ok(r.some(x => x.id === 'dept:KALK'), 'department KALK');
    assert.ok(r.some(x => (x.kind === 'agent' || x.kind === 'go') && /Kalkulátorok összefoglal/.test(x.t)), 'agent doc');
    assert.ok(!r.some(x => x.progId === 'insight'), 'v2 insight absent in now');
  } },
  { name: '"kalk" in vision includes the v2 program insight', fn() {
    assert.ok(kpSearch(SEED, 'kalk', 'vision').some(x => x.progId === 'insight'));
  } },
  { name: 'accent-free query finds accented text; empty query finds nothing', fn() {
    assert.ok(kpSearch(SEED, 'arajanlat', 'vision').length > 0);
    assert.strictEqual(kpSearch(SEED, '   ', 'now').length, 0);
  } }
];
