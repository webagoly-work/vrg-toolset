// tools/check-catalog.js without the Founder's PC (the Bicameral Examination's defect 2, 2026-11-25): the features map,
// the dev lines and the board live in notes/ beside the checkout, so on a machine without notes/ (a cloud session, CI)
// the check used to stop at "a registry nem toltheto be". Now collect({ localOptional: true }) reads a missing notes/
// file as empty and names it, and the catalog's validate() leaves launch.feature unchecked instead of calling it wrong.
// Runs anywhere: the validate() cases use a fake registry; the check-catalog run is the real one.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { validate } = require('../shell/lib/catalog.js');
const { KINDS } = require('../shell/lib/layout.js');

const REPO = path.resolve(__dirname, '..', '..');
const cat = () => ({
  types: { application: {} },
  groups: { munka: { hu: 'Munka', en: 'Work', subs: {} } },
  sections: {},
  items: [{ id: 'a', title: { hu: 'A', en: 'A' }, type: 'application', level: 'user', group: 'munka', status: 'live', launch: { feature: 'F1' } }],
});
const C = extra => ({ startActs: {}, menu: { servers: [], start: { projects: [], dev: [] } }, data: { features: [] }, ...extra });

test('a features ref that does not resolve is an error when the features map is here', () => {
  assert.ok(validate(cat(), { C: C(), kinds: KINDS }).some(e => /launch\.feature F1 is not a features node/.test(e)));
});

test('without notes/ the features ref is left unchecked, not called wrong', () => {
  assert.deepEqual(validate(cat(), { C: C({ localMissing: ['features', 'lines', 'board'] }), kinds: KINDS }), []);
});

test('collect({ localOptional: true }) names what it could not read, and the Dashboard build stays strict', () => {
  const build = require('../build.js');
  const c = build.collect({ localOptional: true });
  assert.ok(Array.isArray(c.localMissing));
  const notes = path.join(c.paths.FULL, 'notes', 'features', 'features.json');
  if (!fs.existsSync(notes)) {
    assert.ok(c.localMissing.includes('features'));
    assert.throws(() => build.collect(), /ENOENT/, 'the default call still needs notes/');
  } else assert.deepEqual(c.localMissing.filter(x => x === 'features'), []);
});

test('check-catalog.js exits 0 here, with or without notes/', () => {
  const out = execFileSync(process.execPath, [path.join(REPO, 'tools', 'check-catalog.js')], { encoding: 'utf8' });
  assert.match(out, /Rendben/);
});
