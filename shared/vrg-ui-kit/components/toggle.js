/* VRG UI Kit — components/toggle.js — switches (role=switch) with a busy state while a change applies.
     var t = VK.toggle.create({ label: 'Automatikus mentés', hint: '…', checked: true, size: 'md', labelSide: 'right',
                                disabled: false, block: false,
                                onChange: function (on) { return promise | false | undefined } })
       // a Promise → aria-busy + spinning arc until it settles; rejected/false → reverts, data-state="error"
     VK.toggle.enhance(button, opts)  wire an existing .vk-toggle button · VK.toggle.mountAll(root) → every [data-vk="toggle"]
     VK.toggle.set(t, {checked, busy, disabled, error})  · VK.toggle.get(t) → boolean
     VK.toggle.mini(t, {icon, caption}) → a MINI that mirrors t (pressed = on, running while busy) and toggles it
   Keys: Space / Enter toggle (native button). Fires 'vk:toggle' {checked} on the button. Depends on: core.js, mini.js. */
(function (root) {
  'use strict';
  var VK = root.VK = root.VK || {};
  if (VK.toggle) return;

  function create(o) {
    o = o || {};
    var b = VK.el('button.vk-toggle', { type: 'button', role: 'switch', 'aria-checked': o.checked ? 'true' : 'false' }, [
      VK.el('span.vk-toggle__track', { 'aria-hidden': 'true' }, VK.el('span.vk-toggle__thumb')),
      VK.el('span.vk-toggle__label', null, [o.label || '', o.hint ? VK.el('span.vk-toggle__hint', { text: o.hint }) : null])
    ]);
    if (o.size) b.dataset.size = o.size;
    if (o.labelSide === 'left') b.dataset.label = 'left';
    if (o.block) b.classList.add('vk-toggle--block');
    if (o.disabled) b.disabled = true;
    if (o.id) b.id = o.id;
    return enhance(b, o);
  }

  function ensureStatus(b) {
    var s = b.querySelector('.vk-toggle__status');
    if (!s) { s = VK.el('span.vk-toggle__status', { 'aria-live': 'polite' }); b.appendChild(s); }
    return s;
  }

  function set(b, o) {
    o = o || {};
    if ('checked' in o) b.setAttribute('aria-checked', o.checked ? 'true' : 'false');
    if ('disabled' in o) b.disabled = !!o.disabled;
    if ('busy' in o) {
      if (o.busy) { b.setAttribute('aria-busy', 'true'); ensureStatus(b).textContent = typeof o.busy === 'string' ? o.busy : 'alkalmazás…'; }
      else { b.removeAttribute('aria-busy'); var s = b.querySelector('.vk-toggle__status'); if (s && b.dataset.state !== 'error') s.textContent = ''; }
    }
    if ('error' in o) {
      if (o.error) { b.dataset.state = 'error'; ensureStatus(b).textContent = typeof o.error === 'string' ? o.error : 'hiba'; }
      else { delete b.dataset.state; if (!b.hasAttribute('aria-busy')) { var st = b.querySelector('.vk-toggle__status'); if (st) st.textContent = ''; } }
    }
    (b._vkMinis || []).forEach(function (m) { syncMini(b, m); });
    return b;
  }
  function get(b) { return b.getAttribute('aria-checked') === 'true'; }

  function enhance(b, o) {
    o = o || {};
    if (b._vkToggle) return b;
    b._vkToggle = true;
    if (!b.getAttribute('role')) b.setAttribute('role', 'switch');
    if (!b.hasAttribute('aria-checked')) b.setAttribute('aria-checked', 'false');
    b.addEventListener('click', function () {
      if (b.disabled || b.getAttribute('aria-busy') === 'true') return;
      var prev = get(b), next = !prev;
      set(b, { checked: next, error: false });
      var r = o.onChange ? o.onChange(next, b) : undefined;
      if (r && typeof r.then === 'function') {
        set(b, { busy: o.busyText || true });
        r.then(function (ok) {
          set(b, { busy: false });
          if (ok === false) { set(b, { checked: prev, error: o.errorText || 'nem sikerült' }); }
          else VK.fire(b, 'toggle', { checked: next });
        }, function (err) {
          set(b, { busy: false, checked: prev, error: (err && err.message) || o.errorText || 'nem sikerült' });
        });
      } else if (r === false) set(b, { checked: prev });
      else VK.fire(b, 'toggle', { checked: next });
    });
    return b;
  }

  function mountAll(scope) {
    return Array.prototype.map.call((scope || document).querySelectorAll('[data-vk="toggle"]'), function (b) { return enhance(b); });
  }

  function syncMini(b, m) {
    var busy = b.getAttribute('aria-busy') === 'true', err = b.dataset.state === 'error';
    VK.mini.set(m, { pressed: get(b), state: busy ? 'running' : err ? 'error' : get(b) ? 'idle' : 'off', progress: busy ? null : 0 });
    m.disabled = b.disabled;
  }
  function mini(b, o) {
    o = o || {};
    var lab = (b.querySelector('.vk-toggle__label') || b).firstChild;
    var m = VK.mini.create({ icon: o.icon || 'toggle', label: o.label || (lab ? lab.textContent.trim() : ''), caption: o.caption, size: o.size,
      onClick: function () { b.click(); } });
    (b._vkMinis = b._vkMinis || []).push(m);
    syncMini(b, m);
    return m;
  }

  VK.toggle = { create: create, enhance: enhance, mountAll: mountAll, set: set, get: get, mini: mini };
})(typeof window !== 'undefined' ? window : globalThis);
