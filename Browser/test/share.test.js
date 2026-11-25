// share.test.js — T9: sharing. The pure rules (src/core/share.js: picking a list, the guest filter, the guest page), the shared
// OneDrive folder (lib/shared.js: 60_Linkek, 00_START\linkek.html) and serve.js's /api/shared and /api/guest.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
const S = require('../src/core/share.js');
const L = require('../src/core/links.js');
const store = require('../src/core/store.js');
const { createShared } = require('../lib/shared.js');

const mem = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; };
function sample() {
  const s = store.create(mem());
  s.addBookmark({ url: 'https://www.tme.eu/hu/details/x/', title: 'TME adatlap', tags: 'napelem, adatlap', note: 'jó ár' });
  s.addBookmark({ url: 'https://hager.com/hu/termek', title: 'Hager', tags: 'eloszto', job: 'T07' });
  s.addReading({ url: 'https://njt.hu/jogszabaly/1', title: 'OTSZ', tags: 'napelem', text: 'Mentett szöveg.' });
  s.visit({ url: 'https://elozmeny.example/', title: 'Előzmény' });
  return s;
}

test('pick: bookmarks and / or reading list, by tag or job; never the history', () => {
  const doc = sample().exportAll();
  const all = S.pick(doc);
  assert.equal(all.bookmarks.length, 2); assert.equal(all['x-bongeszo'].reading.length, 1); assert.deepEqual(all.history, []);
  const solar = S.pick(doc, { tag: '#napelem' });
  assert.deepEqual(solar.bookmarks.map(b => b.title), ['TME adatlap']);
  assert.equal(solar['x-bongeszo'].reading.length, 1);
  assert.deepEqual(Object.keys(solar['x-bongeszo'].meta), ['https://www.tme.eu/hu/details/x/'], 'meta only for the rows picked');
  assert.deepEqual(S.pick(doc, { job: 't07' }).bookmarks.map(b => b.title), ['Hager']);
  assert.equal(S.pick(doc, { from: 'reading' }).bookmarks.length, 0);
  assert.equal(S.pick(doc, { from: 'bookmarks' })['x-bongeszo'].reading.length, 0);
});

test('a shared list carries everything it holds (BRW-Q07 = C) and reads as v1', () => {
  const doc = S.pick(sample().exportAll());
  const text = S.listFile(doc, { name: '  Napelem   adatlapok ', by: 'Gábor', at: '2026-11-25T10:00:00.000Z' });
  const j = JSON.parse(text);
  assert.equal(j.format, 'vrg.web-links'); assert.equal(j.v, 1); assert.equal(j.exported, '2026-11-25');
  assert.deepEqual(j['x-bongeszo'].share, { name: 'Napelem adatlapok', by: 'Gábor', at: '2026-11-25T10:00:00.000Z' });
  assert.equal(j['x-bongeszo'].meta['https://hager.com/hu/termek'].job, 'T07', 'job codes travel (the folder is the two of you)');
  assert.equal(j['x-bongeszo'].meta['https://www.tme.eu/hu/details/x/'].note, 'jó ár', 'notes travel');
  assert.equal(j['x-bongeszo'].reading[0].text, 'Mentett szöveg.', 'saved text travels');
  assert.equal(L.read(text).bookmarks.length, 2);
  assert.deepEqual(S.summary(j), { name: 'Napelem adatlapok', by: 'Gábor', at: '2026-11-25T10:00:00.000Z', bookmarks: 2, reading: 1 });
  // and it loads into another device's store without losing anything there
  const other = store.create(mem());
  other.addBookmark({ url: 'https://sajat.example/', title: 'Saját' });
  const r = other.importAll(j);
  assert.equal(r.ok, true);
  assert.equal(other.bookmarks().length, 3);
  assert.equal(S.slug('Árvíztűrő tükörfúrógép!'), 'arvizturo-tukorfurogep');
  assert.equal(S.slug('   '), 'lista');
});

test('the guest filter: only what is safe for anyone, each refusal with its reason', () => {
  const rows = [
    ['https://www.tme.eu/hu/?utm_source=x&id=2', 'TME'],
    ['http://titkositatlan.example/', 'http'],
    ['https://localhost:8812/', 'helyi'],
    ['https://192.168.1.1/admin', 'router'],
    ['https://8.8.8.8/', 'nyers IP'],
    ['https://user:pw@example.com/', 'jelszó'],
    ['https://docs.google.com/document/d/abc', 'Kovács ajánlat'],
    ['https://files.example.com/x.pdf?token=abc', 'letöltés'],
    ['https://valami.example/T07-terv', 'terv'],
    ['https://valami.example/b', 'VRG-2611-03 anyag'],
    ['https://www.tme.eu/hu/?id=2', 'duplikátum (utm nélkül ugyanaz)'],
  ];
  const doc = { bookmarks: rows.map(([url, title]) => ({ url, title, at: 1 })), 'x-bongeszo': { meta: {}, reading: [{ url: 'https://hager.com/', title: 'Hager', job: 'T07' }] } };
  const g = S.guest(doc, { jobs: ['T07'] });
  assert.deepEqual(g.items, [{ url: 'https://www.tme.eu/hu/?id=2', title: 'TME' }], 'tracking stripped, the duplicate counted once');
  assert.deepEqual(g.dropped.map(d => d.why), ['http', 'private', 'private', 'private', 'user', 'store', 'secret', 'job', 'job', 'job']);
  assert.ok(g.dropped.every(d => d.hu));
  assert.equal(S.guest(doc, {}).dropped.find(d => d.url === 'https://valami.example/T07-terv'), undefined, 'without the PC\'s job list a code-looking path is not guessed');
});

test('the guest page: static, escaped, nothing runs, nothing is sent onwards', () => {
  const html = S.guestHtml([{ url: 'https://a.example/?q="><script>alert(1)</script>', title: '<img src=x onerror=alert(1)>' }, { url: 'http://nem.example/', title: 'kimarad' }], { title: 'Napelem <b>', built: '2026-11-25' });
  assert.ok(!/<script/i.test(html.replace(/&lt;script/g, '')), 'no script element');
  assert.ok(!html.includes('<img'), 'titles are text');
  assert.match(html, /Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'/);
  assert.match(html, /<meta name="referrer" content="no-referrer">/);
  assert.match(html, /target="_blank" rel="noopener noreferrer"/);
  assert.ok(!html.includes('nem.example'), 'a non-https row never reaches the page, even when sent');
  assert.match(html, /<h1>Napelem &lt;b&gt;<\/h1>/);
  assert.match(html, /1 link · 2026-11-25/);
  assert.match(S.guestHtml([], {}), /Még nincs megosztott link/);
  assert.equal(S.guestHtml([], { title: 'X' }), S.guestHtml([], { title: 'X' }), 'deterministic without a date');
});

function tree() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vb-shared-'));
  fs.mkdirSync(path.join(root, '00_START'));
  return root;
}
const fakeJobs = { list: () => ({ ok: true, jobs: [{ code: 'T07' }] }) };

test('lib/shared: 60_Linkek lists, one file per list name, read back strictly', () => {
  assert.equal(createShared({ root: '' }).list().code, 'no-shared');
  const root = tree();
  const sh = createShared({ root, jobs: fakeJobs });
  assert.deepEqual(sh.list(), { ok: true, lists: [], folder: '60_Linkek' }, 'the folder appears on the first save');
  const doc = S.pick(sample().exportAll());
  const a = sh.save({ name: 'Napelem', by: 'G', doc });
  assert.equal(a.ok, true); assert.equal(a.file, 'napelem.links.json'); assert.equal(a.bookmarks, 2); assert.equal(a.reading, 1);
  assert.equal(sh.save({ name: 'Napelem', doc: S.pick(sample().exportAll(), { from: 'bookmarks' }) }).file, 'napelem.links.json', 'the same name updates its list');
  assert.equal(sh.save({ name: 'napelem!', doc }).file, 'napelem-2.links.json', 'another list with the same slug gets its own file');
  assert.equal(sh.save({ name: '', doc }).code, 'bad');
  assert.equal(sh.save({ name: 'Üres', doc: { bookmarks: [] } }).code, 'empty');
  assert.equal(sh.save({ name: 'Rossz', doc: { format: 'vrg.app-archive', v: 1, bookmarks: [] } }).code, 'format');
  fs.writeFileSync(path.join(root, '60_Linkek', 'ujabb.links.json'), JSON.stringify({ format: 'vrg.web-links', v: 2, bookmarks: [] }));
  const l = sh.list();
  assert.equal(l.lists.length, 3);
  assert.ok(l.lists.find(x => x.file === 'ujabb.links.json').bad, 'a newer file is listed as unreadable, never half-read');
  assert.equal(sh.get('napelem.links.json').doc['x-bongeszo'].share.name, 'Napelem');
  assert.equal(sh.get('../../etc/passwd').code, 'bad', 'only a list file name');
  assert.equal(sh.get('nincs.links.json').code, 'missing');
});

test('lib/shared: the guest page into 00_START, filtered here with the PC\'s job codes', () => {
  const root = tree();
  const sh = createShared({ root, jobs: fakeJobs });
  assert.deepEqual(sh.guestInfo(), { ok: true, exists: false, where: '00_START\\linkek.html' });
  const doc = { bookmarks: [{ url: 'https://www.tme.eu/hu/', title: 'TME', at: 1 }, { url: 'https://x.example/T07', title: 'munka', at: 2 }, { url: 'http://192.168.0.1/', title: 'router', at: 3 }] };
  const r = sh.guest({ title: 'Linkek', doc });
  assert.equal(r.ok, true); assert.equal(r.kept, 1); assert.deepEqual(r.dropped.map(d => d.why), ['job', 'http']);
  const html = fs.readFileSync(path.join(root, '00_START', 'linkek.html'), 'utf8');
  assert.ok(html.includes('https://www.tme.eu/hu/') && !html.includes('T07') && !html.includes('192.168'));
  assert.equal(sh.guestInfo().exists, true);
  fs.rmSync(path.join(root, '00_START'), { recursive: true });
  assert.equal(sh.guest({ doc }).code, 'no-start');
});

test('serve.js: /api/shared and /api/guest (own page and JSON to write; the route is declared in modules.json)', async () => {
  const { createServer } = require('../serve.js');
  const root = tree();
  const jobsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vb-jobs-'));
  fs.mkdirSync(path.join(jobsDir, 'T07_Kitalalt'));
  const { server } = createServer({ port: 18821, sharedDir: root, jobsDir, linksFile: '', deskDir: '', docs: { size: () => 0, search: () => [], build: () => 0 }, guard: { check: () => ({ ok: true }) }, suggest: { get: async () => [], sources: () => [] } });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const req = (method, p, headers, body) => new Promise((res, rej) => {
    const r = http.request({ host: '127.0.0.1', port, path: p, method, headers: Object.assign({ host: '127.0.0.1:18821' }, headers) }, rr => {
      let b = ''; rr.on('data', c => (b += c)); rr.on('end', () => res({ status: rr.statusCode, json: b ? JSON.parse(b) : null }));
    });
    r.on('error', rej); if (body) r.write(body); r.end();
  });
  const own = { origin: 'http://127.0.0.1:18821', 'content-type': 'application/json' };
  try {
    const doc = S.pick(sample().exportAll());
    assert.equal((await req('POST', '/api/shared', { 'content-type': 'application/json' }, JSON.stringify({ name: 'X', doc }))).status, 403, 'no origin');
    assert.equal((await req('POST', '/api/shared', { origin: 'https://evil.example', 'content-type': 'application/json' }, JSON.stringify({ name: 'X', doc }))).status, 403);
    const s1 = await req('POST', '/api/shared', own, JSON.stringify({ name: 'Napelem', doc }));
    assert.equal(s1.json.ok, true);
    assert.equal((await req('GET', '/api/shared', {})).json.lists[0].name, 'Napelem');
    assert.equal((await req('GET', '/api/shared?file=napelem.links.json', {})).json.doc.bookmarks.length, 2);
    const g = await req('POST', '/api/guest', own, JSON.stringify({ title: 'Linkek', doc }));
    assert.equal(g.json.ok, true);
    assert.equal(g.json.kept, 2, 'the T07 bookmark stays out (tied to a job)');
    assert.equal((await req('GET', '/api/guest', {})).json.exists, true);
  } finally { server.close(); }
});
