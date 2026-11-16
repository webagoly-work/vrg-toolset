#!/usr/bin/env node
// Writes Map/test/fixtures/jobs/_elozmenyek/helyek.json: 30 INVENTED jobs (codes T01..T30, made-up
// labels, random points around Budapest) for the browser checks: VRG_JOBS_DIR=Map/test/fixtures/jobs.
'use strict';
const fs = require('fs'), path = require('path');
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const ST = ['folyamatban', 'befejezett', 'befejezett', 'befejezett', 'meghiúsult'];
const PR = ['cím', 'cím', 'cím', 'legközelebbi', 'utca', 'település'];
const NAMES = ['Próba lakás', 'Minta családi ház', 'Teszt iroda', 'Kitalált csarnok', 'Képzelt panel', 'Álom nyaraló'];
const jobs = [];
for (let i = 1; i <= 30; i++) {
  const far = i % 7 === 0;
  const lon = far ? 18.6 + rnd() * 1.6 : 18.95 + rnd() * 0.25, lat = far ? 47.0 + rnd() * 0.9 : 47.42 + rnd() * 0.16;
  const y = 2024 + Math.floor(rnd() * 3), m = 1 + Math.floor(rnd() * 12), d = 1 + Math.floor(rnd() * 27);
  const from = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const to = new Date(Date.parse(from) + Math.floor(rnd() * 90) * 864e5).toISOString().slice(0, 10);
  const code = 'T' + String(i).padStart(2, '0');
  const j = { code, kind: i % 5 === 0 ? 'kit' : 'elozmeny', status: ST[i % ST.length], from, to, label: NAMES[i % NAMES.length] + ' ' + i,
    lon: +lon.toFixed(5), lat: +lat.toFixed(5), prec: PR[i % PR.length], source: i % 5 === 0 ? 'kit:decisions' : 'helyszinek', vazlat: i % 3 === 0 };
  j.area = far ? ['Képzeletfalva', 'Mintaváros', 'Próbahegy'][i % 3] : 'Budapest ' + ['V', 'VI', 'XI', 'XIII', 'XIV'][i % 5] + '. ker.';
  if (i % 4 === 0) j.total = 100000 + Math.round(rnd() * 2e6 / 1000) * 1000, j.totalDate = to;
  if (i % 9 === 0) j.bizonytalan = true;
  if (i === 2) j.related = ['T03'];
  if (i === 3) j.related = ['T02'];
  jobs.push(j);
}
jobs.push({ code: 'T31', kind: 'elozmeny', status: 'befejezett', from: '2025-02-02', to: '2025-02-03', label: 'Hely nélküli teszt', lon: null, lat: null, prec: 'nincs', source: null, vazlat: true });
const out = path.join(__dirname, 'fixtures', 'jobs', '_elozmenyek');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'helyek.json'), JSON.stringify({ _leiras: 'KITALÁLT tesztadat (Map/test/make-fixture-jobs.js)', built: '2026-01-01T00:00:00Z', count: jobs.length, jobs }, null, 1) + '\n');
console.log('wrote ' + jobs.length + ' invented jobs');
