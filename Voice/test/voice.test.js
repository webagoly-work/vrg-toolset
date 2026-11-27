// WP-54 Diktálás — the engine side: stable-prefix merging, the resampler, WAV, the host over the fake engine (pseudo-streaming partials,
// the final, cancel, segment rollover, language lock), the whisper-server adapter against a stub HTTP server, the vocabulary builder.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const http = require('http'), path = require('path'), fs = require('fs'), os = require('os');
const { createStable, agree } = require('../engine/stable.js');
const { toWav, msOf } = require('../engine/wav.js');
const { createFake } = require('../engine/fake.js');
const { createHost } = require('../engine/host.js');
const { createWhisperServer, multipart, parseReply } = require('../engine/whisper-server.js');
const { buildVocab, assemble } = require('../vocab/build.js');
const { makeResampler } = require('../../Dashboard/page/voice-worklet.js');

const REPO = path.resolve(__dirname, '..', '..');
const pcm = ms => Buffer.alloc(Math.round(ms * 16) * 2);          // silence of `ms` at 16 kHz PCM16

test('stable prefix: words are committed once two hypotheses agree, never taken back; the tail stays tentative', () => {
  const s = createStable();
  assert.deepStrictEqual(s.push('szia'), { committed: '', tentative: 'szia', text: 'szia' });
  assert.deepStrictEqual(s.push('Szia VRG'), { committed: 'Szia', tentative: 'VRG', text: 'Szia VRG' });
  assert.deepStrictEqual(s.push('Szia VRG nyisd'), { committed: 'Szia VRG', tentative: 'nyisd', text: 'Szia VRG nyisd' });
  const r = s.push('Szia, VRG nyisd meg a Plannert');                 // punctuation on a committed word does not undo it
  assert.strictEqual(r.committed, 'Szia VRG nyisd');
  assert.strictEqual(r.text, 'Szia VRG nyisd meg a Plannert');
  const back = s.push('Sziasztok');                                    // Whisper rewrote the start: the committed words stay
  assert.ok(back.text.startsWith('Szia VRG nyisd'));
  assert.strictEqual(agree(['a', 'b', 'c'], ['A', 'b', 'x']), 2);
});

test('resampler: 48 kHz → 16 kHz keeps the length ratio and the level; WAV header; ms', () => {
  const r = makeResampler(48000, 16000);
  const sine = new Float32Array(4800).map((_, i) => 0.5 * Math.sin(2 * Math.PI * 440 * i / 48000));
  const a = r(sine.subarray(0, 2400)), b = r(sine.subarray(2400));
  assert.strictEqual(a.length + b.length, 1600);
  const peak = Math.max(...b.map(Math.abs));
  assert.ok(peak > 14000 && peak < 16400, 'peak ' + peak);
  const one = makeResampler(44100, 16000)(new Float32Array(44100).fill(1));
  assert.ok(Math.abs(one.length - 16000) <= 1 && one[100] === 32767);
  const w = toWav(Buffer.alloc(3200));
  assert.strictEqual(w.length, 44 + 3200); assert.strictEqual(w.toString('ascii', 0, 4), 'RIFF'); assert.strictEqual(w.readUInt32LE(24), 16000);
  assert.strictEqual(msOf(32000), 1000);
});

test('host over the fake engine: partials grow while audio comes, the final is the whole utterance, cancel and limits', async () => {
  const fake = createFake({ script: 'Szia VRG nyisd meg a Plannert', msPerWord: 200 });
  const h = createHost({ adapter: fake, auto: false, minMs: 300 });
  const parts = [], finals = [];
  h.on('partial', d => parts.push(d.text)); h.on('final', d => finals.push(d));
  h.start('v1', { lang: 'hu', prompt: 'VRG, Planner', mode: 'dictate' });
  h.push('v1', pcm(200)); await h.tick();
  assert.strictEqual(parts.length, 0, 'no decode under minMs');
  h.push('v1', pcm(250)); await h.tick();                                // 450 ms → 2 words
  h.push('v1', pcm(400)); await h.tick();                                // 850 ms → 4 words
  await h.tick();                                                          // nothing new → no decode
  assert.deepStrictEqual(parts, ['Szia VRG', 'Szia VRG nyisd meg']);
  assert.strictEqual(fake.calls.filter(c => !c.final).length, 2);
  assert.strictEqual(fake.calls[0].prompt, 'VRG, Planner');
  const f = await h.stop('v1');
  assert.deepStrictEqual([f.text, f.mode, f.lang, f.audioMs], ['Szia VRG nyisd meg a Plannert', 'dictate', 'hu', 850]);
  assert.strictEqual(finals.length, 1);
  assert.strictEqual((await h.stop('v1')).err, 'not-found');
  h.start('v2', {}); h.push('v2', pcm(500));
  assert.ok(h.cancel('v2')); assert.deepStrictEqual(h.active(), []);
  h.start('v3', {});
  assert.strictEqual(h.push('v3', Buffer.alloc(16000 * 2 * 301)), false, 'a held key is not a recorder: 5 minutes at most');
  assert.strictEqual(h.start('v3', {}), false);
  await h.close();
});

test('host: auto language is locked after the first second; a long utterance rolls over into a new segment', async () => {
  const fake = createFake({ script: 'egy kettő három négy öt hat hét', msPerWord: 100, lang: 'hu' });
  const h = createHost({ adapter: fake, auto: false, minMs: 100, maxSegMs: 600 });
  const parts = [];
  h.on('partial', d => parts.push(d.text));
  h.start('v1', { lang: 'auto' });
  h.push('v1', pcm(400)); await h.tick();
  assert.strictEqual(fake.calls[0].lang, 'auto');
  h.push('v1', pcm(700)); await h.tick();                                // 1100 ms ≥ maxSegMs → closed with a full decode
  assert.strictEqual(fake.calls[fake.calls.length - 1].final, true);
  assert.strictEqual(fake.calls[fake.calls.length - 2].lang, 'auto');
  h.push('v1', pcm(300)); await h.tick();
  assert.strictEqual(fake.calls[fake.calls.length - 1].lang, 'hu', 'locked after the first second');
  const f = await h.stop('v1');
  assert.strictEqual(f.text, 'egy kettő három négy öt hat hét egy kettő három négy öt hat hét');
  await h.close();
});

test('whisper-server adapter: missing files refused; a stub server gets the multipart fields; replies parsed', async () => {
  const none = createWhisperServer({ exe: '/no/such.exe', model: '/no/model.bin', spawn: () => { throw new Error('must not spawn'); } });
  assert.strictEqual((await none.load()).err, 'missing');
  let seen = null;
  const stub = http.createServer((req, res) => {
    if (req.url === '/health') { res.end('{"status":"ok"}'); return; }
    let b = []; req.on('data', d => b.push(d)); req.on('end', () => { seen = Buffer.concat(b).toString('latin1'); res.end(JSON.stringify({ language: 'hungarian', text: ' Szia  VRG ' })); });
  });
  await new Promise(r => stub.listen(0, '127.0.0.1', r));
  const port = stub.address().port;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vrg-voice-'));
  const exe = path.join(tmp, 'whisper-server.exe'), model = path.join(tmp, 'm.bin');
  fs.writeFileSync(exe, ''); fs.writeFileSync(model, '');
  const spawned = [];
  const fakeProc = { stderr: null, on() {}, kill() { this.killed = true; } };
  const a = createWhisperServer({ exe, model, threads: 3, freePort: async () => port, spawn: (e, args, o) => { spawned.push({ e, args, o }); return fakeProc; } });
  assert.deepStrictEqual(await a.load(), { ok: true });
  assert.deepStrictEqual(spawned[0].args, ['-m', model, '--host', '127.0.0.1', '--port', String(port), '-t', '3', '-nt', '-nlp']);
  assert.strictEqual(spawned[0].o.windowsHide, true); assert.ok(!spawned[0].o.shell);
  const r = await a.transcribe(pcm(300), { lang: 'hu', prompt: 'VRG, Rétegverem' });
  assert.deepStrictEqual(r, { text: 'Szia VRG', lang: 'hu' });
  for (const f of ['name="language"\r\n\r\nhu', 'name="response_format"\r\n\r\nverbose_json', 'name="temperature_inc"\r\n\r\n0.0', 'name="file"; filename="a.wav"']) assert.ok(seen.includes(f), f);
  assert.ok(Buffer.from(seen, 'latin1').toString('utf8').includes('VRG, Rétegverem'));
  await a.close(); assert.ok(fakeProc.killed);
  stub.close();
  assert.throws(() => parseReply('{"error":"bad"}'), /bad/);
  assert.strictEqual(parseReply('plain text').text, 'plain text');
  assert.ok(multipart({ a: '1', b: '' }, Buffer.from('x')).body.toString().indexOf('name="b"') < 0);
});

test('vocabulary: our names first, unique, under the limit; command phrases after the names; no job codes unless asked', () => {
  const idx = { codephrases: [{ phrase: 'GO MOBILE' }], entities: [{ kind: 'catalog', title: 'Rétegverem' }, { kind: 'catalog', title: 'rétegverem' }, { kind: 'tool', title: 'Kódváros' }], jobs: ['AB12'] };
  const v = buildVocab({ repo: REPO, index: idx, maxChars: 2000 });
  assert.strictEqual(v.words[0], 'VRG');
  assert.ok(v.words.includes('GO MOBILE') && v.words.includes('Rétegverem') && !v.words.includes('rétegverem'));
  assert.ok(!v.words.includes('AB12'));
  assert.ok(buildVocab({ repo: REPO, index: idx, maxChars: 2000, withJobs: true }).words.includes('AB12'));
  assert.ok(v.words.indexOf('Rétegverem') < v.words.indexOf('Kódváros'));
  assert.ok(buildVocab({ repo: REPO, index: idx, maxChars: 60 }).prompt.length <= 60);
  assert.deepStrictEqual(assemble(['a,b', '  x  y ', 'X Y', '123', 'z'.repeat(41)], 100).words, ['a b', 'x y']);
  const real = buildVocab({ repo: REPO, maxChars: 600 });           // the real index of this repo
  assert.ok(real.prompt.length <= 600 && real.words.length > 20, JSON.stringify(real.stats));
});
