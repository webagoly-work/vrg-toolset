// ocr.js — WP-56 Szem: the OCR fallback of the screen reader, for windows whose UI Automation tree is thin (a canvas, a game, a
// remote desktop, a PDF viewer) and for "read it" when no text pattern answers.
//   const ocr = createOcr({ engine: 'tesseract-js' | 'windows' | 'none', langs: ['hun', 'eng'], dataDir, load?, log? });
//   ocr.available() → { ok, engine, missing?: [file…], hu? }
//   await ocr.recognize(pngBuffer, { rect?: { left, top, width, height } }) → { text, words?: [{ text, conf, bbox }], conf, ms }
//   await ocr.close()
// tesseract-js: tesseract.js 7.0.0 (Apache-2.0, WASM, no network once `dataDir` holds <lang>.traineddata). It is installed in this
// folder (`npm ci --ignore-scripts`, Voice/screen/package-lock.json pins every package with its sha512); the traineddata comes
// from tessdata_fast 4.1.0 through `node Voice/screen/fetch-ocr.js` (sha256-checked, Voice/voice-manifest.json → ocr).
// windows: Windows.Media.Ocr through the UIA helper — a stub for now (TODO on H:: check that the Hungarian OCR language is installed,
// `Get-WindowsCapability -Online -Name 'Language.OCR~~~hu-HU*'`, then add an "ocr" op to uia-host.ps1).
// Images are given as Buffers in memory; nothing is written to disk. The worker is made once and kept (the first call loads the
// languages, ~0.5–1.5 s; later calls only recognise).
'use strict';
const fs = require('fs'), path = require('path');

const ENGINES = ['tesseract-js', 'windows', 'none'];

function createOcr({ engine = 'tesseract-js', langs = ['hun', 'eng'], dataDir, load, log = () => {} } = {}) {
  const kind = ENGINES.includes(engine) ? engine : 'none';
  const L = (Array.isArray(langs) ? langs : ['hun', 'eng']).filter(l => /^[a-z_]{3,8}$/.test(l));
  let worker = null, starting = null;

  function available() {
    if (kind === 'none') return { ok: false, engine: kind, hu: 'Az OCR ki van kapcsolva.' };
    if (kind === 'windows') return { ok: false, engine: kind, hu: 'A Windows OCR még nincs bekötve (TODO a helyi gépen).' };
    const missing = L.map(l => l + '.traineddata').filter(f => !dataDir || !fs.existsSync(path.join(dataDir, f)));
    if (missing.length) return { ok: false, engine: kind, missing, hu: 'Hiányzik az OCR nyelvi adat: ' + missing.join(', ') + ' (node Voice/screen/fetch-ocr.js).' };
    try { (load || defaultLoad)(); } catch (e) { return { ok: false, engine: kind, hu: 'A tesseract.js nincs telepítve (npm ci --ignore-scripts a Voice/screen mappában).' }; }
    return { ok: true, engine: kind };
  }

  function defaultLoad() { return require('tesseract.js'); }

  async function getWorker() {
    if (worker) return worker;
    if (starting) return starting;
    starting = (async () => {
      const T = (load || defaultLoad)();
      // langPath is a local folder and gzip is off: tesseract.js reads <dataDir>/<lang>.traineddata and never goes online
      const w = await T.createWorker(L, 1, { langPath: dataDir, gzip: false, cacheMethod: 'none', logger: () => {}, errorHandler: e => log('ocr', 'worker error', String(e && e.message || e)) });
      worker = w;
      return w;
    })();
    try { return await starting; } finally { starting = null; }
  }

  async function recognize(png, { rect } = {}) {
    if (!Buffer.isBuffer(png) || !png.length) throw new Error('ocr: a PNG buffer is needed');
    const a = available();
    if (!a.ok) throw Object.assign(new Error(a.hu), { code: 'unavailable' });
    const t0 = Date.now();
    const w = await getWorker();
    const opts = rect && [rect.left, rect.top, rect.width, rect.height].every(Number.isFinite) ? { rectangle: { left: rect.left | 0, top: rect.top | 0, width: rect.width | 0, height: rect.height | 0 } } : {};
    const r = await w.recognize(png, opts, { text: true, blocks: true });
    const d = (r && r.data) || {};
    const words = [];
    for (const b of d.blocks || []) for (const p of b.paragraphs || []) for (const l of p.lines || []) for (const wd of l.words || []) words.push({ text: wd.text, conf: Math.round(wd.confidence), bbox: wd.bbox });
    return { text: String(d.text || '').replace(/[ \t]+\n/g, '\n').trim(), words: words.length ? words : undefined, conf: Math.round(Number(d.confidence) || 0), ms: Date.now() - t0 };
  }

  async function close() { if (worker) { try { await worker.terminate(); } catch (e) {} worker = null; } }

  return { engine: kind, langs: L, available, recognize, close };
}

module.exports = { createOcr, ENGINES };
