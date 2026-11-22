// lib/traffic.js: the TomTom request (only with a key that looks like one), reading its answer, the messages.
'use strict';
const assert = require('assert');
const T = require('../lib/traffic.js');

module.exports = t => {
  t('the request: coordinates and the key only, car, traffic on, summary only', () => {
    const u = T.url('abcDEF0123456789xyz', { lon: 19.0402, lat: 47.4979 }, { lon: 19.06, lat: 47.51 });
    assert.strictEqual(u, 'https://api.tomtom.com/routing/1/calculateRoute/47.497900,19.040200:47.510000,19.060000/json?key=abcDEF0123456789xyz' +
      '&traffic=true&travelMode=car&routeType=fastest&computeTravelTimeFor=all&routeRepresentation=summaryOnly');
    assert.strictEqual(T.url('', { lon: 19, lat: 47 }, { lon: 19, lat: 47 }), null, 'no key, no request');
    assert.strictEqual(T.url('bad key!', { lon: 19, lat: 47 }, { lon: 19, lat: 47 }), null);
  });

  t('the answer: time with traffic, the delay, free flow', () => {
    const v = T.parse({ routes: [{ summary: { lengthInMeters: 5400, travelTimeInSeconds: 840, trafficDelayInSeconds: 240, noTrafficTravelTimeInSeconds: 600 } }] });
    assert.deepStrictEqual(v, { seconds: 840, delay: 240, meters: 5400, freeFlow: 600 });
    assert.strictEqual(T.label(v, 660), 'Forgalommal ~14 perc (+4 perc dugó) · saját becslés ~11 perc');
    assert.strictEqual(T.label({ seconds: 300, delay: 0 }, 0), 'Forgalommal ~5 perc (nincs dugó)');
    assert.strictEqual(T.parse({ routes: [] }), null);
    assert.strictEqual(T.parse(null), null);
  });

  t('errors in Hungarian', () => {
    assert.ok(/kulcsot/.test(T.problem(403)));
    assert.ok(/2 500/.test(T.problem(429)));
    assert.ok(/HTTP 500/.test(T.problem(500)));
  });
};
