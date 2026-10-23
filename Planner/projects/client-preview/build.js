#!/usr/bin/env node
// build.js — the client preview: one offline HTML page from src/ + Vendor/three.
//
//   node build.js                         -> dist/client-preview.template.html (no model; the Planner fills it)
//   node build.js --model dev/cla.model.json [--out dist/cla.html]   -> a page with that model inside
//
// Everything ends up in ONE <script type="module">: three.module.min.js with its final
// `export{...}` turned into a THREE object, the examples/jsm/lines classes each in their own
// block (imports rewritten to read THREE / JSM), then src/*.js in filename order. Inline
// module scripts run from file:// with no server, so the page works offline.
// three.js is MIT: its licence header travels with it (see LICENSE_HEADER).
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = __dirname, REPO = path.resolve(ROOT, '..', '..', '..');
const VENDOR = path.join(REPO, 'Vendor', 'three');
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };

function need(p, hint) { if (!fs.existsSync(p)) { console.error(`missing ${p}\n  ${hint}`); process.exit(1); } return fs.readFileSync(p, 'utf8'); }
const FETCH = 'run from the repo root: node tools/fetch-vendor.js three';
const threeSrc = need(path.join(VENDOR, 'build', 'three.module.min.js'), FETCH);
const threePkg = JSON.parse(need(path.join(VENDOR, 'package.json'), FETCH));

// three.module.min.js ends with export{a as B,...}. Its minified top-level names ($, t, S, ...)
// would collide with ours in one module scope, so it runs inside its own function and hands
// back the export list as an object: const THREE=(()=>{...;return{B:a,...};})();
function threeAsObject(src) {
  const m = /export\s*\{([^}]*)\}\s*;?\s*$/.exec(src);
  if (!m) throw new Error('three.module.min.js: final export list not found — did the build layout change?');
  const pairs = m[1].split(',').map(s => s.trim()).filter(Boolean).map(s => {
    const p = s.split(/\s+as\s+/); return `${p[1] || p[0]}:${p[0]}`; });
  return `const THREE=(()=>{\n${src.slice(0, m.index)}\nreturn{${pairs.join(',')}};\n})();\n`;
}
// one examples/jsm file -> a block that reads THREE / JSM and writes its export into JSM
function jsmBlock(file) {
  let s = need(path.join(VENDOR, 'examples', 'jsm', 'lines', file), FETCH);
  const destructure = names => names.replace(/\s+as\s+/g, ': ');
  s = s.replace(/import\s*\{([^}]*)\}\s*from\s*'three'\s*;/g, (_, names) => `const {${destructure(names)}} = THREE;`);
  s = s.replace(/import\s*\{([^}]*)\}\s*from\s*'\.\.\/lines\/[A-Za-z0-9]+\.js'\s*;/g, (_, names) => `const {${names}} = JSM;`);
  s = s.replace(/export\s*\{([^}]*)\}\s*;/g, (_, names) => names.split(',').map(n => n.trim()).filter(Boolean).map(n => `JSM.${n} = ${n};`).join(' '));
  if (/\bimport\b[^(]/.test(s) || /\bexport\b/.test(s)) throw new Error(`${file}: an import/export survived the rewrite`);
  return `// ---- three/examples/jsm/lines/${file}\n{\n${s}\n}\n`;
}
const JSM_FILES = ['LineSegmentsGeometry.js', 'LineGeometry.js', 'LineMaterial.js', 'LineSegments2.js', 'Line2.js'];
const LICENSE_HEADER = `/* three.js r${threePkg.version.split('.')[1]} (npm three@${threePkg.version}) — https://threejs.org
   The MIT License — Copyright © 2010-2024 three.js authors */\n`;

const srcDir = path.join(ROOT, 'src');
const mods = fs.readdirSync(srcDir).filter(f => /^\d\d[a-z]?-.*\.js$/.test(f)).sort();
const ours = mods.map(f => `// ==== src/${f}\n` + fs.readFileSync(path.join(srcDir, f), 'utf8')).join('\n');
const script = LICENSE_HEADER + threeAsObject(threeSrc) + 'const JSM={};\n' + JSM_FILES.map(jsmBlock).join('') + ours;
if (/<\/script/i.test(script)) throw new Error('a literal </script inside the module would end it early');
// A module that fails to parse fails silently in the page (nothing runs, often no console
// line) — a duplicate top-level name did exactly that once. Parse it here instead.
try { new (require('vm').Script)(script, { filename: 'client-preview-module.js' }); }
catch (e) { console.error('the page script does not parse:\n' + e.stack.split('\n').slice(0, 4).join('\n')); process.exit(1); }

const css = ['tokens.css', 'components.css'].map(f => fs.readFileSync(path.join(srcDir, 'ds', f), 'utf8')).join('\n')
  + fs.readFileSync(path.join(srcDir, 'viewer.css'), 'utf8');
let html = fs.readFileSync(path.join(srcDir, 'shell.html'), 'utf8')
  .replace('/*__CSS__*/', () => css)
  .replace('/*__SCRIPT__*/', () => script);

const modelPath = arg('--model');
let out;
if (modelPath) {
  const model = JSON.parse(fs.readFileSync(modelPath, 'utf8'));
  if (model.kind !== 'vrg-client-preview') throw new Error(`${modelPath} is not a client preview model`);
  html = html.replace('/*__MODEL__*/{}', () => JSON.stringify(model).replace(/</g, '\\u003c'));
  out = arg('--out') || path.join(ROOT, 'dist', path.basename(modelPath).replace(/\.model\.json$|\.json$/, '') + '.html');
} else out = path.join(ROOT, 'dist', 'client-preview.template.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(`built ${path.relative(ROOT, out)} — three ${threePkg.version}, ${mods.length} modules, ${(html.length / 1024).toFixed(0)} KB`);
