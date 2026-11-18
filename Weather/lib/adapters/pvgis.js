// PVGIS 5.3 PVcalc (EU JRC) — https://joint-research-centre.ec.europa.eu/pvgis-online-tool/getting-started-pvgis/api-non-interactive-service_en
// outputs.monthly.fixed[] { month, E_d (kWh/day), E_m (kWh/month), "H(i)_d" (kWh/m²/day), "H(i)_m", SD_m },
// outputs.totals.fixed { E_d, E_m, E_y, "H(i)_y", SD_y, l_total }.
// Defaults: 1 kWp, 14 % losses, 35° tilt, south (aspect 0). `pv <place> --kwp 10 --angle 30 --aspect -20`.
'use strict';

module.exports = {
  scope: 'place',
  ext: 'json',
  params: (o = {}) => ({ kwp: +(o.kwp || 1), loss: +(o.loss || 14), angle: +(o.angle ?? 35), aspect: +(o.aspect ?? 0) }),
  url(src, place, settings, opts) {
    const p = module.exports.params(opts);
    return src.url.replace('{lat}', place.lat.toFixed(4)).replace('{lon}', place.lon.toFixed(4))
      .replace('{kwp}', p.kwp).replace('{loss}', p.loss).replace('{angle}', p.angle).replace('{aspect}', p.aspect);
  },
  parse(buf, src, place, settings, opts) {
    const j = JSON.parse(buf.toString('utf8'));
    const o = j.outputs || {}, params = JSON.stringify(module.exports.params(opts));
    const climate = [];
    for (const m of (o.monthly && o.monthly.fixed) || []) {
      climate.push({ source: src.id, place: place.id, key: 'pv_E_m', month: m.month, value: m.E_m, unit: 'kWh', params });
      climate.push({ source: src.id, place: place.id, key: 'pv_E_d', month: m.month, value: m.E_d, unit: 'kWh/nap', params });
      if (m['H(i)_d'] != null) climate.push({ source: src.id, place: place.id, key: 'pv_H_d', month: m.month, value: m['H(i)_d'], unit: 'kWh/m²/nap', params });
    }
    const tot = o.totals && o.totals.fixed;
    if (tot && tot.E_y != null) climate.push({ source: src.id, place: place.id, key: 'pv_E_y', month: 0, value: tot.E_y, unit: 'kWh/év', params });
    if (!climate.length) throw new Error('PVGIS: no monthly output');
    return { climate };
  },
};
