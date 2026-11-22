#!/usr/bin/env node
// Sketcher/tools/make-report-fixture.js — writes Sketcher/test/fixtures/report.json: the Desktop page's own SVG of the
// drawing (svgPlan) and of the site (sitePlaceSvg + the site-math lines) for the shared field package, so the phone's
// PlanSvg.kt / SiteSvg.kt (sketch-core, WP M54, F9) can be checked against them on the JVM (ReportSvgTest).
//
// The two functions are taken out of Sketcher/src/app.js as they are (not copied by hand): when the Desktop changes
// its drawing, this fixture goes stale (--check), and after it is rewritten the JVM test says what the phone must follow.
//
//   node Sketcher/tools/make-report-fixture.js          (write)
//   node Sketcher/tools/make-report-fixture.js --check  (exit 1 when the committed fixture is stale; Sketcher/test/run.js runs it)
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(ROOT, 'Sketcher', 'test', 'fixtures', 'report.json');
const PKG = 'Planner/projects/varler-planner/tests/sketch-field.json';
const SM = require(path.join(ROOT, 'Map', 'lib', 'site-math.js'));
const APP = fs.readFileSync(path.join(ROOT, 'Sketcher', 'src', 'app.js'), 'utf8');

// a top-level piece of the page's closure: `  function name(` … `  }`, or a one-line `  const name = …`
function piece(name) {
  const lines = APP.split('\n');
  let i = lines.findIndex(l => l.startsWith('  function ' + name + '('));
  if (i >= 0) { const j = lines.findIndex((l, k) => k > i && l === '  }'); if (j < 0) throw new Error('no end of ' + name); return lines.slice(i, j + 1).join('\n'); }
  i = lines.findIndex(l => l.startsWith('  const ' + name + ' ='));
  if (i < 0) throw new Error('app.js has no ' + name);
  return lines[i];
}
const CODE = ['TYPES', 'esc', 'f1', 'bbox', 'model', 'svgPlan', 'sitePlaceSvg'].map(piece).join('\n') +
  '\n;({ svgPlan, sitePlaceSvg })';

function desktop(pkg) {
  const ctx = { SM, pkg, S: pkg.sketch, floors: () => pkg && pkg.plan && pkg.plan.data && pkg.plan.data.floors || [] };
  return vm.runInNewContext(CODE, ctx);
}
const clone = o => JSON.parse(JSON.stringify(o));

function build() {
  const base = JSON.parse(fs.readFileSync(path.join(ROOT, PKG), 'utf8'));
  const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'Sketcher', 'test', 'fixtures', 'site.json'), 'utf8')).cases;
  const cases = [];
  // the drawing: the solved plan in millimetres (the package's floors), and the sketch alone (no plan in the package)
  { const d = desktop(base); cases.push({ about: 'the field package: the solved plan in mm', plan: true, svg: d.svgPlan() }); }
  { const p = clone(base); delete p.plan; const d = desktop(p); cases.push({ about: 'the same survey without a solved plan: drawing units', plan: false, svg: d.svgPlan() }); }
  // the site: the package's floors on synthetic buildings (site.json's outlines), placed by the auto fit or not at all
  const rooms = SM.roomsFromMm(base.plan.data.floors);
  [[0, true], [2, true], [3, true], [0, false]].forEach(([k, placed]) => {
    const outline = site[k].outline, place = placed ? SM.autoFit(rooms, outline) : null;
    const rep = place ? SM.report(rooms, outline, place) : null;
    const d = desktop(base);
    cases.push({ about: 'site: ' + site[k].about + (placed ? ', auto-placed' : ', not placed'), outline, place, svg: d.sitePlaceSvg(outline, rooms, place, rep), lines: rep ? SM.reportLines(rep) : [] });
  });
  return JSON.stringify({ about: 'Written by Sketcher/tools/make-report-fixture.js from Sketcher/src/app.js (svgPlan, sitePlaceSvg) and ' + PKG + '; replayed by ReportSvgTest. Do not edit.',
    package: PKG, cases }, null, 1) + '\n';
}

const text = build();
if (process.argv.includes('--check')) {
  const old = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (old !== text) { console.error('report.json is stale: node Sketcher/tools/make-report-fixture.js'); process.exit(1); }
  console.log('report.json up to date (' + JSON.parse(text).cases.length + ' cases)');
} else { fs.writeFileSync(OUT, text); console.log('wrote ' + path.relative(process.cwd(), OUT)); }
