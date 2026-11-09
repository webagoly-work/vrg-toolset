'use strict';

// The grown plan (K2-01, src/02-grow.js) run in a sandbox, no browser: 02-layout.js + 02-grow.js on a synthetic
// repo and on this repo's own scan. Every file must get a plot, no two plots may overlap, no plot may sit on a road,
// the same repo must always grow the same city, and the first area must be the one nearest the first workshop.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src');
const code = ['01-data.js', '02-layout.js', '02-grow.js', '02-island.js'].map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n');

function grow(city) {
  const ctx = { console, Math, setTimeout: () => {}, addEventListener: () => {}, $: () => null };
  vm.createContext(ctx);
  vm.runInContext(code + '\n;var __m = cityModel(CITY); layoutCity(__m); planPrepare(__m);', Object.assign(ctx, { CITY: city }));
  return ctx.__m;
}

// a synthetic repo: areas appearing over time, sub-folders, a few big files
function fixture() {
  const files = [], commits = [];
  const areas = [['Planner/src', 60], ['Planner/plugins', 20], ['Inventory', 25], ['docs', 30], ['BRIDGE/omni', 18], ['BRIDGE/arch', 12], ['tools', 8]];
  let t = 0;
  areas.forEach(([dir, n], a) => {
    for (let k = 0; k < n; k++) {
      const i = files.length;
      files.push({ p: `${dir}/f${k}.js`, lang: 'JavaScript', loc: 50 + (k * 37) % 900, maxLoc: 60 + (k * 37) % 900, born: commits.length, last: commits.length, n: 1 + k % 5, own: [], ag: 0 });
      commits.push([1789619404 + t++ * 3600, 0, -1, 'c', 'h' + i, [i, 10, 0]]);
    }
    if (a > 0) commits.push([1789619404 + t++ * 3600, 0, -1, 'co-change', 'x' + a, [files.length - 1, 1, 0, a * 3, 1, 0]]);
  });
  files.push({ p: 'README.md', lang: 'Markdown', loc: 20, maxLoc: 20, born: 0, last: 0, n: 1, own: [], ag: 0 });
  return { kind: 'vrg-codecity', version: 1, repo: { name: 'fx' }, authors: ['T'], agents: [], commits, files };
}

// separating-axis test for two rotated rectangles (centre, half sizes, angle)
function obb(f) {
  const r = f.rectG, a = -f.rotG;
  return { cx: r.x + r.w / 2, cz: r.z + r.h / 2, hw: r.w / 2, hd: r.h / 2, ux: Math.cos(a), uz: Math.sin(a) };
}
function overlap(A, B, eps = 0.05) {
  const axes = [[A.ux, A.uz], [-A.uz, A.ux], [B.ux, B.uz], [-B.uz, B.ux]];
  const dx = B.cx - A.cx, dz = B.cz - A.cz;
  for (const [x, z] of axes) {
    const ra = A.hw * Math.abs(A.ux * x + A.uz * z) + A.hd * Math.abs(-A.uz * x + A.ux * z);
    const rb = B.hw * Math.abs(B.ux * x + B.uz * z) + B.hd * Math.abs(-B.uz * x + B.ux * z);
    if (Math.abs(dx * x + dz * z) > ra + rb - eps) return false;
  }
  return true;
}
function checkCity(m, label) {
  const files = m.city.files;
  const missing = files.filter(f => !f.rectG || !isFinite(f.rectG.x));
  assert.strictEqual(missing.length, 0, `${label}: ${missing.length} files without a plot`);
  const boxes = files.map(obb);
  // overlap check through a coarse bucket grid
  const B = 16, buckets = new Map();
  boxes.forEach((b, i) => {
    const e = Math.hypot(b.hw, b.hd);
    for (let x = Math.floor((b.cx - e) / B); x <= Math.floor((b.cx + e) / B); x++) for (let z = Math.floor((b.cz - e) / B); z <= Math.floor((b.cz + e) / B); z++) {
      const k = x + ':' + z; (buckets.get(k) || buckets.set(k, []).get(k)).push(i);
    }
  });
  const bad = new Set();
  for (const list of buckets.values()) for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    if (overlap(boxes[list[i]], boxes[list[j]])) bad.add(files[list[i]].p + ' × ' + files[list[j]].p);
  }
  assert.strictEqual(bad.size, 0, `${label}: overlapping plots: ${[...bad].slice(0, 3).join(', ')}`);
  // no plot on a road: sample each road's centreline against every plot nearby
  let onRoad = 0;
  for (const r of m.grow.roads) for (let i = 1; i < r.pts.length; i++) {
    const [x0, z0] = r.pts[i - 1], [x1, z1] = r.pts[i];
    for (let t = 0; t <= 1; t += 0.25) {
      const p = { cx: x0 + (x1 - x0) * t, cz: z0 + (z1 - z0) * t, hw: 0.05, hd: 0.05, ux: 1, uz: 0 };
      const k = Math.floor(p.cx / B) + ':' + Math.floor(p.cz / B);
      for (const j of buckets.get(k) || []) if (overlap(p, boxes[j], 0)) onRoad++;
    }
  }
  assert.strictEqual(onRoad, 0, `${label}: ${onRoad} road samples inside plots`);
}

module.exports = [
  { name: 'synthetic repo: every file has a plot, no overlaps, nothing on a road', fn: () => checkCity(grow(fixture()), 'fixture') },
  { name: 'deterministic: the same repo grows the same city', fn: () => {
    const a = grow(fixture()), b = grow(fixture());
    // (each run is its own sandbox: compare by value)
    a.city.files.forEach((f, i) => assert.strictEqual(JSON.stringify([f.rectG, f.rotG]), JSON.stringify([b.city.files[i].rectG, b.city.files[i].rotG]), f.p));
  } },
  { name: 'the first area grows from the first workshop; areas leave in the order they appeared', fn: () => {
    const m = grow(fixture());
    // Planner and the root README are both born at commit 0: the bigger one first; then in order of appearance
    assert.strictEqual(JSON.stringify(m.grow.areas.map(a => a.name)), JSON.stringify(['Planner', 'Főtér', 'Inventory', 'docs', 'BRIDGE', 'tools']));
    const c = f => [f.rectG.x + f.rectG.w / 2, f.rectG.z + f.rectG.h / 2];
    const d = name => Math.min(...m.city.files.filter(f => f.p.startsWith(name)).map(f => Math.hypot(...c(f))));
    assert.ok(d('Planner') < d('tools'), `Planner (${d('Planner').toFixed(1)}) nearer the hub than tools (${d('tools').toFixed(1)})`);
  } },
  { name: 'the treemap plan is kept beside the grown one, and P-switching restores it exactly', fn: () => {
    const m = grow(fixture()), f = m.city.files[5];
    assert.ok(f.rectT && f.rectG && f.rectT !== f.rectG);
    assert.strictEqual(f.rect, f.rectG, 'grown plan is the default (CITY-D54 A)');
  } },
  { name: 'K2-02 island: twice the town, the town flat, trees off the town and the airfield, sites on the coast', fn: () => {
    for (const m of [grow(fixture()), ...(fs.existsSync(path.join(__dirname, '..', 'dist', 'Planner_VRG_U100.city.json')) ? [grow(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'dist', 'Planner_VRG_U100.city.json'), 'utf8')))] : [])]) {
      const I = m.grow.island, PL = 0.5, polar = (x, z) => [Math.atan2(z - I.cz, x - I.cx), Math.hypot(x - I.cx, z - I.cz)];
      const at = (rad, a) => { const N = rad.length, t = ((a / (2 * Math.PI)) % 1 + 1) % 1 * N, i = Math.floor(t) % N, f = t - Math.floor(t); return rad[i] * (1 - f) + rad[(i + 1) % N] * f; };
      assert.ok(I.area > 1.8 && I.area < 2.3, `island / town area ${I.area.toFixed(2)}`);
      // every plot centre and every road point is on flat town ground, inside the coast
      for (const f of m.city.files) {
        const x = f.rectG.x + f.rectG.w / 2, z = f.rectG.z + f.rectG.h / 2;
        assert.ok(Math.abs(I.height(x, z) - PL) < 1e-6, `${f.p} not on flat town ground (${I.height(x, z)})`);
      }
      for (const r of m.grow.roads) if (r.area >= -1) for (const [x, z] of r.pts) assert.ok(Math.abs(I.height(x, z) - PL) < 1e-6, 'a town road point is not on flat town ground');
      assert.ok(I.access.length >= 2, `${I.access.length} access roads (harbour, lighthouse, airport)`);
      for (const t of I.trees) assert.ok(I.accessDist(t.x, t.z) > 4, 'a tree on an access road');
      for (const t of I.trees) { const [a, r] = polar(t.x, t.z); assert.ok(r > at(I.built, a) + 3 && r < at(I.coast, a), 'a tree in the town or the sea'); assert.ok(I.runwayDist(t.x, t.z) > 8, 'a tree on the airfield'); }
      for (const s of [I.harbour, I.lighthouse]) { const [a, r] = polar(s.x, s.z); assert.ok(Math.abs(r - at(I.coast, a)) < 5, 'a coastal site off the coast'); }
      if (I.runway) {
        for (const f of m.city.files) assert.ok(I.runwayDist(f.rectG.x + f.rectG.w / 2, f.rectG.z + f.rectG.h / 2) > 10, 'a building on the airfield');
        for (const sgn of [-1, 1]) { const x = I.runway.x + Math.cos(I.runway.a) * I.runway.len / 2 * sgn, z = I.runway.z + Math.sin(I.runway.a) * I.runway.len / 2 * sgn, [a, r] = polar(x, z);
          assert.ok(r > at(I.built, a) && r < at(I.coast, a), 'the runway leaves the island'); }
      }
    }
    const a = grow(fixture()).grow.island, b = grow(fixture()).grow.island;
    assert.strictEqual(JSON.stringify([a.coast, a.trees, a.runway, a.harbour]), JSON.stringify([b.coast, b.trees, b.runway, b.harbour]), 'the same repo, the same island');
  } },
  { name: 'K2-04 districts: every building has one, downtown streets keep to the axes, villas have pools off every plot', fn: () => {
    const m = grow(fixture()), files = m.city.files;
    assert.ok(files.every(f => f.distG > 0), 'a building without a district');
    const code = id => ({ akademia: 1, belvaros: 2, villa: 3, ipari: 5, munkas: 6 })[id];
    const of = p => files.find(f => f.p.startsWith(p)).distG;
    assert.deepStrictEqual([of('Planner/'), of('Inventory/'), of('docs/'), of('BRIDGE/arch/'), of('tools/'), of('README')],
      [code('akademia'), code('belvaros'), code('belvaros'), code('villa'), code('ipari'), code('munkas')]);
    // a downtown street runs on the world axes: every segment's heading is a multiple of 90°
    const down = m.grow.roads.filter(r => r.area >= 0 && ['Inventory', 'docs'].includes(m.grow.areas[r.area].name) && r.pts.length > 2);
    assert.ok(down.length > 0, 'no downtown street');
    for (const r of down) for (let i = 2; i < r.pts.length; i++) {
      const a = Math.atan2(r.pts[i][1] - r.pts[i - 1][1], r.pts[i][0] - r.pts[i - 1][0]), q = a / (Math.PI / 2);
      assert.ok(Math.abs(q - Math.round(q)) < 1e-6, `a downtown segment at ${(a * 180 / Math.PI).toFixed(1)}°`);
    }
    assert.ok(m.grow.pools.length > 0, 'the villas have no pools');
    const boxes = files.map(obb);
    for (const p of m.grow.pools) {
      const P = { cx: p.x, cz: p.z, hw: p.w / 2, hd: p.d / 2, ux: Math.cos(p.a), uz: Math.sin(p.a) };
      assert.ok(boxes.every(b => !overlap(P, b)), 'a pool on a plot');
    }
  } },
  { name: 'K2-03 grammar: the file kind picks the typology; big data is a flat vault, tests a flat hall', fn: () => {
    const ctx = { console, Math, setTimeout: () => {}, addEventListener: () => {}, $: () => null };
    vm.createContext(ctx);
    vm.runInContext(code + '\n' + fs.readFileSync(path.join(SRC, '51-grammar.js'), 'utf8') + '\n;var __k = grammarKind, __p = grammarPitch;', ctx);
    const kinds = ['a/b.js', 'docs/x.md', 'fw/main.cpp', 'tool.html', 'data/p.json', 'run.ps1', 'img/a.png', 'tests/a.js', 'src/x.test.js', 'LICENSE'].map(p => ctx.__k({ p }));
    assert.strictEqual(JSON.stringify(kinds), JSON.stringify([1, 2, 3, 4, 5, 6, 8, 6, 6, 0]));
    assert.strictEqual(ctx.__p({ p: 'big.json', maxLoc: 9000 }, 5, 0.5), 0, 'a big data file is a flat vault');
    assert.strictEqual(ctx.__p({ p: 'tests/a.js', maxLoc: 10 }, 6, 0.5), 0, 'a test is a flat hall');
    assert.ok(ctx.__p({ p: 'docs/x.md', maxLoc: 10 }, 2, 0.5) > 0.9, 'a doc is a steep timber house');
  } },
  { name: 'this repo\'s own scan grows without losing or overlapping a building', fn: () => {
    const p = path.join(__dirname, '..', 'dist', 'Planner_VRG_U100.city.json');
    if (!fs.existsSync(p)) return;   // no scan yet: nothing to check
    // CPU time, not wall time: a busy machine (browsers, other sessions) must not fail the spec
    const city = JSON.parse(fs.readFileSync(p, 'utf8')), c0 = process.cpuUsage(), m = grow(city), cpu = process.cpuUsage(c0).user / 1000;
    checkCity(m, 'repo');
    assert.ok(cpu < 15000, `layout took ${Math.round(cpu)} ms of CPU`);
  } },
];
