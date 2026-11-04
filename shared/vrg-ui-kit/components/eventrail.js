/* VRG UI Kit — components/eventrail.js — the film-HUD event rail (own drawing): a long framed band with chamfered
   corners, a year/age axis with tick marks and numbers, warm event pips on the rail, each with a metro-style leader
   (orthogonal, one rounded bend) up to a staggered label "MM.DD · [KATEGÓRIA]" + text; id chips, with a warning
   glyph on flagged events. Labels never overlap and leaders never cross a label (row stacking, right-to-left).
     var r = VK.eventrail.mount(el, {from, to, events:[{t, label, cat, id, flag}], now, axis:'year'|'age', born, title, label})
       t/from/to: 'YYYY-MM-DD', ms or Date (wall-clock) · axis 'age' with born (a year) numbers the years as ages
     r.setEvents(events) · r.select(id) · r.layout() · r.on(type, fn) → off · r.destroy()
   Events (r.on and bubbling DOM 'vk:eventrail-<type>'): select {event} · focus {event}
   Keyboard: the labels are one listbox (horizontal) — ←/→ previous/next in time, Home/End first/last,
     Enter/Space = select (ice), Esc = clear.
   Colours come from CSS classes on the SVG (tokens), so a theme switch needs no redraw; size and density changes
   re-lay it out. Depends on: core. */
(function (root) {
  'use strict';
  var VK = root.VK = root.VK || {};
  if (VK.eventrail) return;

  var DAY = 864e5, NS = 'http://www.w3.org/2000/svg';
  var MON = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.'];

  function T(v) {
    if (v === null || v === undefined || v === '') return NaN;
    if (typeof v === 'number') return v;
    if (v instanceof Date) return Date.UTC(v.getFullYear(), v.getMonth(), v.getDate(), v.getHours(), v.getMinutes());
    var m = String(v).match(/^(\d{4})-(\d\d)-(\d\d)(?:[T ](\d\d):(\d\d))?/);
    return m ? Date.UTC(+m[1], m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)) : NaN;
  }
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function fFull(t) { var d = new Date(t); return d.getUTCFullYear() + '. ' + MON[d.getUTCMonth()] + ' ' + d.getUTCDate() + '.'; }
  function svg(tag, a, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in a) if (a[k] !== undefined && a[k] !== null) n.setAttribute(k, a[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  function mount(el, o) {
    o = o || {};
    var em = VK.emitter(), offs = [];
    var S = { from: T(o.from), to: T(o.to), now: o.now !== undefined ? T(o.now) : T(new Date()), axis: o.axis || 'year',
      born: o.born !== undefined ? +o.born : null, events: [], sel: null, active: null, lastW: 0 };

    el.classList.add('vk-eventrail');
    if (!el.hasAttribute('data-vk-hop')) el.setAttribute('data-vk-hop', '');
    el.textContent = '';
    var count = VK.el('span.vk-label.vk-eventrail__count');
    var head = VK.el('div.vk-eventrail__head', null, [VK.el('span.vk-label.vk-eventrail__title', { text: o.title || 'Eseménysín' }), count]);
    var art = svg('svg', { class: 'vk-eventrail__svg', 'aria-hidden': 'true', focusable: 'false' });
    var list = VK.el('div.vk-eventrail__list', { role: 'listbox', 'aria-orientation': 'horizontal', 'aria-label': o.label || 'Események' });
    var stage = VK.el('div.vk-eventrail__stage', null, [art, list]);
    var scroller = VK.el('div.vk-eventrail__scroll.vk-scroll', null, stage);
    var readout = VK.el('div.vk-eventrail__readout', { role: 'status', 'aria-live': 'polite' });
    el.append(head, scroller, readout);

    function emit(type, data) { em.emit(type, data); VK.fire(el, 'eventrail-' + type, data); }
    function listen(n, type, fn) { n.addEventListener(type, fn); offs.push(function () { n.removeEventListener(type, fn); }); }
    function multiYear() { return S.to - S.from > 400 * DAY; }
    function dateTxt(t) { var d = new Date(t); return (multiYear() ? d.getUTCFullYear() + '.' : '') + p2(d.getUTCMonth() + 1) + '.' + p2(d.getUTCDate()); }

    function setEvents(evs) {
      list.textContent = '';
      S.events = (evs || []).map(function (src, i) {
        var e = { src: src, t: T(src.t), label: src.label || '', cat: src.cat || '', id: src.id || '', flag: !!src.flag, key: String(src.id || 'e' + i) };
        return e;
      }).filter(function (e) { return !isNaN(e.t); }).sort(function (a, b) { return a.t - b.t; });
      if (isNaN(S.from) || isNaN(S.to) || S.to <= S.from) {
        var a = S.events.length ? S.events[0].t : S.now, b = S.events.length ? S.events[S.events.length - 1].t : S.now;
        S.from = Date.UTC(new Date(a).getUTCFullYear(), 0, 1); S.to = Date.UTC(new Date(b).getUTCFullYear() + 1, 0, 1);
      }
      S.events.forEach(function (e, i) {
        var aria = fFull(e.t) + ' · ' + e.cat + ' · ' + e.label + (e.id ? ', ' + e.id : '') + (e.flag ? ', megjelölve' : '');
        var meta = VK.el('span.vk-eventrail__meta', null, [
          VK.el('span.vk-num', { text: dateTxt(e.t) }), VK.el('span', { text: '·' }),
          e.cat ? VK.el('span.vk-eventrail__cat', { text: '[' + e.cat + ']' }) : null,
          e.id ? VK.el('span.vk-eventrail__id', null, [e.flag ? VK.icon('warning') : null, e.id]) : null
        ]);
        e.el = VK.el('div.vk-eventrail__ev', { role: 'option', tabindex: '-1', 'aria-selected': 'false', 'aria-label': aria, title: aria,
          'data-key': e.key, 'data-flag': e.flag ? '' : null }, [meta, VK.el('span.vk-eventrail__txt', { text: e.label })]);
        e.el._ev = e; e.i = i;
        list.appendChild(e.el);
      });
      var flagged = S.events.filter(function (e) { return e.flag; }).length;
      count.textContent = S.events.length + ' esemény' + (flagged ? ' // ' + flagged + ' jelzett' : '');
      if (S.sel && !S.events.some(function (e) { return e.key === S.sel.key; })) S.sel = null;
      var start = S.events.filter(function (e) { return e.t <= S.now; }).pop() || S.events[0];
      if (start) activate(start, false);
      layout(true);
    }

    function layout(force) {
      var cw = scroller.clientWidth; if (!cw) return;
      if (!force && cw === S.lastW) return;
      S.lastW = cw;
      var W = Math.max(cw, o.minWidth || 560);
      var fs = parseFloat(getComputedStyle(el).fontSize) || 12;
      var bandH = Math.round(fs * 3.8), lift = 14, gap = 10, dx = 14, padX = Math.round(fs * 2.4), chamfer = 10;
      var x0 = 0.5, x1 = W - 0.5, ax0 = x0 + padX, ax1 = x1 - padX;
      function X(t) { return ax0 + (t - S.from) / (S.to - S.from) * (ax1 - ax0); }

      // measure labels
      var rowH = 0;
      S.events.forEach(function (e) {
        e.el.style.left = '0px'; e.el.style.top = '0px'; e.el.removeAttribute('data-side');
        e.w = Math.ceil(e.el.offsetWidth); e.h = Math.ceil(e.el.offsetHeight); e.x = X(e.t);
        rowH = Math.max(rowH, e.h + 8);
      });

      // stacking: right to left; a label may not overlap another, no vertical leader may cross a label
      var placed = [];
      function ok(r, a, b, x) {
        var lo = Math.min(a, x), hi = Math.max(b, x);
        return placed.every(function (p) {
          if (p.r === r && lo < p.hi + gap && hi > p.lo - gap) return false;
          if (p.r > r && p.x >= lo - 6 && p.x <= hi + 6) return false;
          if (p.r < r && x >= p.lo - 6 && x <= p.hi + 6) return false;
          return true;
        });
      }
      // right-extending labels go right to left, then the few flipped at the right edge go left to right, so a label
      // is always placed after every pip it covers and rises above their labels
      S.events.forEach(function (e) { e.side = e.x + dx + e.w <= x1 - 2 ? 'r' : 'l'; });
      var rightSide = S.events.filter(function (e) { return e.side === 'r'; }).reverse();
      var leftSide = S.events.filter(function (e) { return e.side === 'l'; });
      rightSide.concat(leftSide).forEach(function (e) {
        var a = e.side === 'r' ? e.x + dx : Math.max(x0 + 2, e.x - dx - e.w), b = a + e.w, best = null;
        for (var r = 0; r < 24 && !best; r++) if (ok(r, a, b, e.x)) best = r;
        if (best === null) best = placed.reduce(function (m, p) { return Math.max(m, p.r); }, -1) + 1;
        e.row = best; e.a = a; e.b = b;
        placed.push({ r: best, lo: Math.min(a, e.x), hi: Math.max(b, e.x), x: e.x });
      });
      var rows = S.events.reduce(function (m, e) { return Math.max(m, e.row + 1); }, 0);
      var H = 6 + rows * rowH + lift + bandH + 1;
      var bandTop = H - bandH - 1, bandBot = H - 1, railY = bandTop + Math.round(bandH * .3);
      stage.style.width = W + 'px'; stage.style.height = H + 'px';
      art.setAttribute('width', W); art.setAttribute('height', H); art.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      art.textContent = '';

      // band (chamfered frame) and rail
      svg('path', { class: 'vk-eventrail__frame', d: 'M' + (x0 + chamfer) + ' ' + (bandTop + .5) + 'H' + x1 + 'V' + (bandBot - chamfer) +
        'L' + (x1 - chamfer) + ' ' + bandBot + 'H' + x0 + 'V' + (bandTop + .5 + chamfer) + 'Z' }, art);
      svg('path', { class: 'vk-eventrail__bracket', d: 'M' + (x1 - 18) + ' ' + (bandTop + 3.5) + 'H' + (x1 - 3.5) + 'V' + (bandTop + 10) +
        'M' + (x0 + 3.5) + ' ' + (bandBot - 10) + 'V' + (bandBot - 3.5) + 'H' + (x0 + 18) }, art);
      svg('line', { class: 'vk-eventrail__rail', x1: ax0, x2: ax1, y1: railY + .5, y2: railY + .5 }, art);
      svg('rect', { class: 'vk-eventrail__cap', x: ax0 - 3, y: railY - 2.5, width: 6, height: 6 }, art);
      svg('rect', { class: 'vk-eventrail__cap', x: ax1 - 3, y: railY - 2.5, width: 6, height: 6 }, art);

      // axis: months (≤ 3 years) or years; numbers under the ticks
      var numY = railY + 9 + fs * 1.1, multi = S.to - S.from > 3 * 366 * DAY, lastNum = -1e9;
      function yearTxt(y) { return S.axis === 'age' && S.born !== null ? (y - S.born) + ' év' : String(y); }
      function num(x, txt, cls) {
        if (x - lastNum < fs * 2.6 || x > ax1 - fs * 2) return; lastNum = x;
        var t = svg('text', { class: 'vk-eventrail__num' + (cls ? ' ' + cls : ''), x: x + 3, y: numY }, art); t.textContent = txt;
      }
      var d0 = new Date(S.from), y = d0.getUTCFullYear(), m = d0.getUTCMonth();
      if (Date.UTC(y, m, 1) < S.from) m++;
      for (var guard = 0; guard < 2000; guard++) {
        var t = multi ? Date.UTC(y + guard, 0, 1) : Date.UTC(y, m + guard, 1);
        if (t > S.to) break;
        if (t < S.from) continue;
        var x = X(t), dm = new Date(t), mo = dm.getUTCMonth(), major = mo === 0;
        svg('line', { class: 'vk-eventrail__tick' + (major || multi ? ' vk-eventrail__tick--major' : ''), x1: x + .5, x2: x + .5, y1: railY + 3, y2: railY + (major || multi ? 11 : 7) }, art);
        if (multi) num(x, yearTxt(dm.getUTCFullYear()), 'vk-eventrail__num--year');
        else num(x, major ? yearTxt(dm.getUTCFullYear()) : p2(mo + 1), major ? 'vk-eventrail__num--year' : '');
        if (!multi) {                                             // minor ticks: the 8th, 15th, 22nd
          [8, 15, 22].forEach(function (dd) {
            var tm = Date.UTC(dm.getUTCFullYear(), mo, dd); if (tm > S.to) return;
            var xm = X(tm); svg('line', { class: 'vk-eventrail__tick', x1: xm + .5, x2: xm + .5, y1: railY + 3, y2: railY + 5 }, art);
          });
        }
      }

      // now marker (ice: you are here)
      if (S.now >= S.from && S.now <= S.to) {
        var xn = X(S.now);
        svg('path', { class: 'vk-eventrail__now', d: 'M' + (xn - 4) + ' ' + (bandTop + 2) + 'h8l-4 5z' }, art);
        svg('line', { class: 'vk-eventrail__now-line', x1: xn, x2: xn, y1: railY + 6, y2: bandBot - 3 }, art);
        var nt = svg('text', { class: 'vk-eventrail__now-t', x: xn + 7, y: bandTop + fs * .95 }, art); nt.textContent = 'MA';
      }

      // leaders, pips, labels
      var rad = 6;
      S.events.forEach(function (e) {
        var top = bandTop - lift - e.row * rowH - e.h, ya = Math.round(top + e.h / 2) + .5, xe = e.side === 'r' ? e.a : e.b;
        var xs = Math.round(e.x) + .5, dir = xe > xs ? 1 : -1, rr = Math.min(rad, Math.abs(xe - xs), Math.max(0, railY - 6 - ya));
        e.el.style.left = Math.round(e.a) + 'px'; e.el.style.top = Math.round(top) + 'px'; e.el.dataset.side = e.side;
        e.leader = svg('path', { class: 'vk-eventrail__leader', d: 'M' + xs + ' ' + (railY - 5) + 'V' + (ya + rr) + 'Q' + xs + ' ' + ya + ' ' + (xs + dir * rr) + ' ' + ya + 'H' + xe }, art);
        e.ring = svg('circle', { class: 'vk-eventrail__ring', cx: xs, cy: railY + .5, r: 7.5 }, art);
        e.pip = svg('circle', { class: 'vk-eventrail__pip' + (e.flag ? ' vk-eventrail__pip--flag' : ''), cx: xs, cy: railY + .5, r: 4 }, art);
      });
      paint();
    }

    function paint() {
      S.events.forEach(function (e) {
        var sel = S.sel === e, act = S.active === e && list.contains(document.activeElement);
        e.el.setAttribute('aria-selected', sel ? 'true' : 'false');
        [e.leader, e.ring, e.pip].forEach(function (n) {
          if (!n) return;
          if (sel) n.setAttribute('data-sel', ''); else n.removeAttribute('data-sel');
          if (act) n.setAttribute('data-active', ''); else n.removeAttribute('data-active');
        });
      });
      readout.textContent = '';
      var e = S.sel || S.active;
      if (e) readout.append(VK.el('span.vk-label', { text: S.sel ? 'Kijelölve' : 'Esemény' }),
        VK.el('span.vk-num', { text: fFull(e.t) }), VK.el('span.vk-eventrail__rcat', { text: '[' + e.cat + ']' }),
        VK.el('span', { text: e.label }), e.id ? VK.el('span.vk-eventrail__id', { 'data-flag': e.flag ? '' : null }, [e.flag ? VK.icon('warning') : null, e.id]) : null);
    }

    function activate(e, focus) {
      if (S.active && S.active !== e) S.active.el.tabIndex = -1;
      S.active = e; e.el.tabIndex = 0;
      if (focus) {
        e.el.focus({ preventScroll: true });
        e.el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        emit('focus', { event: e.src });
      }
      paint();
    }
    function select(e, silent) {
      S.sel = e || null; paint();
      if (!silent) emit('select', { event: e ? e.src : null });
    }

    listen(list, 'click', function (ev) {
      var n = ev.target.closest('.vk-eventrail__ev'); if (!n) return;
      activate(n._ev, false); n.focus({ preventScroll: true }); select(n._ev);
    });
    listen(list, 'focusin', paint);
    listen(list, 'focusout', function () { setTimeout(paint, 0); });
    listen(list, 'keydown', function (ev) {
      var n = ev.target.closest && ev.target.closest('.vk-eventrail__ev');
      if (!n || ev.altKey || ev.ctrlKey || ev.metaKey || (ev.shiftKey && /^Arrow/.test(ev.key))) return;
      var i = n._ev.i, j = null;
      switch (ev.key) {
        case 'ArrowRight': case 'ArrowDown': j = Math.min(S.events.length - 1, i + 1); break;
        case 'ArrowLeft': case 'ArrowUp': j = Math.max(0, i - 1); break;
        case 'Home': j = 0; break;
        case 'End': j = S.events.length - 1; break;
        case 'Enter': case ' ': ev.preventDefault(); select(n._ev); return;
        case 'Escape': if (!S.sel) return; ev.preventDefault(); select(null); return;
        default: return;
      }
      ev.preventDefault(); activate(S.events[j], true);
    });

    var ro = root.ResizeObserver ? new ResizeObserver(function () { layout(false); }) : null;
    if (ro) ro.observe(scroller);
    listen(document, 'vk:density', function () { layout(true); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (el.classList.contains('vk-eventrail')) layout(true); });

    setEvents(o.events);

    var api = {
      setEvents: setEvents,
      select: function (id) { var e = S.events.filter(function (x) { return x.key === String(id); })[0] || null; if (e) activate(e, false); select(e, true); },
      layout: function () { layout(true); },
      on: em.on,
      destroy: function () { offs.forEach(function (f) { f(); }); if (ro) ro.disconnect(); el.textContent = ''; el.classList.remove('vk-eventrail'); }
    };
    el._vkEventrail = api;
    return api;
  }

  VK.eventrail = { mount: mount, format: fFull };
})(typeof window !== 'undefined' ? window : globalThis);
