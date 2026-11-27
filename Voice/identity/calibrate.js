#!/usr/bin/env node
// calibrate.js — pick the speaker-verification threshold from real recordings (WP-59), for the local session.
//   node Voice/identity/calibrate.js --owner me1.wav me2.wav … --others other1.wav … [--far 0.01] [--enrol 3] [--model <onnx>] [--full <dir>]
// The first --enrol owner files (default 3) are the enrolment; the other owner files are the genuine trials, every --others file an
// impostor trial. Prints the score distributions, the equal-error point, and the threshold at the chosen false-accept rate (--far,
// default 1 %), with the false-reject rate it costs. Nothing is stored: a calibration never touches the real profile.
// WAV: PCM16 / PCM32 / float32, any sample rate (resampled to 16 kHz), stereo mixed down. Record ≥ 10 owner utterances of 2–4 s
// (the authorisation phrase and ordinary commands, at the desk and a bit further away) and a few other people if you can.
'use strict';
const fs = require('fs'), path = require('path');
const I = require('./identity.js');

// a WAV file → { rate, samples: Float32Array mono }
function readWav(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') throw new Error('not a WAV file');
  let off = 12, fmt = null, data = null;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4), size = buf.readUInt32LE(off + 4);
    if (id === 'fmt ') fmt = { format: buf.readUInt16LE(off + 8), channels: buf.readUInt16LE(off + 10), rate: buf.readUInt32LE(off + 12), bits: buf.readUInt16LE(off + 22) };
    else if (id === 'data') { data = buf.subarray(off + 8, Math.min(buf.length, off + 8 + size)); break; }
    off += 8 + size + (size % 2);
  }
  if (!fmt || !data) throw new Error('WAV without fmt or data');
  const fmtTag = fmt.format === 0xfffe ? (fmt.bits === 32 && fmt.format ? 3 : 1) : fmt.format;
  const bps = fmt.bits / 8, frames = Math.floor(data.length / (bps * fmt.channels)), out = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let s = 0;
    for (let c = 0; c < fmt.channels; c++) {
      const o = (i * fmt.channels + c) * bps;
      if (fmtTag === 3 && fmt.bits === 32) s += data.readFloatLE(o);
      else if (fmt.bits === 16) s += data.readInt16LE(o) / 32768;
      else if (fmt.bits === 32) s += data.readInt32LE(o) / 2147483648;
      else if (fmt.bits === 8) s += (data.readUInt8(o) - 128) / 128;
      else throw new Error('unsupported WAV: ' + fmt.bits + ' bit');
    }
    out[i] = s / fmt.channels;
  }
  return { rate: fmt.rate, samples: out };
}
// linear-interpolation resampler (good enough for speaker embeddings; the model only needs 16 kHz)
function resample(f, from, to = I.SAMPLE_RATE) {
  if (from === to) return f;
  const n = Math.floor(f.length * to / from), out = new Float32Array(n), r = from / to;
  for (let i = 0; i < n; i++) { const x = i * r, k = Math.floor(x), t = x - k; out[i] = (f[k] || 0) * (1 - t) + (f[k + 1] || 0) * t; }
  return out;
}
// Float32 → Int16Array (what the identity receives from the page)
function toInt16(f) { const o = new Int16Array(f.length); for (let i = 0; i < f.length; i++) o[i] = Math.max(-32768, Math.min(32767, Math.round(f[i] * 32767))); return o; }

const stats = a => { const s = [...a].sort((x, y) => x - y), q = p => s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))]; return s.length ? { n: s.length, min: s[0], p10: q(0.1), mean: s.reduce((x, y) => x + y, 0) / s.length, p90: q(0.9), max: s[s.length - 1] } : { n: 0 }; };
// the threshold at a false-accept rate: the lowest t with (impostors ≥ t) / n ≤ far, its false-reject rate, and the equal-error point
function suggestThreshold(genuine, impostor, far = 0.01) {
  const g = [...genuine], im = [...impostor];
  const accept = (arr, t) => (arr.length ? arr.filter(x => x >= t).length / arr.length : 0);
  const reject = (arr, t) => (arr.length ? arr.filter(x => x < t).length / arr.length : 0);
  const r3 = x => Math.round(x * 1000) / 1000;
  // candidates: every observed score, and just above every impostor score (so a 0 % target can sit right above the best impostor)
  const cands = [...new Set([...g, ...im, ...im.map(x => x + 0.001)].map(r3))].sort((a, b) => a - b);
  let thr = null;
  for (const t of cands) if (accept(im, t) <= far) { thr = t; break; }
  if (thr === null) thr = I.THRESHOLD_MAX;
  thr = Math.min(I.THRESHOLD_MAX, Math.max(I.THRESHOLD_MIN, thr));
  let eer = null;
  for (const t of cands) { const fa = accept(im, t), fr = reject(g, t), d = Math.abs(fa - fr); if (!eer || d < eer.d) eer = { threshold: t, rate: (fa + fr) / 2, d }; }
  return { threshold: thr, far: accept(im, thr), frr: reject(g, thr), eer: eer && g.length && im.length ? { threshold: eer.threshold, rate: eer.rate } : null };
}

// enrol on the first files, score the rest → { genuine, impostor, enrolled }
async function scoreFiles({ identity, owner, others, enrol = 3, load }) {
  const read = f => { const w = readWav(load(f)); return toInt16(resample(w.samples, w.rate)); };
  identity.reset();
  let enrolled = 0;
  for (const f of owner.slice(0, enrol)) { const r = await identity.enroll(read(f)); if (!r.ok) throw new Error('enrol ' + path.basename(f) + ': ' + r.err); enrolled = r.enrolled; }
  const genuine = [], impostor = [];
  for (const f of owner.slice(enrol)) { const r = await identity.verify(read(f)); if (r.ok) genuine.push(r.score); }
  for (const f of others) { const r = await identity.verify(read(f)); if (r.ok) impostor.push(r.score); }
  return { genuine, impostor, enrolled };
}

module.exports = { readWav, resample, toInt16, stats, suggestThreshold, scoreFiles };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const list = k => { const i = argv.indexOf(k); if (i < 0) return []; const o = []; for (let j = i + 1; j < argv.length && !argv[j].startsWith('--'); j++) o.push(argv[j]); return o; };
  const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  const owner = list('--owner'), others = list('--others'), enrol = Number(opt('--enrol', 3)), far = Number(opt('--far', 0.01));
  if (owner.length < enrol + 1) { console.log('usage: node Voice/identity/calibrate.js --owner a.wav b.wav c.wav d.wav … --others x.wav … [--far 0.01] [--enrol 3] [--model file.onnx] [--full dir]'); process.exit(2); }
  const full = path.resolve(opt('--full', process.env.VRG_FULL || path.dirname(path.resolve(__dirname, '..', '..'))));
  const model = opt('--model', null) || (() => { try { const inst = JSON.parse(fs.readFileSync(path.join(full, 'tools', 'voice', 'identity', 'installed.json'), 'utf8')); return path.join(full, 'tools', 'voice', 'identity', inst.model); } catch (e) { return ''; } })();
  const nodeDir = path.join(full, 'tools', 'voice', 'tts', 'node');
  const mem = { b: null };
  const identity = I.createIdentity({ modelPath: model, loadAddon: () => require(path.join(nodeDir, 'node_modules', 'sherpa-onnx-node')), store: { get: () => mem.b, set: b => { mem.b = b; } } });
  (async () => {
    const st = await identity.status();
    if (!st.ready) { console.log('not ready: ' + (st.reason || '') + '\n  model: ' + (model || '(none — run node Voice/identity/fetch-identity.js)')); process.exit(1); }
    const r = await scoreFiles({ identity, owner, others, enrol, load: f => fs.readFileSync(f) });
    const fmt = s => (s.n ? `n=${s.n} min ${s.min.toFixed(3)} p10 ${s.p10.toFixed(3)} mean ${s.mean.toFixed(3)} p90 ${s.p90.toFixed(3)} max ${s.max.toFixed(3)}` : 'n=0');
    console.log('model     ' + path.basename(model) + '   enrolled ' + r.enrolled);
    console.log('genuine   ' + fmt(stats(r.genuine)));
    console.log('impostor  ' + fmt(stats(r.impostor)));
    const s = suggestThreshold(r.genuine, r.impostor, far);
    if (s.eer) console.log('EER       ≈ ' + (s.eer.rate * 100).toFixed(1) + ' % at ' + s.eer.threshold);
    console.log('threshold ' + s.threshold + '  (false accept ' + (s.far * 100).toFixed(1) + ' %, false reject ' + (s.frr * 100).toFixed(1) + ' %, target FAR ' + far * 100 + ' %)');
    if (!r.impostor.length) console.log('  no impostor recordings: the threshold is a guess. Record a few other people.');
  })().catch(e => { console.error(e.message); process.exit(1); });
}
