import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

import { qrEncode, qrSvg, qrBytes, QRCAP } from '../src/core/qr.js';
import * as pay from '../src/core/qrpayload.js';
import { createStore } from '../src/core/store.js';
import { createUserData } from '../src/core/userdata.js';
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

// ------------------------------------------------------------------ encoder
test('the encoder reproduces the Planner’s documented smoke test', () => {
  // same input, same expected result as docs/qr-subsystem.md — proof the two
  // tools really are running the same engine
  const r = qrEncode('http://192.168.1.24:8080/phone-sender.html');
  assert.equal(r.ok, true);
  assert.equal(r.version, 3);
  assert.equal(r.n, 29);
});

test('the encoder returns a result instead of throwing', () => {
  const empty = qrEncode('');
  assert.equal(empty.ok, false);
  assert.match(empty.err, /Nincs mit kódolni/);

  const huge = qrEncode('x'.repeat(5000), { ecc: 'L' });
  assert.equal(huge.ok, false);
  assert.match(huge.err, /Túl hosszú/);
  assert.ok(huge.bytes > QRCAP.L);
});

test('UTF-8 byte counting handles accents and emoji', () => {
  assert.equal(qrBytes('abc'), 3);
  assert.equal(qrBytes('őű'), 4);
  assert.equal(qrBytes('Kötődoboz'), 11);
  assert.equal(qrBytes('😀'), 4);
  assert.equal(qrBytes(''), 0);
});

test('the SVG keeps crispEdges, which phone cameras need', () => {
  const svg = qrSvg('teszt');
  assert.match(svg, /shape-rendering="crispEdges"/);
  assert.match(svg, /^<svg /);
});

test('stronger error correction means less room', () => {
  const text = 'x'.repeat(1500);
  assert.equal(qrEncode(text, { ecc: 'L' }).ok, true);
  assert.equal(qrEncode(text, { ecc: 'H' }).ok, false, 'the same payload no longer fits at H');
});

// ------------------------------------------------------------ list payload
test('a list round-trips through the compact payload exactly', () => {
  const { store, lists } = setup();
  const items = store.query({ limit: 20 });
  const l = lists.create('Hetényi');
  items.forEach((it, i) => lists.setQty(it.vrg_id, i + 1));

  const text = pay.encodeList({
    nev: l.nev,
    sorok: Object.entries(lists.active().sorok).map(([id, r]) => ({ vrg_id: id, mennyiseg: r.mennyiseg }))
  });
  const back = pay.decodeList(text, { knownId: id => !!store.get(id) });

  assert.equal(back.nev, 'Hetényi');
  assert.deepEqual(back.warnings, []);
  assert.equal(back.sorok.length, 20);
  for (const row of back.sorok) {
    assert.equal(row.mennyiseg, lists.qty(row.vrg_id), row.vrg_id);
  }
});

test('fractional quantities survive the round trip', () => {
  const { store, lists } = setup();
  const it = store.items[0];
  lists.create('L');
  lists.setQty(it.vrg_id, 2.5);
  const back = pay.decodeList(pay.encodeList({ nev: 'L', sorok: [{ vrg_id: it.vrg_id, mennyiseg: 2.5 }] }));
  assert.equal(back.sorok[0].mennyiseg, 2.5);
});

test('a realistic order list fits in ONE code — chunking is not needed', () => {
  const { store, lists } = setup();
  const items = store.query({ limit: 221 });
  lists.create('Minden tétel');
  items.forEach(it => lists.setQty(it.vrg_id, 99));

  const text = pay.encodeList({
    nev: 'Minden tétel',
    sorok: Object.entries(lists.active().sorok).map(([id, r]) => ({ vrg_id: id, mennyiseg: r.mennyiseg }))
  });
  const r = qrEncode(text, { ecc: 'L' });
  assert.equal(r.ok, true, 'the entire 221-item catalogue fits in a single QR code');
  assert.ok(qrBytes(text) < QRCAP.L);
});

test('the payload is plain ASCII, so the encoder can pack it well', () => {
  const { store, lists } = setup();
  lists.create('L');
  store.query({ limit: 5 }).forEach(it => lists.setQty(it.vrg_id, 3));
  const text = pay.encodeList({ nev: 'L', sorok: Object.entries(lists.active().sorok).map(([id, r]) => ({ vrg_id: id, mennyiseg: r.mennyiseg })) });
  assert.match(text, /^VRGL1\|L\|[\d:,]+$/);
});

test('decoding refuses a payload that is not ours', () => {
  assert.throws(() => pay.decodeList('csak sima szöveg'), /nem VRG lista-kód/);
  assert.throws(() => pay.decodeList(''), /nem VRG lista-kód/);
});

test('decoding reports mangled rows instead of inventing them', () => {
  const { store } = setup();
  const good = pay.shortId(store.items[0].vrg_id);
  const text = `VRGL1|Teszt|${good}:3,${good}:2,9999:1,rongyos,0001:0`;
  const back = pay.decodeList(text, { knownId: id => !!store.get(id) });

  assert.equal(back.sorok.length, 1);
  assert.equal(back.sorok[0].mennyiseg, 5, 'the duplicate is summed');
  assert.ok(back.warnings.some(w => /többször/.test(w)));
  assert.ok(back.warnings.some(w => /rongyos/.test(w)));
  assert.ok(back.warnings.some(w => /VRG-9999/.test(w)));
});

test('a list name containing the separators cannot corrupt the payload', () => {
  const text = pay.encodeList({ nev: 'Rossz|név, vessző', sorok: [{ vrg_id: 'VRG-0001', mennyiseg: 1 }] });
  const back = pay.decodeList(text);
  assert.equal(back.nev, 'Rossz név  vessző'.replace(/\s+/g, ' ').trim());
  assert.equal(back.sorok.length, 1);
});

test('short and long ids convert both ways', () => {
  assert.equal(pay.shortId('VRG-0098'), '0098');
  assert.equal(pay.longId('0098'), 'VRG-0098');
  assert.equal(pay.shortId('egyeb'), 'egyeb', 'anything unexpected is kept whole');
  assert.equal(pay.longId('egyeb'), 'egyeb');
});

// ------------------------------------------------------------- readable text
test('the readable list names the item and the quantity', () => {
  const { store, lists } = setup();
  const it = store.query({ limit: 1 })[0];
  lists.create('Hetényi');
  lists.setQty(it.vrg_id, 4);

  const text = pay.listText({
    nev: 'Hetényi', rows: lists.rows(), totals: lists.totals(),
    vendor: null, vendorCode: () => null
  });
  assert.match(text, /VRG rendelés — Hetényi/);
  assert.ok(text.includes(it.megnevezes));
  assert.match(text, /^4 /m);
});

test('the readable list uses the vendor article number once a vendor is selected', () => {
  const { store, lists } = setup();
  const it = store.items.find(i => i.vendors.daniella.cikkszam);
  lists.create('L');
  lists.setQty(it.vrg_id, 1);
  store.vendors.select('daniella');

  const text = pay.listText({
    nev: 'L', rows: lists.rows(), vendor: store.vendors.selectedVendor(),
    vendorCode: item => store.vendors.read(item, 'v_cikkszam')
  });
  assert.ok(text.includes(it.vendors.daniella.cikkszam));
  assert.ok(text.includes('DANIELLA'));
});

test('a readable list of a realistic size still fits in a code', () => {
  const { store, lists } = setup();
  lists.create('Hetényi');
  store.query({ limit: 30 }).forEach(it => lists.setQty(it.vrg_id, 2));
  const text = pay.listText({ nev: 'Hetényi', rows: lists.rows(), totals: lists.totals(), vendorCode: () => null });
  assert.equal(qrEncode(text, { ecc: 'L' }).ok, true, '30 readable lines fit');
});

test('an item code carries the neutral identifiers', () => {
  const { store } = setup();
  const it = store.getByLegacy('OBO2000378');
  const text = pay.itemText(it, {});
  assert.ok(text.includes(it.megnevezes));
  assert.ok(text.includes(it.vrg_id));
  assert.ok(text.includes(it.gtin));
  assert.ok(!text.includes('OBO2000378'), 'the vendor code is not included unless a vendor is selected');
});

test('an item code includes the vendor code only when one is passed in', () => {
  const { store } = setup();
  const it = store.getByLegacy('OBO2000378');
  const text = pay.itemText(it, { vendorCode: 'OBO2000378', vendorNev: 'DANIELLA' });
  assert.ok(text.includes('DANIELLA: OBO2000378'));
});
