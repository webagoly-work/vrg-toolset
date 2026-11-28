// VRG Stack — tests for S5, the incremental live build: the source map and pipeline.runLayers.
// Run:  node --test test/live.test.js       Uses a throwaway out/ and data/ in the temp folder and stub adapters.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

// a throwaway out/ and data/ BEFORE the pipeline is loaded (lib/events.js fixes its log path at load)
const CFG = require('../config');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'vrg-live-'));
CFG.out = path.join(TMP, 'out'); CFG.data = path.join(TMP, 'data');
const C = require('../lib/common');
const SM = require('../lib/sourcemap');
const P = require('../lib/pipeline');
const H = require('../lib/health');
const { join } = require('../lib/join');

const N = (id, kind, title, own, extra = {}) => ({ id, kind, title, brief: '', own, text: extra.text || title, t: extra.t || '', lane: '', tier: extra.tier || '', state: extra.state || '', extra: extra.extra || {} });
const files = ['docs/visual/README.md', 'docs/visual/DECISIONS.md', 'Planner/a.js'];
const facts = { files, paths: new Set(files), dirs: new Set(['docs', 'docs/visual', 'Planner']), basenames: new Map([['a.js', 'Planner/a.js']]) };
function layersV1() {
  return {
    F: { nodes: [N('F:planner', 'feature', 'Planner wiring', [], { tier: 1 })], edges: [] },
    I: { nodes: [N('I:lens', 'built', 'the stack lens', [])], edges: [] },
    T: { nodes: [], edges: [], built: [] },
    V: { nodes: [], edges: [] },
    W: { nodes: [], edges: [] },
    M: { nodes: [], edges: [] },
    N: { nodes: [], edges: [] },
    D: { nodes: [], edges: [] },
    O: { nodes: [], edges: [] },
    K: { nodes: [], edges: [] },
    P: { nodes: [], edges: [] },
    Q: { nodes: [N('Q:file.v', 'decision file', 'docs/visual/DECISIONS.md', ['p:docs/visual/DECISIONS.md'], { extra: { path: 'docs/visual/DECISIONS.md' } }),
      N('Q:VIS-Q5', 'decision', 'VIS-Q5 Holo', ['q:VIS-Q5'], { state: 'open≈' })], edges: [{ a: 'Q:file.v', b: 'Q:VIS-Q5', rel: 'holds' }] },
    L: { nodes: [N('L:route', 'line', 'Wiring line', [])], edges: [] },
    A: { nodes: [N('A:go.PLANNER', 'codephrase (live)', 'GO PLANNER', ['go:PLANNER'])], edges: [] },
    R: { nodes: [N('R:3f2a9c1', 'commit', 'Planner: a.js', ['c:3f2a9c1'], { t: '2026-11-20', extra: { date: '2026-11-20T10:00:00Z', files: ['Planner/a.js'] } })], edges: [] },
    C: { nodes: [N('C:Planner', 'folder', 'Planner', ['p:Planner'])], edges: [] },
    // the plan mentions VIS-Q5 and a VIS-Q9 that no file has yet, and GO PLANNER
    G: { nodes: [N('G:docs/visual/README.md', 'document', 'Látótér plan', ['p:docs/visual/README.md'], { text: 'See VIS-Q5 and VIS-Q9, then GO PLANNER.' })], edges: [] },
  };
}
const edgeSet = g => new Set(g.edges.map(e => `${e.a}>${e.b}>${e.rel}`));

test('source map: each hand-kept source to its layer; code, our own output and noise to none', () => {
  const S = { notes: 'H:/VRG/Full/notes', repo: 'H:/VRG/Full/Planner_VRG_U100', memory: 'C:/Users/x/.claude/projects/H--/memory' };
  const f = SM.rules(S, ['H:/VRG/Full/Varler_Workflow_Kit/DECISIONS_L1-L18.md']);
  const at = p => f(p.replace(/\\/g, '/').toLowerCase());
  assert.deepEqual(at('H:\\VRG\\Full\\notes\\devlog\\lines.js'), ['L', 'T']);
  assert.deepEqual(at('H:/VRG/Full/notes/devlog/threads.js'), ['E', 'T']);
  assert.deepEqual(at('H:/VRG/Full/notes/devlog/sessions.json'), ['L']);
  assert.deepEqual(at('H:/VRG/Full/Planner_VRG_U100/Stack/ROADMAP.md'), ['T']);
  assert.deepEqual(at('H:/VRG/Full/notes/features/features.json'), ['F']);
  assert.deepEqual(at('H:/VRG/Full/notes/idea-timeline/data.js'), ['I']);
  assert.deepEqual(at('H:/VRG/Full/Planner_VRG_U100/docs/visual/DECISIONS.md'), ['Q']);
  assert.deepEqual(at('H:/VRG/Full/Varler_Workflow_Kit/DECISIONS_L1-L18.md'), ['Q']);
  assert.deepEqual(at('H:/VRG/Full/Planner_VRG_U100/Stack/entities.json'), ['E']);
  assert.deepEqual(at('H:/VRG/Full/Planner_VRG_U100/.claude/agents/arnold.md'), ['A']);
  assert.deepEqual(at('H:/VRG/Full/Planner_VRG_U100/GO-MAIN.md'), ['A']);
  assert.deepEqual(at('C:/Users/x/.claude/projects/H--/memory/feedback_x.md'), ['A']);
  assert.deepEqual(at('H:/VRG/Full/Planner_VRG_U100/launcher/vrg-menu.json'), ['N']);
  assert.deepEqual(at('H:/VRG/Full/Planner_VRG_U100/Stack/data/probes.jsonl'), ['P'], 'a recorded test run');
  assert.deepEqual(at('H:/VRG/Full/Planner_VRG_U100/launcher/vrg-catalog.json'), ['N']);
  assert.deepEqual(at('H:/VRG/Full/Planner_VRG_U100/Mobile/android/kit-core/src/main/kotlin/hu/vrg/mobile/core/Feature.kt'), ['N']);
  for (const p of ['H:/VRG/Full/Planner_VRG_U100/Planner/a.js', 'H:/VRG/Full/Planner_VRG_U100/Stack/out/stack.json', 'H:/VRG/Full/Planner_VRG_U100/Stack/data/events.jsonl',
    'H:/VRG/Full/Planner_VRG_U100/.git/index', 'H:/VRG/Full/Planner_VRG_U100/docs/visual/DECISIONS.md.tmp1234', 'C:/Users/x/.claude/projects/H--/memory/MEMORY.md', 'D:/elsewhere/DECISIONS.md'])
    assert.deepEqual(at(p), [], p);
});

test('incremental: one layer re-run gives exactly the graph a full build gives, new links from cached nodes included', async () => {
  // the full build's part: assemble with analytics, writing stack.json and the layer cache
  const hc = H.collector(), quiet = () => {};
  const full = await P.assemble(layersV1(), facts, null, hc, quiet, { record: false, analytics: true, cache: true });
  assert.ok(fs.existsSync(path.join(CFG.out, 'layers', 'meta.json')) && fs.existsSync(path.join(CFG.out, 'stack.json')));
  assert.ok(!edgeSet(full.graph).has('G:docs/visual/README.md>Q:VIS-Q9>ref:q'), 'VIS-Q9 has no node yet');
  // a hand edit adds VIS-Q9 to the DECISIONS file: only Q runs again
  const realRepoFacts = C.repoFacts;
  C.repoFacts = () => facts;
  const realQ = P.ADAPT.Q;
  P.ADAPT.Q = () => { const q = layersV1().Q; q.nodes.push(N('Q:VIS-Q9', 'decision', 'VIS-Q9 Where the lens lives', ['q:VIS-Q9'], { state: 'open≈' })); q.edges.push({ a: 'Q:file.v', b: 'Q:VIS-Q9', rel: 'holds' }); return q; };
  let r;
  try { r = await P.runLayers(['Q']); } finally { P.ADAPT.Q = realQ; }
  assert.equal(r.kind, 'incremental'); assert.deepEqual(r.layers, ['Q']);
  assert.ok(r.ids.includes('Q:VIS-Q9'), 'the event names the new node: ' + r.ids);
  const inc = JSON.parse(fs.readFileSync(path.join(CFG.out, 'stack.json'), 'utf8'));
  assert.equal(inc.build.kind, 'incremental');
  assert.ok(edgeSet(inc).has('G:docs/visual/README.md>Q:VIS-Q9>ref:q'), 'the cached G node now links the new decision: its refs were kept, not lost');
  // the same layers built from scratch: the same nodes and the same links
  const fresh = layersV1(); fresh.Q.nodes.push(N('Q:VIS-Q9', 'decision', 'VIS-Q9 Where the lens lives', ['q:VIS-Q9'], { state: 'open≈' })); fresh.Q.edges.push({ a: 'Q:file.v', b: 'Q:VIS-Q9', rel: 'holds' });
  const J = join(fresh, facts);
  const scratch = new Set(J.edges.map(e => `${e.a}>${e.b}>${e.rel}`));
  const incEvidence = new Set([...edgeSet(inc)].filter(k => !/>pillar$/.test(k) && !/^J:/.test(k)));   // pillars (E) and signals (J) come after the join
  assert.deepEqual([...incEvidence].sort(), [...scratch].sort(), 'incremental links = a from-scratch join');
  assert.deepEqual(inc.nodes.map(n => n.id).filter(id => id[0] !== 'E' && id[0] !== 'J').sort(), [...J.nodes.keys()].sort(), 'the same nodes (pillars, E, and signals, J, come after the join)');
  // the layer text and the live note
  const box = { window: {} }; require('vm').runInNewContext(fs.readFileSync(path.join(CFG.out, 'layertext', 'index.js'), 'utf8'), box);
  const ix = JSON.parse(JSON.stringify(box.window.LAYERTEXT_INDEX));   // out of the vm's realm
  assert.deepEqual(ix.build.layers, ['Q']); assert.ok(ix.build.ids.includes('Q:VIS-Q9'));
  assert.deepEqual(Object.keys(ix.layers), ['Q'], 'only Q was written');
  assert.deepEqual(fs.readdirSync(path.join(CFG.out, 'layertext')).filter(f => /\.bin$/.test(f)), ['Q.bin']);
  const ev = fs.readFileSync(path.join(CFG.data, 'events.jsonl'), 'utf8');
  assert.ok(/"op":"node\+","id":"Q:VIS-Q9"/.test(ev), 'the event log has the new node');
  C.repoFacts = realRepoFacts;
});

test('incremental: a new file changes the known keys, so it falls back to a full build and writes nothing', async () => {
  const before = fs.readFileSync(path.join(CFG.out, 'stack.json'), 'utf8');
  const more = [...files, 'docs/visual/NEW.md'];
  const realRepoFacts = C.repoFacts;
  C.repoFacts = () => ({ files: more, paths: new Set(more), dirs: facts.dirs, basenames: facts.basenames });
  try {
    const r = await P.runLayers(['I']);
    assert.ok(r.fallback && /known keys changed/.test(r.fallback), JSON.stringify(r));
  } finally { C.repoFacts = realRepoFacts; }
  assert.equal(fs.readFileSync(path.join(CFG.out, 'stack.json'), 'utf8'), before);
  assert.deepEqual(await P.runLayers(['Z', 'U']), { kind: 'none', layers: [], ids: [], ms: 0 }, 'layers with no live source do nothing');
});

test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));
