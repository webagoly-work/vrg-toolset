'use strict';

const assert = require('assert');
const path = require('path');
const { kpLoad } = require('./load');
const { kpMergeRoadmap, kpDecisionCounts } = require('../src/js/57-refresh.js');

const FX = f => require(path.join(__dirname, 'fixtures', f));
const MINI = FX('mini-topology.json');
const SEED = require(path.join(__dirname, '..', 'data', 'topology.json'));
const BASE = 'https://api.github.com/repos/webagoly-work/vrg-toolset';

function memory() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m };
}
const res = (status, body, etag) => ({ status, headers: { get: n => (n === 'etag' ? etag || null : n === 'x-ratelimit-remaining' ? '4900' : null) },
  json: async () => body, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) });

// a GitHub stub: every route answers 200 with an ETag the first time, 304 when that ETag comes back
function github(routes) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push(url);
    const key = Object.keys(routes).find(k => url.startsWith(BASE + k));
    if (!key) return res(404, { message: 'Not Found' });
    const etag = 'W/"' + key + '"';
    if (init.headers['If-None-Match'] === etag) return res(304, null, etag);
    return res(200, routes[key], etag);
  };
  return { fetch, calls };
}
function page(routes, ls) {
  const g = github(routes);
  const m = kpLoad(['00-core.js', '10-model.js', '50-github.js', '60-access.js', '57-refresh.js'],
    { localStorage: ls || memory(), fetch: g.fetch, crypto: globalThis.crypto, atob, TextEncoder });
  m.kpGh.token = 'ghp_' + 'x'.repeat(36);
  return Object.assign(m, { calls: g.calls });
}
const routesFor = topo => ({
  '/contents/Hub/data/topology.json': JSON.stringify(topo),
  '/contents/Hub/data/access.json': JSON.stringify({ schema: 'vrg-hub-access/1', body: { people: [] } }),
  '/commits?sha=main&per_page=8&path=Planner': FX('commits-planner.json'),
  '/commits?sha=main&per_page=8&path=MindMap': [],
  '/commits?sha=main&per_page=8&path=Inventory': [],
  '/branches': [{ name: 'main', commit: { sha: 'm1' } }],
  '/git/trees/main': FX('tree.json'),
  '/contents/Hub/dist/vrg-kapu.html': 'const KP_BUILD = "aaaaaaaaaaaa";'
});

module.exports = [
  { name: 'roadmap merge: seed A + commits B, A -> 2 rows, B first', fn() {
    const r = kpMergeRoadmap([{ date: '2026-10-18', t: 'A' }], [{ date: '2026-10-20', t: 'B' }, { date: '2026-10-18', t: 'A' }]);
    assert.deepStrictEqual(r.map(x => x.t), ['B', 'A']);
  } },
  { name: 'decision files: longest git prefix wins', fn() {
    const c = kpDecisionCounts(SEED, FX('tree.json').tree.map(x => x.path));
    assert.strictEqual(c.planner, 4);
    assert.strictEqual(c['media-wall'], 1);
    assert.strictEqual(c.bridge, 0);
    assert.strictEqual(c.mindmap, 0);
  } },
  { name: 'invalid remote topology (duplicate id) -> old one kept, status says so', async fn() {
    const bad = JSON.parse(JSON.stringify(MINI));
    bad.programs.push(Object.assign({}, bad.programs[0]));
    const m = page(routesFor(bad));
    const r = await m.kpRefreshCore(MINI, null, null);
    assert.strictEqual(r.topology, MINI);
    assert.ok(r.status.some(([l, t]) => l === 'Topológia' && t === 'hibás, a régit mutatom'), JSON.stringify(r.status));
  } },
  { name: 'commits merge into the live roadmap, newest first, seed text shown once', async fn() {
    const m = page(routesFor(MINI));
    const r = await m.kpRefreshCore(MINI, null, null);
    const merged = m.kpApplyLive(MINI, r.live).programs.find(p => p.id === 'planner').roadmap;
    assert.strictEqual(merged[0].t, 'Planner round 2026-10-20: B');
    assert.strictEqual(merged.filter(x => x.t === 'Vezetékcsatorna T0–T6; kör utómunka').length, 1);
    assert.strictEqual(merged.length, 7);
    assert.strictEqual(r.live.decisions.planner, 4);
  } },
  { name: 'second refresh: 3 of 3 commit calls are 304 cache hits, roadmap unchanged, "minden friss"', async fn() {
    const ls = memory();
    const first = await page(routesFor(MINI), ls).kpRefreshCore(MINI, null, null);
    const m = page(routesFor(MINI), ls);
    const second = await m.kpRefreshCore(MINI, null, null);
    const commitCalls = m.calls.filter(u => u.includes('/commits?'));
    assert.strictEqual(commitCalls.length, 3);
    assert.strictEqual(JSON.stringify(second.live.roadmap), JSON.stringify(first.live.roadmap));   // two vm realms
    assert.strictEqual(second.stats.fresh, 0);
    assert.strictEqual(second.stats.hits, 3 + 5);   // 3 commit lists + topology, access, branches, tree, self
    assert.ok(second.stats.requests <= 40);
    assert.ok(/^minden friss/.test(second.status[second.status.length - 1][1]));
  } }
];
