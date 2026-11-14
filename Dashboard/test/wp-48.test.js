// WP-48: servers and pages stay inside the VRG Asztal.
//  - registry servers run as hidden pty sessions (lib/srvhost.js, profiles srv-node / srv-cmd): no console window, the output is kept and a
//    console pane can open later (closing it leaves the server running);
//  - what START opened in the outside browser opens in an inner window: URLs through run.inner.url, HTML pages that are catalog apps
//    through run.inner.doc, and "rundll32 url.dll,FileProtocolHandler <url>" acts through run.openUrl.
// Nothing is spawned: the pty is test/fixtures/fake-pty.js and the shell is a recorder.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const os = require('os'), path = require('path'), fs = require('fs');
const build = require('../build.js');
const { createRegistry } = require('../shell/lib/registry.js');
const { createRunner } = require('../shell/lib/runbat.js');
const { createPorts } = require('../shell/lib/ports.js');
const { createActs } = require('../shell/lib/acts.js');
const { createServerHost } = require('../shell/lib/srvhost.js');
const ptyLib = require('../shell/lib/pty.js');
const settings = require('../shell/lib/settings.js');
const { createFakePty } = require('./fixtures/fake-pty.js');

const R = createRegistry({ build });
R.load();
const DASH = path.resolve(__dirname, '..');
const PROFILES = ptyLib.readProfiles(path.join(DASH, 'config', 'profiles.json'));
const node = R.expand('{node}');

function rig() {
  const fake = createFakePty();
  const pty = ptyLib.createPty({ profiles: PROFILES, expand: s => R.expand(s), spawn: fake.spawn, exists: () => true, flushMs: 0, max: 40 });
  const emitted = [];
  const host = createServerHost({ pty: () => pty, emit: (ns, type, d) => emitted.push({ ns, type, d }) });
  return { fake, pty, host, emitted };
}
const flush = () => new Promise(r => setTimeout(r, 5));

test('the server profiles exist, are hidden from the profile menu, and the default terminals are unchanged', () => {
  const ids = PROFILES.map(p => p.id);
  assert.ok(ids.includes('srv-node') && ids.includes('srv-cmd'));
  assert.ok(PROFILES.filter(p => /^srv-/.test(p.id)).every(p => p.hidden === true));
  const { pty } = rig();
  const shown = pty.profiles().map(p => p.id);
  assert.ok(!shown.some(id => /^srv-/.test(id)), 'no srv-* in the menu');
  for (const id of ['pwsh', 'cmd', 'bash', 'node', 'claude-a', 'claude-b']) assert.ok(shown.includes(id), id);
});

test('settings: srv.inside and web.inner are known booleans, on by default', () => {
  for (const k of ['srv.inside', 'web.inner']) {
    assert.ok(settings.has(k), k);
    assert.strictEqual(settings.KEYS[k].def, true, k);
    assert.ok(settings.KEYS[k].type(false) && !settings.KEYS[k].type('yes'), k);
  }
});

test('plan: a node server runs its script through srv-node with the registry args; a bat server through srv-cmd', () => {
  const { host } = rig();
  const s = (R.C.menu.servers || []).find(x => x.js);
  assert.ok(s, 'a node server in the registry');
  const p = host.plan(s, ['--x'], { expand: x => R.expand(x), exists: () => true, repo: R.C.paths.REPO });
  assert.strictEqual(p.prof, 'srv-node');
  assert.strictEqual(p.args[0], R.expand(s.js));
  assert.strictEqual(p.args[p.args.length - 1], '--x');
  const b = host.plan({ id: 'b', port: 1, bat: 'C:\\x\\run.cmd' }, [], { expand: x => x, exists: () => true, repo: 'C:\\r' });
  assert.deepStrictEqual(b, { prof: 'srv-cmd', args: ['/d', '/c', 'C:\\x\\run.cmd'], cwd: 'C:\\x' });
  assert.strictEqual(host.plan({ id: 'm', port: 1, js: 'C:\\no.js' }, [], { expand: x => x, exists: () => false, repo: 'C:\\r' }).err, 'missing');
});

test('start: one hidden session per server, output kept, console opens a pane with the replay, stop ends it', async () => {
  const { fake, host, emitted } = rig();
  const s = { id: 'demo', name: 'Demo', port: 8999 };
  const r = host.start(s, { prof: 'srv-node', args: ['C:\\demo\\serve.js'], cwd: 'C:\\demo' });
  assert.ok(r.ok && r.term);
  assert.strictEqual(fake.calls.length, 1);
  assert.strictEqual(fake.calls[0].exe, node, 'node runs the script');
  assert.deepStrictEqual(fake.calls[0].args, ['C:\\demo\\serve.js']);
  assert.strictEqual(host.start(s, { prof: 'srv-node', args: [], cwd: 'C:\\demo' }).already, true, 'a running server is not started twice');
  assert.strictEqual(fake.calls.length, 1);
  fake.procs[0].emit('listening on :8999\r\n');
  await flush();
  assert.match(host.output('demo'), /listening on :8999/);
  const c = host.console('demo');
  assert.ok(c.ok);
  const open = emitted.find(e => e.ns === 'layout' && e.type === 'open');
  assert.ok(open, 'layout.open emitted');
  assert.strictEqual(open.d.kind, 'term');
  assert.strictEqual(open.d.server, 'demo');
  assert.strictEqual(open.d.term, r.term);
  assert.match(open.d.replay, /listening on :8999/);
  assert.deepStrictEqual(host.list().map(x => [x.id, x.running]), [['demo', true]]);
  assert.ok(host.stop('demo').ok);
  await flush();
  assert.strictEqual(host.list()[0].running, false);
  const after = host.console('demo');
  assert.strictEqual(after.ok, false);
  assert.match(after.replay, /listening/, 'the last output stays readable');
  assert.strictEqual(host.console('nope').ok, false);
});

test('ports.startServer: inside → the host, no batch file; outside → the old minimised window; a dry run only plans', () => {
  const s = (R.C.menu.servers || []).find(x => x.js && R.exists(R.expand(x.js)));
  assert.ok(s, 'a node server whose script exists');
  const fakeShell = { openPath() { throw new Error('real'); }, openExternal() { throw new Error('real'); } };
  const run = createRunner({ R, shell: fakeShell, tmp: path.join(os.tmpdir(), 'VRG', 'desk-test-wp48') });
  const bats = [];
  run.runBat = (name, cwd, lines, mode) => bats.push({ name, mode, lines });
  const { fake, host } = rig();
  let inside = true;
  const ports = createPorts({ R, run, host, inside: () => inside });
  assert.strictEqual(ports.startServer(s), '');
  assert.strictEqual(bats.length, 0, 'no batch window');
  assert.strictEqual(fake.calls.length, 1, 'one pty session');
  inside = false;
  assert.strictEqual(ports.startServer({ ...s, id: s.id + '-b' }), '');
  assert.strictEqual(bats.length, 1);
  assert.strictEqual(bats[0].mode, 'min');
  inside = true;
  run.dry = [];
  const r2 = createRunner({ R, shell: fakeShell, tmp: os.tmpdir() }); r2.dry = [];
  const p2 = createPorts({ R, run: r2, host, inside: () => true });
  assert.strictEqual(p2.startServer({ ...s, id: s.id + '-c' }), '');
  assert.strictEqual(fake.calls.length, 1, 'a dry run starts nothing');
  assert.ok(r2.dry.some(x => x.bat), 'the dry run plans the old way (the selftest reads these plans)');
});

test('run.openUrl: inner first, the outside browser only when the inner window declines; dry runs only plan', () => {
  const opened = [];
  const shell = { openExternal: u => opened.push(u), openPath() {} };
  const run = createRunner({ R, shell, tmp: os.tmpdir() });
  const inner = [];
  run.inner = { url: u => { inner.push(u); return true; }, doc: () => false };
  run.openUrl('http://127.0.0.1:8131/');
  assert.deepStrictEqual(inner, ['http://127.0.0.1:8131/']);
  assert.deepStrictEqual(opened, []);
  run.inner = { url: () => false, doc: () => false };
  run.openUrl('https://example.org/');
  assert.deepStrictEqual(opened, ['https://example.org/']);
  run.openUrl('javascript:alert(1)');
  assert.strictEqual(opened.length, 1, 'not http(s): nothing');
  run.dry = []; run.inner = { url: () => { throw new Error('dry runs never route'); }, doc: () => false };
  run.openUrl('http://127.0.0.1:1/');
  assert.deepStrictEqual(run.dry, [{ url: 'http://127.0.0.1:1/' }]);
});

test('run.openDoc: an HTML page a catalog app owns opens as the app; any other page keeps the old way', () => {
  const shell = { openExternal() {}, openPath() {} };
  const run = createRunner({ R, shell, tmp: os.tmpdir() });
  const docs = [], starts = [];
  run.startExe = (...a) => starts.push(a);
  run.openPath = p => starts.push(['path', p]);
  run.inner = { url: () => true, doc: p => { docs.push(p); return /planner/i.test(p); } };
  run.openDoc('C:\\x\\dist\\varler_planner.html', 'Planner');
  assert.deepStrictEqual(docs, ['C:\\x\\dist\\varler_planner.html']);
  assert.strictEqual(starts.length, 0, 'the app took it');
  run.openDoc('C:\\x\\other.html', 'Other');
  assert.strictEqual(starts.length, 1, 'not an app: the registry browser (or the Windows program)');
  run.openDoc('C:\\x\\notes.txt', 'Notes');
  assert.strictEqual(docs.length, 2, 'only HTML asks the inner route');
});

test('acts: a "rundll32 url.dll,FileProtocolHandler <url>" act opens its URL through the runner, never rundll32', async () => {
  const fakeShell = { openPath() { throw new Error('real'); }, openExternal() { throw new Error('real'); } };
  const run = createRunner({ R, shell: fakeShell, tmp: path.join(os.tmpdir(), 'VRG', 'desk-test-wp48') });
  const ports = createPorts({ R, run });
  const acts = createActs({ R, run, ports });
  const id = Object.keys(R.C.startActs).find(k => {
    const it = R.C.startActs[k];
    return it && /rundll32\.exe$/i.test(it.exe || '') && (it.args || [])[0] === 'url.dll,FileProtocolHandler' && /^https?:/.test((it.args || [])[1] || '')
      && (!it.ensure || R.exists(R.expand(it.ensure.path)));          // an act that first downloads its data (Térkép) is refused before this point
  });
  assert.ok(id, 'the registry has such an act (Gépország, Holo, Térkép …)');
  run.dry = [];
  const r = await acts.runAct(id);
  assert.ok(r.ok, r.hu);
  assert.ok(run.dry.some(x => x.url === R.C.startActs[id].args[1]), 'the URL went to openUrl');
  assert.ok(!run.dry.some(x => x.bat && x.lines.some(l => /rundll32/i.test(l))), 'rundll32 is not started');
  run.dry = null;
});

test('main.js wiring: the page cannot open a server profile; console, stop and list are registered; run.inner is set', () => {
  const src = fs.readFileSync(path.join(DASH, 'shell', 'main.js'), 'utf8');
  assert.match(src, /if \(\/\^srv-\/\.test\(prof\)\) return \{ ok: false/);
  for (const t of ['serverConsole', 'serverStop', 'serverList']) assert.ok(src.includes("'desktop', '" + t + "'"), t);
  assert.match(src, /run\.inner = \{/);
  assert.match(src, /host: srvHost, inside:/);
  const term = fs.readFileSync(path.join(DASH, 'page', 'panes', 'term.js'), 'utf8');
  assert.match(term, /if \(this\.id && !this\.keep\)/, 'closing a server console does not kill the server');
  const desk = fs.readFileSync(path.join(DASH, 'page', 'desk.js'), 'utf8');
  assert.match(desk, /vrg\.on\('desktop', 'item'/);
  assert.match(desk, /data-console/);
});
