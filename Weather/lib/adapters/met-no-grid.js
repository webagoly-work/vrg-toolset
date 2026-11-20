// MET Norway Locationforecast on a coarse grid over Hungary (company use allowed, CC BY 4.0), for the VRG Térkép
// fields when Open-Meteo has no key. One request per point (0.5° = 105 points), at most `perSecond` a second,
// each honouring its own Expires (lib/http.js), well inside MET's "20 requests a second" terms. The point parser
// (adapters/met-no.js) is reused; wind speed + direction become u / v.
'use strict';
const HTTP = require('../http');
const G = require('../grid');
const MET = require('./met-no');
const { now } = require('../common');

const sleep = ms => new Promise(r => setTimeout(r, ms));

module.exports = {
  scope: 'grid',
  ext: 'json',
  async run(ctx, src, opts = {}) {
    const g = ctx.settings.grid || {};
    const d = G.def(ctx.settings, g.metNoStep || 0.5), pts = G.points(d);
    const b = G.builder(d);
    const hours = g.hours || 48;
    let issued = null, ok = 0, cached = 0, failed = 0;
    for (let k = 0; k < pts.length; k++) {
      const p = pts[k];
      const url = src.url.replace('{lat}', p.lat.toFixed(4)).replace('{lon}', p.lon.toFixed(4));
      const r = await HTTP.get(ctx, { source: src, place: 'g' + k, url, ext: 'json', force: opts.force });
      if (!r.ok) { if (r.cached) cached++; else failed++; continue; }
      try {
        const { forecast } = MET.parse(r.body, { ...src, id: src.id }, { id: 'g' + k });
        const at = new Map();
        for (const f of forecast) {
          if (!issued || f.issued > issued) issued = f.issued;
          if (!at.has(f.valid)) at.set(f.valid, {});
          at.get(f.valid)[f.var] = f.value;
        }
        const limit = new Date(now().getTime() + hours * 3600e3).toISOString();
        for (const [valid, x] of at) {
          if (valid > limit) continue;
          b.put(k, valid, 't2m', x.t2m); b.put(k, valid, 'precip', x.precip); b.put(k, valid, 'cloud', x.cloud); b.put(k, valid, 'gust', x.gust);
          const [u, v] = G.uv(x.wind, x.wdir); b.put(k, valid, 'u', u); b.put(k, valid, 'v', v);
        }
        HTTP.setRows(ctx.db, r.logId, at.size); ok++;
      } catch (e) { HTTP.setError(ctx.db, r.logId, e.message); failed++; }
      if (!ctx.replay) await sleep(1000 / (src.perSecond || 4));
    }
    // all cached: the stored grid is still the newest; nothing to rebuild
    if (!ok) return [{ source: src.id, place: 'grid', status: cached ? 'cached' : 'error', error: failed ? failed + ' pont hibás' : undefined }];
    if (ok < pts.length) {
      // a partial refresh would mix old and new points: keep the earlier grid unless most points answered
      if (ok < pts.length * 0.8) return [{ source: src.id, place: 'grid', status: 'error', error: `csak ${ok}/${pts.length} pont` }];
    }
    const n = G.store(ctx.db, src.id, issued, d, b.frames());
    return [{ source: src.id, place: 'grid', status: 'ok', rows: n, points: ok, failed }];
  },
};
