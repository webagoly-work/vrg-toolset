#!/usr/bin/env node
// classify.js — gives every inventory row an industry type (+ qualifier), a scope, a level, a parent and a one-line reason.
//   node Dashboard/tools/classify.js        read docs/desktop/inventory.json + launcher/vrg-catalog.json,
//                                           write docs/desktop/classification.json + CLASSIFICATION.md, print the counts
// A row that a catalog item lists in `from` takes that item's type and level ("is" the unit). Every other row is placed by
// the rules below and hangs behind a catalog item (its parent). The rules are the reasoning; the catalog is the decision.
//   type      one of the catalog's "types" (the glossary's fixed vocabulary); the detail goes in qualifier
//   scope     open      something a person can open or run → it has a level: user < dev < all
//             internal  code, config, id schemes, folders: never opened by itself → no level
//             roadmap   plans, ideas, stubs, planned items: not available yet → no level
// Rules write their type as 'type' or 'type / qualifier'.
'use strict';
const fs = require('fs'), path = require('path');
const { effectiveLevel } = require('../shell/lib/catalog.js');

const REPO = path.resolve(__dirname, '..', '..');
const FULL = fs.existsSync(path.join(REPO, '..', 'notes', 'features')) ? path.resolve(REPO, '..') : (process.env.VRG_FULL || 'H:\\VRG\\Full');
const DOCS = path.join(REPO, 'docs', 'desktop');
const readJson = f => JSON.parse(fs.readFileSync(f, 'utf8'));

const FEAT_TYPE = { app: 'application', feature: 'feature', program: 'third-party application', asset: 'asset', dev: 'utility / developer tool', plan: 'work package', idea: 'idea' };
const MOBILE_LEVEL = { user: ['M0', 'M1', 'M2', 'M7', 'M9', 'M12', 'M13'], dev: ['M3', 'M4', 'M5', 'M6', 'M8', 'M10', 'M11', 'M14', 'M16', 'M17'] };
const TOOL_PARENT = { anonymise: 'dev:repo', 'brief-state': 'council', 'build-hub': 'kapu', 'build-mobile-tools': 'mobile', 'check-hub': 'kapu', 'council-gate': 'council', 'hub-sign': 'kapu', solomon: 'solomon', standin: 'council', 'vrg-ctx': 'context' };
const DOC_PARENT = { mobile: 'mobile', city: 'codecity', hub: 'kapu', solomon: 'solomon', 'client-look': 'bridge', workflow: 'workflow-kit', handoff: 'dev:ai', housekeeping: 'dev:infra', 'go-archive': 'go', 'components-offline': 'vendor', 'services-server': 'servers', desktop: 'desktop' };
const DIR_PARENT = { ServiceKitCYD: 'servicekit-cyd', Firmware: 'esp-lab' };
const LANE_PARENT = { p: 'planner', m: 'workflow-kit', d: 'inventory', b: 'bridge', h: 'mobile', e: 'dev:hw', k: 'dev:knowledge', l: 'dev:look', f: 'dev:infra', x: 'programs' };
const SCOPES = ['open', 'internal', 'roadmap'];
const NOT_YET = ['planned', 'idea'];

// the naming collisions (U2): one word, several things → proposed names (HU · EN). The rename decisions are DESKU-Q in DECISIONS.md.
const COLLISIONS = [
  ['Console', 'Varler Console (field companion PWA, :8133) · Board Console (a dev board\'s web UI, :8790) · START (a text console UI) · Open MCT "installer console" (spike) · "console" = terminal in industry use',
    'Varler Console → **Varler Terep** (*Varler Field*, companion app); Board Console → **Board Web** (*device web UI*); START → **START tartalék indító** (*fallback launcher*); "konzol" kept only for terminals'],
  ['SUI', 'Planner "Simplified UI" (a mode of the Planner with a corner dial) · "Varler SUI" (HUD design tokens + ring, Console/design/tokens.json)',
    'Planner mode → **Egyszerű mód** (*Simple mode*); the corner dial component → **Sarokvezérlő** (*corner dial*, `sui-dial.js`); Varler SUI → **Varler HUD** (*HUD design system*)'],
  ['Dashboard / Irányítópult / Desktop', 'Irányítópult = the Electron app before U5 (`Dashboard/`) · Kezdőlap = its D0–D4 page · "VRG Desktop Dashboard" = feature f12 · VRG Desktop = the shell',
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
  // lv: 'user' | 'dev' | 'all' (scope open) | 'internal' | 'roadmap'
  const put = (r, t, lv, parent, why, unit) => {
    const [type, qualifier = ''] = String(t).split(' / ');
    const scope = lv === 'internal' || lv === 'roadmap' ? lv : 'open';
    out.push({ id: r.id, name: r.name, source: r.source, type, qualifier, scope, level: scope === 'open' ? lv : '', parent: parent || '', unit: unit || '', reason: why });
  };
  const ofItem = u => u.type + (u.qualifier ? ' / ' + u.qualifier : '');

  for (const r of inv.rows) {
    const u = owner[r.id];
    if (u) {
      if (NOT_YET.includes(u.status)) { put(r, ofItem(u), 'roadmap', u.parent || '', 'is the catalog item `' + u.id + '` (' + u.status + ')', u.id); continue; }
      const lv = effectiveLevel(u);
      put(r, ofItem(u), lv, u.parent || '', 'is the catalog item `' + u.id + '`' + (lv !== u.level ? ' (' + u.status + ': shown from ' + lv + ')' : ''), u.id); continue;
    }
    const id = r.id;
    let m;
    if (r.source === 'vrg-menu') {
      if ((m = /^menu:proj:(.)\/(.+)$/.exec(id))) { const p = devMenuOwner(m[1]); put(r, 'command', /phase/.test(r.where) ? 'all' : 'dev', p && p.id, 'a build / test / serve action of START ' + m[1] + ', drawn behind ' + (p ? p.id : '?')); continue; }
      if ((m = /^menu:dev:(.)\/(.+)$/.exec(id))) { const p = menuOwner('menu:dev:' + m[1]); put(r, 'command', p ? effectiveLevel(p) : 'dev', p && p.id, 'one variant of START ' + m[1] + ' (' + (p ? p.id : '?') + ')'); continue; }
      if (r.kind === 'server') { const p = serverOwner(id.slice(4)); put(r, 'service / local server', p && p.level === 'all' ? 'all' : 'dev', p && p.id, 'background process with a port: Dev, behind ' + (p ? p.id : '?')); continue; }
      if (r.kind === 'program') {
        if (/Git Bash/.test(r.name)) { put(r, 'third-party application / shell', 'dev', 'dev:repo', 'a developer shell'); continue; }
        if (/Node konzol/.test(r.name)) { put(r, 'runtime / console', 'dev', 'dev:infra', 'the Node runtime in a console'); continue; }
        put(r, /mappa/.test(r.name) ? 'folder / shortcut' : 'third-party application', 'all', 'programs', 'third-party program: All (the Desktop has its own browser, files and terminal)'); continue;
      }
      if (r.kind === 'backup.item') { put(r, 'command', 'dev', 'backup', 'a BACKUP menu action: maintenance'); continue; }
      if (r.kind === 'otg.item') { put(r, 'command / OTG', 'roadmap', 'otg', 'OTG phase 3.6, not built'); continue; }
      if (id === 'menu:bottom:Q') { put(r, 'command', 'all', 'start', 'START\'s own exit; the Desktop closes with its window controls'); continue; }
    }
    if (r.source === 'features') {
      const f = feats[id.slice(5)] || {};
      const type = FEAT_TYPE[f.kind] || 'feature';
      const p = (f.partOf || []).map(unitOfFeat).find(Boolean) || byId[LANE_PARENT[f.lane]];
      let level = 'user', why = 'tier ' + f.tier + ' ' + f.kind + ' in lane ' + f.lane;
      if (f.tier >= 4 || f.kind === 'plan' || f.kind === 'idea') { level = 'roadmap'; why += ': planned or an idea, not available yet'; }
      else if (f.kind === 'program') { level = 'all'; why += ': third-party, All'; }
      else if (f.kind === 'dev' || ['k', 'e', 'l', 'f'].includes(f.lane)) { level = 'dev'; why += ': development, knowledge, devices or look'; }
      else if (/\b(build|test|check|round)\b/i.test(f.title || '')) { level = 'dev'; why += ': build, test or a dev round'; }
      else why += ': part of the work';
      if (p && level === 'user' && effectiveLevel(p) !== 'user') level = effectiveLevel(p);
      put(r, type, level, p && p.id, why); continue;
    }
    if (r.source === 'dashboard') {
      if (r.kind === 'act family') { put(r, 'command family / action id scheme', 'internal', 'palette', 'an id scheme the palette and the main process resolve; never opened itself'); continue; }
      if (r.kind === 'config registry') { put(r, 'registry / config file', 'internal', 'desktop', 'settings data behind the VRG Asztal; edited through Beállítások, not opened'); continue; }
      if (r.kind === 'module') { put(r, 'module', 'internal', 'desktop', 'internal code unit'); continue; }
      if (id === 'pane:empty') { put(r, 'panel / placeholder', 'all', 'desktop', 'the empty tab a new group starts with'); continue; }
      if (id === 'pane:app') { put(r, 'panel / in-shell app host', 'internal', 'desktop', 'hosts a catalog HTML app on vrg-app://; the user opens the app, not the host'); continue; }
    }
    if (r.source === 'console') {
      const stub = /stub/.test(r.kind), cat2 = r.group;
      if (stub) { put(r, 'plugin / page stub', 'roadmap', 'console', 'manifest only, not built'); continue; }
      if (cat2 === 'dev') { put(r, 'plugin / page', 'dev', 'console', 'a dev page of the Console'); continue; }
      put(r, cat2 === 'widgets' ? 'widget' : 'plugin / page', 'user', 'console', 'a ' + cat2 + ' page of the field companion'); continue;
    }
    if (r.source === 'mobile') {
      const mm = id.slice(7);
      if (mm === 'catalogue') { put(r, 'registry / generated tool list', 'internal', 'mobile', 'the phone\'s tool list, generated'); continue; }
      const lv = MOBILE_LEVEL.user.includes(mm) ? 'user' : MOBILE_LEVEL.dev.includes(mm) ? 'dev' : 'roadmap';
      put(r, 'feature module / companion app', lv, 'mobile', lv === 'user' ? 'used in the field' : lv === 'dev' ? 'repo, CI, servers or knowledge on the phone' : 'planned'); continue;
    }
    if (r.source === 'tools') { const n = id.slice(5); put(r, 'cli tool', 'dev', TOOL_PARENT[n] || 'dev:infra', 'command-line script, run by START, a build, an agent or a developer'); continue; }
    if (r.source === 'prompts') { put(r, 'prompt template', 'dev', 'prompts', 'a session starter in the prompt library'); continue; }
    if (r.source === 'agents') {
      if (r.kind === 'ai agent') { put(r, 'ai agent / subagent definition', 'dev', 'council', 'a role with tools and limits, started from Claude Code'); continue; }
      if (r.kind === 'hook') { put(r, 'hook', 'internal', 'council', 'runs on a Claude Code event; never opened'); continue; }
    }
    if (r.source === 'shared') { put(r, 'library', 'internal', 'dev:look', 'shared code or assets other pages load'); continue; }
    if (r.source === 'docs') {
      if (r.kind === 'codephrase brief') { put(r, 'runbook / session entry point', 'dev', 'go', 'a GO codephrase file a session reads'); continue; }
      const n = id.slice(4);
      put(r, 'document set / pack', 'dev', DOC_PARENT[n] || 'docs', 'design, decisions and briefs'); continue;
    }
    if (r.source === 'folders') {
      if (r.kind === 'launcher part') { put(r, 'module / START launcher part', 'internal', id === 'launcher:vrg-git' ? 'commit' : 'start', 'a part of the START launcher'); continue; }
      const n = id.slice(4);
      const p = DIR_PARENT[n] ? byId[DIR_PARENT[n]] : null;
      put(r, 'folder / source', 'internal', p ? p.id : '', 'a top-level folder; what it holds is classified by its own rows'); continue;
    }
    put(r, 'unclassified', 'internal', '', 'no rule matched');
  }
  return { out, cat, inv };
}

const esc = s => String(s).replace(/\|/g, '\\|');
const tq = r => r.type + (r.qualifier ? ' · ' + r.qualifier : '');
function markdown({ out, cat }) {
  const L = ['user', 'dev', 'all'];
  const n = lv => out.filter(r => r.level === lv).length;
  const sc = s => out.filter(r => r.scope === s).length;
  const types = {};
  for (const r of out) types[r.type] = (types[r.type] || 0) + 1;
  const items = cat.items;
  const V = cat.types || {};
  const lines = [
    '# VRG classification', '',
    '*Generated by `node Dashboard/tools/classify.js` from `inventory.json` (what exists) and `launcher/vrg-catalog.json` (the decision).',
    'Terms: `GLOSSARY.md`. Re-run after the inventory or the catalog changes.*', '',
    '## The rule', '',
    'Every row gets a **type** from one fixed list (the catalog\'s `types` = the glossary\'s terms) plus a free **qualifier** for the detail',
    '("utility · calculator"), and a **scope**:', '',
    '- **open** — something a person can open or run. Only these have a **level**:',
    '  - **User** (*Felhasználó*): what a person opens to do the actual work — design, pricing, materials, field, files, mail, web — and the shell itself.',
    '    Only finished things: a User item that is still `dev` / `planned` shows from the Dev level on until it is `live` or `beta`.',
    '  - **Dev** (*Fejlesztő*): everything User has, plus what is secondary, background, build / test / maintenance or settings level. Each Dev item is drawn',
    '    **behind its parent**: a User item (Planner → build, test, gyro relay, Planner CYD) or one of six **dev roots** (type `category`) for items with no User parent:',
    '    ' + items.filter(i => i.type === 'category').map(i => '`' + i.id + '` ' + i.title.hu).join(' · ') + '.',
    '  - **All** (*Minden*): Dev plus third-party programs and the rest that is available but rarely needed.',
    '- **internal** — code modules, libraries, config, id schemes, hooks, source folders: real, but never opened by themselves. No level.',
    '- **roadmap** — plans, ideas, stubs and planned items: not available yet. No level (the features map is their home).', '',
    '| Scope · level | Rows | Catalog items |', '|---|---:|---:|',
    ...L.map(lv => '| open · ' + lv + ' | ' + n(lv) + ' | ' + items.filter(i => !NOT_YET.includes(i.status) && effectiveLevel(i) === lv).length + ' |'),
    '| internal | ' + sc('internal') + ' | 0 |',
    '| roadmap | ' + sc('roadmap') + ' | ' + items.filter(i => NOT_YET.includes(i.status)).length + ' |',
    '| **total** | **' + out.length + '** | **' + items.length + '** |', '',
    'The catalog\'s planned items keep `level: all` so the Dashboard\'s Katalógus can list them, marked *planned*; nothing opens them.', '',
    '## The catalog by level (what the Desktop shows)', '',
    '`level` is the shown level (User items that are not `live` / `beta` show from Dev; the declared level is in brackets).', '',
  ];
  for (const lv of L) {
    lines.push('### ' + lv, '', '| id | title (HU · *EN*) | type · qualifier | parent | group | status |', '|---|---|---|---|---|---|');
    for (const i of items.filter(x => effectiveLevel(x) === lv)) lines.push('| `' + i.id + '` | ' + esc(i.title.hu) + ' · *' + esc(i.title.en) + '*' + (i.level !== lv ? ' (' + i.level + ')' : '') + ' | ' + esc(tq(i)) + ' | ' + (i.parent ? '`' + i.parent + '`' : '') + ' | ' + i.group + (i.sub ? ' / ' + i.sub : '') + ' | ' + i.status + ' |');
    lines.push('');
  }
  lines.push('## Naming collisions and the proposed names', '', '| Word | What it means today | Proposal |', '|---|---|---|');
  for (const c of COLLISIONS) lines.push('| **' + c[0] + '** | ' + esc(c[1]) + ' | ' + esc(c[2]) + ' |');
  lines.push('', '## The type list (fixed) and its use', '', '| type | EN · HU | kind | rows |', '|---|---|---|---:|');
  for (const [k, v] of Object.entries(V)) lines.push('| `' + k + '` | ' + esc(v.en) + ' · ' + esc(v.hu) + ' | ' + v.kind + ' | ' + (types[k] || '') + ' |');
  lines.push('', '## Every row', '', '| id | name | type · qualifier | scope | level | parent | reason |', '|---|---|---|---|---|---|---|');
  for (const r of out) lines.push('| `' + r.id + '` | ' + esc(r.name) + ' | ' + esc(tq(r)) + ' | ' + r.scope + ' | ' + r.level + ' | ' + (r.parent ? '`' + r.parent + '`' : '') + ' | ' + esc(r.reason) + ' |');
  return lines.join('\n') + '\n';
}

// rows that break the rules: an unknown type, an open dev row with no parent, a parent the catalog does not know
function problems(res) {
  const V = res.cat.types || {};
  const known = new Set(res.cat.items.map(i => i.id));
  const declared = Object.fromEntries(res.cat.items.map(i => [i.id, i.level]));
  const out = [];
  for (const r of res.out) {
    if (!Object.prototype.hasOwnProperty.call(V, r.type)) out.push('type not in the list: ' + r.id + ' (' + r.type + ')');
    if (!SCOPES.includes(r.scope)) out.push('bad scope: ' + r.id);
    // a top-level User item that is not finished yet shows from Dev; it is still top-level, so it needs no parent
    if (r.scope === 'open' && r.level === 'dev' && !r.parent && !/^dev:/.test(r.unit) && declared[r.unit] !== 'user') out.push('no parent: ' + r.id);
    if (r.parent && !known.has(r.parent)) out.push('parent not in the catalog: ' + r.id + ' -> ' + r.parent);
  }
  return out;
}

if (require.main === module) {
  const res = classify();
  const bad = problems(res);
  fs.writeFileSync(path.join(DOCS, 'classification.json'), JSON.stringify({ about: 'Generated by Dashboard/tools/classify.js', rows: res.out }, null, 1) + '\n');
  fs.writeFileSync(path.join(DOCS, 'CLASSIFICATION.md'), markdown(res));
  const c = k => res.out.filter(k).length;
  console.log('classification: ' + res.out.length + ' rows; open ' + c(r => r.scope === 'open') + ' (user ' + c(r => r.level === 'user') + ', dev ' + c(r => r.level === 'dev') + ', all ' + c(r => r.level === 'all') + '), internal ' + c(r => r.scope === 'internal') + ', roadmap ' + c(r => r.scope === 'roadmap') + '; ' + Object.keys(Object.fromEntries(res.out.map(r => [r.type, 1]))).length + ' types used');
  for (const b of bad) console.log('  ! ' + b);
  process.exit(bad.length ? 1 : 0);
}
module.exports = { classify, problems, COLLISIONS };
