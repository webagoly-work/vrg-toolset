// varler-merge.js — one-off, 2026-10-30 (GO HK §6): the two "VARLER Documents-" OneDrive folders into
// VRG-Megosztott\10_Projektek\_VARLER Documents. Copies only; nothing is deleted. On a real difference the
// newer file keeps the name and the other goes to _utkozesek\ with its date. Writes the report into _utkozesek (client file names, not for git).
//   node varler-merge.js        copy + verify
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const OD = 'C:/Users/webag/OneDrive';
const ROOT = path.join(OD, 'VARLER Documents-');
const DESK = path.join(OD, 'Asztali gép', 'VARLER Documents-');
const DEST = path.join(OD, 'VRG-Megosztott', '10_Projektek', '_VARLER Documents');
const CONFLICTS = path.join(DEST, '_utkozesek');

function walk(dir, base = dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, base, out); else out.push(path.relative(base, p));
  }
  return out;
}
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
function copy(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.writeFileSync(dst, fs.readFileSync(src));   // copyFile fails on OneDrive cloud-only placeholders
  const s = fs.statSync(src);
  fs.utimesSync(dst, s.atime, s.mtime);
}
const day = f => fs.statSync(f).mtime.toISOString().slice(0, 10);
function loserPath(rel, f) {
  const p = path.parse(rel);
  return path.join(CONFLICTS, p.dir, p.name + '.' + day(f) + p.ext);
}

if (fs.existsSync(DEST)) { console.error('target already exists: ' + DEST); process.exit(1); }
const rootFiles = walk(ROOT), deskFiles = walk(DESK);
for (const r of rootFiles) copy(path.join(ROOT, r), path.join(DEST, r));

let identical = 0; const added = [], conflicts = [];
for (const r of deskFiles) {
  const d = path.join(DESK, r), t = path.join(DEST, r);
  if (!fs.existsSync(t)) { copy(d, t); added.push(r); continue; }
  if (sha(d) === sha(t)) { identical++; continue; }
  const dm = fs.statSync(d).mtimeMs, rm = fs.statSync(path.join(ROOT, r)).mtimeMs;
  if (dm > rm) {                            // desktop newer: it takes the name, the root copy moves aside
    const lose = loserPath(r, path.join(ROOT, r));
    copy(path.join(ROOT, r), lose); copy(d, t);
    conflicts.push({ r, winner: 'Asztali gép', lose: path.relative(DEST, lose) });
  } else {
    const lose = loserPath(r, d);
    copy(d, lose);
    conflicts.push({ r, winner: 'gyökér', lose: path.relative(DEST, lose) });
  }
}

// every source file must exist in the target or in _utkozesek with the same hash
const have = new Set(walk(DEST).map(r => sha(path.join(DEST, r))));
const missing = [];
for (const [base, files] of [[ROOT, rootFiles], [DESK, deskFiles]]) {
  for (const r of files) if (!have.has(sha(path.join(base, r)))) missing.push(path.join(base, r));
}

const rep = [
  '# VARLER Documents merge — 2026-10-30', '',
  '*Made by `varler-merge.js` (GO HK §6). Paths and counts only.*', '',
  '| | |', '|---|---|',
  '| Root copy | ' + rootFiles.length + ' files |',
  '| Asztali gép copy | ' + deskFiles.length + ' files |',
  '| Identical | ' + identical + ' |',
  '| Only in Asztali gép, added | ' + added.length + ' |',
  '| Conflicts | ' + conflicts.length + ' |',
  '| Target | ' + walk(DEST).length + ' files |',
  '| Hash check, missing | ' + missing.length + ' |', '',
  '## Conflicts', '', '| File | Newer (keeps the name) | Older copy |', '|---|---|---|',
  ...conflicts.map(c => '| `' + c.r + '` | ' + c.winner + ' | `' + c.lose + '` |'), '',
  '## Added from Asztali gép', '', ...added.map(a => '- `' + a + '`'), ''
].concat(missing.length ? ['## MISSING', '', ...missing.map(m => '- `' + m + '`'), ''] : []);
fs.writeFileSync(path.join(CONFLICTS, 'varler-merge-2026-10-30.md'), rep.join('\n'));
console.log({ root: rootFiles.length, desk: deskFiles.length, identical, added: added.length, conflicts: conflicts.length, missing: missing.length });
process.exit(missing.length ? 1 : 0);
