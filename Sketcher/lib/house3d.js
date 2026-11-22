// Sketcher/lib/house3d.js — Ház 3D (dev line skcam, stage K5): a house (or a room) as a 3D point cloud from photos
// taken while walking around it. The reconstruction is COLMAP's (structure from motion, BSD licence), run on the PC
// by Sketcher/tools/house3d.js as a separate program; this file is the pure half shared by that script, the Desktop
// page's viewer and the tests: it reads COLMAP's text model, turns it upright, keeps the reliable points, and holds the
// scale and the measurements.
//
// A photo reconstruction has the right shape but no size: one true distance (a tape, the laser of K2, the OSM width of
// the building, two marks a known distance apart) gives the scale, and every other distance follows (setScale).
//
// The file (<name>.house3d.json, kind "vrg-house3d", v 1):
//   { name, created, tool: {colmap, dense}, report: {images, registered, points, err},
//     up: [x,y,z] (already applied), pts: [x,y,z, …] (model units), rgb: [r,g,b, …], cams: [{name, c:[x,y,z], d:[x,y,z]}],
//     scale: {mmPerUnit, a:[x,y,z], b:[x,y,z], mm} | null, measures: [{a, b, label?}] }
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.VRGHouse3d = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const KIND = 'vrg-house3d', V = 1;

  // ---- COLMAP's text model --------------------------------------------------------------------------------------
  const lines = t => String(t || '').split(/\r?\n/).filter(l => l.trim() && l[0] !== '#');
  /** cameras.txt → { id: {model, w, h, params} } */
  function parseCameras(t) {
    const out = {};
    lines(t).forEach(l => { const p = l.trim().split(/\s+/); out[p[0]] = { model: p[1], w: +p[2], h: +p[3], params: p.slice(4).map(Number) }; });
    return out;
  }
  /** images.txt → [{id, name, q:[w,x,y,z], t:[x,y,z], cam}] (every other line is the 2D points: skipped) */
  function parseImages(t) {
    const L = String(t || '').split(/\r?\n/).filter(l => l[0] !== '#'), out = [];
    for (let i = 0; i < L.length; i++) {
      const p = L[i].trim().split(/\s+/);
      if (p.length >= 10 && /^\d+$/.test(p[0]) && /\.(jpe?g|png|tiff?|bmp|ppm)$/i.test(p[9])) {
        out.push({ id: +p[0], q: p.slice(1, 5).map(Number), t: p.slice(5, 8).map(Number), cam: p[8], name: p.slice(9).join(' ') });
        i++;                                                  // its POINTS2D line
      }
    }
    return out;
  }
  /** points3D.txt → [{xyz, rgb, err, track}] */
  function parsePoints(t) {
    return lines(t).map(l => { const p = l.trim().split(/\s+/); return { xyz: [+p[1], +p[2], +p[3]], rgb: [+p[4], +p[5], +p[6]], err: +p[7], track: (p.length - 8) / 2 }; });
  }

  // ---- geometry ---------------------------------------------------------------------------------------------------
  /** The rotation matrix (rows) of a unit quaternion [w, x, y, z]. */
  function rot(q) {
    const [w, x, y, z] = q, n = Math.hypot(w, x, y, z) || 1, a = w / n, b = x / n, c = y / n, d = z / n;
    return [[1 - 2 * (c * c + d * d), 2 * (b * c - a * d), 2 * (b * d + a * c)],
            [2 * (b * c + a * d), 1 - 2 * (b * b + d * d), 2 * (c * d - a * b)],
            [2 * (b * d - a * c), 2 * (c * d + a * b), 1 - 2 * (b * b + c * c)]];
  }
  const tmul = (R, v) => [R[0][0] * v[0] + R[1][0] * v[1] + R[2][0] * v[2], R[0][1] * v[0] + R[1][1] * v[1] + R[2][1] * v[2], R[0][2] * v[0] + R[1][2] * v[1] + R[2][2] * v[2]];   // Rᵀ v
  const norm = v => { const n = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / n, v[1] / n, v[2] / n]; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  /** A camera in world terms: its centre (−Rᵀt), its viewing direction and its up (image y runs down). */
  function camera(img) {
    const R = rot(img.q), c = tmul(R, img.t).map(v => -v);
    return { name: img.name, c, d: norm(tmul(R, [0, 0, 1])), up: norm(tmul(R, [0, -1, 0])) };
  }
  /** The rotation (rows) that turns [u] into +Y, about the axis square to both (Rodrigues). */
  function toUp(u) {
    const a = norm(u), Y = [0, 1, 0], c = dot(a, Y);
    if (c > 1 - 1e-12) return [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    if (c < -1 + 1e-12) return [[1, 0, 0], [0, -1, 0], [0, 0, -1]];
    const k = norm(cross(a, Y)), s = Math.sqrt(1 - c * c), C = 1 - c, [x, y, z] = k;
    return [[c + x * x * C, x * y * C - z * s, x * z * C + y * s], [y * x * C + z * s, c + y * y * C, y * z * C - x * s], [z * x * C - y * s, z * y * C + x * s, c + z * z * C]];
  }
  const mul = (R, v) => [R[0][0] * v[0] + R[0][1] * v[1] + R[0][2] * v[2], R[1][0] * v[0] + R[1][1] * v[1] + R[1][2] * v[2], R[2][0] * v[0] + R[2][1] * v[1] + R[2][2] * v[2]];

  /**
   * The house file from COLMAP's text model: the cameras' mean "up" turned to +Y (a phone is held upright while
   * walking round), the model centred on the cameras' middle, the points kept when seen in ≥ [minTrack] photos with a
   * reprojection error ≤ [maxErr] px and not far outliers, at most [maxPoints] of them.
   */
  function build(model, opts) {
    const o = Object.assign({ minTrack: 3, maxErr: 2, maxPoints: 250000 }, opts || {});
    const imgs = parseImages(model.images), pts = parsePoints(model.points), cams = imgs.map(camera);
    const { up, R, tr } = frameOf(model);
    let good = pts.filter(p => p.track >= o.minTrack && p.err <= o.maxErr).map(p => ({ xyz: tr(p.xyz), rgb: p.rgb }));
    // far outliers: beyond 3 × the 95th percentile distance from the middle
    if (good.length > 20) {
      const ds = good.map(p => Math.hypot(...p.xyz)).sort((a, b) => a - b), lim = ds[Math.floor(ds.length * 0.95)] * 3;
      good = good.filter(p => Math.hypot(...p.xyz) <= lim);
    }
    if (good.length > o.maxPoints) { const k = good.length / o.maxPoints; good = good.filter((p, i) => Math.floor(i / k) !== Math.floor((i - 1) / k)); }
    const r4 = v => Math.round(v * 1e4) / 1e4;
    const errs = pts.map(p => p.err).filter(isFinite);
    return {
      kind: KIND, v: V, name: o.name || '', created: o.now || Date.now(), tool: o.tool || {},
      report: { images: o.images || imgs.length, registered: imgs.length, points: good.length, err: errs.length ? Math.round(errs.reduce((a, b) => a + b, 0) / errs.length * 100) / 100 : null },
      up: up.map(r4), pts: [].concat(...good.map(p => p.xyz.map(r4))), rgb: [].concat(...good.map(p => p.rgb)),
      cams: cams.map(c => ({ name: c.name, c: tr(c.c).map(r4), d: mul(R, c.d).map(r4) })).sort((a, b) => a.name < b.name ? -1 : 1),
      scale: null, measures: [],
    };
  }

  /** The model's frame: the cameras' mean up turned to +Y, the cameras' middle at the origin. */
  function frameOf(model) {
    const cams = parseImages(model.images).map(camera);
    if (!cams.length) throw new Error('A modellben nincs egy elhelyezett fotó sem.');
    const up = norm(cams.reduce((s, c) => [s[0] + c.up[0], s[1] + c.up[1], s[2] + c.up[2]], [0, 0, 0]));
    const R = toUp(up), mid = cams.reduce((s, c) => [s[0] + c.c[0] / cams.length, s[1] + c.c[1] / cams.length, s[2] + c.c[2] / cams.length], [0, 0, 0]);
    return { up, R, mid, tr: p => mul(R, [p[0] - mid[0], p[1] - mid[1], p[2] - mid[2]]) };
  }
  /** The dense cloud (parsePly) in place of the sparse points, in the same frame; at most [maxPoints]. */
  function withDense(h, model, dense, maxPoints) {
    const { tr } = frameOf(model), max = maxPoints || 400000, k = Math.max(1, dense.length / max), r4 = v => Math.round(v * 1e4) / 1e4;
    const keep = dense.filter((p, i) => Math.floor(i / k) !== Math.floor((i - 1) / k) || k === 1);
    const pts = [], rgb = [];
    keep.forEach(p => { tr(p.xyz).forEach(v => pts.push(r4(v))); rgb.push(p.rgb[0], p.rgb[1], p.rgb[2]); });
    return Object.assign({}, h, { pts, rgb, report: Object.assign({}, h.report, { points: keep.length, dense: true }) });
  }

  // ---- scale and measures -----------------------------------------------------------------------------------------
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  /** The scale from two model points a true [mm] apart. */
  function setScale(h, a, b, mm) {
    const d = dist(a, b); if (!(d > 0) || !(mm > 0)) throw new Error('A léptékhez két különböző pont és egy pozitív távolság kell.');
    return Object.assign({}, h, { scale: { mmPerUnit: mm / d, a, b, mm } });
  }
  /** A distance in mm between two model points, or null before the scale is set. */
  function mm(h, a, b) { return h && h.scale ? Math.round(dist(a, b) * h.scale.mmPerUnit) : null; }
  /** Is this a house file? */
  const is = o => !!o && o.kind === KIND && Array.isArray(o.pts) && Array.isArray(o.cams);
  /** The points as typed arrays for drawing. */
  function arrays(h) { return { pos: new Float32Array(h.pts), col: new Uint8Array(h.rgb), n: h.pts.length / 3 }; }

  // ---- PLY (a dense cloud from COLMAP's stereo_fusion, when the PC has CUDA) ------------------------------------------
  /** Reads an ASCII or binary little-endian PLY's vertices (x y z [nx ny nz] red green blue) → [{xyz, rgb}]. */
  function parsePly(buf) {
    const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    let i = 0, head = '';
    while (i < b.length && !head.endsWith('end_header\n')) head += String.fromCharCode(b[i++]);
    const H = head.split('\n'), fmt = (H.find(l => l.startsWith('format')) || '').split(/\s+/)[1];
    const n = +((H.find(l => l.startsWith('element vertex')) || '').split(/\s+/)[2] || 0);
    const props = []; let inV = false;
    H.forEach(l => { if (l.startsWith('element')) inV = l.startsWith('element vertex'); else if (inV && l.startsWith('property')) { const p = l.split(/\s+/); props.push({ type: p[1], name: p[2] }); } });
    const size = { float: 4, float32: 4, double: 8, uchar: 1, uint8: 1, char: 1, int8: 1, short: 2, ushort: 2, int: 4, uint: 4, int32: 4, uint32: 4 };
    const at = k => props.findIndex(p => p.name === k), ix = ['x', 'y', 'z'].map(at), ic = ['red', 'green', 'blue'].map(at), out = [];
    if (fmt === 'ascii') {
      const rows = new TextDecoder().decode(b.subarray(i)).split('\n').filter(Boolean).slice(0, n);
      rows.forEach(r => { const v = r.trim().split(/\s+/).map(Number); out.push({ xyz: ix.map(k => v[k]), rgb: ic.map(k => k < 0 ? 200 : v[k]) }); });
      return out;
    }
    if (fmt !== 'binary_little_endian') throw new Error('Ismeretlen PLY formátum: ' + fmt);
    const dv = new DataView(b.buffer, b.byteOffset + i), rd = (t, o) => t === 'float' || t === 'float32' ? dv.getFloat32(o, true) : t === 'double' ? dv.getFloat64(o, true)
      : t === 'uchar' || t === 'uint8' ? dv.getUint8(o) : t === 'char' || t === 'int8' ? dv.getInt8(o) : t === 'short' ? dv.getInt16(o, true) : t === 'ushort' ? dv.getUint16(o, true)
      : t === 'int' || t === 'int32' ? dv.getInt32(o, true) : dv.getUint32(o, true);
    const offs = []; let stride = 0; props.forEach(p => { offs.push(stride); stride += size[p.type] || 4; });
    for (let v = 0; v < n; v++) {
      const base = v * stride, val = k => rd(props[k].type, base + offs[k]);
      out.push({ xyz: ix.map(val), rgb: ic.map(k => k < 0 ? 200 : val(k)) });
    }
    return out;
  }

  return { KIND, V, parseCameras, parseImages, parsePoints, rot, camera, toUp, frameOf, build, withDense, setScale, mm, is, arrays, parsePly, dist };
});
