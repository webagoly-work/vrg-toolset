// whisper-server.js — the real engine: whisper.cpp's `whisper-server` as a child process on 127.0.0.1, the model loaded ONCE and kept
// resident (that is what makes the first partial quick). Each decode is one POST /inference with a WAV in memory; requests are
// serialised (one model, one decoder). Nothing leaves the machine: the server listens on the loopback only.
//   const a = createWhisperServer({ exe, model, threads?, spawn, httpRequest?, freePort?, log? });
//   await a.load() → { ok } | { ok:false, hu } · await a.transcribe(pcm, { lang, prompt, final }) → { text, lang } · await a.close()
// Checked against examples/server/server.cpp at the pinned tag v1.8.3: `-m`, `-t`, `-nt`, `-nlp`, `--host`, `--port`; POST /inference
// multipart `file` + `temperature`, `temperature_inc`, `response_format`, `language`, `prompt`, `no_timestamps` per request; GET /health
// = 200 {"status":"ok"} once the model is loaded (503 while loading); verbose_json `language` is a full name ("hungarian").
// Without `--convert` the upload is decoded in memory: no audio is written to a temp file.
'use strict';
const nodeHttp = require('http'), net = require('net'), fs = require('fs'), path = require('path');
const { toWav } = require('./wav.js');

function freePortDefault() {
  return new Promise((res, rej) => { const s = net.createServer(); s.unref(); s.on('error', rej); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
}
// a multipart/form-data body: fields (strings) + one file
function multipart(fields, file) {
  const b = '----vrgvoice' + Math.random().toString(16).slice(2);
  const parts = [];
  for (const [k, v] of Object.entries(fields)) if (v !== undefined && v !== null && v !== '') parts.push(Buffer.from('--' + b + '\r\nContent-Disposition: form-data; name="' + k + '"\r\n\r\n' + String(v) + '\r\n'));
  parts.push(Buffer.from('--' + b + '\r\nContent-Disposition: form-data; name="file"; filename="a.wav"\r\nContent-Type: audio/wav\r\n\r\n'), file, Buffer.from('\r\n--' + b + '--\r\n'));
  return { body: Buffer.concat(parts), type: 'multipart/form-data; boundary=' + b };
}
// whisper's full language names → codes (only the ones we use; anything else is kept as given, max 12 chars)
const LANG = { hungarian: 'hu', english: 'en', german: 'de' };
const langCode = l => (typeof l === 'string' ? (LANG[l.toLowerCase()] || (/^[a-z]{2}$/.test(l) ? l : l.slice(0, 12))) : '');
// the server's JSON → { text, lang } (json: { text }; verbose_json adds language)
function parseReply(s) {
  let j; try { j = JSON.parse(s); } catch (e) { return { text: String(s || '').trim(), lang: '' }; }
  if (j && j.error) throw new Error(String(j.error).slice(0, 120));
  const text = typeof j.text === 'string' ? j.text : Array.isArray(j.segments) ? j.segments.map(x => x.text || '').join('') : '';
  return { text: text.replace(/\s+/g, ' ').trim(), lang: langCode(j.language || j.detected_language || '') };
}

function createWhisperServer({ exe, model, threads, spawn, httpRequest = nodeHttp.request, freePort = freePortDefault, log = () => {}, startPrompt = '', loadTimeoutMs = 120000 } = {}) {
  let proc = null, port = 0, ready = false, loading = null, queue = Promise.resolve(), errTail = '';
  const request = (method, p, body, type, timeoutMs = 60000) => new Promise((res, rej) => {
    const rq = httpRequest({ host: '127.0.0.1', port, path: p, method, timeout: timeoutMs, headers: body ? { 'Content-Type': type, 'Content-Length': body.length } : {} }, r => {
      let s = ''; r.setEncoding('utf8'); r.on('data', d => { s += d; }); r.on('end', () => (r.statusCode >= 200 && r.statusCode < 300 ? res(s) : rej(new Error('http ' + r.statusCode + ' ' + s.slice(0, 120)))));
    });
    rq.on('timeout', () => rq.destroy(new Error('timeout'))); rq.on('error', rej);
    if (body) rq.write(body);
    rq.end();
  });

  async function load() {
    if (ready) return { ok: true };
    if (loading) return loading;
    loading = (async () => {
      if (!exe || !fs.existsSync(exe)) return { ok: false, err: 'missing', hu: 'Nincs letöltve a beszédmotor (node Voice/fetch.js).' };
      if (!model || !fs.existsSync(model)) return { ok: false, err: 'missing', hu: 'Nincs letöltve a beszédmodell (node Voice/fetch.js).' };
      port = await freePort();
      const args = ['-m', model, '--host', '127.0.0.1', '--port', String(port), '-t', String(threads || 4), '-nt', '-nlp'];
      if (startPrompt) args.push('--prompt', startPrompt);
      proc = spawn(exe, args, { cwd: path.dirname(exe), windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
      if (proc.stderr) proc.stderr.on('data', d => { errTail = (errTail + d).slice(-2000); });
      proc.on('exit', code => { log('voice', 'whisper-server exit', code); ready = false; proc = null; loading = null; });
      const end = Date.now() + loadTimeoutMs;
      while (Date.now() < end && proc) {
        try { await request('GET', '/health', null, null, 2000); ready = true; log('voice', 'whisper-server ready', port); return { ok: true }; } catch (e) { await new Promise(r => setTimeout(r, 250)); }
      }
      log('voice', 'whisper-server did not start', errTail.slice(-300));
      await close();
      return { ok: false, err: 'error', hu: 'A beszédmotor nem indult el.' };
    })();
    const r = await loading;
    if (!r.ok) loading = null;
    return r;
  }

  function transcribe(pcm, o = {}) {
    const run = async () => {
      if (!ready) { const l = await load(); if (!l.ok) throw new Error(l.hu); }
      const { body, type } = multipart({
        temperature: '0.0', temperature_inc: '0.0', response_format: 'verbose_json', no_timestamps: 'true',
        language: o.lang && o.lang !== 'auto' ? o.lang : 'auto', prompt: o.prompt || '',
      }, toWav(pcm));
      return parseReply(await request('POST', '/inference', body, type, o.final ? 120000 : 30000));
    };
    const p = queue.then(run, run);
    queue = p.catch(() => {});
    return p;
  }

  async function close() { ready = false; if (proc) { try { proc.kill(); } catch (e) {} proc = null; } }
  return { name: 'whisper', load, transcribe, close, ready: () => ready, port: () => port };
}

module.exports = { createWhisperServer, multipart, parseReply, langCode };
