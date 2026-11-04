// WP-10: roots, handles, safe names, OneDrive marks. A temp tree under %TEMP%\VRG\desk-test-*, a junction pointing outside it.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), os = require('os');

const { createRoots } = require('../shell/lib/roots.js');
const { createHandles, createFsView } = require('../shell/lib/handles.js');
const { isSafeName } = require('../shell/lib/names.js');
const cloudattr = require('../shell/lib/cloudattr.js');

const base = path.join(os.tmpdir(), 'VRG');
fs.mkdirSync(base, { recursive: true });
const TMP = fs.mkdtempSync(path.join(base, 'desk-test-'));
const ROOT = path.join(TMP, 'root');
const OUTSIDE = path.join(TMP, 'outside');
const SIBLING = path.join(TMP, 'rootX');                               // shares a name prefix with ROOT
for (const d of [ROOT, OUTSIDE, SIBLING, path.join(ROOT, 'zeta'), path.join(ROOT, 'Árpád'), path.join(ROOT, 'alma')]) fs.mkdirSync(d, { recursive: true });
fs.writeFileSync(path.join(ROOT, 'b.txt'), 'bb');
fs.writeFileSync(path.join(ROOT, 'á.txt'), 'a');
fs.writeFileSync(path.join(ROOT, 'c.txt'), 'c');
fs.writeFileSync(path.join(OUTSIDE, 'secret.txt'), 'x');
fs.symlinkSync(OUTSIDE, path.join(ROOT, 'jump'), 'junction');

const CONF = path.join(TMP, 'roots.json');
fs.writeFileSync(CONF, JSON.stringify([
  { id: 'main', hu: 'Fő', path: ROOT },
  { id: 'gone', hu: 'Nincs', path: path.join(TMP, 'does-not-exist') },
  { id: 'cloud', hu: 'Felhő', env: ['VRG_TEST_NOPE', 'VRG_TEST_CLOUD'], kind: 'onedrive' },
]));
const MACHINE = path.join(TMP, 'machine.json');
fs.writeFileSync(MACHINE, JSON.stringify([
  { id: 'extra', hu: 'Extra', path: SIBLING },
  { id: 'main', hu: 'Hijack', path: OUTSIDE },                         // may not redefine a configured root
]));

test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));

function setup() {
  const roots = createRoots({ configFile: CONF, repo: ROOT, full: TMP, machineFile: MACHINE, env: { VRG_TEST_CLOUD: ROOT } });
  roots.load();
  const handles = createHandles({ roots });
  return { roots, handles, view: createFsView({ roots, handles, cloud: { marks: async () => new Map() } }) };
}

test('roots: missing skipped, machine rows added but never redefine, kind from config', () => {
  const { roots } = setup();
  assert.deepEqual(roots.list().map(r => r.id), ['main', 'cloud', 'extra']);
  assert.equal(roots.get('main').hu, 'Fő');
  assert.equal(roots.get('cloud').kind, 'onedrive');
  assert.equal(roots.get('extra').kind, 'local');
});

test('rootOf: inside, trailing separator, case-insensitive, outside, junction', () => {
  const { roots } = setup();
  assert.equal(roots.rootOf(path.join(ROOT, 'b.txt')), 'main');      // 'cloud' points at the same folder; the first row wins a tie
  assert.equal(roots.rootOf(SIBLING), 'extra');                       // rootX is not inside root
  assert.equal(roots.rootOf(OUTSIDE), null);
  assert.equal(roots.rootOf(path.join(ROOT, 'jump')), null);          // junction to the outside
  assert.equal(roots.rootOf(path.join(ROOT, 'jump', 'secret.txt')), null);
  assert.equal(roots.rootOf(path.join(ROOT, 'nope')), null);
  assert.equal(roots.rootOf(ROOT.toUpperCase()) !== null, true);
});

test('handles: format, reuse, bogus and unknown handles resolve to null', () => {
  const { handles } = setup();
  const h = handles.issue(path.join(ROOT, 'b.txt'));
  assert.match(h, /^h:[A-Za-z0-9_-]{22}$/);
  assert.equal(handles.issue(path.join(ROOT, 'b.txt')), h);
  assert.equal(handles.resolve(h).abs, path.join(ROOT, 'b.txt'));
  assert.equal(handles.resolve('h:' + 'A'.repeat(22)), null);
  assert.equal(handles.resolve('h:short'), null);
  assert.equal(handles.resolve(path.join(ROOT, 'b.txt')), null);
  assert.equal(handles.issue(OUTSIDE), null);
  assert.equal(handles.issue(path.join(ROOT, 'jump')), null);
  assert.equal(handles.issue('relative\\path'), null);
});

test('handles: a folder replaced by a junction after issue is refused', () => {
  const { handles } = setup();
  const d = path.join(ROOT, 'swap');
  fs.mkdirSync(d);
  const h = handles.issue(d);
  assert.equal(handles.resolve(h).abs, d);
  fs.rmdirSync(d);
  fs.symlinkSync(OUTSIDE, d, 'junction');
  assert.equal(handles.resolve(h), null);
  fs.rmdirSync(d);
});

test('handles: capped, oldest dropped', () => {
  const { roots } = setup();
  const small = createHandles({ roots, max: 3 });
  const hs = ['b.txt', 'c.txt', 'á.txt', 'zeta'].map(n => small.issue(path.join(ROOT, n)));
  assert.equal(small.size(), 3);
  assert.equal(small.resolve(hs[0]), null);
  assert.notEqual(small.resolve(hs[3]), null);
});

test('list: handles only, dirs first, Hungarian order, junction not shown, parent only below the root', async () => {
  const { handles, view } = setup();
  const root = handles.issue(ROOT);
  const r = await view.list(root);
  assert.equal(r.dir.display, ROOT);
  assert.equal(r.dir.parent, undefined);
  assert.deepEqual(r.items.map(i => i.name), ['alma', 'Árpád', 'zeta', 'á.txt', 'b.txt', 'c.txt']);
  assert.deepEqual(r.items.map(i => i.kind), ['dir', 'dir', 'dir', 'file', 'file', 'file']);
  for (const i of r.items) { assert.match(i.handle, /^h:[A-Za-z0-9_-]{22}$/); assert.equal(Object.values(i).some(v => typeof v === 'string' && v.includes(TMP)), false); }
  assert.equal(r.items.find(i => i.name === 'b.txt').size, 2);
  const sub = await view.list(r.items[0].handle);
  assert.equal(sub.dir.parent, root);
  const f = await view.list(root, { filter: 'arpad' });
  assert.deepEqual(f.items.map(i => i.name), ['Árpád']);
  const st = await view.stat(r.items.find(i => i.name === 'c.txt').handle);
  assert.equal(st.item.name, 'c.txt');
});

test('list: a handle never resolves to the junction target', async () => {
  const { handles, view } = setup();
  assert.equal(handles.issue(path.join(ROOT, 'jump')), null);
  assert.equal(handles.issue(path.join(ROOT, 'jump', 'secret.txt')), null);
  const r = await view.list('h:' + 'A'.repeat(22));
  assert.equal(r.ok, false);
  assert.equal(r.err, 'not-found');
});

test('fs roots list carries handles and the shared kind', () => {
  const { view } = setup();
  const rl = view.rootList();
  assert.deepEqual(rl.map(r => r.root), ['root:main', 'root:cloud', 'root:extra']);
  assert.equal(rl.every(r => /^h:[A-Za-z0-9_-]{22}$/.test(r.handle)), true);
});

test('isSafeName: 12 bad, 13 good', () => {
  const bad = ['', 'a/b', 'a\\b', 'C:x', 'a*b', 'a?b', 'a"b', 'a<b', 'a|b', '..', 'name.', 'CON.txt'];
  const good = ['a.txt', 'árvíztűrő tükörfúrógép.txt', 'Jelentés 2026', 'x', 'nul1', 'com10', 'my.file.name', '.gitignore', 'lpt', 'Auxiliary', 'a b', 'Ünnep-öröm_ő', 'COM1x'];
  assert.equal(bad.length + good.length, 25);
  for (const n of bad) assert.equal(isSafeName(n), false, JSON.stringify(n));
  for (const n of good) assert.equal(isSafeName(n), true, JSON.stringify(n));
  assert.equal(isSafeName('a'.repeat(201)), false);
  assert.equal(isSafeName('a'.repeat(200)), true);
  assert.equal(isSafeName('x '), false);
  for (const n of ['prn', 'Aux', 'NUL.log', 'com1', 'LPT9.txt']) assert.equal(isSafeName(n), false, n);
  assert.equal(isSafeName(5), false);
});

test('cloudattr: attrib-sample.txt parses to 6 marks', () => {
  const m = cloudattr.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'attrib-sample.txt'), 'utf8'));
  assert.equal(m.size, 6);
  assert.deepEqual([...m.entries()], [
    ['cloud-only.docx', 'online'], ['unpinned.xlsx', 'online'], ['always-here.pdf', 'pinned'],
    ['local.txt', 'local'], ['pinned-wins.txt', 'pinned'], ['árvíztűrő tükörfúrógép.txt', 'online'],
  ]);
});

test('cloudattr: a failing attrib gives no marks (never blocks a listing)', async () => {
  const failing = (cmd, args, o, cb) => cb(new Error('boom'));
  assert.equal((await cloudattr.marks(ROOT, { run: failing })).size, 0);
  const throwing = () => { throw new Error('spawn'); };
  assert.equal((await cloudattr.marks(ROOT, { run: throwing })).size, 0);
  let seen;
  const ok = (cmd, args, o, cb) => { seen = [cmd, args]; cb(null, 'A    O      ' + path.join(ROOT, 'b.txt') + '\r\n'); };
  const m = await cloudattr.marks(ROOT, { run: ok });
  assert.deepEqual(seen, ['attrib', [ROOT + '\\*']]);
  assert.equal(m.get('b.txt'), 'online');
});
