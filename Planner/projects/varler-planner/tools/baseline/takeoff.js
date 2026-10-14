// takeoff.js — the quantities of one baseline run in a form a pricing tool can read (the Varler Workflow Kit):
// <name>_takeoff.json + MENNYISEGEK.md. Everything here is derived from R (Erősáram) and X (Adat/PoE, LED, old plan);
// nothing is priced. Chase ("horony") lengths count each groove once: parallel pipes in one stretch share it.
'use strict';
const fs = require('fs'), path = require('path'), RU = require('./rules'), { PORTS } = require('./data');

const m = v => Math.round(v / 100) / 10;                                          // mm → m, one decimal
const area = poly => Math.abs(poly.reduce((a, p, k) => { const q = poly[(k + 1) % poly.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2 / 1e6;
const KIND_HU = { trunk: 'gerinc 2600', dist: 'leágazó 2450', drop: 'leállás (függőleges)', ceil: 'mennyezet', floor: 'padló', island: 'padló-elágazás (sziget)', feed: 'fővezeték', riser: 'emeleti felállás (üres)' };
const CODE_HU = { SOC: 'dugalj', SWI: 'kapcsoló', LMP: 'lámpa / lámpakivezetés', DED: 'dedikált csatlakozó', SHU: 'redőnymotor' };

// the length of the union of horizontal segments of a set of polylines (a groove shared by several pipes counts once)
function unionLen(polys) {
  const seen = new Set(); let L = 0;
  polys.forEach(pl => pl.forEach((p, k) => { const q = pl[k - 1]; if (!q || Math.abs(p[2] - q[2]) > 1) return;
    const a = [Math.round(q[0]), Math.round(q[1])], b = [Math.round(p[0]), Math.round(p[1])], key = [a, b].sort().join('|') + '|' + Math.round(p[2]);
    if (seen.has(key)) return; seen.add(key); L += Math.hypot(b[0] - a[0], b[1] - a[1]); }));
  return L;
}

function build(ctx) {
  const { G, E, R, cfg, X } = ctx, D = G.D;
  const rooms = G.rooms.map(r => ({ id: r.id, name: r.name, area_m2: +area(r.poly).toFixed(2), wet: (cfg.wetRooms || []).includes(r.id) }));
  const M = E.filter(e => e.role === 'sys:MAINS');
  const endpoints = M.map(e => ({ id: e.id, ref: e.ref || e.id, code: e.code, v: e.v || '', room: e.room, h: Math.round(e.h), circuit: (R.C.byMember[e.id] || {}).ref || null,
    portal: e.portal || null, isNew: !!e.isNew || !!(e.dev && e.dev.added), note: (e.dev && e.dev.note) || '' }));
  const byCode = {}; endpoints.forEach(e => { const k = e.code + (e.code === 'SWI' && e.v === 'shu' ? ':shu' : ''); byCode[k] = (byCode[k] || 0) + 1; });
  const circuits = R.C.list.map(c => { const by = {}; c.members.forEach(e => by[e.code] = (by[e.code] || 0) + 1);
    return { ref: c.ref, name: c.name, mcb: c.mcb || '', cable: (RU.CABLES[c.cable] || { n: c.cable }).n, kind: c.kind, dedicated: !!c.dedicated, members: c.members.length, by_code: by }; });
  // conduit by kind × size, cables by type (+10 %), boxes by kind
  const cond = {}, cab = {}; R.legs.forEach(l => l.pipes.forEach(p => { const k = KIND_HU[l.kind] || l.kind; (cond[k] = cond[k] || {})[p.cond] = (cond[k][p.cond] || 0) + l.len;
    p.cables.forEach(c => { if (c.c !== 'SPARE') cab[c.c] = (cab[c.c] || 0) + l.len * (c.n || 1); }); }));
  Object.values(cond).forEach(o => Object.keys(o).forEach(s => o[s] = m(o[s])));
  const cables = Object.fromEntries(Object.entries(cab).map(([k, v]) => [(RU.CABLES[k] || { n: k }).n, m(v * 1.10)]));
  const boxes = {}; R.boxes.forEach(b => { const ov = b.kind === 'sp' && ((cfg.spBoxSize || {})[b.sp + ':' + b.room] || (cfg.spBoxSize || {})[b.sp]);
    const k = b.kind === 'rbx' ? null : ov ? `kötődoboz ${ov}×${ov}` : ({ sp: 'szervizpont-doboz (2 szerelvényes)', drop: 'leállás-doboz (2 szerelvényes)', corner: 'sarok-tartalékdoboz (2 szerelvényes)',
      end: 'pályavég-tartalékdoboz (2 szerelvényes)', island: 'sziget / padló kötődoboz', pull: 'gerinc húzódoboz', tj: 'gerinc elágazó doboz' })[b.kind] || b.kind;
    if (k) boxes[k] = (boxes[k] || 0) + 1; });
  boxes['szerelvénydoboz a végpontokon'] = M.length;
  // chases (horony): horizontal grooves once per stretch, vertical drops once per box column, ceiling runs
  const trunkP = R.legs.filter(l => l.kind === 'trunk').map(l => l.poly), distP = (R.spans || []).map(s => s.poly);
  const ceilRun = R.legs.filter(l => l.kind === 'ceil').reduce((a, l) => a + Math.hypot(l.poly[l.poly.length - 1][0] - l.poly[l.poly.length - 2][0], l.poly[l.poly.length - 1][1] - l.poly[l.poly.length - 2][1]), 0);
  const cols = new Map(); R.legs.filter(l => l.kind === 'drop').forEach(l => { const k = Math.round(l.poly[0][0]) + ',' + Math.round(l.poly[0][1]); cols.set(k, (cols.get(k) || 0) + l.len); });
  const overs = R.legs.filter(l => l.kind === 'trunk' && l.over);
  const chases = { 'vízszintes horony — gerinc 2600 (m)': m(unionLen(trunkP)), 'vízszintes horony — leágazó 2450 (m)': m(unionLen(distP)),
    'függőleges horony — leállások (m)': m([...cols.values()].reduce((a, b) => a + b, 0)), 'leállás-oszlopok (db)': cols.size,
    'mennyezeti horony / vezetés a lámpákig (m)': m(ceilRun), 'mennyezeti átvezetés (db)': overs.length,
    'padlóátvezetés (db)': R.legs.filter(l => l.kind === 'floor').length + R.legs.filter(l => l.kind === 'dist' && l.floor).length };
  // wall crossings: every used 'cross' edge once (portal / RBX / BASE)
  const g = R.net.g, ek = (a, b) => a < b ? a + '-' + b : b + '-' + a, cross = new Set();
  const addX = pts => pts.forEach((p, k) => { if (k && g.adj[pts[k - 1]].some(e => e.to === p && e.kind === 'cross')) cross.add(ek(pts[k - 1], p)); });
  R.legs.filter(l => l.kind === 'dist').forEach(l => addX(l.pts || [])); Object.values(R.channel).forEach(ch => ch.cables.length && addX(ch.nodes));
  chases['falátvezetés szervizponton (db)'] = cross.size;
  const lp = R.legs.filter(l => l.kind === 'feed')[0];
  const out = {
    meta: { project: cfg.name, source: path.basename(ctx.inFile), generated: new Date().toISOString().slice(0, 16).replace('T', ' '), engine: 'Planner/projects/varler-planner/tools/baseline (v1)',
      level: cfg.level, ceiling_mm: cfg.ceiling, rules: { trunk_mm: RU.LEVEL.trunk, dist_mm: RU.LEVEL.dist, data_mm: (X && X.DA.C.h) || null, maxCablesPerPipe: cfg.maxCablesPerPipe,
        method: 'süllyesztett gégecső falhoronyban (vízszintes pálya csak jelölt falon), falátvezetés csak szervizponton; áthaladó cső a doboz mellett' },
      note: 'Mennyiségek, ár nélkül. Kábel: nyomvonal + 10 %; cső: nyomvonalhossz; horony: egy horony több párhuzamos csőnek is.' },
    rooms, floor_area_m2: +rooms.reduce((a, r) => a + r.area_m2, 0).toFixed(2),
    endpoints_by_code: byCode, endpoints, circuits, conduit_m: cond, cables_m: cables, boxes, chases,
    main_feed: lp ? { cable: (RU.CABLES[cfg.mainFeedCable] || {}).n, len_m: m(lp.len) } : null,
    service_points: R.SP.map(sp => ({ id: sp.id, type: sp.type, rooms: sp.faces.map(f => f.room), used: !!(R.channel[sp.id] && R.channel[sp.id].cables.length) })),
    data: X ? { topology: X.DA.C.topology, endpoints: X.DA.EP.map(e => ({ id: e.id, ref: e.ref, code: e.code, room: e.room, ports: PORTS(e) })),
      cat6a_m: m((() => { let t = 0; X.DA.legs.forEach(l => l.pipes.forEach(p => p.cables.forEach(c => { if (c.c === 'CAT6A') t += l.len * (c.n || 1); }))); return t * 1.10; })()),
      conduit_m: (() => { const o = {}; X.DA.legs.forEach(l => l.pipes.forEach(p => o[p.cond] = (o[p.cond] || 0) + l.len)); Object.keys(o).forEach(k => o[k] = m(o[k])); return o; })(),
      boxes: (() => { const o = {}; X.DA.boxes.forEach(b => o[b.kind] = (o[b.kind] || 0) + 1); return o; })(),
      chase_m: m(unionLen(X.DA.legs.filter(l => l.kind === 'dh').map(l => l.poly))), isp_empty_pipes: (X.DA.C.isp || []).length } : null,
    led: X ? X.LE.runs.map(r => ({ id: r.id, name: r.name, room: r.face.room, len_m: m(r.len), cont_m: r.cont ? m(r.cont.len) : 0, h: r.h, box: r.box.id + ' ⌀68 mély', feed: r.srcDev ? (r.srcDev.ref || r.srcDev.id) : r.srcTxt })) : null,
    prepared_not_counted: (R.prep || []).map(it => ({ id: it.id, name: it.name, why: it.why, points: it.points.map(q => q.ref), route_m: m(it.legs.reduce((a, l) => a + l.len, 0)) })),
    not_in_scope: ['BRIDGE-hardver (RBX, BASE, szenzorok, portál-modulok, panelek) — külön rendszer, a dobozaik helye a tervben szerepel',
      'LED-szalagok, profilok, tápegységek (csak a betáp-dobozok)', 'lámpatestek, készülékek', 'emelet (R09–R13): a földszint után']
  };
  return out;
}

function md(T) {
  const P = [], t = (h, rows) => { P.push('| ' + h.join(' | ') + ' |', '|' + h.map(() => '---').join('|') + '|'); rows.forEach(r => P.push('| ' + r.join(' | ') + ' |')); P.push(''); };
  P.push(`# P33 — mennyiségek (ár nélkül)\n`);
  P.push(`Forrás: \`${T.meta.source}\` · motor: \`${T.meta.engine}\` · ${T.meta.generated}`, '', `Módszer: ${T.meta.rules.method}. ${T.meta.note}`, '');
  P.push(`## Helyiségek — földszint ${String(T.floor_area_m2).replace('.', ',')} m² (a vplan sokszögeiből)\n`); t(['Helyiség', 'Név', 'm²', 'Vizes'], T.rooms.map(r => [r.id, r.name, String(r.area_m2).replace('.', ','), r.wet ? 'igen' : '']));
  P.push(`## Végpontok (erősáram)\n`); t(['Fajta', 'db'], Object.entries(T.endpoints_by_code).map(([k, n]) => [k === 'SWI:shu' ? 'redőnykapcsoló' : (CODE_HU[k] || k), n]));
  P.push(`## Áramkörök\n`); t(['Kör', 'Név', 'Védelem', 'Kábel', 'Tagok'], T.circuits.map(c => [c.ref, c.name, c.mcb, c.cable, c.members]));
  P.push(`## Horony, átvezetés\n`); t(['Tétel', 'Mennyiség'], Object.entries(T.chases).map(([k, v]) => [k, String(v).replace('.', ',')]));
  P.push(`## Védőcső (m)\n`); t(['Szakasz', 'Méret', 'm'], Object.entries(T.conduit_m).flatMap(([k, o]) => Object.entries(o).map(([s, v]) => [k, s, String(v).replace('.', ',')])));
  P.push(`## Kábel (m, +10 %)\n`); t(['Kábel', 'm'], Object.entries(T.cables_m).map(([k, v]) => [k, String(v).replace('.', ',')]));
  P.push(`## Dobozok\n`); t(['Doboz', 'db'], Object.entries(T.boxes));
  if (T.data) { P.push(`## Adat / PoE\n`); t(['Tétel', 'Mennyiség'], [['végpont (port)', T.data.endpoints.reduce((a, e) => a + e.ports, 0)], ['Cat6A (m, +10 %)', String(T.data.cat6a_m).replace('.', ',')], ['horony 2700 (m)', String(T.data.chase_m).replace('.', ',')],
    ...Object.entries(T.data.conduit_m).map(([k, v]) => ['védőcső ' + k + ' (m)', String(v).replace('.', ',')]), ...Object.entries(T.data.boxes).map(([k, v]) => ['doboz: ' + k, v]), ['szolgáltatói üres cső (db)', T.data.isp_empty_pipes]]); }
  if (T.led) { P.push(`## LED-betápok\n`); t(['LED', 'Futás', 'm', 'Folytatás m', 'Magasság', 'Doboz'], T.led.map(l => [l.id, l.name, String(l.len_m).replace('.', ','), l.cont_m ? '~' + String(l.cont_m).replace('.', ',') : '', l.h, l.box])); }
  P.push(`## Nem számolt\n`); T.prepared_not_counted.forEach(p => P.push(`- **${p.id}** ${p.name} — ${p.why} (${p.points.join(' + ')}, ${String(p.route_m).replace('.', ',')} m pálya)`)); T.not_in_scope.forEach(s => P.push(`- ${s}`));
  return P.join('\n') + '\n';
}

function write(ctx, dir) {
  const base = path.basename(ctx.inFile).replace(/\.vplan.*$/i, '').replace(/\.json$/i, ''), T = build(ctx);
  fs.writeFileSync(path.join(dir, base + '_takeoff.json'), JSON.stringify(T, null, 1));
  fs.writeFileSync(path.join(dir, 'MENNYISEGEK.md'), md(T));
  return T;
}
module.exports = { build, write, md };
