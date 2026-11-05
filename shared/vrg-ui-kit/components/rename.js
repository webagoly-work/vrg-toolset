/* VRG UI Kit — components/rename.js — inline rename (F2 or double-click).
     var r = VK.rename.attach(listEl, {
       item: '[role="option"]',            // the focusable rows (F2 on a focused row starts the rename)
       label: '.name',                     // the text element inside a row that turns into the input
       names: function (item) { return [...] },   // existing names, for the duplicate check (case-insensitive)
       validate: function (name, item) { return 'üzenet' | null },   // extra rule (after the built-in ones)
       onCommit: function (item, name, old) {}    // after a valid change; return false to refuse
     }) → { start(item), destroy() }
     VK.rename.start(labelEl, opts) → { commit(), cancel() }   // one-off, programmatic
   Enter commits · Esc cancels · blur commits (an invalid value on blur is dropped, the old name stays) ·
   the name is selected without its extension ("Kötőelem-összesítő" of "Kötőelem-összesítő.xlsx").
   Built-in rules: not empty, no / \ : * ? " < > |, not a duplicate. The message is a popover tied to the
   input with aria-describedby + aria-invalid. Suggested registry action: 'item.rename' (keys F2).
   Fires 'vk:rename' {name, old} on the label. Depends on: core.js. */
(function (root) {
  'use strict';
  var VK = root.VK = root.VK || {};
  if (VK.rename) return;

  var BAD = /[\/\\:*?"<>|]/;

  function check(name, old, opts, item) {
    if (!name.trim()) return 'A név nem lehet üres.';
    var bad = name.match(BAD); if (bad) return 'Nem használható karakter: ' + bad[0] + '  (tiltott: / \\ : * ? " < > |)';
    if (opts.names) {
      var low = name.trim().toLowerCase();
      var dup = (opts.names(item) || []).some(function (n) { return n !== old && String(n).toLowerCase() === low; });
      if (dup) return 'Már van ilyen nevű elem: „' + name.trim() + '”.';
    }
    if (opts.validate) { var m = opts.validate(name.trim(), item); if (m) return m; }
    return null;
  }

  /** turn labelEl into an input in place */
  function start(labelEl, opts) {
    opts = opts || {};
    if (labelEl._vkRename) return labelEl._vkRename;
    var item = opts.item || labelEl;
    var old = opts.value !== undefined ? opts.value : labelEl.textContent;
    var focusBack = opts.focusBack || (item.matches && item.matches('[tabindex]') ? item : labelEl.closest('[tabindex]'));
    var savedNodes = Array.prototype.slice.call(labelEl.childNodes);
    var msgId = VK.uid('vk-rn');
    var input = VK.el('input.vk-rename__input', { type: 'text', spellcheck: 'false', autocomplete: 'off',
      'aria-label': opts.ariaLabel || 'Új név (Enter: mentés, Esc: mégse)' });
    var mirror = VK.el('span.vk-rename__mirror', { 'aria-hidden': 'true' });
    var msg = VK.el('div.vk-rename__msg', { id: msgId, role: 'alert', hidden: true });
    input.value = old;
    labelEl.dataset.renaming = '';
    labelEl.textContent = '';
    labelEl.appendChild(input); labelEl.appendChild(mirror);
    document.body.appendChild(msg);
    var done = false, byKey = false;

    function size() {
      mirror.textContent = input.value || ' ';
      input.style.width = Math.ceil(mirror.getBoundingClientRect().width + 6) + 'px';
      if (!msg.hidden) VK.place(msg, input, { side: 'bottom', align: 'start', offset: 4 });
    }
    function show(m) {
      if (m) {
        msg.textContent = ''; msg.appendChild(VK.icon('warning')); msg.appendChild(VK.el('span', { text: m }));
        msg.hidden = false; input.setAttribute('aria-invalid', 'true'); input.setAttribute('aria-describedby', msgId);
        VK.place(msg, input, { side: 'bottom', align: 'start', offset: 4 });
      } else { msg.hidden = true; input.removeAttribute('aria-invalid'); input.removeAttribute('aria-describedby'); }
    }
    function finish(name) {
      done = true;
      input.removeEventListener('blur', onBlur);
      msg.remove();
      labelEl.textContent = '';
      if (name === null) savedNodes.forEach(function (n) { labelEl.appendChild(n); });
      else labelEl.textContent = name;
      delete labelEl.dataset.renaming;
      labelEl._vkRename = null;
      if (byKey && focusBack && document.contains(focusBack)) focusBack.focus();
    }
    function commit() {
      if (done) return true;
      var name = input.value.trim();
      if (name === old) { finish(null); if (opts.onCancel) opts.onCancel(); return true; }
      var m = check(name, old, opts, item);
      if (m) { show(m); return false; }
      if (opts.onCommit && opts.onCommit(item, name, old) === false) { finish(null); return false; }
      finish(name);
      VK.fire(labelEl, 'rename', { name: name, old: old, item: item });
      return true;
    }
    function cancel() { if (done) return; finish(null); if (opts.onCancel) opts.onCancel(); }
    function onBlur() { if (done) return; if (!commit()) cancel(); }

    input.addEventListener('keydown', function (e) {
      e.stopPropagation();                                          // the row's own keys stay quiet while editing
      if (e.key === 'Enter') { e.preventDefault(); byKey = true; if (!commit()) byKey = false; }
      else if (e.key === 'Escape') { e.preventDefault(); byKey = true; cancel(); }
    });
    input.addEventListener('input', function () { size(); show(check(input.value, old, opts, item)); });
    input.addEventListener('blur', onBlur);
    input.addEventListener('click', function (e) { e.stopPropagation(); });
    input.addEventListener('dblclick', function (e) { e.stopPropagation(); });
    size();
    input.focus();
    var dot = old.lastIndexOf('.');
    if (dot > 0 && opts.selectStem !== false) input.setSelectionRange(0, dot); else input.select();
    labelEl._vkRename = { commit: commit, cancel: cancel, input: input };
    return labelEl._vkRename;
  }

  /** F2 / double-click rename on every row of a list */
  function attach(container, opts) {
    opts = opts || {};
    var itemSel = opts.item || '[role="option"], [role="treeitem"], [role="row"], li';
    function labelOf(item) { return opts.label ? item.querySelector(opts.label) : item; }
    function begin(item) {
      var lab = labelOf(item); if (!lab || item.getAttribute('aria-disabled') === 'true') return null;
      return start(lab, { item: item, focusBack: item, names: opts.names, validate: opts.validate, onCommit: opts.onCommit,
        onCancel: opts.onCancel, selectStem: opts.selectStem, ariaLabel: opts.ariaLabel });
    }
    function onKey(e) {
      if (e.key !== 'F2' || e.ctrlKey || e.altKey || e.metaKey) return;
      var item = e.target.closest && e.target.closest(itemSel);
      if (!item || !container.contains(item) || (VK.focus && VK.focus.isEditable(e.target))) return;
      e.preventDefault(); begin(item);
    }
    function onDbl(e) {
      var item = e.target.closest && e.target.closest(itemSel);
      if (!item || !container.contains(item)) return;
      var lab = labelOf(item); if (opts.label && lab && !lab.contains(e.target) && opts.labelOnly) return;
      e.preventDefault(); begin(item);
    }
    container.addEventListener('keydown', onKey);
    container.addEventListener('dblclick', onDbl);
    return { start: begin, destroy: function () { container.removeEventListener('keydown', onKey); container.removeEventListener('dblclick', onDbl); } };
  }

  VK.rename = { start: start, attach: attach, check: check };
})(typeof window !== 'undefined' ? window : globalThis);
