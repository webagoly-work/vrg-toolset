/* VRG UI Kit — components/context-tray.js — "Küldés Claude-nak": a selected cluster of nodes becomes a CONTEXT PACK.
     var t = VK.contextTray.mount(el, {
       title: 'Küldés Claude-nak', format: 'md' | 'json', collapsed: false,
       onSend: function (pack, tray) {},   // pack = {format, text, items, tokens}; drive t.setSending(…) from the app
       onChange: function (items) {}
     })
     t.add(item | [items])   item = {id, kind, label, text?, data?, tokens?}   kind → icon (node, file, code, job, device,
                             cable, sensor, junction, terminal, note, db) · t.remove(id) · t.clear() · t.items() · t.set(items)
     t.move(id, delta) · t.pack(format?) → {format, text, items, tokens} · t.tokens() → rough estimate (chars / 4)
     t.setCollapsed(bool) · t.setPreview(bool) · t.setSending(p)   p: 0…1 running · null indeterminate · 'done' · 'error' · false idle
     t.copy() · t.send() · t.registerActions(prefix='tray') · t.destroy()
   VK.contextTray.bindSelection(t, resolver, opts?) listens to document 'vk:selection' {ids, items?, source?}; items win,
     else resolver(id) → item (null = skipped). opts.mode: 'replace' (default) | 'add'; opts.accept(detail) → false ignores
     an event (e.g. another view's selection). Returns unbind().
   VK.contextTray.estimate(n) → '~1,2k token'
   Keyboard: chips are a listbox (one tab stop, arrows move) · Alt+↑/↓ (or Alt+←/→) reorders · Delete/Backspace removes
   · Enter on the bar toggles collapse. The head minis: előnézet (aria-pressed), másolás, ürítés, küldés (progress).
   Depends on: core, focus, mini, base, button. */
(function (root) {
  'use strict';
  var VK = root.VK = root.VK || {};
  if (VK.contextTray) return;

  var KIND_ICON = { node: 'node', file: 'file', code: 'file-code', job: 'folder', device: 'cpu', cable: 'cable', sensor: 'sensor',
    junction: 'junction', terminal: 'terminal-node', note: 'edit', db: 'database', session: 'session', board: 'board', server: 'server' };
  var KIND_HU = { node: 'csomópont', file: 'fájl', code: 'kód', job: 'munka', device: 'eszköz', cable: 'kábel', sensor: 'érzékelő',
    junction: 'elágazás', terminal: 'végpont', note: 'jegyzet', db: 'adatbázis', session: 'munkamenet', board: 'tábla', server: 'szerver' };

  function estimate(n) {
    n = Math.max(0, Math.round(n || 0));
    if (n < 1000) return '~' + n + ' token';
    var k = n / 1000;
    return '~' + (k < 10 ? k.toFixed(1).replace('.', ',') : Math.round(k)) + 'k token';
  }
  function body(it) {
    if (it.text != null) return String(it.text);
    if (it.data != null) return JSON.stringify(it.data, null, 2);
    return '';
  }
  function itemTokens(it) { return it.tokens != null ? +it.tokens : Math.ceil((String(it.label || '').length + String(it.id || '').length + body(it).length + 24) / 4); }

  function copyText(text) {
    if (VK.chat && VK.chat.copyText) return VK.chat.copyText(text);
    try { if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return false; }); }
    catch (e) { /* ignore */ }
    return Promise.resolve(false);
  }

  function mount(el, opts) {
    opts = opts || {};
    var items = [], collapsed = !!opts.collapsed, preview = false, format = opts.format === 'json' ? 'json' : 'md', sending = false;
    var title = opts.title || 'Küldés Claude-nak', unregs = [], destroyed = false;

    el.classList.add('vk-tray');
    el.textContent = '';
    if (!el.hasAttribute('data-vk-hop')) el.setAttribute('data-vk-hop', '');
    el.setAttribute('role', 'region');
    if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', title);
    var bodyId = VK.uid('vk-tray-body');

    // head
    var countEl = VK.el('span.vk-tray__count.vk-num');
    var sizeEl = VK.el('span.vk-tray__size.vk-label');
    var toggle = VK.el('button.vk-tray__toggle', { type: 'button', 'aria-expanded': 'true', 'aria-controls': bodyId, onclick: function () { setCollapsed(!collapsed); } }, [
      VK.icon('pack'),
      VK.el('span.vk-tray__title.vk-title', { text: title }),
      countEl, sizeEl,
      VK.icon('chevron-down', 'vk-tray__chev')
    ]);
    var prevMini = VK.mini.create({ icon: 'eye', label: 'Csomag előnézete', size: 'sm', pressed: false, onClick: function () { setPreview(!preview); } });
    var copyMini = VK.mini.create({ icon: 'copy', label: 'Csomag másolása', size: 'sm', onClick: function () { copy(); } });
    var clearMini = VK.mini.create({ icon: 'trash', label: 'Tálca ürítése', size: 'sm', onClick: function () { clear(); } });
    var sendMini = VK.mini.create({ icon: 'send', label: 'Küldés Claude-nak', caption: '', onClick: function () { send(); } });
    sendMini.classList.add('vk-tray__send');
    var tools = VK.el('div.vk-tray__tools', { role: 'toolbar', 'aria-label': 'Csomag' }, [prevMini, copyMini, clearMini, sendMini]);
    var head = VK.el('header.vk-tray__head', null, [toggle, tools]);
    var rovTools = VK.focus.roving(tools, { items: '.vk-mini', orientation: 'horizontal', typeahead: false });

    // body
    var chipList = VK.el('ul.vk-tray__chips', { role: 'listbox', 'aria-label': 'Csomag elemei (Alt+nyilak: sorrend, Delete: eltávolítás)', 'aria-orientation': 'vertical' });
    var emptyEl = VK.el('p.vk-tray__empty', { text: opts.emptyText || 'Üres a csomag — jelölj ki csomópontokat, és ide kerülnek.' });
    var fmtGroup = VK.el('div.vk-btn-group', { role: 'radiogroup', 'aria-label': 'Formátum' }, [
      VK.el('button.vk-btn.vk-btn--sm', { type: 'button', role: 'radio', 'data-v': 'md', text: 'Markdown' }),
      VK.el('button.vk-btn.vk-btn--sm', { type: 'button', role: 'radio', 'data-v': 'json', text: 'JSON' })
    ]);
    var pre = VK.el('pre.vk-tray__pre', { tabindex: '0', 'aria-label': 'Csomag előnézete' });
    var previewBox = VK.el('div.vk-tray__preview', { hidden: true }, [VK.el('div.vk-tray__prevhead', null, [VK.el('span.vk-label', { text: 'Előnézet' }), VK.el('span.vk-grow'), fmtGroup]), pre]);
    var bodyEl = VK.el('div.vk-tray__body', { id: bodyId }, [emptyEl, chipList, previewBox]);
    var sr = VK.el('div.vk-sr-only', { role: 'status', 'aria-live': 'polite' });
    el.appendChild(head); el.appendChild(bodyEl); el.appendChild(sr);
    function announce(t) { sr.textContent = ''; setTimeout(function () { sr.textContent = t; }, 30); }

    var rov = VK.focus.roving(chipList, { items: '[role="option"]', orientation: 'both', onMove: function (n) {
      Array.prototype.forEach.call(chipList.children, function (c) { c.setAttribute('aria-selected', c === n ? 'true' : 'false'); });
    } });

    fmtGroup.addEventListener('click', function (e) { var b = e.target.closest('[role="radio"]'); if (b) setFormat(b.getAttribute('data-v')); });
    fmtGroup.addEventListener('keydown', function (e) {
      if (e.shiftKey || !/^Arrow(Left|Right|Up|Down)$/.test(e.key)) return;
      e.preventDefault(); setFormat(format === 'md' ? 'json' : 'md'); fmtGroup.querySelector('[aria-checked="true"]').focus();
    });
    function setFormat(f) {
      format = f === 'json' ? 'json' : 'md';
      Array.prototype.forEach.call(fmtGroup.children, function (b) { var on = b.getAttribute('data-v') === format; b.setAttribute('aria-checked', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1; });
      renderPreview();
    }

    chipList.addEventListener('keydown', function (e) {
      var li = e.target.closest && e.target.closest('[role="option"]'); if (!li) return;
      var id = li.getAttribute('data-id');
      if (e.altKey && /^Arrow(Up|Down|Left|Right)$/.test(e.key)) { e.preventDefault(); move(id, /Up|Left/.test(e.key) ? -1 : 1, true); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeAndFocus(id); }
    });
    chipList.addEventListener('click', function (e) {
      var x = e.target.closest('.vk-tray__x'); if (!x) return;
      removeAndFocus(x.closest('[role="option"]').getAttribute('data-id'));
    });
    function removeAndFocus(id) {
      var i = items.findIndex(function (x) { return x.id === id; });
      remove(id);
      var list = chipList.querySelectorAll('[role="option"]');
      if (list.length) { rov.focus(Math.min(i, list.length - 1)); } else toggle.focus();
    }

    function total() { return items.reduce(function (s, it) { return s + itemTokens(it); }, 0); }

    function render() {
      var focusId = document.activeElement && chipList.contains(document.activeElement) ? document.activeElement.getAttribute('data-id') : null;
      chipList.textContent = '';
      items.forEach(function (it, i) {
        var li = VK.el('li.vk-tray__chip', { role: 'option', 'aria-selected': 'false', tabindex: '-1', 'data-id': it.id, 'data-kind': it.kind || 'node',
          'aria-label': (i + 1) + '. ' + it.label + ', ' + (KIND_HU[it.kind] || it.kind || 'elem') + ', ' + it.id }, [
          VK.el('span.vk-tray__idx.vk-num', { 'aria-hidden': 'true', text: (i < 9 ? '0' : '') + (i + 1) }),
          VK.icon(KIND_ICON[it.kind] || 'dot'),
          VK.el('span.vk-tray__label.vk-ellipsis', { text: it.label }),
          VK.el('span.vk-tray__id.vk-num.vk-ellipsis', { text: it.id }),
          VK.el('span.vk-tray__x', { 'aria-hidden': 'true', title: 'Eltávolítás (Delete)' }, VK.icon('close', 'vk-icon--sm'))
        ]);
        chipList.appendChild(li);
      });
      var n = items.length;
      countEl.textContent = '[' + (n < 10 ? '0' : '') + n + ']';
      sizeEl.textContent = n ? estimate(total()) : '—';
      toggle.setAttribute('aria-label', title + ': ' + n + ' elem, ' + (n ? estimate(total()) : 'üres') + (collapsed ? ' (összecsukva)' : ''));
      emptyEl.hidden = !!n; chipList.hidden = !n;
      el.toggleAttribute('data-empty', !n);
      [copyMini, clearMini].forEach(function (m) { m.disabled = !n; });
      if (!sending) sendMini.disabled = !n;
      rov.update(); rovTools.update();
      if (focusId) { var f = chipList.querySelector('[data-id="' + cssEsc(focusId) + '"]'); if (f) { rov.focus(Array.prototype.indexOf.call(chipList.children, f)); } }
      renderPreview();
      if (opts.onChange) opts.onChange(items.slice());
    }
    function cssEsc(s) { return root.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/"/g, '\\"'); }

    function pack(f) {
      f = f || format;
      var tok = total(), text;
      if (f === 'json') {
        text = JSON.stringify({ pack: { title: title, count: items.length, tokens: tok, items: items.map(function (it) {
          var o = { id: it.id, kind: it.kind || 'node', label: it.label };
          if (it.text != null) o.text = it.text; if (it.data != null) o.data = it.data; return o;
        }) } }, null, 2);
      } else {
        var out = ['# Kontextuscsomag — ' + items.length + ' elem', '<!-- VRG // ' + estimate(tok) + ' -->', ''];
        items.forEach(function (it, i) {
          out.push('## [' + (i + 1) + '] ' + it.label + ' (' + (KIND_HU[it.kind] || it.kind || 'elem') + ' · ' + it.id + ')');
          var b = body(it); if (b) { out.push(it.data != null ? '```json\n' + b + '\n```' : b); }
          out.push('');
        });
        text = out.join('\n').replace(/\n+$/, '\n');
      }
      return { format: f, text: text, items: items.slice(), tokens: tok };
    }
    function renderPreview() { if (preview) pre.textContent = items.length ? pack().text : '— üres —'; }

    function norm(it) { it = Object.assign({}, it); it.id = String(it.id); it.label = it.label || it.id; return it; }
    function add(arr) {
      (Array.isArray(arr) ? arr : [arr]).forEach(function (it) {
        if (!it || it.id == null) return; it = norm(it);
        var i = items.findIndex(function (x) { return x.id === it.id; });
        if (i >= 0) items[i] = it; else items.push(it);
      });
      render();
    }
    function set(arr) {
      var next = (arr || []).filter(function (x) { return x && x.id != null; }).map(norm);
      // keep the user's order for items that stay; new ones go to the end in selection order
      var ids = next.map(function (x) { return x.id; });
      var kept = items.filter(function (x) { return ids.indexOf(x.id) >= 0; }).map(function (x) { return next[ids.indexOf(x.id)]; });
      var keptIds = kept.map(function (x) { return x.id; });
      items = kept.concat(next.filter(function (x) { return keptIds.indexOf(x.id) < 0; }));
      render();
    }
    function remove(id) {
      var it = items.find(function (x) { return x.id === id; }); if (!it) return;
      items = items.filter(function (x) { return x.id !== id; }); render(); announce('Eltávolítva: ' + it.label);
    }
    function clear() { if (!items.length) return; items = []; render(); announce('A tálca kiürült'); }
    function move(id, d, focus) {
      var i = items.findIndex(function (x) { return x.id === id; }), j = i + d;
      if (i < 0 || j < 0 || j >= items.length) return;
      var it = items.splice(i, 1)[0]; items.splice(j, 0, it);
      render();
      if (focus) rov.focus(j);
      announce(it.label + ': ' + (j + 1) + '. hely');
    }
    function setCollapsed(c) {
      collapsed = !!c; el.toggleAttribute('data-collapsed', collapsed);
      toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      bodyEl.hidden = collapsed; render();
    }
    function setPreview(on) {
      preview = !!on; previewBox.hidden = !preview; VK.mini.set(prevMini, { pressed: preview });
      if (preview && collapsed) setCollapsed(false);
      renderPreview();
    }
    function copy() {
      if (!items.length) return Promise.resolve(false);
      VK.mini.set(copyMini, { state: 'running', progress: null });
      return copyText(pack().text).then(function (ok) {
        VK.mini.set(copyMini, { state: ok ? 'done' : 'error', progress: 1 });
        announce(ok ? 'Csomag a vágólapon' : 'A másolás nem sikerült');
        setTimeout(function () { VK.mini.set(copyMini, { state: 'idle', progress: 0 }); }, 1400);
        return ok;
      });
    }
    function setSending(p) {
      if (p === false || p === 'idle') { sending = false; el.removeAttribute('data-sending'); VK.mini.set(sendMini, { state: 'idle', progress: 0 }); sendMini.disabled = !items.length; rovTools.update(); return; }
      if (p === 'done' || p === 'error') {
        sending = false; el.removeAttribute('data-sending');
        VK.mini.set(sendMini, { state: p, progress: 1 }); sendMini.disabled = !items.length; rovTools.update();
        announce(p === 'done' ? 'Csomag elküldve' : 'A küldés nem sikerült');
        setTimeout(function () { if (!sending) VK.mini.set(sendMini, { state: 'idle', progress: 0 }); }, 1800);
        return;
      }
      sending = true; el.setAttribute('data-sending', '');
      VK.mini.set(sendMini, { state: 'running', progress: p == null ? null : p });
    }
    function send() {
      if (!items.length || sending) return false;
      var pk = pack();
      if (opts.onSend) { setSending(0); opts.onSend(pk, inst); }
      return pk;
    }

    function registerActions(prefix) {
      if (!VK.actions) return;
      prefix = prefix || 'tray';
      [
        { id: prefix + '.send', label: 'Kontextuscsomag küldése Claude-nak', icon: 'send', when: function () { return items.length > 0 && !sending; }, run: send },
        { id: prefix + '.copy', label: 'Kontextuscsomag másolása', icon: 'copy', when: function () { return items.length > 0; }, run: copy },
        { id: prefix + '.preview', label: 'Kontextuscsomag előnézete', icon: 'eye', checked: function () { return preview; }, run: function () { setPreview(!preview); } },
        { id: prefix + '.clear', label: 'Kontextustálca ürítése', icon: 'trash', when: function () { return items.length > 0; }, run: clear },
        { id: prefix + '.toggle', label: 'Kontextustálca összecsukása', icon: 'pack', checked: function () { return collapsed; }, run: function () { setCollapsed(!collapsed); } }
      ].forEach(function (a) { a.group = 'Ügynök'; a.at = ['palette', 'menu:tray']; VK.actions.register(a); unregs.push(a.id); });
    }
    function destroy() {
      if (destroyed) return; destroyed = true;
      rov.destroy(); rovTools.destroy(); unregs.forEach(function (id) { VK.actions.unregister(id); });
      if (inst._unbind) inst._unbind();
      el.textContent = ''; el.classList.remove('vk-tray');
    }

    var inst = {
      el: el, add: add, set: set, remove: remove, clear: clear, move: move, items: function () { return items.slice(); },
      pack: pack, tokens: total, setCollapsed: setCollapsed, setPreview: setPreview, setFormat: setFormat, setSending: setSending,
      copy: copy, send: send, registerActions: registerActions, destroy: destroy
    };
    setFormat(format);
    if (opts.items) add(opts.items);
    setCollapsed(collapsed);
    return inst;
  }

  /** follow document 'vk:selection' events: detail {ids, items?}. resolver(id) → item | null */
  function bindSelection(tray, resolver, o) {
    o = o || {};
    function on(e) {
      var d = e.detail || {};
      if (o.accept && !o.accept(d)) return;
      var list = d.items && d.items.length ? d.items : (d.ids || []).map(function (id) { return resolver ? resolver(id) : { id: id }; }).filter(Boolean);
      if (o.mode === 'add') tray.add(list); else tray.set(list);
    }
    document.addEventListener('vk:selection', on);
    var off = function () { document.removeEventListener('vk:selection', on); };
    tray._unbind = off;
    return off;
  }

  VK.contextTray = { mount: mount, bindSelection: bindSelection, estimate: estimate, KIND_ICON: KIND_ICON };
})(typeof window !== 'undefined' ? window : globalThis);
