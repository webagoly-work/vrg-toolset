// chat.js — "Claude" side chat (WP-24): ask about a selection, a file or a context pack, read the answer streamed, follow up,
// or move the conversation into an embedded Claude terminal.
// VRGPanes.chat = { mount(el, state, api), unmount(), state(), newThread(), attach(chip), focusInput() }.
// The engine is main's (shell/lib/chat.js, WP-23): the page sends prompts, act ids, pack ids and file handles, never a path; the answer
// comes back as events chat.delta / chat.tool / chat.done / chat.error. The answer is rendered with markdown-it (raw HTML off) and then
// sanitized with DOMPurify (SANITIZE_CONFIG); links never navigate the frame, they open in the browser pane.
// The pure helpers at the top are also exported for node --test (module.exports, only when `module` exists).
(function () {
  'use strict';

  // ------------------------------------------------------------ pure helpers
  const TITLE_MAX = 60, SEL_MAX = 64 * 1024;
  const KINDS = ['sel', 'pack', 'file'];
  const KIND_HU = { sel: 'Kijelölés', pack: 'Csomag', file: 'Fájl' };
  const HANDLE_RE = /^h:[A-Za-z0-9_-]{22}$/, PACK_RE = /^[A-Za-z0-9_-]{1,64}$/;

  // first prompt → thread title: whitespace collapsed, at most 60 characters, cut on code points so a surrogate pair is never split
  function threadTitle(s) {
    const t = Array.from(String(s == null ? '' : s).replace(/\s+/g, ' ').trim());
    return t.length > TITLE_MAX ? t.slice(0, TITLE_MAX).join('') : t.join('');
  }

  // keydown in the input → 'send' (Enter) | 'newline' (Shift+Enter, left to the textarea) | 'none'; IME composition never sends
  function keyAction(e) {
    if (!e || e.key !== 'Enter' || e.isComposing || e.ctrlKey || e.altKey || e.metaKey) return 'none';
    return e.shiftKey ? 'newline' : 'send';
  }

  // attachment chips: one per kind (a new one replaces the old one); the list is never changed in place
  function addChip(chips, chip) {
    const list = Array.isArray(chips) ? chips : [];
    if (!chip || !KINDS.includes(chip.kind)) return list;
    let c = null;
    if (chip.kind === 'sel' && typeof chip.text === 'string' && chip.text.trim()) c = { kind: 'sel', text: chip.text.slice(0, SEL_MAX) };
    else if (chip.kind === 'pack' && typeof chip.packId === 'string' && PACK_RE.test(chip.packId)) c = { kind: 'pack', packId: chip.packId };
    else if (chip.kind === 'file' && typeof chip.handle === 'string' && HANDLE_RE.test(chip.handle)) c = { kind: 'file', handle: chip.handle, name: String(chip.name || '').slice(0, 120) };
    if (!c) return list;
    return [...list.filter(x => x.kind !== c.kind), c];
  }
  const removeChip = (chips, kind) => (Array.isArray(chips) ? chips : []).filter(c => c.kind !== kind);
  // the chip list → the `attach` object of vrg.chat.start (undefined when there is none)
  function toAttach(chips) {
    const a = {};
    for (const c of Array.isArray(chips) ? chips : []) {
      if (c.kind === 'sel') a.text = c.text;
      else if (c.kind === 'pack') a.packId = c.packId;
      else if (c.kind === 'file') a.file = c.handle;
    }
    return Object.keys(a).length ? a : undefined;
  }
  const chipLabel = c => KIND_HU[c.kind] + (c.kind === 'file' && c.name ? ': ' + c.name : c.kind === 'sel' ? ': ' + threadTitle(c.text).slice(0, 30) : '');

  // DOMPurify config for the rendered answer: no script / iframe / form / media, no event handler attribute, links only http(s) or mailto
  const HANDLERS = ['onabort', 'onanimationend', 'onanimationstart', 'onauxclick', 'onbeforeunload', 'onblur', 'oncanplay', 'onchange', 'onclick', 'oncontextmenu',
    'oncopy', 'oncut', 'ondblclick', 'ondrag', 'ondragend', 'ondragenter', 'ondragleave', 'ondragover', 'ondragstart', 'ondrop', 'onerror', 'onfocus',
    'onfocusin', 'onfocusout', 'onhashchange', 'oninput', 'oninvalid', 'onkeydown', 'onkeypress', 'onkeyup', 'onload', 'onloadeddata', 'onloadstart',
    'onmousedown', 'onmouseenter', 'onmouseleave', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'onpaste', 'onpointerdown', 'onpointermove',
    'onpointerup', 'onreset', 'onresize', 'onscroll', 'onselect', 'onsubmit', 'ontoggle', 'ontouchend', 'ontouchstart', 'onwheel'];
  const SANITIZE_CONFIG = Object.freeze({
    USE_PROFILES: Object.freeze({ html: true }),
    FORBID_TAGS: Object.freeze(['script', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'form', 'input', 'button', 'textarea', 'select',
      'style', 'link', 'meta', 'base', 'img', 'picture', 'video', 'audio', 'source', 'svg', 'math']),
    FORBID_ATTR: Object.freeze([...HANDLERS, 'style', 'srcdoc', 'formaction', 'action']),
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:)/i,
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
  });
  const uriAllowed = href => typeof href === 'string' && SANITIZE_CONFIG.ALLOWED_URI_REGEXP.test(href.trim());
  const costLine = cost => (typeof cost === 'number' && isFinite(cost) && cost >= 0 ? 'Költség: $' + cost.toFixed(4) : '');
  const helpers = { threadTitle, keyAction, addChip, removeChip, toAttach, chipLabel, SANITIZE_CONFIG, uriAllowed, costLine, KINDS };

  if (typeof module !== 'undefined' && module.exports) module.exports = helpers;
  if (typeof window === 'undefined') return;

  // ------------------------------------------------------------ the pane
  const W = window, P = W.VRGPanes = W.VRGPanes || {};
  const el = (tag, role, text, title) => { const e = document.createElement(tag); if (role) e.dataset.role = role; if (text != null) e.textContent = text; if (title) e.title = title; return e; };
  const btn = (role, text, title, fn) => { const b = el('button', role, text, title); b.type = 'button'; b.addEventListener('click', fn); return b; };
  const loadScript = url => new Promise(res => {
    if (typeof url !== 'string' || !/^file:/i.test(url)) return res(false);
    const s = document.createElement('script'); s.src = url; s.onload = () => res(true); s.onerror = () => res(false); document.head.append(s);
  });
  const fmtTime = at => { const d = new Date(at); return isNaN(d) ? '' : d.toLocaleString('hu-HU', { dateStyle: 'short', timeStyle: 'short' }); };

  P.chat = {
    helpers,                                                      // the pure helpers; the selftest feeds SANITIZE_CONFIG to the real DOMPurify
    mount(root, state, api) {
      this.root = root; this.api = api || {}; this.vrg = (api && api.vrg) || W.vrg; this.gone = false;
      const s = state && typeof state === 'object' ? state : {};
      this.account = s.account === 'B' ? 'B' : 'A';
      this.tools = s.tools === 'none' ? 'none' : 'read';
      this.threads = new Map();                                   // chat id → { chat, account, title, at, session, msgs, running, tools }
      this.early = new Map();                                     // chat id → events that came before start() answered
      this.cur = null;                                            // the open thread, or null = a new one (draft)
      this.chips = [];
      this.md = null; this.pure = null;
      root.innerHTML = '';
      root.dataset.role = 'chat'; root.title = 'Claude side chat';
      root.style.cssText = 'display:flex;flex-direction:column;height:100%;min-height:0';
      this.build();
      this.offs = [];
      const on = (type, fn) => { if (this.vrg && this.vrg.on) this.offs.push(this.vrg.on('chat', type, m => { if (!this.gone) this.ev(type, m); })); };
      on('delta', 1); on('tool', 1); on('done', 1); on('error', 1);
      this.refreshList();                                          // earlier threads are listed; their text is not kept, so none is reopened on its own
      this.draw();
      if (this.vrg && this.vrg.call) {
        this.vrg.call('app', 'setting', { k: 'claude.account' }).then(r => { if (!this.gone && !this.cur && r && (r.v === 'A' || r.v === 'B')) { this.account = r.v; this.drawControls(); } }).catch(() => {});
      }
      this.loadLibs();
    },
    unmount() {
      this.gone = true;
      for (const off of this.offs || []) { try { off(); } catch (e) {} }
      if (this.root) this.root.innerHTML = '';
      this.root = null;
    },
    state() { return { account: this.account, tools: this.tools }; },

    // ---------------------------------------------------------- libs (markdown-it + DOMPurify, from the URLs main gives)
    async loadLibs() {
      let libs = {};
      try { const i = await this.vrg.app.info(); libs = (i && i.libs) || {}; } catch (e) {}
      if (!W.DOMPurify) await loadScript(libs.dompurify);
      if (!W.markdownit) await loadScript(libs.markdownIt);
      if (W.DOMPurify && W.markdownit) this.md = W.markdownit({ html: false, linkify: false });
      if (!this.gone) this.drawMessages();
    },
    // markdown → sanitized HTML string; without the libs the text is shown as plain text (never as HTML)
    render(src, node) {
      if (!this.md || !W.DOMPurify) { node.textContent = src; node.style.whiteSpace = 'pre-wrap'; return; }
      node.innerHTML = W.DOMPurify.sanitize(this.md.render(String(src)), SANITIZE_CONFIG);
    },

    // ---------------------------------------------------------- markup
    build() {
      const root = this.root;
      const head = el('div', 'head');
      head.append(el('strong', 'title', 'Claude', 'Claude side chat'), btn('new', 'Új beszélgetés', 'New conversation', () => this.newThread()));
      this.list = el('div', 'threads');
      this.list.style.cssText = 'max-height:25%;overflow:auto';
      this.msgs = el('div', 'messages');
      this.msgs.style.cssText = 'flex:1 1 auto;min-height:0;overflow:auto';
      this.msgs.setAttribute('aria-live', 'polite');
      this.msgs.addEventListener('click', e => {                  // a link in an answer opens in the browser pane, never in the frame
        const a = e.target.closest && e.target.closest('a');
        if (!a) return;
        e.preventDefault();
        const href = a.getAttribute('href') || '';
        if (/^https?:\/\//i.test(href)) this.openLink(href);
      });
      this.msgs.addEventListener('contextmenu', e => {            // the frame's menu takes over for a selection; origin 'chat'
        if (e.defaultPrevented) return;
        const text = String(W.getSelection ? W.getSelection() : '');
        if (!text.trim() || !this.vrg || !this.vrg.sel) return;
        e.preventDefault(); e.stopPropagation();
        this.vrg.sel.menu(text.slice(0, 65536), 'chat');
      });
      this.chipBox = el('div', 'chips');
      this.input = el('textarea', 'input'); this.input.rows = 3; this.input.placeholder = 'Kérdezz a Claude-tól…'; this.input.title = 'Enter: send, Shift+Enter: new line';
      this.input.style.cssText = 'width:100%;box-sizing:border-box';
      this.input.addEventListener('keydown', e => { if (keyAction(e) === 'send') { e.preventDefault(); this.send(); } });
      this.status = el('div', 'status'); this.status.setAttribute('role', 'status');
      this.controls = el('div', 'controls');
      this.acct = {};
      const acc = el('span', 'account', null, 'Account for a new conversation');
      for (const a of ['A', 'B']) { const b = this.acct[a] = btn('account-' + a, a, 'Claude account ' + a, () => { this.account = a; this.drawControls(); }); b.dataset.account = a; acc.append(b); }
      this.toolsBtn = btn('tools', '', 'Tools for a new conversation', () => { this.tools = this.tools === 'read' ? 'none' : 'read'; this.drawControls(); });
      this.sendBtn = btn('send', 'Küldés', 'Send (Enter)', () => this.send());
      this.stopBtn = btn('stop', 'Megállítás', 'Stop the answer', () => this.stop());
      this.copyBtn = btn('copy', 'Másolás', 'Copy the last answer', () => this.copy());
      this.termBtn = btn('to-term', 'Folytatás terminálban', 'Continue in a Claude terminal', () => this.toTerminal());
      this.controls.append(acc, this.toolsBtn, this.sendBtn, this.stopBtn, this.copyBtn, this.termBtn);
      root.append(head, this.list, this.msgs, this.chipBox, this.input, this.controls, this.status);
    },
    known(id) { return this.threads.has(id); },

    // ---------------------------------------------------------- drawing
    draw() { this.drawList(); this.drawMessages(); this.drawChips(); this.drawControls(); },
    drawList() {
      if (!this.list) return;
      this.list.innerHTML = '';
      const rows = [...this.threads.values()].sort((a, b) => String(b.at).localeCompare(String(a.at)));
      for (const t of rows) {
        const b = el('button', 'thread'); b.type = 'button'; b.dataset.chat = t.chat; b.dataset.account = t.account;
        b.setAttribute('aria-pressed', String(!!this.cur && this.cur.chat === t.chat));
        b.title = t.title;
        b.append(el('span', 'badge', t.account), el('span', 'name', ' ' + threadTitle(t.title)), el('span', 'time', ' ' + fmtTime(t.at)));
        b.addEventListener('click', () => this.openThread(t.chat));
        this.list.append(b);
      }
    },
    drawControls() {
      if (!this.controls) return;
      const t = this.cur;
      for (const a of ['A', 'B']) this.acct[a].setAttribute('aria-pressed', String(a === (t ? t.account : this.account)));
      const tools = t ? t.tools : this.tools;
      this.toolsBtn.textContent = tools === 'read' ? 'csak olvasás' : 'nincs eszköz';
      for (const b of [this.acct.A, this.acct.B, this.toolsBtn]) b.disabled = !!t;     // the switches only decide how a NEW thread starts
      this.stopBtn.disabled = !(t && t.running);
      this.sendBtn.disabled = !!(t && (t.running || !t.msgs.length));       // a thread from an earlier run can only continue in the terminal
      this.input.disabled = !!(t && !t.msgs.length);
      this.copyBtn.disabled = !(t && t.msgs.some(m => m.who === 'assistant' && m.parts.length));
      this.termBtn.disabled = !(t && t.session && !t.running);
      this.chipBox.hidden = !!t;
    },
    drawChips() {
      if (!this.chipBox) return;
      this.chipBox.innerHTML = '';
      for (const c of this.chips) {
        const chip = el('span', 'chip'); chip.dataset.kind = c.kind;
        chip.append(el('span', 'label', chipLabel(c)), btn('chip-remove', '✕', 'Remove', () => { this.chips = removeChip(this.chips, c.kind); this.drawChips(); }));
        this.chipBox.append(chip);
      }
    },
    drawMessages() {
      if (!this.msgs) return;
      this.msgs.innerHTML = '';
      const t = this.cur;
      if (!t) return;
      if (!t.msgs.length) this.msgs.append(el('p', 'old', 'A korábbi üzenetek nem láthatók.', 'The earlier messages are not shown.'));
      for (const m of t.msgs) { m.node = null; this.msgs.append(this.drawMsg(m)); }
      this.msgs.scrollTop = this.msgs.scrollHeight;
    },
    drawMsg(m) {
      const box = m.node || (m.node = el('div', 'msg'));
      box.dataset.who = m.who; box.dataset.deltas = String(m.deltas || 0);
      box.innerHTML = '';
      if (m.who === 'user') { const p = el('div', 'text', m.text); p.style.whiteSpace = 'pre-wrap'; box.append(p); return box; }
      for (const part of m.parts) {
        if (part.tool) { const n = el('div', 'tool', part.tool + ': ' + (part.target || '…')); n.style.fontSize = 'smaller'; box.append(n); }
        else { const n = el('div', 'text'); this.render(part.text, n); box.append(n); }
      }
      if (m.error) box.append(el('div', 'error', m.error));
      const c = costLine(m.cost);
      if (c) { const n = el('div', 'cost', c); n.style.fontSize = 'smaller'; box.append(n); }
      return box;
    },
    redraw(t, m) {                                                // one message changed: redraw that node only
      if (this.cur !== t || !this.msgs) return;
      const stick = this.msgs.scrollHeight - this.msgs.scrollTop - this.msgs.clientHeight < 40;
      if (m.node && m.node.isConnected) this.drawMsg(m); else this.msgs.append(this.drawMsg(m));
      if (stick) this.msgs.scrollTop = this.msgs.scrollHeight;
    },
    say(text) { if (this.status) this.status.textContent = text || ''; },

    // ---------------------------------------------------------- actions
    async refreshList() {
      let r = null;
      try { r = await this.vrg.chat.list(); } catch (e) {}
      if (this.gone || !r || !Array.isArray(r.chats)) return;
      for (const c of r.chats) {
        const t = this.threads.get(c.chat);
        if (t) { t.title = c.title || t.title; t.at = c.at || t.at; t.session = c.session || t.session; }
        else this.threads.set(c.chat, { chat: c.chat, account: c.account === 'B' ? 'B' : 'A', title: c.title || '', at: c.at || '', session: c.session || '', msgs: [], running: !!c.running, tools: 'read' });
      }
      this.drawList();
    },
    newThread() { this.cur = null; this.say(''); this.draw(); this.focusInput(); this.api.setState && this.api.setState(this.state()); },
    openThread(id) {
      const t = this.threads.get(id);
      if (!t) return;
      this.cur = t; this.say(''); this.draw(); this.focusInput();
      if (!t.msgs.length) { this.say('Folytatás csak terminálban lehetséges.'); this.loadHistory(t); }
      this.api.setState && this.api.setState(this.state());
    },
    // a thread from an earlier run: its saved text (chat.keepText on, DESK-Q63 B) comes back, and then it can continue here too
    async loadHistory(t) {
      if (!this.vrg.chat.history) return;
      let r = null;
      try { r = await this.vrg.chat.history(t.chat); } catch (e) {}
      if (this.gone || !r || !Array.isArray(r.msgs) || !r.msgs.length || t.msgs.length) return;
      t.msgs = r.msgs.map(m => (m.who === 'user' ? { who: 'user', text: String(m.text || '') }
        : { who: 'assistant', done: true, deltas: 0, parts: (Array.isArray(m.parts) ? m.parts : []).map(p => (p && p.tool ? { tool: String(p.tool).slice(0, 40), target: typeof p.target === 'string' ? p.target.slice(0, 200) : undefined } : { text: String((p && p.text) || '') })) }));
      if (this.cur === t) { this.say(''); this.draw(); }
    },
    focusInput() { if (this.input) this.input.focus(); },
    // attach({ kind:'sel', text } | { kind:'pack', packId } | { kind:'file', handle, name }): a new thread with the chip; nothing is sent until Enter
    attach(chip) {
      if (this.cur) this.newThread();
      this.chips = addChip(this.chips, chip);
      this.drawChips(); this.focusInput();
      return this.chips.length;
    },

    async send() {
      const text = this.input.value.trim();
      const t = this.cur;
      if (!text || (t && (t.running || !t.msgs.length))) return;
      this.say('');
      if (!t) {
        const r = await this.vrg.chat.start({ account: this.account, prompt: text, attach: toAttach(this.chips), tools: this.tools });
        if (this.gone) return;
        if (!r || !r.chat) { this.say((r && r.hu) || 'A kérés nem indult el.'); return; }
        const nt = { chat: r.chat, account: this.account, title: threadTitle(text), at: new Date().toISOString(), session: '', msgs: [], running: true, tools: this.tools };
        const labels = this.chips.map(chipLabel);
        nt.msgs.push({ who: 'user', text: (labels.length ? labels.map(l => '[' + l + ']').join(' ') + '\n' : '') + text });
        nt.msgs.push({ who: 'assistant', parts: [], deltas: 0 });
        this.threads.set(nt.chat, nt);
        this.chips = []; this.input.value = '';
        this.cur = nt;
        this.draw();
        this.api.setState && this.api.setState(this.state());
        for (const e of this.early.get(nt.chat) || []) this.ev(e.type, e.m);
        this.early.delete(nt.chat);
        return;
      }
      t.running = true;
      t.msgs.push({ who: 'user', text }, { who: 'assistant', parts: [], deltas: 0 });
      this.input.value = '';
      this.drawMessages(); this.drawControls();
      const r = await this.vrg.chat.follow(t.chat, text);
      if (this.gone) return;
      if (r && r.ok === false) { this.fail(t, r.hu || 'A kérés nem indult el.'); }
    },
    fail(t, hu) {
      const m = t.msgs[t.msgs.length - 1];
      t.running = false;
      if (m && m.who === 'assistant') { m.error = hu; this.redraw(t, m); }
      this.drawControls();
    },
    async stop() { if (this.cur && this.cur.running) await this.vrg.chat.stop(this.cur.chat); },
    async copy() {
      const t = this.cur;
      const m = t && [...t.msgs].reverse().find(x => x.who === 'assistant' && x.parts.length);
      if (!m) return;
      const text = m.parts.filter(p => p.text).map(p => p.text).join('');
      try { await navigator.clipboard.writeText(text); this.say('Másolva'); } catch (e) { this.say('A másolás nem sikerült.'); }
    },
    async toTerminal() {
      if (!this.cur) return;
      const r = await this.vrg.chat.toTerminal(this.cur.chat);
      if (this.gone) return;
      if (r && r.ok === false) this.say(r.hu || 'A terminál nem indult el.');
    },
    // links in an answer: the frame (VRGFrame.openUrl) shows them in a browser pane; without it the shell's web.open is used
    openLink(url) {
      if (W.VRGFrame && W.VRGFrame.openUrl) { W.VRGFrame.openUrl(url); return; }
      if (this.vrg && this.vrg.web) this.vrg.web.open(url, { newTab: true });
    },

    // ---------------------------------------------------------- events from main
    ev(type, m) {
      if (!m || typeof m.chat !== 'string') return;
      const t = this.threads.get(m.chat);      if (!t || !t.msgs.length) {                                  // the thread is not registered yet (start() has not answered): keep the event
        if (!t) { const q = this.early.get(m.chat) || []; q.push({ type, m }); this.early.set(m.chat, q.slice(-500)); }
        return;
      }
      const a = t.msgs[t.msgs.length - 1];
      if (!a || a.who !== 'assistant') return;
      if (type === 'delta' && typeof m.text === 'string') {
        const last = a.parts[a.parts.length - 1];
        if (last && last.text !== undefined) last.text += m.text; else a.parts.push({ text: m.text });
        a.deltas++;
        this.redraw(t, a);
      } else if (type === 'tool' && typeof m.name === 'string') {
        a.parts.push(typeof m.target === 'string' && m.target ? { tool: m.name.slice(0, 40), target: m.target.slice(0, 200) } : { tool: m.name.slice(0, 40) });
        this.redraw(t, a);
      } else if (type === 'done') {
        t.running = false;
        if (typeof m.session === 'string' && m.session) t.session = m.session;
        if (typeof m.cost === 'number') a.cost = m.cost;
        t.at = new Date().toISOString();
        a.done = true;
        this.redraw(t, a); this.drawControls(); this.drawList();
      } else if (type === 'error') {
        t.running = false;
        a.error = typeof m.hu === 'string' ? m.hu : 'Hiba történt.';
        this.redraw(t, a); this.drawControls();
      }
    },
  };
})();
