import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

import { createStore } from '../src/core/store.js';
import { createBus } from '../src/core/events.js';
import { windowRange } from '../src/features/catalog/table.js';
import {
  COLUMNS, DEFAULT_ORDER, column, cellText, createColumnState, comparator
} from '../src/features/catalog/columns.js';

const ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const raw = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'vrg-inventory.json'), 'utf8'));

// ----------------------------------------------------------------- windowing
test('windowRange covers the viewport and keeps the scrollbar honest', () => {
  const total = 1000, rowHeight = 30, viewportHeight = 600;
  for (const scrollTop of [0, 15, 300, 9000, 29700, 1e9]) {
    const r = windowRange({ scrollTop, viewportHeight, rowHeight, total, overscan: 6 });
    assert.ok(r.start >= 0 && r.end <= total, 'range stays inside the list');
    assert.ok(r.start <= r.end);
    assert.equal(r.padTop, r.start * rowHeight);
    assert.equal(r.padBottom, (total - r.end) * rowHeight);
    assert.equal(r.padTop + (r.end - r.start) * rowHeight + r.padBottom, total * rowHeight,
      'spacers + rendered rows always add up to the full height');

    // the visible band must be fully rendered
    const firstVisible = Math.floor(Math.min(scrollTop, (total - 1) * rowHeight) / rowHeight);
    const lastVisible = Math.min(total - 1, Math.floor((Math.min(scrollTop, (total - 1) * rowHeight) + viewportHeight) / rowHeight));
    assert.ok(r.start <= firstVisible, `start ${r.start} must cover ${firstVisible}`);
    assert.ok(r.end > lastVisible || r.end === total, `end ${r.end} must cover ${lastVisible}`);
  }
});

test('windowRange handles an empty list and a tiny viewport', () => {
  assert.deepEqual(windowRange({ scrollTop: 0, viewportHeight: 600, rowHeight: 30, total: 0 }),
    { start: 0, end: 0, padTop: 0, padBottom: 0 });
  const r = windowRange({ scrollTop: 0, viewportHeight: 0, rowHeight: 30, total: 5, overscan: 0 });
  assert.equal(r.start, 0);
  assert.ok(r.end >= 1);
});

test('windowRange renders far fewer rows than the list holds', () => {
  const r = windowRange({ scrollTop: 5000, viewportHeight: 600, rowHeight: 30, total: 10000 });
  assert.ok(r.end - r.start < 40, 'rendered ' + (r.end - r.start));
});

// ------------------------------------------------------------------ columns
test('column registry is consistent', () => {
  const ids = COLUMNS.map(c => c.id);
  assert.equal(new Set(ids).size, ids.length, 'ids unique');
  for (const c of COLUMNS) {
    assert.equal(typeof c.get, 'function', c.id);
    assert.ok(c.label && c.width > 0, c.id);
  }
  for (const id of DEFAULT_ORDER) assert.ok(ids.includes(id), 'default order references ' + id);
  assert.throws(() => column('nincs_ilyen'), /unknown column/);
});

test('column state hides, shows, reorders and resets', () => {
  const st = createColumnState();
  const ctx = { vendors: { selectedId: () => null } };

  assert.ok(st.isVisible('megnevezes'));
  st.toggle('megnevezes', false);
  assert.equal(st.isVisible('megnevezes'), false);
  st.toggle('megnevezes', true);

  const before = st.active(ctx).map(c => c.id);
  st.move(before[1], -1);
  const after = st.active(ctx).map(c => c.id);
  assert.equal(after[0], before[1], 'moved up');
  assert.equal(after[1], before[0]);

  st.reset();
  assert.deepEqual(st.active(ctx).map(c => c.id), DEFAULT_ORDER.filter(id => !column(id).vendor));

  // every column, including hidden ones, must be offerable in the picker
  assert.equal(st.all().length, COLUMNS.length);
});

test('the last visible column cannot be hidden', () => {
  const st = createColumnState({ order: DEFAULT_ORDER, visible: ['vrg_id'] });
  assert.equal(st.toggle('vrg_id', false), false);
  assert.ok(st.isVisible('vrg_id'));
});

test('column state survives a serialize/restore round-trip', () => {
  const a = createColumnState();
  a.toggle('legacy_id', true);
  a.toggle('marka', false);
  a.move('netto', -2);
  const snap = a.serialize();
  const b = createColumnState(snap);
  assert.deepEqual(b.serialize(), snap);
});

test('unknown column ids in a restored state are dropped, not fatal', () => {
  const st = createColumnState({ order: ['vrg_id', 'nincs_ilyen', 'netto'], visible: ['vrg_id', 'nincs_ilyen'] });
  const ids = st.all().map(c => c.id);
  assert.ok(!ids.includes('nincs_ilyen'));
  assert.equal(st.isVisible('vrg_id'), true);
});

// -------------------------------------------------------------- vendor gate
test('vendor columns are absent until a vendor is selected', () => {
  const store = createStore(raw());
  const ctx = { vendors: store.vendors };
  const st = createColumnState();

  const neutral = st.active(ctx).map(c => c.id);
  assert.equal(neutral.some(id => column(id).vendor), false, 'no vendor column in neutral mode');

  store.vendors.select('daniella');
  const withVendor = st.active(ctx).map(c => c.id);
  assert.ok(withVendor.some(id => column(id).vendor));
  assert.ok(withVendor.length > neutral.length);

  store.vendors.select(null);
  assert.deepEqual(st.active(ctx).map(c => c.id), neutral, 'deselecting restores the neutral set');
});

test('a vendor cell reads nothing in neutral mode even if asked directly', () => {
  const store = createStore(raw());
  const ctx = { vendors: store.vendors };
  const it = store.getByLegacy('OBO2000378');

  assert.equal(cellText(column('v_cikkszam'), it, ctx), '—');
  assert.equal(cellText(column('v_netto'), it, ctx), '—');

  store.vendors.select('daniella');
  assert.equal(cellText(column('v_cikkszam'), it, ctx), 'OBO2000378');
  assert.notEqual(cellText(column('v_netto'), it, ctx), '—');
});

test('no column shown in neutral mode can surface a vendor article number', () => {
  const store = createStore(raw());
  const ctx = { vendors: store.vendors };
  const st = createColumnState({ order: COLUMNS.map(c => c.id), visible: COLUMNS.map(c => c.id) });

  // even with EVERY column switched on, neutral mode must not render one
  const shown = st.active(ctx);
  for (const it of store.items) {
    const code = it.vendors.daniella.cikkszam;
    for (const c of shown) {
      const v = c.get(it, ctx);
      if (v == null) continue;
      assert.notEqual(String(v), code, `${c.id} leaked ${code} on ${it.vrg_id}`);
    }
  }
  assert.ok(!shown.some(c => c.id === 'legacy_id'), 'legacy_id is the vendor code verbatim');

  // selecting the vendor makes both it and the gated columns available again
  store.vendors.select('daniella');
  const withVendor = st.active(ctx).map(c => c.id);
  assert.ok(withVendor.includes('legacy_id'));
  assert.ok(withVendor.includes('v_cikkszam'));
});

// ---------------------------------------------------------------- sorting
test('comparator sorts numbers numerically and text by Hungarian collation', () => {
  const ctx = { vendors: { selectedId: () => null } };
  const mk = (id, nev, netto) => ({
    vrg_id: id, megnevezes: nev, becsult_ar: { netto_huf: netto, brutto_huf: null },
    kategoria: {}, kategoria_javaslat: {}, felhasznalas: {}
  });
  const items = [mk('VRG-0003', 'Zebra', 90), mk('VRG-0001', 'Álom', 1000), mk('VRG-0002', 'béka', 9)];

  const byPrice = items.slice().sort(comparator(column('netto'), ctx, false));
  assert.deepEqual(byPrice.map(i => i.becsult_ar.netto_huf), [9, 90, 1000], 'not lexicographic');

  const byName = items.slice().sort(comparator(column('megnevezes'), ctx, false));
  assert.deepEqual(byName.map(i => i.megnevezes), ['Álom', 'béka', 'Zebra']);
});

test('unknown values sink to the bottom in both directions', () => {
  const ctx = { vendors: { selectedId: () => null } };
  const mk = (id, netto) => ({
    vrg_id: id, megnevezes: id, becsult_ar: { netto_huf: netto, brutto_huf: null },
    kategoria: {}, kategoria_javaslat: {}, felhasznalas: {}
  });
  const items = [mk('VRG-0001', null), mk('VRG-0002', 50), mk('VRG-0003', 10)];

  for (const desc of [false, true]) {
    const sorted = items.slice().sort(comparator(column('netto'), ctx, desc));
    assert.equal(sorted[sorted.length - 1].vrg_id, 'VRG-0001',
      'the item with no price must never float to the top');
  }
});

test('sorting is stable on ties', () => {
  const ctx = { vendors: { selectedId: () => null } };
  const mk = id => ({
    vrg_id: id, megnevezes: 'azonos', becsult_ar: { netto_huf: 5, brutto_huf: null },
    kategoria: {}, kategoria_javaslat: {}, felhasznalas: {}
  });
  const items = [mk('VRG-0003'), mk('VRG-0001'), mk('VRG-0002')];
  const sorted = items.slice().sort(comparator(column('megnevezes'), ctx, false));
  assert.deepEqual(sorted.map(i => i.vrg_id), ['VRG-0001', 'VRG-0002', 'VRG-0003']);
});

// ------------------------------------------------------------------ queries
test('store.query can skip sorting for callers that sort themselves', () => {
  const store = createStore(raw());
  const unsorted = store.query({ sort: null });
  assert.equal(unsorted.length, store.items.length);
  assert.deepEqual(unsorted.map(i => i.vrg_id), store.items.map(i => i.vrg_id), 'document order preserved');
});

test('store.query accepts a custom comparator', () => {
  const store = createStore(raw());
  const ctx = { vendors: store.vendors };
  const rows = store.query({ hasPrice: true, compare: comparator(column('netto'), ctx, true) });
  assert.ok(rows[0].becsult_ar.netto_huf >= rows[rows.length - 1].becsult_ar.netto_huf);
});

test('sub-category filter narrows the parent category', () => {
  const store = createStore(raw());
  const fo = store.tree[0];
  const child = fo.children[0];
  const parent = store.query({ fo: fo.nev });
  const narrowed = store.query({ fo: fo.nev, al: child.nev });
  assert.equal(parent.length, fo.count);
  assert.equal(narrowed.length, child.count);
  assert.ok(narrowed.length <= parent.length);
});

test('searching any item by name finds it and nothing else drowns it', () => {
  const store = createStore(raw());
  for (const it of store.items) {
    const hits = store.query({ text: it.vrg_id });
    assert.deepEqual(hits.map(h => h.vrg_id), [it.vrg_id], it.vrg_id);
  }
});

test('filtering all 221 items stays far under the interactive budget', () => {
  const store = createStore(raw());
  const terms = ['', 'a', 'kotodoboz', 'legrand keret', 'wago 221', 'VRG-0100', 'nincs ilyen'];
  const t0 = performance.now();
  for (let i = 0; i < 50; i++) for (const t of terms) store.query({ text: t, sort: null });
  const perQuery = (performance.now() - t0) / (50 * terms.length);
  assert.ok(perQuery < 10, `a query took ${perQuery.toFixed(2)} ms on average`);
});

// ---------------------------------------------------------------- event bus
test('event bus subscribes, unsubscribes and survives self-removal', () => {
  const bus = createBus();
  const seen = [];
  const off = bus.on('x', v => seen.push(v));
  bus.on('x', v => { seen.push('b' + v); off(); });
  bus.emit('x', 1);
  bus.emit('x', 2);
  assert.deepEqual(seen, [1, 'b1', 'b2']);
  assert.equal(bus.emit('nobody', {}), 0);
});
