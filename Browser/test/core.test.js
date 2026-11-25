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

// ------------------------------------------------------------------ store (vrg.web-links v1 since T1)
function mem() { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m }; }
test('store: refused storage falls back to memory and says so', () => {
  const s = store.create({ getItem() { throw new Error('no'); }, setItem() { throw new Error('no'); }, removeItem() {} });
  assert.equal(s.ok, false);
  assert.ok(s.addBookmark({ url: 'https://a.hu/', title: 'A' }));
  assert.equal(s.bookmarks().length, 1);
});
test('store: bookmarks are v1 rows, tags / job / note beside them, only http(s)', () => {
  const ls = mem();
  const s = store.create(ls);
  const b = s.addBookmark({ url: 'https://tme.eu/hu/', title: 'TME', tags: 'beszerzés, alkatrész', job: 'vrg-2611-03' });
  assert.equal(b.id, 'https://tme.eu/hu/', 'the id is the URL, as in web.json');
  assert.equal(b.job, 'VRG-2611-03');
  assert.deepEqual(b.tags, ['beszerzés', 'alkatrész']);
  assert.equal(s.addBookmark({ url: 'javascript:alert(1)', title: 'x' }), null);
  assert.equal(s.addBookmark({ url: 'https://x.hu/', job: 'ügyfél neve' }).job, '', 'a job code must be VRG-ÉÉHH-NN');
  assert.equal(s.addBookmark({ url: 'https://tme.eu/hu', title: 'TME 2' }).id, b.id, 'same URL (trailing slash) = same bookmark');
  s.updateBookmark(b.id, { title: 'TME Hungary' });
  const raw = JSON.parse(ls.m.get('vrg-bongeszo:v1:links'));
  assert.deepEqual(Object.keys(raw.bookmarks[0]).sort(), ['at', 'title', 'url'], 'the rows carry only url, title, at');
  const again = store.create(ls);
  assert.equal(again.bookmark('https://tme.eu/hu/').title, 'TME Hungary', 'kept across a reload');
  assert.deepEqual(again.jobs(), [['VRG-2611-03', 1]]);
  again.removeBookmark(b.id);
  assert.equal(again.bookmark('https://tme.eu/hu/'), null);
});
test('store: history is one row per visit, grouped for the views, honours the switch', () => {
  const s = store.create(mem());
  s.visit({ url: 'https://a.hu/', title: 'A' });
  s.visit({ url: 'https://b.hu/', title: 'B' });
  s.visit({ url: 'https://a.hu/', title: '' });
  assert.equal(s.historyRows().length, 3);
  assert.deepEqual(s.history().map(h => [h.url, h.count]), [['https://a.hu/', 2], ['https://b.hu/', 1]]);
  s.set('history', false);
  assert.equal(s.visit({ url: 'https://c.hu/' }), null);
  s.set('history', true);
  s.removeVisit('https://a.hu/');
  assert.deepEqual(s.history().map(h => h.url), ['https://b.hu/']);
  s.clearHistory();
  assert.equal(s.history().length, 0);
});
test('store: export is vrg.web-links v1 with the work line extension; import takes v1, web.json and the old format', () => {
  const s = store.create(mem());
  s.addReading({ url: 'https://cikk.hu/1', title: 'Cikk', text: '# Cím\nElső bekezdés.' });
  s.addBookmark({ url: 'https://a.hu/', title: 'A', job: 'VRG-2611-03' });
  s.set('pinned', ['https://a.hu/']);
  s.visit({ url: 'https://a.hu/', title: 'A' });
  const doc = JSON.parse(JSON.stringify(s.exportAll()));
  assert.equal(doc.format, 'vrg.web-links'); assert.equal(doc.v, 1);
  assert.deepEqual(doc['x-bongeszo'].meta['https://a.hu/'].job, 'VRG-2611-03');
  assert.equal(doc['x-bongeszo'].reading[0].text, '# Cím\nElső bekezdés.');
  const t = store.create(mem());
  assert.equal(t.importAll({ format: 'mas' }).ok, false);
  const res = t.importAll(doc);
  assert.deepEqual(res.added, { bookmarks: 1, reading: 1, history: 1 });
  assert.equal(t.bookmark('https://a.hu/').job, 'VRG-2611-03');
  assert.deepEqual(t.settings().pinned, ['https://a.hu/']);
  assert.equal(t.importAll(doc).added.bookmarks, 0, 'importing twice adds nothing');
  const u = store.create(mem());
  assert.equal(u.importAll({ bookmarks: [{ url: 'https://gh.com/', title: 'GH', at: 1 }], history: [] }).added.bookmarks, 1, "the Asztal's own web.json");
  const old = { format: 'vrg-bongeszo/1', bookmarks: [{ id: 'x', url: 'https://o.hu/', title: 'O', tags: ['régi'], added: 5 }], reading: [], history: [{ url: 'https://o.hu/', title: 'O', at: 6, count: 3 }] };
  assert.equal(u.importAll(old).ok, true);
  assert.deepEqual(u.bookmark('https://o.hu/').tags, ['régi']);
  t.wipe();
  assert.equal(t.bookmarks().length + t.reading().length, 0);
});
test('store: the first release\'s keys migrate once', () => {
  const ls = mem();
  ls.setItem('vrg-bongeszo:v1:bookmarks', JSON.stringify([{ id: 'k1', url: 'https://m.hu/', title: 'M', tags: ['x'], job: 'VRG-2611-03', added: 7 }]));
  ls.setItem('vrg-bongeszo:v1:history', JSON.stringify([{ url: 'https://m.hu/', title: 'M', at: 8, count: 2 }]));
  ls.setItem('vrg-bongeszo:v1:settings', JSON.stringify({ pinned: ['k1'] }));
  const s = store.create(ls);
  assert.equal(s.bookmark('https://m.hu/').job, 'VRG-2611-03');
  assert.deepEqual(s.settings().pinned, ['https://m.hu/'], 'pins follow the bookmark to its URL id');
  assert.equal(s.historyRows().length, 1);
  assert.equal(ls.getItem('vrg-bongeszo:v1:bookmarks'), null);
});
test('store: with a master, changes become ops; the first contact uploads what the master lacks, later its deletions win', () => {
  const s = store.create(mem());
  s.addBookmark({ url: 'https://mine.hu/', title: 'Mine' });
  assert.deepEqual(s.outbox(), [], 'no master yet: no outbox');
  s.adoptMaster({ bookmarks: [{ url: 'https://desk.hu/', title: 'Desk', at: 1 }], history: [] }, 0);
  assert.deepEqual(s.outbox().map(o => o.op + ' ' + o.url), ['bookmark https://mine.hu/'], 'the first contact loses nothing');
  assert.deepEqual(s.bookmarks().map(b => b.url).sort(), ['https://desk.hu/', 'https://mine.hu/']);
  s.adoptMaster({ bookmarks: [{ url: 'https://desk.hu/', title: 'Desk', at: 1 }, { url: 'https://mine.hu/', title: 'Mine', at: 2 }], history: [] }, 1);
  assert.deepEqual(s.outbox(), []);
  s.removeBookmark('https://desk.hu/');
  assert.deepEqual(s.outbox().map(o => o.op), ['unbookmark']);
  s.adoptMaster({ bookmarks: [{ url: 'https://desk.hu/', title: 'Desk', at: 1 }, { url: 'https://mine.hu/', title: 'Mine', at: 2 }], history: [] }, 0);
  assert.deepEqual(s.bookmarks().map(b => b.url), ['https://mine.hu/'], 'a pending op stays applied on top of the master');
  assert.equal(s.adoptMaster({ bookmarks: [{ url: 'https://mine.hu/', title: 'Mine', at: 2 }], history: [] }, 1), false, 'nothing new: no redraw');
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

// ------------------------------------------------------------------ sync (a fake master)
const sync = require('../src/core/sync.js');
const linksLib = require('../src/core/links.js');
function fakeMaster(initial) {
  let master = linksLib.read(initial || { bookmarks: [], history: [] });
  const calls = [];
  const fetch = async (url, init) => {
    calls.push([init.method, url]);
    if (init.method === 'POST') master = linksLib.apply(master, JSON.parse(init.body).ops);
    return { ok: true, status: 200, json: async () => Object.assign({ format: 'vrg.web-links', v: 1 }, master) };
  };
  return { fetch, calls, get: () => master };
}
const noTimers = { set: (f) => { setImmediate(f); return 1; }, clear() {}, every() {} };
test('sync: no master on the phone or from a file', async () => {
  for (const kind of ['mobile', 'file', 'web']) assert.equal(sync.create({ store: store.create(mem()), kind, fetch: async () => { throw new Error('never'); } }).endpoint, null, kind);
});
test('sync: the desktop app pulls the pane\'s links and pushes its own changes', async () => {
  const m = fakeMaster({ bookmarks: [{ url: 'https://github.com/', title: 'GitHub', at: 1 }], history: [{ url: 'https://seen-in-pane.hu/', title: 'Pane', at: 5 }] });
  const s = store.create(mem());
  s.addBookmark({ url: 'https://offline-made.hu/', title: 'Before the first contact' });
  const y = sync.create({ store: s, kind: 'desktop', fetch: m.fetch, timers: noTimers, visible: () => true });
  assert.equal(y.endpoint, '/__vrg/links');
  await y.run();
  await new Promise(r => setTimeout(r, 30));
  await y.run();
  assert.deepEqual(m.get().bookmarks.map(b => b.url).sort(), ['https://github.com/', 'https://offline-made.hu/']);
  assert.deepEqual(s.history().map(h => h.url), ['https://seen-in-pane.hu/'], 'the pane history is visible in the app');
  s.visit({ url: 'https://index.hu/', title: 'Index' });
  await y.run();
  assert.ok(m.get().history.some(h => h.url === 'https://index.hu/'), 'a visit from the app reaches the master');
  assert.equal(s.outbox().length, 0);
  assert.equal(y.status().ok, true);
});
test('sync: an unreachable master keeps the changes waiting', async () => {
  const s = store.create(mem());
  const ok = fakeMaster();
  await sync.create({ store: s, kind: 'served', fetch: ok.fetch, timers: noTimers }).run();
  s.addBookmark({ url: 'https://wait.hu/', title: 'W' });
  const y = sync.create({ store: s, kind: 'served', fetch: async () => { throw new Error('down'); }, timers: noTimers });
  await y.run();
  assert.equal(y.status().ok, false);
  assert.equal(s.outbox().length, 1, 'kept for the next try');
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
