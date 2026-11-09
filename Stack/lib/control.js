// VRG Stack — Vezérlőterem (Control Room) data for control.html, the A layer's own page.
//
//   out/control-data.js   window.CONTROL = { agents, lanes, briefs, memory, go, modules, schedules, usage, … }
//
// Where the data comes from (all read-only):
//   · the A and U layers as the stack holds them (the graph the build just made, or out/stack.json):
//     node ids, kinds, dates, and every link of an A node grouped by layer;
//   · .claude/agents/*.md frontmatter (name, description, model, effort, tools, maxTurns, memory) and
//     docs/council/ROSTER.md (who sits where: the Board and the Heads, Contractors, Workers, vacant seats);
//   · docs/hub/agents/*.md owner lines (**Felelős:** … · **Indító:** GO …) and tools/brief-state.js --check,
//     run as a child process (STK-P13: requiring it would run its top level, and without --check that
//     rewrites the briefs);
//   · one `git log` over the agents, briefs and GO files for each file's last change;
//   · the memory folder (frontmatter type, modified date, file time) for freshness;
//   · subagent launches from the transcript archive (<project>/<sid>/subagents/*.meta.json: agentType only);
//   · ~/.claude/scheduled-tasks/*/SKILL.md, plus cron and run times where the desktop app keeps them on disk;
//   · out/recordings/index.json for usage per day (runs, tool calls, tokens).
// No settings values, tokens or credentials are copied. Memory bodies appear only as their one-line
// description, clipped (STK-P16). Writes out/control-data.js only (fsx.writeAtomic).
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const CFG = require('../config');
const X = require('./fsx');
const C = require('./common');
const META = require('./meta');

const DAY = 864e5;
const LAYER_HU = Object.fromEntries(META.map(m => [m.code, m.hu])); LAYER_HU.E = 'Pillér';
const ORDER = 'FIQLARCGUE';
// thresholds (STK-P14): an agent is quiet after 14 days with no recorded use; a memory note is old after
// 30 days; a GO file nobody changed or named for 21 days is quiet
const QUIET_AGENT = 14, OLD_MEMORY = 30, MID_MEMORY = 14, QUIET_GO = 21, USAGE_DAYS = 60;

const read = f => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } };
const list = d => { try { return fs.readdirSync(d); } catch { return []; } };
const dayOf = ms => new Date(ms).toISOString().slice(0, 10);
const ageDays = (d, today) => d ? Math.max(0, Math.round((Date.parse(today) - Date.parse(d.slice(0, 10))) / DAY)) : null;

function frontmatter(txt) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(txt); const o = {};
  if (m) for (const l of m[1].split(/\r?\n/)) { const k = /^(\w+):\s*(.*)$/.exec(l); if (k) o[k[1]] = k[2].trim().replace(/^["']|["']$/g, ''); }
  return o;
}

/* the last commit date per file, from one git log over the given paths */
function lastChange(paths) {
  const out = {};
  try {
    const raw = C.git('log', '--no-merges', '--date=short', '--format=@%ad %h', '--name-only', '--', ...paths);
    let cur = null;
    for (const l of raw.split('\n')) {
      if (l.startsWith('@')) { const [d, h] = l.slice(1).split(' '); cur = { d, h }; }
      else if (l && cur && !out[l]) out[l] = cur;
    }
  } catch { /* no git: no dates */ }
  return out;
}

/* ROSTER.md: which seat, contractor or worker each agent is; vacant seats stay as ghosts */
function roster(repo) {
  const txt = read(repo + '/docs/council/ROSTER.md');
  const rows = []; let sec = '';
  for (const l of txt.split(/\r?\n/)) {
    const h = /^##\s+(.+)$/.exec(l); if (h) { sec = h[1]; continue; }
    const r = /^\|\s*(\*\*|\*)([^*|]+)\1\s*\|\s*([^|]*)\|(.*)$/.exec(l); if (!r) continue;
    const role = /Board|Heads/i.test(sec) ? 'seat' : /Contractor/i.test(sec) ? 'contractor' : /Worker/i.test(sec) ? 'worker' : '';
    if (!role) continue;
    const called = (/Called as `([\w-]+)`/.exec(r[4]) || [])[1];
    rows.push({ name: r[2].trim(), title: r[3].trim(), role, vacant: r[1] === '*' || /Vacant/i.test(r[4]), file: called || r[2].trim().toLowerCase(), ask: C.clip(((c => role === 'seat' ? c[1] : c[0])(r[4].split('|').map(x => x.trim()).filter(Boolean)) || ''), 140) });
  }
  return rows;
}

/* subagent launches per agent type, from the archive's meta files (only agentType + file time are read) */
function subagentLaunches() {
  const base = fs.existsSync(path.join(CFG.archive.dir, 'projects')) ? path.join(CFG.archive.dir, 'projects') : CFG.sources.transcripts;
  const by = {};
  for (const proj of list(base)) for (const sid of list(path.join(base, proj))) {
    const sub = path.join(base, proj, sid, 'subagents');
    for (const f of list(sub)) {
      if (!f.endsWith('.meta.json')) continue;
      let t = ''; try { t = JSON.parse(read(path.join(sub, f))).agentType || ''; } catch { continue; }
      if (!t) continue;
      let ms = 0; try { ms = fs.statSync(path.join(sub, f)).mtimeMs; } catch {}
      const x = by[t] || (by[t] = { n: 0, last: '' }); x.n++; const d = ms ? dayOf(ms) : ''; if (d > x.last) x.last = d;
    }
  }
  return by;
}

/* tools/brief-state.js --check as a child process; never without --check (that rewrites the briefs) */
function briefCheck(repo) {
  const script = repo + '/tools/brief-state.js';
  const r = { mode: 'child process: node tools/brief-state.js --check', ran: false, exit: null, ms: 0, problems: {}, summary: '', err: '' };
  if (!fs.existsSync(script)) { r.err = 'tools/brief-state.js not found'; return r; }
  const t0 = Date.now(); let out = '';
  try { out = execFileSync(process.execPath, [script, '--check'], { cwd: repo, encoding: 'utf8', timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'] }); r.exit = 0; }
  catch (e) { if (e && typeof e.stdout === 'string' && e.status != null) { out = e.stdout; r.exit = e.status; } else { r.err = C.clip(String(e && e.message || e), 160); } }
  r.ms = Date.now() - t0; r.ran = r.exit != null;
  for (const l of out.split(/\r?\n/)) {
    const m = /HIBA\s+([\w-]+):\s*(.+)$/.exec(l); if (m) (r.problems[m[1]] || (r.problems[m[1]] = [])).push(m[2].trim());
    else if (/briefs current|problem\(s\)/.test(l)) r.summary = l.trim();
  }
  return r;
}

/* scheduled tasks: the SKILL.md files, plus cron / last / next run where the desktop app keeps them */
function schedules(today) {
  const ST = CFG.sources.claudeHome + '/scheduled-tasks';
  const extra = {};
  const appDir = 'C:/Users/webag/AppData/Roaming/Claude/claude-code-sessions';
  const walk = (d, depth) => { if (depth > 3) return; for (const f of list(d)) { const p = d + '/' + f; if (f === 'scheduled-tasks.json') { try { const j = JSON.parse(read(p)); for (const t of j.scheduledTasks || []) { const id = t.id || t.taskId || t.name; if (id) extra[id] = { cron: t.cronExpression || t.cron || '', enabled: t.enabled !== false, last: t.lastRunAt || '', next: t.nextRunAt || '' }; } } catch {} } else if (depth < 3 && !/\./.test(f)) walk(p, depth + 1); } };
  walk(appDir, 0);
  return list(ST).filter(d => fs.existsSync(`${ST}/${d}/SKILL.md`)).map(d => {
    const txt = read(`${ST}/${d}/SKILL.md`), fm = frontmatter(txt), x = extra[d] || null;
    let ms = 0; try { ms = fs.statSync(`${ST}/${d}/SKILL.md`).mtimeMs; } catch {}
    const cmd = (/^\s*(node|powershell|cmd)\s.+$/m.exec(txt) || [])[0] || '';
    return { id: d, title: fm.name || d, desc: C.clip(fm.description || '', 220), cmd: C.clip(cmd.replace(/[A-Z]:[\\/][^\s]*[\\/]/g, m => m.replace(/^.*[\\/](tools|Planner_VRG_U100)[\\/]/, '$1/')), 120),
      changed: ms ? dayOf(ms) : '', cron: x ? x.cron : '', enabled: x ? x.enabled : null, last: x ? String(x.last).slice(0, 16) : '', next: x ? String(x.next).slice(0, 16) : '',
      when: x ? 'app' : 'none' };
  });
}

function build(graph) {
  const repo = CFG.sources.repo;
  const today = new Date().toISOString().slice(0, 10);
  const byId = new Map(graph.nodes.map(n => [n.id, n]));
  const A = graph.nodes.filter(n => n.layer === 'A');
  const edges = (graph.edges || []).map(e => Array.isArray(e) ? { a: e[0], b: e[1], rel: e[2], v: e[3] } : e);

  // every link of an A node, by the other side's layer; U runs that touched it apart (they are use, not links)
  const links = new Map(), touched = new Map();
  for (const e of edges) for (const [me, ot] of [[e.a, e.b], [e.b, e.a]]) {
    if (me[0] !== 'A' || me[1] !== ':') continue;
    const o = byId.get(ot); if (!o) continue;
    if (o.layer === 'U') { if (o.kind === 'run') (touched.get(me) || touched.set(me, []).get(me)).push([o.id, o.t, e.w || 1]); continue; }
    const L = links.get(me) || links.set(me, []).get(me);
    L.push([o.id, o.layer, C.clip(o.title, 90), e.rel, (o.t || '').slice(0, 10), o.kind || '']);
  }
  const linksOf = id => {
    const seen = new Set();
    return (links.get(id) || []).filter(r => !seen.has(r[0]) && seen.add(r[0]))
      .sort((x, y) => ORDER.indexOf(x[1]) - ORDER.indexOf(y[1]) || (y[4] || '').localeCompare(x[4] || '')).slice(0, 80);
  };
  const vertical = id => (links.get(id) || []).filter(r => !'AUE'.includes(r[1]));
  const runsOf = id => { const r = touched.get(id) || []; return { n: r.length, last: r.reduce((m, x) => x[1] > m ? x[1] : m, '') }; };

  const changed = lastChange(['.claude/agents', 'docs/hub/agents', 'docs/council']
    .concat(list(repo).filter(f => /^GO-[A-Z0-9]+\.md$/.test(f))));

  /* ---- briefs */
  const check = briefCheck(repo);
  const owners = { arnold: 'arnold', charlotte: 'charlotte', elsie: 'elsie', bernard: 'bernard' };
  const briefs = list(repo + '/docs/hub/agents').filter(f => f.endsWith('.md') && !['README.md', 'SESSIONS.md'].includes(f)).map(f => {
    const id = f.slice(0, -3), txt = read(`${repo}/docs/hub/agents/${f}`);
    const own = /\*\*Felelős:\*\*\s*([^·\n]+?)(?:\s*·\s*\*\*Indító:\*\*\s*([^\n]+))?\s*$/m.exec(txt) || [];
    const who = (own[1] || '').trim(), first = (who.split(/[ ,]/)[0] || '').toLowerCase();
    const gitLine = (/^- git (\d{4}-\d\d-\d\d) (\w+)/m.exec(txt) || []);
    const probs = check.problems[id] || [];
    const node = byId.get('A:brief.' + id);
    return { id, nid: node ? node.id : '', title: C.clip((/^#\s+(.+)$/m.exec(txt) || [])[1] || id, 90), owner: who, agent: owners[first] || '',
      go: (own[2] || '').trim(), changed: (changed['docs/hub/agents/' + f] || {}).d || '', stateAt: gitLine[1] || '',
      problems: probs, stale: probs.some(p => /stale/.test(p)), broken: probs.some(p => !/stale/.test(p)), links: node ? linksOf(node.id).slice(0, 40) : [] };
  }).sort((a, b) => a.agent.localeCompare(b.agent) || a.id.localeCompare(b.id));

  /* ---- agents (frontmatter + roster) */
  const launches = subagentLaunches();
  const ros = roster(repo);
  const rosBy = new Map(ros.map(r => [r.file, r]));
  const agents = list(repo + '/.claude/agents').filter(f => f.endsWith('.md')).map(f => {
    const id = f.slice(0, -3), txt = read(`${repo}/.claude/agents/${f}`), fm = frontmatter(txt), nid = 'A:agent.' + id;
    const desc = fm.description || '';
    const r = rosBy.get(id);
    const seat = (/Council seat ([IVX]+)/.exec(desc) || [])[1] || '';
    const role = id === 'bernard' ? 'hand' : r ? r.role : /\(contractor\)/i.test(desc) ? 'contractor' : /\(worker\)/i.test(desc) ? 'worker' : 'other';
    const display = r ? r.name : (/^([A-Z][\w]+),/.exec(desc) || [])[1] || id;
    const sub = launches[id] || { n: 0, last: '' };
    const use = runsOf(nid);
    const last = [sub.last, use.last].filter(Boolean).sort().pop() || '';
    const quietDays = last ? ageDays(last, today) : null;
    const flags = [];
    if (quietDays == null) flags.push('never'); else if (quietDays > QUIET_AGENT) flags.push('quiet');
    const own = briefs.filter(b => b.agent === id);
    if (own.some(b => b.stale || b.broken)) flags.push('stale-briefs');
    return { id, nid: byId.has(nid) ? nid : '', name: display, title: r ? r.title : (/^[^,]+,\s*([^,(]+)/.exec(desc) || [])[1] || '', role, seat,
      desc: C.clip(desc, 300), model: fm.model || '', effort: fm.effort || '', maxTurns: +fm.maxTurns || null, memory: fm.memory || '',
      omitClaudeMd: fm.omitClaudeMd === 'true', tools: (fm.tools || '').split(',').map(s => s.trim()).filter(Boolean),
      allTools: !fm.tools, path: '.claude/agents/' + f, changed: (changed['.claude/agents/' + f] || {}).d || '', charter: fs.existsSync(`${repo}/docs/council/agents/${f}`) ? 'docs/council/agents/' + f : '',
      launches: sub, touched: use, last, quietDays, flags, briefs: own.map(b => b.id), links: byId.has(nid) ? linksOf(nid) : [] };
  });
  // seats in the roster with no agent file (Stubbs, Lee): ghosts in the flow
  for (const r of ros) if (r.vacant && !agents.some(a => a.id === r.file)) agents.push({ id: r.file, nid: '', name: r.name, title: r.title, role: r.role, seat: '', desc: 'Üres szék (ROSTER.md): ' + r.title, vacant: true, tools: [], flags: ['vacant'], briefs: [], links: [], launches: { n: 0, last: '' }, touched: { n: 0, last: '' }, last: '', quietDays: null });
  const ROLE_ORDER = { hand: 0, seat: 1, contractor: 2, worker: 3, other: 4 };
  const SEAT_N = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6 };
  agents.sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || (a.vacant ? 1 : 0) - (b.vacant ? 1 : 0) || (SEAT_N[a.seat] || 9) - (SEAT_N[b.seat] || 9) || a.name.localeCompare(b.name));

  /* ---- memory freshness */
  const memory = A.filter(n => n.kind.startsWith('memory')).map(n => {
    const slug = n.id.slice(6), file = CFG.sources.memory + '/' + slug + '.md', txt = read(file);
    const type = (/^\s+type:\s*(\w+)/m.exec(txt) || /^type:\s*(\w+)/m.exec(txt) || [])[1] || 'memory';
    let ms = 0; try { ms = fs.statSync(file).mtimeMs; } catch {}
    const mod = (/modified:\s*(\d{4}-\d\d-\d\d)/.exec(txt) || [])[1] || '';
    const t = mod || (ms ? dayOf(ms) : '');
    const age = ageDays(t, today);
    const ls = linksOf(n.id), vert = vertical(n.id);
    const mem = ls.filter(r => r[0].startsWith('A:mem.')).length;
    const flags = [];
    if (!vert.length) flags.push('unlinked');
    if (age != null && age > OLD_MEMORY) flags.push('old');
    if (!mod) flags.push('nodate');
    if (!txt) flags.push('missing');
    const vl = {}; for (const r of vert) vl[r[1]] = (vl[r[1]] || 0) + 1;
    return { id: slug, nid: n.id, type, desc: C.clip(n.brief, 160), t, dated: mod ? 1 : 0, age, fresh: age == null ? 'unknown' : age <= MID_MEMORY ? 'fresh' : age <= OLD_MEMORY ? 'mid' : 'old',
      mem, vert: vert.length, vl, flags, links: ls, used: runsOf(n.id) };
  }).sort((a, b) => (b.age == null ? -1 : b.age) - (a.age == null ? -1 : a.age) || a.id.localeCompare(b.id));

  /* ---- GO codephrases */
  const claudeMd = read(repo + '/CLAUDE.md').split(/\r?\n/);
  const goLine = code => {
    const i = claudeMd.findIndex(l => l.startsWith('- **`GO ' + code + '`**')); if (i < 0) return '';
    const out = [claudeMd[i]]; for (let j = i + 1; j < claudeMd.length && /^\s{2,}\S/.test(claudeMd[j]); j++) out.push(claudeMd[j].trim());
    return C.clip(out.join(' ').replace(/^- \*\*`GO [A-Z0-9]+`\*\*\s*—\s*/, '').replace(/\*\*/g, '').replace(/`/g, '').replace(/^GO-[A-Z0-9]+\.md:\s*/, ''), 260);
  };
  const go = A.filter(n => n.kind.startsWith('codephrase')).map(n => {
    const live = n.kind === 'codephrase (live)';
    const base = n.id.replace(/^A:(go|goarch)\./, ''), code = base.slice(3).replace(/-\d{4}-\d\d-\d\d$/, '');
    const file = live ? base + '.md' : 'docs/go-archive/' + base + '.md';
    const ls = linksOf(n.id);
    const ment = ls.filter(r => r[3] === 'ref:go');
    const byL = {}; for (const r of ment) byL[r[1]] = (byL[r[1]] || 0) + 1;
    const lastMention = ment.reduce((m, r) => r[4] > m ? r[4] : m, '');
    const ch = live ? (changed[file] || {}).d || '' : '';
    const lastAny = [ch, lastMention].filter(Boolean).sort().pop() || '';
    const flags = [];
    if (live && (!lastAny || ageDays(lastAny, today) > QUIET_GO)) flags.push('quiet');
    if (live && !goLine(code)) flags.push('not-in-claude-md');
    const bs = briefs.filter(b => new RegExp('\\bGO ' + code + '\\b').test(b.go)).map(b => b.id);
    if (bs.some(id => { const b = briefs.find(x => x.id === id); return b.stale || b.broken; })) flags.push('stale-briefs');
    return { code, nid: n.id, live: live ? 1 : 0, file, title: C.clip(n.title, 90), brief: C.clip(n.brief, 200), line: live ? goLine(code) : '', changed: ch,
      mentions: ment.length, byLayer: byL, lastMention, briefs: bs, flags, links: ls };
  }).sort((a, b) => b.live - a.live || a.code.localeCompare(b.code));

  /* ---- module map: every kind of A node, with what is stale in it */
  const KIND_HU = { memory: 'Memória', agent: 'Ügynökök', brief: 'Briefek', 'codephrase (live)': 'GO kódszavak', 'codephrase (archived)': 'GO archívum',
    'house rules (CLAUDE.md)': 'Házirend (CLAUDE.md)', 'council doc': 'Tanács dokumentumai', 'workflow doc': 'Munkafolyamat', 'agent tool': 'Ügynök-eszközök',
    'workflow kit': 'Workflow Kit', 'scheduled task': 'Ütemezett feladat', generator: 'Térkép-generátorok' };
  const groups = new Map();
  for (const n of A) { const k = n.kind.startsWith('memory') ? 'memory' : n.kind; (groups.get(k) || groups.set(k, []).get(k)).push(n); }
  const modules = [...groups].map(([k, ns]) => {
    const unlinked = ns.filter(n => !vertical(n.id).length).length;
    return { kind: k, hu: KIND_HU[k] || k, n: ns.length, unlinked, stale: ns.filter(n => n.stale).length,
      used: ns.filter(n => (touched.get(n.id) || []).length).length,
      items: ns.map(n => [n.id, C.clip(n.title, 70), n.path || '', (n.t || '').slice(0, 10), vertical(n.id).length, (touched.get(n.id) || []).length])
        .sort((a, b) => b[5] - a[5] || b[4] - a[4]).slice(0, 120) };
  }).sort((a, b) => b.n - a.n);

  /* ---- usage per day (U layer): tokens and steps are put on the day each step happened (STK-P15), so a
     session that runs over several days counts on each of them; read from out/recordings/<sid8>.jsonl */
  const ix = X.readJson(path.join(CFG.out, 'recordings', 'index.json'), { sessions: {} }) || { sessions: {} };
  const REC = require('./record');
  const days = new Map();
  const dayRow = d => days.get(d) || days.set(d, { d, runs: 0, steps: 0, calls: 0, commits: 0, sub: 0, tin: 0, tout: 0, tcr: 0, tcw: 0, top: new Map() }).get(d);
  for (const s of Object.values(ix.sessions || {})) {
    if (!s || !s.sid) continue;
    let steps = []; try { steps = REC.readRecording(s.sid.slice(0, 8)) || []; } catch { steps = []; }
    if (!steps.length && s.start && s.tokens) steps = [{ t: s.start, tok: s.tokens, span: 'chat' }];
    for (const st of steps) {
      const d = String(st.t || '').slice(0, 10); if (!d) continue;
      const x = dayRow(d), tk = st.tok || {};
      let r = x.top.get(s.sid);
      if (!r) { r = [s.sid, C.clip(s.title, 80), 0, 0, 0, 0, 0, String(s.project || '').replace(/^[A-Z]--/, '').slice(-40)]; x.top.set(s.sid, r); x.runs++; }
      x.steps++; r[4]++;
      if (st.span === 'execute_tool' || st.span === 'invoke_agent') { x.calls++; r[5]++; }
      if (st.span === 'invoke_agent') x.sub++;
      if (st.span === 'commit') { x.commits++; r[6]++; }
      x.tin += tk.in || 0; x.tout += tk.out || 0; x.tcr += tk.cr || 0; x.tcw += tk.cw || 0;
      r[2] += (tk.in || 0) + (tk.out || 0) + (tk.cw || 0); r[3] += tk.cr || 0;
    }
  }
  const lastDays = [];
  const end = Date.parse(today), start = end - (USAGE_DAYS - 1) * DAY;
  for (let t = start; t <= end; t += DAY) { const d = dayOf(t); const x = days.get(d) || dayRow(d); lastDays.push({ ...x, top: [...x.top.values()].sort((a, b) => b[2] - a[2]).slice(0, 15) }); }
  const older = [...days.keys()].filter(d => d < dayOf(start)).length;

  const sch = schedules(today);
  const count = f => agents.filter(f).length;
  return {
    about: 'VRG Stack — Vezérlőterem (Control Room) data. Generated by Stack/lib/control.js on every stack build; never edit by hand.',
    generated: graph.generated || new Date().toISOString(), today, layers: LAYER_HU,
    thresholds: { quietAgent: QUIET_AGENT, oldMemory: OLD_MEMORY, midMemory: MID_MEMORY, quietGo: QUIET_GO, usageDays: USAGE_DAYS },
    agents, briefs, briefCheck: { mode: check.mode, ran: check.ran, exit: check.exit, ms: check.ms, summary: check.summary, err: check.err },
    memory, go, modules, schedules: sch, usage: lastDays, usageOlderDays: older, recordedTo: [...days.keys()].filter(d => days.get(d).steps).sort().pop() || '',
    counts: { agents: count(a => !a.vacant), vacant: count(a => a.vacant), quiet: count(a => !a.vacant && (a.flags.includes('quiet') || a.flags.includes('never'))),
      briefs: briefs.length, staleBriefs: briefs.filter(b => b.stale).length, brokenBriefs: briefs.filter(b => b.broken).length,
      memory: memory.length, oldMemory: memory.filter(m => m.flags.includes('old')).length, unlinkedMemory: memory.filter(m => m.flags.includes('unlinked')).length,
      go: go.filter(g => g.live).length, goArchived: go.filter(g => !g.live).length, quietGo: go.filter(g => g.flags.includes('quiet')).length,
      schedules: sch.length, tokens7: lastDays.slice(-7).reduce((s, d) => s + d.tin + d.tout + d.tcw, 0), runs7: lastDays.slice(-7).reduce((s, d) => s + d.runs, 0) },
  };
}

function write({ graph } = {}) {
  const g = graph || JSON.parse(fs.readFileSync(path.join(CFG.out, 'stack.json'), 'utf8'));
  const data = build(g);
  X.writeAtomic(path.join(CFG.out, 'control-data.js'), '// generated by stack.js build (lib/control.js)\nwindow.CONTROL = ' + JSON.stringify(data) + ';\n');
  const c = data.counts;
  return { data, msg: `control: ${c.agents} agents (${c.quiet} quiet, ${c.vacant} vacant), ${c.briefs} briefs (${c.staleBriefs} stale${data.briefCheck.ran ? '' : ', brief-state check did not run'}), ${c.memory} memory notes (${c.oldMemory} old, ${c.unlinkedMemory} unlinked), ${c.go} GO, ${c.schedules} schedules → out/control-data.js` };
}

module.exports = { build, write };
