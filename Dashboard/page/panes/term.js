// term.js — Terminál (WP-15): one real shell in an xterm.js terminal, fed by the pty manager of WP-14 through vrg.term.
// State { prof, at? }: a pane is re-opened as a NEW session after a restart, never restored; `at` (a folder handle, 'repo' or 'line:<id>')
// is only used for the first start and is not persisted (handles are per run).
// Keys: everything goes to the pty except Ctrl+Shift+C / V / F / T, the frame's own keys, and Shift+Enter (sent as ESC CR, the
// Alt+Enter form Claude Code reads as "newline in the prompt"; xterm.js cannot tell Shift+Enter from Enter, so the CLI would submit).
// xterm 6.0.0 and its fit addon are classic UMD scripts: the URLs come from app.info().libs; when main does not list them yet the
// page falls back to the tools/js-libs path relative to this page (page/ → Dashboard/ → repo → Full).
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : {};
  const P = W.VRGPanes = W.VRGPanes || {};

  // ------------------------------------------------------------ pure helpers (exported for tests)
  // a paste with a line break needs a confirm: "a\nb" yes, "ab" no, a single trailing newline still counts
  const pasteLines = text => (String(text == null ? '' : text).match(/\r\n|\r|\n/g) || []).length + 1;
  const pasteNeedsConfirm = text => /[\r\n]/.test(String(text == null ? '' : text));

  // where one key event goes: 'copy' | 'paste' | 'find' | 'newtab' | 'frame' | 'newline' | 'pty'
  function keyRoute(e) {
    if (!e || typeof e.key !== 'string') return 'pty';
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (e.metaKey) return 'pty';
    if (e.ctrlKey && e.shiftKey && !e.altKey) {
      if (k === 'c') return 'copy';
      if (k === 'v') return 'paste';
      if (k === 'f') return 'find';
      if (k === 't') return 'newtab';
      if (k === 'p' || k === '\\' || k === '|') return 'frame';          // palette, stacked split (default keymap)
    }
    if (e.ctrlKey && !e.shiftKey && !e.altKey && (k === 'w' || k === '\\')) return 'frame';   // close tab, split
    if (e.ctrlKey && e.altKey && /^Arrow(Left|Right|Up|Down)$/.test(e.key)) return 'frame';   // focus between panes
    if (e.key === 'Enter' && e.shiftKey && !e.ctrlKey && !e.altKey) return 'newline';
    return 'pty';
  }

  // the "Nem érhető el" tooltip text for an unavailable profile
  const unavailable = p => 'Nem érhető el: ' + (p && p.reason ? p.reason : 'ismeretlen ok');

  // search the lines (array of strings) for q, case-insensitive: [{ row, col }] in reading order
  function findAll(lines, q) {
    const out = [];
    const n = String(q || '').toLowerCase();
    if (!n) return out;
    lines.forEach((line, row) => {
      const s = String(line).toLowerCase();
      for (let i = s.indexOf(n); i >= 0; i = s.indexOf(n, i + n.length)) out.push({ row, col: i });
    });
    return out;
  }

  // split text for vrg.term.write (≤ 64 KB per call), never between the halves of a surrogate pair
  function chunks(text, max) {
    const out = [];
    const m = max || 60000;
    for (let i = 0; i < text.length;) {
      let j = Math.min(text.length, i + m);
      if (j < text.length && text.charCodeAt(j - 1) >= 0xd800 && text.charCodeAt(j - 1) <= 0xdbff) j--;
      out.push(text.slice(i, j)); i = j;
    }
    return out;
  }

  const helpers = { pasteNeedsConfirm, pasteLines, keyRoute, unavailable, findAll, chunks };
  if (typeof module !== 'undefined' && module.exports) module.exports = helpers;
  if (typeof document === 'undefined') return;

  // ------------------------------------------------------------ the pane
  const el = (tag, role, text) => { const e = document.createElement(tag); if (role) e.dataset.role = role; if (text !== undefined) e.textContent = text; return e; };
  const libBase = () => new URL('../../../tools/js-libs/', document.baseURI).href;
  const FALLBACK = () => ({ xterm: libBase() + 'xterm/lib/xterm.js', fit: libBase() + 'xterm-addon-fit/lib/addon-fit.js' });

  const loaded = {};
  function loadScript(url) {
    if (typeof url !== 'string' || !/^file:/i.test(url)) return Promise.resolve(false);
    if (!loaded[url]) {
      loaded[url] = new Promise(res => {
        const s = document.createElement('script');
        s.src = url; s.onload = () => res(true); s.onerror = () => res(false);
        document.head.append(s);
      });
    }
    return loaded[url];
  }
  async function loadLibs() {
    let libs = {};
    try { const i = await W.vrg.app.info(); libs = i && i.libs || {}; } catch (e) {}
    const fb = FALLBACK();
    if (!W.Terminal && !(await loadScript(libs.xterm || fb.xterm))) return false;
    if (!(W.FitAddon && W.FitAddon.FitAddon) && !(await loadScript(libs.fit || fb.fit))) return false;
    return !!W.Terminal && !!(W.FitAddon && W.FitAddon.FitAddon);
  }

  P.term = {
    helpers,
    mount(el0, state, api) {
      this.root = el0; this.api = api || {};
      this.prof = state && typeof state.prof === 'string' ? state.prof : '';
      this.at = state && state.at !== undefined ? state.at : undefined;
      this.id = null; this.exited = false; this.gone = false; this.pending = null; this.hits = []; this.hit = -1;
      this.offs = [];
      el0.innerHTML = '';
      el0.dataset.role = 'term';
      el0.style.display = 'flex'; el0.style.flexDirection = 'column';

      const bar = this.bar = el('div', 'term-bar');
      const newTab = this.newTab = el('button', 'term-new', 'Új lap'); newTab.type = 'button'; newTab.title = 'New tab';
      const menu = this.menu = el('div', 'term-profiles'); menu.hidden = true;
      newTab.addEventListener('click', () => { menu.hidden = !menu.hidden; if (!menu.hidden) this.drawProfiles(); });
      bar.append(newTab, menu);

      const find = this.findBar = el('div', 'term-find'); find.hidden = true;
      const fin = this.findInput = el('input', 'term-find-input'); fin.type = 'text'; fin.placeholder = 'Keresés'; fin.title = 'Find';
      fin.addEventListener('input', () => this.find(0));
      fin.addEventListener('keydown', e => {
        e.stopPropagation();
        if (e.key === 'Enter') { e.preventDefault(); this.find(e.shiftKey ? -1 : 1); }
        else if (e.key === 'Escape') { e.preventDefault(); this.closeFind(); }
      });
      find.append(fin);

      const ask = this.askBar = el('div', 'term-confirm'); ask.hidden = true;
      this.askText = el('span', 'term-confirm-text');
      const yes = el('button', 'term-confirm-yes', 'Beillesztés'); yes.type = 'button';
      const no = el('button', 'term-confirm-no', 'Mégse'); no.type = 'button';
      yes.addEventListener('click', () => this.answerPaste(true));
      no.addEventListener('click', () => this.answerPaste(false));
      ask.append(this.askText, yes, no);

      const host = this.host = el('div', 'term-host');
      host.style.flex = '1 1 0'; host.style.minHeight = '0'; host.style.minWidth = '0'; host.style.overflow = 'hidden';
      this.note = el('div', 'term-note'); this.note.hidden = true;
      el0.append(bar, find, ask, this.note, host);

      // a paste goes through us: a multi-line one is confirmed first; term.paste() then respects bracketed paste mode
      host.addEventListener('paste', e => {
        const text = e.clipboardData ? e.clipboardData.getData('text/plain') : '';
        e.preventDefault(); e.stopPropagation();
        if (text) this.paste(text);
      }, true);
      host.addEventListener('mousedown', () => { if (this.term) setTimeout(() => this.term && this.term.focus(), 0); });
      // WP-19: right-click with a selection in the terminal → the selection menu (without one, nothing changes)
      host.addEventListener('contextmenu', e => {
        const s = this.term && this.term.hasSelection() ? this.term.getSelection() : '';
        if (!s.trim() || !W.vrg || !W.vrg.sel) return;
        e.preventDefault();
        W.vrg.sel.menu(s.slice(0, 65536), 'term');
      });

      if (this.prof) this.start(); else { this.menu.hidden = false; this.drawProfiles(); }
    },
    unmount() {
      this.gone = true;
      clearTimeout(this.rt);
      for (const o of this.offs) { try { o(); } catch (e) {} }
      this.offs = [];
      if (this.ro) { try { this.ro.disconnect(); } catch (e) {} }
      if (this.id) { try { W.vrg.term.kill(this.id); } catch (e) {} }
      if (this.term) { try { this.term.dispose(); } catch (e) {} }
      this.term = null; this.id = null;
      if (this.root) this.root.innerHTML = '';
      this.root = null;
    },
    state() { return this.prof ? { prof: this.prof } : {}; },

    // ---------------------------------------------------------- profiles menu
    async drawProfiles() {
      const menu = this.menu;
      menu.innerHTML = '';
      let list = [];
      try { const r = await W.vrg.term.profiles(); if (r && r.ok !== false) list = r.profiles || []; } catch (e) {}
      if (this.gone) return;
      for (const p of list) {
        const b = el('button', 'term-profile', p.hu || p.id); b.type = 'button';
        b.dataset.prof = p.id;
        if (p.available === false) { b.disabled = true; b.title = unavailable(p); }
        else b.title = p.id;
        b.addEventListener('click', () => {
          menu.hidden = true;
          if (!this.prof && !this.id) { this.prof = p.id; this.start(); }
          else if (this.api.open) this.api.open('term', { prof: p.id });
        });
        menu.append(b);
      }
    },

    // ---------------------------------------------------------- session
    async start() {
      this.note.hidden = false; this.note.textContent = 'Betöltés…';
      const ok = await loadLibs();
      if (this.gone) return;
      if (!ok) { this.note.textContent = 'A terminál ebben a buildben nem érhető el.'; return; }
      this.note.hidden = true;
      if (!this.term) this.build();
      this.exited = false;
      this.term.reset();
      const r = await W.vrg.term.open(this.prof, this.at);
      if (this.gone) { if (r && r.term) W.vrg.term.kill(r.term); return; }
      if (!r || r.ok === false || !r.term) {
        this.id = null;
        this.term.write('\r\n[' + ((r && r.hu) || 'a terminál nem indult el') + (r && r.reason ? ' — ' + unavailable(r) : '') + ']');
        return;
      }
      this.at = undefined;                                       // only the first start uses it; a restart opens in the profile's default folder
      this.id = r.term;
      this.root.dataset.term = r.term;
      this.fit(true);
      this.term.focus();
    },
    build() {
      const term = this.term = new W.Terminal({
        scrollback: 10000, cursorBlink: true, allowProposedApi: false,
        fontFamily: 'Cascadia Mono, Consolas, monospace', fontSize: 13,
        windowsPty: { backend: 'conpty' },
      });
      this.fitAddon = new W.FitAddon.FitAddon();
      term.loadAddon(this.fitAddon);
      term.open(this.host);
      term.attachCustomKeyEventHandler(e => this.onKey(e));
      term.onData(d => this.input(d));
      term.onResize(s => { if (this.id) W.vrg.term.resize(this.id, Math.max(2, s.cols), Math.max(2, s.rows)); });
      term.onSelectionChange(() => { if (this.copyOnSelect !== false && this.findBar.hidden && term.hasSelection()) this.copy(); });
      this.ro = new ResizeObserver(() => { clearTimeout(this.rt); this.rt = setTimeout(() => this.fit(), 50); });
      this.ro.observe(this.host);
      try { W.vrg.call('app', 'setting', { k: 'term.copyOnSelect' }).then(r => { if (r && r.ok !== false && typeof r.v === 'boolean') this.copyOnSelect = r.v; }).catch(() => {}); } catch (e) {}
      const mine = m => m && this.id && m.term === this.id;
      this.offs.push(
        W.vrg.on('term', 'data', m => { if (mine(m) && this.term) this.term.write(m.data); }),
        W.vrg.on('term', 'exit', m => { if (mine(m)) this.onExit(m.code); }),
      );
    },
    fit(force) {
      if (!this.term || !this.host || !this.host.clientWidth || !this.host.clientHeight) return;
      try { this.fitAddon.fit(); } catch (e) {}
      if (force && this.id) W.vrg.term.resize(this.id, Math.max(2, this.term.cols), Math.max(2, this.term.rows));
    },
    onExit(code) {
      this.exited = true; this.id = null;
      this.term.write('\r\n[kilépett: ' + code + '] — Enter: újraindítás');
    },
    input(d) {
      if (this.exited) { if (/^[\r\n]/.test(d)) this.start(); return; }
      if (!this.id) return;
      for (const c of chunks(d)) W.vrg.term.write(this.id, c);
    },

    // ---------------------------------------------------------- keys, copy, paste, find
    onKey(e) {
      const route = keyRoute(e);
      if (route === 'pty') return true;
      if (e.type !== 'keydown') return false;
      if (route === 'frame') return false;                       // bubbles to the frame's own handlers
      e.preventDefault();
      if (route === 'copy') this.copy();
      else if (route === 'paste') this.pasteClipboard();
      else if (route === 'find') this.openFind();
      else if (route === 'newtab') { if (this.api.open) this.api.open('term', { prof: this.prof }); }
      else if (route === 'newline') this.input('\x1b\r');
      return false;
    },
    copy() {
      const s = this.term && this.term.getSelection();
      if (!s) return;
      try { navigator.clipboard.writeText(s).catch(() => {}); } catch (e) {}
    },
    async pasteClipboard() {
      let t = '';
      try { t = await navigator.clipboard.readText(); } catch (e) {}
      if (t && !this.gone) this.paste(t);
    },
    paste(text) {
      if (!this.term) return;
      if (!pasteNeedsConfirm(text)) { this.term.paste(text); return; }
      this.pending = text;
      this.askText.textContent = 'Több soros beillesztés (' + pasteLines(text) + ' sor)?';
      this.askBar.hidden = false;
    },
    answerPaste(yes) {
      const t = this.pending;
      this.pending = null; this.askBar.hidden = true;
      if (yes && t && this.term) this.term.paste(t);
      if (this.term) this.term.focus();
    },
    openFind() { this.findBar.hidden = false; this.findInput.focus(); this.findInput.select(); },
    closeFind() { this.findBar.hidden = true; this.hits = []; this.hit = -1; if (this.term) { this.term.clearSelection(); this.term.focus(); } },
    find(dir) {                                                  // dir 0 = new query, 1 next, -1 previous
      if (!this.term) return;
      const b = this.term.buffer.active;
      if (dir === 0) {
        const lines = [];
        for (let i = 0; i < b.length; i++) lines.push(b.getLine(i).translateToString(true));
        this.hits = findAll(lines, this.findInput.value); this.hit = -1;
      }
      if (!this.hits.length) { this.term.clearSelection(); return; }
      this.hit = (this.hit + (dir || 1) + this.hits.length) % this.hits.length;
      const h = this.hits[this.hit];
      this.term.select(h.col, h.row, this.findInput.value.length);
      this.term.scrollToLine(Math.max(0, h.row - Math.floor(this.term.rows / 2)));
    },
  };
})();
