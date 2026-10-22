#!/usr/bin/env node
// cla.v2.js — CLA v2: v1 fully built + every further BRIDGE layer PREPARED (GO-V2.md, 2026-10-12)
//   node tools/baseline/cla.v2.js <in.vplan.json> <outDir> <v1 offer.json>
// Survey precision: the SELV layers are routed by selv.js (the data algorithm, one run per layer); the items the
// sketch does not draw (CHANNEL, 230 V feeds, V1 riser, media wall, security) are measured on the same wall graph.
// Writes V2_FELMERES.md · v2_mennyisegek.json · v2_legs.csv. Prices: v1 offer.json unit prices where they exist,
// new ones marked ●○○ with their source. The fair-price calculation proper is the Workflow Kit's (V2_FELADAT.md).
'use strict';
const fs = require('fs'), path = require('path');
const [, , inFile, outDir, offerFile] = process.argv;
if (!inFile || !outDir || !offerFile) { console.error('usage: cla.v2.js <in.vplan.json> <outDir> <v1 offer.json>'); process.exit(2); }
process.argv = [process.argv[0], 'run.js', inFile, path.join(require('os').tmpdir(), 'clav2-v1')];
const ctx = require('./run'), { G, E, PT, R, cfg, allowed } = ctx;
const S = require('./selv'), DATA = require('./data'), geom = require('./geom'), RU = require('./rules');
const OFFER = JSON.parse(fs.readFileSync(offerFile, 'utf8'));
const fmt = n => (n < 0 ? '-' : '') + String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ' '), m1 = n => (+n).toFixed(1).replace('.', ',');

// ======================= decisions (user, 2026-10-12) =======================
// Q1 "Kettő M és egy H prioritás szerint": load = SELV endpoints + v1 data ports + nearest lamps/shutters →
//    RBXM 30 · RBX03 21 · RBX06 15 → RBXM = RB-H, RBX03 and RBX06 = RB-M (the media wall's C2 still goes to RBX06)
// Q2 V1 riser: conduits now, no cable · Q3 230 V to the niches: cable + MCB · Q4 security: minimal prep
const RBX = {
  D372: { ref: 'RBXM', cls: 'RB-H', size: '600 × 600 × 120', bundle: ['C3', 'C4', 'C4b', 'C5'] },
  D369: { ref: 'RBX03', cls: 'RB-M', size: '400 × 500 × 110', bundle: ['C3', 'C4', 'C4b'] },
  D371: { ref: 'RBX06', cls: 'RB-M', size: '400 × 500 × 110', bundle: ['C2', 'C3', 'C4', 'C4b'] } };
const CH = { C1: null /* v1: 2 × Cat6A */, C2: { cond: 'M40', cab: 'CAT6AS', n: 'MÉDIA (HDMI AOC később + Cat6A most)' },
  C3: { cond: 'M20', cab: 'CAT6AS', n: 'VEZÉRLÉS (BRIDGE_LINK, RS-485)' }, C4: { cond: 'M25', cab: null, n: 'tartalék (üres + behúzószál)' },
  C4b: { cond: 'M20', cab: 'H2x25', n: 'B busz (biztosított 24 V)' }, C5: { cond: 'M20', cab: null, n: 'KNX / DALI-tartalék (üres + behúzószál)' } };

const LAYERS = [
  { id: 'CONTROL', hu: 'Vezérlés — portálok RS-485', match: e => e.role === 'sys:CONTROL', cable: () => 'CAT6AS', minCond: 'M20', perPipe: 2 },
  { id: 'SENSOR', hu: 'Érzékelők', match: e => e.role === 'sys:SENSOR', perPipe: 3,
    cable: e => e.code === 'POR' ? 'LIYCY6' : e.v === 'thermal' ? 'CAT6AS' : e.v === 'leak' ? 'LIYY2' : 'LIYCY4' },
  { id: 'BUSB', hu: 'B busz — értesítő fény, lábfény (biztosított 24 V)', match: e => e.role === 'sys:BUSB', cable: () => 'H2x15', perPipe: 2 },
  { id: 'LV', hu: 'LV A busz — LED-vonalak', match: e => e.role === 'sys:LV', cable: () => 'H2x15', minCond: 'M20', perPipe: 2 },
  { id: 'HMI', hu: 'Kezelők — panel, termosztát', match: e => e.role === 'sys:HMI', cable: e => e.code === 'PAN' ? 'CAT6AS' : 'JYSTY2', perPipe: 2 },
  { id: 'MEDIA', hu: 'Média — hangszórók', match: e => e.role === 'sys:MEDIA', cable: () => 'SPK2x15', perPipe: 2 } ];
// the touch panels also take an LV pair (STD-001-A2 step 10): one more cable in the LV layer, from the same RBX
const PAN_LV = true;

// ======================= unit prices (net Ft) =======================
// v1 = job/offer.json (VG-2026-CLA-01) · ●○○ = new, web 2026-10-12 or estimate (see SRC)
const MAT = {
  CAT6AS: [520, 'm', 'v1 Cat6A egységár (web: Gembird S/FTP LSZH 275 Ft/m, márkás drágább) ●○○'],
  LIYCY4: [420, 'm', 'web: argep LiYCY 393–413 Ft/m, Bürklin 1,56–1,98 €/m ●○○'],
  LIYCY6: [430, 'm', 'web: argep LiYCY 393–413 Ft/m ●○○'],
  LIYY2: [160, 'm', 'becslés (argep YSLY-JZ 4×0,5 199 Ft/m) ●○○'],
  JYSTY2: [240, 'm', 'web: argep J-Y(St)Y 2×2×0,8 227–239 Ft/m ●●○'],
  H2x15: [230, 'm', 'Inventory VRG-0203 H05VV-F 3×1,5 (299) × 2/3 + kerekítés ●○○'],
  H2x25: [360, 'm', 'Inventory VRG-0203 alapján, 2,5 mm² ●○○'],
  SPK2x15: [450, 'm', 'becslés, épületbe szerelhető OFC (RS 1 065 Ft/m a felső határ) ●○○'],
  NYM3x15: [340, 'm', 'v1'], NYM3x25: [520, 'm', 'v1'],
  M16: [90, 'm', 'Inventory VRG-0023 (79 Ft/m) ●●○'], M20: [170, 'm', 'v1'], M25: [250, 'm', 'v1'], M32: [260, 'm', 'v1'],
  M40: [480, 'm', 'v1'], M63: [900, 'm', 'web: argep 63 mm 179–2 400 Ft/m ●○○'],
  cord: [40, 'm', 'behúzószál, becslés ●○○'],
  box68: [110, 'db', 'v1 (VRG-0100)'], box2: [220, 'db', 'v1 (sorolt 2-es)'], box100: [870, 'db', 'v1'], box150: [1100, 'db', 'v1'],
  box1510: [1500, 'db', 'médiadoboz 15×10 süllyesztett, becslés ●○○'],
  coverH: [6000, 'db', 'fülke ideiglenes fedlap + keret RB-H, becslés ●○○'], coverM: [4500, 'db', 'fülke fedlap RB-M, becslés ●○○'],
  coverS: [3000, 'db', 'fülke fedlap SSC, becslés ●○○'],
  firestop: [5000, 'db', 'tűzgátló habarcs / mandzsetta, becslés ●○○'],
  mcb: [1300, 'db', 'v1 (Easy9 1C 13/16 A)'], label: [60, 'db', 'kábeljelölő, becslés ●○○'],
  gipsz: [2100, 'zsák', 'v1 (10 kg, 0,7 kg/m + 0,3 kg/doboz)'] };
const LAB = {
  chaseNew: [1900, 'm', 'v1 horony vízszintes'], chaseBeside: [1400, 'm', 'v1 horony × 0,75 — a v1 erősáramú horony mellett: ugyanaz a kitűzés, porvédelem, létra ●○○'],
  chaseShared: [650, 'm', 'v1 horony × 0,35 — a v1 adathorony szélesítése: egy vágás + kivésés, kitűzés nélkül ●○○'],
  chaseMainsWiden: [650, 'm', 'v1 horony × 0,35 — a v1 gerinchorony szélesítése az új 230 V-os körökhöz ●○○'],
  chaseVert: [1800, 'm', 'v1 horony függőleges'], chaseCeil: [2800, 'm', 'v1 mennyezeti horony'],
  hole68: [2200, 'db', 'v1 ⌀68 dobozhely'], nest100: [3400, 'db', 'v1 fészek 100×100 / 2-es'],
  boxSet: [840, 'db', 'v1 doboz beépítése'],
  condFirst: [660, 'm', 'v1 védőcső fektetése (az első cső a horonyban)'],
  condMore: [400, 'm', 'v1 × 0,6 — további cső ugyanabba a horonyba, ugyanabban a menetben ●○○'],
  pullSmall: [180, 'm', 'v1 kábelbehúzás (NYM) — vékony SELV-kábelek'], pullCat: [400, 'm', 'Cat6A behúzás végződtetés nélkül (v1 960 Ft/m végződtetéssel) ●○○'],
  pullMore: [0.5, '×', 'ugyanabba a csőbe, ugyanabban a behúzásban a 2. és további kábel: 50 % ●○○'],
  cordPull: [100, 'm', 'behúzószál üres csőbe, becslés ●○○'],
  cableEnd: [400, 'db', 'kábelvég: jelölés, tartalékhurok, védősapka — végződtetés nélkül ●○○'],
  nicheH: [42500, 'db', 'v1 elosztó-fészek (30 000, 3,5 h) × 600×600 / 5 h ●○○'], nicheM: [30000, 'db', 'v1 elosztó-fészek ●○○'],
  nicheS: [20000, 'db', 'SSC-fészek 300×400, becslés ●○○'], baseEntry: [12000, 'db', 'BASE kábelbevezetés a bútor mögött (150×150 + fészek) ●○○'],
  cover: [2500, 'db', 'fülke lezárása ideiglenes fedlappal ●○○'],
  wallX: [2200, 'db', 'v1 falátvezetés'], wallXMore: [1000, 'db', 'további réteg ugyanazon az átvezetésen ●○○'],
  slabBundle: [15000, 'db', 'födémáttörés a köteghez (⌀ ~110), v1 8 500 × méret ●○○'], slabMains: [8500, 'db', 'v1 födémáttörés'],
  firestop: [4000, 'db', 'tűzgátlás beépítése ●○○'],
  feedEnd: [2800, 'db', 'v1 dedikált kiállás — védett 230 V-os kiállás a fülkében'], module: [1700, 'modul', 'v1 DIN modul'],
  restoreNew: [690, 'm', 'v1 helyreállítás gipsszel'], restoreShared: [350, 'm', 'v1 × 0,5 — csak a szélesítés ●○○'] };

// ======================= 1. the SELV layers, routed =======================
if (PAN_LV) LAYERS.find(l => l.id === 'LV').match = e => e.role === 'sys:LV' || (e.role === 'sys:HMI' && e.code === 'PAN');
const runs = LAYERS.map(l => S.routeLayer(G, E, PT, cfg, allowed, l));
const v1Data = DATA.planData(G, E, PT, cfg, allowed);

// ======================= 2. fixed items on the wall graph =======================
const dev = t => G.D.devices.find(d => d.type === t), base = dev('base'), board = dev('board');
const riserLeg = R.legs.find(l => l.kind === 'riser'), RZ = riserLeg.poly[0];
const door = E.find(e => e.portal === 'B107' && e.code === 'PAN');
const P = (id, x, y, h, room) => S.pointAt(G, geom, id, x, y, h, room);
const fromBase = S.starLengths(G, E, PT, cfg, allowed, base, [P('RISER', RZ[0], RZ[1], 2700, 'R03'), P('DOOR', door.x, door.y, 2200, 'R01')]);
const fromBoard = S.starLengths(G, E, PT, cfg, allowed, board, [P('RISER', RZ[0], RZ[1], 2700, 'R03'), P('BASEPT', base.x, base.y, 900, 'R03')]);
const BAND = 2700, VBASE = (BAND - (base.h || 900)) / 1000, VRBX = (BAND - 2150) / 1000, VBOARD = (2600 - 2000) / 1000;
const VRISER = (cfg.ceiling + 300 - 2600) / 1000 + 0.5;                      // through the slab + a stub on the upper floor
const polyOf = (pth, layer) => ({ layer, poly: pth.map(([x, y]) => [x, y, BAND]) });
const extra = [];                                                            // conduits with fixed lengths
const X = (grp, name, cond, m, cab, n = 1, note = '') => extra.push({ grp, name, cond, m: +m.toFixed(1), cab, n, note });
const extraPolys = [];
Object.entries(RBX).forEach(([id, r]) => { const s = fromBase[id], L = s.len / 1000 + VBASE + VRBX; extraPolys.push(polyOf(s.path, 'CHANNEL'));
  r.chM = +L.toFixed(1); r.bundle.forEach(c => X('CHANNEL', `${r.ref} — ${c} ${CH[c].n}`, CH[c].cond, L, CH[c].cab)); });
// the bus B pack (K27: in the kamra, beside the V1 riser) → BASE, then into every C4b
const packM = fromBase.RISER.len / 1000 + VBASE + 0.5; extraPolys.push(polyOf(fromBase.RISER.path, 'BUSB'));
X('BUSB-PACK', 'B busz akku (kamra) → BASE', 'M20', packM, 'H2x25');
// PANEL LINK: the Elosztó's metering row → BASE (BUILD-001 T1), data only
const panelM = fromBoard.BASEPT.len / 1000 + VBOARD + 0.6 + VBASE;
X('PANEL', 'PANEL LINK — Elosztó → BASE (körönkénti energiamérés)', 'M20', panelM, 'CAT6AS');
// V1 riser: the full CHANNEL bundle BASE → riser → upper floor, empty (Q2) + 2 + 1 MAINS sleeves from the Elosztó
const riserM = fromBase.RISER.len / 1000 + VBASE + VRISER;
['C1:M25', 'C2:M40', 'C3:M20', 'C4:M25', 'C4b:M20', 'C5:M20'].forEach(s => { const [c, k] = s.split(':'); X('RISER', `V1 felszálló — ${c}`, k, riserM, null); });
const riserMainsM = fromBoard.RISER.len / 1000 + VBOARD + VRISER;
for (let k = 0; k < 3; k++) X('RISER-MAINS', `V1 erősáramú hüvely ${k + 1}/3 (Elosztó → emelet)`, 'M25', riserMainsM, null);
// media wall (K33, STD-001-A2 §6) — onward from RBX06 to the AV position; the build-out itself is not ours
X('MEDIAWALL', 'C2 tovább: RBX06 → AV-hely', 'M40', 2.0, null, 1, 'HDMI AOC később');
X('MEDIAWALL', 'Médiafal-útvonal: képernyődoboz ↔ bútordoboz', 'M63', 1.5, null);
X('MEDIAWALL', 'Elöl L · C · R hangszóró az AV-helyről', 'M16', 3.0, 'SPK2x15', 3);
X('MEDIAWALL', 'Mélysugárzó vonal a padlópozícióig', 'M20', 2.5, null);
X('MEDIAWALL', 'Átvezetés a szoba (R07) TV-egységéhez', 'M40', 0.3, null);
// security, minimal (Q4): SSC beside the BASE, an empty trunk to the BASE, the entrance contact and a siren
// the SSC (user, 2026-10-12: "hátrébb, inkább nappali vagy a háló") → the bedroom's wardrobe, W12, behind the
// wardrobe (RESEARCH-001 D-01 named this corner as an SSC candidate) — the deepest, most hidden spot of the flat
const SSC = { id: 'SSC', type: 'ssc', ref: 'SSC', level: G.level, x: 5327, y: 6800, h: 1500, room: 'R07' };
const VSSC = (BAND - (SSC.h + 200)) / 1000;                                 // the niche's top → the band
const opening = id => G.D.openings.find(o => o.id === id);
const SEC_PTS = {                                                           // where the security points sit
  BASEPT: [base.x, base.y, 900, 'R03'], DOOR: [opening('B107').x, opening('B107').y, 2200, 'R01'], SIREN: [opening('B107').x, opening('B107').y + 700, 2600, 'R01'] };
const SEC_OPT = {                                                           // the full layer (option): contacts, detectors, keypad, inner siren
  W_B112: [opening('B112').x, opening('B112').y, 2200, 'R06', 'ablakkontakt B112 (nappali)'], W_B113: [opening('B113').x, opening('B113').y, 2200, 'R07', 'ablakkontakt B113 (szoba)'],
  W_B114: [opening('B114').x, opening('B114').y, 2200, 'R03', 'ablakkontakt B114 (konyha)'], W_B115: [opening('B115').x, opening('B115').y, 2200, 'R03', 'ablakkontakt B115 (étkező)'],
  PIR_R01: [1502, 3286, 2400, 'R01', 'mozgásérzékelő — előszoba'], PIR_R03: [1935, 6137, 2400, 'R03', 'mozgásérzékelő — konyha · étkező'],
  PIR_R06: [7714, 4303, 2400, 'R06', 'mozgásérzékelő — nappali'], PIR_R07: [8149, 8295, 2400, 'R07', 'mozgásérzékelő — szoba'],
  KEYPAD: [door.x, door.y + 400, 1450, 'R01', 'kezelő (keypad) a bejáratnál'], ISIREN: [1935, 5200, 2400, 'R03', 'beltéri sziréna — étkező'] };
const toPt = (k, a) => { const nf = geom.nearestFace(G, a[0], a[1], a[3]); return P(k, nf.x, nf.y, a[2], a[3]); };
const fromSSC = S.starLengths(G, E, PT, cfg, allowed, SSC, Object.entries(Object.assign({}, SEC_PTS, SEC_OPT)).map(([k, a]) => toPt(k, a)));
const secM = k => fromSSC[k].len / 1000 + VSSC + Math.abs(BAND - (SEC_PTS[k] || SEC_OPT[k])[2]) / 1000;
['BASEPT', 'DOOR', 'SIREN'].forEach(k => extraPolys.push(polyOf(fromSSC[k].path, 'SECURITY')));
X('SECURITY', 'SSC (szoba, gardrób) → BASE (szolgáltatói IP-modul, VLAN 50)', 'M25', secM('BASEPT') - Math.abs(BAND - 900) / 1000 + VBASE, null);
X('SECURITY', 'SSC → bejárati ajtókontakt (B107)', 'M16', secM('DOOR'), null);
X('SECURITY', 'SSC → sziréna (külső fal a bejáratnál)', 'M16', secM('SIREN'), null);
// 230 V feeds of the niches (Q3): cable + MCB; along the v1 trunk (the mains chase gets wider), never in the SELV chase
const FEEDS = [
  { n: 'BASE 1. kör (C16)', to: 'BASEPT', cab: 'NYM3x25', cond: 'M32', share: 'BASE2' }, { n: 'BASE 2. kör, távműködtethető helyre (C16)', to: 'BASEPT', cab: 'NYM3x25', cond: null, shareOf: 'BASE2' },
  { n: 'RBXM (RB-H) tápja (C10)', to: 'D372', cab: 'NYM3x15', cond: 'M20' }, { n: 'RBX03 tápja (C10)', to: 'D369', cab: 'NYM3x15', cond: 'M20' },
  { n: 'RBX06 tápja (C10)', to: 'D371', cab: 'NYM3x15', cond: 'M20' }, { n: 'B busz akku (kamra) tápja (C10)', to: 'RISER', cab: 'NYM3x15', cond: 'M20' } ];
FEEDS.forEach(f => { const s = fromBoard[f.to]; f.m = +((s.len / 1000) + VBOARD + (f.to === 'BASEPT' ? (2600 - 900) / 1000 : 0.5)).toFixed(1); });

// ======================= 3. quantities =======================
const Q = { cond: {}, condByLayer: {}, cab: {}, cabByLayer: {}, ends: 0, cords: 0, boxes: {}, layers: [] };
const addC = (layer, k, m) => { Q.cond[k] = (Q.cond[k] || 0) + m; const o = Q.condByLayer[layer] = Q.condByLayer[layer] || {}; o[k] = (o[k] || 0) + m; };
const addK = (layer, k, m) => { Q.cab[k] = (Q.cab[k] || 0) + m; const o = Q.cabByLayer[layer] = Q.cabByLayer[layer] || {}; o[k] = (o[k] || 0) + m; };
let pull = { small: 0, cat: 0, smallMore: 0, catMore: 0 };
const pulled = (k, m, first) => { const cat = k === 'CAT6AS'; if (first) pull[cat ? 'cat' : 'small'] += m; else pull[cat ? 'catMore' : 'smallMore'] += m; };
const LOOP = { src: 1.5, ep: 0.3 };                                          // service loop at the RBX / BASE end, at the endpoint
runs.forEach(r => {
  r.legs.forEach(l => l.pipes.forEach(p => { addC(r.L.id, p.cond, l.len / 1000);
    let first = true; p.cables.forEach(c => { for (let i = 0; i < c.n; i++) { addK(r.L.id, c.c, l.len / 1000 * 1.1); pulled(c.c, l.len / 1000 * 1.1, first); first = false; } }); }));
  r.EP.forEach(e => { addK(r.L.id, e.cable, LOOP.src + LOOP.ep); pulled(e.cable, LOOP.src + LOOP.ep, true); });
  Q.ends += r.EP.length * 2; });
extra.forEach(x => { addC(x.grp, x.cond, x.m * x.n);
  if (x.cab) { addK(x.grp, x.cab, (x.m * 1.1 + 2 * LOOP.src) * x.n); for (let i = 0; i < x.n; i++) pulled(x.cab, x.m * 1.1 + 2 * LOOP.src, true); Q.ends += 2 * x.n; }
  else Q.cords += x.m * x.n; });
FEEDS.forEach(f => { if (f.cond) addC('MAINS230', f.cond, f.m); addK('MAINS230', f.cab, f.m * 1.1 + 1); pulled('NYM', f.m * 1.1 + 1, !!f.cond); });
Object.keys(Q.cond).forEach(k => Q.cond[k] = +Q.cond[k].toFixed(1)); Object.keys(Q.cab).forEach(k => Q.cab[k] = +Q.cab[k].toFixed(1));

// boxes and niches
const epBoxes = runs.reduce((s, r) => s + r.EP.length, 0) - (PAN_LV ? 3 : 0);  // a panel's LV pair ends in the panel's own box
const panBoxes = E.filter(e => e.role === 'sys:HMI' && e.code === 'PAN').length;
Q.boxes = { box68: epBoxes - panBoxes + 2 /* security: contact + siren */, box2: panBoxes,
  box100: runs.reduce((s, r) => s + r.boxes.filter(b => b.size !== 'tee-L').length, 0) + 1 /* R07 TV box */,
  box150: runs.reduce((s, r) => s + r.boxes.filter(b => b.size === 'tee-L').length, 0) + 1 /* V1 inspection box */,
  box1510: 2 /* media wall: screen + furniture */, nicheH: 1, nicheM: 2, nicheS: 1, baseEntry: 1 };
// wall crossings: one hole per service point, a second layer through the same hole costs less
const xs = {}; runs.forEach(r => r.cross.forEach(sp => (xs[sp] = xs[sp] || new Set()).add(r.L.id)));
// (the SELV runs cross walls through the RBX / BASE niches themselves — the sketch's BASE "acts also as a wall crossing")
Q.wallX = Object.keys(xs).length + 1 /* media sleeve to R07 */ + 1 /* siren, outer wall */; Q.wallXMore = Object.values(xs).reduce((s, c) => s + c.size - 1, 0);
Q.wallXAt = Object.fromEntries(Object.entries(xs).map(([k, v]) => [k, [...v]]));
const CHASE = S.chase(runs, v1Data.legs, R.legs, extraPolys), VERT = S.verticals(runs);
VERT.m = +(VERT.m + 1.5 /* media route M63 vertical */ + VSSC + (BAND - 2200 + BAND - 2600) / 1000 /* SSC column, contact + siren drops */).toFixed(1);
Q.chase = CHASE.m; Q.vert = VERT.m; Q.ceil = VERT.ceilM; Q.cols = VERT.cols.length + 3;
Q.mainsWiden = +(FEEDS.filter(f => f.cond).reduce((s, f) => s + f.m, 0) / 2 + riserMainsM).toFixed(1);   // the trunk groove, widened once per route
Q.condTotal = +Object.values(Q.cond).reduce((s, v) => s + v, 0).toFixed(1);
Q.chaseH = +(CHASE.m.kozos + CHASE.m.mellett + CHASE.m.uj).toFixed(1);
Q.firstCond = +(CHASE.m.mellett + CHASE.m.uj + VERT.m + VERT.ceilM).toFixed(1);
const ep = { total: runs.reduce((s, r) => s + r.EP.length, 0) - (PAN_LV ? 3 : 0), byLayer: Object.fromEntries(runs.map(r => [r.L.id, r.EP.length])) };

// ======================= 4. prices =======================
const matLines = [], labLines = [];
const ML = (grp, name, qty, key, unitOverride, unitOv, srcOv) => { const [u, unit, src] = MAT[key]; const up = unitOverride || u; const q = Math.ceil(qty);
  if (q > 0) matLines.push({ grp, name, qty: q, unit: unitOv || unit, unitPrice: up, total: q * up, src: srcOv || src }); };
// FULL: the unit price the same metre would cost as a new route — the reference for the shared-route discount
const FULL = { chaseShared: 1900, chaseBeside: 1900, chaseMainsWiden: 1900, condMore: 660, restoreShared: 690 };
const LL = (grp, name, qty, key, note) => { const [u, unit, src] = LAB[key]; const q = Math.round(qty * 10) / 10;
  if (q > 0) labLines.push({ grp, name, qty: q, unit, unitPrice: u, total: Math.round(q * u), full: Math.round(q * (FULL[key] || u)), src, note: note || '' }); };
// material: cable rounded up to 10 m, conduit to 5 m
const up = (v, s) => Math.ceil(v / s) * s;
Object.entries(Q.cab).forEach(([k, m]) => ML('Kábel', (RU.CABLES[k] || { n: k }).n, up(m, 10), k));
Object.entries(Q.cond).forEach(([k, m]) => ML('Védőcső', 'Gégecső ' + k, up(m, 5), k));
ML('Védőcső', 'Behúzószál az üres csövekbe', up(Q.cords, 10), 'cord');
ML('Védőcső', 'Gégecső toldók, csőcsatlakozók (v1 arányában)', 1, 'cord', Math.round(4500 * Q.condTotal / 339 / 100) * 100, 'klt', 'v1 (4 500 Ft / 339 m) × a csőhossz aránya ●○○');
ML('Doboz', 'Szerelvénydoboz ⌀68, 66 mm mély (végpontok, biztonsági pontok)', Q.boxes.box68, 'box68');
ML('Doboz', 'Sorolt 2-es mélydoboz (érintőpanelek)', Q.boxes.box2, 'box2');
ML('Doboz', 'Kötő- / húzódoboz 100×100 fedéllel (rétegenként külön; R07 TV-doboz)', Q.boxes.box100, 'box100');
ML('Doboz', 'Doboz 150×150 (nagy elágazás; V1 felszálló ellenőrződoboza)', Q.boxes.box150, 'box150');
ML('Doboz', 'Médiadoboz 15×10 (képernyő, bútor)', Q.boxes.box1510, 'box1510');
ML('Fülke', 'RB-H fülke ideiglenes fedlappal (RBXM)', 1, 'coverH'); ML('Fülke', 'RB-M fülke ideiglenes fedlappal (RBX03, RBX06)', 2, 'coverM');
ML('Fülke', 'SSC-fülke ideiglenes fedlappal', 1, 'coverS');
ML('Felszálló', 'Tűzgátlás a födémátvezetésekben', 2, 'firestop');
ML('Elosztó', 'Kismegszakító 1 modul (6 új kör: BASE ×2, RBX ×3, B busz akku)', 6, 'mcb');
ML('Egyéb', 'Kábeljelölők (mindkét végén)', Q.ends + 12, 'label');
ML('Egyéb', 'Gipsz stukatúr 10 kg', up((Q.firstCond * 0.7 + CHASE.m.kozos * 0.35 + (Q.boxes.box68 + Q.boxes.box2 + Q.boxes.box100 + Q.boxes.box150) * 0.3 + 4 * 6) / 10, 1), 'gipsz');
const matNet = matLines.reduce((s, l) => s + l.total, 0), handling = Math.round(matNet * 0.1 / 1000) * 1000;
const matTotal = Math.round((matNet + handling) / 1000) * 1000;
// labour
LL('Horony', 'Horony — a v1 adathorony szélesítése (közös útvonal)', CHASE.m.kozos, 'chaseShared', 'a horony már megvan, csak szélesebb lesz');
LL('Horony', 'Horony — új, a v1 erősáramú horony mellett (2700)', CHASE.m.mellett, 'chaseBeside', 'ugyanabban a menetben, mint a v1');
LL('Horony', 'Horony — teljesen új szakasz', CHASE.m.uj, 'chaseNew');
LL('Horony', `Függőleges horony — ${Q.cols} oszlop (portálok kilincs-ellenoldala, végpontok)`, VERT.m, 'chaseVert');
LL('Horony', 'Mennyezeti horony (mennyezeti hangszóró, érzékelő)', VERT.ceilM, 'chaseCeil');
LL('Horony', 'A v1 gerinchorony szélesítése (6 új 230 V-os kör + 3 emeleti hüvely)', Q.mainsWiden, 'chaseMainsWiden');
LL('Fészek', 'Dobozhely ⌀68 (végpontok, biztonsági pontok)', Q.boxes.box68, 'hole68');
LL('Fészek', 'Fészek 2-es / 100×100 / 150×150 / 15×10', Q.boxes.box2 + Q.boxes.box100 + Q.boxes.box150 + Q.boxes.box1510, 'nest100');
LL('Fészek', 'Dobozok beépítése, gipszbe ágyazása, csőcsatlakozás', Q.boxes.box68 + Q.boxes.box2 + Q.boxes.box100 + Q.boxes.box150 + Q.boxes.box1510, 'boxSet');
LL('Fülke', 'RB-H fülke kivésése 600 × 600 × 120 (RBXM)', 1, 'nicheH'); LL('Fülke', 'RB-M fülke kivésése 400 × 500 × 110 (RBX03, RBX06)', 2, 'nicheM', 'az RBX03 az új fürdőfalban: ha a kőműves kihagyja a helyét, olcsóbb');
LL('Fülke', 'SSC-fülke 300 × 400 (biztonsági szolgáltató)', 1, 'nicheS'); LL('Fülke', 'BASE: kábelbevezetés a beépített bútor mögött', 1, 'baseEntry', 'a bútor nem része');
LL('Fülke', 'Fülkék lezárása ideiglenes fedlappal', 4, 'cover');
LL('Átvezetés', 'Falátvezetés (médiaátvezetés az R07-be, szirénakivezetés; a SELV-rétegek az RBX- és BASE-fülkéken át mennek)', Q.wallX, 'wallX');
LL('Átvezetés', 'További réteg ugyanazon az átvezetésen / médiaátvezetés', Q.wallXMore, 'wallXMore');
LL('Átvezetés', 'Födémáttörés — V1 felszálló köteg', 1, 'slabBundle'); LL('Átvezetés', 'Födémáttörés — erősáramú hüvelyek', 1, 'slabMains');
LL('Átvezetés', 'Tűzgátlás beépítése', 2, 'firestop');
LL('Cső', 'Védőcső fektetése — az első cső az új horonyban', Q.firstCond, 'condFirst');
LL('Cső', 'Védőcső fektetése — további csövek ugyanabban a horonyban (közös útvonal)', Q.condTotal - Q.firstCond, 'condMore', 'egy horonyba több réteg kerül, egy menetben');
LL('Kábel', 'Behúzás — vékony SELV-kábelek és NYM (csövenként az első)', pull.small, 'pullSmall');
LL('Kábel', 'Behúzás — Cat6A (csövenként az első), végződtetés nélkül', pull.cat, 'pullCat');
labLines.push({ grp: 'Kábel', name: 'Behúzás — további kábel ugyanabban a csőben (50 %)', qty: Math.round(pull.smallMore + pull.catMore), unit: 'm',
  unitPrice: null, total: Math.round(pull.smallMore * 180 * 0.5 + pull.catMore * 400 * 0.5), full: Math.round(pull.smallMore * 180 + pull.catMore * 400), src: LAB.pullMore[2], note: 'egy behúzásban több kábel' });
LL('Kábel', 'Behúzószál az üres csövekbe', Q.cords, 'cordPull');
LL('Kábel', 'Kábelvégek: jelölés, tartalékhurok, védősapka', Q.ends, 'cableEnd', 'a végződtetés a hardverrel együtt, később');
LL('Elosztó', '6 új kör: kismegszakító beépítése, bekötése, feliratozás', 6, 'module');
LL('Elosztó', 'Védett 230 V-os kiállás a fülkékben (BASE ×2, RBX ×3, akku)', 6, 'feedEnd');
LL('Helyreállítás', 'Új horony, fészek helyreállítása gipsszel', Q.firstCond, 'restoreNew');
LL('Helyreállítás', 'Szélesített horony helyreállítása', CHASE.m.kozos + Q.mainsWiden, 'restoreShared');
const labNet = labLines.reduce((s, l) => s + l.total, 0);
const RATE_H = OFFER.A.labour.total / OFFER.A.dur.emberora;                  // v1: Ft per man-hour (P40)
const hours = labNet / RATE_H, addDays = hours / 16;                          // two people
const cleanDays = Math.ceil(addDays);
labLines.push({ grp: 'Szervezés', name: 'Napi takarítás az átjárósávban — többletnapok', qty: cleanDays, unit: 'nap', unitPrice: 2600, total: cleanDays * 2600, full: cleanDays * 2600, src: 'v1 (G7)', note: '' });
const labAdd = Math.round((labNet + cleanDays * 2600) / 5000) * 5000;

// the no-sharing reference: what the same labour would cost if every metre were a new route (the user's principle in Ft)
const noShare = labLines.reduce((s, l) => s + (l.full != null ? l.full : l.total), 0);

const v1 = { labour: OFFER.A.labour.total, mat: OFFER.A.material.total, pay: OFFER.A.labour.total + OFFER.A.material.total, eo: OFFER.A.dur.emberora,
  days: [OFFER.A.dur.x, OFFER.A.dur.y], m2: OFFER.A_M2, points: 111 };
const v2 = { labour: v1.labour + labAdd, mat: v1.mat + matTotal, eo: Math.round(v1.eo + hours), points: v1.points + ep.total };
v2.pay = v2.labour + v2.mat; v2.days = [v1.days[0] + Math.floor(addDays), v1.days[1] + Math.ceil(addDays)];
const pct = (a, b) => ((b - a) / a * 100).toFixed(1).replace('.', ',') + ' %';

// ======================= 4b. option: the complete security (SSC) layer — wiring only, priced on its own =======================
// The provider's devices (panel, detectors, contacts, keypad, sirens) go on at the end and are not in it; this is
// every conduit and cable they will need, so the provider only mounts and connects (user, 2026-10-12).
RU.CABLES.ALARM = { n: 'Riasztókábel 4×0,22 + 2×0,5, árnyékolt', od: 5.5 };
const OPT = { pts: [], mat: [], lab: [] };
const sscFeed = S.starLengths(G, E, PT, cfg, allowed, board, [P('SSCPT', SSC.x, SSC.y, SSC.h, 'R07')]).SSCPT;
const sscFeedM = +(sscFeed.len / 1000 + VBOARD + (2600 - SSC.h) / 1000).toFixed(1);
Object.entries(SEC_OPT).forEach(([k, a]) => OPT.pts.push({ k, name: a[4], room: a[3], h: a[2], m: +secM(k).toFixed(1), cab: k === 'KEYPAD' ? 'JYSTY2' : 'ALARM', cond: 'M16', path: fromSSC[k].path }));
const optPolys = OPT.pts.map(o => polyOf(o.path, 'SECURITY-OPT'));
// the chase against everything already in the wall in v2: v1 data, the v2 SELV runs and the v2 fixed routes
const have = v1Data.legs.concat(runs.flatMap(r => r.legs)).concat(extraPolys.map(x => ({ kind: 'dh', poly: x.poly })));
const OCH = S.chase([], have, R.legs, optPolys).m;
const oVert = OPT.pts.reduce((s, o) => s + Math.abs(BAND - o.h) / 1000, 0);
const oCond = OPT.pts.reduce((s, o) => s + o.m, 0), oFirst = OCH.mellett + OCH.uj + oVert;
const oCab = {}; OPT.pts.forEach(o => oCab[o.cab] = (oCab[o.cab] || 0) + o.m * 1.1 + LOOP.src + LOOP.ep);
// the minimal prep's empty conduits get their cables: contact + siren (alarm), the trunk (Cat6A for the IP module)
const minDoor = extra.find(x => /ajtókontakt/.test(x.name)).m, minSiren = extra.find(x => /sziréna/.test(x.name)).m, minTrunk = extra.find(x => /^SSC .szoba/.test(x.name)).m;
oCab.ALARM += (minDoor + minSiren) * 1.1 + 2 * (LOOP.src + LOOP.ep); oCab.CAT6AS = minTrunk * 1.1 + 2 * LOOP.src;
const OM = (name, qty, key, srcOv, unitPrice) => { const [u, unit, src] = MAT[key] || [unitPrice, 'm', srcOv]; const q = Math.ceil(qty); OPT.mat.push({ name, qty: q, unit, unitPrice: unitPrice || u, total: q * (unitPrice || u), src: srcOv || src }); };
const OL = (name, qty, key, note) => { const [u, unit, src] = LAB[key]; const q = Math.round(qty * 10) / 10; if (q > 0) OPT.lab.push({ name, qty: q, unit, unitPrice: u, total: Math.round(q * u), src, note: note || '' }); };
OM('Riasztókábel 4×0,22 + 2×0,5, árnyékolt', up(oCab.ALARM, 10), null, 'web: argep 229–310 Ft/m ●○○', 270);
OM('J-Y(St)Y 2×2×0,8 (kezelő busza)', up(oCab.JYSTY2, 10), 'JYSTY2');
OM('Cat6A S/FTP LSZH (SSC IP-modul → BASE, a meglévő M25-be)', up(oCab.CAT6AS, 10), 'CAT6AS');
OM('NYM-J 3×1,5 (az SSC saját köre)', up(sscFeedM * 1.1 + 1, 10), 'NYM3x15');
OM('Gégecső M16', up(oCond, 5), 'M16'); OM('Gégecső M20 (az SSC 230 V-os köre)', up(sscFeedM, 5), 'M20');
OM('Szerelvénydoboz ⌀68, 66 mm mély', OPT.pts.length, 'box68'); OM('Kismegszakító 1 modul (SSC)', 1, 'mcb');
OM('Kábeljelölők', 2 * (OPT.pts.length + 3) + 2, 'label'); OM('Gipsz stukatúr 10 kg', Math.ceil((oFirst * 0.7 + OCH.kozos * 0.35 + OPT.pts.length * 0.3) / 10), 'gipsz');
OL('Horony — meglévő v2-horony szélesítése (közös útvonal)', OCH.kozos, 'chaseShared'); OL('Horony — új, a v1 erősáramú horony mellett', OCH.mellett, 'chaseBeside');
OL('Horony — teljesen új szakasz', OCH.uj, 'chaseNew'); OL(`Függőleges horony — ${OPT.pts.length} leállás`, oVert, 'chaseVert');
OL('Dobozhely ⌀68', OPT.pts.length, 'hole68'); OL('Doboz beépítése', OPT.pts.length, 'boxSet');
OL('Védőcső fektetése — az első cső az új horonyban', oFirst, 'condFirst'); OL('Védőcső fektetése — további cső a meglévő horonyban', oCond - oFirst, 'condMore');
OL('Behúzás — riasztókábel, kezelőbusz (csövenként egy kábel)', (oCab.ALARM || 0) + (oCab.JYSTY2 || 0), 'pullSmall', 'az alap v2 üres csöveibe is'); OL('Behúzás — Cat6A a meglévő M25 törzsbe', oCab.CAT6AS, 'pullCat');
OL('Kábelvégek: jelölés, tartalékhurok', 2 * (OPT.pts.length + 3), 'cableEnd', 'a bekötés a szolgáltatóé');
OL('Az SSC saját 230 V-os köre: a v1 gerinchorony szélesítése', sscFeedM, 'chaseMainsWiden'); OL('Az SSC köre: védőcső a meglévő horonyban', sscFeedM, 'condMore');
OL('Az SSC köre: NYM behúzás', sscFeedM * 1.1 + 1, 'pullSmall'); OL('Az SSC köre: kismegszakító + védett kiállás', 1, 'feedEnd'); OL('Kismegszakító beépítése', 1, 'module');
OL('Helyreállítás — új horony, fészek', oFirst, 'restoreNew'); OL('Helyreállítás — szélesítés', OCH.kozos + sscFeedM, 'restoreShared');
OPT.matNet = OPT.mat.reduce((s, l) => s + l.total, 0); OPT.matTotal = Math.round(OPT.matNet * 1.1 / 1000) * 1000;
OPT.labNet = OPT.lab.reduce((s, l) => s + l.total, 0); OPT.labTotal = Math.round(OPT.labNet / 5000) * 5000;
OPT.total = OPT.labTotal + OPT.matTotal; OPT.hours = Math.round(OPT.labNet / RATE_H);
OPT.chase = OCH; OPT.vert = +oVert.toFixed(1); OPT.cond = +oCond.toFixed(1); OPT.cab = Object.fromEntries(Object.entries(oCab).map(([k, v]) => [k, +v.toFixed(1)]));
OPT.sscFeedM = sscFeedM; OPT.ssc = SSC;

// ======================= 5. outputs =======================
fs.mkdirSync(outDir, { recursive: true });
const out = { generated: new Date().toISOString(), source: path.basename(inFile), decisions: { rbx: RBX, riser: 'csövek, kábel nélkül', feeds230: 'kábel + kismegszakító', security: 'minimális' },
  endpoints: ep, runs: runs.map(r => ({ layer: r.L.id, hu: r.L.hu, endpoints: r.EP.map(e => ({ id: e.id, ref: e.ref, room: e.room, code: e.dev.code || e.dev.type, v: e.v, h: Math.round(e.h), cable: e.cable })),
    servedBy: r.src, legs: r.legs.length, boxes: r.boxes.length, conduit: Q.condByLayer[r.L.id], cable: Q.cabByLayer[r.L.id], warn: r.warn.map(w => w.msg) })),
  fixed: extra, feeds: FEEDS, quantities: Q, chase: CHASE.m, vertical: { m: VERT.m, columns: Q.cols, ceiling: VERT.ceilM },
  material: { lines: matLines, net: matNet, handling, total: matTotal }, labour: { lines: labLines, net: labNet, total: labAdd, hours: Math.round(hours), rateH: Math.round(RATE_H), noShareRef: Math.round(noShare) },
  v1, v2, option: Object.assign({}, OPT, { pts: OPT.pts.map(o => Object.assign({}, o, { path: undefined })) }), ssc: SSC };
fs.writeFileSync(path.join(outDir, 'v2_mennyisegek.json'), JSON.stringify(out, null, 1));
const csv = ['layer;leg;kind;from;to;len_mm;conduits;cables'];
runs.forEach(r => r.legs.forEach(l => csv.push([r.L.id, l.id, l.kind, l.from, l.to, l.len, l.cond, l.pipes.map(p => p.cables.map(c => c.n + '×' + c.c).join('+')).join(' | ')].join(';'))));
extra.forEach((x, i) => csv.push([x.grp, 'F' + (i + 1), 'fixed', '', x.name, Math.round(x.m * 1000), (x.n > 1 ? x.n + '×' : '') + x.cond, x.cab ? x.n + '×' + x.cab : 'üres'].join(';')));
FEEDS.forEach((f, i) => csv.push(['MAINS230', 'T' + (i + 1), 'feed', 'Elosztó', f.n, Math.round(f.m * 1000), f.cond || '(a BASE 1. kör csövében)', f.cab].join(';')));
fs.writeFileSync(path.join(outDir, 'v2_legs.csv'), '﻿' + csv.join('\n'));
require('./cla.v2.report').write(out, outDir, { fmt, m1, pct, LAYERS, CH, RBX, LAB, MAT, RU });
// ---- sheets: the layer map + the chase map ----
const SH = require('./cla.v2.sheets'), dv = id => G.D.devices.find(d => d.id === id), r05 = require('./sheet').roomCentre(G.rooms.find(r => r.id === 'R05'));
const niches = [
  { x: dv('D372').x, y: dv('D372').y, z: 170, c: '#1f3f8b', t: 'RBXM · RB-H 600×600' }, { x: dv('D369').x, y: dv('D369').y, z: 130, c: '#4a6fb5', t: 'RBX03 · RB-M' },
  { x: dv('D371').x, y: dv('D371').y, z: 130, c: '#4a6fb5', t: 'RBX06 · RB-M · médiafal' }, { x: base.x, y: base.y, z: 150, c: '#0b4f6c', t: 'BASE' },
  { x: SSC.x, y: SSC.y, z: 120, c: '#c0392b', t: 'SSC (gardrób)' }, { x: r05[0], y: r05[1], z: 110, c: '#e08a00', t: 'B busz akku' },
  { x: RZ[0], y: RZ[1], z: 90, c: '#555', t: 'V1 felszálló ↑', round: true }, { x: board.x, y: board.y, z: 110, c: '#7a2a22', t: 'Elosztó' } ];
const optPts = Object.entries(SEC_OPT).map(([k, a]) => { const nf = geom.nearestFace(G, a[0], a[1], a[3]); return { k, x: nf.x, y: nf.y }; });
const feedPaths = FEEDS.filter(f => f.cond).map(f => ({ path: fromBoard[f.to].path })).concat([{ path: fromBoard.RISER.path }]);
const SX = { G, R, v1Data, runs, extraPolys, optPolys, optPts, niches, ep: ep.total, Q, cabTotal: Object.values(Q.cab).reduce((s, v) => s + v, 0), CH: CHASE, VERT, feeds: feedPaths };
SH.layerSheet(SX, path.join(outDir, 'v2-retegek.png')); SH.chaseSheet(SX, path.join(outDir, 'v2-horony.png'));
console.log(`v2: ${ep.total} SELV-végpont · cső ${Q.condTotal} m · horony közös ${CHASE.m.kozos} / mellett ${CHASE.m.mellett} / új ${CHASE.m.uj} m · függőleges ${VERT.m} m`);
console.log(`anyag +${fmt(matTotal)} · munkadíj +${fmt(labAdd)} (${Math.round(hours)} eó) · fizetendő ${fmt(v1.pay)} → ${fmt(v2.pay)} (${pct(v1.pay, v2.pay)})`);
console.log('figyelmeztetések: ' + runs.reduce((s, r) => s + r.warn.length, 0)); runs.forEach(r => r.warn.forEach(w => console.log('  ' + r.L.id + ': ' + w.msg)));
