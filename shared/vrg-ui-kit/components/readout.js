/* VRG UI Kit — components/readout.js — build and update HUD stat blocks (readout.css draws them).
     var r = VK.readout.create({
       label:'Áramkör', code:'№ 49', tag:'CH 04 // AKTÍV', tagTone:'activity',
       value:16, digits:1, unit:'A', delta:'+0,4 A / 5 p',
       min:0, max:25, warn:17.5, crit:22.5, ticks:[0, 12.5, 25],      // ruler (omit max for no ruler)
       tally:[{n:75, label:'OK', tone:'ok'}, {n:62, label:'FIGY', tone:'warn'}, {n:15, label:'HIBA', tone:'crit'}],
       list:[{name:'L1 fázis', value:'230 V', state:'inuse', label:'használatban'}] })
     VK.readout.update(r, {value:17.2, tally:[…]})   any subset of the same fields
   The ruler is role=meter with aria-valuetext; the block is role=group labelled "<label> <code>".
   Depends on: core.js, badge.js (status list glyphs). */
(function (root) {
  'use strict';
  var VK = root.VK = root.VK || {};
  if (VK.readout) return;

  function num(v, d) { return (d ? (+v).toFixed(d) : String(Math.round(+v))).replace('.', ','); }

  function create(o) {
    var r = VK.el('section.vk-readout', { role: 'group' });
    r._vk = {};
    update(r, o || {});
    return r;
  }

  function update(r, o) {
    var s = r._vk = Object.assign(r._vk || {}, o);
    r.setAttribute('aria-label', [s.label, s.code].filter(Boolean).join(' '));
    r.textContent = '';
    var tag = s.tag ? VK.el('span.vk-readout__tag', { text: s.tag, 'data-tone': s.tagTone || null }) : null;
    r.appendChild(VK.el('header.vk-readout__head', null, [VK.el('span.vk-readout__label', { text: s.label || '' }),
      s.code ? VK.el('span.vk-readout__code', { text: s.code }) : null, tag]));
    if (s.value !== undefined) {
      r.appendChild(VK.el('p.vk-readout__main', null, [VK.el('span.vk-readout__value', { text: typeof s.value === 'number' ? num(s.value, s.digits) : s.value }),
        s.unit ? VK.el('span.vk-readout__unit', { text: s.unit }) : null, s.delta ? VK.el('span.vk-readout__delta', { text: s.delta }) : null]));
    }
    if (s.max !== undefined && typeof s.value === 'number') {
      var min = s.min || 0, span = (s.max - min) || 1, p = VK.clamp((s.value - min) / span, 0, 1);
      var w = s.warn !== undefined ? VK.clamp((s.warn - min) / span, 0, 1) : 2, x = s.crit !== undefined ? VK.clamp((s.crit - min) / span, 0, 1) : 2;
      var zone = s.crit !== undefined && s.value >= s.crit ? 'kritikus' : s.warn !== undefined && s.value >= s.warn ? 'figyelem' : 'rendben';
      var ruler = VK.el('div.vk-readout__ruler', { role: 'meter', 'aria-label': (s.label || '') + ' mérő', 'aria-valuemin': min, 'aria-valuemax': s.max,
        'aria-valuenow': s.value, 'aria-valuetext': num(s.value, s.digits) + (s.unit ? ' ' + s.unit : '') + ' — ' + zone }, VK.el('span.vk-readout__marker'));
      ruler.style.setProperty('--vk-p', p.toFixed(4)); ruler.style.setProperty('--_w', String(w)); ruler.style.setProperty('--_x', String(x));
      r.appendChild(ruler);
      var ticks = s.ticks || [min, min + span / 2, s.max];
      r.appendChild(VK.el('div.vk-readout__scale', { 'aria-hidden': 'true' }, ticks.map(function (t, i) {
        return VK.el('span', { text: num(t, t % 1 ? 1 : 0) + (i === ticks.length - 1 && s.unit ? ' ' + s.unit : '') });
      })));
    }
    if (s.tally && s.tally.length) {
      var tal = VK.el('div.vk-readout__tally', { role: 'list', 'aria-label': 'Összesítés' });
      tal.style.setProperty('--_n', String(s.tally.length));
      s.tally.forEach(function (t) {
        tal.appendChild(VK.el('span.vk-readout__cell', { role: 'listitem', 'data-tone': t.tone || null }, [VK.el('b', { text: String(t.n) }), VK.el('i', { text: t.label })]));
      });
      var stack = VK.el('span.vk-readout__stack', { 'aria-hidden': 'true' });
      s.tally.forEach(function (t) { var seg = VK.el('span', { 'data-tone': t.tone || null }); seg.style.setProperty('--_f', String(t.n)); stack.appendChild(seg); });
      tal.appendChild(stack);
      r.appendChild(tal);
    }
    if (s.list && s.list.length) {
      r.appendChild(VK.el('ul.vk-readout__list', null, s.list.map(function (it) {
        var b = VK.badge ? VK.badge.create(it.state, { variant: 'dot', size: 'sm', label: it.label })
          : VK.el('span.vk-badge', { 'data-variant': 'dot', 'data-size': 'sm', 'data-state': it.state, text: it.label || it.state });
        return VK.el('li', null, [VK.el('span.vk-readout__name', { text: it.name }), VK.el('span.vk-readout__val', { text: it.value || '' }), b]);
      })));
    }
    return r;
  }

  VK.readout = { create: create, update: update };
})(typeof window !== 'undefined' ? window : globalThis);
