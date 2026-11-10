// mail.js — "Posta" (WP-28): accounts, the inbox, search, a safe read view, attachments saved on request.
// VRGPanes.mail = { mount(el, state, api), unmount(), state() }.
// Gmail API accounts (WP-27) are read through vrg.mail; webmail accounts (WP-26, 'web:<id>') open their web tab. The message itself is shown by a
// separate local view that main places over the box marked data-view="mailview": no preload, sandbox, JavaScript off, a CSP that blocks
// remote images until "Képek betöltése". DESK-Q73 B (WP-35a): this pane receives the message HTML as sent and cleans it with DOMPurify
// (VRGMailClean, shell/lib/mailclean.js; the URL comes from app.info().libs) before handing it to the read view. It never inserts message HTML
// into its own DOM: the headers are set as text, the body only goes back to main as a string. Without DOMPurify the read view shows the text part.
// The pure helpers at the top are also exported for node --test (module.exports, only when `module` exists).
(function () {
  'use strict';

  // ------------------------------------------------------------ pure helpers
  const SNIPPET_MAX = 140;
  // "Nagy Béla <bela@example.test>" → "Nagy Béla"; a bare address stays as it is
  function senderName(from) {
    const s = String(from == null ? '' : from).trim();
    const m = /^"?([^"<]*?)"?\s*<([^>]*)>$/.exec(s);
    return m ? (m[1].trim() || m[2].trim()) : s;
  }
  function shortDate(d) {
    const t = new Date(d);
    return isNaN(t) ? String(d == null ? '' : d).slice(0, 40) : t.toLocaleString('hu-HU', { dateStyle: 'short', timeStyle: 'short' });
  }
  function sizeText(n) {
    const b = Number(n) || 0;
    return b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(1) + ' KB' : (b / 1048576).toFixed(1) + ' MB';
  }
  const clip = (s, n) => { const a = Array.from(String(s == null ? '' : s).replace(/\s+/g, ' ').trim()); return a.length > n ? a.slice(0, n).join('') + '…' : a.join(''); };
  const helpers = { senderName, shortDate, sizeText, clip, SNIPPET_MAX };

  if (typeof module !== 'undefined' && module.exports) module.exports = helpers;
  if (typeof window === 'undefined') return;

  // ------------------------------------------------------------ the pane
  const W = window, P = W.VRGPanes = W.VRGPanes || {};
  const el = (tag, role, text, title) => { const e = document.createElement(tag); if (role) e.dataset.role = role; if (text != null) e.textContent = text; if (title) e.title = title; return e; };
  const btn = (role, text, title, fn) => { const b = el('button', role, text, title); b.type = 'button'; b.addEventListener('click', fn); return b; };
  const toast = (ok, hu, en) => { if (W.VRGToasts) W.VRGToasts.toast({ ok, hu, en: en || hu }); };
  const loadScript = url => new Promise(res => {
    if (!url || !/^file:/i.test(url)) return res(false);
    const s = document.createElement('script'); s.src = url; s.onload = () => res(true); s.onerror = () => res(false); document.head.appendChild(s);
  });
  let purifyReady = null;                                                // DOMPurify once per page, from the URL main gives (never a guessed path)
  const purify = vrg => purifyReady || (purifyReady = (async () => {
    if (W.DOMPurify) return W.DOMPurify;
    let libs = {};
    try { const i = await vrg.app.info(); libs = (i && i.libs) || {}; } catch (e) {}
    await loadScript(libs.dompurify);
    return W.DOMPurify || null;
  })());
  const cleanHtml = async (vrg, html) => {
    if (!html || !W.VRGMailClean) return '';
    let dp = null;
    try { dp = await purify(vrg); } catch (e) {}
    return W.VRGMailClean.clean(dp, html);
  };

  P.mail = {
    helpers,
    mount(root, state, api) {
      this.root = root; this.vrg = (api && api.vrg) || W.vrg; this.api = api || {}; this.gone = false;
      const s = state && typeof state === 'object' ? state : {};
      this.acc = typeof s.acc === 'string' ? s.acc : '';
      this.q = typeof s.q === 'string' ? s.q.slice(0, 200) : '';
      this.accounts = []; this.next = ''; this.cur = null; this.seq = 0; this.offs = [];
      root.innerHTML = '';
      root.dataset.role = 'mail'; root.title = 'Mail';
      root.style.cssText = 'display:flex;flex-direction:column;height:100%;min-height:0';
      this.build();
      if (this.vrg && this.vrg.on) this.offs.push(this.vrg.on('mail', 'link', m => { if (!this.gone) this.link(m); }));
      this.loadAccounts();
    },
    unmount() {
      this.gone = true;
      for (const off of this.offs || []) { try { off(); } catch (e) {} }
      try { this.vrg && this.vrg.mail && this.vrg.mail.closeView(); } catch (e) {}
      if (this.root) this.root.innerHTML = '';
      this.root = null;
    },
    state() { return { acc: this.acc, q: this.q }; },

    // ---------------------------------------------------------- layout
    build() {
      const top = el('div', 'mail-top');
      top.style.cssText = 'display:flex;gap:6px;align-items:center;flex-wrap:wrap';
      this.accBar = el('div', 'mail-accounts'); this.accBar.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap';
      this.qIn = el('input', 'mail-q'); this.qIn.type = 'text'; this.qIn.maxLength = 200; this.qIn.placeholder = 'Keresés'; this.qIn.title = 'Search (Gmail query syntax)';
      this.qIn.value = this.q;
      this.qIn.addEventListener('keydown', e => { if (e.key === 'Enter') this.search(); });
      this.qBtn = btn('mail-search', 'Keresés', 'Search', () => this.search());
      this.msg = el('div', 'mail-msg'); this.msg.setAttribute('role', 'status');
      top.append(this.accBar, this.qIn, this.qBtn);

      const body = el('div', 'mail-body'); body.style.cssText = 'display:flex;flex:1;min-height:0;gap:6px';
      const left = el('div', 'mail-left'); left.style.cssText = 'display:flex;flex-direction:column;width:38%;min-width:200px;min-height:0';
      this.list = el('div', 'mail-list'); this.list.style.cssText = 'overflow:auto;flex:1;min-height:0';
      this.more = btn('mail-more', 'Továbbiak', 'More', () => this.loadList(true)); this.more.hidden = true;
      left.append(this.list, this.more);

      const right = el('div', 'mail-right'); right.style.cssText = 'display:flex;flex-direction:column;flex:1;min-width:0;min-height:0';
      this.head = el('div', 'mail-head');
      this.bar = el('div', 'mail-bar'); this.bar.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;align-items:center';
      this.imgBtn = btn('mail-images', 'Képek betöltése', 'Load remote images (this message only)', () => this.showMessage(this.cur, true)); this.imgBtn.hidden = true;
      this.copyBtn = btn('mail-copy-address', 'Cím másolása', 'Copy address', () => this.copyAddress()); this.copyBtn.hidden = true;
      this.bar.append(this.imgBtn, this.copyBtn);
      this.atts = el('div', 'mail-atts');
      this.box = el('div', 'mail-viewbox'); this.box.style.cssText = 'flex:1;min-height:120px;position:relative';   // main places the read view over this box
      right.append(this.head, this.bar, this.atts, this.box);
      body.append(left, right);
      this.root.append(top, this.msg, body);
    },
    say(hu, en) { this.msg.textContent = hu || ''; this.msg.title = en || ''; },

    // ---------------------------------------------------------- accounts
    async loadAccounts() {
      let r = null;
      try { r = await this.vrg.mail.accounts(); } catch (e) {}
      if (this.gone) return;
      this.accounts = r && r.ok !== false && Array.isArray(r.accounts) ? r.accounts : [];
      if (!this.accounts.some(a => a.acc === this.acc && a.kind === 'gmail')) this.acc = (this.accounts.find(a => a.kind === 'gmail') || {}).acc || '';
      this.drawAccounts();
      const a = this.accounts.find(x => x.acc === this.acc);
      if (a && a.signedIn) this.loadList(false);
      else this.drawSignIn();
    },
    drawAccounts() {
      this.accBar.replaceChildren();
      for (const a of this.accounts) {
        const row = el('span', 'mail-account'); row.dataset.acc = a.acc; row.dataset.kind = a.kind; row.dataset.signedIn = a.signedIn ? '1' : '0';
        const pick = btn('mail-account-pick', a.hu, a.kind === 'web' ? 'Webmail: ' + a.acc : 'Gmail API', () => this.pick(a));
        if (a.acc === this.acc) pick.setAttribute('aria-pressed', 'true');
        row.append(pick);
        if (a.kind === 'gmail') {
          if (a.signedIn) row.append(btn('mail-signout', 'Kijelentkezés', 'Sign out', () => this.signOut(a)));
          else row.append(btn('mail-signin', 'Bejelentkezés', 'Sign in', () => this.signIn(a)));
        }
        this.accBar.append(row);
      }
    },
    pick(a) {
      if (a.kind === 'web') { if (W.VRGFrame && W.VRGFrame.mail) W.VRGFrame.mail(a.acc); return; }   // webmail: its own web tab
      this.acc = a.acc; this.drawAccounts();
      if (a.signedIn) this.loadList(false); else this.drawSignIn();
    },
    drawSignIn() {
      this.list.replaceChildren(); this.more.hidden = true; this.head.textContent = ''; this.atts.replaceChildren();
      this.hideView();
      this.say(this.acc ? 'Az OAuth bejelentkezés a rendszer böngészőjében nyílik meg.' : 'Nincs levél', 'OAuth sign-in opens in the system browser.');
    },
    async signIn(a) {
      this.say('Az OAuth bejelentkezés a rendszer böngészőjében nyílik meg.', 'OAuth sign-in opens in the system browser.');
      let r = null;
      try { r = await this.vrg.mail.signIn(a.acc); } catch (e) {}
      if (this.gone) return;
      if (!r || !r.ok) { this.say((r && r.hu) || 'A bejelentkezés nem sikerült.'); return; }
      this.say('');
      this.acc = a.acc;
      await this.loadAccounts();
    },
    async signOut(a) {
      try { await this.vrg.mail.signOut(a.acc); } catch (e) {}
      if (this.gone) return;
      this.cur = null;
      await this.loadAccounts();
    },

    // ---------------------------------------------------------- inbox
    search() { this.q = this.qIn.value.trim().slice(0, 200); this.loadList(false); },
    async loadList(more) {
      if (!this.acc) return;
      const seq = ++this.seq;
      const page = more && this.next ? this.next : undefined;
      let r = null;
      try { r = await this.vrg.mail.list(this.acc, this.q || undefined, page); } catch (e) {}
      if (this.gone || seq !== this.seq) return;
      if (!r || !r.ok) {
        if (!more) this.list.replaceChildren();
        this.more.hidden = true;
        this.say((r && r.hu) || 'A levelek nem töltődtek be.');
        return;
      }
      this.say('');
      if (!more) this.list.replaceChildren();
      const items = Array.isArray(r.items) ? r.items : [];
      for (const it of items) this.list.append(this.row(it));
      this.next = typeof r.next === 'string' ? r.next : '';
      this.more.hidden = !this.next;
      if (!this.list.children.length) this.list.append(el('p', 'mail-empty', 'Nincs levél', 'No mail'));
    },
    row(it) {
      const b = el('button', 'mail-item'); b.type = 'button';
      b.dataset.msg = String(it.msg); b.dataset.unread = it.unread ? '1' : '0';
      b.style.cssText = 'display:block;width:100%;text-align:left';
      const top = el('div', 'mail-item-top');
      if (it.unread) top.append(el('span', 'mail-unread', '●', 'Olvasatlan'));
      top.append(el('span', 'mail-from', senderName(it.from)), el('span', 'mail-date', ' · ' + shortDate(it.date)));
      b.append(top, el('div', 'mail-subject', String(it.subject || '')), el('div', 'mail-snippet', clip(it.snippet, SNIPPET_MAX)));
      b.addEventListener('click', () => this.open(it, b));
      return b;
    },

    // ---------------------------------------------------------- read
    async open(it, rowEl) {
      for (const x of this.list.querySelectorAll('[data-role="mail-item"]')) x.removeAttribute('aria-current');
      if (rowEl) { rowEl.setAttribute('aria-current', 'true'); rowEl.dataset.unread = '0'; const dot = rowEl.querySelector('[data-role="mail-unread"]'); if (dot) dot.remove(); }
      this.cur = { acc: this.acc, msg: it.msg, html: '' };
      const seq = ++this.seq;
      let r = null;
      try { r = await this.vrg.mail.get(this.acc, it.msg); } catch (e) {}
      if (this.gone || seq !== this.seq) return;
      if (!r || !r.ok) { this.say((r && r.hu) || 'A levél nem töltődött be.'); return; }
      this.say('');
      const h = r.headers || {};
      this.head.replaceChildren(el('div', 'mail-h-from', h.from || ''), el('div', 'mail-h-subject', h.subject || ''), el('div', 'mail-h-date', h.date || ''));
      this.drawAttachments(Array.isArray(r.attachments) ? r.attachments : []);
      const html = await cleanHtml(this.vrg, typeof r.html === 'string' ? r.html : '');
      if (this.gone || seq !== this.seq) return;
      this.cur.html = html;
      await this.showMessage(this.cur, false);
    },
    async showMessage(cur, images) {
      if (!cur) return;
      let r = null;
      try { r = await this.vrg.mail.render(cur.acc, cur.msg, images === true, cur.html || ''); } catch (e) {}
      if (this.gone || !this.cur || this.cur.msg !== cur.msg) return;
      if (!r || !r.ok) { this.say((r && r.hu) || 'A levél nem jeleníthető meg.'); return; }
      this.box.dataset.view = r.view;                                        // the frame reports this box's rect; main places the view there
      this.imgBtn.hidden = !(r.remote && !r.images);
      this.copyBtn.hidden = true;
    },
    hideView() { delete this.box.dataset.view; this.imgBtn.hidden = true; this.copyBtn.hidden = true; try { this.vrg.mail.closeView(); } catch (e) {} },
    drawAttachments(list) {
      this.atts.replaceChildren();
      if (!list.length) return;
      this.atts.append(el('div', 'mail-atts-title', 'Mellékletek', 'Attachments'));
      for (const a of list) {
        const row = el('div', 'mail-att'); row.dataset.att = String(a.att);
        row.append(el('span', 'mail-att-name', String(a.name || '')), el('span', 'mail-att-size', ' ' + sizeText(a.size) + ' '),
          btn('mail-att-save', 'Mentés…', 'Save to Downloads (asks first)', () => this.save(a)));
        this.atts.append(row);
      }
    },
    async save(a) {
      if (!this.cur) return;
      let r = null;
      try { r = await this.vrg.mail.saveAttachment(this.cur.acc, this.cur.msg, a.att); } catch (e) {}
      if (!r || !r.ok) toast(false, (r && r.hu) || 'A melléklet mentése nem indult el.', 'The attachment could not be saved.');
      // the question and progress come through the job queue (the jobs toasts); the file is never opened here
    },

    // ---------------------------------------------------------- links from the read view (main applied the policy)
    link(m) {
      if (!m) return;
      if (m.action === 'web' && typeof m.url === 'string') { if (W.VRGFrame && W.VRGFrame.openUrl) W.VRGFrame.openUrl(m.url); return; }
      if (m.action === 'refuse' && m.offer === 'copy-address' && typeof m.address === 'string') {
        this.address = m.address; this.copyBtn.hidden = false; this.copyBtn.title = 'Copy address: ' + m.address;
        this.say(m.address); return;
      }
      this.say('Ez a hivatkozás nem nyitható meg.', 'This link cannot be opened.');
    },
    copyAddress() {
      if (!this.address) return;
      const t = document.createElement('textarea'); t.value = this.address; t.style.cssText = 'position:fixed;opacity:0';
      document.body.append(t); t.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
      t.remove();
      toast(ok, ok ? 'Cím a vágólapon.' : 'A másolás nem sikerült.', ok ? 'Address copied.' : 'Copy failed.');
    },
  };
})();
