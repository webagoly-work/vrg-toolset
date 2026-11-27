// feed.js — the Térkép-feed's rules (WP M55): the categories, which OSM objects belong to each, the
// nearest one to a position, and a rough ETA. Shared by the page (lib/feed-layer.js), the build tool
// (tools/build-pois.js) and the tests. Dependency-free; no network.
//
//   const F = require('./feed.js')           // Node
//   window.VRGFeed                            // browser, after <script src="/lib/feed.js">
//
//   F.CATEGORIES                  [{ id, hu, icon, color, on }]   the feed's slots, in the user's order
//   F.classify(tags)              -> category id | null            (an OSM object's tags)
//   F.index(pois)                 the parsed Map/data/pois.json -> { cat: { lon, lat, name, kind } typed arrays }
//   F.nearest(idx, cat, lon, lat) -> { lon, lat, name, kind, dist } | null
//   F.distance(lon1, lat1, lon2, lat2)  metres (haversine)
//   F.eta(metres, mode)           minutes; mode 'auto' | 'gyalog'. A straight-line estimate until routing
//                                 (N2): the distance times a detour factor over an average speed
//   F.items(idx, pins, cats, lon, lat)  the feed: one item per enabled category, in category order
//
// The user's own pins (Otthon, a Daniella that OSM lacks) live in the browser's storage on the device and
// are passed in as `pins`; they are never sent anywhere (VRG Mobile D-31).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VRGFeed = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const CATEGORIES = [
    { id: 'otthon', hu: 'Otthon', icon: '🏠', color: '#2f7d4a', on: true },
    { id: 'daniella', hu: 'Daniella', icon: '⚡', color: '#c8102e', on: true },
    { id: 'szereles', hu: 'Szerelvény, barkács', icon: '🔧', color: '#c26a12', on: true },
    { id: 'bolt', hu: 'Élelmiszerbolt', icon: '🛒', color: '#1f6fb5', on: true },
    { id: 'etkezes', hu: 'Étkezés', icon: '🍽', color: '#8a4fb5', on: true },
    { id: 'orvos', hu: 'Kórház, orvos', icon: '🏥', color: '#b5491f', on: true },
    { id: 'kinai', hu: 'Kínai bolt', icon: '🧰', color: '#7a6a2f', on: false },
    { id: 'wc', hu: 'Nyilvános WC', icon: '🚻', color: '#3b7f8a', on: false },
    { id: 'megallo', hu: 'Megálló', icon: '🚏', color: '#4d4943', on: false },
  ];
  const MAX_ON = 6;

  const SZERELES = new Set(['electrical', 'hardware', 'doityourself', 'trade', 'tools', 'lighting']);
  const BOLT = new Set(['supermarket', 'convenience']);
  const ETKEZES = new Set(['restaurant', 'fast_food', 'food_court']);
  const ORVOS = new Set(['hospital', 'clinic', 'doctors']);
  const PRIVATE = new Set(['private', 'no', 'customers']);

  /** Which feed category an OSM object belongs to (null: none). The kind word is `kindOf`. */
  function classify(t) {
    if (!t) return null;
    const name = (t.name || '') + ' ' + (t.brand || '');
    if (/daniella/i.test(name) && (t.shop || t.office || t.craft || t.building)) return 'daniella';
    if (t.shop && SZERELES.has(t.shop)) return 'szereles';
    if (t.shop === 'variety_store') return 'kinai';
    if (t.shop && BOLT.has(t.shop)) return 'bolt';
    if (t.amenity && ETKEZES.has(t.amenity)) return 'etkezes';
    if ((t.amenity && ORVOS.has(t.amenity)) || (t.healthcare && ORVOS.has(t.healthcare))) return 'orvos';
    if (t.amenity === 'toilets' && !PRIVATE.has(t.access || '')) return 'wc';
    if (t.highway === 'bus_stop' || t.railway === 'tram_stop' || t.railway === 'station' || t.railway === 'halt' ||
        t.amenity === 'bus_station' || t.public_transport === 'station') return 'megallo';
    return null;
  }
  /** A short word for what the object is (shown under its name). */
  function kindOf(t) {
    return t.shop || t.amenity || t.healthcare || (t.railway ? 'railway_' + t.railway : '') || (t.highway === 'bus_stop' ? 'bus_stop' : '') || t.public_transport || '';
  }
  const KIND_HU = {
    electrical: 'villamossági', hardware: 'vas-műszaki', doityourself: 'barkácsáruház', trade: 'szakkereskedés', tools: 'szerszám',
    lighting: 'lámpa', variety_store: 'vegyes', supermarket: 'szupermarket', convenience: 'kisbolt', restaurant: 'étterem',
    fast_food: 'büfé', food_court: 'étkezde', hospital: 'kórház', clinic: 'rendelő', doctors: 'orvos', toilets: 'WC',
    bus_stop: 'buszmegálló', railway_tram_stop: 'villamosmegálló', railway_station: 'állomás', railway_halt: 'megállóhely',
    bus_station: 'buszpályaudvar', station: 'állomás',
  };

  /** pois.json → per category typed arrays (fast nearest search over tens of thousands of points). */
  function index(d) {
    const out = {};
    const s = (d && d.s) || [];
    for (const c of CATEGORIES) {
      const rows = (d && d.cats && d.cats[c.id]) || [];
      const lon = new Float64Array(rows.length), lat = new Float64Array(rows.length);
      const name = new Array(rows.length), kind = new Array(rows.length);
      rows.forEach((r, i) => { lon[i] = r[0] / 1e5; lat[i] = r[1] / 1e5; name[i] = s[r[2]] || ''; kind[i] = s[r[3]] || ''; });
      out[c.id] = { lon, lat, name, kind, n: rows.length };
    }
    out.built = d && d.built;
    return out;
  }

  const R = 6371008.8, rad = x => x * Math.PI / 180;
  function distance(lon1, lat1, lon2, lat2) {
    const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  function nearest(idx, cat, lon, lat) {
    const c = idx && idx[cat];
    if (!c || !c.n) return null;
    const k = Math.cos(rad(lat)) ** 2;
    let best = -1, bd = Infinity;
    for (let i = 0; i < c.n; i++) {
      const dx = c.lon[i] - lon, dy = c.lat[i] - lat, d = dx * dx * k + dy * dy;
      if (d < bd) { bd = d; best = i; }
    }
    return { lon: c.lon[best], lat: c.lat[best], name: c.name[best], kind: KIND_HU[c.kind[best]] || c.kind[best] || '',
      dist: distance(lon, lat, c.lon[best], c.lat[best]) };
  }

  // Straight-line estimates until real routing (N2). Detour: roads are longer than the bird's line
  // (about 1.3 in towns). Speeds: an average town drive with stops, a brisk walk.
  const MODES = { auto: { detour: 1.35, kmh: 28, extra: 1 }, gyalog: { detour: 1.25, kmh: 4.8, extra: 0 } };
  function eta(metres, mode) {
    const m = MODES[mode] || MODES.auto;
    return metres * m.detour / (m.kmh * 1000 / 60) + (metres > 300 ? m.extra : 0);
  }
  function fmtEta(min) {
    if (!(min >= 0)) return '—';
    if (min < 1) return '<1 perc';
    if (min < 60) return '~' + Math.round(min) + ' perc';
    const h = Math.floor(min / 60), m = Math.round(min - h * 60);
    return '~' + h + ' ó ' + String(m).padStart(2, '0') + ' p';
  }
  function fmtDist(m) { return m < 950 ? Math.round(m / 10) * 10 + ' m' : (m / 1000).toFixed(m < 9500 ? 1 : 0).replace('.', ',') + ' km'; }

  /** The user's pin of a category nearest to the position (pins: [{ cat, lon, lat, name }]). */
  function nearestPin(pins, cat, lon, lat) {
    let best = null;
    for (const p of pins || []) {
      if (p.cat !== cat || !(typeof p.lon === 'number' && typeof p.lat === 'number')) continue;
      const d = distance(lon, lat, p.lon, p.lat);
      if (!best || d < best.dist) best = { lon: p.lon, lat: p.lat, name: p.name || '', kind: 'saját pont', dist: d, own: true };
    }
    return best;
  }

  /** The feed: for each enabled category, the nearest of OSM's and the user's own (whichever is closer). */
  function items(idx, pins, cats, lon, lat, mode) {
    const out = [];
    for (const c of CATEGORIES) {
      if (!cats.includes(c.id)) continue;
      const a = c.id === 'otthon' ? null : nearest(idx, c.id, lon, lat);
      const b = nearestPin(pins, c.id, lon, lat);
      const it = a && b ? (b.dist <= a.dist ? b : a) : (a || b);
      if (!it) { out.push({ cat: c.id, missing: true }); continue; }
      out.push(Object.assign({ cat: c.id, eta: eta(it.dist, mode) }, it));
    }
    return out;
  }

  /** The enabled categories after a tap on one: on → off; off → on unless MAX_ON are on already. */
  function toggleCat(cats, id) {
    if (cats.includes(id)) return cats.filter(c => c !== id);
    if (cats.length >= MAX_ON) return cats;
    return CATEGORIES.map(c => c.id).filter(c => c === id || cats.includes(c));
  }
  const defaults = () => CATEGORIES.filter(c => c.on).map(c => c.id);

  return { CATEGORIES, MAX_ON, classify, kindOf, KIND_HU, index, distance, nearest, nearestPin, eta, fmtEta, fmtDist, items, toggleCat, defaults };
});
