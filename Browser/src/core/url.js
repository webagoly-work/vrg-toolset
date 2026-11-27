// url.js — the omnibox's rules (VRG Böngésző): what a typed line means, how a search URL is built, which tracking
// parameters a link loses, and what about a link deserves a warning. Pure: no DOM, so node --test loads it.
//   VB.url.classify(text, { engines, engine }) → { kind: 'url'|'search'|'internal'|'answer'|'blocked'|'empty', … }
//   VB.url.searchUrl(engine, q) · VB.url.clean(url) → { url, removed } · VB.url.assess(url) → [{ code, level, hu }]
(function (root) {
  'use strict';
  const VB = root.VB = root.VB || {};
  if (VB.url) return;

  // file-like endings that look like a domain but are not one ("ajanlat.pdf", "terv.dwg")
  const NOT_TLD = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'json', 'md', 'jpg', 'jpeg', 'png', 'gif',
    'svg', 'webp', 'zip', 'rar', '7z', 'dwg', 'dxf', 'exe', 'msi', 'cmd', 'bat', 'ps1', 'js', 'css', 'html', 'htm', 'xml', 'mp3', 'mp4',
    'kml', 'kmz', 'stl', 'step', 'stp', 'ino', 'cpp', 'py', 'log', 'ini', 'yml', 'yaml']);
  const INTERNAL = ['kezdolap', 'kereses', 'konyvjelzok', 'elozmenyek', 'olvaso', 'beallitasok', 'sugo'];
  const BLOCKED_SCHEMES = /^(javascript|data|vbscript|file|blob|about|chrome|edge|view-source|intent|filesystem):/i;
  const MAX_INPUT = 2000;

  const isIPv4 = h => /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.test(h) && h.split('.').every(p => +p <= 255);
  const isLocalName = h => h === 'localhost' || /\.localhost$/.test(h) || /\.local$/.test(h);
  function isPrivateHost(h) {
    h = String(h || '').toLowerCase().replace(/^\[|\]$/g, '');
    if (isLocalName(h) || h === '::1') return true;
    if (!isIPv4(h)) return false;
    const [a, b] = h.split('.').map(Number);
    return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
  }

  // "index.hu", "tme.eu/hu/…", "localhost:8808", "192.168.1.1/admin" → a URL with the scheme it needs, or ''
  function asUrl(t) {
    if (/\s/.test(t)) return '';
    if (/^https?:\/\//i.test(t)) { try { return new URL(t).href; } catch (e) { return ''; } }
    const m = /^([^/?#:]+)(:\d{1,5})?([/?#].*)?$/.exec(t);
    if (!m) return '';
    const host = m[1].toLowerCase();
    if (host === 'localhost' || isIPv4(host) || /\.localhost$/.test(host)) {
      try { return new URL('http://' + t).href; } catch (e) { return ''; }
    }
    const labels = host.split('.');
    if (labels.length < 2 || labels.some(l => !l || l.length > 63 || !/^[a-z0-9¡-￿-]+$/i.test(l) || /^-|-$/.test(l))) return '';
    const tld = labels[labels.length - 1];
    if (!/^([a-z¡-￿]{2,24}|xn--[a-z0-9-]{2,59})$/i.test(tld) || NOT_TLD.has(tld)) return '';
    try { return new URL((isPrivateHost(host) ? 'http://' : 'https://') + t).href; } catch (e) { return ''; }
  }

  // a bang at the start ("!w Ohm törvénye") or the end ("Ohm törvénye !w")
  function bangOf(t, engines) {
    const m = /^!([a-z0-9]{1,12})(?:\s+(.*))?$/i.exec(t) || /^(.*?)\s+!([a-z0-9]{1,12})$/i.exec(t);
    if (!m) return null;
    const [bang, q] = t.startsWith('!') ? [m[1], m[2] || ''] : [m[2], m[1]];
    const e = (engines || []).find(x => (x.bangs || []).includes(bang.toLowerCase()));
    return e ? { engine: e, q: q.trim() } : { unknown: bang.toLowerCase(), q: q.trim() };
  }

  function classify(text, opts) {
    const o = opts || {};
    const t = String(text == null ? '' : text).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, MAX_INPUT);
    if (!t) return { kind: 'empty' };
    const im = /^vrg:\/?\/?([a-z]+)(?:[/?](.*))?$/i.exec(t);
    if (im) {
      const page = im[1].toLowerCase();
      return INTERNAL.includes(page) ? { kind: 'internal', page, arg: im[2] || '' } : { kind: 'search', q: t, engine: pick(o) };
    }
    if (t.startsWith('=')) return { kind: 'answer', q: t.slice(1).trim() };
    if (BLOCKED_SCHEMES.test(t)) return { kind: 'blocked', q: t, hu: 'Ilyen címet a VRG Böngésző nem nyit meg.' };
    const b = bangOf(t, o.engines);
    if (b && b.engine) return { kind: 'search', q: b.q, engine: b.engine, bang: true };
    const u = asUrl(t);
    if (u) return { kind: 'url', url: u };
    if (b && b.unknown) return { kind: 'search', q: t, engine: pick(o), unknownBang: b.unknown };
    return { kind: 'search', q: t, engine: pick(o) };
  }
  function pick(o) {
    const list = (o && o.engines) || [];
    return list.find(e => e.id === (o && o.engine)) || list.find(e => e.default) || list[0] || null;
  }

  function searchUrl(engine, q) {
    if (!engine || typeof engine.url !== 'string') return '';
    const s = String(q || '').trim();
    if (!s && engine.home) return engine.home;
    return engine.url.split('{q}').join(encodeURIComponent(s));
  }

  // tracking parameters: removed before a link is opened or saved (Tiszta link)
  const TRACK = [/^utm_/i, /^(fbclid|gclid|gclsrc|dclid|gbraid|wbraid|msclkid|yclid|twclid|ttclid|li_fat_id|igshid|igsh|mc_cid|mc_eid|_hsenc|_hsmi|__hstc|__hssc|__hsfp|hsctatracking|mkt_tok|oly_anon_id|oly_enc_id|vero_id|_openstat|ref_src|ref_url|spm|scm|__s)$/i];
  function clean(url) {
    let u;
    try { u = new URL(url); } catch (e) { return { url: String(url || ''), removed: [] }; }
    if (!/^https?:$/.test(u.protocol)) return { url: u.href, removed: [] };
    const removed = [];
    for (const k of [...u.searchParams.keys()]) if (TRACK.some(r => r.test(k)) && !removed.includes(k)) removed.push(k);
    for (const k of removed) u.searchParams.delete(k);
    // Google's redirect wrapper: /url?q=<target>
    if (/(^|\.)google\.[a-z.]+$/.test(u.hostname) && u.pathname === '/url' && /^https?:\/\//.test(u.searchParams.get('q') || u.searchParams.get('url') || '')) {
      return { url: clean(u.searchParams.get('q') || u.searchParams.get('url')).url, removed: removed.concat(['google-redirect']) };
    }
    let href = u.href;
    if (!u.search && href.endsWith('?')) href = href.slice(0, -1);
    return { url: href, removed };
  }

  // warnings about a link, worst first: crit = do not trust, warn = think twice, info = good to know
  function assess(url) {
    const out = [];
    let u;
    try { u = new URL(url); } catch (e) { return [{ code: 'invalid', level: 'crit', hu: 'Érvénytelen cím.' }]; }
    const h = u.hostname.toLowerCase();
    const local = isPrivateHost(h);
    if (u.username || u.password) out.push({ code: 'credentials', level: 'crit', hu: 'A címben felhasználónév vagy jelszó van — adathalász trükk lehet.' });
    if (/(^|\.)xn--/.test(h)) out.push({ code: 'punycode', level: 'warn', hu: 'Nemzetközi (punycode) domain: nézd meg betűre, hogy valóban az-e, aminek látszik.' });
    if (u.protocol === 'http:' && !local) out.push({ code: 'http', level: 'warn', hu: 'Titkosítatlan kapcsolat (http): jelszót, adatot itt ne adj meg.' });
    if (isIPv4(h) && !local) out.push({ code: 'ip', level: 'warn', hu: 'Nyers IP-cím domain helyett.' });
    if (local) out.push({ code: 'local', level: 'info', hu: 'Helyi cím: ez a gép vagy a helyi hálózat.' });
    if (u.href.length > 1500) out.push({ code: 'long', level: 'info', hu: 'Szokatlanul hosszú cím.' });
    const rank = { crit: 0, warn: 1, info: 2 };
    return out.sort((a, b) => rank[a.level] - rank[b.level]);
  }

  function display(url) {
    try {
      const u = new URL(url);
      let s = (u.protocol === 'https:' ? '' : u.protocol + '//') + u.host + (u.pathname === '/' ? '' : u.pathname) + u.search + u.hash;
      try { s = decodeURI(s); } catch (e) {}
      return s;
    } catch (e) { return String(url || ''); }
  }
  const hostOf = url => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
  const isWeb = url => { try { return /^https?:$/.test(new URL(url).protocol); } catch (e) { return false; } };

  const api = { classify, asUrl, searchUrl, clean, assess, display, hostOf, isWeb, isPrivateHost, INTERNAL };
  VB.url = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
