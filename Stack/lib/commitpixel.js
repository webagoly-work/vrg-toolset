// VRG Stack — Commit-pixel data for commits.html, the R layer's own page.
//
//   out/commits-data.js   window.COMMITS = { branches, areas, pillars, rels, nodes, c, … }
//
// Where the data comes from (read-only):
//   · the R layer as the stack holds it (the graph the build just made, or out/stack.json): the set of
//     commits, their subject, brief (DevRep TL;DR or body), kind (merge / session start), pillars (E) and
//     every link from a commit to another layer: DevLog lines and sessions (L, with each session's line),
//     runs (U), ideas (I), decisions (Q), the agentic layer (A), folders (C) and documents (G);
//   · ONE `git log --all` plus `git for-each-ref` for what the stack's public node drops (STK-P20): the
//     exact time of day, the full parents, the full ref names, and the file list → top-level folders
//     ("areas"). Branch lanes are derived here (STK-P21): every branch tip claims its first-parent chain
//     (main first, then the other tips oldest first), then the second parent of a merge claims its chain
//     under the name in the merge message; what is left is "(ismeretlen ág)".
// The stack's own R nodes are the set (carried forward when git fails); git only adds detail. If git
// fails here, the page still opens: no lanes, areas from the commit's C links instead.
// Compact on purpose (STK-P19): string tables + indices, one array per commit, links as one integer.
// Writes out/commits-data.js only (fsx.writeAtomic).
'use strict';

const fs = require('fs');
const path = require('path');
const CFG = require('../config');
const X = require('./fsx');
const C = require('./common');
const META = require('./meta');

const LAYER_HU = Object.fromEntries(META.map(m => [m.code, m.hu])); LAYER_HU.E = 'Pillér';
const LINK_LAYERS = 'LUIQACG';             // which other layers a commit's day panel lists
const UNKNOWN = '(ismeretlen ág)';
const ROOT = '(gyökér)';                   // files at the repo root

/* ---- what git knows that the stack's public node does not */
function gitFacts() {
  const SEP = '\x1e', US = '\x1f';
  const raw = C.git('-c', 'core.quotepath=off', 'log', '--all', '--date=iso-strict', `--format=${SEP}%H${US}%P${US}%ad${US}%D${US}%s`, '--name-only');
  const byFull = new Map();
  for (const rec of raw.split(SEP).filter(Boolean)) {
    const [h, parents, date, refs, rest] = rec.split(US);
    const lines = (rest || '').split('\n');
    const subject = lines.shift();
    byFull.set(h, { h, h7: h.slice(0, 7), parents: parents.trim() ? parents.trim().split(' ') : [], date, ms: Date.parse(date), refs: refs || '', subject, files: lines.filter(Boolean) });
  }
  const tips = C.git('for-each-ref', '--format=%(refname)%09%(objectname)', 'refs/heads', 'refs/remotes').split('\n').filter(Boolean).map(l => {
    const [ref, h] = l.split('\t');
    const local = ref.startsWith('refs/heads/');
    const name = local ? ref.slice(11) : ref.slice(13).replace(/^[^/]+\//, '');   // refs/remotes/<remote>/<name>
    return { name, h, local };
  }).filter(t => t.name !== 'HEAD' && byFull.has(t.h));
  // archived branch tips: tags named archive/<date>/<branch> (GO MAIN parks a branch this way before deleting it)
  for (const l of C.git('for-each-ref', '--format=%(refname:short)%09%(objectname)%09%(*objectname)', 'refs/tags/archive').split('\n').filter(Boolean)) {
    const [ref, h, peeled] = l.split('\t'), m = /^archive\/[^/]+\/(.+)$/.exec(ref), target = peeled || h;
    if (m && byFull.has(target)) tips.push({ name: m[1], h: target, local: false, archived: true });
  }
  return { byFull, tips };
}

/* ---- branch lanes: first-parent chains claimed by tips, then by merge messages */
function lanes(byFull, tips) {
  const names = [], idx = new Map(), local = new Set();
  const nameIdx = n => { if (!idx.has(n)) { idx.set(n, names.length); names.push(n); } return idx.get(n); };
  const of = new Map();                                          // full hash → branch index
  const walk = (h, b) => { while (h && byFull.has(h) && !of.has(h)) { of.set(h, b); h = byFull.get(h).parents[0]; } };
  for (const t of tips) if (t.local) local.add(t.name);
  // main first, then live tips before archived ones, oldest tip first (a branch cut from another claims only its own part)
  const order = [...tips].sort((a, b) => (b.name === 'main') - (a.name === 'main') || !!a.archived - !!b.archived || b.local - a.local || byFull.get(a.h).ms - byFull.get(b.h).ms);
  const known = new Set(tips.map(t => t.name));
  nameIdx('main');
  for (const t of order) walk(t.h, nameIdx(t.name));
  const merges = [...byFull.values()].filter(c => c.parents.length > 1).sort((a, b) => a.ms - b.ms);
  for (const m of merges) {
    const s = m.subject;
    // "Merge branch 'x'", "Merge remote-tracking branch 'origin/x'", "Merge pull request #1 from owner/x", "dev-all: merge x (…)",
    // "Merge origin/x: …", "Merge x into main": the word after "merge", when it is a known ref or looks like a branch name
    const r = /^Merge pull request #\d+ from [^/\s]+\/(\S+)/.exec(s) || /\bmerge (?:remote-tracking branch |branch )?'?([\w./-]+?)'?(?=[\s:(),]|$)/i.exec(s);
    let nm = r ? r[1].replace(/^(origin|backup)\//, '') : null;
    if (nm && !known.has(nm) && !/[/-]/.test(nm)) nm = null;
    for (const p of m.parents.slice(1)) if (!of.has(p)) walk(p, nameIdx(nm || '(névtelen ág · ' + m.h7 + ')'));
  }
  for (const c of [...byFull.values()].sort((a, b) => b.ms - a.ms)) if (!of.has(c.h)) walk(c.h, nameIdx(UNKNOWN));
  return { names, of, local };
}

function build(graph) {
  const byId = new Map(graph.nodes.map(n => [n.id, n]));
  const R = graph.nodes.filter(n => n.layer === 'R');
  const edgeRows = (graph.edges || []).map(e => Array.isArray(e) ? { a: e[0], b: e[1], rel: e[2], v: e[3] } : e);

  let G = null, why = '';
  try { G = gitFacts(); } catch (e) { why = String(e && e.message || e).split(/\r?\n/)[0]; }
  const by7 = new Map(); if (G) for (const c of G.byFull.values()) if (!by7.has(c.h7)) by7.set(c.h7, c);
  const L = G ? lanes(G.byFull, G.tips) : { names: [UNKNOWN], of: new Map(), local: new Set() };

  // the session → line map (DevLog), so a commit's session shows the line it belongs to
  const lineOf = new Map();
  for (const e of edgeRows) if (e.rel === 'on-line') lineOf.set(e.a, e.b);

  // node table (linked nodes) and relation table, shared by every commit
  const nodes = [], nodeIdx = new Map(), rels = [], relIdx = new Map();
  const nIdx = id => {
    if (nodeIdx.has(id)) return nodeIdx.get(id);
    const n = byId.get(id); if (!n) return -1;
    const i = nodes.length; nodeIdx.set(id, i); nodes.push(null);
    const line = n.layer === 'L' && lineOf.has(id) ? nIdx(lineOf.get(id)) : -1;
    const title = n.title === id.slice(2) ? '' : C.clip(n.title, 90);              // a folder's title is its path: not stored twice
    nodes[i] = [id, n.layer, n.kind || '', title, 'CG'.includes(n.layer) ? '' : (n.t || '').slice(0, 10), line];
    return i;
  };
  const rIdx = r => { if (!relIdx.has(r)) { relIdx.set(r, rels.length); rels.push(r); } return relIdx.get(r); };

  const rIds = new Set(R.map(n => n.id));
  const linksOf = new Map(), parentsOf = new Map(), mentions = new Map();
  for (const e of edgeRows) {
    const ia = rIds.has(e.a), ib = rIds.has(e.b);
    if (ia && ib) {
      if (e.rel === 'parent' || e.rel === 'merged-in') (parentsOf.get(e.b) || parentsOf.set(e.b, []).get(e.b)).push([e.a, e.rel]);
      else (mentions.get(e.a) || mentions.set(e.a, []).get(e.a)).push(e.b);
      continue;
    }
    if (!ia && !ib) continue;
    const me = ia ? e.a : e.b, other = ia ? e.b : e.a;
    if (!LINK_LAYERS.includes(other[0])) continue;
    (linksOf.get(me) || linksOf.set(me, []).get(me)).push([other, e.rel]);
  }

  // areas = top-level folders of the files a commit touched (git); without git, the C links' first segment
  const areaCount = new Map(), pillarCount = new Map();
  const rows = R.map(n => {
    const h7 = n.id.slice(2), g = by7.get(h7);
    const areas = new Set();
    if (g) for (const f of g.files) areas.add(f.includes('/') ? f.slice(0, f.indexOf('/')) : ROOT);
    else for (const [o] of linksOf.get(n.id) || []) if (o[0] === 'C') areas.add(o.slice(2).split('/')[0]);
    for (const a of areas) areaCount.set(a, (areaCount.get(a) || 0) + 1);
    const pil = (n.ent || []).filter(Boolean);
    for (const p of pil) pillarCount.set(p, (pillarCount.get(p) || 0) + 1);
    return { n, h7, g, areas: [...areas], pil, ms: g ? g.ms : Date.parse(n.t || '') || 0 };
  }).sort((a, b) => a.ms - b.ms || a.h7.localeCompare(b.h7));

  const areas = [...areaCount].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const aIdx = new Map(areas.map(([a], i) => [a, i]));
  const entName = new Map((graph.entities || []).map(e => [e.id, e.name]));
  const pillars = [...pillarCount].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([id, k]) => [id, entName.get(id) || id, k]);
  const pIdx = new Map(pillars.map(([id], i) => [id, i]));
  const cIdx = new Map(rows.map((r, i) => [r.h7, i]));

  const days = rows.map(r => (r.g ? r.g.date : r.n.t || '').slice(0, 10)).filter(Boolean).sort();
  const first = days[0] || '', last = days[days.length - 1] || '';
  const d0 = first ? Date.parse(first + 'T00:00:00Z') : 0;
  const branchN = new Map();
  const c = rows.map(r => {
    const { n, h7, g } = r;
    const date = g ? g.date : (n.t || '');
    const d = date ? Math.round((Date.parse(date.slice(0, 10) + 'T00:00:00Z') - d0) / 864e5) : -1;
    const br = g && L.of.has(g.h) ? L.of.get(g.h) : L.names.indexOf(UNKNOWN) >= 0 ? L.names.indexOf(UNKNOWN) : (L.names.push(UNKNOWN), L.names.length - 1);
    branchN.set(br, (branchN.get(br) || 0) + 1);
    const flags = (n.kind === 'merge' ? 1 : 0) | (n.kind === 'session start' ? 2 : 0) | (g ? 0 : 4);
    // parents: git's full list (first parent first), else the stack's parent / merged-in edges
    const par = g ? g.parents.map(p => p.slice(0, 7)) : (parentsOf.get(n.id) || []).sort((x, y) => (x[1] === 'merged-in') - (y[1] === 'merged-in')).map(x => x[0].slice(2));
    const seen = new Set();
    const links = (linksOf.get(n.id) || []).filter(([o]) => !seen.has(o) && seen.add(o)).map(([o, rel]) => { const i = nIdx(o); return i < 0 ? -1 : i * 16 + rIdx(rel); }).filter(x => x >= 0);
    const men = (mentions.get(n.id) || []).map(h => cIdx.get(h.slice(2))).filter(x => x !== undefined);
    return [h7, d, date.length > 15 ? date.slice(11, 16) : '', br, flags, n.title || '', g ? g.files.length : 0,
      r.areas.map(a => aIdx.get(a)), r.pil.map(p => pIdx.get(p)), par.map(p => cIdx.has(p) ? cIdx.get(p) : -1),
      links, C.clip(n.brief || '', 220), g ? g.refs : (n.state || ''), men];
  });
  if (rels.length > 16) throw new Error('more than 16 relation kinds; widen the link encoding');

  const branches = L.names.map((nm, i) => [nm, L.local.has(nm) ? 1 : 0, branchN.get(i) || 0]);
  return {
    about: 'VRG Stack — Commit-pixel data. Generated by Stack/lib/commitpixel.js on every stack build; never edit by hand.',
    generated: graph.generated || new Date().toISOString(),
    today: new Date().toISOString().slice(0, 10),
    first, last, git: G ? '' : (why || 'git not available'),
    layers: LAYER_HU,
    // row shapes (the page reads them by position):
    shape: {
      c: 'h7, day (0 = first), hh:mm, branch, flags (1 merge, 2 session start, 4 not in git), subject, files, areas[], pillars[], parents[] (commit index, -1 = outside the stack), links[] (node*16 + rel), brief, refs, mentions[] (commit index)',
      nodes: 'id, layer, kind, title ("" = the id is the title), date (not for C, G), line (node index of a session\'s DevLog line, -1)', branches: 'name, local (1 = a local branch exists), commits',
    },
    branches, areas, pillars, rels, nodes, c,
    counts: { commits: c.length, merges: c.filter(r => r[4] & 1).length, days: new Set(c.map(r => r[1])).size, branches: branches.filter(b => b[2]).length,
      links: c.reduce((s, r) => s + r[10].length, 0), nodes: nodes.length },
  };
}

function write({ graph } = {}) {
  const t0 = Date.now();
  const g = graph || JSON.parse(fs.readFileSync(path.join(CFG.out, 'stack.json'), 'utf8'));
  const data = build(g);
  const body = '// generated by stack.js build (lib/commitpixel.js)\nwindow.COMMITS = ' + JSON.stringify(data) + ';\n';
  X.writeAtomic(path.join(CFG.out, 'commits-data.js'), body);
  const k = data.counts;
  return { data, msg: `commits: ${k.commits} commits on ${k.days} days, ${k.merges} merges, ${k.branches} branches, ${k.links} links to ${k.nodes} nodes${data.git ? ' (git: ' + data.git + ')' : ''} · ${(Buffer.byteLength(body) / 1024).toFixed(0)} KB · ${Date.now() - t0} ms → out/commits-data.js` };
}

module.exports = { build, write };
