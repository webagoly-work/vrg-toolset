#!/usr/bin/env node
// run-spec.js — run one async spec file (an array of { name, fn }) and print one ok/FAIL line per case.
//
//   node CodeCity/tools/run-spec.js CodeCity/from-kapu/test/spec-95-companion.js
//
// selftest.js calls it for the lifted Kapu specs, which are async; exit code 1 on any failure.
'use strict';
const path = require('path');
const specs = require(path.resolve(process.argv[2]));
(async () => {
  let fail = 0;
  for (const s of specs) {
    try { await s.fn(); console.log('ok    ' + s.name); }
    catch (e) { fail++; console.log('FAIL  ' + s.name + ' — ' + String(e && e.message || e).split('\n')[0]); }
  }
  process.exit(fail ? 1 : 0);
})();
