// VRG Stack — the recorder (STK-Q9 = A: after the fact, from what is already on disk).
//
// Reads every Claude Code transcript (from the archive, so deleted ones still count), with its
// subagent transcripts, and writes one recording per session:
//   out/recordings/<sid8>.jsonl   one step per line, shape in schema/shapes.js (checkStep)
//   out/recordings/index.json     per session: title, project, times, tool counts, tokens,
//                                 the stack nodes it touched most
// A step is one of
//   prompt        the user wrote something                    actor user
//   chat          the model answered in text (or thought)     actor agent / subagent
//   execute_tool  Read, Edit, Write, Bash, Grep …             actor agent / subagent
//   invoke_agent  the session started a subagent              actor agent
//   commit        a git commit made by a step of the session  actor agent
// Each step names the stack nodes it touched (`nodes`), through the same resolver as the join.
// Incremental: a session is parsed again only when its transcript changed or VERSION changed.
'use strict';

const fs = require('fs');
const path = require('path');
const CFG = require('../config');
const X = require('./fsx');
const { normPath, clip } = require('./common');

const VERSION = 4; // bump when the step shape or the parsing changes: every recording is redone
const DIR = path.join(CFG.out, 'recordings');

/* every top-level transcript: <projects>/<project>/<uuid>.jsonl */
function transcripts() {
  const base = fs.existsSync(path.join(CFG.archive.dir, 'projects')) ? path.join(CFG.archive.dir, 'projects') : CFG.sources.transcripts;
  const out = [];
  for (const proj of safeList(base)) {
    const pdir = path.join(base, proj);
    for (const f of safeList(pdir)) {
      if (!/^[0-9a-f-]{36}\.jsonl$/.test(f)) continue;
      const sid = f.slice(0, 36);
      const sub = path.join(pdir, sid, 'subagents');
      out.push({ sid, project: proj, file: path.join(pdir, f), subs: safeList(sub).filter(x => x.endsWith('.jsonl')).map(x => path.join(sub, x)) });
    }
  }
  return out;
}
function safeList(d) { try { return fs.readdirSync(d); } catch { return []; } }
const stamp = t => { let s = 0, m = 0; for (const f of [t.file, ...t.subs]) { try { const st = fs.statSync(f); s += st.size; m = Math.max(m, st.mtimeMs); } catch {} } return `${s}:${Math.round(m)}`; };

/* the paths a tool call names, normalised */
function toolPaths(name, input) {
  const p = [];
  for (const k of ['file_path', 'path', 'notebook_path']) if (typeof input[k] === 'string') p.push(input[k]);
  if (Array.isArray(input.file_paths)) p.push(...input.file_paths.filter(x => typeof x === 'string'));
  return p.map(normPath);
}
const toolText = (name, input) => [input.command, input.pattern, input.query, input.description, input.url].filter(x => typeof x === 'string').join(' ');
const short = name => name.startsWith('mcp__') ? 'mcp:' + name.split('__').slice(1).join('.') : name;

/* one transcript file → raw steps (no node resolution yet) */
function parseFile(file, actorName) {
  const steps = [];
  const meta = { title: '', cwd: '', branch: '', start: '', end: '' };
  const byToolId = new Map();
  const usageSeen = new Set();
  let txt; try { txt = fs.readFileSync(file, 'utf8'); } catch { return { steps, meta }; }
  for (const line of txt.split('\n')) {
    if (!line) continue;
    let o; try { o = JSON.parse(line); } catch { continue; }
    if (o.type === 'custom-title' && o.customTitle) meta.title = o.customTitle;
    if (o.type === 'summary' && o.summary && !meta.title) meta.title = o.summary;
    const t = o.timestamp; if (!t) continue;
    if (!meta.start || t < meta.start) meta.start = t; if (t > meta.end) meta.end = t;
    if (o.cwd && !meta.cwd) meta.cwd = o.cwd; if (o.gitBranch && !meta.branch) meta.branch = o.gitBranch;
    const msg = o.message; if (!msg) continue;
    if (o.type === 'user') {
      if (typeof msg.content === 'string') {
        if (!o.isMeta && !/^\s*<(command-|local-command|system-reminder)/.test(msg.content)) steps.push({ t, span: 'prompt', actor: 'user', text: clip(msg.content, 300) });
        continue;
      }
      for (const c of msg.content || []) {
        if (c.type === 'tool_result') { const s = byToolId.get(c.tool_use_id); if (s) s.ok = !c.is_error; }
        else if (c.type === 'text' && !o.isMeta && !/^\s*<(command-|system-reminder)/.test(c.text || '')) steps.push({ t, span: 'prompt', actor: 'user', text: clip(c.text, 300) });
      }
      continue;
    }
    if (o.type !== 'assistant' || !Array.isArray(msg.content)) continue;
    let tok = null;
    if (msg.usage && msg.id && !usageSeen.has(msg.id)) {
      usageSeen.add(msg.id); const u = msg.usage;
      tok = { in: u.input_tokens || 0, out: u.output_tokens || 0, cr: u.cache_read_input_tokens || 0, cw: u.cache_creation_input_tokens || 0 };
    }
    for (const c of msg.content) {
      let s = null;
      if (c.type === 'text' && c.text && c.text.trim()) s = { t, span: 'chat', actor: actorName, text: clip(c.text, 200) };
      else if (c.type === 'thinking') s = { t, span: 'chat', actor: actorName, text: '(thinking)' };
      else if (c.type === 'tool_use') {
        const input = c.input || {};
        const agent = c.name === 'Agent' || c.name === 'Task';
        s = { t, span: agent ? 'invoke_agent' : 'execute_tool', actor: actorName, tool: short(c.name), paths: toolPaths(c.name, input),
          text: clip(agent ? (input.description || input.prompt || '') : toolText(c.name, input), CFG.record.inputClip), ok: true };
        byToolId.set(c.id, s);
      }
      if (!s) continue;
      if (tok) { s.tok = tok; tok = null; }
      steps.push(s);
    }
  }
  return { steps, meta };
}

/* one session: main transcript + subagents → steps joined to the stack */
function recordSession(t, { resolve, commits }) {
  const main = parseFile(t.file, 'agent');
  const steps = main.steps;
  for (const f of t.subs) steps.push(...parseFile(f, 'subagent').steps);
  steps.sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0));
  // commits: a Bash step that ran `git commit` owns the first commit made within 3 minutes after it
  const used = new Set();
  const withCommits = [];
  for (const s of steps) {
    withCommits.push(s);
    if (s.span !== 'execute_tool' || !/\bgit\b[^|;&]*\bcommit\b/.test(s.text || '')) continue;
    const ms = Date.parse(s.t);
    const c = commits.find(c => !used.has(c.h) && c.ms >= ms - 5000 && c.ms <= ms + 180000);
    if (c) { used.add(c.h); withCommits.push({ t: new Date(c.ms).toISOString(), span: 'commit', actor: s.actor, tool: 'git', text: c.subject, nodes: ['R:' + c.h], paths: [] }); }
  }
  const touched = new Map();
  withCommits.forEach((s, i) => {
    s.seq = i;
    if (!s.nodes) s.nodes = resolve(s.paths || [], s.span === 'execute_tool' ? s.text : '');
    for (const id of s.nodes) touched.set(id, (touched.get(id) || 0) + 1);
    if (!s.paths || !s.paths.length) delete s.paths;
  });
  const tools = {}; const tokens = { in: 0, out: 0, cr: 0, cw: 0 };
  for (const s of withCommits) {
    if (s.tool) tools[s.tool] = (tools[s.tool] || 0) + 1;
    if (s.tok) for (const k in tokens) tokens[k] += s.tok[k];
  }
  const firstPrompt = withCommits.find(s => s.span === 'prompt');
  const summary = {
    sid: t.sid, project: t.project, title: main.meta.title || (firstPrompt ? clip(firstPrompt.text, 90) : t.sid.slice(0, 8)),
    cwd: main.meta.cwd, branch: main.meta.branch, start: main.meta.start, end: main.meta.end, steps: withCommits.length, subagents: t.subs.length,
    prompts: withCommits.filter(s => s.span === 'prompt').length, commits: withCommits.filter(s => s.span === 'commit').map(s => s.nodes[0]),
    tools, tokens, touched: [...touched.entries()].sort((a, b) => b[1] - a[1]).slice(0, 60),
  };
  return { steps: withCommits, summary };
}

/* every session; returns the index. `resolve(paths, text)` → node ids. */
function recordAll({ resolve, commits, force = false, log = () => {} }) {
  fs.mkdirSync(DIR, { recursive: true });
  const idxFile = path.join(DIR, 'index.json');
  const old = X.readJson(idxFile, { version: 0, sessions: {} });
  const fresh = !force && old.version === VERSION;
  const index = { version: VERSION, generated: new Date().toISOString(), sessions: {}, empty: {} };
  let redone = 0, kept = 0, empty = 0;
  for (const t of transcripts()) {
    const sid8 = t.sid.slice(0, 8);
    const st = stamp(t);
    const prev = old.sessions[sid8];
    if (fresh && prev && prev.stamp === st && fs.existsSync(path.join(DIR, sid8 + '.jsonl'))) { index.sessions[sid8] = prev; kept++; continue; }
    if (fresh && old.empty && old.empty[sid8] === st) { index.empty[sid8] = st; empty++; continue; } // known empty, unchanged
    const { steps, summary } = recordSession(t, { resolve, commits });
    if (steps.length < CFG.record.minSteps) { index.empty[sid8] = st; empty++; continue; }
    X.writeAtomic(path.join(DIR, sid8 + '.jsonl'), steps.map(s => JSON.stringify(s)).join('\n') + '\n');
    index.sessions[sid8] = { ...summary, stamp: st };
    redone++;
  }
  X.writeAtomic(idxFile, JSON.stringify(index));
  log(`recordings: ${redone} recorded, ${kept} unchanged, ${empty} empty`);
  return index;
}

const readRecording = sid8 => X.readJsonl(path.join(DIR, sid8 + '.jsonl')).records;

module.exports = { recordAll, recordSession, parseFile, readRecording, transcripts, VERSION, DIR };
