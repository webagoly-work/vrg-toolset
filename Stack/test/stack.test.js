// VRG Stack — tests. Run:  H:\VRG\Full\tools\node\node.exe --test test/
// Small known inputs with known answers, so a change to a parser or an algorithm cannot quietly
// drop links, steps or communities. No test touches a real source or out/.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const G = require('../lib/graph');
const M = require('../lib/metrics');
const { louvain } = require('../lib/louvain');
const P = require('../lib/patterns');
const A = require('../lib/activation');
const S = require('../lib/search');
const X = require('../lib/fsx');
const EV = require('../lib/events');
const REC = require('../lib/record');
const SH = require('../schema/shapes');
const LK = require('../schema/links');
const EN = require('../lib/enrich');
const C = require('../lib/common');

const node = (id, t = '') => ({ id, layer: id[0], kind: 'x', title: id, own: [], t });
const undOf = (ids, pairs) => G.index(ids.map(i => node(i)), pairs.map(([a, b]) => ({ a, b, rel: 'part', v: 0 }))).undirected();

test('metrics: a triangle is fully clustered, a path is not', () => {
  assert.equal(M.clustering(undOf(['F:a', 'F:b', 'F:c'], [['F:a', 'F:b'], ['F:b', 'F:c'], ['F:a', 'F:c']])), 1);
  assert.equal(M.clustering(undOf(['F:a', 'F:b', 'F:c'], [['F:a', 'F:b'], ['F:b', 'F:c']])), 0);
  const ps = M.pathStats(undOf(['F:a', 'F:b', 'F:c'], [['F:a', 'F:b'], ['F:b', 'F:c']]));
  assert.equal(ps.longest, 2);
});

test('louvain: two cliques joined by one link become two communities', () => {
  const L1 = ['F:a', 'F:b', 'F:c', 'F:d'], L2 = ['F:e', 'F:f', 'F:g', 'F:h'];
  const pairs = [];
  for (const g of [L1, L2]) for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) pairs.push([g[i], g[j]]);
  pairs.push(['F:d', 'F:e']);
  const und = undOf([...L1, ...L2], pairs);
  const com = louvain(und);
  assert.equal(new Set(L1.map(x => com.get(x))).size, 1);
  assert.equal(new Set(L2.map(x => com.get(x))).size, 1);
  assert.notEqual(com.get('F:a'), com.get('F:h'));
  assert.ok(M.modularity(und, id => com.get(id)) > 0.3);
});

test('pagerank: the centre of a star ranks highest', () => {
  const pr = M.pagerank(undOf(['F:c', 'F:1', 'F:2', 'F:3'], [['F:c', 'F:1'], ['F:c', 'F:2'], ['F:c', 'F:3']]));
  assert.ok(pr.get('F:c') > pr.get('F:1'));
});

test('path: time-respecting chains do not go back in time', () => {
  const ns = [node('L:a', '2026-11-01'), node('L:b', '2026-10-01'), node('L:c', '2026-11-03'), node('L:d', '2026-11-02')];
  const es = [['L:a', 'L:b'], ['L:b', 'L:c'], ['L:a', 'L:d'], ['L:d', 'L:c']].map(([a, b]) => ({ a, b, rel: 'next', v: 0 }));
  const g = G.index(ns, es);
  assert.equal(G.shortest(g, 'L:a', 'L:c').length, 3);
  assert.deepEqual(G.shortest(g, 'L:a', 'L:c', { time: true }).map(x => x.id), ['L:a', 'L:d', 'L:c']);
});

test('patterns: directly-follows counts and PrefixSpan support', () => {
  const seqs = [['Read', 'Edit', 'Bash'], ['Read', 'Edit'], ['Grep', 'Read', 'Edit', 'Bash']];
  const d = P.dfg(seqs);
  assert.deepEqual(d.pairs[0], ['Read → Edit', 3]);
  const ps = P.prefixSpan(seqs, 2, 3);
  const re = ps.find(p => p.seq.join('>') === 'Read>Edit>Bash');
  assert.ok(re && re.support === 2);
  assert.deepEqual(P.collapse(['a', 'a', 'b', 'b', 'a']), ['a', 'b', 'a']);
});

test('activation: energy spreads, hubs pass on less, fade dims', () => {
  const adj = { s: ['h', 'x'], h: ['s', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'i'], x: ['s', 'y'] };
  const e = A.spread(id => adj[id], new Map([['s', 1]]), { decay: 0.5, hops: 2, hubPenalty: 0.5, threshold: 0.001 });
  assert.ok(e.get('h') > 0 && e.get('y') > 0);
  assert.ok(e.get('y') > e.get('a'), 'the hub spreads thinner than the plain node');
  assert.ok(A.fade(new Map([['s', 1]]), 0.5).get('s') === 0.5);
});

test('search: reciprocal rank fusion favours agreement, routing reads cues', () => {
  assert.deepEqual(S.rrf([['a', 'b', 'c'], ['b', 'a', 'd'], ['b']]).slice(0, 2), ['b', 'a']);
  assert.ok(S.route('melyik commit vitte fel a 5ee8b1e-t').has('R'));
  assert.ok(S.route('nyitott döntések a Kapuban').has('Q'));
  assert.equal(S.route('árnyék').size, 0);
});

test('extractor: absolute H: and C: paths are matched (v1 missed them)', () => {
  const known = { paths: new Set(['H:/VRG/Full/notes/stack/README.md']), dirs: new Set(['H:/VRG/Full/notes/stack', 'H:/VRG/Full/notes']), basenames: new Map(),
    commits: new Set(), sessions: new Set(), memories: new Set() };
  const ex = C.makeExtractor(known);
  assert.ok(ex('see H:\\VRG\\Full\\notes\\stack\\README.md now').has('p:H:/VRG/Full/notes/stack/README.md'));
  assert.ok(ex('cd H:/VRG/Full/notes/stack && ls').has('p:H:/VRG/Full/notes/stack'));
});

test('recorder: a transcript becomes steps with tools, results, tokens; torn lines skipped', () => {
  const { steps, meta } = REC.parseFile(path.join(__dirname, 'fixtures', 'session.jsonl'), 'agent');
  assert.equal(meta.title, 'Fixture session');
  assert.deepEqual(steps.map(s => s.span), ['prompt', 'chat', 'execute_tool', 'execute_tool', 'execute_tool', 'chat']);
  const edit = steps.find(s => s.tool === 'Edit');
  assert.equal(edit.ok, false);
  assert.deepEqual(edit.paths, ['H:/VRG/Full/notes/stack/lib/join.js']);
  assert.equal(steps.find(s => s.tool === 'Read').paths[0], 'H:/VRG/Full/notes/stack/README.md');
  assert.equal(steps[1].tok.cr, 100); // usage goes on the first step of its message, once
  assert.ok(!steps.some(s => /skip me/.test(s.text || '')));
});

test('recorder: a git commit step owns the commit made right after it', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stk-'));
  const file = path.join(dir, 'aaaaaaaa-0000-0000-0000-000000000000.jsonl');
  fs.copyFileSync(path.join(__dirname, 'fixtures', 'session.jsonl'), file);
  const t = { sid: 'aaaaaaaa-0000-0000-0000-000000000000', project: 'H--', file, subs: [] };
  const commits = [{ h: 'abc1234', ms: Date.parse('2026-11-05T10:00:40Z'), subject: 'fix' }];
  const { steps, summary } = REC.recordSession(t, { resolve: p => p.length ? ['C:x'] : [], commits });
  const c = steps.find(s => s.span === 'commit');
  assert.deepEqual(c.nodes, ['R:abc1234']);
  assert.deepEqual(summary.commits, ['R:abc1234']);
  for (const s of steps) assert.deepEqual(SH.checkStep(s), [], JSON.stringify(s));
  assert.equal(summary.tokens.out, 22);
});

test('events: a diff lists added, removed, changed nodes and links', () => {
  const a = { nodes: [{ id: 'F:a', layer: 'F', state: 'x' }, { id: 'F:b', layer: 'F' }], edges: [{ a: 'F:a', b: 'F:b', rel: 'part', v: 0 }] };
  const b = { nodes: [{ id: 'F:a', layer: 'F', state: 'y' }, { id: 'F:c', layer: 'F', t: '2026-11-01' }], edges: [{ a: 'F:a', b: 'F:c', rel: 'part', v: 0 }] };
  const ev = EV.diff(a, b, '2026-11-06T00:00:00Z');
  const ops = ev.map(e => e.op + ' ' + e.id).sort();
  assert.deepEqual(ops, ['edge+ F:a', 'edge- F:a', 'node+ F:c', 'node- F:b', 'state F:a']);
  assert.equal(ev.find(e => e.op === 'node+').valid, '2026-11-01');
  for (const e of ev) assert.deepEqual(SH.checkEvent(e), []);
});

test('fsx: a torn last line is repaired, the cut part kept', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stk-'));
  const f = path.join(dir, 'log.jsonl');
  fs.writeFileSync(f, '{"a":1}\n{"a":2}\n{"a":');
  assert.equal(X.readJsonl(f).bad.length, 1);
  assert.equal(X.repairJsonl(f).repaired, true);
  assert.equal(X.readJsonl(f).records.length, 2);
  assert.ok(fs.readFileSync(f + '.torn', 'utf8').includes('{"a":'));
  fs.writeFileSync(f, '{"a":1}\nbroken\n{"a":3}\n');
  assert.equal(X.repairJsonl(f).repaired, false, 'a bad line in the middle is left for a person');
});

test('fsx: one build at a time; a stale lock is taken over', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stk-'));
  fs.writeFileSync(path.join(dir, '.lock'), '1');
  assert.throws(() => X.withLock(dir, 10, () => 1), /another build/);
  const old = new Date(Date.now() - 20 * 60000); fs.utimesSync(path.join(dir, '.lock'), old, old);
  assert.equal(X.withLock(dir, 10, () => 7), 7);
  assert.ok(!fs.existsSync(path.join(dir, '.lock')));
});

test('schema: nodes are checked, every relation in use has verbs', () => {
  assert.deepEqual(SH.checkNode(node('F:a', '2026-11-01')), []);
  assert.ok(SH.checkNode({ id: 'bad', layer: 'F', kind: 'x', title: '', own: [] }).length);
  for (const r of ['part', 'fork?', 'ref:p', 'touched', 'pillar', 'same', 'alike']) assert.ok(LK.rel(r), r);
  assert.equal(LK.rel('fork?').inferred, true);
  assert.equal(LK.sentence('Planner', 'launch', 'START'), 'Planner — indítja → START');
});

test('enrich: PARA and actor come from states', () => {
  const today = '2026-11-06';
  assert.equal(EN.para({ layer: 'L', kind: 'line', state: 'active' }, today), 'P');
  assert.equal(EN.para({ layer: 'L', kind: 'line', state: 'parked' }, today), 'X');
  assert.equal(EN.para({ layer: 'F', tier: 1 }, today), 'A');
  assert.equal(EN.para({ layer: 'G', kind: 'document' }, today), 'R');
  assert.equal(EN.actor({ layer: 'A', kind: 'agent tool' }), 'script');
  assert.equal(EN.actor({ layer: 'U', kind: 'run' }), 'agent');
});

test('mcp: initialize, list, call and an unknown method', async () => {
  const { handle } = require('../mcp/server');
  const Q = { ask: async q => 'hits for ' + q, node: async id => 'card ' + id, report: () => 'r' };
  const init = await handle({ id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } }, Q);
  assert.equal(init.serverInfo.name, 'vrg-stack');
  assert.ok((await handle({ id: 2, method: 'tools/list' }, Q)).tools.some(t => t.name === 'stack_search'));
  const r = await handle({ id: 3, method: 'tools/call', params: { name: 'stack_search', arguments: { query: 'kapu' } } }, Q);
  assert.equal(r.content[0].text, 'hits for kapu');
  assert.equal(await handle({ method: 'notifications/initialized' }, Q), undefined);
  await assert.rejects(handle({ id: 4, method: 'nope' }, Q), /method not found/);
});

test('connectome: 2 KB unit, shells, a decisions file shared, firing from a recording', () => {
  const CN = require('../lib/connectome');
  assert.equal(CN.neurons(1), 1); assert.equal(CN.neurons(2048), 1); assert.equal(CN.neurons(2049), 2); assert.equal(CN.neurons(1e9), CN.CAP);
  assert.equal(CN.shellOf({ layer: 'G', kind: 'document' }), 'cortex');
  assert.equal(CN.shellOf({ layer: 'A', kind: 'memory/memory' }), 'cortex');
  assert.equal(CN.shellOf({ layer: 'A', kind: 'agent' }), 'stem');
  assert.equal(CN.shellOf({ layer: 'L', kind: 'line' }), 'mid');
  assert.equal(CN.shellOf({ layer: 'L', kind: 'session' }), 'stem');
  assert.equal(CN.shellOf({ layer: 'U', kind: 'run' }), 'stem');
  // brain parts by function (BR-Q1)
  assert.equal(CN.regionOf({ layer: 'C', kind: 'folder' }), 'ctx-par');
  assert.equal(CN.regionOf({ layer: 'A', kind: 'agent' }), 'cereb');
  assert.equal(CN.regionOf({ layer: 'L', kind: 'line' }), 'thal');
  assert.equal(CN.regionOf({ layer: 'L', kind: 'session' }), 'ic');
  assert.equal(CN.regionOf({ layer: 'G', kind: 'signal/dark' }), 'sc');
  assert.equal(CN.regionOf({ layer: 'Q', kind: 'decision' }), 'hypo');
  assert.equal(CN.regionOf({ layer: 'U', kind: 'run' }), 'pons');
  assert.equal(CN.regionOf({ layer: 'R', kind: 'commit' }), 'medulla');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cn-'));
  fs.writeFileSync(path.join(dir, 'D.md'), 'x'.repeat(6000));
  fs.mkdirSync(path.join(dir, 'rec'));
  fs.writeFileSync(path.join(dir, 'rec', 'abcd1234.jsonl'), JSON.stringify({ t: '2026-11-07T08:00:00Z', nodes: ['Q:a'] }) + '\n');
  fs.writeFileSync(path.join(dir, 'ev.jsonl'), '{"op":"build","seen":"x"}\n{"op":"node+","id":"Q:a"}\n');
  const graph = { generated: 'g', layers: [], nodes: [
    { id: 'Q:file', layer: 'Q', kind: 'decision-file', path: 'D.md', own: [] },
    { id: 'Q:a', layer: 'Q', kind: 'decision', path: 'D.md', own: [] },
    { id: 'Q:b', layer: 'Q', kind: 'decision', path: 'D.md', own: [] },
    { id: 'U:run.abcd1234', layer: 'U', kind: 'run', own: [] },
  ], edges: [{ a: 'U:run.abcd1234', b: 'Q:a', v: 1 }] };
  const d = CN.build({ graph, recordingsDir: path.join(dir, 'rec'), eventsFile: path.join(dir, 'ev.jsonl'), roots: [dir] });
  assert.deepEqual(d.nodes.slice(0, 3).map(n => n[5]), [2000, 2000, 2000]);
  assert.equal(d.fire.length, 1); assert.deepEqual(d.fire[0].steps[0][1], [1]);
  assert.deepEqual(d.fresh, [[1, 1]]);
  assert.deepEqual(d.edges, [3, 1, 1]);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('connectome pathways: a node goes to the DevLog line it is closest to', () => {
  const CN = require('../lib/connectome');
  const nodes = [
    { id: 'L:a', layer: 'L', kind: 'line' }, { id: 'L:b', layer: 'L', kind: 'line' },
    { id: 'L:s1', layer: 'L', kind: 'session' }, { id: 'U:run.1', layer: 'U', kind: 'run' },
    { id: 'C:x', layer: 'C', kind: 'folder' }, { id: 'G:y', layer: 'G', kind: 'document' }, { id: 'G:z', layer: 'G', kind: 'document' },
  ];
  const idx = new Map(nodes.map((n, i) => [n.id, i]));
  const edges = [
    { a: 'L:s1', b: 'L:a', rel: 'on-line' }, { a: 'U:run.1', b: 'L:s1', rel: 'ran' },
    { a: 'U:run.1', b: 'C:x', rel: 'touched' },        // C:x → a (1)
    { a: 'L:b', b: 'G:y', rel: 'alike' },               // G:y → b (4)
    { a: 'L:a', b: 'L:b', rel: 'fork' },
  ];
  const p = CN.pathways({ nodes, edges }, idx);
  assert.deepEqual(p.lines.map(l => l.id), ['L:a', 'L:b']);
  assert.equal(p.primary[idx.get('L:a')], 0); assert.equal(p.primary[idx.get('L:s1')], 0);
  assert.equal(p.primary[idx.get('U:run.1')], 0); assert.equal(p.primary[idx.get('C:x')], 0);
  assert.equal(p.primary[idx.get('G:y')], 1); assert.equal(p.primary[idx.get('G:z')], -1);
  assert.deepEqual(p.links, [[0, 1, 'fork']]);
});

test('neuron addresses: gate + family + run, unique, stable, roles from facts', () => {
  const N = require('../neurons.js');
  const files = [
    { id: 'C:big.js', n: 210, kind: 'code', layer: 'C', line: 0, line2: 3, degree: 2, last: 0 },   // 420 KB, on two lines → fork
    { id: 'Q:x', n: 7, kind: 'decision', layer: 'Q', line: 1, line2: -1, degree: 1, last: 0, lineState: 'waiting' },   // 14 KB, waiting → gate
    { id: 'A:mem', n: 5, kind: 'memory/project', layer: 'A', line: -1, line2: -1, degree: 1, last: 0 },   // 10 KB: no neuron
  ];
  const a = N.build(files, 2048, 1e12), b = N.build(files, 2048, 1e12);
  assert.deepEqual(a.map(x => x.addr), b.map(x => x.addr));                       // stable
  assert.ok(a.every(x => /^[a-z][0-9a-hjkmnp-tv-z]{5}$/.test(x.addr)));           // 6 chars, Crockford, gate first
  assert.equal(new Set(a.map(x => x.root)).size, a.length);                       // unique
  const big = a.filter(x => x.file === 'C:big.js'), q = a.filter(x => x.file === 'Q:x');
  assert.ok(big.every(x => x.root.slice(0, 2) === N.familyOf('C:big.js')));       // one family per file
  assert.equal(big.filter(x => x.kb === 400).length, 1);
  assert.equal(big.find(x => x.kb === 400).gate, 'f');                            // the head carries the role
  assert.equal(q.length, 1); assert.equal(q[0].gate, 'g');
  assert.equal(a.filter(x => x.file === 'A:mem').length, 0);
  assert.equal(N.find(a, q[0].addr), q[0]);
});
