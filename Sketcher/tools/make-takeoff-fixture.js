#!/usr/bin/env node
// Sketcher/tools/make-takeoff-fixture.js — writes Sketcher/test/fixtures/takeoff.json: surveys (packages with a solved plan,
// and bare survey files) and what the JS takeoff engine (Sketcher/lib/takeoff.js) makes of each, the document AND the
// Hungarian summary. TakeoffTest (sketch-core, JVM) replays every case through Takeoff.kt and must get the same.
//
// The solved cases start from the Planner's own fixture (Planner/projects/varler-planner/tests/sketch-field.json, the
// package the phone's export writes for its test sketch), so the plan is the Kotlin solver's.
//
//   node Sketcher/tools/make-takeoff-fixture.js          (write)
//   node Sketcher/tools/make-takeoff-fixture.js --check  (exit 1 when the committed fixture is stale; Sketcher/test/run.js runs it)
'use strict';
const fs = require('fs'), path = require('path');
const FK = require('../lib/fieldkit.js'), T = require('../lib/takeoff.js');
const ROOT = path.join(__dirname, '..'), REPO = path.join(ROOT, '..');
const OUT = path.join(ROOT, 'test', 'fixtures', 'takeoff.json');
const kit = FK.parseKit(JSON.parse(fs.readFileSync(path.join(ROOT, 'catalog', 'fieldkit.json'), 'utf8')));
const rules = T.parseRules(JSON.parse(fs.readFileSync(path.join(ROOT, 'catalog', 'takeoff.json'), 'utf8')));
const variants = {};
for (const f of fs.readdirSync(path.join(ROOT, 'variants')).filter(f => f.endsWith('.json')).sort()) { const v = JSON.parse(fs.readFileSync(path.join(ROOT, 'variants', f), 'utf8')); variants[v.id] = v; }
const PKG = JSON.parse(fs.readFileSync(path.join(REPO, 'Planner', 'projects', 'varler-planner', 'tests', 'sketch-field.json'), 'utf8'));
const NOW = 1763460000000;
const clone = o => JSON.parse(JSON.stringify(o));
const A = (options, state) => ({ options, text: '', at: NOW - 1000, state: state || 'answered' });

function pkgWith(intake) { const p = clone(PKG); Object.assign(p.sketch, intake); return p; }

const RAW = {
  kind: 'vrg-vazlat', v: 2, id: 'TX', name: 'Árvíztűrő tükörfúrógép 7.', level: 'upper', seq: 60, plugins: ['alaprajz', 'villany'],
  rooms: [{ id: 'R1', poly: [[0, 0], [160, 0], [160, 120], [0, 120]], name: '', kinds: ['konyha'] },
    { id: 'R2', poly: [[160, 0], [240, 0], [240, 120], [160, 120]], name: 'Kamra', kinds: [] }],
  lines: [], measures: [],
  points: [
    { id: 'P3', at: [40, 0], type: 'socket', st: 'meglevo', room: 'R1', edge: 0, t: 0.25 },
    { id: 'P4', at: [80, 0], type: 'socket', st: 'meglevo', room: 'R1', edge: 0, t: 0.5 },
    { id: 'P5', at: [120, 0], type: 'socket', st: 'tervezett', room: 'R1', edge: 0, t: 0.75 },
    { id: 'P6', at: [80, 60], type: 'light', st: 'meglevo' },
    { id: 'P7', at: [0, 60], type: 'fixed', st: 'tervezett', room: 'R1', edge: 3, t: 0.5 },
    { id: 'P8', at: [240, 60], type: 'board', st: 'meglevo', room: 'R2', edge: 1, t: 0.5 },
    { id: 'P9', at: [200, 120], type: 'board', st: 'tervezett', room: 'R2', edge: 2, t: 0.5 },
    { id: 'P10', at: [100, 100], type: 'pont', st: 'tervezett' },
    { id: 'P11', at: [160, 40], type: 'switch', st: 'tervezett', room: 'R1', edge: 1, t: 0.33 }],
  circuits: [{ id: 'K12', name: 'Konyha', col: 4293420060, members: ['P3', 'P4', 'P5'], board: 'P8', ded: false },
    { id: 'K13', name: 'Sütő', col: 4280978651, members: ['P7'], board: 'P8', ded: false },
    { id: 'K14', name: 'Világítás', col: 4282232922, members: ['P6', 'P11'], board: 'P9', ded: false },
    { id: 'K15', name: 'Üres', col: 4282232922, members: [], ded: false }],
  routes: [{ id: 'N16', pts: [[160, 40], [120, 40], [80, 60]], a: 'P11', b: 'P6', circuit: 'K14' }, { id: 'N17', pts: [[10, 10], [30, 10]] }],
  memos: [{ id: 'J18', at: [20, 20], text: 'régi alu' }],
  tags: [{ id: 'T-bontas', name: 'Bontás', col: 4287257814, preset: 'remove' }, { id: 'T-ded', name: 'Dedikált', col: 4292232517, preset: 'dedicated' },
    { id: 'T19', name: 'Csere', col: 4293420060 }],
  tagUses: [{ id: 'U20', tag: 'T-bontas', target: 'P3' }, { id: 'U21', tag: 'T19', target: 'P4' }, { id: 'U22', tag: 'T-ded', target: 'P7' }, { id: 'U23', tag: 'T19', target: 'P6' }],
  photos: [{ id: 'F24', at: [80, 60], room: 'R1', shots: [{ deg: 0, file: 'a.jpg', taken: 1 }, { deg: 180, file: 'b.jpg', taken: 2 }] }],
  entries: [{ id: 'E25', at: NOW - 9000, text: 'Az alu vezetéket mind cserélni kell | sürgős', chips: ['problema', 'fontos'], room: 'R1' },
    { id: 'E26', at: NOW - 8000, text: 'a garázsba is?', chips: ['tisztazando'], open: true, room: 'R9' }],
  scope: { felujitas: 1, eloszto: 1, konyha: 1, dugalj: 5, suto: 1, fozolap: 1, mosogatogep: 1, cee: 1, ledszalag: 3, klima: 1, ev: 1, okos: 1 },
  answers: { lenyeg: A(['csere']), klima_db: A(['4+']), tavolsag: A(['15']), uj_eloszto: A(['igen']), anyag: A(['alu']), kor: A([], 'later'),
    gepek: A(['suto', 'fozolap']), foto: A([], 'skip') },
  captures: [{ id: 'C27', file: 'c.jpg', purpose: 'eloszto', at: NOW, note: '' }, { id: 'C28', file: 'd.jpg', purpose: 'eloszto', at: NOW, note: 'fedél nélkül' },
    { id: 'C29', file: 'e.jpg', purpose: 'idegen', at: NOW, note: '' }],
  dismissed: [], seen: {},
};

const CASES = [
  ['the Planner fixture package as the phone exports it, no intake', PKG, {}],
  ['the same package with an intake: scope, answers, notes, photos', pkgWith({
    scope: { felujitas: 1, dugalj: 3, fozolap: 1, ev: 1, klima: 1, eloszto: 1, ledszalag: 2 },
    answers: { lenyeg: A(['csere']), kor: A([], 'later') },
    entries: [{ id: 'E50', at: NOW, text: 'A konyhában indukció kell', chips: ['kivansag'], room: PKG.sketch.rooms[0].id }, { id: 'E51', at: NOW, text: '', chips: ['tisztazando'], open: true }],
    captures: [{ id: 'C52', file: 'x.jpg', purpose: 'eloszto', at: NOW, note: '' }] }), {}],
  ['the package with a bigger reserve per end', PKG, { endReserveMm: 500, looseEndMm: 150 }],
  ['a bare survey file (no plan): demolition, replacement by a user tag, two boards, home runs, a variant', Object.assign(clone(RAW), { variant: 'furdo-felujitas', variantOn: true }), {}],
  ['the bare survey with the implied dedicated circuits switched on', clone(RAW), { impliedDedicated: true }],
  ['the same without the variant, the EV answer missing', Object.assign(clone(RAW), { answers: Object.assign({}, RAW.answers, { tavolsag: A([], 'later'), klima_db: A(['2']) }) }), {}],
  // F4 (WP M49): the client's wants by room show on the rooms; the job totals stay what drives the items
  ['wants by room: two in the kitchen, one in the pantry, one for the job', Object.assign(clone(RAW), { scope: Object.assign({}, RAW.scope, { dugalj: 4, lampa: 1 }),
    roomScope: { R1: { dugalj: 2, lampa: 1 }, R2: { dugalj: 1 } } }), {}],
  // F8 (WP M53): a walk video and the client's signature are listed under the names the phone's export gives them
  ['Kamera 2 media: a video (.mp4) and a signature (_alairas.png) among the photos', Object.assign(clone(RAW), { captures: RAW.captures.concat([
    { id: 'C40', file: 'v.mp4', purpose: 'nyomvonal', at: NOW, note: '', kind: 'video', durationMs: 61000, bytes: 1000 },
    { id: 'C41', file: 's.png', purpose: 'dokumentum', at: NOW, note: 'A felmérést átvettem', kind: 'signature', signer: 'Ügyfél' }]) }), {}],
  // F5 (WP M50, D-80): the built-in Csere tag (preset replace) marks a replacement, the user's own tag is gone
  ['the built-in Csere tag', Object.assign(clone(RAW), { tags: RAW.tags.filter(t => t.id !== 'T19').concat([{ id: 'T-csere', name: 'Csere', col: 4293420060, preset: 'replace' }]),
    tagUses: RAW.tagUses.map(u => u.tag === 'T19' ? Object.assign({}, u, { tag: 'T-csere' }) : u) }), {}],
  // F5 (WP M50, D-84): a sound note (kind audio) is listed nowhere among the photos
  ['a sound note beside the photos', Object.assign(clone(RAW), { captures: RAW.captures.concat([{ id: 'C40', file: 'hang_1.m4a', purpose: 'hang', kind: 'audio', at: NOW, note: 'a csempe alatt?', durationMs: 42000, bytes: 300000 }]) }), {}],
  ['an empty survey', { kind: 'vrg-vazlat', v: 2, id: 'E0', name: '', seq: 0, rooms: [], points: [], circuits: [], routes: [], memos: [], entries: [], scope: {}, answers: {}, captures: [] }, {}],
];

function build() {
  const cases = CASES.map(([name, input, opts]) => {
    const inp = T.input(input), s = inp.sketch;
    const k = s.variantOn && variants[s.variant] ? FK.withVariant(kit, variants[s.variant]) : kit;
    const t = T.build(k, rules, s, inp.plan, Object.assign({ now: NOW }, opts));
    return { name, input, opts, variant: s.variantOn ? s.variant || null : null, expect: t, markdown: T.markdown(t) };
  });
  return JSON.stringify({ about: 'Written by Sketcher/tools/make-takeoff-fixture.js from Sketcher/lib/takeoff.js; replayed by TakeoffTest. Do not edit.', now: NOW, cases }, null, 1) + '\n';
}

// the Planner's import test (spec-112) reads a package that carries the takeoff, as the phone's export now writes it
const PLANNER_OUT = path.join(REPO, 'Planner', 'projects', 'varler-planner', 'tests', 'sketch-intake.json');
function plannerPackage(text) {
  const c = JSON.parse(text).cases[1];
  return JSON.stringify(Object.assign({}, c.input, { takeoff: c.expect }), null, 1) + '\n';
}

const text = build(), ptext = plannerPackage(text);
if (process.argv.includes('--check')) {
  const old = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (old !== text) { console.error('takeoff.json is stale: node Sketcher/tools/make-takeoff-fixture.js'); process.exit(1); }
  const pold = fs.existsSync(PLANNER_OUT) ? fs.readFileSync(PLANNER_OUT, 'utf8') : '';
  if (pold !== ptext) { console.error('Planner tests/sketch-intake.json is stale: node Sketcher/tools/make-takeoff-fixture.js'); process.exit(1); }
  console.log('takeoff.json up to date (' + JSON.parse(text).cases.length + ' cases), Planner sketch-intake.json too');
} else {
  fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, text); fs.writeFileSync(PLANNER_OUT, ptext);
  console.log('wrote ' + path.relative(process.cwd(), OUT) + ' and ' + path.relative(process.cwd(), PLANNER_OUT));
}
