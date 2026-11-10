// feed.js — "Hírek" (WP-29): the presets as blocks, each with "Frissítés", the last run time and its items; "Összes frissítése".
// VRGPanes.feed = { mount(el, state, api), unmount(), state() }. The page names a preset id and an item index; main resolves the target.
(function () {
  'use strict';
  const W = window, P = W.VRGPanes = W.VRGPanes || {};
  const el = (tag, role, text, title) => { const e = document.createElement(tag); if (role) e.dataset.role = role; if (text != null) e.textContent = text; if (title) e.title = title; return e; };
  const btn = (role, text, title, fn) => { const b = el('button', role, text, title); b.type = 'button'; b.addEventListener('click', fn); return b; };
  const pad = n => String(n).padStart(2, '0');
  const timeOf = at => { const d = new Date(at); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };

  P.feed = {
    mount(root, state, api) {
      this.root = root; this.vrg = (api && api.vrg) || W.vrg; this.gone = false;
      this.presets = []; this.results = new Map(); this.running = new Set();
      root.innerHTML = '';
      root.dataset.role = 'feed';
      root.title = 'Feeds';
      const head = el('div', 'bar');
      head.append(el('h3', 'title', 'Hírek', 'Feeds'), btn('refresh-all', 'Összes frissítése', 'Refresh all', () => this.refreshAll()));
      this.list = el('div', 'blocks');
      root.append(head, this.list);
      const v = this.vrg;
      if (v && v.on) this.off = v.on('jobs', 'update', m => { if (m && m.kind === 'feed' && (m.state === 'done' || m.state === 'failed' || m.state === 'cancelled')) this.reload(); });
      this.load();
    },
    unmount() { if (this.off) this.off(); if (this.root) this.root.innerHTML = ''; this.root = null; this.gone = true; },
    state() { return {}; },

    async load() {
      const v = this.vrg;
      if (!v || !v.feed) { this.draw(); return; }
      const [p, r] = await Promise.all([v.feed.presets(), v.feed.results()]);
      if (this.gone) return;
      this.presets = p && Array.isArray(p.presets) ? p.presets : [];
      this.results = new Map((r && Array.isArray(r.results) ? r.results : []).map(x => [x.pre, x]));
      this.draw();
    },
    async reload() {
      const r = await this.vrg.feed.results();
      if (this.gone) return;
      this.results = new Map((r && Array.isArray(r.results) ? r.results : []).map(x => [x.pre, x]));
      this.running.clear();
      this.draw();
    },
    async run(id) {
      this.running.add(id); this.draw();
      const r = await this.vrg.feed.run(id);
      if (r && r.ok === false) { this.running.delete(id); this.results.set(id, { pre: id, at: Date.now(), items: [], error: r.hu || 'Nem indult el.' }); this.draw(); }
    },
    refreshAll() { for (const p of this.presets) if (p.enabled) this.run(p.id); },

    draw() {
      if (!this.root) return;
      this.list.replaceChildren();
      for (const p of this.presets) {
        const rec = this.results.get(p.id);
        const b = el('section', 'block'); b.dataset.pre = p.id;
        const h = el('div', 'block-head');
        h.append(el('strong', 'name', p.hu, p.id), btn('refresh', this.running.has(p.id) ? '…' : 'Frissítés', 'Refresh', () => this.run(p.id)));
        if (!p.enabled) h.lastChild.disabled = true;
        b.append(h);
        if (rec) b.append(el('small', 'at', 'Utoljára: ' + timeOf(rec.at), 'Last run'));
        if (rec && rec.error) b.append(el('p', 'error', rec.error));
        else if (rec && !rec.items.length) b.append(el('p', 'empty', 'Nincs új'));
        if (rec && !rec.error) {
          const ul = el('ul', 'items');
          rec.items.forEach((it, i) => {
            const li = el('li', 'item');
            if (it.open) { const a = btn('item-open', it.hu, 'Open', () => this.vrg.feed.open(p.id, i)); li.append(a); } else li.append(el('span', 'item-text', it.hu));
            if (it.detail) li.append(el('small', 'detail', it.detail));
            ul.append(li);
          });
          b.append(ul);
        }
        this.list.append(b);
      }
    },
  };
})();
