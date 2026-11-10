// VRG Stack — Futásnapló (run log) data for runs.html, the Runtime layer's overview (layer U).
//
//   out/runs-data.js   window.RUNS = { days, runs, places, kinds, lines, live, … }
//
// replay.html (Visszajátszás) shows one session step by step; this page is the overview above it: a
// day strip, then the day's runs as bars on a time-of-day axis, one row per place (worktree or
// checkout) or per DevLog line, so parallel sessions read as parallel.
//
// Where the data comes from (all read-only):
//   · out/recordings/index.json + <sid8>.jsonl (lib/record.js): every run's steps, tools, tokens, the
//     stack nodes it touched, its commits. Per-day totals use the Vezérlőterem's rule exactly
//     (lib/control.js, STK-P15): a step counts on the UTC day of its own time stamp, so a run that
//     spans several days counts on each, and the two pages' day totals are the same numbers (STK-P47).
//   · the first 256 KB of each archived transcript (_admin/recordings/projects), for what the recorder
//     does not keep: how the run was started (entrypoint, turnOrigin, agentSetting), which is the
//     bar colour (STK-P48). No message text is read from there.
//   · the graph (the one the build just made, or out/stack.json): node titles and layers for what a run
//     touched, the commit subjects, and run → DevLog session → line (ran, on-line).
//   · out/replay/index.js: which runs replay.html can open (#<sid8>).
//   · data/live/<sid8>.jsonl when that folder exists: one line per turn from the Stop hook (Stack/hook.js,
//     ROADMAP 2.5), or steps from a future PostToolUse feed. Only counted and dated here (STK-P52).
// The data quotes client job codes (session titles, paths), so out/ keeps it out of git.
// Writes out/runs-data.js only (fsx.writeAtomic). Runs as the optional stage `runs`, or alone with
// `stack.js runs`.
'use strict';

const fs = require('fs');
const path = require('path');
const CFG = require('../config');
const X = require('./fsx');
const C = require('./common');
const META = require('./meta');
const REC = require('./record');

const LAYER_HU = Object.fromEntries(META.map(m => [m.code, m.hu])); LAYER_HU.E = 'Pillér';
const IDLE_GAP = 30 * 60e3;     // STK-P49: steps further apart than this are two active stretches of one run
const HEAD_BYTES = 262144;      // how much of a transcript is read for its start fields
const MAX_FILES = 25, MAX_NODES = 24;
const READ_TOOLS = new Set(['Read', 'Grep', 'Glob', 'NotebookRead', 'LS']);
const WRITE_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

/* the kinds of run (bar colour), STK-P48; the order is the legend's */
const KINDS = [
  { id: 'desktop', hu: 'Asztali app', en: 'Claude desktop app, typed by a person' },
  { id: 'cli', hu: 'Terminál', en: 'Claude Code CLI in a terminal' },
  { id: 'agent', hu: 'Tanácsi ügynök', en: 'started as a named agent (claude --agent …)' },
  { id: 'auto', hu: 'Gépi indítás', en: 'started by a program or another session (SDK, peer)' },
  { id: 'scheduled', hu: 'Ütemezett', en: 'a scheduled task' },
  { id: 'unknown', hu: 'Ismeretlen', en: 'the transcript does not say' },
];

const read = f => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } };
const list = d => { try { return fs.readdirSync(d); } catch { return []; } };
const utcDay = t => String(t || '').slice(0, 10);

/* how the run was started: the transcript's own fields, from its first lines */
function startFields(project, sid) {
  const cands = [path.join(CFG.archive.dir, 'projects', project, sid + '.jsonl'), path.join(CFG.sources.transcripts, project, sid + '.jsonl')];
  const f = { entry: new Set(), origin: new Set(), agent: '' };
  for (const file of cands) {
    let fd; try { fd = fs.openSync(file, 'r'); } catch { continue; }
    try {
      const b = Buffer.alloc(HEAD_BYTES); const n = fs.readSync(fd, b, 0, b.length, 0);
      for (const line of b.slice(0, n).toString('utf8').split('\n')) {
        if (!/"(entrypoint|turnOrigin|agentSetting)"/.test(line)) continue;
        let o; try { o = JSON.parse(line); } catch { continue; }
        if (o.entrypoint) f.entry.add(o.entrypoint);
        if (o.turnOrigin) f.origin.add(o.turnOrigin);
        if (o.agentSetting && !f.agent) f.agent = String(o.agentSetting);
      }
    } finally { fs.closeSync(fd); }
    break;
  }
  let kind = 'unknown';
  if (f.agent && f.agent !== 'claude') kind = 'agent';
  else if (f.origin.has('scheduled')) kind = 'scheduled';
  else if (f.entry.has('sdk-cli') || ((f.origin.has('sdk') || f.origin.has('peer')) && !f.origin.has('human'))) kind = 'auto';
  else if (f.entry.has('cli')) kind = 'cli';
  else if (f.entry.has('claude-desktop')) kind = 'desktop';
  return { kind, agent: f.agent && f.agent !== 'claude' ? f.agent : '', entry: [...f.entry].join(', '), origin: [...f.origin].join(', ') };
}

/* where the run worked: one row per worktree or checkout (STK-P50). The re-root (2026-10-27) moved the
   repo; its old places are the same checkout. */
function placeOf(cwd) {
  const p = String(cwd || '').replace(/\\/g, '/').replace(/\/+$/, '');
  const wt = p.match(/\/\.claude\/worktrees\/([^/]+)/i);
  if (wt) return { id: 'wt:' + wt[1], label: '⑂ ' + wt[1], kind: 'worktree' };
  if (/\/Claude\/scratch-workspaces\//i.test(p)) return { id: 'scratch', label: 'Asztali scratch', kind: 'scratch' };
  if (/@anthropic-ai\/claude-code\/bin$/i.test(p)) return { id: 'ccbin', label: 'Claude Code bin', kind: 'other' };
  if (/^H:$/i.test(p) || p === 'H:') return { id: 'H:', label: 'H:\\ (gyökér)', kind: 'root' };
  if (/\/Planner_VRG_U100$/i.test(p)) return { id: 'repo', label: 'Planner_VRG_U100', kind: 'checkout' };
  const base = p.split('/').filter(Boolean).pop() || p || '?';
  return { id: 'dir:' + p.toLowerCase(), label: base, kind: 'other' };
}

/* a repo path for the panel: strip the worktree prefix so one file reads the same from every place */
const shortPath = p => String(p).replace(/^\.claude\/worktrees\/[^/]+\//, '');

/* data/live (ROADMAP 2.5): present → count and date it; absent → say so */
function live() {
  const dir = path.join(CFG.data, 'live');
  if (!fs.existsSync(dir)) return { on: false, dir: 'data/live' };
  const sessions = [];
  for (const f of list(dir)) {
    if (!/^[0-9a-f]{8}\.jsonl$/i.test(f)) continue;
    const lines = read(path.join(dir, f)).split('\n').filter(Boolean);
    // two line shapes: a step ({ t, tool }, a future PostToolUse feed) or a turn from Stack/hook.js stop
    // ({ t, kind: 'turn', steps, tools: {name: n}, nodes }), one per turn's end
    let last = '', first = '', ok = 0, bad = 0, turns = 0, tools = {}; const nodes = new Set();
    for (const l of lines) {
      let s; try { s = JSON.parse(l); } catch { bad++; continue; } if (!s || !s.t) { bad++; continue; }
      if (!first || s.t < first) first = s.t; if (s.t > last) last = s.t;
      if (s.kind === 'turn') { turns++; ok += s.steps || 0; for (const [k, n] of Object.entries(s.tools || {})) tools[k] = (tools[k] || 0) + n; for (const id of s.nodes || []) nodes.add(id); }
      else { ok++; if (s.tool) tools[s.tool] = (tools[s.tool] || 0) + 1; }
    }
    sessions.push({ sid8: f.slice(0, 8), steps: ok, turns, nodes: nodes.size, bad, first, last, tools: Object.entries(tools).sort((a, b) => b[1] - a[1]).slice(0, 5) });
  }
  sessions.sort((a, b) => b.last.localeCompare(a.last));
  return { on: true, dir: 'data/live', sessions, last: sessions.length ? sessions[0].last : '' };
}

/* the replay page's own list: only those ids open there (replay.html falls back to the newest otherwise) */
function replayIds() {
  const t = read(path.join(CFG.out, 'replay', 'index.js'));
  const m = t.match(/REPLAY_INDEX\s*=\s*(\[[\s\S]*\]);/);
  try { return new Set(JSON.parse(m[1]).map(r => r.sid)); } catch { return new Set(); }
}

function build(graph) {
  const byId = new Map(graph.nodes.map(n => [n.id, n]));
  const ix = X.readJson(path.join(REC.DIR, 'index.json'), { sessions: {} }) || { sessions: {} };
  const replay = replayIds();
  // run → DevLog session → line(s), from the graph
  const sessLines = new Map(), runSess = new Map();
  for (const e of graph.edges) {
    if (e.rel === 'on-line') { const s = byId.get(e.a), l = byId.get(e.b); if (s && l && s.kind === 'session' && l.kind === 'line') (sessLines.get(e.a) || sessLines.set(e.a, []).get(e.a)).push(e.b); }
    else if (e.rel === 'ran' && e.a.startsWith('U:run.')) runSess.set(e.a, e.b);
  }
  const lines = {};
  const days = new Map();
  const dayRow = d => days.get(d) || days.set(d, { d, runs: 0, steps: 0, calls: 0, commits: 0, sub: 0, tin: 0, tout: 0, tcr: 0, tcw: 0 }).get(d);
  const places = new Map();
  const runs = [];
  let fallbacks = 0;

  for (const s of Object.values(ix.sessions || {})) {
    if (!s || !s.sid) continue;
    const sid8 = s.sid.slice(0, 8);
    let steps = []; try { steps = REC.readRecording(sid8) || []; } catch { steps = []; }
    // the Vezérlőterem's fallback: no recording file → the whole run on its start day
    if (!steps.length && s.start && s.tokens) { steps = [{ t: s.start, tok: s.tokens, span: 'chat' }]; fallbacks++; }
    steps = steps.filter(st => st && st.t).sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0));
    if (!steps.length) continue;

    /* per day (the Vezérlőterem's rule) and per run */
    const perDay = {};   // d → [steps, calls, tokens (in+out+cw), cache read, commits]
    const files = new Map();
    let calls = 0, sub = 0, nCommits = 0;
    for (const st of steps) {
      const d = utcDay(st.t); if (!d) continue;
      const x = dayRow(d), tk = st.tok || {};
      const r = perDay[d] || (perDay[d] = [0, 0, 0, 0, 0]);
      if (r[0] === 0) x.runs++;
      x.steps++; r[0]++;
      if (st.span === 'execute_tool' || st.span === 'invoke_agent') { x.calls++; r[1]++; calls++; }
      if (st.span === 'invoke_agent') { x.sub++; sub++; }
      if (st.span === 'commit') { x.commits++; r[4]++; nCommits++; }
      x.tin += tk.in || 0; x.tout += tk.out || 0; x.tcr += tk.cr || 0; x.tcw += tk.cw || 0;
      r[2] += (tk.in || 0) + (tk.out || 0) + (tk.cw || 0); r[3] += tk.cr || 0;
      if (st.span === 'execute_tool' && st.paths) for (const p of st.paths) {
        const k = shortPath(p); const f = files.get(k) || files.set(k, [k, 0, 0, 0, 0]).get(k);   // path, read, written, other, failed
        if (WRITE_TOOLS.has(st.tool)) f[2]++; else if (READ_TOOLS.has(st.tool)) f[1]++; else f[3]++;
        if (st.ok === false) f[4]++;
      }
    }

    /* active stretches: steps closer than IDLE_GAP form one segment [startMs, endMs, steps] */
    const segs = [];
    for (const st of steps) {
      const ms = Date.parse(st.t); if (!isFinite(ms)) continue;
      const last = segs[segs.length - 1];
      if (last && ms - last[1] <= IDLE_GAP) { last[1] = ms; last[2]++; } else segs.push([ms, ms, 1]);
    }
    const active = segs.reduce((a, g) => a + (g[1] - g[0]), 0);

    const pl = placeOf(s.cwd);
    if (!places.has(pl.id)) places.set(pl.id, { ...pl, runs: 0, cwds: new Set() });
    const P = places.get(pl.id); P.runs++; if (s.cwd) P.cwds.add(s.cwd);

    const how = startFields(s.project, s.sid);
    const sessId = runSess.get('U:run.' + sid8) || (byId.has('L:s' + sid8) ? 'L:s' + sid8 : '');
    const lineIds = sessId ? [...new Set(sessLines.get(sessId) || [])] : [];
    for (const l of lineIds) if (!lines[l]) { const n = byId.get(l); lines[l] = [C.clip(n.title, 60), n.state || '', n.lane || '']; }

    /* what it touched: the recorder's weights, grouped by layer (the Konnektóm glow) */
    const layers = {};
    const nodes = [];
    for (const [id, w] of s.touched || []) {
      const n = byId.get(id); const L = n ? n.layer : id[0];
      layers[L] = (layers[L] || 0) + w;
      if (n && nodes.length < MAX_NODES) nodes.push([id, L, C.clip(n.title, 70), w]);
    }
    const tok = s.tokens || { in: 0, out: 0, cr: 0, cw: 0 };
    const firstPrompt = steps.find(st => st.span === 'prompt');
    runs.push({
      sid: s.sid, sid8, title: C.clip(s.title, 120), kind: how.kind, agent: how.agent, entry: how.entry, origin: how.origin,
      place: pl.id, cwd: s.cwd || '', branch: s.branch || '', start: steps[0].t, end: steps[steps.length - 1].t,
      segs, active, steps: steps.length, prompts: s.prompts || 0, calls, sub, subagents: s.subagents || 0,
      tok: { in: tok.in || 0, out: tok.out || 0, cr: tok.cr || 0, cw: tok.cw || 0 },
      tools: Object.entries(s.tools || {}).sort((a, b) => b[1] - a[1]),
      files: [...files.values()].sort((a, b) => (b[1] + b[2] + b[3]) - (a[1] + a[2] + a[3])).slice(0, MAX_FILES), nFiles: files.size,
      layers, nodes, commits: (s.commits || []).map(h => [h.slice(2), C.clip((byId.get(h) || {}).title || '', 90)]), nCommits,
      perDay, session: sessId, lines: lineIds, replay: replay.has(sid8),
      first: firstPrompt ? C.clip(firstPrompt.text, 220) : '',
    });
  }
  runs.sort((a, b) => a.start.localeCompare(b.start));

  const dayList = [...days.values()].sort((a, b) => a.d.localeCompare(b.d));
  const kindCount = {}; for (const r of runs) kindCount[r.kind] = (kindCount[r.kind] || 0) + 1;
  const placeList = [...places.values()].map(p => ({ id: p.id, label: p.label, kind: p.kind, runs: p.runs, cwds: [...p.cwds].slice(0, 6) }))
    .sort((a, b) => b.runs - a.runs);
  return {
    about: 'VRG Stack — Futásnapló (run log) data. Generated by Stack/lib/runs.js on every stack build; never edit by hand. Quotes job codes: stays out of git.',
    generated: graph.generated || new Date().toISOString(), tz: 'UTC', idleGapMin: IDLE_GAP / 60e3, layers: LAYER_HU,
    kinds: KINDS.map(k => ({ ...k, n: kindCount[k.id] || 0 })), places: placeList, lines,
    days: dayList, runs, live: live(), fallbacks,
    paths: { repo: CFG.sources.repo.replace(/\//g, '\\'), stack: CFG.root.replace(/\//g, '\\') },
  };
}

function write({ graph } = {}) {
  const t0 = Date.now();
  const g = graph || JSON.parse(fs.readFileSync(path.join(CFG.out, 'stack.json'), 'utf8'));
  const data = build(g);
  const body = '// generated by stack.js build (lib/runs.js)\nwindow.RUNS = ' + JSON.stringify(data) + ';\n';
  X.writeAtomic(path.join(CFG.out, 'runs-data.js'), body);
  const k = data.kinds.filter(x => x.n).map(x => x.id + ' ' + x.n).join(', ');
  return { data, msg: `runs: ${data.runs.length} runs on ${data.days.length} days (${k}), ${data.places.length} places, live ${data.live.on ? data.live.sessions.length + ' sessions' : 'off'} · ${Math.round(body.length / 1024)} KB · ${Date.now() - t0} ms → out/runs-data.js` };
}

module.exports = { build, write, placeOf, startFields, IDLE_GAP };
