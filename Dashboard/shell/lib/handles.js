// handles.js — opaque file handles. The page only ever holds `h:` + 22 base64url chars issued here for this run.
//   const handles = createHandles({ roots });   issue(abs) → 'h:…' | null     resolve(h) → { abs, root } | null
// resolve() re-checks rootOf(realpath(abs)) every time, so a folder swapped for a junction after issue is refused.
// createFsView adds the listing / stat that fs.list and fs.stat answer with (API.md vrg.fs).
'use strict';
const crypto = require('crypto'), fs = require('fs'), path = require('path');

const MAX_HANDLES = 200000;
const MAX_ITEMS = 5000;
const HANDLE_RE = /^h:[A-Za-z0-9_-]{22}$/;

function createHandles({ roots, max = MAX_HANDLES }) {
  const table = new Map();                                        // handle → { abs, root }   (insertion order = age)
  const byAbs = new Map();                                        // lower-case abs → handle, so a re-listing reuses handles

  function drop() {
    const oldest = table.keys().next().value;
    const e = table.get(oldest);
    table.delete(oldest);
    if (e && byAbs.get(e.abs.toLowerCase()) === oldest) byAbs.delete(e.abs.toLowerCase());
  }

  function issue(abs) {
    if (typeof abs !== 'string' || !path.isAbsolute(abs)) return null;
    const root = roots.rootOf(abs);
    if (!root) return null;
    const k = abs.toLowerCase();
    const known = byAbs.get(k);
    if (known && table.has(known)) return known;
    const h = 'h:' + crypto.randomBytes(16).toString('base64url');
    table.set(h, { abs, root });
    byAbs.set(k, h);
    while (table.size > max) drop();
    return h;
  }

  function resolve(h) {
    if (typeof h !== 'string' || !HANDLE_RE.test(h)) return null;
    const e = table.get(h);
    if (!e) return null;
    const root = roots.rootOf(e.abs);                              // realpath inside; null when gone or outside every root
    if (!root) return null;
    return { abs: e.abs, root };
  }

  return { issue, resolve, size: () => table.size };
}

const fold = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function createFsView({ roots, handles, cloud }) {
  function item(abs, name, st, mark) {
    const h = handles.issue(abs);
    if (!h) return null;                                           // a link leading outside every root is not shown
    let kind = st.isSymbolicLink() ? 'link' : (st.isDirectory() ? 'dir' : 'file');
    let size = st.size, mtime = st.mtimeMs;
    if (kind === 'link') {
      try { const t = fs.statSync(abs); size = t.size; mtime = t.mtimeMs; if (t.isDirectory()) kind = 'dir'; } catch (e) {}
    }
    const it = { handle: h, name, kind, size: kind === 'dir' ? 0 : size, mtime: Math.round(mtime) };
    if (mark) it.cloud = mark;
    return it;
  }

  function parentOf(abs, rootId) {
    const r = roots.get(rootId);
    const here = (() => { try { return fs.realpathSync.native(abs).toLowerCase(); } catch (e) { return ''; } })();
    if (r && here === r.real.toLowerCase()) return undefined;      // at the root: no parent
    const up = path.dirname(abs);
    if (up === abs) return undefined;
    return handles.issue(up) || undefined;
  }

  async function list(h, { sort = 'name', filter = '' } = {}) {
    const d = handles.resolve(h);
    if (!d) return { ok: false, err: 'not-found', hu: 'Nincs ilyen mappa.' };
    let names;
    try { if (!fs.statSync(d.abs).isDirectory()) throw new Error('not a dir'); names = fs.readdirSync(d.abs); }
    catch (e) { return { ok: false, err: 'not-found', hu: 'A mappa nem olvasható.' }; }
    const rt = roots.get(d.root);
    const marks = rt && rt.kind !== 'local' && cloud ? await cloud.marks(d.abs) : new Map();
    const f = fold(filter);
    let items = [];
    for (const name of names) {
      if (f && !fold(name).includes(f)) continue;
      const abs = path.join(d.abs, name);
      let st; try { st = fs.lstatSync(abs); } catch (e) { continue; }
      const it = item(abs, name, st, marks.get(name));
      if (it) items.push(it);
    }
    const cmp = {
      name: (a, b) => a.name.localeCompare(b.name, 'hu'),
      size: (a, b) => a.size - b.size || a.name.localeCompare(b.name, 'hu'),
      mtime: (a, b) => b.mtime - a.mtime || a.name.localeCompare(b.name, 'hu'),
    }[sort] || ((a, b) => a.name.localeCompare(b.name, 'hu'));
    items.sort((a, b) => (a.kind === 'dir') === (b.kind === 'dir') ? cmp(a, b) : (a.kind === 'dir' ? -1 : 1));
    const out = { dir: { handle: h, display: d.abs }, items };
    const parent = parentOf(d.abs, d.root);
    if (parent) out.dir.parent = parent;
    if (items.length > MAX_ITEMS) { out.items = items.slice(0, MAX_ITEMS); out.truncated = true; }
    return out;
  }

  async function stat(h) {
    const d = handles.resolve(h);
    if (!d) return { ok: false, err: 'not-found', hu: 'Nincs ilyen elem.' };
    let st; try { st = fs.lstatSync(d.abs); } catch (e) { return { ok: false, err: 'not-found', hu: 'Nincs ilyen elem.' }; }
    const rt = roots.get(d.root);
    let mark;
    if (rt && rt.kind !== 'local' && cloud) mark = (await cloud.marks(path.dirname(d.abs))).get(path.basename(d.abs));
    const it = item(d.abs, path.basename(d.abs), st, mark);
    return it ? { item: it } : { ok: false, err: 'not-found', hu: 'Nincs ilyen elem.' };
  }

  function rootList() {
    return roots.list().map(r => ({ root: 'root:' + r.id, hu: r.hu, kind: r.kind, handle: handles.issue(r.real) })).filter(r => r.handle);
  }

  return { list, stat, rootList };
}

module.exports = { createHandles, createFsView, MAX_HANDLES, MAX_ITEMS };
