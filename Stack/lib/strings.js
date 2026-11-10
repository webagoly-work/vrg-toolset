// VRG Stack — Stack Strings (Füzérek): select a thing on one layer, light up everything about it
// on every other layer. The string's reach (which layers it touches) is the thing's development
// state. Plan: research/STRINGS-PLAN.md §1; name STK-Q18 = A.
// Shared by Node (stack.js string, MCP stack_string) and the browser (a page loads this file as a
// script and gets window.StackStrings), the same way lib/activation.js runs in both.
//
//   prepare(nodes, edges, opts) → ix          adjacency + vertical degree, built once per stack
//   string(ix, seed, opts)      → {seed, members, reach, mask, profile, pulse, cls}
//   classify(s, ix, opts)       → class id    (§1.3; rules in opts.classes order, first match wins)
//   maskOf(reach)               → 'F I Q L A · R C G ·'
//
// The walk: from the seed, follow VERTICAL links (ends on different layers) at most opts.depth hops.
// A member's score is the product of the weights along its best path; below opts.cutoff it is
// dropped. Horizontal links are followed one step only, from the seed, and only the container →
// piece ones (a feature's parts, a decision file's decisions, a folder's sub-folders, a line's
// sessions). Hubs pass on less: leaving a node with vertical degree d costs (hub / d)^hubPenalty
// when d > hub (lib/activation.js's lateral inhibition), so `tools/` cannot swallow every string.
// Pillars (layer E) are the definition of "the same thing" and are never damped.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.StackStrings = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const ORDER = 'FIQLAURCGZ';            // the reach mask: ten slots in stack order (E is the pillar, not a slot)

  const DEFAULTS = {
    depth: 2,
    cutoff: 0.15,
    hub: 16,                              // vertical degree above which a node is damped
    hubPenalty: 1,                        // (hub / d)^1: a node with 160 vertical links passes on a tenth
    weights: { ref: 1.0, same: 1.0, ran: 1.0, pillar: 0.8, alike: 0.5, other: 0.5 },
    touched: { min: 0.3, full: 16 },      // touched weight = log(1 + steps) / log(1 + full), at least min
    child: { part: 'a', holds: 'a', contains: 'a', 'on-line': 'b' },   // horizontal container → piece: which end is the container
    childWeight: 0.9,
    evidence: 0.5,                        // an F member counts for "tier ≤ 2" from this score up
    inBuildDays: 14,                      // a U or R event this recent: In build; older: Built, quiet (STK-P58)
    classes: ['program', 'orphan', 'build', 'quiet', 'planned', 'spark', 'loose'],
  };

  const CLASS = {
    program: { hu: 'Teljes program', en: 'Program', sign: '■' },
    orphan: { hu: 'Árva', en: 'Orphan', sign: '◌' },
    build: { hu: 'Fejlesztés alatt', en: 'In build', sign: '▲' },
    quiet: { hu: 'Kész, csendes', en: 'Built, quiet', sign: '□' },
    planned: { hu: 'Tervezett', en: 'Planned', sign: '◇' },
    spark: { hu: 'Szikra', en: 'Spark', sign: '·' },
    loose: { hu: 'Laza', en: 'Loose', sign: '?' },
  };

  function opts(o) {
    const d = Object.assign({}, DEFAULTS, o || {});
    d.weights = Object.assign({}, DEFAULTS.weights, (o || {}).weights);
    d.touched = Object.assign({}, DEFAULTS.touched, (o || {}).touched);
    d.child = Object.assign({}, DEFAULTS.child, (o || {}).child);
    return d;
  }

  function prepare(nodes, edges) {
    const byId = new Map(nodes.map(n => [n.id, n]));
    const adj = new Map(), vdeg = new Map();
    const add = (x, item) => { let l = adj.get(x); if (!l) adj.set(x, l = []); l.push(item); };
    for (const e of edges) {
      if (!byId.has(e.a) || !byId.has(e.b) || e.a === e.b) continue;
      const vertical = e.a[0] !== e.b[0];
      add(e.a, { id: e.b, rel: e.rel, w: e.w, s: e.s, vertical, side: 'a' });
      add(e.b, { id: e.a, rel: e.rel, w: e.w, s: e.s, vertical, side: 'b' });
      if (vertical) { vdeg.set(e.a, (vdeg.get(e.a) || 0) + 1); vdeg.set(e.b, (vdeg.get(e.b) || 0) + 1); }
    }
    return { byId, adj, vdeg };
  }

  function weight(x, o) {
    const r = x.rel.replace(/\?$/, '');
    if (r.startsWith('ref:')) return o.weights.ref;
    if (r === 'touched') return Math.max(o.touched.min, Math.min(1, Math.log(1 + (x.w || 1)) / Math.log(1 + o.touched.full)));
    if (r in o.weights) return o.weights[r];
    return o.weights.other;
  }

  function damp(ix, id, o) {
    if (id[0] === 'E') return 1;
    const d = ix.vdeg.get(id) || 0;
    return d > o.hub ? Math.pow(o.hub / d, o.hubPenalty) : 1;
  }

  const day = t => String(t || '').slice(0, 10);
  const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

  function string(ix, seed, o) {
    o = opts(o);
    if (!ix.byId.has(seed)) return null;
    const best = new Map([[seed, { score: 1, via: null, depth: 0 }]]);
    const offer = (id, score, via, depth) => {
      if (score < o.cutoff) return false;
      const cur = best.get(id);
      if (cur && cur.score >= score) return false;
      best.set(id, { score, via, depth });
      return true;
    };
    let frontier = [seed];
    for (let h = 1; h <= o.depth; h++) {
      const next = [];
      for (const id of frontier) {
        const here = best.get(id);
        const out = here.score * (id === seed ? 1 : damp(ix, id, o));
        for (const x of ix.adj.get(id) || []) {
          let w;
          if (x.vertical) w = weight(x, o);
          else if (id === seed && o.child[x.rel] && o.child[x.rel] === x.side) w = o.childWeight;   // seed is the container
          else continue;
          if (offer(x.id, out * w, { from: id, rel: x.rel }, h)) next.push(x.id);
        }
      }
      frontier = [...new Set(next)];
    }
    const members = [];
    for (const [id, b] of best) {
      const n = ix.byId.get(id);
      members.push({ id, layer: n.layer, score: Math.round(b.score * 1000) / 1000, depth: b.depth, via: b.via });
    }
    members.sort((a, b) => (b.score - a.score) || (ORDER.indexOf(a.layer) - ORDER.indexOf(b.layer)) || (a.id < b.id ? -1 : 1));
    const profile = {};
    for (const m of members) {
      const n = ix.byId.get(m.id), p = profile[m.layer] || (profile[m.layer] = { n: 0, score: 0, newest: '' });
      p.n++; p.score += m.score; const t = day(n.t); if (t > p.newest) p.newest = t;
    }
    for (const p of Object.values(profile)) p.score = Math.round(p.score * 100) / 100;
    const reach = ORDER.split('').filter(L => profile[L]);
    const pulse = reach.reduce((a, L) => profile[L].newest > a ? profile[L].newest : a, '');
    const s = { seed, members, reach, mask: maskOf(reach), profile, pulse };
    s.cls = classify(s, ix, o);
    return s;
  }

  function maskOf(reach) { return ORDER.split('').map(L => reach.includes(L) ? L : '·').join(' '); }

  /* §1.3, with the builder's changes: Orphan is tried before In build (STK-P57), so recently touched
     code that nobody registered is still an orphan; Built, quiet starts where In build ends (STK-P58),
     so no string falls between them; Loose catches the shapes no rule describes (R without C …). */
  function classify(s, ix, o) {
    o = opts(o);
    const has = L => s.reach.includes(L);
    const today = o.today || new Date().toISOString().slice(0, 10);
    const ev = ['U', 'R'].map(L => (s.profile[L] || {}).newest || '').reduce((a, b) => b > a ? b : a, '');
    const age = ev ? daysBetween(ev, today) : Infinity;
    const fTier = s.members.filter(m => m.layer === 'F' && m.score >= o.evidence)
      .map(m => +ix.byId.get(m.id).tier || 9).reduce((a, b) => Math.min(a, b), 9);
    const rules = {
      program: () => has('F') && has('R') && has('C') && has('G') && (has('L') || has('U')) && fTier <= 2,
      orphan: () => (has('C') || has('R')) && !has('F') && !has('I'),
      build: () => (has('R') || has('C')) && age <= o.inBuildDays,
      quiet: () => has('R') && has('C') && age > o.inBuildDays,
      planned: () => (has('I') || has('Q')) && has('G') && !has('R') && !has('C'),
      spark: () => s.reach.length > 0 && s.reach.every(L => L === 'F' || L === 'I'),
      loose: () => true,
    };
    for (const c of o.classes) if (rules[c] && rules[c]()) return c;
    return 'loose';
  }

  return { ORDER, DEFAULTS, CLASS, prepare, string, classify, maskOf };
});
