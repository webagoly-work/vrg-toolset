// gate.js — the Vezérlő's engine (WP-52): attachments, the Előszűrő (Prefilter/) verdict, and a new Claude Code session with the dressed prompt.
//   const g = createGate({ prefilter, claudeterm, repo, full, freeDir, inboxDir, dialog, pictures, folders, recentStore, fs?, now?, log? });
//   g.analyze({ text, attach?, mode? })        → { ok, verdict, score, intent, model, anchors, signals, reasons, dressed:{ before, after, length }, cwd }
//   g.send({ text, attach?, account, mode?, model? }) → claudeterm's { term } | { ok:false, err, hu }
//   g.pick({ kind:'browse'|'gallery'|'folder', root? }) → { ok, files:[{ id, name, ext, size }] }     (main's own dialog)
//   g.recent() → { ok, files:[…] }   g.folders() → { ok, folders:[{ id, hu }] }   g.photo({ data }) → { ok, file:{ id, name, ext, size } }
// The page holds attachment ids ('a<n>') and names; main keeps id → absolute path for this run and writes the paths into the prompt itself.
// The prompt never reaches a terminal unfiltered: send() always runs analyze() + dress(). An independent request starts in `freeDir` (a folder
// with no CLAUDE.md), so Claude Code loads no VRG context at all; a context request starts in the repo. `mode` lets the user overrule the verdict.
'use strict';
const nodeFs = require('fs'), path = require('path');

const MAX_TEXT = 8000, MAX_ATTACH = 10, MAX_FILE = 50 * 1024 * 1024, MAX_RECENT = 20, MAX_PHOTO = 8 * 1024 * 1024;
const MODES = ['auto', 'context', 'independent'];
const MODELS = ['haiku', 'sonnet', 'opus'];
const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'heic'];
const NO_PF = { ok: false, err: 'error', hu: 'Az Előszűrő nem érhető el (Prefilter/prefilter.js).' };

const extOf = p => path.extname(String(p)).replace(/^\./, '').toLowerCase().slice(0, 10);
// a short window title from the user's words: the first line, at most 60 characters
const titleFrom = t => Array.from(String(t || '').split(/\r?\n/).find(l => l.trim()) || '').join('').replace(/\s+/g, ' ').trim().slice(0, 60);
// the lines main appends after the user's text: the attachments by absolute path (Claude Code reads them with its own tools)
function attachLines(files) {
  if (!files.length) return '';
  return '\n\nCsatolt fájlok (olvasd be, ha a kéréshez kell):\n' + files.map(f => '- ' + f.abs).join('\n');
}

function createGate({ prefilter, claudeterm, repo, full, git, freeDir, inboxDir, dialog, pictures, folders = () => [], recentStore, fs = nodeFs, now = () => Date.now(), log = () => {} } = {}) {
  const table = new Map();                                     // 'a<n>' → { abs, name, ext, size }
  let seq = 0, idx = null, idxAt = 0;
  const pf = () => { try { return typeof prefilter === 'function' ? prefilter() : prefilter; } catch (e) { return null; } };

  function index() {
    const P = pf();
    if (!P) return null;
    if (idx && now() - idxAt < 60000) return idx;
    const o = { repo, full, ...(typeof git === 'function' ? (git() ? { git: git() } : {}) : git ? { git } : {}) };   // git: the portable Full\tools\git (else a folder walk)
    try { idx = P.loadIndex ? P.loadIndex(o) : P.buildIndex(o); idxAt = now(); } catch (e) { log('gate', 'index failed', e && e.message); idx = null; }
    return idx;
  }

  const pub = (id, f) => ({ id, name: f.name, ext: f.ext, size: f.size });
  function register(abs) {
    let st; try { st = fs.statSync(abs); } catch (e) { return null; }
    if (!st.isFile() || st.size > MAX_FILE) return null;
    for (const [id, f] of table) if (f.abs === abs) return pub(id, f);
    const id = 'a' + (++seq);
    const f = { abs, name: path.basename(abs).slice(0, 120), ext: extOf(abs), size: st.size };
    table.set(id, f);
    if (recentStore) { try { recentStore.set([abs, ...recentStore.get().filter(p => p !== abs)].slice(0, MAX_RECENT)); } catch (e) {} }
    return pub(id, f);
  }
  function files(ids) {
    const list = Array.isArray(ids) ? ids : [];
    if (list.length > MAX_ATTACH) return null;
    const out = [];
    for (const id of list) { const f = table.get(id); if (!f) return null; out.push(f); }
    return out;
  }

  function check({ text, attach, mode }) {
    if (typeof text !== 'string' || !text.trim() || text.length > MAX_TEXT) return { ok: false, err: 'bad-request', hu: 'Írj be egy kérést (legfeljebb ' + MAX_TEXT + ' karakter).' };
    if (mode !== undefined && !MODES.includes(mode)) return { ok: false, err: 'bad-request', hu: 'Ismeretlen mód.' };
    const fl = files(attach);
    if (!fl) return { ok: false, err: 'not-found', hu: 'Egy csatolmány már nem érhető el; csatold újra.' };
    return { ok: true, files: fl };
  }

  // the verdict and the dressed prompt; `mode` (the user's switch) overrides the verdict for the dressing and the folder
  function run({ text, attach, mode }) {
    const c = check({ text, attach, mode });
    if (!c.ok) return c;
    const P = pf(), I = index();
    if (!P || !I) return NO_PF;
    let a, d;
    try {
      a = P.analyze(text, { index: I, attachments: c.files.map(f => ({ name: f.name, ext: f.ext, size: f.size })), now: now() });
      d = P.dress(text, a, { mode: mode || 'auto' });
    } catch (e) { log('gate', 'analyze failed', e && e.message); return { ok: false, err: 'error', hu: 'Az Előszűrő hibára futott: ' + String(e && e.message || e).slice(0, 120) }; }
    const effective = mode && mode !== 'auto' ? mode : a.verdict;
    return { ok: true, a, d, files: c.files, effective };
  }

  function analyze(p = {}) {
    const r = run(p);
    if (!r.ok) return r;
    const { a, d } = r;
    return {
      ok: true, verdict: a.verdict, effective: r.effective, score: a.score, threshold: a.threshold, intent: a.intent, model: a.model,
      anchors: (a.anchors || []).slice(0, 8).map(x => ({ id: String(x.id || ''), title: String(x.title || ''), kind: String(x.kind || ''), source: String(x.source || '') })),
      signals: (a.signals || []).slice(0, 12).map(x => ({ kind: String(x.kind || ''), text: String(x.text || '').slice(0, 60), weight: Math.round((Number(x.weight) || 0) * 100) / 100 })),
      reasons: (a.reasons || []).slice(0, 6).map(String),
      dressed: { before: String(d.parts && d.parts.before || ''), after: String(d.parts && d.parts.after || ''), length: d.prompt.length + attachLines(r.files).length },
      cwd: r.effective === 'independent' ? 'free' : 'repo',
    };
  }

  function send(p = {}) {
    if (p.account !== 'A' && p.account !== 'B') return { ok: false, err: 'bad-request', hu: 'Válassz fiókot (A / B).' };
    if (p.model !== undefined && !MODELS.includes(p.model)) return { ok: false, err: 'bad-request', hu: 'Ismeretlen modell.' };
    const r = run(p);
    if (!r.ok) return r;
    const prompt = r.d.prompt + attachLines(r.files);
    const model = p.model || (MODELS.includes(r.a.model) ? r.a.model : '');
    let cwd = repo;
    if (r.effective === 'independent') {
      cwd = freeDir;
      try { fs.mkdirSync(freeDir, { recursive: true }); } catch (e) { return { ok: false, err: 'error', hu: 'A független munkamappa nem jött létre.' }; }
    }
    if (typeof cwd !== 'string' || !path.isAbsolute(cwd)) return { ok: false, err: 'error', hu: 'Nincs munkamappa.' };
    if (!claudeterm || !claudeterm.open) return { ok: false, err: 'error', hu: 'A terminál nem indult el.' };
    log('gate', 'send', p.account, r.a.verdict, r.effective, model, prompt.length);
    const deco = { origin: 'local', account: p.account, title: titleFrom(p.text) || 'Új munkamenet', note: 'Előszűrő: ' + ({ context: 'VRG-kontextus', independent: 'önálló', unsure: 'bizonytalan' }[r.effective] || r.effective) + (model ? ' · ' + model : '') };
    return claudeterm.open({ account: p.account, cwd, firstPrompt: prompt, extraArgs: model ? ['--model', model] : [], deco, maxPrompt: 12000 });
  }

  async function pick({ kind, root } = {}) {
    if (typeof dialog !== 'function') return { ok: false, err: 'error', hu: 'Nincs fájlválasztó.' };
    let opts;
    if (kind === 'browse') opts = { title: 'Fájl csatolása', properties: ['openFile', 'multiSelections'] };
    else if (kind === 'gallery') opts = { title: 'Kép csatolása', defaultPath: pictures, properties: ['openFile', 'multiSelections'], filters: [{ name: 'Képek', extensions: IMAGE_EXT }] };
    else if (kind === 'folder') {
      const f = folders().find(x => x.id === root);
      if (!f) return { ok: false, err: 'not-found', hu: 'Nincs ilyen mappa.' };
      opts = { title: 'Fájl innen: ' + f.hu, defaultPath: f.abs, properties: ['openFile', 'multiSelections'] };
    } else return { ok: false, err: 'bad-request', hu: 'Ismeretlen választó.' };
    const paths = await dialog(opts);
    if (!Array.isArray(paths) || !paths.length) return { ok: false, err: 'cancelled', hu: 'Megszakítva.' };
    const out = paths.slice(0, MAX_ATTACH).map(register).filter(Boolean);
    return out.length ? { ok: true, files: out } : { ok: false, err: 'not-found', hu: 'A fájl nem csatolható (túl nagy vagy nem fájl).' };
  }

  function recent() {
    const list = recentStore ? (() => { try { return recentStore.get(); } catch (e) { return []; } })() : [];
    return { ok: true, files: list.map(register).filter(Boolean) };
  }

  const folderList = () => ({ ok: true, folders: folders().map(f => ({ id: f.id, hu: f.hu })) });

  // a photo from the Vezérlő's camera: a JPEG / PNG data URL saved into inboxDir, then attached like any file
  function photo({ data } = {}) {
    const m = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/.exec(String(data || ''));
    if (!m) return { ok: false, err: 'bad-request', hu: 'Érvénytelen kép.' };
    const buf = Buffer.from(m[2], 'base64');
    if (!buf.length || buf.length > MAX_PHOTO) return { ok: false, err: 'bad-request', hu: 'A kép túl nagy.' };
    if (typeof inboxDir !== 'string' || !path.isAbsolute(inboxDir)) return { ok: false, err: 'error', hu: 'Nincs mappa a fotóknak.' };
    const d = new Date(now()), pad = n => String(n).padStart(2, '0');
    const name = 'foto-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds()) + (m[1] === 'png' ? '.png' : '.jpg');
    try { fs.mkdirSync(inboxDir, { recursive: true }); fs.writeFileSync(path.join(inboxDir, name), buf); } catch (e) { return { ok: false, err: 'error', hu: 'A kép nem menthető.' }; }
    const f = register(path.join(inboxDir, name));
    return f ? { ok: true, file: f } : { ok: false, err: 'error', hu: 'A kép nem csatolható.' };
  }

  return { analyze, send, pick, recent, folders: folderList, photo, attachment: id => table.get(id) || null };
}

module.exports = { createGate, attachLines, titleFrom, MODES, MODELS, MAX_TEXT, MAX_ATTACH };
