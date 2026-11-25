// WP-57 Hang: the Desktop's side of the spoken answers — shell/lib/speak.js over a fake Voice/tts module: off by default, the OS-voice
// ('web') path, PCM handed to the page as base64 Float32, an engine that plays by itself, stop, status, a new speaker when the engine changes.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { createSpeak, pcmB64 } = require('../shell/lib/speak.js');

function fakeTts(log) {
  return {
    speakable: t => t.replace(/\bVRG\b/g, 'vé-er-gé'),
    createSpeaker: o => {
      log.push('create:' + o.engine);
      return {
        say: async (text, opt) => { log.push('say:' + o.engine + ':' + text + ':' + opt.lang); return o.engine === 'sapi' ? { ok: true, id: 's', played: true } : { ok: true, id: 'p', pcm: { sampleRate: 22050, samples: new Float32Array([0, 0.5, -0.5]) }, ms: 12 }; },
        stop: () => log.push('stop'), status: async () => ({ ok: true, ready: true, voices: [{ id: 'hu_HU-anna', lang: 'hu', name: 'Anna' }] }), close: () => log.push('close:' + o.engine),
      };
    },
  };
}

test('speak: off by default; bad text refused; "none" is off', async () => {
  const log = [];
  assert.strictEqual((await createSpeak({ loadTts: () => fakeTts(log) }).say({ text: 'szia' })).err, 'disabled');
  const on = createSpeak({ loadTts: () => fakeTts(log), enabled: () => true });
  assert.strictEqual((await on.say({ text: '  ' })).err, 'bad-request');
  assert.strictEqual((await on.say({ text: 'x'.repeat(601) })).err, 'bad-request');
  assert.strictEqual((await createSpeak({ loadTts: () => fakeTts(log), enabled: () => true, engine: () => 'none' }).say({ text: 'szia' })).err, 'disabled');
  assert.strictEqual((await createSpeak({ loadTts: () => null, enabled: () => true }).say({ text: 'szia' })).err, 'unavailable');
  assert.deepStrictEqual(log, []);
});

test('speak: PCM as base64 Float32 for the page; an engine that plays itself; the OS voices get sayable text', async () => {
  const log = [];
  let eng = 'sherpa';
  const s = createSpeak({ loadTts: () => fakeTts(log), enabled: () => true, engine: () => eng });
  const r = await s.say({ text: 'Megnyitottam a Plannert.', lang: 'hu' });
  assert.strictEqual(r.pcm.sampleRate, 22050);
  const back = new Float32Array(Uint8Array.from(Buffer.from(r.pcm.b64, 'base64')).buffer);   // decoded the way the page does (its own bytes)
  assert.deepStrictEqual(Array.from(back), [0, 0.5, -0.5]);
  assert.strictEqual(pcmB64([1]), Buffer.from(new Float32Array([1]).buffer).toString('base64'));
  eng = 'sapi';
  assert.deepStrictEqual(await s.say({ text: 'Kész.' }), { ok: true, id: 's', played: true });
  assert.deepStrictEqual(log.filter(x => /^(create|close)/.test(x)), ['create:sherpa', 'close:sherpa', 'create:sapi']);   // a new speaker when the engine changes
  eng = 'web';
  assert.deepStrictEqual(await s.say({ text: 'A VRG kész.' }), { ok: true, web: true, text: 'A vé-er-gé kész.' });
  eng = 'sapi';
  s.stop();
  assert.ok(log.includes('stop'), 'stop reaches the current speaker');
  const st = await s.status();
  assert.deepStrictEqual([st.engine, st.enabled, st.ready, st.voices[0].lang], ['sapi', true, true, 'hu']);
  eng = 'web';
  assert.deepStrictEqual(await s.status(), { ok: true, enabled: true, engine: 'web', ready: true });
});
