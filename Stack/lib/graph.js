// VRG Stack — an in-memory graph index shared by the analytics, the queries and the MCP server.
//
//   const g = index(nodes, edges, { pillars: false })
//   g.nb(id)        neighbours [{ id, rel, v, dir, w }]
//   g.deg(id)       number of distinct neighbours
//   g.undirected()  Map id → Map neighbour → weight (pillar links left out unless asked)
//   shortest(g, a, b, { time })  breadth-first chain; pillar links last; with time = true the chain
//                   must run forward in time (a time-respecting path: every dated step is on or
//                   after the previous dated step, as a train timetable only lets you catch later trains)
'use strict';

function index(nodeList, edges, { pillars = true } = {}) {
  const byId = new Map(nodeList.map(n => [n.id, n]));
  const adj = new Map();
  const add = (x, item) => { let l = adj.get(x); if (!l) adj.set(x, l = []); l.push(item); };
  for (const e of edges) {
    if (!pillars && e.v === 2) continue;
    if (!byId.has(e.a) || !byId.has(e.b) || e.a === e.b) continue;
    add(e.a, { id: e.b, rel: e.rel, v: e.v, dir: '→', w: e.w || 1 });
    add(e.b, { id: e.a, rel: e.rel, v: e.v, dir: '←', w: e.w || 1 });
  }
  let und = null;
  return {
    byId, adj,
    nb: id => adj.get(id) || [],
    deg: id => new Set((adj.get(id) || []).map(x => x.id)).size,
    undirected() {
      if (und) return und;
      und = new Map([...byId.keys()].map(id => [id, new Map()]));
      for (const [x, list] of adj) for (const y of list) { const m = und.get(x); m.set(y.id, (m.get(y.id) || 0) + y.w); }
      // both directions were added, so every weight is counted twice: halve it
      for (const m of und.values()) for (const [k, w] of m) m.set(k, w / 2);
      return und;
    },
  };
}

function shortest(g, a, b, { time = false } = {}) {
  if (!g.byId.has(a) || !g.byId.has(b)) return null;
  const tOf = id => (g.byId.get(id).t || '');
  const prev = new Map([[a, null]]);
  const clock = new Map([[a, tOf(a)]]); // latest date seen on the chain so far
  const queue = [a];
  while (queue.length) {
    const x = queue.shift(); if (x === b) break;
    const next = g.nb(x).slice().sort((p, q) => (p.v === 2) - (q.v === 2));
    for (const y of next) {
      if (prev.has(y.id)) continue;
      const ty = tOf(y.id), now = clock.get(x);
      if (time && ty && now && ty < now) continue;
      prev.set(y.id, { from: x, rel: y.rel, dir: y.dir });
      clock.set(y.id, ty && (!now || ty > now) ? ty : now);
      queue.push(y.id);
    }
  }
  if (!prev.has(b)) return null;
  const chain = [];
  for (let x = b; x; x = prev.get(x) && prev.get(x).from) chain.unshift({ id: x, via: prev.get(x) });
  return chain;
}

module.exports = { index, shortest };
