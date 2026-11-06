// WP-22: context packs — id validation, expand layer filter, pack file under packs\, note inside the budget, clusters, send to Claude.
// execFile is a fake that answers like stack-json.js; VRG_DESK_HOME is a temp dir under %TEMP%\VRG\desk-test-*.
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path');

const base = path.join(os.tmpdir(), 'VRG');
fs.mkdirSync(base, { recursive: true });
const HOME = fs.mkdtempSync(path.join(base, 'desk-test-'));
process.env.VRG_DESK_HOME = HOME;
test.after(() => { fs.rmSync(HOME, { recursive: true, force: true }); });

const paths = require('../shell/lib/paths.js');
const { createCtx, validId } = require('../shell/lib/ctx.js');

const NODES = [
  { id: 'E:demo', layer: 'E', title: 'Demo pillar', state: '3 nodes', t: '' },
  { id: 'F:f1', layer: 'F', title: 'Demo feature', state: '', t: '2026-01-01' },
  { id: 'L:l1', layer: 'L', title: 'Demo line', state: '', t: '' },
  { id: 'A:a1', layer: 'A', title: 'Demo area', state: '', t: '' },
];
const EDGES = [{ a: 'E:demo', b: 'F:f1', rel: 'pillar' }, { a: 'E:demo', b: 'L:l1', rel: 'pillar' }, { a: 'F:f1', b: 'A:a1', rel: 'uses' }];

function fakeExec(handler) {
  const calls = [];
  const execFile = (file, args, opts, cb) => {
    calls.push({ file, args, opts });
    const r = (handler && handler(args)) || {};
    setImmediate(() => cb(r.err || null, r.stdout || '', ''));
  };
  return { execFile, calls };
}
const stackAnswer = args => {
  const i = args.indexOf('expand') >= 0 ? args.indexOf('expand') : args.indexOf('pack');
  const cmd = args[i];
  if (cmd === 'expand') return { stdout: JSON.stringify({ nodes: NODES, edges: EDGES, tokens: 99 }) + '\n' };
  const budget = args[args.indexOf('--budget') + 1];
  return { stdout: `# VRG context pack · 2026-01-01 · ${args[i + 1].split(',').length} nodes\n## E:demo Demo pillar\n(budget ${budget}, used 30, 0 nodes left out)\n` };
};
const mk = (extra = {}, handler = stackAnswer) => {
  const f = fakeExec(handler);
  const opened = [];
  const claudeterm = { open: o => { opened.push(o); return { term: 't1', title: 'Claude', prof: 'claude-' + o.account.toLowerCase(), account: o.account }; } };
  const ctx = createCtx({ execFile: f.execFile, node: 'NODE', stackDir: 'STACKDIR', paths, claudeterm, repo: path.join(HOME, 'repo'), stackJs: 'STACKJSON.js', ...extra });
  return { ctx, f, opened };
};

test('id validation: 3 good, 5 bad', () => {
  for (const id of ['E:dashboard', 'F:f8', 'L:line.demo-1']) assert.equal(validId(id), true, id);
  for (const id of ['e:lower', 'E:has space', 'E:a,b', 'E:', 'x'.repeat(10), 'E:' + 'x'.repeat(151), 'FF:x', '', null]) assert.equal(validId(id), false, String(id));
});

test('expand: bad ids, layers and depth are refused before any process starts', async () => {
  const { ctx, f } = mk();
  assert.equal((await ctx.expand(['E:a,b'], 'F', 1)).err, 'bad-request');
  assert.equal((await ctx.expand([], 'F', 1)).err, 'bad-request');
  assert.equal((await ctx.expand(['E:demo'], 'Z', 1)).err, 'bad-request');
  assert.equal((await ctx.expand(['E:demo'], 'F', 3)).err, 'bad-request');
  assert.equal((await ctx.expand(Array.from({ length: 51 }, (_, i) => 'F:n' + i), 'F', 1)).err, 'bad-request');
  assert.equal(f.calls.length, 0);
});

test('expand: ids are ONE comma-joined argv item, only the asked layers are sent (stack-json keeps the seeds, DESK-Q58 C), the answer keeps the asked layers and the seeds', async () => {
  const { ctx, f } = mk();
  const r = await ctx.expand(['E:demo', 'F:f1'], 'FL', 1);
  assert.equal(r.ok, true);
  assert.deepEqual(f.calls[0].args, ['STACKJSON.js', '--stack', 'STACKDIR', 'expand', 'E:demo,F:f1', '--layers', 'FL', '--depth', '1']);
  assert.equal(f.calls[0].file, 'NODE');
  assert.deepEqual(r.nodes.map(n => n.id), ['E:demo', 'F:f1', 'L:l1']);          // A:a1 is outside F,L and not a seed
  assert.deepEqual(r.edges.map(e => e.a + '>' + e.b), ['E:demo>F:f1', 'E:demo>L:l1']);
  assert.ok(r.tokens > 0);
});

test('expand: a stack error is not-found, a dead process is failed', async () => {
  assert.equal((await mk({}, () => ({ stdout: '{"ok":false,"err":"no node F:zz"}\n', err: new Error('exit 2') })).ctx.expand(['F:zz'], 'F', 1)).err, 'not-found');
  assert.equal((await mk({}, () => ({ err: new Error('boom') })).ctx.expand(['F:f1'], 'F', 1)).err, 'failed');
});

test('pack: file lands under packs\\ with the date prefix; the reply has no path', async () => {
  const { ctx, f } = mk();
  const r = await ctx.pack(['E:demo', 'F:f1'], { budget: 4000 });
  assert.equal(r.ok, true);
  assert.match(r.packId, /^p[0-9a-f]{16}$/);
  assert.deepEqual(f.calls[0].args, ['STACKJSON.js', '--stack', 'STACKDIR', 'pack', 'E:demo,F:f1', '--budget', '4000']);
  const files = fs.readdirSync(paths.packs()).filter(n => /^\d{8}-\d{6}-e-demo\.md$/.test(n));
  assert.equal(files.length, 1);
  assert.equal(fs.readFileSync(path.join(paths.packs(), files[0]), 'utf8').trim(), r.text);
  assert.equal(/[A-Z]:\\/.test(JSON.stringify(r)), false);
  assert.equal(/[A-Z]:\\/.test(r.text), false);
  assert.deepEqual(Object.keys(r).sort(), ['ok', 'packId', 'text', 'tokens']);
});

test('pack: --l0 only when asked; budget limits; note counts inside the budget and follows the output', async () => {
  const { ctx, f } = mk();
  assert.equal((await ctx.pack(['E:demo'], { budget: 299 })).err, 'bad-request');
  assert.equal((await ctx.pack(['E:demo'], { budget: 20001 })).err, 'bad-request');
  assert.equal((await ctx.pack(['E:demo'], {})).err, 'bad-request');
  assert.equal((await ctx.pack(['E:demo'], { budget: 500, note: 'x'.repeat(2001) })).err, 'bad-request');
  assert.equal(f.calls.length, 0);
  await ctx.pack(['E:demo'], { budget: 500, withL0: true });
  assert.ok(f.calls[0].args.includes('--l0'));
  const note = 'check the demo line';
  const r = await ctx.pack(['E:demo'], { budget: 500, note });
  const noteTokens = Math.ceil(`\n\n## kézi jegyzet\n${note}\n`.length / 4);
  assert.equal(f.calls[1].args[f.calls[1].args.indexOf('--budget') + 1], String(500 - noteTokens));
  assert.ok(r.text.endsWith('## kézi jegyzet\n' + note + '\n'));
  assert.ok(r.text.indexOf('# VRG context pack') < r.text.indexOf('kézi jegyzet'));
});

test('pack: withLines sends --lines (DESK-Q59 C), not otherwise', async () => {
  const { ctx, f } = mk();
  await ctx.pack(['E:demo'], { budget: 500, withLines: true });
  assert.ok(f.calls[0].args.includes('--lines'));
  await ctx.pack(['E:demo'], { budget: 500 });
  assert.equal(f.calls[1].args.includes('--lines'), false);
});

test('pack: unknown node from the stack is not-found; unreadable output is failed', async () => {
  assert.equal((await mk({}, () => ({ stdout: '{"ok":false,"err":"no node F:zz"}\n' })).ctx.pack(['F:zz'], { budget: 500 })).err, 'not-found');
  assert.equal((await mk({}, () => ({ err: new Error('x') })).ctx.pack(['F:f1'], { budget: 500 })).err, 'failed');
});

test('sendToClaude: unknown packId is refused, bad target is refused', async () => {
  const { ctx, opened } = mk();
  assert.equal(ctx.sendToClaude('pdeadbeef', 'term-A').err, 'not-found');
  assert.equal(ctx.sendToClaude(undefined, 'term-A').err, 'not-found');
  const r = await ctx.pack(['E:demo'], { budget: 500 });
  assert.equal(ctx.sendToClaude(r.packId, 'term-C').err, 'bad-request');
  assert.equal(opened.length, 0);
});

test('sendToClaude term-B: claudeterm.open with account B, the repo as cwd and a first prompt naming the pack file; term-A uses A', async () => {
  const { ctx, opened } = mk();
  const r = await ctx.pack(['E:demo'], { budget: 500 });
  const s = ctx.sendToClaude(r.packId, 'term-B');
  assert.deepEqual(s, { ok: true, term: 't1' });
  assert.equal(opened[0].account, 'B');
  assert.equal(opened[0].cwd, path.join(HOME, 'repo'));
  const file = path.join(paths.packs(), fs.readdirSync(paths.packs()).filter(n => n.endsWith('-e-demo.md')).pop());
  assert.equal(opened[0].firstPrompt, 'Read the context pack at ' + file + ' (the VRG Stack cluster I picked). Then wait for my question.');
  assert.equal(/[A-Z]:\\/.test(JSON.stringify(s)), false);
  ctx.sendToClaude(r.packId, 'term-A');
  assert.equal(opened[1].account, 'A');
});

test('sendToClaude chat: returns the packId for the chat pane and opens nothing', async () => {
  const { ctx, opened } = mk();
  const r = await ctx.pack(['E:demo'], { budget: 500 });
  assert.deepEqual(ctx.sendToClaude(r.packId, 'chat'), { ok: true, packId: r.packId });
  assert.equal(opened.length, 0);
  assert.equal(ctx.packFile(r.packId).endsWith('.md'), true);
  assert.equal(ctx.packFile('nope'), null);
});

test('sendToClaude: a refused terminal is reported, not thrown', async () => {
  const { ctx } = mk({ claudeterm: { open: () => ({ ok: false, err: 'error', hu: 'A terminál nem indult el.' }) } });
  const r = await ctx.pack(['E:demo'], { budget: 500 });
  assert.equal(ctx.sendToClaude(r.packId, 'term-A').ok, false);
});

test('clusters: save, list, replace by name, delete round-trip in userDir\\clusters.json', () => {
  const { ctx } = mk();
  assert.deepEqual(ctx.clusters().clusters, []);
  const a = ctx.saveCluster('Demo cluster', ['E:demo', 'F:f1', 'F:f1']);
  assert.equal(a.ok, true);
  assert.equal(a.clusters.length, 1);
  assert.deepEqual(a.clusters[0].ids, ['E:demo', 'F:f1']);
  assert.ok(fs.existsSync(path.join(paths.userDir(), 'clusters.json')));
  const b = ctx.saveCluster('demo CLUSTER', ['L:l1']);                          // same name → replaced, same id
  assert.equal(b.clusters.length, 1);
  assert.equal(b.clusters[0].id, a.clusters[0].id);
  assert.deepEqual(ctx.clusters().clusters[0].ids, ['L:l1']);
  ctx.saveCluster('Other', ['A:a1']);
  assert.equal(ctx.clusters().clusters.length, 2);
  assert.equal(ctx.deleteCluster('cnone').err, 'not-found');
  const d = ctx.deleteCluster(a.clusters[0].id);
  assert.deepEqual(d.clusters.map(c => c.name), ['Other']);
  assert.deepEqual(ctx.clusters().clusters.map(c => c.name), ['Other']);
});

test('clusters: bad names and ids are refused', () => {
  const { ctx } = mk();
  assert.equal(ctx.saveCluster('', ['E:demo']).err, 'bad-request');
  assert.equal(ctx.saveCluster('x'.repeat(81), ['E:demo']).err, 'bad-request');
  assert.equal(ctx.saveCluster('ok', ['not an id']).err, 'bad-request');
  assert.equal(ctx.saveCluster('ok', []).err, 'bad-request');
});
