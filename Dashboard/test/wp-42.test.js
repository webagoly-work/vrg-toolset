// WP-42 (Desktop unify U6): the Desktop view — the ◣ Sarokvezérlő tree, the ◢ Rétegverem dial, the dock and the top strip
// (lib/desk.js), and the page files exist with their hooks. The dial's DOM behaviour is checked in the real window by
// shell/selftest/wp-41.js (open, key 1, search, mirrored column, item 48 × 248, ink colour).
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path'), fs = require('fs');
const build = require('../build.js');
const { KINDS } = require('../shell/lib/layout.js');
const { createCatalog } = require('../shell/lib/catalog.js');
const D = require('../shell/lib/desk.js');

const C = build.collect();
const cat = createCatalog({ file: path.resolve(__dirname, '..', '..', 'launcher', 'vrg-catalog.json'), collect: () => C, kinds: KINDS });
cat.load();
const PAGE = path.resolve(__dirname, '..', 'page');

test('◣ tree: User = Munka · Alkalmazások · Fájlok · Rendszer; Dev adds Fejlesztés with the six dev roots', () => {
  const u = D.suiTree(cat.listFor('user'), 'user', cat.groups());
  assert.deepEqual(u.children.map(c => c.label), ['Munka', 'Alkalmazások', 'Fájlok', 'Rendszer']);
  const d = D.suiTree(cat.listFor('dev'), 'dev', cat.groups());
  assert.deepEqual(d.children.map(c => c.label), ['Munka', 'Alkalmazások', 'Fájlok', 'Rendszer', 'Fejlesztés']);
  assert.deepEqual(d.children[4].children.map(c => c.label), ['Repó & Git', 'Ügynökök & AI', 'Tudás', 'Infrastruktúra', 'Eszközök & hardver', 'Megjelenés']);
});

test('◣ tree: Munka splits into Tervezés · Árazás · Anyag; every leaf opens a catalog item or is a level command', () => {
  const t = D.suiTree(cat.listFor('user'), 'user', cat.groups());
  assert.deepEqual(t.children[0].children.map(c => c.label), ['Tervezés', 'Árazás', 'Anyag']);
  const leaves = D.leaves(t);
  for (const l of leaves) assert.ok(cat.get(l.id) || /^lvl:(user|dev|all)$/.test(l.id), l.id);
  assert.ok(leaves.some(l => l.id === 'lvl:dev' && l.stay));
  assert.ok(leaves.every(l => Array.isArray(l.trail)));
  assert.ok(!leaves.some(l => cat.get(l.id) && cat.get(l.id).level !== 'user'), 'no dev item in the user tree');
});

test('◢ dial: User shows F, I, Q and Keresés; Dev all ten layers in order, then Konnektóm · Holo · Rétegek · Keresés', () => {
  const u = D.stackDial(cat.listFor('user')).children;
  assert.deepEqual(u.map(r => r.layer || r.id), ['F', 'I', 'Q', 'stack.search']);
  const d = D.stackDial(cat.listFor('dev')).children;
  assert.deepEqual(d.filter(r => r.layer).map(r => r.layer), D.LAYERS);
  assert.deepEqual(d.filter(r => !r.layer).map(r => r.id), ['stack.connectome', 'stack.orb', 'stack.layers', 'stack.search']);
  assert.equal(d.find(r => r.layer === 'Z').opens, false, 'Z is machine-only: shown, not openable');
});

test('dock: User pins from the catalog; Dev adds dev items after the divider; a saved list wins; unknown ids dropped', () => {
  const u = D.dock(cat.listFor('user'), 'user', null, []);
  assert.ok(u.pinned.includes('planner') && u.pinned.includes('files'));
  assert.deepEqual(u.dev, []);
  const d = D.dock(cat.listFor('dev'), 'dev', null, [{ pane: 'app-1', kind: 'app', label: 'X', app: 'planner' }]);
  assert.ok(d.dev.includes('term') && d.dev.includes('claude-code'));
  assert.equal(d.running.length, 1);
  assert.deepEqual(D.dock(cat.listFor('user'), 'user', ['mail', 'nope', 'planner'], []).pinned, ['mail', 'planner']);
});

test('top strip: the default order; a chosen list keeps its order, drops unknown and duplicate ids, max 12', () => {
  const l = cat.listFor('user');
  assert.deepEqual(D.topStrip(l, null).map(c => c.id), D.DEFAULT_TOP);
  assert.deepEqual(D.topStrip(l, ['w:git', 'w:clock', 'w:git', 'zz', 'palette']).map(c => c.id), ['w:git', 'w:clock', 'palette']);
  assert.ok(D.topChoices(l).some(c => c.id === 'console' && !c.widget));
  assert.ok(D.validTop(Array(12).fill('w:clock')) && !D.validTop(Array(13).fill('w:clock')));
  assert.ok(D.validDock(null) && !D.validDock(['a b']));
});

test('the page files exist and the frame loads them in order', () => {
  for (const f of ['desk.js', 'desk.css', 'sui-dial.js', 'panes/app.js']) assert.ok(fs.existsSync(path.join(PAGE, f)), f);
  const html = fs.readFileSync(path.join(PAGE, 'vrg-desktop.html'), 'utf8');
  const order = ['frame.js', '../dashboard-data.js', '../shell/lib/desk.js', 'sui-dial.js', 'desk.js'].map(s => html.indexOf('src="' + s + '"'));
  assert.ok(order.every(i => i > 0) && order.every((v, i) => !i || v > order[i - 1]), JSON.stringify(order));
  for (const r of ['data-role="desktop"', 'data-role="dashboard"', 'data-role="topstrip"', 'data-role="workspace"', 'data-role="ground"', 'data-role="dock"', 'data-role="view-toggle"', 'data-role="boot"'])
    assert.ok(html.includes(r), r);
  assert.match(html, /<main id="root" data-role="root" hidden><\/main>/);
});

test('sui-dial.js follows 01_DESIGN.md: 5 rows max, 3 per page + TOVÁBB, Back at the bottom; the CSS geometry is 88 / 248 / 48 / 6', () => {
  const js = fs.readFileSync(path.join(PAGE, 'sui-dial.js'), 'utf8');
  assert.match(js, /const MAX = 5, PAGE = 3;/);
  assert.match(js, /TOVÁBB ›/);
  assert.match(js, /✕ BEZÁR/);
  const css = fs.readFileSync(path.join(PAGE, 'desk.css'), 'utf8');
  assert.match(css, /\.sui \{ position: absolute; bottom: 0; z-index: 60; width: 88px; height: 88px; \}/);
  assert.match(css, /\.sui-col \{ position: absolute; bottom: 100px; width: 248px; display: flex; flex-direction: column; gap: 6px; \}/);
  assert.match(css, /min-height: 48px/);
});
