// WP-61: the Asztal's dock fits between the corner dials. desk.js fitDock: first data-fit="1" tightens it (an open window
// shows its glyph or monogram), then buttons go into ⋯ (the Dev pins, then the windows you are not in, then the pins; the
// window in front, the Lap tabs and ▣ stay), with no divider left at an end or next to another. The ⋯ menu is the strip's
// (WP-60) opening upwards. Checked in Chromium at 1400 … 520 px in Mélyvíz, Grafit and Fényjel (scratch harness).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const PAGE = path.join(__dirname, '..', 'page');
const desk = fs.readFileSync(path.join(PAGE, 'desk.js'), 'utf8');
const css = fs.readFileSync(path.join(PAGE, 'desk.css'), 'utf8');

test('drawDock fits the dock after the Fényjel chrome has run; a resize and the fonts fit it again', () => {
  assert.match(desk, /requestAnimationFrame\(fitDock\);/);
  assert.match(desk, /new ResizeObserver\(\(\) => requestAnimationFrame\(fitDock\)\)\.observe\(dockEl\)/);
  assert.match(desk, /document\.fonts\.ready\.then\(\(\) => \{ fitTop\(\); fitDock\(\); \}\)/);
});

test('an open window carries a monogram for the tight dock, and the overflow order keeps the window in front', () => {
  assert.match(desk, /h\('span', \{ class: 'sh' \}, monogram\(r\.label\)\), h\('span', \{ class: 'lbl' \}, r\.label\)/);
  assert.match(desk, /const rank = e => \(e\.dataset\.level === 'dev' \? 1 : e\.classList\.contains\('win'\) \? \(e\.dataset\.focus === '1' \? 9 : 2\) : 3\);/);
  assert.match(desk, /\.filter\(x => x\.k < 9\)/, 'the window in front never goes');
});

test('the monogram: two words give their initials, one word its first two letters', () => {
  const src = desk.match(/const monogram = (s => \{[^\n]+\});/)[1];
  const monogram = eval(src);                                                    // the page's own one-liner
  assert.equal(monogram('Varler Planner'), 'VP');
  assert.equal(monogram('Terminál'), 'TE');
  assert.equal(monogram(''), '?');
});

test('one menu for both bars; the dock\'s opens upwards; the css hides, tightens and keeps the monogram out of the strip', () => {
  assert.ok(!/topMenu/.test(desk), 'the strip uses the shared overMenu');
  assert.match(desk, /overMenu\(more, gone, true\)/);
  assert.match(desk, /if \(up\) box\.style\.bottom = /);
  assert.match(css, /\[data-role="dock"\] > \[hidden\] \{ display: none !important; \}/);
  assert.match(css, /\[data-role="dock"\]\[data-fit="1"\] button\.win > \.lbl \{ display: none; \}/);
  assert.match(css, /\[data-role="dock"\] button\.win > \.sh, \[data-role="top-menu"\] \.sh \{ display: none; \}/);
});
