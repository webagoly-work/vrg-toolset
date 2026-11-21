#!/usr/bin/env node
// Sketcher/test/run.js — the Sketcher test entry: fixture check, variant check, dist check, the page test.
'use strict';
const { spawnSync } = require('child_process'), path = require('path');
const R = path.join(__dirname, '..');
const steps = [['make-fixture --check', ['tools/make-fixture.js', '--check']], ['make-site-fixture --check', ['tools/make-site-fixture.js', '--check']], ['make-takeoff-fixture --check', ['tools/make-takeoff-fixture.js', '--check']], ['make-report-fixture --check', ['tools/make-report-fixture.js', '--check']], ['make-features-fixture --check', ['tools/make-features-fixture.js', '--check']], ['features.test', ['test/features.test.js']], ['roombox.test (skcam K1)', ['test/roombox.test.js']], ['roombox-browser.test (skcam K1, Playwright)', ['test/roombox-browser.test.js']], ['variant-check', ['tools/variant-check.js']],
  ['build --check', ['tools/build.js', '--check']], ['page.test', ['test/page.test.js']], ['report-phone.test', ['test/report-phone.test.js']],
  ['e2e.test (F8: phone → package → Desktop → Planner)', ['test/e2e.test.js']]];
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
