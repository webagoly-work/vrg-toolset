// Map/lib/site-layer.js — VRG Sketcher Helyszín on VRG Térkép (fork F1, WP M48): the building's outline drawn or corrected on the
// map (optionally over satellite imagery), and the solved sketch placed on it (moved, turned, fitted), with the mismatch
// in the field's words. The maths is Map/lib/site-math.js (the phone's SitePlace.kt replays the same fixture).
//
// Nothing here starts by itself. A host opens it with a survey:
//   - the phone (VRG Mobile, map-phone.js): window.vrgSite.open(data, { done, cancel }) with /__phone/site.json;
//   - the Desktop Sketcher, which embeds this page: postMessage({ kind: 'vrg-site', v: 1, ... }) to the frame; the
//     answer goes back to that window only, as { kind: 'vrg-site-result', v: 1, id, outline, outlineSrc, place, center }.
// The satellite layer (Esri World Imagery) is requested only after a tap on 🛰 and never stored (decision in the WP).
// Loaded as a plain script, so a phone whose app predates it (and does not serve it) still opens the map.
(() => {
  'use strict';
  const SAT = {
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
    attribution: 'Műhold: Esri, Maxar, Earthstar Geographics, GIS User Community',
  };
  const VIOLET = '#8a5cd6', TEAL = '#27c2b0', RED = '#d64545';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f1 = v => (Math.round(v * 10) / 10).toFixed(1).replace('.', ',');

  const css = document.createElement('style');
  css.textContent = `
    #site-panel { position: absolute; left: 8px; right: 8px; bottom: 8px; z-index: 20; max-width: 520px; margin: 0 auto;
      background: #fffdf8; color: #1f1d1a; border: 2px solid ${VIOLET}; border-radius: 10px; padding: 8px 10px;
      font: 13px/1.35 system-ui, sans-serif; box-shadow: 0 4px 18px rgba(0,0,0,.25); max-height: 46vh; overflow: auto; }
    #site-panel .h { display: flex; align-items: center; gap: 6px; font-weight: 600; }
    #site-panel .h .t { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    #site-panel .row { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0; }
    #site-panel button { min-height: 38px; padding: 0 10px; border: 1px solid #1f1d1a; border-radius: 8px; background: #fff; font: inherit; color: inherit; }
    #site-panel button[aria-pressed="true"] { background: ${VIOLET}; border-color: ${VIOLET}; color: #fff; }
    #site-panel button.go { background: #1f1d1a; color: #fff; }
    #site-panel button:disabled { opacity: .45; }
    #site-panel .hint { color: #4d4943; font-size: 12px; }
    #site-panel .rep { margin-top: 4px; }
    #site-panel .rep div { margin: 1px 0; }
    #site-panel .rep .bad { color: ${RED}; }
    #site-panel .rep .ok { color: #2d8a4a; }
  `;
  document.head.appendChild(css);

  let map = null, ml = null, S = null, opts = null, mode = 'outline', sat = false, sel = -1, drag = null, hidden3d = [];

  const empty = () => ({ type: 'FeatureCollection', features: [] });
  const M = () => window.VrgSiteMath;
  const closed = r => r.length ? r.concat([r[0]]) : r;

  function ensureLayers() {
    if (map.getSource('vrg-site-outline')) return;
    for (const id of ['vrg-site-outline', 'vrg-site-handles', 'vrg-site-plan', 'vrg-site-bad']) map.addSource(id, { type: 'geojson', data: empty() });
    map.addLayer({ id: 'vrg-site-plan-fill', type: 'fill', source: 'vrg-site-plan', paint: { 'fill-color': TEAL, 'fill-opacity': 0.28 } });
    map.addLayer({ id: 'vrg-site-plan-line', type: 'line', source: 'vrg-site-plan', paint: { 'line-color': '#137d72', 'line-width': 2 } });
    map.addLayer({ id: 'vrg-site-outline-fill', type: 'fill', source: 'vrg-site-outline', filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': VIOLET, 'fill-opacity': 0.08 } });
    map.addLayer({ id: 'vrg-site-outline-line', type: 'line', source: 'vrg-site-outline', paint: { 'line-color': VIOLET, 'line-width': 3, 'line-dasharray': [2, 1] } });
    map.addLayer({ id: 'vrg-site-bad', type: 'line', source: 'vrg-site-bad', paint: { 'line-color': RED, 'line-width': 5 } });
    map.addLayer({ id: 'vrg-site-mid', type: 'circle', source: 'vrg-site-handles', filter: ['==', 'k', 'mid'],
      paint: { 'circle-radius': 7, 'circle-color': '#ffffff', 'circle-opacity': 0.85, 'circle-stroke-color': VIOLET, 'circle-stroke-width': 2 } });
    map.addLayer({ id: 'vrg-site-corner', type: 'circle', source: 'vrg-site-handles', filter: ['==', 'k', 'corner'],
      paint: { 'circle-radius': 11, 'circle-color': ['case', ['==', ['get', 'sel'], 1], RED, VIOLET], 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 3 } });
  }

  function setSat(on) {
    sat = on;
    if (on && !map.getSource('vrg-sat')) {
      map.addSource('vrg-sat', { type: 'raster', tiles: SAT.tiles, tileSize: 256, maxzoom: 19, attribution: SAT.attribution });
      const firstSym = (map.getStyle().layers || []).find(l => l.type === 'symbol');
      map.addLayer({ id: 'vrg-sat', type: 'raster', source: 'vrg-sat', paint: { 'raster-opacity': 1 } }, firstSym ? firstSym.id : 'vrg-site-plan-fill');
    }
    if (map.getLayer('vrg-sat')) map.setLayoutProperty('vrg-sat', 'visibility', on ? 'visible' : 'none');
  }

  // 3D buildings hide the ground being traced: off while the site layer is open, back as they were after
  function flat(on) {
    if (on) {
      hidden3d = (map.getStyle().layers || []).filter(l => l.type === 'fill-extrusion' && map.getLayoutProperty(l.id, 'visibility') !== 'none').map(l => l.id);
      hidden3d.forEach(id => map.setLayoutProperty(id, 'visibility', 'none'));
    } else { hidden3d.forEach(id => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'visible'); }); hidden3d = []; }
  }

  function placedRings() { return S.place && S.rooms.length ? M().placedLngLat(S.rooms, S.place) : []; }

  function draw() {
    const o = S.outline, ring = o.map(p => [p[1], p[0]]);
    map.getSource('vrg-site-outline').setData({ type: 'FeatureCollection', features: o.length >= 3
      ? [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [closed(ring)] }, properties: {} }]
      : o.length === 2 ? [{ type: 'Feature', geometry: { type: 'LineString', coordinates: ring }, properties: {} }] : [] });
    const h = [];
    if (mode === 'outline') {
      ring.forEach((c, i) => h.push({ type: 'Feature', geometry: { type: 'Point', coordinates: c }, properties: { k: 'corner', i, sel: i === sel ? 1 : 0 } }));
      if (ring.length >= 2) ring.forEach((c, i) => { if (ring.length < 3 && i === ring.length - 1) return; const d = ring[(i + 1) % ring.length];
        h.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [(c[0] + d[0]) / 2, (c[1] + d[1]) / 2] }, properties: { k: 'mid', i } }); });
    }
    map.getSource('vrg-site-handles').setData({ type: 'FeatureCollection', features: h });
    const rings = placedRings();
    map.getSource('vrg-site-plan').setData({ type: 'FeatureCollection', features: rings.map(r => ({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [closed(r.ring)] }, properties: { name: r.name } })) });
    const rep = S.place && o.length >= 3 ? M().report(S.rooms, o, S.place) : null;
    map.getSource('vrg-site-bad').setData({ type: 'FeatureCollection', features: (rep ? rep.walls : []).map(w => {
      const r = rings[w.room].ring; return { type: 'Feature', geometry: { type: 'LineString', coordinates: [r[w.edge], r[(w.edge + 1) % r.length]] }, properties: {} }; }) });
    panel(rep);
  }

  function panel(rep) {
    let el = document.getElementById('site-panel');
    if (!el) { el = document.createElement('div'); el.id = 'site-panel'; document.body.appendChild(el); el.addEventListener('click', onPanel); }
    const fp = S.outline.length >= 3 ? M().footprint(S.outline) : null;
    const pb = S.rooms.length ? M().obox([].concat(...S.rooms.map(r => r.poly))) : null;
    const hint = mode === 'outline'
      ? (S.outline.length < 3 ? 'Koppints az épület sarkaira sorban (legalább 3). ' : 'Húzd a sarkot a javításhoz; a fehér pont új sarkot ad; koppintott sarok törölhető. ') + (sat ? '' : 'A 🛰 műholdképen könnyebb.')
      : S.rooms.length ? 'Húzd a vázlatot a helyére, a ⟲ ⟳ gombokkal forgasd; ⤢ = automatikus illesztés a körvonalra.' : 'A vázlaton még nincs megoldott szoba (Rendezés).';
    // on a phone the panel must leave the map visible: the verdict, the numbers and the three worst walls
    const worst = rep ? Object.assign({}, rep, { walls: rep.walls.slice().sort((a, b) => b.out - a.out) }) : null;
    const all = worst ? M().reportLines(worst) : [];
    const lines = rep && rep.walls.length > 3 ? all.slice(0, 5).concat(['· … és még ' + (rep.walls.length - 3) + ' fal (pirossal)']) : all;
    el.innerHTML =
      `<div class="h"><span style="color:${VIOLET}">⌖</span><span class="t">Helyszín · ${esc(S.name || 'Vázlat')}</span>` +
        `<button type="button" data-a="cancel" title="Bezárás mentés nélkül">✕</button><button type="button" class="go" data-a="done">✓ Kész</button></div>` +
      `<div class="row"><button type="button" data-a="m-outline" aria-pressed="${mode === 'outline'}">▱ Körvonal</button>` +
        `<button type="button" data-a="m-place" aria-pressed="${mode === 'place'}" ${S.rooms.length ? '' : 'disabled'}>◫ Vázlat</button>` +
        `<button type="button" data-a="sat" aria-pressed="${sat}" title="Esri műholdkép, csak most, nem tárolódik">🛰 Műhold</button>` +
        (S.canCenter ? `<button type="button" data-a="center" title="A munka helye a térkép közepe lesz">⇣ Hely átvétele</button>` : '') + `</div>` +
      (mode === 'outline'
        ? `<div class="row"><button type="button" data-a="del" ${sel >= 0 ? '' : 'disabled'}>✕ Sarok</button><button type="button" data-a="undo" ${S.outline.length ? '' : 'disabled'}>↶ Utolsó</button>` +
          `<button type="button" data-a="clear" ${S.outline.length ? '' : 'disabled'}>Törlés</button></div>`
        : `<div class="row"><button type="button" data-a="r-15">⟲ 15°</button><button type="button" data-a="r-1">⟲ 1°</button><button type="button" data-a="r1">⟳ 1°</button>` +
          `<button type="button" data-a="r15">⟳ 15°</button><button type="button" data-a="fit" ${S.outline.length >= 3 && S.rooms.length ? '' : 'disabled'}>⤢ Illesztés</button></div>`) +
      `<div class="hint">${esc(hint)}</div>` +
      `<div class="rep">` + (fp ? `<div>Épület: ${f1(fp.w)} × ${f1(fp.d)} m, ${f1(fp.area)} m²` + (pb ? ` · vázlat ${f1(pb.w)} × ${f1(pb.d)} m` : '') + `</div>` : '') +
        (S.place ? `<div>Elforgatás: ${f1(S.place.rot)}°${S.place.auto ? ' (automatikus)' : ''}</div>` : '') +
        lines.map((l, i) => `<div class="${i === 0 ? (rep.verdict === 'rendben' ? 'ok' : 'bad') : ''}">${esc(l)}</div>`).join('') + `</div>` +
      (sat ? `<div class="hint">${esc(SAT.attribution)}</div>` : '');
  }

  function result() {
    return { kind: 'vrg-site-result', v: 1, id: S.id, outline: S.outline.length >= 3 ? S.outline : [], outlineSrc: S.src,
      place: S.place ? { lat: S.place.lat, lon: S.place.lon, rot: S.place.rot, auto: !!S.place.auto } : null, center: S.center || null };
  }
  // an outline the user touched is theirs: drawn (or traced over the satellite image), no longer OSM's
  const touchOutline = () => { S.src = sat ? 'muhold' : 'rajz'; };

  function onPanel(e) {
    const a = e.target.closest('button') && e.target.closest('button').dataset.a; if (!a) return;
    const turnBy = d => { if (!S.place) return; S.place = Object.assign({}, S.place, { rot: M().norm180(S.place.rot + d), auto: false }); };
    if (a === 'done') { const r = result(); close(); opts.done && opts.done(r); return; }
    if (a === 'cancel') { close(); opts.cancel && opts.cancel(); return; }
    if (a === 'm-outline') mode = 'outline';
    else if (a === 'm-place') { mode = 'place'; sel = -1; if (!S.place) S.place = firstPlace(); }
    else if (a === 'sat') setSat(!sat);
    else if (a === 'center') { const c = map.getCenter(); S.center = [Math.round(c.lat * 1e7) / 1e7, Math.round(c.lng * 1e7) / 1e7]; toast('A munka helye: a térkép közepe (a ✓ Kész után kerül a vázlatba).'); }
    else if (a === 'del' && sel >= 0) { S.outline.splice(sel, 1); sel = -1; touchOutline(); }
    else if (a === 'undo') { S.outline.pop(); sel = -1; touchOutline(); }
    else if (a === 'clear') { S.outline = []; sel = -1; touchOutline(); }
    else if (a === 'fit') { S.place = M().autoFit(S.rooms, S.outline) || S.place; }
    else if (/^r-?\d+$/.test(a)) turnBy(+a.slice(1));
    draw();
  }

  function firstPlace() {
    if (S.outline.length >= 3) { const p = M().autoFit(S.rooms, S.outline); if (p) return p; }
    const c = S.lat != null ? { lat: S.lat, lng: S.lon } : map.getCenter();
    return { lat: c.lat, lon: c.lng, rot: 0, auto: true };
  }

  const toast = m => { const t = document.getElementById('toast'); if (!t) return; t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3500); };

  // ---- gestures: a tap adds a corner; a corner or a white midpoint is dragged; the sketch is dragged in ◫ mode ------
  const hit = (pt, layers) => map.queryRenderedFeatures([[pt.x - 14, pt.y - 14], [pt.x + 14, pt.y + 14]], { layers: layers.filter(l => map.getLayer(l)) });

  function onClick(e) {
    if (!S || mode !== 'outline' || drag && drag.moved) return;
    const f = hit(e.point, ['vrg-site-corner', 'vrg-site-mid'])[0];
    if (f && f.properties.k === 'corner') { sel = f.properties.i === sel ? -1 : f.properties.i; draw(); return; }
    if (f) return;
    S.outline.push([Math.round(e.lngLat.lat * 1e7) / 1e7, Math.round(e.lngLat.lng * 1e7) / 1e7]); sel = -1; touchOutline(); draw();
  }

  function onDown(e) {
    if (!S) return;
    if (e.originalEvent && e.originalEvent.touches && e.originalEvent.touches.length > 1) return;   // two fingers: the map's
    if (mode === 'outline') {
      const f = hit(e.point, ['vrg-site-corner', 'vrg-site-mid'])[0]; if (!f) return;
      e.preventDefault();
      let i = f.properties.i;
      if (f.properties.k === 'mid') { S.outline.splice(i + 1, 0, [e.lngLat.lat, e.lngLat.lng]); i = i + 1; }
      drag = { kind: 'corner', i, moved: false };
    } else {
      if (!S.place || !hit(e.point, ['vrg-site-plan-fill']).length) return;
      e.preventDefault();
      drag = { kind: 'plan', from: e.lngLat, place: Object.assign({}, S.place), moved: false };
    }
  }
  function onMove(e) {
    if (!drag) return;
    drag.moved = true;
    if (drag.kind === 'corner') S.outline[drag.i] = [Math.round(e.lngLat.lat * 1e7) / 1e7, Math.round(e.lngLat.lng * 1e7) / 1e7];
    else S.place = Object.assign({}, drag.place, { lat: drag.place.lat + (e.lngLat.lat - drag.from.lat), lon: drag.place.lon + (e.lngLat.lng - drag.from.lng), auto: false });
    draw();
  }
  function onUp() { if (!drag) return; if (drag.kind === 'corner' && drag.moved) touchOutline(); const d = drag; setTimeout(() => { if (drag === d) drag = null; }, 0); draw(); }

  function close() {
    if (!S) return;
    S = null; drag = null; sel = -1;
    for (const id of ['vrg-site-outline', 'vrg-site-handles', 'vrg-site-plan', 'vrg-site-bad']) if (map.getSource(id)) map.getSource(id).setData(empty());
    setSat(false); flat(false);
    const el = document.getElementById('site-panel'); if (el) el.remove();
  }

  /** Opens the layer on one survey: { id, name, lat?, lon?, outline: [[lat, lon]], outlineSrc, place?, rooms: [{name, poly: [[x, y] m]}] }. */
  function open(data, o) {
    if (!map || !M()) return false;
    close();
    opts = o || {};
    S = { id: String(data.id || ''), name: data.name || '', lat: typeof data.lat === 'number' ? data.lat : null, lon: typeof data.lon === 'number' ? data.lon : null,
      outline: (data.outline || []).filter(p => Array.isArray(p) && p.length >= 2).map(p => [+p[0], +p[1]]),
      src: data.outlineSrc || 'rajz', place: data.place && typeof data.place.lat === 'number' ? Object.assign({}, data.place) : null,
      rooms: (data.rooms || []).filter(r => r.poly && r.poly.length >= 3), canCenter: !!opts.canCenter, center: null };
    if (!['osm', 'rajz', 'muhold'].includes(S.src)) S.src = 'rajz';
    mode = S.outline.length >= 3 && S.rooms.length ? 'place' : 'outline';
    if (mode === 'place' && !S.place) S.place = firstPlace();
    ensureLayers(); flat(true);
    const pts = S.outline.map(p => [p[1], p[0]]).concat(placedRings().flatMap(r => r.ring));
    if (pts.length) {
      const b = pts.reduce((b, p) => [Math.min(b[0], p[0]), Math.min(b[1], p[1]), Math.max(b[2], p[0]), Math.max(b[3], p[1])], [180, 90, -180, -90]);
      map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: { top: 60, left: 40, right: 40, bottom: 260 }, maxZoom: 19.3, pitch: 0, bearing: 0, duration: 0 });
    } else if (S.lat != null) map.jumpTo({ center: [S.lon, S.lat], zoom: 18.6, pitch: 0, bearing: 0 });
    else map.jumpTo({ pitch: 0, bearing: 0 });
    draw();
    return true;
  }

  let tries = 0;
  const wait = setInterval(() => {
    const v = window.vrgMap;
    if (v && v.map && v.maplibregl && window.VrgSiteMath) { clearInterval(wait); start(v.map, v.maplibregl); }
    else if (++tries > 400) clearInterval(wait);
  }, 150);

  let queued = null;
  function start(m, lib) {
    map = m; ml = lib;
    map.on('click', onClick);
    map.on('mousedown', onDown); map.on('touchstart', onDown);
    map.on('mousemove', onMove); map.on('touchmove', onMove);
    map.on('mouseup', onUp); map.on('touchend', onUp);
    const go = () => { window.vrgSite.ready = true; if (queued) { const [d, o] = queued; queued = null; open(d, o); } };
    if (map.loaded()) go(); else map.once('load', go);
  }

  // the Desktop Sketcher, embedding this page: one survey in, one answer back to that window only
  window.addEventListener('message', e => {
    const d = e.data;
    if (!d || d.kind !== 'vrg-site' || d.v !== 1 || e.source !== window.parent || window.parent === window) return;
    const back = r => { try { e.source.postMessage(r, e.origin && e.origin !== 'null' ? e.origin : '*'); } catch { /* the opener is gone */ } };
    window.vrgSite.open(d, { done: back, cancel: () => back({ kind: 'vrg-site-result', v: 1, id: d.id, cancelled: true }), canCenter: true });
  });

  window.vrgSite = {
    ready: false,
    open(data, o) { if (!map || !window.vrgSite.ready) { queued = [data, o]; return true; } return open(data, o); },
    close, state: () => S && JSON.parse(JSON.stringify(Object.assign({}, S, { mode, sat }))),
  };
  // tell an embedding page that the frame can take a survey now (it may have sent one too early)
  if (window.parent !== window) { const hello = () => { try { window.parent.postMessage({ kind: 'vrg-site-ready', v: 1 }, '*'); } catch { /* none */ } };
    const w2 = setInterval(() => { if (window.vrgSite.ready) { clearInterval(w2); hello(); } }, 200); }
})();
