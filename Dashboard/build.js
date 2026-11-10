// VRG Desktop Dashboard — the data. Reads the three sources and writes dashboard-data.js for the page.
//   node build.js        write dashboard-data.js + print a short check
//   require('./build.js').collect()   the same data as an object (the Electron shell, D1, builds its allow-list from it)
// Sources (read only, never written):
//   notes/features/features.json              the Features rows (tier, lane, open, next)
//   Planner_VRG_U100/launcher/vrg-menu.json   START keys, servers, programs, browsers
//   notes/devlog/lines.js + DEVLOG.md         dev lines (status, next step) + last activity / quiet days
// A file:// page cannot fetch JSON, so the page loads this one generated script instead.
// Every launchable thing carries an `act` id ("f:p1:0", "s:P/G", "srv:planner", "prog:4", "line:hub").
// The page sends only that id; the shell looks it up again in collect() and refuses anything else.
'use strict';
const fs = require('fs'), path = require('path');

const REPO = path.resolve(__dirname, '..');                       // the checkout this folder sits in (repo or worktree)
const FULL = (() => {                                             // H:\VRG\Full: the folder above the checkout if it has notes/features
  const up = path.resolve(REPO, '..');
  return fs.existsSync(path.join(up, 'notes', 'features')) ? up : (process.env.VRG_FULL || 'H:\\VRG\\Full');
})();
const VRG = path.dirname(FULL);
const OUT = path.join(__dirname, 'dashboard-data.js');
const SRC = {
  features: path.join(FULL, 'notes', 'features', 'features.json'),
  menu: path.join(REPO, 'launcher', 'vrg-menu.json'),
  lines: path.join(FULL, 'notes', 'devlog', 'lines.js'),
  board: path.join(FULL, 'notes', 'devlog', 'DEVLOG.md'),
};
const OPENABLE = /\.(html?|md|txt|json|pdf|svg|png|css|js)$/i;     // documents; .cmd/.exe are programs
const fileUrl = p => 'file:///' + encodeURI(p.replace(/\\/g, '/')).replace(/#/g, '%23');
const readJson = f => JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, ''));

function collect() {
  const FEAT = readJson(SRC.features);
  const MENU = readJson(SRC.menu);
  delete require.cache[require.resolve(SRC.lines)];                // the shell's Frissítés re-reads it
  const { LANES: DL_LANES, LINES } = require(SRC.lines);
  const BOARD = fs.readFileSync(SRC.board, 'utf8');

  // ---------------------------------------------------------------- registry paths
  const P = { repo: REPO, full: FULL, vrg: VRG };
  for (const [k, v] of Object.entries(MENU.paths || {})) P[k] = v;
  const expand = s => { s = String(s || ''); for (let i = 0; i < 5 && /\{[a-z]+\}/.test(s); i++) s = s.replace(/\{([a-z]+)\}/g, (m, k) => P[k] !== undefined ? P[k] : m); return s; };
  function linkFor(abs, label) {
    if (!fs.existsSync(abs)) return { kind: 'missing', label: label || abs, path: abs };
    if (fs.statSync(abs).isDirectory()) return { kind: 'folder', label: label || abs, path: abs, href: fileUrl(abs) };
    if (OPENABLE.test(abs)) return { kind: 'doc', label: label || abs, path: abs, href: fileUrl(abs) };
    return { kind: 'program', label: label || abs, path: abs };
  }

  // ---------------------------------------------------------------- START keys → act ids
  const servers = MENU.servers.map(s => ({ key: s.key, id: s.id, name: s.name, port: s.port,
    href: 'http://localhost:' + s.port + (s.open || '/'), act: 'srv:' + s.id }));
  const byPort = new Map(servers.map(s => [s.port, s]));
  const S = MENU.start;
  const topItems = [...S.tools.map(i => ({ ...i, group: 'tools' })), ...S.projects.map(i => ({ ...i, group: 'projects' })),
    ...S.dev.map(i => ({ ...i, group: 'dev' })), ...S.bottom.map(i => ({ ...i, group: 'bottom' }))];
  const srvLink = s => ({ kind: 'server', label: ':' + s.port, href: s.href, port: s.port, act: s.act });
  function itemLink(it) {
    if (it.path) return linkFor(expand(it.path));
    if (it.server) { const s = servers.find(x => x.id === it.server); if (s) return srvLink(s); }
    if (it.exe) return { kind: 'program', path: expand(it.exe) };
    return null;
  }
  // which START items the shell may run, by key path; containers (menu/servers/programs/prompts) are not acts
  const RUNNABLE = it => !it.menu && !it.servers && !it.programs && !it.prompts && !it.action && !it.phase &&
    (it.path || it.exe || it.server || it.url || it.folder || it.steps || it.groups);
  const startActs = {};                                            // 's:P/G' → the registry item (shell only)
  for (const t of topItems) {
    if (RUNNABLE(t)) startActs['s:' + t.key] = t;
    if (t.menu) for (const m of t.menu.items || []) if (RUNNABLE(m)) startActs['s:' + t.key + '/' + m.key] = m;
    if (t.servers) for (const s of MENU.servers) startActs['s:' + t.key + '/' + s.key] = { server: s.id, name: s.name };
    if (t.programs) for (const p of MENU.programs) if (RUNNABLE(p)) startActs['s:' + t.key + '/' + p.key] = p;
  }
  function resolveStart(tok) {
    const parts = tok.replace(/\(.*?\)/g, '').split('→').map(x => x.trim()).slice(1);
    if (!parts.length) return [];
    const out = [];
    for (const h of parts[0].split('/').map(x => x.trim()).filter(Boolean)) {
      const top = topItems.find(i => i.key === h);
      if (!top) { out.push({ chain: 'START → ' + h, names: [], link: null, act: null }); continue; }
      const subs = parts[1] ? parts[1].split('/').map(x => x.trim()).filter(Boolean) : [];
      if (!subs.length) { out.push({ chain: 'START → ' + h, names: [top.name], link: itemLink(top), act: startActs['s:' + h] ? 's:' + h : null }); continue; }
      for (const k of subs) {
        let sub = null;
        if (top.servers) { const s = servers.find(x => x.key === k); if (s) sub = { name: s.name, link: srvLink(s) }; }
        else if (top.programs) { const p = MENU.programs.find(x => x.key === k); if (p) sub = { name: p.name, link: null }; }
        else if (top.menu) { const m = top.menu.items.find(x => x.key === k); if (m) sub = { name: m.name, link: itemLink(m) }; }
        const id = 's:' + h + '/' + k;
        out.push({ chain: 'START → ' + h + ' → ' + k, names: sub ? [top.name, sub.name] : [top.name], link: sub ? sub.link : null, act: startActs[id] ? id : null });
      }
    }
    return out;
  }
  function resolvePath(tok) {
    const t = tok.replace(/\(.*?\)/g, '').replace(/\*.*$/, '').trim().replace(/[\\/]+$/, '');
    if (!t || !/[\\/.]|^[A-Z]:/.test(t) && !/^[A-Za-z_][\w-]*$/.test(t)) return null;
    const cands = /^[A-Za-z]:/.test(t) ? [t] : [path.join(REPO, t), path.join(FULL, t), path.join(FULL, 'notes', t), path.join(VRG, t)];
    for (const c of cands) if (fs.existsSync(c)) return linkFor(c);
    return /^[A-Za-z]:/.test(t) ? { kind: 'missing', path: t } : null;
  }

  // ---------------------------------------------------------------- features
  const features = FEAT.features.map(f => {
    const start = [], links = [], text = [];
    for (const tok0 of String(f.open || '').split(' · ')) {
      const tok = tok0.trim(); if (!tok) continue;
      if (/^START\b/.test(tok)) { start.push(...resolveStart(tok)); continue; }
      const port = tok.match(/(?:^|\s):(\d{4,5})\b/);
      if (port) { const s = byPort.get(+port[1]);
        links.push(s ? srvLink(s) : { kind: 'server', label: ':' + port[1], href: 'http://localhost:' + port[1] + '/', port: +port[1] });
        const rest = tok.replace(port[0], '').replace(/\b(dev server|mock)\b/g, '').trim(); if (rest) { const r = resolvePath(rest); if (r) links.push(r); }
        continue; }
      const r = resolvePath(tok);
      if (r) links.push(r); else text.push(tok);
    }
    for (const s of start) if (s.link && s.link.href && !links.some(l => l.href === s.link.href)) links.push(s.link);
    links.forEach((l, i) => { if (!l.act && (l.kind === 'doc' || l.kind === 'folder' || l.kind === 'program')) l.act = 'f:' + f.id + ':' + i; });
    return { id: f.id, lane: f.lane, tier: f.tier, kind: f.kind, title: f.title, brief: f.brief, open: f.open, next: f.next,
      partOf: f.partOf, start: start.map(s => ({ chain: s.chain, names: s.names, act: s.act })), links, text, line: null };
  });

  // ---------------------------------------------------------------- DevLog lines
  const boardDate = (BOARD.match(/^# DevLog board — (\d{4}-\d{2}-\d{2})/m) || [])[1] || '';
  const last = {}, quiet = {};
  for (const m of BOARD.matchAll(/^\| \[[^\]]+\]\(lines\/([\w-]+)\.md\) \| ([\d-]+|—) \|/gm)) last[m[1]] = m[2] === '—' ? '' : m[2];
  const qsec = BOARD.split(/^## /m).find(s => s.startsWith('⚠')) || '';
  for (const m of qsec.matchAll(/\]\(lines\/([\w-]+)\.md\) — (\d+) d quiet/g)) quiet[m[1]] = +m[2];
  const dlLane = Object.fromEntries(DL_LANES.map(l => [l[0], l[1]]));
  const nameOf = Object.fromEntries(LINES.map(l => [l.id, l.name]));
  const lines = LINES.map(l => {
    const sess = path.join(FULL, 'notes', 'devlog', 'sessions', l.id, 'CLAUDE.md');
    const doc = path.join(FULL, 'notes', 'devlog', 'lines', l.id + '.md');
    const hasSess = fs.existsSync(sess), hasDoc = fs.existsSync(doc);
    return { id: l.id, name: l.name, lane: l.lane, laneName: dlLane[l.lane] || l.lane, status: l.status, brief: l.brief,
      nextStep: l.nextStep || '', last: last[l.id] || '', quietDays: quiet[l.id] || 0,
      doc: hasDoc ? fileUrl(doc) : '', docPath: hasDoc ? doc : '', session: hasSess ? fileUrl(sess) : '',
      sessionPath: hasSess ? path.dirname(sess) : '', act: hasSess ? 'line:' + l.id : null, docAct: hasDoc ? 'linedoc:' + l.id : null,
      next: (l.next || []).map(([id, why]) => ({ id, name: nameOf[id] || id, why })),
      by: l.by ? { id: l.by[0], name: nameOf[l.by[0]] || l.by[0], why: l.by[1] } : null };
  });

  // ---------------------------------------------------------------- GO briefs (codephrases) in the repo root
  const go = fs.readdirSync(REPO).filter(f => /^GO-[A-Z0-9]+\.md$/.test(f)).map(f => {
    const name = f.slice(3, -3), file = path.join(REPO, f);
    const head = fs.readFileSync(file, 'utf8').split(/\r?\n/)[0].replace(/^#\s*/, '');
    return { name, title: head.replace(/^GO [A-Z0-9]+\s*[—-]\s*/, ''), file, act: 'go:' + name, docAct: 'godoc:' + name };
  });
  const claude = startActs['s:C/1'] ? 's:C/1' : null;                 // START → C → 1: Claude Code, repo root
  for (const l of lines) {
    if (claude && l.sessionPath && !['ended', 'absorbed', 'overruled'].includes(l.status)) l.contAct = 'cont:' + l.id;
    const m = (l.nextStep + ' ' + l.brief).match(/\bGO ([A-Z0-9]{2,})\b/);
    if (m && go.some(g => g.name === m[1])) l.go = m[1];
  }

  // feature ↔ line: same next step (the Features rows copy it from the DevLog)
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9áéíóöőúüű]+/g, ' ').trim();
  for (const f of features) {
    const n = norm(f.next); if (n.length < 8) continue;
    const hit = lines.find(l => ['active', 'waiting'].includes(l.status) && norm(l.nextStep).startsWith(n.slice(0, Math.min(n.length, 24))));
    if (hit) f.line = hit.id;
  }

  const stats = collectStats({ MENU, expand, features, lines });
  const J = collectJobs();

  const data = {
    stats, jobs: J.jobs, jobHistory: J.history,
    generated: new Date().toISOString().slice(0, 16).replace('T', ' '),
    sources: { features: FEAT.generated, devlog: boardDate, menu: 'v' + MENU.version },
    tiers: FEAT.tiers, lanes: FEAT.lanes, features, lines, servers, go: claude ? go : go.map(g => ({ ...g, act: null })),
    start: topItems.map(i => ({ key: i.key, name: i.name, hint: i.hint || '', group: i.group, link: itemLink(i), act: startActs['s:' + i.key] ? 's:' + i.key : null,
      subs: i.menu ? (i.menu.items || []).map(m => ({ key: m.key, name: m.name, hint: m.hint || '', act: startActs['s:' + i.key + '/' + m.key] ? 's:' + i.key + '/' + m.key : null })) : [] })),
    programs: MENU.programs.map(p => ({ key: p.key, name: p.name, act: startActs['s:A/' + p.key] ? 's:A/' + p.key : null })),
  };
  return { data, menu: MENU, startActs, claude, expand, jobsPriv: J.priv, paths: { FULL, REPO, VRG } };
}

// ---------------------------------------------------------------- D3: stats + metrics (all local, read only)
const HIST = path.join(__dirname, 'history.json');                 // one tier snapshot per day, written by write()
const WEEKS = 12;
// weeks are keyed by the local date of their Monday (milliseconds would break across the summer-time change)
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function mondayKey(t) { const d = new Date(t); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return ymd(d); }
function weekBuckets() {
  const out = [], d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - (d.getDay() + 6) % 7);
  for (let i = WEEKS - 1; i >= 0; i--) { const m = new Date(d); m.setDate(d.getDate() - i * 7); out.push({ key: ymd(m), label: ymd(m).slice(5), n: 0 }); }
  return out;
}
function bucket(ws, t) { const k = mondayKey(t); const w = ws.find(x => x.key === k); if (w) w.n++; }
function collectStats({ MENU, expand, features, lines }) {
  const S = { errors: [] };
  // git: commits per week, branches ahead of their upstream, uncommitted files
  const gitExe = fs.existsSync(expand('{git}')) ? expand('{git}') : 'git';
  const git = (...a) => require('child_process').execFileSync(gitExe, a, { cwd: REPO, encoding: 'utf8', windowsHide: true, maxBuffer: 32 << 20 });
  try {
    const ws = weekBuckets();
    // author date: the consolidation rounds rewrote commit dates, the author date is when the work was done
    for (const l of git('log', '--all', '--format=%aI').split('\n')) if (l.trim()) bucket(ws, Date.parse(l));
    const branches = git('for-each-ref', 'refs/heads', '--format=%(refname:short)|%(upstream:short)|%(upstream:track)').split('\n').filter(Boolean).map(l => {
      const [name, up, track] = l.split('|'); const a = (track.match(/ahead (\d+)/) || [])[1], b = (track.match(/behind (\d+)/) || [])[1];
      return { name, upstream: up || '', ahead: a ? +a : 0, behind: b ? +b : 0 };
    });
    S.git = { weeks: ws.map(({ label, n }) => ({ label, n })), branch: git('branch', '--show-current').trim(), branches,
      uncommitted: git('status', '--porcelain').split('\n').filter(Boolean).length,
      last: git('log', '-1', '--format=%cI|%h|%s').trim().split('|') };
  } catch (e) { S.errors.push('git: ' + e.message.split('\n')[0]); }
  // Claude Code sessions per week (only the start times are read from the DevLog harvest)
  try {
    const ws = weekBuckets(), sess = readJson(path.join(FULL, 'notes', 'devlog', 'sessions.json'));
    for (const s of sess) if (s.start) bucket(ws, Date.parse(s.start));
    S.sessions = { weeks: ws.map(({ label, n }) => ({ label, n })), total: sess.length,
      harvested: fs.statSync(path.join(FULL, 'notes', 'devlog', 'sessions.json')).mtime.toISOString().slice(0, 16).replace('T', ' ') };
  } catch (e) { S.errors.push('sessions: ' + e.message); }
  // lines by status, features by tier
  S.lineStatus = lines.reduce((a, l) => (a[l.status] = (a[l.status] || 0) + 1, a), {});
  S.tiers = features.reduce((a, f) => (a[f.tier] = (a[f.tier] || 0) + 1, a), {});
  // tier movement: today against the last snapshot from an earlier day
  try {
    const hist = fs.existsSync(HIST) ? readJson(HIST) : [];
    const today = new Date().toISOString().slice(0, 10);
    const prev = hist.filter(h => h.date < today).pop();
    const now = Object.fromEntries(features.map(f => [f.id, f.tier]));
    const moved = [], added = [], gone = [];
    if (prev) {
      for (const [id, t] of Object.entries(now)) { if (!(id in prev.tiers)) added.push(id); else if (prev.tiers[id] !== t) moved.push({ id, from: prev.tiers[id], to: t }); }
      for (const id of Object.keys(prev.tiers)) if (!(id in now)) gone.push(id);
    }
    S.movement = { since: prev ? prev.date : '', snapshots: hist.length, moved, added, gone,
      history: hist.slice(-8).map(h => ({ date: h.date, counts: Object.values(h.tiers).reduce((a, t) => (a[t] = (a[t] || 0) + 1, a), {}) })) };
    S._snapshot = { date: today, tiers: now };
  } catch (e) { S.errors.push('history: ' + e.message); }
  // backup: the newest BACKUP sync log + the manifest
  try {
    const logs = expand((MENU.backup || {}).logs || '{vrg}\\Backup\\logs');
    const f = fs.readdirSync(logs).filter(x => /^sync-\d{8}-\d{6}\.json$/.test(x)).sort().pop();
    if (f) {
      const j = readJson(path.join(logs, f)), man = path.join(logs, 'manifest.tsv');
      const age = Math.floor((Date.now() - Date.parse(j.when.replace(' ', 'T'))) / 864e5);
      S.backup = { when: j.when, age, ok: !!j.ok, seconds: j.seconds,
        repos: (j.repos || []).map(r => ({ name: r.name, ok: !!r.ok })), folders: (j.folders || []).length,
        manifest: fs.existsSync(man) ? { files: fs.readFileSync(man, 'utf8').split('\n').filter(Boolean).length - 1, when: fs.statSync(man).mtime.toISOString().slice(0, 10) } : null };
    } else S.backup = null;
  } catch (e) { S.errors.push('backup: ' + e.message); }
  // disk space
  S.disks = [];
  for (const d of ['H:\\', 'C:\\']) {
    try { const s = fs.statfsSync(d); S.disks.push({ drive: d.slice(0, 2), total: s.blocks * s.bsize, free: s.bavail * s.bsize }); }
    catch (e) { S.errors.push('disk ' + d + ': ' + e.message); }
  }
  return S;
}

// ---------------------------------------------------------------- D4: project workflows per job
// Client job data never leaves this PC and never reaches the page as text: the page gets the anonymised code,
// which steps exist on disk, dates and VG document numbers. Folder and file paths stay in `priv`, which only
// the shell's main process sees (it is not written to dashboard-data.js).
const JOBS = path.join(FULL, 'jobs');
const STEPS = ['intake', 'funnel', 'plan', 'price', 'doc', 'delivered'];
const CODE_RX = /^([A-Z]{1,3}\d{1,3})_/, SUB_RX = /^([A-Z]{1,3}\d{1,3}-[A-Z]{2,4})$/;
function walk(dir, out, depth = 0) {
  if (depth > 7 || out.length > 8000) return out;
  let ents = []; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  for (const e of ents) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out, depth + 1);
    else { try { out.push({ p, rel: path.relative(dir, p), name: e.name, t: fs.statSync(p).mtimeMs }); } catch (x) {} }
  }
  return out;
}
const day = t => t ? new Date(t).toISOString().slice(0, 10) : '';
function jobState(code, folders, subsOf) {
  const files = [];
  for (const f of folders) for (const x of walk(f, [])) files.push({ ...x, inInput: path.relative(f, x.p).split(path.sep)[0].startsWith('00_bemenet'),
    inSub: subsOf ? SUB_RX.test(path.relative(f, x.p).split(path.sep)[0]) : false });
  const own = files.filter(x => !x.inSub);
  const pdfs = own.filter(x => /\.pdf$/i.test(x.name) && !x.inInput).sort((a, b) => b.t - a.t);
  const vg = n => (n.match(/VG-\d{4}-[A-Z0-9]+-\d{2}/) || [])[0] || '';
  const has = {
    intake: own.some(x => x.inInput),
    funnel: own.some(x => /^answers_r\d.*\.json$/i.test(x.name)),
    plan: own.some(x => /\.vplan(\(\d+\))?\.json$|takeoff.*\.json$/i.test(x.name)),
    price: own.some(x => /^offer.*\.json$/i.test(x.name)),
    doc: pdfs.length > 0,
    delivered: folders.some(f => /_ajanlat$/i.test(f)) || pdfs.some(x => vg(x.name)),
  };
  const step = STEPS.reduce((a, s, i) => has[s] ? i + 1 : a, 0);
  const numbers = [...new Set(pdfs.map(x => vg(x.name)).filter(Boolean))].sort();
  const last = own.reduce((a, x) => Math.max(a, x.t), 0);
  // the last document: the highest VG number (the Költségvetési Tervezet itself), else the newest working PDF
  const official = pdfs.filter(x => vg(x.name) && /tervezet/i.test(x.name)).sort((a, b) => vg(b.name).localeCompare(vg(a.name)) || b.t - a.t);
  const doc = official[0] || pdfs.filter(x => vg(x.name)).sort((a, b) => vg(b.name).localeCompare(vg(a.name)))[0] || pdfs[0];
  return {
    pub: { code, step, has, market: own.some(x => /^piac.*\.json$/i.test(x.name)), lastChange: day(last),
      lastDoc: doc ? { date: day(doc.t), number: vg(doc.name) } : null, numbers,
      act: 'job:' + code, docAct: doc ? 'jobdoc:' + code : null },
    priv: { folder: folders.find(f => /_koltsegvetesi_tervezet$/i.test(f)) || folders[0], doc: doc ? doc.p : '' },
  };
}
function collectJobs() {
  const out = { jobs: [], history: 0, priv: {} };
  let dirs = []; try { dirs = fs.readdirSync(JOBS, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name); } catch (e) { return out; }
  const codes = new Map();
  for (const d of dirs) { const m = d.match(CODE_RX); if (m) { if (!codes.has(m[1])) codes.set(m[1], []); codes.get(m[1]).push(path.join(JOBS, d)); } }
  for (const [code, folders] of codes) {
    const s = jobState(code, folders, true);
    const subs = [];
    for (const f of folders) {
      let ents = []; try { ents = fs.readdirSync(f, { withFileTypes: true }); } catch (e) {}
      for (const e of ents) if (e.isDirectory() && SUB_RX.test(e.name)) {
        const ss = jobState(e.name, [path.join(f, e.name)], false);
        subs.push(ss.pub); out.priv[e.name] = ss.priv;
      }
    }
    out.jobs.push({ ...s.pub, subs }); out.priv[code] = s.priv;
  }
  out.jobs.sort((a, b) => b.lastChange.localeCompare(a.lastChange));
  try { out.history = fs.readdirSync(path.join(JOBS, '_elozmenyek'), { withFileTypes: true }).filter(d => d.isDirectory() && /^[A-Z]{1,3}\d{1,3}$/.test(d.name)).length; } catch (e) {}
  return out;
}

function write() {
  const c = collect();
  const snap = c.data.stats && c.data.stats._snapshot;
  if (snap) {                                                          // keep one tier snapshot per day
    let hist = []; try { hist = fs.existsSync(HIST) ? readJson(HIST) : []; } catch (e) {}
    hist = hist.filter(h => h.date !== snap.date).concat(snap).slice(-400);
    fs.writeFileSync(HIST, JSON.stringify(hist) + '\n');
    delete c.data.stats._snapshot;
  }
  fs.writeFileSync(OUT, '// generated by Dashboard/build.js — do not edit\nwindow.VRG_DASH = ' + JSON.stringify(c.data, null, 1) + ';\n');
  return c;
}

module.exports = { collect, write, OUT };

if (require.main === module) {
  const { data, startActs } = write();
  const { features, lines, servers } = data;
  const c = k => features.filter(f => f.links.some(l => l.kind === k)).length;
  console.log(`features ${features.length} (doc/folder links on ${features.filter(f => f.links.some(l => l.href && l.kind !== 'server')).length}, server ${c('server')}, missing path ${c('missing')}, matched to a line ${features.filter(f => f.line).length})`);
  console.log(`lines ${lines.length} (waiting ${lines.filter(l => l.status === 'waiting').length}, quiet ${lines.filter(l => l.quietDays).length}, board ${data.sources.devlog})`);
  console.log(`servers ${servers.length}, START acts ${Object.keys(startActs).length} → ${path.relative(FULL, OUT)}`);
  for (const f of features) for (const l of f.links) if (l.kind === 'missing') console.log('  missing', f.id, l.path);
}
