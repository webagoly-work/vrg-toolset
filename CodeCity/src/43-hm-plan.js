// 43-hm-plan.js — the Növekedés plan of Gépország (CITY-D42 C, docs/city/homeland/07-growth-and-land.md §7.1): the repo's git
// history as an organic street plan. Pure data, no drawing: 44-hm-grow draws it, spec-homeland tests it. Distance from the
// hub is commit time, so the village at the centre is the oldest code and the rim is this week; the order around the hub is
// the order the ideas first appeared in. Sizes are lines of code. The curve of a street is decoration, and the panel says so.

const HM_BINS = 7, HM_R0 = 8, HM_R1 = 27.5, HM_HUB_R = 5.5;
const HM_LOT_SIZE = [[5000, 'warehouse'], [500, 'boxes'], [0, 'pack']];
function hmKindOf(lang) {
  if (lang === 'Markdown' || lang === 'Text') return 'docs';
  return ['JSON', 'XML', 'YAML', 'Data', 'CAD', 'SVG', 'Other'].includes(lang) ? 'data' : 'code';
}
const hmAreaOf = p => { const i = p.indexOf('/'); return i < 0 ? '' : p.slice(0, i); };
const hmHash = s => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 9973; return h / 9973; };
// a point of an idea's street: its angle bends a little as it leaves the hub
function hmPolar(a, r, side = 0) {
  const k = r / HM_R1, ang = a.ang + a.bend * k * k, dir = [Math.sin(ang), -Math.cos(ang)];
  return [50 + dir[0] * r - dir[1] * side, 50 + dir[1] * r + dir[0] * side];
}
const hmBinR = b => HM_R0 + (b + 0.5) / HM_BINS * (HM_R1 - HM_R0);
const hmTimeR = (born, last) => HM_R0 + born / Math.max(1, last) * (HM_R1 - HM_R0);

function hmGrowthPlan(city, tools = []) {
  const last = Math.max(1, city.commits.length - 1), byName = new Map();
  const area = n => { let a = byName.get(n); if (!a) byName.set(n, a = { name: n, born: Infinity, last: 0, files: 0, loc: 0, gone: 0, atStart: 0, lots: new Map(), mv: [] }); return a; };
  const binOf = born => Math.min(HM_BINS - 1, Math.floor(born / (last + 1) * HM_BINS));
  const fileArea = city.files.map(f => { const n = hmAreaOf(f.p); return n.startsWith('.') ? null : n; });
  city.files.forEach((f, i) => {
    if (fileArea[i] === null) return;
    const a = area(fileArea[i]), b = binOf(f.born), kind = f.gone ? 'gone' : hmKindOf(f.lang), key = b + kind;
    a.born = Math.min(a.born, f.born); a.last = Math.max(a.last, f.last); a.files++;
    if (f.gone) a.gone++; else a.loc += f.loc;
    if (f.born === 0) a.atStart++;
    if (f.mv) a.mv.push(f.p.slice(0, f.p.lastIndexOf('/') + 1));
    let lot = a.lots.get(key);
    if (!lot) a.lots.set(key, lot = { area: a.name, bin: b, kind, loc: 0, files: 0, born: f.born });
    lot.loc += f.loc; lot.files++; lot.born = Math.min(lot.born, f.born);
  });
  const areas = [...byName.values()].sort((x, y) => x.born - y.born || y.loc - x.loc || (x.name < y.name ? -1 : 1));
  const hub = areas.reduce((h, a) => (!h || a.atStart > h.atStart ? a : h), null);
  const step = Math.PI * 2 / Math.max(1, areas.length), lots = [], shops = [], index = new Map();
  areas.forEach((a, i) => {
    a.ang = i * step; a.bend = (hmHash(a.name) - 0.5) * 0.14; a.i = i; index.set(a.name, a);
    // the warehouse side of the street: the kinds of one period share its stretch of road
    const room = (HM_R1 - HM_R0) / HM_BINS, inBin = new Map();
    for (const l of a.lots.values()) { if (!inBin.has(l.bin)) inBin.set(l.bin, []); inBin.get(l.bin).push(l); }
    let end = HM_R0;
    for (const [b, list] of inBin) list.sort((x, y) => y.loc - x.loc).forEach((l, k) => {
      const r = hmBinR(b) + (k - (list.length - 1) / 2) * room / list.length, lat = r * step / 2 - 0.45;
      l.size = HM_LOT_SIZE.find(s => l.loc >= s[0])[1];
      l.foot = Math.min(room / list.length * 0.86, Math.max(0.5, lat));
      [l.u, l.v] = hmPolar(a, r, 0.75 + l.foot / 2); l.r = r;
      lots.push(l); end = Math.max(end, r);
    });
    a.end = end + 1.4;
  });
  // shops: the programs START lists, beside the road they belong to; a garden when that program wears the design system
  const prefix = (city.repo && city.repo.name || '') + '/';
  const relPath = p => { const s = String(p || '').replace(/\\/g, '/'), k = s.indexOf(prefix); return k >= 0 ? s.slice(k + prefix.length) : s; };
  const seen = new Map();
  for (const t of tools) {
    const p = relPath(t.path), a = index.get(hmAreaOf(p));
    if (!a) continue;
    const f = city.files.find(x => x.p === p), born = f ? f.born : a.born, b = binOf(born), n = seen.get(a.name + b) || 0;
    seen.set(a.name + b, n + 1);
    const dir = p.slice(0, p.lastIndexOf('/') + 1).replace(/dist\/$/, ''), r = hmBinR(b) + (n - 0.5) * 1.5, foot = Math.min(1.1, Math.max(0.5, r * step / 2 - 0.5));
    const [u, v] = hmPolar(a, r, -0.75 - foot / 2);
    a.end = Math.max(a.end, r + 1.4);
    shops.push({ name: t.name, area: a.name, born, u, v, foot, r, garden: dir ? a.mv.some(m => m.startsWith(dir) || dir.startsWith(m)) : a.mv.length > 0, ga: hmPolar(a, r, -0.75 - foot * 1.6) });
  }
  // ideas merging: areas that keep changing in the same commits; a sweep across the repo says nothing about two ideas
  const pair = new Map(), seenIn = new Map(), firstOf = new Map();
  city.commits.forEach((c, ci) => {
    if (!ci) return;
    const hit = new Set(), ch = c[5] || [];
    for (let i = 0; i < ch.length; i += 3) { const n = fileArea[ch[i]]; if (n !== null && n !== undefined) hit.add(n); }
    for (const n of hit) seenIn.set(n, (seenIn.get(n) || 0) + 1);
    if (hit.size < 2 || hit.size > 6) return;
    const l = [...hit].sort();
    for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) { const k = l[i] + '|' + l[j]; pair.set(k, (pair.get(k) || 0) + 1); if (!firstOf.has(k)) firstOf.set(k, ci); }
  });
  const links = [...pair].map(([k, n]) => {
    const [x, y] = k.split('|'), a = index.get(x), b = index.get(y), d = Math.abs(a.i - b.i), turn = Math.min(d, areas.length - d) * step;
    return { a: x, b: y, n, first: firstOf.get(k), j: n / (seenIn.get(x) + seenIn.get(y) - n), turn };
  }).filter(l => l.n >= 3 && l.turn < 1.9).sort((p, q) => q.j - p.j || q.n - p.n || (p.a + p.b < q.a + q.b ? -1 : 1)).slice(0, 6);
  for (const l of links) { const a = index.get(l.a), b = index.get(l.b), r = Math.max(hmTimeR(l.first, last), Math.min(hmTimeR(Math.max(a.born, b.born), last), HM_R1 - 2)); l.ua = hmPolar(a, Math.min(r, a.end)); l.ub = hmPolar(b, Math.min(r, b.end)); }
  return { hub: hub && hub.name, hubStart: hub ? hub.atStart : 0, areas, lots, shops, links, last, head: city.repo && city.repo.head };
}
