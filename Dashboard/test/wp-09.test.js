// WP-09: the job queue (states, progress, cancel, failure, concurrency, ask/answer, history).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createJobs } = require('../shell/lib/jobs.js');

const tick = () => new Promise(r => setImmediate(r));
const gate = () => { let open; const p = new Promise(r => { open = r; }); return { p, open }; };
const make = () => {
  const events = [];
  const jobs = createJobs({ emit: (type, data) => events.push({ type, ...data }) });
  return { jobs, events, updates: id => events.filter(e => e.type === 'update' && e.job === id) };
};

test('a 3-step job reports 1/3, 2/3, 3/3 and done', async () => {
  const { jobs, updates } = make();
  const id = jobs.create({ kind: 'copy', hu: 'Másolás', run: async ctx => { for (let i = 1; i <= 3; i++) { await tick(); ctx.progress(i, 3); } } });
  await jobs.whenDone(id);
  const u = updates(id).map(e => [e.state, e.done, e.total]);
  assert.deepEqual(u, [['queued', 0, 0], ['running', 0, 0], ['running', 1, 3], ['running', 2, 3], ['running', 3, 3], ['done', 3, 3]]);
  assert.equal(jobs.get(id).state, 'done');
});

test('cancel after step 1 → cancelled, step 2 never runs', async () => {
  const { jobs } = make();
  const g = gate(); const ran = [];
  const id = jobs.create({ kind: 'copy', hu: 'x', run: async ctx => {
    ran.push(1); ctx.progress(1, 3); await g.p;
    if (ctx.cancelled) return;
    ran.push(2);
  } });
  await tick(); await tick();
  assert.deepEqual(jobs.cancel(id), { ok: true });
  g.open();
  await jobs.whenDone(id);
  assert.equal(jobs.get(id).state, 'cancelled');
  assert.deepEqual(ran, [1]);
  assert.equal(jobs.cancel(id).ok, false);
  assert.equal(jobs.cancel('j999').ok, false);
});

test('a job that throws → failed with its message', async () => {
  const { jobs, updates } = make();
  const id = jobs.create({ kind: 'mail', hu: 'Letöltés', run: async () => { throw new Error('disk full'); } });
  await jobs.whenDone(id);
  const last = updates(id).pop();
  assert.equal(last.state, 'failed');
  assert.equal(last.err, 'disk full');
});

test('the 5th running job waits in queued; 2 per kind', async () => {
  const { jobs } = make();
  const g = gate();
  const ids = ['a', 'b', 'c', 'd', 'e'].map(k => jobs.create({ kind: k, hu: k, run: () => g.p }));
  await tick();
  assert.deepEqual(ids.map(i => jobs.get(i).state), ['running', 'running', 'running', 'running', 'queued']);
  g.open();
  await jobs.whenDone(ids[4]);
  assert.equal(jobs.get(ids[4]).state, 'done');

  const g2 = gate();
  const same = [1, 2, 3].map(() => jobs.create({ kind: 'copy', hu: 'c', run: () => g2.p }));
  await tick();
  assert.deepEqual(same.map(i => jobs.get(i).state), ['running', 'running', 'queued']);
  assert.deepEqual(jobs.cancel(same[2]), { ok: true });
  assert.equal(jobs.get(same[2]).state, 'cancelled');
  g2.open();
});

test('ask resolves with the answered choice; all=true answers later asks by itself', async () => {
  const { jobs, events } = make();
  const got = [];
  const id = jobs.create({ kind: 'copy', hu: 'x', run: async ctx => {
    got.push(await ctx.ask({ hu: 'Már létezik', choices: ['skip', 'overwrite', 'rename'] }));
    got.push(await ctx.ask({ hu: 'Már létezik', choices: ['skip', 'overwrite', 'rename'] }));
  } });
  await tick(); await tick();
  const ask = events.find(e => e.type === 'ask');
  assert.deepEqual({ job: ask.job, question: ask.question, choices: ask.choices }, { job: id, question: 'Már létezik', choices: ['skip', 'overwrite', 'rename'] });
  assert.equal(jobs.answer(id, 'bogus').ok, false);
  assert.deepEqual(jobs.answer(id, 'rename', true), { ok: true });
  await jobs.whenDone(id);
  assert.deepEqual(got, ['rename', 'rename']);
  assert.equal(events.filter(e => e.type === 'ask').length, 1);
  assert.equal(jobs.answer(id, 'skip').ok, false);
});

test('cancelling a job that waits on a question answers it with cancel', async () => {
  const { jobs } = make();
  let got = '';
  const id = jobs.create({ kind: 'copy', hu: 'x', run: async ctx => { got = await ctx.ask('?'); } });
  await tick(); await tick();
  jobs.cancel(id);
  await jobs.whenDone(id);
  assert.equal(got, 'cancel');
  assert.equal(jobs.get(id).state, 'cancelled');
});

test('history keeps the last 50 finished jobs', async () => {
  const { jobs } = make();
  let last;
  for (let i = 0; i < 55; i++) { last = jobs.create({ kind: 'k', hu: 'j' + i, run: async () => {} }); await jobs.whenDone(last); }
  const l = jobs.list();
  assert.equal(l.length, 50);
  assert.equal(l[l.length - 1].hu, 'j54');
  assert.equal(l[0].hu, 'j5');
});
