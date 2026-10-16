// template.js — the all-in-one Portal: every designated spot around a door, both faces + a plan strip
// A real portal uses a subset; this sheet reserves the space for all of them (rules.PORTAL_SLOTS).
'use strict';
const sheet = require('./sheet'), RU = require('./rules');
const esc = sheet.esc;
const FAM = { MAINS: '#d1493f', CONTROL: '#7a5cc0', SENSOR: '#2f79c9', BUSB: '#b07a2a', MEDIA: '#c2638a', LV: '#e6a800' };
const DOOR = { w: 900, h: 2100 }, CEIL = 2850;

function elevation(ox, label, hingeLeft) {
  let s = ''; const X = u => ox + u, Y = h => -h, half = DOOR.w / 2;
  // wall, ceiling, floor
  s += `<rect x="${X(-1800)}" y="${Y(CEIL)}" width="3600" height="${CEIL}" fill="#f4f1ea" stroke="#bdb6a8" stroke-width="10"/>`;
  // bands: ZW-o (2400–2700), lintel (2100–2250), ZS-t both sides (100–300 from the opening edge)
  s += `<rect x="${X(-1800)}" y="${Y(2700)}" width="3600" height="300" fill="#e8eef8"/>`;
  s += `<rect x="${X(-half - 300)}" y="${Y(2250)}" width="${DOOR.w + 600}" height="150" fill="#eee" stroke="#ccc" stroke-dasharray="20 15" stroke-width="6"/>`;
  [-1, 1].forEach(sd => { const a = sd > 0 ? half + 100 : -half - 300; s += `<rect x="${X(a)}" y="${Y(2700)}" width="200" height="2700" fill="#efe6d4" fill-opacity=".8"/>`; });
  // the two horizontal lines
  s += `<line x1="${X(-1800)}" y1="${Y(2600)}" x2="${X(1800)}" y2="${Y(2600)}" stroke="#1f3f8b" stroke-width="22"/>`;
  s += `<line x1="${X(-1800)}" y1="${Y(2450)}" x2="${X(1800)}" y2="${Y(2450)}" stroke="#d1493f" stroke-width="16" stroke-dasharray="60 30"/>`;
  // opening
  s += `<rect x="${X(-half)}" y="${Y(DOOR.h)}" width="${DOOR.w}" height="${DOOR.h}" fill="#fff" stroke="#555" stroke-width="16"/>`;
  const hx = hingeLeft ? -half : half; s += `<circle cx="${X(hx)}" cy="${Y(300)}" r="25" fill="#555"/><circle cx="${X(hx)}" cy="${Y(1800)}" r="25" fill="#555"/>`;
  s += `<text x="${X(0)}" y="${Y(1050)}" font-size="95" text-anchor="middle" fill="#888">ajtó 900 × 2100</text>`;
  s += `<text x="${X(hingeLeft ? -half - 200 : half + 200)}" y="${Y(-160)}" font-size="85" text-anchor="middle" fill="#7a6a4a">zsanér · SELV</text>`;
  s += `<text x="${X(hingeLeft ? half + 200 : -half - 200)}" y="${Y(-160)}" font-size="85" text-anchor="middle" fill="#a33">kilincs · 230 V</text>`;
  // risers: SELV on the hinge side, MAINS on the latch side, SELV head ring over the opening to the panel column
  const pos = sl => { const side = sl.side === 'head' ? 0 : (sl.side === 'hinge' ? (hingeLeft ? -1 : 1) : (hingeLeft ? 1 : -1)); return side === 0 ? sl.u : side * (half + sl.u); };
  const col = (side, u) => (side === 'hinge' ? (hingeLeft ? -1 : 1) : (hingeLeft ? 1 : -1)) * (half + u);
  s += `<line x1="${X(col('hinge', 150))}" y1="${Y(300)}" x2="${X(col('hinge', 150))}" y2="${Y(2450)}" stroke="#7a5cc0" stroke-width="12"/>`;
  s += `<line x1="${X(col('latch', 150))}" y1="${Y(300)}" x2="${X(col('latch', 150))}" y2="${Y(2450)}" stroke="#d1493f" stroke-width="14"/>`;
  s += `<polyline points="${X(col('hinge', 150))},${Y(2350)} ${X(col('latch', 450))},${Y(2350)} ${X(col('latch', 450))},${Y(1450)}" fill="none" stroke="#7a5cc0" stroke-width="10" stroke-dasharray="30 18"/>`;
  s += `<line x1="${X(0)}" y1="${Y(2150)}" x2="${X(0)}" y2="${Y(2350)}" stroke="#7a5cc0" stroke-width="10"/>`;
  // slots
  RU.PORTAL_SLOTS.forEach(sl => { const u = pos(sl), w = sl.k === 'L4' || sl.k === 'H0' ? 142 : sl.k[0] === 'T' ? 220 : 90, h = sl.k === 'L4' || sl.k === 'H0' ? 90 : 75;
    s += `<rect x="${X(u) - w / 2}" y="${Y(sl.h) - h / 2}" width="${w}" height="${h}" fill="${FAM[sl.fam]}" stroke="#fff" stroke-width="8"/>`;
    const right = sl.side === 'head' ? true : (sl.side === 'hinge') !== hingeLeft;
    s += `<text x="${X(u) + (right ? w / 2 + 25 : -w / 2 - 25)}" y="${Y(sl.h) + 30}" font-size="80" font-weight="700" fill="${FAM[sl.fam]}" text-anchor="${right ? 'start' : 'end'}">${sl.k} ${sl.h}</text>`; });
  // dimension marks
  [[300, 0], [1100, 30], [1150, -10], [1450, 0], [2150, 0], [2400, 45], [2450, 0], [2600, -10]].forEach(([h, d]) => s += `<text x="${X(-1780)}" y="${Y(h) + 20 + d}" font-size="55" fill="#999">${h}</text>`);
  s += `<text x="${X(0)}" y="${Y(CEIL) - 80}" font-size="130" font-weight="700" text-anchor="middle">${esc(label)}</text>`;
  return s;
}

function plan(ox, oy) {
  let s = ''; const half = DOOR.w / 2, t = 250, X = u => ox + u, Y = v => oy + v;
  s += `<rect x="${X(-1800)}" y="${Y(-t / 2)}" width="3600" height="${t}" fill="#bdb6a8"/>`;
  s += `<rect x="${X(-half)}" y="${Y(-t / 2) - 4}" width="${DOOR.w}" height="${t + 8}" fill="#fff" stroke="#555" stroke-width="10"/>`;
  [[-1, 'A oldal'], [1, 'B oldal']].forEach(([sd, n]) => { const fy = sd * t / 2;
    RU.PORTAL_SLOTS.forEach(sl => { const u = sl.side === 'head' ? sl.u : (sl.side === 'hinge' ? -1 : 1) * (half + sl.u);
      s += `<rect x="${X(u) - 40}" y="${Y(fy) - (sd < 0 ? 70 : 0)}" width="80" height="70" fill="${FAM[sl.fam]}"/>`; });
    s += `<text x="${X(1700)}" y="${Y(fy + sd * 160)}" font-size="95" text-anchor="end" fill="#555">${n}</text>`; });
  // the two crossings: MAINS at L4 (latch, 150), SELV at H0 (hinge, 150)
  s += `<line x1="${X(half + 150)}" y1="${Y(-t / 2 - 80)}" x2="${X(half + 150)}" y2="${Y(t / 2 + 80)}" stroke="#d1493f" stroke-width="24"/>`;
  s += `<line x1="${X(-half - 150)}" y1="${Y(-t / 2 - 80)}" x2="${X(-half - 150)}" y2="${Y(t / 2 + 80)}" stroke="#7a5cc0" stroke-width="24"/>`;
  s += `<text x="${X(half + 150)}" y="${Y(t / 2 + 230)}" font-size="80" text-anchor="middle" fill="#d1493f">230 V átvezetés (L4)</text>`;
  s += `<text x="${X(-half - 150)}" y="${Y(t / 2 + 230)}" font-size="80" text-anchor="middle" fill="#7a5cc0">SELV átvezetés (H0)</text>`;
  s += `<text x="${X(0)}" y="${Y(-t / 2 - 260)}" font-size="110" font-weight="700" text-anchor="middle">Alaprajz — mindkét falsík</text>`;
  return s;
}

function write(file) {
  let s = '';
  s += `<text x="-1900" y="-3420" font-size="170" font-weight="700">Portál — teljes sablon (minden kijelölt hely)</text>`;
  s += `<text x="-1900" y="-3230" font-size="95" fill="#666">Egy valós portál ennek egy részét használja; a hely mindegyiknek fenntartva. Zsanéroldal = csak SELV, kilincsoldal = 230 V + külön SELV oszlop a panelnek.</text>`;
  s += elevation(0, 'A oldal (folyosó felől)', true) + elevation(4000, 'B oldal (szoba felől)', false);
  s += plan(2000, 800);
  // legend
  let y = 1700; RU.PORTAL_SLOTS.forEach((sl, k) => { const x = -1900, yy = y + k * 135;
    s += `<rect x="${x}" y="${yy - 70}" width="85" height="85" fill="${FAM[sl.fam]}"/><text x="${x + 130}" y="${yy}" font-size="80"><tspan font-weight="700">${sl.k} · ${sl.side === 'head' ? 'fej' : sl.side === 'hinge' ? 'zsanér' : 'kilincs'} · ${sl.h} mm${sl.u ? ' · ' + sl.u + ' mm a nyílástól' : ''}</tspan> — ${esc(sl.n)}${sl.codes.length ? ' [' + sl.codes.join(', ') + ']' : ''}</text>`; });
  const ly = y + RU.PORTAL_SLOTS.length * 135 + 60;
  s += `<line x1="-1900" y1="${ly}" x2="-1500" y2="${ly}" stroke="#1f3f8b" stroke-width="22"/><text x="-1440" y="${ly + 30}" font-size="85">gerinc 2600</text>`;
  s += `<line x1="0" y1="${ly}" x2="400" y2="${ly}" stroke="#d1493f" stroke-width="16" stroke-dasharray="60 30"/><text x="460" y="${ly + 30}" font-size="85">leágazó 2450</text>`;
  s += `<rect x="2100" y="${ly - 50}" width="120" height="100" fill="#efe6d4"/><text x="2260" y="${ly + 30}" font-size="85">ZS-t sáv 100–300</text>`;
  s += `<rect x="4300" y="${ly - 50}" width="120" height="100" fill="#e8eef8"/><text x="4460" y="${ly + 30}" font-size="85">ZW-o sáv 2400–2700</text>`;
  sheet.write(file, s, [-2000, -3550, 8000, 6900], { px: 2400 });
}
module.exports = { write };
