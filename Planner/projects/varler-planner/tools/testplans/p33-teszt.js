#!/usr/bin/env node
// p33-teszt.js — the P33 stack test plan, built through the Planner's own functions.
//
//   node tools/testplans/p33-teszt.js v1 <P33 plan.vplan.json> <out v1.vplan.json>
//   node tools/testplans/p33-teszt.js v2 <v1.vplan.json>       <out v2.vplan.json>
//
// v1 (2026-10-09, the user's spec): P33's ground floor with the agreed remodel, turned 180° so it
// reads the way the user describes it (entrance room on the left, kitchen reaching down, bedroom
// below the living room). Hardware nodes, the golden path between them, ONLY the client's new
// endpoints (the plan's "Order" layer + the notes + sheet r2), dedicated / string circuits, and a
// 10 × 10 kötődoboz at the upper latch-side corner of every portal. No silver or bronze paths: the
// user draws one bronze path (kitchen → Elosztó) by hand as the Phase 3 test.
// v2: v1 plus the higher stack layers filled with ideal positions, by the placement rules.
//
// Everything is placed in P33's own frame (the frame of the plan file and the BRIDGE sheets, where
// P33-D1 / BUILD-001 positions are known) and turned by T() just before it enters the Planner.
// Needs jsdom: NODE_PATH=<node_modules with jsdom>.
'use strict';
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom');
const [, , MODE, IN, OUT] = process.argv;
if (!/^v[12]$/.test(MODE || '') || !IN || !OUT) { console.error('usage: node tools/testplans/p33-teszt.js v1|v2 <in> <out>'); process.exit(2); }

const HTML = process.env.PLANNER || path.join(__dirname, '..', '..', 'dist', 'varler_planner.html');
const dom = new JSDOM(fs.readFileSync(HTML, 'utf8'), { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window;
w.alert = () => {}; w.confirm = () => true;
const LVL = 'ground';
const J = o => JSON.stringify(o);
const D = () => w.__data;

// ---- the 180° turn: P33 frame -> test-plan frame (keeps every coordinate positive) ----
const CX = 10934, CY = 11440;
const T = (x, y) => [CX - x, CY - y];
const Trect = r => ({ x0: CX - r.x1, y0: CY - r.y1, x1: CX - r.x0, y1: CY - r.y0 });
const Tpoly = p => p.map(([x, y]) => T(x, y));

// ---- helpers over the live Planner model ----
const walls = () => w.__getWalls()[LVL];
const wallById = id => walls().find(r => r.id === id);
const roomByNum = num => D().floors.find(f => f.level === LVL && f.num === num);
// the wall-centreline point nearest to a P33-frame point near a wall face, and the face it is on (1 = +perp)
function onWall(px, py) {
  const [x, y] = T(px, py);
  const pk = w.hwPickPlan(LVL, x, y, 400);
  if (!pk) throw new Error(`no wall near P33 (${px}, ${py})`);
  const wi = w.wallInfo(pk.r), a = wi.seg[0];
  const t = wi.horiz ? [x, a[1]] : [a[0], y];
  return { x: Math.round(t[0]), y: Math.round(t[1]), side: pk.side > 0 ? 1 : 0, wall: pk.id };
}
function free(px, py) { const [x, y] = T(px, py); return { x: Math.round(x), y: Math.round(y) }; }
// an endpoint through epPlace, so it lands on its role's layer with its code, variant and ref
function ep(code, role, vk, at, h, extra) {
  const en = w.epEntry(code, role);
  if (!en) throw new Error('no catalogue entry ' + code + ' ' + role);
  const g = Object.assign({ level: LVL, h, mount: at.side != null ? 'wall' : (en.mount === 'wall' ? 'floor' : en.mount) }, at);
  const d = w.epPlace(g, code, role, vk);
  if (!d) throw new Error('epPlace failed ' + code);
  if (extra) Object.assign(d, extra);
  return d;
}
function route(tool, pts) {
  w[tool]();
  pts.forEach(p => w.eval('pathAddNode(' + J(p) + ')'));
  w.eval('finishPath()');
  return D().paths[D().paths.length - 1];
}
const at = (d, h) => ({ level: LVL, x: d.x, y: d.y, h: h != null ? h : d.h, dev: d.id });
const P = (px, py, h) => { const [x, y] = T(px, py); return { level: LVL, x: Math.round(x), y: Math.round(y), h }; };
function sideToward(wallId, roomRec) {
  const r = wallById(wallId), wi = w.wallInfo(r), c = w.sugCentroid(roomRec.poly), a = wi.seg[0];
  return ((c[0] - a[0]) * wi.perp[0] + (c[1] - a[1]) * wi.perp[1]) >= 0 ? 1 : -1;
}
function mark(o, S) { w.mrkList().push(Object.assign({ level: LVL, layer: w.stkLayer(S.id, 'mark').id, pol: 'none', tags: [] }, o)); w.ensureIds(D()); }

// ======================================================================================
// v1
// ======================================================================================
function buildV1(src) {
  const P33 = src.project, PW = P33.building.walls.ground;
  w.newBlankProject();
  w.eval('LH.ground=2700');

  // ---- construct: P33's walls with the remodel of sheet r2 (P33-D1, BUILD-001 K21/K29) ----
  const keep = PW.filter(r => r.id !== 'W16')                 // the wall through the island is demolished
    .map(r => {
      const o = { id: r.id, x0: Math.min(r.x0, r.x1), y0: Math.min(r.y0, r.y1), x1: Math.max(r.x0, r.x1), y1: Math.max(r.y0, r.y1) };
      if (r.id === 'W17') o.y1 = 4500;                          // fürdő | konyha: only the part above the new bathroom wall stays
      if (r.id === 'W169') o.x1 = 7849;                         // the new bathroom wall (was on the Order layer) meets W17
      return o;
    });
  keep.push({ x0: 5907, y0: 4500, x1: 6011, y1: 6106, name: 'hűtőfülke előtétfal' });   // new lining wall for the fridge niche
  keep.forEach(r => walls().push(Object.assign(Trect(r), r.id ? { id: r.id } : {}, r.name ? { name: r.name } : {})));

  // ---- rooms (P33-D1 refs); polygons on the inner wall faces ----
  const rooms = [
    ['R01', 'Előszoba', [[8714, 7258], [10150, 7258], [10150, 9050], [8714, 9050]]],
    ['R03', 'Konyha · étkező', [[7849, 3169], [10150, 3169], [10150, 7008], [7604, 7008], [7604, 7044], [5907, 7044], [5907, 6106], [6011, 6106], [6011, 4500], [7849, 4500]]],
    ['R04', 'WC', [[7854, 7258], [8514, 7258], [8514, 9050], [7854, 9050]]],
    ['R05', 'Kamra', [[5907, 7294], [6769, 7294], [6769, 9050], [5907, 9050]]],
    ['R03L', 'Lépcső', [[6969, 7044], [7604, 7044], [7604, 9050], [6969, 9050]]],
    ['R06', 'Nappali', [[834, 5225], [5607, 5225], [5607, 9050], [834, 9050]]],
    ['R07', 'Szoba', [[834, 2390], [4736, 2390], [4736, 3900], [5607, 3900], [5607, 4975], [834, 4975]]],
    ['R08', 'Fürdő', [[5036, 2390], [5805, 2390], [5805, 3169], [7599, 3169], [7599, 4300], [5907, 4300], [5907, 3700], [5036, 3700]]],
  ];
  rooms.forEach(([num, name, poly]) => D().floors.push({ level: LVL, num, name, poly: Tpoly(poly), fill: '#e2ddd0' }));

  // ---- openings: P33's doors and windows; the old szoba door walled up, the door into the old
  // bathroom and the előszoba window (it overlapped the entrance) gone; the new szoba door added ----
  const dropOp = { B102: 'befalazva', B108: 'a bontott falban', B116: 'átfedett a bejárati ajtóval' };
  P33.data.openings.filter(o => o.level === LVL && !dropOp[o.id]).forEach(o => {
    const [x, y] = T(o.x, o.y);
    // turned 180°: ang stays (0 or π/2), so the hinge moves to the other jamb and the swing to the other face
    D().openings.push(Object.assign({}, o, { x: Math.round(x), y: Math.round(y), variant: (o.variant || 0) ^ 3 }));
  });
  { const [x, y] = T(1447, 5100); D().openings.push({ type: 'door', level: LVL, x: Math.round(x), y: Math.round(y), ang: 0, w: 900, variant: 1 ^ 3, note: 'új ajtónyílás (szoba ↔ nappali)' }); }
  w.ensureIds(D());
  w.eval('for(const l of ORD)SNAP[l]=centerlines(WALLS[l]);');
  const R = {}; rooms.forEach(([num]) => { R[num] = roomByNum(num); });
  const op = id => D().openings.find(o => o.id === id);
  const newDoor = D().openings.find(o => o.note === 'új ajtónyílás (szoba ↔ nappali)');

  // ---- the stack: L0 (walls, rooms, openings) takes the Szerkezet role ----
  const S = w.stkCreate({ name: 'P33 teszt', construct: { mode: 'adopt', layers: ['L0'] } });
  w.eval('B.name="P33 teszt v1"');

  // ---- marking: portals with their tiers (BUILD-001 §8), windows with shutters, the L-shapes ----
  const portals = [   // door, tags, the room the door leads INTO (its portal box goes on that face)
    ['B107', ['bejarat', 'portal', 'p3'], 'R01'],
    ['B106', ['portal', 'p2'], 'R03'],
    ['B105', ['portal', 'p1'], 'R04'],
    ['B104', ['portal', 'p1'], 'R05'],
    ['B103', ['portal', 'p2'], 'R06'],
    [newDoor.id, ['portal', 'p2'], 'R07'],
    ['B109', ['portal', 'p2'], 'R08'],
  ];
  portals.forEach(([id, tags]) => mark({ kind: 'opening', op: id, tags }, S));
  ['B112', 'B113', 'B114', 'B115'].forEach(id => mark({ kind: 'opening', op: id, tags: ['redony'] }, S));
  // the user's L-shapes: szoba's upper + left walls, nappali's left + down walls (test-plan frame)
  [['W15', 'R07'], ['W14', 'R07'], ['W15', 'R06'], ['W12', 'R06']].forEach(([wid, num]) =>
    mark({ kind: 'side', wall: wid, side: sideToward(wid, R[num]), pol: 'plus', tags: ['lforma'] }, S));

  // ---- hardware: Elosztó + BASE in the entrance room, RBX01 on the new bathroom wall's walkway face (K29),
  // RBX02 on the nappali face of the szoba / nappali partition at its spine end (K28) ----
  const hw = (t, px, py) => { const g = w.hwGhostAt(t, LVL, ...T(px, py)); if (!g) throw new Error('no ghost ' + t); return w.hwPlace(g); };
  const board = hw('board', 8915, 7330);
  w.eval('HW_T.units=["NET","COMP","MEDIA"]');
  const base = hw('base', 9400, 8980);
  w.eval('HW_T.rb="RB-H"');
  const rbx1 = hw('rbx', 7300, 4560), rbx2 = hw('rbx', 5150, 5290);
  rbx1.serves = ['R03', 'R08', 'R01', 'R04', 'R05', 'R03L'].map(n => R[n].id);
  rbx2.serves = ['R06', 'R07'].map(n => R[n].id);
  rbx1.ref = 'RBX01'; rbx2.ref = 'RBX02';                       // the user's names (the Planner would key them to rooms, K19)

  // ---- the golden path, wall-based at the cable-spine height (2400), in two lanes (BUILD-001 T1):
  // CHANNEL lane  Elosztó → BASE → RBX01 → RBX02  (data, control, bus B — the system spine)
  // 230 V lane    Elosztó → RBX01 → RBX02          (the lighting string feeding every RoomBox), on the
  //               opposite side of the rooms, with its own penetration of the masonry spine ----
  const GH = 2400;
  route('chnToolStart', [at(board, GH), P(8714, 7258, GH), P(8714, 9050, GH), at(base, GH)]);
  route('chnToolStart', [at(base, GH), P(8714, 9050, GH), P(8714, 7258, GH), P(8714, 7008, GH), P(7604, 7008, GH), P(5907, 7044, GH),
    P(5907, 6106, GH), P(6011, 6106, GH), P(6011, 4500, GH), at(rbx1, GH)]);
  route('chnToolStart', [at(rbx1, GH), P(6011, 4500, GH), P(6011, 5850, GH), P(5607, 5850, GH), P(5607, 5225, GH), at(rbx2, GH)]);
  route('chnToolStart', [at(board, GH), P(8915, 7008, GH), P(10150, 7008, GH), P(10150, 3169, GH), P(7849, 3169, GH), P(7849, 4500, GH), at(rbx1, GH)]);
  const mainsChain = route('chnToolStart', [at(rbx1, GH), P(6011, 4500, GH), P(6011, 5400, GH), P(5607, 5400, GH), at(rbx2, GH)]);
  mainsChain.carrier = 'mains';                                 // RBX → RBX would read as CHANNEL; this one is the 230 V string

  // ---- the client's new endpoints (Order layer + notes + sheet r2), on their stack layers ----
  const M = 'sys:MAINS', E = {};
  const CEIL = 2700;
  // ceiling lamps
  [['L11', 1539, 6220], ['L12', 1531, 7659], ['L13', 5090, 7897],                       // nappali: window bay pair, coffee table
   ['L16', 6590, 6328], ['L17', 7243, 6330], ['L18', 7981, 6326], ['L19', 8789, 6324], ['L20', 9679, 6317], // étkező row
   ['L21', 9704, 5478], ['L25', 7906, 5405],                                             // L25 over the island
   ['L22', 9605, 4609], ['L23', 9016, 4109]].forEach(([k, x, y]) => { E[k] = ep('LMP', M, '230', free(x, y), CEIL); });
  // wall lamps
  E.L9 = ep('LMP', M, '230', onWall(1582, 2390), 1400);        // bedside, both sides of the bed
  E.L10 = ep('LMP', M, '230', onWall(3466, 2390), 1400);
  E.L14 = ep('LMP', M, '230', onWall(2684, 9050), 1900);       // nappali wall lamps
  E.L15 = ep('LMP', M, '230', onWall(3882, 9050), 1900);
  E.L24 = ep('LMP', M, '230', onWall(6452, 4300), 1900);       // mirror light
  E.L26 = ep('LMP', M, '230', onWall(8205, 7258), 1900);       // WC
  E.EV = ep('LMP', M, '230', onWall(7000, 3169), 2400, { ref: 'EV1', note: 'Elszívó ventilátor — RBX-kapcsolt 230 V kimenet (a katalógusban nincs ventilátor kód)' });
  // switches (BRIDGE inputs)
  E.K12 = ep('SWI', M, '230', onWall(1775, 2390), 1300);
  E.K13 = ep('SWI', M, '230', onWall(3664, 2390), 1300);
  E.K14 = ep('SWI', M, '230', onWall(1990, 5225), 1300);       // new door, nappali side, latch side
  E.K15 = ep('SWI', M, '230', onWall(1989, 4975), 1300);       // new door, szoba side
  // sockets
  const soc = (k, x, y, h, vk) => { E[k] = ep('SOC', M, vk || 's04', onWall(x, y), h); };
  soc('D26', 3924, 2390, 300); soc('D27', 4131, 2390, 300);            // szoba, bedside
  soc('D28', 2734, 4975, 300); soc('D29', 2957, 4975, 300);            // szoba, moved to the new door
  soc('D30', 2742, 5225, 300); soc('D31', 2966, 5225, 300);            // nappali, same partition
  soc('D24', 8678, 3169, 1100, '25'); soc('D25', 9274, 3169, 1100, '25'); soc('D24b', 9960, 3169, 1100, '25');  // worktop row
  soc('D32', 6011, 5765, 300, '25'); soc('D32b', 6011, 4877, 300, '25');                                          // fridge niche
  E.D35 = ep('SOC', M, '25', free(8902, 5300), 900, { note: 'Konyhasziget — pultba épített aljzat' });
  E.HOOD = ep('SOC', M, '25', free(8437, 5651), 2650, { note: 'Szigetelszívó csatlakozás a mennyezeten' });
  soc('D33', 5907, 3986, 1400, '25'); soc('D34', 5907, 4161, 1400, '25');                                        // bathroom, at the mirror
  E.CONV = ep('SOC', M, '25', onWall(6500, 3169), 300, { note: 'Fürdőszobai konvektor' });
  soc('D36', 8514, 7415, 300);                                                                                     // WC (bidé)
  // dedicated loads (bronze): kitchen + klíma + washing machine
  E.HOB = ep('DED', M, 'hob2l', free(8437, 5651), 900, { note: 'Indukciós főzőlap, sziget (2L+2N, K32)' });
  E.OVEN = ep('DED', M, 'g16', onWall(9570, 3169), 600, { note: 'Sütőtorony' });
  E.DW = ep('DED', M, 'g16', onWall(7849, 4100), 300, { note: 'Mosogatógép' });
  E.AC = ep('DED', M, 'g16', onWall(834, 8583), 2300, { note: 'Klíma beltéri egység' });
  E.WM = ep('DED', M, 'g16', onWall(5805, 2700), 1000, { note: 'Mosógép' });
  // shutters, 100 mm over each window head (900 sill + 1500)
  [['SHU_N', 834, 7020], ['SHU_S', 834, 3443], ['SHU_K', 10150, 4014], ['SHU_E', 10150, 6121]].forEach(([k, x, y]) => { E[k] = ep('SHU', M, '230', onWall(x, y), 2500); });
  // LV: LED lines in the bathroom walls (shower wall, new wall) and beside the stair
  E.LED1 = ep('LNR', 'sys:LV', 'rov', onWall(7599, 3750), 1600, { note: 'LED a zuhany falában' });
  E.LED2 = ep('LNR', 'sys:LV', 'rov', onWall(7400, 4300), 2100, { note: 'LED az új fürdőfalban' });
  E.LED3 = ep('LNR', 'sys:LV', 'rov', onWall(7604, 8300), 400, { note: 'LED-sor a lépcső mellett' });
  // bus B: the orientation light in the corridor half
  E.NL = ep('LMP', 'sys:BUSB', 'b', onWall(8100, 7008), 300, { note: 'Tájékozódó (jelző) lámpa — közlekedő' });
  // data: TV + internet points
  E.TV_N = ep('ETH', 'sys:DATA', '2', onWall(1890, 9050), 300, { note: 'TV + internet — nappali' });
  E.TV_S = ep('ETH', 'sys:DATA', '2', onWall(2300, 4975), 300, { note: 'TV + internet — szoba, az új ajtónál' });

  // ---- control groups (BRIDGE: the switch is an input, the lamp group an output) ----
  E.K12.ctl = [E.L9.id]; E.K13.ctl = [E.L10.id];
  E.K14.ctl = [E.L11.id, E.L12.id, E.L13.id, E.L14.id, E.L15.id];

  // ---- circuits: one lighting string through every RBX, socket strings per room, the dedicated ways ----
  const ck = (name, members, o) => w.cktCreate(Object.assign({ name, members: members.map(d => d.id) }, o || {}));
  ck('Világítás — lakás (RBX01 → RBX02)', [rbx1, rbx2], { mcb: '1C 10A' });
  ck('R03 konyha — pult', [E.D24, E.D25, E.D24b, E.HOOD], { mcb: '1C 16A' });
  ck('R03 konyha — sziget + hűtőfülke', [E.D35, E.D32, E.D32b], { mcb: '1C 16A' });
  ck('R06 nappali dugalj', [E.D30, E.D31], { mcb: '1C 13A' });
  ck('R07 szoba dugalj', [E.D26, E.D27, E.D28, E.D29], { mcb: '1C 13A' });
  ck('R08 fürdő dugalj', [E.D33, E.D34, E.CONV], { mcb: '1C 16A' });
  ck('R01 · R04 · R05 általános dugalj', [E.D36], { mcb: '1C 13A' });
  ck('Indukciós főzőlap (2L+2N, két RCBO)', [E.HOB], { dedicated: true, mcb: '1P-N C16A' });
  ck('Sütőtorony', [E.OVEN], { dedicated: true, mcb: '1C 16A' });
  ck('Mosogatógép', [E.DW], { dedicated: true, mcb: '1C 16A' });
  ck('Klíma', [E.AC], { dedicated: true, mcb: '1C 16A' });
  ck('Mosógép', [E.WM], { dedicated: true, mcb: '1C 16A' });

  // ---- a 10 × 10 kötődoboz at the upper latch-side corner of every portal ----
  const armL = w.stkLayer(S.id, 'arm').id;
  // Where the box fits, in this order: latch side on the face of the room the door leads into (the switch
  // column rises there) · hinge side, same face · latch, then hinge on the other room's face. "Fits" = a
  // probe 60 mm past the face, beside the box, lies inside that room: a box cannot sit in a wall corner
  // (P33's entrance → L-room jamb) or beyond a room narrower than its door (the kamra).
  const fits = (Dd, p, roomRec) => {
    if (!p) return false;
    const k = w.wallInfo(Dd.r).thick / 2 + 60, inR = (dx) => w.pointInPoly(p.x + Dd.n[0] * k + Dd.d[0] * dx, p.y + Dd.n[1] * k + Dd.d[1] * dx, roomRec.poly);
    return inR(60) && inR(-60);
  };
  portals.forEach(([id, , into], i) => {
    const o = op(id), rooms2 = w.mrkDoorRooms(o).filter(Boolean).map(e => e.rm), other = rooms2.find(r => r.id !== R[into].id);
    let p = null;
    for (const rm of [R[into], other].filter(Boolean)) {
      const Dd = w.sugDoor(o, rm.id);
      for (const s of [1, -1]) { const q = w.sugDoorPt(Dd, s * Dd.hd * (Dd.w + 150), 2300, s > 0 ? 'portál doboz' : 'portál doboz (zsanér felől)'); if (fits(Dd, q, rm)) { p = q; p.room = rm; break; } }
      if (p) break;
    }
    if (!p) throw new Error('no portal box point for ' + id);
    D().devices.push({ type: 'junction', jbShape: 'rect', jbSize: 100, level: LVL, x: p.x, y: p.y, h: 2300,
      side: p.side > 0 ? 1 : 0, layer: armL, ref: 'PD' + (i + 1), note: 'Portál doboz 10 × 10 — ' + id + ', ' + p.room.name + ' felőli oldal' + (p.why.indexOf('zsanér') >= 0 ? ', zsanér felől' : '') });
  });
  w.ensureIds(D());
  return { S, R, board, base, rbx1, rbx2, E };
}

// ---- save as the Planner's own download format ----
function save(file, name) {
  const payload = { format: 'varler-planner', version: 1, name, saved: new Date().toISOString(), project: w.sessionObj() };
  fs.writeFileSync(file, JSON.stringify(payload, null, 2));
}
// what the stack's own stage checks say (warnings and errors only), and validate()'s errors
function report(S) {
  const checks = [];
  w.stkStages(S).forEach(st => { try { (st.check() || []).forEach(c => { if (c.sev === 'warn' || c.sev === 'error') checks.push(st.k + ' · ' + c.sev + ' · ' + c.msg); }); } catch (e) { checks.push(st.k + ' · THREW · ' + e.message); } });
  return { unserved: w.hwUnserved(LVL).map(r => r.name || r.id), checks, validateErrors: w.validate().filter(x => x.sev === 'error') };
}

setTimeout(() => {
  try {
    if (MODE === 'v1') {
      const src = JSON.parse(fs.readFileSync(IN, 'utf8'));
      const r = buildV1(src);
      save(OUT, 'P33 teszt v1');
      const d = D();
      console.log(`v1: ${w.__getWalls()[LVL].length} walls · ${d.floors.length} rooms · ${d.openings.length} openings · ${d.devices.length} devices · ${d.paths.length} golden routes · ${d.circuits.length} circuits · ${d.marks.length} marks`);
      console.log(JSON.stringify(report(r.S), null, 1));
    } else {
      require('./p33-teszt-v2.js')({ w, fs, IN, OUT, LVL, D, T, onWall, free, ep, route, at, P, mark, save, report, sideToward });
    }
  } catch (e) { console.error(e.stack); process.exitCode = 1; }
  w.close();
}, 900);
