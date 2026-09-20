// Pipeline stage: fold the vendor-collected metadata into the item rows.
//
// enrich.js derives what can be derived from the order documents.
// This stage adds what only the vendor's own catalogue knows, and is careful
// about which side of the vendor line each fact falls on:
//
//   NEUTRAL (top level)   official category, weight, GTIN, manufacturer datasheet
//   VENDOR  (vendor block) webshop gross price, stock level, product URL
//
// The official category is DANIELLA's taxonomy, adopted deliberately as the
// house taxonomy — that was an explicit decision, so it is recorded with a
// `kategoria_forras` rather than silently presented as ours.

const fs = require('fs');
const path = require('path');
const { CACHE } = require('./paths.js');

const ROWS = path.join(CACHE, 'rows.json');
const PRODUCTS = path.join(CACHE, 'daniella-products.json');

/**
 * The webshop prints its breadcrumb root-first:
 *   ["Installáció technika", "Szerelvény- és kötődobozok", "Falon kívüli dobozok és fedelek"]
 * We store it the way the user asked for it:
 *   fo = "Installáció technika"                                   (department)
 *   al = "Falon kívüli dobozok és fedelek"                        (the leaf)
 *   ut = "/Szerelvény- és kötődobozok/Installáció technika/"      (ancestors, leaf-most first)
 */
function splitCategory(chain) {
  if (!Array.isArray(chain) || !chain.length) return { fo: '', al: '', ut: '' };
  const fo = chain[0];
  const al = chain[chain.length - 1];
  const ancestors = chain.slice(0, -1).reverse();
  const ut = ancestors.length ? '/' + ancestors.join('/') + '/' : '';
  return { fo, al, ut };
}

// Roots that are a merchandising bucket rather than a place in the taxonomy.
// "Heti Akció: Weidmüller válogatás" is a weekly sale — recording it as an
// item's category would be wrong the following week.
const NOT_TAXONOMY = /^(Akciós termékek|Egyéb)$/i;

// written accent-free, because the key folds accents before this is applied
const COLOURS = /\b(kek|zold|sarga|szurke|fekete|feher|piros|barna|narancs|lgr|bl|gn|ge|sw|ws)\b/g;

/** A key that survives the difference between two colours of the same product. */
function familyKey(brand, name) {
  return (brand || '') + '|' + String(name || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // fold accents FIRST …
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b\d{6,}\b/g, ' ')            // article numbers differ per colour
    .replace(COLOURS, ' ')                  // … so the colour list matches
    .replace(/\s+/g, ' ')
    .trim();
}

/** Prefer the manufacturer's own document over a reseller-hosted copy. */
function pickDoc(urls) {
  if (!urls || !urls.length) return '';
  const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
  const notAggregator = urls.filter(u => !/3dgroup\.cloud|daniella\.hu/i.test(host(u)));
  return (notAggregator[0] || urls[0]);
}

/**
 * Names printed by the vendor often carry the vendor's own article number.
 * A vendor-neutral name should not, so strip it — but only when the rest of
 * the name still says what the thing is, and always keep the original as a
 * variant so nothing is lost.
 */
function stripVendorCode(name, code) {
  if (!name || !code) return name;
  const re = new RegExp('[\\s(\\[/]*\\b' + code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b[\\s)\\]]*', 'gi');
  const stripped = name.replace(re, ' ').replace(/\s{2,}/g, ' ').replace(/\s+([,.])/g, '$1').trim();
  const meaningful = stripped.replace(/[^A-Za-zÁÉÍÓÖŐÚÜŰáéíóöőúüű]/g, '').length;
  return meaningful >= 8 ? stripped : name;
}

function main() {
  if (!fs.existsSync(PRODUCTS)) {
    console.log('enrich-vendor: nincs .cache/daniella-products.json — kihagyva ' +
      '(futtasd: node tools/daniella-sitemap.js && node tools/daniella-fetch.js)');
    return;
  }
  const rows = JSON.parse(fs.readFileSync(ROWS, 'utf8'));
  const fetched = JSON.parse(fs.readFileSync(PRODUCTS, 'utf8'));

  // the fetch cache is keyed by vrg_id; join on the article number so this
  // stage does not depend on id assignment order
  const byCode = new Map();
  for (const rec of Object.values(fetched)) {
    if (rec && rec.cikkszam && !rec.hiba) byCode.set(String(rec.cikkszam).toLowerCase(), rec);
  }

  const stat = {
    kategoria: 0, tomeg: 0, link: 0, gtin: 0, ar: 0, keszlet: 0,
    nev_tisztitva: 0, nincs_adat: [], promo: [], testver: 0
  };

  for (const r of rows) {
    const rec = byCode.get(String(r.id).toLowerCase());
    if (!rec) { stat.nincs_adat.push(r.id); continue; }

    const c = splitCategory(rec.kategoria_lanc);
    if (c.al && !NOT_TAXONOMY.test(c.fo)) {
      r.kategoria_fo = c.fo;
      r.kategoria_al = c.al;
      r.kategoria_ut = c.ut;
      r.kategoria_forras = 'daniella-webshop';
      stat.kategoria++;
    } else if (c.al) {
      stat.promo.push({ id: r.id, lanc: rec.kategoria_lanc.join(' > ') });
    }
    if (rec.tomeg_kg != null && rec.tomeg_kg > 0) { r.tomeg_kg = rec.tomeg_kg; stat.tomeg++; }
    const doc = pickDoc(rec.dokumentumok);
    if (doc) { r.gyartoi_termek_link = doc; stat.link++; }
    if (rec.gtin) { r.gtin = String(rec.gtin); stat.gtin++; }

    // vendor side
    r.daniella_termek_link = rec.url ? 'https://daniella.hu' + rec.url : '';
    if (rec.brutto_ar_huf != null) { r.daniella_aktualis_brutto_ar_huf = rec.brutto_ar_huf; stat.ar++; }
    if (rec.keszlet != null) { r.daniella_keszlet_db = rec.keszlet; stat.keszlet++; }
    r.daniella_ar_ellenorizve = rec.lekerdezve || '';

    // a brand we could not derive from the documents, but the vendor states
    if (!r.marka_gyarto && (rec.gyarto || rec.marka)) r.marka_gyarto = rec.gyarto || rec.marka;

    const cleaned = stripVendorCode(r.megnevezes, r.id);
    if (cleaned !== r.megnevezes) {
      if (!r.nev_valtozatok.includes(r.megnevezes)) r.nev_valtozatok.push(r.megnevezes);
      r.megnevezes = cleaned;
      stat.nev_tisztitva++;
    }
    if (rec.nev && !r.nev_valtozatok.includes(rec.nev)) r.nev_valtozatok.push(rec.nev);
  }

  // An item filed under a promotion has no taxonomy of its own, but a sibling
  // that differs only by colour does. Adopt that — and say so in `forras`,
  // because it is an inference, not something the vendor stated about this item.
  const donors = new Map();
  for (const r of rows) {
    if (!r.kategoria_al || r.kategoria_forras !== 'daniella-webshop') continue;
    const k = familyKey(r.marka_gyarto, r.megnevezes);
    if (k.length > 12 && !donors.has(k)) donors.set(k, r);
  }
  for (const r of rows) {
    if (r.kategoria_al) continue;
    const donor = donors.get(familyKey(r.marka_gyarto, r.megnevezes));
    if (!donor) continue;
    r.kategoria_fo = donor.kategoria_fo;
    r.kategoria_al = donor.kategoria_al;
    r.kategoria_ut = donor.kategoria_ut;
    r.kategoria_forras = 'daniella-webshop-testver:' + donor.id;
    stat.testver++;
  }

  fs.writeFileSync(ROWS, JSON.stringify(rows, null, 1));
  console.log('enrich-vendor:',
    `kategória ${stat.kategoria}/${rows.length}`,
    `· tömeg ${stat.tomeg}`,
    `· gyártói link ${stat.link}`,
    `· GTIN ${stat.gtin}`,
    `· webshop ár ${stat.ar}`,
    `· készlet ${stat.keszlet}`,
    `· név tisztítva ${stat.nev_tisztitva}`);
  if (stat.testver) console.log(`  testvér termék alapján pótolva: ${stat.testver}`);
  if (stat.promo.length) {
    console.log('  akciós/besorolatlan gyűjtőben, ezért NEM vettük át hivatalos kategóriának (' + stat.promo.length + '):');
    for (const p of stat.promo) console.log('    ', p.id, '—', p.lanc);
  }
  if (stat.nincs_adat.length) {
    console.log('  nincs beszállítói adat (' + stat.nincs_adat.length + '):', stat.nincs_adat.join(', '));
  }
}

main();
