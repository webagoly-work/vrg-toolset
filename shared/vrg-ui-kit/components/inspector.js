/* VRG UI Kit — components/inspector.js — key-value inspector: collapsible groups, mono values with units,
   inline edit (Enter commits, Esc cancels), copy value (a MINI that shows done/error), read-only and changed states.

     var ins = VK.inspector.mount(el, {
       label: 'Eszköz tulajdonságai',
       sections: [{ id, title, collapsed: false, fields: [
         { key, label, value, unit, type: 'text'|'number'|'select', options: ['B','C','D'], editable: true,
           readonly: false, changed: false, mono: true, format: v => text, hint } ] }],
       onChange(key, value, field, inst) })            // return false to reject an edit
     → { setData(sections), set(key, value), get(key), getChanged(), resetChanged(), edit(key), destroy() }

   Keyboard (one tab stop; the inspector is a roving list of group headers and rows):
   ↑/↓ move · Home/End · → opens a group / ← closes it or goes to the row's group · Enter or F2 edits a row
   (Enter on a header toggles) · in the editor Enter commits, Esc cancels · C or Ctrl+C copies the value.
   Depends on: core.js, mini.js. */
(function (root) {
  'use strict';
  var VK = root.VK = root.VK || {};
  if (VK.inspector) return;

  function copyText(text) {
    if (root.navigator && navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(function () { return legacy(text); });
    }
    return legacy(text);
    function legacy(t) {
      return new Promise(function (ok, fail) {
        var ta = VK.el('textarea', { 'aria-hidden': 'true', style: { position: 'fixed', left: '-9999px', top: '0' } }); ta.value = t;
        document.body.appendChild(ta); ta.select();
        var r = false; try { r = document.execCommand('copy'); } catch (e) { r = false; }
        ta.remove(); if (r) ok(); else fail(new Error('copy'));
      });
    }
  }

  function mount(el, o) {
    o = o || {};
    var fields = {}, secs = [], off = [], editing = null;
    el.classList.add('vk-insp');
    el.setAttribute('role', 'group');
    el.setAttribute('aria-label', o.label || 'Tulajdonságok');

    function show(f) {
      var v = f.value;
      if (f.format) return f.format(v, f);
      if (v === null || v === undefined || v === '') return '—';
      if (typeof v === 'number') return v.toLocaleString('hu-HU', { maximumFractionDigits: 3 });
      return String(v);
    }
    function rowLabel(f) {
      return f.label + ': ' + show(f) + (f.unit ? ' ' + f.unit : '') +
        (f.readonly ? ' — csak olvasható' : f.editable ? ' — szerkeszthető (Enter)' : '') + (isChanged(f) ? ' — módosítva' : '');
    }
    function isChanged(f) { return !!f.changed || (f.orig !== undefined && String(f.orig) !== String(f.value)); }

    function paintRow(f) {
      var r = f.row;
      f.valEl.textContent = show(f);
      f.valEl.classList.toggle('vk-insp__val--empty', f.value === null || f.value === undefined || f.value === '');
      r.toggleAttribute('data-changed', isChanged(f));
      r.setAttribute('aria-label', rowLabel(f));
    }

    function build(list) {
      el.textContent = ''; fields = {}; secs = [];
      (list || []).forEach(function (s) {
        var bodyId = VK.uid('vk-insp');
        var count = VK.el('span.vk-insp__count', { text: String((s.fields || []).length) });
        var tg = VK.el('button.vk-insp__toggle', { type: 'button', tabindex: -1, 'aria-expanded': s.collapsed ? 'false' : 'true', 'aria-controls': bodyId },
          [VK.icon('chevron-right'), VK.el('span.vk-insp__title', { text: s.title }), count]);
        var body = VK.el('div.vk-insp__list', { id: bodyId, role: 'list', hidden: !!s.collapsed });
        var sec = VK.el('section.vk-insp__sec', null, [VK.el('h4.vk-insp__h', null, [tg]), body]);
        var S = { data: s, el: sec, toggle: tg, body: body, rows: [] };
        tg._sec = S;
        (s.fields || []).forEach(function (fd) {
          var f = {}; for (var k in fd) f[k] = fd[k];
          f.orig = fd.value; f.sec = S;
          var val = VK.el('span.vk-insp__val' + (f.mono === false ? '' : '.vk-num'));
          var copy = VK.mini.create({ icon: 'copy', label: 'Érték másolása: ' + f.label, size: 'sm', onClick: function (e) { e.stopPropagation(); doCopy(f); } });
          copy.tabIndex = -1; copy.classList.add('vk-insp__copy');
          var acts = VK.el('span.vk-insp__acts');
          if (f.readonly) acts.appendChild(VK.el('span.vk-insp__lock', { title: 'Csak olvasható', 'aria-hidden': 'true' }, [VK.icon('lock')]));
          else if (f.editable) acts.appendChild(VK.el('button.vk-insp__edit', { type: 'button', tabindex: -1, 'aria-label': 'Szerkesztés: ' + f.label, title: 'Szerkesztés (Enter)',
            onclick: function (e) { e.stopPropagation(); startEdit(f); } }, [VK.icon('edit')]));
          acts.appendChild(copy);
          var row = VK.el('div.vk-insp__row', { role: 'listitem', tabindex: -1, 'data-key': f.key },
            [VK.el('span.vk-insp__k', { text: f.label, title: f.hint || null }), VK.el('span.vk-insp__v', null, [val, f.unit ? VK.el('span.vk-insp__unit', { text: f.unit }) : null]), acts]);
          if (f.readonly) row.setAttribute('data-readonly', '');
          if (f.editable && !f.readonly) row.setAttribute('data-editable', '');
          row._f = f; f.row = row; f.valEl = val; f.copy = copy;
          fields[f.key] = f; S.rows.push(row); body.appendChild(row);
          paintRow(f);
        });
        secs.push(S); el.appendChild(sec);
      });
      var first = items()[0]; if (first) first.tabIndex = 0;
    }

    // ---------- roving ----------
    function items() {
      var out = [];
      secs.forEach(function (S) { out.push(S.toggle); if (!S.body.hidden) out = out.concat(S.rows); });
      return out;
    }
    function focusItem(n) {
      if (!n) return;
      el.querySelectorAll('.vk-insp__toggle[tabindex="0"], .vk-insp__row[tabindex="0"]').forEach(function (x) { x.tabIndex = -1; });
      n.tabIndex = 0; n.focus(); if (n.scrollIntoView) n.scrollIntoView({ block: 'nearest' });
    }
    function setOpen(S, open) { S.toggle.setAttribute('aria-expanded', open ? 'true' : 'false'); S.body.hidden = !open; S.el.toggleAttribute('data-collapsed', !open); }

    // ---------- edit ----------
    function startEdit(f) {
      if (!f || f.readonly || !f.editable || editing) return;
      editing = f;
      var inp;
      if (f.type === 'select') {
        inp = VK.el('select.vk-insp__input', { 'aria-label': f.label });
        (f.options || []).forEach(function (op) { var v = typeof op === 'object' ? op.value : op; inp.appendChild(VK.el('option', { value: v, text: typeof op === 'object' ? op.label : op })); });
        inp.value = f.value;
      } else {
        inp = VK.el('input.vk-insp__input', { type: 'text', inputmode: f.type === 'number' ? 'decimal' : null, 'aria-label': f.label + (f.unit ? ' (' + f.unit + ')' : ''), spellcheck: 'false', autocomplete: 'off' });
        inp.value = f.value == null ? '' : typeof f.value === 'number' ? String(f.value).replace('.', ',') : String(f.value);
      }
      f.row.setAttribute('data-editing', '');
      f.valEl.hidden = true;
      f.valEl.parentNode.insertBefore(inp, f.valEl);
      var done = false;
      function finish(commit) {
        if (done) return; done = true;
        var v = inp.value;
        if (commit && f.type === 'number') { var n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.')); if (isNaN(n)) { f.row.setAttribute('data-invalid', ''); commit = false; } else v = n; }
        if (commit && String(v) !== String(f.value)) {
          var prev = f.value; f.value = v;
          if (o.onChange && o.onChange(f.key, v, f, api) === false) f.value = prev;
        }
        inp.remove(); f.valEl.hidden = false; f.row.removeAttribute('data-editing'); editing = null;
        paintRow(f); focusItem(f.row);
        if (!commit) setTimeout(function () { f.row.removeAttribute('data-invalid'); }, 1200);
      }
      inp.addEventListener('keydown', function (e) {
        e.stopPropagation();
        if (e.key === 'Enter') { e.preventDefault(); finish(true); }
        else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
      });
      inp.addEventListener('blur', function () { finish(true); });
      inp.focus(); if (inp.select) inp.select();
    }
    function doCopy(f) {
      var text = show(f) + (f.unit ? ' ' + f.unit : '');
      VK.mini.set(f.copy, { state: 'running', progress: null });
      copyText(text).then(function () { VK.mini.set(f.copy, { state: 'done', progress: 1 }); }, function () { VK.mini.set(f.copy, { state: 'error', progress: 1 }); })
        .then(function () { setTimeout(function () { VK.mini.set(f.copy, { state: 'idle', progress: 0 }); }, 1400); });
      if (o.onCopy) o.onCopy(f.key, text, api);
    }

    function on(t, type, fn) { t.addEventListener(type, fn); off.push(function () { t.removeEventListener(type, fn); }); }
    on(el, 'keydown', function (e) {
      if (e.defaultPrevented || editing || e.altKey) return;
      if (e.shiftKey && /^Arrow/.test(e.key)) return;
      var n = e.target.closest('.vk-insp__toggle, .vk-insp__row'); if (!n) return;
      var list = items(), i = list.indexOf(n), S = n._sec, f = n._f, h = true, mod = e.ctrlKey || e.metaKey;
      switch (e.key) {
        case 'ArrowDown': focusItem(list[Math.min(list.length - 1, i + 1)]); break;
        case 'ArrowUp': focusItem(list[Math.max(0, i - 1)]); break;
        case 'Home': focusItem(list[0]); break;
        case 'End': focusItem(list[list.length - 1]); break;
        case 'ArrowRight': if (S) { if (S.body.hidden) setOpen(S, true); else focusItem(S.rows[0]); } else h = false; break;
        case 'ArrowLeft': if (S) setOpen(S, false); else focusItem(f.sec.toggle); break;
        case 'Enter': case 'F2': if (S) setOpen(S, S.body.hidden); else startEdit(f); break;
        case ' ': case 'Spacebar': if (S) setOpen(S, S.body.hidden); else h = false; break;
        case 'c': case 'C': if (f && (!mod || !String(root.getSelection ? root.getSelection() : ''))) doCopy(f); else h = false; break;
        default: h = false;
      }
      if (h) { e.preventDefault(); e.stopPropagation(); }
    });
    on(el, 'click', function (e) {
      var tg = e.target.closest('.vk-insp__toggle');
      if (tg) { setOpen(tg._sec, tg._sec.body.hidden); focusItem(tg); return; }
      var r = e.target.closest('.vk-insp__row'); if (r && !e.target.closest('input, select, button')) focusItem(r);
    });
    on(el, 'dblclick', function (e) { var r = e.target.closest('.vk-insp__row'); if (r && !e.target.closest('input, select, button')) startEdit(r._f); });

    var api = {
      el: el, setData: build,
      set: function (k, v) { var f = fields[k]; if (f) { f.value = v; paintRow(f); } },
      get: function (k) { var f = fields[k]; return f ? f.value : undefined; },
      getChanged: function () { return Object.keys(fields).filter(function (k) { return isChanged(fields[k]); }).map(function (k) { return { key: k, from: fields[k].orig, to: fields[k].value }; }); },
      resetChanged: function () { Object.keys(fields).forEach(function (k) { var f = fields[k]; f.orig = f.value; f.changed = false; paintRow(f); }); },
      edit: function (k) { startEdit(fields[k]); },
      destroy: function () { off.forEach(function (f) { f(); }); off = []; el.textContent = ''; el.classList.remove('vk-insp'); }
    };
    build(o.sections);
    return api;
  }

  VK.inspector = { mount: mount };
})(typeof window !== 'undefined' ? window : globalThis);
