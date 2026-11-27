// search.js — the omnibox decision (WP-18): what a typed string means. Pure; main calls it, the page never builds a URL.
//   toUrl(input, { providers, servers })  → an http / https URL string, or '' for an empty input
//   providerUrl(id, q, providers)         → the provider's URL with {q} = encodeURIComponent(q), or '' for an unknown provider
// providers: config/search.json rows; servers: vrg-menu.json "servers" rows. Both default to the files on disk.
//   decide(input, opts) → { url, hu?, bang?, removed? }   (T2 of the VRG Böngésző, docs/browser/TRAJECTORIES.md)
// decide() is toUrl() plus the VRG Böngésző's rules from its pure core (Browser/src/core/url.js): a !bang picks an engine of
// Browser/config/engines.json ("!tme NYM-J 3x2,5", "Ohm-törvény !w"); a URL loses its tracking parameters (Tiszta link) and
// one carrying a user name or password is refused (Linkellenőr). toUrl() keeps its answer: decide(...).url.
'use strict';
const fs = require('fs'), path = require('path');

const SEARCH_FILE = path.join(__dirname, '..', '..', 'config', 'search.json');
const MENU_FILE = path.join(__dirname, '..', '..', '..', 'launcher', 'vrg-menu.json');
const BROWSER = path.join(__dirname, '..', '..', '..', 'Browser');
let urlCore = null;
const browserUrl = () => urlCore || (urlCore = require(path.join(BROWSER, 'src', 'core', 'url.js')));

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return fallback; }
}
const loadProviders = (file = SEARCH_FILE) => {
  const j = readJson(file, []);
  return Array.isArray(j) ? j.filter(p => p && typeof p.id === 'string' && typeof p.url === 'string' && p.url.includes('{q}')) : [];
};
const loadServers = (file = MENU_FILE) => {
  const j = readJson(file, {});
  return j && Array.isArray(j.servers) ? j.servers : [];
};

const isHttp = u => {
  if (typeof u !== 'string' || !u.length || u.length > 4096) return false;
  try { const p = new URL(u).protocol; return p === 'http:' || p === 'https:'; } catch (e) { return false; }
};

function providerUrl(id, q, providers = loadProviders()) {
  const p = providers.find(x => x.id === id);
  return p ? p.url.split('{q}').join(encodeURIComponent(String(q == null ? '' : q))) : '';
}

const HOST_TLD = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+(?::\d{1,5})?(?:[/?#]\S*)?$/i;
const LOCALHOST = /^localhost:\d{1,5}(?:[/?#]\S*)?$/i;
const SRV = /^srv:([a-z0-9_-]{1,40})$/i;

// the VRG Böngésző's engines with their bangs (Browser/config/engines.json); none when the file is missing
const loadEngines = (file = path.join(BROWSER, 'config', 'engines.json')) => {
  const j = readJson(file, {});
  return j && Array.isArray(j.engines) ? j.engines.filter(e => e && typeof e.id === 'string' && typeof e.url === 'string' && e.url.includes('{q}') && Array.isArray(e.bangs)) : [];
};

function decide(input, { providers = loadProviders(), servers = loadServers(), engines = loadEngines() } = {}) {
  const s = String(input == null ? '' : input).trim();
  if (!s) return { url: '' };
  let U = null;
  try { U = browserUrl(); } catch (e) { /* no Browser/ beside the Dashboard: the omnibox works as before */ }
  if (U && /(^!|\s!)[a-z0-9]{1,12}(\s|$)/i.test(s)) {
    const c = U.classify(s, { engines });
    if (c.kind === 'search' && c.bang && c.engine) {
      const url = U.searchUrl(c.engine, c.q);
      if (isHttp(url)) return { url, bang: c.engine.id };
    }
  }
  const url = toUrl(s, { providers, servers });
  if (!U || !isHttp(url) || url === providerUrl('google', s, providers)) return { url };
  if (U.assess(url).some(w => w.code === 'credentials')) return { url: '', hu: 'A címben felhasználónév vagy jelszó van (adathalász trükk lehet); így nem nyitom meg.' };
  const c = U.clean(url);
  return c.removed.length ? { url: c.url, removed: c.removed } : { url };
}

function toUrl(input, { providers = loadProviders(), servers = loadServers() } = {}) {
  const s = String(input == null ? '' : input).trim();
  if (!s) return '';
  if (s[0] === '?') return providerUrl('ai', s.slice(1).trim(), providers);
  const m = SRV.exec(s);
  if (m) {
    const srv = servers.find(x => x.id === m[1]);
    if (srv && Number.isInteger(srv.port)) return 'http://localhost:' + srv.port + (typeof srv.open === 'string' && srv.open ? srv.open : '/');
  }
  if (!/\s/.test(s)) {
    if (/^https?:\/\//i.test(s) && isHttp(s)) return s;
    if (LOCALHOST.test(s)) return 'http://' + s;
    if (HOST_TLD.test(s) && isHttp('https://' + s)) return 'https://' + s;
  }
  return providerUrl('google', s, providers);
}

module.exports = { toUrl, decide, providerUrl, loadProviders, loadServers, loadEngines, isHttp };
