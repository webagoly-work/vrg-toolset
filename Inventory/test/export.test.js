import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

import { createStore } from '../src/core/store.js';
import { createUserData, sanitize, USERDATA_VERSION } from '../src/core/userdata.js';
import { createLists } from '../src/core/lists.js';
import { createProfiles, sanitizeProfile, defaults } from '../src/core/profiles.js';
import * as ex from '../src/core/io/exporters.js';
import * as im from '../src/core/io/importers.js';
import { catalogFields, listFields, visibleFields, pick } from '../src/features/export/fields.js';
import { COLUMNS } from '../src/features/catalog/columns.js';

const ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const raw = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'vrg-inventory.json'), 'utf8'));

function setup() {
  const store = createStore(raw());
  const userdata = createUserData();
  store.setUserData(userdata);
  const lists = createLists({ userdata, store });
  const profiles = createProfiles({ userdata });
  return { store, userdata, lists, profiles, ctx: { vendors: store.vendors } };
}

// ------------------------------------------------------------------- CSV
test('csv quotes only what needs quoting and honours the dialect', () => {
  const rows = [{ a: 'sima', b: 1234.5 }, { a: 'pont; vessző', b: -2 }, { a: 'idéző"jel', b: null }];
  const cols = [{ id: 'a', label: 'A', get: r => r.a }, { id: 'b', label: 'B', get: r => r.b }];

  const hu = ex.csv({ rows, columns: cols, dialect: 'excel-hu' });
  assert.ok(hu.startsWith('﻿'), 'Excel needs the BOM');
  assert.ok(hu.includes('A;B'));
  assert.ok(hu.includes('sima;1234,5'), 'decimal comma');
  assert.ok(hu.includes('"pont; vessző";-2'), 'separator inside a field forces quotes');
  assert.ok(hu.includes('"idéző""jel";'), 'quotes are doubled');

  const std = ex.csv({ rows, columns: cols, dialect: 'standard' });
  assert.ok(!std.startsWith('﻿'));
  assert.ok(std.includes('sima,1234.5'), 'decimal point');
});

test('csv can omit the header and can group by category', () => {
  const rows = [{ k: 'B', n: 'kettő' }, { k: 'A', n: 'egy' }];
  const cols = [{ id: 'n', label: 'Név', get: r => r.n }];
  const plain = ex.csv({ rows, columns: cols, header: false, dialect: 'standard' });
  assert.equal(plain.trim().split('\n').length, 2);

  const grouped = ex.csv({ rows, columns: cols, dialect: 'standard', groupBy: r => r.k });
  const lines = grouped.trim().split('\n');
  assert.deepEqual(lines, ['Név', 'B', 'kettő', 'A', 'egy']);
});

test('an unknown dialect fails loudly', () => {
  assert.throws(() => ex.csv({ rows: [], columns: [], dialect: 'klingon' }), /unknown csv dialect/);
});

// --------------------------------------------------------- category order
test('category order ranks what the user listed and keeps the rest alphabetical', () => {
  const rows = [{ c: 'Zebra' }, { c: 'Alma' }, { c: 'Körte' }, { c: 'Barack' }];
  const out = ex.orderByCategory(rows, r => r.c, ['Körte', 'Zebra']);
  assert.deepEqual(out.map(r => r.c), ['Körte', 'Zebra', 'Alma', 'Barack']);
});

test('an empty category order leaves Hungarian alphabetical order', () => {
  const rows = [{ c: 'Zebra' }, { c: 'Álom' }, { c: 'Béka' }];
  assert.deepEqual(ex.orderByCategory(rows, r => r.c, []).map(r => r.c), ['Álom', 'Béka', 'Zebra']);
});

// ------------------------------------------------------------- CSV parsing
test('the parser survives quotes, separators and newlines inside fields', () => {
  const text = 'a;b\n"tartalom; pontosvesszővel";2\n"több\nsoros";3\n"idéző""jel";4\n';
  const { rows, sep } = im.parseDelimited(text);
  assert.equal(sep, ';');
  assert.deepEqual(rows[1], ['tartalom; pontosvesszővel', '2']);
  assert.deepEqual(rows[2], ['több\nsoros', '3']);
  assert.deepEqual(rows[3], ['idéző"jel', '4']);
});

test('the parser strips a BOM and sniffs the separator', () => {
  assert.equal(im.sniffSeparator('a,b,c\n1,2,3'), ',');
  assert.equal(im.sniffSeparator('a\tb\n1\t2'), '\t');
  const { rows } = im.parseDelimited('﻿a,b\n1,2');
  assert.deepEqual(rows[0], ['a', 'b']);
});

test('number parsing copes with both Hungarian and standard notation', () => {
  assert.equal(im.parseNumber('1 234,56'), 1234.56);
  assert.equal(im.parseNumber('1234.56'), 1234.56);
  assert.equal(im.parseNumber('1.234,56'), 1234.56);
  assert.equal(im.parseNumber('1,234.56'), 1234.56);
  assert.equal(im.parseNumber('496,91 Ft'), 496.91);
  assert.equal(im.parseNumber(''), null);
  assert.equal(im.parseNumber('sok'), null);
});

// --------------------------------------------------------- the DoD: profiles
test('three profiles produce three different spreadsheets from one list', () => {
  const { store, lists, profiles, ctx } = setup();
  const items = store.query({ hasPrice: true, limit: 12 });
  lists.create('Hetényi');
  items.forEach((it, i) => lists.setQty(it.vrg_id, i + 1));

  const base = profiles.forTarget('lista')[0];
  const p1 = profiles.create({
    nev: 'Csak mennyiség', target: 'lista', format: 'csv', dialect: 'excel-hu',
    columns: ['vrg_id', 'mennyiseg'], groupByCategory: false
  });
  const p2 = profiles.create({
    nev: 'Árazott, csoportosítva', target: 'lista', format: 'csv', dialect: 'standard',
    columns: ['megnevezes', 'mennyiseg', 'egysegar', 'sor_netto'], groupByCategory: true
  });
  const p3 = profiles.create({
    nev: 'Tabulátoros', target: 'lista', format: 'tsv',
    columns: ['vrg_id', 'megnevezes', 'mennyiseg'], groupByCategory: false
  });

  const rowsOf = p => {
    const fields = pick(listFields(), p.columns, ctx);
    const rows = p.groupByCategory
      ? ex.orderByCategory(lists.rows(), r => (r.item ? r.item.kategoria_javaslat.al : 'x'), p.categoryOrder)
      : lists.rows();
    return ex.csv({
      rows, columns: fields, ctx,
      dialect: p.format === 'tsv' ? 'tsv' : p.dialect,
      header: p.header,
      groupBy: p.groupByCategory ? r => (r.item ? r.item.kategoria_javaslat.al : 'x') : null
    });
  };

  const a = rowsOf(p1), b = rowsOf(p2), c = rowsOf(p3);
  assert.notEqual(a, b);
  assert.notEqual(b, c);
  assert.notEqual(a, c);
  assert.ok(a.startsWith('﻿vrg_id;mennyiseg'), 'profile 1: two columns, Excel dialect');
  assert.ok(b.split('\n')[0].startsWith('Megnevezés,mennyiseg'), 'profile 2: four columns, standard dialect');
  assert.ok(c.includes('\t'), 'profile 3: tabs');
  assert.ok(b.split('\n').length > a.split('\n').length, 'grouping adds heading lines');
  assert.notEqual(base.id, p1.id);
});

test('column order in the profile is the column order in the file', () => {
  const { store, lists, ctx } = setup();
  const it = store.query({ hasPrice: true, limit: 1 })[0];
  lists.create('L');
  lists.setQty(it.vrg_id, 2);

  const forward = ex.csv({
    rows: lists.rows(), columns: pick(listFields(), ['vrg_id', 'mennyiseg', 'megnevezes'], ctx),
    ctx, dialect: 'standard'
  }).split('\n')[0];
  const reversed = ex.csv({
    rows: lists.rows(), columns: pick(listFields(), ['megnevezes', 'mennyiseg', 'vrg_id'], ctx),
    ctx, dialect: 'standard'
  }).split('\n')[0];

  assert.equal(forward, 'vrg_id,mennyiseg,Megnevezés');
  assert.equal(reversed, 'Megnevezés,mennyiseg,vrg_id');
});

// ------------------------------------------------- the DoD: re-import
test('a list exported to CSV re-imports to exactly the same lines', () => {
  const { store, lists, ctx } = setup();
  const items = store.query({ limit: 25 });
  lists.create('Eredeti');
  items.forEach((it, i) => lists.setQty(it.vrg_id, (i + 1) * 0.5));
  lists.setLineNote(items[0].vrg_id, 'idézőjel " és ; pontosvessző');

  const text = ex.csv({
    rows: lists.rows(),
    columns: pick(listFields(), ['vrg_id', 'megnevezes', 'mennyiseg', 'sor_megjegyzes'], ctx),
    ctx, dialect: 'excel-hu'
  });

  const { lines, warnings } = im.parseListCsv(text, { knownId: id => !!store.get(id) });
  assert.deepEqual(warnings, []);
  assert.equal(lines.length, 25);

  const expected = lists.rows().map(r => ({ vrg_id: r.vrg_id, mennyiseg: r.mennyiseg, megjegyzes: r.megjegyzes }));
  for (const line of lines) {
    const want = expected.find(e => e.vrg_id === line.vrg_id);
    assert.equal(line.mennyiseg, want.mennyiseg, line.vrg_id);
    assert.equal(line.megjegyzes || '', want.megjegyzes || '', line.vrg_id);
  }
});

test('a grouped, header-bearing export still re-imports, ignoring the group headings', () => {
  const { store, lists, ctx } = setup();
  const items = store.query({ limit: 15 });
  lists.create('L');
  items.forEach(it => lists.setQty(it.vrg_id, 2));

  const key = r => (r.item ? r.item.kategoria_javaslat.al || 'x' : 'x');
  const text = ex.csv({
    rows: ex.orderByCategory(lists.rows(), key, []),
    columns: pick(listFields(), ['vrg_id', 'megnevezes', 'mennyiseg'], ctx),
    ctx, dialect: 'excel-hu', groupBy: key
  });
  assert.ok(text.split('\r\n').length > 16, 'headings really are in the file');

  const { lines } = im.parseListCsv(text, { knownId: id => !!store.get(id) });
  assert.equal(lines.length, 15, 'group headings are skipped, not imported as rows');
  assert.ok(lines.every(l => l.mennyiseg === 2));
});

test('import refuses a file without the columns it needs', () => {
  assert.throws(() => im.parseListCsv('nev;ar\nvalami;12\n'), /vrg_id/);
  assert.throws(() => im.parseListCsv('vrg_id;nev\nVRG-0001;valami\n'), /mennyiseg/);
});

test('import reports bad rows instead of inventing data', () => {
  const text = 'vrg_id;mennyiseg\nVRG-0001;3\nVRG-0001;2\nVRG-0002;0\nVRG-9999;5\nnem-azonosito;7\n';
  const { lines, warnings } = im.parseListCsv(text, { knownId: id => ['VRG-0001', 'VRG-0002'].includes(id) });
  assert.deepEqual(lines, [{ vrg_id: 'VRG-0001', mennyiseg: 5 }], 'the duplicate is summed');
  assert.ok(warnings.some(w => /többször/.test(w)));
  assert.ok(warnings.some(w => /VRG-0002/.test(w)));
  assert.ok(warnings.some(w => /VRG-9999/.test(w)));
});

// ------------------------------------------------------------ dual text
test('dual text carries a human block and a machine block that parses back', () => {
  const { store, ctx } = setup();
  const rows = store.query({ limit: 8 });
  const fields = pick(catalogFields(COLUMNS), ['vrg_id', 'megnevezes', 'netto'], ctx);

  const text = ex.dualText({
    title: 'TESZT',
    meta: { schema: 'vrg-inventory', schema_version: '2.0.0', generated: '2026-09-20' },
    preamble: ['Emberi bevezető.'],
    aiNotes: ['@note  gépi megjegyzés'],
    rows, columns: fields, ctx,
    groupBy: it => it.kategoria_javaslat.fo || 'x'
  });

  assert.ok(text.includes('TESZT'));
  assert.ok(text.includes('Emberi bevezető.'));
  assert.ok(text.includes('AI-CONTEXT BLOCK'));

  const parsed = im.parseDualText(text);
  assert.equal(parsed.meta.schema, 'vrg-inventory');
  assert.equal(parsed.meta.row_count, '8');
  assert.deepEqual(parsed.columns, ['vrg_id', 'megnevezes', 'netto']);
  assert.equal(parsed.rows.length, 8);
  assert.deepEqual(parsed.rows.map(r => r.vrg_id), rows.map(r => r.vrg_id));
});

test('parsing a text without the machine block fails loudly', () => {
  assert.throws(() => im.parseDualText('csak sima szöveg'), /@data_tsv/);
});

// --------------------------------------------------------- vendor order
test('the vendor order refuses to run without a vendor', () => {
  assert.throws(() => ex.vendorOrder({ rows: [], vendor: null }), /needs a selected vendor/);
});

test('the vendor order lists the vendor article number, not ours', () => {
  const { store, lists } = setup();
  const it = store.items.find(i => i.vendors.daniella.cikkszam);
  lists.create('L');
  lists.setQty(it.vrg_id, 4);
  store.vendors.select('daniella');

  const rows = lists.rows().map(r => ({
    cikkszam: store.vendors.read(r.item, 'v_cikkszam'),
    mennyiseg: r.mennyiseg, egyseg: r.item.egyseg, megnevezes: r.item.megnevezes
  }));
  const text = ex.vendorOrder({
    rows, vendor: store.vendors.selectedVendor(), listName: 'L', date: '2026-09-20', totals: lists.totals()
  });

  assert.ok(text.includes(it.vendors.daniella.cikkszam));
  assert.ok(text.includes('DANIELLA'));
  assert.ok(!text.includes(it.vrg_id), 'our internal id is meaningless to the vendor');
});

// ------------------------------------------------------- the vendor gate
test('exports obey the vendor gate exactly like the table does', () => {
  const { store, ctx } = setup();
  const fields = catalogFields(COLUMNS);

  const neutral = visibleFields(fields, ctx).map(f => f.id);
  assert.ok(!neutral.some(id => id.startsWith('v_')), 'no vendor field offered in neutral mode');
  assert.ok(!neutral.includes('legacy_id'), 'legacy_id is the vendor code verbatim');

  const text = ex.csv({
    rows: store.query({ limit: 30 }),
    columns: pick(fields, ['vrg_id', 'megnevezes', 'v_cikkszam', 'legacy_id'], ctx),
    ctx, dialect: 'standard'
  });
  for (const it of store.query({ limit: 30 })) {
    assert.ok(!text.includes(it.vendors.daniella.cikkszam), 'a vendor code reached a neutral export');
  }

  store.vendors.select('daniella');
  const withVendor = visibleFields(fields, ctx).map(f => f.id);
  assert.ok(withVendor.includes('v_cikkszam'));
  assert.ok(withVendor.includes('legacy_id'));
});

// ---------------------------------------------------------------- profiles
test('built-in profiles exist and editing one forks instead of overwriting', () => {
  const { profiles } = setup();
  const built = profiles.all().filter(p => p.builtin);
  assert.equal(built.length, defaults().length);

  const p = built[0];
  const edited = profiles.update(p.id, { columns: ['vrg_id'] });
  assert.notEqual(edited.id, p.id);
  assert.equal(edited.builtin, false);
  assert.match(edited.nev, /saját/);
  assert.deepEqual(profiles.get(p.id).columns, p.columns, 'the built-in is untouched');
});

test('a built-in profile cannot be deleted, a custom one can', () => {
  const { profiles } = setup();
  const builtin = profiles.all().find(p => p.builtin);
  assert.equal(profiles.remove(builtin.id), false);
  const mine = profiles.create({ nev: 'Saját', target: 'lista', format: 'csv', columns: ['vrg_id'] });
  assert.equal(profiles.remove(mine.id), true);
  assert.equal(profiles.get(mine.id), null);
});

test('a hand-edited profile is sanitised, not trusted', () => {
  const p = sanitizeProfile({
    id: 'x', nev: '  ', target: 'hekk', format: 'exe',
    columns: ['vrg_id', 'nincs_ilyen'], categoryOrder: 'nem tömb'
  }, id => id === 'vrg_id');
  assert.equal(p.nev, 'Névtelen profil');
  assert.equal(p.target, 'katalogus');
  assert.equal(p.format, 'csv');
  assert.deepEqual(p.columns, ['vrg_id']);
  assert.deepEqual(p.categoryOrder, []);
});

test('profiles survive export and re-import of the user document', () => {
  const { store, userdata, profiles } = setup();
  profiles.create({ nev: 'Saját profil', target: 'lista', format: 'tsv', columns: ['vrg_id', 'mennyiseg'], categoryOrder: ['A', 'B'] });

  const file = JSON.parse(JSON.stringify(userdata.serialize()));
  const { doc } = sanitize(file, id => !!store.get(id));
  const ud2 = createUserData(doc);
  const p2 = createProfiles({ userdata: ud2 });

  const mine = p2.all().find(p => p.nev === 'Saját profil');
  assert.ok(mine, 'the custom profile made the trip');
  assert.equal(mine.format, 'tsv');
  assert.deepEqual(mine.columns, ['vrg_id', 'mennyiseg']);
  assert.deepEqual(mine.categoryOrder, ['A', 'B']);
});

test('a userdata document from an older phase migrates forward', () => {
  const old = {
    schema: 'vrg-userdata', schema_version: '1.1.0',
    created: 'x', updated: 'x', items: {}, lists: {}, activeList: null, ui: {}
  };
  const ud = createUserData(old);
  assert.equal(ud.doc.schema_version, USERDATA_VERSION);
  assert.deepEqual(ud.doc.exportProfiles, []);
  const p = createProfiles({ userdata: ud });
  assert.ok(p.all().length >= 3, 'an empty array means "use the defaults"');
});
