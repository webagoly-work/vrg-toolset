#!/usr/bin/env node
// tools/build-mobile-tools.js — writes Mobile/catalogue/tools.json, which tool owns which paths, for
// VRG Mobile's Haladás (WP M4). The phone reads the file from main, so a change needs no app release.
// The tools come from launcher/vrg-menu.json (through menu.js); what is not a page is listed here.
// A file belongs to the longest path that matches it, so Toolbox/ and one file in it can be two tools.
//
//   node tools/build-mobile-tools.js
'use strict';

const fs = require('fs');
const path = require('path');
const menu = require('../launcher/menu');

const OUT = path.join(menu.REPO, 'Mobile', 'catalogue', 'tools.json');

// What the menu's page path does not say: a built page's sources, and everything that is not a page
const SOURCES = {
  'Varler Planner': ['Planner/'],
  'Készlet / Inventory': ['Inventory/'],
  'VRG Kódváros': ['CodeCity/'],
  'VRG MindMap': ['MindMap/'],
  'VRG BuildTree': ['Modder/'],
  'Toolbox': ['toolbox.html', 'Toolbox/'],
  'VRG Vendor': ['vrg-vendor.html', 'vendor-manifest.json', 'tools/fetch-vendor.js'],
  'Solomon Gömb': ['Solomon/', 'docs/solomon/', 'tools/solomon.js'],
};
const OTHERS = [
  { name: 'VRG Mobile', paths: ['Mobile/', 'docs/mobile/', 'GO-MOBILE.md', '.github/workflows/mobile-android.yml', '.github/workflows/mobile-release.yml'] },
  { name: 'VRG Kapu', paths: ['Hub/', 'docs/hub/', 'GO-HUB.md'] },
  { name: 'Archívum', paths: ['Archive/'] },   // the Artifact Archive (Desktop WP-47, Mobile M18): START R -> A, no own key

  { name: 'BRIDGE', paths: ['BRIDGE/'] },
  { name: 'Firmware', paths: ['Firmware/'] },
  { name: 'ServiceKit', paths: ['ServiceKit/', 'ServiceKitCYD/', 'ServiceKitPhone/'] },
  { name: 'CoreRef', paths: ['CoreRef/'] },
  { name: 'START', paths: ['launcher/'] },
  { name: 'Eszközök', paths: ['tools/'] },
  { name: 'Dokumentáció', paths: ['docs/', 'CLAUDE.md', 'GO-MAIN.md'] },
];

const id = name => name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const pages = menu.tools().map(t => ({ name: t.name, paths: SOURCES[t.name] || [t.path] }));
const missing = Object.keys(SOURCES).filter(n => !pages.some(p => p.name === n));
if (missing.length) { console.error('Not in the registry any more: ' + missing.join(', ')); process.exit(1); }

const tools = [...pages, ...OTHERS].map(t => ({ id: id(t.name), name: t.name, paths: t.paths }));

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ version: 1, tools }, null, 2) + '\n');
console.log(`${path.relative(menu.REPO, OUT)}: ${tools.length} tools`);
