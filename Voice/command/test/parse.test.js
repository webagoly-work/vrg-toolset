// WP-55 Parancs-héj: the command parser on spoken-style utterances (hu + en), recognition slips, slots, confirmations, the
// authorisation phrase, ask-backs and unknown input. Run: node --test Voice/command/test/parse.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const P = require('../parse.js');
const registry = require('../commands.json');

const ctx = {
  catalog: [
    { id: 'planner', hu: 'Varler Planner', en: 'Varler Planner' }, { id: 'kapu', hu: 'VRG Kapu', en: 'VRG Gate' },
    { id: 'web', hu: 'Böngésző', en: 'Browser' }, { id: 'munkavaszon', hu: 'Munkavászon', en: 'Session Canvas' },
    { id: 'sessions', hu: 'Munkamenetek', en: 'Claude sessions' }, { id: 'controller', hu: 'Vezérlő', en: 'Prompt controller' },
    { id: 'divergence', hu: 'Divergencia jelzőtábla', en: 'Divergence board' }, { id: 'stack', hu: 'VRG Rétegverem', en: 'VRG Stack' },
    { id: 'sketcher', hu: 'VRG Sketcher', en: 'VRG Sketcher' }, { id: 'map', hu: 'VRG Térkép', en: 'VRG Map' },
    { id: 'calc-panel', hu: 'Panel anyagár kalkulátor', en: 'Panel material price calculator' },
    { id: 'calc-general', hu: 'Általános kalkulátor', en: 'General electrician calculator' },
  ],
  laps: [{ id: 's1', name: 'Munkamenetek' }, { id: 's2', name: 'DevLap' }, { id: 's3', name: 'Ügyfél' }],
  windows: [
    { id: 'w-term-1', kind: 'term', title: 'GO MOBILE M16', focused: true },
    { id: 'w-web-1', kind: 'web', title: 'claude.ai', note: 'PR után' },
    { id: 'w-controller-1', kind: 'controller', title: 'Vezérlő' },
  ],
  machines: ['Műhely PC'],
};
const parse = t => P.parse(t, { registry, ctx });
const val = (r, s) => r.slots[s] && r.slots[s].value;

// [utterance, command, { slot: value }]
const CASES = [
  ['nyisd meg a Plannert', 'open', { target: 'planner' }],
  ['nyisd meg a planert', 'open', { target: 'planner' }],
  ['nyisd meg a plenert', 'open', { target: 'planner' }],
  ['Nyisd meg a Kaput!', 'open', { target: 'kapu' }],
  ['open the Kapu', 'open', { target: 'kapu' }],
  ['open the planner please', 'open', { target: 'planner' }],
  ['indítsd el a Sketchert', 'open', { target: 'sketcher' }],
  ['mutasd a térképet', 'open', { target: 'map' }],
  ['nyisd meg a böngészőt', 'open', { target: 'web' }],
  ['nyisd meg a munkavásznat', 'open', { target: 'munkavaszon' }],
  ['open the divergence board', 'open', { target: 'divergence' }],
  ['VRG, nyisd meg a Rétegvermet', 'open', { target: 'stack' }],
  ['menj a Munkamenetek lapra', 'lap.go', { lap: 's1' }],
  ['ugorj a devlap lapra', 'lap.go', { lap: 's2' }],
  ['go to the DevLap sheet', 'lap.go', { lap: 's2' }],
  ['következő lap', 'lap.next', {}],
  ['előző lapra', 'lap.prev', {}],
  ['next sheet', 'lap.next', {}],
  ['munkapad', 'tree', {}],
  ['tábla', 'board', {}],
  ['session board', 'board', {}],
  ['lista', 'list', {}],
  ['irányítópult', 'view.dash', {}],
  ['asztal nézet', 'view.desk', {}],
  ['válts a böngészőre', 'win.focus', { window: 'w-web-1' }],
  ['focus the controller', 'win.focus', { window: 'w-controller-1' }],
  ['ezt tedd teljes képernyőre', 'win.max', { window: 'w-term-1' }],
  ['teljes képernyő', 'win.max', {}],
  ['maximize the browser', 'win.max', { window: 'w-web-1' }],
  ['állítsd vissza', 'win.restore', {}],
  ['vissza a helyére', 'win.restore', {}],
  ['tedd kicsire a böngészőt', 'win.small', { window: 'w-web-1' }],
  ['zárd be a böngészőt', 'win.close', { window: 'w-web-1' }],
  ['zárd be a bögészőt', 'win.close', { window: 'w-web-1' }],
  ['close this window', 'win.close', { window: 'w-term-1' }],
  ['csukd be ezt', 'win.close', { window: 'w-term-1' }],
  ['folytasd a legutóbbit', 'sess.resume', {}],
  ['resume the last session', 'sess.resume', {}],
  ['nyisd meg a vásznon', 'sess.canvas', {}],
  ['folytasd erősebb modellel', 'sess.stronger', {}],
  ['írd a vezérlőbe: nézd át a Kapu belépést', 'ctl.fill', { text: 'nézd át a Kapu belépést' }],
  ['type into the controller fix the login page', 'ctl.fill', { text: 'fix the login page' }],
  ['küldd el', 'ctl.send', {}],
  ['send it', 'ctl.send', {}],
  ['töröld a vezérlőt', 'ctl.clear', {}],
  ['jegyzet ehhez: várja a telefonos tesztet', 'label.note', { text: 'várja a telefonos tesztet' }],
  ['note waiting for the phone test', 'label.note', { text: 'waiting for the phone test' }],
  ['nevezd el Kapu javítás', 'label.title', { text: 'Kapu javítás' }],
  ['ez a laptop', 'label.machine', { machine: 'laptop' }],
  ['ez a műhely pc gép', 'label.machine', { machine: 'műhely pc' }],
  ['ez felhő', 'label.origin', { origin: 'cloud' }],
  ['this is local', 'label.origin', { origin: 'local' }],
  ['színe legyen piros', 'label.color', { color: 'crit' }],
  ['make it purple', 'label.color', { color: 'violet' }],
  ['zöld keret', 'label.color', { color: 'ok' }],
  ['VRG, fejlesztői szint. Jogosult vagyok.', 'level.set', { level: 'dev', auth: true }],
  ['fejlesztői szint', 'level.set', { level: 'dev' }],
  ['felhasználói szint', 'level.set', { level: 'user' }],
  ["switch to developer level, I'm authorized", 'level.set', { level: 'dev', auth: true }],
  ['mi van a képernyőn?', 'ask.screen', {}],
  ["what's on screen", 'ask.screen', {}],
  ['melyik ablak ez?', 'ask.window', {}],
  ['hány munkamenet fut?', 'ask.sessions', {}],
  ['how many sessions are running', 'ask.sessions', {}],
  ['mi fut élőben?', 'ask.live', {}],
  ['hol tart a vezérlő?', 'ask.controller', {}],
  ['mégse', 'cancel', {}],
  ['never mind', 'cancel', {}],
  ['ismételd', 'repeat', {}],
  ['súgó', 'help', {}],
  ['what can you do', 'help', {}],
];

test('≥ 50 utterances land on the right command and slots', () => {
  assert.ok(CASES.length >= 50);
  const bad = [];
  for (const [t, cmd, slots] of CASES) {
    const r = parse(t);
    const ok = r.command === cmd && Object.entries(slots).every(([k, v]) => val(r, k) === v);
    if (!ok) bad.push(t + ' → ' + r.command + ' ' + JSON.stringify(Object.fromEntries(Object.entries(r.slots).map(([k, v]) => [k, v.value]))) + ' ' + r.confidence);
  }
  assert.deepStrictEqual(bad, []);
});

test('authorisation: dev / all without the phrase carry auth = false; the phrase is found anywhere after the level', () => {
  assert.notStrictEqual(val(parse('fejlesztői szint'), 'auth'), true);
  assert.strictEqual(val(parse('teljes szint, engedélyem van'), 'auth'), true);
  assert.strictEqual(val(parse('teljes szint'), 'level'), 'all');
  assert.strictEqual(val(parse('fejlesztői szint, jogosul vagyok'), 'auth'), true);       // a slip in the phrase
});

test('confirm words, choices and unknown input', () => {
  for (const y of ['igen', 'Igen!', 'mehet', 'yes', 'go ahead', 'VRG, igen']) assert.strictEqual(P.confirmWord(y, registry), 'yes', y);
  for (const n of ['nem', 'mégse', 'hagyd', 'cancel', 'no']) assert.strictEqual(P.confirmWord(n, registry), 'no', n);
  assert.strictEqual(P.confirmWord('nyisd meg a Plannert', registry), '');
  assert.strictEqual(P.choose('a Kapu', ['Varler Planner', 'VRG Kapu'], registry), 1);
  assert.strictEqual(P.choose('az elsőt', ['Varler Planner', 'VRG Kapu'], registry), 0);
  assert.strictEqual(P.choose('second', ['Varler Planner', 'VRG Kapu'], registry), 1);
  assert.strictEqual(P.choose('banán', ['Varler Planner', 'VRG Kapu'], registry), -1);
  for (const u of ['blabla foo bar', 'a kutya ugat a kertben', '', '   ']) {
    const r = parse(u);
    assert.strictEqual(r.command, null, u);
    assert.match(r.ask, /súgó/);
  }
});

test('ask-back: two close catalog names → "Melyik: … vagy …?" with the choices', () => {
  const r = parse('nyisd meg a kalkulátort');
  assert.strictEqual(r.command, 'open');
  assert.match(r.ask || '', /^Melyik: .+ vagy .+\?$/);
  assert.ok(r.choices && r.choices.list.length >= 2);
  assert.ok(r.ask.split(/\s+/).length <= 9);
});

test('words: fold and stem as Prefilter does; the phonetic layer forgives recogniser slips', () => {
  const pf = require('../../../Prefilter/prefilter.js');
  for (const w of ['Plannerben', 'Planner-t', 'böngészőt', 'képernyőre', 'Munkamenetek', 'vásznon']) assert.strictEqual(P.stem(P.fold(w).replace(/[^a-z0-9]/g, '')), pf.stem(pf.fold(w).replace(/[^a-z0-9]/g, '')), w);
  const t = s => P.tokenize(s)[0];
  assert.ok(P.wordSim(t('planert'), t('planner')) >= 0.9);
  assert.ok(P.wordSim(t('bogeszo'), t('bongeszo')) > 0);
  assert.strictEqual(P.wordSim(t('kapu'), t('kupa')), 0);              // short words must match exactly
  assert.ok(P.lev('kitten', 'sitting') === 3);
});

test('vocabulary: the registry phrases plus the catalog, Lap and machine names', () => {
  const v = P.vocabulary(registry, ctx);
  for (const w of ['nyisd meg', 'jogosult vagyok', 'Varler Planner', 'DevLap', 'Műhely PC']) assert.ok(v.includes(w), w);
});
