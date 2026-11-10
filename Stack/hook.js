#!/usr/bin/env node
// VRG Stack — Claude Code session hooks (ROADMAP 2.5). Registered in the git-ignored
// .claude/settings.local.json of the main checkout (2026-11-10, at the Founder's yes):
//
//   node Stack/hook.js start    SessionStart (startup | clear | compact): prints the build stamp and
//                               out/codec/L0.txt to stdout, which Claude Code adds to the session's
//                               context. The agent starts oriented without being told to read L0.
//   node Stack/hook.js stop     Stop (each turn's end): reads the session transcript from where the
//                               last Stop left off, collects the files the turn's tool calls named
//                               (file tools' paths, and path-looking words in Bash/PowerShell commands),
//                               resolves them to Stack node ids through out/stack.json's own path keys,
//                               and appends ONE line to data/live/<sid8>.jsonl:
//                                 { t, kind: 'turn', sid, seq, steps, tools: {Read: 3, …}, files, nodes, upto }
//                               `upto` is the transcript byte offset read so far, so the next turn
//                               reads only what is new. lib/runs.js shows data/live in the Futásnapló.
//
// Both are read-only toward every source: start reads out/, stop reads the transcript and out/ and
// appends to data/live (history, append-only). Neither builds (STK-Q3 = A: rebuild by hand).
// Both always exit 0 and print nothing on failure, within 2 s: a broken Stack never holds Claude up.
// Subagent tool calls live in their own transcripts and are not counted here (the build's recorder
// still reads them after the fact, STK-Q9 = A).
//
//   STACK_HOOK_DEBUG=1  prints why it did nothing, to stderr
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const STALE_H = 48;
const DEBUG = process.env.STACK_HOOK_DEBUG === '1';

/* ---- pure parts (tested in test/stack.test.js) ---- */

function age(ms) {
  const h = ms / 36e5;
  return h < 1 ? Math.max(1, Math.round(h * 60)) + ' min' : h < 48 ? Math.round(h) + ' h' : Math.round(h / 24) + ' days';
}

/* the text SessionStart prints: one stamp line, then L0 */
function startText(l0, builtMs, nowMs) {
  if (!l0) return '';
  const stale = nowMs - builtMs > STALE_H * 36e5;
  const when = new Date(builtMs).toISOString().slice(0, 16).replace('T', ' ');
  const stamp = `VRG Stack (from Stack/hook.js, SessionStart): built ${when} UTC, ${age(nowMs - builtMs)} ago${stale ? ' — STALE, may be behind the sources: `node Stack/stack.js build` (≈ 1 min) before trusting counts' : ''}. Ask it before reading files: MCP stack_search / stack_string / stack_node, or \`node Stack/stack.js q "<words>"\`.`;
  return stamp + '\n\n' + l0.trim() + '\n';
}

/* a path as the stack keys it: repo-relative, worktree copies folded into the repo */
function keyPath(p, repo) {
  p = String(p || '').replace(/\\/g, '/').replace(/\/+$/, '');
  if (/^[a-z]:\//.test(p)) p = p[0].toUpperCase() + p.slice(1);
  const r = repo.replace(/\\/g, '/');
  const low = p.toLowerCase(), rl = r.toLowerCase();
  if (low.startsWith(rl + '/.claude/worktrees/')) { const rest = p.slice(r.length + '/.claude/worktrees/'.length); const i = rest.indexOf('/'); return i < 0 ? '.' : rest.slice(i + 1); }
  if (low.startsWith(rl + '/')) return p.slice(r.length + 1);
  return p;
}

/* own path keys → node ids; a file with no node of its own falls back to its nearest folder that has one */
function pathIndex(nodes) {
  const idx = new Map();
  for (const n of nodes) for (const k of n.own || []) if (k.startsWith('p:')) { const p = k.slice(2).toLowerCase(); (idx.get(p) || idx.set(p, []).get(p)).push(n.id); }
  return idx;
}
function resolvePath(idx, p) {
  let q = p.toLowerCase();
  for (;;) {
    if (idx.has(q)) return idx.get(q);
    const i = q.lastIndexOf('/'); if (i <= 0) return [];
    q = q.slice(0, i);
  }
}

/* path-looking words in a shell command: they contain a slash, are not flags or URLs; Git Bash's
   /h/… is H:/…; a relative one is taken from the session's folder */
function commandPaths(cmd, cwd) {
  const out = [];
  for (let w of String(cmd).split(/[\s"'`;|&<>()=,]+/)) {
    if (!w || w[0] === '-' || /^[a-z]+:\/\//i.test(w) || !/[\\/]/.test(w) || /[*?$%{}]/.test(w)) continue;
    w = w.replace(/\\/g, '/').replace(/^\/([a-z])\//i, (m, d) => d.toUpperCase() + ':/');
    if (/^\/(dev|tmp|usr|bin|etc)\b/.test(w)) continue;
    if (!/^[A-Z]:\//i.test(w)) { if (!cwd) continue; w = path.posix.join(String(cwd).replace(/\\/g, '/'), w); }
    out.push(w);
    if (out.length >= 20) break;
  }
  return out;
}

/* transcript text (from the last offset) → the turn's tools and files */
function turnOf(text) {
  const tools = {}, files = new Set();
  let steps = 0, last = '', cwd = '';
  for (const line of text.split('\n')) {
    if (!line) continue;
    let o; try { o = JSON.parse(line); } catch { continue; }
    if (o.timestamp && o.timestamp > last) last = o.timestamp;
    if (o.cwd) cwd = o.cwd;
    if (o.type !== 'assistant' || !o.message || !Array.isArray(o.message.content)) continue;
    for (const c of o.message.content) {
      if (c.type !== 'tool_use') continue;
      steps++;
      const name = String(c.name || '?').startsWith('mcp__') ? 'mcp:' + c.name.split('__').slice(1).join('.') : c.name;
      tools[name] = (tools[name] || 0) + 1;
      const inp = c.input || {};
      for (const k of ['file_path', 'path', 'notebook_path']) if (typeof inp[k] === 'string') files.add(inp[k]);
      if (Array.isArray(inp.file_paths)) for (const f of inp.file_paths) if (typeof f === 'string') files.add(f);
      if (typeof inp.command === 'string') for (const f of commandPaths(inp.command, cwd)) files.add(f);
    }
  }
  return { steps, tools, files: [...files], last };
}

/* the line Stop appends */
function turnRecord({ sid, seq, text, upto, nodes, repo, now }) {
  const t = turnOf(text);
  const keyed = [...new Set(t.files.map(f => keyPath(f, repo)))];
  const idx = pathIndex(nodes);
  const ids = new Set(); for (const p of keyed) for (const id of resolvePath(idx, p)) ids.add(id);
  return { t: t.last || now, kind: 'turn', sid, seq, steps: t.steps, tools: t.tools, files: keyed.slice(0, 60), nodes: [...ids].slice(0, 120), upto };
}

/* the last line of a live file (its upto + seq), read from the tail only */
function lastLine(file) {
  let fd; try { fd = fs.openSync(file, 'r'); } catch { return null; }
  try {
    const size = fs.fstatSync(fd).size; if (!size) return null;
    const n = Math.min(size, 64 << 10), buf = Buffer.alloc(n);
    fs.readSync(fd, buf, 0, n, size - n);
    const lines = buf.toString('utf8').split('\n').filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) { try { return JSON.parse(lines[i]); } catch { /* torn line */ } }
    return null;
  } finally { fs.closeSync(fd); }
}

/* ---- the two hooks ---- */

function start(h, { out = path.join(ROOT, 'out'), now = Date.now() } = {}) {
  if (h && h.source === 'resume') return '';                 // a resumed session already has it
  let l0, built;
  try { l0 = fs.readFileSync(path.join(out, 'codec', 'L0.txt'), 'utf8'); built = fs.statSync(path.join(out, 'stack.json')).mtimeMs; }
  catch { return ''; }
  return startText(l0, built, now);
}

function stop(h, { out = path.join(ROOT, 'out'), data = path.join(ROOT, 'data'), repo, now = new Date().toISOString() } = {}) {
  const sid = String((h && h.session_id) || '');
  const tp = h && h.transcript_path;
  if (!/^[0-9a-f-]{8,}$/i.test(sid) || !tp) return 'no session id or transcript';
  repo = repo || require('./config').sources.repo;
  const dir = path.join(data, 'live'), file = path.join(dir, sid.slice(0, 8) + '.jsonl');
  const prev = lastLine(file);
  let size; try { size = fs.statSync(tp).size; } catch { return 'no transcript'; }
  let from = prev && prev.sid === sid && prev.upto <= size ? prev.upto : 0;
  if (size - from > 32 << 20) from = size - (32 << 20);       // never read more than 32 MB in one turn
  if (size === from) return 'nothing new';
  const buf = Buffer.alloc(size - from), fd = fs.openSync(tp, 'r');
  try { fs.readSync(fd, buf, 0, buf.length, from); } finally { fs.closeSync(fd); }
  let text = buf.toString('utf8');
  const cut = text.lastIndexOf('\n'); if (cut < 0) return 'no whole line yet';
  text = text.slice(0, cut + 1);
  const upto = from + Buffer.byteLength(text, 'utf8');
  let nodes = [];
  try { nodes = JSON.parse(fs.readFileSync(path.join(out, 'stack.json'), 'utf8')).nodes || []; } catch { /* no build: files only */ }
  const rec = turnRecord({ sid, seq: prev && prev.sid === sid ? (prev.seq || 0) + 1 : 1, text, upto, nodes, repo, now });
  if (!rec.steps) { rec.files = []; rec.nodes = []; }
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(file, JSON.stringify(rec) + '\n');
  return '';
}

module.exports = { startText, keyPath, pathIndex, resolvePath, commandPaths, turnOf, turnRecord, lastLine, start, stop };

if (require.main === module) {
  const mode = process.argv[2];
  const done = why => { if (DEBUG && why) process.stderr.write('stack hook: ' + why + '\n'); process.exit(0); };
  setTimeout(() => done('timeout'), 2000).unref();
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', d => { raw += d; });
  process.stdin.on('end', () => {
    let h = {}; try { h = raw.trim() ? JSON.parse(raw) : {}; } catch { return done('input is not JSON'); }
    try {
      if (mode === 'start') { const t = start(h); if (t) process.stdout.write(t); return done(t ? '' : 'nothing to print'); }
      if (mode === 'stop') return done(stop(h));
      return done('usage: hook.js start|stop');
    } catch (e) { return done(e.message); }
  });
}
