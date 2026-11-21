// INVENTED DATA for the VRG Térkép weather layers: one made-up cold front crossing Hungary from the west over the
// next two days. Behind the front: colder, a north-west wind with strong gusts, a rain band with showers and some
// thunder; ahead of it: mild, a light south-west wind, scattered cloud. Used by test/fixtures.js to write the grid
// answers (Open-Meteo multi-point, MET Norway per point), the extra stations, a moving lightning cluster and radar
// PNG frames. Nothing here is real weather.
'use strict';
const zlib = require('zlib');

const H = 3600e3;
const BBOX = [16.0, 45.6, 23.0, 48.7];

// the front's longitude at time t (h from now): it enters at 16.2° E 3 h ago and leaves at 23° E in 45 h
const frontLon = (h, lat) => 16.65 + 0.14 * h + (lat - 47.2) * 0.35;      // tilted SW-NE
const n2 = (x, y) => Math.sin(x * 3.1 + y * 1.7) * Math.cos(x * 1.3 - y * 2.9);   // smooth "weather" texture

function field(lon, lat, t, now) {
  const h = (t - now) / H;
  const dx = lon - frontLon(h, lat);                // < 0 behind the front (west), > 0 ahead
  const behind = 1 / (1 + Math.exp(dx * 4));        // 1 behind, 0 ahead, smooth across ~0.5°
  const hourLocal = (new Date(t).getUTCHours() + 1) % 24;
  const diurnal = 4 * Math.sin((hourLocal - 9) / 24 * 2 * Math.PI);
  const t2m = 9 - 6 * behind + diurnal - (lat - 46.5) * 1.2 + n2(lon, lat) * 0.8;
  // wind: SW 5 m/s ahead, NW 10 m/s behind, veering across the front
  const dir = 225 + 90 * behind, speed = 4.5 + 6 * behind + 2.5 * Math.exp(-dx * dx * 3) + n2(lat, lon) * 0.8;
  const gust = speed * (1.45 + 0.25 * behind);
  // rain band 0.1-0.9° behind the front, cells in it
  const band = Math.exp(-((dx + 0.45) ** 2) / 0.09);
  const cells = Math.max(0, 0.55 + 0.45 * n2(lon * 2.2 + h * 0.3, lat * 2.6));
  const precip = Math.max(0, band * cells * 4.2 - 0.15);
  const cloud = Math.min(100, Math.max(5, 25 + 70 * Math.exp(-((dx + 0.3) ** 2) / 0.6) + 15 * n2(lon * 1.7, lat * 2.1 + h * 0.1)));
  const cape = band * cells * 900;
  return { t2m, dir, speed, gust, precip, cloud, cape };
}

function gridPoints(step) {
  const [w, s, e, n] = BBOX, nx = Math.round((e - w) / step) + 1, ny = Math.round((n - s) / step) + 1, out = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) out.push({ lon: +(w + i * step).toFixed(4), lat: +(s + j * step).toFixed(4) });
  return out;
}

// Open-Meteo multi-location answers, one file per chunk of 100 points (named as lib/http.js replay looks for them)
function openMeteoGrid(now) {
  const pts = gridPoints(0.25), files = {};
  const t0 = Math.floor(now / H) * H - 3 * H, times = [];
  for (let i = 0; i <= 51; i++) times.push(t0 + i * H);
  for (let c = 0; c * 100 < pts.length; c++) {
    files[`open-meteo-grid__c${c}.json`] = pts.slice(c * 100, (c + 1) * 100).map(p => {
      const hourly = { time: times.map(t => new Date(t).toISOString().slice(0, 16)), temperature_2m: [], precipitation: [], cloud_cover: [], wind_gusts_10m: [], cape: [], wind_speed_10m: [], wind_direction_10m: [] };
      for (const t of times) {
        const f = field(p.lon, p.lat, t, now);
        hourly.temperature_2m.push(+f.t2m.toFixed(1)); hourly.precipitation.push(+f.precip.toFixed(1)); hourly.cloud_cover.push(Math.round(f.cloud));
        hourly.wind_gusts_10m.push(+f.gust.toFixed(1)); hourly.cape.push(Math.round(f.cape)); hourly.wind_speed_10m.push(+f.speed.toFixed(1)); hourly.wind_direction_10m.push(Math.round(f.dir));
      }
      return { latitude: p.lat, longitude: p.lon, generationtime_ms: 0.5, utc_offset_seconds: 0, timezone: 'GMT', hourly_units: { time: 'iso8601' }, hourly };
    });
  }
  return files;
}

// MET Norway per point (0.5°), the /complete shape
function metNoGrid(now) {
  const files = {};
  gridPoints(0.5).forEach((p, k) => {
    const ts = [], start = Math.floor(now / H) * H;
    for (let i = 0; i <= 50; i++) {
      const t = start + i * H, f = field(p.lon, p.lat, t, now), f1 = field(p.lon, p.lat, t + H, now);
      ts.push({ time: new Date(t).toISOString().replace('.000', ''), data: {
        instant: { details: { air_temperature: +f.t2m.toFixed(1), relative_humidity: 75, wind_speed: +f.speed.toFixed(1), wind_from_direction: Math.round(f.dir),
          wind_speed_of_gust: +f.gust.toFixed(1), cloud_area_fraction: Math.round(f.cloud), air_pressure_at_sea_level: 1010 } },
        next_1_hours: { summary: { symbol_code: f1.precip > 0.2 ? 'rain' : 'partlycloudy_day' }, details: { precipitation_amount: +f1.precip.toFixed(1), probability_of_precipitation: f1.precip > 0.2 ? 80 : 10 } } } });
    }
    files[`met-no-grid__g${k}.json`] = { type: 'Feature', properties: { meta: { updated_at: new Date(now - 30 * 60e3).toISOString() }, timeseries: ts } };
  });
  return files;
}

// ~40 invented stations spread over Hungary (ids 19xxx, names "Állomás nn"), CSV lines in the HungaroMet shape
function stationLines(now) {
  const lines = [];
  const end = Math.floor(now / 600e3) * 600e3;
  const st = [];
  let k = 0;
  for (let lat = 45.95; lat <= 48.45; lat += 0.42) for (let lon = 16.4; lon <= 22.6; lon += 0.85) {
    const jl = lon + n2(lat, lon) * 0.15, jt = lat + n2(lon, lat) * 0.1;
    if (jt > 48.4 && jl < 18) continue;           // outside the country, roughly
    if (Math.hypot((jl - 19.3) * 0.68, jt - 47.45) < 0.75) continue;   // keep clear of Budapest + Pest county: their verification uses the Budapest-scenario stations
    st.push([String(19001 + k++), 'Allomas ' + String(k).padStart(2, '0'), +jt.toFixed(3), +jl.toFixed(3), 120]);
  }
  for (let t = end - 3 * H; t <= end; t += 600e3) {
    const d = new Date(t), stamp = d.getUTCFullYear() + [d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes()].map(n => String(n).padStart(2, '0')).join('');
    for (const [id, name, lat, lon, el] of st) {
      const f = field(lon, lat, t, now);
      lines.push([stamp, id, name, lat, lon, el, (f.precip / 6).toFixed(2), ' ', f.t2m.toFixed(1), ' ', 72, ' ', -999, ' ', f.speed.toFixed(1), ' ', Math.round(f.dir), ' ', f.gust.toFixed(1), ' ', 1010, ' ', 'EOR'].join(';'));
    }
  }
  return { lines, count: st.length };
}

// strikes in the rain band over the last hour, moving with the front (far from Budapest)
function strikeLines(now) {
  const out = [];
  for (let m = 60; m >= 0; m -= 1.5) {
    const t = now - m * 60e3, h = -m / 60;
    for (let q = 0; q < 2; q++) {
      const lat = 46.6 + ((m * 7 + q * 13) % 17) / 17 * 1.4;
      const lon = frontLon(h, lat) - 0.35 + n2(m, q) * 0.12;
      out.push(`${new Date(t).toISOString().replace('.000', '')};${lat.toFixed(3)};${lon.toFixed(3)};${(-8 - (m % 20)).toFixed(1)}`);
    }
  }
  return out;
}

// ---------------------------------------------------------------- radar PNG frames (RGBA, the reflectivity look)
function crc32(b) {
  let c = ~0;
  for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; }
  return ~c >>> 0;
}
function png(w, h, rgba) {
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const RAMP = [[0.2, [120, 190, 255]], [0.8, [40, 120, 230]], [1.8, [40, 200, 90]], [3, [250, 220, 40]], [4.5, [240, 120, 30]], [6, [220, 30, 30]]];
function radarFrames(now, bounds = [13.5, 44.0, 25.5, 50.5]) {
  const files = {}, names = [];
  const W = 240, Hh = 180;
  const t0 = Math.floor(now / 300e3) * 300e3;
  for (let k = 11; k >= 0; k--) {
    const t = t0 - k * 300e3, d = new Date(t);
    const stamp = d.getUTCFullYear() + [d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes()].map(n => String(n).padStart(2, '0')).join('');
    const buf = Buffer.alloc(W * Hh * 4);
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      const lon = bounds[0] + (x + 0.5) / W * (bounds[2] - bounds[0]), lat = bounds[3] - (y + 0.5) / Hh * (bounds[3] - bounds[1]);
      const p = field(lon, lat, t, now).precip * (1 + 0.4 * n2(lon * 9, lat * 9));
      if (p < 0.2) continue;
      let c = RAMP[0][1]; for (const [v, col] of RAMP) if (p >= v) c = col;
      const o = (y * W + x) * 4; buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2]; buf[o + 3] = 230;
    }
    const name = `refl2D_${stamp}.png`;
    names.push(name);
    files[`hungaromet-radar__${name.replace(/[^a-z0-9_-]/gi, '-')}`] = png(W, Hh, buf);
  }
  files['hungaromet-radar__list.html'] = '<html><body>' + names.map(n => `<a href="${n}">${n}</a>`).join('\n') + '</body></html>';
  return files;
}

module.exports = { field, frontLon, BBOX, openMeteoGrid, metNoGrid, stationLines, strikeLines, radarFrames, png };
