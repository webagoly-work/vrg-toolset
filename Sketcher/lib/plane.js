// Sketcher/lib/plane.js — Síkmérés (dev line skcam, stage K3): measuring on a plane in one photo. Pure maths, no DOM.
//
// A wall, a door or a facade is a plane. Four image points of a rectangle of known size on that plane (an A4 sheet, a
// switch frame, a door, a printed card) fix the homography H between the photo and the plane in millimetres. Any two
// taps on the same plane then give a true distance, and a floor line gives heights (a socket 30 cm up). The method is
// single-view metrology (Criminisi, Reid, Zisserman); see docs/research/2026-11-20_room-capture-and-measurement.md §3,
// row 2. Accuracy falls with the distance from the reference ("extrapolation") and off the plane: plane.quality says so.
//
// Photo coordinates are 0…1 of the upright photo (u to the right, v down), as the photo markup (M29) keeps them; the
// photo's aspect (w / h) turns them into a square-pixel frame before any geometry.
//
// The survey keeps the results in an optional key `planes` (v2 stays v2): { "<photo key>": record }, the key a capture
// id ("C12") or a Fotópont shot ("F25/0"); record = { ref: {kind, w, h, pts: [[u,v] ×4]}, floor?: [[u,v],[u,v]],
// lines: [{a, b, mm, label?}], marks: [{p, mm}], aspect, at }. The millimetres are stored, so a reader needs no maths.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.VRGPlane = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Known rectangles: w × h in mm as they usually hang (w across, h up). The user can type any size. */
  const REFS = [
    { id: 'a4', label: 'A4 lap', w: 210, h: 297 },
    { id: 'a5', label: 'A5 lap', w: 148, h: 210 },
    { id: 'keret', label: 'Kapcsoló / dugalj keret', w: 80, h: 80 },
    { id: 'ajto', label: 'Ajtó (tok belső)', w: 900, h: 2000 },
    { id: 'csempe', label: 'Csempe', w: 300, h: 600 },
    { id: 'egyeni', label: 'Egyéni méret', w: 1000, h: 1000 },
  ];
  const ref = id => REFS.find(r => r.id === id) || null;

  // ---- linear algebra ----------------------------------------------------------------------------------------------
  /** Solves A x = b (n × n) by Gaussian elimination with partial pivoting; null when singular. */
  function solve(A, b) {
    const n = b.length, M = A.map((r, i) => r.concat([b[i]]));
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (Math.abs(M[p][c]) < 1e-12) return null;
      [M[c], M[p]] = [M[p], M[c]];
      for (let r = 0; r < n; r++) {
        if (r === c) continue;
        const k = M[r][c] / M[c][c]; if (!k) continue;
        for (let j = c; j <= n; j++) M[r][j] -= k * M[c][j];
      }
    }
    return M.map((r, i) => r[n] / r[i]);
  }

  /** The 3 × 3 homography (row-major, h33 = 1) taking the four [src] points to the four [dst] points; null if degenerate. */
  function homography(src, dst) {
    if (!src || !dst || src.length !== 4 || dst.length !== 4) return null;
    const A = [], b = [];
    for (let i = 0; i < 4; i++) {
      const [x, y] = src[i], [X, Y] = dst[i];
      A.push([x, y, 1, 0, 0, 0, -x * X, -y * X]); b.push(X);
      A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y]); b.push(Y);
    }
    const h = solve(A, b);
    return h ? [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1] : null;
  }
  function apply(H, p) {
    const w = H[6] * p[0] + H[7] * p[1] + H[8];
    if (Math.abs(w) < 1e-12) return null;
    return [(H[0] * p[0] + H[1] * p[1] + H[2]) / w, (H[3] * p[0] + H[4] * p[1] + H[5]) / w];
  }
  /** Is the point on the camera's side of the plane's horizon (a mapping across the vanishing line flips sign)? */
  const sameSide = (H, p, q) => Math.sign(H[6] * p[0] + H[7] * p[1] + H[8]) === Math.sign(H[6] * q[0] + H[7] * q[1] + H[8]);

  // ---- the reference -----------------------------------------------------------------------------------------------
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  /** Four points in the order top-left, top-right, bottom-right, bottom-left (v down), whatever order they were tapped in. */
  function order(pts) {
    if (!pts || pts.length !== 4) return null;
    const c = [pts.reduce((s, p) => s + p[0], 0) / 4, pts.reduce((s, p) => s + p[1], 0) / 4];
    const ring = pts.slice().sort((a, b) => Math.atan2(a[1] - c[1], a[0] - c[0]) - Math.atan2(b[1] - c[1], b[0] - c[0]));  // clockwise on screen
    let tl = 0; ring.forEach((p, i) => { if (p[0] + p[1] < ring[tl][0] + ring[tl][1]) tl = i; });
    const out = [0, 1, 2, 3].map(k => ring[(tl + k) % 4]);
    return convex(out) ? out : null;
  }
  function convex(q) {
    const s = [0, 1, 2, 3].map(i => Math.sign(cross(q[i], q[(i + 1) % 4], q[(i + 2) % 4])));
    return s.every(v => v === s[0] && v !== 0);
  }
  const len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  /** Photo (0…1) to the square-pixel frame: u × aspect, v. */
  const sq = (p, aspect) => [p[0] * aspect, p[1]];

  /**
   * The measuring frame of a record: H (photo square frame → plane mm), the reference as used (w × h after a swap,
   * when the tapped rectangle is clearly turned the other way), and its corners in order. Null when the four points
   * do not make a rectangle's picture.
   */
  function frame(rec) {
    const r = rec && rec.ref; if (!r || !r.pts || r.pts.length !== 4 || !(r.w > 0) || !(r.h > 0)) return null;
    const a = rec.aspect > 0 ? rec.aspect : 4 / 3;
    const q = order(r.pts.map(p => sq(p, a))); if (!q) return null;
    let w = r.w, h = r.h;
    // which way round: the picture's long pair of edges goes with the rectangle's long side (unless the user fixed it)
    if (r.turn == null && w !== h) {
      const across = (len(q[0], q[1]) + len(q[3], q[2])) / 2, up = (len(q[0], q[3]) + len(q[1], q[2])) / 2;
      if ((across > up) !== (w > h)) { const t = w; w = h; h = t; }
    } else if (r.turn) { const t = w; w = h; h = t; }
    const H = homography(q, [[0, 0], [w, 0], [w, h], [0, h]]);
    return H ? { H, w, h, q, aspect: a } : null;
  }

  /** The plane point (mm, x across, y DOWN from the reference's top-left) of a photo point. */
  function toPlane(f, p) { return f && p ? apply(f.H, sq(p, f.aspect)) : null; }

  /** The true distance (mm) between two photo points on the reference's plane; null when one is past the horizon. */
  function distance(f, a, b) {
    if (!f) return null;
    const A = sq(a, f.aspect), B = sq(b, f.aspect);
    if (!sameSide(f.H, A, f.q[0]) || !sameSide(f.H, B, f.q[0])) return null;
    const P = apply(f.H, A), Q = apply(f.H, B);
    return P && Q ? Math.hypot(P[0] - Q[0], P[1] - Q[1]) : null;
  }

  /** The height (mm) of a photo point above the floor line [fl] (two photo points on the floor–wall edge), on the plane. */
  function height(f, fl, p) {
    if (!f || !fl || fl.length !== 2) return null;
    const A = toPlane(f, fl[0]), B = toPlane(f, fl[1]), P = toPlane(f, p);
    if (!A || !B || !P) return null;
    const L = Math.hypot(B[0] - A[0], B[1] - A[1]); if (L < 1e-9) return null;
    // signed distance from the line, positive above it (the plane's y runs down)
    const d = ((B[0] - A[0]) * (P[1] - A[1]) - (B[1] - A[1]) * (P[0] - A[0])) / L;
    return (B[0] >= A[0] ? -d : d);
  }

  /**
   * How far a measurement reaches beyond the reference: the farthest of its points from the reference's middle, in
   * reference sizes. ≤ 2 jó, ≤ 5 közepes, more: távoli (the error grows with the reach: put the reference nearer).
   */
  function quality(f, pts) {
    if (!f) return { reach: Infinity, grade: 'nincs' };
    const c = [f.w / 2, f.h / 2], size = Math.max(f.w, f.h);
    let reach = 0;
    pts.forEach(p => { const P = toPlane(f, p); if (P) reach = Math.max(reach, Math.hypot(P[0] - c[0], P[1] - c[1]) / size); else reach = Infinity; });
    return { reach, grade: reach <= 2 ? 'jo' : reach <= 5 ? 'kozepes' : 'tavoli' };
  }
  const GRADES = { jo: 'jó', kozepes: 'közepes', tavoli: 'távoli: a referencia legyen közelebb', nincs: 'nincs referencia' };

  /** Recomputes every stored millimetre of a record from its points (after the reference or a point moved). */
  function measure(rec) {
    const f = frame(rec), out = Object.assign({}, rec);
    out.lines = (rec.lines || []).map(l => { const mm = distance(f, l.a, l.b); return Object.assign({}, l, { mm: mm == null ? null : Math.round(mm) }); });
    out.marks = (rec.marks || []).map(m => { const mm = height(f, rec.floor, m.p); return Object.assign({}, m, { mm: mm == null ? null : Math.round(mm) }); });
    return out;
  }

  // ---- the stored record -------------------------------------------------------------------------------------------
  const pt = p => Array.isArray(p) && p.length >= 2 && isFinite(p[0]) && isFinite(p[1]) && p[0] >= -0.5 && p[0] <= 1.5 && p[1] >= -0.5 && p[1] <= 1.5
    ? [Math.round(p[0] * 1e5) / 1e5, Math.round(p[1] * 1e5) / 1e5] : null;
  /** A record as stored: only known keys, points rounded, millimetres recomputed; null when it holds nothing. */
  function clean(rec) {
    if (!rec || typeof rec !== 'object') return null;
    const o = { aspect: rec.aspect > 0 ? Math.round(rec.aspect * 1e4) / 1e4 : 4 / 3 };
    const r = rec.ref;
    if (r && Array.isArray(r.pts) && r.pts.length === 4 && r.pts.every(pt) && r.w > 0 && r.h > 0) {
      o.ref = { kind: ref(r.kind) ? r.kind : 'egyeni', w: Math.round(r.w), h: Math.round(r.h), pts: r.pts.map(pt) };
      if (r.turn === true || r.turn === false) o.ref.turn = r.turn;
    }
    if (Array.isArray(rec.floor) && rec.floor.length === 2 && rec.floor.every(pt)) o.floor = rec.floor.map(pt);
    o.lines = (rec.lines || []).filter(l => l && pt(l.a) && pt(l.b)).map(l => Object.assign({ a: pt(l.a), b: pt(l.b) }, l.label ? { label: String(l.label).slice(0, 60) } : {}));
    o.marks = (rec.marks || []).filter(m => m && pt(m.p)).map(m => Object.assign({ p: pt(m.p) }, m.label ? { label: String(m.label).slice(0, 60) } : {}));
    if (!o.ref && !o.floor && !o.lines.length && !o.marks.length) return null;
    if (rec.at > 0) o.at = rec.at;
    return measure(o);
  }
  /** The photo key of a capture or a Fotópont shot. */
  const keyOf = (pointOrCapture, deg) => deg == null ? String(pointOrCapture) : pointOrCapture + '/' + (((deg % 360) + 360) % 360);
  /** One readable line per measurement, for lists and the jegyzőkönyv. */
  function summary(rec) {
    const out = [];
    (rec && rec.lines || []).forEach((l, i) => out.push((l.label || 'Távolság ' + (i + 1)) + ': ' + (l.mm == null ? '—' : fmt(l.mm))));
    (rec && rec.marks || []).forEach((m, i) => out.push((m.label || 'Magasság ' + (i + 1)) + ': ' + (m.mm == null ? '—' : fmt(m.mm))));
    return out;
  }
  const fmt = mm => mm >= 1000 ? (Math.round(mm / 10) / 100).toString().replace('.', ',') + ' m' : Math.round(mm) + ' mm';

  return { REFS, ref, solve, homography, apply, order, frame, toPlane, distance, height, quality, GRADES, measure, clean, keyOf, summary, fmt };
});
