// stack.js — "Rétegverem" / "Csomag" (WP-22): pick VRG Stack nodes, grow the cluster by layer, watch the token meter, send the pack to Claude.
// VRGPanes.stack = { mount(el, state, api), unmount(), state(), add(nodes), addText(text) }.
// The page sends node ids, layer letters, a budget and a note; main writes the pack file and answers with a packId (never a path).
(function () {
  'use strict';
  const W = window, P = W.VRGPanes = W.VRGPanes || {};
  const LAYERS = ['F', 'I', 'Q', 'L', 'A', 'R', 'C', 'G', 'E'];
  const ID_RE = /^[A-Z]:[^\s,]{1,150}$/;
  const FIND_RE = /\b[FIQLARCGE]:[A-Za-z0-9_.-]{1,150}/g;          // node ids inside free text (a Windows path never matches: no backslash in the class)
  const BUDGET_DEFAULT = 4000, NOTE_MAX = 2000, MAX_IDS = 80;
  const el = (tag, role, text, title) => { const e = document.createElement(tag); if (role) e.dataset.role = role; if (text != null) e.textContent = text; if (title) e.title = title; return e; };
  const btn = (role, text, title, fn) => { const b = el('button', role, text, title); b.type = 'button'; b.addEventListener('click', fn); return b; };

  P.stack = {
    mount(root, state, api) {
      this.root = root; this.api = api || {}; this.vrg = (api && api.vrg) || W.vrg; this.gone = false;
      const s = state && typeof state === 'object' ? state : {};
      this.items = new Map();                                       // id → { id, title, layer }
      for (const n of Array.isArray(s.nodes) ? s.nodes : []) if (n && ID_RE.test(n.id) && this.items.size < MAX_IDS) this.items.set(n.id, { id: n.id, title: String(n.title || '').slice(0, 300), layer: String(n.layer || n.id[0]) });
      this.layers = new Set(Array.isArray(s.layers) ? s.layers.filter(l => LAYERS.includes(l)) : []);
      this.budget = Number.isInteger(s.budget) && s.budget >= 300 && s.budget <= 20000 ? s.budget : BUDGET_DEFAULT;
      this.note = typeof s.note === 'string' ? s.note.slice(0, NOTE_MAX) : '';
      this.packId = ''; this.used = 0; this.pending = null;
      root.innerHTML = '';
      root.dataset.role = 'stack';
      root.title = 'VRG Stack';
      this.build();
      this.draw();
      if (this.items.size) this.repack();
    },
    unmount() { if (this.root) this.root.innerHTML = ''; this.root = null; this.gone = true; },
    state() { return { nodes: [...this.items.values()], layers: [...this.layers], budget: this.budget, note: this.note }; },

    build() {
      const root = this.root;
      // search
      const bar = el('div', 'bar');
      this.q = el('input', 'q'); this.q.type = 'search'; this.q.maxLength = 300; this.q.placeholder = 'Rétegverem'; this.q.title = 'VRG Stack search';
      bar.append(this.q, btn('go', 'Keresés', 'Search', () => this.search(this.q.value)));
      this.q.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); this.search(this.q.value); } });
      this.status = el('div', 'status');
      this.hits = el('div', 'results');
      // cluster
      const sec = el('section', 'cluster'); sec.append(el('h3', null, 'Csomag', 'Cluster'));
      this.list = el('div', 'nodes');
      const boxes = el('span', 'layers');
      for (const l of LAYERS) {
        const lab = el('label', 'layer'); const cb = document.createElement('input'); cb.type = 'checkbox'; cb.value = l; cb.checked = this.layers.has(l);
        cb.addEventListener('change', () => { if (cb.checked) this.layers.add(l); else this.layers.delete(l); this.preview = null; });
        lab.append(cb, ' ' + l); boxes.append(lab);
      }
      const grow = el('div', 'grow');
      grow.append(boxes, btn('grow1', 'Bővítés', 'Grow the cluster by one step', () => this.grow(1)), btn('grow2', 'Bővítés 2', 'Grow the cluster by two steps', () => this.grow(2)));
      this.previewBox = el('div', 'preview-count');
      // budget and meter
      const meterRow = el('div', 'budget');
      const lab = el('label', null, 'Keret ', 'Token budget');
      this.budgetIn = document.createElement('input'); this.budgetIn.type = 'number'; this.budgetIn.min = '300'; this.budgetIn.max = '20000'; this.budgetIn.value = String(this.budget); this.budgetIn.dataset.role = 'budget';
      this.budgetIn.addEventListener('change', () => { const v = Math.round(Number(this.budgetIn.value)); this.budget = Number.isFinite(v) ? Math.min(20000, Math.max(300, v)) : BUDGET_DEFAULT; this.budgetIn.value = String(this.budget); this.repack(); });
      lab.append(this.budgetIn);
      this.meter = el('span', 'meter');
      meterRow.append(lab, this.meter);
      // note
      this.noteBox = el('div', 'note');
      // actions
      const act = el('div', 'actions');
      this.sendBtns = [
        btn('send-a', 'Claude-nak (A)', 'Send to Claude, account A', () => this.send('term-A')),
        btn('send-b', 'Claude-nak (B)', 'Send to Claude, account B', () => this.send('term-B')),
        btn('send-chat', 'Csatolás a csevegéshez', 'Attach to the side chat', () => this.send('chat')),
      ];
      act.append(btn('preview', 'Előnézet', 'Show the pack text', () => this.togglePreview()), btn('copy', 'Másolás', 'Copy the pack text', () => this.copy()),
        btn('save', 'Mentés…', 'Save this cluster', () => this.save()), ...this.sendBtns);
      this.saveBox = el('div', 'save');
      this.saved = el('div', 'saved');
      this.text = el('pre', 'pack-text'); this.text.hidden = true;
      sec.append(this.list, grow, this.previewBox, meterRow, this.noteBox, act, this.saveBox, this.text);
      const savedSec = el('section', 'saved-clusters'); savedSec.append(el('h3', null, 'Mentett csomagok', 'Saved clusters'), this.saved);
      root.append(bar, this.status, this.hits, sec, savedSec);
      this.loadSaved();
    },

    // ------------------------------------------------------------ cluster list
    draw() {
      if (!this.root) return;
      this.list.innerHTML = '';
      if (!this.items.size) this.list.append(el('p', 'none', 'Üres csomag'));
      for (const n of this.items.values()) {
        const row = el('div', 'node'); row.dataset.id = n.id; row.dataset.layer = n.layer;
        row.append(el('span', 'id', n.id), el('span', 'title', ' ' + n.title), el('span', 'layer', ' ' + n.layer),
          btn('remove', '✕', 'Remove', () => { this.items.delete(n.id); this.preview = null; this.draw(); this.repack(); }));
        this.list.append(row);
      }
      this.noteBox.innerHTML = '';
      if (this.note) {
        this.noteBox.append(el('span', 'label', 'kézi jegyzet', 'manual note'), el('span', 'text', ' ' + this.note.slice(0, 120) + (this.note.length > 120 ? '…' : '')),
          btn('remove-note', '✕', 'Remove the note', () => { this.note = ''; this.draw(); this.repack(); }));
      }
      this.previewBox.innerHTML = '';
      if (this.preview) {
        const p = this.preview;
        this.previewBox.append(el('span', 'count', p.fresh + ' új elem (' + p.tokens + ' token)', 'New nodes the step would add'));
        if (p.fresh) this.previewBox.append(btn('apply', 'Hozzáadás', 'Add them to the cluster', () => this.applyPreview()));
      }
      this.drawMeter();
      for (const b of this.sendBtns) b.disabled = !this.packId;
    },
    drawMeter() {
      if (!this.meter) return;
      this.meter.textContent = this.used + ' / ' + this.budget + ' token';
      this.meter.dataset.over = this.used > this.budget ? '1' : '0';
    },

    // nodes: [{ id, title?, layer? }] from the search rows, the selection menu or a search hit
    add(nodes) {
      let n = 0;
      for (const x of Array.isArray(nodes) ? nodes : []) {
        if (!x || !ID_RE.test(x.id) || this.items.has(x.id) || this.items.size >= MAX_IDS) continue;
        this.items.set(x.id, { id: x.id, title: String(x.title || '').slice(0, 300), layer: String(x.layer || x.id[0]) }); n++;
      }
      if (n) { this.preview = null; this.draw(); this.repack(); }
      return n;
    },
    // "Csomaghoz adás": node ids in the text are added (when the stack knows them); text without any becomes the "kézi jegyzet"
    async addText(text) {
      const t = String(text == null ? '' : text);
      const found = [...new Set(t.match(FIND_RE) || [])].slice(0, MAX_IDS);
      const known = [];
      for (const id of found) {
        if (!this.vrg || !this.vrg.search) break;
        const r = await this.vrg.search.node(id);
        if (this.gone) return 0;
        if (r && r.ok !== false) { let title = ''; try { title = JSON.parse(r.text).title || ''; } catch (e) { const m = /\n?([^\n]*)/.exec(String(r.text || '')); title = m ? m[1].replace(id, '').trim() : ''; } known.push({ id, title }); }
      }
      if (known.length) return this.add(known);
      const body = t.trim().slice(0, NOTE_MAX);
      if (!body) return 0;
      this.note = (this.note ? this.note + '\n' : '') + body;
      this.note = this.note.slice(0, NOTE_MAX);
      this.draw(); this.repack();
      return 0;
    },

    // ------------------------------------------------------------ search
    async search(q) {
      q = String(q == null ? '' : q).trim().slice(0, 300);
      if (!this.root || !q || !this.vrg || !this.vrg.search) return;
      this.status.textContent = 'Keresés…';
      const r = await this.vrg.search.inner(q, this.layers.size ? { layers: LAYERS.filter(l => this.layers.has(l)).join('') } : undefined);
      if (this.gone) return;
      this.hits.innerHTML = '';
      if (!r || r.ok === false) { this.status.textContent = (r && r.hu) || 'A keresés nem sikerült.'; return; }
      this.status.textContent = '';
      if (!(r.stack || []).length) this.hits.append(el('p', 'none', 'Nincs találat'));
      for (const h of r.stack || []) {
        const row = el('div', 'hit'); row.dataset.id = h.id;
        row.append(el('span', 'node', h.id + '  ' + h.title, h.brief || h.id), btn('add', '＋', 'Add to the cluster', () => this.add([h])));
        this.hits.append(row);
      }
    },

    // ------------------------------------------------------------ grow (preview count first, then add)
    async grow(depth) {
      if (!this.items.size || !this.vrg || !this.vrg.ctx) return;
      const layers = this.layers.size ? LAYERS.filter(l => this.layers.has(l)).join('') : LAYERS.join('');
      const r = await this.vrg.ctx.expand([...this.items.keys()], layers, depth);
      if (this.gone) return;
      if (!r || r.ok === false) { this.status.textContent = (r && r.hu) || 'A bővítés nem sikerült.'; return; }
      const fresh = r.nodes.filter(n => !this.items.has(n.id)).slice(0, Math.max(0, MAX_IDS - this.items.size));
      this.status.textContent = '';
      this.preview = { fresh: fresh.length, tokens: r.tokens, nodes: fresh };
      this.draw();
    },
    applyPreview() { const p = this.preview; this.preview = null; if (p) this.add(p.nodes); else this.draw(); },

    // ------------------------------------------------------------ pack
    // main writes the pack file again on every change; the meter shows the real size
    async repack() {
      const seq = this.seq = (this.seq || 0) + 1;
      this.packId = '';
      if (!this.items.size || !this.vrg || !this.vrg.ctx) { this.used = 0; this.packText = ''; this.draw(); if (this.text) this.text.textContent = ''; return; }
      const r = await this.vrg.ctx.pack([...this.items.keys()], { budget: this.budget, ...(this.note ? { note: this.note } : {}) });
      if (this.gone || seq !== this.seq) return;
      if (!r || r.ok === false) { this.status.textContent = (r && r.hu) || 'A csomag nem készült el.'; this.used = 0; this.packText = ''; this.draw(); return; }
      this.status.textContent = '';
      this.packId = r.packId; this.used = r.tokens; this.packText = r.text;
      if (this.text) this.text.textContent = r.text;
      this.draw();
    },
    togglePreview() { if (this.text) this.text.hidden = !this.text.hidden; },
    async copy() {
      if (!this.packText) return;
      try { await navigator.clipboard.writeText(this.packText); this.status.textContent = 'Vágólapra másolva'; } catch (e) { this.status.textContent = 'A másolás nem sikerült.'; }
    },

    // ------------------------------------------------------------ saved clusters
    async loadSaved() {
      if (!this.vrg || !this.vrg.ctx) return;
      const r = await this.vrg.ctx.clusters();
      if (this.gone) return;
      this.saved.innerHTML = '';
      const list = r && r.ok !== false && Array.isArray(r.clusters) ? r.clusters : [];
      if (!list.length) this.saved.append(el('p', 'none', 'Nincs mentett csomag'));
      for (const c of list) {
        const row = el('div', 'cluster-row'); row.dataset.id = c.id;
        row.append(btn('open', c.name + ' (' + c.ids.length + ')', 'Load this cluster', () => this.loadCluster(c)),
          btn('delete', '✕', 'Delete this saved cluster', async () => { await this.vrg.ctx.deleteCluster(c.id); this.loadSaved(); }));
        this.saved.append(row);
      }
    },
    async loadCluster(c) {
      this.items = new Map(); this.preview = null;
      for (const id of c.ids) this.items.set(id, { id, title: '', layer: id[0] });
      this.draw(); this.repack();
    },
    // "Mentés…": an inline name field (no browser prompt in Electron)
    save() {
      if (!this.items.size || !this.vrg || !this.vrg.ctx) return;
      this.saveBox.innerHTML = '';
      const inp = el('input', 'name'); inp.type = 'text'; inp.maxLength = 80; inp.placeholder = 'Név'; inp.title = 'Cluster name';
      const done = async () => {
        const name = inp.value.trim();
        if (!name) return;
        const r = await this.vrg.ctx.saveCluster(name, [...this.items.keys()]);
        if (this.gone) return;
        this.saveBox.innerHTML = '';
        this.status.textContent = r && r.ok !== false ? 'Mentve' : ((r && r.hu) || 'A mentés nem sikerült.');
        this.loadSaved();
      };
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); done(); } else if (e.key === 'Escape') { this.saveBox.innerHTML = ''; } });
      this.saveBox.append(inp, btn('ok', 'Mentés', 'Save', done));
      inp.focus();
    },

    async send(how) {
      if (!this.packId || !this.vrg || !this.vrg.ctx) return;
      const r = await this.vrg.ctx.sendToClaude(this.packId, how);
      if (this.gone) return;
      if (!r || r.ok === false) { this.status.textContent = (r && r.hu) || 'A küldés nem sikerült.'; return; }
      this.status.textContent = how === 'chat' ? 'Csatolva a csevegéshez' : 'Elküldve a Claude-nak';
      if (how === 'chat') W.dispatchEvent(new CustomEvent('vrg-ctx-attach', { detail: { packId: r.packId } }));   // the chat pane (WP-24) listens
    },
  };
})();
