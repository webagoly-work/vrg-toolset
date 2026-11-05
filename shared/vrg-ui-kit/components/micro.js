/* VRG UI Kit — components/micro.js — helpers for the micrographics in micro.css.
     VK.micro.ruler(el, {from:0, to:100, major:5, minor:5, unit:'m'})       ticks + labels (decorative, aria-hidden)
     VK.micro.dots(el, {cols:24, rows:6, seed:'x', fill:.4})                 lit dot-matrix (decorative)
     VK.micro.meter(el, value 0…1, {label, warn:.75, crit:.9, text})       segmented bar, role=meter (content)
     VK.micro.chip(['01', 'MODUL-D9'], {tone})                              → <span class="vk-micro-chip">
     var c = VK.micro.callout(host, {target: Element | {x, y}, title, rows:[[k, v]], side:'right'|'left', tone})
       c.update({rows}) · c.setTarget(t) · c.destroy()                       card + leader line (content)
     VK.micro.beacon(host, {x, y, h, tone})                                 light column (decorative) → {el, destroy}
   Depends on: core.js. */
(function (root) {
  'use strict';
  var VK = root.VK = root.VK || {};
  if (VK.micro) return;
  var NS = 'http://www.w3.org/2000/svg';
  function S(tag, a, p) { var n = document.createElementNS(NS, tag); Object.keys(a || {}).forEach(function (k) { n.setAttribute(k, a[k]); }); if (p) p.appendChild(n); return n; }
  function fmt(v) { return String(Math.round(v * 100) / 100).replace('.', ','); }

  function ruler(el, o) {
    o = Object.assign({ from: 0, to: 100, major: 5, minor: 5, unit: '' }, o || {});
    el.classList.add('vk-micro-ruler'); el.setAttribute('aria-hidden', 'true'); el.textContent = '';
    el.style.setProperty('--_n', o.major); el.style.setProperty('--_m', o.minor);
    for (var k = 0; k <= o.major; k++) {
      var v = o.from + (o.to - o.from) * k / o.major;
      el.appendChild(VK.el('span.vk-micro-ruler__l', { style: 'left:' + (k / o.major * 100) + '%', text: fmt(v) + (k === o.major && o.unit ? ' ' + o.unit : '') }));
    }
    return el;
  }

  function dots(el, o) {
    o = Object.assign({ cols: 24, rows: 6, seed: 'dots', fill: 0.4, values: null }, o || {});
    var r = VK.rng(o.seed), gap = 6;
    el.classList.add('vk-micro-dots'); el.setAttribute('aria-hidden', 'true'); el.textContent = '';
    var svg = S('svg', { viewBox: '0 0 ' + o.cols * gap + ' ' + o.rows * gap, preserveAspectRatio: 'xMinYMin meet' }, el);
    for (var c = 0; c < o.cols; c++) for (var y = 0; y < o.rows; y++) {
      var v = o.values ? (o.values[y * o.cols + c] || 0) : (r() < o.fill * (0.6 + 0.8 * c / o.cols) ? 1 + Math.floor(r() * 3) : 0);
      S('circle', { cx: c * gap + gap / 2, cy: y * gap + gap / 2, r: v ? 1.6 : 1.1, 'class': 'vk-micro-dots__d', 'data-on': String(v) }, svg);
    }
    return el;
  }

  function meter(el, v, o) {
    o = o || {};
    v = VK.clamp(+v || 0, 0, 1);
    if (!el.classList.contains('vk-micro-meter')) {
      el.classList.add('vk-micro-meter');
      el.appendChild(VK.el('span.vk-micro-meter__label.vk-label'));
      el.appendChild(VK.el('span.vk-micro-meter__bar', { 'aria-hidden': 'true' }));
      el.appendChild(VK.el('span.vk-micro-meter__val', { 'aria-hidden': 'true' }));
      el.setAttribute('role', 'meter'); el.setAttribute('aria-valuemin', '0'); el.setAttribute('aria-valuemax', '100');
    }
    if (o.label != null) { el.querySelector('.vk-micro-meter__label').textContent = o.label; el.setAttribute('aria-label', o.label); }
    var pct = Math.round(v * 100), txt = o.text || pct + '%';
    el.style.setProperty('--vk-micro-v', String(v));
    el.setAttribute('aria-valuenow', String(pct)); el.setAttribute('aria-valuetext', txt);
    el.querySelector('.vk-micro-meter__val').textContent = txt;
    var crit = o.crit == null ? 0.9 : o.crit, warn = o.warn == null ? 0.75 : o.warn;
    if (v >= crit) el.dataset.level = 'crit'; else if (v >= warn) el.dataset.level = 'warn'; else delete el.dataset.level;
    return el;
  }

  function chip(parts, o) {
    o = o || {}; parts = Array.isArray(parts) ? parts : [parts];
    var c = VK.el('span.vk-micro-chip', o.tone ? { 'data-tone': o.tone } : null);
    parts.forEach(function (p, i) { c.appendChild(VK.el('span', { text: i === 0 && parts.length > 1 ? '[' + p + ']' : p })); });
    return c;
  }

  function callout(host, o) {
    o = Object.assign({ side: 'right', dx: 56, dy: 44, rows: [], tone: null }, o || {});
    host.classList.add('vk-micro-host');
    var card = VK.el('div.vk-micro-callout', { role: 'group', 'aria-label': o.title || 'Infó', 'data-tone': o.tone || null });
    var svg = S('svg', { 'class': 'vk-micro-leader', 'aria-hidden': 'true', focusable: 'false' });
    if (o.tone) svg.setAttribute('data-tone', o.tone);
    var line = S('polyline', { 'class': 'vk-micro-leader__line' }, svg);
    var ring = S('circle', { r: 7, 'class': 'vk-micro-leader__ring' }, svg);
    var dot = S('circle', { r: 2.2, 'class': 'vk-micro-leader__dot' }, svg);
    host.appendChild(svg); host.appendChild(card);
    function fill() {
      card.textContent = '';
      if (o.title) card.appendChild(VK.el('p.vk-micro-callout__t.vk-label', { text: o.title }));
      var dl = VK.el('dl.vk-micro-callout__rows');
      (o.rows || []).forEach(function (r) { dl.appendChild(VK.el('dt', { text: r[0] })); dl.appendChild(VK.el('dd', { text: r[1] })); });
      card.appendChild(dl);
      card.setAttribute('aria-label', [o.title].concat((o.rows || []).map(function (r) { return r[0] + ' ' + r[1]; })).filter(Boolean).join(' · '));
    }
    function point() {
      var t = o.target;
      if (t && t.getBoundingClientRect) { var a = t.getBoundingClientRect(), h = host.getBoundingClientRect(); return { x: a.left + a.width / 2 - h.left, y: a.top + a.height / 2 - h.top }; }
      if (t && typeof t.x === 'string') return { x: parseFloat(t.x) / 100 * host.clientWidth, y: parseFloat(t.y) / 100 * host.clientHeight };
      return t ? { x: t.x, y: t.y } : { x: 0, y: 0 };
    }
    function place() {
      var p = point(), W = host.clientWidth, H = host.clientHeight, cw = card.offsetWidth, ch = card.offsetHeight;
      var side = o.side;
      var ex = side === 'right' ? p.x + o.dx : p.x - o.dx;
      if (side === 'right' && ex + cw > W - 4 && p.x - o.dx - cw >= 4) { side = 'left'; ex = p.x - o.dx; }
      else if (side === 'left' && ex - cw < 4 && p.x + o.dx + cw <= W - 4) { side = 'right'; ex = p.x + o.dx; }
      var ey = p.y - o.dy; if (ey - ch / 2 < 4) ey = p.y + o.dy;
      var top = VK.clamp(ey - ch / 2, 4, Math.max(4, H - ch - 4));
      var left = side === 'right' ? ex : ex - cw; left = VK.clamp(left, 4, Math.max(4, W - cw - 4));
      card.style.left = left + 'px'; card.style.top = top + 'px';
      var elbowY = VK.clamp(ey, top + 6, top + ch - 6), kx = side === 'right' ? p.x + Math.abs(elbowY - p.y) : p.x - Math.abs(elbowY - p.y);
      var cx = side === 'right' ? left : left + cw;
      if ((side === 'right' && kx > cx) || (side === 'left' && kx < cx)) kx = cx;
      line.setAttribute('points', [p.x, p.y, kx, elbowY, cx, elbowY].join(' '));
      ring.setAttribute('cx', p.x); ring.setAttribute('cy', p.y); dot.setAttribute('cx', p.x); dot.setAttribute('cy', p.y);
      card.dataset.side = side;
    }
    fill(); place();
    var ro = root.ResizeObserver ? new ResizeObserver(place) : null; if (ro) ro.observe(host);
    return {
      el: card,
      update: function (p) { Object.assign(o, p || {}); fill(); place(); },
      setTarget: function (t) { o.target = t; place(); },
      place: place,
      destroy: function () { if (ro) ro.disconnect(); card.remove(); svg.remove(); }
    };
  }

  function beacon(host, o) {
    o = Object.assign({ x: '50%', y: '80%', h: 90 }, o || {});
    host.classList.add('vk-micro-host');
    var css = '--vk-micro-x:' + o.x + ';--vk-micro-y:' + o.y + ';--vk-micro-h:' + (typeof o.h === 'number' ? o.h + 'px' : o.h);
    var foot = VK.el('span.vk-micro-beacon__foot', { 'aria-hidden': 'true', style: css });
    var col = VK.el('span.vk-micro-beacon', { 'aria-hidden': 'true', style: css, 'data-tone': o.tone || null });
    host.appendChild(foot); host.appendChild(col);
    return { el: col, destroy: function () { foot.remove(); col.remove(); } };
  }

  VK.micro = { ruler: ruler, dots: dots, meter: meter, chip: chip, callout: callout, beacon: beacon };
})(typeof window !== 'undefined' ? window : globalThis);
