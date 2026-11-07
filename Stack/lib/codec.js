// VRG Stack — the Codec layer (Z): the stack folded so an agent reads less.
//
// Why not Huffman? Huffman coding makes BYTES smaller by giving frequent symbols short bit codes.
// A language model does not read bytes, it reads TOKENS, and a bit-packed (or base64) stream
// costs more tokens than the plain text and cannot be read without decoding. What carries over
// is the idea: frequent, long things get short codes. So the codec has two parts:
//
//  1. A codebook. Long strings that repeat (folder paths above all) get a short symbol §n,
//     the most frequent ones the shortest numbers — the Huffman rule applied to tokens.
//     A string only gets a code when the saving is larger than its codebook line.
//  2. Folding levels, so an agent loads only the depth it needs:
//       L0  one screen: layers, pages, pillars, how to ask             (always cheap)
//       L1  the pillars: per entity, its nodes on every layer          (to orient)
//       L2  one line per node, one file per layer, codebook applied    (to look up)
//       L3  a node card with all its links       → stack.js node <id>  (on demand)
//       L4  the source lines                     → vrg-ctx.js q / Read (only at the end)
//
// Token counts here are estimates (characters ÷ 4); a real tokenizer differs by ± 20 %.
'use strict';

const fs = require('fs');
const path = require('path');
const tok = s => Math.ceil(String(s).length / 4);
const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

const KIND = { // short kind codes for L2 lines
  feature: 'ft', app: 'app', program: 'prg', asset: 'ast', plan: 'pln', idea: 'ida', built: 'blt', document: 'doc', inferred: 'inf',
  dormant: 'dor', question: 'qst', 'decision-file': 'dfl', decision: 'dec', line: 'lin', session: 'ses', commit: 'cmt', merge: 'mrg',
  'session start': 'cms', module: 'mod', folder: 'dir', section: 'sec', agent: 'agt', brief: 'brf', 'agent tool': 'tol',
  'workflow kit': 'kit', 'scheduled task': 'sch', generator: 'gen', 'council doc': 'cdc', 'workflow doc': 'wfd',
  'house rules (CLAUDE.md)': 'hr', 'codephrase (live)': 'go', 'codephrase (archived)': 'go~', run: 'run', day: 'day', pillar: 'pil',
};
const kindCode = k => KIND[k] || (k.startsWith('memory/') ? 'm' + k[7] : k.startsWith('signal/') ? 's' + k[7] : k.slice(0, 3));

module.exports = function codec(graph, OUT) {
  const dir = path.join(OUT, 'codec');
  for (const f of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, f));
  const byId = new Map(graph.nodes.map(n => [n.id, n]));

  /* ---- L2 lines before coding */
  const lineOf = n => [n.id, kindCode(n.kind), n.t ? n.t.slice(2) : '', clip(n.state, 28), clip(n.title, 90), n.path && !n.id.includes(n.path) ? n.path : ''].join('|').replace(/\|+$/, '');
  const raw = {}; for (const n of graph.nodes) (raw[n.layer] = raw[n.layer] || []).push(lineOf(n));

  /* ---- the codebook: folder prefixes that repeat */
  const freq = new Map();
  const all = Object.values(raw).flat().join('\n');
  for (const m of all.matchAll(/(?:[A-Z]:\/)?[\w.\-]+(?:\/[\w.\-]+)+\//g)) {
    const seg = m[0].split('/').filter(Boolean);
    for (let i = 2; i <= seg.length; i++) { const p = seg.slice(0, i).join('/') + '/'; freq.set(p, (freq.get(p) || 0) + 1); }
  }
  // greedy: take the best saver, then recount, so nested prefixes do not double count
  const book = [];
  let text = all;
  for (let round = 0; round < 60; round++) {
    let best = null;
    for (const [s, _] of freq) {
      const f = text.split(s).length - 1; if (f < 3) continue;
      const code = '§' + (book.length + 1);
      const gain = f * (s.length - code.length) - (s.length + code.length + 4);
      if (gain > 40 && (!best || gain > best.gain)) best = { s, f, gain, code };
    }
    if (!best) break;
    book.push(best); text = text.split(best.s).join(best.code); freq.delete(best.s);
  }
  // Huffman rule on tokens: the most frequent string gets the shortest number
  book.sort((a, b) => b.f - a.f).forEach((b, i) => { b.code = '§' + (i + 1); });
  const apply = s => { for (const b of [...book].sort((x, y) => y.s.length - x.s.length)) s = s.split(b.s).join(b.code); return s; };
  const bookTxt = ['# VRG Stack codebook — §n stands for the folder prefix on its line. Kind codes after it.',
    ...book.map(b => `${b.code}=${b.s}`), '#kinds ' + Object.entries(KIND).map(([k, v]) => `${v}=${k}`).join(' ') + ' m?=memory/<type> s?=signal/<type>'].join('\n');
  fs.writeFileSync(path.join(dir, 'codebook.txt'), bookTxt);

  /* ---- L2: one file per layer */
  const packs = [];
  for (const m of graph.layers) {
    if (!raw[m.code]) continue;
    const body = [`# L2 ${m.code} ${m.en} · ${m.hu} — id|kind|yy-mm-dd|state|title|path   (codebook.txt; card: stack.js node <id>)`, ...raw[m.code].map(apply)].join('\n');
    fs.writeFileSync(path.join(dir, `L2-${m.code}.txt`), body);
    packs.push({ name: `L2-${m.code}.txt`, raw: tok(raw[m.code].join('\n')), packed: tok(body) });
  }

  /* ---- L1: the pillars */
  const top = (ids, l, k) => ids.map(i => byId.get(i)).filter(n => n.layer === l).sort((a, b) => (b.deg.v + b.deg.h) - (a.deg.v + a.deg.h)).slice(0, k);
  const L1 = ['# L1 VRG Stack — entity pillars: the same thing on every layer. Top nodes per layer by link count; full list: stack.js ent <id>.'];
  for (const e of graph.entities) {
    L1.push(`## ${e.id} · ${e.name}  (${Object.entries(e.per).map(([l, c]) => l + c).join(' ')})`);
    for (const m of graph.layers) {
      const ns = top(e.members, m.code, m.code === 'R' || m.code === 'L' ? 4 : 5); if (!ns.length) continue;
      L1.push(`${m.code}: ` + ns.map(n => `${n.id} ${clip(n.title, 46)}${n.state ? ' [' + clip(n.state, 18) + ']' : ''}`).join(' · '));
    }
  }
  const L1txt = apply(L1.join('\n'));
  fs.writeFileSync(path.join(dir, 'L1-pillars.txt'), L1txt);
  packs.push({ name: 'L1-pillars.txt', raw: tok(L1.join('\n')), packed: tok(L1txt) });

  /* ---- L0: one screen */
  const cnt = {}; for (const n of graph.nodes) cnt[n.layer] = (cnt[n.layer] || 0) + 1;
  const L0 = [
    '# L0 VRG Stack — read this first (one screen). Layers top → bottom; a node id is <layer>:<local id>.',
    ...graph.layers.map(m => `${m.code} ${m.en} · ${m.hu}: ${cnt[m.code] || packs.length + ' packs'} — ${clip(m.is, 110)} | page: ${m.page.state} ${clip(m.page.name, 50)}`),
    'Pillars (same thing across layers): ' + graph.entities.map(e => e.id).join(' '),
    'Ask, cheapest first:  stack.js q "<words>" [--layer L,A] [--budget 800]   →   stack.js node <id>   →   stack.js path <id> <id>',
    '                      stack.js ent <pillar>   ·   stack.js session <sid8>   ·   stack.js health   ·   stack.js drift',
    'Also: MCP server mcp/server.js (tools stack_search, stack_node, stack_path …; resources stack://L0 …) · source lines: node ../../Planner_VRG_U100/tools/vrg-ctx.js q "<words>"',
    'Packs: codec/L1-pillars.txt (orient) · codec/L2-<layer>.txt (look up; §n = codebook.txt). Never load stack.json whole.',
  ].join('\n');
  fs.writeFileSync(path.join(dir, 'L0.txt'), L0);
  packs.unshift({ name: 'L0.txt', raw: tok(L0), packed: tok(L0) });

  const full = tok(JSON.stringify(graph));
  const report = [
    `| Pack | Tokens before codebook | Tokens packed |`, `|---|---|---|`,
    ...packs.map(p => `| ${p.name} | ${p.raw} | ${p.packed} |`),
    `| codebook.txt (${book.length} codes) | — | ${tok(bookTxt)} |`,
    ``, `stack.json whole: ≈ ${full} tokens. L0 + L1 orient an agent in ≈ ${packs[0].packed + packs.find(p => p.name === 'L1-pillars.txt').packed} tokens (${(100 * (packs[0].packed + packs.find(p => p.name === 'L1-pillars.txt').packed) / full).toFixed(1)} % of the whole); all L2 packs together ≈ ${packs.filter(p => p.name.startsWith('L2')).reduce((s, p) => s + p.packed, 0)} tokens, saving ${packs.filter(p => p.name.startsWith('L2')).reduce((s, p) => s + p.raw - p.packed, 0)} through the codebook.`,
  ];
  return { packs, book, report };
};
