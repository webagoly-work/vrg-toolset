'use strict';

const assert = require('assert');
const path = require('path');
const { kpResolveRefs, kpVisible } = require('../src/js/10-model.js');
const { KP_LAYOUT, kpLayout, kpOverlaps, kpWrap } = require('../src/js/20-layout.js');

const SEED = kpResolveRefs(require(path.join(__dirname, '..', 'data', 'topology.json')));
const lay = (view, opts) => kpLayout(kpVisible(SEED, view), opts);
const ORDER = ['ALT', 'VEZ', 'ERT', 'TERV', 'KALK', 'BESZ', 'KIV', 'TFEJ', 'JOG', 'ARC', 'TUD', 'IT', 'IRO'];

module.exports = [
  { name: 'now: 13 headers, 36 cards; vision: 55', fn() {
    const now = lay('now'), vis = lay('vision');
    assert.strictEqual(now.nodes.filter(n => n.kind === 'dept').length, 13);
    assert.strictEqual(now.nodes.filter(n => n.kind === 'program').length, 36);
    assert.strictEqual(vis.nodes.filter(n => n.kind === 'program').length, 55);
  } },
  { name: 'no card or text box overlaps another (both views, all layers)', fn() {
    for (const v of ['now', 'vision']) {
      const hits = kpOverlaps(lay(v));
      assert.strictEqual(hits.length, 0, v + ': ' + hits.slice(0, 5).map(h => h.join(' x ')).join('; '));
    }
  } },
  { name: 'no overlaps with every stack expanded either', fn() {
    const cells = SEED.programs.flatMap(p => ['L2', 'L3', 'L4'].map(l => p.id + ':' + l));
    const hits = kpOverlaps(lay('vision', { expanded: cells }));
    assert.strictEqual(hits.length, 0, hits.slice(0, 5).map(h => h.join(' x ')).join('; '));
  } },
  { name: 'text boxes stay inside their column', fn() {
    for (const n of lay('vision').nodes) {
      if (!n.text) continue;
      assert.ok(n.text.w <= KP_LAYOUT.colW + KP_LAYOUT.colGap - KP_LAYOUT.cardX - KP_LAYOUT.spineX - 2, n.id + ' text ' + n.text.w);
    }
  } },
  { name: 'departments left to right in seed order', fn() {
    const heads = lay('now').nodes.filter(n => n.kind === 'dept');
    assert.deepStrictEqual(heads.slice().sort((a, b) => a.x - b.x).map(n => n.dept), ORDER);
  } },
  { name: 'Planner roadmap: 6 rows, newest first', fn() {
    const rm = lay('now').nodes.filter(n => n.kind === 'roadmap' && n.progId === 'planner').sort((a, b) => a.y - b.y);
    assert.strictEqual(rm.length, 6);
    assert.strictEqual(rm[0].date, '2026-10-19');
  } },
  { name: 'collapsing TFEJ removes exactly 7 columns of width', fn() {
    const tfej = kpVisible(SEED, 'now').find(c => c.dept.id === 'TFEJ').programs.length;
    assert.strictEqual(tfej, 8);
    const a = lay('now').width, b = lay('now', { collapsed: ['TFEJ'] }).width;
    assert.strictEqual(a - b, (tfej - 1) * (KP_LAYOUT.colW + KP_LAYOUT.colGap));
  } },
  { name: 'hidden layers take no nodes and no space', fn() {
    const all = lay('now'), some = lay('now', { layers: { L2: false, L3: false } });
    assert.strictEqual(some.nodes.filter(n => n.layer === 'L2' || n.layer === 'L3').length, 0);
    assert.ok(some.height < all.height);
  } },
  { name: 'kpWrap: 3 lines max, ellipsis when cut', fn() {
    const w = kpWrap('egy ketto harom negy ot hat het nyolc kilenc tiz tizenegy tizenketto', 12, 3);
    assert.strictEqual(w.length, 3);
    assert.ok(w[2].endsWith('…'));
    assert.ok(w.every(l => l.length <= 12));
    assert.deepStrictEqual(kpWrap('rövid', 30, 3), ['rövid']);
  } }
];
