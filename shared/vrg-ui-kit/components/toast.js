/* VRG UI Kit — components/toast.js — toast stack with auto-dismiss counted down on a MINI ring.
     var t = VK.toast.show({kind:'info'|'ok'|'warn'|'error'|'activity', title, text, source:'EXPORT',
                            action: {label, run} | 'registry.action.id', timeout: 6000 (0 = until dismissed; error default 12000),
                            progress: 0…1 | null (activity toast with a bar; stays until updated to another kind)})
     t.update({kind, title, text, progress}) · t.dismiss()
     VK.toast.configure({position:'br'|'bl'|'tr'|'tl'|'tc'|'bc', max:3})   the page stack (created on first show)
     VK.toast.focusLatest() · VK.toast.clear()
     var s = VK.toast.stack(containerEl, {position, max})  a stack of its own (contained in a positioned element) → same API
   Toasts never steal focus. The countdown pauses while the pointer is over a toast or focus is inside it
   (and while the page is hidden). Esc dismisses the focused toast; focus moves to the next toast or back
   to where it came from. More than `max` toasts wait in a queue ("+N sorban").
   Suggested registry actions (the app registers them): toast.focus (Alt+T → focusLatest), toast.clear.
   Depends on: core.js, mini.js (+ mini.css), button.css. Optional: actions.js (action ids). */
(function (root) {
  'use strict';
  var VK = root.VK = root.VK || {};
  if (VK.toast) return;

  var ICON = { info: 'info', ok: 'ok', warn: 'warning', error: 'error', activity: 'activity' };
  var KIND_HU = { info: 'információ', ok: 'kész', warn: 'figyelem', error: 'hiba', activity: 'folyamat' };
  var DEFAULT_T = 6000, ERROR_T = 12000;

  function hhmm(d) { d = d || new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }

  function stack(container, opts) {
    opts = opts || {};
    var pos = opts.position || 'br', max = opts.max || 3;
    var el = null, more = null, live = [], queue = [], returnTo = null, raf = 0, last = 0;

    function ensure() {
      if (el) return el;
      el = VK.el('section.vk-toast-stack', { 'aria-label': opts.label || 'Értesítések', 'data-pos': pos, hidden: true });
      if (container) el.setAttribute('data-contained', '');
      el.addEventListener('focusin', function (e) {
        if (e.relatedTarget && !el.contains(e.relatedTarget)) returnTo = e.relatedTarget;
      });
      (container || document.body).appendChild(el);
      return el;
    }

    function tick(now) {
      raf = 0;
      var dt = last ? Math.min(now - last, 100) : 16; last = now;
      var hidden = typeof document !== 'undefined' && document.hidden, rm = VK.reducedMotion();
      live.forEach(function (t) {
        if (!t.total || t.leaving) return;
        if (!(t.hover || t.focus || hidden)) t.remain -= dt;
        var p = Math.max(0, t.remain / t.total);
        if (rm) p = Math.ceil(p * 8) / 8;               // still steps, no smooth sweep
        t.close.style.setProperty('--vk-p', p.toFixed(3));
        if (t.remain <= 0) t.dismiss();
      });
      if (live.some(function (t) { return t.total && !t.leaving; })) raf = requestAnimationFrame(tick); else last = 0;
    }
    function run() { if (!raf && typeof requestAnimationFrame !== 'undefined') { last = 0; raf = requestAnimationFrame(tick); } }

    function syncMore() {
      if (queue.length) {
        if (!more) more = VK.el('div.vk-toast-stack__more', { 'aria-hidden': 'true' });
        more.textContent = '+' + queue.length + ' sorban';
        if (more.parentNode !== el) el.insertBefore(more, el.firstChild);
      } else if (more && more.parentNode) more.remove();
      el.hidden = !live.length;
    }

    function actionButton(a, t) {
      var act = typeof a === 'string' ? (VK.actions && VK.actions.get(a)) : a;
      if (!act) return null;
      return VK.el('button.vk-btn.vk-btn--sm', { type: 'button', onclick: function () {
        if (typeof a === 'string') VK.actions.run(a); else if (act.run) act.run(t);
        t.dismiss();
      } }, [act.icon ? VK.icon(act.icon) : null, act.label]);
    }

    function setTimer(t, o) {
      var ms = o.timeout !== undefined ? o.timeout : (t.kind === 'error' ? ERROR_T : DEFAULT_T);
      if (t.kind === 'activity' && t.bar) ms = 0;                        // a running job stays until it ends
      t.total = ms; t.remain = ms;
      t.close.dataset.meter = ms ? 'ring' : 'none';
      t.close.style.setProperty('--vk-p', ms ? '1' : '0');
      if (ms) run();
    }

    function render(o) {
      var kind = ICON[o.kind] ? o.kind : 'info';
      var t = { kind: kind, hover: false, focus: false, leaving: false };
      var node = VK.el('div.vk-toast', { 'data-kind': kind, role: kind === 'error' ? 'alert' : 'status', 'aria-atomic': 'true', tabindex: '-1' });
      var meta = VK.el('p.vk-toast__meta'), title = VK.el('p.vk-toast__title'), text = VK.el('p.vk-toast__text');
      var body = VK.el('div.vk-toast__body', null, [meta, title, text]);
      var icon = VK.icon(ICON[kind], 'vk-toast__icon');
      var close = VK.mini.create({ icon: 'close', label: 'Értesítés bezárása', size: 'sm' });
      close.classList.add('vk-toast__close');
      close.addEventListener('click', function () { t.dismiss(); });
      VK.append(node, [icon, body, close]);
      t.el = node; t.close = close;

      t.update = function (u) {
        u = u || {};
        if (u.kind && ICON[u.kind]) {
          var was = t.kind; t.kind = u.kind; node.dataset.kind = u.kind;
          node.setAttribute('role', u.kind === 'error' ? 'alert' : 'status');
          icon.querySelector('use').setAttribute('href', '#vk-i-' + ICON[u.kind]);
          if (was === 'activity' && u.kind !== 'activity' && t.bar) { t.bar.remove(); t.bar = null; }
        }
        meta.textContent = hhmm(u.time) + ' // ' + (u.source || o.source || KIND_HU[t.kind]).toUpperCase();
        if (u.title !== undefined) title.textContent = u.title;
        if (u.text !== undefined) { text.textContent = u.text; text.hidden = !u.text; }
        if ('progress' in u && t.kind === 'activity') {
          if (!t.bar) { t.bar = VK.el('div.vk-toast__bar', { 'aria-hidden': 'true' }, VK.el('i')); node.appendChild(t.bar); }
          if (u.progress === null) t.bar.setAttribute('data-indeterminate', '');
          else { t.bar.removeAttribute('data-indeterminate'); t.bar.style.setProperty('--vk-p', String(VK.clamp(u.progress, 0, 1))); }
        }
        if (u.kind || u.timeout !== undefined) setTimer(t, u);
        return t;
      };
      t.dismiss = function () {
        if (t.leaving) return; t.leaving = true;
        var hadFocus = node.contains(document.activeElement);
        var i = live.indexOf(t);
        node.setAttribute('data-leaving', '');
        var done = function () {
          node.remove(); live.splice(live.indexOf(t), 1);
          if (queue.length && live.length < max) mount(queue.shift());
          syncMore();
          if (hadFocus) {
            var next = live[Math.min(i, live.length - 1)];
            if (next) next.el.focus();
            else if (returnTo && document.contains(returnTo)) returnTo.focus();
          }
          if (o.onDismiss) o.onDismiss(t);
        };
        if (VK.reducedMotion()) done(); else setTimeout(done, 170);
      };

      node.addEventListener('mouseenter', function () { t.hover = true; });
      node.addEventListener('mouseleave', function () { t.hover = false; });
      node.addEventListener('focusin', function () { t.focus = true; });
      node.addEventListener('focusout', function (e) { if (!node.contains(e.relatedTarget)) t.focus = false; });
      node.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); t.dismiss(); }
      });

      var first = { title: o.title || '', text: o.text || '', time: o.time, source: o.source };
      if ('progress' in o) first.progress = o.progress;
      t.update(first);
      if (o.action) { var b = actionButton(o.action, t); if (b) body.appendChild(VK.el('div.vk-toast__actions', null, b)); }
      setTimer(t, o);
      return t;
    }

    function mount(o) {
      var t = o.__t || render(o);
      live.push(t); ensure().appendChild(t.el);
      if (t.total) run();
      return t;
    }

    var api = {
      show: function (o) {
        o = o || {}; ensure();
        var t;
        if (live.length >= max) {
          t = render(o); o.__t = t; queue.push(o);          // waits off-DOM; its timer starts when it mounts
          t.remain = t.total;
        } else t = mount(o);
        syncMore();
        return t;
      },
      configure: function (c) {
        c = c || {};
        if (c.position) { pos = c.position; if (el) el.dataset.pos = pos; }
        if (c.max) { max = c.max; while (queue.length && live.length < max) mount(queue.shift()); if (el) syncMore(); }
        return api;
      },
      focusLatest: function () {
        var t = live[live.length - 1]; if (!t) return false;
        if (!el.contains(document.activeElement)) returnTo = document.activeElement;
        t.el.focus(); return true;
      },
      clear: function () { queue = []; live.slice().forEach(function (t) { t.dismiss(); }); if (el) syncMore(); },
      count: function () { return { visible: live.length, queued: queue.length }; },
      get el() { return ensure(); }
    };
    return api;
  }

  var page = null;
  function pageStack() { return page || (page = stack(null, {})); }

  VK.toast = {
    stack: stack,
    show: function (o) { return pageStack().show(o); },
    configure: function (c) { return pageStack().configure(c); },
    focusLatest: function () { return pageStack().focusLatest(); },
    clear: function () { return pageStack().clear(); },
    count: function () { return pageStack().count(); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
