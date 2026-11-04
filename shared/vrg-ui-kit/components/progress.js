/* VRG UI Kit — components/progress.js — build progress elements and keep their ARIA in sync (progress.css draws them).
     var p = VK.progress.create({label:'Export', value:42, max:100, text:'17 / 40 áramkör', variant:'bar'|'segments', segments:12,
                                 scale:true, size:'sm'|'lg'})
     VK.progress.set(p, 64, {text, state:'done'|'error'|'paused'|null})   value null = indeterminate
     var m = VK.progress.meter({label:'Hűtő terhelés', value:73, max:100, unit:'%', warn:70, crit:90})  thin inline meter
     VK.progress.set(m, 92)                                                   level follows warn/crit
     var s = VK.progress.steps({label:'Export lépései', steps:['Beolvasás','Ellenőrzés',…], current:2})
     VK.progress.step(s, 3, {error:false})                                    move the current step (0-based); index = count → all done
   Every form is role=progressbar (meter: role=meter) with aria-valuenow / aria-valuetext.
   Numbers use the Hungarian decimal comma. Depends on: core.js. */
(function (root) {
  'use strict';
  var VK = root.VK = root.VK || {};
  if (VK.progress) return;

  function fmt(n, digits) { return (digits ? n.toFixed(digits) : String(Math.round(n))).replace('.', ','); }

  function create(o) {
    o = o || {};
    var p = VK.el('div.vk-progress', { role: 'progressbar', 'aria-label': o.label || 'Folyamat', 'aria-valuemin': 0 });
    if (o.variant && o.variant !== 'bar') p.dataset.variant = o.variant;
    if (o.segments) p.style.setProperty('--vk-progress-n', String(o.segments));
    if (o.scale) p.setAttribute('data-scale', '');
    if (o.size) p.dataset.size = o.size;
    p.dataset.max = String(o.max || (o.variant === 'segments' && o.segments) || 100);
    if (o.unit) p.dataset.unit = o.unit;
    VK.append(p, [VK.el('span.vk-progress__label', { 'aria-hidden': 'true', text: o.label || '' }), VK.el('span.vk-progress__val', { 'aria-hidden': 'true' }),
      VK.el('span.vk-progress__track', null, VK.el('span.vk-progress__bar'))]);
    set(p, o.value === undefined ? 0 : o.value, { text: o.text, state: o.state });
    return p;
  }

  function meter(o) {
    o = o || {};
    var m = VK.el('span.vk-meter', { role: 'meter', 'aria-label': o.label || 'Mérő', 'aria-valuemin': 0 });
    m.dataset.max = String(o.max || 100);
    if (o.unit !== undefined) m.dataset.unit = o.unit;
    if (o.warn !== undefined) { m.dataset.warn = o.warn; m.style.setProperty('--_t', String(o.warn / (o.max || 100))); }
    if (o.crit !== undefined) m.dataset.crit = o.crit;
    if (o.tone) m.dataset.tone = o.tone;
    VK.append(m, [VK.el('span.vk-meter__track', { 'aria-hidden': 'true' }, VK.el('span.vk-meter__fill')), VK.el('span.vk-meter__val', { 'aria-hidden': 'true' })]);
    set(m, o.value || 0, { text: o.text });
    return m;
  }

  /** set the value of a bar, segmented bar or meter. value null → indeterminate (bars only). */
  function set(el, value, o) {
    o = o || {};
    var max = +el.dataset.max || 100, isMeter = el.classList.contains('vk-meter');
    var val = el.querySelector(isMeter ? '.vk-meter__val' : '.vk-progress__val');
    if ('state' in o) { if (o.state) el.dataset.state = o.state; else delete el.dataset.state; }
    if (value === null && !isMeter) {
      el.setAttribute('data-indeterminate', '');
      el.removeAttribute('aria-valuenow'); el.removeAttribute('aria-valuemax');
      el.setAttribute('aria-valuetext', o.text || 'folyamatban');
      el.setAttribute('aria-busy', 'true');
      if (val) val.textContent = '—';
      return el;
    }
    el.removeAttribute('data-indeterminate'); el.removeAttribute('aria-busy');
    var v = VK.clamp(+value || 0, 0, max), frac = v / max;
    el.setAttribute('aria-valuemax', max); el.setAttribute('aria-valuenow', +v.toFixed(2));
    el.style.setProperty('--vk-p', String(+frac.toFixed(4)));
    var unit = el.dataset.unit, shown;
    if (el.dataset.variant === 'segments') shown = fmt(v) + ' / ' + max;
    else if (unit !== undefined && unit !== '%') shown = fmt(v, v % 1 ? 1 : 0) + (unit ? ' ' + unit : '');
    else shown = fmt(frac * 100) + '%';
    if (val) val.textContent = shown;
    var stateHu = { done: 'kész', error: 'hiba', paused: 'szünetel' }[el.dataset.state];
    el.setAttribute('aria-valuetext', shown + (o.text ? ' — ' + o.text : '') + (stateHu ? ' — ' + stateHu : ''));
    if (isMeter && el.dataset.tone) el.dataset.level = el.dataset.tone;
    if (isMeter && !el.dataset.tone) {
      var w = el.dataset.warn, c = el.dataset.crit;
      el.dataset.level = c !== undefined && v >= +c ? 'crit' : w !== undefined && v >= +w ? 'warn' : 'ok';
      if (el.dataset.level === 'crit') el.setAttribute('aria-valuetext', shown + ' — kritikus' + (o.text ? ' — ' + o.text : ''));
      else if (el.dataset.level === 'warn') el.setAttribute('aria-valuetext', shown + ' — figyelem' + (o.text ? ' — ' + o.text : ''));
    }
    return el;
  }

  function steps(o) {
    o = o || {};
    var s = VK.el('div.vk-steps');
    var ol = VK.el('ol.vk-steps__list', { 'aria-label': o.label || 'Lépések' });
    (o.steps || []).forEach(function (t) {
      ol.appendChild(VK.el('li.vk-steps__item', null, [VK.el('span.vk-steps__mark', { 'aria-hidden': 'true' }),
        VK.el('span.vk-steps__label', { text: t }), VK.el('span.vk-sr-only')]));
    });
    var meterEl = VK.el('span.vk-steps__meter', { role: 'progressbar', 'aria-label': o.label || 'Lépések', 'aria-valuemin': 0 });
    VK.append(s, [ol, meterEl]);
    step(s, o.current || 0, { error: o.error });
    return s;
  }
  /** make step i current (0-based); i >= count → everything done; opts.error marks step i as failed */
  function step(s, i, o) {
    o = o || {};
    var items = Array.prototype.slice.call(s.querySelectorAll('.vk-steps__item')), n = items.length;
    i = VK.clamp(i, 0, n);
    items.forEach(function (li, k) {
      var st = k < i ? 'done' : k === i ? (o.error ? 'error' : 'current') : 'todo';
      li.dataset.state = st;
      if (k === i && i < n) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
      var sr = li.querySelector('.vk-sr-only');
      if (sr) sr.textContent = ' — ' + { done: 'kész', current: 'folyamatban', todo: 'hátravan', error: 'hiba' }[st];
    });
    var m = s.querySelector('.vk-steps__meter');
    if (m) {
      var shown = Math.min(i + 1, n);
      m.setAttribute('aria-valuemax', n); m.setAttribute('aria-valuenow', i);
      var label = items[Math.min(i, n - 1)] ? items[Math.min(i, n - 1)].querySelector('.vk-steps__label').textContent : '';
      m.setAttribute('aria-valuetext', i >= n ? 'Minden lépés kész (' + n + ')' : shown + '. lépés, összesen ' + n + ': ' + label + (o.error ? ' — hiba' : ''));
      m.textContent = (i >= n ? 'KÉSZ ' : '') + String(shown).padStart(2, '0') + '/' + String(n).padStart(2, '0');
    }
    return s;
  }

  VK.progress = { create: create, set: set, meter: meter, steps: steps, step: step, fmt: fmt };
})(typeof window !== 'undefined' ? window : globalThis);
