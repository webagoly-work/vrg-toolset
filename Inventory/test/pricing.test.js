import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

import { gross, net, discountPct, estimate, priceChange, fitsPack } from '../src/core/pricing.js';
import { num, huf, date, pct, NBSP } from '../src/core/format.js';

const ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const doc = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'vrg-inventory.json'), 'utf8'));

test('gross/net round-trip within a forint', () => {
  assert.equal(gross(100), 127);
  assert.equal(gross(496.91), 631);
  assert.equal(gross(null), null);
  assert.ok(Math.abs(net(gross(1000)) - 1000) < 1);
});

test('every stored gross price equals net x 1.27', () => {
  for (const it of doc.items) {
    const a = it.becsult_ar;
    if (a.netto_huf == null) { assert.equal(a.brutto_huf, null); continue; }
    assert.equal(a.brutto_huf, gross(a.netto_huf), it.vrg_id);
  }
});

test('stored discounts match the list price they came from', () => {
  const withList = doc.items.filter(i => i.vendors.daniella.listaar_netto_huf != null);
  assert.ok(withList.length >= 40);
  for (const it of withList) {
    const d = it.vendors.daniella;
    const implied = discountPct(d.listaar_netto_huf, d.netto_egysegar_huf);
    const stated = parseFloat(String(d.engedmeny_szazalek).replace(',', '.'));
    assert.ok(Math.abs(implied - stated) < 0.15, `${it.vrg_id}: ${implied} vs ${stated}`);
  }
});

test('estimate falls back to computing gross when it is absent', () => {
  assert.deepEqual(estimate({ becsult_ar: { netto_huf: 100, brutto_huf: null, datum: '2026.01.01' } }), {
    netto: 100, brutto: 127, datum: '2026.01.01', forras: null, ismert: true
  });
  assert.equal(estimate({ becsult_ar: {} }).ismert, false);
});

test('priceChange only fires on a real change', () => {
  assert.equal(priceChange(100, 100), null);
  assert.equal(priceChange(100, null), null);
  const up = priceChange(100, 110, { vrg_id: 'VRG-0001' });
  assert.equal(up.valtozas_huf, 10);
  assert.equal(up.valtozas_szazalek, 10);
  assert.equal(up.vrg_id, 'VRG-0001');
  const first = priceChange(null, 110, {});
  assert.equal(first.regi_brutto, null);
  assert.equal(first.uj_brutto, 110);
});

test('pack-size check', () => {
  assert.equal(fitsPack(100, 25), true);
  assert.equal(fitsPack(30, 25), false);
  assert.equal(fitsPack(7, 1), true);
  assert.equal(fitsPack(7, null), true);
});

test('Hungarian formatting', () => {
  assert.equal(num(1234567), '1' + NBSP + '234' + NBSP + '567');
  assert.equal(num(1234.5, 2), '1' + NBSP + '234,50');
  assert.equal(num(-1234), '-1' + NBSP + '234');
  assert.equal(num(496.91), '496,91');
  assert.equal(num(null), '');
  assert.equal(huf(null), '—');
  assert.equal(huf(631), '631' + NBSP + 'Ft');
  assert.equal(date('2026.09.17'), '2026.09.17.');
  assert.equal(date(null), '');
  assert.equal(pct('26.2'), '26,2%');
});
