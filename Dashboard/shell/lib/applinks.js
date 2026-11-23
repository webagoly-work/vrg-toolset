// applinks.js — the VRG Böngésző's one door into the Asztal (T1, BRW-Q01): vrg-app://browser/__vrg/links. The browser app
// (catalog id `browser`) reads and writes the master bookmarks and history (<userDir>/web.json, lib/bookmarks.js) through
// it; every other app origin, and every web page, is refused (web tabs run in persist:vrg-web, where vrg-app:// has no
// handler at all). No preload, no window.vrg: the app fetches a path on its own origin and main answers (DESKU-Q08 kept).
//   GET  → the links as vrg.web-links v1 (the inbox of Browser/serve.js absorbed first)
//   POST { ops: [...] } → the ops applied (lib/bookmarks.js applyOps), then the links as GET returns them
// Pure: main passes a plain request { method, url, origin, body } and gets { status, json }; node --test loads it.
'use strict';

const APP = 'browser';
const PATH = '/__vrg/links';
const MAX_BODY = 1024 * 1024;

function isLinksRequest(url) {
  try { const u = new URL(url); return u.protocol === 'vrg-app:' && u.host === APP && u.pathname === PATH; } catch (e) { return false; }
}

function createAppLinks({ bookmarks }) {
  const envelope = () => Object.assign({ format: 'vrg.web-links', v: 1 }, bookmarks.snapshot());
  function handle({ method, url, origin, body }) {
    if (!isLinksRequest(url)) return { status: 404, json: { ok: false, hu: 'Nincs ilyen.' } };
    // a same-origin fetch from the app sends its own origin (or none for a GET); anything else is another app or a page
    if (origin && origin !== 'vrg-app://' + APP) return { status: 403, json: { ok: false, hu: 'Csak a VRG Böngésző kérheti.' } };
    if (method === 'GET') { bookmarks.absorb(); return { status: 200, json: envelope() }; }
    if (method !== 'POST') return { status: 405, json: { ok: false, hu: 'GET vagy POST.' } };
    if (origin !== 'vrg-app://' + APP) return { status: 403, json: { ok: false, hu: 'Írni csak a VRG Böngésző írhat.' } };
    if (typeof body !== 'string' || body.length > MAX_BODY) return { status: 413, json: { ok: false, hu: 'Túl nagy kérés.' } };
    let j;
    try { j = JSON.parse(body); } catch (e) { return { status: 400, json: { ok: false, hu: 'Nem JSON.' } }; }
    if (!j || !Array.isArray(j.ops)) return { status: 400, json: { ok: false, hu: 'Hiányzik az ops lista.' } };
    bookmarks.absorb();
    const applied = bookmarks.applyOps(j.ops);
    return { status: 200, json: Object.assign(envelope(), { applied }) };
  }
  return { handle };
}

module.exports = { createAppLinks, isLinksRequest, APP, PATH };
