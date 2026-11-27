// WP-59 Hangazonosítás: Voice/identity/identity.js on a fake sherpa-onnx addon whose "embedding" follows the pitch of a test tone, so
// same-speaker and other-speaker scores are controlled; the store round-trip (embeddings only, never audio); the trim and the checks;
// thresholds; unavailability; calibrate.js's helpers. A real-model test runs only with VRG_IDENTITY_REAL (a Full folder holding
// tools/voice/tts/node and tools/voice/identity) and VRG_IDENTITY_WAVS (owner-*.wav / other-*.wav, or anna-/berta-/imre- WAVs).
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path'), os = require('os');
const I = require('../identity.js');
const C = require('../calibrate.js');

const RATE = 16000;
// a "speaker" = a tone of pitch f inside silence: lead / tone / tail seconds, as Int16Array
function utter(f, { lead = 0.4, tone = 2.2, tail = 0.4, amp = 0.4, noise = 0.0005 } = {}) {
  const n = Math.round((lead + tone + tail) * RATE), out = new Int16Array(n);
  let seed = Math.round(f * 7) + 1;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff - 0.5; };
  for (let i = 0; i < n; i++) {
    const t = i / RATE, on = t >= lead && t < lead + tone;
    const v = (on ? amp * Math.sin(2 * Math.PI * f * t) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 3 * t)) : 0) + noise * rnd();
    out[i] = Math.round(Math.max(-1, Math.min(1, v)) * 32767);
  }
  return out;
}
// the fake addon: the embedding is a smooth function of the zero-crossing pitch, so 200 Hz ≈ 205 Hz and 200 Hz ≠ 400 Hz
function fakeAddon(log = []) {
  class OnlineStream { constructor() { this.s = []; } acceptWaveform({ sampleRate, samples }) { assert.strictEqual(sampleRate, RATE); this.s.push(Float32Array.from(samples)); } inputFinished() {} }
  class SpeakerEmbeddingExtractor {
    constructor(cfg) { log.push('model:' + path.basename(cfg.model)); this.dim = 8; }
    createStream() { return new OnlineStream(); }
    isReady(st) { return st.s.reduce((a, b) => a + b.length, 0) >= RATE * 0.5; }
    compute(st) {
      const all = Float32Array.from(st.s.flatMap(x => Array.from(x)));
      let z = 0; for (let i = 1; i < all.length; i++) if ((all[i - 1] < 0) !== (all[i] < 0) && Math.abs(all[i]) > 0.01) z++;
      const f = z / 2 / (all.length / RATE);                               // pitch from zero crossings of the voiced part
      const e = new Float32Array(8);
      for (let k = 0; k < 8; k++) e[k] = Math.cos((f / 60) * (k + 1) * 0.35 + k);
      return e;
    }
  }
  return { SpeakerEmbeddingExtractor };
}
const tmpModel = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'vrg-id-')); const p = path.join(d, '3dspeaker_speech_campplus_sv_en_voxceleb_16k.onnx'); fs.writeFileSync(p, 'x'); return p; };
const memStore = () => { const m = { b: null, sets: 0 }; return { m, store: { get: () => m.b, set: b => { m.b = b; m.sets++; } } }; };

test('cosine, normalisation, mean; PCM conversions', () => {
  assert.strictEqual(I.cosine([1, 0], [1, 0]), 1);
  assert.strictEqual(I.cosine([1, 0], [0, 1]), 0);
  assert.strictEqual(I.cosine([1, 0], [1]), 0);
  assert.ok(Math.abs(I.cosine([3, 4], [6, 8]) - 1) < 1e-9);
  const n = I.l2norm(new Float32Array([3, 4]));
  assert.ok(Math.abs(n[0] - 0.6) < 1e-6 && Math.abs(n[1] - 0.8) < 1e-6);
  const m = I.meanOf([new Float32Array([1, 0]), new Float32Array([0, 10])]);
  assert.ok(Math.abs(m[0] - m[1]) < 1e-6, 'each embedding counts once, whatever its length');
  const i16 = Int16Array.from([0, 16384, -32768]);
  assert.deepStrictEqual(Array.from(I.toFloat(i16)), [0, 0.5, -1]);
  const buf = Buffer.alloc(6); buf.writeInt16LE(0, 0); buf.writeInt16LE(16384, 2); buf.writeInt16LE(-32768, 4);
  assert.deepStrictEqual(Array.from(I.toFloat(buf)), [0, 0.5, -1]);
  const f = new Float32Array([0.25]);
  assert.strictEqual(I.toFloat(f), f);
});

test('the trim and the checks: silence and short speech are too short, steady noise is noisy, speech is trimmed', () => {
  assert.strictEqual(I.prepare(new Int16Array(RATE * 3)).err, 'too-short');
  assert.strictEqual(I.prepare(utter(200, { tone: 1.0 })).err, 'too-short');
  const noise = new Int16Array(RATE * 3); let s = 7;
  for (let i = 0; i < noise.length; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; noise[i] = Math.round((s / 0x7fffffff - 0.5) * 8000); }
  assert.strictEqual(I.prepare(noise).err, 'noisy');
  assert.ok(I.prepare(utter(200, { noise: 0.04 })).ok, 'speech over moderate background noise is fine');
  assert.strictEqual(I.prepare(utter(200, { amp: 0.05, noise: 0.12 })).err, 'noisy', 'speech buried in noise');
  const p = I.prepare(utter(200, { lead: 1.0, tone: 2.0, tail: 1.0 }));
  assert.ok(p.ok, JSON.stringify(p.info));
  const secs = p.samples.length / RATE;
  assert.ok(secs > 1.9 && secs < 2.5, 'trimmed to the speech ±100 ms: ' + secs);
  assert.ok(p.info.voicedSeconds >= I.MIN_SECONDS);
});

test('enrolment: 3 samples, an inconsistent one refused; verify matches the owner and not another voice', async () => {
  const { m, store } = memStore();
  const id = I.createIdentity({ loadAddon: () => fakeAddon(), modelPath: tmpModel(), store });
  let st = await id.status();
  assert.deepStrictEqual([st.ok, st.ready, st.enrolled, st.need, st.threshold], [true, true, 0, 3, 0.5]);
  assert.strictEqual((await id.verify(utter(200))).err, 'not-enrolled');
  assert.deepStrictEqual(await id.enroll(utter(200)), { ok: true, enrolled: 1, need: 2 });
  const bad = await id.enroll(utter(420));
  assert.strictEqual(bad.err, 'inconsistent');
  assert.match(bad.hu, /eltér/);
  assert.deepStrictEqual(await id.enroll(utter(203)), { ok: true, enrolled: 2, need: 1 });
  assert.strictEqual((await id.verify(utter(201))).err, 'not-enrolled', 'verify needs all 3');
  assert.deepStrictEqual(await id.enroll(utter(198)), { ok: true, enrolled: 3, need: 0 });
  const me = await id.verify(utter(202));
  assert.ok(me.ok && me.match && me.score > 0.9, JSON.stringify(me));
  const other = await id.verify(utter(400));
  assert.ok(other.ok && !other.match && other.score < 0.5, JSON.stringify(other));
  assert.strictEqual((await id.verify(utter(200, { tone: 0.8 }))).err, 'too-short');
  assert.ok(m.sets >= 3);
});

test('the store: versioned JSON of embeddings only (small, no audio); a new instance reads it; corrupt or foreign data is ignored', async () => {
  const { m, store } = memStore();
  const model = tmpModel();
  const a = I.createIdentity({ loadAddon: () => fakeAddon(), modelPath: model, store });
  for (const f of [200, 202, 199]) await a.enroll(utter(f));
  const j = JSON.parse(m.b.toString('utf8'));
  assert.deepStrictEqual([j.v, j.kind, j.model, j.dim, j.samples.length, j.samples[0].length], [1, 'vrg-voice-identity', path.basename(model), 8, 3, 8]);
  assert.ok(m.b.length < 1500, 'no audio in the store: ' + m.b.length + ' bytes');
  assert.ok(!('pcm' in j) && !('audio' in j));
  const b = I.createIdentity({ loadAddon: () => fakeAddon(), modelPath: model, store });
  assert.strictEqual((await b.status()).enrolled, 3);
  assert.ok((await b.verify(utter(201))).match);
  for (const junk of [Buffer.from('nope'), Buffer.from(JSON.stringify({ v: 2, kind: 'vrg-voice-identity', dim: 8, samples: [] })), Buffer.from('{"kind":"other"}')]) {
    const c = I.createIdentity({ loadAddon: () => fakeAddon(), modelPath: model, store: { get: () => junk, set: () => {} } });
    assert.strictEqual((await c.status()).enrolled, 0);
  }
  // another model: the stored embeddings are not comparable
  const other = path.join(path.dirname(model), 'wespeaker_en_voxceleb_resnet34.onnx'); fs.writeFileSync(other, 'x');
  const d = I.createIdentity({ loadAddon: () => fakeAddon(), modelPath: other, store });
  const st = await d.status();
  assert.deepStrictEqual([st.enrolled, st.need, st.threshold], [0, 3, 0.7]);
  assert.match(st.reason, /újra be kell tanítani/);
  assert.strictEqual((await d.verify(utter(200))).err, 'not-enrolled');
});

test('reset, threshold bounds and persistence', async () => {
  const { m, store } = memStore();
  const model = tmpModel();
  const id = I.createIdentity({ loadAddon: () => fakeAddon(), modelPath: model, store });
  for (const f of [200, 202, 199]) await id.enroll(utter(f));
  assert.strictEqual(id.setThreshold(0.2).err, 'bad-threshold');
  assert.strictEqual(id.setThreshold(0.95).err, 'bad-threshold');
  assert.strictEqual(id.setThreshold('x').err, 'bad-threshold');
  assert.deepStrictEqual(id.setThreshold(0.62), { ok: true, threshold: 0.62 });
  assert.strictEqual(JSON.parse(m.b.toString()).threshold, 0.62);
  assert.strictEqual((await I.createIdentity({ loadAddon: () => fakeAddon(), modelPath: model, store }).status()).threshold, 0.62);
  assert.strictEqual((await id.verify(utter(201))).threshold, 0.62);
  assert.deepStrictEqual(id.reset(), { ok: true });
  assert.strictEqual(m.b, null);
  const st = await id.status();
  assert.deepStrictEqual([st.enrolled, st.need, st.threshold], [0, 3, 0.5]);
});

test('unavailable: no addon, an addon that throws, no model file', async () => {
  const { store } = memStore();
  for (const [loadAddon, modelPath] of [[() => null, tmpModel()], [() => { throw new Error('no sherpa'); }, tmpModel()], [() => fakeAddon(), '/nope/model.onnx'], [() => fakeAddon(), '']]) {
    const id = I.createIdentity({ loadAddon, modelPath, store });
    const st = await id.status();
    assert.deepStrictEqual([st.ok, st.ready], [true, false]);
    assert.match(st.reason, /nem érhető el/);
    assert.strictEqual((await id.enroll(utter(200))).err, 'unavailable');
  }
  assert.match((await I.createIdentity({ loadAddon: () => { throw new Error('no sherpa'); }, modelPath: tmpModel(), store }).status()).reason, /no sherpa/);
});

test('calibrate.js: WAV reading, resampling, the threshold at a false-accept rate', () => {
  const rate = 22050, n = 2205, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(i === 0 ? 16384 : 0, 44 + i * 2);
  const w = C.readWav(b);
  assert.deepStrictEqual([w.rate, w.samples.length, w.samples[0]], [22050, 2205, 0.5]);
  assert.strictEqual(C.resample(w.samples, 22050).length, 1600);
  assert.throws(() => C.readWav(Buffer.from('not a wav')), /not a WAV/);
  const s = C.suggestThreshold([0.7, 0.8, 0.75, 0.65], [0.1, 0.2, 0.35], 0);
  assert.deepStrictEqual([s.threshold, s.far, s.frr], [0.351, 0, 0]);
  const t = C.suggestThreshold([0.7, 0.8], [0.1, 0.5, 0.6, 0.2], 0.25);
  assert.strictEqual(t.far <= 0.25, true);
  assert.strictEqual(C.suggestThreshold([0.5], [0.95], 0).threshold, I.THRESHOLD_MAX);   // never above the allowed range
  assert.deepStrictEqual(C.stats([]), { n: 0 });
});

const REAL = process.env.VRG_IDENTITY_REAL, WAVS = process.env.VRG_IDENTITY_WAVS;
test('real model: the owner scores above every other voice (needs VRG_IDENTITY_REAL and VRG_IDENTITY_WAVS)', { skip: !(REAL && WAVS && fs.existsSync(REAL) && fs.existsSync(WAVS)) }, async () => {
  const inst = JSON.parse(fs.readFileSync(path.join(REAL, 'tools', 'voice', 'identity', 'installed.json'), 'utf8'));
  const { store } = memStore();
  const id = I.createIdentity({ loadAddon: () => require(path.join(REAL, 'tools', 'voice', 'tts', 'node', 'node_modules', 'sherpa-onnx-node')), modelPath: path.join(REAL, 'tools', 'voice', 'identity', inst.model), store });
  const files = fs.readdirSync(WAVS).filter(f => f.endsWith('.wav')).sort();
  const own = files.filter(f => /^(owner|anna)-/.test(f)).map(f => path.join(WAVS, f)), others = files.filter(f => !/^(owner|anna)-/.test(f)).map(f => path.join(WAVS, f));
  const r = await C.scoreFiles({ identity: id, owner: own, others, enrol: 3, load: f => fs.readFileSync(f) });
  assert.strictEqual(r.enrolled, 3);
  assert.ok(Math.min(...r.genuine) > Math.max(...r.impostor), JSON.stringify(r));
});
