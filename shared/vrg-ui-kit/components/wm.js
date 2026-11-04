/* VRG UI Kit — components/wm.js — window manager for the VRG Desktop: floating, focus/z-order, taskbar of minis,
   minimise, maximise, snap to halves, tile all, keyboard move/resize mode.
     var wm = VK.wm.mount(areaEl, {taskbar: Element (optional: default is a strip inside the area), taskbarLabel:'Ablakok',
                                   glass: true, sheetBelow: 480, onChange(list)})
     While the area is narrower than sheetBelow (px), floating windows lay out as full-width sheets (data-sheet).
     var id = wm.open({id, title:'Kábelméretezés', icon:'cable', tag:'CALC-02', content: Element | 'text',
                       x, y, w:360, h:240, minW:200, minH:120, flush:false, onClose(id) → false vetoes})
     wm.focus(id) · wm.close(id) · wm.minimize(id) · wm.restore(id) · wm.maximize(id, on?) · wm.snap(id, 'left'|'right')
     wm.tile() · wm.cycle(±1) · wm.move(id) / wm.resize(id) (keyboard mode) · wm.setProgress(id, p|null, state)
     wm.setTitle(id, s) · wm.active() · wm.list() · wm.get(id) → {el, body} · wm.destroy()
     VK.wm.actions(wm, {prefix:'wm', at:['palette'], when}) → registry actions on the active window:
       move "Mozgatás", resize "Átméretezés", minimize, maximize (checked), snapLeft, snapRight, tile, cycle, close
   Windows are non-modal role=dialog with aria-labelledby → the title. Pointer: drag the title bar (to the left/right
   edge = snap to that half, to the top = maximise), double-click the title = maximise, drag the corner = resize.
   Keyboard: the title bar's "Mozgatás" mini (or the action) enters move mode: arrows move 16 px (Ctrl+arrow 64 px),
   Enter confirms, Esc cancels; "Átméretezés" does the same for the size. Taskbar: one tab stop, ←/→, Enter.
   Depends on: core.js, focus.js, mini.js (actions.js for VK.wm.actions). */
(function (root) {
  'use strict';
  var VK = root.VK = root.VK || {};
  if (VK.wm) return;

  var GAP = 6;

  function setIcon(m, name) { var u = m.querySelector('use'); if (u) u.setAttribute('href', '#vk-i-' + name); }

  function mount(area, opts) {
    opts = opts || {};
    area.classList.add('vk-wm');
    var desk = VK.el('div.vk-wm__desk');
    var ghost = VK.el('div.vk-wm__ghost', { 'aria-hidden': 'true', hidden: true });
    var own = !opts.taskbar;
    var taskbar = opts.taskbar || VK.el('div');
    taskbar.classList.add('vk-wm__taskbar');
    if (opts.glass !== false && own) taskbar.classList.add('vk-glass');
    taskbar.setAttribute('role', 'toolbar');
    taskbar.setAttribute('aria-label', opts.taskbarLabel || 'Ablakok');
    if (!taskbar.hasAttribute('data-vk-hop')) taskbar.setAttribute('data-vk-hop', '');
    var live = VK.el('span.vk-sr-only', { role: 'status', 'aria-live': 'polite' });
    area.appendChild(desk); area.appendChild(ghost); if (own) area.appendChild(taskbar); area.appendChild(live);
    taskbar.appendChild(VK.el('span.vk-wm__taskbar-tag', { 'aria-hidden': 'true', text: opts.taskbarTag || 'ABLAKOK' }));
    var trov = VK.focus.roving(taskbar, { items: '.vk-mini', orientation: 'horizontal', typeahead: false });

    var sheetW = opts.sheetBelow === undefined ? 480 : opts.sheetBelow || 0;
    var wins = [], z = 0, activeW = null, liveT = 0, n = 0;
    function say(msg) { clearTimeout(liveT); live.textContent = ''; liveT = setTimeout(function () { live.textContent = msg; }, 60); }
    function get(id) { return typeof id === 'object' && id ? id : wins.find(function (w) { return w.id === id; }) || null; }
    function scale() { var r = area.getBoundingClientRect(); return area.offsetWidth ? (r.width / area.offsetWidth) || 1 : 1; }
    function avail() {
      var w = area.clientWidth, h = area.clientHeight;
      if (own && !taskbar.hidden && taskbar.offsetHeight) h = Math.max(80, taskbar.offsetTop - GAP);
      return { w: w, h: h };
    }
    function rectFor(w) {
      var A = avail();
      if (w.state === 'max') return { x: 0, y: 0, w: A.w, h: A.h };
      if (w.state === 'left') return { x: 0, y: 0, w: Math.round(A.w / 2), h: A.h };
      if (w.state === 'right') return { x: Math.round(A.w / 2), y: 0, w: A.w - Math.round(A.w / 2), h: A.h };
      var r = w.rect;
      if (A.w < sheetW) return { x: 0, y: VK.clamp(r.y, 0, Math.max(0, A.h - Math.min(r.h, A.h))), w: A.w, h: Math.min(Math.max(r.h, w.minH), A.h) };
      r.w = VK.clamp(r.w, Math.min(w.minW, A.w), A.w); r.h = VK.clamp(r.h, Math.min(w.minH, A.h), A.h);
      r.x = VK.clamp(r.x, 0, Math.max(0, A.w - r.w)); r.y = VK.clamp(r.y, 0, Math.max(0, A.h - r.h));
      return r;
    }
    function layout(w, anim) {
      var r = rectFor(w), s = w.el.style;
      if (anim && !VK.reducedMotion()) { w.el.setAttribute('data-anim', ''); clearTimeout(w.animT); w.animT = setTimeout(function () { w.el.removeAttribute('data-anim'); }, 400); }
      s.left = r.x + 'px'; s.top = r.y + 'px'; s.width = r.w + 'px'; s.height = r.h + 'px';
      w.el.dataset.state = w.state;
      if (w.state === 'normal' && avail().w < sheetW) w.el.setAttribute('data-sheet', ''); else w.el.removeAttribute('data-sheet');
      if (w.maxMini) { var on = w.state === 'max'; VK.mini.set(w.maxMini, { pressed: on }); setIcon(w.maxMini, on ? 'minimize' : 'maximize'); relabel(w.maxMini, on ? 'Visszaállítás' : 'Teljes méret'); }
    }
    function relabel(m, s) { m.dataset.label = s; m.title = s; VK.mini.set(m, {}); }
    function changed() { if (opts.onChange) opts.onChange(list()); }
    function list() { return wins.map(function (w) { return { id: w.id, title: w.title, state: w.state, minimized: w.min, active: w === activeW }; }); }

    function syncTask() {
      taskbar.hidden = own && wins.length === 0;
      wins.forEach(function (w) {
        var st = w.pstate || (w.min ? 'off' : 'idle');
        w.task.dataset.label = w.title + (w.min ? ' (kis méretben)' : '');
        VK.mini.set(w.task, { pressed: w === activeW && !w.min, state: st, progress: w.pstate === 'running' ? w.progress : undefined });
      });
    }
    function raise(w) {
      if (activeW === w && w.el.style.zIndex == z) return;
      z += 1; w.el.style.zIndex = z;
      activeW = w;
      wins.forEach(function (x) { if (x === w) x.el.setAttribute('data-active', ''); else x.el.removeAttribute('data-active'); });
      syncTask();
    }
    function focusWin(id, into) {
      var w = get(id); if (!w) return;
      if (w.min) restore(w);
      raise(w);
      if (into !== false && !w.el.contains(document.activeElement)) (VK.focus.first(w.body) || VK.focus.first(w.el) || w.el).focus();
      changed();
    }

    function open(o) {
      o = o || {};
      if (o.id && get(o.id)) { focusWin(o.id); return o.id; }
      var w = { id: o.id || VK.uid('win'), title: o.title || 'Ablak', minW: o.minW || 200, minH: o.minH || 120, state: 'normal', min: false,
        progress: null, pstate: null, onClose: o.onClose };
      var tid = VK.uid('vk-wm-t');
      w.name = VK.el('span.vk-wm__name', { id: tid, text: w.title });
      w.modeTag = VK.el('span.vk-wm__mode', { 'aria-hidden': 'true' });
      var tools = VK.el('div.vk-wm__tools', { role: 'toolbar', 'aria-label': w.title + ' — ablakvezérlők' });
      function mk(icon, label, fn) { var m = VK.mini.create({ icon: icon, label: label, size: 'sm', meter: 'none', onClick: fn }); tools.appendChild(m); return m; }
      w.moveMini = mk('grip', 'Mozgatás', function () { enterMode(w, 'move'); });
      mk('minus', 'Kis méret', function () { minimize(w); });
      w.maxMini = mk('maximize', 'Teljes méret', function () { maximize(w); });
      w.maxMini.setAttribute('aria-pressed', 'false');
      mk('close', 'Bezárás', function () { close(w); });
      w.head = VK.el('div.vk-wm__title', null, [o.icon ? VK.icon(o.icon) : null, w.name, o.tag ? VK.el('span.vk-wm__tag', { 'aria-hidden': 'true', text: o.tag }) : null, w.modeTag, tools]);
      w.body = VK.el('div.vk-wm__body' + (o.flush ? '.vk-wm__body--flush' : ''));
      if (o.content && o.content.nodeType) w.body.appendChild(o.content); else if (o.content != null) w.body.textContent = String(o.content);
      var grip = VK.el('div.vk-wm__resize', { 'aria-hidden': 'true' });
      w.el = VK.el('div.vk-wm__win' + (opts.glass !== false ? '.vk-glass' : ''), { role: 'dialog', 'aria-labelledby': tid, tabindex: '-1', 'data-vk-hop': '', 'data-id': w.id },
        [w.head, w.body, grip]);
      w.rovT = VK.focus.roving(tools, { items: '.vk-mini', orientation: 'horizontal', typeahead: false });
      w.task = VK.mini.create({ icon: o.icon || 'window', label: w.title, size: 'sm', onClick: function () { taskClick(w); } });
      w.task.dataset.win = w.id;
      taskbar.appendChild(w.task); trov.update();
      var k = n++ % 6;
      w.rect = { x: o.x != null ? o.x : 24 + k * 28, y: o.y != null ? o.y : 16 + k * 24, w: o.w || 360, h: o.h || 240 };
      wins.push(w);
      desk.appendChild(w.el);
      syncTask();
      layout(w);

      w.el.addEventListener('pointerdown', function () { if (activeW !== w) { raise(w); changed(); } }, true);
      w.el.addEventListener('focusin', function () { if (activeW !== w) { raise(w); changed(); } });
      w.head.addEventListener('pointerdown', function (e) { dragStart(w, e, 'move'); });
      w.head.addEventListener('dblclick', function (e) { if (!e.target.closest('.vk-mini')) maximize(w); });
      grip.addEventListener('pointerdown', function (e) { dragStart(w, e, 'resize'); });
      w.el.addEventListener('keydown', function (e) { modeKey(w, e); });
      w.el.addEventListener('focusout', function (e) { if (w.mode && !w.el.contains(e.relatedTarget)) exitMode(w, true); });
      if (o.focus !== false) focusWin(w); else { raise(w); }
      changed();
      return w.id;
    }

    function taskClick(w) {
      if (w.min) { focusWin(w); say(w.title + ': visszaállítva'); }
      else if (activeW === w) minimize(w, true);
      else focusWin(w);
    }
    function topVisible(except) {
      return wins.filter(function (x) { return x !== except && !x.min; }).sort(function (a, b) { return (+b.el.style.zIndex) - (+a.el.style.zIndex); })[0] || null;
    }
    function minimize(id, keepFocus) {
      var w = get(id); if (!w || w.min) return;
      var had = w.el.contains(document.activeElement);
      if (w.mode) exitMode(w, true);
      w.min = true; w.el.hidden = true;
      if (activeW === w) { activeW = null; var t = topVisible(w); if (t) raise(t); }
      syncTask();
      if (had || keepFocus) w.task.focus();
      say(w.title + ': kis méretre téve');
      changed();
    }
    function restore(id) { var w = get(id); if (!w || !w.min) return; w.min = false; w.el.hidden = false; layout(w); syncTask(); changed(); }
    function maximize(id, on) {
      var w = get(id); if (!w) return;
      if (on === undefined) on = w.state !== 'max';
      if (w.min) restore(w);
      w.state = on ? 'max' : 'normal';
      layout(w, true); raise(w); changed();
      say(w.title + (on ? ': teljes méret' : ': visszaállítva'));
    }
    function snap(id, side) {
      var w = get(id); if (!w) return;
      if (w.min) restore(w);
      w.state = side === 'left' || side === 'right' ? side : 'normal';
      layout(w, true); raise(w); changed();
      say(w.title + ': ' + (side === 'left' ? 'bal félre' : side === 'right' ? 'jobb félre' : 'lebegő'));
    }
    function tile() {
      var vis = wins.filter(function (w) { return !w.min; }); if (!vis.length) return;
      var A = avail(), cols = Math.ceil(Math.sqrt(vis.length)), rows = Math.ceil(vis.length / cols);
      var cw = (A.w - GAP * (cols + 1)) / cols, ch = (A.h - GAP * (rows + 1)) / rows;
      vis.forEach(function (w, i) {
        var c = i % cols, r = Math.floor(i / cols);
        w.state = 'normal';
        w.rect = { x: Math.round(GAP + c * (cw + GAP)), y: Math.round(GAP + r * (ch + GAP)), w: Math.round(cw), h: Math.round(ch) };
        layout(w, true);
      });
      say('Mozaik: ' + vis.length + ' ablak');
      changed();
    }
    function cycle(dir) {
      var vis = wins.filter(function (w) { return !w.min; }); if (!vis.length) { var m = wins[0]; if (m) focusWin(m); return; }
      var i = vis.indexOf(activeW);
      focusWin(vis[(i + (dir || 1) + vis.length) % vis.length]);
    }
    function close(id) {
      var w = get(id); if (!w) return false;
      if (w.onClose && w.onClose(w.id) === false) return false;
      var had = w.el.contains(document.activeElement) || document.activeElement === w.task;
      w.rovT.destroy(); w.el.remove(); w.task.remove(); trov.update();
      wins.splice(wins.indexOf(w), 1);
      if (activeW === w) activeW = null;
      var t = topVisible(null);
      if (t) { if (had) focusWin(t); else raise(t); }
      else if (had) { var tm = taskbar.querySelector('.vk-mini'); if (tm) tm.focus(); else { area.tabIndex = -1; area.focus(); } }
      syncTask();
      say(w.title + ': bezárva');
      VK.fire(area, 'wmclose', { id: w.id });
      changed();
      return true;
    }

    // ---- pointer drag / resize ----
    function dragStart(w, e, kind) {
      if (e.button || (kind === 'move' && e.target.closest('.vk-mini'))) return;
      e.preventDefault();
      if (w.mode) exitMode(w, true);
      raise(w);
      var k = scale(), ar = area.getBoundingClientRect(), sx = e.clientX, sy = e.clientY, tgt = e.currentTarget;
      var r0 = rectFor(w);
      if (kind === 'move' && w.state !== 'normal') {             // tear a maximised / snapped window off under the pointer
        var nw = Math.min(w.rect.w, r0.w), px = (sx - ar.left) / k;
        w.rect = { x: px - nw * ((px - r0.x) / r0.w), y: r0.y, w: nw, h: w.rect.h };
        w.state = 'normal'; layout(w); r0 = rectFor(w);
      }
      var o = { x: r0.x, y: r0.y, w: r0.w, h: r0.h }, zone = null;
      try { tgt.setPointerCapture(e.pointerId); } catch (x) { /* synthetic */ }
      w.el.setAttribute('data-dragging', '');
      function mv(ev) {
        var dx = (ev.clientX - sx) / k, dy = (ev.clientY - sy) / k;
        if (kind === 'move') {
          w.rect.x = o.x + dx; w.rect.y = o.y + dy; layout(w);
          var px = (ev.clientX - ar.left) / k, py = (ev.clientY - ar.top) / k, A = avail();
          zone = px < 10 ? 'left' : px > A.w - 10 ? 'right' : py < 6 ? 'max' : null;
          if (zone) { ghost.hidden = false; var g = zone === 'left' ? [0, 0, A.w / 2, A.h] : zone === 'right' ? [A.w / 2, 0, A.w / 2, A.h] : [0, 0, A.w, A.h];
            ghost.style.left = g[0] + 'px'; ghost.style.top = g[1] + 'px'; ghost.style.width = g[2] + 'px'; ghost.style.height = g[3] + 'px'; }
          else ghost.hidden = true;
        } else { w.rect.w = o.w + dx; w.rect.h = o.h + dy; layout(w); }
      }
      function up() {
        tgt.removeEventListener('pointermove', mv); tgt.removeEventListener('pointerup', up); tgt.removeEventListener('pointercancel', up);
        w.el.removeAttribute('data-dragging'); ghost.hidden = true;
        if (zone === 'max') maximize(w, true); else if (zone) snap(w, zone); else changed();
      }
      tgt.addEventListener('pointermove', mv); tgt.addEventListener('pointerup', up); tgt.addEventListener('pointercancel', up);
    }

    // ---- keyboard move / resize mode ----
    function enterMode(id, kind) {
      var w = get(id); if (!w) return;
      if (w.min) restore(w);
      if (w.state !== 'normal') { var r = rectFor(w); w.rect = { x: r.x, y: r.y, w: r.w, h: r.h }; w.state = 'normal'; layout(w); }
      w.saved = { x: w.rect.x, y: w.rect.y, w: w.rect.w, h: w.rect.h };
      w.mode = kind; w.back = document.activeElement;
      w.el.dataset.mode = kind;
      w.modeTag.textContent = (kind === 'move' ? 'MOZGATÁS' : 'MÉRET') + ' ←↑→↓';
      w.modeTag.title = 'Nyilak, Ctrl + nyíl: nagy lépés · Enter: rögzít · Esc: mégse';
      raise(w);
      w.el.focus();
      say((kind === 'move' ? 'Mozgatás' : 'Átméretezés') + ': ' + w.title + '. Nyilak: 16 pont, Ctrl + nyíl: 64 pont, Enter: rögzít, Esc: mégse.');
    }
    function exitMode(w, keep) {
      if (!w.mode) return;
      if (!keep && w.saved) { w.rect = w.saved; layout(w); }
      var kind = w.mode; w.mode = null; w.saved = null;
      delete w.el.dataset.mode;
      say(w.title + ': ' + (keep ? (kind === 'move' ? 'új hely rögzítve' : 'új méret rögzítve') : 'visszavonva'));
      changed();
    }
    function modeKey(w, e) {
      if (!w.mode || e.target !== w.el) return;
      if (e.shiftKey && /^Arrow/.test(e.key)) return;              // region hop: focus leaves, the move is kept
      var s = (e.ctrlKey || e.metaKey) ? 64 : 16;
      var d = { ArrowLeft: [-s, 0], ArrowRight: [s, 0], ArrowUp: [0, -s], ArrowDown: [0, s] }[e.key];
      if (d) {
        e.preventDefault(); e.stopPropagation();
        if (w.mode === 'move') { w.rect.x += d[0]; w.rect.y += d[1]; } else { w.rect.w += d[0]; w.rect.h += d[1]; }
        layout(w);
        var r = rectFor(w); say(w.mode === 'move' ? 'x ' + Math.round(r.x) + ', y ' + Math.round(r.y) : Math.round(r.w) + ' × ' + Math.round(r.h));
      } else if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation();
        var back = w.back; exitMode(w, e.key === 'Enter');
        (back && w.el.contains(back) ? back : w.moveMini).focus();
      }
    }

    var ro = root.ResizeObserver ? new ResizeObserver(function () { wins.forEach(function (w) { if (!w.min) layout(w); }); }) : null;
    if (ro) ro.observe(area);
    syncTask();

    var api = {
      el: area, open: open, close: close, minimize: minimize, restore: restore, maximize: maximize, snap: snap, tile: tile, cycle: cycle,
      focus: focusWin, list: list,
      move: function (id) { enterMode(id || activeW, 'move'); },
      resize: function (id) { enterMode(id || activeW, 'resize'); },
      active: function () { return activeW ? activeW.id : null; },
      get: function (id) { var w = get(id); return w ? { id: w.id, el: w.el, body: w.body, state: w.state, minimized: w.min } : null; },
      setTitle: function (id, s) { var w = get(id); if (!w) return; w.title = s; w.name.textContent = s; relabel(w.task, s); },
      setProgress: function (id, p, state) {
        var w = get(id); if (!w) return;
        var st = state || (p === undefined ? null : 'running');
        if (w.pstate !== st && st && st !== 'running') say(w.title + ': ' + (st === 'done' ? 'kész' : st === 'error' ? 'hiba' : st));
        w.pstate = st && st !== 'idle' ? st : null; w.progress = p;
        syncTask();
      },
      destroy: function () { if (ro) ro.disconnect(); trov.destroy(); wins.slice().forEach(function (w) { w.el.remove(); }); wins = []; area.textContent = ''; }
    };
    return api;
  }

  /** registry actions that act on the active window; o: {prefix:'wm', at:['palette'], when, group, keys:{…}} */
  function actions(wm, o) {
    o = o || {};
    var p = o.prefix || 'wm', at = o.at || ['palette'], g = o.group || 'Ablakok', k = o.keys || {};
    function has(c) { return (!o.when || o.when(c)) && !!wm.active(); }
    function def(id, label, icon, run, extra) {
      var a = { id: p + '.' + id, label: label, group: g, icon: icon, at: at, keys: k[id] ? [k[id]] : [], when: has, run: function () { run(wm.active()); } };
      if (extra) Object.keys(extra).forEach(function (x) { a[x] = extra[x]; });
      return a;
    }
    return [
      def('move', 'Mozgatás', 'grip', function (id) { wm.move(id); }, { hint: 'Nyilak mozgatják az aktív ablakot, Enter rögzít, Esc visszavon' }),
      def('resize', 'Átméretezés', 'fit', function (id) { wm.resize(id); }, { hint: 'Nyilak méretezik az aktív ablakot' }),
      def('minimize', 'Kis méret', 'minus', function (id) { wm.minimize(id); }),
      def('maximize', 'Teljes méret', 'maximize', function (id) { wm.maximize(id); }, { checked: function () { var a = wm.get(wm.active()); return !!(a && a.state === 'max'); } }),
      def('snapLeft', 'Bal félre', 'panel-left', function (id) { wm.snap(id, 'left'); }),
      def('snapRight', 'Jobb félre', 'panel-right', function (id) { wm.snap(id, 'right'); }),
      def('tile', 'Mozaik elrendezés', 'grid', function () { wm.tile(); }, { when: function (c) { return (!o.when || o.when(c)) && wm.list().length > 0; } }),
      def('cycle', 'Következő ablak', 'window', function () { wm.cycle(1); }, { when: function (c) { return (!o.when || o.when(c)) && wm.list().length > 0; } }),
      def('close', 'Ablak bezárása', 'close', function (id) { wm.close(id); })
    ];
  }

  VK.wm = { mount: mount, actions: actions };
})(typeof window !== 'undefined' ? window : globalThis);
