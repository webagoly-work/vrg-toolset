#!/usr/bin/env node
// VRG Stack as JSON for the Desktop: node cards, layer-filtered expand, token-budgeted context packs.
//
//   node stack-json.js [--stack <dir>] node <id>
//   node stack-json.js [--stack <dir>] expand <id,id,...> [--layers FIQLARCGE] [--depth 1|2] [--max 200]
//   node stack-json.js [--stack <dir>] pack <id,id,...> --budget N [--l0] [--lines] [--title "..."]
//
// expand: the seeds always pass the layer filter (DESK-Q58 C); the filter applies to what grows from them.
// pack --lines: each card gets a  src: <path>  line (the node's file in the repo or notes), so Claude can open and cite it (DESK-Q59 C).
//
// Reads <stack>/out/stack.json and <stack>/out/codec/L0.txt only. No network, no writes, no cache.
// Errors: {"ok":false,"err":"..."} on stdout, exit code 2.
'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_STACK = 'H:\\VRG\\Full\\notes\\stack';
const ORDER = 'FIQLARCGE';
const tok = s => Math.ceil(String(s).length / 4);
const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

class StackError extends Error {}

function load(stackDir) {
  const file = path.join(stackDir || DEFAULT_STACK, 'out', 'stack.json');
  let G;
  try { G = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { throw new StackError('cannot read stack.json: ' + (e.code || e.message)); }
  const byId = new Map(G.nodes.map(n => [n.id, n]));
  for (const e of G.entities || []) byId.set('E:' + e.id, { id: 'E:' + e.id, layer: 'E', kind: 'pillar', title: e.name, brief: '', state: `${e.members.length} nodes`, t: '' });
  const nb = new Map();
  for (const e of G.edges) for (const [x, y, dir] of [[e.a, e.b, '→'], [e.b, e.a, '←']]) { if (!nb.has(x)) nb.set(x, []); nb.get(x).push({ id: y, rel: e.rel, v: e.v, dir }); }
  return { G, byId, nb, dir: stackDir || DEFAULT_STACK };
}

function readL0(stackDir) {
  try { return fs.readFileSync(path.join(stackDir || DEFAULT_STACK, 'out', 'codec', 'L0.txt'), 'utf8'); } catch { return ''; }
}

function need(S, id) {
  const n = S.byId.get(id);
  if (!n) throw new StackError('no node ' + id);
  return n;
}

// vertical evidence (v=1) first, then pillar (v=2), then horizontal (no v); stable by layer order, then id
function rank(x) { return x.v === 1 ? 0 : x.v === 2 ? 1 : 2; }
function links(S, id) {
  const seen = new Set();
  return (S.nb.get(id) || [])
    .filter(x => S.byId.has(x.id))
    .filter(x => { const k = x.id + '|' + x.rel + '|' + x.dir; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => (rank(a) - rank(b)) || (ORDER.indexOf(S.byId.get(a.id).layer) - ORDER.indexOf(S.byId.get(b.id).layer)) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map(x => ({ id: x.id, rel: x.rel, v: x.v || 0, dir: x.dir, layer: S.byId.get(x.id).layer, title: S.byId.get(x.id).title }));
}

function nodeCard(S, id) {
  const n = need(S, id);
  return { id: n.id, layer: n.layer, kind: n.kind, title: n.title, brief: n.brief || '', state: n.state || '', t: n.t || '', links: links(S, id) };
}

const shortLine = n => `${n.id} ${clip(n.title, 70)}${n.state ? ' [' + clip(n.state, 24) + ']' : ''}${n.t ? ' ' + n.t : ''}`;

function expand(S, ids, { layers = ORDER, depth = 1, max = 200 } = {}) {
  const ok = new Set(String(layers).split(''));
  const picked = new Map();
  let frontier = [];
  const add = id => { if (picked.size >= max || picked.has(id)) return false; picked.set(id, S.byId.get(id)); return true; };
  for (const id of ids) { need(S, id); if (add(id)) frontier.push(id); }        // a seed is kept whatever its layer
  for (let d = 0; d < depth && frontier.length; d++) {
    const next = [];
    for (const id of frontier) for (const x of links(S, id)) if (ok.has(x.layer) && add(x.id)) next.push(x.id);
    frontier = next;
  }
  const edges = []; const seen = new Set();
  for (const e of S.G.edges) {
    if (!picked.has(e.a) || !picked.has(e.b)) continue;
    const k = e.a + '|' + e.b + '|' + e.rel; if (seen.has(k)) continue; seen.add(k);
    edges.push({ a: e.a, b: e.b, rel: e.rel });
  }
  const nodes = [...picked.values()].map(n => ({ id: n.id, layer: n.layer, title: n.title, state: n.state || '', t: n.t || '' }));
  return { nodes, edges, tokens: nodes.reduce((s, n) => s + tok(shortLine(n)), 0) };
}

function pack(S, ids, { budget, l0 = false, lines: withSrc = false, title = '', l0Text = '' } = {}) {
  const cards = ids.map(id => {
    const n = need(S, id);
    const lines = [`## ${n.id} ${n.title}${n.state ? ' [' + n.state + ']' : ''}`];
    if (n.brief) lines.push(clip(n.brief, 300));
    if (withSrc && typeof n.path === 'string' && n.path) lines.push('src: ' + clip(n.path, 200));
    for (const x of links(S, id).slice(0, 8)) lines.push(`- ${x.rel} → ${x.id} ${x.title}`);
    return lines.join('\n');
  });
  const date = new Date().toISOString().slice(0, 10);
  const head = k => `# VRG context pack · ${date} · ${k} nodes` + (title ? `\n${title}` : '');
  const reserve = 20; // the closing summary line
  const out = [head(ids.length)];
  let used = tok(out[0]) + reserve;
  if (l0 && l0Text.trim()) {
    const cut = l0Text.trim().slice(0, Math.floor(budget * 0.25) * 4);
    if (used + tok(cut) <= budget) { out.push(cut); used += tok(cut); }
  }
  let kept = 0;
  for (const c of cards) {
    if (used + tok(c) + 1 > budget) break;
    out.push(c); used += tok(c) + 1; kept++;
  }
  out[0] = head(kept);
  const left = cards.length - kept;
  const body = out.join('\n');
  const total = tok(body);
  return `${body}\n(budget ${budget}, used ${total}, ${left} nodes left out)`;
}

function parse(argv) {
  const a = argv.slice();
  const opt = (name, def) => { const i = a.indexOf(name); if (i < 0) return def; const v = a[i + 1]; if (v === undefined) throw new StackError('missing value for ' + name); a.splice(i, 2); return v; };
  const flag = name => { const i = a.indexOf(name); if (i < 0) return false; a.splice(i, 1); return true; };
  const o = { stack: opt('--stack', DEFAULT_STACK), layers: opt('--layers', ORDER), depth: opt('--depth', '1'), max: opt('--max', '200'), budget: opt('--budget', null), title: opt('--title', ''), l0: flag('--l0'), lines: flag('--lines') };
  o.cmd = a.shift(); o.rest = a;
  return o;
}

function run(argv) {
  const o = parse(argv);
  const idList = s => String(s || '').split(',').map(x => x.trim()).filter(Boolean);
  if (!['node', 'expand', 'pack'].includes(o.cmd)) throw new StackError('usage: node | expand | pack');
  const ids = o.cmd === 'node' ? [o.rest[0]].filter(Boolean) : idList(o.rest[0]);
  if (!ids.length) throw new StackError('no id given');
  const S = load(o.stack);
  if (o.cmd === 'node') return { text: JSON.stringify(nodeCard(S, ids[0])) };
  if (o.cmd === 'expand') {
    if (!/^[FIQLARCGE]+$/.test(o.layers)) throw new StackError('bad --layers');
    const depth = +o.depth, max = +o.max;
    if (depth !== 1 && depth !== 2) throw new StackError('--depth must be 1 or 2');
    if (!Number.isInteger(max) || max < 1) throw new StackError('bad --max');
    return { text: JSON.stringify(expand(S, ids, { layers: o.layers, depth, max })) };
  }
  const budget = +o.budget;
  if (!Number.isInteger(budget) || budget < 1) throw new StackError('--budget N is required');
  ids.forEach(id => need(S, id));
  return { text: pack(S, ids, { budget, l0: o.l0, lines: o.lines, title: o.title, l0Text: o.l0 ? readL0(o.stack) : '' }) };
}

if (require.main === module) {
  try {
    process.stdout.write(run(process.argv.slice(2)).text + '\n');
  } catch (e) {
    if (!(e instanceof StackError)) throw e;
    process.stdout.write(JSON.stringify({ ok: false, err: e.message }) + '\n');
    process.exitCode = 2;
  }
}

module.exports = { load, links, nodeCard, expand, pack, run };
