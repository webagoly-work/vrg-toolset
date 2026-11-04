/* VRG UI Kit — components/badge.js — build and update state badges (badge.css draws them).
     VK.badge.create('dev', {variant:'solid', size:'sm', label:'fejl.'})  → <span class="vk-badge" data-state="dev">…
     VK.badge.set(el, 'ended')                                          → state + default Hungarian label
     VK.badge.STATES  {inuse:'használatban', …}   VK.badge.LIFECYCLE / VK.badge.RUN  (ordered keys)
   Depends on: core.js. */
(function (root) {
  'use strict';
  var VK = root.VK = root.VK || {};
  if (VK.badge) return;

  var STATES = { inuse: 'használatban', built: 'kész', dev: 'fejlesztés alatt', planned: 'tervezett', idea: 'ötlet',
    active: 'aktív', waiting: 'várakozik', parked: 'parkolva', ended: 'lezárva' };
  var LIFECYCLE = ['inuse', 'built', 'dev', 'planned', 'idea'];
  var RUN = ['active', 'waiting', 'parked', 'ended'];

  /** o: {variant:'outline'|'solid'|'dot', size:'sm'|'md'|'lg', label: text (default: the Hungarian state name), glyphOnly} */
  function create(state, o) {
    o = o || {};
    var b = VK.el('span.vk-badge');
    if (o.variant && o.variant !== 'outline') b.dataset.variant = o.variant;
    if (o.size && o.size !== 'md') b.dataset.size = o.size;
    set(b, state, o);
    return b;
  }
  function set(b, state, o) {
    o = o || {};
    b.dataset.state = state;
    var label = o.label !== undefined ? o.label : (STATES[state] || state);
    if (o.glyphOnly) { b.textContent = ''; b.setAttribute('role', 'img'); b.setAttribute('aria-label', label); }
    else b.textContent = label;
    return b;
  }

  VK.badge = { STATES: STATES, LIFECYCLE: LIFECYCLE, RUN: RUN, create: create, set: set };
})(typeof window !== 'undefined' ? window : globalThis);
