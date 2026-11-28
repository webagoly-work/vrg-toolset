// VRG Stack — V · Látvány (lib/look.js, S17). Run:  node --test test/look.test.js
// On the repo itself: the kit, Mélyvíz and the pages that wear them, in step with tools/melyviz-sync.js --check.
// On a throwaway mini-repo: a drifted copy, an inlined kit older than the manifest, a sync target that is gone.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const V = require('../lib/look');
const SG = require('../lib/signals');

const ROOT = path.join(__dirname, '..', '..');
const files = cp.execFileSync('git', ['-C', ROOT, 'ls-files'], { encoding: 'utf8' }).split('\n').filter(Boolean);
const r = V.read({ repo: ROOT, files });

test('the repo: the kit with its components and themes, Mélyvíz with the sync tool\'s own targets, the logos', () => {
  assert.equal(r.kit.version, require('../../shared/vrg-ui-kit/manifest.json').version);
  assert.equal(r.kit.components.length, require('../../shared/vrg-ui-kit/manifest.json').components.length);
  assert.ok(r.kit.themes.some(t => t.name === 'melyviz'));
  assert.ok(r.melyviz.targets.includes('Calculator/led_arkalkulator.html') && r.melyviz.targets.length >= 10);
  assert.ok(r.logos.some(l => l.id === 'caps'));
  const L = V.layer(r), n = id => L.nodes.find(x => x.id === id);
  assert.equal(n('V:look.Dashboard/vrg-dashboard.html').state, 'linked', 'a <link> to melyviz.css is always current');
  assert.equal(n('V:look.Calculator/led_arkalkulator.html').extra.melyviz, 'current');
  assert.ok(L.edges.some(e => e.a === 'V:look.Hub/src/index.html' && e.b === 'V:kit.palette' && e.rel === 'wears'), 'the Kapu carries the kit\'s palette');
  assert.ok(L.edges.some(e => e.a === 'V:system.vrg-ui-kit' && e.b === 'V:kit.badge' && e.rel === 'contains'));
  assert.ok(!L.nodes.some(x => /^V:look\.(Vendor|Archive\/files)\//.test(x.id)), 'vendored and archived pages wear nothing of ours');
});

test('the repo agrees with tools/melyviz-sync.js --check', () => {
  let ok = true; try { cp.execFileSync(process.execPath, [path.join(ROOT, 'tools', 'melyviz-sync.js'), '--check'], { cwd: ROOT, stdio: 'ignore' }); } catch { ok = false; }
  const drift = V.drifted(V.layer(r).nodes).filter(x => x.extra.melyviz && x.extra.melyviz !== 'current' && x.extra.melyviz !== 'linked');
  assert.equal(drift.length === 0, ok, 'both say the same: ' + drift.map(x => x.id).join(', '));
});

test('a mini-repo: a drifted copy, an older kit, a gone target are signals; a current copy is not', () => {
  const T = fs.mkdtempSync(path.join(os.tmpdir(), 'vrg-look-'));
  const w = (rel, s) => { fs.mkdirSync(path.dirname(path.join(T, rel)), { recursive: true }); fs.writeFileSync(path.join(T, rel), s); };
  w('shared/melyviz.css', ':root { --mv-bg: #0a141c; }\n');
  w('tools/melyviz-sync.js', "const TARGETS = [\n  'A/a.html',\n  'B/b.html',\n  'Gone/g.html',\n];\n");
  w('shared/vrg-ui-kit/manifest.json', JSON.stringify({ version: '1.2.0', families: { 1: 'Shell' }, tokens: ['tokens/theme-dark.css'], components: [{ name: 'button', files: ['components/button.css'], families: [1] }] }));
  w('A/a.html', '<style>/* melyviz:begin */\n:root { --mv-bg: #0a141c; }\n/* melyviz:end */</style>');
  w('B/b.html', '<style>/* melyviz:begin */\n:root { --mv-bg: #ff0000; }\n/* melyviz:end */</style>');
  w('C/c.html', '<!-- vk:begin button --><style>/* vrg-ui-kit 1.1.0 — button */</style><!-- vk:end -->');
  const L = V.layer(V.read({ repo: T, files: ['A/a.html', 'B/b.html', 'C/c.html'] })), st = id => (L.nodes.find(x => x.id === id) || {}).state;
  assert.equal(st('V:look.A/a.html'), 'current'); assert.equal(st('V:look.B/b.html'), 'drift');
  assert.equal(st('V:look.C/c.html'), 'behind'); assert.equal(st('V:look.Gone/g.html'), 'missing');
  assert.ok(L.edges.some(e => e.a === 'V:look.C/c.html' && e.b === 'V:kit.button' && e.rel === 'wears'));
  const J = SG.detect({ nodes: new Map(L.nodes.map(x => [x.id, x])) });
  const sig = J.nodes.map(x => x.id).sort();
  assert.deepEqual(sig, ['J:kit-behind.C/c.html', 'J:look-drift.B/b.html', 'J:look-drift.Gone/g.html']);
  assert.match(J.nodes.find(x => x.id === 'J:kit-behind.C/c.html').brief, /inline\.js --sync-app C\/c\.html/);
  fs.rmSync(T, { recursive: true, force: true });
});

test('the Visual Base outside the repo: its top folders, when it is there', () => {
  const T = fs.mkdtempSync(path.join(os.tmpdir(), 'vrg-vb-'));
  fs.mkdirSync(path.join(T, '01_Hardware', 'x'), { recursive: true }); fs.writeFileSync(path.join(T, '01_Hardware', 'x', 'a.svg'), '<svg/>');
  const L = V.layer(V.read({ repo: ROOT, files: [], visualBase: T }));
  assert.equal(L.nodes.find(x => x.id === 'V:base.01_Hardware').brief, '1 file (VRG_Visual_Base, outside the repo)');
  assert.equal(V.read({ repo: ROOT, files: [], visualBase: path.join(T, 'nincs') }).base.length, 0);
  fs.rmSync(T, { recursive: true, force: true });
});
