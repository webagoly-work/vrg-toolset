// fenyjel-chrome.js — the VRG Asztal's shell chrome in the Fényjel look (shared/fenyjel/DESIGN.md, rollout R5).
// fenyjel-chrome.css restyles the title bar, the top strip, the dock, the windows, the palette, the toasts and the sheets;
// this file swaps the chrome's two-letter monograms for pixel glyphs while html[data-look="fenyjel"] is set:
//   dock       a pinned program (data-id) shows its catalog glyph in its family colour; a running window (.win) gets the glyph
//              of what it shows in front of its name; the show-desktop button gets the desk glyph
//   windows    the head's icon (.ic) becomes the glyph of the window's catalog item (data-cat) or pane kind, and the window
//              takes the family (data-fj-family), so its focus edge and title glyph wear the family colour
//   title bar  a lit signal glyph in front of "VRG Asztal"
// It watches only the dock and the window layer (childList), never the panes' insides: a busy terminal costs nothing.
// Off the look, every swapped element gets its text back (data-fj-text), so Mélyvíz and Grafit stay as they were.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VRGFenyjelChrome = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** A pane kind's glyph and family (shell/lib/layout.js KINDS). */
  const KIND_GLYPH = {
    home: ['home', 'ui'], empty: ['apps', 'ui'], files: ['pcwin', 'sys'], term: ['terminal', 'run'], web: ['web', 'know'],
    mail: ['inbox', 'alert'], stack: ['stack', 'know'], chat: ['claude', 'link'], note: ['notes', 'know'], git: ['git', 'run'],
    feed: ['pager', 'alert'], app: ['apps', 'ui'], sessions: ['sheets', 'link'], controller: ['control', 'link'],
  };

  /** What a chrome element shows: a catalog item's glyph first (via the home's GLYPHS), else its pane kind's, else null. */
  function iconFor(o, glyphOf) {
    const id = o && o.id, kind = o && o.kind;
    if (id && glyphOf) {
      const g = glyphOf({ id, hu: o.hu || id, group: o.group || '' });
      if (g && g.glyph) return { glyph: g.glyph, family: g.family };
    }
    const k = KIND_GLYPH[kind];
    return k ? { glyph: k[0], family: k[1] } : null;
  }

  if (typeof document === 'undefined') return { KIND_GLYPH, iconFor };

  // ---------------------------------------------------------------- the page
  const W = window;
  const on = () => document.documentElement.dataset.look === 'fenyjel';
  const glyphOf = it => (W.VRGFenyjelHome ? W.VRGFenyjelHome.glyphOf(it) : null);
  const svg = (name, fam) => (W.FJIcons ? W.FJIcons.svg(name, { cls: 'fj-ic', title: '', colour: W.FJIcons.familyColour(fam) }) : '');
  const items = () => (W.VRGDesk && W.VRGDesk.items ? W.VRGDesk.items() : []);
  const byId = id => items().find(i => i.id === id) || { id };

  /** Swap an element's content for a glyph, keeping its text to give back later. */
  function swap(el, ic) {
    if (!ic || el.dataset.fjText !== undefined) return;
    el.dataset.fjText = el.textContent;
    el.dataset.fjFamily = ic.family;
    el.setAttribute('data-fj-family', ic.family);
    el.innerHTML = svg(ic.glyph, ic.family);
    el.classList.add('fjc-glyph');
  }
  function unswap(el) {
    if (el.dataset.fjText === undefined) return;
    el.textContent = el.dataset.fjText;
    delete el.dataset.fjText; delete el.dataset.fjFamily;
    el.removeAttribute('data-fj-family');
    el.classList.remove('fjc-glyph');
  }
  /** Put a glyph in front of an element's label (the running windows keep their names). */
  function lead(el, ic) {
    if (!ic || el.querySelector(':scope > .fjc-lead')) return;
    const s = document.createElement('i'); s.className = 'fjc-lead'; s.innerHTML = svg(ic.glyph, ic.family);
    el.setAttribute('data-fj-family', ic.family);
    el.prepend(s);
  }
  function unlead(el) { const s = el.querySelector(':scope > .fjc-lead'); if (s) { s.remove(); el.removeAttribute('data-fj-family'); } }

  function paneIcon(pane) {
    const F = W.VRGFrame; if (!F || !F.kindOf) return null;
    const kind = F.kindOf(pane), st = (F.stateOf && F.stateOf(pane)) || {};
    return iconFor(kind === 'app' ? Object.assign({ kind }, byId(st.id)) : { kind }, glyphOf);
  }

  function decorate() {
    if (!on()) return;
    const dock = document.querySelector('[data-role="dock"]');
    if (dock) {
      for (const b of dock.querySelectorAll(':scope > button[data-id]')) swap(b, iconFor(byId(b.dataset.id), glyphOf));
      for (const b of dock.querySelectorAll(':scope > button.win[data-pane]')) lead(b, paneIcon(b.dataset.pane));
      const sd = dock.querySelector(':scope > button[data-role="show-desktop"]'); if (sd) swap(sd, { glyph: 'desk', family: 'ui' });
    }
    for (const w of document.querySelectorAll('[data-role="sh-win"]')) {
      const ic = iconFor(Object.assign({ kind: w.dataset.kind }, w.dataset.cat ? byId(w.dataset.cat) : {}), glyphOf);
      if (!ic) continue;
      if (!w.hasAttribute('data-fj-family')) w.setAttribute('data-fj-family', ic.family);
      const i = w.querySelector('[data-role="sh-head"] .ic'); if (i) swap(i, ic);
    }
    const wt = document.querySelector('[data-role="wbar"] .wt');
    if (wt && !wt.querySelector('.fjc-lead')) lead(wt, { glyph: 'home', family: 'ui' });
  }
  function undecorate() {
    for (const el of document.querySelectorAll('[data-fj-text]')) unswap(el);
    for (const el of document.querySelectorAll('.fjc-lead')) unlead(el.parentElement);
    for (const w of document.querySelectorAll('[data-role="sh-win"][data-fj-family]')) w.removeAttribute('data-fj-family');
  }

  let queued = false;
  const soon = () => { if (queued) return; queued = true; Promise.resolve().then(() => { queued = false; decorate(); }); };
  const watched = new WeakSet();
  const mo = new MutationObserver(() => { watch(); soon(); });
  function watch() {
    for (const sel of ['[data-role="dock"]', '[data-role="sh-layer"]']) {
      const el = document.querySelector(sel);
      if (el && !watched.has(el)) { watched.add(el); mo.observe(el, { childList: true }); }
    }
  }
  new MutationObserver(() => (on() ? (watch(), decorate()) : undecorate()))
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-look'] });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { watch(); decorate(); });
  else { watch(); decorate(); }

  return { KIND_GLYPH, iconFor, decorate, undecorate };
}));
