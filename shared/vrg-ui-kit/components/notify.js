/* VRG UI Kit — components/notify.js — notification board + RING (own drawing, SVG).
   The ring is a radial timeline: every event is a peak around the circle at its time (oldest just right of
   12 o'clock, clockwise to MOST = now just left of it), peak height = severity, warm = activity, crit = error.
   Cap shape = severity too (dot · hollow diamond · square); read events are dashed and dimmed.
   The unread count sits in the centre as a big mono number. Focusing or clicking a peak selects the matching
   item in the board (grouped Ma / Tegnap / Korábban) and the other way round.

     var n = VK.notify.mount(el, {
       items: [{id, time: Date|ms, title, text, kind:'activity'|'error', severity:1|2|3, read:false, source:'EXPORT'}],
       now: Date|ms|fn,            // "now" for grouping and the dial (default Date.now)
       span: ms,                   // the ring's time window (default: ≥ 72 h, covers the oldest item)
       toolbar: 'toolbar:notify',  // registry surface rendered as MINIs in the board header (optional)
       label: 'Értesítések', onSelect(item), onChange(inst) })
     n.add(item) · n.remove(id) · n.markRead(id?, read=true) · n.markAllRead() · n.clear()
     n.select(id, {focus:'ring'|'board'}) · n.selected() · n.items() · n.unread() · n.setFilter('all'|'unread') · n.filter()
     n.mini({size, onClick}) → the feature's MINI (bell; value = unread count; ticks = unread share; error state if an error is unread)
     n.destroy()
   Keyboard: ring peaks are one tab stop, ←/→ move in time (Home/End = oldest/newest); board items are one tab stop,
   ↑/↓ (Home/End, type-ahead). Focus selects. Enter/Space toggles read. Delete removes a board item.
   Suggested registry actions (the app registers them on its toolbar surface): notify.read, notify.readAll,
   notify.unreadOnly (checked), notify.clear.
   Depends on: core.js, focus.js, mini.js. Optional: actions.js (toolbar), state.css (empty board). */
(function (root) {
  'use strict';
  var VK = root.VK = root.VK || {};
  if (VK.notify) return;

  var NS = 'http://www.w3.org/2000/svg';
  var H = 3600 * 1000, DAY = 24 * H;
  var R0 = 80, HEIGHT = { 1: 16, 2: 28, 3: 42 };
  var SEV_HU = { 1: 'alacsony', 2: 'közepes', 3: 'magas' }, KIND_HU = { activity: 'tevékenység', error: 'hiba' };

  function svg(tag, attrs, kids) {
    var n = document.createElementNS(NS, tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dayStart(t) { var d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function polar(a, r) { var rad = (a - 90) * Math.PI / 180; return [Math.cos(rad) * r, Math.sin(rad) * r]; }

  function mount(el, opts) {
    opts = opts || {};
    var items = (opts.items || []).map(norm), sel = null, filter = 'all', minis = [], unsub = null, toolRoving = null;
    var nowFn = typeof opts.now === 'function' ? opts.now : function () { return opts.now ? +opts.now : Date.now(); };
    var uidBase = VK.uid('vk-notify');

    function norm(it) {
      return { id: String(it.id || VK.uid('ev')), time: +it.time || nowFn(), title: it.title || '', text: it.text || '',
        kind: it.kind === 'error' ? 'error' : 'activity', severity: VK.clamp(it.severity || (it.kind === 'error' ? 3 : 1), 1, 3),
        read: !!it.read, source: it.source || '' };
    }

    // ---------- skeleton ----------
    el.classList.add('vk-notify');
    el.textContent = '';
    var titleId = uidBase + '-t';
    var ringSvg = svg('svg', { class: 'vk-notify__ring', viewBox: '-150 -150 300 300', role: 'listbox', 'aria-orientation': 'horizontal',
      'aria-label': 'Eseménygyűrű, idő szerint — ←/→ lépked' });
    var dial = svg('g', { class: 'vk-notify__dial', 'aria-hidden': 'true' });
    var peaksG = svg('g', { class: 'vk-notify__peaks' });
    ringSvg.appendChild(dial); ringSvg.appendChild(peaksG);
    var count = VK.el('b.vk-notify__count');
    var core = VK.el('div.vk-notify__core', { 'aria-hidden': 'true' }, [count, VK.el('span.vk-notify__core-l', { text: 'olvasatlan' }), VK.el('span.vk-notify__core-s')]);
    var live = VK.el('p.vk-sr-only', { 'aria-live': 'polite' });
    var ringWrap = VK.el('div.vk-notify__ringwrap', null, [ringSvg, core, live]);
    var head = VK.el('div.vk-notify__head', null, [
      VK.el('span.vk-notify__title', { id: titleId, text: opts.label || 'Értesítések' }),
      VK.el('span.vk-notify__sum')]);
    var tools = VK.el('div.vk-notify__tools', { role: 'toolbar', 'aria-label': (opts.label || 'Értesítések') + ' — műveletek' });
    if (opts.toolbar) head.appendChild(tools);
    var list = VK.el('div.vk-notify__list', { role: 'listbox', 'aria-labelledby': titleId, tabindex: '-1' });
    var board = VK.el('div.vk-notify__board', null, [head, list]);
    var inner = VK.el('div.vk-notify__inner', null, [ringWrap, board]);
    el.appendChild(inner);

    // labels and hit targets are sized in CSS px: tell CSS how many viewBox units one px is
    function syncScale() {
      var w = ringSvg.getBoundingClientRect().width;
      if (w) ringWrap.style.setProperty('--_ls', (300 / w).toFixed(3));
    }
    var ro = root.ResizeObserver ? new ResizeObserver(syncScale) : null;
    if (ro) ro.observe(ringSvg);

    // ---------- geometry ----------
    function span() {
      if (opts.span) return opts.span;
      var now = nowFn(), oldest = items.reduce(function (m, it) { return Math.min(m, it.time); }, now);
      var s = Math.max(72 * H, (now - oldest) * 1.04);
      return Math.ceil(s / (6 * H)) * 6 * H;
    }
    function angleOf(t, now, sp) { return 8 + 344 * VK.clamp(1 - (now - t) / sp, 0, 1); }

    function drawDial(now, sp) {
      dial.textContent = '';
      dial.appendChild(svg('circle', { class: 'vk-notify__base', r: R0 }));
      dial.appendChild(svg('circle', { class: 'vk-notify__inner-ring', r: R0 - 22 }));
      // hour ticks every 3 h
      for (var t = Math.ceil((now - sp) / (3 * H)) * 3 * H; t <= now; t += 3 * H) {
        var a = angleOf(t, now, sp), p1 = polar(a, R0 - 4), p2 = polar(a, R0);
        dial.appendChild(svg('line', { class: 'vk-notify__tick', x1: p1[0].toFixed(2), y1: p1[1].toFixed(2), x2: p2[0].toFixed(2), y2: p2[1].toFixed(2) }));
      }
      // day boundaries + labels
      var d0 = dayStart(now), names = ['MA', 'TEGNAP'];
      for (var k = 0, d = d0; d > now - sp - DAY; k++, d -= DAY) {
        var from = Math.max(d, now - sp), to = Math.min(d + DAY, now);
        if (to <= from) continue;
        if (d > now - sp) {
          var a1 = angleOf(d, now, sp), q1 = polar(a1, R0 - 12), q2 = polar(a1, R0 + 52);
          dial.appendChild(svg('line', { class: 'vk-notify__day', x1: q1[0].toFixed(2), y1: q1[1].toFixed(2), x2: q2[0].toFixed(2), y2: q2[1].toFixed(2) }));
        }
        if ((to - from) < 5 * H) continue;
        var am = angleOf((from + to) / 2, now, sp), lp = polar(am, R0 + 58), dt = new Date(d);
        var label = names[k] || (pad(dt.getMonth() + 1) + '-' + pad(dt.getDate()));
        var tx = svg('text', { class: 'vk-notify__daylabel', x: lp[0].toFixed(1), y: (lp[1] + 3).toFixed(1),
          'text-anchor': Math.abs(lp[0]) < 20 ? 'middle' : lp[0] > 0 ? 'start' : 'end' });
        tx.textContent = label;
        dial.appendChild(tx);
      }
      // MOST (now) marker: ice playhead at the newest end
      var an = angleOf(now, now, sp), m1 = polar(an, R0 - 9), ml = polar(an - 4, R0 - 15), mr = polar(an + 4, R0 - 15);
      dial.appendChild(svg('path', { class: 'vk-notify__now', d: 'M' + m1.map(f).join(' ') + 'L' + ml.map(f).join(' ') + 'L' + mr.map(f).join(' ') + 'Z' }));
      var nl = polar(an - 8, R0 - 26);
      var nt = svg('text', { class: 'vk-notify__nowlabel', x: f(nl[0]), y: f(nl[1] + 3), 'text-anchor': 'end' }); nt.textContent = 'MOST';
      dial.appendChild(nt);
    }
    function f(n) { return (+n).toFixed(2); }

    function peakLabel(it) {
      var d = new Date(it.time);
      return timeText(it) + ' — ' + it.title + ' (' + KIND_HU[it.kind] + ', ' + SEV_HU[it.severity] + (it.read ? ', olvasott' : ', olvasatlan') + ')';
    }
    function group(it, now) { var d0 = dayStart(now); return it.time >= d0 ? 0 : it.time >= d0 - DAY ? 1 : 2; }
    function timeText(it) {
      var d = new Date(it.time), now = nowFn(), g = group(it, now), hm = pad(d.getHours()) + ':' + pad(d.getMinutes());
      return g < 2 ? hm : pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + hm;
    }

    function drawPeaks(now, sp) {
      peaksG.textContent = '';
      items.slice().sort(function (a, b) { return a.time - b.time; }).forEach(function (it) {
        var h = HEIGHT[it.severity], a = angleOf(it.time, now, sp);
        var g = svg('g', { class: 'vk-notify__peak', role: 'option', tabindex: '-1', 'data-id': it.id, 'data-kind': it.kind, 'data-sev': it.severity,
          'aria-selected': it.id === sel ? 'true' : 'false', 'aria-label': peakLabel(it), transform: 'rotate(' + a.toFixed(2) + ')' });
        if (!it.read) g.setAttribute('data-unread', '');
        if (it.fresh) g.setAttribute('data-new', '');
        var tip = -(R0 + h);
        g.appendChild(svg('line', { class: 'vk-notify__hit', x1: 0, y1: -R0, x2: 0, y2: tip - 7 }));
        g.appendChild(svg('circle', { class: 'vk-notify__halo', cx: 0, cy: tip, r: 8 }));
        g.appendChild(svg('line', { class: 'vk-notify__stem', x1: 0, y1: -(R0 + 2), x2: 0, y2: tip }));
        var cap = it.severity === 3 ? svg('rect', { class: 'vk-notify__cap', x: -3, y: tip - 3, width: 6, height: 6 })
          : it.severity === 2 ? svg('path', { class: 'vk-notify__cap', d: 'M0 ' + (tip - 4.2) + 'L4.2 ' + tip + 'L0 ' + (tip + 4.2) + 'L-4.2 ' + tip + 'Z' })
          : svg('circle', { class: 'vk-notify__cap', cx: 0, cy: tip, r: 2.8 });
        g.appendChild(cap);
        g.appendChild(svg('line', { class: 'vk-notify__foot', x1: -2.5, y1: -R0, x2: 2.5, y2: -R0 }));
        peaksG.appendChild(g);
      });
    }

    function drawBoard(now) {
      list.textContent = '';
      var shown = items.filter(function (it) { return filter === 'all' || !it.read; }).sort(function (a, b) { return b.time - a.time; });
      if (!shown.length) {
        list.appendChild(VK.el('div.vk-state', { 'data-kind': 'empty', role: 'presentation' }, [
          VK.el('div.vk-state__mark', { 'aria-hidden': 'true' }, VK.icon('bell')),
          VK.el('div.vk-state__body', null, [VK.el('p.vk-state__code', { text: '[ÜRES] // 0 ÉRTESÍTÉS' }),
            VK.el('p.vk-state__title', { text: filter === 'unread' && items.length ? 'Nincs olvasatlan értesítés' : 'Nincs értesítés' }),
            VK.el('p.vk-state__text', { text: 'Az új események itt és a gyűrűn jelennek meg.' })])]));
        return;
      }
      var names = ['Ma', 'Tegnap', 'Korábban'], groups = [[], [], []];
      shown.forEach(function (it) { groups[group(it, now)].push(it); });
      groups.forEach(function (arr, gi) {
        if (!arr.length) return;
        var hid = uidBase + '-g' + gi;
        var gEl = VK.el('div.vk-notify__group', { role: 'group', 'aria-labelledby': hid }, [
          VK.el('div.vk-notify__group-h', { id: hid }, [names[gi], VK.el('span.vk-num', { text: ' · ' + arr.length })])]);
        arr.forEach(function (it) {
          var row = VK.el('div.vk-notify__item', { role: 'option', id: uidBase + '-i-' + it.id, tabindex: '-1', 'data-id': it.id, 'data-kind': it.kind,
            'data-sev': it.severity, 'aria-selected': it.id === sel ? 'true' : 'false', 'data-unread': it.read ? null : '' }, [
            VK.el('span.vk-notify__glyph', { 'aria-hidden': 'true' }),
            VK.el('span.vk-notify__main', null, [
              VK.el('span.vk-notify__ititle', { text: it.title }),
              it.text ? VK.el('span.vk-notify__itext', { text: it.text }) : null,
              VK.el('span.vk-notify__meta', { text: (it.source ? it.source + ' // ' : '') + KIND_HU[it.kind].toUpperCase() + ' // ' + SEV_HU[it.severity].toUpperCase() })]),
            VK.el('span.vk-notify__time', { text: timeText(it) }),
            VK.el('span.vk-sr-only', { text: it.read ? ', olvasott' : ', olvasatlan' })]);
          if (it.fresh) row.setAttribute('data-new', '');
          gEl.appendChild(row);
        });
        list.appendChild(gEl);
      });
    }

    function unread() { return items.filter(function (it) { return !it.read; }).length; }

    function render() {
      var a = document.activeElement, focusSide = null, focusId = null;
      if (a && ringSvg.contains(a)) { focusSide = 'ring'; focusId = a.getAttribute('data-id'); }
      else if (a && list.contains(a)) { focusSide = 'board'; focusId = a.getAttribute('data-id'); }
      var now = nowFn(), sp = span();
      syncScale();
      drawDial(now, sp); drawPeaks(now, sp); drawBoard(now);
      var u = unread();
      count.textContent = String(u);
      core.lastChild.textContent = items.length + ' esemény // ' + Math.round(sp / H) + ' ó';
      head.querySelector('.vk-notify__sum').textContent = u + ' / ' + items.length;
      ringSvg.setAttribute('aria-label', 'Eseménygyűrű, idő szerint — ' + u + ' olvasatlan, ' + items.length + ' esemény');
      el.toggleAttribute('data-empty', !items.length);
      // roving tab stops: the selected item, else the newest
      syncTabStops();
      if (focusId) { var n = side(focusSide, focusId) || side(focusSide, sel); if (n) n.focus({ preventScroll: true }); else if (focusSide === 'board') list.focus(); }
      refreshTools(); syncMinis();
      if (opts.onChange) opts.onChange(api);
    }
    function side(which, id) {
      if (!id) return null;
      return (which === 'ring' ? peaksG : list).querySelector('[data-id="' + cssEsc(id) + '"]');
    }
    function cssEsc(s) { return root.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/"/g, '\\"'); }
    function syncTabStops() {
      [peaksG, list].forEach(function (c) {
        var all = c.querySelectorAll('[role="option"]'); if (!all.length) return;
        var target = (sel && c.querySelector('[data-id="' + cssEsc(sel) + '"]')) || (c === peaksG ? all[all.length - 1] : all[0]);
        Array.prototype.forEach.call(all, function (n) { n.tabIndex = n === target ? 0 : -1; });
      });
      list.tabIndex = list.querySelector('[role="option"]') ? -1 : 0;
    }

    // ---------- selection ----------
    function select(id, o) {
      o = o || {};
      if (id !== null && !items.some(function (it) { return it.id === id; })) return;
      sel = id;
      [peaksG, list].forEach(function (c) {
        Array.prototype.forEach.call(c.querySelectorAll('[role="option"]'), function (n) {
          var on = n.getAttribute('data-id') === id;
          n.setAttribute('aria-selected', on ? 'true' : 'false');
        });
      });
      syncTabStops();
      var row = side('board', id);
      if (row) {
        var lr = list.getBoundingClientRect(), rr = row.getBoundingClientRect();
        if (rr.top < lr.top) list.scrollTop -= lr.top - rr.top + 24; else if (rr.bottom > lr.bottom) list.scrollTop += rr.bottom - lr.bottom + 4;
      }
      var pk = side('ring', id);
      if (o.focus === 'ring' && pk) pk.focus({ preventScroll: true });
      if (o.focus === 'board' && row) row.focus({ preventScroll: true });
      refreshTools();
      if (opts.onSelect) opts.onSelect(get(id));
    }
    function get(id) { return items.find(function (it) { return it.id === id; }) || null; }

    // ---------- keyboard + pointer ----------
    // focus selects (focusin below), so roving needs no onMove
    var ringRov = VK.focus.roving(peaksG, { items: '.vk-notify__peak', orientation: 'horizontal', typeahead: false });
    var listRov = VK.focus.roving(list, { items: '.vk-notify__item', orientation: 'vertical' });
    function onFocusIn(e) {
      var n = e.target.closest && e.target.closest('[role="option"][data-id]');
      if (n && (ringSvg.contains(n) || list.contains(n)) && n.getAttribute('data-id') !== sel) select(n.getAttribute('data-id'));
    }
    function onClick(e) {
      var n = e.target.closest && e.target.closest('[role="option"][data-id]'); if (!n) return;
      select(n.getAttribute('data-id'), { focus: ringSvg.contains(n) ? 'ring' : 'board' });
    }
    function onKey(e) {
      var n = e.target.closest && e.target.closest('[role="option"][data-id]'); if (!n || e.ctrlKey || e.altKey || e.metaKey) return;
      var id = n.getAttribute('data-id'), it = get(id);
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (it) markRead(id, !it.read); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && list.contains(n)) {
        e.preventDefault();
        var rows = Array.prototype.slice.call(list.querySelectorAll('.vk-notify__item')), i = rows.indexOf(n);
        var next = rows[i + 1] || rows[i - 1];
        remove(id);
        if (next) select(next.getAttribute('data-id'), { focus: 'board' }); else list.focus();
      }
    }
    el.addEventListener('focusin', onFocusIn);
    el.addEventListener('click', onClick);
    el.addEventListener('keydown', onKey);

    // ---------- toolbar from the registry (MINIs) ----------
    function buildTools() {
      if (!opts.toolbar || !VK.actions) return;
      tools.textContent = '';
      VK.actions.forSurface(opts.toolbar, VK.actions.ctx(), { all: true }).forEach(function (a) {
        var m = VK.mini.fromAction(a); m.dataset.size = 'sm'; m.tabIndex = -1; tools.appendChild(m);
      });
      if (toolRoving) toolRoving.destroy();
      toolRoving = VK.focus.roving(tools, { items: '.vk-mini', orientation: 'horizontal', typeahead: false });
    }
    function refreshTools() {
      if (!opts.toolbar || !VK.actions) return;
      Array.prototype.forEach.call(tools.querySelectorAll('.vk-mini[data-action]'), function (m) {
        var a = VK.actions.get(m.dataset.action); if (a) VK.mini.refresh(m, a);
      });
      if (toolRoving) toolRoving.update();
    }
    if (opts.toolbar && VK.actions) {
      buildTools();
      unsub = VK.actions.subscribe(function (kind, a) {
        if ((kind === 'register' || kind === 'unregister') && a && a.at && a.at.indexOf(opts.toolbar) >= 0) buildTools();
        else if (kind === 'run' || kind === 'context') refreshTools();
      });
    }

    // ---------- the feature's MINI ----------
    function syncMinis() {
      var u = unread(), errs = items.filter(function (it) { return !it.read && it.kind === 'error'; }).length;
      minis.forEach(function (m) {
        VK.mini.set(m, { state: u ? (errs ? 'error' : 'running') : 'idle', progress: items.length ? u / items.length : 0, value: u ? String(u) : '' });
        m.setAttribute('aria-label', (opts.label || 'Értesítések') + ' — ' + (u ? u + ' olvasatlan' + (errs ? ', ebből ' + errs + ' hiba' : '') : 'nincs olvasatlan'));
      });
    }

    // ---------- mutations ----------
    function add(it) {
      var n = norm(it); n.fresh = true; items.push(n);
      live.textContent = 'Új ' + (n.kind === 'error' ? 'hiba' : 'esemény') + ': ' + n.title;
      render();
      setTimeout(function () { n.fresh = false; var a = side('ring', n.id), b = side('board', n.id); if (a) a.removeAttribute('data-new'); if (b) b.removeAttribute('data-new'); }, 1600);
      return n;
    }
    function remove(id) { items = items.filter(function (it) { return it.id !== id; }); if (sel === id) sel = null; render(); }
    function markRead(id, read) {
      id = id || sel; var it = get(id); if (!it) return;
      it.read = read === undefined ? true : !!read; render();
    }
    function markAllRead() { items.forEach(function (it) { it.read = true; }); render(); }
    function clear() { items = []; sel = null; render(); }
    function setFilter(v) { filter = v === 'unread' ? 'unread' : 'all'; if (filter === 'unread' && sel && get(sel) && get(sel).read) sel = null; render(); }

    var api = {
      el: el, add: add, remove: remove, markRead: markRead, markAllRead: markAllRead, clear: clear, select: select,
      selected: function () { return get(sel); }, items: function () { return items.slice(); }, unread: unread,
      setFilter: setFilter, filter: function () { return filter; }, refresh: render,
      mini: function (o) {
        o = o || {};
        var m = VK.mini.create({ icon: 'bell', label: opts.label || 'Értesítések', size: o.size || 'md', meter: 'ticks', caption: o.caption, onClick: o.onClick });
        minis.push(m); syncMinis(); return m;
      },
      destroy: function () {
        if (ro) ro.disconnect(); ringRov.destroy(); listRov.destroy(); if (toolRoving) toolRoving.destroy(); if (unsub) unsub();
        el.removeEventListener('focusin', onFocusIn); el.removeEventListener('click', onClick); el.removeEventListener('keydown', onKey);
        el.textContent = ''; el.classList.remove('vk-notify');
      }
    };
    render();
    return api;
  }

  VK.notify = { mount: mount };
})(typeof window !== 'undefined' ? window : globalThis);
