// VRG Stack — safe file operations. Every write the stack makes goes through here.
//
//   writeAtomic   write to <file>.tmp, then rename: a crash never leaves half a file
//   readJsonl     read an append-only log; a torn last line is reported, not thrown
//   repairJsonl   cut a log back to its last valid line, keeping the cut part in <file>.torn
//   appendJsonl   append records, one per line
//   withLock      one build at a time; a lock older than `staleMin` is taken over
'use strict';

const fs = require('fs');
const path = require('path');

const pause = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/* Rename tmp over file. On Windows a file that was just written is often held for a moment
   (a virus scanner, the search indexer, a reader): retry with a growing pause, and as a last
   resort copy the bytes over the old file, which works while another process only reads it. */
function replace(tmp, file) {
  for (let i = 0; i < 6; i++) {
    try { fs.renameSync(tmp, file); return; }
    catch (e) { if (!['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) throw e; pause(150 * (i + 1)); }
  }
  fs.copyFileSync(tmp, file);
  try { fs.unlinkSync(tmp); } catch {}
}

function writeAtomic(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, content);
  replace(tmp, file);
}

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function readJsonl(file) {
  const out = { records: [], bad: [] };
  let txt;
  try { txt = fs.readFileSync(file, 'utf8'); } catch { return out; }
  const lines = txt.split('\n');
  lines.forEach((l, i) => {
    if (!l.trim()) return;
    try { out.records.push(JSON.parse(l)); } catch { out.bad.push({ line: i + 1, last: i >= lines.length - 2 }); }
  });
  return out;
}

/* Only a torn LAST line is repaired (an interrupted append). Bad lines in the middle mean
   someone edited the log; that is reported and left for a person. */
function repairJsonl(file) {
  const { bad } = readJsonl(file);
  if (!bad.length) return { repaired: false };
  if (bad.some(b => !b.last)) return { repaired: false, reason: 'bad lines inside the log, not only at its end' };
  const txt = fs.readFileSync(file, 'utf8');
  const lines = txt.split('\n');
  let keep = lines.length;
  while (keep > 0) { const l = lines[keep - 1]; if (!l.trim()) { keep--; continue; } try { JSON.parse(l); break; } catch { keep--; } }
  fs.appendFileSync(file + '.torn', lines.slice(keep).join('\n') + '\n');
  writeAtomic(file, lines.slice(0, keep).join('\n') + (keep ? '\n' : ''));
  return { repaired: true, cut: lines.length - keep };
}

function appendJsonl(file, records) {
  if (!records.length) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, records.map(r => JSON.stringify(r)).join('\n') + '\n');
}

function withLock(dir, staleMin, fn) {
  const lock = path.join(dir, '.lock');
  fs.mkdirSync(dir, { recursive: true });
  try {
    const age = (Date.now() - fs.statSync(lock).mtimeMs) / 60000;
    if (age < staleMin) throw new Error(`another build is running (lock ${Math.round(age)} min old: ${lock})`);
    fs.unlinkSync(lock); // stale: the last build died
  } catch (e) { if (e.code !== 'ENOENT') throw e; }
  fs.writeFileSync(lock, String(process.pid));
  const release = () => { try { fs.unlinkSync(lock); } catch {} };
  try {
    const r = fn();
    if (r && typeof r.then === 'function') return r.finally(release);
    release(); return r;
  } catch (e) { release(); throw e; }
}

const mtime = f => { try { return fs.statSync(f).mtimeMs; } catch { return 0; } };

module.exports = { writeAtomic, replace, readJson, readJsonl, repairJsonl, appendJsonl, withLock, mtime };
