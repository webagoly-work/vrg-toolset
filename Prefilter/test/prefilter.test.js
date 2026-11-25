// Előszűrő (Prefilter) tests: the tokenizer and the Hungarian stemmer, an index over a throwaway fixture repo (+ a fake Full with a
// job folder and a features map), labelled example prompts in Hungarian and English, dress() shape and limits, determinism, the cache.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), os = require('os'), path = require('path');
const pf = require('../prefilter.js');

function fixture() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vrg-prefilter-'));
  const repo = path.join(tmp, 'repo'), full = path.join(tmp, 'Full');
  const put = (p, text) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); };
  put(path.join(repo, 'launcher', 'vrg-catalog.json'), JSON.stringify({ items: [
    { id: 'planner', title: { hu: 'Varler Planner', en: 'Varler Planner' }, qualifier: 'electrical plan editor' },
    { id: 'kapu', title: { hu: 'VRG Kapu', en: 'VRG Gate' }, qualifier: 'access page, sign-in' },
    { id: 'munkavaszon', title: { hu: 'Munkavászon', en: 'Session Canvas' }, qualifier: 'observability' },
    { id: 'web', title: { hu: 'Böngésző', en: 'Browser' }, qualifier: 'embedded browser' },
    { id: 'stack.layers', title: { hu: 'Rétegek', en: 'Layers' }, qualifier: 'view' },
  ] }));
  put(path.join(repo, 'launcher', 'vrg-menu.json'), JSON.stringify({ start: { tools: [{ key: '1', name: 'Varler Planner' }, { key: 'K', name: 'VRG Kapu', hint: 'belépés' }],
    dev: [{ key: 'R', name: 'Rétegverem', menu: { items: [{ key: 'A', name: 'Archívum' }] } }] }, servers: [{ id: 'kapu', name: 'Kapu szerver', port: 8800 }] }));
  put(path.join(repo, 'CLAUDE.md'), '# Rules\n\n## Codephrases\n\n- **`GO MOBILE`** — the phone app\n\n**Old phrases** (typed by habit): R1010, FRAME → GO PLANNER · WIRE → GO ROUTE ·\nALL → done.\n\n## Testing\nServe the folder.\n');
  put(path.join(repo, 'GO-MOBILE.md'), '# GO MOBILE — VRG Mobile, one work package at a time\n\n## M16 relay pairing\nThe relay pairs the phone.\n\n## M8 sketcher\n');
  put(path.join(repo, 'GO-PLANNER.md'), '# GO PLANNER — the Planner work\n\n## Router and wiring\nThe PCB-style router.\n');
  put(path.join(repo, 'GO-ROUTE.md'), '# GO ROUTE — wiring\n');
  put(path.join(repo, 'docs', 'mobile', 'WP', 'M16.md'), '# M16 — relay pairing\n');
  put(path.join(repo, 'docs', 'hub', 'ARCHITECTURE.md'), '# Kapu architecture\n## Belépés és vendég mód\n');
  put(path.join(repo, 'Dashboard', 'shell', 'lib', 'sessions.js'), '// x\n');
  put(path.join(full, 'jobs', 'CLA001_Kovacs', 'a.txt'), 'x');
  put(path.join(full, 'notes', 'features', 'features.json'), JSON.stringify({ features: [{ id: 'k2', title: 'Topológia nézet' }] }));
  return { tmp, repo, full };
}
let FX, IDX;
const idx = () => { if (!IDX) { FX = fixture(); IDX = pf.buildIndex({ repo: FX.repo, full: FX.full, git: path.join(FX.tmp, 'no-git') }); } return IDX; };
const run = (t, o) => pf.analyze(t, { index: idx(), ...(o || {}) });

test('fold, stem, tokenize: accents, Hungarian endings, hyphenated endings, digits', () => {
  assert.strictEqual(pf.fold('Rétegverem ŐŰ'), 'retegverem ou');
  assert.strictEqual(pf.stem('plannerben'), 'planner');
  assert.strictEqual(pf.stem('routert'), 'router');
  assert.strictEqual(pf.stem('kapuban'), 'kapu');
  assert.strictEqual(pf.stem('belepest'), 'belepes');
  assert.strictEqual(pf.stem('m16'), 'm16');
  assert.strictEqual(pf.stem('main'), 'main');                     // short words are kept whole
  const t = pf.tokenize('Planner-t és az M16-ot, Plannerben!');
  assert.deepStrictEqual(t.map(x => x.stem), ['planner', 'es', 'az', 'm16', 'planner']);
  assert.deepStrictEqual(t.map(x => x.raw), ['Planner', 'és', 'az', 'M16', 'Plannerben']);
});

test('buildIndex: sources, codephrases and old aliases, jobs and features from Full, files without git', () => {
  const i = idx();
  assert.deepStrictEqual(i.codephrases.map(c => c.phrase), ['GO MOBILE', 'GO PLANNER', 'GO ROUTE']);
  assert.deepStrictEqual(i.aliases.map(a => a.alias + '>' + a.file), ['R1010>GO-PLANNER.md', 'FRAME>GO-PLANNER.md', 'WIRE>GO-ROUTE.md']);
  assert.deepStrictEqual(i.jobs, ['CLA001']);
  assert.ok(i.entities.some(e => e.kind === 'feature' && e.title === 'Topológia nézet'));
  assert.ok(i.files.includes('Dashboard/shell/lib/sessions.js'));
  assert.ok(i.names.planner > 0 && i.refs.m16.some(r => /M16|GO-MOBILE/.test(r)));
  // no Full (the cloud): still builds
  const j = pf.buildIndex({ repo: FX.repo, full: path.join(FX.tmp, 'nope'), git: path.join(FX.tmp, 'no-git') });
  assert.deepStrictEqual(j.jobs, []);
  assert.ok(j.codephrases.length === 3);
});

// labelled prompts: [text, expected verdict(s), expected intent or null]
const CASES = [
  ['GO MOBILE folytasd az M16-ot', ['context'], 'continue'],
  ['írj egy verset a télről', ['independent'], null],
  ['nézd át a Planner routert', ['context'], 'review'],
  ["what's the capital of Peru", ['independent'], 'ask'],
  ['javítsd a Kapu belépést', ['context'], 'fix'],
  ['folytasd ahol abbahagytuk', ['context', 'unsure'], 'continue'],
  ['write a python function that sorts a list', ['independent'], 'build'],
  ['WIRE: a vezetékezés lépése jön', ['context'], null],
  ['a CLA001 árajánlatát nézd meg', ['context'], 'review'],
  ['a Dashboard/shell/lib/sessions.js-ben rossz a jelzés', ['context'], 'fix'],
  ['tervezd meg a Topológia nézet következő lépését', ['context'], 'plan'],
  ['explain how TCP congestion control works', ['independent'], 'ask'],
  ['hogyan főzzek gulyáslevest?', ['independent'], 'ask'],
  ['a Munkavászon nem mutatja a sávokat', ['context', 'unsure'], null],
  ['research the best Android QR scanner libraries', ['independent'], 'research'],
];

test('labelled prompts: verdict and intent', () => {
  for (const [text, verdicts, intent] of CASES) {
    const a = run(text);
    assert.ok(verdicts.includes(a.verdict), text + ' → ' + a.verdict + ' ' + a.score + ' ' + JSON.stringify(a.signals));
    if (intent) assert.strictEqual(a.intent, intent, text);
    assert.ok(a.score >= 0 && a.score <= 1);
    assert.ok(['haiku', 'sonnet', 'opus'].includes(a.model));
  }
});

test('signals and anchors: codephrase file, job, path, alias; generic words never anchor alone', () => {
  const a = run('GO MOBILE folytasd az M16-ot');
  assert.ok(a.signals.some(s => s.kind === 'codephrase' && s.ref === 'GO-MOBILE.md'));
  assert.ok(a.signals.some(s => s.kind === 'deictic'));
  assert.strictEqual(a.anchors[0].source, 'GO-MOBILE.md');
  assert.ok(run('a CLA001 árajánlatát').signals.some(s => s.kind === 'job' && s.text === 'CLA001'));
  assert.ok(!run('a cla001 árajánlatát').signals.some(s => s.kind === 'job'), 'job codes are matched as typed');
  const p = run('a Dashboard/shell/lib/sessions.js-ben');
  assert.deepStrictEqual(p.signals.filter(s => s.kind === 'path').map(s => s.ref), ['Dashboard/shell/lib/sessions.js']);
  assert.ok(!p.signals.some(s => s.kind === 'term'), 'words inside a path are not counted again');
  assert.ok(!run('please wire the lamp').signals.some(s => s.kind === 'codephrase'), 'old aliases only in capitals');
  const w = run('open the web browser');
  assert.ok(!w.signals.some(s => s.kind === 'catalog'), 'a generic word is not an anchor alone');
  // attachments
  const at = run('nézd át', { attachments: [{ name: 'sessions.js', ext: 'js' }, { name: 'quote.pdf', ext: 'pdf' }] });
  assert.ok(at.signals.some(s => s.kind === 'file' && s.ref === 'Dashboard/shell/lib/sessions.js'));
  assert.ok(at.anchors.some(x => x.source === 'melléklet'));
});

test('models: plan → opus, a short independent question → haiku, a long prompt goes up a step', () => {
  assert.strictEqual(run('tervezd meg a Topológia nézet következő lépését').model, 'opus');
  assert.strictEqual(run("what's the capital of Peru").model, 'haiku');
  const long = run('javítsd a Kapu belépést. ' + 'A részletek: '.repeat(80));
  assert.strictEqual(long.model, 'opus');
  assert.ok(long.reasons.some(r => /hosszú/.test(r)));
});

test('dress: the user text verbatim in the middle, the header by verdict, overhead within the limit, mode override', () => {
  const text = 'GO MOBILE folytasd az M16-ot';
  const a = run(text);
  const d = pf.dress(text, a);
  assert.strictEqual(d.parts.user, text);
  assert.ok(d.prompt.includes('\n\n' + text + '\n\n'));
  assert.match(d.parts.before, /^\[VRG Előszűrő · kontextusfüggő/);
  assert.match(d.parts.before, /stack_search "GO MOBILE M16"/);
  assert.match(d.parts.before, /GO-MOBILE\.md/);
  assert.match(d.parts.before, /Stack\/out\/stack\.json/);
  assert.match(d.parts.after, /Elvárt forma/);
  assert.strictEqual(d.length, d.prompt.length);
  assert.ok(d.overhead <= 1500 + 4);
  const ind = pf.dress('írj egy verset a télről', run('írj egy verset a télről'));
  assert.match(ind.parts.before, /önálló kérés/);
  assert.strictEqual(ind.parts.after, '');
  const forced = pf.dress(text, a, { mode: 'independent' });
  assert.strictEqual(forced.verdict, 'independent');
  assert.match(forced.parts.before, /önálló/);
  const uns = pf.dress('x', { ...run('folytasd'), verdict: 'unsure' });
  assert.match(uns.parts.before, /bizonytalan/);
  // a huge anchor list is cut to the limit, the user text never
  const big = { ...a, anchors: Array.from({ length: 5 }, (_, i) => ({ id: 'x' + i, title: 'y'.repeat(400), kind: 'term', source: 'z'.repeat(200) })) };
  const bd = pf.dress(text + ' ' + 'é'.repeat(5000), big);
  assert.ok(bd.overhead <= 1500 + 4, 'overhead ' + bd.overhead);
  assert.ok(bd.prompt.includes('é'.repeat(5000)));
});

test('determinism, an empty index, and the cache', () => {
  const a = JSON.stringify({ ...run('nézd át a Planner routert'), ms: 0 });
  const b = JSON.stringify({ ...run('nézd át a Planner routert'), ms: 0 });
  assert.strictEqual(a, b);
  const e = pf.analyze('GO MOBILE', {});
  assert.strictEqual(e.verdict, 'independent');
  assert.strictEqual(pf.analyze('', { index: idx() }).verdict, 'independent');
  const cacheDir = path.join(FX.tmp, 'cache');
  const c1 = pf.loadIndex({ repo: FX.repo, full: FX.full, cacheDir, git: path.join(FX.tmp, 'no-git') });
  assert.ok(fs.existsSync(path.join(cacheDir, 'index.json')));
  const c2 = pf.loadIndex({ repo: FX.repo, full: FX.full, cacheDir, git: path.join(FX.tmp, 'no-git') });
  assert.strictEqual(c2.builtAt, c1.builtAt, 'the second load comes from the cache');
  const go = path.join(FX.repo, 'GO-MOBILE.md');
  const t = new Date(Date.now() + 5000); fs.utimesSync(go, t, t);
  const c3 = pf.loadIndex({ repo: FX.repo, full: FX.full, cacheDir, git: path.join(FX.tmp, 'no-git') });
  assert.notStrictEqual(c3.sig, c1.sig, 'a newer source rebuilds');
});
