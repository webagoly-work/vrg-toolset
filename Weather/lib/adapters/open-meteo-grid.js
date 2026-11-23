// Open-Meteo forecast on a regular grid over Hungary, for the VRG Térkép fields.
// Several coordinates in one request (latitude=a,b,…&longitude=…) answer with a JSON array, one object per point,
// in the order asked. 0.25° over the bbox is ~380 points, sent in chunks of `chunk` points.
// Company use only with the paid key (sources.json commercial: key), like the point adapter.
'use strict';
const HTTP = require('../http');
const G = require('../grid');
const { hourFloor, now } = require('../common');

const HOURLY = { temperature_2m: 't2m', precipitation: 'precip', cloud_cover: 'cloud', wind_gusts_10m: 'gust', cape: 'cape' };

module.exports = {
  scope: 'grid',
  ext: 'json',
  HOURLY,
  urls(src, settings) {
    const g = settings.grid || {};
    const d = G.def(settings, g.openMeteoStep || 0.25), pts = G.points(d);
    const key = settings.keys && settings.keys.openMeteo, chunk = src.chunk || 100, out = [];
    for (let c = 0; c * chunk < pts.length; c++) {
      const part = pts.slice(c * chunk, (c + 1) * chunk);
      const q = new URLSearchParams({
        latitude: part.map(p => p.lat).join(','), longitude: part.map(p => p.lon).join(','),
        hourly: [...Object.keys(HOURLY), 'wind_speed_10m', 'wind_direction_10m'].join(','),
        wind_speed_unit: 'ms', timezone: 'GMT', past_hours: String(g.pastHours ?? 3), forecast_hours: String(g.hours || 48),
      });
      if (key) q.set('apikey', key);
      out.push({ key: 'c' + c, first: c * chunk, n: part.length, url: (key ? src.url_key : src.url) + '?' + q.toString() });
    }
    return { d, out };
  },
  parseChunk(buf, first, b) {
    let j = JSON.parse(buf.toString('utf8'));
    if (j && j.error) throw new Error('Open-Meteo: ' + j.reason);
    if (!Array.isArray(j)) j = [j];
    j.forEach((loc, k) => {
      const h = loc.hourly || {}, idx = first + k;
      (h.time || []).forEach((t, i) => {
        const valid = t.endsWith('Z') ? t : t + 'Z';
        for (const [f, v] of Object.entries(HOURLY)) if (h[f]) b.put(idx, valid, v, h[f][i]);
        const [u, vv] = G.uv(h.wind_speed_10m && h.wind_speed_10m[i], h.wind_direction_10m && h.wind_direction_10m[i]);
        b.put(idx, valid, 'u', u); b.put(idx, valid, 'v', vv);
      });
    });
    return j.length;
  },
  async run(ctx, src, opts = {}) {
    const { d, out } = module.exports.urls(src, ctx.settings);
    const b = G.builder(d);
    let pts = 0;
    for (const c of out) {
      const r = await HTTP.get(ctx, { source: src, place: c.key, url: c.url, ext: 'json', force: opts.force });
      if (!r.ok) return [{ source: src.id, place: 'grid', status: r.cached ? 'cached' : 'error', error: r.error || 'chunk ' + c.key }];
      try { pts += module.exports.parseChunk(r.body, c.first, b); HTTP.setRows(ctx.db, r.logId, c.n); }
      catch (e) { HTTP.setError(ctx.db, r.logId, e.message); return [{ source: src.id, place: 'grid', status: 'parse', error: e.message }]; }
    }
    const n = G.store(ctx.db, src.id, hourFloor(now()), d, b.frames());
    return [{ source: src.id, place: 'grid', status: 'ok', rows: n, points: pts }];
  },
};
