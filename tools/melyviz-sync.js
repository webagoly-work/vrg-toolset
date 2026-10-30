#!/usr/bin/env node
// ---------------------------------------------------------------------------
// melyviz-sync.js — keep every app's copy of the Mélyvíz style in step.
//
// shared/melyviz.css is the one source (docs/city/melyviz.md). The apps are
// self-contained HTML, so each carries a copy of it inside a <style> between
//
//   /* melyviz:begin */ ... /* melyviz:end */
//
// This writes the source into every copy, or with --check only compares
// them. A built app (Planner, Inventory, Kapu) has the markers in its src
// and gets the copy at its next build.
//
//   node tools/melyviz-sync.js           write the copies
//   node tools/melyviz-sync.js --check   exit 1 if any copy has drifted
//   node tools/melyviz-sync.js --list    every target and its state
//
// Paths in TARGETS may sit outside the repo (the Workflow Kit's internal
// pages); a missing file is reported, never created.
// ---------------------------------------------------------------------------

'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const SOURCE = path.join(REPO, 'shared', 'melyviz.css');
const BEGIN = '/* melyviz:begin */';
const END = '/* melyviz:end */';

/* Every file that carries a copy. Add a line when an app takes the style on. */
const TARGETS = [
  'Calculator/led_arkalkulator.html',
  'Calculator/panel_anyagar_kalkulator.html',
  'Calculator/Altalanos_Villanyszerelui_Kalkulator.html',
  'MindMap/vrg_mindmap.html',
  'Modder/vrg-buildtree.html',
  'vrg-vendor.html',
  'toolbox.html',
  'Hub/src/css/00-themes.css',             // built: node tools/build-hub.js
  'Inventory/src/ui/theme.css',            // built: npm run build carries it into dist
  'BRIDGE/_tuner/bridge-tuner.html',
  'BRIDGE/09_catalogue/tools/viewer.html', // built: node BRIDGE/09_catalogue/tools/build.js writes smarthome-db.html
  'BRIDGE/04_related-hardware/espblok-builder.html',
  'BRIDGE/04_related-hardware/espblok-builder_2.html',
  'Planner/projects/varler-planner/src/shell.html', // built: npm run build carries it into dist
];

function main() {
  const mode = process.argv.includes('--check') ? 'check' : process.argv.includes('--list') ? 'list' : 'write';
  const css = fs.readFileSync(SOURCE, 'utf8').replace(/\r\n/g, '\n').trimEnd();
  let bad = 0;
  for (const rel of TARGETS) {
    const file = path.resolve(REPO, rel);
    if (!fs.existsSync(file)) { console.log('MISSING  ' + rel); bad++; continue; }
    const text = fs.readFileSync(file, 'utf8');
    const crlf = text.includes('\r\n');
    const a = text.indexOf(BEGIN), b = text.indexOf(END);
    if (a < 0 || b < a) { console.log('NOMARK   ' + rel); bad++; continue; }
    const inner = text.slice(a + BEGIN.length, b).replace(/\r\n/g, '\n').trim();
    if (inner === css) { console.log('ok       ' + rel); continue; }
    if (mode !== 'write') { console.log('DRIFT    ' + rel); bad++; continue; }
    let block = '\n' + css + '\n';
    if (crlf) block = block.replace(/\n/g, '\r\n');
    fs.writeFileSync(file, text.slice(0, a + BEGIN.length) + block + text.slice(b));
    console.log('synced   ' + rel);
  }
  if (bad) { console.log(bad + ' target(s) need attention.'); process.exit(1); }
}

main();
