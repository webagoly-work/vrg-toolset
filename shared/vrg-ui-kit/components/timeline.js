/* VRG UI Kit — components/timeline.js — swimlane timeline: one lane per line of work, chips = sessions (spans),
   commits (dots) and releases (small squares), a today marker and the ice playhead you can drag.
     var tl = VK.timeline.mount(el, {lanes, items, from, to, zoom, now, playhead, follow, label, actions})
       lanes: [{id, label, icon?, state?, progress?}]  — state/progress drive the lane's MINI (click = highlight lane)
       items: [{id, lane, kind:'session'|'commit'|'release', start, end?, label, state?:'running'|'done'|'parked'}]
       times: 'YYYY-MM-DD', 'YYYY-MM-DDTHH:MM', ms or Date — read as wall-clock time (no time-zone shifts)
       zoom: 'day' | 'week' | 'month' (Nap / Hét / Hónap)   actions: a registry surface id ('toolbar:x') shown as MINIs
     tl.setRange(from, to) · tl.setPlayhead(t, {silent}) · tl.setZoom(z) · tl.setFollow(bool) · tl.setItems(items, lanes?)
     tl.select(id) · tl.focusItem(id) · tl.scrollTo(t) · tl.zoomIn() · tl.zoomOut() · tl.refreshActions() · tl.state() · tl.on(type, fn) → off · tl.destroy()
   Events (tl.on and bubbling DOM 'vk:timeline-<type>'): open {item} · select {item|null} · focus {item} ·
     playhead {t, text} · zoom {zoom}
   Keyboard: the chips are one roving grid — ←/→ in time, ↑/↓ between lanes (nearest in time), Home/End lane
     start/end, Ctrl+Home/End first/last overall, Enter = open, Space = select, Esc = clear selection; ← from a
     lane's first chip reaches the lane MINI. + / − zoom anywhere inside. Playhead (role=slider): ←/→ one step
     (zoom-dependent), PageUp/PageDown a week, Home/End range ends; drag it or click the time axis.
   Suggested app actions (register them; pass the surface as opts.actions): timeline.today, timeline.follow,
     timeline.zoom-in, timeline.zoom-out.
   Depends on: core, mini (CSS: base, button, mini). */
(function (root) {
  'use strict';
  var VK = root.VK = root.VK || {};
  if (VK.timeline) return;

  var DAY = 864e5, HOUR = 36e5, MIN = 6e4;
  var MON = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.'];
  var MONL = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];
  var WD = ['V', 'H', 'K', 'Sze', 'Cs', 'P', 'Szo'];
  var ZOOM = {
    day: { label: 'Nap', ppd: 144, step: HOUR, snap: 15 * MIN },
    week: { label: 'Hét', ppd: 30, step: 6 * HOUR, snap: HOUR },
    month: { label: 'Hónap', ppd: 9, step: DAY, snap: 6 * HOUR }
  };
  var ORDER = ['month', 'week', 'day'];
  var KIND = { session: 'munkamenet', commit: 'commit', release: 'kiadás' };
  var STATE = { running: 'fut', done: 'kész', parked: 'parkolva' };

  function T(v) {
    if (v === null || v === undefined || v === '') return NaN;
    if (typeof v === 'number') return v;
    if (v instanceof Date) return Date.UTC(v.getFullYear(), v.getMonth(), v.getDate(), v.getHours(), v.getMinutes());
    var m = String(v).match(/^(\d{4})-(\d\d)-(\d\d)(?:[T ](\d\d):(\d\d))?/);
    return m ? Date.UTC(+m[1], m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)) : NaN;
  }
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function day0(t) { return Math.floor(t / DAY) * DAY; }
  function dt(t) { return new Date(t); }
  function fDate(t) { var x = dt(t); return MON[x.getUTCMonth()] + ' ' + x.getUTCDate() + '.'; }
  function fTime(t) { var x = dt(t); return p2(x.getUTCHours()) + ':' + p2(x.getUTCMinutes()); }
  function fFull(t, time) { return dt(t).getUTCFullYear() + '. ' + fDate(t) + (time ? ' ' + fTime(t) : ''); }
  function fSpan(a, b) { return day0(a) === day0(b) ? fDate(a) + ' ' + fTime(a) + '–' + fTime(b) : fDate(a) + ' – ' + fDate(b); }
  function isoWeek(t) {
    var x = dt(day0(t)), wd = (x.getUTCDay() + 6) % 7;
    x.setUTCDate(x.getUTCDate() - wd + 3);
    var y0 = Date.UTC(x.getUTCFullYear(), 0, 4), w0 = (dt(y0).getUTCDay() + 6) % 7;
    return 1 + Math.round((x.getTime() - y0 + w0 * DAY - 3 * DAY) / (7 * DAY));
  }

  function mount(el, o) {
    o = o || {};
    var em = VK.emitter();
    var S = { lanes: [], items: [], byLane: {}, from: 0, to: 0, zoom: ZOOM[o.zoom] ? o.zoom : 'week', ppd: 30,
      now: o.now !== undefined ? T(o.now) : T(new Date()), ph: null, follow: !!o.follow, sel: null, activeEl: null, hl: null };
    var offs = [], drag = false, lastW = 0;

    el.classList.add('vk-timeline');
    if (!el.hasAttribute('data-vk-hop')) el.setAttribute('data-vk-hop', '');
    el.textContent = '';

    // ---- bar: title · zoom · action minis · playhead readout ----
    var title = VK.el('span.vk-label.vk-timeline__title');
    var zg = VK.el('div.vk-btn-group.vk-timeline__zoom', { role: 'radiogroup', 'aria-label': 'Nagyítás' });
    ['day', 'week', 'month'].forEach(function (z) {
      zg.appendChild(VK.el('button.vk-btn.vk-btn--sm', { type: 'button', role: 'radio', 'data-zoom': z, text: ZOOM[z].label, title: ZOOM[z].label + ' nézet (+ / −)' }));
    });
    var minis = VK.el('div.vk-timeline__minis', { role: 'group', 'aria-label': 'Idővonal funkciók' });
    var out = VK.el('span.vk-timeline__readout.vk-num', { 'aria-hidden': 'true' });
    var bar = VK.el('div.vk-timeline__bar', null, [title, zg, minis, out]);

    // ---- view: sticky axis + lanes grid + marks ----
    var corner = VK.el('div.vk-timeline__corner', null, VK.el('span.vk-label', { text: o.laneTitle || 'Sávok' }));
    var ticks = VK.el('div.vk-timeline__ticks', { 'aria-hidden': 'true' });
    var todayTag = VK.el('span.vk-timeline__today-tag', { 'aria-hidden': 'true', text: 'MA' });
    var phTxt = VK.el('span.vk-timeline__ph-txt.vk-num', { 'aria-hidden': 'true' });
    var ph = VK.el('div.vk-timeline__ph', { role: 'slider', tabindex: '0', 'aria-label': 'Lejátszófej', 'aria-orientation': 'horizontal' }, phTxt);
    var scale = VK.el('div.vk-timeline__scale', { title: 'Kattints vagy húzd: lejátszófej' }, [ticks, todayTag, ph]);
    var axis = VK.el('div.vk-timeline__axis', null, [corner, scale]);
    var grid = VK.el('div.vk-timeline__grid', { role: 'grid', 'aria-label': o.label || 'Idővonal', 'aria-readonly': 'true' });
    var todayLine = VK.el('span.vk-timeline__today');
    var phLine = VK.el('span.vk-timeline__ph-line');
    var marks = VK.el('div.vk-timeline__marks', { 'aria-hidden': 'true' }, [todayLine, phLine]);
    var empty = VK.el('p.vk-timeline__empty', { text: o.emptyText || 'Nincs esemény ebben az időszakban.', hidden: true });
    var canvas = VK.el('div.vk-timeline__canvas', null, [axis, grid, marks]);
    var view = VK.el('div.vk-timeline__view.vk-scroll', null, canvas);
    el.append(bar, view, empty);

    function emit(type, data) { em.emit(type, data); VK.fire(el, 'timeline-' + type, data); }
    function listen(node, type, fn, opt) { node.addEventListener(type, fn, opt); offs.push(function () { node.removeEventListener(type, fn, opt); }); }
    function headW() { return corner.offsetWidth; }
    function X(t) { return (t - S.from) / DAY * S.ppd; }

    // ---- data ----
    function norm(items) {
      return (items || []).map(function (src) {
        var kind = KIND[src.kind] ? src.kind : 'session';
        var t0 = T(src.start), t1 = T(src.end);
        if (isNaN(t1)) t1 = kind === 'session' ? (src.state === 'running' ? Math.max(S.now, t0 + HOUR) : t0 + HOUR) : t0;
        return { src: src, id: String(src.id), lane: src.lane, kind: kind, t0: t0, t1: Math.max(t0, t1), label: src.label || '', state: src.state || (kind === 'session' ? 'done' : '') };
      }).filter(function (it) { return !isNaN(it.t0); });
    }
    function derive() {
      if (isNaN(S.from) || isNaN(S.to) || S.to <= S.from) {
        var a = Infinity, b = -Infinity;
        S.items.forEach(function (it) { a = Math.min(a, it.t0); b = Math.max(b, it.t1); });
        if (!isFinite(a)) { a = S.now - 14 * DAY; b = S.now + 7 * DAY; }
        S.from = day0(a); S.to = day0(b) + DAY;
      }
    }

    function chip(it, ln, li, idx) {
      var when = it.kind === 'session' ? fSpan(it.t0, it.t1) : fDate(it.t0) + ' ' + fTime(it.t0);
      var desc = ln.label + ' — ' + (it.kind === 'session' ? '' : KIND[it.kind] + ' ') + it.label + ', ' + when + (STATE[it.state] && it.kind === 'session' ? ', ' + STATE[it.state] : '');
      var c = VK.el('div.vk-timeline__chip', { role: 'gridcell', tabindex: '-1', 'data-kind': it.kind, 'data-id': it.id, 'aria-selected': 'false', 'aria-label': desc, title: desc });
      if (it.state) c.dataset.state = it.state;
      if (it.kind !== 'commit') c.appendChild(VK.el('span.vk-timeline__txt', { 'aria-hidden': 'true', text: it.label }));
      c._tl = { li: li, idx: idx }; c._item = it;
      return c;
    }

    function build() {
      var hadFocus = el.contains(document.activeElement) && grid.contains(document.activeElement);
      var keep = S.activeEl && S.activeEl._item ? S.activeEl._item.id : null;
      grid.textContent = ''; S.byLane = {}; S.activeEl = null;
      S.lanes.forEach(function (ln) { S.byLane[ln.id] = []; });
      S.items.forEach(function (it) { if (S.byLane[it.lane]) S.byLane[it.lane].push(it); });
      S.lanes.forEach(function (ln, li) {
        var list = S.byLane[ln.id].sort(function (a, b) { return a.t0 - b.t0 || a.t1 - b.t1; });
        var ends = [];
        list.forEach(function (it) {
          if (it.kind !== 'session') return;
          var r = 0; while (r < ends.length && ends[r] > it.t0) r++;
          ends[r] = it.t1; it.row = r;
        });
        var commits = list.filter(function (it) { return it.kind === 'commit'; }).length;
        var row = VK.el('div.vk-timeline__lane', { role: 'row', 'data-lane': ln.id, style: '--_rows:' + Math.max(1, ends.length) });
        var m = VK.mini.create({ icon: ln.icon || 'swimlane', label: ln.label + ' sáv kiemelése', size: 'sm', pressed: S.hl === ln.id, state: ln.state, progress: ln.progress });
        m.tabIndex = -1; m.classList.add('vk-timeline__lmini'); m.dataset.lane = ln.id; m._tl = { li: li, idx: 0 };
        var head = VK.el('div.vk-timeline__head', { role: 'rowheader' }, [m,
          VK.el('span.vk-timeline__name', { text: ln.label, title: ln.label }),
          VK.el('span.vk-timeline__count', { text: String(commits), title: commits + ' commit' })]);
        var track = VK.el('div.vk-timeline__track');
        list.forEach(function (it, k) { it.el = chip(it, ln, li, k + 1); if (it.kind === 'session') it.el.style.setProperty('--_r', it.row); track.appendChild(it.el); });
        row.append(head, track);
        grid.appendChild(row);
        ln.mini = m; ln.row = row;
      });
      grid.setAttribute('aria-rowcount', S.lanes.length);
      empty.hidden = S.items.length > 0;
      title.textContent = (o.title || 'Idővonal') + ' // ' + S.lanes.length + ' sáv';
      applyHighlight();
      var start = keep && find(keep) ? find(keep).el : initial();
      if (start) activate(start, false);
      if (hadFocus && start) start.focus({ preventScroll: true });
      if (S.sel) { var s = find(S.sel.id); S.sel = s || null; if (s) s.el.setAttribute('aria-selected', 'true'); }
    }
    function initial() {
      for (var li = 0; li < S.lanes.length; li++) {
        var list = S.byLane[S.lanes[li].id];
        if (list.length) { var k = nearest(li, S.now); return cell(li, k); }
      }
      return S.lanes.length ? S.lanes[0].mini : null;
    }
    function find(id) { id = String(id); return S.items.filter(function (it) { return it.id === id; })[0] || null; }
    function cell(li, idx) { var ln = S.lanes[li]; return idx === 0 ? ln.mini : S.byLane[ln.id][idx - 1].el; }
    function len(li) { return S.byLane[S.lanes[li].id].length; }
    function mid(it) { return (it.t0 + it.t1) / 2; }
    function nearest(li, t) {
      var list = S.byLane[S.lanes[li].id], best = 0, bd = Infinity;
      list.forEach(function (it, k) { var d = Math.abs(mid(it) - t); if (d < bd) { bd = d; best = k; } });
      return best + 1;
    }

    // ---- layout (zoom-dependent) ----
    function layout() {
      var days = Math.max(1, (S.to - S.from) / DAY);
      var avail = view.clientWidth - headW() - 2;
      S.ppd = Math.max(ZOOM[S.zoom].ppd, avail > 0 ? avail / days : 0);
      var ppd = S.ppd, monOff = ((8 - dt(S.from).getUTCDay()) % 7) * ppd;
      el.style.setProperty('--_tw', Math.round(days * ppd) + 'px');
      el.style.setProperty('--_g1', (S.zoom === 'month' ? 7 * ppd : ppd) + 'px');
      el.style.setProperty('--_g2', 7 * ppd + 'px');
      el.style.setProperty('--_g2o', monOff + 'px');
      S.items.forEach(function (it) {
        if (!it.el) return;
        var x = X(it.t0);
        it.el.style.left = x + 'px';
        if (it.kind === 'session') {
          var w = Math.max(X(it.t1) - x, 2);
          it.el.style.width = w + 'px';
          it.el.toggleAttribute('data-narrow', w < 40);
        }
      });
      Array.prototype.forEach.call(zg.children, function (b) {
        var on = b.dataset.zoom === S.zoom; b.setAttribute('aria-checked', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1;
      });
      renderTicks(); placeMarks();
      empty.style.top = (view.offsetTop + axis.offsetHeight + 12) + 'px';
      lastW = view.clientWidth;
    }

    function renderTicks() {
      ticks.textContent = '';
      var f = document.createDocumentFragment(), z = S.zoom, ppd = S.ppd, lastTop = -1e9;
      function tk(x, k) { f.appendChild(VK.el('span.vk-timeline__tk', { 'data-k': k, style: 'left:' + x + 'px' })); }
      function lb(x, r, txt) {
        if (r === 'top') { if (x - lastTop < 110 && lastTop > -1e9) return; lastTop = x; }
        f.appendChild(VK.el('span.vk-timeline__tl', { 'data-r': r, style: 'left:' + x + 'px', text: txt }));
      }
      for (var t = day0(S.from); t < S.to; t += DAY) {
        var x = X(t), d = dt(t), wd = d.getUTCDay(), dom = d.getUTCDate(), first = t === day0(S.from);
        if (z === 'day') {
          tk(x, 'major'); lb(x, 'top', WD[wd] + ' ' + fDate(t));
          for (var h = 3; h < 24; h += 3) { var hx = x + h / 24 * ppd; tk(hx, h % 6 ? 'minor' : 'mid'); if (!(h % 6)) lb(hx, 'bot', p2(h)); }
        } else if (z === 'week') {
          tk(x, wd === 1 ? 'major' : 'minor');
          lb(x, 'bot', String(dom));
          if (wd === 1 || first) lb(x, 'top', fDate(t) + ' · ' + isoWeek(t) + '. hét');
        } else {
          if (dom === 1 || first) { tk(x, 'major'); lb(x, 'top', MONL[d.getUTCMonth()] + (d.getUTCMonth() === 0 || first ? ' ' + d.getUTCFullYear() : '')); }
          else if (wd === 1) tk(x, 'mid');
          if (wd === 1 && ppd * 7 >= 24) lb(x, 'bot', String(dom));
        }
      }
      ticks.appendChild(f);
    }

    function placeMarks() {
      var inNow = S.now >= S.from && S.now <= S.to;
      todayLine.hidden = todayTag.hidden = !inNow;
      if (inNow) { todayLine.style.left = X(S.now) + 'px'; todayTag.style.left = X(S.now) + 'px'; }
      if (S.ph !== null) setPlayhead(S.ph, { silent: true, keep: true });
    }

    function keepVisible(x) {
      var vis = view.clientWidth - headW(), l = view.scrollLeft;
      if (x < l + 24) view.scrollLeft = Math.max(0, x - 48);
      else if (x > l + vis - 24) view.scrollLeft = x - vis + 48;
    }

    // ---- playhead ----
    function setPlayhead(t, opt) {
      opt = opt || {};
      t = T(t); if (isNaN(t)) return;
      t = VK.clamp(t, S.from, S.to);
      var moved = t !== S.ph; S.ph = t;
      var x = X(t), txt = fFull(t, true);
      ph.style.left = x + 'px'; phLine.style.left = x + 'px';
      phTxt.textContent = S.zoom === 'month' ? fDate(t) : fDate(t) + ' ' + fTime(t);
      ph.setAttribute('aria-valuemin', '0');
      ph.setAttribute('aria-valuemax', String(Math.round((S.to - S.from) / MIN)));
      ph.setAttribute('aria-valuenow', String(Math.round((t - S.from) / MIN)));
      ph.setAttribute('aria-valuetext', txt);
      out.textContent = 'Lejátszófej · ' + txt;
      if (S.follow && !opt.keep) keepVisible(x);
      if (moved && !opt.silent) emit('playhead', { t: t, text: txt });
    }
    function snap(t) { var s = ZOOM[S.zoom].snap; return Math.round(t / s) * s; }
    function tAt(cx) { var r = scale.getBoundingClientRect(); return S.from + (cx - r.left) / S.ppd * DAY; }

    listen(scale, 'pointerdown', function (e) {
      if (e.button) return;
      e.preventDefault(); drag = true; el.setAttribute('data-dragging', '');
      try { scale.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
      setPlayhead(snap(tAt(e.clientX)));
      ph.focus({ preventScroll: true });
    });
    listen(scale, 'pointermove', function (e) { if (drag) setPlayhead(snap(tAt(e.clientX)), { keep: true }); });
    function endDrag() { drag = false; el.removeAttribute('data-dragging'); }
    listen(scale, 'pointerup', endDrag); listen(scale, 'pointercancel', endDrag);
    listen(ph, 'keydown', function (e) {
      if (e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;
      var st = ZOOM[S.zoom].step, t = S.ph, n = null;
      switch (e.key) {
        case 'ArrowRight': case 'ArrowUp': n = Math.floor(t / st) * st + st; break;
        case 'ArrowLeft': case 'ArrowDown': n = Math.ceil(t / st) * st - st; break;
        case 'PageUp': n = t + 7 * DAY; break;
        case 'PageDown': n = t - 7 * DAY; break;
        case 'Home': n = S.from; break;
        case 'End': n = S.to; break;
        default: return;
      }
      e.preventDefault(); setPlayhead(n); keepVisible(X(S.ph));
    });

    // ---- focus, selection, highlight ----
    function activate(node, focus) {
      if (S.activeEl && S.activeEl !== node) S.activeEl.tabIndex = -1;
      S.activeEl = node; node.tabIndex = 0;
      if (focus) { node.focus({ preventScroll: true }); node.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
      if (focus && node._item) emit('focus', { item: node._item.src });
    }
    function select(it, silent) {
      if (S.sel && S.sel.el) S.sel.el.setAttribute('aria-selected', 'false');
      S.sel = it || null;
      if (S.sel && S.sel.el) S.sel.el.setAttribute('aria-selected', 'true');
      if (!silent) emit('select', { item: it ? it.src : null });
    }
    function open(it) { select(it, true); emit('open', { item: it.src }); }
    function toggleLane(id) { S.hl = S.hl === id ? null : id; applyHighlight(); }
    function applyHighlight() {
      S.lanes.forEach(function (ln) {
        if (!ln.row) return;
        ln.row.toggleAttribute('data-dim', !!S.hl && S.hl !== ln.id);
        VK.mini.set(ln.mini, { pressed: S.hl === ln.id });
      });
    }

    listen(grid, 'click', function (e) {
      var m = e.target.closest('.vk-timeline__lmini');
      if (m) { activate(m, false); toggleLane(m.dataset.lane); return; }
      var c = e.target.closest('.vk-timeline__chip'); if (!c) return;
      activate(c, false); c.focus({ preventScroll: true }); select(c._item);
    });
    listen(grid, 'dblclick', function (e) { var c = e.target.closest('.vk-timeline__chip'); if (c) open(c._item); });
    listen(grid, 'keydown', function (e) {
      var node = e.target.closest && e.target.closest('.vk-timeline__chip, .vk-timeline__lmini');
      if (!node || !node._tl || e.altKey || e.metaKey) return;
      if (e.shiftKey && /^Arrow/.test(e.key)) return;                       // Shift+Arrow = region hop
      if (e.ctrlKey && e.key !== 'Home' && e.key !== 'End') return;
      var li = node._tl.li, idx = node._tl.idx, n = null, l, dir;
      switch (e.key) {
        case 'ArrowRight': n = idx < len(li) ? [li, idx + 1] : false; break;
        case 'ArrowLeft': n = idx > 0 ? [li, idx - 1] : false; break;
        case 'ArrowDown': case 'ArrowUp':
          dir = e.key === 'ArrowDown' ? 1 : -1; l = li + dir;
          while (idx > 0 && l >= 0 && l < S.lanes.length && !len(l)) l += dir;
          n = l < 0 || l >= S.lanes.length ? false : [l, idx === 0 ? 0 : nearest(l, mid(node._item))];
          break;
        case 'Home':
          if (e.ctrlKey) { for (l = 0; l < S.lanes.length && !len(l); l++); n = l < S.lanes.length ? [l, 1] : false; }
          else n = [li, len(li) ? 1 : 0];
          break;
        case 'End':
          if (e.ctrlKey) { for (l = S.lanes.length - 1; l >= 0 && !len(l); l--); n = l >= 0 ? [l, len(l)] : false; }
          else n = [li, len(li)];
          break;
        case 'Enter': if (!node._item) return; e.preventDefault(); open(node._item); return;
        case ' ': if (!node._item) return; e.preventDefault(); select(S.sel === node._item ? null : node._item); return;
        case 'Escape': if (!S.sel) return; e.preventDefault(); select(null); return;
        default: return;
      }
      e.preventDefault();
      if (n) activate(cell(n[0], n[1]), true);
    });

    // ---- zoom ----
    function setZoom(z, anchor) {
      if (!ZOOM[z]) return;
      var vis = view.clientWidth - headW();
      if (anchor === undefined) {
        var a = document.activeElement;
        if (a && a._item && grid.contains(a)) anchor = mid(a._item);
        else if (S.ph !== null && X(S.ph) >= view.scrollLeft && X(S.ph) <= view.scrollLeft + vis) anchor = S.ph;
        else anchor = S.from + (view.scrollLeft + vis / 2) / S.ppd * DAY;
      }
      var sx = X(anchor) - view.scrollLeft;
      if (sx < 0 || sx > vis) sx = vis / 2;
      var changed = z !== S.zoom;
      S.zoom = z; layout();
      view.scrollLeft = X(anchor) - sx;
      if (changed) { emit('zoom', { zoom: z }); refreshActions(); }
    }
    function zoomBy(d) { var i = ORDER.indexOf(S.zoom) + d; if (i >= 0 && i < ORDER.length) setZoom(ORDER[i]); }
    listen(zg, 'click', function (e) { var b = e.target.closest('[data-zoom]'); if (b) setZoom(b.dataset.zoom); });
    listen(zg, 'keydown', function (e) {
      if (e.shiftKey || !/^Arrow(Left|Right|Up|Down)$/.test(e.key)) return;
      var list = Array.prototype.slice.call(zg.children), i = list.indexOf(document.activeElement); if (i < 0) return;
      var n = (i + (/Right|Down/.test(e.key) ? 1 : -1) + list.length) % list.length;
      e.preventDefault(); setZoom(list[n].dataset.zoom); list[n].focus();
    });
    listen(el, 'keydown', function (e) {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if (VK.focus && VK.focus.isEditable(e.target)) return;
      if (e.key === '+' || e.key === '=') zoomBy(1);
      else if (e.key === '-' || e.key === '_') zoomBy(-1);
      else return;
      e.preventDefault();
      var a = document.activeElement; if (a && grid.contains(a)) a.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });

    // ---- registry actions as minis ----
    var unsub = null;
    function renderActions() {
      minis.textContent = '';
      minis.hidden = !(o.actions && VK.actions);
      if (minis.hidden) return;
      VK.actions.forSurface(o.actions, null, { all: true }).forEach(function (a) {
        var b = VK.mini.fromAction(a); b.dataset.size = 'sm'; minis.appendChild(b);
      });
    }
    function refreshActions() {
      if (!o.actions || !VK.actions) return;
      Array.prototype.forEach.call(minis.querySelectorAll('[data-action]'), function (b) { var a = VK.actions.get(b.dataset.action); if (a) VK.mini.refresh(b, a); });
    }
    if (o.actions && VK.actions) unsub = VK.actions.subscribe(function (k) { if (k === 'register' || k === 'unregister') renderActions(); else refreshActions(); });

    // ---- resize / density ----
    var ro = root.ResizeObserver ? new ResizeObserver(function () { if (view.clientWidth !== lastW) setZoom(S.zoom); }) : null;
    if (ro) ro.observe(view);
    listen(document, 'vk:density', function () { setZoom(S.zoom); });

    // ---- API ----
    function scrollTo(t, frac) { view.scrollLeft = Math.max(0, X(T(t)) - (view.clientWidth - headW()) * (frac === undefined ? 0.5 : frac)); }
    function setRange(from, to) {
      S.from = day0(T(from)); S.to = T(to); if (!isNaN(S.to) && S.to !== day0(S.to)) S.to = day0(S.to) + DAY;
      derive(); layout();
    }
    function setItems(items, lanes) {
      if (lanes) S.lanes = lanes.map(function (l) { return { id: l.id, label: l.label || l.id, icon: l.icon, state: l.state, progress: l.progress }; });
      S.items = norm(items); build(); layout();
    }

    S.lanes = (o.lanes || []).map(function (l) { return { id: l.id, label: l.label || l.id, icon: l.icon, state: l.state, progress: l.progress }; });
    S.items = norm(o.items);
    S.from = day0(T(o.from)); S.to = T(o.to);
    if (!isNaN(S.to) && S.to !== day0(S.to)) S.to = day0(S.to) + DAY;
    derive();
    S.ph = VK.clamp(o.playhead !== undefined ? T(o.playhead) : S.now, S.from, S.to);
    renderActions();
    build(); layout();
    scrollTo(S.ph, 0.7);

    var api = {
      setRange: setRange, setItems: setItems,
      setPlayhead: function (t, opt) { setPlayhead(t, opt); },
      setZoom: function (z) { setZoom(z); },
      zoomIn: function () { zoomBy(1); }, zoomOut: function () { zoomBy(-1); },
      setFollow: function (v) { S.follow = !!v; if (S.follow) keepVisible(X(S.ph)); refreshActions(); },
      select: function (id) { var it = id === null ? null : find(id); select(it, true); if (it) activate(it.el, false); },
      focusItem: function (id) { var it = find(id); if (it) activate(it.el, true); },
      scrollTo: function (t) { scrollTo(t); },
      refreshActions: refreshActions,
      state: function () { return { from: S.from, to: S.to, zoom: S.zoom, playhead: S.ph, follow: S.follow, now: S.now, selected: S.sel ? S.sel.src : null }; },
      on: em.on,
      destroy: function () {
        offs.forEach(function (f) { f(); }); if (ro) ro.disconnect(); if (unsub) unsub();
        el.textContent = ''; el.classList.remove('vk-timeline');
      }
    };
    el._vkTimeline = api;
    return api;
  }

  VK.timeline = { mount: mount, parse: T, format: fFull };
})(typeof window !== 'undefined' ? window : globalThis);
