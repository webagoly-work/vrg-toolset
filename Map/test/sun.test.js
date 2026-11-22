// lib/sun.js: the sun's position and day against published Budapest values, and the shadow geometry.
// Runs in the Europe/Budapest clock (the page uses the device's clock; the phones and the PC are in Hungary).
'use strict';
const assert = require('assert');
process.env.TZ = 'Europe/Budapest';
const S = require('../lib/sun.js');

const BP = [47.4979, 19.0402];
const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b} (±${tol})`);
const mins = d => d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;

module.exports = t => {
  t('sunrise and sunset in Budapest (timeanddate.com, ±2 min)', () => {
    // 21 Jun: 04:46 / 20:44 (CEST); 21 Dec: 07:29 / 15:55 (CET)
    const jun = S.times(new Date(2026, 5, 21, 12), ...BP), dec = S.times(new Date(2026, 11, 21, 12), ...BP);
    near(mins(jun.rise), 4 * 60 + 46, 2, 'June rise'); near(mins(jun.set), 20 * 60 + 44, 2, 'June set');
    near(mins(dec.rise), 7 * 60 + 29, 2, 'December rise'); near(mins(dec.set), 15 * 60 + 55, 2, 'December set');
    // the noon altitude: 90 - lat + declination
    near(jun.maxAltitude, 90 - BP[0] + 23.44, 0.3, 'June noon altitude');
    near(dec.maxAltitude, 90 - BP[0] - 23.44, 0.3, 'December noon altitude');
  });

  t('the position: south at solar noon, west in the evening, below the horizon at night', () => {
    const dec = S.times(new Date(2026, 11, 21, 12), ...BP);
    const noon = S.position(dec.noon, ...BP);
    near(noon.azimuth, 180, 1, 'noon azimuth');
    const eve = S.position(new Date(2026, 5, 21, 20, 0), ...BP);
    assert.ok(eve.azimuth > 280 && eve.azimuth < 310, 'June 20:00 in the west-north-west: ' + eve.azimuth);
    assert.ok(eve.altitude > 0 && eve.altitude < 8);
    assert.ok(S.position(new Date(2026, 5, 21, 1, 0), ...BP).altitude < -10);
  });

  t('a 10 m pole at 45° casts 10 m, away from the sun', () => {
    const sun = { azimuth: 180, altitude: 45 };      // sun in the south: shadow to the north
    const [dLon, dLat] = S.offset(sun, 10, BP[0]);
    near(dLon, 0, 1e-9, 'no east-west'); near(dLat * 110574, 10, 0.01, 'metres north');
    const w = S.offset({ azimuth: 270, altitude: 45 }, 10, BP[0]);   // sun in the west: shadow to the east
    near(w[0] * 111320 * Math.cos(BP[0] * Math.PI / 180), 10, 0.01, 'metres east'); near(w[1], 0, 1e-9, 'no north-south');
    assert.strictEqual(S.offset({ azimuth: 180, altitude: -2 }, 10, BP[0]), null, 'no sun, no shadow');
    // near the horizon the shadow is capped
    const low = S.offset({ azimuth: 270, altitude: 0.6 }, 50, BP[0]);
    near(Math.hypot(low[0] * 111320 * Math.cos(BP[0] * Math.PI / 180), low[1] * 110574), S.MAX_LEN, 0.5, 'capped');
  });

  t('the shadow of a box: the roof moved, plus one sweep per edge; a raised part starts at its base', () => {
    const d = 0.0001;   // ~7.5 x 11 m
    const box = [[[19, 47.5], [19 + d, 47.5], [19 + d, 47.5 + d], [19, 47.5 + d], [19, 47.5]]];
    const sun = { azimuth: 225, altitude: 30 };      // south-west: the shadow runs north-east
    const parts = S.shadow([box], 12, 0, sun, 47.5);
    assert.strictEqual(parts.length, 1 + 4, 'the moved roof and four edge sweeps');
    const roof = parts[0][0];
    assert.ok(roof[0][0] > 19 && roof[0][1] > 47.5, 'moved north-east');
    const raised = S.shadow([box], 12, 4, sun, 47.5);
    assert.strictEqual(raised.length, 2 + 4, 'both ends and the sweeps');
    assert.deepStrictEqual(S.shadow([box], 12, 0, { azimuth: 225, altitude: -1 }, 47.5), [], 'night');
    assert.deepStrictEqual(S.shadow([box], 0, 0, sun, 47.5), [], 'no height');
    // an edge along the sun's direction sweeps no area and is left out
    const along = S.shadow([box], 12, 0, { azimuth: 180, altitude: 30 }, 47.5);
    assert.strictEqual(along.length, 1 + 2, 'the two north-south edges sweep nothing');
  });

  t('a courtyard: the hole moves with the roof and its walls shade it', () => {
    const o = [[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]].map(p => [19 + p[0] * 1e-4, 47.5 + p[1] * 1e-4]);
    const h = [[1, 1], [1, 3], [3, 3], [3, 1], [1, 1]].map(p => [19 + p[0] * 1e-4, 47.5 + p[1] * 1e-4]);
    const parts = S.shadow([[o, h]], 20, 0, { azimuth: 200, altitude: 35 }, 47.5);
    assert.strictEqual(parts[0].length, 2, 'the moved roof keeps its hole');
    assert.strictEqual(parts.length, 1 + 4 + 4, 'outer and courtyard walls');
  });

  t('compass words', () => {
    assert.deepStrictEqual([0, 45, 90, 135, 180, 225, 270, 315, 359].map(S.compass), ['É', 'ÉK', 'K', 'DK', 'D', 'DNy', 'Ny', 'ÉNy', 'É']);
  });
};
