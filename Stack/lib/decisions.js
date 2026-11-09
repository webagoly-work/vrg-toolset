// VRG Stack — Döntésnapló data for decisions.html, the Q layer's own page (decision inbox).
//
//   out/decisions-data.js   window.DECISIONS = { repo, files, q, nodes, nofile, counts, … }
//
// Where the data comes from (read-only):
//   · the Q layer as lib/layers.js decisions() parsed it: the set of decisions, their id, file, line and
//     state (answered / default A / open≈). The parser is loose (≈), so its state is shown as it is and
//     never "corrected" here; what this module adds is evidence a person can check (STK-P28).
//   · the decision files themselves, re-read here for what the stack clips: the question's whole block,
//     its options as written (A/B/C …, with the recommended one), the date nearest to it, other lines of
//     the same file that name it, and what the file itself says it blocks ("Blocks H2").
//   · `git blame` of each file in its own repo, as the last date fallback (STK-P29).
//   · the built graph's links of every Q node to the DevLog (lines, and sessions → their line), the
//     features (F) and the agentic layer (A): that is what a question blocks, and the open ones are
//     ranked by it (STK-P27). Links to the other layers are listed as mentions.
//   · the join's unresolved `q:` mentions: decision ids that no DECISIONS file holds (OMCT-Q…, REA-Q…,
//     MW-Q…, CH-Q…), grouped as "nincs fájlja" with every node that names them (STK-P33).
// Writes out/decisions-data.js only (fsx.writeAtomic). Runs as the optional stage `decisions`, or alone
// with `stack.js decisions` (then it re-reads the layers and the join itself, ≈ 2 s).
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const CFG = require('../config');
const X = require('./fsx');
const C = require('./common');
const META = require('./meta');

const LAYER_HU = Object.fromEntries(META.map(m => [m.code, m.hu])); LAYER_HU.E = 'Pillér';
const BLOCK_LAYERS = 'LFA';                         // what a question blocks
const MENTION_LAYERS = 'IQRUCG';                    // everything else that names it
const LINE_W = { active: 3, waiting: 3, recurring: 3, parked: 2, personal: 1, ended: 1, absorbed: 1 };
const A_W = k => /brief|codephrase \(live\)|agent$|house rules/.test(k || '') ? 2 : 1;
const DATE = /(?<![\w/.-])(20\d\d-\d\d-\d\d)(?![\w])/;
const winPath = p => p.replace(/\//g, '\\');
const absOf = rel => /^[A-Za-z]:/.test(rel) ? rel : C.REPO + '/' + rel;

/* ---- the id as a file may spell it: HUB-Q3 also as "HUB-Q03", "Q03", "Q-03"; KIT-L4 as "L-4" */
function idRegex(id, localOk) {
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let m;
  if ((m = /^KIT-L(\d+)$/.exec(id))) return new RegExp(`(?<![\\w-])(?:KIT-)?L-0*${m[1]}(?![\\w])`);
  if ((m = /^D-V/.exec(id))) return new RegExp(`(?<![\\w-])${esc(id)}(?![\\w])`);
  if ((m = /^(.+)-Q([A-Z]{0,2})(\d+)([a-z]?)$/.exec(id))) {
    const [, ns, pre, n, suf] = m;
    const tail = `Q-?${pre}0*${n}${suf}(?![\\w])`;
    return new RegExp(localOk ? `(?<![\\w-])(?:${esc(ns)}-)?${tail}` : `(?<![\\w-])${esc(ns)}-${tail}`);
  }
  return new RegExp(`(?<![\\w-])${esc(id)}(?![\\w])`);
}

/* ---- options as written: bullets "- **A** text", "- B text · C text", "**A (recommended)** — text",
        or inline on the question line "… A **300 mm** · B 250 · C 200". Kept verbatim (markdown included). */
function options(block, fileRecA) {
  const lines = block.split(/\r?\n/);
  const out = [];
  let cur = null;
  const LETTER = /^\**\(?([A-F])\)?\**(?:\s*\(([^)]{1,40})\))?\**\s*(?:[—–:.)-]\s*)?(\S[\s\S]*)$/;
  const push = (k, note, text, line, bold) => {
    const pieces = text.split(/\s+·\s+(?=\**[B-F]\**\s)/);
    const first = { k, text: pieces[0].trim(), bold, said: /recommend|ajánl|★/i.test(note || ''), note: note || '', line };
    out.push(first);
    for (const p of pieces.slice(1)) {
      const m = /^\**([B-F])\**\s+(.*)$/.exec(p); if (!m) { first.text += ' · ' + p; continue; }
      out.push({ k: m[1], text: m[2].trim(), bold: /^\*\*/.test(p), said: false, note: '', line });
    }
    cur = out[out.length - 1];
  };
  lines.forEach((raw, j) => {
    const b = /^\s*[-*+]\s+(.*)$/.exec(raw);
    if (b) {
      const m = LETTER.exec(b[1]);
      if (m && /^(\*\*)?\(?[A-F]\)?(\*\*|\s|\(|[—–:.)-])/.test(b[1])) { push(m[1], m[2], m[3], j, /^\*\*\(?[A-F]/.test(b[1])); return; }
      cur = null; return;
    }
    if (cur && /^\s{2,}\S/.test(raw)) { cur.text += ' ' + raw.trim(); return; }
    if (j === 0 && !out.length) {
      // inline: the first " A " (or "A **") that a later " · B " follows
      const s = raw.replace(/^[\s|>#*-]+/, '');
      const at = s.search(/(?:^|[\s.:*?])\**A\**\s+(?=\S)(?=.*\s·\s+\**B\**\s)/);
      if (at >= 0) {
        const tail = s.slice(at).replace(/^[\s.:*?]+/, (x) => x.includes('*') ? '**' : '');
        const m = /^(\*\*)?A(\*\*)?\s+([\s\S]+)$/.exec(tail.replace(/^\*\*A\*\*/, '**A**'));
        if (m) push('A', '', m[3], j, !!m[1] || /^\*\*/.test(m[3]));
      }
    }
    if (raw.trim() === '') cur = null;
  });
  // only a run that starts at A and steps one letter at a time is an option list
  const seq = []; for (const o of out) { const want = String.fromCharCode(65 + seq.length); if (o.k === want) seq.push(o); else if (o.k === 'A') { seq.length = 0; seq.push(o); } }
  if (seq.length < 2) return [];
  // recommended: what an option's own note says ("A (recommended)"), else the one bold letter
  // (when every letter is bold, boldness says nothing), else the file's "A = recommended"
  const said = seq.filter(o => o.said), bold = seq.filter(o => o.bold);
  for (const o of seq) o.rec = said.length ? o.said : bold.length && bold.length < seq.length ? o.bold : false;
  if (!seq.some(o => o.rec) && fileRecA) seq[0].rec = true;
  for (const o of seq) o.text = o.text.replace(/\s+$/, '');
  return seq;
}

/* ---- the last-changed date of every line, from git blame in the file's own repo (or null) */
function blame(abs) {
  try {
    const dir = path.dirname(abs);
    const raw = execFileSync('git', ['-C', dir, 'blame', '--line-porcelain', '--', path.basename(abs)], { encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'] });
    const out = []; let sha = '', t = 0;
    for (const l of raw.split('\n')) {
      if (/^[0-9a-f]{40} /.test(l)) sha = l.slice(0, 40);
      else if (l.startsWith('author-time ')) t = +l.slice(12);
      else if (l.startsWith('\t')) out.push(/^0{40}$/.test(sha) ? '' : new Date(t * 1000).toISOString().slice(0, 10));
    }
    return out;
  } catch { return null; }
}

const clean = s => s.replace(/^[\s|>#*+-]+/, '').replace(/\s*\|\s*$/, '').trim();

function build({ graph, q, nodes: inner }) {
  const byId = new Map(graph.nodes.map(n => [n.id, n]));
  const edgeRows = (graph.edges || []).map(e => Array.isArray(e) ? { a: e[0], b: e[1], rel: e[2], v: e[3] } : e);
  const qInner = new Map((q ? q.nodes : []).map(n => [n.id, n]));
  const Qpub = graph.nodes.filter(n => n.layer === 'Q');

  // session → its DevLog line
  const lineOf = new Map(); for (const e of edgeRows) if (e.rel === 'on-line') lineOf.set(e.a, e.b);

  // node table for every linked node
  const nodes = [], nodeIdx = new Map();
  const nIdx = id => {
    if (nodeIdx.has(id)) return nodeIdx.get(id);
    const n = byId.get(id); if (!n) return -1;
    const i = nodes.length; nodeIdx.set(id, i); nodes.push(null);
    const line = n.layer === 'L' && lineOf.has(id) ? nIdx(lineOf.get(id)) : -1;
    nodes[i] = [id, n.layer, n.kind || '', n.title === id.slice(2) ? '' : C.clip(n.title, 110), 'CG'.includes(n.layer) ? '' : (n.t || '').slice(0, 10), n.state || '', n.path || '', line];
    return i;
  };

  /* ---- files */
  const fileNodes = Qpub.filter(n => n.kind === 'decision-file');
  const files = [], fileIdx = new Map(), texts = new Map();
  for (const f of fileNodes) {
    const rel = f.path || (f.brief.match(/ in (.+)$/) || [])[1] || '';
    const abs = absOf(rel);
    let txt = ''; try { txt = fs.readFileSync(abs, 'utf8'); } catch { /* gone: the page says so */ }
    const lines = txt.split(/\r?\n/);
    const head = lines.slice(0, 14).join('\n');
    const recA = /\bA\s*(?:=|is)\s*(?:the\s+)?recommend|\bA recommended|A = recommended|A is recommended/i.test(head);
    const byDefault = /unanswered\s*=\s*\**A|every open question at its recommended/i.test(txt);
    let mtime = ''; try { mtime = fs.statSync(abs).mtime.toISOString().slice(0, 10); } catch {}
    const i = files.length; fileIdx.set(f.id, i);
    const inner_ = qInner.get(f.id);
    texts.set(i, { lines, blame: null, recA });
    files.push({ id: f.id, rel, abs: winPath(abs), inRepo: !/^[A-Za-z]:/.test(rel), title: f.title, ns: (inner_ && inner_.extra && inner_.extra.ns) || '', n: 0,
      readable: !!txt, byDefault, recA, mtime, lines: lines.length, counts: { answered: 0, 'default A': 0, 'open≈': 0 } });
  }
  const fileOfQ = new Map();
  for (const e of edgeRows) if (e.rel === 'holds' && fileIdx.has(e.a) && !fileOfQ.has(e.b)) fileOfQ.set(e.b, fileIdx.get(e.a));

  /* ---- links of each Q node */
  const qIds = new Set(Qpub.filter(n => n.kind === 'decision').map(n => n.id));
  const linksOf = new Map();
  for (const e of edgeRows) {
    if (e.rel === 'holds') continue;
    const ia = qIds.has(e.a), ib = qIds.has(e.b); if (!ia && !ib) continue;
    const me = ia ? e.a : e.b, other = ia ? e.b : e.a;
    if (other[0] === 'E' || other.startsWith('Q:file.')) continue;
    (linksOf.get(me) || linksOf.set(me, []).get(me)).push([other, e.rel, ia ? 1 : 0]);
  }

  /* ---- decisions */
  const NSORDER = s => s.replace(/(\d+)/g, d => d.padStart(4, '0'));
  // pass 1: every item's line (the parser's, checked; else the first line naming it), so blocks stop at the next item
  const items = Qpub.filter(n => n.kind === 'decision').map(n => {
    const id = n.id.slice(2);
    const fi = fileOfQ.has(n.id) ? fileOfQ.get(n.id) : -1;
    const F = fi >= 0 ? files[fi] : null, T = fi >= 0 ? texts.get(fi) : null;
    const inn = qInner.get(n.id);
    const rxFull = idRegex(id, false), rxLocal = idRegex(id, F && F.ns && id.startsWith(F.ns + '-'));
    let line = inn && inn.extra && inn.extra.line || 0;
    if (T && (!line || !rxLocal.test(T.lines[line - 1] || ''))) { const k = T.lines.findIndex(l => rxLocal.test(l)); line = k >= 0 ? k + 1 : 0; }
    return { n, id, fi, F, T, rxFull, rxLocal, line };
  });
  const startsOf = new Map(); for (const it of items) if (it.line) (startsOf.get(it.fi) || startsOf.set(it.fi, new Set()).get(it.fi)).add(it.line - 1);
  const qs = [];
  for (const it of items) {
    const { n, id, fi, F, T, rxFull, rxLocal } = it;
    let line = it.line, block = '', ctx = '', opts = [], date = '', dateSrc = '', also = [], fileBlocks = '', answer = '', question = n.title.replace(/^\S+\s+—\s+/, '');
    if (T && line) {
      const L = T.lines;
      // a row of an option table ("| L-1 | Proposal | A ★ | B | C |") is the question, even when the parser
      // first met the id in an answers table above it
      const cellsOf = l => l.split('|').slice(1, -1).map(x => x.trim());
      const headOf = k => { let j = k; while (j > 0 && /^\s*\|/.test(L[j - 1])) j--; return cellsOf(L[j]); };
      const optCols = hd => hd.map((c, i) => [i, /^([A-F])\b\s*(★)?/.exec(c)]).filter(x => x[1]);
      for (let k = 0; k < L.length; k++) if (/^\s*\|/.test(L[k]) && rxLocal.test(cellsOf(L[k])[0] || '') && optCols(headOf(k)).length >= 2) { line = k + 1; break; }
      const start = line - 1;
      // the item's block: up to the next item of this file, the next heading, a rule, or 60 lines
      const otherStarts = startsOf.get(fi) || new Set();
      const h0 = (/^(#{1,6})\s/.exec(L[start]) || [])[1];
      let end = start + 1;
      const isItemStart = k => { const s = L[k].replace(/^[\s|>#*\-]+/, ''); return /^(?:[A-Z][A-Z0-9]{0,11}(?:-[A-Z0-9]{1,8}){0,2}-Q-?\d|D-V\d|Q-?[A-Z]{0,2}\d{1,3}\b|L-\d{1,2}\b)/.test(s) && !rxLocal.test(L[k].replace(/^[\s|>#*\-]+/, '').slice(0, 24)); };
      while (end < L.length && end < start + 60) {
        const s = L[end];
        const h = /^(#{1,6})\s/.exec(s);
        if (h && (!h0 || h[1].length <= h0.length)) break;
        if (/^\s*(---|\*\*\*)\s*$/.test(s)) break;
        if (otherStarts.has(end) || isItemStart(end)) break;
        if (/^\|/.test(L[start]) && !/^\|/.test(s)) break;          // a table row ends with the table
        end++;
      }
      block = L.slice(start, end).join('\n').replace(/\s+$/, '');
      const isRow = /^\s*\|/.test(L[start]);
      const hd = isRow ? headOf(start) : [], oc = optCols(hd);
      if (isRow && oc.length >= 2) { const cells = cellsOf(L[start]); opts = oc.map(([i, m]) => ({ k: m[1], text: cells[i] || '', rec: !!m[2], note: '', line: 0 })).filter(o => o.text && !/^[—–-]$/.test(o.text)); }
      else opts = options(block, T.recA);
      const firstOpt = opts.length ? opts[0].line : end - start;
      ctx = C.clip(L.slice(start + 1, start + Math.max(1, firstOpt)).join(' ').replace(/\s+/g, ' ').trim(), 700);
      const first = L[start];
      if (isRow) {
        const cells = cellsOf(first);
        const qi = hd.findIndex(c => /question|kérdés|proposal|javaslat/i.test(c)), ai = hd.findIndex(c => /answer|válasz/i.test(c));
        question = clean(cells[qi >= 0 ? qi : 1] || question);
        if (ai >= 0) answer = cells.slice(ai).join(' · ');
        if (qi < 0 && ai === 1) question = n.title.replace(/^\S+\s+—\s+/, '');
      }
      else {
        question = clean(first).replace(/\*\*/g, '');
        question = question.replace(rxLocal, '').replace(/^[\s—–:.·()-]+/, '').trim() || n.title;
        if (opts.length && opts[0].line === 0) { const cut = question.search(/(?:^|[\s.:?])A\s+\S.*\s·\s+B\s/); if (cut > 0) question = question.slice(0, cut + 1).trim(); }
      }
      question = C.clip(question.replace(/\s*\*?\bBlocks?\s[^*]*\*/i, ' ').replace(/\s*[—–]+\s*\**\s*answered\b[\s\S]*$/i, '').replace(/\s*\**Answered:[\s\S]*$/, ''), 320);
      const fb = /\bBlocks?\s+([^*\n]+?)\.?\*/i.exec(block); if (fb) fileBlocks = fb[1].trim();
      if (!answer && n.state === 'answered') {
        const ev = block.split('\n').find(l => /answered|answer\b|válasz|=\s*\**[A-F]\b|\(\d{4}-\d\d-\d\d:\s*\**[A-F]|chose|decided|döntés/i.test(l));
        if (ev) answer = C.clip(clean(ev).replace(/\*\*/g, ''), 260);
      }
      // date: in the block, else the nearest heading above, else git blame of the line, else the file's time
      let m = DATE.exec(L[start]);
      if (m) { date = m[1]; dateSrc = 'sor'; }
      else {
        for (let k = start - 1; k >= 0; k--) if (/^#{1,4}\s/.test(L[k])) { const d = DATE.exec(L[k]); if (d) { date = d[1]; dateSrc = 'fejléc'; break; } }
        if (!date && (m = DATE.exec(block))) { date = m[1]; dateSrc = 'szöveg'; }
        if (!date) { if (T.blame === null) T.blame = blame(absOf(F.rel)) || []; if (T.blame[start]) { date = T.blame[start]; dateSrc = 'git blame'; } }
        if (!date && F.mtime) { date = F.mtime; dateSrc = 'fájl ideje'; }
      }
      // other lines of the same file that name it (an answers table, a later note)
      for (let k = 0; k < L.length && also.length < 6; k++) if ((k < start || k >= end) && (rxFull.test(L[k]) || (rxLocal !== rxFull && /^\s*\|/.test(L[k]) && rxLocal.test(L[k])))) also.push([k + 1, C.clip(L[k].trim(), 220)]);
    }
    // what it blocks (L lines with their sessions, F, A) and what else names it
    const blk = { L: new Map(), F: [], A: [] }, men = {};
    for (const [o, rel, out] of linksOf.get(n.id) || []) {
      const lay = o[0];
      if (lay === 'L') {
        const on = byId.get(o); if (!on) continue;
        const lineId = on.kind === 'session' ? lineOf.get(o) || '' : o;
        const k = lineId || o;
        const s = blk.L.get(k) || blk.L.set(k, { s: [], direct: false }).get(k);
        if (on.kind === 'session' && lineId) s.s.push(o); else s.direct = true;
      } else if (lay === 'F' || lay === 'A') { if (!blk[lay].includes(o)) blk[lay].push(o); }
      else if (MENTION_LAYERS.includes(lay)) (men[lay] || (men[lay] = new Set())).add(o);
      void rel; void out;
    }
    let score = 0;
    const L_ = [...blk.L].map(([k, v]) => { const on = byId.get(k); const w = on && on.kind === 'line' ? (LINE_W[on.state] || 2) : 1; score += w + v.s.length * 0.5; return [nIdx(k), v.s.map(nIdx).filter(x => x >= 0)]; }).filter(x => x[0] >= 0);
    score += blk.F.length * 3; for (const a of blk.A) score += A_W((byId.get(a) || {}).kind);
    if (fileBlocks) score += 1;
    const M = {}; for (const [lay, s] of Object.entries(men)) M[lay] = [...s].slice(0, 12).map(nIdx).filter(x => x >= 0).concat(s.size > 12 ? [-s.size] : []);
    const ns = id.startsWith('D-V') ? 'D-V' : id.startsWith('KIT-') ? 'KIT' : id.replace(/-Q[A-Z]{0,2}\d+[a-z]?$/, '');
    if (F) { F.n++; F.counts[n.state] = (F.counts[n.state] || 0) + 1; }
    qs.push({ id, ns, sort: NSORDER(id), f: fi, line, state: n.state, title: C.clip(n.title.replace(/^\S+\s+—\s+/, ''), 140), question, ctx, opts: opts.map(o => [o.k, o.text, o.rec ? 1 : 0, o.note]),
      answer, date, dateSrc, fileBlocks, also, blocks: { L: L_, F: blk.F.map(nIdx).filter(x => x >= 0), A: blk.A.map(nIdx).filter(x => x >= 0) }, men: M, score: +score.toFixed(1),
      block: block.length > 2400 ? block.slice(0, 2399) + '…' : block, stale: !!n.stale });
  }
  qs.sort((a, b) => a.sort.localeCompare(b.sort));

  /* ---- decisions with no file: the join's unresolved q: mentions */
  const have = new Set(qs.map(x => x.id));
  const seen = new Map();
  const scan = (id, text) => { for (const k of C.makeExtractor({ paths: new Set(), dirs: new Set(), basenames: new Map(), commits: new Set(), sessions: new Set(), memories: new Set() })(text)) if (k.startsWith('q:')) { const q_ = k.slice(2); if (!have.has(q_)) (seen.get(q_) || seen.set(q_, new Set()).get(q_)).add(id); } };
  if (inner) { for (const n of inner.values()) { if (n.layer === 'Q' || n.layer === 'E') continue; for (const k of n.ref || []) if (k.startsWith('q:') && !have.has(k.slice(2))) (seen.get(k.slice(2)) || seen.set(k.slice(2), new Set()).get(k.slice(2))).add(n.id); } }
  else for (const n of graph.nodes) if (n.layer !== 'Q' && n.layer !== 'E') scan(n.id, n.title + ' ' + n.brief);
  const docCache = new Map();
  const nofile = [...seen].map(([id, where]) => {
    const ns = id.replace(/-Q[A-Z]{0,2}\d+[a-z]?$/, '');
    const w = [...where].filter(x => byId.has(x));
    // the line in a document that asks it (the id at the start of a line), else the first line naming it;
    // documents first, then the agentic layer (memory, briefs), then the rest
    let at = null, any = null; const rx = idRegex(id, false);
    const def = new RegExp('^[\\s|>#*\\-]*(?:\\*\\*)?' + rx.source.replace(/^\(\?<!\[\\w-\]\)/, ''));
    const pri = x => 'GAFLRIUC'.indexOf(x[0]);
    for (const x of [...w].sort((a, b) => pri(a) - pri(b))) {
      const n = byId.get(x); const p = n.path || (x[0] === 'G' ? x.slice(2) : ''); if (!p || /^(sec|sig)\./.test(x.slice(2))) continue;
      const abs = absOf(p); if (!docCache.has(abs)) { let t = null; try { if (fs.statSync(abs).size < 4 << 20) t = fs.readFileSync(abs, 'utf8').split(/\r?\n/); } catch {} docCache.set(abs, t); }
      const L = docCache.get(abs); if (!L) continue;
      const d = L.findIndex(l => def.test(l)); if (d >= 0) { at = [winPath(abs), d + 1, C.clip(L[d].trim(), 220)]; break; }
      const k = L.findIndex(l => rx.test(l)); if (k >= 0 && !any) any = [winPath(abs), k + 1, C.clip(L[k].trim(), 220)];
    }
    at = at || any;
    const lay = {}; for (const x of w) lay[x[0]] = (lay[x[0]] || 0) + 1;
    return { id, ns, sort: NSORDER(id), n: w.length, lay, where: w.slice(0, 16).map(nIdx).filter(i => i >= 0), at };
  }).filter(x => x.n).sort((a, b) => a.sort.localeCompare(b.sort));

  const counts = { decisions: qs.length, files: files.length, unread: files.filter(f => !f.n).length, nofile: nofile.length };
  for (const s of ['answered', 'default A', 'open≈']) counts[s] = qs.filter(x => x.state === s).length;
  counts.blocking = qs.filter(x => x.state !== 'answered' && x.score > 0).length;
  return {
    about: 'VRG Stack — Döntésnapló data. Generated by Stack/lib/decisions.js on every stack build; never edit by hand.',
    generated: graph.generated || new Date().toISOString(),
    repo: winPath(C.REPO), node: winPath(C.FULL + '/tools/node/node.exe'), stack: winPath(C.REPO + '/Stack'), devlog: winPath(C.NOTES + '/devlog'),
    layers: LAYER_HU, mentionsFrom: inner ? 'join' : 'titles',
    shape: {
      q: 'id, ns, sort, f (file index), line, state, title, question, ctx, opts [[letter, text as written, recommended, note]], answer, date, dateSrc, fileBlocks, also [[line, text]], blocks {L: [[line node, [session nodes]]], F, A}, men {layer: [node … , -total when clipped]}, score, block',
      nodes: 'id, layer, kind, title ("" = the id is the title), date, state, path, line (node index of a session\'s DevLog line, -1)',
      nofile: 'id, ns, sort, n (nodes naming it), lay {layer: n}, where [node], at [abs path, line, text] | null',
    },
    files, q: qs, nodes, nofile, counts,
  };
}

/* stand-alone (stack.js decisions): the Q layer and the join's mentions are re-read, the graph comes from out/ */
function standalone() {
  const L = require('./layers');
  const { join } = require('./join');
  const facts = C.repoFacts();
  const ly = { F: L.featured(), I: L.ideas(), Q: L.decisions(facts), L: L.devlog(), A: L.agentic(facts), R: L.devrepo(), C: L.code(facts, new Map()), G: L.globe(facts) };
  const J = join(ly, facts);
  return { q: ly.Q, nodes: J.nodes };
}

function write({ graph, q, nodes } = {}) {
  const t0 = Date.now();
  const g = graph || JSON.parse(fs.readFileSync(path.join(CFG.out, 'stack.json'), 'utf8'));
  if (!q) { try { ({ q, nodes } = standalone()); } catch { q = null; nodes = null; } }
  const data = build({ graph: g, q, nodes });
  const body = '// generated by stack.js build (lib/decisions.js)\nwindow.DECISIONS = ' + JSON.stringify(data) + ';\n';
  X.writeAtomic(path.join(CFG.out, 'decisions-data.js'), body);
  const k = data.counts;
  return { data, msg: `decisions: ${k.decisions} in ${k.files} files (${k['open≈']} open≈, ${k['default A']} default A, ${k.answered} answered; ${k.blocking} unanswered ones block something), ${k.unread} files with none read, ${k.nofile} ids with no file · ${(Buffer.byteLength(body) / 1024).toFixed(0)} KB · ${Date.now() - t0} ms → out/decisions-data.js` };
}

module.exports = { build, write, options, idRegex };
