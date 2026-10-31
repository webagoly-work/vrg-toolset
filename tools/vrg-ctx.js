#!/usr/bin/env node
// ---------------------------------------------------------------------------
// vrg-ctx.js — local context search: a BM25 index of the repo for work sessions.
// A contractor asks here first and reads only the lines it needs, instead of
// opening whole files. No model, no network, no dependency (node:sqlite + FTS5).
//
//   node tools/vrg-ctx.js index                         rebuild the index
//   node tools/vrg-ctx.js q "kettes kapcsolo" [-n 8]    search
//       [--path Planner/projects] [--budget 1500] [--json]
//   node tools/vrg-ctx.js stats
//
// Only files Git tracks are indexed, so client data outside Git stays out, and
// what is tracked has already passed the anonymiser rule. The database lives
// outside the repo. Accents are ignored: "vezetekcsatorna" finds "vezetékcsatorna",
// and each word also matches as a prefix, which covers most Hungarian suffixes.
// ---------------------------------------------------------------------------

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { DatabaseSync } = require('node:sqlite');

const REPO = path.resolve(__dirname, '..');
const DB = process.env.VRG_CTX_DB || path.join(path.dirname(REPO), '_admin', 'ctx', 'vrg-ctx.sqlite');
const TEXT = /\.(md|txt|js|mjs|cjs|json|ps1|cmd|bat|py|kt|kts|ino|h|hpp|c|cpp|html|css|yml|yaml)$/i;
const SKIP = /(^|\/)(dist|Vendor|node_modules|\.cache|docs\/research\/research_notes)(\/|$)|\.min\.|(^|\/)package-lock\.json$|\.sha256$/;
const MAX_FILE = 400 * 1024;
const CHUNK_LINES = 60;

function usage() {
  console.error('node tools/vrg-ctx.js index | stats | q "<words>" [-n 8] [--path prefix] [--budget 1500] [--json]');
  process.exit(2);
}

/* Roughly four characters to a token: good enough to keep an answer inside a budget. */
const tokens = s => Math.ceil(s.length / 4);

/* Cuts at Markdown headings and top-level definitions, so a hit lands on a named thing. */
function chunks(file, text) {
  const lines = text.split(/\r?\n/);
  const md = /\.md$/i.test(file);
  const head = md ? /^#{1,4}\s+(.+)/ : /^(?:export\s+)?(?:async\s+)?(?:function\s+([\w$]+)|class\s+([\w$]+)|(?:const|let|var)\s+([\w$]+)\s*=)/;
  const out = [];
  let cur = { line: 1, title: '', body: [] };
  const flush = () => {
    if (cur.body.join('').trim()) out.push({ line: cur.line, title: cur.title, text: cur.body.join('\n') });
  };
  lines.forEach((l, i) => {
    const m = head.exec(l);
    if ((m && cur.body.length >= 8) || cur.body.length >= CHUNK_LINES) {
      flush();
      cur = { line: i + 1, title: m ? (m[1] || m[2] || m[3]) : cur.title, body: [] };
    } else if (m && !cur.title) cur.title = m[1] || m[2] || m[3];
    cur.body.push(l);
  });
  flush();
  return out;
}

function index() {
  fs.mkdirSync(path.dirname(DB), { recursive: true });
  fs.rmSync(DB, { force: true });
  const db = new DatabaseSync(DB);
  db.exec("CREATE VIRTUAL TABLE c USING fts5(path, title, body, line UNINDEXED, tokenize = 'unicode61 remove_diacritics 2')");
  db.exec('CREATE TABLE meta (k TEXT PRIMARY KEY, v TEXT)');
  const files = execFileSync('git', ['ls-files'], { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').split('\n')
    .filter(f => f && TEXT.test(f) && !SKIP.test(f));
  const put = db.prepare('INSERT INTO c (path, title, body, line) VALUES (?, ?, ?, ?)');
  let nFiles = 0, nChunks = 0;
  const t0 = process.hrtime.bigint();
  db.exec('BEGIN');
  for (const f of files) {
    const full = path.join(REPO, f);
    let st;
    try { st = fs.statSync(full); } catch { continue; }
    if (st.size > MAX_FILE) continue;
    const text = fs.readFileSync(full, 'utf8');
    if (text.includes('\u0000')) continue;
    nFiles++;
    for (const c of chunks(f, text)) { put.run(f, c.title, c.text, c.line); nChunks++; }
  }
  db.exec('COMMIT');
  const head = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: REPO }).toString().trim();
  db.prepare('INSERT INTO meta VALUES (?, ?)').run('head', head);
  db.close();
  const ms = Number((process.hrtime.bigint() - t0) / 1000000n);
  console.log(`Indexed ${nFiles} files, ${nChunks} chunks in ${ms} ms at ${head}: ${DB} (${(fs.statSync(DB).size / 1e6).toFixed(1)} MB)`);
}

/* Every word becomes a quoted prefix term, so FTS operators in a query cannot break it. */
const ftsQuery = (q, op) => q.split(/\s+/).filter(Boolean).map(w => '"' + w.replace(/"/g, '') + '"*').join(op);

function search(args) {
  const opt = { n: 8, budget: 1500, json: false, path: '' };
  const words = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-n') opt.n = +args[++i];
    else if (args[i] === '--budget') opt.budget = +args[++i];
    else if (args[i] === '--path') opt.path = args[++i];
    else if (args[i] === '--json') opt.json = true;
    else words.push(args[i]);
  }
  if (!words.length) usage();
  if (!fs.existsSync(DB)) { console.error('No index yet: node tools/vrg-ctx.js index'); process.exit(1); }
  const db = new DatabaseSync(DB, { readOnly: true });
  const find = db.prepare(`SELECT path, title, line, snippet(c, 2, '[', ']', ' … ', 24) AS snip, bm25(c, 2.0, 4.0, 1.0) AS score
    FROM c WHERE c MATCH ? AND path LIKE ? ORDER BY score LIMIT ?`);
  // All words first; when too few chunks hold them all, any word counts, ranked below those.
  const text = words.join(' ');
  let rows = find.all(ftsQuery(text, ' '), opt.path + '%', opt.n * 4);
  if (rows.length < opt.n && words.join(' ').split(/\s+/).length > 1) {
    const have = new Set(rows.map(r => r.path + ':' + r.line));
    rows = rows.concat(find.all(ftsQuery(text, ' OR '), opt.path + '%', opt.n * 4).filter(r => !have.has(r.path + ':' + r.line)));
  }
  const seen = new Map(), hits = [];
  let spent = 0;
  for (const r of rows) {
    const same = seen.get(r.path) || 0;   // at most two hits from one file, so one big file cannot fill the answer
    if (same >= 2 || hits.length >= opt.n) continue;
    const line = `${r.path}:${r.line}${r.title ? '  ' + r.title : ''}\n  ${r.snip.replace(/\s+/g, ' ').trim()}`;
    if (spent + tokens(line) > opt.budget) break;
    spent += tokens(line);
    seen.set(r.path, same + 1);
    hits.push({ path: r.path, line: r.line, title: r.title, snippet: r.snip, text: line });
  }
  if (opt.json) console.log(JSON.stringify(hits.map(({ text, ...h }) => h)));
  else {
    console.log(hits.map(h => h.text).join('\n') || 'No hits.');
    console.log(`-- ${hits.length} hits, about ${spent} tokens, index at ${db.prepare('SELECT v FROM meta WHERE k = ?').get('head').v}`);
  }
  db.close();
}

function stats() {
  const db = new DatabaseSync(DB, { readOnly: true });
  const n = db.prepare('SELECT count(*) AS n, count(DISTINCT path) AS f FROM c').get();
  console.log(`${n.f} files, ${n.n} chunks, index at ${db.prepare('SELECT v FROM meta WHERE k = ?').get('head').v}`);
  db.close();
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === 'index') index();
else if (cmd === 'q') search(rest);
else if (cmd === 'stats') stats();
else usage();
