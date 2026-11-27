// VRG Stack — the lens: what a piece of work touches in the stack (Érintésnyom, STL-Q1 = B).
// Shared by Node (tests) and the browser (erintesnyom.html loads this file as a script), like activation.js.
//
//   const L = StackLens.create(stack, index)
//     stack   window.STACK (out/stack-data.js): nodes [{id, layer, kind, title, t, lane, tier, own, …}], edges [[a, b, rel, v]], layers
//     index   window.STACK_LENS (out/lens-index.js): { repo, aliases, basenames: {name: path} } (optional: without it only
//             explicit paths, ids and keys resolve)
//   L.resolve(paths, text, ctx) → [node ids]      the same keys and walk-up as lib/join.js resolveText, so a step lights
//                                                 what record.js would have recorded. ctx.cwd: a session's working folder,
//                                                 so "/home/user/vrg-toolset/Planner/x.js" lands like "Planner/x.js"
//   L.step(call) → { exact: [ids], text }          a tool call (name + input) of the event spine → its nodes
//   L.infer(text, exact) → Map id → score          INFERRED reach (STL-Q5 = B): title-word matches to F / I / L / A and the
//                                                 'alike' links of the exact nodes. Never mixed into exact: callers keep
//                                                 two maps, so the real lines can always be taken out on their own.
//   L.light(seeds, opts) → { exact: Map, inferred: Map }   spreading activation over the exact links only (lib/activation.js),
//                                                 plus one hop over 'alike' links into the inferred map
//   L.layout() → { planes, entities }             the kit layerstack's data: one plane per layer in its natural order,
//                                                 one entity per node, one per pillar (its line through the planes)
//   L.forecast(text, history, opts) → { map, why, keys, sessions }   SL3 (STL-Q7 = A): what a prompt, a GO phrase or a prompt
//                                                 template will probably touch, before it runs. Three sources, each named in
//                                                 `why` (id → ['key' | 'history:<sid8>' | 'words']): the keys the text names and
//                                                 their exact reach; what past sessions with a similar opening prompt touched
//                                                 (history = window.STACK_FORECAST, out/forecast-index.js); title words.
//   L.reach(id, opts) → Map id → energy           a node's blast radius: how far it reaches over the exact links (3 hops)
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./activation'));
  else root.StackLens = factory(root.StackActivation);
})(typeof self !== 'undefined' ? self : this, function (Activation) {
  'use strict';

  // the extractor's patterns (lib/common.js makeExtractor), kept in step by test/lens.test.js
  const RX_PATH = /(?:[A-Za-z]:[\/\\])?[\w.\-]+(?:[\/\\][\w.\-]+)+/g;
  const RX_HEX = /\b[0-9a-f]{7,40}\b/g;
  const RX_Q = /\b([A-Z][A-Z0-9]{0,11}(?:-[A-Z0-9]{1,8}){0,2})-Q-?(\d{1,3})([a-z]?)\b/g;
  const RX_DV = /\bD-V(\d+[a-z]?)-(\d+[a-z]?)\b/g;
  const RX_GO = /\bGO[ -]([A-Z][A-Z0-9]{1,9})\b/g;
  const RX_MEM = /\[\[([a-z0-9\-]+)\]\]|\bmem:([a-z0-9\-]+)/g;
  const RX_BASE = /\b[\w\-]{3,}\.(?:md|js|html|json|cmd|ps1|kt|ino|py|css|mjs|cjs)\b/g;
  const RX_SK = /\bsk:([A-Za-z0-9][\w.\-]*(?::[\w.\-]+)?)/g;
  const qid = (ns, n, suf) => `${ns}-Q${parseInt(n, 10)}${suf || ''}`;
  const fold = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const STOP = new Set(('the and for with from into its his her our you are not but all one two new old via per vrg varler round line map page app tool ' +
    'this that what when where which will would could should have has had been about make made also only just then than them they there here ' +
    'egy az a es is de hogy nem van vagy meg mar mint ami ezt azt kell lesz volt csak most igen').split(' '));
  const PLANES = ['F', 'M', 'N', 'K', 'I', 'T', 'Q', 'L', 'A', 'U', 'P', 'R', 'C', 'G', 'J'];   // top to bottom, as the ◢ dial lists them (D-48); T since S3
  const NAME = { F: 'Kirakat', I: 'Ötletfa', Q: 'Döntések', L: 'Fejlesztési vonalak', A: 'Ügynöki gerinc', U: 'Futás', R: 'Repó', C: 'Kód', G: 'Adatgömb' };

  function create(stack, index) {
    index = index || {};
    const nodes = new Map(stack.nodes.map(n => [n.id, n]));
    const own = new Map();
    for (const n of stack.nodes) for (const k of n.own || []) { if (!own.has(k)) own.set(k, []); own.get(k).push(n.id); }
    const edges = (stack.edges || []).map(e => Array.isArray(e) ? { a: e[0], b: e[1], rel: e[2], v: e[3] } : e);
    const adj = new Map(), alike = new Map(), pillarOf = new Map();
    const add = (m, a, b) => { if (!m.has(a)) m.set(a, []); m.get(a).push(b); };
    for (const e of edges) {
      if (!nodes.has(e.a) || !nodes.has(e.b)) continue;
      if (e.rel === 'pillar' || e.v === 2) { add(pillarOf, e.a, e.b); continue; }
      if (e.rel === 'alike') { add(alike, e.a, e.b); add(alike, e.b, e.a); continue; }
      add(adj, e.a, e.b); add(adj, e.b, e.a);
    }
    const repo = String(index.repo || 'H:/VRG/Full/Planner_VRG_U100');
    const aliases = [repo].concat(index.aliases || []).map(r => r.replace(/\\/g, '/').replace(/\/+$/, ''));
    const full = String(index.full || repo.replace(/\/[^/]+$/, ''));
    const basenames = index.basenames || {};

    /* lib/common.js normPath, plus the session's own working folder as one more name for the repo */
    function normPath(p, cwd) {
      p = String(p).replace(/\\/g, '/').replace(/\/+$/, '');
      if (/^[a-z]:\//.test(p)) p = p[0].toUpperCase() + p.slice(1);
      const roots = cwd ? aliases.concat(String(cwd).replace(/\\/g, '/').replace(/\/+$/, '')) : aliases;
      for (const r of roots) {
        if (p.toLowerCase() === r.toLowerCase()) return '.';
        if (p.toLowerCase().startsWith(r.toLowerCase() + '/')) return p.slice(r.length + 1);
      }
      return p;
    }
    /* lib/join.js resolve('p:…'): the key itself, else the deepest prefix a node owns */
    function walk(p) {
      p = p.replace(/[:#].*$/, '').replace(/[.,;)]+$/, '');
      if (/^[A-Z]$/.test(p)) return [];
      if (own.has('p:' + p)) return own.get('p:' + p);
      // "notes/…", "jobs/…" are written relative to H:/VRG/Full (common.js resolvePath)
      if (!own.has('p:' + p.split('/')[0]) && /^(notes|Varler_Workflow_Kit|tools|jobs|research|BRIDGE|_admin)\//.test(p)) {
        const hit = walk(full + '/' + p); if (hit.length) return hit;
      }
      let q = p;
      for (let i = 0; i < 12 && q.includes('/'); i++) {
        q = q.slice(0, q.lastIndexOf('/'));
        if (own.has('p:' + q)) return own.get('p:' + q);
      }
      return [];
    }
    function keysOf(text, cwd, out) {
      text = String(text || '');
      for (const m of text.matchAll(RX_PATH)) { const p = normPath(m[0], cwd); if (p.includes('/')) for (const id of walk(p)) out.add(id); }
      for (const m of text.matchAll(RX_BASE)) { const hit = basenames[m[0]]; if (hit) for (const id of walk(hit)) out.add(id); }
      for (const m of text.matchAll(RX_HEX)) {
        const h = m[0]; if (!/[a-f]/.test(h) || !/\d/.test(h)) continue;
        for (const k of ['c:' + h.slice(0, 7), h.length >= 8 ? 's:' + h.slice(0, 8) : '']) if (k && own.has(k)) own.get(k).forEach(id => out.add(id));
      }
      const key = k => { if (own.has(k)) own.get(k).forEach(id => out.add(id)); };
      for (const m of text.matchAll(RX_Q)) key('q:' + qid(m[1], m[2], m[3]));
      for (const m of text.matchAll(RX_DV)) key(`q:D-V${m[1]}-${m[2]}`);
      for (const m of text.matchAll(RX_GO)) key('go:' + m[1]);
      for (const m of text.matchAll(RX_MEM)) key('m:' + (m[1] || m[2]));
      for (const m of text.matchAll(RX_SK)) { key('sk:' + m[1]); if (m[1].includes(':')) key('sk:' + m[1].split(':').pop()); }
    }
    function resolve(paths, text, ctx) {
      const out = new Set(), cwd = ctx && ctx.cwd;
      for (const p of paths || []) for (const id of walk(normPath(p, cwd))) out.add(id);
      keysOf(text, cwd, out);
      return [...out];
    }

    /* lib/record.js toolPaths + toolText, for a call of the event spine ({name, input}) */
    function step(call, ctx) {
      const input = call.input || {}, paths = [];
      for (const k of ['file_path', 'path', 'notebook_path']) if (typeof input[k] === 'string') paths.push(input[k]);
      if (Array.isArray(input.file_paths)) paths.push(...input.file_paths.filter(x => typeof x === 'string'));
      if (Array.isArray(input.files)) paths.push(...input.files.filter(x => typeof x === 'string'));
      // an agent by name lands on its file in A (.claude/agents/<name>.md)
      if ((call.name === 'Agent' || call.name === 'Task') && /^[a-z][\w-]*$/.test(input.subagent_type || '') && input.subagent_type !== 'general-purpose') paths.push('.claude/agents/' + input.subagent_type + '.md');
      const agent = call.name === 'Agent' || call.name === 'Task';
      const text = agent ? [input.description, input.prompt].filter(x => typeof x === 'string').join(' ')
        : [input.command, input.pattern, input.query, input.description, input.url, typeof input.skill === 'string' ? 'sk:' + input.skill : null].filter(x => typeof x === 'string').join(' ');
      return { exact: resolve(paths, text, ctx), text };
    }

    /* inferred reach: the best title-word matches (lib/join.js 'alike' rule) in F / I / L / A, no other layer */
    const words = s => new Set(fold(s).split(/[^a-z0-9]+/).filter(w => w.length >= 4 && !STOP.has(w)));
    const AGENTIC = ['brief', 'agent', 'codephrase (live)', 'memory/project'];
    const pool = stack.nodes.filter(n => ['F', 'I', 'L', 'A'].includes(n.layer) && !['session', 'commit', 'memory/feedback'].includes(n.kind) && !(n.layer === 'A' && !AGENTIC.includes(n.kind)))
      .map(n => ({ id: n.id, w: words(n.title) })).filter(x => x.w.size);
    function infer(text, exact) {
      const out = new Map(), skip = new Set(exact || []);
      const wa = words(text);
      if (wa.size >= 2) {
        const hits = [];
        for (const b of pool) {
          let inter = 0; for (const w of b.w) if (wa.has(w)) inter++;
          if (inter < 2) continue;
          const s = 2 * inter / (Math.min(wa.size, 24) + b.w.size);
          if (s >= 0.35) hits.push([b.id, s]);
        }
        hits.sort((a, b) => b[1] - a[1]).slice(0, 4).forEach(([id, s]) => { if (!skip.has(id)) out.set(id, Math.min(1, s)); });
      }
      for (const id of exact || []) for (const y of alike.get(id) || []) if (!skip.has(y)) out.set(y, Math.max(out.get(y) || 0, 0.5));
      return out;
    }

    /* spreading activation over the exact links (never the alike ones), pillars lit by their lit members */
    function light(seeds, opts) {
      const o = Object.assign({ decay: 0.5, hops: 2, hubPenalty: 0.5 }, opts || {});
      const s = seeds instanceof Map ? seeds : new Map([...(seeds || [])].map(id => [id, 1]));
      const exact = Activation.spread(id => adj.get(id) || [], s, o);
      return { exact, inferred: new Map() };
    }
    function pillars(map) {
      const out = new Map();
      map.forEach((e, id) => { for (const p of pillarOf.get(id) || []) out.set(p, Math.max(out.get(p) || 0, e)); });
      return out;
    }

    /* ---- layout: each plane in its natural order (LAYERS.md §1 ①), in the kit's 0…100 plane units */
    function layout() {
      const byLayer = {};
      for (const n of stack.nodes) if (PLANES.includes(n.layer)) (byLayer[n.layer] = byLayer[n.layer] || []).push(n);
      const names = {}; (stack.layers || []).forEach(m => { if (m && m.code) names[m.code] = m.hu || m.en; });
      const at = new Map();
      const place = (n, x, y) => at.set(n.id, { x: Math.max(3, Math.min(97, x)), y: Math.max(4, Math.min(96, y)) });
      const time = n => Date.parse(n.t || '') || 0;
      // groups side by side, each as wide as its share, its members in a small grid
      function packed(list, groupOf, sortKey) {
        const groups = new Map();
        list.slice().sort((a, b) => String(sortKey(a)).localeCompare(String(sortKey(b)))).forEach(n => { const g = groupOf(n) || '·'; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(n); });
        const total = list.length || 1; let x0 = 2;
        [...groups.entries()].sort((a, b) => b[1].length - a[1].length).forEach(([, ns]) => {
          const w = 96 * ns.length / total, cols = Math.max(1, Math.round(Math.sqrt(ns.length * Math.max(0.3, w / 50)))), rows = Math.ceil(ns.length / cols);
          ns.forEach((n, i) => place(n, x0 + w * ((i % cols) + 0.5) / cols, 6 + 88 * (Math.floor(i / cols) + 0.5) / rows));
          x0 += w;
        });
      }
      // x = time, y = lane / line / branch
      function timed(list, laneOf) {
        const sorted = list.slice().sort((a, b) => time(a) - time(b));
        const lanes = [...new Set(sorted.map(n => laneOf(n) || '·'))];
        sorted.forEach((n, i) => {
          const li = lanes.indexOf(laneOf(n) || '·'), jitter = ((i * 37) % 11) / 11 - 0.5;
          place(n, 4 + 92 * (sorted.length > 1 ? i / (sorted.length - 1) : 0.5), 8 + 84 * ((li + 0.5 + jitter * 0.6) / Math.max(1, lanes.length)));
        });
      }
      const top = n => String(n.path || (n.own || []).find(k => k.startsWith('p:')) || n.title || '').replace(/^p:/, '').split('/')[0];
      for (const code of PLANES) {
        const list = byLayer[code] || [];
        if (code === 'F') packed(list, n => n.tier || n.lane, n => (n.lane || '') + n.title);
        else if (code === 'Q') packed(list, n => String(n.id).replace(/^Q:/, '').split(/-Q/)[0], n => n.id);
        else if (code === 'A') packed(list, n => n.kind, n => n.title);
        else if (code === 'C' || code === 'G') packed(list, top, n => n.path || n.title);
        else timed(list, n => n.lane || n.kind);
      }
      const planes = PLANES.filter(c => (byLayer[c] || []).length).map(c => ({ id: c, name: c + ' · ' + (names[c] || NAME[c]) }));
      const clip = (s, k) => { s = String(s || ''); return s.length > k ? s.slice(0, k - 1) + '…' : s; };
      const entities = [];
      for (const n of stack.nodes) if (at.has(n.id)) entities.push({ id: n.id, label: clip(n.title || n.id, 46), at: { [n.layer]: at.get(n.id) } });
      // a pillar is one entity on every plane where it has members, at their centre: the kit draws its line through them
      const members = new Map();
      pillarOf.forEach((ps, id) => { if (at.has(id)) for (const p of ps) { if (!members.has(p)) members.set(p, []); members.get(p).push(id); } });
      members.forEach((ids, p) => {
        const by = {};
        for (const id of ids) { const L = nodes.get(id).layer, q = at.get(id); (by[L] = by[L] || []).push(q); }
        const pat = {};
        Object.keys(by).forEach(L => { const qs = by[L]; pat[L] = { x: qs.reduce((s, q) => s + q.x, 0) / qs.length, y: qs.reduce((s, q) => s + q.y, 0) / qs.length }; });
        if (Object.keys(pat).length >= 2) entities.push({ id: p, label: clip((nodes.get(p) || {}).title || p, 40), at: pat, pillar: true });
      });
      return { planes, entities };
    }

    /* ---- SL3: forecast and blast radius */
    /* prompt likeness: six-letter stems (visualizer ~ visualization, réteg ~ rétegek), generic work words dropped, and
       overlap more than Dice, because a new prompt is long and a recorded title is its first 90 characters */
    const GENERIC = new Set('start build buildi next please show want like need some more much really still again first make letz kerem szeret legyen csinal'.split(' '));
    const stems = s => new Set([...words(s)].map(w => w.slice(0, 6)).filter(w => !GENERIC.has(w)));
    const likeness = (a, b) => { let i = 0; for (const w of b) if (a.has(w)) i++; return i < 2 ? 0 : 0.6 * i / Math.min(a.size, b.size) + 0.4 * i / Math.sqrt(a.size * b.size); };
    function forecast(text, history, opts) {
      const o = Object.assign({ sessions: 5, minSim: 0.2 }, opts || {});
      const map = new Map(), why = new Map();
      const note = (id, sc, r) => {
        if (!nodes.has(id) || !(sc > 0)) return;
        map.set(id, Math.min(1, Math.max(map.get(id) || 0, sc)));
        const w = why.get(id) || []; if (!w.includes(r)) w.push(r); why.set(id, w);
      };
      // 1. the keys the text names (paths, ids, GO phrases …) and how far they reach over the exact links
      const keys = resolve([], text);
      if (keys.length) light(keys, { hops: 2 }).exact.forEach((e, id) => note(id, keys.includes(id) ? 1 : e * 0.8, 'key'));
      // 2. what sessions with a similar opening prompt touched, weighted by the likeness and how often they touched it
      const wa = stems(text), sims = [];
      for (const s of (history && history.sessions) || []) { const d = likeness(wa, stems(s.title)); if (d >= o.minSim) sims.push({ s, d }); }
      sims.sort((a, b) => b.d - a.d);
      const used = sims.slice(0, o.sessions);
      for (const { s, d } of used) {
        const max = Math.max(1, ...(s.touched || []).map(t => t[1]));
        for (const [id, c] of s.touched || []) note(id, d * (0.4 + 0.6 * c / max), 'history:' + s.sid);
      }
      // 3. title words (the inference of STL-Q5), weakest
      infer(text, keys).forEach((sc, id) => note(id, sc * 0.5, 'words'));
      return { map, why, keys, sessions: used.map(x => ({ sid: x.s.sid, title: x.s.title, sim: +x.d.toFixed(2) })) };
    }
    function reach(id, opts) {
      const o = Object.assign({ decay: 0.6, hops: 3, hubPenalty: 0.5, threshold: 0.03 }, opts || {});
      return Activation.spread(x => adj.get(x) || [], new Map([[id, 1]]), o);
    }

    return { resolve, step, infer, light, pillars, layout, forecast, reach, normPath, nodes, own };
  }

  return { create, PLANES };
});
