// 02-grow.js — Növekedés, the grown city (Kódváros 2.0, K2-01; CITY-D54 A: the default plan).
// The treemap (02-layout.js, now "Tervrajz") is a planned city. This is the same set of buildings placed the way a
// village grows: the first track runs from the castle site to the first workshop; every top-level area, in the order it
// first appeared in git, starts a road from the road of the area it most often changes with, out towards free land;
// its files take plots fronting the road, in the order they were born, on alternating sides; a full road branches.
//
// The promise of the layout stays: it is computed ONCE over every file that ever existed, so nothing moves during a
// replay, and it is deterministic (one seed from the first commit, per-path hashes for every variation). Plots are
// rotated to their road: f.rot is the rotation about +Y, f.rect is the plot's own w × h centred on the plot.
// Both plans are kept (f.rectT / f.rectG …) so P can fly the buildings between them (planSet, at the end).
// docs/city/v2/README.md §3.

const GROWTH = {
  cell: 0.5,          // occupancy grid, world units
  step: 3,            // road segment length
  wiggle: 0.16,       // max heading change per segment (rad): the organic bend
  spineW: 3.2,        // an area's main road
  laneW: 2.0,         // a side lane
  setback: 1.1,       // plot edge to road edge (more than a grid cell, or rounding blocks it)
  gap: 1.2,           // between neighbouring plots on one side (a little air between houses)
  castle: 42,         // the castle site, north of the first workshop (K2-04 puts the keep there)
  room: 11,           // free probes ahead that count as "room enough" (of 15)
  minRoom: 6,         // fewer free probes than this: no street starts there
  pull: 0.08,         // how strongly a new street prefers the centre
  slot: 5,            // a gap left in a row of plots, where a side street can leave later
  slotEvery: [14, 30],// frontage between two such gaps (min, max)
  maxSpine: 110,      // a main road stops here; the rest of its files branch off through its gaps
  maxLane: 60,        // the same for a side lane
};

// ---- K2-04 districts (README §4): who lives where, and how their streets and plots are laid out. Matched in order
// against a group's path (area, or area/sub-folder); the first match wins. gap / setback scale GROWTH's, wiggle
// scales the bend, grid = straight streets on the world axes (downtown, laid out late as downtowns are), pull scales
// how strongly new streets keep to the centre (negative: they head for the shore), pool = villas get garden pools.
const GROWTH_DISTRICTS = [
  { code: 1, id: 'akademia', name: 'Akadémia', re: /^Planner(\/|$)/, gap: 1.1, setback: 1.2, wiggle: 0.7, pull: 1 },
  { code: 2, id: 'belvaros', name: 'Belváros', re: /^(docs|Calculator|Inventory)(\/|$)/, gap: 0.6, setback: 1, wiggle: 0, pull: 1, grid: true },
  { code: 4, id: 'lakopark', name: 'OmniComm Lakópark', re: /^BRIDGE\/[^/]*omnicomm/i, gap: 0.1, setback: 1.4, wiggle: 0.25, pull: 1, unit: 22 },
  { code: 3, id: 'villa', name: 'Villanegyed', re: /^BRIDGE(\/|$)/, gap: 3.2, setback: 2.2, wiggle: 1.5, pull: 0.6, pool: true },
  { code: 5, id: 'ipari', name: 'Ipari part', re: /^(Firmware|Modder|ServiceKitCYD|tools|\.github)(\/|$)/, gap: 1.1, setback: 1, wiggle: 0.6, pull: -0.15 },
  { code: 6, id: 'munkas', name: 'Munkásnegyed', re: /./, gap: 0.55, setback: 0.85, wiggle: 1, pull: 1 },
];
const growDistrict = path => GROWTH_DISTRICTS.find(d => d.re.test(path || '')) || GROWTH_DISTRICTS[GROWTH_DISTRICTS.length - 1];

// ---- deterministic randomness
function growHash(s) {                      // FNV-1a, 32 bit
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
function growRng(seed) {                    // mulberry32
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const growU = (s, k = 0) => growHash(s + '#' + k) / 4294967296;   // a stable 0..1 per path

// ---- occupancy: a set of blocked grid cells (plots and road surfaces)
function growGrid() {
  // a flat bitset over ±1024 world units (2 MB; the hot path of the whole layout), a Set beyond it
  const set = new Set(), C = GROWTH.cell, N = 4096, H = N >> 1, bits = new Uint32Array((N * N) >>> 5);
  const key = (i, j) => (i + 32768) * 65536 + (j + 32768);
  return {
    has(x, z) {
      const i = Math.floor(x / C) + H, j = Math.floor(z / C) + H;
      if (i >= 0 && i < N && j >= 0 && j < N) { const k = i * N + j; return ((bits[k >>> 5] >>> (k & 31)) & 1) === 1; }
      return set.has(key(i, j));
    },
    add(x, z) {
      const i = Math.floor(x / C) + H, j = Math.floor(z / C) + H;
      if (i >= 0 && i < N && j >= 0 && j < N) { const k = i * N + j; bits[k >>> 5] |= 1 << (k & 31); return; }
      set.add(key(i, j));
    },
    // every sample point of a rotated rectangle (centre, half sizes along u = (cos a, sin a) and its normal)
    rectFree(cx, cz, hw, hd, a) {
      const ux = Math.cos(a), uz = Math.sin(a), s = C * 0.7;   // checks sample a little coarser than marks (marks cover every cell)
      for (let p = -hw; p <= hw + 1e-6; p += Math.min(s, hw || s)) for (let q = -hd; q <= hd + 1e-6; q += Math.min(s, hd || s)) {
        if (this.has(cx + ux * p - uz * q, cz + uz * p + ux * q)) return false;
      }
      return true;
    },
    rectMark(cx, cz, hw, hd, a) {
      const ux = Math.cos(a), uz = Math.sin(a), s = C * 0.6;   // every cell a turned rectangle touches (the spec's exact overlap test guards it)
      for (let p = -hw; p <= hw + 1e-6; p += Math.min(s, hw || s)) for (let q = -hd; q <= hd + 1e-6; q += Math.min(s, hd || s)) {
        this.add(cx + ux * p - uz * q, cz + uz * p + ux * q);
      }
    },
  };
}

// ---- which areas change together (for where a new area's road leaves from)
function growAffinity(model, areaOf) {
  const pair = new Map();
  for (const c of model.city.commits) {
    const ch = c[5] || [], seen = new Set();
    for (let i = 0; i < ch.length; i += 3) { const a = areaOf[ch[i]]; if (a !== undefined) seen.add(a); }
    const list = [...seen];
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const k = Math.min(list[i], list[j]) + ':' + Math.max(list[i], list[j]);
      pair.set(k, (pair.get(k) || 0) + 1);
    }
  }
  return (a, b) => pair.get(Math.min(a, b) + ':' + Math.max(a, b)) || 0;
}

// The folder tree as areas and groups. An area is a top-level folder (root files form the town square, "Főtér").
// Chains of single-child folders collapse (Planner/projects/varler-planner/src reads as one place).
function growCollapse(d) { while (!d.files.length && d.dirs.size === 1) d = [...d.dirs.values()][0]; return d; }
function growFilesOf(d, out = []) { out.push(...d.files); d.dirs.forEach(c => growFilesOf(c, out)); return out; }
const growBorn = list => list.reduce((m, f) => Math.min(m, f.born), Infinity);

// ---- the layout
function growCity(model) {
  const files = model.city.files, rnd = growRng(growHash(String((model.city.commits[0] || [])[4] || model.city.repo.name)));
  const grid = growGrid(), roads = [], pools = [];
  let D = growDistrict('');   // the district being laid out (K2-04): newRoad, extend, frontage and departure read it
  const PL = typeof PLATE === 'number' ? PLATE : 0.5;

  // areas in the order they first appeared; ties: the bigger first
  const root = model.root, areas = [];
  if (root.files.length) areas.push({ name: '', dir: null, files: root.files.slice() });
  root.dirs.forEach(d => areas.push({ name: d.name, dir: d, files: growFilesOf(d) }));
  for (const a of areas) a.born = growBorn(a.files);
  areas.sort((a, b) => a.born - b.born || b.files.length - a.files.length || a.name.localeCompare(b.name));
  const areaOf = [];
  areas.forEach((a, k) => { a.k = k; for (const f of a.files) areaOf[f.i] = k; });
  const aff = growAffinity(model, areaOf);

  const weightOf = f => (typeof fileWeight === 'function' ? fileWeight(f) : Math.max(4, Math.pow(Math.max(f.maxLoc, 1), 0.7)));
  const plotOf = (f, dist) => {               // frontage × depth, aspect varied per path, area = the treemap's weight
    // a district with a unit (the terraces) caps the plot: a row of like houses, the data stays in the height
    const a = Math.min(weightOf(f) * 0.62, dist && dist.unit || Infinity), asp = 0.75 + 0.6 * growU(f.p, 1);
    return { fw: Math.sqrt(a * asp), dp: Math.sqrt(a / asp) };
  };

  // a road: a polyline that grows segment by segment, and the plots along its two sides
  function newRoad(x, z, heading, width, area, parent) {
    if (D.grid) heading = Math.round(heading / (Math.PI / 2)) * (Math.PI / 2);   // downtown keeps to the axes
    const r = { id: roads.length, pts: [[x, z]], heading, w: width, area, len: 0, cur: [0.6 * width, 0.6 * width], dead: false, parent, cum: [0],
      slots: [], next: [nextSlot(), nextSlot()], dist: D };
    roads.push(r);
    return r;
  }
  function nextSlot() { const [a, b] = GROWTH.slotEvery; return a + rnd() * (b - a); }
  function markSeg(r, x0, z0, x1, z1) {
    // the segment as one rotated rectangle (its full length and width)
    grid.rectMark((x0 + x1) / 2, (z0 + z1) / 2, Math.hypot(x1 - x0, z1 - z0) / 2, r.w / 2, Math.atan2(z1 - z0, x1 - x0));
  }
  // extend a road by one segment; it bends a little, steers away from what blocks it, and dies when boxed in
  function extend(r, steer) {
    if (r.dead) return false;
    const [x, z] = r.pts[r.pts.length - 1];
    const base = r.heading + (rnd() * 2 - 1) * GROWTH.wiggle * r.dist.wiggle + (r.dist.grid ? 0 : steer || 0);
    const grace = r.pts.length < 3 ? (r.parent ? r.parent.w / 2 : 0) + 0.8 : 0;   // leaving the host road
    for (const d of r.dist.grid ? [0, Math.PI / 2, -Math.PI / 2] : [0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05]) {
      const h = base + d, x1 = x + Math.cos(h) * GROWTH.step, z1 = z + Math.sin(h) * GROWTH.step;
      // look ahead a little past the segment, at the road's full width (plus a verge)
      let ok = true;
      for (const t of [0.8, 1.2, 1.6]) {   // ahead of the road's own end cells
        if (r.len + GROWTH.step * t < grace) continue;
        if (!grid.rectFree(x + (x1 - x) * t, z + (z1 - z) * t, 0.01, r.w / 2 + 0.6, h)) { ok = false; break; }
      }
      if (!ok) continue;
      markSeg(r, x, z, x1, z1);
      r.pts.push([x1, z1]); r.heading = h; r.len += GROWTH.step; r.cum.push(r.len);
      return true;
    }
    r.dead = true;
    return false;
  }
  function at(r, s) {                         // point and tangent angle at distance s along the road
    const c = r.cum;
    let i = 1;
    while (i < c.length - 1 && c[i] < s) i++;
    const [x0, z0] = r.pts[i - 1], [x1, z1] = r.pts[i], seg = c[i] - c[i - 1] || 1, t = Math.max(0, Math.min(1, (s - c[i - 1]) / seg));
    return [x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, Math.atan2(z1 - z0, x1 - x0)];
  }

  // place files along one road; returns the files that did not fit
  function frontage(r, list) {
    let k = 0, fails = 0;
    while (k < list.length) {
      const f = list[k], { fw, dp } = plotOf(f, r.dist);
      const side = r.cur[0] <= r.cur[1] ? 0 : 1, sgn = side ? -1 : 1;
      if (r.cur[side] >= r.next[side] && r.cur[side] !== Infinity) {   // leave a gap for a future side street
        r.slots.push({ s: r.cur[side] + GROWTH.slot / 2, side, used: false });
        r.cur[side] += GROWTH.slot; r.next[side] = r.cur[side] + nextSlot();
        continue;
      }
      const s0 = r.cur[side], s1 = s0 + fw;
      const cap = r.w > 2.5 ? GROWTH.maxSpine : GROWTH.maxLane;
      while (r.len < s1 + 0.5 && r.len < cap && extend(r)) { /* lay road ahead of the plot, up to the cap */ }
      if (r.len < s1 + 0.5) {                // the road cannot go on: try the other side, then give up
        if (r.cur[1 - side] + fw < r.len) { r.cur[side] = Infinity; continue; }
        break;
      }
      const [mx, mz, a] = at(r, (s0 + s1) / 2);
      const off = r.w / 2 + GROWTH.setback * r.dist.setback + dp / 2 + 0.3 * growU(f.p, 2) * r.dist.wiggle;
      const cx = mx - Math.sin(a) * off * sgn, cz = mz + Math.cos(a) * off * sgn;
      if (grid.rectFree(cx, cz, fw / 2 + 0.15, dp / 2 + 0.15, a)) {
        grid.rectMark(cx, cz, fw / 2 + 0.25, dp / 2 + 0.25, a);
        f.rectG = { x: cx - fw / 2, z: cz - dp / 2, w: fw, h: dp };
        f.rotG = -a; f.baseG = PL; f.areaG = r.area; f.distG = r.dist.code;
        const gap = GROWTH.gap * r.dist.gap + 0.8 * growU(f.p, 3) * Math.min(1, r.dist.gap);
        // a villa's garden pool in the gap after it (checked and marked like a plot)
        if (r.dist.pool && growU(f.p, 5) < 0.7 && gap > 2.6) {
          const pw = Math.min(gap - 1.2, 2.6), pd = Math.max(1.4, dp * 0.5), [px, pz, pa] = at(r, Math.min(r.len, s1 + gap / 2));
          const po = r.w / 2 + GROWTH.setback * r.dist.setback + pd / 2 + 0.6, qx = px - Math.sin(pa) * po * sgn, qz = pz + Math.cos(pa) * po * sgn;
          if (grid.rectFree(qx, qz, pw / 2 + 0.1, pd / 2 + 0.1, pa)) { grid.rectMark(qx, qz, pw / 2 + 0.2, pd / 2 + 0.2, pa); pools.push({ x: qx, z: qz, a: pa, w: pw, d: pd }); }
        }
        r.cur[side] = s1 + gap;
        k++; fails = 0;
      } else {
        r.cur[side] += 1;                       // something is in the way: move along
        if (++fails > 80) break;
      }
    }
    for (let i = 0; i < 2; i++) if (r.cur[i] === Infinity) r.cur[i] = r.len;
    return list.slice(k);
  }

  // where a new road leaves from: a gap left in a host road's frontage (or a live road end) with the most free land
  // ahead, leaning outwards; only when there is none, any point of the host roads
  function freeAhead(x, z, h) {
    let free = 0;
    for (let d = 3; d <= 19; d += 4) for (const w of [-5, 0, 5]) {
      if (!grid.has(x + Math.cos(h) * d - Math.sin(h) * w, z + Math.sin(h) * d + Math.cos(h) * w)) free++;
    }
    return free;
  }
  const tried = new Set();
  function departure(hostRoads, hub) {
    // A town grows compactly: of the spots with enough room ahead, the one nearest the centre wins.
    // Room is capped, so a wide-open road end does not drag every new street outwards.
    const score = (x, z, free) => Math.min(free, GROWTH.room) - Math.hypot(x - hub[0], z - hub[1]) * GROWTH.pull * D.pull + rnd() * 1.5;
    let best = null;
    for (const r of hostRoads) {
      for (const sl of r.slots) {
        if (sl.used || r.len < sl.s + 1) continue;
        const [x, z, a] = at(r, sl.s), h = a + (sl.side ? -1 : 1) * Math.PI / 2, free = freeAhead(x, z, h);
        if (free < GROWTH.minRoom) continue;
        const sc = score(x, z, free) + 2;      // a gap left for a street is the natural place for one
        if (!best || sc > best.sc) best = { sc, x, z, h, host: r, slot: sl };
      }
      if (!r.dead && r.pts.length > 1) {
        const [x, z] = r.pts[r.pts.length - 1], free = freeAhead(x, z, r.heading);
        if (free < GROWTH.minRoom) continue;
        const sc = score(x, z, free);
        if (!best || sc > best.sc) best = { sc, x, z, h: r.heading, host: r, tip: true };
      }
    }
    if (best) { if (best.slot) best.slot.used = true; if (best.tip) best.host.dead = true; return best; }
    best = null;
    for (const r of hostRoads) for (let i = 0; i < r.pts.length; i++) {
      const [x, z] = r.pts[i], tan = i ? Math.atan2(z - r.pts[i - 1][1], x - r.pts[i - 1][0]) : r.heading;
      for (const sgn of [1, -1]) {
        const key = r.id + ':' + i + ':' + sgn;
        if (tried.has(key)) continue;                // a spot that failed once fails again: never retry it
        const h = tan + sgn * Math.PI / 2;
        const free = freeAhead(x, z, h);
        if (free < GROWTH.minRoom) { tried.add(key); continue; }
        const sc = score(x, z, free);
        if (!best || sc > best.sc) best = { sc, x, z, h, host: r, key };
      }
    }
    if (best) tried.add(best.key);
    return best;
  }

  // last resort: a lone farmstead on free land, spiralling out from the area's last road (checked like every plot)
  function farmstead(f, mine, area) {
    const { fw, dp } = plotOf(f, D), r0 = mine[mine.length - 1], [x0, z0] = r0.pts[r0.pts.length - 1];
    for (let i = 0; i < 20000; i++) {
      const ang = i * 0.5, rad = 4 + i * 0.12, cx = x0 + Math.cos(ang) * rad, cz = z0 + Math.sin(ang) * rad, a = ang + Math.PI / 2;
      if (!grid.rectFree(cx, cz, fw / 2 + 0.6, dp / 2 + 0.6, a)) continue;
      grid.rectMark(cx, cz, fw / 2 + 0.25, dp / 2 + 0.25, a);
      f.rectG = { x: cx - fw / 2, z: cz - dp / 2, w: fw, h: dp }; f.rotG = -a; f.baseG = PL; f.areaG = area; f.distG = D.code;
      return;
    }
  }

  const areaRoads = k => roads.filter(r => r.area === k);
  // lay a list of files out from a starting road; a full road branches off itself until everything has a plot
  function settle(list, road, area) {
    let rest = frontage(road, list), tries = 0;
    const mine = [road];
    while (rest.length && tries++ < 80) {
      // this group's roads first, then the whole area's, then any road in town
      const dep = departure(mine.slice(-8), [0, 0]) || departure(mine, [0, 0]) || departure(areaRoads(area), [0, 0]) || departure(roads.slice(), [0, 0]);
      if (!dep) break;
      const r = newRoad(dep.x, dep.z, dep.h, GROWTH.laneW, area, dep.host);
      const before = rest.length;
      rest = frontage(r, rest);
      if (r.pts.length < 2) roads.splice(roads.indexOf(r), 1);   // it never left: no stub road
      else mine.push(r);
      if (rest.length < before) tries = 0;
    }
    for (const f of rest) farmstead(f, mine, area);   // never a lost building

    return mine;
  }

  // the first track: castle site -> the first workshop (the hub)
  const castle = [0, -GROWTH.castle], hub = [0, 0];
  const track = newRoad(castle[0], castle[1], Math.PI / 2, GROWTH.spineW + 0.6, -1, null);
  while (track.len < GROWTH.castle && extend(track, (Math.atan2(hub[1] - track.pts[track.pts.length - 1][1], hub[0] - track.pts[track.pts.length - 1][0]) - track.heading) * 0.5)) { /* */ }
  grid.rectMark(castle[0], castle[1] - 6, 10, 9, 0);   // the castle's own ground

  // nowhere left to branch: the first free spot on a spiral out from the hub
  function openLand(c) {
    for (let i = 0; i < 40000; i++) {
      const ang = i * 0.37, rad = 10 + i * 0.05, x = c[0] + Math.cos(ang) * rad, z = c[1] + Math.sin(ang) * rad;
      if (grid.rectFree(x, z, 4, 4, 0)) return { x, z, h: ang, host: null };
    }
    return { x: c[0] + 999, z: c[1], h: 0, host: null };
  }
  const placedRoads = [];
  areas.forEach((a, k) => {
    D = growDistrict(a.name);
    let start;
    if (k === 0) {
      const [x, z] = track.pts[track.pts.length - 1];
      start = { x, z, h: track.heading + (rnd() - 0.5) * 0.5, host: track };
    } else {
      let host = 0, bestA = -1;
      for (let j = 0; j < k; j++) { const v = aff(j, k); if (v > bestA || (v === bestA && j === k - 1)) { bestA = v; host = j; } }
      const hostRoads = placedRoads[host] && placedRoads[host].length ? placedRoads[host] : [track];
      // the host's roads first, then any road at all; a road that cannot leave anywhere starts on open land
      start = departure(hostRoads, hub) || departure(roads.slice(), hub) || openLand(hub);
    }
    const spine = newRoad(start.x, start.z, start.h, a.files.length > 40 ? GROWTH.spineW : GROWTH.laneW, k, start.host);
    // the area's own files on its spine, then each group (sub-folder) on a lane of its own, in birth order
    const top = a.dir ? growCollapse(a.dir) : null;
    const direct = top ? top.files.slice() : a.files.slice();
    const groups = top ? [...top.dirs.values()].map(d => ({ d, files: growFilesOf(d) })) : [];
    groups.forEach(g => { g.born = growBorn(g.files); g.files.sort((x, y) => x.born - y.born || x.p.localeCompare(y.p)); });
    groups.sort((x, y) => x.born - y.born || x.d.name.localeCompare(y.d.name));
    direct.sort((x, y) => x.born - y.born || x.p.localeCompare(y.p));
    const mine = settle(direct, spine, k);
    for (const g of groups) {
      D = growDistrict(g.d.path || a.name + '/' + g.d.name);
      // a lane leaves the spine where it has got to; the spine grows on a little between lanes
      for (let n = 0; n < 2; n++) extend(spine);
      const dep = departure([spine], hub) || departure(mine, hub) || departure(roads.slice(), hub) || openLand(hub);
      const lane = newRoad(dep.x, dep.z, dep.h, GROWTH.laneW, k, dep.host);
      mine.push(...settle(g.files, lane, k));
      D = growDistrict(a.name);
    }
    placedRoads[k] = mine;
  });

  // district bounding rects (for the camera, tours and the HUD), and the extent
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  const bbox = (d) => {
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const f of growFilesOf(d)) {
      const r = f.rectG, cx = r.x + r.w / 2, cz = r.z + r.h / 2, e = Math.max(r.w, r.h) / 2;
      x0 = Math.min(x0, cx - e); z0 = Math.min(z0, cz - e); x1 = Math.max(x1, cx + e); z1 = Math.max(z1, cz + e);
    }
    d.rectG = isFinite(x0) ? { x: x0, z: z0, w: x1 - x0, h: z1 - z0 } : { x: 0, z: 0, w: 0, h: 0 };
    d.dirs.forEach(bbox);
  };
  bbox(root);
  for (const r of roads) for (const [x, z] of r.pts) { minX = Math.min(minX, x); minZ = Math.min(minZ, z); maxX = Math.max(maxX, x); maxZ = Math.max(maxZ, z); }
  const rr = root.rectG;
  minX = Math.min(minX, rr.x); minZ = Math.min(minZ, rr.z); maxX = Math.max(maxX, rr.x + rr.w); maxZ = Math.max(maxZ, rr.z + rr.h);

  // the town: a star-shaped blob around everything built, smoothed (02-island.js builds the island around it)
  const N = 96, rad = new Array(N).fill(12), cx0 = (minX + maxX) / 2, cz0 = (minZ + maxZ) / 2;
  const reach = (x, z, e) => { const a = Math.atan2(z - cz0, x - cx0), i = ((Math.round(a / (2 * Math.PI) * N) % N) + N) % N, d = Math.hypot(x - cx0, z - cz0) + e; if (d > rad[i]) rad[i] = d; };
  for (const f of files) if (f.rectG) { const r = f.rectG; reach(r.x + r.w / 2, r.z + r.h / 2, Math.max(r.w, r.h) * 0.75 + 6); }
  for (const r of roads) for (const [x, z] of r.pts) reach(x, z, r.w + 6);
  reach(castle[0], castle[1] - 6, 18);
  // a lone far ray (one long road) would be a spike: each ray reaches at least 94 % of its neighbours, a headland
  for (let pass = 0; pass < 24; pass++) for (let i = 0; i < N; i++) rad[i] = Math.max(rad[i], rad[(i + N - 1) % N] * 0.94, rad[(i + 1) % N] * 0.94);
  for (let pass = 0; pass < 3; pass++) {
    const c = rad.slice();
    for (let i = 0; i < N; i++) rad[i] = Math.max(c[i], (c[(i + N - 1) % N] + 2 * c[i] + c[(i + 1) % N]) / 4);
  }
  // K2-02 (02-island.js): the town blob is the flat ground; the island around it is twice its area
  const bridge = areas.find(a => a.name === 'BRIDGE');
  const villas = bridge ? (() => { let x = 0, z = 0, n = 0; for (const f of bridge.files) if (f.rectG) { x += f.rectG.x + f.rectG.w / 2; z += f.rectG.z + f.rectG.h / 2; n++; } return n ? [x / n, z / n] : null; })() : null;
  const island = growIsland({ built: rad, cx: cx0, cz: cz0, castle, villas, PL, roads: roads.map(r => r.pts),
    plots: files.filter(f => f.rectG).map(f => [f.rectG.x + f.rectG.w / 2, f.rectG.z + f.rectG.h / 2, Math.hypot(f.rectG.w, f.rectG.h) / 2]), seed: growHash(String((model.city.commits[0] || [])[4] || model.city.repo.name) + ':island') });

  const side = 2 * Math.max(...rad);   // the town's size: camera, fog and the Land keep reading the town, not the island
  model.grow = { pools, districts: growDistrictCentres(files), roads: roads.map(r => ({ pts: r.pts, w: r.w, area: r.area })).concat(island.access.map(r => ({ pts: r.pts, w: r.w, area: -2 }))), coast: island.coastPts, island, side, castle, hub, centre: [cx0, cz0],
    areas: areas.map(a => ({ name: a.name || 'Főtér', born: a.born, files: a.files.length })) };
  return model.grow;
}

// where each district's name goes: the middle of its buildings (K2-04 labels)
function growDistrictCentres(files) {
  const acc = new Map();
  for (const f of files) if (f.rectG && f.distG) { const a = acc.get(f.distG) || { x: 0, z: 0, n: 0 }; a.x += f.rectG.x + f.rectG.w / 2; a.z += f.rectG.z + f.rectG.h / 2; a.n++; acc.set(f.distG, a); }
  return [...acc].filter(([, a]) => a.n >= 8).map(([code, a]) => ({ code, name: GROWTH_DISTRICTS.find(d => d.code === code).name, x: a.x / a.n, z: a.z / a.n, n: a.n }));
}

// ---- the two plans and the move between them
const plan = { mode: 'grow', raf: 0 };
try { const m = localStorage.getItem('kv.plan'); if (m === 'tree' || m === 'grow') plan.mode = m; } catch (e) { /* file:// or private */ }

// keep the treemap's answer beside the grown one, then make one of them current
function planPrepare(model) {
  const walk = d => { d.rectT = d.rect; d.dirs.forEach(walk); };
  walk(model.root);
  for (const f of model.city.files) { f.rectT = f.rect; f.baseT = f.base; f.rotT = 0; }
  model.sideT = model.side;
  growCity(model);
  planUse(model, plan.mode);
}
function planUse(model, mode) {
  const g = mode === 'grow';
  const walk = d => { d.rect = g ? d.rectG : d.rectT; d.dirs.forEach(walk); };
  walk(model.root);
  for (const f of model.city.files) { f.rect = g ? f.rectG : f.rectT; f.base = g ? f.baseG : f.baseT; f.rot = g ? f.rotG : 0; }
  model.side = g ? model.grow.side : model.sideT;
}

// the ground and the streets of the grown plan, added to the city's group by 03-scene's showCity
function growMeshes(model, group) {
  const PL = typeof PLATE === 'number' ? PLATE : 0.5, gw = model.grow;
  const ground = islandMeshes(gw.island, PL);   // 02-island.js: terrain, woods, airfield, harbour, lighthouse
  const pos = [], col = [], c = new THREE.Color();
  for (const r of gw.roads) {
    c.setHSL(0.57, 0.16, r.area < 0 ? 0.14 : r.w > 2.5 ? 0.115 : 0.09);   // night paving: dark, so the lamps' pools show (50-mood)
    for (let i = 1; i < r.pts.length; i++) {
      const [x0, z0] = r.pts[i - 1], [x1, z1] = r.pts[i], a = Math.atan2(z1 - z0, x1 - x0), nx = -Math.sin(a) * r.w / 2, nz = Math.cos(a) * r.w / 2;
      const ext = 0.25, ex = Math.cos(a) * ext, ez = Math.sin(a) * ext, y = PL + 0.03;   // overlap the joints
      const q = [[x0 - ex + nx, z0 - ez + nz], [x0 - ex - nx, z0 - ez - nz], [x1 + ex - nx, z1 + ez - nz], [x1 + ex + nx, z1 + ez + nz]];
      for (const k of [0, 1, 2, 0, 2, 3]) { pos.push(q[k][0], y, q[k][1]); col.push(c.r, c.g, c.b); }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const streets = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  const g = new THREE.Group();
  g.add(ground, streets, districtMeshes(gw, PL));   // 52-district: the castle, the villas' pools, the names
  g.name = 'grow';
  group.add(g);
  return g;
}

// P: fly every building between the two plans (the same instances; only their matrices move)
function planSet(mode, animate = 1600) {
  if (!current || !world || mode === plan.mode) return;
  plan.mode = mode;
  try { localStorage.setItem('kv.plan', mode); } catch (e) { /* */ }
  const files = current.city.files, g = mode === 'grow';
  const from = files.map(f => ({ r: f.rect, b: f.base, a: f.rot || 0 }));
  const sideA = current.side, cA = g ? [0, 0] : current.grow.centre;
  planUse(current, mode);
  const to = files.map(f => ({ r: f.rect, b: f.base, a: f.rot || 0 }));
  // the camera keeps its place relative to the city (the two plans differ in size; a fixed distance would cross a zoom level)
  const k = current.side / sideA, cB = g ? current.grow.centre : [0, 0], t = orbit.target;
  flyCamera([cB[0] + (t.x - cA[0]) * k, cB[1] + (t.z - cA[1]) * k, orbit.theta, orbit.phi, orbit.r * k], animate || 0);
  world.plates.visible = false; if (world.grow) world.grow.visible = false;
  const done = () => {
    planUse(current, mode);
    world.plates.visible = !g; if (world.grow) world.grow.visible = g;
    scene.fog.near = current.side * 1.1; scene.fog.far = current.side * 3.2;
    writeInstances(replay.cur);
    planChanged.forEach(fn => { try { fn(mode); } catch (e) { console.warn(e); } });
    planButton();
    requestRender();
  };
  cancelAnimationFrame(plan.raf);
  if (!animate) { done(); return; }
  const t0 = performance.now();
  const step = () => {
    const k = Math.min(1, (performance.now() - t0) / animate), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2, lift = Math.sin(Math.PI * k) * current.side * 0.06;
    for (let i = 0; i < files.length; i++) {
      const A = from[i], B = to[i], ra = A.r, rb = B.r;
      const cx = ra.x + ra.w / 2 + (rb.x + rb.w / 2 - ra.x - ra.w / 2) * e, cz = ra.z + ra.h / 2 + (rb.z + rb.h / 2 - ra.z - ra.h / 2) * e;
      const w = ra.w + (rb.w - ra.w) * e, h = ra.h + (rb.h - ra.h) * e;
      let da = B.a - A.a; da = Math.atan2(Math.sin(da), Math.cos(da));
      files[i].rect = { x: cx - w / 2, z: cz - h / 2, w, h };
      files[i].base = A.b + (B.b - A.b) * e + lift * (0.6 + 0.4 * growU(files[i].p, 4));
      files[i].rot = A.a + da * e;
    }
    writeInstances(replay.cur);
    requestRender();
    if (k < 1) plan.raf = requestAnimationFrame(step); else done();
  };
  plan.raf = requestAnimationFrame(step);
}
const planChanged = [];   // other modules re-anchor what they drew on the old plan (lenses, roads, beacon)
planChanged.push(() => { if (typeof lensApply === 'function') lensApply(); });

// the button (its label names the OTHER plan) and the key
function planButton() { const b = $('plan-btn'); if (b) b.textContent = plan.mode === 'grow' ? 'Tervrajz' : 'Növekedés'; }
setTimeout(() => {
  const b = $('plan-btn');
  if (b) b.onclick = () => planSet(plan.mode === 'grow' ? 'tree' : 'grow');
  planButton();
});
addEventListener('keydown', e => {
  if (!current || e.ctrlKey || e.metaKey || e.altKey || e.target.closest('input:not([type=range]), textarea, select')) return;
  if (e.key === 'p' || e.key === 'P') planSet(plan.mode === 'grow' ? 'tree' : 'grow');
});
