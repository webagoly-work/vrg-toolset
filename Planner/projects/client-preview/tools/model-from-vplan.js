#!/usr/bin/env node
// model-from-vplan.js — the client preview model for a saved plan, without opening the Planner.
//
//   node tools/model-from-vplan.js <plan.vplan.json> <out.json> [ground=in upper=ghost basement=skip]
//
// Boots the built Planner (../varler-planner/dist/varler_planner.html) in jsdom, loads the
// plan the same way "Megnyitás fájlból" does, and calls cpvModel() — so the model is exactly
// what the Planner's own export will produce. Needs jsdom: run with NODE_PATH pointing at a
// node_modules that has it (the Planner's, or the main checkout's).
'use strict';
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom');
const [, , IN, OUT, ...rest] = process.argv;
if (!IN || !OUT) { console.error('usage: node tools/model-from-vplan.js <plan.vplan.json> <out.json> [level=in|ghost|skip ...]'); process.exit(2); }
const scope = {};
rest.forEach(a => { const m = /^(basement|ground|upper)=(in|ghost|skip)$/.exec(a); if (!m) { console.error('bad scope: ' + a); process.exit(2); } scope[m[1]] = m[2]; });

const HTML = process.env.PLANNER || path.join(__dirname, '..', '..', 'varler-planner', 'dist', 'varler_planner.html');
const dom = new JSDOM(fs.readFileSync(HTML, 'utf8'), { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window;
w.alert = () => {}; w.confirm = () => true;
setTimeout(() => {
  const doc = JSON.parse(fs.readFileSync(IN, 'utf8'));
  const payload = doc.project ? doc.project : doc;
  w.hardResetWorkspace();
  w.applyProjectData(payload);
  const model = w.cpvModel({ scope, name: doc.name });
  fs.writeFileSync(OUT, JSON.stringify(model));
  const lv = model.levels.map(l => l.id + ':' + l.scope).join(' ');
  console.log(`${model.name}: ${lv} · ${model.rooms.length} rooms · ${model.walls.length} walls · ${model.devices.length} devices · ${model.openings.length} openings -> ${OUT}`);
  w.close();
}, 50);
