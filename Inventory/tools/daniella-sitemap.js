// Phase 6 helper: download DANIELLA's sitemap and keep the product URLs.
//
// robots.txt allows this and names the sitemap itself, so the polite path is
// also the cheap one: four gzipped files instead of hundreds of search
// requests. Everything is cached under .cache/ so a re-run costs nothing.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { CACHE } = require('./paths.js');

const INDEX = 'https://daniella.hu/sitemap/siteindex.xml';
const UA = 'Mozilla/5.0 (compatible; VRG-Inventory/1.0; internal catalogue sync)';
const OUT = path.join(CACHE, 'daniella-urls.json');

async function get(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  const buf = Buffer.from(await r.arrayBuffer());
  return url.endsWith('.gz') ? zlib.gunzipSync(buf).toString('utf8') : buf.toString('utf8');
}

const locs = xml => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim());

(async () => {
  if (fs.existsSync(OUT) && !process.argv.includes('--refresh')) {
    const cached = JSON.parse(fs.readFileSync(OUT, 'utf8'));
    console.log('cached:', cached.length, 'urls ( --refresh to re-download )');
    return;
  }
  const maps = locs(await get(INDEX));
  console.log('sitemaps:', maps.length);

  const all = [];
  for (const m of maps) {
    const xml = await get(m);
    const urls = locs(xml);
    all.push(...urls);
    console.log('  ', m.split('/').pop(), urls.length);
    await new Promise(r => setTimeout(r, 400));          // be a polite guest
  }

  const unique = [...new Set(all)];
  fs.writeFileSync(OUT, JSON.stringify(unique, null, 0));
  console.log('total urls:', unique.length, '->', path.relative(process.cwd(), OUT));

  const sample = {};
  for (const u of unique) {
    const seg = u.replace('https://daniella.hu/', '').split('/')[0];
    sample[seg] = (sample[seg] || 0) + 1;
  }
  console.log('top path segments:', Object.entries(sample).sort((a, b) => b[1] - a[1]).slice(0, 12));
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
