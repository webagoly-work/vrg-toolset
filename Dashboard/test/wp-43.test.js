// WP-43 (Desktop unify U7): in-shell HTML apps on vrg-app:// (lib/appscheme.js, views.createApp, the app pane kind) and the boot
// state machine with the Kapu gate behind auth.enabled. The real window: shell/selftest/wp-41.js (origin, localStorage, refusals).
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path'), fs = require('fs');
const build = require('../build.js');
const layout = require('../shell/lib/layout.js');
const { createCatalog } = require('../shell/lib/catalog.js');
const { createAppScheme, PRIVILEGES } = require('../shell/lib/appscheme.js');
const { createViews } = require('../shell/lib/views.js');
const D = require('../shell/lib/desk.js');

const REPO = path.resolve(__dirname, '..', '..');
const C = build.collect();
const cat = createCatalog({ file: path.join(REPO, 'launcher', 'vrg-catalog.json'), collect: () => C, kinds: layout.KINDS });
cat.load();
const isFile = f => { try { return fs.statSync(f).isFile(); } catch (e) { return false; } };
const sch = createAppScheme({ catalog: cat, repo: REPO, expand: s => C.expand(s), isFile });

test('the scheme is privileged as a standard, secure origin with fetch; no CSP bypass', () => {
  assert.deepEqual(PRIVILEGES, { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: false, bypassCSP: false });
});

test('urlFor: the app page under its own origin; not an app → empty', () => {
  assert.equal(sch.urlFor('calc-panel'), 'vrg-app://calc-panel/Calculator/panel_anyagar_kalkulator.html');
  assert.equal(sch.urlFor('files'), '');
  assert.equal(sch.urlFor('nope'), '');
});

test('decide: the page, its folder and shared/ are served with a content type', () => {
  let r = sch.decide('vrg-app://calc-panel/Calculator/panel_anyagar_kalkulator.html');
  assert.equal(r.ok, true); assert.equal(r.type, 'text/html; charset=utf-8');
  r = sch.decide('vrg-app://calc-panel/shared/melyviz.css');
  assert.equal(r.ok, true); assert.equal(r.type, 'text/css; charset=utf-8');
  r = sch.decide('vrg-app://calc-panel/');
  assert.equal(r.ok, true); assert.ok(r.file.endsWith('panel_anyagar_kalkulator.html'), 'the root serves the page');
});

test('decide: outside the folder, traversal, encoded traversal, other apps\' folders, dot-files, secrets, drives → refused', () => {
  const no = (u, status) => { const r = sch.decide(u); assert.equal(r.ok, false, u); if (status) assert.equal(r.status, status, u + ' ' + r.why); };
  no('vrg-app://calc-panel/launcher/vrg-menu.json', 403);
  no('vrg-app://calc-panel/Calculator/../tools/anonymise.js', 403);
  no('vrg-app://calc-panel/Calculator/%2e%2e/tools/anonymise.js', 403);
  no('vrg-app://calc-panel/Calculator/..%5c..%5cCLAUDE.md', 403);
  no('vrg-app://calc-panel/%2e%2e/%2e%2e/Windows/win.ini', 403);
  no('vrg-app://calc-panel/C:/Windows/win.ini', 403);
  no('vrg-app://calc-panel/MindMap/vrg_mindmap.html', 403);
  no('vrg-app://calc-panel/Calculator/.secret', 403);
  no('vrg-app://calc-panel/Calculator/no-such-file.html', 404);
  no('vrg-app://files/anything', 404);
  no('vrg-app://dev:repo/x');           // a colon in the host is not even a URL (400); refused either way
  no('vrg-app://repo/x', 404);
  no('http://calc-panel/Calculator/x.html', 400);
  no('not a url', 400);
});

test('decide: a repo-root page (VRG Vendor) is served alone, never its siblings', () => {
  assert.equal(sch.decide('vrg-app://vendor/vrg-vendor.html').ok, true);
  assert.equal(sch.decide('vrg-app://vendor/CLAUDE.md').ok, false);
  assert.equal(sch.decide('vrg-app://vendor/vendor-manifest.json').ok, false);
  assert.equal(sch.decide('vrg-app://vendor/shared/melyviz.css').ok, true);
});

test('sameApp: only the app\'s own origin', () => {
  assert.equal(sch.sameApp('calc-panel', 'vrg-app://calc-panel/Calculator/x.html'), true);
  assert.equal(sch.sameApp('calc-panel', 'vrg-app://planner/x'), false);
  assert.equal(sch.sameApp('calc-panel', 'https://example.com/'), false);
  assert.equal(sch.sameApp('calc-panel', 'file:///C:/x'), false);
});

test('one origin per app: Ügyfélnézet and Varler Planner share vrg-app://planner; the C and G layers use their apps\' origins', () => {
  assert.equal(cat.appOwner('client-preview'), 'planner');
  assert.equal(cat.appOwner('planner'), 'planner');
  assert.equal(cat.appOwner('layer.c'), 'codecity');
  assert.equal(cat.appOwner('layer.g'), 'solomon');
  assert.equal(cat.appOwner('files'), null);
});

test('the layout knows the app kind; an app pane needs its id', () => {
  assert.ok(layout.KINDS.includes('app'));
  const t = { v: 1, root: { active: 0, items: [{ id: 'app-1', kind: 'app', state: { id: 'calc-panel', title: 'K' } }] } };
  assert.deepEqual(layout.validate(t), { ok: true });
});

test('views.createApp: no preload, sandboxed, its own partition; navigation off its origin goes to the browser pane or nowhere', () => {
  const made = [], handlers = {}, links = [];
  const wc = { on: (ev, f) => { handlers[ev] = f; }, setWindowOpenHandler: f => { handlers.open = f; }, loadURL: u => { wc.url = u; return Promise.resolve(); },
    session: { setPermissionRequestHandler: f => { handlers.perm = f; } }, isDestroyed: () => false, close() {} };
  function WebContentsView(o) { made.push(o); this.webContents = wc; this.setVisible = () => {}; this.setBounds = () => {}; }
  const win = { isDestroyed: () => false, contentView: { addChildView() {}, removeChildView() {} } };
  const v = createViews({ WebContentsView, win, preload: 'P', homePage: 'H' });
  assert.equal(v.createApp('app:../x', 'vrg-app://x/'), null);
  const r = v.createApp('app:calc-panel', 'vrg-app://calc-panel/Calculator/x.html', { sameApp: u => u.startsWith('vrg-app://calc-panel/'), onLink: u => links.push(u) });
  assert.equal(r.id, 'app:calc-panel');
  const p = made[0].webPreferences;
  assert.equal(p.preload, undefined); assert.equal(p.sandbox, true); assert.equal(p.contextIsolation, true); assert.equal(p.nodeIntegration, false); assert.equal(p.partition, 'persist:vrg-app');
  let prevented = 0; const ev = { preventDefault: () => prevented++ };
  handlers['will-navigate'](ev, 'vrg-app://calc-panel/Calculator/y.html'); assert.equal(prevented, 0);
  handlers['will-navigate'](ev, 'https://example.com/'); assert.equal(prevented, 1);
  handlers['will-navigate'](ev, 'file:///C:/Windows/win.ini'); assert.equal(prevented, 2);
  assert.deepEqual(handlers.open({ url: 'https://example.org/' }), { action: 'deny' });
  assert.deepEqual(links, ['https://example.com/', 'https://example.org/']);
  let allowed = null; handlers.perm(null, 'media', a => { allowed = a; }); assert.equal(allowed, false);
  assert.equal(v.createApp('app:calc-panel', 'vrg-app://calc-panel/').id, 'app:calc-panel', 'a second call reuses the view');
  assert.equal(made.length, 1);
});

test('views: overlays hide by reason; the views come back only when every reason is gone', () => {
  const vis = [];
  function WebContentsView() { this.webContents = { on() {}, setWindowOpenHandler() {}, loadURL: () => Promise.resolve(), session: { setPermissionRequestHandler() {} }, isDestroyed: () => false }; this.setVisible = b => vis.push(b); this.setBounds = () => {}; }
  const v = createViews({ WebContentsView, win: { isDestroyed: () => false, contentView: { addChildView() {} } }, preload: 'P', homePage: 'H' });
  v.createApp('app:x1', 'vrg-app://x1/');
  v.setBounds('app:x1', { x: 0, y: 0, w: 100, h: 100 });
  assert.equal(vis[vis.length - 1], true);
  v.hideAll('cover'); v.hideAll('palette'); v.showAll('palette');
  assert.equal(vis[vis.length - 1], false, 'the dial still covers');
  v.showAll('cover');
  assert.equal(vis[vis.length - 1], true);
});

test('boot: splash → ready with the gate off (default), splash → gate → ready with auth.enabled', () => {
  assert.deepEqual(D.boot({ authEnabled: false }), ['splash', 'ready']);
  assert.deepEqual(D.boot({}), ['splash', 'ready']);
  assert.deepEqual(D.boot({ authEnabled: true }), ['splash', 'gate', 'ready']);
  assert.equal(D.nextBoot('splash', { authEnabled: false }), 'ready');
  assert.equal(D.nextBoot('splash', { authEnabled: true }), 'gate');
  assert.equal(D.nextBoot('gate', { authEnabled: true }), 'ready');
  assert.equal(D.nextBoot('ready', { authEnabled: true }), 'ready');
  assert.equal(D.nextBoot('bogus', { authEnabled: true }), 'splash');
  assert.equal(D.boot({ authEnabled: 'yes' }).includes('gate'), false, 'only a real true turns the gate on');
});
