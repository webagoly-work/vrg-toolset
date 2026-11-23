// lib/relief.js: heights, slope, contours, the profile and the terrain's own shadow, on invented grids whose answers
// are known (a tilted plane, a cone, a ridge). No network, no real data.
'use strict';
const assert = require('assert');
const R = require('../lib/relief.js');

const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b} (±${tol})`);
const LAT0 = 47.5, LON0 = 19.0;
const mx = R.mLon(LAT0), my = R.M_LAT;
/** A w × h grid of [d] degrees round (LON0, LAT0), z = f(east m, north m) from its middle. */
function grid(w, h, d, f) {
  const west = LON0 - w * d / 2, north = LAT0 + h * d / 2, z = new Float32Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const lon = west + (i + 0.5) * d, lat = north - (j + 0.5) * d;
    z[j * w + i] = f((lon - LON0) * mx, (lat - LAT0) * my);
  }
  return { w, h, west, north, dlon: d, dlat: d, z };
}
const D = 1 / 3600;   // one arcsecond, about 21 × 31 m here

module.exports = t => {
  t('a tilted plane: height, slope and the way it faces', () => {
    const g = grid(60, 60, D, (e) => 100 + 0.1 * e);
    near(R.at(g, LON0, LAT0), 100, 0.05, 'height in the middle');
    near(R.at(g, LON0 + 200 / mx, LAT0), 120, 0.05, '200 m east, 20 m higher');
    const s = R.slope(g, LON0, LAT0);
    near(s.slope, Math.atan(0.1) * 180 / Math.PI, 0.01, 'slope 5.71°');
    near(s.aspect, 270, 0.01, 'rising to the east: the ground faces west');
    assert.ok(isNaN(R.at(g, LON0 + 1, LAT0)), 'outside the grid: no height');
    // the hillshade: a light from the west lights a west-facing slope more than one from the east
    assert.ok(R.shade(s.dzdx, s.dzdy, 270, 30) > R.shade(s.dzdx, s.dzdy, 90, 30));
    near(R.shade(0, 0, 123, 90), 1, 1e-9, 'flat ground under a light overhead');
  });

  t('a cone: the 400 m contour is a closed ring 1 km round its top', () => {
    const g = grid(120, 80, D, (e, n) => 500 - Math.hypot(e, n) / 10);
    const [c] = R.contours(g, [400]);
    assert.strictEqual(c.level, 400);
    assert.strictEqual(c.lines.length, 1, 'one line');
    const ring = c.lines[0];
    assert.ok(ring.length > 40, 'a ring of many points');
    const a = ring[0], b = ring[ring.length - 1];
    near(Math.hypot((a[0] - b[0]) * mx, (a[1] - b[1]) * my), 0, 1, 'closed: it ends where it began');
    for (const p of ring) near(Math.hypot((p[0] - LON0) * mx, (p[1] - LAT0) * my), 1000, 20, 'every point 1 km from the top');
    // a level above the top or below the grid has no line
    assert.strictEqual(R.contours(g, [600])[0].lines.length, 0);
    // every second cell: still one ring, fewer points
    const half = R.contours(g, [400], null, 2)[0];
    assert.strictEqual(half.lines.length, 1); assert.ok(half.lines[0].length < ring.length);
  });

  t('a round interval for the view', () => {
    assert.strictEqual(R.interval(20), 1);
    assert.strictEqual(R.interval(30), 2);
    assert.strictEqual(R.interval(300), 20);
    assert.strictEqual(R.interval(1000), 50);
  });

  t('the profile over the cone: up 100 m, down 100 m, the steepest 5.7°', () => {
    const g = grid(120, 80, D, (e, n) => 500 - Math.hypot(e, n) / 10);
    const a = [LON0 - 1000 / mx, LAT0], b = [LON0 + 1000 / mx, LAT0];
    const p = R.profile(g, a, b, 200);
    near(p.dist, 2000, 5, 'two kilometres (haversine against the grid\'s metres: 0.1 %)');
    near(p.max, 500, 2.5, 'the top (a sharp peak between cell centres reads a little low)');
    near(p.min, 400, 0.5, 'both ends at 400 m');
    near(p.gain, 100, 2, 'climbed'); near(p.loss, 100, 2, 'descended'); near(p.dz, 0, 0.5, 'end to end');
    near(p.maxSlope, Math.atan(0.1) * 180 / Math.PI, 0.3, 'steepest');
    near(R.distance([LON0, 47], [LON0, 48]), 111195, 50, 'a degree of latitude');
  });

  t('the terrain shadow: a 200 m ridge 1 km east hides a low morning sun', () => {
    // flat at 100 m, a ridge 300 m high from 1000 to 1100 m east of the middle
    const g = grid(220, 40, D, e => (e >= 1000 && e <= 1100 ? 300 : 100));
    const spot = [LON0, LAT0];
    assert.ok(R.shadowed(g, ...spot, { azimuth: 90, altitude: 8 }), 'sun in the east, 8° up: tan 8° · 1 km = 141 m < 200 m');
    assert.ok(!R.shadowed(g, ...spot, { azimuth: 90, altitude: 15 }), '15° up: 268 m > 200 m, lit');
    assert.ok(!R.shadowed(g, ...spot, { azimuth: 270, altitude: 8 }), 'sun in the west: nothing there');
    assert.ok(R.shadowed(g, ...spot, { azimuth: 90, altitude: -1 }), 'the sun under the horizon');
    // a view across the valley: the strip just west of the ridge is in shadow, far west lit
    const view = { west: LON0 - 800 / mx, east: LON0 + 980 / mx, north: LAT0 + 100 / my, south: LAT0 - 100 / my, w: 90, h: 4 };
    const m = R.shadowView(g, view, { azimuth: 90, altitude: 8 });
    const row = Array.from(m.slice(0, 90));
    assert.strictEqual(row[89], 1, 'next to the ridge: shadow');
    // the shadow reaches 200 / tan 8° = 1423 m west of the ridge foot, to −423 m; the view's west end (−800 m) is lit
    assert.strictEqual(row[0], 0, 'far west: lit');
    const edge8 = row.findIndex(v => v === 1);
    near(-800 + (edge8 + 0.5) * 1780 / 90, 1000 - 1423, 45, 'the 8° shadow begins 1423 m west of the ridge');
    const m2 = R.shadowView(g, view, { azimuth: 90, altitude: 12 });   // 200 / tan 12° = 941 m
    const lit = Array.from(m2.slice(0, 90)).findIndex(v => v === 1);
    near(-800 + (lit + 0.5) * 1780 / 90, 1000 - 941, 45, 'the shadow begins 941 m west of the ridge');
  });

  t('packed grids round-trip, no data included', () => {
    const g = grid(50, 30, D, (e, n) => 100 + 0.03 * e + 0.02 * n);
    g.z[7] = NaN; g.z[200] = 3276.0;
    const { meta, data } = R.pack(g, 0.1);
    const back = R.unpack(meta, data);
    assert.ok(isNaN(back.z[7]), 'no data stays no data');
    for (let k = 0; k < g.z.length; k++) if (k !== 7) near(back.z[k], g.z[k], 0.051, 'cell ' + k);
    assert.strictEqual(meta.w, 50);
    // the differences are small: what makes the packed grid compress
    assert.ok(Array.from(data).filter((v, k) => k % 50 && k !== 7 && k !== 8 && k !== 200 && k !== 201).every(v => Math.abs(v) <= 8), 'steps of at most 0.8 m on a 3 % slope');
  });
};
