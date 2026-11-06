// presets.js — presets and feeds (WP-29): a registry of named lookups (config/presets.json + <userDir>/presets.json) that run as jobs,
// cache their items and refresh on a timer while the app is open.
//   const pre = createPresets({ jobs, sources, fetch, execFile, cacheFile, configFile, userFile, now });
//   pre.list() · pre.run(id) → { ok, job } · pre.exec(id) → record · pre.results() · pre.open(id, i) · pre.tick() · pre.start() / stop()
// sources: { driftFile, repoPath(name), ports() → [{ id, name, port, up }], lines() → devlog lines, mail: { accounts(), list(acc, q) } | null }
// Items: { hu, detail?, open?: act id } where open is a palette / web target (an act id, web:, srv:, srch:) or 'url:<n>' (the cached item's link,
// re-checked as http/https on open). A link or a raw URL from a feed never goes to the page. Network kinds (rss, atom, page-text) only reach hosts in allowHosts.
'use strict';
const fs = require('fs'), path = require('path');
const { textify, title: pageTitle, decode } = require('./textify.js');

const KINDS = ['stack-drift', 'git-status', 'ports', 'devlog-waiting', 'mail-query', 'rss', 'atom', 'page-text', 'search'];
const NETWORK = ['rss', 'atom', 'page-text'];
const ID_RE = /^[a-z0-9_-]{1,40}$/i;
const MIN_EVERY = 15, MAX_FEED_ITEMS = 20, PAGE_CHARS = 2000, MAX_ITEMS = 200, BODY_MAX = 1024 * 1024, FETCH_MS = 15000;
const NOT_ALLOWED = host => 'A gazdagép nincs engedélyezve: ' + host;
const SIGN_IN = 'Jelentkezz be a Postában';

const bad = hu => ({ ok: false, err: 'bad-request', hu });
const isHttp = u => { try { const p = new URL(String(u)).protocol; return p === 'http:' || p === 'https:'; } catch (e) { return false; } };
const clip = (s, n) => String(s == null ? '' : s).slice(0, n);

// ------------------------------------------------------------ pure helpers
// validate one registry entry → the clean preset, or { err }
function validate(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return { err: 'not an object' };
  if (!ID_RE.test(String(p.id))) return { err: 'bad id' };
  if (!KINDS.includes(p.kind)) return { err: 'unknown kind: ' + clip(p.kind, 40) };
  const o = { id: p.id, hu: clip(p.hu || p.id, 120), kind: p.kind, enabled: p.enabled !== false };
  if (p.every !== undefined) {
    const e = Number(p.every);
    if (!Number.isFinite(e)) return { err: 'bad every' };
    o.every = Math.max(MIN_EVERY, Math.floor(e));                                      // at least 15 minutes
  }
  for (const k of ['repo', 'acc', 'q', 'url', 'provider']) if (typeof p[k] === 'string') o[k] = clip(p[k], 2000);
  if (Array.isArray(p.sections)) o.sections = p.sections.filter(n => Number.isInteger(n) && n >= 1 && n <= 99).slice(0, 20);
  if (NETWORK.includes(o.kind) && !isHttp(o.url)) return { err: 'bad url' };
  return o;
}

// the `##` sections of DRIFT.md, first `max` bullets (or table rows) each
function driftItems(md, sections, max = 10) {
  const parts = String(md).split(/^## /m).slice(1), out = [];
  for (const n of sections && sections.length ? sections : [1]) {
    const part = parts.find(s => new RegExp('^' + n + '\\.').test(s));
    if (!part) continue;
    const lines = part.split(/\r?\n/), head = lines.shift().replace(/^\d+\.\s*/, '').trim();
    let rows = lines.filter(l => /^\s*\|/.test(l));
    if (rows.length >= 2 && /^\s*\|[\s:|-]+\|?\s*$/.test(rows[1])) rows = rows.slice(2);   // the table header and its rule
    const entries = [
      ...lines.filter(l => /^\s*[-*]\s+/.test(l)).map(l => l.replace(/^\s*[-*]\s+/, '').trim()),
      ...rows.map(r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim()).filter(Boolean).slice(0, 4).join(' · ')),
    ].filter(Boolean).slice(0, max);
    for (const e of entries) out.push({ hu: clip(e.replace(/\*\*|`/g, ''), 300), detail: head });
  }
  return out;
}

// `git status --porcelain=v2 --branch` → { branch, ahead, behind, changed }
function parsePorcelain(text) {
  const r = { branch: '', ahead: 0, behind: 0, changed: 0 };
  for (const l of String(text).split(/\r?\n/)) {
    let m;
    if ((m = /^# branch\.head (.+)$/.exec(l))) r.branch = m[1];
    else if ((m = /^# branch\.ab \+(\d+) -(\d+)$/.exec(l))) { r.ahead = +m[1]; r.behind = +m[2]; }
    else if (l && l[0] !== '#') r.changed++;
  }
  return r;
}

const tag = (s, t) => { const m = new RegExp('<' + t + '\\b[^>]*>([\\s\\S]*?)</' + t + '\\s*>', 'i').exec(s); return m ? m[1] : ''; };
const plain = s => decode(String(s).replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1')).replace(/\s+/g, ' ').trim();   // CDATA is literal, else tags/entities
const cdata = s => { const m = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(s); return m ? m[1].replace(/\s+/g, ' ').trim() : plain(s.replace(/<[^>]*>/g, '')); };

// RSS <item> / Atom <entry> → [{ title, link, date }], at most 20
function parseFeed(xml) {
  xml = String(xml);
  const out = [], re = /<(item|entry)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi;
  let m;
  while ((m = re.exec(xml)) && out.length < MAX_FEED_ITEMS) {
    const b = m[2];
    let link = '';
    if (m[1].toLowerCase() === 'entry') {
      const ls = [...b.matchAll(/<link\b([^>]*)>/gi)].map(x => x[1]);
      const alt = ls.find(a => !/rel\s*=\s*["'](?!alternate)/i.test(a)) || ls[0] || '';
      const h = /href\s*=\s*["']([^"']*)["']/i.exec(alt);
      link = h ? decode(h[1]) : '';
    } else link = plain(tag(b, 'link'));
    out.push({ title: cdata(tag(b, 'title')) || '(cím nélkül)', link, date: plain(tag(b, 'pubDate') || tag(b, 'updated') || tag(b, 'published')) });
  }
  return out;
}

// ------------------------------------------------------------ the module
function createPresets({ jobs, sources = {}, fetch = globalThis.fetch, execFile = require('child_process').execFile, cacheFile, configFile, userFile, now = Date.now, log = () => {} }) {
  const cache = new Map();                                        // pre → { pre, at, items, error? } (items keep their raw link in `link`)
  let loaded = false, timer = null;
  const busy = new Set();

  const readJson = f => { try { return f ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; } catch (e) { return null; } };
  const shape = j => Array.isArray(j) ? { allowHosts: [], presets: j } : (j && typeof j === 'object' ? { allowHosts: Array.isArray(j.allowHosts) ? j.allowHosts : [], presets: Array.isArray(j.presets) ? j.presets : [] } : { allowHosts: [], presets: [] });

  // config + user additions (a user entry with the same id replaces the shipped one); unknown kinds are refused and reported
  function load() {
    const a = shape(typeof configFile === 'function' ? configFile() : readJson(configFile)), b = shape(typeof userFile === 'function' ? userFile() : readJson(userFile));
    const byId = new Map(), rejected = [];
    for (const p of [...a.presets, ...b.presets]) {
      const v = validate(p);
      if (v.err) { rejected.push({ id: p && p.id, err: v.err }); continue; }
      byId.set(v.id, v);
    }
    const allowHosts = [...new Set([...a.allowHosts, ...b.allowHosts].filter(h => typeof h === 'string' && h).map(h => h.toLowerCase()))];
    return { presets: [...byId.values()], allowHosts, rejected };
  }
  const find = id => load().presets.find(p => p.id === id) || null;

  function readCache() {
    if (loaded) return;
    loaded = true;
    const j = readJson(typeof cacheFile === 'function' ? cacheFile() : cacheFile);
    if (j && typeof j === 'object') for (const k of Object.keys(j)) if (j[k] && Array.isArray(j[k].items)) cache.set(k, j[k]);
  }
  function writeCache() {
    const f = typeof cacheFile === 'function' ? cacheFile() : cacheFile;
    if (!f) return;
    try { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(Object.fromEntries(cache))); } catch (e) { log('presets cache not written'); }
  }

  // ---- kinds: each returns an array of items (or throws a Hungarian message through `fail`)
  const fail = hu => { const e = new Error(hu); e.hu = hu; throw e; };
  async function get(url, allow) {
    const u = new URL(url);
    if (!allow.includes(u.hostname.toLowerCase())) fail(NOT_ALLOWED(u.hostname));          // refused before any request
    const r = await fetch(u.href, { redirect: 'manual', signal: AbortSignal.timeout(FETCH_MS), headers: { accept: 'application/xml, text/html, */*' } });
    if (r.status >= 300 && r.status < 400) fail('A cím átirányít, ez nem engedélyezett.');
    if (!r.ok) fail('A lekérés nem sikerült (' + r.status + ').');
    return (await r.text()).slice(0, BODY_MAX);
  }
  const KIND = {
    'stack-drift': async p => {
      let md = '';
      try { md = fs.readFileSync(sources.driftFile, 'utf8'); } catch (e) { fail('Nincs DRIFT.md.'); }
      return driftItems(md, p.sections);
    },
    'git-status': p => new Promise((resolve, reject) => {
      const dir = sources.repoPath && sources.repoPath(p.repo);
      if (!dir) return reject(Object.assign(new Error('x'), { hu: 'Ismeretlen repó.' }));
      execFile('git', ['-C', dir, 'status', '--porcelain=v2', '--branch'], { windowsHide: true, timeout: 20000 }, (err, stdout) => {
        if (err) return reject(Object.assign(new Error('x'), { hu: 'A git nem válaszolt.' }));
        const s = parsePorcelain(stdout);
        resolve([{ hu: 'Ág: ' + (s.branch || '?'), detail: '↑' + s.ahead + ' ↓' + s.behind + ' · ' + s.changed + ' változott fájl' }]);
      });
    }),
    'ports': async () => (sources.ports ? sources.ports() : []).map(s => ({ hu: s.name, detail: (s.up ? 'fut' : 'áll') + ' · ' + s.port, open: s.up ? 'srv:' + s.id : undefined })),
    'devlog-waiting': async () => (sources.lines ? sources.lines() : []).filter(l => l && l.status === 'waiting').slice(0, 30)
      .map(l => ({ hu: clip(l.name, 200), detail: clip(l.nextStep, 300), open: l.contAct })),
    'mail-query': async p => {
      const m = sources.mail;
      if (!m) return [{ hu: 'Később: a posta modul még nincs kész.' }];
      const acc = (m.accounts() || []).find(a => a.acc === p.acc || a.kind === p.acc);
      if (!acc || acc.kind === 'web' || !acc.signedIn) return [{ hu: SIGN_IN, open: 'web:' + (p.acc || 'gmail') }];
      const r = await m.list(acc.acc, p.q || '');
      if (!r || !r.ok) {
        if (r && r.err === 'reauth') return [{ hu: SIGN_IN, open: 'web:' + (p.acc || 'gmail') }];
        fail((r && r.hu) || 'A levelek nem töltődtek le.');
      }
      return (r.items || []).slice(0, 30).map(x => ({ hu: clip(x.subject || '(tárgy nélkül)', 200), detail: clip((x.from || '') + (x.date ? ' · ' + x.date : ''), 300) }));
    },
    'rss': async (p, allow) => parseFeed(await get(p.url, allow)).map(x => ({ hu: x.title, detail: x.date, link: x.link || undefined, open: x.link ? 'url:@' : undefined })),
    'page-text': async (p, allow) => {
      const html = await get(p.url, allow);
      return [{ hu: pageTitle(html) || new URL(p.url).hostname, detail: textify(html).slice(0, PAGE_CHARS) }];
    },
    'search': async p => [{ hu: clip(p.q || p.hu, 200), open: 'srch:' + (p.provider || 'google') + ':' + (p.q || '') }],
  };
  KIND.atom = KIND.rss;                                           // parseFeed reads both <item> and <entry>

  // runs one preset now and caches the record; the same preset never runs twice at once
  async function exec(id, marked) {                               // marked: run() already put the id in `busy` when it queued the job
    readCache();
    const p = find(id);
    if (!p) { busy.delete(id); return null; }
    if (!marked && busy.has(id)) return cache.get(id) || null;
    busy.add(id);
    const rec = { pre: id, at: now(), items: [] };
    try {
      const items = await KIND[p.kind](p, load().allowHosts);
      rec.items = items.slice(0, MAX_ITEMS).map((it, i) => {
        const o = { hu: clip(it.hu, 300) };
        if (it.detail) o.detail = clip(it.detail, 2100);
        if (it.link) o.link = clip(it.link, 2000);
        if (it.open) o.open = it.open === 'url:@' ? 'url:' + i : String(it.open);
        return o;
      });
    } catch (e) { rec.error = e && e.hu ? e.hu : 'A lekérés nem sikerült.'; log('preset failed', id); }
    busy.delete(id);
    cache.set(id, rec);
    writeCache();
    return rec;
  }

  function run(id) {
    const p = find(id);
    if (!p) return { ok: false, err: 'not-found', hu: 'Nincs ilyen előbeállítás.' };
    if (!p.enabled) return { ok: false, err: 'disabled', hu: 'Ez az előbeállítás ki van kapcsolva.' };
    if (busy.has(id)) return { ok: false, err: 'busy', hu: 'Már fut.' };
    busy.add(id);                                                  // from queueing until the run ends
    const job = jobs.create({ kind: 'feed', hu: 'Hírek: ' + p.hu, run: async ctx => { if (ctx.cancelled) { busy.delete(id); return; } await exec(id, true); } });
    return { ok: true, job };
  }

  // the page-facing view: no raw links, `open` is just a flag
  const view = rec => ({ pre: rec.pre, at: rec.at, items: rec.items.map(i => ({ hu: i.hu, detail: i.detail || '', ...(i.open ? { open: true } : {}) })), ...(rec.error ? { error: rec.error } : {}) });
  function results() { readCache(); return { results: [...cache.values()].map(view) }; }
  const list = () => { const l = load(); return { presets: l.presets.map(p => ({ id: p.id, hu: p.hu, kind: p.kind, enabled: p.enabled, ...(p.every ? { every: p.every } : {}) })) }; };

  // feed.open: the cached item's act id, or its link when it is http/https; main passes the resolved target to `opener`
  function resolveOpen(id, i) {
    readCache();
    const rec = cache.get(id), it = rec && rec.items[i];
    if (!it || !it.open) return { ok: false, err: 'not-found', hu: 'Nincs mit megnyitni.' };
    if (it.open.startsWith('url:')) return isHttp(it.link) ? { ok: true, target: new URL(it.link).href } : bad('A hivatkozás nem http/https, nem nyitható meg.');
    return { ok: true, target: it.open };
  }

  // scheduler: one timer; a preset with `every` (minutes, ≥ 15) runs when it is due and not busy
  function tick() {
    readCache();
    const started = [];
    for (const p of load().presets) {
      if (!p.enabled || !p.every || busy.has(p.id)) continue;
      const rec = cache.get(p.id);
      if (rec && now() - rec.at < p.every * 60000) continue;
      if (run(p.id).ok) started.push(p.id);
    }
    return started;
  }
  function start(ms = 60000) { if (!timer) { timer = setInterval(tick, ms); if (timer.unref) timer.unref(); } }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }

  return { load, list, run, exec, results, resolveOpen, tick, start, stop, isBusy: id => busy.has(id) };
}

// ------------------------------------------------------------ palette hooks (pre:<id>), bound by main
let active = null;
const bind = inst => { active = inst; };
const paletteItems = () => active ? active.list().presets.filter(p => p.enabled).map(p => ({ id: 'pre:' + p.id, hu: 'Hírek · ' + p.hu, en: 'Feed · ' + p.id })) : [];
async function runPalette(id) {
  if (!active) return { ok: false, hu: 'Ez még nem futtatható.' };
  const r = active.run(String(id).slice(4));
  return r.ok ? { ok: true, hu: 'Frissítés elindítva', en: 'refresh started' } : { ok: false, hu: r.hu, en: r.err };
}

module.exports = { createPresets, validate, driftItems, parsePorcelain, parseFeed, bind, paletteItems, run: runPalette, KINDS, MIN_EVERY };
