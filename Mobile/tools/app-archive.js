#!/usr/bin/env node
// Mobile/tools/app-archive.js — the WORK version of the app archive (WP M61, D-163): keep an exact copy of an Android
// app installed on the USB phone, for later legacy compatibility (first: FunDo Pro, the Q71 watch's app). The PERSONAL
// version is the Data Vault's tools/apps.js; both write the same manifest (kind "vrg.app-archive", v 1).
//
//   node Mobile/tools/app-archive.js phone [filter]                 the phone's own (third-party) apps
//   node Mobile/tools/app-archive.js pull [<package>|--find <word>] [--label "FunDo Pro"] [--note "…"]
//   node Mobile/tools/app-archive.js list                           what is archived
//   node Mobile/tools/app-archive.js verify                         re-hash every archived APK against its manifest
//   options: --adb <path> (else ADB, else the Android SDK's platform-tools, else "adb")  --out <dir>
//
// Where: {vrg}\Backup\installers\android\<package>\<versionName>-<versionCode>\ (the installers place of CLAUDE.md;
// never in git: an APK is tens of MB and the app is its maker's). Only apps the Founder installed, pulled from the
// Founder's own phone — never downloaded from a mirror site, never redistributed. No device serial, no account, no
// absolute path in the manifest.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cp = require('child_process');
const readline = require('readline');

const REPO = path.resolve(__dirname, '..', '..');

function args(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { const k = a.slice(2); const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true; o[k] = v; }
    else o._.push(a);
  }
  return o;
}

function defaultOut() { return path.join(REPO, '..', '..', 'Backup', 'installers', 'android'); }

function findAdb(opt) {
  if (opt.adb) return opt.adb;
  if (process.env.ADB) return process.env.ADB;
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT ||
    (process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk'));
  if (sdk) {
    const p = path.join(sdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
    if (fs.existsSync(p)) return p;
  }
  return 'adb';
}

/** Runs adb; a .js "adb" (the test's fake) runs under this node. */
function adb(bin, argv) {
  const [cmd, pre] = bin.endsWith('.js') ? [process.execPath, [bin]] : [bin, []];
  const r = cp.spawnSync(cmd, pre.concat(argv), { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw new Error('adb nem indul: ' + r.error.message);
  if (r.status !== 0) throw new Error('adb ' + argv.join(' ') + ': ' + (r.stderr || r.stdout).trim());
  return r.stdout;
}

// ---- parsing adb's answers (pure, tested) ----------------------------------------------------------------------

/** `pm path`: one "package:/data/app/…/base.apk" line per file (split APKs too). */
function parsePmPath(out) {
  return out.split(/\r?\n/).map(l => l.trim()).filter(l => l.startsWith('package:')).map(l => l.slice(8));
}

/** `pm list packages -3`: "package:com.x.y" lines, sorted. */
function parsePmList(out) { return parsePmPath(out).sort(); }

/** `dumpsys package <p>`: the first block's versionName, versionCode, installer and install times. */
function parseDumpsys(out) {
  const g = re => { const m = out.match(re); return m ? m[1].trim() : null; };
  const code = g(/versionCode=(\d+)/);
  return {
    versionName: g(/versionName=([^\s]+)/),
    versionCode: code === null ? null : Number(code),
    installer: g(/installerPackageName=([^\s]+)/) || g(/\binstaller=([^\s]+)/),
    firstInstall: g(/firstInstallTime=([^\r\n]+)/),
    lastUpdate: g(/lastUpdateTime=([^\r\n]+)/),
  };
}

function safeName(s) { return String(s).replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 80); }

function sha256(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }

// ---- commands --------------------------------------------------------------------------------------------------

async function pickPackage(bin, filter) {
  const all = parsePmList(adb(bin, ['shell', 'pm', 'list', 'packages', '-3']));
  const list = filter ? all.filter(p => p.toLowerCase().includes(String(filter).toLowerCase())) : all;
  if (list.length === 0) throw new Error('nincs ilyen alkalmazas a telefonon' + (filter ? ' (' + filter + ')' : ''));
  if (list.length === 1) return list[0];
  list.forEach((p, i) => console.log('  ' + String(i + 1).padStart(3) + ') ' + p));
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ans = await new Promise(res => rl.question('  Melyik? (szam): ', a => { rl.close(); res(a); }));
  const n = Number(ans);
  if (!(n >= 1 && n <= list.length)) throw new Error('nincs kivalasztva');
  return list[n - 1];
}

async function pull(opt) {
  const bin = findAdb(opt);
  const pkg = opt._[1] || await pickPackage(bin, opt.find);
  const files = parsePmPath(adb(bin, ['shell', 'pm', 'path', pkg]));
  if (files.length === 0) throw new Error(pkg + ' nincs telepitve a telefonon');
  const info = parseDumpsys(adb(bin, ['shell', 'dumpsys', 'package', pkg]));
  const model = adb(bin, ['shell', 'getprop', 'ro.product.model']).trim();
  const android = adb(bin, ['shell', 'getprop', 'ro.build.version.release']).trim();
  const out = path.resolve(opt.out || defaultOut());
  const dir = path.join(out, safeName(pkg), safeName((info.versionName || 'v') + '-' + (info.versionCode ?? 0)));
  fs.mkdirSync(dir, { recursive: true });
  const entries = [];
  const seen = new Set();
  for (const remote of files) {
    let name = safeName(path.posix.basename(remote));
    while (seen.has(name)) name = '_' + name;
    seen.add(name);
    const local = path.join(dir, name);
    adb(bin, ['pull', remote, local]);
    if (!fs.existsSync(local)) throw new Error('a letoltes nem jott letre: ' + name);
    entries.push({ name, bytes: fs.statSync(local).size, sha256: sha256(local) });
    console.log('  ' + name + '  ' + entries[entries.length - 1].bytes + ' bajt');
  }
  const manifest = {
    kind: 'vrg.app-archive', v: 1, package: pkg, label: opt.label === true ? pkg : (opt.label || pkg),
    versionName: info.versionName, versionCode: info.versionCode, installer: info.installer,
    firstInstall: info.firstInstall, lastUpdate: info.lastUpdate, pulledAt: new Date().toISOString(),
    device: { model, android }, files: entries, note: opt.note === true ? '' : (opt.note || ''),
  };
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log('  Kesz: ' + pkg + ' ' + info.versionName + ' (' + entries.length + ' fajl) -> ' + dir);
  return { dir, manifest };
}

function manifests(out) {
  const res = [];
  if (!fs.existsSync(out)) return res;
  for (const p of fs.readdirSync(out)) {
    const pd = path.join(out, p);
    if (!fs.statSync(pd).isDirectory()) continue;
    for (const v of fs.readdirSync(pd)) {
      const mf = path.join(pd, v, 'manifest.json');
      if (fs.existsSync(mf)) res.push({ dir: path.join(pd, v), m: JSON.parse(fs.readFileSync(mf, 'utf8')) });
    }
  }
  return res;
}

function list(opt) {
  const all = manifests(path.resolve(opt.out || defaultOut()));
  if (all.length === 0) { console.log('  Meg nincs archivalt alkalmazas.'); return all; }
  for (const { m } of all) {
    const mb = (m.files.reduce((a, f) => a + f.bytes, 0) / 1048576).toFixed(1);
    console.log('  ' + m.label + '  ' + m.package + '  ' + m.versionName + ' (' + m.versionCode + ')  ' + mb + ' MB  ' + m.pulledAt.slice(0, 10));
  }
  return all;
}

/** Re-hash every archived file. Returns the problems (changed or missing). */
function verify(opt) {
  const problems = [];
  for (const { dir, m } of manifests(path.resolve(opt.out || defaultOut()))) {
    for (const f of m.files) {
      const p = path.join(dir, f.name);
      if (!fs.existsSync(p)) problems.push(m.package + ' ' + m.versionName + ': hianyzik ' + f.name);
      else if (sha256(p) !== f.sha256) problems.push(m.package + ' ' + m.versionName + ': MEGVALTOZOTT ' + f.name);
    }
  }
  if (problems.length === 0) console.log('  Minden archivalt fajl ep.');
  else problems.forEach(p => console.log('  ' + p));
  return problems;
}

function phone(opt) {
  const list = parsePmList(adb(findAdb(opt), ['shell', 'pm', 'list', 'packages', '-3']))
    .filter(p => !opt._[1] || p.toLowerCase().includes(opt._[1].toLowerCase()));
  list.forEach(p => console.log('  ' + p));
  return list;
}

async function main(argv) {
  const opt = args(argv);
  switch (opt._[0]) {
    case 'pull': return pull(opt);
    case 'list': return list(opt);
    case 'verify': { const p = verify(opt); if (p.some(x => x.includes('MEGVALTOZOTT'))) process.exitCode = 1; return p; }
    case 'phone': return phone(opt);
    default:
      console.log('  Hasznalat: app-archive.js phone [szuro] | pull [csomag|--find szo] [--label nev] [--note ...] | list | verify');
      console.log('  Cel: ' + defaultOut());
  }
}

module.exports = { parsePmPath, parsePmList, parseDumpsys, safeName, pull, list, verify, manifests, main };
if (require.main === module) main(process.argv.slice(2)).catch(e => { console.error('  Hiba: ' + e.message); process.exit(1); });
