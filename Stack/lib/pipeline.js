// VRG Stack — the build, as a list of guarded stages.
//
//   archive → layers F I Q L A R C G → join → record → U (Futás) → pillars → analytics
//   → validate → write graph → events + snapshot → index (+ embeddings) → codec · drift · status
//   → patterns · proposals · replay → health
//
// Rules each stage keeps:
//  · sources are read, never written; everything written goes to out/ (derived) or data/ (history)
//  · a layer whose adapter fails is carried forward from the last good build (marked stale)
//  · optional stages (archive, embeddings, patterns, replay) may fail without failing the build
//  · every file is written atomically, and one build runs at a time (out/.lock)
//  · if the build itself fails, the previous out/ stays as it was
'use strict';

const fs = require('fs');
const path = require('path');
const CFG = require('../config');
const X = require('./fsx');
const C = require('./common');
const L = require('./layers');
const META = require('./meta');
const ENT = require('../entities');
const H = require('./health');
const { join } = require('./join');
const { pillars } = require('./pillars');
const { futas } = require('./futas');
const REC = require('./record');
const G = require('./graph');
const M = require('./metrics');
const { louvain } = require('./louvain');
const EN = require('./enrich');
const EV = require('./events');
const STORE = require('./store');
const INS = require('./insight');
const REPLAY = require('./replay');
const { archive } = require('./archive');

const LNAME = Object.fromEntries(META.map(m => [m.code, m.en])); LNAME.E = 'Pillar';

async function run({ quiet = false, noArchive = false, noEmbed = false, rerecord = false } = {}) {
  const log = quiet ? () => {} : m => console.log(m);
  fs.mkdirSync(path.join(CFG.out, 'codec'), { recursive: true });
  return X.withLock(CFG.out, CFG.health.lockStaleMin, async () => {
    const t0 = Date.now();
    const hc = H.collector();
    try {
    const prevRaw = X.readJson(path.join(CFG.out, 'stack.json'));
    const prev = prevRaw && Array.isArray(prevRaw.nodes) ? prevRaw : null;

    /* ---- 0. keep the recordings */
    if (!noArchive) await hc.stage('archive', () => { const r = archive(); log(`archive: ${r.copied} new or changed files`); if (r.failed.length) hc.warn('retention', `${r.failed.length} files could not be archived`); return r; }, { optional: true });
    H.retention(hc);

    /* ---- 1. layers, each guarded */
    const facts = await hc.stage('repo facts (git ls-files)', () => C.repoFacts());
    const layers = {};
    layers.R = await hc.stage('layer R · DevRepo', () => L.devrepo(), { fallback: () => H.carryForward(prev, 'R') });
    const commitsByPath = new Map();
    for (const n of layers.R.nodes) for (const f of (n.extra && n.extra.files) || []) if (!commitsByPath.has(f) || commitsByPath.get(f) < n.t) commitsByPath.set(f, n.t);
    const adapters = { F: () => L.featured(), I: () => L.ideas(), Q: () => L.decisions(facts), L: () => L.devlog(), A: () => L.agentic(facts), C: () => L.code(facts, commitsByPath), G: () => L.globe(facts) };
    for (const code of ['F', 'I', 'Q', 'L', 'A', 'C', 'G']) layers[code] = await hc.stage(`layer ${code} · ${LNAME[code]}`, adapters[code], { fallback: () => H.carryForward(prev, code) });
    const ordered = {}; for (const c of ['F', 'I', 'Q', 'L', 'A', 'R', 'C', 'G']) ordered[c] = layers[c];

    /* ---- 2. join */
    const J = await hc.stage('join', () => join(ordered, facts));
    const { nodes } = J; let edges = J.edges;
    if (J.dangling.length) hc.warn('lineage', `${J.dangling.length} source links point at nodes that do not exist (dropped)`);
    hc.info('lineage', `${J.unresolved} mentions resolved to no node; ${J.alike} name matches (alike)`);

    /* ---- 3. recordings → U · Futás */
    const commits = layers.R.nodes.filter(n => n.extra && n.extra.date).map(n => ({ h: n.id.slice(2), ms: Date.parse(n.extra.date), subject: n.title })).sort((a, b) => a.ms - b.ms);
    const resolve = (paths, text) => J.resolveText(paths.join(' ') + ' ' + (text || ''));
    const index = await hc.stage('record sessions', () => REC.recordAll({ resolve, commits, force: rerecord, log }),
      { fallback: () => X.readJson(path.join(REC.DIR, 'index.json'), { sessions: {} }) });
    const U = futas(index, nodes);
    for (const n of U.nodes) nodes.set(n.id, n);
    for (const e of U.edges) edges.push({ ...e, v: nodes.get(e.a).layer !== nodes.get(e.b).layer ? 1 : 0 });

    /* ---- 4. pillars */
    const entities = pillars(nodes, edges, ENT);

    /* ---- 5. validate, then analytics on the evidence graph */
    edges = H.validate(nodes, edges, hc);
    const list = [...nodes.values()];
    const g = G.index(list, edges, { pillars: false });
    const und = g.undirected();
    const pr = M.pagerank(und);
    const com = louvain(und);
    const today = new Date().toISOString().slice(0, 10);
    for (const n of list) { n.rank = +(1e3 * (pr.get(n.id) || 0)).toFixed(3); n.com = com.has(n.id) ? com.get(n.id) : -1; n.para = EN.para(n, today); n.actor = EN.actor(n); }
    const metrics = M.measure(und, { layer: id => nodes.get(id).layer, pillar: id => ((nodes.get(id).ent || [])[0] || id), /* a node with no pillar is its own group */ community: id => com.get(id) }, nodes);
    const communities = describeCommunities(list, com);
    metrics.communities = communities.length;

    /* ---- 6. the graph */
    const deg = new Map();
    for (const e of edges) for (const x of [e.a, e.b]) { const d = deg.get(x) || { h: 0, v: 0, p: 0 }; e.v === 2 ? d.p++ : e.v ? d.v++ : d.h++; deg.set(x, d); }
    const pub = n => ({ id: n.id, layer: n.layer, kind: n.kind, title: C.clip(n.title, 140), brief: C.clip(n.brief, 300), t: n.t || '', state: n.state || '',
      lane: n.lane || '', tier: n.tier || '', own: n.own, ent: n.ent || [], deg: deg.get(n.id) || { h: 0, v: 0, p: 0 },
      path: (n.extra && n.extra.path) || (n.own.find(k => k.startsWith('p:')) || '').slice(2) || '',
      rank: n.rank, com: n.com, para: n.para, actor: n.actor, ...(n.stale ? { stale: true } : {}) });
    const graph = {
      about: 'VRG Stack — multilayer database of the VRG work. Generated by notes/stack (stack.js build); never edit by hand.',
      schema: CFG.schema, generated: new Date().toISOString(), layers: META, entities, communities,
      nodes: list.map(pub), edges,
    };
    H.compare(prev && prev.schema === CFG.schema ? prev : null, graph, hc);
    X.writeAtomic(path.join(CFG.out, 'stack.json'), JSON.stringify(graph));
    X.writeAtomic(path.join(CFG.out, 'stack-data.js'), '// generated by stack.js build\nwindow.STACK = ' + JSON.stringify({ ...graph, edges: edges.map(e => [e.a, e.b, e.rel, e.v]) }) + ';\n');

    /* ---- 7. history */
    await hc.stage('events + snapshot', () => { const s = EV.record(prev, graph); log(`events: ${Object.entries(s.counts).map(([k, v]) => k + ' ' + v).join(', ') || 'no change'}`); });

    /* ---- 8. search index (+ meaning vectors) */
    // a failed index keeps the last good one (search still answers, a little out of date)
    const ix = await hc.stage('search index', () => STORE.build(nodes, l => LNAME[l] || l), { fallback: () => ({ rows: 0, chunks: 0, embKept: 0, embedQueue: [] }) });
    if (!noEmbed) {
      const em = await hc.stage('embeddings (bge-m3)', () => STORE.embedMissing(ix.embedQueue, 2000, log), { optional: true });
      if (em && !em.ok) hc.info('search', `meaning search off: ${em.why}. Full-text search works.`);
      else if (em) hc.info('search', `embeddings: ${em.done} new, ${ix.embKept} kept, ${em.left} left for the next build`);
    }
    hc.info('search', `${ix.rows} nodes and ${ix.chunks} heading chunks indexed`);

    /* ---- 9. reports */
    const codec = require('./codec')(graph, CFG.out);
    await hc.stage('drift', () => X.writeAtomic(path.join(CFG.out, 'DRIFT.md'), require('./drift')(graph, nodes, { facts, dangling: J.dangling, unresolved: J.unresolved })), { optional: true });
    const gp = G.index(graph.nodes, edges, { pillars: true });
    const isHub = id => g.deg(id) > 80 || id[0] === 'U' || id[0] === 'E';
    const pat = await hc.stage('patterns', () => {
      const p = INS.patterns(INS.sequences(index, REC.readRecording, isHub), id => (nodes.get(id) || {}).title || '');
      X.writeAtomic(path.join(CFG.out, 'PATTERNS.md'), p.md); X.writeAtomic(path.join(CFG.out, 'patterns.json'), JSON.stringify(p.json)); return p;
    }, { optional: true });
    await hc.stage('replay data', () => { const r = REPLAY.exportAll(index, gp, REC.readRecording); log(`replay: ${r.sessions} sessions (${r.written} rewritten)`); }, { optional: true });
    await hc.stage('connectome', () => log(require('./connectome').write().msg), { optional: true });
    const ms = Date.now() - t0;
    X.writeAtomic(path.join(CFG.out, 'STATUS.md'), INS.status(graph, metrics, codec.report, ms));
    const props = INS.proposals({ graph, communities, pat, health: hc });
    X.writeAtomic(path.join(CFG.out, 'PROPOSALS.md'), props.md); X.writeAtomic(path.join(CFG.out, 'proposals.json'), JSON.stringify(props.cards, null, 1));
    const worst = H.write(hc, { ms, metrics });
    log(`VRG Stack: ${graph.nodes.length} nodes, ${edges.length} links, ${Object.keys(index.sessions).length} recorded sessions, ${communities.length} communities, ${props.cards.length} proposals · health ${worst} · ${(ms / 1000).toFixed(1)} s → ${CFG.out}`);
    return { graph, worst };
    } catch (e) {
      hc.fail('pipeline', `build stopped: ${String(e && e.message || e).split(/\r?\n/)[0]} — out/ keeps the last good files`);
      try { H.write(hc); } catch {}
      throw e;
    }
  });
}

/* a community in words: size, layers, the pillars inside it, its most common title words */
function describeCommunities(list, com) {
  const STOP = new Set(('the and for with from into one two new via per vrg varler md js html json docs readme a az és es egy hogy nem is meg the of to in on ' +
    'done project round main view plan build fix session update add notes data phase check this that what work next file files step answer answers open').split(' '));
  const groups = new Map();
  for (const n of list) { const c = com.get(n.id); if (c === undefined) continue; (groups.get(c) || groups.set(c, []).get(c)).push(n); }
  const out = [];
  for (const [id, ns] of groups) {
    if (ns.length < 3) continue;
    const layers = [...new Set(ns.map(n => n.layer))].sort();
    const pil = {}; for (const n of ns) for (const e of n.ent || []) pil[e] = (pil[e] || 0) + 1;
    const w = {}; for (const n of ns) for (const x of new Set(C.fold(n.title).split(/[^a-z0-9]+/).filter(x => x.length > 3 && !STOP.has(x) && !/^\d+$/.test(x)))) w[x] = (w[x] || 0) + 1;
    out.push({ id, size: ns.length, layers, pillars: Object.entries(pil).sort((a, b) => b[1] - a[1]).slice(0, 3),
      words: Object.entries(w).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0]),
      top: ns.sort((a, b) => b.rank - a.rank).slice(0, 6).map(n => n.id) });
  }
  return out.sort((a, b) => b.size - a.size);
}

module.exports = { run };
