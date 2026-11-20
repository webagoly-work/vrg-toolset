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
const fronts = ['attekintes', 'vazlat', 'jegyzet', 'munkakor', 'kerdes', 'kamera', 'helyszin', 'nyitott', 'variansok'];
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

let bad = null; try { sk.load({ kind: 'nope' }); } catch (e) { bad = e; }
ok(!!bad, 'unknown file is rejected');
ok(errors.length === 0, 'no script errors: ' + errors.join('; '));

console.log(fail ? fail + ' FAILED of ' + (pass + fail) : 'ALL PASS (' + pass + ')');
process.exit(fail ? 1 : 0);
}
if (doc.readyState === 'complete') main(); else w.addEventListener('load', main);
