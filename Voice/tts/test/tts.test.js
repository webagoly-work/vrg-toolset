// WP-57 Hang: speakable(), Hungarian numbers, the speaker's queue / stop / barge-in on a fake sherpa addon, the SAPI helper protocol
// on a fake spawn (voices, speak, cancel, crash → restart), status when nothing is installed, the manifest pins, the ASCII-only helper.
// An optional test runs the real addon when VRG_TTS_REAL=<dir with node/ and vits-piper-*/> is set (skipped otherwise).
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto');
const { EventEmitter } = require('events');
const T = require('../tts.js');
const { createSpeaker, speakable, huNumber, detectLang, ENGINES } = T;

const HERE = path.resolve(__dirname, '..');

test('speakable: Hungarian answers', () => {
  const cases = [
    ['GO MOBILE: az M16 kész.', 'gó mobil: az em tizenhat kész.'],
    ['Megnyitottam a Plannert.', 'Megnyitottam a plennert.'],
    ['A Plannerben 3 ablak van.', 'A plennerben három ablak van.'],
    ['**Hiba** a fordításban… 2 teszt elbukott.', 'Hiba a fordításban, két teszt elbukott.'],
    ['A PR #13 nyitva, 85% kész 🚀', 'A pí-ár tizenhárom nyitva, nyolcvanöt százalék kész'],
    ['VRG Asztal: 3 ablak. Második mondat. Harmadik mondat.', 'vé-er-gé asztal: három ablak. Második mondat.'],
    ['A CPU 40%-on, a Kapu-t újraindítottam.', 'A cé-pé-ú negyven százalékon, a Kaput újraindítottam.'],
    ['Nézd: https://claude.ai/code/session_x', 'Nézd: link'],
    ['22 ablak nyitva, a kettő és a három zárva.', 'huszonkét ablak nyitva, a kettő és a három zárva.'],
    ['Hány? Kettő.', 'Hány? Kettő.'],
    ['Kész…', 'Kész.'],
    ['`npm test` lefutott', 'npm test lefutott'],
    ['- első\n- második', 'első, második'],
    ['Kész.\nKövetkező lépés', 'Kész. Következő lépés'],
    ['[Planner](https://x.y) megnyitva', 'plenner megnyitva'],
    ['Mentve: Dashboard/shell/lib/voice.js', 'Mentve: voice pont js'],
    ['A WP-54 kész (CLA2 is).', 'A dupla vé-pé ötvennégy kész cé-el-á kettő is.'],
    ['Claude Code fut, 1 munkamenet.', 'klód kód fut, egy munkamenet.'],
    ['Az ESP és az USB rendben ✅', 'Az e-es-pé és az u-es-bé rendben'],
    ['2026-ban', 'kétezer-huszonhatban'],
    ['A 16-ot kérted?', 'A tizenhatot kérted?'],
  ];
  for (const [i, o] of cases) assert.strictEqual(speakable(i, 'hu'), o, i);
});

test('speakable: English answers, the cap, edge input', () => {
  const cases = [
    ['Opened the Planner. 2 sessions live.', 'Opened the Planner. 2 sessions live.'],
    ['Saved to Dashboard/shell/lib/voice.js', 'Saved to voice dot js'],
    ['VRG is OK, 85% done.', 'V R G is okay, 85 percent done.'],
    ['**Done** 🎉', 'Done'],
    ['The CPU is busy.', 'The C P U is busy.'],
    ['M16 is ready', 'M 16 is ready'],
  ];
  for (const [i, o] of cases) assert.strictEqual(speakable(i, 'en'), o, i);
  const long = 'Ez egy nagyon hosszú mondat '.repeat(20) + 'vége';
  const s = speakable(long, 'hu');
  assert.ok(s.length <= T.MAX_CHARS + 1 && /\.$/.test(s), s);
  assert.strictEqual(speakable('', 'hu'), '');
  assert.strictEqual(speakable(null, 'en'), '');
  assert.strictEqual(speakable('🚀🎉', 'hu'), '');
  assert.strictEqual(speakable('```\ncode\n```', 'hu'), '');
  assert.strictEqual(detectLang('Megnyitottam a lapot'), 'hu');
  assert.strictEqual(detectLang('Opened the sheet'), 'en');
  assert.deepStrictEqual(ENGINES, ['sherpa', 'sapi', 'none']);
});

test('huNumber: 0 … 999 999 in Hungarian', () => {
  const want = { 0: 'nulla', 1: 'egy', 2: 'kettő', 10: 'tíz', 11: 'tizenegy', 16: 'tizenhat', 20: 'húsz', 22: 'huszonkettő', 30: 'harminc', 99: 'kilencvenkilenc',
    100: 'száz', 121: 'százhuszonegy', 200: 'kétszáz', 1000: 'ezer', 1999: 'ezerkilencszázkilencvenkilenc', 2000: 'kétezer', 2026: 'kétezer-huszonhat',
    12345: 'tizenkétezer-háromszáznegyvenöt', 22000: 'huszonkétezer', 999999: 'kilencszázkilencvenkilencezer-kilencszázkilencvenkilenc' };
  for (const [n, w] of Object.entries(want)) assert.strictEqual(huNumber(Number(n)), w, n);
  assert.strictEqual(huNumber(1e6), '1000000');
});

// ------------------------------------------------------------ the sherpa engine on a fake addon
function voicesDir(ids) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vrg-tts-'));
  for (const id of ids) {
    const d = path.join(dir, 'vits-piper-' + id);
    fs.mkdirSync(path.join(d, 'espeak-ng-data'), { recursive: true });
    fs.writeFileSync(path.join(d, id + '.onnx'), 'x'); fs.writeFileSync(path.join(d, 'tokens.txt'), 'x');
  }
  fs.mkdirSync(path.join(dir, 'vits-piper-xx_broken-medium'));   // not a voice
  return dir;
}
function fakeAddon(made, opts = {}) {
  class OfflineTts {
    constructor(cfg) { this.cfg = cfg; made.push(cfg.model.vits.model); this.sampleRate = 22050; }
    async generateAsync({ text, speed, onProgress }) {
      const sentences = text.split(/(?<=[.!?])\s+/), parts = [];
      for (const s of sentences) {
        await new Promise(r => setTimeout(r, opts.ms || 15));
        const chunk = new Float32Array(Math.max(1, Math.round(s.length * 100 / (speed || 1))));
        parts.push(chunk);
        if (onProgress && onProgress({ samples: chunk, progress: parts.length / sentences.length }) === 0) break;
      }
      const all = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
      let o = 0; for (const p of parts) { all.set(p, o); o += p.length; }
      return { samples: all, sampleRate: 22050 };
    }
  }
  return { OfflineTts };
}

test('status: nothing installed, no voices, engine none', async () => {
  const none = await createSpeaker({ engine: 'none' }).status();
  assert.deepStrictEqual([none.ok, none.ready, none.engine], [true, false, 'none']);
  const noAddon = await createSpeaker({ engine: 'sherpa', dirs: { models: voicesDir(['hu_HU-anna-medium']) }, loadAddon: () => null }).status();
  assert.deepStrictEqual([noAddon.ok, noAddon.ready], [true, false]);
  assert.match(noAddon.reason, /sherpa-onnx-node nincs telepítve/);
  const throws = await createSpeaker({ engine: 'sherpa', dirs: { models: '/nope' }, loadAddon: () => { throw new Error('Cannot find module'); } }).status();
  assert.match(throws.reason, /Cannot find module/);
  const noVoices = await createSpeaker({ engine: 'sherpa', dirs: { models: fs.mkdtempSync(path.join(os.tmpdir(), 'vrg-tts-')) }, loadAddon: () => fakeAddon([]) }).status();
  assert.match(noVoices.reason, /Nincs letöltött hang/);
  assert.strictEqual((await createSpeaker({ engine: 'weird' }).say('x')).err, 'off');
  assert.strictEqual(createSpeaker({ engine: 'weird' }).engine, 'none');
});

test('sherpa: voices found, PCM returned, language and voice picked, rate passed', async () => {
  const made = [];
  const dir = voicesDir(['hu_HU-anna-medium', 'hu_HU-imre-medium', 'en_US-amy-medium']);
  const sp = createSpeaker({ engine: 'sherpa', dirs: { models: dir }, loadAddon: () => fakeAddon(made) });
  const st = await sp.status();
  assert.deepStrictEqual(st.voices.map(v => v.id), ['en_US-amy-medium', 'hu_HU-anna-medium', 'hu_HU-imre-medium']);
  const r = await sp.say('Megnyitottam a Plannert.');
  assert.deepStrictEqual([r.ok, r.lang, r.voice, r.pcm.sampleRate, r.pcm.samples instanceof Float32Array], [true, 'hu', 'hu_HU-anna-medium', 22050, true]);
  assert.strictEqual(r.chars, 'Megnyitottam a plennert.'.length);
  const e = await sp.say('Opened the Planner.', { lang: 'auto' });
  assert.deepStrictEqual([e.lang, e.voice], ['en', 'en_US-amy-medium']);
  const i = await sp.say('Kész.', { voice: 'hu_HU-imre-medium', rate: 2 });
  assert.strictEqual(i.voice, 'hu_HU-imre-medium');
  const slow = await sp.say('Kész.', { voice: 'hu_HU-imre-medium', rate: 0.5 });
  assert.ok(slow.pcm.samples.length > i.pcm.samples.length);
  assert.strictEqual(made.length, 3, 'one OfflineTts per voice, created once');
  assert.strictEqual((await sp.say('🚀')).err, 'empty');
  const huOnlyEn = createSpeaker({ engine: 'sherpa', dirs: { models: voicesDir(['en_US-amy-medium']) }, loadAddon: () => fakeAddon([]) });
  assert.strictEqual((await huOnlyEn.say('Megnyitottam.', { lang: 'hu' })).err, 'not-ready');
});

test('queue and barge-in: one at a time, a new answer replaces the waiting one, stop ends everything at once', async () => {
  const sp = createSpeaker({ engine: 'sherpa', dirs: { models: voicesDir(['hu_HU-anna-medium']) }, loadAddon: () => fakeAddon([], { ms: 30 }) });
  // stop before anything started (still picking the voice)
  const a = sp.say('Első. Második.'); const b = sp.say('Vár.'); sp.stop();
  assert.deepStrictEqual([(await a).err, (await b).err], ['stopped', 'stopped']);
  // stop in the middle: the current one ends after its sentence, the waiting one is dropped, the replaced one says so
  const c = sp.say('Első mondat. Második mondat. Harmadik mondat.');
  await new Promise(r => setTimeout(r, 5));
  const d = sp.say('Ez vár.'); const e = sp.say('Ez lecseréli.');
  const t0 = Date.now();
  setTimeout(() => sp.stop(), 40);
  const [rc, rd, re] = [await c, await d, await e];
  assert.deepStrictEqual([rc.err, rd.err, re.err], ['stopped', 'replaced', 'stopped']);
  assert.ok(Date.now() - t0 < 150, 'stop is quick');
  // queue order without stop
  const f = sp.say('Egy.'), g = sp.say('Kettő.');
  assert.deepStrictEqual([(await f).ok, (await g).ok], [true, true]);
  sp.close();
  assert.strictEqual((await sp.say('x')).err, 'off');
});

// ------------------------------------------------------------ the SAPI helper protocol on a fake spawn
function fakePowershell({ huVoice = true, crashOnSpeak = false } = {}) {
  const spawns = [], lines = [];
  let speaks = 0;                                                   // over every helper process: only the very first speak crashes
  const spawn = (exe, args) => {
    const p = new EventEmitter();
    p.stdout = new EventEmitter(); p.stdout.setEncoding = () => {};
    p.stdin = { write: l => { lines.push(JSON.parse(l)); handle(JSON.parse(l)); return true; } };
    p.kill = () => p.emit('exit', 1);
    const out = o => setImmediate(() => p.stdout.emit('data', JSON.stringify(o) + '\n'));
    let cur = null, timer = null;
    function handle(m) {
      if (m.op === 'voices') out({ ev: 'voices', voices: [{ name: 'Microsoft Zira Desktop', culture: 'en-US' }, ...(huVoice ? [{ name: 'Microsoft Szabolcs', culture: 'hu-HU' }] : [])] });
      if (m.op === 'speak') {
        if (crashOnSpeak && ++speaks === 1) { setImmediate(() => p.emit('exit', 3)); return; }
        cur = m.id;
        p.lastText = Buffer.from(m.text, 'base64').toString('utf8'); p.lastVoice = m.voice; p.lastRate = m.rate;
        timer = setTimeout(() => { out({ ev: 'done', id: cur, ok: true }); cur = null; }, 30);
      }
      if (m.op === 'stop' && cur) { clearTimeout(timer); out({ ev: 'done', id: cur, ok: false, cancelled: true }); cur = null; }
    }
    spawns.push({ exe, args, p });
    out({ ev: 'ready' });
    return p;
  };
  return { spawn, spawns, lines };
}

test('sapi: one helper, voices with languages, speak (base64 UTF-8), rate, stop → cancel, crash → restart', async () => {
  const f = fakePowershell();
  const sp = createSpeaker({ engine: 'sapi', spawn: f.spawn, powershell: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe' });
  const st = await sp.status();
  assert.deepStrictEqual([st.ready, st.voices.map(v => v.lang + ':' + v.id)], [true, ['en:Microsoft Zira Desktop', 'hu:Microsoft Szabolcs']]);
  assert.ok(f.spawns[0].args.includes('-File') && /sapi-host\.ps1$/.test(f.spawns[0].args[f.spawns[0].args.length - 1]));
  const r = await sp.say('Megnyitottam a Plannert, kész.', { rate: 1.5 });
  assert.deepStrictEqual([r.ok, r.played, r.voice], [true, true, 'Microsoft Szabolcs']);
  const p = f.spawns[0].p;
  assert.strictEqual(p.lastText, 'Megnyitottam a plennert, kész.');
  assert.strictEqual(p.lastRate, 5);
  const s = sp.say('Ez hosszú lesz.');
  setTimeout(() => sp.stop(), 10);
  assert.strictEqual((await s).err, 'stopped');
  assert.ok(f.lines.some(l => l.op === 'stop'));
  assert.strictEqual(f.spawns.length, 1, 'one long-running helper');
  sp.close();
  assert.ok(f.lines.some(l => l.op === 'quit'));
  // no Hungarian voice: ready, but says why it speaks English only
  const g = fakePowershell({ huVoice: false });
  const st2 = await createSpeaker({ engine: 'sapi', spawn: g.spawn, powershell: 'ps' }).status();
  assert.match(st2.reason, /Nincs magyar Windows-hang/);
  // crash → the answer fails, the next one starts a new helper
  const h = fakePowershell({ crashOnSpeak: true });
  const sp3 = createSpeaker({ engine: 'sapi', spawn: h.spawn, powershell: 'ps' });
  assert.strictEqual((await sp3.say('Első.')).err, 'error');
  const again = await sp3.say('Második.');
  assert.deepStrictEqual([again.ok, h.spawns.length], [true, 2]);
  // no powershell → not ready, no throw
  assert.strictEqual((await createSpeaker({ engine: 'sapi' }).status()).ready, false);
});

test('the helper script is ASCII-only, the manifest pins the 1.13.x addon and every voice', () => {
  const ps = fs.readFileSync(path.join(HERE, 'sapi-host.ps1'));
  assert.ok(ps.every(b => b < 128), 'sapi-host.ps1 must be ASCII (PowerShell 5.1)');
  const m = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'voice-manifest.json'), 'utf8')).tts;
  assert.match(m.addon.version, /^1\.13\.\d+$/, '2.x dropped the Piper phonemizer');
  for (const x of [m.addon, ...Object.values(m.addon.platforms)]) assert.match(x.integrity, /^sha512-[A-Za-z0-9+/]{86}==$/);
  assert.ok(m.addon.platforms['win32-x64']);
  assert.ok(m.voices.filter(v => v.default).map(v => v.lang).sort().join() === 'en,hu');
  for (const v of m.voices) {
    assert.match(v.sha256, /^[0-9a-f]{64}$/, v.id);
    assert.strictEqual(v.url, 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/' + v.archive);
    assert.match(v.license, /UNCLEAR/, 'every voice licence is flagged until the Founder decides');
  }
  const { integrityOf } = require('../fetch-tts.js');
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vrg-tts-')), 'x.tgz'); fs.writeFileSync(f, 'abc');
  assert.strictEqual(integrityOf(f), 'sha512-' + crypto.createHash('sha512').update('abc').digest('base64'));
  const lex = JSON.parse(fs.readFileSync(path.join(HERE, 'lexicon.json'), 'utf8'));
  for (const l of ['hu', 'en']) for (const k of ['phrases', 'words', 'letters', 'symbols']) assert.ok(lex[l][k], l + '.' + k);
});

// the real engine, when a fetched copy is around (VRG_TTS_REAL = a tools/voice/tts folder)
const REAL = process.env.VRG_TTS_REAL;
test('real sherpa-onnx: a Hungarian answer in under 300 ms once the voice is loaded', { skip: !REAL || !fs.existsSync(path.join(REAL || '', 'node')) }, async () => {
  const dirs = { models: REAL, node: path.join(REAL, 'node') };
  const sp = createSpeaker({ engine: 'sherpa', dirs, loadAddon: T.addonLoader(dirs) });
  assert.strictEqual((await sp.status()).ready, true);
  sp.warm();
  const r = await sp.say('Hiba a fordításban, két teszt elbukott.');
  assert.ok(r.ok && r.pcm.sampleRate === 22050 && r.pcm.samples.length > 22050);
  assert.ok(r.ms < 300, 'generation took ' + r.ms + ' ms');
  let sum = 0; for (const v of r.pcm.samples) sum += v * v;
  assert.ok(Math.sqrt(sum / r.pcm.samples.length) > 0.01, 'not silence');
  sp.close();
});
