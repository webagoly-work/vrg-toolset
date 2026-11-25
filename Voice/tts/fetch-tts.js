#!/usr/bin/env node
// fetch-tts.js — WP-57 Hang: download the speech output (sherpa-onnx-node + Piper voices) of Voice/voice-manifest.json `tts` into
// <Full>/tools/voice/tts. Zero dependencies; the download and hashing helpers are Voice/fetch.js's.
//   node Voice/tts/fetch-tts.js --list              what is pinned, what is installed
//   node Voice/tts/fetch-tts.js                     the addon for this platform + the default voices (hu anna, en amy)
//   node Voice/tts/fetch-tts.js addon hu_HU-imre-medium   these
//   --full <dir>                                    the Full folder (default: the repo's parent, or VRG_FULL)
// npm tarballs are checked against their sha512 integrity before anything is unpacked; voice archives against sha256. A mismatch
// deletes the download and stops. Archives are opened with Windows' own System32\tar.exe (bsdtar reads .tar.bz2), elsewhere `tar`.
//   layout: tts/node/node_modules/{sherpa-onnx-node, sherpa-onnx-<platform>}   tts/vits-piper-<voice>/   tts/installed.json
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), { spawnSync } = require('child_process');
const F = require('../fetch.js');

const MANIFEST = path.join(__dirname, '..', 'voice-manifest.json');
const ROOT = path.join(F.ROOT, 'tts');
const argv = process.argv.slice(2);
const platform = process.platform + '-' + process.arch;

const manifest = () => JSON.parse(fs.readFileSync(MANIFEST, 'utf8')).tts;
const installed = () => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'installed.json'), 'utf8')); } catch (e) { return { addon: null, voices: {} }; } };
const tarExe = () => (process.platform === 'win32' ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe') : 'tar');

// the integrity string of npm ("sha512-<base64>") for a file
function integrityOf(file) { return 'sha512-' + crypto.createHash('sha512').update(fs.readFileSync(file)).digest('base64'); }
function untar(file, dir, strip) {
  fs.mkdirSync(dir, { recursive: true });
  const args = ['-xf', file, '-C', dir, ...(strip ? ['--strip-components', String(strip)] : [])];
  const r = spawnSync(tarExe(), args, { windowsHide: true, encoding: 'utf8' });
  if (r.status !== 0) throw new Error('tar failed: ' + (r.stderr || r.error || '').toString().slice(0, 200));
}

async function npmPackage(name, version, integrity) {
  const url = 'https://registry.npmjs.org/' + name + '/-/' + name + '-' + version + '.tgz';
  console.log('npm ' + name + '@' + version + ' ← ' + url);
  const d = await F.download(url, path.join(ROOT, 'download', name + '-' + version + '.tgz'));
  const got = integrityOf(d.part);
  if (got !== integrity) { fs.rmSync(d.part, { force: true }); throw new Error('integrity mismatch for ' + name + '@' + version + ': got ' + got); }
  const dest = path.join(ROOT, 'node', 'node_modules', name);
  fs.rmSync(dest, { recursive: true, force: true });
  untar(d.part, dest, 1);                                         // npm tarballs hold one top folder, package/
  fs.rmSync(d.part, { force: true });
  return { name, version };
}

async function addon() {
  const a = manifest().addon, p = a.platforms[platform];
  if (!p) throw new Error('no prebuilt sherpa-onnx package pinned for ' + platform + ' (pinned: ' + Object.keys(a.platforms).join(', ') + ')');
  await npmPackage(a.name, a.version, a.integrity);
  await npmPackage(p.name, a.version, p.integrity);
  const inst = installed();
  inst.addon = { name: a.name, version: a.version, platform: p.name };
  save(inst);
  console.log('  ok: ' + a.name + '@' + a.version + ' + ' + p.name);
}

async function voice(v) {
  console.log('voice ' + v.id + ' (' + v.sizeMB + ' MB) ← ' + v.url);
  if (/UNCLEAR|non-?commercial/i.test(v.license || '')) console.log('  licence: ' + v.license);
  const d = await F.download(v.url, path.join(ROOT, 'download', v.archive));
  if (d.sha256 !== v.sha256) { fs.rmSync(d.part, { force: true }); throw new Error('sha256 mismatch for ' + v.id + ': got ' + d.sha256); }
  untar(d.part, ROOT, 0);                                         // the archive holds vits-piper-<id>/
  fs.rmSync(d.part, { force: true });
  const dir = path.join(ROOT, 'vits-piper-' + v.id);
  if (!fs.existsSync(path.join(dir, v.id + '.onnx'))) throw new Error(v.id + '.onnx is not in ' + v.archive);
  const inst = installed();
  inst.voices = inst.voices || {};
  inst.voices[v.id] = { dir: path.relative(ROOT, dir), sha256: d.sha256 };
  save(inst);
  console.log('  ok: ' + v.id);
}
function save(inst) { fs.mkdirSync(ROOT, { recursive: true }); fs.writeFileSync(path.join(ROOT, 'installed.json'), JSON.stringify(inst, null, 1)); }

module.exports = { ROOT, integrityOf, platform };

if (require.main === module) {
  (async () => {
    const m = manifest(), inst = installed();
    if (argv.includes('--list')) {
      console.log('addon  ' + m.addon.name + '@' + m.addon.version + '  ' + (inst.addon ? 'installed (' + inst.addon.platform + ')' : '-') + (m.addon.platforms[platform] ? '' : '  (nothing pinned for ' + platform + ')'));
      for (const v of m.voices) console.log('voice  ' + v.id.padEnd(20) + (v.default ? ' default' : '        ') + '  ' + (inst.voices && inst.voices[v.id] ? 'installed' : '-') + '  ' + (v.license || ''));
      console.log('root: ' + ROOT);
      return;
    }
    const named = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--full');
    const want = named.length ? named : ['addon', ...m.voices.filter(v => v.default).map(v => v.id)];
    for (const id of want) {
      try {
        if (id === 'addon') await addon();
        else { const v = m.voices.find(x => x.id === id); if (!v) throw new Error('unknown id: ' + id + ' (ids: addon, ' + m.voices.map(x => x.id).join(', ') + ')'); await voice(v); }
      } catch (err) { console.error('  ' + err.message); process.exitCode = 1; }
    }
  })();
}
