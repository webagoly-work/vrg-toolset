#!/usr/bin/env node
// fetch-electron.js — the Electron runtime for the overlay shell (P12, KV-25) into H:\VRG\Full\tools\electron (next to the repo, never committed).
//   node CodeCity/tools/fetch-electron.js          download + verify + unpack the version pinned in vendor-manifest.json
//   node CodeCity/tools/fetch-electron.js --check  only say whether the right version is unpacked (exit 1 if not)
// Trust chain, no npm install and no postinstall scripts: the npm tarball of `electron` is checked against the sha512
// integrity pinned in vendor-manifest.json; its checksums.json (written by Electron's release process) then gives the
// sha256 of electron-v<ver>-win32-x64.zip, which is downloaded from the GitHub release and checked before unpacking.
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), zlib = require('zlib'), { spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');
const DEST = path.join(path.dirname(REPO), 'tools', 'electron');
const comp = JSON.parse(fs.readFileSync(path.join(REPO, 'vendor-manifest.json'), 'utf8')).components.find(c => c.slug === 'electron');
if (!comp) { console.error('vendor-manifest.json has no "electron" component'); process.exit(1); }
const VER = comp.npmVersion, ZIP = `electron-v${VER}-win32-x64.zip`;

const have = () => { try { return fs.readFileSync(path.join(DEST, 'version'), 'utf8').trim().replace(/^v/, ''); } catch { return null; } };
if (process.argv.includes('--check')) { const v = have(); console.log(v === VER ? `electron ${VER} ok: ${DEST}` : `electron ${VER} missing (found: ${v || 'none'})`); process.exit(v === VER ? 0 : 1); }
if (have() === VER) { console.log(`electron ${VER} already unpacked: ${DEST}`); process.exit(0); }

const get = async url => { const r = await fetch(url, { redirect: 'follow' }); if (!r.ok) throw new Error(`${r.status} ${url}`); return Buffer.from(await r.arrayBuffer()); };

// the one file we need out of the npm tarball (ustar, gzip) — read the headers, never write entries to disk
function tarFile(tgz, want) {
  const tar = zlib.gunzipSync(tgz);
  for (let o = 0; o + 512 <= tar.length;) {
    const name = tar.toString('utf8', o, o + 100).replace(/\0.*$/s, ''), prefix = tar.toString('utf8', o + 345, o + 500).replace(/\0.*$/s, '');
    const size = parseInt(tar.toString('ascii', o + 124, o + 136).replace(/\0.*$/s, '').trim() || '0', 8);
    if (!name) break;
    if ((prefix ? prefix + '/' : '') + name === want) return tar.subarray(o + 512, o + 512 + size);
    o += 512 + Math.ceil(size / 512) * 512;
  }
  return null;
}

(async () => {
  console.log(`electron ${VER}: npm tarball…`);
  const tgz = await get(`https://registry.npmjs.org/electron/-/electron-${VER}.tgz`);
  const [alg, want] = comp.npmIntegrity.split(/-(.+)/);
  if (crypto.createHash(alg).update(tgz).digest('base64') !== want) throw new Error('npm tarball sha512 does not match vendor-manifest.json — stopping');
  const sums = JSON.parse(String(tarFile(tgz, 'package/checksums.json') || '{}'));
  if (!sums[ZIP]) throw new Error(`checksums.json in the tarball has no ${ZIP}`);
  console.log(`  integrity ok; ${ZIP} must hash to ${sums[ZIP]}`);

  console.log(`  downloading ${ZIP} from the GitHub release…`);
  const zip = await get(`https://github.com/electron/electron/releases/download/v${VER}/${ZIP}`);
  const got = crypto.createHash('sha256').update(zip).digest('hex');
  if (got !== sums[ZIP]) throw new Error(`sha256 mismatch: ${got} — stopping, nothing unpacked`);
  console.log(`  ${(zip.length / 1048576).toFixed(0)} MB, sha256 ok`);

  const tmp = DEST + '.part';
  fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true });
  const zf = path.join(tmp, '..', ZIP); fs.writeFileSync(zf, zip);
  const r = spawnSync(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe'), ['-xf', zf, '-C', tmp], { stdio: 'inherit' });     // Windows 10's bsdtar reads zip
  fs.rmSync(zf, { force: true });
  if (r.status !== 0 || !fs.existsSync(path.join(tmp, 'electron.exe'))) throw new Error('unpacking failed');
  fs.rmSync(DEST, { recursive: true, force: true }); fs.renameSync(tmp, DEST);
  console.log(`electron ${VER} unpacked: ${DEST}`);
})().catch(e => { console.error('fetch-electron: ' + e.message); process.exit(1); });
