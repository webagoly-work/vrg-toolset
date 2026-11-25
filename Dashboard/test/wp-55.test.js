// WP-55 Parancs-héj (voice command overlay): the registry is valid and complete, every act has an executor in page/voicecmd.js,
// the risky acts ask first, the recogniser phrases cover the commands, commands.js is in step with commands.json, and the overlay's
// pure helpers (terse answers, the "what's on screen" summary, history) behave.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const reg = require('../../Voice/command/commands.json');
const P = require('../../Voice/command/parse.js');
const vc = require('../page/voicecmd.js');
const build = require('../../Voice/command/build.js');
const SLOT_KINDS = ['catalog', 'lap', 'window', 'window?', 'text', 'color', 'origin', 'machine', 'level', 'auth?'];

test('registry: unique ids, known slot kinds, every pattern slot declared and every declared slot used', () => {
  const ids = new Set();
  for (const c of reg.commands) {
    assert.ok(/^[a-z]+(\.[a-z]+)?$/.test(c.id) && !ids.has(c.id), c.id); ids.add(c.id);
    assert.ok(Array.isArray(c.say) && c.say.length >= 2, c.id + ': at least two ways to say it');
    for (const k of Object.values(c.slots || {})) assert.ok(SLOT_KINDS.includes(k), c.id + ' slot kind ' + k);
    const used = new Set();
    for (const s of c.say) for (const m of s.matchAll(/\{(\w+)\??\}/g)) { assert.ok(c.slots && m[1] in c.slots, c.id + ': {' + m[1] + '} not declared'); used.add(m[1]); }
    for (const k of Object.keys(c.slots || {})) assert.ok(used.has(k), c.id + ': slot ' + k + ' never said');
  }
  for (const k of ['wake', 'fillers', 'deixis', 'yes', 'no', 'auth', 'machines', 'phrases']) assert.ok(Array.isArray(reg[k]) && reg[k].length, k);
  assert.deepStrictEqual(Object.keys(reg.levels).sort(), ['all', 'dev', 'user']);
});

test('every act has an executor; closing a window and sending a prompt always ask first; dev / all need the phrase', () => {
  for (const c of reg.commands) assert.ok(vc.ACTS.includes(c.act), c.id + ' → ' + c.act);
  const byId = Object.fromEntries(reg.commands.map(c => [c.id, c]));
  assert.strictEqual(byId['win.close'].confirm, true);
  assert.strictEqual(byId['ctl.send'].confirm, true);
  assert.ok(!byId['ctl.fill'].confirm, 'filling the box never sends, so it needs no confirmation');
  assert.deepStrictEqual(reg.levelNeedsAuth.sort(), ['all', 'dev']);
  const src = fs.readFileSync(path.join(REPO, 'Dashboard', 'page', 'voicecmd.js'), 'utf8');
  assert.ok(!/\.send\(\)/.test(src.replace(/async 'ctl\.send'[\s\S]*?\n    \},/, '')), 'only the ctl.send executor (behind confirm) calls send()');
});

test('the recogniser phrases cover every command (one way to say it is fully in the phrase list)', () => {
  const vocab = new Set(P.tokenize(reg.phrases.join(' ')).map(t => t.stem));
  const fill = new Set(reg.fillers.map(w => P.stem(P.fold(w))));
  const miss = [];
  for (const c of reg.commands) {
    const ok = c.say.some(s => P.tokenize(s.replace(/\{\w+\??\}/g, ' ')).every(t => vocab.has(t.stem) || fill.has(t.stem)));
    if (!ok) miss.push(c.id);
  }
  assert.deepStrictEqual(miss, []);
});

test('commands.js is generated from commands.json and in step (node Voice/command/build.js)', () => {
  assert.strictEqual(fs.readFileSync(build.OUT, 'utf8'), build.render(JSON.parse(fs.readFileSync(build.SRC, 'utf8'))));
});

test('overlay helpers: terse answers, window phrases, the screen summary, history', () => {
  assert.strictEqual(vc.terse('egy kettő három négy öt hat hét', 6), 'egy kettő három négy öt hat…');
  assert.strictEqual(vc.terse('  rövid  válasz '), 'rövid válasz');
  assert.strictEqual(vc.windowLine({ kind: 'term', title: 'GO MOBILE M16', origin: 'Helyi · A' }), 'Terminál – GO MOBILE M16 (Helyi · A)');
  assert.strictEqual(vc.windowLine({ kind: 'web', title: 'Böngésző' }), 'Böngésző');
  const d = vc.describeState({ view: 'desktop', lap: 'Munkamenetek', windows: [
    { kind: 'term', title: 'GO MOBILE M16', origin: 'Helyi · A', note: 'várja a tesztet', focused: true },
    { kind: 'web', title: 'claude.ai', origin: 'Felhő' }, { kind: 'controller', title: 'Vezérlő' }], live: 1 });
  assert.strictEqual(d.say, 'Munkamenetek lap, 3 ablak.');
  assert.ok(d.say.split(' ').length <= 6);
  assert.match(d.detail, /^Fókusz: Terminál – GO MOBILE M16 \(Helyi · A\), jegyzet: várja a tesztet\. Még: Böngésző – claude\.ai \(Felhő\); Vezérlő\. 1 élő munkamenet\.$/);
  assert.deepStrictEqual(vc.describeState({ view: 'dashboard', level: 'dev' }), { say: 'Irányítópult nézet.', detail: 'Szint: Fejlesztői.' });
  assert.strictEqual(vc.describeState({ view: 'desktop', onTree: true, windows: [] }).say, 'Munkapad, 0 ablak.');
  let h = [];
  for (let i = 0; i < 7; i++) h = vc.pushHistory(h, { heard: 'p' + i, say: 's' + i });
  assert.deepStrictEqual(h.map(x => x.heard), ['p6', 'p5', 'p4', 'p3', 'p2']);
  const rows = [{ session: 'a', mtime: 3, live: true }, { session: 'b', mtime: 2 }, { session: 'c', mtime: 1 }];
  assert.strictEqual(vc.newest(rows, true).session, 'b');
  assert.strictEqual(vc.newest(rows, false).session, 'a');
  assert.strictEqual(vc.newest([], true), null);
});
