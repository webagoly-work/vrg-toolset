// Sketcher/test/e2e.test.js — F8 Összefésülés (WP M53): phone → package → Desktop page → Planner, end to end.
//
// Every scenario in fixtures/e2e/*.json is a survey the phone's own code built and exported (sketch-core E2eTest writes
// them; VRG_SKETCH_FIXTURE=update ./gradlew :sketch-core:test). `package` is the file the Rendezés export shares, with the
// takeoff inside; `phone` is what the phone itself shows. Here the JS engines, the Desktop page (jsdom, as page.test.js)
// and the Planner (its built page, as spec-112) open that same file and must show the same numbers. The two old files
// (an M24 v1 sketch, an M29-era v2 survey) must open on the page unchanged.
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const DIR = path.join(__dirname, 'fixtures', 'e2e');
let JSDOM;
try { ({ JSDOM } = require(path.join(ROOT, 'Planner/projects/varler-planner/node_modules/jsdom'))); }
catch (e) { console.log('SKIP e2e.test: jsdom not installed (Planner/projects/varler-planner/node_modules/jsdom)'); process.exit(0); }
const FK = require(path.join(ROOT, 'Sketcher/lib/fieldkit.js')), TK = require(path.join(ROOT, 'Sketcher/lib/takeoff.js'));
const SM = require(path.join(ROOT, 'Map/lib/site-math.js')), RP = require(path.join(ROOT, 'Sketcher/lib/report.js'));
const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const KIT = FK.parseKit(read(path.join(ROOT, 'Sketcher/catalog/fieldkit.json')));
const RULES = TK.parseRules(read(path.join(ROOT, 'Sketcher/catalog/takeoff.json')));
const VARIANTS = {};
fs.readdirSync(path.join(ROOT, 'Sketcher/variants')).filter(f => f.endsWith('.json')).forEach(f => { const v = read(path.join(ROOT, 'Sketcher/variants', f)); VARIANTS[v.id] = v; });

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL: ' + m); } };
// org.json (the phone) writes an object's keys in its own order: compare with the keys sorted
const canon = v => Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.keys(v).sort().reduce((o, k) => (o[k] = canon(v[k]), o), {}) : v;
const J = v => JSON.stringify(canon(v));
const eq = (a, b, m) => ok(J(a) === J(b), m + ' (got ' + J(a).slice(0, 600) + ', want ' + J(b).slice(0, 600) + ')');
const sorted = o => Object.keys(o).sort().reduce((x, k) => (x[k] = o[k], x), {});

const scenarios = fs.readdirSync(DIR).filter(f => /^[a-z]-.*\.json$/.test(f)).sort().map(f => Object.assign(read(path.join(DIR, f)), { file: f }));
ok(scenarios.length >= 3, 'at least three scenarios (' + scenarios.length + ')');
const kitOf = s => s.variantOn && VARIANTS[s.variant] ? FK.withVariant(KIT, VARIANTS[s.variant]) : KIT;

// ---- 1. the engines: the JS takeoff of the package is the one the phone put in it ----------------------------------
for (const sc of scenarios) {
  const p = sc.package, s = p.sketch, t0 = p.takeoff, id = sc.id;
  ok(p.kind === 'vrg-sketch' && s.kind === 'vrg-vazlat' && s.v === 2 && t0 && t0.kind === 'vrg-sketch-takeoff', id + ': a package with its survey and takeoff');
  const t = TK.build(kitOf(s), RULES, s, TK.planFromPackage(p), { now: t0.made, impliedDedicated: t0.config.impliedDedicated });
  eq(t, t0, id + ': the JS takeoff equals the phone\'s');
  eq(TK.markdown(t), sc.markdown, id + ': and the summary text');
  eq(t.items.map(x => [x.id, x.qty, x.est]), sc.phone.items, id + ': the items the phone shows');
  // the wants by room (Wants.kt ↔ fieldkit.js)
  const ws = FK.wants(kitOf(s), s), rooms = (s.rooms || []).map(r => r.id);
  const byRoom = rooms.map(r => ({ room: r, items: ws.filter(w => w.rooms.some(x => x[0] === r)).reduce((o, w) => (o[w.id] = w.rooms.find(x => x[0] === r)[1], o), {}) }))
    .filter(x => Object.keys(x.items).length);
  const gen = ws.filter(w => w.general > 0).reduce((o, w) => (o[w.id] = w.general, o), {});
  if (Object.keys(gen).length) byRoom.push({ room: null, items: gen });
  eq(byRoom.map(x => [x.room, sorted(x.items)]), sc.phone.wants.map(x => [x.room, sorted(x.items)]), id + ': the wants by room');
  // the site report (SitePlace.kt ↔ site-math.js) from the package's own floors
  const si = s.site || {};
  const rep = si.place && (si.outline || []).length >= 3 ? SM.report(SM.roomsFromMm(p.plan.data.floors), si.outline, si.place) : null;
  eq(rep ? SM.reportLines(rep) : [], sc.phone.site.lines, id + ': the site report');
  // the loose ends (FieldKit.open) with the package's solve
  const norm = { rooms: p.plan.data.floors.map(f => ({ id: f.sk.id, name: f.name, inferred: f.sk.est.length > 0 })) };
  eq(FK.open(kitOf(s), s, norm).length, sc.phone.open, id + ': the loose ends');
  // every file the takeoff lists is one the export sends
  const files = new Set(sc.phone.files);
  ok(t.photos.every(g => g.files.every(f => files.has(f))), id + ': the takeoff names only files the export writes');
  // F5's Felmérési jegyzőkönyv (report.js) from the package: the takeoff's items with their quantities, the site
  // report, the signatures and sound notes in their own sections, no client contact (the package has none: D-82)
  const m = RP.model(kitOf(s), s, t0, { now: sc.now, siteLines: sc.phone.site.lines }), doc = RP.html(m);
  ok(t0.items.every(x => doc.includes(x.label) && doc.includes(TK.fmt(x.qty))), id + ': the report lists every item with its quantity');
  eq(m.signatures.length, (s.captures || []).filter(c => c.kind === 'signature').length, id + ': the report\'s signatures');
  ok(m.photos.every(g => g.items.every(c => c.kind !== 'audio' && c.kind !== 'signature')), id + ': no sound note or signature among the report\'s photos');
  ok(!m.client && !/id="ugyfel"/.test(doc), id + ': no client contact in a report of the package');
  ok(sc.phone.site.lines.every(l => doc.includes(l.replace(/&/g, '&amp;'))), id + ': the site report in it');
}

// ---- 2. the Desktop page ----------------------------------------------------------------------------------------------
function desktop(done) {
  const html = fs.readFileSync(path.join(ROOT, 'Sketcher/dist/vrg-sketcher.html'), 'utf8');
  const errors = [];
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'file:///x/vrg-sketcher.html',
    beforeParse(w) { w.addEventListener('error', e => errors.push(e.message)); } });
  const w = dom.window, doc = w.document;
  const run = () => {
    const sk = w.__sketcher, $ = q => doc.querySelector(q), $$ = q => Array.from(doc.querySelectorAll(q));
    const click = el => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
    const rail = f => $('.rb[data-front="' + f + '"]'), main = () => $('#main').textContent;
    const fronts = $$('.rb').map(b => b.dataset.front);
    for (const sc of scenarios) {
      const p = sc.package, id = sc.id, ph = sc.phone;
      sk.load(JSON.parse(JSON.stringify(p)), sc.file);
      ok(sk.state().id === p.sketch.id, id + ': the page opens the package');
      for (const f of fronts) { click(rail(f)); ok($('#view') && $('#view').dataset.front === f && !$('#main .msg.err'), id + ': front ' + f + ' renders'); }
      // the same takeoff as the phone, the phone's dedicated-circuit setting included (D-111)
      eq(sk.takeoff().items, p.takeoff.items, id + ': the page\'s takeoff is the phone\'s');
      click(rail('munkakor'));
      eq($$('#takeoff .tk-item').length, ph.counts.items, id + ': one row per item');
      eq($$('#takeoff .tk-item.est').length, ph.counts.est, id + ': the guessed rows');
      eq($$('#takeoff .tk-item.open').length, ph.counts.open, id + ': the rows an open decision changes');
      ok($('#tkimplied').classList.contains('sel') === p.takeoff.config.impliedDedicated, id + ': the toggle shows the phone\'s setting');
      ok(!!$('#tkfromphone'), id + ': and says it is the phone\'s');
      // the wants: every room that holds some is named on the Szobánként card
      const wantRooms = ph.wants.filter(x => x.room).map(x => x.room);
      if (wantRooms.length) {
        const card = $('.card.wants'); ok(!!card, id + ': the Szobánként card');
        const names = wantRooms.map(r => { const f = p.plan.data.floors.find(x => x.sk.id === r); return f && f.name; });
        ok(card && names.every(n => n && card.textContent.includes(n)), id + ': every room with wants is on it (' + names.join(', ') + ')');
      }
      // questions: the answered ones collapsed, as many as the phone counts
      click(rail('kerdes'));
      eq($$('#qdone .qcard').length, ph.questions.answered, id + ': the answered questions');
      // loose ends
      click(rail('nyitott'));
      eq(Number(($('[data-badge="nyitott"]') || {}).textContent || 0), ph.open, id + ': the Nyitott badge is the phone\'s count');
      // the site report the phone shows, on Helyszín
      click(rail('helyszin'));
      ok(ph.site.lines.every(l => main().includes(l)), id + ': the site report on Helyszín');
      // the photos: each capture's card names the file the phone exports
      click(rail('kamera'));
      for (const c of p.sketch.captures || []) {
        const card = $('.cap-card[data-cap="' + c.id + '"]');
        const name = ph.files.find(f => f.includes('_' + c.id + '_') && !f.endsWith('_jel.jpg'));
        ok(card && name && card.textContent.includes(name), id + ': capture ' + c.id + ' shown as ' + name);
      }
      // the save is lossless: the survey and the plan as they came
      const out = JSON.parse(sk.save());
      eq(out.plan, p.plan, id + ': the plan is unchanged by a save');
      eq(Object.keys(p.sketch).filter(k => J(out.sketch[k]) !== J(p.sketch[k]) && k !== 'seen'), [], id + ': the survey is unchanged by a save');
      eq(out.takeoff.items, p.takeoff.items, id + ': the saved takeoff is the phone\'s');
    }
    // F6 (M51, D-93): every feature off in this browser: the saved package is the same, the takeoff too
    {
      const FE = require(path.join(ROOT, 'Sketcher/lib/features.js'));
      const a = scenarios[0];
      sk.load(JSON.parse(JSON.stringify(a.package)));
      const before = JSON.parse(sk.save());
      sk.setFeatures(FE.all(sk.features(), false));
      ok(!FE.on(sk.features(), 'export.takeoff') && !FE.on(sk.features(), 'export.report'), 'every feature off on the page');
      for (const f of fronts) { const b = rail(f); if (b) { click(b); ok(!$('#main .msg.err'), 'all off: front ' + f + ' still renders'); } }
      const after = JSON.parse(sk.save());
      delete after.takeoff.made; delete before.takeoff.made;   // the page stamps the time it was saved
      eq(after, before, 'all off: the saved package is unchanged (D-93)');
      sk.setFeatures(FE.all(sk.features(), true));
    }
    // the toggle still works and then becomes the page's own
    const b = scenarios.find(x => x.package.takeoff.config.impliedDedicated);
    if (b) {
      sk.load(JSON.parse(JSON.stringify(b.package)));
      click(rail('munkakor')); click($('#tkimplied'));
      ok(sk.takeoff().config.impliedDedicated === false && !$('#tkfromphone'), 'touching the toggle makes it the page\'s own setting');
    }
    // the old files
    for (const f of ['old-v1-m24.vsketch.json', 'old-v2-m29.vsketch.json']) {
      const o = read(path.join(DIR, f));
      sk.load(JSON.parse(JSON.stringify(o)), f);
      ok(sk.state().name === o.name, f + ': opens');
      for (const fr of fronts) { click(rail(fr)); ok($('#view') && $('#view').dataset.front === fr && !$('#main .msg.err'), f + ': front ' + fr + ' renders'); }
      const t = sk.takeoff();
      ok(t.kind === 'vrg-sketch-takeoff' && t.source.plan === 'nyers' && t.items.length > 0, f + ': takes off from the raw sketch');
      const out = JSON.parse(sk.save());
      eq(Object.keys(o).filter(k => J(out[k]) !== J(o[k]) && k !== 'seen'), [], f + ': saved unchanged');
    }
    ok(errors.length === 0, 'no script errors on the page: ' + errors.join('; '));
    done();
  };
  if (doc.readyState === 'complete') run(); else w.addEventListener('load', run);
}

// ---- 3. the Planner ---------------------------------------------------------------------------------------------------
function planner(done) {
  const f = path.join(ROOT, 'Planner/projects/varler-planner/dist/varler_planner.html');
  if (!fs.existsSync(f)) { console.log('SKIP the Planner part: no build (node Planner/projects/varler-planner/build.js)'); done(); return; }
  const dom = new JSDOM(fs.readFileSync(f, 'utf8'), { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
  const w = dom.window;
  setTimeout(() => {
    try {
      w.confirm = () => true; w.alert = () => {};
      for (const sc of scenarios) {
        const p = sc.package, id = sc.id, ph = sc.phone;
        w.hardResetWorkspace();
        w.skiImport(JSON.parse(JSON.stringify(p)));
        const D = w.__data, B = w.eval('B');
        eq([D.floors.length, D.devices.length], [ph.floors, ph.devices], id + ': the Planner imports the drawing');
        const sv = B.survey;
        ok(sv && sv.src === 'vazlat' && sv.takeoff, id + ': the survey lands on the building');
        eq(sv && sv.takeoff.counts, p.takeoff.counts, id + ': with the phone\'s counts');
        eq(sv && sv.takeoff.items.map(x => [x.id, x.qty, x.est]), ph.items, id + ': and items');
        eq(sv && sv.raw.captures.length, (p.sketch.captures || []).length, id + ': the raw intake keeps every capture');
        ok(sv && sv.raw.captures.every(c => { const o = p.sketch.captures.find(x => x.id === c.id); return (o.kind || 'photo') === (c.kind || 'photo'); }), id + ': a video / signature stays one');
        w.actionById('sketch.survey').run({});
        const body = w.document.getElementById('svyBody').innerHTML;
        ok(p.takeoff.photos.every(g => g.files.every(n => body.includes(n))), id + ': the panel lists the files by their export names');
        eq(w.document.querySelectorAll('#svyBody .svy-item').length, ph.counts.items, id + ': one row per item');
        w.closeModal();
        ok(w.sessionObj().building.survey.takeoff.items.length === ph.counts.items, id + ': a save carries it');
      }
    } catch (e) { fail++; console.log('FAIL: the Planner part threw: ' + (e && e.stack || e)); }
    done();
  }, 300);
}

desktop(() => planner(() => {
  console.log(fail ? fail + ' FAILED of ' + (pass + fail) : 'ALL PASS (' + pass + ')');
  process.exit(fail ? 1 : 0);
}));
