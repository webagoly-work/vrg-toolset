/* VRG UI Kit — components/chip.js — chip groups: filter (toggle), removable, count, "+" add.
     var g = VK.chip.mount(el, {
       label: 'Vezeték-rétegek',                          // aria-label of the group (role=toolbar)
       chips: [ {id:'power', label:'Erősáram', kind:'filter', pressed:true, count:12, color:'--vk-wire-power'},
                {id:'t1', label:'VRG-2611-03', kind:'remove'},
                {id:'n', label:'Összes', kind:'count', count:48} ],
       add: { label: 'Címke', placeholder: 'Új címke…', validate: function (name) { return msg | null }, onAdd: function (name) { return {id,label,kind} | false } },
       onChange: function (chip, pressed, pressedIds) {}, onRemove: function (chip) {}
     }) → { add(def), remove(id), get(id), set(id, patch), pressed(), reset(), mini(opts), destroy() }
   Keys: one tab stop; ←→ ↑↓ Home End move (VK.focus.roving); Space/Enter toggles a filter chip; Delete/Backspace
   removes a removable chip (focus goes to the next chip, else the previous, else the add chip); Enter on "+"
   opens an input in place: Enter adds, Esc cancels. g.mini() = the group's MINI: value = active filters,
   pressed while a filter is narrowing the view, click resets. Fires 'vk:chip' on el.
   Depends on: core.js, focus.js, mini.js. */
(function (root) {
  'use strict';
  var VK = root.VK = root.VK || {};
  if (VK.chip) return;

  function mount(el, o) {
    o = o || {};
    var chips = [], minis = [];
    el.classList.add('vk-chips');
    el.setAttribute('role', 'toolbar');
    if (o.label) el.setAttribute('aria-label', o.label);
    el.textContent = '';
    var live = VK.el('span.vk-sr-only', { role: 'status', 'aria-live': 'polite' });
    var addBtn = null, addInput = null;

    function node(c) {
      var kids = [];
      if (c.color) kids.push(VK.el('span.vk-chip__sw', { 'aria-hidden': 'true' }));
      if (c.kind === 'filter') kids.push(VK.icon('check', 'vk-chip__tick'));
      kids.push(VK.el('span.vk-chip__label', { text: c.label }));
      if (c.count != null) kids.push(VK.el('span.vk-chip__count', { text: String(c.count) }));
      var n;
      if (c.kind === 'count') {
        n = VK.el('span.vk-chip.vk-chip--count', { role: 'note', 'aria-label': c.label + ': ' + c.count }, kids);
      } else {
        n = VK.el('button.vk-chip', { type: 'button', tabindex: '-1' }, kids);
        if (c.kind === 'filter') n.setAttribute('aria-pressed', c.pressed ? 'true' : 'false');
        if (c.kind === 'remove') {
          n.classList.add('vk-chip--removable');
          n.setAttribute('aria-keyshortcuts', 'Delete Backspace');
          n.setAttribute('aria-label', c.label + (c.count != null ? ' (' + c.count + ')' : '') + ' — eltávolítás: Delete');
          var x = VK.el('span.vk-chip__x', { 'aria-hidden': 'true', title: 'Eltávolítás' }, VK.icon('close'));
          n.appendChild(x);
        } else if (c.count != null) n.setAttribute('aria-label', c.label + ', ' + c.count + ' elem');
        if (c.disabled) n.disabled = true;
      }
      if (c.color) n.style.setProperty('--vk-chip-c', 'var(' + c.color + ')');
      n.dataset.id = c.id;
      c.node = n;
      return n;
    }

    function find(id) { return chips.find(function (c) { return c.id === id; }) || null; }
    function pressedIds() { return chips.filter(function (c) { return c.kind === 'filter' && c.pressed; }).map(function (c) { return c.id; }); }
    function syncMinis() { minis.forEach(function (m) { refreshMini(m); }); }

    function add(def, before) {
      var c = Object.assign({ kind: 'filter' }, def); if (!c.id) c.id = VK.uid('chip');
      chips.push(c);
      el.insertBefore(node(c), before || addBtn || live);
      rov.update(); syncMinis();
      return c;
    }
    function remove(id, viaKey) {
      var c = find(id); if (!c) return;
      var items = focusables(), i = items.indexOf(c.node);
      chips = chips.filter(function (x) { return x !== c; });
      c.node.remove();
      live.textContent = '„' + c.label + '” eltávolítva';
      if (o.onRemove) o.onRemove(c);
      VK.fire(el, 'chip', { type: 'remove', chip: c });
      rov.update(); syncMinis();
      if (viaKey) {
        var rest = focusables();
        var next = rest[Math.min(i, rest.length - 1)];
        if (next) { rest.forEach(function (n) { n.tabIndex = n === next ? 0 : -1; }); next.focus(); }
      }
    }
    function toggle(c, v) {
      c.pressed = v === undefined ? !c.pressed : !!v;
      c.node.setAttribute('aria-pressed', c.pressed ? 'true' : 'false');
      if (o.onChange) o.onChange(c, c.pressed, pressedIds());
      VK.fire(el, 'chip', { type: 'toggle', chip: c, pressed: c.pressed });
      syncMinis();
    }
    function focusables() { return Array.prototype.filter.call(el.querySelectorAll('button.vk-chip'), function (n) { return !n.disabled && !n.hidden; }); }

    // ---- add chip ----
    if (o.add) {
      var addLabel = o.add.label || 'Új';
      addBtn = VK.el('button.vk-chip.vk-chip--add', { type: 'button', tabindex: '-1', 'aria-label': 'Hozzáadás: ' + addLabel, 'aria-haspopup': 'false' }, [VK.icon('plus'), VK.el('span', { text: addLabel })]);
      addBtn.addEventListener('click', openAdd);
    }
    function openAdd() {
      if (addInput) return;
      addInput = VK.el('input.vk-chip__input', { type: 'text', 'aria-label': 'Új ' + (o.add.label || 'elem').toLowerCase() + ' neve (Enter: hozzáad, Esc: mégse)',
        placeholder: o.add.placeholder || 'Új…', autocomplete: 'off' });
      addBtn.hidden = true;
      el.insertBefore(addInput, addBtn);
      addInput.addEventListener('keydown', function (e) {
        e.stopPropagation();
        if (e.key === 'Enter') { e.preventDefault(); commitAdd(true); }
        else if (e.key === 'Escape') { e.preventDefault(); closeAdd(true); }
      });
      addInput.addEventListener('input', function () { addInput.removeAttribute('aria-invalid'); addInput.title = ''; });
      addInput.addEventListener('blur', function () { if (addInput && !commitAdd(false)) closeAdd(false); });
      addInput.focus();
    }
    function commitAdd(byKey) {
      var name = addInput.value.trim();
      if (!name) { if (byKey) closeAdd(true); return !byKey ? false : true; }
      var dup = chips.some(function (c) { return c.label.toLowerCase() === name.toLowerCase(); });
      var msg = dup ? 'Már van ilyen: „' + name + '”' : (o.add.validate ? o.add.validate(name) : null);
      if (msg) { addInput.setAttribute('aria-invalid', 'true'); addInput.title = msg; live.textContent = msg; return false; }
      var def = o.add.onAdd ? o.add.onAdd(name) : { label: name, kind: 'remove' };
      if (def === false) return false;
      var c = add(def || { label: name, kind: 'remove' });
      live.textContent = '„' + c.label + '” hozzáadva';
      VK.fire(el, 'chip', { type: 'add', chip: c });
      closeAdd(byKey);
      return true;
    }
    function closeAdd(focusBack) {
      if (!addInput) return;
      var inp = addInput; addInput = null; inp.remove();
      addBtn.hidden = false; rov.update();
      if (focusBack) { focusables().forEach(function (n) { n.tabIndex = n === addBtn ? 0 : -1; }); addBtn.focus(); }
    }

    // ---- keys and clicks ----
    el.addEventListener('click', function (e) {
      var n = e.target.closest('button.vk-chip'); if (!n || !el.contains(n) || n === addBtn) return;
      var c = find(n.dataset.id); if (!c) return;
      if (c.kind === 'filter') toggle(c);
      else if (c.kind === 'remove' && e.target.closest('.vk-chip__x')) remove(c.id, true);
    });
    el.addEventListener('keydown', function (e) {
      if (e.target === addInput) return;
      var n = e.target.closest && e.target.closest('button.vk-chip'); if (!n) return;
      var c = find(n.dataset.id);
      if ((e.key === 'Delete' || e.key === 'Backspace') && c && c.kind === 'remove') { e.preventDefault(); remove(c.id, true); }
    });

    (o.chips || []).forEach(function (d) { var c = Object.assign({ kind: 'filter' }, d); if (!c.id) c.id = VK.uid('chip'); chips.push(c); el.appendChild(node(c)); });
    if (addBtn) el.appendChild(addBtn);
    el.appendChild(live);
    var rov = VK.focus.roving(el, { items: 'button.vk-chip', orientation: 'both', typeahead: true });

    function refreshMini(m) {
      var filters = chips.filter(function (c) { return c.kind === 'filter'; });
      var on = filters.filter(function (c) { return c.pressed; }).length;
      var narrowing = on < filters.length;
      m.dataset.label = (m._label || 'Szűrők') + ': ' + on + ' / ' + filters.length + ' aktív' + (narrowing ? ' — kattintás: mind' : '');
      m.title = m.dataset.label;
      VK.mini.set(m, { pressed: narrowing, value: String(on), progress: filters.length ? on / filters.length : 0 });
    }
    function reset() { chips.forEach(function (c) { if (c.kind === 'filter' && !c.pressed) toggle(c, true); }); }

    return {
      add: function (d) { return add(d); }, remove: function (id) { remove(id, false); }, get: find,
      set: function (id, patch) {
        var c = find(id); if (!c) return null;
        if ('pressed' in patch && c.kind === 'filter') { c.pressed = !!patch.pressed; c.node.setAttribute('aria-pressed', c.pressed ? 'true' : 'false'); }
        if ('count' in patch) { c.count = patch.count; var cn = c.node.querySelector('.vk-chip__count'); if (cn) cn.textContent = String(c.count); }
        syncMinis(); return c;
      },
      pressed: pressedIds, reset: reset,
      mini: function (mo) {
        mo = mo || {};
        var m = VK.mini.create({ icon: mo.icon || 'filter', label: mo.label || 'Szűrők', caption: mo.caption, size: mo.size, meter: mo.meter || 'ticks', onClick: reset });
        m._label = mo.label || 'Szűrők'; minis.push(m); refreshMini(m); return m;
      },
      destroy: function () { rov.destroy(); el.textContent = ''; }
    };
  }

  VK.chip = { mount: mount };
})(typeof window !== 'undefined' ? window : globalThis);
