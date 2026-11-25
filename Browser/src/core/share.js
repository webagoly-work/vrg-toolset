// share.js — T9 (docs/browser/TRAJECTORIES.md, BRW-Q05 … Q07): sharing links, pure functions used by the app and serve.js.
//
//   Shared lists (BRW-Q06 = B, Q07 = C): a named list is a `vrg.web-links` v1 file in the shared OneDrive tree,
//   VRG-Megosztott\60_Linkek\<slug>.links.json. It carries everything of what it holds (bookmarks with their tags, job
//   codes and notes, reading-list items with their saved text); never the history. Only the people the folder is
//   shared with see it ("Adott személyek").
//     VB.share.pick(doc, { from, tag, job }) → a v1 doc with only the chosen rows (its x-bongeszo extension trimmed to them)
//     VB.share.listFile(doc, { name, by, at }) → the file's JSON text   ·   VB.share.slug(name) → a safe file name part
//   The guest page (BRW-Q05 = A): one static HTML file, `linkek.html`, next to the Kapu in VRG-Megosztott\00_START, opened by
//   the Kapu's "Linkek (vendég)" button without signing in. Only what is safe for anyone goes in:
//     VB.share.guest(doc, { jobs }) → { items: [{ url, title }], dropped: [{ url, title, why, hu }] }
//     VB.share.guestHtml(items, { title, built }) → the page: no script, a CSP that allows nothing but its own style,
//                                                  no referrer, every link opened as a new tab without an opener
//   A link is left out when it is not https, points at this PC, the LAN or a raw IP, carries a user name or a secret-looking
//   parameter (token, key, sig, password, session …), sits on a private file store (Google Drive / Docs, OneDrive,
//   SharePoint, Dropbox, iCloud, WeTransfer), names one of the PC's job codes (or an old VRG-ÉÉHH-NN one) in its URL or
//   title, or is tied to a job. Tracking parameters are stripped; notes and tags never go.
(function (root) {
  'use strict';
  const VB = root.VB = root.VB || {};
  if (VB.share) return;
  const U = VB.url || (typeof require === 'function' ? require('./url.js') : null);
  const EXT = 'x-bongeszo';
  const FORMAT = 'vrg.web-links';

  const SECRET = /^(token|access_token|id_token|refresh_token|auth|authorization|key|apikey|api_key|sig|signature|password|passwd|pass|pwd|secret|session|sessionid|sid|code|otp|credential|x-amz-[a-z-]+|x-goog-[a-z-]+|se|sp|sv)$/i;
  const PRIVATE_STORE = /(^|\.)(drive\.google\.com|docs\.google\.com|onedrive\.live\.com|1drv\.ms|sharepoint\.com|dropbox\.com|dropboxusercontent\.com|icloud\.com|wetransfer\.com|we\.tl|mega\.nz|box\.com)$/i;
  const OLD_JOB = /VRG-\d{4}-\d{2}/i;

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tidy = s => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();

  function slug(name) {
    const s = tidy(name).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
    return s || 'lista';
  }

  // ---- shared lists
  /** The rows chosen for a list: from 'bookmarks' | 'reading' | 'both' (default), narrowed by a tag and / or a job. */
  function pick(doc, o) {
    const opt = o || {};
    const from = opt.from || 'both';
    const ext = (doc && doc[EXT]) || {};
    const meta = ext.meta || {};
    const tag = tidy(opt.tag).toLowerCase().replace(/^#/, '');
    const job = tidy(opt.job).toUpperCase();
    const fits = (tags, j) => (!tag || (tags || []).map(t => String(t).toLowerCase()).includes(tag)) && (!job || String(j || '').toUpperCase() === job);
    const bookmarks = from === 'reading' ? [] : ((doc && doc.bookmarks) || []).filter(b => b && U.isWeb(b.url) && fits((meta[b.url] || {}).tags, (meta[b.url] || {}).job));
    const reading = from === 'bookmarks' ? [] : (ext.reading || []).filter(r => r && U.isWeb(r.url) && fits(r.tags, r.job));
    const keep = new Set(bookmarks.map(b => b.url));
    const m = {};
    for (const u of Object.keys(meta)) if (keep.has(u)) m[u] = meta[u];
    return { format: FORMAT, v: 1, bookmarks, history: [], [EXT]: { meta: m, reading } };
  }

  /** The file a shared list is: the v1 envelope, the rows, and who shared it when (x-bongeszo.share). */
  function listFile(doc, o) {
    const opt = o || {};
    const ext = Object.assign({}, (doc && doc[EXT]) || {});
    ext.share = { name: tidy(opt.name).slice(0, 120) || 'Lista', by: tidy(opt.by).slice(0, 60), at: opt.at || new Date().toISOString() };
    delete ext.research;                                           // notebooks are not a list
    return JSON.stringify({ format: FORMAT, v: 1, exported: ext.share.at.slice(0, 10), bookmarks: (doc && doc.bookmarks) || [], history: [], [EXT]: ext }, null, 1);
  }

  /** What a shared list says about itself, for the list of lists. */
  function summary(doc) {
    const ext = (doc && doc[EXT]) || {};
    const s = ext.share || {};
    return { name: tidy(s.name) || 'Lista', by: tidy(s.by), at: String(s.at || ''), bookmarks: ((doc && doc.bookmarks) || []).length, reading: (ext.reading || []).length };
  }

  // ---- the guest page
  function why(url, title, jobRe, tied) {
    if (!U.isWeb(url)) return ['scheme', 'nem webcím'];
    let x;
    try { x = new URL(url); } catch (e) { return ['bad', 'hibás cím']; }
    if (x.protocol !== 'https:') return ['http', 'titkosítatlan (http)'];
    if (x.username || x.password) return ['user', 'felhasználónév a címben'];
    const host = x.hostname.toLowerCase();
    if (U.isPrivateHost(host) || /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':') || !host.includes('.')) return ['private', 'ez a gép, a helyi hálózat vagy nyers IP'];
    if (PRIVATE_STORE.test(host)) return ['store', 'magán tárhely-link (Drive, OneDrive, Dropbox …)'];
    for (const k of x.searchParams.keys()) if (SECRET.test(k)) return ['secret', 'titkosnak látszó paraméter (' + k + ')'];
    if (tied) return ['job', 'munkához kötött'];
    if (OLD_JOB.test(url + ' ' + title) || (jobRe && jobRe.test(url + ' ' + title))) return ['job', 'munkaszám szerepel benne'];
    return null;
  }

  function guest(doc, o) {
    const opt = o || {};
    const codes = (opt.jobs || []).map(c => String(c).toUpperCase()).filter(c => /^[A-Z]{1,3}\d{1,3}$/.test(c));
    const jobRe = codes.length ? new RegExp('(^|[^A-Za-z0-9])(' + codes.join('|') + ')(?![0-9])', 'i') : null;
    const ext = (doc && doc[EXT]) || {};
    const meta = ext.meta || {};
    const rows = ((doc && doc.bookmarks) || []).map(b => ({ url: b && b.url, title: b && b.title, job: (meta[b && b.url] || {}).job }))
      .concat((ext.reading || []).map(r => ({ url: r && r.url, title: r && r.title, job: r && r.job })));
    const items = [], dropped = [], seen = new Set();
    for (const r of rows) {
      const raw = String(r.url || '');
      const url = U.isWeb(raw) ? U.clean(raw).url : raw;
      const title = tidy(r.title).slice(0, 200);
      if (seen.has(url)) continue;
      seen.add(url);
      const w = why(url, title, jobRe, !!r.job);
      if (w) dropped.push({ url, title, why: w[0], hu: w[1] });
      else items.push({ url, title: title || U.hostOf(url) });
    }
    return { items, dropped };
  }

  function guestHtml(items, o) {
    const opt = o || {};
    const title = tidy(opt.title).slice(0, 120) || 'Linkgyűjtemény';
    const built = tidy(opt.built).slice(0, 10);
    const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
    const rows = (items || []).filter(x => x && /^https:\/\//.test(x.url)).map(x =>
      '<li><a href="' + esc(x.url) + '" target="_blank" rel="noopener noreferrer">' + esc(x.title || host(x.url)) + '</a><span>' + esc(host(x.url)) + '</span></li>');
    return [
      '<!doctype html>',
      '<html lang="hu"><head><meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; base-uri \'none\'; form-action \'none\'">',
      '<meta name="referrer" content="no-referrer">',
      '<title>' + esc(title) + ' · VRG</title>',
      '<style>',
      ':root{--bg:#06121c;--card:#0b2232;--ink:#e6f1f7;--muted:#8fb0c2;--glow:#5fd4e8;--line:#1d3b4f}',
      '@media (prefers-color-scheme:light){:root{--bg:#f4f8fb;--card:#fff;--ink:#0b2232;--muted:#4b6676;--glow:#0a7c94;--line:#d3e2ea}}',
      'body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}',
      'main{max-width:720px;margin:0 auto;padding:24px 16px 48px}',
      'h1{font-size:22px;margin:0 0 4px;letter-spacing:.02em}p{color:var(--muted);margin:0 0 20px;font-size:14px}',
      'ul{list-style:none;margin:0;padding:0;background:var(--card);border:1px solid var(--line);border-radius:12px}',
      'li{display:flex;flex-wrap:wrap;gap:4px 12px;align-items:baseline;justify-content:space-between;padding:12px 16px;border-top:1px solid var(--line)}',
      'li:first-child{border-top:0}a{color:var(--glow);text-decoration:none;font-weight:600;overflow-wrap:anywhere}a:hover{text-decoration:underline}',
      'li span{color:var(--muted);font-size:13px}.empty{padding:16px;color:var(--muted)}',
      'footer{margin-top:20px;color:var(--muted);font-size:12px}',
      '</style></head><body><main>',
      '<h1>' + esc(title) + '</h1>',
      '<p>Nyilvános linkek a VRG-től. A linkek új lapon nyílnak meg; ez az oldal nem futtat programot és nem tárol semmit.</p>',
      rows.length ? '<ul>' + rows.join('') + '</ul>' : '<div class="empty">Még nincs megosztott link.</div>',
      '<footer>' + (rows.length ? rows.length + ' link' : 'üres') + (built ? ' · ' + esc(built) : '') + ' · VRG Böngésző</footer>',
      '</main></body></html>',
      ''
    ].join('\n');
  }

  const api = { pick, listFile, summary, slug, guest, guestHtml, SECRET, PRIVATE_STORE };
  VB.share = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
