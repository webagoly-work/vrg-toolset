// fake.js — a deterministic stand-in engine for tests and the selftest (VRG_VOICE_ENGINE=fake). It "hears" a fixed script: after
// `msPerWord` of audio one more word of it, and the whole script on the final decode. No model, no process, no network.
//   const a = createFake({ script?, msPerWord?, lang?, delayMs? }); await a.load(); await a.transcribe(pcmBuffer, { final, lang, prompt })
'use strict';
const { msOf } = require('./wav.js');

function createFake({ script, msPerWord = 250, lang = 'hu', delayMs = 0 } = {}) {
  const text = () => String(script || process.env.VRG_VOICE_FAKE_TEXT || 'Szia VRG, nyisd meg a Plannert').trim();
  const calls = [];
  const wait = ms => (ms > 0 ? new Promise(r => setTimeout(r, ms)) : Promise.resolve());
  return {
    name: 'fake',
    calls,
    async load() { return { ok: true }; },
    ready: () => true,
    async transcribe(pcm, o = {}) {
      calls.push({ bytes: pcm.length, final: !!o.final, lang: o.lang || '', prompt: o.prompt || '' });
      await wait(delayMs);
      const w = text().split(/\s+/);
      const n = o.final ? w.length : Math.min(w.length, Math.floor(msOf(pcm.length) / msPerWord));
      return { text: w.slice(0, n).join(' '), lang: o.lang && o.lang !== 'auto' ? o.lang : lang };
    },
    async close() {},
  };
}

module.exports = { createFake };
