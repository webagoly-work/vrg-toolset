import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

import { createStore } from '../src/core/store.js';
import * as categories from '../src/core/categories.js';

const ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const raw = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'vrg-inventory.json'), 'utf8'));

test('store loads the snapshot and indexes it', () => {
  const s = createStore(raw());
  assert.equal(s.items.length, 221);
  assert.ok(s.get('VRG-0001'));
  assert.equal(s.get('VRG-0001').vrg_id, 'VRG-0001');
  assert.equal(s.get('nincs-ilyen'), null);
  assert.equal(s.getByLegacy('OBO2000378').megnevezes.includes('Kötődoboz'), true);
});

test('search is accent-insensitive and matches every identifier', () => {
  const s = createStore(raw());
  assert.ok(s.query({ text: 'kotodoboz' }).length > 0, 'accent-insensitive');
  assert.ok(s.query({ text: 'KÖTŐDOBOZ' }).length > 0, 'case-insensitive');
  const one = s.get('VRG-0001');
  assert.deepEqual(s.query({ text: one.vrg_id }).map(i => i.vrg_id), [one.vrg_id]);
  assert.deepEqual(s.query({ text: one.legacy_id }).map(i => i.vrg_id), [one.vrg_id]);
});

test('search terms are combined with AND', () => {
  const s = createStore(raw());
  const both = s.query({ text: 'legrand keret' });
  assert.ok(both.length > 0);
  assert.ok(both.every(i => /legrand/i.test(i.marka_gyarto + ' ' + i.megnevezes)));
});

test('filters and sorts behave', () => {
  const s = createStore(raw());
  assert.ok(s.query({ brand: 'WAGO' }).every(i => i.marka_gyarto === 'WAGO'));
  assert.ok(s.query({ hasPrice: false }).every(i => i.becsult_ar.netto_huf == null));
  assert.equal(s.query({ hasPrice: true }).length + s.query({ hasPrice: false }).length, s.items.length);

  const byPrice = s.query({ sort: 'ar', hasPrice: true });
  for (let i = 1; i < byPrice.length; i++) {
    assert.ok(byPrice[i - 1].becsult_ar.netto_huf <= byPrice[i].becsult_ar.netto_huf);
  }
  const desc = s.query({ sort: 'ar', hasPrice: true, desc: true });
  assert.equal(desc[0].vrg_id, byPrice[byPrice.length - 1].vrg_id);
  assert.equal(s.query({ limit: 5 }).length, 5);
});

test('unknown missing-filter fails loudly instead of returning everything', () => {
  const s = createStore(raw());
  assert.throws(() => s.query({ missing: 'nincs_ilyen' }), /unknown missing-filter/);
});

test('vendor gate hides everything until a vendor is selected', () => {
  const s = createStore(raw());
  const it = s.getByLegacy('OBO2000378');

  assert.equal(s.vendors.selectedId(), null);
  assert.equal(s.vendors.read(it, 'v_netto'), null);
  assert.equal(s.vendors.block(it), null);
  assert.deepEqual(s.vendors.carriedBy(it), ['daniella']);

  s.vendors.select('daniella');
  assert.equal(s.vendors.read(it, 'v_cikkszam'), 'OBO2000378');
  assert.equal(typeof s.vendors.read(it, 'v_netto'), 'number');
  assert.ok(s.vendors.block(it));

  s.vendors.select(null);
  assert.equal(s.vendors.read(it, 'v_netto'), null, 'deselecting must hide it again');
});

test('vendor gate rejects unknown vendors and non-vendor fields', () => {
  const s = createStore(raw());
  assert.throws(() => s.vendors.select('rexel'), /unknown vendor/);
  assert.throws(() => s.vendors.read(s.get('VRG-0001'), 'megnevezes'), /not a vendor field/);
});

test('categories: official wins over the AI suggestion', () => {
  const plain = { kategoria_javaslat: { fo: 'A', al: 'B' } };
  assert.deepEqual(categories.resolve(plain), { fo: 'A', al: 'B', ut: null, official: false });

  const official = { kategoria: { fo: 'X', al: 'Y', ut: '/Y/X/' }, kategoria_javaslat: { fo: 'A', al: 'B' } };
  const r = categories.resolve(official);
  assert.equal(r.official, true);
  assert.equal(r.al, 'Y');
});

test('categories: DANIELLA paths are leaf-most-first', () => {
  const p = categories.parsePath('/Szerelvény- és kötődobozok/Installáció technika/');
  assert.deepEqual(p.segments, ['Szerelvény- és kötődobozok', 'Installáció technika']);
  assert.equal(p.fo, 'Installáció technika');
  assert.equal(categories.formatPath(p.segments), '/Szerelvény- és kötődobozok/Installáció technika/');
});

test('category tree covers every item exactly once', () => {
  const s = createStore(raw());
  const total = s.tree.reduce((a, t) => a + t.count, 0);
  assert.equal(total, s.items.length);
  for (const t of s.tree) {
    assert.equal(t.children.reduce((a, c) => a + c.count, 0), t.count);
  }
});

test('stats match the enriched snapshot', () => {
  const st = createStore(raw()).stats();
  assert.equal(st.items, 221);
  assert.equal(st.arral, 210, 'price observed in an order document');
  assert.equal(st.listaarral, 43, 'list price + discount, only from the PDF confirmation');
  assert.equal(st.markaval, 221, 'brand: derived, or stated by the vendor');
  // Phase 6 collected these from the vendor catalogue
  assert.equal(st.hivatalos_kategoria.done, 216, 'official category');
  assert.equal(st.tomeggel, 214, 'weight');
  assert.equal(st.gyartoi_linkkel, 164, 'manufacturer datasheet');
});

test('the five items left without an official category are the promotional ones', () => {
  const store = createStore(raw());
  const left = store.items.filter(i => !i.kategoria.al).map(i => i.legacy_id).sort();
  assert.deepEqual(left, ['DEL038', 'DEL1714', 'DEL1745', 'GIP00010', 'STI1628'],
    'a merchandising bucket is never recorded as a category');
  for (const it of store.items) {
    if (!it.kategoria.al) continue;
    assert.ok(!/^(Akciós termékek|Egyéb)$/.test(it.kategoria.fo), it.vrg_id + ' kept a promo root');
  }
});

test('every official category records where it came from', () => {
  const store = createStore(raw());
  for (const it of store.items) {
    if (!it.kategoria.al) continue;
    assert.match(it.kategoria.forras, /^daniella-webshop/, it.vrg_id);
    assert.ok(it.kategoria.fo, it.vrg_id + ' has a leaf but no department');
  }
  const inferred = store.items.filter(i => i.kategoria.forras && i.kategoria.forras.startsWith('daniella-webshop-testver'));
  assert.equal(inferred.length, 2, 'only the two colour-variant siblings were inferred');
  for (const it of inferred) {
    const donorCode = it.kategoria.forras.split(':')[1];
    const donor = store.getByLegacy(donorCode);
    assert.ok(donor, 'the donor is named and resolvable');
    assert.equal(donor.kategoria.al, it.kategoria.al);
  }
});

test('the category path is stored leaf-most-first, as the webshop prints it', () => {
  const store = createStore(raw());
  const it = store.getByLegacy('OBO2000378');
  assert.equal(it.kategoria.fo, 'Installáció technika');
  assert.equal(it.kategoria.al, 'Falon kívüli dobozok és fedelek');
  assert.equal(it.kategoria.ut, '/Szerelvény- és kötődobozok/Installáció technika/');
});

test('a document at the wrong version is migrated on load', () => {
  const v1 = { schema: 'vrg-inventory', schema_version: '1.0.0', vendors: [], items: [{ id: 'A1', megnevezes: 'Teszt' }] };
  const s = createStore(v1, { idMap: { A1: 'VRG-9999' } });
  assert.equal(s.get('VRG-9999').megnevezes, 'Teszt');
});

test('an invalid document is rejected rather than half-loaded', () => {
  assert.throws(() => createStore({
    schema: 'vrg-inventory', schema_version: '2.0.0', vendors: [],
    items: [{ vrg_id: 'VRG-0001' }, { vrg_id: 'VRG-0001' }]
  }), /invalid inventory document/);
});
