/* VRG UI Kit — components/badge.js — build and update state badges (badge.css draws them).
     VK.badge.create('dev', {variant:'solid', size:'sm', label:'fejl.'})  → <span class="vk-badge" data-state="dev">…
     VK.badge.set(el, 'ended')                                          → state + default Hungarian label
     VK.badge.STATES  {inuse:'használatban', …}   VK.badge.LIFECYCLE / VK.badge.RUN / VK.badge.LINE  (ordered keys)
     VK.badge.stage('beta')                                             → a catalog stage (live beta dev planned idea retire)
   Depends on: core.js. */
(function (root) {
  'use strict';
  var VK = root.VK = root.VK || {};
  if (VK.badge) return;

  var STATES = { inuse: 'használatban', built: 'kész', dev: 'fejlesztés alatt', planned: 'tervezett', idea: 'ötlet',
    active: 'aktív', waiting: 'várakozik', parked: 'parkolva', ended: 'lezárva' };
  var LIFECYCLE = ['inuse', 'built', 'dev', 'planned', 'idea'];
  var RUN = ['active', 'waiting', 'parked', 'ended'];
  // v1.1: the dev-line states (Fejlesztési vonalak) and the catalog stage (vrg-catalog.json "status")
  STATES.beta = 'teszt'; STATES.retire = 'kivezetve';
  STATES.recurring = 'visszatérő'; STATES.overruled = 'felülbírálva'; STATES.absorbed = 'beolvadt'; STATES.personal = 'személyes';
  var LINE = ['active', 'waiting', 'recurring', 'parked', 'ended', 'overruled', 'absorbed', 'personal'];
  var STAGE = { live: 'inuse', beta: 'beta', dev: 'dev', planned: 'planned', idea: 'idea', retire: 'retire' };
  var STAGE_LABEL = { live: 'éles', beta: 'teszt', dev: 'fejlesztés', planned: 'tervezett', idea: 'ötlet', retire: 'kivezetve' };
  /** a catalog stage as a badge: VK.badge.stage('beta', {size:'sm'}) → "teszt" with the beta shape */
  function stage(status, o) {
    o = o || {};
    var s = STAGE[status] || 'idea';
    return create(s, { variant: o.variant, size: o.size, glyphOnly: o.glyphOnly, label: o.label !== undefined ? o.label : (STAGE_LABEL[status] || status) });
  }

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

  VK.badge = { STATES: STATES, LIFECYCLE: LIFECYCLE, RUN: RUN, LINE: LINE, STAGE: STAGE, STAGE_LABEL: STAGE_LABEL, create: create, set: set, stage: stage };
})(typeof window !== 'undefined' ? window : globalThis);
