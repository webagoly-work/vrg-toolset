// web.js — Böngésző (WP-18): tabs, omnibox, back / forward / reload, bookmarks, history, find, zoom, local servers.
// The pages themselves are WebContentsViews that main places at the rect of the box carrying data-view (frame.js reports it); this
// file is only the chrome around them. The page never builds a URL: it sends words / URLs to vrg.web.go and ids to vrg.web.open
// (main decides, lib/search.js). A menu replaces the view box while it is open, because a native view always paints above the DOM.
// State { tabs: [url…], active: n } — tabs are re-opened as new views after a restart (view ids are per run).
// Keys (when the pane chrome has the focus): Ctrl+L address, Ctrl+F find, Ctrl+T new tab, Ctrl+= / Ctrl+- / Ctrl+0 zoom.
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : {};
  const P = W.VRGPanes = W.VRGPanes || {};
  const MAX_TABS = 20;
  const MAIL_TARGET = /^web:(gmail|outlook)$/;                // a mail tab is saved as its preset, so it comes back in the mail partition
  const MAIL = [{ id: 'gmail', hu: 'Gmail' }, { id: 'outlook', hu: 'Outlook' }];
  const unreadText = n => n + ' olvasatlan';

  // ------------------------------------------------------------ pure helpers (exported for tests)
  // the saved state → the URLs to re-open (http / https only, ≤ 500 chars, ≤ 20) and the active index
  function restoreList(state) {
    const raw = state && Array.isArray(state.tabs) ? state.tabs : [];
    const tabs = raw.filter(u => typeof u === 'string' && u.length <= 500 && (/^https?:\/\//i.test(u) || MAIL_TARGET.test(u))).slice(0, MAX_TABS);
    const a = state && Number.isInteger(state.active) ? state.active : 0;
    return { tabs, active: a >= 0 && a < tabs.length ? a : 0 };
  }
  const tabLabel = t => String((t && (t.title || t.url)) || 'Új lap').slice(0, 40);
  const percent = z => Math.round((Number(z) || 1) * 100) + '%';
  const sizeText = n => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : n >= 1024 ? Math.round(n / 1024) + ' KB' : n + ' B');
  // which key does what: 'address' | 'find' | 'newtab' | 'zoomin' | 'zoomout' | 'zoomreset' | ''
  function keyRoute(e) {
    if (!e || typeof e.key !== 'string' || !e.ctrlKey || e.altKey || e.metaKey) return '';
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (!e.shiftKey) {
      if (k === 'l') return 'address';
      if (k === 'f') return 'find';
      if (k === 't') return 'newtab';
      if (k === '-') return 'zoomout';
      if (k === '0') return 'zoomreset';
    }
    if (k === '=' || k === '+') return 'zoomin';
    return '';
  }

  const helpers = { restoreList, tabLabel, percent, sizeText, keyRoute, unreadText, MAX_TABS };
  if (typeof module !== 'undefined' && module.exports) module.exports = helpers;
  if (typeof document === 'undefined') return;

  // ------------------------------------------------------------ the pane
  const el = (tag, role, text) => { const e = document.createElement(tag); if (role) e.dataset.role = role; if (text !== undefined) e.textContent = text; return e; };
  const btn = (role, text, title) => { const b = el('button', role, text); b.type = 'button'; b.title = title; return b; };
  const claimed = new Set();                                   // view ids some web pane owns (a popup tab belongs to nobody yet)
  let lastActive = null;                                       // the pane that last had a tab chosen: it adopts popup tabs

  P.web = {
    helpers,
    mount(el0, state, api) {
      this.root = el0; this.api = api || {};
      this.vrg = this.api.vrg || W.vrg;
      this.tabs = []; this.active = null; this.zoom = {}; this.asks = []; this.gone = false; this.panelKind = ''; this.editing = false;
      this.offs = [];
      el0.innerHTML = '';
      el0.dataset.role = 'web';
      el0.style.display = 'flex'; el0.style.flexDirection = 'column';

      const strip = this.strip = el('div', 'web-tabs');
      const bar = this.bar = el('div', 'web-bar');
      this.back = btn('web-back', '←', 'Vissza'); this.fwd = btn('web-fwd', '→', 'Előre');
      this.reload = btn('web-reload', '⟳', 'Frissítés');
      this.omni = el('input', 'web-omni'); this.omni.type = 'text'; this.omni.placeholder = 'Cím vagy keresés'; this.omni.title = 'Address or search (Ctrl+L)';
      this.omni.spellcheck = false; this.omni.autocomplete = 'off';
      this.star = btn('web-bookmark', '☆', 'Könyvjelző');
      this.zoomLabel = el('span', 'web-zoom', '100%'); this.zoomLabel.title = 'Nagyítás';
      this.mailBtn = btn('web-mail', 'Posta', 'Posta — webmail (Gmail, Outlook)');
      this.serversBtn = btn('web-servers', 'Szerverek', 'Helyi szerverek / Local servers');
      this.historyBtn = btn('web-history', 'Előzmények', 'Előzmények és könyvjelzők / History and bookmarks');
      this.extBtn = btn('web-external', '↗', 'Megnyitás külső böngészőben / Open in the external browser');
      bar.append(this.back, this.fwd, this.reload, this.omni, this.star, this.zoomLabel, this.mailBtn, this.serversBtn, this.historyBtn, this.extBtn);

      const find = this.findBar = el('div', 'web-find'); find.hidden = true;
      this.findInput = el('input', 'web-find-input'); this.findInput.type = 'text'; this.findInput.placeholder = 'Keresés az oldalon'; this.findInput.title = 'Find in page (Ctrl+F)';
      this.findCount = el('span', 'web-find-count', '');
      this.findPrev = btn('web-find-prev', '↑', 'Previous'); this.findNext = btn('web-find-next', '↓', 'Next'); this.findClose = btn('web-find-close', '×', 'Close');
      find.append(this.findInput, this.findCount, this.findPrev, this.findNext, this.findClose);

      const ask = this.askBar = el('div', 'web-ask'); ask.hidden = true;
      this.askText = el('span', 'web-ask-text');
      this.askYes = btn('web-ask-yes', 'Igen', 'Yes'); this.askNo = btn('web-ask-no', 'Nem', 'No');
      ask.append(this.askText, this.askYes, this.askNo);

      const panel = this.panel = el('div', 'web-panel'); panel.hidden = true;
      panel.style.flex = '1 1 0'; panel.style.minHeight = '0'; panel.style.overflow = 'auto';
      const box = this.box = el('div', 'web-view');
      box.style.flex = '1 1 0'; box.style.minHeight = '0'; box.style.minWidth = '0';
      el0.append(strip, bar, find, ask, panel, box);

      this.wire();
      this.offs.push(
        this.vrg.on('web', 'state', m => this.onState(m)),
        this.vrg.on('web', 'ask', m => this.onAsk('perm', m)),
        this.vrg.on('web', 'download', m => this.onAsk('download', m)),
      );
      this.drawAll();
      this.restore(state);
    },
    unmount() {
      this.gone = true;
      for (const o of this.offs) { try { o(); } catch (e) {} }
      this.offs = [];
      for (const t of this.tabs) { claimed.delete(t.view); try { this.vrg.web.close(t.view); } catch (e) {} }
      this.tabs = [];
      if (lastActive === this) lastActive = null;
      if (this.root) this.root.innerHTML = '';
      this.root = null;
    },
    state() { return { tabs: this.tabs.map(t => (t.acc && MAIL_TARGET.test('web:' + t.acc) ? 'web:' + t.acc : t.url)).filter(u => (/^https?:\/\//i.test(u) || MAIL_TARGET.test(u)) && u.length <= 500).slice(0, MAX_TABS), active: Math.max(0, this.tabs.findIndex(t => t.view === this.active)) }; },

    // ---------------------------------------------------------- wiring
    wire() {
      const w = () => this.vrg.web;
      this.back.addEventListener('click', () => this.active && w().nav(this.active, 'back'));
      this.fwd.addEventListener('click', () => this.active && w().nav(this.active, 'fwd'));
      this.reload.addEventListener('click', () => { const t = this.cur(); if (t) w().nav(t.view, t.loading ? 'stop' : 'reload'); });
      this.omni.addEventListener('input', () => { this.editing = true; });
      this.omni.addEventListener('focus', () => this.omni.select());
      this.omni.addEventListener('blur', () => { this.editing = false; this.drawBar(); });
      this.omni.addEventListener('keydown', e => {
        e.stopPropagation();
        if (e.key === 'Enter') { e.preventDefault(); this.submit(this.omni.value); }
        else if (e.key === 'Escape') { e.preventDefault(); this.editing = false; this.drawBar(); this.omni.blur(); }
      });
      this.star.addEventListener('click', async () => {
        if (!this.active) return;
        await w().bookmark(this.active);
        this.drawStar();
      });
      this.extBtn.addEventListener('click', () => this.active && w().external(this.active));
      this.mailBtn.addEventListener('click', () => this.togglePanel('mail'));
      this.serversBtn.addEventListener('click', () => this.togglePanel('servers'));
      this.historyBtn.addEventListener('click', () => this.togglePanel('history'));

      this.findInput.addEventListener('input', () => this.find(''));
      this.findInput.addEventListener('keydown', e => {
        e.stopPropagation();
        if (e.key === 'Enter') { e.preventDefault(); this.find(e.shiftKey ? 'prev' : 'next'); }
        else if (e.key === 'Escape') { e.preventDefault(); this.closeFind(); }
      });
      this.findPrev.addEventListener('click', () => this.find('prev'));
      this.findNext.addEventListener('click', () => this.find('next'));
      this.findClose.addEventListener('click', () => this.closeFind());

      this.askYes.addEventListener('click', () => this.answer(true));
      this.askNo.addEventListener('click', () => this.answer(false));

      this.root.addEventListener('keydown', e => {
        const r = keyRoute(e);
        if (!r) return;
        e.preventDefault(); e.stopPropagation();
        if (r === 'address') { this.omni.focus(); }
        else if (r === 'find') this.openFind();
        else if (r === 'newtab') this.newTab();
        else this.setZoom(r === 'zoomin' ? 'in' : r === 'zoomout' ? 'out' : 'reset');
      });
    },
    cur() { return this.tabs.find(t => t.view === this.active) || null; },

    // ---------------------------------------------------------- tabs
    async restore(state) {
      const { tabs, active } = restoreList(state);
      const views = [];
      for (const u of tabs) { const v = await this.openTarget(u, false); views.push(v); if (this.gone) return; }
      const v = views[active] || views.find(Boolean);
      if (v) this.activate(v);
      else this.omni.focus();
    },
    // open a target in a new tab (main resolves srv: / web: / srch: / omni: ids); returns the view id or ''
    async openTarget(target, activate = true) {
      if (this.tabs.length >= MAX_TABS) return '';
      let r = null;
      try { r = await this.vrg.web.open(target, { newTab: true }); } catch (e) {}
      if (this.gone) { if (r && r.view) try { this.vrg.web.close(r.view); } catch (e) {} return ''; }
      if (!r || r.ok === false || !r.view) return '';
      this.adopt(r.view);
      if (activate) this.activate(r.view);
      return r.view;
    },
    adopt(view) {
      if (this.tabs.some(t => t.view === view)) return;
      claimed.add(view);
      this.tabs.push({ view, url: '', title: '', loading: true, canBack: false, canFwd: false, audible: false });
      this.drawTabs();
    },
    activate(view) {
      if (!this.tabs.some(t => t.view === view)) return;
      this.active = view; lastActive = this;
      this.closePanel();
      this.closeFind();
      this.box.dataset.view = view;
      this.drawAll();
    },
    newTab() { this.openTarget('https://www.google.com/').then(v => { if (v) this.omni.focus(); }); },
    // the Lapok focus a window through this (WP-46): the address / search box, so typing searches at once
    focusInput() { if (this.omni) { this.omni.focus(); this.omni.select(); } },
    closeTab(view) {
      const i = this.tabs.findIndex(t => t.view === view);
      if (i < 0) return;
      this.tabs.splice(i, 1);
      claimed.delete(view);
      this.vrg.web.close(view);
      if (this.active === view) {
        const n = this.tabs[Math.min(i, this.tabs.length - 1)];
        this.active = null; delete this.box.dataset.view;
        if (n) this.activate(n.view); else { this.drawAll(); this.omni.focus(); }
      } else this.drawTabs();
    },
    onState(m) {
      if (!m || typeof m.view !== 'string' || this.gone) return;
      let t = this.tabs.find(x => x.view === m.view);
      if (!t) {
        if (claimed.has(m.view) || lastActive !== this) return;
        this.adopt(m.view);                                    // a popup tab (target=_blank): it comes to the front
        t = this.tabs.find(x => x.view === m.view);
        this.activate(m.view);
      }
      Object.assign(t, { url: m.url || '', title: m.title || '', loading: !!m.loading, canBack: !!m.canBack, canFwd: !!m.canFwd, audible: !!m.audible });
      if (typeof m.acc === 'string' && MAIL.some(a => a.id === m.acc)) { t.acc = m.acc; t.unread = Number.isInteger(m.unread) && m.unread >= 0 ? m.unread : null; }
      this.drawTabs();
      if (m.view === this.active) this.drawBar();
    },
    async submit(text) {
      const input = String(text || '').trim();
      if (!input) return;
      this.editing = false;
      if (this.active) await this.vrg.web.go(this.active, input);
      else { const v = await this.openTarget('omni:' + input); if (!v) this.omni.focus(); }
      this.omni.blur();
    },

    // ---------------------------------------------------------- drawing
    drawAll() { this.drawTabs(); this.drawBar(); },
    drawTabs() {
      if (!this.root) return;
      const s = this.strip;
      s.innerHTML = '';
      for (const t of this.tabs) {
        const tab = el('span', 'web-tab');
        tab.dataset.tab = t.view;
        tab.setAttribute('aria-selected', String(t.view === this.active));
        const label = el('button', 'web-tab-title', tabLabel(t)); label.type = 'button'; label.title = t.url || t.title;
        label.addEventListener('click', () => this.activate(t.view));
        tab.append(label);
        if (t.acc && t.unread > 0) { const u = el('span', 'web-tab-unread', String(t.unread)); u.title = unreadText(t.unread); tab.append(u); }
        if (t.audible) { const a = el('span', 'web-tab-audible', '♪'); a.title = 'Hangot játszik'; tab.append(a); }
        const x = btn('web-tab-close', '×', 'Close'); x.addEventListener('click', () => this.closeTab(t.view));
        tab.append(x);
        s.append(tab);
      }
      const add = btn('web-tab-new', '+', 'New tab (Ctrl+T)'); add.addEventListener('click', () => this.newTab());
      s.append(add);
    },
    drawBar() {
      if (!this.root) return;
      const t = this.cur();
      this.back.disabled = !t || !t.canBack; this.fwd.disabled = !t || !t.canFwd; this.reload.disabled = !t;
      this.reload.textContent = t && t.loading ? '✕' : '⟳';
      this.reload.title = t && t.loading ? 'Megállítás' : 'Frissítés';
      this.star.disabled = !t; this.extBtn.disabled = !t;
      if (!this.editing) this.omni.value = t ? t.url : '';
      this.zoomLabel.textContent = percent(t ? this.zoom[t.view] : 1);
      this.drawStar();
      this.drawAsk();
    },
    async drawStar() {
      const t = this.cur();
      let on = false;
      if (t && t.url) { try { const r = await this.vrg.web.bookmarks(); on = !!(r && r.bookmarks && r.bookmarks.some(b => b.url === t.url)); } catch (e) {} }
      if (!this.root) return;
      this.star.textContent = on ? '★' : '☆';
      this.star.setAttribute('aria-pressed', String(on));
    },

    // ---------------------------------------------------------- panels (servers, history)
    togglePanel(kind) { if (this.panelKind === kind) this.closePanel(); else this.openPanel(kind); },
    closePanel() {
      this.panelKind = '';
      if (!this.root) return;
      this.panel.hidden = true; this.panel.innerHTML = '';
      this.box.hidden = false;
    },
    async openPanel(kind) {
      this.panelKind = kind;
      this.box.hidden = true; this.panel.hidden = false;
      this.panel.innerHTML = '';
      this.panel.dataset.panel = kind;
      if (kind === 'servers') await this.drawServers(); else if (kind === 'mail') this.drawMail(); else await this.drawHistory();
    },
    // "Posta": one button per webmail preset; the Founder signs in inside the tab (own partition, nothing of ours handles a password)
    drawMail() {
      const p = this.panel;
      p.innerHTML = '';
      p.append(el('h3', 'web-panel-title', 'Posta'));
      for (const a of MAIL) {
        const t = this.tabs.find(x => x.acc === a.id);
        const b = btn('web-mail-open', a.hu + (t && t.unread > 0 ? ' · ' + unreadText(t.unread) : ''), 'web:' + a.id);
        b.dataset.mail = a.id;
        b.addEventListener('click', () => { if (t) this.activate(t.view); else this.openTarget('web:' + a.id); });
        p.append(b);
      }
    },
    async drawServers() {
      const p = this.panel;
      let list = { servers: [], presets: [], providers: [] }, up = {};
      try { const r = await this.vrg.web.servers(); if (r && r.ok !== false) list = r; } catch (e) {}
      try { up = (await this.vrg.ports()) || {}; } catch (e) {}
      if (this.panelKind !== 'servers' || !this.root) return;
      p.innerHTML = '';
      p.append(el('h3', 'web-panel-title', 'Helyi szerverek'));
      for (const s of list.servers || []) {
        const b = btn('web-server', s.name, 'srv:' + s.id + ' · ' + s.port);
        b.dataset.server = s.id; b.dataset.up = String(!!up[s.port]);
        b.textContent = (up[s.port] ? '● ' : '○ ') + s.name;
        b.addEventListener('click', () => this.openTarget('srv:' + s.id));
        p.append(b);
      }
      for (const x of list.presets || []) {
        const b = btn('web-preset', x.hu, 'web:' + x.id);
        b.dataset.preset = x.id;
        b.addEventListener('click', () => this.openTarget('web:' + x.id));
        p.append(b);
      }
    },
    async drawHistory() {
      const p = this.panel;
      let bms = [], rows = [];
      try { const r = await this.vrg.web.bookmarks(); if (r && r.ok !== false) bms = r.bookmarks || []; } catch (e) {}
      try { const r = await this.vrg.web.history(); if (r && r.ok !== false) rows = r.history || []; } catch (e) {}
      if (this.panelKind !== 'history' || !this.root) return;
      p.innerHTML = '';
      const row = (role, r) => {
        const b = btn(role, String(r.title || r.url).slice(0, 80), r.url);
        b.dataset.url = r.url;
        b.addEventListener('click', () => this.visit(r.url));
        p.append(b);
      };
      p.append(el('h3', 'web-panel-title', 'Könyvjelző'));
      for (const b of bms) row('web-bookmark-row', b);
      p.append(el('h3', 'web-panel-title', 'Előzmények'));
      const clear = btn('web-history-clear', 'Előzmények törlése', 'Clear history');
      clear.addEventListener('click', async () => { await this.vrg.web.clearHistory(); this.openPanel('history'); });
      p.append(clear);
      for (const r of rows) row('web-history-row', r);
    },
    visit(url) {
      const t = this.cur();
      if (t) { this.closePanel(); this.vrg.web.go(t.view, url); }
      else this.openTarget(url);
    },

    // ---------------------------------------------------------- find, zoom
    openFind() { if (!this.active) return; this.findBar.hidden = false; this.findInput.focus(); this.findInput.select(); },
    closeFind() {
      if (!this.root || this.findBar.hidden) return;
      this.findBar.hidden = true; this.findCount.textContent = '';
      if (this.active) this.vrg.web.find(this.active, '');
    },
    async find(dir) {
      if (!this.active) return;
      const q = this.findInput.value;
      const r = await (dir ? this.vrg.web.find(this.active, q, dir) : this.vrg.web.find(this.active, q));
      if (!this.root) return;
      this.findCount.textContent = q && r && r.ok !== false ? (r.active || 0) + '/' + (r.matches || 0) : '';
    },
    async setZoom(z) {
      const t = this.cur();
      if (!t) return;
      const r = await this.vrg.web.zoom(t.view, z);
      if (r && r.ok !== false && typeof r.zoom === 'number') { this.zoom[t.view] = r.zoom; if (this.root) this.zoomLabel.textContent = percent(r.zoom); }
    },

    // ---------------------------------------------------------- asks (permissions, downloads): one at a time, for the active tab's view
    onAsk(kind, m) {
      if (!m || typeof m.ask !== 'string' || !this.tabs.some(t => t.view === m.view)) return;
      this.asks.push({ kind, ask: m.ask, view: m.view, m });
      this.drawAsk();
    },
    drawAsk() {
      if (!this.root) return;
      this.asks = this.asks.filter(a => this.tabs.some(t => t.view === a.view));
      const a = this.asks[0];
      this.askBar.hidden = !a;
      if (!a) return;
      this.askText.textContent = a.kind === 'download'
        ? 'Letöltés: ' + a.m.name + (a.m.size ? ' (' + sizeText(a.m.size) + ')' : '') + ' — mehet?'
        : (a.m.origin + ' engedélyt kér: ' + a.m.perm);
      this.askYes.textContent = a.kind === 'download' ? 'Letöltés' : 'Engedélyezem';
      this.askNo.textContent = a.kind === 'download' ? 'Mégse' : 'Tiltom';
    },
    answer(allow) {
      const a = this.asks.shift();
      if (a) this.vrg.web.answer(a.ask, allow === true);
      this.drawAsk();
    },
  };
})();
