// The data contract. Every other module reads field metadata from here rather
// than hard-coding property names, so adding or renaming a field is one edit.

const SCHEMA_NAME = 'vrg-inventory';
const SCHEMA_VERSION = '2.1.0';
const VAT_RATE = 0.27;

// Field groups drive column grouping, export profiles and the vendor gate.
const GROUP = {
  identity: 'Azonosítás',
  classification: 'Besorolás',
  physical: 'Fizikai adatok',
  price: 'Ár',
  usage: 'Felhasználás',
  user: 'Saját adatok',
  vendor: 'Beszállítói adatok',
  provenance: 'Forrás'
};

// path: dotted access into the item object. "vendors.*" is resolved against
// the selected vendor and is only ever readable through core/vendors.js.
const FIELDS = [
  { key: 'vrg_id', path: 'vrg_id', label: 'VRG azonosító', type: 'string', group: 'identity', required: true },
  { key: 'megnevezes', path: 'megnevezes', label: 'Megnevezés', type: 'string', group: 'identity', required: true },
  { key: 'marka_gyarto', path: 'marka_gyarto', label: 'Márka / Gyártó', type: 'string', group: 'identity' },
  { key: 'gyartoi_cikkszam', path: 'gyartoi_cikkszam', label: 'Gyártói cikkszám', type: 'string', group: 'identity' },
  { key: 'gtin', path: 'gtin', label: 'GTIN / EAN', type: 'string', group: 'identity', note: 'Beszállító-független globális azonosító — ezen lehet a legbiztosabban összepárosítani egy második beszállító termékeit.' },
  { key: 'legacy_id', path: 'legacy_id', label: 'Régi azonosító', type: 'string', group: 'provenance', note: 'A Phase 0 pillanatkép kulcsa. Kereséshez nem használandó.' },

  { key: 'kategoria_fo', path: 'kategoria.fo', label: 'Kategória (fő)', type: 'string', group: 'classification', editable: true },
  { key: 'kategoria_al', path: 'kategoria.al', label: 'Kategória (al)', type: 'string', group: 'classification', editable: true },
  { key: 'kategoria_ut', path: 'kategoria.ut', label: 'Kategória útvonal', type: 'string', group: 'classification', editable: true },
  { key: 'kategoria_forras', path: 'kategoria.forras', label: 'Kategória forrása', type: 'string', group: 'classification' },
  { key: 'kategoria_javaslat_fo', path: 'kategoria_javaslat.fo', label: 'Javasolt kategória (fő)', type: 'string', group: 'classification', provisional: true },
  { key: 'kategoria_javaslat_al', path: 'kategoria_javaslat.al', label: 'Javasolt kategória (al)', type: 'string', group: 'classification', provisional: true },

  { key: 'tomeg_kg', path: 'tomeg_kg', label: 'Tömeg (kg)', type: 'number', group: 'physical', editable: true },
  { key: 'egyseg', path: 'egyseg', label: 'Egység', type: 'enum', values: ['db', 'fm', 'pár'], group: 'physical' },
  { key: 'gyartoi_termek_link', path: 'gyartoi_termek_link', label: 'Gyártói termék link', type: 'url', group: 'physical', editable: true },

  { key: 'becsult_netto', path: 'becsult_ar.netto_huf', label: 'Becsült nettó ár', type: 'number', group: 'price', unit: 'HUF' },
  { key: 'becsult_brutto', path: 'becsult_ar.brutto_huf', label: 'Becsült bruttó ár', type: 'number', group: 'price', unit: 'HUF' },
  { key: 'ar_datum', path: 'becsult_ar.datum', label: 'Ár megfigyelve', type: 'date', group: 'price' },

  { key: 'rendelesek_szama', path: 'felhasznalas.rendelesek_szama', label: 'Rendelések száma', type: 'number', group: 'usage' },
  { key: 'osszes_mennyiseg', path: 'felhasznalas.osszes_rendelt_mennyiseg', label: 'Összes rendelt', type: 'number', group: 'usage' },
  { key: 'elso_rendeles', path: 'felhasznalas.elso_rendeles', label: 'Első rendelés', type: 'date', group: 'usage' },
  { key: 'utolso_rendeles', path: 'felhasznalas.utolso_rendeles', label: 'Utolsó rendelés', type: 'date', group: 'usage' },

  { key: 'v_cikkszam', path: 'vendors.*.cikkszam', label: 'Cikkszám', type: 'string', group: 'vendor', vendor: true },
  { key: 'v_netto', path: 'vendors.*.netto_egysegar_huf', label: 'Nettó egységár', type: 'number', group: 'vendor', vendor: true, unit: 'HUF' },
  { key: 'v_brutto', path: 'vendors.*.brutto_egysegar_huf', label: 'Bruttó egységár', type: 'number', group: 'vendor', vendor: true, unit: 'HUF' },
  { key: 'v_listaar', path: 'vendors.*.listaar_netto_huf', label: 'Listaár (nettó)', type: 'number', group: 'vendor', vendor: true, unit: 'HUF' },
  { key: 'v_engedmeny', path: 'vendors.*.engedmeny_szazalek', label: 'Engedmény %', type: 'string', group: 'vendor', vendor: true },
  { key: 'v_kiszereles', path: 'vendors.*.kiszereles', label: 'Kiszerelés', type: 'string', group: 'vendor', vendor: true },
  { key: 'v_kiszereles_db', path: 'vendors.*.kiszereles_mennyiseg', label: 'Kiszerelés mennyiség', type: 'number', group: 'vendor', vendor: true },
  { key: 'v_aktualis_brutto', path: 'vendors.*.aktualis_brutto_ar_huf', label: 'Aktuális bruttó ár', type: 'number', group: 'vendor', vendor: true, unit: 'HUF' },
  { key: 'v_keszlet', path: 'vendors.*.keszlet_db', label: 'Készlet', type: 'number', group: 'vendor', vendor: true },
  { key: 'v_link', path: 'vendors.*.termek_link', label: 'Termék link', type: 'url', group: 'vendor', vendor: true },
  { key: 'v_ellenorizve', path: 'vendors.*.ar_ellenorizve', label: 'Ár ellenőrizve', type: 'date', group: 'vendor', vendor: true },

  { key: 'forras', path: 'forras', label: 'Forrás', type: 'string', group: 'provenance' }
];

const FIELD_BY_KEY = new Map(FIELDS.map(f => [f.key, f]));

function field(key) {
  const f = FIELD_BY_KEY.get(key);
  if (!f) throw new Error('unknown field: ' + key);
  return f;
}

function fieldsOf(group) {
  return FIELDS.filter(f => f.group === group);
}

/** Read a dotted path. Vendor paths are rejected here on purpose — they must
 *  go through core/vendors.js so the visibility rule has exactly one gate. */
function get(item, path) {
  if (path.startsWith('vendors.')) {
    throw new Error('vendor fields must be read through core/vendors.js: ' + path);
  }
  let v = item;
  for (const part of path.split('.')) {
    if (v == null) return null;
    v = v[part];
  }
  return v === undefined ? null : v;
}

/** Read by field key. Same rule: vendor keys are refused. */
function value(item, key) {
  return get(item, field(key).path);
}

// ---------------------------------------------------------------- validation
const TYPE_OK = {
  string: v => typeof v === 'string',
  number: v => typeof v === 'number' && Number.isFinite(v),
  date: v => typeof v === 'string' && /^\d{4}[.-]\d{2}[.-]\d{2}\.?$/.test(v),
  url: v => typeof v === 'string' && /^https?:\/\//.test(v),
  enum: (v, f) => f.values.includes(v)
};

function validateItem(item, index) {
  const errors = [];
  const where = item && item.vrg_id ? item.vrg_id : '#' + index;
  for (const f of FIELDS) {
    if (f.vendor) continue;
    const v = get(item, f.path);
    if (v == null || v === '') {
      if (f.required) errors.push(`${where}: ${f.key} is required`);
      continue;
    }
    const ok = TYPE_OK[f.type];
    if (ok && !ok(v, f)) errors.push(`${where}: ${f.key} is not a valid ${f.type} (${JSON.stringify(v)})`);
  }
  if (item.vrg_id && !/^VRG-\d{4,}$/.test(item.vrg_id)) {
    errors.push(`${where}: vrg_id must look like VRG-0001`);
  }
  return errors;
}

function validateDocument(doc) {
  const errors = [];
  if (doc.schema !== SCHEMA_NAME) errors.push(`schema must be "${SCHEMA_NAME}", got ${JSON.stringify(doc.schema)}`);
  if (doc.schema_version !== SCHEMA_VERSION) errors.push(`schema_version must be ${SCHEMA_VERSION}, got ${doc.schema_version}`);
  if (!Array.isArray(doc.items)) { errors.push('items must be an array'); return errors; }
  const seen = new Set();
  doc.items.forEach((it, i) => {
    if (seen.has(it.vrg_id)) errors.push(`duplicate vrg_id: ${it.vrg_id}`);
    seen.add(it.vrg_id);
    errors.push(...validateItem(it, i));
  });
  return errors;
}

// ---------------------------------------------------------------- migration
// Each step takes a document at version `from` and returns it at `to`.
// Steps are pure and must be safe to re-run on an already-migrated document
// only in the sense that migrate() never applies a step twice.
const MIGRATIONS = [
  {
    from: '1.0.0', to: '2.0.0',
    // 1.0.0 used the DANIELLA article number as the primary key. 2.0.0 gives
    // every item a neutral vrg_id and keeps the old value as legacy_id.
    apply(doc, opts) {
      const idMap = (opts && opts.idMap) || {};
      doc.items = doc.items.map(it => {
        const legacy = it.id;
        const rest = Object.assign({}, it);
        delete rest.id;
        return Object.assign({
          vrg_id: idMap[legacy] || 'VRG-LEGACY-' + legacy,
          legacy_id: legacy
        }, rest);
      });
      doc.schema_version = '2.0.0';
      return doc;
    }
  },
  {
    from: '2.0.0', to: '2.1.0',
    // Phase 6 filled the official category from the vendor's own catalogue and
    // added GTIN. Older documents simply lack the fields — nothing to rewrite.
    apply(doc) {
      for (const it of doc.items) {
        if (it.gtin === undefined) it.gtin = null;
        if (it.kategoria && it.kategoria.forras === undefined) it.kategoria.forras = null;
      }
      doc.schema_version = '2.1.0';
      return doc;
    }
  }
];

function migrate(doc, opts) {
  let d = JSON.parse(JSON.stringify(doc));
  let guard = 0;
  while (d.schema_version !== SCHEMA_VERSION) {
    const step = MIGRATIONS.find(m => m.from === d.schema_version);
    if (!step) throw new Error('no migration path from schema_version ' + d.schema_version);
    d = step.apply(d, opts);
    if (++guard > 50) throw new Error('migration loop');
  }
  return d;
}

export {
  SCHEMA_NAME, SCHEMA_VERSION, VAT_RATE, GROUP, FIELDS,
  field, fieldsOf, get, value, validateItem, validateDocument, migrate
};
