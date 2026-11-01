// 45-hm-estate-plan.js — the Birtok land plan of Gépország (CITY-D45 note, D52 A, docs/city/homeland/07-growth-and-land.md §7.2):
// a drive as an estate seen from above. The whole square is the drive's capacity and every plot takes the area its bytes
// really take, so one square metre means the same bytes on every drive. Pure data, no drawing: 46-hm-estate draws it,
// spec-homeland tests it. It gets sizes, kinds and folder names, never a file name (estate-walk.js has none to give).

const HM_EST_SIDE = 330, HM_EST_GAP = 0.5, HM_HALL_SHARE = 0.12, HM_MIN_DETAIL = 7;
const HM_EST_NAME = { image: 'Képtár', audio: 'Koncertterem', video: 'Mozi', doc: 'Könyvtár', code: 'Műhely', archive: 'Raktár', program: 'Gyártelep', other: 'Lakónegyed' };
// area scales with capacity across drives, which makes them comparable side by side
const hmEstSide = (size, biggest) => HM_EST_SIDE * Math.sqrt(size / Math.max(size, biggest));

// squarified treemap: items {v} into a rectangle, each gets x, y, w, h with its share of the area
function hmSquarify(items, x, y, w, h) {
  const list = items.filter(i => i.v > 0).sort((a, b) => b.v - a.v), total = list.reduce((a, i) => a + i.v, 0);
  if (!total || w <= 0 || h <= 0) return [];
  const k = w * h / total;
  const worst = (row, side) => { let s = 0, lo = Infinity, hi = 0; for (const i of row) { const a = i.v * k; s += a; lo = Math.min(lo, a); hi = Math.max(hi, a); } return Math.max(side * side * hi / (s * s), s * s / (side * side * lo)); };
  let row = [], at = 0;
  const lay = () => {
    const sum = row.reduce((a, i) => a + i.v * k, 0), wide = w >= h, side = wide ? h : w, thick = sum / side;
    let p = 0;
    for (const i of row) { const len = i.v * k / thick; if (wide) Object.assign(i, { x, y: y + p, w: thick, h: len }); else Object.assign(i, { x: x + p, y, w: len, h: thick }); p += len; }
    if (wide) { x += thick; w -= thick; } else { y += thick; h -= thick; }
    row = [];
  };
  while (at < list.length) {
    const side = Math.min(w, h), it = list[at];
    if (!row.length || worst(row.concat(it), side) <= worst(row, side)) { row.push(it); at++; } else lay();
  }
  if (row.length) lay();
  return list;
}

// what stands on one plot: the largest files, a hall for each kind that matters here, and homes for all the rest
function hmPlotLeaves(kid, rect) {
  const left = Object.assign({}, kid.kinds), leaves = [];
  if (rect.w * rect.h < HM_MIN_DETAIL) return [{ type: 'homes', v: kid.size, bytes: kid.size, files: kid.files, bands: kid.bands }];
  for (const [size, kind] of kid.top || []) { leaves.push({ type: 'tower', v: size, bytes: size, kind }); left[kind] = Math.max(0, (left[kind] || 0) - size); }
  let rest = kid.size - leaves.reduce((a, l) => a + l.v, 0);
  for (const [kind, bytes] of Object.entries(left)) if (kind !== 'other' && bytes >= kid.size * HM_HALL_SHARE) { leaves.push({ type: 'hall', v: bytes, bytes, kind }); rest -= bytes; }
  if (rest > 0) leaves.push({ type: 'homes', v: rest, bytes: rest, files: kid.files, bands: kid.bands });
  return leaves;
}

// vol {letter, size, free}; walk is estate-walk.js's result, or null while it is still walking
function hmEstatePlan(vol, walk, biggest) {
  const side = hmEstSide(vol.size, biggest), org = -side / 2, used = Math.max(0, vol.size - vol.free);
  const dirs = walk ? walk.dirs.filter(d => d.size > 0).map((d, i) => ({ type: 'dir', v: d.size, top: walk.dirs.indexOf(d), d, i })) : [];
  const read = Math.min(used, dirs.reduce((a, d) => a + d.v, 0)), unread = used - read;
  const cells = hmSquarify([{ type: 'free', v: vol.free }, { type: 'unread', v: unread }, ...dirs], org, org, side, side), plots = [];
  for (const c of cells) if (c.type === 'dir') {
    const kids = c.d.kids.filter(k => k.size > 0).map(k => ({ v: k.size, k, kid: c.d.kids.indexOf(k) }));
    for (const q of hmSquarify(kids, c.x + HM_EST_GAP, c.y + HM_EST_GAP, c.w - HM_EST_GAP * 2, c.h - HM_EST_GAP * 2)) {
      const r = { x: q.x + 0.25, y: q.y + 0.25, w: Math.max(0.2, q.w - 0.5), h: Math.max(0.2, q.h - 0.5) };
      plots.push(Object.assign(r, { top: c.top, kid: q.kid, bytes: q.k.size, files: q.k.files, kinds: q.k.kinds, name: c.d.name, sub: q.k.own ? '' : q.k.rest ? `+ ${q.k.rest} további` : q.k.name, partial: !!q.k.partial,
        leaves: hmSquarify(hmPlotLeaves(q.k, r), r.x, r.y, r.w, r.h) }));
    }
  }
  return { letter: vol.letter, size: vol.size, free: vol.free, used, read, unread, side, cells, plots, partial: !!(walk && walk.partial), measured: !!walk };
}
