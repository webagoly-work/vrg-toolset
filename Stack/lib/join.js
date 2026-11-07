// VRG Stack — the join: turns shared keys into links between layers.
//
// Every node carries `own` keys (what it IS: its path, commit, session id …). Its text is read
// for `ref` keys (what it MENTIONS). ref(A) == own(B) becomes a link A → B; across layers that
// link is vertical. Two more joins: `same` (two layers own one key) and `alike` (names match).
//
// join(layers, facts) → { nodes: Map, edges, dangling, unresolved, resolveText }
// `resolveText(text)` is the same resolver as a function, so the recorder can turn a tool call
// ("Read notes/devlog/DEVLOG.md") into the stack nodes it touched.
'use strict';

const C = require('./common');
const { fold } = C;

function join(layers, facts) {
  const nodes = new Map();
  const edges = [];
  for (const [code, lay] of Object.entries(layers)) {
    for (const n of lay.nodes) { n.layer = code; if (!nodes.has(n.id)) nodes.set(n.id, n); }
    for (const e of lay.edges) edges.push({ a: e.a, b: e.b, rel: e.rel, v: 0, ...(e.w ? { w: e.w } : {}) });
  }

  /* ---- keys */
  const ownIndex = new Map();
  for (const n of nodes.values()) for (const k of n.own) { if (!ownIndex.has(k)) ownIndex.set(k, []); ownIndex.get(k).push(n.id); }
  const outsidePaths = new Set(), outsideDirs = new Set();
  for (const k of ownIndex.keys()) if (k.startsWith('p:') && /^[A-Z]:\//.test(k.slice(2))) {
    const p = k.slice(2); outsidePaths.add(p);
    const seg = p.split('/'); for (let i = 3; i < seg.length; i++) outsideDirs.add(seg.slice(0, i).join('/'));
  }
  const byLayer = l => (layers[l] ? layers[l].nodes : []);
  const known = {
    paths: new Set([...facts.paths, ...outsidePaths]), dirs: new Set([...facts.dirs, ...outsideDirs]), basenames: facts.basenames,
    commits: new Set(byLayer('R').map(n => n.id.slice(2))),
    sessions: new Set(byLayer('L').filter(n => n.kind === 'session').map(n => n.id.slice(3))),
    memories: new Set(byLayer('A').filter(n => n.id.startsWith('A:mem.')).map(n => n.id.slice(6))),
  };
  const extract = C.makeExtractor(known);

  /* a ref key → the nodes that own it; a path walks up until a node owns a prefix of it */
  function resolve(k) {
    if (ownIndex.has(k)) return ownIndex.get(k);
    if (!k.startsWith('p:')) return [];
    let p = k.slice(2);
    while (p.includes('/')) { p = p.slice(0, p.lastIndexOf('/')); const hit = ownIndex.get('p:' + p); if (hit) return hit; }
    return ownIndex.get('p:' + p) || [];
  }
  const resolveText = text => { const ids = new Set(); for (const k of extract(text)) for (const id of resolve(k)) ids.add(id); return [...ids]; };

  /* ---- ref links */
  const seen = new Set(edges.map(e => e.a + '>' + e.b));
  let unresolved = 0;
  for (const n of nodes.values()) {
    const refs = extract(n.text);
    if (n.extra && Array.isArray(n.extra.files)) for (const f of n.extra.files) refs.add('p:' + C.normPath(f));
    if (n.extra && n.extra.path && n.layer === 'Q') refs.add('p:' + n.extra.path);
    for (const k of n.own) refs.delete(k);
    n.ref = [...refs];
    for (const k of refs) {
      const targets = resolve(k);
      if (!targets.length) { unresolved++; continue; }
      for (const b of targets) {
        if (b === n.id) continue;
        const key = n.id + '>' + b; if (seen.has(key)) continue; seen.add(key);
        edges.push({ a: n.id, b, rel: 'ref:' + k.split(':')[0], v: nodes.get(b).layer !== n.layer ? 1 : 0 });
      }
    }
  }

  /* ---- same: one key owned on two layers (a DECISIONS.md is a Q file and a G document) */
  for (const ids of ownIndex.values()) if (ids.length > 1) for (let i = 1; i < ids.length; i++) {
    const a = ids[0], b = ids[i];
    if (nodes.get(a).layer !== nodes.get(b).layer && !seen.has(a + '>' + b)) { seen.add(a + '>' + b); edges.push({ a, b, rel: 'same', v: 1 }); }
  }

  /* ---- alike: best Dice match of title words between F, I, L and A (inferred, marked so) */
  const STOP = new Set('the and for with from into its his her our you are not but all one two new old via per vrg varler round line map page app tool'.split(' '));
  const words = n => new Set(fold(n.title).split(/[^a-z0-9]+/).filter(w => w.length >= 3 && !STOP.has(w)));
  const ALIKE = [['F', 'L'], ['F', 'I'], ['L', 'I'], ['F', 'A'], ['L', 'A']];
  const AGENTIC = ['brief', 'agent', 'codephrase (live)', 'memory/project'];
  const pool = l => [...nodes.values()].filter(n => n.layer === l && !['session', 'commit', 'memory/feedback'].includes(n.kind) && !(l === 'A' && !AGENTIC.includes(n.kind)));
  let alike = 0;
  for (const [la, lb] of ALIKE) {
    const B = pool(lb).map(n => ({ n, w: words(n) }));
    for (const a of pool(la)) {
      const wa = words(a); if (!wa.size) continue;
      let best = null;
      for (const b of B) {
        let inter = 0; for (const w of wa) if (b.w.has(w)) inter++;
        const s = 2 * inter / (wa.size + b.w.size);
        if (inter && (!best || s > best.s)) best = { s, b: b.n, inter };
      }
      if (best && (best.s >= 0.6 || (best.inter >= 2 && best.s >= 0.45)) && !seen.has(a.id + '>' + best.b.id) && !seen.has(best.b.id + '>' + a.id)) {
        seen.add(a.id + '>' + best.b.id); edges.push({ a: a.id, b: best.b.id, rel: 'alike', v: 1, s: +best.s.toFixed(2) }); alike++;
      }
    }
  }

  /* ---- lineage: drop links whose ends do not exist */
  const dangling = edges.filter(e => !nodes.has(e.a) || !nodes.has(e.b));
  const live = edges.filter(e => nodes.has(e.a) && nodes.has(e.b));
  for (const e of live) if (nodes.get(e.a).layer !== nodes.get(e.b).layer) e.v = 1;
  return { nodes, edges: live, dangling, unresolved, alike, resolveText, ownIndex };
}

module.exports = { join };
