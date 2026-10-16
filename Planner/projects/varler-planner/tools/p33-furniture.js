#!/usr/bin/env node
// P33 furniture: the faint furniture of the client's original sheet (BRIDGE/07_P33/blueprints/
// Peterdy_33_villany_eredeti_mindket_szint.pdf, the embedded 1424 × 2049 brochure image) as Planner objects.
//
//   node tools/p33-furniture.js   -> Calculator/P33-teszt_v2_butor.vplan.json
//
// HOW IT IS PLACED. The model is the brochure turned 180° (the brochure's nappali, bottom left, is R06, top right),
// and the model follows the measured 1:50 plan, which differs from the sales brochure in places (the bathroom was
// redrawn, the szoba–nappali door moved to B171, the kitchen leg is shorter). So no single scale fits. Every item is
// read in its own room: the brochure room's inner rectangle maps onto the model room's (turned), the item keeps a
// standard library size (02-state OBJLIB), and an item that touches a wall on the sheet is pushed against the same
// model wall. Image coordinates below are pixels of a 2× crop of the embedded image, origin (70, 295) for the ground
// floor and (70, 1120) for the upper floor.
// THE UPPER FLOOR is not in P33-teszt_v2. Its walls and rooms come from Calculator/P33_vplan_upper-ghost.json, which
// is drawn in the brochure's orientation; x' = 10935 − x, y' = 11482 − y puts it over the ground floor (the ghost's
// nappali lands on R06 within ≈ 150 mm, the upper stair over the ground stair and kamra).
'use strict';
const fs = require('fs'), path = require('path');
const REPO = path.resolve(__dirname, '..', '..', '..', '..');
const SRC = path.join(REPO, 'Calculator', 'P33-teszt_v2.vplan.json');
const GHOST = path.join(REPO, 'Calculator', 'P33_vplan_upper-ghost.json');
const OUT = path.join(REPO, 'Calculator', 'P33-teszt_v2_butor.vplan.json');
const GX = 10935, GY = 11482;                       // ghost → model: x' = GX − x, y' = GY − y
const COL = { wood: '#c9b28f', soft: '#b8aa9c', sani: '#e6edf1', kitchen: '#d6d0c2', metal: '#b9bec4', garden: '#a7b59a' };

// ---- the rooms: brochure inner rectangle [x0, y0, x1, y1] (crop px) ↔ model rectangle [x0, y0, x1, y1] (mm) ----
// the model rectangle is the room's inner extent on the side the furniture is on; mapping turns it 180°
const R = {
  R07: { img: [252, 195, 958, 595], mod: [5327, 6465, 10100, 9050] },       // szoba
  R06: { img: [252, 612, 958, 1160], mod: [5327, 2390, 10100, 6215] },      // nappali
  R08: { img: [1022, 280, 1270, 585], mod: [3335, 7140, 5027, 8271] },      // fürdő, main part
  R08n: { img: [862, 195, 958, 380], mod: [5129, 7740, 5898, 9050] },       // fürdő, the notch behind R07
  R03k: { img: [1290, 285, 1640, 595], mod: [784, 6940, 3085, 8271] },      // konyha (R03's west leg)
  R03e: { img: [1022, 605, 1640, 900], mod: [784, 4432, 4923, 6940] },      // étkező
  R01: { img: [1420, 915, 1640, 1160], mod: [784, 2390, 2220, 4182] },      // előszoba
  R04: { img: [1290, 915, 1405, 1160], mod: [2420, 2390, 3080, 4182] },     // wc
  R05: { img: [1025, 915, 1140, 1160], mod: [4165, 2390, 5027, 4146] } };   // kamra
// a brochure point → model point (turned 180°)
function map(room, ix, iy) { const r = R[room], [a0, b0, a1, b1] = r.img, [m0, n0, m1, n1] = r.mod;
  return [m1 - (ix - a0) / (a1 - a0) * (m1 - m0), n1 - (iy - b0) / (b1 - b0) * (n1 - n0)]; }

// ---- the ground floor items ----
// {room, n, c:[ix,iy] brochure centre, w, d (mm along model x / y), ht, z?, col, snap:{x:'lo'|'hi', y:'lo'|'hi'} = push
//  the box against the model room's low / high face on that axis (a wall it touches on the sheet), at?:[x,y] fixed}
const G = [
  // szoba (R07): the double bed with its head on the outer wall; a small round table by the window
  { room: 'R07', n: 'Ágy 200×160', c: [601, 342], w: 1600, d: 2000, ht: 550, col: COL.wood, snap: { y: 'hi' } },
  { room: 'R07', n: 'Kisasztal Ø50', c: [362, 307], w: 500, d: 500, ht: 600, col: COL.wood },
  // nappali (R06)
  { room: 'R06', n: 'Komód / polc', c: [465, 633], w: 2800, d: 300, ht: 800, col: COL.wood, snap: { y: 'hi' } },
  { room: 'R06', n: 'Polc', c: [894, 633], w: 800, d: 300, ht: 800, col: COL.wood, snap: { x: 'lo', y: 'hi' } },
  { room: 'R06', n: 'Fotel', c: [324, 812], w: 900, d: 800, ht: 850, col: COL.soft, snap: { x: 'hi' } },
  { room: 'R06', n: 'Fotel', c: [324, 955], w: 900, d: 800, ht: 850, col: COL.soft, snap: { x: 'hi' } },
  { room: 'R06', n: 'Fotel', c: [502, 944], w: 800, d: 800, ht: 850, col: COL.soft },
  { room: 'R06', n: 'Dohányzóasztal', c: [699, 950], w: 1000, d: 500, ht: 420, col: COL.wood },
  { room: 'R06', n: 'Fotel', c: [898, 942], w: 700, d: 900, ht: 850, col: COL.soft },
  { room: 'R06', n: 'Kanapé 3ü', c: [699, 1102], w: 1950, d: 850, ht: 850, col: COL.soft, snap: { y: 'lo' } },
  { room: 'R06', n: 'TV szekrény', c: [383, 1137], w: 1700, d: 400, ht: 500, col: COL.wood, snap: { x: 'hi', y: 'lo' } },
  // fürdő (R08). The brochure's bathroom is the one before the redraw (K21 / K29): the model's room has the W170
  // wall in it, leaving a 574 mm bay against the R03 wall (x 3335–3909). The shower tray keeps its notch; the WC and
  // the basin keep their wall and corner, fitted into that bay; the 1.7 m bath fits nowhere and is left out (OMIT).
  { room: 'R08n', n: 'Zuhanytálca 80×80', c: [910, 235], w: 769, d: 800, ht: 150, col: COL.sani, snap: { x: 'lo', y: 'hi' } },
  { room: 'R08', n: 'WC csésze', at: [3622, 7921], w: 400, d: 700, ht: 800, col: COL.sani },
  { room: 'R08', n: 'Mosdó 40', at: [3510, 7350], w: 350, d: 400, ht: 850, col: COL.sani },
  // konyha (R03's west leg): hob + worktop along the outer wall, then down the fürdő wall: corner, sink, fridge
  { room: 'R03k', n: 'Tűzhely 60', at: [1084, 7971], w: 600, d: 600, ht: 900, col: COL.metal },
  { room: 'R03k', n: 'Konyhapult', at: [1934, 7971], w: 1100, d: 600, ht: 900, col: COL.kitchen },
  { room: 'R03k', n: 'Konyhapult (sarok)', at: [2785, 7971], w: 600, d: 600, ht: 900, col: COL.kitchen },
  { room: 'R03k', n: 'Mosogató', at: [2785, 7371], w: 600, d: 600, ht: 900, col: COL.metal },
  { room: 'R03k', n: 'Hűtő 60', at: [2760, 6771], w: 650, d: 600, ht: 1850, col: COL.metal },
  // étkező: table 120 × 80 with six chairs — two at each end, two on the open side
  { room: 'R03e', n: 'Étkezőasztal 120', c: [1252, 667], w: 1200, d: 800, ht: 750, col: COL.wood },
  // előszoba, wc, kamra
  { room: 'R01', n: 'Cipősszekrény', c: [1532, 1140], w: 1400, d: 300, ht: 900, col: COL.wood, snap: { x: 'lo', y: 'lo' } },
  { room: 'R04', n: 'Kézmosó', c: [1347, 932], w: 450, d: 300, ht: 850, col: COL.sani, snap: { y: 'hi' } },
  { room: 'R04', n: 'WC csésze', c: [1346, 1112], w: 400, d: 700, ht: 800, col: COL.sani, snap: { y: 'lo' } },
  { room: 'R05', n: 'Kamrapolc', c: [1082, 1115], w: 862, d: 400, ht: 1800, col: COL.wood, snap: { x: 'lo', y: 'lo' } }];

// ---- the upper floor (ghost coordinates, brochure orientation; turned onto the model on the way out) ----
// brochure 2× crop px of the upper sheet ↔ ghost room rectangle
const RU = {
  R10: { img: [1025, 390, 1430, 605], mod: [5907, 4936, 8648, 6285] },     // fürdő (ghost "Fürdő")
  R12: { img: [1330, 660, 1700, 1015], mod: [7983, 6614, 10450, 8839] } };  // terasz
function mapU(room, ix, iy) { const r = RU[room], [a0, b0, a1, b1] = r.img, [m0, n0, m1, n1] = r.mod;
  const gx = m0 + (ix - a0) / (a1 - a0) * (m1 - m0), gy = n0 + (iy - b0) / (b1 - b0) * (n1 - n0); return [GX - gx, GY - gy]; }
const U = [
  // fürdő: basin in the corner by the door, the bath along the outer wall, WC by the tároló wall
  { room: 'R10', n: 'Mosdó 60', c: [1107, 425], w: 600, d: 450, ht: 850, col: COL.sani, snapG: { y: 'lo' } },
  { room: 'R10', n: 'Kád 170×75', c: [1302, 440], w: 1700, d: 750, ht: 600, col: COL.sani, snapG: { x: 'hi', y: 'lo' } },
  { room: 'R10', n: 'WC csésze', c: [1378, 545], w: 700, d: 400, ht: 800, col: COL.sani, snapG: { x: 'hi' } },
  // terasz: a square table turned 45° with four chairs on its sides
  { room: 'R12', n: 'Kerti asztal 70×70', c: [1510, 850], w: 700, d: 700, ht: 740, ang: 45, col: COL.garden }];

// ---- build ----
// furnish(project) adds the furniture, the upper floor and the 2850 ceiling to a P33 project IN PLACE and returns
// {objs, notes}. make-preload.js calls it for both preloaded plans; run directly, it writes the v2 copy.
function furnish(P) {
const D = P.data, ghost = JSON.parse(fs.readFileSync(GHOST, 'utf8')).project;
let seq = +D.seq || 0;const nid = pre => pre + (++seq);
const layer = 'L0';                                   // Szerkezet / Alap: objects belong to the construct role
const objs = [], notes = [];
const OMIT = ['ground · Kád 170×75 (fürdő): the redrawn bathroom (W170) has no wall it fits — left out'];
function snapAxis(v, half, lo, hi, how) { return how === 'lo' ? lo + half : how === 'hi' ? hi - half : v; }
function box(level, n, x, y, w, d, ht, col, extra) {
  return Object.assign({ level, x: Math.round(x), y: Math.round(y), z: 0, w, d, ht, ang: 0, name: n, color: col, layer, id: nid('O') }, extra || {}); }
G.forEach(it => { const m = R[it.room].mod;let x, y;
  if (it.at) [x, y] = it.at; else [x, y] = map(it.room, it.c[0], it.c[1]);
  if (it.snap) { x = snapAxis(x, it.w / 2, m[0], m[2], it.snap.x); y = snapAxis(y, it.d / 2, m[1], m[3], it.snap.y); }
  objs.push(box('ground', it.n, x, y, it.w, it.d, it.ht, it.col)); });
// the dining chairs, placed off the table so they stay square to it
{ const t = objs.find(o => o.name === 'Étkezőasztal 120'), c = (x, y) => objs.push(box('ground', 'Szék', x, y, 450, 450, 900, COL.wood));
  [-200, 200].forEach(dy => { c(t.x + t.w / 2 + 250, t.y + dy); c(t.x - t.w / 2 - 250, t.y + dy); });
  [-300, 300].forEach(dx => c(t.x + dx, t.y - t.d / 2 - 250)); }
// the upper floor geometry from the ghost
const gw = ghost.building.walls.upper || [];
P.building.walls.upper = gw.map(w => ({ x0: GX - Math.max(w.x0, w.x1), x1: GX - Math.min(w.x0, w.x1), y0: GY - Math.max(w.y0, w.y1), y1: GY - Math.min(w.y0, w.y1), id: nid('W') }));
const NUM = { Szoba: 'R09', 'Fürdő': 'R10', 'Közlekedő': 'R11', Terasz: 'R12', 'Tároló': 'R13', 'Lépcső': 'R11L' };
(ghost.data.floors || []).filter(f => f.level === 'upper').forEach(f => {
  D.floors.push({ level: 'upper', num: NUM[f.name] || '', name: f.name, poly: f.poly.map(p => [Math.round(GX - p[0]), Math.round(GY - p[1])]).reverse(), fill: f.fill || '#e8e3d8', layer, id: nid('F') }); });
U.forEach(it => { const r = RU[it.room].mod;let [x, y] = mapU(it.room, it.c[0], it.c[1]);
  if (it.snapG) {   // snap in ghost space (lo / hi faces of the ghost room), then turn
    let gx = GX - x, gy = GY - y;gx = snapAxis(gx, it.w / 2, r[0], r[2], it.snapG.x);gy = snapAxis(gy, it.d / 2, r[1], r[3], it.snapG.y);x = GX - gx;y = GY - gy; }
  objs.push(box('upper', it.n, x, y, it.w, it.d, it.ht, it.col, it.ang ? { ang: it.ang * Math.PI / 180 } : null)); });
{ const t = objs.find(o => o.name === 'Kerti asztal 70×70'), k = 650 / Math.SQRT2;
  [[k, k], [-k, k], [k, -k], [-k, -k]].forEach(([dx, dy]) => objs.push(box('upper', 'Kerti szék', t.x + dx, t.y + dy, 450, 450, 850, COL.garden, { ang: Math.PI / 4 }))); }
// conflicts worth telling: an item over a door's swing (a 900 disc in front of each door) or out of its room
const inPoly = (x, y, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j];
  if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
objs.forEach(o => { const fl = D.floors.filter(f => f.level === o.level);
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [o.x + a * o.w / 2 * 0.98, o.y + b * o.d / 2 * 0.98]);
  if (!o.ang && !corners.every(([x, y]) => fl.some(f => inPoly(x, y, f.poly)))) notes.push(o.level + ' · ' + o.name + ': reaches outside its room (model and brochure differ here)');
  (D.openings || []).filter(op => op.type === 'door' && op.level === o.level).forEach(op => {
    const dx = Math.max(Math.abs(op.x - o.x) - o.w / 2, 0), dy = Math.max(Math.abs(op.y - o.y) - o.d / 2, 0);
    if (Math.hypot(dx, dy) < 700) notes.push(o.level + ' · ' + o.name + ': within the swing of door ' + op.id); }); });
D.objects = (D.objects || []).concat(objs);
D.seq = seq;
P.building.heights = Object.assign({}, P.building.heights, { ground: 2850 });   // the user's 2850 (IDEA-003 §2.3)
P.state.levels = Object.assign({}, P.state.levels, { upper: true });
return { objs, notes: notes.concat(OMIT) };
}

module.exports = { furnish };
if (require.main === module) {
const src = JSON.parse(fs.readFileSync(SRC, 'utf8')), P = src.project, D = P.data;
const { objs, notes } = furnish(P);
const out = Object.assign({}, src, { name: 'P33 teszt v2 — bútorral (eredeti tervlap)', saved: new Date().toISOString(), project: P });
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log('wrote ' + path.relative(REPO, OUT) + ': ' + objs.filter(o => o.level === 'ground').length + ' objects on the ground floor, '
  + objs.filter(o => o.level === 'upper').length + ' upstairs, ' + P.building.walls.upper.length + ' upper walls, ' + D.floors.filter(f => f.level === 'upper').length + ' upper rooms');
notes.forEach(n => console.log('  ⚑ ' + n));
}
