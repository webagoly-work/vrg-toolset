// VRG Stack — hybrid search: three ranked lists fused into one.
//
//   1. node words   BM25 over title · brief · body           (exact words, accents folded, prefixes)
//   2. chunk words  BM25 over heading chunks with context lines  (finds a section deep in a document)
//   3. meaning      bge-m3 cosine, when the vectors exist        (finds "árnyék" for "napfény")
// Reciprocal rank fusion: score = Σ 1 / (k + rank), k = 60. A node high in any list rises; one
// high in all three rises most. No list needs its scores calibrated against the others.
//
// Layer routing (the mixture-of-experts idea, without a model): a few cues in the question pick
// one or two likely layers ("commit" → R, "döntés" → Q, a 7-hex word → R …). Those layers get a
// boost, the others are not removed — a soft gate, so a wrong guess costs little.
'use strict';

const CFG = require('../config');
const { fold } = require('./common');
const STORE = require('./store');
const EMB = require('./embed');

const ROUTES = [
  [/\b[0-9a-f]{7,40}\b|\bcommit|\bpush|\bbranch|\bmerge/, ['R']],
  [/\b[a-z0-9]+-q-?\d|\bdont|\bdecision|\bkerdes|\bvalasz/, ['Q']],
  [/\bgo [a-z]|\bmemor|\bbrief|\bagent|\bclaude\.md|\bcodephrase|\bkodszo/, ['A']],
  [/\bsession|\bmunkamenet|\bvonal|\bline\b|\bdevlog/, ['L', 'U']],
  [/\bfutas|\btoken|\btool call|\beszkozhivas|\bfuttat/, ['U']],
  [/\botlet|\bidea\b|\blineage/, ['I']],
  [/\bfeature|\bfunkcio|\bapp\b|\bprogram|\bkirakat/, ['F']],
  [/[\w-]+\/[\w./-]+|\.(js|md|html|json)\b|\bfolder|\bmappa|\bmodul/, ['C', 'G']],
  [/\bdocument|\bdokumentum|\bsolomon|\bgomb|\bsignal|\bjelzes/, ['G']],
];
function route(q) {
  const f = fold(q); const hit = new Set();
  for (const [rx, ls] of ROUTES) if (rx.test(f)) ls.forEach(l => hit.add(l));
  return hit;
}

/* Hungarian ↔ English bridge for words the work uses in both languages (accent-free stems).
   Until the bge-m3 vectors exist this is what lets "Kapu döntések" find "Kapu — decisions". */
const BRIDGE = [
  ['dontes', 'decision'], ['kerdes', 'question'], ['valasz', 'answer'], ['otlet', 'idea'], ['munkamenet', 'session'],
  ['vonal', 'line'], ['reteg', 'layer'], ['oszlop', 'pillar'], ['funkcio', 'feature'], ['eszkoz', 'tool'], ['mappa', 'folder'],
  ['dokumentum', 'document'], ['terv', 'plan'], ['arnyek', 'shadow'], ['napfeny', 'sunlight'], ['homlokzat', 'facade'],
  ['kapcsolo', 'switch'], ['vezetek', 'cable'], ['csatorna', 'channel'], ['eloszto', 'distribution'], ['arajanlat', 'quote'],
  ['koltseg', 'cost'], ['ugynok', 'agent'], ['memoria', 'memory'], ['futas', 'run'], ['visszajatszas', 'replay'],
  ['keres', 'search'], ['kinezet', 'look'], ['szin', 'colour'], ['alaprajz', 'floor plan'], ['szoba', 'room'], ['emelet', 'floor'],
];
const SYN = new Map(); for (const [hu, en] of BRIDGE) { SYN.set(hu, en); SYN.set(en, hu); }
const alt = w => { for (const [k, v] of SYN) if (w.startsWith(k) && w.length - k.length <= 4) return v; return null; };
const group = w => { const a = alt(w); return a ? `("${w}"* OR ${a.split(' ').map(x => `"${x}"*`).join(' ')})` : `"${w}"*`; };

function ftsList(db, table, cols, q, n, layers) {
  const words = fold(q).split(/[^a-z0-9]+/).filter(w => w.length > 1);
  if (!words.length) return [];
  const and = words.map(group).join(' AND '), or = words.map(group).join(' OR ');
  const where = layers ? `AND layer IN (${layers.map(() => '?').join(',')})` : '';
  const sql = `SELECT id, bm25(${table}, ${cols}) AS s FROM ${table} WHERE ${table} MATCH ? ${where} ORDER BY s LIMIT ?`;
  const seen = new Set(); const out = [];
  for (const m of [and, or]) {
    if (out.length >= n) break;
    for (const r of db.prepare(sql).all(m, ...(layers || []), n * 3)) if (!seen.has(r.id)) { seen.add(r.id); out.push(r.id); if (out.length >= n) break; }
  }
  return out;
}

async function vectorList(db, q, n, layers) {
  const P = EMB.provider();
  if (!(await P.check()).ok) return { list: [], on: false };
  let rows; try { rows = db.prepare('SELECT id, vec FROM emb').all(); } catch { return { list: [], on: false }; }
  if (!rows.length) return { list: [], on: false };
  const [qv] = await P.embed([q]);
  const allow = layers ? new Set(layers) : null;
  const scored = [];
  for (const r of rows) { if (allow && !allow.has(r.id[0])) continue; scored.push([r.id, EMB.dot(qv, EMB.fromBlob(r.vec))]); }
  return { list: scored.sort((a, b) => b[1] - a[1]).slice(0, n).map(x => x[0]), on: true };
}

/* → { hits: [{ id, score, from: { node, chunk, vec } }], routed: [layers], meaning: bool } */
async function search(q, { n = 8, layers = null, meaning = true, rank = () => 0 } = {}) {
  const db = STORE.open();
  try {
    const depth = Math.max(30, n * 4);
    const lists = {
      node: ftsList(db, 'nodes', '0, 0, 6.0, 2.0, 0.6', q, depth, layers),
      chunk: ftsList(db, 'chunks', '0, 0, 3.0, 1.0', q, depth, layers),
    };
    let on = false;
    if (meaning) { const v = await vectorList(db, q, depth, layers); lists.vec = v.list; on = v.on; }
    const routed = route(q);
    const K = CFG.search.rrfK;
    const score = new Map(); const from = new Map();
    for (const [name, list] of Object.entries(lists)) list.forEach((id, i) => {
      score.set(id, (score.get(id) || 0) + 1 / (K + i + 1));
      (from.get(id) || from.set(id, {}).get(id))[name] = i + 1;
    });
    for (const [id, s] of score) if (routed.has(id[0])) score.set(id, s * 1.35);
    const hits = [...score.entries()].sort((a, b) => b[1] - a[1] || rank(b[0]) - rank(a[0])).slice(0, n)
      .map(([id, s]) => ({ id, score: +s.toFixed(4), from: from.get(id) }));
    return { hits, routed: [...routed], meaning: on };
  } finally { db.close(); }
}

/* the fusion alone, for tests */
function rrf(lists, k = CFG.search.rrfK) {
  const s = new Map();
  for (const list of lists) list.forEach((id, i) => s.set(id, (s.get(id) || 0) + 1 / (k + i + 1)));
  return [...s.entries()].sort((a, b) => b[1] - a[1]).map(x => x[0]);
}

module.exports = { search, route, rrf };
