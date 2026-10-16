// emit-data.js — the Adat/PoE layer, the LED feed points and the old-plan check: sheets, ADATRETEG.md,
// the Tuner pack ADATRETEG-Q-001.json and <name>_adatreteg.vplan.json (the baseline + this round's layers)
'use strict';
const fs = require('fs'), path = require('path'), sheet = require('./sheet'), labels = require('./labels'), RU = require('./rules'), EM = require('./emit');
const { planData, PORT_HU, PORTS } = require('./data'), { planLed } = require('./led');
const esc = sheet.esc, { VIEW, PLAN_BOUNDS, line, title, legend, hwName, midOf, cabN } = EM;

const DCOL = '#0f8b8d', ISPCOL = '#555';
const DBOX = { base: '#1f3f8b', rbx: '#222', nest: '#7a5cc0', tee: '#0f8b8d', pull: '#0b4f6c' };
const DBOX_HU = { base: 'BASE (adatközpont)', rbx: 'RBX — SELV rekesz', nest: 'portál fészek (H0)', tee: 'adat elágazó doboz', pull: 'adat húzódoboz' };
const DKIND_HU = { dh: 'vízszintes 2700', drise: 'BASE felszálló', ddrop: 'leállás', dceil: 'mennyezet', disp: 'szolgáltatói bekötés' };
const ST = { ok: ['megvan', '#2e9e5b', '✓'], moved: ['megvan, áthelyezve', '#2e9e5b', '✓'], part: ['részben', '#e08a00', '◐'], miss: ['hiányzik', '#c0392b', '✗'],
  ask: ['tisztázandó', '#2f79c9', '?'], gone: ['helyesen megszűnik', '#8a8a8a', '—'] };
const m1 = v => (v / 1000).toFixed(1).replace('.', ',');
const az = t => /^[aeiouáéíóöőúüűflmnrsxy15]/i.test(String(t)) ? 'az' : 'a';          // the Hungarian article before a code: az A3, a V1
const nCat = cables => (cables || []).filter(c => c.c === 'CAT6A').reduce((a, c) => a + (c.n || 1), 0);

function build(ctx) {
  const DA = planData(ctx.G, ctx.E, ctx.PT, ctx.cfg, ctx.allowed);
  const alt = planData(ctx.G, ctx.E, ctx.PT, Object.assign({}, ctx.cfg, { data: Object.assign({}, ctx.cfg.data, { topology: DA.C.topology === 'rbx' ? 'star' : 'rbx' }) }), ctx.allowed);
  const LE = planLed(ctx.G, ctx.E, ctx.cfg);
  // a LED groove right under a 2450 distribution pipe on the same wall face: say how close they are
  LE.runs.forEach(r => { const f = r.face, near = ctx.R.legs.filter(l => l.kind === 'dist' && Math.abs(l.h - r.h) < 120 && l.poly.some((p, k) => { const q = l.poly[k - 1]; if (!q) return false;
      const on = f.horiz ? (Math.abs(p[1] - f.fix) < 5 && Math.abs(q[1] - f.fix) < 5) : (Math.abs(p[0] - f.fix) < 5 && Math.abs(q[0] - f.fix) < 5); if (!on) return false;
      const u0 = f.horiz ? Math.min(p[0], q[0]) : Math.min(p[1], q[1]), u1 = f.horiz ? Math.max(p[0], q[0]) : Math.max(p[1], q[1]); return u1 > r.lo + 5 && u0 < r.hi - 5; }));
    if (!near.length) return; const od = Math.max(...near.flatMap(l => l.pipes.map(p => +p.cond.slice(1)))), gap = Math.round(Math.abs(near[0].h - r.h) - od / 2 - 10);
    r.nearDist = { legs: near.map(l => l.id), gap, h: near[0].h };
    LE.warn.push({ sev: 'warn', msg: `${r.id}: a ${r.h} mm-es horony fölött ${near[0].h}-on fut a leágazó (${near.map(l => l.id).join(', ')}, ${near.map(l => l.cond).join(' / ')}) — a két horony között ~${gap} mm` }); });
  // the old plan as found, with the answers of round 1 applied (the checklist file itself is not changed)
  const OP0 = ctx.cfg.oldPlan ? require(path.resolve(__dirname, ctx.cfg.oldPlan)) : null, ans = ctx.cfg.oldPlanAnswers || {};
  const OP = OP0 && Object.assign({}, OP0, { ITEMS: OP0.ITEMS.map(it => ans[it.n] ? Object.assign({}, it, ans[it.n], { st0: it.st, answered: true }) : Object.assign({}, it)) });
  // the same layer without the ceiling crossing — the before / after of D07
  const DA0 = (ctx.cfg.ceilLinks || []).length ? planData(ctx.G, ctx.E, ctx.PT, Object.assign({}, ctx.cfg, { ceilLinks: [] }), ctx.allowed) : null;
  return { DA, alt, LE, OP, DA0 };
}
// what round 2 changed, one line each (the answers that became points, rules or engine changes)
function changes(ctx, X) {
  const { cfg, R, E } = ctx, out = [], ids = cfg._ids || {};
  (cfg.edits || []).filter(ed => /^R\d\d/.test(ed.note || '')).forEach(ed => { const id = ed.add ? ids['N:' + ed.add] : ed.move, e = E.find(x => x.id === id);
    out.push(`**${(e && (e.ref || e.id)) || ed.ref || id}** (${id}${e ? ', ' + e.room + ', ' + Math.round(e.h) + ' mm' : ''}) — ${esc(ed.note)}`); });
  R.C.list.filter(c => /válasz/.test(c.src || '')).forEach(c => out.push(`új kör **${c.ref}** — ${esc(c.name)} (${c.mcb}, ${cabN(c.cable)})`));
  const ov = R.legs.filter(l => l.kind === 'trunk' && l.over); if (ov.length) out.push(`D07: a gerinc a lépcsőnyílás fölött a mennyezeten át (${ov.map(l => l.id).join(', ')}); az adat is (3.5) — mindkét végén húzódoboz`);
  if ((X.DA.C.isp || []).filter(Boolean).length > 1) out.push(`D09: ${X.DA.C.isp.length} üres cső a szolgáltatói bekötéshez (${X.DA.C.isp.join(' + ')})`);
  X.LE.runs.filter(r => r.fix).forEach(r => out.push(`${r.id}: ${esc(r.fix)}`));
  X.LE.runs.filter(r => r.cont).forEach(r => out.push(`${r.id}: folytatólagos, ~${m1(r.cont.len)} m (L07) — csak jelölve`));
  (R.prep || []).forEach(it => out.push(`${it.id} ${esc(it.name)} — ${esc(it.why)}: ${it.points.map(q => q.ref).join(' + ')}, ${m1(it.legs.reduce((a, l) => a + l.len, 0))} m pálya, az anyaglistában nincs benne (ALAPRETEG.md 4b)`));
  out.push('Leágazó: az áthaladó csövek a dobozok mellett haladnak el (dobozba csak ott mennek, ahol az áramkörük betáplál, végpontot táplál, elágazik vagy véget ér, illetve 3-nál több sarok után). A legtöbb csövet kapó leállás-doboz így 11 helyett 7 csövet kap.');
  out.push('Javítás: ha egy áramkörnek két azonos típusú kábele futott egy csőben (pl. betáp + lámpavezeték, vagy két váltó-összekötés), a csőbe osztás eddig egynek számolta — most mindkettő benne van a csőméretezésben és a kábelhosszban (NYM-J 4×1,5 +18,6 m, 3×1,5 +6,8 m).');
  out.push('Motor: a leállás-lánc a 2450-es dobozból a fölötte álló pontokhoz (redőnymotorok) külön, felfelé fut — eddig a lánc a felső pontról ment vissza lefelé.');
  return out;
}
function totals(DA) {
  const cond = {}, cab = {}; let box = {};
  DA.legs.forEach(l => l.pipes.forEach(p => { cond[p.cond] = (cond[p.cond] || 0) + l.len; p.cables.forEach(c => { cab[c.c] = (cab[c.c] || 0) + l.len * (c.n || 1); }); }));
  Object.keys(cab).forEach(k => cab[k] *= 1.10);
  DA.boxes.filter(b => b.kind === 'tee' || b.kind === 'pull' || b.kind === 'nest').forEach(b => { const k = DBOX_HU[b.kind] + (b.size === 'tee-L' ? ' (150 × 150)' : ''); box[k] = (box[k] || 0) + 1; });
  return { cond, cab, box, cat: Math.round((cab.CAT6A || 0) / 1000), condAll: Math.round(Object.values(cond).reduce((a, b) => a + b, 0) / 1000) };
}

// ---- sheets --------------------------------------------------------------------------------------------------------
function dataSheet(ctx, X, file) {
  const { G, R, E } = ctx, { DA } = X, lp = labels.create({ bounds: PLAN_BOUNDS });
  let s = sheet.base(G, { lp }); const put = t => s += t;
  // the baseline under it, quiet
  R.legs.filter(l => l.kind === 'dist' || l.kind === 'trunk').forEach(l => put(line(l.poly, '#d9d2c4', 18, null, 1)));
  DA.legs.forEach(l => {
    if (l.kind === 'dh') { put(line(l.poly, DCOL, 24 + 12 * Math.min(4, l.pipes.length - 1))); lp.blockLine(l.poly, 60); }
    if (l.kind === 'disp') lp.blockLine(l.poly, 50);
    if (l.kind === 'dceil') { put(line(l.poly.slice(-2), DCOL, 18, '80 50')); lp.blockLine(l.poly.slice(-2), 40); }
    if (l.kind === 'drise') { put(line(l.poly.slice(0, 2), DCOL, 18, '30 30')); lp.blockLine(l.poly.slice(0, 2), 40); }
    if (l.kind === 'disp') put(line(l.poly, ISPCOL, 22, '60 40'));
    if (l.kind === 'dh' && l.len > 700 && !l.over) { const m = midOf(l.poly), n = nCat(l.cables);
      lp.add({ x: m.x, y: m.y, text: n ? `${l.cond} · ${n}× Cat6A` : `${l.cond} üres`, size: 70, color: '#0b5b5c', r: 45, pri: 10 }); } });
  const isp = DA.legs.find(l => l.kind === 'disp'); if (isp) { const p = isp.poly[isp.poly.length - 1]; put(`<circle cx="${p[0]}" cy="${p[1]}" r="70" fill="${ISPCOL}"/>`); lp.block(p[0], p[1], 160, 160);
    const sp = isp.pipes.filter(q => q.cables.every(c => c.c === 'SPARE'));
    lp.add({ x: p[0], y: p[1], text: `ISP be · ${sp.length > 1 ? sp.length + '× ' : ''}${sp[0] ? sp[0].cond : ''} üres${sp.some(q => q.spare) ? ' (' + sp.map(q => q.spare).filter(Boolean).join(' + ') + ')' : ''}`, size: 70, color: ISPCOL, weight: 600, r: 80, pri: 40 }); }
  // the ceiling crossing (D07)
  DA.legs.filter(l => l.over).forEach(l => { put(line(l.poly, DCOL, 44, '30 24', .9)); const m = midOf(l.poly);
    lp.add({ x: m.x, y: m.y, text: 'mennyezeten át', size: 64, color: '#0b5b5c', weight: 600, r: 60, pri: 35 }); });
  DA.boxes.forEach(b => { const z = b.kind === 'rbx' || b.kind === 'base' ? 130 : b.kind === 'nest' ? 85 : 70; lp.block(b.x, b.y, 2 * z + 30, 2 * z + 30);
    put(b.kind === 'nest' ? `<rect x="${b.x - z}" y="${b.y - z}" width="${2 * z}" height="${2 * z}" transform="rotate(45 ${b.x} ${b.y})" fill="${DBOX.nest}" stroke="#fff" stroke-width="12"/>`
      : `<rect x="${b.x - z}" y="${b.y - z}" width="${2 * z}" height="${2 * z}" fill="${DBOX[b.kind]}" stroke="#fff" stroke-width="12"/>`);
    if (b.kind === 'tee' || b.kind === 'pull') lp.add({ x: b.x, y: b.y, text: b.id, size: 58, color: DBOX[b.kind], r: 85, pri: 5 }); });
  [...new Set(DA.boxes.filter(b => b.kind === 'rbx' || b.kind === 'base').map(b => b.sp))].forEach(id => { const b = DA.boxes.find(x => x.sp === id), d = ctx.G.D.devices.find(x => x.id === id);
    lp.add({ x: b.x, y: b.y, text: d.type === 'base' ? '■ BASE' : '■ ' + hwName(d), size: 88, weight: 700, color: '#1f3f8b', r: 150, pri: 60 }); });
  DA.EP.forEach(e => { const ceil = e.code === 'ACP';
    put(`<circle cx="${e.x}" cy="${e.y}" r="62" fill="#fff" stroke="${DCOL}" stroke-width="22"/>` + (ceil ? `<circle cx="${e.x}" cy="${e.y}" r="22" fill="${DCOL}"/>` : ''));
    lp.block(e.x, e.y, 150, 150);
    const sk = DA.sinks.find(x => x.id === e.id), via = sk && sk.src ? (sk.src.type === 'base' ? 'BASE' : hwName(sk.src)) : '';
    lp.add({ x: e.x, y: e.y, text: `${e.ref || e.id}${PORTS(e) > 1 ? ' · ' + PORTS(e) + '×' : ''}${via ? ' → ' + via : ''}`, size: 70, color: '#0b5b5c', weight: 600, r: 75, pri: 30 }); });
  put(lp.render());
  title(put, 'P33 — Adat / PoE réteg', `Cat6A a legközelebbi RBX-be (BASE-be), RBX → BASE ${DA.C.rbxLinks}× Cat6A · vízszintes sáv ${DA.C.h} · átvezetés a portál fészkén (H0)${DA.legs.some(l => l.over) ? ' és a lépcsőnyílás fölött, a mennyezeten' : ''} · halvány: erősáramú alapréteg`);
  legend(put, [['Adat 2700', DCOL], ['Mennyezet (AP)', DCOL, '80 50'], ['BASE felszálló', DCOL, '30 30'], ['Szolgáltatói cső', ISPCOL, '60 40'], ['Erősáram (alap)', '#d9d2c4']],
    Object.entries(DBOX_HU).map(([k, n]) => [n, DBOX[k]]));
  sheet.write(file, s, VIEW, { px: 3000 });
}

// the LED runs on a zoomed sheet: the run, its start point + box, the feed, and the old plan's LED lines for checking
const LVIEW = [250, 1350, 6200, 8650];
function ledSheet(ctx, X, file) {
  const { G, E } = ctx, { LE, OP } = X, B = [LVIEW[0] + 50, 1900, LVIEW[0] + LVIEW[2] - 50, LVIEW[1] + LVIEW[3] - 700], lp = labels.create({ bounds: B });
  let s = sheet.base(G, { lp, roomSize: 120, opSize: 70 }); const put = t => s += t;
  E.filter(e => e.role === 'sys:MAINS' && e.x < 6300).forEach(e => { put(`<circle cx="${e.x}" cy="${e.y}" r="34" fill="#fff" stroke="#c9b9b0" stroke-width="12"/>`); lp.block(e.x, e.y, 80, 80); });
  // the old plan's LED lines (dotted) — the source of this request
  if (OP) { const T = OP.toPlan, old = [[[1318, 285], [1318, 458]], [[1320, 558], [1510, 558]], [[1205, 466], [1310, 466]], [[1080, 1040], [1080, 1105], [1310, 1105], [1310, 870]]];
    old.forEach(pl => { const q = pl.map(p => T(p[0], p[1])); put(line(q, '#b07d2b', 16, '20 34')); lp.blockLine(q, 30); }); }
  const fedLabel = new Set();                                                       // one "betáp" tag per feeding device
  LE.runs.forEach((r, k) => {
    const o = 55 * r.face.inward, off = p => r.face.horiz ? [p.x, p.y + o] : [p.x + o, p.y];
    put(line([off(r.a), off(r.b)], '#f2b705', 70, null, .95)); lp.blockLine([off(r.a), off(r.b)], 90);
    const m = { x: (r.a.x + r.b.x) / 2, y: (r.a.y + r.b.y) / 2 };
    lp.add({ x: off(m)[0], y: off(m)[1], text: `${r.id} · ${m1(r.len)} m · ${r.h} mm`, size: 72, color: '#8a5a00', weight: 600, r: 70, pri: 30 });
    // the strip carries on (L07): the same strip, no start point of its own
    if (r.cont) { put(line(r.cont.poly, '#f2b705', 46, '70 45', .95)); lp.blockLine(r.cont.poly, 60); const cm = midOf(r.cont.poly);
      lp.add({ x: cm.x, y: cm.y, text: `${r.id} folytatódik · ~${m1(r.cont.len)} m`, size: 70, color: '#8a5a00', weight: 600, r: 60, pri: 28 }); }
    if (r.srcDev) { put(line([[r.start.x, r.start.y], [r.srcDev.x, r.srcDev.y]], '#e8590c', 14, '40 30')); lp.blockLine([[r.start.x, r.start.y], [r.srcDev.x, r.srcDev.y]], 30);
      if (!fedLabel.has(r.srcDev.id)) { fedLabel.add(r.srcDev.id); lp.add({ x: r.srcDev.x, y: r.srcDev.y, text: 'betáp: ' + (r.srcDev.ref ? hwName(r.srcDev) : r.srcDev.id), size: 62, color: '#b8460a', r: 70, pri: 15 }); } }
    // the marker stays smaller than the gap between two start points in one corner (LB3 / LB4: 100 mm apart)
    const z = 50; put(`<rect x="${r.start.x - z}" y="${r.start.y - z}" width="${2 * z}" height="${2 * z}" fill="#e8590c" stroke="#fff" stroke-width="10"/>`);
    lp.block(r.start.x, r.start.y, 2 * z + 30, 2 * z + 30);
    lp.add({ x: r.start.x, y: r.start.y, text: `${r.box.id} kezdőpont`, size: 70, badge: '#e8590c', r: 95, pri: 50 }); });
  put(lp.render());
  put(`<text x="${LVIEW[0] + 150}" y="${LVIEW[1] + 180}" font-size="170" font-weight="700" fill="#222">P33 — LED-betápok: kezdőpont + süllyesztett doboz</text>` +
    `<text x="${LVIEW[0] + 150}" y="${LVIEW[1] + 360}" font-size="105" fill="#666">sárga = LED-futás · narancs négyzet = kezdőpont és a plusz ⌀68 mélydoboz</text>` +
    `<text x="${LVIEW[0] + 150}" y="${LVIEW[1] + 510}" font-size="105" fill="#666">szaggatott = betáp · pöttyözött barna = a régi terv LED-vonala (ellenőrzésre)</text>`);
  const ly = LVIEW[1] + LVIEW[3] - 380;
  put(`<rect x="${LVIEW[0] + 100}" y="${ly - 180}" width="${LVIEW[2] - 200}" height="420" fill="#fff" stroke="#ccc" stroke-width="10"/>`);
  [['LED-futás', '#f2b705', null, 70], ['folytatás', '#f2b705', '70 45', 46], ['betáp iránya', '#e8590c', '40 30', 14], ['régi terv LED-vonala', '#b07d2b', '20 34', 16]].forEach(([n, c, d, w], k) => { const x = LVIEW[0] + 250 + k * 1350;
    put(`<line x1="${x}" y1="${ly}" x2="${x + 380}" y2="${ly}" stroke="${c}" stroke-width="${w}" ${d ? `stroke-dasharray="${d}"` : ''}/><text x="${x + 450}" y="${ly + 35}" font-size="100">${esc(n)}</text>`); });
  put(`<rect x="${LVIEW[0] + 250}" y="${ly + 90}" width="120" height="120" fill="#e8590c"/><text x="${LVIEW[0] + 450}" y="${ly + 185}" font-size="100">LED-betáp kezdőpont: 1 db ⌀68 süllyesztett mélydoboz (SELV), a futás magasságában</text>`);
  sheet.write(file, s, LVIEW, { px: 2400 });
}

function compareSheet(ctx, X, file) {
  const { G, E } = ctx, { OP } = X, lp = labels.create({ bounds: PLAN_BOUNDS });
  let s = sheet.base(G, { lp }); const put = t => s += t;
  E.filter(e => e.onWall || e.role === 'sys:MAINS' || e.role === 'sys:DATA').forEach(e => { put(`<circle cx="${e.x}" cy="${e.y}" r="30" fill="#c9c2b4"/>`); });
  // notes written outside the building on the old sheet are pulled inside the outer walls
  const xs = G.walls.flatMap(w => [w.x0, w.x1]), ys = G.walls.flatMap(w => [w.y0, w.y1]), X0 = Math.min(...xs) + 450, X1 = Math.max(...xs) - 450, Y0 = Math.min(...ys) + 450, Y1 = Math.max(...ys) - 450;
  OP.ITEMS.forEach(it => { it.x = Math.max(X0, Math.min(X1, it.x)); it.y = Math.max(Y0, Math.min(Y1, it.y)); });
  OP.ITEMS.forEach(it => { const [, c] = ST[it.st]; put(`<circle cx="${it.x}" cy="${it.y}" r="58" fill="${c}" stroke="#fff" stroke-width="14"/>`); lp.block(it.x, it.y, 130, 130);
    if (it.answered) { put(`<circle cx="${it.x}" cy="${it.y}" r="84" fill="none" stroke="#222" stroke-width="12"/>`); lp.block(it.x, it.y, 190, 190); } });
  OP.ITEMS.forEach(it => { const [, c] = ST[it.st], big = it.st !== 'ok' && it.st !== 'moved';
    lp.add({ x: it.x, y: it.y, text: String(it.n), size: big ? 86 : 72, badge: c, r: 70, pri: big ? 40 : 20 }); });
  put(lp.render());
  title(put, 'P33 — Összevetés a korábbi tervvel', 'minden jel a régi tervről, a mostani terv helyén · a szám = a sor az ADATRETEG.md 1. táblázatában · szürke pötty = a mostani terv pontja' +
    (OP.ITEMS.some(it => it.answered) ? ' · gyűrű = az 1. kör válasza döntötte el' : ''));
  const y = 9550; put(`<rect x="500" y="${y - 250}" width="9900" height="420" fill="#fff" stroke="#ccc" stroke-width="10"/>`);
  Object.entries(ST).forEach(([k, [n, c, sym]], i) => { const x = 650 + i * 1620; put(`<rect x="${x}" y="${y - 90}" width="220" height="130" rx="40" fill="${c}"/><text x="${x + 110}" y="${y - 25}" font-size="95" fill="#fff" text-anchor="middle" dominant-baseline="central">${sym}</text><text x="${x + 270}" y="${y + 5}" font-size="100">${esc(n)}</text>`); });
  sheet.write(file, s, VIEW, { px: 3000 });
}

// ---- the report ----------------------------------------------------------------------------------------------------
function report(ctx, X, file) {
  const { DA, alt, LE, OP } = X, { E, cfg } = ctx, out = [], P = t => out.push(t);
  const nm = id => { const e = E.find(x => x.id === id); return e ? `${e.ref || e.id} (${e.id})` : id; };
  P(`# P33 — Adat/PoE réteg, LED-betápok, összevetés a korábbi tervvel\n`);
  P(`Forrás: \`${path.basename(ctx.inFile)}\` + az erősáramú alapréteg (ALAPRETEG.md) · generálva: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} · motor: \`Planner/projects/varler-planner/tools/baseline/\` (data.js, led.js, emit-data.js)\n`);
  const A = cfg.adatAnswers;
  P(`Lapok: \`osszevetes.png\` (régi terv ↔ mostani), \`led-betap.png\` (LED-kezdőpontok), \`adat-halozat.png\` (Adat/PoE). Kérdések: ${A ? '`ADATRETEG-Q-002.json` (2. kör — csak ami nyitva maradt); az 1. kör válaszai a 0. fejezetben' : '`ADATRETEG-Q-001.json`'} (BRIDGE Tuner). Planner-fájl: \`*_adatreteg.vplan.json\` = az alapréteg + az adatréteg + a LED-dobozok.\n`);
  // 0. the answers of round 1, with the question and the chosen option (read back from the pack the user answered)
  if (A) { const f = path.join(ctx.outDir, 'ADATRETEG-Q-001.json'), Q1 = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
    const qs = Q1 ? Q1.sections.flatMap(s => s.questions) : [];
    P(`## 0. Az 1. kör válaszai (ADATRETEG-Q-001 r1)\n`);
    P(`| Kérdés | Válasz | Megjegyzés |\n|---|---|---|`);
    Object.entries(A).forEach(([id, v]) => { const [k, note] = String(v).split(/\s*~\s*/), q = qs.find(x => x.id === id), o = q && q.opts.find(x => x.k === k);
      P(`| **${id}** ${q ? esc(q.q) : ''} | ${k}${o ? ' — ' + esc(o.t) : ''} | ${esc(note || '')} |`); });
    P('');
    const ch = changes(ctx, X); if (ch.length) { P(`Ami ebből a körből változott:\n`); ch.forEach(t => P(`- ${t}`)); P(''); } }
  // 1. old plan
  if (OP) {
    const cnt = {}; OP.ITEMS.forEach(it => cnt[it.st] = (cnt[it.st] || 0) + 1);
    P(`## 1. Összevetés a korábbi tervvel\n`);
    P(`Forrás: ${OP.SOURCE}. ${OP.ITEMS.length} jel és felirat, mindegyik a mostani terv helyére vetítve (a régi lap pixelei → mm, 180°-kal elforgatva; 70+ ponton ellenőrizve, a legtöbb 100 mm-en belül).\n`);
    P(Object.entries(ST).map(([k, [n, , sym]]) => `${sym} ${n}: **${cnt[k] || 0}**`).join(' · ') + '\n');
    P(`### 1.1 Ami hiányzik vagy tisztázandó\n`);
    P(`| # | Helyiség | Régi terv | Most | Állapot | Mi kell |\n|---|---|---|---|---|---|`);
    OP.ITEMS.filter(it => !['ok', 'moved', 'gone'].includes(it.st)).forEach(it => P(`| ${it.n} | ${it.room} | ${esc(it.what)} | ${esc(it.now)} | ${ST[it.st][2]} ${ST[it.st][0]} | ${esc(it.note)} |`));
    P(`\n### 1.2 Teljes lista\n`);
    P(`| # | Helyiség | Régi terv | Most | Állapot | Megjegyzés |\n|---|---|---|---|---|---|`);
    OP.ITEMS.forEach(it => P(`| ${it.n} | ${it.room} | ${esc(it.what)} | ${esc(it.now)} | ${ST[it.st][2]}${it.answered ? ' (válasz)' : ''} | ${esc(it.note)} |`));
    P('');
  }
  // 2. LED
  P(`## 2. LED-betápok — kezdőpont + egy plusz süllyesztett doboz futásonként\n`);
  P(`Minden LED-futás a falszakasza betáphoz közelebbi végén kezdődik (100 mm-rel beljebb, hogy a doboz ne a sarokba essen). Ott egy **⌀68 süllyesztett mélydoboz** fogadja a SELV betápot (24 V); a LED-tápegység a munkafényeknél a szekrényben, a többinél az RBX-ben van. A dobozok a Planner-fájlban a Törpefeszültség (A busz) rétegen vannak, \`LB…\` jellel.\n`);
  P(`| LED | Futás | Falszakasz | Hossz | Magasság | Kezdőpont (x, y) | Doboz | Betáp | Forrás a tervben |\n|---|---|---|---|---|---|---|---|---|`);
  LE.runs.forEach(r => P(`| **${r.id}** | ${esc(r.name)} | ${r.face.wall}, ${r.face.room} felőli oldal, ${Math.round(r.lo)}–${Math.round(r.hi)} | ${m1(r.len)} m${r.cont ? ` + ~${m1(r.cont.len)} m folytatás` : ''} | ${r.h} | ${Math.round(r.start.x)}, ${Math.round(r.start.y)} | ${r.box.id} ⌀68 | ${esc(r.srcDev ? hwName(r.srcDev) + (r.srcDev.code ? ' (' + r.srcDev.code + ')' : '') : r.srcTxt)} | ${esc([r.old, r.fix].filter(Boolean).join(' · '))} |`));
  P('');
  LE.runs.filter(r => r.cont).forEach(r => P(`- **${r.id} folytatólagos:** a szalag továbbmegy ${esc(r.cont.txt)}, kb. **${m1(r.cont.len)} m** (alaprajzi vetületben; a lépcső emelkedésével valamivel több). ${esc(r.cont.why || '')}: nincs saját kezdőpontja; ebben a körben csak jelölve, a hossza nincs az anyaglistában.`));
  LE.warn.forEach(w => P(`- ⚑ **${w.msg}**`)); P('');
  // 3. data
  const C = DA.C, T = totals(DA), TA = totals(alt);
  P(`## 3. Adat/PoE réteg\n`);
  P(`Szabályok (mind kérdés az ADATRETEG-Q-001-ben):\n`);
  P(`- **Topológia: ${C.topology === 'rbx' ? 'végpont → legközelebbi RBX (silver rail), RBX → BASE' : 'csillag a BASE-ből'}.** Minden adatport saját Cat6A kábel, toldás nélkül. Az RBX-ben kis PoE switch, az RBX-ek ${C.rbxLinks}× Cat6A-val a BASE-hez kötve; a BASE a lakás adatközpontja (patch panel + PoE switch).`);
  P(`- **Ugyanazok a falak**, mint az alaprétegben (a vázlat jelölt falai); falon át csak szervizponton, portálnál a zsanéroldali fészekben (H0, 2450, SELV) — erősáramú dobozba adatkábel nem megy.`);
  P(`- **Saját sáv: ${C.h} mm**, a gerinc (2600) és a leágazó (2450) fölött. Árnyékolt Cat6A külön csőben: az EN 50174-2 szerint nem kell további távolság az erősáramtól; a csövek széle így is ~65 mm-re van.`);
  P(`- Egy cső legfeljebb ${C.perPipe} Cat6A (M32), egy kábel legalább ${C.minCond} (hajlítási sugár ⚑). Doboz ott, ahol a cső elágazik, és húzódoboz ${C.maxBends} falsarok után (EN 50174-2 / TIA-569: legfeljebb két 90°-os ív húzópontok között; a fel- és leívek nagy sugarú ívek ⚑)${C.maxBendsOk ? ` — a felhasználó szerint ${C.maxBendsOk} sarok is elfogadható (D08), ha egy húzódoboz csak emiatt kellene` : ''}.`);
  if ((C.isp || []).filter(Boolean).length > 1) P(`- Szolgáltatói bekötés: ${C.isp.length} üres ${C.ispCond} cső + behúzószál a belépési ponttól a BASE-ig (${C.isp.join(' + ')}; D09).`);
  P(`- Mennyezeti AP: a helyiség legolcsóbb pontjáról fel a mennyezetbe és át, mint az alapréteg mennyezeti lámpái.\n`);
  P(`### 3.1 Végpontok\n`);
  P(`| Pont | Helyiség | Fajta | Port | Honnan | Út (m) |\n|---|---|---|---|---|---|`);
  const sinkName = id => { const sk = DA.sinks.find(x => x.id === id); return sk ? (sk.e ? `${sk.label} (${sk.id})` : sk.label) : id; };
  DA.sinks.forEach(sk => { const len = DA.legs.filter(l => l.cables.some(c => c.to === sk.id)).reduce((a, l) => a + l.len, 0);
    P(`| ${sk.e ? nm(sk.e.id) : sk.label} | ${sk.e ? sk.e.room : '—'} | ${sk.e ? (PORT_HU[sk.e.code] || sk.e.code) : sk.kind === 'rbx' ? 'RBX uplink' : 'szolgáltatói bekötés'} | ${sk.kind === 'isp' ? (sk.n > 1 ? sk.n + '× ' : '') + 'üres cső' + ((C.isp || []).filter(Boolean).length ? ' (' + C.isp.join(' + ') + ')' : '') : sk.n + '× Cat6A'} | ${sk.src ? (sk.src.type === 'base' ? 'BASE' : hwName(sk.src)) : '—'} | ${m1(len)} |`); });
  P(`\n### 3.2 Csőszakaszok\n`);
  P(`| Szakasz | Fajta | Honnan → hová | Hossz m | Ív | Kábelek | Védőcső |\n|---|---|---|---|---|---|---|`);
  DA.legs.forEach(l => P(`| ${l.id} | ${DKIND_HU[l.kind]} | ${l.from} → ${l.to} | ${m1(l.len)} | ${l.bends} | ${l.cables.map(c => `${c.n}× ${c.c === 'CAT6A' ? 'Cat6A' : 'üres'} → ${sinkName(c.to)}`).join(' + ')} | **${l.cond}** |`));
  P(`\n### 3.3 Dobozok\n`);
  P(`| Doboz | Fajta | Helyiség | Hely (x, y, h) |\n|---|---|---|---|`);
  DA.boxes.forEach(b => P(`| ${b.id} | ${DBOX_HU[b.kind]}${b.size === 'tee-L' ? ' — 150 × 150' : ''} | ${b.room} | ${Math.round(b.x)}, ${Math.round(b.y)}, ${b.h} |`));
  P(`\n### 3.4 A két topológia számokkal\n`);
  P(`| | ${C.topology === 'rbx' ? 'RBX-be (rajzolt)' : 'Csillag (rajzolt)'} | ${alt.C.topology === 'rbx' ? 'RBX-be' : 'Csillag a BASE-ből'} |\n|---|---|---|`);
  P(`| Cat6A (m, +10 %) | ${T.cat} | ${TA.cat} |`); P(`| Védőcső összesen (m) | ${T.condAll} | ${TA.condAll} |`);
  P(`| Csőszakaszok | ${DA.legs.length} | ${alt.legs.length} |`); P(`| Elágazó / húzódoboz | ${DA.boxes.filter(b => b.kind === 'tee' || b.kind === 'pull').length} | ${alt.boxes.filter(b => b.kind === 'tee' || b.kind === 'pull').length} |`);
  P(`| Aktív eszköz | PoE switch a BASE-ben + kis PoE switch minden RBX-ben | egy PoE switch a BASE-ben |\n`);
  if (DA.legs.some(l => l.over) && X.DA0) {
    P(`### 3.5 Mennyezeti átvezetés a lépcsőnyílás fölött (D07)\n`);
    P(`Az étkező falvonala a lépcső nyílásánál (x 3330–3940) megszakad. Most az adat és az erősáramú gerinc is a födémben megy át: fel a mennyezetig, ${(cfg.ceilLinks || []).map(cl => m1(Math.abs(cl.a[0] - cl.b[0]) + Math.abs(cl.a[1] - cl.b[1]))).join(' + ')} m át, és vissza; mindkét végén húzódoboz (a nyugati vége a W21-en, a lépcsőláb dobozától 200 mm-re). A leágazó nem használja. Az uplinkek a kerülővel és az átvezetéssel:\n`);
    const upl = (D, id) => D.legs.filter(l => l.cables.some(c => c.to === id)).reduce((a, l) => a + l.len, 0);
    P(`| Uplink | Kerülővel (konyha) m | Átvezetéssel m |\n|---|---|---|`);
    DA.sinks.filter(sk => sk.kind === 'rbx').forEach(sk => P(`| ${sk.label} → BASE | ${m1(upl(X.DA0, sk.id))} | **${m1(upl(DA, sk.id))}** |`));
    const T0 = totals(X.DA0); P(`| Cat6A összesen (m, +10 %) | ${T0.cat} | **${T.cat}** |`); P(`| Védőcső összesen (m) | ${T0.condAll} | **${T.condAll}** |\n`);
  } else {
    P(`### 3.5 Megjegyzés: a lépcsőnyílás megszakítja a falvonalat\n`);
    P(`A BASE (étkező) és az RBXM / RBX06 között nincs összefüggő jelölt fal: az étkező déli falvonala a lépcső nyílásánál (x 3330–3965) megszakad. Ezért az uplinkek — és az alapréteg gerince is — a konyha külső falain és az RBX03-on át kerülnek. Egy 0,6 m-es mennyezeti átvezetés a lépcsőnyílás fölött ezt lerövidítené (kérdés: D07).\n`); }
  if (DA.warn.length) { P(`### 3.6 Figyelmeztetések\n`); DA.warn.forEach(w => P(`- **${w.sev}** — ${esc(w.msg)}`)); P(''); }
  P(`## 4. Anyaglista (tájékoztató — kábel: nyomvonal + 10 %; cső: nyomvonalhossz)\n`);
  P(`| Védőcső | m |\n|---|---|`); Object.keys(T.cond).sort((a, b) => RU.CONDUITS.findIndex(c => c.k === a) - RU.CONDUITS.findIndex(c => c.k === b)).forEach(k => P(`| ${k} | ${m1(T.cond[k])} |`));
  P(`\n| Kábel | m |\n|---|---|`); Object.keys(T.cab).filter(k => k !== 'SPARE').forEach(k => P(`| ${cabN(k)} | ${m1(T.cab[k])} |`));
  P(`\n| Doboz | db |\n|---|---|`); Object.entries(T.box).forEach(([k, n]) => P(`| ${k} | ${n} |`));
  P(`| Adat-végpontdoboz (aljzat, kamera, AP) | ${DA.EP.length} |`); P(`| LED-betáp doboz ⌀68 mély | ${LE.runs.length} |`);
  P(`\n## 5. ${A ? 'Az előző kör javítása' : 'Javítás'} az alaprétegben\n`);
  P(`A sarokfelismerés eddig minden falelem-csatlakozást sarkának vett, akkor is, ha a fal egyenesen folytatódott (két fal egy vonalban, vagy 36 mm-es falvastagság-ugrás). Most csak a valódi irányváltás sarok. Hatás az alaprétegben: **26 sarokdoboz a 40 helyett, 2 gerinc-húzódoboz a 4 helyett**, a kábel- és csőhosszak nem változtak (ALAPRETEG.md).\n`);
  fs.writeFileSync(file, out.join('\n'));
}

// ---- Tuner pack ----------------------------------------------------------------------------------------------------
function pack(ctx, X) {
  const { DA, alt, LE, OP } = X, T = totals(DA), TA = totals(alt), S = [];
  const q = (id, text, why, rec, opts) => ({ id, q: text, why, rec, opts: opts.map(([k, t, d]) => ({ k, t, d: d || '' })) });
  S.push({ id: 'D', title: 'Adat/PoE réteg', note: 'A rajzolt változat a javasolt (A) válaszokkal készült. Lásd adat-halozat.png és ADATRETEG.md 3.', questions: [
    q('D01', 'Topológia: a végpontok a legközelebbi RBX-be, vagy minden a BASE-be?', `RBX-be: ${T.cat} m Cat6A, ${T.condAll} m cső, PoE switch az RBX-ekben. Csillag: ${TA.cat} m Cat6A, ${TA.condAll} m cső, egy switch a BASE-ben.`, 'A',
      [['A', 'Legközelebbi RBX (silver rail), RBX → BASE 2× Cat6A', 'A BRIDGE elve: a végpont az RBX-é; kevesebb cső a hosszú utakon.'], ['B', 'Csillag: minden port a BASE-be', 'Egyszerűbb aktív eszközpark, több kábel.'], ['X', 'Másképp', '']]),
    q('D02', `Hol fussanak az adatcsövek?`, 'A WORKSHOP-001 válasza (M01) a SELV/adat utakat a padlóba tette; ez a kör a felhasználó kérésére az alapréteg falain fut.', 'A',
      [['A', `Falon, saját sávban ${DA.C.h} mm-en`, 'A gerinc (2600) fölött; az alapréteg dobozaival nem keveredik.'], ['B', 'Padlóban (esztrichben)', 'Csak ha a padló úgyis bontásra kerül.'], ['C', 'Mennyezetben', 'Álmennyezet vagy mennyezeti horony kell.'], ['X', 'Másképp', '']]),
    q('D03', 'RBX uplink: hány kábel menjen a BASE-ből minden RBX-be?', 'Most 2× Cat6A (adat + tartalék / második switch-port).', 'A',
      [['A', '2× Cat6A', ''], ['B', '1× Cat6A + üres cső', 'Később húzható bele optika.'], ['C', '2× Cat6A + üres M25', ''], ['X', 'Másképp', '']]),
    q('D04', 'Kábeltípus', 'Cat6A U/FTP LSZH, külső átmérő ~7,5 mm (⚑ a gyártótól függ).', 'A',
      [['A', 'Cat6A U/FTP', '10 Gbit, PoE++-hoz is jó hőtűrés.'], ['B', 'Cat6 U/UTP', 'Olcsóbb, vékonyabb; erősáram mellett nagyobb távolság kell.'], ['X', 'Másképp', '']]),
    q('D05', 'TV-pontok (ETH1 nappali, ETH1 szoba): mi menjen oda?', 'Most 2× Cat6A pontonként (IPTV + internet).', 'A',
      [['A', '2× Cat6A', ''], ['B', '2× Cat6A + koax (antenna / műhold)', 'Plusz egy koax a BASE-ből vagy a tetőről.'], ['C', '1× Cat6A', ''], ['X', 'Másképp', '']]),
    q('D06', 'USB1 (nappali médiafal): hogyan kapjon tápot?', 'Most az adatrétegen: PoE → USB-C PD fali aljzat, 1× Cat6A az RBX06-ból.', 'A',
      [['A', 'PoE → USB-C PD aljzat (adatréteg)', 'Nincs 230 V a doboz mögött.'], ['B', '230 V-os USB-s dugalj (erősáram)', 'Az A4 körre.'], ['C', 'SELV az RBX06-ból', ''], ['X', 'Másképp', '']]),
    q('D07', 'A lépcsőnyílás megszakítja az étkező falvonalát: maradjon a konyhai kerülő?', 'Az uplinkek és az erősáramú gerinc is a konyha külső falain át kerül, mert x 3330–3965 között nincs fal. Egy 0,6 m-es mennyezeti átvezetés a nyílás fölött több métert spórol.', 'B',
      [['A', 'Marad a kerülő', ''], ['B', 'Mennyezeti átvezetés a lépcsőnyílás fölött (adat és gerinc is)', 'Rövidebb utak; a motor újraszámol.'], ['C', 'Padlón át (mint a lépcsőláb-átvezetés)', ''], ['X', 'Másképp', '']]),
    q('D08', 'Húzódoboz: hány falsarok legyen két húzópont között?', `Most ${DA.C.maxBends} (szabványos Cat6A-hoz). Ebből ${DA.boxes.filter(b => b.kind === 'pull').length} húzódoboz lett.`, 'A',
      [['A', `${DA.C.maxBends} sarok`, ''], ['B', '3 sarok', 'Kevesebb doboz, nehezebb behúzás.'], ['X', 'Másképp', '']]),
    q('D09', 'Szolgáltatói bekötés (ISP → BASE)', 'Most egy üres M32 + behúzószál a belépési ponttól a BASE-ig.', 'A',
      [['A', 'Egy üres M32', ''], ['B', 'Két üres cső (optika + koax)', ''], ['C', 'M40', ''], ['X', 'Másképp', '']])
  ] });
  S.push({ id: 'L', title: 'LED-betápok', note: 'Lásd led-betap.png és ADATRETEG.md 2. Minden futás egy kezdőpontot és egy plusz ⌀68 dobozt kapott.', questions: [
    ...LE.runs.map((r, k) => q('L' + String(k + 1).padStart(2, '0'), `${r.id} — ${r.name}: jó a kezdőpont (${r.box.id}, ${r.h} mm)?`, `${r.face.wall} fal, ${Math.round(r.lo)}–${Math.round(r.hi)} (${m1(r.len)} m); kezdőpont: ${Math.round(r.start.x)}, ${Math.round(r.start.y)}. ${r.old || ''}`, 'A',
      [['A', 'Igen, itt', ''], ['B', 'A futás másik végén', ''], ['C', 'Középen', 'Két irányba indul a szalag.'], ['X', 'Másképp', 'Megjegyzésbe.']])),
    q('L06', 'LED3 a fürdő új falában ütközik az RBX03-mal: mi legyen?', 'A bemarás (2100) és az RBX03 (2150) ugyanazon a 200 mm-es falszakaszon, két oldalon.', 'A',
      [['A', 'A LED-bemarás feljebb: 2400', 'Az RBX doboz fölött.'], ['B', 'A LED csak az RBX mellett fut (két rész)', ''], ['C', 'Az RBX03 kerül arrébb', 'Az alapréteg újraszámol.'], ['X', 'Másképp', '']]),
    q('L07', 'Lépcső: a régi terv szerint a LED-sor a fordulóban a külső falon, a kamra fölött is folytatódik. Kell?', 'A vázlatban csak a WC-fal menti rész van (LED5).', 'A',
      [['A', 'Igen, második futás a külső falon (saját kezdőponttal)', ''], ['B', 'Nem, csak a WC-fal mentén', ''], ['X', 'Másképp', '']]),
    q('L08', 'Konyha: a régi terven a LED a bontandó fal mentén (a sziget mögött) folytatódik. Kell LED a szigeten?', 'A fal megszűnik; a helyén a sziget hátoldala.', 'B',
      [['A', 'Igen, a sziget pultja alatt (lábazati / túlnyúlás alatti fény)', ''], ['B', 'Nem kell', ''], ['X', 'Másképp', '']])
  ] });
  if (OP) S.push({ id: 'R', title: 'A korábbi terv nyitott pontjai', note: 'Lásd osszevetes.png és ADATRETEG.md 1.1 — a szám a sor száma.', questions: OP.ITEMS.filter(it => it.st === 'ask' || it.st === 'part').filter(it => !/LED|redőnyök vezérlő|fali lámpa a zuhanyfalon/.test(it.what))
    .map((it, k) => q('R' + String(k + 1).padStart(2, '0'), `#${it.n} ${it.room}: ${it.what} — ${it.note}`, `Most: ${it.now}.`, 'A', optsFor(it))) });
  return { pack: 'P33ADATQ001', title: 'P33 — Adat/PoE réteg, LED-betápok, korábbi terv', rev: 'r1', date: new Date().toISOString().slice(0, 10), sections: S };
}
// round 2: only the details the answers left open (⚑ in this round's edits, new clashes, new warnings)
function packOpen(ctx, X) {
  const { cfg, E, R } = ctx, Q = [], ok = k => (cfg.approved || []).includes(k), ids = cfg._ids || {};
  const q = (text, why, rec, opts) => Q.push({ id: 'N' + String(Q.length + 1).padStart(2, '0'), q: text, why, rec, opts: opts.map(([k, t, d]) => ({ k, t, d: d || '' })) });
  const ref = id => (E.find(e => e.id === id) || {}).ref || id;
  // R01: how the wardrobe lamp is switched (drawn: an RBXM output)
  const lg = Object.keys(cfg.rbxSwitched || {}).find(id => /^R01/.test(cfg.rbxSwitched[id]));
  if (lg && !ok('gardrob')) q(`${ref(lg)} gardrób-lámpa: hogyan kapcsoljuk?`, 'R01=A (lámpa + dugalj). A rajzon az RBXM-ből kapcsolt (mint az EV1), fali kapcsoló nélkül; a dugalj (D38) a W12-n, 300 mm-en, az A14 körön.', 'A',
    [['A', 'RBXM-kimenet, mozgásérzékelővel / ajtókontaktussal', 'A SENSOR réteg adja a jelet; nincs kapcsoló.'], ['B', 'Saját kapcsoló a gardrób bejáratánál (1100)', 'A megjegyzésbe: melyik falon, a ferde fal melyik végén.'],
      ['C', 'Az L24 csoporttal együtt (K4 + K14b váltó)', 'A szoba fő fényével kapcsol.'], ['X', 'Másképp', '']]);
  // R07: the second oven-tower connection
  const a15 = R.C.list.find(c => c.ref === 'A15');
  if (a15 && !ok('tower')) q(`Sütőtorony: két csatlakozás — ${a15.members.map(e => e.ref).join(', ')} az új ${a15.ref} körön (dedikált, ${a15.mcb}), 2000 mm-en a felső készülék fölött. Jó így?`, 'R07=A: két csatlakozás. A kérdés nyitva hagyta, hogy két kör vagy egy kör két dugaljjal; a rajzon két dedikált kör (A9 + A15).', 'A',
    [['A', 'Két dedikált kör, a 2. csatlakozó 2000-en', ''], ['B', 'Két dedikált kör, mindkét csatlakozó lent (300)', 'A torony alsó szekrényében egymás mellett.'], ['C', 'Egy kör (A9), két csatlakozó', 'Ha a gyártói adatok szerint a két készülék együtt elfér 16 A-en.'], ['X', 'Másképp', '']]);
  // R10: the downdraft hood's connection
  const dd = (cfg.edits || []).find(ed => ed.move && /R10/.test(ed.note || ''));
  if (dd && !ok('downdraft')) { const e = E.find(x => x.id === dd.move), c = R.C.byMember[dd.move];
    q(`${ref(dd.move)} pultba süllyesztett elszívó: csatlakozás a szigetszekrényben ${Math.round(e.h)} mm-en, ${c ? az(c.ref) + ' ' + c.ref : '?'} körön — jó?`, `R10=B (downdraft). A D12 lett a csatlakozása (R09: a jegyzetek fel voltak cserélve); ${c ? az(c.ref) + ' ' + c.ref + ' (' + esc(c.name) + ')' : ''} körön maradt.`, 'A',
      [['A', `Igen: ${Math.round(e.h)} mm, ${c ? c.ref : ''} kör`, ''], ['B', 'Saját dedikált kör', 'Ha a gyártó külön kört kér.'], ['C', 'A főzőlap csatlakozójáról (kombinált főzőlap + elszívó)', 'Nincs külön pont; a D12 visszakerül pultdugaljnak.'], ['X', 'Másképp', '']]); }
  // R04: the upper shutter motor's height
  const sh = (cfg.edits || []).find(ed => ed.add && /^R04/.test(ed.note || ''));
  if (sh && !ok('shu2')) { const id = ids['N:' + sh.add], sw = E.find(e => e.shutterFor === id);
    q(`${sh.ref} (nappali felső redőny) motorja ${sh.hFix} mm-en, a kapcsolója (${sw ? sw.ref : 'R-SHU2'}) az R-SHU1 mellett, kettes keretben — jó?`, 'R04=A: második motor + kapcsoló. A légtér magasságát (4,5 m) a terv nem adja meg pontosan; a motor 4300-on a felső redőnyszekrény mellett ⚑.', 'A',
      [['A', `${sh.hFix} mm, kettes keret az R-SHU1-gyel`, ''], ['B', 'Más magasság', 'A megjegyzésbe: a felső redőnyszekrény magassága.'], ['C', 'A kapcsoló külön dobozban', ''], ['X', 'Másképp', '']]); }
  // a LED groove right under a distribution pipe
  X.LE.runs.filter(r => r.nearDist && !ok('led:' + r.id)).forEach(r => q(`${r.id} (${r.h} mm): közvetlenül fölötte fut a ${r.nearDist.h}-es leágazó (${r.nearDist.legs.join(', ')}) — a két horony között ~${r.nearDist.gap} mm. Jó így?`,
    `${r.fix || ''}. A ${r.face.wall} fal ${r.face.room} felőli oldalán a leágazó ${r.nearDist.h}-en fut az RBX03-tól. Pontosítás az L06-hoz: az RB-M 400 × 500 × 110 (STD-001), dobozközép 2150 → 1900–2400, a fal másik oldalán. Mélységben a 200 mm-es falban a 110 mm-es doboz és a ~15 mm-es LED-horony a régi 2100-on is elfért volna — az ütközés-jelzés túlzó volt.`, 'A',
    [['A', `Marad ${r.h}, a két horony külön`, 'A kőműves ~' + r.nearDist.gap + ' mm-t hagy közöttük.'], ['B', 'Vissza 2100-ra (a régi terv szerint)', 'A doboz mögött, a fal túloldalán; mélységben elfér, a leágazótól 350 mm.'], ['X', 'Másképp', '']]));
  // whatever the layers still warn about
  [...X.DA.warn, ...R.warn].filter(w => w.sev !== 'info').forEach(w => q(w.msg + ' — mi legyen?', 'Új figyelmeztetés a válaszok beépítése után.', 'A',
    [['A', 'Jóváhagyom', ''], ['B', 'Másképp', 'Megjegyzésbe.']]));
  return { pack: 'P33ADATQ002', title: 'P33 — Adat/PoE, LED, korábbi terv: 2. kör (nyitott pontok)', rev: 'r1', date: new Date().toISOString().slice(0, 10),
    sections: [{ id: 'N', title: 'Nyitott pontok az 1. kör után', note: 'Az 1. kör (ADATRETEG-Q-001) válaszai beépültek — lásd ADATRETEG.md 0. fejezet. Ezek maradtak.', questions: Q }] };
}
function optsFor(it) {
  const w = it.what;
  if (/redőny \(alsó/.test(w)) return [['A', 'Második motor + kapcsoló a felső redőnyhöz', 'A légtér magasságában, saját doboz.'], ['B', 'Egy motor mozgatja mindkettőt', ''], ['C', 'Nincs felső redőny', ''], ['X', 'Másképp', '']];
  if (/redőnyház/.test(w)) return [['A', 'Nem kell', ''], ['B', 'Igen: redőny a bejárati ajtó fölött — motor + kapcsoló', ''], ['X', 'Másképp', '']];
  if (/radiátor/.test(w)) return [['A', 'Vizes radiátor — nincs villamos teendő', ''], ['B', 'Elektromos — dedikált kör', ''], ['X', 'Másképp', '']];
  if (/többszörözni/.test(w)) return [['A', 'Két csatlakozás a toronyban (sütő + mikró / gőzpároló)', 'Két dedikált kör, vagy egy kör két dugaljjal a gyártói adat szerint.'], ['B', 'Egy elég', ''], ['X', 'Másképp', '']];
  if (/pult dugalj/.test(w)) return [['A', 'Kell a negyedik pultdugalj (~2190-nél)', ''], ['B', 'A három elég', ''], ['X', 'Másképp', '']];
  if (/főzőlap \+ elszívó/.test(w)) return [['A', 'Mennyezeti elszívó: csatlakozás a mennyezeten a főzőlap fölött', 'Saját doboz 2850-en.'], ['B', 'Pultba süllyesztett (downdraft) — csatlakozás a szigetszekrényben', ''], ['X', 'Másképp', '']];
  if (/pultba épített/.test(w)) return [['A', 'Igen, fel vannak cserélve: D13 = pultba épített dugalj, D12 = a főzőlap melletti pont', ''], ['B', 'Nem, jól vannak', ''], ['X', 'Másképp', '']];
  if (/fali lámpa \(jobb\)/.test(w)) return [['A', 'L16 fali lámpa 1800-on, mint az L15', ''], ['B', 'Marad 300-on (kapcsolt dugalj állólámpának)', ''], ['X', 'Másképp', '']];
  if (/régi ajtó nappali/.test(w)) return [['A', 'Igen, egy dugaljpár a B171 mellé (nappali oldal)', ''], ['B', 'Nem kell', ''], ['X', 'Másképp', '']];
  if (/GARDRÓB/.test(w)) return [['A', 'Lámpa + dugalj', ''], ['B', 'Csak lámpa (ajtókapcsolóval / érzékelővel)', ''], ['C', 'Semmi', ''], ['X', 'Másképp', '']];
  if (/melegvíz/.test(w)) return [['A', 'A meleg víz a vízhálózatból jön — nincs villamos teendő', ''], ['B', 'Kis villanybojler / átfolyós — dedikált kör', ''], ['X', 'Másképp', '']];
  if (/LED|bemarás/.test(w)) return [['A', 'Ahogy a LED-kérdések döntik', ''], ['X', 'Másképp', '']];
  return [['A', 'Nincs teendő', ''], ['X', 'Megjegyzésbe írom', '']];
}

// ---- the .vplan: the baseline file + data conduits and boxes (Adat/PoE layer) + LED boxes (A busz layer) -------------
function vplan(ctx, X, inFile, file) {
  const { DA, LE } = X, cfg = ctx.cfg, out = JSON.parse(fs.readFileSync(inFile, 'utf8')), P = out.project, D = P.data;
  const lid = role => (P.layers.find(l => l.role === role) || {}).id, L_DATA = lid('sys:DATA'), L_LV = lid('sys:LV');
  const nid = pre => pre + (++D.seq);
  DA.boxes.filter(b => b.kind === 'tee' || b.kind === 'pull' || b.kind === 'nest').forEach(b => D.devices.push({ type: 'junction', jbShape: 'rect', jbSize: b.size === 'tee-L' ? 150 : b.kind === 'pull' ? 140 : 100,
    level: cfg.level, x: Math.round(b.x), y: Math.round(b.y), h: b.h, layer: L_DATA, id: nid('D'), ref: b.id, note: `${b.n} [${DBOX_HU[b.kind]}]`, faceBack: false }));
  DA.legs.forEach(l => l.pipes.forEach((p, k) => { const nodes = l.poly.map(q => ({ level: cfg.level, x: Math.round(q[0]), y: Math.round(q[1]), h: Math.round(q[2]), id: nid('n') }));
    D.paths.push({ ptype: 'gege', nodes, sections: nodes.slice(1).map(() => ({ build: 'sull_gege', circuit: null, cond: p.cond, fill: p.fill,
      cables: p.cables.map(c => (c.n > 1 ? c.n + '× ' : '') + cabN(c.c)).join(' + '), circuits: [], leg: l.id, kind: l.kind, to: p.to })),
      layer: L_DATA, lane: k, id: nid('P'), route: l.kind === 'dh' ? 'arm' : 'arm', color: l.kind === 'disp' ? ISPCOL : DCOL }); }));
  LE.runs.forEach(r => D.devices.push({ type: 'junction', jbShape: 'round', jbSize: 68, level: cfg.level, x: Math.round(r.start.x), y: Math.round(r.start.y), h: r.h, layer: L_LV || L_DATA, id: nid('D'), ref: r.box.id,
    note: `${r.box.n} — ${r.face.wall} ${Math.round(r.lo)}–${Math.round(r.hi)} (${m1(r.len)} m)${r.cont ? `, folytatólagos ~${m1(r.cont.len)} m (${r.cont.txt})` : ''}, ${r.h} mm; betáp: ${r.srcDev ? hwName(r.srcDev) : r.srcTxt} [LED-betáp ⌀68 mélydoboz]`, faceBack: false }));
  P.layers.forEach(l => { if ([L_DATA, L_LV].includes(l.id)) l.visible = true; });
  out.name = (out.name || 'P33').replace(/ — erősáram alapréteg$/, '') + ' — alapréteg + adat/PoE + LED-betápok'; out.saved = new Date().toISOString();
  fs.writeFileSync(file, JSON.stringify(out));
}

function all(ctx) {
  const X = build(ctx), dir = ctx.outDir, base = path.basename(ctx.inFile).replace(/\.vplan.*$/i, '').replace(/\.json$/i, '');
  ctx.X = X;
  dataSheet(ctx, X, path.join(dir, 'adat-halozat.png'));
  ledSheet(ctx, X, path.join(dir, 'led-betap.png'));
  if (X.OP) compareSheet(ctx, X, path.join(dir, 'osszevetes.png'));
  report(ctx, X, path.join(dir, 'ADATRETEG.md'));
  // round 1 answered → only what stays open goes into round 2; the answered Q-001 file is left as it is
  if (ctx.cfg.adatAnswers) { const open = packOpen(ctx, X), f = path.join(dir, 'ADATRETEG-Q-002.json');
    if (open.sections.some(s => s.questions.length)) fs.writeFileSync(f, JSON.stringify(open, null, 1)); else if (fs.existsSync(f)) fs.unlinkSync(f); }
  else fs.writeFileSync(path.join(dir, 'ADATRETEG-Q-001.json'), JSON.stringify(pack(ctx, X), null, 1));
  vplan(ctx, X, path.join(dir, base + '_alapreteg.vplan.json'), path.join(dir, base + '_adatreteg.vplan.json'));
  return X;
}
module.exports = { all, build, dataSheet, ledSheet, compareSheet, report, pack, packOpen, vplan };
