#!/usr/bin/env node
// estate-walk.js — a helper process of the segéd for Gépország's Birtok view (CITY-D45 note, D52 A): what fills one drive, per
// folder two levels deep: bytes, file counts, bytes per kind, the size bands, the largest files as size and kind only. Numbers
// and folder names; no file name ever leaves this process (CITY-D27 A), and the segéd keeps the result in memory only. Links
// and junctions are not followed. Walled zones are not read at all, as in disk-walk.js. It stops after <seconds> and says so
// ("partial"). vrg-probe --estate (probe/Estate.cs) gives the same result far faster and is used when built; this one is the
// fallback, and the tested statement of the result's shape. Prints {"p":0..1} progress lines, then one result line.
//
//   node CodeCity/estate-walk.js <root, e.g. H:\> [seconds=90]
'use strict';
const fs = require('fs'), path = require('path');

const KINDS = {
  image: 'jpg jpeg png gif webp bmp tif tiff heic raw cr2 nef svg psd ai',
  audio: 'mp3 wav flac ogg m4a aac wma opus',
  video: 'mp4 mkv avi mov wmv webm m4v mpg mpeg',
  doc: 'pdf doc docx xls xlsx ppt pptx txt md rtf odt ods csv epub',
  code: 'js mjs ts tsx py c h cpp hpp cs java kt html htm css json xml yaml yml ps1 cmd bat sh go rs ino',
  archive: 'zip 7z rar tar gz iso cab msi img vhd vhdx wim bak',
  program: 'exe dll sys ocx drv so pak',
};
const KIND_OF = new Map();
for (const [k, list] of Object.entries(KINDS)) for (const e of list.split(' ')) KIND_OF.set('.' + e, k);
const RESTRICTED = [[/^h_backup_/i, 'H_BACKUP_*'], [/^\.ssh$/i, '.ssh'], [/^\$recycle\.bin$/i, 'Lomtár'], [/^system volume information$/i, 'rendszer']];
const restrictedOf = n => { const x = RESTRICTED.find(([re]) => re.test(n)); return x ? x[1] : null; };
const BAND_MID = 2 ** 20, BAND_BIG = 100 * 2 ** 20, TOP_N = 5;

const fresh = name => ({ name, size: 0, files: 0, kinds: {}, bands: [0, 0, 0], top: [] });
function count(st, size, name) {
  const kind = KIND_OF.get(path.extname(name).toLowerCase()) || 'other';
  st.size += size; st.files++;
  st.kinds[kind] = (st.kinds[kind] || 0) + size;
  st.bands[size >= BAND_BIG ? 2 : size >= BAND_MID ? 1 : 0]++;
  if (size >= BAND_BIG) {
    st.top.push([size, kind]);
    if (st.top.length > TOP_N) { st.top.sort((a, b) => b[0] - a[0]); st.top.pop(); }
  }
}
function list(dir) { try { return fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return []; } }
function fileInto(st, dir, e) {
  try { const s = fs.lstatSync(path.join(dir, e.name), { throwIfNoEntry: false }); if (s) count(st, s.size, e.name); } catch (x) { /* locked or gone */ }
}
// one folder's listing: its files into st, its real subfolders handed back
function scan(st, dir) {
  const subs = [];
  for (const e of list(dir)) {
    if (e.isSymbolicLink()) continue;
    if (e.isDirectory()) subs.push(e.name); else if (e.isFile()) fileInto(st, dir, e);
  }
  return subs;
}
function merge(into, st) {
  into.size += st.size; into.files += st.files;
  for (const [k, v] of Object.entries(st.kinds)) into.kinds[k] = (into.kinds[k] || 0) + v;
  st.bands.forEach((n, i) => { into.bands[i] += n; });
  into.top.push(...st.top);
  if (st.partial) into.partial = true;
}
const KEEP_KIDS = 8, SLICE_MS = 700;
function walk(root, secs, progress = () => {}) {
  const t0 = Date.now(), deadline = t0 + Math.max(2, secs) * 1000, own = fresh(''), jobs = [], tops = [], walled = [];
  own.own = true; own.kids = [];
  for (const name of scan(own, root)) {
    const r = restrictedOf(name);
    if (r) { walled.push(r); continue; }
    const dir = path.join(root, name), mine = fresh(''), kids = [];
    mine.own = true;
    for (const kn of scan(mine, dir)) {
      const kr = restrictedOf(kn);
      if (kr) { kids.push(Object.assign(fresh(kn), { restricted: kr })); continue; }
      const st = fresh(kn); kids.push(st); jobs.push({ st, stack: [path.join(dir, kn)] });
    }
    tops.push({ name, mine, kids });
  }
  // folders take turns, so a huge one cannot starve the rest and no time goes unused while anything is unfinished
  let live = jobs.slice();
  while (live.length && Date.now() < deadline) {
    const job = live.shift(), until = Date.now() + SLICE_MS;
    while (job.stack.length && Date.now() < until) { const d = job.stack.pop(); for (const n of scan(job.st, d)) if (!restrictedOf(n)) job.stack.push(path.join(d, n)); }
    if (job.stack.length) live.push(job);
    progress(1 - live.length / Math.max(1, jobs.length));
  }
  for (const job of live) job.st.partial = true;
  const dirs = tops.map(({ name, mine, kids }) => {
    kids.sort((a, b) => b.size - a.size);
    const item = fresh(name), keep = kids.slice(0, KEEP_KIDS), rest = fresh('');
    rest.rest = kids.length - keep.length;
    for (const k of kids.slice(KEEP_KIDS)) merge(rest, k);
    if (rest.size) keep.push(rest);
    if (mine.size) keep.push(mine);
    for (const k of keep) { merge(item, k); k.top = k.top.sort((a, b) => b[0] - a[0]).slice(0, TOP_N); }
    item.top = []; item.kids = keep;
    return item;
  });
  if (own.size) dirs.push(own);
  return { root, at: Date.now(), ms: Date.now() - t0, partial: dirs.some(x => x.partial), walled, dirs: dirs.sort((a, b) => b.size - a.size) };
}

if (require.main === module) {
  const [root = 'H:\\', secs = '90'] = process.argv.slice(2);
  const r = walk(root, +secs || 90, p => process.stdout.write(JSON.stringify({ p }) + '\n'));
  process.stdout.write(JSON.stringify(r) + '\n');
}
module.exports = { walk };
