// WP-41 (Desktop unify U5): the two primary views, the level switch and the double-Tab toggle — the pure parts in lib/desk.js,
// the settings keys, the palette's desk: commands. The real window is checked by shell/selftest/wp-41.js (run.js WP-41).
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path'), fs = require('fs'), os = require('os');
const build = require('../build.js');
const { KINDS } = require('../shell/lib/layout.js');
const { createCatalog } = require('../shell/lib/catalog.js');
const D = require('../shell/lib/desk.js');

const C = build.collect();
const cat = createCatalog({ file: path.resolve(__dirname, '..', '..', 'launcher', 'vrg-catalog.json'), collect: () => C, kinds: KINDS });
cat.load();
const key = (k, o) => ({ type: 'keyDown', key: k, control: false, alt: false, shift: false, meta: false, isAutoRepeat: false, ...(o || {}) });

test('double tap: two Tabs within 350 ms toggle once; slower, modified, repeated or interrupted taps do not', () => {
  const t = D.createDoubleTap({ key: 'Tab', ms: 350 });
  assert.equal(t.feed(key('Tab'), 1000), false);
  assert.equal(t.feed(key('Tab'), 1300), true);
  assert.equal(t.feed(key('Tab'), 1400), false, 'a third tap starts a new pair');
  assert.equal(t.feed(key('Tab'), 1800), false, '400 ms is too slow');
  assert.equal(t.feed(key('Tab', { shift: true }), 1900), false, 'Shift+Tab is not a tap');
  assert.equal(t.feed(key('Tab'), 2000), false);
  assert.equal(t.feed(key('a'), 2100), false);
  assert.equal(t.feed(key('Tab'), 2200), false, 'another key in between resets');
  assert.equal(t.feed({ ...key('Tab'), type: 'keyUp' }, 2250), false);
  assert.equal(t.feed(key('Tab'), 2300), true, 'key-up does not count');
  assert.equal(t.feed(key('Tab', { isAutoRepeat: true }), 2350), false);
});

test('toggle spec: config/keymap.json desktopToggleKey / desktopToggleMs, bad values fall back to Tab / 350', () => {
  const km = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'config', 'keymap.json'), 'utf8'));
  assert.deepEqual(D.toggleSpec(km), { key: 'Tab', ms: 350 });
  assert.deepEqual(D.toggleSpec({ desktopToggleKey: 'F12', desktopToggleMs: 500 }), { key: 'F12', ms: 500 });
  assert.deepEqual(D.toggleSpec({ desktopToggleKey: 'Ctrl+Tab', desktopToggleMs: 5 }), { key: 'Tab', ms: 350 });
  assert.deepEqual(D.toggleSpec(null), D.DEFAULT_TOGGLE);
});

test('the editable probe names inputs, textareas, contenteditable and terminals', () => {
  for (const s of ['textarea', 'input', 'isContentEditable', '.xterm', 'data-kind']) assert.ok(D.EDITABLE_PROBE.includes(s), s);
});

test('Dashboard sections: User = Ma · Alkalmazások · Munkák · Állapot; Dev adds five; All adds Katalógus', () => {
  const ids = lv => D.sections(cat.listFor(lv), lv, cat.sections(), cat.groups()).map(s => s.id);
  assert.deepEqual(ids('user'), ['ma', 'apps', 'munkak', 'allapot']);
  assert.deepEqual(ids('dev'), ['ma', 'apps', 'munkak', 'allapot', 'vonalak', 'stack', 'ugynokok', 'szerverek', 'meroszamok']);
  assert.deepEqual(ids('all'), [...ids('dev'), 'katalogus']);
});

test('Alkalmazások groups by function; a feature hangs under its app, not beside it', () => {
  const apps = D.sections(cat.listFor('user'), 'user', cat.sections(), cat.groups()).find(s => s.id === 'apps');
  const g = Object.fromEntries(apps.groups.map(x => [x.group + '/' + x.sub, x.items]));
  assert.ok(g['munka/tervezes'].includes('planner'));
  assert.ok(!g['munka/tervezes'].includes('client-preview'));
  assert.ok(g['munka/arazas'].includes('calc-panel'));
  assert.ok(g['munka/anyag'].includes('inventory'));
  assert.ok(g['alkalmazasok/iroda'].includes('mail'));
  assert.ok(g['alkalmazasok/terep'].includes('console'));
  assert.equal(apps.groups[0].group, 'munka');
});

test('attached: at User a tile carries its user children only; at Dev also its START actions and servers', () => {
  const pick = lv => { const l = cat.listFor(lv); return D.attached(l.find(i => i.id === 'planner'), l, lv); };
  const u = pick('user'), d = pick('dev');
  assert.deepEqual(u.items, ['client-preview']);
  assert.deepEqual(u.acts, []);
  assert.deepEqual(u.servers, []);
  assert.ok(d.items.includes('planner-cyd') && d.items.includes('client-preview'));
  assert.ok(d.acts.some(a => a.act === 's:P/B'));
  assert.deepEqual(d.servers.map(s => s.id).sort(), ['gyro', 'planner']);
});

test('settings: desk.level / desk.view / desk.top / desk.dock / auth.enabled whitelisted, typed, defaulted', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'VRG-desk-test-'));
  const prev = process.env.VRG_DESK_HOME;
  process.env.VRG_DESK_HOME = dir;
  try {
    delete require.cache[require.resolve('../shell/lib/settings.js')];
    delete require.cache[require.resolve('../shell/lib/paths.js')];
    const st = require('../shell/lib/settings.js');
    assert.equal(st.get('desk.level'), 'user');
    assert.equal(st.get('desk.view'), 'dashboard');
    assert.equal(st.get('desk.top'), null);
    assert.equal(st.get('desk.dock'), null);
    assert.equal(st.get('auth.enabled'), false);
    assert.equal(st.set('desk.level', 'dev'), 'dev');
    assert.throws(() => st.set('desk.level', 'admin'));
    assert.throws(() => st.set('desk.view', 'overlay'));
    assert.throws(() => st.set('desk.top', ['w:clock', '../x']));
    assert.throws(() => st.set('auth.enabled', 'yes'));
    assert.deepEqual(st.set('desk.top', ['w:clock', 'console']), ['w:clock', 'console']);
  } finally {
    if (prev === undefined) delete process.env.VRG_DESK_HOME; else process.env.VRG_DESK_HOME = prev;
    delete require.cache[require.resolve('../shell/lib/settings.js')];
    delete require.cache[require.resolve('../shell/lib/paths.js')];
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('palette: desk: commands are a known kind and run through the module main passes in', async () => {
  const P = require('../shell/lib/palette.js');
  assert.equal(P.kindOf('desk:toggle'), 'desk');
  const ran = [];
  const mod = { paletteItems: () => [{ id: 'desk:toggle', hu: 'Nézetváltás', en: 'Toggle' }], run: id => { ran.push(id); return { ok: true, hu: 'ok' }; } };
  const R = { C: { data: { start: [], programs: [], lines: [], go: [] }, startActs: {} } };
  const pal = P.createPalette({ R, acts: { lookup: () => null, runAct: async () => ({ ok: false }) }, openPane: () => {}, modules: { 'desk:': mod }, store: { load: () => [], save: () => {} } });
  assert.ok(pal.index().some(i => i.id === 'desk:toggle' && i.kind === 'desk'));
  const r = await pal.run('desk:toggle');
  assert.equal(r.ok, true);
  assert.deepEqual(ran, ['desk:toggle']);
});

test('main.js registers the desktop namespace and hides auth.enabled from the page', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '..', 'shell', 'main.js'), 'utf8');
  for (const ch of ["'desktop', 'catalog'", "'desktop', 'state'", "'desktop', 'open'", "'desktop', 'server'", "'desktop', 'cover'"]) assert.ok(src.includes(ch), ch);
  assert.match(src, /k === 'auth\.enabled' && v !== undefined\) return \{ ok: false, err: 'forbidden'/);
  assert.match(src, /wc === win\.webContents\) return/, 'the frame page watches its own double Tab');
});

test('the Tab recorder: an isolated-world script that notes, at each Tab keydown, whether the focus took text; the last two only', () => {
  assert.equal(typeof D.TAB_WORLD, 'number');
  assert.ok(D.TAB_WORLD > 999, 'not the main world, not an Electron reserved id');
  const listeners = [];
  const win = { addEventListener: (t, f, cap) => listeners.push({ t, f, cap }) };
  const doc = { activeElement: null };
  const run = code => new Function('window', 'document', 'return ' + code)(win, doc);
  assert.equal(run(D.TAB_RECORDER), true);
  assert.equal(run(D.TAB_RECORDER), undefined, 'a second install is a no-op');
  assert.equal(listeners.length, 1); assert.equal(listeners[0].t, 'keydown'); assert.equal(listeners[0].cap, true);
  assert.equal(run(D.TAB_READ), null, 'no pair yet');
  const k = key => listeners[0].f({ key });
  doc.activeElement = { tagName: 'INPUT', type: 'number' }; k('Tab');
  doc.activeElement = { tagName: 'BUTTON' }; k('Tab'); k('a');
  let r = run(D.TAB_READ);
  assert.deepEqual(r.p, [true, false]); assert.ok(r.gap >= 0 && r.age >= 0);
  assert.equal(D.readPair(r, 350), 'keep');
  doc.activeElement = { tagName: 'DIV', isContentEditable: false, closest: () => null }; k('Tab');
  r = run(D.TAB_READ);
  assert.deepEqual(r.p, [false, false]);
  assert.equal(D.readPair(r, 350), 'toggle');
  // a focused iframe: followed into a same-origin document; one that cannot be looked into keeps the keys with the page
  doc.activeElement = { tagName: 'IFRAME', contentDocument: { activeElement: { tagName: 'TEXTAREA' } } }; k('Tab');
  assert.equal(run(D.TAB_READ).p[1], true);
  doc.activeElement = { tagName: 'IFRAME', contentDocument: null }; k('Tab');
  assert.equal(run(D.TAB_READ).p[1], true);
  doc.activeElement = { tagName: 'IFRAME', contentDocument: { activeElement: { tagName: 'A', closest: () => null } } }; k('Tab');
  assert.equal(run(D.TAB_READ).p[1], false);
});

test('readPair: only a fresh pair within the interval counts; anything else is stale (read again, then the probe)', () => {
  assert.equal(D.readPair(null, 350), 'stale');
  assert.equal(D.readPair({ p: [false, false], gap: 120, age: 30 }, 350), 'toggle');
  assert.equal(D.readPair({ p: [false, true], gap: 120, age: 30 }, 350), 'keep');
  assert.equal(D.readPair({ p: [false, false], gap: 5000, age: 30 }, 350), 'stale', 'the second tap not recorded yet: [older, first]');
  assert.equal(D.readPair({ p: [false, false], gap: 100, age: 9000 }, 350), 'stale', 'an old pair');
  assert.equal(D.readPair([false, false], 350), 'stale', 'the old array shape');
});

test('--start windows: main boots the Desktop view with its windows; the probes written before the desk get it too', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '..', 'shell', 'main.js'), 'utf8');
  assert.match(src, /argVal\('--start'\) === 'windows' \|\| \(SELFTEST && PROBE_NO > 0 && PROBE_NO < 40\)/);
  const page = fs.readFileSync(path.resolve(__dirname, '..', 'page', 'desk.js'), 'utf8');
  assert.match(page, /if \(S\.start\) S\.view = 'desktop';/);
  assert.match(page, /now\.some\(r => !was\.has\(r\.pane\)\) && \(S\.view !== 'desktop' \|\| !S\.wsShown\)/, 'a pane opened from elsewhere is never unseen');
});
