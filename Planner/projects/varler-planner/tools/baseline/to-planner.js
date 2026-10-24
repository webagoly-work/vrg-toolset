#!/usr/bin/env node
// to-planner.js — turn a baseline config's ANSWERS into ordinary Planner data (WP-E5 acceptance, E5-Q12 = C, step A)
//   node tools/baseline/to-planner.js <in.vplan.json> <out.vplan.json> [config.js]
// The CLA answers lived only in cla.config.js; the Planner's engine reads the plan itself. This writes them as what the
// Planner's own tools would have made, so the two engines can be compared on equal input:
//   edits (new / moved points) and the engine's heights + portal placement → the devices themselves
//   socketPlan + lighting zones                 → data.circuits (lighting: preset 'vil')
//   switchGroups + the inferred lamp → switch   → sw.ctl, lamp legs (d.grp), sw.swType (101 / 105 / 106 / 107)
//   rbxSwitched                                 → lamp.rbxSw (switched by an RBX output, no wall switch)
//   wetRooms / roomKinds                        → room kinds
//   sketch lines + allowExtra                   → Vezethető fal spans (wspan), the sketch kept on a hidden layer
//   floorGroups                                 → Padló út lines (one per member; shared start + junction point)
//   ceilLinks                                   → a wall-to-wall Mennyezeti út (a crossing, Q9)
// Not carried (no Planner equivalent yet — listed in the output): floorLinks, risers, prepared routes, spBoxSize, the
// shutter switches (redőny control is on its own layer now). Reads the input; writes only <out>.
'use strict';
const fs = require('fs'), path = require('path');
const geom = require('./geom'), prep = require('./prep'), { plan } = require('./plan'), NW = require('./network');
const [, , inFile, outFile, cfgFile] = process.argv;
if (require.main === module && (!inFile || !outFile)) { console.error('usage: to-planner.js <in.vplan.json> <out.vplan.json> [config.js]'); process.exit(2); }
if (require.main === module) {
  const cfg = require(path.resolve(cfgFile || path.join(__dirname, 'cla.config.js')));
  const doc = JSON.parse(fs.readFileSync(inFile, 'utf8'));
  const out = convert(doc, cfg);
  fs.writeFileSync(outFile, JSON.stringify(out.doc));
  console.log(JSON.stringify(out.report, null, 1));
}

function convert(doc, cfg) {
  const report = { carried: [], notCarried: [] }, lvl = cfg.level;
  prep.applyEdits(doc, cfg);
  const G = geom.load(doc, lvl), { allowed } = geom.allowedFromSketch(G, G.D.paths);
  (cfg.allowExtra || []).forEach(a => (allowed[a.wall] = allowed[a.wall] || []).push(a.iv));
  const E = prep.endpoints(G, cfg); prep.applyHeights(E); const PT = prep.portals(G, E); prep.portalMembers(G, PT, E); prep.placeInPortals(G, PT, E);
  const R = plan(G, E, PT, cfg, allowed);
  // T0 / F4: the Planner's engine takes the latch from the door, so each door's handle goes where CLA had its 230 V side
  PT.forEach(p => { if (p.door.variant == null || prep.doorLatch(p.door, p.axis) === p.latch) return;
    const o = doc.project.data.openings.find(x => x.id === p.id); if (!o) return; o.variant = (o.variant || 0) ^ 2;
    report.carried.push(`${p.id}: az ajtó kilincse a CLA kilincsoldalára fordítva`); });
  const P = doc.project, D = P.data, dev = id => D.devices.find(d => d.id === id);
  let seq = +D.seq || 0; const nid = p => p + (++seq);
  // 1. devices: the engine's heights and portal positions become the placed values
  let moved = 0, heights = 0;
  E.forEach(e => { if (!e.dev) return; const d = dev(e.id); if (!d) return;
    if (Math.round(e.h) !== Math.round(d.h)) heights++; d.h = Math.round(e.h);
    // a moved point lands on its face; never exactly on a corner (there two faces tie and the Planner could pick the other)
    if (e.moved) { let x = e.x, y = e.y; if (e.face) { const f = e.face, u = Math.max(f.lo + 1, Math.min(f.hi - 1, e.u)); x = f.horiz ? u : f.fix; y = f.horiz ? f.fix : u; }
      d.x = Math.round(x); d.y = Math.round(y); moved++; }
    if (e.adopted) { d.code = 'SWI'; d.var = '230'; d.type = 'switch'; d.layer = (P.layers.find(l => l.role === 'sys:MAINS') || {}).id || d.layer; } });
  report.carried.push(`edits ${(cfg.edits || []).length} (új pont ${Object.keys(cfg._ids || {}).length}), magasság ${heights}, portálhelyre tolva ${moved}`);
  // 2. rooms: wet rooms and kinds
  const kindByName = f => /wc/i.test(f.name || '') ? 'wc' : /fürdő|furdo/i.test(f.name || '') ? 'furdo' : 'furdo';
  D.floors.filter(f => f.level === lvl).forEach(f => { const id = f.num || f.id, ks = new Set(f.kinds || (f.kind ? [f.kind] : []));
    if ((cfg.wetRooms || []).includes(id) && ![...ks].some(k => k === 'wc' || k === 'furdo')) ks.add(kindByName(f));
    ((cfg.roomKinds || {})[id] || []).forEach(k => ks.add(k));
    if (ks.size) { f.kinds = [...ks]; f.kind = f.kinds[0]; } });
  report.carried.push('helyiségtípus: ' + [...(cfg.wetRooms || []), ...Object.keys(cfg.roomKinds || {})].join(', '));
  // 3. circuits as the engine resolved them (socket plan, lighting zones, the lamp-follows-its-switch rule)
  const old = {}; D.circuits.forEach(c => old[c.ref] = c);
  D.circuits = R.C.list.map(c => { const o = { ref: c.ref, name: c.name, col: (old[c.ref] || {}).col, dedicated: !!c.dedicated, mcb: c.mcb || '',
    members: c.members.filter(e => e.dev).map(e => e.id), id: (old[c.ref] || {}).id || nid('A') };
    if (c.kind === 'light') { o.preset = 'vil'; o.kind = 'light'; } return o; });
  report.carried.push('áramkörök ' + D.circuits.length + ': ' + D.circuits.map(c => c.ref).join(' '));
  // 4. switching: every unit → its switches' ctl; a unit's lamps are one leg (grp), except a csillár (two legs)
  const MAINS = new Set(E.filter(e => e.role === 'sys:MAINS').map(e => e.id));
  D.devices.forEach(d => { if (!MAINS.has(d.id)) return; if ((d.code || '') === 'SWI' || d.type === 'switch') { delete d.ctl; } if (d.grp) delete d.grp; });
  let g = 0, units = 0;
  R.L.units.forEach(u => { const lamps = u.lamps.filter(id => dev(id)), sws = u.switches.filter(id => dev(id)); if (!lamps.length || !sws.length) return; units++;
    if (u.mode !== 'double' && lamps.length > 1) { const k = 'G' + (++g); lamps.forEach(id => { dev(id).grp = k; }); }
    sws.forEach((id, k) => { const s = dev(id); s.ctl = [...new Set([...(s.ctl || []), ...lamps])];
      s.swType = u.mode === 'double' ? '105' : sws.length === 1 ? '101' : (k === 0 || k === sws.length - 1) ? '106' : '107'; });
    if (sws.length > 1) dev(sws[0]).swHead = true; });                // chain[0]: the box the lamps hang from
  Object.keys(cfg.rbxSwitched || {}).forEach(id => { const d = dev(id); if (d) d.rbxSw = true; });
  report.carried.push(`kapcsolás: ${units} egység, ${g} lámpacsoport, RBX-kapcsolt ${Object.keys(cfg.rbxSwitched || {}).length}`);
  // 5. marks: the sketch lines → Vezethető fal spans (the CLI's loose intervals ± PAD, clamped to the wall)
  D.marks = D.marks || []; let spans = 0;
  Object.entries(allowed).forEach(([wid, iv]) => { const w = G.wallById[wid]; if (!w) return; const a0 = w.axis === 'x' ? w.x0 : w.y0, a1 = w.axis === 'x' ? w.x1 : w.y1;
    iv.forEach(([a, b, x]) => { if (x) return;                          // an exact interval is a mark already
      const lo = Math.max(a0, a - NW.PAD), hi = Math.min(a1, b + NW.PAD);
      D.marks.push({ kind: 'wspan', wall: wid, level: lvl, u0: Math.round(lo - a0), u1: Math.round(hi - a0), tags: ['vezetheto'], pol: 'plus', layer: 'L0', id: nid('M') }); spans++; }); });
  const sk = { id: 'L_sketch_' + seq, name: 'Vázlat — kézi vonalak (eredeti)', visible: false, cats: { path: true } }; P.layers.push(sk); D.paths.forEach(p => { p.layer = sk.id; });
  report.carried.push(`vezethető fal: ${spans} szakasz a vázlatvonalakból (+ allowExtra ${(cfg.allowExtra || []).length})`);
  // 6. floor groups → Padló út lines: start at the service point, right-angled (as the engine runs it) to the junction, to each member
  const fl = R.legs.filter(l => l.kind === 'floor'), isl = R.legs.filter(l => l.kind === 'island');
  (cfg.floorGroups || []).forEach(grp => { const leg = fl.find(l => l.group === grp.name); if (!leg) { report.notCarried.push('padló csoport ' + grp.name + ': nem futott'); return; }
    const b = leg.poly[0], j = leg.poly[leg.poly.length - 1], spDev = dev(grp.sp), from = spDev ? { dev: grp.sp } : { door: grp.sp };
    isl.filter(l => l.from === leg.to).forEach(l => { const d = dev(l.dev); if (!d) return;
      D.marks.push({ kind: 'cline', plane: 'floor', level: lvl, pts: [[Math.round(b[0]), Math.round(b[1])], [Math.round(j[0]), Math.round(b[1])], [Math.round(j[0]), Math.round(j[1])], [d.x, d.y]], to: d.id, from,
        h: 0, boxH: Math.round(j[2]), pol: 'plus', tags: ['padlo-ut'], layer: 'L0', id: nid('M') }); }); });
  report.carried.push('padló út: ' + D.marks.filter(m => m.kind === 'cline' && m.plane === 'floor').length + ' vonal (' + (cfg.floorGroups || []).map(x => x.name).join(', ') + ')');
  // 7. ceiling crossings
  (cfg.ceilLinks || []).forEach(cl => D.marks.push({ kind: 'cline', level: lvl, pts: [cl.a, cl.b], from: { wall: null }, cross: true, h: cfg.ceiling, void: false,
    pol: 'plus', tags: ['mennyezet-ut'], layer: 'L0', id: nid('M'), note: cl.n }));
  report.carried.push('mennyezeti átvezetés: ' + (cfg.ceilLinks || []).length);
  ['floorLinks', 'risers', 'prepared'].forEach(k => { if ((cfg[k] || []).length) report.notCarried.push(k + ' ' + cfg[k].length); });
  if (cfg.spBoxSize) report.notCarried.push('spBoxSize');
  const shu = E.filter(e => e.isNew).length; if (shu) report.notCarried.push('redőnykapcsoló ' + shu + ' (külön rétegen)');
  D.seq = seq; doc.name = (doc.name || 'CLA') + ' — Planner-adat (to-planner)'; doc.saved = new Date().toISOString();
  return { doc, report, R };
}
module.exports = { convert };
