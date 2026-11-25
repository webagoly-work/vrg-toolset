// lib/feed.js (the Térkép-feed's rules) and tools/build-pois.js on a .pbf written by test/pbf-writer.js.
// Invented places only.
'use strict';
const assert = require('assert');
const fs = require('fs'), os = require('os'), path = require('path');
const F = require('../lib/feed.js');
const { buildPois } = require('../tools/build-pois.js');
const { writePbf } = require('./pbf-writer.js');

const ids = list => list.map(c => c.id);

module.exports = t => {
  t('the categories: the six defaults in the user\'s order, nine in all', () => {
    assert.deepStrictEqual(F.defaults(), ['otthon', 'daniella', 'szereles', 'bolt', 'etkezes', 'orvos']);
    assert.deepStrictEqual(ids(F.CATEGORIES).slice(6), ['kinai', 'wc', 'megallo']);
    assert.strictEqual(F.MAX_ON, 6);
  });

  t('classify: OSM tags to feed categories', () => {
    const c = F.classify;
    assert.strictEqual(c({ shop: 'electrical', name: 'Daniella Villamossági Kereskedés' }), 'daniella');
    assert.strictEqual(c({ shop: 'trade', brand: 'Daniella' }), 'daniella');
    assert.strictEqual(c({ shop: 'electrical', name: 'Villanyker Kft.' }), 'szereles');
    assert.strictEqual(c({ shop: 'doityourself', name: 'OBI' }), 'szereles');
    assert.strictEqual(c({ shop: 'hardware' }), 'szereles');
    assert.strictEqual(c({ shop: 'variety_store', name: 'Ázsia bolt' }), 'kinai');
    assert.strictEqual(c({ shop: 'supermarket', brand: 'Aldi' }), 'bolt');
    assert.strictEqual(c({ shop: 'convenience', name: 'CBA' }), 'bolt');
    assert.strictEqual(c({ amenity: 'fast_food', name: 'Lángos büfé' }), 'etkezes');
    assert.strictEqual(c({ amenity: 'restaurant' }), 'etkezes');
    assert.strictEqual(c({ amenity: 'cafe' }), null, 'a café is not a lunch place');
    assert.strictEqual(c({ amenity: 'hospital', name: 'Szent János Kórház' }), 'orvos');
    assert.strictEqual(c({ healthcare: 'clinic' }), 'orvos');
    assert.strictEqual(c({ amenity: 'toilets' }), 'wc');
    assert.strictEqual(c({ amenity: 'toilets', access: 'customers' }), null, 'not public');
    assert.strictEqual(c({ highway: 'bus_stop', name: 'Fő tér' }), 'megallo');
    assert.strictEqual(c({ railway: 'tram_stop' }), 'megallo');
    assert.strictEqual(c({ building: 'yes' }), null);
    assert.strictEqual(c(null), null);
  });

  t('toggling categories keeps the order and at most six', () => {
    let cats = F.defaults();
    assert.deepStrictEqual(F.toggleCat(cats, 'wc'), cats, 'a seventh is refused');
    cats = F.toggleCat(cats, 'bolt');
    assert.ok(!cats.includes('bolt'));
    cats = F.toggleCat(cats, 'megallo');
    assert.deepStrictEqual(cats, ['otthon', 'daniella', 'szereles', 'etkezes', 'orvos', 'megallo']);
  });

  t('distance and ETA', () => {
    const d = F.distance(19.0402, 47.4979, 19.0402, 47.5079);   // 0.01° north
    assert.ok(Math.abs(d - 1112) < 3, 'about 1112 m: ' + d);
    assert.ok(Math.abs(F.eta(1000, 'gyalog') - 1000 * 1.25 / 80) < 0.01);   // 4.8 km/h = 80 m/min
    assert.ok(F.eta(5000, 'auto') > F.eta(5000, 'auto') - 1 && F.eta(5000, 'auto') < F.eta(5000, 'gyalog'));
    assert.strictEqual(F.fmtEta(0.4), '<1 perc');
    assert.strictEqual(F.fmtEta(7.4), '~7 perc');
    assert.strictEqual(F.fmtEta(65), '~1 ó 05 p');
    assert.strictEqual(F.fmtDist(234), '230 m');
    assert.strictEqual(F.fmtDist(1234), '1,2 km');
    assert.strictEqual(F.fmtDist(23400), '23 km');
  });

  t('build-pois on a small OSM file: nodes, a shop drawn as a building, duplicates, outside Hungary', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vrg-pois-'));
    const file = path.join(dir, 'tiny.osm.pbf');
    const nodes = [
      { id: 1, lon: 19.05, lat: 47.50, tags: { shop: 'supermarket', name: 'Aldi', brand: 'Aldi' } },
      { id: 2, lon: 19.06, lat: 47.51, tags: { highway: 'bus_stop', name: 'Fő tér' } },
      { id: 3, lon: 19.06015, lat: 47.51005, tags: { highway: 'bus_stop', name: 'Fő tér' } },   // the other side, 13 m
      { id: 4, lon: 19.07, lat: 47.52, tags: { amenity: 'hospital', name: 'Próba Kórház' } },
      { id: 5, lon: 14.42, lat: 50.08, tags: { shop: 'supermarket', name: 'Praha Trh' } },      // Prague: outside the box
      { id: 6, lon: 19.10, lat: 47.40, tags: { amenity: 'cafe', name: 'Kávé' } },                // not a category
      // an untagged square: the corners of the Daniella building
      { id: 10, lon: 19.1000, lat: 47.4500 }, { id: 11, lon: 19.1010, lat: 47.4500 },
      { id: 12, lon: 19.1010, lat: 47.4510 }, { id: 13, lon: 19.1000, lat: 47.4510 },
    ];
    const ways = [{ id: 100, refs: [10, 11, 12, 13, 10], tags: { building: 'retail', shop: 'electrical', name: 'Daniella Próba' } },
      { id: 101, refs: [10, 11], tags: { highway: 'residential', name: 'Próba utca' } }];
    writePbf(file, { nodes, ways });
    const out = buildPois(file);
    assert.deepStrictEqual(out.counts, { bolt: 1, megallo: 1, orvos: 1, daniella: 1 });
    const d = out.cats.daniella[0];
    assert.strictEqual(out.s[d[2]], 'Daniella Próba');
    assert.deepStrictEqual([d[0], d[1]], [1910050, 4745050], 'the mean of the four corners');
    // and the page's decoder reads it
    const idx = F.index(out);
    const n = F.nearest(idx, 'bolt', 19.0, 47.5);
    assert.strictEqual(n.name, 'Aldi'); assert.strictEqual(n.kind, 'szupermarket');
    assert.ok(Math.abs(n.dist - F.distance(19.0, 47.5, 19.05, 47.5)) < 1);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  t('the feed: one item per enabled category, own pins win when nearer, Otthon only from pins', () => {
    const idx = F.index({ s: ['', 'Daniella Távoli', 'electrical', 'Közeli Aldi', 'supermarket'],
      cats: { daniella: [[1910000, 4760000, 1, 2]], bolt: [[1904100, 4749800, 3, 4]] } });
    const pins = [{ cat: 'otthon', lon: 19.2, lat: 47.6, name: 'Otthon' }, { cat: 'daniella', lon: 19.05, lat: 47.51, name: 'Daniella (saját)' }];
    const it = F.items(idx, pins, ['otthon', 'daniella', 'bolt', 'wc'], 19.0402, 47.4979, 'auto');
    assert.deepStrictEqual(it.map(i => i.cat), ['otthon', 'daniella', 'bolt', 'wc']);
    assert.strictEqual(it[0].name, 'Otthon'); assert.ok(it[0].own);
    assert.strictEqual(it[1].name, 'Daniella (saját)', 'the own pin is nearer than OSM\'s');
    assert.strictEqual(it[2].name, 'Közeli Aldi');
    assert.ok(it[2].dist < 100 && it[2].eta > 0);
    assert.ok(it[3].missing, 'no WC in the data: shown as missing');
    assert.ok(F.items(idx, [], ['otthon'], 19, 47.5)[0].missing, 'no home set yet');
  });
};
