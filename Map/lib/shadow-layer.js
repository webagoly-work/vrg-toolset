// shadow-layer.js — the Árnyék (S) panel of the VRG Térkép: the buildings' shadows on the ground for
// any date and time, a time slider from sunrise to sunset and a ▶ that plays the light down to
// sunset. The maths is lib/sun.js (window.VRGSun); no data beyond the basemap's own buildings.
//
// What is drawn: for each building in the loaded tiles (the basemap's `buildings` layer; height from
// OSM, 7 m where OSM has none, as the 3D buildings use), the shadow its prism casts on flat ground.
// It is one fill-extrusion layer a few centimetres tall, because a fill-extrusion's opacity applies to
// the whole layer: overlapping shadows do not darken twice. The 3D buildings are lit from the same
// sun (map light). Off by default; ?arnyek=1 opens it now, ?arnyek=2026-12-21T15:30 at that time.
// The hills' own shadow (the ⛰ chip, on when the Domborzat mérése layer has terrain heights, lib/relief-layer.js): a
// ray from every few pixels of the view towards the sun over the terrain tiles (lib/relief.js shadowView), drawn as one
// image under the building shadows, from zoom 11. A building's shadow still has its flat-ground length on a slope
// (docs/map/SHADOWS.md).

const S = () => window.VRGSun;
const SRC = 'vrg-shadows', LAYER = 'vrg-shadows', TSRC = 'vrg-terrain-shadow';
const T_MIN_ZOOM = 11, T_REACH_M = 6000, T_PX = 4;   // the hills' shadow: from zoom 11, hills up to 6 km away, a ray per 4 px
const MIN_ZOOM = 14;           // below this a shadow is a pixel or two and the tiles hold too many buildings
const MAX_BUILDINGS = 25000;   // more than this in view: ask to zoom in instead of stalling the phone
const BUILDING_KINDS = ['building', 'building_part'];
const pad = n => String(n).padStart(2, '0');
const hm = d => pad(d.getHours()) + ':' + pad(d.getMinutes());
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());

export function initShadows({ map, params, store, toast, relief }) {
  const $ = s => document.querySelector(s);
  const btn = $('#b-sun'), panel = $('#sun-panel');
  const api = { on: false, at: null, sun: null, count: 0, toggle, set: setTime, isOn: () => on, refresh: () => { features = gather(); schedule(false); } };
  window.vrgShadows = api;
  if (!btn || !panel || !S()) return null;     // the page then removes the S button

  let on = false, at = new Date(), times = null, light = null, features = [], timer = 0, frame = 0, playing = 0, terrainN = 0;
  let terrainOn = !!relief && store.get('sunTerrain', true);
  panel.innerHTML = `
    <div class="lg-h"><b>Árnyékok</b><span id="sun-read" class="m"></span><button type="button" class="lg-x" id="sun-x" aria-label="Bezárás">✕</button></div>
    <div class="lg-row">
      <input type="date" id="sun-date" aria-label="Nap">
      <button type="button" class="lg-chip" id="sun-now">Most</button>
      <button type="button" class="lg-chip" id="sun-play" aria-pressed="false">▶ Napnyugtáig</button>
      ${relief ? '<button type="button" class="lg-chip" id="sun-terrain" aria-pressed="' + terrainOn + '" title="A dombok árnyéka a terepadatból">⛰ Domborzat</button>' : ''}
    </div>
    <div class="lg-time sun-time"><span id="sun-rise" class="m"></span><input type="range" id="sun-t" step="5" aria-label="Időpont"><span id="sun-set" class="m"></span><output id="sun-clock"></output></div>
    <div class="m sun-note">Sík terepen számolva. Épületmagasság az OpenStreetMapből; ahol nincs megadva, 7 m.</div>`;
  const date = $('#sun-date'), range = $('#sun-t');

  const center = () => map.getCenter();
  const minutes = d => d.getHours() * 60 + d.getMinutes();
  const atMinutes = (day, m) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(m / 60), m % 60);

  // ---------------------------------------------------------------- the panel
  function dayChanged() {
    const c = center();
    times = S().times(at, c.lat, c.lng);
    const lo = times.rise ? Math.floor(minutes(times.rise) / 5) * 5 : 0;
    const hi = times.set ? Math.ceil(minutes(times.set) / 5) * 5 : 1435;
    range.min = String(lo); range.max = String(hi);
    $('#sun-rise').textContent = times.rise ? '☀ ' + hm(times.rise) : '';
    $('#sun-set').textContent = times.set ? hm(times.set) + ' ☾' : '';
    date.value = ymd(at);
  }
  function readout() {
    const c = center();
    const sun = api.sun = S().position(at, c.lat, c.lng);
    range.value = String(Math.min(+range.max, Math.max(+range.min, minutes(at))));
    $('#sun-clock').textContent = hm(at);
    const per = S().perMetre(sun);
    $('#sun-read').textContent = sun.altitude <= 0 ? ' · a nap a horizont alatt'
      : ` · ${S().compass(sun.azimuth)} ${Math.round(sun.azimuth)}° · ${sun.altitude.toFixed(0)}° magasan · árnyék ${per ? (Math.hypot(per[0], per[1])).toFixed(1) : '—'}× a magasság`;
  }
  function setTime(d, opt) {
    const day = ymd(d) !== ymd(at);
    at = new Date(d); api.at = at;
    if (day || !times || (opt && opt.recalcDay)) dayChanged();
    readout(); lightFromSun(); schedule(false);
  }
  date.onchange = () => {
    const [y, m, dd] = date.value.split('-').map(Number);
    if (!y) return;
    setTime(new Date(y, m - 1, dd, at.getHours(), at.getMinutes()), { recalcDay: true });
  };
  range.oninput = () => setTime(atMinutes(at, +range.value));
  $('#sun-now').onclick = () => { stop(); setTime(new Date(), { recalcDay: true }); };
  $('#sun-play').onclick = () => (playing ? stop() : play());
  $('#sun-x').onclick = () => toggle(false);
  if (relief) $('#sun-terrain').onclick = () => {
    terrainOn = !terrainOn; store.set('sunTerrain', terrainOn);
    $('#sun-terrain').setAttribute('aria-pressed', terrainOn ? 'true' : 'false');
    terrain();
  };

  // ▶: from the current time to sunset in about eight seconds, five minutes a step
  function play() {
    if (!times || !times.set) return;
    if (at >= times.set) setTime(atMinutes(at, +range.min));
    const end = times.set.getTime();
    const stepMs = Math.max(5 * 60000, (end - at.getTime()) / 100);
    $('#sun-play').setAttribute('aria-pressed', 'true'); $('#sun-play').textContent = '■ Megállítás';
    playing = setInterval(() => {
      const next = Math.min(end, at.getTime() + stepMs);
      setTime(new Date(next));
      if (next >= end) stop();
    }, 80);
  }
  function stop() {
    clearInterval(playing); playing = 0;
    $('#sun-play').setAttribute('aria-pressed', 'false'); $('#sun-play').textContent = '▶ Napnyugtáig';
  }

  // ---------------------------------------------------------------- the light on the 3D buildings
  function lightFromSun() {
    const sun = api.sun;
    if (!sun) return;
    if (light === null) light = map.getLight ? (map.getLight() || {}) : {};
    // the direction is the sun's; the height is kept at 30°+ so roofs stay readable when the sun is low
    const polar = 90 - Math.max(sun.altitude, 30);
    map.setLight({ anchor: 'map', position: [1.15, sun.azimuth, polar], color: sun.altitude < 8 ? '#ffe2c0' : '#ffffff',
      intensity: sun.altitude <= 0 ? 0.2 : 0.45 });
  }
  function restoreLight() { if (light !== null) { try { map.setLight(light); } catch { /* the style's default */ } light = null; } }

  // ---------------------------------------------------------------- the shadows
  function ensureLayer() {
    if (map.getSource(SRC)) return;
    map.addSource(SRC, { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, tolerance: 0.2, buffer: 64 });
    map.addLayer({ id: LAYER, type: 'fill-extrusion', source: SRC, paint: {
      'fill-extrusion-color': '#2b2a3a', 'fill-extrusion-height': 0.25, 'fill-extrusion-base': 0,
      'fill-extrusion-opacity': ['interpolate', ['linear'], ['zoom'], MIN_ZOOM, 0, MIN_ZOOM + 0.6, 0.32],
      'fill-extrusion-vertical-gradient': false } }, map.getLayer('buildings-3d') ? 'buildings-3d' : undefined);
  }
  function setData(fc) { const s = map.getSource(SRC); if (s) s.setData(fc); }

  /** The buildings in the loaded tiles near the view, once per tile change (deduplicated by id and shape). */
  function gather() {
    const b = map.getBounds();
    const c = center();
    const reach = S().offset({ azimuth: 0, altitude: 1 }, 200, c.lat);   // how far a tall building's evening shadow reaches
    const pad = Math.abs(reach ? reach[1] : 0.003);
    const W = b.getWest() - pad * 1.6, E = b.getEast() + pad * 1.6, So = b.getSouth() - pad, N = b.getNorth() + pad;
    // B on and the view in its area: the measured buildings cast the shadows (lib/heights-layer.js)
    const hv = window.vrgHeights, ext = hv && hv.isOn() && hv.extent();
    if (ext && c.lng >= ext.west && c.lng <= ext.east && c.lat >= ext.south && c.lat <= ext.north) { api.measured = true; return hv.buildings({ west: W, east: E, south: So, north: N }).slice(0, MAX_BUILDINGS + 1); }
    api.measured = false;
    const raw = map.querySourceFeatures('protomaps', { sourceLayer: 'buildings', filter: ['in', ['get', 'kind'], ['literal', BUILDING_KINDS]] });
    const seen = new Set(), out = [];
    for (const f of raw) {
      const g = f.geometry;
      if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) continue;
      const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
      const p0 = polys[0] && polys[0][0] && polys[0][0][0];
      if (!p0 || p0[0] < W || p0[0] > E || p0[1] < So || p0[1] > N) continue;
      const key = (f.id != null ? f.id : '') + ':' + p0[0].toFixed(6) + ',' + p0[1].toFixed(6);
      if (seen.has(key)) continue;
      seen.add(key);
      const h = Number(f.properties.height), base = Number(f.properties.min_height);
      out.push({ polys, h: h > 0 ? h : 7, base: base > 0 ? base : 0 });
      if (out.length > MAX_BUILDINGS) break;
    }
    return out;
  }

  function draw() {
    frame = 0;
    if (!on) return;
    const sun = api.sun;
    if (map.getZoom() < MIN_ZOOM) { setData({ type: 'FeatureCollection', features: [] }); api.count = 0; note('Nagyíts közelebb az árnyékokhoz.'); return; }
    if (!sun || sun.altitude <= 0) { setData({ type: 'FeatureCollection', features: [] }); api.count = 0; note(''); return; }
    if (features.length > MAX_BUILDINGS) { setData({ type: 'FeatureCollection', features: [] }); note('Túl sok épület látszik: nagyíts közelebb.'); return; }
    const lat = center().lat, fc = [];
    for (const b of features) {
      const parts = S().shadow(b.polys, b.h, b.base, sun, lat);
      if (parts.length) fc.push({ type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: parts } });
    }
    api.count = fc.length;
    setData({ type: 'FeatureCollection', features: fc });
    note('');
  }
  /** The hills' shadow over the view, for the current sun: a coarse mask laid on the map as an image. */
  async function terrain() {
    const n = ++terrainN;
    const sun = api.sun;
    const off = () => { if (map.getLayer(TSRC)) map.removeLayer(TSRC); if (map.getSource(TSRC)) map.removeSource(TSRC); api.terrain = null; };
    if (!on || !relief || !terrainOn || map.getZoom() < T_MIN_ZOOM || !sun) { off(); return; }
    const bb = map.getBounds(), lat = center().lat;
    const view = { west: bb.getWest(), east: bb.getEast(), south: bb.getSouth(), north: bb.getNorth() };
    const cv = map.getCanvas(), w = Math.max(40, Math.round(cv.clientWidth / T_PX)), h = Math.max(30, Math.round(cv.clientHeight / T_PX));
    let mask;
    if (sun.altitude <= 0) mask = new Uint8Array(w * h).fill(1);
    else {
      // the grid reaches past the view towards the sun: a hill outside it can shade what is in it
      const dLat = T_REACH_M / 111132, dLon = T_REACH_M / (111319 * Math.cos(lat * Math.PI / 180));
      const ext = { west: view.west - dLon, east: view.east + dLon, south: view.south - dLat, north: view.north + dLat };
      const gw = Math.min(700, Math.max(120, Math.round((ext.east - ext.west) * 111319 * Math.cos(lat * Math.PI / 180) / 40)));
      const gh = Math.min(700, Math.max(90, Math.round((ext.north - ext.south) * 111132 / 40)));
      let g;
      try { g = await relief.viewGrid(ext, gw, gh); } catch (e) { off(); return; }
      if (n !== terrainN) return;
      mask = window.VRGRelief.shadowView(g, Object.assign({ w, h }, view), sun, { maxM: T_REACH_M });
    }
    if (n !== terrainN || !on) return;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d'), img = ctx.createImageData(w, h);
    let dark = 0;
    for (let k = 0; k < mask.length; k++) if (mask[k]) { dark++; img.data[4 * k] = 43; img.data[4 * k + 1] = 42; img.data[4 * k + 2] = 58; img.data[4 * k + 3] = 110; }
    ctx.putImageData(img, 0, 0);
    const coords = [[view.west, view.north], [view.east, view.north], [view.east, view.south], [view.west, view.south]], url = c.toDataURL();
    const s = map.getSource(TSRC);
    if (s) s.updateImage({ url, coordinates: coords });
    else {
      map.addSource(TSRC, { type: 'image', url, coordinates: coords });
      map.addLayer({ id: TSRC, type: 'raster', source: TSRC, paint: { 'raster-opacity': 1, 'raster-fade-duration': 0, 'raster-resampling': 'linear' } }, map.getLayer(LAYER) ? LAYER : (map.getLayer('buildings-3d') ? 'buildings-3d' : undefined));
    }
    api.terrain = { share: dark / mask.length, w, h };
  }

  function note(t) {
    const n = panel.querySelector('.sun-note'); n.dataset.warn = t ? '1' : '';
    n.textContent = t || ('Az épületek árnyéka sík terepen számolva. Épületmagasság ' + (api.measured ? 'mérésből (B)' : 'az OpenStreetMapből; ahol nincs megadva, 7 m') + '.' + (relief && terrainOn ? ' ⛰: a dombok árnyéka a terepadatból.' : ''));
  }

  /** Re-gather the buildings (the view or the tiles changed) or only redraw (the time changed). */
  function schedule(regather) {
    if (!on) return;
    if (regather) { clearTimeout(timer); timer = setTimeout(() => { features = gather(); if (!frame) frame = requestAnimationFrame(draw); }, 220); return; }
    if (!frame) frame = requestAnimationFrame(draw);
    clearTimeout(schedule.tt); schedule.tt = setTimeout(terrain, 120);      // the hills' shadow follows the time
  }

  const onMove = () => { schedule(true); clearTimeout(schedule.tt); schedule.tt = setTimeout(terrain, 260); };   // and the view
  const onData = e => { if (e.sourceId === 'protomaps' && e.isSourceLoaded) schedule(true); };
  const onDay = () => { if (on) { dayChanged(); readout(); } };

  function toggle(want) {
    on = want === undefined ? !on : !!want;
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    panel.hidden = !on;
    document.body.classList.toggle('sun-on', on);
    store.set('sun', on);
    if (on) {
      ensureLayer();
      dayChanged(); readout(); lightFromSun();
      map.on('moveend', onMove); map.on('sourcedata', onData); map.on('moveend', onDay);
      features = gather(); schedule(false);
    } else {
      stop();
      map.off('moveend', onMove); map.off('sourcedata', onData); map.off('moveend', onDay);
      setData({ type: 'FeatureCollection', features: [] });
      restoreLight(); terrainN++; if (map.getLayer(TSRC)) map.removeLayer(TSRC); if (map.getSource(TSRC)) map.removeSource(TSRC);
    }
    api.on = on;
  }
  btn.onclick = () => toggle();

  // ?arnyek=1 (now) or ?arnyek=2026-12-21T15:30 (that local time); else the last state of this browser
  const q = params.get('arnyek');
  if (q && q !== '0') {
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{1,2}):(\d{2}))?$/.exec(q);
    if (m) at = new Date(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 12, m[5] ? +m[5] : 0);
  }
  api.at = at;
  const start = () => { if ((q && q !== '0') || store.get('sun', false)) toggle(true); };
  if (map.loaded()) start(); else map.once('load', start);
  return api;
}
