#!/usr/bin/env node
// VRG Kocka tests: node Map/kocka/test/run.js   (invented geometry, plus a format check of the committed chunks)
'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const H = require('../lib/chunk.js'), K = H.KIND;
const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function test(name, fn) { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); } }

// a flat 200 m chunk at 100 m with one gentle slope column, one tagged and one untagged building, a road, a tram, a lamp
function flat(over) {
  const n = 51, cm = [];
  for (let j = 0; j < n; j++) { const row = []; for (let i = 0; i < n; i++) row.push(10000 + i * 10); cm.push(row); } // +0.1 m per 4 m east
  return Object.assign({
    format: 'vrg-kocka/1', id: 't', center: { lat: 47.5, lon: 19.0 }, size: 200, below: 20, ground: 102.5,
    terrain: { x0: -100, y0: -100, step: 4, nx: n, ny: n, cm },
    buildings: [
      { ring: [[10, 10], [30, 10], [30, 30], [10, 30]], height: 21, cls: 'apartments', src: ['OpenStreetMap'] },
      { ring: [[-60, -60], [-40, -60], [-40, -40], [-60, -40]] },
      { ring: [[80, -10], [100, -10], [100, 10], [80, 10]], floors: 4, cut: [1] },
    ],
    roads: [{ cls: 'tertiary', name: 'Próba utca', line: [[-100, 0], [100, 0]] }],
    rails: [{ cls: 'tram', line: [[-100, -20], [100, -20]] }],
    assets: [{ cls: 'street_lamp', x: 0, y: 6 }, { cls: 'kerb', x: 1, y: 1 }],
    trees: [[99, 99]], treeRows: [], water: [], areas: [], barriers: [], places: [],
  }, over || {});
}

test('cube: floor 20 m under the ground, 200 m tall', () => {
  const c = H.cube(47.52, 19.03, 107.14);
  assert.strictEqual(+(c.zBase).toFixed(2), 87.14); assert.strictEqual(+(c.zTop).toFixed(2), 287.14); assert.strictEqual(c.half, 100);
  const d = H.cube(0, 0, 50, { size: 100, below: 5 }); assert.strictEqual(d.zBase, 45); assert.strictEqual(d.zTop, 145);
});

test('terrain sampler: bilinear on the grid, clamped at the edge', () => {
  const s = H.terrainSampler(flat().terrain);
  assert.strictEqual(s(-100, -100), 100); assert.strictEqual(+s(-98, 0).toFixed(3), 100.05);
  assert.strictEqual(+s(100, 0).toFixed(3), 105); assert.strictEqual(+s(500, 0).toFixed(3), 105);
});

test('building height: tag, then floors, then type, then size; flagged by source', () => {
  assert.deepStrictEqual(H.buildingHeight({ height: 21, ring: [] }).src, 'tagged');
  const f = H.buildingHeight({ floors: 4, ring: [] }); assert.strictEqual(f.src, 'floors'); assert.strictEqual(+f.h.toFixed(1), +(4 * H.FLOOR_M + 1.2).toFixed(1));
  assert.strictEqual(H.buildingHeight({ cls: 'church', ring: [] }).h, 22);
  const s = H.buildingHeight({ ring: [[0, 0], [10, 0], [10, 10], [0, 10]] }); assert.strictEqual(s.src, 'size'); assert.strictEqual(s.h, 12);
  assert.strictEqual(H.buildingHeight({ ring: [[0, 0], [4, 0], [4, 4], [0, 4]] }).h, 3);
  assert.strictEqual(H.buildingHeight({ height: 30, minHeight: 6, ring: [] }).minH, 6);
});

const c = H.cloud(flat());
test('cloud: every point inside the cube', () => {
  for (let i = 0; i < c.n; i++) {
    const x = c.pos[i * 3], y = c.pos[i * 3 + 1], z = c.pos[i * 3 + 2];
    assert.ok(Math.abs(x) <= 100 && Math.abs(y) <= 100 && z >= 0 && z <= 200, `point ${i} at ${x},${y},${z}`);
  }
  assert.ok(c.n > 20000, 'n = ' + c.n);
});
test('cloud: measured walls and assumed walls are different kinds', () => {
  const f = c.features.filter(f => f.type === 'building');
  assert.deepStrictEqual(f.map(x => x.src), ['tagged', 'size', 'floors']);
  const kindsOf = fi => new Set([...c.kind].filter((k, i) => c.feat[i] === fi));
  assert.ok(kindsOf(1).has(K.WALL) && !kindsOf(1).has(K.WALL_EST));
  assert.ok(kindsOf(2).has(K.WALL_EST) && !kindsOf(2).has(K.WALL));
});
test('cloud: the edge on the cube side is a section, not a wall', () => {
  let sec = 0; for (let i = 0; i < c.n; i++) if (c.kind[i] === K.SECTION) { sec++; assert.ok(Math.abs(c.pos[i * 3] - 100) < 0.3); }
  assert.ok(sec > 50, 'section points ' + sec);
});
test('cloud: a tagged building stands on the ground and reaches its height', () => {
  let zmax = 0, zmin = 1e9;
  for (let i = 0; i < c.n; i++) if (c.feat[i] === 1) { zmax = Math.max(zmax, c.pos[i * 3 + 2]); zmin = Math.min(zmin, c.pos[i * 3 + 2]); }
  const base = H.terrainSampler(flat().terrain)(10, 10) - 82.5;    // lowest vertex is the west side
  assert.ok(Math.abs(zmax - (base + 21)) < 0.2, 'top ' + zmax + ' vs ' + (base + 21));
  assert.ok(zmin <= base + 1, 'bottom ' + zmin);
});
test('cloud: ground at the picked point is "below" metres above the floor; marker column there', () => {
  let best = null;
  for (let i = 0; i < c.n; i++) if (c.kind[i] === K.ROAD && Math.hypot(c.pos[i * 3], c.pos[i * 3 + 1]) < 2) best = c.pos[i * 3 + 2];
  assert.ok(best != null && Math.abs(best - 20) < 0.2, 'ground z ' + best);
  assert.ok(c.stats[K.MARK] > 100);
});
test('cloud: lamp is electrical and picked as a feature; kerbs are skipped', () => {
  const lamp = c.features.findIndex(f => f.type === 'asset' && f.cls === 'street_lamp') + 1;
  assert.ok(lamp > 0); assert.ok([...c.feat].some((f, i) => f === lamp && c.kind[i] === K.POWER));
  assert.ok(!c.features.some(f => f.cls === 'kerb'));
  assert.ok(c.stats[K.WIRE] > 100, 'tram overhead line');
});
test('cloud: deterministic for one seed', () => {
  const d = H.cloud(flat());
  assert.strictEqual(d.n, c.n); assert.deepStrictEqual(Array.from(d.pos.slice(0, 300)), Array.from(c.pos.slice(0, 300)));
});
test('cloud: density scales the count', () => {
  const lo = H.cloud(flat(), { density: 0.5 }).n; assert.ok(lo < c.n * 0.8, lo + ' vs ' + c.n);
});

for (const f of fs.readdirSync(path.join(ROOT, 'chunks')).filter(f => f.endsWith('.json'))) {
  test('chunk ' + f + ': format, geometry in the cube, sources named', () => {
    const ch = JSON.parse(fs.readFileSync(path.join(ROOT, 'chunks', f), 'utf8'));
    assert.strictEqual(ch.format, 'vrg-kocka/1');
    assert.ok(Math.abs(ch.zBase - (ch.ground - ch.below)) < 0.02 && Math.abs(ch.zTop - ch.zBase - ch.size) < 0.02);
    const h = ch.size / 2 + 0.05;
    for (const b of ch.buildings) for (const [x, y] of b.ring) assert.ok(Math.abs(x) <= h && Math.abs(y) <= h);
    assert.ok(ch.sources.length >= 2 && ch.sources.every(s => s.licence));
    assert.strictEqual(ch.terrain.cm.length, ch.terrain.ny);
    const cl = H.cloud(ch); assert.ok(cl.n > 10000);
  });
}

test('artifact build: one self-contained page, no document skeleton, chunk embedded', () => {
  const out = execFileSync(process.execPath, [path.join(ROOT, 'tools', 'build-artifact.js')], { encoding: 'utf8' });
  const html = fs.readFileSync(path.join(ROOT, 'dist', 'vrg-kocka-start-ujlak.html'), 'utf8');
  assert.ok(/<title>VRG Kocka<\/title>/.test(html.slice(0, 8000)));
  assert.ok(!/<html|<body|<!doctype|<\/head>/i.test(html), 'skeleton tags left in');
  assert.ok(html.includes('id="vrg-kocka-chunk"') && !html.includes('src="lib/chunk.js"'));
  assert.ok(out.includes('KB'));
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
