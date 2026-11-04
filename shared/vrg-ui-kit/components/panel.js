/* VRG UI Kit — components/panel.js — dockable panel with mini controls.
     var p = VK.panel.mount(el, {
       title: 'Projektfa', label: '[01]', icon: 'tree', level: 3,
       controls: ['collapse', 'maximize', 'float', 'close'],   // which header minis (default ['collapse'])
       surface: 'toolbar:tree',                                 // optional registry minis before the controls
       collapsed: false, onCollapse(p, on), onMaximize(p, on), onFloat(p, on) → false = handled by the app,
       onClose(p) → false vetoes })
     p.collapse(on?) · p.toggle() · p.maximize(on?) · p.float(on?, {x,y,w,h}) · p.close() · p.open()
     p.setTitle(s) · p.setState({state:'running', progress:.4 | null, label:'Betöltés'}) · p.isCollapsed() · p.refresh() · p.destroy()
     VK.panel.get(el) → the instance mounted on el
   Works inside a shell dock (stacked, collapsible) and floating (absolute over the nearest positioned ancestor,
   glass, drag the header with a pointer, Ctrl+arrows move it while focus is in the header). Esc leaves maximised.
   Header minis: one tab stop, ←/→ between them. Events: vk:panelcollapse, vk:panelmaximize, vk:panelfloat, vk:panelclose.
   Depends on: core.js, focus.js, mini.js (actions.js when `surface` is used). */
(function (root) {
  'use strict';
  var VK = root.VK = root.VK || {};
  if (VK.panel) return;

  var registry = typeof WeakMap !== 'undefined' ? new WeakMap() : null;

  function setIcon(mini, name) { var u = mini.querySelector('use'); if (u) u.setAttribute('href', '#vk-i-' + name); }

  function mount(el, opts) {
    opts = opts || {};
    el.classList.add('vk-panel');
    if (!el.hasAttribute('data-vk-hop')) el.setAttribute('data-vk-hop', '');
    if (opts.icon) el.dataset.icon = opts.icon;
    var head = el.querySelector(':scope > .vk-panel__head');
    var body = el.querySelector(':scope > .vk-panel__body');
    if (!body) {
      body = VK.el('div.vk-panel__body');
      Array.prototype.slice.call(el.childNodes).forEach(function (n) { if (n !== head) body.appendChild(n); });
      el.appendChild(body);
    }
    if (!body.id) body.id = VK.uid('vk-panel-body');
    if (!head) { head = VK.el('header.vk-panel__head'); el.insertBefore(head, el.firstChild); }
    var labelEl = head.querySelector('.vk-panel__label');
    if (!labelEl) { labelEl = VK.el('span.vk-panel__label', { 'aria-hidden': 'true' }); head.insertBefore(labelEl, head.firstChild); }
    if (opts.label != null) labelEl.textContent = opts.label;
    var titleEl = head.querySelector('.vk-panel__title');
    if (!titleEl) { titleEl = VK.el('h' + (opts.level || 3) + '.vk-panel__title'); head.appendChild(titleEl); }
    if (opts.title != null) titleEl.textContent = opts.title;
    if (!titleEl.id) titleEl.id = VK.uid('vk-panel-t');
    if (el.tagName !== 'SECTION' && !el.getAttribute('role')) el.setAttribute('role', 'region');
    el.setAttribute('aria-labelledby', titleEl.id);
    var tools = head.querySelector('.vk-panel__tools');
    if (!tools) { tools = VK.el('div.vk-panel__tools', { role: 'toolbar' }); head.appendChild(tools); }
    tools.setAttribute('aria-label', titleEl.textContent + ' — vezérlők');
    if (!VK.focus.first(body)) body.tabIndex = 0;          // scrollable by keyboard

    var title = function () { return titleEl.textContent; };
    var controls = opts.controls || ['collapse'];
    var minis = {}, stateMini = null, regBox = VK.el('span', { style: { display: 'contents' } }), unsub = null;
    tools.appendChild(regBox);
    function ctl(kind, icon, label, fn) {
      var m = VK.mini.create({ icon: icon, label: label, size: 'sm', meter: 'none', onClick: fn });
      m.dataset.ctl = kind; tools.appendChild(m); minis[kind] = m; return m;
    }
    if (controls.indexOf('collapse') >= 0) {
      ctl('collapse', 'chevron-up', 'Összecsukás', function () { api.toggle(); });
      minis.collapse.setAttribute('aria-expanded', 'true');
      minis.collapse.setAttribute('aria-controls', body.id);
    }
    if (controls.indexOf('maximize') >= 0) ctl('maximize', 'maximize', 'Teljes méret', function () { api.maximize(); }).setAttribute('aria-pressed', 'false');
    if (controls.indexOf('float') >= 0) ctl('float', 'window', 'Lebegtetés', function () { api.float(); }).setAttribute('aria-pressed', 'false');
    if (controls.indexOf('close') >= 0) ctl('close', 'close', 'Bezárás', function () { api.close(); });
    var rov = VK.focus.roving(tools, { items: '.vk-mini', orientation: 'horizontal', typeahead: false });

    function relabel(m, label) { m.dataset.label = label; m.title = label; VK.mini.set(m, {}); }

    // registry minis (panel-specific verbs, e.g. "Frissítés")
    function renderReg() {
      if (!opts.surface || !VK.actions) return;
      regBox.textContent = '';
      VK.actions.forSurface(opts.surface, null, { all: true }).forEach(function (a) { var m = VK.mini.fromAction(a); m.dataset.size = 'sm'; regBox.appendChild(m); });
      rov.update();
    }
    function refresh() {
      Array.prototype.forEach.call(regBox.querySelectorAll('.vk-mini[data-action]'), function (m) { var a = VK.actions.get(m.dataset.action); if (a) VK.mini.refresh(m, a); });
    }
    if (opts.surface && VK.actions) {
      renderReg();
      unsub = VK.actions.subscribe(function (kind, a) {
        if ((kind === 'register' || kind === 'unregister') && a && a.at.indexOf(opts.surface) >= 0) renderReg();
        else if (kind === 'run' || kind === 'context') refresh();
      });
    }

    // ---- floating: drag and keyboard move ----
    var fl = null;
    function placeFloat(x, y, w, h) {
      var cb = el.offsetParent || el.parentNode;
      var W = cb.clientWidth, H = cb.clientHeight;
      w = Math.min(w, W); h = Math.min(h, H);
      fl = { x: VK.clamp(x, 0, Math.max(0, W - w)), y: VK.clamp(y, 0, Math.max(0, H - h)), w: w, h: h };
      el.style.left = fl.x + 'px'; el.style.top = fl.y + 'px'; el.style.width = fl.w + 'px'; el.style.height = fl.h + 'px';
    }
    function onHeadDown(e) {
      if (!el.hasAttribute('data-floating') || e.button || e.target.closest('.vk-mini')) return;
      e.preventDefault();
      var cb = el.offsetParent, k = cb ? cb.getBoundingClientRect().width / (cb.offsetWidth || 1) || 1 : 1;
      var sx = e.clientX, sy = e.clientY, ox = fl.x, oy = fl.y;
      try { head.setPointerCapture(e.pointerId); } catch (x) { /* synthetic */ }
      el.setAttribute('data-dragging', '');
      function mv(ev) { placeFloat(ox + (ev.clientX - sx) / k, oy + (ev.clientY - sy) / k, fl.w, fl.h); }
      function up() { head.removeEventListener('pointermove', mv); head.removeEventListener('pointerup', up); head.removeEventListener('pointercancel', up); el.removeAttribute('data-dragging'); }
      head.addEventListener('pointermove', mv); head.addEventListener('pointerup', up); head.addEventListener('pointercancel', up);
    }
    function onHeadKey(e) {
      if (!el.hasAttribute('data-floating') || !(e.ctrlKey || e.metaKey) || e.shiftKey || !/^Arrow/.test(e.key)) return;
      var d = { ArrowLeft: [-16, 0], ArrowRight: [16, 0], ArrowUp: [0, -16], ArrowDown: [0, 16] }[e.key];
      e.preventDefault(); placeFloat(fl.x + d[0], fl.y + d[1], fl.w, fl.h);
    }
    function onKey(e) {
      if (e.key === 'Escape' && el.hasAttribute('data-maximized') && !e.defaultPrevented) { e.preventDefault(); api.maximize(false); if (minis.maximize) minis.maximize.focus(); }
    }
    head.addEventListener('pointerdown', onHeadDown);
    head.addEventListener('keydown', onHeadKey);
    el.addEventListener('keydown', onKey);

    var api = {
      el: el, head: head, body: body,
      isCollapsed: function () { return el.hasAttribute('data-collapsed'); },
      collapse: function (on) {
        if (on === undefined) on = true;
        if (on === api.isCollapsed()) return;
        if (on) el.setAttribute('data-collapsed', ''); else el.removeAttribute('data-collapsed');
        if (minis.collapse) { minis.collapse.setAttribute('aria-expanded', on ? 'false' : 'true'); setIcon(minis.collapse, on ? 'chevron-down' : 'chevron-up'); relabel(minis.collapse, on ? 'Kinyitás' : 'Összecsukás'); }
        if (opts.onCollapse) opts.onCollapse(api, on);
        VK.fire(el, 'panelcollapse', { collapsed: on });
      },
      toggle: function () { api.collapse(!api.isCollapsed()); },
      maximize: function (on) {
        if (on === undefined) on = !el.hasAttribute('data-maximized');
        if (opts.onMaximize && opts.onMaximize(api, on) === false) return;
        if (on) { if (el.hasAttribute('data-floating')) api.float(false); api.collapse(false); el.setAttribute('data-maximized', ''); }
        else el.removeAttribute('data-maximized');
        if (minis.maximize) { VK.mini.set(minis.maximize, { pressed: on }); setIcon(minis.maximize, on ? 'minimize' : 'maximize'); relabel(minis.maximize, on ? 'Visszaállítás' : 'Teljes méret'); }
        VK.fire(el, 'panelmaximize', { maximized: on });
      },
      float: function (on, rect) {
        if (on === undefined) on = !el.hasAttribute('data-floating');
        if (opts.onFloat && opts.onFloat(api, on) === false) return;
        if (on) {
          if (el.hasAttribute('data-maximized')) api.maximize(false);
          var r0 = el.getBoundingClientRect();
          el.setAttribute('data-floating', ''); el.classList.add('vk-glass');
          var cb = el.offsetParent || el.parentNode, cr = cb.getBoundingClientRect(), k = cr.width / (cb.offsetWidth || 1) || 1;
          rect = rect || { x: (r0.left - cr.left) / k - 24, y: (r0.top - cr.top) / k + 24, w: Math.max(240, r0.width / k), h: Math.min(Math.max(160, r0.height / k), cb.clientHeight * 0.6) };
          placeFloat(rect.x, rect.y, rect.w, rect.h);
        } else {
          el.removeAttribute('data-floating'); el.classList.remove('vk-glass');
          ['left', 'top', 'width', 'height'].forEach(function (p) { el.style.removeProperty(p); });
          fl = null;
        }
        if (minis.float) { VK.mini.set(minis.float, { pressed: on }); setIcon(minis.float, on ? 'dock' : 'window'); relabel(minis.float, on ? 'Visszadokkolás' : 'Lebegtetés'); }
        VK.fire(el, 'panelfloat', { floating: on });
      },
      close: function () {
        if (opts.onClose && opts.onClose(api) === false) return;
        var had = el.contains(document.activeElement);
        if (el.hasAttribute('data-maximized')) api.maximize(false);
        el.hidden = true;
        VK.fire(el, 'panelclose', { hadFocus: had });
      },
      open: function () { el.hidden = false; VK.fire(el, 'panelopen', {}); },
      setTitle: function (s) { titleEl.textContent = s; tools.setAttribute('aria-label', s + ' — vezérlők'); },
      title: title,
      setState: function (o) {
        o = o || {};
        var st = o.state && o.state !== 'idle' ? o.state : null;
        if (!st) {
          if (stateMini) { stateMini.remove(); stateMini = null; rov.update(); }
          el.removeAttribute('data-state'); delete el.dataset.progress;
        } else {
          if (!stateMini) { stateMini = VK.mini.create({ icon: o.icon || el.dataset.icon || 'loader', label: o.label || 'Állapot', size: 'sm' }); tools.insertBefore(stateMini, tools.firstChild); rov.update(); }
          if (o.label) relabel(stateMini, o.label);
          VK.mini.set(stateMini, { state: st, progress: o.progress });
          el.setAttribute('data-state', st);
          if (o.progress == null) delete el.dataset.progress; else el.dataset.progress = String(o.progress);
        }
        VK.fire(el, 'panelstate', { state: st, progress: o.progress });
      },
      refresh: refresh,
      destroy: function () {
        rov.destroy(); if (unsub) unsub();
        head.removeEventListener('pointerdown', onHeadDown); head.removeEventListener('keydown', onHeadKey); el.removeEventListener('keydown', onKey);
        Object.keys(minis).forEach(function (k) { minis[k].remove(); });
        if (registry) registry.delete(el);
      }
    };
    if (opts.collapsed) api.collapse(true);
    if (registry) registry.set(el, api);
    return api;
  }

  function get(el) { return registry && el ? registry.get(el) || null : null; }

  VK.panel = { mount: mount, get: get };
})(typeof window !== 'undefined' ? window : globalThis);
