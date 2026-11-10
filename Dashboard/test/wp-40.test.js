// WP-40 (Desktop unify U4): the catalog — launcher/vrg-catalog.json, lib/catalog.js, tools/check-catalog.js.
// Reads the real registry and catalog (read only); the validation rules are also checked on small fake catalogs.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { execFileSync } = require('child_process');
const build = require('../build.js');
const { KINDS } = require('../shell/lib/layout.js');
const { createCatalog, validate, RANK } = require('../shell/lib/catalog.js');

const REPO = path.resolve(__dirname, '..', '..');
const FILE = path.join(REPO, 'launcher', 'vrg-catalog.json');
const C = build.collect();
const cat = createCatalog({ file: FILE, collect: () => C, kinds: KINDS });
cat.load();

const base = () => ({
  types: { application: {}, category: {}, utility: {}, t: {} },
  groups: { munka: { hu: 'Munka', en: 'Work', subs: { tervezes: 'T' } }, fejlesztes: { hu: 'F', en: 'D', subs: {} } },
  sections: { apps: { hu: 'A', en: 'A', level: 'user' } },
  items: [
    { id: 'a', title: { hu: 'A', en: 'A' }, type: 'application', level: 'user', group: 'munka', status: 'live', launch: { act: 's:1' } },
    { id: 'dev:x', title: { hu: 'X', en: 'X' }, type: 'category', level: 'dev', group: 'fejlesztes', status: 'live', launch: {} },
  ],
});
const fakeC = { startActs: { 's:1': { path: 'x.html' } }, menu: { servers: [{ id: 'srv1', name: 'S', port: 9000 }], start: { projects: [], dev: [] } }, data: { features: [] } };

test('the real catalog is valid against the real registry', () => assert.deepEqual(cat.errors(), []));

test('check-catalog.js exits 0 on the real catalog', () => {
  const out = execFileSync(process.execPath, [path.join(REPO, 'tools', 'check-catalog.js')], { encoding: 'utf8' });
  assert.match(out, /Rendben/);
});

test('ids are unique and every dev item has a parent in the catalog', () => {
  const items = cat.raw().items;
  assert.equal(new Set(items.map(i => i.id)).size, items.length);
  const ids = new Set(items.map(i => i.id));
  for (const i of items.filter(x => x.level === 'dev' && x.type !== 'category')) assert.ok(ids.has(i.parent), i.id + ' -> ' + i.parent);
});

test('six dev roots, each with something behind it', () => {
  const roots = cat.raw().items.filter(i => i.type === 'category').map(i => i.id).sort();
  assert.deepEqual(roots, ['dev:ai', 'dev:hw', 'dev:infra', 'dev:knowledge', 'dev:look', 'dev:repo']);
  for (const r of roots) assert.ok(cat.children(r, 'dev').items.length > 0, r);
});

test('listFor: user ⊂ dev ⊂ all, and user has no dev item', () => {
  const u = cat.listFor('user'), d = cat.listFor('dev'), a = cat.listFor('all');
  assert.ok(u.length < d.length && d.length < a.length);
  const ids = l => new Set(l.map(x => x.id));
  for (const x of ids(u)) assert.ok(ids(d).has(x));
  for (const x of ids(d)) assert.ok(ids(a).has(x));
  assert.ok(u.every(x => x.level === 'user'));
  assert.equal(a.length, cat.raw().items.length);
  assert.deepEqual(cat.listFor('nonsense').map(x => x.id), u.map(x => x.id));
});

test('the Planner: a user app; at Dev its START P actions and its servers hang behind it', () => {
  const p = cat.get('planner');
  assert.equal(p.level, 'user');
  const atUser = cat.children('planner', 'user'), atDev = cat.children('planner', 'dev');
  assert.deepEqual(atUser.acts, []);
  assert.deepEqual(atUser.servers, []);
  assert.ok(atDev.acts.some(a => a.act === 's:P/B'), 'build');
  assert.ok(atDev.acts.some(a => a.act === 's:P/T'), 'test');
  assert.deepEqual(atDev.servers.map(s => s.id).sort(), ['gyro', 'planner']);
  assert.ok(atDev.items.includes('planner-cyd'));
});

test('resolve: act, app, server + path, pane, feature, view, frame, start, unknown', () => {
  assert.deepEqual(cat.resolve('planner'), { do: 'act', act: 's:1', app: true });
  assert.deepEqual(cat.resolve('layer.i'), { do: 'web', server: 'stack', url: 'http://127.0.0.1:8806/lineage.html' });
  assert.deepEqual(cat.resolve('files'), { do: 'pane', kind: 'files' });
  assert.equal(cat.resolve('jobs').do, 'act');
  assert.match(cat.resolve('jobs').act, /^f:m3:\d+$/);
  assert.deepEqual(cat.resolve('view-desktop'), { do: 'view', view: 'desktop', section: '' });
  assert.deepEqual(cat.resolve('palette'), { do: 'frame', frame: 'palette' });
  assert.deepEqual(cat.resolve('commit'), { do: 'start', key: 'S' });
  assert.equal(cat.resolve('dev:repo'), null);
  assert.equal(cat.resolve('no-such-thing'), null);
});

test('appTarget: a page inside a folder serves that folder + shared/; a repo-root page is served alone', () => {
  const opt = { repo: REPO, expand: s => C.expand(s) };
  assert.deepEqual(cat.appTarget('calc-panel', opt), { page: 'Calculator/panel_anyagar_kalkulator.html', allow: ['Calculator/', 'shared/'] });
  assert.deepEqual(cat.appTarget('vendor', opt), { page: 'vrg-vendor.html', allow: ['vrg-vendor.html', 'shared/'] });
  assert.equal(cat.appTarget('files', opt), null);
  assert.equal(cat.appTarget('map', opt), null);                          // START M runs a program, not a page
});

test('the stack dial: every layer F I Q L A U R C G Z has one item; F, I, Q are user level', () => {
  const layers = {};
  for (const i of cat.raw().items) if (i.surfaces && /^[FIQLAURCGZ]$/.test(i.surfaces.stack || '')) layers[i.surfaces.stack] = i;
  assert.deepEqual(Object.keys(layers).sort(), 'ACFGILQRUZ'.split(''));
  assert.deepEqual(['F', 'I', 'Q'].map(k => layers[k].level), ['user', 'user', 'user']);
  assert.equal(cat.get('stack.search').level, 'user');
});

test('validate: duplicate id, bad level, dev without parent, unresolved refs, cycle', () => {
  assert.deepEqual(validate(base(), { C: fakeC, kinds: KINDS }), []);
  const dup = base(); dup.items.push({ ...dup.items[0] });
  assert.ok(validate(dup, { C: fakeC, kinds: KINDS }).some(e => /duplicate id/.test(e)));
  const lv = base(); lv.items[0].level = 'admin';
  assert.ok(validate(lv, { C: fakeC, kinds: KINDS }).some(e => /level must be/.test(e)));
  const orphan = base(); orphan.items.push({ id: 'd', title: { hu: 'D', en: 'D' }, type: 'utility', level: 'dev', group: 'fejlesztes', status: 'live', launch: {} });
  assert.ok(validate(orphan, { C: fakeC, kinds: KINDS }).some(e => /needs a parent/.test(e)));
  const refs = base(); refs.items[0].launch = { act: 's:9' }; refs.items[1].launch = { server: 'nope' };
  const e = validate(refs, { C: fakeC, kinds: KINDS });
  assert.ok(e.some(x => /s:9 is not a START act/.test(x)) && e.some(x => /nope is not in/.test(x)));
  const pane = base(); pane.items[0].launch = { pane: 'spreadsheet' };
  assert.ok(validate(pane, { C: fakeC, kinds: KINDS }).some(x => /not a pane kind/.test(x)));
  const cyc = base(); cyc.items.push({ id: 'p', parent: 'q', title: { hu: 'P', en: 'P' }, type: 't', level: 'user', group: 'munka', status: 'live' }, { id: 'q', parent: 'p', title: { hu: 'Q', en: 'Q' }, type: 't', level: 'user', group: 'munka', status: 'live' });
  assert.ok(validate(cyc, { C: fakeC, kinds: KINDS }).some(x => /cycle/.test(x)));
  const path2 = base(); path2.items[0].launch = { server: 'srv1', path: '/../secret' };
  assert.ok(validate(path2, { C: fakeC, kinds: KINDS }).some(x => /bad launch.path/.test(x)));
});

test('levels rank user < dev < all', () => assert.ok(RANK.user < RANK.dev && RANK.dev < RANK.all));

test('types: every item\'s type is in the fixed list; detail goes in a short qualifier', () => {
  const V = cat.raw().types;
  assert.ok(V && Object.keys(V).length >= 40, 'the vocabulary is in the catalog');
  for (const [k, v] of Object.entries(V)) { assert.ok(v.en && v.hu, k); assert.ok(['unit', 'container'].includes(v.kind), k); }
  for (const i of cat.raw().items) assert.ok(Object.prototype.hasOwnProperty.call(V, i.type), i.id + ': ' + i.type);
  const free = base(); free.items[0].type = 'utility (calculator)';
  assert.ok(validate(free, { C: fakeC, kinds: KINDS }).some(e => /is not in the catalog's types/.test(e)));
  const q = base(); q.items[0].qualifier = 'x'.repeat(81);
  assert.ok(validate(q, { C: fakeC, kinds: KINDS }).some(e => /qualifier/.test(e)));
  const calc = cat.listFor('user').find(i => i.id === 'calc-panel');
  assert.deepEqual([calc.type, calc.qualifier, calc.label], ['utility', 'calculator', 'Utility · calculator']);
});

test('User shows finished things only: a user item still dev / planned shows from Dev, with its declared level kept', () => {
  const { effectiveLevel, USER_STATUS } = require('../shell/lib/catalog.js');
  assert.deepEqual(USER_STATUS, ['live', 'beta']);
  for (const i of cat.listFor('user')) assert.ok(USER_STATUS.includes(i.status), i.id + ' is ' + i.status);
  const dev = cat.listFor('dev');
  const cp = dev.find(i => i.id === 'client-preview');
  assert.deepEqual([cp.level, cp.declared], ['dev', 'user']);
  assert.ok(dev.some(i => i.id === 'servicekit'));
  assert.equal(effectiveLevel({ level: 'user', status: 'beta' }), 'user');
  assert.equal(effectiveLevel({ level: 'user', status: 'planned' }), 'dev');
  assert.equal(effectiveLevel({ level: 'all', status: 'planned' }), 'all');
  assert.equal(cat.children('planner', 'user').items.includes('client-preview'), false);
});

test('classification: every row has a listed type and a scope; only open rows carry a level', () => {
  const C2 = require('../tools/classify.js');
  const res = C2.classify();
  assert.deepEqual(C2.problems(res), []);
  for (const r of res.out) {
    assert.ok(['open', 'internal', 'roadmap'].includes(r.scope), r.id);
    if (r.scope === 'open') assert.ok(['user', 'dev', 'all'].includes(r.level), r.id); else assert.equal(r.level, '', r.id);
  }
  const by = id => res.out.find(r => r.id === id);
  const mod = res.out.find(r => r.source === 'dashboard' && r.type === 'module');
  assert.equal(mod.scope, 'internal');
  const plan = res.out.find(r => r.source === 'features' && (r.type === 'work package' || r.type === 'idea'));
  assert.equal(plan.scope, 'roadmap');
  assert.equal(by('pane:app').scope, 'internal');
});
