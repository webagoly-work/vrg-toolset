import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, STATE_KEY, MAX_PRESETS, NAME_MAX } from '../www/js/core/store.js';
import { wrapIndex, slideDirection } from '../www/js/ui/carousel.js';

const known = ['a', 'b', 'c', 'job', 'measure', 'checklist', 'calc', 'cheat'];

function memory(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    get length() { return map.size; },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    map,
  };
}
const make = (storage = memory()) => createStore({ storage, known, defaultName: 'Alap' });

test('first run: one preset, Hungarian, Standard', () => {
  const s = make();
  assert.equal(s.state.presets.length, 1);
  assert.equal(s.state.settings.lang, 'hu');
  assert.equal(s.state.settings.density, 'standard');
  assert.equal(s.active().name, 'Alap');
});

test('state survives a reload', () => {
  const storage = memory();
  const s = make(storage);
  s.setSetting('glove', true);
  s.enablePage('a');
  assert.equal(make(storage).state.settings.glove, true);
  assert.ok(make(storage).active().pages.includes('a'));
});

test('enable, disable and reorder', () => {
  const s = make();
  s.reorderPages([...s.active().pages].reverse());
  assert.equal(s.active().pages[0], 'cheat');
  assert.equal(s.enablePage('a'), true);
  assert.equal(s.enablePage('a'), false);
  assert.equal(s.enablePage('unknown'), false);
  s.disablePage('a');
  assert.ok(!s.active().pages.includes('a'));
  assert.equal(s.reorderPages(['job']), false);
});

test('movePage stops at both ends', () => {
  const s = make();
  const first = s.active().pages[0];
  assert.equal(s.movePage(first, -1), false);
  assert.equal(s.movePage(first, 1), true);
  assert.equal(s.active().pages[1], first);
  const last = s.active().pages.at(-1);
  assert.equal(s.movePage(last, 1), false);
});

test('at most three presets, each with its own pages, order and page settings', () => {
  const s = make();
  s.setPageSetting('job', 'density', 'dense');
  const site = s.state.active;
  const office = s.addPreset('Iroda');
  assert.equal(s.state.active, office);
  assert.equal(s.pageSetting('job', 'density'), 'dense', 'a new preset copies the current one');
  s.setPageSetting('job', 'density', 'glance');
  s.disablePage('calc');
  s.activatePreset(site);
  assert.equal(s.pageSetting('job', 'density'), 'dense');
  assert.ok(s.active().pages.includes('calc'));
  assert.ok(s.addPreset('Fejlesztés'));
  assert.equal(s.state.presets.length, MAX_PRESETS);
  assert.equal(s.addPreset('Negyedik'), null);
});

test('page settings survive disabling a page', () => {
  const s = make();
  s.setPageSetting('job', 'density', 'dense');
  s.disablePage('job');
  s.enablePage('job');
  assert.equal(s.pageSetting('job', 'density'), 'dense');
});

test('preset names are checked', () => {
  const s = make();
  assert.equal(s.addPreset('   '), null);
  assert.equal(s.addPreset('x'.repeat(NAME_MAX + 1)), null);
  assert.equal(s.renamePreset(s.state.active, ''), false);
  assert.equal(s.renamePreset(s.state.active, '  Helyszín  '), true);
  assert.equal(s.active().name, 'Helyszín');
});

test('the last preset cannot be deleted; deleting the active one moves on', () => {
  const s = make();
  assert.equal(s.deletePreset(s.state.active), false);
  const two = s.addPreset('Két');
  assert.equal(s.deletePreset(two), true);
  assert.equal(s.state.presets.length, 1);
  assert.equal(s.state.active, s.state.presets[0].id);
});

test('undo of a preset delete restores it', () => {
  const s = make();
  s.addPreset('Két');
  const snap = s.snapshot();
  s.deletePreset(s.state.active);
  s.restore(snap);
  assert.equal(s.state.presets.length, 2);
  assert.equal(s.active().name, 'Két');
});

test('export holds every vc. key and nothing else', () => {
  const storage = memory({ 'vc.other': '{"a":1}', 'vc.raw': 'text', 'foreign.key': 'x' });
  const s = make(storage);
  s.setSetting('glove', true);
  const out = s.exportData(new Date('2026-11-01T10:00:00Z'));
  assert.equal(out.app, 'varler-console');
  assert.equal(out.exportedAt, '2026-11-01T10:00:00.000Z');
  assert.deepEqual(Object.keys(out.data).sort(), [STATE_KEY, 'vc.other', 'vc.raw'].sort());
  assert.equal(out.data[STATE_KEY].settings.glove, true);
  assert.equal(out.data['vc.raw'], 'text');
});

test('erase removes every vc. key, leaves others, and undo brings it back', () => {
  const storage = memory({ 'vc.other': '1', 'foreign.key': 'x' });
  const s = make(storage);
  s.addPreset('Iroda');
  s.setSetting('sunlight', true);
  const dump = s.eraseAll();
  assert.deepEqual([...storage.map.keys()], ['foreign.key']);
  assert.equal(s.state.presets.length, 1);
  assert.equal(s.state.settings.sunlight, false);
  s.restoreErased(dump);
  assert.equal(s.state.presets.length, 2);
  assert.equal(s.state.settings.sunlight, true);
  assert.equal(storage.getItem('vc.other'), '1');
});

test('a damaged save opens with defaults, unknown pages drop', () => {
  assert.equal(make(memory({ [STATE_KEY]: '{not json' })).state.presets.length, 1);
  assert.equal(make(memory({ [STATE_KEY]: '{"presets":"x"}' })).state.presets.length, 1);
  const s = make(memory({ [STATE_KEY]: JSON.stringify({ presets: [{ id: 'p1', name: 'A', pages: ['job', 'gone', 'job'] }], active: 'nope', settings: { density: 'huge', lang: 'de' } }) }));
  assert.deepEqual(s.active().pages, ['job']);
  assert.equal(s.state.settings.density, 'standard');
  assert.equal(s.state.settings.lang, 'hu');
});

test('blocked storage does not crash and is reported', () => {
  const broken = { get length() { throw new Error('x'); }, getItem() { throw new Error('x'); } };
  const s = createStore({ storage: broken, known, defaultName: 'Alap' });
  assert.equal(s.persisted, false);
  s.setSetting('glove', true);
  assert.equal(s.state.settings.glove, true);
  const full = memory();
  full.setItem = () => { throw new Error('quota'); };
  const q = make(full);
  q.setSetting('glove', true);
  assert.equal(q.persisted, false);
});

test('page index wraps both ways', () => {
  assert.equal(wrapIndex(6, 6), 0);
  assert.equal(wrapIndex(-1, 6), 5);
  assert.equal(slideDirection(0, 1, 6), 1);
  assert.equal(slideDirection(0, 5, 6), -1);
  assert.equal(slideDirection(5, 0, 6), 1);
});
