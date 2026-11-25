// WP-54 Diktálás — the Desktop side: shell/lib/voice.js over the fake engine (off by default, start / chunk / stop, partial and final
// events to the page, one recording at a time, chunk limits), the settings keys, the IPC registration, the page's pure helpers (the key,
// the mode rule, which fields may be written, the provisional splice, the ring buffer, base64), the frame page wiring.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { createVoice, SESSION_RE, MAX_CHUNK } = require('../shell/lib/voice.js');
const page = require('../page/voice.js');
const settingsLib = require('../shell/lib/settings.js');

const DASH = path.resolve(__dirname, '..'), REPO = path.resolve(DASH, '..');
const memSettings = init => { const m = { ...init }; return { get: k => (k in m ? m[k] : settingsLib.KEYS && settingsLib.KEYS[k] ? settingsLib.KEYS[k].def : undefined), set: (k, v) => { m[k] = v; return v; }, m }; };
const b64 = ms => Buffer.alloc(Math.round(ms * 16) * 2).toString('base64');

test('voice lib: off by default; on → start / chunk / stop gives partials and a final, only for the current recording', async () => {
  const events = [], st = memSettings({ 'voice.enabled': false });
  const v = createVoice({ repo: REPO, full: path.join(REPO, '..', 'no-full'), settings: st, emit: (t, d) => events.push([t, d]), env: { VRG_VOICE_ENGINE: 'fake', VRG_VOICE_FAKE_MSPW: '200' } });
  assert.strictEqual((await v.start({ mode: 'dictate' })).err, 'off');
  const s0 = v.status();
  assert.deepStrictEqual([s0.enabled, s0.engine, s0.key, s0.lang], [false, 'fake', 'F9', 'auto']);
  const s1 = await v.enable(true);
  assert.deepStrictEqual([s1.enabled, s1.ready], [true, true]);
  assert.strictEqual(st.m['voice.enabled'], true);
  const { id } = await v.start({ mode: 'dictate', lang: 'hu' });
  assert.ok(SESSION_RE.test(id));
  for (let i = 0; i < 6; i++) assert.deepStrictEqual(v.chunk({ id, data: b64(100) }), {});
  await new Promise(r => setTimeout(r, 900));                              // the host's own 400 ms steps decode the growing buffer
  const partials = events.filter(e => e[0] === 'partial');
  assert.ok(partials.length >= 1 && partials.every(p => p[1].id === id && p[1].mode === 'dictate'), JSON.stringify(events));
  const f = await v.stop({ id });
  assert.strictEqual(f.text, 'Szia VRG, nyisd meg a Plannert');
  assert.deepStrictEqual(events[events.length - 1], ['final', { id, mode: 'dictate', text: 'Szia VRG, nyisd meg a Plannert', lang: 'hu', ms: f.ms }]);
  assert.strictEqual(v.chunk({ id, data: b64(100) }).err, 'not-found');
  assert.strictEqual((await v.stop({ id })).err, 'not-found');
  // a new press wins over a recording still open; bad chunks are refused
  const a = await v.start({ mode: 'command' }), b = await v.start({ mode: 'dictate' });
  assert.strictEqual(v.chunk({ id: a.id, data: b64(100) }).err, 'not-found');
  assert.strictEqual(v.chunk({ id: b.id, data: Buffer.alloc(MAX_CHUNK + 2).toString('base64') }).err, 'bad-request');
  assert.strictEqual(v.chunk({ id: b.id, data: Buffer.alloc(3).toString('base64') }).err, 'bad-request');
  assert.deepStrictEqual(v.cancel({ id: b.id }), {});
  assert.strictEqual((await v.enable(false)).enabled, false);
  await v.close();
});

test('voice lib: without the downloaded engine it says how to get it, and never spawns', async () => {
  const st = memSettings({ 'voice.enabled': true });
  let spawned = 0;
  const v = createVoice({ repo: REPO, full: path.join(REPO, '..', 'no-full'), settings: st, spawn: () => { spawned++; }, env: {} });
  const s = v.status();
  assert.deepStrictEqual([s.engine, s.ready], ['whisper.cpp', false]);
  assert.match(s.hu, /node Voice\/fetch\.js/);
  const r = await v.start({ mode: 'dictate' });
  assert.strictEqual(r.err, 'not-ready'); assert.match(r.hu, /fetch/);
  assert.strictEqual(spawned, 0);
  await v.close();
});

test('settings keys: voice.enabled off by default, the key, the language, the model id', () => {
  const K = settingsLib.KEYS || {};
  const ok = (k, v) => K[k] && K[k].type(v);
  if (!settingsLib.KEYS) { const src = fs.readFileSync(path.join(DASH, 'shell', 'lib', 'settings.js'), 'utf8'); for (const k of ['voice.enabled', 'voice.key', 'voice.lang', 'voice.model']) assert.ok(src.includes("'" + k + "'"), k); return; }
  assert.strictEqual(K['voice.enabled'].def, false);
  assert.ok(ok('voice.key', 'F9') && ok('voice.key', 'AltRight') && !ok('voice.key', 'a') && !ok('voice.key', 'Enter'));
  assert.ok(ok('voice.lang', 'hu') && !ok('voice.lang', 'de'));
  assert.ok(ok('voice.model', 'turbo') && !ok('voice.model', '../x'));
});

test('IPC: the voice namespace, strict schemas, the preload; whisper-server is an allowed child', () => {
  const main = fs.readFileSync(path.join(DASH, 'shell', 'main.js'), 'utf8');
  for (const ch of ['status', 'enable', 'start', 'chunk', 'stop', 'cancel']) assert.ok(main.includes("ipc.register('voice', '" + ch + "'"), ch);
  assert.match(main, /'voice', 'start', \{ mode: types\.enum\('dictate', 'command'\), lang: types\.enum\('auto', 'hu', 'en'\) \}/);
  assert.match(main, /data: v => typeof v === 'string' && v\.length <= 90000/);
  const pre = fs.readFileSync(path.join(DASH, 'shell', 'preload.js'), 'utf8');
  assert.match(pre, /voice: \{[\s\S]*?chunk: \(id, data\) => call\('voice', 'chunk'/);
  assert.match(fs.readFileSync(path.join(DASH, 'test', 'wp-35.test.js'), 'utf8'), /'whisper-server\.exe'/);
});

test('page helpers: key, mode rule, writable fields, splice with spacing, ring buffer, base64', () => {
  const h = page;
  assert.ok(h.keyMatches({ key: 'F9', code: 'F9' }, 'F9'));
  assert.ok(h.keyMatches({ key: 'F9', code: 'F9', shiftKey: true }, 'F9'));
  assert.ok(!h.keyMatches({ key: 'F9', code: 'F9', ctrlKey: true }, 'F9'));
  assert.ok(h.keyMatches({ key: 'Alt', code: 'AltRight', altKey: true }, 'AltRight'));
  assert.ok(!h.keyMatches({ key: 'F8', code: 'F8' }, 'F9'));
  const ta = { tag: 'TEXTAREA', inFrame: true }, inp = { tag: 'INPUT', type: 'search', inFrame: true };
  assert.strictEqual(h.modeFor(ta, false), 'dictate');
  assert.strictEqual(h.modeFor(inp, false), 'dictate');
  assert.strictEqual(h.modeFor(ta, true), 'command', 'Shift + key is always a command');
  assert.strictEqual(h.modeFor({ tag: 'INPUT', type: 'password', inFrame: true }, false), 'command');
  assert.strictEqual(h.modeFor({ tag: 'TEXTAREA', readOnly: true, inFrame: true }, false), 'command');
  assert.strictEqual(h.modeFor({ tag: 'DIV', editable: true, inFrame: true }, false), 'dictate');
  assert.strictEqual(h.modeFor({ tag: 'IFRAME', editable: true, inFrame: true }, false), 'command');
  assert.strictEqual(h.modeFor({ tag: 'TEXTAREA', inFrame: false }, false), 'command', 'never a field outside the frame document');
  assert.strictEqual(h.modeFor(null, false), 'command');
  assert.deepStrictEqual(h.splice('Kérés:', 6, 0, 'szia'), { value: 'Kérés: szia', from: 6, to: 11, len: 5 });
  assert.deepStrictEqual(h.splice('Kérés: szia vége', 6, 5, 'szia VRG'), { value: 'Kérés: szia VRG vége', from: 6, to: 15, len: 9 });
  assert.strictEqual(h.splice('', 0, 0, ' hello  world ').value, 'hello world');
  assert.strictEqual(h.splice('Szia', 4, 0, ', VRG').value, 'Szia, VRG');
  assert.strictEqual(h.splice('a\n', 2, 0, 'b').value, 'a\nb');
  const r = h.makeRing(3); for (let i = 0; i < 5; i++) r.push(i);
  assert.deepStrictEqual(r.take(), [2, 3, 4]); assert.strictEqual(r.size(), 0);
  assert.strictEqual(h.framesToBase64([Int16Array.of(1, -1), Int16Array.of(256)]), Buffer.from([1, 0, 255, 255, 0, 1]).toString('base64'));
  assert.strictEqual(h.PREROLL_FRAMES * 20, 300);
});

test('wiring: the frame page loads the resampler, voice.js and voice.css; the Vezérlő has the 🎤 hold button', () => {
  const html = fs.readFileSync(path.join(DASH, 'page', 'vrg-desktop.html'), 'utf8');
  for (const s of ['<script src="voice-worklet.js"></script>', '<script src="voice.js"></script>', '<link rel="stylesheet" href="voice.css">']) assert.ok(html.includes(s), s);
  assert.ok(html.indexOf('voice-worklet.js') < html.indexOf('src="voice.js"'));
  const ctl = fs.readFileSync(path.join(DASH, 'page', 'panes', 'controller.js'), 'utf8');
  assert.match(ctl, /W\.VRGVoice\.hold\(this\.text\)/);
  const csp = (html.match(/Content-Security-Policy" content="([^"]+)"/) || [])[1];
  assert.match(csp, /script-src 'self' file:;/, 'the worklet is a same-origin file, no new CSP source');
});
