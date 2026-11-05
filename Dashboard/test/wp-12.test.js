// WP-12: file operations as jobs. Temp roots A and B under %TEMP%\VRG\desk-test-*, a fake shell.trashItem into a temp _trash.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), os = require('os');

const { createRoots } = require('../shell/lib/roots.js');
const { createHandles } = require('../shell/lib/handles.js');
const { createJobs } = require('../shell/lib/jobs.js');
const { createFsOps, lp, numbered } = require('../shell/lib/fsops.js');

const base = path.join(os.tmpdir(), 'VRG');
fs.mkdirSync(base, { recursive: true });
const TMP = fs.mkdtempSync(path.join(base, 'desk-test-'));
const TRASH = path.join(TMP, '_trash');
fs.mkdirSync(TRASH);
test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));

const T0 = new Date('2020-01-02T03:04:05Z');
let seq = 0;

// a fresh pair of roots, with fake shell and spies
function setup(extra = {}) {
  const n = ++seq;
  const A = path.join(TMP, 'A' + n), B = path.join(TMP, 'B' + n);
  fs.mkdirSync(A); fs.mkdirSync(B);
  const conf = path.join(TMP, 'roots' + n + '.json');
  fs.writeFileSync(conf, JSON.stringify([{ id: 'a', hu: 'A', path: A }, { id: 'b', hu: 'B', path: B }]));
  const roots = createRoots({ configFile: conf, repo: A, full: TMP });
  roots.load();
  const handles = createHandles({ roots });
  const calls = { trash: [], copyFile: 0, rename: 0, rm: 0 };
  const shell = { trashItem: async p => { calls.trash.push(p); fs.renameSync(p, path.join(TRASH, 't' + (++seq) + '-' + path.basename(p))); } };
  const spy = {
    ...fs,
    promises: {
      ...fs.promises,
      copyFile: async (...a) => { calls.copyFile++; if (extra.onCopy) extra.onCopy(calls); return fs.promises.copyFile(...a); },
      rename: async (...a) => { calls.rename++; return fs.promises.rename(...a); },
      rm: async () => { calls.rm++; throw new Error('rm called'); },
      unlink: async () => { calls.rm++; throw new Error('unlink called'); },
      rmdir: async () => { calls.rm++; throw new Error('rmdir called'); },
    },
    rm: () => { calls.rm++; throw new Error('rm called'); },
    unlink: () => { calls.rm++; throw new Error('unlink called'); },
    rmSync: () => { calls.rm++; throw new Error('rm called'); },
    unlinkSync: () => { calls.rm++; throw new Error('unlink called'); },
  };
  const asks = [];
  const jobs = createJobs({ emit: (type, d) => { if (type === 'ask') asks.push(d); } });
  const ops = createFsOps({ fs: spy, shell, jobs, handles, roots, sameVolume: extra.sameVolume });
  const h = p => handles.issue(p);
  return { A, B, ops, jobs, calls, asks, h, handles };
}

const put = (p, text, t = T0) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); fs.utimesSync(p, t, t); };
const tree = dir => {
  const out = {};
  (function walk(d, rel) {
    for (const nm of fs.readdirSync(d).sort()) {
      const p = path.join(d, nm), st = fs.lstatSync(p), r = rel + nm;
      if (st.isDirectory()) { out[r + '/'] = null; walk(p, r + '/'); } else out[r] = [fs.readFileSync(p, 'utf8'), Math.round(st.mtimeMs)];
    }
  })(dir, '');
  return out;
};
const finish = async (jobs, r) => { assert.ok(r.job, JSON.stringify(r)); return jobs.whenDone(r.job); };

test('copy 3 files and a 2-level dir: identical tree and mtimes', async () => {
  const s = setup();
  put(path.join(s.A, 'a.txt'), 'one'); put(path.join(s.A, 'b.txt'), 'two2'); put(path.join(s.A, 'c.txt'), 'three');
  put(path.join(s.A, 'd', 'x.txt'), 'xx'); put(path.join(s.A, 'd', 'e', 'y.txt'), 'yyy');
  const srcs = ['a.txt', 'b.txt', 'c.txt', 'd'].map(n => s.h(path.join(s.A, n)));
  const snap = await finish(s.jobs, await s.ops.copy(srcs, s.h(s.B), 'ask'));
  assert.equal(snap.state, 'done');
  assert.deepEqual(tree(s.B), tree(s.A));
  assert.equal(snap.done, snap.total);
  assert.equal(snap.total, 3 + 4 + 5 + 2 + 3);
  assert.equal(s.calls.trash.length, 0);
});

test('conflict + rename gives "x (2).txt"; skip leaves the target bytes', async () => {
  const s = setup();
  put(path.join(s.A, 'x.txt'), 'new'); put(path.join(s.B, 'x.txt'), 'old');
  let snap = await finish(s.jobs, await s.ops.copy([s.h(path.join(s.A, 'x.txt'))], s.h(s.B), 'rename'));
  assert.equal(snap.state, 'done');
  assert.equal(fs.readFileSync(path.join(s.B, 'x (2).txt'), 'utf8'), 'new');
  assert.equal(fs.readFileSync(path.join(s.B, 'x.txt'), 'utf8'), 'old');
  snap = await finish(s.jobs, await s.ops.copy([s.h(path.join(s.A, 'x.txt'))], s.h(s.B), 'skip'));
  assert.equal(snap.state, 'done');
  assert.equal(fs.readFileSync(path.join(s.B, 'x.txt'), 'utf8'), 'old');
  assert.deepEqual(fs.readdirSync(s.B).sort(), ['x (2).txt', 'x.txt']);
  await finish(s.jobs, await s.ops.copy([s.h(path.join(s.A, 'x.txt'))], s.h(s.B), 'rename'));
  assert.ok(fs.existsSync(path.join(s.B, 'x (3).txt')));
  await finish(s.jobs, await s.ops.copy([s.h(path.join(s.A, 'x.txt'))], s.h(s.B), 'overwrite'));
  assert.equal(fs.readFileSync(path.join(s.B, 'x.txt'), 'utf8'), 'new');
  assert.equal(numbered('a.b.txt', 2), 'a.b (2).txt');
});

test('overwrite sends the old file to the Recycle Bin first (copy and same-volume move)', async () => {
  const s = setup();
  put(path.join(s.A, 'x.txt'), 'new'); put(path.join(s.B, 'x.txt'), 'old');
  let snap = await finish(s.jobs, await s.ops.copy([s.h(path.join(s.A, 'x.txt'))], s.h(s.B), 'overwrite'));
  assert.equal(snap.state, 'done');
  assert.equal(fs.readFileSync(path.join(s.B, 'x.txt'), 'utf8'), 'new');
  assert.deepEqual(s.calls.trash, [path.join(s.B, 'x.txt')]);
  const binned = fs.readdirSync(TRASH).filter(n => n.endsWith('-x.txt')).map(n => fs.readFileSync(path.join(TRASH, n), 'utf8'));
  assert.ok(binned.includes('old'), 'the old bytes are in the bin');
  const m = setup({ sameVolume: async () => true });
  put(path.join(m.A, 'y.txt'), 'new'); put(path.join(m.B, 'y.txt'), 'old-y');
  snap = await finish(m.jobs, await m.ops.move([m.h(path.join(m.A, 'y.txt'))], m.h(m.B), 'overwrite'));
  assert.equal(snap.state, 'done');
  assert.equal(fs.readFileSync(path.join(m.B, 'y.txt'), 'utf8'), 'new');
  assert.deepEqual(m.calls.trash, [path.join(m.B, 'y.txt')]);
  assert.equal(m.calls.rm, 0);
});

test('policy ask: the job asks with the four choices and honours the answer', async () => {
  const s = setup();
  put(path.join(s.A, 'x.txt'), 'new'); put(path.join(s.B, 'x.txt'), 'old');
  const r = await s.ops.copy([s.h(path.join(s.A, 'x.txt'))], s.h(s.B), 'ask');
  for (let i = 0; i < 200 && !s.asks.length; i++) await new Promise(res => setTimeout(res, 10));
  assert.deepEqual(s.asks[0].choices, ['skip', 'overwrite', 'rename', 'cancel']);
  assert.equal(s.asks[0].question, 'Már létezik: x.txt');
  assert.deepEqual(s.jobs.answer(r.job, 'overwrite'), { ok: true });
  assert.equal((await s.jobs.whenDone(r.job)).state, 'done');
  assert.equal(fs.readFileSync(path.join(s.B, 'x.txt'), 'utf8'), 'new');
});

test('cancel mid-way stops before the next file', async () => {
  let jobs = null, id = null;
  const s = setup({ onCopy: calls => { if (calls.copyFile === 1 && id) jobs.cancel(id); } });
  jobs = s.jobs;
  for (const n of ['1.txt', '2.txt', '3.txt']) put(path.join(s.A, n), n);
  const r = await s.ops.copy(['1.txt', '2.txt', '3.txt'].map(n => s.h(path.join(s.A, n))), s.h(s.B), 'skip');
  id = r.job;
  const snap = await s.jobs.whenDone(r.job);
  assert.equal(snap.state, 'cancelled');
  assert.equal(fs.existsSync(path.join(s.B, '1.txt')) + fs.existsSync(path.join(s.B, '2.txt')) + fs.existsSync(path.join(s.B, '3.txt')) <= 1, true);
  assert.equal(fs.existsSync(path.join(s.B, '3.txt')), false);
});

test('move within a root uses rename, no copy', async () => {
  const s = setup();
  put(path.join(s.A, 'm.txt'), 'mm'); fs.mkdirSync(path.join(s.A, 'sub'));
  const snap = await finish(s.jobs, await s.ops.move([s.h(path.join(s.A, 'm.txt'))], s.h(path.join(s.A, 'sub')), 'ask'));
  assert.equal(snap.state, 'done');
  assert.equal(fs.readFileSync(path.join(s.A, 'sub', 'm.txt'), 'utf8'), 'mm');
  assert.equal(fs.existsSync(path.join(s.A, 'm.txt')), false);
  assert.equal(s.calls.rename, 1);
  assert.equal(s.calls.copyFile, 0);
  assert.equal(s.calls.trash.length, 0);
});

test('move A to B on "different volumes" copies, then trashes the source', async () => {
  const s = setup({ sameVolume: () => false });
  put(path.join(s.A, 'm.txt'), 'mm'); put(path.join(s.A, 'd', 'q.txt'), 'qq');
  const m = path.join(s.A, 'm.txt'), d = path.join(s.A, 'd');
  const snap = await finish(s.jobs, await s.ops.move([s.h(m), s.h(d)], s.h(s.B), 'ask'));
  assert.equal(snap.state, 'done');
  assert.equal(s.calls.copyFile, 2);
  assert.equal(s.calls.rename, 0);
  assert.deepEqual(s.calls.trash, [m, d]);
  assert.equal(fs.readFileSync(path.join(s.B, 'd', 'q.txt'), 'utf8'), 'qq');
  assert.equal(fs.existsSync(m), false);
  assert.equal(s.calls.rm, 0);
});

test('rename: safe names only, existing target refused', async () => {
  const s = setup();
  put(path.join(s.A, 'a.txt'), 'a'); put(path.join(s.A, 'b.txt'), 'b');
  const h = s.h(path.join(s.A, 'a.txt'));
  assert.equal((await s.ops.rename(h, 'a/b')).ok, false);
  assert.equal((await s.ops.rename(h, '..')).ok, false);
  const ex = await s.ops.rename(h, 'b.txt');
  assert.equal(ex.ok, false); assert.equal(ex.err, 'exists');
  const ok = await s.ops.rename(h, 'c.txt');
  assert.equal(ok.item.name, 'c.txt');
  assert.ok(fs.existsSync(path.join(s.A, 'c.txt')));
  assert.ok(!fs.existsSync(path.join(s.A, 'a.txt')));
});

test('mkdir creates, refuses existing and unsafe names', async () => {
  const s = setup();
  const d = s.h(s.A);
  assert.equal((await s.ops.mkdir(d, 'new')).item.name, 'new');
  assert.ok(fs.statSync(path.join(s.A, 'new')).isDirectory());
  assert.equal((await s.ops.mkdir(d, 'new')).err, 'exists');
  assert.equal((await s.ops.mkdir(d, 'a\\b')).ok, false);
});

test('copy dir into itself or its subdir is refused; root cannot be moved', async () => {
  const s = setup();
  fs.mkdirSync(path.join(s.A, 'dir', 'sub'), { recursive: true });
  const dir = s.h(path.join(s.A, 'dir'));
  const r = await s.ops.copy([dir], s.h(path.join(s.A, 'dir', 'sub')), 'ask');
  assert.equal(r.ok, false); assert.equal(r.err, 'inside');
  assert.equal((await s.ops.move([dir], dir, 'ask')).err, 'inside');
  assert.equal((await s.ops.trash([s.h(s.A)])).ok, false);
  assert.equal((await s.ops.copy([dir], 'h:AAAAAAAAAAAAAAAAAAAAAA', 'ask')).ok, false);
  assert.equal((await s.ops.copy([dir], s.h(s.B), 'bogus')).err, 'bad-request');
});

test('trash goes through shell.trashItem and never rm/unlink', async () => {
  const s = setup();
  put(path.join(s.A, 'a.txt'), 'a'); put(path.join(s.A, 'd', 'z.txt'), 'z');
  const a = path.join(s.A, 'a.txt'), d = path.join(s.A, 'd');
  const snap = await finish(s.jobs, await s.ops.trash([s.h(a), s.h(d)]));
  assert.equal(snap.state, 'done');
  assert.equal(snap.hu, 'Lomtárba helyezve: 2 elem');
  assert.deepEqual(s.calls.trash, [a, d]);
  assert.equal(s.calls.rm, 0);
  assert.equal(fs.readdirSync(s.A).length, 0);
});

test('long paths get the \\\\?\\ prefix from 240 characters', () => {
  const short = 'C:\\' + 'a'.repeat(20);
  assert.equal(lp(short), short);
  const long = 'C:\\' + 'a'.repeat(240);
  assert.equal(lp(long), '\\\\?\\' + long);
  assert.equal(lp('\\\\?\\' + long), '\\\\?\\' + long);
  assert.equal(lp('\\\\srv\\share\\' + 'a'.repeat(240)), '\\\\?\\UNC\\srv\\share\\' + 'a'.repeat(240));
});
