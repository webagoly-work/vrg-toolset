#!/usr/bin/env node
// fetch-dbip.js — DB-IP Lite (IP → country, CC BY 4.0) for the Kódváros shoreline (P8, KV-18; CITY-D23 A: an offline
// file, never an online geo API, which would receive the whole connection list). Downloads this month's
// dbip-country-lite CSV (or last month's, early in a month) into the gitignored .cache/dbip/ and writes its sha256
// next to it — DB-IP publishes no checksum, so this records what was fetched. Licence: "IP Geolocation by DB-IP"
// (https://db-ip.com), CC BY 4.0 — the page shows that line wherever a country comes from this file.
//
//   node CodeCity/tools/fetch-dbip.js
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const DIR = path.join(__dirname, '..', '..', '.cache', 'dbip');
const ym = d => d.toISOString().slice(0, 7);
(async () => {
  const now = new Date(), prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15));
  for (const month of [ym(now), ym(prev)]) {
    const url = `https://download.db-ip.com/free/dbip-country-lite-${month}.csv.gz`;
    let res;
    try { res = await fetch(url, { headers: { 'User-Agent': 'vrg-kodvaros' } }); } catch (e) { console.log(`- ${month}: HIBA — ${e.message}`); continue; }
    if (!res.ok) { console.log(`- ${month}: HTTP ${res.status}`); continue; }
    const buf = Buffer.from(await res.arrayBuffer());
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(path.join(DIR, 'dbip-country-lite.csv.gz'), buf);
    const meta = { month, url, bytes: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex'), fetched: new Date().toISOString(),
      licence: 'IP Geolocation by DB-IP (https://db-ip.com), CC BY 4.0' };
    fs.writeFileSync(path.join(DIR, 'dbip.json'), JSON.stringify(meta, null, 2) + '\n');
    console.log(`DB-IP Lite ${month}: ${(buf.length / 1048576).toFixed(1)} MB -> .cache/dbip/ (sha256 ${meta.sha256.slice(0, 16)}…)`);
    return;
  }
  console.log('Nem sikerült letölteni (nincs hálózat?). A part országok nélkül is működik.');
  process.exitCode = 1;
})();
