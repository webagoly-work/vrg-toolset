// links.js — `vrg.web-links` v1: the one bookmark-and-history format of the VRG Asztal (`<userDir>/web.json`, WP-18), the
// VRG Böngésző and the Data Vault's browser-kit (DV-Q22). Same rules as the DV kit (its contract cases are repeated in
// Browser/test/links.test.js), our own code. Pure: the page, serve.js and the Desktop shell all load this file.
//
//   { format: 'vrg.web-links', v: 1, exported?, bookmarks: [{ url, title, at }], history: [{ url, title, at }],
//     'x-bongeszo'?: { meta: { <url>: { tags, job, note } }, reading: [...], pinned: [<url>] } }
//
// The Desktop's web.json is the two arrays without the envelope; both other readers ignore unknown keys, so the work
// line's extension travels in the same file and nobody loses a field. A newer `v`, or another format, is refused.
//   read(input) → { bookmarks, history, ext }   write(links, { exported, ext }) → string   merge(a, b) → links
//   visit(links, url, title, now) · toggle(links, url, title, now) → { links, bookmarked | err } · prune(links, days, now)
//   apply(links, ops) → links   ops: [{ op: 'bookmark' | 'unbookmark' | 'visit' | 'forget', url, title?, at? } | { op: 'clear', at: since }],
//                               idempotent (an outbox may be sent twice)
(function (root) {
  'use strict';
  const VB = root.VB = root.VB || {};
  if (VB.links) return;

  const FORMAT = 'vrg.web-links', VERSION = 1, EXT = 'x-bongeszo';
  const MAX_HISTORY = 20000, MAX_BOOKMARKS = 2000, TITLE_MAX = 300, MAX_URL = 4096, DAY = 864e5;
  const cut = (s, n) => String(s == null ? '' : s).slice(0, n);

  function isWebUrl(u) {
    if (typeof u !== 'string' || !u.length || u.length > MAX_URL) return false;
    try { const p = new URL(u).protocol; return p === 'http:' || p === 'https:'; } catch (e) { return false; }
  }
  const row = r => (r && isWebUrl(r.url) && Number.isFinite(Number(r.at)) ? { url: r.url, title: cut(r.title, TITLE_MAX), at: Number(r.at) } : null);
  const empty = () => ({ bookmarks: [], history: [] });

  function read(input) {
    const j = typeof input === 'string' ? JSON.parse(input) : input;
    if (!j || typeof j !== 'object' || Array.isArray(j)) throw new Error('links: not a links file');
    if (j.format !== undefined && j.format !== FORMAT) throw new Error('links: not a links file: ' + j.format);
    if (j.format === FORMAT && j.v !== VERSION) throw new Error('links: v' + j.v + ' is newer than this reader');
    if (!Array.isArray(j.bookmarks) && !Array.isArray(j.history)) throw new Error('links: no bookmarks or history');
    const bookmarks = [], seen = new Set();
    for (const b of (Array.isArray(j.bookmarks) ? j.bookmarks : []).map(r => row(Object.assign({ at: 0 }, r)))) {
      if (b && !seen.has(b.url) && bookmarks.length < MAX_BOOKMARKS) { seen.add(b.url); bookmarks.push(b); }
    }
    const history = (Array.isArray(j.history) ? j.history : []).map(row).filter(Boolean).sort((a, b) => a.at - b.at);
    const out = { bookmarks, history: history.slice(-MAX_HISTORY) };
    if (j[EXT] && typeof j[EXT] === 'object' && !Array.isArray(j[EXT])) out.ext = j[EXT];
    return out;
  }

  function write(links, o) {
    const l = read(links), opt = o || {};
    const doc = { format: FORMAT, v: VERSION };
    if (opt.exported) doc.exported = opt.exported;
    doc.bookmarks = l.bookmarks; doc.history = l.history;
    const ext = opt.ext || l.ext;
    if (ext) doc[EXT] = ext;
    return JSON.stringify(doc, null, 1);
  }

  // nothing in either side is lost (up to the limits); neither input is changed
  function merge(a, b) {
    const A = read(a), B = read(b);
    const byUrl = new Map();
    for (const r of A.bookmarks.concat(B.bookmarks)) {
      const o = byUrl.get(r.url);
      if (!o) byUrl.set(r.url, Object.assign({}, r));
      else { o.at = Math.min(o.at, r.at); if (r.title.length > o.title.length) o.title = r.title; }
    }
    const visits = new Map();
    for (const r of A.history.concat(B.history)) {
      const k = r.at + ' ' + r.url, o = visits.get(k);
      if (!o) visits.set(k, Object.assign({}, r)); else if (r.title.length > o.title.length) o.title = r.title;
    }
    return read({ bookmarks: [...byUrl.values()], history: [...visits.values()] });
  }

  // a page finished loading: a new row, or the same URL right after itself refreshed (the Asztal's rule)
  function visit(links, url, title, now) {
    const l = read(links), t = now == null ? Date.now() : now;
    if (!isWebUrl(url)) return l;
    const last = l.history[l.history.length - 1];
    if (last && last.url === url) { last.at = Math.max(last.at, t); if (title) last.title = cut(title, TITLE_MAX); }
    else l.history.push({ url, title: cut(title, TITLE_MAX), at: t });
    if (l.history.length > MAX_HISTORY) l.history.splice(0, l.history.length - MAX_HISTORY);
    return l;
  }

  function toggle(links, url, title, now) {
    const l = read(links);
    if (!isWebUrl(url)) return { links: l, err: 'bad-url' };
    const i = l.bookmarks.findIndex(b => b.url === url);
    if (i >= 0) { l.bookmarks.splice(i, 1); return { links: l, bookmarked: false }; }
    if (l.bookmarks.length >= MAX_BOOKMARKS) return { links: l, err: 'limit' };
    l.bookmarks.push({ url, title: cut(title, TITLE_MAX), at: now == null ? Date.now() : now });
    return { links: l, bookmarked: true };
  }

  function prune(links, days, now) {
    const l = read(links), t = now == null ? Date.now() : now;
    const d = Number.isFinite(Number(days)) && Number(days) >= 0 ? Number(days) : 90;
    l.history = l.history.filter(h => h.at >= t - d * DAY);
    return l;
  }

  // ops a copy sends to the master; applying the same op twice changes nothing more (outboxes may resend)
  const OPS = ['bookmark', 'unbookmark', 'visit', 'forget', 'clear'];
  function cleanOps(ops) {
    return (Array.isArray(ops) ? ops : []).slice(0, 2000).filter(o => o && OPS.includes(o.op) && (o.op === 'clear' ? !o.url : isWebUrl(o.url)))
      .map(o => ({ op: o.op, url: o.url || '', title: cut(o.title, TITLE_MAX), at: Number.isFinite(Number(o.at)) ? Number(o.at) : 0 }));
  }
  function apply(links, ops) {
    const l = read(links);
    for (const o of cleanOps(ops)) {
      if (o.op === 'bookmark') {
        const b = l.bookmarks.find(x => x.url === o.url);
        if (b) { if (o.title && !b.title) b.title = o.title; }
        else if (l.bookmarks.length < MAX_BOOKMARKS) l.bookmarks.push({ url: o.url, title: o.title, at: o.at });
      } else if (o.op === 'unbookmark') {
        l.bookmarks = l.bookmarks.filter(x => x.url !== o.url);
      } else if (o.op === 'forget') {
        l.history = l.history.filter(h => h.url !== o.url);
      } else if (o.op === 'clear') {
        l.history = l.history.filter(h => h.at < o.at);              // at = since (0 = all history)
      } else if (!l.history.some(h => h.url === o.url && h.at === o.at)) {
        l.history.push({ url: o.url, title: o.title, at: o.at });
      }
    }
    l.history.sort((a, b) => a.at - b.at);
    if (l.history.length > MAX_HISTORY) l.history.splice(0, l.history.length - MAX_HISTORY);
    return l;
  }

  // history grouped per URL, newest first: { url, title, at (last), count }
  function grouped(links, q, limit) {
    const n = String(q == null ? '' : q).trim().toLowerCase();
    const by = new Map();
    for (const h of read(links).history) {
      const g = by.get(h.url);
      if (!g) by.set(h.url, { url: h.url, title: h.title, at: h.at, count: 1 });
      else { g.count++; if (h.at >= g.at) { g.at = h.at; if (h.title) g.title = h.title; } else if (!g.title) g.title = h.title; }
    }
    return [...by.values()].filter(g => !n || g.url.toLowerCase().includes(n) || g.title.toLowerCase().includes(n))
      .sort((a, b) => b.at - a.at).slice(0, limit || 1e9);
  }

  const api = { FORMAT, VERSION, EXT, MAX_HISTORY, MAX_BOOKMARKS, isWebUrl, empty, read, write, merge, visit, toggle, prune, apply, cleanOps, grouped };
  VB.links = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
