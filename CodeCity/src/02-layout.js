// 02-layout.js — squarified treemap: folders are districts, files are building plots.
// Laid out ONCE over every file that ever existed (maxLoc), so nothing moves during a replay.
// World units: a file's plot area ~ maxLoc^0.7 (a 41k-line file would otherwise swallow the city).

const PLATE = 0.5;                                  // district plate thickness, one per folder level
const padOf = depth => Math.max(0.8, 4 - depth * 0.8); // street width around a district's contents
const fileWeight = f => Math.max(4, Math.pow(Math.max(f.maxLoc, 1), 0.7));

function weigh(d) {
  let sum = 0;
  for (const f of d.files) { f.w = fileWeight(f); sum += f.w; }
  for (const c of d.dirs.values()) sum += weigh(c);
  d.inner = sum;
  d.w = Math.pow(Math.sqrt(sum) + 2 * padOf(d.depth), 2);
  return d.w;
}

// Bruls/Huizing/van Wijk squarify: fill rows along the short side while the worst aspect improves.
function squarify(items, x, z, w, h, place) {
  const total = items.reduce((s, it) => s + it.w, 0);
  if (!total || w <= 0 || h <= 0) return;
  const k = (w * h) / total;
  let rest = items.map(it => ({ it, a: it.w * k }));
  const worst = (row, s) => {
    let sum = 0, mx = 0, mn = Infinity;
    for (const r of row) { sum += r.a; mx = Math.max(mx, r.a); mn = Math.min(mn, r.a); }
    return Math.max((s * s * mx) / (sum * sum), (sum * sum) / (s * s * mn));
  };
  while (rest.length) {
    const s = Math.min(w, h);
    let n = 1, best = worst(rest.slice(0, 1), s);
    while (n < rest.length) { const t = worst(rest.slice(0, n + 1), s); if (t > best) break; best = t; n++; }
    const row = rest.slice(0, n), ra = row.reduce((a, r) => a + r.a, 0);
    if (w >= h) {
      const cw = ra / h; let zz = z;
      for (const r of row) { const rh = r.a / cw; place(r.it, x, zz, cw, rh); zz += rh; }
      x += cw; w -= cw;
    } else {
      const rh = ra / w; let xx = x;
      for (const r of row) { const rw = r.a / rh; place(r.it, xx, z, rw, rh); xx += rw; }
      z += rh; h -= rh;
    }
    rest = rest.slice(n);
  }
}

function layoutDir(d, x, z, w, h) {
  d.rect = { x, z, w, h };
  const p = Math.min(padOf(d.depth), w / 4, h / 4);
  const items = [...d.dirs.values(), ...d.files].sort((a, b) => b.w - a.w || (a.path || a.p).localeCompare(b.path || b.p));
  squarify(items, x + p, z + p, w - 2 * p, h - 2 * p, (it, ix, iz, iw, ih) => {
    if (it.dirs) { layoutDir(it, ix, iz, iw, ih); return; }
    const g = Math.min(0.15 * Math.min(iw, ih), 1.2);    // gap between neighbouring buildings
    it.rect = { x: ix + g, z: iz + g, w: Math.max(0.2, iw - 2 * g), h: Math.max(0.2, ih - 2 * g) };
    it.base = (d.depth + 1) * PLATE;
  });
}

function layoutCity(model) {
  const side = Math.sqrt(weigh(model.root));
  layoutDir(model.root, -side / 2, -side / 2, side, side);
  model.side = side;
}

// height from commit count — switchable in a later WP
const heightOf = f => 1.5 + 5 * Math.log2(1 + f.n);

// share of lit windows: how recently the file changed, on the repo's own clock (first..last commit),
// squared so only genuinely recent work lights up; a few windows always burn
function litOf(f, model) {
  const c = model.city.commits;
  if (!c.length || f.last < 0) return 0.06;
  const t0 = c[0][0], t1 = c[c.length - 1][0], span = Math.max(1, t1 - t0);
  const r = 1 - (t1 - c[f.last][0]) / span;
  return 0.06 + 0.86 * r * r;
}
