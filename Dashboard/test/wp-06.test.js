// WP-06: paths, settings, secrets (fake reversible cipher). Everything under a temp VRG_DESK_HOME.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), os = require('os');

const base = path.join(os.tmpdir(), 'VRG');
fs.mkdirSync(base, { recursive: true });
const HOME = fs.mkdtempSync(path.join(base, 'desk-test-'));
process.env.VRG_DESK_HOME = HOME;

const paths = require('../shell/lib/paths.js');
const settings = require('../shell/lib/settings.js');
const { createSecrets } = require('../shell/lib/secrets.js');
const { createAudit, logDir } = require('../shell/lib/audit.js');
const { createWinModes } = require('../shell/lib/winmodes.js');

test.after(() => fs.rmSync(HOME, { recursive: true, force: true }));

function cipher(available = true) {
  const c = { used: 0, isEncryptionAvailable: () => available,
    encryptString: s => { c.used++; return Buffer.from(Buffer.from(s, 'utf8').map(b => b ^ 0x5a)); },
    decryptString: b => Buffer.from(b.map(x => x ^ 0x5a)).toString('utf8') };
  return c;
}

test('paths follow VRG_DESK_HOME and create their folders', () => {
  assert.equal(paths.home(), HOME);
  assert.equal(paths.user(), 'founder');
  assert.equal(paths.userDir(), path.join(HOME, 'founder'));
  for (const [fn, name] of [['logs', 'logs'], ['cache', 'cache'], ['packs', 'packs']]) {
    assert.equal(paths[fn](), path.join(HOME, 'founder', name));
    assert.ok(fs.statSync(paths[fn]()).isDirectory());
  }
  assert.equal(paths.machine(), path.join(HOME, 'machine.json'));
  assert.equal(logDir(), paths.logs());
});

test('settings round-trip, defaults, atomic write', () => {
  assert.equal(settings.get('win.mode'), 'ablak');
  assert.equal(settings.get('ui.lang'), 'hu');
  settings.set('win.mode', 'munka');
  settings.set('web.history.days', 30);
  settings.set('win.bounds', { x: 1, y: 2, width: 300, height: 200 });
  assert.equal(settings.get('win.mode'), 'munka');
  assert.equal(settings.get('web.history.days'), 30);
  assert.deepEqual(settings.get('win.bounds'), { x: 1, y: 2, width: 300, height: 200 });
  assert.deepEqual(fs.readdirSync(paths.userDir()).filter(f => f.endsWith('.tmp')), []);
  assert.ok(fs.existsSync(path.join(paths.userDir(), 'settings.json')));
});

test('settings refuse unknown keys and bad values', () => {
  assert.throws(() => settings.get('nope'), /unknown key/);
  assert.throws(() => settings.set('nope', 1), /unknown key/);
  assert.throws(() => settings.set('__proto__', 1), /unknown key/);
  assert.throws(() => settings.set('win.mode', 'kiosk'), /bad value/);
  assert.throws(() => settings.set('web.history.days', '30'), /bad value/);
  assert.equal(settings.has('term.embedClaude'), true);
  assert.equal(settings.has('x'), false);
  assert.equal(settings.get('win.mode'), 'munka');
});

test('secrets round-trip and the file never holds the plain value', () => {
  const c = cipher(), s = createSecrets({ safeStorage: c });
  assert.equal(s.has('probe'), false);
  assert.equal(s.get('probe'), null);
  s.put('probe', 'VRG_SECRET_PROBE');
  s.put('other', 'second');
  assert.ok(c.used >= 2);
  assert.equal(s.get('probe'), 'VRG_SECRET_PROBE');
  assert.equal(s.has('probe'), true);
  const bytes = fs.readFileSync(path.join(paths.userDir(), 'secrets.bin'));
  assert.equal(bytes.includes(Buffer.from('VRG_SECRET_PROBE')), false);
  assert.equal(bytes.includes(Buffer.from('second')), false);
  assert.equal(createSecrets({ safeStorage: cipher() }).get('other'), 'second');
  assert.equal(s.del('probe'), true);
  assert.equal(s.has('probe'), false);
  assert.equal(s.del('probe'), false);
  assert.equal(s.get('other'), 'second');
  assert.deepEqual(fs.readdirSync(paths.userDir()).filter(f => f.endsWith('.tmp')), []);
});

test('secrets refuse to work without encryption and write nothing', () => {
  const f = path.join(paths.userDir(), 'secrets.bin');
  fs.rmSync(f, { force: true });
  const s = createSecrets({ safeStorage: cipher(false) });
  assert.throws(() => s.put('a', 'b'), /secrets-unavailable/);
  assert.throws(() => s.get('a'), /secrets-unavailable/);
  assert.equal(fs.existsSync(f), false);
  assert.throws(() => createSecrets({ safeStorage: null }).put('a', 'b'), /secrets-unavailable/);
});

test('audit default folder is paths.logs()', () => {
  const a = createAudit();
  assert.ok(a.write({ ch: 'x' }));
  assert.equal(path.dirname(a.file()), paths.logs());
});

test('winmodes keeps its state in settings', () => {
  const mk = () => {
    const b = { x: 100, y: 50, width: 1500, height: 950 };
    const win = { getBounds: () => b, setBounds() {}, setFullScreen() {}, setAlwaysOnTop() {}, show() {}, hide() {}, focus() {} };
    const screen = { getDisplayMatching: () => ({ id: 7, bounds: { x: 0, y: 0, width: 1920, height: 1080 }, workArea: { x: 0, y: 0, width: 1920, height: 1040 } }), getPrimaryDisplay: () => ({ id: 7 }) };
    return { win, screen };
  };
  createWinModes({ ...mk(), settings }).mode('munka');
  assert.equal(settings.get('win.mode'), 'munka');
  assert.equal(settings.get('win.display'), 7);
  assert.deepEqual(settings.get('win.bounds'), { x: 100, y: 50, width: 1500, height: 950 });
  const wm = createWinModes({ ...mk(), settings });
  assert.equal(wm.restore(), true);
  assert.equal(wm.state().mode, 'munka');
});
