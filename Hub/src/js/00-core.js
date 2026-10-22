// Core helpers shared by every module. Pure where possible, so Hub/test can run them in Node.

const KP_PREFIX = 'vrgKapu.';

// Every storage access goes through here: file:// and locked-down profiles throw on
// localStorage, and the page must still render ("csak linkek" mode).
const kpStore = {
  available() {
    try { const k = KP_PREFIX + '__t'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return true; }
    catch (e) { return false; }
  },
  get(key, def) {
    try {
      const v = localStorage.getItem(KP_PREFIX + key);
      return v == null ? def : JSON.parse(v);
    } catch (e) { return def; }
  },
  set(key, value) {
    try { localStorage.setItem(KP_PREFIX + key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }
};

const KP_ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function kpEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => KP_ESC[c]);
}

// kpEl('button', { class: 'x', onclick: fn }, 'text', childNode)
function kpEl(tag, attrs, ...kids) {
  const svg = ['svg', 'g', 'path', 'rect', 'circle', 'line', 'text', 'tspan'].includes(tag);
  const el = svg ? document.createElementNS('http://www.w3.org/2000/svg', tag) : document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

// "2026-10-21" or a Date -> "2026. 10. 21." (Hungarian order); bad input -> ''
function kpFmtDate(d) {
  const m = typeof d === 'string' ? d.match(/^(\d{4})-(\d{2})-(\d{2})/) : null;
  if (m) return m[1] + '. ' + m[2] + '. ' + m[3] + '.';
  if (d instanceof Date && !isNaN(d)) {
    const p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '. ' + p(d.getMonth() + 1) + '. ' + p(d.getDate()) + '.';
  }
  return '';
}

// The JSON blocks the build bakes in; null when a file did not exist at build time.
function kpEmbedded(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  try { return JSON.parse(el.textContent); } catch (e) { return null; }
}

// 4912 -> "4 912" (Hungarian grouping, also for four digits)
function kpGroup(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
