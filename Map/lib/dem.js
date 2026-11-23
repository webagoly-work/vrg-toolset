// dem.js — heights from the VRG Térkép's own terrain tiles (data/terrain.pmtiles: Mapterhorn, Copernicus GLO-30 and
// others, terrarium-encoded 512 px tiles up to z12) for the measuring layers: a height under the pointer, and an
// equirectangular grid of the view that lib/relief.js measures on (contours, slope, profile, the terrain's shadow).
// UMD and pure, apart from the browser's tile decoder (fromPmtiles); test/dem.test.js runs it in Node.
//
//   const D = require('./dem.js')                  // Node
//   window.VRGDem                                  // browser
//
//   D.terrarium(r, g, b)                    -> metres  ((r·256 + g + b/256) − 32768)
//   D.tilePixel(lon, lat, z, size)          -> { x, y, px, py }  the tile and the pixel in it (fractional)
//   D.source(getTile, { z, size })          -> { load(bounds), sample(lon, lat), grid(bounds, w, h), zoom }
//        getTile(z, x, y) -> Promise<Float32Array(size·size) | null> (null: no tile there)
//   D.fromPmtiles(archive, { size })        -> getTile for a pmtiles.PMTiles archive (browser: createImageBitmap)
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VRGDem = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const RAD = Math.PI / 180;

  const terrarium = (r, g, b) => r * 256 + g + b / 256 - 32768;

  function tilePixel(lon, lat, z, size) {
    const n = 2 ** z, s = size || 512;
    const fx = (lon + 180) / 360 * n;
    const sl = Math.sin(lat * RAD), fy = (0.5 - Math.log((1 + sl) / (1 - sl)) / (4 * Math.PI)) * n;
    const x = Math.floor(fx), y = Math.floor(fy);
    return { x, y, px: (fx - x) * s, py: (fy - y) * s };
  }
  const tileLon = (x, z) => x / 2 ** z * 360 - 180;
  const tileLat = (y, z) => { const t = Math.PI * (1 - 2 * y / 2 ** z); return Math.atan(Math.sinh(t)) / RAD; };

  /** Tiles of one zoom, cached; heights read bilinearly between pixel centres (across tile edges when both are loaded). */
  function source(getTile, opt) {
    const o = opt || {}, z = o.z == null ? 12 : o.z, size = o.size || 512, cache = new Map(), pending = new Map();
    const key = (x, y) => x + '/' + y;
    function want(x, y) {
      const k = key(x, y);
      if (cache.has(k)) return Promise.resolve(cache.get(k));
      if (!pending.has(k)) pending.set(k, Promise.resolve(getTile(z, x, y)).catch(() => null).then(t => { cache.set(k, t); pending.delete(k); if (cache.size > (o.keep || 96)) cache.delete(cache.keys().next().value); return t; }));
      return pending.get(k);
    }
    /** Loads every tile under [bounds] ({ west, south, east, north }). */
    async function load(b) {
      const a = tilePixel(b.west, b.north, z, size), c = tilePixel(b.east, b.south, z, size);
      const jobs = [];
      for (let x = a.x; x <= c.x; x++) for (let y = a.y; y <= c.y; y++) jobs.push(want(x, y));
      if (jobs.length > (o.maxTiles || 64)) throw new Error('too many tiles (' + jobs.length + '): zoom in');
      await Promise.all(jobs);
    }
    /** One pixel (integer tile coordinates, pixels may run past the tile's edge into its neighbour). */
    function px(tx, ty, ix, iy) {
      if (ix >= size) { tx++; ix -= size; } else if (ix < 0) { tx--; ix += size; }
      if (iy >= size) { ty++; iy -= size; } else if (iy < 0) { ty--; iy += size; }
      const t = cache.get(key(tx, ty));
      return t ? t[iy * size + ix] : NaN;
    }
    function sample(lon, lat) {
      const p = tilePixel(lon, lat, z, size);
      const fx = p.px - 0.5, fy = p.py - 0.5, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
      const a = px(p.x, p.y, ix, iy), b = px(p.x, p.y, ix + 1, iy), c = px(p.x, p.y, ix, iy + 1), d = px(p.x, p.y, ix + 1, iy + 1);
      return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
    }
    /** An equirectangular grid of w × h cells over [bounds] for lib/relief.js (load the bounds first). */
    function grid(b, w, h) {
      const g = { w, h, west: b.west, north: b.north, dlon: (b.east - b.west) / w, dlat: (b.north - b.south) / h, z: new Float32Array(w * h) };
      for (let j = 0; j < h; j++) {
        const lat = b.north - (j + 0.5) * g.dlat;
        for (let i = 0; i < w; i++) g.z[j * w + i] = sample(b.west + (i + 0.5) * g.dlon, lat);
      }
      return g;
    }
    return { load, sample, grid, zoom: z, size, has: (lon, lat) => { const p = tilePixel(lon, lat, z, size); return cache.has(key(p.x, p.y)) && !!cache.get(key(p.x, p.y)); } };
  }

  /** getTile for a pmtiles.PMTiles archive of terrarium PNG / WebP tiles (browser only). */
  function fromPmtiles(archive, opt) {
    const size = (opt && opt.size) || 512;
    let canvas = null;
    return async (z, x, y) => {
      const r = await archive.getZxy(z, x, y);
      if (!r || !r.data) return null;
      const bmp = await createImageBitmap(new Blob([r.data]));
      if (!canvas) canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(size, size) : Object.assign(document.createElement('canvas'), { width: size, height: size });
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(bmp, 0, 0, size, size);
      const d = ctx.getImageData(0, 0, size, size).data, out = new Float32Array(size * size);
      for (let k = 0; k < out.length; k++) out[k] = terrarium(d[4 * k], d[4 * k + 1], d[4 * k + 2]);
      return out;
    };
  }

  return { terrarium, tilePixel, tileLon, tileLat, source, fromPmtiles };
});
