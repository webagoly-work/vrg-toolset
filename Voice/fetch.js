#!/usr/bin/env node
// fetch.js — download the speech engine and model(s) of Voice/voice-manifest.json into <Full>/tools/voice (WP-54). Zero dependencies.
//   node Voice/fetch.js --list                 what is pinned, what is installed
//   node Voice/fetch.js                        the engine + the default model
//   node Voice/fetch.js engine small turbo     these
//   node Voice/fetch.js --pin turbo            accept a file whose sha256 is still null in the manifest, and write the hash into it
//   --full <dir>                               the Full folder (default: the repo's parent, or VRG_FULL)
// Every download is hashed while it streams; a hash that does not match the manifest stops the install (the file is deleted). A null
// hash installs nothing unless --pin names that id (you checked the source by hand once; afterwards it is pinned like the rest).
// The engine zip is opened with Windows' own System32\tar.exe (never Git's GNU tar on the PATH); elsewhere `unzip`.
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), { spawnSync } = require('child_process');

const HERE = __dirname, REPO = path.resolve(HERE, '..');
const MANIFEST = path.join(HERE, 'voice-manifest.json');
const argv = process.argv.slice(2);
const opt = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
const FULL = path.resolve(opt('--full') || process.env.VRG_FULL || path.dirname(REPO));
const ROOT = path.join(FULL, 'tools', 'voice');

const readManifest = () => JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
function entries(m) { return [{ kind: 'engine', ...m.engine, id: 'engine' }, ...m.models.map(x => ({ kind: 'model', ...x }))]; }
function installed() { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'installed.json'), 'utf8')); } catch (e) { return { engine: null, models: {} }; } }

async function download(url, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok || !res.body) throw new Error('HTTP ' + res.status + ' for ' + url);
  const total = Number(res.headers.get('content-length')) || 0;
  const hash = crypto.createHash('sha256'), out = fs.createWriteStream(dest + '.part');
  let got = 0, shown = 0;
  for await (const chunk of res.body) {
    hash.update(chunk); got += chunk.length;
    if (!out.write(chunk)) await new Promise(r => out.once('drain', r));
    if (total && got - shown > total / 20) { shown = got; process.stdout.write('\r  ' + Math.round(got / total * 100) + '% of ' + Math.round(total / 1048576) + ' MB'); }
  }
  await new Promise((r, j) => out.end(e => (e ? j(e) : r())));
  if (total) process.stdout.write('\n');
  return { part: dest + '.part', sha256: hash.digest('hex'), bytes: got };
}
function unzip(zip, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const r = process.platform === 'win32'
    ? spawnSync(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe'), ['-xf', zip, '-C', dir], { windowsHide: true, encoding: 'utf8' })
    : spawnSync('unzip', ['-o', '-q', zip, '-d', dir], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error('unzip failed: ' + (r.stderr || r.error || '').toString().slice(0, 200));
}
function findFile(dir, name) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { const f = findFile(p, name); if (f) return f; } else if (e.name.toLowerCase() === name.toLowerCase()) return p;
  }
  return null;
}

async function install(e, pin) {
  const tmp = path.join(ROOT, 'download', e.kind === 'engine' ? e.asset : e.file);
  console.log((e.kind === 'engine' ? 'engine ' + e.repo + ' ' + e.tag : 'model ' + e.id + ' (' + e.sizeMB + ' MB)') + ' ← ' + e.url);
  const d = await download(e.url, tmp);
  if (e.sha256 && e.sha256 !== d.sha256) { fs.rmSync(d.part, { force: true }); throw new Error('sha256 mismatch for ' + e.id + ': got ' + d.sha256); }
  if (!e.sha256 && !pin) { fs.rmSync(d.part, { force: true }); throw new Error(e.id + ' has no sha256 in the manifest; it was ' + d.sha256 + '. Check the source, then run again with --pin ' + e.id); }
  fs.renameSync(d.part, tmp);
  const inst = installed();
  if (e.kind === 'engine') {
    const dir = path.join(ROOT, 'bin', e.tag);
    unzip(tmp, dir);
    const exe = findFile(dir, e.exe) || findFile(dir, e.exe.replace(/\.exe$/, ''));
    if (!exe) throw new Error(e.exe + ' is not in ' + e.asset + ' (the release may have renamed it: look inside ' + dir + ')');
    inst.engine = { tag: e.tag, exe: path.relative(ROOT, exe), sha256: d.sha256 };
    fs.rmSync(tmp, { force: true });
  } else {
    const dest = path.join(ROOT, 'models', e.file);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.renameSync(tmp, dest);
    inst.models = inst.models || {};
    inst.models[e.id] = { file: path.relative(ROOT, dest), sha256: d.sha256 };
  }
  fs.writeFileSync(path.join(ROOT, 'installed.json'), JSON.stringify(inst, null, 1));
  if (!e.sha256 && pin) {                                            // write the pin into the manifest (the user commits it)
    const m = readManifest();
    if (e.kind === 'engine') m.engine.sha256 = d.sha256; else m.models.find(x => x.id === e.id).sha256 = d.sha256;
    fs.writeFileSync(MANIFEST, JSON.stringify(m, null, 2) + '\n');
    console.log('  pinned ' + e.id + ' sha256 ' + d.sha256 + ' in Voice/voice-manifest.json — commit it.');
  }
  console.log('  ok: ' + Math.round(d.bytes / 1048576) + ' MB, sha256 ' + d.sha256.slice(0, 16) + '…');
}

module.exports = { entries, installed, ROOT };

if (require.main === module) {
  (async () => {
    const m = readManifest(), list = entries(m), inst = installed();
    if (argv.includes('--list')) {
      for (const e of list) console.log((e.kind === 'engine' ? 'engine ' : 'model  ') + e.id.padEnd(8) + (e.sha256 ? ' pinned  ' : ' UNPINNED') + '  ' + (e.kind === 'engine' ? (inst.engine ? 'installed ' + inst.engine.exe : '-') : (inst.models && inst.models[e.id] ? 'installed' : '-')));
      console.log('root: ' + ROOT);
      return;
    }
    const pinIds = argv.flatMap((a, i) => (a === '--pin' && argv[i + 1] ? [argv[i + 1]] : []));
    const named = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--pin' && argv[i - 1] !== '--full');
    const want = named.length || pinIds.length ? [...new Set([...named, ...pinIds])] : ['engine', (m.models.find(x => x.default) || m.models[0]).id];
    for (const id of want) {
      const e = list.find(x => x.id === id);
      if (!e) { console.error('unknown id: ' + id + ' (ids: ' + list.map(x => x.id).join(', ') + ')'); process.exitCode = 2; continue; }
      try { await install(e, pinIds.includes(id)); } catch (err) { console.error('  ' + err.message); process.exitCode = 1; }
    }
  })();
}
