// host.js — the engine host: push-to-talk sessions over one engine adapter (whisper-server, or fake in tests). Runs in Electron main.
//   const h = createHost({ adapter, stepMs?, minMs?, maxSegMs?, auto?, now?, log? });
//   h.start(id, { lang:'auto'|'hu'|'en', prompt, mode }) · h.push(id, pcm16 Buffer) · await h.stop(id) → { text, lang, ms } · h.cancel(id)
//   h.on('partial' | 'final' | 'error', cb(data)) · h.tick() (one pseudo-streaming step; `auto` runs it every stepMs)
// Pseudo-streaming: while the key is held, every stepMs (once minMs of audio is in, and only when the engine is idle — never a queue)
// the WHOLE buffer of the current segment is decoded again; the stable-prefix rule (stable.js) turns the hypotheses into committed +
// tentative words. A segment longer than maxSegMs (Whisper's window is 30 s) is closed with a full decode and a new one starts, its text
// kept. Language 'auto' is detected on the first decode of ≥ 1 s and then kept for the session (no flipping between hu and en mid-word).
// Audio lives only in memory and is dropped at stop / cancel; no text is logged (lengths and timings only).
'use strict';
const { createStable } = require('./stable.js');
const { msOf } = require('./wav.js');

const MAX_SESSION_BYTES = 16000 * 2 * 300;                 // 5 minutes of 16 kHz PCM16: a held key is not a recorder

function createHost({ adapter, stepMs = 400, minMs = 300, maxSegMs = 25000, auto = true, now = () => Date.now(), log = () => {} } = {}) {
  const sessions = new Map(), subs = { partial: [], final: [], error: [] };
  const emit = (t, d) => { for (const f of subs[t] || []) { try { f(d); } catch (e) {} } };
  let timer = null, busy = false;

  function start(id, { lang = 'auto', prompt = '', mode = 'dictate' } = {}) {
    if (sessions.has(id)) return false;
    sessions.set(id, { id, mode, lang, prompt, chunks: [], bytes: 0, total: 0, done: [], stable: createStable(), lastLen: 0, t0: now(), firstPartialMs: 0, stopped: false });
    if (auto && !timer) timer = setInterval(() => { tick(); }, stepMs);
    return true;
  }
  function push(id, pcm) {
    const s = sessions.get(id);
    if (!s || s.stopped || !pcm || !pcm.length) return false;
    if (s.total + pcm.length > MAX_SESSION_BYTES) return false;
    s.chunks.push(Buffer.from(pcm)); s.bytes += pcm.length; s.total += pcm.length;
    return true;
  }
  const audioOf = s => (s.chunks.length === 1 ? s.chunks[0] : (s.chunks = [Buffer.concat(s.chunks)])[0]);
  const lineOf = (s, cur) => s.done.concat(cur ? [cur] : []).join(' ').replace(/\s+/g, ' ').trim();
  const decodeLang = s => (s.lang === 'auto' ? 'auto' : s.lang);

  // one step: the first live session with new audio gets a decode
  async function tick() {
    if (busy) return;
    const s = [...sessions.values()].find(x => !x.stopped && x.bytes !== x.lastLen && msOf(x.bytes) >= minMs);
    if (!s) { if (timer && !sessions.size) { clearInterval(timer); timer = null; } return; }
    busy = true;
    try {
      const pcm = audioOf(s);
      s.lastLen = s.bytes;
      const r = await adapter.transcribe(pcm, { lang: decodeLang(s), prompt: s.prompt, final: false });
      if (s.stopped || !sessions.has(s.id)) return;
      if (s.lang === 'auto' && r.lang && msOf(pcm.length) >= 1000) s.lang = r.lang;
      if (msOf(s.bytes) >= maxSegMs) {                       // close the segment: a full decode, its text kept, a fresh buffer
        const f = await adapter.transcribe(audioOf(s), { lang: decodeLang(s), prompt: s.prompt, final: true });
        s.done.push(f.text); s.chunks = []; s.bytes = 0; s.lastLen = 0; s.stable.reset();
        emit('partial', { id: s.id, mode: s.mode, text: lineOf(s, '') });
        return;
      }
      const st = s.stable.push(r.text);
      if (!s.firstPartialMs && st.text) s.firstPartialMs = now() - s.t0;
      emit('partial', { id: s.id, mode: s.mode, text: lineOf(s, st.text), committed: lineOf(s, st.committed) });
    } catch (e) {
      log('voice', 'decode failed', String(e && e.message || e).slice(0, 160));
      emit('error', { id: s.id, mode: s.mode, hu: 'A felismerés hibára futott.' });
    } finally { busy = false; }
  }

  async function stop(id) {
    const s = sessions.get(id);
    if (!s) return { ok: false, err: 'not-found', hu: 'Nincs ilyen felvétel.' };
    s.stopped = true;
    while (busy) await new Promise(r => setTimeout(r, 10));
    let text = lineOf(s, '');
    try {
      if (s.bytes > 0 && msOf(s.bytes) >= 150) {
        const f = await adapter.transcribe(audioOf(s), { lang: decodeLang(s), prompt: s.prompt, final: true });
        if (s.lang === 'auto' && f.lang) s.lang = f.lang;
        text = lineOf(s, f.text);
      }
    } catch (e) {
      log('voice', 'final decode failed', String(e && e.message || e).slice(0, 160));
      sessions.delete(id);
      emit('error', { id, mode: s.mode, hu: 'A felismerés hibára futott.' });
      return { ok: false, err: 'error', hu: 'A felismerés hibára futott.' };
    }
    sessions.delete(id);
    const out = { id, mode: s.mode, text, lang: s.lang === 'auto' ? '' : s.lang, ms: now() - s.t0, audioMs: msOf(s.total), firstPartialMs: s.firstPartialMs };
    log('voice', 'final', s.mode, 'chars', text.length, 'audio', out.audioMs, 'ms', out.ms);
    emit('final', out);
    return out;
  }
  function cancel(id) { const s = sessions.get(id); if (!s) return false; s.stopped = true; sessions.delete(id); return true; }
  function on(t, f) { (subs[t] = subs[t] || []).push(f); return () => { subs[t] = subs[t].filter(x => x !== f); }; }
  async function close() { if (timer) clearInterval(timer); timer = null; sessions.clear(); if (adapter.close) await adapter.close(); }

  return { start, push, stop, cancel, tick, on, close, active: () => [...sessions.keys()] };
}

module.exports = { createHost, MAX_SESSION_BYTES };
