// oauth.js — OAuth 2.0 for installed apps (RFC 8252): PKCE S256 (RFC 7636), a one-shot loopback redirect, the system browser (WP-27).
// Tokens live only in secrets.bin (DPAPI, lib/secrets.js) under 'oauth:<provider>:<acc>'; nothing secret is logged or returned to the page.
//   const oauth = createOAuth({ secrets, audit, providers, opener });
//   await oauth.signIn('gmail-api')  → { ok:true, email } | { ok:false, err, hu }       (opener(url) shows the consent page)
//   await oauth.token('gmail-api')   → { ok:true, access }   refreshes when < 60 s are left;  { force:true } refreshes now
//   await oauth.signOut('gmail-api') → { ok:true, revoked }
// The client id (and the secret Google desktop clients carry) come from <home>/oauth-clients.json, written by the Founder by hand.
'use strict';
const crypto = require('crypto'), http = require('http'), fs = require('fs'), path = require('path');
const paths = require('./paths.js');

const NO_CLIENT = { ok: false, err: 'no-client', hu: 'Nincs OAuth kliens beállítva (oauth-clients.json).' };
const REAUTH = { ok: false, err: 'reauth', hu: 'A bejelentkezés lejárt, jelentkezz be újra.' };
const SOON_MS = 60 * 1000;
const b64u = b => Buffer.from(b).toString('base64url');
const accOk = a => typeof a === 'string' && /^[a-z0-9_-]{1,40}$/.test(a);
const secretName = (provider, acc) => 'oauth:' + provider + ':' + acc;
const page = (hu, en) => '<!doctype html><meta charset="utf-8"><title>VRG</title><p>' + hu + '</p><p lang="en"><i>' + en + '</i></p>';

function loadProviders(file = path.join(__dirname, '..', '..', 'config', 'oauth-providers.json')) {
  try { const j = JSON.parse(fs.readFileSync(file, 'utf8')); return j && typeof j === 'object' ? j : {}; } catch (e) { return {}; }
}

function readClient(provider) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(paths.home(), 'oauth-clients.json'), 'utf8'));
    const c = j && j[provider];
    return c && typeof c.client_id === 'string' && c.client_id ? { id: c.client_id, secret: typeof c.client_secret === 'string' ? c.client_secret : '' } : null;
  } catch (e) { return null; }
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function createOAuth({ secrets, audit, providers, opener, fetch: f = globalThis.fetch, now = Date.now, timeoutMs = 5 * 60 * 1000 }) {
  const prov = providers || loadProviders();
  const w = e => { try { audit && audit.write(e); } catch (x) {} };
  const inflight = new Map();

  async function post(url, form) {
    try {
      const r = await f(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form.toString() });
      let json = null; try { json = await r.json(); } catch (e) {}
      return { status: r.status, json };
    } catch (e) { return { status: 0, json: null }; }
  }

  async function profileEmail(P, access) {
    if (!P.api) return '';
    try {
      const r = await f(P.api + '/users/me/profile', { headers: { authorization: 'Bearer ' + access } });
      const j = r.ok ? await r.json() : null;
      return j && typeof j.emailAddress === 'string' ? j.emailAddress : '';
    } catch (e) { return ''; }
  }

  async function signIn(acc, provider = 'google') {
    const P = prov[provider];
    if (!P || !accOk(acc)) return { ok: false, err: 'bad-request', hu: 'Érvénytelen kérés.' };
    const client = readClient(provider);
    if (!client) { w({ ch: 'oauth.signIn', ok: false, err: 'no-client', provider, acc }); return { ...NO_CLIENT }; }
    const verifier = b64u(crypto.randomBytes(64));                                  // 86 chars, within 43..128
    const challenge = b64u(crypto.createHash('sha256').update(verifier).digest());
    const state = b64u(crypto.randomBytes(24));

    let server, timer;
    const callback = new Promise(resolve => {
      server = http.createServer((req, res) => {
        let u; try { u = new URL(req.url, 'http://127.0.0.1'); } catch (e) { res.writeHead(400).end(); return; }
        if (u.pathname !== '/cb') { res.writeHead(404, { connection: 'close' }).end(); return; }
        const done = (code, body, r) => { res.writeHead(code, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', connection: 'close' }); res.end(body); resolve(r); };
        const bad = (err, hu) => done(400, page('A bejelentkezés nem sikerült.', 'Sign-in failed.'), { ok: false, err, hu });
        if (!safeEqual(u.searchParams.get('state') || '', state)) return bad('state', 'Érvénytelen állapotkód, a bejelentkezés megszakadt.');
        if (u.searchParams.get('error')) return bad('denied', 'A bejelentkezést megtagadtad.');
        const code = u.searchParams.get('code');
        if (!code) return bad('bad-request', 'Hiányzik a kód.');
        done(200, page('Sikeres bejelentkezés. Ez a lap bezárható.', 'Signed in. You can close this tab.'), { ok: true, code });
      });
      timer = setTimeout(() => resolve({ ok: false, err: 'timeout', hu: 'A bejelentkezés időtúllépés miatt megszakadt.' }), timeoutMs);
      if (timer.unref) timer.unref();
    });
    try {
      await new Promise((ok, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', ok); });
      const redirect = 'http://127.0.0.1:' + server.address().port + '/cb';
      const u = new URL(P.auth);
      for (const [k, v] of Object.entries({
        client_id: client.id, redirect_uri: redirect, response_type: 'code', scope: (P.scopes || []).join(' '), state,
        code_challenge: challenge, code_challenge_method: 'S256', access_type: 'offline', prompt: 'consent',
      })) u.searchParams.set(k, v);
      Promise.resolve().then(() => opener(u.href)).catch(() => {});
      const cb = await callback;
      if (!cb.ok) { w({ ch: 'oauth.signIn', ok: false, err: cb.err, provider, acc }); return cb; }

      const form = new URLSearchParams({ grant_type: 'authorization_code', code: cb.code, redirect_uri: redirect, client_id: client.id, code_verifier: verifier });
      if (client.secret) form.set('client_secret', client.secret);
      const r = await post(P.token, form);
      const j = r.json;
      if (r.status !== 200 || !j || typeof j.access_token !== 'string') {
        w({ ch: 'oauth.signIn', ok: false, err: 'token', provider, acc, status: r.status });
        return { ok: false, err: 'token', hu: 'A bejelentkezés nem sikerült (a kód cseréje elutasítva).' };
      }
      const email = await profileEmail(P, j.access_token);
      secrets.put(secretName(provider, acc), JSON.stringify({
        access: j.access_token, refresh: typeof j.refresh_token === 'string' ? j.refresh_token : '',
        expiry: now() + (Number(j.expires_in) || 3600) * 1000, scope: String(j.scope || ''), email,
      }));
      w({ ch: 'oauth.signIn', ok: true, provider, acc });
      return { ok: true, email };
    } catch (e) {
      w({ ch: 'oauth.signIn', ok: false, err: 'error', provider, acc });
      return { ok: false, err: 'error', hu: 'A bejelentkezés nem sikerült.' };
    } finally {
      clearTimeout(timer);
      try { server.close(); server.closeIdleConnections && server.closeIdleConnections(); } catch (e) {}
    }
  }

  async function refresh(provider, acc, s) {
    const P = prov[provider], client = readClient(provider);
    if (!client) return { ...NO_CLIENT };
    if (!s.refresh) return { ...REAUTH };
    const form = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: s.refresh, client_id: client.id });
    if (client.secret) form.set('client_secret', client.secret);
    const r = await post(P.token, form);
    if (r.status === 400 || r.status === 401) { w({ ch: 'oauth.refresh', ok: false, err: 'reauth', provider, acc }); return { ...REAUTH }; }
    if (r.status !== 200 || !r.json || typeof r.json.access_token !== 'string') {
      w({ ch: 'oauth.refresh', ok: false, err: 'network', provider, acc, status: r.status });
      return { ok: false, err: 'network', hu: 'A bejelentkezés frissítése nem sikerült.' };
    }
    const n = { ...s, access: r.json.access_token, expiry: now() + (Number(r.json.expires_in) || 3600) * 1000 };
    if (typeof r.json.refresh_token === 'string' && r.json.refresh_token) n.refresh = r.json.refresh_token;
    secrets.put(secretName(provider, acc), JSON.stringify(n));
    w({ ch: 'oauth.refresh', ok: true, provider, acc });
    return { ok: true, access: n.access };
  }

  async function token(acc, o = {}) {
    const provider = o.provider || 'google';
    if (!prov[provider] || !accOk(acc)) return { ok: false, err: 'bad-request', hu: 'Érvénytelen kérés.' };
    const name = secretName(provider, acc);
    let s = null;
    try { const raw = secrets.get(name); s = raw ? JSON.parse(raw) : null; } catch (e) { s = null; }
    if (!s || typeof s.access !== 'string') return { ok: false, err: 'not-signed-in', hu: 'Nincs bejelentkezve.' };
    if (!o.force && s.expiry - now() >= SOON_MS) return { ok: true, access: s.access };
    if (!inflight.has(name)) inflight.set(name, refresh(provider, acc, s).finally(() => inflight.delete(name)));
    return inflight.get(name);
  }

  async function signOut(acc, provider = 'google') {
    const P = prov[provider];
    if (!P || !accOk(acc)) return { ok: false, err: 'bad-request', hu: 'Érvénytelen kérés.' };
    const name = secretName(provider, acc);
    let s = null;
    try { const raw = secrets.get(name); s = raw ? JSON.parse(raw) : null; } catch (e) {}
    let revoked = false;
    if (s && P.revoke) {
      const r = await post(P.revoke, new URLSearchParams({ token: s.refresh || s.access }));
      revoked = r.status === 200;
    }
    secrets.del(name);
    w({ ch: 'oauth.signOut', ok: true, provider, acc, revoked });
    return { ok: true, revoked };
  }

  const signedIn = (acc, provider = 'google') => { try { return accOk(acc) && secrets.has(secretName(provider, acc)); } catch (e) { return false; } };

  return { signIn, token, signOut, signedIn };
}

module.exports = { createOAuth, loadProviders, readClient, NO_CLIENT };
