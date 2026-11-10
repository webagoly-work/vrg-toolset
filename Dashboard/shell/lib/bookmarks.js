// bookmarks.js — bookmarks and browsing history in <userDir>/web.json (WP-18). Only { url, title, at }: no page content is stored.
//   const bm = createBookmarks({ file, days: () => 90, now: Date.now });
//   bm.visit(url, title) · bm.history(q?) · bm.clear() · bm.prune() · bm.toggle(url, title) → { bookmarked } · bm.list() · bm.has(url) · bm.flush()
// History is pruned to `days` (setting web.history.days; 0 keeps nothing) and to MAX_HISTORY rows. Writes are atomic (.tmp, rename);
// history writes are batched (a page load is not a disk write), bookmark changes are written at once.
'use strict';
const nodeFs = require('fs'), nodePath = require('path');

const MAX_HISTORY = 20000;
const MAX_BOOKMARKS = 2000;
const DAY = 24 * 3600 * 1000;
const FLUSH_MS = 2000;

const okUrl = u => {
  if (typeof u !== 'string' || !u.length || u.length > 4096) return false;
  try { const p = new URL(u).protocol; return p === 'http:' || p === 'https:'; } catch (e) { return false; }
};
const cut = (s, n) => String(s == null ? '' : s).slice(0, n);

function createBookmarks({ file, days = () => 90, now = Date.now, fs = nodeFs, timers = true } = {}) {
  if (typeof file !== 'function' && typeof file !== 'string') throw new Error('bookmarks: file missing');
  const where = () => (typeof file === 'function' ? file() : file);
  let data = null, dirty = false, timer = null;

  function load() {
    if (data) return data;
    data = { bookmarks: [], history: [] };
    try {
      const j = JSON.parse(fs.readFileSync(where(), 'utf8'));
      if (j && Array.isArray(j.bookmarks)) data.bookmarks = j.bookmarks.filter(b => b && okUrl(b.url)).map(b => ({ url: b.url, title: cut(b.title, 300), at: Number(b.at) || 0 }));
      if (j && Array.isArray(j.history)) data.history = j.history.filter(h => h && okUrl(h.url) && Number.isFinite(h.at)).map(h => ({ url: h.url, title: cut(h.title, 300), at: h.at }));
      data.history.sort((a, b) => a.at - b.at);
    } catch (e) { /* no file yet, or unreadable: start empty */ }
    return data;
  }

  function write() {
    if (timer) { clearTimeout(timer); timer = null; }
    dirty = false;
    const f = where(), tmp = f + '.tmp';
    fs.mkdirSync(nodePath.dirname(f), { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify(load()));
    fs.renameSync(tmp, f);
  }
  function later() {
    dirty = true;
    if (!timers || timer) return;
    timer = setTimeout(() => { timer = null; try { write(); } catch (e) {} }, FLUSH_MS);
    if (timer.unref) timer.unref();
  }

  function prune() {
    const d = load();
    const n = Number(days());
    const keepDays = Number.isFinite(n) && n >= 0 ? n : 90;
    const min = now() - keepDays * DAY;
    const before = d.history.length;
    const h = d.history;                                         // oldest first, so the rows to drop are a prefix
    let cut0 = 0;
    while (cut0 < h.length && h[cut0].at < min) cut0++;
    if (h.length - cut0 > MAX_HISTORY) cut0 = h.length - MAX_HISTORY;
    if (cut0) h.splice(0, cut0);
    return before - h.length;
  }

  // a load finished: the same URL again right after itself only refreshes the row (title arrives late, reloads, in-page hops)
  function visit(url, title) {
    if (!okUrl(url)) return false;
    const d = load();
    const last = d.history[d.history.length - 1];
    if (last && last.url === url) { last.at = now(); if (title) last.title = cut(title, 300); }
    else d.history.push({ url, title: cut(title, 300), at: now() });
    prune();
    later();
    return true;
  }

  // newest first; q matches the URL or the title, case-insensitive
  function history(q, limit = 200) {
    prune();
    const n = String(q == null ? '' : q).trim().toLowerCase();
    const rows = load().history.filter(h => !n || h.url.toLowerCase().includes(n) || h.title.toLowerCase().includes(n));
    return rows.slice(-limit).reverse().map(h => ({ ...h }));
  }

  function clear() { load().history = []; write(); }

  const list = () => load().bookmarks.map(b => ({ ...b }));
  const has = url => load().bookmarks.some(b => b.url === url);
  function toggle(url, title) {
    if (!okUrl(url)) return { ok: false, err: 'bad-request', hu: 'Ez a cím nem tehető könyvjelzőbe.' };
    const d = load();
    const i = d.bookmarks.findIndex(b => b.url === url);
    if (i >= 0) d.bookmarks.splice(i, 1);
    else {
      if (d.bookmarks.length >= MAX_BOOKMARKS) return { ok: false, err: 'limit', hu: 'Legfeljebb ' + MAX_BOOKMARKS + ' könyvjelző lehet.' };
      d.bookmarks.push({ url, title: cut(title, 300), at: now() });
    }
    write();
    return { bookmarked: i < 0 };
  }

  function flush() { if (dirty) write(); }

  return { visit, history, clear, prune, list, has, toggle, flush };
}

module.exports = { createBookmarks, MAX_HISTORY, MAX_BOOKMARKS };
