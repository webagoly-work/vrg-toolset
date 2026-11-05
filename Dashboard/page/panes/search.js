// search.js — "Belső keresés" (WP-20): the VRG Stack and the code index in one panel.
// VRGPanes.search = { mount(el, state, api), unmount(), state(), run(q) }. The frame hosts it as a panel over the layout (frame.js).
// The page sends words, layer letters and the index of a code hit; main maps the hit to a viewer handle (vrg.search.openHit).
(function () {
  'use strict';
  const W = window, P = W.VRGPanes = W.VRGPanes || {};
  const LAYERS = ['F', 'I', 'Q', 'L', 'A', 'R', 'C', 'G', 'E'];
  const el = (tag, role, text) => { const e = document.createElement(tag); if (role) e.dataset.role = role; if (text != null) e.textContent = text; return e; };

  P.search = {
    mount(root, state, api) {
      this.root = root; this.api = api || {}; this.vrg = (api && api.vrg) || W.vrg; this.gone = false;
      this.layers = new Set(Array.isArray(state && state.layers) ? state.layers.filter(l => LAYERS.includes(l)) : []);
      this.last = typeof (state && state.q) === 'string' ? state.q : '';
      root.innerHTML = '';
      root.dataset.role = 'search';
      root.title = 'Internal search';
      const bar = el('div', 'bar');
      this.input = el('input', 'q'); this.input.type = 'search'; this.input.maxLength = 300; this.input.placeholder = 'Belső keresés'; this.input.title = 'Internal search';
      this.input.value = this.last;
      const go = el('button', 'go', 'Keresés'); go.type = 'button'; go.title = 'Search';
      bar.append(this.input, go);
      const boxes = el('span', 'layers');
      for (const l of LAYERS) {
        const lab = el('label', 'layer'); const cb = document.createElement('input'); cb.type = 'checkbox'; cb.value = l; cb.checked = this.layers.has(l);
        cb.addEventListener('change', () => { if (cb.checked) this.layers.add(l); else this.layers.delete(l); });
        lab.append(cb, ' ' + l); boxes.append(lab);
      }
      bar.append(boxes);
      if (this.api.close) { const x = el('button', 'close', 'Bezár'); x.type = 'button'; x.title = 'Close'; x.addEventListener('click', () => this.api.close()); bar.append(x); }
      this.status = el('div', 'status');
      this.out = el('div', 'results');
      root.append(bar, this.status, this.out);
      go.addEventListener('click', () => this.run(this.input.value));
      this.onKey = e => {
        if (e.key === 'Enter' && e.target === this.input) { e.preventDefault(); this.run(this.input.value); }
        else if (e.key === 'Escape' && this.api.close) { e.preventDefault(); e.stopPropagation(); this.api.close(); }
      };
      root.addEventListener('keydown', this.onKey);
      if (this.last) this.run(this.last);
    },
    unmount() { if (this.root) { this.root.removeEventListener('keydown', this.onKey); this.root.innerHTML = ''; } this.root = null; this.gone = true; },
    state() { return { q: this.last, layers: [...this.layers] }; },
    focus() { if (this.input) { this.input.focus(); this.input.select(); } },

    async run(q) {
      q = String(q == null ? '' : q).trim().slice(0, 300);
      if (!this.root || !q || !this.vrg || !this.vrg.search) return;
      this.last = q; this.input.value = q;
      this.status.textContent = 'Keresés…';
      const opt = this.layers.size ? { layers: LAYERS.filter(l => this.layers.has(l)).join('') } : undefined;
      const r = await this.vrg.search.inner(q, opt);
      if (this.gone) return;
      this.out.innerHTML = '';
      if (!r || r.ok === false) { this.status.textContent = (r && r.hu) || 'A keresés nem sikerült.'; return; }
      this.status.textContent = r.updated ? 'Rétegverem frissítve: ' + r.updated : '';
      this.drawStack(r.stack || []);
      this.drawCode(r.code || [], r);
    },

    drawStack(hits) {
      const sec = el('section', 'stack-hits'); sec.append(el('h3', null, 'Rétegverem'));
      if (!hits.length) sec.append(el('p', 'none', 'Nincs találat'));
      const byLayer = new Map();
      for (const h of hits) { if (!byLayer.has(h.layer)) byLayer.set(h.layer, []); byLayer.get(h.layer).push(h); }
      for (const [layer, list] of byLayer) {
        const g = el('div', 'layer-group'); g.dataset.layer = layer; g.append(el('h4', null, layer));
        for (const h of list) {
          const row = el('div', 'hit'); row.dataset.id = h.id;
          const b = el('button', 'node', h.id + '  ' + h.title); b.type = 'button'; b.title = h.brief || h.id;
          b.addEventListener('click', () => this.card(h.id, row));
          row.append(b);
          if (h.brief) row.append(el('div', 'brief', h.brief));
          g.append(row);
        }
        sec.append(g);
      }
      this.out.append(sec);
    },
    // a stack hit opens its card (preformatted text) under the hit
    async card(id, row) {
      const old = row.querySelector('[data-role="card"]');
      if (old) { old.remove(); return; }
      const r = await this.vrg.search.node(id);
      if (this.gone) return;
      const pre = el('pre', 'card', r && r.ok !== false ? r.text : ((r && r.hu) || 'Nincs találat'));
      row.append(pre);
    },

    drawCode(hits, r) {
      const sec = el('section', 'code-hits'); sec.append(el('h3', null, 'Kód'));
      if (r.codeErr === 'no-index') sec.append(el('p', 'none', r.codeHu || 'Nincs kódindex. Futtasd: node tools/vrg-ctx.js index'));
      else if (r.codeErr) sec.append(el('p', 'none', r.codeHu || 'A kódkeresés nem sikerült.'));
      else if (!hits.length) sec.append(el('p', 'none', 'Nincs találat'));
      const byFile = new Map();
      hits.forEach((h, i) => { if (!byFile.has(h.path)) byFile.set(h.path, []); byFile.get(h.path).push({ h, i }); });
      for (const [file, list] of byFile) {
        const g = el('div', 'file-group'); g.append(el('h4', null, file));
        for (const { h, i } of list) {
          const b = el('button', 'code', ':' + h.line + (h.title ? '  ' + h.title : '')); b.type = 'button'; b.title = h.snippet || file;
          b.dataset.i = String(i);
          b.addEventListener('click', () => this.openCode(i));
          g.append(b);
          if (h.snippet) g.append(el('div', 'snippet', h.snippet));
        }
        sec.append(g);
      }
      this.out.append(sec);
    },

    // a code hit opens the viewer (WP-13) over this panel, at the line
    async openCode(i) {
      const r = await this.vrg.search.openHit('code', i);
      if (this.gone) return;
      if (!r || r.ok === false) { this.status.textContent = (r && r.hu) || 'A fájl nem nyitható meg.'; return; }
      if (!P.viewer) await new Promise(res => { const sc = document.createElement('script'); sc.src = 'panes/viewer.js'; sc.onload = () => res(); sc.onerror = () => res(); document.head.append(sc); });
      if (this.gone) return;
      if (!P.viewer) { this.status.textContent = 'Nézőke: nem érhető el'; return; }
      const box = el('div', 'viewer');
      box.style.position = 'absolute'; box.style.inset = '0'; box.style.overflow = 'auto';
      if (getComputedStyle(this.root).position === 'static') this.root.style.position = 'relative';
      const v = Object.create(P.viewer);
      const close = () => { v.unmount(); box.remove(); if (this.input) this.input.focus(); };
      this.root.append(box);
      v.mount(box, {}, { close });
      v.raw = true;                                                  // source with line numbers, also for .md
      await v.load(r.handle, r.name);
      const cell = [...box.querySelectorAll('[data-role="line"]')].find(c => c.textContent.trim() === String(r.line));
      if (cell) { cell.scrollIntoView({ block: 'center' }); if (cell.parentElement) cell.parentElement.dataset.target = '1'; }
    },
  };
})();
