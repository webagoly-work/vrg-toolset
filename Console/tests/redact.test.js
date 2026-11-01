import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redactText, coarseAddress } from '../www/js/core/redact.js';
import { parseItems } from '../www/js/core/items.js';

test('the client name, address, phone and email all go', () => {
  const out = redactText('Teszt Elek, 1134 Budapest, Példa utca 1. Tel: +36 30 123 4567, 06-20/123-4567, teszt@example.com', {
    names: ['Teszt Elek'], address: '1134 Budapest, Példa utca 1.',
  });
  assert.equal(out, 'Client-A, Budapest 13. Tel: […], […], […]');
});

test('addresses coarsen to the district or town', () => {
  assert.equal(coarseAddress('1052 Budapest, Példa tér 2.'), 'Budapest 5.');
  assert.equal(coarseAddress('8000 Székesfehérvár, Fő utca 3.'), 'Székesfehérvár');
  assert.equal(coarseAddress(''), '');
});

test('measured values are left alone', () => {
  const text = 'Zs 0,62 Ω, IR 500 MΩ, 21 ms, 2026-11-01';
  assert.equal(redactText(text, {}), text);
});

test('the supplier CSV keeps rows with a name and a price', () => {
  const rows = parseItems('MCB B16;A1;599;db;1 250;2026-10-01\n;;;;;\nNo price;;;;;\n"Cable 3x2,5";B2;;m;310,5;');
  assert.deepEqual(rows.map((r) => [r.name, r.price]), [['MCB B16', 1250], ['Cable 3x2,5', 310.5]]);
});
