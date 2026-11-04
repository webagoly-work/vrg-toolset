/* VRG UI Kit — components/graph.js — node/wire topology on SVG, flat or iso ("iso-board") projection.
     var g = VK.graph.mount(el, {
       label: 'Topológia — VRG-2611-03',
       nodes:  [{id, kind:'bubble'|'dot'|'junction'|'terminal'|'hex', x, y, label, sub, w?, h?, layer?, hub?,
                 badge?: {icon, label, state, progress}}],          // x/y = centre, world units
       edges:  [{id?, from, to, layer, style:'metro'|'curve'|'straight', planned?, active?, arrow?, label?}],
       frames: [{id, label, nodes:[ids]} | {id, label, x, y, w, h}],
       layers: [{id:'power', name:'Erősáram', color?:'--vk-wire-power', visible?:true}],
       projection: 'flat' | 'iso', edgeStyle: 'metro', arrows: false })
     → { setData(d), select(ids, {add, toggle}), selection(), focusNode(id), focused(), fit(), zoomTo(k | id),
         zoomBy(f), panBy(dx, dy), centerOn(x, y), getView(), setView(v), setLayerVisible(id, on), isLayerVisible(id),
         setProjection(p), bounds(), model(), legend(el), on(type, fn), destroy() }
   Events (inst.on): select {ids} · focus {id} · open {id} · rename {id} · badge {id} · view {x,y,k} · layer {id, visible} · data.
   DOM: 'vk:selection' bubbles from el, detail = the id array (also detail.ids, detail.source = 'graph').
   Keyboard (one tab stop, role=application): arrows pan the canvas, or move focus spatially when a node is focused ·
   Enter: focus the node nearest the centre / open the focused node · Space: toggle selection · Ctrl+A: select all ·
   F2: rename event · Delete: runs registry action 'graph.delete' (ctx {graph, ids}) · + − 0: zoom, fit ·
   Home: first node · Esc: clear selection, then leave node focus. Mouse: drag = pan, wheel = zoom,
   click / Ctrl+click = select / toggle, Shift+drag = box select.
   Suggested registry ids for apps: graph.zoomIn, graph.zoomOut, graph.fit, graph.delete, graph.layer.<id>.
   Depends on: core.js, mini.js (node badges, legend). Optional: actions.js (Delete). */
(function (root) {
  'use strict';
  var VK = root.VK = root.VK || {};
  if (VK.graph) return;

  var NS = 'http://www.w3.org/2000/svg';
  var IC = Math.cos(Math.PI / 6), IS = 0.5;
  var SIZE = { bubble: [150, 52], dot: [12, 12], junction: [16, 16], terminal: [11, 11], hex: [84, 64] };
  var EXT = { bubble: 12, hex: 10, dot: 6, terminal: 6, junction: 1 };
  var KIND_HU = { bubble: 'csomópont', dot: 'pont', junction: 'elágazás', terminal: 'végpont', hex: 'panel' };
  var WIRES = { power: '--vk-wire-power', light: '--vk-wire-light', data: '--vk-wire-data', control: '--vk-wire-control',
    earth: '--vk-wire-earth', bus: '--vk-wire-bus', signal: '--vk-wire-signal', other: '--vk-wire-other' };
  var LAYER_T = ['--vk-layer-1', '--vk-layer-2', '--vk-layer-3', '--vk-layer-4', '--vk-layer-5', '--vk-layer-6', '--vk-layer-7', '--vk-layer-8'];
  var MIN_K = 0.15, MAX_K = 4;

  function svg(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) if (attrs[k] !== undefined && attrs[k] !== null && attrs[k] !== false) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function r1(v) { return Math.round(v * 10) / 10; }
  function clip(s, n) { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, Math.max(1, n - 1)) + '…' : s; }
  function layerToken(l, i) {
    if (l && l.color) return l.color.indexOf('--') === 0 ? l.color : '--vk-' + l.color;
    if (l && WIRES[l.id]) return WIRES[l.id];
    return LAYER_T[(i < 0 ? 7 : i) % 8];
  }

  function mount(el, opts) {
    opts = opts || {};
    var data = { nodes: [], edges: [], frames: [], layers: [] };
    var proj = opts.projection === 'iso' ? 'iso' : 'flat';
    var em = VK.emitter();
    var view = { x: 0, y: 0, k: 1 };
    var sel = [], focusId = null, hidden = {}, fitted = false;
    var byId = {}, geo = {}, nodeEl = {}, edgeInfo = [], frameInfo = [], bbox = null, deg = {};
    var uidp = VK.uid('vkg');

    el.classList.add('vk-graph');
    el.dataset.projection = proj;
    el.setAttribute('role', 'application');
    el.setAttribute('aria-roledescription', 'topológia');
    el.setAttribute('aria-label', opts.label || 'Topológia');
    el.tabIndex = 0;
    var help = VK.el('p.vk-sr-only', { id: uidp + '-help', text: 'Nyilak: a nézet mozgatása, csomóponton állva lépés a szomszédra. ' +
      'Enter: csomópont fókusz, majd megnyitás. Szóköz: kijelölés. Ctrl+A: mind. F2: átnevezés. Delete: törlés. ' +
      'Plusz, mínusz, nulla: nagyítás, kicsinyítés, illesztés. Esc: kijelölés törlése, majd vissza a vászonra.' });
    var live = VK.el('div.vk-sr-only', { role: 'status', 'aria-live': 'polite' });
    el.setAttribute('aria-describedby', help.id);
    var rootSvg = svg('svg', { class: 'vk-graph__svg', role: 'none', focusable: 'false' });
    var defs = svg('defs', null, rootSvg);
    var glow = svg('radialGradient', { id: uidp + '-glow' }, defs);
    svg('stop', { offset: '0', class: 'vk-graph__glow-a' }, glow);
    svg('stop', { offset: '1', class: 'vk-graph__glow-b' }, glow);
    var gView = svg('g', { class: 'vk-graph__view' }, rootSvg);
    var gFloor = svg('g', null, gView), gFrames = svg('g', null, gView), gEdges = svg('g', null, gView), gNodes = svg('g', null, gView);
    var marquee = VK.el('div.vk-graph__marquee', { hidden: true });
    el.textContent = '';
    el.appendChild(rootSvg); el.appendChild(marquee); el.appendChild(help); el.appendChild(live);

    // ---------- geometry ----------
    function P(x, y) { return proj === 'iso' ? [(x - y) * IC, (x + y) * IS] : [x, y]; }
    function toD(cmds) {
      return cmds.map(function (c) {
        var s = c[0];
        for (var i = 1; i < c.length; i += 2) { var p = P(c[i], c[i + 1]); s += ' ' + r1(p[0]) + ' ' + r1(p[1]); }
        return s;
      }).join(' ');
    }
    function layerIndex(id) { for (var i = 0; i < data.layers.length; i++) if (data.layers[i].id === id) return i; return -1; }
    function layerOf(id) { var i = layerIndex(id); return i >= 0 ? data.layers[i] : null; }
    function nodeHidden(n) { return !!(n.layer && hidden[n.layer]); }
    function edgeHidden(e) { return !!(hidden[e.layer] || nodeHidden(byId[e.from]) || nodeHidden(byId[e.to])); }

    function sides(e) {
      var a = geo[e.from], b = geo[e.to], dx = b.x - a.x, dy = b.y - a.y;
      var gx = Math.abs(dx) - (a.w + b.w) / 2, gy = Math.abs(dy) - (a.h + b.h) / 2;
      if (gx >= 12 || gx >= gy) return dx >= 0 ? ['r', 'l'] : ['l', 'r'];
      return dy >= 0 ? ['b', 't'] : ['t', 'b'];
    }
    function portPoint(id, side, off) {
      var G = geo[id];
      if (side === 'r') return { x: G.x + G.w / 2, y: G.y + off };
      if (side === 'l') return { x: G.x - G.w / 2, y: G.y + off };
      if (side === 'b') return { x: G.x + off, y: G.y + G.h / 2 };
      return { x: G.x + off, y: G.y - G.h / 2 };
    }
    function swapCmds(cmds) { return cmds.map(function (c) { var o = [c[0]]; for (var i = 1; i < c.length; i += 2) o.push(c[i + 1], c[i]); return o; }); }
    function metroH(p1, p2, mx) {
      var dy = p2.y - p1.y;
      if (Math.abs(dy) < 0.5) return [['M', p1.x, p1.y], ['L', p2.x, p2.y]];
      var s1 = mx >= p1.x ? 1 : -1, s2 = p2.x >= mx ? 1 : -1, sy = dy > 0 ? 1 : -1;
      var r = Math.max(0, Math.min(10, Math.abs(dy) / 2, Math.abs(mx - p1.x), Math.abs(p2.x - mx)));
      return [['M', p1.x, p1.y], ['L', mx - s1 * r, p1.y], ['Q', mx, p1.y, mx, p1.y + sy * r],
        ['L', mx, p2.y - sy * r], ['Q', mx, p2.y, mx + s2 * r, p2.y], ['L', p2.x, p2.y]];
    }
    function curveH(p1, p2) {
      var s = p2.x >= p1.x ? 1 : -1, k = Math.max(30, Math.abs(p2.x - p1.x) / 2);
      return [['M', p1.x, p1.y], ['C', p1.x + s * k, p1.y, p2.x - s * k, p2.y, p2.x, p2.y]];
    }
    function sw(p) { return { x: p.y, y: p.x }; }

    function route() {
      edgeInfo = [];
      var slots = {};   // node|side → [layer ids]
      var list = data.edges.filter(function (e) { return geo[e.from] && geo[e.to] && e.from !== e.to; });
      list.forEach(function (e) {
        var s = sides(e);
        var info = { e: e, sa: s[0], sb: s[1], vert: s[0] === 't' || s[0] === 'b' };
        [[e.from, s[0]], [e.to, s[1]]].forEach(function (q) {
          var k = q[0] + '|' + q[1]; slots[k] = slots[k] || [];
          if (slots[k].indexOf(e.layer) < 0) slots[k].push(e.layer);
        });
        edgeInfo.push(info);
      });
      Object.keys(slots).forEach(function (k) { slots[k].sort(function (a, b) { return layerIndex(a) - layerIndex(b); }); });
      function off(id, side, layer) {
        var G = geo[id], arr = slots[id + '|' + side], n = arr.length;
        if (n < 2 || (G.kind !== 'bubble' && !(G.kind === 'hex' && (side === 't' || side === 'b')))) return 0;
        var half = (side === 'l' || side === 'r' ? G.h : G.w) / 2 - 6, step = Math.min(8, (2 * half) / (n - 1));
        return (arr.indexOf(layer) - (n - 1) / 2) * step;
      }
      edgeInfo.forEach(function (I) {
        I.p1 = portPoint(I.e.from, I.sa, off(I.e.from, I.sa, I.e.layer));
        I.p2 = portPoint(I.e.to, I.sb, off(I.e.to, I.sb, I.e.layer));
      });
      // bundling: edges that share (source, side, layer) share a trunk; same for fan-in
      var outG = {}, inG = {};
      edgeInfo.forEach(function (I) {
        var ko = I.e.from + '|' + I.sa + '|' + I.e.layer, ki = I.e.to + '|' + I.sb + '|' + I.e.layer;
        (outG[ko] = outG[ko] || []).push(I); (inG[ki] = inG[ki] || []).push(I);
        I.ko = ko; I.ki = ki;
      });
      var L = Math.max(1, data.layers.length);
      edgeInfo.forEach(function (I) {
        var e = I.e, style = e.style || opts.edgeStyle || 'metro';
        var a = I.vert ? sw(I.p1) : I.p1, b = I.vert ? sw(I.p2) : I.p2, cmds;
        if (style === 'straight') cmds = [['M', a.x, a.y], ['L', b.x, b.y]];
        else if (style === 'curve') cmds = curveH(a, b);
        else {
          var go = outG[I.ko], gi = inG[I.ki], gap = function (arr) {
            return Math.min.apply(null, arr.map(function (J) { var p = I.vert ? sw(J.p1) : J.p1, q = I.vert ? sw(J.p2) : J.p2; return Math.abs(q.x - p.x); }));
          };
          var sgn = b.x >= a.x ? 1 : -1, mx;
          if (go.length > 1 && go.length >= gi.length) mx = a.x + sgn * gap(go) / 2;
          else if (gi.length > 1) mx = b.x - sgn * gap(gi) / 2;
          else mx = (a.x + b.x) / 2;
          var li = layerIndex(e.layer); mx += (li < 0 ? 0 : li - (L - 1) / 2) * 5 * sgn;
          var lo = Math.min(a.x, b.x) + 2, hi = Math.max(a.x, b.x) - 2;
          mx = hi > lo ? Math.max(lo, Math.min(hi, mx)) : (a.x + b.x) / 2;
          cmds = metroH(a, b, mx);
        }
        I.cmds = I.vert ? swapCmds(cmds) : cmds;
      });
    }

    function labelPoint(cmds) {
      var best = null, bl = -1, prev = null;
      cmds.forEach(function (c) {
        var end = [c[c.length - 2], c[c.length - 1]];
        if (c[0] === 'L' && prev) {
          var a = P(prev[0], prev[1]), b = P(end[0], end[1]), l = Math.hypot(b[0] - a[0], b[1] - a[1]);
          if (l > bl) { bl = l; best = { x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, h: Math.abs(b[1] - a[1]) < Math.abs(b[0] - a[0]) }; }
        }
        prev = end;
      });
      if (!best) { var s = P(cmds[0][1], cmds[0][2]), t = P(prev[0], prev[1]); best = { x: (s[0] + t[0]) / 2, y: (s[1] + t[1]) / 2, h: true }; }
      return best;
    }

    // ---------- drawing ----------
    function prism(g, corners, ext, kind) {
      var pts = corners.map(function (c) { return P(c[0], c[1]); });
      var quads = [];
      for (var i = 0; i < pts.length; i++) {
        var a = pts[i], b = pts[(i + 1) % pts.length];
        quads.push({ pts: [a, b, [b[0], b[1] - ext], [a[0], a[1] - ext]], y: (a[1] + b[1]) / 2, cls: b[0] > a[0] ? 'vk-graph__side' : 'vk-graph__side2' });
      }
      quads.sort(function (p, q) { return p.y - q.y; });
      if (ext > 1) quads.forEach(function (q) { svg('polygon', { class: q.cls, points: q.pts.map(function (p) { return r1(p[0]) + ',' + r1(p[1]); }).join(' ') }, g); });
      svg('polygon', { class: 'vk-graph__top', points: pts.map(function (p) { return r1(p[0]) + ',' + r1(p[1] - ext); }).join(' ') }, g);
      return pts;
    }
    function shapeCorners(G, grow) {
      var w = G.w / 2 + grow, h = G.h / 2 + grow, x = G.x, y = G.y;
      if (G.kind === 'junction') return [[x, y - h], [x + w, y], [x, y + h], [x - w, y]];
      if (G.kind === 'hex') return [[x - w, y], [x - w / 2, y - h], [x + w / 2, y - h], [x + w, y], [x + w / 2, y + h], [x - w / 2, y + h]];
      return [[x - w, y - h], [x + w, y - h], [x + w, y + h], [x - w, y + h]];
    }

    function nodeLabel(n) {
      var G = geo[n.id], b = n.badge;
      var s = (n.label || n.id) + ', ' + KIND_HU[G.kind] + (n.sub ? ', ' + n.sub : '') + ', ' + (deg[n.id] || 0) + ' kapcsolat';
      if (b && b.label) s += ', ' + b.label + (b.progress != null && b.state === 'running' ? ' ' + Math.round(b.progress * 100) + '%' : '');
      if (sel.indexOf(n.id) >= 0) s += ', kijelölve';
      return s;
    }

    function drawBadge(n, g, x, y) {
      if (!n.badge || !VK.mini) return;
      var b = n.badge, fo = svg('foreignObject', { class: 'vk-graph__badge', x: x, y: y, width: 22, height: 22 }, g);
      var m = VK.mini.create({ icon: b.icon || 'dot', label: b.label || '', state: b.state, progress: b.progress, size: 'sm', meter: b.meter });
      m.tabIndex = -1; m.setAttribute('aria-hidden', 'true');
      m.addEventListener('click', function (ev) { ev.stopPropagation(); em.emit('badge', { id: n.id, node: n }); });
      fo.appendChild(m);
    }

    function drawNodeFlat(n, g) {
      var G = geo[n.id], w = G.w, h = G.h, k = G.kind;
      if (k === 'bubble') {
        svg('rect', { class: 'vk-graph__card', x: -w / 2, y: -h / 2, width: w, height: h }, g);
        if (n.layer) svg('rect', { class: 'vk-graph__bar', x: -w / 2 + 0.5, y: -h / 2 + 6, width: 2, height: h - 12, style: '--_lc: var(' + layerToken(layerOf(n.layer), layerIndex(n.layer)) + ')' }, g);
        var room = Math.floor((w - 22 - (n.badge ? 28 : 0)) / 6.6);
        svg('text', { class: 'vk-graph__title', x: -w / 2 + 10, y: n.sub ? -3 : 4 }, g).textContent = clip(n.label || n.id, room);
        if (n.sub) svg('text', { class: 'vk-graph__sub', x: -w / 2 + 10, y: 13 }, g).textContent = clip(String(n.sub).toUpperCase(), Math.floor((w - 20) / 6));
        drawBadge(n, g, w / 2 - 28, -11);
        svg('rect', { class: 'vk-graph__ring', x: -w / 2 - 4, y: -h / 2 - 4, width: w + 8, height: h + 8, rx: 5 }, g);
      } else if (k === 'hex') {
        svg('polygon', { class: 'vk-graph__hex', points: [[-w / 2, 0], [-w / 4, -h / 2], [w / 4, -h / 2], [w / 2, 0], [w / 4, h / 2], [-w / 4, h / 2]].map(function (p) { return p.join(','); }).join(' ') }, g);
        svg('text', { class: 'vk-graph__title', x: 0, y: n.sub ? -1 : 4, 'text-anchor': 'middle' }, g).textContent = clip(n.label || n.id, Math.floor((w - 14) / 6));
        if (n.sub) svg('text', { class: 'vk-graph__sub', x: 0, y: 13, 'text-anchor': 'middle' }, g).textContent = clip(String(n.sub).toUpperCase(), Math.floor((w - 24) / 6));
        if (n.badge) drawBadge(n, g, -11, -h / 2 - 26);
        var R = w / 2 + 5, H = h / 2 + 5;
        svg('polygon', { class: 'vk-graph__ring', points: [[-R, 0], [-R / 2, -H], [R / 2, -H], [R, 0], [R / 2, H], [-R / 2, H]].map(function (p) { return p.join(','); }).join(' ') }, g);
      } else {
        var s = w / 2;
        svg('circle', { class: 'vk-graph__hit', r: Math.max(12, s + 6) }, g);
        if (k === 'dot') svg('circle', { class: 'vk-graph__dot', r: s }, g);
        else if (k === 'junction') svg('path', { class: 'vk-graph__junction', d: 'M0 ' + -s + 'L' + s + ' 0L0 ' + s + 'L' + -s + ' 0Z' }, g);
        else svg('rect', { class: 'vk-graph__terminal', x: -s, y: -s, width: 2 * s, height: 2 * s }, g);
        if (n.label) {
          var pos = n.labelAt || 'bottom', t = svg('text', { class: 'vk-graph__tag' }, g);
          if (pos === 'right') { t.setAttribute('x', s + 6); t.setAttribute('y', 3); }
          else if (pos === 'left') { t.setAttribute('x', -s - 6); t.setAttribute('y', 3); t.setAttribute('text-anchor', 'end'); }
          else if (pos === 'top') { t.setAttribute('y', -s - 6); t.setAttribute('text-anchor', 'middle'); }
          else { t.setAttribute('y', s + 12); t.setAttribute('text-anchor', 'middle'); }
          t.textContent = String(n.label).toUpperCase();
        }
        if (n.badge) drawBadge(n, g, s + 2, -s - 22);
        svg('circle', { class: 'vk-graph__ring', r: s + 6 }, g);
      }
    }

    function drawNodeIso(n, g) {
      var G = geo[n.id], k = G.kind, ext = n.hub ? 22 : EXT[k];
      var c = P(G.x, G.y);
      if (n.hub) {
        var rx = (G.w + G.h) * IC * 1.15;
        svg('ellipse', { class: 'vk-graph__glow', cx: r1(c[0]), cy: r1(c[1]), rx: r1(rx), ry: r1(rx * 0.58), fill: 'url(#' + uidp + '-glow)' }, g);
      }
      prism(g, shapeCorners(G, 0), ext, k);
      if (n.hub) svg('path', { class: 'vk-graph__beam', d: 'M' + r1(c[0]) + ' ' + r1(c[1] - ext) + 'V' + r1(c[1] - ext - 46) }, g);
      var ring = shapeCorners(G, k === 'bubble' || k === 'hex' ? 6 : 5).map(function (q) { var p = P(q[0], q[1]); return r1(p[0]) + ',' + r1(p[1] - ext); });
      svg('polygon', { class: 'vk-graph__ring', points: ring.join(' ') }, g);
      if (k === 'bubble' || k === 'hex') {
        var t = svg('text', { class: 'vk-graph__title', x: r1(c[0]), y: r1(c[1] - ext + (n.sub ? 0 : 4)), 'text-anchor': 'middle' }, g);
        t.textContent = clip(n.label || n.id, k === 'hex' ? 12 : 20);
        if (n.sub) svg('text', { class: 'vk-graph__sub', x: r1(c[0]), y: r1(c[1] - ext + 12), 'text-anchor': 'middle' }, g).textContent = clip(String(n.sub).toUpperCase(), 22);
        if (n.badge) drawBadge(n, g, r1(c[0] + (G.w + G.h) * IC / 2 - 30), r1(c[1] - ext - 26));
      } else {
        svg('circle', { class: 'vk-graph__hit', cx: r1(c[0]), cy: r1(c[1] - ext / 2), r: 12 }, g);
        if (n.label) {
          var tg = svg('text', { class: 'vk-graph__tag', x: r1(c[0]), y: r1(c[1] + 16), 'text-anchor': 'middle' }, g);
          tg.textContent = String(n.label).toUpperCase();
        }
      }
      G.ext = ext;
    }

    function render() {
      gFloor.textContent = ''; gFrames.textContent = ''; gEdges.textContent = ''; gNodes.textContent = '';
      el.dataset.projection = proj;
      byId = {}; geo = {}; nodeEl = {}; deg = {};
      data.nodes.forEach(function (n) {
        var k = SIZE[n.kind] ? n.kind : 'bubble';
        byId[n.id] = n;
        geo[n.id] = { x: +n.x || 0, y: +n.y || 0, w: n.w || SIZE[k][0], h: n.h || SIZE[k][1], kind: k, ext: 0 };
      });
      data.edges.forEach(function (e) { if (byId[e.from] && byId[e.to]) { deg[e.from] = (deg[e.from] || 0) + 1; deg[e.to] = (deg[e.to] || 0) + 1; } });
      route();
      var pts = [];   // projected points for bounds
      // floor grid (iso)
      if (proj === 'iso' && data.nodes.length) {
        var xs = data.nodes.map(function (n) { return geo[n.id].x; }), ys = data.nodes.map(function (n) { return geo[n.id].y; });
        var x0 = Math.floor((Math.min.apply(null, xs) - 120) / 40) * 40, x1 = Math.ceil((Math.max.apply(null, xs) + 120) / 40) * 40;
        var y0 = Math.floor((Math.min.apply(null, ys) - 100) / 40) * 40, y1 = Math.ceil((Math.max.apply(null, ys) + 100) / 40) * 40;
        var cm = [];
        for (var gx = x0; gx <= x1; gx += 40) cm.push(['M', gx, y0], ['L', gx, y1]);
        for (var gy = y0; gy <= y1; gy += 40) cm.push(['M', x0, gy], ['L', x1, gy]);
        svg('path', { class: 'vk-graph__floor', d: toD(cm) }, gFloor);
      }
      // frames
      frameInfo = [];
      data.frames.forEach(function (f) {
        var x0, y0, x1, y1;
        if (f.nodes && f.nodes.length) {
          x0 = y0 = Infinity; x1 = y1 = -Infinity;
          f.nodes.forEach(function (id) {
            var G = geo[id]; if (!G) return;
            var n = byId[id], small = G.kind !== 'bubble' && G.kind !== 'hex' && n.label;
            var lab = small && (!n.labelAt || n.labelAt === 'bottom') ? 16 : 0;
            var lw = small && n.labelAt === 'right' ? String(n.label).length * 5.8 + 8 : 0;
            x0 = Math.min(x0, G.x - G.w / 2); x1 = Math.max(x1, G.x + G.w / 2 + lw);
            y0 = Math.min(y0, G.y - G.h / 2); y1 = Math.max(y1, G.y + G.h / 2 + lab);
          });
          if (x0 === Infinity) return;
          var pad = f.pad == null ? 18 : f.pad; x0 -= pad; x1 += pad; y0 -= pad + 14; y1 += pad;
        } else { x0 = +f.x || 0; y0 = +f.y || 0; x1 = x0 + (+f.w || 100); y1 = y0 + (+f.h || 100); }
        var c = 10, cm = [['M', x0 + c, y0], ['L', x1, y0], ['L', x1, y1 - c], ['L', x1 - c, y1], ['L', x0, y1], ['L', x0, y0 + c], ['Z']];
        var g = svg('g', { class: 'vk-graph__frame', 'data-id': f.id }, gFrames);
        svg('path', { class: 'vk-graph__frame-shape', d: toD(cm) }, g);
        var lp = proj === 'iso' ? P(x0 + c, y0) : P(x0 + 12, y0 + 15);
        svg('text', { class: 'vk-graph__frame-label', x: r1(lp[0]) + (proj === 'iso' ? 6 : 0), y: r1(lp[1]) + (proj === 'iso' ? -4 : 0) }, g)
          .textContent = String(f.label || f.id).toUpperCase();
        [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].forEach(function (q) { pts.push(P(q[0], q[1])); });
        frameInfo.push({ id: f.id, d: toD(cm) });
      });
      // edges
      edgeInfo.forEach(function (I) {
        var e = I.e, li = layerIndex(e.layer);
        var g = svg('g', { class: 'vk-graph__edge', 'data-layer': e.layer || '', 'data-planned': e.planned ? '' : null, 'data-active': e.active ? '' : null,
          style: '--_lc: var(' + layerToken(layerOf(e.layer) || { id: e.layer }, li) + ')' }, gEdges);
        I.d = toD(I.cmds); I.g = g;
        svg('path', { class: 'vk-graph__wire', d: I.d }, g);
        if (e.active) svg('path', { class: 'vk-graph__flow', d: I.d }, g);
        if (e.arrow || (opts.arrows && e.arrow !== false)) {
          var last = I.cmds[I.cmds.length - 1], prev = last.length > 3 ? [last[last.length - 4], last[last.length - 3]] : [I.cmds[I.cmds.length - 2][I.cmds[I.cmds.length - 2].length - 2], I.cmds[I.cmds.length - 2][I.cmds[I.cmds.length - 2].length - 1]];
          var tip = P(last[last.length - 2], last[last.length - 1]), from = P(prev[0], prev[1]);
          var dx = tip[0] - from[0], dy = tip[1] - from[1], len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
          var bx = tip[0] - dx * 8, by = tip[1] - dy * 8;
          svg('path', { class: 'vk-graph__arrow', d: 'M' + r1(tip[0]) + ' ' + r1(tip[1]) + 'L' + r1(bx - dy * 3.5) + ' ' + r1(by + dx * 3.5) + 'L' + r1(bx + dy * 3.5) + ' ' + r1(by - dx * 3.5) + 'Z' }, g);
        }
        if (e.label) {
          var lp = labelPoint(I.cmds);
          svg('text', { class: 'vk-graph__elabel', x: r1(lp.x), y: r1(lp.h ? lp.y - 5 : lp.y + 3), dx: lp.h ? 0 : 6, 'text-anchor': lp.h ? 'middle' : 'start' }, g).textContent = String(e.label).toUpperCase();
        }
      });
      // nodes (iso: painter's order, back to front)
      var order = data.nodes.slice();
      if (proj === 'iso') order.sort(function (a, b) { return (geo[a.id].x + geo[a.id].y) - (geo[b.id].x + geo[b.id].y); });
      order.forEach(function (n) {
        var G = geo[n.id];
        var g = svg('g', { class: 'vk-graph__node', id: uidp + '-n-' + String(n.id).replace(/[^\w-]/g, '_'), role: 'button', 'data-id': n.id, 'data-kind': G.kind, 'data-hub': n.hub ? '' : null }, gNodes);
        if (proj === 'iso') drawNodeIso(n, g);
        else { g.setAttribute('transform', 'translate(' + r1(G.x) + ' ' + r1(G.y) + ')'); drawNodeFlat(n, g); }
        nodeEl[n.id] = g;
        var c = P(G.x, G.y);
        G.sx = c[0]; G.sy = c[1] - (G.ext || 0) / 2;
        shapeCorners(G, 0).forEach(function (q) { var p = P(q[0], q[1]); pts.push(p); pts.push([p[0], p[1] - (G.ext || 0) - (n.hub ? 50 : 0)]); });
        if (G.kind !== 'bubble' && G.kind !== 'hex' && n.label) pts.push([c[0], c[1] + 20]);
      });
      // ports on flat bubbles and hexes
      if (proj === 'flat') edgeInfo.forEach(function (I) {
        [[I.e.from, I.p1], [I.e.to, I.p2]].forEach(function (q) {
          var G = geo[q[0]]; if (G.kind !== 'bubble' && G.kind !== 'hex') return;
          svg('circle', { class: 'vk-graph__port', cx: r1(q[1].x - G.x), cy: r1(q[1].y - G.y), r: 2.6 }, nodeEl[q[0]]).setAttribute('style', I.g.getAttribute('style'));
          if (!I.ports) I.ports = [];
          I.ports.push(nodeEl[q[0]].lastChild);
        });
      });
      bbox = null;
      if (pts.length) {
        bbox = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
        pts.forEach(function (p) { bbox.x0 = Math.min(bbox.x0, p[0]); bbox.y0 = Math.min(bbox.y0, p[1]); bbox.x1 = Math.max(bbox.x1, p[0]); bbox.y1 = Math.max(bbox.y1, p[1]); });
      }
      sel = sel.filter(function (id) { return byId[id]; });
      if (focusId && !byId[focusId]) focusId = null;
      applyHidden(); applySel(); applyFocus(false);
      em.emit('data', {});
    }

    function applyHidden() {
      data.nodes.forEach(function (n) { var g = nodeEl[n.id]; if (g) toggleAttr(g, 'data-hidden', nodeHidden(n)); });
      edgeInfo.forEach(function (I) {
        var h = edgeHidden(I.e); toggleAttr(I.g, 'data-hidden', h);
        (I.ports || []).forEach(function (p) { toggleAttr(p, 'data-hidden', h); });
      });
    }
    function toggleAttr(n, a, on) { if (on) n.setAttribute(a, ''); else n.removeAttribute(a); }
    function applySel() {
      data.nodes.forEach(function (n) {
        var g = nodeEl[n.id]; if (!g) return;
        toggleAttr(g, 'data-selected', sel.indexOf(n.id) >= 0);
        g.setAttribute('aria-label', nodeLabel(n));
      });
      edgeInfo.forEach(function (I) { toggleAttr(I.g, 'data-hl', sel.indexOf(I.e.from) >= 0 || sel.indexOf(I.e.to) >= 0); });
    }
    function applyFocus(announce) {
      Object.keys(nodeEl).forEach(function (id) { toggleAttr(nodeEl[id], 'data-focused', id === focusId); });
      if (focusId && nodeEl[focusId]) el.setAttribute('aria-activedescendant', nodeEl[focusId].id);
      else el.removeAttribute('aria-activedescendant');
      if (announce && focusId) say('Csomópont: ' + (byId[focusId].label || focusId) + ', ' + (deg[focusId] || 0) + ' kapcsolat' + (sel.indexOf(focusId) >= 0 ? ', kijelölve' : ''));
    }
    function say(t) { live.textContent = ''; setTimeout(function () { live.textContent = t; }, 30); }

    // ---------- view ----------
    function applyView() {
      gView.setAttribute('transform', 'translate(' + r1(view.x) + ' ' + r1(view.y) + ') scale(' + Math.round(view.k * 1000) / 1000 + ')');
      var gs = 24 * view.k; while (gs < 10) gs *= 2;
      el.style.setProperty('--_gs', r1(gs) + 'px');
      el.style.setProperty('--_gx', r1(view.x) + 'px'); el.style.setProperty('--_gy', r1(view.y) + 'px');
      em.emit('view', { x: view.x, y: view.y, k: view.k });
    }
    function size() { return { w: el.clientWidth || 1, h: el.clientHeight || 1 }; }
    function fit(pad) {
      var s = size(); if (!bbox || s.w < 2) return;
      pad = pad == null ? Math.min(32, s.w * 0.06) : pad;
      var bw = Math.max(1, bbox.x1 - bbox.x0), bh = Math.max(1, bbox.y1 - bbox.y0);
      var k = VK.clamp(Math.min((s.w - 2 * pad) / bw, (s.h - 2 * pad) / bh), MIN_K, MAX_K);
      view.k = k; view.x = s.w / 2 - (bbox.x0 + bw / 2) * k; view.y = s.h / 2 - (bbox.y0 + bh / 2) * k;
      fitted = true; applyView();
    }
    function zoomBy(f, cx, cy) {
      var s = size(); cx = cx == null ? s.w / 2 : cx; cy = cy == null ? s.h / 2 : cy;
      var k = VK.clamp(view.k * f, MIN_K, MAX_K), r = k / view.k;
      view.x = cx - (cx - view.x) * r; view.y = cy - (cy - view.y) * r; view.k = k; applyView();
    }
    function zoomTo(t, k) {
      if (typeof t === 'number') { zoomBy(t / view.k); return; }
      var G = geo[t]; if (!G) return;
      if (k) view.k = VK.clamp(k, MIN_K, MAX_K);
      centerOn(G.sx, G.sy);
    }
    function centerOn(x, y) { var s = size(); view.x = s.w / 2 - x * view.k; view.y = s.h / 2 - y * view.k; applyView(); }
    function panBy(dx, dy) { view.x += dx; view.y += dy; applyView(); }
    function screenOf(id) { var G = geo[id]; return { x: G.sx * view.k + view.x, y: G.sy * view.k + view.y }; }
    function ensureVisible(id) {
      var s = size(), p = screenOf(id), m = Math.min(60, s.w / 4), dx = 0, dy = 0;
      if (p.x < m) dx = m - p.x; else if (p.x > s.w - m) dx = s.w - m - p.x;
      if (p.y < m) dy = m - p.y; else if (p.y > s.h - m) dy = s.h - m - p.y;
      if (dx || dy) panBy(dx, dy);
    }

    // ---------- selection & focus ----------
    function visibleNodes() { return data.nodes.filter(function (n) { return !nodeHidden(n); }); }
    function select(ids, o) {
      o = o || {};
      ids = ids == null ? [] : Array.isArray(ids) ? ids : [ids];
      ids = ids.filter(function (id) { return byId[id]; });
      if (o.toggle) ids.forEach(function (id) { var i = sel.indexOf(id); if (i >= 0) sel.splice(i, 1); else sel.push(id); });
      else if (o.add) ids.forEach(function (id) { if (sel.indexOf(id) < 0) sel.push(id); });
      else sel = ids.slice();
      applySel();
      var d = sel.slice(); d.ids = sel.slice(); d.source = 'graph'; d.graph = inst;
      em.emit('select', { ids: sel.slice() });
      VK.fire(el, 'selection', d);
      return sel.slice();
    }
    function setFocus(id, announce) {
      focusId = id && byId[id] ? id : null;
      applyFocus(announce !== false);
      if (focusId) { ensureVisible(focusId); em.emit('focus', { id: focusId }); }
    }
    function nearestCenter() {
      var s = size(), cx = (s.w / 2 - view.x) / view.k, cy = (s.h / 2 - view.y) / view.k, best = null, bd = Infinity;
      visibleNodes().forEach(function (n) { var G = geo[n.id], d = Math.hypot(G.sx - cx, G.sy - cy); if (d < bd) { bd = d; best = n.id; } });
      return best;
    }
    function moveFocus(dir) {
      var cur = geo[focusId], best = null, bd = Infinity;
      visibleNodes().forEach(function (n) {
        if (n.id === focusId) return;
        var G = geo[n.id], dx = G.sx - cur.sx, dy = G.sy - cur.sy, along = dx * dir[0] + dy * dir[1];
        if (along <= 2) return;
        var d = along + (Math.abs(dx * dir[1]) + Math.abs(dy * dir[0])) * 2.5;
        if (d < bd) { bd = d; best = n.id; }
      });
      if (best) setFocus(best); else say('Nincs több csomópont ebben az irányban');
    }

    // ---------- keyboard ----------
    var DIRS = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] };
    function onKey(e) {
      if (e.target !== el || e.altKey) return;
      var mod = e.ctrlKey || e.metaKey, k = e.key;
      if (DIRS[k]) {
        if (e.shiftKey || mod) return;                       // Shift+Arrow = region hop
        e.preventDefault();
        if (focusId) moveFocus(DIRS[k]); else panBy(-DIRS[k][0] * 48, -DIRS[k][1] * 48);
        return;
      }
      if (mod && (k === 'a' || k === 'A')) { e.preventDefault(); select(visibleNodes().map(function (n) { return n.id; })); say(sel.length + ' csomópont kijelölve'); return; }
      if (mod) return;
      switch (k) {
        case '+': case '=': e.preventDefault(); zoomBy(1.25); break;
        case '-': case '_': e.preventDefault(); zoomBy(0.8); break;
        case '0': e.preventDefault(); fit(); say('Illesztve'); break;
        case 'Home': e.preventDefault(); var f = visibleNodes()[0]; if (f) setFocus(f.id); break;
        case 'Enter':
          e.preventDefault();
          if (focusId) em.emit('open', { id: focusId, node: byId[focusId] });
          else { var nc = nearestCenter(); if (nc) setFocus(nc); }
          break;
        case ' ': case 'Spacebar':
          e.preventDefault();
          if (focusId) { select([focusId], { toggle: true }); say((byId[focusId].label || focusId) + (sel.indexOf(focusId) >= 0 ? ' kijelölve' : ' kijelölés megszüntetve')); }
          break;
        case 'F2': if (focusId) { e.preventDefault(); em.emit('rename', { id: focusId, node: byId[focusId] }); } break;
        case 'Delete': case 'Backspace':
          if (VK.actions && VK.actions.get('graph.delete')) {
            e.preventDefault();
            var ids = sel.length ? sel.slice() : focusId ? [focusId] : [];
            if (ids.length) VK.actions.run('graph.delete', VK.actions.ctx({ graph: inst, ids: ids }), 'key');
          }
          break;
        case 'Escape':
          if (sel.length) { e.preventDefault(); select([]); say('Kijelölés törölve'); }
          else if (focusId) { e.preventDefault(); setFocus(null, false); say('Vászon: a nyilak a nézetet mozgatják'); }
          break;
      }
    }
    function onFocus(e) {
      if (e.target !== el) return;
      if (focusId) applyFocus(true);
      else say('Gráf, ' + visibleNodes().length + ' csomópont, ' + edgeInfo.filter(function (I) { return !edgeHidden(I.e); }).length + ' kapcsolat. Enter: csomópont fókusz.');
    }

    // ---------- pointer ----------
    var drag = null;
    function local(e) { var r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    function onDown(e) {
      if (e.button !== 0 || (e.target.closest && e.target.closest('.vk-graph__badge'))) return;
      var p = local(e), nodeG = e.target.closest && e.target.closest('.vk-graph__node');
      drag = { id: e.pointerId, sx: p.x, sy: p.y, lx: p.x, ly: p.y, moved: false, node: nodeG ? nodeG.getAttribute('data-id') : null,
        mode: !nodeG && e.shiftKey ? 'box' : 'pan', ctrl: e.ctrlKey || e.metaKey };
      try { el.setPointerCapture(e.pointerId); } catch (x) { /* synthetic */ }
      el.focus({ preventScroll: true });
    }
    function onMove(e) {
      if (!drag || e.pointerId !== drag.id) return;
      var p = local(e);
      if (!drag.moved && Math.hypot(p.x - drag.sx, p.y - drag.sy) > 3) { drag.moved = true; el.dataset.dragging = drag.mode; }
      if (!drag.moved) return;
      if (drag.mode === 'pan') { panBy(p.x - drag.lx, p.y - drag.ly); }
      else {
        marquee.hidden = false;
        marquee.style.left = Math.min(p.x, drag.sx) + 'px'; marquee.style.top = Math.min(p.y, drag.sy) + 'px';
        marquee.style.width = Math.abs(p.x - drag.sx) + 'px'; marquee.style.height = Math.abs(p.y - drag.sy) + 'px';
      }
      drag.lx = p.x; drag.ly = p.y;
    }
    function onUp(e) {
      if (!drag || e.pointerId !== drag.id) return;
      var d = drag, p = local(e); drag = null; delete el.dataset.dragging;
      if (d.mode === 'box' && d.moved) {
        marquee.hidden = true;
        var x0 = Math.min(p.x, d.sx), x1 = Math.max(p.x, d.sx), y0 = Math.min(p.y, d.sy), y1 = Math.max(p.y, d.sy);
        var ids = visibleNodes().filter(function (n) { var s = screenOf(n.id); return s.x >= x0 && s.x <= x1 && s.y >= y0 && s.y <= y1; }).map(function (n) { return n.id; });
        select(ids, { add: d.ctrl });
        say(sel.length + ' csomópont kijelölve');
        return;
      }
      if (d.moved) return;
      if (d.node) { select([d.node], d.ctrl ? { toggle: true } : {}); setFocus(d.node); }
      else if (sel.length) select([]);
    }
    function onWheel(e) {
      e.preventDefault();
      var p = local(e), dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
      zoomBy(Math.exp(-dy * 0.0015), p.x, p.y);
    }
    function onDbl(e) { var n = e.target.closest && e.target.closest('.vk-graph__node'); if (n) em.emit('open', { id: n.getAttribute('data-id'), node: byId[n.getAttribute('data-id')] }); }

    el.addEventListener('keydown', onKey);
    el.addEventListener('focus', onFocus);
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('dblclick', onDbl);
    var lastSize = null;
    var ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(function () {
      var s = size();
      if (!fitted) { fit(); return; }
      if (lastSize) { view.x += (s.w - lastSize.w) / 2; view.y += (s.h - lastSize.h) / 2; }
      lastSize = s; applyView();
    }) : null;
    if (ro) ro.observe(el);

    // ---------- public ----------
    function setData(d) {
      d = d || {};
      ['nodes', 'edges', 'frames', 'layers'].forEach(function (k) { if (d[k]) data[k] = d[k].slice(); });
      if (d.layers) d.layers.forEach(function (l) { if (l.visible === false) hidden[l.id] = true; });
      if (d.projection) proj = d.projection === 'iso' ? 'iso' : 'flat';
      render();
      if (!fitted) fit();
    }
    function setLayerVisible(id, on) {
      if (on) delete hidden[id]; else hidden[id] = true;
      applyHidden();
      if (focusId && nodeHidden(byId[focusId])) setFocus(null, false);
      em.emit('layer', { id: id, visible: !!on });
    }
    function model() {
      return {
        bounds: bbox && { x0: bbox.x0, y0: bbox.y0, x1: bbox.x1, y1: bbox.y1 },
        frames: frameInfo.slice(),
        edges: edgeInfo.map(function (I) { return { d: I.d, layer: I.e.layer, token: layerToken(layerOf(I.e.layer) || { id: I.e.layer }, layerIndex(I.e.layer)), planned: !!I.e.planned, active: !!I.e.active, hidden: edgeHidden(I.e) }; }),
        nodes: data.nodes.map(function (n) {
          var G = geo[n.id], cs = shapeCorners(G, 0).map(function (q) { return P(q[0], q[1]); });
          var xs = cs.map(function (p) { return p[0]; }), ys = cs.map(function (p) { return p[1]; });
          return { id: n.id, kind: G.kind, x: G.sx, y: G.sy, x0: Math.min.apply(null, xs), y0: Math.min.apply(null, ys) - (G.ext || 0), x1: Math.max.apply(null, xs), y1: Math.max.apply(null, ys),
            selected: sel.indexOf(n.id) >= 0, focused: n.id === focusId, hidden: nodeHidden(n), hub: !!n.hub };
        })
      };
    }

    // layer legend: one toggle MINI per layer (pressed = shown); one tab stop, arrows move
    function legend(box) {
      box.classList.add('vk-graph-legend');
      box.setAttribute('role', 'toolbar'); box.setAttribute('aria-label', 'Vezetékrétegek');
      var minis = {}, rov = null;
      function build() {
        box.textContent = ''; minis = {};
        data.layers.forEach(function (l, i) {
          var item = VK.el('span.vk-graph-legend__item', { style: '--_lc: var(' + layerToken(l, i) + ')', 'data-planned': l.planned ? '' : null });
          var m = VK.mini.create({ icon: l.icon || 'cable', label: 'Réteg: ' + l.name, size: 'sm', pressed: !hidden[l.id],
            onClick: function () { setLayerVisible(l.id, !!hidden[l.id]); } });
          minis[l.id] = m;
          item.appendChild(m);
          item.appendChild(VK.el('span.vk-graph-legend__swatch', { 'aria-hidden': 'true' }));
          item.appendChild(VK.el('span.vk-graph-legend__name', { text: l.name }));
          box.appendChild(item);
        });
        sync();
        if (rov) rov.destroy();
        if (VK.focus) rov = VK.focus.roving(box, { items: '.vk-mini', orientation: 'horizontal', typeahead: false });
      }
      function sync() {
        data.layers.forEach(function (l) {
          var m = minis[l.id]; if (!m) return; var on = !hidden[l.id];
          VK.mini.set(m, { pressed: on, state: on ? 'idle' : 'off' });
          m.setAttribute('aria-label', 'Réteg: ' + l.name + (on ? ' — látható' : ' — rejtett'));
          m.title = l.name + (on ? ' — látható' : ' — rejtett');
          var item = m.parentNode; if (on) item.removeAttribute('data-off'); else item.setAttribute('data-off', '');
        });
      }
      build();
      var off1 = em.on('layer', sync), off2 = em.on('data', function () { if (Object.keys(minis).length !== data.layers.length) build(); else sync(); });
      return { update: build, destroy: function () { off1(); off2(); if (rov) rov.destroy(); box.textContent = ''; } };
    }

    function destroy() {
      if (ro) ro.disconnect();
      el.removeEventListener('keydown', onKey); el.removeEventListener('focus', onFocus);
      el.removeEventListener('pointerdown', onDown); el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp); el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('wheel', onWheel); el.removeEventListener('dblclick', onDbl);
      el.textContent = ''; el.classList.remove('vk-graph');
      ['role', 'aria-roledescription', 'aria-label', 'aria-describedby', 'aria-activedescendant', 'tabindex', 'data-projection'].forEach(function (a) { el.removeAttribute(a); });
    }

    var inst = {
      el: el, setData: setData, select: select, selection: function () { return sel.slice(); },
      focusNode: function (id) { setFocus(id); }, focused: function () { return focusId; },
      fit: function (pad) { fit(pad); }, zoomTo: zoomTo, zoomBy: zoomBy, panBy: panBy, centerOn: centerOn,
      getView: function () { var s = size(); return { x: view.x, y: view.y, k: view.k, w: s.w, h: s.h }; },
      setView: function (v) { if (v.k) view.k = VK.clamp(v.k, MIN_K, MAX_K); if (v.x != null) view.x = v.x; if (v.y != null) view.y = v.y; fitted = true; applyView(); },
      setLayerVisible: setLayerVisible, isLayerVisible: function (id) { return !hidden[id]; },
      layers: function () { return data.layers.map(function (l) { return { id: l.id, name: l.name, visible: !hidden[l.id] }; }); },
      setProjection: function (p) { proj = p === 'iso' ? 'iso' : 'flat'; render(); fit(); },
      projection: function () { return proj; },
      data: function () { return { nodes: data.nodes.slice(), edges: data.edges.slice(), frames: data.frames.slice(), layers: data.layers.slice() }; },
      node: function (id) { return byId[id] || null; },
      bounds: function () { return bbox && { x0: bbox.x0, y0: bbox.y0, x1: bbox.x1, y1: bbox.y1 }; },
      model: model, legend: legend, on: em.on, destroy: destroy
    };
    setData(opts);
    return inst;
  }

  VK.graph = { mount: mount };
})(typeof window !== 'undefined' ? window : globalThis);
