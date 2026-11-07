// VRG Stack — shared helpers: paths, text folding, and the key extractor.
//
// A KEY is the glue between layers. Every node carries
//   own: keys that say what the node IS      (its path, its commit, its session id …)
//   ref: keys the node's text MENTIONS        (a path in a brief, a hash in a reply …)
// The join (build.js) turns  ref(A) == own(B)  into a link A → B. When A and B sit on
// different layers that link is VERTICAL; on the same layer it is horizontal.
//
// Key kinds:  p:<path>  c:<commit7>  s:<session8>  m:<memory slug>  q:<decision id>
//             go:<NAME>  ln:<devlog line>  ft:<feature id>  ag:<agent>  br:<brief>
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const FULL = 'H:/VRG/Full';
const REPO = FULL + '/Planner_VRG_U100';
const NOTES = FULL + '/notes';
const MEMORY = 'C:/Users/webag/.claude/projects/H--/memory';
const CLAUDE_HOME = 'C:/Users/webag/.claude';

const read = p => fs.readFileSync(p, 'utf8');
const exists = p => { try { fs.accessSync(p); return true; } catch { return false; } };
const git = (...args) => execFileSync('git', ['-C', REPO, ...args], { encoding: 'utf8', maxBuffer: 256 << 20 });

/* Accent-free lower case: "vezetékcsatorna" and "vezetekcsatorna" are the same word. */
const fold = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const day = t => t ? String(t).slice(0, 10) : '';

/* Every path is stored with forward slashes. Inside the repo: relative ("Planner/src/x.js").
   Outside the repo: absolute from the drive ("H:/VRG/Full/notes/devlog"). */
function normPath(p) {
  p = String(p).replace(/\\/g, '/').replace(/\/+$/, '');
  if (/^h:\//i.test(p)) p = 'H:' + p.slice(2);
  // the -mirror and the old H:/Planner_VRG_U100 root are the same repo
  p = p.replace(/^H:\/VRG\/Backup\/code\/Planner_VRG_U100-mirror/i, REPO).replace(/^H:\/Planner_VRG_U100/i, REPO);
  if (p.toLowerCase().startsWith(REPO.toLowerCase() + '/')) return p.slice(REPO.length + 1);
  if (p.toLowerCase() === REPO.toLowerCase()) return '.';
  return p;
}

/* ---------------------------------------------------------------- the key extractor */
// It is built once with the sets of things that really exist, so it only ever returns keys
// that can resolve: a hex word is a commit only if the repo has that commit.
function makeExtractor(known) {
  const { paths, dirs, commits, sessions, memories, basenames } = known;
  // v2 fix: the drive needs its slash in the optional group ("H:\VRG\…", "C:/Users/…"); in v1
  // "H:" could never be followed by a word character, so absolute paths were never matched
  const RX_PATH = /(?:[A-Za-z]:[\/\\])?[\w.\-]+(?:[\/\\][\w.\-]+)+/g;
  const RX_HEX = /\b[0-9a-f]{7,40}\b/g;
  const RX_Q = /\b([A-Z][A-Z0-9]{0,11}(?:-[A-Z0-9]{1,8}){0,2})-Q-?(\d{1,3})([a-z]?)\b/g;
  const RX_GO = /\bGO[ -]([A-Z][A-Z0-9]{1,9})\b/g;
  const RX_MEM = /\[\[([a-z0-9\-]+)\]\]|\bmem:([a-z0-9\-]+)/g;
  const RX_BASE = /\b[\w\-]{3,}\.(?:md|js|html|json|cmd|ps1|kt|ino|py|css|mjs|cjs)\b/g;

  /* The deepest existing path that is a prefix of p ("Planner/src/x.js:42" → "Planner/src/x.js"). */
  function resolvePath(raw) {
    // cut a ":42" or "#anchor" tail, but never the drive colon (a regex here backtracked onto
    // "H:" and turned every absolute path into "H")
    let p = normPath(raw);
    const drive = /^[A-Z]:\//.test(p) ? p.slice(0, 2) : '';
    p = (drive + p.slice(drive.length).replace(/[:#].*$/, '')).replace(/[.,;)]+$/, '');
    // "notes/devlog/x.js" or "Varler_Workflow_Kit/…" are written relative to H:/VRG/Full
    if (!/^[A-Z]:\//.test(p) && !paths.has(p) && !dirs.has(p) && /^(notes|Varler_Workflow_Kit|tools|jobs|research|BRIDGE|_admin)\//.test(p)) {
      const top = p.split('/')[0];
      if (!dirs.has(top)) p = FULL + '/' + p;
    }
    for (let i = 0; i < 8 && p; i++) {
      if (paths.has(p) || dirs.has(p)) return p;
      const cut = p.lastIndexOf('/');
      if (cut <= 0) break;
      p = p.slice(0, cut);
    }
    return null;
  }

  return function extract(text) {
    const out = new Set();
    if (!text) return out;
    text = String(text);
    for (const m of text.matchAll(RX_PATH)) {
      const r = resolvePath(m[0]);
      if (r && r !== '.' && r.includes('/') || (r && dirs.has(r) && r.length > 3)) out.add('p:' + r);
    }
    for (const m of text.matchAll(RX_BASE)) {
      const hit = basenames.get(m[0]);
      if (hit) out.add('p:' + hit);
    }
    for (const m of text.matchAll(RX_HEX)) {
      const h = m[0];
      if (!/[a-f]/.test(h) || !/\d/.test(h)) continue;
      if (commits.has(h.slice(0, 7))) out.add('c:' + h.slice(0, 7));
      if (h.length >= 8 && sessions.has(h.slice(0, 8))) out.add('s:' + h.slice(0, 8));
    }
    for (const m of text.matchAll(RX_Q)) out.add('q:' + qid(m[1], m[2], m[3]));
    for (const m of text.matchAll(/\bD-V(\d+[a-z]?)-(\d+[a-z]?)\b/g)) out.add(`q:D-V${m[1]}-${m[2]}`);
    for (const m of text.matchAll(RX_GO)) out.add('go:' + m[1]);
    for (const m of text.matchAll(RX_MEM)) { const s = m[1] || m[2]; if (memories.has(s)) out.add('m:' + s); }
    return out;
  };
}

/* One spelling for a decision id: HUB-Q01 → HUB-Q1, ADATRETEG-Q-002 → ADATRETEG-Q2. */
const qid = (ns, n, suf) => `${ns}-Q${parseInt(n, 10)}${suf || ''}`;

/* What the repo really holds — used by the extractor and by the Code + Globe layers. */
function repoFacts() {
  const files = git('ls-files').split('\n').filter(Boolean);
  const paths = new Set(files);
  const dirs = new Set();
  for (const f of files) { const parts = f.split('/'); for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join('/')); }
  const count = new Map();
  for (const f of files) { const b = f.split('/').pop(); count.set(b, (count.get(b) || 0) + 1); }
  const basenames = new Map();
  const generic = /^(README|CLAUDE|index|build|data|main|DECISIONS|serve|package|SKILL|notes|core|app)\./i;
  for (const f of files) { const b = f.split('/').pop(); if (count.get(b) === 1 && !generic.test(b)) basenames.set(b, f); }
  return { files, paths, dirs, basenames };
}

module.exports = { FULL, REPO, NOTES, MEMORY, CLAUDE_HOME, read, exists, git, fold, clip, day, normPath, makeExtractor, repoFacts, qid, path, fs };
