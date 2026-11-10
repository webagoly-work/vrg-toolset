// cloudattr.js — OneDrive marks from one `attrib` run per listing (no shell). Any failure → no marks, never a blocked listing.
//   parse(text) → Map(name → 'online' | 'pinned' | 'local')      marks(dir) → Promise<Map>      decode(buf, names?) → text
// attrib prints in the OEM codepage (cp852 on Hungarian Windows), not UTF-8 (DESK-Q29 = B). decode() tries cp852, UTF-8 and
// windows-1250 and keeps the one whose names match the folder best, so accented names keep their marks.
'use strict';
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

// cp852 bytes 0x80–0xFF (IBM Latin-2)
const CP852 = 'ÇüéâäůćçłëŐőîŹÄĆ' + 'ÉĹĺôöĽľŚśÖÜŤťŁ×č' + 'áíóúĄąŽžĘę¬źČş«»' + '░▒▓│┤ÁÂĚŞ╣║╗╝Żż┐' +
  '└┴┬├─┼Ăă╚╔╩╦╠═╬¤' + 'đĐĎËďŇÍÎě┘┌█▄ŢŮ▀' + 'ÓßÔŃńňŠšŔÚŕŰýÝţ´' + '\u00ad˝˛ˇ˘§÷¸°¨˙űŘř■\u00a0';
function fromCp852(buf) {
  let s = '';
  for (const b of buf) s += b < 0x80 ? String.fromCharCode(b) : CP852[b - 0x80];
  return s;
}

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

// bytes → text. names (the folder's real entries) pick the decoding that matches most; without names cp852 wins unless the
// bytes are valid UTF-8 with non-ASCII in them.
function decode(buf, names = null) {
  if (typeof buf === 'string') return buf;
  buf = Buffer.from(buf || []);
  const cands = [['cp852', fromCp852(buf)]];
  let utf8 = null; try { utf8 = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) {}
  if (utf8 !== null) cands.push(['utf8', utf8]);
  try { cands.push(['cp1250', new TextDecoder('windows-1250').decode(buf)]); } catch (e) {}
  if (!names) return utf8 !== null && /[^\x00-\x7f]/.test(utf8) ? utf8 : cands[0][1];
  const set = new Set([...names].map(n => n.normalize('NFC').toLowerCase()));
  let best = cands[0], bestScore = -1;
  for (const c of cands) {
    let score = 0;
    for (const n of parse(c[1]).keys()) if (set.has(n.normalize('NFC').toLowerCase())) score++;
    if (score > bestScore) { best = c; bestScore = score; }
  }
  return best[1];
}

const ATTRIB = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'attrib.exe');   // absolute, never PATH

function marks(dir, { run = execFile, timeout = 8000, readdir = d => fs.readdirSync(d) } = {}) {
  return new Promise(resolve => {
    try {
      run(ATTRIB, [String(dir).replace(/[\\/]+$/, '') + '\\*'], { windowsHide: true, timeout, maxBuffer: 16 * 1024 * 1024, encoding: 'buffer' },
        (err, stdout) => {
          if (err) return resolve(new Map());
          let names = null; try { names = readdir(dir); } catch (e) {}
          try { resolve(parse(decode(stdout, names))); } catch (e) { resolve(new Map()); }
        });
    } catch (e) { resolve(new Map()); }
  });
}

module.exports = { parse, marks, decode, fromCp852, ATTRIB };
