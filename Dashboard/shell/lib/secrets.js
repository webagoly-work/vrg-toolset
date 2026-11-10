// secrets.js — OAuth tokens and the like, encrypted with Electron safeStorage (Windows DPAPI) in <userDir>/secrets.bin.
// No IPC exposes this: only other main modules call it (CONTRACT §4.1). Never falls back to plain text.
//   const secrets = createSecrets({ safeStorage });   secrets.put('mail.token', '…');  secrets.get(…); secrets.has(…); secrets.del(…)
'use strict';
const fs = require('fs'), path = require('path');
const paths = require('./paths.js');

function createSecrets({ safeStorage }) {
  const file = () => path.join(paths.userDir(), 'secrets.bin');
  const need = () => {
    let ok = false;
    try { ok = !!safeStorage && safeStorage.isEncryptionAvailable() === true; } catch (e) {}
    if (!ok) throw new Error('secrets-unavailable');
  };
  const load = () => {
    need();
    let buf;
    try { buf = fs.readFileSync(file()); } catch (e) { return Object.create(null); }
    if (!buf.length) return Object.create(null);
    return Object.assign(Object.create(null), JSON.parse(safeStorage.decryptString(buf)));
  };
  const save = map => {
    need();
    const enc = safeStorage.encryptString(JSON.stringify(map));
    const f = file(), tmp = f + '.tmp';
    fs.writeFileSync(tmp, enc);
    fs.renameSync(tmp, f);
  };
  const name = n => { if (typeof n !== 'string' || !n.length || n.length > 100) throw new Error('secrets: bad name'); return n; };

  return {
    put(n, value) {
      name(n);
      if (typeof value !== 'string') throw new Error('secrets: value must be a string');
      const m = load(); m[n] = value; save(m);
    },
    get(n) { name(n); const m = load(); return n in m ? m[n] : null; },
    has(n) { name(n); return n in load(); },
    del(n) { name(n); const m = load(); if (!(n in m)) return false; delete m[n]; save(m); return true; },
  };
}

module.exports = { createSecrets };
