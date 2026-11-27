// VRG Stack — the data of six layer pages (2026-11-27), each the page its layer's meta asked for (lib/meta.js):
//
//   N  Ajtótérkép      ajtok.html      window.DOORS     every door (START, servers, programs, catalog, Mobile), what it opens,
//                                                       whether that is still there; the code nothing opens
//   K  Figyelemtérkép  kerdesek.html   window.ASKS      asks per pillar per week; the repeated ones as threads; the ones
//                                                       no commit followed
//   M  Munkanaptár     munkak.html     window.JOBS      each job as a bar from its first file to its last, its tools
//   D  Műhelyasztal    eszkozok.html   window.BENCH     sketch → firmware → board, what each board runs, how old it is
//   V  Ruhatár         latvany.html    window.WARDROBE  every page with the look it wears, its kit components, its drift
//   O  Licencnapló     kulso.html      window.LEDGER    every dependency, its licence, its pin, its users, what CLAUDE.md asks
//   P  Tesztfal        probak.html     window.TESTWALL  every suite's recorded runs as a strip (data/probes.jsonl)
//
//   build.<L>(graph, …) → data     pure, from the written graph (the layers' details ride on it: job, dev, look, dep, probe)
//   write({ graph }) → { msg }      all six out/*-data.js, on every build (full or incremental)
'use strict';

const fs = require('fs');
const path = require('path');
const CFG = require('../config');
const X = require('./fsx');
const C = require('./common');

function ctx(graph) {
  const nodes = graph.nodes, byId = new Map(nodes.map(n => [n.id, n]));
  const edges = graph.edges.map(e => Array.isArray(e) ? { a: e[0], b: e[1], rel: e[2], w: e[4] } : e);
  const ents = new Map((graph.entities || []).map(e => [e.id, e]));
  const warned = new Map();   // node id → [[J id, kind, severity, title]]
  for (const e of edges) if (e.rel === 'warns') { const j = byId.get(e.a); if (j) (warned.get(e.b) || warned.set(e.b, []).get(e.b)).push([j.id, j.kind, j.state, C.clip(j.title, 160)]); }
  const stamp = { build: (graph && graph.build) || null, schema: (graph && graph.schema) || null, generated: new Date().toISOString() };
  return { nodes, byId, edges, ents, warned, stamp, sig: id => warned.get(id) || [], pname: p => (ents.get(p) || {}).name || p };
}

/* ---- K · Figyelemtérkép */
const isoWeek = d => { const t = new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10))); const day = (t.getUTCDay() + 6) % 7; t.setUTCDate(t.getUTCDate() - day + 3);
  const y = t.getUTCFullYear(), w1 = new Date(Date.UTC(y, 0, 4)); return `${y}-W${String(1 + Math.round(((t - w1) / 864e5 - 3 + ((w1.getUTCDay() + 6) % 7)) / 7)).padStart(2, '0')}`; };
function asks(graph) {
  const X_ = ctx(graph), led = new Map(), members = new Map();
  for (const e of X_.edges) { if (e.rel === 'led-to' && e.a.startsWith('K:')) (led.get(e.a) || led.set(e.a, []).get(e.a)).push(e.b); if (e.rel === 'contains' && e.a.startsWith('K:cluster.')) (members.get(e.a) || members.set(e.a, []).get(e.a)).push(e.b); }
  const pillarsOf = id => { const s = new Set(); for (const b of led.get(id) || []) { const t = X_.byId.get(b); if (!t) continue; for (const p of t.layer === 'E' ? [b.slice(2)] : (t.ent || [])) s.add(p); } return [...s]; };
  const A = X_.nodes.filter(n => n.layer === 'K' && n.kind !== 'cluster').sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0));
  const list = A.map(n => [n.id, n.kind, n.t || '', n.state, C.clip(n.title, 160), (/cluster (\w+)/.exec(n.lane || '') || [])[1] || '', pillarsOf(n.id)]);
  const last = list.length ? list[list.length - 1][2] : '';
  const weeks = []; if (last) { const end = Date.parse(last); for (let i = 11; i >= 0; i--) { const w = isoWeek(new Date(end - i * 7 * 864e5).toISOString().slice(0, 10)); if (!weeks.includes(w)) weeks.push(w); } }
  const per = new Map();
  for (const a of list) { const w = a[2] ? isoWeek(a[2]) : ''; for (const p of a[6]) { const r = per.get(p) || per.set(p, { all: 0, weeks: {} }).get(p); r.all++; if (w) r.weeks[w] = (r.weeks[w] || 0) + 1; } }
  const heat = [...per].sort((a, b) => b[1].all - a[1].all).slice(0, 16).map(([p, r]) => [p, X_.pname(p), r.all, weeks.map(w => r.weeks[w] || 0)]);
  const clusters = X_.nodes.filter(n => n.layer === 'K' && n.kind === 'cluster').map(n => [n.id, C.clip(n.title, 120), n.state, (n.k || {}).sessions || 0, (n.k || {}).first || '', (n.k || {}).last || n.t || '', members.get(n.id) || []])
    .sort((a, b) => (a[2] === 'open') - (b[2] === 'open') || (a[5] < b[5] ? 1 : -1)).reverse();
  return { ...X_.stamp, counts: { asks: list.length, committed: list.filter(a => a[3] === 'committed').length, clusters: clusters.length, open: clusters.filter(c => c[2] === 'open').length, pillars: per.size },
    weeks, heat, asks: list, clusters, nolanded: list.filter(a => a[3] === 'no commit').slice(-40).reverse().map(a => a[0]) };
}

/* ---- M · Munkanaptár */
function jobs(graph) {
  const X_ = ctx(graph);
  const J = X_.nodes.filter(n => n.layer === 'M').map(n => { const j = n.job || {}; return { id: n.id, code: n.title.split(' · ')[0], status: j.status || n.state || '', kinds: j.kinds || [], tools: j.tools || [], from: j.from || '', to: j.to || '', total: j.total, totalDate: j.totalDate || '', related: j.related || [], files: j.files || 0, ent: n.ent || [], signals: X_.sig(n.id) }; })
    .sort((a, b) => ((a.from || a.to) < (b.from || b.to) ? -1 : 1));
  const days = J.flatMap(j => [j.from, j.to]).filter(Boolean).sort();
  return { ...X_.stamp, counts: { jobs: J.length, running: J.filter(j => /^folyamat/i.test(j.status)).length, tools: J.filter(j => j.tools.length).length, quiet: J.filter(j => j.signals.length).length },
    range: [days[0] || '', days[days.length - 1] || ''], jobs: J, tools: { planner: 'Planner', kit: 'Workflow Kit' } };
}

/* ---- D · Műhelyasztal */
function bench(graph) {
  const X_ = ctx(graph), D = X_.nodes.filter(n => n.layer === 'D');
  const built = new Map(), flashed = new Map();
  for (const e of X_.edges) { if (e.rel === 'built-from') built.set(e.a, e.b); if (e.rel === 'flashed') (flashed.get(e.b) || flashed.set(e.b, []).get(e.b)).push([e.a, e.w || 1]); }
  const sk = n => ({ id: n.id, name: n.title, path: (n.dev || {}).path || '', example: n.state === 'example', signals: X_.sig(n.id) });
  const firmware = D.filter(n => n.kind === 'firmware').map(n => ({ id: n.id, name: n.title, brief: n.brief, latest: (n.dev || {}).latest || n.state, versions: (n.dev || {}).versions || [], chip: (n.dev || {}).chip || '', built: String((n.dev || {}).built || '').slice(0, 10),
    sketch: built.get(n.id) || '', boards: (flashed.get(n.id) || []).map(([b, w]) => [b, w]), signals: X_.sig(n.id) }));
  const boards = D.filter(n => n.kind === 'board').map(n => { const d = n.dev || {}; return { id: n.id, title: n.title, chip: d.chip || '', flash: d.flashSize || '', known: !!d.known, last: d.lastFlash || null, seen: n.t || '', signals: X_.sig(n.id) }; });
  const usedSk = new Set(firmware.map(f => f.sketch));
  return { ...X_.stamp, counts: { sketches: D.filter(n => n.kind === 'sketch').length, firmware: firmware.length, boards: boards.length, signals: D.reduce((a, n) => a + X_.sig(n.id).length, 0) },
    sketches: D.filter(n => n.kind === 'sketch').map(sk), firmware, boards, lonely: D.filter(n => n.kind === 'sketch' && !usedSk.has(n.id) && n.state !== 'example').map(n => n.id) };
}

/* ---- V · Ruhatár */
function wardrobe(graph) {
  const X_ = ctx(graph), V = X_.nodes.filter(n => n.layer === 'V');
  const wears = new Map(); for (const e of X_.edges) if (e.rel === 'wears') (wears.get(e.b) || wears.set(e.b, []).get(e.b)).push(e.a);
  const looks = V.filter(n => n.kind === 'look').map(n => { const l = n.look || {}; return { id: n.id, path: n.title, app: n.title.split('/')[0], state: n.state, melyviz: l.melyviz || '', kit: l.kit || null, kitLink: !!l.kitLink, latest: l.kitLatest || '', signals: X_.sig(n.id) }; })
    .sort((a, b) => (a.path < b.path ? -1 : 1));
  const components = V.filter(n => n.kind === 'component').map(n => ({ id: n.id, name: n.title, family: n.brief || '', wornBy: (wears.get(n.id) || []).length }));
  const systems = V.filter(n => n.kind === 'design system' || n.kind === 'style' || n.kind === 'theme' || n.kind === 'logo' || n.kind === 'visual base').map(n => ({ id: n.id, kind: n.kind, title: n.title, brief: n.brief }));
  const st = {}; for (const l of looks) st[l.state] = (st[l.state] || 0) + 1;
  return { ...X_.stamp, counts: { looks: looks.length, states: st, components: components.length, used: components.filter(c => c.wornBy).length },
    looks, components: components.sort((a, b) => b.wornBy - a.wornBy || (a.name < b.name ? -1 : 1)), systems };
}

/* ---- O · Licencnapló */
const LIC = [
  [/\bA?GPL|LGPL|SSPL|EUPL/i, 'copyleft: keep it a reference; copying it in binds our code to its terms', 'red'],
  [/\bMPL\b/i, 'weak copyleft: changes to its own files stay MPL; keep its notice', 'amber'],
  [/Apache/i, 'keep the licence and its NOTICE file with any copied code', 'ok'],
  [/BSD-3/i, 'keep the copyright notice; no endorsement by its authors (clause 3)', 'ok'],
  [/\bBSD\b|BSD-2/i, 'keep the copyright notice', 'ok'],
  [/\bMIT\b|\bISC\b/i, 'keep the copyright notice with any copied code (CLAUDE.md)', 'ok'],
  [/CC0|Unlicense|0BSD/i, 'public domain: nothing to keep', 'ok'],
];
function ledger(graph) {
  const X_ = ctx(graph);
  // the rule for its licence; a dual licence (A OR B) lets us take the permissive side, so it never reads as copyleft
  const req = l => { if (!l) return ['licence not confirmed: check it before copying any of it', 'amber']; const hit = LIC.find(([rx]) => rx.test(l)); return hit ? [hit[1], /\bOR\b/.test(l) && hit[2] !== 'ok' ? 'ok' : hit[2]] : ['not a known SPDX licence: confirm it', 'amber']; };
  const deps = X_.nodes.filter(n => n.layer === 'O').map(n => {
    const d = n.dep || {};
    let [rule, tone] = n.kind === 'mcp server' ? ['a server the sessions call: no code of it is copied in', 'mute'] : req(d.license || null);
    if (n.kind === 'reference' && tone === 'red') [rule, tone] = ['copyleft: fine as a reference, read only; never copy it in', 'amber'];
    return { id: n.id, kind: n.kind, name: n.title.split(' · ')[0], app: d.aspect || '', licence: d.license || '', tone, rule: d.license && /\bOR\b/.test(d.license) && n.kind !== 'mcp server' ? `dual: ${d.license}; take the permissive one` : rule,
      mode: d.mode || '', pin: n.kind === 'npm package' ? (d.versions || []).join(', ') : d.source === 'npm' ? 'npm ' + (d.ref || '') : `${d.refType || ''} ${d.ref || ''}`.trim(), pinOk: n.kind !== 'vendored' || d.source !== 'git' || d.refType === 'tag',
      users: d.usedBy || [], docs: d.docs || [], dev: !!d.dev, signals: X_.sig(n.id) };
  }).sort((a, b) => (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : a.name.localeCompare(b.name)));
  const lic = {}; for (const d of deps) if (d.kind !== 'mcp server') lic[d.licence || '—'] = (lic[d.licence || '—'] || 0) + 1;
  return { ...X_.stamp, counts: { deps: deps.length, vendored: deps.filter(d => d.kind === 'vendored').length, reference: deps.filter(d => d.kind === 'reference').length, npm: deps.filter(d => d.kind === 'npm package').length, mcp: deps.filter(d => d.kind === 'mcp server').length, signals: deps.reduce((a, d) => a + d.signals.length, 0) },
    licences: lic, deps };
}

/* ---- N · Ajtótérkép: every door, what it opens, whether that is still there */
function doors(graph, _records, { repo = C.REPO } = {}) {   // repo: the checkout to check paths in (tests pass theirs)
  const X_ = ctx(graph), N = X_.nodes.filter(n => n.layer === 'N');
  const kids = new Map(), out = new Map(), parent = new Set();
  for (const e of X_.edges) {
    if (!e.a.startsWith('N:')) continue;
    if (e.rel === 'contains') { (kids.get(e.a) || kids.set(e.a, []).get(e.a)).push(e.b); parent.add(e.b); }
    else if (e.rel === 'opens' || e.rel === 'launches') (out.get(e.a) || out.set(e.a, []).get(e.a)).push(e.b);
  }
  // where a door leads, and whether that is still there: a repo path is checked on disk; an H: path or a program
  // outside the repo is not this PC's question here (check-start asks it); a catalog item must land on a door
  const target = n => n.kind === 'mobile feature' ? 'Mobile/android/feature-' + n.id.slice(6) : (n.path || '');
  // a Mobile feature lives in its feature-<id> folder, or the app handles it in its own code (the desk, the sheets …):
  // its id quoted in a .kt file other than the catalogue (Feature.kt); a planned one with neither is planned, not broken
  let kt = null;
  const handled = id => {
    if (!kt) { kt = ''; try { for (const f of require('child_process').execFileSync('git', ['-C', repo, 'ls-files', 'Mobile/android'], { encoding: 'utf8' }).split('\n')) if (/\.kt$/.test(f) && !/\/Feature\.kt$|\/test\//.test(f)) { try { kt += fs.readFileSync(path.join(repo, f), 'utf8'); } catch {} } } catch { kt = ''; } }
    return kt.includes('"' + id + '"');
  };
  const state = n => {
    const t = target(n);
    if (n.kind === 'mobile feature') return fs.existsSync(path.join(repo, t)) ? 'ok' : n.state === 'planned' ? 'planned' : handled(n.id.slice(6)) ? 'in app' : 'missing';   // the app's lists name planned ones too
    if (n.kind === 'catalog') { const o = out.get(n.id) || []; return o.length ? (o.every(id => X_.byId.has(id)) ? 'ok' : 'missing') : 'none'; }
    if (!t) return 'none';
    if (/^\{|^[A-Za-z]:\//.test(t)) return 'outside';
    return fs.existsSync(path.join(repo, t)) ? 'ok' : 'missing';
  };
  const door = n => ({ id: n.id, kind: n.kind, title: n.title, key: n.id.startsWith('N:start.') ? n.id.slice(8) : '', brief: n.brief || '', target: target(n), state: state(n),
    lane: n.lane || '', stage: n.kind === 'mobile feature' ? n.state : '', kids: kids.get(n.id) || [], opens: (out.get(n.id) || []).filter(id => X_.byId.has(id)), pillars: n.ent || [], signals: X_.sig(n.id) });
  const all = N.map(door), by = new Map(all.map(d => [d.id, d]));
  const roots = all.filter(d => d.id.startsWith('N:start.') && !parent.has(d.id) && d.kind !== 'program').map(d => d.id);
  const unreachable = X_.nodes.filter(n => n.layer === 'J' && n.kind === 'unreachable').map(n => [n.id, n.title, (n.about || [])[0] || '']);
  const st = {}; for (const d of all) st[d.state] = (st[d.state] || 0) + 1;
  return { ...X_.stamp, counts: { doors: all.length, missing: st.missing || 0, outside: st.outside || 0, start: all.filter(d => d.id.startsWith('N:start.') && d.kind !== 'program').length,
    servers: all.filter(d => d.kind === 'server').length, programs: all.filter(d => d.kind === 'program').length, catalog: all.filter(d => d.kind === 'catalog').length, mobile: all.filter(d => d.kind === 'mobile feature').length, unreachable: unreachable.length },
    doors: all, roots, unreachable, groups: {
      servers: all.filter(d => d.kind === 'server').map(d => d.id), programs: all.filter(d => d.kind === 'program').map(d => d.id),
      catalog: all.filter(d => d.kind === 'catalog').map(d => d.id), mobile: all.filter(d => d.kind === 'mobile feature').map(d => d.id) } };
}

/* ---- P · Tesztfal */
function testwall(graph, records = []) {
  const X_ = ctx(graph), runs = new Map();
  for (const r of records) if (r && r.suite) (runs.get(r.suite) || runs.set(r.suite, []).get(r.suite)).push(r);
  const S = X_.nodes.filter(n => n.layer === 'P' && (n.kind === 'test suite' || n.kind === 'check')).map(n => {
    const p = n.probe || {}, path_ = n.title, hist = (runs.get(path_) || []).sort((a, b) => (a.at < b.at ? -1 : 1)).slice(-24);
    return { id: n.id, path: path_, kind: n.kind, state: n.state, runner: p.runner || n.lane || '', files: p.files || 0, keys: p.keys || [], ci: p.ci || [], cmds: p.cmds || [],
      runs: hist.map(r => [String(r.at).slice(0, 16).replace('T', ' '), r.skipped ? 'skip' : r.ok ? 'pass' : 'fail', r.pass, r.fail, r.head ? String(r.head).slice(0, 7) : '']), signals: X_.sig(n.id) };
  });
  const rank = { fail: 0, stale: 1, 'no runner': 2, unrun: 3, skipped: 4, pass: 5 };
  S.sort((a, b) => (rank[a.state] ?? 9) - (rank[b.state] ?? 9) || (a.path < b.path ? -1 : 1));
  const st = {}; for (const s of S) st[s.state] = (st[s.state] || 0) + 1;
  return { ...X_.stamp, counts: { suites: S.length, states: st, runs: records.length }, suites: S };
}

const build = { K: asks, M: jobs, D: bench, V: wardrobe, O: ledger, P: testwall, N: doors };
const FILES = [['N', 'doors-data.js', 'DOORS'], ['K', 'asks-data.js', 'ASKS'], ['M', 'jobs-data.js', 'JOBS'], ['D', 'bench-data.js', 'BENCH'], ['V', 'wardrobe-data.js', 'WARDROBE'], ['O', 'ledger-data.js', 'LEDGER'], ['P', 'testwall-data.js', 'TESTWALL']];

function write({ graph } = {}) {
  const g = graph || JSON.parse(fs.readFileSync(path.join(CFG.out, 'stack.json'), 'utf8'));
  let probes = []; try { probes = X.readJsonl(path.join(CFG.data, 'probes.jsonl')).records; } catch { probes = []; }
  const done = [];
  for (const [L, file, name] of FILES) {
    const data = build[L](g, probes);
    // the page contract (S7): every data file carries build: (graph && graph.build) || null, schema: (graph && graph.schema) || null
    if (name === 'DOORS') X.writeAtomic(path.join(CFG.out, file), '// generated by stack.js build (lib/layerpages.js)\nwindow.DOORS = ' + JSON.stringify(data) + ';\n');
    else if (name === 'ASKS') X.writeAtomic(path.join(CFG.out, file), '// generated by stack.js build (lib/layerpages.js)\nwindow.ASKS = ' + JSON.stringify(data) + ';\n');
    else if (name === 'JOBS') X.writeAtomic(path.join(CFG.out, file), '// generated by stack.js build (lib/layerpages.js)\nwindow.JOBS = ' + JSON.stringify(data) + ';\n');
    else if (name === 'BENCH') X.writeAtomic(path.join(CFG.out, file), '// generated by stack.js build (lib/layerpages.js)\nwindow.BENCH = ' + JSON.stringify(data) + ';\n');
    else if (name === 'WARDROBE') X.writeAtomic(path.join(CFG.out, file), '// generated by stack.js build (lib/layerpages.js)\nwindow.WARDROBE = ' + JSON.stringify(data) + ';\n');
    else if (name === 'LEDGER') X.writeAtomic(path.join(CFG.out, file), '// generated by stack.js build (lib/layerpages.js)\nwindow.LEDGER = ' + JSON.stringify(data) + ';\n');
    else X.writeAtomic(path.join(CFG.out, file), '// generated by stack.js build (lib/layerpages.js)\nwindow.TESTWALL = ' + JSON.stringify(data) + ';\n');
    done.push(`${L} ${Object.values(data.counts).filter(v => typeof v === 'number')[0] || 0}`);
  }
  return { msg: `layer pages: ${done.join(', ')} → out/{doors,asks,jobs,bench,wardrobe,ledger,testwall}-data.js` };
}

module.exports = { build, write, isoWeek, FILES };
