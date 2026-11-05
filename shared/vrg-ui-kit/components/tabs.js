/* VRG UI Kit — components/tabs.js — tablist with closable tabs, dirty dot, overflow chevrons, roving keyboard.
     var t = VK.tabs.mount(el, {
       label: 'Megnyitott lapok',
       tabs: [{id:'plan', label:'Alaprajz', icon:'floorplan', dirty:true, closable:true, panel: Element | 'text' | fn(panelEl)}],
       active: 'plan', activation: 'auto' | 'manual', surface: 'toolbar:tabs' (minis right of the tabs, e.g. "Új lap"),
       emptyText: 'Nincs megnyitott lap', onSelect(id), onClose(id) → false vetoes })
     t.add(tab, {activate}) · t.close(id) · t.closeActive() · t.select(id, focus) · t.next(±1) · t.setDirty(id, on)
     t.setLabel(id, text) · t.active() · t.ids() · t.refresh() · t.destroy()
   Keyboard (one tab stop): ←/→ move (and select in 'auto'), Home/End, Enter/Space select (manual), Delete closes the
   focused tab. Ctrl+W is an action the app registers: VK.tabs.actions(t, {prefix:'tabs', when}) returns
   [tabs.close (mod+w), tabs.next (mod+pagedown), tabs.prev (mod+pageup)] for VK.actions.registerAll.
   Note: a plain browser tab keeps Ctrl+W for itself; it reaches the page in an installed/app window.
   Middle click closes. Events: vk:tabselect, vk:tabclose {id}. Depends on: core.js, focus.js, mini.js, actions.js. */
(function (root) {
  'use strict';
  var VK = root.VK = root.VK || {};
  if (VK.tabs) return;

  function mount(el, opts) {
    opts = opts || {};
    el.classList.add('vk-tabs');
    el.textContent = '';
    var items = [], activeId = null, unsub = null;
    var prevB = VK.el('button.vk-tabs__chev', { type: 'button', tabindex: '-1', 'aria-hidden': 'true', title: 'Lapok balra', 'data-dir': '-1' }, VK.icon('chevron-left'));
    var nextB = VK.el('button.vk-tabs__chev', { type: 'button', tabindex: '-1', 'aria-hidden': 'true', title: 'Lapok jobbra', 'data-dir': '1' }, VK.icon('chevron-right'));
    var list = VK.el('div.vk-tabs__list', { role: 'tablist', 'aria-label': opts.label || 'Lapok' });
    var extra = VK.el('div.vk-tabs__extra', { role: 'toolbar', 'aria-label': (opts.label || 'Lapok') + ' — műveletek' });
    var bar = VK.el('div.vk-tabs__bar', null, [prevB, list, nextB, extra]);
    var panels = VK.el('div.vk-tabs__panels');
    var empty = VK.el('div.vk-tabs__empty', { hidden: true }, [VK.icon('tabs'), VK.el('span', { text: opts.emptyText || 'Nincs megnyitott lap' })]);
    panels.appendChild(empty);
    el.appendChild(bar); el.appendChild(panels);

    function find(id) { return items.find(function (t) { return t.id === id; }) || null; }

    function build(tab) {
      var t = { id: tab.id || VK.uid('tab'), label: tab.label || '', closable: tab.closable !== false, dirty: !!tab.dirty };
      var tid = VK.uid('vk-tab'), pid = VK.uid('vk-tabpanel');
      t.dirtySr = VK.el('span.vk-sr-only', { text: ' (módosítva)' });
      t.labelEl = VK.el('span.vk-tabs__label', { text: t.label });
      t.tab = VK.el('div.vk-tabs__tab', { role: 'tab', id: tid, 'aria-controls': pid, 'aria-selected': 'false', tabindex: '-1', 'data-id': t.id,
        title: t.label + (t.closable ? ' — Delete: bezárás' : '') }, [
        tab.icon ? VK.icon(tab.icon) : null, t.labelEl, VK.el('span.vk-tabs__dirty', { 'aria-hidden': 'true' }), t.dirtySr,
        t.closable ? VK.el('span.vk-tabs__close', { 'aria-hidden': 'true', title: 'Bezárás' }, VK.icon('close')) : null
      ]);
      if (t.closable) t.tab.setAttribute('data-closable', '');
      t.panel = VK.el('div.vk-tabs__panel', { role: 'tabpanel', id: pid, 'aria-labelledby': tid, tabindex: '0', hidden: true });
      var c = tab.panel;
      if (typeof c === 'function') c(t.panel);
      else if (c && c.nodeType) t.panel.appendChild(c);
      else if (c != null) t.panel.textContent = String(c);
      setDirtyEl(t, t.dirty);
      return t;
    }
    function setDirtyEl(t, on) {
      t.dirty = !!on;
      if (t.dirty) t.tab.setAttribute('data-dirty', ''); else t.tab.removeAttribute('data-dirty');
      t.dirtySr.hidden = !t.dirty;
    }

    function add(tab, o) {
      o = o || {};
      if (tab.id && find(tab.id)) { if (o.activate !== false) select(tab.id, o.focus); return find(tab.id); }
      var t = build(tab);
      items.push(t);
      list.appendChild(t.tab); panels.appendChild(t.panel);
      if (!activeId || o.activate) select(t.id, o.focus);
      sync();
      return t.id;
    }

    function select(id, focus) {
      var t = find(id); if (!t) return;
      var changed = activeId !== id;
      activeId = id;
      items.forEach(function (x) {
        var on = x === t;
        x.tab.setAttribute('aria-selected', on ? 'true' : 'false');
        x.tab.tabIndex = on ? 0 : -1;
        x.panel.hidden = !on;
      });
      if (focus) t.tab.focus({ preventScroll: true });
      reveal(t.tab);
      if (changed) { if (opts.onSelect) opts.onSelect(id); VK.fire(el, 'tabselect', { id: id }); }
      sync();
    }

    function close(id) {
      var t = find(id); if (!t || !t.closable) return false;
      if (opts.onClose && opts.onClose(id) === false) return false;
      var i = items.indexOf(t), hadFocus = list.contains(document.activeElement) || t.panel.contains(document.activeElement);
      items.splice(i, 1);
      t.tab.remove(); t.panel.remove();
      VK.fire(el, 'tabclose', { id: id });
      if (activeId === id) {
        activeId = null;
        var n = items[i] || items[i - 1];
        if (n) select(n.id, hadFocus);
        else if (hadFocus) { empty.tabIndex = -1; empty.focus(); }
      } else if (hadFocus) { var a = find(activeId); if (a) a.tab.focus(); }
      sync();
      return true;
    }

    // keep a tab visible inside the strip without scrolling the page (scrollIntoView would)
    function reveal(tabEl) {
      var lr = list.getBoundingClientRect(), tr = tabEl.getBoundingClientRect(), k = lr.width ? list.clientWidth / lr.width : 1;
      if (tr.left < lr.left) list.scrollLeft -= (lr.left - tr.left) * k;
      else if (tr.right > lr.right) list.scrollLeft += (tr.right - lr.right) * k;
    }

    function next(dir) {
      if (!items.length) return;
      var i = items.indexOf(find(activeId));
      select(items[(i + (dir || 1) + items.length) % items.length].id, list.contains(document.activeElement));
    }

    function sync() {
      empty.hidden = items.length > 0;
      var over = list.scrollWidth > list.clientWidth + 1;
      if (over) bar.setAttribute('data-overflow', ''); else bar.removeAttribute('data-overflow');
      prevB.disabled = list.scrollLeft <= 1;
      nextB.disabled = list.scrollLeft + list.clientWidth >= list.scrollWidth - 1;
    }

    // keyboard: roving over [role=tab]
    var rov = VK.focus.roving(list, { items: '[role="tab"]', orientation: 'horizontal', typeahead: false,
      onMove: function (tabEl) { if (opts.activation !== 'manual' && document.activeElement === tabEl) select(tabEl.dataset.id); } });
    function onKey(e) {
      var tabEl = e.target.closest && e.target.closest('[role="tab"]'); if (!tabEl) return;
      if (e.key === 'Delete') { e.preventDefault(); close(tabEl.dataset.id); }
      else if ((e.key === 'Enter' || e.key === ' ') && !e.ctrlKey) { e.preventDefault(); select(tabEl.dataset.id, true); }
    }
    function onClick(e) {
      var tabEl = e.target.closest('[role="tab"]'); if (!tabEl) return;
      if (e.target.closest('.vk-tabs__close')) { e.stopPropagation(); close(tabEl.dataset.id); return; }
      select(tabEl.dataset.id, true);
    }
    function onAux(e) { if (e.button !== 1) return; var tabEl = e.target.closest('[role="tab"]'); if (tabEl) { e.preventDefault(); close(tabEl.dataset.id); } }
    function onWheel(e) { if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && bar.hasAttribute('data-overflow')) { list.scrollLeft += e.deltaY; e.preventDefault(); } }
    function chev(e) { var d = +e.currentTarget.dataset.dir; list.scrollBy({ left: d * list.clientWidth * 0.7, behavior: VK.reducedMotion() ? 'auto' : 'smooth' }); }
    list.addEventListener('keydown', onKey);
    list.addEventListener('click', onClick);
    list.addEventListener('auxclick', onAux);
    list.addEventListener('mousedown', function (e) { if (e.button === 1) e.preventDefault(); });
    list.addEventListener('wheel', onWheel, { passive: false });
    list.addEventListener('scroll', sync, { passive: true });
    prevB.addEventListener('click', chev); nextB.addEventListener('click', chev);
    var ro = root.ResizeObserver ? new ResizeObserver(sync) : null;
    if (ro) { ro.observe(list); ro.observe(el); }

    // minis from the registry (e.g. "Új lap")
    var extraRov = null;
    function renderExtra() {
      if (!opts.surface || !VK.actions) return;
      extra.textContent = '';
      VK.actions.forSurface(opts.surface, null, { all: true }).forEach(function (a) { var m = VK.mini.fromAction(a); m.dataset.size = 'sm'; extra.appendChild(m); });
      if (extraRov) extraRov.update(); else extraRov = VK.focus.roving(extra, { items: '.vk-mini', orientation: 'horizontal', typeahead: false });
    }
    function refresh() {
      if (!opts.surface || !VK.actions) return;
      Array.prototype.forEach.call(extra.querySelectorAll('.vk-mini[data-action]'), function (m) { var a = VK.actions.get(m.dataset.action); if (a) VK.mini.refresh(m, a); });
    }
    if (opts.surface && VK.actions) {
      renderExtra();
      unsub = VK.actions.subscribe(function (kind, a) {
        if ((kind === 'register' || kind === 'unregister') && a && a.at.indexOf(opts.surface) >= 0) renderExtra();
        else if (kind === 'run' || kind === 'context') refresh();
      });
    }

    (opts.tabs || []).forEach(function (t) { add(t, { activate: false }); });
    if (opts.active && find(opts.active)) select(opts.active); else if (items[0]) select(items[0].id);
    sync();

    var api = {
      el: el, add: add, close: close, select: select, next: next, refresh: refresh,
      closeActive: function () { return activeId ? close(activeId) : false; },
      setDirty: function (id, on) { var t = find(id); if (t) setDirtyEl(t, on); },
      setLabel: function (id, s) { var t = find(id); if (t) { t.label = s; t.labelEl.textContent = s; t.tab.title = s; sync(); } },
      active: function () { return activeId; },
      ids: function () { return items.map(function (t) { return t.id; }); },
      isDirty: function (id) { var t = find(id); return !!(t && t.dirty); },
      destroy: function () { rov.destroy(); if (extraRov) extraRov.destroy(); if (ro) ro.disconnect(); if (unsub) unsub(); el.textContent = ''; }
    };
    return api;
  }

  /** suggested registry actions for a tabs instance; o: {prefix:'tabs', at:['palette'], when: ctx=>bool, group} */
  function actions(t, o) {
    o = o || {};
    var p = o.prefix || 'tabs', at = o.at || ['palette'], g = o.group || 'Lapok';
    var when = function (c) { return (!o.when || o.when(c)) && t.ids().length > 0; };
    return [
      { id: p + '.close', label: 'Lap bezárása', hint: 'Az aktív lap bezárása', group: g, icon: 'close', keys: ['mod+w'], at: at, when: when, run: function () { t.closeActive(); } },
      { id: p + '.next', label: 'Következő lap', group: g, icon: 'chevron-right', keys: ['mod+pagedown'], at: at, when: when, run: function () { t.next(1); } },
      { id: p + '.prev', label: 'Előző lap', group: g, icon: 'chevron-left', keys: ['mod+pageup'], at: at, when: when, run: function () { t.next(-1); } }
    ];
  }

  VK.tabs = { mount: mount, actions: actions };
})(typeof window !== 'undefined' ? window : globalThis);
