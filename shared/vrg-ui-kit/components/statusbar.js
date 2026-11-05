/* VRG UI Kit — components/statusbar.js — the status bar renders registry surface 'statusbar' as minis + short text.
     var sb = VK.statusbar.mount(el, {
       surface: 'statusbar', label: 'Állapotsor',
       items: [{id:'cursor', key:'Kurzor', text:'12,40 · 3,85', side:'end', pin:false}]   // passive readouts
     })
     sb.refresh(actionId?)      re-read action.state/progress/statusText (call it from your progress loop)
     sb.setText(itemId, text, announce?) · sb.announce(msg) · sb.render() · sb.destroy()
   An action shows here when its `at` includes 'statusbar'. Extra (optional) action fields read by the status bar:
     statusText: ctx => '42%'        short mono text next to the mini (progress, mode, cursor, sync…)
     statusSide: 'start' | 'end'     group (default 'start')
     statusPin: true                 keep the text when the bar is narrow
   State changes (running → done/error …) are announced in a polite role=status live region; progress ticks are not.
   Keyboard: the bar is one toolbar tab stop; ←/→ between minis, Enter/Space runs the action.
   Depends on: core.js, focus.js, mini.js, actions.js. */
(function (root) {
  'use strict';
  var VK = root.VK = root.VK || {};
  if (VK.statusbar) return;

  var STATE_HU = { running: 'fut', done: 'kész', error: 'hiba', waiting: 'várakozik', paused: 'szünetel', off: 'kikapcsolva', idle: 'alaphelyzet' };

  function mount(el, opts) {
    opts = opts || {};
    var surface = opts.surface || 'statusbar';
    el.classList.add('vk-statusbar');
    el.setAttribute('role', 'toolbar');
    el.setAttribute('aria-label', opts.label || 'Állapotsor');
    if (!el.hasAttribute('data-vk-hop')) el.setAttribute('data-vk-hop', '');
    el.textContent = '';
    var start = VK.el('div.vk-statusbar__group'), end = VK.el('div.vk-statusbar__group.vk-statusbar__group--end');
    var live = VK.el('span.vk-sr-only', { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
    el.appendChild(start); el.appendChild(end); el.appendChild(live);
    var acts = {}, readouts = {}, rov = null, unsub = null, liveT = 0;

    function announce(msg) {
      clearTimeout(liveT); live.textContent = '';
      liveT = setTimeout(function () { live.textContent = msg; }, 60);
    }

    function render() {
      start.textContent = ''; end.textContent = ''; acts = {}; readouts = {};
      var c = VK.actions.ctx();
      VK.actions.forSurface(surface, c, { all: true }).forEach(function (a) {
        var m = VK.mini.fromAction(a, c); m.dataset.size = 'sm';
        var txt = VK.el('span.vk-statusbar__text', { id: VK.uid('vk-sb') });
        m.setAttribute('aria-describedby', txt.id);
        var it = VK.el('span.vk-statusbar__item', { 'data-id': a.id }, [m, txt]);
        if (a.statusPin) it.setAttribute('data-pin', '');
        (a.statusSide === 'end' ? end : start).appendChild(it);
        acts[a.id] = { a: a, mini: m, text: txt, item: it, state: null };
      });
      (opts.items || []).forEach(function (o) {
        var txt = VK.el('span.vk-statusbar__text', { text: o.text || '' });
        var it = VK.el('span.vk-statusbar__item.vk-statusbar__readout', { 'data-id': o.id, title: o.title || o.key || '' },
          [o.key ? VK.el('span.vk-statusbar__key', { text: o.key }) : null, txt]);
        if (o.pin) it.setAttribute('data-pin', '');
        (o.side === 'end' ? end : start).appendChild(it);
        readouts[o.id] = { o: o, text: txt, item: it };
      });
      if (rov) rov.update(); else rov = VK.focus.roving(el, { items: '.vk-mini', orientation: 'horizontal', typeahead: false });
      refresh(null, true);
    }

    function refreshOne(r, c, quiet) {
      VK.mini.refresh(r.mini, r.a, c);
      var st = r.mini.dataset.state || 'idle';
      if (st === 'idle') r.item.removeAttribute('data-state'); else r.item.setAttribute('data-state', st);
      var t = '';
      if (r.a.statusText) { try { t = r.a.statusText(c) || ''; } catch (e) { t = ''; } }
      if (r.text.textContent !== t) r.text.textContent = t;
      if (!quiet && r.state !== null && r.state !== st) announce(r.a.label + ': ' + (STATE_HU[st] || st) + (t ? ' — ' + t : ''));
      r.state = st;
    }
    function refresh(id, quiet) {
      var c = VK.actions.ctx();
      if (id) { if (acts[id]) refreshOne(acts[id], c, quiet); return; }
      Object.keys(acts).forEach(function (k) { refreshOne(acts[k], c, quiet); });
    }

    unsub = VK.actions.subscribe(function (kind, a) {
      if ((kind === 'register' || kind === 'unregister') && a && a.at.indexOf(surface) >= 0) render();
      else if (kind === 'run' || kind === 'context') refresh();
    });
    render();

    return {
      el: el, render: render, refresh: refresh, announce: announce,
      setText: function (id, text, say) {
        var r = readouts[id]; if (!r) return;
        r.o.text = text; r.text.textContent = text;
        if (say) announce((r.o.key ? r.o.key + ': ' : '') + text);
      },
      destroy: function () { if (unsub) unsub(); if (rov) rov.destroy(); clearTimeout(liveT); el.textContent = ''; }
    };
  }

  VK.statusbar = { mount: mount };
})(typeof window !== 'undefined' ? window : globalThis);
