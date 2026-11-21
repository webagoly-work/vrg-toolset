#!/usr/bin/env node
// Sketcher/test/features.test.js — the feature registry (WP M51): prerequisites, Mind be / ki, the stores, the variant rule.
'use strict';
const assert = require('assert');
const F = require('../lib/features.js');
let n = 0; const t = (name, fn) => { fn(); n++; };

t('ids unique, prerequisites and fronts exist', () => {
  assert.strictEqual(new Set(F.ALL.map(f => f.id)).size, F.ALL.length);
  F.ALL.forEach(f => { assert.ok(F.FRONTS.some(x => x.id === f.front), f.id); (f.requires || []).forEach(r => assert.ok(F.of(r), f.id + ' → ' + r)); });
  F.CAMERA_IDS.forEach(id => assert.ok(F.of('kamera.' + id), id));
  const kit = require('../catalog/fieldkit.json');
  assert.deepStrictEqual(F.FRONTS.filter(f => f.bar).map(f => f.id), kit.fronts.map(f => f.id));
});
t('everything on by default but the options; an unknown id arrives on', () => {
  assert.deepStrictEqual(F.ALL.filter(f => !F.on([], f.id)).map(f => f.id), ['munkakor.implied']);
  assert.ok(F.on(['x'], 'uj.funkcio'));
});
t('a prerequisite off greys its dependents, which come back with it', () => {
  let s = F.set([], 'vazlat.point', false);
  assert.ok(!F.on(s, 'vazlat.circuit')); assert.strictEqual(F.blockedBy(s, 'vazlat.circuit').id, 'vazlat.point');
  s = F.set(s, 'vazlat.point', true); assert.ok(F.on(s, 'vazlat.circuit'));
});
t('Mind ki leaves only Vázlat on the front bar; Mind be keeps the options', () => {
  assert.deepStrictEqual(F.visibleFronts(F.all([], false)), ['vazlat']);
  assert.ok(!F.on(F.all([], true), 'munkakor.implied'));
  assert.ok(F.on(F.all(['munkakor.implied'], true), 'munkakor.implied'));
  assert.deepStrictEqual(F.visibleFronts(F.all([], false, 'kerdes')), ['vazlat', 'jegyzet', 'munkakor', 'kamera', 'helyszin', 'nyitott']);
});
t('the Desktop store: D-79 key and the general list round trip', () => {
  const s = ['munkakor.implied', 'jegyzet.chips', 'kamera.ocr'];
  assert.deepStrictEqual(F.fromStores(F.toStores(s)), F.read(F.write(s)));
  assert.deepStrictEqual(F.fromStores({ cameraOff: [], implied: true, general: [] }), ['munkakor.implied']);
});
t('a variant cannot switch back on what the user switched off', () => {
  const off = ['vazlat.photo', 'vazlat.drawtune'];
  assert.deepStrictEqual(F.rail(['photo', 'select', 'room'], off), ['select', 'room']);
  assert.strictEqual(F.draw({ snapAngle: 90 }, off), null);
  assert.deepStrictEqual(F.draw({ snapAngle: 90 }, []), { snapAngle: 90 });
});
console.log('ALL PASS (' + n + ')');
