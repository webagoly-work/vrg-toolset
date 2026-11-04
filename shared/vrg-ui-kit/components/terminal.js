/* VRG UI Kit — components/terminal.js — a console pane: scrollback, prompt line, history, completion, running-command mini.
     var t = VK.terminal.mount(el, {
       title: 'Konzol', tag: 'TTY 01', prompt: 'vrg@planner:~$', greeting: ['…'], max: 2000,
       surface: 'terminal',                 // commands = registry actions on this surface; action.command = 'build planner'
                                            //   (default: the id's last part). run(ctx) gets ctx.term, ctx.args, ctx.line.
       onCommand: function (line, term) {}, // optional: return true when handled (checked before the registry)
       complete: function (value) {},       // optional Tab completion: → [full candidates]; default = the surface's commands
       onInterrupt: function (term) {}      // Ctrl+C / the running mini while busy
     })
     t.print(text, tone?) one or more lines · t.write(chunk, tone?) no newline · t.progress(p, label) → {set(p, label), end()}
     t.setBusy(label, progress?) — the running-command mini (progress 0…1 | null) · t.finish('done'|'error')
     t.run(line) as if typed · t.clear() · t.copy() (selection inside the scrollback, else everything) · t.focus()
     t.history() · t.registerActions(prefix='terminal') · t.destroy()
   Tones (ANSI-ish, token-mapped): ok · warn · crit · info · muted · accent · strong. ANSI SGR is understood too:
     31 crit · 32 ok · 33 warn · 34 info · 35/36 accent · 2/90 muted · 1 strong · 0 reset.
   Built-ins: help (lists the surface's commands), clear.
   Keyboard (in the prompt): Enter run · ↑/↓ history · Tab complete (only when there is text and a match; otherwise Tab
   leaves) · Ctrl+L clear · Ctrl+C interrupt (or abandon the line) · Esc clear the line. The scrollback is a tab stop.
   Depends on: core, mini, base. Optional: actions (surface commands). */
(function (root) {
  'use strict';
  var VK = root.VK = root.VK || {};
  if (VK.terminal) return;

  var TONES = ['ok', 'warn', 'crit', 'info', 'muted', 'accent', 'strong'];
  var SGR = { 31: 'crit', 91: 'crit', 32: 'ok', 92: 'ok', 33: 'warn', 93: 'warn', 34: 'info', 94: 'info', 35: 'accent', 36: 'accent', 96: 'accent', 2: 'muted', 90: 'muted', 1: 'strong' };

  function copyText(text) {
    if (VK.chat && VK.chat.copyText) return VK.chat.copyText(text);
    try { if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return false; }); }
    catch (e) { /* ignore */ }
    return Promise.resolve(false);
  }
  function cmdOf(a) { return a.command || a.id.split('.').pop(); }

  function mount(el, opts) {
    opts = opts || {};
    var hist = (opts.history || []).slice(), hi = -1, draft = '', cur = null, busy = false, unregs = [], destroyed = false, finT = 0;
    var max = opts.max || 2000;

    el.classList.add('vk-term');
    el.textContent = '';
    if (!el.hasAttribute('data-vk-hop')) el.setAttribute('data-vk-hop', '');
    el.setAttribute('role', 'region');
    if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', opts.title || 'Konzol');

    var runMini = VK.mini.create({ icon: 'terminal', label: 'Utolsó parancs újrafuttatása', size: 'sm', onClick: function () {
      if (busy) interrupt(); else if (hist.length) run(hist[hist.length - 1]); else input.focus();
    } });
    runMini.classList.add('vk-term__runmini');
    var runLabel = VK.el('span.vk-term__job.vk-label.vk-ellipsis', { text: 'Tétlen' });
    var copyMini = VK.mini.create({ icon: 'copy', label: 'Kijelölés másolása', size: 'sm', onClick: function () { copy(); } });
    var clearMini = VK.mini.create({ icon: 'trash', label: 'Konzol törlése (Ctrl+L)', size: 'sm', onClick: function () { clear(); input.focus(); } });
    var head = VK.el('header.vk-term__head', null, [
      runMini,
      VK.el('span.vk-term__title.vk-title', { text: opts.title || 'Konzol' }),
      opts.tag ? VK.el('span.vk-label.vk-term__tag', { text: opts.tag }) : null,
      runLabel, VK.el('span.vk-grow'), copyMini, clearMini
    ]);
    var out = VK.el('div.vk-term__out.vk-scroll', { role: 'log', 'aria-live': 'polite', 'aria-relevant': 'additions', tabindex: '0', 'aria-label': 'Kimenet' });
    var inId = VK.uid('vk-term-in');
    var ps = VK.el('label.vk-term__ps', { for: inId, text: opts.prompt || '$' });
    var input = VK.el('input.vk-term__input#' + inId, { type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Parancs', enterkeyhint: 'send' });
    var form = VK.el('form.vk-term__prompt', { onsubmit: function (e) { e.preventDefault(); submit(); } }, [ps, input]);
    el.appendChild(head); el.appendChild(out); el.appendChild(form);

    // ---- output ----
    function newLine(cls) { cur = VK.el('div.vk-term__line' + (cls ? '.' + cls : '')); out.appendChild(cur); trim(); return cur; }
    function trim() { while (out.childElementCount > max) out.removeChild(out.firstElementChild); }
    function atBottom() { return out.scrollHeight - out.scrollTop - out.clientHeight < 40; }
    function stick(fn) { var b = atBottom(); fn(); if (b) out.scrollTop = out.scrollHeight; }
    function seg(text, tone) { var s = VK.el('span', { text: text }); if (tone) s.setAttribute('data-tone', tone); return s; }
    /** append text (with ANSI SGR) to the current line; '\n' starts a new one */
    function write(chunk, tone) {
      stick(function () {
        var t = String(chunk == null ? '' : chunk), re = /\x1b\[([\d;]*)m/g, m, last = 0, tn = tone || null;
        function emit(s) {
          s.split('\n').forEach(function (part, i) {
            if (i) newLine();
            if (!cur) newLine();
            if (part) cur.appendChild(seg(part, tn));
          });
        }
        while ((m = re.exec(t))) {
          emit(t.slice(last, m.index)); last = m.index + m[0].length;
          (m[1] || '0').split(';').forEach(function (c) { c = +c; tn = c === 0 ? (tone || null) : SGR[c] || tn; });
        }
        emit(t.slice(last));
      });
    }
    function print(text, tone) {
      if (cur && !cur.childNodes.length) { /* reuse an empty current line */ } else newLine();
      write(String(text == null ? '' : text), tone);
      cur = null;
    }
    function echo(line) {
      stick(function () { var l = newLine('vk-term__cmd'); l.appendChild(seg((opts.prompt || '$') + ' ', 'accent')); l.appendChild(seg(line)); cur = null; });
    }
    function progress(p, label) {
      var line, fill, pct, lab;
      stick(function () {
        line = newLine('vk-term__progline'); cur = null;
        fill = VK.el('span.vk-term__fill');
        pct = VK.el('span.vk-term__pct', { 'data-tone': 'muted' }); lab = VK.el('span');
        line.appendChild(VK.el('span.vk-term__bar', { 'aria-hidden': 'true' }, fill)); line.appendChild(pct); line.appendChild(lab);
      });
      function set(q, l) {
        q = VK.clamp(+q || 0, 0, 1);
        fill.style.width = (q * 100).toFixed(1) + '%'; pct.textContent = String(Math.round(q * 100)).padStart(3, ' ') + '%';
        if (l != null) lab.textContent = l;
        if (busy) VK.mini.set(runMini, { progress: q });
      }
      set(p, label || '');
      return { set: set, end: function (tone) { line.setAttribute('data-done', tone || 'ok'); fill.style.width = '100%'; } };
    }
    function clear() { out.textContent = ''; cur = null; }

    // ---- busy ----
    function setBusy(label, p) {
      clearTimeout(finT);
      if (label === false) { busy = false; el.removeAttribute('data-busy'); VK.mini.set(runMini, { state: 'idle', progress: 0 }); runMini.dataset.label = 'Utolsó parancs újrafuttatása'; VK.mini.set(runMini, {}); runLabel.textContent = 'Tétlen'; return; }
      busy = true; el.setAttribute('data-busy', '');
      runMini.dataset.label = 'Megszakítás (Ctrl+C): ' + label;
      runLabel.textContent = 'Fut: ' + label;
      VK.mini.set(runMini, { state: 'running', progress: p === undefined ? null : p });
    }
    function finish(state) {
      var was = runLabel.textContent.replace(/^Fut: /, '');
      busy = false; el.removeAttribute('data-busy');
      runMini.dataset.label = 'Utolsó parancs újrafuttatása';
      VK.mini.set(runMini, { state: state === 'error' ? 'error' : 'done', progress: 1 });
      runLabel.textContent = (state === 'error' ? 'Hiba: ' : 'Kész: ') + was;
      finT = setTimeout(function () { if (!busy) { VK.mini.set(runMini, { state: 'idle', progress: 0 }); runLabel.textContent = 'Tétlen'; } }, 2400);
    }
    function interrupt() {
      if (!busy) return;
      if (opts.onInterrupt) opts.onInterrupt(inst);
      print('^C megszakítva', 'warn');
      finish('error');
    }

    // ---- commands ----
    function commands() { return opts.surface && VK.actions ? VK.actions.forSurface(opts.surface) : []; }
    function help() {
      var list = commands();
      print('Elérhető parancsok:', 'strong');
      var w = Math.max.apply(null, list.map(function (a) { return cmdOf(a).length; }).concat(['help'.length, 'clear'.length]));
      function row(c, d) { var l = newLine(); l.appendChild(seg('  ' + c.padEnd(w + 2, ' '), 'accent')); l.appendChild(seg(d || '', 'muted')); cur = null; }
      stick(function () {
        list.forEach(function (a) { row(cmdOf(a), a.hint || a.label); });
        row('help', 'ez a lista'); row('clear', 'a kimenet törlése (Ctrl+L)');
      });
    }
    function exec(line) {
      if (opts.onCommand && opts.onCommand(line, inst) === true) return;
      if (line === 'clear' || line === 'cls') { clear(); return; }
      if (line === 'help' || line === '?') { help(); return; }
      var best = null;
      commands().forEach(function (a) { var c = cmdOf(a); if ((line === c || line.indexOf(c + ' ') === 0) && (!best || c.length > cmdOf(best).length)) best = a; });
      if (best) {
        var c = cmdOf(best), args = line.slice(c.length).trim();
        VK.actions.run(best, VK.actions.ctx({ term: inst, line: line, args: args ? args.split(/\s+/) : [] }), 'terminal');
        return;
      }
      print('ismeretlen parancs: ' + line.split(/\s+/)[0] + ' — írd be: help', 'crit');
    }
    function run(line) {
      line = String(line || '').trim();
      echo(line);
      if (!line) return;
      if (hist[hist.length - 1] !== line) hist.push(line);
      hi = -1; draft = '';
      if (busy) { print('egy parancs még fut — Ctrl+C a megszakításhoz', 'warn'); return; }
      exec(line);
    }
    function submit() { var v = input.value; input.value = ''; run(v); }

    function candidates(v) {
      if (opts.complete) return opts.complete(v, inst) || [];
      var all = commands().map(cmdOf).concat(['help', 'clear']);
      return all.filter(function (c) { return c.indexOf(v) === 0 && c !== v; });
    }
    function complete() {
      var v = input.value; if (!v.trim()) return false;
      var list = candidates(v); if (!list.length) return false;
      if (list.length === 1) { input.value = list[0] + ' '; return true; }
      var pre = list.reduce(function (a, b) { var i = 0; while (i < a.length && a[i] === b[i]) i++; return a.slice(0, i); });
      if (pre.length > v.length) input.value = pre;
      else { echo(v); print(list.join('    '), 'muted'); }
      return true;
    }

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') return;   // the form submits
      if (e.ctrlKey && !e.altKey && (e.key === 'l' || e.key === 'L')) { e.preventDefault(); clear(); return; }
      if (e.ctrlKey && !e.altKey && (e.key === 'c' || e.key === 'C') && input.selectionStart === input.selectionEnd) {
        e.preventDefault();
        if (busy) interrupt(); else { echo(input.value + '^C'); input.value = ''; }
        return;
      }
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.key === 'ArrowUp' && !e.shiftKey) {
        if (!hist.length) return; e.preventDefault();
        if (hi < 0) { draft = input.value; hi = hist.length; }
        hi = Math.max(0, hi - 1); input.value = hist[hi];
        moveEnd();
      } else if (e.key === 'ArrowDown' && !e.shiftKey) {
        if (hi < 0) return; e.preventDefault();
        hi += 1; if (hi >= hist.length) { hi = -1; input.value = draft; } else input.value = hist[hi];
        moveEnd();
      } else if (e.key === 'Tab' && !e.shiftKey) {
        if (complete()) e.preventDefault();
      } else if (e.key === 'Escape' && input.value) { e.preventDefault(); e.stopPropagation(); input.value = ''; hi = -1; }
    });
    function moveEnd() { var n = input.value.length; setTimeout(function () { try { input.setSelectionRange(n, n); } catch (x) { /* ignore */ } }, 0); }
    el.addEventListener('keydown', function (e) {
      if (e.target === input) return;
      if (e.ctrlKey && !e.altKey && (e.key === 'l' || e.key === 'L')) { e.preventDefault(); clear(); }
    });
    // a plain click in the scrollback (no text selected) returns to the prompt, like a terminal
    out.addEventListener('mouseup', function () { var s = root.getSelection && root.getSelection(); if (!s || s.isCollapsed) input.focus({ preventScroll: true }); });

    function selectionText() {
      var s = root.getSelection && root.getSelection();
      if (s && !s.isCollapsed && out.contains(s.anchorNode) && out.contains(s.focusNode)) return s.toString();
      return '';
    }
    function copy() {
      var t = selectionText() || Array.prototype.map.call(out.children, function (l) { return l.textContent; }).join('\n');
      VK.mini.set(copyMini, { state: 'running', progress: null });
      return copyText(t).then(function (ok) {
        VK.mini.set(copyMini, { state: ok ? 'done' : 'error', progress: 1 });
        setTimeout(function () { VK.mini.set(copyMini, { state: 'idle', progress: 0 }); }, 1400);
        return ok;
      });
    }
    // keep the copy mini's label honest about what it copies
    document.addEventListener('selectionchange', onSel);
    function onSel() { copyMini.dataset.label = selectionText() ? 'Kijelölés másolása' : 'Teljes kimenet másolása'; VK.mini.set(copyMini, {}); }

    function registerActions(prefix) {
      if (!VK.actions) return;
      prefix = prefix || 'terminal';
      [
        { id: prefix + '.focus', label: 'Konzol: ugrás a parancssorra', icon: 'terminal', run: function () { input.focus(); } },
        { id: prefix + '.clear', label: 'Konzol törlése', icon: 'trash', run: clear },
        { id: prefix + '.copy', label: 'Konzol: kimenet másolása', icon: 'copy', run: copy },
        { id: prefix + '.interrupt', label: 'Konzol: futó parancs megszakítása', icon: 'stop', when: function () { return busy; }, run: interrupt }
      ].forEach(function (a) { a.group = 'Konzol'; a.at = ['palette', 'menu:terminal']; VK.actions.register(a); unregs.push(a.id); });
    }
    function destroy() {
      if (destroyed) return; destroyed = true;
      document.removeEventListener('selectionchange', onSel);
      unregs.forEach(function (id) { VK.actions.unregister(id); });
      el.textContent = ''; el.classList.remove('vk-term');
    }

    var inst = {
      el: el, input: input, print: print, write: write, progress: progress, setBusy: setBusy, finish: finish, interrupt: interrupt,
      run: run, clear: clear, copy: copy, focus: function () { input.focus(); }, history: function () { return hist.slice(); },
      isBusy: function () { return busy; }, registerActions: registerActions, destroy: destroy
    };
    (opts.greeting || []).forEach(function (l) { print(l, 'muted'); });
    onSel();
    return inst;
  }

  VK.terminal = { mount: mount, TONES: TONES };
})(typeof window !== 'undefined' ? window : globalThis);
