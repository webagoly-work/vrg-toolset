// Invented places only: no street, house number or job here is real. Shared by the Map tests.
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

/** an addresses.json in the shape tools/build-addresses.js writes */
function addresses() {
  const s = ['Budapest', 'Képzeletfalva', 'Mintaváros', 'Kalapács utca', 'Rézcsillag körút', 'Próbaút köz', 'Fő utca', 'Szivárvány sétány'];
  const I = n => s.indexOf(n);
  const P = (lon, lat) => [Math.round(lon * 1e5), Math.round(lat * 1e5)];
  const streets = [
    [I('Kalapács utca'), I('Budapest'), ...P(19.05, 47.50)],
    [I('Rézcsillag körút'), I('Budapest'), ...P(19.07, 47.49)],
    [I('Próbaút köz'), I('Képzeletfalva'), ...P(19.00, 47.58)],      // a border street: Budapest postcode, filed under the village
    [I('Fő utca'), I('Képzeletfalva'), ...P(19.01, 47.60)],
    [I('Fő utca'), I('Mintaváros'), ...P(19.30, 47.30)],
    [I('Szivárvány sétány'), I('Mintaváros'), ...P(19.31, 47.31)],
  ];
  const addr = [];
  const kal = [['1', 0.0001], ['2', 0.0002], ['3', 0.0003], ['5', 0.0005], ['7', 0.0007], ['12', 0.0012], ['14', 0.0014]];
  for (const [hn, d] of kal) addr.push([I('Budapest'), I('Kalapács utca'), hn, hn === '14' ? '1061' : '1051', ...P(19.05 + d, 47.50)]);
  addr.push([I('Budapest'), I('Rézcsillag körút'), '40/b', '1086', ...P(19.0704, 47.49)]);
  addr.push([I('Mintaváros'), I('Szivárvány sétány'), '6', '2999', ...P(19.3106, 47.31)]);
  const places = [
    ['Budapest', 'city', ...P(19.04, 47.498)],
    ['Képzeletfalva', 'village', ...P(19.005, 47.59)],
    ['Mintaváros', 'town', ...P(19.30, 47.305)],
  ];
  return { built: '2026-01-01', s, streets, addr, places };
}

/** a throwaway jobs folder: register, totals, drafted addresses, one Workflow Kit job */
function jobsDir() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vrg-map-jobs-'));
  const hist = path.join(root, '_elozmenyek');
  fs.mkdirSync(hist, { recursive: true });
  fs.writeFileSync(path.join(hist, 'REGISZTER.md'), [
    '# Korábbi munkák regisztere (teszt)', '',
    '| Kód | Állapot | Mappa | Idősáv | Fájl | MB | Megjegyzés |',
    '|---|---|---|---|---:|---:|---|',
    '| [TA1](TA1/JOB.md) | folyamatban | Kalapács 12 - teszt | 2026-01-02 … 2026-02-03 | 3 | 1 | TB2 előzménye |',
    '| [TC1](TC1/JOB.md) | befejezett | Mintaváros Fő utca | 2025-05-01 … 2025-06-01 | 2 | 0 |  |',
    '| [TD1](TD1/JOB.md) | meghiúsult | Sehol sincs | 2025-01-01 … 2025-01-05 | 1 | 0 |  |',
    '| [TE1](TE1/JOB.md) | befejezett | Kézi pont | 2025-03-01 … 2025-03-01 | 1 | 0 |  |',
  ].join('\n') + '\n');
  fs.writeFileSync(path.join(hist, 'osszegek.csv'), '﻿date;stage;job;kind;amount;file\n' + [
    '"2026-02-01";"x";"Kalapács 12 - teszt";"Munkadíj";"100000";"a.xlsx"',
    '"2026-02-01";"x";"Kalapács 12 - teszt";"Anyagköltség";"50000";"a.xlsx"',
    '"2026-02-03";"x";"Kalapács 12 - teszt";"Munkadíj";"120000";"b.xlsx"',
    '"2026-02-03";"x";"Kalapács 12 - teszt";"Munkadíj";"120000";"b.xlsx"',
    '"2026-02-03";"x";"Kalapács 12 - teszt";"Anyagköltség";"30000";"b.xlsx"',
  ].join('\n') + '\n');
  fs.writeFileSync(path.join(hist, 'helyszinek.json'), JSON.stringify({ jobs: {
    TA1: { address: 'Budapest, 1051 Kalapács utca 12., 3. em. 4.', vazlat: true },
    TC1: { address: 'Mintaváros, Fő utca 8., 2999', vazlat: false },
    TD1: { address: '9999 Ismeretlenfalu, Sehol utca 1.', vazlat: true, bizonytalan: true },
    TE1: { lat: 47.4, lon: 19.2, pontossag: 'utca', vazlat: true },
    TF1: { vazlat: true, bizonytalan: true },
  } }, null, 1));
  const kit = path.join(root, 'TB2_koltsegvetesi_tervezet', 'job', 'funnel');
  fs.mkdirSync(kit, { recursive: true });
  fs.writeFileSync(path.join(kit, 'decisions.json'), JSON.stringify({ address: 'Budapest, …… Rézcsillag körút 40/b., felső emeleti lakás' }));
  return root;
}

function rmrf(dir) { fs.rmSync(dir, { recursive: true, force: true }); }

module.exports = { addresses, jobsDir, rmrf };
