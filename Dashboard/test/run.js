// The check runner for the Desktop OS work packages (CONTRACT §7).
//   node Dashboard/test/run.js WP-01     test/wp-01.test.js with node --test, and the shell selftest with --probe wp-01
//                                        when shell/selftest/wp-01.js exists
//   node Dashboard/test/run.js --all     every test/*.test.js and the full selftest once
// Prints one JSON line { ok, wp, tests:{pass,fail}, selftest:{ok,errors} }; exit 0 only when everything is green.
// Electron: VRG_ELECTRON, else <FULL>/tools/electron/electron.exe. Add --shot <file> to keep a PNG of the selftest.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');

const DASH = path.resolve(__dirname, '..');
const REPO = path.resolve(DASH, '..');
const FULL = (() => {
  const up = path.resolve(REPO, '..');
  return fs.existsSync(path.join(up, 'notes', 'features')) ? up : (process.env.VRG_FULL || 'H:\\VRG\\Full');
})();
const ELECTRON = process.env.VRG_ELECTRON || path.join(FULL, 'tools', 'electron', 'electron.exe');

const args = process.argv.slice(2);
const all = args.includes('--all');
const si = args.indexOf('--shot');
const shot = si >= 0 ? args[si + 1] : '';
const wp = all ? 'all' : (args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--shot') || '');
if (!all && !/^WP-\d{2}$/i.test(wp)) {
  console.error('usage: node Dashboard/test/run.js <WP-id> | --all [--shot <file>]');
  process.exit(2);
}

// ---------------------------------------------------------------- unit tests
const testDir = __dirname;
const files = all
  ? fs.readdirSync(testDir).filter(f => /^wp-\d{2}[a-z]?\.test\.js$/.test(f)).sort().map(f => path.join(testDir, f))
  : [path.join(testDir, wp.toLowerCase() + '.test.js')].filter(f => fs.existsSync(f));
const tests = { pass: 0, fail: 0 };
if (!files.length) tests.fail = 1;                                 // a WP without a test file is not green
else {
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...files], { cwd: REPO, encoding: 'utf8', windowsHide: true, timeout: 300e3 });
  const out = (r.stdout || '') + (r.stderr || '');
  tests.pass = (out.match(/^# pass (\d+)/m) || [])[1] | 0;
  tests.fail = (out.match(/^# fail (\d+)/m) || [])[1] | 0;
  if (r.status !== 0 && !tests.fail) tests.fail = 1;
  if (tests.fail) process.stderr.write(out);
}

// ---------------------------------------------------------------- shell selftest
const selftest = { ok: true, errors: [] };
const probe = !all && fs.existsSync(path.join(DASH, 'shell', 'selftest', wp.toLowerCase() + '.js'));
if (!fs.existsSync(ELECTRON)) { selftest.ok = false; selftest.errors.push('Electron not found: ' + ELECTRON); }
else {
  fs.mkdirSync(path.join(os.tmpdir(), 'VRG'), { recursive: true });
  const eargs = [path.join(DASH, 'shell'), '--selftest', ...(shot ? ['--shot', shot] : ['--no-shot']), ...(probe ? ['--probe', wp.toLowerCase()] : [])];
  const r = spawnSync(ELECTRON, eargs, { cwd: REPO, encoding: 'utf8', windowsHide: true, timeout: 180e3 });
  const line = ((r.stdout || '').split(/\r?\n/).filter(l => l.startsWith('{')).pop()) || '';
  let j = null; try { j = JSON.parse(line); } catch (e) {}
  if (!j) { selftest.ok = false; selftest.errors.push('no selftest result (exit ' + r.status + ')' + (r.stderr ? ': ' + r.stderr.split('\n')[0] : '')); }
  else {
    selftest.errors.push(...(j.errors || []));
    if (!j.ok || r.status !== 0) selftest.ok = false;
    if (!(j.ids >= 30)) { selftest.ok = false; selftest.errors.push('ids ' + j.ids + ' < 30'); }
    selftest.ids = j.ids;
    if (j.probe) selftest.probe = j.probe;                                // the WP probe's own result, so the verifier can see what ran
  }
}

const ok = tests.fail === 0 && tests.pass > 0 && selftest.ok;
console.log(JSON.stringify({ ok, wp, tests, selftest }));
process.exit(ok ? 0 : 1);
