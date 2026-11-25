// WP-56 Szem: the screen reader without Windows — a fake helper process speaks the JSON-line protocol of uia-host.ps1 (focused /
// windows / elevated / no-window / timeout / crash → one restart), the summary on realistic UIA trees (a Chrome page, VS Code with a
// build error, Total Commander, a password dialog, a thin canvas window → OCR), the policy, the redaction, the OCR adapter (a fake
// engine, and the real tesseract.js on a rendered Hungarian line when the traineddata is installed), and a static check that the
// helper script is ASCII and read-only.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), os = require('os'), path = require('path');
const { EventEmitter } = require('events');
const S = require('../screen.js');
const { createOcr } = require('../ocr.js');

const n = (role, name, extra) => ({ role, name, value: null, aid: '', cls: '', off: false, focus: false, pw: false, depth: 2, rect: [0, 0, 10, 10], ...(extra || {}) });
const FIX = {
  chrome: { ok: true, win: { hwnd: 1, pid: 100, process: 'chrome', title: 'Pull request #13 · webagoly-work/vrg-toolset - Google Chrome' },
    focus: n('Edit', 'Add a comment', { focus: true, value: '' }), selection: null,
    nodes: [n('Pane', 'Pull request #13 · webagoly-work/vrg-toolset - Google Chrome', { depth: 0 }), n('TitleBar', 'Google Chrome'), n('Document', 'Pull request #13'),
      n('Text', 'VRG Asztal: Munkamenetek, session board, Vezérlő + Előszűrő'), n('Hyperlink', 'Files changed'), n('Button', 'Merge pull request'),
      n('Text', 'Írj nekem: jani@example.hu vagy +36 30 123 4567'), n('Edit', 'Add a comment', { value: '' }), n('Text', 'rejtett fül szövege', { off: true })] },
  vscode: { ok: true, win: { hwnd: 2, pid: 200, process: 'Code', title: 'main.js - Planner_VRG_U100 - Visual Studio Code' }, focus: null, selection: null,
    nodes: [n('Pane', 'main.js - Planner_VRG_U100 - Visual Studio Code', { depth: 0 }), n('TabItem', 'main.js'), n('Text', 'PROBLEMS 2'),
      n('ListItem', 'Error: Cannot find module ./lib/voice.js'), n('Text', 'Build failed: 2 tests failed'), n('Text', '0 errors in sessions.js'), n('Text', 'Ln 12, Col 4')] },
  totalcmd: { ok: true, win: { hwnd: 3, pid: 300, process: 'TOTALCMD64', title: 'Total Commander 11.03 - VRG' }, focus: n('ListItem', 'GO-MAIN.md', { focus: true }), selection: null,
    nodes: [n('Pane', 'Total Commander 11.03 - VRG', { depth: 0 }), n('ListItem', 'Dashboard'), n('ListItem', 'Prefilter'), n('ListItem', 'Voice'), n('ListItem', 'GO-MAIN.md'), n('ListItem', 'CLAUDE.md'), n('StatusBar', '0 k / 1,2 M, 0 / 5 fájl')] },
  login: { ok: true, win: { hwnd: 4, pid: 400, process: 'chrome', title: 'Bejelentkezés - Google Chrome' }, focus: n('Edit', 'Jelszó', { pw: true, value: 'SzuperTitok123', focus: true }), selection: null,
    nodes: [n('Pane', 'Bejelentkezés', { depth: 0 }), n('Edit', 'Felhasználónév', { value: 'jani@example.hu' }), n('Edit', 'Jelszó', { pw: true, value: 'SzuperTitok123' }), n('Button', 'Belépés'), n('Text', 'Elfelejtett jelszó?'), n('Hyperlink', 'Regisztráció')] },
  thin: { ok: true, win: { hwnd: 5, pid: 500, process: 'unity_game', title: 'Valami játék' }, focus: null, selection: null, nodes: [n('Pane', 'Valami játék', { depth: 0 }), n('Pane', '')] },
  windows: { ok: true, windows: [{ hwnd: 1, pid: 100, process: 'chrome', title: 'GitHub - Google Chrome', min: false }, { hwnd: 2, pid: 200, process: 'Code', title: 'main.js - Visual Studio Code', min: false },
    { hwnd: 3, pid: 300, process: 'TOTALCMD64', title: 'Total Commander 11.03', min: false }, { hwnd: 6, pid: 600, process: 'KeePassXC', title: 'Jelszavak.kdbx - KeePassXC', min: false },
    { hwnd: 7, pid: 700, process: 'electron', title: 'VRG Asztal', min: false }] },
};

// a fake powershell: answers each JSON request line with handler(req, nth process) — an object, 'hang', or 'crash'
function fakeSpawn(handler) {
  const procs = [];
  const spawn = (exe, args, opts) => {
    const p = new EventEmitter();
    p.exe = exe; p.args = args; p.opts = opts; p.killed = false; p.lines = [];
    p.stdout = new EventEmitter(); p.stderr = new EventEmitter();
    p.kill = () => { if (!p.killed) { p.killed = true; setImmediate(() => p.emit('exit', null)); } };
    const nth = procs.length;
    p.stdin = { write: line => {
      if (p.killed) throw new Error('EPIPE');
      for (const l of String(line).split('\n').filter(Boolean)) {
        const req = JSON.parse(l); p.lines.push(req);
        if (req.op === 'quit') continue;
        const r = handler(req, nth);
        if (r === 'hang') continue;
        if (r === 'crash') { setImmediate(() => { p.killed = true; p.emit('exit', 1); }); continue; }
        setImmediate(() => p.stdout.emit('data', Buffer.from(JSON.stringify({ id: req.id, ...r }) + '\n', 'utf8')));
      }
    } };
    procs.push(p);
    return p;
  };
  return { spawn, procs };
}
const make = (handler, extra) => { const f = fakeSpawn(handler); return { f, scr: S.createScreen({ spawn: f.spawn, powershell: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe', ownPids: () => [700], timeoutMs: 300, ...(extra || {}) }) }; };

test('focused: app, cleaned title, focused element, visible texts; redaction; offscreen and title bar left out', async () => {
  const { f, scr } = make(req => (req.op === 'focused' ? FIX.chrome : { ok: true, pong: true }));
  const r = await scr.describe({ what: 'focused' });
  assert.strictEqual(r.ok, true, JSON.stringify(r));
  assert.deepStrictEqual([r.source, r.app, r.title, r.own], ['uia', 'Chrome', 'Pull request #13 · webagoly-work/vrg-toolset', false]);
  assert.ok(r.say.split(' ').length <= 9 && r.say.startsWith('Chrome: Pull request #13'), r.say);
  assert.match(r.detail, /Fókusz: szerkesztőmező „Add a comment”/);
  assert.ok(r.lines.includes('Merge pull request') && r.lines.includes('Files changed'));
  assert.ok(!r.lines.some(l => /rejtett fül/.test(l)), 'an offscreen node was read');
  assert.ok(r.lines.some(l => l === 'Írj nekem: [e-mail] vagy [telefon]'), JSON.stringify(r.lines));
  assert.strictEqual(r.redacted, 2);
  assert.ok(r.detail.length <= 200 && r.lines.length <= 40);
  // the helper is started once, with -File and the script, no window; a second call reuses it
  await scr.describe({ what: 'focused' });
  assert.strictEqual(f.procs.length, 1);
  assert.deepStrictEqual(f.procs[0].args.slice(0, 6), ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File']);
  assert.match(f.procs[0].args[6], /uia-host\.ps1$/);
  assert.strictEqual(f.procs[0].opts.windowsHide, true);
  assert.strictEqual(f.procs[0].lines[0].maxNodes, 400);
  scr.close();
  assert.ok(f.procs[0].killed);
});

test('error, read and windows', async () => {
  const { scr } = make(req => (req.op === 'windows' ? FIX.windows : FIX.vscode));
  const e = await scr.describe({ what: 'error' });
  assert.strictEqual(e.app, 'VS Code');
  assert.strictEqual(e.title, 'main.js - Planner_VRG_U100');
  assert.match(e.say, /^Hiba: Cannot find module/);
  assert.deepStrictEqual(e.lines, ['Error: Cannot find module ./lib/voice.js', 'Build failed: 2 tests failed']);   // "0 errors" is not an error
  const w = await scr.describe({ what: 'windows' });
  assert.match(w.say, /^4 ablak: Chrome, VS Code, Total Commander/);
  assert.match(w.say, /\+1 rejtett/);                                    // KeePassXC is denied: not even its title is listed
  assert.ok(!w.lines.some(l => /kdbx|KeePass/i.test(l)), JSON.stringify(w.lines));
  assert.ok(w.lines.some(l => l.startsWith('VRG Asztal')), 'own window named as the VRG Asztal');
  const { scr: s2 } = make(() => ({ ...FIX.chrome, selection: 'Ez a kijelölt szöveg, amit fel kell olvasni.' }));
  const r = await s2.describe({ what: 'read' });
  assert.deepStrictEqual(r.lines, ['Ez a kijelölt szöveg, amit fel kell olvasni.']);
  assert.strictEqual(r.say, 'Ez a kijelölt szöveg, amit fel kell olvasni.');
});

test('the password dialog: a password value never appears anywhere; the e-mail is redacted', async () => {
  const { scr } = make(() => FIX.login);
  for (const what of ['focused', 'read', 'error']) {
    const r = await scr.describe({ what });
    const all = JSON.stringify(r);
    assert.ok(!all.includes('SzuperTitok123'), what + ': ' + all);
    assert.ok(!all.includes('jani@example.hu'), what + ': ' + all);
  }
  const sum = S.summarize(FIX.login, 'focused');
  assert.ok(!JSON.stringify(sum).includes('SzuperTitok123'));
});

test('a thin tree falls back to OCR of a screenshot; no capture or no OCR = the tree as it is', async () => {
  const shots = [];
  const ocr = { available: () => ({ ok: true }), recognize: async png => ({ text: 'Pontszám: 1200\nHiba: a mentés sikertelen\n', conf: 88, ms: 5, png }) };
  const capture = async () => { shots.push(1); return { png: Buffer.from([137, 80, 78, 71]), width: 10, height: 10 }; };
  const { scr } = make(() => FIX.thin, { ocr, capture });
  const r = await scr.describe({ what: 'focused' });
  assert.deepStrictEqual([r.source, r.lines], ['ocr', ['Pontszám: 1200', 'Hiba: a mentés sikertelen']]);
  const e = await scr.describe({ what: 'error' });
  assert.deepStrictEqual([e.source, e.say], ['ocr', 'Hiba: Hiba: a mentés sikertelen']);
  assert.strictEqual(shots.length, 2);
  const { scr: plain } = make(() => FIX.thin);
  const p = await plain.describe({ what: 'focused' });
  assert.deepStrictEqual([p.ok, p.source, p.lines], [true, 'uia', []]);
  const { scr: rich } = make(() => FIX.totalcmd, { ocr, capture });                // enough named nodes: no screenshot taken
  shots.length = 0;
  const t = await rich.describe({ what: 'focused' });
  assert.deepStrictEqual([t.source, t.app, shots.length], ['uia', 'Total Commander', 0]);
  assert.match(t.detail, /Fókusz: listaelem „GO-MAIN\.md”/);
});

test('helper failures: elevated, no window, a hang (timeout → one restart), a crash (→ one restart), no powershell', async () => {
  assert.deepStrictEqual(await make(() => ({ ok: false, err: 'elevated', msg: 'x' })).scr.describe({}), { ok: false, err: 'elevated', hu: 'Ez az ablak rendszergazdaként fut; nem olvasom.' });
  assert.strictEqual((await make(() => ({ ok: false, err: 'no-window' })).scr.describe({})).err, 'no-window');
  const hang = make((req, nth) => (nth === 0 ? 'hang' : FIX.chrome));
  const h = await hang.scr.describe({ what: 'focused' });
  assert.strictEqual(h.ok, true);
  assert.strictEqual(hang.f.procs.length, 2);
  assert.ok(hang.f.procs[0].killed, 'the hung helper was killed');
  const crash = make((req, nth) => (nth === 0 ? 'crash' : FIX.vscode));
  assert.strictEqual((await crash.scr.describe({ what: 'error' })).ok, true);
  assert.strictEqual(crash.f.procs.length, 2);
  const always = make(() => 'hang');
  assert.strictEqual((await always.scr.describe({})).err, 'error');           // one restart only, then a clean refusal
  assert.strictEqual(always.f.procs.length, 2);
  const none = S.createScreen({ spawn: () => { const p = new EventEmitter(); p.stdout = new EventEmitter(); p.stdin = { write() {} }; p.kill = () => {}; setImmediate(() => p.emit('error', new Error('ENOENT'))); return p; }, timeoutMs: 300 });
  assert.strictEqual((await none.describe({})).err, 'unavailable');
  assert.strictEqual((await S.createScreen({}).describe({})).err, 'unavailable');
  assert.strictEqual((await make(() => FIX.chrome).scr.describe({ what: 'nonsense' })).ok, false);
});

test('policy: deny by process and title, allow-only, own windows, disabled', async () => {
  const P = S.DEFAULT_POLICY;
  assert.deepStrictEqual(S.policyCheck({ pid: 1, process: 'KeePassXC.exe', title: 'x' }, P), { ok: false, err: 'denied', reason: 'process' });
  assert.deepStrictEqual(S.policyCheck({ pid: 1, process: 'chrome', title: 'OTP Bank - Internetbank' }, P), { ok: false, err: 'denied', reason: 'title' });
  assert.strictEqual(S.policyCheck({ pid: 1, process: 'explorer', title: 'H:\\VRG\\Full\\jobs\\K12' }, P).err, 'denied');
  assert.deepStrictEqual(S.policyCheck({ pid: 1, process: 'chrome', title: 'GitHub' }, P), { ok: true, own: false });
  assert.deepStrictEqual(S.policyCheck({ pid: 1, process: 'notepad', title: 'x' }, { ...P, allow: ['chrome', 'code'] }), { ok: false, err: 'denied', reason: 'not-allowed' });
  assert.deepStrictEqual(S.policyCheck({ pid: 9, process: 'electron', title: 'VRG Asztal' }, { ...P, allow: ['chrome'] }, [9]), { ok: true, own: true });
  assert.ok(S.policyCheck({ pid: 1, process: 'chrome', title: 'x' }, { ...P, denyTitles: ['(unclosed'] }).ok, 'a broken pattern is skipped, not thrown');
  const denied = await make(() => ({ ...FIX.chrome, win: { ...FIX.chrome.win, title: 'Netbank - Google Chrome' } })).scr.describe({ what: 'focused' });
  assert.strictEqual(denied.err, 'denied');
  assert.ok(!/Netbank/.test(denied.hu), 'a denied title is not said');
  const own = await make(() => ({ ...FIX.chrome, win: { ...FIX.chrome.win, pid: 700 } })).scr.describe({ what: 'focused' });
  assert.deepStrictEqual([own.ok, own.own, own.lines], [true, true, []]);
  const off = await make(() => FIX.chrome, { policy: () => ({ enabled: false }) }).scr.describe({});
  assert.strictEqual(off.err, 'disabled');
  const raw = await make(() => FIX.chrome, { policy: () => ({ redact: false }) }).scr.describe({ what: 'focused' });
  assert.ok(raw.lines.some(l => l.includes('jani@example.hu')) && raw.redacted === 0);
});

test('redact: personal and secret data out, ordinary numbers in', () => {
  const R = t => S.redact(t).text;
  assert.strictEqual(R('Hívj: +36 30 123 4567, 06-1/234-5678 vagy 06 20 987 6543'), 'Hívj: [telefon], [telefon] vagy [telefon]');
  assert.strictEqual(R('HU42 1177 3016 1111 1018 0000 0000'), '[IBAN]');
  assert.strictEqual(R('számla: 11773016-11111018-00000000, rövid: 11773016-11111018'), 'számla: [számlaszám], rövid: [számlaszám]');
  assert.strictEqual(R('kártya 4111 1111 1111 1111, nem kártya 1234 5678 9012 3456'), 'kártya [kártyaszám], nem kártya 1234 5678 9012 3456');
  assert.strictEqual(R('írj: jani.kovacs+vrg@example.co.hu'), 'írj: [e-mail]');
  assert.strictEqual(R('https://x.hu/p?vrg_s=abc123&page=2'), 'https://x.hu/p?vrg_s=[rejtve]&page=2');
  assert.strictEqual(R('jelszó: Titok123! és token=abc.def'), 'jelszó: [rejtve] és token=[rejtve]');
  assert.strictEqual(R('adószám 12345678-2-42, TAJ 123 456 789, adóazonosító 8123456789'), 'adószám [adószám], TAJ [TAJ], adóazonosító [adóazonosító]');
  assert.strictEqual(R('ghp_abcdefghijklmnopqrstuvwxyz0123456789 sk-ant-api03-abcdefghijklmnop'), '[kulcs] [kulcs]');
  const keep = '2 teszt elbukott, M16, v1.8.3, 2026-11-25 12:30, PR #13, 230 V, 32 A, Dashboard/shell/lib/sessions.js, claude/charming-goodall-dc1ol8';
  assert.deepStrictEqual(S.redact(keep), { text: keep, n: 0 });
  assert.ok(S.luhn('4111111111111111') && !S.luhn('1234567890123456'));
});

test('uia-host.ps1: ASCII only, read-only, one long-running loop', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'uia-host.ps1'), 'utf8');
  assert.ok(/^[\x00-\x7F]*$/.test(src), 'non-ASCII in the PowerShell 5.1 script');
  for (const bad of [/InvokePattern/, /\.Invoke\(/, /SetValue/, /SetFocus/, /SendKeys/, /SendInput/, /keybd_event/, /mouse_event/, /Start-Process/, /Set-Content|Out-File|Add-Content/])
    assert.ok(!bad.test(src), 'forbidden in a read-only helper: ' + bad);
  assert.match(src, /while \(\$true\)/);
  assert.match(src, /IsPassword/);
  assert.match(src, /"elevated"/);
  for (const op of ["'ping'", "'focused'", "'windows'"]) assert.ok(src.includes(op), op);
});

test('OCR adapter: availability, a fake engine, rectangles, close', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vrg-ocr-'));
  const none = createOcr({ engine: 'none' });
  assert.strictEqual(none.available().ok, false);
  assert.strictEqual(createOcr({ engine: 'windows' }).available().ok, false);
  const calls = [];
  const fake = { createWorker: async (langs, oem, o) => { calls.push(['create', langs, oem, o.langPath, o.gzip]); return { recognize: async (img, opts) => { calls.push(['rec', opts]); return { data: { text: 'Hiba: sikertelen \nmásodik sor', confidence: 91.4, blocks: [{ paragraphs: [{ lines: [{ words: [{ text: 'Hiba:', confidence: 95, bbox: {} }] }] }] }] } }; }, terminate: async () => calls.push(['end']) }; } };
  const o = createOcr({ dataDir: dir, load: () => fake });
  assert.deepStrictEqual(o.available().missing, ['hun.traineddata', 'eng.traineddata']);
  await assert.rejects(o.recognize(Buffer.from([1])), /hun\.traineddata/);
  for (const f of ['hun', 'eng']) fs.writeFileSync(path.join(dir, f + '.traineddata'), 'x');
  assert.strictEqual(o.available().ok, true);
  const r = await o.recognize(Buffer.from([1, 2]), { rect: { left: 1, top: 2, width: 30, height: 40 } });
  assert.deepStrictEqual([r.text, r.conf, r.words.length], ['Hiba: sikertelen\nmásodik sor', 91, 1]);
  await o.recognize(Buffer.from([1]));
  assert.deepStrictEqual(calls[0], ['create', ['hun', 'eng'], 1, dir, false]);
  assert.deepStrictEqual(calls[1], ['rec', { rectangle: { left: 1, top: 2, width: 30, height: 40 } }]);
  assert.strictEqual(calls.filter(c => c[0] === 'create').length, 1, 'one worker, kept');
  await o.close();
  assert.deepStrictEqual(calls[calls.length - 1], ['end']);
  await assert.rejects(o.recognize('not a buffer'), /PNG buffer/);
});

// the real engine, when the data is here (VRG_TESSDATA, or <Full>/tools/voice/tessdata) and tesseract.js is installed
const TESS = process.env.VRG_TESSDATA || path.join(path.resolve(__dirname, '..', '..', '..', '..'), 'tools', 'voice', 'tessdata');
const realOk = fs.existsSync(path.join(TESS, 'hun.traineddata')) && fs.existsSync(path.join(__dirname, '..', 'node_modules', 'tesseract.js'));
let playwright = null; try { playwright = require('playwright'); } catch (e) {}
test('real tesseract.js reads a rendered Hungarian error line', { skip: !(realOk && playwright) && 'tessdata or tesseract.js or playwright missing' }, async () => {
  const b = await playwright.chromium.launch();
  const p = await b.newPage({ viewport: { width: 900, height: 160 } });
  await p.setContent('<body style="margin:0;background:#fff;font:22px Arial,sans-serif;padding:20px"><div>Hiba: a fordítás sikertelen — 2 teszt elbukott</div><div>Előszűrő és Kapu belépés</div></body>');
  const png = await p.screenshot();
  await b.close();
  const o = createOcr({ dataDir: TESS });
  const r = await o.recognize(png);
  await o.close();
  assert.match(r.text, /Hiba: a fordítás sikertelen/);
  assert.match(r.text, /2 teszt elbukott/);
  assert.match(r.text, /Előszűrő és Kapu belépés/);
  assert.ok(r.conf >= 80, 'confidence ' + r.conf);
});
