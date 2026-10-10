#!/usr/bin/env node
// Bakes plans into a copy of the build, so the file opens straight onto them (06b preloadBoot / preOffer).
//
//   node tools/make-preload.js            -> dist/varler_planner_P33.html with P33 teszt v1 + v2
//
// The P33 plans are trimmed for drawing the routing by hand (the user, 2026-10-10): the blueprint, the marks and the
// endpoints stay; of the hardware ONLY the Elosztószekrény stays (its cabinet defaults in 05x are P33's own,
// BUILD-001 §14). BASE, RBXs, ARM T-boxes, the channel routes and everything that pointed at them go. The ceiling is
// the user's 2850 (IDEA-003 §2.3; the test files still say 2700), and the stack gets the Klaszterpontok and Extrák
// layers it predates. Both get the client sheet's furniture and the upper floor (p33-furniture.js furnish()).
// The source files in Calculator/ are not touched.
'use strict';
const fs = require('fs'), path = require('path');
const { furnish } = require('./p33-furniture');   // the client sheet's furniture + the upper floor (tools/p33-furniture.js)
const ROOT = path.resolve(__dirname, '..'), REPO = path.resolve(ROOT, '..', '..', '..');
const DIST = path.join(ROOT, 'dist', 'varler_planner.html');
const OUT = path.join(ROOT, 'dist', 'varler_planner_P33.html');
const PLANS = [
  { file: 'Calculator/P33-teszt_v1.vplan.json', name: 'P33 v1 — ügyfél végpontjai · csak Elosztó',
    note: 'Szerkezet, jelölések, az ügyfél 55 végpontja és az eredeti tervlap bútorai (emelettel); a hardverből csak az Elosztószekrény. A BASE, az RBX-ek, a portálok és az útvonalak a tieid.' },
  { file: 'Calculator/P33-teszt_v2.vplan.json', name: 'P33 v2 — minden réteg · csak Elosztó',
    note: 'Minden rendszerréteg végpontjai (124) és az eredeti tervlap bútorai (emelettel); a hardverből csak az Elosztószekrény. Rajzold meg a BASE-t, az RBX-eket, a portálokat, a csatornát és az ezüst síneket.' }];
const DROP_TYPES = ['base', 'rbx', 'junction', 'meter', 'entry', 'ssc', 'portal', 'cluster'];
const CEIL = 2850;
const NEW_ROLES = [{ k: 'cluster', n: 'Klaszterpontok', after: 'sys:SECURITY' }, { k: 'sys:EXTRA', n: 'Extrák és ötletek', after: 'arm' }];

function trim(project) {
  const P = JSON.parse(JSON.stringify(project)), D = P.data;
  const gone = new Set(D.devices.filter(d => DROP_TYPES.includes(d.type)).map(d => d.id));
  D.devices = D.devices.filter(d => !gone.has(d.id));
  const goneP = new Set(D.paths.filter(p => p.route).map(p => p.id));          // channel / arm / rail routes
  D.paths = D.paths.filter(p => !goneP.has(p.id));
  D.devices.forEach(d => {
    if (Array.isArray(d.links)) { d.links = d.links.filter(l => !goneP.has(l.p)); if (!d.links.length) delete d.links; }
    if (d.link && goneP.has(d.link.p)) delete d.link;
    if (d.host && gone.has(d.host)) delete d.host;
    if (Array.isArray(d.serves)) delete d.serves; });
  D.circuits = (D.circuits || []).map(c => Object.assign(c, { members: (c.members || []).filter(id => !gone.has(id)) })).filter(c => c.members.length);
  D.runs = []; D.traces = D.traces || [];
  // the board object follows its board (ensureBoardObject keeps it in step on load)
  D.objects = (D.objects || []).filter(o => !o.hwFor);
  const H = P.building.heights || (P.building.heights = {});
  ['ground', 'upper'].forEach(l => { H[l] = CEIL; });
  // the stack roles the file predates, in their place in the role order
  (P.stacks || []).forEach(S => {
    const mine = P.layers.filter(l => l.stack === S.id), cats = (mine[0] && mine[0].cats) || {};
    NEW_ROLES.forEach(r => {
      if (mine.some(l => l.role === r.k)) return;
      const prev = P.layers.find(l => l.stack === S.id && l.role === r.after);
      const L = { id: 'L' + S.id.slice(1) + '_' + r.k.replace(/\W/g, ''), name: 'B1 · ' + r.n, visible: true, cats: Object.assign({}, cats), stack: S.id, role: r.k };
      P.layers.splice(prev ? P.layers.indexOf(prev) + 1 : P.layers.length, 0, L); });
    S.layers = P.layers.filter(l => l.stack === S.id).map(l => l.id); });
  // open on the Hardver layer, nothing selected, the stack active
  const S0 = (P.stacks || [])[0], hw = S0 && P.layers.find(l => l.stack === S0.id && l.role === 'hw');
  Object.assign(P.state, { activeLayer: hw ? hw.id : P.state.activeLayer, stack: S0 ? S0.id : null, stkOff: false, stage: hw ? 'stk:hw' : P.state.stage });
  return { P, removed: { devices: gone.size, paths: goneP.size } };
}

if (!fs.existsSync(DIST)) { console.error('no build — run: node build.js'); process.exit(1); }
let html = fs.readFileSync(DIST, 'utf8');
const list = PLANS.map(p => {
  const src = JSON.parse(fs.readFileSync(path.join(REPO, p.file), 'utf8'));
  const t = trim(src.project || src), fu = furnish(t.P);
  const kept = t.P.data.devices.length, board = t.P.data.devices.filter(d => d.type === 'board').length;
  console.log(p.file + ': removed ' + t.removed.devices + ' hardware devices and ' + t.removed.paths + ' routes · kept ' + kept + ' devices (' + board + ' Elosztó) · furnished with ' + fu.objs.length + ' objects + the upper floor');
  return { name: p.name, note: p.note, project: t.P }; });
const tag = '<script>window.VRG_PRELOAD=' + JSON.stringify(list).replace(/<\/script/gi, '<\\/script') + ';</script>\n';
const at = html.indexOf('<script');
if (at < 0) { console.error('no <script> in the build'); process.exit(1); }
html = html.slice(0, at) + tag + html.slice(at);
html = html.replace(/<title>([^<]*)<\/title>/, (m, t) => '<title>' + t + ' — P33 előtöltve</title>');
fs.writeFileSync(OUT, html);
console.log('wrote ' + path.relative(ROOT, OUT) + ' (' + Math.round(html.length / 1024) + ' kB)');
