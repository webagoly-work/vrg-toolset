// VRG Stack — keep the recordings (STK-Q8 = A).
//
// Claude Code deletes transcripts after `cleanupPeriodDays` (now 3650 in user settings). This copy
// is the second safety: every transcript and file-history checkpoint is mirrored into
// H:/VRG/Full/_admin/recordings. Incremental: a file is copied only when it is new or its size or
// modification time changed. Nothing is ever deleted from the archive, so a transcript removed at
// the source stays here.
'use strict';

const fs = require('fs');
const path = require('path');
const CFG = require('../config');

function* walk(dir) {
  let list; try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const d of list) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) yield* walk(p); else if (d.isFile()) yield p;
  }
}

function archive({ dry = false, log = () => {} } = {}) {
  const res = { copied: 0, bytes: 0, same: 0, failed: [] };
  for (const t of CFG.archive.take) {
    const destRoot = path.join(CFG.archive.dir, t.to);
    for (const src of walk(t.from)) {
      if (t.only && !t.only.test(src)) continue;
      const rel = path.relative(t.from, src);
      if (rel.split(path.sep).includes('memory')) continue; // memory is a source of its own, not a recording
      const dst = path.join(destRoot, rel);
      let s; try { s = fs.statSync(src); } catch { continue; }
      let d = null; try { d = fs.statSync(dst); } catch {}
      if (d && d.size === s.size && Math.abs(d.mtimeMs - s.mtimeMs) < 2000) { res.same++; continue; }
      if (dry) { res.copied++; res.bytes += s.size; continue; }
      try {
        fs.mkdirSync(path.dirname(dst), { recursive: true });
        fs.copyFileSync(src, dst);
        fs.utimesSync(dst, s.atime, s.mtime);
        res.copied++; res.bytes += s.size;
      } catch (e) { res.failed.push(rel + ': ' + e.code); }
    }
    log(`archive ${t.to}: ${res.copied} copied so far`);
  }
  return res;
}

module.exports = { archive };

if (require.main === module) {
  const t0 = Date.now();
  const r = archive({ dry: process.argv.includes('--dry'), log: console.log });
  console.log(`archive: ${r.copied} files (${(r.bytes / 1048576).toFixed(0)} MB) copied, ${r.same} unchanged, ${r.failed.length} failed, ${((Date.now() - t0) / 1000).toFixed(0)} s → ${CFG.archive.dir}`);
  if (r.failed.length) console.log(r.failed.slice(0, 20).join('\n'));
}
