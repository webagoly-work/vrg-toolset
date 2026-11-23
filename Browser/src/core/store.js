// store.js — what the VRG Böngésző keeps: bookmarks, history, the reading list (with saved page text for offline reading
// and full-text search), and the settings. One localStorage key per collection under "vrg-bongeszo:v1:"; when storage is
// refused (file://, a private window) it falls back to memory and says so (ok = false), so the page can warn instead of
// losing work silently. Export / import is one JSON document, format "vrg-bongeszo/1". Pure apart from the storage handed in.
//   const st = VB.store.create(window.localStorage)  → { ok, bookmarks, history, reading, settings, … }
(function (root) {
  'use strict';
  const VB = root.VB = root.VB || {};
  if (VB.store) return;

  const PREFIX = 'vrg-bongeszo:v1:';
  const FORMAT = 'vrg-bongeszo/1';
  const LIMITS = { bookmarks: 2000, history: 600, reading: 300, text: 200000, tags: 12, tag: 40, title: 300, note: 2000, url: 2000 };
  const JOB_RE = /^VRG-\d{4}-\d{2}$/;
  const DEFAULTS = {
    engine: 'google', suggest: false, clean: true, theme: 'melyviz', density: 'auto', history: true,
    readerServer: 'http://127.0.0.1:8812', modules: {}, pinned: [],
  };

  const now = () => Date.now();
  const uid = () => now().toString(36) + Math.random().toString(36).slice(2, 8);
  const str = (v, n) => (typeof v === 'string' ? v : v == null ? '' : String(v)).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);
  const isWeb = u => { try { return /^https?:$/.test(new URL(u).protocol); } catch (e) { return false; } };
  const normTags = t => [...new Set((Array.isArray(t) ? t : String(t || '').split(/[,;#]/)).map(x => str(x, LIMITS.tag).toLowerCase()).filter(Boolean))].slice(0, LIMITS.tags);
  const normJob = j => { const s = str(j, 20).toUpperCase(); return JOB_RE.test(s) ? s : ''; };
  // the key a URL is remembered by: no fragment, no trailing slash on the path
  function key(u) {
    try { const x = new URL(u); x.hash = ''; let s = x.href; if (x.pathname !== '/' && s.endsWith('/') && !x.search) s = s.slice(0, -1); return s; } catch (e) { return String(u || ''); }
  }

  function memory() { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; }
  function probe(ls) {
    try { if (!ls) return false; ls.setItem(PREFIX + 'probe', '1'); const ok = ls.getItem(PREFIX + 'probe') === '1'; ls.removeItem(PREFIX + 'probe'); return ok; } catch (e) { return false; }
  }

  function cleanBookmark(b) {
    if (!b || !isWeb(b.url)) return null;
    return { id: str(b.id, 40) || uid(), url: str(b.url, LIMITS.url), title: str(b.title, LIMITS.title) || str(b.url, 80), tags: normTags(b.tags),
      job: normJob(b.job), note: str(b.note, LIMITS.note), added: +b.added || now(), visits: Math.max(0, +b.visits || 0), last: +b.last || 0 };
  }
  function cleanVisit(h) {
    if (!h || !isWeb(h.url)) return null;
    return { url: str(h.url, LIMITS.url), title: str(h.title, LIMITS.title), at: +h.at || now(), count: Math.max(1, +h.count || 1), via: str(h.via, 20) };
  }
  function cleanReading(r) {
    if (!r || !isWeb(r.url)) return null;
    return { id: str(r.id, 40) || uid(), url: str(r.url, LIMITS.url), title: str(r.title, LIMITS.title) || str(r.url, 80), note: str(r.note, LIMITS.note),
      job: normJob(r.job), tags: normTags(r.tags), added: +r.added || now(), read: !!r.read,
      text: typeof r.text === 'string' ? r.text.slice(0, LIMITS.text) : '', excerpt: str(r.excerpt, 400), site: str(r.site, 120), saved: +r.saved || 0 };
  }

  function create(storage) {
    const ok = probe(storage);
    const ls = ok ? storage : memory();
    const listeners = new Set();
    const read = (name, def) => { try { const v = JSON.parse(ls.getItem(PREFIX + name)); return v == null ? def : v; } catch (e) { return def; } };
    let full = false;
    const write = (name, v) => {
      try { ls.setItem(PREFIX + name, JSON.stringify(v)); full = false; return true; } catch (e) { full = true; return false; }
    };
    const emit = what => { for (const f of listeners) { try { f(what); } catch (e) {} } };

    let bookmarks = (read('bookmarks', []) || []).map(cleanBookmark).filter(Boolean);
    let history = (read('history', []) || []).map(cleanVisit).filter(Boolean);
    let reading = (read('reading', []) || []).map(cleanReading).filter(Boolean);
    let settings = Object.assign({}, DEFAULTS, read('settings', {}));
    const saveB = () => { write('bookmarks', bookmarks); emit('bookmarks'); };
    const saveH = () => { write('history', history); emit('history'); };
    const saveR = () => { const w = write('reading', reading); emit('reading'); return w; };

    const api = {
      ok, FORMAT, LIMITS, key,
      isFull: () => full,
      on(f) { listeners.add(f); return () => listeners.delete(f); },

      // ---- bookmarks
      bookmarks: () => bookmarks.slice(),
      bookmark: url => bookmarks.find(b => key(b.url) === key(url)) || null,
      addBookmark(b) {
        const c = cleanBookmark(b);
        if (!c) return null;
        const old = api.bookmark(c.url);
        if (old) { Object.assign(old, { title: c.title || old.title, tags: c.tags.length ? c.tags : old.tags, job: c.job || old.job, note: c.note || old.note }); saveB(); return old; }
        if (bookmarks.length >= LIMITS.bookmarks) return null;
        bookmarks.unshift(c); saveB(); return c;
      },
      updateBookmark(id, patch) {
        const b = bookmarks.find(x => x.id === id);
        if (!b) return null;
        const c = cleanBookmark(Object.assign({}, b, patch, { id: b.id, added: b.added }));
        if (!c) return null;
        Object.assign(b, c); saveB(); return b;
      },
      removeBookmark(id) { const n = bookmarks.length; bookmarks = bookmarks.filter(b => b.id !== id); if (bookmarks.length !== n) saveB(); return bookmarks.length !== n; },
      tags() { const m = new Map(); for (const x of bookmarks.concat(reading)) for (const t of x.tags || []) m.set(t, (m.get(t) || 0) + 1); return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'hu')); },
      jobs() { const m = new Map(); for (const x of bookmarks.concat(reading)) if (x.job) m.set(x.job, (m.get(x.job) || 0) + 1); return [...m].sort((a, b) => b[0].localeCompare(a[0])); },

      // ---- history (what was opened through the VRG Böngésző; the host's own browser keeps its own)
      history: () => history.slice(),
      visit(v) {
        if (!settings.history) return null;
        const c = cleanVisit(v);
        if (!c) return null;
        const k = key(c.url);
        const old = history.find(h => key(h.url) === k);
        if (old) { history = history.filter(h => h !== old); c.count = old.count + 1; c.title = c.title || old.title; }
        history.unshift(c);
        if (history.length > LIMITS.history) history.length = LIMITS.history;
        const b = api.bookmark(c.url);
        if (b) { b.visits++; b.last = c.at; write('bookmarks', bookmarks); }
        saveH(); return c;
      },
      removeVisit(url) { const k = key(url); const n = history.length; history = history.filter(h => key(h.url) !== k); if (n !== history.length) saveH(); },
      clearHistory(since) { history = since ? history.filter(h => h.at < since) : []; saveH(); },

      // ---- the reading list
      reading: () => reading.slice(),
      readingItem: id => reading.find(r => r.id === id) || null,
      addReading(r) {
        const c = cleanReading(r);
        if (!c) return null;
        const old = reading.find(x => key(x.url) === key(c.url));
        if (old) { Object.assign(old, { title: c.title || old.title, note: c.note || old.note, job: c.job || old.job, tags: c.tags.length ? c.tags : old.tags }); if (c.text) Object.assign(old, { text: c.text, excerpt: c.excerpt, site: c.site, saved: now() }); return saveR() ? old : null; }
        if (reading.length >= LIMITS.reading) return null;
        if (c.text && !c.saved) c.saved = now();
        reading.unshift(c);
        if (!saveR()) { reading.shift(); return null; }                 // full storage: the item is not half-kept
        return c;
      },
      updateReading(id, patch) {
        const r = reading.find(x => x.id === id);
        if (!r) return null;
        const c = cleanReading(Object.assign({}, r, patch, { id: r.id, added: r.added }));
        if (!c) return null;
        Object.assign(r, c); saveR(); return r;
      },
      removeReading(id) { const n = reading.length; reading = reading.filter(r => r.id !== id); if (n !== reading.length) saveR(); },

      // ---- settings
      settings: () => Object.assign({}, settings),
      set(k, v) { if (!(k in DEFAULTS)) return false; settings[k] = v; write('settings', settings); emit('settings'); return true; },
      moduleOn: (id, def) => (id in settings.modules ? !!settings.modules[id] : def !== false),
      setModule(id, on) { settings.modules = Object.assign({}, settings.modules, { [id]: !!on }); write('settings', settings); emit('settings'); },

      // ---- export / import / wipe
      exportAll() {
        return { format: FORMAT, exported: new Date().toISOString(), bookmarks, reading, history, settings: Object.assign({}, settings) };
      },
      importAll(doc, mode) {
        if (!doc || doc.format !== FORMAT) return { ok: false, hu: 'Ez nem VRG Böngésző mentés (format: ' + FORMAT + ').' };
        const add = { bookmarks: 0, reading: 0, history: 0 };
        if (mode === 'replace') { bookmarks = []; reading = []; history = []; }
        for (const b of (doc.bookmarks || []).slice(0, LIMITS.bookmarks)) { const c = cleanBookmark(b); if (c && !api.bookmark(c.url) && bookmarks.length < LIMITS.bookmarks) { bookmarks.push(c); add.bookmarks++; } }
        for (const r of (doc.reading || []).slice(0, LIMITS.reading)) { const c = cleanReading(r); if (c && !reading.some(x => key(x.url) === key(c.url)) && reading.length < LIMITS.reading) { reading.push(c); add.reading++; } }
        for (const h of (doc.history || []).slice(0, LIMITS.history)) { const c = cleanVisit(h); if (c && !history.some(x => key(x.url) === key(c.url))) { history.push(c); add.history++; } }
        history.sort((a, b) => b.at - a.at); if (history.length > LIMITS.history) history.length = LIMITS.history;
        write('bookmarks', bookmarks); write('history', history); write('reading', reading);
        emit('bookmarks'); emit('history'); emit('reading');
        return { ok: true, added: add, hu: 'Betöltve: ' + add.bookmarks + ' könyvjelző, ' + add.reading + ' olvasnivaló, ' + add.history + ' előzmény.' };
      },
      wipe() { bookmarks = []; history = []; reading = []; settings = Object.assign({}, DEFAULTS); for (const n of ['bookmarks', 'history', 'reading', 'settings']) { try { ls.removeItem(PREFIX + n); } catch (e) {} } emit('bookmarks'); emit('history'); emit('reading'); emit('settings'); },
      usage() { let n = 0; for (const k of ['bookmarks', 'history', 'reading', 'settings']) { const v = ls.getItem(PREFIX + k); n += v ? v.length * 2 : 0; } return n; },
    };
    return api;
  }

  const api = { create, key, normJob, normTags, JOB_RE, DEFAULTS, FORMAT, PREFIX };
  VB.store = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
