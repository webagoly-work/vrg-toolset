// P33-BUILD-001 figures. T1 — the system spine, read left to right:
// supply -> cabinet -> BASE -> hub RoomBox -> branch RoomBoxes -> rooms.
// De-identified (no address): this file and its output are tracked in git.
//
//   node p33-topology.js   -> ../fig/P33-T1_system-spine.svg (+ .png via headless Chrome)

const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const FIG = path.join(__dirname, '..', 'fig');
fs.mkdirSync(FIG, { recursive: true });

const C = {
  ink: '#1f2933', sub: '#52606d', line: '#9aa5b1', panel: '#f5f7fa',
  channel: '#1d4ed8', mains: '#c2410c', data: '#15803d', link: '#7c3aed', sec: '#334155',
  base: '#e0e7ff', box: '#dbeafe', boxE: '#e0f2fe', room: '#ffffff', future: '#f8fafc', load: '#fff7ed',
};
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

function text(x, y, s, o = {}) {
  const lines = String(s).split('\n'), size = o.size || 14, lh = size * 1.25;
  return `<text x="${x}" y="${y}" font-size="${size}" font-weight="${o.weight || 400}" fill="${o.color || C.ink}" text-anchor="${o.anchor || 'start'}"${o.italic ? ' font-style="italic"' : ''}>` +
    lines.map((l, i) => `<tspan x="${x}" dy="${i ? lh : 0}">${esc(l) || ' '}</tspan>`).join('') + '</text>';
}
// node: title bar + body lines
function node(x, y, w, h, title, body, o = {}) {
  const fill = o.fill || C.box, stroke = o.stroke || C.channel;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${fill}" stroke="${stroke}" stroke-width="${o.sw || 2}"${o.dash ? ' stroke-dasharray="7 5"' : ''}/>` +
    text(x + 12, y + 24, title, { size: o.tsize || 16, weight: 700, color: o.tcolor || C.ink }) +
    (body ? text(x + 12, y + 46, body, { size: o.bsize || 12.5, color: C.sub }) : '');
}
function wire(pts, color, o = {}) {
  const d = 'M' + pts.map(p => p.join(',')).join(' L');
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${o.w || 2.5}" stroke-linejoin="round"${o.dash ? ` stroke-dasharray="${o.dash}"` : ''}${o.arrow === false ? '' : ` marker-end="url(#a${color.slice(1)})"`}/>`;
}
const label = (x, y, s, color, o = {}) => text(x, y, s, Object.assign({ size: 11.5, color, weight: 600 }, o));
const chip = (x, y, w, s, o = {}) => `<rect x="${x}" y="${y}" width="${w}" height="30" rx="15" fill="${o.fill || C.room}" stroke="${o.stroke || C.line}" stroke-width="1.5"${o.dash ? ' stroke-dasharray="5 4"' : ''}/>` +
  text(x + 14, y + 20, s, { size: 13, color: C.ink });

function t1() {
  let s = '';
  const marker = c => `<marker id="a${c.slice(1)}" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="11" markerHeight="11" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${c}"/></marker>`;
  s += `<defs>${[C.channel, C.mains, C.data, C.link, C.sec].map(marker).join('')}</defs>`;
  s += `<rect width="2000" height="1250" fill="#fff"/>`;
  s += text(40, 48, 'P33 · T1 — System spine', { size: 26, weight: 700 });
  s += text(40, 74, 'Read left to right: where power and data enter, what they pass through, and which rooms each box serves.   P33-BUILD-001 r1 · 2026-10-06', { size: 14, color: C.sub });

  // column headers
  [[40, 'SUPPLY'], [290, 'CABINET · R01'], [630, 'BASE · R03'], [970, 'HUB · R03'], [1290, 'BRANCHES'], [1620, 'ROOMS SERVED']]
    .forEach(([x, t]) => { s += text(x, 112, t, { size: 13, weight: 700, color: C.sub }) + `<line x1="${x}" y1="120" x2="${x + 230}" y2="120" stroke="${C.line}"/>`; });

  // ---- supply ----
  s += node(40, 150, 200, 70, 'Villanyóra', 'service meter', { fill: C.panel, stroke: C.line });
  s += node(40, 300, 200, 84, 'ISP / ONT', 'R01, above the entrance\n(K18)', { fill: C.panel, stroke: C.data });

  // ---- cabinet ----
  s += node(290, 140, 260, 440, 'ELOSZTÓSZEKRÉNY',
    'R01 · 48 M BRIDGE-DN\n+ one free 12 M row, or an equal\n   flush DN box beside it (K10)\n   → PANEL LINK metering\n      (gateway, addr 150)\n\noutgoing:\n· 2 system circuits → BASE\n   (one remotely operable, F04)\n· room circuits per RoomBox\n· 2 × SSC\n· AV position circuit\n· big loads, direct\n· S04 doubling kept where the\n   load is (kitchen), trimmed\n   elsewhere (K31)',
    { fill: '#fff', stroke: C.mains, bsize: 12.5 });

  // ---- BASE ----
  s += `<rect x="630" y="140" width="260" height="440" rx="10" fill="${C.base}" stroke="${C.channel}" stroke-width="2.5"/>`;
  s += text(642, 166, 'BASE', { size: 16, weight: 700 }) + text(700, 166, 'eye level · joinery build-out (K13)', { size: 11.5, color: C.sub });
  s += node(645, 182, 230, 84, 'NET', '16-port managed, PoE+ ≥ 90 W\n2 × SFP · VLAN 10/20/30/40/50/99\nZigbee coordinator (on the network)', { fill: '#fff', bsize: 11.5, tsize: 14 });
  s += node(645, 276, 230, 104, 'COMP', 'Home Assistant (client) · MQTT\narbiter = own service (G06)\nESPHome · BRIDGE_LINK master,\n4 × RS-485, one per RoomBox', { fill: '#fff', bsize: 11.5, tsize: 14 });
  s += node(645, 390, 230, 96, 'MEDIA — full pack (H01)', 'x86 + HW video · Snapcast\nmedia server · NVR on its own\ndisk · 2.5 GbE / SFP+', { fill: '#fff', bsize: 11.5, tsize: 14 });
  s += node(645, 496, 230, 72, 'Assured 24 V pack', 'C17 · housed in R05,\nnot in this joinery', { fill: '#fff', bsize: 11.5, tsize: 14 });

  // ---- hub ----
  s += node(970, 230, 240, 200, 'RBX03 · RB-H', 'R03 · Modbus addr 3\nhub: pass-through (ZT)\nfor three runs\n\nstacked directly above BASE\n— the chain\'s only shared\nsegment is inside the joinery', { bsize: 12.5 });

  // ---- branches ----
  s += node(1290, 140, 260, 110, 'RBX06 · RB-H', 'R06 · addr 6 · chain node\nserves R06 + R07 (K07)\n+ ARMs to the media wall', { bsize: 12.5 });
  s += node(1290, 300, 260, 90, 'RBX08 · RB-E/W', 'R08 · addr 8 · terminal\noutside the bathroom (K29)', { fill: C.boxE, bsize: 12.5 });
  s += node(1290, 450, 260, 110, 'RBX09 · RB-M', 'R09 · addr 9 · terminal\nprovisioned now,\nfitted with the upper floor', { fill: C.future, dash: true, bsize: 12.5 });
  s += `<circle cx="1245" cy="505" r="15" fill="#fff" stroke="${C.channel}" stroke-width="3"/><circle cx="1245" cy="505" r="5" fill="${C.channel}"/>`;
  s += label(1205, 545, 'V1 riser\nR05, left side', C.channel, { size: 11 });

  // ---- rooms ----
  const R6 = [['R06 nappali', 1620, 140], ['R07 szoba', 1790, 140], ['AV position', 1620, 180], ['media wall', 1790, 180]];
  R6.forEach(([t, x, y], i) => { s += chip(x, y, 160, t, i > 1 ? { fill: C.panel } : {}); });
  s += label(1620, 232, 'AV fed from MEDIA on C2, own 230 V circuit', C.sub, { weight: 400 });
  s += chip(1620, 320, 160, 'R08 fürdő');
  [['R09 szoba', 1620, 445], ['R10 fürdő', 1790, 445], ['R11 közlekedő', 1620, 485], ['R12 terasz', 1790, 485], ['R13 tároló', 1620, 525]]
    .forEach(([t, x, y]) => { s += chip(x, y, 160, t, { dash: true, fill: C.future }); });
  s += label(1790, 545, 'terrace: ARMs, no RB-O', C.sub, { weight: 400 });
  [['R01 előszoba', 1620, 640], ['R02 konyha', 1790, 640], ['R03 étkező', 1620, 680], ['R04 WC', 1790, 680], ['R05 kamra', 1620, 720]]
    .forEach(([t, x, y]) => { s += chip(x, y, 160, t); });
  s += label(1790, 742, 'RBX03\'s own rooms', C.sub, { weight: 400 });

  // ---- wiring ----
  // supply
  s += wire([[240, 185], [290, 185]], C.mains);
  s += wire([[240, 342], [270, 342], [270, 600], [615, 600], [615, 225], [645, 225]], C.data);
  s += label(300, 620, 'ISP line → NET', C.data);
  // cabinet <-> BASE: dedicated power path + data path (K10)
  s += wire([[550, 300], [630, 300]], C.mains) + label(556, 290, 'power path', C.mains);
  s += wire([[630, 340], [550, 340]], C.link, { dash: '7 5' }) + label(556, 360, 'PANEL LINK\ndata path', C.link);
  // BASE -> hub
  s += wire([[890, 330], [970, 330]], C.channel, { w: 6 }) + label(898, 314, 'CHANNEL', C.channel) + label(898, 356, 'C1–C5', C.channel);
  // hub -> branches
  s += wire([[1210, 290], [1250, 290], [1250, 195], [1290, 195]], C.channel, { w: 5 }) + label(1222, 182, 'full bundle', C.channel);
  s += wire([[1210, 345], [1290, 345]], C.channel, { w: 3.5 }) + label(1216, 336, 'spur C1·C3·C4', C.channel);
  s += wire([[1210, 400], [1245, 400], [1245, 490]], C.channel, { w: 5, arrow: false }) + wire([[1260, 505], [1290, 505]], C.channel, { w: 5 });
  // branches -> rooms
  s += wire([[1550, 195], [1600, 195], [1600, 155], [1618, 155]], C.ink, { w: 1.6 });
  s += wire([[1550, 345], [1618, 335]], C.ink, { w: 1.6 });
  s += wire([[1550, 505], [1600, 505], [1600, 460], [1618, 460]], C.ink, { w: 1.6 });
  s += wire([[1090, 430], [1090, 655], [1618, 655]], C.ink, { w: 1.6 });
  s += label(1110, 645, 'ARMs to R01–R05', C.sub, { weight: 400 });

  // ---- lower lanes: mains and security ----
  s += `<line x1="40" y1="790" x2="1960" y2="790" stroke="${C.line}" stroke-dasharray="3 5"/>`;
  s += text(40, 818, 'PARALLEL ROUTES — not on the CHANNEL', { size: 13, weight: 700, color: C.sub });
  s += node(630, 840, 580, 92, 'Big loads — direct from the cabinet, never through a RoomBox',
    'oven tower · induction hob on the island (K20) · dishwasher · washing machine\nwater heater (bojler, K08 corner) · klíma · AV position circuit', { fill: C.load, stroke: C.mains, bsize: 12.5, tsize: 14 });
  s += wire([[420, 580], [420, 886], [630, 886]], C.mains);
  s += node(1290, 840, 260, 92, 'Room circuits', 'lighting + doubled sockets (S04)\nper RoomBox, own route — opposite\nside of a corridor from the CHANNEL', { fill: C.load, stroke: C.mains, bsize: 12, tsize: 14 });
  s += wire([[440, 580], [440, 820], [1420, 820], [1420, 840]], C.mains);
  s += node(630, 960, 260, 92, 'SSC · security centre', 'between RBX03 and RBX06\n2 dedicated circuits · lockable\nprovider\'s IP module on VLAN 50', { fill: '#fff', stroke: C.sec, bsize: 12, tsize: 14 });
  s += wire([[400, 580], [400, 1006], [630, 1006]], C.mains);
  s += wire([[890, 1006], [1620, 1006]], C.sec, { dash: '10 5', w: 3 });
  s += label(910, 996, 'SECURITY channel — own conduits, parallel to the CHANNEL, never through a RoomBox', C.sec);
  s += chip(1620, 990, 340, 'security point per RoomBox → star ARMs', { stroke: C.sec });

  // ---- legend ----
  const lx = 40, ly = 1110;
  s += `<rect x="${lx}" y="${ly}" width="1920" height="110" rx="8" fill="${C.panel}" stroke="${C.line}"/>`;
  const items = [[C.channel, 6, '', 'CHANNEL (C1 data · C2 media · C3 control · C4 spare · C4b bus B · C5 KNX, empty)'], [C.mains, 2.5, '', '230 V — cabinet routes'],
    [C.data, 2.5, '', 'ISP line'], [C.link, 2.5, '7 5', 'PANEL LINK — data only'], [C.sec, 3, '10 5', 'SECURITY channel'], [C.ink, 1.6, '', 'ARMs to rooms']];
  items.forEach(([c, w, d, t], i) => {
    const x = lx + 20 + (i % 3) * 640, y = ly + 34 + Math.floor(i / 3) * 40;
    s += `<line x1="${x}" y1="${y}" x2="${x + 46}" y2="${y}" stroke="${c}" stroke-width="${w}"${d ? ` stroke-dasharray="${d}"` : ''}/>` + text(x + 58, y + 5, t, { size: 13 });
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 1250" width="2000" height="1250" font-family="Segoe UI, DejaVu Sans, Arial, sans-serif"><title>P33 T1 system spine</title>${s}</svg>`;
}

// ---------------------------------------------------------------------------
// shared frame for the later views
const MARKERS = cs => `<defs>${cs.map(c => `<marker id="a${c.slice(1)}" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="11" markerHeight="11" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${c}"/></marker>`).join('')}</defs>`;
function frame(w, h, title, sub, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="Segoe UI, DejaVu Sans, Arial, sans-serif"><title>${esc(title)}</title>` +
    `<rect width="${w}" height="${h}" fill="#fff"/>` + text(40, 48, title, { size: 26, weight: 700 }) + text(40, 74, sub, { size: 14, color: C.sub }) + body + '</svg>';
}
function legendBar(x, y, w, items, cols = 3) {
  const rows = Math.ceil(items.length / cols);
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${30 + rows * 38}" rx="8" fill="${C.panel}" stroke="${C.line}"/>`;
  items.forEach(([mk, t], i) => {
    const cx = x + 20 + (i % cols) * (w / cols), cy = y + 34 + Math.floor(i / cols) * 38;
    s += mk(cx, cy) + text(cx + 62, cy + 5, t, { size: 13 });
  });
  return s;
}
const REVTAG = 'P33-BUILD-001 r1 · 2026-10-06';

// ===========================================================================
// T5 — presence zone graph. Depth from the entrance runs left to right.
const TIER = {
  'P-1': { c: '#64748b', w: 2.5 }, 'P-2': { c: '#1d4ed8', w: 5 }, 'P-3': { c: '#c2410c', w: 8 },
};
function t5() {
  let s = MARKERS([C.ink]);
  const Z = {}, zone = (id, x, y, w, h, title, body, o = {}) => {
    Z[id] = { x, y, w, h };
    s += node(x, y, w, h, title, body, Object.assign({ fill: '#fff', stroke: C.ink, sw: 1.8, bsize: 12 }, o));
  };
  const cx = id => Z[id].x + Z[id].w / 2, cy = id => Z[id].y + Z[id].h / 2;
  const R = id => Z[id].x + Z[id].w, Lx = id => Z[id].x;
  function edge(pts, tier, lbl, lx, ly) {
    const t = TIER[tier];
    s += `<path d="M${pts.map(p => p.join(',')).join(' L')}" fill="none" stroke="${t.c}" stroke-width="${t.w}" stroke-linejoin="round"/>`;
    s += `<rect x="${lx - 4}" y="${ly - 15}" width="${lbl.length * 7.2 + 8}" height="21" rx="10" fill="#fff" stroke="${t.c}" stroke-width="1.5"/>` +
      text(lx, ly, lbl, { size: 12, weight: 700, color: t.c });
  }

  // bands
  s += `<rect x="20" y="120" width="1570" height="480" rx="12" fill="#f8fafc"/>` + text(36, 146, 'GROUND FLOOR', { size: 13, weight: 700, color: C.sub });
  s += `<rect x="20" y="640" width="1570" height="420" rx="12" fill="#f8fafc" stroke="${C.line}" stroke-dasharray="6 5"/>` +
    text(36, 666, 'UPPER FLOOR — provisioned now, instrumented with the upper renovation', { size: 13, weight: 700, color: C.sub });

  // ground
  zone('OUT', 40, 330, 130, 64, 'OUTSIDE', 'stairwell of the block', { fill: C.panel, stroke: C.line });
  zone('R01', 230, 318, 190, 88, 'R01 előszoba', 'hall · grace 3 min\nmmWave · cabinet + ISP here');
  zone('R04', 230, 470, 190, 70, 'R04 WC', 'leaf · grace 8 min');
  zone('R03T', 490, 318, 240, 88, 'R03 — corridor half', 'transit · grace 3 min\nzoned mmWave (zone A)');
  zone('KD', 490, 170, 240, 96, 'R03 dining half + R02 konyha', 'one zone — open plan, island loop\ndwell · grace 12 min · mmWave (zone B)', { fill: '#fefce8' });
  zone('R05', 490, 470, 240, 70, 'R05 kamra', 'leaf · grace 3 min · V1 riser');
  zone('R06', 800, 318, 210, 88, 'R06 nappali', 'living · grace 15 min\nmmWave + CO₂ · void above');
  zone('R07', 1080, 318, 210, 88, 'R07 szoba', 'bedroom · grace 45 min\nmmWave + CO₂');
  zone('R08', 1360, 318, 210, 88, 'R08 fürdő', 'en-suite · 8 min + interlock\nthermal array (primary)');
  // upper
  zone('R11', 800, 760, 210, 88, 'R11 közlekedő', 'stair head · grace 3 min');
  zone('R09', 1080, 690, 210, 88, 'R09 szoba', 'bedroom · grace 45 min\nmmWave masked to the void');
  zone('R10', 1080, 820, 210, 76, 'R10 fürdő', '8 min + interlock');
  zone('R12', 1080, 940, 210, 76, 'R12 terasz', 'outdoor cul-de-sac');
  zone('R13', 1360, 940, 210, 76, 'R13 tároló', 'leaf · reached via R12');

  // edges (portals)
  edge([[R('OUT'), 362], [Lx('R01'), 362]], 'P-3', 'P-3 entry', 150, 312);
  edge([[cx('R01'), Z.R01.y + 88], [cx('R01'), Z.R04.y]], 'P-1', 'P-1', 332, 448);
  edge([[R('R01'), 362], [Lx('R03T'), 362]], 'P-2', 'P-2', 434, 352);
  edge([[cx('R03T'), Z.R03T.y + 88], [cx('R03T'), Z.R05.y]], 'P-1', 'P-1', 622, 448);
  edge([[R('R03T'), 362], [Lx('R06'), 362]], 'P-2', 'P-2', 744, 352);
  edge([[R('R06'), 362], [Lx('R07'), 362]], 'P-2', 'P-2', 1024, 352);
  edge([[R('R07'), 362], [Lx('R08'), 362]], 'P-2', 'P-2', 1304, 352);
  // stair: R03 corridor -> R11
  edge([[690, 406], [690, 804], [Lx('R11'), 804]], 'P-3', 'P-3 stair', 700, 620);
  edge([[R('R11'), 790], [1045, 790], [1045, 734], [Lx('R09'), 734]], 'P-2', 'P-2', 1022, 722);
  edge([[R('R11'), 820], [1045, 820], [1045, 858], [Lx('R10'), 858]], 'P-2', 'P-2', 1022, 878);
  edge([[cx('R11'), Z.R11.y + 88], [cx('R11'), 978], [Lx('R12'), 978]], 'P-1', 'P-1', 912, 968);
  edge([[R('R12'), 978], [Lx('R13'), 978]], 'P-1', 'P-1', 1304, 968);

  // non-portal boundary inside R03, and the void
  s += `<path d="M610,266 L610,318" stroke="${C.ink}" stroke-width="2" stroke-dasharray="4 4"/>` + text(620, 298, 'sensor-zone boundary, not a portal', { size: 11, color: C.sub, italic: true });
  s += `<path d="M1185,690 C1185,560 905,560 905,406" fill="none" stroke="#0ea5e9" stroke-width="2.5" stroke-dasharray="2 7" stroke-linecap="round"/>`;
  s += text(960, 548, 'line of sight across the 4.5 m void — no edge, people cannot cross it', { size: 12, color: '#0369a1', weight: 600 });

  // reading notes
  s += `<rect x="1620" y="120" width="350" height="940" rx="12" fill="#fff" stroke="${C.line}"/>`;
  s += text(1640, 152, 'Reading the graph', { size: 16, weight: 700 });
  s += text(1640, 182, [
    'It is a TREE. Every room has exactly',
    'one way in, so every crossing has one',
    'possible destination and counts',
    'propagate without ambiguity.',
    '',
    'Two count anchors, both P-3:',
    'the entrance and the stair. The stair',
    'is the only walkable link between',
    'floors.',
    '',
    'R08 is an en-suite: reached only',
    'through R07, which is reached only',
    'through R06. A night bathroom trip',
    'never touches the rest of the house.',
    '',
    'R03 is two zones in one room, split',
    'by sensing, not by a door. The',
    'kitchen joins the dining half.',
    '',
    'The terrace is not an exterior edge:',
    'nobody arrives from it, so the house',
    'count holds while someone is outside',
    'on it.',
    '',
    'R09 can see R06 through the void.',
    'Mask its mmWave, or the living room',
    'will appear upstairs.',
  ].join('\n'), { size: 13, color: C.ink });

  s += legendBar(40, 1090, 1930, [
    [(x, y) => `<line x1="${x}" y1="${y}" x2="${x + 46}" y2="${y}" stroke="${TIER['P-3'].c}" stroke-width="8"/>`, 'P-3 — count anchor: P-2 + mmWave + thermal'],
    [(x, y) => `<line x1="${x}" y1="${y}" x2="${x + 46}" y2="${y}" stroke="${TIER['P-2'].c}" stroke-width="5"/>`, 'P-2 — direction + count (dual ToF)'],
    [(x, y) => `<line x1="${x}" y1="${y}" x2="${x + 46}" y2="${y}" stroke="${TIER['P-1'].c}" stroke-width="2.5"/>`, 'P-1 — direction only (the default, D01)'],
    [(x, y) => `<line x1="${x}" y1="${y}" x2="${x + 46}" y2="${y}" stroke="${C.ink}" stroke-width="2" stroke-dasharray="4 4"/>`, 'zone boundary inside a room — sensing only'],
    [(x, y) => `<line x1="${x}" y1="${y}" x2="${x + 46}" y2="${y}" stroke="#0ea5e9" stroke-width="2.5" stroke-dasharray="2 7" stroke-linecap="round"/>`, 'line of sight — not an edge'],
    [(x, y) => `<rect x="${x}" y="${y - 10}" width="46" height="20" rx="4" fill="#fff" stroke="${C.ink}"/>`, 'zone · grace period per STD-003 §3.4'],
  ]);
  return frame(2000, 1220, 'P33 · T5 — Presence zone graph',
    `Rooms as zones, portals as edges, depth from the entrance left to right. Tiers per STD-003 §2.2 and the outline's two-anchor rule.   ${REVTAG}`, s);
}

// ===========================================================================
// T3 — power topology: three independent supply trees, one row per consumer.
function t3() {
  let s = MARKERS([C.mains, '#0f766e', '#7c3aed']);
  const BUSB = '#0f766e', POE = '#7c3aed';
  // column heads
  [[40, 'SUPPLY'], [250, 'ELOSZTÓSZEKRÉNY — outgoing ways'], [800, 'FEEDS'], [1110, 'ASSURED 24 V · bus B'], [1380, 'PoE BACKUP'], [1580, 'IF THAT WAY TRIPS']]
    .forEach(([x, t]) => { s += text(x, 112, t, { size: 13, weight: 700, color: C.sub }); });
  s += node(40, 140, 170, 70, 'Villanyóra', 'service meter', { fill: C.panel, stroke: C.line });
  s += node(40, 250, 170, 70, 'Main isolator', 'in the cabinet', { fill: '#fff', stroke: C.mains });
  s += wire([[125, 210], [125, 250]], C.mains);
  s += `<rect x="250" y="130" width="500" height="1000" rx="10" fill="#fff" stroke="${C.mains}" stroke-width="2.5"/>`;
  s += wire([[210, 285], [250, 285]], C.mains);
  s += text(266, 156, '48 M BRIDGE-DN  +  12 M DN row (K10)', { size: 13, weight: 700 });
  s += text(266, 176, 'PANEL LINK meters every way below — galvanically isolated, data only', { size: 11.5, color: C.link });

  const rows = [
    // [group, ways, feed title, feed body, busB, poe, ifTrips, opts]
    ['SYSTEM', ['BASE-1', 'BASE-2 ⟲'], 'BASE · R03', 'NET · COMP · MEDIA', 'source', 'source', 'BASE runs on the other one;\n⟲ = remotely operable (F04, K31)'],
    ['SYSTEM', ['PACK'], 'Assured pack · R05 (K27)', 'charger for bus B', 'source', '', 'bus B floats on its battery;\nno gap, no transfer'],
    ['SYSTEM', ['SSC-1', 'SSC-2'], 'SSC', 'security centre · provider\'s\nequipment', '', '', 'provider\'s own battery;\nBRIDGE sees a fault state'],
    ['ROOMBOX', ['L', 'K1', 'K2', 'K3', 'G'], 'RBX03 · R03 hub', 'K1–K3 kitchen + island (S04 kept)\nG: R01 R03 R05 general', 'yes', 'yes', 'one socket way trips, one group\ngoes; egress + NTL-TR on bus B'],
    ['ROOMBOX', ['L', 'S6', 'S7'], 'RBX06 · R06', 'R06 and R07 sockets kept apart\n(AV has its own way)', 'yes', 'yes', 'R06 and R07 fail independently;\nthe AV position is separate'],
    ['ROOMBOX', ['L', 'S'], 'RBX08 · R08', 'outside the bathroom (K29)\nSELV-only beyond the box', 'yes', 'yes', 'bathroom egress light holds;\nthe interlock keeps fan state'],
    ['ROOMBOX', ['L', 'S'], 'RBX09 · R09 (provisioned)', 'mains sleeve beside V1 (§14)', 'later', 'later', '—'],
    ['BIG LOAD', ['OVEN'], 'Oven tower', 'R02', '', '', 'that appliance only'],
    ['BIG LOAD', ['HOB'], 'Induction hob — island (K20)', 'feed in the floor before screed', '', '', 'that appliance only'],
    ['BIG LOAD', ['DW', 'WM'], 'Dishwasher · washing machine', '', '', '', 'that appliance only'],
    ['BIG LOAD', ['BOJ', 'AC'], 'Bojler (K08) · klíma (R06)', '', '', '', 'that appliance only'],
    ['BIG LOAD', ['AV'], 'AV position · R06 media wall', 'own circuit (STD-001 §4.1)', '', '', 'cinema only; follow-me audio\nstays up on RBX06'],
  ];
  const y0 = 200, rh = 78;
  const busX = 1180, poeX = 1440;
  let lastGroup = '';
  rows.forEach(([g, ways, ft, fb, bb, pe, ifT], i) => {
    const y = y0 + i * rh, mid = y + 30, future = /provisioned/.test(ft);
    if (g !== lastGroup) { s += text(266, y + 6, g, { size: 11, weight: 700, color: C.sub }); lastGroup = g; }
    const step = ways.length > 3 ? 76 : 120, cw = step - 12;
    ways.forEach((w, j) => {
      const x = 360 + j * step;
      s += `<rect x="${x}" y="${mid - 14}" width="${cw}" height="28" rx="5" fill="${g === 'BIG LOAD' ? C.load : '#fff'}" stroke="${C.mains}" stroke-width="1.5"${future ? ' stroke-dasharray="5 4"' : ''}/>` +
        text(x + cw / 2, mid + 5, w, { size: 12, weight: 700, anchor: 'middle', color: C.mains });
    });
    s += wire([[750, mid], [800, mid]], C.mains, { dash: future ? '6 4' : undefined });
    s += node(800, mid - 32, 270, 68, ft, fb, { fill: g === 'BIG LOAD' ? C.load : (g === 'SYSTEM' ? C.base : C.box), stroke: g === 'BIG LOAD' ? C.mains : C.channel, dash: future, tsize: 13.5, bsize: 11 });
    if (bb === 'yes' || bb === 'later') s += wire([[busX, mid], [1080, mid]], BUSB, { dash: bb === 'later' ? '6 4' : undefined });
    if (pe === 'yes' || pe === 'later') s += wire([[poeX, mid], [1080, mid + 14]], POE, { w: 1.8, dash: pe === 'later' ? '6 4' : '2 3' });
    s += text(1580, mid - 4, ifT, { size: 11.5, color: C.ink });
  });
  // bus B trunk from BASE's pack
  const yB = y0 + rh + 30, yP = y0 + 44, yLast = y0 + 6 * rh + 30;
  s += `<path d="M1080,${yB} L${busX},${yB} L${busX},${yLast}" fill="none" stroke="${BUSB}" stroke-width="4"/>`;
  s += text(1192, yB - 10, 'LiFePO4 ≈ 6 Ah @ 24 V', { size: 11.5, color: BUSB, weight: 700 });
  s += text(1192, yB + 30, 'central pack in R05 (C17)\n2 h at 15 W · backup connector\nhardwired latch → egress', { size: 11, color: BUSB });
  // PoE trunk from NET
  s += `<path d="M1080,${yP} L${poeX},${yP} L${poeX},${yLast}" fill="none" stroke="${POE}" stroke-width="2.5" stroke-dasharray="2 3"/>`;
  s += text(1452, yP + 40, 'from NET\n5–8 W per box\nsub-controller +\nZ4 radios only', { size: 11, color: POE });

  s += `<rect x="800" y="1146" width="1170" height="54" rx="8" fill="#fff7ed" stroke="${C.mains}"/>`;
  s += text(816, 1169, '5 system + 12 RoomBox + 7 big-load = 24 ways, each a 1-module RCBO (K31) → 29 of 36 M single-phase · 34 of 36 M three-phase', { size: 13, weight: 700, color: C.mains });
  s += text(816, 1190, 'Row 4 (12 M) is free in the distributed variant and becomes the PANEL LINK row. Feed, SPD and phase plan: BUILD-001 §14.', { size: 12, color: C.ink });

  s += legendBar(40, 1222, 1930, [
    [(x, y) => `<line x1="${x}" y1="${y}" x2="${x + 46}" y2="${y}" stroke="${C.mains}" stroke-width="2.5"/>`, '230 V from the cabinet'],
    [(x, y) => `<line x1="${x}" y1="${y}" x2="${x + 46}" y2="${y}" stroke="#0f766e" stroke-width="4"/>`, 'bus B — assured 24 V, survives mains loss'],
    [(x, y) => `<line x1="${x}" y1="${y}" x2="${x + 46}" y2="${y}" stroke="#7c3aed" stroke-width="2.5" stroke-dasharray="2 3"/>`, 'PoE backup path to each sub-controller'],
    [(x, y) => `<rect x="${x}" y="${y - 12}" width="46" height="24" rx="5" fill="#fff" stroke="${C.mains}" stroke-dasharray="5 4"/>`, 'provisioned, not yet fitted'],
  ], 4);
  return frame(2000, 1300, 'P33 · T3 — Power topology',
    `Three independent supply trees: 230 V from the cabinet, the assured 24 V bus from the pack in R05, PoE backup from NET. Read each row left to right.   ${REVTAG}`, s);
}

// ===========================================================================
// T10 — endpoint trees: box -> room -> dedicated ARMs | bus ARMs | portals, NTL, UEP.
const TREES = {
  RBX03: { cls: 'RB-H · R03 · addr 3', rooms: [
    ['R01 előszoba', ['LMP1', 'LMP2', 'SWI1', 'SEN1 mmWave', 'SPK1 follow-me', 'PAN1 entry keypad / NFC'], ['sockets', 'LV ambient'], ['POR.OUT.R01 P-3', 'POR.R01.R04 P-1', 'NTL-TR', 'NTL-ND', 'UEP ×4']],
    ['R02 konyha', ['LMP1', 'LMP2', 'LMP3', 'LNR1 under-cabinet', 'SWI1', 'PAN1', 'SEN1 mmWave', 'SEN2 CO₂', 'SEN3 leak ×2', 'SPK1–2 follow-me', 'SHU1', 'screen'], ['sockets +1.10', 'LV ambient'], ['NTL-TR', 'NTL-ST', 'UEP ×2']],
    ['R03 étkező', ['LMP1 pendant', 'LMP2 corridor run', 'SWI1', 'SEN1 mmWave, 2 zones', 'SEN2 room sensing, wall', 'SHU1', 'screen'], ['sockets', 'LV cove'], ['POR.R01.R03 P-2', 'POR.R03.R06 P-2', 'POR.R03.R05 P-1', 'POR.R03.R11 P-3 stair', 'UEP ×2']],
    ['R04 WC', ['LMP1', 'SWI1', 'SEN1', 'ACT1 extractor', 'SEN2 leak'], ['LV ambient'], ['NTL-TR', 'UEP ×2']],
    ['R05 kamra', ['LMP1', 'SWI1'], ['sockets'], ['NTL-TR', 'UEP ×2', 'V1 riser junction']],
  ] },
  RBX06: { cls: 'RB-H · R06 · addr 6', rooms: [
    ['R06 nappali', ['LMP1–5', 'SWI group', 'SHU1–4+', 'PAN1', 'THR1', 'SEN1 mmWave', 'SEN2 corner motion', 'SEN3 CO₂', 'ACP ×2', 'SPK1–2 follow-me', 'UWB anchors ×3', 'radio corner nodes ×2', 'media wall, 4 layers', 'AV position (own circuit)'], ['sockets ×2 runs', 'LV cove · plinth · shelf'], ['NTL-TR', 'NTL-ST', 'NTL-ND', 'UEP ×4']],
    ['R07 szoba', ['LMP1 ceiling', 'LMP2–3 bedside', 'SWI1', 'SHU1–2', 'PAN1', 'THR1', 'SEN1 mmWave', 'SEN2 CO₂', 'SPK1–2 follow-me (P02)', 'bed vital-signs stub'], ['sockets +0.30', 'LV cove · under-bed · headboard'], ['POR.R06.R07 P-2', 'NTL-TR', 'NTL-ST', 'UEP ×2']],
  ] },
  RBX08: { cls: 'RB-E/W · R08 · addr 8', rooms: [
    ['R08 fürdő', ['LMP1 ceiling', 'LMP2 mirror / vanity', 'ACT1 extractor', 'SEN1 thermal array (primary)', 'SEN2 leak', 'SPK1 follow-me, IP-rated', 'door frame point'], ['LV skirting · niche'], ['POR.R07.R08 P-2', 'NTL-TR', 'NTL-ND', 'UEP ×2']],
  ] },
  RBX09: { cls: 'RB-M · R09 · addr 9 · provisioned', future: true, rooms: [
    ['R09 szoba', ['LMP1', 'LMP2', 'SWI1', 'SHU1–2', 'SEN1 mmWave, masked', 'SEN2 CO₂'], ['sockets +0.30', 'LV ambient'], ['POR.R11.R09 P-2', 'NTL-TR', 'UEP ×2']],
    ['R10 fürdő', ['LMP1', 'LMP2', 'ACT1 extractor', 'SEN1 thermal array', 'SEN2 leak'], ['LV ambient'], ['POR.R11.R10 P-2', 'NTL-TR', 'UEP ×2']],
    ['R11 közlekedő', ['LMP1', 'LNR1 stair', 'SWI1'], [], ['POR.R03.R11 P-3 upper end', 'NTL-TR']],
    ['R12 terasz', ['LMP1 outdoor'], ['outdoor socket'], ['POR.R11.R12 P-1']],
    ['R13 tároló', ['LMP1'], [], ['POR.R12.R13 P-1', 'spare C4 from V1']],
  ] },
};
function t10(box) {
  const t = TREES[box];
  let s = MARKERS([C.ink]);
  const colX = { room: 330, ded: 600, bus: 1270, por: 1560 }, chipW = { ded: 214, bus: 250, por: 260 };
  [[40, 'ROOMBOX'], [colX.room, 'ROOM'], [colX.ded, 'DEDICATED ARMs — one per endpoint'], [colX.bus, 'BUS ARMs'], [colX.por, 'PORTALS · NTL · UEP']]
    .forEach(([x, h]) => { s += text(x, 112, h, { size: 13, weight: 700, color: C.sub }); });
  let y = 140;
  const bands = [];
  t.rooms.forEach(([room, ded, bus, por]) => {
    const dedRows = Math.ceil(ded.length / 3), h = Math.max(dedRows, bus.length, por.length, 1) * 36 + 24;
    bands.push([room, ded, bus, por, y, h]); y += h + 16;
  });
  const H = y + 40;
  const boxMid = (140 + y - 16) / 2;
  s += node(40, boxMid - 60, 230, 120, box, t.cls, { fill: t.future ? C.future : C.box, dash: t.future, tsize: 20, bsize: 12.5 });
  bands.forEach(([room, ded, bus, por, by, h], i) => {
    const mid = by + h / 2;
    s += `<rect x="${colX.room - 14}" y="${by}" width="${2000 - colX.room - 16}" height="${h}" rx="10" fill="${i % 2 ? '#fff' : '#f8fafc'}" stroke="#e4e7eb"/>`;
    s += wire([[270, boxMid], [300, boxMid], [300, mid], [colX.room, mid]], C.ink, { w: 1.6 });
    s += text(colX.room + 2, mid + 6, room, { size: 16, weight: 700 });
    ded.forEach((d, j) => { s += chip(colX.ded + (j % 3) * (chipW.ded + 8), by + 12 + Math.floor(j / 3) * 36, chipW.ded, d, t.future ? { dash: true, fill: C.future } : {}); });
    bus.forEach((d, j) => { s += chip(colX.bus, by + 12 + j * 36, chipW.bus, d, { fill: '#ecfdf5', stroke: '#0f766e' }); });
    por.forEach((d, j) => {
      const tier = (d.match(/P-[123]/) || [])[0];
      s += chip(colX.por, by + 12 + j * 36, chipW.por, d, { stroke: tier ? TIER[tier].c : C.line, fill: '#fff' });
    });
  });
  s += legendBar(40, H - 20, 1930, [
    [(x, y) => chip(x, y - 15, 46, ''), 'dedicated ARM — its own run to the box'],
    [(x, y) => chip(x, y - 15, 46, '', { fill: '#ecfdf5', stroke: '#0f766e' }), 'bus ARM — terminates only in the box'],
    [(x, y) => chip(x, y - 15, 46, '', { stroke: TIER['P-2'].c }), 'portal — colour = tier, as in T5'],
  ]);
  return { svg: frame(2000, H + 70, `P33 · T10 — Endpoint tree · ${box}`,
    `What hangs off ${box}, left to right: box → room → ARMs. Type codes per STD-004 §1.2; composition per STD-001 §4 and the P33 provision matrix.   ${REVTAG}`, s), h: H + 70 };
}

// ===========================================================================
const CHROME = path.resolve(__dirname, '../../../Planner/apps/chrome-headless-shell/chrome-headless-shell.exe');
function emit(name, svg, w, h) {
  const out = path.join(FIG, name);
  fs.writeFileSync(out + '.svg', svg);
  if (fs.existsSync(CHROME)) {
    execFileSync(CHROME, ['--headless', '--disable-gpu', '--hide-scrollbars', `--window-size=${w},${Math.ceil(h)}`, '--force-device-scale-factor=1.5',
      `--screenshot=${out}.png`, 'file:///' + (out + '.svg').replace(/\\/g, '/')], { stdio: 'ignore' });
  }
  console.log('wrote', name);
}
// ===========================================================================
// T2 — CHANNEL lanes. A metro map: one lane per run, the six conduits as
// parallel tracks in their fixed order, stations where something happens.
const TRACKS = [
  ['C1', 'DATA', 'M25', '#2563eb', '2 × Cat6A U/FTP'],
  ['C2', 'MEDIA', 'M40', '#db2777', 'HDMI AOC + Cat6A'],
  ['C3', 'CTRL', 'M20', '#16a34a', 'Cat6A S/FTP · BRIDGE_LINK'],
  ['C4', 'SPARE', 'M25', '#94a3b8', 'empty + draw cord'],
  ['C4b', 'BUS B', 'M20', '#0f766e', 'assured 24 V pair (K25)'],
  ['C5', 'KNX', 'M20', '#cbd5e1', 'installed empty (B10)'],
];
function t2() {
  let s = '';
  const gap = 11;                        // track spacing inside a lane
  s += `<rect x="40" y="130" width="250" height="860" rx="12" fill="${C.base}" stroke="${C.channel}" stroke-width="2.5"/>`;
  s += text(56, 162, 'JOINERY · R03', { size: 16, weight: 700 });
  s += text(56, 186, 'RBX03 (upper) over BASE\n\nCH-0 — BASE → RBX03 is an\nopen tray inside the joinery,\nnot a conduit (§3.1).\n\nEvery run below leaves the\njoinery carrying one box\'s\ncables only — so no conduit\nin this house is shared by\ntwo boxes.', { size: 12.5, color: C.sub });

  const lanes = [
    { id: 'CH-6', to: 'RBX06 · RB-H · R06', y: 230, tracks: [0, 1, 2, 3, 4, 5],
      stations: [[430, 'leave joinery'], [640, 'masonry spine\npenetration'], [900, '≤ 2 bends:\nno pull point\n(reasoned)'], [1160, 'RBX06']],
      note: 'C2 continues through RBX06\'s pass-through to the AV position' },
    { id: 'CH-8', to: 'RBX08 · RB-E/W · R08', y: 450, tracks: [0, 2, 3, 4],
      stations: [[430, 'leave joinery'], [760, 'pull point —\nper route (open:\nRBX08\'s wall)'], [1160, 'RBX08']],
      note: 'spur: C1 · C3 · C4 + C4b — the bathroom keeps the assured bus' },
    { id: 'CH-9', to: 'RBX09 · RB-M · R09 (upper)', y: 680, tracks: [0, 1, 2, 3, 4, 5],
      stations: [[430, 'leave joinery'], [610, 'along R03\nsouth wall'], [790, 'PP at riser foot\n(3rd bend)'], [960, 'V1 sleeves\nthrough slab\nfire-stopped'], [1160, 'inspection box\n— capped\ndraw cords'], [1420, 'RBX09\nupper renovation']],
      futureFrom: 1160, note: 'conduits now, cables pulled with the upper floor' },
  ];
  lanes.forEach(L => {
    const top = L.y - 46, h = 6 * gap + 92;
    s += `<rect x="300" y="${top}" width="1330" height="${h}" rx="10" fill="#f8fafc" stroke="#e4e7eb"/>`;
    s += text(316, top + 22, L.id, { size: 15, weight: 700, color: C.channel }) + text(380, top + 22, '→ ' + L.to, { size: 13, weight: 700 });
    s += text(1615, top + 22, L.note, { size: 11.5, color: C.sub, italic: true, anchor: 'end' });
    const endX = L.id === 'CH-9' ? 1420 : 1160;
    TRACKS.forEach((t, i) => {
      const y = L.y + i * gap, on = L.tracks.includes(i);
      if (!on) { s += `<line x1="300" y1="${y}" x2="${endX}" y2="${y}" stroke="#e2e8f0" stroke-width="2" stroke-dasharray="2 6"/>`; return; }
      if (L.futureFrom) {
        s += `<line x1="290" y1="${y}" x2="${L.futureFrom}" y2="${y}" stroke="${t[3]}" stroke-width="5" stroke-linecap="round"/>`;
        s += `<line x1="${L.futureFrom}" y1="${y}" x2="${endX}" y2="${y}" stroke="${t[3]}" stroke-width="5" stroke-dasharray="8 7" stroke-linecap="round" opacity=".6"/>`;
      } else s += `<line x1="290" y1="${y}" x2="${endX}" y2="${y}" stroke="${t[3]}" stroke-width="5" stroke-linecap="round"/>`;
    });
    L.stations.forEach(([x, lbl], k) => {
      const last = k === L.stations.length - 1;
      s += `<rect x="${x - 9}" y="${L.y - 12}" width="18" height="${5 * gap + 24}" rx="9" fill="#fff" stroke="${last ? C.channel : C.ink}" stroke-width="${last ? 3.5 : 2}"/>`;
      s += text(x, L.y + 5 * gap + 34, lbl, { size: 11.5, anchor: 'middle', color: last ? C.channel : C.ink, weight: last ? 700 : 400 });
    });
  });
  // CH-9s branch from the V1 junction
  const jx = 1160, jy = 680 + 3 * gap;
  s += `<path d="M${jx},${jy} C${jx + 60},${jy} ${jx + 60},905 ${jx + 120},905 L1420,905" fill="none" stroke="${TRACKS[3][3]}" stroke-width="5" stroke-dasharray="8 7"/>`;
  s += `<rect x="1411" y="893" width="18" height="24" rx="9" fill="#fff" stroke="${C.channel}" stroke-width="3"/>`;
  s += text(1340, 892, 'CH-9s', { size: 13, weight: 700, color: C.channel }) + text(1440, 910, 'R13 tároló — C4 spare (K16)', { size: 12, color: C.ink });

  // track key + fill
  s += `<rect x="1660" y="130" width="310" height="860" rx="12" fill="#fff" stroke="${C.line}"/>`;
  s += text(1680, 162, 'The bundle — fixed order', { size: 15, weight: 700 });
  s += text(1680, 182, 'left → right, looking away from BASE', { size: 11.5, color: C.sub });
  TRACKS.forEach((t, i) => {
    const y = 220 + i * 74;
    s += `<line x1="1680" y1="${y}" x2="1730" y2="${y}" stroke="${t[3]}" stroke-width="6" stroke-linecap="round"/>`;
    s += text(1742, y + 5, `${t[0]} · ${t[1]} · ${t[2]}`, { size: 14, weight: 700 }) + text(1742, y + 25, t[4], { size: 12, color: C.sub });
  });
  s += text(1680, 690, [
    'Day-one fill, reasoned on typical',
    'conduit bores (limit 40 %):',
    'C1  2 × Cat6A in M25   ≈ 32 %',
    'C2  AOC + Cat6A in M40 ≈ 10 %',
    '      (the plug is the limit, §5.2)',
    'C3  1 × Cat6A in M20   ≈ 27 %',
    'C4b 24 V pair in M20   ≈ 27 %',
    '',
    'Rules on every run (STD-001 §3.3):',
    '≤ two 90° bends between pull points',
    'bend radius ≥ 8 × OD — sweeps only',
    'draw cord in every conduit',
    'both ends labelled P33-R<nn>-C<n>',
  ].join('\n'), { size: 12, color: C.ink });

  s += legendBar(40, 1020, 1930, [
    [(x, y) => `<line x1="${x}" y1="${y}" x2="${x + 46}" y2="${y}" stroke="#2563eb" stroke-width="5" stroke-linecap="round"/>`, 'conduit with day-one cable'],
    [(x, y) => `<line x1="${x}" y1="${y}" x2="${x + 46}" y2="${y}" stroke="#2563eb" stroke-width="5" stroke-dasharray="8 7" opacity=".6"/>`, 'conduit in, cable later'],
    [(x, y) => `<line x1="${x}" y1="${y}" x2="${x + 46}" y2="${y}" stroke="#e2e8f0" stroke-width="2" stroke-dasharray="2 6"/>`, 'not in this run (RB-E spur)'],
    [(x, y) => `<rect x="${x + 14}" y="${y - 14}" width="18" height="28" rx="9" fill="#fff" stroke="${C.ink}" stroke-width="2"/>`, 'station — penetration, pull point, sleeve'],
    [(x, y) => `<rect x="${x + 14}" y="${y - 14}" width="18" height="28" rx="9" fill="#fff" stroke="${C.channel}" stroke-width="3.5"/>`, 'RoomBox — the run terminates'],
  ]);
  return frame(2000, 1140, 'P33 · T2 — CHANNEL lanes',
    `One lane per run, the six conduits as parallel tracks in their fixed order. Lengths are not yet measured: stations mark what happens, not where.   ${REVTAG}`, s);
}

// ===========================================================================
// T8 — failure domains: the spine re-coloured per failure, six small multiples.
const ST = { ok: ['#dcfce7', '#15803d'], deg: ['#fef3c7', '#b45309'], lost: ['#fee2e2', '#b91c1c'], na: ['#f1f5f9', '#94a3b8'] };
function miniSpine(x0, y0, st) {
  let s = '';
  const box = (x, y, w, h, t, k) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${ST[st[k] || 'ok'][0]}" stroke="${ST[st[k] || 'ok'][1]}" stroke-width="2"/>` +
    text(x + w / 2, y + h / 2 + 4, t, { size: 11.5, weight: 700, anchor: 'middle', color: C.ink });
  const ln = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${C.line}" stroke-width="2"/>`;
  s += ln(x0 + 70, y0 + 80, x0 + 92, y0 + 80) + ln(x0 + 182, y0 + 80, x0 + 204, y0 + 80) + ln(x0 + 284, y0 + 80, x0 + 306, y0 + 80);
  s += ln(x0 + 296, y0 + 30, x0 + 296, y0 + 140) + ln(x0 + 296, y0 + 30, x0 + 306, y0 + 30) + ln(x0 + 296, y0 + 140, x0 + 306, y0 + 140);
  s += box(x0, y0 + 60, 70, 40, 'CAB', 'cab');
  s += `<rect x="${x0 + 92}" y="${y0}" width="90" height="170" rx="6" fill="none" stroke="${C.line}" stroke-dasharray="4 3"/>`;
  s += box(x0 + 98, y0 + 6, 78, 30, 'NET', 'net') + box(x0 + 98, y0 + 42, 78, 30, 'COMP', 'comp') + box(x0 + 98, y0 + 78, 78, 30, 'MEDIA', 'media') + box(x0 + 98, y0 + 120, 78, 42, 'PACK', 'pack');
  s += box(x0 + 204, y0 + 58, 80, 44, 'RBX03', 'r3');
  s += box(x0 + 306, y0 + 12, 74, 36, 'RBX06', 'r6') + box(x0 + 306, y0 + 62, 74, 36, 'RBX08', 'r8') + box(x0 + 306, y0 + 122, 74, 36, 'RBX09', 'r9');
  return s;
}
function t8() {
  let s = '';
  const SC = [
    { t: 'A · Mains lost, whole flat', st: { cab: 'lost', net: 'deg', comp: 'deg', media: 'lost', pack: 'ok', r3: 'lost', r6: 'lost', r8: 'lost', r9: 'na' },
      p: [['manual switching', 'lost'], ['automation', 'lost'], ['egress light', 'ok', '2 h on bus B'], ['house', 'deg', 'COMP on its UPS']],
      n: 'The one honest limit (STD-006 §2.2): manual-first needs electricity. Bus B is the answer to a blackout.' },
    { t: 'B · RBX06\'s circuit trips', st: { r6: 'deg', r9: 'na' },
      p: [['manual switching', 'deg', 'dead in R06–R07'], ['automation', 'ok', 'RBX06 alive on PoE'], ['egress light', 'ok', 'central pack'], ['house', 'ok']],
      n: 'R06 and R07 go dark but stay reported. The AV circuit and every other room are untouched.' },
    { t: 'C · COMP down', st: { comp: 'lost', r3: 'deg', r6: 'deg', r8: 'deg', r9: 'na' },
      p: [['manual switching', 'ok'], ['automation', 'deg', 'autonomy, last state'], ['egress light', 'ok'], ['house', 'deg', 'no scenes, schedules']],
      n: 'Every box falls back to autonomy within 3 s. On return COMP reconciles, it never reasserts.' },
    { t: 'D · NET down', st: { net: 'lost', r3: 'deg', r6: 'deg', r8: 'deg', r9: 'na' },
      p: [['manual switching', 'ok'], ['automation', 'deg', 'local rules only'], ['egress light', 'ok'], ['house', 'deg', 'no panels, cameras']],
      n: 'The boxes keep their RS-485 link to COMP. What goes is everything that rides Ethernet: panels, cameras, Matter over WiFi.' },
    { t: 'E · RBX03\'s sub-controller dead', st: { r3: 'lost', r9: 'na' },
      p: [['manual switching', 'ok'], ['automation', 'deg', 'dead in R01–R05 only'], ['egress light', 'ok'], ['house', 'ok']],
      n: 'The hub is a hub for cables, not for logic: each box has its own RS-485 channel and the pass-through is passive. Downstream boxes never notice.' },
    { t: 'F · The joinery lost (water, heat)', st: { net: 'lost', comp: 'lost', media: 'lost', pack: 'lost', r3: 'lost', r6: 'deg', r8: 'deg', r9: 'na' },
      p: [['manual switching', 'deg', 'lost in R01–R05 only'], ['automation', 'deg', 'autonomy downstream'], ['egress light', 'lost', 'if the pack were here'], ['house', 'lost']],
      n: 'Common cause: stacking puts BASE and the hub in one cupboard. Were the assured pack there too, egress would go with them — which is why it moves to R05 (BUILD-001 §12.1).' },
  ];
  SC.forEach((c, i) => {
    const x = 40 + (i % 3) * 650, y = 120 + Math.floor(i / 3) * 470;
    s += `<rect x="${x}" y="${y}" width="630" height="450" rx="12" fill="#fff" stroke="${C.line}"/>`;
    s += text(x + 18, y + 32, c.t, { size: 17, weight: 700 });
    s += miniSpine(x + 120, y + 56, c.st);
    c.p.forEach(([lbl, k, sub], j) => {
      const px = x + 18 + (j % 2) * 302, py = y + 252 + Math.floor(j / 2) * 62;
      s += `<rect x="${px}" y="${py}" width="290" height="52" rx="8" fill="${ST[k][0]}" stroke="${ST[k][1]}" stroke-width="1.6"/>`;
      s += text(px + 12, py + 21, lbl, { size: 13, weight: 700, color: ST[k][1] }) + text(px + 12, py + 40, sub || { ok: 'full function', deg: 'degraded', lost: 'lost' }[k], { size: 12, color: C.ink });
    });
    const words = c.n.split(' '); let line = '', lines = [];
    words.forEach(w => { if ((line + ' ' + w).length > 78) { lines.push(line.trim()); line = w; } else line += ' ' + w; }); lines.push(line.trim());
    s += text(x + 18, y + 392, lines.join('\n'), { size: 12.5, color: C.sub, italic: true });
  });
  s += legendBar(40, 1080, 1930, [
    [(x, y) => `<rect x="${x}" y="${y - 12}" width="46" height="24" rx="5" fill="${ST.ok[0]}" stroke="${ST.ok[1]}" stroke-width="2"/>`, 'full function'],
    [(x, y) => `<rect x="${x}" y="${y - 12}" width="46" height="24" rx="5" fill="${ST.deg[0]}" stroke="${ST.deg[1]}" stroke-width="2"/>`, 'degraded — autonomy, or partial'],
    [(x, y) => `<rect x="${x}" y="${y - 12}" width="46" height="24" rx="5" fill="${ST.lost[0]}" stroke="${ST.lost[1]}" stroke-width="2"/>`, 'lost'],
    [(x, y) => `<rect x="${x}" y="${y - 12}" width="46" height="24" rx="5" fill="${ST.na[0]}" stroke="${ST.na[1]}" stroke-width="2"/>`, 'not yet fitted (RBX09)'],
  ], 4);
  return frame(2000, 1170, 'P33 · T8 — Failure domains',
    `Six failures, each the T1 spine re-coloured, then what the occupant actually experiences. Rows of STD-006 §2's matrix, applied to this house.   ${REVTAG}`, s);
}

emit('P33-T1_system-spine', t1(), 2000, 1250);
emit('P33-T2_channel-lanes', t2(), 2000, 1140);
emit('P33-T8_failure-domains', t8(), 2000, 1170);
emit('P33-T5_presence-graph', t5(), 2000, 1220);
emit('P33-T3_power', t3(), 2000, 1300);
for (const b of Object.keys(TREES)) { const { svg, h } = t10(b); emit(`P33-T10_${b}`, svg, 2000, h); }
