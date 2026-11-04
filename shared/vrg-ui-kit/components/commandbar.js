/* VRG UI Kit — components/commandbar.js — the top command bar.
     var cb = VK.commandbar.mount(el, {
       brand: {name:'VRG Desktop', tag:'MÉRŐPULT // V1', emblem: Element | null (built-in emblem)},
       path: [{id:'job', label:'VRG-2611-03', mono:true, icon:'folder'}, {label:'Erősáram'}, …],
       onNavigate(index, segment),          // a breadcrumb was pressed (the app usually calls cb.setPath)
       surface: 'toolbar:command',          // minis rendered from the registry via VK.mini.fromAction
       searchAction: 'palette.open',        // run through VK.actions.run — no hard dependency on the palette
       searchText: 'Keresés vagy parancs…' })
     cb.setPath(path) · cb.setBrand(brand) · cb.refresh() (re-read mini state/progress) · cb.render() · cb.destroy()
   The search trigger is aria-disabled while searchAction is not registered and wakes up when it is.
   Keyboard: crumbs and the search trigger are ordinary buttons; the minis are one toolbar tab stop (←/→).
   Depends on: core.js, focus.js, mini.js, actions.js. */
(function (root) {
  'use strict';
  var VK = root.VK = root.VK || {};
  if (VK.commandbar) return;

  var NS = 'http://www.w3.org/2000/svg';
  /** the built-in emblem: a chamfered frame, a wire bending into a node, a hollow junction */
  function emblem() {
    var s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'vk-commandbar__emblem'); s.setAttribute('aria-hidden', 'true');
    s.innerHTML = '<path d="M6 2.5h15.5v15.5L18 21.5H2.5V6z"/><path d="M6 8h6.5a2.5 2.5 0 0 1 2.5 2.5V17"/>' +
      '<path d="M15 4.8 16.7 6.5 15 8.2 13.3 6.5z"/><circle class="f" cx="15" cy="17" r="1.9"/><rect class="f" x="4.6" y="6.6" width="2.8" height="2.8"/>';
    return s;
  }

  function mount(el, opts) {
    opts = opts || {};
    var surface = opts.surface || 'toolbar:command', searchId = opts.searchAction || 'palette.open';
    el.classList.add('vk-commandbar');
    if (!el.hasAttribute('data-vk-hop')) el.setAttribute('data-vk-hop', '');
    el.textContent = '';
    var brand = VK.el('div.vk-commandbar__brand');
    var crumbs = VK.el('ol.vk-commandbar__crumbs');
    var nav = VK.el('nav.vk-commandbar__nav', { 'aria-label': opts.pathLabel || 'Útvonal' }, crumbs);
    var kbd = VK.el('kbd.vk-commandbar__kbd', { 'aria-hidden': 'true' });
    var searchText = opts.searchText || 'Keresés vagy parancs…';
    var search = VK.el('button.vk-commandbar__search', { type: 'button', 'aria-label': searchText },
      [VK.icon('search'), VK.el('span', { text: searchText }), kbd]);
    var tools = VK.el('div.vk-commandbar__tools', { role: 'toolbar', 'aria-label': opts.toolsLabel || 'Parancsok' });
    el.appendChild(VK.el('div.vk-commandbar__in', null, [brand, nav, opts.search === false ? null : search, tools]));
    var path = [], rov = null, unsub = null;

    function setBrand(b) {
      brand.textContent = '';
      if (b === false) { brand.hidden = true; return; }
      b = b || {}; brand.hidden = false;
      brand.appendChild(b.emblem && b.emblem.nodeType ? b.emblem : emblem());
      if (b.name) brand.appendChild(VK.el('span.vk-commandbar__name', { text: b.name }));
      if (b.tag) brand.appendChild(VK.el('span.vk-commandbar__tag', { text: b.tag }));
    }
    function setPath(p) {
      path = (p || []).slice(); crumbs.textContent = '';
      path.forEach(function (seg, i) {
        var last = i === path.length - 1;
        var b = VK.el('button.vk-commandbar__crumb', { type: 'button', title: seg.title || seg.label, 'aria-current': last ? 'location' : null, 'data-mono': seg.mono || null },
          [seg.icon ? VK.icon(seg.icon) : null, VK.el('span', { text: seg.label })]);
        b.addEventListener('click', function () {
          if (opts.onNavigate) opts.onNavigate(i, seg);
          VK.fire(el, 'navigate', { index: i, segment: seg });
        });
        crumbs.appendChild(VK.el('li', null, b));
      });
    }
    function syncSearch() {
      var a = VK.actions.get(searchId), on = !!(a && VK.actions.enabled(a));
      search.setAttribute('aria-disabled', on ? 'false' : 'true');
      search.title = on ? searchText : searchText + ' — a parancspaletta nincs betöltve';
      kbd.textContent = a && a.keys && a.keys[0] ? VK.actions.keyLabel(a.keys[0]) : '';
    }
    function render() {
      tools.textContent = '';
      VK.actions.forSurface(surface, null, { all: true }).forEach(function (a) { var m = VK.mini.fromAction(a); m.dataset.size = 'sm'; tools.appendChild(m); });
      if (rov) rov.update(); else rov = VK.focus.roving(tools, { items: '.vk-mini', orientation: 'horizontal', typeahead: false });
      syncSearch();
    }
    function refresh() {
      Array.prototype.forEach.call(tools.querySelectorAll('.vk-mini[data-action]'), function (m) { var a = VK.actions.get(m.dataset.action); if (a) VK.mini.refresh(m, a); });
      syncSearch();
    }
    search.addEventListener('click', function () { if (search.getAttribute('aria-disabled') !== 'true') VK.actions.run(searchId, null, 'commandbar'); });
    unsub = VK.actions.subscribe(function (kind, a) {
      if ((kind === 'register' || kind === 'unregister') && a && (a.at.indexOf(surface) >= 0)) render();
      else if (kind === 'register' || kind === 'unregister') { if (a && a.id === searchId) syncSearch(); }
      else if (kind === 'run' || kind === 'context') refresh();
    });

    setBrand(opts.brand);
    setPath(opts.path);
    render();
    return {
      el: el, setPath: setPath, setBrand: setBrand, refresh: refresh, render: render,
      path: function () { return path.slice(); },
      destroy: function () { if (unsub) unsub(); if (rov) rov.destroy(); el.textContent = ''; }
    };
  }

  VK.commandbar = { mount: mount, emblem: emblem };
})(typeof window !== 'undefined' ? window : globalThis);
