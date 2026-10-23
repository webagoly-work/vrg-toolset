#!/usr/bin/env node
// mcp.js — VRG Kódváros as an MCP server (WP-C10, CITY-D8 A/A/A; God's Eye View idea 12: tools
// defined once, and "show me" answers come back as a view link). Zero dependencies: JSON-RPC 2.0
// over stdio, one message per line. stdout carries protocol only; diagnostics go to stderr.
//
//   claude mcp add kodvaros -- node <repo>/CodeCity/mcp.js [repo=the repo this file is in] [--dist <dir>]
//
// Tools: city_summary · city_query · city_file · city_hotspots · city_view_link (read-only) and
// city_rescan, which runs scan.js and writes only <dist>/<name>.city.json and <dist>/<name>.html.
// Never --sessions (CITY-D8a A): agent-session data is baked in only by a person running scan.js.
// Answers are computed by the page's own query code (core.js), and every answer carries a
// file:/// link to the city page with the view set (#q= / #sel= / #lens= / #t= …).
'use strict';
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const { openCity } = require('./core.js');

const argv = process.argv.slice(2);
const opt = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const REPO = path.resolve(argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--dist') || path.join(__dirname, '..'));
const DIST = path.resolve(opt('--dist') || path.join(__dirname, 'dist'));
const NAME = path.basename(REPO).replace(/[^\w.-]+/g, '_');
const CITY_JSON = path.join(DIST, `${NAME}.city.json`), PAGE = path.join(DIST, `${NAME}.html`);
const VERSION = '1.0.0', PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const LENSES = ['alap', 'ho', 'kor', 'ugynok', 'tulaj', 'nyelv'];

// ---- the city: scanned on first use, reloaded when the file changes
let core = null, coreMtime = 0;
function rescan() {
  fs.mkdirSync(DIST, { recursive: true });
  const out = execFileSync(process.execPath, [path.join(__dirname, 'scan.js'), REPO, '--out', CITY_JSON, '--html', PAGE],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 26 });
  core = null;
  return out.trim();
}
function city() {
  let note = '';
  if (!fs.existsSync(CITY_JSON) || !fs.existsSync(PAGE)) { rescan(); note = 'First use: the repository was scanned now.'; }
  const m = fs.statSync(CITY_JSON).mtimeMs;
  if (!core || m !== coreMtime) { core = openCity(JSON.parse(fs.readFileSync(CITY_JSON, 'utf8'))); coreMtime = m; }
  core.at(core.last);
  return { c: core, note };
}
function staleness(c) {
  let head = '';
  try { head = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { /* not a repo */ }
  const days = Math.floor((Date.now() - Date.parse(c.city.repo.scannedAt)) / 86400000);
  const r = c.city.repo;
  let s = `${r.name} @ ${r.head || '—'} (${r.branch || '—'}), scanned ${r.scannedAt.slice(0, 16).replace('T', ' ')} UTC (${days} d ago)`;
  if (head && r.head && !head.startsWith(r.head) && !r.head.startsWith(head)) s += ` — STALE: the repo is now at ${head}; call city_rescan`;
  return s;
}

// ---- links: the page reads exactly these keys (04-ui applyView)
function link(params = {}) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  const hash = q.toString();
  return 'file:///' + PAGE.replace(/\\/g, '/').split('/').map(encodeURI).join('/') + (hash ? '#' + hash : '');
}
// a commit by hash prefix (the page's #t= / #base= use the 7-char hash)
function commitAt(c, ref) {
  if (ref === undefined || ref === null || ref === '') return null;
  const i = c.city.commits.findIndex(k => k[4].startsWith(String(ref).slice(0, 7)) || String(ref).startsWith(k[4]));
  if (i < 0) throw new Error(`no commit ${ref} in the city (it knows ${c.city.commits.length}, newest ${c.city.commits.length ? c.city.commits[c.city.commits.length - 1][4] : '—'})`);
  return i;
}
// a file by exact path, else by a unique path suffix / substring
function fileBy(c, p) {
  const files = c.city.files, norm = String(p).replace(/\\/g, '/').replace(/^\.\//, '');
  let i = files.findIndex(f => f.p === norm);
  if (i >= 0) return i;
  const cand = files.map((f, j) => j).filter(j => files[j].p.endsWith('/' + norm) || files[j].p.toLowerCase().includes(norm.toLowerCase()));
  if (cand.length === 1) return cand[0];
  throw new Error(cand.length ? `"${p}" matches ${cand.length} files: ${cand.slice(0, 12).map(j => files[j].p).join(', ')}${cand.length > 12 ? ', …' : ''}`
    : `no file "${p}" in the city`);
}
const day = (c, ci) => { const k = c.city.commits[ci]; return k ? `${new Date(k[0] * 1000).toISOString().slice(0, 10)} ${k[4]}` : '—'; };
const pct = x => Math.round(100 * x) + ' %';
const alive = (c, i) => c.stateAt(c.city.files[i], i, c.T)[0] > 0;

// ---- tools
const TOOLS = [
  {
    name: 'city_summary',
    description: 'Overview of the repository as a Kódváros code city: size, history, authors, agent share, biggest districts (folders), landmarks (most-imported files), hottest files, and whether the scan is stale. Returns a link that opens the city.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    run() {
      const { c, note } = city(), files = c.city.files, commits = c.city.commits;
      const live = files.filter((f, i) => alive(c, i)).length;
      const agentCommits = commits.filter(k => k[2] >= 0).length;
      const byAuthor = c.city.authors.map((a, i) => [a, commits.filter(k => k[1] === i).length]).sort((a, b) => b[1] - a[1]);
      const heat = c.heatCounts(), hotMin = Math.max(2, Math.max(1, ...heat) * 0.5);
      const districts = [...c.model.root.dirs.values()].map(d => {
        const s = c.dirStats(d); let hot = 0;
        (function walk(x) { for (const f of x.files) if (alive(c, f.i) && heat[f.i] >= hotMin) hot++; x.dirs.forEach(walk); })(d);
        return [d.path, s.files, s.loc, hot];
      }).sort((a, b) => b[2] - a[2]).slice(0, 10);
      const landmarks = files.map((f, i) => [i, c.importers(i).length]).filter(([i, n]) => n >= 3 && alive(c, i)).sort((a, b) => b[1] - a[1]).slice(0, 6);
      const hottest = files.map((f, i) => i).filter(i => alive(c, i) && heat[i] > 0).sort((a, b) => heat[b] - heat[a]).slice(0, 6);
      return [note, staleness(c),
        `${live} files (+${files.length - live} deleted, kept as ghosts) · ${commits.length} commits · ${c.city.authors.length} authors`,
        `agent-assisted commits: ${agentCommits} (${commits.length ? pct(agentCommits / commits.length) : '—'})${c.city.agents.length ? ' — ' + c.city.agents.join(', ') : ''}`,
        `authors: ${byAuthor.slice(0, 8).map(([a, n]) => `${a} ${n}`).join(' · ')}`,
        '', 'districts (top-level folders) by lines: path · files · lines · hot files',
        ...districts.map(([p, n, loc, hot]) => `  ${p}/ · ${n} · ${loc} · ${hot}`),
        '', 'landmarks (most imported): ' + (landmarks.map(([i, n]) => `${files[i].p} (${n})`).join(' · ') || '—'),
        'hottest (commits in the recent 15 % of history): ' + (hottest.map(i => `${files[i].p} (${heat[i]})`).join(' · ') || '—'),
        '', `open the city: ${link()}`].filter(x => x !== null).join('\n').replace(/^\n/, '');
    },
  },
  {
    name: 'city_query',
    description: 'Ask the code city a question in its query language (Hungarian keywords, combined with AND) — the same parser as the page\'s query bar. Words: a path/name fragment (Planner, src/ui); a language (javascript, html, md, nyelv:css); "forró" = hot (heavy recent churn); "ügynök" = touched by an AI agent, "csak claude" = only agent commits, "ember" = no agent record; "régi 30 nap" = untouched for 30 days (nap/hét/hónap/év), "friss 2 hét" = touched within; ">500 sor", "<20 sor", ">5 commit"; sort: legnagyobb (lines, default), legaktívabb (commits), legimportáltabb (importers), legrégebbi, legfrissebb; "top 20" = how many (max 200). Example: "forró ügynök legaktívabb top 10". Returns the matching files and a link that opens the city with them bracketed.',
    inputSchema: {
      type: 'object', additionalProperties: false, required: ['q'],
      properties: {
        q: { type: 'string', description: 'The query, e.g. "Planner javascript >500 sor legaktívabb".' },
        at: { type: 'string', description: 'Optional commit hash (prefix): answer as the city stood at that commit.' },
      },
    },
    run({ q, at }) {
      const { c, note } = city();
      const T = commitAt(c, at);
      if (T !== null) c.at(T);
      const r = c.runQuery(String(q)), files = c.city.files;
      return [note, staleness(c), (T !== null ? `at commit ${day(c, T)} — ` : '') + r.summary,
        ...r.items.map((i, n) => `${n + 1}. ${files[i].p} — ${r.metric(i)} · ${files[i].lang} · agent share ${pct(c.agentShareOf(i))}`),
        '', `open in the city: ${link({ q, t: T !== null && T < c.last ? c.city.commits[T][4] : '' })}`].filter(Boolean).join('\n');
    },
  },
  {
    name: 'city_file',
    description: 'Everything the city knows about one file: language, lines, commits, first and last change, main author, agent share, recent heat, what it imports, what imports it, and the files that change together with it (co-change). Accepts an exact repo path or a unique fragment. Returns a link that opens the city with the file selected.',
    inputSchema: {
      type: 'object', additionalProperties: false, required: ['path'],
      properties: {
        path: { type: 'string', description: 'Repo-relative path, or a fragment that names one file.' },
        at: { type: 'string', description: 'Optional commit hash (prefix): the file as it stood then.' },
      },
    },
    run({ path: p, at }) {
      const { c, note } = city();
      const T = commitAt(c, at);
      if (T !== null) c.at(T);
      const i = fileBy(c, p), f = c.city.files[i], files = c.city.files, heat = c.heatCounts();
      const atT = c.fileAtT(f);
      const imp = (f.imp || []).map(j => files[j].p), by = c.importers(i).map(j => files[j].p);
      const nb = c.neighboursOf(i).map(([j, n, share]) => `${files[j].p} (${n}×, ${pct(share)})`);
      return [note, staleness(c), f.p + (f.gone ? `  [deleted at ${day(c, f.goneAt)} — a ghost in the city]` : ''),
        `language ${f.lang} · ${f.loc} lines · ${f.n} commits${atT ? ` · at ${day(c, T)}: ${atT[0]} commits, ~${atT[1]} lines` : ''}`,
        `first ${day(c, f.born)} · last ${day(c, f.last)} · main author ${f.own >= 0 ? c.city.authors[f.own] : '—'}`,
        `agent share ${f.n ? pct(f.ag / f.n) : '—'} · recent heat ${heat[i]} commits`,
        `imports (${imp.length}): ${imp.join(', ') || '—'}`,
        `imported by (${by.length}): ${by.slice(0, 20).join(', ') || '—'}${by.length > 20 ? ', …' : ''}`,
        `changes together with: ${nb.join(', ') || '— (needs at least 2 shared commits)'}`,
        '', `open in the city: ${link({ sel: f.gone ? '' : f.p, t: T !== null && T < c.last ? c.city.commits[T][4] : '' })}`].filter(Boolean).join('\n');
    },
  },
  {
    name: 'city_hotspots',
    description: 'Where the work is: files with the most commits in the recent part of history (the last 15 % of commits), with lines and agent share. agent=true keeps only files AI agents worked on — "where is the agent rework?". Returns a link that opens the city in the heat (or agent) look with the hotspots bracketed.',
    inputSchema: {
      type: 'object', additionalProperties: false,
      properties: {
        limit: { type: 'integer', minimum: 1, maximum: 100, description: 'How many (default 10).' },
        agent: { type: 'boolean', description: 'Only files with agent-assisted commits.' },
        under: { type: 'string', description: 'Only files under this folder / path fragment.' },
      },
    },
    run({ limit = 10, agent = false, under = '' }) {
      const { c, note } = city(), files = c.city.files, heat = c.heatCounts();
      const frag = String(under).replace(/\\/g, '/').toLowerCase();
      const hits = files.map((f, i) => i).filter(i => alive(c, i) && heat[i] > 0 && (!agent || c.agentShareOf(i) > 0) && (!frag || files[i].p.toLowerCase().includes(frag)))
        .sort((a, b) => heat[b] - heat[a] || c.agentShareOf(b) - c.agentShareOf(a)).slice(0, Math.min(100, limit));
      const q = ['forró', agent ? 'ügynök' : '', frag, 'legaktívabb', `top ${limit}`].filter(Boolean).join(' ');
      return [note, staleness(c), `${hits.length ? '' : 'no '}hotspots${agent ? ' with agent work' : ''}${frag ? ` under "${under}"` : ''} — heat = commits in the last ${Math.max(3, Math.round((c.last + 1) * 0.15))} of ${c.last + 1}`,
        ...hits.map((i, n) => `${n + 1}. ${files[i].p} — heat ${heat[i]} · ${files[i].loc} lines · agent share ${pct(c.agentShareOf(i))}`),
        '', `open in the city: ${link({ lens: agent ? 'ugynok' : 'ho', q })}`].filter(Boolean).join('\n');
    },
  },
  {
    name: 'city_view_link',
    description: 'Build a link that opens the code city in a given view, to hand to the user. Every parameter is optional: q (a city_query query, results bracketed), sel (a file to select and fly to), lens (alap | ho = heat | kor = age | ugynok = agent | tulaj = owner | nyelv = language), t (show the city at this commit), base (compare against this commit: grew/shrank/new/deleted), follow (an author or agent name: draw their trail), roads (true = all import roads), tour ("auto" = play the automatic tour).',
    inputSchema: {
      type: 'object', additionalProperties: false,
      properties: {
        q: { type: 'string' }, sel: { type: 'string' }, lens: { type: 'string', enum: LENSES },
        t: { type: 'string' }, base: { type: 'string' }, follow: { type: 'string' },
        roads: { type: 'boolean' }, tour: { type: 'string' },
      },
    },
    run(a) {
      const { c, note } = city(), params = {}, said = [];
      if (a.q) { params.q = a.q; said.push(c.runQuery(a.q).summary); }
      if (a.sel) { const i = fileBy(c, a.sel); params.sel = c.city.files[i].p; said.push('selected ' + params.sel); }
      if (a.lens) { if (!LENSES.includes(a.lens)) throw new Error(`lens must be one of ${LENSES.join(', ')}`); params.lens = a.lens; }
      if (a.t) { const T = commitAt(c, a.t); params.t = c.city.commits[T][4]; said.push('at ' + day(c, T)); }
      if (a.base) { const B = commitAt(c, a.base); params.base = c.city.commits[B][4]; said.push('compared with ' + day(c, B)); }
      if (a.follow) {
        const w = String(a.follow).toLowerCase();
        let k = c.city.agents.findIndex(x => x.toLowerCase() === w), kind = 'g';
        if (k < 0) { kind = 'a'; k = c.city.authors.findIndex(x => x.toLowerCase() === w); }
        if (k < 0) k = c.city.authors.findIndex(x => x.toLowerCase().includes(w));
        if (k < 0) throw new Error(`no author or agent "${a.follow}" (authors: ${c.city.authors.join(', ')}; agents: ${c.city.agents.join(', ') || '—'})`);
        params.follow = kind + k; said.push(`following ${kind === 'g' ? c.city.agents[k] : c.city.authors[k]}`);
      }
      if (a.roads) params.roads = 1;
      if (a.tour) params.tour = a.tour;
      return [note, said.join(' · ') || 'the whole city', link(params)].filter(Boolean).join('\n');
    },
  },
  {
    name: 'city_rescan',
    description: 'Re-scan the repository (git history + files on disk) into the city. Writes only the city files in CodeCity/dist (<name>.city.json and <name>.html); never reads agent transcripts. Use when city_summary says STALE.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    run() { const out = rescan(); const { c } = city(); return [out, staleness(c), `open the city: ${link()}`].join('\n'); },
  },
];

// ---- JSON-RPC over stdio
const send = msg => process.stdout.write(JSON.stringify(msg) + '\n');
const reply = (id, result) => send({ jsonrpc: '2.0', id, result });
const fail = (id, code, message) => send({ jsonrpc: '2.0', id, error: { code, message } });

function handle(msg) {
  const { id, method, params = {} } = msg, isRequest = id !== undefined && id !== null;
  if (method === 'initialize') {
    const v = PROTOCOLS.includes(params.protocolVersion) ? params.protocolVersion : PROTOCOLS[0];
    return reply(id, { protocolVersion: v, capabilities: { tools: {} }, serverInfo: { name: 'kodvaros', title: 'VRG Kódváros', version: VERSION },
      instructions: 'Kódváros is this repository as a 3D code city. Answer questions about where code, work, churn and AI-agent work are with these tools, and give the user the returned file:/// link: it opens the city on exactly that view.' });
  }
  if (method === 'ping') return reply(id, {});
  if (method === 'tools/list') return reply(id, { tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
  if (method === 'tools/call') {
    const t = TOOLS.find(x => x.name === params.name);
    if (!t) return fail(id, -32602, `unknown tool ${params.name}`);
    try { return reply(id, { content: [{ type: 'text', text: t.run(params.arguments || {}) }] }); }
    catch (e) { return reply(id, { content: [{ type: 'text', text: 'Error: ' + (e.stderr ? String(e.stderr).trim() || e.message : e.message) }], isError: true }); }
  }
  if (isRequest) fail(id, -32601, `method not found: ${method}`);   // notifications (initialized, cancelled) need no answer
}

let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  buf += chunk;
  let nl;
  while ((nl = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { fail(null, -32700, 'parse error'); continue; }
    try { handle(msg); } catch (e) { if (msg.id !== undefined) fail(msg.id, -32603, e.message); process.stderr.write(e.stack + '\n'); }
  }
});
// on stdin end the process exits by itself once pending replies are flushed (no process.exit: on
// Windows a pipe write is asynchronous, and exiting early would cut the last answers off)
