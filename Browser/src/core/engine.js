// engine.js — the VRG Böngésző's own search engine: an in-memory inverted index with field-weighted BM25, prefix and
// one-edit fuzzy matching, Hungarian accent folding ("kotoelem" finds "Kötőelem") and a light Hungarian suffix trim
// ("kábelek" finds "kábel"). The same file runs in the page (bookmarks, history, reading list, saved pages, VRG tools)
// and in serve.js (the repo's documents). Pure: no DOM.
//   const ix = VB.engine.createIndex({ fields: { title: 3, text: 1 } }); ix.add({ id, title, text, … }); ix.search('kábel', { limit })
//   → [{ id, doc, score, matched: n, of: n }]      VB.engine.snippet(text, query) → { text, ranges }
(function (root) {
  'use strict';
  const VB = root.VB = root.VB || {};
  if (VB.engine) return;

  // one character in, one character out, so positions in the folded string are positions in the original
  function foldChar(c) {
    const d = c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    return d.length === 1 ? d : (d.charAt(0) || c);
  }
  const FOLD_CACHE = new Map();
  function fold(s) {
    s = String(s == null ? '' : s);
    let out = '';
    for (const c of s) {
      if (c.length !== 1) { out += c.length === 2 ? '\u0000\u0000' : c; continue; }   // astral (emoji): kept as two placeholders
      let f = FOLD_CACHE.get(c);
      if (f === undefined) { f = foldChar(c); if (FOLD_CACHE.size < 4096) FOLD_CACHE.set(c, f); }
      out += f;
    }
    return out;
  }

  // Hungarian case endings and plurals, longest first; one is cut when at least four letters stay
  const SUFFIXES = ['jaiban', 'eiben', 'aiban', 'oknak', 'eknek', 'akban', 'ekben', 'okban', 'okat', 'eket', 'akat', 'okon', 'eken',
    'ban', 'ben', 'bol', 'rol', 'tol', 'nak', 'nek', 'val', 'vel', 'hoz', 'hez', 'kor', 'ert', 'ig',
    'ok', 'ek', 'ak', 'ra', 're', 'ba', 'be', 'on', 'en', 'at', 'et', 'ot', 'ja', 'je', 'ai', 'ei', 'k', 't'];
  function stem(w) {
    if (w.length < 6 || /\d/.test(w)) return w;
    for (const s of SUFFIXES) if (w.endsWith(s) && w.length - s.length >= 4) return w.slice(0, -s.length);
    return w;
  }
  const STOP = new Set(['a', 'az', 'es', 'egy', 'is', 'de', 'hogy', 'nem', 'meg', 'mint', 'van', 'vagy', 'the', 'and', 'of', 'to', 'in', 'for', 'on', 'with']);
  function tokens(s, keepStop) {
    const out = [];
    for (const raw of fold(s).split(/[^a-z0-9ß-ɏ]+/)) {
      if (!raw || (!keepStop && STOP.has(raw))) continue;
      if (raw.length < 2 && !/^\d$/.test(raw)) continue;
      out.push(stem(raw));
    }
    return out;
  }

  // Levenshtein distance capped at 2 (enough for "one typo")
  function within1(a, b) {
    if (a === b) return true;
    const la = a.length, lb = b.length;
    if (Math.abs(la - lb) > 1) return false;
    let i = 0, j = 0, edits = 0;
    while (i < la && j < lb) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++edits > 1) return false;
      if (la > lb) i++; else if (lb > la) j++; else if (a[i + 1] === b[j] && a[i] === b[j + 1]) { i += 2; j += 2; } else { i++; j++; }
    }
    return edits + (la - i) + (lb - j) <= 1;
  }

  function createIndex(opts) {
    const fields = (opts && opts.fields) || { title: 3, text: 1 };
    const K1 = 1.2, B = 0.75;
    const docs = new Map();            // id → { doc, len: { field: n }, terms: Map(term → { field: tf }) }
    const post = new Map();            // term → Set(id)
    const avg = {};
    let sorted = null;                 // the vocabulary, sorted, for prefix lookups (rebuilt lazily)
    let dirty = true;                  // the average field lengths, recounted before the next search

    function recount() {
      dirty = false;
      for (const f of Object.keys(fields)) {
        let sum = 0;
        for (const d of docs.values()) sum += d.len[f] || 0;
        avg[f] = docs.size ? sum / docs.size || 1 : 1;
      }
    }
    function text(doc, f) {
      const v = doc[f];
      return Array.isArray(v) ? v.join(' ') : v == null ? '' : String(v);
    }
    function add(doc) {
      if (!doc || doc.id == null) return false;
      const id = String(doc.id);
      if (docs.has(id)) remove(id);
      const terms = new Map(), len = {};
      for (const f of Object.keys(fields)) {
        const tk = tokens(text(doc, f));
        len[f] = tk.length;
        for (const t of tk) {
          let e = terms.get(t);
          if (!e) terms.set(t, e = {});
          e[f] = (e[f] || 0) + 1;
        }
      }
      docs.set(id, { doc, len, terms });
      for (const t of terms.keys()) { let s = post.get(t); if (!s) { post.set(t, s = new Set()); sorted = null; } s.add(id); }
      dirty = true;
      return true;
    }
    function remove(id) {
      id = String(id);
      const d = docs.get(id);
      if (!d) return false;
      for (const t of d.terms.keys()) { const s = post.get(t); if (s) { s.delete(id); if (!s.size) { post.delete(t); sorted = null; } } }
      docs.delete(id);
      dirty = true;
      return true;
    }
    function clear() { docs.clear(); post.clear(); sorted = null; dirty = true; }
    function vocab() { if (!sorted) sorted = [...post.keys()].sort(); return sorted; }
    function withPrefix(p) {
      const v = vocab(), out = [];
      let lo = 0, hi = v.length;
      while (lo < hi) { const m = (lo + hi) >> 1; if (v[m] < p) lo = m + 1; else hi = m; }
      for (let i = lo; i < v.length && v[i].startsWith(p) && out.length < 64; i++) out.push(v[i]);
      return out;
    }
    // the index terms one query word stands for, each with a weight: exact 1, prefix 0.7, one typo 0.45
    function expand(q) {
      const out = new Map();
      if (post.has(q)) out.set(q, 1);
      if (q.length >= 2) for (const t of withPrefix(q)) if (!out.has(t)) out.set(t, 0.7);
      if (!out.size && q.length >= 4) {
        for (const t of vocab()) if (Math.abs(t.length - q.length) <= 1 && t[0] === q[0] && within1(q, t)) out.set(t, 0.45);
      }
      return out;
    }
    function search(query, o) {
      const lim = (o && o.limit) || 20, filter = o && o.filter;
      const qs = [...new Set(tokens(query, true))].filter(t => !STOP.has(t) || tokens(query).length === 0);
      if (!qs.length) return [];
      if (dirty) recount();
      const N = docs.size;
      const score = new Map(), hit = new Map();
      for (const q of qs) {
        const seen = new Set();
        for (const [t, w] of expand(q)) {
          const ids = post.get(t);
          if (!ids) continue;
          const idf = Math.log(1 + (N - ids.size + 0.5) / (ids.size + 0.5));
          for (const id of ids) {
            const d = docs.get(id);
            const tf = d.terms.get(t);
            let s = 0;
            for (const f of Object.keys(fields)) {
              const n = tf[f] || 0;
              if (!n) continue;
              s += fields[f] * (n * (K1 + 1)) / (n + K1 * (1 - B + B * (d.len[f] || 0) / (avg[f] || 1)));
            }
            score.set(id, (score.get(id) || 0) + w * idf * s);
            seen.add(id);
          }
        }
        for (const id of seen) hit.set(id, (hit.get(id) || 0) + 1);
      }
      const out = [];
      for (const [id, s] of score) {
        const d = docs.get(id);
        if (filter && !filter(d.doc)) continue;
        const m = hit.get(id) || 0, cover = m / qs.length;
        if (qs.length > 1 && cover < 0.5) continue;
        out.push({ id, doc: d.doc, score: s * cover * cover * ((d.doc.boost) || 1), matched: m, of: qs.length });
      }
      out.sort((a, b) => b.score - a.score || String(a.id).localeCompare(String(b.id)));
      return out.slice(0, lim);
    }
    return { add, remove, clear, search, size: () => docs.size, has: id => docs.has(String(id)), get: id => (docs.get(String(id)) || {}).doc, terms: () => post.size };
  }

  // a window of the text around the first query word it contains, with the ranges to highlight (on the original text)
  function snippet(text, query, width) {
    const w = width || 160;
    const src = String(text || '').replace(/\s+/g, ' ').trim();
    const f = fold(src);
    const words = [...new Set(fold(query).split(/[^a-z0-9ß-ɏ]+/).filter(x => x.length >= 2).map(x => x.length >= 6 ? stem(x) : x))];
    let first = -1;
    for (const q of words) { const i = f.indexOf(q); if (i >= 0 && (first < 0 || i < first)) first = i; }
    let a = 0, b = Math.min(src.length, w);
    if (first > w / 3) { a = Math.max(0, first - Math.floor(w / 3)); b = Math.min(src.length, a + w); }
    const piece = src.slice(a, b), fp = f.slice(a, b), ranges = [];
    for (const q of words) {
      let i = 0;
      while ((i = fp.indexOf(q, i)) >= 0) { ranges.push([i, i + q.length]); i += q.length; }
    }
    ranges.sort((x, y) => x[0] - y[0]);
    const merged = [];
    for (const r of ranges) { const l = merged[merged.length - 1]; if (l && r[0] <= l[1]) l[1] = Math.max(l[1], r[1]); else merged.push(r.slice()); }
    return { text: (a > 0 ? '… ' : '') + piece + (b < src.length ? ' …' : ''), ranges: merged.map(r => [r[0] + (a > 0 ? 2 : 0), r[1] + (a > 0 ? 2 : 0)]) };
  }

  const api = { fold, tokens, stem, within1, createIndex, snippet };
  VB.engine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
