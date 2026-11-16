// MJ-02: tools/build-jobs.js on a throwaway jobs folder with invented jobs.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const G = require('../lib/geocode.js');
const F = require('./fixtures.js');
const B = require('../tools/build-jobs.js');

module.exports = async function (t) {
  const jobs = F.jobsDir();
  const idx = G.buildIndex(F.addresses());
  try {
    const { rows, warn } = B.build({ jobs, index: idx });
    const by = Object.fromEntries(rows.map(r => [r.code, r]));
    t('every code from the register, the kit and helyszinek', () => assert.deepEqual(rows.map(r => r.code), ['TA1', 'TB2', 'TC1', 'TD1', 'TE1', 'TF1']));
    t('register: status, period, folder label', () => {
      assert.equal(by.TA1.status, 'folyamatban'); assert.equal(by.TA1.from, '2026-01-02'); assert.equal(by.TA1.to, '2026-02-03');
      assert.equal(by.TA1.label, 'Kalapács 12 - teszt'); assert.equal(by.TD1.status, 'meghiúsult'); assert.equal(by.TA1.kind, 'elozmeny');
    });
    t('drafted address: geocoded offline, marked vazlat', () => {
      assert.equal(by.TA1.prec, 'cím'); assert.equal(by.TA1.vazlat, true); assert.equal(by.TA1.source, 'helyszinek');
      assert.ok(Math.abs(by.TA1.lon - 19.0512) < 1e-4 && Math.abs(by.TA1.lat - 47.5) < 1e-4);
    });
    t('Workflow Kit job: the funnel address, kind kit, not a draft', () => {
      assert.equal(by.TB2.kind, 'kit'); assert.equal(by.TB2.source, 'kit:decisions'); assert.equal(by.TB2.prec, 'cím'); assert.equal(by.TB2.vazlat, false);
      assert.equal(by.TB2.status, 'folyamatban'); assert.ok(by.TB2.from);
    });
    t('area: the Budapest district or the settlement, nothing finer', () => {
      assert.equal(by.TA1.area, 'Budapest V. ker.'); assert.equal(by.TB2.area, 'Budapest VIII. ker.'); assert.equal(by.TC1.area, 'Mintaváros');
      assert.equal(by.TD1.area, undefined);
    });
    t('related codes from "X előzménye", both ways', () => { assert.deepEqual(by.TA1.related, ['TB2']); assert.deepEqual(by.TB2.related, ['TA1']); });
    t('total: the latest file, duplicate rows counted once', () => { assert.equal(by.TA1.total, 150000); assert.equal(by.TA1.totalDate, '2026-02-03'); });
    t('confirmed row: vazlat false; street precision', () => { assert.equal(by.TC1.vazlat, false); assert.equal(by.TC1.prec, 'utca'); });
    t('not found: precision nincs, a warning', () => {
      assert.equal(by.TD1.prec, 'nincs'); assert.equal(by.TD1.lon, null); assert.equal(by.TD1.bizonytalan, true);
      assert.ok(warn.some(w => /^TD1: address not found/.test(w)));
    });
    t('manual lat+lon wins, its own precision', () => { assert.equal(by.TE1.source, 'kézi'); assert.equal(by.TE1.prec, 'utca'); assert.equal(by.TE1.lat, 47.4); });
    t('a row without address: listed, nincs, still a draft', () => { assert.equal(by.TF1.prec, 'nincs'); assert.equal(by.TF1.vazlat, true); });
    t('no written address in any row', () => {
      const txt = JSON.stringify(rows);
      assert.ok(!/Kalapács utca 12|Rézcsillag körút|Fő utca 8|Sehol utca/.test(txt), txt);
    });

    // the CLI end to end, writing into the fixture folder (offline: the fixture index)
    const data = fs.mkdtempSync(path.join(require('os').tmpdir(), 'vrg-map-data-'));
    fs.writeFileSync(path.join(data, 'addresses.json'), JSON.stringify(F.addresses()));
    const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'tools', 'build-jobs.js'), '--jobs=' + jobs, '--data=' + data], { encoding: 'utf8' });
    t('CLI writes helyek.json, ASCII console, codes not addresses', () => {
      assert.equal(r.status, 0, r.stderr);
      assert.ok(/^[\x00-\x7f]*$/.test(r.stdout), 'console output is ASCII');
      assert.ok(!/Kalapacs utca|Rezcsillag/i.test(r.stdout));
      const doc = JSON.parse(fs.readFileSync(path.join(jobs, '_elozmenyek', 'helyek.json'), 'utf8'));
      assert.equal(doc.count, 6); assert.equal(doc.index, '2026-01-01');
    });
    const c = spawnSync(process.execPath, [path.join(__dirname, '..', 'tools', 'build-jobs.js'), '--jobs=' + jobs, '--data=' + data, '--check', '--out=' + path.join(jobs, 'x.json')], { encoding: 'utf8' });
    t('--check writes nothing', () => { assert.equal(c.status, 0); assert.ok(!fs.existsSync(path.join(jobs, 'x.json'))); });
    F.rmrf(data);
  } finally { F.rmrf(jobs); }
};
