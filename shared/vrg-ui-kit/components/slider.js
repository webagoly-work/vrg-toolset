/* VRG UI Kit — components/slider.js — single and range sliders (role=slider thumbs, no native range input).
     var s = VK.slider.mount(el, {
       label: 'Terhelés', unit: 'A', min: 0, max: 63, step: 1, bigStep: 10,
       value: 16,              // single  ·  values: [12, 48]  → range (two thumbs that never cross)
       ticks: 8,               // a tick every 8 units (or an array of values) · labels: 16 (every 16) | array | true
       vertical: false, disabled: false,
       format: function (v) { return '16' },        // readout / aria-valuetext number part (default: Hungarian decimal comma)
       thumbLabels: ['Minimum', 'Maximum'],
       onInput: function (v) {}, onChange: function (v) {}   // v = number, or [a, b] for a range
     }) → { get(), set(v), disable(bool), mini(opts), destroy() }
   Keys on a thumb: ←↓ −step, →↑ +step, PageDown/PageUp ∓bigStep, Home/End = ends (a range thumb stops at the
   other thumb). Shift+Arrow is left to region hopping. Pointer: press anywhere on the rail, drag.
   s.mini() = its MINI: ring = position in the range, value = the number; click focuses the slider.
   Fires 'vk:input' / 'vk:change' on el. Depends on: core.js, mini.js. */
(function (root) {
  'use strict';
  var VK = root.VK = root.VK || {};
  if (VK.slider) return;

  function decimals(step) { var s = String(step); var i = s.indexOf('.'); return i < 0 ? 0 : s.length - i - 1; }

  function mount(el, o) {
    o = o || {};
    var min = o.min == null ? 0 : +o.min, max = o.max == null ? 100 : +o.max, step = o.step || 1;
    var big = o.bigStep || Math.max(step, (max - min) / 10), dec = decimals(step);
    var range = Array.isArray(o.values), vertical = !!o.vertical, disabled = !!o.disabled;
    var vals = range ? o.values.slice(0, 2) : [o.value == null ? min : o.value];
    var unit = o.unit || '', minis = [];
    var fmt = o.format || function (v) { return v.toFixed(dec).replace('.', ','); };
    var names = o.thumbLabels || ['Minimum', 'Maximum'];

    el.classList.add('vk-slider'); el.textContent = '';
    if (range) el.setAttribute('data-range', ''); if (vertical) el.dataset.orient = 'vertical';
    var lid = VK.uid('vk-sl');
    var out = VK.el('output.vk-slider__out', { 'aria-live': 'off' });
    var head = VK.el('div.vk-slider__head', null, [o.label ? VK.el('span.vk-slider__label', { id: lid, text: o.label }) : null, out]);
    var track = VK.el('div.vk-slider__track');
    var fill = VK.el('div.vk-slider__fill'); track.appendChild(fill);
    var rail = VK.el('div.vk-slider__rail', null, track);
    var thumbs = vals.map(function (v, i) {
      var t = VK.el('div.vk-slider__thumb', { role: 'slider', tabindex: '0', id: VK.uid('vk-th'), 'data-i': String(i),
        'aria-orientation': vertical ? 'vertical' : 'horizontal' });
      if (o.label) t.setAttribute('aria-label', range ? o.label + ' — ' + names[i].toLowerCase() : o.label);
      rail.appendChild(t);
      return t;
    });
    out.setAttribute('for', thumbs.map(function (t) { return t.id; }).join(' '));
    el.appendChild(head); el.appendChild(rail);

    // ticks
    var tickVals = Array.isArray(o.ticks) ? o.ticks : o.ticks ? seq(o.ticks) : [];
    var labelVals = Array.isArray(o.labels) ? o.labels : o.labels === true ? tickVals : o.labels ? seq(o.labels) : [];
    if (tickVals.length || labelVals.length) {
      var tk = VK.el('div.vk-slider__ticks', { 'aria-hidden': 'true' });
      tickVals.forEach(function (v) { var m = VK.el('i.vk-slider__tick'); if (labelVals.indexOf(v) >= 0) m.setAttribute('data-major', ''); pos(m, v); tk.appendChild(m); });
      labelVals.forEach(function (v, i) {
        var l = VK.el('span.vk-slider__tlabel', { text: fmt(v) });
        if (i === 0 && v === min) l.setAttribute('data-first', ''); if (i === labelVals.length - 1 && v === max) l.setAttribute('data-last', '');
        pos(l, v); tk.appendChild(l);
      });
      el.appendChild(tk);
    }
    function seq(every) { var a = []; for (var v = min; v <= max + 1e-9; v += every) a.push(+v.toFixed(6)); return a; }
    function pct(v) { return max === min ? 0 : (v - min) / (max - min) * 100; }
    function pos(n, v) { if (vertical) n.style.bottom = pct(v) + '%'; else n.style.left = pct(v) + '%'; }

    function snap(v) { v = Math.round((v - min) / step) * step + min; return +VK.clamp(v, min, max).toFixed(dec); }
    function bounds(i) { if (!range) return [min, max]; return i === 0 ? [min, vals[1]] : [vals[0], max]; }
    function text(v) { return fmt(v) + (unit ? ' ' + unit : ''); }

    function draw() {
      thumbs.forEach(function (t, i) {
        var v = vals[i], b = bounds(i);
        pos(t, v);
        t.setAttribute('aria-valuenow', String(v));
        t.setAttribute('aria-valuemin', String(b[0])); t.setAttribute('aria-valuemax', String(b[1]));
        t.setAttribute('aria-valuetext', range ? names[i] + ': ' + text(v) : text(v));
        t.tabIndex = disabled ? -1 : 0;
        if (disabled) t.setAttribute('aria-disabled', 'true'); else t.removeAttribute('aria-disabled');
      });
      var a = range ? pct(vals[0]) : 0, b = pct(range ? vals[1] : vals[0]);
      if (vertical) { fill.style.bottom = a + '%'; fill.style.height = (b - a) + '%'; }
      else { fill.style.left = a + '%'; fill.style.width = (b - a) + '%'; }
      out.textContent = '';
      VK.append(out, [range ? fmt(vals[0]) + ' – ' + fmt(vals[1]) : fmt(vals[0]), unit ? VK.el('span.vk-slider__unit', { text: unit }) : null]);
      if (disabled) el.setAttribute('aria-disabled', 'true'); else el.removeAttribute('aria-disabled');
      minis.forEach(drawMini);
    }
    function value() { return range ? vals.slice() : vals[0]; }
    function setOne(i, v, commit) {
      var b = bounds(i); v = VK.clamp(snap(v), b[0], b[1]);
      if (v === vals[i]) { if (commit) emit('change'); return; }
      vals[i] = v; draw(); emit('input'); if (commit) emit('change');
    }
    function emit(kind) {
      var v = value();
      var fn = kind === 'input' ? o.onInput : o.onChange;
      if (fn) { try { fn(v); } catch (e) { console.error(e); } }
      VK.fire(el, kind, { value: v });
    }

    thumbs.forEach(function (t, i) {
      t.addEventListener('keydown', function (e) {
        if (disabled || e.altKey || e.ctrlKey || e.metaKey) return;
        if (e.shiftKey && /^Arrow/.test(e.key)) return;
        var v = vals[i], b = bounds(i), n = null;
        switch (e.key) {
          case 'ArrowRight': case 'ArrowUp': n = v + step; break;
          case 'ArrowLeft': case 'ArrowDown': n = v - step; break;
          case 'PageUp': n = v + big; break;
          case 'PageDown': n = v - big; break;
          case 'Home': n = b[0]; break;
          case 'End': n = b[1]; break;
          default: return;
        }
        e.preventDefault(); setOne(i, n, true);
      });
    });

    // pointer: press anywhere on the rail
    var dragI = -1;
    function fromEvent(e) {
      var r = rail.getBoundingClientRect();
      var f = vertical ? (r.bottom - e.clientY) / r.height : (e.clientX - r.left) / r.width;
      return min + VK.clamp(f, 0, 1) * (max - min);
    }
    rail.addEventListener('pointerdown', function (e) {
      if (disabled || e.button > 0) return;
      var v = fromEvent(e), i = 0;
      if (range) {
        var ti = thumbs.indexOf(e.target);
        if (ti >= 0) i = ti;
        else i = Math.abs(v - vals[0]) <= Math.abs(v - vals[1]) ? (v > vals[1] ? 1 : 0) : 1;
        if (vals[0] === vals[1]) i = v < vals[0] ? 0 : 1;
      }
      dragI = i; thumbs[i].setAttribute('data-drag', '');
      try { rail.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
      e.preventDefault(); thumbs[i].focus();
      setOne(i, v, false);
    });
    rail.addEventListener('pointermove', function (e) { if (dragI >= 0) setOne(dragI, fromEvent(e), false); });
    function end() { if (dragI < 0) return; thumbs[dragI].removeAttribute('data-drag'); dragI = -1; emit('change'); }
    rail.addEventListener('pointerup', end);
    rail.addEventListener('pointercancel', end);

    function drawMini(m) {
      var p = range ? (pct(vals[1]) - pct(vals[0])) / 100 : pct(vals[0]) / 100;
      m.dataset.label = (o.label || 'Érték') + ': ' + (range ? fmt(vals[0]) + '–' + fmt(vals[1]) : fmt(vals[0])) + (unit ? ' ' + unit : '');
      m.title = m.dataset.label;
      VK.mini.set(m, { progress: p, value: range ? fmt(vals[1] - vals[0]) : fmt(vals[0]) });
      m.disabled = disabled;
    }

    draw();
    return {
      get: value,
      set: function (v) { if (range) { vals = [snap(Math.min(v[0], v[1])), snap(Math.max(v[0], v[1]))]; } else vals = [snap(v)]; draw(); },
      disable: function (on) { disabled = on !== false; draw(); },
      mini: function (mo) {
        mo = mo || {};
        var m = VK.mini.create({ icon: mo.icon || 'slider', label: o.label, caption: mo.caption, meter: mo.meter || 'ticks', size: mo.size, onClick: function () { thumbs[0].focus(); } });
        minis.push(m); drawMini(m); return m;
      },
      destroy: function () { el.textContent = ''; el.classList.remove('vk-slider'); }
    };
  }

  VK.slider = { mount: mount };
})(typeof window !== 'undefined' ? window : globalThis);
