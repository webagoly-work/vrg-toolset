#!/usr/bin/env node
// package.js (WP-44) — builds "VRG Desktop.exe": Electron's documented "rebrand the downloaded binaries" method, no npm, no network.
//   node Dashboard/tools/package.js [--out <dir>] [--electron <dir>] [--repo <dir>] [--dry] [--check]
//   default out:      {full}\build\vrg-desktop          default electron: {full}\tools\electron (the portable 44.x)
//   default repo:     this checkout (written into vrg-desktop.json; the START .cmd passes its own with --repo anyway)
// The copy leaves out electron.exe (it becomes "VRG Desktop.exe") and resources/default_app.asar (Electron's demo app), and adds
// resources/app = { package.json, main.js = tools/exe-bootstrap.js }. Nothing is ever deleted: an out folder that is not an earlier
// build (no vrg-desktop.json in it) is refused; an earlier build is overwritten file by file. The file icon stays Electron's until
// rcedit is vendored (DESKU-Q12). ASCII output; exit 1 on any problem.
'use strict';
const path = require('path'), fs = require('fs');

const REPO = path.resolve(__dirname, '..', '..');
const FULL = path.dirname(REPO);
const EXE = 'VRG Desktop.exe';
const MARK = 'vrg-desktop.json';
// the app name stays the shell's own, so the exe and `electron.exe Dashboard\shell` share one profile (%APPDATA%\vrg-dashboard-shell:
// the in-shell apps' localStorage, the browser pane's cookies); no productName, because Electron would take that as the name
const PKG = { name: 'vrg-dashboard-shell', private: true, description: 'VRG Desktop: bootstrap that runs the repo\'s Dashboard/shell/main.js (built by Dashboard/tools/package.js).', main: 'main.js', license: 'UNLICENSED' };

function arg(argv, k, d) { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; }

// the files to copy: [{ from, to }] (relative to the electron dir / the out dir); skipped: electron.exe, default_app.asar
function plan(electronDir, list) {
  const out = [];
  for (const rel of list) {
    const n = rel.split(/[\\/]/).join('/');
    if (n.toLowerCase() === 'resources/default_app.asar') continue;
    out.push({ from: rel, to: n.toLowerCase() === 'electron.exe' ? EXE : rel });
  }
  return out;
}
function walk(dir, base = dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, base, acc); else if (e.isFile()) acc.push(path.relative(base, p));
  }
  return acc;
}

function config(repo, electronDir) {
  let version = '';
  try { version = fs.readFileSync(path.join(electronDir, 'version'), 'utf8').trim(); } catch (e) {}
  return { repo, electron: version, built: new Date().toISOString(), by: 'Dashboard/tools/package.js' };
}

// → { ok, errors, files, out }
function build({ electronDir, outDir, repo, dry }) {
  const errors = [];
  if (!fs.existsSync(path.join(electronDir, 'electron.exe'))) errors.push('no electron.exe in ' + electronDir);
  if (!fs.existsSync(path.join(repo, 'Dashboard', 'shell', 'main.js'))) errors.push('no Dashboard/shell/main.js in ' + repo);
  if (fs.existsSync(outDir) && !fs.statSync(outDir).isDirectory()) errors.push('out is a file, not a folder: ' + outDir);
  else if (fs.existsSync(outDir) && fs.readdirSync(outDir).length && !fs.existsSync(path.join(outDir, MARK))) errors.push('out folder is not an earlier VRG Desktop build, refused: ' + outDir);
  if (path.resolve(outDir).toLowerCase().startsWith(path.resolve(electronDir).toLowerCase() + path.sep) || path.resolve(outDir).toLowerCase() === path.resolve(electronDir).toLowerCase())
    errors.push('out folder is inside the electron folder');
  if (errors.length) return { ok: false, errors, files: 0, out: outDir };
  const files = plan(electronDir, walk(electronDir));
  if (dry) return { ok: true, errors, files: files.length, out: outDir, dry: true, sample: files.slice(0, 5) };
  // the marker goes in first (with building: true), so a build that stops half-way is still recognised as ours and can be re-run
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, MARK), JSON.stringify({ ...config(repo, electronDir), building: true }, null, 2) + '\n');
  try {
    for (const f of files) {
      const to = path.join(outDir, f.to);
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(path.join(electronDir, f.from), to);
    }
    const appDir = path.join(outDir, 'resources', 'app');
    fs.mkdirSync(appDir, { recursive: true });
    fs.writeFileSync(path.join(appDir, 'package.json'), JSON.stringify(PKG, null, 2) + '\n');
    fs.copyFileSync(path.join(__dirname, 'exe-bootstrap.js'), path.join(appDir, 'main.js'));
  } catch (e) {
    const busy = /EBUSY|EPERM/.test(e.code || '') ? ' (is "' + EXE + '" still running? close it and build again)' : '';
    return { ok: false, errors: ['copy failed: ' + e.message + busy, 'the build is incomplete; ' + MARK + ' says building: true'], files: 0, out: outDir };
  }
  fs.writeFileSync(path.join(outDir, MARK), JSON.stringify(config(repo, electronDir), null, 2) + '\n');
  return { ok: true, errors, files: files.length + 3, out: outDir, ...check(outDir) };
}

// what a finished build must look like → { ok, errors }
function check(outDir) {
  const errors = [];
  const has = rel => fs.existsSync(path.join(outDir, rel));
  if (!has(EXE)) errors.push('missing ' + EXE);
  if (has('electron.exe')) errors.push('electron.exe is still there');
  if (has(path.join('resources', 'default_app.asar'))) errors.push('default_app.asar is still there');
  for (const f of [path.join('resources', 'app', 'main.js'), path.join('resources', 'app', 'package.json'), MARK]) if (!has(f)) errors.push('missing ' + f);
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(outDir, MARK), 'utf8'));
    if (cfg.building) errors.push(MARK + ': an unfinished build (building: true); build again');
    if (!cfg.repo || !fs.existsSync(path.join(cfg.repo, 'Dashboard', 'shell', 'main.js'))) errors.push(MARK + ': repo has no Dashboard/shell/main.js: ' + cfg.repo);
  } catch (e) { errors.push('unreadable ' + MARK + ': ' + e.message); }
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(outDir, 'resources', 'app', 'package.json'), 'utf8'));
    if (pkg.name !== PKG.name || pkg.productName) errors.push('resources/app/package.json: the name must stay ' + PKG.name + ' (one profile)');
  } catch (e) { errors.push('unreadable resources/app/package.json: ' + e.message); }
  return { ok: !errors.length, errors };
}

module.exports = { plan, build, check, config, PKG, EXE, MARK };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const outDir = path.resolve(arg(argv, '--out', path.join(FULL, 'build', 'vrg-desktop')));
  const electronDir = path.resolve(arg(argv, '--electron', path.join(FULL, 'tools', 'electron')));
  const repo = path.resolve(arg(argv, '--repo', REPO));
  const r = argv.includes('--check') ? { out: outDir, ...check(outDir) } : build({ electronDir, outDir, repo, dry: argv.includes('--dry') });
  const ascii = s => String(s).replace(/[^\x20-\x7e]/g, '?');
  console.log((r.ok ? 'OK  ' : 'FAIL') + '  ' + ascii(r.out) + (r.files ? '  (' + r.files + ' files' + (r.dry ? ', dry run' : '') + ')' : ''));
  for (const e of r.errors) console.log('  - ' + ascii(e));
  if (r.ok && !r.dry && !argv.includes('--check')) console.log('  run: "' + ascii(path.join(r.out, EXE)) + '"   (--selftest to check it)');
  process.exit(r.ok ? 0 : 1);
}
