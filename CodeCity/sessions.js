// sessions.js — agent-session replay data (CITY-D7 A): what a Claude Code session read, searched and
// edited, as file paths + kind + time. Nothing else leaves the transcript: no prompts, no tool output,
// no search patterns, no commands, no titles. Only `scan.js --sessions` calls this, so it is opt-in
// per scan, and the transcripts are read locally.
//
// Transcripts: ~/.claude/projects/<cwd with every non-alphanumeric as '-'>/*.jsonl, one JSON entry per
// line. A tool call is an assistant entry whose message.content has {type:'tool_use', id, name, input}.
// Paths are absolute (sometimes relative to the entry's cwd); only those inside one of `roots` (the
// repo and its worktrees) are kept, and only when they name a file or folder of the city.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');

const READ = 0, SEARCH = 1, EDIT = 2;
// tool name -> [kind, input keys that hold paths]; Grep/Glob without a path search the cwd
const TOOLS = {
  Read: [READ, ['file_path']], NotebookRead: [READ, ['notebook_path']],
  Write: [EDIT, ['file_path']], Edit: [EDIT, ['file_path']], MultiEdit: [EDIT, ['file_path']], NotebookEdit: [EDIT, ['notebook_path']],
  Grep: [SEARCH, ['path']], Glob: [SEARCH, ['path']],
};
const DC = { read_file: [READ, ['path']], read_multiple_files: [READ, ['paths']], write_file: [EDIT, ['path']],
  edit_block: [EDIT, ['file_path']], start_search: [SEARCH, ['path']], list_directory: [SEARCH, ['path']] };
function toolKind(name) {
  if (TOOLS[name]) return TOOLS[name];
  const m = /^mcp__.*desktop-commander__(\w+)$/.exec(name);
  return m ? DC[m[1]] || null : null;
}

const mangle = p => p.replace(/[^A-Za-z0-9]/g, '-');
const norm = p => p.replace(/\\/g, '/').replace(/\/+$/, '');

// every *.jsonl under dir (subagent transcripts sit in <session>/subagents/)
function jsonlFiles(dir, out = []) {
  let ents; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of ents) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) jsonlFiles(p, out); else if (e.name.endsWith('.jsonl')) out.push(p);
  }
  return out;
}

// the transcript folders that belong to these roots (a worktree under root/.claude/worktrees/x
// mangles to "<root>--claude-worktrees-x", so a prefix match finds those too)
function transcriptDirs(roots, base = path.join(os.homedir(), '.claude', 'projects')) {
  let names; try { names = fs.readdirSync(base); } catch { return []; }
  const pre = roots.map(r => mangle(path.resolve(r)).toLowerCase());
  return names.filter(n => pre.some(p => n.toLowerCase() === p || n.toLowerCase().startsWith(p + '-')))
    .map(n => path.join(base, n));
}

// opts: { roots: [abs paths], dirs?: [transcript folders], files: [city file paths], max?: 30, minEvents?: 3 }
// -> { sessions: [{ id, t0, dirs, ev: [dt, kind, target, ...] }], stats }
//    target >= 0: index into files · target < 0: ~target indexes the session's dirs ('' = repo root)
function readSessions(opts) {
  const ci = process.platform === 'win32';
  const key = s => ci ? s.toLowerCase() : s;
  const roots = opts.roots.map(r => key(norm(path.resolve(r)))).sort((a, b) => b.length - a.length);   // worktree before its parent
  const fileIdx = new Map(opts.files.map((p, i) => [key(p), i]));
  const dirName = new Map([['', '']]);   // folder key -> path as the city spells it
  for (const p of opts.files) { const parts = p.split('/'); for (let k = 1; k < parts.length; k++) { const d = parts.slice(0, k).join('/'); dirName.set(key(d), d); } }

  const stats = { transcripts: 0, calls: 0, kept: 0, outside: 0 };
  const bySession = new Map();   // id -> { seen:Set, ev: [[t, kind, rel]] }
  const resolveRel = (p, cwd) => {
    const abs = key(norm(path.resolve(cwd || '.', p)));
    const r = roots.find(r => abs === r || abs.startsWith(r + '/'));
    return r === undefined ? null : abs.slice(r.length + 1);
  };

  for (const file of (opts.dirs || transcriptDirs(opts.roots)).flatMap(d => jsonlFiles(d))) {
    stats.transcripts++;
    let text; try { text = fs.readFileSync(file, 'utf8'); } catch { continue; }
    let lastT = 0;
    for (const line of text.split('\n')) {
      if (!line.includes('"tool_use"')) { const m = /"timestamp":"([^"]+)"/.exec(line); if (m) lastT = Date.parse(m[1]) || lastT; continue; }
      let o; try { o = JSON.parse(line); } catch { continue; }
      if (o.timestamp) lastT = Date.parse(o.timestamp) || lastT;
      const c = o.message && o.message.content;
      if (o.type !== 'assistant' || !Array.isArray(c) || !o.sessionId || !lastT) continue;
      let s = bySession.get(o.sessionId);
      if (!s) bySession.set(o.sessionId, s = { seen: new Set(), ev: [] });
      for (const b of c) {
        if (b.type !== 'tool_use' || s.seen.has(b.id)) continue;
        s.seen.add(b.id);
        const tk = toolKind(b.name);
        if (!tk) continue;
        stats.calls++;
        const [kind, keys] = tk, input = b.input || {};
        let ps = keys.flatMap(k => Array.isArray(input[k]) ? input[k] : input[k] ? [input[k]] : []);
        if (!ps.length && kind === SEARCH) ps = ['.'];
        for (const p of ps) {
          if (typeof p !== 'string') continue;
          const rel = resolveRel(p, o.cwd);
          if (rel === null) { stats.outside++; continue; }
          if (fileIdx.has(rel)) s.ev.push([lastT, kind, fileIdx.get(rel)]);
          else if (dirName.has(rel)) s.ev.push([lastT, kind, dirName.get(rel)]);
          else { stats.outside++; continue; }   // untracked, ignored or since gone without history
          stats.kept++;
        }
      }
    }
  }

  const minEvents = opts.minEvents || 3;
  const sessions = [...bySession].map(([id, s]) => {
    s.ev.sort((a, b) => a[0] - b[0]);
    const t0 = s.ev.length ? s.ev[0][0] : 0, dirs = [], ev = [];
    for (const [t, kind, target] of s.ev) {
      let tg = target;
      if (typeof target === 'string') { let k = dirs.indexOf(target); if (k < 0) { k = dirs.length; dirs.push(target); } tg = ~k; }
      ev.push(Math.round((t - t0) / 1000), kind, tg);
    }
    return { id: id.slice(0, 8), t0: Math.round(t0 / 1000), dirs, ev };
  }).filter(s => s.ev.length / 3 >= minEvents)
    .sort((a, b) => b.t0 - a.t0).slice(0, opts.max || 30).reverse();   // newest N, oldest first
  return { sessions, stats };
}

module.exports = { readSessions, transcriptDirs, mangle, READ, SEARCH, EDIT };
