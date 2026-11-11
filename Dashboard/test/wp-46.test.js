// WP-46 Lapok: the 4 × 4 sheets of the workspace — the grid rules in lib/sheets.js (open = full, double-click minimises to one cell,
// resize snaps and stops at neighbours, move swaps same-size windows, one full window per sheet, presets), the settings key, the
// presets file, and that main prunes app views by the tree AND the sheets. The real window is checked by shell/selftest/wp-46.js.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path'), fs = require('fs');
const L = require('../shell/lib/sheets.js');

const T = (c, r, w, h) => ({ c, r, w, h });
const tile = (d, id) => { const x = L.findWin(d, id).win; return T(x.c, x.r, x.w, x.h); };
// a doc with one sheet holding `wins` ([id, c, r, w, h, max?])
function sheetWith(wins) {
  let d = L.addSheet(L.empty(), 'Teszt', wins.map(([id, c, r, w, h, max]) => ({ id, kind: 'files', open: 'pane:files', state: {}, c, r, w, h, max: !!max })));
  assert.ok(L.validate(d).ok, JSON.stringify(L.validate(d)));
  return d;
}

test('an empty doc is valid; a sheet is added, named uniquely and made active', () => {
  const e = L.empty();
  assert.deepEqual(L.validate(e), { ok: true });
  let d = L.addSheet(e, 'Iroda');
  d = L.addSheet(d, 'Iroda');
  assert.deepEqual(d.sheets.map(s => [s.id, s.name]), [['s1', 'Iroda'], ['s2', 'Iroda 2']]);
  assert.equal(d.active, 's2');
  assert.equal(L.activate(d, 'nope'), d, 'unknown sheet: the same doc');
  assert.equal(L.activate(d, '').active, '', "'' = the Munkapad");
  const r = L.removeSheet(d, 's2');
  assert.equal(r.active, 's1', 'closing the active sheet activates its neighbour');
  assert.equal(L.removeSheet(r, 's1').active, '');
});

test('validation refuses overlaps, off-grid tiles, two full windows, duplicate pane ids, bad kinds and opens', () => {
  const ok = sheetWith([['a', 0, 0, 2, 2], ['b', 2, 0, 2, 2]]);
  const bad = mut => { const d = JSON.parse(JSON.stringify(ok)); mut(d); return L.validate(d).err; };
  assert.equal(bad(d => { d.sheets[0].wins[1].c = 1; }), 'overlap');
  assert.equal(bad(d => { d.sheets[0].wins[1].w = 3; }), 'tile');
  assert.equal(bad(d => { d.sheets[0].wins[0].max = true; d.sheets[0].wins[1].max = true; }), 'two-max');
  assert.equal(bad(d => { d.sheets[0].wins[1].id = 'a'; }), 'duplicate-id');
  assert.equal(bad(d => { d.sheets[0].wins[1].kind = 'shell'; }), 'kind');
  assert.equal(bad(d => { d.sheets[0].wins[1].open = 'file:C:/x'; }), 'open');
  assert.equal(bad(d => { d.sheets[0].wins[1].id = '../x'; }), 'win-id');
  assert.equal(bad(d => { d.active = 's9'; }), 'active');
  assert.equal(bad(d => { d.extra = 1; }), 'doc');
  assert.equal(bad(d => { d.sheets[0].wins[0].state = { big: 'x'.repeat(9000) }; }), 'state');
});

test('opening: one cell at the clicked cell (or the first free one), full over the sheet; a full sheet refuses', () => {
  let d = L.addSheet(L.empty(), 'A');
  d = L.openWin(d, 's1', { id: 'w-term-1', kind: 'term', open: 'pane:term', state: { prof: 'pwsh' } }, { c: 2, r: 1 });
  const w = L.findWin(d, 'w-term-1').win;
  assert.deepEqual([w.c, w.r, w.w, w.h, w.max], [2, 1, 1, 1, true], 'opened = all 16 cells (max), its tile is the clicked cell');
  d = L.openWin(d, 's1', { id: 'w-git-1', kind: 'git', open: 'pane:git' }, { c: 2, r: 1 });
  assert.deepEqual(tile(d, 'w-git-1'), T(0, 0, 1, 1), 'a taken cell → the first free cell');
  assert.equal(L.findWin(d, 'w-term-1').win.max, false, 'one full window per sheet: the new one');
  assert.equal(L.sheetOf(d, 's1').focus, 'w-git-1');
  const full = sheetWith([['a', 0, 0, 4, 4]]);
  assert.equal(L.openWin(full, 's1', { id: 'b', kind: 'web', open: 'pane:web' }, { c: 0, r: 0 }), full, 'no free cell → the same doc');
  assert.equal(L.openWin(d, 's1', { id: 'w-git-1', kind: 'git', open: 'pane:git' }), d, 'a pane id is never used twice');
});

test('double-click: a full window back to ONE cell at its tile origin; a small window to full; restore keeps the tile', () => {
  let d = sheetWith([['a', 1, 1, 2, 2], ['b', 0, 0, 1, 1]]);
  d = L.toggleMax(d, 'a');
  assert.equal(L.findWin(d, 'a').win.max, true);
  assert.deepEqual(tile(d, 'a'), T(1, 1, 2, 2), 'full keeps its tile underneath');
  const v = L.view(L.sheetOf(d, 's1'));
  assert.deepEqual(v.find(x => x.id === 'a').rect, L.FULL);
  assert.equal(v.find(x => x.id === 'b').covered, true, 'the others wait under it');
  assert.deepEqual(tile(L.restore(d, 'a'), 'a'), T(1, 1, 2, 2), 'the ⧉ button: back to the tile it had');
  d = L.toggleMax(d, 'a');
  assert.deepEqual([...Object.values(tile(d, 'a')), L.findWin(d, 'a').win.max], [1, 1, 1, 1, false], 'the header double-click: one cell');
  assert.equal(L.minimize(d, 'a'), d, 'already one cell: the same doc');
});

test('resize snaps to cells: 2×1, 1×2, 2×2 by edges and corners; never past the opposite edge; stops at a neighbour', () => {
  let d = sheetWith([['a', 0, 0, 1, 1], ['n', 3, 0, 1, 4]]);
  assert.deepEqual(tile(L.resize(d, 'a', 'e', { c: 1, r: 0 }), 'a'), T(0, 0, 2, 1), 'east edge one cell: 2×1');
  assert.deepEqual(tile(L.resize(d, 'a', 's', { c: 0, r: 1 }), 'a'), T(0, 0, 1, 2), 'south edge: 1×2');
  assert.deepEqual(tile(L.resize(d, 'a', 'se', { c: 1, r: 1 }), 'a'), T(0, 0, 2, 2), 'corner: 2×2');
  assert.deepEqual(tile(L.resize(d, 'a', 'se', { c: 3, r: 3 }), 'a'), T(0, 0, 3, 4), 'the neighbour in column 3 stops it at column 2');
  d = L.resize(d, 'a', 'se', { c: 2, r: 2 });
  assert.deepEqual(tile(d, 'a'), T(0, 0, 3, 3));
  assert.deepEqual(tile(L.resize(d, 'a', 'w', { c: 2, r: 0 }), 'a'), T(2, 0, 1, 3), 'the west edge pulled right shrinks it, never past the east edge');
  assert.deepEqual(tile(L.resize(d, 'a', 'nw', { c: 3, r: 3 }), 'a'), T(2, 2, 1, 1));
  const m = sheetWith([['a', 1, 1, 1, 1, true]]);
  assert.equal(L.resize(m, 'a', 'e', { c: 3, r: 1 }), m, 'a full window does not resize');
  const blocked = sheetWith([['a', 0, 0, 1, 1], ['b', 1, 0, 1, 1]]);
  assert.equal(L.resize(blocked, 'a', 'e', { c: 3, r: 0 }), blocked, 'nothing free that way: the same doc');
});

test('move: to a free place; onto a window of the same size they swap; anything else is refused', () => {
  let d = sheetWith([['a', 0, 0, 2, 2], ['b', 2, 2, 2, 2], ['c', 2, 0, 1, 1]]);
  assert.deepEqual(tile(L.move(d, 'a', { c: 0, r: 2 }), 'a'), T(0, 2, 2, 2), 'free → it moves');
  const sw = L.move(d, 'a', { c: 2, r: 2 });
  assert.deepEqual([tile(sw, 'a'), tile(sw, 'b')], [T(2, 2, 2, 2), T(0, 0, 2, 2)], 'same size → swap');
  assert.equal(L.move(d, 'a', { c: 1, r: 1 }), d, 'half over another window → refused');
  assert.equal(L.move(d, 'c', { c: 0, r: 0 }), d, 'onto a bigger window → refused');
  assert.deepEqual(tile(L.move(d, 'a', { c: 3, r: 3 }), 'a'), T(2, 2, 2, 2), 'past the edge → clamped to (2,2), where b is the same size: swap');
  assert.ok(L.okTile(tile(L.move(d, 'c', { c: 9, r: 9 }), 'c')), 'never off the grid');
});

test('a window moves to another sheet: its tile when free there, else the first free cell', () => {
  let d = sheetWith([['a', 1, 1, 2, 2]]);
  d = L.addSheet(d, 'B', [{ id: 'b', kind: 'web', open: 'pane:web', state: {}, c: 1, r: 1, w: 1, h: 1, max: false }]);
  const m = L.moveToSheet(d, 'a', 's2');
  assert.equal(L.findWin(m, 'a').sheet.id, 's2');
  assert.deepEqual(tile(m, 'a'), T(0, 0, 1, 1), 'its 2×2 tile is not free there');
  assert.ok(L.validate(m).ok);
});

test('closing the focused window moves the focus; setState and setKind keep the doc valid', () => {
  let d = sheetWith([['a', 0, 0, 1, 1], ['b', 1, 0, 1, 1]]);
  d = L.focusWin(d, 'b');
  d = L.closeWin(d, 'b');
  assert.equal(L.sheetOf(d, 's1').focus, 'a');
  d = L.setState(d, 'a', { left: { root: 'x' } });
  assert.deepEqual(L.findWin(d, 'a').win.state, { left: { root: 'x' } });
  assert.equal(L.setState(d, 'a', { x: 'y'.repeat(9000) }), d, 'too big a state is not taken');
  assert.equal(L.findWin(L.setKind(d, 'a', 'term', 'pane:term'), 'a').win.kind, 'term');
});

test('presets: fresh pane ids, cat: items only when the page resolved them, saved as my own and removed', () => {
  const P = { id: 'dev', name: 'Fejlesztés', wins: [
    { open: 'pane:term', state: { prof: 'pwsh' }, c: 0, r: 0, w: 2, h: 4 }, { open: 'cat:planner', state: {}, c: 2, r: 0, w: 2, h: 2 }, { open: 'pane:git', state: {}, c: 2, r: 2, w: 2, h: 2 }] };
  let d = L.addSheet(L.empty(), 'X', [{ id: 'w-term-1', kind: 'term', open: 'pane:term', state: {}, c: 0, r: 0, w: 1, h: 1, max: false }]);
  const plain = L.fromPreset(d, P, null, ['w-git-1']);
  assert.deepEqual(plain.map(w => w.id), ['w-term-2', 'w-git-2'], 'ids unique over the doc and the taken ones; the unresolved cat: item is left out');
  const all = L.fromPreset(d, P, pw => (pw.open === 'cat:planner' ? { kind: 'app', open: pw.open, state: { id: 'planner' } } : { kind: pw.open.slice(5), state: pw.state }));
  assert.equal(all.length, 3);
  d = L.addSheet(d, P.name, all);
  assert.ok(L.validate(d).ok);
  assert.equal(L.fromPreset(d, { id: 'x', name: 'x', wins: [{ open: 'pane:files', state: {}, c: 0, r: 0, w: 2, h: 2 }, { open: 'pane:git', state: {}, c: 1, r: 1, w: 1, h: 1 }] }), null, 'an overlapping preset is refused');
  d = L.savePreset(d, d.active, 'sajat', 'Saját');
  assert.deepEqual(d.mine[0].wins.map(w => w.open), ['pane:term', 'cat:planner', 'pane:git']);
  assert.equal(L.removePreset(d, 'sajat').mine.length, 0);
});

test('config/sheets.json: every preset is valid, levels known, cat: ids exist in the catalog and open as windows', () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'sheets.json'), 'utf8'));
  const cat = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'launcher', 'vrg-catalog.json'), 'utf8'));
  const { createCatalog } = require('../shell/lib/catalog.js');
  const { KINDS } = require('../shell/lib/layout.js');
  const C = createCatalog({ file: path.join(__dirname, '..', '..', 'launcher', 'vrg-catalog.json'), collect: (snap => () => snap)(require('../build.js').collect()), kinds: KINDS });   // one registry read, as main caches it
  C.load();
  const list = new Map(C.listFor('all').map(i => [i.id, i]));
  assert.ok(cfg.presets.length >= 5);
  for (const p of cfg.presets) {
    assert.equal(L.validPreset(Object.assign({ id: p.id, name: p.hu, wins: p.wins }, p.focus === undefined ? {} : { focus: p.focus })), '', p.id);
    assert.ok(['user', 'dev', 'all'].includes(p.level), p.id);
    for (const w of p.wins) if (w.open.startsWith('cat:')) {
      const it = list.get(w.open.slice(4));
      assert.ok(it, w.open + ' is in the catalog');
      assert.equal(it.win, true, w.open + ' opens as a window');
    }
  }
  assert.ok(cat.items.length > 0);
});

test('the settings key desk.sheets takes a valid doc and refuses a broken one', () => {
  const settings = require('../shell/lib/settings.js');
  assert.ok(settings.has('desk.sheets'));
  const KEYS = settings.KEYS || null;
  if (KEYS) {
    assert.equal(KEYS['desk.sheets'].type(L.empty()), true);
    assert.equal(KEYS['desk.sheets'].type({ v: 1 }), false);
  }
});

test('main: the views are pruned by the tree AND the sheets; sheets.get / sheets.set are registered', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'shell', 'main.js'), 'utf8');
  assert.match(src, /const livePanes = \(\) => \[\.\.\.layoutLib\.panes\(currentTree\(\)\.tree\), \.\.\.sheetsLib\.wins\(currentSheets\(\)\)\]/);
  assert.match(src, /ipc\.register\('sheets', 'get'/);
  assert.match(src, /ipc\.register\('sheets', 'set', \{ doc: types\.json\(262144\) \}/);
  assert.ok(!/layoutLib\.panes\(tree\)\.filter\(p => p\.kind === 'app'/.test(src), 'no tree-only app pruning left');
});

test('preset focus: an index into wins, kept by Mentés sablonként, found again by its tile after unresolved items are skipped', () => {
  const wins = [{ open: 'pane:files', state: {}, c: 0, r: 0, w: 2, h: 2 }, { open: 'cat:nope', state: {}, c: 2, r: 0, w: 2, h: 2 }, { open: 'pane:web', state: {}, c: 0, r: 2, w: 4, h: 2 }];
  assert.equal(L.validPreset({ id: 'f', name: 'F', wins, focus: 2 }), '');
  for (const bad of [3, -1, 1.5, '2', null]) assert.equal(L.validPreset({ id: 'f', name: 'F', wins, focus: bad }), 'preset-focus', String(bad));
  const P = { id: 'f', name: 'F', wins, focus: 2 };
  let d = L.empty();
  const out = L.fromPreset(d, P);                                        // cat:nope is not resolved, so out has two windows
  assert.equal(out.length, 2);
  assert.equal(L.presetFocus(P, out), out[1].id, 'the web window, by its tile');
  assert.equal(L.presetFocus({ id: 'f', name: 'F', wins: wins.slice(0, 2), focus: 1 }, L.fromPreset(d, { id: 'f', name: 'F', wins: wins.slice(0, 2) })), '', 'a skipped item focuses nothing');
  assert.equal(L.presetFocus({ id: 'g', name: 'G', wins }, out), '', 'no focus → none');
  d = L.addSheet(d, 'F', out);
  d = L.focusWin(d, out[1].id);
  d = L.savePreset(d, d.active, 'sajat', 'Saját');
  assert.equal(d.mine[0].focus, 1);
  assert.ok(L.validate(d).ok);
  d = L.focusWin(d, out[0].id);
  assert.equal(L.savePreset(d, d.active, 'sajat', 'Saját').mine[0].focus, 0);
});

test('the Dev/Code preset: Notes 2x2, Thread Board 2x1, three 1x1 terminals (Claude Code, Parancssor, PowerShell), Google in a browser that has the keyboard', () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'sheets.json'), 'utf8'));
  const prof = new Set(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'profiles.json'), 'utf8')).map(p => p.id));
  const p = cfg.presets.find(x => x.id === 'devcode');
  assert.ok(p);
  assert.equal(p.hu, 'Dev/Code');
  assert.equal(p.level, 'dev');
  const by = o => p.wins.filter(w => w.open === o);
  const size = w => w.w + 'x' + w.h;
  assert.deepEqual(by('pane:note').map(size), ['2x2']);
  assert.deepEqual(by('cat:threadboard').map(size), ['2x1']);
  const terms = by('pane:term');
  assert.deepEqual(terms.map(w => w.state.prof), ['claude-a', 'cmd', 'pwsh']);
  assert.ok(terms.every(w => size(w) === '1x1' && prof.has(w.state.prof)));
  const web = by('pane:web');
  assert.equal(web.length, 1);
  assert.deepEqual(web[0].state.tabs, ['https://www.google.com/']);
  assert.equal(p.wins[p.focus], web[0], 'the browser gets the keyboard');
  assert.equal(p.wins.length, 6);
});

test('the Thread Board opens in-shell from Full/notes: appTarget with roots, the scheme serves its folder and nothing above it', () => {
  const build = require('../build.js');
  const { KINDS } = require('../shell/lib/layout.js');
  const { createCatalog } = require('../shell/lib/catalog.js');
  const { createAppScheme } = require('../shell/lib/appscheme.js');
  const C = build.collect();
  const cat = createCatalog({ file: path.join(__dirname, '..', '..', 'launcher', 'vrg-catalog.json'), collect: () => C, kinds: KINDS });
  cat.load();
  const REPO = path.resolve(__dirname, '..', '..');
  const notes = path.join(path.resolve(C.expand('{full}')), 'notes');
  const board = path.join(notes, 'devlog', 'BOARD.html');
  assert.equal(cat.appTarget('threadboard', { repo: REPO, expand: s => C.expand(s) }), null, 'outside the repo and no roots → not an app');
  assert.deepEqual(cat.appTarget('threadboard', { repo: REPO, expand: s => C.expand(s), roots: [notes] }), { root: path.dirname(board), page: 'BOARD.html', allow: [''] });
  assert.equal(cat.appTarget('threadboard', { repo: REPO, expand: s => C.expand(s), roots: [path.join(notes, 'features')] }), null, 'a root that does not hold it');
  assert.equal(cat.listFor('dev').find(i => i.id === 'threadboard').win, true);
  // the scheme, on a throwaway folder standing in for notes/devlog
  const os = require('os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vrg-wp46-'));
  const dir = path.join(tmp, 'notes', 'devlog');
  fs.mkdirSync(path.join(dir, 'lines'), { recursive: true });
  for (const f of ['BOARD.html', 'DEVLOG.md', 'lines/a.md', '.env', 'x.pem']) fs.writeFileSync(path.join(dir, f), 'x');
  fs.writeFileSync(path.join(tmp, 'notes', 'secret.md'), 'x');
  const fake = { appTarget: (id, o) => (id === 'tb' && (o.roots || []).length ? { root: dir, page: 'BOARD.html', allow: [''] } : null) };
  const isFile = f => { try { return fs.statSync(f).isFile(); } catch (e) { return false; } };
  const sch = createAppScheme({ catalog: fake, repo: REPO, expand: s => s, isFile, realpath: p => fs.realpathSync.native(p), roots: [path.join(tmp, 'notes')] });
  assert.equal(sch.urlFor('tb'), 'vrg-app://tb/BOARD.html');
  assert.equal(sch.decide('vrg-app://tb/').file, path.join(dir, 'BOARD.html'));
  assert.equal(sch.decide('vrg-app://tb/DEVLOG.md').ok, true);
  assert.equal(sch.decide('vrg-app://tb/lines/a.md').ok, true);
  assert.equal(sch.decide('vrg-app://tb/../secret.md').ok, false, 'nothing above its folder');
  assert.equal(sch.decide('vrg-app://tb/%2e%2e/secret.md').ok, false);
  assert.equal(sch.decide('vrg-app://tb/.env').ok, false);
  assert.equal(sch.decide('vrg-app://tb/x.pem').ok, false);
  const none = createAppScheme({ catalog: fake, repo: REPO, expand: s => s, isFile });
  assert.equal(none.decide('vrg-app://tb/BOARD.html').ok, false, 'no roots given → not served');
  fs.rmSync(tmp, { recursive: true, force: true });
});
