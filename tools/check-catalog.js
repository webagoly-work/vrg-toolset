#!/usr/bin/env node
// check-catalog.js — checks launcher/vrg-catalog.json (WHAT exists) against vrg-menu.json (HOW to run) and the features map.
//   node tools/check-catalog.js        exit 0 = valid, 1 = something is wrong (it can gate a commit, like check-start.js)
// Errors: a duplicate or bad id, a launch ref that does not resolve (START act, server, pane kind, features node), a dev item
// without a valid parent, an unknown group / section / server / submenu, a parent cycle. Then it lists START and features apps
// the catalog does not know (not an error: a thing can hang behind a parent), and catalog `from` ids the inventory lacks.
// Console output stays ASCII.
'use strict';
const fs = require('fs'), path = require('path');
const REPO = path.resolve(__dirname, '..');
const build = require(path.join(REPO, 'Dashboard', 'build.js'));
const { KINDS } = require(path.join(REPO, 'Dashboard', 'shell', 'lib', 'layout.js'));
const { createCatalog } = require(path.join(REPO, 'Dashboard', 'shell', 'lib', 'catalog.js'));

const ascii = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '?');
let C;
try { C = build.collect(); } catch (e) { console.log('Hiba: a registry nem toltheto be: ' + ascii(e.message)); process.exit(1); }
const cat = createCatalog({ file: path.join(REPO, 'launcher', 'vrg-catalog.json'), collect: () => C, kinds: KINDS });
const errors = cat.load();
const raw = cat.raw();

const count = lv => raw.items.filter(i => i.level === lv).length;
console.log('VRG katalogus: ' + raw.items.length + ' elem (user ' + count('user') + ', dev ' + count('dev') + ', all ' + count('all') + ')');

// what the catalog covers: its `from` ids, plus every act an item launches and every submenu it owns
const from = new Set(raw.items.flatMap(i => i.from || []));
const acts = new Set(raw.items.map(i => i.launch && i.launch.act).filter(Boolean));
const owned = new Set(raw.items.map(i => i.devMenu).filter(Boolean));
const unknown = [];
const st = (C.menu && C.menu.start) || {};
for (const t of st.tools || []) if (!from.has('menu:tool:' + t.key) && !acts.has('s:' + t.key)) unknown.push('START ' + t.key + ' ' + t.name);
for (const p of st.projects || []) if (!from.has('menu:proj:' + p.key) && !owned.has(p.key)) unknown.push('START ' + p.key + ' ' + p.name + ' (submenu)');
for (const d of st.dev || []) if (!from.has('menu:dev:' + d.key) && !acts.has('s:' + d.key)) unknown.push('START ' + d.key + ' ' + d.name);
for (const f of (C.data && C.data.features) || []) if (f.kind === 'app' && f.tier <= 3 && !from.has('feat:' + f.id)) unknown.push('features ' + f.id + ' ' + f.title);
if (unknown.length) {
  console.log('');
  console.log('Ezeket a katalogus nem ismeri (nem hiba, ha egy szulo moge tartoznak):');
  for (const u of unknown) console.log('   ? ' + ascii(u));
}

const invFile = path.join(REPO, 'docs', 'desktop', 'inventory.json');
if (fs.existsSync(invFile)) {
  try {
    const ids = new Set(JSON.parse(fs.readFileSync(invFile, 'utf8')).rows.map(r => r.id));
    const miss = [...from].filter(f => !ids.has(f));
    if (miss.length) {
      console.log('');
      console.log('A leltarban nincs ilyen sor (futtasd ujra: node Dashboard/tools/inventory.js):');
      for (const m of miss) console.log('   ? ' + ascii(m));
    }
  } catch (e) {}
}

console.log('');
if (errors.length) {
  console.log(errors.length + ' hiba:');
  for (const e of errors) console.log('  - ' + ascii(e));
  process.exit(1);
}
console.log('Rendben: minden hivatkozas feloldhato, minden fejlesztoi elemnek van szuloje.');
