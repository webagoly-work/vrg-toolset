/* VRG UI Kit — components/tree.js — treeview (WAI-ARIA tree pattern), icons by kind, tri-state checkboxes,
   lazy children with a loading MINI, typeahead. No drag and drop.

     var t = VK.tree.mount(el, {
       items: [{ id, label, kind: 'folder'|'file'|'code'|'doc'|'db'|'device'|'panel'|'cable'|…, icon?, meta?,
                 children?: [...], hasChildren?: true (lazy), expanded?, checked?: true|false|'mixed', disabled? }],
       label: 'Fájlok', checkboxes: false, selectFollowsFocus: true,
       lazy: (item) => children[] | Promise<children[]>,   // called once per lazy node; a rejection shows the error state
       icons: { kind: 'sprite-name' },                       // extends the default kind → icon map
       onSelect(item, inst), onActivate(item, inst), onCheck(checkedItems, inst), onToggle(item, expanded, inst) })
     → { setItems(items), expand(id), collapse(id), select(id), focusItem(id), getSelected(), getChecked(),
         setChecked(id, bool), expandAll(), collapseAll(), destroy() }

   Keyboard: ↓/↑ next/previous visible · → open, then first child · ← close, then parent · Home/End ·
   Enter = activate (a folder toggles; a failed lazy load retries) · Space = check (with checkboxes) or select ·
   * = open all siblings · letters = typeahead (Hungarian-folded) · Shift+Arrow is left to region hopping.
   Depends on: core.js, mini.js (loading/error indicator). */
(function (root) {
  'use strict';
  var VK = root.VK = root.VK || {};
  if (VK.tree) return;

  var ICONS = { folder: 'folder', dir: 'folder', file: 'file', doc: 'file', code: 'file-code', db: 'database', data: 'database',
    device: 'cpu', panel: 'cabinet', cabinet: 'cabinet', cable: 'cable', socket: 'socket', power: 'bolt', light: 'bulb',
    sensor: 'sensor', drive: 'drive', server: 'server', job: 'board', layer: 'layers', tag: 'tag', node: 'node', link: 'link' };

  function mount(el, o) {
    o = o || {};
    var icons = {}; Object.keys(ICONS).forEach(function (k) { icons[k] = ICONS[k]; }); if (o.icons) Object.keys(o.icons).forEach(function (k) { icons[k] = o.icons[k]; });
    var follow = o.selectFollowsFocus !== false && !o.checkboxes;
    var nodes = {}, roots = [], selected = null, buf = '', bufT = 0, off = [];

    el.classList.add('vk-tree-wrap');
    el.textContent = '';
    var tree = VK.el('ul.vk-tree', { role: 'tree', 'aria-label': o.label || 'Fa' });
    if (o.checkboxes) tree.setAttribute('aria-multiselectable', 'true');
    el.appendChild(tree);

    function iconFor(n) {
      var d = n.data;
      if (d.icon) return d.icon;
      var k = d.kind || (n.branch ? 'folder' : 'file');
      if ((k === 'folder' || k === 'dir') && n.expanded) return 'folder-open';
      return icons[k] || (n.branch ? 'folder' : 'file');
    }

    function build(items, parent, level, ul) {
      var list = [];
      (items || []).forEach(function (d, i) {
        var id = String(d.id != null ? d.id : (parent ? parent.id + '/' : '') + d.label);
        if (o.checkboxes && d.checked == null) d.checked = !!(parent && parent.data.checked === true);
        var n = { id: id, data: d, parent: parent, level: level, kids: null, branch: !!(d.children || d.hasChildren),
          expanded: !!d.expanded, loaded: !!d.children, loading: false, error: null, checked: d.checked };
        nodes[id] = n;
        var li = VK.el('li.vk-tree__item', { role: 'treeitem', tabindex: -1, 'aria-level': level, 'aria-setsize': items.length, 'aria-posinset': i + 1, 'data-id': id });
        if (d.disabled) li.setAttribute('aria-disabled', 'true');
        var row = VK.el('div.vk-tree__row', { style: '--_lvl:' + (level - 1) });
        var tw = VK.el('span.vk-tree__twisty', { 'aria-hidden': 'true' }); if (n.branch) tw.appendChild(VK.icon('chevron-right'));
        row.appendChild(tw);
        if (o.checkboxes) { var cb = VK.el('span.vk-tree__check', { 'aria-hidden': 'true' }, [VK.icon('check')]); row.appendChild(cb); }
        n.ico = VK.el('span.vk-tree__ico', { 'aria-hidden': 'true' });
        row.appendChild(n.ico);
        row.appendChild(VK.el('span.vk-tree__label', { text: d.label }));
        n.meta = VK.el('span.vk-tree__meta', { text: d.meta || '' });
        row.appendChild(n.meta);
        li.appendChild(row);
        n.li = li; n.row = row;
        ul.appendChild(li);
        list.push(n);
        if (n.branch) {
          n.group = VK.el('ul.vk-tree__group', { role: 'group' });
          li.appendChild(n.group);
          if (n.loaded && n.expanded) renderKids(n);
        }
        paint(n);
      });
      return list;
    }
    function renderKids(n) { if (n.kids) return; n.kids = build(n.data.children, n, n.level + 1, n.group); }

    function paint(n) {
      var li = n.li;
      if (n.branch) li.setAttribute('aria-expanded', n.expanded ? 'true' : 'false'); else li.removeAttribute('aria-expanded');
      if (n.group) n.group.hidden = !n.expanded || !n.kids;
      if (o.checkboxes) li.setAttribute('aria-checked', n.checked === 'mixed' ? 'mixed' : n.checked ? 'true' : 'false');
      else li.setAttribute('aria-selected', selected === n ? 'true' : 'false');
      li.toggleAttribute('data-current', selected === n);
      li.setAttribute('aria-busy', n.loading ? 'true' : 'false');
      if (n.error) li.setAttribute('data-state', 'error'); else li.removeAttribute('data-state');
      n.ico.textContent = '';
      if (n.loading || n.error) {
        n.ico.appendChild(VK.mini.create({ icon: n.error ? 'error' : 'loader', label: n.error ? 'Hiba' : 'Betöltés', size: 'sm',
          state: n.error ? 'error' : 'running', progress: n.error ? 1 : null }));
        n.ico.firstChild.tabIndex = -1; n.ico.firstChild.setAttribute('aria-hidden', 'true');
      } else n.ico.appendChild(VK.icon(iconFor(n)));
      n.meta.textContent = n.error ? n.error + ' — Enter: újra' : n.loading ? 'betöltés…' : (n.data.meta || '');
    }

    // ---------- expand / lazy ----------
    function expand(n, focusFirst) {
      if (!n || !n.branch || n.data.disabled) return;
      if (!n.loaded) { load(n, focusFirst); return; }
      renderKids(n);
      n.expanded = true; paint(n);
      if (o.onToggle) o.onToggle(n.data, true, api);
      if (focusFirst && n.kids && n.kids.length) focus(n.kids[0]);
    }
    function collapse(n) { if (!n || !n.branch || !n.expanded) return; n.expanded = false; paint(n); if (o.onToggle) o.onToggle(n.data, false, api); }
    function load(n, focusFirst) {
      if (n.loading) return;
      if (!o.lazy) { n.data.children = []; n.loaded = true; expand(n, focusFirst); return; }
      n.loading = true; n.error = null; paint(n);
      var p; try { p = Promise.resolve(o.lazy(n.data, api)); } catch (e) { p = Promise.reject(e); }
      p.then(function (kids) {
        n.loading = false; n.loaded = true; n.data.children = kids || [];
        renderKids(n); n.expanded = true; paint(n);
        if (o.checkboxes && n.kids[0]) recalcUp(n.kids[0]);
        if (o.onToggle) o.onToggle(n.data, true, api);
        if (focusFirst && n.kids.length && n.li.contains(document.activeElement)) focus(n.kids[0]);
      }, function (err) {
        n.loading = false; n.error = (err && err.message) || 'Betöltési hiba'; paint(n);
      });
    }

    // ---------- checks (tri-state; the truth lives on the item data, so unrendered branches count too) ----------
    function agg(d) {
      var kids = (d.children || []).filter(function (c) { return !c.disabled; });
      if (!kids.length) return d.checked === 'mixed' ? 'mixed' : !!d.checked;
      var t = 0, f = 0;
      kids.forEach(function (c) { var v = agg(c); if (v === true) t++; else if (v === 'mixed') { t++; f++; } else f++; });
      return f === 0 ? true : t === 0 ? false : 'mixed';
    }
    function fixData(list) { (list || []).forEach(function (d) { if (d.children) { fixData(d.children); if (d.children.some(function (c) { return !c.disabled; })) d.checked = agg(d); } }); }
    function dataDown(d, v) { d.checked = v; (d.children || []).forEach(function (c) { if (!c.disabled) dataDown(c, v); }); }
    function repaintDown(n) { n.checked = n.data.checked; paint(n); (n.kids || []).forEach(repaintDown); }
    function setDown(n, v) { dataDown(n.data, v); repaintDown(n); }
    function recalcUp(n) {
      var p = n.parent;
      while (p) { p.data.checked = agg(p.data); p.checked = p.data.checked; paint(p); p = p.parent; }
    }
    function toggleCheck(n) {
      if (!n || n.data.disabled) return;
      setDown(n, n.checked !== true); recalcUp(n);
      if (o.onCheck) o.onCheck(getChecked(), api);
    }
    function getChecked() { var out = []; (function walk(list) { (list || []).forEach(function (d) { if (d.checked === true) out.push(d); walk(d.children); }); })(itemsRef); return out; }

    // ---------- focus / navigation ----------
    function visibleNodes() {
      var out = [];
      (function walk(list) { list.forEach(function (n) { out.push(n); if (n.expanded && n.kids) walk(n.kids); }); })(roots);
      return out;
    }
    function focus(n, noSelect) {
      if (!n) return;
      tree.querySelectorAll('.vk-tree__item[tabindex="0"]').forEach(function (x) { x.tabIndex = -1; });
      n.li.tabIndex = 0; n.li.focus({ preventScroll: true });
      n.row.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      if (follow && !noSelect) select(n);
    }
    function select(n) {
      if (!n || n.data.disabled) return;
      var prev = selected; selected = n;
      if (prev && prev !== n) paint(prev);
      paint(n);
      if (prev !== n && o.onSelect) o.onSelect(n.data, api);
    }
    function nodeOf(t) { var li = t && t.closest && t.closest('.vk-tree__item'); return li && tree.contains(li) ? nodes[li.dataset.id] : null; }
    function activate(n) {
      if (n.error) { n.error = null; load(n, true); return; }
      if (n.branch) { if (n.expanded) collapse(n); else expand(n); }
      if (!follow) select(n);
      if (o.onActivate) o.onActivate(n.data, api);
    }

    function on(t, type, fn) { t.addEventListener(type, fn); off.push(function () { t.removeEventListener(type, fn); }); }
    on(tree, 'keydown', function (e) {
      if (e.defaultPrevented || e.altKey) return;
      if (e.shiftKey && /^Arrow/.test(e.key)) return;
      var n = nodeOf(e.target); if (!n) return;
      var vis = visibleNodes(), i = vis.indexOf(n), h = true;
      switch (e.key) {
        case 'ArrowDown': focus(vis[Math.min(vis.length - 1, i + 1)]); break;
        case 'ArrowUp': focus(vis[Math.max(0, i - 1)]); break;
        case 'ArrowRight': if (n.branch && !n.expanded) expand(n); else if (n.expanded && n.kids && n.kids.length) focus(n.kids[0]); break;
        case 'ArrowLeft': if (n.expanded) collapse(n); else if (n.parent) focus(n.parent); break;
        case 'Home': focus(vis[0]); break;
        case 'End': focus(vis[vis.length - 1]); break;
        case 'Enter': activate(n); break;
        case ' ': case 'Spacebar': if (o.checkboxes) toggleCheck(n); else select(n); break;
        case '*': (n.parent ? n.parent.kids : roots).forEach(function (s) { expand(s); }); break;
        default:
          h = false;
          if (!e.ctrlKey && !e.metaKey && e.key.length === 1 && /\S/.test(e.key)) {
            var now = Date.now(); buf = (now - bufT > 700 ? '' : buf) + VK.fold(e.key); bufT = now;
            for (var k = 1; k <= vis.length; k++) {
              var c = vis[(i + (buf.length > 1 ? k - 1 : k)) % vis.length];
              if (VK.fold(c.data.label).indexOf(buf) === 0) { focus(c); h = true; break; }
            }
          }
      }
      if (h) { e.preventDefault(); e.stopPropagation(); }
    });
    on(tree, 'click', function (e) {
      var n = nodeOf(e.target); if (!n) return;
      if (e.target.closest('.vk-tree__twisty') && n.branch) { if (n.expanded) collapse(n); else expand(n); focus(n, true); return; }
      if (e.target.closest('.vk-tree__check')) { focus(n, true); toggleCheck(n); return; }
      focus(n, true); select(n);
      if (n.error) activate(n);
    });
    on(tree, 'dblclick', function (e) { var n = nodeOf(e.target); if (n && !e.target.closest('.vk-tree__twisty, .vk-tree__check')) activate(n); });
    on(tree, 'focusin', function (e) { var n = nodeOf(e.target); if (n && n.li === e.target) { tree.querySelectorAll('.vk-tree__item[tabindex="0"]').forEach(function (x) { if (x !== n.li) x.tabIndex = -1; }); n.li.tabIndex = 0; } });

    var itemsRef = [];
    function setItems(items) {
      itemsRef = items || [];
      nodes = {}; selected = null; tree.textContent = '';
      if (o.checkboxes) fixData(items);
      roots = build(items || [], null, 1, tree);
      if (roots[0]) roots[0].li.tabIndex = 0;
      else tree.appendChild(VK.el('li.vk-tree__empty', { role: 'none', text: o.empty || 'Üres' }));
    }
    var api = {
      el: el, setItems: setItems,
      expand: function (id) { expand(nodes[id]); }, collapse: function (id) { collapse(nodes[id]); },
      expandAll: function () { Object.keys(nodes).forEach(function (k) { if (nodes[k].loaded) expand(nodes[k]); }); },
      collapseAll: function () { Object.keys(nodes).forEach(function (k) { collapse(nodes[k]); }); },
      select: function (id) { select(nodes[id]); }, focusItem: function (id) { var n = nodes[id], p = n && n.parent; while (p) { expand(p); p = p.parent; } focus(n); },
      getSelected: function () { return selected ? selected.data : null; }, getChecked: getChecked,
      setChecked: function (id, v) { var n = nodes[id]; if (n) { setDown(n, !!v); recalcUp(n); } },
      focus: function () { var n = tree.querySelector('.vk-tree__item[tabindex="0"]'); if (n) n.focus(); },
      destroy: function () { off.forEach(function (f) { f(); }); off = []; el.textContent = ''; el.classList.remove('vk-tree-wrap'); }
    };
    setItems(o.items);
    return api;
  }

  VK.tree = { mount: mount, ICONS: ICONS };
})(typeof window !== 'undefined' ? window : globalThis);
