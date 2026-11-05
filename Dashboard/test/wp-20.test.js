// WP-20: internal search — argv builders, query/layer validation, parsing, no-index, hit mapping. No process is started: execFile is a fake.
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const path = require('path');
const is = require('../shell/lib/innersearch.js');

// the shape of  stack.js q --json  (one node, as the stack prints it: fields of the node plus  vertical)
const STACK_SAMPLE = '[\n {\n  "id": "E:kapu",\n  "layer": "E",\n  "kind": "pillar",\n  "title": "VRG Kapu",\n  "brief": "Same thing across layers: F 2, I 2, Q 1.",\n  "t": "",\n  "state": "42 nodes",\n  "ent": [],\n  "vertical": [\n   { "id": "F:f8", "rel": "pillar", "title": "Kapu feature" }\n  ]\n },\n { "id": "F:f8", "layer": "F", "kind": "feature", "title": "Kapu feature", "brief": "", "state": "", "t": "2026-01-01", "vertical": [] }\n]';
const CODE_SAMPLE = '[{"path":"Demo/src/a.js","line":12,"title":"function demo","snippet":"x [demo] y"},{"path":"Demo/src/a.js","line":40,"title":"","snippet":""},{"bad":1}]';

const FULL = path.join('C:', 'demo-full'), REPO = path.join('C:', 'demo-repo');

function fake(handler) {
  const calls = [];
  const execFile = (file, args, opts, cb) => { calls.push({ file, args, opts }); const r = handler(file, args, opts) || {}; setImmediate(() => cb(r.err || null, r.stdout || '', r.stderr || '')); };
  return { execFile, calls };
}

test('query is cleaned: control chars out, leading dashes out, cut at 300', () => {
  assert.equal(is.cleanQuery('a\u0000b\nc\u007fd'), 'a b c d');
  assert.equal(is.cleanQuery('--json'), 'json');
  assert.equal(is.cleanQuery('-n 5'), 'n 5');
  assert.equal(is.cleanQuery('x'.repeat(400)).length, 300);
  assert.equal(is.cleanQuery(null), '');
});

test('layers string is validated against [FIQLARCGE]+', () => {
  assert.equal(is.cleanLayers(''), '');
  assert.equal(is.cleanLayers(undefined), '');
  assert.equal(is.cleanLayers('FIQ'), 'F,I,Q');
  assert.equal(is.cleanLayers('F,L,A'), 'F,L,A');
  assert.equal(is.cleanLayers('FFL'), 'F,L');
  assert.equal(is.cleanLayers('FX'), null);
  assert.equal(is.cleanLayers('f'), null);
  assert.equal(is.cleanLayers('F;rm'), null);
});

test('argv builders keep the query as one item', () => {
  const q = '"&|>x y';
  const a = is.stackArgs('S.js', q, { layers: 'F,L', budget: 500, n: 5 });
  assert.deepEqual(a, ['S.js', 'q', q, '-n', '5', '--budget', '500', '--json', '--layer', 'F,L']);
  assert.deepEqual(is.stackArgs('S.js', 'k', {}), ['S.js', 'q', 'k', '-n', '8', '--budget', '900', '--json']);
  assert.deepEqual(is.codeArgs('C.js', q, { n: 3 }), ['C.js', 'q', q, '-n', '3', '--json']);
});

test('stack(): execFile with an array, cwd = {full}\\notes\\stack, no shell, hostile query stays one item', async () => {
  const f = fake(() => ({ stdout: STACK_SAMPLE }));
  const s = is.createInnerSearch({ execFile: f.execFile, node: 'NODE', full: FULL, repo: REPO });
  const r = await s.stack('"&|>x', { layers: 'FIQ', budget: 700 });
  assert.equal(r.ok, true);
  assert.equal(f.calls.length, 1);
  const c = f.calls[0];
  assert.equal(c.file, 'NODE');
  assert.equal(c.args[0], path.join(FULL, 'notes', 'stack', 'stack.js'));
  assert.equal(c.args[2], '"&|>x');
  assert.deepEqual(c.args.slice(3), ['-n', '8', '--budget', '700', '--json', '--layer', 'F,I,Q']);
  assert.equal(c.opts.cwd, path.join(FULL, 'notes', 'stack'));
  assert.equal(c.opts.timeout, 15000);
  assert.ok(!c.opts.shell, 'no shell');
});

test('a 400-char query reaches the child as 300 chars; a bad layers string never starts a process', async () => {
  const f = fake(() => ({ stdout: '[]' }));
  const s = is.createInnerSearch({ execFile: f.execFile, node: 'NODE', full: FULL, repo: REPO });
  await s.stack('y'.repeat(400));
  assert.equal(f.calls[0].args[2].length, 300);
  const bad = await s.stack('k', { layers: 'Z' });
  assert.deepEqual([bad.ok, bad.err], [false, 'bad-request']);
  const empty = await s.inner({ q: '  ' });
  assert.equal(empty.err, 'bad-request');
  assert.equal(f.calls.length, 1);
});

test('parsing a stack.js q --json sample', () => {
  assert.ok(STACK_SAMPLE.length < 2048);
  const hits = is.parseStack(STACK_SAMPLE);
  assert.equal(hits.length, 2);
  assert.deepEqual(hits[0], { id: 'E:kapu', layer: 'E', kind: 'pillar', title: 'VRG Kapu', brief: 'Same thing across layers: F 2, I 2, Q 1.', state: '42 nodes', t: '', vertical: [{ id: 'F:f8', rel: 'pillar', title: 'Kapu feature' }] });
  assert.equal(hits[1].id, 'F:f8');
  assert.equal(is.parseStack('not json'), null);
  assert.equal(is.parseStack('{}'), null);
});

test('parsing a vrg-ctx.js q --json sample drops rows without path or line', () => {
  const hits = is.parseCode(CODE_SAMPLE);
  assert.deepEqual(hits, [{ path: 'Demo/src/a.js', line: 12, title: 'function demo', snippet: 'x [demo] y' }, { path: 'Demo/src/a.js', line: 40, title: '', snippet: '' }]);
  assert.equal(is.parseCode('oops'), null);
});

test('code(): "No index yet" gives no-index with the Hungarian hint, and never runs index', async () => {
  const f = fake(() => ({ err: Object.assign(new Error('exit 1'), { code: 1 }), stderr: 'No index yet: node tools/vrg-ctx.js index\n' }));
  const s = is.createInnerSearch({ execFile: f.execFile, node: 'NODE', full: FULL, repo: REPO });
  const r = await s.code('demo');
  assert.deepEqual(r, { ok: false, err: 'no-index', hu: 'Nincs kódindex. Futtasd: node tools/vrg-ctx.js index' });
  assert.deepEqual(f.calls[0].args, [path.join(REPO, 'tools', 'vrg-ctx.js'), 'q', 'demo', '-n', '8', '--json']);
  assert.ok(f.calls.every(c => !c.args.includes('index')));
});

test('inner(): both parts, a failing part is reported and the other stays', async () => {
  const f = fake((file, args) => (/stack\.js$/.test(args[0]) ? { stdout: STACK_SAMPLE } : { err: new Error('x'), stderr: 'No index yet: node tools/vrg-ctx.js index' }));
  const s = is.createInnerSearch({ execFile: f.execFile, node: 'NODE', full: FULL, repo: REPO });
  const r = await s.inner({ q: 'Kapu' });
  assert.equal(r.stack.length, 2);
  assert.deepEqual(r.code, []);
  assert.equal(r.codeErr, 'no-index');
});

test('node(): the id is one argv item; a leading dash or a shell character is refused', async () => {
  const f = fake(() => ({ stdout: 'E:kapu  (Entity · pillar)\n' }));
  const s = is.createInnerSearch({ execFile: f.execFile, node: 'NODE', full: FULL, repo: REPO });
  const r = await s.node('E:kapu');
  assert.deepEqual([r.ok, r.text], [true, 'E:kapu  (Entity · pillar)\n']);
  assert.deepEqual(f.calls[0].args.slice(1), ['node', 'E:kapu']);
  for (const id of ['--all', '-x', 'a&b', 'a|b', '', 'x'.repeat(161)]) assert.equal((await s.node(id)).err, 'bad-request', id);
  assert.equal(f.calls.length, 1);
});

test('openHit(i): maps the repo-relative path of the last reply to a handle; the page passes an index only', async () => {
  const f = fake((file, args) => (/stack\.js$/.test(args[0]) ? { stdout: '[]' } : { stdout: '[{"path":"Demo/src/a.js","line":12,"title":"","snippet":""},{"path":"../outside.txt","line":1,"title":"","snippet":""},{"path":"C:/abs.txt","line":2,"title":"","snippet":""}]' }));
  const issued = [];
  const s = is.createInnerSearch({ execFile: f.execFile, node: 'NODE', full: FULL, repo: REPO, issue: abs => { issued.push(abs); return 'h:' + 'A'.repeat(22); } });
  assert.equal(s.openHit(0).err, 'not-found');                      // nothing searched yet
  await s.inner({ q: 'demo' });
  const r = s.openHit(0);
  assert.deepEqual(r, { ok: true, handle: 'h:' + 'A'.repeat(22), name: 'a.js', line: 12 });
  assert.deepEqual(issued, [path.join(REPO, 'Demo', 'src', 'a.js')]);
  assert.equal(s.openHit(1).err, 'not-found');                     // ..\ escapes the repo
  assert.equal(s.openHit(2).err, 'not-found');                     // absolute path
  assert.equal(s.openHit(-1).err, 'not-found');
  assert.equal(s.openHit('0').err, 'not-found');
  assert.equal(issued.length, 1);
});

test('buildTime reads the Generated line of STATUS.md', () => {
  assert.equal(is.buildTime('x\nGenerated 2026-11-04 05:43 by build.js in 2.0 s.\n'), '2026-11-04 05:43');
  assert.equal(is.buildTime('nothing'), '');
});
