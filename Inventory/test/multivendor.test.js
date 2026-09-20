// The gate has only ever been exercised against DANIELLA. A second vendor is
// coming, so these tests run it against two — including an item only one of
// them carries, which is the case most likely to leak.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

import { createStore } from '../src/core/store.js';
import { column, createColumnState, cellText, COLUMNS } from '../src/features/catalog/columns.js';

const ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), '..');

/** The published catalogue plus a synthetic second vendor on some items. */
function twoVendorDoc() {
  const doc = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'vrg-inventory.json'), 'utf8'));
  doc.vendors.push({ id: 'masodik', nev: 'Második Beszállító Kft.', weboldal: 'https://example.invalid' });
  doc.items.forEach((it, i) => {
    if (i % 3 !== 0) return;                       // only every third item
    it.vendors.masodik = {
      cikkszam: 'M2-' + it.vrg_id.slice(4),
      netto_egysegar_huf: it.becsult_ar.netto_huf == null ? null : Math.round(it.becsult_ar.netto_huf * 0.9 * 100) / 100,
      brutto_egysegar_huf: null,
      listaar_netto_huf: null,
      engedmeny_szazalek: null,
      kiszereles: '10 db',
      kiszereles_mennyiseg: 10,
      aktualis_brutto_ar_huf: null,
      keszlet_db: 7,
      termek_link: null,
      ar_ellenorizve: null,
      ar_elozmeny: []
    };
  });
  return doc;
}

test('both vendors are registered and selectable', () => {
  const store = createStore(twoVendorDoc());
  assert.deepEqual(store.vendors.list().map(v => v.id), ['daniella', 'masodik']);
  assert.equal(store.vendors.select('masodik'), 'masodik');
  assert.equal(store.vendors.selectedVendor().nev, 'Második Beszállító Kft.');
});

test('selecting one vendor never shows the other vendor values', () => {
  const store = createStore(twoVendorDoc());
  const ctx = { vendors: store.vendors };
  const both = store.items.filter(i => i.vendors.masodik);
  assert.ok(both.length > 50, 'fixture covers enough items');

  store.vendors.select('daniella');
  for (const it of both) {
    assert.equal(store.vendors.read(it, 'v_cikkszam'), it.vendors.daniella.cikkszam);
    assert.notEqual(store.vendors.read(it, 'v_cikkszam'), it.vendors.masodik.cikkszam);
    assert.notEqual(store.vendors.read(it, 'v_keszlet'), 7, 'the second vendor stock must not leak through');
  }

  store.vendors.select('masodik');
  for (const it of both) {
    assert.equal(store.vendors.read(it, 'v_cikkszam'), it.vendors.masodik.cikkszam);
    assert.notEqual(store.vendors.read(it, 'v_cikkszam'), it.vendors.daniella.cikkszam);
    assert.equal(store.vendors.read(it, 'v_keszlet'), 7);
  }
});

test('an item the selected vendor does not carry reads as empty, not as the other vendor', () => {
  const store = createStore(twoVendorDoc());
  const ctx = { vendors: store.vendors };
  const only = store.items.filter(i => !i.vendors.masodik);
  assert.ok(only.length > 100);

  store.vendors.select('masodik');
  for (const it of only.slice(0, 40)) {
    assert.equal(store.vendors.hasBlock(it), false);
    assert.equal(store.vendors.block(it), null);
    assert.equal(store.vendors.read(it, 'v_cikkszam'), null);
    assert.equal(cellText(column('v_cikkszam'), it, ctx), '—');
    assert.equal(cellText(column('v_netto'), it, ctx), '—');
  }
});

test('carriedBy lists every vendor, and is safe to show in neutral mode', () => {
  const store = createStore(twoVendorDoc());
  const shared = store.items.find(i => i.vendors.masodik);
  const single = store.items.find(i => !i.vendors.masodik);
  assert.deepEqual(store.vendors.carriedBy(shared), ['daniella', 'masodik']);
  assert.deepEqual(store.vendors.carriedBy(single), ['daniella']);
});

test('neutral mode hides both vendors, including legacy_id', () => {
  const store = createStore(twoVendorDoc());
  const ctx = { vendors: store.vendors };
  const st = createColumnState({ order: COLUMNS.map(c => c.id), visible: COLUMNS.map(c => c.id) });

  store.vendors.select(null);
  const shown = st.active(ctx);
  for (const it of store.items) {
    for (const c of shown) {
      const v = c.get(it, ctx);
      if (v == null) continue;
      assert.notEqual(String(v), it.vendors.daniella.cikkszam, `${c.id} leaked a DANIELLA code`);
      if (it.vendors.masodik) {
        assert.notEqual(String(v), it.vendors.masodik.cikkszam, `${c.id} leaked a second-vendor code`);
      }
    }
  }
});

test('the vendor filter narrows to what that vendor actually carries', () => {
  const store = createStore(twoVendorDoc());
  const all = store.query({});
  const second = store.query({ vendor: 'masodik' });
  assert.ok(second.length > 0 && second.length < all.length);
  assert.ok(second.every(i => i.vendors.masodik));
  assert.equal(store.query({ vendor: 'daniella' }).length, all.length);
});

test('switching vendors changes the price shown without touching the neutral estimate', () => {
  const store = createStore(twoVendorDoc());
  const ctx = { vendors: store.vendors };
  const it = store.items.find(i => i.vendors.masodik && i.becsult_ar.netto_huf != null);

  const neutralEstimate = it.becsult_ar.netto_huf;
  store.vendors.select('daniella');
  const d = store.vendors.read(it, 'v_netto');
  store.vendors.select('masodik');
  const m = store.vendors.read(it, 'v_netto');

  assert.notEqual(d, m, 'the two vendors quote different prices');
  assert.equal(it.becsult_ar.netto_huf, neutralEstimate, 'the vendor-neutral estimate is unaffected');
});
