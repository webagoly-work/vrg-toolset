// WP-16: Claude Code acts (s:C/*, cont:, go:) open in an embedded terminal, against fixtures/fake-pty.js. Nothing is started for real.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const os = require('os'), path = require('path');
const build = require('../build.js');
const { createRegistry } = require('../shell/lib/registry.js');
const { createRunner } = require('../shell/lib/runbat.js');
const { createActs, CONTINUE } = require('../shell/lib/acts.js');
const { createClaudeTerm, withBinOverride } = require('../shell/lib/claudeterm.js');
const { createPty, readProfiles } = require('../shell/lib/pty.js');
const { createFakePty } = require('./fixtures/fake-pty.js');
const settingsLib = require('../shell/lib/settings.js');

const fakeShell = { openPath() { throw new Error('opened for real'); }, openExternal() { throw new Error('opened for real'); } };
const R = createRegistry({ build });
R.load();
const PROFILES = readProfiles(path.join(__dirname, '..', 'config', 'profiles.json'));
const FULL = 'C:\\demo\\full';
const expand = s => String(s).replace(/\{full\}/g, FULL).replace(/\{node\}/g, 'C:\\demo\\node.exe').replace(/\{claude\}/g, 'C:\\demo\\claude.cmd');

function mk(store = {}, env = {}) {
  const fake = createFakePty();
  const pty = createPty({ profiles: withBinOverride(PROFILES, env, expand), expand, spawn: fake.spawn, env: { SystemRoot: 'C:\\Windows', PATH: 'x' }, exists: () => true, flushMs: 5 });
  const events = [];
  const claudeterm = createClaudeTerm({ pty, emit: (ns, type, d) => events.push({ ns, type, d }), env, expand });
  const run = createRunner({ R, shell: fakeShell, tmp: path.join(os.tmpdir(), 'VRG', 'desk-test-wp16') });
  const settings = { get: k => (k in store ? store[k] : settingsLib.KEYS[k].def) };
  const acts = createActs({ R, run, ports: {}, claudeterm, settings });
  return { fake, events, run, acts };
}

const firstLine = () => R.C.data.lines.find(l => l.contAct && l.sessionPath);

test('settings: term.embedClaude defaults to true, claude.account to A and accepts only A or B', () => {
  assert.strictEqual(settingsLib.KEYS['term.embedClaude'].def, true);
  assert.strictEqual(settingsLib.KEYS['claude.account'].def, 'A');
  assert.strictEqual(settingsLib.KEYS['claude.account'].type('B'), true);
  assert.strictEqual(settingsLib.KEYS['claude.account'].type('C'), false);
  assert.strictEqual(settingsLib.KEYS['claude.account'].type('a'), false);
});

test('cont:<line> opens claude-a in the line session folder with the CONTINUE prompt as one argument', async () => {
  const l = firstLine();
  assert.ok(l, 'collect() has a line with a continue act');
  const { fake, events, acts } = mk();
  const r = await acts.runAct(l.contAct);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(fake.calls.length, 1);
  assert.strictEqual(fake.calls[0].opts.cwd, l.sessionPath);
  assert.strictEqual(fake.calls[0].exe, 'C:\\Windows\\System32\\cmd.exe');            // the .cmd shim runs through cmd /c
  assert.deepStrictEqual(fake.calls[0].args, ['/c', 'C:\\demo\\claude.cmd', CONTINUE]);
  assert.deepStrictEqual(events, [{ ns: 'layout', type: 'open', d: { kind: 'term', term: 't1', prof: 'claude-a' } }]);
});

test('go:HUB opens the prompt "GO HUB" as the only argument; it is never written into the pty', async () => {
  const { fake, acts } = mk();
  const r = await acts.runAct('go:HUB');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(fake.calls.length, 1);
  assert.deepStrictEqual(fake.calls[0].args, ['/c', 'C:\\demo\\claude.cmd', 'GO HUB']);
  assert.strictEqual(fake.calls[0].opts.cwd, R.C.paths.REPO);
  assert.strictEqual(fake.procs[0].killed, false);
});

test('account B (setting) uses profile claude-b with CLAUDE_CONFIG_DIR', async () => {
  const { fake, events, acts } = mk({ 'claude.account': 'B' });
  await acts.runAct('go:HUB');
  assert.strictEqual(fake.calls[0].opts.env.CLAUDE_CONFIG_DIR, FULL + '\\home\\claude-account-b');
  assert.strictEqual(events[0].d.prof, 'claude-b');
});

test('a per-call account overrides the setting; account A has no CLAUDE_CONFIG_DIR', async () => {
  const { fake, events, acts } = mk({ 'claude.account': 'B' });
  await acts.runAct('go:HUB', { account: 'A' });
  assert.ok(!('CLAUDE_CONFIG_DIR' in fake.calls[0].opts.env));
  assert.strictEqual(events[0].d.prof, 'claude-a');
});

test('s:C/1 and s:C/B open in the repo root; Bernard keeps --agent', async () => {
  const { fake, acts } = mk();
  assert.strictEqual((await acts.runAct('s:C/1')).ok, true);
  assert.deepStrictEqual(fake.calls[0].args.slice(2), []);
  assert.strictEqual(fake.calls[0].opts.cwd, R.C.paths.REPO);
  assert.strictEqual((await acts.runAct('s:C/B')).ok, true);
  assert.deepStrictEqual(fake.calls[1].args.slice(2), ['--agent', 'bernard']);
});

test('setting off: the D1 runBat plan (dry), no terminal', async () => {
  const { fake, events, run, acts } = mk({ 'term.embedClaude': false });
  run.dry = [];
  const r = await acts.runAct('go:HUB');
  const plan = run.dry; run.dry = null;
  assert.strictEqual(r.ok, true);
  assert.strictEqual(fake.calls.length, 0);
  assert.strictEqual(events.length, 0);
  assert.strictEqual(plan.length, 1);
  assert.ok(plan[0].lines.join('\n').includes('GO HUB'));
});

test('without claudeterm (not wired) the D1 path stays', async () => {
  const run = createRunner({ R, shell: fakeShell, tmp: path.join(os.tmpdir(), 'VRG', 'desk-test-wp16') });
  const acts = createActs({ R, run, ports: {} });
  run.dry = [];
  const r = await acts.runAct('go:HUB');
  const plan = run.dry; run.dry = null;
  assert.strictEqual(r.ok, true);
  assert.strictEqual(plan.length, 1);
});

test('non-Claude acts and bad ids never reach claudeterm', async () => {
  const { fake, run, acts } = mk();
  run.dry = [];
  await acts.runAct('godoc:HUB'); await acts.runAct('go:../x'); await acts.runAct('s:A/1');
  run.dry = null;
  assert.strictEqual(fake.calls.length, 0);
});

test('claudeterm refuses an empty or oversized prompt and passes nothing to the pty', () => {
  const { fake } = mk();
  const fake2 = createFakePty();
  const pty = createPty({ profiles: PROFILES, expand, spawn: fake2.spawn, env: { SystemRoot: 'C:\\Windows' }, exists: () => true });
  const ct = createClaudeTerm({ pty });
  assert.strictEqual(ct.open({ account: 'A', cwd: 'C:\\demo', firstPrompt: '' }).ok, false);
  assert.strictEqual(ct.open({ account: 'A', cwd: 'C:\\demo', firstPrompt: 'x'.repeat(4001) }).ok, false);
  assert.strictEqual(fake2.calls.length, 0);
  assert.strictEqual(fake.calls.length, 0);
});

test('VRG_CLAUDE_BIN replaces the claude-* exe (a .js file runs through node)', () => {
  const bin = path.join(__dirname, 'fixtures', 'fake-claude.js');
  const out = withBinOverride(PROFILES, { VRG_CLAUDE_BIN: bin }, expand);
  assert.strictEqual(out.find(p => p.id === 'claude-b').exe, 'C:\\demo\\node.exe');
  assert.strictEqual(out.find(p => p.id === 'pwsh').exe, PROFILES.find(p => p.id === 'pwsh').exe);
  assert.strictEqual(withBinOverride(PROFILES, {}, expand), PROFILES);
  const { fake, acts } = mk({}, { VRG_CLAUDE_BIN: bin });
  return acts.runAct('go:HUB').then(() => {
    assert.strictEqual(fake.calls[0].exe, 'C:\\demo\\node.exe');
    assert.deepStrictEqual(fake.calls[0].args, [bin, 'GO HUB']);
  });
});

test('fake-claude prints its argv and CLAUDE_CONFIG_DIR and exits 0', () => {
  const r = require('child_process').spawnSync(process.execPath, [path.join(__dirname, 'fixtures', 'fake-claude.js'), 'GO HUB'], { encoding: 'utf8', env: { ...process.env, CLAUDE_CONFIG_DIR: 'C:\\demo\\b' } });
  assert.strictEqual(r.status, 0);
  assert.strictEqual(r.stdout.replace(/\r/g, ''), 'FAKE_CLAUDE GO HUB\nCLAUDE_CONFIG_DIR=C:\\demo\\b\n');
});

// WP-25a: main now wires claudeterm (DESK-Q41 B), so the selftest's dry planning of every act must never start Claude
test('dry run with embedding on: the plan names the embedded terminal, nothing is spawned', async () => {
  const { fake, events, run, acts } = mk();
  run.dry = [];
  const r = await acts.runAct('go:HUB');
  const plan = run.dry; run.dry = null;
  assert.strictEqual(r.ok, true);
  assert.strictEqual(fake.calls.length, 0);
  assert.strictEqual(events.length, 0);
  assert.deepStrictEqual(plan, [{ claudeterm: 'A', cwd: plan[0].cwd, prompt: 'GO HUB', extra: [] }]);
});
