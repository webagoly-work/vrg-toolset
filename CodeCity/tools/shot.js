#!/usr/bin/env node
// shot.js — screenshot a Kódváros page with the portable headless Chrome (WebGL via SwiftShader).
//
//   node CodeCity/tools/shot.js <page.html> [out.png] [1400x900]
//
// Chrome is looked up in $CHROME, then Planner/apps of this checkout, then of the main checkout
// (Planner/apps is gitignored, so a worktree does not have its own copy).
'use strict';
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const [, , page, outArg, size = '1400x900'] = process.argv;
if (!page) { console.error('usage: node CodeCity/tools/shot.js <page.html> [out.png] [WxH]'); process.exit(2); }

const REPO = path.resolve(__dirname, '..', '..');
const rel = path.join('Planner', 'apps', 'chrome-headless-shell', 'chrome-headless-shell.exe');
let common = REPO;
try { common = path.dirname(path.resolve(REPO, execFileSync('git', ['rev-parse', '--git-common-dir'], { cwd: REPO, encoding: 'utf8' }).trim())); } catch { /* not a repo */ }
const chrome = [process.env.CHROME, path.join(REPO, rel), path.join(common, rel)].find(p => p && fs.existsSync(p));
if (!chrome) { console.error('headless Chrome not found; set CHROME=<path to chrome-headless-shell.exe>'); process.exit(1); }

const [file, hash = ''] = page.split('#'); // a #pick=x,y test hook rides along on the URL
const out = path.resolve(outArg || file.replace(/\.html$/, '.png'));
execFileSync(chrome, ['--headless', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars',
  `--window-size=${size.replace('x', ',')}`, '--virtual-time-budget=8000', `--screenshot=${out}`,
  'file:///' + path.resolve(file).replace(/\\/g, '/') + (hash ? '#' + hash : '')],{ stdio: 'ignore', timeout: 60000 });
console.log(`shot -> ${path.relative(process.cwd(), out)}`);
