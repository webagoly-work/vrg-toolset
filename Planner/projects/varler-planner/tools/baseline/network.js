// network.js — the wall-following graph of one level, service points, trunk channels and the distribution line
//
// Model (user rules 2026-10-12):
//  · a horizontal path runs ONLY along wall faces the sketch marked (allowed intervals), inside one room at a time
//  · a wall is crossed ONLY at a service point: a Portal (door) or an RBX / BASE (a "portal without a door")
//  · trunk  = one channel per service point from the Elosztó at 2600; channels avoid other service points if they can
//  · distribution = service point → endpoint drops along the room faces at 2450, under the trunk
// Loops: every room perimeter is a closed loop parameterised by arc length s; nodes sit at corners, at the limits of
// the allowed intervals and at every anchor (board, service-point faces, endpoint drops).
'use strict';
const geom = require('./geom');

const PAD = 500;            // the sketch is loose: lines stop short of corners; allow this much beyond an interval
const MERGE = 250;          // drops closer than this on one face share one leállás box

function sToPt(room, s) {
  s = ((s % room.perim) + room.perim) % room.perim;
  const f = room.faces.find(f => s >= f.s0 - 1e-6 && s <= f.s0 + f.len + 1e-6) || room.faces[room.faces.length - 1];
  const t = s - f.s0, u = f.dir > 0 ? f.lo + t : f.hi - t;
  return f.horiz ? { x: u, y: f.fix, face: f, u } : { x: f.fix, y: u, face: f, u };
}
const faceAt = (room, s) => sToPt(room, s).face;
function allowedOn(allowed, f, uA, uB, wallById) {
  if (!f) return false;
  if (!f.wall) return f.len < 60;                                  // a sliver between two walls: passable
  const iv = allowed[f.wall]; if (!iv) return false;
  const w = wallById && wallById[f.wall];
  // a face on the END of a wall runs across the wall's axis: test its position, not its span
  // an interval from a mark is exact (third element); one from a loose sketch line gets PAD
  if (w && (w.axis === 'x') !== f.horiz) return iv.some(([a, b, x]) => f.fix >= a - (x ? 1 : PAD) && f.fix <= b + (x ? 1 : PAD));
  const lo = Math.min(uA, uB), hi = Math.max(uA, uB); return iv.some(([a, b, x]) => lo >= a - (x ? 1 : PAD) && hi <= b + (x ? 1 : PAD));
}
const SOFT = 4;            // a wall face the sketch did not mark costs this many times its length (used only if nothing else reaches)

class Graph {
  constructor() { this.N = []; this.adj = []; }
  add(n) { n.i = this.N.length; this.N.push(n); this.adj.push([]); return n.i; }
  link(a, b, w, kind) { if (a === b) return; this.adj[a].push({ to: b, w, kind }); this.adj[b].push({ to: a, w, kind }); }
  // Dijkstra; opt.ok(i) limits the nodes, opt.penalty(i) adds a cost for passing node i
  run(src, opt = {}) { const n = this.N.length, dist = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), done = new Uint8Array(n);
    dist[src] = 0;
    for (;;) { let u = -1, best = Infinity; for (let i = 0; i < n; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i; }
      if (u < 0) break; done[u] = 1;
      for (const e of this.adj[u]) { if (opt.ok && !opt.ok(e.to)) continue; if (opt.edge && !opt.edge(e)) continue;
        const nd = dist[u] + e.w + (opt.penalty ? opt.penalty(e.to, u) : 0); if (nd < dist[e.to]) { dist[e.to] = nd; prev[e.to] = u; } } }
    return { dist, prev }; }
  path(prev, t) { const p = []; for (let v = t; v >= 0; v = prev[v]) p.unshift(v); return p; }
}

// anchors: [{key, room, s?, x, y, kind, ref}] — s computed here when missing
function build(G, allowed, anchors) {
  const g = new Graph(), byKey = {}, roomNodes = {};
  G.rooms.forEach(r => {
    const bends = cornerS(r);
    const S = new Map();                                    // s(rounded) → {s, keys[]}
    // points within 2 mm along the perimeter are one node (an anchor 1 mm off a corner IS the corner: one box, not two)
    const put = (s, key) => { s = ((s % r.perim) + r.perim) % r.perim; let k = Math.round(s);
      for (let d = -2; d <= 2; d++) { const q = (((k + d) % Math.round(r.perim)) + Math.round(r.perim)) % Math.round(r.perim); if (S.has(q)) { k = q; break; } }
      const o = S.get(k) || { s, keys: [] }; if (key) o.keys.push(key); S.set(k, o); };
    r.faces.forEach(f => { put(f.s0);
      (allowed[f.wall] || []).forEach(([a, b, x]) => { [a - (x ? 0 : PAD), b + (x ? 0 : PAD)].forEach(v => { if (v > f.lo + 2 && v < f.hi - 2) put(f.uToS(v)); }); }); });
    // (a split within 2 mm of a face end is that end: a span rounded to whole mm once made a 0,6 mm edge and two corner boxes)
    anchors.filter(a => a.room === r.id).forEach(a => put(a.s, a.key));
    const list = [...S.values()].sort((p, q) => p.s - q.s);
    const ids = list.map(o => { const pt = sToPt(r, o.s);
      const i = g.add({ room: r.id, s: o.s, x: pt.x, y: pt.y, keys: o.keys, corner: bends.some(b => Math.abs(b - o.s) < 1) });
      o.keys.forEach(k => (byKey[k] = byKey[k] || []).push(i)); return i; });
    roomNodes[r.id] = ids;
    for (let k = 0; k < ids.length; k++) { const a = g.N[ids[k]], b = g.N[ids[(k + 1) % ids.length]];
      const sb = k + 1 < ids.length ? b.s : b.s + r.perim, sm = (a.s + sb) / 2, f = faceAt(r, sm);
      const ua = sToPt(r, a.s + 0.01).u, ub = sToPt(r, sb - 0.01).u;
      if (allowedOn(allowed, f, ua, ub, G.wallById)) g.link(ids[k], ids[(k + 1) % ids.length], sb - a.s, 'face');
      else if (f && f.wall) g.link(ids[k], ids[(k + 1) % ids.length], (sb - a.s) * SOFT, 'soft'); }
  });
  // open boundaries (no wall between two rooms): coincident nodes of different rooms link at zero cost
  G.rooms.forEach(r => r.faces.filter(f => !f.wall && f.len >= 60).forEach(f => {
    const ends = f.horiz ? [[f.lo, f.fix], [f.hi, f.fix]] : [[f.fix, f.lo], [f.fix, f.hi]];
    ends.forEach(([x, y]) => { const here = roomNodes[r.id].filter(i => Math.hypot(g.N[i].x - x, g.N[i].y - y) < 5);
      G.rooms.filter(o => o.id !== r.id).forEach(o => roomNodes[o.id].filter(i => Math.hypot(g.N[i].x - x, g.N[i].y - y) < 5)
        .forEach(j => here.forEach(i => { if (!g.adj[i].some(e => e.to === j)) g.link(i, j, 0, 'open'); }))); }); }));
  return { g, byKey, roomNodes };
}

// the arc lengths where a room's outline really turns: a vertex between two non-collinear edges, both longer than
// JOG (a 36 mm wall-thickness step is not a bend, and a joint between two walls in line is no corner at all)
const JOG = 60;
function cornerS(r) {
  const P = r.poly, n = P.length, L = P.map((p, i) => { const q = P[(i + 1) % n]; return Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]); });
  const out = []; let s = 0;
  for (let i = 0; i < n; i++) { const a = P[(i - 1 + n) % n], b = P[i], c = P[(i + 1) % n], la = L[(i - 1 + n) % n], lc = L[i];
    const h1 = Math.abs(a[1] - b[1]) < 1, h2 = Math.abs(b[1] - c[1]) < 1;
    if (h1 !== h2 && la >= JOG && lc >= JOG) out.push(s);
    s += L[i]; }
  return out;
}

// ceiling crossings (cfg.ceilLinks, D07): a short hop through the ceiling slab where a wall line breaks (the stair opening).
// Both ends are anchors on the room's faces; the link costs its plan length + the rise to the ceiling and back.
// Kind 'over': the trunk and the data use it, the distribution does not (plan.js filters it out).
function ceilAnchors(G, cfg, pre, anchors) {
  // each end on its own room's face (aRoom / bRoom: a crossing over a stair void joins two rooms); P33 gives one room
  (cfg.ceilLinks || []).forEach((cl, k) => ['a', 'b'].forEach(e => { const [x, y] = cl[e], nf = geom.nearestFace(G, x, y, cl[e + 'Room'] || cl.room); if (!nf) return;
    anchors.push({ key: `${pre}:${k}:${e}`, room: nf.face.room, s: nf.face.uToS(nf.u) }); }));
}
function ceilLinks(G, cfg, pre, net, h) {
  const ends = new Map(), g = net.g, C = cfg.ceiling || 2850;
  (cfg.ceilLinks || []).forEach((cl, k) => { const a = (net.byKey[`${pre}:${k}:a`] || [])[0], b = (net.byKey[`${pre}:${k}:b`] || [])[0]; if (a == null || b == null) return;
    g.link(a, b, Math.abs(g.N[a].x - g.N[b].x) + Math.abs(g.N[a].y - g.N[b].y) + 2 * Math.max(0, C - h), 'over'); ends.set(a, cl.short || cl.n); ends.set(b, cl.short || cl.n); });
  return ends;
}
// a node path as 3-D points at height h; an 'over' edge rises to the ceiling, crosses and comes back down
function polyAt(g, pts, h, ceiling) {
  const out = []; pts.forEach((i, k) => { const e = k ? g.adj[pts[k - 1]].find(x => x.to === i) : null;
    if (e && e.kind === 'over') { const a = g.N[pts[k - 1]]; out.push([a.x, a.y, ceiling], [g.N[i].x, g.N[i].y, ceiling]); }
    out.push([g.N[i].x, g.N[i].y, h]); }); return out;
}

// rooms joined by open boundaries form one routing zone (R03 + R03L)
function zones(G, net) {
  const zone = {}; let z = 0;
  G.rooms.forEach(r => { if (zone[r.id] != null) return; const stack = [r.id]; zone[r.id] = z;
    while (stack.length) { const id = stack.pop(); net.roomNodes[id].forEach(i => net.g.adj[i].forEach(e => { if (e.kind !== 'open') return;
      const o = net.g.N[e.to].room; if (zone[o] == null) { zone[o] = z; stack.push(o); } })); }
    z++; });
  return zone;
}

module.exports = { build, zones, sToPt, Graph, MERGE, PAD, SOFT, ceilAnchors, ceilLinks, polyAt };
