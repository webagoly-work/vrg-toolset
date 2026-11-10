// programs.js — third-party programs the VRG Asztal installs into Full\programs (WP-45).
// The list is launcher/programs.json merged over every ServiceKit package (ServiceKit/core/catalog.json): the page sees ghosts
// (not installed) and solid icons (installed), ticks one or more ghosts and asks main to install them; each install is one job
// (lib/jobs.js, kind 'program') so the page follows it with the usual jobs.update events.
//   const P = createPrograms({ fs, net?, execFile, file, expand, jobs, startExe, openUrl });
//   P.load() · P.list(level) · P.install(ids, level) · P.launch(id) · P.page(id) · P.get(id) · P.status(id)
// Sources are resolved as ServiceKit does (url / github / scrape / sfrss), always over https. installer, iso and manual sources are
// never run: they are 'page' entries (the official download page opens) and count as installed once `detect` or a known exe is found.
// Everything is written below `root`; a download goes to root\_downloads, unpacks in root\_staging\<id>, then moves to its folder.
'use strict';
const path = require('path'), crypto = require('crypto');

const LEVELS = ['user', 'dev', 'all'];
const RANK = { user: 0, dev: 1, all: 2 };
const UNPACK = new Set(['zip', '7z', 'sfx']);
const COPY = new Set(['exe']);
const ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) VRG-Desktop/1.0';
const SF_UA = 'Wget/1.21.4';                                         // SourceForge serves the file, not a page, to wget
// Windows' own bsdtar (reads zip); never a bare 'tar.exe': Git's GNU tar on the PATH takes "C:\..." for a remote host
const WIN_TAR = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
const CAT_ORDER = ['web', 'media', 'util', 'dev', 'diag', 'clean', 'net', 'security', 'update', 'repair', 'data', 'smart', 'safe', 'boot', 'emu'];

const isHttps = u => { try { return new URL(u).protocol === 'https:'; } catch (e) { return false; } };
const baseName = s => String(s || '').split(/[\\/]/).pop().replace(/[<>:"|?*\u0000-\u001f]/g, '_');
const inside = (root, p) => { const r = path.relative(root, p); return r && !r.startsWith('..') && !path.isAbsolute(r); };
const globRe = g => new RegExp('^' + String(g).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');

// ---------------------------------------------------------------- the merged list (pure: no file system)
function merge(reg, sk, expand, fullPrograms) {
  const root = fullPrograms;
  const skCats = new Map(((sk && sk.categories) || []).map(c => [c.id, { hu: c.hu, en: c.en }]));
  const cats = new Map([...Object.entries((reg && reg.categories) || {}), ...skCats]);
  const own = new Map(((reg && reg.programs) || []).map(p => [p.id, p]));
  const def = LEVELS.includes(reg && reg.defaultLevel) ? reg.defaultLevel : 'dev';
  const out = [];
  const add = (base, over) => {
    const p = { ...(base || {}), ...(over || {}) };
    if (!ID.test(p.id || '')) return;
    const cat = p.cat || 'util';
    const fmt = String(p.format || '');
    const src = p.source || { type: 'manual' };
    const mode = src.type !== 'manual' && (UNPACK.has(fmt) || COPY.has(fmt)) ? 'install' : 'page';
    const dir = path.join(root, ...(p.dir ? String(p.dir).split(/[\\/]/) : cat === 'dev' ? ['dev', p.id] : [p.id]));
    if (!inside(root, dir)) return;                                   // a folder outside Full\programs is never accepted
    out.push({
      id: p.id, name: String(p.name || p.id), cat, catHu: (cats.get(cat) || {}).hu || cat, catEn: (cats.get(cat) || {}).en || cat,
      level: LEVELS.includes(p.level) ? p.level : def, mode, format: fmt, source: src, dir,
      page: isHttps(p.page) ? p.page : '', sizeMB: Number(p.sizeMB) || 0, win7: p.win7,
      desc: p.desc && typeof p.desc === 'object' ? { hu: String(p.desc.hu || ''), en: String(p.desc.en || '') } : { hu: '', en: '' },
      apps: (Array.isArray(p.apps) ? p.apps : []).filter(a => a && a.exe).map(a => ({ id: a.id || p.id, name: String(a.name || p.name || p.id), exe: String(a.exe) })),
      detect: (Array.isArray(p.detect) ? p.detect : []).map(d => expand(String(d))),
      flags: Array.isArray(p.flags) ? p.flags.map(String) : [], sha256: /^[0-9a-f]{64}$/i.test(p.sha256 || '') ? p.sha256.toLowerCase() : '',
    });
  };
  for (const p of (sk && sk.packages) || []) { add(p, own.get(p.id)); own.delete(p.id); }
  for (const p of own.values()) add(null, p);
  const order = id => { const i = CAT_ORDER.indexOf(id); return i < 0 ? 99 : i; };
  out.sort((a, b) => order(a.cat) - order(b.cat) || RANK[a.level] - RANK[b.level] || a.name.localeCompare(b.name));
  return out;
}

// ---------------------------------------------------------------- the network
// Node's https, not fetch: undici's fetch hit an internal assertion on a download ending while paused and took the process down,
// which in the shell would close the whole VRG Asztal. Redirects are followed by hand (at most 10) and every hop must be https.
//   net.text(url, { ua, follow }) → { status, location, body } · net.save(url, dest, { ua, onData(got, total), cancelled() }) → { size, sha256 }
function httpsNet({ fs, https = require('https') }) {
  function open(url, ua, follow, hops = 0) {
    return new Promise((res, rej) => {
      if (!isHttps(url)) return rej(new Error('not https: ' + url));
      const req = https.get(url, { headers: { 'User-Agent': ua || UA, Accept: '*/*' }, timeout: 60e3 }, r => {
        const loc = r.headers.location;
        if (r.statusCode >= 300 && r.statusCode < 400 && loc) {
          r.resume();
          const next = new URL(loc, url).href;
          if (!follow) return res({ status: r.statusCode, location: next });
          if (hops >= 10) return rej(new Error('too many redirects'));
          return open(next, ua, follow, hops + 1).then(res, rej);
        }
        res({ status: r.statusCode, res: r, headers: r.headers });
      });
      req.on('timeout', () => req.destroy(new Error('timeout')));
      req.on('error', rej);
    });
  }
  return {
    async text(url, { ua, follow = true } = {}) {
      const o = await open(url, ua, follow);
      if (!o.res) return { status: o.status, location: o.location || '', body: '' };
      const chunks = [];
      for await (const c of o.res) chunks.push(c);
      return { status: o.status, location: '', body: Buffer.concat(chunks).toString('utf8') };
    },
    async save(url, dest, { ua, onData = () => {}, cancelled = () => false } = {}) {
      const o = await open(url, ua, true);
      if (o.status !== 200) { o.res.resume(); throw new Error('HTTP ' + o.status); }
      const total = Number(o.headers['content-length']) || 0;
      const hash = crypto.createHash('sha256');
      let got = 0;
      await new Promise((res, rej) => {
        const out = fs.createWriteStream(dest);
        const fail = err => { o.res.unpipe(out); out.destroy(); rej(err); };
        o.res.on('data', c => { hash.update(c); got += c.length; onData(got, total); if (cancelled()) o.res.destroy(new Error('cancelled')); });
        o.res.on('error', fail);
        o.res.on('aborted', () => fail(new Error('connection dropped')));
        out.on('error', fail);
        out.on('finish', res);
        o.res.pipe(out);
      });
      if (total && got !== total) throw new Error('download cut short (' + got + ' of ' + total + ' bytes)');
      return { size: got, sha256: hash.digest('hex') };
    },
  };
}

// ---------------------------------------------------------------- the service
function createPrograms({ fs, net, execFile, file, expand, fullPrograms, jobs, startExe, openUrl, log = () => {}, tarExe = WIN_TAR }) {
  net = net || httpsNet({ fs });
  let list = [], byId = new Map(), core = {}, errors = [];
  const ROOT = () => fullPrograms;
  const STATE = () => path.join(ROOT(), '_state.json');
  const running = new Map();                                          // program id → job id while it installs

  function readJson(f) { return JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, '')); }
  function load() {
    errors = [];
    let reg = {}, sk = {};
    try { reg = readJson(file); } catch (e) { errors.push('programs.json: ' + e.message); }
    try { sk = readJson(expand(reg.servicekit || '')); } catch (e) { errors.push('ServiceKit catalog: ' + e.message); }
    core = (sk && sk.core) || {};
    list = merge(reg, sk, expand, ROOT());
    byId = new Map(list.map(p => [p.id, p]));
    return { count: list.length, errors };
  }
  const get = id => byId.get(id) || null;

  // ------------------------------------------------ is it there: a detect path, else the first app's exe under its folder
  function findExe(p) {
    for (const d of p.detect) if (isFileSync(d)) return d;
    const want = p.apps.map(a => globRe(path.basename(a.exe)));
    if (!want.length) return '';
    const walk = (dir, depth) => {
      let ents; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return ''; }
      for (const re of want) { const f = ents.find(e => e.isFile() && re.test(e.name)); if (f) return path.join(dir, f.name); }
      if (depth <= 0) return '';
      for (const e of ents) if (e.isDirectory() && !e.name.startsWith('_')) { const r = walk(path.join(dir, e.name), depth - 1); if (r) return r; }
      return '';
    };
    return walk(p.dir, 3);
  }
  function isFileSync(f) { try { return fs.statSync(f).isFile(); } catch (e) { return false; } }
  function state() { try { return readJson(STATE()); } catch (e) { return {}; } }
  function saveState(id, rec) {
    const s = state(); s[id] = rec;
    fs.mkdirSync(ROOT(), { recursive: true });
    fs.writeFileSync(STATE(), JSON.stringify(s, null, 2) + '\n', 'utf8');
  }
  function status(id) {
    const p = get(id); if (!p) return null;
    const exe = findExe(p);
    return { installed: !!exe, exe, job: running.get(id) || '' };
  }

  // the page's view of one level: never paths, only what it draws
  function listFor(level) {
    if (!LEVELS.includes(level)) level = 'user';
    const st = state();
    return list.filter(p => RANK[p.level] <= RANK[level]).map(p => {
      const s = status(p.id);
      return { id: p.id, name: p.name, cat: p.cat, catHu: p.catHu, catEn: p.catEn, level: p.level, mode: p.mode, sizeMB: p.sizeMB,
        desc: p.desc, hasPage: !!p.page, installed: s.installed, job: s.job, version: (st[p.id] && st[p.id].version) || '' };
    });
  }

  // ------------------------------------------------ resolving a source to a download (ServiceKit kit.ps1 Resolve-KitSource)
  async function getText(url, ua) {
    const r = await net.text(url, { ua });
    if (r.status < 200 || r.status > 299) throw new Error('HTTP ' + r.status + ' ' + url);
    return r.body;
  }
  const fileOf = u => baseName(decodeURIComponent(new URL(u).pathname.split('/').pop() || 'download'));
  async function githubAsset(repo, pattern) {
    const re = new RegExp(pattern, 'i');
    try {
      const rel = JSON.parse(await getText('https://api.github.com/repos/' + repo + '/releases/latest'));
      for (const a of rel.assets || []) if (re.test(a.name)) return { url: a.browser_download_url, file: baseName(a.name), version: rel.tag_name || '' };
    } catch (e) { log('github api: ' + e.message); }
    const loc = (await net.text('https://github.com/' + repo + '/releases/latest', { follow: false })).location || '';
    const tag = loc.slice(loc.lastIndexOf('/') + 1);
    if (tag) {
      const html = await getText('https://github.com/' + repo + '/releases/expanded_assets/' + tag);
      for (const m of html.matchAll(/href="(\/[^"]+\/releases\/download\/[^"]+)"/g)) {
        const name = decodeURIComponent(m[1].slice(m[1].lastIndexOf('/') + 1));
        if (re.test(name)) return { url: 'https://github.com' + m[1], file: baseName(name), version: tag };
      }
    }
    throw new Error('no release asset matching ' + pattern + ' in ' + repo);
  }
  async function resolve(src) {
    let r;
    switch (src.type || 'url') {
      case 'url': r = { url: src.url, file: fileOf(src.url), version: '' }; break;
      case 'github': r = await githubAsset(src.repo, src.asset); break;
      case 'scrape': {
        const html = await getText(src.page);
        const m = html.match(new RegExp(src.regex, 'i'));
        if (!m) throw new Error('download link not found on ' + src.page);
        let u = src.url ? src.url.replace(/\{(\d)\}/g, (x, g) => (g === '0' ? m[0] : m[+g] || '')) : new URL(m[0], src.base || src.page).href;
        r = { url: u, file: fileOf(u), version: m[1] || '' };
        break;
      }
      case 'sfrss': {
        const rss = await getText('https://sourceforge.net/projects/' + src.project + '/rss?path=' + (src.path || '/'));
        const re = new RegExp(src.regex, 'i');
        for (const m of rss.matchAll(/<link>(https:\/\/sourceforge\.net\/projects\/[^<]+?\/download)<\/link>/g)) {
          const name = decodeURIComponent(m[1].replace(/\/download$/, '').split('/').pop());
          if (re.test(name)) { r = { url: m[1], file: baseName(name), version: '', ua: SF_UA }; break; }
        }
        if (!r) throw new Error('no file matching ' + src.regex + ' in SourceForge ' + src.project);
        break;
      }
      default: throw new Error('no automatic download for this program');
    }
    if (src.file) r.file = baseName(src.file);
    if (!isHttps(r.url)) throw new Error('not https: ' + r.url);
    return r;
  }

  // ------------------------------------------------ download with progress and a sha256 of what arrived
  async function download(url, dest, ua, ctx, label) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    let last = 0;
    return net.save(url, dest, { ua, cancelled: () => !!(ctx && ctx.cancelled),
      onData: (got, total) => { if (ctx && got - last > 262144) { last = got; ctx.progress(got, total, label + ' · ' + Math.round(got / 1048576) + ' MB'); } } });
  }

  // ------------------------------------------------ unpacking
  const run = (exe, args) => new Promise((res, rej) => execFile(exe, args, { windowsHide: true, timeout: 900e3, maxBuffer: 8 << 20 },
    (e, so, se) => (e ? rej(new Error(baseName(exe) + ': ' + String(se || e.message).trim().slice(0, 300))) : res(so))));
  async function sevenZa(ctx) {                                       // ServiceKit's Initialize-SevenZip, into root\_kit
    const kit = path.join(ROOT(), '_kit'), za = path.join(kit, '7za.exe');
    if (isFileSync(za)) return za;
    if (!core.sevenZr || !core.sevenExtra) throw new Error('7-Zip bootstrap is not configured');
    ctx && ctx.progress(0, 0, '7-Zip előkészítése');
    const zr = path.join(kit, '7zr.exe');
    if (!isFileSync(zr)) await download(core.sevenZr.url, zr, UA, null, '7zr');
    const ex = await resolve(core.sevenExtra);
    const exFile = path.join(kit, ex.file), tmp = path.join(kit, 'extra');
    await download(ex.url, exFile, UA, null, '7z extra');
    await run(zr, ['x', exFile, '-o' + tmp, '-y']);
    for (const f of ['7za.exe', '7za.dll', '7zxa.dll']) if (isFileSync(path.join(tmp, f))) fs.copyFileSync(path.join(tmp, f), path.join(kit, f));
    fs.rmSync(tmp, { recursive: true, force: true }); fs.rmSync(exFile, { force: true });
    if (!isFileSync(za)) throw new Error('7za.exe missing after the bootstrap');
    return za;
  }
  async function unpack(fmt, archive, stage, ctx) {
    fs.rmSync(stage, { recursive: true, force: true });
    fs.mkdirSync(stage, { recursive: true });
    if (fmt === 'zip' && !isFileSync(path.join(ROOT(), '_kit', '7za.exe'))) await run(tarExe, ['-xf', archive, '-C', stage]);
    else await run(await sevenZa(ctx), ['x', archive, '-o' + stage, '-y', '-bso0', '-bsp0']);
    // nothing in the staging folder may be a link: an archive must not point outside Full\programs
    const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name);
      if (e.isSymbolicLink()) throw new Error('the archive holds a link: ' + e.name); if (e.isDirectory()) walk(f); } };
    walk(stage);
    let root = stage;                                                 // strip one lone top folder (ServiceKit Get-FlatRoot)
    for (let i = 0; i < 3; i++) { const e = fs.readdirSync(root, { withFileTypes: true }); if (e.length === 1 && e[0].isDirectory()) root = path.join(root, e[0].name); else break; }
    return root;
  }
  function postSteps(p) {
    const exe = findExe(p); if (!exe) return;
    const at = path.dirname(exe);
    for (const fl of p.flags) {
      if (fl === 'vscode-data') fs.mkdirSync(path.join(at, 'data'), { recursive: true });
      if (fl === 'portable-ini' && !isFileSync(path.join(at, 'portable.ini'))) fs.writeFileSync(path.join(at, 'portable.ini'), '');
      if (fl === 'portable-txt' && !isFileSync(path.join(at, 'portable.txt'))) fs.writeFileSync(path.join(at, 'portable.txt'), '');
    }
  }

  async function installOne(p, ctx) {
    const label = p.name;
    ctx.progress(0, 0, label + ' · forrás keresése');
    const res = await resolve(p.source);
    const dl = path.join(ROOT(), '_downloads', res.file);
    const got = await download(res.url, dl, res.ua, ctx, label);
    try {
      if (p.sha256 && got.sha256 !== p.sha256) throw new Error('sha256 mismatch');
      if (ctx.cancelled) throw new Error('cancelled');
      ctx.progress(got.size, got.size, label + ' · kicsomagolás');
      fs.mkdirSync(p.dir, { recursive: true });
      if (COPY.has(p.format)) fs.copyFileSync(dl, path.join(p.dir, res.file));
      else {
        const stage = path.join(ROOT(), '_staging', p.id);
        const from = await unpack(p.format, dl, stage, ctx);
        fs.cpSync(from, p.dir, { recursive: true, force: true });
        fs.rmSync(stage, { recursive: true, force: true });
      }
    } finally { fs.rmSync(dl, { force: true }); }
    postSteps(p);
    const exe = findExe(p);
    if (!exe) throw new Error('installed, but ' + (p.apps[0] ? p.apps[0].exe : 'its program file') + ' was not found');
    saveState(p.id, { version: res.version, url: res.url, sha256: got.sha256, size: got.size, at: new Date().toISOString() });
    return exe;
  }

  // ------------------------------------------------ what the page may ask
  function install(ids, level) {
    if (!LEVELS.includes(level)) level = 'user';
    const started = [], skipped = [];
    for (const id of ids) {
      const p = get(id);
      if (!p || RANK[p.level] > RANK[level]) { skipped.push({ id, why: 'unknown' }); continue; }
      if (p.mode !== 'install') { skipped.push({ id, why: 'page' }); continue; }
      if (running.has(id)) { skipped.push({ id, why: 'running' }); continue; }
      if (findExe(p)) { skipped.push({ id, why: 'installed' }); continue; }
      const job = jobs.create({ kind: 'program', hu: 'Telepítés: ' + p.name, run: async ctx => {
        try { await installOne(p, ctx); ctx.progress(1, 1, p.name + ' telepítve'); }
        catch (e) { throw new Error(p.name + ': ' + (e && e.message || e)); }
        finally { running.delete(id); }
      } });
      running.set(id, job);
      started.push({ id, job });
    }
    return { ok: true, started, skipped };
  }
  function launch(id) {
    const p = get(id); if (!p) return { ok: false, err: 'not-found', hu: 'Nincs ilyen program.' };
    const exe = findExe(p);
    if (!exe) return { ok: false, err: 'not-installed', hu: p.name + ' nincs telepítve.' };
    startExe(p.name, exe, [], path.dirname(exe));
    return { ok: true, hu: p.name + ' elindítva.', en: p.name + ' started.' };
  }
  function page(id) {
    const p = get(id); if (!p) return { ok: false, err: 'not-found', hu: 'Nincs ilyen program.' };
    if (!p.page) return { ok: false, err: 'no-page', hu: 'Ennek nincs hivatalos letöltő oldala.' };
    openUrl(p.page);
    return { ok: true, hu: 'Letöltő oldal megnyitva.', en: 'Download page opened.' };
  }
  function folder(id) {
    const p = get(id); if (!p) return null;
    const exe = findExe(p);
    return exe ? path.dirname(exe) : null;
  }

  return { load, get, list: listFor, status, install, launch, page, folder, errors: () => errors, resolve, all: () => list, findExe };
}

module.exports = { createPrograms, httpsNet, merge, LEVELS, RANK, isHttps, globRe };
