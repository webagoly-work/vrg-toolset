// WP-59 (Fényjel R5, shared/fenyjel/DESIGN.md): the VRG Asztal's shell chrome in the Fényjel look. page/fenyjel-chrome.js
// (glyphs for the dock and the window heads) against the real pane kinds and glyph set, fenyjel-chrome.css staying inside
// its look, and the hooks it needs (sheets.js data-cat, VRGDesk.items, the frame page loading it).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const DASH = path.join(__dirname, '..');
const REPO = path.join(DASH, '..');
const chrome = require(path.join(DASH, 'page', 'fenyjel-chrome.js'));
const home = require(path.join(DASH, 'page', 'fenyjel-home.js'));
const icons = require(path.join(REPO, 'shared', 'fenyjel', 'icons.js'));
const layout = require(path.join(DASH, 'shell', 'lib', 'sheets.js'));

test('every pane kind a window can be has a real glyph and a family', () => {
  for (const k of layout.KINDS) {
    const g = chrome.KIND_GLYPH[k];
    assert.ok(g, 'no glyph for pane kind ' + k);
    assert.ok(icons.ICONS[g[0]], k + ': ' + g[0] + ' is not in icons.js');
    assert.ok(Object.keys(icons.FAMILIES).includes(g[1]), k + ': family ' + g[1]);
  }
  assert.deepEqual(Object.keys(chrome.KIND_GLYPH).sort(), layout.KINDS.slice().sort(), 'KIND_GLYPH names exactly the pane kinds');
});

test('iconFor: a catalog item wins over its pane kind; an unknown item falls back to the kind; nothing known is null', () => {
  assert.deepEqual(chrome.iconFor({ id: 'inventory', kind: 'app' }, home.glyphOf), { glyph: 'inventory', family: 'stock' });
  assert.deepEqual(chrome.iconFor({ id: 'nincs-ilyen', kind: 'term' }, home.glyphOf), { glyph: 'terminal', family: 'run' });
  assert.deepEqual(chrome.iconFor({ kind: 'chat' }, home.glyphOf), { glyph: 'claude', family: 'link' });
  assert.equal(chrome.iconFor({ kind: 'valami' }, home.glyphOf), null);
  assert.deepEqual(chrome.iconFor({ id: 'planner' }, null), null, 'no glyph lookup and no kind: nothing');
});

test('fenyjel-chrome.css styles nothing outside html[data-look="fenyjel"]', () => {
  const css = fs.readFileSync(path.join(DASH, 'page', 'fenyjel-chrome.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = css.split('}').map(r => r.split('{')[0].trim()).filter(Boolean);
  assert.ok(rules.length > 40);
  for (const sel of rules) for (const one of sel.split(/,(?![^(]*\))/)) {
    const s = one.trim();
    if (!s || /^--|^[a-z-]+:/.test(s)) continue;                 // a declaration list after a nested brace never happens here
    assert.ok(s.startsWith('html[data-look="fenyjel"]'), 'unscoped selector: ' + s);
  }
});

test('the hooks: windows carry their catalog id, VRGDesk lists its items, the page loads the chrome after the home', () => {
  const sheets = fs.readFileSync(path.join(DASH, 'page', 'sheets.js'), 'utf8');
  assert.match(sheets, /'data-cat': cat/);
  const desk = fs.readFileSync(path.join(DASH, 'page', 'desk.js'), 'utf8');
  assert.match(desk, /items: \(\) => S\.items/);
  const page = fs.readFileSync(path.join(DASH, 'page', 'vrg-desktop.html'), 'utf8');
  assert.ok(page.includes('href="fenyjel-chrome.css"'));
  const at = f => page.indexOf('src="' + f + '"');
  assert.ok(at('fenyjel-home.js') > 0 && at('fenyjel-home.js') < at('fenyjel-chrome.js') && at('fenyjel-chrome.js') < at('desk.js'), 'icons, home, chrome, then desk.js');
  assert.ok(page.indexOf('href="fenyjel-chrome.css"') > page.indexOf('href="grafit.css"'), 'the chrome sheet comes after grafit.css');
});
