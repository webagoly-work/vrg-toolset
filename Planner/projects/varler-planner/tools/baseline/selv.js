// selv.js — every further BRIDGE layer, PREPARED (v2): conduit, pulled cable, boxes, niches — no hardware
//
// Model (P33 v2, GO-V2.md, 2026-10-12):
//  · each SELV layer is its own run of the data algorithm (data.js): endpoint → nearest RBX / BASE along the walls at
//    the 2700 band, one layer = its own conduits (STD-001-A2 §0: one layer, one conduit), several cables of ONE layer
//    may share a conduit sized for them (perPipe). The cable type comes from the endpoint (e.cable).
//  · fixed items that the sketch does not draw (the CHANNEL bundle BASE → RBX, the bus B pack link, the 230 V feeds of
//    the niches, the V1 riser, the media wall, the minimal security prep) are measured on the same wall graph: a
//    "star" run from the BASE, or from the Elosztó standing in for it.
//  · shared route (the user's pricing principle): every horizontal SELV leg is sampled every 100 mm and classed
//      közös   — on the v1 Adat/PoE chase (2700): the groove only gets wider
//      mellett — beside a v1 mains chase (trunk 2600 / distribution 2450): a new groove, but the same marking, dust and
//                scaffold pass
//      új     — anywhere else
//    The chase is the union of all layers (signal and data share a route freely, STD-001-A2 §5); conduits are counted
//    per layer. Vertical chases: one per column (endpoints within 150 mm share it, the deepest drop counts).
'use strict';
const RU = require('./rules'), DATA = require('./data');

// cables the v1 table lacks (typical ODs, STD-001-A2 §2.2)
const EXTRA_CABLES = {
  CAT6AS: { n: 'Cat6A S/FTP LSZH', od: 8 }, LIYCY4: { n: 'LiYCY 4×0,5', od: 6 }, LIYCY6: { n: 'LiYCY 6×0,25', od: 6 },
  LIYY2: { n: 'LiYY 2×0,5', od: 4.5 }, JYSTY2: { n: 'J-Y(St)Y 2×2×0,8', od: 5.5 }, H2x15: { n: 'H05VV-F 2×1,5', od: 7.5 },
  H2x25: { n: 'H05VV-F 2×2,5', od: 9 }, SPK2x15: { n: 'Hangszórókábel 2×1,5', od: 6.5 } };
Object.assign(RU.CABLES, EXTRA_CABLES);

const STEP = 100;
function samples(poly) {                                       // horizontal samples of a polyline (same-height segments)
  const out = [];
  for (let k = 1; k < poly.length; k++) { const [x0, y0, h0] = poly[k - 1], [x1, y1, h1] = poly[k];
    if (Math.abs(h1 - h0) > 1) continue; const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(L / STEP));
    for (let i = 0; i < n; i++) out.push([x0 + (x1 - x0) * (i + .5) / n, y0 + (y1 - y0) * (i + .5) / n, L / n]); }
  return out;
}
function segs(polys) { const s = []; polys.forEach(p => { for (let k = 1; k < p.length; k++) if (Math.abs(p[k][2] - p[k - 1][2]) <= 1) s.push([p[k - 1][0], p[k - 1][1], p[k][0], p[k][1]]); }); return s; }
function near(segList, x, y, tol) {
  for (const [ax, ay, bx, by] of segList) { const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
    const t = L2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2)) : 0;
    if (Math.hypot(ax + t * dx - x, ay + t * dy - y) <= tol) return true; }
  return false;
}

// one layer: the data algorithm with this layer's endpoints only
function routeLayer(G, E, PT, cfg, allowed, L) {
  const EL = E.filter(e => L.match(e)).map(e => Object.assign({}, e, { role: 'sys:DATA', code: 'X', cable: L.cable(e) }));
  const rest = E.filter(e => !L.match(e)).map(e => e.role === 'sys:DATA' || e.role === 'sys:USB' ? Object.assign({}, e, { role: 'sys:DATA-v1' }) : e);
  const R = DATA.planData(G, EL.concat(rest), PT, Object.assign({}, cfg, { data: Object.assign({}, cfg.data, {
    topology: 'rbx', rbxLinks: 0, isp: [], usb: false, perPipe: L.perPipe || 3, minCond: L.minCond || 'M16', cable: 'CAT6A' }) }), allowed);
  const legs = R.legs.filter(l => l.pipes.length);
  const used = new Set(); legs.forEach(l => { used.add(l.from); used.add(l.to); });
  const boxes = R.boxes.filter(b => used.has(b.id) && (b.kind === 'tee' || b.kind === 'pull'));
  const src = {}; R.sinks.filter(s => s.kind === 'wall' || s.kind === 'ceil').forEach(s => { const k = s.src ? (s.src.ref || s.src.id).split(/ to | - /)[0].trim() : '—'; src[k] = (src[k] || 0) + 1; });
  // wall crossings: a leg through a wall ends at its service point's box (portal nest, RBX, BASE) — one hole per point
  const byId = Object.fromEntries(R.boxes.map(b => [b.id, b]));
  const cross = [...new Set(legs.filter(l => l.cross).map(l => [byId[l.from], byId[l.to]].find(b => b && b.sp)).filter(Boolean).map(b => b.sp))];
  return { L, EP: EL, legs, boxes, src, cross, warn: R.warn };
}

// a star from one device (the BASE, or another standing in for it) to fixed points: path length along the walls, mm
function starLengths(G, E, PT, cfg, allowed, fromDev, targets) {
  // fromDev may be a point the sketch does not carry (the SSC): it joins the device list for this run only
  const devs = (G.D.devices.includes(fromDev) ? G.D.devices : G.D.devices.concat([fromDev]))
    .map(d => d === fromDev ? d : (d.type === 'base' ? Object.assign({}, d, { type: 'base-off' }) : d));
  if (fromDev.type !== 'base') { const i = devs.indexOf(fromDev); devs[i] = Object.assign({}, fromDev, { type: 'base' }); }
  const G2 = Object.assign({}, G, { D: Object.assign({}, G.D, { devices: devs }) });
  const EP = targets.map(t => Object.assign({ role: 'sys:DATA', code: 'X', v: '', cable: 'CAT6A' }, t));
  const rest = E.filter(e => e.role === 'sys:DATA' || e.role === 'sys:USB').map(e => Object.assign({}, e, { role: 'sys:DATA-v1' }));
  const R = DATA.planData(G2, EP.concat(rest), PT, Object.assign({}, cfg, { data: Object.assign({}, cfg.data, { topology: 'star', rbxLinks: 0, isp: [], usb: false }) }), allowed);
  const g = R.net.g, out = {};
  R.sinks.filter(s => s.path).forEach(s => { let len = 0; for (let k = 2; k < s.path.length; k++) len += Math.hypot(g.N[s.path[k]].x - g.N[s.path[k - 1]].x, g.N[s.path[k]].y - g.N[s.path[k - 1]].y);
    out[s.id] = { len: Math.round(len), path: s.path.slice(1).map(i => [g.N[i].x, g.N[i].y]) }; });
  return out;
}

// a fixed point on a wall face, as data.js expects an endpoint
function pointAt(G, geom, id, x, y, h, room) {
  const nf = geom.nearestFace(G, x, y, room); return { id, x: nf.x != null ? nf.x : x, y: nf.y != null ? nf.y : y, h, room: nf.face.room, face: nf.face, u: nf.u, onWall: true, ref: id };
}

// classify the horizontal SELV chase against the v1 chases
function chase(layers, v1DataLegs, v1MainsLegs, extraPolys) {
  const dSeg = segs(v1DataLegs.filter(l => l.kind === 'dh').map(l => l.poly));
  const mSeg = segs(v1MainsLegs.filter(l => ['trunk', 'dist'].includes(l.kind)).map(l => l.poly));
  const cells = new Map();                                       // the union: one 100 mm cell = one piece of chase
  const add = (x, y, w, layer) => { const k = Math.round(x / STEP) + ':' + Math.round(y / STEP); const c = cells.get(k);
    if (c) { c.layers.add(layer); return; } cells.set(k, { x, y, w, layers: new Set([layer]) }); };
  layers.forEach(r => r.legs.filter(l => l.kind === 'dh').forEach(l => samples(l.poly).forEach(([x, y, w]) => add(x, y, w, r.L.id))));
  (extraPolys || []).forEach(p => samples(p.poly).forEach(([x, y, w]) => add(x, y, w, p.layer)));
  const out = { kozos: 0, mellett: 0, uj: 0 };
  cells.forEach(c => { c.cls = near(dSeg, c.x, c.y, 150) ? 'kozos' : near(mSeg, c.x, c.y, 200) ? 'mellett' : 'uj'; out[c.cls] += c.w; });
  Object.keys(out).forEach(k => out[k] = +(out[k] / 1000).toFixed(1));
  return { m: out, cells };
}

// vertical chases: drops (wall outlets) clustered into columns, the deepest per column; ceiling runs separately
function verticals(layers) {
  const cols = [];
  layers.forEach(r => r.legs.filter(l => l.kind === 'ddrop' || l.kind === 'drise').forEach(l => { const [x, y] = l.poly[0];
    let c = cols.find(c => Math.hypot(c.x - x, c.y - y) <= 150); if (!c) cols.push(c = { x, y, len: 0, n: 0, layers: new Set() });
    c.len = Math.max(c.len, l.len); c.n++; c.layers.add(r.L.id); }));
  const ceil = layers.reduce((s, r) => s + r.legs.filter(l => l.kind === 'dceil').reduce((a, l) => a + l.len, 0), 0);
  return { cols, m: +(cols.reduce((s, c) => s + c.len, 0) / 1000).toFixed(1), ceilM: +(ceil / 1000).toFixed(1) };
}

module.exports = { EXTRA_CABLES, routeLayer, starLengths, pointAt, chase, verticals, samples };
