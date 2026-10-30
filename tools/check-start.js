#!/usr/bin/env node
// ---------------------------------------------------------------------------
// check-start.js — keep the START launcher honest.
//
// START is the single entry point to the whole toolset, so a tool that is
// missing from it effectively does not exist for the person at the keyboard,
// and an entry pointing at a moved file is worse: the launcher looks fine
// until someone picks that key.
//
// Since 2026-10-27 (re-root phase 3.2) the menu is launcher/vrg-menu.json, drawn
// by launcher/vrg-ui.ps1; Planner/START.cmd and VRG-DE.cmd only forward to it.
// This checks:
//   1. every file the registry names exists: tool pages, programs, step
//      commands, servers' scripts, folders (an 'optional' program that is
//      missing is listed, not an error)
//   2. no key twice on one screen, every item does something, no port twice,
//      every server an item refers to exists
//   3. the old launchers still forward to the new one
//   4. no obvious tool page in the repo is missing from the registry
//
//   node tools/check-start.js
//
// Exit code 1 if anything is wrong, so it can gate a commit.
// ---------------------------------------------------------------------------

'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const MENU = path.join(REPO, 'launcher', 'vrg-menu.json');
const SHIMS = [path.join(REPO, 'Planner', 'START.cmd'), path.join(REPO, 'VRG-DE.cmd')];

/* Where a tool page can plausibly live. Anything matching here but absent
   from the registry is reported — it is the "you added a tool and forgot the
   launcher" case, which is the whole reason this script exists. */
const TOOL_GLOBS = [
  { dir: '.', depth: 0 },
  { dir: 'Calculator', depth: 0 },
  { dir: 'MindMap', depth: 0 },
  { dir: 'Modder', depth: 0 },
  { dir: 'Toolbox', depth: 0 },
  { dir: 'Inventory/dist', depth: 0 },
  { dir: 'Planner/projects/varler-planner/dist', depth: 0 }
];

/* Not tools, whatever their extension says. */
const IGNORE = [
  /\.backup-/i,          // vrg_mindmap.backup-<stamp>.html
  /^varler_mindmd2\.html$/i,   // the dead MindMap ancestor, kept on purpose
  /^index\.html$/i,
  /node_modules/,
  /^Vendor[\\/]/
];

function read(file) {
  try { return fs.readFileSync(file, 'utf8'); }
  catch (e) { console.error('Nem olvashato: ' + file); process.exit(1); }
}

function listHtml(rel) {
  const dir = path.join(REPO, rel);
  let out = [];
  try {
    for (const name of fs.readdirSync(dir)) {
      if (!/\.html?$/i.test(name)) continue;
      const relPath = path.join(rel, name).split(path.sep).join('/');
      if (IGNORE.some(re => re.test(name) || re.test(relPath))) continue;
      out.push(relPath.replace(/^\.\//, ''));
    }
  } catch (e) { /* a folder that does not exist is simply not a source of tools */ }
  return out;
}

const problems = [];
const notes = [];
const menuNotes = [];      // optional programs that are not installed: shown, not an error
const toolLines = [];
const registered = new Set();

// --- 1 + 2: the registry ----------------------------------------------------
let menu = null;
try { menu = JSON.parse(read(MENU).replace(/^﻿/, '')); }
catch (e) { problems.push('vrg-menu.json nem ervenyes JSON: ' + e.message); }

if (menu) {
  const FULL = path.dirname(REPO);
  // the same tokens as vrg-ui.ps1: the registry's own "paths" shortcuts first, then {repo} {full} {vrg}
  const short = menu.paths || {};
  const tok = s => {
    for (let i = 0; i < 3 && s.includes('{'); i++) for (const k of Object.keys(short)) s = s.split('{' + k + '}').join(short[k]);
    return path.normalize(s.split('{repo}').join(REPO).split('{full}').join(FULL).split('{vrg}').join(path.dirname(FULL)));
  };
  const exists = s => fs.existsSync(tok(s));
  const rel = s => path.relative(REPO, tok(s)).split(path.sep).join('/');
  const SHELL = /^(cmd|powershell|explorer)\.exe$/i;
  const J = 'vrg-menu.json: ';
  const serverIds = new Set((menu.servers || []).map(s => s.id));
  // An item does something when it has one of these (vrg-ui.ps1 Act decides in the same order).
  const DOES = ['phase', 'menu', 'servers', 'programs', 'prompts', 'steps', 'groups', 'path', 'exe', 'server', 'url', 'folder', 'action', 'js', 'bat'];

  // One list of items on one screen: keys unique, every item does something, every file it names exists.
  function walk(list, where, reserved) {
    const seen = Object.assign({}, reserved || {});
    for (const it of list || []) {
      const k = String(it.key || '').toUpperCase();
      const label = where + ' ' + k + ' (' + it.name + ')';
      if (!k) problems.push(J + where + ': "' + it.name + '" nem kapott billentyut.');
      else if (seen[k]) problems.push(J + where + ': a(z) ' + k + ' billentyu ketszer szerepel (' + seen[k] + ', ' + it.name + ').');
      else seen[k] = it.name;
      if (!DOES.some(f => it[f])) problems.push(J + label + ' nem csinal semmit.');
      const need = [];
      for (const f of ['path', 'then', 'folder', 'prompts', 'cwd', 'needs', 'js', 'bat']) if (it[f]) need.push(it[f]);
      if (it.exe && !SHELL.test(it.exe) && !(it.ensure && it.ensure.path === it.exe)) need.push(it.exe);
      for (const st of [].concat(it.steps || [], it.ensure || [], it.before || [])) if (st.exe && !SHELL.test(st.exe)) need.push(st.exe);
      for (const g of it.groups || []) for (const p of g) if (!/^https?:/.test(p)) need.push(p);
      for (const p of need) {
        if (exists(p)) continue;
        if (it.optional) menuNotes.push(label + ': ' + p);
        else problems.push(J + label + ' nem letezo fajlra mutat:\n      ' + p);
      }
      for (const p of [it.path, it.then].concat(...(it.groups || []))) if (p && /\.html?$/i.test(p)) registered.add(rel(p));
      if (it.server && !serverIds.has(it.server)) problems.push(J + label + ' ismeretlen szerverre hivatkozik: ' + it.server);
      if (it.menu) walk(it.menu.items, where + ' > ' + k, { X: '(Vissza)' });
      if (it.extras) walk(it.extras, where + ' > ' + k + ' bongeszo', { '0': '(Vissza)', M: '(Mappa)', 1: 'Chrome', 2: 'Opera GX', 3: 'Zen', 4: '(alapertelmezett)' });
    }
  }
  const start = menu.start || {};
  walk([].concat(start.tools || [], start.projects || [], start.dev || [], start.bottom || []), 'START');
  walk(menu.programs, 'Programok', { X: '(Vissza)' });
  walk(menu.servers, 'Szerverek', { A: '(mind)', X: '(Vissza)' });
  for (const m of ['backup', 'otg']) {
    if (!menu[m]) { problems.push(J + 'nincs "' + m + '" menu (H:\\VRG\\' + m.toUpperCase() + '.cmd erre mutat).'); continue; }
    walk([].concat(menu[m].items || [], menu[m].bottom || []), m.toUpperCase());
  }
  const ports = {};
  for (const s of menu.servers || []) {
    if (ports[s.port]) problems.push(J + 'a ' + s.port + ' port ketszer szerepel (' + ports[s.port] + ', ' + s.name + ').');
    ports[s.port] = s.name;
  }
  for (const b of menu.browsers || []) if (b.exe && !exists(b.exe)) menuNotes.push('bongeszo ' + b.name + ': ' + b.exe);
  for (const r of menu.repos || []) if (!exists(r.path)) problems.push(J + 'a(z) ' + r.name + ' repo nem talalhato: ' + r.path);
  for (const t of start.tools || []) {
    toolLines.push('  ' + (exists(t.path || '') ? 'ok     ' : 'HIANYZIK') + ' ' + String(t.key).padEnd(4) + String(t.name).slice(0, 44).padEnd(46) + t.path);
  }
}

// --- 3: the old launchers forward to the new one ---------------------------
for (const f of SHIMS) {
  if (!fs.existsSync(f)) { problems.push(path.relative(REPO, f) + ' hianyzik (a regi parancsikonok erre mutatnak).'); continue; }
  if (!/launcher\\vrg-start\.cmd/i.test(read(f))) problems.push(path.relative(REPO, f) + ' nem a launcher\\vrg-start.cmd-re iranyit.');
}
// H:\VRG\START.cmd / BACKUP.cmd / OTG.cmd (one level above Full) open their menu through vrg-launch.cmd
const VRG = path.dirname(path.dirname(REPO));
for (const [f, m] of [['START', 'start'], ['BACKUP', 'backup'], ['OTG', 'otg']]) {
  const p = path.join(VRG, f + '.cmd');
  if (!fs.existsSync(p)) { problems.push(p + ' hianyzik.'); continue; }
  const t = read(p);
  if (!new RegExp('launcher\\\\vrg-launch\\.cmd[\\s\\S]*call "%VRG_LAUNCH%" ' + m + ' %\\*', 'i').test(t)) problems.push(p + ' nem a launcher\\vrg-launch.cmd ' + m + ' menujet nyitja.');
  if (/[^\r]\n/.test(t)) problems.push(p + ': nem CRLF sorvegu (cmd.exe felreolvassa).');
}
for (const f of ['vrg-launch.cmd', 'vrg-start.cmd']) if (/[^\r]\n/.test(read(path.join(REPO, 'launcher', f)))) problems.push('launcher\\' + f + ': nem CRLF sorvegu.');

// --- 4: tools the registry has never heard of ------------------------------
for (const g of TOOL_GLOBS) for (const f of listHtml(g.dir)) if (!registered.has(f)) notes.push(f);

// --- report ----------------------------------------------------------------
console.log('launcher/vrg-menu.json: ' + toolLines.length + ' eszkoz');
for (const l of toolLines) console.log(l);

if (menuNotes.length) {
  console.log('\nNincs telepitve (a menu jelzi, nem hiba):');
  for (const n of menuNotes) console.log('   - ' + n);
}

if (notes.length) {
  console.log('\nEzek a lapok nincsenek a menuben - szandekos, vagy kimaradtak?');
  for (const f of notes) console.log('   ? ' + f);
}

if (problems.length) {
  console.log('\n' + problems.length + ' hiba:');
  for (const p of problems) console.log('  - ' + p);
  process.exitCode = 1;
} else {
  console.log('\nRendben: minden bejegyzes letezo fajlra mutat.');
}
