// VRG Stack — K · Kérések (lib/asks.js, S13). Run:  node --test test/asks.test.js
// The asks out of recordings (harness text left out), what each led to, the clusters, the layer, DRIFT §13's list.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const K = require('../lib/asks');

const step = (seq, t, span, actor, extra = {}) => ({ seq, t: `2026-11-${t}:00.000Z`, span, actor, nodes: [], ...extra });
const REC = {
  aaaaaaaa: [
    step(0, '20T10:00', 'prompt', 'user', { text: 'build S12, the next new layer' }),
    step(1, '20T10:01', 'execute_tool', 'agent', { tool: 'Edit', nodes: ['C:Stack/lib', 'G:Stack/README.md'] }),
    step(2, '20T10:02', 'execute_tool', 'agent', { tool: 'Edit', nodes: ['C:Stack/lib'] }),
    step(3, '20T10:03', 'commit', 'agent', { nodes: ['R:abc1234'] }),
    step(4, '20T10:04', 'prompt', 'user', { text: 'This session is being continued from a previous conversation …' }),
    step(5, '20T10:05', 'prompt', 'user', { text: '[Request interrupted by user]' }),
    step(6, '20T10:06', 'prompt', 'user', { text: 'leave it, it\'s fine' }),
    step(7, '20T10:07', 'execute_tool', 'user', { tool: 'command', text: 'sk:code-review /code-review high' }),
    step(8, '20T10:08', 'execute_tool', 'agent', { tool: 'Read', nodes: ['C:Planner'] }),
  ],
  bbbbbbbb: [
    step(0, '25T09:00', 'prompt', 'user', { text: 'build S13, the next new layer' }),
    step(1, '25T09:01', 'execute_tool', 'agent', { tool: 'Edit', nodes: ['C:Stack/lib'] }),
    step(2, '25T09:05', 'prompt', 'user', { text: 'Fix the wireway router for the Topology View, see GO-ROUTE.md' }),
    step(3, '25T09:06', 'execute_tool', 'agent', { tool: 'Read', nodes: ['C:Stack/lib'] }),
  ],
  cccccccc: [
    step(0, '26T08:00', 'prompt', 'user', { text: 'fix the wireway router in the topology view again' }),
  ],
};
const index = { aaaaaaaa: { sid: 'aaaaaaaa-1', title: 'Stack S12', start: '2026-11-20T10:00:00Z', commits: ['R:abc1234'] },
  bbbbbbbb: { sid: 'bbbbbbbb-2', title: 'Stack S13', start: '2026-11-25T09:00:00Z', commits: [] },
  cccccccc: { sid: 'cccccccc-3', title: 'Router', start: '2026-11-26T08:00:00Z', commits: [] } };
const sessions = K.collect(index, sid8 => REC[sid8]);

test('collect: the user\'s prompts and slash commands, harness text left out; what each led to until the next ask', () => {
  const a = sessions.find(s => s.sid8 === 'aaaaaaaa').asks;
  assert.deepEqual(a.map(x => [x.seq, x.kind]), [[0, 'ask'], [6, 'ask'], [7, 'command']], 'the summary and the interruption are not asks');
  assert.equal(a[0].commits, 1);
  assert.deepEqual(a[0].touched, [['C:Stack/lib', 2], ['G:Stack/README.md', 1], ['R:abc1234', 1]], 'what its steps touched, most first');
  assert.deepEqual(a[1].touched, [], 'an ask straight after another led to nothing yet');
  assert.equal(a[2].text, '/code-review high'); assert.deepEqual(a[2].touched, [['C:Planner', 1]]);
  assert.deepEqual(sessions.map(s => s.sid8), ['aaaaaaaa', 'bbbbbbbb', 'cccccccc'], 'in time order');
});

test('cluster: the same ask about the next number, and the same ask in other words, cluster; unlike asks do not', () => {
  const asks = sessions.flatMap(s => s.asks.map(a => ({ ...a, id: `K:ask.${s.sid8}.${a.seq}` })));
  const C = K.cluster(asks);
  const of = id => C.of.get(id);
  assert.ok(of('K:ask.aaaaaaaa.0') && of('K:ask.aaaaaaaa.0') === of('K:ask.bbbbbbbb.0'), 'S12 ≈ S13');
  assert.ok(of('K:ask.bbbbbbbb.2') && of('K:ask.bbbbbbbb.2') === of('K:ask.cccccccc.0'), 'the router ask, twice');
  assert.notEqual(of('K:ask.aaaaaaaa.0'), of('K:ask.cccccccc.0'));
  assert.equal(of('K:ask.aaaaaaaa.6'), undefined, 'a single ask has no cluster');
  assert.deepEqual([...K.words('Kérlek építsd meg a Füzértáblát')], ['epitsd', 'fuzertablat'], 'accents folded, Hungarian stopwords out');
});

test('layer: ask and cluster nodes, asked-in / led-to / mentions / contains; nothing-landed lists the open repeated ask', () => {
  const has = id => /^(U:run\.|C:|G:|R:|A:go\.)/.test(id);
  const L = K.layer({ sessions, resolve: t => (/GO-ROUTE\.md/.test(t) ? ['A:go.ROUTE', 'C:Stack/lib'] : []), has });
  const n = id => L.nodes.find(x => x.id === id), e = (a, rel) => L.edges.filter(x => x.a === a && x.rel === rel).map(x => x.b);
  assert.equal(n('K:ask.aaaaaaaa.0').state, 'committed'); assert.equal(n('K:ask.bbbbbbbb.0').state, 'no commit');
  assert.equal(n('K:ask.aaaaaaaa.7').kind, 'command');
  assert.deepEqual(e('K:ask.aaaaaaaa.0', 'asked-in'), ['U:run.aaaaaaaa']);
  assert.deepEqual(e('K:ask.aaaaaaaa.0', 'led-to'), ['C:Stack/lib', 'G:Stack/README.md', 'R:abc1234']);
  assert.deepEqual(e('K:ask.bbbbbbbb.2', 'mentions'), ['A:go.ROUTE'], 'what the text names; a node it also led to is not said twice');
  const clusters = L.nodes.filter(x => x.kind === 'cluster');
  assert.equal(clusters.length, 2);
  const layerC = clusters.find(c => e(c.id, 'contains').includes('K:ask.aaaaaaaa.0'));
  assert.equal(layerC.state, 'landed'); assert.match(layerC.title, /layer/); assert.match(layerC.title, /×2$/);
  const router = clusters.find(c => c !== layerC);
  assert.equal(router.state, 'open'); assert.equal(router.extra.sessions, 2);
  assert.deepEqual(K.nothingLanded({ nodes: L.nodes }).map(c => c.id), [router.id]);
  assert.ok(L.nodes.every(x => x.layer === 'K') && new Set(L.nodes.map(x => x.id)).size === L.nodes.length);
  const again = K.layer({ sessions, resolve: () => [], has });
  assert.deepEqual(again.nodes.filter(x => x.kind === 'cluster').map(x => x.id).sort(), clusters.map(x => x.id).sort(), 'cluster ids are stable between builds');
});

test('privacy: the connectome data (the phone bundle) never carries an ask\'s words', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'connectome.js'), 'utf8');
  assert.match(src, /n\.layer === 'K' \? `\$\{n\.kind\} \$\{n\.t \|\| ''\}`\.trim\(\)/);
});
