// Phase 0 pipeline, final stage: write the published data files.
// Emits schema 2.0.0 — vrg_id is the primary key, the DANIELLA article number
// lives only in the vendor block (and, for traceability, as legacy_id).
const fs = require('fs'), path = require('path');
const { assign } = require('./ids.js');
const { CACHE, PDFITEMS } = require('./paths.js');

const rows = JSON.parse(fs.readFileSync(CACHE + '/rows.json', 'utf8'));
const emails = JSON.parse(fs.readFileSync(CACHE + '/emails.json', 'utf8'));
const pdfs = JSON.parse(fs.readFileSync(PDFITEMS, 'utf8'));

const OUT = process.argv[2];
const DATA = path.join(OUT, 'data');
fs.mkdirSync(DATA, { recursive: true });
fs.mkdirSync(path.join(OUT, 'docs'), { recursive: true });

const TODAY = '2026-09-19';
const SCHEMA = '2.1.0';

// ------------------------------------------------------------ stable ids
const { map: IDS, assigned, reused } = assign(
  path.join(DATA, 'vrg-id-registry.json'),
  rows.map(r => r.id).sort()            // sort => first assignment is deterministic
);
for (const r of rows) { r.vrg_id = IDS[r.id]; r.legacy_id = r.id; }
rows.sort((a, b) => a.vrg_id.localeCompare(b.vrg_id));

// ------------------------------------------------------------- CSV utils
// Excel-HU flavour: ";" separator, decimal comma, UTF-8 BOM.
const hu = v => (typeof v === 'number' ? String(v).replace('.', ',') : v == null ? '' : String(v));
const cell = v => {
  const s = hu(v);
  return /[";\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const csv = (header, lines) =>
  '﻿' + [header.join(';'), ...lines.map(r => r.map(cell).join(';'))].join('\r\n') + '\r\n';

// ----------------------------------------------------------------- items
const COLS = [
  'vrg_id', 'megnevezes', 'marka_gyarto', 'gyartoi_cikkszam', 'gtin',
  'kategoria_fo', 'kategoria_al', 'kategoria_ut', 'kategoria_forras',
  'kategoria_javaslat_fo', 'kategoria_javaslat_al',
  'tomeg_kg', 'egyseg',
  'becsult_netto_ar_huf', 'becsult_brutto_ar_huf', 'ar_megfigyeles_datum',
  'gyartoi_termek_link', 'megjegyzes', 'kedvenc',
  'daniella_cikkszam', 'daniella_netto_egysegar_huf', 'daniella_brutto_egysegar_huf',
  'daniella_listaar_netto_huf', 'daniella_engedmeny_szazalek',
  'daniella_kiszereles', 'daniella_kiszereles_mennyiseg',
  'daniella_aktualis_brutto_ar_huf', 'daniella_keszlet_db', 'daniella_termek_link',
  'daniella_ar_ellenorizve',
  'rendelesek_szama', 'osszes_rendelt_mennyiseg', 'elso_rendeles', 'utolso_rendeles',
  'legacy_id', 'forras'
];
fs.writeFileSync(path.join(DATA, 'vrg-inventory.csv'),
  csv(COLS, rows.map(r => COLS.map(c => r[c]))), 'utf8');

// ------------------------------------------------------------------ JSON
const nn = v => (v === '' || v === undefined ? null : v);
const json = {
  schema: 'vrg-inventory',
  schema_version: SCHEMA,
  generated: TODAY,
  currency: 'HUF',
  afa_kulcs: 0.27,
  vendors: [{
    id: 'daniella',
    nev: 'DANIELLA Kereskedelmi Kft.',
    weboldal: 'https://daniella.hu',
    megjegyzes: 'Az árak partner-specifikus, kedvezményes nettó egységárak a megrendelés-visszaigazolásokból. NEM a weboldal bruttó listaárai.'
  }],
  field_notes: {
    vrg_id: 'Elsődleges kulcs. Soha nem változik; a kiosztást a data/vrg-id-registry.json őrzi.',
    legacy_id: 'A Phase 0 pillanatkép elsődleges kulcsa (DANIELLA cikkszám). Csak visszakövethetőségre, kereséshez nem használandó.',
    kategoria_fo: 'A DANIELLA webshop hivatalos kategóriája (kategoria.forras = daniella-webshop). Tudatos döntés: az ő taxonómiájukat vettük át házon belüli kategóriarendszernek.',
    gtin: 'EAN/GTIN a gyártótól - beszállító-független, a legmegbízhatóbb kulcs egy második beszállító termékeinek összepárosításához.',
    kategoria_javaslat_fo: 'AI által javasolt ideiglenes kategória a megnevezés alapján - NEM hivatalos',
    tomeg_kg: 'A DANIELLA termékadatlapról (kg).',
    gyartoi_termek_link: 'A gyártó saját adatlapja, ahol elérhető; egyébként a beszállító által tárolt dokumentum.',
    daniella_aktualis_brutto_ar_huf: 'A webshop bruttó listaára a lekérdezés pillanatában - NEM a mi partner-árunk.',
    daniella_keszlet_db: 'A webshop által jelzett készlet a lekérdezés pillanatában.',
    daniella_termek_link: 'A termék oldala a webshopban.',
    becsult_brutto_ar_huf: 'becsult_netto_ar_huf * 1,27, kerekítve - nyers becslés, nem ajánlat'
  },
  items: rows.map(r => ({
    vrg_id: r.vrg_id,
    legacy_id: r.legacy_id,
    megnevezes: r.megnevezes,
    marka_gyarto: nn(r.marka_gyarto),
    gyartoi_cikkszam: nn(r.gyartoi_cikkszam),
    gtin: nn(r.gtin),
    kategoria: {
      fo: nn(r.kategoria_fo), al: nn(r.kategoria_al), ut: nn(r.kategoria_ut),
      forras: nn(r.kategoria_forras)
    },
    kategoria_javaslat: { fo: nn(r.kategoria_javaslat_fo), al: nn(r.kategoria_javaslat_al), forras: 'AI-javaslat' },
    tomeg_kg: nn(r.tomeg_kg),
    egyseg: nn(r.egyseg),
    becsult_ar: {
      netto_huf: nn(r.becsult_netto_ar_huf),
      brutto_huf: nn(r.becsult_brutto_ar_huf),
      datum: nn(r.ar_megfigyeles_datum),
      forras: 'daniella-rendeles'
    },
    gyartoi_termek_link: nn(r.gyartoi_termek_link),
    felhasznalas: {
      rendelesek_szama: r.rendelesek_szama,
      osszes_rendelt_mennyiseg: r.osszes_rendelt_mennyiseg,
      elso_rendeles: nn(r.elso_rendeles),
      utolso_rendeles: nn(r.utolso_rendeles)
    },
    vendors: {
      daniella: {
        cikkszam: r.daniella_cikkszam,
        netto_egysegar_huf: nn(r.daniella_netto_egysegar_huf),
        brutto_egysegar_huf: nn(r.daniella_brutto_egysegar_huf),
        listaar_netto_huf: nn(r.daniella_listaar_netto_huf),
        engedmeny_szazalek: nn(r.daniella_engedmeny_szazalek),
        kiszereles: nn(r.daniella_kiszereles),
        kiszereles_mennyiseg: nn(r.daniella_kiszereles_mennyiseg),
        aktualis_brutto_ar_huf: nn(r.daniella_aktualis_brutto_ar_huf),
        keszlet_db: nn(r.daniella_keszlet_db),
        termek_link: nn(r.daniella_termek_link),
        ar_ellenorizve: nn(r.daniella_ar_ellenorizve),
        ar_elozmeny: r.ar_elozmeny
      }
    },
    nev_valtozatok: r.nev_valtozatok,
    forras: r.forras
  }))
};
fs.writeFileSync(path.join(DATA, 'vrg-inventory.json'), JSON.stringify(json, null, 1), 'utf8');

// --------------------------------------------------------- price history
const ph = [];
for (const r of rows) for (const p of r.ar_elozmeny)
  ph.push([r.vrg_id, r.legacy_id, p.date || '', p.order || '', 'daniella',
  p.netto_egysegar, Math.round(p.netto_egysegar * 1.27), p.src]);
ph.sort((a, b) => (a[0] + a[2]).localeCompare(b[0] + b[2]));
fs.writeFileSync(path.join(DATA, 'vrg-price-history.csv'),
  csv(['vrg_id', 'legacy_id', 'datum', 'bizonylat', 'vendor', 'netto_egysegar_huf',
    'szamitott_brutto_huf', 'forras_tipus'], ph), 'utf8');

// ---------------------------------------------------------------- orders
const ord = [];
for (const e of emails) for (const i of e.items)
  ord.push([e.orderNo || '', e.kelt || '', e.type, IDS[i.cikkszam] || '', i.cikkszam, i.nev,
  i.mennyiseg || '', i.kiszereles || i.egyseg || '', i.netto_egysegar ?? '',
  i.brutto_ertek ?? '', e.hivatkozas || '', e.file]);
for (const p of pdfs) for (const i of p.items)
  ord.push([p.meta.orderNo || '', p.meta.date || '', 'pdf:' + (p.meta.docType || '?'),
  IDS[i.cikkszam] || '', i.cikkszam, (i.nev || '').replace(/\s*Hivatkozás:.*$/, ''),
  i.mennyiseg, i.egyseg, i.netto_egysegar, '', '', p.meta.file]);
fs.writeFileSync(path.join(DATA, 'vrg-orders.csv'),
  csv(['bizonylat', 'datum', 'tipus', 'vrg_id', 'daniella_cikkszam', 'megnevezes_a_bizonylaton',
    'mennyiseg', 'egyseg_kiszereles', 'netto_egysegar_huf', 'brutto_ertek_huf',
    'hivatkozas', 'forras_fajl'], ord), 'utf8');

// ------------------------------------------------------------ categories
const SEP = String.fromCharCode(31);   // unit separator: cannot occur in a category name
const cats = new Map();
for (const r of rows) {
  const k = r.kategoria_javaslat_fo + SEP + r.kategoria_javaslat_al;
  cats.set(k, (cats.get(k) || 0) + 1);
}
const catRows = [...cats.entries()]
  .map(([k, n]) => { const [f, a] = k.split(SEP); return [f || '(besorolatlan)', a || '(besorolatlan)', n, '', '']; })
  .sort((x, y) => (x[0] + x[1]).localeCompare(y[0] + y[1]));
fs.writeFileSync(path.join(DATA, 'vrg-categories.csv'),
  csv(['javaslat_fo', 'javaslat_al', 'tetelszam', 'daniella_hivatalos_kategoria', 'daniella_kategoria_ut'], catRows), 'utf8');

console.log('schema', SCHEMA, '| items', rows.length, '| ids assigned', assigned, 'reused', reused,
  '| price points', ph.length, '| order lines', ord.length, '| categories', catRows.length);
