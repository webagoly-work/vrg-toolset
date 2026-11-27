// VRG Stack — Ki kicsoda (who-is-who): the W layer's own page (szereplok.html), S19's "each person and account with
// what they may enter, each Head with what they own, and where knowledge sits in one head" (lib/meta.js).
//
//   build(graph) → data      pure, from the written graph (W nodes carry `w`, lib/pipeline.js pub):
//     people    by role (never a name), the Kapu layers each may enter, whether the signed list verifies
//     accounts  the Claude accounts, which one signs in with its own config
//     seats     the Council: each Head, the agent that plays the seat (A), what it owns; for every owned line its
//               pillars, their open signals (J) and when the work last moved; the Head's load (lines, pillars, signals)
//     units     the business units of the Kapu, with their program counts
//     unowned   pillars with code no Head owns (lib/people.js unowned)
//     alone     "knowledge in one head": pillars that only one session has worked on in the recordings (U → pillar)
//   write({ graph }) → { data, msg }   out/people-data.js, window.PEOPLE (every build: it reads J and U as well)
'use strict';

const fs = require('fs');
const path = require('path');
const CFG = require('../config');
const X = require('./fsx');

const LAYERS = { L1: ['programok', 'programs'], L2: ['megosztott mappák', 'shared folders'], L3: ['AI-dokumentumok', 'AI docs'], L4: ['Git', 'Git'] };
const SEV = { red: 3, amber: 2, info: 1 };

function build(graph) {
  const nodes = graph.nodes, byId = new Map(nodes.map(n => [n.id, n]));
  const edges = graph.edges.map(e => Array.isArray(e) ? { a: e[0], b: e[1], rel: e[2], w: e[4] } : e);
  const ents = new Map((graph.entities || []).map(e => [e.id, e]));
  const W = nodes.filter(n => n.layer === 'W'), w = n => n.w || {};

  // open signals per pillar (J → the warned node → its pillars), as the Jelzéstábla counts them
  const sig = new Map();
  for (const e of edges) {
    if (e.rel !== 'warns') continue;
    const j = byId.get(e.a), t = byId.get(e.b); if (!j || !t) continue;
    for (const p of t.layer === 'E' ? [t.id.slice(2)] : (t.ent || [])) {
      const r = sig.get(p) || sig.set(p, { red: 0, amber: 0, info: 0, ids: new Set() }).get(p);
      if (!r.ids.has(j.id)) { r.ids.add(j.id); r[j.state] = (r[j.state] || 0) + 1; }
    }
  }
  const sigOf = p => { const r = sig.get(p); return r ? { red: r.red, amber: r.amber, info: r.info } : { red: 0, amber: 0, info: 0 }; };
  // when a pillar's work last moved: its newest commit or session (R, L, U members)
  const pulse = new Map();
  for (const n of nodes) if (/^[RLU]$/.test(n.layer) && n.t) for (const p of n.ent || []) if (!pulse.has(p) || pulse.get(p) < n.t) pulse.set(p, String(n.t).slice(0, 10));
  // which recorded sessions worked on each pillar (U run → touched node → its pillars)
  const sessions = new Map();
  for (const e of edges) {
    if (e.rel !== 'touched' || !String(e.a).startsWith('U:run.')) continue;
    const t = byId.get(e.b); if (!t) continue;
    for (const p of t.layer === 'E' ? [t.id.slice(2)] : (t.ent || [])) (sessions.get(p) || sessions.set(p, new Set()).get(p)).add(e.a);
  }

  const people = W.filter(n => n.kind === 'person').map(n => ({ id: n.id, title: n.title, role: w(n).role || n.state, layers: (w(n).layers || []).map(l => [l, ...(LAYERS[l] || [l, l])]), signed: !!w(n).signed }));
  const accounts = W.filter(n => n.kind === 'account').map(n => ({ id: n.id, title: n.title, brief: n.brief, state: n.state, own: !!w(n).ownConfig }));
  const owns = new Map(), played = new Map();
  for (const e of edges) { if (e.rel === 'owns' && e.a.startsWith('W:seat.')) (owns.get(e.a) || owns.set(e.a, []).get(e.a)).push(e.b); if (e.rel === 'played-by' && e.a.startsWith('W:seat.')) played.set(e.a, e.b); }
  const seats = W.filter(n => n.kind === 'seat').map(n => {
    const lines = (owns.get(n.id) || []).map(id => byId.get(id)).filter(Boolean).map(o => {
      // its pillars: the ones that took it in by their words, else a looser match of its name ("calculators")
      let ps = (o.ent || []).filter(p => ents.has(p));
      if (!ps.length) ps = require('./people').pillarsFor(o.title, graph.entities || []);
      const s = { red: 0, amber: 0, info: 0 }; for (const p of ps) { const x = sigOf(p); s.red += x.red; s.amber += x.amber; s.info += x.info; }
      return { id: o.id, title: o.title, pillars: ps.map(p => [p, ents.get(p).name]), signals: s, last: ps.map(p => pulse.get(p) || '').sort().pop() || '' };
    }).sort((a, b) => b.signals.red - a.signals.red || b.signals.amber - a.signals.amber || (a.title < b.title ? -1 : 1));
    const pills = new Set(lines.flatMap(l => l.pillars.map(p => p[0])));
    const load = { lines: lines.length, pillars: pills.size, red: 0, amber: 0, info: 0 };
    for (const p of pills) { const x = sigOf(p); load.red += x.red; load.amber += x.amber; load.info += x.info; }
    const a = byId.get(played.get(n.id));
    return { id: n.id, head: (w(n).head || n.title.split(' · ')[0]), title: n.title, vacant: n.state === 'vacant', agent: a ? { id: a.id, title: a.title, brief: a.brief || '' } : null, lines, load };
  });
  const units = W.filter(n => n.kind === 'business unit').map(n => ({ id: n.id, title: n.title, brief: n.brief }));
  let unowned = [];
  try { unowned = require('./people').unowned(graph).map(p => ({ id: 'E:' + p.id, name: p.name, area: p.area || '', signals: sigOf(p.id), last: pulse.get(p.id) || '' })); } catch { unowned = []; }
  const alone = [...sessions].filter(([, s]) => s.size === 1).map(([p, s]) => ({ id: 'E:' + p, name: (ents.get(p) || {}).name || p, session: [...s][0], last: pulse.get(p) || '' }))
    .filter(x => ents.has(x.id.slice(2))).sort((a, b) => (a.name < b.name ? -1 : 1));
  return { build: (graph && graph.build) || null, schema: (graph && graph.schema) || null, generated: new Date().toISOString(),
    counts: { people: people.length, accounts: accounts.length, seats: seats.length, vacant: seats.filter(s => s.vacant).length, lines: seats.reduce((a, s) => a + s.lines.length, 0), unowned: unowned.length, alone: alone.length, sessions: new Set([...sessions.values()].flatMap(s => [...s])).size },
    signed: people.length ? people.every(p => p.signed) : null, people, accounts, seats, units, unowned, alone };
}

function write({ graph } = {}) {
  const g = graph || JSON.parse(fs.readFileSync(path.join(CFG.out, 'stack.json'), 'utf8'));
  const data = build(g);
  X.writeAtomic(path.join(CFG.out, 'people-data.js'), '// generated by stack.js build (lib/peoplepage.js)\nwindow.PEOPLE = ' + JSON.stringify(data) + ';\n');
  const k = data.counts;
  return { data, msg: `people: ${k.people} people, ${k.accounts} accounts, ${k.seats} seats (${k.vacant} vacant) owning ${k.lines} lines, ${k.unowned} unowned pillars, ${k.alone} in one session's hands → out/people-data.js` };
}

module.exports = { build, write, LAYERS, SEV };
