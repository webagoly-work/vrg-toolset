/* VRG UI Kit — components/trace.js — agent activity trace: live steps on a vertical rail, nested tool calls.
     var tr = VK.trace.mount(el, {
       title: 'Nyomkövetés', run: 'FUTÁS 3F', follow: true,
       onSelect: function (step) {},     // Enter on a step ("részletek")
       onRetry: function (step) {},      // R on an error step, or its retry mini (Újrapróbálás)
       onRun: function (trace) {}        // the head's run mini (optional: replay / start)
     })
     tr.add({id?, title, kind?, state:'planned'|'running'|'done'|'error', progress?, time?, ms?, detail?,
             nodes:[{id, label, state:'ok'|'warn'|'crit'|'active'|'info'}], tools:[…], retryOf?, after?}) → id
                     (retryOf marks that step 'Újrapróbálva' and inserts the new one right after it)
     tr.update(id, patch) · tr.addTool(stepId, {id?, name, args, result, ms, state, time}) → toolId · tr.updateTool(stepId, toolId, patch)
     tr.expand(id, open) · tr.setFilter('all'|'tools'|'errors') · tr.setFollow(bool) · tr.setRun(label) · tr.clear() · tr.steps()
     tr.registerActions(prefix='trace') · tr.destroy()
   kind → glyph: plan, think, read, search, tool, write, run, check, net, graph (default: step).
   ARIA: role=log (polite, additions) holding a role=tree; steps are treeitems (level 1), tool calls level 2.
   Keyboard: ↑/↓ Home/End move · → expand / into the first tool call · ← collapse / back to the step · Enter details
   (toggles and calls onSelect) · Space toggles · R retries an error step. Focus inside the log pauses auto-follow.
   Depends on: core, focus, mini, base, button. */
(function (root) {
  'use strict';
  var VK = root.VK = root.VK || {};
  if (VK.trace) return;

  var KIND_ICON = { plan: 'list', think: 'spark', read: 'file', search: 'search', tool: 'tool', write: 'edit', run: 'terminal',
    check: 'ok', net: 'wifi', graph: 'graph', retry: 'refresh' };
  var STATE_HU = { planned: 'Tervezett', running: 'Fut', done: 'Kész', error: 'Hiba' };
  var NODE_HU = { ok: 'rendben', warn: 'figyelem', crit: 'hibás', active: 'aktív', info: 'infó' };
  var FILTERS = [['all', 'Összes'], ['tools', 'Eszközhívások'], ['errors', 'Hibák']];

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function hms(t) { if (t == null) return ''; var d = t instanceof Date ? t : new Date(t); return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); }
  function fmtMs(ms) { if (ms == null) return ''; return ms < 1000 ? Math.round(ms) + ' ms' : (ms / 1000).toFixed(1).replace('.', ',') + ' s'; }
  function txt(v) { if (v == null) return ''; return typeof v === 'string' ? v : JSON.stringify(v, null, 2); }
  function oneLine(v, n) { var s = typeof v === 'string' ? v : JSON.stringify(v); s = String(s == null ? '' : s).replace(/\s+/g, ' '); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  function miniFor(icon, state, progress, size) {
    var m = VK.el('span.vk-mini', { 'data-size': size || 'sm', 'aria-hidden': 'true' }, VK.icon(icon));
    VK.mini.set(m, { state: state === 'planned' ? 'idle' : state, progress: state === 'running' ? (progress == null ? null : progress) : (state === 'done' || state === 'error') ? 1 : 0 });
    return m;
  }

  function mount(el, opts) {
    opts = opts || {};
    var steps = [], byId = {}, filter = 'all', follow = opts.follow !== false, unregs = [], destroyed = false;

    el.classList.add('vk-trace');
    el.textContent = '';
    if (!el.hasAttribute('data-vk-hop')) el.setAttribute('data-vk-hop', '');
    el.setAttribute('role', 'region');
    if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', opts.title || 'Nyomkövetés');

    // head
    var runMini = VK.mini.create({ icon: 'trace', label: 'Futás', onClick: function () { if (opts.onRun) opts.onRun(inst); } });
    runMini.classList.add('vk-trace__runmini');
    var runEl = VK.el('span.vk-trace__run.vk-label');
    var sumEl = VK.el('span.vk-trace__sum.vk-label');
    var fGroup = VK.el('div.vk-btn-group.vk-trace__filter', { role: 'radiogroup', 'aria-label': 'Szűrő' }, FILTERS.map(function (f) {
      return VK.el('button.vk-btn.vk-btn--sm', { type: 'button', role: 'radio', 'data-v': f[0], text: f[1] });
    }));
    var followMini = VK.mini.create({ icon: 'arrow-down', label: 'Automatikus követés', size: 'sm', pressed: follow, onClick: function () { setFollow(!follow); } });
    var head = VK.el('header.vk-trace__head', null, [
      runMini,
      VK.el('div.vk-trace__id', null, [VK.el('span.vk-trace__title.vk-title', { text: opts.title || 'Nyomkövetés' }), VK.el('span.vk-trace__meta', null, [runEl, sumEl])]),
      VK.el('span.vk-grow'),
      fGroup, followMini
    ]);
    var tree = VK.el('ol.vk-trace__steps', { role: 'tree', 'aria-label': 'Lépések' });
    var emptyEl = VK.el('p.vk-trace__empty', { text: opts.emptyText || 'Még nincs lépés. Indíts egy futást.' });
    var log = VK.el('div.vk-trace__log.vk-scroll', { role: 'log', 'aria-live': 'polite', 'aria-relevant': 'additions' }, [emptyEl, tree]);
    var sr = VK.el('div.vk-sr-only', { role: 'status', 'aria-live': 'polite' });
    el.appendChild(head); el.appendChild(log); el.appendChild(sr);
    function announce(t) { sr.textContent = ''; setTimeout(function () { sr.textContent = t; }, 30); }

    var rov = VK.focus.roving(tree, { items: '[role="treeitem"]', orientation: 'vertical', typeahead: false });

    // filter radiogroup
    fGroup.addEventListener('click', function (e) { var b = e.target.closest('[role="radio"]'); if (b) setFilter(b.getAttribute('data-v')); });
    fGroup.addEventListener('keydown', function (e) {
      if (e.shiftKey || !/^Arrow(Left|Right|Up|Down)$/.test(e.key)) return;
      var i = FILTERS.findIndex(function (f) { return f[0] === filter; });
      i = (i + (/Right|Down/.test(e.key) ? 1 : -1) + FILTERS.length) % FILTERS.length;
      e.preventDefault(); setFilter(FILTERS[i][0]); fGroup.querySelector('[aria-checked="true"]').focus();
    });
    log.addEventListener('wheel', function (e) { if (e.deltaY < 0 && follow) setFollow(false); }, { passive: true });

    // ---- rendering ----
    function expandable(s) { return !!(s.detail || (s.nodes && s.nodes.length) || (s.tools && s.tools.length) || s.state === 'error'); }
    function isOpen(s) { return s._open != null ? s._open : (s.state === 'running' || s.state === 'error') && expandable(s); }
    function toolNode(s, t) {
      var open = !!t._open;
      var li = VK.el('li.vk-trace__tool', { role: 'treeitem', 'aria-level': '2', 'aria-expanded': open ? 'true' : 'false', tabindex: '-1',
        'data-id': t.id, 'data-state': t.state || 'running', 'aria-label': 'Eszközhívás: ' + t.name + ', ' + (STATE_HU[t.state] || '') + (t.ms != null ? ', ' + fmtMs(t.ms) : '') });
      li.appendChild(VK.el('div.vk-trace__row.vk-trace__row--tool', null, [
        miniFor('tool', t.state || 'running', t.progress),
        VK.el('span.vk-trace__kind.vk-label', { text: 'Eszközhívás' }),
        VK.el('span.vk-trace__tname.vk-mono', { text: t.name }),
        VK.el('span.vk-trace__args.vk-mono.vk-ellipsis', { text: oneLine(t.args, 80) }),
        VK.el('span.vk-trace__ms.vk-num', { text: fmtMs(t.ms) }),
        VK.icon('chevron-right', 'vk-trace__chev')
      ]));
      var body = VK.el('div.vk-trace__tbody', { hidden: !open });
      if (t.args != null) body.appendChild(VK.el('div.vk-trace__sec', null, [VK.el('span.vk-label', { text: 'Argumentumok' }), VK.el('pre.vk-trace__pre', { text: txt(t.args) })]));
      if (t.result != null) body.appendChild(VK.el('div.vk-trace__sec', null, [VK.el('span.vk-label', { text: t.state === 'error' ? 'Hiba' : 'Eredmény (kivonat)' }), VK.el('pre.vk-trace__pre', { 'data-state': t.state, text: oneLine(t.result, 400) })]));
      li.appendChild(body);
      return li;
    }
    function stepNode(s, idx) {
      var open = isOpen(s), exp = expandable(s);
      var li = VK.el('li.vk-trace__step', { role: 'treeitem', 'aria-level': '1', tabindex: '-1', 'data-id': s.id, 'data-state': s.state,
        'aria-label': (idx + 1) + '. ' + s.title + ', ' + (STATE_HU[s.state] || s.state) + (s.ms != null ? ', ' + fmtMs(s.ms) : '') + (s.tools && s.tools.length ? ', ' + s.tools.length + ' eszközhívás' : '') });
      if (exp) li.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (s.retried) li.setAttribute('data-retried', '');
      var retry = null;
      if (s.state === 'error' && opts.onRetry && !s.retried) {
        retry = VK.mini.create({ icon: 'refresh', label: 'Újrapróbálás (R)', size: 'sm', onClick: function (e) { e.stopPropagation(); doRetry(s); } });
        retry.tabIndex = -1; retry.classList.add('vk-trace__retry');
      }
      li.appendChild(VK.el('div.vk-trace__row', null, [
        miniFor(KIND_ICON[s.kind] || 'step', s.state, s.progress, 'md'),
        VK.el('span.vk-trace__text', null, [
          VK.el('span.vk-trace__stitle', { text: s.title }),
          VK.el('span.vk-trace__sub.vk-num', { 'aria-hidden': 'true' }, [
            VK.el('span.vk-trace__idx', { text: '[' + pad(idx + 1) + ']' }),
            VK.el('span.vk-trace__time', { text: hms(s.time) }),
            s.ms != null ? VK.el('span.vk-trace__ms', { text: fmtMs(s.ms) }) : (s.state === 'running' && s.progress != null ? VK.el('span.vk-trace__ms', { text: Math.round(s.progress * 100) + '%' }) : null)
          ])
        ]),
        VK.el('span.vk-trace__state', { 'data-state': s.state, text: s.retried ? 'Újrapróbálva' : (STATE_HU[s.state] || s.state) }),
        retry,
        exp ? VK.icon('chevron-right', 'vk-trace__chev') : VK.el('span.vk-trace__chev')
      ]));
      if (exp) {
        var det = VK.el('div.vk-trace__detail', { hidden: !open });
        if (s.detail) det.appendChild(VK.el('p.vk-trace__note', { text: s.detail }));
        if (s.state === 'error' && opts.onRetry && !s.retried) det.appendChild(VK.el('p.vk-trace__hint.vk-label', { text: 'R = Újrapróbálás' }));
        if (s.nodes && s.nodes.length) det.appendChild(VK.el('ul.vk-trace__nodes', { 'aria-label': 'Érintett csomópontok' }, s.nodes.map(function (n) {
          return VK.el('li.vk-trace__node', { 'data-state': n.state || 'info', title: NODE_HU[n.state] || '' }, [
            VK.el('span.vk-trace__ndot', { 'aria-hidden': 'true' }), VK.el('span', { text: n.label }), VK.el('span.vk-num.vk-trace__nid', { text: n.id }),
            VK.el('span.vk-sr-only', { text: ', ' + (NODE_HU[n.state] || '') })
          ]);
        })));
        li.appendChild(det);
        if (s.tools && s.tools.length) {
          var g = VK.el('ul.vk-trace__tools', { role: 'group', hidden: !open });
          s.tools.forEach(function (t) { g.appendChild(toolNode(s, t)); });
          li.appendChild(g);
        }
      }
      if (!matches(s)) li.hidden = true;
      return li;
    }
    function matches(s) {
      if (filter === 'tools') return !!(s.tools && s.tools.length);
      if (filter === 'errors') return s.state === 'error' || (s.tools || []).some(function (t) { return t.state === 'error'; });
      return true;
    }
    function focusedKey() {
      var a = document.activeElement; if (!a || !tree.contains(a)) return null;
      var it = a.closest('[role="treeitem"]'); return it ? it.getAttribute('data-id') : null;
    }
    function restore(key) {
      if (!key) return;
      var n = tree.querySelector('[data-id="' + (root.CSS && CSS.escape ? CSS.escape(key) : key) + '"]');
      if (n && !n.hidden && n.offsetParent !== null) { var list = Array.prototype.filter.call(tree.querySelectorAll('[role="treeitem"]'), function (x) { return x.offsetParent !== null; }); rov.focus(list.indexOf(n)); }
    }
    function renderStep(s) {
      var key = focusedKey();
      var idx = steps.indexOf(s), fresh = stepNode(s, idx);
      if (s.node && s.node.parentNode) s.node.replaceWith(fresh); else tree.appendChild(fresh);
      s.node = fresh;
      rov.update(); restore(key);
    }
    function renderAll() {
      var key = focusedKey();
      tree.textContent = '';
      steps.forEach(function (s, i) { s.node = stepNode(s, i); tree.appendChild(s.node); });
      rov.update(); restore(key);
      summary();
    }
    function summary() {
      var n = steps.length, done = 0, err = 0, running = 0, planned = 0;
      steps.forEach(function (s) { if (s.state === 'done') done++; else if (s.state === 'error') { if (!s.retried) err++; } else if (s.state === 'running') running++; else planned++; });
      var shown = steps.filter(matches).length;
      emptyEl.hidden = !!shown; emptyEl.textContent = n ? 'Nincs a szűrőnek megfelelő lépés.' : (opts.emptyText || 'Még nincs lépés. Indíts egy futást.');
      sumEl.textContent = n ? done + '/' + n + ' kész' + (err ? ' · ' + err + ' hiba' : '') : '—';
      var st = running ? 'running' : n && !planned && !running ? (err ? 'error' : 'done') : 'idle';
      VK.mini.set(runMini, { state: st, progress: running || st === 'idle' ? (n ? done / n : 0) : 1 });
      runMini.dataset.label = (opts.onRun ? 'Futtatás' : 'Futás') + (n ? ' (' + done + '/' + n + ')' : '');
      VK.mini.set(runMini, {});
      el.setAttribute('data-state', st);
    }
    function scrollFollow() {
      if (!follow) return;
      if (el.contains(document.activeElement) && log.contains(document.activeElement)) return;   // reading: don't yank
      log.scrollTop = log.scrollHeight;
    }

    // ---- API ----
    function add(s) {
      s = Object.assign({ state: 'planned', time: Date.now(), tools: [], nodes: [] }, s);
      s.id = String(s.id || VK.uid('step'));
      s.tools = (s.tools || []).map(function (t) { t = Object.assign({ state: 'running' }, t); t.id = String(t.id || VK.uid('tool')); return t; });
      if (byId[s.id]) return update(s.id, s);
      byId[s.id] = s;
      var after = s.after || s.retryOf, ai = after && byId[after] ? steps.indexOf(byId[after]) : -1;
      if (s.retryOf && byId[s.retryOf]) byId[s.retryOf].retried = true;
      if (ai >= 0 && ai < steps.length - 1) {   // a retry sits right after the step it retries
        while (ai + 1 < steps.length && steps[ai + 1].retryOf === after) ai++;
        steps.splice(ai + 1, 0, s); renderAll();
      } else {
        steps.push(s);
        if (s.retryOf && byId[s.retryOf]) renderStep(byId[s.retryOf]);
        renderStep(s); summary();
      }
      scrollFollow();
      return s.id;
    }
    function update(id, patch) {
      var s = byId[id]; if (!s) return null;
      var was = s.state;
      Object.assign(s, patch);
      if (patch.tools) s.tools = patch.tools.map(function (t) { t.id = String(t.id || VK.uid('tool')); return t; });
      if (patch.state && patch.state !== was) {
        if (patch.state === 'done' || patch.state === 'error') { if (s._open == null || patch.state === 'error') s._open = patch.state === 'error' ? true : null; }
        if (patch.state === 'done') announce('Kész: ' + s.title);
        else if (patch.state === 'error') announce('Hiba: ' + s.title);
        else if (patch.state === 'running') announce('Fut: ' + s.title);
      }
      renderStep(s); summary(); scrollFollow();
      return id;
    }
    function addTool(stepId, t) {
      var s = byId[stepId]; if (!s) return null;
      t = Object.assign({ state: 'running', time: Date.now() }, t); t.id = String(t.id || VK.uid('tool'));
      s.tools.push(t);
      renderStep(s); summary(); scrollFollow();
      return t.id;
    }
    function updateTool(stepId, toolId, patch) {
      var s = byId[stepId]; if (!s) return null;
      var t = s.tools.find(function (x) { return x.id === String(toolId); }); if (!t) return null;
      Object.assign(t, patch);
      if (patch.state === 'error') announce('Eszközhívás hiba: ' + t.name);
      renderStep(s); summary(); scrollFollow();
      return t.id;
    }
    function expand(id, open) {
      var s = byId[id];
      if (s) { if (!expandable(s)) return; s._open = open == null ? !isOpen(s) : !!open; renderStep(s); return; }
      steps.forEach(function (st) { (st.tools || []).forEach(function (t) { if (t.id === id) { t._open = open == null ? !t._open : !!open; renderStep(st); } }); });
    }
    function setFilter(f) {
      filter = FILTERS.some(function (x) { return x[0] === f; }) ? f : 'all';
      Array.prototype.forEach.call(fGroup.children, function (b) { var on = b.getAttribute('data-v') === filter; b.setAttribute('aria-checked', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1; });
      if (steps.length) renderAll(); else summary();
    }
    function setFollow(on) {
      follow = !!on; VK.mini.set(followMini, { pressed: follow });
      followMini.dataset.label = 'Automatikus követés'; VK.mini.set(followMini, {});
      if (follow) log.scrollTop = log.scrollHeight;
    }
    function setRun(label) { runEl.textContent = label || ''; runEl.hidden = !label; }
    function clear() { steps = []; byId = {}; tree.textContent = ''; rov.update(); summary(); }
    function doRetry(s) { if (s && s.state === 'error' && opts.onRetry && !s.retried) opts.onRetry(s, inst); }

    // ---- keyboard on the tree ----
    tree.addEventListener('keydown', function (e) {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      var it = e.target.closest && e.target.closest('[role="treeitem"]'); if (!it || e.target !== it) return;
      var lvl = it.getAttribute('aria-level'), id = it.getAttribute('data-id'), ex = it.getAttribute('aria-expanded');
      var step = lvl === '1' ? byId[id] : byId[it.closest('.vk-trace__step').getAttribute('data-id')];
      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          if (ex === 'false') expand(id, true);
          else if (ex === 'true' && lvl === '1') { var c = it.querySelector('[role="treeitem"]'); if (c) focusItem(c); }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (ex === 'true') expand(id, false);
          else if (lvl === '2') focusItem(it.closest('.vk-trace__step'));
          break;
        case 'Enter':
          e.preventDefault();
          if (ex) expand(id, ex !== 'true');
          if (lvl === '1' && opts.onSelect) opts.onSelect(step, inst);
          break;
        case ' ':
          e.preventDefault(); if (ex) expand(id, ex !== 'true'); break;
        case 'r': case 'R':
          if (lvl === '1') { e.preventDefault(); doRetry(step); }
          break;
      }
    });
    tree.addEventListener('click', function (e) {
      var row = e.target.closest('.vk-trace__row'); if (!row) return;
      var it = row.parentNode; var id = it.getAttribute('data-id');
      focusItem(it);
      if (it.hasAttribute('aria-expanded')) expand(id);
      if (it.getAttribute('aria-level') === '1' && opts.onSelect) opts.onSelect(byId[id], inst);
    });
    function focusItem(n) {
      var list = Array.prototype.filter.call(tree.querySelectorAll('[role="treeitem"]'), function (x) { return x.offsetParent !== null; });
      var i = list.indexOf(n); if (i >= 0) rov.focus(i);
    }

    function registerActions(prefix) {
      if (!VK.actions) return;
      prefix = prefix || 'trace';
      var acts = [
        { id: prefix + '.follow', label: 'Nyomkövetés: automatikus követés', icon: 'arrow-down', checked: function () { return follow; }, run: function () { setFollow(!follow); } },
        { id: prefix + '.focus', label: 'Nyomkövetés: ugrás a lépésekre', icon: 'trace', when: function () { return steps.length > 0; }, run: function () { rov.update(); var t = tree.querySelector('[tabindex="0"]'); if (t) t.focus(); } }
      ];
      FILTERS.forEach(function (f) { acts.push({ id: prefix + '.filter.' + f[0], label: 'Nyomkövetés szűrő: ' + f[1], icon: 'filter', checked: function () { return filter === f[0]; }, run: function () { setFilter(f[0]); } }); });
      if (opts.onRun) acts.push({ id: prefix + '.run', label: 'Nyomkövetés: futtatás', icon: 'play', run: function () { opts.onRun(inst); } });
      acts.forEach(function (a) { a.group = 'Ügynök'; a.at = ['palette', 'menu:trace']; VK.actions.register(a); unregs.push(a.id); });
    }
    function destroy() {
      if (destroyed) return; destroyed = true;
      rov.destroy(); unregs.forEach(function (id) { VK.actions.unregister(id); });
      el.textContent = ''; el.classList.remove('vk-trace');
    }

    var inst = {
      el: el, add: add, update: update, addTool: addTool, updateTool: updateTool, expand: expand, setFilter: setFilter,
      setFollow: setFollow, setRun: setRun, clear: clear, registerActions: registerActions, destroy: destroy,
      steps: function () { return steps.map(function (s) { var c = Object.assign({}, s); delete c.node; return c; }); }
    };
    setRun(opts.run || '');
    setFilter('all');
    (opts.steps || []).forEach(add);
    return inst;
  }

  VK.trace = { mount: mount, KIND_ICON: KIND_ICON };
})(typeof window !== 'undefined' ? window : globalThis);
