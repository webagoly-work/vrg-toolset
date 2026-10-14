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
const cfg = require(path.resolve(cfgFile || path.join(__dirname, 'p33.config.js')));
const doc = JSON.parse(fs.readFileSync(inFile, 'utf8'));
applyEdits(doc, cfg);
const G = geom.load(doc, cfg.level);
const { allowed, offWall } = geom.allowedFromSketch(G, G.D.paths);
(cfg.allowExtra || []).forEach(a => (allowed[a.wall] = allowed[a.wall] || []).push(a.iv));
const E = prep.endpoints(G, cfg); prep.applyHeights(E);
const PT = prep.portals(G, E); prep.portalMembers(G, PT, E); prep.placeInPortals(G, PT, E);
const R = plan(G, E, PT, cfg, allowed);
fs.mkdirSync(outDir, { recursive: true });
const ctx = { G, E, PT, R, cfg, allowed, offWall, doc, inFile, outDir };
module.exports = ctx;
// the user's answers as edits on the sketch itself: new points get real ids (so the output .vplan carries them),
// moves change x / y, hFix pins a height. "N:name" references in the config resolve to those ids.
function applyEdits(doc, cfg) {
  const D = doc.project.data, P = doc.project, L_MAINS = (P.layers.find(l => l.role === 'sys:MAINS') || {}).id, ids = {};
  (cfg.edits || []).forEach(ed => {
    if (ed.move) { const d = D.devices.find(x => x.id === ed.move); if (!d) return;
      if (ed.x != null) d.x = ed.x; if (ed.y != null) d.y = ed.y; if (ed.hFix != null) { d.h = ed.hFix; d.hFix = true; }
      if (ed.setNote != null) d.note = ed.setNote;                                 // a corrected note replaces the old one (R09)
      d.note = ((d.note || '') + ' · ' + ed.note).replace(/^ · /, ''); d.edited = true; return; }
    if (ed.add) { const at = ed.at && D.devices.find(x => x.id === ed.at), id = 'D' + (++D.seq);
      D.devices.push({ type: ed.type, code: ed.code || (ed.type === 'switch' ? 'SWI' : undefined), var: ed.var || (ed.type === 'switch' ? '230' : undefined), kind: ed.kind,
        level: cfg.level, x: at ? at.x : ed.x, y: at ? at.y : ed.y, h: ed.hFix != null ? ed.hFix : (at ? at.h : 1100), hFix: ed.hFix != null, layer: L_MAINS, id, ref: ed.ref, note: ed.note, faceBack: false, added: true });
      ids['N:' + ed.add] = id; } });
  const res = v => (typeof v === 'string' && ids[v]) || v;
  (cfg.switchGroups || []).forEach(g => { g.lamps = g.lamps.map(res); g.chain = g.chain.map(res); });
  (cfg.floorGroups || []).forEach(g => { if (g.members) g.members = g.members.map(res); });
  (cfg.socketPlan || []).forEach(p => { if (p.members) p.members = p.members.map(res); if (p.add) p.add = p.add.map(res); });
  if (cfg.rbxSwitched) cfg.rbxSwitched = Object.fromEntries(Object.entries(cfg.rbxSwitched).map(([k, v]) => [res(k), v]));
  cfg._ids = ids;
}

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
