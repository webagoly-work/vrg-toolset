// 10-util.js — small helpers shared by the viewer modules (one module scope, filename order).

const $ = id => document.getElementById(id);
const MM = 1 / 1000;                       // model mm -> scene metres

// ---- tokens: the design system's CSS custom properties are the only colour source ----
function tok(name) { return getComputedStyle(document.documentElement).getPropertyValue('--' + name).trim(); }
// '#rrggbb' | '#rrggbbaa' | '#rgb' -> {color: THREE.Color, alpha}
function tokColor(name) {
  let s = tok(name);
  const v = /^var\(--(.+)\)$/.exec(s); if (v) s = tok(v[1]);
  let h = s.replace('#', '');
  if (h.length === 3 || h.length === 4) h = h.split('').map(c => c + c).join('');
  const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
  return { color: new THREE.Color('#' + h.slice(0, 6)), alpha: a };
}
function tokNum(name, fallback) { const n = parseFloat(tok(name)); return Number.isFinite(n) ? n : fallback; }

// ---- language: Hungarian first, English as the second build ----
const I18N = {
  crumb: ['Ügyfél-előnézet', 'Client preview'],
  hint: ['Húzás: forgatás · Jobb gomb: mozgatás · Görgő: nagyítás · Kattints egy helyiségre',
         'Drag: rotate · Right button: pan · Wheel: zoom · Click a room'],
  close: ['Bezárás', 'Close'], light: ['Világos', 'Light'], dark: ['Sötét', 'Dark'],
  room: ['Helyiség', 'Room'], area: ['Alapterület', 'Floor area'], endpoints: ['Végpontok', 'Endpoints'],
  lights: ['Lámpák', 'Lights'], sockets: ['Aljzatok', 'Sockets'], switches: ['Kapcsolók', 'Switches'],
  boxes: ['Dobozok', 'Boxes'],
  legEndpoint: ['Végpont', 'Endpoint'], legJunction: ['Kötő- és szerelvénydoboz', 'Junction and wall box'],
  legRbx: ['RBX', 'Room box'], legBoard: ['Elosztó', 'Distribution board'],
  legGhost: ['Későbbi ütem', 'Later phase'],
};
let LANG = 'hu';
const t = k => (I18N[k] || [k, k])[LANG === 'en' ? 1 : 0];

// ---- numbers, Hungarian style: decimal comma, space before the unit ----
function fmtNum(n, dec) { const s = (dec ? n.toFixed(dec) : String(Math.round(n))); return LANG === 'en' ? s : s.replace('.', ','); }
const pad2 = n => (n < 10 ? '0' : '') + n;

// ---- geometry ----
function polyCentroid(p) { let a = 0, x = 0, y = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const f = p[j][0] * p[i][1] - p[i][0] * p[j][1]; a += f; x += (p[j][0] + p[i][0]) * f; y += (p[j][1] + p[i][1]) * f; }
  if (Math.abs(a) < 1e-9) return p[0].slice(); return [x / (3 * a), y / (3 * a)]; }
// miter offset of a polygon by d (positive = outward), the same rule as the design system's RoomHalo
function offsetPolygon(pts, d) {
  const n = pts.length; let area = 0;
  for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
  const s = area > 0 ? 1 : -1, out = [];
  const nrm = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1; return [s * dy / L, -s * dx / L]; };
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
    const n1 = nrm(p0, p1), n2 = nrm(p1, p2), k = 1 + n1[0] * n2[0] + n1[1] * n2[1];
    out.push([p1[0] + d * (n1[0] + n2[0]) / k, p1[1] + d * (n1[1] + n2[1]) / k]);
  }
  return out;
}
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
