// Dual-layer plain-text export: human-readable section on top,
// machine/agent-readable section below. This is the reference implementation
// of the export format the interactive HTML app must reproduce.
const fs = require('fs'), path = require('path');
const { CACHE } = require('./paths.js');
const { load } = require('./ids.js');
const IDS = load(__dirname + '/../data/vrg-id-registry.json').map;
const rows = JSON.parse(fs.readFileSync(CACHE + '/rows.json', 'utf8'));
const OUT = process.argv[2];
const TODAY = '2026-09-19';
const SCHEMA = '2.0.0';

const L = [];
const rule = c => c.repeat(78);
const fmt = n => (n === '' || n == null ? '—' : Number(n).toLocaleString('hu-HU') + ' Ft');

// ============================================================ HUMAN SECTION
L.push(rule('='));
L.push('VRG KÉSZLET-ADATBÁZIS — TÉTELLISTA');
L.push('Generálva: ' + TODAY + '   |   Séma: vrg-inventory v' + SCHEMA + '   |   ' + rows.length + ' tétel');
L.push(rule('='));
L.push('');
L.push('Az árak nettó egységárak forintban, a DANIELLA megrendelés-');
L.push('visszaigazolásokból kiolvasva (partner-specifikus, kedvezményes árak).');
L.push('A bruttó oszlop 27% ÁFA-val számított BECSLÉS, nem ajánlat.');
L.push('A kategóriák egyelőre AI-javaslatok; a hivatalos Daniella-kategóriák');
L.push('még nincsenek kitöltve. Üres mező = még nem gyűjtött adat.');
L.push('');

const groups = new Map();
for (const r of rows) {
  const k = (r.kategoria_javaslat_fo || '(besorolatlan)') + ' / ' + (r.kategoria_javaslat_al || '(besorolatlan)');
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(r);
}
for (const k of [...groups.keys()].sort((a, b) => a.localeCompare(b, 'hu'))) {
  const g = groups.get(k).sort((a, b) => a.megnevezes.localeCompare(b.megnevezes, 'hu'));
  L.push(rule('-'));
  L.push(k.toUpperCase() + '   (' + g.length + ' tétel)');
  L.push(rule('-'));
  for (const r of g) {
    L.push('  ' + (IDS[r.id] + ' ').padEnd(11) + (r.id + ' ').padEnd(20) + r.megnevezes);
    const bits = [];
    if (r.marka_gyarto) bits.push('gyártó: ' + r.marka_gyarto);
    if (r.gyartoi_cikkszam) bits.push('gyártói cikkszám: ' + r.gyartoi_cikkszam);
    if (r.egyseg) bits.push('egység: ' + r.egyseg);
    if (r.daniella_kiszereles) bits.push('kiszerelés: ' + r.daniella_kiszereles);
    L.push('  ' + ' '.repeat(31) + bits.join('  |  '));
    const p = [];
    p.push('nettó ' + fmt(r.becsult_netto_ar_huf));
    p.push('bruttó~ ' + fmt(r.becsult_brutto_ar_huf));
    if (r.daniella_listaar_netto_huf !== '') p.push('Daniella listaár ' + fmt(r.daniella_listaar_netto_huf) + ' (-' + r.daniella_engedmeny_szazalek + '%)');
    if (r.ar_megfigyeles_datum) p.push('ár dátuma: ' + r.ar_megfigyeles_datum);
    L.push('  ' + ' '.repeat(31) + p.join('  |  '));
    if (r.rendelesek_szama) {
      L.push('  ' + ' '.repeat(31) + 'eddig rendelve: ' + r.osszes_rendelt_mennyiseg + ' ' + (r.egyseg || '') +
        ' / ' + r.rendelesek_szama + ' rendelésben (' + r.elso_rendeles + ' – ' + r.utolso_rendeles + ')');
    }
    L.push('');
  }
}

// ========================================================== MACHINE SECTION
L.push('');
L.push(rule('='));
L.push('AI-CONTEXT BLOCK — MACHINE READABLE. Everything below this line is');
L.push('written for an AI agent / importer, not for a human reader.');
L.push(rule('='));
L.push('');
L.push('@schema            vrg-inventory');
L.push('@schema_version    ' + SCHEMA);
L.push('@generated         ' + TODAY);
L.push('@row_count         ' + rows.length);
L.push('@currency          HUF');
L.push('@vat_rate          0.27');
L.push('@primary_key       vrg_id   (neutral; the DANIELLA article number lives in the vendor block, and as legacy_id)');
L.push('@encoding          UTF-8, LF line endings');
L.push('@decimal_separator "." inside this block (the CSV siblings use "," for Excel-HU)');
L.push('');
L.push('@purpose');
L.push('  Vendor-independent core inventory of electrical installation material used');
L.push('  by VARLER GROUP. Vendor-specific facts (article number, price, stock, product');
L.push('  URL) live in a per-vendor sub-record and must only be shown when the user has');
L.push('  selected that vendor. With no vendor selected, show only the vendor-neutral');
L.push('  fields plus the rough price estimate.');
L.push('');
L.push('@provenance');
L.push('  Built from 53 DANIELLA e-mails (order confirmations, order-modification');
L.push('  notices, one goods-arrival notice), 3 DANIELLA PDFs (1 order confirmation with');
L.push('  list price + discount %, 2 quotations) and 4 working spreadsheets.');
L.push('  See docs/SOURCES.md for the file list and the extraction rules.');
L.push('');
L.push('@field_semantics');
L.push('  id                              string  DANIELLA article number, doubles as internal id');
L.push('  megnevezes                      string  longest observed product name across all sources');
L.push('  marka_gyarto                    string  brand; from the name text, else from the code prefix; "" = unknown');
L.push('  gyartoi_cikkszam                string  manufacturer part no.; id with the brand prefix stripped, kept ONLY');
L.push('                                          when the remainder also occurs in the product name; "" = not confirmed');
L.push('  kategoria_fo/al/ut              string  OFFICIAL DANIELLA category. EMPTY ON PURPOSE - to be collected online.');
L.push('                                          Target shape: al="Süllyesztett kötődobozok és fedelek",');
L.push('                                          ut="/Szerelvény- és kötődobozok/Installáció technika/"');
L.push('  kategoria_javaslat_fo/al        string  PROVISIONAL AI guess from keyword rules. Never treat as vendor truth.');
L.push('  tomeg_kg                        number  EMPTY - to be collected from manufacturer datasheets');
L.push('  egyseg                          string  db | fm | pár');
L.push('  becsult_netto_ar_huf            number  latest observed net unit price');
L.push('  becsult_brutto_ar_huf           number  becsult_netto_ar_huf * 1.27, rounded. ESTIMATE, not an offer.');
L.push('  ar_megfigyeles_datum            date    YYYY.MM.DD, date of the document that produced the price');
L.push('  gyartoi_termek_link             url     EMPTY - to be collected');
L.push('  megjegyzes / kedvenc            user    user-owned fields, always empty in a freshly generated export');
L.push('  daniella_*                      vendor  vendor block, see @vendor_block');
L.push('  rendelesek_szama                int     number of distinct orders this item appeared in');
L.push('  osszes_rendelt_mennyiseg        number  total quantity ordered so far (duplicate order revisions collapsed)');
L.push('  elso_rendeles / utolso_rendeles date    first / last order date');
L.push('  forras                          string  which source types contributed to this row');
L.push('');
L.push('@vendor_block daniella');
L.push('  cikkszam                        = id');
L.push('  netto_egysegar_huf              partner-specific discounted NET unit price from an order document');
L.push('  listaar_netto_huf               DANIELLA net list price (only in the PDF order confirmation)');
L.push('  engedmeny_szazalek              discount % applied to the list price');
L.push('  kiszereles / kiszereles_mennyiseg  pack size as printed, e.g. "100 db"');
L.push('  aktualis_brutto_ar_huf          EMPTY - the webshop gross price, filled by the "Árak frissítése" feature');
L.push('  keszlet_db                      EMPTY - webshop stock');
L.push('  termek_link                     EMPTY - webshop product URL');
L.push('  ar_ellenorizve                  EMPTY - timestamp of the last webshop price check');
L.push('  ar_elozmeny                     full observed price history, see data/vrg-price-history.csv');
L.push('');
L.push('@known_gaps');
L.push('  - official DANIELLA categories: 0 / ' + rows.length + ' filled');
L.push('  - weights: 0 / ' + rows.length + ' filled');
L.push('  - manufacturer product links: 0 / ' + rows.length + ' filled');
L.push('  - vendor webshop price / stock / link: 0 / ' + rows.length + ' filled');
L.push('  - brand unknown: ' + rows.filter(r => !r.marka_gyarto).length + ' rows (mostly DANIELLA house cable codes KAB*/VEZ*)');
L.push('  - manufacturer part no. unconfirmed: ' + rows.filter(r => !r.gyartoi_cikkszam).length + ' rows');
L.push('  - no price observed: ' + rows.filter(r => r.becsult_netto_ar_huf === '').length + ' rows (mentioned only in a spreadsheet or arrival notice)');
L.push('');
L.push('@rebuild');
L.push('  1. Parse the .eml files: base64/quoted-printable body -> HTML. Item rows match');
L.push('     /<tr height="18px"[^>]*>/ ; cells are Cikkszám, Megnevezés, Kiszerelés, Rendelt,');
L.push('     Kiadható, Egységár, Nettó, Bruttó, Határidő. In "FIGYELEM! A rendelés módosult!"');
L.push('     mails names carry a leading "( ) " marker - strip it. In "Rendelése megérkezett"');
L.push('     mails the columns are Rendelt/Beérkezett/Később érkezik and carry NO prices.');
L.push('  2. Parse the PDFs: inflate the content streams, read Td coordinates, group fragments');
L.push('     by y, sort by x. Glyph <0118> = ő and <0126> = ű (per the embedded ToUnicode CMap).');
L.push('     Two layouts exist: with Listaár+Eng.% (order confirmation) and without (quotation).');
L.push('  3. Merge on the DANIELLA article number. One order number may appear in several');
L.push('     mails; for quantity totals keep only the newest mail per order number.');
L.push('  4. Re-derive brand, manufacturer part no. and provisional category with the rules in');
L.push('     tools/enrich.js. Never overwrite a user-edited value during a rebuild.');
L.push('');
L.push('@files');
L.push('  data/vrg-inventory.json       canonical, nested, machine-first');
L.push('  data/vrg-inventory.csv        flat, ";"-separated, decimal comma, UTF-8 BOM (Excel-HU)');
L.push('  data/vrg-price-history.csv    every observed price point');
L.push('  data/vrg-orders.csv           every order line, for usage statistics and audit');
L.push('  data/vrg-categories.csv       provisional category list + empty columns for the official mapping');
L.push('');
L.push('@data_tsv  columns: ' + ['vrg_id', 'legacy_id', 'megnevezes', 'marka_gyarto', 'gyartoi_cikkszam', 'kategoria_javaslat_fo',
  'kategoria_javaslat_al', 'egyseg', 'netto_huf', 'brutto_becsles_huf', 'ar_datum',
  'daniella_listaar_netto_huf', 'daniella_engedmeny_szazalek', 'daniella_kiszereles',
  'rendelesek_szama', 'osszes_rendelt_mennyiseg'].join('\t'));
for (const r of rows) {
  L.push([IDS[r.id], r.id, r.megnevezes, r.marka_gyarto, r.gyartoi_cikkszam, r.kategoria_javaslat_fo,
    r.kategoria_javaslat_al, r.egyseg, r.becsult_netto_ar_huf, r.becsult_brutto_ar_huf,
    r.ar_megfigyeles_datum, r.daniella_listaar_netto_huf, r.daniella_engedmeny_szazalek,
    r.daniella_kiszereles, r.rendelesek_szama, r.osszes_rendelt_mennyiseg]
    .map(v => String(v == null ? '' : v).replace(/[\t\r\n]/g, ' ')).join('\t'));
}
L.push('@end_data_tsv');
L.push('');

fs.writeFileSync(path.join(OUT, 'EXPORT_vrg-inventory.txt'), L.join('\n'), 'utf8');
console.log('text export lines:', L.length);
