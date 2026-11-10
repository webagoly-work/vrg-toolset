// layout.js — renders the layout tree (shell/lib/layout.js, window.VRGLayoutLib) into nested flex boxes.
//   const L = VRGLayout.create({ root, getBody(pane) → element, onChange(tree), onPanes(idSet) });
//   L.set(tree) · L.tree() · L.focusPane(id) · L.focused()
// Boxes carry data-pane / data-kind / data-role hooks (tabs, group, body, handle); no design. Keyboard: Ctrl+Alt+arrows focus,
// Ctrl+W closes the focused tab, Ctrl+\ splits it side by side (Ctrl+Shift+\ stacked).
(function () {
  'use strict';
  const lib = window.VRGLayoutLib;
  const LABEL = { home: 'Kezdőlap', empty: 'Üres panel', files: 'Fájlok', term: 'Terminál', web: 'Böngésző', mail: 'Posta',
    stack: 'Folyamatok', chat: 'Chat', note: 'Jegyzet', git: 'Git', feed: 'Hírek' };
  const el = (tag, attrs, ...kids) => {
    const e = document.createElement(tag);
    for (const k of Object.keys(attrs || {})) { if (k === 'text') e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); }
    kids.forEach(c => e.append(c));
    return e;
  };

  function create({ root, getBody, onChange, onPanes }) {
    let tree = lib.defaultTree(), focusId = '', dragId = '';

    function commit(next) {
      if (next === tree) return;
      tree = next;
      if (focusId && !lib.find(tree, focusId)) focusId = '';
      render();
      onChange && onChange(tree);
    }

    // ------------------------------------------------------------ rendering
    function renderTabs(node, path) {
      const g = el('div', { 'data-role': 'group', 'data-path': path, tabindex: '-1' });
      const strip = el('div', { 'data-role': 'tabs' });
      const body = el('div', { 'data-role': 'body' });
      node.items.forEach((p, i) => {
        const on = i === node.active;
        const tab = el('div', { class: 'tab', 'data-tab': p.id, 'data-active': on ? '1' : '0' });
        const t = el('button', { type: 'button', class: 't', draggable: 'true', text: p.kind === 'app' && p.state && typeof p.state.title === 'string' ? p.state.title.slice(0, 40) : LABEL[p.kind] || p.kind, title: p.kind });
        t.addEventListener('click', () => { commit(lib.focus(tree, p.id)); setFocus(p.id); });
        t.addEventListener('dragstart', e => { dragId = p.id; document.body.dataset.dragging = '1'; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'vrg-pane'); });
        t.addEventListener('dragend', () => { dragId = ''; delete document.body.dataset.dragging; });
        const x = el('button', { type: 'button', class: 'x', text: '×', title: 'Panel bezárása' });
        x.addEventListener('click', () => commit(lib.close(tree, p.id)));
        tab.append(t, x);
        strip.append(tab);
        const b = getBody(p);
        b.hidden = !on;
        body.append(b);
      });
      strip.append(el('span', { class: 'drophint', text: 'Ide húzd a fület' }), el('span', { class: 'sp' }));
      const act = node.items[node.active];
      const sh = el('button', { type: 'button', 'data-role': 'split-h', text: '|', title: 'Felosztás vízszintesen' });
      const sv = el('button', { type: 'button', 'data-role': 'split-v', text: '—', title: 'Felosztás függőlegesen' });
      sh.addEventListener('click', () => commit(lib.split(tree, act.id, 'h')));
      sv.addEventListener('click', () => commit(lib.split(tree, act.id, 'v')));
      strip.append(sh, sv);

      const drop = e => {
        if (!dragId) return;
        e.preventDefault();
        const tabs = [...strip.querySelectorAll('.tab')];
        let idx = tabs.length;
        for (let i = 0; i < tabs.length; i++) { const r = tabs[i].getBoundingClientRect(); if (e.clientX < r.left + r.width / 2) { idx = i; break; } }
        if (e.currentTarget === body) idx = node.items.length;
        const id = dragId; dragId = ''; delete document.body.dataset.dragging;
        commit(lib.move(tree, id, path, idx));
        setFocus(id);
      };
      for (const z of [strip, body]) { z.addEventListener('dragover', e => { if (dragId) e.preventDefault(); }); z.addEventListener('drop', drop); }
      g.addEventListener('pointerdown', () => { const p = tree && lib.nodeAt(tree, path); if (p && p.items) setFocus(p.items[p.active].id, true); }, true);
      g.append(strip, body);
      return g;
    }

    function renderNode(node, path) {
      if (!node.a) return renderTabs(node, path);
      const s = el('div', { class: 'split', 'data-dir': node.dir, 'data-path': path });
      const a = el('div', { class: 'cell' }, renderNode(node.a, path + 'a'));
      const b = el('div', { class: 'cell' }, renderNode(node.b, path + 'b'));
      a.style.flex = node.ratio + ' 1 0'; b.style.flex = (1 - node.ratio) + ' 1 0';
      const h = el('div', { 'data-role': 'handle', 'data-path': path });
      h.addEventListener('pointerdown', e => {
        e.preventDefault(); h.setPointerCapture(e.pointerId);
        let ratio = node.ratio;
        const move = ev => {
          const r = s.getBoundingClientRect();
          const f = node.dir === 'h' ? (ev.clientX - r.left) / r.width : (ev.clientY - r.top) / r.height;
          ratio = Math.max(0.1, Math.min(0.9, f));
          a.style.flex = ratio + ' 1 0'; b.style.flex = (1 - ratio) + ' 1 0';
          onChange && onChange(tree, true);                                 // live: the frame re-reports view rects
        };
        const up = () => { h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up); commit(lib.setRatio(tree, path, ratio)); };
        h.addEventListener('pointermove', move); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
      });
      s.append(a, h, b);
      return s;
    }

    function render() {
      root.replaceChildren(renderNode(tree.root, ''));
      applyFocus();
      onPanes && onPanes(new Set(lib.panes(tree).map(p => p.id)));
    }

    // ------------------------------------------------------------ focus
    function applyFocus() {
      for (const g of root.querySelectorAll('[data-role="group"]')) {
        const n = lib.nodeAt(tree, g.dataset.path);
        g.dataset.focus = n && n.items && focusId && n.items[n.active].id === focusId ? '1' : '0';
      }
    }
    function setFocus(id, soft) {
      focusId = id; applyFocus();
      if (soft) return;
      const g = root.querySelector('[data-role="group"][data-focus="1"]');
      const inner = g && g.querySelector('[data-role="body"] > :not([hidden]) :is(input, button, textarea, [tabindex]):not([disabled])');
      if (inner) inner.focus(); else if (g) g.focus();
    }
    function focusDir(key) {
      const groups = [...root.querySelectorAll('[data-role="group"]')];
      const cur = groups.find(g => g.dataset.focus === '1') || groups[0];
      if (!cur) return;
      const c = r => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
      const from = c(cur.getBoundingClientRect());
      let best = null, bestD = Infinity;
      for (const g of groups) {
        if (g === cur) continue;
        const p = c(g.getBoundingClientRect()), dx = p.x - from.x, dy = p.y - from.y;
        const ok = key === 'ArrowLeft' ? dx < -1 : key === 'ArrowRight' ? dx > 1 : key === 'ArrowUp' ? dy < -1 : dy > 1;
        if (!ok) continue;
        const along = key === 'ArrowLeft' || key === 'ArrowRight' ? Math.abs(dx) : Math.abs(dy);
        const across = key === 'ArrowLeft' || key === 'ArrowRight' ? Math.abs(dy) : Math.abs(dx);
        const d = along + 2 * across;
        if (d < bestD) { bestD = d; best = g; }
      }
      if (best) { const n = lib.nodeAt(tree, best.dataset.path); setFocus(n.items[n.active].id); }
    }
    function focusedOrActive() {
      if (focusId && lib.find(tree, focusId)) return focusId;
      const p = lib.panes(tree)[0]; return p ? p.id : '';
    }

    document.addEventListener('keydown', e => {
      if (e.ctrlKey && e.altKey && /^Arrow(Left|Right|Up|Down)$/.test(e.key)) { e.preventDefault(); focusDir(e.key); }
      else if (e.ctrlKey && !e.altKey && !e.shiftKey && (e.key === 'w' || e.key === 'W')) { e.preventDefault(); const id = focusedOrActive(); if (id) commit(lib.close(tree, id)); }
      else if (e.ctrlKey && !e.altKey && e.key === '\\') { e.preventDefault(); const id = focusedOrActive(); if (id) commit(lib.split(tree, id, e.shiftKey ? 'v' : 'h')); }
    });

    return {
      set(t) { tree = t; render(); },
      tree: () => tree,
      focusPane: id => setFocus(id),
      focused: () => focusId,
      commit,
    };
  }

  window.VRGLayout = { create, LABEL };
})();
