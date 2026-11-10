// WP-07: layout tree (validate, defaultTree, split / close / move / focus) and the view host with fake Electron objects.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), os = require('os');

const base = path.join(os.tmpdir(), 'VRG');
fs.mkdirSync(base, { recursive: true });
const HOME = fs.mkdtempSync(path.join(base, 'desk-test-'));
process.env.VRG_DESK_HOME = HOME;
test.after(() => fs.rmSync(HOME, { recursive: true, force: true }));

const L = require('../shell/lib/layout.js');
const settings = require('../shell/lib/settings.js');
const { createViews } = require('../shell/lib/views.js');

const P = (id, kind = 'empty', state = {}) => ({ id, kind, state });
const T = (...items) => ({ active: 0, items });
const tree = root => ({ v: 1, root });
const ids = t => L.panes(t).map(p => p.id);
const ok = t => assert.deepEqual(L.validate(t), { ok: true });
const err = (t, e) => assert.deepEqual(L.validate(t), { ok: false, err: e });

// a tree with a depth of n nodes (n-1 splits above one tabs leaf)
function deep(n) {
  let node = T(P('leaf'));
  for (let i = 1; i < n; i++) node = { dir: 'h', ratio: 0.5, a: node, b: T(P('x' + i)) };
  return tree(node);
}

test('defaultTree: Kezdőlap tab, an empty pane to the right, ratio 0.62, valid', () => {
  const d = L.defaultTree();
  ok(d);
  assert.equal(d.root.dir, 'h');
  assert.equal(d.root.ratio, 0.62);
  assert.deepEqual(d.root.a, { active: 0, items: [{ id: 'home', kind: 'home', state: {} }] });
  assert.equal(d.root.b.items[0].kind, 'empty');
});

test('validate accepts a depth of 6 and 40 panes', () => {
  ok(deep(6));
  ok(tree(T(...Array.from({ length: 40 }, (_, i) => P('p' + i)))));
});

test('validate refuses 12 bad trees with exact reasons', () => {
  err(null, 'tree');
  err({ v: 2, root: T(P('a')) }, 'tree');
  err({ v: 1, root: T(P('a')), extra: 1 }, 'tree');
  err(tree(T(P('a'), P('a'))), 'duplicate-id');                                   // the "cycle" through a repeated id
  err(deep(7), 'depth');
  err(tree({ dir: 'h', ratio: 0, a: T(P('a')), b: T(P('b')) }), 'ratio');
  err(tree({ dir: 'h', ratio: 0.95, a: T(P('a')), b: T(P('b')) }), 'ratio');
  err(tree({ dir: 'x', ratio: 0.5, a: T(P('a')), b: T(P('b')) }), 'dir');
  err(tree(T(P('a', 'nope'))), 'kind');
  err(tree(T(...Array.from({ length: 41 }, (_, i) => P('p' + i)))), 'too-many-panes');
  err(tree(T(P('a', 'empty', { blob: 'x'.repeat(9 * 1024) }))), 'state-size');
  err(tree(T(P('A'))), 'pane-id');
  err(tree({ active: 0, items: [] }), 'empty-group');
  err(tree({ active: 3, items: [P('a')] }), 'active');
  err(tree(T({ id: 'a', kind: 'empty' })), 'pane-keys');
  err(tree(T(P('a', 'empty', 'text'))), 'state');
});

test('validate stops a real object cycle', () => {
  const a = T(P('a')), s = { dir: 'h', ratio: 0.5, a, b: null };
  s.b = s;
  assert.equal(L.validate(tree(s)).ok, false);
});

test('split keeps the tree valid and puts the new empty pane to the right / below', () => {
  const d = L.defaultTree();
  const h = L.split(d, 'home', 'h');
  ok(h);
  assert.equal(L.panes(h).length, 3);
  assert.equal(h.root.a.dir, 'h');
  assert.equal(h.root.a.a.items[0].id, 'home');
  assert.equal(h.root.a.ratio, 0.5);
  const v = L.split(h, 'empty-1', 'v');
  ok(v);
  assert.equal(v.root.b.dir, 'v');
  assert.equal(L.split(d, 'nope', 'h'), d);                                         // unknown pane: unchanged
  assert.equal(L.split(d, 'home', 'z'), d);
  assert.equal(d.root.ratio, 0.62);                                                 // the input is never mutated
});

test('split refuses to go deeper than 6', () => {
  let t = tree(T(P('leaf')));
  for (let i = 0; i < 5; i++) t = L.split(t, 'leaf', 'h');
  ok(t);
  assert.equal(L.split(t, 'leaf', 'h'), t);
});

test('close: a tab, the last pane of a group removes the group and collapses the split', () => {
  const t0 = tree({ dir: 'h', ratio: 0.5, a: T(P('a'), P('b')), b: T(P('c')) });
  const t1 = L.close(t0, 'a');
  ok(t1);
  assert.deepEqual(ids(t1), ['b', 'c']);
  const t2 = L.close(t1, 'c');                                                      // group of c is gone, the split collapses
  ok(t2);
  assert.deepEqual(t2.root, { active: 0, items: [P('b')] });
  const t3 = L.close(t2, 'b');                                                      // the very last pane: a fresh empty pane
  ok(t3);
  assert.deepEqual(t3.root, { active: 0, items: [P('empty-1')] });
  assert.equal(L.close(t0, 'zzz'), t0);
});

test('close keeps the active tab sensible', () => {
  const t = { v: 1, root: { active: 2, items: [P('a'), P('b'), P('c')] } };
  assert.equal(L.close(t, 'a').root.active, 1);                                     // still on c
  assert.equal(L.close(t, 'c').root.active, 1);                                     // clamped
});

test('close collapses a nested split into the sibling', () => {
  const t = tree({ dir: 'h', ratio: 0.5, a: T(P('a')), b: { dir: 'v', ratio: 0.4, a: T(P('b')), b: T(P('c')) } });
  const r = L.close(t, 'b');
  ok(r);
  assert.deepEqual(r.root.b, { active: 0, items: [P('c')] });
  assert.equal(r.root.ratio, 0.5);
});

test('move: between groups, within a group, and the emptied group collapses', () => {
  const t0 = tree({ dir: 'h', ratio: 0.5, a: T(P('a'), P('b')), b: T(P('c')) });
  const t1 = L.move(t0, 'a', 'b', 0);
  ok(t1);
  assert.deepEqual(t1.root.a.items.map(p => p.id), ['b']);
  assert.deepEqual(t1.root.b.items.map(p => p.id), ['a', 'c']);
  assert.equal(t1.root.b.active, 0);
  const t2 = L.move(t0, 'a', 'a', 5);                                               // index clamped, reorder
  ok(t2);
  assert.deepEqual(t2.root.a.items.map(p => p.id), ['b', 'a']);
  assert.equal(t2.root.a.active, 1);
  const t3 = L.move(t1, 'b', 'b', 2);                                               // b was alone: its group goes
  ok(t3);
  assert.deepEqual(t3.root, { active: 2, items: [P('a'), P('c'), P('b')] });
  assert.equal(L.move(t0, 'a', 'ab', 0), t0);                                       // not a tab group
  assert.equal(L.move(t0, 'zzz', 'a', 0), t0);
});

test('focus makes the pane the active tab of its group', () => {
  const t = tree({ dir: 'h', ratio: 0.5, a: T(P('a'), P('b')), b: T(P('c')) });
  assert.equal(L.focus(t, 'b').root.a.active, 1);
  assert.equal(L.focus(t, 'nope'), t);
});

test('setRatio clamps, replace swaps the kind, one Kezdőlap only', () => {
  const d = L.defaultTree();
  assert.equal(L.setRatio(d, '', 0.99).root.ratio, 0.9);
  assert.equal(L.setRatio(d, '', 0).root.ratio, 0.1);
  assert.equal(L.setRatio(d, 'a', 0.5), d);                                         // 'a' is a tabs node
  const r = L.replace(d, 'empty-1', 'files');
  ok(r);
  assert.equal(r.root.b.items[0].kind, 'files');
  assert.equal(r.root.b.items[0].id, 'empty-1');
  assert.equal(L.replace(d, 'empty-1', 'home'), d);
  assert.equal(L.replace(d, 'empty-1', 'bogus'), d);
});

test('layout.tree is a whitelisted setting: default null, valid trees stored, bad ones refused', () => {
  assert.equal(settings.get('layout.tree'), null);
  const d = L.defaultTree();
  settings.set('layout.tree', d);
  assert.deepEqual(settings.get('layout.tree'), d);
  assert.throws(() => settings.set('layout.tree', tree(T(P('a', 'nope')))));
});

// ---------------------------------------------------------------- view host with fakes
function fakes() {
  const calls = [];
  class View {
    constructor(o) { this.o = o; this.visible = null; this.bounds = null; this.destroyed = false;
      this.webContents = { setWindowOpenHandler() {}, on() {}, loadFile: f => calls.push(['load', f]), isDestroyed: () => this.destroyed, close: () => { this.destroyed = true; } }; }
    setBounds(b) { this.bounds = b; } setVisible(v) { this.visible = v; }
  }
  const children = new Set();
  const win = { isDestroyed: () => false, contentView: { addChildView: v => children.add(v), removeChildView: v => children.delete(v) } };
  return { calls, children, win, View };
}

test('views: createLocal(home) loads the page with the preload, hidden until a rect arrives', () => {
  const f = fakes();
  const v = createViews({ WebContentsView: f.View, win: f.win, preload: 'P.js', homePage: 'H.html' });
  const a = v.createLocal('home');
  assert.equal(v.createLocal('home'), a);                                           // idempotent
  assert.equal(v.createLocal('other'), null);
  assert.deepEqual(f.calls, [['load', 'H.html']]);
  assert.equal(a.o.webPreferences.preload, 'P.js');
  assert.equal(a.o.webPreferences.sandbox, true);
  assert.equal(a.o.webPreferences.contextIsolation, true);
  assert.equal(a.o.webPreferences.nodeIntegration, false);
  assert.equal(a.visible, false);
  assert.equal(f.children.size, 1);
});

test('views: setBounds rounds and clamps, zero rect hides, hideAll / showAll, bad rects refused, destroy removes', () => {
  const f = fakes();
  const v = createViews({ WebContentsView: f.View, win: f.win, preload: 'P.js', homePage: 'H.html' });
  const a = v.createLocal('home');
  assert.equal(v.setBounds('home', { x: 10.4, y: 20.6, w: 300, h: 200 }), true);
  assert.deepEqual(a.bounds, { x: 10, y: 21, width: 300, height: 200 });
  assert.equal(a.visible, true);
  v.hideAll(); assert.equal(a.visible, false);
  v.showAll(); assert.equal(a.visible, true);
  v.setBounds('home', { x: 0, y: 0, w: 0, h: 0 }); assert.equal(a.visible, false);
  assert.equal(v.setBounds('home', { x: 'a', y: 0, w: 1, h: 1 }), false);
  assert.equal(v.setBounds('nope', { x: 0, y: 0, w: 1, h: 1 }), false);
  v.setBounds('home', { x: -5, y: 0, w: 99999, h: 10 });
  assert.deepEqual(a.bounds, { x: 0, y: 0, width: 20000, height: 10 });
  assert.equal(v.destroy('home'), true);
  assert.equal(f.children.size, 0);
  assert.equal(a.destroyed, true);
  assert.equal(v.has('home'), false);
  assert.equal(v.destroy('home'), false);
});
