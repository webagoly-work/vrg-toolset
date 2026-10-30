#!/usr/bin/env node
// disk-walk.js — a helper process of CodeCity/companion.js (P8, KV-17): sums file sizes per folder of a drive,
// two levels deep, for the Tárház town on the Land. Prints one JSON line and exits. Sizes and folder names only —
// no file names, no contents — and the companion keeps the result in memory only (CITY-D27 A; the user chose
// "memory only, rescan" on 2026-10-26). Links and junctions are not followed (H:\VRG\Full is a junction to
// the repo's parent and would be counted twice). It stops after <seconds> and says so ("partial"); every top-level
// folder gets an equal share of the time that is left, so one huge folder cannot starve the rest.
//
//   node CodeCity/disk-walk.js <root, e.g. H:\> [seconds=45] [mark=<a path to flag as "this repo">]
'use strict';
const fs = require('fs'), path = require('path');
const [root = 'H:\\', secs = '45', mark = ''] = process.argv.slice(2);
const deadline = Date.now() + Math.max(5, +secs || 45) * 1000;
const RESTRICTED = [[/^h_backup_/i, 'H_BACKUP_*'], [/^\.ssh$/i, '.ssh'], [/^\$recycle\.bin$/i, 'Lomtár'], [/^system volume information$/i, 'rendszer']];
const restrictedOf = n => { const x = RESTRICTED.find(([re]) => re.test(n)); return x ? x[1] : null; };
let partial = false;

async function sizeOf(dir, until = deadline) {
  let size = 0, files = 0, cut = false;
  const stack = [dir];
  while (stack.length) {
    if (Date.now() > until) { partial = cut = true; break; }
    const d = stack.pop();
    let it;
    try { it = await fs.promises.opendir(d); } catch (e) { continue; }
    for await (const e of it) {
      const p = path.join(d, e.name);
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) stack.push(p);
      else if (e.isFile()) { try { size += (await fs.promises.lstat(p)).size; files++; } catch (x) { /* gone */ } }
    }
  }
  return cut ? { size, files, partial: true } : { size, files };
}
async function level(dir, depth, until = deadline) {
  let ents;
  try { ents = await fs.promises.readdir(dir, { withFileTypes: true }); } catch (e) { return []; }
  // the folder that holds the repo is the big one: it goes last and inherits the time the small ones leave
  const holds = e => mark && (path.resolve(mark).toLowerCase() + path.sep).startsWith(path.join(dir, e.name).toLowerCase() + path.sep);
  const out = [], todo = ents.filter(e => e.isDirectory() && !e.isSymbolicLink()).sort((x, y) => holds(x) - holds(y));
  for (const [n, e] of todo.entries()) {
    const share = Date.now() + Math.max(0, until - Date.now()) / (todo.length - n);   // an equal share of what is left
    const p = path.join(dir, e.name), r = restrictedOf(e.name);
    const item = { name: e.name, restricted: r };
    if (mark && (path.resolve(mark).toLowerCase() + path.sep).startsWith(path.resolve(p).toLowerCase() + path.sep)) item.repo = true;
    if (r) { out.push(item); continue; }   // a restricted zone is walled: not even its size is read
    if (depth > 1) { const kids = await level(p, depth - 1, share); item.children = kids; item.size = kids.reduce((a, k) => a + (k.size || 0), 0); item.files = kids.reduce((a, k) => a + (k.files || 0), 0);
      const own = await ownFiles(p); item.size += own.size; item.files += own.files; }
    else Object.assign(item, await sizeOf(p, share));
    out.push(item);
  }
  return out.sort((a, b) => (b.size || 0) - (a.size || 0));
}
async function ownFiles(dir) {
  let size = 0, files = 0, ents;
  try { ents = await fs.promises.readdir(dir, { withFileTypes: true }); } catch (e) { return { size, files }; }
  for (const e of ents) if (e.isFile()) { try { size += (await fs.promises.lstat(path.join(dir, e.name))).size; files++; } catch (x) { /* gone */ } }
  return { size, files };
}
(async () => {
  const t0 = Date.now();
  const dirs = await level(root, 2);
  process.stdout.write(JSON.stringify({ root, at: Date.now(), ms: Date.now() - t0, partial, dirs }) + '\n');
})();
