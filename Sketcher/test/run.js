#!/usr/bin/env node
// Sketcher/test/run.js — the Sketcher test entry: fixture check, variant check, dist check, the page test.
'use strict';
const { spawnSync } = require('child_process'), path = require('path');
const R = path.join(__dirname, '..');
const steps = [['make-fixture --check', ['tools/make-fixture.js', '--check']], ['make-takeoff-fixture --check', ['tools/make-takeoff-fixture.js', '--check']], ['variant-check', ['tools/variant-check.js']],
  ['build --check', ['tools/build.js', '--check']], ['page.test', ['test/page.test.js']]];
let n = 0, failed = 0;
for (const [name, args] of steps) {
  const r = spawnSync(process.execPath, args, { cwd: R, encoding: 'utf8' });
  const out = (r.stdout || '') + (r.stderr || '');
  process.stdout.write('--- ' + name + '\n' + out);
  if (r.status !== 0) { failed++; console.log('FAILED: ' + name); }
  const m = /ALL PASS \((\d+)\)/.exec(out); n += m ? +m[1] : 1;
}
console.log(failed ? failed + ' FAILED' : 'ALL PASS (' + n + ')');
process.exit(failed ? 1 : 0);
