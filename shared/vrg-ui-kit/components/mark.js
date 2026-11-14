/* VRG UI Kit — components/mark.js — build v1.1 marks (mark.css draws them).
     VK.mark.lamp('warn', 'git: 3 fájl')        → <span class="vk-lamp" data-tone="warn">git: 3 fájl</span> (no text: role=img + label)
     VK.mark.steps(6, 3, ['Bemenet', …])         → six pips, the first two done, the third current, with an aria label
     VK.mark.mono('PL', {running:true, level:'dev'})
     VK.mark.quiet(14)                           → "14 nap csend", tone warn from 7 days, crit from 21 (VK.mark.QUIET)
     VK.mark.count(3, {tone:'activity'})
   Depends on: core.js. */
(function (root) {
  'use strict';
  var VK = root.VK = root.VK || {};
  if (VK.mark) return;

  var LAMP = { ok: 'rendben', warn: 'figyelmeztetés', crit: 'hiba', off: 'nem fut', run: 'fut' };
  var QUIET = { warn: 7, crit: 21 };

  function lamp(tone, text, o) {
    o = o || {};
    var el = VK.el('span.vk-lamp');
    el.dataset.tone = LAMP[tone] ? tone : 'off';
    if (o.size && o.size !== 'md') el.dataset.size = o.size;
    if (text) el.textContent = text; else { el.setAttribute('role', 'img'); el.setAttribute('aria-label', o.label || LAMP[el.dataset.tone]); }
    return el;
  }
  /** n steps, cur = 1-based current step (0 = not started, n+1 = all done) */
  function steps(n, cur, names, o) {
    o = o || {};
    var el = VK.el('span.vk-pips');
    el.setAttribute('role', 'img');
    if (o.size && o.size !== 'md') el.dataset.size = o.size;
    for (var i = 1; i <= n; i++) {
      var p = VK.el('i');
      if (i < cur) p.dataset.s = 'done'; else if (i === cur) p.dataset.s = 'cur';
      if (names && names[i - 1]) p.title = names[i - 1];
      el.appendChild(p);
    }
    var now = cur > n ? 'kész' : cur < 1 ? 'nincs elkezdve' : cur + '. lépés a ' + n + '-ból' + (names && names[cur - 1] ? ': ' + names[cur - 1] : '');
    el.setAttribute('aria-label', o.label || now);
    return el;
  }
  function mono(text, o) {
    o = o || {};
    var el = VK.el('span.vk-mono');
    el.textContent = String(text || '·').slice(0, 2);
    if (o.size && o.size !== 'md') el.dataset.size = o.size;
    if (o.running) el.dataset.running = '';
    if (o.ghost) el.dataset.ghost = '';
    if (o.level && o.level !== 'user') el.dataset.vkLevel = o.level;
    if (o.label) { el.setAttribute('role', 'img'); el.setAttribute('aria-label', o.label); }
    return el;
  }
  function quietTone(days) { return days >= QUIET.crit ? 'crit' : days >= QUIET.warn ? 'warn' : ''; }
  function quiet(days, o) {
    o = o || {};
    var el = VK.el('span.vk-quiet');
    var t = quietTone(days); if (t) el.dataset.tone = t;
    el.textContent = o.label || (days + ' nap csend');
    return el;
  }
  function count(n, o) {
    o = o || {};
    var el = VK.el('span.vk-count');
    el.textContent = n > 99 ? '99+' : String(n);
    if (o.tone) el.dataset.tone = o.tone;
    el.setAttribute('aria-label', o.label || (n + ' új'));
    return el;
  }

  VK.mark = { LAMP: LAMP, QUIET: QUIET, lamp: lamp, steps: steps, mono: mono, quiet: quiet, quietTone: quietTone, count: count };
})(typeof window !== 'undefined' ? window : globalThis);
