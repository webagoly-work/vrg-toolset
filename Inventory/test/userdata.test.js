import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

import { createStorage, createAutosave } from '../src/core/persistence.js';
import {
  createUserData, sanitize, mergeItem, emptyDoc, USERDATA_SCHEMA, MARKS
} from '../src/core/userdata.js';
import { createStore } from '../src/core/store.js';

const ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const raw = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'vrg-inventory.json'), 'utf8'));

/** A localStorage stand-in whose failure modes we can switch on. */
function fakeStorage(opts) {
  const map = new Map();
  const o = opts || {};
  return {
    get length() { return map.size; },
    key: i => [...map.keys()][i],
    getItem: k => { if (o.throwOnRead) throw new Error('read blocked'); return map.has(k) ? map.get(k) : null; },
    setItem: (k, v) => {
      if (o.throwOnWrite) { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; }
      map.set(k, v);
    },
    removeItem: k => { map.delete(k); },
    _map: map
  };
}

// ------------------------------------------------------------- persistence
test('storage round-trips values under a namespace', () => {
  const backend = fakeStorage();
  const s = createStorage({ storage: backend });
  assert.equal(s.available, true);
  assert.deepEqual(s.write('ui', { a: 1 }).ok, true);
  assert.deepEqual(s.read('ui'), { a: 1 });
  assert.deepEqual(s.keys(), ['ui']);
  assert.ok([...backend._map.keys()][0].startsWith('vrg.inventory.'), 'keys are namespaced');
  s.remove('ui');
  assert.equal(s.read('ui'), null);
});

test('a missing key returns the fallback, not a crash', () => {
  const s = createStorage({ storage: fakeStorage() });
  assert.deepEqual(s.read('nincs', { d: true }), { d: true });
});

test('unavailable storage degrades instead of throwing', () => {
  const s = createStorage({ storage: null });
  assert.equal(s.available, false);
  assert.deepEqual(s.read('ui', 'fallback'), 'fallback');
  assert.deepEqual(s.write('ui', { a: 1 }), { ok: false, reason: 'unavailable' });
  assert.deepEqual(s.keys(), []);
  assert.doesNotThrow(() => s.clearAll());
});

test('a full quota is reported, not thrown', () => {
  const errors = [];
  const s = createStorage({ storage: fakeStorage({ throwOnWrite: true }), onError: e => errors.push(e) });
  const r = s.write('ui', { a: 1 });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'quota');
  assert.equal(errors[0].quota, true);
});

test('a corrupt value is quarantined, not silently destroyed', () => {
  const backend = fakeStorage();
  backend.setItem('vrg.inventory.userdata', '{ this is not json');
  const errors = [];
  const s = createStorage({ storage: backend, onError: e => errors.push(e) });

  assert.equal(s.read('userdata'), null, 'a corrupt value reads as absent');
  assert.equal(errors[0].op, 'parse');
  const kept = s.keys().filter(k => k.startsWith('userdata.corrupt.'));
  assert.equal(kept.length, 1, 'the unreadable text is kept under a .corrupt key');
  assert.equal(backend._map.get('vrg.inventory.' + kept[0]), '{ this is not json');
});

test('autosave coalesces writes and flush never loses the last one', async () => {
  const backend = fakeStorage();
  const s = createStorage({ storage: backend });
  let state = { n: 0 };
  const saves = [];
  const auto = createAutosave(s, 'ui', () => state, { delay: 5, onSave: r => saves.push(r) });

  state = { n: 1 }; auto.schedule();
  state = { n: 2 }; auto.schedule();
  state = { n: 3 }; auto.schedule();
  assert.equal(saves.length, 0, 'nothing written yet');
  await new Promise(r => setTimeout(r, 25));
  assert.equal(saves.length, 1, 'three changes, one write');
  assert.deepEqual(s.read('ui'), { n: 3 });

  state = { n: 4 }; auto.schedule();
  auto.flush();
  assert.deepEqual(s.read('ui'), { n: 4 }, 'flush writes immediately');
  assert.equal(auto.flush(), null, 'flushing with nothing pending is a no-op');
});

// ---------------------------------------------------------------- userdata
test('userdata stores own fields and drops them when emptied', () => {
  const ud = createUserData();
  ud.set('VRG-0001', 'megjegyzes', 'mindig ebből rendelünk');
  ud.set('VRG-0001', 'kedvenc', true);
  assert.deepEqual(ud.record('VRG-0001'), { megjegyzes: 'mindig ebből rendelünk', kedvenc: true });

  ud.set('VRG-0001', 'kedvenc', false);
  assert.deepEqual(ud.record('VRG-0001'), { megjegyzes: 'mindig ebből rendelünk' });
  ud.set('VRG-0001', 'megjegyzes', '');
  assert.equal(ud.record('VRG-0001'), null, 'an item with nothing left is removed entirely');
});

test('userdata refuses to store a field that is not user-owned', () => {
  const ud = createUserData();
  assert.throws(() => ud.set('VRG-0001', 'becsult_ar', 1), /not user-owned/);
  assert.throws(() => ud.set('VRG-0001', 'vrg_id', 'VRG-9999'), /not user-owned/);
});

test('userdata change listeners fire and can be removed', () => {
  const ud = createUserData();
  let n = 0;
  const off = ud.onChange(() => n++);
  ud.set('VRG-0001', 'kedvenc', true);
  assert.equal(n, 1);
  off();
  ud.set('VRG-0001', 'kedvenc', false);
  assert.equal(n, 1);
});

test('mergeItem overlays overrides without mutating the catalogue item', () => {
  const base = Object.freeze({
    vrg_id: 'VRG-0001', megnevezes: 'Teszt', tomeg_kg: null,
    kategoria: Object.freeze({ fo: null, al: null, ut: null })
  });
  const merged = mergeItem(base, { tomeg_kg: 0.25, megjegyzes: 'jegyzet', kedvenc: true });

  assert.equal(merged.tomeg_kg, 0.25);
  assert.deepEqual(merged.user, { megjegyzes: 'jegyzet', kedvenc: true });
  assert.deepEqual(merged.overridden, ['tomeg_kg']);
  assert.equal(base.tomeg_kg, null, 'the base item is untouched');
  assert.equal(base.user, undefined);
});

test('a category override merges over the official one field by field', () => {
  const base = { vrg_id: 'VRG-0001', kategoria: { fo: null, al: null, ut: null } };
  const merged = mergeItem(base, { kategoria: { fo: 'Installáció technika' } });
  assert.equal(merged.kategoria.fo, 'Installáció technika');
  assert.equal(merged.kategoria.al, null);
  assert.deepEqual(merged.overridden, ['kategoria']);
});

// ------------------------------------------------------------------ import
test('import rejects a file that is not a userdata document', () => {
  assert.throws(() => sanitize({ schema: 'vrg-inventory', items: [] }), /Nem saját-adat fájl/);
  assert.throws(() => sanitize('szöveg'), /nem érvényes JSON objektum/);
});

test('import drops fields that are not user-owned', () => {
  const doc = emptyDoc();
  doc.items['VRG-0001'] = {
    megjegyzes: 'ok', kedvenc: true,
    becsult_ar: { netto_huf: 1 },          // must not survive
    vrg_id: 'VRG-9999',                     // must not survive
    vendors: { daniella: { netto_egysegar_huf: 0 } }
  };
  const { doc: clean } = sanitize(doc);
  assert.deepEqual(clean.items['VRG-0001'], { megjegyzes: 'ok', kedvenc: true });
});

test('import warns about items this catalogue does not have', () => {
  const doc = emptyDoc();
  doc.items['VRG-0001'] = { kedvenc: true };
  doc.items['VRG-9999'] = { kedvenc: true };
  const { doc: clean, warnings } = sanitize(doc, id => id === 'VRG-0001');
  assert.deepEqual(Object.keys(clean.items), ['VRG-0001']);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /1 tétel/);
});

test('import sanitises bad values rather than trusting them', () => {
  const doc = emptyDoc();
  doc.items['VRG-0001'] = { jeloles: 'rózsaszín', tomeg_kg: 'nehéz', kedvenc: 'igen' };
  doc.items['VRG-0002'] = { jeloles: MARKS[0], tomeg_kg: '0.5' };
  const { doc: clean } = sanitize(doc);
  assert.equal(clean.items['VRG-0001'].jeloles, undefined, 'unknown mark dropped');
  assert.equal(clean.items['VRG-0001'].tomeg_kg, undefined, 'non-numeric weight dropped');
  assert.equal(clean.items['VRG-0001'].kedvenc, true, 'truthy coerced to boolean');
  assert.equal(clean.items['VRG-0002'].tomeg_kg, 0.5, 'numeric string coerced');
});

// -------------------------------------------------- the round-trip promise
test('export from one copy, import into another, identical state', () => {
  // copy A: the user works
  const storeA = createStore(raw());
  const udA = createUserData();
  storeA.setUserData(udA);
  const id = storeA.items[10].vrg_id;
  udA.set(id, 'megjegyzes', 'ebből mindig 100-at');
  udA.set(id, 'kedvenc', true);
  udA.set(id, 'jeloles', 'zold');
  udA.set(id, 'tomeg_kg', 0.125);
  udA.set(storeA.items[20].vrg_id, 'kedvenc', true);
  udA.setUi('columns', { order: ['vrg_id', 'megnevezes'], visible: ['vrg_id'] });
  storeA.remergeAll();

  // the file that travels
  const file = JSON.parse(JSON.stringify(udA.serialize()));
  assert.equal(file.schema, USERDATA_SCHEMA);

  // copy B: a fresh catalogue, nothing stored
  const storeB = createStore(raw());
  const { doc, warnings } = sanitize(file, x => !!storeB.get(x));
  assert.deepEqual(warnings, []);
  const udB = createUserData(doc);
  storeB.setUserData(udB);

  // import rebuilds each record in a canonical field order, so the documents are
  // deep-equal but not byte-equal — compare values, never the serialised string
  assert.deepEqual(udB.serialize().items, udA.serialize().items);
  assert.deepEqual(udB.stats(), udA.stats());
  assert.deepEqual(udB.ui('columns'), { order: ['vrg_id', 'megnevezes'], visible: ['vrg_id'] });

  const a = storeA.get(id), b = storeB.get(id);
  assert.deepEqual(b.user, a.user);
  assert.equal(b.tomeg_kg, 0.125);
  assert.deepEqual(b.overridden, ['tomeg_kg']);
  assert.equal(storeB.query({ kedvenc: true }).length, 2);
  assert.deepEqual(
    storeB.query({ kedvenc: true }).map(i => i.vrg_id),
    storeA.query({ kedvenc: true }).map(i => i.vrg_id)
  );
});

test('a data rebuild keeps user values and does not write them back into the catalogue', () => {
  const store = createStore(raw());
  const ud = createUserData();
  store.setUserData(ud);
  const id = 'VRG-0001';
  const published = raw().items.find(i => i.vrg_id === id).tomeg_kg;
  const mine = (published || 0) + 99;
  ud.set(id, 'tomeg_kg', mine);
  ud.set(id, 'megjegyzes', 'saját');
  store.remerge(id);

  assert.equal(store.get(id).tomeg_kg, mine, 'the merged view shows my value');
  // the published snapshot on disk must still hold the vendor's value
  assert.equal(raw().items.find(i => i.vrg_id === id).tomeg_kg, published,
    'the catalogue file is never written to');
  assert.equal(store.doc.items.find(i => i.vrg_id === id).tomeg_kg, published,
    'the in-memory base item is never written to either');
});

test('user notes are searchable, favourites are filterable', () => {
  const store = createStore(raw());
  const ud = createUserData();
  store.setUserData(ud);
  const id = store.items[5].vrg_id;
  ud.set(id, 'megjegyzes', 'Hetényi projekthez kell');
  ud.set(id, 'kedvenc', true);
  store.remerge(id);

  assert.deepEqual(store.query({ text: 'hetenyi' }).map(i => i.vrg_id), [id], 'accent-insensitive note search');
  assert.deepEqual(store.query({ kedvenc: true }).map(i => i.vrg_id), [id]);
  assert.deepEqual(store.query({ megjegyzessel: true }).map(i => i.vrg_id), [id]);
});

test('an override changes the gap statistics and the missing-data filter', () => {
  const store = createStore(raw());
  const ud = createUserData();
  store.setUserData(ud);
  const before = store.stats().tomeggel;
  const missingBefore = store.query({ missing: 'tomeg' }).length;
  // pick an item the vendor has no weight for, so the count really moves
  const target = store.items.find(i => i.tomeg_kg == null).vrg_id;

  ud.set(target, 'tomeg_kg', 1.2);
  store.remerge(target);

  assert.equal(store.stats().tomeggel, before + 1);
  assert.equal(store.query({ missing: 'tomeg' }).length, missingBefore - 1);
});

test('a category the user fills in wins over the AI suggestion', () => {
  const store = createStore(raw());
  const ud = createUserData();
  store.setUserData(ud);
  const before = store.stats().hivatalos_kategoria.done;
  const target = store.items.find(i => !i.kategoria.al).vrg_id;

  ud.set(target, 'kategoria', { fo: 'Világítás', al: 'Fényforrások', ut: '/Fényforrások/Világítás/' });
  store.remerge(target);

  assert.equal(store.stats().hivatalos_kategoria.done, before + 1);
  assert.equal(store.get(target).kategoria.al, 'Fényforrások');
});

test('the user can correct a category the vendor already supplied', () => {
  const store = createStore(raw());
  const ud = createUserData();
  store.setUserData(ud);
  const it = store.items.find(i => i.kategoria.al);
  const vendorSaid = it.kategoria.al;

  ud.set(it.vrg_id, 'kategoria', { al: 'Saját besorolás' });
  store.remerge(it.vrg_id);

  const merged = store.get(it.vrg_id);
  assert.equal(merged.kategoria.al, 'Saját besorolás');
  assert.equal(merged.kategoria.fo, it.kategoria.fo, 'untouched parts of the category survive');
  assert.deepEqual(merged.overridden, ['kategoria']);
  assert.equal(raw().items.find(i => i.vrg_id === it.vrg_id).kategoria.al, vendorSaid,
    'the published catalogue is unchanged');
});
