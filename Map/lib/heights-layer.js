// heights-layer.js — the Épületmagasság (B) layer of the VRG Térkép: measured building heights (data/bp-heights.bin,
// tools/build-bp-heights.js, lib/heights.js) as their own 3D buildings where the file has them; the basemap's OSM 3D
// buildings step aside inside its area. A click on a building tells its height and where the number came from. The
// Árnyék layer (S) casts the shadows of these buildings when B is on (api.buildings).
//
//   initHeights({ map, store, toast, url? }) -> api | null        url: '/data/bp-heights.bin' by default
//   api: { on, toggle(want?), buildings(bounds) -> [{ polys, h }], set, extent, isOn }
// Without the file the B button stays greyed and says how to make it.

const HV = () => window.VRGHeights;
const SRC = 'bp-heights', LAYER = 'bp-heights-3d';
const MIN_ZOOM = 14, MAX_IN_VIEW = 25000;

export function initHeights({ map, store, toast, url }) {
  const $ = s => document.querySelector(s);
  const btn = $('#b-heights');
  if (!btn || !HV()) return null;
  const file = url || '/data/bp-heights.bin';
  let on = false, set = null, idx = null, extent = null, timer = 0, loading = null;
  const api = { on: false, toggle, buildings, isOn: () => on, set: () => set, extent: () => extent };
  window.vrgHeights = api;

  btn.disabled = true;
  btn.title = 'Mért épületmagasság (Budapest): nincs még adat. A PC-n: node Map/tools/build-bp-heights.js <atlasz.geojson>';
  fetch(file, { method: 'HEAD' }).then(r => {
    if (!r.ok) return;
    btn.disabled = false;
    btn.title = 'Mért épületmagasság (Budapest): a mért magasságú épületek 3D-ben, árnyékkal';
    if (store.get('heights', false)) toggle(true);
  }).catch(() => {});

  function load() {
    if (!loading) loading = fetch(file).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
      .then(b => { set = HV().decode(b); idx = HV().index(set); extent = set.extent(); return set; });
    return loading;
  }

  const inArea = () => { if (!extent) return false; const c = map.getCenter(); return c.lng >= extent.west && c.lng <= extent.east && c.lat >= extent.south && c.lat <= extent.north; };
  const box = () => { const b = map.getBounds(); return { west: b.getWest(), east: b.getEast(), south: b.getSouth(), north: b.getNorth() }; };

  /** The measured buildings meeting [b] (the view by default), for the 3D layer and the shadows. */
  function buildings(b) {
    if (!set) return [];
    return HV().inBox(set, idx, b || box(), MAX_IN_VIEW).map(i => ({ polys: [set.rings(i)], h: set.h(i), base: 0, id: i }));
  }

  function ensure() {
    if (map.getSource(SRC)) return;
    map.addSource(SRC, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({ id: LAYER, type: 'fill-extrusion', source: SRC, minzoom: MIN_ZOOM, paint: {
      'fill-extrusion-color': ['interpolate', ['linear'], ['get', 'h'], 5, '#d8cbb6', 20, '#c9b79a', 40, '#b39e80', 80, '#8f7d68'],
      'fill-extrusion-height': ['get', 'h'], 'fill-extrusion-base': 0, 'fill-extrusion-opacity': 0.94, 'fill-extrusion-vertical-gradient': true } });
  }
  function draw() {
    if (!on || !set) return;
    const zoomed = map.getZoom() >= MIN_ZOOM, here = inArea();
    if (map.getLayer('buildings-3d')) map.setLayoutProperty('buildings-3d', 'visibility', here && zoomed ? 'none' : 'visible');
    const fs = zoomed && here ? buildings().map(b => ({ type: 'Feature', id: b.id, properties: { h: b.h }, geometry: { type: 'Polygon', coordinates: b.polys[0] } })) : [];
    const s = map.getSource(SRC); if (s) s.setData({ type: 'FeatureCollection', features: fs });
    api.count = fs.length;
  }
  const onMove = () => { clearTimeout(timer); timer = setTimeout(draw, 150); };
  const onClick = e => {
    const f = e.features && e.features[0]; if (!f) return;
    toast('Épületmagasság: ' + (Math.round(f.properties.h * 10) / 10).toLocaleString('hu-HU') + ' m (mért' + (set && set.meta.source ? ': ' + set.meta.source : '') + ')');
  };

  async function toggle(want) {
    on = want === undefined ? !on : !!want;
    api.on = on;
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    store.set('heights', on);
    if (on) {
      try { await load(); } catch (e) { toast('Az épületmagasság-fájl nem olvasható: ' + e.message); on = api.on = false; btn.setAttribute('aria-pressed', 'false'); return; }
      ensure(); map.on('moveend', onMove); map.on('click', LAYER, onClick); draw();
    } else {
      map.off('moveend', onMove); map.off('click', LAYER, onClick);
      if (map.getLayer(LAYER)) map.removeLayer(LAYER); if (map.getSource(SRC)) map.removeSource(SRC);
      if (map.getLayer('buildings-3d')) map.setLayoutProperty('buildings-3d', 'visibility', 'visible');
    }
    if (window.vrgShadows && window.vrgShadows.isOn && window.vrgShadows.isOn()) window.vrgShadows.refresh && window.vrgShadows.refresh();
  }
  btn.onclick = () => toggle();
  return api;
}
