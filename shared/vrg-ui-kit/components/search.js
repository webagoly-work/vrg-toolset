/* VRG UI Kit — components/search.js — search field with grouped, highlighted results.
     var s = VK.search.mount(el, {
       label: 'Keresés',  placeholder: 'Keresés: akció, fájl, csomópont…',
       provider: function (q) { return [ {id:'files', label:'Fájlok', items:[{id, label, hint, icon, meta}] , total?} ] },
                                                   // may return a Promise: the search MINI runs meanwhile
       recent: ['ötödik', 'kábel'],               // recent searches shown on an empty query (kept up to 6)
       onPick: function (item, group, query) {},  // Enter / click on a result
       minChars: 1
     }) → { query(q), open(), close(), clear(), recent(), focus(), destroy() }
     VK.search.match(q, text) → {score, ranges:[[a,b]…]} | null   Hungarian-folded (VK.fold): "otodik" finds "Ötödik";
                                                   every word of q must match; word starts score higher
     VK.search.filter(items, q, key='label') → matching items, best first, each with .ranges
   ARIA: input[role=combobox][aria-expanded][aria-controls][aria-activedescendant] → [role=listbox] with
   [role=group] per group. Keys: ↓/↑ move (wrap), Enter picks, Esc closes (again: clears), Tab leaves.
   Live region announces "N találat K csoportban" / "Nincs találat". Fires 'vk:pick' on el.
   Depends on: core.js, mini.js, field.css. */
(function (root) {
  'use strict';
  var VK = root.VK = root.VK || {};
  if (VK.search) return;

  function isWordStart(t, i) { return i === 0 || !/[a-z0-9]/.test(t.charAt(i - 1)); }

  function match(q, text) {
    var words = VK.fold(q).trim().split(/\s+/).filter(Boolean);
    if (!words.length) return { score: 1, ranges: [] };
    var t = VK.fold(text), ranges = [], score = 0;
    for (var w = 0; w < words.length; w++) {
      var tok = words[w], at = -1, from = 0, first = -1;
      while ((from = t.indexOf(tok, from)) >= 0) { if (first < 0) first = from; if (isWordStart(t, from)) { at = from; break; } from += 1; }
      if (first < 0) return null;
      if (at < 0) { at = first; score += 1; } else score += at === 0 ? 3 : 2;
      ranges.push([at, at + tok.length]);
    }
    ranges.sort(function (a, b) { return a[0] - b[0]; });
    var merged = [];
    ranges.forEach(function (r) { var l = merged[merged.length - 1]; if (l && r[0] <= l[1]) l[1] = Math.max(l[1], r[1]); else merged.push(r.slice()); });
    return { score: score - t.length / 200, ranges: merged };
  }

  function filter(items, q, key) {
    key = key || 'label';
    return (items || []).map(function (it) { var m = match(q, it[key]); if (!m) return null; var c = Object.assign({}, it); c.ranges = m.ranges; c._score = m.score; return c; })
      .filter(Boolean).sort(function (a, b) { return b._score - a._score; });
  }

  /** text with <mark> around ranges (indices are into the folded text, which keeps lengths) */
  function highlight(text, ranges) {
    var frag = document.createDocumentFragment(), pos = 0;
    (ranges || []).forEach(function (r) {
      if (r[0] > pos) frag.appendChild(document.createTextNode(text.slice(pos, r[0])));
      frag.appendChild(VK.el('mark.vk-search__hit', { text: text.slice(r[0], r[1]) }));
      pos = r[1];
    });
    if (pos < text.length) frag.appendChild(document.createTextNode(text.slice(pos)));
    return frag;
  }

  function mount(el, o) {
    o = o || {};
    var lbId = VK.uid('vk-sr'), recentList = (o.recent || []).slice(0, 6), groups = [], flat = [], active = -1, seq = 0, lastQ = '';
    el.classList.add('vk-search');
    el.textContent = '';
    var mini = VK.mini.create({ icon: 'search', label: o.label || 'Keresés', size: 'sm', onClick: function () { input.focus(); openFor(input.value); } });
    mini.classList.add('vk-search__mini'); mini.tabIndex = -1; mini.dataset.meter = 'none';
    var input = VK.el('input.vk-field__input.vk-search__input', { type: 'search', role: 'combobox', autocomplete: 'off', spellcheck: 'false',
      'aria-autocomplete': 'list', 'aria-expanded': 'false', 'aria-controls': lbId, 'aria-label': o.label || 'Keresés',
      placeholder: o.placeholder || 'Keresés…' });
    var clearBtn = VK.el('button.vk-search__clear', { type: 'button', 'aria-label': 'Keresés törlése', title: 'Törlés (Esc)', hidden: true, tabindex: '-1' }, VK.icon('close'));
    var box = VK.el('div.vk-field__box.vk-search__box', null, [mini, input, clearBtn]);
    var list = VK.el('div.vk-search__list', { role: 'listbox', id: lbId, 'aria-label': (o.label || 'Keresés') + ' — találatok' });
    var empty = VK.el('div.vk-search__empty', { hidden: true });
    var foot = VK.el('div.vk-search__foot.vk-label', { 'aria-hidden': 'true', html: '<span><kbd>↑↓</kbd> mozgás</span><span><kbd>Enter</kbd> megnyitás</span><span><kbd>Esc</kbd> bezárás</span>' });
    var pop = VK.el('div.vk-search__pop.vk-glass', { hidden: true }, [list, empty, foot]);
    var live = VK.el('div.vk-sr-only', { role: 'status', 'aria-live': 'polite' });
    el.appendChild(box); el.appendChild(pop); el.appendChild(live);

    function setOpen(on) {
      pop.hidden = !on; input.setAttribute('aria-expanded', on ? 'true' : 'false');
      if (!on) { setActive(-1); }
    }
    function setActive(i) {
      flat.forEach(function (x) { x.node.removeAttribute('data-active'); x.node.setAttribute('aria-selected', 'false'); });
      active = i;
      if (i < 0 || !flat[i]) { input.removeAttribute('aria-activedescendant'); return; }
      var n = flat[i].node; n.setAttribute('data-active', ''); n.setAttribute('aria-selected', 'true');
      input.setAttribute('aria-activedescendant', n.id);
      var lr = list.getBoundingClientRect(), nr = n.getBoundingClientRect();
      if (nr.top < lr.top) list.scrollTop -= lr.top - nr.top + 24; else if (nr.bottom > lr.bottom) list.scrollTop += nr.bottom - lr.bottom;
    }

    function render(q, gs) {
      groups = gs || []; flat = []; list.textContent = '';
      var total = 0, shownGroups = 0;
      groups.forEach(function (g) {
        if (!g.items || !g.items.length) return;
        shownGroups += 1;
        var hid = VK.uid('vk-sg'), n = g.total != null ? g.total : g.items.length; total += n;
        var grp = VK.el('div.vk-search__group', { role: 'group', 'aria-labelledby': hid }, [
          VK.el('div.vk-search__ghead', { id: hid, role: 'presentation' }, [
            g.icon ? VK.icon(g.icon, 'vk-icon--sm') : null, VK.el('span', { text: g.label }),
            VK.el('span.vk-search__gcount', { 'aria-label': n + ' találat', text: String(n) })])
        ]);
        g.items.forEach(function (it) {
          var ranges = it.ranges || (q && !g.recent ? (match(q, it.label) || {}).ranges : null);
          var node = VK.el('div.vk-search__opt', { role: 'option', id: VK.uid('vk-so'), 'aria-selected': 'false' }, [
            VK.icon(it.icon || g.icon || 'dot'),
            VK.el('span.vk-search__olabel', null, [highlight(it.label, ranges), it.hint ? VK.el('span.vk-search__ohint', { text: it.hint }) : null]),
            it.meta ? VK.el('span.vk-search__meta', { text: it.meta }) : null
          ]);
          var idx = flat.length;
          node.addEventListener('mousedown', function (e) { e.preventDefault(); });
          node.addEventListener('click', function () { pick(idx); });
          node.addEventListener('mousemove', function () { if (active !== idx) setActive(idx); });
          flat.push({ node: node, item: it, group: g });
          grp.appendChild(node);
        });
        list.appendChild(grp);
      });
      var none = !flat.length;
      list.hidden = none;
      empty.hidden = !none || !q;
      if (none && q) {
        empty.textContent = '';
        empty.appendChild(VK.icon('search'));
        empty.appendChild(VK.el('span', { text: 'Nincs találat erre: „' + q + '”. Próbáld ékezet nélkül vagy rövidebben.' }));
      }
      live.textContent = q ? (none ? 'Nincs találat' : total + ' találat ' + shownGroups + ' csoportban') : (none ? '' : 'Legutóbbi keresések');
      setOpen(!none || !!q);
      setActive(!none && q ? 0 : -1);
    }

    function recentGroup() {
      return recentList.length ? [{ id: 'recent', label: 'Legutóbbi keresések', icon: 'history', recent: true,
        items: recentList.map(function (r) { return { id: 'recent:' + r, label: r, icon: 'history', query: r }; }) }] : [];
    }

    function openFor(q) {
      lastQ = q; clearBtn.hidden = !q;
      if (!q || q.trim().length < (o.minChars || 1)) { render('', recentGroup()); return; }
      var my = ++seq, res;
      try { res = o.provider ? o.provider(q) : []; } catch (e) { console.error(e); res = []; }
      if (res && typeof res.then === 'function') {
        mini.dataset.meter = 'ring'; VK.mini.set(mini, { state: 'running', progress: null });
        res.then(function (gs) { if (my !== seq) return; done(); render(q, gs); },
          function (err) { if (my !== seq) return; console.error(err); mini.dataset.meter = 'ring'; VK.mini.set(mini, { state: 'error', progress: 0 }); render(q, []); });
      } else { done(); render(q, res); }
      function done() { mini.dataset.meter = 'none'; VK.mini.set(mini, { state: 'idle', progress: 0 }); }
    }

    function remember(q) {
      q = (q || '').trim(); if (!q) return;
      recentList = [q].concat(recentList.filter(function (r) { return VK.fold(r) !== VK.fold(q); })).slice(0, 6);
    }

    function pick(i) {
      var x = flat[i]; if (!x) return;
      if (x.item.query !== undefined) { input.value = x.item.query; openFor(x.item.query); return; }
      remember(lastQ);
      setOpen(false);
      if (o.onPick) { try { o.onPick(x.item, x.group, lastQ); } catch (e) { console.error(e); } }
      VK.fire(el, 'pick', { item: x.item, group: x.group, query: lastQ });
    }

    function clear() { input.value = ''; clearBtn.hidden = true; lastQ = ''; render('', recentGroup()); setOpen(false); }

    input.addEventListener('input', function () { openFor(input.value); });
    input.addEventListener('focus', function () { if (!input.value) openFor(''); });
    input.addEventListener('keydown', function (e) {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      var n = flat.length;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (pop.hidden) { openFor(input.value); if (flat.length && active < 0) setActive(0); return; }
        if (n) setActive(active < 0 ? 0 : (active + 1) % n);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (pop.hidden) { openFor(input.value); }
        if (flat.length) setActive(active <= 0 ? flat.length - 1 : active - 1);
      } else if (e.key === 'Enter') {
        if (!pop.hidden && active >= 0) { e.preventDefault(); pick(active); }
        else if (input.value) { e.preventDefault(); remember(input.value); openFor(input.value); }
      } else if (e.key === 'Escape') {
        if (!pop.hidden) { e.preventDefault(); e.stopPropagation(); setOpen(false); }
        else if (input.value) { e.preventDefault(); e.stopPropagation(); clear(); }
      } else if (e.key === 'Tab') { setOpen(false); }
    });
    input.addEventListener('blur', function () { setTimeout(function () { if (!el.contains(document.activeElement)) setOpen(false); }, 0); });
    clearBtn.addEventListener('mousedown', function (e) { e.preventDefault(); });
    clearBtn.addEventListener('click', function () { clear(); input.focus(); });

    return {
      query: function (q) { input.value = q || ''; openFor(input.value); },
      open: function () { openFor(input.value); }, close: function () { setOpen(false); },
      clear: clear, recent: function () { return recentList.slice(); }, focus: function () { input.focus(); },
      input: input,
      destroy: function () { el.textContent = ''; el.classList.remove('vk-search'); }
    };
  }

  VK.search = { mount: mount, match: match, filter: filter, highlight: highlight };
})(typeof window !== 'undefined' ? window : globalThis);
