// WP-21: stack-json.js — node cards, expand and context packs against a hand-made fixture stack.
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path');
const { spawnSync } = require('child_process');

const SCRIPT = path.join(__dirname, '..', 'tools', 'stack-json.js');
const FIXTURE = path.join(__dirname, 'fixtures', 'stack-mini.json');
const L0 = 'L0 demo codec: F feature, L logic, C code.';
const LIVE = 'H:\\VRG\\Full\\notes\\stack';

const base = path.join(os.tmpdir(), 'VRG');
fs.mkdirSync(base, { recursive: true });
const tmp = fs.mkdtempSync(path.join(base, 'desk-test-'));
fs.mkdirSync(path.join(tmp, 'out', 'codec'), { recursive: true });
fs.copyFileSync(FIXTURE, path.join(tmp, 'out', 'stack.json'));
fs.writeFileSync(path.join(tmp, 'out', 'codec', 'L0.txt'), L0);
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

const tok = s => Math.ceil(s.length / 4);
function cli(stack, ...args) {
  const r = spawnSync(process.execPath, [SCRIPT, '--stack', stack, ...args], { encoding: 'utf8' });
  return { code: r.status, out: r.stdout.replace(/\n$/, '') };
}

test('node lists the 4 links in order: evidence, pillar, horizontal', () => {
  const r = cli(tmp, 'node', 'F:f1');
  assert.equal(r.code, 0);
  const n = JSON.parse(r.out);
  assert.equal(n.id, 'F:f1');
  assert.equal(n.layer, 'F');
  assert.equal(n.title, 'Demo feature one');
  assert.equal(n.state, 'live');
  assert.deepEqual(n.links.map(l => l.id), ['L:l1', 'E:demo', 'F:f2', 'F:f3']);
  assert.deepEqual(n.links.map(l => l.rel), ['implements', 'pillar', 'related', 'follows']);
  assert.deepEqual(n.links.map(l => l.dir), ['→', '→', '→', '←']);
  assert.deepEqual(n.links.map(l => l.layer), ['L', 'E', 'F', 'F']);
  assert.equal(n.links[1].title, 'Demo pillar');
});

test('expand: depth 1 vs depth 2 counts', () => {
  const d1 = JSON.parse(cli(tmp, 'expand', 'F:f1', '--depth', '1').out);
  assert.equal(d1.nodes.length, 5);
  assert.equal(d1.edges.length, 4);
  const d2 = JSON.parse(cli(tmp, 'expand', 'F:f1', '--depth', '2').out);
  assert.equal(d2.nodes.length, 7);
  assert.equal(d2.edges.length, 6);
  assert.ok(d2.tokens > d1.tokens);
});

test('expand: the layer filter drops the other layers; --max stops early', () => {
  const f = JSON.parse(cli(tmp, 'expand', 'F:f1', '--layers', 'F', '--depth', '2').out);
  assert.deepEqual(f.nodes.map(n => n.id).sort(), ['F:f1', 'F:f2', 'F:f3']);
  assert.deepEqual(f.edges.map(e => e.rel).sort(), ['follows', 'related']);
  const m = JSON.parse(cli(tmp, 'expand', 'F:f1', '--depth', '2', '--max', '3').out);
  assert.equal(m.nodes.length, 3);
});

test('pack: budget 200 stays within 200 tokens and ends with the summary line', () => {
  const ids = 'F:f1,F:f2,L:l1,L:l2,C:c1,C:c2,F:f3,F:f4';
  const r = cli(tmp, 'pack', ids, '--budget', '200', '--l0');
  assert.equal(r.code, 0);
  assert.ok(tok(r.out) <= 200, 'tokens ' + tok(r.out));
  assert.match(r.out, /^# VRG context pack · \d{4}-\d{2}-\d{2} · \d+ nodes/);
  assert.ok(r.out.includes(L0));
  assert.ok(r.out.indexOf('## F:f1 Demo feature one [live]') > 0);
  assert.ok(r.out.includes('- implements → L:l1 Demo rule one'));
  const last = r.out.split('\n').pop();
  assert.match(last, /^\(budget 200, used \d+, \d+ nodes left out\)$/);
  assert.notEqual(last, '(budget 200, used 0, 0 nodes left out)');
});

test('pack: a small budget leaves nodes out, in the given order; a big one leaves none', () => {
  const small = cli(tmp, 'pack', 'F:f1,F:f2,L:l1', '--budget', '80').out;
  assert.ok(small.includes('## F:f1 '));
  assert.ok(!small.includes('## L:l1 '));
  assert.match(small.split('\n').pop(), /, [12] nodes left out\)$/);
  const big = cli(tmp, 'pack', 'F:f1,F:f2,L:l1', '--budget', '2000', '--title', 'Demo title').out;
  assert.match(big, /^# VRG context pack · \S+ · 3 nodes\nDemo title\n/);
  assert.ok(big.endsWith(', 0 nodes left out)'));
});

test('unknown id and bad input: JSON error, exit 2', () => {
  for (const args of [['node', 'F:nope'], ['expand', 'F:nope'], ['pack', 'F:nope', '--budget', '100'], ['pack', 'F:f1'], ['node'], ['bogus']]) {
    const r = cli(tmp, ...args);
    assert.equal(r.code, 2, args.join(' '));
    const j = JSON.parse(r.out);
    assert.equal(j.ok, false);
    assert.equal(typeof j.err, 'string');
  }
  assert.equal(cli(path.join(tmp, 'missing'), 'node', 'F:f1').code, 2);
});

const hasLive = fs.existsSync(path.join(LIVE, 'out', 'stack.json'));
test('live stack: pack E:dashboard,F:f12 fits 1500 tokens', { skip: hasLive ? false : 'notes/stack/out/stack.json is absent' }, () => {
  const r = cli(LIVE, 'pack', 'E:dashboard,F:f12', '--budget', '1500', '--l0');
  assert.equal(r.code, 0, r.out.slice(0, 200));
  assert.ok(tok(r.out) <= 1500);
  assert.ok(r.out.startsWith('# VRG context pack'));
});
