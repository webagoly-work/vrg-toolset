// WP-35: security pass over everything built so far (CONTRACT §3, §4). Tests and a report only: a failing rule is a finding (SECURITY.md),
// pinned below as KNOWN_* so this file stays green and turns red the day the finding is fixed (then the line moves out of KNOWN_*).
// main.js is loaded with a stand-in for `electron`; every channel handler is swapped for a spy, so nothing real ever runs.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), Module = require('module');
const base = path.join(os.tmpdir(), 'VRG');
fs.mkdirSync(base, { recursive: true });
const HOME = fs.mkdtempSync(path.join(base, 'desk-test-'));
process.env.VRG_DESK_HOME = HOME;                                       // before anything that knows paths.js is loaded

// ---- spawn audit: patch child_process before any lib captures it. Nothing may really start here: every call is recorded and refused.
const cp = require('child_process');
const spawned = [];
for (const fn of ['spawn', 'spawnSync', 'execFile', 'execFileSync', 'exec', 'execSync', 'fork']) {
  cp[fn] = (file, args, opts) => {
    const o = (args && !Array.isArray(args) && typeof args === 'object') ? args : (opts || {});
    spawned.push({ fn, file: String(file), shell: o.shell });
    throw new Error('wp-35: ' + fn + ' blocked');
  };
}

const test = require('node:test');
const assert = require('node:assert/strict');
const ipcLib = require('../shell/lib/ipc.js');
const { createSecrets } = require('../shell/lib/secrets.js');
const { createAudit } = require('../shell/lib/audit.js');
const { createOAuth } = require('../shell/lib/oauth.js');
const { createGmail } = require('../shell/lib/gmail.js');
const { createMail, cspFor } = require('../shell/lib/mail.js');
const { createRoots } = require('../shell/lib/roots.js');
const { createHandles, createFsView } = require('../shell/lib/handles.js');
const { createMock } = require('./fixtures/mock-google.js');

const DASH = path.resolve(__dirname, '..');
const REPO = path.resolve(DASH, '..');
const FULL = (() => { const up = path.resolve(REPO, '..'); return fs.existsSync(path.join(up, 'notes', 'features')) ? up : (process.env.VRG_FULL || 'H:\\VRG\\Full'); })();
const JSLIBS = process.env.VRG_JSLIBS || path.join(FULL, 'tools', 'js-libs');
const FRAME_URL = require('url').pathToFileURL(path.join(DASH, 'page', 'vrg-desktop.html')).href;

test.after(() => fs.rmSync(HOME, { recursive: true, force: true }));

// ------------------------------------------------------------------ load main.js without Electron, channels become spies
const specs = new Map();                                                // 'ns.fn' → { schema, optional, reached: [payload] }
const wrappers = new Map();                                             // 'vrg2:ns.fn' → ipcMain handler (sender check + schema + spy)
const loose = () => {                                                   // a stand-in object: any property is a function returning itself
  const P = new Proxy(function () {}, {
    get: (t, k) => (typeof k === 'symbol' || k === 'then') ? undefined : (k === 'toString' || k === 'valueOf' ? () => '' : P),
    apply: () => P, construct: () => P,
  });
  return P;
};
const withDefaults = (over) => { const P = loose(); return new Proxy(over, { get: (t, k) => (k in t ? t[k] : P[k]) }); };
const fakeElectron = (() => {
  const L = loose();
  const app = withDefaults({
    requestSingleInstanceLock: () => true, getVersion: () => '0.0.0-test', getPath: n => path.join(HOME, 'electron-' + n),
    whenReady: () => new Promise(() => {}), on() {}, once() {}, quit() {}, setAppUserModelId() {},
    getLoginItemSettings: () => ({ openAtLogin: false }),
  });
  const ipcMain = { handle: (ch, fn) => wrappers.set(ch, fn), on() {}, removeHandler() {} };
  const safeStorage = { isEncryptionAvailable: () => true, encryptString: s => Buffer.from(Buffer.from(s, 'utf8').map(b => b ^ 0x5a)), decryptString: b => Buffer.from(b.map(x => x ^ 0x5a)).toString('utf8') };
  return new Proxy({ app, ipcMain, safeStorage }, { get: (t, k) => (k in t ? t[k] : L) });
})();

const realCreateIpc = ipcLib.createIpc;
let mainLoaded = null;
function loadMain() {
  if (mainLoaded) return mainLoaded;
  ipcLib.createIpc = opts => {
    const ipc = realCreateIpc(opts);
    const reg = ipc.register;
    ipc.register = (ns, fn, schema, handler, o) => {
      const spec = { schema, optional: new Set(Array.isArray(o) ? o : (o && o.optional) || []), reached: [] };
      specs.set(ns + '.' + fn, spec);
      return reg(ns, fn, schema, async payload => { spec.reached.push(payload); return {}; }, o);
    };
    return ipc;
  };
  const realLoad = Module._load, realSetInterval = global.setInterval;
  Module._load = function (request, ...rest) { return request === 'electron' ? fakeElectron : realLoad.call(this, request, ...rest); };
  global.setInterval = (...a) => { const t = realSetInterval(...a); if (t && t.unref) t.unref(); return t; };
  try { require('../shell/main.js'); }
  finally { Module._load = realLoad; global.setInterval = realSetInterval; ipcLib.createIpc = realCreateIpc; }
  mainLoaded = { specs, wrappers };
  return mainLoaded;
}

const T = ipcLib.types;
const H = 'h:' + 'A'.repeat(22);
const PATHY = ['C:\\Windows', '..\\..', '\\\\server\\share', 'file:///', '../..', 'c:/windows/system32', '/etc/passwd', '\\\\?\\C:\\x'];
const looksLikePath = v => typeof v === 'string' && (/^[a-zA-Z]:[\\/]/.test(v) || /\\/.test(v) || /(^|\/)\.\.(\/|$)/.test(v) || /^\//.test(v) || /^file:/i.test(v));
const HANDLE_RE = /^h:[A-Za-z0-9_-]{22}$/;

const POOL = [H, 'demo', 'root:demo', 'x', 'a', 'abc', 'name.txt', 'https://127.0.0.1/', 'ablak', 'name', 'skip', 'ask', 'frame', 'code', 'next', 'back',
  'term-A', 'yes', 'info', 'in', '', 1, 2, 3, 5, 0, 100, 300, 500, 1000, 0.5, true, false, [], [H], ['demo'], [0], {}, { x: 0, y: 0, w: 1, h: 1 }, { a: 1 }];
function basePayload(spec) {
  if (!ipcLib.isPlain(spec.schema)) return null;
  const out = {};
  for (const k of Object.keys(spec.schema)) {
    const hit = POOL.find(v => { try { return spec.schema[k](v) === true; } catch (e) { return false; } });
    if (hit !== undefined) out[k] = hit;
  }
  return out;
}
const clone = o => JSON.parse(JSON.stringify(o));
function badPayloads(spec) {
  const keys = ipcLib.isPlain(spec.schema) ? Object.keys(spec.schema) : [];
  const base = basePayload(spec) || {};
  const list = [];                                                      // { p, hard } — hard: must be refused with bad-request, the handler must not run
  const hard = p => list.push({ p, hard: true }), soft = p => list.push({ p, hard: false });
  for (const p of [null, 'x', 7, true, [], [clone(base)], false]) hard(p);
  hard({ ...clone(base), zz_extra: 1 });
  hard(JSON.parse('{"__proto__":{"polluted":1},"x":1}'));
  hard({ ...clone(base), constructor: { prototype: {} } });
  hard(JSON.parse('{"__proto__":{"a":1}' + (Object.keys(base).length ? ',' + JSON.stringify(base).slice(1, -1) : '') + '}'));   // __proto__ next to valid keys
  for (const k of keys) if (!spec.optional.has(k)) { const p = clone(base); delete p[k]; hard(p); }
  for (const k of keys) {
    for (const v of PATHY) soft({ ...clone(base), [k]: v });
    for (const v of [7, null, {}, [], 'x'.repeat(70000), -1, true]) soft({ ...clone(base), [k]: v });
  }
  for (const v of PATHY) { const p = clone(base); for (const k of keys) p[k] = v; soft(p); }
  for (let i = 0; list.length < 40; i++) hard({ ...clone(base), ['k' + i]: PATHY[i % PATHY.length] });   // pad: extra keys carrying path-looking text
  return list;
}

// the page's sender, as the real window has it
const send = async (ch, payload, url = FRAME_URL) => wrappers.get('vrg2:' + ch)({ senderFrame: { url } }, payload);

// pinned findings (see SECURITY.md). F1 was fixed in WP-35a (DESK-Q96 A): no id field lets path-looking text through any more.
const KNOWN_ID_PATH_CHANNELS = [];
let measuredIdFindings = null;

test('main.js loads without Electron and registers the channels', () => {
  const { specs: s, wrappers: w } = loadMain();
  assert.equal(s.size, 104, 'channels: ' + [...s.keys()].join(' '));
  for (const name of s.keys()) assert.ok(w.has('vrg2:' + name), name);
  for (const ns of ['app', 'layout', 'jobs', 'fs', 'term', 'web', 'sel', 'search', 'ctx', 'chat', 'note', 'git', 'mail', 'feed', 'desktop', 'programs', 'sheets', 'archive']) {   // desktop: WP-41 … WP-43 (5 channels); programs: WP-45 (5); sheets: WP-46 (2); archive: WP-47 (3)
    assert.ok([...s.keys()].some(n => n.startsWith(ns + '.')), 'namespace ' + ns);
  }
});

test('IPC fuzz: 40+ bad payloads per channel; malformed ones are refused, no handle field ever carries a path', async () => {
  const { specs: s } = loadMain();
  const idFindings = new Set();
  let total = 0, reachedAny = 0;
  for (const [name, spec] of s) {
    const list = badPayloads(spec);
    assert.ok(list.length >= 40, name + ' payloads: ' + list.length);
    for (const { p, hard } of list) {
      total++;
      const before = spec.reached.length;
      const r = await send(name, p);
      assert.ok(r && typeof r.ok === 'boolean', name + ' reply');
      const ran = spec.reached.length > before;
      if (hard) {
        assert.equal(ran, false, name + ' ran for ' + JSON.stringify(p).slice(0, 120));
        assert.deepEqual(r, { ok: false, err: 'bad-request', hu: 'Érvénytelen kérés.' }, name + ' ' + JSON.stringify(p).slice(0, 120));
      }
      if (!ran) { assert.equal(r.err, 'bad-request', name); continue; }
      reachedAny++;
      const got = spec.reached[spec.reached.length - 1];
      for (const k of Object.keys(spec.schema || {})) {
        const t = spec.schema[k], v = got[k];
        if (v === undefined) continue;
        if (t === T.handle) assert.ok(HANDLE_RE.test(v), name + '.' + k + ' handle field got ' + JSON.stringify(v));
        if (t === T.name) assert.ok(!/[\\/:]/.test(v) && !v.includes('..'), name + '.' + k + ' name field got ' + JSON.stringify(v));
        if (t === T.url) assert.ok(/^https?:\/\//i.test(v), name + '.' + k + ' url field got ' + JSON.stringify(v));
        if (t === T.id && looksLikePath(v)) idFindings.add(name + '.' + k);
      }
    }
  }
  assert.ok(total >= 40 * s.size, 'payloads sent: ' + total);
  assert.ok(reachedAny > 0, 'at least some mutated payloads must pass validation, or the path rule above proves nothing');
  measuredIdFindings = [...idFindings].sort();
});

test('F1 fixed (WP-35a): the `id` type refuses path-looking text, and no id field lets "../..", "/x", "file:///" through', () => {
  for (const bad of ['../..', '..', 'a/../b', 'root:..', 'file:///', 'file:x', '/etc/passwd', 'c:/windows', 'a//b']) assert.equal(T.id(bad), false, bad);
  for (const ok of ['root:demo', 'web:gmail', 'gmail-api', 'line:planner-stack', 'a1', '18f2a9c3b1d2e4f5', 'name.txt', 'desktop-os/wp-35', 'srv:hub'])
    assert.equal(T.id(ok), true, ok);
  assert.equal(T.id('C:\\Windows'), false);
  assert.equal(T.id('..\\..'), false);
  assert.equal(T.id('\\\\server\\share'), false);
  assert.ok(Array.isArray(measuredIdFindings));
  assert.deepEqual(measuredIdFindings, KNOWN_ID_PATH_CHANNELS);
});

test('a refused sender (web view, other file) never reaches a handler on any channel', async () => {
  const { specs: s } = loadMain();
  for (const [name, spec] of s) {
    const before = spec.reached.length;
    for (const u of ['https://example.org/', 'file:///C:/other.html', '', null]) {
      assert.deepEqual(await send(name, basePayload(spec) || {}, u), { ok: false, err: 'bad-request', hu: 'Érvénytelen kérés.' }, name);
    }
    assert.equal(spec.reached.length, before, name);
  }
});

// ------------------------------------------------------------------ replies carry no paths (except the display fields)
const ALLOWED_PATH_KEYS = new Set(['display', 'checkout', 'ref']);      // dir.display (fs), checkout (git), source.ref (notes); files[].path in git is checked by key below
function walk(v, where, hits, keyPath = '') {
  if (typeof v === 'string') { if (/^[a-zA-Z]:[\\/]|^\\\\|^file:/i.test(v) || /^\/(?!\/)/.test(v)) hits.push(where + ' = ' + v); return; }
  if (Array.isArray(v)) { v.forEach((x, i) => walk(x, where + '[' + i + ']', hits, keyPath)); return; }
  if (v && typeof v === 'object') {
    for (const k of Object.keys(v)) {
      if (ALLOWED_PATH_KEYS.has(k)) continue;
      if (k === 'path' && /(^|\.)files\[/.test(where + '.')) continue; // git status files[].path (repo-relative)
      walk(v[k], where + '.' + k, hits);
    }
  }
}

test('replies to the page hold no filesystem path outside the display fields (fs, oauth, gmail, mail on fixtures)', async () => {
  const tmp = fs.mkdtempSync(path.join(base, 'desk-test-replies-'));
  const hits = [];
  try {
    fs.mkdirSync(path.join(tmp, 'root', 'sub'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'root', 'a.txt'), 'demo');
    fs.writeFileSync(path.join(tmp, 'root', 'sub', 'b.md'), '# demo');
    const cfg = path.join(tmp, 'roots.json');
    fs.writeFileSync(cfg, JSON.stringify([{ id: 'demo', hu: 'Próba', path: path.join(tmp, 'root') }]));
    const roots = createRoots({ configFile: cfg, repo: tmp, full: tmp, getPath: () => null, machineFile: '' });
    roots.load();
    const handles = createHandles({ roots });
    const view = createFsView({ roots, handles, cloud: null });
    const rl = view.rootList();
    assert.equal(rl.length, 1);
    walk(rl, 'fs.roots', hits);
    const top = await view.list(rl[0].handle, {});
    assert.equal(top.items.length, 2);
    walk(top, 'fs.list', hits);
    const sub = top.items.find(i => i.name === 'sub');
    walk(await view.list(sub.handle, {}), 'fs.list(sub)', hits);
    walk(await view.stat(top.items.find(i => i.name === 'a.txt').handle), 'fs.stat', hits);
    walk(await view.list('h:' + 'B'.repeat(22), {}), 'fs.list(unknown)', hits);
    assert.ok(top.dir.display.startsWith(tmp) || top.dir.display.length > 0, 'display is the one place a path is allowed');
    assert.deepEqual(hits, []);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

// ------------------------------------------------------------------ the secret scan: WP-06 and WP-27 flows on fixtures
const mock = createMock();
const cipher = () => ({
  isEncryptionAvailable: () => true,
  encryptString: s => Buffer.from(Buffer.from(s, 'utf8').map(b => b ^ 0x5a)),
  decryptString: b => Buffer.from(b.map(x => x ^ 0x5a)).toString('utf8'),
});
const NEEDLES = ['MOCK_ACCESS', 'MOCK_REFRESH', 'demo-secret-wp35', 'VRG_SECRET_PROBE'];
function allFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...allFiles(f)); else out.push(f);
  }
  return out;
}

test('secret scan: after sign-in, refresh, mail reads, a secret probe and hostile IPC payloads nothing secret is on disk in plain bytes', async () => {
  loadMain();
  await mock.start();
  try {
    const paths = require('../shell/lib/paths.js');
    const secrets = createSecrets({ safeStorage: cipher() });
    const audit = createAudit({ dir: path.join(HOME, 'audit') });
    let offset = 0;
    const providers = mock.providers();
    const opener = async url => { const r = await fetch(url, { redirect: 'manual' }); const loc = r.headers.get('location'); if (loc) await fetch(loc); };
    const oauth = createOAuth({ secrets, audit, providers, opener, now: () => Date.now() + offset, timeoutMs: 4000 });
    const gmail = createGmail({ oauth, providers, sleep: async () => {} });
    const mail = createMail({ oauth, gmail, presets: () => JSON.parse(fs.readFileSync(path.join(DASH, 'config', 'web.json'), 'utf8')) });
    fs.writeFileSync(path.join(HOME, 'oauth-clients.json'), JSON.stringify({ google: { client_id: 'demo-client', client_secret: 'demo-secret-wp35' } }));

    secrets.put('probe', 'VRG_SECRET_PROBE');                           // WP-06's flow
    assert.deepEqual(await oauth.signIn('gmail-api'), { ok: true, email: 'demo@example.test' });   // WP-27's flow
    offset = 3600 * 1000 - 30 * 1000;
    assert.equal((await oauth.token('gmail-api')).ok, true);            // refresh
    offset = 0;
    const l = await gmail.list('gmail-api', 'in:inbox');
    assert.equal(l.ok, true);
    const g = await gmail.get('gmail-api', 'plain-hu');
    assert.equal(g.ok, true);
    assert.equal(typeof mail.accounts, 'function');
    // hostile payloads with secret-looking fields go through the real channel checks and the audit
    for (const name of ['app.log', 'app.setting', 'mail.signIn', 'mail.list']) {
      await send(name, { token: 'MOCK_ACCESS_X', password: 'VRG_SECRET_PROBE', client_secret: 'demo-secret-wp35', refresh_token: 'MOCK_REFRESH_X', code_verifier: 'VRG_SECRET_PROBE' });
    }
    await send('app.log', { level: 'info', msg: 'x' });

    const bin = path.join(paths.userDir(), 'secrets.bin');
    assert.ok(fs.existsSync(bin));
    const binBytes = fs.readFileSync(bin);
    for (const n of NEEDLES) assert.equal(binBytes.includes(Buffer.from(n)), false, 'secrets.bin holds ' + n + ' in plain bytes');
    const stored = JSON.parse(secrets.get('oauth:google:gmail-api'));
    assert.match(stored.access, /^MOCK_ACCESS/);                        // the scan is not vacuous: the secret really was stored (encrypted)
    assert.equal(secrets.get('probe'), 'VRG_SECRET_PROBE');

    const files = allFiles(HOME).filter(f => path.basename(f) !== 'secrets.bin' && path.basename(f) !== 'oauth-clients.json');
    assert.ok(files.some(f => /audit-\d{4}-\d\d-\d\d\.jsonl$/.test(f)), 'audit logs exist');
    assert.ok(files.length >= 2, 'files scanned: ' + files.map(f => path.relative(HOME, f)).join(', '));
    const hits = [];
    for (const f of files) {
      const b = fs.readFileSync(f);
      for (const n of NEEDLES) if (b.includes(Buffer.from(n))) hits.push(path.relative(HOME, f) + ' has ' + n);
    }
    assert.deepEqual(hits, []);
    await oauth.signOut('gmail-api');
  } finally { await mock.stop(); }
});

// ------------------------------------------------------------------ static rules over the source
const listJs = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'test') continue;
    const f = path.join(dir, e.name);
    if (e.isDirectory()) listJs(f, out); else if (/\.(js|html)$/.test(e.name)) out.push(f);
  }
  return out;
};
const code = f => fs.readFileSync(f, 'utf8').split(/\r?\n/).map((l, i) => ({ l: l.replace(/^\s*(\/\/.*|\*.*)$/, ''), n: i + 1 }));

test('spawn audit (static): no shell:true, no exec/execSync anywhere in shell, page or tools', () => {
  const bad = [];
  for (const f of [...listJs(path.join(DASH, 'shell')), ...listJs(path.join(DASH, 'page')), ...listJs(path.join(DASH, 'tools'))]) {
    if (f.includes(path.sep + 'selftest' + path.sep)) continue;
    for (const { l, n } of code(f)) {
      if (/shell:\s*true/.test(l)) bad.push(path.relative(REPO, f) + ':' + n + ' shell:true');
      if (/\bexecSync\s*\(/.test(l)) bad.push(path.relative(REPO, f) + ':' + n + ' execSync');
      if (/require\(['"]child_process['"]\)\.exec\b(?!File)/.test(l)) bad.push(path.relative(REPO, f) + ':' + n + ' child_process.exec');
      if (/\{[^}]*\bexec\b[^}]*\}\s*=\s*require\(['"]child_process['"]\)/.test(l)) bad.push(path.relative(REPO, f) + ':' + n + ' destructured exec');
    }
  }
  assert.deepEqual(bad, []);
});

const ALLOWED_EXES = new Set(['node', 'node.exe', 'claude', 'claude.exe', 'git', 'git.exe', 'attrib', 'attrib.exe', 'taskkill', 'taskkill.exe', 'cmd.exe', 'cmd', 'code', 'code.cmd', 'code.exe', 'fake-claude.js']);
test('spawn audit (dynamic): everything the modules tried to start in this file used no shell and an allowed executable', () => {
  const bad = spawned.filter(c => c.shell || ['exec', 'execSync'].includes(c.fn) || !ALLOWED_EXES.has(path.basename(c.file).toLowerCase()));
  assert.deepEqual(bad, []);
});

test('lib pins: every vendored lib the code uses has a VENDOR.json with an sha512 integrity; the page gets lib URLs only from app.info', () => {
  const used = new Set();
  for (const f of [...listJs(path.join(DASH, 'shell')), ...listJs(path.join(DASH, 'page'))]) {
    if (f.includes(path.sep + 'selftest' + path.sep)) continue;
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/jsLib\('([\w.-]+)'/g)) used.add(m[1]);
    for (const m of src.matchAll(/js-libs(?:\/|['"],\s*['"])([a-z][\w-]*)/g)) used.add(m[1]);
    for (const m of src.matchAll(/libBase\(\) \+ '([a-z][\w-]*)\//g)) used.add(m[1]);
  }
  assert.deepEqual([...used].sort(), ['dompurify', 'markdown-it', 'node-pty', 'xterm', 'xterm-addon-fit']);
  const findVendor = d => {                                              // VENDOR.json in the lib dir or one level below (markdown-it/dist)
    for (const dir of [d, ...(fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => path.join(d, e.name)) : [])]) {
      const f = path.join(dir, 'VENDOR.json');
      if (fs.existsSync(f)) return f;
    }
    return null;
  };
  const missing = [];
  for (const lib of [...used].sort()) {
    const f = findVendor(path.join(JSLIBS, lib));
    if (!f) { missing.push(lib); continue; }
    const j = JSON.parse(fs.readFileSync(f, 'utf8'));
    assert.match(String(j.integrity), /^sha512-[A-Za-z0-9+/=]{20,}$/, lib + ' integrity');
  }
  // FINDING F2 (pinned): dompurify has no VENDOR.json
  assert.deepEqual(missing, ['dompurify']);
  // FINDING F3 (pinned): these page files build tools/js-libs URLs themselves instead of using app.info().libs (xterm only has a fallback)
  const direct = [];
  for (const f of listJs(path.join(DASH, 'page'))) if (/js-libs/.test(code(f).map(x => x.l).join('\n'))) direct.push(path.relative(DASH, f).replace(/\\/g, '/'));
  assert.deepEqual(direct.sort(), ['page/frame.js', 'page/panes/term.js', 'page/vrg-desktop.html']);
});

test('CSP: the frame page and the mail view documents carry a policy with no remote script source', () => {
  const frame = fs.readFileSync(path.join(DASH, 'page', 'vrg-desktop.html'), 'utf8');
  const m = /<meta http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(frame);
  assert.ok(m, 'frame CSP');
  assert.equal(m[1], "default-src 'self' file:; script-src 'self' file:; style-src 'self' file: 'unsafe-inline'; img-src 'self' file: data:; connect-src 'none'");
  assert.ok(!/https?:|\*/.test(m[1]));
  assert.ok(!/<script[^>]+src="https?:/i.test(frame));
  const mailTpl = fs.readFileSync(path.join(DASH, 'page', 'mailview.html'), 'utf8');
  assert.match(mailTpl, /<meta http-equiv="Content-Security-Policy" content="\{\{csp\}\}">/);
  assert.equal(cspFor(), "default-src 'none'; img-src data: cid:; style-src 'unsafe-inline'");
  assert.ok(!/script-src/.test(cspFor({ images: true })));
  assert.ok(!/https?:\/\/(?!127\.0\.0\.1)[^ ;]+/.test(cspFor({ images: true, loopback: true })));
  // the Kezdőlap (D0 page) is a local page too: no remote script
  const home = fs.readFileSync(path.join(DASH, 'vrg-dashboard.html'), 'utf8');
  assert.ok(!/<script[^>]+src="https?:/i.test(home));
});
