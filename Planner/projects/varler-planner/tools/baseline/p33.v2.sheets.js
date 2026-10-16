// p33.v2.sheets.js — the v2 sheets: the layer map (every prepared layer, the niches, the CHANNEL) and the chase map
// (shared / beside the mains / new). Labels go through labels.js: nothing sits on anything (the user's rule).
'use strict';
const sheet = require('./sheet'), labels = require('./labels'), EM = require('./emit'), S = require('./selv');
const esc = sheet.esc, { line, midOf } = EM;
const VIEW = [300, 1450, 10500, 9050], BOUNDS = [300, 1900, 10800, 9300];

// drawn widest first, so a shared route shows as a bundle of stripes
const LCOL = { CHANNEL: ['#222222', 120, 'CHANNEL BASE → RBX'], CONTROL: ['#7a5cc0', 100, 'Vezérlés (RS-485)'], SENSOR: ['#2e9e5b', 82, 'Érzékelő'],
  BUSB: ['#e08a00', 64, 'B busz (24 V)'], LV: ['#d4537e', 48, 'LV (LED-vonal)'], HMI: ['#2f79c9', 34, 'Kezelő'], MEDIA: ['#8a5a2a', 22, 'Média'],
  SECURITY: ['#c0392b', 16, 'Biztonság (alap)'] };
const SHORT = { 'POR/rs485': 'RS485', 'POR/tof': 'ToF', 'SEN/mmwave': 'mmWave', 'SEN/co2': 'CO₂', 'SEN/pir': 'PIR', 'SEN/leak': 'víz', 'SEN/thermal': 'hőkamera',
  'NTL/tr': 'NTL', 'LMP/b': 'lábfény', 'LNR/b': 'LED-B', 'LNR/rov': 'LED', 'PAN/touch': 'panel', 'THR/bus': 'termosztát', 'SPK/17': 'hangszóró' };
const m1 = v => (+v).toFixed(1).replace('.', ',');

function legendRows(put, rows, y0) {                                    // own legend: as many rows as needed, no crowding
  const x0 = 600, step = 1640;
  put(`<rect x="${x0 - 100}" y="${y0 - 200}" width="9900" height="${rows.length * 190 + 120}" fill="#fff" stroke="#ccc" stroke-width="10"/>`);
  rows.forEach((row, r) => row.forEach((it, k) => { const x = x0 + k * step, y = y0 + r * 190;
    if (it.box) put(`<rect x="${x}" y="${y - 95}" width="120" height="120" fill="${it.c}"/>`);
    else if (it.dot) put(`<circle cx="${x + 60}" cy="${y - 35}" r="50" fill="${it.fill || it.c}" stroke="${it.c}" stroke-width="18"/>`);
    else put(`<line x1="${x}" y1="${y - 35}" x2="${x + 300}" y2="${y - 35}" stroke="${it.c}" stroke-width="${it.w || 40}" ${it.d ? `stroke-dasharray="${it.d}"` : ''}/>`);
    put(`<text x="${x + (it.box || it.dot ? 160 : 360)}" y="${y}" font-size="88">${esc(it.n)}</text>`); }));
}
function titleOf(put, t, sub, sub2) {
  put(`<text x="500" y="1640" font-size="190" font-weight="700" fill="#222">${esc(t)}</text><text x="500" y="1810" font-size="110" fill="#666">${esc(sub)}</text>`);
  if (sub2) put(`<text x="500" y="1950" font-size="110" fill="#666">${esc(sub2)}</text>`);
}

function niches(put, lp, X) {
  X.niches.forEach(n => { const z = n.z || 150; lp.block(n.x, n.y, 2 * z + 40, 2 * z + 40);
    put(n.round ? `<circle cx="${n.x}" cy="${n.y}" r="${z}" fill="${n.c}" stroke="#fff" stroke-width="14"/>`
      : `<rect x="${n.x - z}" y="${n.y - z}" width="${2 * z}" height="${2 * z}" fill="${n.c}" stroke="#fff" stroke-width="14"/>`);
    lp.add({ x: n.x, y: n.y, text: n.t, size: 80, weight: 700, color: n.c, r: z + 30, pri: 80, leader: false }); });
}

function layerSheet(X, file) {
  const { G, R, v1Data, runs, extraPolys, optPolys, optPts } = X, lp = labels.create({ bounds: BOUNDS });
  let s = sheet.base(G, { lp, roomSize: 130 }); const put = t => s += t;
  R.legs.filter(l => l.kind === 'dist' || l.kind === 'trunk').forEach(l => put(line(l.poly, '#e6e0d4', 22, null, 1)));
  v1Data.legs.filter(l => l.kind === 'dh').forEach(l => put(line(l.poly, '#b9e0e0', 150, null, 1)));
  // the stack: CHANNEL first, then the layers, each narrower than the one before
  const order = ['CHANNEL', 'CONTROL', 'SENSOR', 'BUSB', 'LV', 'HMI', 'MEDIA', 'SECURITY'];
  order.forEach(id => { const [c, w] = LCOL[id];
    extraPolys.filter(p => p.layer === id || (id === 'BUSB' && p.layer === 'BUSB')).forEach(p => { put(line(p.poly, c, w)); lp.blockLine(p.poly, w + 20); });
    const r = runs.find(r => r.L.id === id); if (!r) return;
    r.legs.forEach(l => { if (l.kind === 'dh') { put(line(l.poly, c, w)); lp.blockLine(l.poly, w + 20); }
      if (l.kind === 'dceil') { put(line(l.poly.slice(-2), c, 20, '70 45')); lp.blockLine(l.poly.slice(-2), 40); } }); });
  optPolys.forEach(p => { put(line(p.poly, LCOL.SECURITY[0], 16, '60 40', .8)); lp.blockLine(p.poly, 30); });
  // endpoints: one column = one group; a dot per layer, the codes as one label
  const cols = [];
  runs.forEach(r => r.EP.forEach(e => { if (r.L.id === 'LV' && e.dev.code === 'PAN') return;
    let g = cols.find(g => Math.hypot(g.x - e.x, g.y - e.y) <= 150); if (!g) cols.push(g = { x: e.x, y: e.y, items: [] });
    g.items.push({ layer: r.L.id, code: `${e.dev.code || e.code}/${e.v}` }); }));
  cols.forEach(g => { const n = g.items.length, w = 105;
    g.items.forEach((it, k) => { const x = g.x + (k - (n - 1) / 2) * w; put(`<circle cx="${x}" cy="${g.y}" r="48" fill="${LCOL[it.layer][0]}" stroke="#fff" stroke-width="12"/>`); });
    lp.block(g.x, g.y, n * w + 60, 140);
    lp.add({ x: g.x, y: g.y, text: g.items.map(it => SHORT[it.code] || it.code).join(' · '), size: 56, color: '#333', r: 70 + (n - 1) * 50, pri: 20 }); });
  optPts.forEach(p => { put(`<circle cx="${p.x}" cy="${p.y}" r="44" fill="#fff" stroke="${LCOL.SECURITY[0]}" stroke-width="16" stroke-dasharray="20 14"/>`); lp.block(p.x, p.y, 120, 120); });
  niches(put, lp, X);
  put(lp.render());
  titleOf(put, 'P33 — v2 rétegtérkép: minden réteg előkészítve', `${X.ep} új SELV-végpont · cső ${m1(X.Q.condTotal)} m · kábel ${m1(X.cabTotal)} m · sáv 2700 · rétegenként külön cső, közös horonyban`,
    'Halvány türkiz: a v1 adathorony (Cat6A) · halvány bézs: a v1 erősáram · szaggatott piros: a biztonsági opció (6b)');
  legendRows(put, [
    ['CHANNEL', 'CONTROL', 'SENSOR', 'BUSB', 'LV', 'HMI'].map(k => ({ n: LCOL[k][2], c: LCOL[k][0], w: Math.max(30, LCOL[k][1] * .55) })),
    [{ n: LCOL.MEDIA[2], c: LCOL.MEDIA[0], w: 22 }, { n: LCOL.SECURITY[2], c: LCOL.SECURITY[0], w: 18 }, { n: 'Biztonság (opció)', c: LCOL.SECURITY[0], w: 18, d: '60 40' },
      { n: 'Mennyezeti futás', c: '#555', w: 20, d: '70 45' }, { n: 'v1 adathorony', c: '#b9e0e0', w: 60 }, { n: 'v1 erősáram', c: '#e6e0d4', w: 30 }],
    [{ n: 'RB-H fülke', c: '#1f3f8b', box: true }, { n: 'RB-M fülke', c: '#4a6fb5', box: true }, { n: 'BASE', c: '#0b4f6c', box: true }, { n: 'SSC (biztonság)', c: '#c0392b', box: true },
      { n: 'B busz akku', c: '#e08a00', box: true }, { n: 'Opciós pont', c: '#c0392b', dot: true, fill: '#fff' }]], 9480);
  sheet.write(file, s, VIEW, { px: 3200 });
}

function chaseSheet(X, file) {
  const { G, R, v1Data, runs, extraPolys, CH, VERT, feeds, optPolys } = X, lp = labels.create({ bounds: BOUNDS });
  let s = sheet.base(G, { lp, roomSize: 130 }); const put = t => s += t;
  const CC = { kozos: '#0f8b8d', mellett: '#e08a00', uj: '#c0392b' };
  R.legs.filter(l => l.kind === 'dist' || l.kind === 'trunk').forEach(l => put(line(l.poly, '#e6e0d4', 22, null, 1)));
  v1Data.legs.filter(l => l.kind === 'dh').forEach(l => put(line(l.poly, '#cfe9e9', 160, null, 1)));
  // every horizontal SELV piece in the colour of its class (the same 100 mm cells the pricing used)
  const polys = runs.flatMap(r => r.legs.filter(l => l.kind === 'dh').map(l => l.poly)).concat(extraPolys.map(p => p.poly));
  const cls = (x, y) => { const c = CH.cells.get(Math.round(x / 100) + ':' + Math.round(y / 100)); return c ? c.cls : 'uj'; };
  polys.forEach(poly => { for (let k = 1; k < poly.length; k++) { const a = poly[k - 1], b = poly[k]; if (Math.abs(a[2] - b[2]) > 1) continue;
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / 100));
    for (let i = 0; i < n; i++) { const x0 = a[0] + (b[0] - a[0]) * i / n, y0 = a[1] + (b[1] - a[1]) * i / n, x1 = a[0] + (b[0] - a[0]) * (i + 1) / n, y1 = a[1] + (b[1] - a[1]) * (i + 1) / n;
      put(`<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${CC[cls((x0 + x1) / 2, (y0 + y1) / 2)]}" stroke-width="90" stroke-linecap="butt"/>`); } }
    lp.blockLine(poly, 110); });
  optPolys.forEach(p => { put(line(p.poly, '#c0392b', 16, '60 40', .7)); lp.blockLine(p.poly, 30); });
  // the 230 V feeds on top: they widen the v1 trunk groove (2600), a separate groove from the SELV band
  feeds.forEach(f => { if (f.path) { const p = f.path.map(([x, y]) => [x, y, 2600]); put(line(p, '#1f3f8b', 26, '90 50', .95)); lp.blockLine(p, 50); } });
  VERT.cols.forEach(c => { put(`<circle cx="${c.x}" cy="${c.y}" r="52" fill="#7a5cc0" stroke="#fff" stroke-width="12"/>`); lp.block(c.x, c.y, 130, 130); });
  niches(put, lp, X);
  put(lp.render());
  titleOf(put, 'P33 — v2 horony: közös, a v1 mellett, új', `Vízszintes horony 2700: közös ${m1(CH.m.kozos)} m · a v1 erősáramú horony mellett ${m1(CH.m.mellett)} m · új ${m1(CH.m.uj)} m · függőleges ${m1(X.Q.vert)} m (${X.Q.cols} oszlop)`,
    'A munkadíj ezen a bontáson alapul: közös = a meglévő horony szélesítése (35 %), mellett = egy menetben a v1-gyel (75 %), új = teljes díj');
  legendRows(put, [
    [{ n: `közös — v1 adathorony szélesítése`, c: CC.kozos, w: 60 }, { n: '', c: '#fff', w: 1 }, { n: `a v1 erősáram mellett`, c: CC.mellett, w: 60 }, { n: `teljesen új`, c: CC.uj, w: 60 },
      { n: 'függőleges oszlop', c: '#7a5cc0', dot: true }],
    [{ n: '230 V a fülkékhez (hossz; a v1 gerincén fut)', c: '#1f3f8b', w: 30, d: '90 50' }, { n: '', c: '#fff', w: 1 }, { n: '', c: '#fff', w: 1 }, { n: 'Biztonság (opció)', c: '#c0392b', w: 16, d: '60 40' },
      { n: 'v1 adathorony', c: '#cfe9e9', w: 60 }]], 9520);
  sheet.write(file, s, VIEW, { px: 3200 });
}

module.exports = { layerSheet, chaseSheet };
