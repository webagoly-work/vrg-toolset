// route-layer.js — loads the VRG Térkép's offline road network (/data/roads.bin, tools/build-roads.js) and
// draws routes (WP M56, N2, D-129 A). The router is lib/route.js (window.VRGRoute); nothing is sent anywhere.
//
//   const r = initRoute({ map })      -> api | null (no router script)
//   await r.load()                    'ready' | 'missing' | 'error'  (once; later calls wait for the same load)
//   await r.plan(from, to, mode)      { coords, meters, seconds, … } | null       (from/to = { lon, lat })
//   r.draw(route, color) · r.clear() · r.along(route, lon, lat) · r.state()

const SRC = 'vrg-route';
const SNAP_MAX = 400;   // metres between the position / the destination and the road network

export function initRoute({ map }) {
  const R = window.VRGRoute;
  if (!R) return null;
  let g = null, state = 'none', loading = null, info = '';

  async function load() {
    if (g) return 'ready';
    if (loading) return loading;
    state = 'loading';
    loading = (async () => {
      try {
        const res = await fetch('/data/roads.bin');
        if (!res.ok) { state = 'missing'; return state; }
        const bytes = new Uint8Array(await res.arrayBuffer());
        const payload = await R.inflate(bytes);
        g = R.decode(bytes, payload);
        info = (bytes.length / 1e6).toFixed(0) + ' MB, ' + g.n.toLocaleString('hu') + ' csomópont (' + (g.h.built || '') + ')';
        state = 'ready';
      } catch (e) {
        console.warn('roads:', e);
        state = 'error';
      }
      loading = null;
      return state;
    })();
    return loading;
  }

  async function plan(from, to, mode) {
    if (!g && (await load()) !== 'ready') return null;
    const r = await R.routeAsync(g, from, to, mode);
    // a start or an end far from any road the mode may use is not a route (a POI in the middle of a park, data gaps)
    return r && r.snapped[0] <= SNAP_MAX && r.snapped[1] <= SNAP_MAX ? r : null;
  }

  function ensure() {
    if (map.getSource(SRC)) return;
    map.addSource(SRC, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({ id: 'vrg-route-casing', type: 'line', source: SRC, layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#ffffff', 'line-width': 9, 'line-opacity': 0.9 } });
    map.addLayer({ id: 'vrg-route', type: 'line', source: SRC, layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': ['get', 'color'], 'line-width': 5.5 } });
  }
  function draw(rt, color) {
    ensure();
    map.getSource(SRC).setData({ type: 'FeatureCollection', features: rt && rt.coords.length > 1
      ? [{ type: 'Feature', properties: { color: color || '#1a73e8' }, geometry: { type: 'LineString', coordinates: rt.coords } }] : [] });
  }
  function clear() { if (map.getSource(SRC)) draw(null); }

  const api = { load, plan, draw, clear, along: (rt, lon, lat) => R.along(rt, lon, lat), state: () => state, info: () => info, graph: () => g };
  window.vrgRoute = api;
  return api;
}
