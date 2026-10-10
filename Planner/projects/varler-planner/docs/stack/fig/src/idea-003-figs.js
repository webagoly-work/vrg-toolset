#!/usr/bin/env node
// IDEA-003 figures — own illustrations, generated (never hand-edit the SVG output).
//
//   node docs/stack/fig/src/idea-003-figs.js
//     -> docs/stack/fig/IDEA-003_F1_door-elevation.svg   one door, both faces, slots L0…H2
//     -> docs/stack/fig/IDEA-003_F2_room-pattern.svg     P33 R06 + R07, the L pattern, from the test plan
//     -> prints the derived portal geometry (hinge jamb, swing face, H0 fit) as JSON on stdout
//
// F2 reads the geometry from Calculator/P33-teszt_v2.vplan.json (walls, floors, openings, the RBX),
// so the plan is the model's, not a redraw. Door handing follows 04-render.js bpDoorSymbol():
// variant bit1 = hinge at the far jamb, bit0 = swing toward +perpendicular.
//
// STYLE is the draft figure standard (Q-SF-08: illustrations "in a standard manner"): one ink, one
// faint ink, tier colours gold / silver / bronze, and voltage-class colours for housings. Every
// future SmartFrame figure should take these tokens rather than invent its own.
'use strict';
const fs = require('fs'), path = require('path');

const STYLE = {
  font: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
  ink: '#2b2b2b', faint: '#9a978f', paper: '#ffffff', wall: '#d8d5cc', wallEdge: '#8a877f',
  zoneV: '#e3ecf5', zoneH: '#eaf2e1', lintel: '#cbb894',
  gold: '#c9a227', silver: '#7f8a96', bronze: '#a8683a',          // the three path tiers
  mains: '#a33a2a', selv: '#1d7a6e', prov: '#8f8c84',             // housing voltage class
  room: '#f6f4ee', roomAlt: '#fbfaf6', leaf: '#efe9dc',
  t1: 13, t2: 11,                                                  // the only two text sizes
};
const ROOT = path.resolve(__dirname, '..', '..', '..', '..');       // varler-planner
const PLAN = path.resolve(ROOT, '..', '..', '..', 'Calculator', 'P33-teszt_v2.vplan.json');
const OUT = path.resolve(__dirname, '..');

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const f1 = n => +(+n).toFixed(1);
const T = (x, y, s, o = {}) => `<text x="${f1(x)}" y="${f1(y)}" font-size="${o.size || STYLE.t2}"` +
  ` fill="${o.fill || STYLE.ink}"${o.anchor ? ` text-anchor="${o.anchor}"` : ''}${o.weight ? ` font-weight="${o.weight}"` : ''}>${esc(s)}</text>`;
const svgOpen = (w, h, title, desc) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" ` +
  `font-family="${STYLE.font}" role="img"><title>${esc(title)}</title><desc>${esc(desc)}</desc>` +
  `<rect width="${w}" height="${h}" fill="${STYLE.paper}"/>`;
const hatch = (id, col) => `<pattern id="${id}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">` +
  `<line x1="0" y1="0" x2="0" y2="6" stroke="${col}" stroke-width="1.2"/></pattern>`;

// ═════════════════════════════════════════════════════════════════════════════════════════════
// F1 — door elevation, both faces
// ═════════════════════════════════════════════════════════════════════════════════════════════
function figElevation() {
  const k = 0.18;                      // px per mm
  const CEIL = 2850, OPW = 900, OPH = 2100, SIDE = 750, FACEW = OPW + 2 * SIDE;
  const floorY = 640, W = 1654, H = 830, OXA = 230, OXB = 992;
  const Y = mm => floorY - mm * k;
  let s = svgOpen(W, H, 'IDEA-003 F1 — SmartFrame door elevation, both faces',
    'One interior door seen from both rooms. Slots L0 to H2, the DIN installation zones, the BRIDGE hinge zone, the lintel, the Silver Rail and the channel.');
  s += `<defs>${hatch('lin', STYLE.lintel)}${hatch('leafh', '#d9cfb9')}</defs>`;
  s += T(40, 34, 'IDEA-003 · F1 — one door, both faces (P33 reference ceiling 2850)', { size: STYLE.t1, weight: 600 });
  s += T(40, 52, 'Heights from finished floor, mm. Face A = the served room, the leaf opens away from it. Face B = the other room, the leaf opens toward it.', { fill: STYLE.faint });

  // face(ox, mirror, label, content)  — mirror: hinge on the right as seen from that room
  const face = (ox, mirror, title, sub, slots, leafHere) => {
    const X = mm => ox + (mirror ? (FACEW - mm) : mm) * k;
    const xr = (a, b) => [Math.min(X(a), X(b)), Math.abs(X(b) - X(a))];
    const hingeE = SIDE, latchE = SIDE + OPW;                    // opening edges in face mm (hinge = left before mirroring)
    let g = '';
    // wall, ceiling, floor
    g += `<rect x="${f1(ox)}" y="${f1(Y(CEIL))}" width="${f1(FACEW * k)}" height="${f1(CEIL * k)}" fill="${STYLE.roomAlt}" stroke="${STYLE.wallEdge}" stroke-width="0.8"/>`;
    // zones: ZW-o 2400–2700, ZW-u 150–450, ZS-t latch (DIN) and ZS-t(h) hinge (BRIDGE)
    g += `<rect x="${f1(ox)}" y="${f1(Y(2700))}" width="${f1(FACEW * k)}" height="${f1(300 * k)}" fill="${STYLE.zoneH}"/>`;
    g += `<rect x="${f1(ox)}" y="${f1(Y(450))}" width="${f1(FACEW * k)}" height="${f1(300 * k)}" fill="${STYLE.zoneH}"/>`;
    let [zx, zw] = xr(latchE + 100, latchE + 300);
    g += `<rect x="${f1(zx)}" y="${f1(Y(CEIL))}" width="${f1(zw)}" height="${f1(CEIL * k)}" fill="${STYLE.zoneV}" opacity="0.9"/>`;
    [zx, zw] = xr(hingeE - 300, hingeE - 100);
    g += `<rect x="${f1(zx)}" y="${f1(Y(CEIL))}" width="${f1(zw)}" height="${f1(CEIL * k)}" fill="${STYLE.zoneV}" opacity="0.9" stroke="${STYLE.silver}" stroke-dasharray="4 3" stroke-width="0.8"/>`;
    // the open leaf on the swing face: hinge-side wall hidden up to the leaf height
    if (leafHere) {
      const [lx, lw] = xr(Math.max(0, hingeE - 820), hingeE);
      g += `<rect x="${f1(lx)}" y="${f1(Y(2050))}" width="${f1(lw)}" height="${f1(2050 * k)}" fill="url(#leafh)" opacity="0.9"/>`;
      g += T(lx + lw / 2, Y(1880), 'behind the open leaf', { anchor: 'middle', fill: '#8a7a55' });
    }
    // lintel band 2100–2230 with 150 bearing each side (⚑ product-dependent)
    const [llx, llw] = xr(hingeE - 150, latchE + 150);
    g += `<rect x="${f1(llx)}" y="${f1(Y(OPH + 130))}" width="${f1(llw)}" height="${f1(130 * k)}" fill="url(#lin)" stroke="${STYLE.lintel}" stroke-width="0.6"/>`;
    // opening
    const [ox2, ow] = xr(hingeE, latchE);
    g += `<rect x="${f1(ox2)}" y="${f1(Y(OPH))}" width="${f1(ow)}" height="${f1(OPH * k)}" fill="${STYLE.paper}" stroke="${STYLE.ink}" stroke-width="1.2"/>`;
    // hinge ticks
    for (const hh of [250, 1050, 1850]) g += `<rect x="${f1(X(hingeE) - (mirror ? 0 : 3))}" y="${f1(Y(hh + 60))}" width="3" height="${f1(120 * k)}" fill="${STYLE.ink}"/>`;
    // handle
    g += `<rect x="${f1(X(latchE - 70) - 9)}" y="${f1(Y(1050))}" width="18" height="3" fill="${STYLE.ink}"/>`;
    // rail (silver) at 2450, channel (gold) at 2600 — both run the full face width
    g += `<line x1="${f1(ox)}" y1="${f1(Y(2450))}" x2="${f1(ox + FACEW * k)}" y2="${f1(Y(2450))}" stroke="${STYLE.silver}" stroke-width="4" stroke-linecap="butt"/>`;
    g += `<line x1="${f1(ox)}" y1="${f1(Y(2600))}" x2="${f1(ox + FACEW * k)}" y2="${f1(Y(2600))}" stroke="${STYLE.gold}" stroke-width="3" stroke-dasharray="10 6"/>`;
    // risers
    const hx = X(hingeE - 200), lx2 = X(latchE + 200);
    if (slots.some(q => q.side === 'h' && q.h < 2300)) g += `<line x1="${f1(hx)}" y1="${f1(Y(2350))}" x2="${f1(hx)}" y2="${f1(Y(250))}" stroke="${STYLE.silver}" stroke-width="2"/>`;
    g += `<line x1="${f1(lx2)}" y1="${f1(Y(2450))}" x2="${f1(lx2)}" y2="${f1(Y(300))}" stroke="${STYLE.bronze}" stroke-width="2"/>`;
    // slots
    for (const q of slots) {
      const cx = q.side === 'h' ? hx : q.side === 'l' ? lx2 : q.side === 'j' ? X(hingeE + 12) : X(q.x);
      const cy = Y(q.h), col = q.v === 'm' ? STYLE.mains : q.v === 'p' ? STYLE.prov : STYLE.selv;
      const dash = q.v === 'p' || q.dorm ? ' stroke-dasharray="3 2"' : '';
      if (q.shape === 'o') g += `<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(34 * k + 1)}" fill="${STYLE.paper}" stroke="${col}" stroke-width="1.6"${dash}/>`;
      else { const w = q.w * k, h = q.hh * k; g += `<rect x="${f1(cx - w / 2)}" y="${f1(cy - h / 2)}" width="${f1(w)}" height="${f1(h)}" rx="1.5" fill="${STYLE.paper}" stroke="${col}" stroke-width="1.6"${dash}/>`; }
      if (q.vent) for (const d of [-3, 0, 3]) g += `<line x1="${f1(cx - 4)}" y1="${f1(cy + d)}" x2="${f1(cx + 4)}" y2="${f1(cy + d)}" stroke="${col}" stroke-width="0.8"/>`;
      const lab = q.id + (q.lab ? ' ' + q.lab : '');
      if (q.lpos) { g += T(cx, cy + (q.lpos === 'above' ? -12 : 20), lab, { anchor: 'middle', weight: 600, fill: col }); continue; }
      const right = (q.side === 'l') !== mirror;
      const tx = q.side === 'j' ? cx + (mirror ? -10 : 10) : cx + (right ? 1 : -1) * ((q.w ? q.w * k / 2 : 8) + 6);
      g += T(tx, cy + 4 + (q.dy || 0), lab, { anchor: (q.side === 'j' ? !mirror : right) ? 'start' : 'end', weight: 600, fill: col });
    }
    // axis + labels
    g += T(ox + FACEW * k / 2, Y(CEIL) - 10, title, { anchor: 'middle', size: STYLE.t1, weight: 600 });
    g += T(ox + FACEW * k / 2, floorY + 18, sub, { anchor: 'middle', fill: STYLE.faint });
    g += T(X(hingeE - 200), floorY + 34, 'hinge side', { anchor: 'middle', fill: STYLE.silver });
    g += T(X(latchE + 200), floorY + 34, 'latch side', { anchor: 'middle', fill: STYLE.bronze });
    return g;
  };

  // face A: served room, non-swing face → the full SF-3 slot set
  const A = [
    { id: 'L0', lab: 'lábfény · low sensor', side: 'h', h: 250, shape: 'o', v: 's' },
    { id: 'L1', lab: 'socket', side: 'l', h: 300, shape: 'o', v: 'm' },
    { id: 'L2', lab: 'dormant parallel', side: 'l', h: 1000, shape: 'o', v: 'p', dorm: true },
    { id: 'M1', lab: 'NTL-TR', side: 'l', h: 1150, shape: 'o', v: 's' },
    { id: 'M2', lab: 'switch column', side: 'l', h: 1300, shape: 'r', w: 200, hh: 83, v: 'm' },
    { id: 'M3', lab: 'terminal: CYD · panel · intercom', side: 'h', h: 1450, shape: 'r', w: 160, hh: 120, v: 's' },
    { id: 'M4', lab: 'sensor node', side: 'h', h: 1620, shape: 'o', v: 's', vent: true },
    { id: 'MJ', lab: 'jamb: transfer · angle', side: 'j', h: 1000, shape: 'r', w: 24, hh: 150, v: 's' },
    { id: 'H0', lab: 'corner box (nest)', side: 'h', h: 2450, shape: 'r', w: 200, hh: 200, v: 's', dy: 14 },
    { id: 'H1', lab: 'ToF · mmWave', side: 'x', x: SIDE + OPW / 2 - 120, h: 2400, shape: 'o', v: 's', vent: true, lpos: 'above' },
    { id: 'H1b', lab: 'speaker · mic 2', side: 'x', x: SIDE + OPW - 120, h: 2400, shape: 'o', v: 's', vent: true, lpos: 'below' },
  ];
  // face B: the other room, swing face → its own switch column, the second ToF, SF-0 provision
  const B = [
    { id: 'L1', lab: 'socket', side: 'l', h: 300, shape: 'o', v: 'm' },
    { id: 'M2', lab: 'switch column', side: 'l', h: 1300, shape: 'r', w: 200, hh: 83, v: 'm' },
    { id: 'H0′', lab: 'SF-0 provision', side: 'h', h: 2450, shape: 'r', w: 200, hh: 200, v: 'p', dy: 14 },
    { id: 'H1′', lab: 'ToF B', side: 'x', x: SIDE + OPW / 2 - 120, h: 2400, shape: 'o', v: 's', vent: true, lpos: 'above' },
  ];
  s += face(OXA, false, 'Face A — served room · non-swing face', 'tier SF-3 shown (every slot)', A, false);
  s += face(OXB, true, 'Face B — other room · swing face', 'PT-S: second ToF + SF-0 provision only', B, true);

  // left axis ticks on face A
  for (const [mm, lab] of [[0, '±0'], [300, '300'], [1000, '1000'], [1300, '1300'], [2100, '2100 head'], [2230, ''], [2400, '2400'], [2700, '2700'], [2850, '2850 ceiling']]) {
    if (!lab) continue;
    s += `<line x1="20" y1="${f1(Y(mm))}" x2="${OXA}" y2="${f1(Y(mm))}" stroke="${STYLE.faint}" stroke-width="0.4" stroke-dasharray="2 4"/>`;
    s += T(20, Y(mm) - 3, lab, { fill: STYLE.faint });
  }
  // zone captions (face A only, outside the face on the left margin would clip: put them inside, top)
  s += T(OXA + (SIDE + OPW + 320) * k, Y(2700) + 12, 'ZW-o (DIN)', { fill: '#5d7a3f' });
  s += T(OXA + (SIDE + OPW + 320) * k, Y(450) + 12, 'ZW-u (DIN)', { fill: '#5d7a3f' });

  // legend
  const ly = 712; let lx = 40;
  const leg = (sw, txt) => { s += sw(lx, ly); s += T(lx + 30, ly + 4, txt); lx += 30 + txt.length * 6.1 + 22; };
  leg((x, y) => `<line x1="${x}" y1="${y}" x2="${x + 24}" y2="${y}" stroke="${STYLE.silver}" stroke-width="4"/>`, 'Silver Rail (RBX ↔ Portals)');
  leg((x, y) => `<line x1="${x}" y1="${y}" x2="${x + 24}" y2="${y}" stroke="${STYLE.gold}" stroke-width="3" stroke-dasharray="10 6"/>`, 'golden channel (only where it passes)');
  leg((x, y) => `<line x1="${x}" y1="${y}" x2="${x + 24}" y2="${y}" stroke="${STYLE.bronze}" stroke-width="2"/>`, 'latch riser');
  leg((x, y) => `<rect x="${x}" y="${y - 7}" width="24" height="14" fill="${STYLE.lintel}" opacity="0.6"/>`, 'lintel — never chased');
  lx = 40;
  const ly2 = ly + 26;
  const leg2 = (sw, txt) => { s += sw(lx, ly2); s += T(lx + 30, ly2 + 4, txt); lx += 30 + txt.length * 6.1 + 22; };
  leg2((x, y) => `<rect x="${x}" y="${y - 7}" width="24" height="14" fill="${STYLE.zoneV}" stroke="${STYLE.silver}" stroke-dasharray="4 3"/>`, 'ZS-t(h) hinge — BRIDGE zone, documented');
  leg2((x, y) => `<rect x="${x}" y="${y - 7}" width="24" height="14" fill="${STYLE.zoneV}"/>`, 'ZS-t latch — DIN 18015-3');
  leg2((x, y) => `<circle cx="${x + 12}" cy="${y}" r="7" fill="none" stroke="${STYLE.mains}" stroke-width="1.6"/>`, 'mains');
  leg2((x, y) => `<circle cx="${x + 12}" cy="${y}" r="7" fill="none" stroke="${STYLE.selv}" stroke-width="1.6"/>`, 'SELV / bus B');
  leg2((x, y) => `<circle cx="${x + 12}" cy="${y}" r="7" fill="none" stroke="${STYLE.prov}" stroke-width="1.6" stroke-dasharray="3 2"/>`, 'provisioned, empty');
  s += T(40, ly2 + 34, 'Draft geometry: opening 900 × 2100 (Planner defaults DOOR_W / DOOR_H), lintel 130 high with 150 bearing ⚑, zone bands 100–300 mm from the raw edge.', { fill: STYLE.faint });
  return s + '</svg>\n';
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// F2 — P33 R06 + R07 room pattern, from the model
// ═════════════════════════════════════════════════════════════════════════════════════════════
function portalGeometry(doc) {
  const P = doc.project, D = P.data, walls = P.building.walls.ground;
  const floors = D.floors.filter(f => f.level === 'ground');
  const inPoly = (pt, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) c = !c; } return c; };
  const roomAt = pt => (floors.find(f => inPoly(pt, f.poly)) || {}).num || 'outside';
  const out = [];
  for (const o of D.openings.filter(o => o.level === 'ground' && o.type === 'door')) {
    // the wall it sits in: the rect containing the opening centre
    const w = walls.find(w => o.x >= Math.min(w.x0, w.x1) - 1 && o.x <= Math.max(w.x0, w.x1) + 1 &&
                              o.y >= Math.min(w.y0, w.y1) - 1 && o.y <= Math.max(w.y0, w.y1) + 1);
    if (!w) continue;
    const horiz = Math.abs(w.x1 - w.x0) > Math.abs(w.y1 - w.y0);
    const wid = o.w || 900, u = horiz ? o.x : o.y;
    const hingeAtStart = !((o.variant || 0) & 2), side = ((o.variant || 0) & 1) ? 1 : -1;
    const hingeU = hingeAtStart ? u - wid / 2 : u + wid / 2, latchU = hingeAtStart ? u + wid / 2 : u - wid / 2;
    const away = hingeAtStart ? -1 : 1;                         // from the hinge jamb, away from the opening
    const lo = horiz ? Math.min(w.y0, w.y1) : Math.min(w.x0, w.x1), hi = horiz ? Math.max(w.y0, w.y1) : Math.max(w.x0, w.x1);
    const faces = [-1, 1].map(sg => {
      const v = sg < 0 ? lo : hi, probe = horiz ? [o.x, v + sg * 300] : [v + sg * 300, o.y];
      // free wall beyond the hinge jamb on this face, until the next perpendicular wall face
      let free = Infinity;
      for (const x of walls) { if (x === w) continue;
        const xh = Math.abs(x.x1 - x.x0) > Math.abs(x.y1 - x.y0); if (xh === horiz) continue;
        const a = horiz ? Math.min(x.x0, x.x1) : Math.min(x.y0, x.y1), b = horiz ? Math.max(x.x0, x.x1) : Math.max(x.y0, x.y1);
        const pa = horiz ? Math.min(x.y0, x.y1) : Math.min(x.x0, x.x1), pb = horiz ? Math.max(x.y0, x.y1) : Math.max(x.x0, x.x1);
        const pv = v + sg * 50; if (pv < pa || pv > pb) continue;
        const d = away > 0 ? a - hingeU : hingeU - b; if (d >= -1 && d < free) free = d; }
      return { sign: sg, room: roomAt(probe), plane: v, swing: sg === side, freeBeyondHinge: Math.round(free) };
    });
    out.push({ id: o.id, wall: w.id, horiz, u, wid, hingeU, latchU, away, faces });
  }
  return out;
}

function figRoomPlan(doc, geo) {
  const P = doc.project, D = P.data, walls = P.building.walls.ground;
  const k = 0.1, X0 = 4880, Y0 = 2090;
  const X = x => 40 + (x - X0) * k, Y = y => 70 + (y - Y0) * k;
  const W = 960, H = 860;
  let s = svgOpen(W, H, 'IDEA-003 F2 — the L pattern in P33 R06 nappali and R07 szoba',
    'Plan of R06 and R07 from the P33 test plan: walls, doors with handing, RBX06, the two rooms\' Silver Rails along their L-forma walls, the Portals and the corner cluster points.');
  s += `<defs><clipPath id="vw"><rect x="40" y="70" width="${f1((10560 - X0) * k)}" height="${f1((9400 - Y0) * k)}"/></clipPath></defs>`;
  s += T(40, 30, 'IDEA-003 · F2 — the L pattern: P33 R06 nappali + R07 szoba (geometry from P33-teszt_v2)', { size: STYLE.t1, weight: 600 });
  s += T(40, 48, 'Plan, 1 px = 10 mm. Thick faces = the user\'s L-forma marks. Both rooms are served by RBX06 on their shared wall W15.', { fill: STYLE.faint });
  let g = '';
  // rooms
  for (const f of D.floors.filter(f => f.level === 'ground')) {
    const main = f.num === 'R06' || f.num === 'R07';
    g += `<polygon points="${f.poly.map(p => f1(X(p[0])) + ',' + f1(Y(p[1]))).join(' ')}" fill="${main ? STYLE.room : '#fafafa'}" stroke="none"/>`;
  }
  // walls
  for (const w of walls) g += `<rect x="${f1(X(Math.min(w.x0, w.x1)))}" y="${f1(Y(Math.min(w.y0, w.y1)))}" width="${f1(Math.abs(w.x1 - w.x0) * k)}" height="${f1(Math.abs(w.y1 - w.y0) * k)}" fill="${STYLE.wall}" stroke="${STYLE.wallEdge}" stroke-width="0.6"/>`;
  // L-forma faces (the user's marks)
  for (const m of D.marks.filter(m => m.tags.includes('lforma'))) {
    const w = walls.find(x => x.id === m.wall); if (!w) continue;
    const horiz = Math.abs(w.x1 - w.x0) > Math.abs(w.y1 - w.y0);
    const v = m.side > 0 ? (horiz ? Math.max(w.y0, w.y1) : Math.max(w.x0, w.x1)) : (horiz ? Math.min(w.y0, w.y1) : Math.min(w.x0, w.x1));
    // the user's convention: side +1 = the face at the larger coordinate — verified against R06/R07 below
    const a = horiz ? Math.min(w.x0, w.x1) : Math.min(w.y0, w.y1), b = horiz ? Math.max(w.x0, w.x1) : Math.max(w.y0, w.y1);
    const off = m.side > 0 ? 18 : -18;
    g += horiz ? `<line x1="${f1(X(a))}" y1="${f1(Y(v + off))}" x2="${f1(X(b))}" y2="${f1(Y(v + off))}" stroke="${STYLE.ink}" stroke-width="2.2" opacity="0.55"/>`
               : `<line x1="${f1(X(v + off))}" y1="${f1(Y(a))}" x2="${f1(X(v + off))}" y2="${f1(Y(b))}" stroke="${STYLE.ink}" stroke-width="2.2" opacity="0.55"/>`;
  }
  // windows
  for (const o of D.openings.filter(o => o.level === 'ground' && o.type === 'window')) {
    const w = 1200, vert = Math.abs(Math.sin(o.ang)) > 0.5;
    g += vert ? `<rect x="${f1(X(o.x) - 12)}" y="${f1(Y(o.y - w / 2))}" width="24" height="${f1(w * k)}" fill="#ffffff" stroke="${STYLE.ink}" stroke-width="0.8"/><line x1="${f1(X(o.x))}" y1="${f1(Y(o.y - w / 2))}" x2="${f1(X(o.x))}" y2="${f1(Y(o.y + w / 2))}" stroke="${STYLE.ink}" stroke-width="0.6"/>`
              : `<rect x="${f1(X(o.x - w / 2))}" y="${f1(Y(o.y) - 12)}" width="${f1(w * k)}" height="24" fill="#ffffff" stroke="${STYLE.ink}" stroke-width="0.8"/>`;
  }
  // doors: gap, leaf, swing
  for (const p of geo) {
    const wall = walls.find(w => w.id === p.wall), sw = p.faces.find(f => f.swing);
    const lo = p.horiz ? Math.min(wall.y0, wall.y1) : Math.min(wall.x0, wall.x1), hi = p.horiz ? Math.max(wall.y0, wall.y1) : Math.max(wall.x0, wall.x1);
    const a = Math.min(p.hingeU, p.latchU), b = Math.max(p.hingeU, p.latchU);
    g += p.horiz ? `<rect x="${f1(X(a))}" y="${f1(Y(lo))}" width="${f1((b - a) * k)}" height="${f1((hi - lo) * k)}" fill="#ffffff"/>`
                 : `<rect x="${f1(X(lo))}" y="${f1(Y(a))}" width="${f1((hi - lo) * k)}" height="${f1((b - a) * k)}" fill="#ffffff"/>`;
    const pl = sw.plane, dir = sw.sign, Lw = p.wid;
    const hp = p.horiz ? [p.hingeU, pl] : [pl, p.hingeU];
    const lp = p.horiz ? [p.hingeU, pl + dir * Lw] : [pl + dir * Lw, p.hingeU];
    const cp = p.horiz ? [p.latchU, pl] : [pl, p.latchU];
    g += `<line x1="${f1(X(hp[0]))}" y1="${f1(Y(hp[1]))}" x2="${f1(X(lp[0]))}" y2="${f1(Y(lp[1]))}" stroke="${STYLE.ink}" stroke-width="1.4"/>`;
    const sweep = ((p.horiz ? 1 : -1) * dir * (p.latchU > p.hingeU ? 1 : -1)) > 0 ? 0 : 1;
    g += `<path d="M ${f1(X(lp[0]))} ${f1(Y(lp[1]))} A ${f1(Lw * k)} ${f1(Lw * k)} 0 0 ${sweep} ${f1(X(cp[0]))} ${f1(Y(cp[1]))}" fill="none" stroke="${STYLE.faint}" stroke-width="0.8" stroke-dasharray="3 2"/>`;
  }
  // the RBX
  const rbx = D.devices.find(d => (d.code || d.type) === 'rbx' && d.x > 5327 && d.x < 10100 && Math.abs(d.y - 6340) < 200);
  g += `<rect x="${f1(X(rbx.x - 300))}" y="${f1(Y(6215 - 20))}" width="${f1(600 * k)}" height="${f1(290 * k)}" fill="${STYLE.silver}" stroke="${STYLE.ink}" stroke-width="0.8"/>`;
  // Silver Rails, 70 mm inside each room face, routed along the L-forma faces (hand-listed corner points
  // on the model's wall faces; every coordinate below is a face plane of W12 / W13 / W14 / W15)
  const i = 70;
  const railR06 = [[5327 + i, 5591], [5327 + i, 6215 - i], [8837, 6215 - i]];
  const railR07 = [[rbx.x, 6465 + i], [5327 + i, 6465 + i], [5327 + i, 7540 - i], [6198 + i, 7540 - i], [6198 + i, 8807]];
  const railR07e = [[rbx.x, 6465 + i], [8837, 6465 + i]];
  const pl = pts => `<polyline points="${pts.map(p => f1(X(p[0])) + ',' + f1(Y(p[1]))).join(' ')}" fill="none" stroke="${STYLE.silver}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>`;
  g += pl(railR06) + pl(railR07) + pl(railR07e);
  // golden channel from RBX03 (R03 side) over B103's head, running above the rail to RBX06
  const ch = [[4980, 4941], [5327 + 30, 4941], [5327 + 30, 6215 - 30], [rbx.x, 6215 - 30]];
  g += `<polyline points="${ch.map(p => f1(X(p[0])) + ',' + f1(Y(p[1]))).join(' ')}" fill="none" stroke="${STYLE.gold}" stroke-width="2.5" stroke-dasharray="8 5"/>`;
  // Portals: H0 corner boxes (200 × 200 in elevation → drawn 200 × 90 in plan on the face)
  const h0 = (x, y, lab, anchor, dy) => { g += `<rect x="${f1(X(x) - 10)}" y="${f1(Y(y) - 10)}" width="20" height="20" fill="${STYLE.paper}" stroke="${STYLE.selv}" stroke-width="2"/>`;
    g += T(X(x) + (anchor === 'end' ? -16 : 16), Y(y) + 4 + (dy || 0), lab, { anchor: anchor || 'start', weight: 600, fill: STYLE.selv }); };
  h0(5327 + i, 5591, 'PT-S · B103 → R06 (H0 hinge side, swing face)');
  h0(8837, 6215 - i, 'PT-D · B171 (H0 latch side ×2)', 'end', -14);
  h0(8837, 6465 + i, '', 'end');
  h0(6198 + i, 8807, 'PT-S · B109 → R07 (H0 hinge side)');
  // corner cluster points: the corners the L leaves out
  const cc = [[5327 + 160, 2390 + 160], [10100 - 160, 2390 + 160], [10100 - 160, 6215 - 160], [10100 - 160, 6465 + 160], [10100 - 160, 9050 - 160], [6198 + 160, 9050 - 160]];
  const H0s = [[5327 + i, 5591], [8837, 6215 - i], [8837, 6465 + i], [6198 + i, 8807]];
  for (const [x, y] of cc) { if (H0s.some(([hx, hy]) => Math.hypot(hx - x, hy - y) < 600)) { g += `<circle cx="${f1(X(x))}" cy="${f1(Y(y))}" r="7" fill="none" stroke="${STYLE.ink}" stroke-width="1" stroke-dasharray="2 2"/>`; continue; }
    g += `<circle cx="${f1(X(x))}" cy="${f1(Y(y))}" r="7" fill="${STYLE.paper}" stroke="${STYLE.ink}" stroke-width="1.4"/><circle cx="${f1(X(x))}" cy="${f1(Y(y))}" r="2.5" fill="${STYLE.ink}"/>`; }
  s += `<g clip-path="url(#vw)">${g}</g>`;
  // room + box labels
  s += T(X(7700), Y(4000), 'R06 NAPPALI', { anchor: 'middle', size: STYLE.t1, weight: 600 });
  s += T(X(7700), Y(4000) + 16, '18.4 m² · RB-H RBX06 · 2 doors on its L', { anchor: 'middle', fill: STYLE.faint });
  s += T(X(8000), Y(7900), 'R07 SZOBA', { anchor: 'middle', size: STYLE.t1, weight: 600 });
  s += T(X(8000), Y(7900) + 16, '12.2 m² · from RBX06 · an L-shaped room', { anchor: 'middle', fill: STYLE.faint });
  s += T(X(rbx.x) + 34, Y(6340) + 4, 'RBX06', { weight: 600 });
  s += T(X(4900), Y(4941) - 22, 'from RBX03', { fill: '#8a6d12' });
  s += T(X(4980), Y(8700), 'R08', { fill: STYLE.faint });
  s += T(X(4950), Y(3600), 'R03 / R05', { fill: STYLE.faint });
  // legend (right column)
  const lx = 640; let ly = 110;
  const L = (sw, a, b) => { s += sw(lx, ly); s += T(lx + 34, ly + 4, a, { weight: 600 }); if (b) s += T(lx + 34, ly + 19, b, { fill: STYLE.faint }); ly += b ? 40 : 26; };
  L((x, y) => `<line x1="${x}" y1="${y}" x2="${x + 26}" y2="${y}" stroke="${STYLE.silver}" stroke-width="4"/>`, 'Silver Rail', 'RBX ↔ Portals, ZW-o ≈ 2450');
  L((x, y) => `<line x1="${x}" y1="${y}" x2="${x + 26}" y2="${y}" stroke="${STYLE.gold}" stroke-width="2.5" stroke-dasharray="8 5"/>`, 'golden channel', 'RBX03 → RBX06, above the rail');
  L((x, y) => `<rect x="${x + 5}" y="${y - 8}" width="16" height="16" fill="${STYLE.paper}" stroke="${STYLE.selv}" stroke-width="2"/>`, 'Portal corner box H0', 'the nest, 2450');
  L((x, y) => `<circle cx="${x + 13}" cy="${y}" r="7" fill="${STYLE.paper}" stroke="${STYLE.ink}" stroke-width="1.4"/>`, 'corner cluster point', 'the corners the L leaves out');
  L((x, y) => `<line x1="${x}" y1="${y}" x2="${x + 26}" y2="${y}" stroke="${STYLE.ink}" stroke-width="2.2" opacity="0.55"/>`, 'L-forma face', 'the user\'s mark in the plan');
  L((x, y) => `<rect x="${x}" y="${y - 7}" width="26" height="14" fill="${STYLE.silver}" stroke="${STYLE.ink}" stroke-width="0.8"/>`, 'RBX (RB-H)', '');
  ly += 10;
  const notes = [
    'Read in the model:',
    '· B103 and B171 both open INTO R06, so R06',
    '  sees their swing faces (Q-SF-08 rule H0-2).',
    '· B171\'s hinge jamb is only ' + (geo.find(p => p.id === 'B171') || { faces: [{}] }).faces.find(f => f.room === 'R06').freeBeyondHinge + ' mm from',
    '  the east wall: no room for a 200 box in',
    '  ZS-t(h), so H0 moves to the latch side',
    '  (rule H0-3) on both faces.',
    '· R07\'s two L-forma faces do not meet: its',
    '  rail goes round the R08 notch (W12, W13).',
    '· R06 and R07 share W15 as one arm each;',
    '  RBX06 sits in it and feeds both rails.',
    '· R07 SW corner point lies 120 mm from',
    '  the H0 of B109: the Portal absorbs it.',
  ];
  for (const n of notes) { s += T(lx, ly, n, { fill: n.endsWith(':') ? STYLE.ink : '#55534d', weight: n.endsWith(':') ? 600 : 400 }); ly += 16; }
  return s + '</svg>\n';
}

const doc = JSON.parse(fs.readFileSync(PLAN, 'utf8'));
const geo = portalGeometry(doc);
fs.writeFileSync(path.join(OUT, 'IDEA-003_F1_door-elevation.svg'), figElevation());
fs.writeFileSync(path.join(OUT, 'IDEA-003_F2_room-pattern.svg'), figRoomPlan(doc, geo));
process.stdout.write(JSON.stringify(geo.map(p => ({ id: p.id, wall: p.wall, hinge: p.hingeU, latch: p.latchU,
  faces: p.faces.map(f => `${f.room}${f.swing ? ' (swing)' : ''} free beyond hinge ${f.freeBeyondHinge}`) })), null, 1) + '\n');
