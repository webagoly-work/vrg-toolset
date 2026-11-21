// feed-layer.js — the Térkép-feed (F) of the VRG Térkép, WP M55 (N1 of the navigation line, D-129…D-132):
// around the user's position, the nearest point of each chosen category (up to six: Otthon, Daniella,
// szerelvénybolt, élelmiszerbolt, étkezés, orvos by default; also kínai bolt, WC, megálló), each with its
// distance, a straight-line ETA and a dashed "ghost line" from the user to its icon. Holding a card or an
// icon (or right-clicking it) selects it: the others hide and the map frames the user and that place
// (the "spider"); Navigáció then hands it to a navigation app until our own routing (N2) exists.
//
// Rules and data: lib/feed.js (window.VRGFeed) and /data/pois.json (tools/build-pois.js, OSM, ODbL).
// The position: the browser's / phone's GPS (watchPosition); without one, the map's centre. The user's
// own pins (Otthon, a Daniella OSM lacks) are kept in this browser's storage only (VRG Mobile D-31): on
// the phone that is the phone, and nothing here sends a position or a pin anywhere. ?feed=1 opens it.

const F = () => window.VRGFeed;
const SRC = 'vrg-feed';
const HOLD_MS = 550;
const MOVE_M = 25, EVERY_MS = 30000;       // refresh the list after 25 m or 30 s of movement
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function initFeed({ map, maplibregl, params, store, toast, router }) {
  const $ = s => document.querySelector(s);
  const btn = $('#b-feed'), panel = $('#feed-panel');
  if (!btn || !panel || !F()) return null;
  const cat = id => F().CATEGORIES.find(c => c.id === id);

  let drawn = [];
  let rt = null, planning = false, reAt = 0, gen = 0;      // N2: the selected place's route (lib/route-layer.js)
  const REROUTE_M = 45, REROUTE_MS = 8000, ROAD_MAX_M = 60000;
  let on = false, idx = null, loading = null, watch = null, pos = null, last = null, items = [], sel = null, gear = false;
  let cats = store.get('feedCats', null) || F().defaults();
  let pins = store.get('feedPins', []) || [];
  let mode = store.get('feedMode', 'auto');
  const markers = new Map();
  const api = { isOn: () => on, items: () => items, selected: () => sel, toggle, select, clear, pins: () => pins.slice(),
    setPosition: (lon, lat) => setPos(lon, lat, 'gps', 5), lines: () => drawn.map(f => f.properties.k), route: () => rt };
  window.vrgFeed = api;

  panel.innerHTML = `
    <div class="lg-h"><b>Térkép-feed</b><span class="m" id="fd-src"></span>
      <button type="button" class="lg-chip" id="fd-mode" title="Autóval / gyalog"></button>
      <button type="button" class="lg-x" id="fd-gear" aria-label="Beállítások" title="Kategóriák, saját pontok">⚙</button>
      <button type="button" class="lg-x" id="fd-x" aria-label="Bezárás">✕</button></div>
    <div id="fd-list" role="list"></div>
    <div id="fd-set" hidden></div>
    <div class="m fd-note" id="fd-note"></div>`;

  // ---------------------------------------------------------------- data and position
  async function load() {
    if (idx || loading) return loading;
    loading = (async () => {
      try {
        const r = await fetch('/data/pois.json');
        if (!r.ok) throw new Error('HTTP ' + r.status);
        idx = F().index(await r.json());
        note('');
      } catch {
        idx = F().index(null);
        note('A pontok adata hiányzik: a PC-n node Map/tools/fetch-data.js --only=osm,pois. Telefonon a PC-vel párosítva egyszer letöltődik. A saját pontok addig is látszanak.');
      }
      loading = null;
      refresh(true);
    })();
    if (router) router.load().then(() => roadEtas());
    return loading;
  }
  function note(t) { $('#fd-note').textContent = t || ''; }

  function setPos(lon, lat, src, acc) {
    pos = { lon, lat, src, acc };
    $('#fd-src').textContent = src === 'gps' ? ' · a helyedtől' + (acc ? ` (±${Math.round(acc)} m)` : '') : ' · a térkép közepétől';
    const moved = !last || F().distance(last.lon, last.lat, lon, lat) > MOVE_M || Date.now() - last.t > EVERY_MS;
    if (sel) { refreshSelected(); drawLines(); followRoute(); return; }
    if (moved) refresh(true); else drawLines();
  }
  function fromCenter() { if (!pos || pos.src !== 'gps') { const c = map.getCenter(); setPos(c.lng, c.lat, 'center'); } }
  function startWatch() {
    fromCenter();
    if (!navigator.geolocation) return;
    watch = navigator.geolocation.watchPosition(
      p => setPos(p.coords.longitude, p.coords.latitude, 'gps', p.coords.accuracy),
      () => { if (!pos || pos.src !== 'gps') fromCenter(); },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 });
  }
  function stopWatch() { if (watch != null && navigator.geolocation) navigator.geolocation.clearWatch(watch); watch = null; }

  // ---------------------------------------------------------------- the list
  function refresh(full) {
    if (!on || !pos || !idx) return;
    if (full) { items = F().items(idx, pins, cats, pos.lon, pos.lat, mode); last = { lon: pos.lon, lat: pos.lat, t: Date.now() }; }
    renderList(); renderMarkers(); drawLines();
    if (full) roadEtas();
  }
  /** N2: the cards' times and distances along the roads, one route after the other (straight-line until then). */
  async function roadEtas() {
    if (!router || router.state() !== 'ready' || !pos || sel) return;
    const my = ++gen, from = { lon: pos.lon, lat: pos.lat }, list = items;
    for (const it of list) {
      if (it.missing || it.dist > ROAD_MAX_M) continue;
      const r = await router.plan(from, it, mode);
      if (my !== gen || list !== items || sel) return;
      if (r) { it.road = { meters: r.meters, seconds: r.seconds }; renderList(); }
    }
  }
  const shownDist = it => (it.road ? it.road.meters : it.dist);
  const shownEta = it => (it.road ? it.road.seconds / 60 : it.eta);
  function refreshSelected() {
    const it = items.find(i => i.cat === sel);
    if (!it || it.missing) return;
    it.dist = F().distance(pos.lon, pos.lat, it.lon, it.lat);
    it.eta = F().eta(it.dist, mode);
    if (rt) { const a = router.along(rt, pos.lon, pos.lat); it.road = { meters: a.left, seconds: a.leftSeconds }; }
    renderList();
  }
  function card(it) {
    const c = cat(it.cat);
    if (it.missing) {
      const why = it.cat === 'otthon' ? 'Nincs beállítva: ⚙ → Otthon' : 'Nincs a pontok között';
      return `<div class="fd-card fd-miss" role="listitem" data-cat="${c.id}" style="--c:${c.color}"><span class="fd-i">${c.icon}</span>
        <span class="fd-t"><b>${esc(c.hu)}</b><small>${why}</small></span></div>`;
    }
    const big = sel === it.cat;
    return `<div class="fd-card${big ? ' fd-sel' : ''}" role="listitem" tabindex="0" data-cat="${c.id}" style="--c:${c.color}"
        title="Koppintás: megmutatja · Nyomva tartva (jobb klikk): kiválasztja">
      <span class="fd-i">${c.icon}</span>
      <span class="fd-t"><b>${esc(it.name || c.hu)}</b><small>${esc(c.hu)}${it.kind && it.kind !== c.hu ? ' · ' + esc(it.kind) : ''}${it.own ? ' · saját' : ''}</small></span>
      <span class="fd-d"><b>${F().fmtEta(shownEta(it))}</b><small>${F().fmtDist(shownDist(it))}${it.road ? ' úton' : ' légvonal'}</small></span>
      ${big ? `<span class="fd-act"><button type="button" class="lg-chip" data-nav>Navigáció appban</button><button type="button" class="lg-chip" data-back>✕ Vissza</button>
        <small class="m">${routeNote()}</small></span>` : ''}
    </div>`;
  }
  function renderList() {
    const list = $('#fd-list');
    const shown = sel ? items.filter(i => i.cat === sel) : items;
    list.innerHTML = shown.map(card).join('') || '<div class="m">Válassz kategóriát: ⚙</div>';
    list.querySelectorAll('.fd-card:not(.fd-miss)').forEach(el => hold(el, () => focus(el.dataset.cat), () => select(el.dataset.cat)));
    const nav = list.querySelector('[data-nav]'), back = list.querySelector('[data-back]');
    if (nav) nav.onclick = e => { e.stopPropagation(); navigate(); };
    if (back) back.onclick = e => { e.stopPropagation(); clear(); };
    $('#fd-mode').textContent = mode === 'auto' ? '🚗 Autó' : '🚶 Gyalog';
  }

  /** Tap → onTap, hold (or right click) → onHold; a drag cancels. */
  function hold(el, onTap, onHold) {
    let t = 0, x = 0, y = 0, held = false;
    el.addEventListener('pointerdown', e => {
      if (e.button === 2) return;
      held = false; x = e.clientX; y = e.clientY;
      clearTimeout(t); t = setTimeout(() => { held = true; if (navigator.vibrate) navigator.vibrate(15); onHold(); }, HOLD_MS);
    });
    el.addEventListener('pointermove', e => { if (Math.hypot(e.clientX - x, e.clientY - y) > 10) clearTimeout(t); });
    el.addEventListener('pointerup', e => { clearTimeout(t); if (!held && e.button !== 2) onTap(); });
    el.addEventListener('pointercancel', () => clearTimeout(t));
    el.addEventListener('contextmenu', e => { e.preventDefault(); clearTimeout(t); held = true; onHold(); });
    el.addEventListener('keydown', e => { if (e.key === 'Enter') onTap(); if (e.key === ' ') { e.preventDefault(); onHold(); } });
  }

  // ---------------------------------------------------------------- icons and ghost lines
  function renderMarkers() {
    const want = new Set();
    for (const it of items) {
      if (it.missing || (sel && it.cat !== sel)) continue;
      want.add(it.cat);
      let m = markers.get(it.cat);
      if (!m) {
        const c = cat(it.cat), el = document.createElement('div');
        el.className = 'fd-mk'; el.style.setProperty('--c', c.color); el.textContent = c.icon; el.dataset.cat = c.id;
        hold(el, () => focus(c.id), () => select(c.id));
        m = new maplibregl.Marker({ element: el, anchor: 'center' });
        markers.set(it.cat, m);
      }
      m.setLngLat([it.lon, it.lat]).addTo(map);
      m.getElement().classList.toggle('fd-mk-sel', sel === it.cat);
      m.getElement().title = (it.name || cat(it.cat).hu) + ' · ' + F().fmtDist(it.dist) + ' · ' + F().fmtEta(it.eta);
    }
    for (const [k, m] of markers) if (!want.has(k)) m.remove();
  }
  function ensureLayers() {
    if (map.getSource(SRC)) return;
    map.addSource(SRC, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({ id: 'vrg-feed-ghost', type: 'line', source: SRC, filter: ['==', ['get', 'k'], 'ghost'],
      layout: { 'line-cap': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': 2.2, 'line-opacity': 0.75, 'line-dasharray': [1.5, 2] } });
    map.addLayer({ id: 'vrg-feed-spider', type: 'line', source: SRC, filter: ['==', ['get', 'k'], 'spider'],
      layout: { 'line-cap': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': 4.5, 'line-opacity': 0.9 } });
    map.addLayer({ id: 'vrg-feed-you', type: 'circle', source: SRC, filter: ['==', ['get', 'k'], 'you'],
      paint: { 'circle-radius': 7, 'circle-color': '#1a73e8', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 3 } });
  }
  function routeNote() {
    const st = router ? router.state() : 'none';
    if (planning) return 'Útvonal tervezése…';
    if (rt) return `Útvonal a saját úthálózaton (${mode === 'gyalog' ? 'gyalog' : 'autóval'}, forgalom nélkül); letérésnél újratervez.`;
    if (st === 'loading') return 'Az úthálózat betöltése…';
    if (st === 'missing' || st === 'error' || st === 'none') return 'Nincs úthálózat ezen a gépen: légvonalbeli becslés. A PC-n: node Map/tools/fetch-data.js --only=osm,roads.';
    return 'Ide nem található útvonal: légvonalbeli becslés.';
  }
  function drawLines() {
    const s = map.getSource(SRC);
    if (!s) return;
    const f = [];
    if (on && pos) {
      for (const it of items) {
        if (it.missing || (sel && it.cat !== sel) || (sel && rt)) continue;
        f.push({ type: 'Feature', properties: { k: sel ? 'spider' : 'ghost', color: cat(it.cat).color },
          geometry: { type: 'LineString', coordinates: [[pos.lon, pos.lat], [it.lon, it.lat]] } });
      }
      f.push({ type: 'Feature', properties: { k: 'you' }, geometry: { type: 'Point', coordinates: [pos.lon, pos.lat] } });
    }
    drawn = f;
    s.setData({ type: 'FeatureCollection', features: f });
  }

  // ---------------------------------------------------------------- focus, select (the spider), navigate
  function frame(it, pad) {
    const b = new maplibregl.LngLatBounds([pos.lon, pos.lat], [pos.lon, pos.lat]).extend([it.lon, it.lat]);
    const narrow = matchMedia('(max-width:640px)').matches;
    map.fitBounds(b, { padding: narrow ? { top: 140, bottom: Math.round(innerHeight * 0.42), left: 50, right: 50 } : { top: 80, bottom: 80, left: 420, right: 90 },
      maxZoom: 17, duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 900, ...pad });
  }
  function focus(id) { const it = items.find(i => i.cat === id); if (it && !it.missing && pos) frame(it); }
  function select(id) {
    const it = items.find(i => i.cat === id);
    if (!it || it.missing || !pos) return;
    sel = id; panel.classList.add('fd-spider');
    renderList(); renderMarkers(); drawLines(); frame(it);
    plan();
  }
  /** N2: the route to the selected place along our own road network, drawn in its colour. */
  async function plan() {
    if (!router || !sel || !pos) return;
    const it = items.find(i => i.cat === sel);
    if (!it) return;
    const my = ++gen;
    planning = true; reAt = Date.now(); renderList();
    const r = await router.plan({ lon: pos.lon, lat: pos.lat }, it, mode);
    if (my !== gen || sel !== it.cat) return;
    planning = false; rt = r;
    if (rt) {
      router.draw(rt, cat(it.cat).color);
      it.road = { meters: rt.meters, seconds: rt.seconds };
      const b = rt.coords.reduce((bb, c) => bb.extend(c), new maplibregl.LngLatBounds(rt.coords[0], rt.coords[0])).extend([pos.lon, pos.lat]).extend([it.lon, it.lat]);
      const narrow = matchMedia('(max-width:640px)').matches;
      map.fitBounds(b, { padding: narrow ? { top: 140, bottom: Math.round(innerHeight * 0.42), left: 50, right: 50 } : { top: 80, bottom: 80, left: 420, right: 90 }, maxZoom: 17, duration: 600 });
    } else router.clear();
    renderList(); drawLines();
  }
  function followRoute() {
    if (!rt || planning) return;
    const a = router.along(rt, pos.lon, pos.lat);
    if (a.off > REROUTE_M && Date.now() - reAt > REROUTE_MS) plan();
  }
  function clear() {
    if (!sel) return;
    sel = null; rt = null; planning = false; gen++; panel.classList.remove('fd-spider');
    if (router) router.clear();
    refresh(true);
  }
  function navigate() {
    const it = items.find(i => i.cat === sel);
    if (!it) return;
    const label = it.cat === 'otthon' ? 'Otthon' : (it.name || cat(it.cat).hu);
    if (document.documentElement.classList.contains('vrg-phone')) {   // VRG Mobile: its geo: hand-off (coordinates and the label only)
      location.href = 'vrg-map:nav?lat=' + it.lat + '&lon=' + it.lon + '&label=' + encodeURIComponent(label);
      return;
    }
    const mm = mode === 'gyalog' ? 'fossgis_osrm_foot' : 'fossgis_osrm_car';
    window.open(`https://www.openstreetmap.org/directions?engine=${mm}&route=${pos.lat.toFixed(6)},${pos.lon.toFixed(6)};${it.lat.toFixed(6)},${it.lon.toFixed(6)}`, '_blank', 'noopener');
  }

  // ---------------------------------------------------------------- settings: categories, mode, own pins
  function renderSettings() {
    const box = $('#fd-set');
    box.hidden = !gear;
    if (!gear) return;
    const chips = F().CATEGORIES.map(c => `<button type="button" class="lg-chip fd-cat" data-cat="${c.id}" aria-pressed="${cats.includes(c.id)}">${c.icon} ${esc(c.hu)}</button>`).join('');
    const own = pins.map((p, i) => `<span class="lg-chip fd-pin">${cat(p.cat).icon} ${esc(p.name)} <button type="button" class="lg-x" data-del="${i}" aria-label="Törlés">✕</button></span>`).join('');
    box.innerHTML = `<div class="lg-row"><span class="m">Kategóriák (legfeljebb ${F().MAX_ON}):</span>${chips}</div>
      <div class="lg-row"><span class="m">Otthon:</span>
        <button type="button" class="lg-chip" data-home="gps">a helyem</button><button type="button" class="lg-chip" data-home="center">a térkép közepe</button></div>
      <div class="lg-row"><span class="m">Saját pont a térkép közepén:</span>
        <button type="button" class="lg-chip" data-add="daniella">+ Daniella</button><button type="button" class="lg-chip" data-add="szereles">+ Szerelvénybolt</button></div>
      ${own ? `<div class="lg-row"><span class="m">Saját pontok (csak ebben a böngészőben / telefonon):</span>${own}</div>` : ''}`;
    box.querySelectorAll('.fd-cat').forEach(b => { b.onclick = () => {
      const next = F().toggleCat(cats, b.dataset.cat);
      if (next === cats) { toast('Legfeljebb ' + F().MAX_ON + ' kategória: előbb kapcsolj ki egyet.'); return; }
      cats = next; store.set('feedCats', cats); sel = null; renderSettings(); refresh(true);
    }; });
    box.querySelectorAll('[data-home]').forEach(b => { b.onclick = () => {
      const c = map.getCenter();
      const at = b.dataset.home === 'gps' && pos && pos.src === 'gps' ? [pos.lon, pos.lat] : [c.lng, c.lat];
      if (b.dataset.home === 'gps' && !(pos && pos.src === 'gps')) toast('Nincs GPS-hely: a térkép közepét mentettem.');
      pins = pins.filter(p => p.cat !== 'otthon').concat([{ cat: 'otthon', name: 'Otthon', lon: at[0], lat: at[1] }]);
      savePins();
    }; });
    box.querySelectorAll('[data-add]').forEach(b => { b.onclick = () => {
      const c = map.getCenter(), k = b.dataset.add;
      pins = pins.concat([{ cat: k, name: (k === 'daniella' ? 'Daniella' : 'Szerelvénybolt') + ' (saját)', lon: c.lng, lat: c.lat }]);
      savePins();
    }; });
    box.querySelectorAll('[data-del]').forEach(b => { b.onclick = () => { pins = pins.filter((_, i) => i !== +b.dataset.del); savePins(); }; });
  }
  function savePins() { store.set('feedPins', pins); sel = null; renderSettings(); refresh(true); }

  $('#fd-gear').onclick = () => { gear = !gear; renderSettings(); };
  $('#fd-x').onclick = () => toggle(false);
  $('#fd-mode').onclick = () => {
    mode = mode === 'auto' ? 'gyalog' : 'auto'; store.set('feedMode', mode);
    if (sel) { rt = null; plan(); renderList(); } else refresh(true);
  };

  // ---------------------------------------------------------------- on / off
  const onMove = () => { if (pos && pos.src === 'center') fromCenter(); };
  function toggle(want) {
    on = want === undefined ? !on : !!want;
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    panel.hidden = !on;
    document.body.classList.toggle('feed-on', on);
    store.set('feed', on);
    if (on) {
      ensureLayers();
      map.on('moveend', onMove);
      startWatch(); load();
    } else {
      stopWatch(); map.off('moveend', onMove);
      sel = null; rt = null; gen++; panel.classList.remove('fd-spider'); items = []; pos = null; last = null;
      if (router) router.clear();
      for (const m of markers.values()) m.remove();
      drawLines();
    }
  }
  btn.onclick = () => toggle();
  const start = () => { if (params.get('feed') === '1' || (params.get('feed') !== '0' && store.get('feed', false))) toggle(true); };
  if (map.loaded()) start(); else map.once('load', start);
  return api;
}
