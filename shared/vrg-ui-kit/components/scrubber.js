/* VRG UI Kit — components/scrubber.js — standalone time scrubber / range slider.
   Step buttons, a play/pause MINI whose ring is the playback progress, a track with ticks and date labels,
   one thumb (role=slider) or two (range). aria-valuetext is the date.
     var s = VK.scrubber.mount(el, {min, max, value, range:[a, b], step, bigStep, duration, label, time, disabled, caption})
       min/max/value: 'YYYY-MM-DD', 'YYYY-MM-DDTHH:MM', ms or Date (wall-clock) · step: ms (default 1 day)
       bigStep: ms (default 7 days) · duration: ms for one full sweep (default 12 s) · time: show hours in the text
     s.set(v | [a, b], {silent}) · s.get() · s.play() · s.pause() · s.toggle() · s.setBounds(min, max)
     s.setDisabled(bool) · s.on(type, fn) → off · s.destroy()
   Events (s.on and bubbling DOM 'vk:scrubber-<type>'): input {value, range, text} (continuous) · change (committed) ·
     play · pause · end
   Keyboard (on a thumb): ←/↓ and →/↑ one step, PageDown/PageUp a big step, Home/End the ends, Space = play/pause.
   Reduced motion: playback jumps in steps instead of gliding.
   Depends on: core, mini (CSS: base, button, mini). */
(function (root) {
  'use strict';
  var VK = root.VK = root.VK || {};
  if (VK.scrubber) return;

  var DAY = 864e5, HOUR = 36e5;
  var MON = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.'];

  function T(v) {
    if (v === null || v === undefined || v === '') return NaN;
    if (typeof v === 'number') return v;
    if (v instanceof Date) return Date.UTC(v.getFullYear(), v.getMonth(), v.getDate(), v.getHours(), v.getMinutes());
    var m = String(v).match(/^(\d{4})-(\d\d)-(\d\d)(?:[T ](\d\d):(\d\d))?/);
    return m ? Date.UTC(+m[1], m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)) : NaN;
  }
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function day0(t) { return Math.floor(t / DAY) * DAY; }
  function fDate(t) { var x = new Date(t); return MON[x.getUTCMonth()] + ' ' + x.getUTCDate() + '.'; }
  function fText(t, time) { var x = new Date(t); return x.getUTCFullYear() + '. ' + fDate(t) + (time ? ' ' + p2(x.getUTCHours()) + ':' + p2(x.getUTCMinutes()) : ''); }

  function mount(el, o) {
    o = o || {};
    var em = VK.emitter(), offs = [];
    var S = { min: T(o.min), max: T(o.max), step: o.step || DAY, big: o.bigStep || 7 * DAY, range: !!o.range,
      dur: o.duration || 12000, time: !!o.time, playing: false, started: false, disabled: !!o.disabled, raf: 0 };
    if (isNaN(S.min)) S.min = day0(Date.now()) - 30 * DAY;
    if (isNaN(S.max) || S.max <= S.min) S.max = S.min + 30 * DAY;
    S.v = S.range ? [T(o.range[0]), T(o.range[1])] : [T(o.value)];
    S.v = S.v.map(function (v) { return isNaN(v) ? S.min : VK.clamp(v, S.min, S.max); });
    if (S.range && S.v[0] > S.v[1]) S.v.reverse();

    el.classList.add('vk-scrubber');
    if (S.range) el.setAttribute('data-range', '');
    if (!el.hasAttribute('data-vk-hop')) el.setAttribute('data-vk-hop', '');
    el.textContent = '';

    function stepBtn(dir) {
      var lbl = dir < 0 ? 'Egy lépés vissza' : 'Egy lépés előre';
      return VK.el('button.vk-btn.vk-btn--icon.vk-btn--sm.vk-scrubber__step', { type: 'button', 'data-variant': 'ghost', 'data-dir': String(dir), 'aria-label': lbl, title: lbl },
        VK.icon('step', dir < 0 ? 'vk-scrubber__flip' : ''));
    }
    var back = stepBtn(-1), fwd = stepBtn(1);
    var play = VK.mini.create({ icon: 'play', label: 'Lejátszás', caption: o.caption });
    play.classList.add('vk-scrubber__play');
    var ctl = VK.el('div.vk-scrubber__ctl', { role: 'group', 'aria-label': 'Lejátszás vezérlése' }, [back, play, fwd]);
    var fill = VK.el('div.vk-scrubber__fill');
    var rail = VK.el('div.vk-scrubber__rail', { 'aria-hidden': 'true' }, fill);
    var ticks = VK.el('div.vk-scrubber__ticks', { 'aria-hidden': 'true' });
    var thumbs = S.v.map(function (v, i) {
      return VK.el('div.vk-scrubber__thumb', { role: 'slider', tabindex: '0', 'aria-orientation': 'horizontal', 'data-i': String(i),
        'aria-label': S.range ? (i ? (o.label ? o.label + ' — vége' : 'Vége') : (o.label ? o.label + ' — kezdete' : 'Kezdete')) : (o.label || 'Időpont') });
    });
    var track = VK.el('div.vk-scrubber__track', null, [rail, ticks].concat(thumbs));
    var labels = VK.el('div.vk-scrubber__labels', { 'aria-hidden': 'true' });
    var body = VK.el('div.vk-scrubber__body', null, [track, labels]);
    var out = VK.el('span.vk-scrubber__out.vk-num', { 'aria-hidden': 'true' });
    el.append(ctl, body, out);

    function emit(type, data) { em.emit(type, data); VK.fire(el, 'scrubber-' + type, data); }
    function listen(n, type, fn) { n.addEventListener(type, fn); offs.push(function () { n.removeEventListener(type, fn); }); }
    function frac(t) { return (t - S.min) / (S.max - S.min); }
    function text(t) { return fText(t, S.time); }
    function payload() { return { value: S.v[0], range: S.range ? S.v.slice() : null, text: S.range ? text(S.v[0]) + ' – ' + text(S.v[1]) : text(S.v[0]) }; }

    function render() {
      thumbs.forEach(function (th, i) {
        var v = S.v[i], lo = S.range && i ? S.v[0] : S.min, hi = S.range && !i ? S.v[1] : S.max;
        th.style.left = frac(v) * 100 + '%';
        th.setAttribute('aria-valuemin', String(Math.round((lo - S.min) / S.step)));
        th.setAttribute('aria-valuemax', String(Math.round((hi - S.min) / S.step)));
        th.setAttribute('aria-valuenow', String(Math.round((v - S.min) / S.step)));
        th.setAttribute('aria-valuetext', text(v));
        th.tabIndex = S.disabled ? -1 : 0;
        if (S.disabled) th.setAttribute('aria-disabled', 'true'); else th.removeAttribute('aria-disabled');
      });
      var a = S.range ? frac(S.v[0]) : 0, b = frac(S.range ? S.v[1] : S.v[0]);
      fill.style.left = a * 100 + '%'; fill.style.width = (b - a) * 100 + '%';
      out.textContent = payload().text;
      var p = frac(S.range ? S.v[1] : S.v[0]);
      play.dataset.label = S.playing ? 'Szünet' : 'Lejátszás';
      play.title = play.dataset.label + ' (Szóköz)';
      VK.mini.set(play, { progress: p, state: S.playing ? 'running' : S.started ? (p >= 1 ? 'done' : 'paused') : 'idle' });
      var use = play.querySelector('use'); if (use) use.setAttribute('href', '#vk-i-' + (S.playing ? 'pause' : 'play'));
      play.disabled = back.disabled = fwd.disabled = S.disabled;
      el.toggleAttribute('aria-disabled', S.disabled);
      if (S.disabled) el.setAttribute('aria-disabled', 'true');
    }

    function renderTicks() {
      ticks.textContent = ''; labels.textContent = '';
      var w = track.clientWidth, span = S.max - S.min;
      if (!w || span <= 0) return;
      var ppd = w / (span / DAY), fT = document.createDocumentFragment(), fL = document.createDocumentFragment(), lastL = -1e9;
      var gap = Math.max(52, parseFloat(getComputedStyle(el).fontSize) * 5);
      function tk(t, k) { fT.appendChild(VK.el('span.vk-scrubber__tk', { 'data-k': k, style: 'left:' + frac(t) * 100 + '%' })); }
      function lb(t, s) {
        var x = frac(t) * w; if (x - lastL < gap || x > w - 24) return; lastL = x;
        fL.appendChild(VK.el('span.vk-scrubber__lb', { style: 'left:' + frac(t) * 100 + '%', text: s }));
      }
      if (span <= 3 * DAY) {                       // hours
        for (var h = Math.ceil(S.min / HOUR) * HOUR; h <= S.max; h += HOUR) {
          var hr = new Date(h).getUTCHours();
          tk(h, hr === 0 ? 'major' : hr % 6 ? 'minor' : 'mid');
          if (!(hr % 6)) lb(h, hr === 0 ? fDate(h) : p2(hr) + ':00');
        }
      } else {
        for (var t = day0(S.min); t <= S.max; t += DAY) {
          if (t < S.min) continue;
          var d = new Date(t), dom = d.getUTCDate(), wd = d.getUTCDay(), mon = dom === 1;
          if (ppd >= 4 || wd === 1 || mon) tk(t, mon ? 'major' : wd === 1 ? 'mid' : 'minor');
          if (ppd * 7 >= gap) { if (wd === 1) lb(t, fDate(t)); }
          else if (mon) lb(t, MON[d.getUTCMonth()] + (d.getUTCMonth() === 0 ? ' ' + d.getUTCFullYear() : ''));
        }
      }
      ticks.appendChild(fT); labels.appendChild(fL);
    }

    function snapV(t) { return S.min + Math.round((t - S.min) / S.step) * S.step; }
    function setVal(i, t, kind) {
      var lo = S.range && i ? S.v[0] : S.min, hi = S.range && !i ? S.v[1] : S.max;
      t = VK.clamp(t, lo, hi);
      if (t === S.v[i]) return;
      S.v[i] = t; render();
      if (kind !== 'silent') emit('input', payload());
      if (kind === 'commit') emit('change', payload());
    }
    function shift(delta, kind) {
      if (S.range) {
        var w = S.v[1] - S.v[0], b = VK.clamp(S.v[1] + delta, S.min + w, S.max);
        if (b === S.v[1]) return false;
        S.v = [b - w, b];
      } else {
        var v = VK.clamp(S.v[0] + delta, S.min, S.max);
        if (v === S.v[0]) return false;
        S.v[0] = v;
      }
      render(); emit('input', payload()); if (kind === 'commit') emit('change', payload());
      return true;
    }

    // ---- playback ----
    function playFn() {
      if (S.playing || S.disabled) return;
      if ((S.range ? S.v[1] : S.v[0]) >= S.max) {               // at the end: start over
        if (S.range) { var w = S.v[1] - S.v[0]; S.v = [S.min, S.min + w]; } else S.v[0] = S.min;
      }
      S.playing = true; S.started = true; el.setAttribute('data-playing', '');
      var last = 0, acc = 0, rm = VK.reducedMotion(), rate = (S.max - S.min) / S.dur;
      function frame(now) {
        if (!S.playing) return;
        var dt = last ? now - last : 0; last = now;
        var adv = rate * dt;
        if (rm) { acc += dt; if (acc < 450) { S.raf = requestAnimationFrame(frame); return; } adv = Math.max(S.step, Math.round(rate * acc / S.step) * S.step); acc = 0; }
        if (adv > 0 && !shift(adv)) { pauseFn(); emit('end', payload()); return; }
        if ((S.range ? S.v[1] : S.v[0]) >= S.max) { pauseFn(); emit('end', payload()); return; }
        S.raf = requestAnimationFrame(frame);
      }
      S.raf = requestAnimationFrame(frame);
      render(); emit('play', payload());
    }
    function pauseFn() {
      if (!S.playing) return;
      S.playing = false; cancelAnimationFrame(S.raf); el.removeAttribute('data-playing');
      if (!S.range) S.v[0] = VK.clamp(snapV(S.v[0]), S.min, S.max);
      render(); emit('pause', payload()); emit('change', payload());
    }
    function toggle() { if (S.playing) pauseFn(); else playFn(); }

    listen(play, 'click', toggle);
    [back, fwd].forEach(function (b) {
      listen(b, 'click', function () { pauseFn(); var d = +b.dataset.dir * S.step; if (!S.range) { var v = S.v[0]; var n = d > 0 ? Math.floor((v - S.min) / S.step) * S.step + S.min + S.step : Math.ceil((v - S.min) / S.step) * S.step + S.min - S.step; d = n - v; } shift(d, 'commit'); });
    });

    // ---- pointer ----
    var drag = -1;
    function tAt(cx) { var r = track.getBoundingClientRect(); return S.min + (cx - r.left) / r.width * (S.max - S.min); }
    listen(track, 'pointerdown', function (e) {
      if (S.disabled || e.button) return;
      e.preventDefault(); pauseFn();
      var t = snapV(tAt(e.clientX)), i = 0;
      if (S.range) i = Math.abs(t - S.v[0]) < Math.abs(t - S.v[1]) || (t < S.v[0]) ? 0 : 1;
      drag = i; el.setAttribute('data-dragging', '');
      try { track.setPointerCapture(e.pointerId); } catch (err) { /* synthetic */ }
      setVal(i, t); thumbs[i].focus({ preventScroll: true });
    });
    listen(track, 'pointermove', function (e) { if (drag >= 0) setVal(drag, snapV(tAt(e.clientX))); });
    function end() { if (drag < 0) return; drag = -1; el.removeAttribute('data-dragging'); emit('change', payload()); }
    listen(track, 'pointerup', end); listen(track, 'pointercancel', end);

    // ---- keyboard ----
    thumbs.forEach(function (th, i) {
      listen(th, 'keydown', function (e) {
        if (S.disabled || e.altKey || e.ctrlKey || e.metaKey || (e.shiftKey && /^Arrow/.test(e.key))) return;
        var v = S.v[i], n = null;
        switch (e.key) {
          case 'ArrowRight': case 'ArrowUp': n = snapV(v + S.step); break;
          case 'ArrowLeft': case 'ArrowDown': n = snapV(v - S.step); break;
          case 'PageUp': n = snapV(v + S.big); break;
          case 'PageDown': n = snapV(v - S.big); break;
          case 'Home': n = S.range && i ? S.v[0] : S.min; break;
          case 'End': n = S.range && !i ? S.v[1] : S.max; break;
          case ' ': e.preventDefault(); toggle(); return;
          default: return;
        }
        e.preventDefault(); pauseFn(); setVal(i, n, 'commit');
      });
    });

    var ro = root.ResizeObserver ? new ResizeObserver(renderTicks) : null;
    if (ro) ro.observe(track);
    listen(document, 'vk:density', renderTicks);
    render(); renderTicks();

    var api = {
      set: function (v, opt) {
        var silent = opt && opt.silent;
        if (Array.isArray(v)) { var a = T(v[0]), b = T(v[1]); S.v = S.range ? [VK.clamp(Math.min(a, b), S.min, S.max), VK.clamp(Math.max(a, b), S.min, S.max)] : [VK.clamp(a, S.min, S.max)]; }
        else { var t = VK.clamp(T(v), S.min, S.max); if (S.range) { var w = S.v[1] - S.v[0]; S.v = [Math.min(t, S.max - w), Math.min(t, S.max - w) + w]; } else S.v[0] = t; }
        render(); if (!silent) emit('input', payload());
      },
      get: function () { return S.range ? S.v.slice() : S.v[0]; },
      play: playFn, pause: pauseFn, toggle: toggle,
      playing: function () { return S.playing; },
      setBounds: function (min, max) { S.min = T(min); S.max = T(max); S.v = S.v.map(function (v) { return VK.clamp(v, S.min, S.max); }); render(); renderTicks(); },
      setDisabled: function (d) { S.disabled = !!d; if (d) pauseFn(); render(); },
      on: em.on,
      destroy: function () { pauseFn(); offs.forEach(function (f) { f(); }); if (ro) ro.disconnect(); el.textContent = ''; el.classList.remove('vk-scrubber'); }
    };
    el._vkScrubber = api;
    return api;
  }

  VK.scrubber = { mount: mount, parse: T, format: fText };
})(typeof window !== 'undefined' ? window : globalThis);
