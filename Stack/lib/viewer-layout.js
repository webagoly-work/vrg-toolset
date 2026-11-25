// VRG Stack — the Stack Viewer's layout (S9 of research/STRINGS-PLAN.md §6.2–6.3). Runs in the browser
// (viewer.html loads it as a script: window.StackViewerLayout) and in Node (the tests), like lib/strings.js.
//
//   layout(layer, cells) → Map id → {x, y, w, h}    each node's cell on its plane (unit square), in the layer's order
//   fill(rect, n)        → {x0, z0, p, tc, t}       how n particles sit in a cell: Hilbert tiles of 2^t × 2^t,
//                                                   tc tiles a row, rows in serpentine order, pitch p
//   at(f, d)             → [u, v]                   particle d's place (the shader does the same; picking checks it)
//   d2xy(side, d)        → [x, y]                   the Hilbert curve (Cortesi's scurve / binvis order)
//   byteClass(b)         → 0..6                     letter, accented, digit, space, punctuation, structure, other
//   aggregate(src, ranges, k, cls?) → {data, starts}   k bytes → one particle: its dominant class, shown by the first
//                                                   byte of that class (cls: src already holds class codes)
//
// The natural order (§6.2): F tier rows × lane blocks · T thread bands · I L U R lane rows, time running left to right · Q namespace
// columns · A kind bands · C G a squarified treemap of the folders, area ∝ bytes · anything else in id order.
// Inside a group, cells are an ordered strip treemap (Bederson): reading order is kept and cells stay squarish.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.StackViewerLayout = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const CLASS = ['betű', 'ékezetes', 'szám', 'köz', 'írásjel', 'szerkezet', 'egyéb'];
  const CLASS_EN = ['letter', 'accented', 'digit', 'space', 'punctuation', 'structure', 'other'];
  function byteClass(b) {
    if (b >= 128) return 1;
    if ((b >= 65 && b <= 90) || (b >= 97 && b <= 122)) return 0;
    if (b >= 48 && b <= 57) return 2;
    if (b === 32 || b === 10 || b === 9 || b === 13) return 3;
    if (b === 123 || b === 125 || b === 91 || b === 93 || b === 34 || b === 44 || b === 58) return 5;
    if (b < 32 || b === 127) return 6;
    return 4;
  }

  /* ---- rectangles */
  const sum = a => a.reduce((s, x) => s + x.w, 0);
  const inset = (r, f) => { const d = Math.min(f, r.w * 0.08, r.h * 0.08); return { x: r.x + d, y: r.y + d, w: r.w - 2 * d, h: r.h - 2 * d }; };

  // ordered strip treemap, rows left → right, top → bottom; 'cols' = the same, transposed (columns top → bottom, left
  // → right), so x follows the order: what a time axis wants
  function strip(items, r, dir) {
    if (dir === 'cols') return strip(items, { x: r.y, y: r.x, w: r.h, h: r.w }, 'rows').map(([it, q]) => [it, { x: q.y, y: q.x, w: q.h, h: q.w }]);
    const out = [], total = sum(items);
    if (!total || !items.length) return out;
    const k = r.w * r.h / total;
    let y = r.y, i = 0;
    while (i < items.length) {
      let s = 0, best = Infinity, end = i;
      for (let j = i; j < items.length; j++) {
        const s2 = s + items[j].w, hh = s2 * k / r.w;
        let asp = 0; for (let q = i; q <= j; q++) { const ww = items[q].w * k / hh; asp += Math.max(ww / hh, hh / ww); }
        asp /= (j - i + 1);
        if (j > i && asp > best) break;
        best = asp; s = s2; end = j + 1;
      }
      const hh = s * k / r.w; let x = r.x;
      for (let q = i; q < end; q++) { const ww = items[q].w * k / hh; out.push([items[q], { x, y, w: ww, h: hh }]); x += ww; }
      y += hh; i = end;
    }
    return out;
  }

  // squarified treemap (Bruls, Huizing, van Wijk): biggest first, rows along the shorter side
  function squarify(items, r) {
    const out = [], total = sum(items);
    if (!total) return out;
    const k = r.w * r.h / total;
    const rest = items.filter(i => i.w > 0).sort((a, b) => b.w - a.w).map(it => ({ it, a: it.w * k }));
    let { x, y, w, h } = r;
    const worst = (row, side) => { const s = row.reduce((t, c) => t + c.a, 0); let m = 0; for (const c of row) m = Math.max(m, side * side * c.a / (s * s), s * s / (side * side * c.a)); return m; };
    while (rest.length) {
      const side = Math.min(w, h); let row = [], best = Infinity;
      while (rest.length) { const cand = row.concat(rest[0]), s = worst(cand, side); if (row.length && s > best) break; row = cand; best = s; rest.shift(); }
      const s = row.reduce((t, c) => t + c.a, 0), thick = s / side;
      if (w >= h) { let yy = y; for (const c of row) { const hh = c.a / thick; out.push([c.it, { x, y: yy, w: thick, h: hh }]); yy += hh; } x += thick; w -= thick; }
      else { let xx = x; for (const c of row) { const ww = c.a / thick; out.push([c.it, { x: xx, y, w: ww, h: thick }]); xx += ww; } y += thick; h -= thick; }
    }
    return out;
  }

  // groups as bands along one axis ('y' = rows top → bottom, 'x' = columns left → right), each ∝ its weight
  function bands(groups, r, axis) {
    const total = groups.reduce((s, g) => s + g.w, 0), out = [];
    let at = 0;
    for (const g of groups) {
      const f = g.w / total;
      out.push([g, axis === 'y' ? { x: r.x, y: r.y + at * r.h, w: r.w, h: f * r.h } : { x: r.x + at * r.w, y: r.y, w: f * r.w, h: r.h }]);
      at += f;
    }
    return out;
  }
  function group(items, key, order) {
    const m = new Map();
    for (const it of items) { const k = key(it); (m.get(k) || m.set(k, []).get(k)).push(it); }
    const gs = [...m].map(([k, list]) => ({ key: k, items: list, w: sum(list) }));
    return gs.sort(order || ((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)));
  }

  // C and G: the folder tree. Each trie node may carry one cell (a C folder, a G document); its own cell is laid out
  // beside its sub-folders, so a folder reads as a block holding its pieces. Chains of single folders are squeezed.
  function tree(items, r, out) {
    const root = { kids: new Map(), item: null, w: 0 };
    for (const it of items) {
      const p = String(it.path || it.id.slice(2)).split('/').filter(Boolean);
      let n = root; for (const seg of p) { if (!n.kids.has(seg)) n.kids.set(seg, { kids: new Map(), item: null, w: 0 }); n = n.kids.get(seg); }
      if (n.item) { n.kids.set('\u0000' + it.id, { kids: new Map(), item: it, w: 0 }); } else n.item = it;
    }
    const weigh = n => { n.w = (n.item ? n.item.w : 0); for (const k of n.kids.values()) n.w += weigh(k); return n.w; };
    weigh(root);
    const place = (n, q, depth) => {
      while (!n.item && n.kids.size === 1) n = n.kids.values().next().value;
      const parts = [];
      if (n.item) parts.push({ w: n.item.w, leaf: n.item });
      for (const k of n.kids.values()) if (k.w > 0) parts.push({ w: k.w, node: k });
      if (parts.length === 1 && parts[0].leaf) { out.set(parts[0].leaf.id, q); return; }
      for (const [p, rr] of squarify(parts, q)) {
        if (p.leaf) out.set(p.leaf.id, rr);
        else place(p.node, inset(rr, depth < 2 ? 0.006 : 0.003), depth + 1);
      }
    };
    place(root, r, 0);
  }

  const qns = it => { const s = it.id.slice(2); return /^file\./.test(s) ? '~file' : s.split(/[-.]/)[0]; };
  const day = t => String(t || '');
  const byTime = (a, b) => (day(a.t) < day(b.t) ? -1 : day(a.t) > day(b.t) ? 1 : (a.id < b.id ? -1 : 1));

  function layout(layer, cells) {
    const items = cells.filter(c => c.n > 0).map(c => ({ ...c, w: c.n }));
    const out = new Map(), R = { x: 0, y: 0, w: 1, h: 1 };
    if (!items.length) return out;
    const leaf = (list, q, dir) => { for (const [it, rr] of strip(list, q, dir)) out.set(it.id, rr); };
    const pad = q => inset(q, 0.004);
    if (layer === 'C' || layer === 'G') tree(items, R, out);
    else if (layer === 'F') {
      const rows = group(items, it => String(it.tier || 9), (a, b) => (+a.key || 9) - (+b.key || 9));
      for (const [g, q] of bands(rows, R, 'y')) for (const [gl, ql] of bands(group(g.items, it => it.lane || ''), pad(q), 'x')) leaf(gl.items.slice().sort((a, b) => (a.id < b.id ? -1 : 1)), pad(ql), 'rows');
    } else if ('ILUR'.includes(layer)) {
      for (const [g, q] of bands(group(items, it => it.lane || ''), R, 'y')) leaf(g.items.slice().sort(byTime), pad(q), 'cols');
    } else if (layer === 'Q') {
      for (const [g, q] of bands(group(items, qns), R, 'x')) leaf(g.items.slice().sort((a, b) => (a.id < b.id ? -1 : 1)), pad(q), 'rows');
    } else if (layer === 'T') {   // thread groups (§6.2): one band per thread or line, its items in the board's order
      for (const [g, q] of bands(group(items, it => it.lane || ''), R, 'y')) leaf(g.items, pad(q), 'rows');
    } else if (layer === 'A') {
      for (const [g, q] of bands(group(items, it => it.kind || ''), R, 'y')) leaf(g.items.slice().sort((a, b) => (a.id < b.id ? -1 : 1)), pad(q), 'rows');
    } else leaf(items.slice().sort((a, b) => (a.id < b.id ? -1 : 1)), R, 'rows');
    for (const [id, q] of out) out.set(id, inset(q, 0.0015));
    return out;
  }

  /* ---- particles in a cell */
  function fill(r, n) {
    let best = null;
    for (let t = 0; t <= 7; t++) {
      const S = 1 << t, T = Math.ceil(n / (S * S));
      if (t > 0 && S * S > n * 4) break;                   // tiles far bigger than the node: no locality to win
      const tc = Math.max(1, Math.min(T, Math.round(Math.sqrt(T * r.w / r.h)))), tr = Math.ceil(T / tc);
      const p = Math.min(r.w / (tc * S), r.h / (tr * S)), ratio = n * p * p / (r.w * r.h);
      if (!best || ratio > best.ratio * 1.02 || (ratio >= best.ratio * 0.9 && t > best.t)) best = { t, tc, tr, p, ratio };
    }
    const S = 1 << best.t, gw = best.tc * S * best.p, gh = best.tr * S * best.p;
    return { x0: r.x + (r.w - gw) / 2, z0: r.y + (r.h - gh) / 2, p: best.p, tc: best.tc, t: best.t, n, ratio: best.ratio };
  }

  function d2xy(side, d) {
    let x = 0, y = 0, t = d;
    for (let s = 1; s < side; s *= 2) {
      const rx = 1 & (t >> 1), ry = 1 & (t ^ rx);
      if (!ry) { if (rx) { x = s - 1 - x; y = s - 1 - y; } const q = x; x = y; y = q; }
      x += s * rx; y += s * ry; t >>= 2;
    }
    return [x, y];
  }

  function at(f, d) {
    const S = 1 << f.t, cap = S * S, ti = Math.floor(d / cap), w = d - ti * cap;
    const row = Math.floor(ti / f.tc); let col = ti - row * f.tc;
    let [hx, hy] = d2xy(S, w);
    if (row & 1) { col = f.tc - 1 - col; hx = S - 1 - hx; }
    return [f.x0 + (col * S + hx + 0.5) * f.p, f.z0 + (row * S + hy + 0.5) * f.p];
  }

  /* ---- k bytes → one particle */
  function aggregate(src, ranges, k, cls) {
    const C = cls ? (b => b) : byteClass;
    let total = 0; for (const [s, e] of ranges) total += Math.ceil((e - s) / k);
    const data = new Uint8Array(total), starts = new Uint32Array(ranges.length + 1);
    let o = 0;
    const cnt = new Int32Array(8);
    for (let c = 0; c < ranges.length; c++) {
      starts[c] = o;
      const [s, e] = ranges[c];
      if (k === 1) { data.set(src.subarray(s, e), o); o += e - s; continue; }
      for (let a = s; a < e; a += k) {
        const b = Math.min(e, a + k); cnt.fill(0);
        for (let i = a; i < b; i++) cnt[C(src[i])]++;
        let m = 0; for (let q = 1; q < 7; q++) if (cnt[q] > cnt[m]) m = q;
        let v = src[a]; for (let i = a; i < b; i++) if (C(src[i]) === m) { v = src[i]; break; }
        data[o++] = v;
      }
    }
    starts[ranges.length] = o;
    return { data, starts };
  }

  return { CLASS, CLASS_EN, byteClass, strip, squarify, layout, fill, d2xy, at, aggregate };
});
