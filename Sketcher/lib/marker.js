// Sketcher/lib/marker.js — the VRG mérőkártya (dev line skcam, K3 follow-up): a printed square card the Síkmérés finds
// in the photo by itself, so the reference needs no tapping. Pure maths on pixels, no DOM, no library.
//
// The card: a black square of side S mm (the reference) made of 6 × 6 modules: a one-module black frame round a 4 × 4
// code. The code says which card it is (its printed size) and which way up it hangs, so the corners come back in the
// card's own order. Three codes, each at least 7 bits from every turn of the others and 8 from its own turns: up to two
// misread bits are still read right. White paper round the frame (a quiet zone of at least one module) is part of the
// card. The idea is ArUco's (Garrido-Jurado et al. 2014); the codes and the code here are our own.
//
//   VRGMarker.CARDS                         [{ id, mm, label }]   the printable cards
//   VRGMarker.svg(id, mm?)                  the card as an SVG sized in mm (print at 100 %), with a 100 mm check ruler
//   VRGMarker.page(id, mm?)                 a whole printable HTML page around svg()
//   VRGMarker.detect(img, opts?)            img = { width, height, data (RGBA) or gray (Uint8) }
//       → [{ id, mm, pts: [[u, v] × 4] (0…1 of the photo; the card's top-left, top-right, bottom-right, bottom-left),
//            px (side in photo pixels), err (misread bits) }], largest first
//   VRGMarker.fromImage(image, doc, max?)   a canvas / <img> → img for detect() (browser only)
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.VRGMarker = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // bit (r * 4 + k) is the code cell in row r (from the top) and column k (from the left) as printed; 1 = black
  const CODES = [0xdc16, 0x79e8, 0x4e49];
  const CARDS = [
    { id: 0, mm: 150, label: 'VRG mérőkártya 150 mm (A4)' },
    { id: 1, mm: 100, label: 'VRG mérőkártya 100 mm' },
    { id: 2, mm: 60, label: 'VRG mérőkártya 60 mm (kis hely)' },
  ];
  const card = id => CARDS.find(c => c.id === id) || null;
  const bit = (code, r, k) => (code >> (r * 4 + k)) & 1;
  const pop = x => { let n = 0; while (x) { n += x & 1; x >>>= 1; } return n; };

  // ---- the printed card --------------------------------------------------------------------------------------------
  /** The card as SVG, its size in real mm: the marker (side mm), a quiet zone, a 100 mm check ruler and its name. */
  function svg(id, mm) {
    const c = card(id) || CARDS[0], S = mm > 0 ? mm : c.mm, m = S / 6, q = Math.max(m, 8), code = CODES[c.id];
    const rule = S >= 100 ? 100 : 50, W = S + 2 * q, H = S + 2 * q + 22;
    let cells = '';
    for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) if (bit(code, r, k)) cells += '<rect x="' + (q + m * (k + 1)) + '" y="' + (q + m * (r + 1)) + '" width="' + m + '" height="' + m + '"/>';
    const f = v => Math.round(v * 1000) / 1000;
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + f(W) + 'mm" height="' + f(H) + 'mm" viewBox="0 0 ' + f(W) + ' ' + f(H) + '">' +
      '<rect width="' + f(W) + '" height="' + f(H) + '" fill="#fff"/>' +
      // the frame: a black square with the white code area cut out, then the code's black cells
      '<path fill="#000" fill-rule="evenodd" d="M' + q + ' ' + q + 'h' + S + 'v' + S + 'h' + (-S) + 'z M' + f(q + m) + ' ' + f(q + m) + 'v' + f(4 * m) + 'h' + f(4 * m) + 'v' + f(-4 * m) + 'z"/>' +
      '<g fill="#000">' + cells + '</g>' +
      // the check ruler: print at 100 %, then this line must be exactly rule mm long
      '<g stroke="#000" stroke-width="0.3"><line x1="' + q + '" y1="' + f(q + S + 8) + '" x2="' + (q + rule) + '" y2="' + f(q + S + 8) + '"/>' +
      '<line x1="' + q + '" y1="' + f(q + S + 5) + '" x2="' + q + '" y2="' + f(q + S + 11) + '"/><line x1="' + (q + rule) + '" y1="' + f(q + S + 5) + '" x2="' + (q + rule) + '" y2="' + f(q + S + 11) + '"/></g>' +
      '<text x="' + (q + rule + 3) + '" y="' + f(q + S + 9.5) + '" font-family="sans-serif" font-size="4">' + rule + ' mm</text>' +
      '<text x="' + q + '" y="' + f(q + S + 17) + '" font-family="sans-serif" font-size="3.6">' + c.label.replace(/ \d+ mm.*$/, '') + ' · a fekete négyzet ' + S + ' × ' + S + ' mm · nyomtatás 100 %-on, a vonal legyen ' + rule + ' mm</text>' +
      '</svg>';
  }
  /** A printable page with the card (one card; the 60 mm card four times). */
  function page(id, mm) {
    const c = card(id) || CARDS[0], n = c.mm <= 60 ? 4 : 1, one = svg(c.id, mm);
    return '<!doctype html><html lang="hu"><head><meta charset="utf-8"><title>' + c.label + '</title>' +
      '<style>@page{size:A4;margin:12mm}body{margin:0;font:12px sans-serif;color:#000;background:#fff}.c{display:inline-block;margin:0 6mm 6mm 0}' +
      '@media screen{body{padding:16px}.n{margin-bottom:12px;max-width:640px}}@media print{.n{display:none}}</style></head><body>' +
      '<p class="n">Nyomtasd ki <b>100 %-os (tényleges) méretben</b>, ne „oldalhoz igazítva”. Utána vonalzóval mérd meg a vonalat; ha nem pontos, a Síkmérésben a kártya méreténél írd be a fekete négyzet valódi oldalát. Ragaszd a falra, laposan, a mérendő dolgok közelébe.</p>' +
      Array(n).fill('<div class="c">' + one + '</div>').join('') + '<script>setTimeout(function(){try{print()}catch(e){}},300)<\/script></body></html>';
  }

  // ---- detection ---------------------------------------------------------------------------------------------------
  /** Grey levels (Uint8Array) of an RGBA image or a grey one. */
  function grey(img) {
    if (img.gray) return img.gray;
    const n = img.width * img.height, d = img.data, g = new Uint8Array(n);
    for (let i = 0, k = 0; i < n; i++, k += 4) g[i] = (d[k] * 77 + d[k + 1] * 150 + d[k + 2] * 29) >> 8;
    return g;
  }
  /** A box-filtered copy at most `max` pixels on its long side (detection runs on this; corners are refined on the full). */
  function shrink(g, w, h, max) {
    const k = Math.max(1, Math.ceil(Math.max(w, h) / max));
    if (k === 1) return { g, w, h, k: 1 };
    const W = Math.floor(w / k), H = Math.floor(h / k), o = new Uint8Array(W * H), kk = k * k;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let s = 0; for (let j = 0; j < k; j++) { const row = (y * k + j) * w + x * k; for (let i = 0; i < k; i++) s += g[row + i]; }
      o[y * W + x] = s / kk;
    }
    return { g: o, w: W, h: H, k };
  }
  /** Dark mask: darker than the local mean (window win) by more than c. */
  function threshold(g, w, h, win, c) {
    const I = new Float64Array((w + 1) * (h + 1));
    for (let y = 0; y < h; y++) { let s = 0; for (let x = 0; x < w; x++) { s += g[y * w + x]; I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + s; } }
    const r = win >> 1, m = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
      for (let x = 0; x < w; x++) {
        const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
        const s = I[y1 * (w + 1) + x1] - I[y0 * (w + 1) + x1] - I[y1 * (w + 1) + x0] + I[y0 * (w + 1) + x0];
        if (g[y * w + x] * (x1 - x0) * (y1 - y0) < (s - c * (x1 - x0) * (y1 - y0))) m[y * w + x] = 1;
      }
    }
    return m;
  }
  /** The dark regions' outer boundary pixels (8-connected regions), each region big enough to be a card. */
  function regions(m, w, h, minSide) {
    const lab = new Int32Array(w * h), out = [], st = new Int32Array(w * h);
    let next = 0;
    for (let s0 = 0; s0 < w * h; s0++) {
      if (!m[s0] || lab[s0]) continue;
      next++; let sp = 0; st[sp++] = s0; lab[s0] = next;
      let x0 = w, x1 = 0, y0 = h, y1 = 0, n = 0; const edge = [];
      while (sp) {
        const p = st[--sp], x = p % w, y = (p - x) / w; n++;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        let border = x === 0 || y === 0 || x === w - 1 || y === h - 1;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
          const q = Y * w + X;
          if (!m[q]) { if (!dx || !dy) border = true; continue; }
          if (!lab[q]) { lab[q] = next; st[sp++] = q; }
        }
        if (border) edge.push(x, y);
      }
      const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
      if (bw >= minSide && bh >= minSide && bw < w * 0.98 && bh < h * 0.98) out.push({ edge, n, box: [x0, y0, x1, y1] });
    }
    return out;
  }
  /** The convex hull (monotone chain) of a flat [x0, y0, x1, y1, …] list. */
  function hull(flat) {
    const pts = []; for (let i = 0; i < flat.length; i += 2) pts.push([flat[i], flat[i + 1]]);
    pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }
  const area = P => { let s = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s) / 2; };
  /** The largest quadrilateral on a hull's vertices (a diagonal, the farthest point on each side, then each corner re-picked). */
  function quad(H) {
    const n = H.length; if (n < 4) return null;
    let a = 0, c = 0, best = -1;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const d = (H[i][0] - H[j][0]) ** 2 + (H[i][1] - H[j][1]) ** 2; if (d > best) { best = d; a = i; c = j; } }
    const tri = (i, j, k) => Math.abs((H[j][0] - H[i][0]) * (H[k][1] - H[i][1]) - (H[j][1] - H[i][1]) * (H[k][0] - H[i][0]));
    const far = (i, j) => { let b = -1, bi = -1; for (let k = (i + 1) % n; k !== j; k = (k + 1) % n) { const t = tri(i, j, k); if (t > b) { b = t; bi = k; } } return bi; };
    let q = [a, far(a, c), c, far(c, a)];
    if (q[1] < 0 || q[3] < 0) return null;
    for (let it = 0; it < 3; it++) for (let s = 0; s < 4; s++) {      // each corner: the hull point between its neighbours that makes the biggest triangle
      const prev = q[(s + 3) % 4], nxt = q[(s + 1) % 4], k = far(prev, nxt); if (k >= 0) q[s] = k;
    }
    return q.map(i => H[i]);
  }
  /** Homography taking the unit square's corners (0,0) (1,0) (1,1) (0,1) to the quad q (closed form). */
  function squareTo(q) {
    const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
    const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2, sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
    const den = dx1 * dy2 - dx2 * dy1; if (Math.abs(den) < 1e-12) return null;
    const g = (sx * dy2 - dx2 * sy) / den, h = (dx1 * sy - sx * dy1) / den;
    return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h, 1];
  }
  const map = (H, s, t) => { const w = H[6] * s + H[7] * t + H[8]; return [(H[0] * s + H[1] * t + H[2]) / w, (H[3] * s + H[4] * t + H[5]) / w]; };
  const at = (g, w, h, x, y) => {          // bilinear grey at (x, y), clamped
    x = Math.max(0, Math.min(w - 1.001, x)); y = Math.max(0, Math.min(h - 1.001, y));
    const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, p = j * w + i;
    return (g[p] * (1 - fx) + g[p + 1] * fx) * (1 - fy) + (g[p + w] * (1 - fx) + g[p + w + 1] * fx) * fy;
  };
  /** Reads the 6 × 6 grid (and a ring of quiet zone) inside quad q: { cells[36], quiet, lo, hi } or null. */
  function cells(g, w, h, q) {
    const H = squareTo(q); if (!H) return null;
    const v = [];
    for (let r = 0; r < 6; r++) for (let k = 0; k < 6; k++) {
      let s = 0; for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) { const p = map(H, (k + 0.3 + 0.2 * b) / 6, (r + 0.3 + 0.2 * a) / 6); s += at(g, w, h, p[0], p[1]); }
      v.push(s / 9);
    }
    let quiet = 0, nq = 0;                  // just outside the frame, a third of a module out: the paper
    for (let i = 0; i < 24; i++) {
      const t = (i % 6 + 0.5) / 6, side = i / 6 | 0, o = -1 / 18;
      const st = side === 0 ? [t, o] : side === 1 ? [1 - o, t] : side === 2 ? [1 - t, 1 - o] : [o, 1 - t];
      const p = map(H, st[0], st[1]); if (p[0] < 0 || p[1] < 0 || p[0] > w - 1 || p[1] > h - 1) continue;
      quiet += at(g, w, h, p[0], p[1]); nq++;
    }
    return { v, quiet: nq ? quiet / nq : 0 };
  }
  /** The code read from the grid: { id, turn, err } or null (frame not black, too little contrast, no code close). */
  function read(c) {
    const v = c.v, frame = [], inner = [];
    for (let r = 0; r < 6; r++) for (let k = 0; k < 6; k++) (r === 0 || k === 0 || r === 5 || k === 5 ? frame : inner).push(v[r * 6 + k]);
    const fMean = frame.reduce((s, x) => s + x, 0) / frame.length, cut = (fMean + c.quiet) / 2;
    if (c.quiet - fMean < 30) return null;                    // the paper round the frame must be clearly lighter than the frame
    if (frame.filter(x => x >= cut).length > 1) return null;  // the frame is black all round (one cell may catch a glare)
    let word = 0;
    for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) if (v[(r + 1) * 6 + k + 1] < cut) word |= 1 << (r * 4 + k);
    // the four ways the card can hang: turn t means the photo's quad corner t is the card's top-left
    let best = null;
    for (let t = 0; t < 4; t++) {
      let w2 = 0;
      for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) {
        // card cell (r, k) seen in the photo grid after turning the card by t quarter turns (clockwise)
        const [R, K] = t === 0 ? [r, k] : t === 1 ? [k, 3 - r] : t === 2 ? [3 - r, 3 - k] : [3 - k, r];
        if ((word >> (R * 4 + K)) & 1) w2 |= 1 << (r * 4 + k);
      }
      CODES.forEach((code, id) => { const e = pop(code ^ w2); if (!best || e < best.err) best = { id, turn: t, err: e }; });
    }
    return best && best.err <= 2 ? best : null;
  }
  /**
   * Sub-pixel corners: each side's edge found along its normal at 24 places (the steepest step, interpolated), a
   * straight line fitted through them (total least squares), and the corners where neighbouring lines cross.
   */
  function refine(g, w, h, q) {
    const lines = [];
    for (let s = 0; s < 4; s++) {
      const a = q[s], b = q[(s + 1) % 4], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 8) return null;
      const tx = (b[0] - a[0]) / L, ty = (b[1] - a[1]) / L;
      // outward normal: the quad runs clockwise on screen (y down) after ordering, so outward is (ty, -tx)
      const nx = ty, ny = -tx, reach = Math.max(3, L / 12), pts = [];
      for (let i = 0; i < 24; i++) {
        const t = 0.12 + 0.76 * i / 23, cx = a[0] + (b[0] - a[0]) * t, cy = a[1] + (b[1] - a[1]) * t;
        let bestD = 0, bestO = null; const step = 0.5, prof = [];
        for (let o = -reach; o <= reach + 1e-9; o += step) prof.push(at(g, w, h, cx + nx * o, cy + ny * o));
        for (let k = 1; k < prof.length - 1; k++) { const d = prof[k + 1] - prof[k - 1]; if (d > bestD) { bestD = d; bestO = k; } }
        if (bestO == null || bestD < 20) continue;
        // where the profile crosses halfway between the frame's black (inside) and the paper (outside): sharper than the
        // steepest step for a blurred edge
        const mean = (i0, i1) => { let s2 = 0, n = 0; for (let k = Math.max(0, i0); k <= Math.min(prof.length - 1, i1); k++) { s2 += prof[k]; n++; } return n ? s2 / n : null; };
        const lo = mean(bestO - 6, bestO - 3), hi = mean(bestO + 3, bestO + 6); if (lo == null || hi == null || hi - lo < 20) continue;
        const half = (lo + hi) / 2; let o = null;
        for (let k = Math.max(0, bestO - 3); k < Math.min(prof.length - 1, bestO + 3); k++) if (prof[k] <= half && prof[k + 1] > half) { o = -reach + (k + (half - prof[k]) / (prof[k + 1] - prof[k])) * step; break; }
        if (o == null) continue;
        pts.push([cx + nx * o, cy + ny * o]);
      }
      if (pts.length < 8) return null;
      const mx = pts.reduce((s2, p) => s2 + p[0], 0) / pts.length, my = pts.reduce((s2, p) => s2 + p[1], 0) / pts.length;
      let sxx = 0, sxy = 0, syy = 0; pts.forEach(p => { const dx = p[0] - mx, dy = p[1] - my; sxx += dx * dx; sxy += dx * dy; syy += dy * dy; });
      const th = 0.5 * Math.atan2(2 * sxy, sxx - syy);              // the line's direction
      lines.push({ p: [mx, my], d: [Math.cos(th), Math.sin(th)] });
    }
    const cross2 = (A, B) => {
      const den = A.d[0] * B.d[1] - A.d[1] * B.d[0]; if (Math.abs(den) < 1e-6) return null;
      const t = ((B.p[0] - A.p[0]) * B.d[1] - (B.p[1] - A.p[1]) * B.d[0]) / den;
      return [A.p[0] + A.d[0] * t, A.p[1] + A.d[1] * t];
    };
    const out = [];
    for (let s = 0; s < 4; s++) { const c = cross2(lines[(s + 3) % 4], lines[s]); if (!c) return null; out.push(c); }
    // a refined corner far from its rough one means a line was fitted to something else: keep the rough quad
    return out.every((c, i) => Math.hypot(c[0] - q[i][0], c[1] - q[i][1]) < Math.max(4, Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]) / 10)) ? out : null;
  }
  /** Clockwise on screen (y down), starting anywhere. */
  function clockwise(q) {
    let s = 0; for (let i = 0; i < 4; i++) { const a = q[i], b = q[(i + 1) % 4]; s += a[0] * b[1] - b[0] * a[1]; }
    return s > 0 ? q : [q[0], q[3], q[2], q[1]];
  }

  function detect(img, opts) {
    const o = opts || {}, W = img.width, H = img.height, full = grey(img);
    const sm = shrink(full, W, H, o.max || 1600), out = [];
    const minSide = Math.max(10, o.minSide || 12);
    for (const win of [Math.max(15, Math.round(Math.min(sm.w, sm.h) / 8) | 1), Math.max(9, Math.round(Math.min(sm.w, sm.h) / 30) | 1)]) {
      const mask = threshold(sm.g, sm.w, sm.h, win, 6);
      for (const reg of regions(mask, sm.w, sm.h, minSide)) {
        const Hl = hull(reg.edge); if (Hl.length < 4) continue;
        let q = quad(Hl); if (!q) continue;
        const qa = area(q), ha = area(Hl);
        if (qa < minSide * minSide || qa / ha < 0.9) continue;                         // not four-sided
        q = clockwise(q);
        const sides = q.map((p, i) => Math.hypot(q[(i + 1) % 4][0] - p[0], q[(i + 1) % 4][1] - p[1]));
        if (Math.min(...sides) / Math.max(...sides) < 0.25) continue;                   // a sliver, not a card in view
        // the quad on the full photo: boundary pixels sit half a pixel inside the edge
        const cx = q.reduce((s, p) => s + p[0], 0) / 4, cy = q.reduce((s, p) => s + p[1], 0) / 4;
        let Q = q.map(p => { const dx = p[0] - cx, dy = p[1] - cy, L = Math.hypot(dx, dy) || 1; return [(p[0] + 0.5 + 0.7 * dx / L) * sm.k - 0.5, (p[1] + 0.5 + 0.7 * dy / L) * sm.k - 0.5]; });
        const c = cells(full, W, H, Q); if (!c) continue;
        const code = read(c); if (!code) continue;
        Q = refine(full, W, H, Q) || Q;
        const c2 = cells(full, W, H, Q), code2 = c2 && read(c2);
        const use = code2 && code2.id === code.id && code2.turn === code.turn ? code2 : code;
        const pts = [0, 1, 2, 3].map(i => Q[(i + use.turn) % 4]).map(p => [(p[0] + 0.5) / W, (p[1] + 0.5) / H]);
        const px = sides.reduce((s, v) => s + v, 0) / 4 * sm.k;
        if (out.some(d => Math.hypot(d.pts[0][0] - pts[0][0], (d.pts[0][1] - pts[0][1]) * H / W) * W < px / 6)) continue;   // the same card from the other window
        out.push({ id: use.id, mm: card(use.id).mm, pts, px: Math.round(px), err: use.err });
      }
    }
    return out.sort((a, b) => b.px - a.px);
  }

  /** Browser: the pixels of a canvas or decoded image, at most max (default 2400) on the long side. */
  function fromImage(image, doc, max) {
    const w0 = image.naturalWidth || image.width, h0 = image.naturalHeight || image.height, k = Math.min(1, (max || 2400) / Math.max(w0, h0));
    const c = doc.createElement('canvas'); c.width = Math.round(w0 * k); c.height = Math.round(h0 * k);
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(image, 0, 0, c.width, c.height);
    return g.getImageData(0, 0, c.width, c.height);
  }

  return { CODES, CARDS, card, svg, page, detect, fromImage, _: { squareTo, map, hull, quad, read, cells, refine, threshold, grey } };
});
