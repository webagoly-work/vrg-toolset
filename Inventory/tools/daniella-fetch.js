// Phase 6: collect the official vendor metadata for every item we order.
//
// Product pages are server-rendered with schema.org JSON-LD, so one request
// per item yields the official category path, the weight, the webshop gross
// price, the stock level, the GTIN and the manufacturer's datasheet — no
// scraping of rendered markup, no guessing.
//
// Polite by construction: robots.txt allows this and names the sitemap that
// gave us the URLs; requests are serialised with a delay, and every result is
// written through to .cache so a re-run resumes instead of starting over.
//
//   node tools/daniella-fetch.js            fetch what is still missing
//   node tools/daniella-fetch.js --refresh  re-fetch everything
//   node tools/daniella-fetch.js --limit 20 stop after 20 (for a smoke test)

const fs = require('fs');
const path = require('path');
const { CACHE } = require('./paths.js');

const UA = 'Mozilla/5.0 (compatible; VRG-Inventory/1.0; internal catalogue sync)';
const BASE = 'https://daniella.hu';
const URLS = path.join(CACHE, 'daniella-urls.json');
const OUT = path.join(CACHE, 'daniella-products.json');
const DELAY = Number(process.env.VRG_FETCH_DELAY || 350);

const arg = name => {
  const i = process.argv.indexOf(name);
  return i < 0 ? null : process.argv[i + 1];
};

function ldBlocks(html) {
  return [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)]
    .map(m => { try { return JSON.parse(m[1]); } catch (e) { return null; } })
    .filter(Boolean);
}

const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** JSON-LD embedded in HTML arrives with its entities still encoded. */
const unent = s => String(s)
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
  .replace(/\s+/g, ' ').trim();

/** Pull only what we actually store — the page is ~800 kB, the record is ~1 kB. */
function extract(html, url) {
  const blocks = ldBlocks(html);
  const product = blocks.find(b => b['@type'] === 'Product');
  const crumb = blocks.find(b => b['@type'] === 'BreadcrumbList');
  if (!product) return { url, hiba: 'nincs Product JSON-LD' };

  const cats = Array.isArray(product.category)
    ? product.category.map(c => c && c.name).filter(Boolean)
    : [];
  const crumbNames = crumb && Array.isArray(crumb.itemListElement)
    ? crumb.itemListElement.filter(e => e.item).map(e => e.name)
    : [];

  const certs = Array.isArray(product.hasCertification) ? product.hasCertification : [];
  const docs = certs.map(c => c && c.url)
    .filter(u => typeof u === 'string' && /^https?:/.test(u))
    .map(unent);

  return {
    url,
    cikkszam: product.productID || null,
    nev: product.name ? unent(product.name) : null,
    // root-first, exactly as the webshop prints the breadcrumb
    kategoria_lanc: (cats.length ? cats : crumbNames).map(unent),
    marka: (product.brand && product.brand.name) || null,
    gyarto: (product.manufacturer && product.manufacturer.name) || null,
    gtin: product.gtin || null,
    tomeg_kg: product.weight ? num(product.weight.minValue) : null,
    brutto_ar_huf: product.offers ? num(product.offers.price) : null,
    penznem: (product.offers && product.offers.priceCurrency) || null,
    keszlet: product.offers ? num(product.offers.inventoryLevel) : null,
    elerhetoseg: (product.offers && product.offers.availability) || null,
    dokumentumok: docs,
    lekerdezve: new Date().toISOString()
  };
}

(async () => {
  if (!fs.existsSync(URLS)) {
    console.error('Hiányzik a sitemap gyorsítótár — futtasd előbb: node tools/daniella-sitemap.js');
    process.exit(1);
  }
  const urls = JSON.parse(fs.readFileSync(URLS, 'utf8'));
  const byCode = new Map();
  for (const u of urls) {
    const m = /-id-([a-z0-9]+)$/i.exec(u);
    if (m) byCode.set(m[1].toLowerCase(), u);
  }

  const doc = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'vrg-inventory.json'), 'utf8'));
  const wanted = doc.items.map(i => ({ vrg_id: i.vrg_id, cikkszam: i.vendors.daniella.cikkszam }));

  const done = fs.existsSync(OUT) && !process.argv.includes('--refresh')
    ? JSON.parse(fs.readFileSync(OUT, 'utf8'))
    : {};

  const limit = Number(arg('--limit') || 0);
  const todo = wanted.filter(w => !done[w.vrg_id]);
  const slice = limit ? todo.slice(0, limit) : todo;

  console.log(`${wanted.length} tétel · kész: ${Object.keys(done).length} · most: ${slice.length}`);

  let ok = 0, fail = 0;
  for (const [i, w] of slice.entries()) {
    const rel = byCode.get(w.cikkszam.toLowerCase());
    if (!rel) {
      done[w.vrg_id] = { cikkszam: w.cikkszam, hiba: 'nincs URL a sitemapban' };
      fail++;
      continue;
    }
    try {
      const r = await fetch(rel, { headers: { 'User-Agent': UA, 'Accept-Language': 'hu' } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const html = await r.text();
      const rec = extract(html, rel.replace(BASE, ''));
      rec.cikkszam = rec.cikkszam || w.cikkszam;
      done[w.vrg_id] = rec;
      if (rec.hiba) fail++; else ok++;
    } catch (e) {
      done[w.vrg_id] = { cikkszam: w.cikkszam, url: rel.replace(BASE, ''), hiba: e.message };
      fail++;
    }
    if ((i + 1) % 10 === 0 || i === slice.length - 1) {
      fs.writeFileSync(OUT, JSON.stringify(done, null, 0));
      process.stdout.write(`\r  ${i + 1}/${slice.length}  ok:${ok} hiba:${fail}   `);
    }
    await new Promise(r => setTimeout(r, DELAY));
  }
  fs.writeFileSync(OUT, JSON.stringify(done, null, 1));
  console.log(`\nkész — ok: ${ok}, hiba: ${fail}, összesen tárolva: ${Object.keys(done).length}`);
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
