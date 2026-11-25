#!/usr/bin/env node
/* VRG UI Kit — test/radar.js — the radar's layout (components/radar.js) against test/fixtures/radar-layout.json, the
   placements VRG Mobile's kit-core Radar.kt must reproduce too (RadarTest reads the same file). Plain node, no DOM.
     node test/radar.js            check
     node test/radar.js --write    rewrite the fixture's expected placements (only when the layout rule changes on purpose,
                                   and then Radar.kt must change the same way: RadarTest fails until it does) */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ctx = { TextEncoder, Math, console };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'components', 'radar.js'), 'utf8'), ctx);
const R = ctx.VK.radar;
const FIX = path.join(__dirname, 'fixtures', 'radar-layout.json');

const here = { lat: 47.4979, lon: 19.0402 };
const cases = [
  { name: 'mixed layers, heading-up, GPS, sweep, no direction', sweeps: { 'pager:3': 200 }, hidden: [],
    frame: { headingDeg: 30, here, mode: 'heading-up', layers: [], blips: [
      { id: 'tag:mine', layer: 'tag', label: 'ISYTag', distanceM: 4.2, mine: true, trend: 1 },
      { id: 'tag:AA', layer: 'tags', label: 'AirTag', distanceM: 12 },
      { id: 'tag:BB', layer: 'tags', label: 'iTag', distanceM: 12.5 },
      { id: 'tag:CC', layer: 'tags', label: 'Find My', distanceM: 11.8 },
      { id: 'watch:q71', layer: 'watch', label: 'Q71', distanceM: null, linked: true },
      { id: 'pager:3', layer: 'pager', label: 'Béla', distanceM: 25 },
      { id: 'pager:4', layer: 'pager', label: 'Ödön', distanceM: 2, bearingDeg: 90 },
      { id: 'site:k1', layer: 'sites', label: 'Kötőelem raktár', place: { lat: 47.5000, lon: 19.0450 } },
      { id: 'tag:last', layer: 'tag', label: 'utoljára', distanceM: 40, place: { lat: 47.4975, lon: 19.0390 } },
    ] } },
  { name: 'north-up ignores the heading; hidden layer gone; fixed range', sweeps: {}, hidden: ['tags'],
    frame: { headingDeg: 123, here: null, mode: 'north-up', rangeM: 30, layers: [], blips: [
      { id: 'a', layer: 'x', label: 'A', distanceM: 0.2, bearingDeg: -45 },
      { id: 'b', layer: 'tags', label: 'B', distanceM: 5 },
      { id: 'c', layer: 'x', label: 'C', distanceM: 500, bearingDeg: 720 + 10 },
      { id: 'd', layer: 'x', label: 'D', distanceM: 3, ageMs: 30000 },
      { id: 'e', layer: 'x', label: 'E', distanceM: 3, ageMs: 90000 },
      { id: 'f', layer: 'x', label: 'F', distanceM: 3 },
      { id: 'Ű-ő', layer: 'x', label: 'Ű', distanceM: 3 },
    ] } },
  { name: 'crowded ring: twelve blips without direction at the same distance', sweeps: {}, hidden: [],
    frame: { mode: 'heading-up', headingDeg: null, layers: [], blips: Array.from({ length: 12 }, (_, i) => (
      { id: 'n' + i, layer: 'pager', label: 'U' + i, distanceM: 6 })) } },
  { name: 'empty frame', sweeps: {}, hidden: [], frame: { layers: [], blips: [] } },
];

function round(v) { return v == null ? null : Math.round(v * 1e6) / 1e6; }
function expectOf(c) {
  const lay = R.layout(c.frame, { hidden: c.hidden, sweeps: c.sweeps });
  return {
    rangeM: lay.rangeM, rotationDeg: round(lay.rotationDeg),
    rings: lay.rings.map(r => [r[0], round(r[1])]),
    placed: lay.placed.map(p => ({ id: p.blip.id, x: round(p.x), y: round(p.y), r: round(p.r), angleDeg: round(p.angleDeg),
      bearingDeg: round(p.bearingDeg), bearingSrc: p.bearingSrc, distanceM: round(p.distanceM), alpha: round(p.alpha) })),
  };
}

if (process.argv.includes('--write')) {
  fs.mkdirSync(path.dirname(FIX), { recursive: true });
  const out = { about: 'Radar layout fixture (WP M67): written by shared/vrg-ui-kit/test/radar.js --write from components/radar.js; ' +
    'kit-core RadarTest must reproduce every placement within 1e-5.', cases: cases.map(c => Object.assign({}, c, { expect: expectOf(c) })) };
  fs.writeFileSync(FIX, JSON.stringify(out, null, 1) + '\n');
  console.log('wrote ' + path.relative(process.cwd(), FIX));
}

let failed = 0, passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failed++; console.log('  FAIL ' + name + '\n       ' + String(e.message).split('\n').slice(0, 4).join('\n       ')); }
}
const near = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-5, m + ': ' + a + ' vs ' + b);

const fixture = JSON.parse(fs.readFileSync(FIX, 'utf8'));
for (const c of fixture.cases) {
  t('fixture: ' + c.name, () => {
    const got = expectOf(c);
    assert.strictEqual(got.rangeM, c.expect.rangeM);
    assert.strictEqual(got.placed.length, c.expect.placed.length);
    got.placed.forEach((p, i) => {
      const e = c.expect.placed[i];
      assert.strictEqual(p.id, e.id, 'order');
      assert.strictEqual(p.bearingSrc, e.bearingSrc, p.id);
      ['x', 'y', 'r', 'angleDeg', 'alpha'].forEach(k => near(p[k], e[k], p.id + '.' + k));
    });
  });
}

t('rules: log scale, ranges, rings, ages', () => {
  assert.strictEqual(R.radius(null, 10), R.constants.UNKNOWN_R);
  assert.strictEqual(R.radius(1e6, 10), R.constants.MAX_R);
  assert.ok(R.radius(1, 10) < R.radius(3, 10) && R.radius(3, 10) < R.radius(10, 10));
  assert.strictEqual(R.autoRange([]), 10);
  assert.strictEqual(R.autoRange([4]), 5);
  assert.strictEqual(R.autoRange([9]), 30);
  assert.strictEqual(R.autoRange([5000]), 300);
  assert.strictEqual(JSON.stringify(R.rings(30).map(r => r[0])), '[1,3,10,30]');
  assert.strictEqual(R.alpha(0), 1); assert.strictEqual(R.alpha(120000), 0.35);
  assert.strictEqual(R.fnv1a(''), 0x811c9dc5);
  assert.strictEqual(R.fnv1a('a'), 0xe40c292c);
});

t('no-direction blips keep apart', () => {
  const lay = R.layout(fixture.cases[2].frame);
  for (let i = 0; i < lay.placed.length; i++) for (let j = i + 1; j < lay.placed.length; j++) {
    const a = lay.placed[i], b = lay.placed[j];
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= R.constants.MIN_SEP - 1e-9, a.blip.id + '/' + b.blip.id);
  }
});

t('geo and text', () => {
  near(R.geo.bearing({ lat: 0, lon: 0 }, { lat: 1, lon: 0 }), 0, 'north');
  near(R.geo.bearing({ lat: 0, lon: 0 }, { lat: 0, lon: 1 }), 90, 'east');
  assert.ok(Math.abs(R.geo.distance({ lat: 0, lon: 0 }, { lat: 1, lon: 0 }) - 111195) < 5);
  assert.strictEqual(R.text.distance(null), 'távolság ismeretlen');
  assert.strictEqual(R.text.distance(23), '~20 m');
  assert.strictEqual(R.text.distance(1234), '1,2 km');
  assert.strictEqual(R.text.relative(90), 'jobbra');
  assert.strictEqual(R.text.compass(225), 'DNy');
});

console.log(`radar: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
