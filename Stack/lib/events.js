// VRG Stack — the event log and daily snapshots (event sourcing).
//
// Each build compares the new graph with the last one and appends what changed to
// data/events.jsonl. The log is never edited: today's stack = the last snapshot + the events
// after it. Every event is bitemporal:
//   valid  when it happened in the work (the node's own date, when it has one)
//   seen   when the stack noticed it (this build)
// so "what did we know on 11-05" and "what happened on 11-05" are different questions.
// data/snapshots/<day>.json.gz keeps one lean copy of the graph per day (the last build wins).
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const CFG = require('../config');
const X = require('./fsx');

const LOG = path.join(CFG.data, 'events.jsonl');
const SNAP = path.join(CFG.data, 'snapshots');
const ek = e => e.a + '>' + e.b + '>' + e.rel;

function diff(prev, next, seen) {
  const ev = [];
  const P = new Map((prev ? prev.nodes : []).map(n => [n.id, n]));
  const N = new Map(next.nodes.map(n => [n.id, n]));
  const valid = n => (n.t || '').slice(0, 10);
  for (const [id, n] of N) {
    const p = P.get(id);
    if (!p) ev.push({ op: 'node+', id, layer: n.layer, kind: n.kind, valid: valid(n), seen });
    else if ((p.state || '') !== (n.state || '') || (p.tier || '') !== (n.tier || ''))
      ev.push({ op: 'state', id, layer: n.layer, from: p.state || '', to: n.state || '', valid: valid(n), seen });
  }
  for (const [id, p] of P) if (!N.has(id)) ev.push({ op: 'node-', id, layer: p.layer, valid: '', seen });
  // links: evidence links only (pillar links follow from the pillar list)
  const E = arr => new Map(arr.filter(e => (Array.isArray(e) ? e[3] : e.v) !== 2).map(e => Array.isArray(e) ? [e[0] + '>' + e[1] + '>' + e[2], { a: e[0], b: e[1], rel: e[2] }] : [ek(e), e]));
  if (prev) {
    const PE = E(prev.edges), NE = E(next.edges);
    for (const [k, e] of NE) if (!PE.has(k)) ev.push({ op: 'edge+', id: e.a, to: e.b, rel: e.rel, valid: '', seen });
    for (const [k, e] of PE) if (!NE.has(k)) ev.push({ op: 'edge-', id: e.a, to: e.b, rel: e.rel, valid: '', seen });
  }
  return ev;
}

function record(prev, next) {
  const seen = next.generated;
  const ev = diff(prev, next, seen);
  const summary = { op: 'build', seen, schema: CFG.schema, baseline: !prev, counts: {} };
  for (const e of ev) summary.counts[e.op] = (summary.counts[e.op] || 0) + 1;
  X.appendJsonl(LOG, [summary, ...ev]);
  // one snapshot per day, lean edges
  const lean = { generated: next.generated, nodes: next.nodes.map(({ id, layer, kind, title, t, state, tier, ent, com, para }) => ({ id, layer, kind, title, t, state, tier, ent, com, para })),
    edges: next.edges.filter(e => e.v !== 2).map(e => [e.a, e.b, e.rel, e.v]) };
  X.writeAtomic(path.join(SNAP, next.generated.slice(0, 10) + '.json.gz'), zlib.gzipSync(JSON.stringify(lean)));
  return summary;
}

/* events since a date (seen ≥ since), newest last */
function since(dateIso) {
  return X.readJsonl(LOG).records.filter(e => e.seen >= dateIso);
}

const snapshots = () => { try { return fs.readdirSync(SNAP).filter(f => f.endsWith('.json.gz')).sort(); } catch { return []; } };
const loadSnapshot = day => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(SNAP, day + '.json.gz'))).toString('utf8'));

module.exports = { diff, record, since, snapshots, loadSnapshot, LOG, SNAP };
