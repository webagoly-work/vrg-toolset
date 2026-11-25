// WP-50 — the VRG Böngésző's links door (T1, BRW-Q01): web.json is the master of vrg.web-links v1. lib/bookmarks.js takes ops
// (applyOps), absorbs Browser/serve.js's inbox, and lib/applinks.js answers vrg-app://browser/__vrg/links to that app only.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path');
const { createBookmarks } = require('../shell/lib/bookmarks.js');
const { createAppLinks, isLinksRequest } = require('../shell/lib/applinks.js');

const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wp50-')), 'web.json');
const URL_ = 'vrg-app://browser/__vrg/links';

test('bookmarks: ops from the app are applied, idempotent, and written as the Asztal format', () => {
  const file = tmp();
  let t = 1000;
  const bm = createBookmarks({ file, now: () => t, timers: false });
  bm.toggle('https://github.com/', 'GitHub');
  const ops = [{ op: 'bookmark', url: 'https://tme.eu/hu/', title: 'TME', at: 500 }, { op: 'visit', url: 'https://index.hu/', title: 'Index', at: 900 },
    { op: 'unbookmark', url: 'https://github.com/' }, { op: 'visit', url: 'file:///etc/passwd', at: 1 }];
  assert.equal(bm.applyOps(ops), 3, 'the file: URL is dropped');
  bm.applyOps(ops);
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.deepEqual(j.bookmarks.map(b => b.url), ['https://tme.eu/hu/']);
  assert.deepEqual(j.history, [{ url: 'https://index.hu/', title: 'Index', at: 900 }], 'twice is once');
  assert.equal(j.format, undefined, 'web.json stays the two arrays the Asztal has always written');
  t = 2000;
  bm.visit('https://pane.example/', 'Seen in the Böngésző pane');
  assert.deepEqual(bm.snapshot().history.map(h => h.url), ['https://index.hu/', 'https://pane.example/'], 'the pane history is the app history now');
});

test('bookmarks: the serve.js inbox is absorbed once and deleted', () => {
  const file = tmp();
  const bm = createBookmarks({ file, now: () => 5000, timers: false });
  fs.writeFileSync(file + '.inbox', JSON.stringify({ ops: [{ op: 'bookmark', url: 'https://a.hu/', title: 'A', at: 1 }] }));
  assert.equal(bm.absorb(), 1);
  assert.ok(!fs.existsSync(file + '.inbox') && !fs.existsSync(file + '.inbox.taking'));
  assert.equal(bm.absorb(), 0, 'no inbox, nothing to do');
  fs.writeFileSync(file + '.inbox', '{broken');
  assert.equal(bm.absorb(), 0);
  assert.ok(!fs.existsSync(file + '.inbox.taking'), 'a broken inbox is dropped, not kept forever');
  assert.deepEqual(bm.list().map(b => b.url), ['https://a.hu/']);
});

test('applinks: the browser app only, GET reads, POST writes', () => {
  const file = tmp();
  const bm = createBookmarks({ file, now: () => 7000, timers: false });
  const al = createAppLinks({ bookmarks: bm });
  assert.ok(isLinksRequest(URL_));
  for (const u of ['vrg-app://planner/__vrg/links', 'vrg-app://browser/__vrg/links/x', 'https://browser/__vrg/links']) assert.ok(!isLinksRequest(u), u);
  assert.equal(al.handle({ method: 'GET', url: 'vrg-app://planner/__vrg/links', origin: '' }).status, 404);
  assert.equal(al.handle({ method: 'GET', url: URL_, origin: 'vrg-app://planner' }).status, 403, 'another app');
  assert.equal(al.handle({ method: 'POST', url: URL_, origin: '', body: '{"ops":[]}' }).status, 403, 'a write names its origin');
  assert.equal(al.handle({ method: 'POST', url: URL_, origin: 'vrg-app://browser', body: 'x' }).status, 400);
  assert.equal(al.handle({ method: 'POST', url: URL_, origin: 'vrg-app://browser', body: 'x'.repeat(2 * 1024 * 1024) }).status, 413);
  assert.equal(al.handle({ method: 'DELETE', url: URL_, origin: 'vrg-app://browser' }).status, 405);
  const w = al.handle({ method: 'POST', url: URL_, origin: 'vrg-app://browser', body: JSON.stringify({ ops: [{ op: 'bookmark', url: 'https://a.hu/', title: 'A', at: 3 }] }) });
  assert.equal(w.status, 200);
  assert.equal(w.json.applied, 1);
  const r = al.handle({ method: 'GET', url: URL_, origin: '' });
  assert.equal(r.json.format, 'vrg.web-links');
  assert.equal(r.json.v, 1);
  assert.deepEqual(r.json.bookmarks, [{ url: 'https://a.hu/', title: 'A', at: 3 }]);
});

// ---- T2: the Böngésző pane's omnibox and the palette get the VRG Böngésző's rules
const search = require('../shell/lib/search.js');
test('omnibox decide: bangs, Tiszta link, a link with a password refused; toUrl unchanged', () => {
  assert.deepEqual(search.decide('!tme NYM-J 3x2,5'), { url: 'https://www.tme.eu/hu/katalog/?queryPhrase=NYM-J%203x2%2C5', bang: 'tme' });
  assert.equal(search.decide('Ohm-törvény !w').bang, 'wiki-hu');
  assert.deepEqual(search.decide('index.hu/?utm_source=x&id=1'), { url: 'https://index.hu/?id=1', removed: ['utm_source'] });
  const pw = search.decide('https://user:pw@bank.hu/');
  assert.equal(pw.url, '');
  assert.match(pw.hu, /jelszó/);
  assert.match(search.decide('kábel méretezés').url, /^https:\/\/www\.google\.com\/search\?q=/);
  assert.match(search.decide('!nincsilyen x').url, /google\.com\/search\?q=!nincsilyen/, 'an unknown bang is a plain search');
  assert.equal(search.decide('srv:idojaras').url, 'http://localhost:8808/');
  assert.equal(search.toUrl('index.hu/?utm_source=x'), 'https://index.hu/?utm_source=x', 'toUrl keeps its old answer');
  assert.ok(search.loadEngines().length >= 20);
});
test('palette: the frame page loads Gyorsválasz from the Browser core, and every script it names exists', () => {
  const page = path.join(__dirname, '..', 'page', 'vrg-desktop.html');
  const html = fs.readFileSync(page, 'utf8');
  const srcs = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
  assert.ok(srcs.includes('../../Browser/src/core/answers.js'));
  for (const s of srcs.filter(x => x !== '../dashboard-data.js')) assert.ok(fs.existsSync(path.join(path.dirname(page), s)), s);   // that one is built (gitignored)
  global.window = global;
  const A = require('../../Browser/src/core/answers.js');
  assert.equal(A.answer('230V 16A').value, '3,68 kW');
  assert.equal(A.answer('Varler Planner'), null, 'a command name stays a command search');
});

// ---- T5 / T6 (Phase 3): page watches in the feed, Küldés Claude-nak, the documents in Belső keresés
const presetsMod = require('../shell/lib/presets.js');
test('page-watch: a baseline, then "nem változott", then the change with its lines, and the phone rung once', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wp50w-'));
  let html = '<html><head><title>Teszt jogszabály</title></head><body><article><h1>Teszt jogszabály</h1><p>' + 'Első bekezdés, elég hosszú ahhoz, hogy a felolvasó megtartsa. '.repeat(2) + '</p><p>Hatály: 2026. január 1.</p></article></body></html>';
  const fetch = async () => ({ status: 200, ok: true, text: async () => html });
  const rung = [];
  let t = 1000;
  const pre = presetsMod.createPresets({ jobs: { create: () => 'j' }, fetch, now: () => t, cacheFile: path.join(dir, 'cache.json'),
    configFile: null, userFile: () => ({ allowHosts: ['pelda.example'], presets: [{ id: 'watch-1', hu: 'Jogszabály', kind: 'page-watch', url: 'https://pelda.example/jog', every: 60 }, { id: 'watch-2', hu: 'Más', kind: 'page-watch', url: 'https://mas.example/', every: 60 }] }),
    sources: { notify: n => rung.push(n) } });
  let r = await pre.exec('watch-1');
  assert.match(r.items[0].hu, /^Figyelés indult: Teszt jogszabály/);
  t = 2000; r = await pre.exec('watch-1');
  assert.match(r.items[0].hu, /^Nem változott/);
  html = html.replace('Hatály: 2026. január 1.', 'Hatály: 2026. július 1. (módosítva)');
  t = 3000; r = await pre.exec('watch-1');
  assert.match(r.items[0].hu, /^Változott: Teszt jogszabály/);
  assert.match(r.items[0].detail, /\+ 1 új sor: Hatály: 2026\. július 1\. \(módosítva\)/);
  assert.match(r.items[0].detail, /− 1 eltűnt: Hatály: 2026\. január 1\./);
  assert.equal(rung.length, 1); assert.match(rung[0].title, /^Változott/); assert.equal(rung[0].link, 'https://pelda.example/jog');
  assert.equal(r.state.changedAt, 3000);
  const view = pre.results().results.find(x => x.pre === 'watch-1');
  assert.equal(view.state, undefined, 'the stored lines never go to the page');
  const fail = await pre.exec('watch-2');
  assert.match(fail.error, /nincs engedélyezve/, 'a host outside allowHosts is refused before any request');
  html = '';
  const keep = presetsMod.createPresets({ jobs: { create: () => 'j' }, fetch: async () => { throw Object.assign(new Error('x'), { hu: 'Hálózati hiba.' }); }, now: () => 4000, cacheFile: path.join(dir, 'cache.json'),
    configFile: null, userFile: () => ({ allowHosts: ['pelda.example'], presets: [{ id: 'watch-1', kind: 'page-watch', url: 'https://pelda.example/jog' }] }) });
  const e = await keep.exec('watch-1');
  assert.ok(e.error && e.state && e.state.lines.length, 'a failed run keeps what the watch had seen');
  assert.deepEqual(presetsMod.watchCompare(['a', 'b'], ['b', 'c']), { added: ['c'], removed: ['a'] });
  assert.deepEqual(presetsMod.watchLines('12:30\n2026. 11. 23.\nValódi sor\nValódi sor\n  x  '), ['Valódi sor'], 'bare dates, times and repeats are not lines');
});
test('Küldés Claude-nak: the door makes a pack for the browser app only, and the pack reads like any other', () => {
  const made = [];
  const al = createAppLinks({ bookmarks: createBookmarks({ file: tmp(), timers: false }), toClaude: (title, text) => { made.push({ title, text }); return { ok: true, packId: 'p0123456789abcdef' }; } });
  const U = 'vrg-app://browser/__vrg/claude';
  assert.ok(isLinksRequest(U));
  assert.equal(al.handle({ method: 'GET', url: U, origin: 'vrg-app://browser' }).status, 405);
  assert.equal(al.handle({ method: 'POST', url: U, origin: '', body: '{"text":"x"}' }).status, 403, 'a write names its origin');
  assert.equal(al.handle({ method: 'POST', url: U, origin: 'vrg-app://planner', body: '{"text":"x"}' }).status, 403);
  assert.equal(al.handle({ method: 'POST', url: U, origin: 'vrg-app://browser', body: '{"text":"  "}' }).status, 400);
  const ok = al.handle({ method: 'POST', url: U, origin: 'vrg-app://browser', body: JSON.stringify({ title: 'Cikk\u0007', text: 'Szöveg\u0000 itt' }) });
  assert.equal(ok.status, 200);
  assert.deepEqual(made, [{ title: 'Cikk', text: 'Szöveg itt' }], 'control characters out');
  assert.equal(createAppLinks({ bookmarks: createBookmarks({ file: tmp(), timers: false }) }).handle({ method: 'POST', url: U, origin: 'vrg-app://browser', body: '{"text":"x"}' }).status, 503);
  const { createCtx } = require('../shell/lib/ctx.js');
  const packs = fs.mkdtempSync(path.join(os.tmpdir(), 'wp50p-'));
  const ctx = createCtx({ execFile: () => {}, paths: { packs: () => packs, userDir: () => packs }, now: () => new Date(Date.UTC(2026, 10, 23, 10, 0)) });
  const p = ctx.packText('Kutatás: túlfeszültség', '# Jegyzet\nidézet [1]');
  assert.match(p.packId, /^p[0-9a-f]{16}$/);
  const text = fs.readFileSync(ctx.packFile(p.packId), 'utf8');
  assert.match(text, /^# Kutatás: túlfeszültség\n\n\*A VRG Böngészőből küldve \(2026-11-23 10:00\)\.\*\n\n# Jegyzet\nidézet \[1\]\n$/);
  assert.equal(ctx.sendToClaude(p.packId, 'chat').ok, true, 'the chat pane takes it as a pack');
  assert.equal(ctx.packText('x', '   ').ok, false);
});
test('Belső keresés: the documents half, and a document hit opens in the viewer', async () => {
  const { createInnerSearch } = require('../shell/lib/innersearch.js');
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'wp50r-'));
  fs.mkdirSync(path.join(repo, 'docs'));
  fs.writeFileSync(path.join(repo, 'docs', 'kabel.md'), '# Kábelméretezés\n\nA feszültségesés határa 4 %.');
  const docs = require('../../Browser/lib/docs.js').createDocs({ repo });
  const execFile = (n, a, o, cb) => cb(new Error('no stack here'), '', '');
  const is = createInnerSearch({ execFile, full: repo, repo, docs, issue: abs => 'h:' + Buffer.from(abs).toString('base64').slice(0, 22) });
  const r = await is.inner({ q: 'feszultsegeses' });
  assert.deepEqual(r.docs.map(d => d.path), ['docs/kabel.md']);
  assert.equal(r.docs[0].title, 'Kábelméretezés');
  assert.match(r.docs[0].snippet, /feszültségesés/);
  const o = is.openHit(0, 'doc');
  assert.equal(o.ok, true); assert.equal(o.name, 'kabel.md'); assert.equal(o.line, 1);
  assert.equal(is.openHit(5, 'doc').ok, false);
  assert.deepEqual((await is.inner({ q: 'feszultsegeses', only: 'code' })).docs, [], 'only code: no documents');
});
