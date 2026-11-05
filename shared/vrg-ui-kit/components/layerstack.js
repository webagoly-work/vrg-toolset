/* VRG UI Kit — components/layerstack.js — stacked isometric planes; dashed vertical "pillars" tie the same
   entity id across planes; warm "beacons" rise from entities with activity.
     var ls = VK.layerstack.mount(el, {
       label: 'Rétegköteg',
       planes:   [{id:'ui', name:'Felület', color:'--vk-layer-6'}],                 // first = top plane
       entities: [{id:'sw1', label:'Kapcsoló SW1', at:{net:{x:50, y:60}, dev:{x:50, y:60}},
                   beacon?: 0…1 | {planeId: 0…1}}],                                // x/y in 0…100 plane units
       links?:   [{plane:'net', from:'sw1', to:'gw'}] })                           // optional wires on one plane (metro L)
     → { setData(d), setVisible(planeId, on), solo(planeId | null), focus(planeId, entityId), highlight(entityId),
         state(), on(type, fn), destroy() }
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
    var planes = [], ents = [], links = [];
    var hidden = {}, soloId = null, cur = { p: -1, e: null }, hl = null;
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
      gBeacons = svg('g', null, sv), gNodes = svg('g', null, sv), gLabels = svg('g', null, sv);
    var readout = VK.el('p.vk-layerstack__readout.vk-label', { role: 'status', 'aria-live': 'polite' });
    stage.appendChild(readout);
    el.appendChild(list); el.appendChild(stage);

    function vis(id) { return soloId ? id === soloId : !hidden[id]; }
    function pIndex(id) { for (var i = 0; i < planes.length; i++) if (planes[i].id === id) return i; return -1; }
    function wpos(at) { return [VK.clamp(+at.x || 0, 0, 100) * W / 100, VK.clamp(+at.y || 0, 0, 100) * D / 100]; }
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

    function draw() {
      [gPlanes, gPillars, gLinks, gBeacons, gNodes, gLabels].forEach(function (g) { g.textContent = ''; });
      var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      function ext(p) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
      for (var i = planes.length - 1; i >= 0; i--) {
        var pl = planes[i], on = vis(pl.id);
        var g = svg('g', { class: 'vk-layerstack__plane', 'data-plane': pl.id, 'data-state': on ? 'on' : 'ghost', 'data-current': i === cur.p ? '' : null,
          style: '--_pc: var(' + tok(pl.color, i) + ')' }, gPlanes);
        var c = [P(0, 0, i), P(W, 0, i), P(W, D, i), P(0, D, i)];
        c.forEach(ext);
        svg('polygon', { class: 'vk-layerstack__sheet', points: pts(c) }, g);
        if (on) {
          var d = '';
          for (var k = 1; k < 4; k++) {
            var a = P(W * k / 4, 0, i), b = P(W * k / 4, D, i), e1 = P(0, D * k / 4, i), e2 = P(W, D * k / 4, i);
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
          svg('line', { class: 'vk-layerstack__pillar', x1: r1(a[0]), y1: r1(a[1]), x2: r1(b[0]), y2: r1(b[1]), 'data-entity': e.id, 'data-hl': e.id === hl ? '' : null }, gPillars);
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
          svg('circle', { class: 'vk-layerstack__hit', cx: r1(p[0]), cy: r1(p[1]), r: 9 }, ng);
          svg('circle', { class: 'vk-layerstack__ring', cx: r1(p[0]), cy: r1(p[1]), r: 7.5 }, ng);
          svg('circle', { class: 'vk-layerstack__dot', cx: r1(p[0]), cy: r1(p[1]), r: 3.6 }, ng);
          if (i === labelPlane || e.id === hl) {
            var tx = svg('text', { class: 'vk-layerstack__elabel', x: r1(p[0] + 9), y: r1(p[1] - 6), 'data-entity': e.id, 'data-hl': e.id === hl ? '' : null }, gLabels);
            tx.textContent = e.label;
            ext([p[0] + 9 + String(e.label).length * 5.4, p[1] - 14]);
          }
        });
      });
      if (x0 === Infinity) { x0 = y0 = 0; x1 = y1 = 100; }
      var pad = 10;
      sv.setAttribute('viewBox', [r1(x0 - pad), r1(y0 - pad), r1(x1 - x0 + 2 * pad), r1(y1 - y0 + 2 * pad)].join(' '));
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
    function onBlur() { if (hl !== null) { hl = null; draw(); } }
    function onOver(e) {
      var t = e.target.closest && e.target.closest('[data-entity]');
      var id = t ? t.getAttribute('data-entity') : (document.activeElement === stage ? cur.e : null);
      if (id !== hl) { hl = id; draw(); }
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
      highlight: function (id) { hl = id || null; draw(); },
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
