// VRG Stack — Füzértábla (lib/board.js, S4). Run:  node --test test/board.test.js
// The parity test (§2.3): every thread and every item of the last Thread Board (Archive/files/thread-board.html, built
// 2026-11-09 by notes/devlog/board.js) is on the Füzértábla built from the same hand data; nothing is lost.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const B = require('../lib/board');
const T = require('../lib/todo');

const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Archive', 'files', 'thread-board.html'), 'utf8');
const OLD = JSON.parse(html.match(/const DATA = (\{.*?\});\n/s)[1]);
// the hand data as threads.js and lines.js hold it (the old board was built from these)
const threads = { SCALE: OLD.scale, NOW: OLD.now, WAITING: OLD.waiting, AREAS: OLD.areas.map(a => ({ area: a.area, rows: a.rows.map(r => ({ ...r, dl: undefined })) })) };
const LINES = new Map();
for (const r of OLD.areas.flatMap(a => a.rows)) for (const l of r.dl || []) LINES.set(l.id, { id: l.id, name: l.name, status: l.status, nextStep: l.next, remaining: l.remaining || [], brief: l.brief || '' });
for (const l of OLD.other) LINES.set(l.id, { id: l.id, name: l.name, status: l.status, nextStep: l.next === '—' ? '' : l.next, remaining: l.remaining || [] });
const lines = { LINES: [...LINES.values()] };
// the stack: the T layer from the same lists, pillars from entities.json (threads → pillars, S2)
const ENT = require('../entities.json').pillars;
const c = T.collect({ threads });
const tl = T.layer(c.raw, c.built);
const graph = {
  generated: '2026-11-25T12:00:00Z', schema: 2, build: { no: 7, kind: 'full', generated: '2026-11-25T12:00:00Z' },
  nodes: tl.nodes.map(n => ({ id: n.id, layer: 'T', kind: 'todo', title: n.title, brief: n.brief, state: n.state, from: n.extra.sources, labels: n.extra.labels, own: [] }))
    .concat(ENT.map(e => ({ id: 'E:' + e.id, layer: 'E', kind: 'pillar', title: e.name, own: [] }))),
  edges: [], entities: ENT.map(e => ({ ...e, members: [], per: {} })),
};
const data = B.build(graph, threads, lines, { today: '2026-11-25' });
const rows = data.areas.flatMap(a => a.rows);
const byId = new Map(rows.map(r => [r.id, r]));

test('parity: every thread of the old board is a row', () => {
  const old = OLD.areas.flatMap(a => a.rows);
  assert.equal(old.length, 47);
  assert.deepEqual(rows.map(r => r.id).sort(), old.map(r => r.id).sort());
  for (const r of old) assert.equal(byId.get(r.id).n, r.n, r.id + ': its name');
  assert.equal(rows.filter(r => r.pillar).length, 47, 'every thread is a pillar (entities.json, S2)');
});

test('parity: every item of every thread is on its row', () => {
  let n = 0;
  for (const r of OLD.areas.flatMap(a => a.rows)) {
    const row = byId.get(r.id);
    // the same item, or one merged with it (lib/todo.js: the same codes, near-equal words; the node keeps the first wording)
    const dice = (a, b) => { const B = new Set(b); let i = 0; for (const x of a) if (B.has(x)) i++; return 2 * i / (a.length + b.length || 1); };
    const codes = s => (s.match(/[A-Za-z0-9]+/g) || []).filter(x => /\d/.test(x) || /^[A-Z]{2,5}$/.test(x)).map(x => x.toLowerCase()).sort().join(' ');
    const same = (a, b) => a.toLowerCase() === b.toLowerCase() || (codes(a) === codes(b) && dice(T.telling(a), T.telling(b)) >= 0.8);
    for (const t of r.t || []) { n++; assert.ok(row.t.some(x => same(x.l, t.l)), `${r.id}: not-yet "${t.l}"`); }
    for (const d of r.d || []) { n++; assert.ok(row.d.includes(d), `${r.id}: built "${d}"`); }
    for (const b of r.b || []) { n++; assert.ok(row.b.includes(b), `${r.id}: beta "${b}"`); }
    for (const l of r.dl || []) { n++; assert.ok(row.dl.some(x => x.id === l.id && x.name === l.name && x.status === l.status), `${r.id}: line ${l.id}`); }
    assert.equal(row.note, r.note || ''); assert.deepEqual(row.read, r.read || []); assert.equal(row.go, r.go || '');
  }
  assert.ok(n > 400, n + ' items checked');
  // each row knows its thread's own wording of a merged item (the gateway edits by it)
  for (const r of OLD.areas.flatMap(a => a.rows)) for (const t of r.t || []) assert.ok(byId.get(r.id).t.some(x => x.orig === t.l), `${r.id}: "${t.l}" as threads.js writes it`);
  // a merged item (the same open work on two threads) is on both rows
  const dd = rows.filter(r => r.t.some(t => /^desktop dashboard$/i.test(t.l)));
  assert.deepEqual(dd.map(r => r.id).sort(), ['mindmap', 'stack']);
});

test('parity: the board-level notes, the other lines, the areas', () => {
  assert.deepEqual(data.now, OLD.now);
  assert.deepEqual(data.waiting.map(w => w[0]), OLD.waiting.map(w => w[0]));
  assert.deepEqual(data.other.map(l => l.id).sort(), OLD.other.map(l => l.id).sort());
  assert.deepEqual(data.areas.map(a => a.area), OLD.areas.map(a => a.area), 'the areas in the old order (entities.json agrees with threads.js)');
  assert.equal(data.dupes.filter(d => d.field === 'area').length, 0);
});

test('kept twice: an area or a status in threads.js that entities.json or an F row owns is listed, the owner wins', () => {
  const g2 = JSON.parse(JSON.stringify(graph));
  const p = g2.entities.find(e => e.thread === 'sui'); p.area = 'Planner (moved)';
  g2.nodes.push({ id: 'F:kapu', layer: 'F', kind: 'feature', title: 'VRG Kapu', tier: 3, own: [] });
  g2.edges.push(['F:kapu', 'E:kapu', 'pillar', 2]);
  const d2 = B.build(g2, threads, lines, { today: '2026-11-25' });
  const sui = d2.areas.flatMap(a => a.rows).find(r => r.id === 'sui'), kapu = d2.areas.flatMap(a => a.rows).find(r => r.id === 'kapu');
  assert.equal(sui.area, 'Planner (moved)', 'the area from entities.json');
  assert.ok(d2.dupes.some(d => d.thread === 'sui' && d.field === 'area'));
  assert.equal(kapu.status, 'mid'); assert.match(kapu.statusFrom, /F tier 3/);
  assert.ok(d2.dupes.some(d => d.thread === 'kapu' && d.field === 'status' && /F tier 3/.test(d.kept)), 'threads.js s beside an F row');
  const cla = d2.areas.flatMap(a => a.rows).find(r => r.id === 'cla');
  assert.equal(cla.status, 'op', 'a pillar with no F row: its hand status from entities.json');
});

test('the anonymised copy: codes swapped like tools/anonymise.js swaps them', () => {
  const swap = B.swapper({ codes: [{ from: 'ABC12', to: 'JOB1' }], literals: [{ from: 'Kovács utca', to: 'X utca' }] });
  assert.equal(swap('job ABC12 and abc12 at Kovács utca'), 'job JOB1 and job1 at X utca');
  assert.equal(swap('xABC12 ABC123'), 'xABC12 ABC123', 'inside a word or a longer number it stays');
});
