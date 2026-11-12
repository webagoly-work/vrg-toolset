// ==========================================================================
// relay-files.js — the PC's work folders, read-only, for VRG Mobile (WP M23 · PC ablakok).
//
// What phone-relay-server.js needs to answer files.list / files.read / files.copy for a trusted (paired, M2) phone, and only
// when the relay was started with --files (RELAY_FILES=1).
//
//   roots    the VRG Desktop's own (Dashboard/config/roots.json), narrowed by Mobile/catalogue/files.json to the work roots
//            (D-17: Repó, VRG Full, Közös; never Asztal, Dokumentumok, Letöltések or the private OneDrive root).
//   places   the Desktop units that open the browser at their folder (Munkák → Full\jobs, BRIDGE, Workflow Kit), by key.
//   list     one folder: its sub-folders, then its files, at most 400 rows. Dot-files, secret names (as the Desktop's
//            appscheme.js), the deny list and links that lead out of their root are never listed nor reachable.
//   read     a look at one file: text (64 KB, UTF-8 or Windows-1250), an image (1 MB), else "binary" (copy it instead).
//   copy     the file onto the Átadás board (M12, relay-board.js) as a PC entry: the phone then takes it from there.
//            Nothing on the PC is ever written, moved or deleted by this module; the board keeps its own copy.
//
// THE RULE (as relay-launch.js): the phone never sends a path. Every row the relay lists carries a handle (16 hex), made
// here and kept in memory; the phone sends a handle back, or a place key, or nothing (the roots). A relay restart forgets
// the handles, and the phone starts again at the roots. Every handle is checked again against its root when it is used.
// ==========================================================================

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO = path.resolve(__dirname, '..', '..', '..', '..');
const FULL = path.dirname(REPO);
// RELAY_FILES_CONF / RELAY_FILES_ROOTS: another files.json / roots.json (tests only, with throwaway folders)
const CONF_FILE = process.env.RELAY_FILES_CONF || path.join(REPO, 'Mobile', 'catalogue', 'files.json');
const ROOTS_FILE = process.env.RELAY_FILES_ROOTS || path.join(REPO, 'Dashboard', 'config', 'roots.json');

const H = /^[0-9a-f]{16}$/;
const PLACE = /^[a-z0-9-]{1,24}$/;
const ROWS = 400;
const TEXT_MAX = 64 * 1024;
const IMAGE_MAX = 1024 * 1024;
const HANDLES = 20000;
const SNIFF = 4096;
const IMAGES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp' };
const FORCE_BINARY = new Set(['.bin', '.exe', '.dll', '.zip', '.7z', '.pdf', '.docx', '.xlsx', '.pptx', '.iso', '.dat', '.apk', '.jar']);
// the Desktop's appscheme.js SECRET, per name: dot-files, the anonymiser's map, credentials, keys
const SECRET = /^(\..*|anonymise\.map\.json|.*credentials.*\.json|secrets\.bin|oauth-clients\.json|.*\.pem|.*\.key|.*\.env|.*\.pfx|.*\.p12|id_rsa.*|id_ed25519.*)$/i;

/** A name that is never listed: dot-files and secret names, and names Windows would read as another (trailing dot or space, ':'). */
function hiddenName(name) {
  return typeof name !== 'string' || !name || /[.\s]$/.test(name) || name.includes(':') || SECRET.test(name);
}

const real = p => { try { return fs.realpathSync.native(p); } catch (e) { return null; } };
const key = p => String(p).replace(/[\\/]+$/, '').toLowerCase() + path.sep;
const within = (p, dir) => key(p).startsWith(key(dir));

/** files.json: { roots: Set<id>, places: Map<key, {root, rel}>, deny: [{root, rel}] }. */
function loadConf(file = CONF_FILE) {
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  const spec = s => { const m = /^([a-z0-9_-]{1,40}):(.+)$/.exec(String(s)); return m && !/(^|[\\/])\.\.([\\/]|$)/.test(m[2]) ? { root: m[1], rel: m[2] } : null; };
  const places = new Map();
  for (const [k, v] of Object.entries(j.places || {})) { const s = spec(v); if (PLACE.test(k) && s) places.set(k, s); }
  return { roots: new Set(((j.roots && j.roots.allow) || []).filter(x => /^[a-z0-9_-]{1,40}$/.test(x))), places, deny: (j.deny || []).map(spec).filter(Boolean) };
}

/** The allowed roots of the Desktop's table that exist here: [{ id, hu, real }]. Only `path` rows ({repo}, {full} or absolute). */
function buildRoots({ conf = loadConf(), rootsFile = ROOTS_FILE, repo = REPO, full = FULL } = {}) {
  const rows = JSON.parse(fs.readFileSync(rootsFile, 'utf8'));
  const out = [];
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r || !conf.roots.has(r.id) || typeof r.path !== 'string') continue;
    const abs = r.path.replace(/\{repo\}/g, repo).replace(/\{full\}/g, full);
    if (!path.isAbsolute(abs)) continue;
    const rp = real(abs);
    if (!rp) continue;
    try { if (!fs.statSync(rp).isDirectory()) continue; } catch (e) { continue; }
    out.push({ id: r.id, hu: String(r.hu || r.id), real: rp });
  }
  return out;
}

// text bytes → { text, encoding }; a cut inside a UTF-8 character (a truncated read) is not an error (the Desktop's fsview.js)
const utf8 = buf => { try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) { return null; } };
function decodeText(buf, truncated) {
  let t = utf8(buf);
  for (let cut = 1; t === null && truncated && cut <= 3 && cut < buf.length; cut++) t = utf8(buf.subarray(0, buf.length - cut));
  if (t !== null) return { text: t.replace(/^﻿/, ''), encoding: 'utf-8' };
  return { text: new TextDecoder('windows-1250').decode(buf), encoding: 'windows-1250' };
}

function sha256(file) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha256');
    fs.createReadStream(file).on('data', d => h.update(d)).on('end', () => resolve(h.digest('hex'))).on('error', reject);
  });
}

/**
 * The browser. roots: buildRoots(); conf: loadConf(); board: relay-board's createBoard() (for copy).
 * Every answer is { ok:true, … } or { ok:false, reason } (Hungarian, for the phone).
 */
function createFiles({ roots = buildRoots(), conf = loadConf(), board = null } = {}) {
  const byId = new Map(roots.map(r => [r.id, r]));
  const handles = new Map();                    // h -> { root, abs }
  const byAbs = new Map();                      // key(abs) -> h, so a row keeps its handle across listings
  const denied = conf.deny.map(d => byId.has(d.root) ? real(path.join(byId.get(d.root).real, d.rel)) : null).filter(Boolean);

  function handle(root, abs) {
    const k = root + '|' + key(abs);
    let h = byAbs.get(k);
    if (h && handles.has(h)) return h;
    do { h = crypto.randomBytes(8).toString('hex'); } while (handles.has(h));
    handles.set(h, { root, abs });
    byAbs.set(k, h);
    while (handles.size > HANDLES) {            // the oldest go first; the phone then starts at the roots again
      const [old, v] = handles.entries().next().value;
      handles.delete(old); byAbs.delete(v.root + '|' + key(v.abs));
    }
    return h;
  }

  /** abs inside its root, every step a listable name, not denied → the real path; else null. */
  function safe(root, abs) {
    const r = byId.get(root);
    if (!r) return null;
    const rp = real(abs);
    if (!rp || !within(rp, r.real)) return null;
    const rel = path.relative(r.real, rp);
    if (rel && rel.split(path.sep).some(hiddenName)) return null;
    if (denied.some(d => within(rp, d))) return null;
    return rp;
  }

  function resolve(p) {
    if (p && p.h != null) {
      const v = typeof p.h === 'string' && H.test(p.h) ? handles.get(p.h) : null;
      if (!v) return { err: 'Ez a hely már nem érvényes (a relé újraindult?). Kezdd a gyökereknél.' };
      const rp = safe(v.root, v.abs);
      return rp ? { root: v.root, abs: rp, h: p.h } : { err: 'Ez a hely nem érhető el.' };
    }
    if (p && p.place != null) {
      const pl = typeof p.place === 'string' && PLACE.test(p.place) ? conf.places.get(p.place) : null;
      const r = pl && byId.get(pl.root);
      const rp = r && safe(pl.root, path.join(r.real, pl.rel));
      return rp ? { root: pl.root, abs: rp, h: handle(pl.root, rp) } : { err: 'Ez a hely nincs meg ezen a PC-n.' };
    }
    return null;                                // the roots
  }

  function crumbs(root, abs) {
    const r = byId.get(root);
    const out = [{ h: handle(root, r.real), name: r.hu }];
    const rel = path.relative(r.real, abs);
    let at = r.real;
    for (const part of rel ? rel.split(path.sep) : []) { at = path.join(at, part); out.push({ h: handle(root, at), name: part }); }
    return out;
  }

  function list(p = {}) {
    const t = resolve(p);
    if (t && t.err) return { ok: false, reason: t.err };
    if (!t) return { ok: true, h: null, root: null, crumbs: [], truncated: false,
      entries: roots.map(r => ({ h: handle(r.id, r.real), name: r.hu, dir: true, bytes: 0, mtime: 0 })) };
    let st;
    try { st = fs.statSync(t.abs); } catch (e) { return { ok: false, reason: 'Ez a mappa nem olvasható.' }; }
    if (!st.isDirectory()) return { ok: false, reason: 'Ez nem mappa.' };
    let names;
    try { names = fs.readdirSync(t.abs); } catch (e) { return { ok: false, reason: 'Ez a mappa nem olvasható.' }; }
    const rows = [];
    for (const n of names) {
      if (hiddenName(n)) continue;
      const rp = safe(t.root, path.join(t.abs, n));   // a link out of the root, a denied folder: not listed
      if (!rp) continue;
      let s;
      try { s = fs.statSync(rp); } catch (e) { continue; }
      if (!s.isDirectory() && !s.isFile()) continue;
      rows.push({ abs: path.join(t.abs, n), name: n, dir: s.isDirectory(), bytes: s.isFile() ? s.size : 0, mtime: Math.round(s.mtimeMs) });
    }
    rows.sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name, 'hu', { sensitivity: 'base', numeric: true }) : a.dir ? -1 : 1));
    return { ok: true, h: t.h, root: t.root, crumbs: crumbs(t.root, t.abs), truncated: rows.length > ROWS,
      entries: rows.slice(0, ROWS).map(r => ({ h: handle(t.root, r.abs), name: r.name, dir: r.dir, bytes: r.bytes, mtime: r.mtime })) };
  }

  function fileOf(p) {
    const t = p && p.h != null ? resolve({ h: p.h }) : { err: 'Hiányzó fájl.' };
    if (t.err) return t;
    let st;
    try { st = fs.statSync(t.abs); } catch (e) { return { err: 'A fájl nem olvasható.' }; }
    if (!st.isFile()) return { err: 'Ez nem fájl.' };
    return { ...t, size: st.size, name: path.basename(t.abs) };
  }

  function read(p = {}) {
    const f = fileOf(p);
    if (f.err) return { ok: false, reason: f.err };
    const ext = path.extname(f.name).toLowerCase();
    const base = { ok: true, h: f.h, name: f.name, size: f.size };
    if (IMAGES[ext] && f.size > IMAGE_MAX) return { ...base, kind: 'binary', truncated: true };
    const want = Math.min(f.size, IMAGES[ext] ? IMAGE_MAX : TEXT_MAX);
    let buf = Buffer.alloc(want), fd;
    try { fd = fs.openSync(f.abs, 'r'); buf = buf.subarray(0, fs.readSync(fd, buf, 0, want, 0)); }
    catch (e) { return { ok: false, reason: 'A fájl nem olvasható.' }; }
    finally { if (fd !== undefined) try { fs.closeSync(fd); } catch (e) { /* closed */ } }
    if (IMAGES[ext]) return { ...base, kind: 'image', mime: IMAGES[ext], data: buf.toString('base64'), truncated: false };
    if (FORCE_BINARY.has(ext) || buf.subarray(0, SNIFF).includes(0)) return { ...base, kind: 'binary', truncated: false };
    const truncated = f.size > TEXT_MAX;
    const d = decodeText(buf, truncated);
    return { ...base, kind: 'text', text: d.text, encoding: d.encoding, truncated };
  }

  async function copy(p = {}) {
    if (!board) return { ok: false, reason: 'Az Átadás tábla nem elérhető.' };
    const f = fileOf(p);
    if (f.err) return { ok: false, reason: f.err };
    if (f.size > board.max) return { ok: false, reason: `Túl nagy az Átadáshoz: legfeljebb ${Math.round(board.max / 1024 / 1024)} MB.` };
    let sha;
    try { sha = await sha256(f.abs); } catch (e) { return { ok: false, reason: 'A fájl nem olvasható.' }; }
    const r = await board.receive(fs.createReadStream(f.abs), { name: f.name, sha256: sha, target: 'inbox', from: 'pc', length: f.size });
    return r.ok ? { ok: true, h: f.h, entry: { id: r.entry.id, name: r.entry.name, bytes: r.entry.bytes } } : { ok: false, reason: r.reason };
  }

  return { list, read, copy, roots: () => roots.map(r => ({ id: r.id, hu: r.hu })), places: () => [...conf.places.keys()] };
}

module.exports = { loadConf, buildRoots, createFiles, hiddenName, decodeText, H, ROWS, TEXT_MAX, IMAGE_MAX };
