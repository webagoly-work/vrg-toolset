// server.test.js — serve.js and its libraries without the internet: the network guard (SSRF), the reader, the
// document index, suggestions, and the server's Host / Origin rules with a fake guard.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
const { createGuard, addressKind, explain } = require('../lib/netguard.js');
const reader = require('../lib/reader.js');
const { createDocs } = require('../lib/docs.js');
const suggest = require('../lib/suggest.js');
const { createServer } = require('../serve.js');

test('netguard: address classes', () => {
  for (const ip of ['127.0.0.1', '0.0.0.0', '::1', '::ffff:127.0.0.1']) assert.equal(addressKind(ip), 'loopback', ip);
  for (const ip of ['10.1.2.3', '172.16.0.1', '172.31.255.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', 'fd00::1', 'fe80::1', '::ffff:192.168.0.1']) assert.equal(addressKind(ip), 'private', ip);
  for (const ip of ['224.0.0.1', '255.255.255.255', '2001:db8::1']) assert.equal(addressKind(ip), 'reserved', ip);
  for (const ip of ['8.8.8.8', '172.32.0.1', '2a00:1450:4001::1']) assert.equal(addressKind(ip), '', ip);
});
test('netguard: what may be fetched at all', () => {
  const g = createGuard({});
  for (const [u, code] of [['ftp://x.hu/', 'scheme'], ['file:///etc/passwd', 'scheme'], ['https://a:b@x.hu/', 'credentials'], ['http://127.0.0.1:8812/', 'address'],
    ['http://[::1]/', 'address'], ['http://192.168.1.1/', 'address'], ['http://localhost/', 'address'], ['http://router.lan/', 'address'], ['nem url', 'invalid']]) {
    assert.equal(g.check(u).code, code, u);
  }
  assert.equal(g.check('https://hu.wikipedia.org/').ok, true);
  const lan = createGuard({ allowLan: true });
  assert.equal(lan.check('http://192.168.1.1/').ok, true, '--allow-lan opens the LAN');
  assert.equal(lan.check('http://127.0.0.1/').ok, false, 'never this PC');
  assert.equal(lan.check('http://localhost/').ok, false);
});
test('netguard: a name that resolves inside is refused in the lookup itself (DNS rebinding)', async () => {
  const fake = map => (host, opts, cb) => cb(null, (map[host] || []).map(a => ({ address: a, family: a.includes(':') ? 6 : 4 })));
  const g = createGuard({ lookup: fake({ 'public.example': ['93.184.216.34'], 'evil.example': ['93.184.216.34', '127.0.0.1'], 'lan.example': ['192.168.0.10'] }) });
  const look = h => new Promise(res => g.safeLookup(h, {}, (e, a) => res(e ? e.code + ':' + e.kind : a)));
  assert.equal(await look('public.example'), '93.184.216.34');
  assert.equal(await look('evil.example'), 'VRG_BLOCKED:loopback', 'one inside answer is enough to refuse');
  assert.equal(await look('lan.example'), 'VRG_BLOCKED:private');
  const lan = createGuard({ allowLan: true, lookup: fake({ 'lan.example': ['192.168.0.10'], 'evil.example': ['127.0.0.1'] }) });
  const look2 = h => new Promise(res => lan.safeLookup(h, {}, (e, a) => res(e ? e.code : a)));
  assert.equal(await look2('lan.example'), '192.168.0.10');
  assert.equal(await look2('evil.example'), 'VRG_BLOCKED');
  assert.match(explain({ code: 'VRG_BLOCKED' }), /helyi vagy belső/);
});
test('netguard: every redirect hop is checked again', async () => {
  const hops = { 'https://site.example/': { status: 200, url: 'https://site.example/', type: 'text/html', body: Buffer.from('ok') },
    'https://site.example/go': { redirect: 'http://192.168.1.1/admin' }, 'https://site.example/loop': { redirect: 'https://site.example/loop' },
    'https://site.example/next': { redirect: 'https://other.example/' }, 'https://other.example/': { status: 200, url: 'https://other.example/', type: 'text/html', body: Buffer.from('other') } };
  const seen = [];
  const g = createGuard({ transport: async u => { seen.push(u.href); return hops[u.href]; } });
  assert.equal((await g.get('https://site.example/')).status, 200);
  await assert.rejects(g.get('https://site.example/go'), e => e.code === 'VRG_ADDRESS');
  assert.ok(!seen.includes('http://192.168.1.1/admin'), 'the LAN address is never requested');
  await assert.rejects(g.get('https://site.example/loop'), e => e.code === 'VRG_REDIRECTS');
  assert.equal((await g.get('https://site.example/next')).body.toString(), 'other');
});
test('reader: drops scripts, menus, banners and link lists; keeps headings, lists, code, table rows', () => {
  const html = '<html lang="hu"><head><meta property="og:site_name" content="Példa"><title>Cikk címe</title><script>var x="<p>rossz</p>"</script></head><body>' +
    '<nav><a href="/">Főoldal</a></nav><div class="cookie-consent">Sütiket használunk, rendben?</div>' +
    '<article><h1>Cikk címe</h1><p>Ez egy elég hosszú első bekezdés, amely a lényeget mondja el &ndash; &Odblac;sszeg &amp; t&ouml;bb.</p>' +
    '<p onclick="alert(1)">Második bekezdés <img src=x onerror=alert(1)> képpel, de a kép kimarad belőle teljesen.</p>' +
    '<div class="share-buttons"><a href="https://fb.com">Megosztás a Facebookon most azonnal</a></div>' +
    '<h2>Lista</h2><ul><li>egy</li><li>kettő</li></ul><pre>sor 1\n  sor 2</pre><table><tr><td>2,5 mm²</td><td>20 A</td></tr></table>' +
    '<p>Linkek: <a href="https://a.hu/x">A</a> <a href="javascript:alert(1)">J</a> és még szöveg, hogy hosszú legyen ez is.</p><iframe src="https://evil"></iframe></article>' +
    '<footer>Minden jog fenntartva, lábléc szöveg, ami hosszú.</footer></body></html>';
  const x = reader.extract(html, 'https://pelda.hu/cikk');
  assert.equal(x.title, 'Cikk címe');
  assert.equal(x.site, 'Példa');
  assert.equal(x.lang, 'hu');
  const all = x.blocks.map(b => b.t + ':' + b.text).join('\n');
  assert.doesNotMatch(all, /rossz|Sütiket|Főoldal|Facebook|lábléc|alert/);
  assert.match(all, /Ősszeg & több/);
  assert.match(all, /h2:Lista/);
  assert.match(all, /li:kettő/);
  assert.match(all, /pre:sor 1\n  sor 2/);
  assert.match(all, /p:2,5 mm² · 20 A/);
  assert.deepEqual(x.links.map(l => l.url), ['https://a.hu/x'], 'only http(s) links, absolute');
  assert.equal(x.blocks[0].t, 'p', 'the title heading is not repeated');
});
test('reader: Hungarian legacy charsets and the Markdown converter', () => {
  assert.equal(reader.decode(Buffer.from([0xf5, 0xfb, 0xd5, 0xdb]), 'iso-8859-2'), 'őűŐŰ');
  assert.equal(reader.decode(Buffer.from('<meta charset="windows-1250">' + String.fromCharCode(0xf5), 'latin1')).slice(-1), 'ő');
  const md = reader.markdown('# Cím\n\nEgy **vastag** [link](x) és `kód`.\n\n## Al\n- [x] kész\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n```\nkód\n```\n> idézet\n');
  assert.equal(md.title, 'Cím');
  assert.deepEqual(md.blocks.map(b => b.t + ':' + b.text), ['p:Egy vastag link és kód.', 'h2:Al', 'li:kész', 'p:a · b', 'p:1 · 2', 'pre:kód', 'quote:idézet']);
});

function tmpRepo() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'vb-docs-'));
  fs.mkdirSync(path.join(d, 'docs'));
  fs.mkdirSync(path.join(d, 'node_modules', 'x'), { recursive: true });
  fs.mkdirSync(path.join(d, 'Vendor'));
  fs.writeFileSync(path.join(d, 'README.md'), '# Gyökér\n\nA repó leírása.');
  fs.writeFileSync(path.join(d, 'docs', 'kabel.md'), '# Kábelméretezés\n\n## Feszültségesés\nA határ 4 %, a leghosszabb ágon.');
  fs.writeFileSync(path.join(d, 'node_modules', 'x', 'README.md'), '# Feszültségesés idegen');
  fs.writeFileSync(path.join(d, 'Vendor', 'a.md'), '# Feszültségesés vendor');
  fs.writeFileSync(path.join(d, 'secret.txt'), 'titok');
  return d;
}
test('docs: indexes the repo Markdown, skips vendored folders, opens only indexed files', () => {
  const docs = createDocs({ repo: tmpRepo() });
  assert.equal(docs.build(), 2);
  const h = docs.search('feszultsegeses');
  assert.deepEqual(h.map(x => x.path), ['docs/kabel.md']);
  assert.equal(h[0].title, 'Kábelméretezés');
  assert.equal(docs.doc('docs/kabel.md').blocks[0].text, 'Feszültségesés');
  assert.equal(docs.doc('secret.txt'), null);
  assert.equal(docs.doc('../etc/passwd'), null);
  assert.equal(docs.doc('Vendor/a.md'), null);
});
test('suggest: the OpenSearch shape, cleaned and capped', () => {
  assert.deepEqual(suggest.parse(JSON.stringify(['kab', ['kábel', 'kábel\u0000csatorna', 3, 'x'.repeat(300), 'a', 'b', 'c', 'd', 'e', 'f']])), ['kábel', 'kábelcsatorna', 'x'.repeat(120), 'a', 'b', 'c', 'd', 'e']);
  assert.deepEqual(suggest.parse('nem json'), []);
  assert.deepEqual(Object.keys(suggest.SOURCES).sort(), ['ddg', 'google', 'wiki-en', 'wiki-hu']);
});

// ------------------------------------------------------------------ the server, with a fake guard
async function withServer(fn) {
  const page = path.join(os.tmpdir(), 'vb-page-' + process.pid + '.html');
  fs.writeFileSync(page, '<!doctype html><title>VRG Böngésző</title>');
  const calls = [];
  const guard = {
    check: u => (/^https:\/\/ok\.example\//.test(u) || /^https:\/\/(pdf|empty)\.example\//.test(u) ? { ok: true } : { ok: false, code: 'address', hu: 'Helyi cím.' }),
    get: async u => {
      calls.push(u);
      if (u.startsWith('https://pdf.')) return { status: 200, url: u, type: 'application/pdf', charset: '', body: Buffer.from('%PDF') };
      if (u.startsWith('https://empty.')) return { status: 200, url: u, type: 'text/html', charset: 'utf-8', body: Buffer.from('<script>x</script>') };
      return { status: 200, url: u, type: 'text/html', charset: 'iso-8859-2', body: Buffer.from('<title>Teszt</title><p>' + 'Hosszú magyar szöveg itt. '.repeat(3) + String.fromCharCode(0xf5) + '</p>', 'latin1') };
    },
  };
  const { server } = createServer({ port: 18812, guard, docs: createDocs({ repo: tmpRepo() }), page, suggest: { get: async (s, q) => [q + ' 1', q + ' 2'], sources: () => ['google'] } });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const get = (p, headers) => new Promise((res, rej) => http.get({ host: '127.0.0.1', port, path: p, headers: Object.assign({ host: '127.0.0.1:18812' }, headers) }, r => {
    let b = ''; r.on('data', c => (b += c)); r.on('end', () => { let j = null; try { j = JSON.parse(b); } catch (e) {} res({ status: r.statusCode, headers: r.headers, body: b, json: j }); });
  }).on('error', rej));
  try { await fn(get, calls); } finally { server.close(); fs.unlinkSync(page); }
}
test('serve: Host and Origin rules, read-only, the page', () => withServer(async get => {
  assert.equal((await get('/api/health', { host: 'evil.example:18812' })).status, 421, 'DNS rebinding: a foreign Host');
  assert.equal((await get('/api/health', { origin: 'https://evil.example' })).status, 403, 'another web page');
  assert.equal((await get('/api/health', { origin: 'null' })).status, 403, 'a file:// page');
  const ok = await get('/api/health', { origin: 'vrg-app://browser' });
  assert.equal(ok.status, 200);
  assert.equal(ok.headers['access-control-allow-origin'], 'vrg-app://browser', 'the VRG Asztal app origin is allowed');
  assert.equal(ok.json.reader, true);
  const page = await get('/');
  assert.equal(page.status, 200);
  assert.match(page.body, /VRG Böngésző/);
  assert.equal(page.headers['x-content-type-options'], 'nosniff');
}));
test('serve: the reader through the guard', () => withServer(async (get, calls) => {
  const r = await get('/api/reader?url=' + encodeURIComponent('https://ok.example/cikk'));
  assert.equal(r.json.ok, true);
  assert.equal(r.json.title, 'Teszt');
  assert.match(r.json.blocks[0].text, /ő$/, 'the page charset is honoured');
  assert.equal((await get('/api/reader?url=' + encodeURIComponent('http://127.0.0.1:22/'))).json.code, 'address');
  assert.equal((await get('/api/reader?url=' + encodeURIComponent('https://pdf.example/a.pdf'))).json.code, 'pdf');
  assert.equal((await get('/api/reader?url=' + encodeURIComponent('https://empty.example/'))).json.code, 'empty');
  assert.deepEqual(calls, ['https://ok.example/cikk', 'https://pdf.example/a.pdf', 'https://empty.example/'], 'a refused URL is never fetched');
}));
test('serve: documents and suggestions', () => withServer(async get => {
  const d = await get('/api/docs?q=' + encodeURIComponent('feszültségesés'));
  assert.deepEqual(d.json.hits.map(h => h.path), ['docs/kabel.md']);
  assert.equal((await get('/api/doc?path=docs%2Fkabel.md')).json.title, 'Kábelméretezés');
  assert.equal((await get('/api/doc?path=..%2F..%2Fetc%2Fpasswd')).status, 404);
  assert.equal((await get('/api/doc?path=secret.txt')).status, 404);
  assert.deepEqual((await get('/api/suggest?src=google&q=kab')).json.list, ['kab 1', 'kab 2']);
}));
