// WP-44 (Desktop unify U8): "VRG Desktop.exe" — Dashboard/tools/package.js (copy + rename + bootstrap) against a fake Electron folder in
// %TEMP%, the bootstrap's repo choice, the START .cmd. The real exe is checked by running it with --selftest (see LOG.md U8).
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path'), fs = require('fs'), os = require('os');
const P = require('../tools/package.js');
const B = require('../tools/exe-bootstrap.js');

const REPO = path.resolve(__dirname, '..', '..');
function fakeElectron() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'VRG-pkg-el-'));
  const w = (rel, s) => { fs.mkdirSync(path.dirname(path.join(d, rel)), { recursive: true }); fs.writeFileSync(path.join(d, rel), s); };
  w('electron.exe', 'MZ'); w('version', '44.7.1'); w('resources/default_app.asar', 'demo'); w('locales/hu.pak', 'x'); w('ffmpeg.dll', 'x');
  return d;
}
const rm = d => fs.rmSync(d, { recursive: true, force: true });

test('plan: electron.exe becomes "VRG Desktop.exe", default_app.asar is left out, the rest is copied as is', () => {
  const p = P.plan('E', ['electron.exe', 'ffmpeg.dll', path.join('resources', 'default_app.asar'), path.join('locales', 'hu.pak')]);
  assert.deepEqual(p.map(f => f.to), ['VRG Desktop.exe', 'ffmpeg.dll', path.join('locales', 'hu.pak')]);
});

test('build: a fresh out folder gets the exe, the bootstrap app, the config; check passes; a rebuild overwrites in place', () => {
  const el = fakeElectron(), out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'VRG-pkg-out-')), 'vrg-desktop');
  try {
    const r = P.build({ electronDir: el, outDir: out, repo: REPO });
    assert.equal(r.ok, true, JSON.stringify(r.errors));
    assert.ok(fs.existsSync(path.join(out, 'VRG Desktop.exe')));
    assert.ok(!fs.existsSync(path.join(out, 'electron.exe')));
    assert.ok(!fs.existsSync(path.join(out, 'resources', 'default_app.asar')));
    assert.ok(fs.existsSync(path.join(out, 'locales', 'hu.pak')));
    const pkg = JSON.parse(fs.readFileSync(path.join(out, 'resources', 'app', 'package.json'), 'utf8'));
    assert.equal(pkg.name, 'vrg-dashboard-shell'); assert.equal(pkg.productName, undefined); assert.equal(pkg.main, 'main.js');
    assert.equal(fs.readFileSync(path.join(out, 'resources', 'app', 'main.js'), 'utf8'), fs.readFileSync(path.join(__dirname, '..', 'tools', 'exe-bootstrap.js'), 'utf8'));
    const cfg = JSON.parse(fs.readFileSync(path.join(out, 'vrg-desktop.json'), 'utf8'));
    assert.equal(cfg.repo, REPO); assert.equal(cfg.electron, '44.7.1');
    assert.deepEqual(P.check(out), { ok: true, errors: [] });
    assert.equal(P.build({ electronDir: el, outDir: out, repo: REPO }).ok, true, 'an earlier build is overwritten');
  } finally { rm(el); rm(path.dirname(out)); }
});

test('build refuses: an out folder that is not an earlier build, no electron.exe, no shell in the repo, out inside electron', () => {
  const el = fakeElectron(), other = fs.mkdtempSync(path.join(os.tmpdir(), 'VRG-pkg-other-'));
  fs.writeFileSync(path.join(other, 'precious.txt'), 'keep me');
  try {
    let r = P.build({ electronDir: el, outDir: other, repo: REPO });
    assert.equal(r.ok, false); assert.match(r.errors[0], /not an earlier VRG Desktop build/);
    assert.equal(fs.readFileSync(path.join(other, 'precious.txt'), 'utf8'), 'keep me');
    assert.equal(fs.readdirSync(other).length, 1, 'nothing written');
    r = P.build({ electronDir: other, outDir: path.join(os.tmpdir(), 'VRG-pkg-none'), repo: REPO });
    assert.ok(r.errors.some(e => /no electron\.exe/.test(e)));
    r = P.build({ electronDir: el, outDir: path.join(os.tmpdir(), 'VRG-pkg-none'), repo: other });
    assert.ok(r.errors.some(e => /no Dashboard\/shell\/main\.js/.test(e)));
    r = P.build({ electronDir: el, outDir: path.join(el, 'sub'), repo: REPO });
    assert.ok(r.errors.some(e => /inside the electron folder/.test(e)));
    assert.ok(!fs.existsSync(path.join(os.tmpdir(), 'VRG-pkg-none')));
  } finally { rm(el); rm(other); }
});

test('check: a build missing its parts, or with electron.exe / default_app.asar left, fails', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'VRG-pkg-chk-'));
  try {
    fs.writeFileSync(path.join(d, 'electron.exe'), 'MZ');
    const r = P.check(d);
    assert.equal(r.ok, false);
    for (const re of [/missing VRG Desktop\.exe/, /electron\.exe is still there/, /missing .*main\.js/, /missing vrg-desktop\.json/]) assert.ok(r.errors.some(e => re.test(e)), re);
  } finally { rm(d); }
});

test('bootstrap: --repo wins over vrg-desktop.json; relative, missing or shell-less repos are refused with a reason', () => {
  const exists = f => f === path.join(path.resolve('H:/a'), 'Dashboard', 'shell', 'main.js') || f === path.join(path.resolve('H:/b'), 'Dashboard', 'shell', 'main.js');
  const cfg = JSON.stringify({ repo: 'H:/a' });
  assert.equal(B.pickRepo(['exe'], cfg, exists).repo, path.resolve('H:/a'));
  assert.equal(B.pickRepo(['exe', '--repo', 'H:/b', '--selftest'], cfg, exists).repo, path.resolve('H:/b'));
  assert.match(B.pickRepo(['exe', '--repo', 'rel/x'], cfg, exists).err, /not an absolute/);
  assert.match(B.pickRepo(['exe', '--repo', 'H:/c'], cfg, exists).err, /not found/);
  assert.match(B.pickRepo(['exe'], '', exists).err, /missing or broken/);
  assert.match(B.pickRepo(['exe'], '{"repo":5}', exists).err, /not an absolute/);
  assert.equal(B.pickRepo(['exe', '--repo', '--selftest'], cfg, exists).repo, path.resolve('H:/a'), 'a flag after --repo is not a path');
});

test('the START .cmd prefers the exe, passes its own checkout, falls back to the portable electron; CRLF, ASCII', () => {
  const b = fs.readFileSync(path.join(__dirname, '..', 'VRG Irányítópult.cmd'));
  const s = b.toString('latin1');
  assert.ok(!/[^\r]\n/.test(s), 'CRLF only');
  assert.ok(!/[^\x00-\x7f]/.test(s), 'ASCII only');
  assert.ok(s.indexOf('VRG Desktop.exe') > 0 && s.indexOf('VRG Desktop.exe') < s.indexOf('electron.exe'));
  assert.match(s, /--repo "%REPO%"/);
  assert.match(s, /start "" "%EL%" "%~dp0shell"/);
});
