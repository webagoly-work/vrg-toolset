// VRG Stack — P · Próbák (lib/probe.js, S12). Run:  node --test test/probe.test.js
// Discovery on the repo's own tracked files, START registry and CI workflows; the layer's states; the recorder.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const P = require('../lib/probe');
const S = require('../lib/strings');

const ROOT = path.join(__dirname, '..', '..');
const files = cp.execFileSync('git', ['-C', ROOT, 'ls-files'], { encoding: 'utf8' }).split('\n').filter(Boolean);
const has = new Set(files);
const menu = JSON.parse(fs.readFileSync(path.join(ROOT, 'launcher', 'vrg-menu.json'), 'utf8'));
const pkg = d => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, d, 'package.json'), 'utf8')); } catch { return null; } };
const workflows = {}; for (const f of files.filter(f => /^\.github\/workflows\/[^/]+\.ya?ml$/.test(f))) workflows[f] = fs.readFileSync(path.join(ROOT, f), 'utf8');
const suites = P.suites(files, { menu, pkg, workflows });
const at = d => suites.find(s => s.dir === d);
const read = f => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

test('discovery: test folders, Gradle modules and checks are suites; fixtures are not', () => {
  assert.ok(suites.length >= 25, 'suites: ' + suites.length);
  assert.ok(suites.every(s => s.files.every(f => !/\/fixtures\//.test(f))), 'no fixture is a test file');
  assert.ok(at('Stack/test').files.includes('Stack/test/entry.test.js'));
  assert.deepEqual(at('Stack/test').cmds[0].cmd.slice(0, 2), ['node', '--test']);
  assert.equal(at('Mobile/android/kit-core').runner, 'gradle');
  assert.ok(at('tools/check-start.js').single);
  assert.equal(new Set(suites.map(s => s.dir)).size, suites.length);
});

test('how each runs: START steps (with their keys), package.json, CI lines with the job working-directory', () => {
  const planner = at('Planner/projects/varler-planner/tests');
  assert.deepEqual(planner.keys, ['P/T']); assert.deepEqual(planner.cmds[0], { cmd: ['npm', 'test'], cwd: 'Planner/projects/varler-planner', by: 'start P/T' });
  const L = at('launcher/test');
  assert.deepEqual(L.keys, ['X']); assert.equal(L.runner, 'powershell');
  assert.ok(L.cmds.length >= 3 && L.cmds.every(c => c.cmd[0] === 'powershell'), 'every selftest the X step runs');
  assert.deepEqual(at('tools/check-start.js').keys, ['X']);
  const kit = at('Mobile/android/kit-core');
  assert.deepEqual(kit.cmds[0].cmd, ['gradlew', ':kit-core:test']); assert.equal(kit.cmds[0].cwd, 'Mobile/android', 'defaults: run: working-directory');
  assert.ok(kit.ci.includes('.github/workflows/mobile-android.yml'));
  const mob = at('Mobile/tests');
  assert.ok(mob.cmds.some(c => c.cmd.join(' ') === 'node Mobile/tests/relay-pair.js' && c.cwd === ''), 'a step working-directory "." is the repo root');
  const sk = at('Sketcher/test');
  assert.equal(sk.cmds.length, 1, 'the same command from START and CI once'); assert.deepEqual(sk.keys, ['P/H']);
});

test('layer: states from the records, runs edges from START, file nodes name the code they require', () => {
  const recs = [
    { suite: 'Stack/test', at: '2026-11-20T10:00:00Z', head: 'aaa', ok: false, pass: 1, fail: 1 },
    { suite: 'Stack/test', at: '2026-11-26T10:00:00Z', head: 'bbb', ok: true, pass: 90, fail: 0 },
    { suite: 'Map/test', at: '2026-11-26T10:00:00Z', head: 'old', ok: true, pass: 4, fail: 0 },
    { suite: 'Hub/test', at: '2026-11-26T10:00:00Z', head: 'bbb', ok: false, pass: 8, fail: 2 },
    { suite: 'launcher/test', at: '2026-11-26T10:00:00Z', head: 'bbb', skipped: 'no PowerShell on this PC' },
  ];
  const L = P.layer({ suites, results: recs, stale: (s, r) => r.head === 'old', read, has: f => has.has(f) });
  const n = id => L.nodes.find(x => x.id === id);
  assert.equal(n('P:suite.Stack/test').state, 'pass', 'the newest record wins'); assert.equal(n('P:suite.Stack/test').t, '2026-11-26');
  assert.equal(n('P:suite.Map/test').state, 'stale');
  assert.equal(n('P:suite.Hub/test').state, 'fail');
  assert.equal(n('P:suite.launcher/test').state, 'skipped');
  assert.equal(n('P:suite.Weather/test').state, 'unrun');
  assert.ok(L.nodes.filter(x => x.state === 'no runner').length >= 1);
  assert.equal(n('P:suite.tools/check-start.js').kind, 'check');
  assert.ok(L.edges.some(e => e.a === 'N:start.P/T' && e.b === 'P:suite.Planner/projects/varler-planner/tests' && e.rel === 'runs'));
  assert.ok(L.edges.some(e => e.a === 'P:suite.Stack/test' && e.b === 'P:Stack/test/entry.test.js' && e.rel === 'contains'));
  assert.deepEqual(n('P:Stack/test/entry.test.js').extra.requires, ['Stack/lib/entry.js', 'Stack/lib/strings.js'], 'resolved to the real files');
  assert.ok(L.nodes.every(x => x.layer === 'P') && new Set(L.nodes.map(x => x.id)).size === L.nodes.length);
});

test('recorder: TAP and plain counts; a missing runner is a skip; several steps add up', () => {
  assert.deepEqual(P.counts('# tests 5\n# pass 4\n# fail 1\n'), { pass: 4, fail: 1 });
  assert.deepEqual(P.counts('done: 12 passed, 0 failed'), { pass: 12, fail: 0 });
  const S1 = { dir: 'x/test', cmds: [{ cmd: ['node', 'a.js'], cwd: '' }, { cmd: ['powershell', '-File', 'b.ps1'], cwd: '' }, { cmd: ['node', 'c.js'], cwd: '' }] };
  const outs = { 'a.js': { code: 0, out: '# pass 3\n# fail 0', ms: 5 }, 'c.js': { code: 1, out: '2 passed 1 failed', ms: 7 } };
  const exec = cmd => cmd[0] === 'powershell' ? { skipped: 'no PowerShell on this PC' } : outs[cmd[1]];
  const r = P.run(S1, { repo: '/r', exec, now: () => '2026-11-26T00:00:00Z', head: 'h1' });
  assert.equal(r.ok, false); assert.equal(r.code, 1); assert.equal(r.pass, 5); assert.equal(r.fail, 1); assert.equal(r.ms, 12);
  assert.match(r.partial, /PowerShell/); assert.equal(r.head, 'h1');
  assert.equal(P.run({ dir: 'y', cmds: [] }, { repo: '/r', exec }).skipped, 'no runner');
  assert.equal(P.run({ dir: 'z', cmds: [S1.cmds[1]] }, { repo: '/r', exec }).skipped, 'no PowerShell on this PC');
});

test('unverified: code no test reaches is listed; a folder a test reaches, or one holding a tested folder, is not', () => {
  const nodes = [{ id: 'E:a', layer: 'E', kind: 'pillar', title: 'A', own: [] }, { id: 'C:A/src', layer: 'C', title: 'A', own: [] },
    { id: 'E:b', layer: 'E', kind: 'pillar', title: 'B', own: [] }, { id: 'C:B/app', layer: 'C', title: 'B', own: [] }, { id: 'P:B/app/tests/x.test.js', layer: 'P', title: 'x', own: [] },
    { id: 'C:B/app/src', layer: 'C', title: 'B src', own: [] }];
  const edges = [['C:A/src', 'E:a', 'pillar', 2], ['C:B/app', 'E:b', 'pillar', 2], ['P:B/app/tests/x.test.js', 'C:B/app/src', 'ref:p', 1]];
  const u = P.unverified({ nodes, edges, entities: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] }, S, {});
  assert.deepEqual(u.map(x => x.pillar), ['a'], 'B/app holds the tested B/app/src');
});
