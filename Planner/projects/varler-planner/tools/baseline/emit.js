// emit.js — sheets (network, circuits, portal template), the approval report, legs.csv and the output .vplan
'use strict';
const fs = require('fs'), path = require('path'), sheet = require('./sheet'), RU = require('./rules'), tpl = require('./template'), labels = require('./labels');
const esc = sheet.esc, VIEW = [300, 1450, 10500, 8550], PLAN_BOUNDS = [300, 1900, 10800, 9230];   // labels stay off the title and the legend
const KCOL = { trunk: '#1f3f8b', dist: '#d1493f', drop: '#d1493f', ceil: '#e08a00', floor: '#8a5a2a', island: '#8a5a2a', feed: '#222' };
const BCOL = { rbx: '#222', sp: '#7a5cc0', drop: '#d1493f', corner: '#2e9e5b', end: '#16a3b8', island: '#8a5a2a', pull: '#1f3f8b' };
const CIRC_COL = ['#d85a30', '#7f77dd', '#d4537e', '#2f79c9', '#b8901f', '#16a3b8', '#8e44ad', '#5d8a1f', '#c0392b', '#1d9e75', '#e6a800', '#444444', '#2e9e5b', '#9c6b30', '#5470b0', '#b0489a', '#607d8b'];
const KIND_HU = { trunk: 'gerinc 2600', dist: 'leágazó 2450', drop: 'leállás', ceil: 'mennyezet', floor: 'padló', island: 'padló-elágazás', feed: 'fővezeték', riser: 'emeleti felállás' };
const MODE_HU = { single: 'egyszerű (101)', double: 'csillár (105)', '2way': 'váltó (106 + 106)', '3way': 'három helyről (106 + 107 + 106)' };
const BOX_HU = { rbx: 'RBX', sp: 'szervizpont-doboz', drop: 'leállás 2×', corner: 'sarok 2×', end: 'pályavég 2×', island: 'sziget', pull: 'gerinc húzódoboz' };
const cabN = c => (RU.CABLES[c] || { n: c }).n;
const line = (poly, c, w, dash, op = .9) => `<polyline points="${poly.map(p => p[0] + ',' + p[1]).join(' ')}" fill="none" stroke="${c}" stroke-width="${w}" ${dash ? `stroke-dasharray="${dash}"` : ''} stroke-opacity="${op}" stroke-linejoin="round" stroke-linecap="round"/>`;

function legend(put, lines, boxes, y = 9550) {
  const x = 600, step = Math.min(1950, 9700 / Math.max(1, lines.length)); put(`<rect x="${x - 100}" y="${y - 250}" width="9900" height="${boxes ? 520 : 300}" fill="#fff" stroke="#ccc" stroke-width="10"/>`);
  lines.forEach(([n, c, d], k) => { const xx = x + k * step; put(`<line x1="${xx}" y1="${y - 30}" x2="${xx + 400}" y2="${y - 30}" stroke="${c}" stroke-width="40" ${d ? `stroke-dasharray="${d}"` : ''}/><text x="${xx + 470}" y="${y}" font-size="110">${esc(n)}</text>`); });
  (boxes || []).forEach(([n, c], k) => { const xx = x + k * 1400; put(`<rect x="${xx}" y="${y + 120}" width="140" height="140" fill="${c}"/><text x="${xx + 200}" y="${y + 230}" font-size="105">${esc(n)}</text>`); });
}
function title(put, t, sub) { put(`<text x="500" y="1640" font-size="190" font-weight="700" fill="#222">${esc(t)}</text><text x="500" y="1820" font-size="120" fill="#666">${esc(sub)}</text>`); }

// points within d mm of each other (and with the same key) form one group — one label for a gang of devices on one spot
function groupAt(list, d = 30, key = () => '') {
  const out = []; list.forEach(e => { const k = key(e), g = out.find(gr => gr.k === k && Math.hypot(gr[0].x - e.x, gr[0].y - e.y) <= d);
    if (g) g.push(e); else { const n = [e]; n.k = k; out.push(n); } }); return out;
}
// the short name of a hardware node: "RBX03 to cover …" → "RBX03"
const hwName = d => String((d && (d.ref || d.id)) || '').split(/ to | - /)[0].trim();
const midOf = poly => { let best = null; for (let k = 1; k < poly.length; k++) { const a = poly[k - 1], b = poly[k], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (!best || L > best.L) best = { L, x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2 }; } return best || { x: poly[0][0], y: poly[0][1], L: 0 }; };

function networkSheet(ctx, file) {
  const { G, R, E } = ctx, lp = labels.create({ bounds: PLAN_BOUNDS });
  let s = sheet.base(G, { lp }); const put = t => s += t;
  // distribution drawn per stretch between boxes, as wide as the pipes running along it (passing ones included)
  (R.spans || []).forEach(sp => { put(line(sp.poly, KCOL.dist, 26 + 12 * Math.min(5, Math.max(0, sp.pipes.length - 1)), sp.soft ? '70 40' : null)); lp.blockLine(sp.poly, 50); });
  // trunk drawn on top, each channel offset so a bundle reads as several wireways
  const chans = [...new Set(R.legs.filter(l => l.kind === 'trunk').map(l => l.sp))];
  R.legs.filter(l => l.kind === 'trunk').forEach(l => { const o = (chans.indexOf(l.sp) - chans.length / 2) * 20, pl = l.poly.map(p => [p[0] + o, p[1] + o]); put(line(pl, KCOL.trunk, 16, null, .8)); lp.blockLine(pl, 40); });
  R.legs.filter(l => l.kind === 'ceil').forEach(l => { put(line(l.poly.slice(-2), KCOL.ceil, 20, '90 60')); lp.blockLine(l.poly.slice(-2), 40); });
  R.legs.filter(l => l.kind === 'floor' || l.kind === 'island' || (l.kind === 'dist' && l.floor)).forEach(l => { const pl = l.poly.filter(p => p[2] === 0 || l.kind !== 'dist'); put(line(pl, KCOL.floor, 24, '40 40')); lp.blockLine(pl, 40); });
  R.legs.filter(l => l.kind === 'riser').forEach(l => { put(`<circle cx="${l.poly[0][0]}" cy="${l.poly[0][1]}" r="130" fill="none" stroke="#1f3f8b" stroke-width="30"/>`); lp.block(l.poly[0][0], l.poly[0][1], 300, 300);
    lp.add({ x: l.poly[0][0], y: l.poly[0][1], text: '↑ emelet', size: 80, color: '#1f3f8b', r: 150, pri: 30 }); });
  R.legs.filter(l => l.kind === 'feed').forEach(l => put(line(l.poly, KCOL.feed, 40)));
  // a ceiling crossing (D07): the hop is drawn wider and named
  R.legs.filter(l => l.kind === 'trunk' && l.over).forEach(l => { put(line(l.poly, KCOL.trunk, 46, '30 24', .9)); const m = midOf(l.poly);
    lp.add({ x: m.x, y: m.y, text: 'mennyezeten át', size: 64, color: KCOL.trunk, weight: 600, r: 60, pri: 35 }); });
  // prepared routes (R12): grey dashes, not counted
  prepDraw(R, put, lp);
  (R.spans || []).filter(sp => sp.len > 600 && sp.cond).forEach(sp => { const m = midOf(sp.poly); lp.add({ x: m.x, y: m.y, text: sp.cond, size: 68, color: '#8a1f1a', r: 40, pri: 10 }); });
  E.filter(e => e.role === 'sys:MAINS').forEach(e => { put(`<circle cx="${e.x}" cy="${e.y}" r="50" fill="#fff" stroke="#d1493f" stroke-width="20"/>`); lp.block(e.x, e.y, 120, 120); });
  // points on one spot (a portal's gang of switches + its sockets) share one label
  groupAt(E.filter(e => e.role === 'sys:MAINS')).forEach(gr => lp.add({ x: gr[0].x, y: gr[0].y, text: [...new Set(gr.map(e => e.ref || e.id))].sort((a, b) => a.localeCompare(b, 'hu', { numeric: true })).join(' · '), size: 66, color: '#7a2a22', r: 65, pri: 20 }));
  R.boxes.forEach(b => { const z = b.kind === 'rbx' ? 150 : b.kind === 'pull' ? 95 : 70; lp.block(b.x, b.y, 2 * z + 20, 2 * z + 20);
    put(`<rect x="${b.x - z}" y="${b.y - z}" width="${2 * z}" height="${2 * z}" fill="${BCOL[b.kind] || '#555'}" fill-opacity=".88" stroke="#fff" stroke-width="12"/>`); });
  R.SP.filter(sp => sp.type !== 'portal').forEach(sp => { const f = sp.faces[0]; if (!f) return; const x = f.face.horiz ? f.u : f.face.fix, y = f.face.horiz ? f.face.fix : f.u;
    lp.add({ x, y, text: (sp.type === 'base' ? '■ BASE' : '■ ' + hwName(sp.dev)), size: 90, weight: 700, color: '#5a3fa0', r: 170, pri: 60 }); });
  put(lp.render());
  title(put, 'P33 — Erősáram alapréteg: pályák és dobozok', 'gerinc 2600, egy fa az Elosztóból (kék) · leágazó 2450 (piros, szaggatott = jelöletlen falon) · mennyezet (narancs) · sziget a padlón (barna)');
  legend(put, [['Gerinc 2600', KCOL.trunk], ['Leágazó 2450', KCOL.dist], ['Jelöletlen falon', KCOL.dist, '70 40'], ['Mennyezet', KCOL.ceil, '90 60'], ['Padló / sziget', KCOL.floor, '40 40']]
    .concat((R.prep || []).length ? [['Előkészítés', PREPCOL, '50 35']] : []), Object.entries(BOX_HU).map(([k, n]) => [n, BCOL[k]]));
  sheet.write(file, s, VIEW, { px: 3000 });
}
// prepared routes: the feed along the faces, the leállás box and the points, all in grey dashes with one tag per item
const PREPCOL = '#8a8a8a';
function prepDraw(R, put, lp) {
  (R.prep || []).forEach(it => {
    it.legs.filter(l => l.kind === 'dist').forEach(l => { put(line(l.poly, PREPCOL, 26, '50 35')); lp.blockLine(l.poly, 50); });
    it.boxes.forEach(b => { put(`<rect x="${b.x - 70}" y="${b.y - 70}" width="140" height="140" fill="#fff" stroke="${PREPCOL}" stroke-width="16" stroke-dasharray="30 20"/>`); lp.block(b.x, b.y, 170, 170);
      lp.add({ x: b.x, y: b.y, text: `${it.id} előkészítés · nem számolt`, size: 64, color: '#555', weight: 600, r: 90, pri: 45 }); }); });
}

function circuitSheet(ctx, file) {
  const { G, R, E } = ctx, lp = labels.create({ bounds: PLAN_BOUNDS });
  let s = sheet.base(G, { lp }); const put = t => s += t;
  const col = {}; R.C.list.forEach((c, k) => col[c.ref] = CIRC_COL[k % CIRC_COL.length]);
  // every pipe drawn in its circuit's colour, offset by its index on the stretch (distribution) or in the leg
  (R.spans || []).forEach(sp => { const ps = [...sp.pipes].sort((a, b) => a.circ[0].localeCompare(b.circ[0], 'hu', { numeric: true }));
    ps.forEach((p, k) => { const o = (k - (ps.length - 1) / 2) * 34; put(line(sp.poly.map(q => [q[0] + o, q[1] + o]), col[p.circ[0]] || '#888', 22)); }); lp.blockLine(sp.poly, 50); });
  R.legs.filter(l => ['ceil', 'floor', 'island'].includes(l.kind)).forEach(l => l.pipes.forEach((p, k) => {
    const o = (k - (l.pipes.length - 1) / 2) * 34, poly = l.kind === 'ceil' ? l.poly.slice(-2) : l.poly;
    put(line(poly.map(q => [q[0] + o, q[1] + o]), col[p.circ[0]] || '#888', 22, l.kind === 'ceil' ? '80 50' : null)); lp.blockLine(poly, l.kind === 'ceil' ? 40 : 50); }));
  E.filter(e => e.role === 'sys:MAINS').forEach(e => { const c = R.C.byMember[e.id]; const k = c ? col[c.ref] : '#999';
    put(`<circle cx="${e.x}" cy="${e.y}" r="70" fill="${k}" stroke="#fff" stroke-width="16"/>`); lp.block(e.x, e.y, 150, 150); });
  // one label per spot and circuit: "K3 · K3b · K3c · V1"
  groupAt(E.filter(e => e.role === 'sys:MAINS'), 30, e => (R.C.byMember[e.id] || {}).ref || '').forEach(gr => { const c = R.C.byMember[gr[0].id], k = c ? col[c.ref] : '#999';
    lp.add({ x: gr[0].x, y: gr[0].y, text: [...new Set(gr.map(e => e.ref || e.id))].sort((a, b) => a.localeCompare(b, 'hu', { numeric: true })).join(' · ') + (c ? ' · ' + c.ref : ''), size: 70, color: k, weight: 600, r: 80, pri: 20 }); });
  put(lp.render());
  title(put, 'P33 — Erősáram áramkörök', 'végpontok és csövek az áramkör színével · egy cső = egy áramkör');
  const items = R.C.list.map(c => [c.ref, col[c.ref]]); let y = 9450;
  items.forEach(([n, c], k) => { const x = 600 + (k % 9) * 1100, yy = y + Math.floor(k / 9) * 230; put(`<rect x="${x}" y="${yy - 110}" width="140" height="140" fill="${c}"/><text x="${x + 190}" y="${yy}" font-size="115">${esc(n)}</text>`); });
  sheet.write(file, s, VIEW, { px: 3000 });
}

// ---- the approval report ---------------------------------------------------------------------------------------------
function report(ctx, file) {
  const { R, E, PT, cfg, G } = ctx, out = [], P = s => out.push(s);
  const nm = id => { const e = E.find(x => x.id === id); return e ? `${e.ref || e.id} (${e.id})` : id; };
  const m = v => (v / 1000).toFixed(1).replace('.', ',');
  P(`# ${cfg.name}\n`);
  P(`Forrás: \`${path.basename(ctx.inFile)}\` · generálva: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} · motor: \`Planner/projects/varler-planner/tools/baseline/\`\n`);
  P(`Szabályok: gerinc **2600** (szervizpont ↔ Elosztó), leágazó **2450** (szervizpont ↔ végpontok), minden leállás 2 szerelvényes süllyesztett dobozzal, sarok- és pályavég-tartalékdobozok, falátvezetés csak szervizponton (portál, RBX, BASE). Csőméretezés: 1 kábel → belső átmérő ≥ 1,4 × kábel-átmérő; több kábel → ≤ 40 % (10 m felett 33 %) — a Planner 05w-fill szabálya. Csövenként legfeljebb ${ctx.cfg.maxCablesPerPipe || 2} kábel; a leágazón egy cső csak egy áramkört visz. Az áthaladó cső a doboz mellett halad el; dobozba csak ott megy, ahol az áramköre betáplál, végpontot táplál, elágazik vagy véget ér, illetve 3-nál több sarok után.
`);
  // 1. jóváhagyandó
  P(`## 1. Jóváhagyásra\n`);
  P(`### 1.1 Lámpa → kapcsoló (következtetés)\n`);
  P(`| Kapcsoló(k) | Lámpák | Indok |\n|---|---|---|`);
  R.L.units.forEach(u => P(`| ${u.switches.map(id => nm(id) + (R.L.role[id] === 'middle' ? ' [kereszt]' : '')).join(' → ')} — **${MODE_HU[u.mode] || u.mode}** | ${u.lamps.map(nm).join(', ')} | ${[...new Set(u.lamps.map(l => R.L.why[l]))].join('; ')} |`));
  P('');
  P(`### 1.2 Áramkörök\n`);
  P(`| Kör | Név | Védelem | Kábel | Tagok | Forrás |\n|---|---|---|---|---|---|`);
  R.C.list.forEach(c => P(`| **${c.ref}** | ${esc(c.name)} | ${c.mcb || '—'} | ${cabN(c.cable)} | ${c.members.length}: ${c.members.map(e => e.ref || e.id).join(', ')} | ${c.src} |`));
  P(`\nA redőnymotorok a zóna világítási körén vannak (nem dedikált), mindegyik mellé reteszelt fel/le kapcsoló került (\`SW-…\`). A sziget dugaljai és a főzőlap a padlón át kapják a tápot az RBX03-ból.\n`);
  P(`### 1.3 Figyelmeztetések\n`);
  R.warn.forEach(w => P(`- **${w.sev}** — ${esc(w.msg)}`)); P('');
  // 2. magasságok
  P(`## 2. Szabványmagasságok (${E.filter(e => e.hChanged).length} változás)\n`);
  P(`| Pont | Réteg | Típus | Volt | Lett | Szabály |\n|---|---|---|---|---|---|`);
  E.filter(e => e.hChanged).sort((a, b) => (a.role + a.id).localeCompare(b.role + b.id)).forEach(e => P(`| ${nm(e.id)} | ${e.role} | ${e.code}${e.v ? '/' + e.v : ''} | ${e.h0 == null ? 'új' : Math.round(e.h0)} | **${Math.round(e.h)}** | ${esc(e.hRule)} |`));
  P('');
  // 3. portálok
  P(`## 3. Portálok — a pontok a helyükön\n`);
  P(`Sablon: \`portal-sablon.png\`. Zsanéroldal = csak SELV (fészek H0 2450, levegő H3 1450, értesítő H2 1150, lábfény H1 300); kilincsoldal = erősáram (L4 leállás 2450, kapcsoló L1 1100, dugalj L3 300) + külön SELV oszlop a panelnek (L2, 450 mm-re); fej = ToF / érzékelő (T1 2150) és fejzseb (T2 2400).\n`);
  P(`| Portál | Fal | Oldalak | Kilincs | Tagok (pont → oldal : hely) |\n|---|---|---|---|---|`);
  PT.forEach(p => P(`| ${p.id} | ${p.wall} | ${p.faces.map(f => f.room).join(' / ')} | ${p.latch > 0 ? '+' : '−'} | ${E.filter(e => e.portal === p.id).map(e => `${e.ref || e.id} ${e.code}${e.v ? '/' + e.v : ''} → ${e.pFace}:${e.slot}`).join(' · ')} |`));
  P('');
  // 4. szervizpontok és gerinc
  P(`## 4. Szervizpontok és a gerinc — egy fa az Elosztóból
`);
  P(`Minden szervizpont a fán át éri el az Elosztót; a fa a többi szervizpontot kerüli, ahol van kerülőút. Áramkörönként **egy** kábel fut a fán; a cső ott szakad meg, ahol az áramkör véget ér vagy elágazik, RBX-ben, és ${RU.FILL.maxBends}-nál több ív után közös húzódobozban. Az áthaladó áramkörök csövei a portálok dobozai mellett haladnak el, nem mennek bele.
`);
  P(`| Szervizpont | Típus | Helyiségek | Út az Elosztótól | Útközben elhalad | Ide érkező áramkörök |
|---|---|---|---|---|---|`);
  R.SP.forEach(sp => { const ch = R.channel[sp.id]; P(`| ${sp.id} | ${sp.type} | ${sp.faces.map(f => f.room).join(', ')} | ${ch && ch.cables.length ? m(ch.len) + ' m' : '—'} | ${ch && ch.passes.length ? ch.passes.join(', ') : '—'} | ${ch && ch.cables.length ? mergeTxt(ch.cables) : '—'} |`); });
  P(`
Gerinc-szakaszok:
`);
  P(`| Szakasz | Szervizpontok felé | Honnan → hová | Hossz m | Ív | Kábelek | Védőcső |
|---|---|---|---|---|---|---|`);
  R.legs.filter(l => l.kind === 'trunk').forEach(l => P(`| ${l.id}${l.over ? ' ⤒' : ''} | ${l.sp} | ${l.from} → ${l.to} | ${m(l.len)} | ${l.bends} | ${mergeTxt(l.cables)} | **${l.cond}** (${l.pipes.map(p => Math.round(p.fill * 100) + ' %').join(', ')}) |`));
  const ov = R.legs.filter(l => l.kind === 'trunk' && l.over);
  (cfg.ceilLinks || []).forEach(cl => { if (!ov.length) return;
    P(`\n⤒ **${cl.n}:** itt a gerinc a födémben megy át (${ov.map(l => l.id + ': ' + l.from + ' → ' + l.to).join(', ')}; ${m(ov[0].len)} m, fel ${(cfg.ceiling || 2850) - RU.LEVEL.trunk} mm a mennyezetig és vissza), mindkét végén húzódoboz. A leágazó nem használja.`); });
  P('');
  // prepared routes (R12)
  if ((R.prep || []).length) {
    P(`## 4b. Előkészített útvonalak — nem számolt\n`);
    P(`Rajzon szürke szaggatott vonal. A pálya és a dobozok helye a terv része, de az anyaglistában **nincsenek benne** (sem cső, sem kábel, sem doboz).\n`);
    P(`| Tétel | Pontok | Kör | Szakasz | Honnan → hová | Hossz m | Kábel | Cső |\n|---|---|---|---|---|---|---|---|`);
    R.prep.forEach(it => it.legs.forEach((l, k) => P(`| ${k ? '' : `**${it.id}** ${esc(it.name)} — ${esc(it.why)}`} | ${k ? '' : it.points.map(q => `${q.ref} (${q.h} mm: ${esc(q.n)})`).join('; ')} | ${it.circ} | ${l.id} ${KIND_HU[l.kind]} | ${l.from} → ${l.to} | ${m(l.len)} | ${mergeTxt(l.cables)} | ${l.cond} |`)));
    P('');
  }
  // 5. anyaglista
  const cond = {}, cab = {}, box = {};
  R.legs.forEach(l => l.pipes.forEach(p => { cond[p.cond] = (cond[p.cond] || 0) + l.len;
    p.cables.forEach(c => { cab[c.c] = (cab[c.c] || 0) + l.len * (c.n || 1); }); }));
  Object.keys(cab).forEach(k => cab[k] *= 1.10);                                   // +10 % ráhagyás (bekötés, dobozban hurok)
  R.boxes.filter(b => b.kind !== 'rbx').forEach(b => { const ov = b.kind === 'sp' && ((cfg.spBoxSize || {})[b.sp + ':' + b.room] || (cfg.spBoxSize || {})[b.sp]), k = ov ? `kötődoboz ${ov}×${ov} (${b.sp})` : BOX_HU[b.kind]; box[k] = (box[k] || 0) + 1; });
  box['RBX (meglévő hardver, erősáramú rekesz)'] = new Set(R.boxes.filter(b => b.kind === 'rbx').map(b => b.sp)).size;
  const dev = E.filter(e => e.role === 'sys:MAINS').length;
  P(`## 5. Anyaglista (tájékoztató — kábel: nyomvonal + 10 % ráhagyás; cső: nyomvonalhossz; hulladék nélkül)\n`);
  P(`| Védőcső (gégecső) | m |\n|---|---|`); Object.keys(cond).sort((a, b) => RU.CONDUITS.findIndex(c => c.k === a) - RU.CONDUITS.findIndex(c => c.k === b)).forEach(k => P(`| ${k} | ${m(cond[k])} |`));
  P(`\n| Kábel | m |\n|---|---|`); Object.keys(cab).sort().forEach(k => P(`| ${cabN(k)} | ${m(cab[k])} |`));
  P(`\n| Doboz | db |\n|---|---|`); Object.entries(box).forEach(([k, n]) => P(`| ${k} | ${n} |`)); P(`| Szerelvénydoboz a végpontokon | ${dev} |`);
  P(`\nCsőszakaszok: ${R.legs.length} (${Object.entries(KIND_HU).map(([k, n]) => n + ' ' + R.legs.filter(l => l.kind === k).length).join(', ')}) — tételesen: \`legs.csv\`.\n`);
  fs.writeFileSync(file, out.join('\n'));
}
function mergeTxt(cables) { const by = {}; (cables || []).forEach(c => { const o = by[c.c] || (by[c.c] = { n: 0, circ: new Set() }); o.n += (c.n || 1); [].concat(c.circ || []).forEach(x => o.circ.add(x)); });
  return Object.entries(by).map(([k, o]) => `${o.n}× ${cabN(k)} (${[...o.circ].join(', ')})`).join(' + '); }

function csv(ctx, file) {
  const rows = [['cso', 'fajta', 'honnan', 'hova', 'hossz_mm', 'iv', 'magassag', 'csovek', 'kabelek', 'jeloletlen_fal', 'atvezetes']];
  ctx.R.legs.forEach(l => rows.push([l.id, KIND_HU[l.kind], l.from, l.to, l.len, l.bends, l.h == null ? '' : l.h, l.cond,
    l.pipes.map(p => p.circ.join('+') + ':' + p.cables.map(c => (c.n > 1 ? c.n + 'x ' : '') + cabN(c.c)).join('/') + ' ' + p.cond + ' ' + Math.round(p.fill * 100) + '%').join(' | '), l.soft ? 'igen' : '', l.crosses ? 'igen' : '']));
  fs.writeFileSync(file, '﻿' + rows.map(r => r.map(v => /[;"\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : v).join(';')).join('\r\n'));
}

// ---- the output .vplan: heights, portal moves, new switches, boxes, conduit paths, circuits ---------------------------
function vplan(ctx, file) {
  const { doc, R, E, cfg } = ctx, out = JSON.parse(JSON.stringify(doc)), P = out.project, D = P.data;
  const lid = role => (P.layers.find(l => l.role === role) || {}).id;
  const L_MAINS = lid('sys:MAINS'), L_CH = lid('channel'), L_ARM = lid('arm');
  const nid = pre => pre + (++D.seq);
  // the sketch lines move to their own hidden layer (kept, not deleted)
  const sk = { id: 'L_sketch_' + D.seq, name: 'Vázlat — kézi vonalak (eredeti)', visible: false, cats: { path: true, device: true } };
  P.layers.push(sk); D.paths.forEach(p => { p.layer = sk.id; });
  // devices: heights, portal positions, adopted switches
  E.forEach(e => { if (!e.dev) return; const d = D.devices.find(x => x.id === e.id); if (!d) return;
    d.h = Math.round(e.h); if (e.moved) { d.x = Math.round(e.x); d.y = Math.round(e.y); }
    if (e.adopted) { d.layer = L_MAINS; d.code = 'SWI'; d.var = '230'; } });
  // new shutter switches
  E.filter(e => e.isNew).forEach(e => { const id = nid('D'); e.newId = id;
    D.devices.push({ type: 'switch', code: 'SWI', var: 'shu', level: cfg.level, x: Math.round(e.x), y: Math.round(e.y), h: e.h, layer: L_MAINS, id, ref: e.ref, faceBack: false, note: 'Redőnykapcsoló (fel/le, reteszelt) — erősáram alapréteg' }); });
  const realId = id => (E.find(e => e.id === id && e.isNew) || {}).newId || id;
  // boxes (RBX already exists as hardware)
  const boxDev = {}; R.boxes.filter(b => b.kind !== 'rbx').forEach(b => { const id = nid('D'); boxDev[b.id] = id;
    const sz = RU.BOX[b.kind === 'sp' ? 'portalMains' : b.size] || RU.BOX.gang2, ov = b.kind === 'sp' && ((cfg.spBoxSize || {})[b.sp + ':' + b.room] || (cfg.spBoxSize || {})[b.sp]);
    D.devices.push({ type: 'junction', jbShape: 'rect', jbSize: ov || (b.kind === 'pull' ? 200 : sz.jbSize), level: cfg.level, x: Math.round(b.x), y: Math.round(b.y), h: b.h,
      layer: L_MAINS, id, ref: b.id, note: `${b.n} [${BOX_HU[b.kind]}]`, faceBack: false }); });
  // circuits
  const oldByRef = {}; D.circuits.forEach(c => oldByRef[c.ref] = c);
  D.circuits = R.C.list.map((c, k) => ({ ref: c.ref, name: c.name, col: (oldByRef[c.ref] || {}).col || CIRC_COL[k % CIRC_COL.length], dedicated: !!c.dedicated,
    mcb: c.mcb || '', members: c.members.map(e => realId(e.id)), id: (oldByRef[c.ref] || {}).id || nid('A'), cable: cabN(c.cable) }));
  const circId = ref => (D.circuits.find(c => c.ref === ref) || {}).id || null;
  // one path per pipe; trunk on the Csatorna layer, everything else on the ARM layer
  R.legs.forEach(l => l.pipes.forEach((p, k) => {
    const nodes = l.poly.map(q => ({ level: cfg.level, x: Math.round(q[0]), y: Math.round(q[1]), h: Math.round(q[2]), id: nid('n') }));
    D.paths.push({ ptype: 'gege', nodes, sections: nodes.slice(1).map(() => ({ build: 'sull_gege', circuit: p.circ.length === 1 ? circId(p.circ[0]) : null,
      cond: p.cond, fill: p.fill, cables: p.cables.map(c => (c.n > 1 ? c.n + '× ' : '') + cabN(c.c)).join(' + '), circuits: p.circ, leg: l.id, kind: l.kind })),
      layer: l.kind === 'trunk' || l.kind === 'feed' ? L_CH : L_ARM, lane: k, id: nid('P'), route: l.kind === 'trunk' ? 'channel' : 'arm', color: KCOL[l.kind] }); }));
  // prepared routes (R12): their own layer, so a count over the Erősáram / ARM layers never includes them
  if ((R.prep || []).length) { const lp = { id: 'L_prep_' + D.seq, name: 'Előkészítés — nem számolt (R12)', visible: true, cats: { path: true, device: true } }; P.layers.push(lp);
    R.prep.forEach(it => {
      it.points.forEach(q => D.devices.push({ type: q.code === 'SWI' ? 'switch' : 'ep', code: q.code, var: q.v || '230', level: cfg.level, x: q.x, y: q.y, h: q.h, layer: lp.id, id: nid('D'), ref: q.ref,
        faceBack: false, note: `${q.n} — ${it.name}: ${it.why}` }));
      it.boxes.forEach(b => D.devices.push({ type: 'junction', jbShape: 'rect', jbSize: RU.BOX.gang2.jbSize, level: cfg.level, x: Math.round(b.x), y: Math.round(b.y), h: b.h, layer: lp.id, id: nid('D'), ref: b.id,
        note: `${b.n} [előkészítés, nem számolt]`, faceBack: false }));
      it.legs.forEach(l => l.pipes.forEach((p, k) => { const nodes = l.poly.map(q => ({ level: cfg.level, x: Math.round(q[0]), y: Math.round(q[1]), h: Math.round(q[2]), id: nid('n') }));
        D.paths.push({ ptype: 'gege', nodes, sections: nodes.slice(1).map(() => ({ build: 'sull_gege', circuit: null, cond: p.cond, fill: p.fill,
          cables: p.cables.map(c => (c.n > 1 ? c.n + '× ' : '') + cabN(c.c)).join(' + '), circuits: p.circ, leg: l.id, kind: l.kind, prep: true })),
          layer: lp.id, lane: k, id: nid('P'), route: 'arm', color: PREPCOL }); })); }); }
  // the layers this round fills are shown
  P.layers.forEach(l => { if ([L_MAINS, L_CH, L_ARM].includes(l.id)) l.visible = true; });
  out.name = (doc.name || 'P33') + ' — erősáram alapréteg'; out.saved = new Date().toISOString();
  fs.writeFileSync(file, JSON.stringify(out));
}

function all(ctx) {
  const { outDir } = ctx, base = path.basename(ctx.inFile).replace(/\.vplan.*$/i, '').replace(/\.json$/i, '');
  networkSheet(ctx, path.join(outDir, 'alap-halozat.png'));
  circuitSheet(ctx, path.join(outDir, 'alap-aramkorok.png'));
  tpl.write(path.join(outDir, 'portal-sablon.png'));
  report(ctx, path.join(outDir, 'ALAPRETEG.md'));
  if (ctx.cfg.switchGroups && ctx.cfg.switchGroups.length) { const pk = require('./pack'), open = pk.buildOpen(ctx), f = path.join(outDir, 'ALAPRETEG-Q-002.json');
    if (open.sections[0].questions.length) fs.writeFileSync(f, JSON.stringify(open, null, 1)); else if (fs.existsSync(f)) fs.unlinkSync(f); }   // round 2: only what stays open
  else require('./pack').write(ctx, path.join(outDir, 'ALAPRETEG-Q-001.json'));                         // round 1: every approval
  csv(ctx, path.join(outDir, 'legs.csv'));
  vplan(ctx, path.join(outDir, base + '_alapreteg.vplan.json'));
}
module.exports = { all, networkSheet, circuitSheet, report, csv, vplan, CIRC_COL, KCOL, BCOL, VIEW, PLAN_BOUNDS, legend, line, title, hwName, midOf, cabN, BOX_HU };
