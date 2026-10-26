#!/usr/bin/env node
// build.js — VRG Kódváros: one offline HTML page from src/ + Vendor/three.
//
//   node CodeCity/build.js            -> dist/vrg-codecity.html (empty; opens a city.json)
//     the empty page first tries vrg-codecity.data.js beside it (scan.js --js): this repo, the default view
//   require('./build.js').buildPage(city)  -> the same page with that city inside (scan.js --html)
//
// Same recipe as Planner/projects/client-preview/build.js: three.module.min.js runs in its own
// function and hands back its exports as a THREE object, then src/NN-*.js follow in filename
// order, all in ONE inline <script type="module"> — so the page works from file:// with no server.
// three.js is MIT: its licence header travels with it.
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = __dirname, REPO = path.resolve(ROOT, '..');
const VENDOR = path.join(REPO, 'Vendor', 'three');

function need(p) {
  if (!fs.existsSync(p)) { console.error(`missing ${p}\n  run from the repo root: node tools/fetch-vendor.js three`); process.exit(1); }
  return fs.readFileSync(p, 'utf8');
}
function threeAsObject(src) {
  const m = /export\s*\{([^}]*)\}\s*;?\s*$/.exec(src);
  if (!m) throw new Error('three.module.min.js: final export list not found — did the build layout change?');
  const pairs = m[1].split(',').map(s => s.trim()).filter(Boolean).map(s => {
    const p = s.split(/\s+as\s+/); return `${p[1] || p[0]}:${p[0]}`; });
  return `const THREE=(()=>{\n${src.slice(0, m.index)}\nreturn{${pairs.join(',')}};\n})();\n`;
}

function buildPage(city) {
  const threePkg = JSON.parse(need(path.join(VENDOR, 'package.json')));
  const header = `/* three.js r${threePkg.version.split('.')[1]} (npm three@${threePkg.version}) — https://threejs.org
   The MIT License — Copyright © 2010-2024 three.js authors */\n`;
  const srcDir = path.join(ROOT, 'src');
  const mods = fs.readdirSync(srcDir).filter(f => /^\d\d-.*\.js$/.test(f)).sort();
  const ours = mods.map(f => `// ==== src/${f}\n` + fs.readFileSync(path.join(srcDir, f), 'utf8')).join('\n');
  // the Land's places on their fixed hex slots (CodeCity/land.json), for 29-land.js — in the page, so file:// has them too
  const land = fs.existsSync(path.join(ROOT, 'land.json')) ? fs.readFileSync(path.join(ROOT, 'land.json'), 'utf8') : 'null';
  const script = header + threeAsObject(need(path.join(VENDOR, 'build', 'three.module.min.js'))) + `const LAND = ${land.trim()};\n` + ours;
  if (/<\/script/i.test(script)) throw new Error('a literal </script inside the module would end it early');
  // a module that fails to parse fails silently in the page — parse it here instead
  try { new (require('vm').Script)(script, { filename: 'codecity-module.js' }); }
  catch (e) { throw new Error('the page script does not parse:\n' + e.stack.split('\n').slice(0, 4).join('\n')); }
  const data = city ? JSON.stringify(city).replace(/</g, '\\u003c') : 'null';
  return fs.readFileSync(path.join(srcDir, 'shell.html'), 'utf8')
    .replace('/*__CSS__*/', () => fs.readFileSync(path.join(srcDir, 'city.css'), 'utf8'))
    .replace('/*__CITY__*/null', () => data)
    // a missing data file is just a failed classic script: the page falls back to the drop zone
    .replace('<!--__DEFAULT__-->', city ? '' : '<script src="vrg-codecity.data.js"></script>')
    .replace('/*__SCRIPT__*/', () => script);
}
module.exports = { buildPage };

if (require.main === module) {
  const out = path.join(ROOT, 'dist', 'vrg-codecity.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const html = buildPage(null);
  fs.writeFileSync(out, html);
  console.log(`built ${path.relative(process.cwd(), out)} — ${(html.length / 1024).toFixed(0)} KB`);
}
