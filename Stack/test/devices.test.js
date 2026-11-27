// VRG Stack — D · Eszközök (lib/devices.js, S16). Run:  node --test test/devices.test.js
// Sketches from the repo's own tracked .ino files; firmware and boards from an INVENTED Board Console data folder
// (test/fixtures/boards: made-up MACs and builds); the string from code to a board; the stale and behind checks.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const cp = require('child_process');
const DV = require('../lib/devices');
const SG = require('../lib/signals');

const ROOT = path.join(__dirname, '..', '..');
const files = cp.execFileSync('git', ['-C', ROOT, 'ls-files'], { encoding: 'utf8' }).split('\n').filter(Boolean);
const r = DV.read({ repoFiles: files, dataDir: path.join(__dirname, 'fixtures', 'boards') });
const L = DV.layer(r), n = id => L.nodes.find(x => x.id === id);

test('sketches: the repo\'s own Arduino sketches, the main .ino named as its folder', () => {
  const by = Object.fromEntries(r.sketches.map(s => [s.name, s]));
  assert.equal(by.knobpad.dir, 'Firmware/knobpad');
  assert.equal(by.planner_cyd.main, 'Firmware/planner-cyd/source/planner_cyd/planner_cyd.ino');
  assert.equal(by.planner_cyd.files, 4, 'one sketch, its four .ino tabs');
  assert.ok(by.enc_test.example);
  assert.ok(!r.sketches.some(s => s.name === 'pages' || s.name === 'ui'), 'a tab is not a sketch');
});

test('layer: firmware built from its sketch, boards flashed with it, what each board is known to hold', () => {
  assert.equal(n('D:fw.knobpad').state, '2026-11-20', 'the latest version');
  assert.match(n('D:fw.knobpad').brief, /ESP32-S3 · 2 versions, latest 2026-11-20 · 303 KB · uses Q0A · from arduino-build/);
  assert.ok(L.edges.some(e => e.a === 'D:fw.knobpad' && e.b === 'D:sketch.knobpad' && e.rel === 'built-from'));
  assert.ok(!L.edges.some(e => e.a === 'D:fw.blink' && e.rel === 'built-from'), 'an uploaded .bin names no sketch');
  assert.equal(n('D:board.112233').title, 'ESP32-S3 · 112233 · knobpad', 'what it runs, so its pillar takes it in');
  assert.equal(n('D:board.ef0001').title, 'ESP32 · ef0001');
  assert.equal(n('D:board.112233').state, 'known'); assert.equal(n('D:board.ef0001').state, 'unknown');
  assert.deepEqual(L.edges.filter(e => e.rel === 'flashed'), [{ a: 'D:board.112233', b: 'D:fw.knobpad', rel: 'flashed', w: 2 }]);
  assert.ok(n('D:sketch.knobpad').text.includes('Firmware/knobpad'), 'the join links the sketch to its code');
  assert.ok(!JSON.stringify(L.nodes.map(x => x.title)).includes('AA:BB'), 'a title carries half a MAC, never the whole');
  assert.ok(L.nodes.every(x => x.layer === 'D') && new Set(L.nodes.map(x => x.id)).size === L.nodes.length);
});

test('stale: a firmware built before its sketch\'s newest commit; behind: a board on an older version', () => {
  const commit = { id: 'R:abc1234', layer: 'R', kind: 'commit', title: 'knobpad: new encoder map', extra: { date: '2026-11-25T12:00:00Z', files: ['Firmware/knobpad/knobpad.ino'] } };
  assert.deepEqual(DV.stale([...L.nodes, commit]).map(x => x.n.id), ['D:fw.knobpad']);
  assert.deepEqual(DV.stale([...L.nodes, { ...commit, extra: { ...commit.extra, date: '2026-11-19T00:00:00Z' } }]), [], 'a commit before the build is in it');
  assert.deepEqual(DV.behind(L.nodes).map(x => [x.n.id, x.has, x.latest]), [['D:board.112233', '2026-11-01', '2026-11-20']]);
  const J = SG.detect({ nodes: new Map([...L.nodes, commit].map(x => [x.id, x])) });
  const st = id => (J.nodes.find(x => x.id === id) || {}).state;
  assert.equal(st('J:fw-stale.knobpad'), 'amber'); assert.equal(st('J:board-behind.112233'), 'info'); assert.equal(st('J:board-unknown.ef0001'), 'info');
  assert.ok(J.edges.some(e => e.a === 'J:fw-stale.knobpad' && e.b === 'D:sketch.knobpad'));
});

test('no Board Console data on this PC: the sketches alone', () => {
  const x = DV.read({ repoFiles: files, dataDir: path.join(__dirname, 'fixtures', 'nincs') });
  assert.deepEqual([x.firmware.length, x.boards.length], [0, 0]); assert.ok(x.sketches.length >= 3);
});
