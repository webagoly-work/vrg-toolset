// ui.js — the VRG Böngésző's small DOM helpers. Text always goes in through textContent (never innerHTML), so nothing a
// bookmark title, a reader block or a suggestion carries can become markup. Kit pieces: VK.icon (the sprite), VK.toast.
(function (root) {
  'use strict';
  const VB = root.VB = root.VB || {};
  if (VB.ui) return;

  // h('div.cls', { attrs, on: { click } }, children…) — children: nodes, strings (as text), arrays, null
  function h(spec, attrs, ...kids) {
    const m = /^([a-z0-9]+)?((?:\.[\w-]+)*)$/i.exec(spec) || [];
    const el = document.createElement(m[1] || 'div');
    if (m[2]) el.className = m[2].slice(1).replace(/\./g, ' ');
    if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'on') { for (const [ev, f] of Object.entries(v)) el.addEventListener(ev, f); continue; }
      if (k === 'class') { el.className += (el.className ? ' ' : '') + v; continue; }
      if (k === 'text') { el.textContent = v; continue; }
      if (k === 'style' && typeof v === 'object') { Object.assign(el.style, v); continue; }
      if (k in el && typeof v !== 'string') { el[k] = v; continue; }
      el.setAttribute(k, v === true ? '' : String(v));
    }
    add(el, kids);
    return el;
  }
  function add(el, kids) {
    for (const k of kids.flat(Infinity)) {
      if (k == null || k === false) continue;
      el.appendChild(k instanceof Node ? k : document.createTextNode(String(k)));
    }
    return el;
  }
  const icon = name => (root.VK && root.VK.icon ? root.VK.icon(name) : h('span', { 'aria-hidden': 'true' }));
  function btn(label, opts) {
    const o = opts || {};
    const b = h('button.vk-btn', { type: 'button', title: o.title || null, 'aria-label': o.aria || (o.iconOnly ? label : null), 'data-variant': o.variant || null,
      'aria-pressed': o.pressed == null ? null : String(!!o.pressed), class: (o.iconOnly ? 'vk-btn--icon' : '') + (o.small ? ' vk-btn--sm' : ''), on: o.on || (o.click ? { click: o.click } : null) });
    if (o.icon) b.appendChild(icon(o.icon));
    if (!o.iconOnly) b.appendChild(document.createTextNode(label));
    if (o.disabled) b.disabled = true;
    return b;
  }
  // a switch (role=switch) — the kit's toggle look, kept local so the app needs no extra component
  function toggle(on, change, label) {
    const b = h('button.vb-switch', { type: 'button', role: 'switch', 'aria-checked': String(!!on), 'aria-label': label || null });
    b.addEventListener('click', () => { const v = b.getAttribute('aria-checked') !== 'true'; b.setAttribute('aria-checked', String(v)); change(v); });
    return b;
  }
  // text with the ranges [[a, b]…] wrapped in <mark>
  function marked(text, ranges) {
    const f = document.createDocumentFragment();
    let at = 0;
    for (const [a, b] of ranges || []) {
      if (a < at || b > text.length) continue;
      if (a > at) f.appendChild(document.createTextNode(text.slice(at, a)));
      f.appendChild(h('mark', null, text.slice(a, b)));
      at = b;
    }
    if (at < text.length) f.appendChild(document.createTextNode(text.slice(at)));
    return f;
  }
  // highlight the query's words in a short label (Hungarian-folded, as the engine matches)
  function highlight(text, query) {
    const s = String(text || '');
    if (!query || !VB.engine) return document.createTextNode(s);
    const f = VB.engine.fold(s), ranges = [];
    for (const w of VB.engine.fold(query).split(/[^a-z0-9ß-ɏ]+/).filter(x => x.length >= 2)) {
      let i = 0;
      while ((i = f.indexOf(w, i)) >= 0) { ranges.push([i, i + w.length]); i += w.length; }
    }
    ranges.sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const r of ranges) { const l = merged[merged.length - 1]; if (l && r[0] <= l[1]) l[1] = Math.max(l[1], r[1]); else merged.push(r); }
    return marked(s, merged);
  }
  function toast(kind, title, text, action) {
    if (root.VK && root.VK.toast) return root.VK.toast.show({ kind: kind === 'error' ? 'error' : kind, title, text, action, timeout: kind === 'error' ? 9000 : 4500 });
    if (typeof console !== 'undefined') console.log('[' + kind + '] ' + title + (text ? ': ' + text : ''));
    return null;
  }
  // a modal dialog; resolves with the value of the button pressed (Esc / scrim = null). Own markup: Android's WebView
  // shows no confirm() unless the app implements it.
  function dialog(title, body, buttons) {
    return new Promise(resolve => {
      const prev = document.activeElement;
      const close = v => { scrim.remove(); document.removeEventListener('keydown', key, true); if (prev && prev.focus) prev.focus(); resolve(v); };
      const acts = h('div.vb-actions', null, (buttons || [{ label: 'Rendben', value: true, variant: 'primary' }]).map(b => btn(b.label, { variant: b.variant, click: () => close(b.value) })));
      const box = h('div.vb-dialog', { role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, h('h2', null, title), body, acts);
      const scrim = h('div.vb-scrim', { on: { click: e => { if (e.target === scrim) close(null); } } }, box);
      const key = e => {
        if (e.key === 'Escape') { e.preventDefault(); close(null); }
        if (e.key === 'Tab') {
          const f = [...box.querySelectorAll('button, input, select, textarea, a[href]')].filter(x => !x.disabled);
          if (!f.length) return;
          if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
          else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
        }
      };
      document.addEventListener('keydown', key, true);
      document.body.appendChild(scrim);
      (box.querySelector('input, select, textarea') || acts.querySelector('[data-variant="primary"]') || acts.querySelector('button')).focus();
    });
  }
  const when = t => {
    const d = new Date(t), n = new Date();
    const day = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((day(n) - day(d)) / 86400000);
    const hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    if (diff === 0) return 'ma ' + hm;
    if (diff === 1) return 'tegnap ' + hm;
    return d.getFullYear() + '. ' + String(d.getMonth() + 1).padStart(2, '0') + '. ' + String(d.getDate()).padStart(2, '0') + '.';
  };
  const dayLabel = t => {
    const d = new Date(t), n = new Date();
    const diff = Math.round((new Date(n.getFullYear(), n.getMonth(), n.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
    if (diff === 0) return 'Ma';
    if (diff === 1) return 'Tegnap';
    const M = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];
    return d.getFullYear() + '. ' + M[d.getMonth()] + ' ' + d.getDate() + '.';
  };
  // a file to the user: a download where the host allows it, else the text to the clipboard (VRG Mobile's WebView
  // ignores blob downloads, M21 "Later")
  async function giveFile(name, text, kind) {
    if (kind !== 'mobile') {
      const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: 'application/json' })), download: name });
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      return 'download';
    }
    try { await navigator.clipboard.writeText(text); return 'clipboard'; } catch (e) { return 'failed'; }
  }

  VB.ui = { h, add, icon, btn, toggle, marked, highlight, toast, dialog, when, dayLabel, giveFile };
})(typeof window !== 'undefined' ? window : globalThis);
