// VRG Stack — a C folder's real bytes for the Stack Viewer's deep dive (S10, research/STRINGS-PLAN.md §6.4:
// "Kód bájtjai"). serve.js answers GET /api/bytes?path=<folder> with it; nothing here writes.
//
//   folderBytes(repo, rel, { cap }) → { path, files: [[name, start, end, size]], total, truncated, buf }
//
// What it reads: the files git tracks DIRECTLY in that folder (not its sub-folders: those are their own C cells),
// in name order, until `cap` bytes (4 MB). Tracked files only, so an untracked secret never leaves the disk; on top
// of that the launcher's secret rule (vrg-git.ps1) and the repo's never-commit rule are applied by name: .env*,
// *.pem, *.key, *.pfx, *.p12, id_rsa*, credentials*.json, .credentials.json, *.pdf (client quotes), and the folders
// Vendor/, Planner/apps|home|data/, node_modules/. A path that leaves the repo, or names .git, is refused.
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const CAP = 4 * 1024 * 1024;
const SECRET = /^\.env|\.pem$|\.key$|\.pfx$|\.p12$|^id_rsa|^credentials.*\.json$|^\.credentials\.json$|\.pdf$/i;
const BARRED = /^(Vendor|Planner\/apps|Planner\/home|Planner\/data)(\/|$)|(^|\/)node_modules(\/|$)/;

class Refused extends Error { constructor(code, msg) { super(msg); this.code = code; } }

function clean(rel) {
  const r = String(rel || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!r) throw new Refused(400, 'path missing');
  if (r.split('/').some(s => s === '..' || s === '.' || s === '' || s === '.git')) throw new Refused(400, 'path not allowed: ' + r);
  if (BARRED.test(r)) throw new Refused(403, 'folder not served: ' + r);
  return r;
}

function folderBytes(repo, rel, { cap = CAP } = {}) {
  const r = clean(rel), root = path.resolve(repo), abs = path.resolve(root, r);
  if (!abs.startsWith(root + path.sep)) throw new Refused(403, 'outside the repo');
  let listed;
  try { listed = execFileSync('git', ['ls-files', '-z', '--', r + '/'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); }
  catch (e) { throw new Refused(503, 'git ls-files failed: ' + String(e.message || e).split('\n')[0]); }
  const names = listed.split('\0').filter(Boolean).filter(f => f.startsWith(r + '/') && !f.slice(r.length + 1).includes('/'))
    .map(f => f.slice(r.length + 1)).filter(n => !SECRET.test(n)).sort();
  const parts = [], files = [];
  let at = 0, truncated = false;
  for (const n of names) {
    let b;
    try { const st = fs.statSync(path.join(abs, n)); if (!st.isFile()) continue; b = fs.readFileSync(path.join(abs, n)); } catch { continue; }
    const take = Math.min(b.length, cap - at);
    if (take <= 0) { truncated = true; break; }
    if (take < b.length) truncated = true;
    parts.push(b.subarray(0, take)); files.push([n, at, at + take, b.length]); at += take;
  }
  return { path: r, files, total: at, truncated, buf: Buffer.concat(parts, at) };
}

module.exports = { folderBytes, clean, Refused, CAP, SECRET };
