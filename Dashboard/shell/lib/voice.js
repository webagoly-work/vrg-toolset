// voice.js — Diktálás (WP-54): push-to-talk speech-to-text inside the VRG Asztal. Main owns the engine (Voice/engine: whisper.cpp's
// whisper-server with the model resident, or the fake engine in tests); the page owns the microphone and only sends 16 kHz PCM16 chunks.
//   const v = createVoice({ repo, full, settings: { get, set }, emit, spawn, log, env });
//   v.status() → { ok, enabled, ready, engine, model, lang, key, hu? }      v.enable(on) → status (on: the engine is loaded and kept)
//   v.start({ mode, lang? }) → { id } · v.chunk({ id, data }) (base64 PCM16 LE, ≤ 64 KB) · v.stop({ id }) → { text, lang, ms } · v.cancel({ id })
// Events (emit('voice', type, data)): partial { id, mode, text } · final { id, mode, text, lang, ms } · error { id, mode, hu }.
// Rules: audio stays in memory and is dropped at stop / cancel (never written unless the setting voice.keepAudio is on — not used yet);
// the text goes only back to the page that asked; no transcript is logged (lengths and timings only); one recording at a time.
// VRG_VOICE_ENGINE=fake (tests and the selftest only, CONTRACT §4.9) uses the deterministic fake engine.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');

const SESSION_RE = /^v[0-9]{1,6}$/;
const MAX_CHUNK = 64 * 1024;

function createVoice({ repo, full, settings, emit = () => {}, spawn, log = () => {}, env = process.env } = {}) {
  let tap = null, last = null;                                       // WP-59: see takeAudio()
  const V = name => require(path.join(repo, 'Voice', ...name.split('/')));
  const get = (k, d) => { try { return settings.get(k); } catch (e) { return d; } };
  let host = null, adapter = null, seq = 0, current = '', vocab = null, loadState = { ok: false, hu: 'Nincs betöltve.' };

  // where fetch.js put the engine and the models (<Full>/tools/voice/installed.json)
  function installed() {
    const root = path.join(full, 'tools', 'voice');
    let inst = null; try { inst = JSON.parse(fs.readFileSync(path.join(root, 'installed.json'), 'utf8')); } catch (e) {}
    const model = get('voice.model', 'turbo');
    const m = inst && inst.models && (inst.models[model] || Object.values(inst.models)[0]);
    return { exe: inst && inst.engine ? path.join(root, inst.engine.exe) : '', model: m ? path.join(root, m.file) : '', modelId: m ? (inst.models[model] ? model : Object.keys(inst.models)[0]) : '' };
  }
  function makeAdapter() {
    if (env.VRG_VOICE_ENGINE === 'fake') return V('engine/fake.js').createFake({ msPerWord: Number(env.VRG_VOICE_FAKE_MSPW) || 250 });
    const i = installed();
    return V('engine/whisper-server.js').createWhisperServer({ exe: i.exe, model: i.model, threads: Math.max(2, Math.min(8, (os.cpus() || []).length - 1)), spawn, log });
  }
  function vocabPrompt() {
    if (vocab !== null) return vocab;
    try { vocab = V('vocab/build.js').buildVocab({ repo, full, withJobs: true }).prompt; } catch (e) { vocab = ''; }
    return vocab;
  }
  function ensureHost() {
    if (host) return host;
    adapter = makeAdapter();
    host = V('engine/host.js').createHost({ adapter, log });
    host.on('partial', d => { if (d.id === current) emit('partial', { id: d.id, mode: d.mode, text: d.text }); });
    host.on('error', d => emit('error', d));
    return host;
  }
  async function warm() {
    ensureHost();
    loadState = await adapter.load();
    return loadState;
  }

  function status() {
    const enabled = get('voice.enabled', false) === true;
    const fake = env.VRG_VOICE_ENGINE === 'fake';
    const i = fake ? { modelId: 'fake' } : installed();
    const ready = !!(adapter && adapter.ready && adapter.ready());
    const hu = ready ? '' : !fake && !i.exe ? 'Nincs letöltve a beszédmotor: node Voice/fetch.js' : !fake && !i.model ? 'Nincs letöltve a beszédmodell: node Voice/fetch.js' : (loadState && loadState.hu) || '';
    return { ok: true, enabled, ready, engine: fake ? 'fake' : 'whisper.cpp', model: i.modelId || '', lang: get('voice.lang', 'auto'), key: get('voice.key', 'F9'), ...(hu ? { hu } : {}) };
  }
  async function enable(on) {
    try { settings.set('voice.enabled', on === true); } catch (e) {}
    if (on === true) await warm(); else if (host) { await host.close(); host = null; adapter = null; loadState = { ok: false, hu: 'Kikapcsolva.' }; }
    return status();
  }

  async function start({ mode, lang } = {}) {
    if (get('voice.enabled', false) !== true) return { ok: false, err: 'off', hu: 'A diktálás ki van kapcsolva.' };
    const h = ensureHost();
    if (!adapter.ready()) { const l = await warm(); if (!l.ok) return { ok: false, err: 'not-ready', hu: l.hu || 'A beszédmotor nem áll készen.' }; }
    if (current) { h.cancel(current); current = ''; }            // one recording at a time: a new key press wins
    const id = 'v' + (++seq % 1e6);
    const lg = lang === 'hu' || lang === 'en' ? lang : get('voice.lang', 'auto');
    h.start(id, { mode: mode === 'command' ? 'command' : 'dictate', lang: lg, prompt: vocabPrompt() });
    current = id;
    tap = mode === 'command' ? { id, bufs: [], bytes: 0 } : null;          // WP-59: a command's audio, kept in memory for the speaker check only
    return { id };
  }
  function chunk({ id, data } = {}) {
    if (!host || id !== current) return { ok: false, err: 'not-found', hu: 'Nincs ilyen felvétel.' };
    const buf = Buffer.from(String(data || ''), 'base64');
    if (!buf.length || buf.length > MAX_CHUNK || buf.length % 2) return { ok: false, err: 'bad-request', hu: 'Érvénytelen hangdarab.' };
    if (tap && tap.id === id && tap.bytes + buf.length <= MAX_TAP) { tap.bufs.push(Buffer.from(buf)); tap.bytes += buf.length; }
    return host.push(id, buf) ? {} : { ok: false, err: 'full', hu: 'A felvétel túl hosszú.' };
  }
  async function stop({ id } = {}) {
    if (!host || id !== current) return { ok: false, err: 'not-found', hu: 'Nincs ilyen felvétel.' };
    current = '';
    if (tap && tap.id === id) { last = { id, buf: Buffer.concat(tap.bufs), at: Date.now() }; tap = null; }
    const r = await host.stop(id);
    if (r && r.ok !== false) emit('final', { id, mode: r.mode, text: r.text, lang: r.lang, ms: r.ms });
    return r && r.ok === false ? r : { id, text: r.text, lang: r.lang, ms: r.ms, audioMs: r.audioMs, firstPartialMs: r.firstPartialMs };
  }
  function cancel({ id } = {}) {
    if (!host || id !== current) return { ok: false, err: 'not-found', hu: 'Nincs ilyen felvétel.' };
    current = ''; host.cancel(id); tap = null;
    return {};
  }
  async function close() { if (host) await host.close(); host = null; adapter = null; }

  // the last command's audio (16 kHz PCM16), once, within TAP_MS of its end; never written anywhere, dropped when taken or stale
  function takeAudio() { const l = last; last = null; return l && Date.now() - l.at < TAP_MS && l.buf.length ? l.buf : null; }
  return { takeAudio, status, enable, warm, start, chunk, stop, cancel, close, rebuildVocab: () => { vocab = null; return vocabPrompt().length; } };
}

const MAX_TAP = 12 * 16000 * 2, TAP_MS = 30000;                   // ≤ 12 s of a command's audio, for ≤ 30 s
module.exports = { createVoice, SESSION_RE, MAX_CHUNK, MAX_TAP, TAP_MS };
