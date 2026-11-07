// VRG Stack — health: observability checks and self-repair (STK-Q13 = A, step 1).
//
// Two jobs.
// 1. During a build, `collector()` runs every stage under a guard. A stage that throws does not
//    stop the build: a layer whose source broke is carried forward from the last good build
//    (marked stale), an optional stage (archive, embeddings, replay) is skipped. Each result is
//    written to out/HEALTH.md with the data-observability checks:
//      freshness     is a source newer than what the stack shows?
//      volume        did a layer lose more than 30 % of its nodes in one build?
//      schema        are the nodes and links valid, every relation registered?
//      distribution  did the share of vertical links move sharply?
//      lineage       links that point at nothing, mentions that resolve to nothing
// 2. `doctor()` checks the outputs and the history (out/ and data/) and, with fix = true,
//    repairs what is derived (rebuild) and what is torn (the last line of an append-only log).
//    Sources are never touched: a source problem becomes a line in HEALTH.md, for a person.
'use strict';

const fs = require('fs');
const path = require('path');
const CFG = require('../config');
const X = require('./fsx');
const { checkNode } = require('../schema/shapes');
const { rel } = require('../schema/links');

function collector() {
  const stages = [], checks = [];
  const add = (kind, level, msg) => checks.push({ kind, level, msg });
  return {
    stages, checks,
    warn: (kind, msg) => add(kind, 'warn', msg),
    info: (kind, msg) => add(kind, 'ok', msg),
    fail: (kind, msg) => add(kind, 'fail', msg),
    /* run fn; on error use fallback() (if given) and mark the stage degraded */
    async stage(name, fn, { fallback, optional = false } = {}) {
      const t0 = Date.now();
      try { const r = await fn(); stages.push({ name, state: 'ok', ms: Date.now() - t0 }); return r; }
      catch (e) {
        const msg = String(e && e.message || e).split('\n')[0];
        if (fallback) { stages.push({ name, state: 'carried', ms: Date.now() - t0, msg }); add('pipeline', 'warn', `${name} failed (${msg}); the last good data was kept`); return fallback(); }
        if (optional) { stages.push({ name, state: 'skipped', ms: Date.now() - t0, msg }); add('pipeline', 'warn', `${name} skipped: ${msg}`); return null; }
        stages.push({ name, state: 'failed', ms: Date.now() - t0, msg }); throw e;
      }
    },
  };
}

/* the last good build's nodes of one layer, as adapter output (stale: true) */
function carryForward(prev, code) {
  if (!prev) throw new Error(`no earlier build to carry layer ${code} from`);
  const nodes = prev.nodes.filter(n => n.layer === code).map(n => ({ ...n, own: n.own || [], text: `${n.title}\n${n.brief || ''}`, extra: { path: n.path || '' }, stale: true }));
  const ids = new Set(nodes.map(n => n.id));
  const edges = prev.edges.filter(e => !e.v && ids.has(e.a) && ids.has(e.b)).map(e => ({ a: e.a, b: e.b, rel: e.rel }));
  return { nodes, edges };
}

/* schema: drop invalid nodes, report unknown relations */
function validate(nodes, edges, H) {
  let bad = 0;
  let soft = 0;
  for (const [id, n] of nodes) {
    const p = checkNode(n);
    const fatal = p.filter(x => !x.startsWith('date')); // a loose date is kept and reported; a broken id is left out
    if (p.length > fatal.length) soft++;
    if (fatal.length) { bad++; if (bad <= 10) H.warn('schema', `${id}: ${fatal.join('; ')} — left out`); nodes.delete(id); }
  }
  if (soft) H.warn('schema', `${soft} nodes have a date that is not YYYY-MM-DD (kept; time-respecting paths ignore their date)`);
  const unknown = new Map();
  for (const e of edges) if (!rel(e.rel)) unknown.set(e.rel, (unknown.get(e.rel) || 0) + 1);
  for (const [r, c] of unknown) H.warn('schema', `relation "${r}" (${c} links) is not in schema/links.js — add its verbs`);
  if (!bad && !unknown.size) H.info('schema', `${nodes.size} nodes and ${edges.length} links valid`);
  return edges.filter(e => nodes.has(e.a) && nodes.has(e.b));
}

/* volume + distribution against the previous build */
function compare(prev, graph, H) {
  if (!prev) { H.info('volume', 'first build of this schema: no earlier counts to compare'); return; }
  const count = g => { const c = {}; for (const n of g.nodes) c[n.layer] = (c[n.layer] || 0) + 1; return c; };
  const a = count(prev), b = count(graph);
  for (const l of Object.keys({ ...a, ...b })) {
    const was = a[l] || 0, now = b[l] || 0;
    if (was && now < was * (1 - CFG.health.volumeDrop)) H.warn('volume', `layer ${l} fell from ${was} to ${now} nodes — check its source`);
  }
  const vshare = g => { const es = g.edges.filter(e => (Array.isArray(e) ? e[3] : e.v) !== 2); return es.length ? es.filter(e => (Array.isArray(e) ? e[3] : e.v) === 1).length / es.length : 0; };
  const s0 = vshare(prev), s1 = vshare(graph);
  if (s0 && Math.abs(s1 - s0) / s0 > 0.25) H.warn('distribution', `vertical share of links moved from ${(100 * s0).toFixed(0)} % to ${(100 * s1).toFixed(0)} %`);
  else H.info('distribution', `vertical links ${(100 * s1).toFixed(0)} % of evidence links`);
}

/* freshness: a source changed after the newest thing the stack shows from it */
function freshness(H, sources) {
  for (const [name, file, shown] of sources) {
    const m = X.mtime(file);
    if (!m) { H.warn('freshness', `${name}: source ${file} not found`); continue; }
    if (shown && m - Date.parse(shown) > 3 * 864e5) H.info('freshness', `${name}: source changed ${new Date(m).toISOString().slice(0, 10)}, newest item ${shown.slice(0, 10)}`);
  }
}

function write(H, extra = {}) {
  const icon = { ok: '✓', warn: '⚠', fail: '✗' };
  const st = { ok: '✓', carried: '↺ carried', skipped: '– skipped', failed: '✗ failed' };
  const worst = H.checks.some(c => c.level === 'fail') || H.stages.some(s => s.state === 'failed') ? 'fail'
    : H.checks.some(c => c.level === 'warn') || H.stages.some(s => s.state !== 'ok') ? 'warn' : 'ok';
  const md = [
    `# VRG Stack — health`, ``, `${new Date().toISOString().slice(0, 16).replace('T', ' ')} · overall **${worst}**. Sources are never changed by the stack; anything here that needs a source fixed is for a person.`, ``,
    `## Stages`, ``, `| Stage | State | ms | Note |`, `|---|---|---|---|`,
    ...H.stages.map(s => `| ${s.name} | ${st[s.state]} | ${s.ms} | ${s.msg || ''} |`), ``,
    `## Checks`, ``, ...['pipeline', 'freshness', 'volume', 'schema', 'distribution', 'lineage', 'search', 'retention'].flatMap(k => {
      const cs = H.checks.filter(c => c.kind === k); return cs.length ? [`**${k}**`, ...cs.map(c => `- ${icon[c.level]} ${c.msg}`), ``] : [];
    }),
  ].join('\n');
  X.writeAtomic(path.join(CFG.out, 'HEALTH.md'), md);
  X.writeAtomic(path.join(CFG.out, 'health.json'), JSON.stringify({ at: new Date().toISOString(), worst, stages: H.stages, checks: H.checks, ...extra }, null, 1));
  return worst;
}

/* retention guard: the setting that keeps transcripts (STK-Q8) */
function retention(H) {
  const s = X.readJson(path.join(CFG.sources.claudeHome, 'settings.json'), {});
  const d = s.cleanupPeriodDays;
  if (d === 0) H.fail('retention', 'cleanupPeriodDays is 0: Claude Code then stops writing transcripts — set it to 3650');
  else if (!d || d < 365) H.warn('retention', `cleanupPeriodDays is ${d || 'unset (30)'}: transcripts older than that are deleted; the archive still keeps copies`);
  else H.info('retention', `cleanupPeriodDays ${d}; archive at ${CFG.archive.dir}`);
}

/* ------------------------------------------------------------ doctor: check (and repair) out/ and data/ */
function doctor({ fix = false } = {}) {
  const res = []; let needBuild = false;
  const ok = (check, msg) => res.push({ check, ok: true, msg });
  const bad = (check, msg, repair) => { res.push({ check, ok: false, msg, repair }); };
  const sj = path.join(CFG.out, 'stack.json');
  const g = X.readJson(sj);
  if (!g) { bad('graph', 'out/stack.json missing or unreadable', 'rebuild'); needBuild = true; }
  else if (g.schema !== CFG.schema) { bad('graph', `out/stack.json has schema ${g.schema || 1}, the code expects ${CFG.schema}`, 'rebuild'); needBuild = true; }
  else ok('graph', `${g.nodes.length} nodes, built ${g.generated.slice(0, 16)}`);
  for (const f of ['stack-data.js', 'codec/L0.txt', 'DRIFT.md', 'STATUS.md']) {
    if (fs.existsSync(path.join(CFG.out, f))) ok('outputs', f); else { bad('outputs', `out/${f} missing`, 'rebuild'); needBuild = true; }
  }
  try {
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(path.join(CFG.out, 'stack.sqlite'), { readOnly: true });
    const ic = db.prepare('PRAGMA quick_check').get(); const n = db.prepare('SELECT count(*) AS c FROM nodes').get().c; db.close();
    if (Object.values(ic)[0] !== 'ok') { bad('index', 'stack.sqlite fails its integrity check', 'rebuild'); needBuild = true; }
    else if (g && n !== g.nodes.length) { bad('index', `index has ${n} nodes, the graph ${g.nodes.length}`, 'rebuild'); needBuild = true; }
    else ok('index', `${n} nodes indexed`);
  } catch (e) { bad('index', 'stack.sqlite cannot be opened: ' + e.message, 'rebuild'); needBuild = true; }
  const idx = X.readJson(path.join(CFG.out, 'recordings', 'index.json'));
  if (!idx) bad('recordings', 'no recordings index yet', 'rebuild');
  else {
    const missing = Object.keys(idx.sessions).filter(s => !fs.existsSync(path.join(CFG.out, 'recordings', s + '.jsonl')));
    missing.length ? (bad('recordings', `${missing.length} recordings listed but missing`, 'rebuild'), needBuild = true) : ok('recordings', `${Object.keys(idx.sessions).length} sessions recorded`);
  }
  for (const f of [path.join(CFG.data, 'events.jsonl'), path.join(CFG.data, 'metrics.jsonl')]) {
    if (!fs.existsSync(f)) { ok('history', `${path.basename(f)} not started yet`); continue; }
    const r = X.readJsonl(f);
    if (!r.bad.length) { ok('history', `${path.basename(f)}: ${r.records.length} records`); continue; }
    if (fix) { const rep = X.repairJsonl(f); rep.repaired ? ok('history', `${path.basename(f)}: torn last line cut (kept in .torn)`) : bad('history', `${path.basename(f)}: ${rep.reason}`, 'by hand'); }
    else bad('history', `${path.basename(f)}: ${r.bad.length} unreadable lines`, r.bad.every(b => b.last) ? 'repair' : 'by hand');
  }
  const lock = path.join(CFG.out, '.lock');
  if (fs.existsSync(lock)) {
    const age = (Date.now() - X.mtime(lock)) / 60000;
    if (age > CFG.health.lockStaleMin) { if (fix) { fs.unlinkSync(lock); ok('lock', 'stale build lock removed'); } else bad('lock', `stale build lock (${Math.round(age)} min)`, 'remove'); }
    else ok('lock', 'a build is running now');
  }
  const H = collector(); retention(H);
  for (const c of H.checks) c.level === 'ok' ? ok('retention', c.msg) : bad('retention', c.msg, 'by hand (user settings)');
  return { results: res, needBuild };
}

module.exports = { collector, carryForward, validate, compare, freshness, write, retention, doctor };
