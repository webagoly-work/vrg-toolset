#!/usr/bin/env node
// tools/sketch-takeoff.js — a VRG Sketcher survey → its takeoff (Munkakör lap): <stem>.takeoff.json + <stem>.takeoff.md.
//
//   node tools/sketch-takeoff.js <package.vsketch.json | survey.vsketch.json> [--out <dir>] [--reserve <mm>] [--loose <mm>]
//                                 [--stdout] [--md]
//
// Input: the package the phone or the Desktop Sketcher exports (kind vrg-sketch: the survey + its solved plan), or a bare
// survey file (kind vrg-vazlat: no plan, lengths at the default scale, all ≈). Output next to the input (or in --out):
// the vrg-sketch-takeoff v1 document and its Hungarian summary (docs/sketcher/TAKEOFF.md is the contract). --stdout
// prints the JSON instead (--md: the summary). --reserve / --loose override the cable allowance per end (mm).
// The engine is Sketcher/lib/takeoff.js, the same one the Desktop page runs; the phone runs its Kotlin twin.
// No prices: the Varler Workflow Kit prices it (its takeoff.js → price.js → offer.js, on the PC).
'use strict';
const fs = require('fs'), path = require('path');
const REPO = path.join(__dirname, '..');
const FK = require(path.join(REPO, 'Sketcher', 'lib', 'fieldkit.js'));
const T = require(path.join(REPO, 'Sketcher', 'lib', 'takeoff.js'));

function usage(msg) {
  if (msg) console.error(msg);
  console.error('usage: node tools/sketch-takeoff.js <package.vsketch.json> [--out <dir>] [--reserve <mm>] [--loose <mm>] [--stdout] [--md]');
  process.exit(2);
}

function main(argv) {
  const args = argv.slice(2), opt = {};
  let file = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--out') opt.out = args[++i];
    else if (a === '--reserve') opt.reserve = +args[++i];
    else if (a === '--loose') opt.loose = +args[++i];
    else if (a === '--stdout') opt.stdout = true;
    else if (a === '--md') opt.md = true;
    else if (a === '-h' || a === '--help') usage();
    else if (a.startsWith('--')) usage('unknown option ' + a);
    else file = a;
  }
  if (!file) usage();
  if ((opt.reserve != null && !(opt.reserve >= 0)) || (opt.loose != null && !(opt.loose >= 0))) usage('--reserve / --loose: millimetres, 0 or more');
  const kitJson = JSON.parse(fs.readFileSync(path.join(REPO, 'Sketcher', 'catalog', 'fieldkit.json'), 'utf8'));
  const rules = T.parseRules(JSON.parse(fs.readFileSync(path.join(REPO, 'Sketcher', 'catalog', 'takeoff.json'), 'utf8')));
  let o;
  try { o = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { console.error('cannot read ' + file + ': ' + e.message); process.exit(1); }
  let inp;
  try { inp = T.input(o); } catch (e) { console.error(e.message); process.exit(1); }
  const s = inp.sketch;
  let kit = FK.parseKit(kitJson);
  if (s.variantOn && s.variant) {
    const vf = path.join(REPO, 'Sketcher', 'variants', s.variant + '.json');
    if (fs.existsSync(vf)) kit = FK.withVariant(kit, JSON.parse(fs.readFileSync(vf, 'utf8')));
  }
  const t = T.build(kit, rules, s, inp.plan, { endReserveMm: opt.reserve, looseEndMm: opt.loose });
  const md = T.markdown(t);
  if (opt.stdout) { process.stdout.write(opt.md ? md : JSON.stringify(t, null, 1) + '\n'); return; }
  const dir = opt.out || path.dirname(path.resolve(file));
  fs.mkdirSync(dir, { recursive: true });
  const stem = T.stemOf(s);
  const jf = path.join(dir, stem + '.takeoff.json'), mf = path.join(dir, stem + '.takeoff.md');
  fs.writeFileSync(jf, JSON.stringify(t, null, 1) + '\n');
  fs.writeFileSync(mf, md);
  const c = t.counts;
  console.log('takeoff: ' + c.items + ' items (' + c.est + ' guessed), ' + c.decisions + ' open decisions, ' + c.tisztazando + ' to clarify; plan ' + (inp.plan ? 'solved' : 'raw'));
  console.log('wrote ' + jf);
  console.log('wrote ' + mf);
}

if (require.main === module) main(process.argv);
module.exports = { main };
