/* VRG UI Kit — components/splitter.js — resizable split view (horizontal / vertical, nestable).
     var s = VK.splitter.mount(el, {orientation:'horizontal', value:30, default:30, min:[160, 120],
                                    label:'Alaprajz és adatok', onChange: v => save(v)})
     s.value() · s.set(v) · s.reset() · s.destroy()
   el holds two .vk-split__pane children; a pane may hold another .vk-split (nesting).
   orientation 'horizontal' = panes side by side; 'vertical' = stacked. value = first pane size in % of the box.
   Keyboard on the separator (role=separator, aria-valuenow/min/max): ←/→ (↑/↓ when vertical) step,
   Ctrl+arrow or PageUp/PageDown big step, Home/End = min/max, Enter = reset (double-click too).
   Shift+arrow is left alone (region hopping). onChange fires on commit (key, drag end) — use it to persist.
   Depends on: core.js. */
(function (root) {
  'use strict';
  var VK = root.VK = root.VK || {};
  if (VK.splitter) return;

  function mount(el, opts) {
    opts = opts || {};
    var horiz = (opts.orientation || el.dataset.orientation || 'horizontal') !== 'vertical';
    el.classList.add('vk-split');
    el.dataset.orientation = horiz ? 'horizontal' : 'vertical';
    var panes = Array.prototype.filter.call(el.children, function (c) { return c.classList.contains('vk-split__pane'); });
    if (panes.length < 2) throw new Error('VK.splitter.mount: two .vk-split__pane children required');
    var a = panes[0], b = panes[1];
    if (!a.id) a.id = VK.uid('vk-pane');
    var bar = Array.prototype.find.call(el.children, function (c) { return c.classList.contains('vk-split__bar'); });
    if (!bar) { bar = VK.el('div.vk-split__bar'); el.insertBefore(bar, b); }
    bar.setAttribute('role', 'separator');
    bar.setAttribute('tabindex', '0');
    bar.setAttribute('aria-orientation', horiz ? 'vertical' : 'horizontal');
    bar.setAttribute('aria-controls', a.id);
    bar.setAttribute('aria-label', opts.label || 'Panelméret');
    bar.title = (opts.label || 'Panelméret') + ' — nyilak, Ctrl + nyíl, Home/End, Enter: alap';

    var def = opts.default != null ? +opts.default : opts.value != null ? +opts.value : 50;
    var value = opts.value != null ? +opts.value : def;
    var step = opts.step || 2, big = opts.bigStep || 10;
    var min = opts.min || [64, 64];

    function bounds() {
      var t = horiz ? el.clientWidth : el.clientHeight, bs = horiz ? bar.offsetWidth : bar.offsetHeight;
      if (!t) return [0, 100];
      var lo = (min[0] || 0) / t * 100, hi = 100 - ((min[1] || 0) + bs) / t * 100;
      if (hi < lo) { var m = (lo + hi) / 2; lo = hi = m; }
      return [Math.max(0, lo), Math.min(100, hi)];
    }
    function apply(v, commit) {
      var bd = bounds();
      value = VK.clamp(v, bd[0], bd[1]);
      el.style.setProperty('--vk-splitter-pos', value + '%');
      bar.setAttribute('aria-valuenow', String(Math.round(value)));
      bar.setAttribute('aria-valuemin', String(Math.round(bd[0])));
      bar.setAttribute('aria-valuemax', String(Math.round(bd[1])));
      bar.setAttribute('aria-valuetext', opts.valueText ? opts.valueText(value) : Math.round(value) + '%');
      if (commit && opts.onChange) opts.onChange(Math.round(value * 10) / 10);
      if (commit) VK.fire(el, 'splitchange', { value: value });
    }

    function onKey(e) {
      if (e.shiftKey || e.altKey) return;                       // Shift+arrow = region hop
      var dec = horiz ? 'ArrowLeft' : 'ArrowUp', inc = horiz ? 'ArrowRight' : 'ArrowDown';
      var s = (e.ctrlKey || e.metaKey) ? big : step, n = null, bd;
      switch (e.key) {
        case dec: n = value - s; break;
        case inc: n = value + s; break;
        case 'PageUp': n = value - big; break;
        case 'PageDown': n = value + big; break;
        case 'Home': bd = bounds(); n = bd[0]; break;
        case 'End': bd = bounds(); n = bd[1]; break;
        case 'Enter': n = def; break;
      }
      if (n === null) return;
      e.preventDefault(); e.stopPropagation();
      apply(n, true);
    }
    function onDown(e) {
      if (e.button) return;
      e.preventDefault();
      try { bar.setPointerCapture(e.pointerId); } catch (x) { /* synthetic events */ }
      bar.focus({ preventScroll: true });
      el.setAttribute('data-dragging', '');
      function mv(ev) {
        var r = el.getBoundingClientRect(), bs = horiz ? bar.getBoundingClientRect().width : bar.getBoundingClientRect().height;
        var p = horiz ? (ev.clientX - r.left - bs / 2) / r.width : (ev.clientY - r.top - bs / 2) / r.height;
        apply(p * 100, false);
      }
      function up() {
        bar.removeEventListener('pointermove', mv); bar.removeEventListener('pointerup', up); bar.removeEventListener('pointercancel', up);
        el.removeAttribute('data-dragging');
        apply(value, true);
      }
      bar.addEventListener('pointermove', mv); bar.addEventListener('pointerup', up); bar.addEventListener('pointercancel', up);
    }
    function onDbl() { apply(def, true); }

    bar.addEventListener('keydown', onKey);
    bar.addEventListener('pointerdown', onDown);
    bar.addEventListener('dblclick', onDbl);
    var ro = root.ResizeObserver ? new ResizeObserver(function () { apply(value, false); }) : null;
    if (ro) ro.observe(el);
    apply(value, false);

    return {
      el: el, bar: bar,
      value: function () { return value; },
      set: function (v) { apply(+v, true); },
      reset: function () { apply(def, true); },
      destroy: function () {
        bar.removeEventListener('keydown', onKey); bar.removeEventListener('pointerdown', onDown); bar.removeEventListener('dblclick', onDbl);
        if (ro) ro.disconnect();
      }
    };
  }

  VK.splitter = { mount: mount };
})(typeof window !== 'undefined' ? window : globalThis);
