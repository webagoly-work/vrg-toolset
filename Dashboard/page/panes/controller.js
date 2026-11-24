// controller.js — Vezérlő (WP-52): the central prompt box above the Munkamenetek board. Section 1: one text box; Egyszerű mode = a ＋ menu
// (the attach options) and Küldés; Részletes mode = a row of buttons around the box (Tallózás, Legutóbbiak, Mappa, Galéria, Fotó, QR, Küldés),
// the account / route / model pickers and a live Előszűrő preview (verdict, score, intent, anchors, the text that will be added).
// Nothing is sent as typed: Küldés → vrg.gate.send → main runs the Előszűrő (Prefilter/) and starts a NEW Claude Code session with the
// dressed prompt (an independent request in a folder without VRG context, a context request in the repo). Section 2 is the Founder's next
// part (a placeholder for now). Attachments are ids main issued (main's dialog, recent list, preset folder, camera); the page has no paths.
// Keys: Ctrl+Enter sends; Esc closes a menu or the camera. VRGPanes.controller = { mount(el, state, api), unmount(), state() }.
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : {};
  const P = W.VRGPanes = W.VRGPanes || {};
  const MAX_TEXT = 8000, MAX_ATTACH = 10, PREVIEW_MS = 600;

  // ------------------------------------------------------------ pure helpers (exported for tests)
  const MODES = ['simple', 'detailed'];
  const ROUTES = ['auto', 'context', 'independent'];
  const MODELS = ['', 'haiku', 'sonnet', 'opus'];
  function cleanState(s) {
    const o = s && typeof s === 'object' ? s : {};
    return {
      mode: MODES.includes(o.mode) ? o.mode : 'simple',
      account: o.account === 'B' ? 'B' : 'A',
      route: ROUTES.includes(o.route) ? o.route : 'auto',
      model: MODELS.includes(o.model) ? o.model : '',
      draft: typeof o.draft === 'string' ? o.draft.slice(0, MAX_TEXT) : '',
    };
  }
  const VERDICT_HU = { context: 'VRG-kontextus', independent: 'Önálló', unsure: 'Bizonytalan' };
  const INTENT_HU = { build: 'építés', fix: 'javítás', review: 'átnézés', plan: 'tervezés', ask: 'kérdés', 'continue': 'folytatás', research: 'kutatás', other: 'egyéb' };
  // the send payload from the pane state: only what the gate accepts; '' model / 'auto' route are left out
  function payload(st, text, attach) {
    const o = { text: String(text || '').slice(0, MAX_TEXT), account: st.account === 'B' ? 'B' : 'A' };
    const ids = (Array.isArray(attach) ? attach : []).map(a => a && a.id).filter(id => typeof id === 'string' && /^a[0-9]{1,6}$/.test(id)).slice(0, MAX_ATTACH);
    if (ids.length) o.attach = ids;
    if (st.route && st.route !== 'auto') o.mode = st.route;
    if (st.model) o.model = st.model;
    return o;
  }
  // a new attachment list: no duplicate ids, at most MAX_ATTACH
  function addFiles(list, files) {
    const out = Array.isArray(list) ? list.slice() : [];
    for (const f of Array.isArray(files) ? files : []) if (f && typeof f.id === 'string' && !out.some(x => x.id === f.id) && out.length < MAX_ATTACH) out.push({ id: f.id, name: String(f.name || f.id), ext: String(f.ext || ''), size: Number(f.size) || 0 });
    return out;
  }
  // the one-line verdict text of an analyze reply
  function verdictLine(r) {
    if (!r || r.ok === false) return (r && r.hu) || '';
    const pct = Math.round((Number(r.score) || 0) * 100);
    const eff = r.effective && r.effective !== r.verdict ? ' → ' + (VERDICT_HU[r.effective] || r.effective) : '';
    return (VERDICT_HU[r.verdict] || r.verdict) + eff + ' · ' + pct + '% · ' + (INTENT_HU[r.intent] || r.intent || '?') + (r.model ? ' · ' + r.model : '');
  }
  // insert text at the caret of a value: { value, caret }
  function insertAt(value, start, end, text) {
    const v = String(value || ''), s = Math.max(0, Math.min(start | 0, v.length)), e = Math.max(s, Math.min(end | 0, v.length));
    const t = String(text || '');
    return { value: (v.slice(0, s) + t + v.slice(e)).slice(0, MAX_TEXT), caret: Math.min(s + t.length, MAX_TEXT) };
  }
  const helpers = { cleanState, payload, addFiles, verdictLine, insertAt, VERDICT_HU, INTENT_HU, MAX_TEXT, MAX_ATTACH };
  if (typeof module !== 'undefined' && module.exports) module.exports = helpers;
  if (typeof document === 'undefined') return;

  // ------------------------------------------------------------ the pane
  const el = (tag, role, text, title) => { const e = document.createElement(tag); if (role) e.dataset.role = role; if (text != null) e.textContent = text; if (title) e.title = title; return e; };
  const btn = (role, text, title, fn) => { const b = el('button', role, text, title); b.type = 'button'; b.addEventListener('click', fn); return b; };
  const sel = (role, title, opts, value, fn) => { const s = el('select', role, null, title); for (const [v, t] of opts) { const o = el('option', null, t); o.value = v; s.append(o); } s.value = value; s.addEventListener('change', () => fn(s.value)); return s; };
  const sizeText = n => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round((Number(n) || 0) / 1024)) + ' KB');

  P.controller = {
    helpers,
    mount(root, state, api) {
      this.root = root; this.vrg = (api && api.vrg) || W.vrg; this.api = api || {}; this.gone = false;
      this.st = cleanState(state); this.files = []; this.preview = null; this.busy = false; this.timer = 0; this.cam = null;
      root.innerHTML = '';
      root.dataset.role = 'controller';
      root.title = 'Prompt controller';
      // section 1: the prompt
      const s1 = this.s1 = el('section', 's1');
      const head = el('div', 'head');
      head.append(el('h3', 'title', 'Vezérlő', 'Prompt controller: every prompt goes through the Előszűrő into a new session'),
        this.opts = el('div', 'opts'),
        this.modeBtn = btn('mode', '', 'Egyszerű ⇄ Részletes / Simple ⇄ Detailed', () => this.setMode(this.st.mode === 'simple' ? 'detailed' : 'simple')));
      this.tools = el('div', 'tools');                         // Részletes: the button row
      this.tools.append(
        btn('browse', 'Tallózás', 'Attach files (browse)', () => this.pick('browse')),
        btn('recent', 'Legutóbbiak', 'Recently attached files', e => this.recentMenu(e.currentTarget)),
        btn('folder', 'Mappa', 'A file from a preset folder', e => this.folderMenu(e.currentTarget)),
        btn('gallery', 'Galéria', 'Attach pictures', () => this.pick('gallery')),
        btn('photo', 'Fotó', 'Take a photo with the camera', () => this.camera('photo')),
        btn('qr', 'QR', 'Scan a QR code into the prompt', () => this.camera('qr')));
      this.opts.append(                                       // Részletes: account, route, model (in the head row: a one-row tile still shows them)
        sel('account', 'Account', [['A', 'A fiók'], ['B', 'B fiók']], this.st.account, v => { this.st.account = v; this.saveState(); }),
        sel('route', 'Route: the Előszűrő decides, or you do', [['auto', 'Útvonal: automatikus'], ['context', 'VRG-kontextussal'], ['independent', 'Önálló (kontextus nélkül)']], this.st.route, v => { this.st.route = v; this.saveState(); this.schedule(); }),
        sel('model', 'Model: the Előszűrő suggests one', [['', 'Modell: javasolt'], ['haiku', 'haiku'], ['sonnet', 'sonnet'], ['opus', 'opus']], this.st.model, v => { this.st.model = v; this.saveState(); }));
      const row = el('div', 'row');
      this.plus = btn('plus', '＋', 'Csatolás / Attach', e => this.plusMenu(e.currentTarget));
      this.text = el('textarea', 'text');
      this.text.placeholder = 'Mit kérsz? Az Előszűrő eldönti, kell-e hozzá VRG-kontextus, és felöltözteti a kérést.';
      this.text.maxLength = MAX_TEXT; this.text.rows = 3; this.text.value = this.st.draft;
      this.text.addEventListener('input', () => { this.st.draft = this.text.value; this.saveState(); this.schedule(); });
      this.text.addEventListener('keydown', e => { if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); this.send(); } });
      this.sendBtn = btn('send', 'Küldés', 'Send through the Előszűrő into a new session (Ctrl+Enter)', () => this.send());
      row.append(this.plus, this.text, this.sendBtn);
      this.chips = el('div', 'chips');
      this.verdict = el('div', 'verdict');
      this.detail = el('details', 'preview'); this.detail.append(el('summary', null, 'Előnézet: amit az Előszűrő hozzáad'), this.pre = el('pre', 'dressed'));
      this.msg = el('p', 'msg'); this.msg.hidden = true;
      s1.append(head, this.tools, row, this.chips, this.verdict, this.detail, this.msg);
      // section 2: the Founder's next part
      const s2 = el('section', 's2');
      s2.append(el('h4', null, 'Második szakasz', 'Section 2: coming next'), el('p', 'none', 'Hamarosan: a vezérlő második része.'));
      root.append(s1, s2);
      this.onKey = e => { if (e.key === 'Escape') { this.closeMenu(); this.stopCamera(); } };
      root.addEventListener('keydown', this.onKey);
      this.setMode(this.st.mode, true);
      this.drawChips();
      if (this.text.value) this.schedule();
    },
    unmount() { clearTimeout(this.timer); this.stopCamera(); this.closeMenu(); if (this.root) this.root.innerHTML = ''; this.root = null; this.gone = true; },
    state() { return { ...this.st }; },
    saveState() { if (this.api && this.api.setState) { try { this.api.setState(this.state()); } catch (e) {} } },
    say(text, bad) { this.msg.hidden = !text; this.msg.textContent = text || ''; this.msg.dataset.bad = bad ? '1' : ''; },

    setMode(m, quiet) {
      this.st.mode = m === 'detailed' ? 'detailed' : 'simple';
      this.root.dataset.mode = this.st.mode;
      this.modeBtn.textContent = this.st.mode === 'simple' ? 'Részletes ›' : '‹ Egyszerű';
      this.tools.hidden = this.opts.hidden = this.detail.hidden = this.st.mode === 'simple';
      this.plus.hidden = this.st.mode !== 'simple';
      if (!quiet) { this.saveState(); this.schedule(); }
    },

    // ---------------------------------------------------------- the Előszűrő preview (Részletes: live; Egyszerű: on send only)
    schedule() {
      clearTimeout(this.timer);
      if (this.st.mode !== 'detailed') { this.verdict.textContent = ''; return; }
      this.timer = setTimeout(() => this.analyze(), PREVIEW_MS);
    },
    async analyze() {
      const text = this.text.value;
      if (!text.trim() || !this.vrg || !this.vrg.gate) { this.verdict.textContent = ''; this.pre.textContent = ''; return null; }
      const p = payload(this.st, text, this.files);
      const r = await this.vrg.gate.analyze(p.text, p.attach, p.mode);
      if (this.gone || this.text.value !== text) return r;
      this.preview = r;
      this.drawVerdict(r);
      return r;
    },
    drawVerdict(r) {
      this.verdict.replaceChildren();
      if (!r) return;
      const line = el('span', 'line', verdictLine(r));
      if (r.ok !== false) line.dataset.verdict = r.effective || r.verdict;
      this.verdict.append(line);
      if (r.ok !== false) {
        for (const a of (r.anchors || []).slice(0, 6)) this.verdict.append(el('span', 'anchor', a.title || a.id, (a.kind || '') + ' · ' + (a.source || '')));
        this.pre.textContent = (r.dressed.before ? r.dressed.before + '\n\n' : '') + '« a kérésed »' + (r.dressed.after ? '\n\n' + r.dressed.after : '') +
          '\n\n— ' + r.dressed.length + ' karakter · ' + (r.cwd === 'free' ? 'indul: kontextus nélküli mappában' : 'indul: a repóban') + (r.reasons && r.reasons.length ? '\n— ' + r.reasons.join('\n— ') : '');
      }
    },

    async send() {
      if (this.busy) return;
      const text = this.text.value;
      if (!text.trim()) { this.say('Írj be egy kérést.', true); this.text.focus(); return; }
      if (!this.vrg || !this.vrg.gate) { this.say('Ebben a változatban nincs Vezérlő szolgáltatás.', true); return; }
      this.busy = true; this.sendBtn.disabled = true; this.sendBtn.textContent = '…';
      const p = payload(this.st, text, this.files);
      const pre = await this.vrg.gate.analyze(p.text, p.attach, p.mode);
      if (this.gone) return;
      this.drawVerdict(pre);
      let r = pre;
      if (pre && pre.ok !== false) r = await this.vrg.gate.send(p);
      if (this.gone) return;
      this.busy = false; this.sendBtn.disabled = false; this.sendBtn.textContent = 'Küldés';
      if (!r || r.ok === false) { this.say((r && r.hu) || 'Nem sikerült elindítani.', true); return; }
      this.say('Új munkamenet indult: ' + p.account + ' · ' + verdictLine(pre));
      this.text.value = ''; this.st.draft = ''; this.files = []; this.drawChips(); this.saveState();
    },

    // ---------------------------------------------------------- attachments
    drawChips() {
      this.chips.replaceChildren();
      for (const f of this.files) {
        const c = el('span', 'chip', null, f.name + ' · ' + sizeText(f.size));
        c.append(el('span', 'name', f.name), btn('drop', '×', 'Eltávolítás / Remove', () => { this.files = this.files.filter(x => x.id !== f.id); this.drawChips(); this.schedule(); }));
        this.chips.append(c);
      }
      this.chips.hidden = !this.files.length;
    },
    take(r) {
      if (!r || r.ok === false) { if (r && r.err !== 'cancelled') this.say(r.hu || 'Nem csatolható.', true); return; }
      this.files = addFiles(this.files, r.files || (r.file ? [r.file] : []));
      this.say(''); this.drawChips(); this.schedule();
    },
    async pick(kind, root) { this.closeMenu(); this.take(await this.vrg.gate.pick(kind, root)); },

    // a small menu under a button: items [{ text, title?, run }]
    menu(anchor, items) {
      this.closeMenu();
      const box = el('div', 'menu');
      for (const it of items) { const b = btn('item', it.text, it.title || '', async () => { this.closeMenu(); await it.run(); }); if (it.off) b.disabled = true; box.append(b); }
      if (!items.length) box.append(el('p', 'none', 'Nincs elem.'));
      this.root.append(box);
      const a = anchor.getBoundingClientRect(), r = this.root.getBoundingClientRect();
      box.style.left = Math.max(4, Math.min(a.left - r.left, r.width - 240)) + 'px';
      box.style.top = (a.bottom - r.top + 4) + 'px';
      this.menuEl = box;
      this.outside = e => { if (!box.contains(e.target) && e.target !== anchor) this.closeMenu(); };
      setTimeout(() => document.addEventListener('pointerdown', this.outside, true), 0);
    },
    closeMenu() { if (this.menuEl) { this.menuEl.remove(); this.menuEl = null; } if (this.outside) { document.removeEventListener('pointerdown', this.outside, true); this.outside = null; } },
    plusMenu(anchor) {
      this.menu(anchor, [
        { text: 'Tallózás…', title: 'Browse files', run: () => this.pick('browse') },
        { text: 'Legutóbbiak ›', title: 'Recent files', run: () => this.recentMenu(anchor) },
        { text: 'Mappa ›', title: 'Preset folder', run: () => this.folderMenu(anchor) },
        { text: 'Galéria…', title: 'Pictures', run: () => this.pick('gallery') },
        { text: 'Fotó', title: 'Camera', run: () => this.camera('photo') },
        { text: 'QR beolvasása', title: 'Scan a QR code', run: () => this.camera('qr') },
      ]);
    },
    async recentMenu(anchor) {
      const r = await this.vrg.gate.recent();
      const files = r && r.ok !== false ? r.files || [] : [];
      this.menu(anchor, files.map(f => ({ text: f.name, title: sizeText(f.size), off: this.files.some(x => x.id === f.id), run: () => this.take({ ok: true, files: [f] }) })));
    },
    async folderMenu(anchor) {
      const r = await this.vrg.gate.folders();
      const list = r && r.ok !== false ? r.folders || [] : [];
      this.menu(anchor, list.map(f => ({ text: f.hu, title: f.id, run: () => this.pick('folder', f.id) })));
    },

    // ---------------------------------------------------------- camera: a photo (attached) or a QR code (its text goes into the prompt)
    async camera(kind) {
      this.closeMenu(); this.stopCamera();
      if (kind === 'qr' && !('BarcodeDetector' in W)) { this.say('Ezen a gépen a böngészőmotor nem tud QR-t olvasni (BarcodeDetector). Használd a telefont: VRG Mobile → QR BEOLVASÁSA.', true); return; }
      let stream;
      try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }); }
      catch (e) { this.say('A kamera nem érhető el: ' + (e && e.name || 'hiba'), true); return; }
      const box = el('div', 'cam'), video = el('video', 'video');
      video.muted = true; video.playsInline = true; video.srcObject = stream;
      const bar = el('div', 'cam-bar');
      bar.append(kind === 'photo' ? btn('shoot', 'Fénykép', 'Take the photo', () => this.shoot()) : el('span', 'hint', 'Tartsd a QR-kódot a kamera elé…'),
        btn('cancel', 'Mégse', 'Cancel (Esc)', () => this.stopCamera()));
      box.append(video, bar);
      this.root.append(box);
      this.cam = { stream, video, box, kind, raf: 0 };
      try { await video.play(); } catch (e) {}
      if (kind === 'qr') this.scanLoop();
    },
    stopCamera() {
      const c = this.cam; if (!c) return;
      this.cam = null;
      cancelAnimationFrame(c.raf);
      try { c.stream.getTracks().forEach(t => t.stop()); } catch (e) {}
      c.box.remove();
    },
    async shoot() {
      const c = this.cam; if (!c) return;
      const v = c.video, w = Math.min(v.videoWidth || 1280, 1920), h = Math.round(w * ((v.videoHeight || 720) / (v.videoWidth || 1280)));
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(v, 0, 0, w, h);
      const data = cv.toDataURL('image/jpeg', 0.85);
      this.stopCamera();
      this.take(await this.vrg.gate.photo(data));
    },
    async scanLoop() {
      const c = this.cam; if (!c) return;
      let det; try { det = new W.BarcodeDetector({ formats: ['qr_code'] }); } catch (e) { this.stopCamera(); this.say('A QR-olvasó nem indult el.', true); return; }
      const tick = async () => {
        if (this.cam !== c) return;
        try {
          const codes = await det.detect(c.video);
          const raw = codes && codes[0] && codes[0].rawValue;
          if (raw) {
            this.stopCamera();
            const r = insertAt(this.text.value, this.text.selectionStart, this.text.selectionEnd, String(raw).slice(0, 2000));
            this.text.value = r.value; this.text.setSelectionRange(r.caret, r.caret); this.text.focus();
            this.st.draft = r.value; this.saveState(); this.schedule();
            this.say('QR beolvasva.');
            return;
          }
        } catch (e) {}
        c.raf = requestAnimationFrame(tick);
      };
      tick();
    },
  };
})();
