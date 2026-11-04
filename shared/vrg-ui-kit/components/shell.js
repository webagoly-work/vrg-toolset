/* VRG UI Kit — components/shell.js — the app frame: docks that collapse to a rail of minis, normal / HUD mode.
     var sh = VK.shell.mount(el, {
       mode: 'normal' | 'hud',
       docks: {left: {collapsed:false, size:240}, right: {size:260}, bottom: {collapsed:true, size:180}},
       autoCollapse: 720,          // side docks fold to rails while the frame is narrower than this (px), and come back
       labels: {left:'Bal dokk', …}, onChange(state) })
     sh.toggle(side, open?) · sh.collapsed(side) · sh.setSize(side, px) · sh.setMode('hud'|'normal') · sh.toggleMode()
     sh.mode() · sh.state() → {mode, left:{collapsed,size}, …} · sh.refreshRails() · sh.destroy()
     VK.shell.actions(sh, {prefix:'shell', at:['palette'], keys:{hud:'alt+h'}, when}) → registry actions
       <prefix>.hud (HUD mód, checked) · <prefix>.dock.left|right|bottom (dock toggles, checked = open)
   The HUD toggle is a registry action: render it on any surface (toolbar:command, statusbar, palette).
   In HUD mode the shell sets .vk-glass on its bars, rails and docked panels (and removes it again on exit).
   Rail: one tab stop, ↑/↓ (←/→ on the bottom dock); the first mini opens the dock, the others open it at that panel.
   Depends on: core.js, focus.js, mini.js, panel.js (panels in docks), actions.js (for VK.shell.actions). */
(function (root) {
  'use strict';
  var VK = root.VK = root.VK || {};
  if (VK.shell) return;

  var SIDES = ['left', 'right', 'bottom'];
  var HU = { left: 'Bal dokk', right: 'Jobb dokk', bottom: 'Alsó dokk' };
  var ICON = { left: 'panel-left', right: 'panel-right', bottom: 'panel-bottom' };

  function mount(el, opts) {
    opts = opts || {};
    el.classList.add('vk-shell');
    var docks = {}, rails = {}, rovs = {}, sizes = {}, labels = Object.assign({}, HU, opts.labels || {});
    var mode = 'normal', auto = null, ro = null;
    SIDES.forEach(function (s) { docks[s] = el.querySelector(':scope > .vk-shell__dock[data-dock="' + s + '"]'); });

    function panelsOf(s) { return docks[s] ? Array.prototype.filter.call(docks[s].children, function (c) { return c.classList.contains('vk-panel') && !c.hidden; }) : []; }
    function titleOf(p) { var t = p.querySelector('.vk-panel__title'); return t ? t.textContent.trim() : (p.getAttribute('aria-label') || 'Panel'); }

    function buildRail(s) {
      var d = docks[s]; if (!d) return;
      var r = rails[s];
      if (!r) {
        r = VK.el('div.vk-shell__rail', { role: 'toolbar', 'aria-label': labels[s] + ' — összecsukva', 'aria-orientation': s === 'bottom' ? 'horizontal' : 'vertical' });
        d.insertBefore(r, d.firstChild); rails[s] = r;
        rovs[s] = VK.focus.roving(r, { items: '.vk-mini', orientation: s === 'bottom' ? 'horizontal' : 'vertical', typeahead: false });
      }
      r.textContent = '';
      var open = VK.mini.create({ icon: ICON[s], label: labels[s] + ' kinyitása', onClick: function () { toggle(s, true, true); } });
      open.setAttribute('aria-expanded', 'false');
      r.appendChild(open);
      r.appendChild(VK.el('span.vk-shell__rail-sep', { 'aria-hidden': 'true' }));
      panelsOf(s).forEach(function (p) {
        var m = VK.mini.create({ icon: p.dataset.icon || 'panel-left', label: titleOf(p), onClick: function () { openAt(s, p); } });
        if (p.dataset.state) VK.mini.set(m, { state: p.dataset.state, progress: p.dataset.progress != null ? +p.dataset.progress : null });
        m._vkPanel = p;
        r.appendChild(m);
      });
      r.appendChild(VK.el('span.vk-shell__rail-tag', { 'aria-hidden': 'true', text: labels[s] }));
      if (mode === 'hud' && !r.classList.contains('vk-glass')) { r.classList.add('vk-glass'); r.setAttribute('data-vk-shell-glass', ''); }
      rovs[s].update();
    }
    function syncRailState(p) {
      SIDES.forEach(function (s) {
        if (!rails[s]) return;
        Array.prototype.forEach.call(rails[s].querySelectorAll('.vk-mini'), function (m) {
          if (m._vkPanel !== p) return;
          VK.mini.set(m, { state: p.dataset.state || 'idle', progress: p.dataset.progress != null ? +p.dataset.progress : (p.dataset.state === 'running' ? null : undefined) });
        });
      });
    }
    function openAt(s, p) {
      toggle(s, true);
      var inst = VK.panel && VK.panel.get(p);
      if (inst && inst.isCollapsed()) inst.collapse(false);
      var t = p.querySelector('.vk-panel__body [tabindex="0"]') || VK.focus.first(p.querySelector('.vk-panel__body') || p) || VK.focus.first(p);
      if (t) t.focus();
    }

    function collapsed(s) { return !!(docks[s] && docks[s].hasAttribute('data-collapsed')); }
    function toggle(s, open, focusIn) {
      var d = docks[s]; if (!d) return;
      if (open === undefined) open = collapsed(s);
      if (open === !collapsed(s)) return;
      var had = d.contains(document.activeElement);
      if (open) d.removeAttribute('data-collapsed'); else { buildRail(s); d.setAttribute('data-collapsed', ''); }
      if (auto) auto.touched[s] = true;
      if (!open && had) { var m = rails[s] && rails[s].querySelector('.vk-mini'); if (m) m.focus(); }
      if (open && (had || focusIn)) { var f = VK.focus.first(d.querySelector('.vk-panel:not([hidden])') || d); if (f) f.focus(); }
      changed();
    }
    function setSize(s, px) {
      sizes[s] = px;
      el.style.setProperty('--vk-shell-' + s, px + 'px');
      changed();
    }

    function glassTargets() {
      var list = [];
      Array.prototype.forEach.call(el.querySelectorAll(':scope > .vk-shell__top > *, :scope > .vk-shell__status > *'), function (n) { list.push(n); });
      SIDES.forEach(function (s) { panelsOf(s).forEach(function (p) { list.push(p); }); if (rails[s]) list.push(rails[s]); });
      return list;
    }
    function setMode(m) {
      m = m === 'hud' ? 'hud' : 'normal';
      if (m === mode) return;
      if (mode === 'hud') Array.prototype.forEach.call(el.querySelectorAll('[data-vk-shell-glass]'), function (n) {
        if (!n.hasAttribute('data-floating')) n.classList.remove('vk-glass'); n.removeAttribute('data-vk-shell-glass'); });
      mode = m;
      el.dataset.mode = m;
      if (m === 'hud') glassTargets().forEach(function (n) { if (!n.classList.contains('vk-glass')) { n.classList.add('vk-glass'); n.setAttribute('data-vk-shell-glass', ''); } });
      VK.fire(el, 'shellmode', { mode: m });
      changed();
    }

    function state() {
      var st = { mode: mode };
      SIDES.forEach(function (s) { if (docks[s]) st[s] = { collapsed: collapsed(s), size: sizes[s] || null }; });
      return st;
    }
    function changed() { if (opts.onChange) opts.onChange(state()); }

    // auto-collapse side docks below a width, restore them above it (unless the user toggled meanwhile)
    if (opts.autoCollapse && root.ResizeObserver) {
      ro = new ResizeObserver(function () {
        var narrow = el.clientWidth < opts.autoCollapse;
        if (narrow && !auto) {
          auto = { prev: { left: collapsed('left'), right: collapsed('right') }, touched: {} };
          ['left', 'right'].forEach(function (s) { if (docks[s] && !collapsed(s)) { buildRail(s); docks[s].setAttribute('data-collapsed', ''); } });
          changed();
        } else if (!narrow && auto) {
          var a = auto; auto = null;
          ['left', 'right'].forEach(function (s) { if (docks[s] && !a.touched[s] && !a.prev[s]) docks[s].removeAttribute('data-collapsed'); });
          changed();
        }
      });
      ro.observe(el);
    }

    function onPanelEvt(e) {
      var p = e.target; if (!p.classList || !p.classList.contains('vk-panel')) return;
      if (e.type === 'vk:panelstate') { syncRailState(p); return; }
      SIDES.forEach(function (s) { if (docks[s] && docks[s].contains(p)) buildRail(s); });
      if (e.type === 'vk:panelclose' && e.detail && e.detail.hadFocus) { var f = VK.focus.first(el.querySelector('.vk-shell__main') || el); if (f) f.focus(); }
    }
    el.addEventListener('vk:panelclose', onPanelEvt);
    el.addEventListener('vk:panelopen', onPanelEvt);
    el.addEventListener('vk:panelstate', onPanelEvt);

    var d0 = opts.docks || {};
    SIDES.forEach(function (s) {
      if (!docks[s]) return;
      if (!docks[s].hasAttribute('aria-label')) docks[s].setAttribute('aria-label', labels[s]);
      if (!docks[s].hasAttribute('data-vk-hop')) docks[s].setAttribute('data-vk-hop', '');
      var o = d0[s] || {};
      if (o.size) setSize(s, o.size);
      buildRail(s);
      if (o.collapsed) docks[s].setAttribute('data-collapsed', '');
      else if (o.collapsed === false) docks[s].removeAttribute('data-collapsed');
    });
    el.dataset.mode = 'normal';
    if (opts.mode === 'hud') setMode('hud');

    return {
      el: el, toggle: toggle, collapsed: collapsed, setSize: setSize, setMode: setMode, state: state,
      mode: function () { return mode; },
      toggleMode: function () { setMode(mode === 'hud' ? 'normal' : 'hud'); },
      refreshRails: function () { SIDES.forEach(buildRail); },
      hasDock: function (s) { return !!docks[s]; },
      destroy: function () {
        if (ro) ro.disconnect();
        Object.keys(rovs).forEach(function (s) { rovs[s].destroy(); rails[s].remove(); });
        el.removeEventListener('vk:panelclose', onPanelEvt); el.removeEventListener('vk:panelopen', onPanelEvt); el.removeEventListener('vk:panelstate', onPanelEvt);
        setMode('normal');
      }
    };
  }

  /** registry actions for a shell; o: {prefix:'shell', at:['palette'], keys:{hud, left, right, bottom}, when, group} */
  function actions(sh, o) {
    o = o || {};
    var p = o.prefix || 'shell', at = o.at || ['palette'], k = o.keys || {}, g = o.group || 'Munkafelület';
    var when = function (c) { return !o.when || o.when(c); };
    var out = [{ id: p + '.hud', label: 'HUD mód', hint: 'Átlátszó keret a tartalom fölött, üvegpanelek', group: g, icon: 'hud', caption: o.captions ? 'HUD' : undefined,
      keys: k.hud ? [k.hud] : [], at: at, when: when, checked: function () { return sh.mode() === 'hud'; }, run: function () { sh.toggleMode(); } }];
    SIDES.forEach(function (s) {
      if (!sh.hasDock(s)) return;
      out.push({ id: p + '.dock.' + s, label: HU[s], hint: HU[s] + ' kinyitása / összecsukása', group: g, icon: ICON[s],
        keys: k[s] ? [k[s]] : [], at: at, when: when, checked: function () { return !sh.collapsed(s); }, run: function () { sh.toggle(s); } });
    });
    return out;
  }

  VK.shell = { mount: mount, actions: actions };
})(typeof window !== 'undefined' ? window : globalThis);
