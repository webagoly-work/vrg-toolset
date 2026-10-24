// geom.js — top-down geometry of one level of a .vplan for the Erősáram baseline
//   walls      axis-aligned rectangles {x0,y0,x1,y1,id}           rooms   floor polygons (axis-aligned)
//   faces      every room-polygon edge, with the wall it lies on (or null = open boundary)
//   allowed    per wall, the intervals along its axis the user's sketch lines use (only there may a path run)
// Pure functions; no Planner code needed. Units mm, y grows downward (plan view).
'use strict';

const EPS = 1;
const near = (a, b, t = EPS) => Math.abs(a - b) <= t;
const wallAxis = w => (w.x1 - w.x0) >= (w.y1 - w.y0) ? 'x' : 'y';          // 'x' = the wall runs along x
const inRect = (x, y, w, pad = 0) => x >= w.x0 - pad && x <= w.x1 + pad && y >= w.y0 - pad && y <= w.y1 + pad;
const inPoly = (x, y, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
  const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };

function load(doc, level = 'ground') {
  const P = doc.project, D = P.data, B = P.building;
  const walls = (B.walls[level] || []).map(w => ({ ...w, x0: Math.min(w.x0, w.x1), x1: Math.max(w.x0, w.x1), y0: Math.min(w.y0, w.y1), y1: Math.max(w.y0, w.y1) }));
  walls.forEach(w => { w.axis = wallAxis(w); w.thk = w.axis === 'x' ? w.y1 - w.y0 : w.x1 - w.x0; });
  const rooms = D.floors.filter(f => f.level === level).map(f => ({ id: f.num || f.id, name: f.name, fid: f.id, poly: f.poly.map(p => [p[0], p[1]]),
    kinds: Array.isArray(f.kinds) && f.kinds.length ? f.kinds.slice() : (f.kind ? [f.kind] : []) }));
  // F8 (2026-10-15): a 45° outline edge (allowed since F02 = A) becomes an orthogonal step for routing purposes. The step
  // lies on no wall, so no pipe runs along it; plan.js warns. Before, one diagonal edge stopped the whole run.
  rooms.forEach(r => { const P2 = []; let diag = 0;
    r.poly.forEach((a, i) => { const b = r.poly[(i + 1) % r.poly.length]; P2.push(a); if (!near(a[0], b[0]) && !near(a[1], b[1])) { P2.push([b[0], a[1]]); diag++; } });
    if (diag) { r.poly = P2; r.diag = diag; } });
  rooms.forEach(r => { r.faces = [];
    for (let i = 0; i < r.poly.length; i++) { const a = r.poly[i], b = r.poly[(i + 1) % r.poly.length];
      const horiz = near(a[1], b[1]); if (!horiz && !near(a[0], b[0])) throw new Error(`room ${r.id}: non-orthogonal edge`);
      // the wall this edge lies on: a wall whose long side coincides with the edge line and overlaps it
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const cand = walls.filter(w => horiz ? (w.axis === 'x' || w.thk > 0) && (near(w.y0, a[1], 25) || near(w.y1, a[1], 25)) && Math.min(a[0], b[0]) < w.x1 && Math.max(a[0], b[0]) > w.x0
                                            : (near(w.x0, a[0], 25) || near(w.x1, a[0], 25)) && Math.min(a[1], b[1]) < w.y1 && Math.max(a[1], b[1]) > w.y0);
      // a room may need several walls along one edge; split the edge at their limits
      const lo = horiz ? Math.min(a[0], b[0]) : Math.min(a[1], b[1]), hi = horiz ? Math.max(a[0], b[0]) : Math.max(a[1], b[1]);
      const cuts = new Set([lo, hi]); cand.forEach(w => { const s = horiz ? [w.x0, w.x1] : [w.y0, w.y1]; s.forEach(v => { if (v > lo + EPS && v < hi - EPS) cuts.add(v); }); });
      const pts = [...cuts].sort((p, q) => p - q), fix = horiz ? a[1] : a[0];
      const dir = (horiz ? b[0] - a[0] : b[1] - a[1]) >= 0 ? 1 : -1;           // traversal direction of the polygon edge
      const order = [...Array(pts.length - 1).keys()]; if (dir < 0) order.reverse();
      for (const k of order) { const m = (pts[k] + pts[k + 1]) / 2;
        const w = cand.find(w => horiz ? m >= w.x0 - EPS && m <= w.x1 + EPS : m >= w.y0 - EPS && m <= w.y1 + EPS) || null;
        // the inward normal: the side of the edge that lies inside the room
        const probe = horiz ? [m, fix + 30] : [fix + 30, m], inward = inPoly(probe[0], probe[1], r.poly) ? 1 : -1;
        r.faces.push({ room: r.id, horiz, fix, lo: pts[k], hi: pts[k + 1], wall: w ? w.id : null, inward, dir }); } }
    // loop parameter: s0 = arc length at the face's traversal start
    let s = 0; r.faces.forEach((f, i) => { f.i = i; f.s0 = s; f.len = f.hi - f.lo; s += f.len; }); r.perim = s; });
  rooms.forEach(r => r.faces.forEach(f => { f.uToS = u => f.s0 + (f.dir > 0 ? u - f.lo : f.hi - u); }));
  return { P, D, walls, rooms, level, wallById: Object.fromEntries(walls.map(w => [w.id, w])) };
}

// the walls (and the intervals along them) the user's sketch lines run on; off-wall segments are reported apart
function allowedFromSketch(G, paths, pad = 150) {
  const allowed = {}, offWall = [];
  // E5-Q7 = A (2026-10-15): only Vezethető fal opens a wall — a whole-wall mark, or a span (wspan: u from the wall's start).
  // Mark intervals are EXACT (third element true: no PAD in network.js); sketch lines stay loose. A legacy 'belso' whole-wall
  // mark counts too: in the CLA round "Belső fal" meant exactly this (R3 has since renamed the preset). L-forma and the
  // other plus marks no longer open a wall — they say "a preferred spot", not "a run may go here" (finding F1).
  (G.D.marks || []).filter(m => m.level === G.level && G.wallById[m.wall] && (((m.tags || []).includes('vezetheto') && (m.kind === 'wall' || m.kind === 'wspan')) || (m.kind === 'wall' && (m.tags || []).includes('belso'))))
    .forEach(m => { const w = G.wallById[m.wall], a0 = w.axis === 'x' ? w.x0 : w.y0;
      (allowed[w.id] = allowed[w.id] || []).push(m.kind === 'wspan' ? [a0 + Math.min(m.u0, m.u1), a0 + Math.max(m.u0, m.u1), true] : [w.axis === 'x' ? w.x0 : w.y0, w.axis === 'x' ? w.x1 : w.y1, true]); });
  const add = (w, a, b) => { (allowed[w.id] = allowed[w.id] || []).push([Math.min(a, b), Math.max(a, b)]); };
  paths.forEach(p => { const n = (p.nodes || []).filter(q => q.level === G.level);
    for (let i = 0; i < n.length - 1; i++) { const a = n[i], b = n[i + 1], L = Math.hypot(b.x - a.x, b.y - a.y); if (L < 1) continue;
      const steps = Math.max(2, Math.ceil(L / 50)); let run = null, off = [];
      for (let s = 0; s <= steps; s++) { const x = a.x + (b.x - a.x) * s / steps, y = a.y + (b.y - a.y) * s / steps;
        const w = G.walls.find(w => inRect(x, y, w, pad));
        if (w) { const u = w.axis === 'x' ? x : y; if (run && run.w === w) run.hi = u; else { if (run) add(run.w, run.lo, run.hi); run = { w, lo: u, hi: u }; } }
        else { if (run) { add(run.w, run.lo, run.hi); run = null; } off.push([x, y]); } }
      if (run) add(run.w, run.lo, run.hi);
      if (off.length > 2) offWall.push({ path: p.id, a: off[0], b: off[off.length - 1] }); } });
  // merge overlapping intervals per wall
  Object.keys(allowed).forEach(k => { const iv = allowed[k].sort((p, q) => p[0] - q[0]), out = [];
    iv.forEach(v => { const last = out[out.length - 1]; if (last && v[0] <= last[1] + (last[2] && v[2] ? 1 : 300)) { last[1] = Math.max(last[1], v[1]); last[2] = !!(last[2] && v[2]); } else out.push([...v]); });
    allowed[k] = out; });
  return { allowed, offWall };
}

// T0 / F3 (2026-10-18): the R3 rule marks reach the router per face. Before, the router read only Vezethető fal, so a
// face the user painted Tilos stayed a legal route.
//   pol 'ban'  (tilos, gáz, kémény, vizes, gépészet, strang …)   → no edge at all
//   pol 'minus' (kerülendő, fűtőtest, külső fal, bútor)          → the face costs ×minusK (2)
//   tag 'elonyben' (Q2 = A, the user's flow line made checkable)  → ×prefK (0.5), and the face may be used
// Other plus / none marks (L-forma, médiafal, munkalap …) say where a DEVICE goes, not where a run may go: no effect.
// Intervals are absolute along the wall axis (like `allowed`); side = the face's sign across the wall (+1 = the larger
// x / y, the Planner's wallInfo.perp), 0 = both faces. Not read yet: hstrip height bands, zones other than a strang ban
// (a padlófűtés zone forbids FLOOR runs — E2 already refuses a Padló út across one — not a wall chase).
function faceMarks(G) {
  const out = {}, put = (w, side, a, b, pol, m) => (out[w.id] = out[w.id] || []).push({ side, lo: Math.min(a, b), hi: Math.max(a, b), pol, tag: (m.tags || [])[0] || '', id: m.id || null });
  (G.D.marks || []).filter(m => m.level == null || m.level === G.level).forEach(m => {
    const tags = m.tags || [], pol = m.pol === 'ban' ? 'ban' : tags.includes('elonyben') ? 'pref' : m.pol === 'minus' ? 'minus' : null;
    if (!pol || tags.includes('vezetheto')) return;
    if (m.kind === 'zone') { if (pol !== 'ban' || tags.includes('padlofutes') || m.x0 == null) return;
      // a ban zone on the floor (a drain stack in a corner) bans the faces it touches, within 100 mm
      G.walls.forEach(w => { const x = w.axis === 'x', c0 = x ? w.y0 : w.x0, c1 = x ? w.y1 : w.x1, z0 = x ? m.y0 : m.x0, z1 = x ? m.y1 : m.x1;
        const lo = Math.max(x ? w.x0 : w.y0, x ? m.x0 : m.y0), hi = Math.min(x ? w.x1 : w.y1, x ? m.x1 : m.y1); if (hi - lo < 1) return;
        if (z1 >= c0 - 100 && z0 <= c0 + 1) put(w, -1, lo, hi, pol, m);
        if (z0 <= c1 + 100 && z1 >= c1 - 1) put(w, 1, lo, hi, pol, m); });
      return; }
    const w = G.wallById[m.wall]; if (!w) return; const a0 = w.axis === 'x' ? w.x0 : w.y0, a1 = w.axis === 'x' ? w.x1 : w.y1;
    if (m.kind === 'wall') put(w, 0, a0, a1, pol, m);
    else if (m.kind === 'wspan') put(w, 0, a0 + m.u0, a0 + m.u1, pol, m);
    else if (m.kind === 'side') put(w, m.side, a0, a1, pol, m);
    else if (m.kind === 'vstrip') put(w, m.side, a0 + m.u0, a0 + m.u1, pol, m); });
  return out;
}
// the face's side across its wall (+1 = the larger coordinate), 0 for a face on a wall's end
function faceSide(G, f) { const w = f.wall && G.wallById[f.wall]; if (!w || (w.axis === 'x') !== f.horiz) return 0;
  return Math.sign(f.fix - (f.horiz ? (w.y0 + w.y1) / 2 : (w.x0 + w.x1) / 2)) || 1; }

// which rooms a point on / in a wall touches (for service points = wall crossings)
function roomsAround(G, x, y, reach = 460) {
  const hits = new Set();
  [[reach, 0], [-reach, 0], [0, reach], [0, -reach], [reach * .7, reach * .7], [-reach * .7, reach * .7], [reach * .7, -reach * .7], [-reach * .7, -reach * .7]]
    .forEach(([dx, dy]) => { for (let f = .25; f <= 1; f += .25) { const r = G.rooms.find(r => inPoly(x + dx * f, y + dy * f, r.poly)); if (r) { hits.add(r.id); break; } } });
  return [...hits];
}
function roomOf(G, x, y) { const r = G.rooms.find(r => inPoly(x, y, r.poly)); return r ? r.id : null; }

// nearest face (room perimeter edge) to a point, optionally inside one room only → {face, u (along), d (distance), x, y}
function nearestFace(G, x, y, roomId) {
  let best = null;
  G.rooms.filter(r => !roomId || r.id === roomId).forEach(r => r.faces.forEach(f => {
    const u = Math.max(f.lo, Math.min(f.hi, f.horiz ? x : y)), px = f.horiz ? u : f.fix, py = f.horiz ? f.fix : u, d = Math.hypot(px - x, py - y);
    if (!best || d < best.d) best = { face: f, u, d, x: px, y: py }; }));
  return best;
}

module.exports = { load, allowedFromSketch, faceMarks, faceSide, roomsAround, roomOf, nearestFace, inPoly, inRect, near };
