// VRG Stack — Ötletfolyam (lineage river) data for lineage.html, the I layer's own page.
//
//   out/lineage-data.js   window.LINEAGE = { lanes, nodes, links, became, layers, … }
//
// Where the data comes from:
//   · the I layer as the stack holds it (out/stack.json or the graph the build just made): ids, dates,
//     kinds, lanes, ranks, and every VERTICAL link from an idea to F, L, Q, A, R, C, G and its pillars (E);
//   · the I source itself (notes/idea-timeline/data.js, through lib/layers.js ideas()) for what the stack
//     clips or drops: the full fate and evidence, the inferred-date mark (~), and the lane names.
// What the page needs on top is derived here, once per build:
//   · reach = how many ideas lie downstream (the river's width);
//   · spring = an inferred idea that starts a stream: a "Need: …" node, or an inferred node with no
//     parent (STK-P2); each idea lists the springs upstream of it ("where it came from");
//   · back = links that point backwards in time (should be none: the I layer is a DAG in time).
// Read-only on the sources; writes out/lineage-data.js only (fsx.writeAtomic).
'use strict';

const fs = require('fs');
const path = require('path');
const CFG = require('../config');
const X = require('./fsx');
const C = require('./common');
const META = require('./meta');

const LAYER_HU = Object.fromEntries(META.map(m => [m.code, m.hu])); LAYER_HU.E = 'Pillér';
const ORDER = 'FLQARCGUE';   // outcomes are listed in stack order: what you can use first, pillars last

function build(graph) {
  const L = require('./layers');
  const srcFile = C.NOTES + '/idea-timeline/data.js';
  delete require.cache[require.resolve(srcFile)];
  const src = require(srcFile);
  const raw = L.ideas();                                   // full fate / evidence / ~date
  const rawBy = new Map(raw.nodes.map(n => [n.id, n]));
  const fateBy = new Map((src.NODES || []).map(r => [r[0], r[7] || '']));
  const byId = new Map(graph.nodes.map(n => [n.id, n]));
  // the stack's own I nodes are the set (carried forward when the source fails); the source adds detail
  const ideas = graph.nodes.filter(n => n.layer === 'I');
  const ids = new Set(ideas.map(n => n.id));
  const loc = id => id.slice(2);

  const edgeRows = (graph.edges || []).map(e => Array.isArray(e) ? { a: e[0], b: e[1], rel: e[2], v: e[3] } : e);
  const links = [], became = {}, parents = new Map(), children = new Map();
  for (const id of ids) { parents.set(id, []); children.set(id, []); }
  for (const e of edgeRows) {
    const ia = ids.has(e.a), ib = ids.has(e.b);
    if (ia && ib) {
      const inf = /\?$/.test(e.rel), rel = e.rel.replace(/\?$/, '');
      links.push([loc(e.a), loc(e.b), rel, inf ? 1 : 0]);
      children.get(e.a).push(e.b); parents.get(e.b).push(e.a);
    } else if (ia || ib) {
      const me = ia ? e.a : e.b, other = byId.get(ia ? e.b : e.a);
      if (!other) continue;
      (became[loc(me)] || (became[loc(me)] = [])).push([other.id, other.layer, C.clip(other.title, 90), e.rel, other.kind || '', (other.t || '').slice(0, 10)]);
    }
  }
  for (const k of Object.keys(became)) {
    const seen = new Set();
    became[k] = became[k].filter(r => !seen.has(r[0]) && seen.add(r[0]))
      .sort((x, y) => ORDER.indexOf(x[1]) - ORDER.indexOf(y[1]) || (y[5] || '').localeCompare(x[5] || ''));
  }

  // downstream reach (distinct descendants), memoised over the DAG; the placeholder guards a cycle
  const reach = new Map();
  const down = id => {
    if (reach.has(id)) return reach.get(id);
    reach.set(id, new Set());
    const s = new Set();
    for (const c of children.get(id)) { s.add(c); for (const d of down(c)) s.add(d); }
    reach.set(id, s); return s;
  };
  const springs = new Set(ideas.filter(n => n.kind === 'inferred' && (/^Need:/i.test(n.title) || !parents.get(n.id).length)).map(n => n.id));
  const upMemo = new Map();
  const up = id => {
    if (upMemo.has(id)) return upMemo.get(id);
    upMemo.set(id, new Set());
    const s = new Set();
    for (const p of parents.get(id)) { if (springs.has(p)) s.add(p); for (const q of up(p)) s.add(q); }
    upMemo.set(id, s); return s;
  };

  const nodes = ideas.map(n => {
    const r = rawBy.get(n.id) || {}, ex = r.extra || {};
    return {
      id: loc(n.id), lane: n.lane || r.lane || '', t: (n.t || r.t || '').slice(0, 10), approx: ex.inferredDate ? 1 : 0,
      kind: n.kind, spring: springs.has(n.id) ? 1 : 0, title: n.title, brief: r.brief || n.brief || '',
      fate: fateBy.get(loc(n.id)) || n.state || '', evidence: ex.evidence || '',
      reach: down(n.id).size, springs: [...up(n.id)].map(loc), rank: n.rank || 0, ...(n.stale ? { stale: 1 } : {}),
    };
  }).sort((a, b) => a.t.localeCompare(b.t) || a.id.localeCompare(b.id));

  const tBy = new Map(nodes.map(n => [n.id, n.t]));
  const back = links.filter(([a, b]) => tBy.get(a) > tBy.get(b)).map(([a, b, rel]) => [a, b, rel]);
  const dates = nodes.map(n => n.t).filter(Boolean).sort();
  return {
    about: 'VRG Stack — Ötletfolyam (lineage river) data. Generated by Stack/lib/lineage.js on every stack build; never edit by hand.',
    generated: graph.generated || new Date().toISOString(),
    today: new Date().toISOString().slice(0, 10),
    min: dates[0] || '', max: dates[dates.length - 1] || '',
    lanes: (src.LANES || []).map(([code, name, desc]) => [code, name, desc]),
    layers: LAYER_HU,
    nodes, links, became, back,
    counts: { ideas: nodes.length, links: links.length, inferred: links.filter(l => l[3]).length, springs: springs.size,
      vertical: Object.values(became).reduce((s, v) => s + v.length, 0) },
  };
}

function write({ graph } = {}) {
  const g = graph || JSON.parse(fs.readFileSync(path.join(CFG.out, 'stack.json'), 'utf8'));
  const data = build(g);
  X.writeAtomic(path.join(CFG.out, 'lineage-data.js'), '// generated by stack.js build (lib/lineage.js)\nwindow.LINEAGE = ' + JSON.stringify(data) + ';\n');
  const c = data.counts;
  return { data, msg: `lineage: ${c.ideas} ideas, ${c.links} links (${c.inferred} inferred), ${c.springs} springs, ${c.vertical} outcomes in other layers${data.back.length ? `, ${data.back.length} BACKWARD links` : ''} → out/lineage-data.js` };
}

module.exports = { build, write };
