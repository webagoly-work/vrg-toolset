// WP-60: the Asztal's top strip fits a narrow window. desk.js fitTop: first the labels go (data-fit="1"; every word a narrow
// strip may drop sits in a .lbl, so the icon, the LED and the number stay), then the least needed widgets go into ⋯, whose
// menu shows them in full. The phone, the Lap tabs, the level switch and ⚙ always stay. Checked in Chromium at 1400 … 520 px
// in Mélyvíz and Fényjel (scratch harness); this file pins the pieces that make it work.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const PAGE = path.join(__dirname, '..', 'page');
const desk = fs.readFileSync(path.join(PAGE, 'desk.js'), 'utf8');
const css = fs.readFileSync(path.join(PAGE, 'desk.css'), 'utf8');

test('drawTop ends by fitting the strip, and a resize or the fonts arriving fits it again', () => {
  assert.match(desk, /'⚙', h\('span', \{ class: 'lbl' \}, ' Testreszabás'\)\)\);\n    fitTop\(\);/);
  assert.match(desk, /new ResizeObserver\(\(\) => requestAnimationFrame\(fitTop\)\)\.observe\(top\)/);
  assert.match(desk, /document\.fonts\.ready\.then\(\(\) => \{ fitTop\(\);/);
});

test('every label a narrow strip may drop is a .lbl; the icon, LED and number stay outside it', () => {
  for (const [w, kept] of [['w:search', "'⌕'"], ['w:servers', "up + '/' + sv.length"], ['w:backup', "b.age + ' n'"]]) {
    const line = desk.split('\n').find(l => l.includes("case '" + w + "'"));
    assert.ok(line, w);
    assert.ok(line.includes("class: 'lbl'"), w + ' has a .lbl');
    assert.ok(line.includes(kept), w + ' keeps ' + kept);
  }
  assert.match(desk, /h\('span', \{ class: 'lbl' \}, LV_HU\[lv\]\), h\('span', \{ class: 'sh' \}, LV_SHORT\[lv\]\)/, 'the level switch has short names');
  assert.match(fs.readFileSync(path.join(PAGE, 'phone.js'), 'utf8'), /phoneIcon\(\), h\('span', \{ class: 'lbl' \}, 'Telefon'\)/);
});

test('the overflow order: the ring first, the clock last; the level switch never goes', () => {
  const keep = JSON.parse(desk.match(/const TOP_KEEP = (\{[^}]+\})/)[1].replace(/'/g, '"'));
  assert.ok(keep['w:ring'] < keep['w:backup'] && keep['w:backup'] < keep['w:git'] && keep['w:git'] < keep['w:servers'] && keep['w:servers'] < keep['w:search']);
  assert.equal(Math.max(...Object.values(keep)), keep['w:clock']);
  assert.match(desk, /filter\(e => e\.dataset\.w !== 'w:level'\)/);
});

test('the css: hidden widgets really hide, fit 1 drops .lbl and shows the short level names, the menu floats', () => {
  assert.match(css, /\[data-role="topstrip"\] > \[hidden\] \{ display: none !important; \}/);
  assert.match(css, /\[data-role="topstrip"\]\[data-fit="1"\] \.lbl \{ display: none; \}/);
  assert.match(css, /\[data-role="level"\] \.sh \{ display: none; \}/);
  assert.match(css, /\[data-role="topstrip"\]\[data-fit="1"\] \[data-role="level"\] \.sh \{ display: inline; \}/);
  assert.match(css, /\[data-role="top-menu"\] \{ position: fixed;/);
});
