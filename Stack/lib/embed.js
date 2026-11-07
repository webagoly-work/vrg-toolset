// VRG Stack — meaning vectors (embeddings), STK-Q12 = B: bge-m3.
//
// The provider is a small interface so the model can change without touching search:
//   provider.check()        → { ok, why }      is it reachable and is the model there?
//   provider.embed([texts]) → [Float32Array]   one unit-length vector per text
// 'ollama' talks to a local Ollama (http://127.0.0.1:11434, POST /api/embed). 'none' is the
// fallback: search stays full-text only, and HEALTH.md says why. Nothing is installed or
// downloaded by the stack; turning it on is `ollama pull bge-m3` once Ollama is installed.
'use strict';

const CFG = require('../config');

const unit = v => { let s = 0; for (const x of v) s += x * x; s = Math.sqrt(s) || 1; const out = new Float32Array(v.length); for (let i = 0; i < v.length; i++) out[i] = v[i] / s; return out; };
const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
const toBlob = v => Buffer.from(v.buffer, v.byteOffset, v.byteLength);
const fromBlob = b => new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));

async function timed(url, init, ms) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try { return await fetch(url, { ...init, signal: ctl.signal }); } finally { clearTimeout(t); }
}

function ollama(o = CFG.embed) {
  return {
    name: `ollama:${o.model}`,
    async check() {
      try {
        const r = await timed(o.url + '/api/tags', {}, o.timeoutMs);
        if (!r.ok) return { ok: false, why: `Ollama answered ${r.status}` };
        const j = await r.json();
        const has = (j.models || []).some(m => (m.name || '').split(':')[0] === o.model);
        return has ? { ok: true } : { ok: false, why: `Ollama runs, but ${o.model} is not pulled (ollama pull ${o.model}, about 1.2 GB)` };
      } catch { return { ok: false, why: `Ollama is not running at ${o.url} (not installed, or not started)` }; }
    },
    async embed(texts) {
      const r = await timed(o.url + '/api/embed', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: o.model, input: texts }) }, 120000);
      if (!r.ok) throw new Error(`embed failed: ${r.status}`);
      const j = await r.json();
      return j.embeddings.map(unit);
    },
  };
}

const none = { name: 'none', async check() { return { ok: false, why: 'embeddings switched off in config.js' }; }, async embed() { return []; } };

function provider() { return CFG.embed.provider === 'ollama' ? ollama() : none; }

module.exports = { provider, unit, dot, toBlob, fromBlob };
