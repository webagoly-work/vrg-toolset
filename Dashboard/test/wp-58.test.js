// WP-58 (Fényjel R4, shared/fenyjel/DESIGN.md §7.3): the VRG Asztal's home in the Fényjel look. page/fenyjel-home.js against the
// real catalog (launcher/vrg-catalog.json) and the real glyph set (shared/fenyjel/icons.js), the ui.look setting, the two new
// channels (desktop.serverStart, desktop.sys) and the frame page loading the Fényjel files.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const DASH = path.join(__dirname, '..');
const REPO = path.join(DASH, '..');
const home = require(path.join(DASH, 'page', 'fenyjel-home.js'));
const icons = require(path.join(REPO, 'shared', 'fenyjel', 'icons.js'));
const catalog = JSON.parse(fs.readFileSync(path.join(REPO, 'launcher', 'vrg-catalog.json'), 'utf8'));
const families = Object.keys(icons.FAMILIES);

test('every openable catalog item outside Rendszer has a real glyph, a family and one short word', () => {
  const missing = [];
  for (const it of catalog.items) {
    if (it.group === 'rendszer' || !it.launch || !Object.keys(it.launch).length) continue;
    const g = home.GLYPHS[it.id];
    if (!g) { missing.push(it.id); continue; }
    assert.ok(icons.ICONS[g[0]], it.id + ': glyph ' + g[0] + ' is not in icons.js');
    assert.ok(families.includes(g[1]), it.id + ': family ' + g[1]);
    assert.ok(g[2].length <= 11, it.id + ': "' + g[2] + '" is longer than 11 characters');
  }
  assert.deepEqual(missing, [], 'catalog items without a Fényjel glyph (add them to GLYPHS in page/fenyjel-home.js)');
  for (const id of Object.keys(home.GLYPHS)) assert.ok(catalog.items.some(it => it.id === id), 'GLYPHS names ' + id + ', which is not in the catalog');
});

test('an item without a glyph falls back to its group family and a word from its name', () => {
  const x = home.glyphOf({ id: 'uj-dolog', hu: 'Új mérőeszköz', group: 'munka' });
  assert.equal(x.glyph, null);
  assert.equal(x.family, 'plan');
  assert.equal(x.word, 'mérőeszköz');
});

test('the grid: openable items only, no Rendszer, ordered by family, filtered by the rail', () => {
  const items = [
    { id: 'weather', hu: 'VRG Időjárás', group: 'alkalmazasok', opens: true },
    { id: 'planner', hu: 'Varler Planner', group: 'munka', opens: true },
    { id: 'settings', hu: 'Beállítások', group: 'rendszer', opens: true },
    { id: 'inventory', hu: 'Készlet', group: 'munka', opens: false },
    { id: 'calc-led', hu: 'LED árkalkulátor', group: 'munka', opens: true },
  ];
  assert.deepEqual(home.gridItems(items, '').map(x => x.it.id), ['planner', 'calc-led', 'weather']);
  assert.deepEqual(home.gridItems(items, 'stock').map(x => x.it.id), ['calc-led']);
  assert.deepEqual(home.gridItems(items, 'alert'), []);
});

test('continue cards: open jobs first with their step share, then lines waiting on you, three at most', () => {
  const cards = home.continueCards({
    jobs: [{ code: 'KV12', lastChange: 'tegnap', act: 'job:KV12', has: { intake: true, funnel: true, plan: true } }],
    lines: [{ name: 'hub', status: 'active' }, { name: 'route', status: 'waiting', nextStep: 'GO ROUTE', contAct: 'cont:route' },
      { name: 'city', status: 'waiting', act: 'line:city' }, { name: 'logo', status: 'waiting' }],
  });
  assert.equal(cards.length, 3);
  assert.deepEqual(cards.map(c => c.title), ['KV12', 'route', 'city']);
  assert.equal(cards[0].share, 0.5);
  assert.equal(cards[1].act, 'cont:route');
  assert.equal(cards[1].share, null);
  assert.deepEqual(home.continueCards({}), []);
});

test('ui.look takes fenyjel; the palette offers it; the channels are registered', () => {
  const settings = fs.readFileSync(path.join(DASH, 'shell', 'lib', 'settings.js'), 'utf8');
  assert.match(settings, /'ui\.look':[^\n]*v === 'fenyjel'/);
  const main = fs.readFileSync(path.join(DASH, 'shell', 'main.js'), 'utf8');
  assert.ok(main.includes("'desk:look:fenyjel'"), 'palette command');
  assert.ok(main.includes("ipc.register('desktop', 'serverStart'") && main.includes("ipc.register('desktop', 'sys'"), 'channels');
  assert.match(main, /'serverStart'[\s\S]{0,200}if \(SELFTEST\) return \{ ok: true, dry: true \}/, 'the selftest never starts a server');
});

test('the frame page loads the Fényjel files, and desk.js hands the home over under the look', () => {
  const page = fs.readFileSync(path.join(DASH, 'page', 'vrg-desktop.html'), 'utf8');
  for (const f of ['../../shared/fenyjel/fonts/fonts.css', '../../shared/fenyjel/fenyjel.css', 'fenyjel-home.css', '../../shared/fenyjel/icons.js', 'fenyjel-home.js'])
    assert.ok(page.includes(f), f);
  assert.ok(page.indexOf('src="fenyjel-home.js"') < page.indexOf('src="desk.js"'), 'the home module loads before desk.js');
  const desk = fs.readFileSync(path.join(DASH, 'page', 'desk.js'), 'utf8');
  assert.match(desk, /const LOOKS = \['melyviz', 'grafit', 'fenyjel'\]/);
  assert.match(desk, /S\.look === 'fenyjel' && window\.VRGFenyjelHome\) \{ window\.VRGFenyjelHome\.render\(dash/);
  for (const f of ['fonts/fonts.css', 'fenyjel.css', 'icons.js']) assert.ok(fs.existsSync(path.join(REPO, 'shared', 'fenyjel', f)), f);
});
