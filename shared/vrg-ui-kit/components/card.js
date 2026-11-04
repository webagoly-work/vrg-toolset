/* VRG UI Kit — components/card.js — cards and tiles.

     VK.card.create({ title, id, minis: [miniNode…], body: Node|string, meta: [['Áram', '16 A'], …],
                      footer: Node|string, status: 'ok'|'warn'|'crit'|'active'|'info', tag: 'article' }) → element
     VK.card.tile({ id, icon, title, sub, value, unit, kind: 'tile'|'compact'|'program', status, state, progress,
                    disabled, caption }) → .vk-tile element (role=option)
     VK.card.tiles(el, { multi: true, activateOnClick: false, onSelect(ids, inst), onActivate(id, tileEl, inst) })
       → { getSelection(), select(ids), setState(id, {state, progress}), update(), destroy() }

   The tile grid is a listbox: one tab stop, arrows move in 2-D (columns follow the layout), Home/End,
   Space = select (toggle in multi), Ctrl+A = all, Esc = clear, Enter = activate (launch a program tile),
   letters = typeahead. Click = select (Ctrl+click toggles), double click = activate.
   A program tile's icon sits in a MINI meter: setState(id, {state:'running', progress:.4}) shows the launch.
   Depends on: core.js, focus.js, mini.js. */
(function (root) {
  'use strict';
  var VK = root.VK = root.VK || {};
  if (VK.card) return;

  function content(x) { return x == null ? null : typeof x === 'string' ? document.createTextNode(x) : x; }

  function create(o) {
    o = o || {};
    var hid = VK.uid('vk-card');
    var card = VK.el((o.tag || 'article') + '.vk-card', { 'aria-labelledby': hid });
    if (o.status) card.setAttribute('data-status', o.status);
    var titles = VK.el('div.vk-card__titles', null, [
      o.id ? VK.el('span.vk-card__id', { text: o.id }) : null,
      VK.el('h4.vk-card__title', { id: hid, text: o.title || '' })
    ]);
    var head = VK.el('header.vk-card__head', null, [titles]);
    if (o.minis && o.minis.length) head.appendChild(VK.el('div.vk-card__minis', null, o.minis));
    card.appendChild(head);
    if (o.body != null) card.appendChild(VK.el('div.vk-card__body', null, [content(o.body)]));
    if (o.meta && o.meta.length) {
      var dl = VK.el('dl.vk-card__meta');
      o.meta.forEach(function (m) { dl.appendChild(VK.el('div', null, [VK.el('dt', { text: m[0] }), VK.el('dd', null, [content(m[1])])])); });
      card.appendChild(dl);
    }
    if (o.footer != null) card.appendChild(VK.el('footer.vk-card__foot', null, [content(o.footer)]));
    return card;
  }

  function tile(o) {
    o = o || {};
    var kind = o.kind || 'tile';
    var t = VK.el('div.vk-tile', { role: 'option', tabindex: -1, 'aria-selected': 'false', 'data-id': o.id });
    if (kind !== 'tile') t.classList.add('vk-tile--' + kind);
    if (o.status) t.setAttribute('data-status', o.status);
    if (o.disabled) t.setAttribute('aria-disabled', 'true');
    var ic;
    if (kind === 'program') {
      ic = VK.el('span.vk-mini', { 'data-size': 'lg', 'data-meter': 'square', 'aria-hidden': 'true' }, [VK.icon(o.icon || 'window')]);
      ic.dataset.label = o.title || '';
      if (o.state || o.progress !== undefined) VK.mini.set(ic, { state: o.state, progress: o.progress });
      t.appendChild(VK.el('span.vk-tile__frame', null, [ic]));
    } else t.appendChild(VK.el('span.vk-tile__icon', { 'aria-hidden': 'true' }, [VK.icon(o.icon || 'card')]));
    t.appendChild(VK.el('span.vk-tile__title', { text: o.title || '' }));
    if (o.sub) t.appendChild(VK.el('span.vk-tile__sub', { text: o.sub }));
    if (o.value != null) t.appendChild(VK.el('span.vk-tile__value', null, [String(o.value), o.unit ? VK.el('span.vk-tile__unit', { text: o.unit }) : null]));
    if (o.caption) t.appendChild(VK.el('span.vk-tile__cap', { text: o.caption }));
    return t;
  }

  function tiles(el, o) {
    o = o || {};
    var multi = o.multi !== false, off = [];
    el.classList.add('vk-tiles');
    el.setAttribute('role', 'listbox');
    if (multi) el.setAttribute('aria-multiselectable', 'true');
    if (!el.hasAttribute('aria-label') && !el.hasAttribute('aria-labelledby')) el.setAttribute('aria-label', o.label || 'Csempék');
    function list() { return Array.prototype.slice.call(el.querySelectorAll('.vk-tile')); }
    function cols() {
      var l = list().filter(function (t) { return t.offsetParent; }); if (!l.length) return 1;
      var top = l[0].offsetTop, n = 0; for (var i = 0; i < l.length && l[i].offsetTop === top; i++) n++; return Math.max(1, n);
    }
    list().forEach(function (t, i) { t.tabIndex = i ? -1 : 0; if (!t.hasAttribute('aria-selected')) t.setAttribute('aria-selected', 'false'); });
    var rov = VK.focus.roving(el, { items: '.vk-tile', orientation: 'grid', cols: cols, wrap: false });
    var anchor = null;

    function ids() { return list().filter(function (t) { return t.getAttribute('aria-selected') === 'true'; }).map(function (t) { return t.dataset.id; }); }
    function emit() { if (o.onSelect) o.onSelect(ids(), api); }
    function setSel(t, v) { if (t.getAttribute('aria-disabled') === 'true') return; t.setAttribute('aria-selected', v ? 'true' : 'false'); }
    function only(t) { list().forEach(function (x) { setSel(x, x === t); }); anchor = t; emit(); }
    function toggle(t) { if (!multi) return only(t); setSel(t, t.getAttribute('aria-selected') !== 'true'); anchor = t; emit(); }
    function activate(t) { if (t.getAttribute('aria-disabled') === 'true') return; if (o.onActivate) o.onActivate(t.dataset.id, t, api); }

    function on(t, type, fn) { t.addEventListener(type, fn); off.push(function () { t.removeEventListener(type, fn); }); }
    on(el, 'keydown', function (e) {
      var t = e.target.closest && e.target.closest('.vk-tile'); if (!t || e.altKey) return;
      var mod = e.ctrlKey || e.metaKey, h = true;
      if (e.key === ' ' || e.key === 'Spacebar') toggle(t);
      else if (e.key === 'Enter') activate(t);
      else if (e.key === 'Escape' && ids().length) { list().forEach(function (x) { setSel(x, false); }); emit(); }
      else if (mod && (e.key === 'a' || e.key === 'A') && multi) { list().forEach(function (x) { setSel(x, true); }); emit(); }
      else h = false;
      if (h) { e.preventDefault(); e.stopPropagation(); }
    });
    on(el, 'click', function (e) {
      var t = e.target.closest('.vk-tile'); if (!t || t.getAttribute('aria-disabled') === 'true') return;
      list().forEach(function (x) { x.tabIndex = x === t ? 0 : -1; }); t.focus();
      if (o.activateOnClick && !e.ctrlKey && !e.metaKey && !e.shiftKey) { only(t); activate(t); return; }
      if ((e.ctrlKey || e.metaKey) && multi) toggle(t);
      else if (e.shiftKey && multi && anchor) {
        var l = list(), a = l.indexOf(anchor), b = l.indexOf(t);
        l.forEach(function (x, i) { setSel(x, i >= Math.min(a, b) && i <= Math.max(a, b)); }); emit();
      } else only(t);
    });
    on(el, 'dblclick', function (e) { var t = e.target.closest('.vk-tile'); if (t && !o.activateOnClick) activate(t); });

    var api = {
      el: el, getSelection: ids,
      select: function (sel) { sel = (sel || []).map(String); list().forEach(function (x) { setSel(x, sel.indexOf(x.dataset.id) >= 0); }); emit(); },
      setState: function (id, st) {
        var t = el.querySelector('.vk-tile[data-id="' + String(id).replace(/"/g, '') + '"]'); if (!t) return;
        var m = t.querySelector('.vk-mini'); if (m) VK.mini.set(m, st || {});
        if (st && st.state) t.setAttribute('data-state', st.state); else t.removeAttribute('data-state');
        if (st && st.status) t.setAttribute('data-status', st.status);
      },
      update: function () { rov.update(); },
      destroy: function () { off.forEach(function (f) { f(); }); off = []; rov.destroy(); }
    };
    return api;
  }

  VK.card = { create: create, tile: tile, tiles: tiles };
})(typeof window !== 'undefined' ? window : globalThis);
