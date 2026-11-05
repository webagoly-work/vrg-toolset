/* VRG UI Kit — components/phone.js — phone layout: app bar, screens with a back stack, bottom navigation of
   MINIs, one floating primary action per screen, bottom sheets (modal / non-modal, drag, half/full).

     var app = VK.phone.mount(el, {
       title: 'VRG Mobile',                       // app name (shown small above the screen title)
       headingLevel: 1,                           // level of the app-bar title (gallery uses 3)
       screens: [
         { id: 'projects', title: 'Projektek', render: function (params, app) { return element; },
           toolbar: 'toolbar:phone.projects',     // registry surface → minis in the app bar
           fab: 'project.new' },                  // registry action → the floating primary action (a MINI)
         { id: 'project', title: function (p) { return p.code; }, render: …, parent: 'projects' }
       ],
       nav: [ { id: 'projects', icon: 'folder', label: 'Projektek' }, … ],   // 3–5 root screens
       start: 'projects', onChange: function (id, params) {}
     })
     app.go(id, params)       push a screen (a nav root resets the stack to itself)
     app.back()               pop; returns false at a root. Esc (no sheet open) and Alt+← do the same.
     app.openSheet(content, {title, sub, modal: true, size: 'auto'|'half'|'full', label, onClose})
                              → {el, body, close(), expand(bool), size()}
     app.setNav(id, {state, progress, badge})   drive a nav MINI (the MINI rule: the tab shows the feature's progress)
     app.refresh()            re-read registry minis (app bar, FAB, sheet menus) after an action's state changed
     app.current() · app.depth() · app.destroy()
   Helpers: VK.phone.list(rows, {onOpen, label}) → <ul> of two-line rows with arrow-key movement
            VK.phone.menu(surface, {onRun, ctx}) → registry actions as big rows (for sheets)
   Keyboard: Tab between bar / screen / FAB / nav; ←/→ inside the nav, Enter opens; ↑/↓ in lists;
   Esc closes the sheet, else goes back; in a modal sheet Tab is trapped; on the Kibontás toggle ↑ = full, ↓ = smaller.
   Depends on: core, focus, mini, actions. */
(function (root) {
  'use strict';
  var VK = root.VK = root.VK || {};
  if (VK.phone) return;

  function txt(v, p) { return typeof v === 'function' ? v(p || {}) : (v || ''); }
  function actionsOn(surface) { return VK.actions ? VK.actions.forSurface(surface, VK.actions.ctx(), { all: true }) : []; }

  function mount(host, opts) {
    opts = opts || {};
    var screens = {}; (opts.screens || []).forEach(function (s) { screens[s.id] = s; });
    var navDefs = opts.nav || [];
    var navIds = navDefs.map(function (n) { return n.id; });
    var stack = [];               // [{id, params, el, focus, scroll}]
    var sheet = null;
    var level = Math.min(6, Math.max(1, opts.headingLevel || 1));

    host.classList.add('vk-phone');
    host.textContent = '';
    var titleId = VK.uid('vk-phone-t');

    var backBtn = VK.el('button.vk-btn.vk-btn--icon.vk-phone__back', { type: 'button', 'data-variant': 'ghost', 'aria-label': 'Vissza', title: 'Vissza (Esc)', hidden: true }, [VK.icon('arrow-left')]);
    var title = VK.el('h' + level + '.vk-phone__title#' + titleId, { tabindex: '-1' });
    var tools = VK.el('div.vk-phone__tools', { role: 'toolbar', 'aria-label': 'Képernyő funkciói' });
    var bar = VK.el('header.vk-phone__bar', { 'data-vk-hop': '' }, [backBtn, title, tools]);
    var body = VK.el('div.vk-phone__body', { 'data-vk-hop': '' });
    var fabWrap = VK.el('div.vk-phone__fab', { hidden: true });
    var nav = VK.el('nav.vk-phone__nav', { 'aria-label': (opts.navLabel || 'Fő navigáció'), 'data-vk-hop': '' });
    host.appendChild(bar); host.appendChild(body); host.appendChild(fabWrap); host.appendChild(nav);
    if (!navDefs.length) nav.hidden = true;

    // ---- bottom navigation: each tab = a MINI (progress ring) + label ----
    var tabs = {};
    navDefs.forEach(function (n) {
      var m = VK.el('span.vk-mini', { 'aria-hidden': 'true', 'data-size': 'sm' }, [VK.icon(n.icon || 'dot')]);
      var stateTxt = VK.el('span.vk-sr-only');
      var b = VK.el('button.vk-phone__tab', { type: 'button', tabindex: '-1', 'data-id': n.id },
        [m, VK.el('span.vk-phone__tab-label', { text: n.label }), stateTxt]);
      b.addEventListener('click', function () { go(n.id); });
      tabs[n.id] = { btn: b, mini: m, sr: stateTxt };
      nav.appendChild(b);
      if (n.state || n.progress !== undefined) setNav(n.id, n);
    });
    var navRove = navDefs.length ? VK.focus.roving(nav, { items: '.vk-phone__tab', orientation: 'horizontal', typeahead: false }) : null;

    function setNav(id, o) {
      var t = tabs[id]; if (!t) return;
      VK.mini.set(t.mini, { state: o.state, progress: o.progress, value: o.badge });
      var st = t.mini.dataset.state, p = t.mini.style.getPropertyValue('--vk-p');
      t.sr.textContent = st === 'running' && p !== '' ? ' — fut, ' + Math.round(parseFloat(p) * 100) + '%' :
        st ? ' — ' + ({ running: 'fut', done: 'kész', error: 'hiba', waiting: 'várakozik', paused: 'szünetel', off: 'kikapcsolva' }[st] || st) : '';
    }

    // ---- screens ----
    function rootOf(id) { var s = screens[id]; var guard = 0; while (s && s.parent && guard++ < 20) s = screens[s.parent]; return s ? s.id : id; }
    function navH() { return nav.hidden ? 0 : nav.getBoundingClientRect().height / (zoomOf() || 1); }
    function zoomOf() { var r = host.getBoundingClientRect(); return host.offsetHeight ? r.height / host.offsetHeight : 1; }

    function render(entry) {
      var s = screens[entry.id];
      var el = VK.el('div.vk-phone__screen', { role: 'region', 'aria-labelledby': titleId, tabindex: '-1', 'data-screen': entry.id });
      var content = s.render ? s.render(entry.params || {}, api) : s.el;
      if (content) el.appendChild(content);
      return el;
    }

    function show(entry, how) {
      var s = screens[entry.id];
      if (!entry.el) entry.el = render(entry);
      var old = body.firstChild;
      if (old && old !== entry.el) body.removeChild(old);
      entry.el.dataset.enter = how;
      body.appendChild(entry.el);
      body.scrollTop = entry.scroll || 0;
      // app bar
      title.textContent = '';
      if (opts.title) title.appendChild(VK.el('small', { text: opts.title }));
      title.appendChild(document.createTextNode(txt(s.title, entry.params)));
      backBtn.hidden = stack.length < 2;
      tools.textContent = '';
      if (s.toolbar) actionsOn(s.toolbar).forEach(function (a) { var m = VK.mini.fromAction(a); m.dataset.size = 'sm'; tools.appendChild(m); });
      tools.hidden = !tools.childNodes.length;
      // the one primary action
      fabWrap.textContent = '';
      var fa = s.fab && VK.actions && VK.actions.get(s.fab);
      if (fa) {
        var fm = VK.mini.fromAction(fa); fm.dataset.size = 'lg';
        fabWrap.appendChild(fm);
        if (fa.caption) fabWrap.appendChild(VK.el('span.vk-phone__fab-cap', { 'aria-hidden': 'true', text: fa.caption }));
      }
      fabWrap.hidden = !fa;
      host.style.setProperty('--_navh', navH() + 'px');
      // nav
      var r = rootOf(entry.id);
      Object.keys(tabs).forEach(function (k) { if (k === r) tabs[k].btn.setAttribute('aria-current', 'page'); else tabs[k].btn.removeAttribute('aria-current'); });
      if (navRove && tabs[r]) { navDefs.forEach(function (n) { tabs[n.id].btn.tabIndex = n.id === r ? 0 : -1; }); }
      if (opts.onChange) opts.onChange(entry.id, entry.params || {});
      VK.fire(host, 'phone-screen', { id: entry.id, params: entry.params, depth: stack.length });
    }

    function remember() {
      var top = stack[stack.length - 1]; if (!top) return;
      top.scroll = body.scrollTop;
      if (top.el && top.el.contains(document.activeElement)) top.focus = document.activeElement;
    }

    /** go(id, params, {focus:false}) — push a screen; a nav root resets the stack */
    function go(id, params, o) {
      o = o || {};
      if (!screens[id]) return false;
      if (sheet && sheet.modal) sheet.close();
      remember();
      var how = 'fwd';
      if (navIds.indexOf(id) >= 0 && !screens[id].parent) {
        stack = [{ id: id, params: params }]; how = 'tab';
      } else stack.push({ id: id, params: params });
      show(stack[stack.length - 1], how);
      if (o.focus !== false) title.focus({ preventScroll: true });
      return true;
    }

    function back() {
      if (sheet) { sheet.close(); return true; }
      if (stack.length < 2) return false;
      stack.pop();
      var e = stack[stack.length - 1];
      show(e, 'back');
      var f = e.focus && e.el.contains(e.focus) ? e.focus : title;
      f.focus({ preventScroll: true });
      return true;
    }

    backBtn.addEventListener('click', back);

    function onKey(e) {
      if (e.defaultPrevented) return;
      var editable = VK.focus.isEditable(e.target);
      if (e.key === 'Escape' && !editable && !sheet) { if (back()) e.preventDefault(); return; }
      if (e.key === 'ArrowLeft' && e.altKey && !e.ctrlKey && !e.metaKey) { if (back()) e.preventDefault(); }
    }
    host.addEventListener('keydown', onKey);

    // ---- bottom sheet ----
    function openSheet(content, so) {
      so = so || {};
      if (sheet) sheet.close(true);
      var modal = so.modal !== false;
      var baseSize = so.size || 'auto';
      var sid = VK.uid('vk-phone-s');
      var toggle = VK.el('button.vk-btn.vk-btn--sm', { type: 'button', 'aria-pressed': baseSize === 'full' ? 'true' : 'false', title: 'Kibontás (↑ teljes, ↓ kisebb)' },
        [VK.icon('maximize'), 'Kibontás']);
      var closeBtn = VK.el('button.vk-btn.vk-btn--icon.vk-btn--sm', { type: 'button', 'data-variant': 'ghost', 'aria-label': 'Bezárás', title: 'Bezárás (Esc)' }, [VK.icon('close')]);
      var h = VK.el('h' + Math.min(6, level + 1) + '.vk-phone__sheet-title#' + sid, null, [so.sub ? VK.el('small', { text: so.sub }) : null, so.title || '']);
      var grip = VK.el('div.vk-phone__grip', { 'aria-hidden': 'true', title: 'Húzd: kibontás / bezárás' });
      var head = VK.el('div.vk-phone__sheet-head', null, [h, toggle, closeBtn]);
      var sbody = VK.el('div.vk-phone__sheet-body', { tabindex: '-1' });
      if (content) sbody.appendChild(content);
      var el = VK.el('section.vk-phone__sheet', { role: 'dialog', 'aria-labelledby': sid, 'data-modal': modal ? 'true' : 'false', 'data-size': baseSize, 'data-vk-hop': '' },
        [grip, head, sbody]);
      if (modal) el.setAttribute('aria-modal', 'true');
      if (so.label) el.setAttribute('aria-label', so.label);
      var scrim = modal ? VK.el('div.vk-phone__scrim', { 'aria-hidden': 'true' }) : null;
      var opener = document.activeElement;
      host.style.setProperty('--_navh', navH() + 'px');
      if (scrim) { host.appendChild(scrim); scrim.addEventListener('click', function () { inst.close(); }); }
      host.appendChild(el);
      // the slide-in plays once; without this, ending a drag would replay it
      el.addEventListener('animationend', function () { if (!el.hasAttribute('data-closing')) el.setAttribute('data-shown', ''); }, { once: true });
      var behind = [bar, body, nav, fabWrap];
      if (modal) behind.forEach(function (n) { n.inert = true; });
      // Tab cycle over real tab stops only (VK.focus.trap also counts roving items with tabindex=-1, so its wrap
      // misses when the last tab stop is a roving list); runs before the trap's own handler.
      if (modal) el.addEventListener('keydown', function (e) {
        if (e.key !== 'Tab' || e.altKey || e.ctrlKey || e.metaKey) return;
        var list = VK.focus.all(el).filter(function (n) { return n.tabIndex >= 0; });
        if (!list.length) return;
        var i = list.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); e.stopImmediatePropagation(); list[list.length - 1].focus(); }
        else if (!e.shiftKey && (i === list.length - 1 || i < 0)) { e.preventDefault(); e.stopImmediatePropagation(); list[0].focus(); }
      });
      // focus first with preventScroll: the sheet is still sliding in, a plain focus() would scroll the page to it.
      // (focus.trap then finds it already focused; restoring focus to the opener is done in close().)
      var f0 = (so.initial && el.querySelector(so.initial)) || VK.focus.first(sbody) || toggle;
      f0.focus({ preventScroll: true });
      var release = modal ? VK.focus.trap(el, { onEscape: function () { inst.close(); }, initial: f0, restore: false }) : null;

      function setSize(sz) {
        el.dataset.size = sz; el.style.height = '';
        toggle.setAttribute('aria-pressed', sz === 'full' ? 'true' : 'false');
        VK.fire(el, 'sheet-size', { size: sz });
      }
      function expand(on) { setSize(on === undefined ? (el.dataset.size === 'full' ? baseSize === 'full' ? 'half' : baseSize : 'full') : on ? 'full' : (baseSize === 'full' ? 'half' : baseSize)); }
      toggle.addEventListener('click', function () { expand(); });
      toggle.addEventListener('keydown', function (e) {
        if (e.shiftKey || e.altKey) return;
        if (e.key === 'ArrowUp') { e.preventDefault(); expand(true); }
        if (e.key === 'ArrowDown') { e.preventDefault(); if (el.dataset.size === 'full') expand(false); else inst.close(); }
      });
      closeBtn.addEventListener('click', function () { inst.close(); });
      // non-modal: Esc inside the sheet closes it
      el.addEventListener('keydown', function (e) { if (!modal && e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); e.stopPropagation(); inst.close(); } });

      // pointer drag on the grip and the header (not on its buttons)
      var drag = null;
      function down(e) {
        if (e.button !== 0 || e.target.closest('button')) return;
        var hr = host.getBoundingClientRect(), sr = el.getBoundingClientRect();
        drag = { y: e.clientY, h0: sr.height, ph: hr.height, id: e.pointerId, moved: false };
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch (x) { /* synthetic events */ }
      }
      function move(e) {
        if (!drag || e.pointerId !== drag.id) return;
        var dy = e.clientY - drag.y;
        if (!drag.moved && Math.abs(dy) < 4) return;
        drag.moved = true; el.setAttribute('data-dragging', '');
        var hpx = VK.clamp(drag.h0 - dy, 0, drag.ph);
        el.style.height = (hpx / drag.ph * 100) + '%';
        drag.last = hpx;
      }
      function up(e) {
        if (!drag || e.pointerId !== drag.id) return;
        var d = drag; drag = null; el.removeAttribute('data-dragging');
        if (!d.moved) return;
        var r = d.last / d.ph;
        if (r < .22 || (d.last < d.h0 * .55 && el.dataset.size !== 'full')) inst.close();
        else if (r > .7) setSize('full');
        else setSize(baseSize === 'full' ? 'half' : baseSize);
      }
      [grip, head].forEach(function (z) {
        z.addEventListener('pointerdown', down); z.addEventListener('pointermove', move);
        z.addEventListener('pointerup', up); z.addEventListener('pointercancel', up);
      });

      var closed = false;
      var inst = {
        el: el, body: sbody, modal: modal, expand: expand, size: function () { return el.dataset.size; },
        close: function (instant) {
          if (closed) return; closed = true;
          if (sheet === inst) sheet = null;
          behind.forEach(function (n) { n.inert = false; });
          if (release) release();
          if (opener && opener.focus && document.contains(opener) && (modal || el.contains(document.activeElement))) opener.focus({ preventScroll: true });
          function rm() { el.remove(); if (scrim) scrim.remove(); }
          if (instant || VK.reducedMotion()) rm();
          else { el.setAttribute('data-closing', ''); if (scrim) scrim.style.opacity = '0'; setTimeout(rm, 160); }
          if (so.onClose) so.onClose();
          VK.fire(host, 'sheet-close', {});
        }
      };
      sheet = inst;
      VK.fire(host, 'sheet-open', { modal: modal });
      return inst;
    }

    function refresh() {
      host.querySelectorAll('.vk-mini[data-action]').forEach(function (m) { var a = VK.actions.get(m.dataset.action); if (a) VK.mini.refresh(m, a); });
      host.querySelectorAll('.vk-phone__act[data-action]').forEach(function (b) { menuRow(b, VK.actions.get(b.dataset.action)); });
    }

    var api = {
      el: host, go: go, back: back, openSheet: openSheet, setNav: setNav, refresh: refresh,
      current: function () { var t = stack[stack.length - 1]; return t ? { id: t.id, params: t.params } : null; },
      depth: function () { return stack.length; },
      sheet: function () { return sheet; },
      destroy: function () { if (sheet) sheet.close(true); host.removeEventListener('keydown', onKey); if (navRove) navRove.destroy(); host.textContent = ''; host.classList.remove('vk-phone'); }
    };
    var start = opts.start || (navDefs[0] && navDefs[0].id) || (opts.screens && opts.screens[0] && opts.screens[0].id);
    if (start) go(start, opts.startParams, { focus: false });
    return api;
  }

  /** two-line list rows: [{id, title, meta, icon, trail: Element|string, current}] */
  function list(rows, o) {
    o = o || {};
    var ul = VK.el('ul.vk-phone__list', { role: 'list', 'aria-label': o.label || null });
    (rows || []).forEach(function (r, i) {
      var b = VK.el('button.vk-phone__item', { type: 'button', tabindex: i ? '-1' : '0', 'data-id': r.id, 'aria-current': r.current ? 'true' : null }, [
        r.icon ? VK.icon(r.icon) : VK.el('span'),
        VK.el('span.vk-phone__item-main', null, [VK.el('span.vk-phone__item-title', { text: r.title }), r.meta ? VK.el('span.vk-phone__item-meta', { text: r.meta }) : null]),
        VK.el('span.vk-phone__item-trail', null, typeof r.trail === 'string' ? [r.trail] : r.trail || null),
        VK.icon('chevron-right', 'vk-phone__item-chev')
      ]);
      if (o.onOpen) b.addEventListener('click', function () { o.onOpen(r, b); });
      ul.appendChild(VK.el('li', null, [b]));
    });
    VK.focus.roving(ul, { items: '.vk-phone__item', orientation: 'vertical', wrap: false });
    return ul;
  }

  function menuRow(b, a) {
    if (!a) return;
    var c = VK.actions.ctx(), m = b.querySelector('.vk-mini'), o = {};
    if (a.progress) { try { o.progress = a.progress(c); } catch (e) { /* keep */ } }
    if (a.state) { try { o.state = a.state(c); } catch (e) { /* keep */ } }
    if (a.checked) o.pressed = VK.actions.checked(a, c);
    VK.mini.set(m, o);
    if (a.checked) b.setAttribute('aria-checked', o.pressed ? 'true' : 'false');
    b.disabled = !VK.actions.enabled(a, c);
    var st = m.getAttribute('aria-label') || '', tail = st.indexOf(' — ') >= 0 ? st.slice(st.indexOf(' — ') + 3) : '';
    var t = b.querySelector('.vk-phone__act-tail'); if (t) t.textContent = tail;
  }

  /** registry actions as big rows: VK.phone.menu('menu:project', {onRun}) — the sheet's verbs come from the registry */
  function menu(surface, o) {
    o = o || {};
    var box = VK.el('div.vk-phone__menu', { role: 'menu', 'aria-label': o.label || null });
    actionsOn(surface).forEach(function (a, i) {
      var b = VK.el('button.vk-phone__act', { type: 'button', role: a.checked ? 'menuitemcheckbox' : 'menuitem', tabindex: i ? '-1' : '0', 'data-action': a.id, 'data-danger': a.danger ? '' : null }, [
        VK.el('span.vk-mini', { 'aria-hidden': 'true', 'data-size': 'sm' }, [VK.icon(a.icon || 'dot')]),
        VK.el('span.vk-phone__act-main', null, [VK.el('span.vk-phone__act-label', { text: a.label }), a.hint ? VK.el('span.vk-phone__act-hint', { text: a.hint }) : null]),
        VK.el('span.vk-phone__act-tail', { 'aria-hidden': 'true' })
      ]);
      b.querySelector('.vk-mini').dataset.label = a.label;
      b.addEventListener('click', function () { VK.actions.run(a.id); menuRow(b, a); if (o.onRun) o.onRun(a, b); });
      menuRow(b, a);
      box.appendChild(b);
    });
    VK.focus.roving(box, { items: '.vk-phone__act', orientation: 'vertical' });
    return box;
  }

  VK.phone = { mount: mount, list: list, menu: menu };
})(typeof window !== 'undefined' ? window : globalThis);
