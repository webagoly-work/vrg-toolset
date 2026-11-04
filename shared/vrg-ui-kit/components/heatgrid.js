/* VRG UI Kit — components/heatgrid.js — contribution-style pixel grid: weeks × days (Monday first), intensity 0–4
   through --vk-heat-0…4, Hungarian day/month labels, legend "Kevesebb ▢▢▢▢▢ Több", optional multi-year stack with
   a yearly total, a live readout ("2026. okt. 21. — 7 commit").
     var h = VK.heatgrid.mount(el, {years:[2026, 2025], data, unit:'commit', levels:[1,3,6,10], now, title})
       data: {'2026-10-21': 7, …} or function('2026-10-21') → number · levels: lower bounds of intensity 1…4
     h.setData(data) · h.select('2026-10-21') · h.focusDate('2026-10-21') · h.on(type, fn) → off · h.destroy()
   Events (h.on and bubbling DOM 'vk:heatgrid-<type>'): select {date, t, count, level} · focus {date, t, count}
   Keyboard (role=grid, one tab stop across every year): ↑/↓ one day, ←/→ one week, Home/End first/last day of the
     year (Ctrl: of the whole stack), PageUp/PageDown one month, Enter/Space selects the day.
   Depends on: core. */
(function (root) {
  'use strict';
  var VK = root.VK = root.VK || {};
  if (VK.heatgrid) return;

  var DAY = 864e5;
  var MON = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.'];
  var MON_LBL = ['jan', 'feb', 'márc', 'ápr', 'máj', 'jún', 'júl', 'aug', 'szept', 'okt', 'nov', 'dec'];
  var DAYS = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'];
  var DAYL = ['hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat', 'vasárnap'];

  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function T(v) {
    if (v === null || v === undefined || v === '') return NaN;
    if (typeof v === 'number') return Math.floor(v / DAY) * DAY;
    if (v instanceof Date) return Date.UTC(v.getFullYear(), v.getMonth(), v.getDate());
    var m = String(v).match(/^(\d{4})-(\d\d)-(\d\d)/);
    return m ? Date.UTC(+m[1], m[2] - 1, +m[3]) : NaN;
  }
  function key(t) { var d = new Date(t); return d.getUTCFullYear() + '-' + p2(d.getUTCMonth() + 1) + '-' + p2(d.getUTCDate()); }
  function fDate(t) { var d = new Date(t); return d.getUTCFullYear() + '. ' + MON[d.getUTCMonth()] + ' ' + d.getUTCDate() + '.'; }
  function mon0(t) { return (new Date(t).getUTCDay() + 6) % 7; }       // Monday = 0
  function num(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  function addMonths(t, n) {
    var d = new Date(t), y = d.getUTCFullYear(), m = d.getUTCMonth() + n, dd = d.getUTCDate();
    var last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return Date.UTC(y, m, Math.min(dd, last));
  }

  function mount(el, o) {
    o = o || {};
    var em = VK.emitter(), offs = [];
    var S = { years: (o.years || [new Date().getFullYear()]).slice(), data: o.data || {}, unit: o.unit || 'commit',
      levels: o.levels || [1, 3, 6, 10], now: o.now !== undefined ? T(o.now) : T(new Date()), cells: {}, active: null, sel: null };

    el.classList.add('vk-heatgrid');
    if (!el.hasAttribute('data-vk-hop')) el.setAttribute('data-vk-hop', '');
    el.textContent = '';

    var legend = VK.el('span.vk-heatgrid__legend', { 'aria-label': 'Jelmagyarázat: kevesebb, öt fokozat, több' }, [
      VK.el('span', { 'aria-hidden': 'true', text: 'Kevesebb' }),
      [0, 1, 2, 3, 4].map(function (l) { return VK.el('span.vk-heatgrid__sw', { 'data-l': String(l), 'aria-hidden': 'true' }); }),
      VK.el('span', { 'aria-hidden': 'true', text: 'Több' })
    ].reduce(function (a, b) { return a.concat(b); }, []));
    var head = VK.el('div.vk-heatgrid__head', null, [VK.el('span.vk-label', { text: o.title || 'Aktivitás // ' + S.unit }), legend]);
    var stack = VK.el('div.vk-heatgrid__stack');
    var readout = VK.el('div.vk-heatgrid__readout', { role: 'status', 'aria-live': 'polite' });
    el.append(head, stack, readout);

    function emit(type, data) { em.emit(type, data); VK.fire(el, 'heatgrid-' + type, data); }
    function listen(n, type, fn) { n.addEventListener(type, fn); offs.push(function () { n.removeEventListener(type, fn); }); }
    function count(t) { var k = key(t), v = typeof S.data === 'function' ? S.data(k) : S.data[k]; return +v || 0; }
    function level(n) { var l = 0; S.levels.forEach(function (b, i) { if (n >= b) l = i + 1; }); return Math.min(4, l); }
    function label(t, n) { return fDate(t) + ', ' + DAYL[mon0(t)] + ' — ' + (t > S.now ? 'nincs még adat' : n + ' ' + S.unit); }

    function build() {
      stack.textContent = ''; S.cells = {};
      S.years.forEach(function (y) {
        var y0 = Date.UTC(y, 0, 1), y1 = Date.UTC(y + 1, 0, 1), days = Math.round((y1 - y0) / DAY), lead = mon0(y0);
        var weeks = Math.ceil((lead + days) / 7), total = 0, active = 0, peak = 0;
        var months = VK.el('div.vk-heatgrid__months', { 'aria-hidden': 'true' });
        for (var m = 0; m < 12; m++) {
          var col = Math.floor((lead + Math.round((Date.UTC(y, m, 1) - y0) / DAY)) / 7);
          months.appendChild(VK.el('span.vk-heatgrid__mon', { style: '--_c:' + col, text: MON_LBL[m] }));
        }
        var dayl = VK.el('div.vk-heatgrid__days', { 'aria-hidden': 'true' }, DAYS.map(function (d) { return VK.el('span', { text: d }); }));
        var grid = VK.el('div.vk-heatgrid__grid', { role: 'grid', 'aria-label': y + ' — ' + S.unit + ' naponta', 'aria-readonly': 'true', 'aria-rowcount': '7' });
        for (var r = 0; r < 7; r++) {
          var row = VK.el('div.vk-heatgrid__row', { role: 'row' });
          for (var w = 0; w < weeks; w++) {
            var i = w * 7 + r - lead;
            if (i < 0 || i >= days) { row.appendChild(VK.el('span.vk-heatgrid__pad', { 'aria-hidden': 'true' })); continue; }
            var t = y0 + i * DAY, n = t > S.now ? 0 : count(t), lv = level(n);
            if (t <= S.now) { total += n; if (n) active++; peak = Math.max(peak, n); }
            var c = VK.el('div.vk-heatgrid__cell', { role: 'gridcell', tabindex: '-1', 'aria-selected': 'false', 'data-l': String(lv), 'aria-label': label(t, n), 'data-date': key(t) });
            if (t > S.now) c.setAttribute('data-future', '');
            if (t === S.now) c.setAttribute('data-today', '');
            c._t = t; c._n = n;
            S.cells[key(t)] = c;
            row.appendChild(c);
          }
          grid.appendChild(row);
        }
        var plot = VK.el('div.vk-heatgrid__plot', null, [VK.el('span'), months, dayl, grid]);
        var yhead = VK.el('div.vk-heatgrid__yhead', null, [
          VK.el('span.vk-title.vk-heatgrid__yn', { text: String(y) }),
          VK.el('span.vk-num.vk-heatgrid__total', { text: num(total) + ' ' + S.unit }),
          VK.el('span.vk-label', { text: active + ' aktív nap · csúcs ' + peak })
        ]);
        stack.appendChild(VK.el('div.vk-heatgrid__year', { 'data-year': String(y) }, [yhead, VK.el('div.vk-heatgrid__scroll.vk-scroll', null, plot)]));
      });
      var start = S.active && S.cells[key(S.active)] ? S.active : bounds()[2];
      activate(start, false);
      reveal(start);
      if (S.sel && S.cells[key(S.sel)]) S.cells[key(S.sel)].setAttribute('aria-selected', 'true');
    }
    // scroll every year's strip so the active day's week is in view (the same offset for every year)
    function reveal(t) {
      var c = S.cells[key(t)]; if (!c) return;
      var sc = c.closest('.vk-heatgrid__scroll'); if (!sc || sc.scrollWidth <= sc.clientWidth) return;
      var x = c.getBoundingClientRect().left - sc.getBoundingClientRect().left + sc.scrollLeft - sc.clientWidth * 0.75;
      Array.prototype.forEach.call(stack.querySelectorAll('.vk-heatgrid__scroll'), function (s) { s.scrollLeft = Math.max(0, x); });
    }
    function bounds() {
      var ys = S.years.slice().sort(), a = Date.UTC(ys[0], 0, 1), b = Date.UTC(ys[ys.length - 1], 11, 31);
      return [a, b, VK.clamp(S.now, a, b)];
    }

    function activate(t, focus) {
      var c = S.cells[key(t)]; if (!c) return;
      var prev = S.active !== null && S.cells[key(S.active)];
      if (prev && prev !== c) prev.tabIndex = -1;
      S.active = t; c.tabIndex = 0;
      if (focus) { c.focus({ preventScroll: true }); c.scrollIntoView({ block: 'nearest', inline: 'nearest' }); emit('focus', { date: key(t), t: t, count: c._n }); }
      say(t);
    }
    function say(t) {
      var c = S.cells[key(t)]; if (!c) return;
      readout.textContent = '';
      readout.append(VK.el('span.vk-label', { text: S.sel === t ? 'Kijelölve' : 'Nap' }),
        VK.el('span.vk-num', { text: fDate(t) + ' — ' + (t > S.now ? 'nincs még adat' : c._n + ' ' + S.unit) }));
    }
    function select(t, silent) {
      if (S.sel !== null && S.cells[key(S.sel)]) S.cells[key(S.sel)].setAttribute('aria-selected', 'false');
      S.sel = t;
      var c = t !== null && S.cells[key(t)];
      if (c) c.setAttribute('aria-selected', 'true');
      if (t !== null) say(t);
      if (!silent && c) emit('select', { date: key(t), t: t, count: c._n, level: +c.dataset.l });
    }

    listen(stack, 'click', function (e) {
      var c = e.target.closest('.vk-heatgrid__cell'); if (!c) return;
      activate(c._t, false); c.focus({ preventScroll: true }); select(c._t);
    });
    listen(stack, 'keydown', function (e) {
      var c = e.target.closest && e.target.closest('.vk-heatgrid__cell');
      if (!c || e.altKey || e.metaKey || (e.shiftKey && /^Arrow/.test(e.key))) return;
      var t = c._t, b = bounds(), y = new Date(t).getUTCFullYear(), n = null;
      switch (e.key) {
        case 'ArrowUp': n = t - DAY; break;
        case 'ArrowDown': n = t + DAY; break;
        case 'ArrowLeft': n = t - 7 * DAY; break;
        case 'ArrowRight': n = t + 7 * DAY; break;
        case 'Home': n = e.ctrlKey ? b[0] : Date.UTC(y, 0, 1); break;
        case 'End': n = e.ctrlKey ? b[1] : Date.UTC(y, 11, 31); break;
        case 'PageUp': n = addMonths(t, -1); break;
        case 'PageDown': n = addMonths(t, 1); break;
        case 'Enter': case ' ': e.preventDefault(); select(t); return;
        default: return;
      }
      if (e.ctrlKey && e.key !== 'Home' && e.key !== 'End') return;
      e.preventDefault();
      n = VK.clamp(n, b[0], b[1]);
      if (!S.cells[key(n)]) return;
      activate(n, true);
    });

    build();

    var api = {
      setData: function (d) { S.data = d || {}; build(); },
      select: function (d) { var t = T(d); if (S.cells[key(t)]) { activate(t, false); select(t, true); } },
      focusDate: function (d) { var t = T(d); if (S.cells[key(t)]) activate(t, true); },
      on: em.on,
      destroy: function () { offs.forEach(function (f) { f(); }); el.textContent = ''; el.classList.remove('vk-heatgrid'); }
    };
    el._vkHeatgrid = api;
    return api;
  }

  VK.heatgrid = { mount: mount, format: fDate };
})(typeof window !== 'undefined' ? window : globalThis);
