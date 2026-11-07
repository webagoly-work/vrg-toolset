// VRG Stack — Konnektóm (connectome) data for connectome.html.
//
// One neuron = one UNIT of bytes on disk (2 KB = a typical memory note or brief; CN-Q1 = A).
// A node becomes ceil(bytes / UNIT) neurons, at least 1. Where the bytes come from:
//   file node        the file(s) in its path / own "p:" keys
//   folder (C, A)    the folder's own text files (binaries such as PDF, KiCad, images skipped; CN-Q2 = A)
//   decision (Q)     its decisions file, shared between the file node and every decision in it
//   run (U)          its recording out/recordings/<sid8>.jsonl
//   anything else    the node's own JSON record
// Shells (brain layout): cortex = passive information, mid = DevLog lines + decisions,
// stem = active agentic processes (runs, sessions, commits, agents, tools, generators, kit).
// Firing comes from the recordings (step timestamps + the nodes each step touched) and the
// event log (what the last build added or changed). CN-Q4 = A.
//
// Read-only on the sources; writes out/connectome-data.js only.
'use strict';

const fs = require('fs');
const path = require('path');
const CFG = require('../config');

const UNIT = 2048;
const CAP = 1024;           // neurons per node, safety only (largest node today ≈ 400)
const FIRE_RUNS = 14;       // newest recorded runs replayed as firing
const FIRE_STEPS = 9000;    // steps kept across those runs
const BIN = /\.(pdf|png|jpe?g|gif|bmp|webp|ico|svgz|zip|7z|rar|gz|tgz|step|stp|stl|f3d|kicad_pcb|kicad_sch|kicad_pro|kicad_prl|kicad_sym|kicad_mod|lib|bin|hex|elf|exe|dll|so|dylib|woff2?|ttf|otf|eot|mp3|mp4|wav|ogg|mov|avi|xlsx?|docx?|pptx?|sqlite|db|wasm|psd|ai|dxf|dwg)$/i;

const STEM_A = new Set(['agent', 'agent tool', 'generator', 'scheduled task', 'workflow kit', 'house rules (CLAUDE.md)']);

function shellOf(n) {
  const L = n.layer;
  if (L === 'U' || L === 'R') return 'stem';
  if (L === 'L') return n.kind === 'session' ? 'stem' : 'mid';
  if (L === 'Q') return 'mid';
  if (L === 'A') return STEM_A.has(n.kind) ? 'stem' : 'cortex';
  return 'cortex';
}

// Brain parts by function (BR-Q1). Cortex lobes hold passive knowledge; the deeper parts hold the active work.
//   ctx-front  frontal lobe: planning, intent (ideas, plans, pillars, briefs, codephrases, council)
//   ctx-par    parietal / motor strip: doing (code)
//   ctx-temp   temporal lobe: memory and language (memory notes, documents)
//   ctx-occ    occipital lobe: what is on show (apps, features, assets, programs)
//   thal       thalamus: the relay every line of work passes through (DevLog lines)
//   hypo       hypothalamus: set points and rules (decisions, house rules, scheduled tasks)
//   sc / ic    midbrain colliculi: sc = seeing (Data Globe signals, day views), ic = hearing (the sessions, the conversations)
//   cereb      cerebellum: learned routines (agents, tools, generators, workflow kit)
//   pons       pons: the runs; medulla: commits and merges (the outgoing motor signal)
const CEREB_A = new Set(['agent', 'agent tool', 'generator', 'workflow kit']);
function regionOf(n) {
  const L = n.layer, k = n.kind || '';
  if (L === 'F') return k === 'plan' || k === 'idea' ? 'ctx-front' : 'ctx-occ';
  if (L === 'I' || L === 'E') return 'ctx-front';
  if (L === 'C') return 'ctx-par';
  if (L === 'G') return k.startsWith('signal') ? 'sc' : 'ctx-temp';
  if (L === 'A') return CEREB_A.has(k) ? 'cereb' : (k === 'scheduled task' || k.startsWith('house rules')) ? 'hypo' : k.startsWith('memory') ? 'ctx-temp' : 'ctx-front';
  if (L === 'L') return k === 'line' ? 'thal' : 'ic';
  if (L === 'Q') return 'hypo';
  if (L === 'R') return k === 'session start' ? 'ic' : 'medulla';
  if (L === 'U') return k === 'day' ? 'sc' : 'pons';
  return 'ctx-temp';
}
// Cortex hemispheres: whole communities go to one side, the heavier ones first to the lighter side, per lobe.
function hemispheres(nodes, reg, nn) {
  const hemi = new Int8Array(nodes.length), groups = new Map();
  nodes.forEach((n, i) => { if (!reg[i].startsWith('ctx')) return; const key = reg[i] + '|' + (n.com == null || n.com < 0 ? 'x' + i : n.com); const g = groups.get(key) || { r: reg[i], m: 0, ids: [] }; g.m += nn[i]; g.ids.push(i); groups.set(key, g); });
  const side = {};
  for (const g of [...groups.values()].sort((a, b) => b.m - a.m)) { const w = side[g.r] || (side[g.r] = [0, 0]), h = w[0] <= w[1] ? 0 : 1; w[h] += g.m; for (const i of g.ids) hemi[i] = h ? 1 : -1; }
  return hemi;
}

const neurons = (bytes, unit = UNIT, cap = CAP) => Math.min(cap, Math.max(1, Math.ceil(bytes / unit)));

function statSafe(p) { try { return fs.statSync(p); } catch { return null; } }

function resolver(roots) {
  return raw => {
    const p = String(raw).split(String.fromCharCode(92)).join('/').replace(/^"+/, '');
    if (!p) return null;
    for (const c of [p, ...roots.map(r => r + '/' + p)]) { const st = statSafe(c); if (st) return { file: c, st }; }
    return null;
  };
}

function dirText(d) {
  let b = 0;
  try { for (const f of fs.readdirSync(d)) { if (BIN.test(f)) continue; const st = statSafe(d + '/' + f); if (st && st.isFile()) b += st.size; } } catch {}
  return b;
}

function lines(file) { try { return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean); } catch { return []; } }

function build({ graph, recordingsDir, eventsFile, roots }) {
  const resolve = resolver(roots);
  const idx = new Map(graph.nodes.map((n, i) => [n.id, i]));

  /* ---- bytes per node */
  const fileOf = new Array(graph.nodes.length).fill(null);
  const bytes = graph.nodes.map((n, i) => {
    if (n.layer === 'U' && n.kind === 'run') {
      const st = statSafe(path.join(recordingsDir, n.id.split('.')[1] + '.jsonl'));
      if (st) return { b: st.size, src: 'recording' };
    }
    const keys = [...new Set([n.path, ...(n.own || []).filter(o => o.startsWith('p:')).map(o => o.slice(2))].filter(Boolean))];
    let b = 0, src = '';
    for (const k of keys) {
      const r = resolve(k); if (!r) continue;
      if (r.st.isFile()) { b += r.st.size; src = 'file'; fileOf[i] = r.file.toLowerCase(); }
      else { b += dirText(r.file); src = 'folder'; }
    }
    if (b) return { b, src };
    return { b: Buffer.byteLength(JSON.stringify(n)), src: 'record' };
  });
  // a decisions file is shared by its file node and every decision that points at it
  const share = new Map();
  graph.nodes.forEach((n, i) => { if (n.layer === 'Q' && fileOf[i]) share.set(fileOf[i], (share.get(fileOf[i]) || 0) + 1); });
  graph.nodes.forEach((n, i) => { if (n.layer === 'Q' && fileOf[i]) { const k = share.get(fileOf[i]); if (k > 1) { bytes[i].b = Math.ceil(bytes[i].b / k); bytes[i].src = 'shared file /' + k; } } });

  /* ---- last activity per node (recordings) + firing replay */
  const last = new Float64Array(graph.nodes.length);
  graph.nodes.forEach((n, i) => { const t = Date.parse(n.t || ''); if (t) last[i] = t; });
  const runs = [];
  let recFiles = [];
  try { recFiles = fs.readdirSync(recordingsDir).filter(f => f.endsWith('.jsonl')); } catch {}
  for (const f of recFiles) {
    const sid = f.slice(0, -6), run = idx.get('U:run.' + sid);
    const steps = [];
    let t1 = 0;
    for (const ln of lines(path.join(recordingsDir, f))) {
      let s; try { s = JSON.parse(ln); } catch { continue; }
      const t = Date.parse(s.t || ''); if (!t) continue;
      if (t > t1) t1 = t;
      const ns = (s.nodes || []).map(id => idx.get(id)).filter(x => x !== undefined);
      for (const x of ns) if (t > last[x]) last[x] = t;
      if (ns.length) steps.push([t, ns, s.ok === false ? 1 : 0]);
    }
    if (run !== undefined && t1 > last[run]) last[run] = t1;
    if (run !== undefined && steps.length) runs.push({ run, sid, t1, steps });
  }
  runs.sort((a, b) => b.t1 - a.t1);
  const fire = [];
  let kept = 0;
  for (const r of runs.slice(0, FIRE_RUNS)) {
    const st = r.steps.slice(-Math.max(0, Math.floor(FIRE_STEPS / FIRE_RUNS)));
    kept += st.length;
    fire.push({ run: r.run, sid: r.sid, t1: r.t1, steps: st.map(([t, ns, bad]) => [t, ns.slice(0, 6), bad]) });
  }

  /* ---- what the last build added or changed (event log) */
  const fresh = [];
  let lastBuild = '';
  const ev = lines(eventsFile);
  let start = -1;
  for (let i = ev.length - 1; i >= 0; i--) if (ev[i].includes('"op":"build"')) { start = i; break; }
  if (start >= 0) {
    try { lastBuild = JSON.parse(ev[start]).seen || ''; } catch {}
    const seenIds = new Set();
    for (const ln of ev.slice(start + 1)) {
      let e; try { e = JSON.parse(ln); } catch { continue; }
      if ((e.op === 'node+' || e.op === 'state') && idx.has(e.id) && !seenIds.has(e.id)) { seenIds.add(e.id); fresh.push([idx.get(e.id), e.op === 'node+' ? 1 : 0]); }
    }
  }

  /* ---- pathways (HO-Q1 = A: DevLog lines) */
  const pw = pathways(graph, idx);

  /* ---- pack */
  const reg = graph.nodes.map(regionOf), hemi = hemispheres(graph.nodes, reg, graph.nodes.map((n, i) => neurons(bytes[i].b)));
  const nodes = graph.nodes.map((n, i) => {
    const b = bytes[i].b;
    return [n.id, n.layer, n.kind, String(n.title || '').slice(0, 120), shellOf(n), b, neurons(b), n.com == null ? -1 : n.com, last[i] || 0, bytes[i].src, pw.primary[i], pw.second[i], reg[i], hemi[i]];
  });
  // line mass + last activity, and bundles: edge counts between two lines' members
  const pwLines = pw.lines.map(l => ({ ...l, neurons: 0, members: 0, last: last[l.node] || 0 }));
  nodes.forEach((n, i) => { const p = pw.primary[i]; if (p >= 0) { pwLines[p].neurons += n[6]; pwLines[p].members++; if (last[i] > pwLines[p].last) pwLines[p].last = last[i]; } });
  const bund = new Map();
  for (const e of graph.edges) {
    const a = idx.get(e.a), b = idx.get(e.b); if (a === undefined || b === undefined) continue;
    const la = pw.primary[a], lb = pw.primary[b]; if (la < 0 || lb < 0 || la === lb) continue;
    const k = la < lb ? la + ',' + lb : lb + ',' + la; bund.set(k, (bund.get(k) || 0) + 1);
  }
  const bundles = [...bund].map(([k, c]) => [...k.split(',').map(Number), c]);
  const edges = [];
  for (const e of graph.edges) { const a = idx.get(e.a), b = idx.get(e.b); if (a !== undefined && b !== undefined && a !== b) edges.push(a, b, e.v || 0); }
  const total = nodes.reduce((s, n) => s + n[6], 0);
  const capped = nodes.filter(n => Math.ceil(n[5] / UNIT) > CAP).length;
  return {
    about: 'VRG Stack connectome — generated by Stack/ (lib/connectome.js); never edit by hand.',
    generated: new Date().toISOString(), stackGenerated: graph.generated, lastBuild,
    unit: UNIT, cap: CAP, capped, neurons: total,
    layers: (graph.layers || []).map(l => ({ code: l.code, hu: l.hu, en: l.en })),
    cols: ['id', 'layer', 'kind', 'title', 'shell', 'bytes', 'neurons', 'com', 'last', 'src', 'line', 'line2', 'region', 'hemi'],
    nodes, edges, fire, fresh, lines: pwLines, lineLinks: pw.links, bundles,
    stats: { runs: runs.length, fireRuns: fire.length, fireSteps: kept },
  };
}

// Every node gets a primary DevLog line (and a second one when it is nearly as close), by score:
//   +4 linked to the line itself · +2 linked to a session on the line · +1 touched by a run of
//   such a session · +0.5 in a pillar the line belongs to. -1 = no line (the mantle / outer dust).
function pathways(graph, idx) {
  const lineIds = graph.nodes.filter(n => n.layer === 'L' && n.kind === 'line').map(n => n.id);
  const L = new Map(lineIds.map((id, k) => [id, k]));
  const sessLines = new Map(), runLines = new Map(), pillarLines = new Map();
  const add = (m, k, v) => { const s = m.get(k) || new Set(); s.add(v); m.set(k, s); };
  for (const e of graph.edges) {
    if (e.rel === 'on-line' && L.has(e.b)) add(sessLines, e.a, L.get(e.b));
    if (e.rel === 'pillar' && L.has(e.a)) add(pillarLines, e.b, L.get(e.a));
  }
  for (const e of graph.edges) if (e.rel === 'ran' && sessLines.has(e.b)) for (const l of sessLines.get(e.b)) add(runLines, e.a, l);
  const score = graph.nodes.map(() => new Map());
  const give = (i, l, v) => { if (i === undefined) return; score[i].set(l, (score[i].get(l) || 0) + v); };
  for (const e of graph.edges) {
    for (const [x, y] of [[e.a, e.b], [e.b, e.a]]) {
      const yi = idx.get(y);
      if (L.has(x)) give(yi, L.get(x), 4);
      if (sessLines.has(x)) for (const l of sessLines.get(x)) give(yi, l, 2);
      if (runLines.has(x)) for (const l of runLines.get(x)) give(yi, l, 1);
      if (pillarLines.has(x) && e.rel === 'pillar') for (const l of pillarLines.get(x)) give(yi, l, 0.5);
    }
  }
  const primary = new Int16Array(graph.nodes.length).fill(-1), second = new Int16Array(graph.nodes.length).fill(-1);
  graph.nodes.forEach((n, i) => {
    if (L.has(n.id)) { primary[i] = L.get(n.id); return; }
    const s = [...score[i]].sort((a, b) => b[1] - a[1]);
    if (s[0]) primary[i] = s[0][0];
    if (s[1] && s[1][1] >= s[0][1] * 0.5) second[i] = s[1][0];
  });
  const lines = lineIds.map((id, k) => { const n = graph.nodes[idx.get(id)]; return { k, id, node: idx.get(id), title: String(n.title || '').slice(0, 90), state: n.state || '' }; });
  const links = graph.edges.filter(e => L.has(e.a) && L.has(e.b) && e.a !== e.b).map(e => [L.get(e.a), L.get(e.b), e.rel]);
  return { lines, primary: [...primary], second: [...second], links };
}

function write({ quiet = true } = {}) {
  const graph = JSON.parse(fs.readFileSync(path.join(CFG.out, 'stack.json'), 'utf8'));
  const data = build({
    graph,
    recordingsDir: path.join(CFG.out, 'recordings'),
    eventsFile: path.join(CFG.data, 'events.jsonl'),
    roots: [CFG.sources.repo, CFG.sources.full, CFG.sources.notes],
  });
  const out = path.join(CFG.out, 'connectome-data.js');
  const tmp = out + '.tmp';
  fs.writeFileSync(tmp, '// generated by stack.js connectome\nwindow.CONNECTOME = ' + JSON.stringify(data) + ';\n');
  fs.renameSync(tmp, out);
  // the axiom neurons with their addresses (neurons.js, research/NEURON-CODES.md): out/neurons.json for lookups and later engines
  const nn = neuronsOf(data);
  fs.writeFileSync(path.join(CFG.out, "neurons.json"), JSON.stringify({ about: "VRG Stack axiom neurons: address = gate letter + 5-char root (neurons.js)", generated: data.generated, unit: UNIT, gates: Object.fromEntries(Object.entries(NEURONS.GATES).map(([k, g]) => [k, g.name])), count: nn.length, neurons: nn.map(x => [x.addr, x.file, x.kb, x.j, x.w, x.kids]) }));
  const msg = `connectome: ${data.nodes.length} nodes → ${data.neurons} neurons (unit ${UNIT} B, ${data.capped} capped), ${data.edges.length / 3} edges, firing ${data.stats.fireRuns} runs / ${data.stats.fireSteps} steps, ${data.fresh.length} fresh`;
  if (!quiet) console.log(msg);
  return { ...data.stats, neurons: data.neurons, msg };
}

const NEURONS = require("../neurons.js");
function neuronsOf(data) {
  const C = data.cols.reduce((m, k, i) => (m[k] = i, m), {}), deg = new Array(data.nodes.length).fill(0);
  for (let k = 0; k < data.edges.length; k += 3) { deg[data.edges[k]]++; deg[data.edges[k + 1]]++; }
  const files = data.nodes.map((r, i) => ({ id: r[C.id], n: r[C.neurons], kind: r[C.kind], layer: r[C.layer], line: r[C.line], line2: r[C.line2], degree: deg[i], last: r[C.last], lineState: r[C.line] >= 0 ? (data.lines[r[C.line]] || {}).state : "" }));
  return NEURONS.build(files, data.unit);
}

module.exports = { neuronsOf, build, write, shellOf, regionOf, neurons, pathways, UNIT, CAP };
