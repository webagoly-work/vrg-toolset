/* VRG UI Kit — components/emblem.js — the PROGRAM LARGE LOGO: an isometric diorama on a plinth.
     var e = VK.emblem.render(el, {kind:'planner', name:'Planner', kicker:'VRG ESZKÖZTÁR', glyph:'floorplan',
                                   date:'2026-11-04', readout:'v1.1 · 48 modul', seed:'planner', size:'hero',
                                   activity:.45, level:0})
     e.update({readout:'v1.2 · 52 modul'}) · e.destroy()
   kind: planner · mindmap · inventory · calculator · city · hub (anything else = an empty plinth).
   size: hero (~420 px, full stack) · tile (~160 px, launcher tiles) · mini (48 px, plinth only, role=img).
   The scene is SVG drawn with CSS classes only (emblem.css), so a theme switch restyles it live. The
   day/night phase (pale airy day diorama vs night with warm lit windows) is chosen from the luminance of
   --vk-bg at render time and re-checked on the document's 'vk:theme' event (works with a scoped
   data-vk-theme container too). activity 0…1 = share of lit windows at night (= the system working).
   level: 1…6 renders the name as a heading of that level (default: a paragraph).
   Depends on: core.js. Icons: the glyph you pass. */
(function (root) {
  'use strict';
  var VK = root.VK = root.VK || {};
  if (VK.emblem) return;

  var NS = 'http://www.w3.org/2000/svg';
  var N = 10, A = 10, CX = 120, CY = 74, T = 14, VB_W = 240, VB_H = 206;
  var KINDS = ['planner', 'mindmap', 'inventory', 'calculator', 'city', 'hub'];
  var live = [];      // rendered emblems that follow the theme
  var listening = false;

  // ---------- geometry ----------
  function P(i, j, z) { return [CX + (i - j) * A, CY + (i + j) * A / 2 - (z || 0)]; }
  function pts(arr) { return arr.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' '); }
  function S(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { if (attrs[k] !== undefined && attrs[k] !== null) n.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(n);
    return n;
  }
  function poly(parent, points, cls) { return S('polygon', { points: pts(points), 'class': cls }, parent); }
  function hull(p) {   // monotone chain convex hull of [x,y] points
    p = p.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    function cross(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
    var lo = [], up = [], i;
    for (i = 0; i < p.length; i++) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p[i]) <= 0) lo.pop(); lo.push(p[i]); }
    for (i = p.length - 1; i >= 0; i--) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p[i]) <= 0) up.pop(); up.push(p[i]); }
    lo.pop(); up.pop(); return lo.concat(up);
  }

  // ---------- colour phase (day / night) from the ground's luminance ----------
  var cvs = null;
  function lum(v) {
    if (!cvs) cvs = document.createElement('canvas').getContext('2d');
    cvs.fillStyle = 'transparent';
    try { cvs.fillStyle = v; } catch (e) { return 0; }
    var s = String(cvs.fillStyle), r, g, b;
    if (s.charAt(0) === '#') { r = parseInt(s.substr(1, 2), 16); g = parseInt(s.substr(3, 2), 16); b = parseInt(s.substr(5, 2), 16); }
    else { var m = s.match(/[\d.]+/g) || [0, 0, 0]; r = +m[0]; g = +m[1]; b = +m[2]; }
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  }
  function phaseOf(el) { return lum(VK.token('--vk-bg', el) || VK.token('--vk-bg')) > 0.5 ? 'day' : 'night'; }
  function onTheme() {
    live = live.filter(function (x) { return x.el.isConnected; });
    live.forEach(function (x) { x.el.dataset.phase = phaseOf(x.el); });
  }

  // ---------- scene recipes: each returns {boxes, cables, streets, rings} in grid units ----------
  // box: {i, j, w, d, h, z0, type: block|cabinet|tower|key|slab|wall|shelf|crate|display, layer, hot}
  function box(i, j, w, d, h, type, extra) {
    var b = { i: i, j: j, w: w, d: d, h: h, z0: 0, type: type || 'block', layer: 1 };
    if (extra) Object.keys(extra).forEach(function (k) { b[k] = extra[k]; });
    return b;
  }
  function tower(i, j, h) { return box(i, j, 0.6, 0.6, h, 'tower'); }

  var RECIPES = {
    city: function (r) {
      var out = { boxes: [], cables: [], streets: [], rings: [] }, best = null;
      for (var i = 0; i < N; i++) for (var j = 0; j < N; j++) {
        if (i % 4 === 3 || j % 4 === 3) continue;                       // streets
        var d = Math.hypot(i + 0.5 - 5, j + 0.5 - 5);
        if (r() < d / 9 - 0.05) continue;                                // thinning outward
        var h = 5 + 50 * Math.exp(-Math.pow(d / 3.1, 2)) * (0.45 + 0.55 * r()) + r() * 4;
        var b = box(i + 0.12, j + 0.12, 0.76, 0.76, h, 'block');
        out.boxes.push(b);
        if (!best || h > best.h) best = b;
      }
      if (best) { best.type = 'tower-block'; best.h = Math.max(best.h, 52); best.antenna = 14; }
      [3.5, 7.5].forEach(function (k) { out.streets.push([[k, 0.2], [k, N - 0.2]]); out.streets.push([[0.2, k], [N - 0.2, k]]); });
      return out;
    },
    planner: function (r) {
      var out = { boxes: [], cables: [], streets: [], rings: [] };
      var sw = 5 + Math.floor(r() * 2), sd = 4 + Math.floor(r() * 2);
      out.boxes.push(box(0.8, 0.8, sw, sd, 2, 'slab', { layer: 0 }));
      var split = 0.8 + 1.8 + r() * (sw - 3.2);                          // a partition along j
      out.boxes.push(box(split, 0.8, 0.14, sd * (0.45 + r() * 0.3), 7, 'wall', { z0: 2 }));
      var splitJ = 0.8 + 1.5 + r() * (sd - 2.6);
      out.boxes.push(box(0.8, splitJ, split - 0.8, 0.14, 7, 'wall', { z0: 2 }));
      out.boxes.push(box(0.8, 0.8, 0.14, sd, 9, 'wall', { z0: 2 }));
      out.boxes.push(box(0.8, 0.8, sw, 0.14, 9, 'wall', { z0: 2 }));
      var nc = 3 + Math.floor(r() * 2);
      for (var k = 0; k < nc; k++) out.boxes.push(box(7.5, 0.9 + k * 1.05, 0.9, 0.9, 15 + r() * 6, 'cabinet'));
      var cy = 0.9 + nc * 1.05 + 0.5;
      out.cables.push([[7.95, cy - 0.5], [7.95, 7.6], [2.6, 7.6], [2.6, sd + 1.2]]);
      out.boxes.push(box(2.3, sd + 0.9, 0.6, 0.35, 2.2, 'socket'));
      out.boxes.push(tower(0.5, 8.6, 46 + r() * 10));
      out.boxes.push(box(4.6, 8.4, 1.4, 0.9, 5, 'block'));
      return out;
    },
    mindmap: function (r) {
      var out = { boxes: [], cables: [], streets: [], rings: [] };
      out.boxes.push(box(4, 4, 2, 2, 26 + r() * 8, 'block', { antenna: 8 }));
      var n = 5 + Math.floor(r() * 3), a0 = r() * Math.PI * 2;
      for (var k = 0; k < n; k++) {
        var a = a0 + k / n * Math.PI * 2 + (r() - 0.5) * 0.4, rad = 3.1 + r() * 0.9;
        var ci = Math.max(0.4, Math.min(8.6, 5 + Math.cos(a) * rad - 0.5)), cj = Math.max(0.4, Math.min(8.6, 5 + Math.sin(a) * rad - 0.5));
        out.boxes.push(box(ci, cj, 1, 1, 7 + r() * 10, 'block'));
        var mi = ci + 0.5, mj = cj + 0.5;                                  // metro wire: along i then j
        out.cables.push([[5, 5], [mi, 5], [mi, mj]]);
      }
      out.rings.push([5, 5]);
      return out;
    },
    inventory: function (r) {
      var out = { boxes: [], cables: [], streets: [], rings: [] };
      [1.2, 3.4, 5.6].forEach(function (j) {
        out.boxes.push(box(0.9, j, 5.6, 0.8, 4, 'shelf'));
        for (var x = 1.0; x < 6.3; x += 0.9) if (r() < 0.75) out.boxes.push(box(x, j + 0.05, 0.75, 0.7, 1.5 + r() * 3.5, 'crate', { z0: 4, hot: r() < 0.18 }));
      });
      out.boxes.push(box(7.5, 0.8, 1.4, 6, 20 + r() * 6, 'block'));
      out.boxes.push(tower(0.5, 8.7, 40 + r() * 10));
      out.cables.push([[7.0, 7.4], [8.2, 7.4], [8.2, 8.9]]);
      out.boxes.push(box(3.0, 7.6, 1.1, 0.8, 2.6, 'block'));
      return out;
    },
    calculator: function (r) {
      var out = { boxes: [], cables: [], streets: [], rings: [] };
      out.boxes.push(box(1.2, 1.0, 5.1, 1.2, 13, 'display'));
      var hot = Math.floor(r() * 16);
      for (var row = 0; row < 4; row++) for (var c = 0; c < 4; c++) {
        out.boxes.push(box(1.35 + c * 1.27, 3.0 + row * 1.27, 0.95, 0.95, 2 + (row * 4 + c === hot ? 1.2 : 0), 'key', { hot: row * 4 + c === hot }));
      }
      out.cables.push([[6.4, 1.6], [7.9, 1.6], [7.9, 8.9]]);
      out.boxes.push(tower(8.8, 0.4, 44 + r() * 8));
      out.boxes.push(box(7.2, 4.0, 1.3, 1.3, 9, 'cabinet'));
      return out;
    },
    hub: function (r) {
      var out = { boxes: [], cables: [], streets: [], rings: [] };
      out.boxes.push(box(4, 4, 2, 2, 8, 'block'));
      out.boxes.push(box(4.7, 4.7, 0.6, 0.6, 30 + r() * 8, 'tower', { z0: 8 }));
      [[1, 1], [8, 1], [1, 8], [8, 8]].forEach(function (c, k) {
        out.boxes.push(box(c[0], c[1], 1, 1, 9 + r() * 9, k === 3 ? 'block' : 'cabinet'));
        out.cables.push([[5, 5], [c[0] + 0.5, 5], [c[0] + 0.5, c[1] + 0.5]]);
      });
      out.rings.push([5, 5]);
      return out;
    }
  };

  // ---------- drawing ----------
  function drawBox(g, b, r, act, detail) {
    var i = b.i, j = b.j, w = b.w, d = b.d, z0 = b.z0, z1 = b.z0 + b.h, I = i + w, J = j + d;
    var grp = S('g', { 'class': 'vk-emblem__box', 'data-type': b.type }, g);
    poly(grp, [P(I, j, z0), P(I, J, z0), P(I, J, z1), P(I, j, z1)], 'vk-emblem__f-r');
    poly(grp, [P(i, J, z0), P(I, J, z0), P(I, J, z1), P(i, J, z1)], 'vk-emblem__f-l');
    poly(grp, [P(i, j, z1), P(I, j, z1), P(I, J, z1), P(i, J, z1)], 'vk-emblem__f-t' + (b.hot ? ' vk-emblem__hot' : ''));
    if (!detail) return;
    var t = b.type;
    if (t === 'block' || t === 'tower-block') {
      // window rows on both visible faces
      for (var z = z0 + 3; z + 2.2 < z1 - 1; z += 4.5) {
        for (var u = i + 0.14; u + 0.22 < I; u += 0.4) win(grp, [P(u, J, z), P(u + 0.22, J, z), P(u + 0.22, J, z + 2.2), P(u, J, z + 2.2)], r() < act);
        for (var v = j + 0.14; v + 0.22 < J; v += 0.4) win(grp, [P(I, v, z), P(I, v + 0.22, z), P(I, v + 0.22, z + 2.2), P(I, v, z + 2.2)], r() < act);
      }
    } else if (t === 'cabinet') {
      var mid = i + w / 2;
      S('polyline', { points: pts([P(mid, J, z0 + 1), P(mid, J, z1 - 1)]), 'class': 'vk-emblem__seam' }, grp);
      for (var k = 0; k < 3; k++) { var zz = z1 - 3 - k * 2.2; win(grp, [P(i + 0.12, J, zz), P(i + 0.3, J, zz), P(i + 0.3, J, zz + 1.1), P(i + 0.12, J, zz + 1.1)], r() < act + 0.2, 'led'); }
      for (var q = 0; q < 3; q++) { var zq = z0 + 2 + q * 2; S('polyline', { points: pts([P(I, j + 0.15, zq), P(I, J - 0.15, zq)]), 'class': 'vk-emblem__seam' }, grp); }
    } else if (t === 'display') {
      win(grp, [P(i + 0.3, J, z1 - 9), P(I - 0.3, J, z1 - 9), P(I - 0.3, J, z1 - 3), P(i + 0.3, J, z1 - 3)], true, 'screen');
    } else if (t === 'shelf') {
      for (var s = i + 0.6; s < I; s += 1.4) S('polyline', { points: pts([P(s, J, z0), P(s, J, z1)]), 'class': 'vk-emblem__seam' }, grp);
    }
    if (t === 'tower' || b.antenna) {
      var cx = i + w / 2, cy = j + d / 2, top = P(cx, cy, z1), tip = P(cx, cy, z1 + (b.antenna || 12));
      S('line', { x1: top[0], y1: top[1], x2: tip[0], y2: tip[1], 'class': 'vk-emblem__mast' }, grp);
      S('circle', { cx: tip[0], cy: tip[1], r: 2, 'class': 'vk-emblem__beacon' }, grp);
    }
  }
  function win(g, p, lit, kind) { return poly(g, p, 'vk-emblem__win' + (kind ? ' vk-emblem__win--' + kind : '') + (lit ? ' vk-emblem__win--lit' : '')); }

  function cablePath(c, z) {
    // metro wire on the plinth: straight runs with rounded bends (quadratic corner of radius .35 grid units)
    var d = '', R = 0.35;
    for (var k = 0; k < c.length; k++) {
      var p = c[k];
      if (k === 0) { var s = P(p[0], p[1], z); d += 'M' + s[0].toFixed(1) + ' ' + s[1].toFixed(1); continue; }
      if (k < c.length - 1) {
        var a = c[k - 1], b = c[k + 1];
        var la = Math.hypot(p[0] - a[0], p[1] - a[1]) || 1, lb = Math.hypot(b[0] - p[0], b[1] - p[1]) || 1;
        var ra = Math.min(R, la / 2), rb = Math.min(R, lb / 2);
        var e1 = P(p[0] - (p[0] - a[0]) / la * ra, p[1] - (p[1] - a[1]) / la * ra, z), cc = P(p[0], p[1], z), e2 = P(p[0] + (b[0] - p[0]) / lb * rb, p[1] + (b[1] - p[1]) / lb * rb, z);
        d += 'L' + e1[0].toFixed(1) + ' ' + e1[1].toFixed(1) + 'Q' + cc[0].toFixed(1) + ' ' + cc[1].toFixed(1) + ' ' + e2[0].toFixed(1) + ' ' + e2[1].toFixed(1);
      } else { var e = P(p[0], p[1], z); d += 'L' + e[0].toFixed(1) + ' ' + e[1].toFixed(1); }
    }
    return d;
  }

  function crop(svg, y0) { y0 = Math.floor(y0); svg.setAttribute('viewBox', '0 ' + y0 + ' ' + VB_W + ' ' + (VB_H - y0)); }

  function buildSvg(o, uidv) {
    var r = VK.rng(String(o.seed == null ? (o.kind || '') + (o.name || '') : o.seed));
    var detail = o.size !== 'mini', act = o.activity == null ? 0.45 : VK.clamp(+o.activity, 0, 1);
    var svg = S('svg', { viewBox: '0 0 ' + VB_W + ' ' + VB_H, 'class': 'vk-emblem__svg', 'aria-hidden': 'true', focusable: 'false' });
    var clipId = uidv + '-top';
    var defs = S('defs', null, svg);
    var cp = S('clipPath', { id: clipId }, defs);
    poly(cp, [P(0, 0), P(N, 0), P(N, N), P(0, N)], '');

    // ground halo + plinth
    S('ellipse', { cx: CX, cy: CY + N * A / 2 + T, rx: N * A * 1.1, ry: N * A * 0.36, 'class': 'vk-emblem__halo' }, svg);
    var pl = S('g', { 'class': 'vk-emblem__plinth' }, svg);
    poly(pl, [P(N, 0, 0), P(N, N, 0), P(N, N, -T), P(N, 0, -T)], 'vk-emblem__p-r');
    poly(pl, [P(0, N, 0), P(N, N, 0), P(N, N, -T), P(0, N, -T)], 'vk-emblem__p-l');
    poly(pl, [P(0, 0), P(N, 0), P(N, N), P(0, N)], 'vk-emblem__p-t');
    poly(pl, [P(0.3, 0.3), P(N - 0.3, 0.3), P(N - 0.3, N - 0.3), P(0.3, N - 0.3)], 'vk-emblem__p-lip');
    if (detail) {
      for (var k = 1; k < N; k++) {
        var a = P(k, N, -1), b = P(k, N, k % 5 === 0 ? -5 : -3);
        S('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], 'class': 'vk-emblem__tick' }, pl);
        var c = P(N, k, -1), e = P(N, k, k % 5 === 0 ? -5 : -3);
        S('line', { x1: c[0], y1: c[1], x2: e[0], y2: e[1], 'class': 'vk-emblem__tick' }, pl);
      }
      // engraved micro text on the two faces (sheared into the face plane)
      var lp = P(0.6, N, -T + 3.5), rp = P(N, N - 0.6, -T + 3.5);
      var tl = S('text', { 'class': 'vk-emblem__engrave', transform: 'matrix(1 .5 0 1 ' + lp[0].toFixed(1) + ' ' + lp[1].toFixed(1) + ')' }, pl);
      tl.textContent = (o.code || ('[' + String(KINDS.indexOf(o.kind) + 1).padStart(2, '0') + '] ' + String(o.kind || 'VRG').toUpperCase()));
      var tr = S('text', { 'class': 'vk-emblem__engrave', transform: 'matrix(1 -.5 0 1 ' + rp[0].toFixed(1) + ' ' + rp[1].toFixed(1) + ')' }, pl);
      tr.textContent = 'SEED ' + String(o.seed == null ? '—' : o.seed).toUpperCase().slice(0, 10);
    }

    var recipe = RECIPES[o.kind];
    if (!recipe) { crop(svg, CY - 8); return svg; }
    var scene = recipe(r);
    var top = CY - 8;
    scene.boxes.forEach(function (b) {
      var extra = b.type === 'tower' || b.antenna ? (b.antenna || 12) + 3 : 0;
      top = Math.min(top, P(b.i, b.j, b.z0 + b.h + extra)[1] - 4);
    });
    crop(svg, top);
    var ground = S('g', { 'clip-path': 'url(#' + clipId + ')' }, svg);

    // day shadows: footprint swept away from a low sun on the left
    var sh = S('g', { 'class': 'vk-emblem__shadows' }, ground);
    scene.boxes.forEach(function (b) {
      if (b.type === 'slab' || b.h < 1.5) return;
      var L = (b.z0 + b.h) / A * 0.55, di = L * 0.55, dj = -L * 0.9;
      var corners = [[b.i, b.j], [b.i + b.w, b.j], [b.i + b.w, b.j + b.d], [b.i, b.j + b.d]];
      var all = corners.concat(corners.map(function (q) { return [q[0] + di, q[1] + dj]; }));
      poly(sh, hull(all).map(function (q) { return P(q[0], q[1], 0); }), 'vk-emblem__shadow');
    });
    // streets (glow at night)
    scene.streets.forEach(function (s) { S('path', { d: cablePath(s, 0.1), 'class': 'vk-emblem__street' }, ground); });
    // cables: metro wires with node dots, junction diamonds at bends, square terminals at ends
    scene.cables.forEach(function (c) {
      S('path', { d: cablePath(c, 0.25), 'class': 'vk-emblem__cable-glow' }, ground);
      S('path', { d: cablePath(c, 0.25), 'class': 'vk-emblem__cable' }, ground);
      if (!detail) return;
      c.forEach(function (p, idx) {
        var q = P(p[0], p[1], 0.25);
        if (idx === c.length - 1) S('rect', { x: q[0] - 1.6, y: q[1] - 1.6, width: 3.2, height: 3.2, 'class': 'vk-emblem__term' }, ground);
        else if (idx > 0) S('path', { d: 'M' + q[0] + ' ' + (q[1] - 2) + 'l2 2-2 2-2-2z', 'class': 'vk-emblem__junction' }, ground);
        else S('circle', { cx: q[0], cy: q[1], r: 1.7, 'class': 'vk-emblem__node' }, ground);
      });
    });
    scene.rings.forEach(function (p) {
      var q = P(p[0], p[1], 0.3);
      S('ellipse', { cx: q[0], cy: q[1], rx: 22, ry: 11, 'class': 'vk-emblem__ring' }, ground);
    });

    // boxes, painter's order (layer, then depth of the centre)
    var g = S('g', { 'class': 'vk-emblem__scene' }, svg);
    scene.boxes.slice().sort(function (x, y) {
      return (x.layer - y.layer) || ((x.i + x.w / 2 + x.j + x.d / 2) - (y.i + y.w / 2 + y.j + y.d / 2)) || (x.z0 - y.z0);
    }).forEach(function (b) { drawBox(g, b, r, act, detail); });
    return svg;
  }

  function render(el, o) {
    o = Object.assign({ size: 'hero', kicker: 'VRG ESZKÖZTÁR' }, o || {});
    var inst = { el: el, opts: o };
    var uidv = VK.uid('vk-emb');
    function draw() {
      var x = inst.opts;
      el.textContent = '';
      el.classList.add('vk-emblem');
      el.dataset.size = x.size;
      el.dataset.kind = x.kind || 'none';
      el.dataset.phase = phaseOf(el);
      if (x.size === 'mini') {
        el.setAttribute('role', 'img');
        el.setAttribute('aria-label', [x.name, x.readout].filter(Boolean).join(' — '));
      } else {
        el.removeAttribute('role'); el.removeAttribute('aria-label');
        var stack = VK.el('div.vk-emblem__stack');
        if (x.kicker) stack.appendChild(VK.el('p.vk-emblem__kicker.vk-label', { text: x.kicker }));
        var lv = +x.level;
        stack.appendChild(VK.el((lv >= 1 && lv <= 6 ? 'h' + lv : 'p') + '.vk-emblem__name.vk-title', { text: x.name || '' }));
        if (x.glyph) stack.appendChild(VK.el('div.vk-emblem__glyph', { 'aria-hidden': 'true' }, [VK.el('span.vk-emblem__rule'), VK.icon(x.glyph), VK.el('span.vk-emblem__rule')]));
        if (x.date) stack.appendChild(VK.el('p.vk-emblem__date.vk-num', { text: x.date }));
        if (x.readout) stack.appendChild(VK.el('p.vk-emblem__readout.vk-num', { text: x.readout }));
        el.appendChild(stack);
      }
      el.appendChild(buildSvg(x, uidv));
    }
    draw();
    live.push(inst);
    if (!listening) { listening = true; document.addEventListener('vk:theme', onTheme); }
    inst.update = function (patch) { Object.assign(inst.opts, patch || {}); draw(); return inst; };
    inst.destroy = function () { live = live.filter(function (x) { return x !== inst; }); el.textContent = ''; el.classList.remove('vk-emblem'); };
    return inst;
  }

  VK.emblem = { render: render, kinds: KINDS.slice(), phase: phaseOf };
})(typeof window !== 'undefined' ? window : globalThis);
