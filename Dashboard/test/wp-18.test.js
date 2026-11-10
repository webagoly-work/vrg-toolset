// WP-18: browser — omnibox table (lib/search.js), bookmarks + history (lib/bookmarks.js), find / zoom / external / DevTools against fakes,
// the pane's pure helpers. Temp folders under %TEMP%\VRG\desk-test-*, nothing else on disk (CONTRACT §4.9).
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), os = require('os'), path = require('path');
const { EventEmitter } = require('events');
const { toUrl, providerUrl, loadProviders, loadServers } = require('../shell/lib/search.js');
const { createBookmarks, MAX_HISTORY } = require('../shell/lib/bookmarks.js');
const { createWebHost } = require('../shell/lib/web.js');
const pane = require('../page/panes/web.js');

const DAY = 24 * 3600 * 1000;
const G = 'https://www.google.com/search?q=';
const SERVERS = [{ id: 'planner', port: 8131 }, { id: 'demo', port: 8999, open: '/app/index.html' }];

function tmpDir() {
  const base = path.join(os.tmpdir(), 'VRG');
  fs.mkdirSync(base, { recursive: true });
  return fs.mkdtempSync(path.join(base, 'desk-test-'));
}

test('config/search.json: the four providers, every url has {q}', () => {
  const p = loadProviders();
  assert.deepStrictEqual(p.map(x => x.id), ['google', 'ai', 'maps', 'youtube']);
  assert.strictEqual(providerUrl('youtube', 'a b', p), 'https://www.youtube.com/results?search_query=a%20b');
  assert.strictEqual(providerUrl('maps', 'Győr', p), 'https://www.google.com/maps/search/Gy%C5%91r');
  assert.strictEqual(providerUrl('nope', 'x', p), '');
});

test('toUrl: the omnibox table', () => {
  const table = [
    ['villanyszerelés', G + 'villanyszerel%C3%A9s'],
    ['?mi az a GFCI', 'https://www.google.com/search?udm=50&q=mi%20az%20a%20GFCI'],
    ['srv:planner', 'http://localhost:8131/'],
    ['srv:demo', 'http://localhost:8999/app/index.html'],
    ['srv:nope', G + 'srv%3Anope'],
    ['github.com/x', 'https://github.com/x'],
    ['localhost:8806', 'http://localhost:8806'],
    ['  example.org  ', 'https://example.org'],
    ['https://example.org/a?b=1', 'https://example.org/a?b=1'],
    ['http://127.0.0.1:8080/x', 'http://127.0.0.1:8080/x'],
    ['javascript:alert(1)', G + 'javascript%3Aalert(1)'],
    ['file:///c:/x', G + 'file%3A%2F%2F%2Fc%3A%2Fx'],
    ['data:text/html,<b>x</b>', G + 'data%3Atext%2Fhtml%2C%3Cb%3Ex%3C%2Fb%3E'],
    ['foo bar.com', G + 'foo%20bar.com'],
    ['http://a b', G + 'http%3A%2F%2Fa%20b'],
    ['', ''],
    ['   ', ''],
  ];
  for (const [input, want] of table) assert.strictEqual(toUrl(input, { providers: loadProviders(), servers: SERVERS }), want, JSON.stringify(input));
});

test('toUrl: srv: reads the port from the real vrg-menu.json', () => {
  const planner = loadServers().find(s => s.id === 'planner');
  assert.ok(planner && planner.port === 8131);
  assert.ok(toUrl('srv:planner').startsWith('http://localhost:8131/'));
});

test('bookmarks: history prune keeps 90 days, drops older', () => {
  const dir = tmpDir();
  try {
    let t = 1000 * DAY;
    const bm = createBookmarks({ file: path.join(dir, 'web.json'), days: () => 90, now: () => t, timers: false });
    bm.visit('http://127.0.0.1:1/old', 'old');
    t += 10 * DAY;
    bm.visit('http://127.0.0.1:1/edge', 'edge');
    t += 79 * DAY;
    bm.visit('http://127.0.0.1:1/new', 'new');
    t += 1 * DAY;                                                 // old is exactly 90 days old → still in; one more day pushes it out
    assert.deepStrictEqual(bm.history().map(h => h.title), ['new', 'edge', 'old']);
    t += 1 * DAY;
    assert.deepStrictEqual(bm.history().map(h => h.title), ['new', 'edge']);
    t += 90 * DAY;
    assert.deepStrictEqual(bm.history().map(h => h.title), []);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('bookmarks: history rules, search, clear, cap, file round trip', () => {
  const dir = tmpDir();
  try {
    const file = path.join(dir, 'user', 'web.json');
    let t = 5000 * DAY;
    const mk = () => createBookmarks({ file, days: () => 90, now: () => t, timers: false });
    const bm = mk();
    assert.strictEqual(bm.visit('file:///c:/x', 'no'), false);
    assert.strictEqual(bm.visit('javascript:alert(1)', 'no'), false);
    assert.strictEqual(bm.visit('http://127.0.0.1:1/a', 'A'), true);
    t += 1000;
    bm.visit('http://127.0.0.1:1/a', 'A2');                       // same URL right after itself: one row, new title
    t += 1000;
    bm.visit('http://127.0.0.1:1/b', 'Beta');
    assert.deepStrictEqual(bm.history().map(h => [h.url, h.title]), [['http://127.0.0.1:1/b', 'Beta'], ['http://127.0.0.1:1/a', 'A2']]);
    assert.deepStrictEqual(bm.history('beta').map(h => h.title), ['Beta']);
    assert.deepStrictEqual(bm.history('/a').map(h => h.title), ['A2']);

    assert.deepStrictEqual(bm.toggle('http://127.0.0.1:1/b', 'Beta'), { bookmarked: true });
    assert.strictEqual(bm.toggle('file:///x', 'no').err, 'bad-request');
    bm.flush();
    const again = mk();
    assert.deepStrictEqual(again.list().map(b => b.url), ['http://127.0.0.1:1/b']);
    assert.strictEqual(again.history().length, 2);
    assert.deepStrictEqual(Object.keys(JSON.parse(fs.readFileSync(file, 'utf8'))).sort(), ['bookmarks', 'history']);
    assert.deepStrictEqual(again.toggle('http://127.0.0.1:1/b'), { bookmarked: false });
    assert.deepStrictEqual(again.list(), []);

    again.clear();
    assert.deepStrictEqual(again.history(), []);
    assert.deepStrictEqual(mk().history(), []);

    const big = mk();
    for (let i = 0; i < MAX_HISTORY + 5; i++) big.visit('http://127.0.0.1:1/p' + i, 'p');
    assert.strictEqual(big.history('', 1e9).length, MAX_HISTORY);
    assert.strictEqual(big.history('', 1)[0].url, 'http://127.0.0.1:1/p' + (MAX_HISTORY + 4));

    const none = createBookmarks({ file: path.join(dir, 'none.json'), days: () => 0, now: () => t, timers: false });
    none.visit('http://127.0.0.1:1/z', 'z');
    t += 1;
    assert.deepStrictEqual(none.history(), []);                   // 0 days = keep nothing
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ---- find / zoom / external / DevTools / go against fakes
function fakeHost() {
  const wc = new EventEmitter();
  Object.assign(wc, {
    url: '', loads: [], zoomF: 1, muted: false, devtools: 0, finds: [], stops: [],
    getURL() { return this.url; }, getTitle: () => 't', isDestroyed: () => false, setWindowOpenHandler() {},
    loadURL(u) { this.loads.push(u); this.url = u; return Promise.resolve(); },
    isLoading: () => false, isCurrentlyAudible: () => false, canGoBack: () => false, canGoForward: () => false,
    getZoomFactor() { return this.zoomF; }, setZoomFactor(f) { this.zoomF = f; },
    setAudioMuted(m) { this.muted = m; }, isAudioMuted() { return this.muted; },
    openDevTools() { this.devtools++; }, stopFindInPage(a) { this.stops.push(a); },
    findInPage(q, o) { this.finds.push([q, o]); const id = this.finds.length; setImmediate(() => this.emit('found-in-page', {}, { requestId: id, finalUpdate: true, matches: 3, activeMatchOrdinal: 1 })); return id; },
  });
  const views = { createWeb: ({ id }) => ({ id: id || 'w1', view: { webContents: wc } }), destroy() {}, setBounds: () => true };
  const store = {};
  const ses = () => Object.assign(new EventEmitter(), { getUserAgent: () => '', setUserAgent() {}, setPermissionRequestHandler() {}, setPermissionCheckHandler() {}, setDevicePermissionHandler() {} });
  const host = createWebHost({ getViews: () => views, getSession: ses, settings: { get: k => store[k] || {}, set: (k, v) => v } });
  return { host, wc };
}

test('web host: go navigates http(s) only; zoom steps and clamps; mute', () => {
  const { host, wc } = fakeHost();
  const { view } = host.open({ url: 'http://127.0.0.1:1/' });
  assert.deepStrictEqual(host.go(view, 'http://127.0.0.1:1/next'), {});
  assert.strictEqual(wc.url, 'http://127.0.0.1:1/next');
  assert.strictEqual(host.go(view, 'file:///c:/x').err, 'bad-request');
  assert.strictEqual(host.go(view, 'javascript:alert(1)').err, 'bad-request');
  assert.strictEqual(host.go('nope', 'http://127.0.0.1:1/').err, 'not-found');
  assert.strictEqual(wc.loads.length, 2);

  assert.strictEqual(host.zoom(view, 'in').zoom, 1.1);
  assert.strictEqual(host.zoom(view, 'in').zoom, 1.25);
  assert.strictEqual(host.zoom(view, 'out').zoom, 1.1);
  assert.strictEqual(host.zoom(view, 'reset').zoom, 1);
  assert.strictEqual(host.zoom(view, 9).zoom, 5);
  assert.strictEqual(host.zoom(view, 0.01).zoom, 0.25);
  assert.strictEqual(host.zoom(view, 'out').zoom, 0.25);
  assert.strictEqual(host.zoom(view, 'sideways').err, 'bad-request');
  assert.deepStrictEqual(host.mute(view, true), { muted: true });
});

test('web host: external opens http(s) only; DevTools only for localhost', () => {
  const { host, wc } = fakeHost();
  const { view } = host.open({ url: 'https://example.org/page' });
  const opened = [];
  assert.deepStrictEqual(host.external(view, u => opened.push(u)), {});
  assert.deepStrictEqual(opened, ['https://example.org/page']);
  assert.strictEqual(host.external('nope', u => opened.push(u)).err, 'not-found');
  assert.strictEqual(host.devtools(view).err, 'forbidden');
  assert.strictEqual(wc.devtools, 0);
  host.go(view, 'http://localhost:8131/');
  assert.deepStrictEqual(host.devtools(view), {});
  assert.strictEqual(wc.devtools, 1);
  wc.url = 'chrome://settings';                                   // never reached through go(), but external must still refuse it
  assert.strictEqual(host.external(view, u => opened.push(u)).err, 'bad-request');
  assert.strictEqual(opened.length, 1);
});

test('web host: find answers with the counts; an empty query clears', async () => {
  const { host, wc } = fakeHost();
  const { view } = host.open({ url: 'http://127.0.0.1:1/' });
  assert.deepStrictEqual(await host.find(view, 'teszt'), { matches: 3, active: 1 });
  assert.deepStrictEqual(wc.finds[0], ['teszt', undefined]);                      // a new query: no options (explicit findNext:false made Electron stay silent)
  await host.find(view, 'teszt', 'next');
  assert.deepStrictEqual(wc.finds[1], ['teszt', { forward: true, findNext: true }]);
  await host.find(view, 'teszt', 'prev');
  assert.deepStrictEqual(wc.finds[2], ['teszt', { forward: false, findNext: true }]);
  assert.deepStrictEqual(await host.find(view, ''), { matches: 0, active: 0 });
  assert.deepStrictEqual(wc.stops, ['clearSelection']);
  assert.strictEqual((await host.find('nope', 'x')).err, 'not-found');
});

test('pane helpers: restoreList, keyRoute, labels', () => {
  const r = pane.restoreList({ tabs: ['https://a.example/', 'javascript:alert(1)', 'file:///c:/x', 5, 'http://127.0.0.1:1/', 'https://' + 'a'.repeat(600)], active: 1 });
  assert.deepStrictEqual(r, { tabs: ['https://a.example/', 'http://127.0.0.1:1/'], active: 1 });
  assert.deepStrictEqual(pane.restoreList({ tabs: ['https://a.example/'], active: 7 }), { tabs: ['https://a.example/'], active: 0 });
  assert.deepStrictEqual(pane.restoreList(null), { tabs: [], active: 0 });
  assert.strictEqual(pane.restoreList({ tabs: Array.from({ length: 30 }, (_, i) => 'http://127.0.0.1:1/' + i) }).tabs.length, 20);
  const key = (key, o = {}) => pane.keyRoute({ key, ctrlKey: true, ...o });
  assert.deepStrictEqual(['l', 'f', 't', '-', '0', '=', '+', 'x'].map(k => key(k)), ['address', 'find', 'newtab', 'zoomout', 'zoomreset', 'zoomin', 'zoomin', '']);
  assert.strictEqual(pane.keyRoute({ key: 'l', ctrlKey: false }), '');
  assert.strictEqual(pane.keyRoute({ key: 'l', ctrlKey: true, altKey: true }), '');
  assert.strictEqual(pane.percent(1.25), '125%');
  assert.strictEqual(pane.tabLabel({ title: '', url: '' }), 'Új lap');
  assert.strictEqual(pane.tabLabel({ title: 'x'.repeat(100) }).length, 40);
  assert.strictEqual(pane.sizeText(2048), '2 KB');
});
