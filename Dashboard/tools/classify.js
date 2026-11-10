#!/usr/bin/env node
// classify.js — gives every inventory row an industry type, a level (user < dev < all), a parent and a one-line reason.
//   node Dashboard/tools/classify.js        read docs/desktop/inventory.json + launcher/vrg-catalog.json,
//                                           write docs/desktop/classification.json + CLASSIFICATION.md, print the counts
// A row that a catalog item lists in `from` takes that item's type and level ("is" the unit). Every other row is placed by
// the rules below and hangs behind a catalog item (its parent). The rules are the reasoning; the catalog is the decision.
'use strict';
const fs = require('fs'), path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const FULL = fs.existsSync(path.join(REPO, '..', 'notes', 'features')) ? path.resolve(REPO, '..') : (process.env.VRG_FULL || 'H:\\VRG\\Full');
const DOCS = path.join(REPO, 'docs', 'desktop');
const readJson = f => JSON.parse(fs.readFileSync(f, 'utf8'));

const FEAT_TYPE = { app: 'application', feature: 'feature', program: 'third-party application', asset: 'asset (data, docs, design)', dev: 'developer tool', plan: 'plan (work package)', idea: 'idea' };
const MOBILE_LEVEL = { user: ['M0', 'M1', 'M2', 'M7', 'M9', 'M12', 'M13'], dev: ['M3', 'M4', 'M5', 'M6', 'M8', 'M10', 'M11', 'M14', 'M16', 'M17'] };
const TOOL_PARENT = { anonymise: 'dev:repo', 'brief-state': 'council', 'build-hub': 'kapu', 'build-mobile-tools': 'mobile', 'check-hub': 'kapu', 'council-gate': 'council', 'hub-sign': 'kapu', solomon: 'solomon', standin: 'council', 'vrg-ctx': 'context' };
const DOC_PARENT = { mobile: 'mobile', city: 'codecity', hub: 'kapu', solomon: 'solomon', 'client-look': 'bridge', workflow: 'workflow-kit', handoff: 'dev:ai', housekeeping: 'dev:infra', 'go-archive': 'go', 'components-offline': 'vendor', 'services-server': 'servers', desktop: 'desktop' };
const DIR_PARENT = { ServiceKitCYD: 'servicekit-cyd', Firmware: 'esp-lab' };
const LANE_PARENT = { p: 'planner', m: 'workflow-kit', d: 'inventory', b: 'bridge', h: 'mobile', e: 'dev:hw', k: 'dev:knowledge', l: 'dev:look', f: 'dev:infra', x: 'programs' };

// the naming collisions (U2): one word, several things → proposed names (HU · EN). The rename decisions are DESKU-Q in DECISIONS.md.
const COLLISIONS = [
  ['Console', 'Varler Console (field companion PWA, :8133) · Board Console (a dev board\'s web UI, :8790) · START (a text console UI) · Open MCT "installer console" (spike) · "console" = terminal in industry use',
    'Varler Console → **Varler Terep** (*Varler Field*, companion app); Board Console → **Board Web** (*device web UI*); START → **START tartalék indító** (*fallback launcher*); "konzol" kept only for terminals'],
  ['SUI', 'Planner "Simplified UI" (a mode of the Planner with a corner dial) · "Varler SUI" (HUD design tokens + ring, Console/design/tokens.json)',
    'Planner mode → **Egyszerű mód** (*Simple mode*); the corner dial component → **Sarokvezérlő** (*corner dial*, `sui-dial.js`); Varler SUI → **Varler HUD** (*HUD design system*)'],
  ['Dashboard / Irányítópult / Desktop', 'Irányítópult = the Electron app today (`Dashboard/`) · Kezdőlap = its D0–D4 page · "VRG Desktop Dashboard" = feature f12 · VRG Desktop = the planned shell',
    'the program → **VRG Asztal** (*VRG Desktop*, the shell, `VRG Desktop.exe`); its two primary views → **Irányítópult nézet** (*Dashboard view*, the Kezdőlap grows into it) and **Asztal nézet** (*Desktop view*); folder `Dashboard/` keeps its name for now'],
  ['Rétegverem', 'the VRG Stack (whole system) · `stack-search.html` · START R submenu · the Dashboard pane "stack" (context packs) · VRG Mobile M17',
    'system → **VRG Rétegverem** (*VRG Stack*); `stack-search.html` → **Rétegkereső** (*Stack search*); the pane → **Kontextuscsomag** (*Context packs*)'],
  ['Napló', 'START N (git log) · DevLog (fejlesztési napló) · Futásnapló (U layer) · Döntésnapló (Q layer) · the Desktop audit log',
    'START N → **Git napló** (*Git log*); the others keep their compound names, never bare "Napló"'],
  ['Kapu', 'the sign-in gate · the guest tool page `vrg-kapu.html` · Kapu segéd (companion server :8795) · Kapu admin (:8798)',
    'gate → **Kapu (belépés)** (*Gate*); page → **Kapu vendégoldal** (*Guest page*); keep segéd / admin'],
  ['Toolbox', '`toolbox.html` (a hub page of tools, START 7) · the `Toolbox/` folder (holds the Valena picker)',
    'retire `toolbox.html` into the catalog; folder → `Pickers/` later (a rename touches START 5 and OTG; Founder\'s call)'],
  ['Munkamenet / Munkatér / session', 'Zen munkamenet (browser tab sets, START Z) · Munkaterek (saved Desktop layouts) · a Claude session',
    'Zen sessions retire into **Munkaterek** (*Workspaces*); "munkamenet" kept for Claude sessions only'],
  ['Gömb', 'Solomon Gömb (G layer, desktop) · VRG Mobile M14 Gömb (the same signals on the phone)',
    'one thing on two surfaces: keep **Solomon Gömb**; EN **Solomon Sphere** everywhere (not "Data Globe")'],
  ['Indítópult', 'VRG Mobile M11 (START from the phone) · START itself · the Irányítópult',
    'M11 → **Távindító** (*Remote launcher*)'],
];

function classify() {
  const inv = readJson(path.join(DOCS, 'inventory.json'));
  const cat = readJson(path.join(REPO, 'launcher', 'vrg-catalog.json'));
  const feats = (() => { try { return Object.fromEntries(readJson(path.join(FULL, 'notes', 'features', 'features.json')).features.map(f => [f.id, f])); } catch (e) { return {}; } })();
  const items = cat.items, byId = Object.fromEntries(items.map(i => [i.id, i]));
  const owner = {};                                                  // inventory id → catalog item that "is" it
  for (const it of items) for (const f of it.from || []) owner[f] = it;
  const unitOfFeat = fid => owner['feat:' + fid];
  const devMenuOwner = k => items.find(i => i.devMenu === k);
  const menuOwner = id => owner[id];
  const serverOwner = s => items.find(i => (i.servers || []).includes(s));

  const out = [];
  const put = (r, type, level, parent, why, unit) => out.push({ id: r.id, name: r.name, source: r.source, type, level, parent: parent || '', unit: unit || '', reason: why });

  for (const r of inv.rows) {
    const u = owner[r.id];
    if (u) { put(r, u.type, u.level, u.parent || '', 'is the catalog item `' + u.id + '`', u.id); continue; }
    const id = r.id;
    let m;
    if (r.source === 'vrg-menu') {
      if ((m = /^menu:proj:(.)\/(.+)$/.exec(id))) { const p = devMenuOwner(m[1]); put(r, 'command', /phase/.test(r.where) ? 'all' : 'dev', p && p.id, 'a build / test / serve action of START ' + m[1] + ', drawn behind ' + (p ? p.id : '?')); continue; }
      if ((m = /^menu:dev:(.)\/(.+)$/.exec(id))) { const p = menuOwner('menu:dev:' + m[1]); put(r, 'command', p ? p.level : 'dev', p && p.id, 'one variant of START ' + m[1] + ' (' + (p ? p.id : '?') + ')'); continue; }
      if (r.kind === 'server') { const p = serverOwner(id.slice(4)); put(r, 'service (local server)', p && p.level === 'all' ? 'all' : 'dev', p && p.id, 'background process with a port: Dev, behind ' + (p ? p.id : '?')); continue; }
      if (r.kind === 'program') {
        if (/Git Bash/.test(r.name)) { put(r, 'third-party application (shell)', 'dev', 'dev:repo', 'a developer shell'); continue; }
        if (/Node konzol/.test(r.name)) { put(r, 'runtime console', 'dev', 'dev:infra', 'the Node runtime in a console'); continue; }
        put(r, /mappa/.test(r.name) ? 'folder shortcut' : 'third-party application', 'all', 'programs', 'third-party program: All (the Desktop has its own browser, files and terminal)'); continue;
      }
      if (r.kind === 'backup.item') { put(r, 'command', 'dev', 'backup', 'a BACKUP menu action: maintenance'); continue; }
      if (r.kind === 'otg.item') { put(r, 'command (planned)', 'all', 'otg', 'OTG phase 3.6, not built'); continue; }
      if (id === 'menu:bottom:Q') { put(r, 'command', 'all', 'start', 'START\'s own exit; the Desktop closes with its window controls'); continue; }
    }
    if (r.source === 'features') {
      const f = feats[id.slice(5)] || {};
      const type = FEAT_TYPE[f.kind] || 'feature';
      const p = (f.partOf || []).map(unitOfFeat).find(Boolean) || byId[LANE_PARENT[f.lane]];
      let level = 'user', why = 'tier ' + f.tier + ' ' + f.kind + ' in lane ' + f.lane;
      if (f.tier >= 4 || f.kind === 'plan' || f.kind === 'idea') { level = 'all'; why += ': planned or an idea, All'; }
      else if (f.kind === 'program') { level = 'all'; why += ': third-party, All'; }
      else if (f.kind === 'dev' || ['k', 'e', 'l', 'f'].includes(f.lane)) { level = 'dev'; why += ': development, knowledge, devices or look'; }
      else if (/\b(build|test|check|round)\b/i.test(f.title || '')) { level = 'dev'; why += ': build, test or a dev round'; }
      else why += ': part of the work';
      if (p && level === 'user' && p.level !== 'user') level = p.level;
      put(r, type, level, p && p.id, why); continue;
    }
    if (r.source === 'dashboard') {
      if (r.kind === 'act family') { put(r, 'command family (action id scheme)', 'all', 'palette', 'internal id scheme the palette and the main process resolve'); continue; }
      if (r.kind === 'config registry') { put(r, 'registry (config file)', 'dev', 'desktop', 'settings-level data behind the VRG Asztal'); continue; }
      if (r.kind === 'module') { put(r, 'module', 'all', 'desktop', 'internal code unit, never shown as a tile'); continue; }
      if (id === 'pane:empty') { put(r, 'panel (placeholder)', 'all', 'desktop', 'the empty tab a new group starts with'); continue; }
    }
    if (r.source === 'console') {
      const stub = /stub/.test(r.kind), cat2 = r.group;
      if (stub) { put(r, 'page (plugin, stub)', 'all', 'console', 'manifest only, not built'); continue; }
      if (cat2 === 'dev') { put(r, 'page (plugin)', 'dev', 'console', 'a dev page of the Console'); continue; }
      put(r, cat2 === 'widgets' ? 'widget' : 'page (plugin)', 'user', 'console', 'a ' + cat2 + ' page of the field companion'); continue;
    }
    if (r.source === 'mobile') {
      const mm = id.slice(7);
      if (mm === 'catalogue') { put(r, 'registry', 'dev', 'mobile', 'the phone\'s tool list, generated'); continue; }
      const lv = MOBILE_LEVEL.user.includes(mm) ? 'user' : MOBILE_LEVEL.dev.includes(mm) ? 'dev' : 'all';
      put(r, 'feature module (companion app)', lv, 'mobile', lv === 'user' ? 'used in the field' : lv === 'dev' ? 'repo, CI, servers or knowledge on the phone' : 'planned'); continue;
    }
    if (r.source === 'tools') { const n = id.slice(5); put(r, 'CLI tool', 'dev', TOOL_PARENT[n] || 'dev:infra', 'command-line script, run by START, a build or an agent'); continue; }
    if (r.source === 'prompts') { put(r, 'prompt template', 'dev', 'prompts', 'a session starter in the prompt library'); continue; }
    if (r.source === 'agents') {
      if (r.kind === 'ai agent') { put(r, 'AI agent (subagent definition)', 'dev', 'council', 'a role with tools and limits, run by Claude Code'); continue; }
      if (r.kind === 'hook') { put(r, 'hook', 'dev', 'council', 'runs on a Claude Code event'); continue; }
    }
    if (r.source === 'shared') { put(r, 'library', 'dev', 'dev:look', 'shared code or assets'); continue; }
    if (r.source === 'docs') {
      if (r.kind === 'codephrase brief') { put(r, 'runbook (session entry point)', 'dev', 'go', 'a GO codephrase file a session reads'); continue; }
      const n = id.slice(4);
      put(r, 'document pack', 'dev', DOC_PARENT[n] || 'docs', 'design, decisions and briefs'); continue;
    }
    if (r.source === 'folders') {
      if (r.kind === 'launcher part') { put(r, 'module', 'all', id === 'launcher:vrg-git' ? 'commit' : 'start', 'a part of the START launcher'); continue; }
      const n = id.slice(4);
      const p = DIR_PARENT[n] ? byId[DIR_PARENT[n]] : null;
      put(r, 'source folder', 'all', p ? p.id : '', 'a top-level folder; what it holds is classified by its own rows'); continue;
    }
    put(r, 'unclassified', 'all', '', 'no rule matched');
  }
  return { out, cat, inv };
}

const esc = s => String(s).replace(/\|/g, '\\|');
function markdown({ out, cat, inv }) {
  const L = ['user', 'dev', 'all'];
  const n = lv => out.filter(r => r.level === lv).length;
  const types = {};
  for (const r of out) types[r.type] = (types[r.type] || 0) + 1;
  const items = cat.items;
  const lines = [
    '# VRG classification', '',
    '*Generated by `node Dashboard/tools/classify.js` from `inventory.json` (what exists) and `launcher/vrg-catalog.json` (the decision).',
    'Terms: `GLOSSARY.md`. Re-run after the inventory or the catalog changes.*', '',
    '## The rule', '',
    '- **User** (*Felhasználó*): what a person opens to do the actual work — design, pricing, materials, field, files, mail, web — and the shell itself.',
    '- **Dev** (*Fejlesztő*): everything User has, plus what is secondary, background, build / test / maintenance or settings level. Each Dev item is drawn',
    '  **behind its parent**: a User item (Planner → build, test, gyro relay, Planner CYD) or one of six **dev roots** for items with no User parent:',
    '  ' + items.filter(i => i.type === 'dev root').map(i => '`' + i.id + '` ' + i.title.hu).join(' · ') + '.',
    '- **All** (*Minden*): Dev plus third-party programs, tier 4–5 plans and ideas, stubs, spikes, internal modules and id schemes — the flat, filterable catalog.', '',
    '| Level | Rows | Catalog items |', '|---|---:|---:|',
    ...L.map(lv => '| ' + lv + ' | ' + n(lv) + ' | ' + items.filter(i => i.level === lv).length + ' |'),
    '| **total** | **' + out.length + '** | **' + items.length + '** |', '',
    '## The catalog by level (what the Desktop shows)', '',
  ];
  for (const lv of L) {
    lines.push('### ' + lv, '', '| id | title (HU · *EN*) | type | parent | group | status |', '|---|---|---|---|---|---|');
    for (const i of items.filter(x => x.level === lv)) lines.push('| `' + i.id + '` | ' + esc(i.title.hu) + ' · *' + esc(i.title.en) + '* | ' + esc(i.type) + ' | ' + (i.parent ? '`' + i.parent + '`' : '') + ' | ' + i.group + (i.sub ? ' / ' + i.sub : '') + ' | ' + i.status + ' |');
    lines.push('');
  }
  lines.push('## Naming collisions and the proposed names', '', '| Word | What it means today | Proposal |', '|---|---|---|');
  for (const c of COLLISIONS) lines.push('| **' + c[0] + '** | ' + esc(c[1]) + ' | ' + esc(c[2]) + ' |');
  lines.push('', '## Types in use', '', '| Type | Rows |', '|---|---:|');
  for (const [t, c] of Object.entries(types).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) lines.push('| ' + esc(t) + ' | ' + c + ' |');
  lines.push('', '## Every row', '', '| id | name | type | level | parent | reason |', '|---|---|---|---|---|---|');
  for (const r of out) lines.push('| `' + r.id + '` | ' + esc(r.name) + ' | ' + esc(r.type) + ' | ' + r.level + ' | ' + (r.parent ? '`' + r.parent + '`' : '') + ' | ' + esc(r.reason) + ' |');
  return lines.join('\n') + '\n';
}

if (require.main === module) {
  const res = classify();
  const bad = res.out.filter(r => r.type === 'unclassified' || (r.level === 'dev' && !r.parent && !/^dev:/.test(r.unit)));
  const known = new Set(res.cat.items.map(i => i.id));
  const orphan = res.out.filter(r => r.parent && !known.has(r.parent));
  fs.writeFileSync(path.join(DOCS, 'classification.json'), JSON.stringify({ about: 'Generated by Dashboard/tools/classify.js', rows: res.out }, null, 1) + '\n');
  fs.writeFileSync(path.join(DOCS, 'CLASSIFICATION.md'), markdown(res));
  console.log('classification: ' + res.out.length + ' rows; user ' + res.out.filter(r => r.level === 'user').length + ', dev ' + res.out.filter(r => r.level === 'dev').length + ', all ' + res.out.filter(r => r.level === 'all').length);
  for (const r of bad) console.log('  ! no parent or no rule: ' + r.id);
  for (const r of orphan) console.log('  ! parent not in the catalog: ' + r.id + ' -> ' + r.parent);
  process.exit(bad.length || orphan.length ? 1 : 0);
}
module.exports = { classify, COLLISIONS };
