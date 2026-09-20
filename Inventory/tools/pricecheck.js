// The local helper behind "Árak frissítése" (decision D2).
//
// A page opened from file:// cannot read daniella.hu, so this fetches the
// current shelf prices and writes a small JSON the app imports. It reuses the
// product URLs collected in Phase 6, so it needs no search and no sitemap
// re-download.
//
//   node tools/pricecheck.js                  every item we have a URL for
//   node tools/pricecheck.js --list lista.csv only the items in an exported list
//   node tools/pricecheck.js --limit 20       a smoke test
//
// Output: price-check-YYYY-MM-DD.json next to the project, ready to drop into
// the app's "Árellenőrzés" panel.

const fs = require('fs');
const path = require('path');
const { CACHE } = require('./paths.js');

const UA = 'Mozilla/5.0 (compatible; VRG-Inventory/1.0; internal price check)';
const BASE = 'https://daniella.hu';
const VENDOR = 'daniella';
const DELAY = Number(process.env.VRG_FETCH_DELAY || 350);

const arg = n => { const i = process.argv.indexOf(n); return i < 0 ? null : process.argv[i + 1]; };

function priceFrom(html) {
  const blocks = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)];
  for (const b of blocks) {
    let p;
    try { p = JSON.parse(b[1]); } catch (e) { continue; }
    if (p['@type'] !== 'Product' || !p.offers) continue;
    const price = Number(p.offers.price);
    const stock = Number(p.offers.inventoryLevel);
    return {
      brutto_ar_huf: Number.isFinite(price) ? price : null,
      keszlet: Number.isFinite(stock) ? stock : null,
      penznem: p.offers.priceCurrency || null
    };
  }
  return null;
}

/** vrg_id values named in an exported list CSV, so a check can be scoped. */
function idsFromCsv(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  return [...new Set([...text.matchAll(/\bVRG-\d{4,}\b/g)].map(m => m[0]))];
}

(async () => {
  const docPath = path.join(__dirname, '..', 'data', 'vrg-inventory.json');
  const doc = JSON.parse(fs.readFileSync(docPath, 'utf8'));

  let items = doc.items.filter(i => i.vendors[VENDOR] && i.vendors[VENDOR].termek_link);
  const listFile = arg('--list');
  if (listFile) {
    const want = new Set(idsFromCsv(listFile));
    items = items.filter(i => want.has(i.vrg_id));
    console.log(`lista szűrő: ${want.size} azonosító a fájlban, ${items.length} ellenőrizhető`);
  }
  const limit = Number(arg('--limit') || 0);
  if (limit) items = items.slice(0, limit);

  if (!items.length) {
    console.error('Nincs ellenőrizhető tétel (hiányzik a termék link — futtasd: npm run vendor).');
    process.exit(1);
  }

  console.log(`${items.length} tétel árának ellenőrzése…`);
  const out = [];
  let ok = 0, fail = 0;
  for (const [i, it] of items.entries()) {
    const url = it.vendors[VENDOR].termek_link;
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'hu' } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const got = priceFrom(await r.text());
      if (!got) throw new Error('nincs ár a válaszban');
      out.push({ vrg_id: it.vrg_id, cikkszam: it.vendors[VENDOR].cikkszam, ...got, url: url.replace(BASE, '') });
      ok++;
    } catch (e) {
      out.push({ vrg_id: it.vrg_id, cikkszam: it.vendors[VENDOR].cikkszam, brutto_ar_huf: null, keszlet: null, url, hiba: e.message });
      fail++;
    }
    if ((i + 1) % 10 === 0 || i === items.length - 1) {
      process.stdout.write(`\r  ${i + 1}/${items.length}  ok:${ok} hiba:${fail}   `);
    }
    await new Promise(r => setTimeout(r, DELAY));
  }

  const datum = new Date().toISOString().slice(0, 10);
  const payload = {
    schema: 'vrg-price-check',
    schema_version: '1.0.0',
    vendor: VENDOR,
    datum,
    forras: BASE,
    megjegyzes: 'A brutto_ar_huf a webshop polcára kitett bruttó ár, NEM a partner-árunk.',
    tetelek: out
  };
  const file = path.join(__dirname, '..', `price-check-${datum}.json`);
  fs.writeFileSync(file, JSON.stringify(payload, null, 1), 'utf8');
  console.log(`\nkész — ok: ${ok}, hiba: ${fail}`);
  console.log('→', path.relative(process.cwd(), file));
  console.log('Húzd be az appban: Árellenőrzés → „Ellenőrzés betöltése”.');

  // keep a copy in the cache so a repeat run can diff offline if needed
  fs.writeFileSync(path.join(CACHE, 'last-price-check.json'), JSON.stringify(payload, null, 0));
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
