// V0 REFERENCE COPY (2026-10-11) — the standalone grid painter before V1 moved it into src/06c-view-core.js.
// Kept only to compare against; tools/p33-axo.js is the live tool. Writes docs/views/fig/p33-axo-v0.svg.
// P33 ground floor as a clean axonometric — the first try at the "WJEC / exploded diagram" look.
//
//   node tools/p33-axo.js [plan.vplan.json] [--png]
//
// Reads the real plan (walls, rooms, openings, furniture, endpoints) and writes vector SVG to
// docs/views/fig/p33-axo.svg (and a PNG beside it with --png, through the main checkout's portable
// headless Chrome). No 3D engine: every element of P33 is axis-aligned, so the floor is cut into a
// grid of columns from every edge coordinate; each column holds solid z-intervals (plinth, wall,
// lintel, furniture). Drawn far-to-near in grid order this is an exact painter's algorithm for an
// orthographic camera looking along +x +y (proof in docs/views/PRIMER-VIEWS.md §4.2), and only the
// real edges get a stroke, so no seams show between the cells of one wall.
//
// Walls follow the Sims-style cutaway (VIEWS WP V3): the two far exterior sides stand at full
// height, the camera-side exterior walls and every interior wall are cut at CUT.
'use strict';
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const REPO = path.resolve(ROOT, '../../..');
const args = process.argv.slice(2);
const planFile = args.find(a => !a.startsWith('--')) || path.join(REPO, 'Calculator/P33-teszt_v2_butor.vplan.json');
const OUT = path.join(ROOT, 'docs/views/fig/p33-axo-v0.svg');

const P = JSON.parse(fs.readFileSync(planFile, 'utf8')).project;
const LEVEL = 'ground';
const H = P.building.heights[LEVEL] || 2850;   // P33 ceiling
const CUT = 1500;                               // interior cut: switches (1100–1300) still sit on the face
const NEAR_CUT = 1000;                          // camera-side exterior walls drop lower (Sims cutaway)
const PLINTH = 200;                             // the base plate the model stands on
const DOOR_W = 900, DOOR_H = 2100, WIN_W = 1200, WIN_H = 1500, WIN_SILL = 900;   // = 04-render.js

// ---- camera: yaw puts the Előszoba corner (min x, min y) nearest, pitch = how steeply we look down
const YAW = 225 * Math.PI / 180, PITCH = 50 * Math.PI / 180, K = 0.105;   // K: px per mm
const sY = Math.sin(YAW), cY = Math.cos(YAW), sP = Math.sin(PITCH), cP = Math.cos(PITCH);
function prj(x, y, z) { const rx = x * cY - y * sY, ry = x * sY + y * cY; return [rx * K, (ry * sP - z * cP) * K]; }

// ---- palette (light, colourless line art + pastel floors; one place to retune the whole look)
const C = {
  paper: '#f7f6f2', ink: '#262624', inkSoft: '#6d6a63', objInk: '#9a968c',
  top: '#ffffff', cut: '#c9c3b6', objTop: '#fbfaf6',
  west: '#efede8', north: '#dddad3', objW: '#f6f5f1', objN: '#ebe9e3', plinthW: '#e6e3dc', plinthN: '#d3cfc6', thresh: '#ebe8e1',
};
const ROOMCOL = { R01: '#efe4c8', R03: '#f3d9c6', R04: '#d3e6ef', R08: '#d3e6ef', R05: '#e6e1d5',
  R03L: '#e3e0da', R06: '#dce9c9', R07: '#f1eac0' };
const STK_COL = { construct: '#7c7468', mark: '#c0530f', hw: '#4a5a68', base: '#1f6f8b', channel: '#8a7bbf',
  'sys:MAINS': '#d1493f', 'sys:LV': '#e6a800', 'sys:BUSB': '#b07a2a', 'sys:CONTROL': '#7a5cc0', 'sys:DATA': '#16a085',
  'sys:KNX': '#2e7d32', 'sys:SENSOR': '#2f79c9', 'sys:RF': '#3fa7a7', 'sys:HMI': '#5470b0', 'sys:MEDIA': '#c2638a',
  'sys:USB': '#607d8b', 'sys:SECURITY': '#444444', cluster: '#9c6b30', arm: '#2e9e5b', 'sys:EXTRA': '#b0489a' };   // = 05m-stack.js
const ROLE_HU = { 'sys:MAINS': 'Erősáram', 'sys:LV': 'Törpefeszültség (A)', 'sys:BUSB': 'Biztosított 24 V (B)',
  'sys:CONTROL': 'Vezérlés', 'sys:DATA': 'Adat / PoE', 'sys:SENSOR': 'Érzékelők', 'sys:HMI': 'Kezelőfelületek',
  'sys:MEDIA': 'Média és hang', 'sys:USB': 'USB', 'sys:SECURITY': 'Biztonságtechnika', hw: 'Hardver', base: 'BASE' };

const walls = P.building.walls[LEVEL];
const rooms = P.data.floors.filter(f => f.level === LEVEL);
const openings = P.data.openings.filter(o => o.level === LEVEL);
const objects = P.data.objects.filter(o => o.level === LEVEL && !o.boardFor && !o.autoObj);
const layerRole = {}; P.layers.forEach(l => layerRole[l.id] = l.role);

function inPoly(x, y, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
  const [xi, yi] = poly[i], [xj, yj] = poly[j];
  if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
const roomAt = (x, y) => rooms.find(r => inPoly(x, y, r.poly)) || null;
const inBox = (x, y, b) => x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1;

// ---- which walls stand full height: exterior walls whose open side faces away from the camera
function wallClass(w) {
  const horiz = (w.x1 - w.x0) >= (w.y1 - w.y0), m = 60;
  const cx = (w.x0 + w.x1) / 2, cy = (w.y0 + w.y1) / 2;
  const probe = (px, py) => !!roomAt(px, py) || walls.some(o => o !== w && inBox(px, py, o));
  const lo = horiz ? probe(cx, w.y0 - m) : probe(w.x0 - m, cy), hi = horiz ? probe(cx, w.y1 + m) : probe(w.x1 + m, cy);
  if (lo && hi) return 'int';
  return hi ? 'near' : 'far';            // open side at the low coordinate faces the camera
}
walls.forEach(w => { w.cls = wallClass(w); w.top = w.cls === 'far' ? H : w.cls === 'near' ? NEAR_CUT : CUT; });

// ---- opening rectangles (plan) with their vertical gap
function openRect(o) {
  const win = o.type === 'window', w = o.w || (win ? WIN_W : DOOR_W), along = Math.abs(Math.cos(o.ang)) > 0.5;
  const host = walls.find(r => inBox(o.x, o.y, { x0: r.x0 - 1, y0: r.y0 - 1, x1: r.x1 + 1, y1: r.y1 + 1 }));
  if (!host) return null;
  const r = along ? { x0: o.x - w / 2, x1: o.x + w / 2, y0: host.y0, y1: host.y1 } : { x0: host.x0, x1: host.x1, y0: o.y - w / 2, y1: o.y + w / 2 };
  const sill = o.sill != null ? o.sill : (win ? WIN_SILL : 0), top = sill + (o.h || (win ? WIN_H : DOOR_H));
  return Object.assign(r, { a: sill, b: top, host, win });
}
const opens = openings.map(openRect).filter(Boolean);

// ---- the grid
const xs = new Set(), ys = new Set();
const addB = b => { xs.add(Math.round(b.x0)); xs.add(Math.round(b.x1)); ys.add(Math.round(b.y0)); ys.add(Math.round(b.y1)); };
walls.forEach(addB); opens.forEach(addB);
rooms.forEach(r => r.poly.forEach(([x, y]) => { xs.add(Math.round(x)); ys.add(Math.round(y)); }));
const objBox = o => { const sw = Math.abs(Math.sin(o.ang || 0)) > 0.5; const w = sw ? o.d : o.w, d = sw ? o.w : o.d;
  return { x0: o.x - w / 2, x1: o.x + w / 2, y0: o.y - d / 2, y1: o.y + d / 2 }; };
objects.forEach(o => addB(objBox(o)));
const X = [...xs].sort((a, b) => a - b), Y = [...ys].sort((a, b) => a - b);
const NI = X.length - 1, NJ = Y.length - 1;

// column intervals: [{a,b,top,kind}] sorted, merged where they touch
const col = []; for (let i = 0; i < NI; i++) { col.push([]); for (let j = 0; j < NJ; j++) col[i].push([]); }
const roomOf = []; for (let i = 0; i < NI; i++) roomOf.push(new Array(NJ).fill(null));
function addIv(list, a, b, top, kind) { if (b <= a) return; list.push({ a, b, top, kind }); }
function mergeIv(list) {
  list.sort((p, q) => p.a - q.a); const out = [];
  for (const iv of list) { const L = out[out.length - 1];
    if (L && iv.a <= L.b + 0.5) { if (iv.b >= L.b) { L.b = iv.b; L.top = iv.top; L.kind = iv.kind === 'plinth' ? L.kind : iv.kind; } }
    else out.push(Object.assign({}, iv)); }
  return out;
}
for (let i = 0; i < NI; i++) for (let j = 0; j < NJ; j++) {
  const cx = (X[i] + X[i + 1]) / 2, cy = (Y[j] + Y[j + 1]) / 2, list = [];
  const w = walls.find(r => inBox(cx, cy, r)), rm = roomAt(cx, cy);
  if (!w && !rm) continue;
  roomOf[i][j] = rm;
  const op = w && opens.find(o => o.host === w && inBox(cx, cy, o)) || (w && opens.find(o => inBox(cx, cy, o)));
  addIv(list, -PLINTH, 0, rm ? (ROOMCOL[rm.num] || C.thresh) : C.thresh, 'plinth');
  if (w) {
    const topC = w.top === H ? C.top : C.cut;
    if (op) { addIv(list, 0, Math.min(op.a, w.top), topC, 'wall'); if (op.b < w.top) addIv(list, op.b, w.top, topC, 'wall'); }
    else addIv(list, 0, w.top, topC, 'wall');
  }
  for (const o of objects) { const b = objBox(o); if (inBox(cx, cy, b)) addIv(list, o.z || 0, (o.z || 0) + (o.ht || 600), C.objTop, 'obj'); }
  col[i][j] = mergeIv(list);
}

// ---- interval arithmetic for exposure
function minus(a, b, list) { let segs = [[a, b]];
  for (const iv of list) { const nx = []; for (const [p, q] of segs) {
    if (iv.b <= p || iv.a >= q) { nx.push([p, q]); continue; }
    if (iv.a > p) nx.push([p, iv.a]); if (iv.b < q) nx.push([iv.b, q]); } segs = nx; }
  return segs.filter(([p, q]) => q - p > 0.5); }
const cell = (i, j) => (i < 0 || j < 0 || i >= NI || j >= NJ) ? [] : col[i][j];
const hasTop = (i, j, z) => cell(i, j).some(iv => Math.abs(iv.b - z) < 0.5);
function exposedW(i, j, a, b) { return minus(a, b, cell(i - 1, j)); }   // west face (x = X[i])
function exposedN(i, j, a, b) { return minus(a, b, cell(i, j - 1)); }   // north face (y = Y[j])

// ---- SVG builders
const pt = p => p[0].toFixed(1) + ',' + p[1].toFixed(1);
const poly = (pts, fill, extra) => `<polygon points="${pts.map(pt).join(' ')}" fill="${fill}" stroke="${fill}" stroke-width="0.6"${extra || ''}/>`;
const SW = { wall: 1.15, obj: 0.75, plinth: 1.0 };
const line = (p, q, w, c, dash) => `<line x1="${p[0].toFixed(1)}" y1="${p[1].toFixed(1)}" x2="${q[0].toFixed(1)}" y2="${q[1].toFixed(1)}" stroke="${c || C.ink}" stroke-width="${w}" stroke-linecap="round"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
function subtractRanges(a, b, ranges) { return minus(a, b, ranges.map(([p, q]) => ({ a: p, b: q }))); }

let body = '';
const devByCell = new Map();   // "i,j" → [svg] drawn right after that column

function drawColumn(i, j) {
  const x0 = X[i], x1 = X[i + 1], y0 = Y[j], y1 = Y[j + 1];
  for (const iv of cell(i, j)) {
    const sw = SW[iv.kind] || 1, z = iv.b, ob = iv.kind === 'obj', li = (p, q, w) => line(p, q, w, ob ? C.objInk : C.ink);
    // west face
    for (const [a, b] of exposedW(i, j, iv.a, iv.b)) {
      body += poly([prj(x0, y0, a), prj(x0, y1, a), prj(x0, y1, b), prj(x0, y0, b)], iv.kind === 'plinth' ? C.plinthW : ob ? C.objW : C.west);
      body += li(prj(x0, y0, a), prj(x0, y1, a), sw);
      if (b < iv.b - 0.5) body += li(prj(x0, y0, b), prj(x0, y1, b), sw);
      // vertical edges where the face plane stops
      for (const [jj, yy] of [[j - 1, y0], [j + 1, y1]])
        for (const [p, q] of subtractRanges(a, b, exposedW(i, jj, a, b).filter(() => cell(i, jj).length)))
          body += li(prj(x0, yy, p), prj(x0, yy, q), sw);
    }
    // north face
    for (const [a, b] of exposedN(i, j, iv.a, iv.b)) {
      body += poly([prj(x0, y0, a), prj(x1, y0, a), prj(x1, y0, b), prj(x0, y0, b)], iv.kind === 'plinth' ? C.plinthN : ob ? C.objN : C.north);
      body += li(prj(x0, y0, a), prj(x1, y0, a), sw);
      if (b < iv.b - 0.5) body += li(prj(x0, y0, b), prj(x1, y0, b), sw);
      for (const [ii, xx] of [[i - 1, x0], [i + 1, x1]])
        for (const [p, q] of subtractRanges(a, b, exposedN(ii, j, a, b).filter(() => cell(ii, j).length)))
          body += li(prj(xx, y0, p), prj(xx, y0, q), sw);
    }
    // top face — exposed unless another interval sits right on it
    if (cell(i, j).some(o => Math.abs(o.a - z) < 0.5)) continue;
    body += poly([prj(x0, y0, z), prj(x1, y0, z), prj(x1, y1, z), prj(x0, y1, z)], iv.top);
    const thin = iv.kind === 'plinth' ? 0.45 : sw;
    const edge = (ni, nj, p, q) => {
      if (hasTop(ni, nj, z)) {
        // floor-to-floor: a thin line only where the room changes
        if (iv.kind === 'plinth' && roomOf[i][j] && roomOf[ni] && roomOf[ni][nj] && roomOf[ni][nj] !== roomOf[i][j]) body += line(p, q, 0.45, C.inkSoft);
        return; }
      body += li(p, q, thin === 0.45 && cell(ni, nj).length ? 0.6 : sw);
    };
    edge(i - 1, j, prj(x0, y0, z), prj(x0, y1, z)); edge(i + 1, j, prj(x1, y0, z), prj(x1, y1, z));
    edge(i, j - 1, prj(x0, y0, z), prj(x1, y0, z)); edge(i, j + 1, prj(x0, y1, z), prj(x1, y1, z));
  }
  const d = devByCell.get(i + ',' + j); if (d) body += d.join('');
}

// ---- endpoints: sit on the room-side face of their wall at their real height; ceiling items float
const findIdx = (arr, v) => { let lo = 0, hi = arr.length - 2; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (arr[m] <= v) lo = m; else hi = m - 1; } return lo; };
function hostWall(d) {
  let best = null;
  for (const r of walls) { const horiz = (r.x1 - r.x0) >= (r.y1 - r.y0), t = horiz ? r.y1 - r.y0 : r.x1 - r.x0;
    const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2;
    const along = horiz ? d.x >= r.x0 - 5 && d.x <= r.x1 + 5 : d.y >= r.y0 - 5 && d.y <= r.y1 + 5;
    const off = horiz ? d.y - cy : d.x - cx;
    if (!along || Math.abs(off) > t / 2 + 40) continue;
    if (best && Math.abs(off) >= best.dist) continue;
    const s = Math.abs(off) > 1 ? Math.sign(off) : (d.side ? 1 : -1);   // = deviceHostWall in 05h-rooms.js
    best = { r, horiz, t, dist: Math.abs(off), nx: horiz ? 0 : s, ny: horiz ? s : 0, cx, cy }; }
  return best;
}
const legendRoles = new Set();
const overlay = [];
let nDev = 0;
for (const d of P.data.devices) {
  if (d.level !== LEVEL || d.type === 'junction') continue;
  const role = layerRole[d.layer] || 'construct', c = STK_COL[role] || C.inkSoft;
  const hw = d.type === 'board' || d.type === 'base' || d.type === 'rbx';
  let px = d.x, py = d.y, z = d.h || 0, onWall = false;
  const h = d.type === 'light' ? null : hostWall(d);
  if (h) { const k = h.t / 2 + 4; px = h.horiz ? d.x : h.cx + h.nx * k; py = h.horiz ? h.cy + h.ny * k : d.y; onWall = true; }
  // which column does it draw after: the cell in front of the face it sits on
  const ci = findIdx(X, px + (h ? h.nx * 30 : 0)), cj = findIdx(Y, py + (h ? h.ny * 30 : 0));
  const s = prj(px, py, z);
  let g = '';
  if (!onWall) {   // ceiling / free: a faint drop line to the floor, like a leader in the exploded diagrams
    g += line(s, prj(px, py, 0), 0.5, c, '1.5 2.5') + `<circle cx="${s[0].toFixed(1)}" cy="${s[1].toFixed(1)}" r="0.9" fill="${c}"/>`; }
  const facingCam = !h || h.nx < 0 || h.ny < 0;   // marker on a face we see, or seen past the cut
  const r = hw ? 4.2 : 2.6;
  if (d.type === 'light') g += `<circle cx="${s[0].toFixed(1)}" cy="${s[1].toFixed(1)}" r="${r + 0.6}" fill="#fff" stroke="${c}" stroke-width="1.3"/>`;
  else if (d.type === 'switch' || hw) g += `<rect x="${(s[0] - r).toFixed(1)}" y="${(s[1] - r).toFixed(1)}" width="${2 * r}" height="${2 * r}" fill="${c}" stroke="#fff" stroke-width="0.8"/>`;
  else if (d.type === 'socket') g += `<circle cx="${s[0].toFixed(1)}" cy="${s[1].toFixed(1)}" r="${r}" fill="${c}" stroke="#fff" stroke-width="0.8"/>`;
  else g += `<path d="M${s[0].toFixed(1)} ${(s[1] - r - 0.6).toFixed(1)}l${r + 0.6} ${r + 0.6}l-${r + 0.6} ${r + 0.6}l-${r + 0.6} -${r + 0.6}z" fill="${c}" stroke="#fff" stroke-width="0.8"/>`;
  if (!facingCam) g = `<g opacity="0.55">${g}</g>`;
  const key = ci + ',' + cj; if (!devByCell.has(key)) devByCell.set(key, []); devByCell.get(key).push(g);
  if (hw) overlay.push({ s, label: d.ref || d.type.toUpperCase(), c });
  legendRoles.add(role); nDev++;
}

// ---- far → near
for (let i = NI - 1; i >= 0; i--) for (let j = NJ - 1; j >= 0; j--) drawColumn(i, j);

// ---- labels (screen space, on top): room name + number, hardware tags with a short leader
let labels = '';
for (const r of rooms) {
  let sx = 0, sy = 0, a = 0; const p = r.poly;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const f = p[j][0] * p[i][1] - p[i][0] * p[j][1]; a += f; sx += (p[j][0] + p[i][0]) * f; sy += (p[j][1] + p[i][1]) * f; }
  let cx = sx / (3 * a), cy = sy / (3 * a); if (!inPoly(cx, cy, p)) { cx = p[0][0] + 300; cy = p[0][1] - 300; }
  const s = prj(cx, cy, 0), small = Math.abs(a / 2) < 2.5e6;
  labels += `<text x="${s[0].toFixed(1)}" y="${s[1].toFixed(1)}" text-anchor="middle" class="rm${small ? ' sm' : ''}">${r.name.replace('·', '/').toUpperCase()}</text>`
    + `<text x="${s[0].toFixed(1)}" y="${(s[1] + (small ? 8 : 10)).toFixed(1)}" text-anchor="middle" class="rn">${r.num}</text>`;
}
for (const o of overlay) {
  const q = [o.s[0] - 22, o.s[1] - 26];
  labels += line(o.s, q, 0.6, C.ink) + `<text x="${q[0] - 2}" y="${q[1] - 3}" text-anchor="end" class="tag">${o.label}</text>`;
}
// entrance marker
const ent = openings.find(o => o.id === 'B107');
if (ent) { const s = prj(ent.x - 900, ent.y, 0), t = prj(ent.x - 200, ent.y, 0);
  labels += `<line x1="${s[0].toFixed(1)}" y1="${s[1].toFixed(1)}" x2="${t[0].toFixed(1)}" y2="${t[1].toFixed(1)}" stroke="${C.ink}" stroke-width="1.2" marker-end="url(#arr)"/>`
    + `<text x="${(s[0] - 6).toFixed(1)}" y="${(s[1] + 12).toFixed(1)}" text-anchor="end" class="tag">BEJÁRAT</text>`; }

// ---- frame: bounds, title block, legend
const allP = []; for (let i = 0; i <= NI; i += 1) for (const j of [0, NJ]) for (const z of [-PLINTH, H]) allP.push(prj(X[i], Y[j], z));
for (let j = 0; j <= NJ; j++) for (const i of [0, NI]) for (const z of [-PLINTH, H]) allP.push(prj(X[i], Y[j], z));
let minX = Math.min(...allP.map(p => p[0])), maxX = Math.max(...allP.map(p => p[0]));
let minY = Math.min(...allP.map(p => p[1])), maxY = Math.max(...allP.map(p => p[1]));
const M = 70, LEG = 270, W = Math.ceil(maxX - minX + 2 * M + LEG), HH = Math.ceil(maxY - minY + 2 * M + 40);
const ox = M - minX, oy = M + 30 - minY;

const roleList = [...legendRoles].filter(r => ROLE_HU[r]);
let legend = `<g transform="translate(${W - LEG + 10},${M + 30})">`
  + `<text class="lh" x="0" y="0">VÉGPONTOK RENDSZERENKÉNT</text>`;
roleList.forEach((r, k) => { const y = 20 + k * 17;
  legend += `<rect x="0" y="${y - 7}" width="9" height="9" fill="${STK_COL[r]}"/><text class="lt" x="16" y="${y + 1}">${ROLE_HU[r]}</text>`; });
let y2 = 20 + roleList.length * 17 + 18;
legend += `<text class="lh" x="0" y="${y2}">JELEK</text>`;
const sym = [['circle', 'Lámpa (mennyezet, ejtővonallal)'], ['dot', 'Dugalj'], ['sq', 'Kapcsoló / doboz'], ['dia', 'Egyéb végpont'], ['fade', 'Fal túloldalán']];
sym.forEach(([k, t], n) => { const y = y2 + 20 + n * 17, cx = 4.5, cy = y - 3;
  const col = '#555';
  legend += k === 'circle' ? `<circle cx="${cx}" cy="${cy}" r="3.6" fill="#fff" stroke="${col}" stroke-width="1.3"/>`
    : k === 'dot' ? `<circle cx="${cx}" cy="${cy}" r="3" fill="${col}"/>`
    : k === 'sq' ? `<rect x="${cx - 3}" y="${cy - 3}" width="6" height="6" fill="${col}"/>`
    : k === 'dia' ? `<path d="M${cx} ${cy - 4}l4 4l-4 4l-4 -4z" fill="${col}"/>`
    : `<circle cx="${cx}" cy="${cy}" r="3" fill="${col}" opacity="0.45"/>`;
  legend += `<text class="lt" x="16" y="${y + 1}">${t}</text>`; });
const y3 = y2 + 20 + sym.length * 17 + 14;
legend += `<text class="lh" x="0" y="${y3}">FALAK</text>`
  + `<rect x="0" y="${y3 + 9}" width="9" height="9" fill="#fff" stroke="${C.ink}" stroke-width="0.8"/><text class="lt" x="16" y="${y3 + 17}">Távoli külső fal — teljes ${H} mm</text>`
  + `<rect x="0" y="${y3 + 26}" width="9" height="9" fill="${C.cut}" stroke="${C.ink}" stroke-width="0.8"/><text class="lt" x="16" y="${y3 + 34}">Vágott fal — belső ${CUT} · kamera felőli külső ${NEAR_CUT} mm</text>`
  + `</g>`;

const title = `<g transform="translate(${M},${M - 18})"><text class="t1" x="0" y="0">P33 · FÖLDSZINT</text>`
  + `<text class="t2" x="0" y="18">Axonometria · előszoba-sarok elöl · vágás ${CUT} / ${NEAR_CUT} mm · ${nDev} végpont · első próba (V0)</text></g>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${HH}" viewBox="0 0 ${W} ${HH}">
<defs><marker id="arr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L8 4L0 8z" fill="${C.ink}"/></marker>
<style>
text{font-family:Jost,'Segoe UI',Arial,sans-serif;fill:${C.ink}}
.t1{font-family:Marcellus,Georgia,serif;font-size:22px;letter-spacing:3px}
.t2{font-size:10.5px;fill:${C.inkSoft};letter-spacing:.4px}
.rm{font-size:8.6px;letter-spacing:1.3px;font-weight:600;paint-order:stroke;stroke:#ffffffcc;stroke-width:2.6px}
.rm.sm{font-size:6.8px}
.rn{font-family:'Azeret Mono',Consolas,monospace;font-size:6.6px;fill:${C.inkSoft};paint-order:stroke;stroke:#ffffffcc;stroke-width:2.2px}
.tag{font-family:'Azeret Mono',Consolas,monospace;font-size:7.4px;letter-spacing:.6px;paint-order:stroke;stroke:${C.paper};stroke-width:2.4px}
.lh{font-size:8.4px;letter-spacing:1.6px;font-weight:600}
.lt{font-size:8.6px;fill:#3b3a36}
</style></defs>
<rect width="100%" height="100%" fill="${C.paper}"/>
${title}
<g transform="translate(${ox.toFixed(1)},${oy.toFixed(1)})" stroke-linejoin="round">${body}${labels}</g>
${legend}
</svg>`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, svg);
console.log(`wrote ${path.relative(REPO, OUT)}  ${W}×${HH}  grid ${NI}×${NJ}  walls ${walls.length} (far ${walls.filter(w => w.cls === 'far').map(w => w.id).join(' ')})  endpoints ${nDev}`);

if (args.includes('--png')) {
  const CHROME = path.resolve(REPO, '../Planner_VRG_U100/Planner/apps/chrome-headless-shell/chrome-headless-shell.exe');
  const png = OUT.replace(/\.svg$/, '.png'), scale = 2;
  execFileSync(CHROME, ['--headless', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
    `--window-size=${W},${HH}`, `--force-device-scale-factor=${scale}`, `--screenshot=${png}`, 'file:///' + OUT.replace(/\\/g, '/')], { stdio: 'ignore' });
  console.log('wrote ' + path.relative(REPO, png));
}
