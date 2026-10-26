'use strict';

const assert = require('assert');
const { kpLoad } = require('./load');

const TOKEN = 'ghp_' + 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8';   // 36 chars after the prefix, fake
const REPO = { owner: 'webagoly-work', name: 'vrg-toolset' };

function memory() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m };
}
function res(status, json, headers) {
  const h = Object.assign({ 'x-ratelimit-remaining': '4999' }, headers || {});
  return { status, headers: { get: n => (n.toLowerCase() in h ? h[n.toLowerCase()] : null) }, json: async () => json, text: async () => JSON.stringify(json) };
}
// fetch stub answering by URL path; records every call
function stub(routes) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, headers: init.headers });
    const p = url.replace('https://api.github.com', '');
    const r = routes[p];
    if (!r) return res(404, { message: 'Not Found' });
    return typeof r === 'function' ? r(init) : r;
  };
  return { fetch, calls };
}
function load(routes) {
  const ls = memory(), logs = [];
  const spy = { log: (...a) => logs.push(a.join(' ')), error: (...a) => logs.push(a.join(' ')), warn: (...a) => logs.push(a.join(' ')), info: (...a) => logs.push(a.join(' ')) };
  const s = stub(routes);
  const m = kpLoad(['00-core.js', '50-github.js'], { localStorage: ls, fetch: s.fetch, console: spy });
  return Object.assign(m, { ls, logs, calls: s.calls });
}

module.exports = [
  { name: 'token shape: ghp_ + 36 ok, github_pat_ ok, abc rejected', fn() {
    const { kpGhTokenOk } = load({});
    assert.ok(kpGhTokenOk(TOKEN));
    assert.ok(kpGhTokenOk('github_pat_11ABCDEFG0123456789_abcdefghijklmnopqrstuvwxyz'));
    assert.ok(!kpGhTokenOk('abc'));
    assert.ok(!kpGhTokenOk('ghp_short'));
  } },
  { name: 'user 200 + repo push:true -> write; headers right; token stored', async fn() {
    const m = load({ '/user': res(200, { login: 'x', name: 'X' }), '/repos/webagoly-work/vrg-toolset': res(200, { permissions: { push: true } }) });
    const r = await m.kpGhSetToken(TOKEN, REPO);
    assert.strictEqual(r.ok, true);
    assert.strictEqual(m.kpGh.login, 'x');
    assert.strictEqual(m.kpGh.access, 'write');
    const h = m.calls[0].headers;
    assert.strictEqual(h.Authorization, 'Bearer ' + TOKEN);
    assert.strictEqual(h.Accept, 'application/vnd.github+json');
    assert.strictEqual(h['X-GitHub-Api-Version'], '2022-11-28');
    assert.strictEqual(JSON.parse(m.ls.m.get('vrgKapu.ghToken')), TOKEN);
  } },
  { name: 'repo 404 -> access none', async fn() {
    const m = load({ '/user': res(200, { login: 'x' }) });
    await m.kpGhSetToken(TOKEN, REPO);
    assert.strictEqual(m.kpGh.access, 'none');
  } },
  { name: 'user 401 -> token cleared, Hungarian reason', async fn() {
    const m = load({ '/user': res(401, { message: 'Bad credentials' }) });
    const r = await m.kpGhSetToken(TOKEN, REPO);
    assert.strictEqual(r.ok, false);
    assert.strictEqual(m.kpGh.token, null);
    assert.strictEqual(m.kpGh.error, 'A token lejárt vagy hibás');
    assert.strictEqual(JSON.parse(m.ls.m.get('vrgKapu.ghToken')), null);
  } },
  { name: 'ETag: the second call sends If-None-Match; 304 served from cache', async fn() {
    let n = 0;
    const m = load({ '/repos/webagoly-work/vrg-toolset/commits': init => (++n === 1 ? res(200, [{ sha: 'a' }], { etag: 'W/"e1"' }) : res(304, null, { etag: 'W/"e1"' })) });
    m.kpGh.token = TOKEN;
    const a = await m.kpGhFetch('/repos/webagoly-work/vrg-toolset/commits');
    const b = await m.kpGhFetch('/repos/webagoly-work/vrg-toolset/commits');
    assert.strictEqual(m.calls[0].headers['If-None-Match'], undefined);
    assert.strictEqual(m.calls[1].headers['If-None-Match'], 'W/"e1"');
    assert.strictEqual(b.status, 304);
    assert.deepStrictEqual(b.json, a.json);
  } },
  { name: 'the token never reaches console or an error text', async fn() {
    const m = load({ '/user': () => { throw new Error('network down'); } });
    const r = await m.kpGhSetToken(TOKEN, REPO);
    assert.ok(!JSON.stringify(r).includes(TOKEN));
    assert.ok(!String(m.kpGh.error).includes(TOKEN));
    assert.ok(!m.logs.some(l => l.includes(TOKEN)));
    const bad = await m.kpGhSetToken('nope ' + TOKEN, REPO);
    assert.ok(!bad.error.includes(TOKEN));
  } }
];
