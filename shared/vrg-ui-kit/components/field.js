/* VRG UI Kit — components/field.js — the behaviour field.css leaves to script.
     VK.field.setError(input, 'Kötelező mező.')   writes .vk-field__error, sets aria-invalid + aria-describedby
     VK.field.setError(input, null)              clears it (help text stays described)
     VK.field.tristate(parent, children)          parent checkbox ⇄ children: checked / indeterminate (mixed)
     VK.field.mountAll(root)                      wires every [data-vk="tristate"] (children = its aria-controls ids)
     VK.field.number(input)                       → number | NaN; accepts a Hungarian decimal comma ("2,5")
   Depends on: core.js. */
(function (root) {
  'use strict';
  var VK = root.VK = root.VK || {};
  if (VK.field) return;

  function holder(input) { return input.closest('.vk-field, .vk-fieldset') || input.parentNode; }
  function ids(v) { return (v || '').split(/\s+/).filter(Boolean); }

  /** show or clear the error of one control (input/select/textarea, or a fieldset for a group) */
  function setError(input, msg) {
    var h = holder(input), err = h.querySelector(':scope > .vk-field__error');
    var targets = input.tagName === 'FIELDSET' ? Array.prototype.slice.call(input.querySelectorAll('input, select, textarea')) : [input];
    if (!msg) {
      targets.forEach(function (t) {
        t.removeAttribute('aria-invalid');
        if (err) { var rest = ids(t.getAttribute('aria-describedby')).filter(function (x) { return x !== err.id; }); if (rest.length) t.setAttribute('aria-describedby', rest.join(' ')); else t.removeAttribute('aria-describedby'); }
      });
      if (err) err.textContent = '';
      return input;
    }
    if (!err) {
      err = VK.el('p.vk-field__error', { id: VK.uid('vk-err') });
      h.appendChild(err);
    }
    if (!err.id) err.id = VK.uid('vk-err');
    err.textContent = '';
    err.appendChild(VK.icon('warning'));
    err.appendChild(VK.el('span', { text: msg }));
    targets.forEach(function (t) {
      t.setAttribute('aria-invalid', 'true');
      var d = ids(t.getAttribute('aria-describedby')); if (d.indexOf(err.id) < 0) d.push(err.id);
      t.setAttribute('aria-describedby', d.join(' '));
    });
    return input;
  }

  /** a parent checkbox that reflects and drives a set of children (tri-state). Returns {update, destroy}. */
  function tristate(parent, children) {
    children = Array.prototype.slice.call(children || []);
    if (!parent.getAttribute('aria-controls')) parent.setAttribute('aria-controls', children.map(function (c) { if (!c.id) c.id = VK.uid('vk-cb'); return c.id; }).join(' '));
    function live() { return children.filter(function (c) { return !c.disabled; }); }
    function update() {
      var on = live().filter(function (c) { return c.checked; }).length, n = live().length;
      parent.checked = n > 0 && on === n;
      parent.indeterminate = on > 0 && on < n;
    }
    function onParent() { var v = parent.checked; live().forEach(function (c) { c.checked = v; c.dispatchEvent(new Event('change', { bubbles: true })); }); update(); }
    parent.addEventListener('change', onParent);
    children.forEach(function (c) { c.addEventListener('change', update); });
    update();
    return { update: update, destroy: function () { parent.removeEventListener('change', onParent); children.forEach(function (c) { c.removeEventListener('change', update); }); } };
  }

  function mountAll(scope) {
    var out = [];
    (scope || document).querySelectorAll('input[type="checkbox"][data-vk="tristate"]').forEach(function (p) {
      if (p._vkTri) return;
      var kids = ids(p.getAttribute('aria-controls')).map(function (id) { return document.getElementById(id); }).filter(Boolean);
      p._vkTri = tristate(p, kids); out.push(p._vkTri);
    });
    return out;
  }

  function number(input) {
    var s = String(input && input.value !== undefined ? input.value : input).trim().replace(/\s/g, '').replace(',', '.');
    return s === '' ? NaN : Number(s);
  }

  VK.field = { setError: setError, tristate: tristate, mountAll: mountAll, number: number };
})(typeof window !== 'undefined' ? window : globalThis);
