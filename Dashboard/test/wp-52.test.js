// WP-52: the Vezérlő — shell/lib/gate.js over a fake Előszűrő and a recording claudeterm: nothing is sent unfiltered; the verdict picks the
// folder (independent → freeDir, no CLAUDE.md there; context → the repo); the user's route and model override; attachments are ids main
// issued and their paths go into the prompt only in main; the camera photo is saved and attached; the page helpers of panes/controller.js.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), os = require('os'), path = require('path');
const { createGate, attachLines, titleFrom } = require('../shell/lib/gate.js');
const ctl = require('../page/panes/controller.js');

const DASH = path.resolve(__dirname, '..');
// the fake Előszűrő: "GO" or "Planner" in the text = context, else independent; dress() wraps the text
const fakePf = {
  loadIndex: () => ({ fake: true }),
  analyze: (text, o) => {
    const ctx = /\bGO\b|Planner/.test(text);
    return { verdict: ctx ? 'context' : 'independent', score: ctx ? 0.8 : 0.1, threshold: 0.45, intent: 'build', model: ctx ? 'sonnet' : 'haiku',
      signals: [{ kind: 'term', text: 'Planner', weight: 0.7 }], anchors: ctx ? [{ id: 'planner', title: 'Varler Planner', kind: 'catalog', source: 'catalog' }] : [],
      reasons: ['fake'], _attach: o.attachments };
  },
  dress: (text, a, o) => {
    const mode = o.mode && o.mode !== 'auto' ? o.mode : a.verdict;
    const before = mode === 'context' ? '[VRG Előszűrő] kontextus' : '[VRG Előszűrő] önálló';
    return { prompt: before + '\n\n' + text + '\n\n[vége]', parts: { before, user: text, after: '[vége]' }, length: 0 };
  },
};
function setup(extra = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vrg-wp52-'));
  const repo = path.join(tmp, 'repo'); fs.mkdirSync(repo);
  const file = path.join(tmp, 'ajanlat.txt'); fs.writeFileSync(file, 'x'.repeat(100));
  const calls = [], recent = { v: [] };
  const g = createGate({
    prefilter: () => fakePf, repo, full: tmp, freeDir: path.join(tmp, 'free'), inboxDir: path.join(tmp, 'inbox'),
    claudeterm: { open: o => { calls.push(o); return { term: 't9' }; } },
    dialog: async () => [file], folders: () => [{ id: 'jobs', hu: 'Munkák', abs: tmp }],
    recentStore: { get: () => recent.v, set: v => { recent.v = v; } }, now: () => Date.parse('2026-11-24T10:20:30'), ...extra,
  });
  return { tmp, repo, file, calls, recent, g };
}

test('analyze: verdict, anchors, the dressing, where it would start; refusals', () => {
  const { g } = setup();
  const r = g.analyze({ text: 'GO PLANNER: javítsd a routert' });
  assert.deepStrictEqual([r.ok, r.verdict, r.effective, r.model, r.cwd], [true, 'context', 'context', 'sonnet', 'repo']);
  assert.strictEqual(r.anchors[0].title, 'Varler Planner');
  assert.match(r.dressed.before, /kontextus/);
  const i = g.analyze({ text: 'írj egy verset a télről' });
  assert.deepStrictEqual([i.verdict, i.cwd], ['independent', 'free']);
  const o = g.analyze({ text: 'írj egy verset', mode: 'context' });
  assert.deepStrictEqual([o.verdict, o.effective, o.cwd], ['independent', 'context', 'repo']);   // the user's route wins
  assert.strictEqual(g.analyze({ text: '  ' }).err, 'bad-request');
  assert.strictEqual(g.analyze({ text: 'x'.repeat(8001) }).err, 'bad-request');
  assert.strictEqual(g.analyze({ text: 'x', mode: 'weird' }).err, 'bad-request');
  assert.strictEqual(g.analyze({ text: 'x', attach: ['a99'] }).err, 'not-found');
  assert.strictEqual(setup({ prefilter: () => null }).g.analyze({ text: 'x' }).hu, 'Az Előszűrő nem érhető el (Prefilter/prefilter.js).');
});

test('send: always dressed; independent starts in freeDir, context in the repo; --model; labels; overrides', () => {
  const { g, calls, repo, tmp } = setup();
  assert.strictEqual(g.send({ text: 'írj egy verset a télről', account: 'A' }).term, 't9');
  assert.strictEqual(calls[0].cwd, path.join(tmp, 'free'));
  assert.ok(fs.statSync(calls[0].cwd).isDirectory());
  assert.deepStrictEqual(calls[0].extraArgs, ['--model', 'haiku']);
  assert.match(calls[0].firstPrompt, /^\[VRG Előszűrő\] önálló\n\nírj egy verset a télről\n\n\[vége\]$/);
  assert.deepStrictEqual(calls[0].deco, { origin: 'local', account: 'A', title: 'írj egy verset a télről', note: 'Előszűrő: önálló · haiku' });
  assert.strictEqual(calls[0].maxPrompt, 12000);
  g.send({ text: 'GO PLANNER folytasd', account: 'B', model: 'opus' });
  assert.deepStrictEqual([calls[1].cwd, calls[1].account, calls[1].extraArgs], [repo, 'B', ['--model', 'opus']]);
  g.send({ text: 'GO PLANNER folytasd', account: 'A', mode: 'independent' });
  assert.strictEqual(calls[2].cwd, path.join(tmp, 'free'));
  for (const bad of [{ text: 'x' }, { text: 'x', account: 'C' }, { text: 'x', account: 'A', model: 'gpt' }, { text: '', account: 'A' }])
    assert.strictEqual(g.send(bad).ok, false, JSON.stringify(bad));
  assert.strictEqual(calls.length, 3);
});

test('attachments: ids from the dialog, recent, folder, photo; paths only inside main\'s prompt', async () => {
  const { g, calls, file, recent, tmp } = setup();
  const p = await g.pick({ kind: 'browse' });
  assert.deepStrictEqual(p.files, [{ id: 'a1', name: 'ajanlat.txt', ext: 'txt', size: 100 }]);
  assert.ok(!JSON.stringify(p).includes(tmp), 'a path reached the page');
  assert.deepStrictEqual(recent.v, [file]);
  assert.strictEqual((await g.pick({ kind: 'browse' })).files[0].id, 'a1');        // the same file keeps its id
  assert.strictEqual((await g.pick({ kind: 'folder', root: 'jobs' })).ok, true);
  assert.strictEqual((await g.pick({ kind: 'folder', root: 'none' })).err, 'not-found');
  assert.strictEqual((await g.pick({ kind: 'x' })).err, 'bad-request');
  assert.strictEqual((await setup({ dialog: async () => [] }).g.pick({ kind: 'gallery' })).err, 'cancelled');
  assert.deepStrictEqual(g.recent().files.map(f => f.id), ['a1']);
  assert.deepStrictEqual(g.folders(), { ok: true, folders: [{ id: 'jobs', hu: 'Munkák' }] });
  const ph = g.photo({ data: 'data:image/png;base64,' + Buffer.from('PNGDATA').toString('base64') });
  assert.deepStrictEqual([ph.ok, ph.file.id, ph.file.name], [true, 'a2', 'foto-20261124-102030.png']);
  assert.ok(fs.existsSync(path.join(tmp, 'inbox', 'foto-20261124-102030.png')));
  assert.strictEqual(g.photo({ data: 'data:text/html;base64,AAAA' }).err, 'bad-request');
  g.send({ text: 'GO PLANNER nézd meg', account: 'A', attach: ['a1', 'a2'] });
  assert.ok(calls[0].firstPrompt.endsWith(attachLines([{ abs: file }, { abs: path.join(tmp, 'inbox', 'foto-20261124-102030.png') }])));
  assert.strictEqual(g.analyze({ text: 'x', attach: new Array(11).fill('a1') }).err, 'not-found');
  assert.strictEqual(titleFrom('\n\n  első sor  \nmásodik'), 'első sor');
});

test('controller helpers: state, payload, attachments, verdict line, caret insert', () => {
  const h = ctl;
  assert.deepStrictEqual(h.cleanState({ mode: 'detailed', account: 'B', route: 'context', model: 'opus', draft: 'x' }), { mode: 'detailed', account: 'B', route: 'context', model: 'opus', draft: 'x' });
  assert.deepStrictEqual(h.cleanState({ mode: 'zz', account: 'Q', route: 'r', model: 'gpt', draft: 5 }), { mode: 'simple', account: 'A', route: 'auto', model: '', draft: '' });
  const st = h.cleanState({ account: 'B', route: 'independent', model: 'haiku' });
  assert.deepStrictEqual(h.payload(st, 'hi', [{ id: 'a1' }, { id: '../x' }, { id: 'a2' }]), { text: 'hi', account: 'B', attach: ['a1', 'a2'], mode: 'independent', model: 'haiku' });
  assert.deepStrictEqual(h.payload(h.cleanState({}), 'hi', []), { text: 'hi', account: 'A' });
  let list = h.addFiles([], [{ id: 'a1', name: 'x' }, { id: 'a1', name: 'x' }, { id: 'nope' }]);
  assert.deepStrictEqual(list.map(f => f.id), ['a1', 'nope']);
  list = h.addFiles([], Array.from({ length: 15 }, (_, i) => ({ id: 'a' + i })));
  assert.strictEqual(list.length, h.MAX_ATTACH);
  assert.strictEqual(h.verdictLine({ ok: true, verdict: 'context', effective: 'context', score: 0.734, intent: 'fix', model: 'sonnet' }), 'VRG-kontextus · 73% · javítás · sonnet');
  assert.strictEqual(h.verdictLine({ ok: true, verdict: 'independent', effective: 'context', score: 0.1, intent: 'ask' }), 'Önálló → VRG-kontextus · 10% · kérdés');
  assert.strictEqual(h.verdictLine({ ok: false, hu: 'baj' }), 'baj');
  assert.deepStrictEqual(h.insertAt('abcd', 2, 3, 'XY'), { value: 'abXYd', caret: 4 });
  assert.deepStrictEqual(h.insertAt('ab', 9, 9, 'Z'), { value: 'abZ', caret: 3 });
});

test('the real Előszűrő on this repo: a codephrase prompt goes to the repo dressed, a general one to freeDir with a cheap model', () => {
  const REPO = path.resolve(DASH, '..');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vrg-wp52r-'));
  const calls = [];
  const g = createGate({ prefilter: () => require('../../Prefilter/prefilter.js'), repo: REPO, full: path.join(tmp, 'no-full'), freeDir: path.join(tmp, 'free'),
    claudeterm: { open: o => { calls.push(o); return { term: 't1' }; } } });
  const a = g.analyze({ text: 'GO MOBILE folytasd az M16-ot' });
  assert.deepStrictEqual([a.ok, a.verdict, a.cwd], [true, 'context', 'repo'], JSON.stringify(a).slice(0, 300));
  assert.ok(a.anchors.some(x => /GO MOBILE/.test(x.title)), JSON.stringify(a.anchors));
  g.send({ text: 'GO MOBILE folytasd az M16-ot', account: 'A' });
  assert.strictEqual(calls[0].cwd, REPO);
  assert.match(calls[0].firstPrompt, /\[VRG Előszűrő/);
  assert.ok(calls[0].firstPrompt.includes('\nGO MOBILE folytasd az M16-ot\n'), 'the user text stays verbatim');
  g.send({ text: "what's the capital of Peru", account: 'A' });
  assert.strictEqual(calls[1].cwd, path.join(tmp, 'free'));
  assert.deepStrictEqual(calls[1].extraArgs, ['--model', 'haiku']);
});

test('prior and override labels: "folytasd" follows the latest session; a forced route is recorded, an agreeing one is not', () => {
  const REPO = path.resolve(DASH, '..');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vrg-wp52p-'));
  const calls = [], labels = [];
  let latest = { text: 'GO MOBILE folytasd az M16-ot', title: 'GO MOBILE folytasd az M16-ot' };
  const g = createGate({ prefilter: () => require('../../Prefilter/prefilter.js'), prior: () => latest, record: r => labels.push(r),
    repo: REPO, full: path.join(tmp, 'no-full'), freeDir: path.join(tmp, 'free'), claudeterm: { open: o => { calls.push(o); return { term: 't1' }; } } });
  const a = g.analyze({ text: 'folytasd' });
  assert.strictEqual(a.verdict, 'context');
  assert.ok(a.anchors.some(x => x.title === 'GO MOBILE'), JSON.stringify(a.anchors));
  assert.ok(a.reasons.some(r => /előző munkamenet/.test(r)));
  latest = null;
  assert.strictEqual(g.analyze({ text: 'folytasd' }).verdict, 'unsure');
  latest = 42;                                                                  // not a prior object: ignored, not an error
  g.send({ text: "what's the capital of Peru", account: 'A', mode: 'context' });
  g.send({ text: "what's the capital of Peru", account: 'A', mode: 'independent' });
  g.send({ text: 'GO PLANNER', account: 'A' });
  assert.deepStrictEqual(labels, [{ text: "what's the capital of Peru", label: 'context', source: 'override', verdict: 'independent' }]);
  assert.strictEqual(calls.length, 3);
});

test('wiring: kinds, catalog item, IPC namespace, frame page loads the side panel', () => {
  assert.ok(require('../shell/lib/layout.js').KINDS.includes('controller'));
  assert.ok(require('../shell/lib/sheets.js').KINDS.includes('controller'));
  const cat = JSON.parse(fs.readFileSync(path.join(DASH, '..', 'launcher', 'vrg-catalog.json'), 'utf8'));
  const it = cat.items.find(i => i.id === 'controller');
  assert.deepStrictEqual([it.level, it.parent, it.launch], ['dev', 'dev:ai', { pane: 'controller' }]);
  const main = fs.readFileSync(path.join(DASH, 'shell', 'main.js'), 'utf8');
  for (const ch of ['analyze', 'send', 'pick', 'recent', 'folders', 'photo']) assert.ok(main.includes("ipc.register('gate', '" + ch + "'"), ch);
  const html = fs.readFileSync(path.join(DASH, 'page', 'vrg-desktop.html'), 'utf8');
  assert.ok(html.includes('../../shared/sidepanel/sidepanel.js') && html.includes('../../shared/sidepanel/sidepanel.css'));
  const sess = require('../page/panes/sessions.js');
  assert.strictEqual(sess.quickItems().filter(q => q.level === 'simple').length, 6);
  for (const q of sess.quickItems()) assert.ok(cat.items.some(i => i.id === q.id), 'quick link ' + q.id + ' is a catalog item');
});
