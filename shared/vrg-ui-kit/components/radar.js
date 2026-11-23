/* VRG UI Kit — components/radar.js — the universal locator / proximity / connection radar (WP M66, D-173).
     var r = VK.radar.mount(el, {label, mode:'heading-up'|'north-up', hidden:[layerIds], sweeps:{id:bearing}})
       → { update(frame), select(id), setHidden(ids), setMode(m), layout(), destroy(), on(type, fn) }
     VK.radar.layout(frame, {hidden, sweeps}) → { rangeM, rings:[[m, r]], placed:[…], rotationDeg }   (pure, no DOM)
   A frame is the shared contract (docs/radar/README.md): {layers:[{id,title,glyph,tone,feature}], blips:[{id, layer,
   label, distanceM, bearingDeg, bearingSrc, trend, ageMs, linked, mine, alert, detail, place:{lat,lon}}], headingDeg,
   here:{lat,lon}, mode, rangeM}. Any program feeds it: VRG Mobile's sources (tags, paired devices, the Csipogó crew,
   the Óra), and on the Desktop whatever has a distance or a place.
   The layout is the same algorithm as VRG Mobile's kit-core Radar.kt, proven by test/fixtures/radar-layout.json
   (test/radar.js here, RadarTest there): log-scale rings, compass bearings rotated by the heading in heading-up
   mode, GPS bearings from places, sweep bearings by id, blips without a direction hollow on their ring at an
   FNV-1a angle pushed 9° at a time until 0.085 apart.
   Keyboard (one tab stop): ←/→ previous / next blip (nearest first) · Enter opens it ("open" event) · Esc clears.
   Events: select {id, blip}, open {id, blip, layer}, layers {hidden}. Legend chips toggle layers (aria-pressed).
   Depends on: core.js. Tones map onto --vk-layer-* in radar.css; "you" is the ice accent, the sweep warm. */
(function (root) {
  'use strict';
  var VK = root.VK = root.VK || {};
  if (VK.radar) return;

  var MAX_R = 0.9, UNKNOWN_R = 0.95, MIN_R = 0.04, MIN_SEP = 0.085, STEP_DEG = 9;
  var RANGES = [5, 10, 30, 100, 300], RING_STEPS = [1, 3, 10, 30, 100];
  var DIR_HU = { none: 'irány nélkül', gps: 'GPS', sweep: 'irány keresése', source: 'a forrás adja' };
  var REL = ['elöl', 'jobbra elöl', 'jobbra', 'jobbra hátul', 'hátul', 'balra hátul', 'balra', 'balra elöl'];
  var COMPASS = ['É', 'ÉK', 'K', 'DK', 'D', 'DNy', 'Ny', 'ÉNy'];

  function norm(d) { var x = d % 360; return x < 0 ? x + 360 : x; }
  function rad(d) { return d * Math.PI / 180; }

  function radius(d, range) {
    if (d == null) return UNKNOWN_R;
    var r = 0.86 * Math.log(1 + Math.max(0, d)) / Math.log(1 + range);
    return Math.min(MAX_R, Math.max(MIN_R, r));
  }
  function autoRange(ds) {
    if (!ds.length) return 10;
    var far = Math.max.apply(null, ds);
    for (var i = 0; i < RANGES.length; i++) if (RANGES[i] >= far * 1.15) return RANGES[i];
    return RANGES[RANGES.length - 1];
  }
  function rings(range) {
    return RING_STEPS.filter(function (m) { return m < range * 0.95; }).concat([range]).map(function (m) { return [m, radius(m, range)]; });
  }
  function utf8(s) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s);
    var out = [], e = unescape(encodeURIComponent(s));
    for (var i = 0; i < e.length; i++) out.push(e.charCodeAt(i));
    return out;
  }
  function fnv1a(s) {
    var h = 0x811c9dc5, b = utf8(String(s));
    for (var i = 0; i < b.length; i++) { h ^= b[i]; h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  function alpha(age) {
    age = age || 0;
    if (age <= 5000) return 1;
    if (age >= 60000) return 0.35;
    return 1 - 0.65 * (age - 5000) / 55000;
  }
  var R = 6371008.8;
  function geoBearing(a, b) {
    var p1 = rad(a.lat), p2 = rad(b.lat), dl = rad(b.lon - a.lon);
    var y = Math.sin(dl) * Math.cos(p2), x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
    return norm(Math.atan2(y, x) * 180 / Math.PI);
  }
  function geoDistance(a, b) {
    var dp = rad(b.lat - a.lat), dl = rad(b.lon - a.lon);
    var h = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dl / 2) * Math.sin(dl / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  function byId(a, b) { return a.b.id < b.b.id ? -1 : a.b.id > b.b.id ? 1 : 0; }

  /** The shared layout (Radar.layout in kit-core). Ids compare by UTF-16 code units, as Kotlin's String.compareTo. */
  function layout(frame, opts) {
    opts = opts || {};
    var hidden = opts.hidden || [], sweeps = opts.sweeps || {}, here = frame.here || null;
    var pre = (frame.blips || []).filter(function (b) { return hidden.indexOf(b.layer) < 0; }).map(function (b) {
      var dist = b.distanceM == null ? null : b.distanceM;
      var bearing = b.bearingDeg == null ? null : norm(b.bearingDeg);
      var src = bearing != null ? (b.bearingSrc && b.bearingSrc !== 'none' ? b.bearingSrc : 'source') : 'none';
      if (b.place && here) {
        if (bearing == null) { bearing = geoBearing(here, b.place); src = 'gps'; }
        if (dist == null) dist = geoDistance(here, b.place);
      }
      if (bearing == null && sweeps[b.id] != null) { bearing = norm(sweeps[b.id]); src = 'sweep'; }
      return { b: b, dist: dist, bearing: bearing, src: src };
    });
    // the range follows the nearby things (no place); a far place sits on the edge at its true bearing
    var near = pre.filter(function (p) { return p.dist != null && !p.b.place; });
    if (!near.length) near = pre.filter(function (p) { return p.dist != null; });
    var range = frame.rangeM != null ? frame.rangeM : autoRange(near.map(function (p) { return p.dist; }));
    var mode = frame.mode || 'heading-up';
    var rot = mode === 'heading-up' && frame.headingDeg != null ? norm(frame.headingDeg) : 0;
    var placed = [];
    function at(p, a, r) {
      return { blip: p.b, x: r * Math.sin(rad(a)), y: -r * Math.cos(rad(a)), r: r, angleDeg: a, bearingDeg: p.bearing,
        bearingSrc: p.src, distanceM: p.dist, alpha: alpha(p.b.ageMs) };
    }
    pre.filter(function (p) { return p.bearing != null; }).sort(byId).forEach(function (p) {
      placed.push(at(p, norm(p.bearing - rot), radius(p.dist, range)));
    });
    pre.filter(function (p) { return p.bearing == null; }).sort(byId).forEach(function (p) {
      var r = radius(p.dist, range), start = (fnv1a(p.b.id) % 3600) / 10, chosen = start;
      for (var k = 0; k < 40; k++) {
        var a = norm(start + k * STEP_DEG), x = r * Math.sin(rad(a)), y = -r * Math.cos(rad(a));
        var free = placed.every(function (q) { return (q.x - x) * (q.x - x) + (q.y - y) * (q.y - y) >= MIN_SEP * MIN_SEP; });
        if (free) { chosen = a; break; }
      }
      placed.push(at(p, chosen, r));
    });
    return { rangeM: range, rings: rings(range), placed: placed, rotationDeg: rot };
  }

  function octant(d) { return Math.floor((norm(d) + 22.5) / 45) % 8; }
  function distText(m) {
    if (m == null) return 'távolság ismeretlen';
    if (m < 1.5) return '~1 m';
    if (m < 10) return '~' + Math.floor(m) + ' m';
    if (m < 40) return '~' + Math.floor(m / 5) * 5 + ' m';
    if (m < 1000) return '~' + Math.floor(m / 10) * 10 + ' m';
    return (m / 1000).toFixed(1).replace('.', ',') + ' km';
  }
  function ringText(m) { return m >= 1000 ? Math.floor(m / 1000) + ' km' : Math.floor(m) + ' m'; }
  function describe(p) {
    var parts = [p.blip.label, distText(p.distanceM)];
    if (p.bearingSrc !== 'none') parts.push(REL[octant(p.angleDeg)] + ' (' + COMPASS[octant(p.bearingDeg)] + ', ' + DIR_HU[p.bearingSrc] + ')');
    else parts.push('irány nélkül');
    if (p.blip.detail) parts.push(p.blip.detail);
    return parts.join(' · ');
  }

  // ---- the SVG renderer ----------------------------------------------------------------------------------
  var NS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) if (attrs[k] != null && attrs[k] !== false) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function f3(v) { return Math.round(v * 1000) / 1000; }

  function mount(el, opts) {
    opts = opts || {};
    var ev = VK.emitter();
    var frame = { layers: [], blips: [] }, hidden = (opts.hidden || []).slice(), sweeps = opts.sweeps || {};
    var mode = opts.mode || 'heading-up', selected = null, last = null;
    el.classList.add('vk-radar');
    el.textContent = '';
    var scope = VK.el('div.vk-radar__scope');
    var s = svg('svg', { class: 'vk-radar__svg', viewBox: '-1.12 -1.12 2.24 2.24', role: 'application', tabindex: '0',
      'aria-roledescription': 'radar', 'aria-label': opts.label || 'Radar: a nyilak lépnek a pontok között, az Enter megnyitja' }, scope);
    var gGrid = svg('g', { class: 'vk-radar__grid' }, s);
    var gSweep = svg('g', { class: 'vk-radar__sweep', 'aria-hidden': 'true' }, s);
    svg('path', { class: 'vk-radar__wedge', d: 'M0 0 L0 -1 A1 1 0 0 1 0.5 -0.866 Z' }, gSweep);
    svg('line', { class: 'vk-radar__beam', x1: 0, y1: 0, x2: 0, y2: -1 }, gSweep);
    var gBlips = svg('g', { class: 'vk-radar__blips' }, s);
    svg('circle', { class: 'vk-radar__you', cx: 0, cy: 0, r: 0.03 }, s);
    var cap = VK.el('div.vk-radar__cap.vk-label');
    var legend = VK.el('div.vk-radar__legend', { role: 'group', 'aria-label': 'Rétegek' });
    var live = VK.el('div.vk-sr-only', { role: 'status', 'aria-live': 'polite' });
    var card = VK.el('div.vk-radar__card.vk-num', { 'aria-hidden': 'true' });
    el.appendChild(scope); el.appendChild(cap); el.appendChild(card); el.appendChild(legend); el.appendChild(live);
    if (VK.reducedMotion()) el.setAttribute('data-still', '');

    function drawGrid(lay) {
      gGrid.textContent = '';
      svg('circle', { class: 'vk-radar__edge', cx: 0, cy: 0, r: 1 }, gGrid);
      lay.rings.forEach(function (rg) {
        svg('circle', { class: 'vk-radar__ring', cx: 0, cy: 0, r: f3(rg[1]) }, gGrid);
        // ring labels on the lower-left diagonal, where they least often meet a blip
        var t = svg('text', { class: 'vk-radar__ringlabel', x: f3(-0.707 * rg[1] - 0.012), y: f3(0.707 * rg[1] - 0.012), 'text-anchor': 'end' }, gGrid);
        t.textContent = ringText(rg[0]);
      });
      svg('circle', { class: 'vk-radar__ring vk-radar__ring--unknown', cx: 0, cy: 0, r: UNKNOWN_R }, gGrid);
      svg('line', { class: 'vk-radar__axis', x1: -1, y1: 0, x2: 1, y2: 0 }, gGrid);
      svg('line', { class: 'vk-radar__axis', x1: 0, y1: -1, x2: 0, y2: 1 }, gGrid);
      // north: where 0° lies after the heading rotation
      var na = rad(norm(-lay.rotationDeg));
      var n = svg('text', { class: 'vk-radar__north', x: f3(1.06 * Math.sin(na)), y: f3(-1.06 * Math.cos(na) + 0.025) }, gGrid);
      n.textContent = 'É';
    }

    function drawBlips(lay) {
      gBlips.textContent = '';
      var tones = {};
      (frame.layers || []).forEach(function (l) { tones[l.id] = l; });
      lay.placed.forEach(function (p) {
        var b = p.blip, l = tones[b.layer] || { tone: 'muted', glyph: '•' };
        var g = svg('g', { class: 'vk-radar__blip', 'data-id': b.id, 'data-tone': (l.tone || 'muted').toLowerCase(),
          'data-dir': p.bearingSrc, 'data-mine': b.mine ? '' : null, 'data-alert': b.alert ? '' : null,
          'data-linked': b.linked ? '' : null, 'data-selected': selected === b.id ? '' : null,
          transform: 'translate(' + f3(p.x) + ' ' + f3(p.y) + ')', opacity: f3(p.alpha) }, gBlips);
        if (b.alert) svg('circle', { class: 'vk-radar__pulse', r: 0.06 }, g);
        if (b.mine) svg('circle', { class: 'vk-radar__mine', r: 0.05 }, g);
        svg('circle', { class: 'vk-radar__dot', r: 0.032 }, g);
        if (b.trend) {
          // a chevron pointing toward the centre (closer) or away from it
          var a = Math.atan2(-p.y, -p.x) + (b.trend > 0 ? 0 : Math.PI), c = Math.cos(a), sn = Math.sin(a);
          var tip = [0.07 * c, 0.07 * sn], l1 = [0.045 * c - 0.02 * sn, 0.045 * sn + 0.02 * c], l2 = [0.045 * c + 0.02 * sn, 0.045 * sn - 0.02 * c];
          svg('path', { class: 'vk-radar__trend', d: 'M' + f3(l1[0]) + ' ' + f3(l1[1]) + ' L' + f3(tip[0]) + ' ' + f3(tip[1]) + ' L' + f3(l2[0]) + ' ' + f3(l2[1]) }, g);
        }
        // a label right of its dot, or left of it when its end would leave the circle (mono: ~0.029 per character)
        var text = (l.glyph ? l.glyph + ' ' : '') + b.label, w = 0.05 + 0.029 * text.length;
        var flip = (p.x + w) * (p.x + w) + p.y * p.y > 1.0 && (p.x - w) * (p.x - w) + p.y * p.y <= (p.x + w) * (p.x + w) + p.y * p.y;
        var t = svg('text', { class: 'vk-radar__label', x: flip ? -0.05 : 0.05, y: 0.018, 'text-anchor': flip ? 'end' : 'start' }, g);
        t.textContent = text;
        var ti = svg('title', null, g); ti.textContent = describe(p);
      });
    }

    function drawLegend() {
      legend.textContent = '';
      var counts = {};
      (frame.blips || []).forEach(function (b) { counts[b.layer] = (counts[b.layer] || 0) + 1; });
      (frame.layers || []).forEach(function (l) {
        var on = hidden.indexOf(l.id) < 0;
        var btn = VK.el('button.vk-radar__layer', { type: 'button', 'aria-pressed': on ? 'true' : 'false',
          'data-tone': (l.tone || 'muted').toLowerCase(), onclick: function () { toggle(l.id); } });
        btn.appendChild(VK.el('span.vk-radar__swatch', { 'aria-hidden': 'true' }));
        btn.appendChild(document.createTextNode((l.glyph ? l.glyph + ' ' : '') + l.title + ' ' + (counts[l.id] || 0)));
        legend.appendChild(btn);
      });
    }

    function toggle(id) {
      var i = hidden.indexOf(id);
      if (i < 0) hidden.push(id); else hidden.splice(i, 1);
      render(); ev.emit('layers', { hidden: hidden.slice() });
    }

    function showCard() {
      var p = last && last.placed.filter(function (q) { return q.blip.id === selected; })[0];
      card.textContent = p ? describe(p) : '';
      card.hidden = !p;
      live.textContent = p ? describe(p) : '';
    }

    function render() {
      var f = Object.assign({}, frame, { mode: mode });
      last = layout(f, { hidden: hidden, sweeps: sweeps });
      drawGrid(last); drawBlips(last); drawLegend(); showCard();
      var dirless = last.placed.filter(function (p) { return p.bearingSrc === 'none'; }).length;
      cap.textContent = (mode === 'heading-up' && frame.headingDeg != null ? 'IRÁNY FEL' : 'ÉSZAK FEL') + ' // ' +
        ringText(last.rangeM) + ' // ' + last.placed.length + ' PONT' + (dirless ? ' (' + dirless + ' IRÁNY NÉLKÜL)' : '');
    }

    function select(id) {
      selected = id;
      gBlips.querySelectorAll('.vk-radar__blip').forEach(function (g) {
        if (g.getAttribute('data-id') === id) g.setAttribute('data-selected', ''); else g.removeAttribute('data-selected');
      });
      showCard();
      var p = last && last.placed.filter(function (q) { return q.blip.id === id; })[0];
      ev.emit('select', { id: id, blip: p ? p.blip : null });
    }

    function order() { return (last ? last.placed : []).slice().sort(function (a, b) { return a.r - b.r; }); }

    s.addEventListener('click', function (e) {
      var g = e.target.closest && e.target.closest('.vk-radar__blip');
      if (g) select(g.getAttribute('data-id')); else select(null);
    });
    s.addEventListener('dblclick', function (e) {
      var g = e.target.closest && e.target.closest('.vk-radar__blip');
      if (g) open(g.getAttribute('data-id'));
    });
    s.addEventListener('keydown', function (e) {
      var o = order(); if (!o.length) return;
      var i = o.map(function (p) { return p.blip.id; }).indexOf(selected);
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { select(o[(i + 1) % o.length].blip.id); e.preventDefault(); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { select(o[(i - 1 + o.length) % o.length].blip.id); e.preventDefault(); }
      else if (e.key === 'Enter' && selected) { open(selected); e.preventDefault(); }
      else if (e.key === 'Escape') { select(null); }
    });
    function open(id) {
      var p = last && last.placed.filter(function (q) { return q.blip.id === id; })[0];
      if (!p) return;
      var l = (frame.layers || []).filter(function (x) { return x.id === p.blip.layer; })[0] || null;
      ev.emit('open', { id: id, blip: p.blip, layer: l });
    }

    render();
    return {
      update: function (f) { frame = f || { layers: [], blips: [] }; if (frame.mode) mode = frame.mode; render(); },
      select: select,
      setHidden: function (ids) { hidden = (ids || []).slice(); render(); },
      setMode: function (m) { mode = m === 'north-up' ? 'north-up' : 'heading-up'; render(); },
      setSweeps: function (m) { sweeps = m || {}; render(); },
      layout: function () { return last; },
      on: ev.on,
      destroy: function () { el.textContent = ''; el.classList.remove('vk-radar'); }
    };
  }

  VK.radar = {
    mount: mount, layout: layout, radius: radius, autoRange: autoRange, rings: rings, fnv1a: fnv1a, alpha: alpha,
    norm: norm, geo: { bearing: geoBearing, distance: geoDistance }, describe: describe,
    text: { distance: distText, ring: ringText, relative: function (a) { return REL[octant(a)]; }, compass: function (b) { return COMPASS[octant(b)]; } },
    constants: { MAX_R: MAX_R, UNKNOWN_R: UNKNOWN_R, MIN_R: MIN_R, MIN_SEP: MIN_SEP, STEP_DEG: STEP_DEG }
  };
})(typeof window !== 'undefined' ? window : globalThis);
