// core.test.js — the pure modules: the search engine, the omnibox rules, Gyorsválasz, the store, the host rules.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../src/core/engine.js');
const url = require('../src/core/url.js');
const answers = require('../src/core/answers.js');
const store = require('../src/core/store.js');
const host = require('../src/core/host.js');
const ENGINES = require('../config/engines.json').engines;

// ------------------------------------------------------------------ engine
test('engine: folding keeps positions and drops accents', () => {
  assert.equal(engine.fold('Kötőelem ŐSSZEG Űrlap'), 'kotoelem osszeg urlap');
  assert.equal(engine.fold('Erősáram').length, 'Erősáram'.length);
});
test('engine: the suffix trim meets plural and case forms', () => {
  assert.equal(engine.stem('kabelek'), engine.stem('kabel') === 'kabel' ? 'kabel' : engine.stem('kabelek'));
  assert.deepEqual(engine.tokens('A kábelek és a kötőelemek'), ['kabel', 'kotoelem']);
});
test('engine: exact, accent-free, prefix, plural and one-typo matches; BM25 order; remove', () => {
  const ix = engine.createIndex({ fields: { title: 3, text: 1 } });
  ix.add({ id: 1, title: 'Kábelméretezés', text: 'A feszültségesés számítása rézvezetőre.' });
  ix.add({ id: 2, title: 'Kötőelem katalógus', text: 'Csavarok, dübelek, kábelkötegelők.' });
  ix.add({ id: 3, title: 'Időjárás', text: 'Munkaablak és riasztás a terepen; kábel szó itt is van.' });
  assert.equal(ix.search('kotoelem')[0].id, '2');
  assert.equal(ix.search('feszultsegeses')[0].id, '1');
  assert.equal(ix.search('kábelm')[0].id, '1', 'prefix');
  assert.equal(ix.search('riasztasok')[0].id, '3', 'plural query finds the singular');
  assert.equal(ix.search('katalgus')[0].id, '2', 'one typo');
  const k = ix.search('kábel');
  assert.ok(k.length >= 2 && k[0].id === '1', 'a title hit outranks a text hit');
  assert.equal(ix.search('kábel időjárás')[0].id, '3', 'every word matters');
  assert.deepEqual(ix.search(''), []);
  ix.remove(3);
  assert.ok(!ix.search('időjárás').length);
  assert.equal(ix.size(), 2);
});
test('engine: snippet ranges point at the words in the original text', () => {
  const t = 'Bevezető szöveg. ' + 'x '.repeat(80) + 'Itt a Feszültségesés határa 4 %, a kör leghosszabb ágán.';
  const s = engine.snippet(t, 'feszultsegeses', 120);
  assert.ok(s.ranges.length === 1);
  const [a, b] = s.ranges[0];
  assert.equal(s.text.slice(a, b), 'Feszültségesés');
});

// ------------------------------------------------------------------ url
const C = (t, o) => url.classify(t, Object.assign({ engines: ENGINES, engine: 'google' }, o));
test('url: what a typed line means', () => {
  assert.equal(C('index.hu').url, 'https://index.hu/');
  assert.equal(C('tme.eu/hu/katalog').url, 'https://tme.eu/hu/katalog');
  assert.equal(C('localhost:8808').url, 'http://localhost:8808/');
  assert.equal(C('192.168.1.1/admin').url, 'http://192.168.1.1/admin');
  assert.equal(C('https://hu.wikipedia.org/wiki/Ohm').kind, 'url');
  assert.equal(C('ajanlat.pdf').kind, 'search', 'a file name is not a domain');
  assert.equal(C('3.5').kind, 'search');
  assert.equal(C('kábel méretezés').engine.id, 'google');
  assert.equal(C('kábel méretezés', { engine: 'ddg' }).engine.id, 'ddg');
  assert.equal(C('!w Ohm-törvény').engine.id, 'wiki-hu');
  assert.equal(C('!w Ohm-törvény').q, 'Ohm-törvény');
  assert.equal(C('NYM-J 3x2,5 !tme').engine.id, 'tme');
  assert.equal(C('NYM-J 3x2,5 !tme').q, 'NYM-J 3x2,5');
  assert.equal(C('valami !nincsilyen').unknownBang, 'nincsilyen');
  assert.equal(C('= 2+2').kind, 'answer');
  assert.equal(C('vrg:konyvjelzok').page, 'konyvjelzok');
  for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'file:///C:/x', 'vbscript:x', 'chrome://settings']) assert.equal(C(bad).kind, 'blocked', bad);
  assert.equal(C('   ').kind, 'empty');
});
test('url: search URLs encode the query', () => {
  const g = ENGINES.find(e => e.id === 'google');
  assert.equal(url.searchUrl(g, 'a&b ő'), 'https://www.google.com/search?q=a%26b%20%C5%91');
  assert.equal(url.searchUrl(g, ''), g.home);
});
test('url: Tiszta link strips trackers and the Google wrapper, keeps the rest', () => {
  const r = url.clean('https://x.hu/a?utm_source=fb&id=7&fbclid=Z&gclid=Q#top');
  assert.equal(r.url, 'https://x.hu/a?id=7#top');
  assert.deepEqual(r.removed.sort(), ['fbclid', 'gclid', 'utm_source']);
  assert.equal(url.clean('https://www.google.com/url?q=https%3A%2F%2Fpelda.hu%2F%3Futm_medium%3Dx&sa=D').url, 'https://pelda.hu/');
  assert.equal(url.clean('https://x.hu/?q=1').removed.length, 0);
});
test('url: Linkellenőr', () => {
  const codes = u => url.assess(u).map(w => w.code);
  assert.deepEqual(codes('https://user:pw@bank.hu/'), ['credentials']);
  assert.ok(codes('https://xn--80ak6aa92e.com/').includes('punycode'));
  assert.ok(codes('http://pelda.hu/').includes('http'));
  assert.ok(!codes('http://localhost:8808/').includes('http'), 'plain http on this PC is fine');
  assert.ok(codes('http://8.8.8.8/').includes('ip'));
  assert.equal(url.assess('https://hu.wikipedia.org/').length, 0);
});

// ------------------------------------------------------------------ answers
const A = t => answers.answer(t);
test('answers: calculator', () => {
  assert.equal(A('= 2,5*(3+4)').value, '17,5');
  assert.equal(A('2^10').value, '1\u00a0024');
  assert.equal(A('sqrt(2)*sqrt(2)').value, '2');
  assert.equal(A('cos(60)*2').value, '1');
  assert.equal(A('= 2+').kind, 'error');
  assert.equal(A('+36 30 123 4567'), null, 'a phone number is not arithmetic');
  assert.equal(A('2026'), null, 'a bare number is a search');
  assert.throws(() => answers.calc('process.exit()'));
  assert.throws(() => answers.calc('constructor'));
});
test('answers: the electrician formulas', () => {
  assert.equal(A('230V 16A').value, '3,68 kW');
  assert.equal(A('3x400V 10kW cos 0,9').value, '16,04 A');
  assert.equal(A('3,5kW 230V').value, '15,22 A');
  assert.equal(A('230V 50ohm').value, '4,6 A');
  assert.equal(A('2A 100Ω').value, '200 V');
  const d = A('2,5mm2 30m 16A');
  assert.equal(d.kind, 'drop');
  assert.equal(d.value, '6,86 V · 2,98 %');
  assert.equal(d.warn, '');
  const al = A('kábel 1,5mm2 25m 10A al');
  assert.match(al.lines[0], /Al \(γ = 35\)/);
  assert.equal(al.warn, 'Világításnál a 3 % fölött van.');
  assert.equal(A('3f 400V 2,5mm2 100m 16A').kind, 'drop');
  assert.equal(A('led szalag 12v 5a'), null, 'unknown words make it a search');
});
test('answers: AWG and conversions', () => {
  assert.equal(A('12 awg').value, '3,309 mm²');
  assert.equal(A('2,5 mm2 awg').value, 'AWG 13');
  assert.equal(A('100 c f').value, '212 °F');
  assert.equal(A('5 kW LE').value, '6,798 LE');
  assert.equal(A('10 inch mm').value, '254 mm');
  assert.equal(A('1 kwh mj').value, '3,6 MJ');
  assert.equal(answers.fmt(230, 0), '230');
  assert.equal(answers.fmt(-1234.5), '−1\u00a0234,5');
});

// ------------------------------------------------------------------ store
function mem() { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m }; }
test('store: refused storage falls back to memory and says so', () => {
  const s = store.create({ getItem() { throw new Error('no'); }, setItem() { throw new Error('no'); }, removeItem() {} });
  assert.equal(s.ok, false);
  assert.ok(s.addBookmark({ url: 'https://a.hu/', title: 'A' }));
  assert.equal(s.bookmarks().length, 1);
});
test('store: bookmarks, job codes, tags, only http(s)', () => {
  const ls = mem();
  const s = store.create(ls);
  assert.equal(s.ok, true);
  const b = s.addBookmark({ url: 'https://tme.eu/hu/', title: 'TME', tags: 'beszerzés, alkatrész', job: 'vrg-2611-03' });
  assert.equal(b.job, 'VRG-2611-03');
  assert.deepEqual(b.tags, ['beszerzés', 'alkatrész']);
  assert.equal(s.addBookmark({ url: 'javascript:alert(1)', title: 'x' }), null);
  assert.equal(s.addBookmark({ url: 'https://x.hu/', job: 'ügyfél neve' }).job, '', 'a job code must be VRG-ÉÉHH-NN');
  assert.equal(s.addBookmark({ url: 'https://tme.eu/hu', title: 'TME 2' }).id, b.id, 'same URL (trailing slash) = same bookmark');
  s.updateBookmark(b.id, { title: 'TME Hungary' });
  const again = store.create(ls);
  assert.equal(again.bookmark('https://tme.eu/hu/').title, 'TME Hungary', 'kept across a reload');
  assert.deepEqual(again.jobs(), [['VRG-2611-03', 1]]);
  again.removeBookmark(b.id);
  assert.equal(again.bookmark('https://tme.eu/hu/'), null);
});
test('store: history de-duplicates, counts, honours the switch and its cap', () => {
  const s = store.create(mem());
  s.visit({ url: 'https://a.hu/', title: 'A' });
  s.visit({ url: 'https://b.hu/', title: 'B' });
  s.visit({ url: 'https://a.hu/#x', title: '' });
  assert.deepEqual(s.history().map(h => [h.url, h.count, h.title]), [['https://a.hu/#x', 2, 'A'], ['https://b.hu/', 1, 'B']]);
  s.set('history', false);
  assert.equal(s.visit({ url: 'https://c.hu/' }), null);
  s.set('history', true);
  for (let i = 0; i < 700; i++) s.visit({ url: 'https://h' + i + '.hu/' });
  assert.equal(s.history().length, s.LIMITS.history);
  s.clearHistory();
  assert.equal(s.history().length, 0);
});
test('store: the reading list keeps saved text; export / import round trip', () => {
  const s = store.create(mem());
  const r = s.addReading({ url: 'https://cikk.hu/1', title: 'Cikk', text: '# Cím\nElső bekezdés.' });
  assert.ok(r.saved > 0);
  s.addBookmark({ url: 'https://a.hu/', title: 'A', job: 'VRG-2611-03' });
  const doc = JSON.parse(JSON.stringify(s.exportAll()));
  assert.equal(doc.format, 'vrg-bongeszo/1');
  const t = store.create(mem());
  assert.equal(t.importAll({ format: 'mas' }).ok, false);
  const res = t.importAll(doc);
  assert.deepEqual(res.added, { bookmarks: 1, reading: 1, history: 0 });
  assert.equal(t.reading()[0].text, '# Cím\nElső bekezdés.');
  assert.equal(t.importAll(doc).added.bookmarks, 0, 'importing twice adds nothing');
  t.wipe();
  assert.equal(t.bookmarks().length + t.reading().length, 0);
});
test('store: a full storage does not half-keep a reading item', () => {
  let full = false;
  const ls = mem();
  const s = store.create({ getItem: ls.getItem, removeItem: ls.removeItem, setItem: (k, v) => { if (full && k.endsWith('reading')) throw new Error('QuotaExceededError'); ls.setItem(k, v); } });
  full = true;
  assert.equal(s.addReading({ url: 'https://x.hu/', title: 'x', text: 'y' }), null);
  assert.equal(s.reading().length, 0);
  assert.equal(s.isFull(), true);
});

// ------------------------------------------------------------------ host
test('host: which host, and what it can do', () => {
  assert.equal(host.detect({ protocol: 'vrg-app:', hostname: 'browser' }), 'desktop');
  assert.equal(host.detect({ protocol: 'https:', hostname: 'browser.appassets.androidplatform.net' }), 'mobile');
  assert.equal(host.detect({ protocol: 'http:', hostname: '127.0.0.1', port: '8812' }), 'served');
  assert.equal(host.detect({ protocol: 'http:', hostname: 'localhost', port: '9000' }), 'served', 'serve.js --port');
  assert.equal(host.detect({ protocol: 'file:', hostname: '' }), 'file');
  assert.equal(host.detect({ protocol: 'https:', hostname: 'claude.ai' }), 'web');
  assert.equal(host.caps('mobile').api, null, 'the phone refuses requests off the app origin');
  assert.equal(host.caps('served').api, '');
  assert.equal(host.caps('desktop').api, 'http://127.0.0.1:8812');
  assert.equal(host.caps('desktop').sameTab, true);
  assert.equal(host.caps('mobile').qr, false);
});
test('host: open hands http(s) only to the host', () => {
  const calls = [];
  const win = { location: { assign: u => calls.push(['assign', u]) }, open: (u, t, f) => { calls.push(['open', u, t, f]); return null; } };
  assert.equal(host.open('javascript:alert(1)', 'desktop', win).ok, false);
  assert.equal(host.open('https://a.hu/', 'desktop', win).how, 'desktop');
  assert.equal(host.open('https://a.hu/', 'mobile', win).how, 'mobile');
  assert.equal(host.open('https://a.hu/', 'served', win).how, 'tab');
  assert.deepEqual(calls, [['assign', 'https://a.hu/'], ['assign', 'https://a.hu/'], ['open', 'https://a.hu/', '_blank', 'noopener,noreferrer']]);
});
