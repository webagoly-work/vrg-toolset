/* VRG UI Kit — components/minimap.js — overview of a VK.graph with its viewport rectangle.
     var mm = VK.minimap.mount(el, graphInstance, {label})  → { update(), destroy() }
   Click or drag on the map moves the graph's view (drag the ice rectangle, or click elsewhere to centre there).
   Keyboard (one tab stop): arrows move the viewport · + − zoom · 0 fit. Shift+Arrow is left to region hopping.
   Redraws on the graph's data / layer / select events, moves the rectangle on its view event.
   Add class vk-minimap--overlay to float it in the bottom-right corner of a positioned parent.
   Depends on: core.js, graph.js (any object with the graph instance API: model, getView, panBy, centerOn, zoomBy, fit, on). */
(function (root) {
  'use strict';
  var VK = root.VK = root.VK || {};
  if (VK.minimap) return;

  var NS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) if (attrs[k] != null && attrs[k] !== false) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function r1(v) { return Math.round(v * 10) / 10; }

  function mount(el, g, opts) {
    opts = opts || {};
    el.classList.add('vk-minimap');
    el.setAttribute('role', 'application');
    el.setAttribute('aria-roledescription', 'áttekintő térkép');
    el.setAttribute('aria-label', opts.label || 'Áttekintő térkép: a nyilak mozgatják a nézetet, plusz és mínusz nagyít, nulla illeszt');
    el.tabIndex = 0;
    el.textContent = '';
    var s = svg('svg', { class: 'vk-minimap__svg', role: 'none', preserveAspectRatio: 'xMidYMid meet' }, el);
    var gContent = svg('g', null, s);
    var vp = svg('rect', { class: 'vk-minimap__vp' }, s);
    var cap = VK.el('span.vk-minimap__cap', { 'aria-hidden': 'true' });
    var live = VK.el('span.vk-sr-only', { role: 'status', 'aria-live': 'polite' });
    el.appendChild(cap); el.appendChild(live);
    var box = null;   // the viewBox in graph content coords

    function draw() {
      gContent.textContent = '';
      var m = g.model(); if (!m.bounds) return;
      var b = m.bounds, pw = (b.x1 - b.x0) * 0.08 + 10, ph = (b.y1 - b.y0) * 0.08 + 10;
      box = { x: b.x0 - pw, y: b.y0 - ph, w: b.x1 - b.x0 + 2 * pw, h: b.y1 - b.y0 + 2 * ph };
      s.setAttribute('viewBox', [box.x, box.y, box.w, box.h].map(r1).join(' '));
      m.frames.forEach(function (f) { svg('path', { class: 'vk-minimap__frame', d: f.d }, gContent); });
      m.edges.forEach(function (e) {
        if (e.hidden) return;
        svg('path', { class: 'vk-minimap__edge', d: e.d, style: '--_lc: var(' + e.token + ')', 'data-planned': e.planned ? '' : null, 'data-active': e.active ? '' : null }, gContent);
      });
      m.nodes.forEach(function (n) {
        if (n.hidden) return;
        var w = Math.max(n.x1 - n.x0, 6), h = Math.max(n.y1 - n.y0, 6);
        svg('rect', { class: 'vk-minimap__node', x: r1(n.x0), y: r1(n.y0), width: r1(w), height: r1(h), 'data-selected': n.selected ? '' : null, 'data-hub': n.hub ? '' : null }, gContent);
      });
      place();
    }
    function place() {
      if (!box) return;
      var v = g.getView(), x = -v.x / v.k, y = -v.y / v.k, w = v.w / v.k, h = v.h / v.k;
      vp.setAttribute('x', r1(x)); vp.setAttribute('y', r1(y)); vp.setAttribute('width', r1(w)); vp.setAttribute('height', r1(h));
      cap.textContent = Math.round(v.k * 100) + '%';
    }
    function toContent(e) {
      var ctm = s.getScreenCTM(); if (!ctm) return null;
      var p = s.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
      return p.matrixTransform(ctm.inverse());
    }
    function viewCenter() { var v = g.getView(); return { x: (v.w / 2 - v.x) / v.k, y: (v.h / 2 - v.y) / v.k }; }

    var drag = null;
    function onDown(e) {
      if (e.button !== 0) return;
      var p = toContent(e); if (!p) return;
      var c = viewCenter();
      if (e.target === vp) drag = { id: e.pointerId, dx: c.x - p.x, dy: c.y - p.y };
      else { drag = { id: e.pointerId, dx: 0, dy: 0 }; g.centerOn(p.x, p.y); }
      el.dataset.dragging = '';
      try { el.setPointerCapture(e.pointerId); } catch (x) { /* synthetic */ }
      el.focus({ preventScroll: true });
      e.preventDefault();
    }
    function onMove(e) {
      if (!drag || drag.id !== e.pointerId) return;
      var p = toContent(e); if (p) g.centerOn(p.x + drag.dx, p.y + drag.dy);
    }
    function onUp(e) { if (drag && drag.id === e.pointerId) { drag = null; delete el.dataset.dragging; } }
    function onKey(e) {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      var v = g.getView(), step = Math.max(24, Math.min(v.w, v.h) * 0.15);
      var d = { ArrowRight: [-1, 0], ArrowLeft: [1, 0], ArrowDown: [0, -1], ArrowUp: [0, 1] }[e.key];
      if (d) { if (e.shiftKey) return; e.preventDefault(); g.panBy(d[0] * step, d[1] * step); return; }
      if (e.key === '+' || e.key === '=') { e.preventDefault(); g.zoomBy(1.25); }
      else if (e.key === '-' || e.key === '_') { e.preventDefault(); g.zoomBy(0.8); }
      else if (e.key === '0') { e.preventDefault(); g.fit(); live.textContent = 'Illesztve'; }
    }
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('keydown', onKey);
    var offs = [g.on('data', draw), g.on('layer', draw), g.on('select', draw), g.on('view', place)];
    draw();

    return {
      update: draw,
      destroy: function () {
        offs.forEach(function (f) { f(); });
        el.removeEventListener('pointerdown', onDown); el.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerup', onUp); el.removeEventListener('pointercancel', onUp); el.removeEventListener('keydown', onKey);
        el.textContent = ''; el.classList.remove('vk-minimap');
        ['role', 'aria-roledescription', 'aria-label', 'tabindex'].forEach(function (a) { el.removeAttribute(a); });
      }
    };
  }

  VK.minimap = { mount: mount };
})(typeof window !== 'undefined' ? window : globalThis);
