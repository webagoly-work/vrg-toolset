// voice-worklet.js — WP-54 Diktálás: the AudioWorklet that turns the microphone into 16 kHz mono PCM16 frames (20 ms each) and posts
// them to the page (voice.js), which keeps the last ~300 ms in a ring buffer while the key is up (so the first word is never cut) and
// forwards everything to main while it is down. Loaded with audioWorklet.addModule() from the frame's own folder (CSP 'self').
// The resampler is a plain function so node --test can check it (module.exports when `module` exists; the worklet scope has no module).
'use strict';

// Float32 samples at `inRate` → Int16 at 16 kHz. Box-filter decimation (an average over each output step): no aliasing worth hearing
// for speech, cheap enough for the audio thread. `carry` keeps the fractional position between calls: { pos, acc, n }.
function makeResampler(inRate, outRate = 16000) {
  const step = inRate / outRate;
  let pos = 0, acc = 0, n = 0;
  return function resample(input) {
    const out = new Int16Array(Math.ceil((input.length + 1) / step) + 1);
    let k = 0;
    for (let i = 0; i < input.length; i++) {
      acc += input[i]; n++; pos += 1;
      if (pos >= step) {
        pos -= step;
        const v = Math.max(-1, Math.min(1, acc / n));
        out[k++] = v < 0 ? Math.round(v * 0x8000) : Math.round(v * 0x7fff);
        acc = 0; n = 0;
      }
    }
    return out.subarray(0, k);
  };
}

if (typeof registerProcessor === 'function') {
  class VoiceCapture extends AudioWorkletProcessor {
    constructor() {
      super();
      this.resample = makeResampler(sampleRate, 16000);           // `sampleRate` is the worklet scope's global
      this.frame = new Int16Array(320); this.fill = 0;            // 20 ms at 16 kHz
    }
    process(inputs) {
      const ch = inputs[0] && inputs[0][0];
      if (!ch) return true;
      const s = this.resample(ch);
      for (let i = 0; i < s.length; i++) {
        this.frame[this.fill++] = s[i];
        if (this.fill === this.frame.length) {
          const f = this.frame; this.frame = new Int16Array(320); this.fill = 0;
          this.port.postMessage(f, [f.buffer]);
        }
      }
      return true;
    }
  }
  registerProcessor('vrg-voice-capture', VoiceCapture);
}

if (typeof module !== 'undefined' && module.exports) module.exports = { makeResampler };
// loaded as a classic <script> too (the ScriptProcessor fallback of voice.js uses the same resampler)
if (typeof window !== 'undefined') window.VRGVoiceResampler = makeResampler;
