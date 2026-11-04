/* VRG UI Kit — components/palette.js — the command palette (Ctrl+K).
     VK.palette.attach({surface:'palette', keys:['mod+k'], at:['toolbar:command'], label, placeholder})
        registers the action 'palette.open' (it toggles the modal) and returns the API. The app's
        VK.actions.bindKeys() delivers the key; a header button calls VK.actions.run('palette.open').
     VK.palette.open(text?) · close() · toggle() · isOpen()
     VK.palette.addProvider('#', fn(query, ctx) → [{label, hint, icon, keys, group, run}], {label:'UGRÁS', placeholder}) → off()
        Prefix modes: '>' commands (the default with no prefix), any registered prefix → its provider.
     VK.palette.mount(el, {surface, query, ctx}) → an inline, non-modal palette (docs, gallery) → {setQuery, refresh, destroy}
   Commands come from VK.actions.search(q, surface): hits highlighted, grouped by action.group, recent first on an empty
   query, toggles show their checked state, running actions show their MINI meter; disabled actions are hidden, but when
   a query only matches disabled ones a "Nem érhető el most" note names them (and action.reason when given).
   Keys: ↑↓ PgUp PgDn Home End move · Enter runs · Esc closes and restores focus · Tab stays inside.
   Components and apps can ask every surface to re-read action state with VK.fire(document, 'actions').
   Depends on: core, focus, actions, kbd. Optional: mini (meters on stateful actions). */
(function (root) {
  'use strict';
  var VK = root.VK = root.VK || {};
  if (VK.palette) return;

  var providers = {};
  var cfg = { surface: 'palette' };
  var modal = null;
  var STATE_TXT = { running: 'FUT', done: 'KÉSZ', error: 'HIBA', waiting: 'VÁR', paused: 'SZÜNET', off: 'KI' };

  function addProvider(prefix, fn, o) {
    o = o || {};
    providers[prefix] = { fn: fn, label: o.label || prefix, placeholder: o.placeholder, icon: o.icon || 'arrow-right' };
    return function () { delete providers[prefix]; };
  }
  function modeOf(v) {
    var c = v.charAt(0);
    if (c === '>') return { prefix: '>', q: v.slice(1).trim() };
    if (providers[c]) return { prefix: c, q: v.slice(1).trim() };
    return { prefix: '>', q: v.trim() };
  }
  function reasonOf(a, c) { var r = a.reason; try { r = typeof r === 'function' ? r(c) : r; } catch (e) { r = ''; } return r || ''; }
  function highlight(node, text, hits) {
    var set = {}, buf = '', on = false;
    (hits || []).forEach(function (i) { set[i] = 1; });
    function flush() { if (!buf) return; node.appendChild(on ? VK.el('mark.vk-palette__hit', null, buf) : document.createTextNode(buf)); buf = ''; }
    for (var i = 0; i < text.length; i++) { var h = !!set[i]; if (h !== on) { flush(); on = h; } buf += text[i]; }
    flush();
  }

  /** build one palette (modal or inline). o: {surface, modal, query, ctx, onDone} */
  function build(o) {
    var surface = o.surface || cfg.surface;
    var listId = VK.uid('vk-pal-list'), ctx = o.ctx || VK.actions.ctx();
    var mode = VK.el('span.vk-palette__mode', { 'aria-hidden': 'true' });
    var input = VK.el('input.vk-palette__input', { type: 'text', role: 'combobox', 'aria-expanded': 'true', 'aria-controls': listId,
      'aria-autocomplete': 'list', 'aria-haspopup': 'listbox', autocomplete: 'off', spellcheck: 'false',
      'aria-label': o.label || 'Parancs keresése' });
    var head = VK.el('div.vk-palette__head', null, [VK.icon('search', 'vk-palette__glass'), mode, input, o.modal ? VK.kbd.chip('escape', { size: 'sm' }) : null]);
    var list = VK.el('div.vk-palette__list', { id: listId, role: 'listbox', 'aria-label': 'Találatok' });
    var note = VK.el('div.vk-palette__note', { hidden: true });
    var live = VK.el('div.vk-sr-only', { role: 'status', 'aria-live': 'polite' });
    var foot = VK.el('div.vk-palette__foot');
    var box = VK.el('div.vk-palette__box.vk-glass.vk-cut', o.modal ? { role: 'dialog', 'aria-modal': 'true', 'aria-label': o.title || 'Parancspaletta' }
      : { role: 'group', 'aria-label': o.title || 'Parancspaletta' }, [head, list, note, foot, live]);
    if (!o.modal) box.classList.add('vk-palette__box--inline');

    function footItem(keys, text) { var s = VK.el('span.vk-palette__fk'); keys.forEach(function (k) { s.appendChild(VK.kbd.chip(k, { size: 'sm' })); }); s.appendChild(document.createTextNode(text)); return s; }
    function drawFoot() {
      foot.textContent = '';
      foot.appendChild(footItem(['arrowup', 'arrowdown'], 'mozgás'));
      foot.appendChild(footItem(['enter'], 'futtat'));
      if (o.modal) foot.appendChild(footItem(['escape'], 'bezár'));
      foot.appendChild(footItem(['>'], 'parancsok'));
      Object.keys(providers).forEach(function (p) { foot.appendChild(footItem([p], providers[p].label.toLowerCase())); });
    }

    var rows = [], active = -1, lastKey = null, ids = {};

    function commandItems(q) {
      var res = VK.actions.search(q, surface, ctx).filter(function (r) { return typeof r.action.run === 'function'; });
      return res.map(function (r) {
        var a = r.action;
        return { key: 'a:' + a.id, action: a, label: a.label, hits: r.hits, hint: a.hint, icon: a.icon, keys: a.keys,
          group: r.recent && !q ? 'Legutóbbi' : (a.group || 'Egyéb') };
      });
    }
    function providerItems(m) {
      var p = providers[m.prefix], items = [];
      try { items = p.fn(m.q, ctx) || []; } catch (e) { console.error(e); }
      return items.map(function (it, i) {
        var s = m.q ? VK.actions.score(m.q, it.label || '') : { score: 1, hits: [] };
        return { key: 'p:' + m.prefix + (it.id || it.label), label: it.label || '', hits: s.hits, score: s.score, order: i, hint: it.hint,
          icon: it.icon || p.icon, keys: it.keys || [], group: it.group || p.label, run: it.run };
      }).sort(function (x, y) { return (y.score > 0) - (x.score > 0) || y.score - x.score || x.order - y.order; });
    }

    function optionEl(it, id) {
      var a = it.action;
      var opt = VK.el('div.vk-palette__opt', { id: id, role: 'option', 'aria-selected': 'false' });
      var ico = VK.el('span.vk-mini.vk-palette__ico', { 'aria-hidden': 'true', 'data-size': 'sm', 'data-meter': 'none' }, VK.icon(it.icon || 'dot'));
      var stateTxt = '';
      if (a && (a.progress || a.state || a.checked) && VK.mini) {
        if (a.progress || a.state) ico.removeAttribute('data-meter');
        VK.mini.refresh(ico, a, ctx);
        var st = ico.dataset.state, p = ico.style.getPropertyValue('--vk-p');
        if (st === 'running' && p !== '') stateTxt = Math.round(parseFloat(p) * 100) + '%'; else if (st) stateTxt = STATE_TXT[st] || '';
      }
      opt.appendChild(ico);
      var lab = VK.el('span.vk-palette__label'); highlight(lab, it.label, it.hits);
      opt.appendChild(VK.el('span.vk-palette__txt', null, [lab, it.hint ? VK.el('span.vk-palette__hint', null, it.hint) : null]));
      var side = VK.el('span.vk-palette__side');
      if (stateTxt) side.appendChild(VK.el('span.vk-palette__state', { 'data-state': ico.dataset.state }, stateTxt));
      var chk = a ? VK.actions.checked(a, ctx) : undefined;
      if (chk !== undefined) {
        opt.setAttribute('aria-checked', String(chk));
        side.appendChild(VK.el('span.vk-palette__check', { 'aria-hidden': 'true', 'data-on': chk ? '' : null }, [chk ? VK.icon('check') : null, VK.el('span', null, chk ? 'BE' : 'KI')]));
      }
      if (it.keys && it.keys.length) side.appendChild(VK.kbd.chip(it.keys[0], { size: 'sm' }));
      opt.appendChild(side);
      return opt;
    }

    function render() {
      var m = modeOf(input.value);
      ctx = o.ctx || VK.actions.ctx();
      var prov = m.prefix !== '>' ? providers[m.prefix] : null;
      mode.textContent = prov ? prov.label : 'PARANCS';
      box.dataset.mode = prov ? 'provider' : 'commands';
      input.placeholder = prov ? (prov.placeholder || 'Ugrás…') : (o.placeholder || cfg.placeholder || 'Parancs keresése…');
      var items = prov ? providerItems(m) : commandItems(m.q);
      var keepTop = list.scrollTop;
      list.textContent = ''; rows = [];
      var groups = {}, order = [];
      items.forEach(function (it) { if (!groups[it.group]) { groups[it.group] = []; order.push(it.group); } groups[it.group].push(it); });
      order.forEach(function (g) {
        var hid = VK.uid('vk-pal-g');
        var grp = VK.el('div.vk-palette__group', { role: 'group', 'aria-labelledby': hid }, VK.el('div.vk-palette__gh', { id: hid, role: 'presentation' }, g));
        groups[g].forEach(function (it) {
          var id = ids[it.key] || (ids[it.key] = VK.uid('vk-pal-o')), el = optionEl(it, id);   // stable across re-renders
          el.dataset.i = rows.length;
          rows.push({ it: it, el: el });
          grp.appendChild(el);
        });
        list.appendChild(grp);
      });
      // disabled-only matches → say so instead of a bare "nincs találat"
      note.hidden = true; note.textContent = '';
      if (!rows.length) {
        note.hidden = false;
        var dis = !prov && m.q ? VK.actions.forSurface(surface, ctx, { all: true }).filter(function (a) {
          return !VK.actions.enabled(a, ctx) && VK.actions.score(m.q, a.label).score > 0; }) : [];
        if (dis.length) {
          note.dataset.kind = 'disabled';
          note.appendChild(VK.el('p.vk-palette__nt', null, [VK.icon('lock'), 'Nem érhető el most']));
          var ul = VK.el('ul.vk-palette__dl');
          dis.slice(0, 5).forEach(function (a) {
            var r = reasonOf(a, ctx);
            ul.appendChild(VK.el('li', null, [VK.icon(a.icon || 'dot'), VK.el('b', null, a.label), r ? VK.el('span', null, r) : null]));
          });
          note.appendChild(ul);
        } else {
          note.dataset.kind = 'empty';
          note.appendChild(VK.el('p.vk-palette__nt', null, [VK.icon('search'), m.q ? 'Nincs találat: „' + m.q + '”' : 'Nincs mit mutatni']));
        }
      }
      var say = rows.length ? rows.length + ' találat' : (note.dataset.kind === 'disabled' ? 'Nincs elérhető találat; a parancs most nem érhető el' : 'Nincs találat');
      if (live.textContent !== say) live.textContent = say;
      // keep the active row across re-renders (state ticks), else the first
      var idx = 0;
      if (lastKey) { for (var i = 0; i < rows.length; i++) if (rows[i].it.key === lastKey) { idx = i; break; } list.scrollTop = keepTop; }
      setActive(rows.length ? idx : -1, !lastKey);
    }
    function setActive(i, scroll) {
      if (!rows.length || i < 0) { active = -1; lastKey = null; input.removeAttribute('aria-activedescendant'); return; }
      i = VK.clamp(i, 0, rows.length - 1);
      if (rows[active]) rows[active].el.setAttribute('aria-selected', 'false');
      active = i; lastKey = rows[i].it.key;
      rows[i].el.setAttribute('aria-selected', 'true');
      input.setAttribute('aria-activedescendant', rows[i].el.id);
      if (scroll !== false) {
        if (i === 0) list.scrollTop = 0;
        else rows[i].el.scrollIntoView({ block: 'nearest' });
      }
    }
    function pageSize() { var h = rows[0] ? rows[0].el.offsetHeight || 32 : 32; return Math.max(1, Math.floor(list.clientHeight / h) - 1); }
    function choose(i) {
      var r = rows[i]; if (!r) return;
      var it = r.it;
      if (it.action && !VK.actions.enabled(it.action, ctx)) return;
      if (o.onDone) o.onDone();
      if (it.action) VK.actions.run(it.action, ctx, 'palette');
      else if (it.run) { try { it.run(ctx); } catch (e) { console.error(e); } }
      if (!o.modal) render();
    }

    input.addEventListener('input', function () { lastKey = null; render(); });
    input.addEventListener('keydown', function (e) {
      if (e.altKey || e.metaKey) return;
      var n = rows.length, k = e.key;
      if (k === 'ArrowDown' || k === 'ArrowUp') {
        if (!n) return; e.preventDefault();
        setActive(((active < 0 ? (k === 'ArrowDown' ? -1 : 0) : active) + (k === 'ArrowDown' ? 1 : -1) + n) % n);
      } else if (k === 'PageDown' || k === 'PageUp') {
        if (!n) return; e.preventDefault(); setActive(active + (k === 'PageDown' ? 1 : -1) * pageSize());
      } else if ((k === 'Home' || k === 'End') && !e.shiftKey) {
        if (!n) return; e.preventDefault(); setActive(k === 'Home' ? 0 : n - 1);
      } else if (k === 'Enter') {
        e.preventDefault(); choose(active);
      } else if (k === 'Escape' && !o.modal && input.value) {
        e.preventDefault(); input.value = ''; lastKey = null; render();
      }
    });
    list.addEventListener('pointerdown', function (e) { if (e.target.closest('[role="option"]')) e.preventDefault(); });
    list.addEventListener('pointermove', function (e) { var opt = e.target.closest('[role="option"]'); if (opt && +opt.dataset.i !== active) setActive(+opt.dataset.i, false); });
    list.addEventListener('click', function (e) { var opt = e.target.closest('[role="option"]'); if (opt) { choose(+opt.dataset.i); if (!o.modal) input.focus(); } });

    var raf = 0;
    function later() { cancelAnimationFrame(raf); raf = requestAnimationFrame(render); }
    var unsub = VK.actions.subscribe(function () { later(); });
    document.addEventListener('vk:actions', later);

    input.value = o.query || '';
    drawFoot(); render();
    return {
      el: box, input: input,
      setQuery: function (v) { input.value = v || ''; lastKey = null; render(); try { input.setSelectionRange(input.value.length, input.value.length); } catch (e) { /* type=text */ } },
      refresh: render,
      destroy: function () { cancelAnimationFrame(raf); unsub(); document.removeEventListener('vk:actions', later); }
    };
  }

  function open(text) {
    if (modal) { if (text != null) modal.inst.setQuery(text); modal.inst.input.focus(); return modal.inst; }
    var scrim = VK.el('div.vk-palette');
    var inst = build({ modal: true, surface: cfg.surface, placeholder: cfg.placeholder, onDone: close });
    scrim.appendChild(inst.el);
    document.body.appendChild(scrim);
    scrim.addEventListener('pointerdown', function (e) { if (e.target === scrim) { e.preventDefault(); close(); } });
    var release = VK.focus.trap(inst.el, { initial: inst.input, onEscape: close });
    modal = { scrim: scrim, inst: inst, release: release };
    inst.setQuery(text || '');
    return inst;
  }
  function close() {
    if (!modal) return;
    var m = modal; modal = null;
    m.inst.destroy(); m.scrim.remove(); m.release();
  }
  function toggle(text) { if (modal) close(); else open(text); }

  function attach(o) {
    o = o || {};
    cfg = { surface: o.surface || 'palette', placeholder: o.placeholder };
    VK.actions.register({ id: 'palette.open', label: o.label || 'Parancspaletta', hint: 'Minden parancs egy helyen — gépelj a szűréshez, # ugrás',
      group: o.group || 'Általános', icon: 'command', caption: 'PARANCS', keys: o.keys || ['mod+k'], at: o.at || ['toolbar:command'],
      checked: o.pressed ? function () { return !!modal; } : undefined,
      run: function () { toggle(); } });
    return VK.palette;
  }
  function mount(el, o) {
    o = o || {};
    var inst = build({ modal: false, surface: o.surface || cfg.surface, query: o.query, ctx: o.ctx, title: o.title, placeholder: o.placeholder });
    el.appendChild(inst.el);
    return { el: inst.el, input: inst.input, setQuery: inst.setQuery, refresh: inst.refresh, destroy: function () { inst.destroy(); inst.el.remove(); } };
  }

  VK.palette = { attach: attach, open: open, close: close, toggle: toggle, isOpen: function () { return !!modal; },
    addProvider: addProvider, mount: mount };
})(typeof window !== 'undefined' ? window : globalThis);
