#!/usr/bin/env node
// cla-upper-import.js — put CLA's upper floor into a copy of the plan, as an approximate ghost.
//
//   node tools/cla-upper-import.js <in.vplan.json> <out.vplan.json>
//
// The CLA plan only has the ground floor. The upper floor exists as a vector sheet in
// BRIDGE/07_CLA/blueprints/src/cla-sheets.js (upper(), r1 2026-10-06), drawn in the same
// 2000 x 1414 px frame as the ground sheet. The rectangles below are copied from there.
//
// Mapping px -> mm. The ground sheet matches the plan at ~7.29 mm/px on both axes
// (outer walls, the step and the masonry spine all land within ~10 mm). The upper sheet
// is drawn ~7 % narrower, so x is mapped piecewise through three anchors that must line
// up structurally: left outer wall, the masonry spine (it continues upstairs) and the
// right outer wall. y uses the ground sheet's uniform mapping. SCHEMATIC: the sheet was
// traced from a marketing render, not surveyed — good enough for a ghost, not for work.
'use strict';
const fs = require('fs');
const [, , IN, OUT] = process.argv;
if (!IN || !OUT) { console.error('usage: node tools/cla-upper-import.js <in.vplan.json> <out.vplan.json>'); process.exit(2); }

// x anchors [sheet px, plan mm]: left outer face, spine left/right faces, right outer face
const XA = [[307, 434], [1068, 5607], [1120, 5907], [1700, 10450]];
const mx = px => { for (let i = 0; i < XA.length - 1; i++) { const [a, A] = XA[i], [b, Bm] = XA[i + 1];
  if (px <= b || i === XA.length - 2) return A + (px - a) * (Bm - A) / (b - a); } };
const my = py => 2090 + (py - 155) * (9350 - 2090) / (1150 - 155);
const rect = (x0, y0, x1, y1) => ({ x0: Math.round(mx(x0)), y0: Math.round(my(y0)), x1: Math.round(mx(x1)), y1: Math.round(my(y1)) });

// cla-sheets.js upper(): wall(...) calls
const WALLS = [
  [610, 600, 1068, 630], [610, 1110, 1385, 1140], [1068, 520, 1120, 740], [1068, 860, 1120, 1140],
  [1068, 520, 1500, 545], [1120, 730, 1135, 745], [1225, 730, 1500, 745], [1470, 330, 1500, 775],
  [1470, 330, 1700, 350], [1650, 330, 1700, 775], [1595, 745, 1700, 775], [1335, 745, 1350, 780],
  [1335, 870, 1385, 1140],
  [615, 625, 660, 1110],   // korlát (railing) over the void, kept as a low wall
];
// cla-sheets.js upper(): floor R(...) calls, with the sheet's room labels
const ROOMS = [
  ['Szoba', [660, 630, 1068, 1110]], ['Fürdő', [1120, 545, 1470, 730]], ['Tároló', [1500, 350, 1650, 745]],
  ['Közlekedő', [1120, 745, 1335, 885]], ['Lépcső', [1120, 885, 1335, 1110]], ['Terasz', [1385, 775, 1700, 1080]],
];

const doc = JSON.parse(fs.readFileSync(IN, 'utf8'));
const P = doc.project, D = P.data;
let seq = +D.seq || 0;
const id = p => p + (++seq);
P.building.walls.upper = WALLS.map((w, i) => Object.assign(rect(...w), { id: id('W'), layer: 'L0' },
  i === WALLS.length - 1 ? { h: 1000, name: 'korlát' } : {}));
D.floors = D.floors.filter(f => f.level !== 'upper');
ROOMS.forEach(([name, [x0, y0, x1, y1]]) => { const r = rect(x0, y0, x1, y1);
  D.floors.push({ level: 'upper', name, poly: [[r.x0, r.y0], [r.x1, r.y0], [r.x1, r.y1], [r.x0, r.y1]], fill: '#e2ddd0', layer: 'L0', id: id('F') }); });
D.seq = seq;
fs.writeFileSync(OUT, JSON.stringify(doc, null, 2));
console.log(`upper: ${WALLS.length} walls, ${ROOMS.length} rooms -> ${OUT}`);
