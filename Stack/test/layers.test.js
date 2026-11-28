// VRG Stack — the layer table (schema/layers.js, STK-P213). Run:  node --test test/layers.test.js
// One table says which layers exist, their order, names and colours. These tests hold every module that used to
// keep its own copy to it, hold lib/meta.js to its order and names, and fail on a page that keeps a colour table of
// its own again: the Konnektóm broke once because one copy of seven was missed.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const T = require('../schema/layers');

test('layers: the table is well formed', () => {
  const codes = T.LIST.map(l => l.code);
  assert.equal(new Set(codes).size, codes.length, 'a code twice');
  for (const l of T.LIST) {
    assert.match(l.code, /^[A-Z]$/, l.code);
    assert.match(l.col, /^#[0-9a-f]{6}$/, l.code + ' colour');
    assert.ok(l.hu && l.en, l.code + ' names');
  }
  assert.equal(new Set(T.LIST.map(l => l.col)).size, codes.length, 'two layers share a colour');
  assert.deepEqual([...T.ORDER], codes);
  assert.deepEqual(codes.filter(c => !T.MASK.includes(c)), ['E'], 'only the pillars are not a mask slot');
  assert.deepEqual(codes.filter(c => !T.PLANES.includes(c)), ['Z'], 'only the codec is not a Viewer plane');
  for (const c of ['S', 'U', 'J', 'Z', 'E']) assert.ok(!T.ADAPTERS.includes(c), c + ' is not read by an adapter');
  assert.ok(T.PLANES.length <= 24, 'the Viewer has colour slots for 24 planes (viewer.html uCol)');
});

test('layers: every former copy reads the table', () => {
  assert.equal(require('../lib/strings').ORDER, T.MASK.join(''), 'lib/strings.js');
  assert.deepEqual([...require('../lib/layertext').ORDER], [...T.PLANES], 'lib/layertext.js');
  assert.deepEqual([...require('../lib/lens').PLANES], T.PLANES.filter(c => c !== 'E'), 'lib/lens.js');
  const { LAYER } = require('../schema/shapes');
  for (const c of T.ORDER) assert.ok(LAYER.test(c), 'schema/shapes.js accepts ' + c);
  for (const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') if (!T.ORDER.includes(c)) assert.ok(!LAYER.test(c), 'schema/shapes.js refuses ' + c);
  const src = fs.readFileSync(path.join(ROOT, 'lib', 'pipeline.js'), 'utf8');
  assert.match(src, /const LAYER8 = require\('\.\.\/schema\/layers'\)\.ADAPTERS/, 'lib/pipeline.js LAYER8');
});

test('layers: lib/meta.js describes the same layers, in the same order, with the same names', () => {
  const meta = require('../lib/meta');
  assert.deepEqual(meta.map(m => m.code), [...T.MASK], 'meta.js order (E, the pillars, has no meta row)');
  for (const m of meta) assert.equal(m.hu, T.BY[m.code].hu, m.code + ' Hungarian name');
});

// a file that holds most of the table's colours is a copy of the table
const EXCEPT = {
  // its own dark and light palettes for the ten original layers; every other layer is drawn in the pillar colour
  'runs.html': 'a theme palette, not the layer table',
};
test('layers: no page or module keeps a colour table of its own', () => {
  const cols = T.LIST.map(l => l.col.toLowerCase());
  const files = [
    ...fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).map(f => [f, path.join(ROOT, f)]),
    ...fs.readdirSync(path.join(ROOT, 'lib')).filter(f => /\.(js|css)$/.test(f)).map(f => ['lib/' + f, path.join(ROOT, 'lib', f)]),
  ];
  const copies = [];
  for (const [name, file] of files) {
    if (EXCEPT[name]) continue;
    const text = fs.readFileSync(file, 'utf8').toLowerCase();
    const n = cols.filter(c => text.includes(c)).length;
    if (n >= 5) copies.push(`${name} (${n} layer colours)`);
  }
  assert.deepEqual(copies, [], 'read schema/layers.js (window.StackLayers) instead');
});

test('layers: a page that uses window.StackLayers loads schema/layers.js before it', () => {
  for (const f of fs.readdirSync(ROOT).filter(f => f.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const use = html.indexOf('StackLayers.');
    if (use < 0) continue;
    const tag = html.indexOf('<script src="schema/layers.js"></script>');
    assert.ok(tag >= 0 && tag < use, f + ': load schema/layers.js before the script that reads it');
  }
});
