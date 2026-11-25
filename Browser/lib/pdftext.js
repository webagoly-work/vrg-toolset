// pdftext.js — a PDF datasheet's text for the reader (T4), with pdf.js (Vendor/pdfjs, npm pdfjs-dist, the LEGACY build as
// vendor-manifest.json says: the modern one needs Uint8Array.prototype.toHex). Vendor/ is not in git: without it the
// reader says how to fetch it (node tools/fetch-vendor.js pdfjs). Only the text layer is read: no fonts loaded, no eval,
// no scripting, no network (the PDF arrives as bytes from lib/netguard.js).
//   await pdfText(buffer, { maxPages }) → { ok, title, pages, blocks: [{ t, text }], words } | { ok: false, code, hu }
'use strict';
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ENTRY = path.join(__dirname, '..', '..', 'Vendor', 'pdfjs', 'legacy', 'build', 'pdf.mjs');
let lib = null;
async function load() {
  if (lib) return lib;
  if (!fs.existsSync(ENTRY)) return null;
  // pdf.js warns at load that it cannot draw (no canvas); this reads text only, so those lines are kept off the console
  const warn = console.warn, log = console.log;
  console.warn = (...a) => { if (!/canvas|DOMMatrix|Path2D|polyfill/i.test(String(a[0]))) warn(...a); };
  console.log = (...a) => { if (!/canvas|DOMMatrix|Path2D|polyfill/i.test(String(a[0]))) log(...a); };
  try { lib = await import(pathToFileURL(ENTRY).href); } finally { console.warn = warn; console.log = log; }
  return lib;
}

// text items → lines: items on (nearly) the same baseline join, a bigger gap starts a paragraph
function linesOf(items) {
  const rows = [];
  for (const it of items) {
    if (!it || typeof it.str !== 'string') continue;
    const y = Math.round((it.transform ? it.transform[5] : 0) * 10) / 10, x = it.transform ? it.transform[4] : 0, h = Math.abs(it.height || (it.transform ? it.transform[3] : 10)) || 10;
    let r = rows.find(q => Math.abs(q.y - y) <= Math.max(2, h * 0.3));
    if (!r) rows.push(r = { y, h, parts: [] });
    r.parts.push({ x, s: it.str });
  }
  rows.sort((a, b) => b.y - a.y);
  return rows.map(r => ({ y: r.y, h: r.h, text: r.parts.sort((a, b) => a.x - b.x).map(p => p.s).join(' ').replace(/\s+/g, ' ').trim() })).filter(r => r.text);
}

function blocksOf(lines, pageNo) {
  const blocks = [{ t: 'h3', text: pageNo + '. oldal' }];
  let para = [], lastY = null, lastH = 10;
  const flush = () => { if (para.length) { blocks.push({ t: 'p', text: para.join(' ').slice(0, 6000) }); para = []; } };
  for (const l of lines) {
    if (lastY !== null && lastY - l.y > lastH * 1.8) flush();
    para.push(l.text);
    lastY = l.y; lastH = l.h;
  }
  flush();
  return blocks;
}

async function pdfText(buf, o) {
  const opt = Object.assign({ maxPages: 60 }, o || {});
  const pdfjs = await load();
  if (!pdfjs) return { ok: false, code: 'pdf-lib', hu: 'A PDF olvasásához kell a pdf.js: node tools/fetch-vendor.js pdfjs (egyszer, a Vendor mappába).' };
  let doc;
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false, disableFontFace: true, useSystemFonts: false,
      enableXfa: false, stopAtErrors: false, verbosity: 0 }).promise;
  } catch (e) {
    return { ok: false, code: /password/i.test(e && e.name) ? 'pdf-locked' : 'pdf-bad', hu: /password/i.test(e && e.name) ? 'A PDF jelszóval védett.' : 'A PDF nem olvasható (' + ((e && e.message) || 'hiba') + ').' };
  }
  try {
    let title = '';
    try { const m = await doc.getMetadata(); title = String((m && m.info && m.info.Title) || '').trim(); } catch (e) {}
    const blocks = [];
    const n = Math.min(doc.numPages, opt.maxPages);
    for (let i = 1; i <= n; i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      blocks.push(...blocksOf(linesOf(tc.items), i));
      page.cleanup();
    }
    if (doc.numPages > n) blocks.push({ t: 'p', text: '… további ' + (doc.numPages - n) + ' oldal a teljes PDF-ben.' });
    const text = blocks.filter(b => b.t === 'p').map(b => b.text).join('\n');
    if (!text.trim()) return { ok: false, code: 'pdf-image', hu: 'A PDF csak képet tartalmaz (szkennelt), nincs kiolvasható szöveg.', pages: doc.numPages };
    if (!title) { const first = blocks.find(b => b.t === 'p'); title = first ? first.text.slice(0, 120) : ''; }
    return { ok: true, title: title.slice(0, 300), pages: doc.numPages, blocks: blocks.slice(0, 3000), words: text.split(/\s+/).length };
  } finally { try { await doc.destroy(); } catch (e) {} }
}

module.exports = { pdfText, linesOf, available: () => fs.existsSync(ENTRY) };
