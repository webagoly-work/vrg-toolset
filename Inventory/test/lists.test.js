import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

import { createStore } from '../src/core/store.js';
import { createUserData, sanitize, emptyDoc, USERDATA_VERSION } from '../src/core/userdata.js';
import { createLists } from '../src/core/lists.js';

const ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const raw = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'vrg-inventory.json'), 'utf8'));

function setup() {
  const store = createStore(raw());
  const userdata = createUserData();
  store.setUserData(userdata);
  const lists = createLists({ userdata, store });
  return { store, userdata, lists };
}

// ------------------------------------------------------------- list basics
test('creating a list makes it active and gives it an id', () => {
  const { lists } = setup();
  const l = lists.create('Hetényi');
  assert.equal(l.nev, 'Hetényi');
  assert.equal(lists.activeId(), l.id);
  assert.equal(lists.all().length, 1);
  assert.equal(lists.get(l.id).sorok && Object.keys(lists.get(l.id).sorok).length, 0);
});

test('an unnamed list still gets a name', () => {
  const { lists } = setup();
  assert.equal(lists.create('   ').nev, 'Új lista');
});

test('several lists coexist and only one is active', () => {
  const { lists } = setup();
  const a = lists.create('A');
  const b = lists.create('B');
  assert.equal(lists.activeId(), b.id);
  lists.setActive(a.id);
  assert.equal(lists.active().nev, 'A');
  assert.equal(lists.setActive('nincs-ilyen'), false, 'an unknown list cannot be activated');
  assert.equal(lists.activeId(), a.id);
});

test('deleting the active list falls back to another, never to a dangling id', () => {
  const { lists } = setup();
  const a = lists.create('A');
  const b = lists.create('B');
  lists.remove(b.id);
  assert.equal(lists.activeId(), a.id);
  lists.remove(a.id);
  assert.equal(lists.activeId(), null);
  assert.equal(lists.active(), null);
});

test('renaming rejects an empty name', () => {
  const { lists } = setup();
  const l = lists.create('Eredeti');
  assert.equal(lists.rename(l.id, '   '), false);
  assert.equal(lists.get(l.id).nev, 'Eredeti');
});

// ------------------------------------------------------------------ lines
test('quantities add up and zero removes the line', () => {
  const { store, lists } = setup();
  const id = store.items[0].vrg_id;
  lists.create('L');
  lists.add(id);
  lists.add(id, 4);
  assert.equal(lists.qty(id), 5);
  lists.setQty(id, 0);
  assert.equal(lists.qty(id), 0);
  assert.equal(lists.rows().length, 0);
});

test('a negative or non-numeric quantity removes the line rather than corrupting it', () => {
  const { store, lists } = setup();
  const id = store.items[0].vrg_id;
  lists.create('L');
  lists.setQty(id, 3);
  lists.setQty(id, -2);
  assert.equal(lists.qty(id), 0);
  lists.setQty(id, 3);
  lists.setQty(id, 'sok');
  assert.equal(lists.qty(id), 0);
});

test('an item that is not in the catalogue cannot be added', () => {
  const { lists } = setup();
  lists.create('L');
  assert.equal(lists.setQty('VRG-9999', 5), false);
  assert.equal(lists.rows().length, 0);
});

test('adding to a list when none exists is refused, not silently dropped', () => {
  const { store, lists } = setup();
  assert.equal(lists.add(store.items[0].vrg_id, 1), false);
  assert.equal(lists.activeId(), null);
});

test('line notes attach to a line and vanish with it', () => {
  const { store, lists } = setup();
  const id = store.items[0].vrg_id;
  lists.create('L');
  assert.equal(lists.setLineNote(id, 'a pincébe'), false, 'no line yet');
  lists.add(id, 2);
  lists.setLineNote(id, 'a pincébe');
  assert.equal(lists.rows()[0].megjegyzes, 'a pincébe');
  lists.setQty(id, 0);
  lists.add(id, 1);
  assert.equal(lists.rows()[0].megjegyzes, '', 'a removed line does not resurrect its note');
});

// --------------------------------------------------------------- resolving
test('rows resolve against the catalogue and price with the neutral estimate', () => {
  const { store, lists } = setup();
  const item = store.items.find(i => i.becsult_ar.netto_huf != null);
  lists.create('L');
  lists.setQty(item.vrg_id, 3);

  const r = lists.rows()[0];
  assert.equal(r.item.vrg_id, item.vrg_id);
  assert.equal(r.egysegar_forras, 'becsles');
  assert.equal(r.egysegar, item.becsult_ar.netto_huf);
  assert.equal(r.sor_netto, Math.round(item.becsult_ar.netto_huf * 3 * 100) / 100);
});

test('selecting a vendor re-prices the same list without changing it', () => {
  const { store, lists } = setup();
  const item = store.items.find(i => i.vendors.daniella.netto_egysegar_huf != null);
  lists.create('L');
  lists.setQty(item.vrg_id, 2);

  const before = lists.rows()[0];
  assert.equal(before.egysegar_forras, 'becsles');

  store.vendors.select('daniella');
  const after = lists.rows()[0];
  assert.equal(after.egysegar_forras, 'vendor');
  assert.equal(after.egysegar, item.vendors.daniella.netto_egysegar_huf);
  assert.equal(after.mennyiseg, before.mennyiseg, 'the stored list is untouched');
});

test('a list stores ids and quantities only — no names, no prices', () => {
  const { store, userdata, lists } = setup();
  const item = store.items[3];
  lists.create('L');
  lists.setQty(item.vrg_id, 7);
  const stored = userdata.serialize().lists[lists.activeId()].sorok[item.vrg_id];
  assert.deepEqual(stored, { mennyiseg: 7 });
});

test('an item missing from the catalogue is reported, not dropped', () => {
  const { store, userdata, lists } = setup();
  lists.create('L');
  lists.setQty(store.items[0].vrg_id, 1);
  // simulate a catalogue rebuild that removed an item the list references
  userdata.mutate(d => { d.lists[lists.activeId()].sorok['VRG-8888'] = { mennyiseg: 4 }; });

  const rows = lists.rows();
  assert.equal(rows.length, 2);
  const ghost = rows.find(r => r.vrg_id === 'VRG-8888');
  assert.equal(ghost.hianyzo, true);
  assert.equal(ghost.item, null);
  assert.equal(lists.totals().hianyzo_tetel, 1);
});

// ----------------------------------------------------------------- totals
test('totals sum the lines and count what cannot be priced', () => {
  const { store, lists } = setup();
  const priced = store.items.filter(i => i.becsult_ar.netto_huf != null).slice(0, 3);
  const unpriced = store.items.find(i => i.becsult_ar.netto_huf == null);
  lists.create('L');
  for (const it of priced) lists.setQty(it.vrg_id, 2);
  lists.setQty(unpriced.vrg_id, 5);

  const t = lists.totals();
  const expected = Math.round(priced.reduce((a, i) => a + i.becsult_ar.netto_huf * 2, 0) * 100) / 100;
  assert.equal(t.sorok, 4);
  assert.equal(t.osszes_mennyiseg, 11);
  assert.equal(t.netto, expected);
  assert.equal(t.brutto, Math.round(expected * 1.27));
  assert.equal(t.ar_nelkul, 1);
});

test('an empty list totals to zero rather than NaN', () => {
  const { lists } = setup();
  lists.create('L');
  const t = lists.totals();
  assert.equal(t.sorok, 0);
  assert.equal(t.netto, 0);
  assert.equal(t.brutto, 0);
});

// -------------------------------------------------------------- pack sizes
test('pack-size warnings only appear once a vendor is selected', () => {
  const { store, lists } = setup();
  const item = store.items.find(i => (i.vendors.daniella.kiszereles_mennyiseg || 0) > 1);
  const pack = item.vendors.daniella.kiszereles_mennyiseg;
  lists.create('L');
  lists.setQty(item.vrg_id, pack + 1);

  // neutral mode knows nothing about the vendor's packaging, so it must not warn
  assert.equal(lists.rows()[0].csomag_mennyiseg, null);
  assert.equal(lists.rows()[0].csomag_ok, true);
  assert.equal(lists.totals().csomag_figyelmeztetes, 0);

  store.vendors.select('daniella');
  assert.equal(lists.rows()[0].csomag_mennyiseg, pack);
  assert.equal(lists.rows()[0].csomag_ok, false);
  assert.equal(lists.totals().csomag_figyelmeztetes, 1);

  lists.setQty(item.vrg_id, pack * 2);
  assert.equal(lists.rows()[0].csomag_ok, true);
  assert.equal(lists.totals().csomag_figyelmeztetes, 0);
});

// ----------------------------------------------------- duplicate and merge
test('duplicating copies the lines but not the identity', () => {
  const { store, lists } = setup();
  const id = store.items[0].vrg_id;
  const a = lists.create('Eredeti');
  lists.setQty(id, 3);
  const copy = lists.duplicate(a.id);

  assert.notEqual(copy.id, a.id);
  assert.equal(copy.nev, 'Eredeti (másolat)');
  assert.equal(lists.qty(id, copy.id), 3);
  lists.setQty(id, 9, copy.id);
  assert.equal(lists.qty(id, a.id), 3, 'the original is independent');
});

test('merging adds quantities for shared items and copies the rest', () => {
  const { store, lists } = setup();
  const [x, y, z] = store.items.slice(0, 3).map(i => i.vrg_id);
  const a = lists.create('A');
  lists.setQty(x, 2, a.id);
  lists.setQty(y, 1, a.id);
  const b = lists.create('B');
  lists.setQty(y, 4, b.id);
  lists.setQty(z, 5, b.id);

  const r = lists.merge(a.id, b.id);
  assert.deepEqual(r, { added: 1, summed: 1 });
  assert.equal(lists.qty(x, a.id), 2);
  assert.equal(lists.qty(y, a.id), 5);
  assert.equal(lists.qty(z, a.id), 5);
  assert.equal(lists.qty(y, b.id), 4, 'the source list is left alone');
});

test('a list cannot be merged into itself', () => {
  const { lists } = setup();
  const a = lists.create('A');
  assert.equal(lists.merge(a.id, a.id), null);
});

// --------------------------------------------------------- persistence
test('lists survive a save/load round-trip through the userdata document', () => {
  const { store, userdata, lists } = setup();
  const ids = store.items.slice(0, 30).map(i => i.vrg_id);
  const l = lists.create('Nagy lista');
  ids.forEach((id, i) => lists.setQty(id, i + 1));
  lists.setListNote(l.id, 'Peterdy 33');
  lists.setLineNote(ids[0], 'sürgős');
  assert.equal(lists.rows().length, 30);
  const totalsBefore = lists.totals();

  // reload: a fresh store and userdata built from the serialised document
  const file = JSON.parse(JSON.stringify(userdata.serialize()));
  const store2 = createStore(raw());
  const { doc, warnings } = sanitize(file, id => !!store2.get(id));
  assert.deepEqual(warnings, []);
  const ud2 = createUserData(doc);
  store2.setUserData(ud2);
  const lists2 = createLists({ userdata: ud2, store: store2 });

  assert.equal(lists2.all().length, 1);
  assert.equal(lists2.activeId(), l.id);
  assert.equal(lists2.active().nev, 'Nagy lista');
  assert.equal(lists2.active().megjegyzes, 'Peterdy 33');
  assert.equal(lists2.rows().length, 30);
  assert.deepEqual(lists2.totals(), totalsBefore);
  assert.equal(lists2.rows().find(r => r.vrg_id === ids[0]).megjegyzes, 'sürgős');
});

test('a userdata document written before Phase 4 migrates instead of failing', () => {
  const old = {
    schema: 'vrg-userdata', schema_version: '1.0.0',
    created: '2026-09-19T00:00:00.000Z', updated: '2026-09-19T00:00:00.000Z',
    items: { 'VRG-0001': { kedvenc: true } }, ui: {}
  };
  const ud = createUserData(old);
  assert.equal(ud.doc.schema_version, USERDATA_VERSION);
  assert.deepEqual(ud.doc.lists, {});
  assert.equal(ud.doc.activeList, null);
  assert.deepEqual(ud.doc.items['VRG-0001'], { kedvenc: true }, 'existing data is carried over');
});

test('import rejects junk lines rather than trusting the file', () => {
  const doc = emptyDoc();
  doc.lists['l1'] = {
    id: 'l1', nev: '  ', megjegyzes: 'x',
    sorok: {
      'VRG-0001': { mennyiseg: 3 },
      'VRG-0002': { mennyiseg: 0 },          // dropped: not a quantity
      'VRG-0003': { mennyiseg: 'sok' },      // dropped: not a number
      'VRG-9999': { mennyiseg: 2 }           // dropped: unknown item
    }
  };
  doc.activeList = 'nincs-ilyen';
  const known = new Set(['VRG-0001', 'VRG-0002', 'VRG-0003']);
  const { doc: clean, warnings } = sanitize(doc, id => known.has(id));

  assert.deepEqual(Object.keys(clean.lists.l1.sorok), ['VRG-0001']);
  assert.equal(clean.lists.l1.nev, 'Névtelen lista', 'a blank name is replaced');
  assert.equal(clean.activeList, 'l1', 'a dangling active id is repaired');
  assert.ok(warnings.some(w => /listasort/.test(w)));
});

test('list quantities cannot be smuggled in as item overrides', () => {
  const doc = emptyDoc();
  doc.items['VRG-0001'] = { mennyiseg: 99, becsult_ar: { netto_huf: 0 } };
  const { doc: clean } = sanitize(doc);
  assert.equal(clean.items['VRG-0001'], undefined);
});
