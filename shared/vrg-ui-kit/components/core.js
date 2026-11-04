/* VRG UI Kit — components/core.js
   The VK namespace and the few helpers every scripted component shares. No DOM work at load time.
   Works as a classic <script> (sets window.VK) and as an ES module side-effect import
   (`import './core.js'` then use globalThis.VK). Depends on: nothing. */
(function (root) {
  'use strict';
  var VK = root.VK = root.VK || {};
  if (VK.core) return;

  var uidN = 0;
  /** unique id with a prefix, for aria-controls / aria-labelledby wiring */
  function uid(prefix) { uidN += 1; return (prefix || 'vk') + '-' + uidN.toString(36); }

  /** el('button.vk-btn', {type:'button', onclick: fn, 'aria-label': 'x'}, [child, 'text']) */
  function el(spec, attrs, children) {
    var m = String(spec).match(/^([a-z0-9-]+)?((?:\.[\w-]+)*)(?:#([\w-]+))?$/i) || [];
    var node = document.createElement(m[1] || 'div');
    if (m[2]) node.className = m[2].slice(1).replace(/\./g, ' ');
    if (m[3]) node.id = m[3];
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === undefined || v === null || v === false) return;
      if (k.slice(0, 2) === 'on' && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (k === 'text') node.textContent = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k === 'class') node.className += (node.className ? ' ' : '') + v;
      else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
      else if (k === 'dataset') Object.assign(node.dataset, v);
      else node.setAttribute(k, v === true ? '' : v);
    });
    append(node, children);
    return node;
  }
  function append(node, children) {
    if (children === undefined || children === null) return node;
    (Array.isArray(children) ? children : [children]).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    });
    return node;
  }

  /** an <svg class="vk-icon"><use href="#vk-i-NAME"/></svg>; needs the sprite in the document */
  function icon(name, cls) {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'vk-icon' + (cls ? ' ' + cls : ''));
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    var use = document.createElementNS(ns, 'use');
    use.setAttribute('href', '#vk-i-' + name);
    svg.appendChild(use);
    return svg;
  }

  /** tiny event emitter: var e = VK.emitter(); e.on('x', fn) → off(); e.emit('x', data) */
  function emitter() {
    var map = {};
    return {
      on: function (type, fn) { (map[type] = map[type] || []).push(fn); return function () { map[type] = (map[type] || []).filter(function (f) { return f !== fn; }); }; },
      emit: function (type, data) { (map[type] || []).slice().forEach(function (f) { try { f(data); } catch (e) { console.error(e); } }); }
    };
  }

  /** dispatch a bubbling CustomEvent named 'vk:<name>' from a node */
  function fire(node, name, detail) {
    return node.dispatchEvent(new CustomEvent('vk:' + name, { bubbles: true, cancelable: true, detail: detail }));
  }

  function reducedMotion() { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /** read a token's computed value (for canvas drawing): VK.token('--vk-accent', el?) */
  function token(name, from) {
    return getComputedStyle(from || document.documentElement).getPropertyValue(name).trim();
  }

  /** Hungarian-aware fold for search: lowercase, strip accents (ő→o, ű→u, …) */
  var FOLD = { 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ö': 'o', 'ő': 'o', 'ú': 'u', 'ü': 'u', 'ű': 'u' };
  function fold(s) { return String(s || '').toLowerCase().replace(/[áéíóöőúüű]/g, function (c) { return FOLD[c]; }); }

  /**
   * Place a floating element next to an anchor, flipping/shifting to stay in the viewport.
   * anchor: Element | DOMRect | {x, y} (a point, e.g. a context-menu click)
   * opts: {side:'bottom'|'top'|'right'|'left', align:'start'|'center'|'end', offset:4}
   * The floating element must be position:fixed (the kit's popovers are).
   */
  function place(floating, anchor, opts) {
    opts = opts || {};
    var side = opts.side || 'bottom', align = opts.align || 'start', off = opts.offset == null ? 4 : opts.offset;
    var r = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect()
      : anchor && anchor.width !== undefined ? anchor
      : { left: anchor.x, right: anchor.x, top: anchor.y, bottom: anchor.y, width: 0, height: 0 };
    var vw = root.innerWidth, vh = root.innerHeight, m = 4;
    floating.style.left = '0px'; floating.style.top = '0px';
    var f = floating.getBoundingClientRect();
    function pos(s) {
      var x, y;
      if (s === 'bottom' || s === 'top') {
        y = s === 'bottom' ? r.bottom + off : r.top - off - f.height;
        x = align === 'start' ? r.left : align === 'end' ? r.right - f.width : r.left + r.width / 2 - f.width / 2;
      } else {
        x = s === 'right' ? r.right + off : r.left - off - f.width;
        y = align === 'start' ? r.top : align === 'end' ? r.bottom - f.height : r.top + r.height / 2 - f.height / 2;
      }
      return { x: x, y: y };
    }
    var flip = { bottom: 'top', top: 'bottom', left: 'right', right: 'left' };
    var p = pos(side);
    var fits = function (q) { return q.x >= m && q.y >= m && q.x + f.width <= vw - m && q.y + f.height <= vh - m; };
    if (!fits(p)) { var q = pos(flip[side]); if (fits(q)) { p = q; side = flip[side]; } }
    p.x = clamp(p.x, m, Math.max(m, vw - f.width - m));
    p.y = clamp(p.y, m, Math.max(m, vh - f.height - m));
    floating.style.left = Math.round(p.x) + 'px';
    floating.style.top = Math.round(p.y) + 'px';
    floating.dataset.side = side;
    return side;
  }

  /** seeded PRNG (mulberry32) for generative visuals: var rnd = VK.rng('seed'); rnd() → [0,1) */
  function rng(seed) {
    var h = 1779033703 ^ String(seed).length;
    for (var i = 0; i < String(seed).length; i++) { h = Math.imul(h ^ String(seed).charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    var a = h >>> 0;
    return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  VK.core = { version: '1.0.0' };
  VK.uid = uid; VK.el = el; VK.append = append; VK.icon = icon; VK.emitter = emitter; VK.fire = fire;
  VK.reducedMotion = reducedMotion; VK.clamp = clamp; VK.token = token; VK.fold = fold; VK.place = place; VK.rng = rng;
})(typeof window !== 'undefined' ? window : globalThis);
