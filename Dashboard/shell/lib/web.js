// web.js — the web tabs' engine (WP-17): isolated WebContentsViews, permission and download gates, navigation guards.
//   const web = createWebHost({ getViews, getSession, settings, jobs, emit, downloadsDir, tmpDir, log });
//   web.open({ url, partition? }) → { ok, view } · nav(view, cmd) · close(view) · answer(ask, allow) · bounds(view, rect) · sweep() · list()
// Events (emit(type, data)): 'state' {view,url,title,canBack,canFwd,loading,audible} · 'ask' {ask,view,origin,perm} · 'download' {ask,view,name,size}
// Rules (CONTRACT §4.3): no preload (views.webPrefs), http/https only, certificate errors never overridden, permissions denied unless listed,
// downloads only after the user said yes. Electron objects are passed in, so node --test can load this file with fakes.
'use strict';
const nodeFs = require('fs'), nodePath = require('path');
const { isSafeName } = require('./names.js');

const PARTITIONS = ['persist:vrg-web', 'persist:vrg-mail'];
const MAX_TABS = 20;
const DISCARD_MS = 30 * 60 * 1000;
const ASKABLE = ['media', 'clipboard-sanitized-write'];
const ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5];

const NO_ASK = { ok: false, err: 'not-found', hu: 'Nincs ilyen kérdés.' };
const NO_VIEW = { ok: false, err: 'not-found', hu: 'Nincs ilyen lap.' };

// navigation: http / https only (CONTRACT §3); file:, javascript:, data:, chrome:, devtools:, about: and everything else is refused
function isAllowedNav(u) {
  if (typeof u !== 'string' || !u.length || u.length > 4096) return false;
  try { const p = new URL(u).protocol; return p === 'http:' || p === 'https:'; } catch (e) { return false; }
}

// the session's default UA without the Electron token and the app-name token (Electron puts the app token right before Chrome/)
function cleanUA(ua) {
  return String(ua || '')
    .replace(/\s+Electron\/\S+/g, '')
    .replace(/\s+[^\s/()]+\/\S+(?=\s+Chrome\/)/g, '')
    .trim();
}

// a.txt → a (2).txt → a (3).txt …; `exists(name)` tells whether a candidate is taken
function numbered(name, n) {
  if (n <= 1) return name;
  const ext = nodePath.extname(name), base = name.slice(0, name.length - ext.length);
  return base + ' (' + n + ')' + ext;
}
function uniqueName(name, exists) {
  for (let n = 1; n < 1000; n++) { const c = numbered(name, n); if (!exists(c)) return c; }
  throw new Error('web: no free name for ' + name);
}

// a file name a server proposed → a safe basename (lib/names.js rule), else 'download'
function safeDownloadName(raw) {
  let s = String(raw || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/\.\.+/g, '_').replace(/[. ]+$/, '').slice(0, 200);
  if (!s || !isSafeName(s)) s = s ? '_' + s : '';
  return s && isSafeName(s) ? s : 'download';
}

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function errorPage(url, desc) {
  const html = '<!doctype html><meta charset="utf-8"><title>Hiba</title><body data-role="web-error" style="font:16px sans-serif;padding:2em">'
    + '<h2>Az oldal nem tölthető be</h2><p><i>This page cannot be loaded.</i></p><p>' + esc(url) + '</p><p>' + esc(desc) + '</p></body>';
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
}

function createWebHost({
  getViews, getSession, settings, jobs = null, emit = () => {}, downloadsDir = () => null, tmpDir = '', log = () => {},
  fs = nodeFs, now = Date.now, rand = () => Math.random().toString(36).slice(2, 10),
}) {
  const tabs = new Map();                                          // view id → { id, partition, url, home, title, discarded, hiddenSince, failedUrl }
  const asks = new Map();                                          // ask id → { kind, view, ... }
  const listeners = [];                                            // in-process observers (the selftest)
  const prepared = new Set();                                      // partitions whose session is set up
  let askSeq = 0;

  const fire = (type, data) => { for (const l of listeners) { try { l(type, data); } catch (e) {} } try { emit(type, data); } catch (e) {} };
  const views = () => getViews();
  const wcOf = t => { const v = t.view; const wc = v && v.webContents; return wc && !wc.isDestroyed() ? wc : null; };
  const tabFor = wc => { for (const t of tabs.values()) if (t.view && t.view.webContents === wc) return t; return null; };

  // ---- permissions (remembered per origin in settings web.perms) ----
  const originOf = u => { try { return new URL(u).origin; } catch (e) { return ''; } };
  function recall(origin, perm) {
    try { const all = settings.get('web.perms'); const v = all && all[origin] && all[origin][perm]; return typeof v === 'boolean' ? v : undefined; } catch (e) { return undefined; }
  }
  function remember(origin, perm, allow) {
    if (!origin || origin === 'null') return;
    try {
      const all = JSON.parse(JSON.stringify(settings.get('web.perms') || {}));
      all[origin] = { ...(all[origin] || {}), [perm]: allow === true };
      settings.set('web.perms', all);
    } catch (e) { log('web.perms not saved'); }
  }

  function prepare(partition) {
    if (prepared.has(partition)) return;
    prepared.add(partition);
    const ses = getSession(partition);
    try { ses.setUserAgent(cleanUA(ses.getUserAgent())); } catch (e) {}
    ses.setPermissionRequestHandler((wc, perm, cb, details) => {
      if (perm === 'fullscreen') return cb(true);
      if (!ASKABLE.includes(perm)) return cb(false);
      const origin = originOf(details && details.requestingUrl || (wc && wc.getURL && wc.getURL()));
      const t = tabFor(wc);
      if (!origin || !t) return cb(false);
      const known = recall(origin, perm);
      if (known !== undefined) return cb(known);
      const ask = 'a' + (++askSeq);
      asks.set(ask, { kind: 'perm', view: t.id, origin, perm, cb });
      fire('ask', { ask, view: t.id, origin, perm });
    });
    ses.setPermissionCheckHandler((wc, perm, origin) => {
      if (perm === 'fullscreen') return true;
      if (!ASKABLE.includes(perm)) return false;
      return recall(originOf(origin), perm) === true;
    });
    ses.setDevicePermissionHandler(() => false);
    ses.on('will-download', (ev, item, wc) => onDownload(item, tabFor(wc)));
  }

  // ---- downloads: paused until the user says yes; written next to nothing until then (a temp part file outside the downloads root) ----
  function onDownload(item, t) {
    const dir = downloadsDir();
    if (!t || !dir || !tmpDir) { item.cancel(); return; }
    item.pause();
    const name = safeDownloadName(item.getFilename());
    const part = nodePath.join(tmpDir, 'dl-' + rand() + '.part');
    try { fs.mkdirSync(tmpDir, { recursive: true }); } catch (e) {}
    item.setSavePath(part);                                        // no save dialog; the real target is chosen after the answer
    const ask = 'a' + (++askSeq);
    // a small body can finish while paused, so 'done' is watched from the start, not from the answer
    const finished = new Promise((res, rej) => item.once('done', (e, state) => (state === 'completed' ? res() : rej(new Error(state)))));
    finished.catch(() => {});
    asks.set(ask, { kind: 'download', view: t.id, item, name, part, finished });
    fire('download', { ask, view: t.id, name, size: Math.max(0, item.getTotalBytes() || 0) });
  }
  const dropPart = part => { try { fs.unlinkSync(part); } catch (e) {} };

  function startDownload(a) {
    const { item, name, part, finished } = a;
    const run = async ctx => {
      item.on('updated', () => ctx.progress(item.getReceivedBytes(), item.getTotalBytes()));
      item.resume();
      const watch = setInterval(() => { if (ctx.cancelled) item.cancel(); }, 300);
      try { await finished; } finally { clearInterval(watch); }
      const dir = downloadsDir();
      if (!dir) throw new Error('no downloads root');
      fs.mkdirSync(dir, { recursive: true });
      let target = '';
      for (let i = 0; i < 50 && !target; i++) {
        const c = nodePath.join(dir, uniqueName(name, n => fs.existsSync(nodePath.join(dir, n))));
        try { fs.copyFileSync(part, c, fs.constants.COPYFILE_EXCL); target = c; } catch (e) { if (e.code !== 'EEXIST') throw e; }
      }
      if (!target) throw new Error('no free name');
    };
    const cleanup = () => dropPart(part);
    const id = jobs ? jobs.create({ kind: 'download', hu: 'Letöltés: ' + name, run }) : '';
    if (!jobs) { item.cancel(); cleanup(); return ''; }
    jobs.whenDone(id).then(cleanup, cleanup);
    return id;
  }

  function answer(ask, allow) {
    const a = asks.get(ask);
    if (!a) return { ...NO_ASK };
    asks.delete(ask);
    if (a.kind === 'perm') {
      remember(a.origin, a.perm, allow === true);
      a.cb(allow === true);
      return {};
    }
    if (allow === true) { const job = startDownload(a); return job ? { job } : {}; }
    try { a.item.cancel(); } catch (e) {}
    dropPart(a.part);
    return {};
  }
  function dropAsks(view) {
    for (const [k, a] of [...asks]) {
      if (a.view !== view) continue;
      asks.delete(k);
      if (a.kind === 'perm') a.cb(false);
      else { try { a.item.cancel(); } catch (e) {} dropPart(a.part); }
    }
  }

  // ---- tabs ----
  function state(t) {
    const wc = wcOf(t);
    let url = t.url, title = t.title, canBack = false, canFwd = false, loading = false, audible = false;
    if (wc) {
      url = wc.getURL() || url; title = wc.getTitle() || title;
      const h = wc.navigationHistory;
      canBack = h ? h.canGoBack() : wc.canGoBack();
      canFwd = h ? h.canGoForward() : wc.canGoForward();
      loading = wc.isLoading(); audible = wc.isCurrentlyAudible();
      if (/^data:/.test(url) && t.failedUrl) url = t.failedUrl;
      t.url = url; t.title = title;
    }
    return { view: t.id, url, title, canBack, canFwd, loading, audible };
  }
  const push = t => { if (tabs.get(t.id) === t) fire('state', state(t)); };

  function guard(ev, u) { if (!isAllowedNav(u)) ev.preventDefault(); }

  function attach(t) {
    const wc = wcOf(t);
    if (!wc) return;
    wc.setWindowOpenHandler(d => {
      if (isAllowedNav(d.url)) { try { open({ url: d.url, partition: t.partition }); } catch (e) { log('popup tab failed'); } }
      return { action: 'deny' };
    });
    wc.on('will-navigate', (ev, u) => guard(ev, u));
    wc.on('will-redirect', (ev, u) => guard(ev, u));
    wc.on('will-frame-navigate', (ev) => { if (ev && ev.url !== undefined && !isAllowedNav(ev.url) && !/^about:(blank|srcdoc)$/.test(ev.url)) ev.preventDefault(); });
    wc.on('did-start-navigation', (ev, u, inPlace, isMain) => { if (isMain && !/^data:/.test(u || '')) t.failedUrl = ''; });
    wc.on('did-fail-load', (ev, code, desc, u, isMain) => {
      if (!isMain || code === -3 || /^data:/.test(u || '')) return;
      t.failedUrl = u;
      wc.loadURL(errorPage(u, desc)).catch(() => {});
    });
    for (const e of ['did-navigate', 'did-navigate-in-page', 'page-title-updated', 'did-start-loading', 'did-stop-loading', 'audio-state-changed']) wc.on(e, () => push(t));
  }

  function load(t, url) { const wc = wcOf(t); if (wc) wc.loadURL(url).catch(() => {}); }   // an aborted load (a download, a blocked redirect) is not an error

  function open({ url, partition = 'persist:vrg-web' } = {}) {
    if (!isAllowedNav(url)) return { ok: false, err: 'bad-request', hu: 'Csak http és https cím nyitható meg.' };
    if (!PARTITIONS.includes(partition)) return { ok: false, err: 'bad-request', hu: 'Ismeretlen munkamenet.' };
    if (tabs.size >= MAX_TABS) return { ok: false, err: 'limit', hu: 'Legfeljebb ' + MAX_TABS + ' lap lehet nyitva.' };
    prepare(partition);
    const made = views().createWeb({ partition });
    if (!made) return { ok: false, err: 'error', hu: 'A lap nem hozható létre.' };
    const t = { id: made.id, partition, url, home: url, title: '', view: made.view, discarded: false, hiddenSince: now(), failedUrl: '' };
    tabs.set(t.id, t);
    attach(t);
    load(t, url);
    fire('state', state(t));
    return { view: t.id };
  }

  function revive(t) {
    const made = views().createWeb({ partition: t.partition, id: t.id });
    if (!made) return false;
    t.view = made.view; t.discarded = false; t.failedUrl = '';
    attach(t);
    load(t, t.url);
    return true;
  }
  function discard(t) {
    if (t.discarded) return;
    const wc = wcOf(t);
    if (wc) { t.url = (/^data:/.test(wc.getURL()) && t.failedUrl) || wc.getURL() || t.url; t.title = wc.getTitle() || t.title; }
    dropAsks(t.id);
    views().destroy(t.id);
    t.view = null; t.discarded = true;
    fire('state', state(t));
  }
  // a tab hidden for 30 minutes is discarded: the view goes, {url,title} stay, bounds() recreates it
  function sweep() {
    let n = 0;
    for (const t of tabs.values()) if (!t.discarded && t.hiddenSince && now() - t.hiddenSince >= DISCARD_MS) { discard(t); n++; }
    return n;
  }

  function bounds(id, rect) {
    const t = tabs.get(id);
    if (!t) return false;
    const show = !!rect && rect.w > 0 && rect.h > 0;
    if (show) { t.hiddenSince = 0; if (t.discarded && !revive(t)) return false; }
    else if (!t.hiddenSince) t.hiddenSince = now();
    if (t.discarded) return true;
    return views().setBounds(id, rect);
  }

  function nav(id, cmd) {
    const t = tabs.get(id);
    if (!t) return { ...NO_VIEW };
    if (t.discarded && !revive(t)) return { ok: false, err: 'error', hu: 'A lap nem hozható létre.' };
    const wc = wcOf(t);
    if (!wc) return { ...NO_VIEW };
    const h = wc.navigationHistory;
    if (cmd === 'back') { if (h ? h.canGoBack() : wc.canGoBack()) (h ? h.goBack() : wc.goBack()); }
    else if (cmd === 'fwd') { if (h ? h.canGoForward() : wc.canGoForward()) (h ? h.goForward() : wc.goForward()); }
    else if (cmd === 'reload') { if (t.failedUrl) load(t, t.failedUrl); else wc.reload(); }
    else if (cmd === 'stop') wc.stop();
    else if (cmd === 'home') load(t, t.home);
    else return { ok: false, err: 'bad-request', hu: 'Ismeretlen parancs.' };
    return {};
  }

  function close(id) {
    const t = tabs.get(id);
    if (!t) return { ...NO_VIEW };
    dropAsks(id);
    tabs.delete(id);
    if (!t.discarded) views().destroy(id);
    return {};
  }
  function closeAll() { for (const id of [...tabs.keys()]) close(id); }

  // ---- WP-18: omnibox navigation, find, zoom, mute, external browser, DevTools (localhost only) ----
  function go(id, url) {
    const t = tabs.get(id);
    if (!t) return { ...NO_VIEW };
    if (!isAllowedNav(url)) return { ok: false, err: 'bad-request', hu: 'Csak http és https cím nyitható meg.' };
    if (t.discarded) { t.url = url; t.failedUrl = ''; if (!revive(t)) return { ok: false, err: 'error', hu: 'A lap nem hozható létre.' }; return {}; }
    load(t, url);
    return {};
  }

  // find in page: q '' clears. dir 'next' | 'prev' steps through the hits of the same q; the answer carries the counts
  function find(id, q, dir) {
    const t = tabs.get(id);
    const wc = t && wcOf(t);
    if (!wc) return Promise.resolve({ ...NO_VIEW });
    if (!q) { wc.stopFindInPage('clearSelection'); return Promise.resolve({ matches: 0, active: 0 }); }
    return new Promise(res => {
      let reqId = -1, done = false;
      const finish = r => { if (done) return; done = true; wc.removeListener('found-in-page', onFound); clearTimeout(to); res(r); };
      const onFound = (ev, r) => { if (r && r.requestId === reqId && r.finalUpdate) finish({ matches: r.matches, active: r.activeMatchOrdinal }); };
      const to = setTimeout(() => finish({ matches: 0, active: 0 }), 2000);
      wc.on('found-in-page', onFound);
      const same = t.findQ === q && (dir === 'next' || dir === 'prev');
      t.findQ = q;
      reqId = same ? wc.findInPage(q, { forward: dir !== 'prev', findNext: true }) : wc.findInPage(q);   // a new query starts from the top
    });
  }

  // z: a factor 0.25 … 5, or 'in' | 'out' | 'reset'
  function zoom(id, z) {
    const t = tabs.get(id);
    const wc = t && wcOf(t);
    if (!wc) return { ...NO_VIEW };
    const cur = wc.getZoomFactor();
    let f;
    if (z === 'reset') f = 1;
    else if (z === 'in') f = ZOOM_STEPS.find(s => s > cur + 0.001) || ZOOM_STEPS[ZOOM_STEPS.length - 1];
    else if (z === 'out') f = [...ZOOM_STEPS].reverse().find(s => s < cur - 0.001) || ZOOM_STEPS[0];
    else if (typeof z === 'number' && Number.isFinite(z)) f = Math.min(5, Math.max(0.25, z));
    else return { ok: false, err: 'bad-request', hu: 'Érvénytelen nagyítás.' };
    wc.setZoomFactor(f);
    return { zoom: f };
  }

  function mute(id, muted) {
    const t = tabs.get(id);
    const wc = t && wcOf(t);
    if (!wc) return { ...NO_VIEW };
    wc.setAudioMuted(muted === true);
    push(t);
    return { muted: wc.isAudioMuted() };
  }

  // the tab's page in the user's own browser (http / https only)
  function external(id, openExternal) {
    const t = tabs.get(id);
    if (!t) return { ...NO_VIEW };
    const u = state(t).url;
    if (!isAllowedNav(u)) return { ok: false, err: 'bad-request', hu: 'Csak http és https cím nyitható meg.' };
    if (typeof openExternal !== 'function') return { ok: false, err: 'error', hu: 'A külső böngésző nem érhető el.' };
    openExternal(u);
    return {};
  }

  // DevTools only for a localhost page (our own local servers)
  const isLocalUrl = u => { try { const h = new URL(u).hostname; return h === 'localhost' || h === '127.0.0.1' || h === '[::1]'; } catch (e) { return false; } };
  function devtools(id) {
    const t = tabs.get(id);
    const wc = t && wcOf(t);
    if (!wc) return { ...NO_VIEW };
    if (!isLocalUrl(state(t).url)) return { ok: false, err: 'forbidden', hu: 'A fejlesztői eszközök csak helyi oldalakon érhetők el.' };
    wc.openDevTools({ mode: 'detach' });
    return {};
  }

  // certificate errors are never overridden: wire to app.on('certificate-error', web.certError)
  function certError(ev, wc, url, error, cert, cb) { if (ev && ev.preventDefault) ev.preventDefault(); cb(false); }

  return {
    open, createTab: open, nav, go, find, zoom, mute, external, devtools, close, closeAll, answer, bounds, sweep, certError,
    state: id => { const t = tabs.get(id); return t ? state(t) : null; },
    has: id => tabs.has(id), ids: () => [...tabs.keys()], list: () => [...tabs.values()].map(state),
    webContents: id => { const t = tabs.get(id); return t ? wcOf(t) : null; },
    downloadsDir: () => downloadsDir(), on: cb => { listeners.push(cb); },
  };
}

module.exports = { createWebHost, isAllowedNav, ZOOM_STEPS, cleanUA, uniqueName, safeDownloadName, errorPage, PARTITIONS, MAX_TABS, DISCARD_MS };
