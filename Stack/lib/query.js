// VRG Stack — the questions an agent or a person asks, as plain functions returning text.
// stack.js (the CLI) and mcp/server.js (the MCP server) both call these, so they never disagree.
//
// load() heals on read: when out/stack.json is missing or has an older schema, it runs one build
// first. Everything else only reads out/.
'use strict';

const fs = require('fs');
const path = require('path');
const CFG = require('../config');
const X = require('./fsx');
const G = require('./graph');
const S = require('./search');
const REC = require('./record');
const { rel } = require('../schema/links');
const { clip } = require('./common');

const ORDER = 'FIQLAURCGE';
const tok = s => Math.ceil(String(s).length / 4);
let cache = null;
let HEAL = true; // the MCP server turns this off: a server answers, it never builds
const readOnly = () => { HEAL = false; };

async function load({ heal = HEAL } = {}) {
  const file = path.join(CFG.out, 'stack.json');
  let g = X.readJson(file);
  if ((!g || g.schema !== CFG.schema) && heal) {
    process.stderr.write(`stack: ${g ? 'schema ' + (g.schema || 1) + ' is old' : 'no data yet'} — building once (about a minute) …\n`);
    await require('./pipeline').run({ quiet: true, noEmbed: true });
    g = X.readJson(file);
  }
  if (!g) throw new Error('no stack data: run  node stack.js build');
  const stamp = X.mtime(file);
  if (cache && cache.stamp === stamp) return cache;
  const byId = new Map(g.nodes.map(n => [n.id, n]));
  const idx = G.index(g.nodes, g.edges, { pillars: true });
  const LNAME = Object.fromEntries(g.layers.map(m => [m.code, m.en])); LNAME.E = 'Pillar';
  cache = { g, byId, idx, LNAME, stamp };
  return cache;
}

const short = n => `${n.id} ${clip(n.title, 70)}${n.state ? ' [' + clip(n.state, 24) + ']' : ''}${n.t ? ' ' + n.t : ''}${n.stale ? ' (stale)' : ''}`;

/* a node's vertical neighbours: evidence before pillars, high rank first, two per layer */
function vertical(K, id, perLayer = 2, max = 8) {
  const me = K.byId.get(id); const out = []; const seen = new Set();
  const list = K.idx.nb(id).filter(x => x.v && K.byId.get(x.id).layer !== me.layer);
  for (const L of ORDER) {
    const here = list.filter(x => K.byId.get(x.id).layer === L && !seen.has(x.id))
      .sort((a, b) => (a.v - b.v) || ((K.byId.get(b.id).rank || 0) - (K.byId.get(a.id).rank || 0)));
    for (const x of here) { if (out.filter(o => o.n.layer === L).length >= perLayer) break; if (seen.has(x.id)) continue; seen.add(x.id); out.push({ ...x, n: K.byId.get(x.id) }); }
  }
  return out.slice(0, max);
}

async function ask(q, { n = 8, layers = null, budget = 900, json = false } = {}) {
  const K = await load();
  const r = await S.search(q, { n, layers, rank: id => (K.byId.get(id) || {}).rank || 0 });
  const hits = r.hits.map(h => K.byId.get(h.id)).filter(Boolean);
  if (json) return JSON.stringify({ routed: r.routed, meaning: r.meaning, hits: r.hits.map(h => ({ ...h, node: K.byId.get(h.id), vertical: K.byId.get(h.id) ? vertical(K, h.id).map(v => ({ id: v.id, rel: v.rel, title: v.n.title })) : [] })) }, null, 1);
  if (!hits.length) return `nothing for "${q}" — fewer or shorter words, or source lines: node ../../Planner_VRG_U100/tools/vrg-ctx.js q "${q}"`;
  const out = []; let used = 0;
  for (const h of hits) {
    const block = [short(h), h.brief ? '   ' + clip(h.brief, 160) : '', ...vertical(K, h.id).map(v => `   ↕ ${v.rel.padEnd(10)} ${short(v.n)}`)].filter(Boolean).join('\n');
    if (used + tok(block) > budget && out.length) { out.push(`… ${hits.length - out.length} more hits over the ${budget}-token budget (--budget)`); break; }
    out.push(block); used += tok(block);
  }
  const how = `${r.meaning ? 'words + meaning' : 'words'}${r.routed.length ? ', leaning to ' + r.routed.join('') : ''}`;
  return out.join('\n') + `\n(≈ ${used} tokens · ${how} · next: stack.js node <id>)`;
}

async function node(id, { all = false } = {}) {
  const K = await load();
  const n = K.byId.get(id); if (!n) return `no node ${id} — try: stack.js q "<words>"`;
  const lines = [`${n.id}  (${K.LNAME[n.layer]} · ${n.kind}${n.para ? ' · PARA ' + n.para : ''}${n.actor ? ' · ' + n.actor : ''})`, `  ${n.title}`];
  if (n.brief) lines.push(`  ${clip(n.brief, 300)}`);
  const meta = [n.state && 'state: ' + n.state, n.t && 'date: ' + n.t, n.path && 'path: ' + n.path, n.ent && n.ent.length && 'pillars: ' + n.ent.join(', '), n.com >= 0 && 'community: ' + n.com, n.stale && 'STALE: its source failed, this is the last good copy'].filter(Boolean);
  if (meta.length) lines.push('  ' + meta.join(' · '));
  const list = K.idx.nb(id).filter(x => K.byId.has(x.id));
  for (const L of ORDER) {
    const here = list.filter(x => K.byId.get(x.id).layer === L); if (!here.length) continue;
    const k = all ? here.length : L === n.layer ? 8 : 6;
    lines.push(`${L === n.layer ? '  ↔' : '  ↕'} ${K.LNAME[L]} (${here.length})`);
    for (const x of here.slice(0, k)) { const r = rel(x.rel); const verb = r ? (x.dir === '→' ? r.hu : r.back) : x.rel; lines.push(`     ${x.dir} ${verb.padEnd(22)} ${short(K.byId.get(x.id))}`); }
    if (here.length > k) lines.push(`     … ${here.length - k} more (--all)`);
  }
  return lines.join('\n');
}

async function chain(a, b, { time = false } = {}) {
  const K = await load();
  const c = G.shortest(K.idx, a, b, { time });
  if (!c) return K.byId.has(a) && K.byId.has(b) ? `no ${time ? 'time-respecting ' : ''}path` : 'unknown id';
  return c.map(({ id, via }, i) => { const r = via && rel(via.rel); const verb = via ? (r ? (via.dir === '→' ? r.hu : r.back) : via.rel) : ''; return `${i ? '  ' + via.dir + ' ' + verb.padEnd(22) : ''.padEnd(27)}${short(K.byId.get(id))}`; }).join('\n');
}

async function pillar(id) {
  const K = await load();
  const row = e => `${e.id.padEnd(13)} ${e.name.padEnd(34)} ${(e.thread ? '⟿ ' + e.thread : '').padEnd(14)} ${Object.entries(e.per).sort((a, b) => ORDER.indexOf(a[0]) - ORDER.indexOf(b[0])).map(([l, c]) => l + c).join(' ')}`;
  if (!id) {
    const areas = [...new Set([...(require('../entities').areas || []), ...K.g.entities.map(e => e.area || '')])].filter(a => K.g.entities.some(e => (e.area || '') === a));
    return areas.map(a => (a ? `## ${a}\n` : '') + K.g.entities.filter(e => (e.area || '') === a).map(row).join('\n')).join('\n')
      + `\n(${K.g.entities.length} pillars · ${K.g.entities.filter(e => e.thread).length} are Thread Board threads ⟿)`;
  }
  const e = K.g.entities.find(x => x.id === id.replace(/^E:/, '')); if (!e) return 'no pillar ' + id;
  const out = [`E:${e.id} ${e.name} — words: ${e.words.join(', ') || '—'} · paths: ${e.paths.join(', ') || '—'}${e.area ? ' · area: ' + e.area : ''}${e.thread ? ' · thread: ' + e.thread : ''}`];
  for (const L of ORDER) {
    const ms = e.members.map(m => K.byId.get(m)).filter(m => m && m.layer === L); if (!ms.length) continue;
    out.push(`${L} ${K.LNAME[L]} (${ms.length})`);
    for (const m of ms.sort((a, b) => (b.rank || 0) - (a.rank || 0)).slice(0, 10)) out.push('   ' + short(m));
    if (ms.length > 10) out.push(`   … ${ms.length - 10} more`);
  }
  return out.join('\n');
}

async function layer(code) {
  const K = await load();
  const m = K.g.layers.find(x => x.code === String(code || '').toUpperCase());
  if (!m) return 'layers: ' + K.g.layers.map(x => x.code).join(' ');
  return `${m.code} ${m.en} · ${m.hu}\n  is: ${m.is}\n  order: ${m.order}\n  nodes: ${m.nodes}\n  edges: ${m.edges}\n  source: ${m.source}\n  page: ${m.page.state} — ${m.page.name}${m.page.want ? '\n  wanted page: ' + m.page.want : ''}`;
}

/* a recorded session, step by step (the replay as text) */
async function session(sid8, { steps = 40 } = {}) {
  const idx = X.readJson(path.join(REC.DIR, 'index.json'), { sessions: {} });
  const id = Object.keys(idx.sessions).find(k => k.startsWith(String(sid8 || '')));
  if (!sid8 || !id) {
    const rows = Object.values(idx.sessions).sort((a, b) => (b.start || '').localeCompare(a.start || '')).slice(0, 15);
    return 'recorded sessions, newest first:\n' + rows.map(s => `  ${s.sid.slice(0, 8)} ${(s.start || '').slice(0, 16)} ${String(s.steps).padStart(4)} steps  ${clip(s.title, 60)}`).join('\n');
  }
  const s = idx.sessions[id]; const rec = REC.readRecording(id);
  const out = [`${id} ${s.title}`, `  ${s.project} · ${s.start.slice(0, 16)} → ${s.end.slice(11, 16)} · ${s.steps} steps · ${s.prompts} prompts · ${s.commits.length} commits · ${s.subagents} subagents`,
    `  tools: ${Object.entries(s.tools).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + v).join(', ')}`,
    `  touched most: ${s.touched.slice(0, 8).map(([n, c]) => `${n} ×${c}`).join(' · ')}`, ''];
  const pick = rec.length > steps ? rec.filter((x, i) => x.span !== 'chat' || i === 0).slice(0, steps) : rec;
  for (const st of pick) out.push(`  ${st.t.slice(11, 19)} ${st.actor === 'subagent' ? '  ↳' : ''}${st.span === 'execute_tool' ? st.tool : st.span}${st.ok === false ? ' ✗' : ''}  ${clip((st.paths || [])[0] || st.text || '', 70)}${st.nodes.length ? '  → ' + st.nodes.slice(0, 3).join(' ') : ''}`);
  if (pick.length < rec.length) out.push(`  … ${rec.length - pick.length} more steps (replay.html shows all)`);
  return out.join('\n');
}

/* Stack String (Füzér, STK-Q18): the seed's members on every layer, its reach mask and class.
   arg = an id, or words (the best pillar hit wins, then a Featured hit, then the first hit).
   --orphans: every code folder whose string reaches neither F nor I (nobody registered it). */
async function string(arg, { per = 3, orphans = false, json = false } = {}) {
  const K = await load();
  const ST = require('./strings');
  if (!K.strings) K.strings = ST.prepare(K.g.nodes, K.g.edges);
  const o = Object.assign({ today: String(K.g.generated || '').slice(0, 10) || undefined }, CFG.strings);
  if (orphans) {
    const list = K.g.nodes.filter(n => n.layer === 'C').map(n => ({ n, s: ST.string(K.strings, n.id, o) })).filter(x => x.s.cls === 'orphan');
    if (json) return JSON.stringify(list.map(x => ({ id: x.n.id, mask: x.s.mask, members: x.s.members.length, pulse: x.s.pulse })), null, 1);
    return `${list.length} code folders nobody registered (no F, no I on their string):\n` + list.map(x => `  ${x.s.mask}  ${short(x.n)}`).join('\n');
  }
  let id = String(arg || '').trim();
  if (!id) return 'stack.js string <id | words>   or   stack.js string --orphans';
  if (!/^[A-Z]:./.test(id) || !K.byId.has(id)) {
    const r = await S.search(id, { n: 8, rank: x => (K.byId.get(x) || {}).rank || 0 });
    const hits = r.hits.map(h => h.id).filter(x => K.byId.has(x));
    id = hits.find(x => x[0] === 'E') || hits.find(x => x[0] === 'F') || hits[0];
    if (!id) return `nothing for "${arg}" — try: stack.js q "<words>"`;
  }
  const s = ST.string(K.strings, id, o);
  if (json) return JSON.stringify(s, null, 1);
  const c = ST.CLASS[s.cls], seed = K.byId.get(id);
  const out = [`Füzér · ${short(seed)}`, `  reach  ${s.mask}   ${s.reach.length}/10   ${c.sign} ${c.en} · ${c.hu}${s.pulse ? '   pulse ' + s.pulse : ''}   ${s.members.length} members`];
  for (const L of ORDER) {
    const ms = s.members.filter(m => m.layer === L && m.id !== id); const p = s.profile[L]; if (!ms.length) continue;
    out.push(`  ${L} ${String(ms.length).padStart(4)}  ${ms.slice(0, per).map(m => `${m.id} ${clip(K.byId.get(m.id).title, 28)} ${m.score.toFixed(2)}`).join(' · ')}${p.newest ? '  ⟳' + p.newest : ''}`);
  }
  return out.join('\n') + `\n(score = best path product, depth ${o.depth}, cutoff ${o.cutoff}; next: stack.js node <id>)`;
}

const report = name => { try { return fs.readFileSync(path.join(CFG.out, name), 'utf8'); } catch { return `out/${name} not built yet — node stack.js build`; } };

module.exports = { load, readOnly, ask, node, chain, pillar, layer, session, string, report, short };
