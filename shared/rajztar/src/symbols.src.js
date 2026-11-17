// symbols.src.js — the source of data/symbols.json (run: node shared/rajztar/build.js)
//
// Why a source file and not hand-written JSON: 120+ symbols must share one geometry — the same
// contact blade, the same 2,5 mm module, the same port positions — or a generated single-line
// diagram looks hand-patched. The helpers below are that shared geometry; the JSON they emit is
// the offline store every program reads (it never needs this file).
//
// Coordinates: millimetres ON PAPER, origin top-left of the symbol box, y down.
// Classes in body markup (the renderer maps them to strokes/fills):
//   (none) stroke only · f filled · w wide stroke (2×) · dot dotted mechanical link · t text
// conf: how sure the drawn form is
//   iec         form as in IEC 60617 (S-number still to be attached after a database check)
//   iec-approx  IEC family and meaning are right, the exact proportions are ours
//   hu-practice no single IEC form, drawn as Hungarian plans usually show it
//   vrg         our own symbol where nothing standard exists (always explained in the legend)

'use strict';

const S = []; // the library
const add = o => { S.push(o); return o; };

// ---------- schematic helpers (vertical flow, 10 × 15 box, ports top/bottom at x = 5) --------------
const SW = 10, SH = 15;
const portsV = (w = SW, h = SH, x = 5) => [{ id: '1', x, y: 0, dir: 'up' }, { id: '2', x, y: h, dir: 'down' }];
const leadTop = `<line x1='5' y1='0' x2='5' y2='5'/>`;
const leadBot = `<line x1='5' y1='10' x2='5' y2='15'/>`;
const blade = `<line x1='5' y1='10' x2='5' y2='3' transform='rotate(30 5 10)'/>`; // ends at (1.5, 3.94)
const bladeMid = [3.25, 6.97]; // a point on the blade, for mechanical links
const markX = `<path d='M4.2 4.2 L5.8 5.8 M5.8 4.2 L4.2 5.8'/>`;          // circuit-breaker function
const markBar = `<line x1='3.8' y1='5' x2='6.2' y2='5'/>`;                 // disconnector function
const markArc = `<path d='M3.8 5 A1.2 1.2 0 0 0 6.2 5'/>`;                 // contactor function
const markO = `<circle cx='5' cy='5' r='0.8'/>`;                            // load-switch function
const link = (x2, y) => `<line class='dot' x1='${bladeMid[0]}' y1='${bladeMid[1]}' x2='${x2}' y2='${y}'/>`;
const txt = (x, y, s, size = 2.5, anchor = 'middle') => `<text class='t' x='${x}' y='${y}' font-size='${size}' text-anchor='${anchor}'>${String(s).replace(/>/g, '&gt;').replace(/</g, '&lt;')}</text>`;
const relBox = (x, y, w, h, label) => `<rect x='${x}' y='${y}' width='${w}' height='${h}'/>` + txt(x + w / 2, y + h / 2 + 0.85, label, 2.2);

function contact(id, hu, en, marks, extra = {}) {
  return add(Object.assign({
    id, cat: 'sw', hu, en, std: { ref: 'std.60617', part: '07' }, conf: 'iec',
    w: SW, h: SH, body: leadTop + blade + leadBot + marks, ports: portsV(), anchor: [5, 7.5], refdes: 'Q',
    use: ['D12', 'D13', 'D11', 'D23']
  }, extra));
}

// ---------- plan helpers (10 × 10 box, symbol centre (5,5), wall side = bottom edge) -------------
const planBase = (o) => Object.assign({ w: 10, h: 10, anchor: [5, 5], wall: 'bottom', ports: [{ id: 'c', x: 5, y: 10, dir: 'down' }] }, o);
// switch: open circle at (5,7) r 1.3, lever at 45° up-right, ticks perpendicular
const swRing = `<circle cx='5' cy='7' r='1.3'/>`;
const lever = (dx = 1) => `<line x1='${5 + 0.92 * dx}' y1='6.08' x2='${5 + 4.2 * dx}' y2='2.8'/>`;
const tick = (k, dx = 1) => { // k-th tick from the lever end
  const ex = 5 + 4.2 * dx - k * 0.9 * dx, ey = 2.8 + k * 0.9;
  return `<line x1='${ex}' y1='${ey}' x2='${ex + 1.1 * dx}' y2='${ey + 1.1}'/>`;
};
// socket: cup (open away from the wall) + stem to the wall
const cup = `<path d='M2 4 A3 3 0 0 0 8 4'/><line x1='5' y1='7' x2='5' y2='10'/>`;
const peBar = `<line x1='2' y1='2.6' x2='8' y2='2.6'/>`;
const lumX = (cx = 5, cy = 5, r = 3) => `<circle cx='${cx}' cy='${cy}' r='${r}'/><path d='M${cx - r * 0.707} ${cy - r * 0.707} L${cx + r * 0.707} ${cy + r * 0.707} M${cx + r * 0.707} ${cy - r * 0.707} L${cx - r * 0.707} ${cy + r * 0.707}'/>`;

// =================================================================================================
// 03 · Vezetők és csatlakozások
// =================================================================================================
const C = (o) => add(Object.assign({ cat: 'conn', std: { ref: 'std.60617', part: '03' }, conf: 'iec', use: ['D11', 'D12', 'D13'] }, o));
C({ id: 'conn.wire', hu: 'Vezeték, összeköttetés', en: 'Conductor', w: 10, h: 2, body: `<line x1='0' y1='1' x2='10' y2='1'/>`, ports: [{ id: '1', x: 0, y: 1, dir: 'left' }, { id: '2', x: 10, y: 1, dir: 'right' }], anchor: [5, 1] });
C({ id: 'conn.busbar', hu: 'Gyűjtősín', en: 'Busbar', w: 20, h: 2, body: `<line class='w' x1='0' y1='1' x2='20' y2='1'/>`, ports: [{ id: '1', x: 0, y: 1, dir: 'left' }, { id: '2', x: 20, y: 1, dir: 'right' }], anchor: [10, 1], refdes: 'W' });
C({ id: 'conn.junction', hu: 'Csatlakozási pont (elágazás)', en: 'Junction', w: 2, h: 2, body: `<circle class='f' cx='1' cy='1' r='0.5'/>`, ports: [{ id: 'c', x: 1, y: 1, dir: 'any' }], anchor: [1, 1] });
C({ id: 'conn.terminal', hu: 'Kapocs', en: 'Terminal', w: 2, h: 2, body: `<circle cx='1' cy='1' r='0.6'/>`, ports: [{ id: 'c', x: 1, y: 1, dir: 'any' }], anchor: [1, 1], refdes: 'X' });
C({ id: 'conn.terminal-strip', hu: 'Sorkapocs (3 kapocs)', en: 'Terminal strip', w: 10, h: 5, body: `<rect x='0.5' y='1' width='9' height='3'/><circle cx='2.5' cy='2.5' r='0.6'/><circle cx='5' cy='2.5' r='0.6'/><circle cx='7.5' cy='2.5' r='0.6'/>`, ports: [{ id: '1', x: 2.5, y: 0, dir: 'up' }, { id: '2', x: 5, y: 0, dir: 'up' }, { id: '3', x: 7.5, y: 0, dir: 'up' }], anchor: [5, 2.5], refdes: 'X', conf: 'iec-approx' });
C({ id: 'conn.cross', hu: 'Keresztezés csatlakozás nélkül', en: 'Crossing, no connection', w: 6, h: 6, body: `<line x1='0' y1='3' x2='6' y2='3'/><line x1='3' y1='0' x2='3' y2='6'/>`, ports: [], anchor: [3, 3] });
C({ id: 'conn.n3', hu: 'Három vezető (egyvonalas jelölés)', en: 'Three conductors', w: 10, h: 6, body: `<line x1='0' y1='3' x2='10' y2='3'/><path d='M3 4.5 L4 1.5 M4.5 4.5 L5.5 1.5 M6 4.5 L7 1.5'/>`, ports: [{ id: '1', x: 0, y: 3, dir: 'left' }, { id: '2', x: 10, y: 3, dir: 'right' }], anchor: [5, 3], use: ['D11', 'D12', 'D15', 'D16'] });
C({ id: 'conn.nn', hu: 'n vezető (szám a vonás mellett)', en: 'n conductors', w: 10, h: 6, body: `<line x1='0' y1='3' x2='10' y2='3'/><path d='M4.5 4.5 L5.5 1.5'/>` + txt(7.2, 2, 'n', 2.2), ports: [{ id: '1', x: 0, y: 3, dir: 'left' }, { id: '2', x: 10, y: 3, dir: 'right' }], anchor: [5, 3], params: { n: 'erek száma' } });
C({ id: 'conn.mark-n', hu: 'Nullavezető (N) jelölés', en: 'Neutral conductor mark', w: 8, h: 6, body: `<line x1='0' y1='4' x2='8' y2='4'/><path d='M3.5 5 L4.5 2.2'/><circle cx='4.7' cy='1.6' r='0.6'/>`, ports: [{ id: '1', x: 0, y: 4, dir: 'left' }, { id: '2', x: 8, y: 4, dir: 'right' }], anchor: [4, 4], use: ['D15', 'D16', 'D12'] });
C({ id: 'conn.mark-pe', hu: 'Védővezető (PE) jelölés', en: 'Protective conductor mark', w: 8, h: 6, body: `<line x1='0' y1='4' x2='8' y2='4'/><path d='M3.5 5 L4.5 2.2 M3.4 2.0 L5.6 2.4'/>`, ports: [{ id: '1', x: 0, y: 4, dir: 'left' }, { id: '2', x: 8, y: 4, dir: 'right' }], anchor: [4, 4], use: ['D15', 'D16', 'D12'] });
C({ id: 'conn.mark-pen', hu: 'PEN vezető jelölés', en: 'PEN conductor mark', w: 8, h: 6, body: `<line x1='0' y1='4' x2='8' y2='4'/><path d='M3.5 5 L4.5 2.2 M3.4 2.0 L5.6 2.4'/><circle cx='4.9' cy='1.1' r='0.55'/>`, ports: [{ id: '1', x: 0, y: 4, dir: 'left' }, { id: '2', x: 8, y: 4, dir: 'right' }], anchor: [4, 4], use: ['D11', 'D12', 'D23'] });
C({ id: 'conn.plug-socket', hu: 'Dugós csatlakozó (dugó + aljzat)', en: 'Plug and socket', w: 10, h: 15, body: `<line x1='5' y1='0' x2='5' y2='5.5'/><path d='M3 5.5 A2 2 0 0 0 7 5.5'/><rect class='f' x='4.4' y='8.2' width='1.2' height='2.6'/><line x1='5' y1='10.8' x2='5' y2='15'/>`, ports: portsV(), anchor: [5, 7.5], refdes: 'X', conf: 'iec-approx' });
C({ id: 'conn.earth', hu: 'Föld, földelés', en: 'Earth', w: 8, h: 8, body: `<line x1='4' y1='0' x2='4' y2='4'/><line x1='1' y1='4' x2='7' y2='4'/><line x1='2' y1='5.4' x2='6' y2='5.4'/><line x1='3' y1='6.8' x2='5' y2='6.8'/>`, ports: [{ id: 'c', x: 4, y: 0, dir: 'up' }], anchor: [4, 4], use: ['D12', 'D21', 'D22', 'D23'] });
C({ id: 'conn.pe-earth', hu: 'Védőföldelés', en: 'Protective earth', w: 10, h: 10, body: `<line x1='5' y1='0' x2='5' y2='4'/><line x1='2.8' y1='4' x2='7.2' y2='4'/><line x1='3.5' y1='5.2' x2='6.5' y2='5.2'/><line x1='4.2' y1='6.4' x2='5.8' y2='6.4'/><circle cx='5' cy='5.2' r='3.6'/>`, ports: [{ id: 'c', x: 5, y: 0, dir: 'up' }], anchor: [5, 5], use: ['D12', 'D22'] });
C({ id: 'conn.chassis', hu: 'Testelés (keret, váz)', en: 'Frame / chassis', w: 8, h: 7, body: `<line x1='4' y1='0' x2='4' y2='4'/><line x1='1' y1='4' x2='7' y2='4'/><path d='M1.8 4 L0.8 6 M4 4 L3 6 M6.2 4 L5.2 6'/>`, ports: [{ id: 'c', x: 4, y: 0, dir: 'up' }], anchor: [4, 4] });
C({ id: 'conn.equipot', hu: 'Potenciálkiegyenlítés (EPH)', en: 'Equipotential bonding', w: 8, h: 8, body: `<line x1='4' y1='0' x2='4' y2='3'/><path d='M1 3 L7 3 L4 7.5 Z'/>`, ports: [{ id: 'c', x: 4, y: 0, dir: 'up' }], anchor: [4, 4], conf: 'iec-approx', use: ['D22', 'D12'] });
C({ id: 'conn.cable-end', hu: 'Kábelvég (kábelfej)', en: 'Cable termination', w: 10, h: 6, body: `<line x1='0' y1='3' x2='7' y2='3'/><path d='M7 1 L7 5 L9.5 3 Z'/>`, ports: [{ id: '1', x: 0, y: 3, dir: 'left' }], anchor: [5, 3], conf: 'iec-approx', refdes: 'W' });

// =================================================================================================
// 07 · Kapcsoló- és védőkészülékek
// =================================================================================================
contact('sw.make', 'Záró érintkező', 'Make contact', '', { refdes: 'K' });
add({
  id: 'sw.break', cat: 'sw', hu: 'Nyitó érintkező', en: 'Break contact', std: { ref: 'std.60617', part: '07' }, conf: 'iec', w: SW, h: SH,
  body: leadTop + `<line x1='5' y1='5' x2='1' y2='5'/>` + `<line x1='5' y1='10' x2='5' y2='3.5' transform='rotate(-33 5 10)'/>` + leadBot,
  ports: portsV(), anchor: [5, 7.5], refdes: 'K', use: ['D13']
});
add({
  id: 'sw.changeover', cat: 'sw', hu: 'Váltó érintkező', en: 'Change-over contact', std: { ref: 'std.60617', part: '07' }, conf: 'iec', w: SW, h: SH,
  body: `<line x1='2.5' y1='0' x2='2.5' y2='4'/><line x1='7.5' y1='0' x2='7.5' y2='5'/><line x1='7.5' y1='5' x2='6' y2='5'/>` + `<line x1='5' y1='10' x2='2.5' y2='4'/>` + leadBot,
  ports: [{ id: '1', x: 2.5, y: 0, dir: 'up' }, { id: '3', x: 7.5, y: 0, dir: 'up' }, { id: '2', x: 5, y: 15, dir: 'down' }], anchor: [5, 7.5], refdes: 'K', use: ['D13']
});
contact('sw.switch', 'Kapcsoló (terheléskapcsoló)', 'Switch (load-break)', markO, { conf: 'iec-approx' });
contact('sw.disconnector', 'Szakaszoló', 'Disconnector', markBar);
contact('sw.switch-disconnector', 'Szakaszolókapcsoló / főkapcsoló', 'Switch-disconnector', markBar + `<circle cx='5' cy='3.6' r='0.7'/>`, { conf: 'iec-approx' });
contact('sw.cb', 'Megszakító', 'Circuit-breaker', markX);
contact('sw.mcb', 'Kismegszakító (túláramvédelmi kioldóval)', 'Miniature circuit-breaker', markX + link(8, 7) + relBox(7, 5.4, 3, 3.2, 'I>'), { refdes: 'F', w: 10.5, conf: 'iec-approx', params: { char: 'B|C|D', In: 'A', poles: '1|2|3|4', Icn: 'kA' } });
contact('sw.rcd', 'Áram-védőkapcsoló (FI)', 'Residual current device', markBar + link(9, 7) + `<ellipse cx='5' cy='12.6' rx='2.2' ry='0.9'/>` + relBox(9, 5.2, 5, 3.6, 'IΔ') + `<path d='M7.2 12.6 H11.5 V8.8'/>`, { refdes: 'F', w: 14.5, conf: 'iec-approx', params: { In: 'A', IdN: 'mA', type: 'AC|A|F|B', poles: '2|4' } });
contact('sw.rcbo', 'Kombinált FI / kismegszakító (RCBO)', 'RCBO', markX + link(9, 7) + `<ellipse cx='5' cy='12.6' rx='2.2' ry='0.9'/>` + relBox(9, 4.6, 5.5, 4.4, 'I> IΔ') + `<path d='M7.2 12.6 H11.7 V9'/>`, { refdes: 'F', w: 15, conf: 'iec-approx', params: { char: 'B|C', In: 'A', IdN: 'mA', type: 'A|F|B' } });
contact('sw.contactor', 'Mágneskapcsoló főérintkező (kontaktor)', 'Contactor main contact', markArc, { refdes: 'Q' });
contact('sw.mpcb', 'Motorvédő kapcsoló', 'Motor-protective circuit-breaker', markX + link(8.5, 7) + relBox(7, 4.6, 6, 4.6, 'I> ϑ'), { refdes: 'Q', w: 13.5, conf: 'iec-approx' });
add({ id: 'sw.fuse', cat: 'sw', hu: 'Olvadóbiztosító', en: 'Fuse', std: { ref: 'std.60617', part: '07' }, conf: 'iec', w: SW, h: SH, body: `<line x1='5' y1='0' x2='5' y2='15'/><rect x='3.5' y='4' width='3' height='7'/>`, ports: portsV(), anchor: [5, 7.5], refdes: 'F', params: { In: 'A', class: 'gG|aM', size: 'D02|NH00|…' }, use: ['D12', 'D11', 'D23'] });
add({ id: 'sw.fuse-switch', cat: 'sw', hu: 'Biztosítós szakaszolókapcsoló', en: 'Fuse switch-disconnector', std: { ref: 'std.60617', part: '07' }, conf: 'iec-approx', w: SW, h: SH, body: leadTop + `<g transform='rotate(30 5 10)'><line x1='5' y1='10' x2='5' y2='3'/><rect x='3.9' y='4.2' width='2.2' height='4.6'/></g>` + markBar + leadBot, ports: portsV(), anchor: [5, 7.5], refdes: 'Q', use: ['D12', 'D11'] });
add({ id: 'sw.spd', cat: 'sw', hu: 'Túlfeszültség-levezető (SPD)', en: 'Surge protective device', std: { ref: 'std.60617', part: '07' }, conf: 'iec-approx', w: SW, h: 22, body: `<line x1='5' y1='0' x2='5' y2='4'/><rect x='3' y='4' width='4' height='8'/><line x1='5' y1='5' x2='5' y2='10'/><path class='f' d='M3.9 9.2 L6.1 9.2 L5 11 Z'/><line x1='5' y1='12' x2='5' y2='16'/><line x1='2' y1='16' x2='8' y2='16'/><line x1='3' y1='17.4' x2='7' y2='17.4'/><line x1='4' y1='18.8' x2='6' y2='18.8'/>`, ports: [{ id: '1', x: 5, y: 0, dir: 'up' }], anchor: [5, 8], refdes: 'F', params: { type: 'T1|T1+2|T2|T3', Uc: 'V', Iimp: 'kA' }, use: ['D12', 'D21', 'D23'] });
add({ id: 'sw.coil', cat: 'sw', hu: 'Relé / mágneskapcsoló tekercs', en: 'Operating coil', std: { ref: 'std.60617', part: '07' }, conf: 'iec', w: SW, h: SH, body: `<line x1='5' y1='0' x2='5' y2='4.5'/><rect x='1.5' y='4.5' width='7' height='6'/><line x1='5' y1='10.5' x2='5' y2='15'/>`, ports: [{ id: 'A1', x: 5, y: 0, dir: 'up' }, { id: 'A2', x: 5, y: 15, dir: 'down' }], anchor: [5, 7.5], refdes: 'K', use: ['D13'] });
add({ id: 'sw.coil-delay-on', cat: 'sw', hu: 'Időrelé tekercs, meghúzáskésleltetett', en: 'Coil, delayed operation', std: { ref: 'std.60617', part: '07' }, conf: 'iec-approx', w: 15, h: SH, body: `<line x1='5' y1='0' x2='5' y2='4.5'/><rect x='1.5' y='4.5' width='7' height='6'/><rect x='8.5' y='4.5' width='4' height='6'/><path d='M8.5 4.5 L12.5 10.5 M12.5 4.5 L8.5 10.5'/><line x1='5' y1='10.5' x2='5' y2='15'/>`, ports: [{ id: 'A1', x: 5, y: 0, dir: 'up' }, { id: 'A2', x: 5, y: 15, dir: 'down' }], anchor: [5, 7.5], refdes: 'K', use: ['D13'] });
add({ id: 'sw.coil-impulse', cat: 'sw', hu: 'Impulzusrelé (léptetőrelé) tekercs', en: 'Impulse relay coil', std: { ref: 'std.60617', part: '07' }, conf: 'iec-approx', w: SW, h: SH, body: `<line x1='5' y1='0' x2='5' y2='4.5'/><rect x='1.5' y='4.5' width='7' height='6'/><path d='M3 9 L4.5 6 L5.5 9 L7 6'/><line x1='5' y1='10.5' x2='5' y2='15'/>`, ports: [{ id: 'A1', x: 5, y: 0, dir: 'up' }, { id: 'A2', x: 5, y: 15, dir: 'down' }], anchor: [5, 7.5], refdes: 'K', use: ['D13', 'D12'] });
add({ id: 'sw.thermal-relay', cat: 'sw', hu: 'Hőkioldó (túlterhelés-relé)', en: 'Thermal overload relay', std: { ref: 'std.60617', part: '07' }, conf: 'iec-approx', w: SW, h: SH, body: `<line x1='5' y1='0' x2='5' y2='4.5'/><rect x='2' y='4.5' width='6' height='6'/><path d='M5 4.5 V6 H3.6 V9 H5 V10.5'/><line x1='5' y1='10.5' x2='5' y2='15'/>`, ports: portsV(), anchor: [5, 7.5], refdes: 'F', use: ['D13'] });
contact('sw.pushbutton-make', 'Nyomógomb, záró', 'Push-button, make', `<line class='dot' x1='${bladeMid[0]}' y1='${bladeMid[1]}' x2='0.6' y2='${bladeMid[1]}'/><path d='M0.6 5.6 V8.4 M0.6 5.6 H1.4 M0.6 8.4 H1.4'/>`, { refdes: 'S', use: ['D13'] });
add({ id: 'sw.pushbutton-break', cat: 'sw', hu: 'Nyomógomb, bontó', en: 'Push-button, break', std: { ref: 'std.60617', part: '07' }, conf: 'iec', w: SW, h: SH, body: leadTop + `<line x1='5' y1='5' x2='7.6' y2='5'/>` + `<line x1='5' y1='10' x2='5' y2='3.5' transform='rotate(-33 5 10)'/>` + leadBot + `<line class='dot' x1='6.6' y1='7' x2='9.4' y2='7'/><path d='M9.4 5.6 V8.4 M9.4 5.6 H8.6 M9.4 8.4 H8.6'/>`, ports: portsV(), anchor: [5, 7.5], refdes: 'S', use: ['D13'] });
contact('sw.estop', 'Vészleállító (gombafejű, reteszelt)', 'Emergency stop', `<line class='dot' x1='${bladeMid[0]}' y1='${bladeMid[1]}' x2='1.4' y2='${bladeMid[1]}'/><path d='M1.4 4.8 A2.2 2.2 0 0 0 1.4 9.2 Z'/>`, { refdes: 'S', conf: 'iec-approx', use: ['D13'] });
contact('sw.changeover-switch', 'Átkapcsoló I–0–II (hálózat / aggregát)', 'Change-over switch', markBar + txt(8.5, 4, 'I-0-II', 1.8), { conf: 'hu-practice', use: ['D12', 'D11'] });

// =================================================================================================
// 08 · Mérő- és jelzőkészülékek
// =================================================================================================
const M = (o) => add(Object.assign({ cat: 'meas', std: { ref: 'std.60617', part: '08' }, conf: 'iec', w: SW, h: SH, ports: portsV(), anchor: [5, 7.5], refdes: 'P', use: ['D12', 'D11', 'D23'] }, o));
M({ id: 'meas.kwh', hu: 'Fogyasztásmérő (kWh)', en: 'Energy meter', body: `<line x1='5' y1='0' x2='5' y2='4'/><rect x='0.5' y='4' width='9' height='7'/><line x1='0.5' y1='6.2' x2='9.5' y2='6.2'/>` + txt(5, 9.8, 'kWh', 2.4) + `<line x1='5' y1='11' x2='5' y2='15'/>`, params: { phases: '1|3', tariff: 'A1|A2 vezérelt|H|profil' } });
M({ id: 'meas.ammeter', hu: 'Ampermérő', en: 'Ammeter', body: `<line x1='5' y1='0' x2='5' y2='4'/><circle cx='5' cy='7.5' r='3.5'/>` + txt(5, 8.4, 'A', 2.8) + `<line x1='5' y1='11' x2='5' y2='15'/>` });
M({ id: 'meas.voltmeter', hu: 'Voltmérő', en: 'Voltmeter', body: `<line x1='5' y1='0' x2='5' y2='4'/><circle cx='5' cy='7.5' r='3.5'/>` + txt(5, 8.4, 'V', 2.8) + `<line x1='5' y1='11' x2='5' y2='15'/>` });
M({ id: 'meas.ct', hu: 'Áramváltó', en: 'Current transformer', body: `<line x1='5' y1='0' x2='5' y2='15'/><circle cx='5' cy='7.5' r='2.2'/><path d='M7.2 7.5 H9.5 M9.5 6.5 V8.5'/>`, refdes: 'T', conf: 'iec-approx', params: { ratio: '…/5 A', class: '0,5S' } });
M({ id: 'meas.lamp', hu: 'Jelzőlámpa', en: 'Signal lamp', body: `<line x1='5' y1='0' x2='5' y2='4'/>` + lumX(5, 7.5, 3.5) + `<line x1='5' y1='11' x2='5' y2='15'/>`, refdes: 'P', use: ['D13', 'D12'] });
M({ id: 'meas.bell', hu: 'Csengő', en: 'Bell', body: `<line x1='5' y1='0' x2='5' y2='5'/><path d='M1.5 9 A3.5 3.5 0 0 1 8.5 9 Z'/><line x1='5' y1='9' x2='5' y2='15'/>`, refdes: 'P', conf: 'iec-approx', use: ['D13', 'D18'] });
M({ id: 'meas.hour', hu: 'Üzemóra-számláló', en: 'Hour meter', body: `<line x1='5' y1='0' x2='5' y2='4'/><rect x='1' y='4' width='8' height='7'/>` + txt(5, 8.4, 'h', 2.8) + `<line x1='5' y1='11' x2='5' y2='15'/>`, conf: 'iec-approx', use: ['D13'] });

// =================================================================================================
// 06 · Energiaforrások és -átalakítók, gépek
// =================================================================================================
const G = (o) => add(Object.assign({ cat: 'src', std: { ref: 'std.60617', part: '06' }, conf: 'iec', w: SW, h: SH, ports: portsV(), anchor: [5, 7.5], use: ['D11', 'D12', 'D29', 'D35'] }, o));
G({ id: 'src.transformer', hu: 'Transzformátor (kéttekercses)', en: 'Two-winding transformer', body: `<line x1='5' y1='0' x2='5' y2='2.5'/><circle cx='5' cy='5.5' r='3'/><circle cx='5' cy='9.5' r='3'/><line x1='5' y1='12.5' x2='5' y2='15'/>`, refdes: 'T', params: { Sn: 'kVA', U: '22/0,4 kV', vector: 'Dyn11' } });
G({ id: 'src.motor', hu: 'Motor, háromfázisú', en: 'Three-phase motor', body: `<line x1='5' y1='0' x2='5' y2='3'/><circle cx='5' cy='7.5' r='4.5'/>` + txt(5, 7.4, 'M', 3.2) + txt(5, 10.4, '3~', 2.2), ports: [{ id: '1', x: 5, y: 0, dir: 'up' }], refdes: 'M', params: { P: 'kW', start: 'DOL|Y-D|VFD|soft' }, use: ['D12', 'D13', 'D11'] });
G({ id: 'src.generator', hu: 'Generátor / aggregát', en: 'Generator', body: `<line x1='5' y1='0' x2='5' y2='3'/><circle cx='5' cy='7.5' r='4.5'/>` + txt(5, 7.4, 'G', 3.2) + txt(5, 10.4, '3~', 2.2), ports: [{ id: '1', x: 5, y: 0, dir: 'up' }], refdes: 'G' });
G({ id: 'src.battery', hu: 'Akkumulátor', en: 'Battery', body: `<line x1='5' y1='0' x2='5' y2='6'/><line x1='1.5' y1='6' x2='8.5' y2='6'/><line class='w' x1='3.2' y1='8' x2='6.8' y2='8'/><line x1='5' y1='8' x2='5' y2='15'/>` + txt(8.8, 4.8, '+', 2.2), refdes: 'G', conf: 'iec-approx', params: { U: 'V', C: 'Ah|kWh' } });
G({ id: 'src.pv', hu: 'Napelem modulmező (PV generátor)', en: 'PV generator', body: `<rect x='1' y='3' width='8' height='9'/><line x1='1' y1='12' x2='9' y2='3'/><path d='M0 0.8 L2.2 2.6 M1.4 2.6 H2.2 V1.8'/><line x1='5' y1='12' x2='5' y2='15'/>`, ports: [{ id: '2', x: 5, y: 15, dir: 'down' }], refdes: 'G', conf: 'iec-approx', params: { modules: 'db', Pp: 'kWp' } });
G({ id: 'src.inverter', hu: 'Inverter (DC/AC átalakító)', en: 'Inverter', body: `<line x1='5' y1='0' x2='5' y2='2.5'/><rect x='1' y='2.5' width='8' height='10'/><line x1='1' y1='12.5' x2='9' y2='2.5'/>` + txt(3.2, 6.2, '=', 2.6) + txt(6.8, 11.2, '~', 2.6) + `<line x1='5' y1='12.5' x2='5' y2='15'/>`, refdes: 'T' });
G({ id: 'src.rectifier', hu: 'Tápegység (AC/DC)', en: 'Power supply AC/DC', body: `<line x1='5' y1='0' x2='5' y2='2.5'/><rect x='1' y='2.5' width='8' height='10'/><line x1='1' y1='12.5' x2='9' y2='2.5'/>` + txt(3.2, 6.6, '~', 2.6) + txt(6.8, 11, '=', 2.6) + `<line x1='5' y1='12.5' x2='5' y2='15'/>`, refdes: 'T', use: ['D13', 'D18'] });
G({ id: 'src.ups', hu: 'Szünetmentes táp (UPS)', en: 'UPS', body: `<line x1='5' y1='0' x2='5' y2='2.5'/><rect x='0.5' y='2.5' width='9' height='10'/>` + txt(5, 8.6, 'UPS', 2.4) + `<line x1='5' y1='12.5' x2='5' y2='15'/>`, refdes: 'T', conf: 'hu-practice' });
G({ id: 'src.ev', hu: 'Elektromos jármű töltő (EVSE)', en: 'EV charger', body: `<line x1='5' y1='0' x2='5' y2='2.5'/><rect x='0.5' y='2.5' width='9' height='10'/>` + txt(5, 8.6, 'EV', 2.8), ports: [{ id: '1', x: 5, y: 0, dir: 'up' }], refdes: 'E', conf: 'vrg', params: { P: 'kW', mode: '3', rcd: 'A+6mA DC|B' }, use: ['D30', 'D12', 'D16'] });
G({ id: 'src.heater', hu: 'Fűtőtest / villamos fűtés', en: 'Heater', body: `<line x1='5' y1='0' x2='5' y2='2.5'/><rect x='1' y='2.5' width='8' height='10'/><path d='M2.5 10 L3.8 5 L5 10 L6.2 5 L7.5 10'/>`, ports: [{ id: '1', x: 5, y: 0, dir: 'up' }], refdes: 'E', conf: 'iec-approx', use: ['D12', 'D16'] });

// =================================================================================================
// Elosztók, dobozok (alaprajz és séma)
// =================================================================================================
const B = (o) => add(Object.assign({ cat: 'board', std: { ref: 'std.60617', part: '11' }, conf: 'iec-approx', anchor: [6, 3], wall: 'bottom', use: ['D15', 'D16', 'D10', 'D11'], refdes: 'U' }, o));
B({ id: 'board.db', hu: 'Elosztó (alelosztó)', en: 'Distribution board', w: 12, h: 6, body: `<rect x='0.5' y='0.5' width='11' height='5'/><path class='f' d='M11.5 0.5 L11.5 5.5 L0.5 5.5 Z'/>`, ports: [{ id: 'c', x: 6, y: 6, dir: 'down' }] });
B({ id: 'board.main', hu: 'Főelosztó', en: 'Main distribution board', w: 12, h: 6, body: `<rect class='f' x='0.5' y='0.5' width='11' height='5'/>`, ports: [{ id: 'c', x: 6, y: 6, dir: 'down' }] });
B({ id: 'board.meter', hu: 'Fogyasztásmérőhely (mérőszekrény)', en: 'Meter cabinet', w: 12, h: 6, body: `<rect x='0.5' y='0.5' width='11' height='5'/><line x1='4' y1='0.5' x2='4' y2='5.5'/>` + txt(7.8, 4, 'kWh', 2.2), ports: [{ id: 'c', x: 6, y: 6, dir: 'down' }], conf: 'hu-practice', use: ['D10', 'D23', 'D16', 'D11'] });
B({ id: 'board.csf', hu: 'Csatlakozó főelosztó (CSF)', en: 'Service connection box', w: 12, h: 6, body: `<rect x='0.5' y='0.5' width='11' height='5'/><path class='f' d='M0.5 0.5 H4 V5.5 H0.5 Z'/>` + txt(7.8, 4, 'CSF', 2.2), ports: [{ id: 'c', x: 6, y: 6, dir: 'down' }], conf: 'hu-practice', use: ['D10', 'D23', 'D11'] });
B({ id: 'board.control', hu: 'Vezérlőszekrény (automatika)', en: 'Control panel', w: 12, h: 6, body: `<rect x='0.5' y='0.5' width='11' height='5'/><path d='M0.5 5.5 L11.5 0.5'/>` + txt(8.6, 4.6, 'A', 2.2), ports: [{ id: 'c', x: 6, y: 6, dir: 'down' }], conf: 'hu-practice', use: ['D16', 'D26', 'D11'] });
B({ id: 'board.jbox', hu: 'Kötődoboz / elágazó doboz', en: 'Junction box', w: 4, h: 4, anchor: [2, 2], wall: null, body: `<circle cx='2' cy='2' r='1.5'/><circle class='f' cx='2' cy='2' r='0.5'/>`, ports: [{ id: 'c', x: 2, y: 2, dir: 'any' }], use: ['D15', 'D16'] });
B({ id: 'board.fireman', hu: 'Tűzvédelmi főkapcsoló (TVK)', en: 'Fire-fighter switch', w: 12, h: 6, body: `<rect x='0.5' y='0.5' width='11' height='5'/><path class='f' d='M0.5 0.5 L6 3 L0.5 5.5 Z'/>` + txt(8.8, 4, 'TVK', 2), ports: [{ id: 'c', x: 6, y: 6, dir: 'down' }], conf: 'hu-practice', std: { ref: 'law.otsz' }, use: ['D16', 'D11', 'D20'] });

// =================================================================================================
// 11 · Épületinstallációs (alaprajzi) jelek — szerelvények
// =================================================================================================
const I = (o) => add(planBase(Object.assign({ cat: 'inst', std: { ref: 'std.60617', part: '11' }, conf: 'iec-approx', use: ['D15', 'D16'], refdes: 'X' }, o)));
I({ id: 'inst.socket', hu: 'Dugaszolóaljzat (védőérintkező nélkül)', en: 'Socket outlet', body: cup, note: 'Lakóépületben csak meglévő állapot felmérésére.' });
I({ id: 'inst.socket-pe', hu: 'Dugaszolóaljzat, védőérintkezős 2P+F', en: 'Socket outlet with earth', body: cup + peBar, params: { In: '16 A', ip: 'IP20' } });
I({ id: 'inst.socket-2', hu: 'Kettős dugaszolóaljzat 2× 2P+F', en: 'Double socket outlet', body: cup + peBar + txt(9.4, 9.5, '2', 2.4) });
I({ id: 'inst.socket-3', hu: 'Hármas dugaszolóaljzat 3× 2P+F', en: 'Triple socket outlet', body: cup + peBar + txt(9.4, 9.5, '3', 2.4) });
I({ id: 'inst.socket-ip44', hu: 'Dugaszolóaljzat, fedeles, IP44 (nedves helyiség)', en: 'Socket outlet IP44', body: `<path class='f' d='M2 4 A3 3 0 0 0 8 4 Z'/><line x1='5' y1='7' x2='5' y2='10'/>` + peBar, conf: 'hu-practice', params: { ip: 'IP44' } });
I({ id: 'inst.socket-3ph', hu: 'Háromfázisú dugaszolóaljzat 3P+N+F (CEE)', en: 'Three-phase socket outlet', body: cup + peBar + `<path d='M3.2 6.6 L4 5 M4.6 6.8 L5.4 5.2 M6 6.6 L6.8 5'/>`, params: { In: '16|32 A' } });
I({ id: 'inst.socket-switched', hu: 'Kapcsolt dugaszolóaljzat', en: 'Switched socket outlet', body: cup + peBar + `<line x1='5' y1='2.6' x2='8' y2='0.2'/><line x1='8' y1='0.2' x2='9' y2='1.2'/>` });
I({ id: 'inst.socket-usb', hu: 'Dugaszolóaljzat USB töltővel', en: 'Socket outlet with USB', body: cup + peBar + txt(9.6, 9.5, 'U', 2.2), conf: 'vrg' });
I({ id: 'inst.socket-floor', hu: 'Padlódoboz dugaszolóaljzattal', en: 'Floor box outlet', body: `<rect x='1' y='1' width='8' height='8'/>` + `<path d='M2.8 4.2 A2.2 2.2 0 0 0 7.2 4.2'/><line x1='5' y1='6.4' x2='5' y2='8'/><line x1='2.8' y1='3.2' x2='7.2' y2='3.2'/>`, wall: null, conf: 'hu-practice' });
I({ id: 'inst.socket-shaver', hu: 'Borotva-csatlakozó (leválasztó transzformátoros)', en: 'Shaver supply unit', body: cup + `<circle cx='3.6' cy='1.8' r='1.3'/><circle cx='6.4' cy='1.8' r='1.3'/>` });
I({ id: 'inst.fixed', hu: 'Fix bekötés / kábelkiállás', en: 'Fixed connection outlet', body: `<line x1='5' y1='10' x2='5' y2='5'/><rect class='f' x='3.5' y='2' width='3' height='3'/>`, conf: 'hu-practice', refdes: 'W', params: { label: 'pl. BOJ, FŐZ, KLÍ' }, note: 'Készülék rövidjele a jel mellé: BOJ bojler, FŐZ főzőlap, SÜT sütő, KLÍ klíma, HSZ hőszivattyú, MOS mosógép.' });
I({ id: 'inst.cable-tail', hu: 'Előkészítés / kábelvég (hossz megadással)', en: 'Provisioned cable end', body: `<line x1='5' y1='10' x2='5' y2='4'/><path d='M3 4 L5 1 L7 4'/>`, conf: 'vrg', refdes: 'W', params: { tail: 'm', purpose: 'szöveg' }, note: 'CE-6: célja, kábelvég hossza, magassága, kiszolgált készülék.' });

// switches
const SWU = ['D15'];
I({ id: 'inst.sw-1p', hu: 'Kapcsoló, egysarkú (101)', en: 'Switch, one-pole', body: swRing + lever() + tick(0), refdes: 'S', use: SWU, code: '101' });
I({ id: 'inst.sw-2p', hu: 'Kapcsoló, kétsarkú (102)', en: 'Switch, two-pole', body: swRing + lever() + tick(0) + tick(1), refdes: 'S', use: SWU, code: '102' });
I({ id: 'inst.sw-3p', hu: 'Kapcsoló, háromsarkú (103)', en: 'Switch, three-pole', body: swRing + lever() + tick(0) + tick(1) + tick(2), refdes: 'S', use: SWU, code: '103' });
I({ id: 'inst.sw-series', hu: 'Csillárkapcsoló (105)', en: 'Series (two-circuit) switch', body: swRing + lever() + tick(0) + `<line x1='4.08' y1='6.08' x2='2.2' y2='2.0'/><line x1='2.2' y1='2.0' x2='3.4' y2='1.5'/>`, refdes: 'S', use: SWU, code: '105' });
I({ id: 'inst.sw-2way', hu: 'Váltókapcsoló (106)', en: 'Two-way switch', body: swRing + lever() + tick(0) + `<line x1='4.08' y1='7.92' x2='1.6' y2='10.4'/><line x1='1.6' y1='10.4' x2='0.5' y2='9.3'/>`, refdes: 'S', use: SWU, code: '106', wall: 'bottom' });
I({ id: 'inst.sw-intermediate', hu: 'Keresztkapcsoló (107)', en: 'Intermediate switch', body: swRing + lever() + tick(0) + lever(-1) + tick(0, -1) + `<line x1='4.08' y1='7.92' x2='1.6' y2='10.4'/><line x1='5.92' y1='7.92' x2='8.4' y2='10.4'/>`, refdes: 'S', use: SWU, code: '107' });
I({ id: 'inst.sw-2way-double', hu: 'Dupla váltókapcsoló (108)', en: 'Double two-way switch', body: swRing + lever() + tick(0) + lever(-1) + tick(0, -1) + `<line x1='4.08' y1='7.92' x2='1.6' y2='10.4'/><line x1='1.6' y1='10.4' x2='0.5' y2='9.3'/><line x1='5.92' y1='7.92' x2='8.4' y2='10.4'/><line x1='8.4' y1='10.4' x2='9.5' y2='9.3'/>`, refdes: 'S', use: SWU, code: '108', conf: 'vrg' });
I({ id: 'inst.sw-dimmer', hu: 'Fényerő-szabályozó', en: 'Dimmer', body: swRing + lever() + tick(0) + `<path d='M1.2 9.6 L8.6 4.2'/><path class='f' d='M8.6 4.2 L7.1 4.5 L7.9 5.6 Z'/>`, refdes: 'S', use: SWU });
I({ id: 'inst.sw-push', hu: 'Nyomókapcsoló (impulzus, csengő)', en: 'Push-button', body: `<circle cx='5' cy='6' r='2.6'/><circle cx='5' cy='6' r='1'/>`, refdes: 'S', use: SWU });
I({ id: 'inst.sw-push-lit', hu: 'Nyomókapcsoló jelzőfénnyel', en: 'Push-button with indicator', body: `<circle cx='5' cy='6' r='2.6'/><circle cx='5' cy='6' r='1'/><path d='M3.2 4.2 L6.8 7.8 M6.8 4.2 L3.2 7.8'/>`, refdes: 'S', use: SWU });
I({ id: 'inst.sw-timer', hu: 'Lépcsőházi időkapcsoló nyomógombja', en: 'Time-delay push-button', body: `<circle cx='5' cy='6' r='2.6'/><circle cx='5' cy='6' r='1'/>` + txt(9, 3, 't', 2.4), refdes: 'S', use: SWU, conf: 'hu-practice' });
I({ id: 'inst.sw-pull', hu: 'Húzókapcsoló', en: 'Pull-cord switch', body: swRing + lever() + tick(0) + `<line x1='5' y1='5.7' x2='5' y2='1'/><path class='f' d='M4.3 2.2 L5 0.8 L5.7 2.2 Z'/>`, refdes: 'S', use: SWU });
I({ id: 'inst.sw-key', hu: 'Kulcsos kapcsoló', en: 'Key switch', body: swRing + lever() + tick(0) + `<circle cx='2' cy='3' r='1'/><line x1='2.7' y1='3.7' x2='4' y2='5'/>`, refdes: 'S', use: SWU });
I({ id: 'inst.pir', hu: 'Mozgásérzékelő (jelenlét-érzékelő)', en: 'Motion detector', body: `<circle cx='5' cy='6' r='2.8'/>` + txt(5, 6.9, 'PIR', 1.7) + `<path d='M1 2.6 A5 5 0 0 1 9 2.6'/>`, refdes: 'B', use: SWU, conf: 'hu-practice', wall: null });
I({ id: 'inst.thermostat', hu: 'Termosztát (helyiség)', en: 'Room thermostat', body: `<rect x='2' y='2.5' width='6' height='6'/>` + txt(5, 7, 'ϑ', 3), refdes: 'B', use: ['D16', 'D26'], conf: 'iec-approx' });
I({ id: 'inst.timer', hu: 'Időkapcsoló (kapcsolóóra)', en: 'Time switch', body: `<circle cx='5' cy='5.5' r='3.2'/><path d='M5 5.5 V3.2 M5 5.5 H6.8'/>`, refdes: 'K', use: ['D12', 'D15'], wall: null });

// =================================================================================================
// Lámpatestek
// =================================================================================================
const L = (o) => add(planBase(Object.assign({ cat: 'lum', std: { ref: 'std.60617', part: '11' }, conf: 'iec', use: ['D15'], refdes: 'E', wall: null, ports: [{ id: 'c', x: 5, y: 5, dir: 'any' }] }, o)));
L({ id: 'lum.outlet', hu: 'Lámpakiállás (világítási csatlakozási pont)', en: 'Lighting outlet', body: `<path d='M2.5 2.5 L7.5 7.5 M7.5 2.5 L2.5 7.5'/>` });
L({ id: 'lum.general', hu: 'Lámpatest, általános', en: 'Luminaire', body: lumX(), params: { P: 'W', type: 'szöveg' } });
L({ id: 'lum.wall', hu: 'Fali lámpatest', en: 'Wall luminaire', body: lumX(5, 5, 3) + `<line x1='5' y1='8' x2='5' y2='10'/><line x1='2.5' y1='10' x2='7.5' y2='10'/>`, wall: 'bottom', ports: [{ id: 'c', x: 5, y: 10, dir: 'down' }], conf: 'iec-approx' });
L({ id: 'lum.spot', hu: 'Beépített spot / downlight', en: 'Recessed downlight', body: `<circle cx='5' cy='5' r='2'/><circle class='f' cx='5' cy='5' r='0.7'/>`, conf: 'hu-practice' });
L({ id: 'lum.linear', hu: 'Vonali lámpatest (fénycső / LED vonal)', en: 'Linear luminaire', w: 16, h: 6, anchor: [8, 3], body: `<line class='w' x1='1' y1='3' x2='15' y2='3'/><line x1='1' y1='1' x2='1' y2='5'/><line x1='15' y1='1' x2='15' y2='5'/>`, ports: [{ id: 'c', x: 8, y: 3, dir: 'any' }] });
L({ id: 'lum.panel', hu: 'LED panel (álmennyezeti)', en: 'LED panel', body: `<rect x='1' y='1' width='8' height='8'/><path d='M1 1 L9 9 M9 1 L1 9'/>`, conf: 'hu-practice' });
L({ id: 'lum.strip', hu: 'LED szalag', en: 'LED strip', w: 16, h: 6, anchor: [8, 3], body: `<line x1='1' y1='3' x2='15' y2='3'/><circle class='f' cx='4' cy='3' r='0.6'/><circle class='f' cx='8' cy='3' r='0.6'/><circle class='f' cx='12' cy='3' r='0.6'/>`, ports: [{ id: 'c', x: 1, y: 3, dir: 'left' }], conf: 'vrg' });
L({ id: 'lum.flood', hu: 'Fényvető (reflektor)', en: 'Floodlight', body: lumX(4.5, 5.5, 2.8) + `<path d='M7.6 3 L9.6 1.4 M8 5.5 H10 M7.6 8 L9.6 9.6'/>`, conf: 'iec-approx' });
L({ id: 'lum.outdoor', hu: 'Kültéri lámpatest (IP jelöléssel)', en: 'Outdoor luminaire', body: lumX() + `<circle cx='5' cy='5' r='4.3'/>`, conf: 'hu-practice', params: { ip: 'IP44|IP65' } });
L({ id: 'lum.emergency', hu: 'Biztonsági lámpatest (önálló akkus)', en: 'Emergency luminaire, self-contained', body: lumX() + `<rect class='f' x='3.8' y='0.2' width='2.4' height='1.4'/>`, conf: 'hu-practice', use: ['D20'], params: { mode: 'készenléti|üzemi', t: '1h|3h' } });
L({ id: 'lum.emergency-central', hu: 'Biztonsági lámpatest (központi akkus rendszer)', en: 'Emergency luminaire, central battery', body: lumX() + `<rect class='f' x='3.8' y='0.2' width='2.4' height='1.4'/><rect class='f' x='3.8' y='8.4' width='2.4' height='1.4'/>`, conf: 'hu-practice', use: ['D20'] });
L({ id: 'lum.exit', hu: 'Menekülési útirány-jelző (kijáratjelző)', en: 'Exit sign luminaire', w: 12, h: 6, anchor: [6, 3], body: `<rect x='0.5' y='0.5' width='11' height='5'/><path d='M2.5 3 H8.5 M7 1.6 L8.6 3 L7 4.4'/>`, ports: [{ id: 'c', x: 6, y: 3, dir: 'any' }], conf: 'hu-practice', use: ['D20'], params: { dir: '←|→|↑|↓' } });

// =================================================================================================
// Gyengeáram (infokommunikáció, AV, vagyonvédelem)
// =================================================================================================
const W = (o) => add(planBase(Object.assign({ cat: 'wc', std: { ref: 'std.60617', part: '11' }, conf: 'iec-approx', use: ['D17', 'D18'], refdes: 'X' }, o)));
const tcup = (label) => `<path d='M2 4 A3 3 0 0 0 8 4'/><line x1='2' y1='4' x2='8' y2='4'/><line x1='5' y1='7' x2='5' y2='10'/>` + txt(5, 2.8, label, 2);
W({ id: 'wc.data', hu: 'Informatikai csatlakozó (RJ45)', en: 'Data outlet', body: tcup('TP'), params: { ports: '1|2', cat: '6|6A' } });
W({ id: 'wc.tel', hu: 'Telefon csatlakozó', en: 'Telephone outlet', body: tcup('TF') });
W({ id: 'wc.tv', hu: 'TV / rádió antenna csatlakozó', en: 'TV outlet', body: tcup('TV') });
W({ id: 'wc.sat', hu: 'SAT csatlakozó', en: 'Satellite outlet', body: tcup('SAT') });
W({ id: 'wc.fiber', hu: 'Optikai csatlakozó (FTTH)', en: 'Fibre outlet', body: tcup('FO') });
W({ id: 'wc.ap', hu: 'WiFi hozzáférési pont', en: 'Wireless access point', body: `<circle class='f' cx='5' cy='7' r='0.8'/><path d='M2.8 4.8 A3 3 0 0 1 7.2 4.8 M1.2 3.2 A5.3 5.3 0 0 1 8.8 3.2'/>`, conf: 'vrg', refdes: 'T', wall: null });
W({ id: 'wc.rack', hu: 'Rack szekrény / rendezőpont', en: 'Rack / distributor', w: 12, h: 6, anchor: [6, 3], body: `<rect x='0.5' y='0.5' width='11' height='5'/><path d='M0.5 2.2 H11.5 M0.5 3.8 H11.5'/>`, ports: [{ id: 'c', x: 6, y: 6, dir: 'down' }], conf: 'hu-practice', refdes: 'U', use: ['D17', 'D18'] });
W({ id: 'wc.door-station', hu: 'Kaputelefon kültéri egység', en: 'Door station', body: `<rect x='2' y='1' width='6' height='8'/><circle cx='5' cy='3.6' r='1.2'/><path d='M3.4 6.6 H6.6'/>`, conf: 'hu-practice', refdes: 'B' });
W({ id: 'wc.indoor-station', hu: 'Kaputelefon beltéri egység', en: 'Indoor station', body: `<rect x='2' y='1' width='6' height='8'/><rect x='3' y='2' width='4' height='3'/><circle class='f' cx='5' cy='7' r='0.6'/>`, conf: 'hu-practice', refdes: 'P' });
W({ id: 'wc.bell-push', hu: 'Csengőnyomó', en: 'Bell push', body: `<circle cx='5' cy='6' r='2'/><circle class='f' cx='5' cy='6' r='0.8'/>`, refdes: 'S' });
W({ id: 'wc.camera', hu: 'Kamera (CCTV / IP)', en: 'Camera', body: `<rect x='1' y='3' width='6' height='4'/><path d='M7 4 L9.5 2.6 V7.4 L7 6 Z'/><line x1='4' y1='7' x2='4' y2='10'/>`, conf: 'hu-practice', refdes: 'B' });
W({ id: 'wc.speaker', hu: 'Hangszóró', en: 'Loudspeaker', body: `<rect x='2' y='3.5' width='2.2' height='3'/><path d='M4.2 3.5 L7.6 1 V9 L4.2 6.5'/>`, conf: 'iec-approx', refdes: 'P', wall: null });
W({ id: 'wc.alarm-panel', hu: 'Riasztó központ', en: 'Intruder alarm panel', w: 12, h: 6, anchor: [6, 3], body: `<rect x='0.5' y='0.5' width='11' height='5'/>` + txt(6, 4.1, 'RIA', 2.4), ports: [{ id: 'c', x: 6, y: 6, dir: 'down' }], conf: 'hu-practice', refdes: 'A' });
W({ id: 'wc.keypad', hu: 'Kezelőegység (riasztó / beléptető)', en: 'Keypad', body: `<rect x='2' y='1.5' width='6' height='7'/><path d='M3.4 4 H6.6 M3.4 5.5 H6.6 M3.4 7 H6.6'/>`, conf: 'hu-practice', refdes: 'S' });
W({ id: 'wc.reader', hu: 'Kártyaolvasó (beléptető)', en: 'Access reader', body: `<rect x='2' y='1.5' width='6' height='7'/><path d='M3.5 4 A2 2 0 0 1 6.5 4 M4.3 5.3 A1 1 0 0 1 5.7 5.3'/>`, conf: 'vrg', refdes: 'B' });
W({ id: 'wc.pir', hu: 'Riasztó mozgásérzékelő', en: 'Intruder motion detector', body: `<path d='M1 9 L5 2 L9 9 Z'/>` + txt(5, 8.2, 'IR', 1.8), conf: 'hu-practice', refdes: 'B' });
W({ id: 'wc.contact', hu: 'Nyitásérzékelő (mágneses)', en: 'Door/window contact', body: `<rect x='1.5' y='3.5' width='3' height='3'/><rect class='f' x='5.5' y='3.5' width='3' height='3'/>`, conf: 'hu-practice', refdes: 'B' });
W({ id: 'wc.siren', hu: 'Hang- és fényjelző (sziréna)', en: 'Siren', body: `<path d='M2 7 V3 H4 L7.5 1 V9 L4 7 Z'/>`, conf: 'hu-practice', refdes: 'P' });

// =================================================================================================
// Tűzjelző (EN 54 rendszerelemek — gyakorlati jelek)
// =================================================================================================
const F = (o) => add(planBase(Object.assign({ cat: 'fire', std: { ref: 'std.54' }, conf: 'hu-practice', use: ['D19'], refdes: 'B', wall: null, ports: [{ id: 'c', x: 5, y: 5, dir: 'any' }] }, o)));
const fsq = `<rect x='1.5' y='1.5' width='7' height='7'/>`;
F({ id: 'fire.smoke', hu: 'Optikai füstérzékelő', en: 'Optical smoke detector', body: fsq + `<path d='M3 7 C3.5 5.5 4.5 6 4.5 4.8 C4.5 3.6 5.6 3.6 5.6 2.8 M5.4 7 C5.9 5.5 6.9 6 6.9 4.8'/>` });
F({ id: 'fire.heat', hu: 'Hősérzékelő', en: 'Heat detector', body: fsq + txt(5, 6.4, 'ϑ', 3.4) });
F({ id: 'fire.multi', hu: 'Multiszenzoros érzékelő (füst + hő)', en: 'Multi-sensor detector', body: fsq + `<path d='M2.6 7 C3.1 5.5 4 6 4 4.6'/>` + txt(6.4, 6.4, 'ϑ', 2.6) });
F({ id: 'fire.co', hu: 'CO érzékelő', en: 'CO detector', body: fsq + txt(5, 6.1, 'CO', 2.4) });
F({ id: 'fire.mcp', hu: 'Kézi jelzésadó (kézi tűzjelző)', en: 'Manual call point', body: fsq + `<circle class='f' cx='5' cy='5' r='1.6'/>`, wall: 'bottom', ports: [{ id: 'c', x: 5, y: 10, dir: 'down' }], refdes: 'S' });
F({ id: 'fire.sounder', hu: 'Hangjelző (tűzjelző)', en: 'Fire alarm sounder', body: fsq + `<path d='M3 6.8 V3.6 H4.2 L6.8 2.4 V8 L4.2 6.8 Z'/>`, refdes: 'P' });
F({ id: 'fire.beacon', hu: 'Fényjelző (tűzjelző)', en: 'Fire alarm beacon', body: fsq + `<circle cx='5' cy='5' r='1.2'/><path d='M5 2.4 V3.2 M5 6.8 V7.6 M2.4 5 H3.2 M6.8 5 H7.6'/>`, refdes: 'P' });
F({ id: 'fire.module', hu: 'Be-/kimeneti modul (vezérlő)', en: 'I/O module', body: fsq + txt(5, 6.1, 'M', 2.8), refdes: 'A' });
F({ id: 'fire.panel', hu: 'Tűzjelző központ (TJK)', en: 'Fire alarm control panel', w: 12, h: 6, anchor: [6, 3], body: `<rect x='0.5' y='0.5' width='11' height='5'/><rect class='f' x='0.5' y='0.5' width='2.6' height='5'/>` + txt(7.4, 4.1, 'TJK', 2.4), ports: [{ id: 'c', x: 6, y: 6, dir: 'down' }], wall: 'bottom', refdes: 'A' });
F({ id: 'fire.smoke-vent', hu: 'Hő- és füstelvezetés kezelő (HFR)', en: 'Smoke vent control', body: fsq + txt(5, 6.1, 'HF', 2.4), wall: 'bottom', ports: [{ id: 'c', x: 5, y: 10, dir: 'down' }], refdes: 'S' });

// =================================================================================================
// Villámvédelem és földelés
// =================================================================================================
const P = (o) => add(planBase(Object.assign({ cat: 'lps', std: { ref: 'std.62305' }, conf: 'hu-practice', use: ['D21', 'D22'], refdes: 'W', wall: null, ports: [{ id: 'c', x: 5, y: 5, dir: 'any' }] }, o)));
P({ id: 'lps.air-rod', hu: 'Felfogórúd (felülnézet)', en: 'Air-termination rod', body: `<circle cx='5' cy='5' r='2.4'/><circle class='f' cx='5' cy='5' r='1'/>` });
P({ id: 'lps.down', hu: 'Levezető (lefelé)', en: 'Down conductor', body: `<circle cx='5' cy='5' r='2.4'/><path d='M3.3 3.3 L6.7 6.7'/><path class='f' d='M6.9 6.9 L5.4 6.6 L6.6 5.4 Z'/>` });
P({ id: 'lps.test-joint', hu: 'Vizsgáló összekötő', en: 'Test joint', body: `<line x1='5' y1='0' x2='5' y2='10'/><rect x='3' y='3.5' width='4' height='3'/>` });
P({ id: 'lps.electrode', hu: 'Földelő szonda / rúdföldelő', en: 'Earth rod', body: `<line x1='5' y1='0' x2='5' y2='5'/><path d='M2 5 H8 M3 6.4 H7 M4 7.8 H6'/><circle cx='5' cy='6.4' r='3.4'/>` });
P({ id: 'lps.mesb', hu: 'Fő földelősín (FFS)', en: 'Main earthing terminal', w: 12, h: 6, anchor: [6, 3], body: `<rect x='0.5' y='1.5' width='11' height='3'/><circle class='f' cx='3' cy='3' r='0.6'/><circle class='f' cx='6' cy='3' r='0.6'/><circle class='f' cx='9' cy='3' r='0.6'/>`, refdes: 'X', ports: [{ id: 'c', x: 6, y: 6, dir: 'down' }] });
P({ id: 'lps.bond', hu: 'EPH bekötési pont (csőbilincs)', en: 'Bonding point', body: `<circle cx='5' cy='5' r='2.6'/><line x1='5' y1='7.6' x2='5' y2='10'/><path d='M3.4 5 H6.6'/>`, wall: 'bottom', ports: [{ id: 'c', x: 5, y: 10, dir: 'down' }] });
P({ id: 'lps.spd-zone', hu: 'Túlfeszültség-levezető LPZ határon', en: 'SPD at zone boundary', body: `<path d='M5 1 L8.5 8.5 H1.5 Z'/><path d='M5 3.2 L4 5.8 H6 L5 8.4'/>`, refdes: 'F', conf: 'vrg' });

// =================================================================================================
// Alaprajzi jelölések, annotáció
// =================================================================================================
const N = (o) => add(planBase(Object.assign({ cat: 'ann', std: { ref: 'practice.vrg' }, conf: 'hu-practice', use: ['D15', 'D16', 'D17', 'D10'], refdes: null, wall: null, ports: [] }, o)));
N({ id: 'ann.riser-up', hu: 'Felszálló vezeték (felfelé)', en: 'Riser up', body: `<circle class='f' cx='3' cy='7' r='0.8'/><line x1='3' y1='7' x2='8' y2='2'/><path class='f' d='M8.6 1.4 L6.6 2 L8 3.4 Z'/>`, ports: [{ id: 'c', x: 3, y: 7, dir: 'any' }], conf: 'iec-approx', std: { ref: 'std.60617', part: '11' } });
N({ id: 'ann.riser-down', hu: 'Leszálló vezeték (lefelé)', en: 'Riser down', body: `<circle class='f' cx='8' cy='2' r='0.8'/><line x1='8' y1='2' x2='3' y2='7'/><path class='f' d='M2.4 7.6 L3 5.6 L4.4 7 Z'/>`, ports: [{ id: 'c', x: 8, y: 2, dir: 'any' }], conf: 'iec-approx', std: { ref: 'std.60617', part: '11' } });
N({ id: 'ann.riser-through', hu: 'Átmenő függőleges vezeték', en: 'Riser through', body: `<circle class='f' cx='5' cy='5' r='0.8'/><line x1='1.5' y1='8.5' x2='8.5' y2='1.5'/><path class='f' d='M9.1 0.9 L7.1 1.5 L8.5 2.9 Z'/><path class='f' d='M0.9 9.1 L1.5 7.1 L2.9 8.5 Z'/>`, ports: [{ id: 'c', x: 5, y: 5, dir: 'any' }], conf: 'iec-approx', std: { ref: 'std.60617', part: '11' } });
N({ id: 'ann.north', hu: 'Északjel', en: 'North arrow', w: 10, h: 14, anchor: [5, 7], body: `<circle cx='5' cy='8' r='4.5'/><path d='M5 1 L7.2 9 L5 7.6 L2.8 9 Z'/>` + txt(5, 13.9, 'É', 2.6), use: ['D10', 'D15', 'D16', 'D21'] });
N({ id: 'ann.level', hu: 'Szintjel (±0,00)', en: 'Level mark', w: 14, h: 6, anchor: [3, 5], body: `<path d='M1 2 L3 5 L5 2 Z'/><line x1='0' y1='5' x2='14' y2='5'/>` + txt(9.5, 3.6, '±0,00', 2.2), use: ['D21', 'D11'] });
N({ id: 'ann.section', hu: 'Metszetjel', en: 'Section mark', w: 10, h: 10, anchor: [5, 5], body: `<line class='w' x1='5' y1='0' x2='5' y2='4'/><path class='f' d='M5 4 L9 4 L7 6.5 Z'/>` + txt(4, 9, 'A', 2.6), use: ['D21', 'D27'] });
N({ id: 'ann.detail', hu: 'Részlet-hivatkozás', en: 'Detail reference', body: `<circle cx='5' cy='5' r='4.2'/><line x1='0.8' y1='5' x2='9.2' y2='5'/>` + txt(5, 4.2, '3', 2.2) + txt(5, 8.2, 'V-401', 1.6), use: ['D15', 'D16', 'D28'] });
N({ id: 'ann.axis', hu: 'Tengelyjel', en: 'Grid axis bubble', body: `<circle cx='5' cy='4.5' r='3.5'/><line class='dot' x1='5' y1='8' x2='5' y2='10'/>` + txt(5, 5.4, 'A', 2.6), use: ['D27', 'D15'] , std: { ref: 'std.4157' } });
N({ id: 'ann.revision', hu: 'Módosítási indexjel', en: 'Revision triangle', body: `<path d='M5 1.5 L9 8.5 H1 Z'/>` + txt(5, 7.6, 'b', 2.4), use: ['D15', 'D16', 'D12'] });
N({ id: 'ann.circuit', hu: 'Áramköri jel (elosztó/áramkör)', en: 'Circuit tag', w: 14, h: 6, anchor: [7, 3], body: `<path d='M2 0.8 H12 L13.4 3 L12 5.2 H2 L0.6 3 Z'/>` + txt(7, 4, 'EL1/12', 2.2), use: ['D15', 'D16'], conf: 'vrg' });
N({ id: 'ann.height', hu: 'Magasság eltérés (H=)', en: 'Height tag', w: 12, h: 5, anchor: [6, 2.5], body: txt(6, 3.4, 'H=110', 2.4) + `<line x1='1' y1='4.4' x2='11' y2='4.4'/>`, use: ['D15', 'D16'], conf: 'vrg' });
N({ id: 'ann.group-letter', hu: 'Kapcsolási csoport betű', en: 'Control group letter', w: 6, h: 6, anchor: [3, 3], body: `<circle cx='3' cy='3' r='2.4'/>` + txt(3, 3.9, 'A', 2.4), use: ['D15'], conf: 'vrg' });
N({ id: 'ann.state-remove', hu: 'Bontandó jelölés (áthúzás)', en: 'Remove mark', body: `<path d='M0.5 0.5 L9.5 9.5 M9.5 0.5 L0.5 9.5'/>`, use: ['D33'], conf: 'vrg' });
N({ id: 'ann.state-replace', hu: 'Cserélendő jelölés', en: 'Replace mark', body: `<rect x='0.5' y='0.5' width='9' height='9'/>`, use: ['D33'], conf: 'vrg' });
N({ id: 'ann.tray', hu: 'Kábeltálca (keresztmetszet jel)', en: 'Cable tray section', w: 12, h: 6, anchor: [6, 3], body: `<path d='M0.5 1 V5 H11.5 V1'/><path d='M3 3.4 L4 2.4 M6 3.4 L7 2.4 M9 3.4 L10 2.4'/>`, use: ['D27'], conf: 'hu-practice' });
N({ id: 'ann.penetration', hu: 'Áttörés (tűzgátló tömítéssel)', en: 'Penetration, fire-stopped', body: `<rect x='1.5' y='1.5' width='7' height='7'/><path d='M1.5 8.5 L8.5 1.5'/><path class='f' d='M1.5 1.5 H4 L1.5 4 Z'/>`, use: ['D27', 'D28'], conf: 'vrg' });

module.exports = S;
