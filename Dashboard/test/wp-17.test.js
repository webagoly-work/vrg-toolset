// WP-17: web views — navigation table, UA cleaner, download names, permission / download gates against fakes, the fixture server.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
const { EventEmitter } = require('events');
const { isAllowedNav, cleanUA, uniqueName, safeDownloadName, createWebHost } = require('../shell/lib/web.js');
const { webPrefs } = require('../shell/lib/views.js');
const settingsLib = require('../shell/lib/settings.js');
const { start } = require('./fixtures/web-server.js');

test('isAllowedNav: 20 URLs', () => {
  const table = [
    ['http://example.com/', true], ['https://example.com/a?b=1#c', true], ['HTTPS://EXAMPLE.COM', true], ['http://127.0.0.1:8080/x', true],
    ['https://user@example.com/', true], ['http://[::1]:3000/', true],
    ['file:///C:/Windows/win.ini', false], ['javascript:alert(1)', false], ['data:text/html,<b>x</b>', false], ['chrome://settings', false],
    ['devtools://devtools/bundled/inspector.html', false], ['about:blank', false], ['blob:https://example.com/1', false], ['ftp://example.com/', false],
    ['view-source:https://example.com/', false], ['//example.com/', false], ['example.com', false], ['', false], [null, false], ['https://' + 'a'.repeat(5000) + '.com', false],
  ];
  assert.strictEqual(table.length, 20);
  for (const [u, want] of table) assert.strictEqual(isAllowedNav(u), want, String(u).slice(0, 60));
});

test('cleanUA drops the Electron and the app-name token', () => {
  const base = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)';
  const tail = 'Chrome/130.0.0.0 Safari/537.36';
  assert.strictEqual(cleanUA(base + ' vrg-dashboard/1.0.0 ' + tail + ' Electron/33.0.0'), base + ' ' + tail);
  assert.strictEqual(cleanUA(base + ' ' + tail + ' Electron/33.1.2'), base + ' ' + tail);
  assert.strictEqual(cleanUA(base + ' ' + tail), base + ' ' + tail);
});

test('download names: a.txt → a (2).txt, and unsafe names are made safe', () => {
  const taken = new Set(['a.txt']);
  assert.strictEqual(uniqueName('a.txt', n => taken.has(n)), 'a (2).txt');
  taken.add('a (2).txt');
  assert.strictEqual(uniqueName('a.txt', n => taken.has(n)), 'a (3).txt');
  assert.strictEqual(uniqueName('b.txt', n => taken.has(n)), 'b.txt');
  assert.strictEqual(safeDownloadName('..\\..\\evil.exe'), '____evil.exe');
  assert.strictEqual(safeDownloadName('nul'), '_nul');
  assert.strictEqual(safeDownloadName(''), 'download');
});

test('webPrefs: never a preload, extra keys cannot weaken it', () => {
  const p = webPrefs('persist:vrg-mail', { preload: 'x.js', sandbox: false, nodeIntegration: true, contextIsolation: false, webviewTag: true, zoomFactor: 1 });
  assert.strictEqual(p.preload, undefined);
  assert.deepStrictEqual([p.sandbox, p.contextIsolation, p.nodeIntegration, p.webviewTag, p.spellcheck, p.partition], [true, true, false, false, false, 'persist:vrg-mail']);
});

test('settings web.perms: shape is checked', () => {
  const t = settingsLib.KEYS['web.perms'].type;
  assert.ok(t({}) && t({ 'https://a.example': { media: true } }));
  assert.ok(!t({ 'https://a.example': { geolocation: true } }) && !t({ x: { media: 'yes' } }) && !t([]) && !t(null));
  assert.strictEqual(settingsLib.KEYS['web.history.days'].def, 90);
});

// ---- fakes ----
function fakeWc(url) {
  const wc = new EventEmitter();
  Object.assign(wc, { url: '', destroyed: false, loads: [], getURL() { return this.url; }, getTitle: () => 't', isDestroyed() { return this.destroyed; },
    setWindowOpenHandler(f) { this.openHandler = f; }, loadURL(u) { this.loads.push(u); this.url = u; return Promise.resolve(); },
    isLoading: () => false, isCurrentlyAudible: () => false, canGoBack: () => false, canGoForward: () => false });
  return wc;
}
function fakeEnv({ now = () => 0 } = {}) {
  const sessions = {}, destroyed = [], bounds = [];
  let seq = 0;
  const viewsFake = {
    createWeb({ partition, id }) { id = id || 'w' + (++seq); return { id, view: { webContents: fakeWc(), partition } }; },
    destroy(id) { destroyed.push(id); return true; }, setBounds(id, r) { bounds.push([id, r]); return true; },
  };
  const store = {};
  const settings = { get: k => store[k] || {}, set: (k, v) => { store[k] = v; return v; } };
  const getSession = p => sessions[p] || (sessions[p] = Object.assign(new EventEmitter(), {
    getUserAgent: () => 'Mozilla/5.0 Chrome/1.0 Electron/2.0', setUserAgent(u) { this.ua = u; },
    setPermissionRequestHandler(f) { this.onPerm = f; }, setPermissionCheckHandler(f) { this.onCheck = f; }, setDevicePermissionHandler(f) { this.onDevice = f; },
  }));
  const events = [];
  const host = createWebHost({ getViews: () => viewsFake, getSession, settings, emit: (t, d) => events.push([t, d]), now, downloadsDir: () => null, tmpDir: '' });
  return { host, sessions, destroyed, bounds, events, settings, store };
}

test('permissions: fullscreen yes, geolocation / notifications no, media asks once and is remembered', () => {
  const { host, sessions, events } = fakeEnv();
  const { view } = host.open({ url: 'http://127.0.0.1:1/' });
  const ses = sessions['persist:vrg-web'];
  assert.strictEqual(ses.ua, 'Mozilla/5.0 Chrome/1.0');
  const wc = host.webContents(view);
  const ask = (perm, url = 'http://127.0.0.1:1/p') => { let r; ses.onPerm(wc, perm, v => { r = v; }, { requestingUrl: url }); return r; };
  assert.strictEqual(ask('fullscreen'), true);
  assert.strictEqual(ask('geolocation'), false);
  assert.strictEqual(ask('notifications'), false);
  assert.strictEqual(events.filter(e => e[0] === 'ask').length, 0);
  assert.strictEqual(ask('media'), undefined);                                   // pending
  const q = events.find(e => e[0] === 'ask')[1];
  assert.deepStrictEqual([q.view, q.origin, q.perm], [view, 'http://127.0.0.1:1', 'media']);
  assert.strictEqual(ses.onCheck(wc, 'media', 'http://127.0.0.1:1', {}), false);
  assert.deepStrictEqual(host.answer(q.ask, true), {});
  assert.strictEqual(ses.onCheck(wc, 'media', 'http://127.0.0.1:1', {}), true);
  assert.strictEqual(ses.onCheck(wc, 'geolocation', 'http://127.0.0.1:1', {}), false);
  assert.strictEqual(ask('media'), true);                                        // remembered: no second ask
  assert.strictEqual(events.filter(e => e[0] === 'ask').length, 1);
  assert.strictEqual(ses.onDevice(), false);
  assert.strictEqual(host.answer(q.ask, true).err, 'not-found');
});

test('popups open as tabs, http(s) only; the 20-tab cap; closing denies a pending ask', () => {
  const { host, destroyed } = fakeEnv();
  const { view } = host.open({ url: 'http://127.0.0.1:1/' });
  const wc = host.webContents(view);
  assert.deepStrictEqual(wc.openHandler({ url: 'file:///C:/x' }), { action: 'deny' });
  assert.strictEqual(host.ids().length, 1);
  assert.deepStrictEqual(wc.openHandler({ url: 'http://127.0.0.1:1/b' }), { action: 'deny' });
  assert.strictEqual(host.ids().length, 2);
  for (let i = 0; i < 18; i++) assert.ok(host.open({ url: 'http://127.0.0.1:1/' + i }).view);
  assert.strictEqual(host.ids().length, 20);
  assert.strictEqual(host.open({ url: 'http://127.0.0.1:1/x' }).err, 'limit');
  assert.strictEqual(host.open({ url: 'file:///C:/x' }).err, 'bad-request');
  assert.strictEqual(host.open({ url: 'http://127.0.0.1:1/', partition: 'persist:other' }).err, 'bad-request');
  assert.deepStrictEqual(host.close(view), {});
  assert.deepStrictEqual(destroyed, [view]);
  assert.strictEqual(host.close(view).err, 'not-found');
});

test('will-navigate / will-redirect refuse non-http(s)', () => {
  const { host } = fakeEnv();
  const wc = host.webContents(host.open({ url: 'http://127.0.0.1:1/' }).view);
  for (const [u, blocked] of [['file:///C:/Windows/win.ini', true], ['javascript:1', true], ['https://example.com/', false]]) {
    for (const ev of ['will-navigate', 'will-redirect']) {
      let prevented = false; wc.emit(ev, { preventDefault() { prevented = true; } }, u);
      assert.strictEqual(prevented, blocked, ev + ' ' + u);
    }
  }
});

test('a tab hidden for 30 minutes is discarded and comes back with its url when shown', () => {
  let t = 1000;
  const { host, destroyed, events } = fakeEnv({ now: () => t });
  const { view } = host.open({ url: 'http://127.0.0.1:1/keep' });
  assert.strictEqual(host.bounds(view, { x: 0, y: 0, w: 100, h: 100 }), true);
  assert.strictEqual(host.bounds(view, { x: 0, y: 0, w: 0, h: 0 }), true);       // hidden from here
  t += 29 * 60 * 1000; assert.strictEqual(host.sweep(), 0);
  t += 61 * 1000; assert.strictEqual(host.sweep(), 1);
  assert.deepStrictEqual(destroyed, [view]);
  assert.ok(host.has(view) && host.webContents(view) === null);
  assert.strictEqual(events[events.length - 1][1].url, 'http://127.0.0.1:1/keep');
  assert.strictEqual(host.bounds(view, { x: 0, y: 0, w: 50, h: 50 }), true);
  assert.deepStrictEqual(host.webContents(view).loads, ['http://127.0.0.1:1/keep']);
});

test('downloads: asked, "no" cancels and writes nothing, "yes" runs a job and de-dups the name', async () => {
  const dir = path.join(os.tmpdir(), 'VRG', 'desk-test-' + Math.random().toString(36).slice(2, 10));
  const dl = path.join(dir, 'downloads'), tmp = path.join(dir, 'part');
  fs.mkdirSync(dl, { recursive: true });
  try {
    const env = fakeEnv();
    const jobsFake = { list: [], create(j) { const ctx = { progress() {}, cancelled: false }; const p = j.run(ctx); this.list.push(p); return 'j' + this.list.length; }, whenDone(id) { return this.list[+id.slice(1) - 1].then(() => null, () => null); } };
    const events = [];
    const host = createWebHost({ getViews: () => ({ createWeb: () => ({ id: 'w1', view: { webContents: fakeWc() } }), destroy() {}, setBounds() { return true; } }),
      getSession: env.sessions && (p => (env.sessions[p] = env.sessions[p] || Object.assign(new EventEmitter(), { getUserAgent: () => '', setUserAgent() {}, setPermissionRequestHandler() {}, setPermissionCheckHandler() {}, setDevicePermissionHandler() {} }))),
      settings: env.settings, jobs: jobsFake, emit: (t, d) => events.push([t, d]), downloadsDir: () => dl, tmpDir: tmp });
    const { view } = host.open({ url: 'http://127.0.0.1:1/' });
    const ses = env.sessions['persist:vrg-web'];
    const wc = host.webContents(view);
    const item = () => {
      const it = new EventEmitter(); const st = { paused: false, cancelled: false, resumed: false };
      Object.assign(it, { st, getFilename: () => 'a.txt', getTotalBytes: () => 10, getReceivedBytes: () => 10, pause() { st.paused = true; }, resume() { st.resumed = true; },
        setSavePath(p) { it.save = p; }, cancel() { st.cancelled = true; } });
      return it;
    };
    const no = item();
    ses.emit('will-download', {}, no, wc);
    const ev = events.find(e => e[0] === 'download')[1];
    assert.deepStrictEqual([ev.view, ev.name, ev.size], [view, 'a.txt', 10]);
    assert.ok(no.st.paused && no.save.startsWith(tmp));
    host.answer(ev.ask, false);
    assert.ok(no.st.cancelled);
    assert.deepStrictEqual(fs.readdirSync(dl), []);

    for (let i = 0; i < 2; i++) {
      const yes = item();
      ses.emit('will-download', {}, yes, wc);
      const e2 = events.filter(e => e[0] === 'download').pop()[1];
      fs.mkdirSync(tmp, { recursive: true }); fs.writeFileSync(yes.save, '0123456789');
      const r = host.answer(e2.ask, true);
      assert.ok(r.job);
      yes.emit('done', {}, 'completed');
      await jobsFake.list[jobsFake.list.length - 1];
      assert.ok(yes.st.resumed);
    }
    assert.deepStrictEqual(fs.readdirSync(dl).sort(), ['a (2).txt', 'a.txt']);
    assert.strictEqual(fs.readFileSync(path.join(dl, 'a.txt'), 'utf8'), '0123456789');
    await new Promise(r => setTimeout(r, 20));
    assert.deepStrictEqual(fs.readdirSync(tmp), []);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('fixture server: 127.0.0.1 only, the pages the probe needs', async () => {
  const srv = await start();
  try {
    assert.ok(/^http:\/\/127\.0\.0\.1:\d+$/.test(srv.url));
    const get = p => new Promise((res, rej) => http.get(srv.url + p, r => { let b = ''; r.on('data', d => { b += d; }); r.on('end', () => res({ r, b })); }).on('error', rej));
    const root = await get('/');
    assert.ok(/<title>VRG teszt<\/title>/.test(root.b) && /target="_blank"/.test(root.b) && /href="file:\/\/\/C:\/Windows\/win\.ini"/.test(root.b));
    const dl = await get('/dl');
    assert.strictEqual(dl.b.length, 10);
    assert.ok(/attachment/.test(dl.r.headers['content-disposition']));
    assert.ok(/geolocation/.test((await get('/perm')).b));
    assert.strictEqual((await get('/nope')).r.statusCode, 404);
  } finally { await srv.close(); }
});
