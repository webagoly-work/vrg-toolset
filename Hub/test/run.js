#!/usr/bin/env node
// VRG Kapu test runner: every Hub/test/spec-*.js exports [{ name, fn }].
// Specs load the page modules with kpLoad() into a fresh vm context, so no browser is needed.
//
//   node Hub/test/run.js

'use strict';

const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const specs = fs.readdirSync(DIR).filter(f => /^spec-.*\.js$/.test(f)).sort();

let pass = 0, total = 0;
const failed = [];

for (const file of specs) {
  let cases;
  try { cases = require(path.join(DIR, file)); }
  catch (e) { failed.push(file + ': ' + e.message); total++; continue; }
  for (const c of cases) {
    total++;
    try { c.fn(); pass++; }
    catch (e) { failed.push(file + ' / ' + c.name + ': ' + e.message); }
  }
}

for (const f of failed) console.log('  FAIL  ' + f);
console.log(pass + '/' + total + (failed.length ? '  ·  ' + failed.length + ' failing' : '  ·  all green'));
process.exit(failed.length ? 1 : 0);
