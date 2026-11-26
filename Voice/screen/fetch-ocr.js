#!/usr/bin/env node
// fetch-ocr.js — WP-56 Szem: the OCR fallback's offline data, pinned in Voice/voice-manifest.json → ocr. Zero dependencies.
//   node Voice/screen/fetch-ocr.js            hun + eng traineddata into <Full>/tools/voice/tessdata (sha256 checked while streaming)
//   node Voice/screen/fetch-ocr.js --list     what is pinned, what is installed
//   node Voice/screen/fetch-ocr.js --npm      also `npm ci --ignore-scripts` here (tesseract.js 7.0.0, sha512 in package-lock.json)
//   --full <dir>                              the Full folder (default: the repo's parent, or VRG_FULL)    --dir <dir>  another target
// A file whose hash does not match is deleted and the run fails; an installed file with the right hash is left alone.
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), { spawnSync } = require('child_process');

const HERE = __dirname, REPO = path.resolve(HERE, '..', '..');
const argv = process.argv.slice(2);
const opt = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
const FULL = path.resolve(opt('--full') || process.env.VRG_FULL || path.dirname(REPO));
const M = JSON.parse(fs.readFileSync(path.join(REPO, 'Voice', 'voice-manifest.json'), 'utf8')).ocr;
const DIR = path.resolve(opt('--dir') || path.join(FULL, 'tools', 'voice', M.dir || 'tessdata'));

const sha256File = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
async function download(url, dest) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok || !res.body) throw new Error('HTTP ' + res.status + ' for ' + url);
  const hash = crypto.createHash('sha256'), out = fs.createWriteStream(dest + '.part');
  for await (const chunk of res.body) { hash.update(chunk); if (!out.write(chunk)) await new Promise(r => out.once('drain', r)); }
  await new Promise((r, j) => out.end(e => (e ? j(e) : r())));
  return hash.digest('hex');
}

async function main() {
  if (argv.includes('--list')) {
    for (const f of M.files) { const p = path.join(DIR, f.file); console.log(f.id.padEnd(5), (fs.existsSync(p) ? (sha256File(p) === f.sha256 ? 'ok' : 'HASH MISMATCH') : 'missing').padEnd(14), p); }
    console.log('tesseract.js:', fs.existsSync(path.join(HERE, 'node_modules', 'tesseract.js')) ? 'installed' : 'missing (node Voice/screen/fetch-ocr.js --npm)');
    return;
  }
  fs.mkdirSync(DIR, { recursive: true });
  for (const f of M.files) {
    const dest = path.join(DIR, f.file);
    if (fs.existsSync(dest) && sha256File(dest) === f.sha256) { console.log(f.id + ': already installed'); continue; }
    console.log(f.id + ' ← ' + f.url);
    const got = await download(f.url, dest);
    if (got !== f.sha256) { fs.rmSync(dest + '.part', { force: true }); throw new Error('sha256 mismatch for ' + f.id + ': got ' + got); }
    fs.renameSync(dest + '.part', dest);
    console.log(f.id + ': ok (' + Math.round(f.bytes / 1024) + ' KB)');
  }
  if (argv.includes('--npm')) {
    // Node ≥ 18.20 / 20.12 refuses to start npm.cmd directly (EINVAL), so on Windows cmd.exe runs one fixed command line
    const args = ['ci', '--ignore-scripts', '--no-audit', '--no-fund'];
    const r = process.platform === 'win32'
      ? spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm.cmd ' + args.join(' ')], { cwd: HERE, stdio: 'inherit', windowsHide: true })
      : spawnSync('npm', args, { cwd: HERE, stdio: 'inherit' });
    if (r.status !== 0) throw new Error('npm ci failed' + (r.error ? ': ' + r.error.message : ''));
  }
  console.log('tessdata: ' + DIR);
}
main().catch(e => { console.error('fetch-ocr: ' + e.message); process.exit(1); });
