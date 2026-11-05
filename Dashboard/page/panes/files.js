// files.js — the dual-pane file manager pane (WP-11). Two plain tables, keyboard first, over the roots of WP-10.
// The page holds handles only; they are not persisted: state keeps a root id and the folder names, walked back on mount.
// Operations (copy, move, rename, mkdir, trash, view, edit) are called only when this build's window.vrg.fs has them (WP-12 / WP-13).
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : {};
  const P = W.VRGPanes = W.VRGPanes || {};
  const MAX_NAMES = 24;                                       // the persisted path stays well inside the 8 KB pane state

  // ------------------------------------------------------------ pure helpers (exported for tests)
  function formatSize(n) {
    n = Number(n);
    if (!isFinite(n) || n < 0) return '';
    if (n < 1024) return n + ' B';
    const u = ['KB', 'MB', 'GB', 'TB'];
    let v = n / 1024, i = 0;
    while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
    return (Math.round(v * 10) / 10).toString().replace('.', ',') + ' ' + u[i];
  }

  function formatDate(ms) {
    const d = new Date(ms);
    if (isNaN(d.getTime())) return '';
    const p = (x, n = 2) => String(x).padStart(n, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  // Reopen a folder by names: listFn(handle) → a fs.list reply. A name that is not a folder there stops the walk.
  // → { handle, names (the ones walked), reply (the last listing) } or null when even the start cannot be listed.
  async function walkBack(names, listFn, start) {
    let handle = start;
    let reply = await listFn(handle);
    if (!reply || reply.ok === false) return null;
    const done = [];
    for (const name of Array.isArray(names) ? names : []) {
      const hit = (reply.items || []).find(i => i.kind === 'dir' && i.name === name);
      if (!hit) break;
      const next = await listFn(hit.handle);
      if (!next || next.ok === false) break;
      handle = hit.handle; reply = next; done.push(name);
    }
    return { handle, names: done, reply };
  }

  // A keydown event (key, ctrlKey, shiftKey, altKey) → { a: action, ... } or null. state: { filter: string }.
  function keyAction(e, state) {
    const k = e.key, ctrl = !!e.ctrlKey, shift = !!e.shiftKey, alt = !!e.altKey;
    const filter = state && state.filter ? state.filter : '';
    if (alt && !ctrl) {
      if (k === 'F1') return { a: 'rootMenu', side: 'left' };
      if (k === 'F2') return { a: 'rootMenu', side: 'right' };
      return null;
    }
    if (ctrl && !alt) {
      const l = String(k).toLowerCase();
      if (l === 'a') return { a: 'all' };
      if (l === 'r') return { a: 'reload' };
      if (l === 'f') return { a: 'filter' };
      return null;
    }
    switch (k) {
      case 'Tab': return { a: 'switch' };
      case 'Enter': return { a: 'open' };
      case 'Backspace': return filter ? { a: 'filterBack' } : { a: 'parent' };
      case 'Escape': return filter ? { a: 'filterClear' } : null;
      case 'Insert': return { a: 'mark' };
      case ' ': return { a: 'mark' };
      case 'ArrowUp': return shift ? { a: 'range', d: -1 } : { a: 'move', d: -1 };
      case 'ArrowDown': return shift ? { a: 'range', d: 1 } : { a: 'move', d: 1 };
      case 'Home': return { a: 'move', d: -Infinity };
      case 'End': return { a: 'move', d: Infinity };
      case 'PageUp': return { a: 'move', d: -10 };
      case 'PageDown': return { a: 'move', d: 10 };
      case 'F3': return { a: 'op', op: 'view' };
      case 'F4': return { a: 'op', op: 'edit' };
      case 'F5': return { a: 'op', op: 'copy' };
      case 'F6': return { a: 'op', op: shift ? 'rename' : 'move' };
      case 'F7': return { a: 'op', op: 'mkdir' };
      case 'F8': return { a: 'op', op: 'trash' };
    }
    if (typeof k === 'string' && k.length === 1) return { a: 'type', ch: k };
    return null;
  }

  // client-side sort: folders first, then by the column; the server order is only the default
  function sortItems(items, sort) {
    const by = sort && sort.by || 'name', dir = sort && sort.dir === 'desc' ? -1 : 1;
    const name = (a, b) => a.name.localeCompare(b.name, 'hu');
    const cmp = by === 'size' ? (a, b) => (a.size - b.size) || name(a, b)
      : by === 'mtime' ? (a, b) => (a.mtime - b.mtime) || name(a, b) : name;
    return items.slice().sort((a, b) => (a.kind === 'dir') === (b.kind === 'dir') ? dir * cmp(a, b) : (a.kind === 'dir' ? -1 : 1));
  }

  const helpers = { formatSize, formatDate, walkBack, keyAction, sortItems };
  if (typeof module !== 'undefined' && module.exports) module.exports = helpers;

  // ------------------------------------------------------------ the pane
  const OPS = {                                                // op → [Hungarian label, vrg.fs function that must exist]
    view: ['Nézet', 'read'], edit: ['Szerkesztés', 'edit'], copy: ['Másolás', 'copy'], move: ['Áthelyezés', 'move'],
    rename: ['Átnevezés', 'rename'], mkdir: ['Új mappa', 'mkdir'], trash: ['Lomtárba', 'trash'],
  };
  const CLOUD = { online: ['felhőben', 'Only in the cloud'], local: ['helyi', 'Available offline'], pinned: ['rögzített', 'Always kept on this device'] };
  const SIDES = ['left', 'right'];

  const el = (tag, role, text) => { const e = document.createElement(tag); if (role) e.dataset.role = role; if (text !== undefined) e.textContent = text; return e; };

  function newSide(s) {
    s = s || {};
    return {
      root: typeof s.root === 'string' ? s.root : '', names: Array.isArray(s.names) ? s.names.filter(n => typeof n === 'string').slice(0, MAX_NAMES) : [],
      sort: s.sort && ['name', 'size', 'mtime'].includes(s.sort.by) ? { by: s.sort.by, dir: s.sort.dir === 'desc' ? 'desc' : 'asc' } : { by: 'name', dir: 'asc' },
      handle: null, parent: null, display: '', items: [], truncated: false, cursor: 0, marks: new Set(), anchor: -1, filter: '', error: '',
    };
  }

  P.files = {
    helpers,
    mount(el0, state, api) {
      this.root = el0; this.api = api;
      this.fs = window.vrg && window.vrg.fs;
      this.roots = [];
      this.note = '';
      const st = state && typeof state === 'object' ? state : {};
      this.sides = { left: newSide(st.left), right: newSide(st.right) };
      this.active = st.active === 'right' ? 'right' : 'left';
      el0.innerHTML = '';
      el0.tabIndex = 0;
      el0.dataset.role = 'files';
      this.onKey = e => this.key(e);
      el0.addEventListener('keydown', this.onKey);
      this.draw();
      this.start();
    },
    unmount() {
      if (this.root) { this.root.removeEventListener('keydown', this.onKey); this.root.innerHTML = ''; }
      this.root = null; this.gone = true;
    },
    state() {
      const side = s => ({ root: s.root, names: s.names.slice(0, MAX_NAMES), sort: s.sort });
      return { left: side(this.sides.left), right: side(this.sides.right), active: this.active };
    },
    changed() { if (this.api && this.api.setState) this.api.setState(this.state()); },

    async start() {
      if (!this.fs) { this.note = 'A fájlkezelő ebben a buildben nem érhető el.'; this.draw(); return; }
      const r = await this.fs.roots();
      if (this.gone) return;
      this.roots = r && r.ok !== false && Array.isArray(r.roots) ? r.roots : (Array.isArray(r) ? r : []);
      for (const k of SIDES) {
        const s = this.sides[k];
        if (!this.roots.some(x => x.root === s.root)) { s.root = this.roots[0] ? this.roots[0].root : ''; s.names = []; }
      }
      await Promise.all(SIDES.map(k => this.reopen(k)));
      if (this.gone) return;
      this.draw();
      this.focus();
    },

    // root handle → walk back by names; a missing name stops the walk
    async reopen(k) {
      const s = this.sides[k];
      const root = this.roots.find(x => x.root === s.root);
      if (!root) { s.error = 'Nincs elérhető gyökérmappa.'; return; }
      const w = await walkBack(s.names, h => this.fs.list(h), root.handle);
      if (this.gone) return;
      if (!w) { s.error = 'A mappa nem olvasható.'; s.items = []; return; }
      s.error = ''; s.names = w.names;
      this.apply(k, w.handle, w.reply);
    },
    apply(k, handle, reply) {
      const s = this.sides[k];
      s.handle = handle; s.display = reply.dir && reply.dir.display || ''; s.parent = reply.dir && reply.dir.parent || null;
      s.items = reply.items || []; s.truncated = !!reply.truncated;
      s.marks = new Set(); s.anchor = -1; s.filter = ''; s.cursor = 0;
    },
    async load(k, handle, names) {
      const s = this.sides[k];
      const reply = await this.fs.list(handle);
      if (this.gone) return false;
      if (!reply || reply.ok === false) { this.note = reply && reply.hu || 'A mappa nem olvasható.'; this.draw(); return false; }
      if (names) s.names = names;
      this.apply(k, handle, reply);
      this.note = '';
      this.changed();
      this.draw();
      return true;
    },

    shown(k) {
      const s = this.sides[k];
      const f = s.filter.toLowerCase();
      return sortItems(f ? s.items.filter(i => i.name.toLowerCase().includes(f)) : s.items, s.sort);
    },

    // ---------------------------------------------------------- keys
    key(e) {
      if (e.target && e.target.tagName === 'INPUT') return;
      const s = this.sides[this.active];
      const act = keyAction(e, { filter: s.filter });
      if (!act) return;
      if (act.a === 'type' && e.metaKey) return;
      e.preventDefault();
      this.run(act);
    },
    run(act) {
      const k = this.active, s = this.sides[k], rows = this.shown(k);
      const cur = rows[s.cursor];
      switch (act.a) {
        case 'switch': this.active = k === 'left' ? 'right' : 'left'; this.changed(); break;
        case 'open': if (cur) this.openItem(k, cur); return;
        case 'parent': this.up(k); return;
        case 'mark': if (cur) { this.toggle(s, cur); s.cursor = Math.min(rows.length - 1, s.cursor + 1); } break;
        case 'move': s.cursor = Math.max(0, Math.min(rows.length - 1, act.d === Infinity ? rows.length - 1 : s.cursor + (act.d === -Infinity ? -rows.length : act.d))); s.anchor = -1; break;
        case 'range': {
          if (s.anchor < 0) s.anchor = s.cursor;
          s.cursor = Math.max(0, Math.min(rows.length - 1, s.cursor + act.d));
          const a = Math.min(s.anchor, s.cursor), b = Math.max(s.anchor, s.cursor);
          s.marks = new Set(rows.slice(a, b + 1).map(i => i.name));
          break;
        }
        case 'all': s.marks = new Set(rows.map(i => i.name)); break;
        case 'reload': this.reload(k); return;
        case 'filter': this.note = 'Szűrés: kezdjen gépelni (Esc: törlés)'; break;
        case 'filterBack': s.filter = s.filter.slice(0, -1); s.cursor = 0; break;
        case 'filterClear': s.filter = ''; s.cursor = 0; break;
        case 'type': s.filter += act.ch; s.cursor = 0; break;
        case 'rootMenu': {                                       // Alt+F1 / Alt+F2: a real root dropdown on that side (DESK-Q33 = B)
          this.active = act.side;
          this.draw();
          this.rootMenu(act.side);
          return;
        }
        case 'op': this.op(act.op); return;
      }
      this.draw();
    },
    toggle(s, item) { if (s.marks.has(item.name)) s.marks.delete(item.name); else s.marks.add(item.name); },

    async switchRoot(k, r) {
      this.active = k; this.sides[k].root = r.root;
      await this.load(k, r.handle, []);
      this.focus();
    },
    async openItem(k, item) {
      if (item.kind === 'dir') { const s = this.sides[k]; await this.load(k, item.handle, s.names.concat(item.name).slice(0, MAX_NAMES)); this.focus(); return; }
      if (this.fs && typeof this.fs.open === 'function') {
        const r = await this.fs.open(item.handle);
        this.note = r && r.ok === false ? (r.hu || 'Nem nyitható meg.') : '';
      } else this.note = 'Megnyitás: később';
      this.draw();
    },
    async up(k) {
      const s = this.sides[k];
      if (!s.parent || !s.names.length) return;
      const was = s.names[s.names.length - 1];
      if (await this.load(k, s.parent, s.names.slice(0, -1))) {
        const i = this.shown(k).findIndex(x => x.name === was);
        if (i >= 0) s.cursor = i;
        this.draw(); this.focus();
      }
    },
    async reload(k) {
      const s = this.sides[k];
      if (!s.handle) return;
      const keep = { cursor: s.cursor, filter: s.filter };
      if (await this.load(k, s.handle)) { s.filter = keep.filter; s.cursor = Math.min(keep.cursor, Math.max(0, this.shown(k).length - 1)); this.draw(); this.focus(); }
    },

    // F3–F8: only what this build's vrg.fs has; the rest says "később"
    async op(name) {
      const [label, fn] = OPS[name];
      const k = this.active, s = this.sides[k], other = this.sides[k === 'left' ? 'right' : 'left'];
      if (!this.fs || typeof this.fs[fn] !== 'function') { this.note = label + ': később'; this.draw(); return; }
      const rows = this.shown(k);
      const picked = s.marks.size ? rows.filter(i => s.marks.has(i.name)) : (rows[s.cursor] ? [rows[s.cursor]] : []);
      if (name === 'view') { if (picked[0] && picked[0].kind !== 'dir') await this.view(picked[0]); return; }
      const hs = picked.map(i => i.handle);
      let r = null;
      if (name === 'copy' || name === 'move') {
        if (hs.length && other.handle) {
          const line = hs.length + ' elem ' + (name === 'copy' ? 'másolása' : 'áthelyezése') + ' ide: ' + other.display;
          if (await this.confirm(line)) r = await this.fs[name](hs, other.handle, 'ask');
          else { this.draw(); return; }
        }
      }
      else if (name === 'trash') { if (hs.length) r = await this.fs.trash(hs); }
      else if (name === 'mkdir' || name === 'rename') {
        const v = await this.ask(label, name === 'rename' && picked[0] ? picked[0].name : '');
        if (v && name === 'mkdir') r = await this.fs.mkdir(s.handle, v);
        if (v && name === 'rename' && picked[0]) r = await this.fs.rename(picked[0].handle, v);
      } else if (picked[0] && picked[0].kind !== 'dir') r = await this.fs[fn](picked[0].handle);
      this.note = r && r.ok === false ? (r.hu || label + ': hiba') : '';
      if (r && r.ok !== false && (name === 'mkdir' || name === 'rename')) { await this.reload(k); return; }
      this.draw();
    },
    // F3: the viewer (panes/viewer.js, loaded on first use) opens over this pane; Esc / F3 / Bezár closes it
    async view(item) {
      if (!P.viewer) await new Promise(res => {
        const sc = document.createElement('script');
        sc.src = 'panes/viewer.js'; sc.onload = () => res(); sc.onerror = () => res();
        document.head.append(sc);
      });
      if (this.gone || !this.root) return;
      if (!P.viewer) { this.note = 'Nézőke: nem érhető el'; this.draw(); return; }
      const box = el('div', 'viewer');
      box.style.position = 'absolute'; box.style.inset = '0'; box.style.overflow = 'auto';
      if (getComputedStyle(this.root).position === 'static') this.root.style.position = 'relative';
      const v = Object.create(P.viewer);
      const close = () => { v.unmount(); box.remove(); this.focus(); };
      this.root.append(box);
      v.mount(box, {}, { close });
      v.load(item.handle, item.name);
    },
    // right-click escape hatches: Explorer and the clipboard
    async fsCall(fn, item) {
      if (!this.fs || typeof this.fs[fn] !== 'function') { this.note = 'Később'; this.draw(); return; }
      const r = await this.fs[fn](item.handle);
      this.note = r && r.ok === false ? (r.hu || 'Hiba') : (fn === 'copyPath' ? 'Útvonal másolva' : '');
      this.draw();
    },

    // a one-line inline input (window.prompt does not exist in Electron)
    ask(label, value) {
      return new Promise(res => {
        const box = el('form', 'ask'), inp = el('input', 'name');
        inp.value = value; inp.maxLength = 200; inp.setAttribute('aria-label', label);
        const done = v => { box.remove(); this.focus(); res(v); };
        box.append(el('span', null, label + ': '), inp);
        box.addEventListener('submit', ev => { ev.preventDefault(); done(inp.value.trim()); });
        inp.addEventListener('keydown', ev => { ev.stopPropagation(); if (ev.key === 'Escape') done(''); });
        this.root.append(box); inp.focus(); inp.select();
      });
    },

    // a confirm line: Enter = yes, Esc = no
    confirm(text) {
      return new Promise(res => {
        const box = el('form', 'ask'), ok = el('button', null, 'Enter'), no = el('button', null, 'Mégse');
        ok.type = 'submit'; no.type = 'button'; no.title = 'Esc';
        const done = v => { box.remove(); this.focus(); res(v); };
        box.append(el('span', 'confirm', text + ' '), ok, no);
        box.addEventListener('submit', ev => { ev.preventDefault(); done(true); });
        no.addEventListener('click', () => done(false));
        box.addEventListener('keydown', ev => { ev.stopPropagation(); if (ev.key === 'Escape') done(false); });
        this.root.append(box); ok.focus();
      });
    },

    focus() { if (this.root && !this.root.contains(document.activeElement)) this.root.focus(); },

    // ---------------------------------------------------------- drawing (drag-and-drop between the sides: later)
    draw() {
      if (!this.root) return;
      const ask = this.root.querySelector('[data-role="ask"]'), viewer = this.root.querySelector('[data-role="viewer"]');
      this.root.innerHTML = '';
      const wrap = el('div', 'sides');
      for (const k of SIDES) wrap.append(this.drawSide(k));
      this.root.append(wrap, el('div', 'note', this.note));
      if (ask) this.root.append(ask);
      if (viewer) this.root.append(viewer);
    },
    drawSide(k) {
      const s = this.sides[k], rows = this.shown(k);
      const box = el('section', 'side');
      box.dataset.side = k;
      if (k === this.active) box.dataset.active = '1';
      box.addEventListener('mousedown', () => { if (this.active !== k) { this.active = k; this.changed(); this.draw(); } });

      const bar = el('div', 'roots');
      for (const r of this.roots) {
        const b = el('button', null, r.hu); b.type = 'button'; b.dataset.root = r.root; b.title = r.root;
        if (r.root === s.root) b.dataset.current = '1';
        b.addEventListener('click', () => { this.switchRoot(k, r); });
        bar.append(b);
      }
      const crumb = el('div', 'crumb', s.display); crumb.title = s.display;
      const filt = el('div', 'filter', s.filter ? 'Szűrés: ' + s.filter : ''); filt.title = 'Filter: just type, Esc clears';

      const table = el('table', 'list');
      const head = table.createTHead().insertRow();
      for (const [by, label, en] of [['name', 'Név', 'Name'], ['size', 'Méret', 'Size'], ['mtime', 'Dátum', 'Date'], [null, 'Állapot', 'Status']]) {
        const th = document.createElement('th'); th.textContent = label; th.title = en;
        if (by) {
          th.dataset.sort = by;
          if (s.sort.by === by) th.dataset.dir = s.sort.dir;
          th.addEventListener('click', () => { s.sort = { by, dir: s.sort.by === by && s.sort.dir === 'asc' ? 'desc' : 'asc' }; this.changed(); this.draw(); });
        }
        head.append(th);
      }
      const body = table.createTBody();
      rows.forEach((it, i) => {
        const tr = body.insertRow();
        tr.dataset.name = it.name; tr.dataset.kind = it.kind;
        if (i === s.cursor && k === this.active) tr.dataset.cursor = '1';
        if (s.marks.has(it.name)) tr.dataset.marked = '1';
        const c = [it.kind === 'dir' ? '[' + it.name + ']' : it.name, it.kind === 'dir' ? '' : formatSize(it.size), formatDate(it.mtime), ''];
        c.forEach(t => { tr.insertCell().textContent = t; });
        if (it.cloud && CLOUD[it.cloud]) { const cell = tr.cells[3]; cell.textContent = CLOUD[it.cloud][0]; cell.title = CLOUD[it.cloud][1]; cell.dataset.cloud = it.cloud; }
        tr.addEventListener('click', ev => {
          this.active = k; s.cursor = i;
          if (ev.ctrlKey) this.toggle(s, it);
          this.changed(); this.draw();
        });
        tr.addEventListener('dblclick', () => this.openItem(k, it));
        tr.addEventListener('contextmenu', ev => { ev.preventDefault(); this.active = k; s.cursor = i; this.contextMenu(ev, k, it); });
      });
      const sc = el('div', 'scroll'); sc.append(table);

      const stat = el('div', 'status');
      const marked = s.items.filter(i => s.marks.has(i.name));
      const sum = marked.reduce((a, i) => a + (i.kind === 'dir' ? 0 : i.size), 0);
      stat.append(el('span', 'count', marked.length ? marked.length + ' kijelölve, ' + formatSize(sum) : rows.length + ' elem'));
      if (s.truncated) { const w = el('span', 'warn', 'A lista csonka: az első 5 000 elem látszik'); stat.append(w); }
      if (s.error) stat.append(el('span', 'warn', s.error));
      box.append(bar, crumb, filt, sc, stat);
      return box;
    },
    // the root dropdown under a side's root bar: ↑/↓ move, Enter or 1–9 pick, Esc closes; a click picks too
    rootMenu(k) {
      if (!this.root || !this.roots.length) return;
      const old = this.root.querySelector('[data-role="menu"]'); if (old) old.remove();
      const side = this.root.querySelector('[data-side="' + k + '"]');
      const bar = side && side.querySelector('[data-role="roots"]');
      const r0 = (bar || side || this.root).getBoundingClientRect();
      const m = el('div', 'menu');
      m.dataset.kind = 'roots'; m.tabIndex = -1;
      m.setAttribute('role', 'listbox'); m.setAttribute('aria-label', 'Gyökérmappa');
      m.style.position = 'fixed'; m.style.left = r0.left + 'px'; m.style.top = r0.bottom + 'px';
      let at = Math.max(0, this.roots.findIndex(r => r.root === this.sides[k].root));
      const buttons = this.roots.map((r, i) => {
        const b = el('button', null, (i < 9 ? (i + 1) + '  ' : '') + r.hu);
        b.type = 'button'; b.dataset.root = r.root; b.title = r.root; b.setAttribute('role', 'option');
        b.addEventListener('click', () => pick(i));
        m.append(b);
        return b;
      });
      const mark = () => buttons.forEach((b, i) => { if (i === at) { b.dataset.current = '1'; b.setAttribute('aria-selected', 'true'); b.focus(); } else { delete b.dataset.current; b.removeAttribute('aria-selected'); } });
      const close = () => { m.remove(); document.removeEventListener('mousedown', outside, true); };
      const pick = i => { close(); this.switchRoot(k, this.roots[i]); };
      const outside = ev => { if (!m.contains(ev.target)) { close(); this.focus(); } };
      m.addEventListener('keydown', ev => {
        ev.stopPropagation();
        if (ev.key === 'ArrowDown') { at = (at + 1) % buttons.length; mark(); }
        else if (ev.key === 'ArrowUp') { at = (at - 1 + buttons.length) % buttons.length; mark(); }
        else if (ev.key === 'Home') { at = 0; mark(); }
        else if (ev.key === 'End') { at = buttons.length - 1; mark(); }
        else if (ev.key === 'Enter') pick(at);
        else if (ev.key === 'Escape' || (ev.altKey && (ev.key === 'F1' || ev.key === 'F2'))) { close(); this.focus(); }
        else if (/^[1-9]$/.test(ev.key) && +ev.key <= buttons.length) pick(+ev.key - 1);
        else return;
        ev.preventDefault();
      });
      this.root.append(m);
      mark();
      setTimeout(() => document.addEventListener('mousedown', outside, true), 0);
    },
    contextMenu(ev, k, it) {
      const old = this.root.querySelector('[data-role="menu"]'); if (old) old.remove();
      const m = el('div', 'menu');
      m.style.position = 'fixed'; m.style.left = ev.clientX + 'px'; m.style.top = ev.clientY + 'px';
      const add = (label, fn) => { const b = el('button', null, label); b.type = 'button'; b.addEventListener('click', () => { m.remove(); fn(); }); m.append(b); };
      add('Megnyitás',() => this.openItem(k, it));
      for (const n of ['view', 'edit', 'copy', 'move', 'rename', 'trash']) add(OPS[n][0], () => this.op(n));
      add('Megmutatás Intézőben', () => this.fsCall('reveal', it));
      add('Útvonal másolása', () => this.fsCall('copyPath', it));
      add('Frissítés', () => this.reload(k));
      this.root.append(m);
      const close = () => { m.remove(); document.removeEventListener('mousedown', close, true); };
      setTimeout(() => document.addEventListener('mousedown', close, true), 0);
    },
  };
})();
