// applinks.js — the VRG Böngésző's door into the Asztal: vrg-app://browser/__vrg/links (T1, BRW-Q01) and /__vrg/claude (T5). The browser app
// (catalog id `browser`) reads and writes the master bookmarks and history (<userDir>/web.json, lib/bookmarks.js) through
// it; every other app origin, and every web page, is refused (web tabs run in persist:vrg-web, where vrg-app:// has no
// handler at all). No preload, no window.vrg: the app fetches a path on its own origin and main answers (DESKU-Q08 kept).
//   GET  → the links as vrg.web-links v1 (the inbox of Browser/serve.js absorbed first)
//   POST { ops: [...] } → the ops applied (lib/bookmarks.js applyOps), then the links as GET returns them
//   POST /__vrg/claude { title, text } → a context pack of that text (lib/ctx.js packText) attached to a new thread of the chat
//   pane (Küldés Claude-nak, T5); nothing is sent to Claude until the user writes the question and presses Enter
// Pure: main passes a plain request { method, url, origin, body } and gets { status, json }; node --test loads it.
'use strict';

const APP = 'browser';
const PATH = '/__vrg/links';
const CLAUDE = '/__vrg/claude';
const TEXT_MAX = 200000;
const MAX_BODY = 1024 * 1024;

const pathOf = url => { try { const u = new URL(url); return u.protocol === 'vrg-app:' && u.host === APP ? u.pathname : ''; } catch (e) { return ''; } };
function isLinksRequest(url) { const p = pathOf(url); return p === PATH || p === CLAUDE; }

function createAppLinks({ bookmarks, toClaude = null }) {
  const envelope = () => Object.assign({ format: 'vrg.web-links', v: 1 }, bookmarks.snapshot());
  function claude({ method, origin, body }) {
    if (method !== 'POST') return { status: 405, json: { ok: false, hu: 'POST.' } };
    if (origin !== 'vrg-app://' + APP) return { status: 403, json: { ok: false, hu: 'Csak a VRG Böngésző kérheti.' } };
    if (typeof body !== 'string' || body.length > TEXT_MAX + 4096) return { status: 413, json: { ok: false, hu: 'Túl hosszú szöveg.' } };
    let j;
    try { j = JSON.parse(body); } catch (e) { return { status: 400, json: { ok: false, hu: 'Nem JSON.' } }; }
    const title = String((j && j.title) || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 200);
    const text = String((j && j.text) || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
    if (!text.trim()) return { status: 400, json: { ok: false, hu: 'Üres szöveg.' } };
    if (!toClaude) return { status: 503, json: { ok: false, hu: 'A Claude csevegés itt nem érhető el.' } };
    const r = toClaude(title || 'VRG Böngésző', text.slice(0, TEXT_MAX));
    return r && r.ok ? { status: 200, json: { ok: true, hu: 'A csevegő panelen, csatolva: ' + (title || 'szöveg') + '. Írd meg a kérdést, és Enter.' } } : { status: 500, json: { ok: false, hu: (r && r.hu) || 'A csomag nem jött létre.' } };
  }
  function handle({ method, url, origin, body }) {
    if (!isLinksRequest(url)) return { status: 404, json: { ok: false, hu: 'Nincs ilyen.' } };
    if (pathOf(url) === CLAUDE) return claude({ method, origin, body });
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

module.exports = { createAppLinks, isLinksRequest, APP, PATH, CLAUDE };
