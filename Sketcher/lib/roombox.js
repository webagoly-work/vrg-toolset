// Sketcher/lib/roombox.js — Szobadoboz (dev line skcam, stage K1): the sketched room raised to its ceiling height,
// with the Fotópont photos projected back onto its walls from the point they were taken. Pure maths, no DOM, no
// network: the Desktop page (lib/roombox-gl.js draws it) and node tests use the same functions.
//
// Why it works with only four photos: photos taken by turning on one spot have no parallax, so they carry no depth.
// The depth comes from the sketch instead: the plan's room outline in mm (the package's plan.data.floors), the photo
// point's position (plan.photos x, y) and the side each photo faces (deg). See docs/sketcher/CAMERA-LINE.md and
// docs/research/2026-11-20_room-capture-and-measurement.md §1.
//
// Coordinates. The plan: x to the right, y DOWN, millimetres; a shot's deg is 0 = up on the sketch (É), 90 = right (K),
// the same as Planner and the Desktop page's wedges. The 3D world: X = plan x, Y = up (floor 0), Z = plan y.
//
// The survey file keeps the corrections the user makes in an optional key `box` (v2 stays v2, an old file opens
// unchanged): { h: { <room id>: mm }, eye: mm, shots: { "<point id>/<deg>": { yaw, pitch, f35 } } }.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.VRGRoomBox = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const DIAG35 = Math.hypot(36, 24);          // the 35 mm frame's diagonal: "equivalent" focal lengths are diagonal-based
  const DEFAULTS = { f35: 26, eye: 1400, h: 2700 };   // a phone's main lens (1×), a hand-held phone, Level.GROUND
  const MAX_SHOTS = 8;                         // WebGL 1 guarantees 8 texture units in a fragment shader
  const rad = d => d * Math.PI / 180;

  // ---- field of view -------------------------------------------------------------------------------------------
  /** Horizontal and vertical half-angle tangents for a photo w × h taken at a 35 mm-equivalent focal length. */
  function fov(f35, w, h) {
    const f = f35 > 0 ? f35 : DEFAULTS.f35, W = w > 0 ? w : 4, H = h > 0 ? h : 3, d = Math.hypot(W, H);
    const tw = (DIAG35 * W / d) / 2 / f, th = (DIAG35 * H / d) / 2 / f;
    return { tanH: tw, tanV: th, h: 2 * Math.atan(tw) * 180 / Math.PI, v: 2 * Math.atan(th) * 180 / Math.PI };
  }

  // ---- EXIF: the few tags the box needs (focal length, orientation, size) ------------------------------------------
  /** Reads a JPEG's EXIF. Returns {} for anything that is not a JPEG with an Exif block. */
  function exif(buf) {
    const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf || []);
    const out = {};
    if (b.length < 4 || b[0] !== 0xFF || b[1] !== 0xD8) return out;
    let p = 2;
    while (p + 4 <= b.length) {
      if (b[p] !== 0xFF) break;
      const m = b[p + 1], len = (b[p + 2] << 8) | b[p + 3];
      if (m === 0xDA || m === 0xD9) break;                        // image data: no more metadata
      if (m === 0xE1 && b[p + 4] === 0x45 && b[p + 5] === 0x78 && b[p + 6] === 0x69 && b[p + 7] === 0x66) { tiff(b, p + 10, out); break; }
      p += 2 + len;
    }
    return out;
  }
  function tiff(b, t, out) {
    if (t + 8 > b.length) return;
    const le = b[t] === 0x49;                                     // "II" little endian, "MM" big endian
    const u16 = o => le ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1];
    const u32 = o => (le ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) : ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3])) >>> 0;
    const val = (e) => {                                          // SHORT, LONG or RATIONAL, one value
      const type = u16(e + 2), vo = e + 8;
      if (type === 3) return u16(vo);
      if (type === 4) return u32(vo);
      if (type === 5) { const o = t + u32(vo); if (o + 8 > b.length) return undefined; const d = u32(o + 4); return d ? u32(o) / d : undefined; }
      return undefined;
    };
    const ifd = (o, fn) => { if (o + 2 > b.length) return; const n = u16(o); for (let i = 0; i < n; i++) { const e = o + 2 + i * 12; if (e + 12 > b.length) return; fn(u16(e), e); } };
    let sub = 0;
    ifd(t + u32(t + 4), (tag, e) => { if (tag === 0x0112) out.orient = val(e); else if (tag === 0x8769) sub = t + u32(e + 8); });
    if (sub) ifd(sub, (tag, e) => {
      if (tag === 0xA405) { const v = val(e); if (v) out.f35 = v; }
      else if (tag === 0x920A) out.focal = val(e);
      else if (tag === 0xA002) out.w = val(e);
      else if (tag === 0xA003) out.h = val(e);
    });
  }

  // ---- plane geometry ------------------------------------------------------------------------------------------
  function signedArea(poly) { let a = 0; for (let i = 0; i < poly.length; i++) { const q = poly[(i + 1) % poly.length]; a += poly[i][0] * q[1] - q[0] * poly[i][1]; } return a / 2; }
  function inside(pt, poly) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
    }
    return c;
  }
  function centroid(poly) {
    let a = 0, x = 0, y = 0;
    for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length], k = p[0] * q[1] - q[0] * p[1]; a += k; x += (p[0] + q[0]) * k; y += (p[1] + q[1]) * k; }
    if (Math.abs(a) < 1e-9) { const n = poly.length || 1; return [poly.reduce((s, p) => s + p[0], 0) / n, poly.reduce((s, p) => s + p[1], 0) / n]; }
    return [x / (3 * a), y / (3 * a)];
  }
  /** Ear clipping: triangles (index triples) of a simple polygon, either winding. */
  function triangulate(poly) {
    const n = poly.length; if (n < 3) return [];
    const ccw = signedArea(poly) > 0, idx = []; for (let i = 0; i < n; i++) idx.push(i);
    const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const tri = [];
    let guard = 0;
    while (idx.length > 3 && guard++ < 10000) {
      let cut = false;
      for (let i = 0; i < idx.length; i++) {
        const ia = idx[(i + idx.length - 1) % idx.length], ib = idx[i], ic = idx[(i + 1) % idx.length];
        const a = poly[ia], b = poly[ib], c = poly[ic], cr = cross(a, b, c);
        if (ccw ? cr <= 0 : cr >= 0) continue;                    // reflex corner
        let any = false;
        for (const j of idx) {
          if (j === ia || j === ib || j === ic) continue;
          const p = poly[j], c1 = cross(a, b, p), c2 = cross(b, c, p), c3 = cross(c, a, p);
          if (ccw ? (c1 >= 0 && c2 >= 0 && c3 >= 0) : (c1 <= 0 && c2 <= 0 && c3 <= 0)) { any = true; break; }
        }
        if (any) continue;
        tri.push([ia, ib, ic]); idx.splice(i, 1); cut = true; break;
      }
      if (!cut) break;                                            // degenerate outline: give what we have
    }
    if (idx.length === 3) tri.push([idx[0], idx[1], idx[2]]);
    return tri;
  }
  /** The room's walls, each with its inward unit normal (plan coordinates). */
  function walls(poly) {
    const out = [], c = centroid(poly);
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
      if (len < 1) continue;
      let n = [-dy / len, dx / len];
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], probe = [mid[0] + n[0] * 5, mid[1] + n[1] * 5];
      if (!inside(probe, poly)) n = [-n[0], -n[1]];
      if (!inside([mid[0] + n[0] * 5, mid[1] + n[1] * 5], poly) && (c[0] - mid[0]) * n[0] + (c[1] - mid[1]) * n[1] < 0) n = [-n[0], -n[1]];
      out.push({ i, a, b, len, n, mid });
    }
    return out;
  }
  function segX(p, q, a, b) {                                     // do segments p–q and a–b cross (strictly)?
    const d = (q[0] - p[0]) * (b[1] - a[1]) - (q[1] - p[1]) * (b[0] - a[0]);
    if (Math.abs(d) < 1e-9) return false;
    const t = ((a[0] - p[0]) * (b[1] - a[1]) - (a[1] - p[1]) * (b[0] - a[0])) / d, u = ((a[0] - p[0]) * (q[1] - p[1]) - (a[1] - p[1]) * (q[0] - p[0])) / d;
    return t > 1e-6 && t < 1 - 1e-6 && u > 1e-6 && u < 1 - 1e-6;
  }
  /** How much of wall w is in plain sight from plan point cam (0…1): an L-shaped room hides part of itself. */
  function seen(cam, w, all) {
    let n = 0; const K = 7;
    for (let k = 1; k <= K; k++) {
      const t = k / (K + 1), s = [w.a[0] + (w.b[0] - w.a[0]) * t + w.n[0] * 2, w.a[1] + (w.b[1] - w.a[1]) * t + w.n[1] * 2];
      if (!all.some(o => o !== w && segX(cam, s, o.a, o.b))) n++;
    }
    return n / K;
  }

  // ---- the cameras -------------------------------------------------------------------------------------------------
  /** Camera basis for a shot: right, up and forward unit vectors in world space (yaw in plan degrees, pitch up +). */
  function basis(yawDeg, pitchDeg) {
    const y = rad(yawDeg), p = rad(pitchDeg || 0);
    const f0 = [Math.sin(y), 0, -Math.cos(y)], r = [Math.cos(y), 0, Math.sin(y)];
    const fwd = [f0[0] * Math.cos(p), Math.sin(p), f0[2] * Math.cos(p)];
    const up = [-f0[0] * Math.sin(p), Math.cos(p), -f0[2] * Math.sin(p)];
    return { r, up, fwd };
  }
  /** Where a world point lands in a shot's photo: [u, v] in 0…1 (v from the top), or null when it is not in the frame. */
  function project(cam, P) {
    const d = [P[0] - cam.pos[0], P[1] - cam.pos[1], P[2] - cam.pos[2]], B = cam.basis;
    const z = d[0] * B.fwd[0] + d[1] * B.fwd[1] + d[2] * B.fwd[2];
    if (z <= 1) return null;
    const x = (d[0] * B.r[0] + d[1] * B.r[1] + d[2] * B.r[2]) / z / cam.tanH, y = (d[0] * B.up[0] + d[1] * B.up[1] + d[2] * B.up[2]) / z / cam.tanV;
    if (Math.abs(x) > 1 || Math.abs(y) > 1) return null;
    return [0.5 + 0.5 * x, 0.5 - 0.5 * y];
  }
  const keyOf = (pid, deg) => pid + '/' + (((deg % 360) + 360) % 360);

  /**
   * The rooms of a package's plan, ready to draw. plan = pkg.plan ({data:{floors}, photos}); box = the survey's
   * corrections (see the header); meta(file) → { f35, w, h } of an attached photo (from EXIF), or null.
   */
  function scene(plan, box, meta, level) {
    const floors = (plan && plan.data && plan.data.floors || []).filter(f => (f.poly || []).length >= 3);
    const photos = plan && plan.photos || [], B = box || {}, H0 = level && level.heightMm || DEFAULTS.h;
    const eye = B.eye > 0 ? B.eye : DEFAULTS.eye;
    return floors.map(f => {
      const id = f.sk && f.sk.id || f.id, poly = f.poly.map(p => [p[0], p[1]]);
      const h = (B.h && B.h[id] > 0) ? B.h[id] : H0, c = centroid(poly), ws = walls(poly);
      const pts = photos.filter(p => inside([p.x, p.y], poly))
        .sort((a, b) => Math.hypot(a.x - c[0], a.y - c[1]) - Math.hypot(b.x - c[0], b.y - c[1]));
      const shots = [];
      pts.forEach(p => (p.shots || []).forEach(s => {
        if (shots.length >= MAX_SHOTS) return;
        const k = keyOf(p.id, s.deg), fix = (B.shots || {})[k] || {}, m = meta && meta(s.file) || null;
        // the field of view: typed here (kezi) > the lens the phone's in-app camera stored with the shot (lencse, K1b) >
        // the photo's EXIF (exif) > a phone's main lens (alap)
        const lens = +s.f35 > 0 ? +s.f35 : 0;
        const f35 = fix.f35 > 0 ? fix.f35 : lens || (m && m.f35 > 0 ? m.f35 : DEFAULTS.f35);
        const fv = fov(f35, m && m.w, m && m.h), yaw = s.deg + (+fix.yaw || 0), pitch = +fix.pitch || 0;
        shots.push({ key: k, point: p.id, deg: s.deg, side: s.side || '', file: s.file, f35, f35src: fix.f35 > 0 ? 'kezi' : lens ? 'lencse' : m && m.f35 > 0 ? 'exif' : 'alap',
          yaw, pitch, fix: { yaw: +fix.yaw || 0, pitch, f35: fix.f35 > 0 ? fix.f35 : 0 }, pos: [p.x, eye, p.y], basis: basis(yaw, pitch), tanH: fv.tanH, tanV: fv.tanV, fovH: fv.h, fovV: fv.v,
          plan: [p.x, p.y] });
      }));
      const wallSeen = ws.map(w => shots.map(s => seen(s.plan, w, ws)));
      const cover = ws.map((w, i) => shots.some((s, j) => wallSeen[i][j] > 0 && facing(s, w)));
      return { id, name: f.name || id, poly, h, eye, centroid: c, walls: ws, tris: triangulate(poly), shots, wallSeen, cover,
        area: Math.abs(signedArea(poly)) / 1e6, perimeter: ws.reduce((a, w) => a + w.len, 0) / 1000 };
    });
  }
  /** Does any part of wall w fall inside shot s's horizontal field of view? */
  function facing(s, w) {
    for (let k = 0; k <= 8; k++) {
      const t = k / 8, P = [w.a[0] + (w.b[0] - w.a[0]) * t, s.pos[1], w.a[1] + (w.b[1] - w.a[1]) * t];
      if (project(s, [P[0], P[1], P[2]])) return true;
    }
    return false;
  }

  // ---- 4×4 matrices (column-major, as WebGL wants them) ------------------------------------------------------------
  function perspective(fovyDeg, aspect, near, far) {
    const f = 1 / Math.tan(rad(fovyDeg) / 2), nf = 1 / (near - far);
    return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
  }
  function lookAt(eye, at, up) {
    let z = [eye[0] - at[0], eye[1] - at[1], eye[2] - at[2]]; const zl = Math.hypot(...z) || 1; z = z.map(v => v / zl);
    let x = [up[1] * z[2] - up[2] * z[1], up[2] * z[0] - up[0] * z[2], up[0] * z[1] - up[1] * z[0]]; const xl = Math.hypot(...x) || 1; x = x.map(v => v / xl);
    const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1];
  }
  function mul(a, b) {
    const o = new Array(16).fill(0);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
    return o;
  }

  /** The two views: the dollhouse from above (orbit) and standing at the photo point (stand). */
  function view(room, v, aspect) {
    if (v.mode === 'stand') {
      const s = room.shots.find(x => x.point === v.point) || room.shots[0];
      const pos = s ? s.pos : [room.centroid[0], room.eye, room.centroid[1]];
      const b = basis(v.yaw || 0, v.pitch || 0);
      const at = [pos[0] + b.fwd[0] * 1000, pos[1] + b.fwd[1] * 1000, pos[2] + b.fwd[2] * 1000];
      return { eye: pos, m: mul(perspective(v.fov || 75, aspect, 50, 60000), lookAt(pos, at, [0, 1, 0])), stand: true };
    }
    const ext = room.poly.reduce((m, p) => Math.max(m, Math.hypot(p[0] - room.centroid[0], p[1] - room.centroid[1])), 1000);
    const r = ext * (v.zoom || 2.6), az = rad(v.az == null ? 30 : v.az), el = rad(v.el == null ? 50 : v.el);
    const at = [room.centroid[0], room.h * 0.35, room.centroid[1]];
    const eye = [at[0] + r * Math.cos(el) * Math.sin(az), at[1] + r * Math.sin(el), at[2] + r * Math.cos(el) * Math.cos(az)];
    return { eye, m: mul(perspective(40, aspect, 50, r * 6), lookAt(eye, at, [0, 1, 0])), stand: false };
  }
  /** In the dollhouse, walls between the viewer and the room are left out. */
  function wallShown(w, eye) { return (eye[0] - w.mid[0]) * w.n[0] + (eye[2] - w.mid[1]) * w.n[1] > 0; }

  return { DEFAULTS, MAX_SHOTS, fov, exif, signedArea, inside, centroid, triangulate, walls, seen, basis, project, keyOf, scene, facing,
    perspective, lookAt, mul, view, wallShown };
});
