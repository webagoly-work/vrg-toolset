// VRG Stack — the build, as a list of guarded stages.
//
//   archive → layers F I Q L A R C G → join → record → U (Futás) → pillars → analytics
//   → validate → write graph → events + snapshot → index (+ embeddings) → codec · drift · status
//   → patterns · proposals · replay · connectome · lens · forecast · layer text · lineage · control · commits · decisions · metro · runs → health
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
const { join, knownSig } = require('./join');
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
    const adapters = { W: () => L.people(), F: () => L.featured(), V: () => L.look(facts), M: () => L.jobs(), D: () => L.devices(facts), O: () => L.outside(facts), N: () => L.entry(), P: () => L.probe(facts), I: () => L.ideas(), T: () => L.todo(facts), Q: () => L.decisions(facts), L: () => L.devlog(), A: () => L.agentic(facts), C: () => L.code(facts, commitsByPath), G: () => L.globe(facts) };
    for (const code of ['W', 'F', 'V', 'M', 'N', 'I', 'T', 'Q', 'L', 'A', 'P', 'C', 'D', 'O', 'G']) layers[code] = await hc.stage(`layer ${code} · ${LNAME[code]}`, adapters[code], { fallback: () => H.carryForward(prev, code) });
    const ordered = {}; for (const c of LAYER8) ordered[c] = layers[c];

    /* ---- 2–6. join, recordings, U, pillars, analytics, the graph (shared with the incremental build) */
    const A = await assemble(ordered, facts, prev, hc, log, { record: true, rerecord, analytics: true, cache: true });
    const { J, nodes, index, graph, g, communities, metrics } = A; const edges = A.edges;

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
    // Érintésnyom (erintesnyom.html): what the browser needs to resolve a tool call like record.js does — the repo's
    // names and its unique basenames; the keys themselves are the nodes' `own` in stack-data.js
    await hc.stage('lens index', () => {
      const body = { generated: new Date().toISOString(), repo: C.REPO, full: C.FULL,
        aliases: [C.FULL + '/Backup/code/Planner_VRG_U100-mirror', 'H:/Planner_VRG_U100'], basenames: Object.fromEntries(facts.basenames) };
      X.writeAtomic(path.join(CFG.out, 'lens-index.js'), '// generated by stack.js build\nwindow.STACK_LENS = ' + JSON.stringify(body) + ';\n');
      log(`lens index: ${Object.keys(body.basenames).length} basenames`);
    }, { optional: true });
    // Érintésnyom's Forecast (SL3): every recorded session's opening prompt and what it touched most, plus the prompt
    // templates (tools/prompts, START J), so the browser can say what a new prompt will probably touch
    await hc.stage('forecast index', () => {
      const sessions = Object.entries(index.sessions || {}).filter(([, s]) => s.title && (s.touched || []).length)
        .map(([sid, s]) => ({ sid, title: C.clip(s.title, 200), start: s.start || '', touched: s.touched.slice(0, 30) }));
      const pdir = path.join(C.REPO, 'tools', 'prompts');
      let templates = []; try { templates = fs.readdirSync(pdir).filter(f => f.endsWith('.txt')).map(f => ({ name: f.replace(/\.txt$/, ''), text: C.clip(fs.readFileSync(path.join(pdir, f), 'utf8'), 3000) })); } catch { templates = []; }
      X.writeAtomic(path.join(CFG.out, 'forecast-index.js'), '// generated by stack.js build\nwindow.STACK_FORECAST = ' + JSON.stringify({ generated: new Date().toISOString(), sessions, templates }) + ';\n');
      log(`forecast index: ${sessions.length} sessions, ${templates.length} templates`);
    }, { optional: true });
    // Rétegverem, the Stack Viewer (viewer.html, S8/S9): every layer as bytes, one range per node, diffed against the last build
    await hc.stage('layer text', () => log(require('./layertext').write({ graph, facts, out: CFG.out, repo: C.REPO, events: X.readJsonl(EV.LOG).records }).msg), { optional: true });
    await hc.stage('lineage', () => log(require('./lineage').write({ graph }).msg), { optional: true });   // Ötletfolyam (lineage.html)
    await hc.stage('control', () => log(require('./control').write({ graph }).msg), { optional: true });   // Vezérlőterem (control.html)
    await hc.stage('commits', () => log(require('./commitpixel').write({ graph }).msg), { optional: true });   // Commit-pixel (commits.html)
    await hc.stage('decisions', () => log(require('./decisions').write({ graph, q: layers.Q, nodes }).msg), { optional: true });   // Döntésnapló (decisions.html)
    await hc.stage('metro', () => log(require('./metro').write({ graph }).msg), { optional: true });   // Vonaltérkép (metro.html)
    await hc.stage('runs', () => log(require('./runs').write({ graph }).msg), { optional: true });   // Futásnapló (runs.html)
    await hc.stage('board', () => { const b = require('./board').write({ graph }); log(b.msg); const d = b.data.dupes;
      if (d.length) hc.warn('board', `${d.length} fields are kept in two hand-edited files (${[...new Set(d.map(x => x.field))].join(', ')}: ${d.slice(0, 5).map(x => x.thread).join(', ')}${d.length > 5 ? ' …' : ''}); the Füzértábla lists them, its value is the owner's`); }, { optional: true });   // Füzértábla (board.html, S4)
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

/* ---- steps 2–6 of a build: the join, the recordings and U, the pillars, analytics, the graph written out.
   o.record   run the recorder (full build) or read its last index (incremental)
   o.analytics PageRank + Louvain over the whole graph (full) or keep each node's last rank and community (incremental:
               stable colours between live builds, exact again on the next full build)
   o.cache    save each layer after the join, with its refs, for the next incremental build (out/layers/)
   o.reuseSig the cached known-keys sig: lets the join keep cached refs instead of reading every text again */
async function assemble(ordered, facts, prev, hc, log, o = {}) {
  const J = await hc.stage('join', () => join(ordered, facts, { reuseSig: o.reuseSig || null }));
  if (o.cache) await hc.stage('layer cache', () => saveCache(ordered, J.sig, o.cacheOnly), { optional: true });
  const { nodes } = J; let edges = J.edges;
  if (J.dangling.length) hc.warn('lineage', `${J.dangling.length} source links point at nodes that do not exist (dropped)`);
  hc.info('lineage', `${J.unresolved} mentions resolved to no node; ${J.alike} name matches (alike)`);

  /* ---- 3. recordings → U · Futás */
  const commits = ordered.R.nodes.filter(n => n.extra && n.extra.date).map(n => ({ h: n.id.slice(2), ms: Date.parse(n.extra.date), subject: n.title })).sort((a, b) => a.ms - b.ms);
  const resolve = (paths, text) => J.resolveText(paths.join(' ') + ' ' + (text || ''));
  const readIndex = () => X.readJson(path.join(REC.DIR, 'index.json'), { sessions: {} });
  const index = o.record
    ? await hc.stage('record sessions', () => REC.recordAll({ resolve, commits, force: !!o.rerecord, log }), { fallback: readIndex })
    : readIndex();
  const U = futas(index, nodes);
  for (const n of U.nodes) nodes.set(n.id, n);
  for (const e of U.edges) edges.push({ ...e, v: nodes.get(e.a).layer !== nodes.get(e.b).layer ? 1 : 0 });

  /* ---- 3b. the Founder's asks → K · Kérések (S13): a full build reads them out of the recordings and keeps them in
     out/layers/K-src.json; an incremental build reads that file (the recordings only change on a full build) */
  const KSRC = path.join(CACHE(), 'K-src.json');
  const asks = await hc.stage('layer K · Kérések', () => {
    const KA = require('./asks');
    let sessions = !o.record ? X.readJson(KSRC, null) : null;
    if (!sessions) { sessions = KA.collect(index.sessions, REC.readRecording); fs.mkdirSync(CACHE(), { recursive: true }); X.writeAtomic(KSRC, JSON.stringify(sessions)); }
    return KA.layer({ sessions, resolve: t => J.resolveText(t), has: id => nodes.has(id) });
  }, { fallback: () => ({ nodes: [], edges: [] }) });
  for (const n of asks.nodes) nodes.set(n.id, n);
  for (const e of asks.edges) if (nodes.has(e.a) && nodes.has(e.b)) edges.push({ ...e, v: nodes.get(e.a).layer !== nodes.get(e.b).layer ? 1 : 0 });
  if (asks.nodes.length) log(`K: ${asks.nodes.filter(n => n.kind !== 'cluster').length} asks, ${asks.nodes.filter(n => n.kind === 'cluster').length} clusters`);

  /* ---- 4. pillars */
  let T = null; try { const f = CFG.sources.notes + '/devlog/threads.js'; delete require.cache[require.resolve(f)]; T = require(f); } catch { T = null; }
  const threadLines = {}, threadIds = [], threadTodo = {};
  for (const a of (T && T.AREAS) || []) for (const r of a.rows) { threadIds.push(r.id); threadLines[r.id] = r.lines || []; }
  for (const n of (ordered.T && ordered.T.nodes) || []) for (const th of (n.extra && n.extra.threads) || []) (threadTodo[th] = threadTodo[th] || []).push(n.id);
  let ENTS = ENT; try { delete require.cache[require.resolve('../entities')]; delete require.cache[require.resolve('../entities.json')]; ENTS = require('../entities'); } catch { ENTS = ENT; }
  const entities = pillars(nodes, edges, ENTS, { threadLines, threadIds: threadTodo });
  if (!T) hc.warn('pillars', 'notes/devlog/threads.js could not be read: pillars got no thread lines');
  else {
    const has = new Set(ENTS.map(e => e.thread).filter(Boolean));
    const lost = threadIds.filter(t => !has.has(t));
    if (lost.length) hc.warn('pillars', `${lost.length} Thread Board threads have no pillar: ${lost.join(', ')} (add them to entities.json)`);
    const twice = entities.filter(e => e.status && e.per.F).map(e => e.id);
    if (twice.length) hc.warn('pillars', `hand status kept twice (the pillar has an F row, whose tier wins): ${twice.join(', ')}`);
    const dead = ENTS.filter(e => e.thread && !threadIds.includes(e.thread)).map(e => e.id);
    if (dead.length) hc.warn('pillars', `pillars name a thread the board does not have: ${dead.join(', ')}`);
  }

  /* ---- 4b. open work that looks done (S3): the evidence becomes links */
  const TD = require('./todo').check(nodes, edges, (ordered.T && ordered.T.built) || []);
  if (TD.looksDone.length) hc.info('todo', `${TD.looksDone.length} open-work items look done (DRIFT.md §9): ${TD.looksDone.slice(0, 6).map(t => t.title).join(', ')}`);

  /* ---- 4c. signals → J · Jelzések (S14): every warning the stack knows, on what it is about. The brief check is a child
     process (tools/brief-state.js): a full build runs it and keeps it in out/layers/J-briefs.json, an incremental one
     reads that. Health warnings count up to this point (the schema check after this is in HEALTH.md only). */
  const JB = path.join(CACHE(), 'J-briefs.json');
  const sig = await hc.stage('layer J · Jelzések', () => {
    let briefs = o.record ? null : X.readJson(JB, null);
    if (!briefs) { try { briefs = require('./control').briefCheck(CFG.sources.repo); } catch { briefs = { problems: {} }; } fs.mkdirSync(CACHE(), { recursive: true }); X.writeAtomic(JB, JSON.stringify(briefs)); }
    const r = require('./signals').detect({ nodes, edges, entities, S: require('./strings'), sopts: CFG.strings || {}, looksDone: TD.looksDone, checks: o.record ? hc.checks : [], briefs });
    // the build's own health: a full build's checks; an incremental one runs fewer stages, so it keeps the last full
    // build's health signals rather than dropping them (they would come and go in the event log with every live build)
    if (!o.record) for (const n of (prev && prev.nodes) || []) if (n.layer === 'J' && n.kind === 'health') r.nodes.push({ ...n, own: n.own || [], text: n.title, extra: { sev: n.state, about: [] } });
    return r;
  }, { fallback: () => ({ nodes: [], edges: [] }) });
  for (const n of sig.nodes) nodes.set(n.id, n);
  for (const e of sig.edges) edges.push({ ...e, v: nodes.get(e.a).layer !== nodes.get(e.b).layer ? 1 : 0 });
  { const c = { red: 0, amber: 0, info: 0 }; for (const n of sig.nodes) c[n.state]++; hc.info('signals', `J: ${sig.nodes.length} signals (${c.red} red, ${c.amber} amber, ${c.info} info)`); }

  /* ---- 5. validate, then analytics on the evidence graph */
  edges = H.validate(nodes, edges, hc);
  const list = [...nodes.values()];
  const today = new Date().toISOString().slice(0, 10);
  let g = null, metrics = null, communities;
  if (o.analytics) {
    g = G.index(list, edges, { pillars: false });
    const und = g.undirected();
    const pr = M.pagerank(und);
    const com = louvain(und);
    for (const n of list) { n.rank = +(1e3 * (pr.get(n.id) || 0)).toFixed(3); n.com = com.has(n.id) ? com.get(n.id) : -1; n.para = EN.para(n, today); n.actor = EN.actor(n); }
    metrics = M.measure(und, { layer: id => nodes.get(id).layer, pillar: id => ((nodes.get(id).ent || [])[0] || id), /* a node with no pillar is its own group */ community: id => com.get(id) }, nodes);
    communities = describeCommunities(list, com);
    metrics.communities = communities.length;
  } else {
    const P = new Map(((prev && prev.nodes) || []).map(n => [n.id, n]));
    for (const n of list) { const q = P.get(n.id); n.rank = q ? q.rank : 0; n.com = q ? q.com : -1; n.para = EN.para(n, today); n.actor = EN.actor(n); }
    communities = (prev && prev.communities) || [];
  }

  /* ---- 6. the graph */
  const deg = new Map();
  for (const e of edges) for (const x of [e.a, e.b]) { const d = deg.get(x) || { h: 0, v: 0, p: 0 }; e.v === 2 ? d.p++ : e.v ? d.v++ : d.h++; deg.set(x, d); }
  const pub = n => ({ id: n.id, layer: n.layer, kind: n.kind, title: C.clip(n.title, 140), brief: C.clip(n.brief, 300), t: n.t || '', state: n.state || '',
    lane: n.lane || '', tier: n.tier || '', own: n.own, ent: n.ent || [], deg: deg.get(n.id) || { h: 0, v: 0, p: 0 },
    path: (n.extra && n.extra.path) || (n.own.find(k => k.startsWith('p:')) || '').slice(2) || '',
    rank: n.rank, com: n.com, para: n.para, actor: n.actor, ...(n.stale ? { stale: true } : {}), ...(n.evidence ? { evidence: n.evidence } : {}),
    ...(n.layer === 'T' && n.extra ? { from: n.extra.sources, labels: n.extra.labels || {} } : {}),
    ...(n.layer === 'P' && n.extra && n.extra.cmds ? { probe: { last: n.extra.last, keys: n.extra.keys, ci: n.extra.ci, stale: n.extra.stale } } : {}),
    ...(n.layer === 'K' && n.kind === 'cluster' && n.extra ? { k: { asks: n.extra.asks, sessions: n.extra.sessions, first: n.extra.first, last: n.extra.last } } : {}),
    ...(n.layer === 'J' && n.extra ? { about: n.extra.about } : {}),
    ...(n.layer === 'M' && n.extra ? { job: { tools: n.extra.tools, status: n.extra.status, kinds: n.extra.kinds } } : {}) });
  const graph = {
    about: 'VRG Stack — multilayer database of the VRG work. Generated by notes/stack (stack.js build); never edit by hand.',
    schema: CFG.schema, generated: new Date().toISOString(), layers: META, entities, communities,
    nodes: list.map(pub), edges,
  };
  // the build stamp every page shows (S7): a number that only grows, full or incremental, and when
  graph.build = Object.assign({ kind: 'full' }, o.build || {}, { no: ((prev && prev.build && prev.build.no) || 0) + 1, generated: graph.generated });
  H.compare(prev && prev.schema === CFG.schema ? prev : null, graph, hc);
  X.writeAtomic(path.join(CFG.out, 'stack.json'), JSON.stringify(graph));
  X.writeAtomic(path.join(CFG.out, 'stack-data.js'), '// generated by stack.js build\nwindow.STACK = ' + JSON.stringify({ ...graph, edges: edges.map(e => [e.a, e.b, e.rel, e.v]) }) + ';\n');
  X.writeAtomic(path.join(CFG.out, 'build-stamp.js'), '// generated by stack.js build: the newest build, for pages opened from file://\nwindow.STACK_BUILD = ' + JSON.stringify(graph.build) + ';\n');
  return { J, nodes, edges, index, list, g, metrics, communities, graph };
}

/* ---- the layer cache (out/layers/<L>.json + meta.json): each layer as the join left it (with `ref`), texts clipped.
   Written by every full build; read by runLayers. A layer whose adapter ran gets a fresh copy after the join. */
const CACHE = () => path.join(CFG.out, 'layers');
const CACHE_TEXT = 4000;
const LAYER8 = ['W', 'F', 'V', 'M', 'N', 'I', 'T', 'Q', 'L', 'A', 'P', 'R', 'C', 'D', 'O', 'G'];   // every adapter layer (the name is older than T)
function saveCache(ordered, sig, only) {
  fs.mkdirSync(CACHE(), { recursive: true });
  for (const code of LAYER8) {
    const lay = ordered[code]; if (!lay || (only && !only.includes(code))) continue;
    const nodes = lay.nodes.map(n => ({ ...n, text: typeof n.text === 'string' ? n.text.slice(0, CACHE_TEXT) : n.text, ent: undefined, rank: undefined, com: undefined, para: undefined, actor: undefined, evidence: undefined, state: n.layer === 'T' ? 'open' : n.state }));
    X.writeAtomic(path.join(CACHE(), code + '.json'), JSON.stringify({ nodes, edges: lay.edges.filter(e => e.rel !== 'looks-done'), ...(lay.built ? { built: lay.built } : {}) }));
  }
  X.writeAtomic(path.join(CACHE(), 'meta.json'), JSON.stringify({ sig, at: new Date().toISOString(), layers: LAYER8.filter(c => ordered[c]) }));
}
function loadCache() {
  const meta = X.readJson(path.join(CACHE(), 'meta.json'));
  if (!meta || !meta.sig) return null;
  const layers = {};
  for (const code of LAYER8) { const l = X.readJson(path.join(CACHE(), code + '.json')); if (!l || !Array.isArray(l.nodes)) return null; layers[code] = l; }
  return { sig: meta.sig, at: meta.at, layers };
}

/* ---- the incremental build (S5, research/STRINGS-PLAN.md §3.2): only the changed layers' adapters run; the rest come
   from the cache; the join keeps every cached node's refs; recordings, search, embeddings, the reports and the heavy
   pages wait for the next full build. Returns { kind: 'incremental', layers, ids, ms } or, when an incremental build
   cannot be exact (no cache yet, or the known keys changed: a new file, commit, session or memory), { fallback: why }
   and builds nothing: the caller then runs the full build. */
const ADAPT = {
  W: () => L.people(), F: () => L.featured(), V: facts => L.look(facts), M: () => L.jobs(), D: facts => L.devices(facts), O: facts => L.outside(facts), N: () => L.entry(), P: facts => L.probe(facts), I: () => L.ideas(), T: facts => L.todo(facts), Q: facts => L.decisions(facts), L: () => L.devlog(), A: facts => L.agentic(facts),
  R: () => L.devrepo(), C: (facts, lay) => L.code(facts, commitsOf(lay.R)), G: facts => L.globe(facts),
};
function commitsOf(R) {
  const m = new Map();
  for (const n of (R && R.nodes) || []) for (const f of (n.extra && n.extra.files) || []) if (!m.has(f) || m.get(f) < n.t) m.set(f, n.t);
  return m;
}
const PAGE_STAGES = {
  Q: ['decisions'], L: ['metro', 'board'], I: ['lineage'], A: ['control'], R: ['commits'], F: ['board'], T: ['board'], N: [], P: [], M: [], D: [], V: [], O: [], W: [],
  E: ['decisions', 'metro', 'lineage', 'control', 'commits', 'runs', 'board'],
};
async function runLayers(codes, { quiet = true } = {}) {
  const log = quiet ? () => {} : m => console.log(m);
  const want = [...new Set(codes)].filter(c => ADAPT[c] || c === 'E');
  if (!want.length) return { kind: 'none', layers: [], ids: [], ms: 0 };
  return X.withLock(CFG.out, CFG.health.lockStaleMin, async () => {
    const t0 = Date.now();
    const hc = H.collector();
    const prevRaw = X.readJson(path.join(CFG.out, 'stack.json'));
    const prev = prevRaw && Array.isArray(prevRaw.nodes) ? prevRaw : null;
    const cache = loadCache();
    if (!prev || !cache) return { fallback: 'no layer cache yet (the next full build writes it)' };
    const facts = C.repoFacts();
    const ordered = {};
    for (const c of LAYER8) ordered[c] = cache.layers[c];
    const changedKeys = 'the known keys changed (a new file, commit, session or memory): a full build reads every text again';
    if (knownSig(ordered, facts) !== cache.sig) return { fallback: changedKeys };   // the repo's files: no adapter needs to run to know
    for (const c of want) if (ADAPT[c]) ordered[c] = await hc.stage(`layer ${c} · ${LNAME[c]}`, () => ADAPT[c](facts, ordered));
    const ordered8 = {}; for (const c of LAYER8) ordered8[c] = ordered[c];
    if (knownSig(ordered8, facts) !== cache.sig) return { fallback: changedKeys };   // a new commit (R), session (L) or memory (A)
    const A = await assemble(ordered8, facts, prev, hc, log, { record: false, analytics: false, cache: true, cacheOnly: want.filter(c => ADAPT[c]), reuseSig: cache.sig, build: { kind: 'incremental', layers: want } });
    const { graph, nodes } = A;
    const ev = EV.diff(prev, graph, graph.generated);
    await hc.stage('events + snapshot', () => EV.record(prev, graph), { optional: true });
    await hc.stage('layer text', () => require('./layertext').write({ graph, facts, out: CFG.out, repo: C.REPO, events: X.readJsonl(EV.LOG).records,
      only: want.includes('E') ? null : want, note: { kind: 'incremental', layers: want, ids: [...new Set(ev.map(e => e.id))].slice(0, 500) } }), { optional: true });
    const pages = new Set(); for (const c of want) for (const p of PAGE_STAGES[c] || []) pages.add(p);
    const PAGE = { decisions: () => require('./decisions').write({ graph, q: ordered8.Q, nodes }), metro: () => require('./metro').write({ graph }), lineage: () => require('./lineage').write({ graph }),
      control: () => require('./control').write({ graph }), commits: () => require('./commitpixel').write({ graph }), runs: () => require('./runs').write({ graph }),
      board: () => require('./board').write({ graph }) };
    for (const p of pages) await hc.stage(p, () => log(PAGE[p]().msg), { optional: true });
    const ms = Date.now() - t0;
    const failed = [];
    log(`VRG Stack (incremental ${want.join(' ')}): ${graph.nodes.length} nodes, ${ev.length} events, pages ${[...pages].join(' ') || '–'} · ${ms} ms`);
    return { kind: 'incremental', layers: want, ids: [...new Set(ev.map(e => e.id))], events: ev.length, pages: [...pages], ms };
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

module.exports = { run, runLayers, assemble, saveCache, loadCache, ADAPT, PAGE_STAGES };
