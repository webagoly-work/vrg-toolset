// tools/build-roads.js + lib/route.js on an invented road network written as a real .pbf (test/pbf-writer.js).
//
//            F (footway end)
//            |  footway
//   S ------ M ------ T ===== V ===== W      S–M–T primary (one way, M in its middle), V–W motorway, T–V link
//    \______bend_____/ |                     S–T residential, 1.0 km, a bend node 11 m off the line
//    \                 | one-way T -> U
//     \______ U _______/                     U–S residential
'use strict';
const assert = require('assert');
const fs = require('fs'), os = require('os'), path = require('path');
const R = require('../lib/route.js');
const { buildRoads, wayInfo } = require('../tools/build-roads.js');
const { writePbf } = require('./pbf-writer.js');

const P = { S: [19.0000, 47.5000], T: [19.0133, 47.5000], M: [19.0067, 47.5045], U: [19.0133, 47.4900], F: [19.0067, 47.5100],
  V: [19.0300, 47.5000], W: [19.0500, 47.5000], B: [19.0067, 47.5001] };
const ID = { S: 1, T: 2, M: 3, U: 4, F: 5, V: 6, W: 7, B: 8 };
const at = (k, dy = 0) => ({ lon: P[k][0], lat: P[k][1] + dy });
const near = (c, k, m = 3) => c.some(p => R.distance(p[0], p[1], P[k][0], P[k][1]) < m);

function network() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vrg-roads-'));
  const file = path.join(dir, 'roads.osm.pbf');
  const nodes = Object.keys(ID).map(k => ({ id: ID[k], lon: P[k][0], lat: P[k][1] })).sort((a, b) => a.id - b.id);
  const w = (id, ks, tags) => ({ id, refs: ks.map(k => ID[k]), tags });
  writePbf(file, { nodes, ways: [
    w(100, ['S', 'M', 'T'], { highway: 'primary', name: 'Fő út' }),
    w(101, ['S', 'B', 'T'], { highway: 'residential', name: 'Kerülő utca' }),
    w(102, ['M', 'F'], { highway: 'footway' }),
    w(103, ['T', 'U'], { highway: 'residential', oneway: 'yes' }),
    w(104, ['U', 'S'], { highway: 'residential' }),
    w(105, ['T', 'V'], { highway: 'motorway_link' }),
    w(106, ['V', 'W'], { highway: 'motorway' }),
    w(107, ['S', 'U'], { highway: 'track' }),                       // left out
  ] });
  const bin = buildRoads(file);
  fs.rmSync(dir, { recursive: true, force: true });
  return { bin, g: R.decode(new Uint8Array(bin)) };
}

module.exports = t => {
  const { bin, g } = network();

  t('way rules: access, one-ways, speeds', () => {
    assert.strictEqual(wayInfo({ highway: 'track' }), null);
    assert.strictEqual(wayInfo({ highway: 'service', access: 'private' }), null);
    const fw = wayInfo({ highway: 'footway' });
    assert.strictEqual(fw.flags, R.FOOT);
    const mw = wayInfo({ highway: 'motorway' });
    assert.strictEqual(mw.flags & R.FOOT, 0, 'no pedestrians on a motorway');
    assert.strictEqual(mw.flags & R.CAR_BACK, 0, 'a motorway is one-way');
    assert.strictEqual(wayInfo({ highway: 'residential', oneway: '-1' }).flags & R.CAR_FWD, 0);
    assert.ok(wayInfo({ highway: 'residential', oneway: 'yes' }).flags & R.FOOT, 'one-way does not stop walkers');
    assert.strictEqual(wayInfo({ highway: 'primary', maxspeed: '50' }).speed, 43);
    assert.strictEqual(wayInfo({ highway: 'secondary', maxspeed: 'HU:rural' }).speed, 77);
    assert.strictEqual(wayInfo({ highway: 'primary' }).speed, R.SPEED.primary);
    assert.strictEqual(wayInfo({ highway: 'cycleway' }), null, 'a cycle path is not walked unless foot is allowed');
    assert.ok(wayInfo({ highway: 'cycleway', foot: 'designated' }).flags & R.FOOT);
  });

  t('the file: junctions only, the way split at M, the track left out', () => {
    const { h } = R.header(new Uint8Array(bin));
    assert.strictEqual(h.nodes, 7, 'S T M U F V W (the bend is shape)');
    assert.strictEqual(h.edges, 8, 'S-M, M-T, S-T, M-F, T-U, U-S, T-V, V-W');
    assert.strictEqual(h.shape, 1, 'the 11 m bend is kept (simplified at 4 m)');
    assert.strictEqual(g.n, 7);
  });

  t('by car: the faster primary through M, not the shorter street', () => {
    const r = R.route(g, at('S'), at('T'), 'auto');
    assert.ok(near(r.coords, 'M'), 'via M');
    assert.ok(Math.abs(r.meters - 1420) < 25, 'about 1.42 km: ' + r.meters);
    assert.ok(Math.abs(r.seconds - r.meters / (R.SPEED.primary / 3.6)) < 2, 'at the primary speed: ' + r.seconds);
  });

  t('on foot: the shorter street, with its bend', () => {
    const r = R.route(g, at('S'), at('T'), 'gyalog');
    assert.ok(!near(r.coords, 'M'), 'not via M');
    assert.ok(near(r.coords, 'B', 1), 'the bend is drawn');
    assert.ok(Math.abs(r.meters - 1000) < 20, 'about 1.0 km: ' + r.meters);
    assert.ok(Math.abs(r.seconds - r.meters / (4.8 / 3.6)) < 2);
  });

  t('one-way: by car U -> T goes round through S; on foot straight up', () => {
    const car = R.route(g, at('U'), at('T'), 'auto');
    assert.ok(near(car.coords, 'S'), 'round through S');
    const foot = R.route(g, at('U'), at('T'), 'gyalog');
    assert.ok(!near(foot.coords, 'S') && Math.abs(foot.meters - 1112) < 15, 'straight: ' + foot.meters);
    const back = R.route(g, at('T'), at('U'), 'auto');
    assert.ok(Math.abs(back.meters - 1112) < 15, 'T -> U is the one-way\'s direction');
  });

  t('the motorway: drivable, not walkable; a footway: walkable, not drivable', () => {
    assert.ok(R.route(g, at('T'), at('W'), 'auto'), 'by car');
    const w = R.route(g, at('T'), at('W'), 'gyalog');
    assert.ok(!w || w.snapped[1] > 1000, 'on foot W cannot be reached (only a far road end): ' + JSON.stringify(w && w.snapped));
    const f = R.route(g, at('S'), at('F'), 'gyalog');
    assert.ok(near(f.coords, 'F') && near(f.coords, 'M'));
    const c = R.route(g, at('S'), at('F'), 'auto');
    assert.ok(!near(c.coords, 'F'), 'the car stops at the nearest road it can reach');
  });

  t('snapping from a point beside the road; the walk to it is counted', () => {
    const r = R.route(g, at('S', -0.0003), at('T'), 'gyalog');   // 33 m south of S
    assert.ok(Math.abs(r.snapped[0] - 33) < 2, 'snapped ' + r.snapped[0]);
    assert.ok(r.meters > 1030);
  });

  t('both ends on the same junction: the walks are reported, not hidden', () => {
    const r = R.route(g, at('S', 0.003), at('S', -0.003), 'gyalog');   // 333 m north and south of S
    assert.ok(Math.abs(r.snapped[0] - 333) < 3 && Math.abs(r.snapped[1] - 333) < 3, JSON.stringify(r.snapped));
    assert.strictEqual(r.edges, 0);
  });

  t('following a route: off, done, left', () => {
    const r = R.route(g, at('S'), at('T'), 'gyalog');
    const mid = R.along(r, 19.0067, 47.5002);
    assert.ok(mid.off < 15, 'on the route: ' + mid.off);
    assert.ok(Math.abs(mid.left - r.meters / 2) < 60, 'half left: ' + mid.left);
    const far = R.along(r, 19.0067, 47.5045);
    assert.ok(far.off > 400, 'M is off the walking route: ' + far.off);
  });

  t('routeAsync gives the same answer', async () => {
    const a = R.route(g, at('U'), at('T'), 'auto'), b = await R.routeAsync(g, at('U'), at('T'), 'auto');
    assert.deepStrictEqual(b.coords, a.coords);
  });

  t('inflate (Node path) and decode agree', async () => {
    const payload = await R.inflate(new Uint8Array(bin));
    const g2 = R.decode(new Uint8Array(bin), payload);
    assert.strictEqual(g2.e, g.e);
    assert.deepStrictEqual(Array.from(g2.lon), Array.from(g.lon));
  });
};
