// jobs-layer.js — the VRG Térkép "J" layer: where the jobs are (client data, internal only).
//
// Data: GET /jobs/helyek.json from serve.js (outside Git: jobs\_elozmenyek\helyek.json, built by
// Map/tools/build-jobs.js). The page asks /jobs/status first; when the layer is switched off (registry
// jobsLayer:false, the TERKEP-KI flag file, OTG) the J button stays greyed with the reason and no
// client data is fetched. Never in Kapu guest mode (?vendeg=1 / ?guest=1); in ?embed=1 only with ?jobs=1.
// While the layer is on, a visible "ÜGYFÉLADAT" badge says so. docs/map/JOBS-MAP.md has the rules,
// docs/map/REFINE.md the look and the controls (R1-R11).
//
//   initJobs({ map, maplibregl, params, store, toast }) -> api
//     api.ready, api.list, api.find(code), api.fly(code), api.toggle(on), api.searchCodes(text),
//     api.filters, api.setTime(day|null), api.heat(on), api.step(+1|-1)
// Keys (when the layer is on): J layer · D density · I timeline · , / . previous / next job · Esc card.

// Status colours against the VRG Terep basemap (yellow/orange roads, light green parks, blue water):
// running work burnt orange, finished deep green, failed slate so it recedes. The basemap is light in
// both colour schemes, so the pins keep this palette in dark mode too (REFINE R11).
export const STATUS = {
  'folyamatban': { hu: 'folyamatban', color: '#d4570f', rank: 0 },
  'befejezett': { hu: 'befejezett', color: '#1f6f43', rank: 1 },
  'meghiúsult': { hu: 'meghiúsult', color: '#6b6470', rank: 2 },
};
// How far the point may be from the real place, in metres (the ring's radius), and the arrival zoom.
export const PREC = {
  'cím': { m: 0, hu: 'pontos cím', zoom: 18.2 },
  'legközelebbi': { m: 40, hu: 'a legközelebbi házszám', zoom: 17.6 },
  'utca': { m: 250, hu: 'csak az utca', zoom: 16.3 },
  'település': { m: 1500, hu: 'csak a település', zoom: 12.8 },
  'nincs': { m: 0, hu: 'nincs helye', zoom: 0 },
};
const SOURCE = { helyszinek: 'helyszinek.json', 'kit:decisions': 'Workflow Kit (döntések)', 'kit:answers_r1': 'Workflow Kit (1. kör)', 'kézi': 'kézi pont' };
const MPP0 = 40075016.686 * Math.cos(47.3 * Math.PI / 180) / 512;     // metres per pixel at zoom 0, Hungary
const DAY = 864e5;
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ft = n => Math.round(n).toLocaleString('hu-HU').replace(/\s/g, ' ') + ' Ft';
const hd = d => d ? d.replaceAll('-', '.') + '.' : '';
const dayN = d => d ? Math.floor(Date.parse(d + 'T00:00:00Z') / DAY) : null;
const dayS = n => new Date(n * DAY).toISOString().slice(0, 10);
const LAYERS = ['jobs-heat', 'jobs-ring', 'jobs-cluster', 'jobs-cluster-n', 'jobs-hit', 'jobs-pin'];

export function jobsAllowed(params) {
  if (params.get('vendeg') === '1' || params.get('guest') === '1') return false;     // Kapu guest mode: never
  if (params.get('embed') === '1' && params.get('jobs') !== '1') return false;       // embedded: only when asked
  return true;
}

// ---------------------------------------------------------------- R1: the pin, drawn once per status
function pinImage(color, draft) {
  const r = 2, w = 30 * r, h = 40 * r;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  const cx = w / 2, cy = 14 * r, R = 11 * r;
  const drop = () => { g.beginPath(); g.moveTo(cx, h - 2 * r); g.bezierCurveTo(cx - 4 * r, 30 * r, cx - R, 22 * r, cx - R, cy);
    g.arc(cx, cy, R, Math.PI, 0); g.bezierCurveTo(cx + R, 22 * r, cx + 4 * r, 30 * r, cx, h - 2 * r); g.closePath(); };
  g.shadowColor = 'rgba(31,29,26,.35)'; g.shadowBlur = 3 * r; g.shadowOffsetY = 1.5 * r;
  drop(); g.fillStyle = color; g.fill();
  g.shadowColor = 'transparent';
  g.lineWidth = 2 * r; g.strokeStyle = '#1f1d1a'; g.stroke();
  g.beginPath(); g.arc(cx, cy, 4.2 * r, 0, Math.PI * 2); g.fillStyle = '#fffaf0'; g.fill();
  if (draft) {                                    // a draft address: a dashed yellow rim around the head
    g.setLineDash([3 * r, 2.2 * r]); g.lineWidth = 2.2 * r; g.strokeStyle = '#f2c94c';
    g.beginPath(); g.arc(cx, cy, R + 1.6 * r, 0, Math.PI * 2); g.stroke();
  }
  return { img: g.getImageData(0, 0, w, h), ratio: r };
}

export async function initJobs({ map, maplibregl, params, store, toast }) {
  const $ = s => document.querySelector(s);
  // isStyleLoaded() stays false while any tile is still loading; layers can be added once 'load' has fired.
  // Registered before the first await, so the event cannot be missed.
  let styleReady = map.loaded();
  map.once('load', () => { styleReady = true; });
  const btn = $('#b-jobs'), badge = $('#jobs-badge'), legend = $('#jobs-legend'), sheet = $('#jobs-sheet');
  const api = { ready: false, list: [], find: c => api.list.find(j => j.code === String(c || '').toUpperCase()), fly, toggle, popup: null,
    searchCodes, filters: null, setTime, heat: setHeat, step, isOn: () => on };
  window.vrgJobs = api;
  if (!jobsAllowed(params)) { btn.remove(); return api; }
  let st = { on: false, reason: 'A szerver nem válaszol.' };
  try { st = await (await fetch('/jobs/status', { cache: 'no-store' })).json(); } catch { /* the reason above */ }
  if (!st.on) {
    btn.disabled = true; btn.title = 'Munkák rétege: ' + st.reason;
    if (params.get('job')) toast('A munkák rétege ki van kapcsolva: ' + st.reason);
    return api;
  }
  let loading = null;
  let on = false, loaded = false, heatOn = false, time = null, playing = 0, cursor = -1, open = null;
  const F = api.filters = { status: new Set(Object.keys(STATUS)), years: new Set(), area: '' };
  let span = { a: 0, b: 1 };
  const narrow = matchMedia('(max-width: 640px)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const col = k => (STATUS[k] || STATUS['folyamatban']).color;

  // ---------------------------------------------------------------- data
  async function load() {
    const r = await fetch('/jobs/helyek.json', { cache: 'no-store' });
    if (!r.ok) throw new Error(r.status === 403 ? 'kikapcsolva' : 'HTTP ' + r.status);
    const doc = await r.json();
    api.list = (doc.jobs || []).map(j => Object.assign({}, j, { fromN: dayN(j.from), toN: dayN(j.to || j.from), year: (j.from || j.to || '').slice(0, 4) }));
    api.built = doc.built;
    const ds = api.list.flatMap(j => [j.fromN, j.toN]).filter(x => x != null);
    span = { a: Math.min(...ds), b: Math.max(...ds) };
    for (const [k, s] of Object.entries(STATUS)) for (const d of [false, true]) {
      const id = 'jpin-' + k + (d ? '-d' : '');
      if (map.hasImage(id)) continue;
      const p = pinImage(s.color, d);
      map.addImage(id, p.img, { pixelRatio: p.ratio });
    }
    addLayers();
    loaded = true; api.ready = true;
    drawLegend(); refresh();
  }
  const placed = j => typeof j.lon === 'number' && typeof j.lat === 'number';
  function visible(j) {
    if (!F.status.has(j.status)) return false;
    if (F.years.size && !F.years.has(j.year)) return false;
    if (F.area && j.area !== F.area) return false;
    if (time != null && (j.fromN == null || j.fromN > time)) return false;
    return true;
  }
  /** the filtered jobs as features; jobs on the same point (BK1/BK2) are one pin with every card */
  function features() {
    const groups = new Map();
    for (const j of api.list) {
      if (!placed(j) || !visible(j)) continue;
      const k = j.lon.toFixed(5) + ',' + j.lat.toFixed(5);
      (groups.get(k) || groups.set(k, []).get(k)).push(j);
    }
    return { type: 'FeatureCollection', features: [...groups.values()].map(js => {
      js.sort((a, b) => STATUS[a.status].rank - STATUS[b.status].rank || (b.fromN || 0) - (a.fromN || 0));
      const lead = js[0];
      const running = time != null && js.some(j => j.fromN <= time && (j.toN || j.fromN) >= time - 14);
      return { type: 'Feature', geometry: { type: 'Point', coordinates: [lead.lon, lead.lat] },
        properties: { code: lead.code, codes: js.map(j => j.code).join(' · '), status: lead.status, vazlat: js.some(j => j.vazlat) ? 1 : 0,
          ring: Math.max(...js.map(j => (PREC[j.prec] || PREC['nincs']).m)), faded: time != null && !running ? 1 : 0,
          w: lead.status === 'meghiúsult' ? 0.4 : 1 } };
    }) };
  }
  function refresh() {
    if (!loaded) return;
    map.getSource('vrg-jobs').setData(features());
    map.getSource('vrg-jobs-heat').setData(features());
    drawCounts();
  }
  api.features = () => features();          // tests and the console: what the pins show right now

  // ---------------------------------------------------------------- layers
  function addLayers() {
    const beforeId = map.getLayer('places_subplace') ? 'places_subplace' : undefined;
    const statusColor = ['match', ['get', 'status'], ...Object.keys(STATUS).flatMap(k => [k, col(k)]), col('folyamatban')];
    map.addSource('vrg-jobs', { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, cluster: true, clusterRadius: 42, clusterMaxZoom: 11,
      clusterProperties: { run: ['+', ['case', ['==', ['get', 'status'], 'folyamatban'], 1, 0]] } });
    map.addSource('vrg-jobs-heat', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    // R8: density, the warm end of the status palette, giving way to the pins from zoom 13
    map.addLayer({ id: 'jobs-heat', type: 'heatmap', source: 'vrg-jobs-heat', layout: { visibility: 'none' },
      paint: { 'heatmap-weight': ['get', 'w'], 'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 6, 0.8, 13, 2.2],
        'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 6, 18, 10, 34, 14, 60],
        'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(212,87,15,0)', 0.2, 'rgba(242,201,76,.55)', 0.5, 'rgba(232,140,40,.75)', 0.8, 'rgba(212,87,15,.85)', 1, 'rgba(139,31,31,.9)'],
        'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0.9, 14, 0] } }, beforeId);
    const ringPx = ['interpolate', ['exponential', 2], ['zoom'], 0, ['/', ['get', 'ring'], MPP0], 22, ['/', ['*', ['get', 'ring'], 4194304], MPP0]];
    map.addLayer({ id: 'jobs-ring', type: 'circle', source: 'vrg-jobs', filter: ['all', ['!', ['has', 'point_count']], ['>', ['get', 'ring'], 0]],
      paint: { 'circle-radius': ringPx, 'circle-color': statusColor, 'circle-opacity': ['case', ['==', ['get', 'faded'], 1], 0.03, 0.09],
        'circle-stroke-color': statusColor, 'circle-stroke-width': 1.5, 'circle-stroke-opacity': ['case', ['==', ['get', 'faded'], 1], 0.25, 0.7],
        'circle-pitch-alignment': 'map' } }, beforeId);
    map.addLayer({ id: 'jobs-cluster', type: 'circle', source: 'vrg-jobs', filter: ['has', 'point_count'],
      paint: { 'circle-radius': ['step', ['get', 'point_count'], 15, 5, 19, 10, 24], 'circle-color': '#1f1d1a', 'circle-opacity': 0.9,
        'circle-stroke-color': ['case', ['>', ['get', 'run'], 0], col('folyamatban'), col('befejezett')], 'circle-stroke-width': 3.5 } });
    map.addLayer({ id: 'jobs-cluster-n', type: 'symbol', source: 'vrg-jobs', filter: ['has', 'point_count'],
      layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Medium'], 'text-size': 13, 'text-allow-overlap': true, 'text-ignore-placement': true },
      paint: { 'text-color': '#fffaf0' } });
    // R9: a finger-sized, invisible hit area under every pin
    map.addLayer({ id: 'jobs-hit', type: 'circle', source: 'vrg-jobs', filter: ['!', ['has', 'point_count']],
      paint: { 'circle-radius': 22, 'circle-color': '#000', 'circle-opacity': 0.01, 'circle-translate': [0, -22], 'circle-translate-anchor': 'viewport' } });
    map.addLayer({ id: 'jobs-pin', type: 'symbol', source: 'vrg-jobs', filter: ['!', ['has', 'point_count']],
      layout: { 'icon-image': ['concat', 'jpin-', ['get', 'status'], ['case', ['==', ['get', 'vazlat'], 1], '-d', '']], 'icon-anchor': 'bottom',
        'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-size': ['interpolate', ['linear'], ['zoom'], 7, 0.75, 15, 1],
        'text-field': ['get', 'codes'], 'text-font': ['Noto Sans Medium'], 'text-size': ['interpolate', ['linear'], ['zoom'], 8, 11, 16, 13],
        'text-anchor': 'left', 'text-offset': [1.1, -1.55], 'text-optional': true, 'text-letter-spacing': 0.04 },
      paint: { 'icon-opacity': ['case', ['==', ['get', 'faded'], 1], 0.35, 1], 'text-opacity': ['case', ['==', ['get', 'faded'], 1], 0.45, 1],
        'text-color': '#1f1d1a', 'text-halo-color': '#fffaf0', 'text-halo-width': 2 } });
    for (const id of ['jobs-hit', 'jobs-cluster']) {
      map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', id, () => { map.getCanvas().style.cursor = ''; });
    }
    map.on('click', 'jobs-hit', e => { const f = e.features[0]; if (f) openCard(f.properties.code); });
    map.on('click', 'jobs-cluster', async e => {
      const f = e.features[0];
      const z = await map.getSource('vrg-jobs').getClusterExpansionZoom(f.properties.cluster_id);
      map.easeTo({ center: f.geometry.coordinates, zoom: z + 0.4, duration: reduced.matches ? 0 : 700 });
    });
  }

  // ---------------------------------------------------------------- R6: the card
  function bar(j) {
    if (j.fromN == null || span.b <= span.a) return '';
    const L = (j.fromN - span.a) / (span.b - span.a) * 100, W = Math.max(1.2, ((j.toN || j.fromN) - j.fromN) / (span.b - span.a) * 100);
    return `<div class="jbar" title="${esc(hd(j.from))} – ${esc(hd(j.to))} a teljes idősávon (${esc(hd(dayS(span.a)))} – ${esc(hd(dayS(span.b)))})"><i style="left:${L.toFixed(1)}%;width:${Math.min(W, 100 - L).toFixed(1)}%;background:${col(j.status)}"></i></div>`;
  }
  function card(j) {
    const s = STATUS[j.status] || STATUS['folyamatban'], p = PREC[j.prec] || PREC['nincs'];
    const rel = (j.related || []).map(c => `<button type="button" class="jl" data-job="${esc(c)}">${esc(c)}</button>`).join(' ');
    return `<section class="jcard" data-code="${esc(j.code)}">
      <div class="jh"><b>${esc(j.code)}</b><span class="chip" style="--c:${col(j.status)}">${esc(s.hu)}</span>${j.vazlat ? '<span class="chip draft" title="A cím vázlat: az Alapító még nem erősítette meg">vázlat</span>' : ''}${j.kind === 'kit' ? '<span class="chip kit" title="Workflow Kit munka">kit</span>' : ''}</div>
      <div class="jt">${esc(j.label)}</div>
      ${bar(j)}
      <dl>
        <dt>Idősáv</dt><dd>${j.from ? esc(hd(j.from)) + (j.to && j.to !== j.from ? ' – ' + esc(hd(j.to)) : '') : '—'}</dd>
        ${j.total ? `<dt>Összeg</dt><dd>${esc(ft(j.total))} <span class="m">(utolsó kinyert, ${esc(hd(j.totalDate))})</span></dd>` : ''}
        ${j.area ? `<dt>Terület</dt><dd>${esc(j.area)}</dd>` : ''}
        <dt>Pontosság</dt><dd>${esc(p.hu)}${j.bizonytalan ? ' · <span class="warn">bizonytalan</span>' : ''}${j.otherCity ? ' · <span class="m">az OSM szerint ' + esc(j.otherCity) + '</span>' : ''}</dd>
        <dt>Forrás</dt><dd>${esc(SOURCE[j.source] || j.source || '—')}</dd>
        ${rel ? `<dt>Kapcsolódó</dt><dd>${rel}</dd>` : ''}
      </dl>
      ${window.vrgWeather && window.vrgWeather.jobCard ? window.vrgWeather.jobCard(j.code) : ''}
      <div class="jact"><button type="button" class="jb" data-near="${esc(j.code)}" title="Közelebb, döntve, körbefordulva">Közelebb</button><button type="button" class="jb" data-link="${esc(j.code)}" title="A ?job= link másolása (belső)">Link</button></div>
    </section>`;
  }
  function wire(el) {
    el.querySelectorAll('[data-job]').forEach(b => { b.onclick = () => fly(b.dataset.job); });
    el.querySelectorAll('[data-near]').forEach(b => { b.onclick = () => fly(b.dataset.near, { close: true }); });
    el.querySelectorAll('[data-link]').forEach(b => { b.onclick = async () => {
      const u = location.origin + location.pathname + '?job=' + encodeURIComponent(b.dataset.link);
      try { await navigator.clipboard.writeText(u); toast('Link másolva (belső): ?job=' + b.dataset.link); } catch { toast(u); }
    }; });
  }
  function openCard(code) {
    const j = api.find(code);
    if (!j || !placed(j)) return;
    const same = api.list.filter(x => placed(x) && x.lon.toFixed(5) === j.lon.toFixed(5) && x.lat.toFixed(5) === j.lat.toFixed(5) && visible(x));
    same.sort((a, b) => (a.code === j.code ? -1 : b.code === j.code ? 1 : 0));
    const html = (same.length ? same : [j]).map(card).join('');
    closeCard();
    open = j.code;
    cursor = order().findIndex(x => x.code === j.code);
    if (narrow.matches) {                        // R10: a bottom sheet on a phone, not a popup
      sheet.innerHTML = `<button type="button" class="jclose" aria-label="Bezárás">✕</button>${html}`;
      sheet.hidden = false;
      sheet.querySelector('.jclose').onclick = closeCard;
      wire(sheet);
      return;
    }
    api.popup = new maplibregl.Popup({ offset: [0, -34], maxWidth: 'min(330px, 92vw)', className: 'jpop', focusAfterOpen: false })
      .setLngLat([j.lon, j.lat]).setHTML(html).addTo(map);
    api.popup.on('close', () => { if (open === j.code) open = null; });
    wire(api.popup.getElement());
  }
  function closeCard() { if (api.popup) { api.popup.remove(); api.popup = null; } sheet.hidden = true; sheet.innerHTML = ''; open = null; }

  // ---------------------------------------------------------------- R7: the fly-in
  let orbiting = false;
  const stopOrbit = () => { if (orbiting) { orbiting = false; map.stop(); } };
  for (const ev of ['mousedown', 'touchstart', 'wheel']) map.getCanvasContainer().addEventListener(ev, stopOrbit, { passive: true });
  async function fly(code, opt) {
    if (!on) await toggle(true);
    const j = api.find(code);
    if (!j) { toast('Nincs ilyen munka a térképen: ' + code); return false; }
    if (!placed(j)) { toast(j.code + ': még nincs helye (helyszinek.json, majd build-jobs)'); return false; }
    if (!visible(j)) { F.status.add(j.status); F.years.clear(); F.area = ''; time = null; drawLegend(); refresh(); }
    const p = PREC[j.prec] || PREC['cím'];
    const zoom = opt && opt.close ? Math.max(p.zoom, 17.4) : p.zoom;
    // on a phone the card is a bottom sheet: land the site in the free upper part of the screen
    const cam = { center: [j.lon, j.lat], zoom, pitch: zoom >= 15 ? 62 : 45, bearing: -20,
      padding: narrow.matches ? { top: 90, bottom: Math.round(innerHeight * 0.42), left: 0, right: 0 } : { top: 0, bottom: 0, left: 0, right: 0 } };
    closeCard();
    if (reduced.matches) { map.jumpTo(cam); openCard(j.code); return true; }
    map.flyTo(Object.assign({ speed: 1.2, curve: 1.6, essential: true }, cam));
    map.once('moveend', () => {
      openCard(j.code);
      if (zoom < 15) return;
      orbiting = true;                           // a slow quarter turn around the site; any touch stops it
      map.easeTo({ bearing: cam.bearing + 70, duration: 9000, easing: t => t, essential: true });
      map.once('moveend', () => { orbiting = false; });
    });
    return true;
  }

  // ---------------------------------------------------------------- R5: search by code
  function searchCodes(text) {
    if (!loaded) return [];
    const q = String(text || '').trim().toUpperCase().replace(/\s+/g, '');
    if (!/^[A-Z]{1,3}\d{0,3}$/.test(q)) return [];
    return api.list.filter(j => j.code.startsWith(q)).slice(0, 6).map(j => ({ kind: 'munka', title: j.code + ' · ' + (STATUS[j.status] || {}).hu,
      sub: [j.area, j.from ? j.from.slice(0, 7).replace('-', '.') : ''].filter(Boolean).join(' · ') + (placed(j) ? '' : ' · nincs helye'), job: j.code }));
  }

  // ---------------------------------------------------------------- R9: step through the jobs
  const order = () => api.list.filter(j => placed(j) && visible(j)).sort((a, b) => (a.fromN || 0) - (b.fromN || 0) || a.code.localeCompare(b.code));
  function step(d) {
    const o = order(); if (!o.length) return;
    cursor = cursor < 0 ? (d > 0 ? 0 : o.length - 1) : (cursor + d + o.length) % o.length;
    fly(o[cursor].code);
  }

  // ---------------------------------------------------------------- R2-R4, R8: the legend is the control
  function drawLegend() {
    const years = [...new Set(api.list.map(j => j.year).filter(Boolean))].sort();
    const areas = [...new Set(api.list.map(j => j.area).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'hu', { numeric: true }));
    legend.innerHTML = `
      <div class="lg-h"><b>Munkák</b><span class="m" data-role="count"></span><button type="button" class="lg-x" data-role="collapse" aria-expanded="true" title="Összecsuk / kinyit">▾</button></div>
      <div class="lg-b">
        <div class="lg-row" role="group" aria-label="Állapot">${Object.keys(STATUS).map(k => `<button type="button" class="lg-chip" data-status="${k}" aria-pressed="${F.status.has(k)}"><i class="dot" style="background:${col(k)}"></i>${STATUS[k].hu} <span data-n="${k}"></span></button>`).join('')}</div>
        <div class="lg-row" role="group" aria-label="Év">${years.map(y => `<button type="button" class="lg-chip yr" data-year="${y}" aria-pressed="${F.years.has(y)}">${y}</button>`).join('')}
          <select data-role="area" aria-label="Terület"><option value="">minden terület</option>${areas.map(a => `<option${a === F.area ? ' selected' : ''}>${esc(a)}</option>`).join('')}</select></div>
        <div class="lg-row">
          <button type="button" class="lg-chip tool" data-role="heat" aria-pressed="${heatOn}" title="Sűrűség (D)">Sűrűség<kbd>D</kbd></button>
          <button type="button" class="lg-chip tool" data-role="time" aria-pressed="${time != null}" title="Idővonal (I)">Idővonal<kbd>I</kbd></button>
          <span class="lg-key"><i class="pin-d"></i>vázlat</span><span class="lg-key"><i class="ring"></i>pontatlan hely</span>
        </div>
        <div class="lg-time" ${time == null ? 'hidden' : ''}>
          <button type="button" class="lg-chip tool" data-role="play" aria-label="Lejátszás">${playing ? '❚❚' : '▶'}</button>
          <input type="range" data-role="slider" min="${span.a}" max="${span.b}" step="1" value="${time == null ? span.b : time}" aria-label="Dátum">
          <output data-role="date">${esc(hd(dayS(time == null ? span.b : time)))}</output>
        </div>
      </div>`;
    legend.querySelectorAll('[data-status]').forEach(b => { b.onclick = () => { const k = b.dataset.status; F.status.has(k) ? F.status.delete(k) : F.status.add(k); b.setAttribute('aria-pressed', F.status.has(k)); refresh(); }; });
    legend.querySelectorAll('[data-year]').forEach(b => { b.onclick = () => { const y = b.dataset.year; F.years.has(y) ? F.years.delete(y) : F.years.add(y); b.setAttribute('aria-pressed', F.years.has(y)); refresh(); }; });
    legend.querySelector('[data-role="area"]').onchange = e => { F.area = e.target.value; refresh(); };
    legend.querySelector('[data-role="heat"]').onclick = () => setHeat();
    legend.querySelector('[data-role="time"]').onclick = () => setTime(time == null ? span.a : null);
    legend.querySelector('[data-role="play"]').onclick = () => play();
    legend.querySelector('[data-role="slider"]').oninput = e => { stopPlay(); setTime(Number(e.target.value)); };
    const col_ = legend.querySelector('[data-role="collapse"]');
    col_.onclick = () => { const c = legend.classList.toggle('collapsed'); col_.setAttribute('aria-expanded', !c); col_.textContent = c ? '▴' : '▾'; store.set('jobsLegend', c ? 'closed' : 'open'); };
    if (store.get('jobsLegend', narrow.matches ? 'closed' : 'open') === 'closed') { legend.classList.add('collapsed'); col_.setAttribute('aria-expanded', 'false'); col_.textContent = '▴'; }
    drawCounts();
  }
  function drawCounts() {
    const shown = api.list.filter(visible), none = shown.filter(j => !placed(j)).length;
    for (const k of Object.keys(STATUS)) { const el = legend.querySelector(`[data-n="${k}"]`); if (el) el.textContent = api.list.filter(j => j.status === k).length; }
    const c = legend.querySelector('[data-role="count"]');
    if (c) c.textContent = shown.length + ' / ' + api.list.length + (none ? ` · ${none} munkának nincs helye` : '');
  }
  function setHeat(v) {
    heatOn = v === undefined ? !heatOn : !!v;
    if (loaded) map.setLayoutProperty('jobs-heat', 'visibility', on && heatOn ? 'visible' : 'none');
    const b = legend.querySelector('[data-role="heat"]'); if (b) b.setAttribute('aria-pressed', heatOn);
  }
  function setTime(t) {
    time = t == null ? null : Math.max(span.a, Math.min(span.b, t));
    const row = legend.querySelector('.lg-time');
    if (row) {
      row.hidden = time == null;
      const s = row.querySelector('[data-role="slider"]'); if (time != null) s.value = time;
      row.querySelector('[data-role="date"]').textContent = hd(dayS(time == null ? span.b : time));
    }
    const b = legend.querySelector('[data-role="time"]'); if (b) b.setAttribute('aria-pressed', time != null);
    if (time == null) stopPlay();
    refresh();
  }
  function play() {
    if (playing) { stopPlay(); return; }
    if (time == null || time >= span.b) setTime(span.a);
    const stepDays = Math.max(1, Math.round((span.b - span.a) / 240));        // ~12 s for the whole span
    playing = setInterval(() => { if (time >= span.b) { stopPlay(); return; } setTime(time + stepDays); }, 50);
    legend.querySelector('[data-role="play"]').textContent = '❚❚';
  }
  function stopPlay() { if (playing) { clearInterval(playing); playing = 0; } const p = legend.querySelector('[data-role="play"]'); if (p) p.textContent = '▶'; }

  // ---------------------------------------------------------------- on / off
  function show(v) { for (const id of LAYERS) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', v && (id !== 'jobs-heat' || heatOn) ? 'visible' : 'none'); }
  async function toggle(v) {
    on = v === undefined ? !on : !!v;
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    document.body.classList.toggle('jobs-on', on);
    badge.hidden = !on; legend.hidden = !on;
    if (on && !loaded) {
      // 'load' may have fired already while isStyleLoaded() is briefly false (terrain, 3D toggles): poll instead,
      // and share one load between overlapping calls
      try {
        loading = loading || (async () => {
          for (let i = 0; i < 300 && !styleReady && !map.isStyleLoaded(); i++) await new Promise(r => setTimeout(r, 100));
          await load();
        })();
        await loading;
      }
      catch (e) { loading = null; on = false; btn.setAttribute('aria-pressed', 'false'); document.body.classList.remove('jobs-on'); badge.hidden = legend.hidden = true; toast('A munkák rétege nem töltődött be: ' + e.message); return; }
    }
    show(on);
    if (!on) { closeCard(); stopPlay(); }
    store.set('jobs', on);
    dispatchEvent(new CustomEvent('vrg:jobs', { detail: { on } }));   // the W layer's job weather follows
  }
  btn.onclick = () => toggle();
  addEventListener('keydown', e => {
    if (!on || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) || e.ctrlKey || e.altKey || e.metaKey) return;
    const k = e.key.toLowerCase();
    if (k === 'd') setHeat();
    else if (k === 'i') setTime(time == null ? span.a : null);
    else if (k === '.') step(1);
    else if (k === ',') step(-1);
    else if (k === 'escape' && open) closeCard();
  });

  const want = params.get('job');
  if (want) await fly(want);
  else if (store.get('jobs', false)) await toggle(true);
  return api;
}
