// sun.js — where the sun is, and the shadow a building casts on flat ground. Shared by the page
// (lib/shadow-layer.js, the Árnyék panel) and Node (test/sun.test.js). Dependency-free; no network.
//
//   const S = require('./sun.js')            // Node
//   window.VRGSun                             // browser, after <script src="/lib/sun.js">
//
//   S.position(date, lat, lon)   -> { azimuth, altitude }   degrees; azimuth from north, clockwise;
//                                   altitude above the horizon, with atmospheric refraction
//   S.times(day, lat, lon)       -> { rise, set, noon }     Dates on the local calendar day of `day`
//                                   (rise/set at -0.833°, the upper limb with refraction); null when
//                                   the sun does not rise or set that day
//   S.offset(sun, h, lat)        -> [dLon, dLat]            where the top of a height-h point lands on the ground
//   S.shadow(polygons, h, base, sun, lat) -> list of polygons (each a list of rings of [lon, lat])
//                                   the ground shadow of a prism from `base` to `h` metres: the
//                                   footprint at both heights plus the sweep of every edge (exact union)
//
// The position is the NOAA solar calculator's algorithm (accurate to about a minute of time for
// 1800–2100); refraction by Bennett's formula. The shadow assumes flat ground at the building's foot:
// on a slope it is too short downhill and too long uphill.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VRGSun = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;
  const M_PER_DEG_LAT = 110574, M_PER_DEG_LON = 111320;
  /** The longest shadow drawn, metres: near the horizon a shadow runs for kilometres and means nothing. */
  const MAX_LEN = 800;

  /** Geometric (no refraction) altitude and the azimuth, NOAA. */
  function geometric(date, lat, lon) {
    const jd = date.getTime() / 86400000 + 2440587.5;
    const t = (jd - 2451545) / 36525;
    const L0 = ((280.46646 + t * (36000.76983 + t * 0.0003032)) % 360 + 360) % 360;
    const M = 357.52911 + t * (35999.05029 - 0.0001537 * t);
    const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
    const C = Math.sin(rad(M)) * (1.914602 - t * (0.004817 + 0.000014 * t)) + Math.sin(rad(2 * M)) * (0.019993 - 0.000101 * t) + Math.sin(rad(3 * M)) * 0.000289;
    const omega = 125.04 - 1934.136 * t;
    const lambda = L0 + C - 0.00569 - 0.00478 * Math.sin(rad(omega));
    const eps0 = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
    const eps = eps0 + 0.00256 * Math.cos(rad(omega));
    const decl = Math.asin(Math.sin(rad(eps)) * Math.sin(rad(lambda)));
    const y = Math.tan(rad(eps / 2)) ** 2;
    const eqTime = 4 * deg(y * Math.sin(2 * rad(L0)) - 2 * e * Math.sin(rad(M)) + 4 * e * y * Math.sin(rad(M)) * Math.cos(2 * rad(L0))
      - 0.5 * y * y * Math.sin(4 * rad(L0)) - 1.25 * e * e * Math.sin(2 * rad(M)));
    const utcMin = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60 + date.getUTCMilliseconds() / 60000;
    const tst = ((utcMin + eqTime + 4 * lon) % 1440 + 1440) % 1440;
    const ha = tst / 4 < 0 ? tst / 4 + 180 : tst / 4 - 180;
    const phi = rad(lat);
    const cosZ = Math.min(1, Math.max(-1, Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(rad(ha))));
    const zen = Math.acos(cosZ);
    const den = Math.cos(phi) * Math.sin(zen);
    let az;
    if (Math.abs(den) < 1e-9) az = lat > 0 ? 180 : 0;
    else {
      const a = deg(Math.acos(Math.min(1, Math.max(-1, (Math.sin(phi) * Math.cos(zen) - Math.sin(decl)) / den))));
      az = ha > 0 ? (a + 180) % 360 : (540 - a) % 360;
    }
    return { azimuth: az, altitude: 90 - deg(zen) };
  }

  /** Bennett: the apparent lift near the horizon, degrees. */
  function refraction(h) {
    if (h < -1.5) return 0;
    return 1.02 / Math.tan(rad(h + 10.3 / (h + 5.11))) / 60;
  }

  function position(date, lat, lon) {
    const g = geometric(date, lat, lon);
    return { azimuth: g.azimuth, altitude: g.altitude + refraction(g.altitude) };
  }

  /** The local calendar day of `day` (00:00 to 24:00 on this device's clock). */
  function dayStart(day) { return new Date(day.getFullYear(), day.getMonth(), day.getDate()); }

  function times(day, lat, lon) {
    const t0 = dayStart(day).getTime(), H = -0.833;
    const alt = ms => geometric(new Date(ms), lat, lon).altitude;
    const cross = (a, b, up) => {        // bisection to the second
      for (let i = 0; i < 30 && b - a > 1000; i++) { const m = (a + b) / 2; ((alt(m) > H) === up) ? (b = m) : (a = m); }
      return new Date(Math.round((a + b) / 2));
    };
    let rise = null, set = null, noon = null, best = -99;
    const step = 10 * 60000;
    let prev = alt(t0);
    for (let ms = t0 + step; ms <= t0 + 86400000; ms += step) {
      const a = alt(ms);
      if (prev <= H && a > H && !rise) rise = cross(ms - step, ms, true);
      if (prev > H && a <= H && !set) set = cross(ms - step, ms, false);
      if (a > best) { best = a; noon = ms; }
      prev = a;
    }
    // refine the highest point to the minute
    for (let ms = noon - step; ms <= noon + step; ms += 60000) { const a = alt(ms); if (a >= best) { best = a; noon = ms; } }
    return { rise, set, noon: new Date(noon), maxAltitude: best };
  }

  /** How far (metres) a height-1 m point's shadow falls, and where to: [east, north] per metre of height. */
  function perMetre(sun) {
    if (!sun || sun.altitude <= 0) return null;
    const L = 1 / Math.tan(rad(Math.max(sun.altitude, 0.5)));
    const a = rad(sun.azimuth);
    return [-Math.sin(a) * L, -Math.cos(a) * L];
  }

  function offset(sun, h, lat) {
    const p = perMetre(sun);
    if (!p) return null;
    let [e, n] = [p[0] * h, p[1] * h];
    const len = Math.hypot(e, n);
    if (len > MAX_LEN) { e *= MAX_LEN / len; n *= MAX_LEN / len; }
    return [e / (M_PER_DEG_LON * Math.cos(rad(lat))), n / M_PER_DEG_LAT];
  }

  const shift = (ring, o) => ring.map(p => [p[0] + o[0], p[1] + o[1]]);

  /**
   * polygons: [[outer, hole, …], …] in [lon, lat]. The union of the footprint translated from `base`
   * to `h` is exactly: the footprint at both ends, plus the parallelogram swept by every edge (holes'
   * edges too: a courtyard's walls shade the courtyard).
   */
  function shadow(polygons, h, base, sun, lat) {
    const top = offset(sun, h, lat);
    if (!top || !(h > 0)) return [];
    const bot = base > 0 ? offset(sun, Math.min(base, h), lat) : [0, 0];
    const out = [];
    const tiny = 1e-14;                 // deg², about 0.1 m²: an edge running along the sun's direction
    for (const poly of polygons) {
      if (!poly || !poly.length || poly[0].length < 3) continue;
      out.push(poly.map(r => shift(r, top)));
      if (base > 0) out.push(poly.map(r => shift(r, bot)));
      for (const ring of poly) {
        for (let i = 0; i < ring.length - 1; i++) {
          const p = ring[i], q = ring[i + 1];
          const quad = [[p[0] + bot[0], p[1] + bot[1]], [q[0] + bot[0], q[1] + bot[1]], [q[0] + top[0], q[1] + top[1]], [p[0] + top[0], p[1] + top[1]]];
          const area = Math.abs((quad[1][0] - quad[0][0]) * (quad[3][1] - quad[0][1]) - (quad[3][0] - quad[0][0]) * (quad[1][1] - quad[0][1]));
          if (area > tiny) out.push([quad.concat([quad[0]])]);
        }
      }
    }
    return out;
  }

  const DIRS = ['É', 'ÉK', 'K', 'DK', 'D', 'DNy', 'Ny', 'ÉNy'];
  /** The compass word for an azimuth, in Hungarian (É, ÉK, K, …). */
  function compass(az) { return DIRS[Math.round(((az % 360) + 360) % 360 / 45) % 8]; }

  return { position, times, offset, shadow, compass, perMetre, MAX_LEN };
});
