// relief-layer.js — the Domborzat mérés (R) panel of the VRG Térkép: the height above sea level, the slope and the way
// the ground faces under the pointer; contour lines and slope classes over the view; two clicks give the profile
// between them (distance, height difference, climb, descent, the steepest stretch). The heights are the map's own
// terrain tiles (data/terrain.pmtiles, lib/dem.js); the maths is lib/relief.js. The shadow layer (S) uses the same
// heights for the shadow the hills cast (api.viewGrid).
//
//   initRelief({ map, store, toast, dem? }) -> api | null    dem: a lib/dem.js source (tests pass their own)
//   api: { on, toggle(want?), sample(lon, lat), viewGrid(bounds, w, h) -> Promise<grid>, profile, dem }
// Off by default; ?domborzat=1 opens it.

const R = () => window.VRGRelief, D = () => window.VRGDem;
const SRC_C = 'vrg-contours', SRC_P = 'vrg-profile', SRC_S = 'vrg-slope';
const MIN_ZOOM = 10;              // below this the terrain tiles of the view are too many to read
const GRID = 360;                 // the view grid's cells across (contours, slope)
const SLOPE = [[2, null], [5, [250, 220, 90]], [10, [245, 165, 60]], [15, [232, 110, 50]], [25, [205, 50, 45]], [90, [130, 20, 60]]];
const DIRS = ['É', 'ÉK', 'K', 'DK', 'D', 'DNy', 'Ny', 'ÉNy'];
const fmtM = v => (isNaN(v) ? '—' : (Math.round(v * 10) / 10).toLocaleString('hu-HU') + ' m');
const fmtD = v => (v >= 1000 ? (Math.round(v / 10) / 100).toLocaleString('hu-HU') + ' km' : Math.round(v) + ' m');

/** The terrain source of the map's style as a lib/dem.js source (null without terrain tiles or the pmtiles library). */
function demFromStyle(map) {
  const src = map.getStyle && map.getStyle().sources && (map.getStyle().sources.terrain || map.getStyle().sources.hillshade);
  if (!src || !src.url || !/^pmtiles:\/\//.test(src.url) || !window.pmtiles || !D()) return null;
  const archive = new window.pmtiles.PMTiles(src.url.replace(/^pmtiles:\/\//, ''));
  const size = src.tileSize || 512;
  let z = 12;
  archive.getHeader().then(h => { if (h && h.maxZoom) z = Math.min(12, h.maxZoom); }).catch(() => {});
  return D().source(D().fromPmtiles(archive, { size }), { z, size });
}

export function initRelief({ map, params, store, toast, dem }) {
  const $ = s => document.querySelector(s);
  const btn = $('#b-relief'), panel = $('#relief-panel');
  if (!btn || !panel || !R() || !D()) return null;
  const S = dem || demFromStyle(map);
  if (!S) { btn.disabled = true; btn.title = 'Domborzat mérése: ehhez a terepadat kell (node Map/tools/fetch-data.js --only=terrain)'; return null; }

  let on = false, A = null, B = null, timer = 0, gridNow = null, busy = 0;
  const show = Object.assign({ contours: true, slope: false }, store.get('relief', {}));
  const api = { on: false, toggle, sample: (lon, lat) => S.sample(lon, lat), viewGrid, profile: null, dem: S, grid: () => gridNow, isOn: () => on };
  window.vrgRelief = api;

  panel.innerHTML = `
    <div class="lg-h"><b>Domborzat mérése</b><button type="button" class="lg-x" id="rl-x" aria-label="Bezárás">✕</button></div>
    <div id="rl-read" class="m">Vidd az egeret a térképre: magasság, lejtő. Két kattintás: metszet.</div>
    <div class="lg-row">
      <button type="button" class="lg-chip tool" id="rl-c" aria-pressed="${show.contours}">Szintvonalak</button>
      <button type="button" class="lg-chip tool" id="rl-s" aria-pressed="${show.slope}">Lejtő</button>
      <span class="m" id="rl-legend"></span>
    </div>
    <div id="rl-prof" hidden></div>
    <div class="m rl-note">Felszínmodell (Copernicus és mások, ≈ 30 m): a tetők és a fák is benne vannak. Magasság a tengerszint felett.</div>`;
  $('#rl-x').onclick = () => toggle(false);
  $('#rl-c').onclick = () => { show.contours = !show.contours; $('#rl-c').setAttribute('aria-pressed', show.contours); store.set('relief', show); refresh(); };
  $('#rl-s').onclick = () => { show.slope = !show.slope; $('#rl-s').setAttribute('aria-pressed', show.slope); store.set('relief', show); refresh(); };

  // ---------------------------------------------------------------- the layers
  function ensure() {
    if (map.getSource(SRC_C)) return;
    const empty = { type: 'FeatureCollection', features: [] };
    map.addSource(SRC_C, { type: 'geojson', data: empty });
    map.addSource(SRC_P, { type: 'geojson', data: empty });
    const before = map.getLayer('buildings-3d') ? 'buildings-3d' : undefined;
    map.addLayer({ id: 'vrg-contours', type: 'line', source: SRC_C, paint: {
      'line-color': ['case', ['get', 'bold'], 'rgba(110,72,40,0.85)', 'rgba(120,84,52,0.5)'],
      'line-width': ['case', ['get', 'bold'], 1.4, 0.7] } }, before);
    map.addLayer({ id: 'vrg-contours-label', type: 'symbol', source: SRC_C, filter: ['get', 'bold'], layout: {
      'symbol-placement': 'line', 'text-field': ['concat', ['to-string', ['get', 'level']], ' m'], 'text-font': ['Noto Sans Regular'],
      'text-size': 11, 'symbol-spacing': 320 }, paint: { 'text-color': '#603c20', 'text-halo-color': 'rgba(250,246,236,0.9)', 'text-halo-width': 1.5 } });
    map.addLayer({ id: 'vrg-profile', type: 'line', source: SRC_P, paint: { 'line-color': '#1f6fb2', 'line-width': 2.5 } });
    map.addLayer({ id: 'vrg-profile-ends', type: 'circle', source: SRC_P, filter: ['==', ['geometry-type'], 'Point'],
      paint: { 'circle-radius': 5, 'circle-color': '#e0a021', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } });
  }
  function clear() {
    for (const id of ['vrg-profile-ends', 'vrg-profile', 'vrg-contours-label', 'vrg-contours', SRC_S]) if (map.getLayer(id)) map.removeLayer(id);
    for (const id of [SRC_C, SRC_P, SRC_S]) if (map.getSource(id)) map.removeSource(id);
  }

  const boundsOf = () => { const b = map.getBounds(); return { west: b.getWest(), east: b.getEast(), south: b.getSouth(), north: b.getNorth() }; };

  /** The heights over [b] as a w × h grid (the tiles loaded first). */
  async function viewGrid(b, w, h) { await S.load(b); return S.grid(b, w, h); }

  async function refresh() {
    if (!on) return;
    const n = ++busy;
    if (map.getZoom() < MIN_ZOOM) { setContours([]); setSlope(null); legend('Nagyíts közelebb (a mérés 10-es nagyítástól megy).'); return; }
    const b = boundsOf(), w = GRID, h = Math.max(40, Math.round(GRID * (b.north - b.south) / ((b.east - b.west) * Math.cos((b.north + b.south) / 2 * Math.PI / 180))));
    let g;
    try { g = await viewGrid(b, w, Math.min(h, 2 * GRID)); } catch (e) { legend(e.message); return; }
    if (n !== busy || !on) return;
    gridNow = g;
    let lo = Infinity, hi = -Infinity;
    for (const z of g.z) if (!isNaN(z)) { lo = Math.min(lo, z); hi = Math.max(hi, z); }
    if (!isFinite(lo)) { legend('Itt nincs terepadat.'); setContours([]); setSlope(null); return; }
    const iv = R().interval(hi - lo);
    legend(show.contours ? 'Szintköz ' + iv + ' m · ' + Math.round(lo) + '–' + Math.round(hi) + ' m' : Math.round(lo) + '–' + Math.round(hi) + ' m');
    if (show.contours) {
      const levels = []; for (let L = Math.ceil(lo / iv) * iv; L <= hi; L += iv) levels.push(L);
      const fs = [];
      for (const c of R().contours(g, levels)) for (const line of c.lines) if (line.length > 2)
        fs.push({ type: 'Feature', properties: { level: Math.round(c.level * 10) / 10, bold: Math.round(c.level / iv) % 5 === 0 }, geometry: { type: 'LineString', coordinates: line } });
      setContours(fs);
    } else setContours([]);
    setSlope(show.slope ? g : null);
  }
  function legend(t) { $('#rl-legend').textContent = t || ''; }
  function setContours(fs) { api.levels = [...new Set(fs.map(f => f.properties.level))].sort((x, y) => x - y); const s = map.getSource(SRC_C); if (s) s.setData({ type: 'FeatureCollection', features: fs }); }

  /** The slope classes over the view as an image laid on the map. */
  function setSlope(g) {
    if (!g) { if (map.getLayer(SRC_S)) map.removeLayer(SRC_S); if (map.getSource(SRC_S)) map.removeSource(SRC_S); return; }
    const cv = document.createElement('canvas'); cv.width = g.w; cv.height = g.h;
    const ctx = cv.getContext('2d'), img = ctx.createImageData(g.w, g.h);
    for (let j = 0; j < g.h; j++) for (let i = 0; i < g.w; i++) {
      const lon = g.west + (i + 0.5) * g.dlon, lat = g.north - (j + 0.5) * g.dlat, s = R().slope(g, lon, lat).slope;
      let col = null; for (const [lim, c] of SLOPE) if (s < lim) { col = c; break; }
      const o = (j * g.w + i) * 4;
      if (col) { img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 150; }
    }
    ctx.putImageData(img, 0, 0);
    const coords = [[g.west, g.north], [g.west + g.w * g.dlon, g.north], [g.west + g.w * g.dlon, g.north - g.h * g.dlat], [g.west, g.north - g.h * g.dlat]];
    const url = cv.toDataURL();
    const src = map.getSource(SRC_S);
    if (src) src.updateImage({ url, coordinates: coords });
    else {
      map.addSource(SRC_S, { type: 'image', url, coordinates: coords });
      map.addLayer({ id: SRC_S, type: 'raster', source: SRC_S, paint: { 'raster-opacity': 0.6, 'raster-fade-duration': 0 } }, map.getLayer('vrg-contours') ? 'vrg-contours' : undefined);
    }
  }

  // ---------------------------------------------------------------- the read-out and the profile
  async function readAt(lon, lat) {
    if (!S.has(lon, lat)) { const d = 0.002; try { await S.load({ west: lon - d, east: lon + d, south: lat - d, north: lat + d }); } catch (e) { return; } }
    const z = S.sample(lon, lat), d = 0.0004;
    const g = { w: 3, h: 3, west: lon - 1.5 * d, north: lat + 1.5 * d, dlon: d, dlat: d, z: new Float32Array(9) };
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) g.z[j * 3 + i] = S.sample(g.west + (i + 0.5) * d, g.north - (j + 0.5) * d);
    const s = R().slope(g, lon, lat);
    $('#rl-read').innerHTML = '<b>' + fmtM(z) + '</b> tszf. · lejtő ' + (isNaN(s.slope) ? '—' : s.slope.toFixed(1) + '°') +
      (s.aspect == null || isNaN(s.slope) ? '' : ', ' + DIRS[Math.round(s.aspect / 45) % 8] + ' felé') + ' · ' + lat.toFixed(5) + ', ' + lon.toFixed(5);
    api.last = { z, slope: s.slope, aspect: s.aspect };
  }

  async function profile() {
    const fs = [A, B].filter(Boolean).map(p => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: p } }));
    if (A && B) fs.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [A, B] } });
    const src = map.getSource(SRC_P); if (src) src.setData({ type: 'FeatureCollection', features: fs });
    const box = $('#rl-prof');
    if (!A || !B) { box.hidden = true; api.profile = null; return; }
    const pad = 0.002, b = { west: Math.min(A[0], B[0]) - pad, east: Math.max(A[0], B[0]) + pad, south: Math.min(A[1], B[1]) - pad, north: Math.max(A[1], B[1]) + pad };
    try { await S.load(b); } catch (e) { box.hidden = false; box.textContent = e.message; return; }
    const step = 0.00025, w = Math.max(3, Math.ceil((b.east - b.west) / step)), h = Math.max(3, Math.ceil((b.north - b.south) / step));
    const p = api.profile = R().profile(S.grid(b, Math.min(w, 2000), Math.min(h, 2000)), A, B, 300);
    const W = 440, H = 120, X = d => 30 + d / p.dist * (W - 38), zs = p.pts.map(q => q.z).filter(z => !isNaN(z));
    const lo = Math.min(...zs), hi = Math.max(...zs), span = Math.max(5, hi - lo), Y = z => H - 16 - (z - lo) / span * (H - 30);
    const path = p.pts.filter(q => !isNaN(q.z)).map((q, k) => (k ? 'L' : 'M') + X(q.d).toFixed(1) + ' ' + Y(q.z).toFixed(1)).join(' ');
    box.hidden = false;
    box.innerHTML = '<div class="m"><b>Metszet</b> ' + fmtD(p.dist) + ' · Δ ' + fmtM(p.dz) + ' · fel ' + fmtM(p.gain) + ', le ' + fmtM(p.loss) + ' · legmeredekebb ' + p.maxSlope.toFixed(1) + '°</div>' +
      '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;display:block"><path d="' + path + ' L' + X(p.dist) + ' ' + (H - 16) + ' L' + X(0) + ' ' + (H - 16) + ' Z" fill="rgba(200,168,120,.35)"/>' +
      '<path d="' + path + '" fill="none" stroke="#8a5a2e" stroke-width="1.6"/><text x="2" y="' + (Y(hi) + 4) + '" font-size="10">' + Math.round(hi) + '</text><text x="2" y="' + (Y(lo) + 4) + '" font-size="10">' + Math.round(lo) + '</text></svg>';
  }

  const onMove = e => { clearTimeout(onMove.t); onMove.t = setTimeout(() => readAt(e.lngLat.lng, e.lngLat.lat), 40); };
  const onClick = e => {
    const p = [e.lngLat.lng, e.lngLat.lat];
    if (!A || B) { A = p; B = null; } else B = p;
    profile();
  };
  const onEnd = () => { clearTimeout(timer); timer = setTimeout(refresh, 200); };

  function toggle(want) {
    on = want === undefined ? !on : !!want;
    api.on = on;
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    panel.hidden = !on;
    store.set('reliefOn', on);
    if (on) {
      ensure();
      map.on('mousemove', onMove); map.on('click', onClick); map.on('moveend', onEnd);
      refresh();
    } else {
      map.off('mousemove', onMove); map.off('click', onClick); map.off('moveend', onEnd);
      A = B = null; api.profile = null; $('#rl-prof').hidden = true; clear();
    }
  }
  btn.onclick = () => toggle();
  if (params && params.get('domborzat') === '1') toggle(true);
  return api;
}
