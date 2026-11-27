// VRG Stack — the page contract lint (S7, research/STRINGS-PLAN.md §3.1). Run:  node --test test/pages.test.js
// Every layer page: renders only from its generated data file, which carries the build stamp; holds no literal node id
// and no data of its own; loads lib/live.js and signs the contract (window.STACK_PAGE) with its layer; reports its
// selection to the bus. A new layer page is added to PAGES and has to pass the same checks.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PAGES = [
  // page, layer, its data file and global, the module that writes it
  ['lineage.html', 'I', 'out/lineage-data.js', 'LINEAGE', 'lib/lineage.js'],
  ['decisions.html', 'Q', 'out/decisions-data.js', 'DECISIONS', 'lib/decisions.js'],
  ['metro.html', 'L', 'out/metro-data.js', 'METRO', 'lib/metro.js'],
  ['control.html', 'A', 'out/control-data.js', 'CONTROL', 'lib/control.js'],
  ['runs.html', 'U', 'out/runs-data.js', 'RUNS', 'lib/runs.js'],
  ['commits.html', 'R', 'out/commits-data.js', 'COMMITS', 'lib/commitpixel.js'],
  ['board.html', 'E', 'out/board-data.js', 'BOARD', 'lib/board.js'],
  ['jelzesek.html', 'J', 'out/signals-data.js', 'SIGNALS', 'lib/signalboard.js'],
  ['szereplok.html', 'W', 'out/people-data.js', 'PEOPLE', 'lib/peoplepage.js'],
  ['kerdesek.html', 'K', 'out/asks-data.js', 'ASKS', 'lib/layerpages.js'],
  ['munkak.html', 'M', 'out/jobs-data.js', 'JOBS', 'lib/layerpages.js'],
  ['eszkozok.html', 'D', 'out/bench-data.js', 'BENCH', 'lib/layerpages.js'],
  ['latvany.html', 'V', 'out/wardrobe-data.js', 'WARDROBE', 'lib/layerpages.js'],
  ['kulso.html', 'O', 'out/ledger-data.js', 'LEDGER', 'lib/layerpages.js'],
  ['probak.html', 'P', 'out/testwall-data.js', 'TESTWALL', 'lib/layerpages.js'],
];
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
// a whole node id in quotes: 'E:planner', "L:views", `Q:VIS-Q5` (a prefix such as 'U:run.' or 'A:agent.' is fine)
const NODE_ID = /['"`]([WFVMNKITQLAUPRCDOGJEZ]):([A-Za-z0-9][\w.\-/]*[A-Za-z0-9])['"`]/g;

for (const [page, layer, data, global, mod] of PAGES) {
  test(`${page}: data from ${data} only, with the build stamp`, () => {
    const html = read(page);
    assert.ok(html.includes(`<script src="${data}"></script>`), 'loads its generated data file');
    assert.ok(!new RegExp(`window\\.${global}\\s*=`).test(html), 'never sets its data global itself');
    const src = read(mod);
    assert.ok(new RegExp(`window\\.${global} = `).test(src), `${mod} writes window.${global}`);
    assert.ok(/build: \(graph && graph\.build\) \|\| null, schema: \(graph && graph\.schema\) \|\| null/.test(src), `${mod} puts the build stamp and schema into the data`);
  });
  test(`${page}: no literal node ids, no hand data`, () => {
    const html = read(page), ids = [...html.matchAll(NODE_ID)].map(m => m[0]);
    assert.deepEqual(ids, [], 'node ids belong in the data, not in the page');
    // hand data: a long literal list of records in the page (more than 12 object literals in one array)
    const big = [...html.matchAll(/=\s*\[\s*(\{[^\]]*?\}\s*,\s*){12,}/g)].map(m => m[0].slice(0, 60));
    assert.deepEqual(big, [], 'records belong in the data file');
  });
  test(`${page}: signs the contract as layer ${layer} and reports its selection`, () => {
    const html = read(page);
    assert.ok(html.includes('<script src="lib/live.js"></script>'), 'loads lib/live.js');
    const c = /StackLive\.contract\(\{\s*layer: '([A-Z])', data: (\w+),\s*items: /.exec(html);
    assert.ok(c, 'calls StackLive.contract({ layer, data, items, … })');
    assert.equal(c[1], layer);
    assert.ok(/select: /.test(html.slice(c.index)) && /getSelection: /.test(html.slice(c.index)), 'with select and getSelection');
    assert.ok(/StackLive\.selected\(/.test(html), 'tells the bus when the user selects');
  });
}

test('lib/live.js: the contract API and the bus messages', () => {
  const src = read('lib/live.js');
  for (const k of ['layer:', 'select:', 'highlight:', 'getSelection:', 'build:']) assert.ok(src.includes(k), 'STACK_PAGE has ' + k);
  for (const t of ["type: 'select'", "type: 'string'", "d.type === 'changed'"]) assert.ok(src.includes(t), 'bus message ' + t);
  assert.ok(src.includes("new BroadcastChannel('vrg-stack')") && src.includes("'storage'"), 'BroadcastChannel with the storage-event fallback');
});
