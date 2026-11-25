// VRG Stack — tests for the layer text (lib/layertext.js, S8) and the Viewer's layout (lib/viewer-layout.js, S9).
// Run:  node --test test/viewer.test.js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const LT = require('../lib/layertext');
const VL = require('../lib/viewer-layout');

const N = (id, layer, extra = {}) => ({ id, layer, kind: extra.kind || 'x', title: extra.title || id, brief: extra.brief || '', t: extra.t || '', state: '', lane: extra.lane || '', tier: extra.tier || '', path: extra.path || '', own: extra.own || [] });
const nodes = [
  N('G:docs/a.md', 'G', { path: 'docs/a.md' }), N('G:docs/b.md', 'G', { path: 'docs/b.md' }), N('C:docs', 'C', { path: 'docs' }),
  N('R:aaa1111', 'R', { title: 'first commit', t: '2026-11-01', lane: 'main' }), N('R:bbb2222', 'R', { title: 'second', t: '2026-11-02', lane: 'main' }),
  N('Q:VIS-Q5', 'Q', { title: 'Holo forms' }), N('Q:file.docs/DECISIONS.md', 'Q', { path: 'docs/DECISIONS.md' }),
];
const docs = { 'docs/a.md': '# A\n\nÁrvíztűrő tükörfúrógép, a paragraph.\n', 'docs/b.md': '# B\n' + 'x'.repeat(2000) + '\n' };
const src = { doc: p => docs[p] == null ? null : docs[p], files: d => d === 'docs' ? [['a.md', 40], ['b.md', 2006]] : [] };

test('layer text: deterministic, every node owns one exact byte range', () => {
  const a = LT.build(nodes, src), b = LT.build(nodes.slice().reverse(), src);
  assert.deepEqual(Object.keys(a), ['Q', 'R', 'C', 'G']);
  for (const L of Object.keys(a)) {
    assert.ok(a[L].buf.equals(b[L].buf), L + ': the same nodes give the same bytes, whatever their order');
    let at = 0;
    for (const [id, s, e, h] of a[L].idx) { assert.equal(s, at); assert.ok(e > s); at = e;
      const text = a[L].buf.subarray(s, e).toString('utf8'); assert.ok(text.startsWith('§ ' + id + '\n'), id); assert.equal(h, LT.hash(a[L].buf, s, e)); }
    assert.equal(at, a[L].buf.length);
  }
  const g = a.G.buf.toString('utf8');
  assert.ok(g.includes('Árvíztűrő tükörfúrógép'), 'G carries the document text (STK-Q23 = whole documents)');
  assert.ok(a.C.buf.toString('utf8').includes('b.md  2006'), 'C carries the folder listing with sizes');
});

test('layer text: a one-node change differs only in that node (diff names it)', () => {
  const a = LT.build(nodes, src);
  const edited = nodes.map(n => n.id === 'R:aaa1111' ? { ...n, title: 'first commit, reworded' } : n);
  const b = LT.build(edited, src);
  const d = LT.diff(a.R.idx, b.R.idx);
  assert.deepEqual(d, { changed: ['R:aaa1111'], added: [], removed: [] });
  assert.deepEqual(LT.diff(a.G.idx, b.G.idx), { changed: [], added: [], removed: [] });
  const c = LT.build(nodes.filter(n => n.id !== 'Q:VIS-Q5').concat(N('Q:STK-Q22', 'Q')), src);
  assert.deepEqual(LT.diff(a.Q.idx, c.Q.idx), { changed: [], added: ['Q:STK-Q22'], removed: ['Q:VIS-Q5'] });
});

const inside = (r, o) => r.x >= o.x - 1e-9 && r.y >= o.y - 1e-9 && r.x + r.w <= o.x + o.w + 1e-9 && r.y + r.h <= o.y + o.h + 1e-9;
const overlap = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 1e-9 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 1e-9;
const U = { x: 0, y: 0, w: 1, h: 1 };
function check(L, cells) {
  const m = VL.layout(L, cells), rs = [...m.values()];
  assert.equal(m.size, cells.length, L + ': every node has a cell');
  for (const r of rs) assert.ok(inside(r, U) && r.w > 0 && r.h > 0, L + ' inside its plane');
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) assert.ok(!overlap(rs[i], rs[j]), L + ': cells do not overlap');
  return m;
}

test('layout: each layer in its natural order, area follows bytes', () => {
  const R = [];
  for (let d = 1; d <= 30; d++) R.push({ id: 'R:' + d, n: 100 + (d % 7) * 40, t: `2026-11-${String(d).padStart(2, '0')}`, lane: d % 3 ? 'main' : 'claude/x' });
  const m = check('R', R);
  const main = R.filter(c => c.lane === 'main').map(c => m.get(c.id));
  assert.ok(main.every((r, i) => i === 0 || r.x >= main[i - 1].x - 1e-9), 'R: time runs left to right inside a lane');
  const G = []; for (let i = 0; i < 60; i++) G.push({ id: 'G:' + ['docs', 'Stack', 'Mobile/docs'][i % 3] + '/f' + i + '.md', path: ['docs', 'Stack', 'Mobile/docs'][i % 3] + '/f' + i + '.md', n: 50 + i * 37 });
  const g = check('G', G);
  const area = id => { const r = g.get(id); return r.w * r.h; };
  assert.ok(area('G:docs/f57.md') > area('G:docs/f3.md') * 5, 'G: a bigger document has a bigger cell');
  check('F', Array.from({ length: 40 }, (_, i) => ({ id: 'F:' + i, n: 80 + i, tier: 1 + (i % 3), lane: ['apps', 'tools'][i % 2] })));
  const q = check('Q', [{ id: 'Q:VIS-Q1', n: 90 }, { id: 'Q:VIS-Q2', n: 90 }, { id: 'Q:STK-Q1', n: 90 }, { id: 'Q:file.docs/DECISIONS.md', n: 300 }]);
  assert.ok(Math.abs(q.get('Q:VIS-Q1').x - q.get('Q:VIS-Q2').x) < Math.abs(q.get('Q:VIS-Q1').x - q.get('Q:STK-Q1').x) + 1e-9, 'Q: one namespace, one column');
  check('A', [{ id: 'A:a', n: 100, kind: 'agent' }, { id: 'A:b', n: 50, kind: 'skill' }, { id: 'A:c', n: 70, kind: 'agent' }]);
  check('C', [{ id: 'C:Stack', path: 'Stack', n: 400 }, { id: 'C:Stack/lib', path: 'Stack/lib', n: 900 }, { id: 'C:Mobile', path: 'Mobile', n: 300 }]);
});

test('particles: Hilbert tiles fill the cell, stay inside it, one place each', () => {
  for (const [n, r] of [[1, { x: 0.1, y: 0.1, w: 0.2, h: 0.05 }], [37, { x: 0, y: 0, w: 0.3, h: 0.3 }], [7517, { x: 0.2, y: 0.4, w: 0.1, h: 0.02 }], [100000, U]]) {
    const f = VL.fill(r, n), seen = new Set();
    assert.ok(f.ratio > (n < 50 ? 0.2 : 0.5), `n=${n}: the tiles cover the cell (${f.ratio.toFixed(2)})`);
    for (let d = 0; d < n; d += Math.max(1, n >> 12)) {
      const [u, v] = VL.at(f, d);
      assert.ok(u > r.x && u < r.x + r.w && v > r.y && v < r.y + r.h, `n=${n}: particle ${d} inside its cell`);
      const k = Math.round((u - f.x0) / f.p * 2) + ':' + Math.round((v - f.z0) / f.p * 2); assert.ok(!seen.has(k), 'no two particles share a place'); seen.add(k);
    }
  }
  // the curve: neighbours in the text are neighbours on the plane (the reason for Hilbert, Cortesi)
  for (let d = 1; d < 256; d++) { const a = VL.d2xy(16, d - 1), b = VL.d2xy(16, d); assert.equal(Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]), 1); }
});

test('aggregate: k bytes → one particle of the dominant class, never across nodes', () => {
  const s = Buffer.from('abcd    1234{}{}xyz', 'utf8');
  const { data, starts } = VL.aggregate(s, [[0, 8], [8, 19]], 4);
  assert.deepEqual([...starts], [0, 2, 5]);
  assert.deepEqual([...data].map(VL.byteClass), [0, 3, 2, 5, 0]);
  const one = VL.aggregate(s, [[0, 19]], 1); assert.deepEqual(Buffer.from(one.data), s);
  const cls = VL.aggregate(Uint8Array.from([0, 0, 3, 3, 3, 1]), [[0, 6]], 3, true);
  assert.deepEqual([...cls.data], [0, 3], 'class codes stay class codes (the phone bundle)');
  assert.equal(VL.byteClass('Á'.charCodeAt(0) > 127 ? 0xc3 : 0), 1);
});

// ---- S10: the timeline and a folder's code bytes
test('timeline: born on the work date of the first node+, pulses on state and edit, unknown ids ignored', () => {
  const ns = [{ id: 'R:a', t: '2026-11-02T10:00' }, { id: 'C:x', t: '' }, { id: 'Q:y', t: '2026-11-09' }, { id: 'G:z', t: '' }];
  const ev = [
    { op: 'build', seen: '2026-11-05T09:00Z' },
    { op: 'node+', id: 'R:a', valid: '2026-11-02', seen: '2026-11-05T09:00Z' },
    { op: 'node+', id: 'C:x', valid: '', seen: '2026-11-05T09:00Z' },
    { op: 'node-', id: 'C:x', valid: '', seen: '2026-11-06T09:00Z' }, { op: 'node+', id: 'C:x', valid: '', seen: '2026-11-07T09:00Z' },
    { op: 'state', id: 'C:x', valid: '', seen: '2026-11-08T09:00Z' }, { op: 'edit', id: 'R:a', seen: '2026-11-08T12:00Z' },
    { op: 'node+', id: 'gone', valid: '', seen: '2026-11-01T00:00Z' },
  ];
  const T = LT.timeline(ev, ns);
  assert.deepEqual(T.days, ['2026-11-02', '2026-11-05', '2026-11-08', '2026-11-09']);
  assert.deepEqual(T.born, { 'C:x': 1, 'Q:y': 3, 'R:a': 0 }, 'first appearance wins; Q:y from its own date; G:z has no date, always there');
  assert.deepEqual(T.ev, [[2, 'C:x', 'state'], [2, 'R:a', 'edit']]);
});

test('folder bytes: tracked files directly in the folder, secrets and escapes refused, capped', () => {
  const fs = require('fs'), os = require('os'), path = require('path'), { execFileSync } = require('child_process');
  const B = require('../lib/bytes');
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'vrg-bytes-'));
  const put = (f, s) => { fs.mkdirSync(path.dirname(path.join(repo, f)), { recursive: true }); fs.writeFileSync(path.join(repo, f), s); };
  put('app/a.js', 'const a = 1;\n'); put('app/b.md', '# B\n' + 'x'.repeat(100)); put('app/.env', 'TOKEN=1'); put('app/sub/c.js', 'deep');
  put('app/quote.pdf', '%PDF'); put('Vendor/v/x.js', 'v');
  execFileSync('git', ['init', '-q'], { cwd: repo }); execFileSync('git', ['add', '-A'], { cwd: repo });
  put('app/untracked.js', 'secret?');
  const r = B.folderBytes(repo, 'app');
  assert.deepEqual(r.files.map(f => f[0]), ['a.js', 'b.md'], 'own tracked files only: no sub-folder, no .env, no pdf, no untracked');
  assert.equal(r.buf.subarray(r.files[0][1], r.files[0][2]).toString(), 'const a = 1;\n');
  const small = B.folderBytes(repo, 'app', { cap: 20 });
  assert.ok(small.truncated && small.total === 20);
  for (const bad of ['../x', 'app/../..', '.git', '', 'Vendor/v', 'Planner/apps']) assert.throws(() => B.folderBytes(repo, bad), e => e.code >= 400, bad);
  fs.rmSync(repo, { recursive: true, force: true });
});
