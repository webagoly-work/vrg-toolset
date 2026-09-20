import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

import {
  SCHEMA_VERSION, FIELDS, field, get, value, validateDocument, migrate
} from '../src/core/schema.js';

const ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const doc = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'vrg-inventory.json'), 'utf8'));

test('the published snapshot validates against the schema', () => {
  const errors = validateDocument(doc);
  assert.deepEqual(errors, [], errors.slice(0, 5).join('\n'));
});

test('every vrg_id is unique and well formed', () => {
  const ids = doc.items.map(i => i.vrg_id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^VRG-\d{4}$/);
});

test('every legacy_id still resolves to exactly one item', () => {
  const legacy = doc.items.map(i => i.legacy_id);
  assert.equal(new Set(legacy).size, legacy.length);
  assert.ok(legacy.every(Boolean));
});

test('field keys are unique and every path is reachable', () => {
  const keys = FIELDS.map(f => f.key);
  assert.equal(new Set(keys).size, keys.length);
  const item = doc.items[0];
  for (const f of FIELDS) {
    if (f.vendor) continue;
    assert.doesNotThrow(() => get(item, f.path), f.key);
  }
});

test('vendor fields cannot be read without the gate', () => {
  assert.throws(() => get(doc.items[0], 'vendors.daniella.netto_egysegar_huf'), /core\/vendors\.js/);
  assert.throws(() => value(doc.items[0], 'v_netto'), /core\/vendors\.js/);
});

test('field() rejects unknown keys', () => {
  assert.throws(() => field('nincs_ilyen'), /unknown field/);
});

test('validateItem catches a bad type and a missing required field', () => {
  const bad = {
    schema: 'vrg-inventory', schema_version: SCHEMA_VERSION,
    items: [{ vrg_id: 'VRG-0001', megnevezes: 42, tomeg_kg: 'nehéz', egyseg: 'zsák' }]
  };
  const errors = validateDocument(bad);
  assert.ok(errors.some(e => /megnevezes is not a valid string/.test(e)));
  assert.ok(errors.some(e => /tomeg_kg is not a valid number/.test(e)));
  assert.ok(errors.some(e => /egyseg is not a valid enum/.test(e)));
});

test('migration 1.0.0 -> 2.0.0 moves the old key to legacy_id', () => {
  const v1 = {
    schema: 'vrg-inventory', schema_version: '1.0.0',
    items: [{ id: 'OBO2000378', megnevezes: 'Kötődoboz' }]
  };
  const v2 = migrate(v1, { idMap: { OBO2000378: 'VRG-0100' } });
  assert.equal(v2.schema_version, SCHEMA_VERSION);
  assert.equal(v2.items[0].vrg_id, 'VRG-0100');
  assert.equal(v2.items[0].legacy_id, 'OBO2000378');
  assert.equal(v2.items[0].id, undefined);
  assert.equal(v1.items[0].id, 'OBO2000378', 'migrate must not mutate its input');
});

test('migration without an id map still produces a resolvable id', () => {
  const v2 = migrate({ schema: 'vrg-inventory', schema_version: '1.0.0', items: [{ id: 'X1' }] });
  assert.equal(v2.items[0].vrg_id, 'VRG-LEGACY-X1');
});

test('an unknown schema_version fails loudly', () => {
  assert.throws(() => migrate({ schema: 'vrg-inventory', schema_version: '0.1.0', items: [] }),
    /no migration path/);
});
