// postit.js — the Post-it overlay page (WP-50, docs/notes/POSTIT.md). Draws the corner buttons, the faint marks, the hovering
// notes and the editor; everything it knows comes from main (postit.state), everything it changes goes back through postit.*.
// Main lets the mouse through this transparent window except over [data-hit] elements; this page reports those crossings (hit).
(function () {
  'use strict';
  const P = window.VrgPostit, vrg = window.vrg;
  const $ = s => document.querySelector(s);
  const call = (fn, p) => vrg.call('postit', fn, p || {});
  const CARD = { w: 190, h: 58 }, EDIT = { w: 260, h: 190 };
  let st = null, hitOn = false, editing = null, sure = false;

  const h = (tag, attrs, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'style') e.style.cssText = v; else e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) if (c != null) e.append(c);
    return e;
  };
  const svg = (tag, attrs) => { const e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };
  const view = () => ({ x: 0, y: 0, w: window.innerWidth, h: window.innerHeight });
  const when = t => { const d = new Date(t); return d.toLocaleDateString('hu-HU') + ' ' + d.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' }); };

  function screenLabel(a) {
    const s = a.screen;
    if (s === 'd:frame/dashboard') return 'Irányítópult nézet';
    if (s === 'd:frame/desktop') return 'Asztal nézet';
    if (s === 'd:home') return 'Kezdőlap';
    if (s === 'd:mail') return 'Posta';
    if (s.startsWith('d:app/')) return 'Alkalmazás: ' + s.slice(6) + (a.detail ? ' · ' + a.detail : '');
    if (s.startsWith('d:web')) return 'Web' + (s.length > 5 ? ': ' + s.slice(6) : '') + (a.detail ? a.detail : '');
    if (s.startsWith('m:')) return 'Telefon: ' + s.slice(2) + (a.detail ? ' · ' + a.detail : '');
    return s;
  }

  async function refresh() {
    const r = await call('state');
    if (!r || r.ok === false) return;
    st = r;
    draw();
  }

  // ---------------------------------------------------------------- the mouse goes through except over [data-hit]
  document.addEventListener('mousemove', e => {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const on = !!(el && el.closest('[data-hit]'));
    if (on !== hitOn) { hitOn = on; call('hit', { on }); }
  });

  // ---------------------------------------------------------------- drawing
  function draw() {
    if (!st) return;
    document.body.classList.toggle('armed', !!st.armed);
    $('#hint').hidden = !st.armed;
    $('#eye').setAttribute('aria-pressed', String(!!st.show));
    $('#arm').setAttribute('aria-pressed', String(!!st.armed));
    $('#dev').hidden = !st.devAllowed;
    $('#dev').setAttribute('aria-pressed', String(!!st.dev));
    const layer = $('#layer'), marks = $('#marks');
    layer.textContent = ''; marks.textContent = '';
    if (!st.show) return;
    const items = st.mine.map(n => ({ n, mine: true })).concat(st.dev ? st.theirs.map(n => ({ n, mine: false })) : []);
    const placed = [];
    for (const it of items) {
      const box = st.boxes[it.n.anchor.screen];
      if (!box) continue;                                       // its screen is not open now
      const m = P.toPx(it.n.anchor, box);
      const c = P.cardAt(m, box, CARD);
      for (let k = 0; k < 8 && placed.some(p => Math.abs(p.x - c.x) < CARD.w && Math.abs(p.y - c.y) < CARD.h + 4); k++) c.y += CARD.h + 6;
      placed.push(c);
      const hue = it.mine ? null : P.hue(it.n.author.id);
      const col = it.mine ? 'var(--pi-paper)' : 'hsl(' + hue + ' 70% 70%)';
      const ex = c.side === 'right' ? c.x : c.x + CARD.w, ey = c.y + 14;
      marks.append(svg('line', { x1: m.x, y1: m.y, x2: ex, y2: ey, stroke: col, 'stroke-opacity': '.45', 'stroke-width': '1' }));
      marks.append(svg('circle', { cx: m.x, cy: m.y, r: '6', fill: 'none', stroke: col, 'stroke-opacity': '.7', 'stroke-width': '1.2' }));
      marks.append(svg('circle', { cx: m.x, cy: m.y, r: '2', fill: col, 'fill-opacity': '.8' }));
      layer.append(h('div', {
        class: 'card' + (it.mine ? '' : ' theirs') + (it.n.state === 'done' ? ' done' : ''), 'data-hit': true,
        style: 'left:' + c.x + 'px;top:' + c.y + 'px' + (hue == null ? '' : ';--h:' + hue), title: screenLabel(it.n.anchor),
        onclick: e => { e.stopPropagation(); openEditor({ mode: it.mine ? 'edit' : 'read', note: it.n, mark: m }); },
      }, it.mine ? null : h('div', { class: 'by' }, it.n.author.name + (it.n.author.device ? ' · ' + it.n.author.device : '')), h('div', { class: 'tx' }, it.n.text)));
    }
    if (editing) placeEditor();
  }

  // ---------------------------------------------------------------- the editor (next to the mark, as in the Planner)
  function placeEditor() {
    const ed = $('#editor');
    const c = P.cardAt(editing.mark, view(), { w: EDIT.w, h: ed.offsetHeight || EDIT.h }, 16);
    ed.style.left = c.x + 'px'; ed.style.top = c.y + 'px';
  }
  async function openEditor(o) {
    editing = o; sure = false;
    const ed = $('#editor');
    ed.textContent = '';
    const n = o.note, a = o.anchor || (n && n.anchor);
    if (o.mode === 'read') {
      ed.append(h('p', { class: 'meta' }, n.author.name + (n.author.device ? ' · ' + n.author.device : '') + ' · ' + when(n.at)),
        h('div', { class: 'read' }, n.text), h('p', { class: 'meta' }, screenLabel(a)),
        h('div', { class: 'row' },
          h('button', { type: 'button', class: 'main', onclick: () => settle(n, n.state === 'done' ? 'open' : 'done') }, n.state === 'done' ? 'Újranyitás' : 'Kész'),
          h('span', { class: 'sp' }), h('button', { type: 'button', onclick: () => closeEditor(false) }, 'Bezár')));
    } else {
      const ta = h('textarea', { placeholder: 'Mit látsz itt? (Ctrl+Enter: mentés)', maxlength: String(P.LIMITS.text) });
      ta.value = n ? n.text : '';
      ta.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); closeEditor(true); } });
      const del = n ? h('button', { type: 'button', onclick: async e => {
        if (!sure) { sure = true; e.target.textContent = 'Biztos?'; return; }
        await call('remove', { id: n.id }); editing = null; hideEditor();
      } }, 'Törlés') : null;
      ed.append(h('p', { class: 'meta' }, screenLabel(a) + (n ? ' · ' + when(n.at) : '')), ta,
        h('div', { class: 'row' },
          h('button', { type: 'button', class: 'main', onclick: () => closeEditor(true) }, 'Mentés'),
          n ? h('button', { type: 'button', onclick: async () => { await call('save', { id: n.id, state: n.state === 'done' ? 'open' : 'done' }); editing = null; hideEditor(); } }, n.state === 'done' ? 'Újranyitás' : 'Kész') : null,
          h('span', { class: 'sp' }), del, h('button', { type: 'button', onclick: () => closeEditor(false) }, 'Mégse')));
      setTimeout(() => ta.focus(), 30);
    }
    ed.hidden = false;
    await call('focus', { on: true });
    placeEditor();
    if (o.mode === 'new') drawPending(o.mark);
  }
  function drawPending(m) {                                       // the faint mark of the note being written
    const marks = $('#marks');
    marks.append(svg('circle', { cx: m.x, cy: m.y, r: '6', fill: 'none', stroke: 'var(--pi-paper)', 'stroke-opacity': '.8', 'stroke-width': '1.2', 'data-pending': '1' }));
    marks.append(svg('circle', { cx: m.x, cy: m.y, r: '2', fill: 'var(--pi-paper)', 'data-pending': '1' }));
  }
  function hideEditor() { $('#editor').hidden = true; call('focus', { on: false }); refresh(); }
  async function closeEditor(save) {
    const o = editing;
    if (!o) return;
    const ta = $('#editor textarea');
    const text = ta ? ta.value.trim() : '';
    if (save && o.mode !== 'read' && text) {
      const r = o.mode === 'new' ? await call('save', { text, anchor: o.anchor }) : await call('save', { id: o.note.id, text });
      if (r && r.ok === false) { const m = $('#editor .meta'); if (m) m.textContent = r.hu || 'Nem mentődött.'; return; }
    }
    editing = null;
    hideEditor();
  }
  async function settle(n, state) { await call('settle', { author: n.author.id, id: n.id, state }); editing = null; hideEditor(); }

  // ---------------------------------------------------------------- the two buttons (and Dev), the menu
  async function setArmed(on) {
    if (editing) await closeEditor(true);
    await call('arm', { on });
    await call('focus', { on });                                  // Esc reaches this page while armed
    refresh();
  }
  $('#eye').addEventListener('click', async e => { e.stopPropagation(); await call('show', { on: !st.show }); refresh(); });
  $('#arm').addEventListener('click', e => { e.stopPropagation(); hideMenu(); setArmed(!st.armed); });
  $('#arm').addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); toggleMenu(); });
  $('#dev').addEventListener('click', async e => { e.stopPropagation(); await call('dev', { on: !st.dev }); refresh(); });

  function hideMenu() { $('#menu').hidden = true; }
  function toggleMenu() { if ($('#menu').hidden) showMenu(); else hideMenu(); }
  function showMenu(msg) {
    const menu = $('#menu');
    menu.textContent = '';
    const name = h('input', { type: 'text', value: st.name || '', placeholder: 'a neved az exportban', maxlength: '60' });
    name.addEventListener('change', () => vrg.app.setting('postit.name', name.value.trim().slice(0, 60)));
    const note = t => { const m = menu.querySelector('.msg'); if (m) m.textContent = t; };
    let wipe = false;
    menu.append(h('h4', {}, 'Post-it'), h('label', {}, 'Név', name),
      h('button', { type: 'button', class: 'it', onclick: async () => {
        const r = await call('export');
        note(r.ok ? r.count + ' jegyzet kiírva: ' + r.file : (r.err === 'cancelled' ? '' : r.hu || 'Nem sikerült.'));
      } }, 'Exportálás fájlba… (' + st.mine.length + ')'),
      h('button', { type: 'button', class: 'it', onclick: async e => {
        if (!wipe) { wipe = true; e.target.textContent = 'Biztos? Mind törlődik'; return; }
        await call('clearMine'); refresh(); note('A saját jegyzetek törölve.');
      } }, 'Saját jegyzetek törlése'));
    if (st.devAllowed) {
      menu.append(h('h4', {}, 'Fejlesztő'),
        h('button', { type: 'button', class: 'it', onclick: async () => {
          const r = await call('import');
          if (r.err === 'cancelled') return;
          await refresh(); showMenu(r.added + ' új, ' + r.updated + ' frissült' + (r.bad && r.bad.length ? ' · hibás: ' + r.bad.join(', ') : ''));
        } }, 'Behívás fájlból…'));
      for (const a of st.authors) {
        const cb = h('input', { type: 'checkbox', checked: !a.hidden });
        cb.addEventListener('change', async () => { await call('devHide', { id: a.id, hide: !cb.checked }); refresh(); });
        menu.append(h('label', { style: 'border-left:3px solid hsl(' + P.hue(a.id) + ' 70% 70%)' }, cb, a.name + ' · ' + a.platform + (a.device ? ' · ' + a.device : '') + ' (' + a.count + ')'));
      }
    }
    menu.append(h('div', { class: 'msg' }, msg || ''));
    menu.hidden = false;
    call('focus', { on: true });
  }

  // ---------------------------------------------------------------- the armed click, outside clicks, Esc
  document.addEventListener('click', async e => {
    if (!st) return;
    if (st.armed && !e.target.closest('#dock')) {
      e.preventDefault();
      const x = Math.round(e.clientX), y = Math.round(e.clientY);
      const r = await call('place', { x, y });
      st.armed = false; draw();
      if (r && r.anchor) openEditor({ mode: 'new', anchor: r.anchor, mark: { x, y } });
      return;
    }
    if (editing && !e.target.closest('#editor')) closeEditor(true);
    if (!$('#menu').hidden && !e.target.closest('#menu')) { hideMenu(); if (!editing) call('focus', { on: false }); }
  }, true);
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (editing) closeEditor(false);
    else if (!$('#menu').hidden) { hideMenu(); call('focus', { on: false }); }
    else if (st && st.armed) setArmed(false);
  });

  vrg.on('postit', 'changed', refresh);
  window.addEventListener('resize', draw);
  refresh();
}());
