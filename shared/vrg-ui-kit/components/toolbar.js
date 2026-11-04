/* VRG UI Kit — components/toolbar.js — a registry surface 'toolbar:<id>' as MINIs or labelled buttons.
     var tb = VK.toolbar.mount(el, {
       id: 'plan',                    // renders VK.actions.forSurface('toolbar:plan', ctx, {all:true}) in registry order
       mode: 'mini' | 'label',        // minis (icon = button = progress) or mini meter + text label
       placement: 'top',              // top | bottom | left | right | floating — inside the host (el's parent by default)
       placeable: true,               // registers the placement actions (see below)
       placementAt: ['menu:canvas'],  // extra surfaces for the 'Eszköztár helye' submenu action
       onPlacement: (p, xy) => save,  // remember the user's choice (xy = {x, y} for floating)
       name: 'Tervező eszköztár',     // used in the placement action labels
       label: 'Eszköztár',            // aria-label
       captions: false, size: 'md', ctx: () => ({…}) })
     → {el, refresh(), rebuild(), setPlacement(p, xy), placement(), setMode(m), destroy()}
   Groups (action.group changes) get separators; actions with children/many open a dropdown menu; when space runs out
   (ResizeObserver) trailing items move into a "Továbbiak" menu. Placement actions: 'toolbar.<id>.placement' (on the
   toolbar itself: opens the five choices; elsewhere: submenu) and 'toolbar.<id>.place.<p>' (palette + the toolbar's
   own context menu 'menu:toolbar:<id>'). Minis refresh on every registry change (run, context, register) and on the
   document event 'vk:actions' (fire it from progress timers: VK.fire(document, 'actions')).
   Keys: one tab stop, arrows/Home/End move, Enter/Space run, Shift+F10 = placement menu. Floating: drag the grip.
   Depends on: core, focus, actions, mini, menu. Optional: kbd (aria-keyshortcuts). */
(function (root) {
  'use strict';
  var VK = root.VK = root.VK || {};
  if (VK.toolbar) return;

  var PL = ['top', 'bottom', 'left', 'right', 'floating'];
  var PL_HU = { top: 'fent', bottom: 'lent', left: 'balra', right: 'jobbra', floating: 'lebegő' };
  var PL_ICON = { top: 'arrow-up', bottom: 'panel-bottom', left: 'panel-left', right: 'panel-right', floating: 'window' };
  var STATE_HU = { running: 'fut', done: 'kész', error: 'hiba', waiting: 'várakozik', paused: 'szünetel', off: 'kikapcsolva' };

  function reasonOf(a, c) { var r = a.reason; try { r = typeof r === 'function' ? r(c) : r; } catch (e) { r = ''; } return r || ''; }

  function mount(el, o) {
    o = o || {};
    var id = o.id || 'main', surface = 'toolbar:' + id, base = 'toolbar.' + id;
    var host = o.host || el.parentElement;
    var place = PL.indexOf(o.placement) >= 0 ? o.placement : 'top', mode = o.mode || 'mini';
    var pos = o.position || null, nodes = [], hiddenActs = [], destroyed = false;

    host.classList.add('vk-toolbar-host');
    el.classList.add('vk-toolbar');
    el.setAttribute('role', 'toolbar');
    el.setAttribute('aria-label', o.label || o.name || 'Eszköztár');
    el.setAttribute('data-vk-hop', '');
    el.dataset.mode = mode;

    var grip = VK.el('span.vk-toolbar__grip', { 'aria-hidden': 'true', title: 'Húzd az áthelyezéshez' }, VK.icon('grip'));
    var more = VK.mini.create({ icon: 'more-h', label: 'Továbbiak', size: o.size });
    more.classList.add('vk-toolbar__more'); more.setAttribute('aria-haspopup', 'menu'); more.setAttribute('aria-expanded', 'false');
    more.dataset.meter = 'none';
    el.textContent = '';
    el.appendChild(grip); el.appendChild(more);

    function ctx() { return o.ctx ? VK.actions.ctx(o.ctx()) : VK.actions.ctx(); }
    function vertical() { return place === 'left' || place === 'right'; }
    function menuSide() { return place === 'left' ? 'right' : place === 'right' ? 'left' : place === 'bottom' ? 'top' : 'bottom'; }

    function openMenu(src, b, label) {
      b.setAttribute('aria-expanded', 'true');
      VK.menu.open(src, b, ctx(), { restore: b, invoker: b, label: label, side: menuSide(),
        onClose: function () { b.setAttribute('aria-expanded', 'false'); } });
    }
    function activate(a, b) {
      if (a.children || a.many) { openMenu(a.children || function (c) { return a.many(c); }, b, a.label); return; }
      VK.actions.run(a, ctx(), 'toolbar');
      refresh();
    }

    function makeItem(a) {
      var b;
      if (mode === 'label') {
        var meter = VK.el('span.vk-mini.vk-toolbar__meter', { 'aria-hidden': 'true', 'data-size': 'sm' }, VK.icon(a.icon || 'dot'));
        if (!a.progress && !a.state) meter.dataset.meter = 'none';
        b = VK.el('button.vk-toolbar__btn', { type: 'button' }, [meter, VK.el('span.vk-toolbar__txt', null, a.label)]);
        b._vkMeter = meter;
      } else {
        b = VK.mini.create({ icon: a.icon || 'dot', label: a.label, caption: o.captions ? a.caption : null, size: o.size });
        if (!a.progress && !a.state && !a.checked) b.dataset.meter = 'none';
      }
      b.classList.add('vk-toolbar__item');
      b.dataset.action = a.id;
      if (a.keys && a.keys.length && VK.kbd) b.setAttribute('aria-keyshortcuts', VK.kbd.aria(a.keys[0]));
      if (a.children || a.many) { b.setAttribute('aria-haspopup', 'menu'); b.setAttribute('aria-expanded', 'false'); }
      if (a.danger) b.dataset.danger = '';
      b.addEventListener('click', function () { activate(a, b); });
      return b;
    }
    function refreshItem(b, a, c) {
      var on = VK.actions.enabled(a, c);
      var keyTxt = a.keys && a.keys.length ? ' (' + (VK.kbd ? VK.kbd.label(a.keys[0]) : VK.actions.keyLabel(a.keys[0])) + ')' : '';
      if (mode === 'label') {
        var m = b._vkMeter;
        VK.mini.refresh(m, a, c);
        b.disabled = !on;
        var chk = VK.actions.checked(a, c);
        if (chk !== undefined) b.setAttribute('aria-pressed', String(chk));
        var st = m.dataset.state, p = m.style.getPropertyValue('--vk-p');
        var tail = st === 'running' && p !== '' ? Math.round(parseFloat(p) * 100) + '%' : STATE_HU[st] || '';
        if (tail) b.setAttribute('aria-label', a.label + ' — ' + tail); else b.removeAttribute('aria-label');
        b.dataset.state = st || '';
      } else {
        VK.mini.refresh(b, a, c);
      }
      b.title = on ? a.label + keyTxt + (a.hint ? ' — ' + a.hint : '') : a.label + ' — ' + (reasonOf(a, c) || 'nem érhető el most');
    }

    var rov = VK.focus.roving(el, { items: '.vk-toolbar__item:not([hidden]), .vk-toolbar__more:not([hidden])', orientation: 'both', typeahead: false });

    function rebuild() {
      if (destroyed) return;
      var fa = document.activeElement, focusId = fa && el.contains(fa) ? fa.dataset.action || (fa === more ? '#more' : null) : null;
      Array.prototype.slice.call(el.children).forEach(function (n) { if (n !== grip && n !== more) n.remove(); });
      nodes = [];
      var c = ctx(), last = null;
      VK.actions.forSurface(surface, c, { all: true }).forEach(function (a) {
        var g = a.group || '';
        if (nodes.length && g !== last) el.insertBefore(VK.el('span.vk-toolbar__sep', { role: 'separator', 'aria-orientation': vertical() ? 'horizontal' : 'vertical' }), more);
        last = g;
        var b = makeItem(a);
        el.insertBefore(b, more);
        nodes.push({ a: a, b: b });
        refreshItem(b, a, c);
      });
      layout();
      if (focusId) {
        var t = focusId === '#more' ? more : el.querySelector('[data-action="' + focusId + '"]');
        if (t && !t.hidden && !t.disabled) { t.focus(); }
      }
      rov.update();
    }
    function refresh() {
      if (destroyed) return;
      var c = ctx();
      nodes.forEach(function (n) { refreshItem(n.b, n.a, c); });
      rov.update();
    }

    function fits() { return vertical() ? el.scrollHeight <= el.clientHeight + 1 : el.scrollWidth <= el.clientWidth + 1; }
    function layout() {
      if (destroyed) return;
      var had = document.activeElement, hadIn = had && el.contains(had);
      var seps = el.querySelectorAll('.vk-toolbar__sep');
      nodes.forEach(function (n) { n.b.hidden = false; });
      Array.prototype.forEach.call(seps, function (s) { s.hidden = false; s.setAttribute('aria-orientation', vertical() ? 'horizontal' : 'vertical'); });
      more.hidden = true; hiddenActs = [];
      more.querySelector('use').setAttribute('href', '#vk-i-' + (vertical() ? 'more-v' : 'more-h'));
      if (!fits()) {
        more.hidden = false;
        for (var i = nodes.length - 1; i >= 0 && !fits(); i--) { nodes[i].b.hidden = true; hiddenActs.unshift(nodes[i].a); }
      }
      // no separator at the end or doubled up
      var prevSep = true, kids = Array.prototype.slice.call(el.children), lastSep = null;
      kids.forEach(function (n) {
        if (n === grip || n.hidden) return;
        if (n.classList.contains('vk-toolbar__sep')) { if (prevSep) n.hidden = true; else { prevSep = true; lastSep = n; } }
        else if (n !== more) { prevSep = false; lastSep = null; }
      });
      if (lastSep) lastSep.hidden = true;
      if (hadIn) {                                  // hiding a focused item must not drop focus to <body>
        var tgt = had.hidden ? (more.hidden ? null : more) : had;
        if (tgt && document.activeElement !== tgt) tgt.focus({ preventScroll: true });
      }
      el.dataset.overflow = hiddenActs.length ? String(hiddenActs.length) : '';
      more.title = hiddenActs.length ? 'Továbbiak (' + hiddenActs.length + ')' : 'Továbbiak';
      rov.update();
    }
    more.addEventListener('click', function () { openMenu(hiddenActs.slice(), more, 'Továbbiak'); });

    // ---- placement
    function applyPos() {
      if (place !== 'floating') { el.style.removeProperty('--vk-toolbar-x'); el.style.removeProperty('--vk-toolbar-y'); return; }
      var p = pos || { x: 12, y: 12 };
      var hw = host.clientWidth, hh = host.clientHeight, w = el.offsetWidth, h = el.offsetHeight;
      p = { x: Math.round(VK.clamp(p.x, 0, Math.max(0, hw - w))), y: Math.round(VK.clamp(p.y, 0, Math.max(0, hh - h))) };
      pos = p;
      el.style.setProperty('--vk-toolbar-x', p.x + 'px'); el.style.setProperty('--vk-toolbar-y', p.y + 'px');
    }
    function setPlacement(p, xy, silent) {
      if (PL.indexOf(p) < 0) return;
      place = p; if (xy) pos = xy;
      host.dataset.placement = p;
      el.dataset.placement = p;
      el.setAttribute('aria-orientation', vertical() ? 'vertical' : 'horizontal');
      el.classList.toggle('vk-glass', p === 'floating');
      grip.hidden = p !== 'floating';
      applyPos();
      layout();
      if (p === 'floating') applyPos();
      if (!silent && o.onPlacement) o.onPlacement(p, p === 'floating' ? pos : null);
      if (!silent && VK.fire) VK.fire(document, 'actions');
    }
    var drag = null;
    grip.addEventListener('pointerdown', function (e) {
      if (place !== 'floating') return;
      e.preventDefault(); grip.setPointerCapture(e.pointerId);
      drag = { x: e.clientX, y: e.clientY, p: pos || { x: 12, y: 12 } };
      el.dataset.dragging = '';
    });
    grip.addEventListener('pointermove', function (e) {
      if (!drag) return;
      pos = { x: drag.p.x + e.clientX - drag.x, y: drag.p.y + e.clientY - drag.y }; applyPos();
    });
    function endDrag() { if (!drag) return; drag = null; delete el.dataset.dragging; if (o.onPlacement) o.onPlacement('floating', pos); }
    grip.addEventListener('pointerup', endDrag); grip.addEventListener('pointercancel', endDrag);

    var registered = [];
    if (o.placeable !== false) {
      var name = o.name || 'Eszköztár';
      PL.forEach(function (p) {
        registered.push(VK.actions.register({ id: base + '.place.' + p, label: name + ': ' + PL_HU[p], hint: 'Az eszköztár helye: ' + PL_HU[p],
          group: o.group || 'Eszköztár', icon: PL_ICON[p], at: ['palette', 'menu:toolbar:' + id],
          checked: function () { return place === p; }, run: function () { setPlacement(p); } }).id);
      });
      registered.push(VK.actions.register({ id: base + '.placement', label: 'Eszköztár helye', hint: 'Fent, lent, balra, jobbra vagy lebegő',
        group: o.placementGroup || 'Eszköztár', icon: 'dock', caption: 'HELY', at: [surface].concat(o.placementAt || []),
        children: PL.map(function (p) { return base + '.place.' + p; }),
        run: function () { setPlacement(PL[(PL.indexOf(place) + 1) % PL.length]); } }).id);
    }
    var offCtx = VK.menu.bindContext(el, 'menu:toolbar:' + id, function (t) { return t.closest && t.closest('.vk-menu') ? false : { toolbar: id, menuLabel: 'Eszköztár' }; });

    // ---- live updates
    var raf = 0, need = 0;
    function later(kind) { need = Math.max(need, kind); cancelAnimationFrame(raf); raf = requestAnimationFrame(function () { var k = need; need = 0; if (k > 1) rebuild(); else refresh(); }); }
    var unsub = VK.actions.subscribe(function (kind, a) {
      if ((kind === 'register' || kind === 'unregister') && a && a.at && a.at.indexOf(surface) < 0) return;
      later(kind === 'register' || kind === 'unregister' ? 2 : 1);
    });
    function onDoc() { later(1); }
    document.addEventListener('vk:actions', onDoc);
    var lraf = 0;
    var ro = 'ResizeObserver' in root ? new ResizeObserver(function () { cancelAnimationFrame(lraf); lraf = requestAnimationFrame(function () { layout(); if (place === 'floating') applyPos(); }); }) : null;
    if (ro) { ro.observe(el); ro.observe(host); }

    setPlacement(place, pos, true);
    rebuild();

    return {
      el: el, refresh: refresh, rebuild: rebuild, layout: layout,
      setPlacement: function (p, xy) { setPlacement(p, xy); }, placement: function () { return place; },
      setMode: function (m) { mode = m; el.dataset.mode = m; rebuild(); },
      destroy: function () {
        destroyed = true; unsub(); offCtx(); rov.destroy(); if (ro) ro.disconnect();
        document.removeEventListener('vk:actions', onDoc); cancelAnimationFrame(raf); cancelAnimationFrame(lraf);
        registered.forEach(VK.actions.unregister); el.textContent = '';
      }
    };
  }

  VK.toolbar = { mount: mount, PLACEMENTS: PL.slice() };
})(typeof window !== 'undefined' ? window : globalThis);
