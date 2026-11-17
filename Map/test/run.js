#!/usr/bin/env node
// node Map/test/run.js [name]  — the VRG Térkép tests (invented data only, no network, no real jobs).
'use strict';
const fs = require('fs');
const path = require('path');

(async () => {
  const only = process.argv[2];
  const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js') && (!only || f.includes(only))).sort();
  let pass = 0, fail = 0;
  for (const f of files) {
    console.log('# ' + f);
    const pending = [];
    const t = (name, fn) => {
      const p = (async () => { await fn(); })().then(() => { pass++; console.log('  ok   ' + name); },
        e => { fail++; console.log('  FAIL ' + name + '\n       ' + String(e && e.message || e).split('\n').join('\n       ')); });
      pending.push(p);
      return p;
    };
    try { await require(path.join(__dirname, f))(t); } catch (e) { fail++; console.log('  FAIL (file) ' + (e && e.stack || e)); }
    await Promise.all(pending);
  }
  console.log((fail ? 'FAIL' : 'PASS') + ' ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
