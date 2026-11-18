#!/usr/bin/env node
// node Weather/test/run.js [name]  — the VRG Időjárás tests (invented data only, no network, no real jobs).
'use strict';
const fs = require('fs');
const path = require('path');
require('./env');   // first: sets the env the lib reads at load time

(async () => {
  const only = process.argv[2];
  const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js') && (!only || f.includes(only))).sort();
  let pass = 0, fail = 0;
  for (const f of files) {
    console.log('# ' + f);
    const t = async (name, fn) => {
      try { await fn(); pass++; console.log('  ok   ' + name); }
      catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e && e.stack || e).split('\n').slice(0, 4).join('\n       ')); }
    };
    try { await require(path.join(__dirname, f))(t); } catch (e) { fail++; console.log('  FAIL (file) ' + (e && e.stack || e)); }
  }
  console.log((fail ? 'FAIL' : 'PASS') + ' ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
