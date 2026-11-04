/* VRG UI Kit — components/kbd.js — key hints for the command layer.
     VK.kbd.chip('mod+shift+k')          → <kbd class="vk-kbd"> with one keycap per part (Ctrl Shift K · ⌘ ⇧ K)
     VK.kbd.forAction(actionOrId)        → chip for the action's first key, or null
     VK.kbd.aria('mod+k')                → 'Control+K' (for aria-keyshortcuts)
     VK.kbd.hints({root, delay})         → hold Alt = badges with the key of every visible [data-action] /
                                           [data-vk-keys] element; returns off()
     VK.kbd.showHints(root, {pinned}) · VK.kbd.hideHints() · VK.kbd.hintsShown()
     VK.kbd.sheet(opts)                  → toggles the cheat-sheet dialog: every registry key, grouped, searchable
     VK.kbd.renderSheet(el, opts)        → the same sheet inline → {filter(q), refresh(), destroy()}
     VK.kbd.attachHelp({keys, at})       → registers 'help.keys' (the sheet, key '?') and 'help.hints' (toggle badges)
   Sheet opts: {title, extra: [{group, label, keys:[…]}], kit: false (hide the kit's own keys)}.
   Depends on: core, focus, actions. */
(function (root) {
  'use strict';
  var VK = root.VK = root.VK || {};
  if (VK.kbd) return;

  var ARIA = { mod: null, shift: 'Shift', alt: 'Alt', escape: 'Escape', space: 'Space', delete: 'Delete', backspace: 'Backspace',
    enter: 'Enter', tab: 'Tab', arrowup: 'ArrowUp', arrowdown: 'ArrowDown', arrowleft: 'ArrowLeft', arrowright: 'ArrowRight',
    pageup: 'PageUp', pagedown: 'PageDown', home: 'Home', end: 'End', contextmenu: 'ContextMenu' };
  var EXTRA_NAME = { arrows: '←↑→↓', updown: '↑↓', contextmenu: '☰', f10: 'F10' };

  /** 'mod+shift+k' → ['mod','shift','k']; handles a literal '+' key */
  function split(k) {
    k = String(k || '');
    if (k === '+') return ['+'];
    var plus = /\+\+$/.test(k);
    var ps = (plus ? k.slice(0, -1) : k).split('+').filter(Boolean);
    if (plus) ps.push('+');
    return ps;
  }
  function partLabel(p) {
    if (p === '+') return '+';
    if (EXTRA_NAME[p]) return EXTRA_NAME[p];
    if (/^f\d{1,2}$/.test(p)) return p.toUpperCase();
    return VK.actions ? VK.actions.keyLabel(p) : p;
  }
  function label(k) { return split(k).map(partLabel).join(VK.actions && VK.actions.isMac ? '' : '+'); }
  function aria(k) {
    return split(k).map(function (p) {
      if (p === 'mod') return VK.actions && VK.actions.isMac ? 'Meta' : 'Control';
      if (ARIA[p]) return ARIA[p];
      return /^f\d{1,2}$/.test(p) ? p.toUpperCase() : p.length === 1 ? p.toUpperCase() : p;
    }).join('+');
  }

  /** one key combination as keycaps. opts: {size:'sm'} */
  function chip(k, o) {
    o = o || {};
    var parts = split(k), mac = VK.actions && VK.actions.isMac;
    var n = VK.el('kbd.vk-kbd', { 'data-size': o.size || null });
    parts.forEach(function (p, i) {
      if (i && !mac) n.appendChild(VK.el('span.vk-sr-only', null, '+'));
      n.appendChild(VK.el('kbd.vk-kbd__k', null, partLabel(p)));
    });
    return n;
  }
  /** several alternatives: 'Ctrl+Y / Ctrl+Shift+Z' */
  function chips(keys, o) {
    var w = VK.el('span.vk-kbd-alt');
    (keys || []).forEach(function (k, i) { if (i) w.appendChild(VK.el('span.vk-kbd-alt__or', null, '/')); w.appendChild(chip(k, o)); });
    return w;
  }
  function forAction(a, o) {
    if (typeof a === 'string') a = VK.actions.get(a);
    return a && a.keys && a.keys.length ? chip(a.keys[0], o) : null;
  }

  // ---------------------------------------------------------------- Alt-held hint overlay
  var layer = null, pinnedOff = null;
  function compact(k) { return label(k).replace(/Shift\+?/, '⇧').replace(/Ctrl\+/, 'Ctrl '); }
  function inView(r) { return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < root.innerHeight && r.left < root.innerWidth; }
  function drawHints(scope) {
    if (!layer) return;
    layer.textContent = '';
    var placed = [];
    Array.prototype.forEach.call((scope || document).querySelectorAll('[data-action],[data-vk-keys]'), function (n) {
      if (layer.contains(n)) return;
      var k = n.getAttribute('data-vk-keys');
      if (!k) { var a = VK.actions && VK.actions.get(n.getAttribute('data-action')); k = a && a.keys && a.keys[0]; }
      if (!k) return;
      var r = n.getBoundingClientRect(); if (!inView(r)) return;
      if (n.closest('[hidden],[inert]')) return;
      var b = VK.el('span.vk-kbd-hint', null, compact(k));
      if (n.disabled || n.getAttribute('aria-disabled') === 'true') b.dataset.off = '';
      layer.appendChild(b);
      var w = b.offsetWidth, h = b.offsetHeight;
      var x = VK.clamp(r.left + r.width / 2 - w / 2, 2, root.innerWidth - w - 2), y = VK.clamp(r.bottom - h / 2, 2, root.innerHeight - h - 2);
      for (var t = 0; t < 6; t++) {
        var hit = placed.some(function (p) { return x < p.x + p.w + 2 && x + w + 2 > p.x && y < p.y + p.h + 1 && y + h + 1 > p.y; });
        if (!hit) break; y += h + 2;
      }
      placed.push({ x: x, y: y, w: w, h: h });
      b.style.left = Math.round(x) + 'px'; b.style.top = Math.round(y) + 'px';
    });
  }
  function showHints(scope, o) {
    o = o || {};
    hideHints();
    layer = VK.el('div.vk-kbd-hints', { 'aria-hidden': 'true' });
    document.body.appendChild(layer);
    drawHints(scope);
    if (o.pinned) {
      var raf = 0;
      var redraw = function () { cancelAnimationFrame(raf); raf = requestAnimationFrame(function () { drawHints(scope); }); };
      var esc = function (e) { if (e.key === 'Escape' && layer) { hideHints(); changed(); } };
      root.addEventListener('scroll', redraw, true); root.addEventListener('resize', redraw); document.addEventListener('keydown', esc);
      pinnedOff = function () { root.removeEventListener('scroll', redraw, true); root.removeEventListener('resize', redraw); document.removeEventListener('keydown', esc); };
      layer.dataset.pinned = '';
    }
  }
  function hideHints() {
    if (pinnedOff) { pinnedOff(); pinnedOff = null; }
    if (layer) { layer.remove(); layer = null; }
  }
  function hintsShown() { return !!layer; }
  function changed() { if (VK.fire) VK.fire(document, 'actions'); }

  /** hold Alt (alone) for `delay` ms → badges; release or press any other key → gone */
  function hints(o) {
    o = o || {};
    var scope = o.root || document, delay = o.delay == null ? 280 : o.delay, t = 0, shown = false;
    function cancel() { clearTimeout(t); t = 0; if (shown) { shown = false; hideHints(); } }
    function kd(e) {
      if (e.key === 'Alt' && !e.ctrlKey && !e.shiftKey && !e.metaKey) {
        if (e.repeat || t || shown) return;
        t = setTimeout(function () { t = 0; if (layer && layer.hasAttribute('data-pinned')) return; showHints(scope); shown = true; }, delay);
      } else cancel();
    }
    function ku(e) { if (e.key === 'Alt') { if (shown) e.preventDefault(); cancel(); } }
    document.addEventListener('keydown', kd, true);
    document.addEventListener('keyup', ku, true);
    root.addEventListener('blur', cancel);
    root.addEventListener('scroll', cancel, true);
    document.addEventListener('pointerdown', cancel, true);
    return function off() {
      cancel();
      document.removeEventListener('keydown', kd, true); document.removeEventListener('keyup', ku, true);
      root.removeEventListener('blur', cancel); root.removeEventListener('scroll', cancel, true); document.removeEventListener('pointerdown', cancel, true);
    };
  }

  // ---------------------------------------------------------------- cheat sheet
  var KIT_KEYS = [
    { group: 'Billentyűzet', label: 'Ugrás a régiók között', keys: ['shift+arrows'] },
    { group: 'Billentyűzet', label: 'Mozgás listában, menüben, eszköztáron', keys: ['arrows', 'home', 'end'] },
    { group: 'Billentyűzet', label: 'Helyi menü a fókuszált elemen', keys: ['shift+f10', 'contextmenu'] },
    { group: 'Billentyűzet', label: 'Gyorsbillentyűk mutatása (nyomva tartva)', keys: ['alt'] },
    { group: 'Billentyűzet', label: 'Bezárás, vissza egy szintet', keys: ['escape'] },
    { group: 'Billentyűzet', label: 'Következő / előző vezérlő', keys: ['tab', 'shift+tab'] }
  ];

  function renderSheet(el, o) {
    o = o || {};
    var bodyId = VK.uid('vk-kbd-body');
    var input = VK.el('input.vk-kbd-sheet__search', { type: 'search', placeholder: o.placeholder || 'Keresés: parancs vagy billentyű…',
      'aria-label': 'Keresés a gyorsbillentyűk között', 'aria-controls': bodyId, autocomplete: 'off', spellcheck: 'false' });
    var count = VK.el('span.vk-label.vk-kbd-sheet__count', { role: 'status', 'aria-live': 'polite' });
    var bar = VK.el('div.vk-kbd-sheet__bar', null, [VK.icon('search'), input, count]);
    var body = VK.el('div.vk-kbd-sheet__body.vk-scroll', { id: bodyId, tabindex: '0', role: 'region', 'aria-label': 'Gyorsbillentyűk listája' });
    el.appendChild(bar); el.appendChild(body);

    function rows() {
      var c = VK.actions.ctx(), out = [];
      VK.actions.all().forEach(function (a) {
        if (!a.keys || !a.keys.length) return;
        out.push({ group: a.group || 'Egyéb', label: a.label, keys: a.keys, off: !VK.actions.enabled(a, c), id: a.id });
      });
      (o.extra || []).forEach(function (x) { out.push(x); });
      if (o.kit !== false) KIT_KEYS.forEach(function (x) { out.push(x); });
      return out;
    }
    function filter(q) {
      if (q !== undefined) input.value = q;
      var f = VK.fold(input.value).trim(), list = rows(), groups = {}, order = [], n = 0;
      list.forEach(function (r) {
        if (f) {
          var hay = VK.fold(r.label + ' ' + r.group + ' ' + r.keys.map(label).join(' ') + ' ' + (r.id || ''));
          if (f.split(/\s+/).some(function (w) { return hay.indexOf(w) < 0; })) return;
        }
        if (!groups[r.group]) { groups[r.group] = []; order.push(r.group); }
        groups[r.group].push(r); n++;
      });
      body.textContent = '';
      order.forEach(function (g) {
        var hid = VK.uid('vk-kbd-g');
        var dl = VK.el('dl.vk-kbd-sheet__list', { 'aria-labelledby': hid });
        groups[g].forEach(function (r) {
          dl.appendChild(VK.el('div.vk-kbd-sheet__row', { 'data-off': r.off ? '' : null, title: r.off ? 'Most nem elérhető' : null }, [
            VK.el('dt', null, r.label), VK.el('dd', null, chips(r.keys))]));
        });
        body.appendChild(VK.el('section.vk-kbd-sheet__group', null, [VK.el('h3.vk-label', { id: hid }, g), dl]));
      });
      if (!n) body.appendChild(VK.el('p.vk-kbd-sheet__empty', null, ['Nincs találat erre: „', input.value, '”']));
      count.textContent = n + ' BILLENTYŰ';
    }
    input.addEventListener('input', function () { filter(); });
    var unsub = VK.actions.subscribe(function (k) { if (k === 'register' || k === 'unregister') filter(); });
    filter('');
    return { input: input, body: body, filter: filter, refresh: function () { filter(); },
      destroy: function () { unsub(); el.textContent = ''; } };
  }

  var sheetOpen = null;
  function sheet(o) {
    if (sheetOpen) { sheetOpen(); return null; }
    o = o || {};
    var tid = VK.uid('vk-kbd-t');
    var close = VK.el('button.vk-btn.vk-btn--icon', { type: 'button', 'data-variant': 'ghost', 'aria-label': 'Bezárás', title: 'Bezárás (Esc)' }, VK.icon('close'));
    var head = VK.el('header.vk-kbd-sheet__head', null, [VK.icon('keyboard', 'vk-icon--lg'),
      VK.el('div.vk-grow', null, [VK.el('h2.vk-title', { id: tid }, o.title || 'Billentyűparancsok'),
        VK.el('p.vk-label', null, 'SÚGÓ // ? // MINDEN GYORSBILLENTYŰ EGY HELYEN')]), close]);
    var box = VK.el('div.vk-kbd-sheet__box.vk-glass.vk-cut', { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': tid }, [head]);
    var scrim = VK.el('div.vk-kbd-sheet', null, box);
    var content = VK.el('div.vk-kbd-sheet__content'); box.appendChild(content);
    document.body.appendChild(scrim);
    var inst = renderSheet(content, o);
    var release = null;
    function done() {
      if (!sheetOpen) return; sheetOpen = null;
      inst.destroy(); scrim.remove(); if (release) release(); changed();
    }
    close.addEventListener('click', done);
    scrim.addEventListener('pointerdown', function (e) { if (e.target === scrim) { e.preventDefault(); done(); } });
    box.addEventListener('keydown', function (e) { if (e.key !== 'Escape' && e.key !== 'Tab') e.stopPropagation(); });
    sheetOpen = done;
    release = VK.focus.trap(box, { initial: inst.input, onEscape: done });
    changed();
    return { close: done, filter: inst.filter };
  }

  function attachHelp(o) {
    o = o || {};
    VK.actions.register({ id: 'help.keys', label: 'Gyorsbillentyűk', hint: 'Puskalap: minden billentyűparancs csoportosítva, kereshetően',
      group: o.group || 'Súgó', icon: 'keyboard', keys: o.keys || ['?'], at: o.at || ['palette', 'menu:help'],
      checked: function () { return !!sheetOpen; }, run: function () { sheet(o); } });
    VK.actions.register({ id: 'help.hints', label: 'Billentyű-jelölések', hint: 'A látható gombokra kiírja a gyorsbillentyűt (Alt nyomva tartva is)',
      group: o.group || 'Súgó', icon: 'tag', at: o.hintsAt || o.at || ['palette', 'menu:help'],
      checked: function () { return !!layer; },
      run: function () { if (layer) hideHints(); else showHints(document, { pinned: true }); changed(); } });
  }

  VK.kbd = { chip: chip, chips: chips, forAction: forAction, label: label, aria: aria, parts: function (k) { return split(k).map(partLabel); },
    hints: hints, showHints: showHints, hideHints: hideHints, hintsShown: hintsShown,
    sheet: sheet, renderSheet: renderSheet, attachHelp: attachHelp, KIT_KEYS: KIT_KEYS };
})(typeof window !== 'undefined' ? window : globalThis);
