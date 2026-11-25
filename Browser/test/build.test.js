// build.test.js — the committed page is what the sources build, the UI Kit region has not drifted, and the baked data is sane.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const { spawnSync } = require('child_process');
const B = require('../build.js');

const REPO = path.resolve(__dirname, '..', '..');

test('build: dist/vrg-bongeszo.html is what the sources build (run node Browser/build.js)', () => {
  assert.ok(fs.existsSync(B.OUT), 'dist exists (VRG Mobile fetches it from main)');
  assert.equal(fs.readFileSync(B.OUT, 'utf8'), B.build(), 'dist is stale');
});
test('build: the UI Kit region matches the kit (inline.js --check-app)', () => {
  const r = spawnSync(process.execPath, [path.join('shared', 'vrg-ui-kit', 'inline.js'), '--check-app', path.join('Browser', 'src', 'index.html')], { cwd: REPO, encoding: 'utf8' });
  assert.equal(r.status, 0, (r.stdout || '') + (r.stderr || ''));
});
test('build: one self-contained file — no external script, style or font', () => {
  const html = fs.readFileSync(B.OUT, 'utf8');
  assert.doesNotMatch(html, /<script[^>]+src=/i);
  assert.doesNotMatch(html, /<link[^>]+rel=["']?stylesheet/i);
  assert.doesNotMatch(html, /url\(["']?https?:/, 'no remote CSS resource');
  const own = html.slice(html.indexOf('/* ---- src/core/engine.js'));          // the app's own scripts (the kit's are its own business)
  assert.ok(own.length > 10000);
  assert.doesNotMatch(own, /\binnerHTML\s*=|insertAdjacentHTML|document\.write/, 'text goes in through textContent');
  assert.doesNotMatch(own, /\beval\s*\(|new Function\s*\(/, 'no eval: the calculator parses');
});
test('build: engines — https, {q}, unique ids and bangs, known groups', () => {
  const d = B.data();
  const ids = new Set(), bangs = new Set();
  for (const e of d.engines) {
    assert.ok(!ids.has(e.id), 'id ' + e.id); ids.add(e.id);
    assert.match(e.url, /^https:\/\//, e.id);
    assert.ok(e.url.includes('{q}'), e.id + ' has {q}');
    assert.ok(d.groups[e.group], e.id + ' group ' + e.group);
    for (const b of e.bangs) { assert.match(b, /^[a-z0-9]{1,12}$/); assert.ok(!bangs.has(b), '!' + b); bangs.add(b); }
  }
  assert.ok(d.engines.filter(e => e.default).length === 1, 'one default engine');
  for (const id of ['google', 'ai', 'maps', 'youtube']) assert.ok(ids.has(id), 'the Desktop search.json engine ' + id + ' is in');
});
test('build: servers from START, the own server left out, levels from the catalog, quick links public', () => {
  const d = B.data();
  assert.ok(!d.servers.some(s => s.id === 'bongeszo'));
  assert.ok(d.servers.find(s => s.id === 'idojaras').level === 'user');
  assert.ok(d.servers.find(s => s.id === 'openmct').level === 'dev');
  const names = d.servers.map(s => s.name);
  assert.equal(new Set(names).size, names.length, 'no two tiles with the same name');
  for (const q of d.quicklinks) assert.match(q.url, /^https:\/\//);
});
test('registry: START W → B, the server :8812, the catalog unit, VRG Mobile', () => {
  const menu = JSON.parse(fs.readFileSync(path.join(REPO, 'launcher', 'vrg-menu.json'), 'utf8'));
  const srv = menu.servers.find(s => s.id === 'bongeszo');
  assert.equal(srv.port, 8812);
  assert.equal(menu.servers.filter(s => s.port === 8812).length, 1);
  const w = menu.start.projects.find(p => p.key === 'W').menu.items.find(i => i.key === 'B');
  assert.equal(w.path, '{repo}\\Browser\\dist\\vrg-bongeszo.html');
  const cat = JSON.parse(fs.readFileSync(path.join(REPO, 'launcher', 'vrg-catalog.json'), 'utf8'));
  const it = cat.items.find(i => i.id === 'browser');
  assert.deepEqual(it.launch, { act: 's:W/B', app: true });
  assert.equal(it.level, 'user');
  const apps = fs.readFileSync(path.join(REPO, 'Mobile', 'android', 'kit-core', 'src', 'main', 'kotlin', 'hu', 'vrg', 'mobile', 'core', 'DeskApps.kt'), 'utf8');
  assert.match(apps, /DeskApp\("browser", "VRG Böngésző", "Browser\/dist\/vrg-bongeszo\.html", listOf\("Browser\/dist\/", "shared\/"\)\)/);
});
