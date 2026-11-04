/* VRG UI Kit — components/citymap.js — a generative city map on <canvas>.
     var m = VK.citymap.mount(el, {style:'figure', seed:'2611', data:null, grow:true, commits:48, label:'Kódváros'})
     m.setStyle('transit') · m.reseed('0412') · m.play() · m.pause() · m.step() · m.fit() · m.setData(rows) · m.destroy()
   Source: a seed alone, OR data rows [{name, size, heat, group}] (e.g. git files: size = lines, heat = recent
   commits) — the biggest rows take the lots nearest the core, each group gets its own sector.
   Styles:
     figure   figure-ground: dark ground, footprints filled warm by heat (--vk-heat-*), hairline jittered street
              grid, smooth arterials, a dotted rail line, a hatched river band
     transit  workflow view: sand-paper ground derived from theme tokens, heavy octilinear pipelines, long-shadow
              modules, ring hubs (stations / merges), vehicles moving along the roads (jobs in flight)
     iso      pale monochrome extruded blocks with warm glowing streets at ground level
   Organic buildup: a dense core of tall blocks thinning outward, grown one commit per step. The toolbar renders
   the registry surface 'toolbar:citymap' as MINIs (play/pause shows growth progress). Reduced motion → the final
   frame and still vehicles.
   Keyboard (canvas is focusable): arrows pan · + / − zoom · 0 fit · Space play/pause · R reseed ·
   Shift+Arrow is left to region hopping. Redraws on document 'vk:theme' and on resize.
   Registry actions (registered on first mount; they act on ctx.citymap or the last-used map):
     citymap.play · citymap.step · citymap.reseed · citymap.zoom-in · citymap.zoom-out · citymap.fit  (toolbar:citymap, palette)
     citymap.style.figure · citymap.style.transit · citymap.style.iso                              (palette, menu:citymap)
   Fires 'vk:citymap' on el with {built, total, commit, commits, playing, style, seed} after every change.
   Depends on: core.js, focus.js, actions.js, mini.js. Icons: play pause step refresh zoom-in zoom-out fit. */
(function (root) {
  'use strict';
  var VK = root.VK = root.VK || {};
  if (VK.citymap) return;

  var W = 1000, H = 700;
  var STYLE_HU = { figure: 'figura–alap', transit: 'folyamat', iso: 'izometrikus' };
  var instances = [], active = null, registered = false;

  // ---------------- colour helpers (token strings → rgb arrays → css) ----------------
  var cc = null;
  function rgb(v) {
    if (!cc) cc = document.createElement('canvas').getContext('2d');
    cc.fillStyle = 'transparent';
    try { cc.fillStyle = v || 'transparent'; } catch (e) { /* keep transparent */ }
    var s = String(cc.fillStyle);
    if (s.charAt(0) === '#') return [parseInt(s.substr(1, 2), 16), parseInt(s.substr(3, 2), 16), parseInt(s.substr(5, 2), 16), 1];
    var m = s.match(/[\d.]+/g) || [];
    return [+m[0] || 0, +m[1] || 0, +m[2] || 0, m[3] == null ? 1 : +m[3]];
  }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, 1]; }
  function flat(c, under) { return c[3] >= 1 ? c : mix(under, c, c[3]); }
  function css(c, alpha) { var a = alpha == null ? (c[3] == null ? 1 : c[3]) : alpha; return 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' + a + ')'; }
  function lum(c) { return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255; }
  function palette(el) {
    function t(n) { return rgb(VK.token(n, el) || VK.token(n)); }
    var p = { bg: t('--vk-bg'), sunken: t('--vk-bg-sunken'), s1: t('--vk-surface-1'), s2: t('--vk-surface-2'), s3: t('--vk-surface-3'),
      text: t('--vk-text'), muted: t('--vk-text-muted'), faint: t('--vk-text-faint'), line: t('--vk-line'), lineS: t('--vk-line-strong'),
      accent: t('--vk-accent'), activity: t('--vk-activity'),
      heat: [t('--vk-heat-0'), t('--vk-heat-1'), t('--vk-heat-2'), t('--vk-heat-3'), t('--vk-heat-4')] };
    p.light = lum(p.bg) > 0.5;
    p.paper = lum(p.text) > lum(p.s2) ? p.text : p.s2;   // the lighter of ink and sheet
    p.ink = p.paper === p.text ? p.sunken : p.text;       // the darker
    p.line = flat(p.line, p.sunken); p.lineS = flat(p.lineS, p.sunken);
    p.font = VK.token('--vk-font-mono', el) || 'monospace';
    return p;
  }
  function heatColour(p, h) {
    h = VK.clamp(h, 0, 1) * 3; var k = Math.min(2, Math.floor(h));
    return mix(p.heat[1 + k], p.heat[2 + k], h - k);
  }

  // ---------------- geometry helpers ----------------
  function dSeg(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy, t = l ? ((px - ax) * dx + (py - ay) * dy) / l : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t; var x = ax + t * dx - px, y = ay + t * dy - py; return Math.sqrt(x * x + y * y);
  }
  function dPoly(px, py, poly) { var m = Infinity; for (var i = 1; i < poly.length; i++) { var d = dSeg(px, py, poly[i - 1][0], poly[i - 1][1], poly[i][0], poly[i][1]); if (d < m) m = d; } return m; }
  function bez(p0, p1, p2, p3, n) {
    var out = [];
    for (var i = 0; i <= n; i++) { var t = i / n, u = 1 - t;
      out.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]); }
    return out;
  }
  function edgePoint(r, side) {   // a point just outside the world on a given side (0 top, 1 right, 2 bottom, 3 left)
    var m = 60;
    if (side === 0) return [W * (0.1 + 0.8 * r()), -m];
    if (side === 1) return [W + m, H * (0.1 + 0.8 * r())];
    if (side === 2) return [W * (0.1 + 0.8 * r()), H + m];
    return [-m, H * (0.1 + 0.8 * r())];
  }
  function polyLen(pl) { var L = [0]; for (var i = 1; i < pl.length; i++) L.push(L[i - 1] + Math.hypot(pl[i][0] - pl[i - 1][0], pl[i][1] - pl[i - 1][1])); return L; }
  function at(pl, L, s) {
    s = ((s % L[L.length - 1]) + L[L.length - 1]) % L[L.length - 1];
    var i = 1; while (i < L.length - 1 && L[i] < s) i++;
    var t = (s - L[i - 1]) / ((L[i] - L[i - 1]) || 1), a = pl[i - 1], b = pl[i];
    return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, a: Math.atan2(b[1] - a[1], b[0] - a[0]) };
  }

  // ---------------- the model ----------------
  function generate(seed, data) {
    var r = VK.rng('citymap:' + seed);
    var core = [W * (0.38 + 0.24 * r()), H * (0.38 + 0.24 * r())], R = 300 + r() * 70;
    var M = { seed: seed, core: core, R: R, blocks: [], lots: [], hubs: [], roads: [] };

    // river: a wandering band that passes beside the core
    var horiz = r() < 0.5, off = (r() < 0.5 ? -1 : 1) * (R * (0.55 + r() * 0.3));
    var a1 = 20 + r() * 40, f1 = 0.004 + r() * 0.004, ph1 = r() * 6.28, a2 = 8 + r() * 14, f2 = 0.011 + r() * 0.01, ph2 = r() * 6.28;
    M.river = []; M.riverW = 30 + r() * 16;
    for (var s = -60; s <= (horiz ? W : H) + 60; s += 14) {
      var w = off + a1 * Math.sin(s * f1 + ph1) + a2 * Math.sin(s * f2 + ph2);
      M.river.push(horiz ? [s, core[1] + w] : [core[0] + w, s]);
    }
    // arterials: two smooth curves through the core's neighbourhood
    M.arterials = [];
    var sideA = Math.floor(r() * 4);
    [[sideA, (sideA + 2) % 4], [(sideA + 1) % 4, (sideA + 3) % 4]].forEach(function (sd, k) {
      if (k === 1 && r() < 0.25) return;
      var p0 = edgePoint(r, sd[0]), p3 = edgePoint(r, sd[1]);
      var c1 = [core[0] + (r() - 0.5) * 160, core[1] + (r() - 0.5) * 160], c2 = [core[0] + (r() - 0.5) * 220, core[1] + (r() - 0.5) * 220];
      M.arterials.push(bez(p0, c1, c2, p3, 48));
    });
    // rail: a long sweep at a distance from the core
    var rs = Math.floor(r() * 4), rp0 = edgePoint(r, rs), rp3 = edgePoint(r, (rs + 1 + Math.floor(r() * 2)) % 4);
    var ang = r() * 6.28, rc = [core[0] + Math.cos(ang) * R * 0.45, core[1] + Math.sin(ang) * R * 0.45];
    M.rail = bez(rp0, [rc[0] + (r() - 0.5) * 200, rc[1] + (r() - 0.5) * 200], [rc[0] + (r() - 0.5) * 200, rc[1] + (r() - 0.5) * 200], rp3, 48);

    // jittered street grid in a slightly rotated frame
    var th = (r() - 0.5) * 0.5, cos = Math.cos(th), sin = Math.sin(th);
    M.th = th;
    function toW(u, v) { return [core[0] + u * cos - v * sin, core[1] + u * sin + v * cos]; }
    function lines() {
      var arr = [0], x = 0;
      while (x < 900) { x += (30 + r() * 30) * (0.8 + 0.6 * Math.min(1, x / 600)); arr.push(x); }
      x = 0; while (x > -900) { x -= (30 + r() * 30) * (0.8 + 0.6 * Math.min(1, -x / 600)); arr.unshift(x); }
      return arr;
    }
    var us = lines(), vs = lines(), SW = 3.2;
    var ph3 = r() * 6.28, ph4 = r() * 6.28;
    for (var iu = 0; iu < us.length - 1; iu++) for (var iv = 0; iv < vs.length - 1; iv++) {
      var u0 = us[iu], u1 = us[iu + 1], v0 = vs[iv], v1 = vs[iv + 1];
      var bc = toW((u0 + u1) / 2, (v0 + v1) / 2);
      if (bc[0] < -40 || bc[0] > W + 40 || bc[1] < -40 || bc[1] > H + 40) continue;
      var block = { q: [toW(u0, v0), toW(u1, v0), toW(u1, v1), toW(u0, v1)], used: false };
      var bi = M.blocks.push(block) - 1;
      split(u0 + SW, v0 + SW, u1 - SW, v1 - SW, 0, bi);
    }
    function split(a, b, c, d, depth, bi) {
      var w = c - a, h = d - b; if (w < 5 || h < 5) return;
      var mid = toW((a + c) / 2, (b + d) / 2), dist = Math.hypot(mid[0] - core[0], mid[1] - core[1]) / R;
      var max = 13 + 16 * Math.min(1.4, dist);
      if ((w > max || h > max) && depth < 6) {
        var t = 0.35 + r() * 0.3;
        if (w >= h) { var x = a + w * t; split(a, b, x, d, depth + 1, bi); split(x, b, c, d, depth + 1, bi); }
        else { var y = b + h * t; split(a, b, c, y, depth + 1, bi); split(a, y, c, d, depth + 1, bi); }
        return;
      }
      lot(a, b, c, d, mid, dist, bi);
    }
    function lot(a, b, c, d, mid, dist, bi) {
      var ins = 1.1 + (dist > 0.8 ? r() * 2.5 : 0);
      a += ins; b += ins; c -= ins; d -= ins; if (c - a < 3 || d - b < 3) return;
      var q = [toW(a, b), toW(c, b), toW(c, d), toW(a, d)];
      for (var k = 0; k < 4; k++) if (q[k][0] < 6 || q[k][0] > W - 6 || q[k][1] < 6 || q[k][1] > H - 6) return;
      if (dPoly(mid[0], mid[1], M.river) < M.riverW / 2 + 5) return;
      for (var k2 = 0; k2 < M.arterials.length; k2++) if (dPoly(mid[0], mid[1], M.arterials[k2]) < 8) return;
      if (dPoly(mid[0], mid[1], M.rail) < 6) return;
      var field = 0.5 + 0.5 * Math.sin(mid[0] * 0.013 + ph3) * Math.sin(mid[1] * 0.011 + ph4);
      var keep = dist < 0.3 ? 0.97 : VK.clamp(1.2 - 0.9 * dist, 0.03, 0.95) * (0.7 + 0.6 * field);
      var rr = r(), rh = r(), rk = r(), rq = r();
      if (!data && rr > keep) return;
      M.lots.push({ q: q, cx: mid[0], cy: mid[1], dist: dist, block: bi, key: dist + 0.22 * rk,
        h: 5 + 125 * Math.exp(-Math.pow(dist / 0.5, 2)) * (0.3 + 0.7 * rh) + rq * 9,
        heat: VK.clamp(Math.pow(r(), 2.2) * (1.15 - 0.55 * Math.min(dist, 1.6)), 0, 1),
        ang: Math.atan2(mid[1] - core[1], mid[0] - core[0]), keep: rr <= keep });
    }

    var bld;
    if (data && data.length) bld = fromData(M, data, r);
    else bld = M.lots.sort(function (x, y) { return x.key - y.key; });
    bld.forEach(function (b) { M.blocks[b.block].used = true; });
    M.buildings = bld;
    transit(M, r);
    return M;
  }

  function fromData(M, data, r) {
    var rows = data.slice().filter(function (d) { return d && (+d.size || 0) >= 0; });
    var maxS = 1, maxH = 0;
    rows.forEach(function (d) { maxS = Math.max(maxS, +d.size || 0); maxH = Math.max(maxH, +d.heat || 0); });
    var groups = {}, order = [];
    rows.forEach(function (d) { var g = d.group || '—'; if (!groups[g]) { groups[g] = []; order.push(g); } groups[g].push(d); });
    // the densest lots first (prefer lots the seed would have built)
    var pool = M.lots.slice().sort(function (x, y) { return (x.key + (x.keep ? 0 : 0.6)) - (y.key + (y.keep ? 0 : 0.6)); }).slice(0, Math.max(rows.length * 2, 40));
    var taken = new Set(), out = [], a0 = -Math.PI + r() * 0.5, total = rows.length;
    order.forEach(function (g) {
      var list = groups[g].sort(function (x, y) { return (+y.size || 0) - (+x.size || 0); });
      var a1 = a0 + list.length / total * Math.PI * 2;
      var inSector = pool.filter(function (l) { if (taken.has(l)) return false; var a = l.ang; while (a < a0) a += Math.PI * 2; return a < a1; });
      list.forEach(function (d) {
        var l = inSector.find(function (x) { return !taken.has(x); }) || pool.find(function (x) { return !taken.has(x); });
        if (!l) return;
        taken.add(l);
        var b = Object.assign({}, l);
        b.name = String(d.name || ''); b.group = g; b.size = +d.size || 0; b.rawHeat = +d.heat || 0;
        b.h = 6 + 130 * Math.pow(Math.log((+d.size || 0) + 1) / Math.log(maxS + 1), 1.6);
        b.heat = maxH ? (+d.heat || 0) / maxH : 0;
        out.push(b);
      });
      a0 = a1;
    });
    M.groups = order; M.dropped = rows.length - out.length;
    return out.sort(function (x, y) { return x.key - y.key; });
  }

  // octilinear pipelines between hubs (stations / merges)
  function transit(M, r) {
    var core = M.core, hubs = [{ x: core[0], y: core[1], name: M.groups ? M.groups[0] : 'MAG' }];
    var n = M.groups ? Math.min(7, Math.max(3, M.groups.length)) : 4 + Math.floor(r() * 3);
    var a0 = r() * 6.28;
    for (var k = 1; k < n; k++) {
      var a = a0 + k / n * 6.28 + (r() - 0.5) * 0.5, d = M.R * (0.45 + r() * 0.55);
      var x = VK.clamp(core[0] + Math.cos(a) * d, 50, W - 50), y = VK.clamp(core[1] + Math.sin(a) * d, 50, H - 50);
      hubs.push({ x: x, y: y, name: M.groups && M.groups[k] ? M.groups[k] : 'ÁLLOMÁS ' + String(k).padStart(2, '0') });
    }
    function octi(A, B) {
      var dx = B.x - A.x, dy = B.y - A.y, ax = Math.abs(dx), ay = Math.abs(dy), dg = Math.min(ax, ay), sx = Math.sign(dx), sy = Math.sign(dy);
      var mid = r() < 0.5
        ? (ax > ay ? [A.x + sx * (ax - dg), A.y] : [A.x, A.y + sy * (ay - dg)])
        : (ax > ay ? [A.x + sx * dg, A.y + sy * dg] : [A.x + sx * dg, A.y + sy * dg]);
      return [[A.x, A.y], mid, [B.x, B.y]];
    }
    var roads = [];
    for (var i = 1; i < hubs.length; i++) {
      var best = 0, bd = Infinity;
      for (var j = 0; j < i; j++) { var dd = Math.hypot(hubs[i].x - hubs[j].x, hubs[i].y - hubs[j].y); if (dd < bd) { bd = dd; best = j; } }
      roads.push(octi(hubs[best], hubs[i]));
    }
    // two inlets from the map edge: pipelines entering the system
    for (var e = 0; e < 2; e++) {
      var h = hubs[1 + Math.floor(r() * (hubs.length - 1))], side = Math.floor(r() * 4);
      var ep = side === 0 ? { x: h.x, y: -40 } : side === 1 ? { x: W + 40, y: h.y } : side === 2 ? { x: h.x, y: H + 40 } : { x: -40, y: h.y };
      roads.push([[ep.x, ep.y], [h.x, h.y]]);
    }
    M.hubs = hubs;
    M.roads = roads.map(function (pl) { return { pl: pl, L: polyLen(pl), cars: [] }; });
    M.roads.forEach(function (rd) {
      var nc = 1 + Math.floor(r() * 3);
      for (var c = 0; c < nc; c++) rd.cars.push({ s: r() * rd.L[rd.L.length - 1], v: 18 + r() * 30, dir: r() < 0.5 ? 1 : -1 });
    });
    M.buildings.forEach(function (b) {
      b.onRoad = M.roads.some(function (rd) { return dPoly(b.cx, b.cy, rd.pl) < 15; }) ||
        hubs.some(function (h) { return Math.hypot(b.cx - h.x, b.cy - h.y) < 24; });
    });
  }

  // ---------------- the component ----------------
  function mount(el, o) {
    o = Object.assign({ style: 'figure', seed: '2611', data: null, grow: false, commits: null, label: 'Városkép', stepMs: 110 }, o || {});
    if (!STYLE_HU[o.style]) o.style = 'figure';
    ensureActions();
    var inst = { el: el };
    var M = null, pal = null, built = 0, commit = 0, commits = 1, playing = false, view = { z: 1, px: 0, py: 0 };
    var raf = 0, lastStep = 0, lastT = 0, visible = true, dirty = true, focused = false;
    var hintId = VK.uid('vk-cm-hint');

    el.classList.add('vk-citymap');
    el.textContent = '';
    var stage = VK.el('div.vk-citymap__stage');
    var canvas = VK.el('canvas.vk-citymap__canvas', { tabindex: '0', role: 'img', 'aria-describedby': hintId });
    var hint = VK.el('p.vk-citymap__hint.vk-label', { id: hintId, text: 'Nyilak: mozgatás · + / −: nagyítás · 0: illesztés · Szóköz: lejátszás · R: új mag' });
    stage.appendChild(canvas); stage.appendChild(hint);
    var bar = VK.el('div.vk-citymap__bar', { role: 'toolbar', 'aria-label': o.label + ' — vezérlők' });
    var tools = VK.el('div.vk-citymap__tools');
    var readout = VK.el('p.vk-citymap__readout.vk-label');
    bar.appendChild(tools); bar.appendChild(readout);
    el.appendChild(stage); el.appendChild(bar);
    var g = canvas.getContext('2d');

    // toolbar from the registry
    var minis = [];
    function buildTools() {
      tools.textContent = ''; minis = [];
      VK.actions.forSurface('toolbar:citymap', { citymap: inst }, { all: true }).forEach(function (a) {
        var b = VK.mini.fromAction(a, { citymap: inst }); b.dataset.size = 'sm'; minis.push({ b: b, a: a }); tools.appendChild(b);
      });
      if (inst._rov) inst._rov.destroy();
      inst._rov = VK.focus.roving(tools, { orientation: 'horizontal', items: '.vk-mini', typeahead: false });
    }
    function refreshTools() {
      minis.forEach(function (m) {
        VK.mini.refresh(m.b, m.a, { citymap: inst });
        if (m.a.id === 'citymap.play') { var u = m.b.querySelector('use'); if (u) u.setAttribute('href', '#vk-i-' + (playing ? 'pause' : 'play')); }
      });
    }

    function rebuild() {
      M = generate(o.seed, o.data);
      var n = M.buildings.length;
      commits = Math.max(1, o.commits || VK.clamp(Math.round(n / 8), 12, 60));
      M.blocks.forEach(function (bl) { bl.born = Infinity; });
      M.buildings.forEach(function (b, k) { b.born = Math.floor(k * commits / Math.max(1, n)) + 1; var bl = M.blocks[b.block]; if (b.born < bl.born) bl.born = b.born; });
      if (o.grow && !VK.reducedMotion()) { commit = 0; built = 0; } else { commit = commits; built = n; }
      dirty = true;
    }
    function setCommit(c) {
      commit = VK.clamp(c, 0, commits);
      var n = M.buildings.length, k = 0; while (k < n && M.buildings[k].born <= commit) k++; built = k;
      dirty = true; changed();
    }
    function changed() {
      var n = M.buildings.length;
      canvas.setAttribute('aria-label', o.label + ', ' + STYLE_HU[o.style] + ' nézet, mag ' + o.seed + ': ' + built + ' / ' + n +
        (o.data ? ' tétel' + (M.groups ? ', ' + M.groups.length + ' csoport' : '') : ' épület') + ', ' + commit + ' / ' + commits + ' commit' + (playing ? ', épül' : '') + '.');
      readout.textContent = 'MAG ' + o.seed + ' · ' + built + '/' + n + ' · C ' + commit + '/' + commits;
      readout.title = STYLE_HU[o.style] + ' · ' + built + ' / ' + n + ' épület · ' + commit + ' / ' + commits + ' commit';
      refreshTools();
      VK.fire(el, 'citymap', inst.state());
      kick();
    }

    // ---------- drawing ----------
    function size() {
      var r = canvas.getBoundingClientRect(), dpr = root.devicePixelRatio || 1;
      var w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      return { w: r.width, h: r.height, dpr: dpr };
    }
    var ISO_C = Math.cos(Math.PI / 6), ISO_S = 0.5;
    function iso(x, y, z) { return [(x - y) * ISO_C, (x + y) * ISO_S - (z || 0)]; }
    function bounds() {   // fit to the city (all lots that will be built), not the empty world
      if (M.bb) return M.bb;
      var a = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }, b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
      function add(r, x, y) { if (x < r.x0) r.x0 = x; if (x > r.x1) r.x1 = x; if (y < r.y0) r.y0 = y; if (y > r.y1) r.y1 = y; }
      M.buildings.forEach(function (bd) { bd.q.forEach(function (q) {
        add(a, q[0], q[1]); var i0 = iso(q[0], q[1], 0), i1 = iso(q[0], q[1], bd.h * 0.55); add(b, i0[0], i0[1]); add(b, i1[0], i1[1]); }); });
      add(a, M.core[0], M.core[1]);
      var m = 40, hb = { x0: a.x0, y0: a.y0, x1: a.x1, y1: a.y1 };
      M.hubs.forEach(function (h) { add(hb, h.x, h.y); });
      function pad(r, k) { return { x0: Math.max(0, r.x0 - k), y0: Math.max(0, r.y0 - k), x1: Math.min(W, r.x1 + k), y1: Math.min(H, r.y1 + k) }; }
      var hubs = pad(hb, 60); a = pad(a, m);
      if (!isFinite(b.x0)) { var c = [iso(0, 0), iso(W, 0), iso(W, H), iso(0, H)]; b = { x0: c[3][0], x1: c[1][0], y0: c[0][1], y1: c[2][1] }; }
      b = { x0: b.x0 - 40, y0: b.y0 - 30, x1: b.x1 + 40, y1: b.y1 + 30 };
      M.bb = { flat: a, hubs: hubs, iso: b };
      return M.bb;
    }
    function frame(sz) {
      var b = o.style === 'iso' ? bounds().iso : o.style === 'transit' ? bounds().hubs : bounds().flat;
      var s = Math.min(sz.w / (b.x1 - b.x0), sz.h / (b.y1 - b.y0)) * view.z;
      var cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
      return { s: s, tx: sz.w / 2 + view.px - cx * s, ty: sz.h / 2 + view.py - cy * s };
    }
    function draw(dt) {
      if (!M) return;
      var sz = size(); if (!pal) pal = palette(el);
      var F = frame(sz), d = sz.dpr;
      g.setTransform(d, 0, 0, d, 0, 0);
      g.clearRect(0, 0, sz.w, sz.h);
      if (o.style === 'figure') drawFigure(F, sz, d);
      else if (o.style === 'transit') drawTransit(F, sz, d, dt);
      else drawIso(F, sz, d);
      if (focused) reticle(sz);
      dirty = false;
    }
    function world(F, d) { g.setTransform(d * F.s, 0, 0, d * F.s, d * F.tx, d * F.ty); }
    function path(pl) { g.beginPath(); g.moveTo(pl[0][0], pl[0][1]); for (var i = 1; i < pl.length; i++) g.lineTo(pl[i][0], pl[i][1]); }
    function quad(q) { g.beginPath(); g.moveTo(q[0][0], q[0][1]); g.lineTo(q[1][0], q[1][1]); g.lineTo(q[2][0], q[2][1]); g.lineTo(q[3][0], q[3][1]); g.closePath(); }
    function glowOf(b) { var age = commit - b.born; return built < M.buildings.length || playing ? Math.max(0, 1 - age / 6) : 0; }

    function riverHatch(F, ground, ink, px) {
      var rv = M.river, w = M.riverW;
      g.lineCap = 'round';
      g.strokeStyle = css(mix(ground, ink, 0.07)); g.lineWidth = w; path(rv); g.stroke();
      g.strokeStyle = css(mix(ground, ink, 0.32)); g.lineWidth = px * 0.9;
      var L = polyLen(rv), tot = L[L.length - 1];
      g.beginPath();
      for (var s = 0; s < tot; s += 6) {
        var p = at(rv, L, s), nx = -Math.sin(p.a), ny = Math.cos(p.a), tx = Math.cos(p.a), ty = Math.sin(p.a), hw = w / 2 - 2;
        g.moveTo(p.x + nx * hw - tx * 4, p.y + ny * hw - ty * 4); g.lineTo(p.x - nx * hw + tx * 4, p.y - ny * hw + ty * 4);
      }
      g.stroke();
      [1, -1].forEach(function (sg) {
        g.beginPath();
        for (var s2 = 0; s2 <= tot; s2 += 8) { var q = at(rv, L, Math.min(s2, tot - 0.01)), bx = q.x - Math.sin(q.a) * w / 2 * sg, by = q.y + Math.cos(q.a) * w / 2 * sg; if (s2 === 0) g.moveTo(bx, by); else g.lineTo(bx, by); }
        g.strokeStyle = css(mix(ground, ink, 0.45)); g.lineWidth = px; g.stroke();
      });
    }

    function drawFigure(F, sz, d) {
      var p = pal, ground = p.light ? p.sunken : p.sunken, px = 1 / F.s;
      g.fillStyle = css(ground); g.fillRect(0, 0, sz.w, sz.h);
      world(F, d);
      riverHatch(F, ground, p.text, px);
      // hairline streets around every used block
      g.strokeStyle = css(mix(ground, p.text, 0.16)); g.lineWidth = px * 0.8;
      M.blocks.forEach(function (b) { if (b.born <= commit) { quad(b.q); g.stroke(); } });
      // arterials
      g.lineCap = 'round'; g.lineJoin = 'round';
      M.arterials.forEach(function (a) { path(a); g.strokeStyle = css(mix(ground, p.text, 0.42)); g.lineWidth = Math.max(px * 2, 3.2); g.stroke(); });
      // rail: a dotted line on a thin bed
      path(M.rail); g.strokeStyle = css(mix(ground, p.text, 0.22)); g.lineWidth = px * 0.8; g.stroke();
      g.setLineDash([0.01, 6]); g.lineWidth = Math.max(px * 2.6, 2.6); g.strokeStyle = css(mix(ground, p.text, 0.7)); path(M.rail); g.stroke(); g.setLineDash([]);
      // footprints, warm by heat (recent commits glow brighter)
      for (var i = 0; i < built; i++) {
        var b = M.buildings[i], h = Math.max(b.heat * 0.85 + 0.08, glowOf(b));
        quad(b.q); g.fillStyle = css(heatColour(p, h)); g.fill();
      }
      // core marker: a small hollow diamond = the junction everything grows from
      var c = M.core, k = 7 * px;
      g.beginPath(); g.moveTo(c[0], c[1] - k); g.lineTo(c[0] + k, c[1]); g.lineTo(c[0], c[1] + k); g.lineTo(c[0] - k, c[1]); g.closePath();
      g.strokeStyle = css(p.text); g.lineWidth = px * 1.2; g.stroke();
    }

    var sandCache = { key: '', pat: null };
    function sand(p) {
      var key = p.s1.join() + p.activity.join() + p.text.join();
      if (sandCache.key === key) return sandCache.pat;
      var c = document.createElement('canvas'); c.width = c.height = 96;
      var x = c.getContext('2d'), r = VK.rng('sand');
      for (var i = 0; i < 420; i++) {
        x.fillStyle = css(r() < 0.6 ? p.ink : p.paper, 0.05 + r() * 0.07);
        x.fillRect(Math.floor(r() * 96), Math.floor(r() * 96), r() < 0.85 ? 1 : 2, 1);
      }
      sandCache = { key: key, pat: g.createPattern(c, 'repeat') };
      return sandCache.pat;
    }
    function roundedPath(pl, rad) {
      g.beginPath(); g.moveTo(pl[0][0], pl[0][1]);
      for (var i = 1; i < pl.length - 1; i++) g.arcTo(pl[i][0], pl[i][1], pl[i + 1][0], pl[i + 1][1], rad);
      g.lineTo(pl[pl.length - 1][0], pl[pl.length - 1][1]);
    }
    function drawTransit(F, sz, d, dt) {
      var p = pal, ground = mix(p.light ? p.s2 : p.s1, p.activity, p.light ? 0.1 : 0.07), px = 1 / F.s;
      g.fillStyle = css(ground); g.fillRect(0, 0, sz.w, sz.h);
      g.fillStyle = sand(p); g.fillRect(0, 0, sz.w, sz.h);
      world(F, d);
      // river, quietly
      g.lineCap = 'round'; g.strokeStyle = css(mix(ground, p.ink, 0.08)); g.lineWidth = M.riverW; path(M.river); g.stroke();
      // long shadows, then modules
      var shadow = mix(ground, p.ink, p.light ? 0.16 : 0.35), fill = p.light ? mix(ground, p.paper, 0.85) : mix(ground, p.paper, 0.34);
      var edge = p.light ? mix(ground, p.ink, 0.4) : mix(ground, p.paper, 0.5), dx = 0.62, dy = 0.48;
      g.fillStyle = css(shadow);
      for (var i = 0; i < built; i++) {
        var b = M.buildings[i]; if (b.onRoad) continue;
        var L = b.h * 0.45, q = b.q, sq = q.map(function (v) { return [v[0] + dx * L, v[1] + dy * L]; });
        for (var k = 0; k < 4; k++) { var n = (k + 1) % 4; g.beginPath(); g.moveTo(q[k][0], q[k][1]); g.lineTo(q[n][0], q[n][1]); g.lineTo(sq[n][0], sq[n][1]); g.lineTo(sq[k][0], sq[k][1]); g.closePath(); g.fill(); }
        quad(sq); g.fill();
      }
      g.lineWidth = px * 0.8;
      for (var j = 0; j < built; j++) {
        var bb = M.buildings[j]; if (bb.onRoad) continue;
        var hot = Math.max(bb.heat > 0.7 ? (bb.heat - 0.7) * 2 : 0, glowOf(bb));
        quad(bb.q); g.fillStyle = css(hot ? mix(fill, p.activity, hot * 0.75) : fill); g.fill(); g.strokeStyle = css(edge); g.stroke();
      }
      // pipelines (heavy octilinear roads with a dashed centre line)
      var road = p.light ? p.text : mix(p.sunken, p.text, 0.72), grow = built / Math.max(1, M.buildings.length);
      g.lineJoin = 'round'; g.lineCap = 'butt';
      M.roads.forEach(function (rd) { roundedPath(rd.pl, 26); g.strokeStyle = css(road); g.lineWidth = 11; g.stroke(); });
      M.roads.forEach(function (rd) { roundedPath(rd.pl, 26); g.strokeStyle = css(ground); g.lineWidth = 1.2; g.setLineDash([6, 7]); g.stroke(); g.setLineDash([]); });
      // vehicles = jobs / commits in flight (still under reduced motion)
      var move = !VK.reducedMotion() && dt > 0;
      M.roads.forEach(function (rd) {
        var cars = Math.max(1, Math.round(rd.cars.length * (0.35 + 0.65 * grow)));
        for (var c = 0; c < cars; c++) {
          var car = rd.cars[c]; if (move) car.s += car.v * car.dir * dt;
          var q = at(rd.pl, rd.L, car.s), off = car.dir * 2.6;
          g.save(); g.translate(q.x - Math.sin(q.a) * off, q.y + Math.cos(q.a) * off); g.rotate(q.a);
          g.fillStyle = css(p.activity); g.strokeStyle = css(road); g.lineWidth = 1;
          g.beginPath(); g.rect(-5, -2.3, 10, 4.6); g.fill(); g.stroke(); g.restore();
        }
      });
      // ring hubs: dark disc, light core
      var dark = lum(p.text) < lum(p.sunken) ? p.text : p.sunken, lite = dark === p.text ? p.s2 : p.text;
      g.font = '600 ' + Math.max(9, 10 * Math.min(1.4, F.s * 1.2)) / F.s + 'px ' + p.font;
      M.hubs.forEach(function (h, k) {
        g.beginPath(); g.arc(h.x, h.y, k === 0 ? 17 : 13, 0, 6.2832); g.fillStyle = css(dark); g.fill();
        g.lineWidth = 3; g.strokeStyle = css(road); g.stroke();
        g.beginPath(); g.arc(h.x, h.y, k === 0 ? 7 : 5, 0, 6.2832); g.fillStyle = css(lite); g.fill();
        g.fillStyle = css(p.light ? p.text : p.muted); g.textBaseline = 'middle';
        g.fillText(String(h.name).toUpperCase().slice(0, 18), h.x + (k === 0 ? 24 : 20), h.y - (k === 0 ? 20 : 16));
      });
    }

    function drawIso(F, sz, d) {
      var p = pal, ground = p.sunken, px = 1;
      g.fillStyle = css(ground); g.fillRect(0, 0, sz.w, sz.h);
      g.setTransform(d, 0, 0, d, 0, 0);
      function S(x, y, z) { var q = iso(x, y, z); return [q[0] * F.s + F.tx, q[1] * F.s + F.ty]; }
      function ppath(pl, z) { g.beginPath(); var a = S(pl[0][0], pl[0][1], z); g.moveTo(a[0], a[1]); for (var i = 1; i < pl.length; i++) { var b = S(pl[i][0], pl[i][1], z); g.lineTo(b[0], b[1]); } }
      // the ground sheet
      ppath([[0, 0], [W, 0], [W, H], [0, H]]); g.closePath(); g.fillStyle = css(mix(ground, p.text, 0.035)); g.fill();
      g.strokeStyle = css(p.lineS); g.lineWidth = px; g.stroke();
      // water with fine ripples
      g.lineCap = 'round'; g.lineJoin = 'round';
      ppath(M.river, 0); g.strokeStyle = css(mix(ground, p.text, 0.09)); g.lineWidth = M.riverW * F.s * 0.9; g.stroke();
      g.strokeStyle = css(mix(ground, p.text, 0.2)); g.lineWidth = 0.6;
      [-0.3, 0, 0.3].forEach(function (f) { ppath(M.river.map(function (q, i) { return [q[0] + f * M.riverW * Math.sin(i * 0.7), q[1] + f * M.riverW]; }), 0); g.setLineDash([3, 5]); g.stroke(); g.setLineDash([]); });
      // warm streets glowing at ground level
      var warm = p.activity, glow = !p.light;
      g.save();
      if (glow) { g.shadowColor = css(warm, 0.9); g.shadowBlur = 6 * Math.min(2, F.s * 1.5); }
      g.strokeStyle = css(warm, p.light ? 0.75 : 0.55); g.lineWidth = Math.max(0.6, 1.1 * F.s);
      M.blocks.forEach(function (b) { if (b.born <= commit) { ppath(b.q, 0); g.closePath(); g.stroke(); } });
      g.strokeStyle = css(warm, 0.95); g.lineWidth = Math.max(1.2, 3 * F.s);
      M.arterials.forEach(function (a) { ppath(a, 0); g.stroke(); });
      g.restore();
      ppath(M.rail, 0); g.setLineDash([1, 4]); g.strokeStyle = css(p.muted); g.lineWidth = Math.max(1, 1.6 * F.s); g.stroke(); g.setLineDash([]);
      // extruded blocks, back to front
      var top = mix(p.paper, p.ink, 0.04), left = mix(p.paper, p.ink, 0.2), right = mix(p.paper, p.ink, 0.38), edge = mix(p.paper, p.ink, p.light ? 0.5 : 0.62);
      var list = M.buildings.slice(0, built).sort(function (a, b) { return (a.cx + a.cy) - (b.cx + b.cy); });
      g.lineWidth = 0.6; g.strokeStyle = css(edge);
      list.forEach(function (b) {
        var q = b.q, h = b.h * 0.55, cx = b.cx, cy = b.cy;
        for (var k = 0; k < 4; k++) {
          var a = q[k], c = q[(k + 1) % 4], nx = c[1] - a[1], ny = -(c[0] - a[0]);
          if (nx * ((a[0] + c[0]) / 2 - cx) + ny * ((a[1] + c[1]) / 2 - cy) < 0) { nx = -nx; ny = -ny; }
          if (nx + ny <= 0) continue;
          var A0 = S(a[0], a[1], 0), C0 = S(c[0], c[1], 0), C1 = S(c[0], c[1], h), A1 = S(a[0], a[1], h);
          g.beginPath(); g.moveTo(A0[0], A0[1]); g.lineTo(C0[0], C0[1]); g.lineTo(C1[0], C1[1]); g.lineTo(A1[0], A1[1]); g.closePath();
          g.fillStyle = css(nx - ny > 0 ? right : left); g.fill(); g.stroke();
        }
        var t0 = S(q[0][0], q[0][1], h), t1 = S(q[1][0], q[1][1], h), t2 = S(q[2][0], q[2][1], h), t3 = S(q[3][0], q[3][1], h);
        g.beginPath(); g.moveTo(t0[0], t0[1]); g.lineTo(t1[0], t1[1]); g.lineTo(t2[0], t2[1]); g.lineTo(t3[0], t3[1]); g.closePath();
        var gl = glowOf(b);
        g.fillStyle = css(gl ? mix(top, p.activity, gl * 0.7) : top); g.fill(); g.stroke();
      });
    }
    function reticle(sz) {
      var x = sz.w / 2, y = sz.h / 2, c = pal.accent;
      g.strokeStyle = css(c); g.lineWidth = 1;
      g.beginPath(); g.moveTo(x - 14, y); g.lineTo(x - 5, y); g.moveTo(x + 5, y); g.lineTo(x + 14, y); g.moveTo(x, y - 14); g.lineTo(x, y - 5); g.moveTo(x, y + 5); g.lineTo(x, y + 14); g.stroke();
      g.beginPath(); g.arc(x, y, 9, 0, 6.2832); g.stroke();
    }

    // ---------- the loop (growth steps + vehicles), only while needed ----------
    function animating() { return o.style === 'transit' && !VK.reducedMotion() && visible && !document.hidden; }
    function kick() { if (!raf) raf = root.requestAnimationFrame(tick); }
    function tick(ts) {
      raf = 0;
      if (!el.isConnected) return;
      var dt = lastT ? Math.min(0.1, (ts - lastT) / 1000) : 0; lastT = ts;
      if (playing && ts - lastStep >= o.stepMs) {
        lastStep = ts;
        if (commit >= commits) { pause(); } else setCommit(commit + 1);
      }
      var anim = animating();
      if (dirty || anim) draw(anim ? dt : 0);
      if (playing || anim) raf = root.requestAnimationFrame(tick); else lastT = 0;
    }

    // ---------- public verbs ----------
    function play() {
      if (VK.reducedMotion()) { setCommit(commits); return inst; }
      if (commit >= commits) setCommit(0);
      playing = true; lastStep = 0; changed(); return inst;
    }
    function pause() { playing = false; changed(); return inst; }
    function toggle() { return playing ? pause() : play(); }
    function step() { if (playing) playing = false; if (commit >= commits) setCommit(0); else setCommit(commit + 1); return inst; }
    function reseed(seed) {
      o.seed = seed != null && seed !== '' ? String(seed) : String(Math.floor(Math.random() * 10000)).padStart(4, '0');
      var wasGrow = o.grow; rebuild(); changed();
      if (wasGrow && !VK.reducedMotion()) play();
      return inst;
    }
    function setStyle(s) { if (!STYLE_HU[s]) return inst; o.style = s; el.dataset.style = s; dirty = true; changed(); return inst; }
    function zoom(f) { var z = VK.clamp(view.z * f, 0.5, 6); f = z / view.z; view.z = z; view.px *= f; view.py *= f; dirty = true; kick(); return inst; }
    function pan(dx, dy) { view.px += dx; view.py += dy; dirty = true; kick(); return inst; }
    function fit() { view = { z: 1, px: 0, py: 0 }; dirty = true; kick(); return inst; }
    function setData(rows) { o.data = rows; rebuild(); changed(); return inst; }

    inst.play = play; inst.pause = pause; inst.toggle = toggle; inst.step = step; inst.reseed = reseed; inst.setStyle = setStyle;
    inst.zoom = zoom; inst.pan = pan; inst.fit = fit; inst.setData = setData;
    inst.state = function () { return { built: built, total: M ? M.buildings.length : 0, commit: commit, commits: commits, playing: playing, style: o.style, seed: o.seed, zoom: view.z, px: view.px, py: view.py }; };
    inst.progress = function () { return commits ? commit / commits : 1; };

    // ---------- input ----------
    function onKey(e) {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.shiftKey && /^Arrow/.test(e.key)) return;   // region hopping
      var k = e.key, step = 40;
      if (k === 'ArrowLeft') pan(step, 0); else if (k === 'ArrowRight') pan(-step, 0);
      else if (k === 'ArrowUp') pan(0, step); else if (k === 'ArrowDown') pan(0, -step);
      else if (k === '+' || k === '=' || k === 'Add') zoom(1.25); else if (k === '-' || k === '_' || k === 'Subtract') zoom(0.8);
      else if (k === '0' || k === 'Home') fit();
      else if (k === ' ' || k === 'Spacebar') toggle();
      else if (k === 'r' || k === 'R') reseed();
      else return;
      e.preventDefault();
    }
    var drag = null;
    function onDown(e) { if (e.button !== 0) return; drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); }
    function onMove(e) { if (!drag) return; pan(e.clientX - drag.x, e.clientY - drag.y); drag = { x: e.clientX, y: e.clientY }; }
    function onUp() { drag = null; }
    function onDbl(e) { e.preventDefault(); zoom(1.5); }
    function onFocus() { focused = true; dirty = true; kick(); }
    function onBlur() { focused = false; dirty = true; kick(); }
    function onAny() { active = inst; }
    function onTheme() { pal = null; dirty = true; kick(); }
    canvas.addEventListener('keydown', onKey);
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('dblclick', onDbl);
    canvas.addEventListener('focus', onFocus);
    canvas.addEventListener('blur', onBlur);
    el.addEventListener('focusin', onAny);
    el.addEventListener('pointerdown', onAny, true);
    document.addEventListener('vk:theme', onTheme);
    var ro = root.ResizeObserver ? new ResizeObserver(function () { dirty = true; kick(); }) : null;
    if (ro) ro.observe(stage);
    var io = root.IntersectionObserver ? new IntersectionObserver(function (es) { visible = es[es.length - 1].isIntersecting; kick(); }) : null;
    if (io) io.observe(stage);
    function onVis() { kick(); }
    document.addEventListener('visibilitychange', onVis);

    inst.destroy = function () {
      playing = false; if (raf) root.cancelAnimationFrame(raf); raf = 0;
      document.removeEventListener('vk:theme', onTheme); document.removeEventListener('visibilitychange', onVis);
      if (ro) ro.disconnect(); if (io) io.disconnect(); if (inst._rov) inst._rov.destroy();
      instances = instances.filter(function (x) { return x !== inst; }); if (active === inst) active = instances[0] || null;
      el.textContent = ''; el.classList.remove('vk-citymap');
    };

    el.dataset.style = o.style;
    instances.push(inst); if (!active) active = inst;
    rebuild();
    buildTools();
    changed();
    if (o.grow && !VK.reducedMotion()) play();
    return inst;
  }

  // ---------------- registry actions (lazy, once) ----------------
  function target(c) { var t = (c && c.citymap) || active; return t && t.el && t.el.isConnected ? t : null; }
  function ensureActions() {
    if (registered || !VK.actions) return; registered = true;
    var A = VK.actions;
    A.register({ id: 'citymap.play', label: 'Városkép: építkezés lejátszása / szünet', hint: 'Commitonként nő a város a magtól kifelé', group: 'Városkép',
      icon: 'play', caption: 'NŐ', at: ['toolbar:citymap', 'palette'], when: function (c) { return !!target(c); },
      progress: function (c) { var t = target(c); return t ? t.progress() : 0; },
      state: function (c) { var t = target(c); if (!t) return 'idle'; var s = t.state(); return s.playing ? 'running' : s.commit >= s.commits ? 'done' : s.commit > 0 ? 'paused' : 'idle'; },
      run: function (c) { var t = target(c); if (t) t.toggle(); } });
    A.register({ id: 'citymap.step', label: 'Városkép: egy commit előre', group: 'Városkép', icon: 'step', caption: 'LÉPÉS',
      at: ['toolbar:citymap', 'palette'], when: function (c) { return !!target(c); }, run: function (c) { var t = target(c); if (t) t.step(); } });
    A.register({ id: 'citymap.reseed', label: 'Városkép: új mag', hint: 'Új véletlen mag, újraépítés', group: 'Városkép', icon: 'refresh', caption: 'MAG',
      at: ['toolbar:citymap', 'palette'], when: function (c) { return !!target(c); }, run: function (c) { var t = target(c); if (t) t.reseed(); } });
    A.register({ id: 'citymap.zoom-in', label: 'Városkép: nagyítás', group: 'Városkép', icon: 'zoom-in', caption: '+',
      at: ['toolbar:citymap', 'palette'], when: function (c) { return !!target(c); }, run: function (c) { var t = target(c); if (t) t.zoom(1.25); } });
    A.register({ id: 'citymap.zoom-out', label: 'Városkép: kicsinyítés', group: 'Városkép', icon: 'zoom-out', caption: '−',
      at: ['toolbar:citymap', 'palette'], when: function (c) { return !!target(c); }, run: function (c) { var t = target(c); if (t) t.zoom(0.8); } });
    A.register({ id: 'citymap.fit', label: 'Városkép: illesztés', group: 'Városkép', icon: 'fit', caption: 'ILLESZT',
      at: ['toolbar:citymap', 'palette'], when: function (c) { return !!target(c); }, run: function (c) { var t = target(c); if (t) t.fit(); } });
    Object.keys(STYLE_HU).forEach(function (s) {
      A.register({ id: 'citymap.style.' + s, label: 'Városkép stílus: ' + STYLE_HU[s], group: 'Városkép', icon: s === 'iso' ? 'stack-iso' : s === 'transit' ? 'metro' : 'city',
        at: ['palette', 'menu:citymap'], when: function (c) { return !!target(c); },
        checked: function (c) { var t = target(c); return !!t && t.state().style === s; }, run: function (c) { var t = target(c); if (t) t.setStyle(s); } });
    });
  }

  VK.citymap = { mount: mount, styles: Object.keys(STYLE_HU), generate: generate, instances: function () { return instances.slice(); } };
})(typeof window !== 'undefined' ? window : globalThis);
