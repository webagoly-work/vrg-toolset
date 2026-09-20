#!/usr/bin/env node
// ---------------------------------------------------------------------------
// fetch-vendor.js — pull the third-party components listed in
// vendor-manifest.json into Vendor/, and keep vrg-vendor.html in sync with it.
//
// Zero dependencies, on purpose: this has to run on a fresh machine before
// anything else is installed. Node >= 18 (global fetch).
//
//   node tools/fetch-vendor.js --list
//   node tools/fetch-vendor.js --all
//   node tools/fetch-vendor.js fflate tesseract-js
//   node tools/fetch-vendor.js --sync-page
//
// Vendor/ is gitignored — same rule as Planner/apps/. Nothing downloaded here
// is committed; this file plus the manifest are the reproducible part.
// Vendor/.lock.json records the commit each component was resolved to, so a
// later run can tell you whether upstream moved.
//
// WHY TAR AND NOT ZIP: a tar reader is ~40 lines of header parsing, a zip
// reader needs central-directory walking (see Inventory/tools/xlsx.js for how
// much that costs). GitHub serves both; we take the cheap one.
// ---------------------------------------------------------------------------

'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST = path.join(ROOT, 'vendor-manifest.json');
const PAGE = path.join(ROOT, 'vrg-vendor.html');

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const VENDOR = path.join(ROOT, manifest.vendorDir);
const LOCK = path.join(VENDOR, '.lock.json');

// --- tiny tar reader -------------------------------------------------------
// Returns [{name, data}] for regular files. Handles the GNU long-name record
// and skips pax headers, which GitHub tarballs emit for deep paths.

function untar(buf) {
  const out = [];
  let off = 0;
  let longName = null;

  while (off + 512 <= buf.length) {
    const header = buf.subarray(off, off + 512);
    if (header[0] === 0) break; // two zero blocks = end of archive

    const rawName = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '');
    const sizeField = header.subarray(124, 136).toString('ascii').replace(/[\0 ]/g, '');
    const size = parseInt(sizeField, 8) || 0;
    const type = String.fromCharCode(header[156]);
    const prefix = header.subarray(345, 500).toString('utf8').replace(/\0.*$/, '');

    off += 512;
    const data = buf.subarray(off, off + size);
    off += Math.ceil(size / 512) * 512;

    if (type === 'L') {                      // GNU long name for the NEXT entry
      longName = data.toString('utf8').replace(/\0.*$/, '');
      continue;
    }
    if (type === 'x' || type === 'g') continue; // pax metadata, not a file

    const name = longName || (prefix ? prefix + '/' + rawName : rawName);
    longName = null;

    if (type === '0' || type === '\0' || type === '') out.push({ name, data });
  }
  return out;
}

// --- helpers ---------------------------------------------------------------

function stripTopDir(name) {
  const i = name.indexOf('/');
  return i === -1 ? '' : name.slice(i + 1);
}

// A tarball is untrusted input, even from a repository we picked ourselves:
// upstream can be compromised, and an archive may name an entry
// "pkg/../../../.ssh/authorized_keys". path.join() resolves that happily and
// writes outside Vendor/. Every path derived from archive or manifest data
// goes through here, which resolves it and refuses anything that lands outside
// its base. Note the backslash check: on Windows "a\..\b" is traversal too,
// while on POSIX a backslash is a legal filename character, so the separator
// is normalised before the test rather than after.
const BACKSLASH = String.fromCharCode(92);

function safeJoin(base, rel) {
  if (typeof rel !== 'string' || !rel) return null;
  if (rel.includes('\0')) return null;
  const cleaned = rel.split(BACKSLASH).join('/');
  if (path.isAbsolute(cleaned) || /^[a-zA-Z]:/.test(cleaned)) return null;

  const root = path.resolve(base);
  const full = path.resolve(root, cleaned);
  // path.relative gives "" for the base itself and a "../"-prefixed path for
  // anything above it. Comparing resolved paths beats string prefixes, which
  // would also accept a sibling directory called "Vendor-evil".
  const rel2 = path.relative(root, full);
  if (rel2 === '' || rel2.startsWith('..') || path.isAbsolute(rel2)) return null;
  return full;
}

function writeFileDeep(dest, data) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, data);
}

function readLock() {
  try { return JSON.parse(fs.readFileSync(LOCK, 'utf8')); } catch { return {}; }
}

function human(n) {
  return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB'
       : n > 1024    ? (n / 1024).toFixed(0) + ' kB'
       : n + ' B';
}

async function resolveCommit(repo, ref) {
  // Best effort: unauthenticated API, 60 req/h. A failure here is not fatal —
  // we still record the ref, just without the sha.
  try {
    const r = await fetch(`https://api.github.com/repos/${repo}/commits/${ref}`, {
      headers: { Accept: 'application/vnd.github.sha', 'User-Agent': 'vrg-fetch-vendor' }
    });
    return r.ok ? (await r.text()).trim() : null;
  } catch { return null; }
}

// --- commands --------------------------------------------------------------

function list() {
  const lock = readLock();
  const rows = manifest.components.map(c => ({
    slug: c.slug,
    mode: c.vendor,
    build: c.build,
    pri: c.priority,
    state: c.vendor !== 'fetch' ? '—'
         : fs.existsSync(path.join(VENDOR, c.target)) ? 'megvan'
         : 'hiányzik',
    locked: lock[c.slug] ? lock[c.slug].sha.slice(0, 7) : ''
  }));
  const w = k => Math.max(...rows.map(r => String(r[k]).length), k.length);
  const cols = ['slug', 'mode', 'build', 'pri', 'state', 'locked'];
  const line = r => cols.map(k => String(r[k]).padEnd(w(k))).join('  ');
  console.log(line(Object.fromEntries(cols.map(k => [k, k]))));
  console.log(cols.map(k => '-'.repeat(w(k))).join('  '));
  rows.forEach(r => console.log(line(r)));

  const fetchable = manifest.components.filter(c => c.vendor === 'fetch').length;
  const missing = rows.filter(r => r.state === 'hiányzik').length;
  console.log(`\n${fetchable} letölthető, ${missing} hiányzik. Letöltés: node tools/fetch-vendor.js --all`);
}

async function fetchOne(c) {
  if (c.vendor !== 'fetch') {
    console.log(`- ${c.slug}: kihagyva (${c.vendor}) — lásd docs/services-server.md`);
    return false;
  }
  const url = `https://codeload.github.com/${c.repo}/tar.gz/refs/heads/${c.ref}`;
  process.stdout.write(`- ${c.slug}: ${c.repo}@${c.ref} ... `);

  const res = await fetch(url, { headers: { 'User-Agent': 'vrg-fetch-vendor' } });
  if (!res.ok) {
    console.log(`HIBA ${res.status}`);
    if (res.status === 404) console.log(`    A '${c.ref}' ág nem létezik? Nézd meg a repót: https://github.com/${c.repo}`);
    if (res.status === 403) console.log('    A codeload.github.com-ot valami blokkolja (céges proxy, tűzfal).');
    return false;
  }

  const gz = Buffer.from(await res.arrayBuffer());
  const files = untar(zlib.gunzipSync(gz));

  // c.target comes from the manifest, which is ours — but it is still data,
  // and rmSync below is recursive.
  const dest = safeJoin(VENDOR, c.target);
  if (!dest) {
    console.log('HIBA: gyanús célkönyvtár a manifestben: ' + c.target);
    return false;
  }
  fs.rmSync(dest, { recursive: true, force: true });
  let bytes = 0;
  let refused = 0;
  for (const f of files) {
    const rel = stripTopDir(f.name);
    if (!rel) continue;
    const out = safeJoin(dest, rel);
    if (!out) { refused++; continue; }   // entry tried to escape Vendor/
    writeFileDeep(out, f.data);
    bytes += f.data.length;
  }
  if (refused) {
    console.log('  FIGYELEM: ' + refused + ' bejegyzés a Vendor/ könyvtáron KÍVÜLRE mutatott,');
    console.log('  ezért nem írtam ki őket. Ez nem normális egy GitHub-tarballban — nézd meg a repót:');
    console.log('  https://github.com/' + c.repo);
  }

  const sha = await resolveCommit(c.repo, c.ref);
  const lock = readLock();
  lock[c.slug] = { repo: c.repo, ref: c.ref, sha: sha || '(feloldatlan)', fetched: new Date().toISOString().slice(0, 10) };
  writeFileDeep(LOCK, JSON.stringify(lock, null, 2) + '\n');

  console.log(`${files.length} fájl, ${human(bytes)}${sha ? ', ' + sha.slice(0, 7) : ''}`);
  return true;
}

async function fetchMany(slugs) {
  fs.mkdirSync(VENDOR, { recursive: true });
  const wanted = slugs.length
    ? manifest.components.filter(c => slugs.includes(c.slug))
    : manifest.components.filter(c => c.vendor === 'fetch');

  if (!wanted.length) {
    console.error('Nincs ilyen komponens. Lista: node tools/fetch-vendor.js --list');
    process.exitCode = 1;
    return;
  }
  let ok = 0;
  for (const c of wanted) if (await fetchOne(c)) ok++;
  console.log(`\nKész: ${ok}/${wanted.length}. Cél: ${path.relative(ROOT, VENDOR)}/`);
}

// Rewrite the generated block in vrg-vendor.html. Same marker trick as
// Planner/projects/varler-planner/build.js — the page stays a single file that
// opens from file://, but the data still has one source of truth.
function syncPage() {
  const START = '/*__COMPONENTS_START__*/';
  const END = '/*__COMPONENTS_END__*/';
  let html = fs.readFileSync(PAGE, 'utf8');
  const a = html.indexOf(START), b = html.indexOf(END);
  if (a === -1 || b === -1) {
    console.error(`Nem találom a jelölőket a ${path.basename(PAGE)} fájlban.`);
    process.exitCode = 1;
    return;
  }
  const rows = manifest.components.map(c => ({
    slug: c.slug, name: c.name, repo: c.repo, npm: c.npm || null,
    license: c.license, stars: c.stars, pushed: c.pushed,
    aspect: c.aspect, build: c.build, priority: c.priority,
    vendor: c.vendor, target: c.target, note: c.note
  }));
  const block = START + '\n  const COMPONENTS = ' +
    JSON.stringify(rows, null, 2).split('\n').join('\n  ') + ';\n  ' + END;
  fs.writeFileSync(PAGE, html.slice(0, a) + block + html.slice(b + END.length));
  console.log(`${path.basename(PAGE)} frissítve — ${rows.length} komponens.`);
}

// --- entry -----------------------------------------------------------------

const args = process.argv.slice(2);
if (args.includes('--list') || args.length === 0) list();
else if (args.includes('--sync-page')) syncPage();
else fetchMany(args.filter(a => !a.startsWith('--'))).catch(err => {
  console.error('\nMegszakadt:', err.message);
  process.exitCode = 1;
});
