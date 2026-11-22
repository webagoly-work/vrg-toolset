// relief.js — the measurable relief of the VRG Térkép: heights above sea level, slope and aspect, hillshade, contour
// lines, a two-point profile, and the shadow the terrain itself casts for a sun position (lib/sun.js). Pure and
// dependency-free; the same file runs in the page (window.VRGRelief), in Node (test/relief.test.js) and, copied, in the
// Data Vault's Térkép page (plugins/terkep-relief there).
//
//   const R = require('./relief.js')          // Node
//   window.VRGRelief                          // browser
//
// A grid is { w, h, west, north, dlon, dlat, z } — w × h cells, row 0 the northernmost, cell (i, j) centred at
// lon = west + (i + 0.5)·dlon, lat = north − (j + 0.5)·dlat; z a Float32Array of metres (NaN = no data).
//
//   R.at(g, lon, lat)                 -> metres (bilinear between cell centres), NaN outside
//   R.slope(g, lon, lat)              -> { slope (°), aspect (° from north, the way the ground faces), dzdx, dzdy }
//   R.shade(dzdx, dzdy, az, alt)      -> 0…1, the hillshade of one gradient for a light from az / alt (°)
//   R.contours(g, levels, box?, step?)-> [{ level, lines: [[[lon, lat], …], …] }]  marching squares, joined
//   R.interval(spanM)                 -> a round contour interval for a view whose heights span spanM metres
//   R.profile(g, a, b, n?)            -> { pts: [{ d, z, lon, lat }], dist, dz, gain, loss, min, max, maxSlope }
//   R.shadowed(g, lon, lat, sun, o?)  -> true when the terrain hides the sun from that spot
//   R.shadowView(g, view, sun, o?)    -> Uint8Array(view.w · view.h), 1 = in the terrain's shadow
//   R.distance([lon, lat], [lon, lat])-> metres (haversine)
//   R.delta(int16) / R.undelta(int16) -> the row-wise difference coding of a packed grid (pack / unpack)
//   R.pack(g, scale?) / R.unpack(meta, int16) -> heights as int16 steps of `scale` metres (0.1 m), NaN = -32768
//
// The grid is whatever the data is: Copernicus GLO-30 / GLO-90 (a surface model: roofs and trees are in it, 30 m
// apart), or the terrain tiles the VRG Térkép already has. Heights are metres above the EGM2008 geoid (≈ Balti
// magasság within a few decimetres in Hungary).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VRGRelief = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const RAD = Math.PI / 180, M_LAT = 111132.954, R_EARTH = 6371008.8;
  const mLon = lat => 111319.49 * Math.cos(lat * RAD);
  const NODATA = -32768;

  function at(g, lon, lat) {
    const x = (lon - g.west) / g.dlon - 0.5, y = (g.north - lat) / g.dlat - 0.5;
    if (!(x >= -0.5 && y >= -0.5 && x <= g.w - 0.5 && y <= g.h - 0.5)) return NaN;
    const i0 = Math.max(0, Math.min(g.w - 1, Math.floor(x))), j0 = Math.max(0, Math.min(g.h - 1, Math.floor(y)));
    const i1 = Math.min(g.w - 1, i0 + 1), j1 = Math.min(g.h - 1, j0 + 1);
    const fx = Math.max(0, Math.min(1, x - i0)), fy = Math.max(0, Math.min(1, y - j0));
    const z = g.z, a = z[j0 * g.w + i0], b = z[j0 * g.w + i1], c = z[j1 * g.w + i0], d = z[j1 * g.w + i1];
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
  }

  /** The gradient at a spot (metres per metre, east and north) from heights one cell either side. */
  function gradient(g, lon, lat) {
    const ex = at(g, lon + g.dlon, lat), wx = at(g, lon - g.dlon, lat);
    const nx = at(g, lon, lat + g.dlat), sx = at(g, lon, lat - g.dlat);
    const c = at(g, lon, lat);
    const dx = mLon(lat) * g.dlon, dy = M_LAT * g.dlat;
    const dzdx = isNaN(ex) || isNaN(wx) ? (isNaN(ex) ? (c - wx) / dx : (ex - c) / dx) : (ex - wx) / (2 * dx);
    const dzdy = isNaN(nx) || isNaN(sx) ? (isNaN(nx) ? (c - sx) / dy : (nx - c) / dy) : (nx - sx) / (2 * dy);
    return [dzdx, dzdy];
  }

  function slope(g, lon, lat) {
    const [dzdx, dzdy] = gradient(g, lon, lat);
    const s = Math.atan(Math.hypot(dzdx, dzdy)) / RAD;
    // the ground faces downhill: the direction of −gradient, from north clockwise
    let asp = Math.atan2(-dzdx, -dzdy) / RAD; if (asp < 0) asp += 360;
    return { slope: s, aspect: Math.hypot(dzdx, dzdy) < 1e-9 ? null : asp, dzdx, dzdy };
  }

  /** Lambert shading of a surface with gradient (dzdx, dzdy) under a light from azimuth az, altitude alt (degrees). */
  function shade(dzdx, dzdy, az, alt) {
    if (isNaN(dzdx) || isNaN(dzdy)) return 0;
    const nx = -dzdx, ny = -dzdy, nz = 1, nl = Math.hypot(nx, ny, nz);
    const lx = Math.sin(az * RAD) * Math.cos(alt * RAD), ly = Math.cos(az * RAD) * Math.cos(alt * RAD), lz = Math.sin(alt * RAD);
    return Math.max(0, (nx * lx + ny * ly + nz * lz) / nl);
  }

  // ---- contours ----------------------------------------------------------------------------------------------------

  /** A round interval giving about 8–25 lines across [spanM] metres of height. */
  function interval(spanM) {
    const steps = [1, 2, 2.5, 5, 10, 20, 25, 50, 100, 200, 250, 500];
    for (const s of steps) if (spanM / s <= 25) return s;
    return 1000;
  }

  /**
   * Contour lines at [levels] over the cells of [box] ({ i0, j0, i1, j1 }, inclusive; the whole grid by default),
   * every [step]-th cell. Marching squares on the cell centres, the segments joined into lines (closed rings end
   * where they began). Saddle cells are split by their centre value.
   */
  function contours(g, levels, box, step) {
    const st = Math.max(1, step | 0 || 1);
    const b = box || { i0: 0, j0: 0, i1: g.w - 1, j1: g.h - 1 };
    const i0 = Math.max(0, b.i0), j0 = Math.max(0, b.j0), i1 = Math.min(g.w - 1, b.i1), j1 = Math.min(g.h - 1, b.j1);
    const xs = [], ys = [];
    for (let i = i0; i <= i1; i += st) xs.push(i);
    for (let j = j0; j <= j1; j += st) ys.push(j);
    const Z = (ii, jj) => g.z[ys[jj] * g.w + xs[ii]];
    const lon = ii => g.west + (xs[ii] + 0.5) * g.dlon, lat = jj => g.north - (ys[jj] + 0.5) * g.dlat;
    const out = [];
    for (const L of levels) {
      const segs = [];
      // an edge point: the crossing on the edge between two grid nodes, keyed so neighbours share it
      const pt = (ia, ja, ib, jb) => {
        const za = Z(ia, ja), zb = Z(ib, jb), t = (L - za) / (zb - za);
        return { k: ia + ',' + ja + ',' + ib + ',' + jb, p: [lon(ia) + (lon(ib) - lon(ia)) * t, lat(ja) + (lat(jb) - lat(ja)) * t] };
      };
      for (let jj = 0; jj < ys.length - 1; jj++) for (let ii = 0; ii < xs.length - 1; ii++) {
        const a = Z(ii, jj), b2 = Z(ii + 1, jj), c = Z(ii + 1, jj + 1), d = Z(ii, jj + 1);
        if (isNaN(a) || isNaN(b2) || isNaN(c) || isNaN(d)) continue;
        const code = (a >= L ? 8 : 0) | (b2 >= L ? 4 : 0) | (c >= L ? 2 : 0) | (d >= L ? 1 : 0);
        if (code === 0 || code === 15) continue;
        const top = () => pt(ii, jj, ii + 1, jj), right = () => pt(ii + 1, jj, ii + 1, jj + 1);
        const bottom = () => pt(ii, jj + 1, ii + 1, jj + 1), left = () => pt(ii, jj, ii, jj + 1);
        const centre = (a + b2 + c + d) / 4 >= L;
        switch (code) {
          case 1: case 14: segs.push([left(), bottom()]); break;
          case 2: case 13: segs.push([bottom(), right()]); break;
          case 3: case 12: segs.push([left(), right()]); break;
          case 4: case 11: segs.push([top(), right()]); break;
          case 6: case 9: segs.push([top(), bottom()]); break;
          case 7: case 8: segs.push([left(), top()]); break;
          case 5: if (centre) { segs.push([left(), top()]); segs.push([bottom(), right()]); } else { segs.push([left(), bottom()]); segs.push([top(), right()]); } break;
          case 10: if (centre) { segs.push([left(), bottom()]); segs.push([top(), right()]); } else { segs.push([left(), top()]); segs.push([bottom(), right()]); } break;
        }
      }
      out.push({ level: L, lines: join(segs) });
    }
    return out;
  }

  /** Joins segments sharing an end into polylines. */
  function join(segs) {
    const ends = new Map();
    const add = (k, s) => { const l = ends.get(k); if (l) l.push(s); else ends.set(k, [s]); };
    segs.forEach((s, n) => { s.n = n; add(s[0].k, s); add(s[1].k, s); });
    const used = new Uint8Array(segs.length), lines = [];
    const other = (s, k) => (s[0].k === k ? s[1] : s[0]);
    const next = (k, from) => (ends.get(k) || []).find(s => !used[s.n] && s !== from);
    for (const s of segs) {
      if (used[s.n]) continue;
      used[s.n] = 1;
      const line = [s[0], s[1]];
      // forward from the second end, then backward from the first
      for (let k = s[1].k, cur = s; ;) { const n = next(k, cur); if (!n) break; used[n.n] = 1; const o = other(n, k); line.push(o); k = o.k; cur = n; }
      for (let k = s[0].k, cur = s; ;) { const n = next(k, cur); if (!n) break; used[n.n] = 1; const o = other(n, k); line.unshift(o); k = o.k; cur = n; }
      lines.push(line.map(e => e.p));
    }
    return lines;
  }

  // ---- distance, profile -------------------------------------------------------------------------------------------

  function distance(a, b) {
    const p1 = a[1] * RAD, p2 = b[1] * RAD, dp = p2 - p1, dl = (b[0] - a[0]) * RAD;
    const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  /** The heights along a straight line from a to b ([lon, lat]): n + 1 samples, and what a walker would climb. */
  function profile(g, a, b, n) {
    const dist = distance(a, b);
    const N = Math.max(2, n || Math.min(600, Math.ceil(dist / (M_LAT * g.dlat / 2)) || 2));
    const pts = [];
    for (let k = 0; k <= N; k++) {
      const t = k / N, lon = a[0] + (b[0] - a[0]) * t, lat = a[1] + (b[1] - a[1]) * t;
      pts.push({ d: dist * t, z: at(g, lon, lat), lon, lat });
    }
    let gain = 0, loss = 0, min = Infinity, max = -Infinity, maxSlope = 0;
    for (let k = 0; k < pts.length; k++) {
      const z = pts[k].z; if (isNaN(z)) continue;
      min = Math.min(min, z); max = Math.max(max, z);
      if (k > 0 && !isNaN(pts[k - 1].z)) {
        const dz = z - pts[k - 1].z, dd = pts[k].d - pts[k - 1].d;
        if (dz > 0) gain += dz; else loss -= dz;
        if (dd > 0) maxSlope = Math.max(maxSlope, Math.atan(Math.abs(dz) / dd) / RAD);
      }
    }
    return { pts, dist, dz: pts[pts.length - 1].z - pts[0].z, gain, loss, min, max, maxSlope };
  }

  // ---- the terrain's own shadow ------------------------------------------------------------------------------------

  /** The highest height in the grid (cached on it), the ceiling a ray towards the sun can stop at. */
  function top(g) {
    if (g._top == null) { let m = -Infinity; for (let k = 0; k < g.z.length; k++) if (g.z[k] > m) m = g.z[k]; g._top = m; }
    return g._top;
  }

  /**
   * Does the terrain hide the sun ({ azimuth, altitude } in degrees, lib/sun.js) from [lon, lat]? A ray from
   * [o.above] metres over the ground (0.5 m: a person's feet) towards the sun, in steps that start at about one cell
   * and grow; it stops at the grid's highest point, its edge or [o.maxM] metres (20 km).
   */
  function shadowed(g, lon, lat, sun, o) {
    if (!sun || sun.altitude <= 0) return true;
    const z0 = at(g, lon, lat); if (isNaN(z0)) return false;
    const opt = o || {}, above = opt.above == null ? 0.5 : opt.above, maxM = opt.maxM || 20000;
    const tanA = Math.tan(sun.altitude * RAD), ceil = top(g);
    const ex = Math.sin(sun.azimuth * RAD), ny = Math.cos(sun.azimuth * RAD);
    const kx = 1 / mLon(lat), ky = 1 / M_LAT;
    const cell = Math.min(mLon(lat) * g.dlon, M_LAT * g.dlat);
    let d = cell, step = cell;
    const start = z0 + above;
    while (d <= maxM) {
      const zr = start + d * tanA;
      if (zr > ceil) return false;
      const zt = at(g, lon + ex * d * kx, lat + ny * d * ky);
      if (isNaN(zt)) return false;
      if (zt > zr) return true;
      step = cell * (1 + d / (40 * cell));       // finer near the spot, coarser far away
      d += step;
    }
    return false;
  }

  /** The terrain's shadow over a view { west, north, east, south, w, h } (pixels row by row, north first). */
  function shadowView(g, view, sun, o) {
    const out = new Uint8Array(view.w * view.h);
    if (!sun || sun.altitude <= 0) { out.fill(1); return out; }
    for (let y = 0; y < view.h; y++) {
      const lat = view.north - (y + 0.5) / view.h * (view.north - view.south);
      for (let x = 0; x < view.w; x++) {
        const lon = view.west + (x + 0.5) / view.w * (view.east - view.west);
        out[y * view.w + x] = shadowed(g, lon, lat, sun, o) ? 1 : 0;
      }
    }
    return out;
  }

  // ---- the packed form (the Data Vault page carries its grids this way) -------------------------------------------

  /** Row-wise differences: each value minus its left neighbour (the first of a row as it is). int16 wraps both ways, so it round-trips. */
  function delta(a, width) {
    const w = width || a.w, out = new Int16Array(a.length);
    for (let k = 0; k < a.length; k++) out[k] = (k % w === 0) ? a[k] : (a[k] - a[k - 1]);
    return out;
  }
  function undelta(a, w) {
    const out = new Int16Array(a.length);
    for (let k = 0; k < a.length; k++) out[k] = (k % w === 0) ? a[k] : (out[k - 1] + a[k]);
    return out;
  }

  /** Heights as int16 steps of [scale] metres (no data = −32768 before differencing, kept as a run of zeros after). */
  function pack(g, scale) {
    const s = scale || 0.1, q = new Int16Array(g.w * g.h);
    for (let k = 0; k < q.length; k++) { const z = g.z[k]; q[k] = isNaN(z) ? NODATA : Math.max(-32767, Math.min(32767, Math.round(z / s))); }
    q.w = g.w;
    return { meta: { w: g.w, h: g.h, west: g.west, north: g.north, dlon: g.dlon, dlat: g.dlat, scale: s }, data: delta(q) };
  }
  function unpack(meta, data) {
    const q = undelta(data, meta.w), z = new Float32Array(q.length);
    for (let k = 0; k < q.length; k++) z[k] = q[k] === NODATA ? NaN : q[k] * meta.scale;
    return { w: meta.w, h: meta.h, west: meta.west, north: meta.north, dlon: meta.dlon, dlat: meta.dlat, z };
  }

  return { at, gradient, slope, shade, contours, interval, join, distance, profile, shadowed, shadowView, top, delta, undelta, pack, unpack, NODATA, mLon, M_LAT };
});
