// heights.js — measured building heights for the VRG Térkép (the B layer): footprints with their height in a compact
// binary file (data/bp-heights.bin, built by tools/build-bp-heights.js from the Budapest Open Data Atlas
// "Épületmagasság" or any GeoJSON of footprints with a height), a grid index, and the rule that picks a building's
// height: measured > OSM height > OSM levels × 3.2 m > 7 m. UMD and pure; test/heights.test.js runs it in Node.
//
//   const H = require('./heights.js')   // Node            window.VRGHeights   // browser
//   H.encode(buildings, meta)  -> Uint8Array        buildings: [{ rings: [[[lon, lat], …], …], h }]  (h in metres)
//   H.decode(buffer)           -> set               { meta, n, h(i), rings(i), bbox(i) }
//   H.index(set, cell?)        -> idx               a grid of 0.005° cells
//   H.inBox(set, idx, box)     -> [ids]             the buildings whose box meets { west, south, east, north }
//   H.at(set, idx, lon, lat)   -> id | -1           the building the point is in
//   H.pick(props, measured)    -> { h, from }       from: 'mért' | 'osm' | 'szint' | 'alap'
//   H.eovToWgs(east, north)    -> [lon, lat]        Hungarian EOV (EPSG:23700: Y east ~650 000, X north ~200 000) to WGS84
//
// The file: "VRGH", u16 version 1, u16 0, u32 count, u32 meta length, the meta JSON; then per building: u16 height in
// decimetres, u8 rings, per ring u16 points, the first point as two i32 micro-degrees, the rest as i16 differences
// (a longer step is split into shorter ones on writing).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VRGHeights = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const U = 1e6, MAXD = 32767;

  function encode(buildings, meta) {
    let size = 0;
    const kept = [];
    for (const b of buildings) {
      const h = Math.round((b.h || 0) * 10);
      if (!(h > 0) || !b.rings || !b.rings.length) continue;
      const rings = b.rings.map(r => {
        const pts = [];
        for (const p of r) {
          const q = [Math.round(p[0] * U), Math.round(p[1] * U)];
          const last = pts[pts.length - 1];
          if (last) {
            // split a step longer than an i16 difference
            const n = Math.ceil(Math.max(Math.abs(q[0] - last[0]), Math.abs(q[1] - last[1])) / MAXD);
            for (let k = 1; k < n; k++) pts.push([Math.round(last[0] + (q[0] - last[0]) * k / n), Math.round(last[1] + (q[1] - last[1]) * k / n)]);
            if (q[0] === last[0] && q[1] === last[1]) continue;
          }
          pts.push(q);
        }
        return pts;
      }).filter(r => r.length >= 3 && r.length < 65536).slice(0, 255);
      if (!rings.length) continue;
      kept.push({ h: Math.min(65535, h), rings });
      size += 3 + rings.reduce((s, r) => s + 2 + 8 + 4 * (r.length - 1), 0);
    }
    const m = new TextEncoder().encode(JSON.stringify(Object.assign({}, meta, { count: kept.length })));
    const out = new Uint8Array(16 + m.length + size), dv = new DataView(out.buffer);
    out.set([86, 82, 71, 72], 0); dv.setUint16(4, 1, true); dv.setUint16(6, 0, true); dv.setUint32(8, kept.length, true); dv.setUint32(12, m.length, true);
    out.set(m, 16);
    let o = 16 + m.length;
    for (const b of kept) {
      dv.setUint16(o, b.h, true); dv.setUint8(o + 2, b.rings.length); o += 3;
      for (const r of b.rings) {
        dv.setUint16(o, r.length, true); dv.setInt32(o + 2, r[0][0], true); dv.setInt32(o + 6, r[0][1], true); o += 10;
        for (let k = 1; k < r.length; k++) { dv.setInt16(o, r[k][0] - r[k - 1][0], true); dv.setInt16(o + 2, r[k][1] - r[k - 1][1], true); o += 4; }
      }
    }
    return out;
  }

  function decode(buf) {
    const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    if (u8[0] !== 86 || u8[1] !== 82 || u8[2] !== 71 || u8[3] !== 72) throw new Error('not a VRGH heights file');
    if (dv.getUint16(4, true) !== 1) throw new Error('heights file version ' + dv.getUint16(4, true));
    const n = dv.getUint32(8, true), ml = dv.getUint32(12, true);
    const meta = JSON.parse(new TextDecoder().decode(u8.subarray(16, 16 + ml)));
    const hdm = new Uint16Array(n), ringStart = new Uint32Array(n + 1), ringPt = [], coords = [], box = new Float64Array(4 * n);
    let o = 16 + ml, nr = 0;
    for (let i = 0; i < n; i++) {
      hdm[i] = dv.getUint16(o, true); const rings = dv.getUint8(o + 2); o += 3;
      ringStart[i] = nr;
      let w = Infinity, s = Infinity, e = -Infinity, no = -Infinity;
      for (let r = 0; r < rings; r++) {
        const cnt = dv.getUint16(o, true); let x = dv.getInt32(o + 2, true), y = dv.getInt32(o + 6, true); o += 10;
        ringPt.push(coords.length / 2, cnt); nr++;
        coords.push(x, y);
        for (let k = 1; k < cnt; k++) { x += dv.getInt16(o, true); y += dv.getInt16(o + 2, true); o += 4; coords.push(x, y); }
        if (r === 0) for (let k = coords.length - 2 * cnt; k < coords.length; k += 2) { w = Math.min(w, coords[k]); e = Math.max(e, coords[k]); s = Math.min(s, coords[k + 1]); no = Math.max(no, coords[k + 1]); }
      }
      box[4 * i] = w / U; box[4 * i + 1] = s / U; box[4 * i + 2] = e / U; box[4 * i + 3] = no / U;
    }
    ringStart[n] = nr;
    const C = Int32Array.from(coords), RP = Uint32Array.from(ringPt);
    return {
      meta, n,
      h: i => hdm[i] / 10,
      bbox: i => [box[4 * i], box[4 * i + 1], box[4 * i + 2], box[4 * i + 3]],
      rings(i) {
        const out = [];
        for (let r = ringStart[i]; r < ringStart[i + 1]; r++) {
          const at = RP[2 * r], cnt = RP[2 * r + 1], ring = [];
          for (let k = 0; k < cnt; k++) ring.push([C[2 * (at + k)] / U, C[2 * (at + k) + 1] / U]);
          if (ring[0][0] !== ring[cnt - 1][0] || ring[0][1] !== ring[cnt - 1][1]) ring.push(ring[0].slice());
          out.push(ring);
        }
        return out;
      },
      extent() { let w = Infinity, s = Infinity, e = -Infinity, no = -Infinity; for (let i = 0; i < n; i++) { w = Math.min(w, box[4 * i]); s = Math.min(s, box[4 * i + 1]); e = Math.max(e, box[4 * i + 2]); no = Math.max(no, box[4 * i + 3]); } return { west: w, south: s, east: e, north: no }; },
    };
  }

  function index(set, cell) {
    const c = cell || 0.005, cells = new Map();
    for (let i = 0; i < set.n; i++) {
      const [w, s, e, n] = set.bbox(i);
      for (let x = Math.floor(w / c); x <= Math.floor(e / c); x++) for (let y = Math.floor(s / c); y <= Math.floor(n / c); y++) {
        const k = x + ',' + y; const l = cells.get(k); if (l) l.push(i); else cells.set(k, [i]);
      }
    }
    return { cell: c, cells };
  }

  function inBox(set, idx, b, limit) {
    const c = idx.cell, seen = new Set(), out = [];
    for (let x = Math.floor(b.west / c); x <= Math.floor(b.east / c); x++) for (let y = Math.floor(b.south / c); y <= Math.floor(b.north / c); y++) {
      for (const i of idx.cells.get(x + ',' + y) || []) {
        if (seen.has(i)) continue; seen.add(i);
        const [w, s, e, n] = set.bbox(i);
        if (e < b.west || w > b.east || n < b.south || s > b.north) continue;
        out.push(i);
        if (limit && out.length >= limit) return out;
      }
    }
    return out;
  }

  function inRing(r, x, y) {
    let inside = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function at(set, idx, lon, lat) {
    for (const i of inBox(set, idx, { west: lon, east: lon, south: lat, north: lat })) {
      const rs = set.rings(i);
      if (inRing(rs[0], lon, lat) && !rs.slice(1).some(r => inRing(r, lon, lat))) return i;
    }
    return -1;
  }

  /** A building's height: measured when there is one, else OSM's height, else its levels × 3.2 m, else 7 m. */
  function pick(props, measured) {
    if (measured > 0) return { h: measured, from: 'mért' };
    const p = props || {}, h = parseFloat(p.height), lv = parseFloat(p['building:levels'] != null ? p['building:levels'] : p.levels);
    if (h > 0) return { h, from: 'osm' };
    if (lv > 0) return { h: lv * 3.2, from: 'szint' };
    return { h: 7, from: 'alap' };
  }

  // ---- EOV (EPSG:23700): Swiss oblique Mercator on GRS67, then HD72 → WGS84 by a three-parameter shift ---------------
  const RAD = Math.PI / 180;
  function eovToWgs(E, N0) {
    // the projection (PROJ somerc): lat0 47°08′39.8174″, lon0 19°02′54.8584″, k0 0.99993, x0 650 000, y0 200 000
    const a = 6378160, f = 1 / 298.247167427, e2 = 2 * f - f * f, e = Math.sqrt(e2);
    const phi0 = 47.14439372222222 * RAD, lam0 = 19.04857177777778 * RAD, k0 = 0.99993;
    const sp = Math.sin(phi0), cp = Math.cos(phi0);
    const c = Math.sqrt(1 + e2 * cp ** 4 / (1 - e2));
    const hlf_e = e / 2, cp2 = Math.asin(sp / c);
    const K = Math.log(Math.tan(Math.PI / 4 + cp2 / 2)) - c * (Math.log(Math.tan(Math.PI / 4 + phi0 / 2)) - hlf_e * Math.log((1 + e * sp) / (1 - e * sp)));
    const R = k0 * a * Math.sqrt(1 - e2) / (1 - e2 * sp * sp);
    const x = (E - 650000) / R, y = (N0 - 200000) / R;
    // inverse
    const phipp = 2 * (Math.atan(Math.exp(y)) - Math.PI / 4), lampp = x;
    const cosp = Math.cos(phipp);
    const phip = Math.asin(Math.cos(cp2) * Math.sin(phipp) + Math.sin(cp2) * cosp * Math.cos(lampp));
    const lamp = Math.asin(cosp * Math.sin(lampp) / Math.cos(phip));
    const con = (K - Math.log(Math.tan(Math.PI / 4 + phip / 2))) / c;
    let phi = phip;
    for (let i = 0; i < 12; i++) {
      const es = e * Math.sin(phi);
      const del = -(Math.log(Math.tan(Math.PI / 4 + phi / 2)) - hlf_e * Math.log((1 + es) / (1 - es)) + con) * (1 - es * es) * Math.cos(phi) / (1 - e2);
      phi += del; if (Math.abs(del) < 1e-12) break;
    }
    const lam = lamp / c + lam0;
    // HD72 (GRS67) → WGS84: geocentric shift (52.17, −71.82, −14.9) m
    const N = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
    const gx = N * Math.cos(phi) * Math.cos(lam) + 52.17, gy = N * Math.cos(phi) * Math.sin(lam) - 71.82, gz = N * (1 - e2) * Math.sin(phi) - 14.9;
    const A = 6378137, F = 1 / 298.257223563, E2 = 2 * F - F * F, p = Math.hypot(gx, gy);
    let lat = Math.atan2(gz, p * (1 - E2));
    for (let i = 0; i < 6; i++) { const Nn = A / Math.sqrt(1 - E2 * Math.sin(lat) ** 2); lat = Math.atan2(gz + E2 * Nn * Math.sin(lat), p); }
    return [Math.atan2(gy, gx) / RAD, lat / RAD];
  }

  return { encode, decode, index, inBox, at, inRing, pick, eovToWgs };
});
