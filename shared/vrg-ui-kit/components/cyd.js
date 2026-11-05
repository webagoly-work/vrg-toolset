/* VRG UI Kit — components/cyd.js — the 320×240 embedded display mode (ESP32 Cheap Yellow Display).
   One header strip, one screen of BIG MINI tiles (or a custom layout), a pager, three soft keys A / B / C that
   the board's physical buttons press. No hover anywhere; every target ≥ 40 px.

     var cyd = VK.cyd.mount(frameEl, {
       label: 'ServiceKit CYD',
       screens: [
         { id: 'home', title: 'Főmenü', cols: 3, rows: 2, tiles: [
             { id: 'cable', icon: 'cable', label: 'Kábelteszt', go: 'cable' },            // opens a screen
             { id: 'deploy', icon: 'download', label: 'Telepítő', state: 'running', progress: .35, run: fn },
             { id: 'light', icon: 'bulb', label: 'Háttérfény', toggle: true, checked: true, onToggle: fn },  // role=switch
             { id: 'u', label: 'Feszültség', value: '230', unit: 'V', tone: 'warn' } ] },              // readout tile
         { id: 'cable', title: 'Kábelteszt', render: function (body, cyd) { …; return {destroy, onKey} },
           keys: { b: { label: 'Indítás', primary: true, run: function (cyd) {} } } }
       ],
       start: 'home', clock: true | 'HH:MM', link: { state: 'done', label: 'Kapcsolat' }, onScreen: fn })
     cyd.go(id) · next() · prev() · key('a'|'b'|'c') · setTile(screenId, tileId, patch) · setKeys(screenId, keys)
     cyd.setLink({state, progress}) · led('run'|'ok'|'error'|null) · toast(text) · announce(text) · zoom(z) · current() · destroy()
   Default soft keys: A = Menü (on the first screen: Előző), B = OK (activates the focused tile), C = Tovább (next tile).
   A key set to null is shown as "—" and disabled.
   Keyboard (focus inside the frame or the board): ←↑→↓ move between tiles, Enter / Space activates,
   a/b/c or 1/2/3 = soft keys A/B/C, PageUp/PageDown = previous/next screen, Esc = Főmenü.
   Board mock: if the frame sits in .vk-cyd-board, its [data-key] buttons press the soft keys and its LED follows led().
   Depends on: core, focus, mini. */
(function (root) {
  'use strict';
  var VK = root.VK = root.VK || {};
  if (VK.cyd) return;

  var STATE_HU = { running: 'fut', done: 'kész', error: 'hiba', waiting: 'vár', paused: 'szünet', off: 'ki' };
  var KEYMAP = { a: 'a', b: 'b', c: 'c', 1: 'a', 2: 'b', 3: 'c' };

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /** a big progress ring for custom screens: VK.cyd.ring({progress, state, text, unit, sub}) */
  function ring(o) {
    var el = VK.el('div.vk-cyd__ring', { role: 'img' }, [VK.el('span.vk-cyd__ring-val'), VK.el('span.vk-cyd__ring-sub')]);
    setRing(el, o || {});
    return el;
  }
  function setRing(el, o) {
    if ('progress' in o) el.style.setProperty('--vk-p', String(VK.clamp(+o.progress || 0, 0, 1)));
    if ('state' in o) { if (o.state) el.dataset.state = o.state; else delete el.dataset.state; }
    var v = el.querySelector('.vk-cyd__ring-val'), s = el.querySelector('.vk-cyd__ring-sub');
    if ('text' in o) { v.textContent = o.text; if (o.unit) v.appendChild(VK.el('small', { text: o.unit })); }
    if ('sub' in o) s.textContent = o.sub;
    el.setAttribute('aria-label', (o.label || el.getAttribute('aria-label') || '').split(' — ')[0] + ' — ' + v.textContent + (s.textContent ? ', ' + s.textContent : ''));
  }
  /** a readout: VK.cyd.read({label, value, unit, tone}) */
  function read(o) {
    var v = VK.el('span.vk-cyd__read-val', null, [String(o.value), o.unit ? VK.el('small', { text: o.unit }) : null]);
    return VK.el('span.vk-cyd__read', { 'data-tone': o.tone || null }, [VK.el('span.vk-cyd__read-label', { text: o.label }), v]);
  }

  function mount(frame, opts) {
    opts = opts || {};
    var screens = opts.screens || [];
    var byId = {}; screens.forEach(function (s) { byId[s.id] = s; });
    var cur = null, curInst = null, rove = null, clockT = null, toastT = null, keyOverrides = {};
    var board = frame.closest('.vk-cyd-board');

    frame.classList.add('vk-cyd');
    frame.setAttribute('data-vk-density', 'touch');
    frame.setAttribute('role', 'group');
    frame.setAttribute('aria-roledescription', 'kijelző 320×240');
    frame.setAttribute('aria-label', opts.label || 'CYD kijelző');
    frame.tabIndex = -1;
    frame.textContent = '';

    var title = VK.el('span.vk-cyd__title');
    var dots = VK.el('span.vk-cyd__dots', { 'aria-hidden': 'true' });
    var clock = VK.el('span.vk-cyd__clock', { 'aria-hidden': 'true' });
    var link = VK.el('span.vk-mini', { role: 'img', 'data-size': 'sm' }, [VK.icon((opts.link && opts.link.icon) || 'link')]);
    link.dataset.label = (opts.link && opts.link.label) || 'Kapcsolat';
    var head = VK.el('div.vk-cyd__head', null, [title, dots, clock, link]);
    var body = VK.el('div.vk-cyd__body', { role: 'region' });
    var prevZ = VK.el('button.vk-cyd__zone', { type: 'button', 'aria-label': 'Előző képernyő' }, [VK.icon('chevron-left')]);
    var nextZ = VK.el('button.vk-cyd__zone', { type: 'button', 'aria-label': 'Következő képernyő' }, [VK.icon('chevron-right')]);
    var soft = {};
    var keysBar = VK.el('div.vk-cyd__keys', { role: 'toolbar', 'aria-label': 'Funkciógombok A, B, C' }, [prevZ]);
    ['a', 'b', 'c'].forEach(function (k) {
      var lab = VK.el('span.vk-cyd__soft-label');
      var b = VK.el('button.vk-cyd__soft', { type: 'button', 'data-key': k }, [VK.el('kbd.vk-cyd__key', { 'aria-hidden': 'true', text: k.toUpperCase() }), lab]);
      b.addEventListener('click', function () { press(k, true); });
      soft[k] = { btn: b, label: lab }; keysBar.appendChild(b);
    });
    keysBar.appendChild(nextZ);
    var live = VK.el('div.vk-sr-only', { role: 'status', 'aria-live': 'polite' });
    frame.appendChild(head); frame.appendChild(body); frame.appendChild(keysBar); frame.appendChild(live);
    prevZ.addEventListener('click', function () { prev(); });
    nextZ.addEventListener('click', function () { next(); });

    function pagerList() { return screens.filter(function (s) { return s.pager !== false; }); }
    screens.forEach(function () { /* dots built in show() */ });

    // ---- clock and link ----
    function tick() { if (typeof opts.clock === 'string') { clock.textContent = opts.clock; return; } var d = new Date(); clock.textContent = pad(d.getHours()) + ':' + pad(d.getMinutes()); }
    if (opts.clock !== false) { tick(); if (typeof opts.clock !== 'string') clockT = setInterval(tick, 15000); } else clock.hidden = true;
    function setLink(o) { VK.mini.set(link, o || {}); }
    setLink(opts.link || {});

    // ---- tiles ----
    function tileEl(t) {
      var b = VK.el('button.vk-cyd__tile', { type: 'button', tabindex: '-1', 'data-id': t.id });
      if (t.value !== undefined) { b.appendChild(read(t)); b.classList.add('vk-cyd__tile--read'); }
      else {
        var m = VK.el('span.vk-mini', { 'aria-hidden': 'true' }, [VK.icon(t.icon || 'dot')]);
        m.dataset.label = t.label;
        b.appendChild(m);
        b.appendChild(VK.el('span.vk-cyd__tile-label', { text: t.label }));
        b.appendChild(VK.el('span.vk-cyd__tile-sub'));
      }
      if (t.toggle) b.setAttribute('role', 'switch');
      b.addEventListener('click', function () { activate(t); });
      updTile(b, t);
      return b;
    }
    function updTile(b, t) {
      if (t.value !== undefined) {
        var rv = b.querySelector('.vk-cyd__read'); if (rv) rv.replaceWith(read(t));
        b.setAttribute('aria-label', t.label + ': ' + t.value + (t.unit ? ' ' + t.unit : '') + (t.sub ? ', ' + t.sub : ''));
        return;
      }
      var m = b.querySelector('.vk-mini');
      VK.mini.set(m, { state: t.state || 'idle', progress: t.progress === undefined ? 0 : t.progress, pressed: t.toggle ? !!t.checked : undefined });
      if (!t.toggle) m.removeAttribute('aria-pressed');
      if (t.state && t.state !== 'idle') b.dataset.state = t.state; else delete b.dataset.state;
      if (t.toggle) b.setAttribute('aria-checked', t.checked ? 'true' : 'false');
      var sub = t.sub;
      if (!sub && t.toggle) sub = t.checked ? 'BE' : 'KI';
      if (!sub && t.state === 'running' && typeof t.progress === 'number') sub = 'FUT ' + Math.round(t.progress * 100) + '%';
      if (!sub && t.state) sub = STATE_HU[t.state] || '';
      b.querySelector('.vk-cyd__tile-sub').textContent = sub || '';
      b.disabled = !!t.disabled;
    }
    function activate(t) {
      if (t.disabled) return;
      if (t.toggle) { t.checked = !t.checked; var b = body.querySelector('[data-id="' + t.id + '"]'); if (b) updTile(b, t); if (t.onToggle) t.onToggle(t.checked, api, t); announce(t.label + ': ' + (t.checked ? 'bekapcsolva' : 'kikapcsolva')); return; }
      if (t.go) { go(t.go); return; }
      if (t.run) t.run(api, t);
    }

    // ---- soft keys ----
    function keysFor(s) {
      var first = pagerList()[0] === s;
      var d = {
        a: first ? { label: 'Előző', run: function () { prev(); } } : { label: 'Menü', run: function () { go(screens[0].id); } },
        b: s.tiles ? { label: 'OK', primary: true, run: function () { var f = focusedTile(); if (f) f.click(); else focusTiles(); } } : null,
        c: s.tiles ? { label: 'Tovább', run: function () { stepTile(1); } } : { label: 'Tovább', run: function () { next(); } }
      };
      var o = Object.assign({}, s.keys || {}, keyOverrides[s.id] || {});
      Object.keys(o).forEach(function (k) { d[k] = o[k]; });
      return d;
    }
    function drawKeys() {
      var ks = keysFor(cur);
      ['a', 'b', 'c'].forEach(function (k) {
        var d = ks[k], s = soft[k];
        s.label.textContent = d ? d.label : '—';
        s.btn.disabled = !d;
        s.btn.setAttribute('aria-label', k.toUpperCase() + ' gomb: ' + (d ? d.label : 'nincs funkció'));
        if (d && d.primary) s.btn.setAttribute('data-primary', ''); else s.btn.removeAttribute('data-primary');
      });
      var pl = pagerList(), i = pl.indexOf(cur);
      prevZ.disabled = pl.length < 2; nextZ.disabled = pl.length < 2;
    }
    function flash(k) {
      [soft[k] && soft[k].btn, board && board.querySelector('.vk-cyd-board__btn[data-key="' + k + '"]')].forEach(function (n) {
        if (!n) return; n.setAttribute('data-pressed', ''); setTimeout(function () { n.removeAttribute('data-pressed'); }, 140);
      });
    }
    function press(k, fromClick) {
      var d = keysFor(cur)[k];
      if (!fromClick) flash(k);
      if (!d || !d.run) return false;
      d.run(api);
      return true;
    }

    // ---- focus helpers ----
    function tiles() { return Array.prototype.slice.call(body.querySelectorAll('.vk-cyd__tile:not(:disabled)')); }
    function focusedTile() { var t = tiles(); var a = document.activeElement; return t.indexOf(a) >= 0 ? a : t.filter(function (n) { return n.tabIndex === 0; })[0] || null; }
    function focusTiles() { var f = focusedTile() || tiles()[0]; if (f) { f.focus(); return true; } frame.focus(); return false; }
    function stepTile(d) { var t = tiles(); if (!t.length) return; var i = t.indexOf(focusedTile()); i = (i + d + t.length) % t.length; t.forEach(function (n, k) { n.tabIndex = k === i ? 0 : -1; }); t[i].focus(); }

    // ---- screens ----
    function show(s, keepFocus) {
      var hadFocus = frame.contains(document.activeElement) || (board && board.contains(document.activeElement));
      if (curInst && curInst.destroy) { try { curInst.destroy(); } catch (e) { console.error(e); } }
      if (rove) { rove.destroy(); rove = null; }
      curInst = null; cur = s;
      title.textContent = s.title;
      body.textContent = ''; body.setAttribute('aria-label', s.title);
      body.removeAttribute('data-enter'); void body.offsetWidth; body.setAttribute('data-enter', '');
      if (s.tiles) {
        var rows = s.rows || 2, cols = s.cols || (rows === 3 ? 2 : 3);
        var g = VK.el('div.vk-cyd__grid', { 'data-rows': String(rows), style: '--_cols:' + cols + ';--_rows:' + rows });
        s.tiles.forEach(function (t) { g.appendChild(tileEl(t)); });
        body.appendChild(g);
        rove = VK.focus.roving(g, { items: '.vk-cyd__tile', orientation: 'grid', cols: function () { return cols; }, wrap: false, typeahead: false });
      } else if (s.render) {
        curInst = s.render(body, api) || null;
      }
      // pager dots
      var pl = pagerList(); dots.textContent = '';
      pl.forEach(function (p) { dots.appendChild(VK.el('i', { 'data-on': p === s ? '' : null })); });
      var pi = pl.indexOf(s);
      drawKeys();
      announce(s.title + (pi >= 0 ? ' — ' + (pi + 1) + '/' + pl.length : ''));
      if (hadFocus && !keepFocus) focusTiles();
      if (opts.onScreen) opts.onScreen(s.id, api);
      VK.fire(frame, 'cyd-screen', { id: s.id });
    }
    function go(id) { var s = byId[id]; if (!s) return false; show(s); return true; }
    function step(d) { var pl = pagerList(); if (pl.length < 2) return; var i = pl.indexOf(cur); show(pl[((i < 0 ? 0 : i) + d + pl.length) % pl.length]); }
    function next() { step(1); }
    function prev() { step(-1); }

    function announce(t) { live.textContent = ''; setTimeout(function () { live.textContent = t; }, 30); }
    function toast(t, ms) {
      var old = frame.querySelector('.vk-cyd__toast'); if (old) old.remove();
      clearTimeout(toastT);
      var el = VK.el('div.vk-cyd__toast', { 'aria-hidden': 'true', text: t }); frame.appendChild(el);
      announce(t);
      toastT = setTimeout(function () { el.remove(); }, ms || 1800);
    }
    function led(st) {
      var l = board && board.querySelector('.vk-cyd-board__led'); if (!l) return;
      if (!st) l.removeAttribute('data-on'); else l.setAttribute('data-on', st === 'run' ? '' : st);
    }
    function setTile(sid, tid, patch) {
      var s = byId[sid]; if (!s || !s.tiles) return;
      var t = s.tiles.filter(function (x) { return x.id === tid; })[0]; if (!t) return;
      Object.assign(t, patch || {});
      if (cur === s) { var b = body.querySelector('[data-id="' + tid + '"]'); if (b) updTile(b, t); }
    }
    function setKeys(sid, keys) { keyOverrides[sid] = keys || {}; if (cur && cur.id === sid) drawKeys(); }
    function zoom(z) {
      z = Math.max(1, +z || 1);
      (board || frame).style.setProperty('--vk-cyd-zoom', String(z));
      VK.fire(frame, 'cyd-zoom', { zoom: z });
      return z;
    }

    // ---- keyboard: soft keys, pager, home ----
    var keyHost = board || frame;
    function onKey(e) {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || VK.focus.isEditable(e.target)) return;
      if (curInst && curInst.onKey && curInst.onKey(e) === true) { e.preventDefault(); return; }
      var k = KEYMAP[e.key && e.key.toLowerCase()];
      if (k && !e.shiftKey) { e.preventDefault(); press(k); return; }
      if (e.key === 'PageDown') { e.preventDefault(); next(); return; }
      if (e.key === 'PageUp') { e.preventDefault(); prev(); return; }
      if (e.key === 'Escape' && cur !== screens[0]) { e.preventDefault(); go(screens[0].id); }
    }
    keyHost.addEventListener('keydown', onKey);
    var boardBtns = board ? Array.prototype.slice.call(board.querySelectorAll('.vk-cyd-board__btn[data-key]')) : [];
    function onBoardBtn(e) { press(e.currentTarget.dataset.key, false); }
    boardBtns.forEach(function (b) { b.addEventListener('click', onBoardBtn); });

    var api = {
      el: frame, board: board, go: go, next: next, prev: prev, key: function (k) { return press(KEYMAP[k] || k); },
      setTile: setTile, setKeys: setKeys, setLink: setLink, led: led, toast: toast, announce: announce, zoom: zoom,
      focus: focusTiles, current: function () { return cur && cur.id; },
      destroy: function () {
        clearInterval(clockT); clearTimeout(toastT);
        if (curInst && curInst.destroy) curInst.destroy();
        if (rove) rove.destroy();
        keyHost.removeEventListener('keydown', onKey);
        boardBtns.forEach(function (b) { b.removeEventListener('click', onBoardBtn); });
        frame.textContent = '';
      }
    };
    var start = byId[opts.start] || screens[0];
    if (start) show(start, true);
    return api;
  }

  VK.cyd = { mount: mount, ring: ring, setRing: setRing, read: read };
})(typeof window !== 'undefined' ? window : globalThis);
