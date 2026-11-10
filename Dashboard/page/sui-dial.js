// sui-dial.js — the Sarokvezérlő (corner dial) of the VRG Asztal, WP-42. The Planner's Simple-UI dial (docs/simple-ui/01_DESIGN.md
// §2–§4) lifted into the shell as a component; the Planner keeps its own code. Classic script → window.VRGSuiDial.
//   const d = VRGSuiDial.create({ host, side:'left'|'right', tree, label, glyph, onPick(leaf) → 'stay' | void, onOpen(bool), match(items, q) })
//   d.open() · d.close() · d.toggle() · d.isOpen() · d.setTree(tree) · d.el · d.state() → { open, depth, path, page, query }
// Geometry (§2): an 88 px quadrant whose centre is the window corner; the column rises 12 px above it, 248 wide, items 48 high, gap 6;
// at most 5 rows = 4 content + Back (Bezár at the root), Back always the bottom one; > 4 children → 3 + TOVÁBB per page; a breadcrumb
// line above the top item; letters start type-to-search; 1–5 pick a slot; ↑/↓ move, Enter/→ activate, ←/Backspace/Esc go back.
(function () {
  'use strict';
  const MAX = 5, PAGE = 3;
  const SVGNS = 'http://www.w3.org/2000/svg';
  const fold = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const defaultMatch = (items, q) => {
    const ws = fold(q).split(/[^a-z0-9]+/).filter(Boolean);
    if (!ws.length) return [];
    return items.filter(it => { const w = fold(it.label + ' ' + (it.en || '') + ' ' + (it.trail || []).join(' ')).split(/[^a-z0-9]+/); return ws.every(x => w.some(y => y.startsWith(x))); });
  };
  const allLeaves = tree => { const out = []; const walk = (n, t) => { for (const c of n.children || []) { if (c.children) walk(c, t.concat(c.label)); else out.push(Object.assign({}, c, { trail: t })); } }; walk(tree, []); return out; };

  function dialSvg() {
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', '0 0 88 88'); svg.setAttribute('width', '88'); svg.setAttribute('height', '88'); svg.setAttribute('aria-hidden', 'true');
    const el = (n, a) => { const e = document.createElementNS(SVGNS, n); for (const k in a) e.setAttribute(k, a[k]); svg.appendChild(e); return e; };
    // centre (0, 88) = the window corner; only the quadrant inside the window is drawn
    const arc = (r, a0, a1) => { const p = a => [r * Math.cos(a * Math.PI / 180), 88 - r * Math.sin(a * Math.PI / 180)]; const [x0, y0] = p(a0), [x1, y1] = p(a1); return 'M' + x0.toFixed(2) + ' ' + y0.toFixed(2) + ' A' + r + ' ' + r + ' 0 0 0 ' + x1.toFixed(2) + ' ' + y1.toFixed(2); };
    el('path', { d: 'M0 88 L0 0 A88 88 0 0 1 88 88 Z', class: 'g' });
    el('path', { d: arc(87, 0, 90), class: 'r1' });
    el('path', { d: arc(64, 0, 90), class: 'r2' });
    for (let i = 0; i < 10; i++) { const a = (i * 9 + 4.5) * Math.PI / 180; el('line', { x1: (88 * Math.cos(a)).toFixed(2), y1: (88 - 88 * Math.sin(a)).toFixed(2), x2: (82 * Math.cos(a)).toFixed(2), y2: (88 - 82 * Math.sin(a)).toFixed(2), class: 'tk' }); }
    for (let i = 0; i < 4; i++) el('path', { d: arc(76, i * 22.5 + 2, i * 22.5 + 20.5), class: 'dp', 'data-depth': String(i + 1) });
    el('path', { d: 'M0 88 L0 48 A40 40 0 0 1 40 88 Z', class: 'core' });
    return svg;
  }

  function create(o) {
    const side = o.side === 'right' ? 'right' : 'left';
    const match = typeof o.match === 'function' ? o.match : defaultMatch;
    let tree = o.tree || { label: 'MENÜ', children: [] };
    let open = false, stack = [], page = 0, focus = 0, query = null, qOff = 0;

    const el = document.createElement('div');
    el.className = 'sui'; el.dataset.side = side; el.dataset.role = 'sui-' + side;
    const col = document.createElement('div'); col.className = 'sui-col'; col.setAttribute('role', 'menu'); col.hidden = true;
    col.setAttribute('aria-label', o.label || tree.label || 'Menü');
    const crumb = document.createElement('div'); crumb.className = 'sui-crumb'; crumb.dataset.role = 'sui-crumb';
    const list = document.createElement('div'); list.className = 'sui-list';
    col.append(crumb, list);
    const dial = document.createElement('button');
    dial.type = 'button'; dial.className = 'sui-dial'; dial.dataset.role = 'sui-dial-' + side;
    dial.setAttribute('aria-haspopup', 'menu'); dial.setAttribute('aria-expanded', 'false');
    dial.title = (o.label || tree.label || '') + (o.en ? ' / ' + o.en : '');
    dial.append(dialSvg());
    const core = document.createElement('span'); core.className = 'sui-core'; core.textContent = o.glyph || '≡'; dial.append(core);
    el.append(col, dial);
    (o.host || document.body).append(el);

    const node = () => stack.length ? stack[stack.length - 1] : tree;
    // the rows of the current level: content (≤ 4, or 3 + TOVÁBB when paging), then Back / Bezár at the bottom
    function rows() {
      if (query !== null) {
        const hits = match(allLeaves(tree), query);
        const win = hits.slice(qOff, qOff + MAX - 1);
        return { hits, items: win.map(h => ({ kind: 'leaf', it: h })).concat([{ kind: 'back', label: '◂ VISSZA', en: 'Back' }]) };
      }
      const kids = node().children || [];
      let items;
      if (kids.length <= MAX - 1) items = kids.map(k => ({ kind: k.children ? 'node' : 'leaf', it: k }));
      else {
        const pages = Math.ceil(kids.length / PAGE);
        if (page >= pages) page = pages - 1;
        items = kids.slice(page * PAGE, page * PAGE + PAGE).map(k => ({ kind: k.children ? 'node' : 'leaf', it: k }));
        if (page < pages - 1) items.push({ kind: 'more', label: 'TOVÁBB ›', en: 'More' });
      }
      items.push(stack.length || page ? { kind: 'back', label: '◂ VISSZA', en: 'Back' } : { kind: 'back', label: '✕ BEZÁR', en: 'Close', close: true });
      return { items, pages: kids.length > MAX - 1 ? Math.ceil(kids.length / PAGE) : 1 };
    }
    function draw() {
      const r = rows();
      if (query !== null) {
        const n = r.hits.length;
        crumb.textContent = '⌕ ' + query + '▏   ' + (n ? (qOff + 1) + '–' + Math.min(n, qOff + MAX - 1) + ' / ' + n : '0');
      } else {
        const trail = [tree.label || 'MENÜ'].concat(stack.map(s => s.label));
        crumb.textContent = trail.join(' / ').toUpperCase() + (r.pages > 1 ? ' (' + (page + 1) + '/' + r.pages + ')' : '');
      }
      list.textContent = '';
      if (focus >= r.items.length) focus = r.items.length - 1;
      r.items.forEach((row, i) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'sui-item'; b.setAttribute('role', 'menuitem'); b.dataset.slot = String(i + 1);
        b.dataset.kind = row.kind;
        if (row.kind === 'back') b.classList.add('back');
        const ix = document.createElement('span'); ix.className = 'ix'; ix.textContent = '0' + (i + 1);
        const ic = document.createElement('span'); ic.className = 'ic';
        const lb = document.createElement('span'); lb.className = 'lb';
        const ch = document.createElement('span'); ch.className = 'ch';
        if (row.it) {
          ic.textContent = row.it.icon || '';
          lb.textContent = row.it.label;
          b.title = row.it.en || '';
          if (row.kind === 'node') ch.textContent = '›';
          else if (row.it.stay) ch.textContent = '↺';
          if (row.it.id) b.dataset.id = row.it.id;
          if (row.kind === 'leaf' && row.it.opens === false) {
            b.setAttribute('aria-disabled', 'true');
            const why = document.createElement('span'); why.className = 'why'; why.textContent = 'nem elérhető most'; lb.append(why);
          }
          if (query !== null && row.it.trail && row.it.trail.length) { const t = document.createElement('span'); t.className = 'why'; t.textContent = row.it.trail.join(' / '); lb.append(t); }
        } else { lb.textContent = row.label; b.title = row.en || ''; }
        if (i === focus) b.dataset.focus = '1';
        b.addEventListener('mouseenter', () => { focus = i; mark(); });
        b.addEventListener('click', e => { e.stopPropagation(); activate(i); });
        b.append(ix, ic, lb, ch);
        list.append(b);
      });
      for (const p of dial.querySelectorAll('.dp')) p.classList.toggle('lit', Number(p.dataset.depth) <= stack.length + (open ? 1 : 0));
    }
    function mark() { list.querySelectorAll('.sui-item').forEach((b, i) => { if (i === focus) b.dataset.focus = '1'; else delete b.dataset.focus; }); }
    function back() {
      if (query !== null) { query = null; qOff = 0; focus = 0; draw(); return; }
      if (page > 0) { page--; draw(); return; }
      if (stack.length) { stack.pop(); page = 0; focus = 0; draw(); return; }
      close();
    }
    function activate(i) {
      const r = rows(), row = r.items[i];
      if (!row) return;
      if (row.kind === 'back') return back();
      if (row.kind === 'more') { page++; focus = 0; draw(); return; }
      if (row.kind === 'node') { stack.push(row.it); page = 0; focus = 0; query = null; draw(); return; }
      if (row.it.opens === false) return;
      const res = o.onPick ? o.onPick(row.it) : undefined;
      if (row.it.stay || res === 'stay') { draw(); return; }
      close();
    }
    function setOpen(v) {
      open = v; col.hidden = !v; el.dataset.open = v ? '1' : '';
      dial.setAttribute('aria-expanded', String(v)); core.textContent = v ? '×' : (o.glyph || '≡');
      if (v) { stack = []; page = 0; focus = 0; query = null; qOff = 0; draw(); }
      else draw();
      if (o.onOpen) { try { o.onOpen(v); } catch (e) {} }
    }
    function openIt() { if (!open) setOpen(true); }
    function close() { if (open) setOpen(false); }
    dial.addEventListener('click', e => { e.stopPropagation(); open ? close() : openIt(); });
    col.addEventListener('click', e => e.stopPropagation());

    function onKey(e) {
      if (!open || e.ctrlKey || e.altKey || e.metaKey) return;
      const r = rows(), n = r.items.length, k = e.key;
      let used = true;
      if (k === 'ArrowDown') { if (query !== null && focus === n - 2 && qOff + MAX - 1 < r.hits.length) qOff++; else focus = (focus + 1) % n; draw(); }
      else if (k === 'ArrowUp') { if (query !== null && focus === 0 && qOff > 0) qOff--; else focus = (focus - 1 + n) % n; draw(); }
      else if (k === 'Enter' || k === 'ArrowRight') activate(focus);
      else if (k === 'Escape' || k === 'ArrowLeft') back();
      else if (k === 'Backspace') { if (query !== null && query.length > 1) { query = query.slice(0, -1); qOff = 0; focus = 0; draw(); } else back(); }
      else if (query === null && /^[1-5]$/.test(k)) activate(Number(k) - 1);
      else if (k.length === 1 && /[\p{L}\p{N} ]/u.test(k) && !(query === null && k === ' ')) { query = (query || '') + k; qOff = 0; focus = 0; draw(); }
      else used = false;
      if (used) { e.preventDefault(); e.stopPropagation(); }
    }
    document.addEventListener('keydown', onKey, true);
    const outside = () => { if (open) close(); };
    document.addEventListener('click', outside);
    draw();

    return {
      el, open: openIt, close, toggle: () => (open ? close() : openIt()), isOpen: () => open,
      setTree(t) { tree = t || { label: 'MENÜ', children: [] }; stack = []; page = 0; focus = 0; query = null; draw(); },
      state: () => ({ open, depth: stack.length, path: stack.map(s => s.label), page, query, rows: rows().items.map(r => (r.it ? r.it.label : r.label)) }),
      key: k => onKey({ key: k, preventDefault() {}, stopPropagation() {} }),   // probes drive it without a real keyboard
      pick: i => activate(i),
      destroy() { document.removeEventListener('keydown', onKey, true); document.removeEventListener('click', outside); el.remove(); },
    };
  }

  window.VRGSuiDial = { create, fold, defaultMatch };
})();
