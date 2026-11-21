// traffic.js — the optional traffic check of the VRG Térkép (WP M57, N3, D-130 B): one TomTom Routing request
// for the chosen car route, on the user's tap, with the user's own key. Shared by the page and the tests.
//
//   const T = require('./traffic.js')        // Node
//   window.VRGTraffic                         // browser, after <script src="/lib/traffic.js">
//
//   T.url(key, from, to)        the request (TomTom Routing API v1 calculateRoute, traffic=true)
//   T.parse(json)               -> { seconds, delay, meters, freeFlow } | null
//   T.problem(status)           a Hungarian sentence for an HTTP error
//   T.label(r, ourSeconds)      "Forgalommal ~14 perc (+4 perc dugó)"
//
// What leaves the device, and only then: the position and the destination as coordinates, and the key, to
// api.tomtom.com. Never on its own, never for walking, never for the list of places. The key lives in the
// browser's storage on that device (on the phone: the phone). TomTom's Freemium plan has 2 500 such requests a
// day; their docs disagree on whether the v1 endpoint is in it, so the first real use is the check (WP M57).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VRGTraffic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const HOST = 'api.tomtom.com';
  const KEY = /^[A-Za-z0-9_-]{16,64}$/;

  function url(key, from, to) {
    if (!KEY.test(key || '')) return null;
    const p = o => o.lat.toFixed(6) + ',' + o.lon.toFixed(6);
    return `https://${HOST}/routing/1/calculateRoute/${p(from)}:${p(to)}/json?key=${encodeURIComponent(key)}` +
      '&traffic=true&travelMode=car&routeType=fastest&computeTravelTimeFor=all&routeRepresentation=summaryOnly';
  }

  function parse(j) {
    const s = j && j.routes && j.routes[0] && j.routes[0].summary;
    if (!s || !(s.travelTimeInSeconds >= 0)) return null;
    const delay = s.trafficDelayInSeconds >= 0 ? s.trafficDelayInSeconds : 0;
    const free = s.noTrafficTravelTimeInSeconds >= 0 ? s.noTrafficTravelTimeInSeconds : s.travelTimeInSeconds - delay;
    return { seconds: s.travelTimeInSeconds, delay, meters: s.lengthInMeters || 0, freeFlow: free };
  }

  function problem(status) {
    if (status === 401 || status === 403) return 'A TomTom nem fogadta el a kulcsot (vagy ez a szolgáltatás nincs benne a csomagodban).';
    if (status === 429) return 'Elfogyott a mai TomTom-keret (2 500 kérés naponta).';
    if (status === 400) return 'A TomTom nem tud útvonalat ide.';
    return 'A forgalmi adat most nem érhető el (HTTP ' + status + ').';
  }

  const min = s => Math.max(1, Math.round(s / 60));
  function label(r, ours) {
    if (!r) return '';
    const jam = r.delay >= 60 ? ` (+${min(r.delay)} perc dugó)` : ' (nincs dugó)';
    const vs = ours > 0 ? ` · saját becslés ~${min(ours)} perc` : '';
    return `Forgalommal ~${min(r.seconds)} perc${jam}${vs}`;
  }

  return { HOST, url, parse, problem, label };
});
