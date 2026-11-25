// lib/shared.js — T9: the VRG Böngésző's side of the shared OneDrive tree (VRG-Megosztott, on H: the junction H:\VRG\Shared).
//
//   60_Linkek\<slug>.links.json   shared lists (BRW-Q06 = B): vrg.web-links v1, written atomically, read by everyone the
//                                 folder is shared with. A list keeps its file across saves (same name = an update).
//   00_START\linkek.html          the guest page (BRW-Q05 = A) the Kapu's "Linkek (vendég)" button opens: built here from the
//                                 rows sent, filtered again here (src/core/share.js guest) with this PC's job codes.
//
//   const s = createShared({ root, jobs })        root = the VRG-Megosztott folder ('' = none on this PC)
//   s.list() · s.get(file) · s.save({ name, by, doc }) · s.guest({ title, doc }) · s.guestInfo()
// The root is never guessed beyond VRG_SHARED or <repo>\..\..\Shared (H:\VRG\Shared); the folders inside it are the tree's own.
'use strict';
const fs = require('fs');
const path = require('path');
const links = require('../src/core/links');
const share = require('../src/core/share');

const LISTS = '60_Linkek';
const START = '00_START';
const GUEST = 'linkek.html';
const FILE_RE = /^[a-z0-9-]{1,60}(-\d{1,2})?\.links\.json$/;
const MAX = 16 * 1024 * 1024;

function defaultRoot(repo) {
  if (process.env.VRG_SHARED) return process.env.VRG_SHARED;
  const p = path.resolve(repo, '..', '..', 'Shared');
  return fs.existsSync(p) ? p : '';
}

function atomic(file, text) {
  const t = file + '.tmp';
  fs.writeFileSync(t, text);
  fs.renameSync(t, file);
}

function createShared(o) {
  const root = o.root || '';
  const codes = () => { try { const l = o.jobs && o.jobs.list(); return l && l.ok ? l.jobs.map(j => j.code) : []; } catch (e) { return []; } };
  const none = () => ({ ok: false, code: 'no-shared', hu: 'Ezen a gépen nincs közös OneDrive mappa (VRG-Megosztott, H:\\VRG\\Shared).' });
  const has = () => root && fs.existsSync(root) && fs.statSync(root).isDirectory();
  const dir = () => path.join(root, LISTS);

  function readFile(name) {
    const f = path.join(dir(), name);
    const st = fs.statSync(f);
    if (st.size > MAX) throw new Error('too big');
    const raw = JSON.parse(fs.readFileSync(f, 'utf8'));
    links.read(raw);                                               // a newer or another format is refused, never half-read
    return { raw, mtime: st.mtimeMs };
  }

  function list() {
    if (!has()) return none();
    if (!fs.existsSync(dir())) return { ok: true, lists: [], folder: LISTS };
    const out = [];
    for (const name of fs.readdirSync(dir()).filter(n => FILE_RE.test(n)).sort().slice(0, 200)) {
      try { const r = readFile(name); out.push(Object.assign({ file: name, mtime: r.mtime }, share.summary(r.raw))); }
      catch (e) { out.push({ file: name, bad: true, hu: 'Nem olvasható (más formátum vagy újabb változat).' }); }
    }
    out.sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
    return { ok: true, lists: out, folder: LISTS };
  }

  function get(file) {
    if (!has()) return none();
    if (!FILE_RE.test(String(file || ''))) return { ok: false, code: 'bad', hu: 'Ismeretlen lista.' };
    try { return Object.assign({ ok: true, file }, { doc: readFile(file).raw }); }
    catch (e) { return { ok: false, code: e.code === 'ENOENT' ? 'missing' : 'format', hu: e.code === 'ENOENT' ? 'Nincs ilyen lista.' : 'Nem olvasható lista.' }; }
  }

  function save(j) {
    if (!has()) return none();
    const name = String((j && j.name) || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 120);
    if (!name) return { ok: false, code: 'bad', hu: 'Adj nevet a listának.' };
    let doc;
    try { doc = links.read(j.doc); } catch (e) { return { ok: false, code: 'format', hu: 'Ez nem könyvjelzőlista (vrg.web-links v1).' }; }
    const ext = (j.doc && j.doc[links.EXT]) || {};
    if (!doc.bookmarks.length && !(ext.reading || []).length) return { ok: false, code: 'empty', hu: 'A lista üres.' };
    const text = share.listFile({ bookmarks: doc.bookmarks, [links.EXT]: { meta: ext.meta || {}, reading: ext.reading || [] } }, { name, by: j.by });
    if (text.length > MAX) return { ok: false, code: 'big', hu: 'A lista túl nagy (16 MB fölött).' };
    fs.mkdirSync(dir(), { recursive: true });
    // the same list name keeps its file (an update); another list that happens to share the slug gets -2, -3 …
    const base = share.slug(name);
    let file = base + '.links.json';
    for (let n = 2; n < 100 && fs.existsSync(path.join(dir(), file)); n++) {
      let same = false;
      try { same = share.summary(JSON.parse(fs.readFileSync(path.join(dir(), file), 'utf8'))).name === share.summary(JSON.parse(text)).name; } catch (e) {}
      if (same) break;
      file = base + '-' + n + '.links.json';
    }
    atomic(path.join(dir(), file), text);
    return { ok: true, file, where: LISTS + '\\' + file, bookmarks: doc.bookmarks.length, reading: (ext.reading || []).length,
      hu: 'Megosztva: ' + LISTS + '\\' + file + ' — a OneDrive szinkronizálja.' };
  }

  function guest(j) {
    if (!has()) return none();
    const start = path.join(root, START);
    if (!fs.existsSync(start)) return { ok: false, code: 'no-start', hu: 'Nincs ' + START + ' mappa a közös OneDrive-ban (ott van a Kapu).' };
    const g = share.guest(j && j.doc, { jobs: codes() });
    const built = new Date().toISOString().slice(0, 10);
    atomic(path.join(start, GUEST), share.guestHtml(g.items, { title: j && j.title, built }));
    return { ok: true, where: START + '\\' + GUEST, kept: g.items.length, dropped: g.dropped,
      hu: 'Vendégoldal: ' + START + '\\' + GUEST + ' — ' + g.items.length + ' link' + (g.dropped.length ? ', ' + g.dropped.length + ' kimaradt' : '') + '.' };
  }

  function guestInfo() {
    if (!has()) return none();
    const f = path.join(root, START, GUEST);
    return fs.existsSync(f) ? { ok: true, exists: true, at: fs.statSync(f).mtimeMs, where: START + '\\' + GUEST } : { ok: true, exists: false, where: START + '\\' + GUEST };
  }

  return { list, get, save, guest, guestInfo, root, codes };
}

module.exports = { createShared, defaultRoot, LISTS, START, GUEST, FILE_RE };
