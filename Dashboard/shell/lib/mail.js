// mail.js — the vrg.mail surface (WP-27, WP-28): Gmail API accounts (OAuth) and the webmail presets (WP-26, kind 'web') in one list.
//   const mail = createMail({ oauth, gmail, presets: () => [...config/web.json], jobs, downloadsDir, sanitize, readView, template });
//   accounts() · signIn(acc) · signOut(acc) · list(acc, q, page) · get(acc, msg) · render(acc, msg, images) · saveAttachment(acc, msg, att) · closeView()
// A token never leaves main: the page sees ids and the bool signedIn. Web accounts sign in inside their own pane.
// WP-28: the raw HTML of a message is sanitized in main (createSanitizer: DOMPurify inside a hidden, sandboxed helper view with no preload),
// so it never reaches a page that has window.vrg. The read view (views.createMailView) gets only the sanitized document.
'use strict';

const API_ACCOUNTS = [{ acc: 'gmail-api', hu: 'Gmail (API)', provider: 'google' }];
const WEB_ONLY = { ok: false, err: 'bad-request', hu: 'Ez a fiók a böngészőpanelben jelentkezik be.' };
const UNKNOWN = { ok: false, err: 'not-found', hu: 'Nincs ilyen fiók.' };
const NO_VIEW = { ok: false, err: 'unavailable', hu: 'Az olvasó nézet most nem elérhető.' };
const NO_ATT = { ok: false, err: 'not-found', hu: 'Nincs ilyen melléklet.' };
const BODY_MAX = 1500000;                                              // a data: URL document stays well under Chromium's 2 MB limit

// ------------------------------------------------------------ pure helpers (unit tests)
// Content-Security-Policy of the read view. Remote images only after "Képek betöltése" (this message only).
// `loopback` adds http://127.0.0.1 and exists for the selftest's mock server; main passes it only under --selftest.
function cspFor({ images = false, loopback = false } = {}) {
  const img = (images ? 'https: ' + (loopback ? 'http://127.0.0.1:* ' : '') : '') + 'data: cid:';
  return "default-src 'none'; img-src " + img + "; style-src 'unsafe-inline'";
}

// What a click on a link in a message may do (the read view has no script; main sees will-navigate / window.open).
const COPYABLE = /^[^\s<>,;"'()]{1,100}@[^\s<>,;"'()]{1,100}$/;
function linkPolicy(raw) {
  let u;
  try { u = new URL(String(raw)); } catch (e) { return { ok: false, action: 'refuse' }; }
  if (u.protocol === 'http:' || u.protocol === 'https:') return { ok: true, action: 'web', url: u.href };
  if (u.protocol === 'mailto:') {
    let address = u.pathname;
    try { address = decodeURIComponent(address); } catch (e) {}
    return COPYABLE.test(address) ? { ok: false, action: 'refuse', offer: 'copy-address', address, hu: 'Cím másolása' } : { ok: false, action: 'refuse' };
  }
  if (u.protocol === 'cid:') return { ok: false, action: 'inline-only' };          // an image source inside the message, never a navigation
  return { ok: false, action: 'refuse' };                                         // javascript:, data:, file:, chrome: …
}

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// the template (page/mailview.html) with {{csp}}, {{head}}, {{body}} filled; replacer functions, so `$&` in a mail is just text
function renderDoc(template, { csp, headers = {}, html = '', text = '' }) {
  const head = ['from', 'subject', 'date'].filter(k => headers[k]).map(k => '<div data-role="mail-' + k + '">' + esc(headers[k]) + '</div>').join('');
  let body = html || '<pre data-role="mail-text">' + esc(text) + '</pre>';
  if (body.length > BODY_MAX) body = body.slice(0, BODY_MAX);
  return String(template).replace('{{csp}}', () => esc(csp)).replace('{{head}}', () => head).replace('{{body}}', () => body);
}

const hasRemoteImages = html => /<img\b[^>]*\bsrc\s*=\s*["']?\s*https?:/i.test(String(html || ''));

// DOMPurify settings for mail. Runs in the helper view; ALLOWED_URI_REGEXP travels as a source string (a RegExp is not JSON).
const SANITIZE = Object.freeze({
  uri: '^(?:https?:|mailto:|cid:|data:image/)',
  forbidTags: Object.freeze(['script', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'form', 'input', 'button', 'textarea', 'select',
    'link', 'meta', 'base', 'svg', 'math', 'video', 'audio', 'source', 'track', 'template']),
  forbidAttr: Object.freeze(['srcdoc', 'formaction', 'action', 'ping', 'target', 'autofocus']),
});
const sanitizeCall = html => '(function(h){return DOMPurify.sanitize(h,{USE_PROFILES:{html:true},FORCE_BODY:true,ALLOW_DATA_ATTR:false,ALLOW_UNKNOWN_PROTOCOLS:false,'
  + 'FORBID_TAGS:' + JSON.stringify(SANITIZE.forbidTags) + ',FORBID_ATTR:' + JSON.stringify(SANITIZE.forbidAttr)
  + ',ALLOWED_URI_REGEXP:new RegExp(' + JSON.stringify(SANITIZE.uri) + ',"i")});})(' + JSON.stringify(String(html)) + ')';

// The helper: a WebContentsView that is never attached to a window (so it never keeps the app alive), no preload, sandbox, own in-memory
// partition. DOMPurify parses with DOMParser (inert: nothing runs, nothing loads). `source()` returns the text of purify.min.js.
function createSanitizer({ WebContentsView, webPrefs, source, log = () => {} }) {
  let view = null, ready = null;
  const start = () => {
    view = new WebContentsView({ webPreferences: webPrefs('vrg-mailsan') });
    const wc = view.webContents;
    wc.setWindowOpenHandler(() => ({ action: 'deny' }));
    wc.on('will-navigate', ev => ev.preventDefault());
    return wc.loadURL('about:blank').then(() => wc.executeJavaScript(String(source()) + '\n;typeof DOMPurify', true))
      .then(t => { if (t !== 'function') throw new Error('DOMPurify missing'); });
  };
  async function sanitize(html) {
    if (!ready) ready = start().catch(e => { log('mail sanitizer failed: ' + e.message); ready = null; throw e; });
    await ready;
    const out = await view.webContents.executeJavaScript(sanitizeCall(html), true);
    return typeof out === 'string' ? out : '';
  }
  const close = () => { try { if (view && !view.webContents.isDestroyed()) view.webContents.close(); } catch (e) {} view = null; ready = null; };
  return { sanitize, close };
}

// ------------------------------------------------------------ the module
function createMail({ oauth, gmail, presets = () => [], jobs = null, downloadsDir = () => null, sanitize = null, readView = null, template = '', loopback = () => false, fs = require('fs'), path = require('path') }) {
  const web = () => (presets() || []).filter(p => p && p.mail === true && /^[a-z0-9_-]{1,40}$/.test(String(p.id)))
    .map(p => ({ acc: 'web:' + p.id, kind: 'web', hu: String(p.hu || p.id), signedIn: false }));
  const api = acc => API_ACCOUNTS.find(a => a.acc === acc) || null;
  const guard = acc => api(acc) ? null : (String(acc).startsWith('web:') && web().some(w => w.acc === acc) ? { ...WEB_ONLY } : { ...UNKNOWN });
  const clean = async html => (html && sanitize ? sanitize(html) : '');           // no sanitizer → no HTML at all (fail closed)

  async function get(acc, msg) {
    const g = guard(acc); if (g) return g;
    const r = await gmail.get(acc, msg);
    if (!r.ok) return r;
    let html = '';
    try { html = await clean(r.html); } catch (e) { html = ''; }
    return { ...r, html };
  }

  async function render(acc, msg, images) {
    if (!readView) return { ...NO_VIEW };
    const r = await get(acc, msg);
    if (!r.ok) return r;
    const csp = cspFor({ images: images === true, loopback: loopback() === true });
    const doc = renderDoc(template, { csp, headers: r.headers || {}, html: r.html, text: r.text });
    readView.show(doc, { images: images === true });
    return { ok: true, view: 'mailview', remote: hasRemoteImages(r.html), images: images === true };
  }

  // asks first, then fetches and writes into the Downloads root under a free name; never opened automatically
  async function saveAttachment(acc, msg, att) {
    const g = guard(acc); if (g) return g;
    if (!jobs) return { ...NO_VIEW };
    const m = await gmail.get(acc, msg);
    if (!m.ok) return m;
    const a = (m.attachments || []).find(x => x.att === att);
    if (!a) return { ...NO_ATT };
    const { safeDownloadName, uniqueName } = require('./web.js');
    const name = safeDownloadName(a.name);
    const job = jobs.create({
      kind: 'mail-save', hu: 'Melléklet mentése: ' + name, steps: 1,
      run: async ctx => {
        const choice = await ctx.ask({ hu: 'Mented a mellékletet a Letöltések mappába? ' + name, choices: ['yes', 'cancel'] });
        if (choice !== 'yes') { jobs.cancel(ctx.job); return; }
        const dir = downloadsDir();
        if (!dir) throw new Error('no downloads root');
        const d = await gmail.attachment(acc, msg, att);
        if (!d.ok) throw new Error(d.err || 'attachment');
        fs.mkdirSync(dir, { recursive: true });
        let done = false;
        for (let i = 0; i < 50 && !done; i++) {
          const target = path.join(dir, uniqueName(name, n => fs.existsSync(path.join(dir, n))));
          try { fs.writeFileSync(target, d.data, { flag: 'wx' }); done = true; } catch (e) { if (e.code !== 'EEXIST') throw e; }
        }
        if (!done) throw new Error('no free name');
        ctx.progress(1, 1);
      },
    });
    return { ok: true, job };
  }

  return {
    accounts: () => [
      ...API_ACCOUNTS.map(a => ({ acc: a.acc, kind: 'gmail', hu: a.hu, signedIn: oauth.signedIn(a.acc, a.provider) })),
      ...web(),
    ],
    signIn: async acc => { const g = guard(acc); if (g) return g; const r = await oauth.signIn(acc, api(acc).provider); return r.ok ? { ok: true } : r; },
    signOut: async acc => { const g = guard(acc); if (g) return g; return oauth.signOut(acc, api(acc).provider); },
    list: async (acc, q, page) => { const g = guard(acc); return g || gmail.list(acc, q || '', page || ''); },
    get, render, saveAttachment,
    closeView: () => { if (readView) readView.hide(); return { ok: true }; },
  };
}

module.exports = { createMail, createSanitizer, API_ACCOUNTS, cspFor, linkPolicy, renderDoc, hasRemoteImages, SANITIZE, sanitizeCall };
