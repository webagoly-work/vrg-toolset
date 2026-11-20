// weather-layer.js — the VRG Térkép "W" layer: online weather from VRG Időjárás, animated on the map.
//
// Data: GET /weather/* from serve.js, which reads Weather/data/weather.sqlite read-only (Weather/lib/maplayers.js).
// What VRG Időjárás fetched (MET Norway / Open-Meteo fields, HungaroMet stations, lightning, radar, MeteoAlarm warnings)
// is drawn here; the Frissítés button asks serve.js to run Weather's 'terkep' pipeline. docs/map/WEATHER-MAP.md.
//
// Layers, each on its own toggle and drawn over each other in this order (bottom to top):
//   temp, cloud, gust, precip      field canvases (MapLibre canvas sources, draped, under the labels)
//   radar                          HungaroMet frames, cross-faded (only while the timeline is inside their hour)
//   warnings                       official warning areas, tinted by level, orange/red ones breathing
//   jobs                           weather risk rings around the job pins (only with the J layer, client data)
//   lightning                      strikes of the last hour, coloured by age, the newest pulsing
//   wind                           particles on a canvas over the map
//   stations                       HungaroMet readings: temperature, wind arrow, gust, on a canvas over the map
// One timeline drives them all: forecast mode = 3 h back to 48 h ahead (hourly frames, interpolated), measured
// mode = the last 3 h of station readings (10-minute frames). Play loops; the field texture drifts with the wind.
//
//   initWeather({ map, maplibregl, params, store, toast }) -> api (window.vrgWeather)
// Keys: W layer · when on: P play/pause · [ ] step · M forecast/measured · Esc readout off

import { decode, frameAt, sample, RAMPS, css, FieldCanvas, Particles, circlePolygon, compass, fromDir } from './weather-fields.js';

export const WX_LAYERS = [
  { id: 'temp', hu: 'Hőmérséklet', field: 't2m', dot: 'linear-gradient(90deg,#3468ba,#f2e2aa,#c43a22)' },
  { id: 'cloud', hu: 'Felhőzet', field: 'cloud', dot: '#6a7486' },
  { id: 'gust', hu: 'Széllökés-sávok', field: 'gust', dot: 'linear-gradient(90deg,#e8b63c,#e48028,#ce3428)' },
  { id: 'precip', hu: 'Csapadék', field: 'precip', dot: '#2452c8' },
  { id: 'radar', hu: 'Radar', dot: '#28c85a' },
  { id: 'warnings', hu: 'Figyelmeztetések', dot: '#e8b63c' },
  { id: 'jobs', hu: 'Munkák kockázata', dot: '#b0241e' },
  { id: 'lightning', hu: 'Villámok', dot: '#ffd23f' },
  { id: 'wind', hu: 'Szél', dot: '#1f1d1a' },
  { id: 'stations', hu: 'Mérőállomások', dot: '#fffaf0' },
];
const DEFAULT_ON = ['precip', 'wind', 'lightning', 'warnings', 'stations', 'jobs'];
const FIELD_ORDER = ['temp', 'cloud', 'gust', 'precip'];   // bottom to top: rain stays readable over the gust bands
const LEVEL = { 1: ['zöld', '#3d8a4f'], 2: ['sárga', '#e8b63c'], 3: ['narancs', '#e07020'], 4: ['piros', '#c4261e'] };
const ALERT = { amber: '#e8a020', red: '#c4261e' };
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const f1 = x => (x == null || Number.isNaN(x) ? '–' : (Math.round(x * 10) / 10).toFixed(1).replace('.', ','));
const f0 = x => (x == null || Number.isNaN(x) ? '–' : String(Math.round(x)).replace('-', '−'));
const fmt = (t, o) => new Intl.DateTimeFormat('hu-HU', { timeZone: 'Europe/Budapest', ...o }).format(new Date(t));
const when = t => fmt(t, { weekday: 'short' }) + ' ' + fmt(t, { month: 'numeric', day: 'numeric' }) + ' ' + fmt(t, { hour: '2-digit', minute: '2-digit' });
const ago = t => { const m = Math.round((Date.now() - Date.parse(t)) / 60e3); return m < 60 ? m + ' perce' : m < 1440 ? Math.round(m / 60) + ' órája' : Math.round(m / 1440) + ' napja'; };

export function weatherAllowed(params) { return params.get('wx') !== '0'; }
// is the J layer on? (it may not be set up at all: guest mode, ?embed, switched off — then isOn() can throw)
function jobsOn() { try { const J = window.vrgJobs; return !!(J && J.isOn && J.isOn()); } catch { return false; } }

export function initWeather({ map, maplibregl, params, store, toast }) {
  const $ = s => document.querySelector(s);
  const btn = $('#b-wx'), panel = $('#wx-panel'), readout = $('#wx-read');
  const api = { on: false, ready: false, toggle, setTime, play, setMode, state: () => S, jobCard, layers: () => [...S.layers], setLayers };
  window.vrgWeather = api;
  if (!weatherAllowed(params)) { btn.remove(); return api; }
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const guest = params.get('vendeg') === '1' || params.get('guest') === '1';
  const S = {
    mode: store.get('wx.mode', 'forecast'), layers: new Set(store.get('wx.layers', DEFAULT_ON)), opacity: store.get('wx.opacity', 0.85),
    status: null, F: null, fields: {}, t: Date.now(), playing: false, stations: null, lightning: null, warnings: [], radar: [], jobs: {},
    collapsed: store.get('wx.collapsed', false), cursor: null,
  };
  let styleReady = map.loaded(); map.once('load', () => { styleReady = true; });
  let raf = 0, lastFrame = 0, lastField = 0, timer = 0, built = false;
  const canv = {};                                   // field layer id -> FieldCanvas
  const overlay = document.createElement('canvas'), symbols = document.createElement('canvas');
  // inside the canvas container, right after the map's canvas: markers and popups (added later) stay above them
  for (const c of [symbols, overlay]) { c.className = 'wx-overlay'; c.setAttribute('aria-hidden', 'true'); map.getCanvas().after(c); }
  const particles = new Particles(map, overlay);
  let drawn = [];                                    // station hit boxes for clicks

  // ---------------------------------------------------------------- data
  async function get(u) { const r = await fetch(u, { cache: 'no-store' }); if (!r.ok) throw Object.assign(new Error('HTTP ' + r.status), { status: r.status }); return r.json(); }
  async function loadStatus() { S.status = await get('/weather/status'); return S.status; }
  async function loadFields(mode) {
    try { const raw = await get('/weather/fields?mode=' + mode); S.fields[mode] = decode(raw); }
    catch (e) { S.fields[mode] = null; }
    return S.fields[mode];
  }
  async function loadAll() {
    const st = await loadStatus();
    if (!st.on) throw new Error(st.reason || 'nincs adat');
    const tasks = [loadFields(S.mode)];
    tasks.push(get('/weather/stations').then(x => { S.stations = x; }).catch(() => {}));
    tasks.push(get('/weather/lightning?min=60').then(x => { S.lightning = x; }).catch(() => {}));
    tasks.push(get('/weather/warnings').then(x => { S.warnings = x; }).catch(() => {}));
    tasks.push(get('/weather/radar').then(x => { S.radar = x; }).catch(() => {}));
    await Promise.all(tasks);
    await loadJobs();
    S.F = S.fields[S.mode] || null;
    if (!S.F && S.mode === 'forecast' && st.obs) { S.mode = 'obs'; S.F = await loadFields('obs'); }
    clampTime(true);
  }
  async function loadJobs() {
    if (!jobsOn() || !S.status || !S.status.jobs) { S.jobs = {}; return; }
    try { S.jobs = await get('/weather/jobs'); } catch { S.jobs = {}; }
  }

  // ---------------------------------------------------------------- time
  const times = () => (S.F ? S.F.times : []);
  function range() {
    const T = times();
    let a = T.length ? T[0] : Date.now() - 3 * 3600e3, b = T.length ? T[T.length - 1] : Date.now();
    if (S.layers.has('radar') && S.radar.length) { a = Math.min(a, Date.parse(S.radar[0].at)); b = Math.max(b, Date.parse(S.radar[S.radar.length - 1].at)); }
    return [a, b];
  }
  function clampTime(toNow) {
    const [a, b] = range();
    if (toNow) S.t = Math.min(Math.max(Date.now(), a), b);
    S.t = Math.min(Math.max(S.t, a), b);
  }
  function setTime(t) { S.t = typeof t === 'string' ? Date.parse(t) : t; clampTime(false); drawTime(); renderFields(true); drawSymbols(); }
  function play(v) {
    S.playing = v === undefined ? !S.playing : !!v;
    const p = panel.querySelector('[data-role="play"]'); if (p) { p.textContent = S.playing ? '❚❚' : '▶'; p.setAttribute('aria-pressed', S.playing ? 'true' : 'false'); }
  }
  function step(d) {
    const T = times(); if (!T.length) return;
    const dt = S.mode === 'obs' ? 600e3 : 3600e3;
    setTime(Math.round((S.t + d * dt) / dt) * dt);
  }

  // ---------------------------------------------------------------- map layers
  const firstLabel = () => (map.getStyle().layers.find(l => l.type === 'symbol') || {}).id;
  function ensureLayers() {
    if (built) return;
    built = true;
    const lab = firstLabel();
    const g = (S.F && S.F.grid) || { lon0: 16, lat0: 45.6, dlon: 0.25, dlat: 0.25, nx: 29, ny: 13 };
    const bbox = [g.lon0, g.lat0, g.lon0 + g.dlon * (g.nx - 1), g.lat0 + g.dlat * (g.ny - 1)];
    for (const id of FIELD_ORDER) {
      const fc = canv[id] = new FieldCanvas(bbox, id === 'precip' || id === 'cloud' ? 560 : 420);
      map.addSource('wx-' + id, { type: 'canvas', canvas: fc.canvas, coordinates: fc.coordinates, animate: true });
      map.addLayer({ id: 'wx-' + id, type: 'raster', source: 'wx-' + id, layout: { visibility: 'none' },
        paint: { 'raster-opacity': 0, 'raster-fade-duration': 0, 'raster-resampling': 'linear' } }, lab);
    }
    // radar frames: one image source per frame, cross-faded by opacity
    map.addSource('wx-warn', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({ id: 'wx-warn-fill', type: 'fill', source: 'wx-warn', layout: { visibility: 'none' },
      paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.12 } }, lab);
    map.addLayer({ id: 'wx-warn-line', type: 'line', source: 'wx-warn', layout: { visibility: 'none' },
      paint: { 'line-color': ['get', 'color'], 'line-width': 2.2, 'line-dasharray': [3, 2], 'line-opacity': 0.9 } }, lab);
    map.addSource('wx-jobs', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({ id: 'wx-jobs', type: 'circle', source: 'wx-jobs', layout: { visibility: 'none' },
      paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, 10, 14, 22], 'circle-color': 'rgba(0,0,0,0)',
        'circle-stroke-color': ['get', 'color'], 'circle-stroke-width': 3.5, 'circle-stroke-opacity': 0.9 } }, map.getLayer('jobs-ring') ? 'jobs-ring' : undefined);
    map.addSource('wx-strikes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({ id: 'wx-strike-glow', type: 'circle', source: 'wx-strikes', layout: { visibility: 'none' },
      paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 5, 12, 12], 'circle-blur': 0.9, 'circle-color': ['get', 'color'], 'circle-opacity': ['get', 'op'] } });
    map.addLayer({ id: 'wx-strike-core', type: 'circle', source: 'wx-strikes', layout: { visibility: 'none' },
      paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 2.2, 12, 4.5], 'circle-color': ['get', 'color'],
        'circle-stroke-color': '#1f1d1a', 'circle-stroke-width': 1, 'circle-opacity': ['get', 'op'], 'circle-stroke-opacity': ['get', 'op'] } });
    map.addSource('wx-strike-new', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({ id: 'wx-strike-pulse', type: 'circle', source: 'wx-strike-new', layout: { visibility: 'none' },
      paint: { 'circle-radius': ['get', 'r'], 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': '#ffd23f', 'circle-stroke-width': 2, 'circle-stroke-opacity': ['get', 'op'] } });
  }
  function syncRadar() {
    const want = S.layers.has('radar') ? S.radar : [];
    for (let i = 0; i < 16; i++) {
      const id = 'wx-radar-' + i, f = want[i];
      if (!f) { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none'); continue; }
      const [w, s, e, n] = f.bounds, coords = [[w, n], [e, n], [e, s], [w, s]];
      const src = map.getSource(id);
      if (!src) {
        map.addSource(id, { type: 'image', url: f.url, coordinates: coords });
        map.addLayer({ id, type: 'raster', source: id, paint: { 'raster-opacity': 0, 'raster-fade-duration': 0 } }, map.getLayer('wx-warn-fill') ? 'wx-warn-fill' : firstLabel());
      } else if (src.url !== f.url) src.updateImage({ url: f.url, coordinates: coords });
      map.setLayoutProperty(id, 'visibility', 'visible');
    }
  }
  function radarOpacity() {
    const fr = S.layers.has('radar') ? S.radar : [];
    const T = fr.map(f => Date.parse(f.at));
    const inside = T.length && S.t >= T[0] - 5 * 60e3 && S.t <= T[T.length - 1] + 10 * 60e3;
    const fi = inside ? frameAt(T, S.t) : -1, a = Math.floor(fi), w = fi - a;
    for (let i = 0; i < fr.length; i++) {
      const op = !inside ? 0 : i === a ? (1 - w) : i === a + 1 ? w : 0;
      if (map.getLayer('wx-radar-' + i)) map.setPaintProperty('wx-radar-' + i, 'raster-opacity', op * S.opacity * 0.9);
    }
    return inside;
  }
  function vis(id, on) { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none'); }
  function applyLayers() {
    if (!built) return;
    const on = api.on;
    for (const id of FIELD_ORDER) {
      const show = on && S.layers.has(id) && !!S.F && !!S.F.vars[canv[id] ? WX_LAYERS.find(l => l.id === id).field : ''];
      vis('wx-' + id, show);
      map.setPaintProperty('wx-' + id, 'raster-opacity', show ? S.opacity : 0);
      const src = map.getSource('wx-' + id); if (src) (show ? src.play() : src.pause());
    }
    for (const id of ['wx-warn-fill', 'wx-warn-line']) vis(id, on && S.layers.has('warnings'));
    for (const id of ['wx-strike-glow', 'wx-strike-core', 'wx-strike-pulse']) vis(id, on && S.layers.has('lightning'));
    vis('wx-jobs', on && S.layers.has('jobs') && Object.keys(S.jobs).length > 0);
    if (on) syncRadar(); else for (let i = 0; i < 16; i++) vis('wx-radar-' + i, false);
    particles.on = on && S.layers.has('wind') && !!(S.F && S.F.vars.u);
    if (!particles.on) particles.clear();
    overlay.hidden = !particles.on; symbols.hidden = !on;
    radarOpacity(); renderFields(true); drawSymbols();
  }

  // ---------------------------------------------------------------- data -> sources
  const AGE = [[5, '#fff6a8', 1], [15, '#ffd23f', 0.95], [30, '#f39c32', 0.85], [45, '#d9542b', 0.7], [61, '#9c2f2f', 0.5]];
  function strikeData() {
    const now = Date.now(), out = [], fresh = [];
    for (const f of (S.lightning && S.lightning.features) || []) {
      const age = (now - Date.parse(f.properties.at)) / 60e3;
      const a = AGE.find(x => age < x[0]); if (!a) continue;
      out.push({ ...f, properties: { color: a[1], op: a[2] } });
      if (age < 5) fresh.push({ ...f, properties: { seed: (Date.parse(f.properties.at) / 1000) % 1.7 } });
    }
    S.fresh = fresh;
    return { type: 'FeatureCollection', features: out };
  }
  function warnData() {
    return { type: 'FeatureCollection', features: S.warnings.filter(w => w.lon != null).map(w => ({ type: 'Feature', geometry: circlePolygon(w.lon, w.lat, w.km || 30),
      properties: { area: w.area, level: w.level, color: (LEVEL[w.level] || LEVEL[2])[1] } })) };
  }
  function jobsData() {
    const J = window.vrgJobs, feats = [];
    if (J && J.list) for (const [code, x] of Object.entries(S.jobs)) {
      const j = J.find(code); if (!j || typeof j.lon !== 'number') continue;
      feats.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [j.lon, j.lat] }, properties: { code, level: x.level, color: ALERT[x.level] || ALERT.amber } });
    }
    return { type: 'FeatureCollection', features: feats };
  }
  function pushData() {
    if (!built) return;
    map.getSource('wx-strikes').setData(strikeData());
    map.getSource('wx-warn').setData(warnData());
    map.getSource('wx-jobs').setData(jobsData());
  }

  // ---------------------------------------------------------------- the animation loop
  function meanWind() {
    if (!S.F || !S.F.vars.u) return [3, 1];
    const c = map.getCenter(), fi = frameAt(times(), S.t);
    const u = sample(S.F, 'u', c.lng, c.lat, fi), v = sample(S.F, 'v', c.lng, c.lat, fi);
    return Number.isNaN(u) ? [3, 1] : [u, v];
  }
  function renderFields(force) {
    if (!built || !S.F) return;
    const fi = frameAt(times(), S.t);
    const [u, v] = meanWind(), k = reduced ? 0 : performance.now() / 1000 * 0.9 + (S.t - Date.now()) / 3600e3 * 6;
    const drift = [-u * k, v * k];                     // the texture moves with the wind
    for (const id of FIELD_ORDER) {
      if (!S.layers.has(id)) continue;
      const fld = WX_LAYERS.find(l => l.id === id).field;
      if (!S.F.vars[fld]) continue;
      canv[id].render(S.F, fld, fi, id === 'gust' || id === 'temp' ? [0, 0] : drift);
    }
    if (force) for (const id of FIELD_ORDER) { const s = map.getSource('wx-' + id); if (s && S.layers.has(id)) { s.play(); } }
  }
  function pulse(now) {
    if (!S.layers.has('lightning') || !S.fresh || !map.getSource('wx-strike-new')) return;
    const feats = S.fresh.map(f => { const ph = ((now / 1400) + f.properties.seed) % 1; return { ...f, properties: { r: 4 + ph * 26, op: reduced ? 0.6 : 1 - ph } }; });
    map.getSource('wx-strike-new').setData({ type: 'FeatureCollection', features: feats });
    if (map.getLayer('wx-warn-fill') && S.layers.has('warnings') && !reduced) {
      const b = 0.1 + 0.07 * (0.5 + 0.5 * Math.sin(now / 900));
      map.setPaintProperty('wx-warn-fill', 'fill-opacity', ['case', ['>=', ['get', 'level'], 3], b + 0.05, 0.1]);
    }
    if (map.getLayer('wx-jobs') && S.layers.has('jobs') && !reduced) {
      const ph = (now / 1100) % 1;
      map.setPaintProperty('wx-jobs', 'circle-stroke-width', ['case', ['==', ['get', 'level'], 'red'], 2.5 + 3 * Math.sin(ph * Math.PI), 3]);
    }
  }
  let lastPulse = 0, lastClock = 0;
  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (!api.on) return;
    const dt = Math.min(100, now - (lastFrame || now)); lastFrame = now;
    if (S.playing) {
      const [a, b] = range(), rate = S.mode === 'obs' ? 10 * 60e3 / 400 : 3600e3 / 450;   // 10 min / 0.4 s · 1 h / 0.45 s
      S.t += dt * rate; if (S.t > b) S.t = a;
      if (now - lastClock > 120) { drawTime(); drawSymbols(); lastClock = now; }
    }
    const fi = frameAt(times(), S.t);
    particles.set(S.F, fi); particles.step();
    if (now - lastField > (S.playing ? 60 : 110)) { renderFields(false); radarOpacity(); lastField = now; }
    if (now - lastPulse > 70) { pulse(now); lastPulse = now; }
  }

  // ---------------------------------------------------------------- the symbol canvas: stations, warning labels
  function sizeCanvases() {
    particles.resize();
    const r = window.devicePixelRatio || 1, c = map.getCanvas();
    symbols.width = c.clientWidth * r; symbols.height = c.clientHeight * r;
    symbols.style.width = c.clientWidth + 'px'; symbols.style.height = c.clientHeight + 'px';
  }
  function pill(ctx, x, y, text, bg, fg, r) {
    ctx.font = `600 ${11 * r}px "Segoe UI",system-ui,sans-serif`;
    const w = ctx.measureText(text).width + 12 * r, h = 18 * r;
    ctx.fillStyle = bg; ctx.strokeStyle = 'rgba(31,29,26,.55)'; ctx.lineWidth = 1 * r;
    ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, 9 * r); ctx.fill(); ctx.stroke();
    ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y + 0.5 * r);
    return w;
  }
  function drawSymbols() {
    const ctx = symbols.getContext('2d'), r = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, symbols.width, symbols.height);
    drawn = [];
    if (!api.on) return;
    const W = symbols.width / r, H = symbols.height / r, z = map.getZoom();
    const away = Math.abs(S.t - Date.now()) > 45 * 60e3;   // the readings are of NOW: faded while the timeline is elsewhere
    if (S.layers.has('warnings')) for (const w of S.warnings) {
      if (w.lon == null) continue;
      // a small area (Budapest) is labelled in its middle, a county at the south edge of its circle, so they never stack
      const lat = (w.km || 30) > 20 ? w.lat - (w.km || 30) / 110.57 : w.lat;
      const p = map.project([w.lon, lat]); if (p.x < -80 || p.y < -20 || p.x > W + 80 || p.y > H + 20) continue;
      const L = LEVEL[w.level] || LEVEL[2], ev = [...new Set(w.items.map(i => i.event))].slice(0, 2).join(', ');
      pill(ctx, p.x * r, p.y * r, `⚠ ${w.area} · ${ev} · ${L[0]}`, L[1], w.level >= 3 ? '#fff' : '#1f1d1a', r);
    }
    if (S.layers.has('stations') && S.stations) {
      ctx.globalAlpha = away ? 0.35 : 1;
      const taken = [], gap = z < 8 ? 46 : 36;
      for (const f of S.stations.features) {
        const P = f.properties, p = map.project(f.geometry.coordinates);
        if (p.x < 0 || p.y < 0 || p.x > W || p.y > H) continue;
        if (taken.some(q => Math.abs(q.x - p.x) < gap && Math.abs(q.y - p.y) < gap * 0.6)) continue;
        taken.push(p);
        const x = p.x * r, y = p.y * r;
        // wind arrow: from the station downwind, length by speed
        if (P.wind != null && P.wdir != null && P.wind > 0.3) {
          const to = (P.wdir + 180) * Math.PI / 180, len = (12 + Math.min(P.wind, 20) * 2.2) * r, r0 = 14 * r;   // starts outside the chip
          const sx = x + Math.sin(to) * r0, sy = y - Math.cos(to) * r0, ex = x + Math.sin(to) * (r0 + len), ey = y - Math.cos(to) * (r0 + len);
          ctx.strokeStyle = P.gust >= 12.5 ? '#b0241e' : P.gust >= 10 ? '#c26a12' : '#1f1d1a'; ctx.lineWidth = 2 * r; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
          const hx = Math.sin(to), hy = -Math.cos(to);
          ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex - (hx * 6 - hy * 4) * r, ey - (hy * 6 + hx * 4) * r);
          ctx.moveTo(ex, ey); ctx.lineTo(ex - (hx * 6 + hy * 4) * r, ey - (hy * 6 - hx * 4) * r); ctx.stroke();
        }
        const c = RAMPS.t2m.fn(P.t2m) || [200, 200, 200, 255];
        const bg = `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`, dark = (c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11) < 140;
        const w = pill(ctx, x, y, `${f0(P.t2m)}°`, bg, dark ? '#fff' : '#1f1d1a', r);
        if (P.gust >= 10) { ctx.font = `700 ${10 * r}px "Segoe UI",system-ui,sans-serif`; ctx.fillStyle = P.gust >= 12.5 ? '#b0241e' : '#c26a12'; ctx.textAlign = 'left'; ctx.fillText(`↯${f0(P.gust)}`, x + w / 2 + 3 * r, y); }
        if (P.rain1h >= 0.1) { ctx.font = `600 ${10 * r}px "Segoe UI",system-ui,sans-serif`; ctx.fillStyle = '#2452c8'; ctx.textAlign = 'center'; ctx.fillText(`${f1(P.rain1h)} mm`, x, y + 16 * r); }
        drawn.push({ x: p.x, y: p.y, f });
      }
      ctx.globalAlpha = 1;
    }
    if (built && S.layers.has('lightning')) {
      const k = away ? 0.3 : 1;
      if (k !== S.strikeK) { S.strikeK = k; map.setPaintProperty('wx-strike-core', 'circle-opacity', ['*', ['get', 'op'], k]); map.setPaintProperty('wx-strike-glow', 'circle-opacity', ['*', ['get', 'op'], k]); map.setPaintProperty('wx-strike-core', 'circle-stroke-opacity', ['*', ['get', 'op'], k]); }
    }
  }

  // ---------------------------------------------------------------- the panel
  function legendHtml() {
    const parts = [];
    for (const id of FIELD_ORDER) {
      if (!S.layers.has(id)) continue;
      const R = RAMPS[WX_LAYERS.find(l => l.id === id).field];
      // precipitation reads on a square-root scale: light rain and a downpour both get room
      const sq = R.scale === 'sqrt', fw = x => (sq ? Math.sqrt(x) : x), bw = x => (sq ? x * x : x);
      const lo = R.ticks[0], hi = R.ticks[R.ticks.length - 1], stops = [];
      for (let i = 0; i <= 16; i++) { const v = bw(fw(lo) + (fw(hi) - fw(lo)) * i / 16), c = R.fn(v); stops.push(c ? css([c[0], c[1], c[2], Math.max(c[3], 90)]) : 'transparent'); }
      parts.push(`<div class="wx-ramp"><span>${esc(WX_LAYERS.find(l => l.id === id).hu)}</span><i style="background:linear-gradient(90deg,${stops.join(',')})"></i>
        <span class="wx-ticks">${R.ticks.map(t => `<b style="left:${((fw(t) - fw(lo)) / (fw(hi) - fw(lo)) * 100).toFixed(1)}%">${String(t).replace('.', ',')}</b>`).join('')}</span><em>${esc(R.unit)}</em></div>`);
    }
    if (S.layers.has('lightning')) parts.push(`<div class="wx-ramp"><span>Villám kora</span><span class="wx-age">${AGE.map((a, i) => `<i style="background:${a[1]}"></i>${i === 0 ? '<5' : i === AGE.length - 1 ? '<60 perc' : '<' + a[0]}`).join('')}</span></div>`);
    return parts.join('');
  }
  function drawPanel() {
    const st = S.status || {};
    const src = S.mode === 'obs' ? 'HungaroMet mérések' : (st.forecast ? st.forecast.name : 'nincs előrejelzés-mező');
    const issued = S.F ? S.F.issued : null;
    const chips = WX_LAYERS.filter(l => l.id !== 'jobs' || jobsOn())
      .map(l => {
        const avail = l.field ? !!(S.F && S.F.vars[l.field]) : l.id === 'wind' ? !!(S.F && S.F.vars.u) : l.id === 'radar' ? S.radar.length > 0
          : l.id === 'stations' ? !!(S.stations && S.stations.features.length) : l.id === 'lightning' ? !!(S.lightning && S.lightning.features.length)
          : l.id === 'warnings' ? S.warnings.length > 0 : Object.keys(S.jobs).length > 0;
        return `<button type="button" class="lg-chip" data-layer="${l.id}" aria-pressed="${S.layers.has(l.id)}" ${avail ? '' : 'data-empty="1"'} title="${avail ? '' : 'Most nincs adat ehhez a réteghez'}"><span class="dot" style="background:${l.dot}"></span>${esc(l.hu)}</button>`;
      }).join('');
    panel.innerHTML = `
      <div class="lg-h"><b>Időjárás</b><span class="m">${esc(src)}</span>${st.use === 'evaluation' ? '<span class="wx-eval" title="Nem üzleti források is látszanak: VRG munkára nem">kiértékelés</span>' : ''}
        <button type="button" class="lg-x" data-role="collapse" aria-label="${S.collapsed ? 'Kinyitás' : 'Összecsukás'}">${S.collapsed ? '▴' : '▾'}</button></div>
      <div class="lg-b">
        <div class="lg-row wx-mode" role="group" aria-label="Mód">
          <button type="button" class="lg-chip tool" data-mode="forecast" aria-pressed="${S.mode === 'forecast'}" ${st.forecast ? '' : 'disabled title="' + esc(st.forecastWhy || '') + '"'}>Előrejelzés (48 óra)</button>
          <button type="button" class="lg-chip tool" data-mode="obs" aria-pressed="${S.mode === 'obs'}" ${st.obs ? '' : 'disabled'}>Mérés (3 óra)<kbd>M</kbd></button>
        </div>
        <div class="lg-row wx-layers">${chips}</div>
        <div class="lg-time wx-time"><button type="button" class="lg-chip tool" data-role="play" aria-pressed="${S.playing}" title="Lejátszás (P)">${S.playing ? '❚❚' : '▶'}</button>
          <input type="range" data-role="time" aria-label="Időpont" step="60000"><output data-role="when"></output>
          <button type="button" class="lg-chip tool" data-role="now" title="Vissza a jelenhez">Most</button></div>
        <div class="wx-legend">${legendHtml()}</div>
        <div class="wx-foot"><span>${issued ? 'kiadva ' + esc(when(issued)) : ''}${st.stations ? ' · ' + esc(st.stations.n) + ' állomás' : ''}${st.lightning && st.lightning.n ? ' · ' + esc(st.lightning.n) + ' villám az elmúlt órában' : ''}</span>
          <span class="wx-ctl"><label title="Átlátszóság">◐ <input type="range" data-role="opacity" min="0.2" max="1" step="0.05" value="${S.opacity}" aria-label="Átlátszóság"></label>
          ${guest ? '' : `<button type="button" class="lg-chip tool" data-role="refresh" title="VRG Időjárás: 'terkep' folyamat (online források)">${st.busy ? 'frissít…' : 'Frissítés'}</button>`}</span></div>
        <div class="wx-attr">${esc((st.attribution || []).join(' · '))}</div>
      </div>`;
    panel.classList.toggle('collapsed', S.collapsed);
    wirePanel(); drawTime();
  }
  function drawTime() {
    const inp = panel.querySelector('[data-role="time"]'), out = panel.querySelector('[data-role="when"]');
    if (!inp) return;
    const [a, b] = range();
    inp.min = String(a); inp.max = String(b); inp.value = String(S.t);
    const dm = Math.round((S.t - Date.now()) / 60e3), sign = dm > 0 ? '+' : '−', am = Math.abs(dm);
    out.textContent = when(S.t) + (am < 8 ? ' · most' : am < 90 ? ` · ${sign}${am} p` : ` · ${sign}${Math.round(am / 60)} ó`);
    out.classList.toggle('wx-past', S.t < Date.now() - 20 * 60e3);
  }
  function wirePanel() {
    panel.querySelectorAll('[data-layer]').forEach(b => { b.onclick = () => {
      const id = b.dataset.layer; S.layers.has(id) ? S.layers.delete(id) : S.layers.add(id);
      store.set('wx.layers', [...S.layers]); applyLayers(); drawPanel();
    }; });
    panel.querySelectorAll('[data-mode]').forEach(b => { b.onclick = () => setMode(b.dataset.mode); });
    const q = r => panel.querySelector(`[data-role="${r}"]`);
    q('collapse').onclick = () => { S.collapsed = !S.collapsed; store.set('wx.collapsed', S.collapsed); drawPanel(); };
    q('play').onclick = () => play();
    q('now').onclick = () => { play(false); setTime(Date.now()); };
    q('time').oninput = e => { play(false); setTime(+e.target.value); };
    q('opacity').oninput = e => { S.opacity = +e.target.value; store.set('wx.opacity', S.opacity); applyLayers(); };
    const rf = q('refresh'); if (rf) rf.onclick = refresh;
  }
  function setLayers(ids) { S.layers = new Set(ids); store.set('wx.layers', [...S.layers]); applyLayers(); drawPanel(); }
  async function setMode(m) {
    if (m === S.mode) return;
    S.mode = m; store.set('wx.mode', m);
    S.F = S.fields[m] || await loadFields(m);
    play(false); clampTime(true); particles.clear(); applyLayers(); drawPanel();
  }
  async function refresh() {
    const b = panel.querySelector('[data-role="refresh"]'); if (b) { b.disabled = true; b.textContent = 'frissít…'; }
    try {
      const r = await fetch('/weather/refresh', { method: 'POST', headers: { 'x-vrg': '1' } });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status);
      const bad = (j.steps || []).filter(s => s.status !== 'ok');
      toast('Időjárás frissítve' + (bad.length ? ' — figyelmeztetés: ' + bad.map(s => s.summary || s.line).join('; ') : ''));
      S.fields = {}; await loadAll(); applyLayers(); pushData(); drawPanel();
    } catch (e) { toast('Frissítés sikertelen: ' + e.message); if (b) { b.disabled = false; b.textContent = 'Frissítés'; } }
  }

  // ---------------------------------------------------------------- the cursor readout and station cards
  function onMove(e) {
    if (!api.on || !S.F) { readout.hidden = true; return; }
    const { lng, lat } = e.lngLat, fi = frameAt(times(), S.t), parts = [];
    const v = k => sample(S.F, k, lng, lat, fi);
    if (Number.isNaN(v('t2m')) && Number.isNaN(v('u'))) { readout.hidden = true; return; }
    if (!Number.isNaN(v('t2m'))) parts.push(`<b>${f1(v('t2m'))} °C</b>`);
    if (!Number.isNaN(v('u'))) { const u = v('u'), w = v('v'); parts.push(`${compass(fromDir(u, w))} ${f1(Math.hypot(u, w))} m/s`); }
    if (!Number.isNaN(v('gust'))) parts.push(`lökés ${f1(v('gust'))}`);
    if (!Number.isNaN(v('precip'))) parts.push(`${f1(v('precip'))} mm/h`);
    if (!Number.isNaN(v('cloud'))) parts.push(`felhő ${f0(v('cloud'))} %`);
    readout.innerHTML = parts.join(' · ');
    readout.hidden = false;
    readout.style.left = Math.min(e.point.x + 16, map.getCanvas().clientWidth - 260) + 'px';
    readout.style.top = Math.max(e.point.y - 34, 4) + 'px';
  }
  let popup = null;
  function onClick(e) {
    if (!api.on || !S.layers.has('stations')) return;
    if (map.getLayer('jobs-hit') && map.queryRenderedFeatures(e.point, { layers: ['jobs-hit'] }).length) return;
    const hit = drawn.find(d => Math.hypot(d.x - e.point.x, d.y - e.point.y) < 16);
    if (!hit) return;
    const P = hit.f.properties;
    if (popup) popup.remove();
    popup = new maplibregl.Popup({ offset: 14, className: 'jpop', maxWidth: '280px' }).setLngLat(hit.f.geometry.coordinates).setHTML(
      `<section class="jcard"><div class="jh"><b>${esc(P.name || P.id)}</b><span class="chip kit">HungaroMet</span></div>
       <dl><dt>Mérés</dt><dd>${esc(when(P.at))} (${esc(ago(P.at))})</dd><dt>Hőmérséklet</dt><dd>${f1(P.t2m)} °C</dd>
       ${P.rh2m != null ? `<dt>Páratartalom</dt><dd>${f0(P.rh2m)} %</dd>` : ''}
       ${P.wind != null ? `<dt>Szél</dt><dd>${P.wdir != null ? compass(P.wdir) + ' ' : ''}${f1(P.wind)} m/s</dd>` : ''}
       ${P.gust != null ? `<dt>Lökés</dt><dd${P.gust >= 12.5 ? ' class="warn"' : ''}>${f1(P.gust)} m/s</dd>` : ''}
       ${P.rain1h != null ? `<dt>Csapadék</dt><dd>${f1(P.rain1h)} mm / óra</dd>` : ''}
       ${P.pmsl != null ? `<dt>Légnyomás</dt><dd>${f1(P.pmsl)} hPa</dd>` : ''}</dl></section>`).addTo(map);
  }

  // ---------------------------------------------------------------- the job card line
  function jobCard(code) {
    const x = S.jobs && S.jobs[code];
    if (!api.on || !x || !x.alerts.length) return '';
    return `<div class="wx-jobline" style="--c:${ALERT[x.level] || ALERT.amber}"><b>Időjárás (24 óra)</b>${x.alerts.slice(0, 3).map(a =>
      `<div><i></i>${esc(fmt(a.starts, { hour: '2-digit' }))}–${esc(fmt(a.ends, { hour: '2-digit' }))}h · ${esc(a.title)}</div>`).join('')}</div>`;
  }

  // ---------------------------------------------------------------- on / off
  async function toggle(v) {
    const want = v === undefined ? !api.on : !!v;
    if (want === api.on) return;
    api.on = want;
    btn.setAttribute('aria-pressed', want ? 'true' : 'false');
    document.body.classList.toggle('wx-on', want);
    panel.hidden = !want;
    store.set('wx', want);
    if (!want) { play(false); readout.hidden = true; if (popup) popup.remove(); applyLayers(); cancelAnimationFrame(raf); raf = 0; clearInterval(timer); return; }
    panel.innerHTML = '<div class="lg-h"><b>Időjárás</b><span class="m">betöltés…</span></div>';
    try {
      for (let i = 0; i < 300 && !styleReady && !map.isStyleLoaded(); i++) await new Promise(r => setTimeout(r, 100));
      await loadAll();
      ensureLayers(); sizeCanvases(); pushData(); applyLayers(); drawPanel();
      api.ready = true;
      if (!raf) raf = requestAnimationFrame(loop);
      timer = setInterval(async () => {               // the live parts every 2 minutes
        try {
          const old = S.status && S.status.forecast && S.status.forecast.issued;
          await loadStatus();
          [S.lightning, S.stations, S.warnings] = await Promise.all([get('/weather/lightning?min=60'), get('/weather/stations'), get('/weather/warnings')]);
          await loadJobs();
          if (S.status.forecast && S.status.forecast.issued !== old) { S.fields = {}; S.F = await loadFields(S.mode); }
          pushData(); applyLayers(); drawPanel();
        } catch { /* the next round */ }
      }, 120e3);
    } catch (e) {
      api.on = false; btn.setAttribute('aria-pressed', 'false'); document.body.classList.remove('wx-on'); panel.hidden = true; store.set('wx', false);
      toast('Az időjárás-réteg nem töltődött be: ' + e.message);
    }
  }
  btn.onclick = () => toggle();
  map.on('move', () => { if (api.on) { particles.clear(); drawSymbols(); } });
  map.on('resize', () => { if (api.on) { sizeCanvases(); drawSymbols(); } });
  map.on('mousemove', onMove);
  map.on('mouseout', () => { readout.hidden = true; });
  map.on('click', onClick);
  addEventListener('vrg:jobs', async () => { if (!api.on) return; await loadJobs(); pushData(); applyLayers(); drawPanel(); });
  addEventListener('keydown', e => {
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) || e.ctrlKey || e.altKey || e.metaKey) return;
    const k = e.key.toLowerCase();
    if (k === 'w') toggle();
    else if (!api.on) return;
    else if (k === 'p') play();
    else if (k === ']') { play(false); step(1); }
    else if (k === '[') { play(false); step(-1); }
    else if (k === 'm') setMode(S.mode === 'obs' ? 'forecast' : 'obs');
    else if (k === 'escape') readout.hidden = true;
  });
  if (params.get('wx') === '1' || store.get('wx', false)) toggle(true);
  return api;
}
