// VRG Stack — the four network metrics (STK-Q14 = A: every build, with the previous value), plus
// PageRank as the node rank.
//
//   clustering   how often two neighbours of a node are neighbours too (0 … 1)
//   hubs         the nodes with the most distinct neighbours (degree centrality)
//   modularity   Newman's Q for a grouping: how much denser the links are inside groups than
//                chance would give (by layer, by pillar, by Louvain community)
//   path length  average breadth-first distance over a fixed sample of start nodes
//   rank         PageRank (damping 0.85) — a node is important when important nodes link to it;
//                used to rank search ties and to dim hubs
// Pillar links (v = 2) are left out: they are a hand-made list, not evidence.
'use strict';

function clustering(und) {
  let sum = 0, n = 0;
  for (const [x, m] of und) {
    const nb = [...m.keys()]; const k = nb.length; if (k < 2) continue;
    let links = 0;
    // large hubs are sampled so one folder with 300 neighbours does not cost 45 000 checks
    const s = k > 120 ? nb.filter((_, i) => i % Math.ceil(k / 120) === 0) : nb;
    for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) if (und.get(s[i]).has(s[j])) links++;
    sum += 2 * links / (s.length * (s.length - 1)); n++;
  }
  return n ? sum / n : 0;
}

function modularity(und, groupOf) {
  let m2 = 0; const tot = new Map(); let inside = 0;
  for (const [x, nb] of und) {
    let kx = 0; for (const w of nb.values()) kx += w;
    m2 += kx; const g = groupOf(x); tot.set(g, (tot.get(g) || 0) + kx);
    for (const [y, w] of nb) if (groupOf(y) === g) inside += w;
  }
  if (!m2) return 0;
  let q = inside / m2;
  for (const t of tot.values()) q -= (t / m2) ** 2;
  return q;
}

function pathStats(und, sample = 200) {
  const ids = [...und.keys()].sort();
  const step = Math.max(1, Math.floor(ids.length / sample));
  let sum = 0, count = 0, longest = 0;
  for (let i = 0; i < ids.length; i += step) {
    const dist = new Map([[ids[i], 0]]); const q = [ids[i]];
    while (q.length) { const x = q.shift(); const d = dist.get(x); for (const y of und.get(x).keys()) if (!dist.has(y)) { dist.set(y, d + 1); q.push(y); } }
    for (const d of dist.values()) if (d) { sum += d; count++; if (d > longest) longest = d; }
  }
  return { avg: count ? sum / count : 0, longest };
}

function components(und) {
  const seen = new Set(); let comps = 0, lone = 0, biggest = 0;
  for (const x of und.keys()) {
    if (seen.has(x)) continue; comps++;
    let size = 0; const q = [x]; seen.add(x);
    while (q.length) { const y = q.pop(); size++; for (const z of und.get(y).keys()) if (!seen.has(z)) { seen.add(z); q.push(z); } }
    if (size === 1) lone++; if (size > biggest) biggest = size;
  }
  return { comps, lone, biggest };
}

function pagerank(und, { d = 0.85, iter = 40 } = {}) {
  const ids = [...und.keys()]; const N = ids.length || 1;
  let pr = new Map(ids.map(id => [id, 1 / N]));
  const wsum = new Map(ids.map(id => { let s = 0; for (const w of und.get(id).values()) s += w; return [id, s]; }));
  for (let it = 0; it < iter; it++) {
    const next = new Map(ids.map(id => [id, (1 - d) / N]));
    let sink = 0;
    for (const x of ids) {
      const s = wsum.get(x); const px = pr.get(x);
      if (!s) { sink += px; continue; }
      for (const [y, w] of und.get(x)) next.set(y, next.get(y) + d * px * w / s);
    }
    for (const id of ids) next.set(id, next.get(id) + d * sink / N);
    pr = next;
  }
  return pr;
}

/* All metrics in one record. `groups` = { name: id → group } for the modularity lines. */
function measure(und, groups, byId) {
  const hubs = [...und.entries()].map(([id, m]) => [id, m.size]).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([id, deg]) => ({ id, deg, title: byId.get(id) ? byId.get(id).title : '' }));
  const mod = {}; for (const [name, fn] of Object.entries(groups)) mod[name] = +modularity(und, fn).toFixed(3);
  const ps = pathStats(und);
  return {
    nodes: und.size, links: [...und.values()].reduce((s, m) => s + m.size, 0) / 2,
    clustering: +clustering(und).toFixed(3), hubs, modularity: mod,
    pathAvg: +ps.avg.toFixed(2), pathLongest: ps.longest, ...components(und),
  };
}

module.exports = { clustering, modularity, pathStats, components, pagerank, measure };
