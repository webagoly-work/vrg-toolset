// VRG Stack — T · Teendők (open work), S3 of research/STRINGS-PLAN.md (§2.2, §5): every not-yet item, de-duplicated,
// as a node, so open work gets vertical links and can be checked against the evidence.
//
//   collect({ threads, lines, roadmaps }) → { raw, built }  the Thread Board's `t` lists (threads.js), the DevLog lines'
//                                                           `remaining` (lines.js), the ✗ rows of ROADMAP*.md tables;
//                                                           built: every thread's built list (`d`), for the check
//   layer(raw, built) → { nodes, edges, built }            one T node per item, the same item from several places
//                                                           merged (equal or near-equal words); edges to the L lines
//   check(nodes, edges, built) → { looksDone }             "késznek tűnik · looks done": a built F row (tier ≤ 2) whose
//                                                           title holds every telling word of the item, two or more
//                                                           commits that do (items of two or more telling words), or a
//                                                           thread's built list that names the same item
//   drift(graph, S, opts) → cards                           STK-Q20 narrow A: a pillar's hand value (its F tier, or the
//                                                           hand `status` of a pillar with no F row) two or more steps
//                                                           from what its string shows; a proposal, never applied
//
// Not T on purpose: PROPOSALS (the stack's own suggestions, recomputed each build: they would feed the build its own
// output) and open decisions (already Q nodes; a T item that names one links to it through the join).
'use strict';

const C = require('./common');

const GENERIC = new Set(('the and for with from into that this then than when what page view data file files list tool tools ' +
  'build built make new old more one two all any its via per add page oldal egy hogy nem még már meg kell lesz nincs ' +
  'stack vrg varler step phase round work line lines layer').split(' '));
const stem = w => w.slice(0, 6);
const words = s => C.fold(String(s || '').replace(/`/g, '')).split(/[^a-z0-9]+/).filter(w => (w.length >= 3 || /\d/.test(w)) && !/^\d+$/.test(w));
// the words that tell an item apart: not the generic ones; short acronyms and codes (OTG, CYD, P7, T1) count
const telling = s => [...new Set(words(s).filter(w => !GENERIC.has(w)).map(stem))];
const label0 = s => C.fold(String(s || '').replace(/`/g, '')).replace(/[^a-z0-9]+/g, ' ').trim();
const strongOf = s => telling(s).length >= 2 || words(s).some(x => x.length >= 8 && !GENERIC.has(x));
const stems = s => new Set(words(s).map(stem));
const slug = s => C.fold(String(s || '')).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'item';

/* ---- an item as a file may write it: 'text', ['label', 'hint'], { l, h } */
function item(x) {
  if (typeof x === 'string') { const m = /^(.{3,80}?)\s+[—–:-]\s+(.+)$/.exec(x); return m ? { label: m[1].trim(), hint: m[2].trim() } : { label: x.trim(), hint: '' }; }
  if (Array.isArray(x)) return { label: String(x[0] || '').trim(), hint: String(x[1] || '').trim() };
  if (x && typeof x === 'object') return { label: String(x.l || x.label || x.n || '').trim(), hint: String(x.h || x.hint || '').trim() };
  return null;
}

function collect({ threads = null, lines = null, roadmaps = [] } = {}) {
  const raw = [], built = [];
  for (const a of (threads && threads.AREAS) || []) for (const r of a.rows || []) {
    for (const x of r.d || []) { const it = item(x); if (it && it.label) built.push({ label: it.label, thread: r.id }); }
    for (const x of r.t || []) { const it = item(x); if (it && it.label) raw.push({ ...it, from: { src: 'thread', id: r.id, area: a.area || a.name || '' }, threads: [r.id], lines: r.lines || [] }); }
  }
  for (const l of (lines && lines.LINES) || []) for (const x of l.remaining || []) {
    const it = item(x); if (it && it.label) raw.push({ ...it, from: { src: 'line', id: l.id }, threads: [], lines: [l.id] });
  }
  for (const { file, text } of roadmaps) {
    String(text || '').split(/\r?\n/).forEach((row, i) => {
      if (!/^\s*\|/.test(row) || !/✗/.test(row) || /✅/.test(row)) return;
      const cells = row.split('|').slice(1, -1).map(c => c.trim());
      if (!cells.length || /^-+$/.test(cells[0])) return;
      const label = cells[0].replace(/^\*\*|\*\*$/g, '').replace(/^\d+(\.\d+)*\s+/, '').trim();
      const hint = cells.slice(1).filter(c => c !== '✗' && !/^✗\s*$/.test(c)).join(' · ').replace(/✗\s*/g, '').trim();
      if (label) raw.push({ label, hint, from: { src: 'roadmap', file, line: i + 1 }, threads: [], lines: [] });
    });
  }
  return { raw, built };
}

/* ---- one node per item: equal telling words, or 80 % of them shared, make the same item */
function layer(raw, built = []) {
  const groups = [];
  for (const r of raw) {
    const w = telling(r.label);
    // with one telling word, only the same text is the same item: within one thread ("Build" on two threads are two
    // things), or a ROADMAP / line item repeating a board item ("more layers")
    const base = '=' + label0(r.label), key = w.length >= 2 ? w.slice().sort().join(' ') : base + (r.from.src === 'thread' ? '@' + r.from.id : '');
    let g = groups.find(x => x.key === key);
    if (!g && w.length < 2 && r.from.src !== 'thread') g = groups.find(x => x.base === base);
    if (!g && w.length >= 2) g = groups.find(x => { const inter = x.w.filter(s => w.includes(s)).length; return 2 * inter / (x.w.length + w.length) >= 0.8; });
    if (!g) { g = { key, base, w, label: r.label, hints: [], from: [], threads: new Set(), lines: new Set() }; groups.push(g); }
    if (r.hint && !g.hints.includes(r.hint)) g.hints.push(r.hint);
    g.from.push(r.from); r.threads.forEach(t => g.threads.add(t)); r.lines.forEach(l => g.lines.add(l));
  }
  const nodes = [], edges = [], used = new Set();
  for (const g of groups) {
    let id = 'T:' + slug(g.label), k = 2; while (used.has(id)) id = 'T:' + slug(g.label) + '-' + k++; used.add(id);
    const src = g.from.map(f => f.src === 'thread' ? 'thread ' + f.id : f.src === 'line' ? 'line ' + f.id : `${f.file}:${f.line}`);
    nodes.push({ id, layer: 'T', kind: 'todo', title: g.label, brief: C.clip(g.hints.join(' · '), 300), state: 'open', t: '', tier: '',
      lane: [...g.threads][0] || [...g.lines][0] || 'roadmap', own: [], text: [g.label, ...g.hints, ...g.from.filter(f => f.file).map(f => f.file)].join('\n'),
      extra: { from: g.from, sources: src, threads: [...g.threads], lines: [...g.lines] } });
    for (const l of g.lines) edges.push({ a: id, b: 'L:' + l, rel: 'todo-of' });
  }
  return { nodes, edges, built };
}

/* ---- looks done: the evidence a T item is already built */
function check(nodes, edges, built = []) {
  const dice = (a, b) => { if (!a.length || !b.length) return 0; const B = new Set(b); let i = 0; for (const x of a) if (B.has(x)) i++; return 2 * i / (a.length + b.length); };
  const all = (a, b) => { const B = new Set(b); return a.every(x => B.has(x)); };
  const F = [], R = [], BL = built.map(b => ({ ...b, w: telling(b.label) }));
  for (const n of nodes.values()) {
    if (n.layer === 'F' && +n.tier >= 1 && +n.tier <= 2) F.push({ n, w: telling(n.title) });
    if (n.layer === 'R' && n.kind === 'commit') R.push({ n, w: telling(n.title) });
  }
  const looksDone = [];
  for (const t of nodes.values()) {
    if (t.layer !== 'T') continue;
    const w = telling(t.title); if (!w.length) continue;
    const strong = strongOf(t.title);   // one short word proves nothing: then only the same label counts
    const ev = [];
    for (const b of BL) if (strong ? dice(w, b.w) >= 0.8 : label0(b.label) === label0(t.title)) ev.push({ kind: 'board', text: `built on the Thread Board (thread ${b.thread}): “${b.label}”` });
    for (const f of F) if (all(w, f.w) && dice(w, f.w) >= 0.5 && (strong || f.w.length === 1)) ev.push({ kind: 'F', id: f.n.id, text: `${f.n.title} (F tier ${f.n.tier})` });
    // commit subjects are long and loose: only items with two or more telling words ("Packaging" ≠ "the Vázlat package")
    const rs = w.length >= 2 ? R.filter(r => all(w, r.w)).sort((a, b) => String(b.n.t).localeCompare(String(a.n.t))) : [];
    for (const r of rs.slice(0, 3)) ev.push({ kind: 'R', id: r.n.id, text: `${r.n.id.slice(2)} ${r.n.title}` });
    const done = ev.some(e => e.kind === 'F' || e.kind === 'board') || rs.length >= 2;
    if (!done) continue;
    t.state = 'looks done'; t.evidence = ev.slice(0, 6);
    for (const e of ev) if (e.id) edges.push({ a: t.id, b: e.id, rel: 'looks-done', v: 1 });
    looksDone.push(t);
  }
  return { looksDone };
}

/* ---- status drift (STK-Q20 narrow A) on the six-step scale idea · out · low · mid · high · op */
const SCALE = ['idea', 'out', 'low', 'mid', 'high', 'op'];
const TIER_STEP = { 1: 5, 2: 4, 3: 3, 4: 1, 5: 0 };                       // in use · built · in development · planned · idea
const CLASS_STEP = { program: 5, quiet: 4, build: 3, planned: 1, spark: 0 }; // orphan and loose say nothing about maturity
function drift(graph, S, opts = {}) {
  const ix = S.prepare(graph.nodes, (graph.edges || []).map(e => Array.isArray(e) ? { a: e[0], b: e[1], rel: e[2], v: e[3] } : e));
  const byId = new Map(graph.nodes.map(n => [n.id, n]));
  const cards = [];
  for (const p of graph.entities || []) {
    const s = S.string(ix, 'E:' + p.id, opts); if (!s || !(s.cls in CLASS_STEP)) continue;
    const fs = (p.members || []).map(id => byId.get(id)).filter(n => n && n.layer === 'F' && +n.tier >= 1);
    let hand, what;
    if (fs.length) { const best = fs.reduce((a, b) => (+a.tier <= +b.tier ? a : b)); hand = TIER_STEP[+best.tier]; what = `F tier ${best.tier} (${best.title})`; }
    else if (p.status && SCALE.includes(p.status)) { hand = SCALE.indexOf(p.status); what = `hand status ${p.status}`; }
    else continue;
    if (hand == null) continue;
    const ev = CLASS_STEP[s.cls], gap = ev - hand;
    if (Math.abs(gap) < 2) continue;
    cards.push({ pillar: p.id, name: p.name, hand: SCALE[hand], what, evidence: SCALE[ev], cls: s.cls, mask: s.mask, pulse: s.pulse || '', gap,
      propose: fs.length ? `consider F tier ${Object.keys(TIER_STEP).find(k => TIER_STEP[k] === ev) || '?'} for ${fs[0].title}` : `consider status ${SCALE[ev]} in entities.json` });
  }
  return cards.sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap) || a.pillar.localeCompare(b.pillar));
}

module.exports = { collect, layer, check, drift, item, telling, SCALE };
