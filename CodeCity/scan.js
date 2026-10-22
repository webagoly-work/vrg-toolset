#!/usr/bin/env node
// scan.js — read a git repository into city.json, the data behind VRG Kódváros.
//
//   node CodeCity/scan.js [repo=.] [--out file.city.json] [--html page.html] [--all]
//
// Two git calls: `git ls-files` for what exists now, and one `git log --numstat --summary -M`
// walked oldest -> newest. Renames are followed, so a file keeps ONE id through its whole life;
// the layout is computed over every id that ever existed, which is what keeps a building in
// place during the replay. Deleted files stay in the data as `gone` (ghosts).
// Binary files and files over 2 MB are left out unless --all.
'use strict';
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');

const argv = process.argv.slice(2);
const opt = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const flag = k => argv.includes(k);
const REPO = path.resolve(argv.find((a, i) => !a.startsWith('--') && !['--out', '--html'].includes(argv[i - 1])) || '.');
const ALL = flag('--all');
const MAX_BYTES = 2 * 1024 * 1024;

const git = (...a) => execFileSync('git', ['-c', 'core.quotepath=off', ...a], { cwd: REPO, maxBuffer: 1 << 30, encoding: 'utf8' });

// ---- languages: extension -> short name (the viewer owns the colours)
const LANG = {
  js: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript', jsx: 'JavaScript', ts: 'TypeScript', tsx: 'TypeScript',
  html: 'HTML', htm: 'HTML', css: 'CSS', scss: 'CSS', json: 'JSON', md: 'Markdown', txt: 'Text',
  py: 'Python', go: 'Go', rs: 'Rust', java: 'Java', kt: 'Kotlin', c: 'C', h: 'C', cpp: 'C++', hpp: 'C++', cc: 'C++',
  cs: 'C#', php: 'PHP', rb: 'Ruby', sh: 'Shell', cmd: 'Batch', bat: 'Batch', ps1: 'PowerShell',
  yaml: 'YAML', yml: 'YAML', toml: 'Config', ini: 'Config', xml: 'XML', svg: 'SVG', sql: 'SQL',
  ino: 'C++', vue: 'Vue', svelte: 'Svelte', dart: 'Dart', lua: 'Lua', csv: 'Data',
  stp: 'CAD', step: 'CAD', dxf: 'CAD', sxe: 'CAD', kicad_sch: 'CAD', kicad_pcb: 'CAD', kicad_sym: 'CAD', kicad_mod: 'CAD',
  kicad_pro: 'CAD', scad: 'CAD', stl: 'CAD',
};
const langOf = p => LANG[(path.extname(p).slice(1) || '').toLowerCase()] || 'Other';

// ---- agents: a commit is agent-assisted when its author or a Co-Authored-By trailer names one
const AGENTS = [['Claude', /claude|anthropic/i], ['Copilot', /copilot/i], ['Cursor', /cursor/i],
  ['Codex', /codex|openai/i], ['Gemini', /gemini/i], ['Devin', /devin/i], ['Aider', /aider/i]];
const agentOf = s => { for (const [n, re] of AGENTS) if (re.test(s)) return n; return null; };

// ---- now: tracked files and their line counts
const tracked = git('ls-files', '-z').split('\0').filter(Boolean);
const now = new Map(); // path -> loc
let skipped = 0;
for (const p of tracked) {
  let buf;
  try { const st = fs.statSync(path.join(REPO, p)); if (!st.isFile()) continue; if (st.size > MAX_BYTES && !ALL) { skipped++; continue; } buf = fs.readFileSync(path.join(REPO, p)); }
  catch { continue; } // listed but missing on disk (sparse checkout, deleted unstaged)
  const binary = buf.subarray(0, 8000).includes(0);
  if (binary && !ALL) { skipped++; continue; }
  let loc = 0; for (let i = 0; i < buf.length; i++) if (buf[i] === 10) loc++;
  if (buf.length && buf[buf.length - 1] !== 10) loc++;
  now.set(p, binary ? 0 : loc);
}

// ---- history
// numstat path forms: "a/b.js", "old.js => new.js", "dir/{old => new}/x.js", "dir/{ => sub}/x.js"
function renamePair(s) {
  const b = /^(.*)\{(.*) => (.*)\}(.*)$/.exec(s);
  if (b) { const j = (x) => (b[1] + x + b[4]).replace(/\/\//g, '/'); return [j(b[2]), j(b[3])]; }
  const p = s.split(' => '); return p.length === 2 ? p : null;
}
const RS = '\x1e', US = '\x1f', GS = '\x1d';
const log = git('log', '--reverse', '--no-merges', '-M', '--numstat', '--summary',
  `--format=${RS}%H${US}%at${US}%an${US}%s${US}%(trailers:key=Co-authored-by,valueonly=true,separator=${GS})${US}`);

const authors = [], authorIdx = new Map();
const commits = [];           // [time, author, agent(-1|idx), subject, hash7, changes[]]
const agentNames = [];
const files = [];             // id -> record
const idOf = new Map();       // current path -> id
function fileId(p) {
  let id = idOf.get(p);
  if (id === undefined) { id = files.length; idOf.set(p, id); files.push({ p, loc: 0, maxLoc: 0, born: commits.length - 1, last: -1, n: 0, gone: false, by: new Map(), ag: 0 }); }
  return id;
}

for (const chunk of log.split(RS)) {
  if (!chunk.trim()) continue;
  const [hash, at, an, subj, trailers, body = ''] = chunk.split(US);
  if (!authorIdx.has(an)) { authorIdx.set(an, authors.length); authors.push(an); }
  const agName = agentOf(an) || trailers.split(GS).map(agentOf).find(Boolean) || null;
  let ag = -1;
  if (agName) { ag = agentNames.indexOf(agName); if (ag < 0) { ag = agentNames.length; agentNames.push(agName); } }
  const ci = commits.length, changes = [];
  commits.push([+at, authorIdx.get(an), ag, subj.slice(0, 120), hash.slice(0, 7), changes]);

  const deleted = [];
  for (const line of body.split('\n')) {
    const del = /^ delete mode \d+ (.+)$/.exec(line);
    if (del) { deleted.push(del[1]); continue; }
    const m = /^(\d+|-)\t(\d+|-)\t(.+)$/.exec(line);
    if (!m) continue;
    const add = m[1] === '-' ? 0 : +m[1], rem = m[2] === '-' ? 0 : +m[2];
    let p = m[3];
    const rn = renamePair(p);
    if (rn) {
      const [from, to] = rn, id = idOf.has(from) ? idOf.get(from) : fileId(from);
      idOf.delete(from); idOf.set(to, id); files[id].p = to; p = to;
    }
    const id = fileId(p), f = files[id];
    f.loc = Math.max(0, f.loc + add - rem); f.maxLoc = Math.max(f.maxLoc, f.loc);
    f.last = ci; f.n++; if (ag >= 0) f.ag++;
    const a = authorIdx.get(an); f.by.set(a, (f.by.get(a) || 0) + add + rem);
    changes.push(id, add, rem);
  }
  for (const p of deleted) { const id = idOf.get(p); if (id !== undefined) { files[id].gone = true; files[id].goneAt = ci; idOf.delete(p); } }
}

// ---- reconcile with what is on disk now (true LOC wins over the numstat running sum)
for (const [p, loc] of now) {
  const f = files[fileId(p)];
  f.gone = false; delete f.goneAt; f.loc = loc; f.maxLoc = Math.max(f.maxLoc, loc);
  if (f.born < 0) f.born = 0;
}
// history-only files that were binary/huge (never in `now`, never deleted) are not drawable
const keep = files.map((f, i) => f.gone || now.has(f.p) ? i : -1).filter(i => i >= 0);
const remap = new Map(keep.map((old, i) => [old, i]));
for (const c of commits) {
  const ch = c[5], out = [];
  for (let i = 0; i < ch.length; i += 3) if (remap.has(ch[i])) out.push(remap.get(ch[i]), ch[i + 1], ch[i + 2]);
  c[5] = out;
}
const outFiles = keep.map(i => {
  const f = files[i]; let own = -1, best = -1;
  for (const [a, w] of f.by) if (w > best) { best = w; own = a; }
  const r = { p: f.p, lang: langOf(f.p), loc: f.loc, maxLoc: f.maxLoc, born: Math.max(0, f.born), last: f.last, n: f.n, own, ag: f.ag };
  if (f.gone) { r.gone = 1; r.goneAt = f.goneAt; }
  return r;
});

// ---- imports (roads): regex, not a parser — fast, language-light, and it misses some on purpose:
// only RELATIVE references are followed, so every edge lands on a file that is really in the repo.
// f.imp = indices of the files this one references.
const IMPORT_RES = {
  JavaScript: [/\bimport\s[^'"`]*?from\s*['"]([^'"]+)['"]/g, /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g, /\bexport\s[^'"`]*?from\s*['"]([^'"]+)['"]/g, /^\s*import\s+['"]([^'"]+)['"]/gm],
  HTML: [/<script[^>]+src\s*=\s*["']([^"']+)["']/gi, /<link[^>]+href\s*=\s*["']([^"']+)["']/gi, /<a[^>]+href\s*=\s*["']([^"'#?]+\.html?)["']/gi],
  CSS: [/@import\s+(?:url\()?\s*['"]?([^'")\s;]+)/g],
  Markdown: [/\]\(\s*<?([^)\s>#?]+)/g],
  Python: [/^\s*from\s+(\.+[\w.]*)\s+import/gm],
};
IMPORT_RES.TypeScript = IMPORT_RES.JavaScript; IMPORT_RES.Vue = IMPORT_RES.JavaScript; IMPORT_RES.Svelte = IMPORT_RES.JavaScript;
const TRY_EXT = ['', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.json', '/index.js', '/index.ts', '.py', '/__init__.py'];
const indexOfPath = new Map(outFiles.map((f, i) => [f.p, i]));
function resolveRef(from, ref, lang) {
  if (/^[a-z][\w+.-]*:/i.test(ref) || ref.startsWith('//') || ref.startsWith('/')) return -1;  // URL, protocol, absolute
  if (lang === 'Python') {                       // from ..pkg.mod import x  ->  ../pkg/mod
    const dots = /^\.+/.exec(ref)[0].length;
    ref = '../'.repeat(dots - 1) + './' + ref.slice(dots).replace(/\./g, '/');
  } else if (lang === 'JavaScript' || lang === 'TypeScript' || lang === 'Vue' || lang === 'Svelte') {
    if (!ref.startsWith('.')) return -1;         // a package name, not a file of ours
  }
  let base;
  try { base = path.posix.normalize(path.posix.join(path.posix.dirname(from), decodeURIComponent(ref))); } catch { return -1; }
  for (const ext of TRY_EXT) { const i = indexOfPath.get(base + ext); if (i !== undefined) return i; }
  return -1;
}
let edges = 0;
outFiles.forEach((f, i) => {
  const res = IMPORT_RES[f.lang];
  if (!res || f.gone || f.loc === 0) return;
  let text;
  try { text = fs.readFileSync(path.join(REPO, f.p), 'utf8'); } catch { return; }
  if (text.length > 1024 * 1024) text = text.slice(0, 1024 * 1024);   // a megabyte is plenty to find references
  const imp = new Set();
  for (const re of res) for (const m of text.matchAll(re)) { const j = resolveRef(f.p, m[1].trim(), f.lang); if (j >= 0 && j !== i) imp.add(j); }
  if (imp.size) { f.imp = [...imp].sort((a, b) => a - b); edges += imp.size; }
});

let head = '', branch = '';
try { head = git('rev-parse', '--short', 'HEAD').trim(); branch = git('rev-parse', '--abbrev-ref', 'HEAD').trim(); } catch { /* empty repo */ }
const city = {
  kind: 'vrg-codecity', version: 1,
  repo: { name: path.basename(REPO), head, branch, scannedAt: new Date().toISOString() },
  authors, agents: agentNames, commits, files: outFiles,
};

const name = city.repo.name.replace(/[^\w.-]+/g, '_');
const out = opt('--out') || path.join(__dirname, 'dist', `${name}.city.json`);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(city));
const live = outFiles.filter(f => !f.gone).length;
console.log(`${city.repo.name}@${head}: ${commits.length} commits, ${authors.length} authors, ${live} files (+${outFiles.length - live} gone), ` +
  `${commits.filter(c => c[2] >= 0).length} agent commits, ${edges} import roads, ${skipped} skipped -> ${path.relative(process.cwd(), out)}`);

if (opt('--html')) {
  const page = require('./build.js').buildPage(city);
  fs.mkdirSync(path.dirname(path.resolve(opt('--html'))), { recursive: true });
  fs.writeFileSync(opt('--html'), page);
  console.log(`page -> ${opt('--html')} (${(page.length / 1024).toFixed(0)} KB)`);
}
