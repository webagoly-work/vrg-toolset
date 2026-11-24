// links.test.js — `vrg.web-links` v1. The first half repeats the contract cases of the Data Vault's browser-kit
// (webagoly-work/data-vault plugins/browser-kit/test.mjs, DV-Q22 B0) against this implementation, so the two lines keep
// reading each other's files; the second half is the work line's own: the extension key, ops, grouping.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../src/core/links.js');

test('contract: the Asztal web.json reads as it is', () => {
  const asztal = { bookmarks: [{ url: 'https://github.com/', title: 'GitHub', at: 5 }, { url: 'file:///x', title: 'bad', at: 1 },
    { url: 'https://github.com/', title: 'dup', at: 9 }, { url: 'https://nat.hu/', title: 'no at' }],
  history: [{ url: 'https://b.hu/', title: 'B', at: 20 }, { url: 'https://a.hu/', title: 'A', at: 10 }, { url: 'https://c.hu/', title: 'no at' }] };
  const r = L.read(JSON.stringify(asztal));
  assert.deepEqual(r.bookmarks.map(b => b.url), ['https://github.com/', 'https://nat.hu/'], 'bad and duplicate rows dropped');
  assert.equal(r.bookmarks[1].at, 0, 'a bookmark without a time is kept at 0');
  assert.deepEqual(r.history.map(h => h.at), [10, 20], 'oldest first, a visit without a time dropped');
  assert.equal(L.read({ bookmarks: [{ url: 'https://x.hu/', title: 'x'.repeat(999), at: 1 }] }).bookmarks[0].title.length, 300);
  assert.throws(() => L.read({ format: 'vrg.app-archive', v: 1, bookmarks: [] }), /not a links file/);
  assert.throws(() => L.read({ format: L.FORMAT, v: 2, bookmarks: [] }), /newer/);
  assert.throws(() => L.read({ rows: [] }), /no bookmarks or history/);
  assert.throws(() => L.read('[]'), /not a links file/);
});
test('contract: the file round-trips and keeps the Asztal two arrays', () => {
  const r = L.read({ bookmarks: [{ url: 'https://github.com/', title: 'GitHub', at: 5 }], history: [{ url: 'https://a.hu/', title: 'A', at: 10 }] });
  const file = L.write(r, { exported: '2026-11-23' });
  const j = JSON.parse(file);
  assert.equal(j.format, 'vrg.web-links'); assert.equal(j.v, 1); assert.equal(j.exported, '2026-11-23');
  assert.deepEqual(L.read(file), r);
  assert.ok(Array.isArray(j.bookmarks) && Array.isArray(j.history));
});
test('contract: merge loses nothing and changes neither side', () => {
  const A = L.read({ bookmarks: [{ url: 'https://github.com/', title: 'GitHub', at: 5 }, { url: 'https://nat.hu/', title: 'N' }],
    history: [{ url: 'https://a.hu/', title: 'A', at: 10 }, { url: 'https://b.hu/', title: 'B', at: 20 }] });
  const phone = { bookmarks: [{ url: 'https://github.com/', title: 'GitHub — the longer title', at: 3 }, { url: 'https://m.hu/', title: 'M', at: 4 }],
    history: [{ url: 'https://a.hu/', title: 'A', at: 10 }, { url: 'https://p.hu/', title: 'P', at: 15 }] };
  const before = JSON.stringify(phone);
  const M = L.merge(A, phone);
  assert.equal(JSON.stringify(phone), before);
  assert.deepEqual(M.bookmarks.map(b => b.url).sort(), ['https://github.com/', 'https://m.hu/', 'https://nat.hu/']);
  const gh = M.bookmarks.find(b => b.url === 'https://github.com/');
  assert.equal(gh.at, 3); assert.equal(gh.title, 'GitHub — the longer title');
  assert.deepEqual(M.history.map(h => h.at), [10, 15, 20], 'the same visit on both sides counts once');
  assert.deepEqual(L.merge(M, M), M);
});
test('contract: visit, bookmark, prune', () => {
  let V = L.visit(L.empty(), 'https://a.hu/', 'A', 100);
  V = L.visit(V, 'https://a.hu/', 'A, title arrived late', 200);
  assert.equal(V.history.length, 1); assert.equal(V.history[0].at, 200); assert.equal(V.history[0].title, 'A, title arrived late');
  V = L.visit(V, 'https://b.hu/', 'B', 300); V = L.visit(V, 'javascript:x', 'no', 400);
  assert.equal(V.history.length, 2);
  let t = L.toggle(V, 'https://b.hu/', 'B', 500); assert.equal(t.bookmarked, true);
  t = L.toggle(t.links, 'https://b.hu/', 'B', 600); assert.equal(t.bookmarked, false);
  assert.equal(L.toggle(V, 'file:///x', 'x').err, 'bad-url');
  const full = { bookmarks: Array.from({ length: L.MAX_BOOKMARKS }, (_, i) => ({ url: 'https://h' + i + '.hu/', title: '', at: i })) };
  assert.equal(L.toggle(full, 'https://new.hu/', 'n').err, 'limit');
  const DAY = 864e5, now = 100 * DAY;
  const P = L.prune({ bookmarks: [{ url: 'https://old.hu/', title: '', at: 1 }], history: [{ url: 'https://o.hu/', title: '', at: 1 }, { url: 'https://n.hu/', title: '', at: now - DAY }] }, 30, now);
  assert.deepEqual(P.history.map(h => h.url), ['https://n.hu/']); assert.equal(P.bookmarks.length, 1, 'bookmarks are never pruned');
});

// ---- the work line's own
test('the x-bongeszo extension rides along and other readers ignore it', () => {
  const ext = { meta: { 'https://a.hu/': { tags: ['beszerzés'], job: 'VRG-2611-03', note: '' } }, pinned: ['https://a.hu/'] };
  const file = L.write({ bookmarks: [{ url: 'https://a.hu/', title: 'A', at: 1 }], history: [] }, { ext });
  const j = JSON.parse(file);
  assert.deepEqual(j['x-bongeszo'], ext);
  assert.deepEqual(L.read(file).ext, ext);
  // the Asztal's loader (bookmarks.js) keeps only the two arrays: simulate it
  const asztalView = { bookmarks: j.bookmarks.map(b => ({ url: b.url, title: b.title, at: b.at })), history: j.history };
  assert.deepEqual(asztalView.bookmarks, [{ url: 'https://a.hu/', title: 'A', at: 1 }]);
});
test('ops: idempotent, http(s) only', () => {
  const ops = [{ op: 'bookmark', url: 'https://a.hu/', title: 'A', at: 5 }, { op: 'visit', url: 'https://a.hu/', title: 'A', at: 6 },
    { op: 'visit', url: 'javascript:alert(1)', at: 7 }, { op: 'drop-table', url: 'https://x.hu/' }, { op: 'unbookmark', url: 'https://b.hu/' }];
  const base = { bookmarks: [{ url: 'https://b.hu/', title: 'B', at: 1 }], history: [] };
  const once = L.apply(base, ops), twice = L.apply(once, ops);
  assert.deepEqual(once, twice, 'resending an outbox changes nothing');
  assert.deepEqual(once.bookmarks.map(b => b.url), ['https://a.hu/']);
  assert.deepEqual(once.history, [{ url: 'https://a.hu/', title: 'A', at: 6 }]);
  assert.equal(L.cleanOps(ops).length, 3);
  const h = { history: [{ url: 'https://a.hu/', title: '', at: 1 }, { url: 'https://b.hu/', title: '', at: 2 }, { url: 'https://a.hu/', title: '', at: 9 }] };
  assert.deepEqual(L.apply(h, [{ op: 'forget', url: 'https://a.hu/' }]).history.map(x => x.at), [2]);
  assert.deepEqual(L.apply(h, [{ op: 'clear', at: 2 }]).history.map(x => x.at), [1], 'clear since 2');
  assert.deepEqual(L.apply(h, [{ op: 'clear', at: 0 }]).history, []);
  assert.equal(L.cleanOps([{ op: 'clear', url: 'https://a.hu/', at: 0 }]).length, 0, 'a clear names no URL');
});
test('grouped history: one line per URL, newest first, with the visit count', () => {
  const g = L.grouped({ history: [{ url: 'https://a.hu/', title: 'A', at: 1 }, { url: 'https://b.hu/', title: 'B', at: 2 }, { url: 'https://a.hu/', title: 'A2', at: 3 }] });
  assert.deepEqual(g.map(x => [x.url, x.count, x.title]), [['https://a.hu/', 2, 'A2'], ['https://b.hu/', 1, 'B']]);
  assert.deepEqual(L.grouped({ history: g.map(() => null).filter(Boolean) }), []);
});

// the shared contract fixture: the phone's Kotlin port (Mobile kit-core WebTest.kt) replays the same file
test('contract fixture: links, ops, strip and the address bar agree with VRG Mobile', () => {
  const fx = require('./fixtures/links-contract.json');
  const U = require('../src/core/url.js');
  const engines = require('../config/engines.json').engines;
  const rows = l => l.map(r => [r.url, r.title, r.at]);
  for (const c of fx.read) {
    if (c.error) { assert.throws(() => L.read(c.in), new RegExp({ newer: 'newer', format: 'not a links file', empty: 'no bookmarks' }[c.error])); continue; }
    const r = L.read(c.in);
    assert.deepEqual(rows(r.bookmarks), c.bookmarks); assert.deepEqual(rows(r.history), c.history);
  }
  for (const c of fx.merge) { const m = L.merge(c.a, c.b); assert.deepEqual(rows(m.bookmarks), c.bookmarks); assert.deepEqual(rows(m.history), c.history); }
  let v = L.empty();
  for (const [u, t, at] of fx.visits.steps) v = L.visit(v, u, t, at);
  assert.deepEqual(rows(v.history), fx.visits.history);
  const o = L.apply(fx.ops.base, fx.ops.ops);
  assert.deepEqual(rows(o.bookmarks), fx.ops.bookmarks); assert.deepEqual(rows(o.history), fx.ops.history);
  assert.equal(L.cleanOps(fx.ops.ops).length, fx.ops.clean);
  for (const [a, b] of fx.strip) assert.equal(U.clean(a).url, b, a);
  for (const [t, kind, url] of fx.address) {
    const c = U.classify(t, { engines, engine: 'google' });
    assert.equal(c.kind, kind, t);
    if (kind === 'url') assert.equal(c.url, url, t);
    if (kind === 'search') assert.equal(U.searchUrl(c.engine, c.q), url, t);
  }
});
