// store.js — what the VRG Böngésző keeps on this device (one origin). Since T1 (BRW-Q01) the bookmarks and the history are
// `vrg.web-links` v1 (src/core/links.js), the same rows as the VRG Asztal's web.json and the Data Vault's browser-kit;
// the work line's own fields ride beside them: tags, job code and note per URL (meta), the reading list with its saved
// text, the pinned tiles, the settings. When a master exists (the Asztal's web.json, through src/core/sync.js) every
// change is also an op in the outbox, and each answer from the master replaces the local links with
// master + the ops it has not seen yet (links.apply, idempotent).
// localStorage under "vrg-bongeszo:v1:"; refused storage (file://, a private window) falls back to memory, ok = false.
//   const st = VB.store.create(window.localStorage)  → { ok, bookmarks, history, visit, reading, settings, exportAll, … }
(function (root) {
  'use strict';
  const VB = root.VB = root.VB || {};
  if (VB.store) return;
  const L = VB.links || (typeof require === 'function' ? require('./links.js') : null);

  const PREFIX = 'vrg-bongeszo:v1:';
  const OLD_FORMAT = 'vrg-bongeszo/1';                       // the first release's own export (2026-11-23 morning): still imported
  const LIMITS = { bookmarks: L.MAX_BOOKMARKS, history: L.MAX_HISTORY, reading: 300, text: 200000, tags: 12, tag: 40, title: 300, note: 2000, url: 2000, outbox: 2000 };
  const JOB_RE = /^VRG-\d{4}-\d{2}$/;
  const DEFAULTS = {
    engine: 'google', engineChosen: false, suggest: false, clean: true, theme: 'melyviz', density: 'auto', history: true,
    readerServer: 'http://127.0.0.1:8812', modules: {}, pinned: [],
  };

  const now = () => Date.now();
  const uid = () => now().toString(36) + Math.random().toString(36).slice(2, 8);
  const str = (v, n) => (typeof v === 'string' ? v : v == null ? '' : String(v)).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);
  const isWeb = u => L.isWebUrl(u) && u.length <= LIMITS.url;
  const normTags = t => [...new Set((Array.isArray(t) ? t : String(t || '').split(/[,;#]/)).map(x => str(x, LIMITS.tag).toLowerCase()).filter(Boolean))].slice(0, LIMITS.tags);
  const normJob = j => { const s = str(j, 20).toUpperCase(); return JOB_RE.test(s) ? s : ''; };
  // the key a URL is remembered by: no fragment, no trailing slash on the path (for "is this bookmarked?")
  function key(u) {
    try { const x = new URL(u); x.hash = ''; let s = x.href; if (x.pathname !== '/' && s.endsWith('/') && !x.search) s = s.slice(0, -1); return s; } catch (e) { return String(u || ''); }
  }
  function cleanMeta(m) {
    const o = { tags: normTags(m && m.tags), job: normJob(m && m.job), note: str(m && m.note, LIMITS.note) };
    return o.tags.length || o.job || o.note ? o : null;
  }
  function cleanReading(r) {
    if (!r || !isWeb(r.url)) return null;
    return { id: str(r.id, 40) || uid(), url: str(r.url, LIMITS.url), title: str(r.title, LIMITS.title) || str(r.url, 80), note: str(r.note, LIMITS.note),
      job: normJob(r.job), tags: normTags(r.tags), added: +r.added || now(), read: !!r.read,
      text: typeof r.text === 'string' ? r.text.slice(0, LIMITS.text) : '', excerpt: str(r.excerpt, 400), site: str(r.site, 120), saved: +r.saved || 0 };
  }

  function memory() { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; }
  function probe(ls) {
    try { if (!ls) return false; ls.setItem(PREFIX + 'probe', '1'); const ok = ls.getItem(PREFIX + 'probe') === '1'; ls.removeItem(PREFIX + 'probe'); return ok; } catch (e) { return false; }
  }

  function create(storage) {
    const ok = probe(storage);
    const ls = ok ? storage : memory();
    const listeners = new Set();
    const read = (name, def) => { try { const v = JSON.parse(ls.getItem(PREFIX + name)); return v == null ? def : v; } catch (e) { return def; } };
    let full = false;
    const write = (name, v) => { try { ls.setItem(PREFIX + name, JSON.stringify(v)); full = false; return true; } catch (e) { full = true; return false; } };
    const emit = what => { for (const f of listeners) { try { f(what); } catch (e) {} } };

    migrate();
    let links = (() => { try { return L.read(read('links', L.empty())); } catch (e) { return L.empty(); } })();
    let meta = read('meta', {}) || {};
    let reading = (read('reading', []) || []).map(cleanReading).filter(Boolean);
    let settings = Object.assign({}, DEFAULTS, read('settings', {}));
    let outbox = L.cleanOps(read('outbox', []));
    // once a master has answered on this origin (ever), every change is also an op in the outbox, from the first moment of
    // each later session; only the very first contact uploads what the master lacks (later, the master's deletions win)
    let synced = read('master', null) != null;

    const saveLinks = () => { write('links', links); emit('links'); };
    const saveMeta = () => write('meta', meta);
    const saveR = () => { const w = write('reading', reading); emit('reading'); return w; };
    function op(o) {
      if (!synced) return;
      outbox.push(o);
      if (outbox.length > LIMITS.outbox) outbox.splice(0, outbox.length - LIMITS.outbox);
      write('outbox', outbox);
      emit('outbox');
    }

    // the first release kept { id, url, title, tags, job, note, added, visits } bookmarks and a de-duplicated history
    function migrate() {
      const oldB = read('bookmarks', null), oldH = read('history', null);
      if (!oldB && !oldH) return;
      if (ls.getItem(PREFIX + 'links') == null) {
        const m = read('meta', {}) || {}, ids = {};
        const bookmarks = (oldB || []).filter(b => b && isWeb(b.url)).map(b => { ids[b.id] = b.url; const c = cleanMeta(b); if (c) m[b.url] = c; return { url: b.url, title: str(b.title, LIMITS.title), at: +b.added || 0 }; });
        const history = (oldH || []).filter(h => h && isWeb(h.url)).map(h => ({ url: h.url, title: str(h.title, LIMITS.title), at: +h.at || 0 }));
        write('links', L.read({ bookmarks, history }));
        write('meta', m);
        const s = read('settings', null);
        if (s && Array.isArray(s.pinned)) { s.pinned = s.pinned.map(p => ids[p] || p).filter(isWeb); write('settings', s); }
      }
      ls.removeItem(PREFIX + 'bookmarks'); ls.removeItem(PREFIX + 'history');
    }

    const visitsOf = () => { const c = new Map(); for (const h of links.history) c.set(key(h.url), (c.get(key(h.url)) || 0) + 1); return c; };
    const asBookmark = (b, counts) => Object.assign({ id: b.url, url: b.url, title: b.title || b.url, added: b.at, tags: [], job: '', note: '' },
      meta[b.url] || {}, { visits: counts ? counts.get(key(b.url)) || 0 : 0 });

    const api = {
      ok, FORMAT: L.FORMAT, LIMITS, key,
      isFull: () => full,
      on(f) { listeners.add(f); return () => listeners.delete(f); },

      // ---- bookmarks (id = the URL, as in web.json)
      bookmarks() { const c = visitsOf(); return links.bookmarks.slice().reverse().map(b => asBookmark(b, c)); },
      bookmark(url) { const k = key(url); const b = links.bookmarks.find(x => key(x.url) === k); return b ? asBookmark(b, visitsOf()) : null; },
      addBookmark(b) {
        if (!b || !isWeb(b.url)) return null;
        const old = links.bookmarks.find(x => key(x.url) === key(b.url));
        const url = old ? old.url : b.url, title = str(b.title, LIMITS.title);
        if (!old) {
          if (links.bookmarks.length >= LIMITS.bookmarks) return null;
          links.bookmarks.push({ url, title, at: now() });
          op({ op: 'bookmark', url, title, at: now() });
        } else if (title && !old.title) old.title = title;
        const m = cleanMeta({ tags: normTags(b.tags).length ? b.tags : (meta[url] || {}).tags, job: normJob(b.job) || (meta[url] || {}).job, note: str(b.note, LIMITS.note) || (meta[url] || {}).note });
        if (m) meta[url] = m;
        saveMeta(); saveLinks();
        return api.bookmark(url);
      },
      updateBookmark(id, patch) {
        const b = links.bookmarks.find(x => x.url === id);
        if (!b) return null;
        if (patch.title != null) b.title = str(patch.title, LIMITS.title) || b.title;
        const m = cleanMeta(Object.assign({}, meta[id] || {}, patch));
        if (m) meta[id] = m; else delete meta[id];
        saveMeta(); saveLinks();
        return api.bookmark(id);
      },
      removeBookmark(id) {
        const n = links.bookmarks.length;
        links.bookmarks = links.bookmarks.filter(b => b.url !== id);
        if (links.bookmarks.length === n) return false;
        op({ op: 'unbookmark', url: id });
        delete meta[id]; saveMeta();
        if ((settings.pinned || []).includes(id)) api.set('pinned', settings.pinned.filter(p => p !== id));
        saveLinks(); return true;
      },
      tags() { const m = new Map(); for (const x of Object.values(meta).concat(reading)) for (const t of x.tags || []) m.set(t, (m.get(t) || 0) + 1); return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'hu')); },
      jobs() { const m = new Map(); for (const x of Object.values(meta).concat(reading)) if (x.job) m.set(x.job, (m.get(x.job) || 0) + 1); return [...m].sort((a, b) => b[0].localeCompare(a[0])); },

      // ---- history: v1 rows (one per visit); history() groups them per URL, newest first
      history(q, limit) { return L.grouped(links, q, limit); },
      historyRows: () => links.history.slice(),
      visit(v) {
        if (!settings.history || !v || !isWeb(v.url)) return null;
        const t = now();
        links = L.visit(links, v.url, str(v.title, LIMITS.title), t);
        op({ op: 'visit', url: v.url, title: str(v.title, LIMITS.title), at: links.history[links.history.length - 1].at });
        saveLinks();
        return { url: v.url, at: t };
      },
      removeVisit(url) { const n = links.history.length; links.history = links.history.filter(h => h.url !== url); if (n !== links.history.length) { op({ op: 'forget', url }); saveLinks(); } },
      clearHistory(since) { const s = since || 0; links.history = links.history.filter(h => h.at < s); op({ op: 'clear', at: s }); saveLinks(); },

      // ---- the reading list (the work line's; travels in the export's x-bongeszo)
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
        if (!saveR()) { reading.shift(); return null; }
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

      // ---- the master (the Asztal's web.json, through sync.js)
      outbox: () => outbox.slice(),
      isSynced: () => synced,
      // the master answered with its links; `sent` ops of the outbox were in the request and are done
      adoptMaster(master, sent) {
        let m;
        try { m = L.read(master); } catch (e) { return false; }
        const first = !synced;
        synced = true;
        if (first) write('master', { since: now() });
        if (first && !outbox.length) {
          // the first contact: what this device has and the master lacks goes up once (nothing is lost, BRW-Q01)
          const mk = new Set(m.bookmarks.map(b => b.url)), mv = new Set(m.history.map(h => h.at + ' ' + h.url));
          for (const b of links.bookmarks) if (!mk.has(b.url)) outbox.push({ op: 'bookmark', url: b.url, title: b.title, at: b.at });
          for (const h of links.history.slice(-LIMITS.outbox)) if (!mv.has(h.at + ' ' + h.url)) outbox.push({ op: 'visit', url: h.url, title: h.title, at: h.at });
        } else if (sent) outbox.splice(0, Math.min(sent, outbox.length));
        const next = L.apply(m, outbox);
        const changed = JSON.stringify(next) !== JSON.stringify(links);
        links = next;
        write('outbox', outbox);
        if (changed) saveLinks();                             // a pull that brings nothing new redraws nothing
        return changed;
      },

      // ---- export / import / wipe
      exportAll() {
        return JSON.parse(L.write(links, { exported: new Date().toISOString(), ext: { meta, reading, pinned: settings.pinned || [] } }));
      },
      importAll(doc, mode) {
        let incoming, ext = {};
        try {
          if (doc && doc.format === OLD_FORMAT) {
            const bookmarks = (doc.bookmarks || []).filter(b => b && isWeb(b.url)).map(b => ({ url: b.url, title: b.title, at: +b.added || 0 }));
            const m = {};
            for (const b of doc.bookmarks || []) { const c = b && isWeb(b.url) && cleanMeta(b); if (c) m[b.url] = c; }
            incoming = L.read({ bookmarks, history: (doc.history || []).map(h => h && { url: h.url, title: h.title, at: h.at }).filter(Boolean) });
            ext = { meta: m, reading: doc.reading || [] };
          } else {
            incoming = L.read(doc);
            ext = incoming.ext || {};
          }
        } catch (e) { return { ok: false, hu: 'Ez nem könyvjelzőfájl (vrg.web-links v1, az Asztal web.json-ja vagy egy régi VRG Böngésző mentés).' }; }
        const before = { b: links.bookmarks.length, h: links.history.length, r: reading.length };
        if (mode === 'replace') { links = L.empty(); meta = {}; reading = []; }
        const merged = L.merge(links, incoming);
        if (synced) {
          const have = new Set(links.bookmarks.map(b => b.url)), seen = new Set(links.history.map(h => h.at + ' ' + h.url));
          for (const b of incoming.bookmarks) if (!have.has(b.url)) op({ op: 'bookmark', url: b.url, title: b.title, at: b.at });
          for (const h of incoming.history.slice(-LIMITS.outbox)) if (!seen.has(h.at + ' ' + h.url)) op({ op: 'visit', url: h.url, title: h.title, at: h.at });
        }
        links = merged;
        for (const [u, m] of Object.entries(ext.meta || {})) { const c = isWeb(u) && cleanMeta(m); if (c && !meta[u]) meta[u] = c; }
        for (const r of (ext.reading || []).slice(0, LIMITS.reading)) { const c = cleanReading(r); if (c && !reading.some(x => key(x.url) === key(c.url)) && reading.length < LIMITS.reading) reading.push(c); }
        if (Array.isArray(ext.pinned)) api.set('pinned', [...new Set((settings.pinned || []).concat(ext.pinned.filter(isWeb)))].slice(-24));
        saveMeta(); write('reading', reading); saveLinks(); emit('reading');
        const added = { bookmarks: links.bookmarks.length - (mode === 'replace' ? 0 : before.b), history: links.history.length - (mode === 'replace' ? 0 : before.h), reading: reading.length - (mode === 'replace' ? 0 : before.r) };
        return { ok: true, added, hu: 'Betöltve: ' + added.bookmarks + ' könyvjelző, ' + added.reading + ' olvasnivaló, ' + added.history + ' előzménysor.' };
      },
      wipe() {
        links = L.empty(); meta = {}; reading = []; outbox = []; settings = Object.assign({}, DEFAULTS);
        for (const n of ['links', 'meta', 'reading', 'settings', 'outbox', 'master']) { try { ls.removeItem(PREFIX + n); } catch (e) {} }
        synced = false;
        emit('links'); emit('reading'); emit('settings');
      },
      usage() { let n = 0; for (const k of ['links', 'meta', 'reading', 'settings', 'outbox']) { const v = ls.getItem(PREFIX + k); n += v ? v.length * 2 : 0; } return n; },
    };
    return api;
  }

  const api = { create, key, normJob, normTags, JOB_RE, DEFAULTS, PREFIX, OLD_FORMAT };
  VB.store = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
