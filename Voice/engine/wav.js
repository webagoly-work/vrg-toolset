// wav.js — 16-bit PCM mono samples (an Int16Array or a Buffer of little-endian int16) → a WAV file in memory, for the engine's HTTP call.
'use strict';

function toWav(pcm, sampleRate = 16000) {
  const data = Buffer.isBuffer(pcm) ? pcm : Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(sampleRate, 24); h.writeUInt32LE(sampleRate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}
// the duration of a PCM16 mono buffer in ms
const msOf = (bytes, sampleRate = 16000) => Math.round((bytes / 2) / sampleRate * 1000);

module.exports = { toWav, msOf };
