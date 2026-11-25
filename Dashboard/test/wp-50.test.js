// WP-50: the Post-it overlay (docs/notes/POSTIT.md).
//  - shared/postit/postit-core.js: the bundle format against the shared fixture (the Kotlin twin reads the same file), the note
//    rules, the inbox merge (the same file twice changes nothing; a newer edit wins), placement beside the mark, the author hue;
//  - lib/postit.js: screenOf (view id + URL → screen key), locate (topmost pane under the point, else the frame), the store,
//    and the IPC flow with a fake window: arm → place → save → state, the dev layer gated by the level, export / import via fake dialogs.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path'), os = require('os');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'wp50-'));
process.env.VRG_DESK_HOME = TMP;
const P = require('../../shared/postit/postit-core.js');
const { createPostit, createStore, screenOf, locate, layout } = require('../shell/lib/postit.js');
const settings = require('../shell/lib/settings.js');
const { types } = require('../shell/lib/ipc.js');

const FIXTURE = path.join(__dirname, '..', '..', 'shared', 'postit', 'fixtures', 'bundle-v1.json');

test('the shared fixture is a valid bundle and parses to the same notes', () => {
  const raw = fs.readFileSync(FIXTURE, 'utf8');
  const r = P.parse(raw);
  assert.ok(r.ok, r.err);
  assert.equal(r.bundle.author.id, 't-kovacs01');
  assert.equal(r.bundle.notes.length, 3);
  assert.deepEqual(r.bundle.notes[0].anchor, { screen: 'm:notes', x: 0.82, y: 0.91, w: 412, h: 915, detail: 'new' });
  assert.ok(P.parse('﻿' + raw).ok, 'a BOM is tolerated');
  assert.equal(P.hue('t-kovacs01'), 165);        // the Kotlin test pins the same values
  assert.equal(P.hue('t-x9'), 75);
});

test('bad bundles are refused with a reason', () => {
  const b = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  const bad = (f, err) => { const c = JSON.parse(JSON.stringify(b)); f(c); assert.equal(P.checkBundle(c).err, err); };
  bad(c => { c.format = 'vrg-postit/2'; }, 'format');
  bad(c => { c.author.platform = 'ios'; }, 'author.platform');
  bad(c => { c.notes[1].anchor.screen = 'x:home'; }, 'notes[1].anchor.screen');
  bad(c => { c.notes[0].anchor.x = 1.2; }, 'notes[0].anchor.xy');
  bad(c => { c.notes[2].text = '   '; }, 'notes[2].text');
  bad(c => { c.notes[2].id = c.notes[0].id; }, 'notes.dup');
  bad(c => { c.notes[0].edited = 1; }, 'notes[0].edited');
  assert.equal(P.parse('{').err, 'json');
});

test('make / bundle keep only the known keys', () => {
  const n = P.make({ text: 'Lassú', anchor: { screen: 'd:frame/desktop', x: 0.5, y: 0.5, w: 100, h: 100, detail: '' }, at: 1000, rand: () => 0.5 });
  assert.equal(n.id, 'pn-ssssssssssss');
  assert.ok(!('detail' in n.anchor));
  n.extra = 'x'; n.anchor.secret = 'y';
  const b = P.bundle({ id: 'a-123456', name: 'Teszt', platform: 'desktop', app: 'VRG Asztal' }, [n, { id: 'bad' }], 2000);
  assert.equal(b.notes.length, 1);
  assert.ok(!('extra' in b.notes[0]) && !('secret' in b.notes[0].anchor));
  assert.equal(b.exportedAt, '1970-01-01T00:00:02.000Z');
  assert.ok(P.checkBundle(b).ok);
});

test('mergeInbox: the same file twice changes nothing; a newer edit wins; authors stay apart', () => {
  const b = P.parse(fs.readFileSync(FIXTURE, 'utf8')).bundle;
  const m1 = P.mergeInbox({ authors: {} }, b, 1);
  assert.deepEqual([m1.added, m1.updated], [3, 0]);
  const m2 = P.mergeInbox(m1.inbox, b, 2);
  assert.deepEqual([m2.added, m2.updated], [0, 0]);
  const newer = JSON.parse(JSON.stringify(b));
  newer.notes[0].text = 'Javítva?'; newer.notes[0].edited += 1000;
  newer.notes[1].text = 'régebbi'; newer.notes[1].edited -= 1;
  const m3 = P.mergeInbox(m2.inbox, newer, 3);
  assert.deepEqual([m3.added, m3.updated], [0, 1]);
  const notes = m3.inbox.authors['t-kovacs01'].notes;
  assert.equal(notes.find(n => n.id === 'pn-a1b2c3d4e5f6').text, 'Javítva?');
  assert.equal(notes.find(n => n.id === 'pn-0000000000aa').text, 'A cím levágódik fekvő módban.');
  const other = { ...b, author: { ...b.author, id: 't-x9', name: 'Más' } };
  const m4 = P.mergeInbox(m3.inbox, other, 4);
  assert.equal(Object.keys(m4.inbox.authors).length, 2);
  assert.equal(P.inboxNotes(m4.inbox).length, 6);
  assert.equal(P.inboxNotes(m4.inbox, ['t-x9']).length, 3);
  assert.equal(P.onScreen(P.inboxNotes(m4.inbox), 'm:home').length, 2);
});

test('fromPx / toPx round-trip inside a box; cardAt flips left near the right edge and stays inside', () => {
  const box = { x: 100, y: 50, w: 800, h: 600 };
  const a = P.fromPx(500, 350, box);
  assert.deepEqual(a, { x: 0.5, y: 0.5, w: 800, h: 600 });
  assert.deepEqual(P.toPx(a, box), { x: 500, y: 350 });
  assert.deepEqual(P.fromPx(2000, -5, box), { x: 1, y: 0, w: 800, h: 600 });
  const card = { w: 190, h: 60 };
  assert.equal(P.cardAt({ x: 300, y: 300 }, box, card).side, 'right');
  const r = P.cardAt({ x: 880, y: 60 }, box, card);
  assert.equal(r.side, 'left');
  assert.ok(r.x >= box.x && r.x + card.w <= box.x + box.w && r.y >= box.y);
});

test('screenOf names the views; locate picks the topmost pane, else the frame', () => {
  assert.deepEqual(screenOf('home', 'file:///x/index.html'), { screen: 'd:home' });
  assert.deepEqual(screenOf('app:inventory', 'vrg-app://inventory/Inventory/index.html#tab=2'), { screen: 'd:app/inventory', detail: '/Inventory/index.html#tab=2' });
  assert.deepEqual(screenOf('w3', 'https://www.example.com/a/b?q=secret'), { screen: 'd:web/www.example.com', detail: '/a/b' });
  assert.equal(screenOf('w3', 'about:blank').screen, 'd:web');
  assert.equal(screenOf('mystery', ''), null);
  for (const s of ['d:home', 'd:app/inventory', 'd:web/www.example.com', 'd:web']) assert.ok(P.SCREEN_RE.test(s), s);
  const frame = { screen: 'd:frame/desktop', box: { x: 0, y: 0, w: 1500, h: 900 } };
  const panes = [{ screen: 'd:app/a', box: { x: 0, y: 30, w: 700, h: 800 } }, { screen: 'd:app/b', box: { x: 600, y: 30, w: 700, h: 800 } }];
  assert.equal(locate({ x: 650, y: 100 }, panes, frame).screen, 'd:app/b');
  assert.equal(locate({ x: 100, y: 100 }, panes, frame).screen, 'd:app/a');
  assert.equal(locate({ x: 1400, y: 10 }, panes, frame).screen, 'd:frame/desktop');
  assert.deepEqual(Object.keys(layout(panes, frame)), ['d:frame/desktop', 'd:app/a', 'd:app/b']);
});

test('the store keeps one random author id and drops invalid notes', () => {
  const dir = path.join(TMP, 'store');
  const s = createStore(dir);
  const id = s.me().id;
  assert.match(id, /^a-[0-9a-f]{12}$/);
  assert.equal(createStore(dir).me().id, id);
  const good = P.make({ text: 'ok', anchor: { screen: 'd:home', x: 0, y: 0, w: 1, h: 1 } });
  s.saveMine([good, { id: 'x' }]);
  assert.deepEqual(s.mine().map(n => n.id), [good.id]);
});

// ---------------------------------------------------------------- the overlay with fakes
function fakes() {
  const handlers = {}, emitted = [];
  const ipc = { register: (ns, fn, schema, handler, opts) => { handlers[ns + '.' + fn] = { schema, handler, opts }; }, emit: (w, ns, type) => { emitted.push(ns + ':' + type); return true; } };
  const on = {};
  const win = { isDestroyed: () => false, isMinimized: () => false, isVisible: () => true, getContentBounds: () => ({ x: 10, y: 20, width: 1500, height: 900 }),
    on: (ev, f) => { (on[ev] = on[ev] || []).push(f); }, focus() { this.focused = true; } };
  const made = [];
  class BrowserWindow {
    constructor(o) { this.o = o; this.ignore = null; this.bounds = null; this.visible = false; this.destroyed = false; this.webContents = { setWindowOpenHandler() {}, on() {} }; made.push(this); }
    loadFile() {} once() {} on() {}
    isDestroyed() { return this.destroyed; } destroy() { this.destroyed = true; }
    setBounds(b) { this.bounds = b; } isVisible() { return this.visible; } showInactive() { this.visible = true; } hide() { this.visible = false; }
    setIgnoreMouseEvents(on, o) { this.ignore = on ? (o && o.forward ? 'forward' : 'all') : 'none'; } focus() { this.hasFocus = true; }
  }
  const rects = { 'app:inventory': { x: 0, y: 30, w: 750, h: 870 }, home: { x: 750, y: 30, w: 750, h: 870 } };
  const urls = { 'app:inventory': 'vrg-app://inventory/Inventory/index.html', home: 'file:///index.html' };
  const views = { isHidden: () => false, ids: () => Object.keys(rects), rect: id => rects[id], get: id => ({ webContents: { isDestroyed: () => false, getURL: () => urls[id] } }) };
  const saved = path.join(TMP, 'export.vrgpostit.json');
  const dialog = { showSaveDialog: async () => ({ canceled: false, filePath: saved }), showOpenDialog: async () => ({ canceled: false, filePaths: [FIXTURE, saved] }) };
  return { handlers, emitted, ipc, win, made, BrowserWindow, views, dialog, saved, on };
}
const call = async (f, name, p = {}) => {
  const h = f.handlers[name];
  assert.ok(h, name + ' registered');
  // the schema must accept what the page sends (same check main runs)
  const { compile } = require('../shell/lib/ipc.js');
  assert.ok(compile(h.schema, h.opts)(p), name + ' payload accepted: ' + JSON.stringify(p));
  const r = await h.handler(p);
  return r && typeof r.ok === 'boolean' ? r : { ok: true, ...(r || {}) };
};

test('overlay: off by default, a child window when switched on, gone when off', async () => {
  const f = fakes();
  settings.set('postit.enabled', false);
  const pi = createPostit({ ...f, settings, dir: path.join(TMP, 'pi1'), preload: 'preload.js', page: path.join(__dirname, '..', 'page', 'postit.html'), types });
  pi.sync();
  assert.equal(f.made.length, 0);
  settings.set('postit.enabled', true);
  pi.sync();
  assert.equal(f.made.length, 1);
  const o = f.made[0];
  assert.equal(o.o.parent, f.win);
  assert.equal(o.o.transparent, true);
  assert.equal(o.o.webPreferences.sandbox, true);
  assert.deepEqual(o.bounds, { x: 10, y: 20, width: 1500, height: 900 });
  assert.equal(o.ignore, 'forward', 'the mouse goes through until armed');
  await call(f, 'postit.arm', { on: true });
  assert.equal(o.ignore, 'none', 'armed: the overlay takes the next click');
  await call(f, 'postit.arm', { on: false });
  assert.equal(o.ignore, 'forward');
  await call(f, 'postit.hit', { on: true });
  assert.equal(o.ignore, 'none', 'over a button or note');
  await call(f, 'postit.hit', { on: false });
  settings.set('postit.enabled', false);
  pi.sync();
  assert.ok(o.destroyed);
  const r = await call(f, 'postit.arm', { on: true });
  assert.equal(r.armed, false, 'cannot arm while switched off');
  for (const n of ['state', 'arm', 'show', 'dev', 'hit', 'focus', 'place', 'save', 'remove', 'settle', 'devHide', 'export', 'import', 'clearMine'])
    assert.ok(f.handlers['postit.' + n], n);
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'page', 'postit.html')) && fs.existsSync(path.join(__dirname, '..', 'page', 'postit.js')));
});

test('overlay: arm → place on a pane → save → state draws it on that pane; edit, done, remove', async () => {
  const f = fakes();
  settings.set('postit.enabled', true); settings.set('postit.show', true); settings.set('desk.view', 'desktop'); settings.set('desk.level', 'user');
  const pi = createPostit({ ...f, settings, dir: path.join(TMP, 'pi2'), preload: 'p', page: 'postit.html', types });
  pi.sync();
  await call(f, 'postit.arm', { on: true });
  const pl = await call(f, 'postit.place', { x: 375, y: 465 });
  assert.equal(pl.anchor.screen, 'd:app/inventory');
  assert.equal(pl.anchor.detail, '/Inventory/index.html');
  assert.deepEqual([pl.anchor.x, pl.anchor.y, pl.anchor.w, pl.anchor.h], [0.5, 0.5, 750, 870]);
  assert.equal(pi.state().armed, false, 'one note per arming');
  const outside = await call(f, 'postit.place', { x: 1499, y: 5 });
  assert.equal(outside.anchor.screen, 'd:frame/desktop');
  const empty = await call(f, 'postit.save', { text: '  ', anchor: pl.anchor });
  assert.equal(empty.ok, false);
  const s1 = await call(f, 'postit.save', { text: 'Ez az oszlop üres', anchor: pl.anchor });
  assert.ok(s1.note && s1.note.id);
  let st = pi.state();
  assert.equal(st.mine.length, 1);
  assert.deepEqual(st.boxes['d:app/inventory'], { x: 0, y: 30, w: 750, h: 870 });
  assert.ok(st.boxes['d:frame/desktop']);
  assert.equal(st.devAllowed, false);
  assert.deepEqual(st.theirs, []);
  await call(f, 'postit.save', { id: s1.note.id, text: 'Ez az oszlop üres marad' });
  await call(f, 'postit.save', { id: s1.note.id, state: 'done' });
  st = pi.state();
  assert.equal(st.mine[0].text, 'Ez az oszlop üres marad');
  assert.equal(st.mine[0].state, 'done');
  assert.ok(st.mine[0].edited >= st.mine[0].at);
  const ex = await call(f, 'postit.export');
  assert.equal(ex.count, 1);
  const b = P.parse(fs.readFileSync(f.saved, 'utf8'));
  assert.ok(b.ok);
  assert.equal(b.bundle.author.platform, 'desktop');
  assert.equal(b.bundle.author.id, st.me);
  await call(f, 'postit.remove', { id: s1.note.id });
  assert.equal(pi.state().mine.length, 0);
  assert.equal((await call(f, 'postit.export')).ok, false, 'nothing to export');
});

test('overlay: the dev layer needs Dev level; import calls testers in; devHide and settle', async () => {
  const f = fakes();
  settings.set('postit.enabled', true); settings.set('postit.dev', false); settings.set('postit.devHidden', []); settings.set('desk.level', 'user');
  const pi = createPostit({ ...f, settings, dir: path.join(TMP, 'pi3'), preload: 'p', page: 'postit.html', types });
  // an export of some other install to call in beside the fixture
  const other = P.bundle({ id: 'a-other1', name: 'PC tesztelő', platform: 'desktop' }, [P.make({ text: 'A Kezdőlapon', anchor: { screen: 'd:home', x: 0.1, y: 0.1, w: 750, h: 870 } })]);
  fs.writeFileSync(f.saved, JSON.stringify(other));
  assert.equal((await call(f, 'postit.dev', { on: true })).ok, false, 'User level: refused');
  settings.set('desk.level', 'dev');
  const im = await call(f, 'postit.import');
  assert.deepEqual([im.added, im.updated, im.bad.length], [4, 0, 0]);
  let st = pi.state();
  assert.equal(st.dev, true, 'a first import at Dev level turns the layer on');
  assert.equal(st.theirs.length, 4);
  assert.equal(st.authors.length, 2);
  assert.ok(st.theirs.every(n => n.author && n.author.name));
  assert.equal(P.onScreen(st.theirs, 'd:home').length, 1);
  assert.equal(P.onScreen(st.theirs, 'd:app/inventory').length, 1, 'the fixture’s one Desktop note');
  assert.equal(P.onScreen(st.theirs, 'm:notes').length, 1, 'phone notes are kept, drawn only on the phone');
  await call(f, 'postit.devHide', { id: 't-kovacs01', hide: true });
  st = pi.state();
  assert.equal(st.theirs.length, 1);
  assert.equal(st.authors.find(a => a.id === 't-kovacs01').hidden, true);
  await call(f, 'postit.settle', { author: 'a-other1', id: other.notes[0].id, state: 'done' });
  assert.equal(pi.state().theirs[0].state, 'done');
  const again = await call(f, 'postit.import');
  assert.deepEqual([again.added, again.updated], [0, 0], 'calling the same files in twice changes nothing');
  settings.set('desk.level', 'user');
  assert.deepEqual(pi.state().theirs, [], 'back at User level: the testers’ notes are not drawn');
  settings.set('postit.enabled', false); settings.set('postit.dev', false); settings.set('postit.devHidden', []);
});

test('settings know the Post-it keys and refuse bad values', () => {
  for (const k of ['postit.enabled', 'postit.show', 'postit.dev', 'postit.devHidden', 'postit.name']) assert.ok(settings.has(k), k);
  assert.throws(() => settings.set('postit.enabled', 'yes'));
  assert.throws(() => settings.set('postit.devHidden', ['../x']));
  assert.throws(() => settings.set('postit.name', 'x'.repeat(61)));
});
