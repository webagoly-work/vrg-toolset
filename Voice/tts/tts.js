// tts.js — Hang (WP-57): the overlay's terse answers spoken aloud, offline. Node CommonJS, no Electron import.
//   const { createSpeaker, speakable, ENGINES } = require('<repo>/Voice/tts/tts.js');
//   const sp = createSpeaker({ engine: 'sherpa'|'sapi'|'none', dirs: { models, node }, spawn, powershell, loadAddon, voices?, log? });
//   await sp.status() → { ok, engine, ready, voices: [{ id, lang, name }], reason? }
//   await sp.say(text, { lang?: 'hu'|'en'|'auto', voice?, rate? })
//     → sherpa: { ok:true, id, pcm:{ sampleRate, samples: Float32Array }, ms, chars, lang, voice }   (the page plays the PCM)
//     → sapi:   { ok:true, id, played:true, ms, chars, lang, voice }                                (the helper plays it itself)
//     → { ok:false, err, hu }    err: 'off' | 'empty' | 'not-ready' | 'stopped' | 'replaced' | 'error'
//   sp.stop()   barge-in: drops the queued answer and ends the current one at once     sp.close()   stop + the helper process ends
//   sp.warm(['hu','en']?)   loads the default voice(s) now (the first load takes ~0.5 s; afterwards an answer takes ~60–120 ms)
// One answer at a time: a new say() waits behind the current one and REPLACES whatever was waiting (that one resolves 'replaced').
// sherpa = sherpa-onnx-node 1.13.x (Apache-2.0) with Piper VITS voices (vits-piper-<lang>_<REGION>-<name>-<quality>/ in dirs.models).
//   2.x dropped the built-in espeak-ng phonemizer for Piper voices ("phoneme_codepoints is empty"): stay on 1.13.x (README).
// sapi = Windows System.Speech in ONE long-running PowerShell helper (sapi-host.ps1, JSON lines; the text travels base64 UTF-8).
'use strict';
const fs = require('fs'), path = require('path');

const ENGINES = ['sherpa', 'sapi', 'none'];
const HERE = __dirname;
const MAX_CHARS = 240, MAX_SENTENCES = 2;
const DEFAULT_VOICES = { hu: 'hu_HU-anna-medium', en: 'en_US-amy-medium' };
const HU_HINT = /[áéíóöőúüű]|\b(a|az|és|nem|igen|van|nincs|meg|kész|hiba|lap|ablak|munkamenet)\b/i;

let LEX = null;
const lexicon = () => (LEX = LEX || JSON.parse(fs.readFileSync(path.join(HERE, 'lexicon.json'), 'utf8')));

// ------------------------------------------------------------ Hungarian numbers (0 … 999 999)
const ONES = ['nulla', 'egy', 'kettő', 'három', 'négy', 'öt', 'hat', 'hét', 'nyolc', 'kilenc'];
const ONES_C = ['', 'egy', 'két', 'három', 'négy', 'öt', 'hat', 'hét', 'nyolc', 'kilenc'];          // before száz / ezer
const TENS = ['', 'tíz', 'húsz', 'harminc', 'negyven', 'ötven', 'hatvan', 'hetven', 'nyolcvan', 'kilencven'];
const TENS_P = ['', 'tizen', 'huszon', 'harminc', 'negyven', 'ötven', 'hatvan', 'hetven', 'nyolcvan', 'kilencven'];   // with a unit after
function below1000(n) {
  const h = Math.floor(n / 100), t = Math.floor((n % 100) / 10), u = n % 10;
  let s = h ? (h === 1 ? 'száz' : ONES_C[h] + 'száz') : '';
  if (t) s += u ? TENS_P[t] + ONES[u] : TENS[t];
  else if (u) s += ONES[u];
  return s;
}
function huNumber(n) {
  if (!Number.isInteger(n) || n < 0 || n > 999999) return String(n);
  if (n === 0) return 'nulla';
  const th = Math.floor(n / 1000), rest = n % 1000;
  if (!th) return below1000(rest);
  const head = th === 1 ? 'ezer' : (th < 10 ? ONES_C[th] : below1000(th).replace(/kettő$/, 'két')) + 'ezer';
  if (!rest) return head;
  return head + (n > 2000 ? '-' : '') + below1000(rest);     // 1999 → ezerkilencszázkilencvenkilenc, 2026 → kétezer-huszonhat
}

// ------------------------------------------------------------ speakable()
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function detectLang(text) { return HU_HINT.test(String(text || '')) ? 'hu' : 'en'; }

// a terse answer → text a voice can say: markup, emoji and glyphs out; VRG names, acronyms, codes, numbers spelled; ≤ 2 sentences
function speakable(text, lang) {
  const L = lang === 'en' ? 'en' : lang === 'hu' ? 'hu' : detectLang(text);
  const lx = lexicon()[L];
  let s = String(text == null ? '' : text).normalize('NFC');
  // markup and decoration
  s = s.replace(/```[\s\S]*?```/g, ' ')                              // code blocks are not said
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')                          // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')                         // links: their text
    .replace(/https?:\/\/\S+/g, L === 'hu' ? 'link' : 'link')
    .replace(/(^|\s)[#>]+\s*/g, '$1')                                // headings, quotes
    .replace(/^\s*[-*+]\s+/gm, '')                                   // list bullets
    .replace(/(\*\*|__|\*|_|~~)(?=\S)([^*_~]+?)\1/g, '$2')           // bold / italic / strike
    .replace(/\p{Extended_Pictographic}(️|‍\p{Extended_Pictographic})*/gu, ' ')
    .replace(/[☀-➿️‍]/g, ' ')
    .replace(/\s*(…|\.{3,})\s*$/, '.').replace(/\s*(…|\.{3,})\s*/g, ', ')
    .replace(/[()[\]{}<>«»"“”„]/g, ' ')
    .replace(/(?:[A-Za-z]:)?(?:[\w.-]+[\\/])+([\w.-]+)/g, '$1')       // a path → its last part
    .replace(/(\p{L})\.(\p{L})/gu, '$1' + (L === 'hu' ? ' pont ' : ' dot ') + '$2')   // voice.js → voice pont js (not a sentence end)
    .replace(/(\d)\s?%-(\p{Ll}+)/gu, '$1' + (L === 'hu' ? ' százalék' : ' percent') + '$2')   // 40%-on → negyven százalékon
    .replace(/(\p{Lu}\p{Ll}+)-(\p{Ll}{1,5})(?![\p{L}-])/gu, '$1$2');  // Kapu-t → Kaput
  s = s.replace(/([^\s.!?,;:])[ \t]*\n+\s*/g, '$1, ').replace(/\s*\n+\s*/g, ' ');   // a line break is a short pause
  for (const [k, v] of Object.entries(lx.symbols || {})) s = s.split(k).join(v);
  // phrases (longest first), case-sensitive
  for (const k of Object.keys(lx.phrases || {}).sort((a, b) => b.length - a.length)) s = s.replace(new RegExp('(^|[^\\p{L}\\p{N}])' + esc(k) + '(?![\\p{L}\\p{N}])', 'gu'), (m, p) => p + lx.phrases[k]);
  // tokens
  const words = lx.words || {}, lower = new Map(Object.keys(words).map(k => [k.toLowerCase(), words[k]]));
  const spell = w => w.split('').map(c => (lx.letters || {})[c] || c).join(L === 'hu' ? '-' : ' ');
  s = s.replace(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu, w => {
    if (Object.prototype.hasOwnProperty.call(words, w)) return words[w];
    const lw = w.toLowerCase();
    if (lower.has(lw) && !/^[A-Z]{2,}$/.test(w)) return lower.get(lw);
    if (L === 'hu' && /^\p{Lu}\p{Ll}+/u.test(w)) {                    // Plannert, Plannerben: a known name + a Hungarian ending
      for (const k of Object.keys(words)) if (k.length >= 4 && /^\p{Lu}/u.test(k) && w.startsWith(k) && w.length - k.length <= 6 && /^[\p{Ll}-]+$/u.test(w.slice(k.length))) return words[k] + w.slice(k.length).replace(/^-/, '');
    }
    const code = /^([A-Z]{1,3})-?(\d{1,4})$/.exec(w);                  // M16, CLA2, WP-54 → letters + number
    if (code) return spell(code[1]) + ' ' + (L === 'hu' ? huNumber(Number(code[2])) : code[2]);
    if (/^[A-Z]{2,4}$/.test(w)) return spell(w);                      // an acronym not in the lexicon
    if (L === 'hu' && /^\d{1,6}$/.test(w)) return huNumber(Number(w));   // attributive "két" is fixed after the token pass
    if (L === 'hu' && /^\d{1,6}-(?=\p{Ll})/u.test(w)) { const m = /^(\d{1,6})-(.*)$/u.exec(w); return huNumber(Number(m[1])) + m[2]; }   // 16-ot
    return w;
  });
  // a number before a noun takes the attributive form: kettő teszt → két teszt, huszonkettő ablak → huszonkét ablak
  if (L === 'hu') s = s.replace(/kettő(?=\s+(?!(?:és|vagy|meg|is|sem|se|pedig|már|még|van|volt|lesz|nincs|kell|lett)(?![\p{L}]))\p{Ll})/gu, 'két');
  s = s.replace(/\s+([,.!?;:])/g, '$1').replace(/([,;:])(?=\S)/g, '$1 ').replace(/\s{2,}/g, ' ').replace(/^[\s,.;:]+/, '').trim();
  // at most two sentences, at most MAX_CHARS (cut at a word, closed with a full stop)
  const sentences = s.match(/[^.!?]+[.!?]*/g) || [];
  s = sentences.slice(0, MAX_SENTENCES).join(' ').replace(/\s{2,}/g, ' ').trim();
  if (s.length > MAX_CHARS) s = s.slice(0, MAX_CHARS).replace(/\s+\S*$/, '').replace(/[,;:\s]+$/, '') + '.';
  return s;
}

// ------------------------------------------------------------ voices on disk (sherpa)
// <models>/vits-piper-hu_HU-anna-medium/{hu_HU-anna-medium.onnx, tokens.txt, espeak-ng-data/}
function findVoices(modelsDir) {
  const out = [];
  let list = [];
  try { list = fs.readdirSync(modelsDir, { withFileTypes: true }); } catch (e) { return out; }
  for (const d of list) {
    const m = d.isDirectory() && /^vits-piper-(([a-z]{2})_[A-Z]{2}-([\w]+)-(x_low|low|medium|high))$/.exec(d.name);
    if (!m) continue;
    const dir = path.join(modelsDir, d.name), onnx = path.join(dir, m[1] + '.onnx');
    if (!fs.existsSync(onnx) || !fs.existsSync(path.join(dir, 'tokens.txt')) || !fs.existsSync(path.join(dir, 'espeak-ng-data'))) continue;
    out.push({ id: m[1], lang: m[2] === 'hu' ? 'hu' : 'en', name: m[3], dir, onnx });
  }
  return out.filter(v => v.lang === 'hu' || /^en/.test(v.id)).sort((a, b) => a.id.localeCompare(b.id));
}
const pub = v => ({ id: v.id, lang: v.lang, name: v.name });

// ------------------------------------------------------------ engines
function sherpaEngine({ dirs, loadAddon, log, threads }) {
  let addon, addonErr = '';
  const inst = new Map();                                            // voice id → OfflineTts
  const getAddon = () => {
    if (addon !== undefined) return addon;
    try { addon = typeof loadAddon === 'function' ? loadAddon() : null; } catch (e) { addon = null; addonErr = String(e && e.message || e).slice(0, 160); }
    return addon;
  };
  const voices = () => findVoices(dirs && dirs.models);
  function tts(v) {
    if (inst.has(v.id)) return inst.get(v.id);
    const t0 = Date.now();
    const t = new (getAddon().OfflineTts)({ model: { vits: { model: v.onnx, tokens: path.join(v.dir, 'tokens.txt'), dataDir: path.join(v.dir, 'espeak-ng-data') }, numThreads: threads || 2, provider: 'cpu', debug: false }, maxNumSentences: 1 });
    log('tts', 'voice loaded', v.id, Date.now() - t0, 'ms');
    inst.set(v.id, t);
    return t;
  }
  return {
    status() {
      const a = getAddon(), vs = voices();
      if (!a) return { ready: false, voices: vs.map(pub), reason: 'A sherpa-onnx-node nincs telepítve' + (addonErr ? ': ' + addonErr : '') + ' (node Voice/tts/fetch-tts.js).' };
      if (!vs.length) return { ready: false, voices: [], reason: 'Nincs letöltött hang (node Voice/tts/fetch-tts.js).' };
      return { ready: true, voices: vs.map(pub) };
    },
    voices,
    warm(id) { const v = voices().find(x => x.id === id); if (v && getAddon()) tts(v); },
    // one utterance; job.cancelled turns the progress callback into an abort (it stops after the current sentence)
    async speak(job) {
      const v = job.voiceObj;
      const t = tts(v);
      const a = await t.generateAsync({ text: job.text, sid: 0, speed: job.rate || 1, onProgress: () => (job.cancelled ? 0 : 1) });
      if (job.cancelled) return { stopped: true };
      return { pcm: { sampleRate: a.sampleRate, samples: a.samples } };
    },
    cancel() {},
    close() { inst.clear(); },
  };
}

// the SAPI helper: one powershell process for the whole run; JSON lines both ways
function sapiEngine({ spawn, powershell, log }) {
  let proc = null, buf = '', ready = null, voicesCache = null, crashed = '';
  const waiting = new Map();                                         // utterance id → resolve
  let voicesWait = [];
  function start() {
    if (proc) return ready;
    if (typeof spawn !== 'function' || !powershell) return Promise.reject(new Error('no powershell'));
    const script = path.join(HERE, 'sapi-host.ps1');
    proc = spawn(powershell, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    buf = '';
    ready = new Promise((res, rej) => {
      const fail = e => rej(e);
      proc.once('error', fail);
      proc.stdout.setEncoding && proc.stdout.setEncoding('utf8');
      proc.stdout.on('data', d => {
        buf += d;
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
          if (!line) continue;
          let m; try { m = JSON.parse(line); } catch (e) { continue; }
          if (m.ev === 'ready') res(true);
          else if (m.ev === 'voices') { voicesCache = (Array.isArray(m.voices) ? m.voices : m.voices ? [m.voices] : []).map(v => ({ id: String(v.name), name: String(v.name), lang: /^hu/i.test(v.culture) ? 'hu' : /^en/i.test(v.culture) ? 'en' : String(v.culture || '').slice(0, 2).toLowerCase() })); const w = voicesWait; voicesWait = []; w.forEach(f => f(voicesCache)); }
          else if (m.ev === 'done') { const f = waiting.get(m.id); if (f) { waiting.delete(m.id); f(m); } }
          else if (m.ev === 'error') log('tts', 'sapi error', String(m.msg || '').slice(0, 160));
        }
      });
      proc.once('exit', code => {
        crashed = 'A beszédhang-segéd leállt (' + code + ').';
        log('tts', 'sapi host exit', code);
        proc = null; ready = null;
        for (const [, f] of waiting) f({ ok: false, crashed: true });
        waiting.clear();
        const w = voicesWait; voicesWait = []; w.forEach(f => f(null));
        rej(new Error('exit ' + code));
      });
    });
    ready.catch(() => {});
    return ready;
  }
  const send = o => { try { proc.stdin.write(JSON.stringify(o) + '\n'); return true; } catch (e) { return false; } };
  async function listVoices() {
    await start();
    const p = new Promise(res => voicesWait.push(res));
    send({ op: 'voices' });
    const v = await Promise.race([p, new Promise(res => setTimeout(() => res(null), 4000))]);
    return v || voicesCache || [];
  }
  return {
    async status() {
      try {
        const vs = (await listVoices()).filter(v => v.lang === 'hu' || v.lang === 'en');
        crashed = '';
        if (!vs.length) return { ready: false, voices: [], reason: 'Nincs Windows-beszédhang.' };
        return { ready: true, voices: vs, ...(vs.some(v => v.lang === 'hu') ? {} : { reason: 'Nincs magyar Windows-hang (a magyar nyelvi csomag beszédfunkciója kell); angolul beszél.' }) };
      } catch (e) { return { ready: false, voices: [], reason: crashed || 'A PowerShell beszédhang-segéd nem indult el.' }; }
    },
    async voices() { try { return await listVoices(); } catch (e) { return []; } },
    warm() { start().catch(() => {}); },
    async speak(job) {
      await start();
      const r = await new Promise(res => {
        waiting.set(job.id, res);
        const rate = Math.max(-10, Math.min(10, Math.round(((job.rate || 1) - 1) * 10)));
        if (!send({ op: 'speak', id: job.id, text: Buffer.from(job.text, 'utf8').toString('base64'), voice: job.voiceObj ? job.voiceObj.name : '', rate })) { waiting.delete(job.id); res({ ok: false }); }
      });
      if (r.cancelled || job.cancelled) return { stopped: true };
      if (r.crashed) throw new Error('crashed');
      if (r.ok === false) throw new Error('sapi');
      return { played: true };
    },
    cancel() { if (proc) send({ op: 'stop' }); },
    close() { if (proc) { send({ op: 'quit' }); const p = proc; setTimeout(() => { try { p.kill(); } catch (e) {} }, 500); proc = null; } },
  };
}

// ------------------------------------------------------------ the speaker: one interface, one answer at a time
function createSpeaker({ engine = 'none', dirs = {}, spawn, powershell, loadAddon, voices: prefer, threads, log = () => {} } = {}) {
  const kind = ENGINES.includes(engine) ? engine : 'none';
  const E = kind === 'sherpa' ? sherpaEngine({ dirs, loadAddon, log, threads }) : kind === 'sapi' ? sapiEngine({ spawn, powershell, log }) : null;
  const want = { ...DEFAULT_VOICES, ...(prefer && typeof prefer === 'object' ? prefer : {}) };
  let seq = 0, current = null, queued = null, closed = false, gen = 0;   // gen: bumped by stop(), so an answer still picking its voice is dropped too

  async function status() {
    if (!E) return { ok: true, engine: kind, ready: false, voices: [], reason: 'A felolvasás ki van kapcsolva.' };
    const s = await E.status();
    return { ok: true, engine: kind, ready: !!s.ready, voices: s.voices || [], ...(s.reason ? { reason: s.reason } : {}) };
  }
  async function pickVoice(lang, id) {
    const vs = (await E.voices()) || [];
    return vs.find(v => v.id === id) || vs.find(v => v.id === want[lang]) || vs.find(v => v.lang === lang) || (lang === 'hu' ? null : vs[0]) || null;
  }

  async function run(job) {
    current = job;
    const t0 = Date.now();
    try {
      if (job.cancelled) return job.resolve({ ok: false, err: 'stopped', hu: 'Leállítva.' });
      const r = await E.speak(job);
      if (r.stopped || job.cancelled) return job.resolve({ ok: false, err: 'stopped', hu: 'Leállítva.' });
      job.resolve({ ok: true, id: job.id, ...(r.pcm ? { pcm: r.pcm } : { played: true }), ms: Date.now() - t0, chars: job.text.length, lang: job.lang, voice: job.voiceObj.id });
    } catch (e) {
      log('tts', 'speak failed', String(e && e.message || e).slice(0, 160));
      job.resolve({ ok: false, err: 'error', hu: 'A felolvasás nem sikerült.' });
    } finally {
      current = null;
      if (queued && !closed) { const next = queued; queued = null; run(next); }
    }
  }

  async function say(text, opts = {}) {
    if (!E || closed) return { ok: false, err: 'off', hu: 'A felolvasás ki van kapcsolva.' };
    const myGen = gen;
    const lang = opts.lang === 'hu' || opts.lang === 'en' ? opts.lang : detectLang(text);
    const t = speakable(text, lang);
    if (!t) return { ok: false, err: 'empty', hu: 'Nincs mit felolvasni.' };
    const v = await pickVoice(lang, opts.voice);
    if (myGen !== gen || closed) return { ok: false, err: 'stopped', hu: 'Leállítva.' };
    if (!v) return { ok: false, err: 'not-ready', hu: lang === 'hu' ? 'Nincs magyar hang telepítve.' : 'Nincs hang telepítve.' };
    const rate = Number.isFinite(opts.rate) ? Math.max(0.5, Math.min(2, opts.rate)) : 1;
    return new Promise(resolve => {
      const job = { id: 'u' + (++seq), text: t, lang, rate, voiceObj: v, cancelled: false, resolve };
      if (!current) { run(job); return; }
      if (queued) queued.resolve({ ok: false, err: 'replaced', hu: 'Újabb válasz jött.' });
      queued = job;
    });
  }

  function stop() {
    gen++;
    if (queued) { queued.resolve({ ok: false, err: 'stopped', hu: 'Leállítva.' }); queued = null; }
    if (current) { current.cancelled = true; if (E) E.cancel(); }
  }
  function close() { stop(); closed = true; if (E) E.close(); }
  function warm(langs) { if (E && E.warm) for (const l of Array.isArray(langs) ? langs : ['hu']) E.warm(want[l]); }

  return { status, say, stop, close, warm, engine: kind };
}

// the default way main loads the addon from <Full>/tools/voice/tts/node (fetch-tts.js puts it there)
function addonLoader(dirs) {
  return () => require(path.join(dirs.node, 'node_modules', 'sherpa-onnx-node'));
}

module.exports = { createSpeaker, speakable, ENGINES, huNumber, detectLang, findVoices, addonLoader, DEFAULT_VOICES, MAX_CHARS };
