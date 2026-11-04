/* VRG UI Kit — components/menu.js — context menus, dropdown menus, submenus and a menubar, all read from the registry.
     VK.menu.open(src, anchor, ctx, opts) → inst {el, close(), focusFirst(), focusLast()}
        src:    'menu:<ctx>' surface id (renders VK.actions.forSurface(src, ctx, {all:true})) · an array of
                actions / action ids / plain items {label, icon, keys, run, checked, danger, disabled, reason, children} ·
                or a function(ctx) → that array
        anchor: Element | DOMRect | {x, y} (a click point) — placed with VK.place, flips at viewport edges
        opts:   {label, side, align, focus:'first'|'last'|false, restore: Element, invoker: Element,
                 onClose(), onArrow(dir) (menubar), inline: Element (render static into it — gallery/docs)}
     VK.menu.close()                          close every open menu (restoring focus)
     VK.menu.bindContext(el, src, ctxFn)      right-click + Shift+F10 + ContextMenu key; ctxFn(target, event) → extra ctx
                                              (return false = no menu; return {menu:'menu:x'} to pick the surface) → off()
     VK.menu.button(btn, src, opts)           a dropdown trigger (aria-haspopup, ↓/↑/Enter/Space) → off()
     VK.menu.menubar(el, [{label, surface|items}], opts) → {destroy()}   role=menubar for an app's top menu
   Action fields used: label, icon, keys, group (→ separators), when (→ disabled), reason (string | fn(ctx): why it is
   disabled, shown greyed + in title), checked (→ menuitemcheckbox), danger, children (ids / items / fn / surface id) or
   many(ctx) (→ submenu). Keys: ↑↓ Home End, letters (typeahead), Enter/Space run, → opens a submenu, ← / Esc close it,
   Tab closes all. Depends on: core, focus, actions. Optional: kbd (key hints). */
(function (root) {
  'use strict';
  var VK = root.VK = root.VK || {};
  if (VK.menu) return;

  var stack = [];            // open popover menus, root first
  var outsideOn = false;

  function reasonOf(x, c) { var r = x.reason; try { r = typeof r === 'function' ? r(c) : r; } catch (e) { r = ''; } return r || ''; }

  function resolve(src, c) {
    if (!src) return [];
    if (typeof src === 'string') return VK.actions.forSurface(src, c, { all: true });
    if (typeof src === 'function') { try { return src(c) || []; } catch (e) { console.error(e); return []; } }
    return src;
  }
  function norm(x, c) {
    if (typeof x === 'string') x = VK.actions.get(x);
    if (!x) return null;
    var isAction = !!(x.id && VK.actions.get(x.id) === x);
    var it = { src: x, label: x.label || '', icon: x.icon, keys: x.keys || [], group: x.group || '', hint: x.hint, danger: !!x.danger };
    if (isAction) it.disabled = !VK.actions.enabled(x, c);
    else { it.disabled = !!x.disabled; if (x.when) { try { it.disabled = it.disabled || !x.when(c); } catch (e) { it.disabled = true; } } }
    if (it.disabled) it.reason = reasonOf(x, c);
    if (x.checked !== undefined) it.checked = isAction ? VK.actions.checked(x, c) : !!(typeof x.checked === 'function' ? x.checked(c) : x.checked);
    if (x.children) it.sub = x.children;
    else if (x.many) it.sub = function (cc) { return x.many(cc); };
    if (isAction) it.run = function () { VK.actions.run(x, c, 'menu'); };
    else if (x.run) it.run = function () { try { x.run(c); } catch (e) { console.error(e); } };
    return it;
  }

  function itemEl(it) {
    var role = it.checked !== undefined ? 'menuitemcheckbox' : 'menuitem';
    var n = VK.el('div.vk-menu__item', { role: role, tabindex: '-1',
      'aria-disabled': it.disabled ? 'true' : null,
      'aria-checked': it.checked !== undefined ? String(!!it.checked) : null,
      'aria-haspopup': it.sub ? 'menu' : null, 'aria-expanded': it.sub ? 'false' : null,
      'aria-keyshortcuts': it.keys.length && VK.kbd ? VK.kbd.aria(it.keys[0]) : null,
      'aria-description': it.disabled ? (it.reason || 'Nem érhető el most') : null,
      title: it.disabled ? (it.reason || 'Nem érhető el most') : (it.hint || null),
      'data-danger': it.danger ? '' : null });
    n.appendChild(VK.el('span.vk-menu__check', { 'aria-hidden': 'true' }, it.checked ? VK.icon('check') : null));
    n.appendChild(it.icon ? VK.icon(it.icon, 'vk-menu__icon') : VK.el('span.vk-menu__icon'));
    n.appendChild(VK.el('span.vk-menu__label', null, it.label));
    var side = VK.el('span.vk-menu__side');
    if (it.sub) side.appendChild(VK.icon('chevron-right', 'vk-menu__chev'));
    else if (it.disabled && it.reason) side.appendChild(VK.el('span.vk-menu__why', { 'aria-hidden': 'true' }, it.reason));
    else if (it.keys.length && VK.kbd) side.appendChild(VK.kbd.chip(it.keys[0], { size: 'sm' }));
    n.appendChild(side);
    n._vkItem = it;
    return n;
  }

  function build(src, c, label) {
    var raw = resolve(src, c), items = [], groups = {}, order = [];
    raw.forEach(function (x) { var it = norm(x, c); if (!it) return; if (!groups[it.group]) { groups[it.group] = []; order.push(it.group); } groups[it.group].push(it); });
    var m = VK.el('div.vk-menu.vk-glass', { role: 'menu', tabindex: '-1', 'aria-label': label || null });
    order.forEach(function (g, gi) {
      if (gi) m.appendChild(VK.el('div.vk-menu__sep', { role: 'separator' }));
      groups[g].forEach(function (it) { items.push(it); m.appendChild(itemEl(it)); });
    });
    if (!items.length) m.appendChild(VK.el('div.vk-menu__item', { role: 'menuitem', tabindex: '-1', 'aria-disabled': 'true' },
      [VK.el('span.vk-menu__check'), VK.el('span.vk-menu__icon'), VK.el('span.vk-menu__label', null, 'Nincs elérhető parancs'), VK.el('span.vk-menu__side')]));
    return m;
  }

  function enabledItems(m) { return Array.prototype.filter.call(m.querySelectorAll('[role^="menuitem"]'), function (n) { return n.getAttribute('aria-disabled') !== 'true'; }); }

  function onOutside(e) {
    if (!stack.length) return;
    var t = e.target;
    if (stack.some(function (i) { return i.el.contains(t) || (i.o.invoker && i.o.invoker.contains(t)); })) return;
    closeAll(false);
  }
  // a user scroll (wheel / touch drag) outside the menus closes them; programmatic scrolls (focus, scrollIntoView) do not
  function onScroll(e) { if (!stack.length) return; if (stack.some(function (i) { return i.el.contains(e.target); })) return; closeAll(false); }
  function onResize() { if (stack.length) closeAll(false); }
  function listen(on) {
    if (on === outsideOn) return; outsideOn = on;
    var f = on ? 'addEventListener' : 'removeEventListener';
    document[f]('pointerdown', onOutside, true);
    root[f]('wheel', onScroll, { capture: true, passive: true });
    root[f]('touchmove', onScroll, { capture: true, passive: true });
    root[f]('resize', onResize);
    root[f]('blur', onResize);
  }

  function closeAll(restore) {
    var r = stack[0];
    while (stack.length) stack[stack.length - 1].close(false);
    if (r && restore !== false && r.o.restore && document.contains(r.o.restore)) r.o.restore.focus();
  }

  function open(src, anchor, c, o) {
    o = o || {};
    c = c || VK.actions.ctx();
    var inline = !!o.inline;
    if (!o.parent && !inline) closeAll(false);
    var m = build(src, c, o.label);
    var inst = { el: m, o: o, ctx: c, child: null, node: o.node || null, closed: false };
    if (!inline && !o.restore) o.restore = document.activeElement;

    if (inline) { m.classList.add('vk-menu--static'); o.inline.appendChild(m); }
    else {
      document.body.appendChild(m);
      VK.place(m, anchor, { side: o.side || (o.parent ? 'right' : 'bottom'), align: o.align || 'start', offset: o.parent ? -2 : 2 });
      stack.push(inst); listen(true);
    }
    var rov = VK.focus.roving(m, { items: '[role^="menuitem"]', orientation: 'vertical', typeahead: true });
    var hoverT = 0;

    function rootInst() { var p = inst; while (p.o.parent) p = p.o.parent; return p; }
    function closeChild() { if (inst.child) { inst.child.close(false); inst.child = null; } }
    function openSub(node, it, focus) {
      if (inst.child && inst.child.node === node) { if (focus) inst.child.focusFirst(); return; }
      closeChild();
      node.setAttribute('aria-expanded', 'true');
      inst.child = open(it.sub, node, c, { parent: inst, node: node, label: it.label, focus: focus ? 'first' : false, restore: node,
        onClose: function () { node.setAttribute('aria-expanded', 'false'); } });
    }
    function activate(node) {
      var it = node && node._vkItem; if (!it || it.disabled) return;
      if (it.sub) { openSub(node, it, true); return; }
      if (inline) { if (it.run) it.run(); return; }
      closeAll(true);
      if (it.run) it.run();
    }

    m.addEventListener('keydown', function (e) {
      var node = e.target.closest && e.target.closest('[role^="menuitem"]'), it = node && node._vkItem;
      switch (e.key) {
        case 'Enter': case ' ': e.preventDefault(); activate(node); break;
        case 'ArrowRight':
          if (it && it.sub && !it.disabled) { e.preventDefault(); openSub(node, it, true); }
          else if (rootInst().o.onArrow) { e.preventDefault(); rootInst().o.onArrow('right'); }
          break;
        case 'ArrowLeft':
          if (o.parent) { e.preventDefault(); inst.close(false); if (inst.node) inst.node.focus(); }
          else if (o.onArrow) { e.preventDefault(); o.onArrow('left'); }
          break;
        case 'Escape':
          if (inline) break;
          e.preventDefault();
          if (o.parent) { inst.close(false); if (inst.node) inst.node.focus(); } else closeAll(true);
          break;
        case 'Tab': if (!inline) { e.preventDefault(); closeAll(true); } break;
      }
      if (!inline || e.key !== 'Tab') e.stopPropagation();   // letters belong to typeahead, not page shortcuts
    });
    m.addEventListener('click', function (e) { var n = e.target.closest('[role^="menuitem"]'); if (n) activate(n); });
    m.addEventListener('pointermove', function (e) {
      var n = e.target.closest('[role^="menuitem"]'); if (!n || n === document.activeElement || e.pointerType === 'touch') return;
      if (n.getAttribute('aria-disabled') === 'true') { m.focus({ preventScroll: true }); return; }
      n.focus({ preventScroll: true }); rov.update();
      clearTimeout(hoverT);
      var it = n._vkItem;
      hoverT = setTimeout(function () {
        if (inst.closed) return;
        if (it && it.sub) openSub(n, it, false); else closeChild();
      }, 160);
    });

    inst.focusFirst = function () { var l = enabledItems(m); if (l[0]) { rov.update(); l[0].focus(); rov.update(); } else m.focus(); };
    inst.focusLast = function () { var l = enabledItems(m); if (l.length) { l[l.length - 1].focus(); rov.update(); } else m.focus(); };
    inst.close = function () {
      if (inst.closed) return; inst.closed = true;
      clearTimeout(hoverT); closeChild(); rov.destroy(); m.remove();
      var i = stack.indexOf(inst); if (i >= 0) stack.splice(i, 1);
      if (o.parent && o.parent.child === inst) o.parent.child = null;
      if (!stack.length) listen(false);
      if (o.onClose) o.onClose();
    };
    if (!inline) {
      if (o.focus === 'last') inst.focusLast();
      else if (o.focus !== false) inst.focusFirst();
    } else rov.update();
    return inst;
  }

  /** right-click, Shift+F10 and the ContextMenu key on `el` open `src` with ctx = actions.ctx(ctxFn(target, event)) */
  function bindContext(el, src, ctxFn) {
    var kbAt = 0;
    function ctxFor(t, e) {
      var extra = ctxFn ? ctxFn(t, e) : null;
      if (extra === false) return null;
      return VK.actions.ctx(extra || undefined);
    }
    function onCtx(e) {
      if (Date.now() - kbAt < 500) { e.preventDefault(); return; }
      var c = ctxFor(e.target, e); if (!c) return;
      e.preventDefault();
      open(c.menu || src, { x: e.clientX, y: e.clientY }, c, { label: c.menuLabel || 'Helyi menü' });
    }
    function onKey(e) {
      if (!((e.key === 'F10' && e.shiftKey) || e.key === 'ContextMenu')) return;
      var t = e.target, c = ctxFor(t, e); if (!c) return;
      e.preventDefault(); e.stopPropagation(); kbAt = Date.now();
      var r = t.getBoundingClientRect();
      var anchor = r.height > 120 || r.width > 480 ? { x: r.left + 16, y: r.top + 16 } : t;
      open(c.menu || src, anchor, c, { label: c.menuLabel || 'Helyi menü', restore: t });
    }
    el.addEventListener('contextmenu', onCtx);
    el.addEventListener('keydown', onKey);
    return function off() { el.removeEventListener('contextmenu', onCtx); el.removeEventListener('keydown', onKey); };
  }

  /** a button that opens a dropdown menu */
  function button(btn, src, o) {
    o = o || {};
    var inst = null;
    btn.setAttribute('aria-haspopup', 'menu'); btn.setAttribute('aria-expanded', 'false');
    function show(focus) {
      var c = o.ctx ? VK.actions.ctx(o.ctx()) : VK.actions.ctx();
      btn.setAttribute('aria-expanded', 'true');
      inst = open(src, btn, c, { restore: btn, invoker: btn, focus: focus, label: o.label || btn.textContent.trim() || btn.getAttribute('aria-label'),
        side: o.side, align: o.align, onClose: function () { btn.setAttribute('aria-expanded', 'false'); inst = null; if (o.onClose) o.onClose(); } });
      return inst;
    }
    function onClick() { if (inst) closeAll(true); else show('first'); }
    function onKey(e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); if (!inst) show('first'); else inst.focusFirst(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (!inst) show('last'); else inst.focusLast(); }
    }
    btn.addEventListener('click', onClick); btn.addEventListener('keydown', onKey);
    return function off() { btn.removeEventListener('click', onClick); btn.removeEventListener('keydown', onKey); };
  }

  /** the app's top menu: [{label, surface | items, icon?}] → role=menubar with roving ←→ and hover-to-switch */
  function menubar(el, entries, o) {
    o = o || {};
    el.classList.add('vk-menubar'); el.setAttribute('role', 'menubar');
    if (o.label) el.setAttribute('aria-label', o.label);
    var cur = -1;
    var btns = entries.map(function (en, i) {
      var b = VK.el('button.vk-menubar__item', { type: 'button', role: 'menuitem', 'aria-haspopup': 'menu', 'aria-expanded': 'false', tabindex: i ? '-1' : '0' },
        [en.icon ? VK.icon(en.icon) : null, en.label]);
      el.appendChild(b); return b;
    });
    var rov = VK.focus.roving(el, { items: '.vk-menubar__item', orientation: 'horizontal', typeahead: true });
    function openAt(i, focus) {
      var b = btns[i], en = entries[i];
      closeAll(false);
      var c = o.ctx ? VK.actions.ctx(o.ctx()) : VK.actions.ctx();
      cur = i; b.setAttribute('aria-expanded', 'true');
      open(en.surface || en.items, b, c, { restore: b, invoker: b, focus: focus, label: en.label,
        onArrow: function (dir) { var n = (i + (dir === 'right' ? 1 : -1) + btns.length) % btns.length; rov.focus(n); openAt(n, 'first'); },
        onClose: function () { b.setAttribute('aria-expanded', 'false'); if (cur === i) cur = -1; } });
    }
    function onKey(e) {
      var i = btns.indexOf(e.target); if (i < 0) return;
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openAt(i, 'first'); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); openAt(i, 'last'); }
    }
    function onClick(e) { var i = btns.indexOf(e.target.closest('.vk-menubar__item')); if (i < 0) return; if (cur === i) closeAll(true); else openAt(i, 'first'); }
    function onOver(e) {
      var i = btns.indexOf(e.target.closest && e.target.closest('.vk-menubar__item'));
      if (i < 0 || cur < 0 || cur === i) return;
      rov.focus(i); openAt(i, false); btns[i].focus();
    }
    el.addEventListener('keydown', onKey); el.addEventListener('click', onClick); el.addEventListener('pointerover', onOver);
    return { el: el, open: openAt, destroy: function () { rov.destroy(); el.removeEventListener('keydown', onKey); el.removeEventListener('click', onClick); el.removeEventListener('pointerover', onOver); el.textContent = ''; } };
  }

  VK.menu = { open: open, close: function () { closeAll(true); }, isOpen: function () { return stack.length > 0; },
    bindContext: bindContext, button: button, menubar: menubar };
})(typeof window !== 'undefined' ? window : globalThis);
