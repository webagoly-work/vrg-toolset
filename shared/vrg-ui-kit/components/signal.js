/* VRG UI Kit — components/signal.js — build signal markers (signal.css draws them).
     VK.signal.marker('gap', 'hiányzó védőföld')   inline marker (text defaults to the Hungarian signal name)
     VK.signal.flag('frozen')                      corner flag (role=img, aria-label); VK.signal.flags(host, ['gap','frozen'])
     VK.signal.count('contradiction', 3)           count chip; VK.signal.setCount(chip, 0) (data-zero, blip on change)
     VK.signal.KINDS  {contradiction:'ellentmondás', gap:'hiány', frozen:'fagyott'}
   Depends on: core.js, the sprite (icons contradiction / gap / frozen). */
(function (root) {
  'use strict';
  var VK = root.VK = root.VK || {};
  if (VK.signal) return;

  var KINDS = { contradiction: 'ellentmondás', gap: 'hiány', frozen: 'fagyott' };

  function marker(kind, text) {
    return VK.el('span.vk-signal', { 'data-signal': kind }, [VK.icon(kind), text || KINDS[kind] || kind]);
  }
  function flag(kind, label) {
    var name = label || KINDS[kind] || kind;
    return VK.el('span.vk-signal-flag', { 'data-signal': kind, role: 'img', 'aria-label': name, title: name }, [VK.icon(kind)]);
  }
  /** replace the corner flags of a host element; kinds = [] removes them */
  function flags(host, kinds) {
    host.classList.add('vk-signal-host');
    var box = host.querySelector(':scope > .vk-signal-flags');
    if (box) box.remove();
    if (!kinds || !kinds.length) return null;
    box = VK.el('span.vk-signal-flags', null, kinds.map(function (k) { return flag(k); }));
    host.appendChild(box);
    return box;
  }
  function count(kind, n) {
    var c = VK.el('span.vk-signal-count', { 'data-signal': kind }, [VK.icon(kind), VK.el('b', { 'aria-hidden': 'true' }), VK.el('span.vk-sr-only')]);
    setCount(c, n, true);
    return c;
  }
  function setCount(c, n, quiet) {
    n = Math.max(0, n | 0);
    var b = c.querySelector('b'), sr = c.querySelector('.vk-sr-only'), kind = c.dataset.signal;
    var prev = b.textContent;
    b.textContent = String(n);
    if (sr) sr.textContent = n + ' ' + (KINDS[kind] || kind);
    c.title = n + ' ' + (KINDS[kind] || kind);
    if (n === 0) c.setAttribute('data-zero', ''); else c.removeAttribute('data-zero');
    if (!quiet && prev !== String(n) && !VK.reducedMotion()) {
      c.removeAttribute('data-changed'); void c.offsetWidth; c.setAttribute('data-changed', '');
    }
    return c;
  }

  VK.signal = { KINDS: KINDS, marker: marker, flag: flag, flags: flags, count: count, setCount: setCount };
})(typeof window !== 'undefined' ? window : globalThis);
