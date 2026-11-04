// cloudattr.js — OneDrive marks from one `attrib` run per listing (no shell). Any failure → no marks, never a blocked listing.
//   parse(text) → Map(name → 'online' | 'pinned' | 'local')      marks(dir) → Promise<Map>
'use strict';
const { execFile } = require('child_process');
const path = require('path');

// a line is "<attribute letters>   <absolute path>"; O (offline) or U (unpinned) without P = cloud-only, P = always kept
function parse(text) {
  const out = new Map();
  for (const line of String(text || '').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z ]*?)\s*([A-Za-z]:\\.+?)\s*$/.exec(line);
    if (!m) continue;
    const letters = new Set(m[1].replace(/\s+/g, '').toUpperCase().split(''));
    const mark = letters.has('P') ? 'pinned' : (letters.has('O') || letters.has('U') ? 'online' : 'local');
    out.set(path.win32.basename(m[2]), mark);
  }
  return out;
}

function marks(dir, { run = execFile, timeout = 8000 } = {}) {
  return new Promise(resolve => {
    try {
      run('attrib', [String(dir).replace(/[\\/]+$/, '') + '\\*'], { windowsHide: true, timeout, maxBuffer: 16 * 1024 * 1024, encoding: 'utf8' },
        (err, stdout) => resolve(err ? new Map() : parse(stdout)));
    } catch (e) { resolve(new Map()); }
  });
}

module.exports = { parse, marks };
