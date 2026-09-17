#!/usr/bin/env node
// ==========================================================================
// Varler Planner — build
//
//   node build.js            → dist/varler_planner.html
//   node build.js --check    → build, then diff against a reference file
//   node build.js --list     → just show which modules would be included
//
// The modules in src/ are concatenated IN FILENAME ORDER into one <script>.
// They share a single scope at runtime, exactly as when this was one file, so
// order matters and nothing may be reordered without re-running the tests.
//
// --------------------------------------------------------------------------
// RESTORED 2026-08-24, with one change from the Phase 1 original.
//
// The original matched modules with /^\d\d-.*\.js$/ — two digits and a hyphen.
// That predates the NNx convention (00b-i18n, 05b-editor-core, 05c-actions,
// 05d-shell, 05e-settings, 07b-phone-camera, 11b-backup), which inserts a file
// between two numbers without renumbering everything after it.
//
// The old pattern silently EXCLUDES every one of those. The build succeeds and
// produces a planner with no i18n, no settings panel, no action registry.
// The pattern below accepts an optional letter, and the guard further down
// refuses to build if any .js file in src/ was left out for any reason.
// ==========================================================================

const fs = require('fs'), path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'dist', 'varler_planner.html');

const MODULE_RE = /^\d\d[a-z]?-.*\.js$/;            // 00-core.js, 00b-i18n.js, 11b-backup.js
const BANNER = /^\/\/ ={10,}[\s\S]*?\/\/ ={10,}\n/; // the per-module header comment

function allJs() {
  return fs.readdirSync(SRC).filter(f => /\.js$/.test(f)).sort();
}
function modules() {
  return allJs().filter(f => MODULE_RE.test(f));
}

// Anything in src/ that ends in .js but doesn't look like a module is almost
// certainly a mistake — a typo in the name, or a file that belongs in tools/.
// Building around it silently is how you ship a planner with a missing panel.
function guard(files) {
  const skipped = allJs().filter(f => !MODULE_RE.test(f));
  if (skipped.length) {
    console.error('\n  These .js files in src/ do NOT match the module naming');
    console.error('  convention and would be left out of the build:\n');
    skipped.forEach(f => console.error('    ' + f));
    console.error('\n  Expected: NN-name.js or NNx-name.js  (e.g. 07-plane-editor.js, 07b-phone-camera.js)');
    console.error('  Rename them, move them to tools/, or fix MODULE_RE.\n');
    throw new Error('unrecognised files in src/ — refusing to build a partial app');
  }
  if (!files.length) throw new Error('no modules found in src/');
}

function build() {
  const shellPath = path.join(SRC, 'shell.html');
  if (!fs.existsSync(shellPath))
    throw new Error('src/shell.html is missing — that file holds the markup and CSS');

  const shell = fs.readFileSync(shellPath, 'utf8');
  if (shell.indexOf('/*__SRC__*/') < 0)
    throw new Error('src/shell.html has no /*__SRC__*/ marker — nowhere to put the script');

  const files = modules();
  guard(files);

  // strip each module's banner: it documents the source tree, not the product
  const js = files.map(f => fs.readFileSync(path.join(SRC, f), 'utf8').replace(BANNER, '')).join('');

  const html = shell.replace('\n/*__SRC__*/\n', js);
  if (html.indexOf('/*__SRC__*/') >= 0) throw new Error('shell.html marker not replaced');

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, html);

  const v = (js.match(/const VERSION='([^']+)'/) || [])[1] || '?';
  return { html, files, v };
}

/* ---- --list ------------------------------------------------------------- */

if (process.argv.includes('--list')) {
  const files = modules();
  console.log('\n  ' + files.length + ' modules in build order:\n');
  files.forEach((f, i) => {
    const n = fs.readFileSync(path.join(SRC, f), 'utf8').split('\n').length;
    console.log('   ' + String(i + 1).padStart(2) + '. ' + f.padEnd(24) + String(n).padStart(5) + ' lines');
  });
  const skipped = allJs().filter(f => !MODULE_RE.test(f));
  if (skipped.length) console.log('\n  NOT included: ' + skipped.join(', '));
  console.log('');
  process.exit(0);
}

/* ---- build -------------------------------------------------------------- */

const { html, files, v } = build();
console.log('built dist/varler_planner.html — v' + v + ', ' + files.length + ' modules, ' + html.length + ' chars');

/* ---- --check ------------------------------------------------------------ */

if (process.argv.includes('--check')) {
  const ref = process.env.REF || path.join(ROOT, 'planner.html');
  if (!fs.existsSync(ref)) { console.log('no reference file to check against'); process.exit(0); }
  const a = fs.readFileSync(ref, 'utf8');
  if (a === html) {
    console.log('IDENTICAL to ' + path.basename(ref) + ' — the build changed nothing');
  } else {
    console.log('DIFFERS from ' + path.basename(ref) + '  (' + a.length + ' vs ' + html.length + ' chars)');
    for (let i = 0; i < Math.min(a.length, html.length); i++) {
      if (a[i] !== html[i]) {
        console.log('first difference at char ' + i);
        console.log('  reference: ' + JSON.stringify(a.slice(i - 60, i + 60)));
        console.log('  built    : ' + JSON.stringify(html.slice(i - 60, i + 60)));
        break;
      }
    }
    process.exitCode = 1;
  }
}
