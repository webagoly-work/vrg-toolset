// VRG Térkép on the phone (VRG Mobile WP M43): added by the app to the PC's own Map/vrg-terkep.html, which it serves on
// https://map.appassets.androidplatform.net/. Three things the PC page does not have:
//   - the phone's position (MapLibre's GeolocateControl; the position stays in this page, nothing is sent anywhere),
//   - the Vázlat sites (the Sketcher's Helyszín points, from the phone's own files via /__phone/sites.json),
//   - Navigáció on a job card and a site: hands only the coordinates and the code / name to the phone's navigation app (D-49 C),
//   - with ?site=<id> (F1): the Sketcher's Helyszín on the site layer, the answer back through vrg-map:site.
// No network request here leaves the phone's origin (the site layer's 🛰 satellite tiles do, on its tap only).
(() => {
  'use strict';
  document.documentElement.classList.add('vrg-phone');
  const css = document.createElement('style');
  css.textContent = `
    .vrg-phone kbd { display: none !important; }
    .vrg-phone .jact .jb[data-nav] { background: #1f1d1a; color: #fff; }
    .vsite { font: 13px/1.35 system-ui, sans-serif; color: #1f1d1a; min-width: 180px; }
    .vsite b { display: block; font-size: 14px; }
    .vsite .a { color: #4d4943; margin: 2px 0 8px; }
    .vsite .row { display: flex; gap: 6px; }
    .vsite button { flex: 1; min-height: 40px; border: 1px solid #1f1d1a; border-radius: 8px; background: #fff; font: inherit; }
    .vsite button.go { background: #1f1d1a; color: #fff; }
  `;
  document.head.appendChild(css);

  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const nav = (lat, lon, label) => {
    location.href = 'vrg-map:nav?lat=' + encodeURIComponent(lat) + '&lon=' + encodeURIComponent(lon) + '&label=' + encodeURIComponent(label || '');
  };

  let tries = 0;
  const wait = setInterval(() => {
    const v = window.vrgMap;
    if (v && v.map && v.maplibregl) { clearInterval(wait); start(v.map, v.maplibregl); }
    else if (++tries > 400) clearInterval(wait);            // 60 s: the page did not start (no data); nothing to add
  }, 150);

  function start(map, ml) {
    map.addControl(new ml.GeolocateControl({
      positionOptions: { enableHighAccuracy: true, timeout: 15000 },
      trackUserLocation: true, showAccuracyCircle: true, fitBoundsOptions: { maxZoom: 17 },
    }), 'top-right');
    const ready = map.loaded() ? Promise.resolve() : new Promise(r => map.once('load', r));
    ready.then(() => sites(map, ml));
    const siteId = new URLSearchParams(location.search).get('site');
    if (siteId) ready.then(() => site(siteId));
    // Navigáció on the job card: the bottom sheet on a narrow screen, the popup on a wide one
    const add = root => root.querySelectorAll('.jcard').forEach(card => {
      const act = card.querySelector('.jact');
      if (!act || act.querySelector('[data-nav]')) return;
      const j = window.vrgJobs && window.vrgJobs.find(card.dataset.code);
      if (!j || typeof j.lat !== 'number' || typeof j.lon !== 'number') return;
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'jb'; b.dataset.nav = j.code; b.textContent = 'Navigáció';
      b.title = 'A navigációs alkalmazás a koordinátát és a munka kódját kapja meg, a címet nem';
      b.onclick = () => nav(j.lat, j.lon, j.code);
      act.prepend(b);
    });
    const sheet = document.getElementById('jobs-sheet');
    if (sheet) new MutationObserver(() => add(sheet)).observe(sheet, { childList: true });
    new MutationObserver(() => add(map.getContainer())).observe(map.getContainer(), { childList: true, subtree: true });
  }

  // F1: the Sketcher's Helyszín on this map: the survey from the phone's file, the site layer (Map/lib/site-layer.js) to draw the
  // outline and place the sketch; ✓ Kész / ✕ hand the answer to the app (vrg-map:site), which gives it to the Sketcher.
  async function site(id) {
    const back = r => { location.href = 'vrg-map:site?d=' + encodeURIComponent(JSON.stringify(r)); };
    let data = null;
    try { const r = await fetch('/__phone/site.json?id=' + encodeURIComponent(id), { cache: 'no-store' }); if (r.ok) data = await r.json(); } catch { /* below */ }
    let tries = 0;
    const t = setInterval(() => {
      if (window.vrgSite && data) { clearInterval(t); window.vrgSite.open(data, { done: back, cancel: () => back({ kind: 'vrg-site-result', v: 1, id, cancelled: true }), canCenter: true }); }
      else if (!data || ++tries > 100) { clearInterval(t); back({ kind: 'vrg-site-result', v: 1, id, cancelled: true, problem: data ? 'nincs site-layer' : 'nincs vázlat' }); }
    }, 150);
  }

  async function sites(map, ml) {
    let list = [];
    try { list = ((await (await fetch('/__phone/sites.json', { cache: 'no-store' })).json()).sites) || []; } catch { return; }
    if (!list.length) return;
    map.addSource('vrg-sites', { type: 'geojson', data: { type: 'FeatureCollection', features: list.map(s => ({
      type: 'Feature', geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
      properties: { id: s.id, name: s.name || 'Vázlat', address: s.address || '' } })) } });
    map.addLayer({ id: 'vrg-sites', type: 'circle', source: 'vrg-sites', paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 5, 16, 9], 'circle-color': '#7a4fc9',
      'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2.5 } });
    map.on('click', 'vrg-sites', e => {
      const f = e.features[0]; if (!f) return;
      const p = f.properties, [lon, lat] = f.geometry.coordinates;
      const el = document.createElement('div');
      el.className = 'vsite';
      el.innerHTML = `<b>${esc(p.name)}</b><div class="a">${esc(p.address) || 'Vázlat helyszíne'}</div>` +
        '<div class="row"><button type="button" class="go">Navigáció</button><button type="button" class="open">Vázlat</button></div>';
      el.querySelector('.go').onclick = () => nav(lat, lon, p.name);
      el.querySelector('.open').onclick = () => { location.href = 'vrg-map:sketch?id=' + encodeURIComponent(p.id); };
      new ml.Popup({ offset: 12, maxWidth: 'min(300px, 90vw)' }).setLngLat([lon, lat]).setDOMContent(el).addTo(map);
    });
  }
})();
