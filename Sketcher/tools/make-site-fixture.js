#!/usr/bin/env node
// Sketcher/tools/make-site-fixture.js — writes Sketcher/test/fixtures/site.json: buildings, solved plans and
// placements, with what Map/lib/site-math.js says about each (the footprint, the first placement, the mismatch report
// and its lines, the placed corners). SitePlaceTest (sketch-core, JVM) replays every case through SitePlace.kt and
// must get the same, so the phone, the map page and the Desktop never disagree on where the sketch sits.
//
//   node Sketcher/tools/make-site-fixture.js          (write)
//   node Sketcher/tools/make-site-fixture.js --check  (exit 1 when the committed fixture is stale; Sketcher/test/run.js runs it)
'use strict';
const fs = require('fs'), path = require('path');
const M = require('../../Map/lib/site-math.js');
const OUT = path.join(__dirname, '..', 'test', 'fixtures', 'site.json');

// synthetic places only (no client's building): a point in a Budapest park, outlines built around it
const LAT0 = 47.5150, LON0 = 19.0800;
const r7 = v => Math.round(v * 1e7) / 1e7;
const ll = pts => pts.map(p => { const q = M.toLatLon(LAT0, LON0, p[0], p[1]); return [r7(q[0]), r7(q[1])]; });
const turned = (pts, deg, cx, cy) => pts.map(p => { const q = M.turn(p, deg); return [q[0] + (cx || 0), q[1] + (cy || 0)]; });
const rect = (w, d) => [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]];
const lshape = [[-6, -5], [6, -5], [6, 1], [0, 1], [0, 5], [-6, 5]];

const house2 = [{ name: 'Nappali', poly: [[0, 0], [7, 0], [7, 7.8], [0, 7.8]] }, { name: 'Konyha', poly: [[7, 0], [11.8, 0], [11.8, 7.8], [7, 7.8]] }];
const lplan = [{ name: 'Szoba', poly: [[0, 0], [12, 0], [12, 6], [0, 6]] }, { name: 'Fürdő', poly: [[0, 6], [6, 6], [6, 10], [0, 10]] }];
const flat = [{ name: 'Szoba', poly: [[0, 0], [4, 0], [4, 3], [0, 3]] }];
const big = [{ name: 'Nappali', poly: [[0, 0], [14, 0], [14, 7.8], [0, 7.8]] }];
const tilted = [{ name: 'Előszoba', poly: [[0, 0], [8, 0], [8, 12], [0, 12]] }];

const CASES = [
  ['a house drawn north-up, the building at 17°', ll(turned(rect(12, 8), 17)), house2, null],
  ['the same, the user turned it 10° more', ll(turned(rect(12, 8), 17)), house2, p => ({ lat: p.lat, lon: p.lon, rot: p.rot + 10 })],
  ['an L-shaped building and an L-shaped plan', ll(turned(lshape, -32, 3, -2)), lplan, null],
  ['a flat in a bigger building, moved north', ll(turned(rect(30, 14), 5)), flat, p => ({ lat: p.lat + 0.00003, lon: p.lon, rot: p.rot })],
  ['a plan bigger than its building', ll(turned(rect(12, 8), 0)), big, null],
  ['a plan drawn long side north, the building long side east-west', ll(turned(rect(12, 8), 80)), tilted, null],
  ['no plan yet', ll(rect(12, 8)), [], null],
];

function build() {
  const cases = CASES.map(([about, outline, rooms, tweak]) => {
    const fit = M.autoFit(rooms, outline);
    const place = fit && tweak ? Object.assign({}, tweak(fit), { auto: false }) : fit;
    const rep = place ? M.report(rooms, outline, place) : null;
    const corners = place ? M.placedLngLat(rooms, place).map(r => r.ring.map(p => [r7(p[0]), r7(p[1])])) : [];
    return { about, outline, rooms, footprint: M.footprint(outline), fit, place, report: rep, lines: M.reportLines(rep), corners };
  });
  return JSON.stringify({ about: 'Written by Sketcher/tools/make-site-fixture.js from Map/lib/site-math.js; replayed by SitePlaceTest. Do not edit.', cases }, null, 1) + '\n';
}

const text = build();
if (process.argv.includes('--check')) {
  const old = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (old !== text) { console.error('site.json is stale: node Sketcher/tools/make-site-fixture.js'); process.exit(1); }
  console.log('site.json up to date (' + JSON.parse(text).cases.length + ' cases)');
} else { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, text); console.log('wrote ' + path.relative(process.cwd(), OUT)); }
