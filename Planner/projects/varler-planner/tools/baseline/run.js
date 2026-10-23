#!/usr/bin/env node
// run.js — Erősáram baseline for one .vplan
//   node tools/baseline/run.js <in.vplan.json> <outDir> [config.js]
// Writes: <name>_alap.vplan.json (heights, portal slots, boxes, conduit paths, circuits) · sheets (PNG/SVG) ·
// ALAPRETEG.md (tables to approve) · legs.csv. The Planner is not needed; the output loads in it.
// With cfg.data / cfg.led / cfg.oldPlan also: the Adat/PoE layer, the LED feed points, the old-plan check (emit-data.js).
'use strict';
const fs = require('fs'), path = require('path');
const geom = require('./geom'), prep = require('./prep'), { plan } = require('./plan');
const [, , inFile, outDir, cfgFile] = process.argv;
if (!inFile || !outDir) { console.error('usage: run.js <in.vplan.json> <outDir> [config.js]'); process.exit(2); }
const cfg = require(path.resolve(cfgFile || path.join(__dirname, 'cla.config.js')));
const doc = JSON.parse(fs.readFileSync(inFile, 'utf8'));
prep.applyEdits(doc, cfg);
const G = geom.load(doc, cfg.level);
const { allowed, offWall } = geom.allowedFromSketch(G, G.D.paths);
(cfg.allowExtra || []).forEach(a => (allowed[a.wall] = allowed[a.wall] || []).push(a.iv));
const E = prep.endpoints(G, cfg); prep.applyHeights(E);
const PT = prep.portals(G, E); prep.portalMembers(G, PT, E); prep.placeInPortals(G, PT, E);
const R = plan(G, E, PT, cfg, allowed);
fs.mkdirSync(outDir, { recursive: true });
const ctx = { G, E, PT, R, cfg, allowed, offWall, doc, inFile, outDir };
module.exports = ctx;
if (require.main === module) {
  require('./emit').all(ctx);
  if (cfg.data || cfg.led || cfg.oldPlan) { const X = require('./emit-data').all(ctx);
    console.log(`adat: ${X.DA.legs.length} csőszakasz, ${X.DA.boxes.length} doboz, ${X.DA.warn.length} figyelmeztetés · LED: ${X.LE.runs.length} kezdőpont · régi terv: ${X.OP ? X.OP.ITEMS.length + ' tétel' : '—'}`); }
  // the quantities for pricing (Varler Workflow Kit): <name>_takeoff.json + MENNYISEGEK.md
  const T = require('./takeoff').write(ctx, outDir); console.log(`mennyiségek: ${T.endpoints.length} erősáramú végpont, ${T.circuits.length} kör, ${T.floor_area_m2} m²`);
  const n = k => R.legs.filter(l => l.kind === k).length;
  console.log(`boxes ${R.boxes.length} (${['rbx', 'sp', 'drop', 'corner', 'end', 'island'].map(k => k + ' ' + R.boxes.filter(b => b.kind === k).length).join(', ')})`);
  console.log(`legs ${R.legs.length} (trunk ${n('trunk')}, dist ${n('dist')}, drop ${n('drop')}, ceil ${n('ceil')}, floor ${n('floor')}, island ${n('island')}, feed ${n('feed')})`);
  console.log(`circuits ${R.C.list.length}: ${R.C.list.map(c => c.ref + '(' + c.members.length + ')').join(' ')}`);
  console.log(`warnings ${R.warn.length}`); R.warn.forEach(w => console.log('  ' + w.sev + ': ' + w.msg));
}
