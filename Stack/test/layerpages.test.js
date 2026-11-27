// VRG Stack — the six layer pages' data (lib/layerpages.js). Run:  node --test test/layerpages.test.js
// Each builder on a small written graph: what its page needs, in the order its page shows it.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const LP = require('../lib/layerpages');

const G = (nodes, edges = [], entities = []) => ({ build: { no: 1 }, schema: 2, nodes, edges, entities });

test('K: asks per pillar per week, threads with their asks, the asks no commit followed', () => {
  assert.equal(LP.isoWeek('2026-11-27'), '2026-W48'); assert.equal(LP.isoWeek('2026-01-01'), '2026-W01');
  const D = LP.build.K(G([
    { id: 'K:ask.a.1', layer: 'K', kind: 'ask', t: '2026-11-20', state: 'committed', title: 'build S12', lane: 'cluster c1' },
    { id: 'K:ask.a.2', layer: 'K', kind: 'ask', t: '2026-11-27', state: 'no commit', title: 'build S13', lane: 'cluster c1' },
    { id: 'K:cluster.c1', layer: 'K', kind: 'cluster', state: 'landed', title: 'build s# ×2', k: { sessions: 2, first: '2026-11-20', last: '2026-11-27' }, t: '2026-11-27' },
    { id: 'C:Stack', layer: 'C', kind: 'module', title: 'Stack', ent: ['stack'] }],
    [{ a: 'K:ask.a.1', b: 'C:Stack', rel: 'led-to' }, { a: 'K:ask.a.2', b: 'C:Stack', rel: 'led-to' }, { a: 'K:cluster.c1', b: 'K:ask.a.1', rel: 'contains' }, { a: 'K:cluster.c1', b: 'K:ask.a.2', rel: 'contains' }],
    [{ id: 'stack', name: 'VRG Stack' }]));
  assert.deepEqual(D.heat[0].slice(0, 3), ['stack', 'VRG Stack', 2]);
  assert.equal(D.heat[0][3].reduce((a, b) => a + b, 0), 2, 'both weeks are on the axis');
  assert.deepEqual(D.clusters[0][6], ['K:ask.a.1', 'K:ask.a.2']);
  assert.deepEqual(D.nolanded, ['K:ask.a.2']);
  assert.equal(D.build.no, 1);
});

test('O: what CLAUDE.md asks of each licence; a referenced GPL is amber, an MCP server needs no licence', () => {
  const D = LP.build.O(G([
    { id: 'O:vendor.a', layer: 'O', kind: 'vendored', title: 'A · Planner', dep: { license: 'MIT', source: 'git', refType: 'branch', ref: 'main', usedBy: ['x.js'] } },
    { id: 'O:vendor.b', layer: 'O', kind: 'reference', title: 'B', dep: { license: 'AGPL-3.0', source: 'git', refType: 'branch', ref: 'master' } },
    { id: 'O:vendor.c', layer: 'O', kind: 'vendored', title: 'C', dep: { license: 'MPL-2.0 OR Apache-2.0', source: 'git', refType: 'tag', ref: 'v1' } },
    { id: 'O:mcp.s', layer: 'O', kind: 'mcp server', title: 's', dep: {} }]));
  const d = id => D.deps.find(x => x.id === id);
  assert.equal(d('O:vendor.a').tone, 'ok'); assert.match(d('O:vendor.a').rule, /copyright notice/); assert.equal(d('O:vendor.a').pinOk, false, 'a fetched source on a branch');
  assert.equal(d('O:vendor.b').tone, 'amber'); assert.match(d('O:vendor.b').rule, /never copy it in/);
  assert.equal(d('O:vendor.c').tone, 'ok'); assert.match(d('O:vendor.c').rule, /take the permissive one/); assert.equal(d('O:vendor.c').pinOk, true);
  assert.equal(d('O:mcp.s').tone, 'mute');
});

test('P: every suite with its recorded runs, failing first; D: a board behind its firmware; M and V carry their details', () => {
  const P = LP.build.P(G([
    { id: 'P:suite.a', layer: 'P', kind: 'test suite', title: 'a/test', state: 'pass', probe: { runner: 'node', keys: ['X'] } },
    { id: 'P:suite.b', layer: 'P', kind: 'test suite', title: 'b/test', state: 'fail', probe: { runner: 'npm' } }]),
    [{ suite: 'a/test', at: '2026-11-26T10:00:00Z', ok: true, pass: 3 }, { suite: 'a/test', at: '2026-11-25T10:00:00Z', ok: false, pass: 2, fail: 1 }, { suite: 'b/test', at: '2026-11-27T10:00:00Z', skipped: 'no pwsh' }]);
  assert.deepEqual(P.suites.map(s => s.path), ['b/test', 'a/test'], 'failing first');
  assert.deepEqual(P.suites[1].runs.map(r => r[1]), ['fail', 'pass'], 'oldest to newest');
  assert.equal(P.suites[0].runs[0][1], 'skip');
  const D = LP.build.D(G([
    { id: 'D:sketch.k', layer: 'D', kind: 'sketch', title: 'k', dev: { path: 'Firmware/k' } },
    { id: 'D:fw.k', layer: 'D', kind: 'firmware', title: 'k', state: 'v2', dev: { latest: 'v2', versions: ['v2', 'v1'] } },
    { id: 'D:board.aa', layer: 'D', kind: 'board', title: 'ESP32 · aa · k', dev: { known: true, lastFlash: { id: 'k', version: 'v1' } } }],
    [{ a: 'D:fw.k', b: 'D:sketch.k', rel: 'built-from' }, { a: 'D:board.aa', b: 'D:fw.k', rel: 'flashed', w: 2 }]));
  assert.equal(D.firmware[0].sketch, 'D:sketch.k'); assert.deepEqual(D.firmware[0].boards, [['D:board.aa', 2]]);
  assert.deepEqual(D.lonely, [], 'the sketch has its firmware');
  const M = LP.build.M(G([{ id: 'M:job.X1', layer: 'M', kind: 'job', title: 'X1 · befejezett · Planner', job: { status: 'befejezett', tools: ['planner'], from: '2025-01-01', to: '2025-02-01', total: 1000 } }]));
  assert.deepEqual([M.jobs[0].code, M.range[0], M.range[1]], ['X1', '2025-01-01', '2025-02-01']);
  const V = LP.build.V(G([{ id: 'V:look.A/a.html', layer: 'V', kind: 'look', title: 'A/a.html', state: 'drift', look: { melyviz: 'drift' } }, { id: 'V:kit.button', layer: 'V', kind: 'component', title: 'button', brief: 'Shell' }],
    [{ a: 'V:look.A/a.html', b: 'V:kit.button', rel: 'wears' }]));
  assert.equal(V.looks[0].app, 'A'); assert.equal(V.components[0].wornBy, 1); assert.deepEqual(V.counts.states, { drift: 1 });
});

test('N: every door with where it leads and whether that is there; the START tree; a catalog item must land', () => {
  const ROOT = require('path').join(__dirname, '..', '..');
  const D = LP.build.N(G([
    { id: 'N:start.R', layer: 'N', kind: 'start menu', title: 'Rétegverem', path: '' },
    { id: 'N:start.R/7', layer: 'N', kind: 'start page', title: 'Rétegek', path: 'Stack/viewer.html' },
    { id: 'N:start.R/9', layer: 'N', kind: 'start page', title: 'Gone', path: 'Stack/no-such-page.html' },
    { id: 'N:start.A/1', layer: 'N', kind: 'program', title: 'VLC', path: '{full}/programs/vlc.exe' },
    { id: 'N:cat.viewer', layer: 'N', kind: 'catalog', title: 'Rétegek' },
    { id: 'N:cat.lost', layer: 'N', kind: 'catalog', title: 'Lost' },
    { id: 'N:mob.stack', layer: 'N', kind: 'mobile feature', title: 'Stack', state: 'live' },
    { id: 'N:mob.someday', layer: 'N', kind: 'mobile feature', title: 'Someday', state: 'planned' }],
    [{ a: 'N:start.R', b: 'N:start.R/7', rel: 'contains' }, { a: 'N:start.R', b: 'N:start.R/9', rel: 'contains' },
     { a: 'N:cat.viewer', b: 'N:start.R/7', rel: 'launches' }, { a: 'N:cat.lost', b: 'N:start.R/X', rel: 'launches' }]), [], { repo: ROOT });
  const st = id => D.doors.find(d => d.id === id).state;
  assert.equal(st('N:start.R/7'), 'ok'); assert.equal(st('N:start.R/9'), 'missing');
  assert.equal(st('N:start.A/1'), 'outside', 'an H: program is check-start\'s question');
  assert.equal(st('N:cat.viewer'), 'ok'); assert.equal(st('N:cat.lost'), 'missing', 'it launches a key that is not there');
  assert.equal(st('N:mob.stack'), 'ok', 'Mobile/android/feature-stack'); assert.equal(st('N:mob.someday'), 'planned');
  assert.deepEqual(D.roots, ['N:start.R'], 'a submenu holds its keys');
  assert.equal(D.counts.missing, 2);
});

