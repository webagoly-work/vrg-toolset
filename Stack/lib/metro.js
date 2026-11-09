// VRG Stack — Vonaltérkép data for metro.html, the DevLog layer's metro map (layer L).
//
//   out/metro-data.js   window.METRO = { lanes, lines, st, runs, nodes, … }
//
// Where the data comes from (read-only):
//   · the L layer as the stack holds it (the graph the build just made, or out/stack.json): the set of lines
//     and sessions, their titles, and every link from a session to another layer (commits, folders,
//     documents, decisions, agentic files, runs). The line ↔ line relations come from the same graph:
//     fork, next, feeds, absorbed-by, overruled-by (STK-P37).
//   · the DevLog sources themselves (notes/devlog/lines.js, sessions.json) for what the graph drops: the
//     time of every prompt and which line it belongs to. A session split across lines (ASSIGN spans) gives
//     one station per line, timed by its own prompts there, exactly as notes/devlog/build.js slices it:
//     a desktop fork's replayed prompts are dropped, ASSIGN null is noise, an unassigned session goes to
//     the "unsorted" line (STK-P38).
//   · notes/devlog/threads.js (the Thread Board's data) for the thread a line continues: the "Folytatás"
//     prompt has the Thread Board's item-prompt shape (STK-P41).
//   · whether notes/devlog/sessions/<line>/CLAUDE.md and lines/<line>.md exist (the prompt never names a
//     file that is not there).
//   · out/recordings/index.json: which sessions have a recorded run (replay.html), and the recorded runs
//     that started after the newest harvested session, which no line holds yet (STK-P40).
// The data quotes client job codes (line names, session titles), so out/ keeps it out of git.
// Writes out/metro-data.js only (fsx.writeAtomic). Runs as the optional stage `metro`, or alone with
// `stack.js metro`.
'use strict';

const fs = require('fs');
const path = require('path');
const CFG = require('../config');
const X = require('./fsx');
const C = require('./common');
const META = require('./meta');

const LAYER_HU = Object.fromEntries(META.map(m => [m.code, m.hu])); LAYER_HU.E = 'Pillér';
const DEVLOG = C.NOTES + '/devlog';
const DAY = 86400e3;
const QUIET_DAYS = 5;                     // STK-P39: the Thread Board's and DevLog's STALE_DAYS
const LINK_LAYERS = 'RCGQAIF';            // what a station "touched", in this order
const WORD = {                            // the Thread Board's words (board.js), for the copied prompt
  active: ['●', 'Active'], waiting: ['◐', 'Waiting on you'], parked: ['◌', 'Parked'], ended: ['◼', 'Ended'],
  overruled: ['✕', 'Overruled'], absorbed: ['⤳', 'Absorbed'], recurring: ['↻', 'Recurring'], personal: ['·', 'Personal'],
};
const HU = {                              // the page's own words
  active: 'aktív', waiting: 'rád vár', parked: 'parkol', ended: 'véget ért', overruled: 'felülírva',
  absorbed: 'beolvadt', recurring: 'visszatérő', personal: 'személyes',
};
const OPEN = new Set(['active', 'waiting', 'parked', 'recurring']);   // board.js: these get a session brief
const win = p => String(p).replace(/\//g, '\\');
const fresh = f => { delete require.cache[require.resolve(f)]; return require(f); };
const localDay = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const md = t => localDay(t).slice(5);     // 'MM-DD', the board's "last active"

/* ---- one station per (session, line), from the session's own prompts on that line (build.js rules) */
function stations(SESS, ASSIGN, lineIds) {
  const byId = new Map(SESS.map(s => [s.id, s]));
  const assignFor = id => { const k = Object.keys(ASSIGN).find(p => id.startsWith(p)); return k === undefined ? undefined : ASSIGN[k]; };
  const out = [];
  let noise = 0, unknown = [];
  for (const s of SESS) {
    const parent = s.forkOf && byId.get(s.forkOf);
    const seen = new Set(parent ? parent.prompts.map(p => p.t + p.text) : []);
    const own = (s.prompts || []).map((p, i) => Object.assign({ i }, p)).filter(p => !seen.has(p.t + p.text));
    if (!own.length) continue;
    let a = assignFor(s.id);
    if (a === null) { noise++; continue; }
    if (a === undefined) a = 'unsorted';
    const spans = typeof a === 'string' ? [[0, a]] : a;
    const lineAt = i => { let l = spans[0][1]; for (const [from, id] of spans) if (i >= from) l = id; return l; };
    const per = new Map();
    for (const p of own) {
      let line = lineAt(p.i);
      if (line !== 'unsorted' && !lineIds.has(line)) { unknown.push(s.id.slice(0, 8) + '→' + line); line = 'unsorted'; }
      const t = Date.parse(p.t); if (!isFinite(t)) continue;
      const g = per.get(line) || per.set(line, { line, t0: t, t1: t, n: 0, files: new Set() }).get(line);
      g.t0 = Math.min(g.t0, t); g.t1 = Math.max(g.t1, t); g.n++;
      for (const f of p.files || []) g.files.add(C.normPath(f));
    }
    for (const g of per.values()) out.push({ sid: s.id.slice(0, 8), s, ...g, lines: [...per.keys()] });
  }
  out.sort((a, b) => a.t0 - b.t0);
  return { list: out, noise, unknown };
}

function build(graph) {
  const now = Date.now();
  const { LANES, LINES, ASSIGN } = fresh(DEVLOG + '/lines.js');
  const SESS = JSON.parse(fs.readFileSync(DEVLOG + '/sessions.json', 'utf8'));
  let T = null; try { T = fresh(DEVLOG + '/threads.js'); } catch { T = null; }
  let REC = { sessions: {} }; try { REC = JSON.parse(fs.readFileSync(path.join(CFG.out, 'recordings', 'index.json'), 'utf8')); } catch { /* no recordings yet */ }

  /* the graph: L nodes, and the links of every session node */
  const nodes = new Map(graph.nodes.map(n => [n.id, n]));
  const lineIds = new Set(LINES.map(l => l.id));
  const rel = [];                                       // [a, b, rel] between lines, from the graph
  const links = new Map();                              // session node → [[node id, rel, dir]]
  const add = (k, v) => (links.get(k) || links.set(k, []).get(k)).push(v);
  for (const e of graph.edges) {
    const a = e.a, b = e.b;
    if (a[0] === 'L' && b[0] === 'L') {
      const la = a.slice(2), lb = b.slice(2);
      if (lineIds.has(la) && lineIds.has(lb) && e.rel !== 'on-line') rel.push([la, lb, e.rel]);
      continue;
    }
    if (a.startsWith('L:s') && nodes.has(a) && nodes.get(a).kind === 'session') add(a, [b, e.rel, 1]);
    if (b.startsWith('L:s') && nodes.has(b) && nodes.get(b).kind === 'session') add(b, [a, e.rel, -1]);
  }

  /* compact node table for the panels */
  const NT = [], NI = new Map();
  const nIdx = id => {
    if (NI.has(id)) return NI.get(id);
    const n = nodes.get(id); if (!n) return -1;
    NI.set(id, NT.length);
    NT.push([n.id, C.clip(n.title, 110), n.t || '', n.state || '', n.kind || '']);
    return NT.length - 1;
  };

  /* stations */
  const S = stations(SESS, ASSIGN, lineIds);
  const harvest = SESS.reduce((m, s) => Math.max(m, Date.parse(s.start) || 0), 0);
  const st = S.list.map((x, i) => {
    const s = x.s, nid = 'L:s' + x.sid;
    const rec = !!REC.sessions[x.sid];
    const by = {};
    for (const [id, r] of links.get(nid) || []) {
      const L = id[0]; if (!LINK_LAYERS.includes(L)) continue;
      const k = nIdx(id); if (k < 0) continue;
      const arr = by[L] || (by[L] = []);
      if (!arr.some(v => v[0] === k)) arr.push([k, r]);
    }
    for (const L in by) by[L].sort((a, b) => String(NT[b[0]][2]).localeCompare(String(NT[a[0]][2])));
    const r = REC.sessions[x.sid];
    return {
      i, sid: x.sid, line: x.line, also: x.lines.filter(l => l !== x.line),
      t0: new Date(x.t0).toISOString(), t1: new Date(x.t1).toISOString(), d: localDay(x.t0),
      title: C.clip(s.title || s.aiTitle || (s.prompts[0] && s.prompts[0].text) || x.sid, 120),
      first: C.clip((s.prompts.find(p => p.t && Date.parse(p.t) >= x.t0) || s.prompts[0] || {}).text || '', 260),
      n: x.n, total: (s.prompts || []).length, tools: s.tools || 0,
      files: [...x.files].slice(0, 30), nfiles: x.files.size,
      cwd: s.cwd || '', forkOf: s.forkOf ? String(s.forkOf).slice(0, 8) : '',
      rec, steps: r ? r.steps : 0, touched: r && r.touched ? r.touched.slice(0, 12) : [],
      links: by,
    };
  });

  /* threads that continue each line (the Thread Board) */
  const threadsOf = new Map();
  const goFile = go => {
    const m = /^GO ([A-Z]+)/.exec(go || '');
    if (!m || /planned/.test(go)) return '';
    return /archived/.test(go) ? `${win(C.REPO)}\\docs\\go-archive\\GO-${m[1]}.md` : `${win(C.REPO)}\\GO-${m[1]}.md`;
  };
  const absRead = p => /^[A-Za-z]:/.test(p) ? win(p) : win(C.REPO) + '\\' + win(p);
  if (T) for (const a of T.AREAS) for (const r of a.rows) for (const id of r.lines || []) {
    (threadsOf.get(id) || threadsOf.set(id, []).get(id)).push({
      id: r.id, n: r.n, s: r.s, sWord: (T.SCALE[r.s] || [r.s])[0], note: r.note || '', go: r.go || '', goFile: goFile(r.go),
      read: (r.read || []).map(absRead), t: (r.t || []).map(x => Array.isArray(x) ? x[0] : x), area: a.area,
    });
  }

  /* lines (plus the "unsorted" pseudo-line when it holds stations, as the DevLog does) */
  const all = LINES.map(l => Object.assign({}, l));
  if (st.some(x => x.line === 'unsorted')) all.push({ id: 'unsorted', lane: 'o', name: 'Unsorted sessions', pseudo: true,
    brief: 'Sessions not yet put on a line. The morning pass assigns them in lines.js (ASSIGN).', status: 'recurring',
    milestones: [], remaining: [], nextStep: 'Assign these sessions to lines.', notes: [] });
  const stByLine = new Map();
  for (const x of st) (stByLine.get(x.line) || stByLine.set(x.line, []).get(x.line)).push(x.i);
  const lines = all.map(l => {
    const ids = stByLine.get(l.id) || [];
    const last = ids.length ? Math.max(...ids.map(i => Date.parse(st[i].t1))) : 0;
    const ms = (l.milestones || []).map(([d, t]) => ['2026-' + d, t]);
    const sessDir = DEVLOG + `/sessions/${l.id}/CLAUDE.md`, doc = DEVLOG + `/lines/${l.id}.md`;
    const w = WORD[l.status] || ['', l.status];
    return {
      id: l.id, lane: l.lane, name: l.name, brief: l.brief || '', status: l.status, icon: w[0], word: w[1], hu: HU[l.status] || l.status,
      open: OPEN.has(l.status), pseudo: !!l.pseudo,
      next: l.nextStep || '', remaining: l.remaining || [], notes: l.notes || [], ms,
      from: l.from ? { line: l.from[0], sid: l.from[1] || '', why: l.from[2] || '' } : null,
      by: l.by ? { line: l.by[0], why: l.by[1] || '' } : null,
      to: (l.next || []).map(([id, why]) => ({ line: id, why: why || '' })),
      feeds: (l.feeds || []).map(([id, why]) => ({ line: id, why: why || '' })),
      st: ids, last: last ? new Date(last).toISOString() : '', lastMd: last ? md(last) : '',
      quiet: last ? Math.floor((now - last) / DAY) : null,
      brief_: OPEN.has(l.status) && fs.existsSync(sessDir) ? `sessions/${l.id}/CLAUDE.md` : '',
      briefMissing: OPEN.has(l.status) && !fs.existsSync(sessDir) ? `sessions\\${l.id}\\CLAUDE.md` : '',
      doc: fs.existsSync(doc) ? `lines/${l.id}.md` : '',
      threads: threadsOf.get(l.id) || [],
      pillars: ((nodes.get('L:' + l.id) || {}).ent || []),
    };
  });

  /* recorded runs after the newest harvested session: no line holds them yet */
  const known = new Set(SESS.map(s => s.id.slice(0, 8)));
  const runs = Object.entries(REC.sessions)
    .filter(([sid, r]) => !known.has(sid) && Date.parse(r.start) > harvest)
    .map(([sid, r]) => ({ sid, t0: r.start, t1: r.end || r.start, d: localDay(Date.parse(r.start)), title: C.clip(r.title || sid, 120),
      steps: r.steps || 0, prompts: r.prompts || 0, commits: (r.commits || []).length, branch: r.branch || '', cwd: r.cwd || '',
      touched: (r.touched || []).slice(0, 12), node: nodes.has('U:run.' + sid) ? nIdx('U:run.' + sid) : -1 }))
    .sort((a, b) => a.t0.localeCompare(b.t0));

  const lo = Math.min(...st.map(x => Date.parse(x.t0)), ...lines.flatMap(l => l.ms.map(m => Date.parse(m[0]))).filter(isFinite));
  const counts = {
    lines: LINES.length, stations: st.length, sessions: new Set(st.map(x => x.sid)).size, harvested: SESS.length, noise: S.noise,
    open: lines.filter(l => l.open && !l.pseudo).length,
    quiet: lines.filter(l => (l.status === 'active' || l.status === 'waiting') && l.quiet != null && l.quiet >= QUIET_DAYS).length,
    recorded: st.filter(x => x.rec).length, runs: runs.length, rel: rel.length,
  };
  return {
    about: 'VRG Stack — Vonaltérkép data. Generated by Stack/lib/metro.js on every stack build; never edit by hand. Quotes job codes: stays in out/.',
    generated: new Date(now).toISOString(), today: localDay(now), from: localDay(lo), harvest: harvest ? new Date(harvest).toISOString() : '',
    quietDays: QUIET_DAYS,
    paths: { repo: win(C.REPO), devlog: win(DEVLOG), node: win(C.FULL + '/tools/node/node.exe') },
    threadsAsOf: T ? T.AS_OF : '', layers: LAYER_HU,
    lanes: LANES.map(([code, name, say]) => ({ code, name, say })),
    shape: {
      lines: 'id, lane, name, brief, status, icon/word (the Thread Board\'s English words), hu, open, pseudo, next, remaining, notes, ms [[date, text]], from {line, sid, why}, by {line, why}, to [{line, why}], feeds, st [station index], last, lastMd, quiet (days), brief_ (devlog-relative CLAUDE.md, "" when none), briefMissing, doc, threads [{id, n, s, sWord, note, go, goFile, read, t, area}], pillars',
      st: 'i, sid, line, also [other lines the same session moved], t0, t1, d, title, first (its first prompt on this line), n (prompts on this line), total, tools, files, nfiles, cwd, forkOf, rec, steps, touched [[node, weight]], links {layer: [[node index, rel]]}',
      rel: '[from line, to line, fork | next | feeds | absorbed-by | overruled-by]',
      nodes: '[id, title, date, state, kind]',
      runs: 'recorded runs after the newest harvested session (no line yet): sid, t0, t1, d, title, steps, prompts, commits, branch, cwd, touched, node',
    },
    lines, st, rel, runs, nodes: NT, counts, unknownAssign: S.unknown,
  };
}

function write({ graph } = {}) {
  const t0 = Date.now();
  const g = graph || JSON.parse(fs.readFileSync(path.join(CFG.out, 'stack.json'), 'utf8'));
  const data = build(g);
  const body = '// generated by stack.js build (lib/metro.js)\nwindow.METRO = ' + JSON.stringify(data).replace(/</g, '\\u003c') + ';\n';
  X.writeAtomic(path.join(CFG.out, 'metro-data.js'), body);
  const k = data.counts;
  return { data, msg: `metro: ${k.lines} lines, ${k.stations} stations (${k.sessions} sessions, ${k.recorded} recorded), ${k.rel} line links, ${k.quiet} open lines quiet ≥ ${QUIET_DAYS} d, ${k.runs} recorded runs after the harvest${data.unknownAssign.length ? ', ' + data.unknownAssign.length + ' ASSIGN to unknown lines' : ''} · ${(Buffer.byteLength(body) / 1024).toFixed(0)} KB · ${Date.now() - t0} ms → out/metro-data.js` };
}

module.exports = { build, write, stations };
