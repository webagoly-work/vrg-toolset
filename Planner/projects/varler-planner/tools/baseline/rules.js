// rules.js — the standards the Erősáram baseline applies (heights, portal slots, boxes, cables, conduits)
// Sources: EP_CAT (05s-endpoints.js) heights · WORKSHOP-001 answers (switches 1100, smart band 1300–1500) ·
// IDEA-003 (rail ≈ 2450, nest H0 at the hinge-side upper corner, head over the opening, hinge riser ZS-t 100–300,
// SELV only on the hinge side) · DIN 18015-3 installation zones (ZW-o 150–450 below the ceiling, ZS-t 100–300 beside
// a door) · STD-008 (NTL 1100–1200) · 05w-fill.js (cable OD, conduit ID, fill rule) · user decisions 2026-10-12
// (trunk 2600, distribution 2450, two lighting circuits). ⚑ = a figure to confirm.
'use strict';

const LEVEL = { trunk: 2600, dist: 2450, ceilingDefault: 2850, worktop: 900, lintel: 2100 };

// ---- standard heights ------------------------------------------------------------------------------------------------
// ctx: {wall:boolean, bed, worktop, island, wet, room, ceiling, portal:boolean, circuitName, note}
function stdHeight(d, ctx) {
  const code = d.code || ({ light: 'LMP', switch: 'SWI', socket: 'SOC' })[d.type] || d.type, v = d.var || '', role = ctx.role;
  const C = ctx.ceiling || LEVEL.ceilingDefault, keep = (why) => ({ h: d.h, rule: why || 'megtartva' });
  if (role === 'cluster') return keep('klaszterpont — figyelmen kívül');
  if (role === 'hw') { if (d.type === 'rbx') return { h: 2150, rule: 'RBX dobozközép 2150 (alja ≥ 1900, STD-001-A1)' }; return keep('hardver — gyártói / helyszíni'); }
  if (role === 'base') return keep('BASE bútorban');
  if (role === 'sys:MAINS') {
    if (code === 'SWI') { if (ctx.bed) return { h: 750, rule: 'ágy melletti kapcsoló, éjjeliszekrény fölött 750' };
      if (ctx.window) return { h: 1100, rule: 'redőnykapcsoló 1100, ablak mellett' }; return { h: 1100, rule: 'kapcsoló 1100 (WORKSHOP-001)' }; }
    if (code === 'SOC') {
      if (ctx.island) return { h: 750, rule: 'szigetbe épített dugalj, oldallapon 750 ⚑' };
      if (ctx.worktop) return { h: LEVEL.worktop + 200, rule: 'pult fölött: munkalap 900 + 200 = 1100' };
      if (ctx.bed) return d.h >= 600 ? { h: 750, rule: 'ágy melletti dugalj, éjjeliszekrény fölött 750' } : { h: 300, rule: 'ágy melletti alsó dugalj 300' };
      if (ctx.wet) return { h: 1100, rule: 'vizes helyiség: 1100, a 0–2. zónán kívül ⚑ MSZ HD 60364-7-701' };
      if ((ctx.kinds || []).some(k => k === 'kamra' || k === 'gardrob')) return { h: 1100, rule: 'kamra: polcmagasság 1100' };
      return { h: 300, rule: 'dugalj 300 (EP_CAT)' }; }
    if (code === 'DED') { const n = (ctx.circuitName || '').toLowerCase();
      if (v === 'hob2l' || v === 'hob32' || /főzőlap/.test(n)) return { h: 600, rule: 'főzőlap csatlakozó a főzőlap alatti szekrényben 600' };
      if (/klíma/.test(n)) return { h: 2300, rule: 'klíma: beltéri egység mellett 2300' };
      if (/mosógép/.test(n)) return { h: 1100, rule: 'mosógép: a gép fölött 1100' };
      if (/mosogatógép/.test(n)) return { h: 300, rule: 'mosogatógép: szomszéd szekrényben 300' };
      if (/sütő/.test(n)) return { h: 300, rule: 'sütőtorony: a torony alsó szekrényében 300 ⚑' };
      return { h: 300, rule: 'dedikált 300 (EP_CAT)' }; }
    if (code === 'SHU') return { h: 2500, rule: 'redőnymotor a redőnyszekrény mellett 2500' };
    if (code === 'LMP') {
      if (!ctx.wall) return { h: C, rule: `mennyezeti lámpa = mennyezet ${C}` };
      if (/ventil/i.test(ctx.note || '')) return { h: 2300, rule: 'elszívó ventilátor fent 2300' };
      if (/munkafény/i.test(ctx.note || '')) return { h: 1450, rule: 'munkafény betáp a felső szekrénysor alján 1450 ⚑' };
      if (d.h <= 450) return { h: 300, rule: 'kapcsolt dugalj állólámpának 300' };
      if (ctx.bed) return { h: 1400, rule: 'olvasólámpa az ágytámla fölött 1400' };
      if (ctx.wet) return { h: 1900, rule: 'tükörlámpa 1900' };
      return { h: 1800, rule: 'fali lámpa 1800' }; }
    return keep();
  }
  // ---- the stack layers above Erősáram ----
  if (code === 'NTL') return { h: 1150, rule: 'értesítő fény 1150 (STD-008)' };
  if (role === 'sys:BUSB' && code === 'LMP') return { h: 300, rule: 'lábfény 300 (B busz)' };
  if (code === 'POR') return v === 'tof' ? { h: 2150, rule: 'ToF pár a szemöldök fölött 2150' } : { h: 2450, rule: 'portál vezérlőpont a fészekben (H0) 2450' };
  if (code === 'PAN') return { h: 1450, rule: 'kezelőpanel 1450' };
  if (code === 'THR') return { h: 1500, rule: 'termosztát 1500' };
  if (code === 'SEN') {
    if (v === 'leak') return { h: 0, rule: 'szivárgás: padlón' };
    if (v === 'co2') return { h: 1400, rule: 'CO₂ légzési zóna 1400 (RESEARCH-001 §4)' };
    return ctx.wall ? { h: 2400, rule: 'falon, magas sáv 2400' } : { h: C, rule: `mennyezeten ${C}` }; }
  if (code === 'ACP') return { h: C, rule: `WiFi AP a mennyezeten ${C}` };
  if (code === 'CAM') return { h: 2400, rule: 'kamera 2400' };
  if (code === 'ETH' || code === 'USB') return { h: 300, rule: 'adat / USB 300' };
  if (code === 'SPK') return ctx.portal ? { h: 2400, rule: 'portál fejzseb 2400' } : { h: C, rule: `hangszóró a mennyezeten ${C}` };
  return keep();
}

// ---- the all-in-one Portal: every designated spot (per face). u = mm from the opening EDGE outward on that side
// (latch / hinge), or from the opening CENTRE for the head. fam = which family the box belongs to (segregation).
const PORTAL_SLOTS = [
  { k: 'H0', side: 'hinge', u: 150, h: 2450, fam: 'CONTROL', n: 'Fészek — portál vezérlőpont, SELV átvezetés', codes: ['POR:rs485'] },
  { k: 'H3', side: 'hinge', u: 150, h: 1450, fam: 'SENSOR', n: 'Levegő-modul (FLT-A) / termosztát', codes: ['THR', 'SEN:co2'] },
  { k: 'H2', side: 'hinge', u: 150, h: 1150, fam: 'BUSB', n: 'Értesítő fény + közeledés / kopogás (FLT-N)', codes: ['NTL'] },
  { k: 'H1', side: 'hinge', u: 150, h: 300, fam: 'BUSB', n: 'Lábfény + alacsony PIR (FLT-L)', codes: ['LMP:b'] },
  { k: 'T1', side: 'head', u: 0, h: 2150, fam: 'SENSOR', n: 'Fej-modul: ToF pár, függöny-PIR, lux (FLT-H)', codes: ['POR:tof'] },
  { k: 'T2', side: 'head', u: 0, h: 2400, fam: 'MEDIA', n: 'Fejzseb: hangszóró / sziréna / tartalék', codes: ['SPK'] },
  { k: 'L4', side: 'latch', u: 150, h: 2450, fam: 'MAINS', n: 'Erősáramú leállás-doboz (2 szerelvényes), 230 V átvezetés', codes: [] },
  { k: 'L1', side: 'latch', u: 150, h: 1100, fam: 'MAINS', n: 'Kapcsoló (1–3 gang, váltó)', codes: ['SWI'] },
  { k: 'L3', side: 'latch', u: 150, h: 300, fam: 'MAINS', n: 'Ajtó melletti dugalj', codes: ['SOC'] },
  { k: 'L2', side: 'latch', u: 450, h: 1450, fam: 'CONTROL', n: 'Kezelőpanel / belépési pont (külön SELV oszlop)', codes: ['PAN'] }
];
const PORTAL_ZONE = { zst: [100, 300], lintelBand: [2100, 2250], railBand: [2400, 2700] };

// ---- boxes (sizes in mm, w × h) ----
const BOX = {
  gang2: { n: '2 szerelvényes süllyesztett doboz (kötő / leállás)', w: 142, h: 71, jbSize: 140 },
  gang1: { n: 'Szerelvénydoboz ⌀68', w: 68, h: 68, jbSize: 68 },
  corner: { n: 'Sarok-tartalékdoboz (2 szerelvényes)', w: 142, h: 71, jbSize: 140 },
  end: { n: 'Pályavég-tartalékdoboz (2 szerelvényes)', w: 142, h: 71, jbSize: 140 },
  portalMains: { n: 'Portál erősáramú doboz (L4, 2 szerelvényes)', w: 142, h: 71, jbSize: 140 },
  ceiling: { n: 'Mennyezeti lámpadoboz', w: 80, h: 80, jbSize: 80 }
};

// ---- cables and conduits (05w-fill.js AFILL_CABLES / AFILL_CONDUITS / AFILL_RULE) ----
const CABLES = { NYM3x15: { n: 'NYM-J 3×1,5', od: 9 }, NYM3x25: { n: 'NYM-J 3×2,5', od: 10.5 }, NYM4x15: { n: 'NYM-J 4×1,5', od: 10 },
  NYM5x15: { n: 'NYM-J 5×1,5', od: 11 /* ⚑ not in AFILL_CABLES */ }, NYM5x25: { n: 'NYM-J 5×2,5', od: 12 }, NYM3x6: { n: 'NYM-J 3×6', od: 13.5 },
  NYM5x6: { n: 'NYM-J 5×6', od: 16 }, NYM5x10: { n: 'NYM-J 5×10', od: 19 /* ⚑ */ }, SPARE: { n: 'üres cső + behúzószál', od: 0 },
  CAT6A: { n: 'Cat6A U/FTP LSZH', od: 7.5 /* ⚑ 7,2–8,0 a gyártótól függően */ } };
const CONDUITS = [{ k: 'M16', id: 10.7 }, { k: 'M20', id: 14.1 }, { k: 'M25', id: 18.3 }, { k: 'M32', id: 24.3 }, { k: 'M40', id: 31.2 }, { k: 'M50', id: 39.6 }, { k: 'M63', id: 52.6 }];
const FILL = { single: 1.4, fill: 0.40, fillLong: 0.33, longMm: 10000, maxBends: 3 };
const area = d => Math.PI * d * d / 4;
function sizeConduit(cables, lenMm) {
  const n = cables.reduce((s, c) => s + (c.n || 1), 0), A = cables.reduce((s, c) => s + (c.n || 1) * area(CABLES[c.c].od), 0);
  if (!n) return { size: 'M20', fill: 0, why: 'üres tartalék + behúzószál' };
  if (n === 1) { const od = CABLES[cables[0].c].od, C = CONDUITS.find(k => k.id >= FILL.single * od) || CONDUITS[CONDUITS.length - 1];
    return { size: C.k, fill: +(A / area(C.id)).toFixed(3), why: `1 kábel: ID ${C.id} ≥ 1,4 × ${od}` }; }
  const k = lenMm > FILL.longMm ? FILL.fillLong : FILL.fill;
  for (const C of CONDUITS) { const f = A / area(C.id); if (f <= k + 1e-9) return { size: C.k, fill: +f.toFixed(3), why: `${n} kábel: ${Math.round(f * 100)} % ≤ ${Math.round(k * 100)} %` }; }
  const C = CONDUITS[CONDUITS.length - 1]; return { size: C.k, fill: +(A / area(C.id)).toFixed(3), why: 'túltelített', over: true };
}

// ---- which cable a circuit / leg uses ----
const CIRCUIT_CABLE = { light: 'NYM3x15', s04: 'NYM3x15', s25: 'NYM3x25', ded16: 'NYM3x25', hob2l: 'NYM5x25', hob32: 'NYM3x6', alelo: 'NYM5x6' };   // alelo: WP-E6 Alosztó feeder
const SWITCH_LEG = { 1: 'NYM3x15', 2: 'NYM4x15', 3: 'NYM5x15', twoway: 'NYM4x15', shutter: 'NYM4x15' };

// ---- E5-Q3 = A: run heights follow the ceiling (P33: 2850 → trunk 2600, distribution 2450) ----
function runHeights(cfg) { const C = (cfg && cfg.ceiling) || LEVEL.ceilingDefault;
  return { trunk: (cfg && cfg.trunkH) || C - 250, dist: (cfg && cfg.distH) || C - 400, ceiling: C }; }

// ---- E5-Q1 = A: current-carrying capacity (Ib ≤ In ≤ Iz · k) ⚑ ----
// Iz: PVC-insulated multi-core cable in conduit in / on a wall (reference method B2), 30 °C, copper — IEC 60364-5-52
// table B.52.4 values, by loaded conductors (2 = single phase, 3 = three phase). ⚑ to confirm against MSZ HD 60364-5-52.
const IZ = { 2: { 1.5: 16.5, 2.5: 23, 4: 30, 6: 38, 10: 52, 16: 69, 25: 90 }, 3: { 1.5: 15, 2.5: 20, 4: 27, 6: 34, 10: 46, 16: 62, 25: 80 } };   // 25: WP-E6 feeders
// grouping: circuits bunched in one chase / enclosure — IEC 60364-5-52 table B.52.17 row 1 ⚑
const GROUP_K = [1, 1, 0.80, 0.70, 0.65, 0.60, 0.57, 0.54, 0.52, 0.50, 0.48, 0.45];
const groupK = n => n < GROUP_K.length ? GROUP_K[Math.max(1, n)] : 0.41;
const cableMm2 = c => { const m = /x(\d+)$/.exec(c || ''); if (!m) return null; const v = m[1]; return v === '15' ? 1.5 : v === '25' ? 2.5 : +v; };
const loadedCores = c => /^NYM5x/.test(c || '') ? 3 : 2;
const mcbAmps = s => { const m = /(\d+)\s*A?\s*$/.exec(String(s || '').trim()); return m ? +m[1] : null; };
// ---- E5-Q2 = B: voltage drop, one limit ----
const VDROP = { limitPct: 4, rho: 0.0225 /* Ω·mm²/m, copper at 70 °C ⚑ */ };
function vdropPct(lenM, amps, mm2, cores3) { if (!lenM || !amps || !mm2) return 0;
  return cores3 ? Math.sqrt(3) * lenM * amps * VDROP.rho / mm2 / 400 * 100 : 2 * lenM * amps * VDROP.rho / mm2 / 230 * 100; }

module.exports = { runHeights, IZ, groupK, cableMm2, loadedCores, mcbAmps, VDROP, vdropPct, LEVEL, stdHeight, PORTAL_SLOTS, PORTAL_ZONE, BOX, CABLES, CONDUITS, FILL, sizeConduit, CIRCUIT_CABLE, SWITCH_LEG };
