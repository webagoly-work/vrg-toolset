// VRG Stack — what the build learns about itself, written as reports a person reads.
//
//   status()     STATUS.md: counts, and the four metrics next to their previous value (STK-Q14 = A)
//   patterns()   PATTERNS.md: how sessions move (tool flow, layer flow, frequent node paths)
//   proposals()  PROPOSALS.md: the propose-only helper (STK-Q13 = A, step 2). Every card has a
//                stable id; nothing is ever applied. Accept a card by doing it by hand.
'use strict';

const path = require('path');
const crypto = require('crypto');
const CFG = require('../config');
const X = require('./fsx');
const P = require('./patterns');
const { clip } = require('./common');

const METRICS_LOG = path.join(CFG.data, 'metrics.jsonl');
const BOOKKEEPING = /^(mcp:ccd_(turn|session|view|sidebar)\.|ToolSearch$|TodoWrite$|mcp:visualize\.read_me)/;
const pid = s => crypto.createHash('sha1').update(s).digest('hex').slice(0, 8);

function status(graph, metrics, codecReport, ms) {
  const prevAll = X.readJsonl(METRICS_LOG).records;
  const prev = prevAll.length ? prevAll[prevAll.length - 1] : null;
  X.appendJsonl(METRICS_LOG, [{ at: graph.generated, ...metrics }]);
  const d = (k, fmt = x => x) => { const now = metrics[k]; const was = prev ? prev[k] : undefined; if (was === undefined) return `${fmt(now)} | —`; const dv = now - was; return `${fmt(now)} | ${fmt(was)} (${dv >= 0 ? '+' : ''}${+dv.toFixed(3)})`; };
  const dm = k => { const now = metrics.modularity[k]; const was = prev && prev.modularity ? prev.modularity[k] : undefined; return `${now} | ${was === undefined ? '—' : was}`; };
  const byLayer = {}; for (const n of graph.nodes) byLayer[n.layer] = (byLayer[n.layer] || 0) + 1;
  const vert = {}; for (const n of graph.nodes) if (n.deg.v) vert[n.layer] = (vert[n.layer] || 0) + 1;
  const para = {}; for (const n of graph.nodes) para[n.para] = (para[n.para] || 0) + 1;
  return [
    `# VRG Stack — status`, ``, `Generated ${graph.generated.slice(0, 16).replace('T', ' ')} in ${(ms / 1000).toFixed(1)} s · schema ${CFG.schema}.`, ``,
    `| Layer | Name | Nodes | With a vertical link | Page |`, `|---|---|---|---|---|`,
    ...graph.layers.filter(m => byLayer[m.code]).map(m => `| ${m.code} | ${m.en} · ${m.hu} | ${byLayer[m.code]} | ${vert[m.code] || 0} (${Math.round(100 * (vert[m.code] || 0) / byLayer[m.code])} %) | ${m.page.state} — ${m.page.name} |`),
    ``, `**${graph.nodes.length} nodes, ${graph.edges.length} links (${graph.edges.filter(e => e.v === 1).length} vertical with evidence, ${graph.edges.filter(e => e.v === 2).length} pillar), ${graph.entities.length} pillars, ${metrics.communities} communities.**`, ``,
    `## The four metrics (pillar links left out)`, ``, `| Metric | Now | Previous build |`, `|---|---|---|`,
    `| Clustering coefficient | ${d('clustering')} |`,
    `| Average path length | ${d('pathAvg')} |`, `| Longest path found | ${d('pathLongest')} |`,
    `| Modularity by layer | ${dm('layer')} |`, `| Modularity by pillar | ${dm('pillar')} |`, `| Modularity by community | ${dm('community')} |`,
    `| Components | ${d('comps')} |`, `| Lone nodes | ${d('lone')} |`, ``,
    `Biggest hubs (degree): ${metrics.hubs.map(h => `\`${h.id}\` ${h.deg}`).join(' · ')}`, ``,
    `PARA: Projects ${para.P || 0} · Areas ${para.A || 0} · Resources ${para.R || 0} · Archives ${para.X || 0}`, ``,
    `## Codec`, ``, ...codecReport, ``,
  ].join('\n');
}

/* sequences from the recordings: tools, layers, nodes (first touch, hubs left out) */
function sequences(index, readRecording, isHub) {
  const tools = [], layers = [], nodes = [], sids = [];
  for (const sid8 of Object.keys(index.sessions)) {
    const steps = readRecording(sid8); if (steps.length < 3) continue;
    // the app's own bookkeeping (task list, wrap-up, tool loading) says nothing about the work
    tools.push(P.collapse(steps.filter(s => s.tool && !BOOKKEEPING.test(s.tool)).map(s => s.tool)));
    layers.push(P.collapse(steps.flatMap(s => s.nodes.slice(0, 1).map(id => id[0]))));
    const seen = new Set(); const ns = [];
    for (const s of steps) for (const id of s.nodes) if (!seen.has(id) && !isHub(id)) { seen.add(id); ns.push(id); }
    nodes.push(ns.slice(0, 80)); sids.push(sid8);
  }
  return { tools, layers, nodes, sids };
}

function patterns(seqs, title) {
  const tf = P.dfg(seqs.tools), lf = P.dfg(seqs.layers);
  const paths = P.prefixSpan(seqs.nodes, CFG.patterns.minSupport, CFG.patterns.maxLen).filter(p => p.seq.length >= 2).slice(0, 30);
  const md = [
    `# VRG Stack — patterns in recorded sessions`, ``, `${seqs.tools.length} sessions with 3+ steps. Process mining in our own code (directly-follows graph + PrefixSpan).`, ``,
    `## Tool flow: what follows what (top 25)`, ``, ...tf.pairs.slice(0, 25).map(([k, c]) => `- ${k}: ${c}`), ``,
    `Sessions start with: ${tf.starts.slice(0, 6).map(([k, c]) => `${k} ${c}`).join(' · ')}`, ``,
    `## Layer flow: which layer the next step lands on (top 15)`, ``, ...lf.pairs.slice(0, 15).map(([k, c]) => `- ${k}: ${c}`), ``,
    `## Frequent node paths (in ≥ ${CFG.patterns.minSupport} sessions, hubs left out)`, ``,
    ...paths.map(p => `- ${p.support} sessions: ${p.seq.map(id => `\`${id}\` ${clip(title(id), 40)}`).join(' → ')}`), ``,
  ].join('\n');
  return { md, json: { tools: tf, layers: lf, paths } };
}

function proposals(ctx) {
  const { graph, communities, pat, health } = ctx;
  const cards = [];
  const card = (kind, key, text, ids = []) => cards.push({ id: pid(kind + ':' + key), kind, text, ids, state: 'proposed' });
  // 1. pillar candidates: a community that crosses 3+ layers, that no pillar covers a quarter of,
  //    and whose own words are not already some pillar's words
  const known = new Set(graph.entities.flatMap(e => [e.id, ...e.words.map(w => w.split(' ')[0])]).map(w => require('./common').fold(w)));
  for (const c of communities) {
    if (c.size < 8 || c.layers.length < 3) continue;
    const topPillar = c.pillars[0];
    if (topPillar && topPillar[1] >= c.size / 4) continue;
    if (!c.words.length || c.words.some(w => known.has(w))) continue;
    card('pillar', c.words.join(' '), `New pillar? Community ${c.id} (${c.size} nodes on ${c.layers.join(' ')}) shares the words "${c.words.join(', ')}" and no pillar covers a quarter of it. Add it to entities.js if it is one real thing.`, c.top);
  }
  // 2. shortcuts from frequent paths
  for (const p of (pat ? pat.json.paths : []).filter(p => p.seq.length >= 3).slice(0, 8))
    card('shortcut', p.seq.join('>'), `Shortcut? ${p.support} sessions read ${p.seq.join(' → ')} in this order. A brief or an L1 codec line naming these together would save the walk.`, p.seq);
  // 3. floating nodes per layer
  const lonely = {}; for (const n of graph.nodes) if (!n.deg.v && n.layer !== 'E' && n.layer !== 'U') (lonely[n.layer] = lonely[n.layer] || []).push(n.id);
  for (const [l, ids] of Object.entries(lonely)) if (ids.length >= 3)
    card('float', l, `${ids.length} nodes on layer ${l} have no vertical link. Name a path, commit or memory slug in their source, or retire them.`, ids.slice(0, 12));
  // 4. health warnings that need a person
  for (const c of health.checks.filter(c => c.level !== 'ok' && ['freshness', 'volume', 'schema', 'retention'].includes(c.kind)))
    card('health', c.msg, `Health (${c.kind}): ${c.msg}`);
  const md = [`# VRG Stack — proposals (propose-only)`, ``, `Nothing here is applied. Each card has a stable id; do the change by hand, and the card disappears on the next build once it no longer applies.`, ``,
    ...cards.map(c => `- **${c.id}** · ${c.kind} · ${c.text}${c.ids.length ? `\n  ${c.ids.slice(0, 8).map(i => '`' + i + '`').join(' ')}` : ''}`), ``].join('\n');
  return { md, cards };
}

module.exports = { status, sequences, patterns, proposals };
