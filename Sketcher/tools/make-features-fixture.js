#!/usr/bin/env node
// Sketcher/tools/make-features-fixture.js — writes Sketcher/test/fixtures/features.json: switch states (the stored
// "flipped" sets) and what the JS registry (Sketcher/lib/features.js) makes of each: which features are on, which are
// greyed by a prerequisite, the fronts left on the front bar, the Mind switches, the stores they split into, and a
// variant's rail passed through them. FeaturesTest (sketch-core, JVM) replays every case through Features.kt.
//
//   node Sketcher/tools/make-features-fixture.js          (write)
//   node Sketcher/tools/make-features-fixture.js --check  (exit 1 when the committed fixture is stale; Sketcher/test/run.js runs it)
'use strict';
const fs = require('fs'), path = require('path');
const F = require('../lib/features.js');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'test', 'fixtures', 'features.json');
const RAIL = ['photo', 'select', 'memo', 'tag', 'room', 'template', 'line', 'measure', 'point', 'circuit', 'board', 'route'];

const STATES = [
  ['alap', []],
  ['kamera elmosás ki', ['kamera.blur']],
  ['kamera rögzítés ki', ['kamera.capture']],
  ['pont ki (áramkör vele)', ['vazlat.point', 'vazlat.photo']],
  ['dedikált be', ['munkakor.implied']],
  ['munkakör lap ki, dedikált be', ['munkakor.takeoff', 'munkakor.implied']],
  ['kérdések egész front ki', F.all([], false, 'kerdes')],
  ['minden ki', F.all([], false)],
  ['ismeretlen id marad', ['jovobeli.valami', 'kamera.jovo']],
  ['nyitott és helyszín ki', F.all(F.all([], false, 'nyitott'), false, 'helyszin')],
];

function snap(flipped) {
  const fronts = F.FRONTS.map(f => f.id);
  return {
    flipped,
    on: F.ALL.filter(f => F.on(flipped, f.id)).map(f => f.id),
    blocked: Object.fromEntries(F.ALL.map(f => [f.id, F.blockedBy(flipped, f.id)]).filter(([, b]) => b).map(([id, b]) => [id, b.id])),
    visible: F.visibleFronts(flipped),
    allOn: Object.fromEntries([['*', F.allOn(flipped)]].concat(fronts.map(id => [id, F.allOn(flipped, id)]))),
    mindBe: F.all(flipped, true), mindKi: F.all(flipped, false),
    frontBe: Object.fromEntries(fronts.map(id => [id, F.all(flipped, true, id)])),
    stores: F.toStores(flipped), cameraOff: F.cameraOff(flipped),
    rail: F.rail(RAIL, flipped), draw: F.draw({ snapAngle: 90 }, flipped) !== null,
    toggled: Object.fromEntries(['vazlat.select', 'vazlat.point', 'munkakor.implied', 'kamera.ocr', 'jovobeli.valami'].map(id => [id, F.toggle(flipped, id)])),
  };
}

const out = { kind: 'vrg-sketcher-features-fixture', v: 1, cameraIds: F.CAMERA_IDS, rail: RAIL,
  cases: STATES.map(([name, flipped]) => Object.assign({ name }, snap(F.read(F.write(flipped))))) };
const text = JSON.stringify(out, null, 1) + '\n';
if (process.argv.includes('--check')) {
  const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null;
  if (cur !== text) { console.error('test/fixtures/features.json is stale: run node Sketcher/tools/make-features-fixture.js'); process.exit(1); }
  console.log('test/fixtures/features.json is current (' + out.cases.length + ' cases)');
} else { fs.writeFileSync(OUT, text); console.log('wrote test/fixtures/features.json (' + out.cases.length + ' cases)'); }
