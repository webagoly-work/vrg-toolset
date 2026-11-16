// MJ-01: the shared offline geocoder (lib/geocode.js), on invented addresses only.
'use strict';
const assert = require('assert');
const G = require('../lib/geocode.js');
const F = require('./fixtures.js');

module.exports = async function (t) {
  const idx = G.buildIndex(F.addresses());

  t('index counts streets, addresses, places', () => {
    assert.equal(idx.streets.length, 6); assert.equal(idx.count, 9); assert.equal(idx.places.length, 3);
  });
  t('words(): accents folded, abbreviations expanded', () => {
    assert.deepEqual(G.words('Kalapács u. 12'), ['kalapacs', 'utca', '12']);
    assert.deepEqual(G.words('Rézcsillag krt.'), ['rezcsillag', 'korut']);
  });
  t('parseQuery: postcode first, house number, district', () => {
    assert.deepEqual(G.parseQuery('1051 Kalapács u. 12'), { hn: '12', pc: '1051', district: null, rest: ['kalapacs', 'utca'] });
    assert.equal(G.parseQuery('Budapest V. ker. Kalapács utca 14').district, 5);
    assert.equal(G.parseQuery('Rézcsillag körút 40/b').hn, '40/b');
  });
  t('search: the exact house number', () => {
    const r = G.search(idx, 'Kalapács utca 12');
    assert.equal(r[0].kind, 'cím'); assert.equal(r[0].prec, 'cím'); assert.equal(r[0].title, 'Kalapács utca 12');
    assert.equal(r[0].sub, '1051 Budapest V. ker.');
  });
  t('search: the nearest house number on the same side', () => {
    const r = G.search(idx, 'Kalapacs u 9');
    assert.equal(r[0].prec, 'legközelebbi'); assert.equal(r[0].title, 'Kalapács utca 7 (legközelebbi)');
  });
  t('search: the district picks the postcode', () => {
    assert.equal(G.search(idx, 'Budapest VI. ker. Kalapács utca 14')[0].sub, '1061 Budapest VI. ker.');
    assert.equal(G.search(idx, 'Budapest V. ker. Kalapács utca 14')[0].prec, 'legközelebbi');
  });
  t('search: a street without numbers, a place', () => {
    const r = G.search(idx, 'Fő utca Mintaváros');
    assert.equal(r[0].prec, 'utca'); assert.equal(r[0].sub, 'Mintaváros');
    const p = G.search(idx, 'kepzeletfalva');
    assert.ok(p.some(x => x.prec === 'település' && x.title === 'Képzeletfalva'));
  });
  t('search: nothing for a missing index or empty words', () => {
    assert.deepEqual(G.search(null, 'x'), []); assert.deepEqual(G.search(idx, '12'), []);
  });
  t('jobQuery strips floor, door and placeholder dots', () => {
    assert.equal(G.jobQuery('Budapest, 1051 Kalapács utca 12., 3. em. 4.').query, '1051 Kalapács utca 12 Budapest');
    assert.equal(G.jobQuery('Budapest, …… Rézcsillag körút 40/b., felső emeleti lakás').query, 'Rézcsillag körút 40/b Budapest');
    assert.equal(G.jobQuery('Mintaváros, Fő utca 8., 2999').query, '2999 Fő utca 8 Mintaváros');
    assert.equal(G.jobQuery('1086., Budapest Rézcsillag körút 40/b fszt.').query, '1086 Rézcsillag körút 40/b Budapest');
    assert.equal(G.jobQuery('Budapest, VIII. ker., Rézcsillag krt. 40/b').district, 'VIII. ker.');
    assert.equal(G.jobQuery('Képzeletfalva').query, 'Képzeletfalva');
  });
  t('geocodeJob: precision from house number down to settlement', () => {
    assert.equal(G.geocodeJob(idx, 'Budapest, 1051 Kalapács utca 12., 3. em. 4.').prec, 'cím');
    assert.equal(G.geocodeJob(idx, 'Budapest, …… Rézcsillag körút 40/b., felső emeleti lakás').prec, 'cím');
    assert.equal(G.geocodeJob(idx, 'Budapest, 1051 Kalapács utca 9.').prec, 'legközelebbi');
    const fo = G.geocodeJob(idx, 'Mintaváros, Fő utca 8., 2999');
    assert.equal(fo.prec, 'utca'); assert.equal(fo.sub, 'Mintaváros');            // not the Fő utca of Képzeletfalva
    assert.equal(G.geocodeJob(idx, 'Képzeletfalva').prec, 'település');
    assert.equal(G.geocodeJob(idx, '9999 Ismeretlenfalu, Sehol utca 1.'), null);
  });
  t('geocodeJob: a wrong postcode does not lose the house number', () => {
    assert.equal(G.geocodeJob(idx, '1999 Budapest, Kalapács utca 12.').prec, 'cím');
  });
  t('geocodeJob: a border street filed under the neighbour is kept and flagged', () => {
    const r = G.geocodeJob(idx, '1999 Budapest, Próbaút köz 3.');
    assert.equal(r.prec, 'utca'); assert.equal(r.otherCity, 'Képzeletfalva');
  });
};
