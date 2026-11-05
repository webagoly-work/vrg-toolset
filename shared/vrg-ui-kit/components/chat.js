/* VRG UI Kit — components/chat.js — the side chat panel of an agent (Claude) surface.
     var c = VK.chat.mount(el, {
       agent: 'Claude', model: 'Opus 5.5', status: 'Kész',
       suggestions: ['Összegezd a VRG-2611-03 kiosztását', …],     // empty state prompts
       chips: [{id, label, icon, meta}],                            // initial context chips in the composer
       onSend: function (text, info) {},   // info = {chips, instance}; the app streams the answer back
       onStop: function () {},             // the SEND mini became STOP while busy; Esc in the composer too
       onAttach: function (instance) {}    // the attach mini; default: nothing
     })
     c.add({id?, role:'user'|'assistant'|'tool'|'system', text, time?, chips?, tool:{name, args, result, ms, state}}) → id
     c.stream(id, chunk)   append text to a (new or existing) assistant message; c.end(id) finishes it
     c.update(id, patch)   merge into a message and re-render it (tool state, result, duration)
     c.setBusy(on, progress?)   on: thinking indicator + SEND mini turns into a STOP/progress mini (progress 0…1 | null)
     c.addChip(chip) · c.removeChip(id) · c.chips() · c.clear() · c.focus() · c.setStatus(text, state) · c.destroy()
     c.registerActions(prefix='chat')   registers '<prefix>.focus' '<prefix>.stop' '<prefix>.clear' '<prefix>.attach'
   Text: paragraphs, `inline code`, **bold**, "- " lists and ``` fenced blocks (mono, with a copy mini). No HTML is ever parsed.
   Keyboard: Enter or Ctrl+Enter sends · Shift+Enter new line · Esc stops a running answer · Backspace in an empty
   composer removes the last chip · tool-call heads are buttons (Enter/Space toggles) · the log is a tab stop (scroll).
   Depends on: core, mini, base, button. */
(function (root) {
  'use strict';
  var VK = root.VK = root.VK || {};
  if (VK.chat) return;

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function hhmm(t) { var d = t instanceof Date ? t : new Date(t || Date.now()); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function fmtMs(ms) { if (ms == null) return ''; return ms < 1000 ? Math.round(ms) + ' ms' : (ms / 1000).toFixed(1).replace('.', ',') + ' s'; }
  function setIcon(svg, name) { var u = svg && svg.querySelector('use'); if (u) u.setAttribute('href', '#vk-i-' + name); }
  var STATE_HU = { running: 'Fut', done: 'Kész', error: 'Hiba', waiting: 'Várakozik', planned: 'Tervezett' };

  function copyText(text) {
    try { if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacyCopy(text); }); }
    catch (e) { /* fall through */ }
    return Promise.resolve(legacyCopy(text));
  }
  function legacyCopy(text) {
    var ta = VK.el('textarea', { 'aria-hidden': 'true', style: { position: 'fixed', left: '-9999px', top: '0' } });
    ta.value = text; document.body.appendChild(ta); ta.select();
    var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove(); return ok;
  }
  /** a copy mini: click copies get() and shows done (or error) for a moment */
  function copyMini(label, get, announce) {
    var m = VK.mini.create({ icon: 'copy', label: label, size: 'sm' });
    m.addEventListener('click', function () {
      VK.mini.set(m, { state: 'running', progress: null });
      copyText(get()).then(function (ok) {
        VK.mini.set(m, { state: ok ? 'done' : 'error', progress: 1 });
        if (announce) announce(ok ? 'Vágólapra másolva' : 'A másolás nem sikerült');
        setTimeout(function () { VK.mini.set(m, { state: 'idle', progress: 0 }); }, 1400);
      });
    });
    return m;
  }

  // ---- text rendering (never innerHTML) ----
  function inline(parent, s) {
    var re = /(`[^`\n]+`|\*\*[^*\n]+\*\*)/g, last = 0, m;
    while ((m = re.exec(s))) {
      if (m.index > last) lines(parent, s.slice(last, m.index));
      var tok = m[0];
      if (tok[0] === '`') parent.appendChild(VK.el('code.vk-chat__ic', { text: tok.slice(1, -1) }));
      else parent.appendChild(VK.el('strong', { text: tok.slice(2, -2) }));
      last = m.index + tok.length;
    }
    if (last < s.length) lines(parent, s.slice(last));
  }
  function lines(parent, s) {
    s.split('\n').forEach(function (part, i) { if (i) parent.appendChild(document.createElement('br')); if (part) parent.appendChild(document.createTextNode(part)); });
  }
  function prose(body, text) {
    text.split(/\n{2,}/).forEach(function (blk) {
      if (!blk.trim()) return;
      var ls = blk.replace(/^\n+|\n+$/g, '').split('\n');
      if (ls.every(function (l) { return /^\s*[-•]\s+/.test(l); })) {
        var ul = VK.el('ul.vk-chat__ul');
        ls.forEach(function (l) { var li = VK.el('li'); inline(li, l.replace(/^\s*[-•]\s+/, '')); ul.appendChild(li); });
        body.appendChild(ul);
      } else { var p = VK.el('p'); inline(p, blk.replace(/^\n+|\n+$/g, '')); body.appendChild(p); }
    });
  }
  function codeBlock(lang, code, announce) {
    var pre = VK.el('pre.vk-chat__pre', { tabindex: '0', 'aria-label': 'Kódblokk' + (lang ? ' (' + lang + ')' : '') }, VK.el('code', { text: code }));
    return VK.el('figure.vk-chat__code', null, [
      VK.el('figcaption.vk-chat__codehead', null, [VK.el('span.vk-label', { text: lang || 'kód' }), VK.el('span.vk-grow'), copyMini('Kód másolása', function () { return code; }, announce)]),
      pre
    ]);
  }
  function renderText(body, text, announce) {
    body.textContent = '';
    String(text || '').split('```').forEach(function (part, i) {
      if (i % 2) {
        var nl = part.indexOf('\n'), lang = nl >= 0 ? part.slice(0, nl).trim() : '', code = nl >= 0 ? part.slice(nl + 1) : part;
        body.appendChild(codeBlock(lang, code.replace(/\n$/, ''), announce));
      } else prose(body, part);
    });
  }
  function argText(v) { if (v == null) return ''; return typeof v === 'string' ? v : JSON.stringify(v, null, 2); }

  // ---- tool-call block (shared shape with trace) ----
  function toolBlock(t, open) {
    var st = t.state || 'running';
    var bodyId = VK.uid('vk-chat-tool');
    var mini = VK.el('span.vk-mini', { 'data-size': 'sm', 'aria-hidden': 'true' }, VK.icon('tool'));
    VK.mini.set(mini, { state: st === 'planned' ? 'idle' : st, progress: st === 'running' ? (t.progress == null ? null : t.progress) : st === 'done' || st === 'error' ? 1 : 0 });
    var head = VK.el('button.vk-chat__toolhead', { type: 'button', 'aria-expanded': open ? 'true' : 'false', 'aria-controls': bodyId }, [
      mini,
      VK.el('span.vk-chat__toolkind.vk-label', { text: 'Eszközhívás' }),
      VK.el('span.vk-chat__toolname.vk-mono.vk-ellipsis', { text: t.name || '' }),
      VK.el('span.vk-chat__toolstate', { 'data-state': st, text: STATE_HU[st] || st }),
      VK.el('span.vk-chat__toolms.vk-num', { text: fmtMs(t.ms) }),
      VK.icon('chevron-down', 'vk-chat__chev')
    ]);
    var body = VK.el('div.vk-chat__toolbody', { id: bodyId, hidden: !open });
    if (t.args != null) body.appendChild(VK.el('div.vk-chat__toolsec', null, [VK.el('span.vk-label', { text: 'Argumentumok' }), VK.el('pre.vk-chat__pre', { tabindex: '0' }, VK.el('code', { text: argText(t.args) }))]));
    if (t.result != null) body.appendChild(VK.el('div.vk-chat__toolsec', null, [VK.el('span.vk-label', { text: st === 'error' ? 'Hiba' : 'Eredmény' }), VK.el('pre.vk-chat__pre', { tabindex: '0', 'data-state': st }, VK.el('code', { text: argText(t.result) }))]));
    head.addEventListener('click', function () {
      var on = head.getAttribute('aria-expanded') !== 'true';
      head.setAttribute('aria-expanded', on ? 'true' : 'false'); body.hidden = !on;
    });
    return VK.el('div.vk-chat__tool', { 'data-state': st }, [head, body]);
  }

  function mount(el, opts) {
    opts = opts || {};
    var agent = opts.agent || 'Claude';
    var msgs = [], byId = {}, chips = [], busy = false, destroyed = false, pending = {}, raf = 0;
    var unregs = [];

    el.classList.add('vk-chat');
    el.textContent = '';
    if (!el.hasAttribute('data-vk-hop')) el.setAttribute('data-vk-hop', '');
    if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', 'Csevegés: ' + agent);

    // header
    var stMini = VK.el('span.vk-mini', { 'data-size': 'sm', 'aria-hidden': 'true' }, VK.icon('agent'));
    var statusEl = VK.el('span.vk-chat__status.vk-label');
    var clearMini = VK.mini.create({ icon: 'trash', label: 'Beszélgetés törlése', size: 'sm', onClick: function () { clear(); } });
    var head = VK.el('header.vk-chat__head', null, [
      stMini,
      VK.el('div.vk-chat__id', null, [VK.el('span.vk-chat__name.vk-title', { text: agent }), statusEl]),
      VK.el('span.vk-grow'),
      clearMini
    ]);

    // log
    var log = VK.el('div.vk-chat__log.vk-scroll', { role: 'log', 'aria-live': 'polite', 'aria-relevant': 'additions', tabindex: '0', 'aria-label': 'Üzenetek' });
    var list = VK.el('div.vk-chat__list');
    var empty = VK.el('div.vk-chat__empty');
    var thinking = VK.el('div.vk-chat__thinking', { hidden: true }, [VK.el('span.vk-chat__dots', { 'aria-hidden': 'true' }, [VK.el('i'), VK.el('i'), VK.el('i')]), VK.el('span', { text: 'Gondolkodik…' })]);
    log.appendChild(empty); log.appendChild(list); log.appendChild(thinking);
    var sr = VK.el('div.vk-sr-only', { role: 'status', 'aria-live': 'polite' });
    function announce(t) { sr.textContent = ''; setTimeout(function () { sr.textContent = t; }, 30); }

    function renderEmpty() {
      empty.textContent = '';
      empty.appendChild(VK.el('span.vk-chat__emptymark', { 'aria-hidden': 'true' }, VK.icon('spark', 'vk-icon--lg')));
      empty.appendChild(VK.el('p.vk-chat__emptytitle.vk-title', { text: opts.emptyTitle || 'Miben segíthetek?' }));
      empty.appendChild(VK.el('p.vk-chat__emptynote', { text: opts.emptyNote || 'Kérdezz a projektről, vagy küldj kijelölt csomópontokat kontextusként.' }));
      var sugg = opts.suggestions || [];
      if (sugg.length) {
        var ul = VK.el('ul.vk-chat__sugg', { 'aria-label': 'Javasolt kérdések' });
        sugg.forEach(function (s) {
          ul.appendChild(VK.el('li', null, VK.el('button.vk-chat__suggbtn', { type: 'button', onclick: function () { input.value = s; grow(); send(); } }, [VK.icon('arrow-right', 'vk-icon--sm'), VK.el('span', { text: s })])));
        });
        empty.appendChild(ul);
      }
    }

    // composer
    var chipBox = VK.el('div.vk-chat__chips', { role: 'list', 'aria-label': 'Kontextus' });
    var input = VK.el('textarea.vk-chat__input', { rows: '1', 'aria-label': 'Üzenet ' + agent + ' számára', placeholder: opts.placeholder || 'Írj üzenetet…', spellcheck: 'true' });
    var attachMini = VK.mini.create({ icon: 'attach', label: 'Csatolás', size: 'sm', onClick: function () { if (opts.onAttach) opts.onAttach(inst); } });
    var hint = VK.el('div.vk-chat__hint.vk-label', { 'aria-hidden': 'true' });
    var sendMini = VK.mini.create({ icon: 'send', label: 'Küldés', onClick: function () { if (busy) stop(); else send(); } });
    sendMini.classList.add('vk-chat__send');
    var form = VK.el('form.vk-chat__composer', { onsubmit: function (e) { e.preventDefault(); if (!busy) send(); } }, [
      chipBox,
      VK.el('div.vk-chat__inputrow', null, [attachMini, input, sendMini]),
      hint
    ]);
    el.appendChild(head); el.appendChild(log); el.appendChild(form); el.appendChild(sr);

    function grow() {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight + 2, parseFloat(getComputedStyle(input).maxHeight) || 9999) + 'px';
      syncSend();
    }
    function syncSend() {
      if (busy) return;
      var can = !!input.value.trim();
      sendMini.setAttribute('aria-disabled', can ? 'false' : 'true');
    }
    input.addEventListener('input', grow);
    input.addEventListener('keydown', function (e) {
      if (e.isComposing) return;
      if (e.key === 'Enter' && !e.shiftKey && !e.altKey) { e.preventDefault(); if (!busy) send(); return; }
      if (e.key === 'Escape' && busy) { e.preventDefault(); e.stopPropagation(); stop(); return; }
      if (e.key === 'Backspace' && !input.value && chips.length) { e.preventDefault(); removeChip(chips[chips.length - 1].id); }
    });

    // ---- chips ----
    function renderChips() {
      chipBox.textContent = '';
      chipBox.hidden = !chips.length;
      chips.forEach(function (c) {
        chipBox.appendChild(VK.el('span.vk-chat__chip', { role: 'listitem' }, [
          VK.icon(c.icon || 'pack', 'vk-icon--sm'),
          VK.el('span.vk-chat__chiplabel.vk-ellipsis', { text: c.label }),
          c.meta ? VK.el('span.vk-chat__chipmeta.vk-num', { text: c.meta }) : null,
          VK.el('button.vk-chat__chipx', { type: 'button', 'aria-label': 'Eltávolítás: ' + c.label, onclick: function () { removeChip(c.id); input.focus(); } }, VK.icon('close', 'vk-icon--sm'))
        ]));
      });
    }
    function addChip(c) { c = Object.assign({}, c); c.id = c.id || VK.uid('chip'); chips = chips.filter(function (x) { return x.id !== c.id; }).concat([c]); renderChips(); return c.id; }
    function removeChip(id) { var c = chips.find(function (x) { return x.id === id; }); chips = chips.filter(function (x) { return x.id !== id; }); renderChips(); if (c) announce('Kontextus eltávolítva: ' + c.label); }

    // ---- messages ----
    function msgNode(m) {
      var who = m.role === 'user' ? (opts.userName || 'Te') : m.role === 'tool' ? 'Eszköz' : m.role === 'system' ? 'Rendszer' : agent;
      var node = VK.el('article.vk-chat__msg', { 'data-role': m.role, 'aria-label': who });
      if (m.role !== 'tool') node.appendChild(VK.el('div.vk-chat__meta.vk-label', null, [VK.el('span', { text: who }), VK.el('span.vk-num', { text: hhmm(m.time) })]));
      if (m.chips && m.chips.length) node.appendChild(VK.el('div.vk-chat__msgchips', null, m.chips.map(function (c) {
        return VK.el('span.vk-chat__chip', { 'data-static': '' }, [VK.icon(c.icon || 'pack', 'vk-icon--sm'), VK.el('span.vk-chat__chiplabel.vk-ellipsis', { text: c.label }), c.meta ? VK.el('span.vk-chat__chipmeta.vk-num', { text: c.meta }) : null]);
      })));
      if (m.text != null && m.text !== '') { var body = VK.el('div.vk-chat__body'); renderText(body, m.text, announce); node.appendChild(body); }
      if (m.tool) node.appendChild(toolBlock(m.tool, m._open));
      if (m.streaming) node.setAttribute('data-streaming', '');
      return node;
    }
    function atBottom() { return log.scrollHeight - log.scrollTop - log.clientHeight < 48; }
    function toBottom() { log.scrollTop = log.scrollHeight; }
    function syncEmpty() { var e = !msgs.length; empty.hidden = !e; list.hidden = e; el.toggleAttribute('data-empty', e); }

    function add(m) {
      m = Object.assign({ role: 'assistant', time: Date.now() }, m);
      m.id = m.id || VK.uid('msg');
      if (byId[m.id]) return update(m.id, m);
      var stick = atBottom() || !msgs.length;
      msgs.push(m); byId[m.id] = m;
      m.node = msgNode(m); list.appendChild(m.node);
      syncEmpty();
      if (stick || m.role === 'user') toBottom();
      return m.id;
    }
    function update(id, patch) {
      var m = byId[id]; if (!m) return add(Object.assign({ id: id }, patch));
      var openNow = m.node && m.node.querySelector('.vk-chat__toolhead[aria-expanded="true"]');
      if (patch.tool && m.tool) patch = Object.assign({}, patch, { tool: Object.assign({}, m.tool, patch.tool) });
      Object.assign(m, patch); m._open = !!openNow;
      var hadFocus = m.node && m.node.contains(document.activeElement) && document.activeElement.classList.contains('vk-chat__toolhead');
      var stick = atBottom(), fresh = msgNode(m);
      m.node.replaceWith(fresh); m.node = fresh;
      if (hadFocus) { var h = fresh.querySelector('.vk-chat__toolhead'); if (h) h.focus(); }
      if (stick) toBottom();
      return id;
    }
    function flush() {
      raf = 0;
      Object.keys(pending).forEach(function (id) {
        var m = byId[id]; if (!m) return;
        var stick = atBottom();
        var body = m.node.querySelector('.vk-chat__body');
        if (!body) { body = VK.el('div.vk-chat__body'); m.node.appendChild(body); }
        renderText(body, m.text, announce);
        if (stick) toBottom();
      });
      pending = {};
    }
    function stream(id, chunk) {
      var m = byId[id];
      if (!m) { add({ id: id, role: 'assistant', text: '', streaming: true }); m = byId[id]; }
      m.text = (m.text || '') + chunk; m.streaming = true; m.node.setAttribute('data-streaming', '');
      thinking.hidden = true;
      pending[id] = true;
      if (!raf) raf = (root.requestAnimationFrame || setTimeout)(flush);
      return id;
    }
    function end(id) {
      var m = byId[id]; if (!m) return;
      flush(); m.streaming = false; m.node.removeAttribute('data-streaming');
    }

    // ---- busy / stop ----
    function setBusy(on, progress) {
      busy = !!on;
      el.toggleAttribute('data-busy', busy);
      if (busy) {
        var streamingNow = msgs.some(function (m) { return m.streaming; });
        thinking.hidden = streamingNow;
        setIcon(sendMini.querySelector('.vk-icon'), 'stop');
        sendMini.dataset.label = 'Leállítás'; sendMini.title = 'Leállítás (Esc)';
        sendMini.setAttribute('aria-disabled', 'false');
        VK.mini.set(sendMini, { state: 'running', progress: progress === undefined ? null : progress });
        VK.mini.set(stMini, { state: 'running', progress: null });
        setStatus(opts.busyStatus || 'Dolgozik', 'running', true);
        hint.textContent = 'Esc leállít';
      } else {
        thinking.hidden = true;
        msgs.forEach(function (m) { if (m.streaming) end(m.id); });
        setIcon(sendMini.querySelector('.vk-icon'), 'send');
        sendMini.dataset.label = 'Küldés'; sendMini.title = 'Küldés (Enter)';
        VK.mini.set(sendMini, { state: 'idle', progress: 0 });
        VK.mini.set(stMini, { state: 'idle', progress: 0 });
        setStatus(opts.status || 'Kész', 'idle', true);
        hint.textContent = 'Enter küld · Shift+Enter új sor';
        syncSend();
      }
    }
    function stop() {
      if (!busy) return;
      if (opts.onStop) opts.onStop(inst);
      setBusy(false);
      announce('Válasz leállítva');
    }
    function setStatus(text, state, keep) {
      statusEl.textContent = (opts.model ? opts.model + ' // ' : '') + text;
      if (!keep && state) VK.mini.set(stMini, { state: state });
    }

    function send() {
      var text = input.value.trim();
      if (!text || busy) return false;
      var used = chips.slice();
      add({ role: 'user', text: text, chips: used });
      input.value = ''; chips = []; renderChips(); grow();
      if (opts.onSend) opts.onSend(text, { chips: used, instance: inst });
      return true;
    }
    function clear() {
      msgs = []; byId = {}; list.textContent = ''; syncEmpty(); announce('Beszélgetés törölve');
    }

    function registerActions(prefix) {
      if (!VK.actions) return;
      prefix = prefix || 'chat';
      [
        { id: prefix + '.focus', label: 'Csevegés: üzenet írása', group: 'Ügynök', icon: 'chat', run: function () { input.focus(); } },
        { id: prefix + '.stop', label: 'Csevegés: válasz leállítása', group: 'Ügynök', icon: 'stop', when: function () { return busy; }, run: stop },
        { id: prefix + '.clear', label: 'Csevegés: beszélgetés törlése', group: 'Ügynök', icon: 'trash', when: function () { return msgs.length > 0; }, run: clear },
        { id: prefix + '.attach', label: 'Csevegés: csatolás', group: 'Ügynök', icon: 'attach', when: function () { return !!opts.onAttach; }, run: function () { opts.onAttach(inst); } }
      ].forEach(function (a) { a.at = ['palette', 'menu:chat']; VK.actions.register(a); unregs.push(a.id); });
    }

    function destroy() {
      if (destroyed) return; destroyed = true;
      unregs.forEach(function (id) { VK.actions.unregister(id); });
      el.textContent = ''; el.classList.remove('vk-chat');
    }

    var inst = {
      el: el, add: add, update: update, stream: stream, end: end, setBusy: setBusy, stop: stop, send: send,
      addChip: addChip, removeChip: removeChip, chips: function () { return chips.slice(); },
      clear: clear, focus: function () { input.focus(); }, setStatus: setStatus, registerActions: registerActions,
      input: input, destroy: destroy, messages: function () { return msgs.map(function (m) { var c = Object.assign({}, m); delete c.node; return c; }); }
    };

    renderEmpty();
    (opts.chips || []).forEach(addChip);
    renderChips();
    (opts.messages || []).forEach(add);
    syncEmpty();
    setBusy(false);
    return inst;
  }

  VK.chat = { mount: mount, toolBlock: toolBlock, renderText: renderText, copyText: copyText };
})(typeof window !== 'undefined' ? window : globalThis);
