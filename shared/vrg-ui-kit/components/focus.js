/* VRG UI Kit — components/focus.js
   Keyboard plumbing shared by every component:
     VK.focus.roving(container, opts)  arrow-key movement inside a composite widget (one tab stop)
     VK.focus.trap(el, opts)           keep Tab inside a dialog/popover; Esc closes; focus restored
     VK.focus.enableHop(root)          Shift+Arrow jumps between regions marked [data-vk-hop]
     VK.focus.first(el) / .all(el)     focusable descendants
   Depends on: core.js. */
(function (root) {
  'use strict';
  var VK = root.VK = root.VK || {};
  if (VK.focus) return;

  var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), ' +
    'textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"], summary';

  function visible(n) { return !!(n.offsetWidth || n.offsetHeight || n.getClientRects().length) && getComputedStyle(n).visibility !== 'hidden'; }
  function all(scope) { return Array.prototype.filter.call((scope || document).querySelectorAll(FOCUSABLE), visible); }
  function first(scope) { return tabbable(scope)[0] || all(scope)[0] || null; }
  /** focusables that are in the Tab order (roving items parked at tabindex=-1 are not) */
  function tabbable(scope) { return all(scope).filter(function (n) { return n.tabIndex >= 0 && n.getAttribute('tabindex') !== '-1'; }); }
  function isEditable(n) {
    if (!n) return false;
    var t = n.tagName;
    return n.isContentEditable || t === 'TEXTAREA' || t === 'SELECT' ||
      (t === 'INPUT' && !/^(button|checkbox|radio|range|submit|reset|color)$/i.test(n.type));
  }

  /**
   * Roving tabindex. opts:
   *  items: selector for the items (default '[role="option"],[role="menuitem"],[role="tab"],[role="treeitem"],[role="gridcell"],button')
   *  orientation: 'horizontal' | 'vertical' | 'both' | 'grid'   (grid needs opts.cols → number)
   *  wrap: true · typeahead: true (jump by first letter, Hungarian-folded)
   *  onMove(item, index) · activeIndex: initial index
   * Returns {focus(i), current(), update(), destroy()}.
   */
  function roving(container, opts) {
    opts = opts || {};
    var sel = opts.items || '[role="option"],[role="menuitem"],[role="menuitemcheckbox"],[role="tab"],[role="treeitem"],[role="gridcell"],button';
    var orient = opts.orientation || 'vertical', wrap = opts.wrap !== false;
    var buf = '', bufT = 0;
    function items() { return Array.prototype.filter.call(container.querySelectorAll(sel), function (n) { return visible(n) && n.getAttribute('aria-disabled') !== 'true' && !n.disabled; }); }
    function current() { var list = items(); var i = list.indexOf(document.activeElement); return i >= 0 ? i : list.findIndex(function (n) { return n.tabIndex === 0; }); }
    function set(i, doFocus) {
      var list = items(); if (!list.length) return;
      i = wrap ? (i + list.length) % list.length : Math.max(0, Math.min(list.length - 1, i));
      list.forEach(function (n, k) { n.tabIndex = k === i ? 0 : -1; });
      if (doFocus !== false) { list[i].focus(); if (list[i].scrollIntoView) list[i].scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
      if (opts.onMove) opts.onMove(list[i], i);
    }
    function update() { var list = items(); if (!list.length) return; var i = current(); set(i < 0 ? (opts.activeIndex || 0) : i, false); }
    function onKey(e) {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.shiftKey && /^Arrow/.test(e.key)) return;                 // Shift+Arrow belongs to hop
      if (isEditable(e.target) && e.target !== container) return;
      var list = items(); var i = list.indexOf(document.activeElement); if (i < 0) return;
      var cols = orient === 'grid' && opts.cols ? opts.cols() : 1, n = null;
      var h = orient !== 'vertical', v = orient !== 'horizontal';
      switch (e.key) {
        case 'ArrowRight': if (h) n = i + 1; break;
        case 'ArrowLeft': if (h) n = i - 1; break;
        case 'ArrowDown': if (v) n = i + cols; break;
        case 'ArrowUp': if (v) n = i - cols; break;
        case 'Home': n = 0; break;
        case 'End': n = list.length - 1; break;
        default:
          if (opts.typeahead !== false && e.key.length === 1 && /\S/.test(e.key)) {
            var now = Date.now(); buf = (now - bufT > 600 ? '' : buf) + VK.fold(e.key); bufT = now;
            for (var k = 1; k <= list.length; k++) {
              var c = list[(i + (buf.length > 1 ? 0 : k)) % list.length];
              if (VK.fold(c.textContent.trim()).indexOf(buf) === 0) { set(list.indexOf(c)); e.preventDefault(); return; }
            }
          }
          return;
      }
      if (n === null) return;
      if (orient === 'grid' && (n < 0 || n >= list.length)) return;
      e.preventDefault(); set(n);
    }
    container.addEventListener('keydown', onKey);
    update();
    return { focus: function (i) { set(i); }, current: current, update: update, destroy: function () { container.removeEventListener('keydown', onKey); } };
  }

  /**
   * Focus trap for modal layers. opts: {initial: Element|selector, onEscape(), restore: true}
   * Returns release(). Esc calls onEscape (the owner closes and calls release).
   */
  function trap(el, opts) {
    opts = opts || {};
    var prev = document.activeElement;
    function onKey(e) {
      if (e.key === 'Escape' && opts.onEscape) { e.preventDefault(); e.stopPropagation(); opts.onEscape(e); return; }
      if (e.key !== 'Tab') return;
      var list = tabbable(el); if (!list.length) { e.preventDefault(); return; }
      var a = list[0], b = list[list.length - 1];
      if (e.shiftKey && (document.activeElement === a || !el.contains(document.activeElement))) { e.preventDefault(); b.focus(); }
      else if (!e.shiftKey && document.activeElement === b) { e.preventDefault(); a.focus(); }
    }
    el.addEventListener('keydown', onKey);
    var init = typeof opts.initial === 'string' ? el.querySelector(opts.initial) : opts.initial;
    (init || first(el) || el).focus({ preventScroll: true });
    return function release() {
      el.removeEventListener('keydown', onKey);
      if (opts.restore !== false && prev && prev.focus && document.contains(prev)) prev.focus({ preventScroll: true });
    };
  }

  /**
   * Shift+Arrow region hopping. Regions are elements with [data-vk-hop] (panels, docks, sections).
   * Moves to the nearest region in the arrow's direction and focuses its remembered or first focusable.
   */
  var hopOn = false;
  function enableHop(scope) {
    if (hopOn) return; hopOn = true;
    scope = scope || document;
    var last = new WeakMap();
    scope.addEventListener('focusin', function (e) { var r = e.target.closest && e.target.closest('[data-vk-hop]'); if (r) last.set(r, e.target); });
    scope.addEventListener('keydown', function (e) {
      if (!e.shiftKey || e.ctrlKey || e.altKey || e.metaKey || !/^Arrow/.test(e.key)) return;
      if (isEditable(e.target)) return;                          // Shift+Arrow selects text there
      var regions = Array.prototype.filter.call(scope.querySelectorAll('[data-vk-hop]'), visible);
      if (!regions.length) return;
      var from = e.target.closest && e.target.closest('[data-vk-hop]');
      var fr = (from || e.target).getBoundingClientRect();
      var cx = fr.left + fr.width / 2, cy = fr.top + fr.height / 2;
      var dir = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }[e.key];
      var best = null, bestD = Infinity;
      regions.forEach(function (r) {
        if (r === from || (from && (r.contains(from) || from.contains(r)))) return;
        var b = r.getBoundingClientRect(), x = b.left + b.width / 2, y = b.top + b.height / 2;
        var dx = x - cx, dy = y - cy, along = dx * dir[0] + dy * dir[1];
        if (along <= 1) return;
        var across = Math.abs(dx * dir[1]) + Math.abs(dy * dir[0]);
        var d = along + across * 2;
        if (d < bestD) { bestD = d; best = r; }
      });
      if (!best) return;
      e.preventDefault();
      var target = last.get(best);
      if (!target || !document.contains(target) || !visible(target)) target = best.querySelector('[tabindex="0"]') || first(best);
      if (!target) { if (!best.hasAttribute('tabindex')) best.tabIndex = -1; target = best; }
      target.focus();
      VK.fire(best, 'hop', { from: from });
    });
  }

  VK.focus = { FOCUSABLE: FOCUSABLE, all: all, tabbable: tabbable, first: first, isEditable: isEditable, roving: roving, trap: trap, enableHop: enableHop };
})(typeof window !== 'undefined' ? window : globalThis);
