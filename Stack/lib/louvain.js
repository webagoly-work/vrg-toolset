// VRG Stack — Louvain community detection (STK-Q11 = A).
//
// The answer named graphology-communities-louvain (MIT). It is not installed here and installing
// means a download, so this is the same algorithm in our own code, with no dependency. The
// interface matches: louvain(und) → Map id → community number. The graphology package can be
// swapped in later with no change to callers.
//
// How it works: every node starts in its own group. Each node in turn moves to the neighbouring
// group that raises modularity the most. When nothing moves, every group becomes one node and the
// pass repeats on that smaller graph, until a pass changes nothing. The order is sorted, so the
// same graph always gives the same groups.
'use strict';

function onePass(und) {
  const ids = [...und.keys()].sort();
  let m2 = 0; const k = new Map();
  for (const id of ids) { let s = 0; for (const w of und.get(id).values()) s += w; k.set(id, s); m2 += s; }
  if (!m2) return { com: new Map(ids.map((id, i) => [id, i])), moved: false };
  const com = new Map(ids.map(id => [id, id]));
  const tot = new Map(ids.map(id => [id, k.get(id)]));
  let moved = false, improved = true, rounds = 0;
  while (improved && rounds++ < 20) {
    improved = false;
    for (const x of ids) {
      const cx = com.get(x); const kx = k.get(x);
      const wTo = new Map();
      for (const [y, w] of und.get(x)) if (y !== x) wTo.set(com.get(y), (wTo.get(com.get(y)) || 0) + w);
      tot.set(cx, tot.get(cx) - kx);
      let best = cx, bestGain = (wTo.get(cx) || 0) - tot.get(cx) * kx / m2;
      for (const [c, w] of [...wTo.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
        const gain = w - tot.get(c) * kx / m2;
        if (gain > bestGain + 1e-12) { best = c; bestGain = gain; }
      }
      tot.set(best, tot.get(best) + kx);
      if (best !== cx) { com.set(x, best); improved = true; moved = true; }
    }
  }
  return { com, moved };
}

function aggregate(und, com) {
  const g = new Map();
  for (const c of new Set(com.values())) g.set(c, new Map());
  for (const [x, nb] of und) for (const [y, w] of nb) {
    const a = com.get(x), b = com.get(y); const m = g.get(a); m.set(b, (m.get(b) || 0) + w);
  }
  return g;
}

function louvain(und) {
  let graph = und;
  let member = new Map([...und.keys()].map(id => [id, id])); // original node → current super node
  for (let level = 0; level < 10; level++) {
    const { com, moved } = onePass(graph);
    if (!moved) break;
    for (const [id, s] of member) member.set(id, com.get(s));
    graph = aggregate(graph, com);
  }
  // renumber: the biggest community is 0
  const size = new Map(); for (const c of member.values()) size.set(c, (size.get(c) || 0) + 1);
  const order = [...size.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([c]) => c);
  const num = new Map(order.map((c, i) => [c, i]));
  return new Map([...member.entries()].map(([id, c]) => [id, num.get(c)]));
}

module.exports = { louvain };
