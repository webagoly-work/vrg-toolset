'use strict';

const assert = require('assert');
const { kpLoad } = require('./load');

const throwing = {
  getItem() { throw new Error('SecurityError'); },
  setItem() { throw new Error('SecurityError'); },
  removeItem() { throw new Error('SecurityError'); }
};

function memory() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m };
}

module.exports = [
  { name: 'kpEsc escapes markup', fn() {
    const { kpEsc } = kpLoad(['00-core.js']);
    assert.strictEqual(kpEsc('<a&"'), '&lt;a&amp;&quot;');
    assert.strictEqual(kpEsc(null), '');
  } },
  { name: 'kpStore falls back when storage throws', fn() {
    const { kpStore } = kpLoad(['00-core.js'], { localStorage: throwing });
    assert.strictEqual(kpStore.get('x', 5), 5);
    assert.strictEqual(kpStore.set('x', 1), false);
    assert.strictEqual(kpStore.available(), false);
  } },
  { name: 'kpStore round-trips under the vrgKapu. prefix', fn() {
    const ls = memory();
    const { kpStore } = kpLoad(['00-core.js'], { localStorage: ls });
    assert.strictEqual(kpStore.set('theme', 'slate'), true);
    assert.strictEqual(kpStore.get('theme', 'amber'), 'slate');
    assert.ok(ls.m.has('vrgKapu.theme'));
  } },
  { name: 'kpGroup: Hungarian digit grouping', fn() {
    const { kpGroup } = kpLoad(['00-core.js']);
    assert.strictEqual(kpGroup(4912), '4 912');
    assert.strictEqual(kpGroup(5000), '5 000');
    assert.strictEqual(kpGroup(999), '999');
  } },
  { name: 'kpFmtDate gives the Hungarian order', fn() {
    const { kpFmtDate } = kpLoad(['00-core.js']);
    assert.strictEqual(kpFmtDate('2026-10-21'), '2026. 10. 21.');
    assert.strictEqual(kpFmtDate('nonsense'), '');
  } }
];
