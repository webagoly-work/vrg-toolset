// identity.js — Hangazonosítás (WP-59): offline speaker verification, a CONVENIENCE factor for the Dev level only.
//   const { createIdentity, cosine, MIN_SECONDS } = require('<repo>/Voice/identity/identity.js');
//   const id = createIdentity({ loadAddon, modelPath, store: { get, set }, log?, threads?, threshold? });
//   await id.status()        → { ok, ready, enrolled, need, threshold, model?, reason? }
//   await id.enroll(pcm16)   → { ok:true, enrolled, need } | { ok:false, err:'too-short'|'unavailable'|'noisy'|'inconsistent', hu }
//   await id.verify(pcm16)   → { ok:true, score, match, threshold, ms } | { ok:false, err:'not-enrolled'|'too-short'|'unavailable'|'noisy', hu }
//   id.reset()               forget the voice (store.set(null))
//   id.setThreshold(x)       x within [0.3, 0.9] → { ok:true, threshold } | { ok:false, err:'bad-threshold', hu }
// pcm16 = Int16Array or a Buffer of little-endian int16, 16 kHz mono (what WP-54's page already sends); a Float32Array in [-1, 1] is
// accepted too. The embedding comes from sherpa-onnx-node's SpeakerEmbeddingExtractor (the same 1.13.8 addon Voice/tts fetches) and the
// model under <Full>/tools/voice/identity/ (Voice/identity/fetch-identity.js).
// What it is NOT: an authorisation. A match may replace the confirm click for reversible / confirm-class actions at the Dev level; the All
// level always needs a keypress or PIN, and blocked actions stay blocked. Replay (a recording of the owner) and synthetic voices (TTS
// cloning) are not detected — the README says so, and so must the UI.
// Privacy: the store gets ONLY embeddings (a few hundred numbers each, rounded) + metadata, never audio; audio stays in memory and is
// dropped after the call. main encrypts the store (Electron safeStorage); this module never touches the disk.
'use strict';
const fs = require('fs'), path = require('path');

const SAMPLE_RATE = 16000;
const MIN_SECONDS = 1.5;                     // of detected speech, after the silence trim
const NEED = 3;                              // enrolment samples before verify works
const MAX_SAMPLES = 10;                      // the newest enrolment embeddings kept (more = a steadier mean)
const VERSION = 1;
const KIND = 'vrg-voice-identity';
const THRESHOLD_MIN = 0.3, THRESHOLD_MAX = 0.9;
// default thresholds per model file (cosine against the enrolment mean); calibrate on the owner's own voice (calibrate.js)
const MODEL_DEFAULTS = {
  '3dspeaker_speech_campplus_sv_en_voxceleb_16k.onnx': 0.5,
  'wespeaker_en_voxceleb_resnet34.onnx': 0.7,                          // its impostor scores run higher (up to 0.69 on synthetic voices here)
  '3dspeaker_speech_eres2net_base_sv_zh-cn_3dspeaker_16k.onnx': 0.55,
};
const DEFAULT_THRESHOLD = 0.5;
const LOUD_MIN = 0.01;                       // −40 dBFS: below this the take is near-silence, not noise
const SNR_MIN_DB = 6;                        // speech spans 20–30 dB between its loud and quiet frames; steady noise ≈ 0–3 dB
const INCONSISTENT_BELOW = 0.25;             // an enrolment sample this unlike the others is refused (another speaker, a bad take)

const HU = {
  unavailable: 'A hangazonosítás nem érhető el (a modell vagy a sherpa-onnx hiányzik).',
  'too-short': 'Túl rövid: legalább ' + MIN_SECONDS.toString().replace('.', ',') + ' másodperc beszéd kell.',
  noisy: 'Túl zajos vagy túl halk; mondd újra, közelebb a mikrofonhoz.',
  'not-enrolled': 'Még nincs betanítva a hangod (3 minta kell).',
  inconsistent: 'Ez a minta nagyon eltér az előzőektől; mondd újra (ugyanaz a személy, csendes helyen).',
  'bad-threshold': 'A küszöb ' + THRESHOLD_MIN + ' és ' + THRESHOLD_MAX + ' között lehet.',
  'model-changed': 'Másik azonosító modell: újra be kell tanítani a hangot.',
};
const fail = err => ({ ok: false, err, hu: HU[err] || err });

// ------------------------------------------------------------ pure helpers
// Int16Array | Buffer (LE int16) | Float32Array | number[] → Float32Array in [-1, 1]
function toFloat(pcm) {
  if (pcm instanceof Float32Array) return pcm;
  let i16;
  if (pcm instanceof Int16Array) i16 = pcm;
  else if (Buffer.isBuffer(pcm) || pcm instanceof Uint8Array) {
    const b = Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength - (pcm.byteLength % 2));
    i16 = new Int16Array(b.byteLength / 2);
    for (let k = 0; k < i16.length; k++) i16[k] = b.readInt16LE(k * 2);
  } else if (Array.isArray(pcm)) i16 = Int16Array.from(pcm);
  else return new Float32Array(0);
  const f = new Float32Array(i16.length);
  for (let k = 0; k < i16.length; k++) f[k] = i16[k] / 32768;
  return f;
}

function l2norm(v) {
  let s = 0;
  for (let k = 0; k < v.length; k++) s += v[k] * v[k];
  const n = Math.sqrt(s) || 1;
  const out = new Float32Array(v.length);
  for (let k = 0; k < v.length; k++) out[k] = v[k] / n;
  return out;
}
function cosine(a, b) {
  if (!a || !b || a.length !== b.length || !a.length) return 0;
  let d = 0, na = 0, nb = 0;
  for (let k = 0; k < a.length; k++) { d += a[k] * b[k]; na += a[k] * a[k]; nb += b[k] * b[k]; }
  return na && nb ? d / Math.sqrt(na * nb) : 0;
}
// the mean direction of several embeddings: each normalised, averaged, normalised again
function meanOf(list) {
  if (!list.length) return null;
  const dim = list[0].length, s = new Float32Array(dim);
  for (const v of list) { const n = l2norm(v); for (let k = 0; k < dim; k++) s[k] += n[k]; }
  return l2norm(s);
}

// energy VAD on 20 ms frames: the stretch from the first to the last voiced frame (+100 ms each side), how much speech it holds, and a
// rough SNR (the loud frames' level against the quiet frames'). Voiced = above max(3 × the noise floor, 5 % of the loudest frame, −50 dBFS).
function analyse(f, rate = SAMPLE_RATE) {
  const frame = Math.round(rate * 0.02), n = Math.floor(f.length / frame);
  if (n < 1) return { start: 0, end: 0, voicedSeconds: 0, snrDb: 0, frames: 0 };
  const rms = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (let k = i * frame; k < (i + 1) * frame; k++) s += f[k] * f[k]; rms[i] = Math.sqrt(s / frame); }
  const sorted = Array.from(rms).sort((a, b) => a - b);
  const q = p => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))))];
  const floor = q(0.1), peak = sorted[sorted.length - 1];
  const thr = Math.max(floor * 3, peak * 0.05, 0.00316);
  let first = -1, last = -1, voiced = 0;
  for (let i = 0; i < n; i++) if (rms[i] > thr) { if (first < 0) first = i; last = i; voiced++; }
  const pad = 5;                                                         // 100 ms
  const start = first < 0 ? 0 : Math.max(0, first - pad) * frame, end = last < 0 ? 0 : Math.min(n, last + 1 + pad) * frame;
  const loud = q(0.9), quiet = Math.max(floor, 1e-5);
  return { start, end, voicedSeconds: voiced * 0.02, snrDb: 20 * Math.log10(Math.max(loud, 1e-5) / quiet), loud, frames: n };
}
// trim + checks → { ok, samples } | { ok:false, err }
function prepare(pcm, rate = SAMPLE_RATE) {
  const f = toFloat(pcm);
  const a = analyse(f, rate);
  // not enough speech stands out: real sound all through with loud ≈ quiet (steady noise, speech buried in it) is "noisy",
  // near-silence or a short take is "too short". (Voiced frames are ≥ 3 × the floor, so a take WITH enough speech is never "noisy".)
  if (a.voicedSeconds < MIN_SECONDS) return { ok: false, err: a.snrDb < SNR_MIN_DB && a.loud > LOUD_MIN ? 'noisy' : 'too-short', info: a };
  return { ok: true, samples: f.subarray(a.start, a.end), info: a };
}

// the store's format: versioned JSON (embeddings only, rounded to 4 decimals) → Buffer, and back (null when absent or not ours)
const round = v => Array.from(v, x => Math.round(x * 10000) / 10000);
function serialise(p) {
  return Buffer.from(JSON.stringify({ v: VERSION, kind: KIND, model: p.model, dim: p.dim, created: p.created, updated: p.updated, threshold: p.threshold, samples: p.samples.map(round) }), 'utf8');
}
function parse(buf) {
  if (!buf || !buf.length) return null;
  let j; try { j = JSON.parse(Buffer.isBuffer(buf) ? buf.toString('utf8') : String(buf)); } catch (e) { return null; }
  if (!j || j.kind !== KIND || j.v !== VERSION || !Array.isArray(j.samples) || !Number.isInteger(j.dim)) return null;
  const samples = j.samples.filter(s => Array.isArray(s) && s.length === j.dim && s.every(Number.isFinite)).slice(-MAX_SAMPLES).map(s => Float32Array.from(s));
  const t = Number(j.threshold);
  return { model: String(j.model || ''), dim: j.dim, created: j.created || '', updated: j.updated || '', threshold: t >= THRESHOLD_MIN && t <= THRESHOLD_MAX ? t : null, samples };
}

// ------------------------------------------------------------ the identity
function createIdentity({ loadAddon, modelPath, store, log = () => {}, threads = 1, threshold } = {}) {
  const modelId = modelPath ? path.basename(String(modelPath)) : '';
  const defaultThreshold = Number.isFinite(threshold) ? threshold : (MODEL_DEFAULTS[modelId] || DEFAULT_THRESHOLD);
  let addon, addonErr = '', extractor = null, profile, loaded = false, thr = null;

  function getAddon() {
    if (addon !== undefined) return addon;
    try { addon = typeof loadAddon === 'function' ? loadAddon() : null; } catch (e) { addon = null; addonErr = String(e && e.message || e).slice(0, 160); }
    return addon;
  }
  function getExtractor() {
    if (extractor) return extractor;
    const A = getAddon();
    if (!A || typeof A.SpeakerEmbeddingExtractor !== 'function') return null;
    if (!modelPath || !fs.existsSync(modelPath)) return null;
    try { extractor = new A.SpeakerEmbeddingExtractor({ model: modelPath, numThreads: threads, debug: false, provider: 'cpu' }); }
    catch (e) { addonErr = String(e && e.message || e).slice(0, 160); log('identity', 'extractor failed', addonErr); extractor = null; }
    return extractor;
  }
  function getProfile() {
    if (loaded) return profile;
    loaded = true;
    let buf = null;
    try { buf = store && store.get ? store.get() : null; } catch (e) { buf = null; }
    profile = parse(buf);
    return profile;
  }
  function save() {
    if (!store || !store.set) return;
    try { store.set(profile ? serialise(profile) : null); } catch (e) { log('identity', 'store failed', e && e.message); }
  }
  const currentThreshold = () => (thr != null ? thr : (getProfile() && getProfile().threshold != null ? getProfile().threshold : defaultThreshold));
  // a stored profile from another model cannot be compared with this one's embeddings
  const usable = p => !!p && p.model === modelId && p.samples.length > 0;

  function embed(samples) {
    const ex = getExtractor();
    if (!ex) return null;
    const s = ex.createStream();
    s.acceptWaveform({ sampleRate: SAMPLE_RATE, samples });
    s.inputFinished();
    if (!ex.isReady(s)) return 'too-short';
    return Float32Array.from(ex.compute(s, false));                    // a copy: no external buffer outlives the stream
  }

  async function status() {
    const ready = !!getExtractor();
    const p = getProfile();
    const enrolled = usable(p) ? p.samples.length : 0;
    const out = { ok: true, ready, enrolled, need: Math.max(0, NEED - enrolled), threshold: currentThreshold(), model: modelId };
    if (!ready) out.reason = HU.unavailable + (addonErr ? ' (' + addonErr + ')' : '');
    else if (p && p.model !== modelId) out.reason = HU['model-changed'];
    return out;
  }

  async function enroll(pcm) {
    const pr = prepare(pcm);
    if (!pr.ok) return fail(pr.err);
    if (!getExtractor()) return fail('unavailable');
    const e = embed(pr.samples);
    if (e === 'too-short') return fail('too-short');
    if (!e) return fail('unavailable');
    let p = getProfile();
    if (!usable(p)) p = profile = { model: modelId, dim: e.length, created: new Date().toISOString(), updated: '', threshold: p && p.model === modelId ? p.threshold : null, samples: [] };
    if (p.samples.length >= 1) {
      const c = cosine(e, meanOf(p.samples));
      if (c < INCONSISTENT_BELOW) return fail('inconsistent');
    }
    p.samples = [...p.samples, e].slice(-MAX_SAMPLES);
    p.updated = new Date().toISOString();
    save();
    return { ok: true, enrolled: p.samples.length, need: Math.max(0, NEED - p.samples.length) };
  }

  async function verify(pcm) {
    const t0 = Date.now();
    const p = getProfile();
    if (!usable(p) || p.samples.length < NEED) return fail('not-enrolled');
    const pr = prepare(pcm);
    if (!pr.ok) return fail(pr.err);
    if (!getExtractor()) return fail('unavailable');
    const e = embed(pr.samples);
    if (e === 'too-short') return fail('too-short');
    if (!e) return fail('unavailable');
    const score = Math.round(cosine(e, meanOf(p.samples)) * 1000) / 1000;
    const threshold = currentThreshold();
    return { ok: true, score, match: score >= threshold, threshold, ms: Date.now() - t0 };
  }

  function reset() { profile = null; loaded = true; thr = null; save(); return { ok: true }; }

  function setThreshold(x) {
    const v = Number(x);
    if (!Number.isFinite(v) || v < THRESHOLD_MIN || v > THRESHOLD_MAX) return fail('bad-threshold');
    thr = Math.round(v * 1000) / 1000;
    const p = getProfile();
    if (usable(p)) { p.threshold = thr; save(); }
    return { ok: true, threshold: thr };
  }

  return { status, enroll, verify, reset, setThreshold, _embed: s => embed(toFloat(s)) };
}

module.exports = {
  createIdentity, cosine, MIN_SECONDS, SAMPLE_RATE, NEED, MAX_SAMPLES, THRESHOLD_MIN, THRESHOLD_MAX, MODEL_DEFAULTS, DEFAULT_THRESHOLD,
  toFloat, l2norm, meanOf, analyse, prepare, serialise, parse, HU, SNR_MIN_DB, INCONSISTENT_BELOW,
};
