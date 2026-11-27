// lib/dem.js: heights from terrarium tiles. Invented tiles made from a known surface (no data files, no network): the
// decoding, the tile arithmetic, reading across tile edges, and the view grid lib/relief.js measures on.
'use strict';
const assert = require('assert');
const D = require('../lib/dem.js');
const R = require('../lib/relief.js');

const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b} (±${tol})`);
// a smooth surface: 120 m plus a 200 m hill round Gellért-hegy, rising 1 m per km eastwards
const surface = (lon, lat) => 120 + (lon - 19) * 75 + 200 * Math.exp(-(((lon - 19.0465) * 75) ** 2 + ((lat - 47.4866) * 111) ** 2) / 0.8);
const SIZE = 64, Z = 12;
let calls = 0;
const getTile = async (z, x, y) => {
  calls++;
  const t = new Float32Array(SIZE * SIZE);
  for (let j = 0; j < SIZE; j++) for (let i = 0; i < SIZE; i++) {
    const lon = D.tileLon(x + (i + 0.5) / SIZE, z), lat = D.tileLat(y + (j + 0.5) / SIZE, z);
    t[j * SIZE + i] = surface(lon, lat);
  }
  return t;
};

module.exports = t => {
  t('terrarium decoding', () => {
    assert.strictEqual(D.terrarium(128, 0, 0), 0);
    near(D.terrarium(128, 235, 128), 235.5, 1e-9, '235.5 m');
    near(D.terrarium(127, 255, 0), -1, 1e-9, 'below sea level');
  });

  t('the tile and pixel of a place, and back', () => {
    const p = D.tilePixel(19.0465, 47.4866, 12, 512);
    assert.deepStrictEqual([p.x, p.y], [2264, 1432]);   // the slippy-map tile of Gellért-hegy at z12
    near(D.tileLon(p.x + p.px / 512, 12), 19.0465, 1e-9, 'lon back');
    near(D.tileLat(p.y + p.py / 512, 12), 47.4866, 1e-9, 'lat back');
  });

  t('heights read between pixels and across tile edges', async () => {
    const S = D.source(getTile, { z: Z, size: SIZE });
    const b = { west: 19.0, east: 19.1, south: 47.45, north: 47.52 };
    await S.load(b);
    assert.ok(calls >= 4, 'the view spans several tiles');
    near(S.sample(19.0465, 47.4866), surface(19.0465, 47.4866), 3, 'the hilltop');
    // on a tile edge (a pixel of the next tile is needed)
    const edgeLon = D.tileLon(D.tilePixel(19.05, 47.5, Z, SIZE).x + 1, Z);
    near(S.sample(edgeLon, 47.5), surface(edgeLon, 47.5), 1, 'on the edge between two tiles');
    assert.ok(isNaN(S.sample(18.5, 47.5)), 'a tile never loaded: no height');
    const before = calls; await S.load(b); assert.strictEqual(calls, before, 'loaded tiles are kept');
  });

  t('the view grid measures true with relief.js', async () => {
    const S = D.source(getTile, { z: Z, size: SIZE });
    const b = { west: 19.02, east: 19.08, south: 47.47, north: 47.50 };
    await S.load(b);
    const g = S.grid(b, 240, 160);
    near(R.at(g, 19.0465, 47.4866), surface(19.0465, 47.4866), 4, 'the hill on the grid');
    const [c] = R.contours(g, [200]);
    assert.ok(c.lines.length >= 1, 'a contour round the hill');
    for (const line of c.lines) for (const p of line) near(surface(p[0], p[1]), 200, 6, 'the 200 m line lies at 200 m');
    const pr = R.profile(g, [19.03, 47.4866], [19.065, 47.4866], 200);
    near(pr.max, surface(19.0465, 47.4866), 5, 'the profile crosses the top');
  });

  t('too large a view is refused, not loaded', async () => {
    const S = D.source(getTile, { z: Z, size: SIZE, maxTiles: 10 });
    await assert.rejects(() => S.load({ west: 16, east: 23, south: 45.7, north: 48.6 }), /too many tiles/);
  });
};
