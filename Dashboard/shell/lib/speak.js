// speak.js — Hang (WP-57): main's side of the spoken answers, offline. Wraps Voice/tts/tts.js (sherpa-onnx + a Piper voice, or Windows SAPI).
//   const s = createSpeak({ loadTts, enabled, engine, opts, log });
//   s.say({ text, lang? }) → { ok, id, pcm?: { sampleRate, b64 } /* Float32 samples, the page plays them */ } | { ok, played:true } | { ok, web:true, text }
//   s.stop() · s.status() · s.close()
// engine 'web' = the page's own speechSynthesis (the OS voices, offline on Windows): main only makes the text sayable.
// Off unless the setting speak.enabled is on. The answer text is the overlay's short `say`, never what the screen reader read, unless the
// user asked "olvasd fel".
'use strict';

const OFF = { ok: false, err: 'disabled', hu: 'A hangos válasz ki van kapcsolva (Beállítás: speak.enabled).' };
const NONE = { ok: false, err: 'unavailable', hu: 'A beszédmotor nem érhető el (Voice/tts).' };
const MAX_TEXT = 600;

// Float32Array (or a plain array) → base64 of its little-endian bytes: compact over IPC, decoded by the page
function pcmB64(samples) {
  const f = samples instanceof Float32Array ? samples : Float32Array.from(samples || []);
  return Buffer.from(f.buffer, f.byteOffset, f.byteLength).toString('base64');
}

function createSpeak({ loadTts, enabled = () => false, engine = () => 'sherpa', opts = () => ({}), log = () => {} } = {}) {
  let M = null, sp = null, spEngine = '';
  function mod() {
    if (M) return M;
    try { M = typeof loadTts === 'function' ? loadTts() : null; } catch (e) { log('speak', 'load failed', e && e.message); M = null; }
    return M;
  }
  function get() {
    const eng = engine();
    if (eng === 'web' || eng === 'none') return null;
    if (sp && spEngine === eng) return sp;
    if (sp && sp.close) { try { sp.close(); } catch (e) {} }
    sp = null;
    const T = mod();
    if (!T || typeof T.createSpeaker !== 'function') return null;
    try { sp = T.createSpeaker({ ...opts(), engine: eng }); spEngine = eng; } catch (e) { log('speak', 'create failed', e && e.message); sp = null; }
    return sp;
  }
  const sayable = (text, lang) => { const T = mod(); try { return T && T.speakable ? T.speakable(text, lang) : text; } catch (e) { return text; } };
  async function say({ text, lang } = {}) {
    if (typeof text !== 'string' || !text.trim() || text.length > MAX_TEXT) return { ok: false, err: 'bad-request', hu: 'Nincs mit mondani.' };
    if (!enabled()) return OFF;
    const eng = engine();
    if (eng === 'none') return OFF;
    if (eng === 'web') return { ok: true, web: true, text: sayable(text, lang || 'auto') };
    const s = get();
    if (!s) return NONE;
    let r;
    try { r = await s.say(text, { lang: lang || 'auto' }); } catch (e) { log('speak', 'say failed', e && e.message); return { ok: false, err: 'error', hu: 'A beszéd nem sikerült.' }; }
    if (!r || r.ok === false) return r || NONE;
    if (r.pcm && r.pcm.samples) return { ok: true, id: r.id, pcm: { sampleRate: r.pcm.sampleRate, b64: pcmB64(r.pcm.samples) }, ms: r.ms };
    return { ok: true, id: r.id, played: !!r.played };
  }
  function stop() { try { if (sp && sp.stop) sp.stop(); } catch (e) {} return { ok: true }; }
  async function status() {
    const eng = engine();
    if (eng === 'web' || eng === 'none') return { ok: true, enabled: !!enabled(), engine: eng, ready: eng === 'web' };
    const s = get();
    if (!s) return { ok: true, enabled: !!enabled(), engine: eng, ready: false, reason: NONE.hu };
    try { return { ...(await s.status()), enabled: !!enabled(), engine: eng }; } catch (e) { return { ok: true, enabled: !!enabled(), engine: eng, ready: false }; }
  }
  function close() { try { if (sp && sp.close) sp.close(); } catch (e) {} sp = null; }
  return { say, stop, status, close };
}

module.exports = { createSpeak, pcmB64, MAX_TEXT };
