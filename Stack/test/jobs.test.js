// VRG Stack — M · Munkák (lib/jobs.js, S15). Run:  node --test test/jobs.test.js
// On an INVENTED job folder (test/fixtures/jobs: codes X01…, no client data): the register, the totals, the Kit's
// folders, which tools each job used; the layer carries codes only; a code in any text links to its job.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const JB = require('../lib/jobs');
const C = require('../lib/common');

const DIR = path.join(__dirname, 'fixtures', 'jobs');
const jobs = JB.read(DIR);
const by = Object.fromEntries(jobs.map(j => [j.code, j]));

test('read: the register, the totals of the newest file, the Kit folders, the tools each job used', () => {
  assert.deepEqual(jobs.map(j => j.code), ['X01', 'X02', 'X03', 'XK4']);
  assert.equal(by.X01.status, 'befejezett'); assert.equal(by.X01.from, '2025-01-10'); assert.equal(by.X01.to, '2025-02-20');
  assert.equal(by.X01.total, 200000, 'the newest file\'s rows, not every file summed (the Map\'s readTotals)');
  assert.deepEqual(by.X01.tools, ['planner'], 'a Planner export in its folder');
  assert.deepEqual(by.X01.related, ['X03'], 'the code in its note, not the note');
  assert.deepEqual(by.X02.tools, ['kit', 'planner'], 'its Kit folder, and a Planner project file named by its code');
  assert.deepEqual(by.X02.kinds, ['kit', 'register']);
  assert.deepEqual(by.X03.tools, []); assert.equal(by.X03.status, 'meghiúsult');
  assert.deepEqual(by.XK4.kinds, ['kit'], 'a Kit folder the register does not have');
});

test('layer: codes, statuses, dates, totals and tool names only; never a label, a note, an address or a file name', () => {
  const L = JB.layer(jobs), n = id => L.nodes.find(x => x.id === id);
  assert.equal(n('M:job.X01').title, 'X01 · befejezett · Planner');
  assert.equal(n('M:job.X02').title, 'X02 · folyamatban · Planner + Workflow Kit');
  assert.equal(n('M:job.XK4').kind, 'kit job');
  assert.match(n('M:job.X01').brief, /2025-01-10 … 2025-02-20 · 200 000 Ft \(2025-02-18\)/);
  assert.deepEqual(n('M:job.X01').own, ['job:X01']);
  assert.ok(n('M:job.X01').text.includes('Planner/projects/varler-planner'), 'the Planner folder, for the join');
  assert.deepEqual(L.edges, [{ a: 'M:job.X01', b: 'M:job.X03', rel: 'related' }]);
  const all = JSON.stringify(L);
  for (const secret of ['minta-folder', 'kitalalt', 'csak-kit', 'Kitalált Kft', 'Képzelt utca', 'aramkorok', 'WORKLOG', 'jegyzet'])
    assert.ok(!all.includes(secret), 'nothing of the folder, the note, the address or the files: ' + secret);
});

test('join: a job code in a text links to its job, but only a code the register has', () => {
  const ex = C.makeExtractor({ paths: new Set(), dirs: new Set(), commits: new Set(), sessions: new Set(), memories: new Set(), basenames: new Map(), jobs: new Set(['X01', 'X02']) });
  assert.deepEqual([...ex('the X01 quote, then X02; S12 and M15 are no jobs')].sort(), ['job:X01', 'job:X02']);
  const none = C.makeExtractor({ paths: new Set(), dirs: new Set(), commits: new Set(), sessions: new Set(), memories: new Set(), basenames: new Map() });
  assert.deepEqual([...none('X01')], [], 'no register, no job keys');
});

test('a missing jobs folder is an empty layer, not an error', () => {
  assert.deepEqual(JB.read(path.join(DIR, 'nincs-ilyen')), []);
});

test('quiet: a job the register calls running, with no file for 30+ days', () => {
  const L = JB.layer(jobs);
  assert.deepEqual(JB.quiet(L.nodes, { today: '2026-11-21' }).map(x => x.n.id), [], 'X02 ran on 2026-11-20');
  const q = JB.quiet(L.nodes.map(n => n.id === 'M:job.X02' ? { ...n, t: '2026-09-01' } : n), { today: '2026-11-27' });
  assert.deepEqual(q.map(x => [x.n.id, x.days]), [['M:job.X02', 87]]);
  const J = require('../lib/signals').detect({ nodes: new Map(L.nodes.map(n => [n.id, n.id === 'M:job.X02' ? { ...n, t: '2020-01-01' } : n])) });
  assert.equal(J.nodes.find(x => x.id === 'J:job-quiet.X02').state, 'amber');
});
