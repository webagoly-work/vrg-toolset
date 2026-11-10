// WP-08: the palette index, the matcher (accents, prefixes, ranking), run() refusals, recent use, the keymap.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), os = require('os');

const base = path.join(os.tmpdir(), 'VRG');
fs.mkdirSync(base, { recursive: true });
const HOME = fs.mkdtempSync(path.join(base, 'desk-test-'));
process.env.VRG_DESK_HOME = HOME;
test.after(() => fs.rmSync(HOME, { recursive: true, force: true }));

const build = require('../build.js');
const { createRegistry } = require('../shell/lib/registry.js');
const { createActs } = require('../shell/lib/acts.js');
const P = require('../shell/lib/palette.js');

const R = createRegistry({ build });
R.load();
const acts = createActs({ R, run: {}, ports: {} });             // only lookup() is used: nothing here starts a program
const memory = () => { let list = []; return { load: () => list, save: l => { list = l; } }; };
const opened = [];
const make = (extra = {}) => P.createPalette({ R, acts, openPane: k => opened.push(k), store: memory(), modules: {}, ...extra });
const pal = make();
const items = pal.index();
const top = (q, recent) => P.search(items, q, recent).map(x => x.id);

test('index: at least 30 items, unique ids, the right shape', () => {
  assert.ok(items.length >= 30, 'items ' + items.length);
  assert.equal(new Set(items.map(x => x.id)).size, items.length);
  for (const x of items) {
    assert.deepEqual(Object.keys(x), ['id', 'hu', 'en', 'kind']);
    assert.ok(x.hu && ['start', 'pane', 'term', 'root', 'preset', 'web'].includes(x.kind), JSON.stringify(x));
  }
  assert.equal(items.filter(x => x.kind === 'pane').length, Object.keys(P.PANES).length);
  assert.ok(items.some(x => x.id === 'pane:files'));
});

test('search: "kapu" ranks s:H (VRG Kapu) first', () => assert.equal(top('kapu')[0], 's:H'));
test('search: "claude rep" ranks s:C/1 (Claude Code, A repo gyökere) first', () => assert.equal(top('claude rep')[0], 's:C/1'));
test('search: "klod" finds nothing (prefix rule, no typo tolerance)', () => assert.deepEqual(top('klod'), []));
test('search: "irany" finds the Irányítópult item', () => {
  const hit = P.search(items, 'irany').find(x => /^Irányítópult/.test(x.hu) || / · Irányítópult/.test(x.hu));
  assert.ok(hit, 'no Irányítópult item');
});
test('search: accents are ignored both ways, all words must match', () => {
  assert.equal(P.fold('Irányítópult Őrült'), 'iranyitopult orult');
  assert.deepEqual(top('terminal').filter(id => id.startsWith('pane:')), ['pane:term']);
  assert.deepEqual(top('terminál'), top('terminal'));
  assert.deepEqual(top('kapu zzzz'), []);
});
test('search: a part inside a word does not match, only a prefix', () => assert.deepEqual(top('apu').filter(id => id === 's:H'), []));
test('search: recent use breaks ties; an empty query lists recent first', () => {
  const tie = [{ id: 'a:1', hu: 'Alfa', en: '', kind: 'start' }, { id: 'a:2', hu: 'Alfa', en: '', kind: 'start' }];
  assert.deepEqual(P.search(tie, 'alf', []).map(x => x.id), ['a:1', 'a:2']);
  assert.deepEqual(P.search(tie, 'alf', ['a:2']).map(x => x.id), ['a:2', 'a:1']);
  assert.deepEqual(P.search(tie, '', ['a:2']).map(x => x.id), ['a:2', 'a:1']);
});

test('run: unknown and malformed ids are refused', async () => {
  for (const id of ['x:y', 's:NOPE', 'pane:nope', 'pane:', '', 'C:\\Windows\\notepad.exe', 'prof:cmd', 's:' + 'x'.repeat(100), 42, null]) {
    const r = await pal.run(id);
    assert.equal(r.ok, false, String(id));
    assert.equal(r.err, 'bad-request', String(id));
  }
  assert.deepEqual(opened, []);
  assert.deepEqual(pal.recent(), []);
});

test('run: pane:<kind> asks the frame to open it and is remembered (30 max, newest first)', async () => {
  const r = await pal.run('pane:files');
  assert.equal(r.ok, true);
  assert.deepEqual(opened, ['files']);
  await pal.run('pane:git');
  await pal.run('pane:files');
  assert.deepEqual(pal.recent(), ['pane:files', 'pane:git']);
  const p2 = make();
  const many = items.filter(x => x.kind === 'pane');
  for (let i = 0; i < 40; i++) await p2.run(many[i % many.length].id);
  assert.ok(p2.recent().length <= P.MAX_RECENT);
});

test('run: an act id goes to acts.runAct only when it is in the index', async () => {
  const seen = [];
  const p = make({ acts: { lookup: acts.lookup, runAct: async id => { seen.push(id); return { ok: true, hu: 'k', en: 'k' }; } } });
  assert.equal((await p.run('s:H')).ok, true);
  assert.deepEqual(seen, ['s:H']);
  assert.equal((await p.run('s:ZZ/9')).ok, false);
  assert.deepEqual(seen, ['s:H']);
  assert.deepEqual(p.recent(), ['s:H']);
});

test('modules: prof:/root:/pre:/web: items come from paletteItems() and run through the module; a missing module is skipped', async () => {
  const ran = [];
  const mods = {
    'prof:': { paletteItems: () => [{ id: 'prof:ps', hu: 'PowerShell', en: 'PowerShell' }, { id: 'root:evil', hu: 'wrong prefix', en: '' }], run: async id => { ran.push(id); return { ok: true, hu: 'k', en: 'k' }; } },
    'root:': null,
  };
  const p = make({ modules: mods });
  const idx = p.index();
  assert.ok(idx.some(x => x.id === 'prof:ps' && x.kind === 'term'));
  assert.ok(!idx.some(x => x.id === 'root:evil'));
  assert.equal((await p.run('prof:ps')).ok, true);
  assert.deepEqual(ran, ['prof:ps']);
  assert.equal((await p.run('root:docs')).ok, false);
});

test('keymap: config/keymap.json parses, matches events, bad specs fall back', () => {
  const file = path.join(__dirname, '..', 'config', 'keymap.json');
  const km = P.loadKeymap(file);
  assert.equal(km.palette, 'Ctrl+Shift+P');
  assert.deepEqual(Object.keys(km).sort(), Object.keys(P.DEFAULT_KEYMAP).sort());
  const ev = (key, m = {}) => ({ key, ctrlKey: !!m.c, shiftKey: !!m.s, altKey: !!m.a });
  assert.ok(P.matchKey(km.palette, ev('P', { c: 1, s: 1 })));
  assert.ok(!P.matchKey(km.palette, ev('P', { c: 1 })));
  assert.ok(!P.matchKey(km.palette, ev('P', { c: 1, s: 1, a: 1 })));
  assert.ok(P.matchKey(km.split, ev('\\', { c: 1 })));
  assert.ok(P.matchKey(km.focusLeft, ev('ArrowLeft', { c: 1, a: 1 })));
  assert.ok(P.matchKey(km.closeTab, ev('w', { c: 1 })));
  const bad = path.join(HOME, 'km.json');
  fs.writeFileSync(bad, JSON.stringify({ palette: 'Hyper+Q', closeTab: 5, split: 'Ctrl+K' }));
  const k2 = P.loadKeymap(bad);
  assert.equal(k2.palette, 'Ctrl+Shift+P');
  assert.equal(k2.closeTab, 'Ctrl+W');
  assert.equal(k2.split, 'Ctrl+K');
  assert.equal(P.loadKeymap(path.join(HOME, 'missing.json')).palette, 'Ctrl+Shift+P');
});

test('recent is stored in the per-user folder, not in the repo', async () => {
  const p = P.createPalette({ R, acts, openPane: () => {}, modules: {} });          // the default file store, under VRG_DESK_HOME
  await p.run('pane:note');
  assert.deepEqual(p.recent(), ['pane:note']);
  assert.ok(fs.existsSync(path.join(HOME, 'founder', 'palette.json')));
});
