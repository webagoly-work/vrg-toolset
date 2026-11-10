// gmail.js — read-only Gmail API client (WP-27). Tokens come from lib/oauth.js; nothing here stores or logs one.
//   const gmail = createGmail({ oauth, providers });
//   list(acc, q, pageToken) → { ok, items:[{ msg, from, subject, date, snippet, unread }], next? }
//   get(acc, id)            → { ok, headers, text, html, attachments:[{ att, name, size, type }] }   (html raw: the pane sanitizes)
//   attachment(acc, msgId, attId) → { ok, data: Buffer, size }      attId 'aN' (from get) or a Gmail attachment id
// 401 → one forced refresh and a retry; 429 / 5xx / network → backoff 1 s, 2 s, 4 s.
'use strict';
const mime = require('./mime.js');

const PAGE = 25, PARALLEL = 5;
const BACKOFF = [1000, 2000, 4000];
const ERR = {
  auth: { ok: false, err: 'reauth', hu: 'A bejelentkezés lejárt, jelentkezz be újra.' },
  rate: { ok: false, err: 'rate', hu: 'A Gmail túl sok kérést kapott, próbáld később.' },
  server: { ok: false, err: 'server', hu: 'A Gmail most nem elérhető.' },
  notFound: { ok: false, err: 'not-found', hu: 'Nincs ilyen levél.' },
  error: { ok: false, err: 'error', hu: 'A Gmail kérés nem sikerült.' },
};

function createGmail({ oauth, providers, fetch: f = globalThis.fetch, sleep = ms => new Promise(r => setTimeout(r, ms)), provider = 'google' }) {
  const api = () => String((providers || {})[provider] && providers[provider].api || '').replace(/\/+$/, '');

  // GET api + rel → { ok, json } | an ERR entry
  async function call(acc, rel) {
    let forced = false, attempt = 0;
    for (;;) {
      const t = await oauth.token(acc, { provider });
      if (!t.ok) return t;
      let status = 0, json = null;
      try {
        const r = await f(api() + rel, { headers: { authorization: 'Bearer ' + t.access } });
        status = r.status;
        if (r.ok) json = await r.json();
      } catch (e) { status = 0; }
      if (status === 200) return { ok: true, json };
      if (status === 401) {
        if (forced) return { ...ERR.auth };
        forced = true;
        const n = await oauth.token(acc, { provider, force: true });
        if (!n.ok) return n;
        continue;
      }
      if (status === 404) return { ...ERR.notFound };
      const retry = status === 0 || status === 429 || status >= 500;
      if (!retry) return { ...ERR.error };
      if (attempt >= BACKOFF.length) return { ...(status === 429 ? ERR.rate : ERR.server) };
      await sleep(BACKOFF[attempt++]);
    }
  }

  async function pool(items, n, fn) {
    const out = new Array(items.length);
    let i = 0;
    await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
    }));
    return out;
  }

  async function list(acc, q, pageToken) {
    let rel = '/users/me/messages?maxResults=' + PAGE;
    if (q) rel += '&q=' + encodeURIComponent(q);
    if (pageToken) rel += '&pageToken=' + encodeURIComponent(pageToken);
    const r = await call(acc, rel);
    if (!r.ok) return r;
    const ids = (Array.isArray(r.json.messages) ? r.json.messages : []).map(m => m && m.id).filter(id => typeof id === 'string').slice(0, PAGE);
    const metas = await pool(ids, PARALLEL, id => call(acc, '/users/me/messages/' + encodeURIComponent(id) + '?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date'));
    const items = ids.map((id, k) => {
      const m = metas[k].ok ? metas[k].json : {};
      const h = {};
      for (const x of (m.payload && m.payload.headers) || []) if (x && typeof x.name === 'string') h[x.name.toLowerCase()] = mime.decodeWords(String(x.value || ''));
      return { msg: id, from: h.from || '', subject: h.subject || '', date: h.date || '', snippet: String(m.snippet || ''), unread: Array.isArray(m.labelIds) && m.labelIds.includes('UNREAD') };
    });
    return { ok: true, items, ...(typeof r.json.nextPageToken === 'string' ? { next: r.json.nextPageToken } : {}) };
  }

  async function raw(acc, id) {
    const r = await call(acc, '/users/me/messages/' + encodeURIComponent(id) + '?format=raw');
    if (!r.ok) return r;
    if (!r.json || typeof r.json.raw !== 'string') return { ...ERR.error };
    return { ok: true, parsed: mime.parse(Buffer.from(r.json.raw, 'base64url')) };
  }

  async function get(acc, id) {
    const r = await raw(acc, id);
    if (!r.ok) return r;
    const p = r.parsed;
    return { ok: true, headers: p.headers, text: p.text, html: p.html, attachments: p.attachments };
  }

  async function attachment(acc, msgId, attId) {
    const own = /^a(\d{1,3})$/.exec(String(attId));
    if (own) {                                                                       // ids from get(): the bytes are in the raw message
      const r = await raw(acc, msgId);
      if (!r.ok) return r;
      const a = r.parsed.attachments.find(x => x.att === attId);
      return a ? { ok: true, data: a.data, size: a.data.length } : { ...ERR.notFound };
    }
    const r = await call(acc, '/users/me/messages/' + encodeURIComponent(msgId) + '/attachments/' + encodeURIComponent(attId));
    if (!r.ok) return r;
    if (!r.json || typeof r.json.data !== 'string') return { ...ERR.error };
    const data = Buffer.from(r.json.data, 'base64url');
    return { ok: true, data, size: data.length };
  }

  return { list, get, attachment };
}

module.exports = { createGmail };
