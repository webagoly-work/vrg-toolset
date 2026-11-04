/* VRG UI Kit — components/mini.js — create and update MINIs (icon = button = progress).
     var m = VK.mini.create({icon:'refresh', label:'Szinkron', caption:'SYNC', meter:'ring', size:'md', onClick:fn})
     VK.mini.set(m, {progress:.42, state:'running'})   // progress 0…1, or null = indeterminate
     VK.mini.fromAction(action, ctx)                    // a mini for a registry action (uses action.progress/state)
   Keeps aria-label = "<label> — 42%" / "— kész" / "— hiba" so screen readers hear the state.
   Depends on: core.js. Optional: actions.js (fromAction). */
(function (root) {
  'use strict';
  var VK = root.VK = root.VK || {};
  if (VK.mini) return;

  var STATE_HU = { running: 'fut', done: 'kész', error: 'hiba', waiting: 'várakozik', paused: 'szünetel', off: 'kikapcsolva' };

  function create(o) {
    o = o || {};
    var b = VK.el('button.vk-mini', { type: 'button' });
    b.appendChild(VK.icon(o.icon || 'dot'));
    if (o.caption) b.appendChild(VK.el('span.vk-mini__cap', { 'aria-hidden': 'true', text: o.caption }));
    if (o.meter) b.dataset.meter = o.meter;
    if (o.size) b.dataset.size = o.size;
    if (o.pressed !== undefined) b.setAttribute('aria-pressed', o.pressed ? 'true' : 'false');
    b.dataset.label = o.label || '';
    b.title = o.label || '';
    if (o.onClick) b.addEventListener('click', o.onClick);
    set(b, { progress: o.progress, state: o.state, value: o.value });
    return b;
  }

  /** update a mini. opts: {progress: 0…1 | null, state, value: short text shown inside instead of the icon, pressed} */
  function set(b, o) {
    o = o || {};
    if ('state' in o) { if (o.state && o.state !== 'idle') b.dataset.state = o.state; else delete b.dataset.state; }
    if ('progress' in o) {
      if (o.progress === null) { b.style.removeProperty('--vk-p'); b.setAttribute('data-indeterminate', ''); }
      else if (o.progress !== undefined) { b.removeAttribute('data-indeterminate'); b.style.setProperty('--vk-p', String(VK.clamp(+o.progress || 0, 0, 1))); }
    }
    if ('pressed' in o) b.setAttribute('aria-pressed', o.pressed ? 'true' : 'false');
    if ('value' in o) {
      var v = b.querySelector('.vk-mini__val');
      if (o.value === undefined || o.value === null || o.value === '') { if (v) v.remove(); }
      else { if (!v) { v = VK.el('span.vk-mini__val', { 'aria-hidden': 'true' }); b.appendChild(v); } v.textContent = o.value; }
    }
    var label = b.dataset.label || '', st = b.dataset.state, p = b.style.getPropertyValue('--vk-p');
    var tail = st === 'running' && p !== '' ? Math.round(parseFloat(p) * 100) + '%' : STATE_HU[st] || '';
    b.setAttribute('aria-label', tail ? label + ' — ' + tail : label);
    return b;
  }

  /** a mini bound to a registry action: click runs it; action.progress(ctx) / action.state(ctx) drive the meter */
  function fromAction(a, ctx) {
    if (typeof a === 'string') a = VK.actions.get(a);
    var b = create({ icon: a.icon, label: a.label, caption: a.caption, onClick: function () { VK.actions.run(a.id); refresh(b, a); } });
    b.dataset.action = a.id;
    refresh(b, a, ctx);
    return b;
  }
  function refresh(b, a, ctx) {
    ctx = ctx || (VK.actions ? VK.actions.ctx() : {});
    var o = {};
    if (a.progress) { try { o.progress = a.progress(ctx); } catch (e) { /* keep last */ } }
    if (a.state) { try { o.state = a.state(ctx); } catch (e) { /* keep last */ } }
    if (a.checked) o.pressed = VK.actions.checked(a, ctx);
    var on = VK.actions ? VK.actions.enabled(a, ctx) : true;
    b.disabled = !on;
    return set(b, o);
  }

  VK.mini = { create: create, set: set, fromAction: fromAction, refresh: refresh };
})(typeof window !== 'undefined' ? window : globalThis);
