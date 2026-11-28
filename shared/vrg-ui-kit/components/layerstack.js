/* VRG UI Kit — components/layerstack.js — stacked isometric planes; dashed vertical "pillars" tie the same
   entity id across planes; warm "beacons" rise from entities with activity.
     var ls = VK.layerstack.mount(el, {
       label: 'Rétegköteg',
       planes:   [{id:'ui', name:'Felület', color:'--vk-layer-6'}],                 // first = top plane
       entities: [{id:'sw1', label:'Kapcsoló SW1', at:{net:{x:50, y:60}, dev:{x:50, y:60}},
                   beacon?: 0…1 | {planeId: 0…1}}],                                // x/y in 0…100 plane units
       links?:   [{plane:'net', from:'sw1', to:'gw'}] })                           // optional wires on one plane (metro L)
     → { setData(d), setVisible(planeId, on), solo(planeId | null), focus(planeId, entityId), highlight(entityId),
         light(map), tracer(key, ids, o), state(), on(type, fn), destroy() }
   Big stacks (Érintésnyom, ~2 000 nodes) — none of these redraws the scene, they change attributes of what is drawn:
     light(map)        map: {id: energy 0…1 | {e, kind: 'exact'|'inferred'|'forecast', write: true}} (or a Map). Lit nodes and
                       pillars get data-lit="exact|inferred|forecast" and --_e; write:true pulses the ring once. light(null) clears.
     tracer(key, ids, {label, style: 'solid'|'dotted'}) a line through the entities in order, its head on the last;
                       tracer(key, null) removes it.
     opts.labels       'current' (default: the current plane's labels) · 'lit' (the brightest lit nodes, opts.litLabels = 12) · 'none'
     opts.dimPillars   unlit pillars drawn faint (hundreds of pillars would hide the planes)
     opts.planeW/planeD/gap/tilt  plane size (120 × 66), the gap between planes (92) and the tilt (1 = isometric, < 1 flatter)
   Hover and blur no longer redraw either: the highlight is an attribute too.
   Events: focus {plane, entity} · open {plane, entity} · visibility {hidden:[ids], solo}.
   Keyboard: the stage is one tab stop — Up/Down: plane, Left/Right (Home/End): entity on the plane, S: solo the plane,
   H: hide the plane, Enter: open, Esc: end solo. The plane list is one tab stop (toolbar of MINIs, arrows move:
   eye = show/hide, 'solo' = solo). Hover or focus on an entity lights its pillar and its nodes on every plane (ice).
   Depends on: core.js, mini.js, focus.js. */
(function (root) {
  'use strict';
  var VK = root.VK = root.VK || {};
  if (VK.layerstack) return;

  var NS = 'http://www.w3.org/2000/svg';
  var IC = Math.cos(Math.PI / 6), W = 120, D = 66, S = 1.5, GAP = 92;
  function svg(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) if (attrs[k] != null && attrs[k] !== false) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function r1(v) { return Math.round(v * 10) / 10; }
  function P(x, y, i) { return [(x - y) * IC * S, (x + y) * 0.5 * S + i * GAP]; }
  function pts(arr) { return arr.map(function (p) { return r1(p[0]) + ',' + r1(p[1]); }).join(' '); }
  var LAYER_T = ['--vk-layer-1', '--vk-layer-2', '--vk-layer-3', '--vk-layer-4', '--vk-layer-5', '--vk-layer-6', '--vk-layer-7', '--vk-layer-8'];
  function tok(c, i) { return c ? (c.indexOf('--') === 0 ? c : '--vk-' + c) : LAYER_T[i % 8]; }
  function num(i) { return '[' + (i < 9 ? '0' : '') + (i + 1) + ']'; }

  function mount(el, opts) {
    opts = opts || {};
    // plane size, spacing and tilt per stack (a 9-plane stack of ~2 000 nodes wants wide, flat, close planes)
    var PW = +opts.planeW || W, PD = +opts.planeD || D, PG = +opts.gap || GAP, TL = +opts.tilt || 1;
    function P(x, y, i) { return [(x - y) * IC * S, (x + y) * 0.5 * S * TL + i * PG]; }
    var planes = [], ents = [], links = [];
    var hidden = {}, soloId = null, cur = { p: -1, e: null }, hl = null;
    var idx = {}, lit = new Map(), writes = 0, tracers = {};
    var em = VK.emitter(), uidp = VK.uid('vkls'), rov = null, minis = {};

    el.classList.add('vk-layerstack');
    el.textContent = '';
    var list = VK.el('div.vk-layerstack__list', { role: 'toolbar', 'aria-orientation': 'vertical', 'aria-label': 'Síkok: megjelenítés és szóló' });
    var stage = VK.el('div.vk-layerstack__stage', { role: 'application', 'aria-roledescription': 'rétegköteg', tabindex: '0',
      'aria-label': (opts.label || 'Rétegköteg') + '. Fel, le: sík. Balra, jobbra: elem. S: szóló. H: elrejtés. Enter: megnyitás.' });
    var sv = svg('svg', { class: 'vk-layerstack__svg', role: 'none', focusable: 'false' }, stage);
    var defs = svg('defs', null, sv);
    var grad = svg('linearGradient', { id: uidp + '-beam', x1: '0', y1: '1', x2: '0', y2: '0' }, defs);
    svg('stop', { offset: '0', class: 'vk-layerstack__beam-a' }, grad);
    svg('stop', { offset: '1', class: 'vk-layerstack__beam-b' }, grad);
    var gPlanes = svg('g', null, sv), gPillars = svg('g', null, sv), gLinks = svg('g', null, sv),
      gBeacons = svg('g', null, sv), gTracers = svg('g', null, sv), gNodes = svg('g', null, sv), gLabels = svg('g', null, sv),
      gLit = svg('g', null, sv), gHover = svg('g', null, sv);
    var labelMode = opts.labels || 'current';
    if (opts.dimPillars) el.setAttribute('data-dim-pillars', '');
    var readout = VK.el('p.vk-layerstack__readout.vk-label', { role: 'status', 'aria-live': 'polite' });
    stage.appendChild(readout);
    el.appendChild(list); el.appendChild(stage);

    function vis(id) { return soloId ? id === soloId : !hidden[id]; }
    function pIndex(id) { for (var i = 0; i < planes.length; i++) if (planes[i].id === id) return i; return -1; }
    function wpos(at) { return [VK.clamp(+at.x || 0, 0, 100) * PW / 100, VK.clamp(+at.y || 0, 0, 100) * PD / 100]; }
    function posOf(e, i) { var w = wpos(e.at[planes[i].id]); return P(w[0], w[1], i); }
    function entsOn(i) {
      if (i < 0 || !planes[i]) return [];
      return ents.filter(function (e) { return e.at && e.at[planes[i].id]; })
        .sort(function (a, b) { return posOf(a, i)[0] - posOf(b, i)[0] || posOf(a, i)[1] - posOf(b, i)[1]; });
    }
    function planesOf(e) { var r = []; planes.forEach(function (p, i) { if (e.at && e.at[p.id] && vis(p.id)) r.push(i); }); return r; }
    function nodeId(pi, eid) { return uidp + '-' + pi + '-' + String(eid).replace(/[^\w-]/g, '_'); }
    function beaconLevel(e, i) {
      if (e.beacon == null) return 0;
      if (typeof e.beacon === 'object') return +e.beacon[planes[i].id] || 0;
      var on = planesOf(e); return on[0] === i ? +e.beacon : 0;
    }

    /* the element index: entity id → its nodes, pillar segments, labels and positions (filled by draw) */
    function ix(id) { return idx[id] || (idx[id] = { nodes: [], pillars: [], labels: [], pos: [] }); }
    function draw() {
      [gPlanes, gPillars, gLinks, gBeacons, gTracers, gNodes, gLabels, gLit, gHover].forEach(function (g) { g.textContent = ''; });
      idx = {};
      var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      function ext(p) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
      for (var i = planes.length - 1; i >= 0; i--) {
        var pl = planes[i], on = vis(pl.id);
        var g = svg('g', { class: 'vk-layerstack__plane', 'data-plane': pl.id, 'data-state': on ? 'on' : 'ghost', 'data-current': i === cur.p ? '' : null,
          style: '--_pc: var(' + tok(pl.color, i) + ')' }, gPlanes);
        var c = [P(0, 0, i), P(PW, 0, i), P(PW, PD, i), P(0, PD, i)];
        c.forEach(ext);
        svg('polygon', { class: 'vk-layerstack__sheet', points: pts(c) }, g);
        if (on) {
          var d = '';
          for (var k = 1; k < 4; k++) {
            var a = P(PW * k / 4, 0, i), b = P(PW * k / 4, PD, i), e1 = P(0, PD * k / 4, i), e2 = P(PW, PD * k / 4, i);
            d += 'M' + r1(a[0]) + ' ' + r1(a[1]) + 'L' + r1(b[0]) + ' ' + r1(b[1]) + 'M' + r1(e1[0]) + ' ' + r1(e1[1]) + 'L' + r1(e2[0]) + ' ' + r1(e2[1]);
          }
          svg('path', { class: 'vk-layerstack__grid', d: d }, g);
        }
        var lp = c[3];
        var t = svg('text', { class: 'vk-layerstack__plabel', x: r1(lp[0] - 8), y: r1(lp[1] + 3), 'text-anchor': 'end' }, g);
        t.textContent = num(i) + ' ' + String(pl.name).toUpperCase() + (on ? '' : soloId ? ' · NÉMÍTVA' : ' · REJTETT');
        ext([lp[0] - 8 - t.textContent.length * 6.7, lp[1]]);
      }
      // pillars between consecutive visible planes
      ents.forEach(function (e) {
        var on = planesOf(e);
        for (var j = 0; j + 1 < on.length; j++) {
          var a = posOf(e, on[j]), b = posOf(e, on[j + 1]);
          ix(e.id).pillars.push(svg('line', { class: 'vk-layerstack__pillar', x1: r1(a[0]), y1: r1(a[1]), x2: r1(b[0]), y2: r1(b[1]), 'data-entity': e.id, 'data-hl': e.id === hl ? '' : null }, gPillars));
        }
      });
      // links on a plane: metro L along the plane axes
      links.forEach(function (l) {
        var i = pIndex(l.plane); if (i < 0 || !vis(l.plane)) return;
        var A = ents.filter(function (e) { return e.id === l.from; })[0], B = ents.filter(function (e) { return e.id === l.to; })[0];
        if (!A || !B || !A.at[l.plane] || !B.at[l.plane]) return;
        var a = wpos(A.at[l.plane]), b = wpos(B.at[l.plane]);
        var p = [P(a[0], a[1], i), P(b[0], a[1], i), P(b[0], b[1], i)];
        svg('polyline', { class: 'vk-layerstack__link', points: pts(p), 'data-planned': l.planned ? '' : null, style: '--_pc: var(' + tok(planes[i].color, i) + ')' }, gLinks);
      });
      // nodes, beacons, labels
      var labelPlane = cur.p >= 0 && vis(planes[cur.p].id) ? cur.p : planes.findIndex(function (p) { return vis(p.id); });
      planes.forEach(function (pl, i) {
        if (!vis(pl.id)) return;
        entsOn(i).forEach(function (e) {
          var p = posOf(e, i), lv = beaconLevel(e, i), isCur = i === cur.p && e.id === cur.e;
          if (lv > 0) {
            var h = 16 + lv * 60, bg = svg('g', { class: 'vk-layerstack__beacon', 'data-entity': e.id }, gBeacons);
            svg('ellipse', { class: 'vk-layerstack__beam-foot', cx: r1(p[0]), cy: r1(p[1]), rx: 11, ry: 6 }, bg);
            svg('rect', { class: 'vk-layerstack__beam', x: r1(p[0] - 5), y: r1(p[1] - h), width: 10, height: r1(h), fill: 'url(#' + uidp + '-beam)' }, bg);
            svg('line', { class: 'vk-layerstack__beam-core', x1: r1(p[0]), y1: r1(p[1] - 3), x2: r1(p[0]), y2: r1(p[1] - h) }, bg);
            ext([p[0], p[1] - h]);
          }
          var ng = svg('g', { class: 'vk-layerstack__node', id: nodeId(i, e.id), role: 'button', 'data-entity': e.id, 'data-plane': pl.id,
            'data-hl': e.id === hl ? '' : null, 'data-current': isCur ? '' : null, 'data-beacon': lv > 0 ? '' : null,
            style: '--_pc: var(' + tok(pl.color, i) + ')',
            'aria-label': e.label + ', ' + pl.name + ' sík, ' + planesOf(e).length + ' síkon' + (lv > 0 ? ', aktivitás ' + Math.round(lv * 100) + '%' : '') }, gNodes);
          ix(e.id).nodes.push(ng); ix(e.id).pos.push(p);
          svg('circle', { class: 'vk-layerstack__hit', cx: r1(p[0]), cy: r1(p[1]), r: 9 }, ng);
          svg('circle', { class: 'vk-layerstack__ring', cx: r1(p[0]), cy: r1(p[1]), r: 7.5 }, ng);
          svg('circle', { class: 'vk-layerstack__dot', cx: r1(p[0]), cy: r1(p[1]), r: 3.6 }, ng);
          if ((labelMode === 'current' && i === labelPlane) || e.id === hl) {
            var tx = svg('text', { class: 'vk-layerstack__elabel', x: r1(p[0] + 9), y: r1(p[1] - 6), 'data-entity': e.id, 'data-hl': e.id === hl ? '' : null }, gLabels);
            tx.textContent = e.label; ix(e.id).labels.push(tx);
            ext([p[0] + 9 + String(e.label).length * 5.4, p[1] - 14]);
          }
        });
      });
      if (x0 === Infinity) { x0 = y0 = 0; x1 = y1 = 100; }
      var pad = 10;
      sv.setAttribute('viewBox', [r1(x0 - pad), r1(y0 - pad), r1(x1 - x0 + 2 * pad), r1(y1 - y0 + 2 * pad)].join(' '));
      paintLit(); paintTracers();
      var ad = cur.e != null && cur.p >= 0 ? document.getElementById(nodeId(cur.p, cur.e)) : null;
      if (ad) stage.setAttribute('aria-activedescendant', ad.id); else stage.removeAttribute('aria-activedescendant');
      syncList();
    }

    // ---------- plane list (MINIs) ----------
    function buildList() {
      list.textContent = ''; minis = {};
      planes.forEach(function (pl, i) {
        var row = VK.el('div.vk-layerstack__row', { 'data-plane': pl.id, style: '--_pc: var(' + tok(pl.color, i) + ')' });
        row.appendChild(VK.el('span.vk-layerstack__num.vk-num', { 'aria-hidden': 'true', text: num(i) }));
        row.appendChild(VK.el('span.vk-layerstack__swatch', { 'aria-hidden': 'true' }));
        row.appendChild(VK.el('span.vk-layerstack__name', { text: pl.name }));
        var eye = VK.mini.create({ icon: 'eye', label: pl.name + ' megjelenítése', size: 'sm', onClick: function () { setVisible(pl.id, !!hidden[pl.id]); } });
        var so = VK.mini.create({ icon: 'solo', label: pl.name + ' szóló', size: 'sm', onClick: function () { solo(soloId === pl.id ? null : pl.id); } });
        row.appendChild(eye); row.appendChild(so);
        minis[pl.id] = { row: row, eye: eye, solo: so };
        list.appendChild(row);
      });
      if (rov) rov.destroy();
      rov = VK.focus.roving(list, { items: '.vk-mini', orientation: 'grid', cols: function () { return 2; }, typeahead: false, wrap: false });
    }
    function syncList() {
      planes.forEach(function (pl, i) {
        var m = minis[pl.id]; if (!m) return;
        var shown = !hidden[pl.id];
        VK.mini.set(m.eye, { pressed: shown, state: shown ? 'idle' : 'off' });
        m.eye.querySelector('use').setAttribute('href', '#vk-i-' + (shown ? 'eye' : 'eye-off'));
        m.eye.setAttribute('aria-label', pl.name + ' — ' + (shown ? 'látható' : 'rejtett'));
        m.eye.title = m.eye.getAttribute('aria-label');
        VK.mini.set(m.solo, { pressed: soloId === pl.id });
        m.solo.setAttribute('aria-label', pl.name + ' szóló' + (soloId === pl.id ? ' — be' : ''));
        m.solo.title = m.solo.getAttribute('aria-label');
        if (vis(pl.id)) m.row.removeAttribute('data-off'); else m.row.setAttribute('data-off', '');
        if (i === cur.p) m.row.setAttribute('data-current', ''); else m.row.removeAttribute('data-current');
      });
    }

    // ---------- state changes ----------
    function emitVis() { em.emit('visibility', { hidden: Object.keys(hidden), solo: soloId }); }
    function fixCur() {
      if (cur.p >= 0 && planes[cur.p] && vis(planes[cur.p].id)) return;
      var best = -1, bd = Infinity;
      planes.forEach(function (p, i) { if (vis(p.id) && Math.abs(i - cur.p) < bd) { bd = Math.abs(i - cur.p); best = i; } });
      if (best < 0) { cur = { p: -1, e: null }; return; }
      var keep = entsOn(best).filter(function (e) { return e.id === cur.e; })[0];
      cur = { p: best, e: keep ? keep.id : (entsOn(best)[0] || {}).id || null };
    }
    function setVisible(id, on) {
      if (on) delete hidden[id]; else hidden[id] = true;
      if (soloId === id && !on) soloId = null;
      fixCur(); draw(); emitVis();
    }
    function solo(id) { soloId = id && pIndex(id) >= 0 ? id : null; if (soloId) delete hidden[soloId]; fixCur(); draw(); emitVis(); }
    function announce() {
      if (cur.p < 0) { readout.textContent = 'NINCS LÁTHATÓ SÍK'; return; }
      var pl = planes[cur.p], e = ents.filter(function (x) { return x.id === cur.e; })[0];
      readout.textContent = num(cur.p) + ' ' + String(pl.name).toUpperCase() + ' // ' + (e ? e.label + ' // ' + planesOf(e).length + ' SÍKON' : 'ÜRES SÍK') +
        (soloId ? ' // SZÓLÓ' : '');
    }
    function setCur(p, eid, quiet) {
      cur = { p: p, e: eid }; hl = eid; draw();
      if (!quiet) announce();
      em.emit('focus', { plane: planes[p] && planes[p].id, entity: eid });
    }

    // ---------- keyboard ----------
    function onKey(e) {
      if (e.target !== stage || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.shiftKey && /^Arrow/.test(e.key)) return;
      if (cur.p < 0) fixCur();
      var k = e.key, i = cur.p, here = entsOn(i), at = here.map(function (x) { return x.id; }).indexOf(cur.e);
      if (k === 'ArrowUp' || k === 'ArrowDown') {
        e.preventDefault();
        var step = k === 'ArrowUp' ? -1 : 1, n = i + step;
        while (n >= 0 && n < planes.length && !vis(planes[n].id)) n += step;
        if (n < 0 || n >= planes.length) { readout.textContent = k === 'ArrowUp' ? 'LEGFELSŐ SÍK' : 'LEGALSÓ SÍK'; return; }
        var there = entsOn(n), same = there.filter(function (x) { return x.id === cur.e; })[0];
        if (!same && there.length && cur.e) {
          var ref = here[at] ? posOf(here[at], i)[0] : 0;
          same = there.slice().sort(function (a, b) { return Math.abs(posOf(a, n)[0] - ref) - Math.abs(posOf(b, n)[0] - ref); })[0];
        }
        setCur(n, same ? same.id : there[0] ? there[0].id : null);
      } else if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'Home' || k === 'End') {
        e.preventDefault(); if (!here.length) return;
        var j = k === 'Home' ? 0 : k === 'End' ? here.length - 1 : VK.clamp((at < 0 ? 0 : at) + (k === 'ArrowRight' ? 1 : -1), 0, here.length - 1);
        setCur(i, here[j].id);
      } else if (k === 's' || k === 'S') {
        e.preventDefault(); if (i >= 0) { solo(soloId === planes[i].id ? null : planes[i].id); announce(); }
      } else if (k === 'h' || k === 'H') {
        e.preventDefault(); if (i >= 0) { setVisible(planes[i].id, false); announce(); }
      } else if (k === 'Enter') {
        e.preventDefault(); if (cur.e) em.emit('open', { plane: planes[i].id, entity: cur.e });
      } else if (k === 'Escape' && soloId) {
        e.preventDefault(); solo(null); announce();
      }
    }
    function onFocus(e) {
      if (e.target !== stage) return;
      if (cur.p < 0 || cur.e == null) { fixCur(); if (cur.p >= 0 && cur.e == null) cur.e = (entsOn(cur.p)[0] || {}).id || null; }
      hl = cur.e; draw(); announce();
    }
    /* the highlight as attributes: the old entity loses data-hl, the new one gains it, one hover label is added */
    function setHl(id) {
      if (id === hl) return;
      var old = hl && idx[hl]; hl = id;
      if (old) [].concat(old.nodes, old.pillars, old.labels).forEach(function (n) { n.removeAttribute('data-hl'); });
      gHover.textContent = '';
      var now = id != null && idx[id];
      if (!now) return;
      [].concat(now.nodes, now.pillars, now.labels).forEach(function (n) { n.setAttribute('data-hl', ''); });
      if (!now.labels.length && now.pos.length) {
        var e = ents.filter(function (x) { return x.id === id; })[0], p = now.pos[0];
        if (e) { var t = svg('text', { class: 'vk-layerstack__elabel', x: r1(p[0] + 9), y: r1(p[1] - 6), 'data-hl': '' }, gHover); t.textContent = e.label; }
      }
    }
    function onBlur() { setHl(null); }
    function onOver(e) {
      var t = e.target.closest && e.target.closest('[data-entity]');
      setHl(t ? t.getAttribute('data-entity') : (document.activeElement === stage ? cur.e : null));
    }

    /* ---------- lighting (Érintésnyom) ---------- */
    var KINDS = { exact: 1, inferred: 1, forecast: 1 };
    function norm(v) { return typeof v === 'number' ? { e: v, kind: 'exact' } : { e: +v.e || 0, kind: KINDS[v.kind] ? v.kind : 'exact', write: !!v.write }; }
    function paintLit() {
      Object.keys(idx).forEach(function (id) {
        var x = idx[id], v = lit.get(id);
        [].concat(x.nodes, x.pillars).forEach(function (n) {
          if (!v) { n.removeAttribute('data-lit'); n.style.removeProperty('--_e'); return; }
          n.setAttribute('data-lit', v.kind); n.style.setProperty('--_e', String(Math.max(0, Math.min(1, v.e)).toFixed(3)));
        });
      });
      if (labelMode !== 'lit') return;
      gLit.textContent = '';
      var top = []; lit.forEach(function (v, id) { if (idx[id] && idx[id].nodes.length) top.push([id, v]); });
      var RANK = { exact: 0, forecast: 1, inferred: 2 };
      top.sort(function (a, b) { return (RANK[a[1].kind] - RANK[b[1].kind]) || b[1].e - a[1].e; });
      var placed = [], room = opts.litLabels || 12;
      top.forEach(function (r) {
        if (placed.length >= room) return;
        var e = ents.filter(function (x) { return x.id === r[0]; })[0], p = idx[r[0]].pos[0]; if (!e) return;
        // a label that would sit on another one is skipped: the brightest keep theirs
        if (placed.some(function (q) { return Math.abs(q[0] - p[0]) < 70 && Math.abs(q[1] - p[1]) < 11; })) return;
        placed.push(p);
        var t = svg('text', { class: 'vk-layerstack__elabel', x: r1(p[0] + 9), y: r1(p[1] - 6), 'data-lit': r[1].kind }, gLit); t.textContent = e.label;
      });
    }
    function light(map) {
      var next = new Map();
      if (map) (map instanceof Map ? map : new Map(Object.entries(map))).forEach(function (v, id) { var n = norm(v); if (n.e > 0) next.set(id, n); });
      // only what changed is touched: the old lit set is cleared where it went dark
      lit.forEach(function (v, id) { if (!next.has(id) && idx[id]) [].concat(idx[id].nodes, idx[id].pillars).forEach(function (n) { n.removeAttribute('data-lit'); n.style.removeProperty('--_e'); }); });
      lit = next;
      next.forEach(function (v, id) {
        var x = idx[id]; if (!x) return;
        [].concat(x.nodes, x.pillars).forEach(function (n) { n.setAttribute('data-lit', v.kind); n.style.setProperty('--_e', String(Math.max(0, Math.min(1, v.e)).toFixed(3))); });
        if (v.write) x.nodes.forEach(function (n) { n.setAttribute('data-write', ++writes % 2 ? 'a' : 'b'); });
      });
      if (labelMode === 'lit') paintLit();
    }
    function paintTracers() {
      gTracers.textContent = '';
      Object.keys(tracers).forEach(function (k) {
        var t = tracers[k], ps = t.ids.map(function (id) { return idx[id] && idx[id].pos[0]; }).filter(Boolean);
        if (!ps.length) return;
        var g = svg('g', { class: 'vk-layerstack__tracer-g', 'data-style': t.style || 'solid', 'data-key': k }, gTracers);
        if (ps.length > 1) svg('polyline', { class: 'vk-layerstack__tracer', points: pts(ps) }, g);
        var h = ps[ps.length - 1];
        svg('circle', { class: 'vk-layerstack__tracer-head', cx: r1(h[0]), cy: r1(h[1]), r: 3 }, g);
        if (t.label) { var tx = svg('text', { class: 'vk-layerstack__tracer-label', x: r1(h[0] - 6), y: r1(h[1] + 12), 'text-anchor': 'end' }, g); tx.textContent = t.label; }
      });
    }
    function tracer(key, ids, o) {
      if (!ids || !ids.length) delete tracers[key];
      else tracers[key] = { ids: ids.slice(-(o && o.keep || 6)), label: o && o.label, style: o && o.style };
      paintTracers();
    }
    function onClick(e) {
      var t = e.target.closest && e.target.closest('.vk-layerstack__node'); if (!t) return;
      stage.focus({ preventScroll: true });
      setCur(pIndex(t.getAttribute('data-plane')), t.getAttribute('data-entity'));
    }
    stage.addEventListener('keydown', onKey);
    stage.addEventListener('focus', onFocus);
    stage.addEventListener('blur', onBlur);
    stage.addEventListener('pointerover', onOver);
    stage.addEventListener('pointerleave', onOver);
    stage.addEventListener('click', onClick);

    function setData(d) {
      d = d || {};
      if (d.planes) planes = d.planes.slice();
      if (d.entities) ents = d.entities.slice();
      if (d.links) links = d.links.slice();
      planes.forEach(function (p) { if (p.visible === false) hidden[p.id] = true; });
      if (d.solo !== undefined) soloId = d.solo;
      buildList(); fixCur(); draw(); announce();
    }
    setData(opts);

    return {
      el: el, setData: setData, setVisible: setVisible, solo: solo,
      focus: function (planeId, entityId) { var i = pIndex(planeId); if (i >= 0) { setCur(i, entityId); stage.focus({ preventScroll: true }); } },
      highlight: function (id) { setHl(id || null); },
      light: light, tracer: tracer,
      state: function () { return { plane: cur.p >= 0 ? planes[cur.p].id : null, entity: cur.e, hidden: Object.keys(hidden), solo: soloId, highlight: hl }; },
      on: em.on,
      destroy: function () {
        if (rov) rov.destroy();
        stage.removeEventListener('keydown', onKey); stage.removeEventListener('focus', onFocus); stage.removeEventListener('blur', onBlur);
        stage.removeEventListener('pointerover', onOver); stage.removeEventListener('pointerleave', onOver); stage.removeEventListener('click', onClick);
        el.textContent = ''; el.classList.remove('vk-layerstack');
      }
    };
  }

  VK.layerstack = { mount: mount };
})(typeof window !== 'undefined' ? window : globalThis);
