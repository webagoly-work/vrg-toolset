// Sketcher/test/page.test.js — the Desktop page in jsdom, against the real field package.
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
let JSDOM;
try { ({ JSDOM } = require(path.join(ROOT, 'Planner/projects/varler-planner/node_modules/jsdom'))); }
catch (e) { console.log('SKIP page.test: jsdom not installed (Planner/projects/varler-planner/node_modules/jsdom)'); process.exit(0); }
const html = fs.readFileSync(path.join(ROOT, 'Sketcher/dist/vrg-sketcher.html'), 'utf8');
const pkgObj = JSON.parse(fs.readFileSync(path.join(ROOT, 'Planner/projects/varler-planner/tests/sketch-field.json'), 'utf8'));
const FK = require(path.join(ROOT, 'Sketcher/lib/fieldkit.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL: ' + m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')');

const errors = [];
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'file:///x/vrg-sketcher.html',
  beforeParse(w) { w.addEventListener('error', e => errors.push(e.message)); } });
const w = dom.window, doc = w.document;
let sk;
const $ = s => doc.querySelector(s), $$ = s => Array.from(doc.querySelectorAll(s));
const click = el => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
const rail = id => $('.rb[data-front="' + id + '"]');
const mainText = () => $('#main').textContent;
const qs = () => $$('.qcard').map(c => c.dataset.q);

function main() {
sk = w.__sketcher;
ok(sk && typeof sk.load === 'function' && typeof sk.state === 'function' && typeof sk.save === 'function' && typeof sk.front === 'function', 'test hook present');
ok(/Nyiss meg/.test(mainText()), 'empty state before a survey is loaded');
sk.load(pkgObj);
ok(sk.state().kind === 'vrg-vazlat' && sk.state().name === 'Kossuth u. 12', 'package opened, survey extracted');
ok($('#hinfo').textContent.includes('Kossuth u. 12'), 'header shows the survey name');

// fronts
const fronts = ['attekintes', 'vazlat', 'jegyzet', 'munkakor', 'kerdes', 'kamera', 'helyszin', 'nyitott', 'variansok', 'funkciok'];
eq($$('.rb').length, fronts.length, 'rail has one symbol per front');
ok($$('.rb .sym').every(s => s.textContent.trim().length > 0) && $$('.rb').every(b => b.getAttribute('title')), 'every rail button is a symbol with a tooltip');
for (const f of fronts) {
  click(rail(f));
  ok($('#view') && $('#view').dataset.front === f && !$('#main .msg.err') && $('#view').innerHTML.length > 20, 'front ' + f + ' renders');
}

// Vázlat
click(rail('vazlat'));
eq($$('#plansvg polygon.fl').length, 2, 'Vázlat SVG has the 2 floors');
eq($$('#plansvg line.est').length, 2, 'two orange estimated edges');
ok($$('#plansvg text.e').length === 2 && /^≈ /.test($('#plansvg text.e').textContent), 'estimated edges carry an "≈ length" label');
ok($$('#plansvg circle.dev.meglevo').length > 0 && $$('#plansvg circle.dev.tervezett').length > 0, 'devices coloured existing vs planned');
eq($$('#plansvg path.wedge').length, 4, 'photo point has 4 wedges');
eq($$('#plansvg path.wedge.shot').length, 1, 'one wedge filled where a shot exists');

// Kérdések: lenyeg -> csere
click(rail('kerdes'));
ok(qs().includes('lenyeg') && !qs().includes('kor'), 'lenyeg open, kor not yet shown');
click($('.qcard[data-q="lenyeg"] [data-o="csere"]'));
ok(sk.state().scope.felujitas === 1, 'answer csere adds scope felujitas');
eq(sk.state().answers.lenyeg.options, ['csere'], 'answer stored with options');
ok(sk.state().answers.lenyeg.state === 'answered' && typeof sk.state().answers.lenyeg.at === 'number', 'answer state and time');
ok(qs().includes('kor'), 'existing-installation question kor appears');
ok($('#qdone') && $('#qdone .qcard[data-q="lenyeg"]'), 'answered question collapsed into Megválaszolva');
ok(sk.state().seen.kor > 0, 'first appearance recorded in seen');

// free text + num
const keret = $('.qcard[data-q="keret"] input[data-qtext]');
ok(!!keret && /Ft/.test($('.qcard[data-q="keret"]').textContent), 'num question has a unit label');
keret.value = '500000'; keret.dispatchEvent(new w.Event('change', { bubbles: true }));
eq(sk.state().answers.keret.text, '500000', 'free text stored on change');

// Később
const before = qs(), firstOpen = before.find(id => id !== 'lenyeg');
click($(`.qcard[data-q="${firstOpen}"] [data-act="qlater"]`));
ok(sk.state().answers[firstOpen].state === 'later', 'Később stores state later');
const after = qs(), openIds = after.filter(id => !sk.state().answers[id] || sk.state().answers[id].state === 'later');
ok(after.indexOf(firstOpen) > after.indexOf($$('.qcard:not(.later):not(#qdone .qcard)')[0].dataset.q) && openIds.length > 1, 'later question moved below the open ones');
click($(`.qcard[data-q="${firstOpen}"] [data-act="qclear"]`));
ok(!sk.state().answers[firstOpen], 'clear removes the answer');
click($('.qcard[data-q="keret"] [data-act="qskip"]'));
ok(sk.state().answers.keret.state === 'skip' && !qs().includes('keret'), 'Nem releváns hides the question');

// Jegyzet: bojler suggestion
click(rail('jegyzet'));
$('#ntext').value = 'Az ügyfél szerint a bojler is cserére szorul'; $('#ntext').dispatchEvent(new w.Event('input', { bubbles: true }));
click($('.pill[data-act="nchip"][data-id="kivansag"]'));
ok($('.pill[data-id="kivansag"]').classList.contains('sel'), 'chip toggles selected');
const seq0 = sk.state().seq;
click($('#nadd'));
const ent = sk.state().entries.slice(-1)[0];
ok(ent && ent.id === 'E' + (seq0 + 1) && sk.state().seq === seq0 + 1, 'entry id from seq (E<seq+1>), seq advanced');
ok(ent.text.includes('bojler') && ent.chips.includes('kivansag') && typeof ent.at === 'number', 'entry has text, chips, time');
ok($$('.ent').length === 1 && /bojler/.test($('.ent').textContent), 'entry shows in the timeline');
ok($('[data-sug="kw:bojler"]'), 'bojler suggestion appears as a ghost chip');
ok(FK.suggestions(FK.parseKit(w.VRG_FIELDKIT), sk.state()).some(g => g.id === 'kw:bojler'), 'engine agrees about the suggestion');
click($('[data-sug="kw:bojler"] [data-act="sugok"]'));
ok(sk.state().scope.bojler >= 1 && !$('[data-sug="kw:bojler"]'), 'accept adds scope bojler and removes the ghost');
// dismiss path
$('#ntext').value = 'bojler'; click($('#nadd'));
sk.state().scope; // (scope already set: no suggestion expected)
const st = sk.state(); st.scope = Object.assign({}, st.scope); delete st.scope.bojler;
click(rail('vazlat')); click(rail('jegyzet'));
ok($('[data-sug="kw:bojler"]'), 'suggestion returns when scope bojler is off');
click($('[data-sug="kw:bojler"] [data-act="sugno"]'));
ok(sk.state().dismissed.includes('kw:bojler') && !$('[data-sug="kw:bojler"]'), 'dismiss stores kw:bojler');
click($('.flag[data-act="eopen"]'));
ok(sk.state().entries.some(e => e.open), 'open flag toggles on an entry');

// Munkakör
click(rail('munkakor'));
const tgl = $('[data-act="stoggle"][data-id="furdo"]');
ok(!!tgl, 'scope toggle furdo present');
click(tgl);
ok(sk.state().scope.furdo === 1 && $('[data-scope="furdo"]').classList.contains('sel'), 'scope toggle on');
click($('[data-scope="dugalj"] [data-act="sinc"]')); click($('[data-scope="dugalj"] [data-act="sinc"]'));
eq(sk.state().scope.dugalj, 2, 'qty stepper +');
click($('[data-scope="dugalj"] [data-act="sdec"]'));
eq(sk.state().scope.dugalj, 1, 'qty stepper −');
click($('[data-scope="dugalj"] [data-act="sdec"]'));
ok(sk.state().scope.dugalj === undefined, 'qty stepper to 0 removes the toggle');

// Variant
click(rail('kerdes'));
ok(!qs().includes('furdo_zona'), 'no variant question before the variant is on');
ok(!$('#vtoggle'), 'no variant toggle while no variant is set');
click(rail('variansok'));
ok($$('#view .card').length >= 2 && /furdo|Fürdő/i.test(mainText()), 'Variánsok lists the bundled variants');
click($('[data-act="vpick"][data-id="furdo-felujitas"]'));
ok(sk.state().variant === 'furdo-felujitas' && sk.state().variantOn === true, 'variant picked and on');
ok($('#vtoggle') && $('#vtoggle').classList.contains('on'), 'header variant toggle shows');
click(rail('kerdes'));
ok(qs().includes('furdo_zona'), 'variant question furdo_zona appears once scope furdo');
click($('#vtoggle'));
ok(sk.state().variantOn === false, 'toggle off sets variantOn false');
click(rail('kerdes'));
ok(!qs().includes('furdo_zona'), 'variant questions vanish when toggled off');
click($('#vtoggle'));
ok(sk.state().variantOn === true, 'toggle back on');
$('#main'); click(rail('variansok'));
$('#vprem').value = 'lépcsőház'; $('#vprem').dispatchEvent(new w.Event('input', { bubbles: true }));
ok(/GO VARIANT — lépcsőház/.test($('#vprev').textContent), 'starter prompt follows the typed premise');

// Helyszín
click(rail('helyszin'));
ok($('#mapframe') && /localhost:8802\/vrg-terkep\.html\?embed=1/.test($('#mapframe').getAttribute('src')), 'map iframe points at VRG Térkép');
const addr = $('input[data-site="address"]'); addr.value = 'Fő utca 3'; addr.dispatchEvent(new w.Event('change', { bubbles: true }));
eq(sk.state().site.address, 'Fő utca 3', 'address editable');
ok(/q=F%C5%91%20utca%203/.test($('#mapframe').getAttribute('src')), 'map query follows the address');
ok(/Terv teljes mérete/.test(mainText()), 'plan overall size shown');

// Helyszín F1: the sketch on the building (outline from the map, ⤢ fit, the report, the survey sent to the embedded map)
ok(/Még nincs körvonal/.test(mainText()), 'no outline yet: says how to get one');
const SMj = w.VrgSiteMath;
ok(SMj && typeof SMj.autoFit === 'function', 'site maths inlined');
const ring = [[-3.2, -1.8], [3.2, -1.8], [3.2, 1.8], [-3.2, 1.8]].map(p => SMj.toLatLon(47.515, 19.08, p[0], p[1]));
sk.siteApply({ kind: 'vrg-site-result', v: 1, id: 'x', cancelled: true, outline: ring });
ok(!(sk.state().site.outline), 'a cancelled answer changes nothing');
sk.siteApply({ kind: 'vrg-site-result', v: 1, id: 'x', outline: ring, outlineSrc: 'muhold', place: null, center: [47.515, 19.08] });
eq([sk.state().site.outline.length, sk.state().site.footprint.src, sk.state().site.lat, sk.state().site.source], [4, 'muhold', 47.515, 'terkep'], 'the map answer applied');
ok(Math.abs(sk.state().site.footprint.w - 6.4) < 0.05 && Math.abs(sk.state().site.footprint.d - 3.6) < 0.05, 'footprint measured from the outline');
ok($('[data-act="sitefit"]') && /Még nincs elhelyezve/.test(mainText()), 'fit offered before a placement');
click($('[data-act="sitefit"]'));
ok(sk.state().site.place && sk.state().site.place.auto === true, '⤢ places the sketch');
ok(/A vázlat a körvonalon belül van, a falak párhuzamosak/.test(mainText()), 'the report: inside, parallel');
eq($$('svg.siteplace polygon').length, 3, 'outline + two rooms drawn');
let sent = null; $('#mapframe').contentWindow.postMessage = (m, o) => { sent = [m, o]; };
click($('[data-act="sitemap"]'));
ok(sent && sent[0].kind === 'vrg-site' && sent[0].rooms.length === 2 && sent[1] === 'http://localhost:8802', 'the survey goes to the embedded map only');
ok(sent && !('address' in sent[0]), 'the map does not get the address');
sk.siteApply({ kind: 'vrg-site-result', v: 1, id: 'x', outline: ring, outlineSrc: 'rajz', place: { lat: 47.51502, lon: 19.08, rot: 12, auto: false } });
ok(/kilóg|elfordulnak/.test(mainText()) && $$('svg.siteplace line.sb').length > 0, 'a turned sketch: walls marked, the report says so');
click($('[data-act="siteclear"]'));
ok(!sk.state().site.place, 'placement cleared');
click($('[data-act="sitefit"]'));

// Kamera
click(rail('kamera'));
ok($$('.shotrow').length > 0 && $('#fphotos'), 'shot list and photo attach input');

// Nyitott badge
const k0 = FK.withVariant(FK.parseKit(w.VRG_FIELDKIT), w.VRG_VARIANTS.find(v => v.id === 'furdo-felujitas'));
const norm = { rooms: pkgObj.plan.data.floors.map(f => ({ id: f.sk.id, name: f.name, inferred: f.sk.est.length > 0 })) };
const expect = FK.open(k0, sk.state(), norm).length;
click(rail('nyitott'));
eq(Number($('[data-badge="nyitott"]').textContent), expect, 'open-count badge equals open().length');
ok(expect > 0 && $$('#view .le').length === expect, 'Nyitott lists every loose end');
const le = $('#view .le'); click(le);
ok($('#view').dataset.front === le.dataset.front, 'loose end click jumps to its front');
ok($('[data-badge="kerdes"]'), 'Kérdések badge shown');

// Áttekintés
click(rail('attekintes'));
ok(/Munkakör/.test(mainText()) && /m²/.test(mainText()) && /Áramkörök/.test(mainText()), 'overview scope card and survey summary');

// save
const txt = sk.save(), out = JSON.parse(txt);
ok(out.kind === 'vrg-sketch' && out.plan && out.plan.data && out.plan.data.floors.length === 2, 'save keeps the package kind and plan');
ok(JSON.stringify(out.plan) === JSON.stringify(pkgObj.plan), 'plan is unchanged byte for byte');
ok(out.sketch.answers.lenyeg.options[0] === 'csere' && out.sketch.entries.length === 2 && out.sketch.seq === sk.state().seq, 'saved sketch has answers, entries, seq');
ok(out.sketch.scope.felujitas === 1 && out.sketch.dismissed.includes('kw:bojler') && out.sketch.variant === 'furdo-felujitas', 'saved sketch has scope, dismissed, variant');
ok(!/blob:/.test(txt), 'no object URLs in the saved file');
ok(out.sketch.site.outline.length === 4 && out.sketch.site.place && typeof out.sketch.site.place.rot === 'number', 'saved survey keeps outline and placement');

// the Munkakör lap (takeoff, docs/sketcher/TAKEOFF.md): the same as the engine gives, carried in the package
const TK = require(path.join(ROOT, 'Sketcher/lib/takeoff.js'));
ok(out.takeoff && out.takeoff.kind === 'vrg-sketch-takeoff' && out.takeoff.v === 1, 'the saved package carries its takeoff');
const kitJ = JSON.parse(fs.readFileSync(path.join(ROOT, 'Sketcher/catalog/fieldkit.json'), 'utf8'));
const vJ = JSON.parse(fs.readFileSync(path.join(ROOT, 'Sketcher/variants/furdo-felujitas.json'), 'utf8'));
const rulesJ = JSON.parse(fs.readFileSync(path.join(ROOT, 'Sketcher/catalog/takeoff.json'), 'utf8'));
const want = TK.build(FK.withVariant(FK.parseKit(kitJ), vJ), TK.parseRules(rulesJ), out.sketch, TK.planFromPackage(out), { now: out.takeoff.made });
eq(out.takeoff.items, want.items, 'the page\'s takeoff is the engine\'s');
click(rail('munkakor'));
ok($('#takeoff') && /Munkakör lap/.test($('#takeoff').textContent), 'the Munkakör front opens with the Munkakör lap');
eq($$('#takeoff .tk-item').length, want.items.length, 'one row per item');
ok($$('#takeoff .tk-item.est').length === want.counts.est && $$('#takeoff .tk-item.open').length === want.counts.open, 'guessed and open rows are marked');
const tkBefore = $$('#takeoff .tk-item').length;
click($('.stepper[data-scope="ledszalag"] button[data-act="sinc"]'));
ok($$('#takeoff .tk-item').length === tkBefore + 1 && $('#takeoff .tk-item[data-item="igeny.ledszalag"]'), 'the lap follows the scope live');
const ex = sk.exportTakeoff();
ok(ex && JSON.parse(ex.json).kind === 'vrg-sketch-takeoff' && /^# Munkakör lap — Kossuth u\. 12/.test(ex.md) && /LED-szalag/.test(ex.md), 'the export gives the JSON and the summary');
ok(!$$('#takeoff .tk-item').some(x => x.dataset.item === 'aramkor.dedikalt') || !sk.takeoff().items.find(x => x.id === 'aramkor.dedikalt').est, 'off by default: no implied dedicated circuit');
click($('.stepper[data-scope="fozolap"] button[data-act="sinc"]'));
ok(!sk.takeoff().items.some(x => x.id === 'aramkor.dedikalt') && sk.takeoff().checks.some(c => /dedikált kör kellhet/.test(c)), 'a hob with the toggle off: no circuit assumed, a check line instead');
click($('#tkimplied'));
ok($('#tkimplied').classList.contains('sel') && sk.takeoff().config.impliedDedicated === true, 'the toggle switches the implied dedicated circuits on');
const dd = sk.takeoff().items.find(x => x.id === 'aramkor.dedikalt');
ok(dd && dd.est, 'on: the machines give a dedicated circuit, marked as a guess');
click($('#tkimplied'));
ok(sk.takeoff().config.impliedDedicated === false, 'and off again');
click($('[data-act="tkexport"]'));
ok(/takeoff\.json \+ \.md/.test(mainText()), 'the button reports the export');

// bare survey
sk.load(pkgObj.sketch);
ok(sk.state().name === 'Kossuth u. 12', 'bare survey opens');
click(rail('vazlat'));
eq($$('#plansvg polygon.fl').length, 2, 'bare survey draws its sketch rooms');
ok(JSON.parse(sk.save()).kind === 'vrg-vazlat', 'bare survey saves as a bare survey');

// Kamera 2: video, signature, personal data + blur, type-plate readings, a before / after pair
const k2 = JSON.parse(JSON.stringify(pkgObj.sketch));
k2.captures = (k2.captures || []).concat([
  { id: 'C91', file: 'V-1.mp4', purpose: 'nyomvonal', at: 1763460000000, note: 'séta', kind: 'video', durationMs: 65000, bytes: 31457280 },
  { id: 'C92', file: 'S-1.png', purpose: 'dokumentum', at: 1763460001000, note: 'A felmérést átvettem', kind: 'signature', signer: 'Kiss Anna' },
  { id: 'C93', file: 'C-a.jpg', purpose: 'hiba', at: 1763460002000, note: '', phase: 'elotte', privacy: true },
  { id: 'C94', file: 'C-b.jpg', purpose: 'hiba', at: 1763460003000, note: '', phase: 'utana', pair: 'C93', marks: [{ kind: 'elmos', pts: [[0.1, 0.1], [0.3, 0.3]], text: '', col: 1 }] },
  { id: 'C95', file: 'C-c.jpg', purpose: 'tabla', at: 1763460004000, note: '', ocrAt: 5, ocr: [{ kind: 'aram', value: '3×25 A', raw: '3x25A', used: true }, { kind: 'mero_szam', value: '12345678', raw: '' }] }]);
sk.load(k2);
click(rail('kamera'));
const card = id => $('.cap-card[data-cap="' + id + '"]');
ok(card('C91') && card('C91').dataset.kind === 'video' && /1:05 · 30,0 MB/.test(card('C91').textContent), 'video card: duration and size');
ok(card('C91').textContent.includes('kossuth-u-12_C91_nyomvonal.mp4'), 'video board name is .mp4');
ok(card('C92') && /Kiss Anna/.test(card('C92').textContent) && card('C92').textContent.includes('kossuth-u-12_C92_alairas.png'), 'signature card: signer and .png name');
ok(/Aláírás/.test(mainText()) && /A felmérést átvettem/.test(mainText()), 'signature section with the statement');
ok(card('C93').querySelector('[data-b="privacy"]') && card('C93').querySelector('[data-b="before"]'), 'personal-data and before badges');
ok(card('C94').querySelector('[data-b="after"]') && card('C94').querySelector('[data-b="blur"]'), 'after and blur badges');
ok($('.card.pair[data-pair="C93-C94"]') && $$('.card.pair figure').length === 2, 'before / after pair side by side');
ok(/1 személyes adatot mutató fotón nincs elmosás/.test(mainText()), 'unblurred personal photo flagged');
ok(card('C95').querySelector('[data-ocr="aram"].ok') && /✓ 3×25 A/.test(card('C95').textContent) && card('C95').querySelector('[data-ocr="mero_szam"]'), 'type-plate readings, used one ticked');
ok(JSON.parse(sk.save()).captures.find(c => c.id === 'C94').pair === 'C93', 'Kamera 2 fields survive the Desktop save');

// F4 (WP M49): the client's wants by room on the Munkakör
{
  sk.load(pkgObj);
  const rooms = sk.state().rooms.map(r => r.id);
  ok(rooms.length >= 2, 'the field package has rooms');
  click(rail('munkakor'));
  const sel = $('#wroom');
  ok(sel && sel.options.length === rooms.length + 1, 'Hová: Általános and every room');
  sel.value = rooms[0]; sel.dispatchEvent(new w.Event('change', { bubbles: true }));
  click($('[data-scope="dugalj"] [data-act="sinc"]')); click($('[data-scope="dugalj"] [data-act="sinc"]'));
  eq(sk.state().roomScope[rooms[0]].dugalj, 2, 'two sockets in the chosen room');
  eq(sk.state().scope.dugalj, 2, 'the job total follows');
  ok(/\(2 itt\)/.test($('[data-scope="dugalj"]').textContent), 'the stepper says how many are here');
  const s2 = $('#wroom'); s2.value = ''; s2.dispatchEvent(new w.Event('change', { bubbles: true }));
  click($('[data-scope="dugalj"] [data-act="sinc"]'));
  eq([sk.state().scope.dugalj, sk.state().roomScope[rooms[0]].dugalj], [3, 2], 'one more for the job: total 3, the room keeps 2');
  ok($('.card.wants') && /Általános/.test($('.card.wants').textContent), 'Szobánként card with the room and Általános');
  click($('.card.wants [data-act="wmove"][data-from="' + rooms[0] + '"]'));
  eq([sk.state().scope.dugalj, sk.state().roomScope[rooms[0]].dugalj], [3, 1], '⇠ re-links one to Általános, the total stays');
  click($('[data-scope="dugalj"] [data-act="sdec"]')); click($('[data-scope="dugalj"] [data-act="sdec"]')); click($('[data-scope="dugalj"] [data-act="sdec"]'));
  ok(sk.state().scope.dugalj === undefined && !(sk.state().roomScope || {})[rooms[0]], '− from Általános down to 0 takes the room\'s too');
  click($('[data-scope="lampa"] [data-act="sinc"]'));
  const sv0 = JSON.parse(sk.save()), sv = sv0.sketch || sv0;
  ok(sv.scope.lampa === 1 && !sv.roomScope?.[rooms[0]], 'saved: a general want has no room');
}

// F4: the drawing tune is shown on the Variánsok cards and validated
click(rail('variansok'));
ok(/Rács: 1 m/.test(($('[data-draw="ipari-telephely"]') || {}).textContent || '') && /30 × 20 m/.test($('[data-draw="ipari-telephely"]').textContent), 'ipari-telephely shows its drawing tune');
{
  const base = { kind: FK.VARIANT_KIND, id: 'proba', name: 'Próba', premise: 'Egy próbaváltozat a rajzhangolás ellenőrzéséhez.' };
  eq(FK.validateVariant(Object.assign({}, base, { draw: { snapAngle: 90, snapGrid: 0.5, defaultRoom: { w: 4, d: 3 }, measureFirst: true, pointSnap: 'free' } })), [], 'a good draw block passes');
  eq(FK.validateVariant(Object.assign({}, base, { draw: { snapAngle: 37, snapGrid: -1, defaultRoom: { w: 0 }, measureFirst: 'yes', pointSnap: 'x', wallThickness: 30 } })).length, 6, 'every bad draw key is reported');
  eq(FK.validateVariant(Object.assign({}, base, { draw: { lineClose: 'auto' } })), [], 'F5: lineClose auto passes');
  eq(FK.validateVariant(Object.assign({}, base, { draw: { lineClose: 'maybe' } })).length, 1, 'F5: a bad lineClose is reported');
  ok(/Kész = szoba/.test(($('[data-draw="furdo-felujitas"]') || {}).textContent || ''), 'F5: the bathroom variant shows its lineClose');
}

// F5 (WP M50): the Felmérési jegyzőkönyv, from the open survey
{
  sk.load(JSON.parse(JSON.stringify(pkgObj)));
  const s = sk.state();
  s.scope = { felujitas: 1, dugalj: 3 }; s.roomScope = { [s.rooms[0].id]: { dugalj: 2 } };
  s.answers = { lenyeg: { options: ['csere'], text: '', at: 1763460000000, state: 'answered' }, kor: { options: [], text: '', at: 1763460000000, state: 'later' } };
  s.entries = [{ id: 'E90', at: 1763460000000, text: 'A <b>konyhában</b> indukció', chips: ['kivansag'] }, { id: 'E91', at: 1763460001000, text: 'garázs?', chips: [], open: true }];
  s.captures = [{ id: 'C92', file: 'x.jpg', purpose: 'eloszto', at: 1763460002000, note: 'fedél nélkül' },
    { id: 'C93', file: 's.png', purpose: 'dokumentum', kind: 'signature', signer: 'Minta Ügyfél', at: 1763460003000, note: 'átvettem' }];
  s.site = { address: 'Kossuth u. 12', lat: 47.5, lon: 19.04, source: 'kezi' };
  const r = sk.reportHtml(), rd = new JSDOM(r).window.document, q = x => rd.querySelector(x), qa = x => Array.from(rd.querySelectorAll(x));
  ok(/^<!doctype html>/.test(r) && /Felmérési jegyzőkönyv/.test(q('h1').textContent), 'the report is a whole document with its title');
  ok(/@page\{size:A4/.test(r) && /window\.print\(\)/.test(r), 'printable: A4 page and a print button');
  ok(qa('#munkakor tr').length >= 2 && /Felújítás/.test(q('#munkakor').textContent), 'the job scope');
  ok(qa('#tetelek tr.tetel').length === sk.takeoff().items.length, 'one row per takeoff item');
  ok(/Mi a kérés lényege/.test(q('#valaszok').textContent) && /Mikor készült/.test(q('#nyitott').textContent), 'answered and open questions');
  ok(/A <b>konyhában<\/b> indukció/.test(q('#jegyzetek').textContent) && !q('#jegyzetek b') && /⚑ Tisztázandó: garázs\?/.test(q('#jegyzetek').textContent), 'notes escaped, chips, Tisztázandó');
  ok(q('#jegyzetek .chip') && /Kívánság|kivansag/i.test(q('#jegyzetek .chip').textContent), 'a note\'s chip as its label');
  ok(/Dugalj ×2/.test(q('#helyisegek').textContent), 'the rooms with their wants');
  ok(q('#rajz svg'), 'the drawing');
  ok(q('figure[data-cap="C92"]') && /fedél nélkül/.test(q('figure[data-cap="C92"]').textContent) && /nincs csatolva/.test(q('figure[data-cap="C92"]').textContent), 'a photo by purpose, its caption, not attached');
  ok(/Minta Ügyfél/.test(q('.alairas').textContent) && !q('.fotok figure[data-cap="C93"]'), 'the signature in its own section, not among the photos');
  ok(/47\.50000, 19\.04000/.test(r) && /Kossuth u\. 12/.test(q('.meta').textContent), 'the site');
  ok(!q('#ugyfel'), 'no client contact: no client row');
  // F5: the client's contact on Helyszín, into the report
  click(rail('helyszin'));
  const cn = $('#client [data-client="name"]'); cn.value = 'Minta Ügyfél'; cn.dispatchEvent(new w.Event('change', { bubbles: true }));
  const cp = $('#client [data-client="phone"]'); cp.value = ' +36 30 000 0000 '; cp.dispatchEvent(new w.Event('change', { bubbles: true }));
  eq(sk.state().client, { name: 'Minta Ügyfél', phone: '+36 30 000 0000', email: '' }, 'the contact is on the survey');
  ok(/Minta Ügyfél/.test(new JSDOM(sk.reportHtml()).window.document.querySelector('#ugyfel').textContent), 'the report has the client row');
  const ck = $('#client [data-client="keep"]'); ck.checked = true; ck.dispatchEvent(new w.Event('change', { bubbles: true }));
  ok(sk.state().client.keep === true, 'keep is stored');
  ['name', 'phone'].forEach(k => { const x = $('#client [data-client="' + k + '"]'); x.value = ''; x.dispatchEvent(new w.Event('change', { bubbles: true })); });
  ok(!('client' in sk.state()), 'all blank removes it');
  // through the header button: a new window, or a download when popups are blocked
  let wrote = '';
  w.open = () => ({ document: { open() {}, write(x) { wrote += x; }, close() {} } });
  click($('#breport'));
  ok(wrote === sk.reportHtml() || wrote.length > 1000, 'Jegyzőkönyv opens the report in a window');
  { const o = JSON.stringify(sk.output()); ok(!/Felmérési jegyzőkönyv|<!doctype/i.test(o), 'nothing of the report is stored in the survey'); }
}

// F5 (WP M50): a sound note (kind audio) on Kamera, in the report, not among the photos
{
  const s = sk.state();
  s.captures = (s.captures || []).concat([{ id: 'C95', file: 'hang_1.m4a', purpose: 'hang', kind: 'audio', at: 1763460009000, note: 'a csempe alatt?', durationMs: 42000, bytes: 300000 }]);
  click(rail('kamera'));
  const card = $('.cap-card[data-cap="C95"]');
  ok($('#hangok') && card && /0:42/.test(card.textContent) && /🎙 hang/.test(card.textContent), 'Kamera lists the sound note under Hangjegyzetek');
  ok(/_C95_hang\.m4a/.test(card.textContent), 'its PC file name is .m4a');
  const rd = new JSDOM(sk.reportHtml()).window.document;
  ok(/0:42/.test(rd.querySelector('#hang').textContent) && !rd.querySelector('figure[data-cap="C95"]'), 'the report lists it, not as a photo');
  ok(!sk.takeoff().photos.some(p => p.purpose === 'hang'), 'the takeoff does not count it as a photo');
}

// M51: ⚙ Funkciók — one row per feature, switches leave no trace, data and the saved file stay the same
{
  const F = require(path.join(ROOT, 'Sketcher/lib/features.js'));
  const same = t => { const o = JSON.parse(t); return JSON.stringify([o.sketch, o.plan, o.takeoff && o.takeoff.items, Object.keys(o).sort()]); };
  const before = same(sk.save());
  click(rail('funkciok'));
  eq($$('.frow[data-feature]').length, F.ALL.length, 'Funkciók lists every feature of the registry');
  eq($$('.fgrp').map(g => g.dataset.group), F.FRONTS.map(f => f.id), 'grouped by front, in the registry order');
  ok($('.frow[data-feature="vazlat.select"] .sw').disabled, 'Mozgat cannot be switched off');
  click($('.fgrp[data-group="kerdes"] .frow.head .sw'));
  ok(!rail('kerdes'), 'Kérdések: Mind ki takes the front off the rail');
  click(rail('nyitott'));
  ok(!$$('.le').some(b => b.dataset.front === 'kerdes'), 'and its loose ends leave Nyitott');
  click(rail('funkciok')); click($('.frow[data-feature="jegyzet.chips"] .sw'));
  click(rail('jegyzet'));
  ok(!$('[data-act="nchip"]'), 'Gyors chipek off: no chips under the note');
  click(rail('funkciok')); click($('.frow[data-feature="vazlat.point"] .sw'));
  ok($('.frow[data-feature="vazlat.circuit"]').classList.contains('dim') && $('.frow[data-feature="vazlat.circuit"] .sw').disabled, 'Áramkör greyed while Pont is off');
  click($('.frow[data-feature="munkakor.takeoff"] .sw')); click(rail('munkakor'));
  ok(!$('#takeoff'), 'Munkakör lap off: no takeoff card');
  eq(same(sk.save()), before, 'nothing switched off changes the saved package (survey, plan, takeoff items)');
  ok(sk.features().includes('kerdes.questions') && sk.features().includes('jegyzet.chips'), 'the switches are the flipped ids');
  click(rail('funkciok')); click($('.frow.all .sw'));
  ok(rail('kerdes') && $('.frow[data-feature="jegyzet.chips"] .sw').classList.contains('on'), 'Mind be brings everything back');
  ok(!$('.frow[data-feature="munkakor.implied"] .sw').classList.contains('on'), 'Mind be leaves the default-off option alone');
  eq(same(sk.save()), before, 'and the package is still the same');
}

let bad = null; try { sk.load({ kind: 'nope' }); } catch (e) { bad = e; }
ok(!!bad, 'unknown file is rejected');
ok(errors.length === 0, 'no script errors: ' + errors.join('; '));

console.log(fail ? fail + ' FAILED of ' + (pass + fail) : 'ALL PASS (' + pass + ')');
process.exit(fail ? 1 : 0);
}
if (doc.readyState === 'complete') main(); else w.addEventListener('load', main);
