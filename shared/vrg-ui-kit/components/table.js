/* VRG UI Kit — components/table.js — dense data table: sort, filter, quick filters, sticky header,
   Ctrl/Shift row selection, keyboard grid (role=grid, roving cell).

     var t = VK.table.mount(el, {
       columns: [{ key, label, type: 'text'|'num'|'mono', unit, width: '12ch', sortable: true,
                   filter: true | 'select' | false,        // quick filter: text/number expression or a value list
                   get: row => value, format: (v,row) => text, render: (v,row) => html string | Node,
                   text: (v,row) => searchable text, decimals: 0 }],
       rows: [...], rowId: row => row.id,
       selectable: 'multi' | 'single' | false,               // default 'multi'
       onSelect(rows, inst), onActivate(row, inst),          // Enter / double click
       label: 'Készlet', zebra: false, stickyFirst: false, quickFilters: false (row shown at start),
       sort: {key, dir: 'asc'|'desc'}, onRefresh(inst) → shows a 'Frissítés' MINI in the bar,
       tools: [Node…] (extra minis in the bar), empty: 'Nincs adat', maxHeight: '420px' })
     → { setRows(rows), getSelection(), select(ids), clearSelection(), sort(key, dir?), filter(text | {key: q}),
         setState('loading'|'error'|null, message), getView(), focus(), refresh(), destroy() }

   render() output is trusted markup (status badges: <span class="vk-table__st" data-st="ok">Raktáron</span>).
   Number quick filters understand  >10  <=5  =3  10-20 . Text filters are Hungarian-folded (ő = o).
   Keyboard (grid): arrows move the cell · Home/End row start/end · Ctrl+Home/End first/last row ·
   PageUp/PageDown by a screen · Enter/Space on a header sorts (asc → desc → off) · Space toggles the row ·
   Shift+Space extends from the anchor · Ctrl+A selects all visible · Esc clears · Enter activates.
   Shift+Arrow is left to region hopping. Mouse: click = select, Ctrl+click = toggle, Shift+click = range.
   Suggested app actions: table.selectAll, table.clear, table.export (menu:table / toolbar:<id>).
   Depends on: core.js, mini.js. */
(function (root) {
  'use strict';
  var VK = root.VK = root.VK || {};
  if (VK.table) return;

  var coll = typeof Intl !== 'undefined' && Intl.Collator ? new Intl.Collator('hu', { numeric: true, sensitivity: 'base' }) : null;
  function cmpText(a, b) { a = a == null ? '' : String(a); b = b == null ? '' : String(b); return coll ? coll.compare(a, b) : (a < b ? -1 : a > b ? 1 : 0); }
  function toNum(v) { if (typeof v === 'number') return v; var n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.')); return isNaN(n) ? null : n; }
  function fmtNum(v, c) {
    if (v === null || v === undefined || v === '') return '';
    var n = toNum(v); if (n === null) return String(v);
    return n.toLocaleString('hu-HU', { useGrouping: 'always', minimumFractionDigits: c.decimals || 0, maximumFractionDigits: c.decimals == null ? 2 : c.decimals });
  }
  /** number expression for quick filters: '>10', '<=5', '=3', '10-20', '10..20', '12' */
  function numTest(q) {
    q = q.replace(/\s/g, '').replace(/,/g, '.');
    var m = q.match(/^(-?[\d.]+)(?:-|\.\.)(-?[\d.]+)$/);
    if (m) { var a = +m[1], b = +m[2]; return function (n) { return n !== null && n >= a && n <= b; }; }
    m = q.match(/^(>=|<=|>|<|=)?(-?[\d.]+)$/);
    if (!m) return null;
    var x = +m[2], op = m[1] || '=';
    return function (n) { if (n === null) return false; return op === '>' ? n > x : op === '<' ? n < x : op === '>=' ? n >= x : op === '<=' ? n <= x : n === x; };
  }

  function mount(el, o) {
    o = o || {};
    var cols = (o.columns || []).map(function (c) { var x = {}; for (var k in c) x[k] = c[k]; if (x.sortable === undefined) x.sortable = true; return x; });
    var rowId = o.rowId || function (r, i) { return r && r.id != null ? String(r.id) : String(i); };
    var selectable = o.selectable === undefined ? 'multi' : o.selectable;
    var rows = [], ids = [], byId = {}, view = [];
    var sortKey = o.sort ? o.sort.key : null, sortDir = o.sort ? o.sort.dir || 'asc' : 'none';
    var query = '', qf = {};
    var sel = new Set(), anchor = null;
    var cur = { r: 0, c: 0 };           // r = -1 → header row
    var state = null, stateMsg = '';
    var off = [];

    function val(c, r) { return c.get ? c.get(r) : r[c.key]; }
    function textOf(c, r) { var v = val(c, r); return c.text ? c.text(v, r) : c.format ? c.format(v, r) : v == null ? '' : String(v); }

    // ---------- DOM ----------
    el.classList.add('vk-table');
    el.textContent = '';
    if (o.zebra) el.setAttribute('data-zebra', '');
    if (o.stickyFirst) el.setAttribute('data-sticky-first', '');
    if (o.maxHeight) el.style.setProperty('--vk-table-max-h', o.maxHeight);
    var gridId = VK.uid('vk-table');

    var search = VK.el('input.vk-table__input', { type: 'search', placeholder: o.placeholder || 'Szűrés minden oszlopban…',
      'aria-label': 'Szűrés minden oszlopban', 'aria-controls': gridId, autocomplete: 'off', spellcheck: 'false' });
    var tools = VK.el('div.vk-table__tools');
    var hasQf = cols.some(function (c) { return c.filter !== false; });
    var qfMini = hasQf ? VK.mini.create({ icon: 'filter', label: 'Oszlopszűrők', pressed: !!o.quickFilters, size: 'sm', onClick: function () { showQf(qfRow.hidden); } }) : null;
    if (qfMini) qfMini.setAttribute('aria-controls', gridId);
    var refreshMini = o.onRefresh ? VK.mini.create({ icon: 'refresh', label: 'Frissítés', size: 'sm', onClick: function () { o.onRefresh(api); } }) : null;
    (o.tools || []).forEach(function (n) { if (n.classList && n.classList.contains('vk-mini')) n.setAttribute('data-cap', 'hidden'); tools.appendChild(n); });
    if (qfMini) tools.appendChild(qfMini);
    if (refreshMini) tools.appendChild(refreshMini);
    var bar = VK.el('div.vk-table__bar', null, [VK.el('label.vk-table__search', null, [VK.icon('search'), search]), tools]);

    var grid = VK.el('table.vk-table__grid', { role: 'grid', id: gridId, 'aria-label': o.label || 'Táblázat', 'aria-colcount': cols.length });
    if (selectable === 'multi') grid.setAttribute('aria-multiselectable', 'true');
    var thead = VK.el('thead'), tbody = VK.el('tbody');
    var hrow = VK.el('tr', { role: 'row', 'aria-rowindex': 1 });
    var ths = cols.map(function (c, i) {
      var th = VK.el('th', { role: 'columnheader', scope: 'col', tabindex: -1, 'aria-colindex': i + 1, 'data-col': i, class: c.type === 'num' ? 'vk-table__num' : null });
      if (c.width) th.style.width = c.width;
      var lab = VK.el('span.vk-table__th', null, [VK.el('span.vk-ellipsis', { text: c.label + (c.unit ? ' (' + c.unit + ')' : '') })]);
      if (c.sortable) lab.appendChild(VK.icon('sort'));
      th.appendChild(lab);
      hrow.appendChild(th);
      return th;
    });
    var qfRow = VK.el('tr.vk-table__qfrow', { role: 'presentation', hidden: !o.quickFilters });
    var qfInputs = cols.map(function (c) {
      var th = VK.el('th', { role: 'presentation' }), inp = null;
      if (c.filter === 'select') {
        inp = VK.el('select.vk-table__qf', { 'aria-label': 'Szűrő: ' + c.label, 'data-key': c.key });
      } else if (c.filter !== false) {
        inp = VK.el('input.vk-table__qf', { type: 'text', placeholder: c.type === 'num' ? '>10, 5-20' : 'szűrő…', 'aria-label': 'Szűrő: ' + c.label + (c.type === 'num' ? ' (pl. >10 vagy 5-20)' : ''), 'data-key': c.key, autocomplete: 'off', spellcheck: 'false' });
      }
      if (inp) th.appendChild(inp);
      qfRow.appendChild(th);
      return inp;
    });
    thead.appendChild(hrow); thead.appendChild(qfRow);
    grid.appendChild(thead); grid.appendChild(tbody);
    var scroll = VK.el('div.vk-table__scroll', null, [grid]);
    var foot = VK.el('div.vk-table__foot', { role: 'status', 'aria-live': 'polite' });
    el.appendChild(bar); el.appendChild(scroll); el.appendChild(foot);

    function fillSelects() {
      cols.forEach(function (c, i) {
        var s = qfInputs[i]; if (!s || s.tagName !== 'SELECT') return;
        var seen = {}, vals = [];
        rows.forEach(function (r) { var t = textOf(c, r); if (t !== '' && !seen[t]) { seen[t] = 1; vals.push(t); } });
        vals.sort(cmpText);
        var keep = s.value; s.textContent = '';
        s.appendChild(VK.el('option', { value: '', text: 'Mind' }));
        vals.forEach(function (v) { s.appendChild(VK.el('option', { value: v, text: v })); });
        s.value = vals.indexOf(keep) >= 0 ? keep : '';
      });
    }

    // ---------- model ----------
    function compute() {
      var terms = VK.fold(query).split(/\s+/).filter(Boolean);
      var tests = cols.map(function (c) {
        var q = qf[c.key]; if (!q) return null;
        if (c.filter === 'select') return function (r) { return textOf(c, r) === q; };
        if (c.type === 'num') { var t = numTest(q); if (t) return function (r) { return t(toNum(val(c, r))); }; }
        var f = VK.fold(q); return function (r) { return VK.fold(textOf(c, r)).indexOf(f) >= 0; };
      });
      var out = [];
      rows.forEach(function (r, i) {
        for (var k = 0; k < tests.length; k++) if (tests[k] && !tests[k](r)) return;
        if (terms.length) {
          var hay = VK.fold(cols.map(function (c) { return textOf(c, r); }).join(' \u0001 '));
          for (var j = 0; j < terms.length; j++) if (hay.indexOf(terms[j]) < 0) return;
        }
        out.push(i);
      });
      var sc = sortKey && sortDir !== 'none' ? cols.find(function (c) { return c.key === sortKey; }) : null;
      if (sc) {
        var dir = sortDir === 'desc' ? -1 : 1;
        out.sort(function (a, b) {
          var va = val(sc, rows[a]), vb = val(sc, rows[b]), d;
          if (sc.type === 'num') { var na = toNum(va), nb = toNum(vb); d = na === null ? (nb === null ? 0 : 1) : nb === null ? -1 : (na - nb) * dir; if (na === null || nb === null) return d || a - b; }
          else d = cmpText(sc.format ? sc.format(va, rows[a]) : va, sc.format ? sc.format(vb, rows[b]) : vb) * dir;
          return d || a - b;
        });
      }
      view = out;
    }

    function cellNode(c, r) {
      var v = val(c, r);
      if (c.render) { var x = c.render(v, r); if (x && x.nodeType) return x; var span = document.createElement('span'); span.innerHTML = x == null ? '' : String(x); return span; }
      var t = c.format ? c.format(v, r) : c.type === 'num' ? fmtNum(v, c) : v == null ? '' : String(v);
      return document.createTextNode(t);
    }

    function render() {
      compute();
      var hadFocus = el.contains(document.activeElement) && grid.contains(document.activeElement);
      tbody.textContent = '';
      el.toggleAttribute('data-state', !!state); if (state) el.setAttribute('data-state', state);
      grid.setAttribute('aria-rowcount', view.length + 1);
      grid.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false');
      if (state === 'error' || (state === 'loading' && !view.length) || !view.length) {
        var msg = state === 'error' ? (stateMsg || 'Hiba a betöltésnél') : state === 'loading' ? (stateMsg || 'Betöltés…')
          : rows.length ? 'Nincs találat — módosítsd a szűrőt (Esc a mezőben törli)' : (o.empty || 'Nincs adat');
        var td = VK.el('td', { role: 'gridcell', colspan: cols.length },
          [VK.icon(state === 'error' ? 'error' : state === 'loading' ? 'loader' : rows.length ? 'filter' : 'table'), msg]);
        tbody.appendChild(VK.el('tr.vk-table__msg', { role: 'row' }, [td]));
        cur.r = -1; finish(hadFocus); return;
      }
      var frag = document.createDocumentFragment();
      view.forEach(function (ri, k) {
        var r = rows[ri], id = ids[ri];
        var tr = VK.el('tr', { role: 'row', 'aria-rowindex': k + 2, 'data-id': id });
        if (selectable) tr.setAttribute('aria-selected', sel.has(id) ? 'true' : 'false');
        cols.forEach(function (c, ci) {
          var cls = (c.type === 'num' ? 'vk-table__num' : c.type === 'mono' ? 'vk-table__mono' : '') + (c.className ? ' ' + c.className : '');
          var td = VK.el('td', { role: 'gridcell', tabindex: -1, 'aria-colindex': ci + 1, class: cls || null });
          if (c.maxWidth) td.style.setProperty('--_cw', c.maxWidth);
          td.appendChild(cellNode(c, r));
          tr.appendChild(td);
        });
        frag.appendChild(tr);
      });
      tbody.appendChild(frag);
      if (cur.r >= view.length) cur.r = view.length - 1;
      finish(hadFocus);
    }
    function finish(hadFocus) {
      ths.forEach(function (th, i) {
        var c = cols[i];
        if (!c.sortable) { th.removeAttribute('aria-sort'); return; }
        var s = c.key === sortKey && sortDir !== 'none' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none';
        th.setAttribute('aria-sort', s);
        var u = th.querySelector('use'); if (u) u.setAttribute('href', '#vk-i-' + (s === 'ascending' ? 'sort-asc' : s === 'descending' ? 'sort-desc' : 'sort'));
      });
      footer();
      place(hadFocus);
    }
    function footer() {
      foot.textContent = '';
      if (selectable) foot.appendChild(VK.el('span', null, [VK.el('b', { text: String(sel.size) }), ' / ' + rows.length + ' kijelölve']));
      else foot.appendChild(VK.el('span', { text: rows.length + ' sor' }));
      if (state === 'loading') foot.appendChild(VK.el('span', { text: 'betöltés…' }));
      if (view.length !== rows.length) foot.appendChild(VK.el('span', { text: 'szűrve: ' + view.length + ' látható' }));
      if (sortKey && sortDir !== 'none') { var sc = cols.find(function (c) { return c.key === sortKey; }); if (sc) foot.appendChild(VK.el('span', { text: 'rendezés: ' + sc.label + (sortDir === 'asc' ? ' ↑' : ' ↓') })); }
      foot.appendChild(VK.el('span.vk-table__foot-sep'));
      if (o.footer) { var x = o.footer(api); if (x) foot.appendChild(typeof x === 'string' ? document.createTextNode(x) : x); }
    }

    // ---------- focus (roving cell) ----------
    function cellAt(r, c) {
      if (r < 0) return ths[c] || null;
      var tr = tbody.rows[r]; if (!tr || tr.classList.contains('vk-table__msg')) return null;
      return tr.cells[c] || null;
    }
    function place(doFocus) {
      var n = cellAt(cur.r, cur.c) || cellAt(-1, Math.min(cur.c, cols.length - 1));
      if (!n) return;
      grid.querySelectorAll('[tabindex="0"]').forEach(function (x) { if (x !== n) x.tabIndex = -1; });
      n.tabIndex = 0;
      if (doFocus) { n.focus({ preventScroll: true }); keepVisible(n); }
    }
    function keepVisible(n) {
      var tr = n.parentNode, hh = thead.offsetHeight;
      if (n.tagName === 'TD') {
        var top = tr.offsetTop, bot = top + tr.offsetHeight;
        if (top - hh < scroll.scrollTop) scroll.scrollTop = top - hh;
        else if (bot > scroll.scrollTop + scroll.clientHeight) scroll.scrollTop = bot - scroll.clientHeight;
      }
      var sticky = el.hasAttribute('data-sticky-first') && n.cellIndex > 0 ? tr.cells[0].offsetWidth : 0;
      if (n.offsetLeft - sticky < scroll.scrollLeft) scroll.scrollLeft = n.offsetLeft - sticky;
      else if (n.offsetLeft + n.offsetWidth > scroll.scrollLeft + scroll.clientWidth) scroll.scrollLeft = n.offsetLeft + n.offsetWidth - scroll.clientWidth;
    }
    function move(r, c) {
      var maxR = view.length && state !== 'error' ? view.length - 1 : -1;
      cur.r = Math.max(-1, Math.min(maxR, r)); cur.c = Math.max(0, Math.min(cols.length - 1, c));
      place(true);
    }
    function pageRows() { var tr = tbody.rows[0]; var h = tr ? tr.offsetHeight : 28; return Math.max(1, Math.floor((scroll.clientHeight - thead.offsetHeight) / h) - 1); }

    // ---------- selection ----------
    function paintSel() {
      if (!selectable) return;
      Array.prototype.forEach.call(tbody.rows, function (tr) { if (tr.dataset.id != null) tr.setAttribute('aria-selected', sel.has(tr.dataset.id) ? 'true' : 'false'); });
      footer();
      if (o.onSelect) o.onSelect(getSelection(), api);
    }
    function idAtView(k) { return ids[view[k]]; }
    function selOnly(k) { sel.clear(); if (k >= 0) { sel.add(idAtView(k)); anchor = k; } paintSel(); }
    function selToggle(k) {
      var id = idAtView(k); if (id === undefined) return;
      if (selectable === 'single') { var had = sel.has(id); sel.clear(); if (!had) sel.add(id); }
      else if (sel.has(id)) sel.delete(id); else sel.add(id);
      anchor = k; paintSel();
    }
    function selRange(k, add) {
      if (selectable !== 'multi') return selOnly(k);
      var a = anchor == null || anchor >= view.length ? k : anchor;
      if (!add) sel.clear();
      for (var i = Math.min(a, k); i <= Math.max(a, k); i++) sel.add(idAtView(i));
      paintSel();
    }
    function getSelection() { return ids.reduce(function (acc, id, i) { if (sel.has(id)) acc.push(rows[i]); return acc; }, []); }

    // ---------- sort / filter ----------
    function sort(key, dir) {
      var c = cols.find(function (x) { return x.key === key; }); if (!c || !c.sortable) return;
      if (!dir) dir = key !== sortKey || sortDir === 'none' ? 'asc' : sortDir === 'asc' ? 'desc' : 'none';
      sortKey = dir === 'none' ? null : key; sortDir = dir; anchor = null;
      render();
    }
    function filter(q) {
      if (typeof q === 'string' || q == null) { query = q || ''; search.value = query; }
      else Object.keys(q).forEach(function (k) {
        qf[k] = q[k] || ''; var i = cols.findIndex(function (c) { return c.key === k; });
        if (i >= 0 && qfInputs[i]) { qfInputs[i].value = qf[k]; qfInputs[i].toggleAttribute('data-on', !!qf[k]); if (qf[k]) showQf(true); }
      });
      anchor = null; render();
    }
    function showQf(on) {
      qfRow.hidden = !on;
      if (qfMini) VK.mini.set(qfMini, { pressed: on });
      if (!on) { var any = false; Object.keys(qf).forEach(function (k) { if (qf[k]) any = true; qf[k] = ''; }); qfInputs.forEach(function (i) { if (i) { i.value = ''; i.removeAttribute('data-on'); } }); if (any) render(); }
    }

    // ---------- events ----------
    function on(t, type, fn) { t.addEventListener(type, fn); off.push(function () { t.removeEventListener(type, fn); }); }
    on(search, 'input', function () { query = search.value; anchor = null; render(); });
    on(search, 'keydown', function (e) {
      if (e.key === 'Escape' && search.value) { e.preventDefault(); e.stopPropagation(); filter(''); }
      else if (e.key === 'ArrowDown' || (e.key === 'Enter' && view.length)) { e.preventDefault(); move(Math.max(0, cur.r), cur.c); }
    });
    qfInputs.forEach(function (inp) {
      if (!inp) return;
      on(inp, inp.tagName === 'SELECT' ? 'change' : 'input', function () { qf[inp.dataset.key] = inp.value; inp.toggleAttribute('data-on', !!inp.value); anchor = null; render(); });
      on(inp, 'keydown', function (e) {
        e.stopPropagation();
        if (e.key === 'Escape' && inp.value) { e.preventDefault(); inp.value = ''; qf[inp.dataset.key] = ''; inp.removeAttribute('data-on'); render(); }
        else if (e.key === 'ArrowDown' && inp.tagName !== 'SELECT') { e.preventDefault(); move(0, cur.c); }
      });
    });
    on(grid, 'click', function (e) {
      if (e.target.closest('.vk-table__qfrow')) return;
      var th = e.target.closest('th[data-col]');
      if (th) { cur = { r: -1, c: +th.dataset.col }; sort(cols[cur.c].key); move(-1, cur.c); return; }
      var td = e.target.closest('td'); if (!td || !td.parentNode.dataset.id) return;
      var k = td.parentNode.sectionRowIndex;
      cur = { r: k, c: td.cellIndex };
      if (selectable) {
        if (e.shiftKey) selRange(k, e.ctrlKey || e.metaKey);
        else if (e.ctrlKey || e.metaKey) selToggle(k);
        else selOnly(k);
      }
      place(true);
    });
    on(grid, 'mousedown', function (e) { if (e.shiftKey && e.target.closest('td')) e.preventDefault(); });
    on(grid, 'dblclick', function (e) { var td = e.target.closest('td'); if (td && td.parentNode.dataset.id && o.onActivate) o.onActivate(rows[view[td.parentNode.sectionRowIndex]], api); });
    on(grid, 'focusin', function (e) {
      var n = e.target; if (n.closest('.vk-table__qfrow')) return;
      if (n.tagName === 'TH' && n.dataset.col) cur = { r: -1, c: +n.dataset.col };
      else if (n.tagName === 'TD' && n.parentNode.dataset.id) cur = { r: n.parentNode.sectionRowIndex, c: n.cellIndex };
    });
    on(grid, 'keydown', function (e) {
      if (e.defaultPrevented || e.target.closest('.vk-table__qfrow')) return;
      var mod = e.ctrlKey || e.metaKey, k = e.key;
      if (e.shiftKey && /^Arrow/.test(k)) return;                       // region hop
      if (mod && (k === 'a' || k === 'A')) { if (selectable === 'multi') { e.preventDefault(); view.forEach(function (_, i) { sel.add(idAtView(i)); }); paintSel(); } return; }
      var h = true;
      switch (k) {
        case 'ArrowDown': move(cur.r + 1, cur.c); break;
        case 'ArrowUp': move(cur.r - 1, cur.c); break;
        case 'ArrowRight': move(cur.r, cur.c + 1); break;
        case 'ArrowLeft': move(cur.r, cur.c - 1); break;
        case 'Home': move(mod ? 0 : cur.r, 0); break;
        case 'End': move(mod ? view.length - 1 : cur.r, cols.length - 1); break;
        case 'PageDown': move(Math.max(0, cur.r) + pageRows(), cur.c); break;
        case 'PageUp': move(cur.r - pageRows(), cur.c); break;
        case 'Enter':
          if (cur.r < 0) { sort(cols[cur.c].key); place(true); }
          else if (o.onActivate) o.onActivate(rows[view[cur.r]], api);
          else if (selectable) selOnly(cur.r);
          break;
        case ' ': case 'Spacebar':
          if (cur.r < 0) { sort(cols[cur.c].key); place(true); }
          else if (selectable) { if (e.shiftKey) selRange(cur.r, mod); else selToggle(cur.r); }
          break;
        case 'Escape':
          if (sel.size) { sel.clear(); anchor = null; paintSel(); } else h = false;
          break;
        default: h = false;
      }
      if (h) { e.preventDefault(); e.stopPropagation(); }
    });

    // ---------- api ----------
    function setRows(list) {
      rows = (list || []).slice(); byId = {};
      ids = rows.map(function (r, i) { var id = String(rowId(r, i)); byId[id] = i; return id; });
      sel.forEach(function (id) { if (!(id in byId)) sel.delete(id); });
      fillSelects(); render();
      if (o.onSelect && sel.size) o.onSelect(getSelection(), api);
    }
    function setState(s, msg) {
      state = s || null; stateMsg = msg || '';
      if (refreshMini) VK.mini.set(refreshMini, { state: s === 'loading' ? 'running' : s === 'error' ? 'error' : 'idle', progress: s === 'loading' ? null : 0 });
      render();
    }
    var api = {
      el: el, setRows: setRows, getSelection: getSelection, sort: sort, filter: filter, setState: setState,
      select: function (list) { sel = new Set((list || []).map(String).filter(function (id) { return id in byId; })); paintSel(); },
      clearSelection: function () { sel.clear(); anchor = null; paintSel(); },
      selectAll: function () { if (selectable !== 'multi') return; view.forEach(function (_, i) { sel.add(idAtView(i)); }); paintSel(); },
      getView: function () { return view.map(function (i) { return rows[i]; }); },
      focus: function () { place(true); }, refresh: render,
      destroy: function () { off.forEach(function (f) { f(); }); off = []; el.textContent = ''; el.classList.remove('vk-table'); el.removeAttribute('data-state'); }
    };
    setRows(o.rows || []);
    return api;
  }

  VK.table = { mount: mount };
})(typeof window !== 'undefined' ? window : globalThis);
