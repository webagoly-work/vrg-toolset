/* VRG UI Kit — components/loader.js — build loaders (loader.css draws them).
     VK.loader.create('ring'|'dots'|'fade'|'ball'|'clock'|'bars', {label:'Betöltés…', size:'sm'|'md'|'lg'|'xl', decorative:false})
       → <span class="vk-loader" role="status"> with its child spans and a visually hidden label.
       decorative:true → aria-hidden (when a surrounding block already says "loading").
     VK.loader.KINDS  {ring:'gyűrű', …}   (Hungarian names, for sheets and menus)
   Depends on: core.js. */
(function (root) {
  'use strict';
  var VK = root.VK = root.VK || {};
  if (VK.loader) return;

  var KINDS = { ring: 'gyűrű', dots: 'pontok', fade: 'halványuló körök', ball: 'pattogó labda', clock: 'óra', bars: 'jelszint' };
  var SPANS = { ring: 0, dots: 3, fade: 8, ball: 1, clock: 2, bars: 4 };

  function create(kind, o) {
    o = o || {};
    kind = SPANS[kind] === undefined ? 'ring' : kind;
    var l = VK.el('span.vk-loader', { 'data-kind': kind });
    if (o.size && o.size !== 'md') l.dataset.size = o.size;
    for (var i = 0; i < SPANS[kind]; i++) l.appendChild(VK.el('span', { 'aria-hidden': 'true' }));
    if (o.decorative) l.setAttribute('aria-hidden', 'true');
    else { l.setAttribute('role', 'status'); l.appendChild(VK.el('span.vk-sr-only', { text: o.label || 'Betöltés…' })); }
    return l;
  }

  VK.loader = { KINDS: KINDS, create: create };
})(typeof window !== 'undefined' ? window : globalThis);
