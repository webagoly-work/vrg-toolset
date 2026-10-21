// GitHub: token, identity, API calls. The token lives only in this browser's storage and in memory;
// it is never logged, never put in an error text, never written anywhere else.

const KP_GH_API = 'https://api.github.com';
const KP_GH_TOKEN_RE = /^(github_pat_|ghp_)[A-Za-z0-9_]{20,}$/;
const KP_GH_ACCESS_HU = { write: 'írás', read: 'olvasás', none: 'nincs hozzáférés a repóhoz' };

const kpGh = { token: null, login: null, name: null, access: null, rate: null, error: null };
const kpGhCache = new Map();   // path -> { etag, body }

const kpGhTokenOk = t => KP_GH_TOKEN_RE.test(String(t || '').trim());

function kpGhLoad() {
  const t = kpStore.get('ghToken', null);
  if (kpGhTokenOk(t)) kpGh.token = t;
  const who = kpStore.get('ghWho', null);
  if (kpGh.token && who) Object.assign(kpGh, { login: who.login, name: who.name, access: who.access });
}

function kpGhSignOut(reason) {
  Object.assign(kpGh, { token: null, login: null, name: null, access: null, error: reason || null });
  kpGhCache.clear();
  kpStore.set('ghToken', null);
  kpStore.set('ghWho', null);
}

// -> { status, json | text, etag, rateRemaining, error? }. 304 answers come from the cache.
async function kpGhFetch(path, opts) {
  const o = opts || {};
  if (!kpGh.token) return { status: 0, error: 'Nincs GitHub belépés' };
  const headers = {
    Authorization: 'Bearer ' + kpGh.token,
    Accept: o.raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  const method = o.method || 'GET';
  const key = (o.raw ? 'raw:' : '') + path;
  const cached = method === 'GET' && !o.nocache ? kpGhCache.get(key) : null;
  const etag = method === 'GET' && !o.nocache ? o.etag || (cached && cached.etag) : null;
  if (etag) headers['If-None-Match'] = etag;
  const init = { method, headers, cache: 'no-store' };
  if (o.body !== undefined) { headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(o.body); }
  let res;
  try { res = await fetch(KP_GH_API + path, init); }
  catch (e) { return { status: 0, error: 'Nincs kapcsolat a GitHubbal' }; }
  const h = n => (res.headers && res.headers.get ? res.headers.get(n) : null);
  const rate = h('x-ratelimit-remaining'), limit = h('x-ratelimit-limit');
  if (rate != null) kpGh.rate = +rate;
  if (limit != null) kpGh.rateLimit = +limit;
  const out = { status: res.status, etag: h('etag'), rateRemaining: rate == null ? null : +rate };
  if (res.status === 401) { kpGhSignOut('A token lejárt vagy hibás'); out.error = kpGh.error; return out; }
  if (res.status === 304 && cached) return Object.assign(out, cached.body, { etag: cached.etag, fromCache: true });
  if (res.status >= 200 && res.status < 300) {
    const body = o.raw ? { text: await res.text() } : { json: await res.json() };
    if (out.etag && method === 'GET' && !o.nocache) kpGhCache.set(key, { etag: out.etag, body });
    return Object.assign(out, body);
  }
  try { out.json = await res.json(); } catch (e) { /* no body */ }
  return out;
}

// who is this token, and what may it do with the repo
async function kpGhIdentify(repo) {
  kpGh.error = null;
  const u = await kpGhFetch('/user');
  if (u.status !== 200) {
    if (u.status !== 401) kpGh.error = u.error || 'A GitHub nem válaszolt (' + u.status + ')';
    return kpGh;
  }
  kpGh.login = u.json.login;
  kpGh.name = u.json.name || null;
  const r = await kpGhFetch('/repos/' + repo.owner + '/' + repo.name);
  if (r.status === 401) return kpGh;
  kpGh.access = r.status === 200 ? (r.json.permissions && r.json.permissions.push ? 'write' : 'read') : r.status === 404 ? 'none' : null;
  if (!kpGh.access) kpGh.error = r.error || 'A repó nem ellenőrizhető (' + r.status + ')';
  kpStore.set('ghWho', { login: kpGh.login, name: kpGh.name, access: kpGh.access });
  return kpGh;
}

async function kpGhSetToken(t, repo) {
  t = String(t || '').trim();
  if (!kpGhTokenOk(t)) return { ok: false, error: 'Ez nem GitHub token formátum (github_pat_… vagy ghp_…)' };
  kpGhSignOut();
  kpGh.token = t;
  kpStore.set('ghToken', t);
  await kpGhIdentify(repo);
  if (!kpGh.token) return { ok: false, error: kpGh.error || 'A token lejárt vagy hibás' };
  return { ok: !!kpGh.login, error: kpGh.error };
}

const kpGhHasRepo = () => !!kpGh.login && (kpGh.access === 'write' || kpGh.access === 'read');

if (typeof module !== 'undefined') module.exports = { kpGh, kpGhFetch, kpGhIdentify, kpGhSetToken, kpGhTokenOk, kpGhSignOut, kpGhCache };
