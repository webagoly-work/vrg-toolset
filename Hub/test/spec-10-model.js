'use strict';

const assert = require('assert');
const path = require('path');
const { kpValidate, kpResolveRefs, kpVisible, kpLinkFor } = require('../src/js/10-model.js');

const SEED = require(path.join(__dirname, '..', 'data', 'topology.json'));
const clone = () => JSON.parse(JSON.stringify(SEED));
const ctx = { repo: SEED.repo, localRoot: '' };
const count = (view) => kpVisible(SEED, view).reduce((n, c) => n + c.programs.length, 0);

module.exports = [
  { name: 'seed validates clean', fn() {
    const r = kpValidate(SEED);
    assert.strictEqual(r.ok, true, r.errors.join('; '));
    assert.strictEqual(r.errors.length, 0);
  } },
  { name: 'seed counts', fn() {
    assert.strictEqual(SEED.departments.length, 13);
    assert.strictEqual(SEED.programs.length, 55);
    const by = {};
    for (const p of SEED.programs) by[p.status] = (by[p.status] || 0) + 1;
    assert.deepStrictEqual(by, { live: 21, dev: 11, idea: 4, v2: 19 });
  } },
  { name: 'views: now 36, vision 55, empty IRO stays', fn() {
    assert.strictEqual(count('now'), 36);
    assert.strictEqual(count('vision'), 55);
    const iro = kpVisible(SEED, 'now').find(c => c.dept.id === 'IRO');
    assert.ok(iro);
    assert.strictEqual(iro.programs.length, 0);
    assert.deepStrictEqual(kpVisible(SEED, 'now').map(c => c.dept.id), SEED.departments.map(d => d.id));
  } },
  { name: 'duplicate program id is an error', fn() {
    const t = clone();
    t.programs.push(Object.assign({}, t.programs.find(p => p.id === 'planner')));
    const r = kpValidate(t);
    assert.strictEqual(r.ok, false);
    assert.ok(r.errors.some(e => e.includes('"planner"')), r.errors.join('; '));
  } },
  { name: 'unknown folder ref is an error', fn() {
    const t = clone();
    t.programs[0].folders = [{ ref: 'od-xx' }];
    const r = kpValidate(t);
    assert.ok(r.errors.some(e => e.includes('od-xx')));
  } },
  { name: 'bad status, unknown dept, bad claim date are errors', fn() {
    const t = clone();
    t.programs[0].status = 'done';
    t.programs[1].dept = 'NOPE';
    t.programs[2].claim = { by: 'x', until: '25.10.2026' };
    const e = kpValidate(t).errors.join('\n');
    assert.ok(/bad status "done"/.test(e) && /unknown dept "NOPE"/.test(e) && /claim.until/.test(e), e);
  } },
  { name: 'kpLinkFor: file -> blob, dir -> tree, url as is, local', fn() {
    assert.strictEqual(kpLinkFor({ repo: 'MindMap/vrg_mindmap.html' }, ctx).href,
      'https://github.com/webagoly-work/vrg-toolset/blob/main/MindMap/vrg_mindmap.html');
    assert.strictEqual(kpLinkFor({ repo: 'Calculator' }, ctx).href,
      'https://github.com/webagoly-work/vrg-toolset/tree/main/Calculator');
    assert.deepStrictEqual(kpLinkFor({ url: 'https://x.y' }, ctx), { href: 'https://x.y', kind: 'url' });
    assert.deepStrictEqual(kpLinkFor({ local: '_installers' }, { repo: SEED.repo, localRoot: 'H:\\VRG-DE' }),
      { href: null, kind: 'local', path: 'H:\\VRG-DE\\_installers' });
  } },
  { name: 'resolve: onedrive program has 3 folders, first is 00_START', fn() {
    const od = kpResolveRefs(SEED).programs.find(p => p.id === 'onedrive');
    assert.strictEqual(od.folders.length, 3);
    assert.strictEqual(od.folders[0].path, '00_START');
    assert.strictEqual(od.folders[0].ref, 'od-start');
  } }
];
