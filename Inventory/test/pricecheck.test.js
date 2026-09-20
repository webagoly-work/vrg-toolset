import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

import { createStore } from '../src/core/store.js';
import { createUserData, sanitize, USERDATA_VERSION } from '../src/core/userdata.js';
import * as pc from '../src/core/pricecheck.js';

const ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const raw = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'vrg-inventory.json'), 'utf8'));

function setup() {
  const store = createStore(raw());
  const userdata = createUserData();
  store.setUserData(userdata);
  return { store, userdata };
}

/** A check file shaped exactly like tools/pricecheck.js writes one. */
function checkFile(rows, extra) {
  return Object.assign({
    schema: 'vrg-price-check', schema_version: '1.0.0',
    vendor: 'daniella', datum: '2026-09-21', tetelek: rows
  }, extra);
}

const priced = store => store.items.filter(i => i.vendors.daniella.aktualis_brutto_ar_huf != null);

// ------------------------------------------------------------------ parsing
test('a check file must say which vendor it is about', () => {
  assert.throws(() => pc.parseCheck({ schema: 'vrg-price-check', tetelek: [] }), /melyik beszállítóról/);
  assert.throws(() => pc.parseCheck({ schema: 'vrg-inventory' }), /Nem árellenőrzés-fájl/);
  assert.throws(() => pc.parseCheck('szöveg'), /nem érvényes JSON objektum/);
});

test('an unknown vendor is refused rather than silently applied', () => {
  assert.throws(() => pc.parseCheck(checkFile([], { vendor: 'rexel' }), { knownVendor: v => v === 'daniella' }),
    /Ismeretlen beszállító/);
});

test('parsing drops junk rows and says what it dropped', () => {
  const { store } = setup();
  const good = priced(store)[0].vrg_id;
  const parsed = pc.parseCheck(checkFile([
    { vrg_id: good, brutto_ar_huf: 100 },
    { vrg_id: good, brutto_ar_huf: 200 },        // duplicate
    { vrg_id: 'nem-azonosito', brutto_ar_huf: 1 },
    { vrg_id: 'VRG-9999', brutto_ar_huf: 1 },    // not in the catalogue
    { vrg_id: 'VRG-0002', brutto_ar_huf: -5 }    // negative
  ]), { knownId: id => !!store.get(id) });

  assert.deepEqual(parsed.tetelek.map(t => t.vrg_id), [good]);
  assert.equal(parsed.tetelek[0].brutto_ar_huf, 100, 'the first reading wins');
  assert.equal(parsed.warnings.length, 4);
});

// ------------------------------------------------------------------ planning
test('a plan separates changes, first readings, unchanged and skipped', () => {
  const { store } = setup();
  const [a, b, c] = priced(store);
  const noVendorPrice = store.items.find(i => i.vendors.daniella.aktualis_brutto_ar_huf == null);

  const parsed = pc.parseCheck(checkFile([
    { vrg_id: a.vrg_id, brutto_ar_huf: a.vendors.daniella.aktualis_brutto_ar_huf + 100 },
    { vrg_id: b.vrg_id, brutto_ar_huf: b.vendors.daniella.aktualis_brutto_ar_huf },
    { vrg_id: c.vrg_id, brutto_ar_huf: null },
    { vrg_id: noVendorPrice.vrg_id, brutto_ar_huf: 500 }
  ]), { knownId: id => !!store.get(id) });

  const plan = pc.planCheck(parsed, store);
  assert.deepEqual(plan.valtozasok.map(v => v.vrg_id), [a.vrg_id]);
  assert.deepEqual(plan.valtozatlan.map(v => v.vrg_id), [b.vrg_id]);
  assert.deepEqual(plan.ujak.map(v => v.vrg_id), [noVendorPrice.vrg_id], 'no stored price = first reading');
  assert.deepEqual(plan.kihagyva.map(v => v.vrg_id), [c.vrg_id]);
  assert.equal(plan.valtozasok[0].valtozas_huf, 100);
  assert.equal(plan.emelkedes, 1);
  assert.equal(plan.csokkenes, 0);
});

test('a plan writes nothing on its own', () => {
  const { store, userdata } = setup();
  const it = priced(store)[0];
  const parsed = pc.parseCheck(checkFile([{ vrg_id: it.vrg_id, brutto_ar_huf: 99999 }]), { knownId: () => true });
  pc.planCheck(parsed, store);
  assert.deepEqual(userdata.doc.vendorData, {}, 'planning is a read-only preview');
  assert.deepEqual(userdata.doc.financeLog, []);
});

test('the biggest move is listed first', () => {
  const { store } = setup();
  const [a, b] = priced(store);
  const parsed = pc.parseCheck(checkFile([
    { vrg_id: a.vrg_id, brutto_ar_huf: Math.round(a.vendors.daniella.aktualis_brutto_ar_huf * 1.02) },
    { vrg_id: b.vrg_id, brutto_ar_huf: Math.round(b.vendors.daniella.aktualis_brutto_ar_huf * 1.5) }
  ]), { knownId: () => true });
  const plan = pc.planCheck(parsed, store);
  assert.equal(plan.valtozasok[0].vrg_id, b.vrg_id);
});

// ----------------------------------------------------------------- applying
test('applying writes the overlay and one log entry per change', () => {
  const { store, userdata } = setup();
  const it = priced(store)[0];
  const old = it.vendors.daniella.aktualis_brutto_ar_huf;

  const parsed = pc.parseCheck(checkFile([{ vrg_id: it.vrg_id, brutto_ar_huf: old + 50, keszlet: 12 }]), { knownId: () => true });
  const plan = pc.planCheck(parsed, store);
  const res = pc.applyPlan(plan, userdata);
  store.remergeAll();

  assert.equal(res.naplo, 1, 'exactly one log entry');
  assert.equal(userdata.doc.financeLog.length, 1);
  const e = userdata.doc.financeLog[0];
  assert.equal(e.vrg_id, it.vrg_id);
  assert.equal(e.regi_brutto, old);
  assert.equal(e.uj_brutto, old + 50);
  assert.equal(e.valtozas_huf, 50);

  // and the merged view now shows the new price, through the gate
  store.vendors.select('daniella');
  const merged = store.get(it.vrg_id);
  assert.equal(store.vendors.read(merged, 'v_aktualis_brutto'), old + 50);
  assert.equal(store.vendors.read(merged, 'v_keszlet'), 12);
  assert.ok(merged.vendor_frissitve.includes('daniella.aktualis_brutto_ar_huf'));
});

test('a price check never touches the price we negotiated', () => {
  const { store, userdata } = setup();
  const it = priced(store).find(i => i.vendors.daniella.netto_egysegar_huf != null);
  const ourNet = it.vendors.daniella.netto_egysegar_huf;
  const ourList = it.vendors.daniella.listaar_netto_huf;
  const pack = it.vendors.daniella.kiszereles;

  const parsed = pc.parseCheck(checkFile([{ vrg_id: it.vrg_id, brutto_ar_huf: 1, keszlet: 0 }]), { knownId: () => true });
  pc.applyPlan(pc.planCheck(parsed, store), userdata);
  store.remergeAll();

  const merged = store.get(it.vrg_id);
  assert.equal(merged.vendors.daniella.netto_egysegar_huf, ourNet, 'our partner price is untouched');
  assert.equal(merged.vendors.daniella.listaar_netto_huf, ourList);
  assert.equal(merged.vendors.daniella.kiszereles, pack);
  assert.equal(merged.becsult_ar.netto_huf, it.becsult_ar.netto_huf, 'the neutral estimate is untouched');
});

test('an unchanged price still records that it was checked', () => {
  const { store, userdata } = setup();
  const it = priced(store)[0];
  const same = it.vendors.daniella.aktualis_brutto_ar_huf;

  const parsed = pc.parseCheck(checkFile([{ vrg_id: it.vrg_id, brutto_ar_huf: same }]), { knownId: () => true });
  const res = pc.applyPlan(pc.planCheck(parsed, store), userdata);
  store.remergeAll();

  assert.equal(res.naplo, 0, 'nothing happened, so nothing is logged');
  assert.equal(res.irt, 1, 'but the reading is recorded');
  const rec = userdata.doc.vendorData.daniella[it.vrg_id];
  assert.ok(rec.ar_ellenorizve, '"checked today, unchanged" is distinguishable from "never checked"');
});

test('the catalogue file is never written to', () => {
  const { store, userdata } = setup();
  const it = priced(store)[0];
  const published = it.vendors.daniella.aktualis_brutto_ar_huf;

  const parsed = pc.parseCheck(checkFile([{ vrg_id: it.vrg_id, brutto_ar_huf: published + 777 }]), { knownId: () => true });
  pc.applyPlan(pc.planCheck(parsed, store), userdata);
  store.remergeAll();

  assert.equal(raw().items.find(i => i.vrg_id === it.vrg_id).vendors.daniella.aktualis_brutto_ar_huf, published);
  assert.equal(store.doc.items.find(i => i.vrg_id === it.vrg_id).vendors.daniella.aktualis_brutto_ar_huf, published,
    'the in-memory base is untouched too');
});

test('a vendor block is never invented for an item that vendor does not carry', () => {
  const { store, userdata } = setup();
  const it = store.items[0];
  userdata.mutate(d => { d.vendorData.masodik = { [it.vrg_id]: { aktualis_brutto_ar_huf: 1 } }; });
  store.remergeAll();
  assert.equal(store.get(it.vrg_id).vendors.masodik, undefined);
});

// -------------------------------------------------- the DoD: save prompting
test('one price change produces one log entry and one save prompt', () => {
  const { store, userdata } = setup();
  const it = priced(store)[0];
  const old = it.vendors.daniella.aktualis_brutto_ar_huf;

  const parsed = pc.parseCheck(checkFile([{ vrg_id: it.vrg_id, brutto_ar_huf: old + 10 }]), { knownId: () => true });
  const res = pc.applyPlan(pc.planCheck(parsed, store), userdata);

  assert.equal(res.naplo, 1);
  assert.equal(pc.needsSavePrompt(userdata), true, 'nothing saved today yet');

  pc.recordSave(userdata, { valtozasok: res.naplo, tetelek: res.irt });
  assert.equal(pc.needsSavePrompt(userdata), false, 'and only once');
});

test('running the check twice in one day prompts once', () => {
  const { store, userdata } = setup();
  const [a, b] = priced(store);

  const run = (item, delta) => {
    const parsed = pc.parseCheck(checkFile([{
      vrg_id: item.vrg_id,
      brutto_ar_huf: store.get(item.vrg_id).vendors.daniella.aktualis_brutto_ar_huf + delta
    }]), { knownId: () => true });
    const r = pc.applyPlan(pc.planCheck(parsed, store), userdata);
    store.remergeAll();
    return r;
  };

  run(a, 10);
  assert.equal(pc.needsSavePrompt(userdata), true);
  pc.recordSave(userdata, {});

  run(b, 20);
  assert.equal(pc.needsSavePrompt(userdata), false, 'already saved today — do not nag');
  assert.equal(userdata.doc.financeLog.length, 2, 'but both changes are still logged');
  assert.equal(userdata.doc.saveLog.length, 1);
});

test('a save logged yesterday still prompts today', () => {
  const { userdata } = setup();
  const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  userdata.mutate(d => { d.saveLog = [{ datum: yesterday, valtozasok: 3, tetelek: 10 }]; });
  assert.equal(pc.needsSavePrompt(userdata), true);
});

// -------------------------------------------------------------- the log
test('the log summary counts rises, falls and the average move', () => {
  const { store, userdata } = setup();
  const [a, b] = priced(store);
  const mk = (item, price) => pc.applyPlan(
    pc.planCheck(pc.parseCheck(checkFile([{ vrg_id: item.vrg_id, brutto_ar_huf: price }]), { knownId: () => true }), store),
    userdata);

  mk(a, a.vendors.daniella.aktualis_brutto_ar_huf * 2);      // +100%
  store.remergeAll();
  mk(b, b.vendors.daniella.aktualis_brutto_ar_huf / 2);      // -50%
  store.remergeAll();

  const s = pc.logSummary(userdata, store);
  assert.equal(s.bejegyzesek, 2);
  assert.equal(s.erintett_tetelek, 2);
  assert.equal(s.emelkedes, 1);
  assert.equal(s.csokkenes, 1);
  assert.equal(s.atlagos_valtozas_szazalek, 25, '(+100 + -50) / 2');
});

test('one item history is newest first', () => {
  const { store, userdata } = setup();
  const it = priced(store)[0];
  userdata.mutate(d => {
    d.financeLog = [
      { datum: '2026-09-01', vrg_id: it.vrg_id, vendor: 'daniella', uj_brutto: 1 },
      { datum: '2026-09-20', vrg_id: it.vrg_id, vendor: 'daniella', uj_brutto: 2 },
      { datum: '2026-09-10', vrg_id: 'VRG-9998', vendor: 'daniella', uj_brutto: 3 }
    ];
  });
  const h = pc.itemHistory(userdata, it.vrg_id);
  assert.deepEqual(h.map(e => e.datum), ['2026-09-20', '2026-09-01']);
});

// ------------------------------------------------------------ persistence
test('the overlay and the log survive an export/import round-trip', () => {
  const { store, userdata } = setup();
  const it = priced(store)[0];
  const old = it.vendors.daniella.aktualis_brutto_ar_huf;
  pc.applyPlan(pc.planCheck(
    pc.parseCheck(checkFile([{ vrg_id: it.vrg_id, brutto_ar_huf: old + 42, keszlet: 5 }]), { knownId: () => true }),
    store), userdata);
  pc.recordSave(userdata, { valtozasok: 1, tetelek: 1 });

  const file = JSON.parse(JSON.stringify(userdata.serialize()));
  const store2 = createStore(raw());
  const { doc, warnings } = sanitize(file, id => !!store2.get(id));
  assert.deepEqual(warnings, []);
  const ud2 = createUserData(doc);
  store2.setUserData(ud2);
  store2.vendors.select('daniella');

  assert.equal(store2.vendors.read(store2.get(it.vrg_id), 'v_aktualis_brutto'), old + 42);
  assert.equal(ud2.doc.financeLog.length, 1);
  assert.equal(ud2.doc.saveLog.length, 1);
  assert.equal(pc.needsSavePrompt(ud2), false, 'the save record travels too');
});

test('import refuses to let a hand-edited file rewrite our negotiated price', () => {
  const { store } = setup();
  const it = store.items[0];
  const hostile = createUserData().serialize();
  hostile.vendorData = {
    daniella: {
      [it.vrg_id]: {
        aktualis_brutto_ar_huf: 1,
        netto_egysegar_huf: 0,          // must not survive
        listaar_netto_huf: 0,           // must not survive
        kiszereles_mennyiseg: 999       // must not survive
      }
    }
  };
  const { doc } = sanitize(hostile, id => !!store.get(id));
  assert.deepEqual(doc.vendorData.daniella[it.vrg_id], { aktualis_brutto_ar_huf: 1 });
});

test('a userdata document from Phase 5 migrates and gains the log', () => {
  const old = {
    schema: 'vrg-userdata', schema_version: '1.2.0',
    created: 'x', updated: 'x', items: {}, lists: {}, activeList: null, exportProfiles: [], ui: {}
  };
  const ud = createUserData(old);
  assert.equal(ud.doc.schema_version, USERDATA_VERSION);
  assert.deepEqual(ud.doc.vendorData, {});
  assert.deepEqual(ud.doc.financeLog, []);
  assert.deepEqual(ud.doc.saveLog, []);
});
