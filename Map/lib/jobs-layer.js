// jobs-layer.js — the VRG Térkép "J" layer: where the jobs are (client data, internal only).
//
// Data: GET /jobs/helyek.json from serve.js (outside Git: jobs\_elozmenyek\helyek.json, built by
// Map/tools/build-jobs.js). The page asks /jobs/status first; when the layer is switched off (registry
// jobsLayer:false, the TERKEP-KI flag file, OTG) the J button stays greyed with the reason and no
// client data is fetched. Never in Kapu guest mode (?vendeg=1 / ?guest=1); in ?embed=1 only with ?jobs=1.
// While the layer is on, a visible "ÜGYFÉLADAT" badge says so. docs/map/JOBS-MAP.md has the rules.
//
//   initJobs({ map, maplibregl, params, store, toast }) -> api { ready, list, find, fly(code), toggle(on) }
'use strict';

export const STATUS = {
  'folyamatban': { hu: 'folyamatban', color: '#c26a12', dark: '#f0a04b' },
  'befejezett': { hu: 'befejezett', color: '#2f7d4a', dark: '#5cc185' },
  'meghiúsult': { hu: 'meghiúsult', color: '#8b3a3a', dark: '#e07a7a' },
};
// How far the point may be from the real place, in metres (the ring's radius).
export const PREC = {
  'cím': { m: 0, hu: 'pontos cím', zoom: 18.2 },
  'legközelebbi': { m: 40, hu: 'a legközelebbi házszám', zoom: 17.6 },
  'utca': { m: 250, hu: 'csak az utca', zoom: 16.3 },
  'település': { m: 1500, hu: 'csak a település', zoom: 12.8 },
  'nincs': { m: 0, hu: 'nincs helye', zoom: 0 },
};
const SOURCE = { helyszinek: 'helyszinek.json', 'kit:decisions': 'Workflow Kit (döntések)', 'kit:answers_r1': 'Workflow Kit (1. kör)', 'kézi': 'kézi pont' };
const MPP0 = 40075016.686 * Math.cos(47.3 * Math.PI / 180) / 512;     // metres per pixel at zoom 0, Hungary
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ft = n => Math.round(n).toLocaleString('hu-HU').replace(/\s/g, ' ') + ' Ft';
const hd = d => d ? d.replaceAll('-', '.') + '.' : '';

export function jobsAllowed(params) {
  if (params.get('vendeg') === '1' || params.get('guest') === '1') return false;     // Kapu guest mode: never
  if (params.get('embed') === '1' && params.get('jobs') !== '1') return false;       // embedded: only when asked
  return true;
}

export async function initJobs({ map, maplibregl, params, store, toast }) {
  const $ = s => document.querySelector(s);
  const btn = $('#b-jobs'), badge = $('#jobs-badge'), legend = $('#jobs-legend');
  const api = { ready: false, list: [], find: c => api.list.find(j => j.code === String(c).toUpperCase()), fly, toggle, popup: null };
  window.vrgJobs = api;
  if (!jobsAllowed(params)) { btn.remove(); return api; }
  let st = { on: false, reason: 'A szerver nem válaszol.' };
  try { st = await (await fetch('/jobs/status', { cache: 'no-store' })).json(); } catch { /* the reason above */ }
  if (!st.on) {
    btn.disabled = true; btn.title = 'Munkák rétege: ' + st.reason;
    if (params.get('job')) toast('A munkák rétege ki van kapcsolva: ' + st.reason);
    return api;
  }
  let on = false, loaded = false;
  const dark = () => matchMedia('(prefers-color-scheme: dark)').matches;
  const col = k => (STATUS[k] || STATUS['folyamatban'])[dark() ? 'dark' : 'color'];
  const colorExpr = () => ['match', ['get', 'status'], ...Object.keys(STATUS).flatMap(k => [k, col(k)]), col('folyamatban')];

  async function load() {
    const r = await fetch('/jobs/helyek.json', { cache: 'no-store' });
    if (!r.ok) throw new Error(r.status === 403 ? 'kikapcsolva' : 'HTTP ' + r.status);
    const doc = await r.json();
    api.list = doc.jobs || [];
    api.built = doc.built;
    const features = api.list.filter(j => typeof j.lon === 'number' && typeof j.lat === 'number').map(j => ({
      type: 'Feature', geometry: { type: 'Point', coordinates: [j.lon, j.lat] },
      properties: { code: j.code, status: j.status, prec: j.prec, ring: (PREC[j.prec] || PREC['nincs']).m, vazlat: j.vazlat ? 1 : 0, year: (j.to || j.from || '').slice(0, 4) },
    }));
    addLayers({ type: 'FeatureCollection', features });
    loaded = true; api.ready = true;
    drawLegend();
  }

  function addLayers(fc) {
    const beforeId = map.getLayer('places_subplace') ? 'places_subplace' : undefined;
    map.addSource('vrg-jobs', { type: 'geojson', data: fc, cluster: true, clusterRadius: 38, clusterMaxZoom: 11 });
    const ringPx = ['interpolate', ['exponential', 2], ['zoom'], 0, ['/', ['get', 'ring'], MPP0], 22, ['/', ['*', ['get', 'ring'], 4194304], MPP0]];
    map.addLayer({ id: 'jobs-ring', type: 'circle', source: 'vrg-jobs', filter: ['all', ['!', ['has', 'point_count']], ['>', ['get', 'ring'], 0]],
      paint: { 'circle-radius': ringPx, 'circle-color': colorExpr(), 'circle-opacity': 0.1, 'circle-stroke-color': colorExpr(), 'circle-stroke-width': 1.5,
        'circle-stroke-opacity': 0.65, 'circle-pitch-alignment': 'map' } }, beforeId);
    map.addLayer({ id: 'jobs-cluster', type: 'circle', source: 'vrg-jobs', filter: ['has', 'point_count'],
      paint: { 'circle-radius': ['step', ['get', 'point_count'], 15, 5, 19, 10, 24], 'circle-color': '#1f1d1a', 'circle-opacity': 0.88,
        'circle-stroke-color': '#c26a12', 'circle-stroke-width': 3 } });
    map.addLayer({ id: 'jobs-cluster-n', type: 'symbol', source: 'vrg-jobs', filter: ['has', 'point_count'],
      layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Medium'], 'text-size': 13, 'text-allow-overlap': true },
      paint: { 'text-color': '#ffffff' } });
    map.addLayer({ id: 'jobs-pin', type: 'circle', source: 'vrg-jobs', filter: ['!', ['has', 'point_count']],
      paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 6, 16, 9], 'circle-color': colorExpr(),
        'circle-stroke-color': ['case', ['==', ['get', 'vazlat'], 1], '#f2c94c', '#ffffff'], 'circle-stroke-width': 2.5 } });
    map.addLayer({ id: 'jobs-label', type: 'symbol', source: 'vrg-jobs', filter: ['!', ['has', 'point_count']],
      layout: { 'text-field': ['get', 'code'], 'text-font': ['Noto Sans Medium'], 'text-size': 12, 'text-offset': [0, 1.25], 'text-anchor': 'top',
        'text-allow-overlap': false, 'text-optional': true },
      paint: { 'text-color': '#1f1d1a', 'text-halo-color': '#fbf9f4', 'text-halo-width': 1.8 } });
    for (const id of ['jobs-pin', 'jobs-cluster']) {
      map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', id, () => { map.getCanvas().style.cursor = ''; });
    }
    map.on('click', 'jobs-pin', e => { const f = e.features[0]; if (f) openCard(f.properties.code); });
    map.on('click', 'jobs-cluster', async e => {
      const f = e.features[0];
      const z = await map.getSource('vrg-jobs').getClusterExpansionZoom(f.properties.cluster_id);
      map.easeTo({ center: f.geometry.coordinates, zoom: z + 0.3 });
    });
  }

  function card(j) {
    const s = STATUS[j.status] || STATUS['folyamatban'], p = PREC[j.prec] || PREC['nincs'];
    const rel = (j.related || []).map(c => `<button type="button" class="jl" data-job="${esc(c)}">${esc(c)}</button>`).join(' ');
    return `<div class="jcard">
      <div class="jh"><b>${esc(j.code)}</b><span class="chip" style="--c:${col(j.status)}">${esc(s.hu)}</span>${j.vazlat ? '<span class="chip draft" title="A cím vázlat: az Alapító még nem erősítette meg">vázlat</span>' : ''}</div>
      <div class="jt">${esc(j.label)}</div>
      <dl>
        <dt>Idősáv</dt><dd>${j.from ? esc(hd(j.from)) + (j.to && j.to !== j.from ? ' – ' + esc(hd(j.to)) : '') : '—'}</dd>
        ${j.total ? `<dt>Összeg</dt><dd>${esc(ft(j.total))} <span class="m">(utolsó kinyert, ${esc(hd(j.totalDate))})</span></dd>` : ''}
        <dt>Pontosság</dt><dd>${esc(p.hu)}${j.bizonytalan ? ' · <span class="warn">bizonytalan</span>' : ''}${j.otherCity ? ' · <span class="m">az OSM szerint ' + esc(j.otherCity) + '</span>' : ''}</dd>
        <dt>Forrás</dt><dd>${esc(SOURCE[j.source] || j.source || '—')}</dd>
        ${rel ? `<dt>Kapcsolódó</dt><dd>${rel}</dd>` : ''}
      </dl></div>`;
  }
  function openCard(code) {
    const j = api.find(code);
    if (!j || typeof j.lon !== 'number') return;
    if (api.popup) api.popup.remove();
    api.popup = new maplibregl.Popup({ offset: 14, maxWidth: '320px', className: 'jpop', focusAfterOpen: false })
      .setLngLat([j.lon, j.lat]).setHTML(card(j)).addTo(map);
    api.popup.getElement().querySelectorAll('[data-job]').forEach(b => { b.onclick = () => fly(b.dataset.job); });
  }
  async function fly(code) {
    if (!on) await toggle(true);
    const j = api.find(code);
    if (!j) { toast('Nincs ilyen munka a térképen: ' + code); return false; }
    if (typeof j.lon !== 'number') { toast(j.code + ': még nincs helye (helyszinek.json, majd build-jobs)'); return false; }
    const p = PREC[j.prec] || PREC['cím'];
    map.flyTo({ center: [j.lon, j.lat], zoom: p.zoom, pitch: p.zoom >= 16 ? 62 : 45, bearing: -20, speed: 1.3, curve: 1.5, essential: true });
    map.once('moveend', () => openCard(j.code));
    return true;
  }

  function drawLegend() {
    const n = k => api.list.filter(j => j.status === k).length;
    const none = api.list.filter(j => typeof j.lon !== 'number').length;
    legend.innerHTML = Object.keys(STATUS).map(k => `<span><i style="background:${col(k)}"></i>${STATUS[k].hu} ${n(k)}</span>`).join('') +
      `<span><i class="draft"></i>vázlat</span><span><i class="ring"></i>pontatlan hely</span>` + (none ? `<span class="m">${none} munkának nincs helye</span>` : '');
  }
  function show(v) {
    for (const id of ['jobs-ring', 'jobs-cluster', 'jobs-cluster-n', 'jobs-pin', 'jobs-label']) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', v ? 'visible' : 'none');
  }
  async function toggle(v) {
    on = v === undefined ? !on : !!v;
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    document.body.classList.toggle('jobs-on', on);
    badge.hidden = !on; legend.hidden = !on;
    if (on && !loaded) {
      try { if (!map.isStyleLoaded()) await new Promise(r => map.once('load', r)); await load(); }
      catch (e) { on = false; btn.setAttribute('aria-pressed', 'false'); document.body.classList.remove('jobs-on'); badge.hidden = legend.hidden = true; toast('A munkák rétege nem töltődött be: ' + e.message); return; }
    }
    show(on);
    if (!on && api.popup) api.popup.remove();
    store.set('jobs', on);
  }
  btn.onclick = () => toggle();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (!loaded) return;
    for (const id of ['jobs-ring', 'jobs-pin']) map.setPaintProperty(id, 'circle-color', colorExpr());
    map.setPaintProperty('jobs-ring', 'circle-stroke-color', colorExpr());
    drawLegend();
  });

  const want = params.get('job');
  if (want) await fly(want);
  else if (store.get('jobs', false)) await toggle(true);
  return api;
}
