#!/usr/bin/env node
// Sketcher/tools/make-fixture.js — writes Sketcher/test/fixtures/shadow.json: survey states in random order (as they
// arrive on site) and what the JS engine says about each: facts, the shadow questions, suggestions, the shot list,
// the loose ends, and the survey after the suggestions are accepted. FieldKitTest (sketch-core, JVM) replays every
// case through the Kotlin engine and must get the same, so the phone and the Desktop never disagree.
//
//   node Sketcher/tools/make-fixture.js          (write)
//   node Sketcher/tools/make-fixture.js --check  (exit 1 when the committed fixture is stale; Sketcher/test/run.js runs it)
'use strict';
const fs = require('fs'), path = require('path');
const K = require('../lib/fieldkit.js');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'test', 'fixtures', 'shadow.json');
const kitJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'catalog', 'fieldkit.json'), 'utf8'));

const base = { kind: 'vrg-vazlat', v: 2, id: 'FX', name: 'Fixture', seq: 50, rooms: [], lines: [], points: [], measures: [], circuits: [],
  routes: [], memos: [], tags: [{ id: 'T-furdo', name: 'Fürdő', col: 4280978651, preset: 'kind:furdo' }], tagUses: [], photos: [],
  entries: [], scope: {}, answers: {}, captures: [], dismissed: [], seen: {} };
const S = o => Object.assign(JSON.parse(JSON.stringify(base)), o);
const NOW = 1763460000000;

const CASES = [
  ['empty survey: the basic questions, all new', S({})],
  ['a note first, before anything else (budget, phase, kitchen)', S({ entries: [{ id: 'E1', at: NOW - 5000, text: 'A konyhába indukciós főzőlap kell, keret kb 800 ezer Ft, 3 fázis van', chips: ['kivansag'] }] })],
  ['an answer before its question would show (fazis without scope)', S({ answers: { fazis: { options: ['3f'], text: '', at: NOW, state: 'answered' } } })],
  ['scope EV in a társasház: the consent question appears', S({ scope: { ev: 1 }, answers: { ingatlan: { options: ['tarsashaz'], text: '', at: NOW, state: 'answered' } } })],
  ['old answers seen long ago, one put off, one skipped', S({ scope: { felujitas: 1 }, seen: { lenyeg: NOW - 3600000, kor: NOW - 1200000, anyag: NOW - 60000 },
    answers: { lenyeg: { options: ['csere'], text: '', at: NOW - 3000000, state: 'answered' }, kor: { options: [], text: '', at: NOW, state: 'later' }, foto: { options: [], text: '', at: NOW, state: 'skip' } } })],
  ['a bathroom room by tag, photo point with 2 shots, captures with and without a shot item', S({
    rooms: [{ id: 'R1', poly: [[0, 0], [100, 0], [100, 80], [0, 80]], name: '', kinds: [] }],
    tagUses: [{ id: 'U1', tag: 'T-furdo', target: 'R1' }],
    photos: [{ id: 'F2', at: [50, 40], room: 'R1', shots: [{ deg: 0, file: 'a.jpg', taken: 1 }, { deg: 90, file: 'b.jpg', taken: 2 }] }],
    scope: { felujitas: 1 },
    captures: [{ id: 'C3', file: 'c.jpg', purpose: 'merohely', at: NOW, shot: 'merohely_nyitott', note: '' }, { id: 'C4', file: 'd.jpg', purpose: 'merohely', at: NOW, note: '' },
      { id: 'C5', file: 'e.jpg', purpose: 'egyeb', at: NOW, note: '' }] })],
  ['a fault told in passing, a dismissed suggestion, an open note, a draft', S({
    entries: [{ id: 'E1', at: NOW, text: 'Néha leold a fi relé és égett szagot érez a nappaliban', chips: ['problema'] }, { id: 'E2', at: NOW, text: '', chips: ['tisztazando', 'lakott'], open: true }],
    dismissed: ['kw:leold'], draft: 'a garázsban is kell egy' })],
  ['points and circuits in random order: a typeless point, a circuit without its board', S({
    points: [{ id: 'P1', at: [0, 0], type: 'pont', st: 'tervezett' }, { id: 'P2', at: [5, 0], type: 'socket', st: 'tervezett' }, { id: 'P3', at: [9, 9], type: 'board', st: 'meglevo' }],
    circuits: [{ id: 'K4', name: 'K1', col: 4293420060, members: ['P2'], ded: false }], site: { address: 'Kossuth u. 12', source: 'kezi' } })],
  ['Kamera 2: a signature (dokumentum) fills no shot item, a video does; an after photo paired with its before', S({ scope: { ev: 1 },
    captures: [{ id: 'C1', file: 's.png', purpose: 'dokumentum', at: NOW, note: 'A felmérést átvettem', kind: 'signature', signer: 'Ügyfél' },
      { id: 'C2', file: 'v.mp4', purpose: 'nyomvonal', at: NOW, note: '', kind: 'video', durationMs: 42000, bytes: 30000000 },
      { id: 'C3', file: 'a.jpg', purpose: 'hiba', at: NOW - 9000, note: '', phase: 'elotte' }, { id: 'C4', file: 'b.jpg', purpose: 'hiba', at: NOW, note: '', phase: 'utana', pair: 'C3' }] })],
  // F4: a burnt-out lamp (kiégett) is no fault; a burnt smell still is
  ['kiégett izzó: no fault suggested; égett szag still is', S({ entries: [{ id: 'E1', at: NOW, text: 'A folyosón két kiégett izzó van', chips: [] }] })],
  ['ipari-telephely on, kiégett: the fényforrás-csere detector, no fault (the kit fix replaced the variant override)', S({ variant: 'ipari-telephely', variantOn: true,
    entries: [{ id: 'E1', at: NOW, text: 'A csarnokban hat kiégett lámpa', chips: [] }] })],
  ['megégett konnektor: still a fault', S({ entries: [{ id: 'E1', at: NOW, text: 'A konyhában megégett a konnektor', chips: [] }] })],
  // F4 (WP M49): the client's wants by room; the job total stays scope, the rest is Általános
  ['wants by room: two rooms, a general part, a deleted room counts as general', S({
    rooms: [{ id: 'R1', poly: [[0, 0], [100, 0], [100, 80], [0, 80]], name: 'Konyha', kinds: ['konyha'] }, { id: 'R2', poly: [[100, 0], [180, 0], [180, 80], [100, 80]], name: '', kinds: ['furdo'] }],
    scope: { dugalj: 5, lampa: 2, felujitas: 1 }, roomScope: { R1: { dugalj: 2, lampa: 1 }, R2: { dugalj: 1 }, R9: { lampa: 1 } },
    entries: [{ id: 'E1', at: NOW, text: 'A pult fölé két dugalj', chips: ['kivansag'], room: 'R1' }] })],
  ['wants only in a room, no other scope: the room makes the want a fact', S({
    rooms: [{ id: 'R1', poly: [[0, 0], [100, 0], [100, 80], [0, 80]], name: '', kinds: ['nappali'] }], scope: { dugalj: 3 }, roomScope: { R1: { dugalj: 3 } } })],
  ['variant switched on, and a chip effect already applied', S({ variant: 'furdo-felujitas', variantOn: true, scope: { furdo: 1 },
    entries: [{ id: 'E1', at: NOW, text: 'bojlert is cserélnénk', chips: ['berlo'] }], answers: { hozzaferes: { options: ['berlo'], text: '', at: NOW, state: 'answered' } } })],
];

const COND_CASES = [
  [true, 'empty', true], [false, 'empty', false], [{ scope: 'ev' }, 'ev', true], [{ scope: ['napelem', 'ev'] }, 'ev', true], [{ scope: 'ev' }, 'empty', false],
  [{ answer: 'ingatlan' }, 'tarsashaz', true], [{ answer: 'ingatlan', is: 'csaladi' }, 'tarsashaz', false], [{ answer: 'ingatlan', is: ['csaladi', 'tarsashaz'] }, 'tarsashaz', true],
  [{ all: [{ scope: 'ev' }, { answer: 'ingatlan', is: 'tarsashaz' }] }, 'tarsashaz', false], [{ all: [{ scope: 'ev' }, { answer: 'ingatlan', is: 'tarsashaz' }] }, 'ev', true],
  [{ not: { scope: 'ev' } }, 'ev', false], [{ any: [] }, 'empty', false], [{ all: [] }, 'empty', true], [{ site: true }, 'empty', false], [{ site: false }, 'empty', true],
  [[{ scope: 'x' }, { scope: 'ev' }], 'ev', true],
];
const COND_FACTS = {
  empty: S({}),
  ev: S({ scope: { ev: 1 }, answers: { ingatlan: { options: ['tarsashaz'], state: 'answered', text: '', at: 0 } } }),
  tarsashaz: S({ answers: { ingatlan: { options: ['tarsashaz'], state: 'answered', text: '', at: 0 } } }),
};

function build() {
  const kit = K.parseKit(kitJson);
  const variants = {};
  const vdir = path.join(ROOT, 'variants');
  for (const f of fs.readdirSync(vdir).filter(f => f.endsWith('.json')).sort()) { const v = JSON.parse(fs.readFileSync(path.join(vdir, f), 'utf8')); variants[v.id] = v; }
  const sortedFacts = f => ({ scope: [...f.scope].sort(), answers: Object.fromEntries([...f.answers].sort().map(([k, v]) => [k, [...v].sort()])), rooms: [...f.rooms].sort(),
    points: [...f.points].sort(), tags: [...f.tags].sort(), kw: [...f.kw].sort(), chips: [...f.chips].sort(), photos: [...f.photos].sort(), site: f.site, variant: f.variant });
  const cases = CASES.map(([name, s]) => {
    const k = s.variantOn && variants[s.variant] ? K.withVariant(kit, variants[s.variant]) : kit;
    const f = K.facts(k, s);
    const sug = K.suggestions(k, s);
    let after = s; sug.forEach(g => { after = K.apply(k, g.effect, after, NOW); });
    return { name, sketch: s, now: NOW, variant: s.variantOn ? s.variant : null, expect: {
      facts: sortedFacts(f),
      questions: K.questions(k, s, f, NOW).map(x => [x.q.id, x.fresh, x.done, x.later]),
      unseen: K.unseen(k, s, f),
      suggestions: sug.map(g => [g.id, g.effect.text || '', g.source || '']),
      shots: K.shots(k, s, f).map(x => [x.item.id, x.have, x.done]),
      open: K.open(k, s, null, f).map(o => o.front + '|' + o.kind + '|' + o.ref + '|' + o.label),
      afterScope: Object.fromEntries(Object.entries(after.scope || {}).sort()),
      wants: K.wants(k, s).map(w => [w.id, w.total, w.general, w.rooms.map(r => r[0] + ':' + r[1])]),
      afterAnswers: Object.fromEntries(Object.entries(after.answers || {}).sort().map(([q, a]) => [q, [a.options.slice().sort(), a.text]])),
    } };
  });
  const conds = COND_CASES.map(([c, fx, want]) => {
    const got = K.evalCond(K.parseCond(c), K.facts(kit, COND_FACTS[fx]));
    if (got !== want) throw new Error('JS engine disagrees with the intended answer for ' + JSON.stringify(c));
    return { cond: c, sketch: COND_FACTS[fx], want };
  });
  return JSON.stringify({ about: 'Written by Sketcher/tools/make-fixture.js from Sketcher/lib/fieldkit.js; replayed by FieldKitTest. Do not edit.', cases, conds }, null, 1) + '\n';
}

const text = build();
if (process.argv.includes('--check')) {
  const old = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (old !== text) { console.error('shadow.json is stale: node Sketcher/tools/make-fixture.js'); process.exit(1); }
  console.log('shadow.json up to date (' + JSON.parse(text).cases.length + ' cases)');
} else { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, text); console.log('wrote ' + path.relative(process.cwd(), OUT)); }
