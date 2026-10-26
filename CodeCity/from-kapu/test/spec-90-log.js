'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { kpLoad } = require('./load');

const m = kpLoad(['00-core.js', '41-search.js', '90-log.js']);
const ENTRY = () => ({ date: '2026-10-21', by: 'webagoly-work', programs: ['planner', 'inventory'],
  did: 'Födém toll finomítása a nappaliban.\nA tolltávolság most 40 mm.', open: 'Mozi fal toll érzet.',
  next: 'C6 Mozi fal toll — utolsó simítás.', questions: '', links: 'https://github.com/webagoly-work/vrg-toolset/commit/abc', extra: [] });
const plain = v => JSON.parse(JSON.stringify(v));   // out of the vm realm

module.exports = [
  { name: 'kpLogToMd equals the fixture byte for byte', fn() {
    const want = fs.readFileSync(path.join(__dirname, 'fixtures', 'log-expected.md'), 'utf8').replace(/\r/g, '');
    assert.strictEqual(m.kpLogToMd(ENTRY()), want);
  } },
  { name: 'round trip is lossless; an unknown section lands in extra', fn() {
    assert.deepStrictEqual(plain(m.kpMdToLog(m.kpLogToMd(ENTRY()))), ENTRY());
    const withExtra = m.kpLogToMd(ENTRY()) + '## Megjegyzés\nKézzel írt sor.\n';
    const e = plain(m.kpMdToLog(withExtra));
    assert.deepStrictEqual(e.extra, [{ h: 'Megjegyzés', text: 'Kézzel írt sor.' }]);
    assert.strictEqual(m.kpLogToMd(e), withExtra, 'extra survives a second write');
  } },
  { name: 'file name: date_login_first-5-words, accents folded', fn() {
    const e = Object.assign(ENTRY(), { did: 'Födém toll finomítása a CLA nappaliban' });
    assert.strictEqual(m.kpLogName(e, []), '2026-10-21_webagoly-work_fodem-toll-finomitasa-a-cla.md');
  } },
  { name: 'name clash -> -2, then -3', fn() {
    const e = Object.assign(ENTRY(), { did: 'Födém toll finomítása a CLA nappaliban' });
    const a = '2026-10-21_webagoly-work_fodem-toll-finomitasa-a-cla.md';
    assert.strictEqual(m.kpLogName(e, [a]), '2026-10-21_webagoly-work_fodem-toll-finomitasa-a-cla-2.md');
    assert.strictEqual(m.kpLogName(e, [a, a.replace('.md', '-2.md')]), a.replace('.md', '-3.md'));
  } },
  { name: 'relative day words', fn() {
    assert.strictEqual(m.kpRelDay('2026-10-22', '2026-10-22'), 'ma');
    assert.strictEqual(m.kpRelDay('2026-10-21', '2026-10-22'), 'tegnap');
    assert.strictEqual(m.kpRelDay('2026-10-18', '2026-10-22'), '4 napja');
  } }
];
