// mail.js — the vrg.mail surface (WP-27, WP-28): Gmail API accounts (OAuth) and the webmail presets (WP-26, kind 'web') in one list.
//   const mail = createMail({ oauth, gmail, presets: () => [...config/web.json], jobs, downloadsDir, readView, template });
//   accounts() · signIn(acc) · signOut(acc) · list(acc, q, page) · get(acc, msg) · render(acc, msg, images, html?) · saveAttachment(acc, msg, att) · closeView()
// A token never leaves main: the page sees ids and the bool signedIn. Web accounts sign in inside their own pane.
// DESK-Q73 B (WP-35a): get() returns the message HTML as Gmail sent it; the Posta pane cleans it with DOMPurify (lib/mailclean.js) and hands
// the cleaned HTML to render(). The read view (views.createMailView) stays the safety net: no preload, JavaScript off, a CSP without script-src.
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

const { SANITIZE } = require('./mailclean.js');
const hasRemoteImages = html => /<img\b[^>]*\bsrc\s*=\s*["']?\s*https?:/i.test(String(html || ''));

// ------------------------------------------------------------ the module
function createMail({ oauth, gmail, presets = () => [], jobs = null, downloadsDir = () => null, readView = null, template = '', loopback = () => false, fs = require('fs'), path = require('path') }) {
  const web = () => (presets() || []).filter(p => p && p.mail === true && /^[a-z0-9_-]{1,40}$/.test(String(p.id)))
    .map(p => ({ acc: 'web:' + p.id, kind: 'web', hu: String(p.hu || p.id), signedIn: false }));
  const api = acc => API_ACCOUNTS.find(a => a.acc === acc) || null;
  const guard = acc => api(acc) ? null : (String(acc).startsWith('web:') && web().some(w => w.acc === acc) ? { ...WEB_ONLY } : { ...UNKNOWN });
  async function get(acc, msg) {
    const g = guard(acc); if (g) return g;
    const r = await gmail.get(acc, msg);
    return r.ok ? { ...r, html: typeof r.html === 'string' ? r.html : '' } : r;
  }

  // html = what the pane cleaned (mailclean.js); without it (no DOMPurify in the page) the read view shows the text part only
  async function render(acc, msg, images, html) {
    if (!readView) return { ...NO_VIEW };
    const r = await get(acc, msg);
    if (!r.ok) return r;
    const body = typeof html === 'string' ? html : '';
    const csp = cspFor({ images: images === true, loopback: loopback() === true });
    const doc = renderDoc(template, { csp, headers: r.headers || {}, html: body, text: r.text });
    readView.show(doc, { images: images === true });
    return { ok: true, view: 'mailview', remote: hasRemoteImages(body), images: images === true };
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

module.exports = { createMail, API_ACCOUNTS, cspFor, linkPolicy, renderDoc, hasRemoteImages, SANITIZE };
