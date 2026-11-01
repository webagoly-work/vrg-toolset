import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDb, memoryAdapter } from '../www/js/core/db.js';
import { checkReading, STATUS } from '../www/js/core/limits.js';
import * as C from '../www/js/core/calc.js';
import { parseNumber } from '../www/js/core/format.js';

const near = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test('db: put, list by collection, undo a delete, erase', async () => {
  let t = 1;
  const db = createDb(memoryAdapter(), () => t++);
  const a = await db.put('job', { name: 'A' });
  await db.put('job', { name: 'B' });
  await db.put('time', { minutes: 5 });
  assert.deepEqual((await db.list('job')).map((r) => r.name), ['A', 'B']);
  const updated = await db.put('job', { ...a, name: 'A2' });
  assert.equal(updated.createdAt, a.createdAt);
  assert.ok(updated.updatedAt > a.updatedAt);
  await db.del('job', a.id);
  assert.equal((await db.list('job')).length, 1);
  await db.restore('job', updated);
  assert.equal((await db.get('job', a.id)).name, 'A2');
  const dump = await db.dump();
  await db.clear();
  assert.equal((await db.exportAll()).length, 0);
  await db.load(dump);
  assert.equal((await db.exportAll()).length, 3);
});

test('limits: no table entry means no verdict', () => {
  assert.equal(checkReading({ zs: 1 }, null).overall, STATUS.NONE);
  assert.equal(checkReading({ zs: 1 }, {}).overall, STATUS.NONE);
});

test('limits: Zs and RCD are upper limits, IR a lower one, the worst wins', () => {
  const limit = { zsMax: '1', irMin: '1', rcdMaxMs: '300' };
  assert.equal(checkReading({ zs: 0.9, ir: 2, rcdMs: 20 }, limit).overall, STATUS.OK);
  assert.equal(checkReading({ zs: 1.2, ir: 2 }, limit).zs, STATUS.FAIL);
  assert.equal(checkReading({ ir: 0.5 }, limit).ir, STATUS.FAIL);
  assert.equal(checkReading({ zs: 0.9, ir: 0.5 }, limit).overall, STATUS.FAIL);
  assert.equal(checkReading({ zs: 1 }, limit).zs, STATUS.OK, 'exactly on the limit is inside');
});

test('limits: amber only appears when the user set a margin', () => {
  assert.equal(checkReading({ zs: 0.95 }, { zsMax: 1 }).zs, STATUS.OK);
  assert.equal(checkReading({ zs: 0.95 }, { zsMax: 1, marginPct: 10 }).zs, STATUS.WARN);
  assert.equal(checkReading({ ir: 1.05 }, { irMin: 1, marginPct: 10 }).ir, STATUS.WARN);
});

test('voltage drop', () => {
  const r = C.voltageDrop({ phases: 1, length: 30, current: 16, area: 2.5, voltage: 230 });
  near(r.volts, 6.857);
  near(r.percent, 2.98);
  near(C.voltageDrop({ phases: 3, length: 50, current: 32, area: 6, voltage: 400, material: 'al' }).volts, 13.2);
});

test('size for drop takes the next standard size', () => {
  const load = { phases: 1, length: 30, current: 16, voltage: 230, maxPercent: 3 };
  assert.equal(C.sizeForDrop(load), 2.5);
  assert.equal(C.sizeForDrop({ ...load, maxPercent: 1 }), 10);
  assert.equal(C.sizeForDrop({ ...load, length: 90000 }), null);
});

test('kW and amps, both ways', () => {
  near(C.ampsFromKw({ kw: 3.68, voltage: 230, phases: 1 }), 16);
  near(C.ampsFromKw({ kw: 11, voltage: 400, phases: 3, cosPhi: 0.85 }), 18.68);
  near(C.kwFromAmps({ amps: 16, voltage: 400, phases: 3 }), 11.09);
});

test('Ohm: any two values', () => {
  near(C.ohm({ u: 230, i: 10 }).r, 23);
  near(C.ohm({ u: 230, r: 23 }).p, 2300);
  near(C.ohm({ r: 4, p: 100 }).u, 20);
  assert.equal(C.ohm({ u: 1 }), null);
});

test('lumen method rounds up', () => {
  const r = C.luminaires({ lux: 500, area: 20, lumens: 3600, utilisation: 0.6, maintenance: 0.8 });
  near(r.exact, 5.79);
  assert.equal(r.count, 6);
});

test('phase balance', () => {
  const r = C.phaseBalance({ l1: 10, l2: 10, l3: 16 });
  near(r.mean, 12);
  near(r.imbalance, 33.33);
  assert.equal(r.heaviest, 3);
  assert.equal(C.phaseBalance({ l1: 0, l2: 0, l3: 0 }).imbalance, 0);
});

test('LED sizing', () => {
  const r = C.ledSizing({ wattsPerMetre: 10, metres: 5, voltage: 24, reservePct: 20 });
  assert.equal(r.watts, 50);
  near(r.amps, 2.08);
  assert.equal(r.supplyWatts, 60);
});

test('typed numbers take a comma or a point', () => {
  assert.equal(parseNumber('0,38'), 0.38);
  assert.equal(parseNumber(' 1.5 '), 1.5);
  assert.equal(parseNumber(''), null);
  assert.equal(parseNumber('abc'), null);
});
