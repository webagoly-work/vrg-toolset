// HungaroMet lightning location (LINET) on odp.met.hu — OFF by default (sources.json enabled: false) until the
// folder's file pattern is confirmed. When the URL is a folder, the newest csv/zip/txt link in its listing is
// taken. Any CSV with time / lat / lon columns is read (amplitude optional).
'use strict';
const zip = require('../zip');
const CSV = require('../csv');
const { iso } = require('../db');

module.exports = {
  scope: 'global',
  ext: 'csv',
  url: src => src.url,
  // a folder listing -> the newest data file in it
  pickFromListing(html, base) {
    const links = [...html.matchAll(/href="([^"]+\.(?:csv|zip|txt)(?:\.zip)?)"/gi)].map(m => m[1]).sort();
    return links.length ? new URL(links[links.length - 1], base).toString() : null;
  },
  parse(buf, src) {
    const text = (buf[0] === 0x50 && buf[1] === 0x4b ? zip.first(buf, /\.(csv|txt)$/i) : buf).toString('utf8');
    const { rows } = CSV.table(text, src.columns, ['time', 'lat', 'lon']);
    const strikes = [];
    for (const r of rows) {
      const at = iso(CSV.time(r.time)), lat = CSV.num(r.lat), lon = CSV.num(r.lon);
      if (at && lat != null && lon != null) strikes.push({ source: src.id, at, lat, lon, amp: CSV.num(r.amp) });
    }
    return { strikes };
  },
};
