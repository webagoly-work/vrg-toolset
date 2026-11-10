#!/usr/bin/env node
// inventory.js — every tool, feature, layer, page, agent and library of the VRG toolset as one flat list.
//   node Dashboard/tools/inventory.js            write docs/desktop/inventory.json + INVENTORY.md, print the counts
//   node Dashboard/tools/inventory.js --json     print the rows as JSON, write nothing
// It only reads. Sources: launcher/vrg-menu.json, the features map (notes/features/features.json, outside git),
// the Dashboard (pane kinds, act families, config registries, lib modules), the Varler Console page catalogue,
// VRG Mobile work packages, the VRG Stack pages and MCP, tools/*.js, prompts, .claude/agents, hooks, firmware,
// shared/ libraries, docs packs and the GO-* phrases. A row: { id, name, where, source, kind, group, note }.
// `kind` is what the source itself calls the thing; the industry type and the level come later (CLASSIFICATION.md).
'use strict';
const fs = require('fs'), path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const FULL = fs.existsSync(path.join(REPO, '..', 'notes', 'features')) ? path.resolve(REPO, '..') : (process.env.VRG_FULL || 'H:\\VRG\\Full');
const OUT_DIR = path.join(REPO, 'docs', 'desktop');
const rel = p => path.relative(REPO, p).split(path.sep).join('/');
const readJson = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const ls = (d, re) => { try { return fs.readdirSync(d).filter(n => !re || re.test(n)).sort(); } catch (e) { return []; } };
const isDir = p => { try { return fs.statSync(p).isDirectory(); } catch (e) { return false; } };
const firstLine = (f, re) => { try { const l = fs.readFileSync(f, 'utf8').split(/\r?\n/).find(x => (re || /\S/).test(x)); return (l || '').trim(); } catch (e) { return ''; } };
const headComment = f => {                                       // the first // or /* */ comment line of a JS file, without the marker
  try {
    for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/).slice(0, 12)) {
      const m = /^\s*(?:\/\/|\/\*+|\*)\s*(.+?)\s*(?:\*\/)?$/.exec(l);
      if (m && !/^#!/.test(l) && !/^'use strict'/.test(m[1]) && /[A-Za-z]{3}/.test(m[1])) return m[1];
    }
  } catch (e) {}
  return '';
};
const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

function collect() {
  const rows = [], errors = [];
  const add = r => rows.push({ id: r.id, name: clip(r.name, 90), where: clip(r.where || '', 120), source: r.source, kind: r.kind || '', group: r.group || '', note: clip(r.note || '', 160) });
  const src = (name, fn) => { try { fn(); } catch (e) { errors.push(name + ': ' + e.message); } };

  // ---------------------------------------------------------------- launcher/vrg-menu.json (how to run)
  src('vrg-menu', () => {
    const m = readJson(path.join(REPO, 'launcher', 'vrg-menu.json'));
    const where = it => it.path || it.exe || (it.server ? 'server ' + it.server : '') || (it.steps ? (it.steps.map(s => [s.exe].concat(s.args || []).join(' ')).join(' ; ')) : '') || (it.action ? 'action ' + it.action : '') || (it.phase ? 'phase ' + it.phase : '');
    for (const t of m.start.tools || []) add({ id: 'menu:tool:' + t.key, name: t.name, where: 'START ' + t.key + ' · ' + where(t), source: 'vrg-menu', kind: 'start.tool', group: 'tools', note: t.hint });
    for (const p of m.start.projects || []) {
      add({ id: 'menu:proj:' + p.key, name: p.name, where: 'START ' + p.key + ' (submenu)', source: 'vrg-menu', kind: 'start.project', group: 'projects', note: p.hint });
      for (const it of (p.menu && p.menu.items) || []) add({ id: 'menu:proj:' + p.key + '/' + it.key, name: p.name + ' · ' + it.name, where: 'START ' + p.key + ' ' + it.key + ' · ' + where(it), source: 'vrg-menu', kind: 'start.action', group: 'projects/' + p.key, note: it.hint });
    }
    for (const d of m.start.dev || []) {
      add({ id: 'menu:dev:' + d.key, name: d.name, where: 'START ' + d.key + ' · ' + (where(d) || (d.servers ? 'server list' : d.menu ? 'submenu' : '')), source: 'vrg-menu', kind: 'start.dev', group: 'dev', note: d.hint });
      for (const it of (d.menu && d.menu.items) || []) add({ id: 'menu:dev:' + d.key + '/' + it.key, name: d.name + ' · ' + it.name, where: 'START ' + d.key + ' ' + it.key + ' · ' + where(it), source: 'vrg-menu', kind: 'start.action', group: 'dev/' + d.key, note: it.hint });
    }
    for (const b of m.start.bottom || []) add({ id: 'menu:bottom:' + b.key, name: b.name, where: 'START ' + b.key, source: 'vrg-menu', kind: 'start.bottom', group: 'bottom', note: b.hint || b.action });
    for (const s of m.servers || []) add({ id: 'srv:' + s.id, name: s.name, where: ':' + s.port + ' · ' + (s.js || s.exe || ''), source: 'vrg-menu', kind: 'server', group: 'servers' });
    for (const p of m.programs || []) add({ id: 'menu:prog:' + p.key, name: p.name, where: p.exe, source: 'vrg-menu', kind: 'program', group: 'programs', note: p.optional ? 'optional' : '' });
    for (const r of m.repos || []) add({ id: 'repo:' + r.name, name: 'Repo · ' + r.name, where: r.path, source: 'vrg-menu', kind: 'repo', group: 'repos' });
    for (const scr of ['backup', 'otg']) for (const it of (m[scr] && m[scr].items) || []) add({ id: 'menu:' + scr + ':' + it.key, name: scr.toUpperCase() + ' · ' + it.name, where: scr.toUpperCase() + '.cmd ' + it.key + ' · ' + where(it), source: 'vrg-menu', kind: scr + '.item', group: scr, note: it.hint });
  });

  // ---------------------------------------------------------------- features map (roadmap: tier, kind, lane)
  src('features', () => {
    const f = readJson(path.join(FULL, 'notes', 'features', 'features.json'));
    const lanes = Object.fromEntries((f.lanes || []).map(l => [l.id, l.name]));
    for (const n of f.features || []) add({ id: 'feat:' + n.id, name: n.title, where: n.open, source: 'features', kind: n.kind + ' · tier ' + n.tier, group: lanes[n.lane] || n.lane, note: n.brief });
  });

  // ---------------------------------------------------------------- Dashboard (the Irányítópult): panes, act families, registries, modules
  src('dashboard', () => {
    const { KINDS } = require(path.join(REPO, 'Dashboard', 'shell', 'lib', 'layout.js'));
    const HU = { home: 'Kezdőlap', empty: 'Üres panel', files: 'Fájlok', term: 'Terminál', web: 'Böngésző', mail: 'Posta', stack: 'Rétegverem (kontextus)', chat: 'Claude oldalchat', note: 'Fejlesztői jegyzet', git: 'Git', feed: 'Hírfolyam (presetek)' };
    for (const k of KINDS) add({ id: 'pane:' + k, name: HU[k] || k, where: k === 'home' ? 'Dashboard/vrg-dashboard.html' : 'Dashboard/page/panes/' + k + '.js', source: 'dashboard', kind: 'pane', group: 'panes' });
    add({ id: 'pane:search', name: 'Belső keresés', where: 'Dashboard/page/panes/search.js (Ctrl+Shift+F)', source: 'dashboard', kind: 'overlay panel', group: 'panes' });
    add({ id: 'pane:viewer', name: 'Fájlnézegető', where: 'Dashboard/page/panes/viewer.js', source: 'dashboard', kind: 'pane part', group: 'panes' });
    add({ id: 'dash:palette', name: 'Parancspaletta', where: 'Dashboard/page/palette.js (Ctrl+K)', source: 'dashboard', kind: 'command palette', group: 'frame' });
    add({ id: 'dash:quick', name: 'Gyorskereső', where: 'Dashboard/page/quick.js (global hotkey)', source: 'dashboard', kind: 'quick bar', group: 'frame' });
    add({ id: 'dash:workspaces', name: 'Munkaterek', where: 'Dashboard/page/frame.js', source: 'dashboard', kind: 'saved layouts', group: 'frame' });
    add({ id: 'dash:selmenu', name: 'Kijelölés menü', where: 'Dashboard/shell/lib/selmenu.js', source: 'dashboard', kind: 'context menu', group: 'frame' });
    add({ id: 'dash:tray', name: 'Tálca ikon + ablakmódok', where: 'Dashboard/shell/lib/tray.js, winmodes.js (Ablak · Munka · Overlay)', source: 'dashboard', kind: 'tray', group: 'frame' });
    add({ id: 'dash:toasts', name: 'Értesítések + feladatsor', where: 'Dashboard/page/toasts.js', source: 'dashboard', kind: 'toasts + jobs', group: 'frame' });
    const ACTS = { 's:': 'START item', 'srv:': 'local server', 'f:': 'features node', 'cont:': 'continue a DevLog line', 'go:': 'GO phrase', 'godoc:': 'GO doc', 'job:': 'job folder', 'jobdoc:': 'job doc', 'line:': 'DevLog line', 'linedoc:': 'DevLog line doc' };
    for (const [p, what] of Object.entries(ACTS)) add({ id: 'act:' + p.replace(':', ''), name: 'Act family ' + p + '*', where: 'Dashboard/shell/lib/acts.js', source: 'dashboard', kind: 'act family', group: 'acts', note: what });
    for (const f of ls(path.join(REPO, 'Dashboard', 'config'), /\.json$/)) {
      const j = readJson(path.join(REPO, 'Dashboard', 'config', f));
      const list = Array.isArray(j) ? j : Array.isArray(j.roots) ? j.roots : Array.isArray(j.profiles) ? j.profiles : Array.isArray(j.presets) ? j.presets : Array.isArray(j.providers) ? j.providers : null;
      add({ id: 'dashcfg:' + f.replace(/\.json$/, ''), name: 'Registry ' + f, where: 'Dashboard/config/' + f, source: 'dashboard', kind: 'config registry', group: 'config', note: list ? list.length + ' entries' : Object.keys(j).slice(0, 6).join(', ') });
    }
    for (const f of ls(path.join(REPO, 'Dashboard', 'shell', 'lib'), /\.js$/)) add({ id: 'dashlib:' + f.replace(/\.js$/, ''), name: 'lib/' + f, where: 'Dashboard/shell/lib/' + f, source: 'dashboard', kind: 'module', group: 'shell/lib', note: headComment(path.join(REPO, 'Dashboard', 'shell', 'lib', f)) });
  });

  // ---------------------------------------------------------------- Varler Console pages (catalogue.js + each page module's manifest)
  src('console', () => {
    const dir = path.join(REPO, 'Console', 'www', 'js', 'pages');
    const cat = fs.readFileSync(path.join(dir, 'catalog.js'), 'utf8');
    const seen = new Set();
    for (const m of cat.matchAll(/page\('([a-z0-9-]+)',\s*'([a-z]+)',\s*\[[^\]]*\],\s*(true|false),\s*'([^']*)',\s*'([^']*)'\)/g)) {
      seen.add(m[1]);
      add({ id: 'console:' + m[1], name: m[4], where: 'Console page ' + m[1] + ' (stub)', source: 'console', kind: 'page · ' + m[2] + ' · stub', group: m[2], note: m[5] });
    }
    for (const f of ls(dir, /\.js$/)) {
      if (['catalog.js', 'registry.js', 'shared.js', 'servicekit-shared.js'].includes(f)) continue;
      const t = fs.readFileSync(path.join(dir, f), 'utf8');
      for (const m of t.matchAll(/id:\s*'([a-z0-9-]+)',\s*category:\s*'([a-z]+)'[\s\S]{0,400}?name:\s*\{\s*hu:\s*'([^']*)',\s*en:\s*'([^']*)'/g)) {
        if (seen.has(m[1])) continue;
        seen.add(m[1]);
        add({ id: 'console:' + m[1], name: m[3], where: 'Console/www/js/pages/' + f, source: 'console', kind: 'page · ' + m[2], group: m[2], note: m[4] });
      }
    }
    add({ id: 'console:trace', name: 'Ügynöknyom (agent trace)', where: 'Console/www/js/trace + relay :8134', source: 'console', kind: 'feature', group: 'dev' });
    add({ id: 'console:ring', name: 'Varler SUI gyűrű (HUD)', where: 'Console/www/js/ring.js + Console/design/tokens.json', source: 'console', kind: 'design component', group: 'look' });
  });

  // ---------------------------------------------------------------- VRG Mobile work packages (one feature module each)
  src('mobile', () => {
    const dir = path.join(REPO, 'docs', 'mobile', 'WP');
    for (const f of ls(dir, /^M\d+\.md$/).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)))) {
      const h = firstLine(path.join(dir, f), /^# /).replace(/^#\s*/, '');
      const m = /^(M\d+)\s*·\s*(.+?)(?:\s*\(`([a-z]+)`\))?(?::\s*(.*))?$/.exec(h) || [];
      add({ id: 'mobile:' + (m[1] || f.replace('.md', '')), name: (m[2] || h).replace(/\s*\(`[a-z]+`\).*/, ''), where: 'docs/mobile/WP/' + f + (m[3] ? ' · feature-' + m[3] : ''), source: 'mobile', kind: 'phone feature', group: 'VRG Mobile', note: m[4] || '' });
    }
    if (!fs.existsSync(path.join(dir, 'M15.md'))) add({ id: 'mobile:M15', name: 'Logó kezdőlap', where: 'GO-LOGO.md (planned)', source: 'mobile', kind: 'phone feature · planned', group: 'VRG Mobile', note: 'the two-state Varler logo home page' });
    const t = readJson(path.join(REPO, 'Mobile', 'catalogue', 'tools.json'));
    add({ id: 'mobile:catalogue', name: 'Mobile eszközkatalógus', where: 'Mobile/catalogue/tools.json', source: 'mobile', kind: 'registry', group: 'VRG Mobile', note: (t.tools || []).length + ' tools listed for the phone' });
  });

  // ---------------------------------------------------------------- VRG Stack (pages, MCP, CLI)
  src('stack', () => {
    for (const f of ls(path.join(REPO, 'Stack'), /\.html$/)) {
      const html = fs.readFileSync(path.join(REPO, 'Stack', f), 'utf8');
      const t = (/<title>([^<]*)<\/title>/i.exec(html) || [])[1] || f;
      add({ id: 'stack:' + f.replace(/\.html$/, ''), name: t, where: 'Stack/' + f + ' (:8806)', source: 'stack', kind: 'page', group: 'VRG Stack' });
    }
    add({ id: 'stack:cli', name: 'stack.js (CLI)', where: 'Stack/stack.js', source: 'stack', kind: 'cli', group: 'VRG Stack', note: headComment(path.join(REPO, 'Stack', 'stack.js')) });
    add({ id: 'stack:mcp', name: 'vrg-stack MCP szerver', where: 'Stack/mcp/server.js', source: 'stack', kind: 'mcp server', group: 'VRG Stack' });
    const L = fs.readFileSync(path.join(REPO, 'Stack', 'LAYERS.md'), 'utf8');
    for (const m of L.matchAll(/^\|\s*\*\*([FIQLAURCGZ]) ([^*]+)\*\*\s*\|\s*([^|]*?)\s*\|/gm)) add({ id: 'layer:' + m[1], name: 'Réteg ' + m[1] + ' · ' + m[2].trim(), where: m[3].replace(/`/g, ''), source: 'stack', kind: 'stack layer', group: 'layers', note: 'its page, per Stack/LAYERS.md' });
  });

  // ---------------------------------------------------------------- CLI tools and prompts
  src('tools', () => {
    for (const f of ls(path.join(REPO, 'tools'), /\.js$/)) add({ id: 'tool:' + f.replace(/\.js$/, ''), name: 'tools/' + f, where: 'tools/' + f, source: 'tools', kind: 'cli script', group: 'tools', note: headComment(path.join(REPO, 'tools', f)) });
    if (isDir(path.join(REPO, 'tools', 'hub-admin'))) add({ id: 'tool:hub-admin', name: 'Kapu admin', where: 'tools/hub-admin/', source: 'tools', kind: 'admin tool', group: 'tools' });
    for (const f of ls(path.join(REPO, 'tools', 'prompts'), /\.txt$/)) add({ id: 'prompt:' + f.replace(/\.txt$/, ''), name: 'Prompt · ' + f.replace(/\.txt$/, ''), where: 'tools/prompts/' + f, source: 'prompts', kind: 'prompt', group: 'prompts', note: firstLine(path.join(REPO, 'tools', 'prompts', f)) });
  });

  // ---------------------------------------------------------------- agents, hooks, MCP servers
  src('agents', () => {
    for (const f of ls(path.join(REPO, '.claude', 'agents'), /\.md$/)) {
      const t = fs.readFileSync(path.join(REPO, '.claude', 'agents', f), 'utf8');
      const d = (/^description:\s*"?(.+?)"?\s*$/m.exec(t) || [])[1] || '';
      add({ id: 'agent:' + f.replace(/\.md$/, ''), name: d.split(/[.(]/)[0] || f, where: '.claude/agents/' + f, source: 'agents', kind: 'ai agent', group: 'agents', note: d });
    }
    add({ id: 'hook:codecity', name: 'Kódváros hook', where: 'CodeCity/hook.js', source: 'agents', kind: 'hook', group: 'hooks', note: headComment(path.join(REPO, 'CodeCity', 'hook.js')) });
    add({ id: 'hook:council-gate', name: 'Council gate', where: 'tools/council-gate.js', source: 'agents', kind: 'hook', group: 'hooks', note: headComment(path.join(REPO, 'tools', 'council-gate.js')) });
    add({ id: 'mcp:codecity', name: 'Kódváros MCP szerver', where: 'CodeCity/mcp.js', source: 'agents', kind: 'mcp server', group: 'mcp', note: headComment(path.join(REPO, 'CodeCity', 'mcp.js')) });
  });

  // ---------------------------------------------------------------- firmware, shared libraries, docs packs, GO phrases, app folders
  src('firmware', () => {
    for (const d of ls(path.join(REPO, 'Firmware'))) if (isDir(path.join(REPO, 'Firmware', d))) add({ id: 'fw:' + d, name: d, where: 'Firmware/' + d, source: 'firmware', kind: 'firmware', group: 'firmware', note: firstLine(path.join(REPO, 'Firmware', d, 'README.md'), /^# /).replace(/^#\s*/, '') });
    if (isDir(path.join(REPO, 'ServiceKitCYD'))) add({ id: 'fw:servicekit-cyd', name: 'ServiceKit CYD', where: 'ServiceKitCYD/', source: 'firmware', kind: 'firmware', group: 'firmware', note: firstLine(path.join(REPO, 'ServiceKitCYD', 'README.md'), /^# /).replace(/^#\s*/, '') });
  });
  src('shared', () => {
    for (const d of ls(path.join(REPO, 'shared'))) add({ id: 'lib:' + d.replace(/\.css$/, ''), name: d, where: 'shared/' + d, source: 'shared', kind: isDir(path.join(REPO, 'shared', d)) ? 'library' : 'stylesheet', group: 'shared', note: isDir(path.join(REPO, 'shared', d)) ? firstLine(path.join(REPO, 'shared', d, 'README.md'), /^# /).replace(/^#\s*/, '') : '' });
  });
  src('docs', () => {
    for (const d of ls(path.join(REPO, 'docs'))) add({ id: 'doc:' + d.replace(/\.md$/, ''), name: 'docs/' + d, where: 'docs/' + d, source: 'docs', kind: isDir(path.join(REPO, 'docs', d)) ? 'docs pack' : 'doc', group: 'docs' });
    for (const f of ls(REPO, /^GO-.+\.md$/)) add({ id: 'go:' + f.replace(/^GO-|\.md$/g, '').toLowerCase(), name: f.replace(/\.md$/, '').replace('-', ' '), where: f, source: 'docs', kind: 'codephrase brief', group: 'GO', note: firstLine(path.join(REPO, f), /^# /).replace(/^#\s*/, '') });
  });
  src('folders', () => {
    for (const d of ls(REPO)) {
      if (!isDir(path.join(REPO, d)) || /^(\.|docs$|tools$|shared$|launcher$|Firmware$|Vendor$|node_modules$)/.test(d)) continue;
      const readme = ['README.md', 'readme.md'].map(n => path.join(REPO, d, n)).find(f => fs.existsSync(f));
      add({ id: 'dir:' + d, name: d, where: d + '/', source: 'folders', kind: 'top-level folder', group: 'repo', note: readme ? firstLine(readme, /^# /).replace(/^#\s*/, '') : '' });
    }
    for (const f of ['launcher/vrg-ui.ps1', 'launcher/backup.ps1', 'launcher/vrg-git.ps1', 'launcher/menu.js', 'launcher/vrg-launch.cmd'])
      if (fs.existsSync(path.join(REPO, f))) add({ id: 'launcher:' + path.basename(f).replace(/\.\w+$/, ''), name: f, where: f, source: 'folders', kind: 'launcher part', group: 'launcher' });
  });
  return { rows, errors };
}

const SOURCES = ['vrg-menu', 'features', 'dashboard', 'console', 'mobile', 'stack', 'tools', 'prompts', 'agents', 'firmware', 'shared', 'docs', 'folders'];
const TITLE = {
  'vrg-menu': 'START registry (launcher/vrg-menu.json)', features: 'Features map (notes/features, outside git)', dashboard: 'VRG Irányítópult (Dashboard/)',
  console: 'Varler Console pages', mobile: 'VRG Mobile features', stack: 'VRG Stack', tools: 'CLI tools', prompts: 'Prompt library',
  agents: 'Agents, hooks, MCP', firmware: 'Firmware', shared: 'Shared libraries', docs: 'Docs packs + GO phrases', folders: 'Top-level folders + launcher parts',
};
const esc = s => String(s).replace(/\|/g, '\\|');

function markdown(inv) {
  const out = ['# VRG inventory', '', '*Generated by `node Dashboard/tools/inventory.js` — do not edit by hand; edit the sources and re-run.*',
    '*What each row **is** in industry terms and which level (User / Dev / All) it belongs to: `CLASSIFICATION.md`.*', '',
    '| Source | Rows |', '|---|---:|'];
  for (const s of SOURCES) out.push('| ' + TITLE[s] + ' | ' + inv.counts[s] + ' |');
  out.push('| **Total** | **' + inv.rows.length + '** |', '');
  if (inv.errors.length) out.push('**Source errors:** ' + inv.errors.map(esc).join('; '), '');
  for (const s of SOURCES) {
    const rs = inv.rows.filter(r => r.source === s);
    if (!rs.length) continue;
    out.push('## ' + TITLE[s] + ' (' + rs.length + ')', '', '| id | name | where | kind | group | note |', '|---|---|---|---|---|---|');
    for (const r of rs) out.push('| `' + r.id + '` | ' + esc(r.name) + ' | ' + esc(r.where) + ' | ' + esc(r.kind) + ' | ' + esc(r.group) + ' | ' + esc(r.note) + ' |');
    out.push('');
  }
  return out.join('\n');
}

// Client codes never reach a committed file: the same map tools/anonymise.js uses (gitignored; a worktree reads the main
// checkout's copy, DESK-Q87 C) swaps each code for its alias, with the same word-boundary rule. No map → nothing is written.
function anonMap() {
  const cands = [process.env.VRG_ANON_MAP, path.join(REPO, 'tools', 'anonymise.map.json'), path.join(FULL, 'Planner_VRG_U100', 'tools', 'anonymise.map.json')].filter(Boolean);
  const f = cands.find(p => { try { return fs.statSync(p).isFile(); } catch (e) { return false; } });
  return f ? readJson(f) : null;
}
function anonymiser(map) {
  const codes = [];
  for (const c of map.codes || []) { codes.push(c); if (c.from.toLowerCase() !== c.from) codes.push({ from: c.from.toLowerCase(), to: c.to.toLowerCase() }); }
  codes.sort((a, b) => b.from.length - a.from.length);
  const by = Object.fromEntries(codes.map(c => [c.from, c.to]));
  const re = codes.length ? new RegExp(codes.map(c => c.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g') : null;
  return s => {
    for (const l of map.literals || []) s = s.split(l.from).join(l.to);
    return re ? s.replace(re, (m, i, str) => (/[A-Za-z]/.test(str[i - 1] || '') || /[0-9]/.test(str[i + m.length] || '') ? m : by[m])) : s;
  };
}

function build() {
  const { rows, errors } = collect();
  const map = anonMap();
  if (!map) errors.push('no anonymise map (tools/anonymise.map.json, or VRG_ANON_MAP): refusing to write client codes');
  else { const a = anonymiser(map); for (const r of rows) for (const k of ['name', 'where', 'note']) r[k] = a(r[k]); }
  const ids = new Set(), dup = [];
  for (const r of rows) { if (ids.has(r.id)) dup.push(r.id); ids.add(r.id); }
  if (dup.length) errors.push('duplicate ids: ' + dup.join(', '));
  const counts = Object.fromEntries(SOURCES.map(s => [s, rows.filter(r => r.source === s).length]));
  return { about: 'Every item of the VRG toolset, one row each. Generated by Dashboard/tools/inventory.js.', counts, total: rows.length, errors, rows };
}

if (require.main === module) {
  const inv = build();
  if (process.argv.includes('--json')) { process.stdout.write(JSON.stringify(inv, null, 1) + '\n'); process.exit(inv.errors.length ? 1 : 0); }
  if (inv.errors.some(e => /^no anonymise map/.test(e))) { console.log('inventory: ' + inv.errors[inv.errors.length - 1] + ' - nothing written'); process.exit(1); }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'inventory.json'), JSON.stringify(inv, null, 1) + '\n');
  fs.writeFileSync(path.join(OUT_DIR, 'INVENTORY.md'), markdown(inv) + '\n');
  console.log('inventory: ' + inv.total + ' rows -> ' + rel(OUT_DIR));
  for (const s of SOURCES) console.log('  ' + s.padEnd(10) + ' ' + inv.counts[s]);
  if (inv.errors.length) { console.log('errors:'); for (const e of inv.errors) console.log('  - ' + e); process.exit(1); }
}
module.exports = { build, collect, SOURCES };
