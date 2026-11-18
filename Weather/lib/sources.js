// VRG Időjárás — the source registry: config/sources.json is the truth, the `source` table is its copy
// (so SQL and the page can join on it), and the licence gate decides what may run.
'use strict';

const ADAPTERS = {
  'met-no': () => require('./adapters/met-no'),
  'dwd-mosmix': () => require('./adapters/dwd-mosmix'),
  'open-meteo': () => require('./adapters/open-meteo'),
  'open-meteo-aq': () => require('./adapters/open-meteo-aq'),
  'meteoalarm': () => require('./adapters/meteoalarm'),
  'hungaromet-obs': () => require('./adapters/hungaromet-obs'),
  'hungaromet-lightning': () => require('./adapters/hungaromet-lightning'),
  'pvgis': () => require('./adapters/pvgis'),
};
const adapter = src => (src.adapter && ADAPTERS[src.adapter] ? ADAPTERS[src.adapter]() : null);

function sync(db, sources) {
  db.tx(() => {
    for (const s of sources) db.run(`INSERT INTO source (id, name, provider, kind, licence, licence_url, attribution, commercial, auth, cadence_min, enabled, prior_weight, verified, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, provider = excluded.provider, kind = excluded.kind,
      licence = excluded.licence, licence_url = excluded.licence_url, attribution = excluded.attribution, commercial = excluded.commercial, auth = excluded.auth,
      cadence_min = excluded.cadence_min, enabled = excluded.enabled, prior_weight = excluded.prior_weight, verified = excluded.verified, notes = excluded.notes`,
      s.id, s.name, s.provider, s.kind, s.licence, s.licence_url, s.attribution, s.commercial, s.auth, s.cadence_min, s.enabled ? 1 : 0, s.prior_weight ?? 1, s.verified || 'no', s.notes || null);
  });
}

/* may this source run under the current settings? -> { ok, why } */
function gate(src, settings) {
  if (!src.enabled) return { ok: false, why: 'kikapcsolva (sources.json enabled: false)' };
  if (!adapter(src)) return { ok: false, why: 'csak hivatkozás, nincs letöltő' };
  const use = settings.use || 'commercial';
  if (src.commercial === 'no' && use === 'commercial') return { ok: false, why: 'licenc: üzleti használat nem engedett' };
  if (src.commercial === 'key' && use === 'commercial') {
    const k = src.adapter.startsWith('open-meteo') ? settings.keys && settings.keys.openMeteo : null;
    if (!k) return { ok: false, why: 'licenc: üzleti használathoz kulcs kell (settings.local.json keys.openMeteo)' };
  }
  return { ok: true, why: use === 'evaluation' && src.commercial !== 'yes' ? 'csak kiértékelés (nem üzleti)' : '' };
}

module.exports = { ADAPTERS, adapter, sync, gate };
