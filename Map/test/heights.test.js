// lib/heights.js and tools/build-bp-heights.js: measured building heights on invented footprints (no real atlas): the
// binary file round-trips, the index finds what is in view, a point finds its building (holes too), the height rule,
// and an atlas in EOV lands where the same atlas in WGS84 does.
'use strict';
const assert = require('assert');
const H = require('../lib/heights.js');
const B = require('../tools/build-bp-heights.js');
const R = require('../lib/relief.js');

const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b} (±${tol})`);
const sq = (lon, lat, d) => [[lon, lat], [lon + d, lat], [lon + d, lat + d], [lon, lat + d], [lon, lat]];

module.exports = t => {
  t('a file of footprints round-trips', () => {
    const bs = [
      { h: 23.4, rings: [sq(19.05, 47.5, 0.0003)] },
      { h: 61, rings: [sq(19.06, 47.5, 0.001), sq(19.0603, 47.5003, 0.0004)] },          // a courtyard
      { h: 12, rings: [[[19.0, 47.4], [19.05, 47.4], [19.05, 47.401], [19.0, 47.401], [19.0, 47.4]]] },   // a 3.8 km wall: long steps split
      { h: 0, rings: [sq(19.07, 47.5, 0.0003)] },                                         // no height: left out
    ];
    const set = H.decode(H.encode(bs, { source: 'teszt' }));
    assert.strictEqual(set.n, 3); assert.strictEqual(set.meta.source, 'teszt'); assert.strictEqual(set.meta.count, 3);
    near(set.h(0), 23.4, 0.05, 'height in decimetres');
    const r = set.rings(1);
    assert.strictEqual(r.length, 2, 'the courtyard ring stays');
    near(r[1][0][0], 19.0603, 1e-6, 'micro-degrees');
    const wall = set.rings(2)[0];
    assert.ok(wall.length > 5, 'the long edge was split into i16 steps');
    assert.ok(wall.some(p => Math.abs(p[0] - 19.05) < 1e-6 && Math.abs(p[1] - 47.4) < 1e-6), 'and its corners are where they were');
    assert.deepStrictEqual(set.bbox(0).map(v => +v.toFixed(4)), [19.05, 47.5, 19.0503, 47.5003]);
  });

  t('the index, the view and the building under a point', () => {
    const bs = [];
    for (let i = 0; i < 40; i++) for (let j = 0; j < 40; j++) bs.push({ h: 10 + i, rings: [sq(19 + i * 0.001, 47.5 + j * 0.001, 0.0006)] });
    bs.push({ h: 50, rings: [sq(19.1, 47.6, 0.001), sq(19.1003, 47.6003, 0.0004)] });
    const set = H.decode(H.encode(bs, {})), idx = H.index(set);
    const ids = H.inBox(set, idx, { west: 19.0095, east: 19.0125, south: 47.5195, north: 47.5215 });
    assert.strictEqual(ids.length, 4 * 3, 'the 4 × 3 footprints that meet the box');
    assert.strictEqual(H.inBox(set, idx, { west: 19, east: 19.04, south: 47.5, north: 47.54 }, 100).length, 100, 'the limit');
    const k = H.at(set, idx, 19.0053, 47.5103);
    assert.ok(k >= 0 && Math.abs(set.h(k) - 15) < 0.01, 'the building at a point');
    assert.strictEqual(H.at(set, idx, 19.0008, 47.5003), -1, 'between buildings: none');
    assert.strictEqual(H.at(set, idx, 19.1005, 47.6005), -1, 'in the courtyard: none');
    assert.ok(H.at(set, idx, 19.1001, 47.6001) >= 0, 'in the wing round it: the building');
  });

  t('the height rule: measured, OSM, levels, 7 m', () => {
    assert.deepStrictEqual(H.pick({ height: '18' }, 21.5), { h: 21.5, from: 'mért' });
    assert.deepStrictEqual(H.pick({ height: '18' }, 0), { h: 18, from: 'osm' });
    assert.deepStrictEqual(H.pick({ 'building:levels': 5 }, null), { h: 16, from: 'szint' });
    assert.deepStrictEqual(H.pick({}, -1), { h: 7, from: 'alap' });
  });

  t('EOV: the projection origin and Budapest, a kilometre is a kilometre', () => {
    const o = H.eovToWgs(650000, 200000);
    // the origin is 47°08′39.82″ N, 19°02′54.86″ E on HD72; WGS84 differs from it by the datum shift (≈ 85 m west, 30 m south)
    near(R.distance(o, [19.04857178, 47.14439372]), 90, 20, 'the origin, shifted by the HD72 → WGS84 datum');
    const bp = H.eovToWgs(650000, 239000);
    near(bp[1], 47.4949, 0.002, 'Budapest is 39 km north of the origin'); near(bp[0], 19.0474, 0.002, 'on its meridian');
    near(R.distance(bp, H.eovToWgs(650000, 240000)), 1000.07, 3, '1 km north');
    near(R.distance(bp, H.eovToWgs(651000, 239000)), 1000, 4, '1 km east (the sphere\'s distance is 0.3 % short at this latitude)');
  });

  t('the converter: a field found, EOV recognised, broken heights left out', () => {
    const wgs = { type: 'FeatureCollection', features: [
      { type: 'Feature', properties: { DN: 31.5 }, geometry: { type: 'Polygon', coordinates: [sq(19.05, 47.5, 0.0003)] } },
      { type: 'Feature', properties: { DN: 9999 }, geometry: { type: 'Polygon', coordinates: [sq(19.06, 47.5, 0.0003)] } },
      { type: 'Feature', properties: { DN: 14 }, geometry: { type: 'MultiPolygon', coordinates: [[sq(19.07, 47.5, 0.0003)], [sq(19.08, 47.5, 0.0003)]] } },
    ] };
    const c = B.convert(wgs);
    assert.strictEqual(c.field, 'DN'); assert.strictEqual(c.eov, false); assert.strictEqual(c.skipped, 1);
    assert.strictEqual(c.buildings.length, 3, 'a multipolygon is one footprint per part');
    // the same first building in EOV metres: a 30 m square round (650 000, 239 000)
    const eov = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { magassag: '27' },
      geometry: { type: 'Polygon', coordinates: [[[650000, 239000], [650030, 239000], [650030, 239030], [650000, 239030], [650000, 239000]]] } }] };
    const e = B.convert(eov);
    assert.ok(e.eov, 'EOV recognised'); assert.strictEqual(e.field, 'magassag');
    const ring = e.buildings[0].rings[0];
    near(R.distance(ring[0], ring[1]), 30, 0.2, 'a 30 m wall stays 30 m');
    near(ring[0][1], 47.4949, 0.002, 'in Budapest');
    assert.throws(() => B.convert({ features: [{ properties: { x: 'a' }, geometry: null }] }), /no height field/);
  });
};
