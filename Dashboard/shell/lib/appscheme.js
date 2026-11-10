// appscheme.js — the vrg-app:// scheme of the VRG Asztal (WP-43, DESKU-Q08): an in-shell HTML app gets a real origin, so its
// localStorage works (file:// has a null origin and saving fails silently).
//   vrg-app://<catalog id>/<repo-relative path>   e.g.  vrg-app://calc-panel/Calculator/panel_anyagar_kalkulator.html
// decide(url) serves a file only when the host is a catalog item that opens as an app, and the path, after normalising, lies in
// that item's own folder or in shared/ (a page at the repo root is served alone). Dot-files and known secret names never.
// Pure decision (no Electron); main turns { ok, file } into a Response with net.fetch(file:).
'use strict';
const path = require('path');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.wasm': 'application/wasm', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.csv': 'text/csv; charset=utf-8', '.glb': 'model/gltf-binary',
  '.bin': 'application/octet-stream', '.pbf': 'application/x-protobuf', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.mp4': 'video/mp4',
};
const SECRET = /(^|\/)(\.[^/]*|anonymise\.map\.json|[^/]*credentials[^/]*\.json|secrets\.bin|oauth-clients\.json|[^/]*\.pem|[^/]*\.key)$/i;

function createAppScheme({ catalog, repo, expand, isFile }) {
  const REPO = path.resolve(repo);
  function decide(url) {
    let u;
    try { u = new URL(String(url)); } catch (e) { return { ok: false, status: 400, why: 'bad url' }; }
    if (u.protocol !== 'vrg-app:') return { ok: false, status: 400, why: 'scheme' };
    const id = u.hostname;
    const t = catalog.appTarget(id, { repo: REPO, expand });
    if (!t) return { ok: false, status: 404, why: 'not an app' };
    let rel;
    try { rel = decodeURIComponent(u.pathname).replace(/^\/+/, ''); } catch (e) { return { ok: false, status: 400, why: 'bad path' }; }
    if (!rel) rel = t.page;
    if (rel.includes('\0') || /^[a-z]:/i.test(rel) || rel.startsWith('\\\\')) return { ok: false, status: 403, why: 'path' };
    const abs = path.resolve(REPO, rel);
    const back = path.relative(REPO, abs).split(path.sep).join('/');
    if (!back || back.startsWith('..') || path.isAbsolute(back)) return { ok: false, status: 403, why: 'outside the repo' };
    if (!t.allow.some(a => (a.endsWith('/') ? back.startsWith(a) : back === a))) return { ok: false, status: 403, why: 'outside the app folder' };
    if (SECRET.test(back)) return { ok: false, status: 403, why: 'never served' };
    if (!isFile(abs)) return { ok: false, status: 404, why: 'no such file' };
    return { ok: true, file: abs, type: TYPES[path.extname(abs).toLowerCase()] || 'application/octet-stream', id, page: t.page };
  }
  // the URL a view loads for catalog item `id` (its owner id), or '' when it is not an app
  function urlFor(id) {
    const t = catalog.appTarget(id, { repo: REPO, expand });
    return t ? 'vrg-app://' + id + '/' + t.page.split('/').map(encodeURIComponent).join('/') : '';
  }
  // a view of app `id` may stay on its own origin; anything else is refused (http(s) goes to the browser pane)
  const sameApp = (id, url) => { try { const u = new URL(String(url)); return u.protocol === 'vrg-app:' && u.hostname === id; } catch (e) { return false; } };
  return { decide, urlFor, sameApp };
}

const PRIVILEGES = { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: false, bypassCSP: false };

module.exports = { createAppScheme, PRIVILEGES, TYPES, SECRET };
