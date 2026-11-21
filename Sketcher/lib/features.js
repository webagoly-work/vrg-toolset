// Sketcher/lib/features.js — the VRG Sketcher feature registry (WP M51, D-91…D-99; the Founder's rule D-90).
//
// The data is catalog/features.json (inlined by tools/build.js as window.VRG_FEATURES); this is the logic, the twin of
// Mobile/android/sketch-core Features.kt. tools/make-features-fixture.js writes test/fixtures/features.json from this
// file and FeaturesTest replays it on the JVM, so the phone and the Desktop switch the same way.
//
// State = the ids whose switch differs from their default ("flipped"); for a default-on feature that is "switched off",
// so a feature added later arrives on. Per browser (localStorage), never per survey. A feature that is off leaves no
// trace on the page, never deletes data and never changes what a saved file means; a variant cannot switch it back on.
//
// Works in Node (module.exports) and in the browser (window.VRGFeatures). No dependencies.
(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const data = node ? require('../catalog/features.json') : root.VRG_FEATURES;
  const api = factory(data);
  if (node) module.exports = api; else root.VRGFeatures = api;
})(typeof self !== 'undefined' ? self : this, function (DATA) {
  'use strict';
  const FRONTS = DATA.fronts, ALL = DATA.features;
  const byId = {};
  ALL.forEach(f => { byId[f.id] = f; });
  const of = id => byId[id] || null;
  const def = f => f.default !== false;
  const inFront = front => ALL.filter(f => f.front === front);
  const tool = id => 'vazlat.' + id, camera = id => 'kamera.' + id;
  const has = (flipped, id) => flipped.indexOf(id) >= 0;
  const norm = a => Array.from(new Set(a)).sort();

  function own(flipped, id) {
    const f = of(id);
    if (!f) return !has(flipped, id);
    if (f.locked) return true;
    return def(f) !== has(flipped, id);
  }
  function on(flipped, id, depth) {
    depth = depth || 0;
    if (depth > 16 || !own(flipped, id)) return false;
    const f = of(id);
    return !f || (f.requires || []).every(r => on(flipped, r, depth + 1));
  }
  function blockedBy(flipped, id) {
    if (!own(flipped, id)) return null;
    const f = of(id); if (!f) return null;
    const r = (f.requires || []).find(x => !on(flipped, x));
    return r ? of(r) : null;
  }
  function set(flipped, id, want) {
    const f = of(id);
    if (f && f.locked) return norm(flipped);
    const d = f ? def(f) : true;
    return norm(want === d ? flipped.filter(x => x !== id) : flipped.concat([id]));
  }
  const toggle = (flipped, id) => set(flipped, id, !own(flipped, id));
  function all(flipped, want, front) {
    return ALL.filter(f => !front || f.front === front).reduce((acc, f) => (want && !def(f)) ? acc : set(acc, f.id, want), norm(flipped));
  }
  const allOn = (flipped, front) => ALL.filter(f => (!front || f.front === front) && def(f) && !f.locked).every(f => own(flipped, f.id));
  function visibleFronts(flipped, order) {
    order = order || FRONTS.filter(f => f.bar).map(f => f.id);
    return order.filter(id => { const fs = inFront(id); return !fs.length || fs.some(f => on(flipped, f.id)); });
  }
  // what a variant brings passes through here (D-95)
  const rail = (toolIds, flipped) => toolIds.filter(t => on(flipped, tool(t)));
  const draw = (tune, flipped) => on(flipped, 'vazlat.drawtune') ? tune : null;

  // the map page's site panel (▱ Körvonal, 🛰 Műhold, ◫ Vázlat) and the loose ends (Nyitott) follow the switches too
  const mapHide = flipped => [['outline', 'helyszin.outline'], ['satellite', 'helyszin.satellite'], ['place', 'helyszin.place']].filter(x => !on(flipped, x[1])).map(x => x[0]);
  const OPEN = { draft: 'jegyzet.quick', entry: 'jegyzet.unclear', suggestion: 'jegyzet.keywords', question: 'kerdes.questions', shot: 'kamera.shotlist',
    capture: 'kamera.capture', photo: 'vazlat.photo', point: 'vazlat.point', circuit: 'vazlat.circuit', site: 'helyszin.address' };
  const openFeature = kind => OPEN[kind] || null;
  const openShown = (flipped, o) => { const f = openFeature(o.kind); return (!f || on(flipped, f)) && visibleFronts(flipped).indexOf(o.front) >= 0; };

  const write = flipped => norm(flipped).join(',');
  const read = s => norm(String(s || '').split(',').map(x => x.trim()).filter(Boolean));

  // the stores (D-96): the phone's camera set (unprefixed), D-79's boolean, the general set
  // F3's CameraFeatures ids (sketch-core CameraFeatures.kt); FeaturesTest checks the list against it
  const CAMERA_IDS = ['ocr', 'ocr_auto', 'blur', 'faces', 'faces_auto', 'privacy', 'gps_strip', 'pairs', 'signature', 'video', 'quick', 'again',
    'live', 'live_gps', 'live_series', 'live_ghost', 'live_level', 'live_grid', 'live_torch'];   // F7 (M52): the in-app camera
  const isCam = id => id.startsWith('kamera.') && CAMERA_IDS.indexOf(id.slice(7)) >= 0;
  // F5's SketchFeatures ids (sketch-core SketchFeatures.kt, the phone's "sketcher-features" / off) → the registry's
  const SKETCH_IDS = { client: 'helyszin.client', audio: 'jegyzet.audio', csere_old: 'vazlat.csere_old', line_close: 'vazlat.line_close' };
  const SKETCH_BACK = Object.fromEntries(Object.entries(SKETCH_IDS).map(([k, v]) => [v, k]));
  const inOther = id => id === 'munkakor.implied' || isCam(id) || id in SKETCH_BACK;
  function fromStores(s) {
    const g = (s.general || []).filter(id => !inOther(id));
    return norm(g.concat((s.cameraOff || []).map(camera)).concat(s.implied ? ['munkakor.implied'] : []).concat((s.sketchOff || []).map(k => SKETCH_IDS[k]).filter(Boolean)));
  }
  function toStores(flipped) {
    return { cameraOff: norm(flipped.filter(isCam).map(id => id.slice(7))), implied: has(flipped, 'munkakor.implied'),
      general: norm(flipped.filter(id => !inOther(id))), sketchOff: norm(flipped.filter(id => id in SKETCH_BACK).map(id => SKETCH_BACK[id])) };
  }
  const cameraOff = flipped => CAMERA_IDS.filter(id => !on(flipped, camera(id)));

  return { DATA, FRONTS, ALL, CAMERA_IDS, SKETCH_IDS, of, inFront, tool, camera, own, on: (f, id) => on(f, id, 0), blockedBy, set, toggle,
    all, allOn, visibleFronts, rail, draw, mapHide, openFeature, openShown, OPEN_KINDS: Object.keys(OPEN), write, read, fromStores, toStores, cameraOff };
});
