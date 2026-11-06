// WP-34: saved workspaces bound to DevLog lines — save/open round-trip on fakes, no absolute paths on disk, wiring.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), os = require('os');

const base = path.join(os.tmpdir(), 'VRG');
fs.mkdirSync(base, { recursive: true });
const TMP = fs.mkdtempSync(path.join(base, 'desk-test-'));
test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));

const { createWorkspaces } = require('../shell/lib/workspaces.js');
const layoutLib = require('../shell/lib/layout.js');

const ROOT = path.join(TMP, 'rootA');
fs.mkdirSync(path.join(ROOT, 'one', 'two'), { recursive: true });
const roots = {
  get: id => (id === 'demo' ? { id, real: ROOT } : null),
  rootOf: a => (path.resolve(a).toLowerCase().startsWith(ROOT.toLowerCase()) ? 'demo' : null),
};

const tree = () => ({ v: 1, root: { dir: 'h', ratio: 0.5,
  a: { active: 0, items: [{ id: 'home', kind: 'home', state: {} }, { id: 'term-1', kind: 'term', state: { prof: 'pwsh' } }] },
  b: { active: 0, items: [
    { id: 'web-1', kind: 'web', state: { tabs: ['https://example.com/a', 'file:///x/y', 'javascript:alert(1)', 'http://127.0.0.1:8806/'], active: 0 } },
    { id: 'stack-1', kind: 'stack', state: { nodes: [{ id: 'F:demo-node' }, { id: 'bad id' }] } },
  ] } } });

function make(extra = {}) {
  const file = path.join(TMP, 'ws-' + Math.random().toString(16).slice(2) + '.json');
  const opened = [];
  let live = [{ prof: 'pwsh', abs: path.join(ROOT, 'one', 'two') }];
  const lib = createWorkspaces({
    file, roots, getTree: () => tree(), terms: () => live,
    openTerm: (prof, abs) => { opened.push({ prof, abs }); return { term: 't' + opened.length, title: prof }; },
    defaultDir: () => path.join(TMP, 'default'), ...extra,
  });
  return { lib, file, opened, setLive: v => { live = v; } };
}

test('save then open: tree, terminals as new sessions in the folder, http(s) tabs, cluster', () => {
  const { lib, opened } = make();
  const s = lib.save('Demo munka', 'demo');
  assert.deepEqual(s, { ok: true, id: s.id, name: 'Demo munka', line: 'demo' });
  assert.match(s.id, /^w[0-9a-f]{12}$/);
  const r = lib.open(s.id);
  assert.equal(r.ok, true);
  assert.deepEqual(opened, [{ prof: 'pwsh', abs: path.join(ROOT, 'one', 'two') }]);
  assert.deepEqual(r.terms, [{ term: 't1', prof: 'pwsh', title: 'pwsh' }]);
  assert.deepEqual(r.tabs, ['https://example.com/a', 'http://127.0.0.1:8806/']);
  assert.deepEqual(r.cluster, { ids: ['F:demo-node'] });
  assert.equal(layoutLib.validate(r.tree).ok, true);
  assert.deepEqual(layoutLib.panes(r.tree).map(p => p.kind), ['home', 'web', 'stack']);      // the term pane is replaced by the new session
  assert.deepEqual(layoutLib.panes(r.tree).find(p => p.kind === 'web').state, {});
  assert.deepEqual(r.skipped, []);
});

test('workspaces.json never holds an absolute path; a file: tab is dropped', () => {
  const { lib, file } = make();
  lib.save('Demo', 'demo');
  const text = fs.readFileSync(file, 'utf8');
  assert.equal(/[A-Za-z]:\\/.test(text), false);
  assert.equal(/[A-Za-z]:\\\\/.test(text), false);
  assert.equal(text.includes('file:'), false);
  assert.equal(text.includes('javascript:'), false);
  const row = JSON.parse(text)[0];
  assert.deepEqual(row.terms, [{ prof: 'pwsh', root: 'demo', names: ['one', 'two'] }]);
  assert.deepEqual(row.tabs, [{ url: 'https://example.com/a' }, { url: 'http://127.0.0.1:8806/' }]);
});

test('a state that looks like a path is dropped on save', () => {
  const t = tree();
  t.root.b.items.push({ id: 'note-1', kind: 'note', state: { p: 'C:\\Users\\demo\\x' } });
  const { lib, file } = make({ getTree: () => t });
  lib.save('Demo');
  assert.equal(/[A-Za-z]:\\/.test(fs.readFileSync(file, 'utf8')), false);
});

test('missing folder falls back to the root; unknown root to the default folder', () => {
  const { lib, file, opened } = make();
  const s = lib.save('Demo');
  const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
  rows[0].terms = [
    { prof: 'pwsh', root: 'demo', names: ['one', 'gone'] },
    { prof: 'cmd', root: 'demo', names: ['..', 'x'] },
    { prof: 'cmd', root: 'nope', names: [] },
  ];
  fs.writeFileSync(file, JSON.stringify(rows));
  assert.equal(lib.open(s.id).ok, true);
  assert.deepEqual(opened, [
    { prof: 'pwsh', abs: ROOT }, { prof: 'cmd', abs: ROOT }, { prof: 'cmd', abs: path.join(TMP, 'default') },
  ]);
});

test('a terminal that does not start is reported, not fatal', () => {
  const { lib } = make({ openTerm: () => ({ ok: false }) });
  const s = lib.save('Demo');
  const r = lib.open(s.id);
  assert.equal(r.ok, true);
  assert.deepEqual(r.terms, []);
  assert.deepEqual(r.skipped, ['pwsh']);
});

test('forLine: one workspace per line; same name overwrites; list; remove', () => {
  const { lib } = make();
  const a = lib.save('A', 'demo');
  const b = lib.save('B', 'demo');
  assert.deepEqual(lib.forLine('demo'), { id: b.id, name: 'B' });
  assert.equal(lib.forLine('other'), null);
  assert.equal(lib.save('b').id, b.id);                         // same name (any case) keeps the row
  assert.deepEqual(lib.list(), [{ id: a.id, name: 'A' }, { id: b.id, name: 'b' }]);
  assert.equal(lib.forLine('demo'), null);                      // the overwrite carried no line
  assert.deepEqual(lib.remove(a.id), { ok: true });
  assert.equal(lib.remove(a.id).err, 'not-found');
});

test('refusals: bad name, bad line, unknown id', () => {
  const { lib } = make();
  assert.equal(lib.save('  ').err, 'bad-request');
  assert.equal(lib.save('x'.repeat(61)).err, 'bad-request');
  assert.equal(lib.save('ok', '../x').err, 'bad-request');
  assert.equal(lib.open('w000000000000').err, 'not-found');
  assert.equal(lib.open('..\\x').err, 'not-found');
});

test('wiring: IPC channels, preload, frame, cont: hook', () => {
  const rd = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
  const main = rd('shell/main.js'), pre = rd('shell/preload.js'), frame = rd('page/frame.js');
  for (const c of ['workspaces', 'saveWorkspace', 'openWorkspace']) {
    assert.ok(main.includes("ipc.register('layout', '" + c + "'"), c);
    assert.ok(pre.includes("call('layout', '" + c + "'"), c);
  }
  assert.ok(main.includes('runActWithWorkspace') && main.includes('ws.openWithLine'));
  assert.ok(frame.includes('Munkatér mentése…') && frame.includes('Munkaterek') && frame.includes('Munkatér megnyitása') && frame.includes('Vonalhoz kötve: '));
});
