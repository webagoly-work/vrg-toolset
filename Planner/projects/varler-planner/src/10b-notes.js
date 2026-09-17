// ==========================================================================
// 10b-notes.js — Jegyzet eszköz: beállító panel, lista panel, réteg-alréteg
//
// WHERE: src/10b-notes.js — after 10-lamps.js (it extends the note context
// menu declared there) and before 11-controls.js. build.js accepts NNx names.
//
// ── THE GOLDEN-RENDER CONTRACT ──────────────────────────────────────────
// 70 golden renders are compared BYTE-IDENTICALLY and several contain notes.
// ntSym() therefore returns the ORIGINAL markup, character for character,
// whenever a note carries none of the new fields. New appearance is opt-in
// per note; an untouched drawing renders exactly as it did in 1.0.
//
// tests/notes-smoke.js asserts that equality against a literal copy of the
// old template. If you change ntSym, that test is the one that will tell you
// the goldens are about to move.
//
// ── DATA MODEL (all fields optional, all absent by default) ─────────────
//   n.icon   'pin' | 'kind' | 'num' | 'none'   default 'pin' (the 1.0 marker)
//   n.fs     text size in px                    default 10.5
//   n.is     icon scale multiplier              default 1
//   n.op     opacity 0.15–1                     default 1
//   n.hidden true = drawn nowhere               default false
//   n.ord    sort key for the numbered list     default = array index
//   n.layer  existing; the note sub-layer reads layerShows(n,'note')
//
// Nothing is written to a note until the user changes it, so a .vplan.json
// from 1.0 round-trips unchanged and the schema spec sees no new keys.
//
// ── THE NOTE SUB-LAYER ──────────────────────────────────────────────────
// layerShows(item,'note') already works: L.cats.note is undefined on every
// existing layer and `undefined !== false` is true, so notes stay visible
// until someone turns them off. The toggles live in the list panel's Rétegek
// section. Adding the matching "N" button to the main layer rail is a
// one-line change in 11-controls.js — see NOTES-README in the reply.
//
// Single global: NOTES. Everything else is nt-prefixed.
// ==========================================================================

/* ---- defaults ------------------------------------------------------------
   Live on state, not data: they describe how THIS user likes new notes to
   look, not what the drawing contains. Keeping them out of `data` is also
   what keeps the schema spec and the goldens quiet. */
const NTDEF = { icon: 'pin', fs: 10.5, is: 1, op: 1 };

function ntDef() {
  if (!state.noteDef) state.noteDef = Object.assign({}, NTDEF);
  return state.noteDef;
}
function ntGet(n, k) {
  if (n && n[k] != null) return n[k];
  return ntDef()[k];
}

/* ---- ordering and numbering ---------------------------------------------- */

// The list order. n.ord wins when present; notes without one keep their array
// position, so a drawing that has never been reordered numbers 1..N top-down
// in creation order.
function ntOrdered() {
  return data.notes
    .map((n, i) => ({ n: n, i: i, k: (n.ord != null ? n.ord : i) }))
    .sort((a, b) => (a.k - b.k) || (a.i - b.i));
}
function ntNumber(n) {
  const list = ntOrdered();
  const at = list.findIndex(r => r.n === n);
  return at < 0 ? null : at + 1;
}
// Rewrite ord to 0..N-1 so later inserts and drags stay predictable.
function ntRenumber() {
  ntOrdered().forEach((r, k) => { r.n.ord = k; });
  return data.notes.length;
}
// Move the note at list position `from` to position `to`.
function ntReorder(from, to) {
  const list = ntOrdered().map(r => r.n);
  if (from < 0 || from >= list.length || to < 0 || to >= list.length || from === to) return false;
  const moved = list.splice(from, 1)[0];
  list.splice(to, 0, moved);
  list.forEach((n, k) => { n.ord = k; });
  return true;
}

/* ---- visibility ----------------------------------------------------------- */

function ntVisible(n) {
  if (!n || n.hidden) return false;
  if (typeof layerShows === 'function' && !layerShows(n, 'note')) return false;
  return true;
}
// Per-layer note toggle. Mirrors how layerShows reads cats.
function ntLayerShows(L) { return !L || L.cats.note !== false; }
function ntLayerToggle(id) {
  const L = layerById(id);
  L.cats.note = !ntLayerShows(L);
  return L.cats.note;
}

/* ---- the symbol ----------------------------------------------------------
   Called from 04-render.js. See the golden-render contract at the top. */
function ntSym(n, i, b) {
  const icon = ntGet(n, 'icon'), fs = ntGet(n, 'fs'),
        is = ntGet(n, 'is'), op = ntGet(n, 'op');

  // ── the 1.0 path, byte for byte ──
  if (icon === 'pin' && fs === 10.5 && is === 1 && op === 1)
    return `<g><path d="M${b[0]} ${b[1]} l-6 -12 a6 6 0 1 1 12 0 z" fill="#d1493f" stroke="#7a2a24"/><text x="${b[0] + 9}" y="${b[1] - 9}" font-size="10.5" fill="#333" paint-order="stroke" stroke="#fff" stroke-width="3">${esc(n.text)}</text></g>`;

  const K = NOTEKIND[noteKind(n)] || NOTEKIND.info;
  const o = (op != null && op !== 1) ? ` opacity="${(+op).toFixed(2)}"` : '';
  let s = `<g${o}>`;

  if (icon === 'pin') {
    const k = is || 1;
    s += `<path d="M${b[0]} ${b[1]} l${(-6 * k).toFixed(1)} ${(-12 * k).toFixed(1)} a${(6 * k).toFixed(1)} ${(6 * k).toFixed(1)} 0 1 1 ${(12 * k).toFixed(1)} 0 z" fill="#d1493f" stroke="#7a2a24"/>`;
  } else if (icon === 'kind') {
    s += `<text x="${b[0]}" y="${(b[1] - 4).toFixed(1)}" font-size="${(12 * (is || 1)).toFixed(1)}" text-anchor="middle">${esc(K.ic)}</text>`;
  } else if (icon === 'num') {
    const r = 8 * (is || 1), num = ntNumber(n) || '?';
    s += `<circle cx="${b[0]}" cy="${(b[1] - r).toFixed(1)}" r="${r.toFixed(1)}" fill="${K.bg}" stroke="${K.bd}" stroke-width="1.2"/>`
      + `<text x="${b[0]}" y="${(b[1] - r + r * 0.36).toFixed(1)}" font-size="${(r * 1.1).toFixed(1)}" text-anchor="middle" font-weight="700" fill="${K.fg}">${num}</text>`;
  }

  const dx = icon === 'none' ? 0 : 9 * (is || 1);
  s += `<text x="${(b[0] + dx).toFixed(1)}" y="${(b[1] - 9).toFixed(1)}" font-size="${(+fs).toFixed(1)}" fill="#333" paint-order="stroke" stroke="#fff" stroke-width="3">${esc(n.text)}</text>`;
  return s + `</g>`;
}

/* ---- context menu (RCO) --------------------------------------------------
   Called from 10-lamps.js's generic-hit branch. Before this, a note's entire
   right-click menu was one Delete. */
function ntMenuItems(i, items) {
  const n = data.notes[i]; if (!n) return items;
  const set = (fn) => { pushUndo(); fn(); draw(); ntRefresh(); };

  items.push({ label: '✎ Szöveg szerkesztése…', act: () => ntEditText(i) });

  Object.keys(NOTEKIND).forEach(k => {
    if (noteKind(n) === k) return;
    items.push({ label: NOTEKIND[k].ic + ' → ' + NOTEKIND[k].n, act: () => set(() => { n.kind = k; }) });
  });

  const IC = { pin: '📍 tű', kind: '🏷 típus ikon', num: '🔢 sorszám', none: '∅ nincs ikon' };
  Object.keys(IC).forEach(k => {
    if (ntGet(n, 'icon') === k) return;
    items.push({ label: 'Ikon: ' + IC[k], act: () => set(() => { n.icon = k; }) });
  });

  items.push({ label: '🎚 Méret és átlátszóság…', act: () => ntSizeDialog(i) });
  items.push({ label: n.hidden ? '👁 Mutatás' : '🚫 Elrejtés', act: () => set(() => { n.hidden = !n.hidden; }) });
  items.push({ label: '⧉ Másolás', act: () => set(() => {
    const c = Object.assign({}, n, { x: n.x + 300, y: n.y + 300 }); delete c.ord;
    data.notes.push(c);
  }) });
  items.push({ label: '⇧ Előre a listában', act: () => set(() => { const p = ntNumber(n) - 1; ntReorder(p, Math.max(0, p - 1)); }) });
  items.push({ label: '⇩ Hátra a listában', act: () => set(() => { const p = ntNumber(n) - 1; ntReorder(p, Math.min(data.notes.length - 1, p + 1)); }) });
  items.push({ label: '→ Réteg…', act: () => sendToLayer(n) });
  items.push({ label: '📋 Lista panel', act: () => ntShow('list', true) });
  return items;
}

function ntEditText(i) {
  const n = data.notes[i]; if (!n) return;
  openModal('Jegyzet szövege',
    `<div class="mrow"><textarea id="ntTx" rows="4" style="width:100%;font:inherit">${esc(n.text || '')}</textarea></div>`
    + `<div class="mrow" style="font-size:11px;color:#777">A rajzon egy sorban jelenik meg; a lista panel a teljes szöveget mutatja.</div>`,
    () => { pushUndo(); n.text = $('ntTx').value; draw(); ntRefresh(); });
}

function ntSizeDialog(i) {
  const n = data.notes[i]; if (!n) return;
  openModal('Jegyzet megjelenése',
    ntSliderRow('ntdFs', 'Szöveg', 6, 24, 0.5, ntGet(n, 'fs'), 'px')
    + ntSliderRow('ntdIs', 'Ikon', 0.5, 3, 0.1, ntGet(n, 'is'), '×')
    + ntSliderRow('ntdOp', 'Átlátszóság', 0.15, 1, 0.05, ntGet(n, 'op'), ''),
    () => {
      pushUndo();
      n.fs = +$('ntdFs').value; n.is = +$('ntdIs').value; n.op = +$('ntdOp').value;
      draw(); ntRefresh();
    }, 'Alkalmaz');
}

function ntSliderRow(id, label, min, max, step, val, unit) {
  return `<div class="mrow" style="display:flex;align-items:center;gap:8px">
    <label style="width:96px">${esc(label)}</label>
    <input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${val}" style="flex:1">
    <span id="${id}_v" style="width:52px;text-align:right;font:11px ui-monospace,monospace">${val}${esc(unit)}</span></div>`;
}

/* ---- the panels ----------------------------------------------------------- */

const NTUI = { panel: false, list: false, built: false, drag: null };

function ntEnsureDom() {
  if (NTUI.built) return;
  const st = document.createElement('style');
  st.textContent = `
  .ntP{position:fixed;right:12px;width:268px;z-index:9998;background:#fbf9f4;border:1px solid #cfc6b4;
       border-radius:8px;box-shadow:0 4px 14px #0002;font:12px system-ui,sans-serif;color:#2c2519;display:none}
  .ntP.on{display:block}
  .ntP h5{margin:0;padding:7px 10px;font-size:12px;background:#efe9dc;border-bottom:1px solid #cfc6b4;
          border-radius:8px 8px 0 0;display:flex;justify-content:space-between;align-items:center}
  .ntP h5 button{border:none;background:none;cursor:pointer;font-size:13px;line-height:1;padding:0 2px}
  .ntB{padding:8px 10px;max-height:46vh;overflow:auto}
  .ntR{display:flex;align-items:center;gap:6px;margin-bottom:6px}
  .ntR>label{width:86px;flex:none;color:#5b5240}
  .ntR input[type=range]{flex:1;min-width:0}
  .ntR .v{width:46px;text-align:right;font:11px ui-monospace,monospace;color:#7a6d54}
  .ntSeg{display:flex;gap:3px}
  .ntSeg button{flex:1;padding:3px 0;border:1px solid #cfc6b4;background:#fff;border-radius:4px;cursor:pointer;font-size:11px}
  .ntSeg button.on{background:#e8a33d;border-color:#c8862b;color:#2c2519;font-weight:700}
  .ntLi{display:flex;align-items:flex-start;gap:6px;padding:5px 6px;border:1px solid transparent;
        border-radius:5px;cursor:grab;background:#fff;margin-bottom:3px}
  .ntLi:hover{border-color:#dcd3c0}
  .ntLi.sel{border-color:#e8a33d;background:#fff8ec}
  .ntLi.drop{border-top:2px solid #e8a33d}
  .ntLi .n{font:700 11px ui-monospace,monospace;color:#8a7a56;min-width:20px}
  .ntLi .tx{flex:1;line-height:1.35;word-break:break-word}
  .ntLi .mt{font-size:10px;color:#9a8f78}
  .ntLi.hid .tx{opacity:.45;text-decoration:line-through}
  .ntFoot{padding:7px 10px;border-top:1px solid #cfc6b4;display:flex;gap:5px;flex-wrap:wrap}
  .ntFoot button{padding:3px 7px;border:1px solid #cfc6b4;background:#fff;border-radius:4px;cursor:pointer;font-size:11px}
  .ntLay{margin-top:8px;padding-top:7px;border-top:1px dashed #dcd3c0}
  .ntLay .lr{display:flex;align-items:center;gap:6px;margin-bottom:3px}
  .ntLay .lr span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .ntEmpty{color:#9a8f78;padding:10px 2px;text-align:center}`;
  document.head.appendChild(st);

  const mk = (id, top, title) => {
    const d = document.createElement('div');
    d.className = 'ntP'; d.id = id; d.style.top = top;
    d.innerHTML = `<h5><span>${title}</span><button data-x="${id}" title="Bezár">✕</button></h5><div class="ntB"></div>`;
    document.body.appendChild(d);
    d.querySelector('[data-x]').onclick = () => ntShow(id === 'ntPanel' ? 'panel' : 'list', false);
    return d;
  };
  mk('ntPanel', '56px', '📝 Jegyzet beállítások');
  mk('ntList', '300px', '📋 Jegyzetek');
  NTUI.built = true;
}

function ntShow(which, on) {
  ntEnsureDom();
  NTUI[which] = (on == null) ? !NTUI[which] : !!on;
  const el = $(which === 'panel' ? 'ntPanel' : 'ntList');
  if (el) el.classList.toggle('on', NTUI[which]);
  ntRefresh();
}

// Called from setMode() in 08-interaction.js.
function ntOnMode(m) { if (m === 'note') ntShow('panel', true); }

function ntSelected() {
  const s = (typeof selected !== 'undefined') ? selected : null;
  return (s && s.t === 'notes' && s.i != null) ? s.i : null;
}

function ntRefresh() {
  if (!NTUI.built) return;
  if (NTUI.panel) ntPaintPanel();
  if (NTUI.list) ntPaintList();
}

/* ---- panel 1: settings ---------------------------------------------------- */

function ntPaintPanel() {
  const host = $('ntPanel'); if (!host) return;
  const body = host.querySelector('.ntB');
  const i = ntSelected(), n = (i != null) ? data.notes[i] : null;
  const tgt = n || ntDef();
  const row = (id, label, min, max, step, val, unit) =>
    `<div class="ntR"><label>${esc(label)}</label>
     <input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${val}">
     <span class="v" id="${id}_v">${(+val).toFixed(step < 1 ? 2 : 0)}${esc(unit)}</span></div>`;

  const icon = n ? ntGet(n, 'icon') : ntDef().icon;
  const IC = [['pin', '📍'], ['kind', '🏷'], ['num', '🔢'], ['none', '∅']];

  body.innerHTML =
    `<div style="margin-bottom:7px;color:#6b6250">${n
      ? `Kijelölt jegyzet <b>#${ntNumber(n)}</b>`
      : `Nincs kijelölés — az <b>új jegyzetek</b> alapértéke`}</div>`
    + `<div class="ntR"><label>Ikon</label><div class="ntSeg">`
    + IC.map(([k, ic]) => `<button data-ic="${k}" class="${icon === k ? 'on' : ''}" title="${k}">${ic}</button>`).join('')
    + `</div></div>`
    + row('ntFs', 'Szöveg', 6, 24, 0.5, ntGet(tgt, 'fs'), 'px')
    + row('ntIs', 'Ikon méret', 0.5, 3, 0.1, ntGet(tgt, 'is'), '×')
    + row('ntOp', 'Átlátszóság', 0.15, 1, 0.05, ntGet(tgt, 'op'), '')
    + (n ? `<div class="ntR"><label>Látható</label><input type="checkbox" id="ntVis" ${n.hidden ? '' : 'checked'}></div>` : '')
    + `<div class="ntFoot" style="border:0;padding:6px 0 0">
        <button id="ntApplyAll">Mind erre állít</button>
        <button id="ntToList">📋 Lista</button>
        ${n ? `<button id="ntEd">✎ Szöveg</button>` : ''}
       </div>`;

  const live = (id, key) => {
    const el = $(id); if (!el) return;
    el.oninput = () => {
      const v = +el.value;
      const lab = $(id + '_v'); if (lab) lab.textContent = v.toFixed(v % 1 ? 2 : (key === 'fs' ? 1 : 0)) + (key === 'fs' ? 'px' : key === 'is' ? '×' : '');
      if (n) n[key] = v; else ntDef()[key] = v;
      draw();
    };
    el.onchange = () => { pushUndo(); };
  };
  live('ntFs', 'fs'); live('ntIs', 'is'); live('ntOp', 'op');

  body.querySelectorAll('[data-ic]').forEach(b => b.onclick = () => {
    pushUndo();
    if (n) n.icon = b.dataset.ic; else ntDef().icon = b.dataset.ic;
    draw(); ntRefresh();
  });
  const vis = $('ntVis'); if (vis) vis.onchange = () => { pushUndo(); n.hidden = !vis.checked; draw(); ntRefresh(); };
  const ed = $('ntEd'); if (ed) ed.onclick = () => ntEditText(i);
  const tl = $('ntToList'); if (tl) tl.onclick = () => ntShow('list', true);
  const aa = $('ntApplyAll'); if (aa) aa.onclick = () => {
    const src = n || ntDef();
    openModal('Beállítás minden jegyzetre',
      `<div class="mrow">Minden jegyzet átveszi az ikon, méret és átlátszóság beállítást. Visszavonható.</div>`,
      () => {
        pushUndo();
        data.notes.forEach(x => { x.icon = ntGet(src, 'icon'); x.fs = ntGet(src, 'fs'); x.is = ntGet(src, 'is'); x.op = ntGet(src, 'op'); });
        draw(); ntRefresh();
      }, 'Alkalmaz');
  };
}

/* ---- panel 2: the numbered list ------------------------------------------- */

function ntPaintList() {
  const host = $('ntList'); if (!host) return;
  const body = host.querySelector('.ntB');
  const rows = ntOrdered(), selIdx = ntSelected();

  body.innerHTML = (rows.length
    ? rows.map((r, k) =>
      `<div class="ntLi ${r.i === selIdx ? 'sel' : ''} ${r.n.hidden ? 'hid' : ''}" data-k="${k}" data-i="${r.i}" draggable="true">
         <span class="n">${k + 1}.</span>
         <span class="tx">${esc(r.n.text || '—')}
           <div class="mt">${esc(NOTEKIND[noteKind(r.n)].ic + ' ' + NOTEKIND[noteKind(r.n)].n)} · ${esc(r.n.level || '')} · ${esc((layerById(r.n.layer || 'L0') || {}).name || '')}</div>
         </span>
         <button data-h="${r.i}" title="${r.n.hidden ? 'mutat' : 'elrejt'}" style="border:none;background:none;cursor:pointer">${r.n.hidden ? '🚫' : '👁'}</button>
       </div>`).join('')
    : `<div class="ntEmpty">Nincs jegyzet.<br>Jegyzet eszköz → kattints a rajzra.</div>`)
    + ntLayerBlock();

  // click selects and centres
  body.querySelectorAll('.ntLi').forEach(el => {
    el.onclick = (e) => {
      if (e.target.dataset && e.target.dataset.h != null) return;
      const i = +el.dataset.i;
      if (typeof selected !== 'undefined') selected = { t: 'notes', i: i };
      draw(); ntRefresh();
    };
  });
  body.querySelectorAll('[data-h]').forEach(b => b.onclick = (e) => {
    e.stopPropagation(); pushUndo();
    const n = data.notes[+b.dataset.h]; n.hidden = !n.hidden; draw(); ntRefresh();
  });

  ntWireDrag(body);
  ntWireLayers(body);
}

// Drag to reorder. Uses native HTML5 DnD (desktop) with a pointer fallback so
// it also works from the phone link and on a touch laptop.
function ntWireDrag(body) {
  const rows = Array.prototype.slice.call(body.querySelectorAll('.ntLi'));
  let from = null;
  const clear = () => rows.forEach(r => r.classList.remove('drop'));

  rows.forEach(el => {
    el.ondragstart = e => { from = +el.dataset.k; try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(from)); } catch (_) { } };
    el.ondragover = e => { e.preventDefault(); clear(); el.classList.add('drop'); };
    el.ondragleave = () => el.classList.remove('drop');
    el.ondrop = e => {
      e.preventDefault(); clear();
      const to = +el.dataset.k;
      if (from == null || from === to) return;
      pushUndo(); ntReorder(from, to); from = null; draw(); ntRefresh();
    };
    el.ondragend = clear;

    // touch fallback: long-press then drag
    let t0 = 0, held = false;
    el.onpointerdown = e => {
      if (e.pointerType === 'mouse') return;
      t0 = Date.now(); held = false;
      setTimeout(() => { if (Date.now() - t0 >= 380) { held = true; from = +el.dataset.k; el.style.opacity = '.5'; } }, 400);
    };
    el.onpointermove = e => {
      if (!held || from == null) return;
      const t = document.elementFromPoint(e.clientX, e.clientY);
      const li = t && t.closest ? t.closest('.ntLi') : null;
      clear(); if (li) li.classList.add('drop');
    };
    el.onpointerup = e => {
      el.style.opacity = '';
      if (!held || from == null) { held = false; return; }
      const t = document.elementFromPoint(e.clientX, e.clientY);
      const li = t && t.closest ? t.closest('.ntLi') : null;
      clear();
      if (li) { const to = +li.dataset.k; if (to !== from) { pushUndo(); ntReorder(from, to); draw(); } }
      from = null; held = false; ntRefresh();
    };
  });
}

function ntLayerBlock() {
  return `<div class="ntLay"><div style="color:#6b6250;margin-bottom:4px">Jegyzet-alréteg rétegenként</div>`
    + layers.map(L =>
      `<div class="lr"><button data-nl="${L.id}" style="border:none;background:none;cursor:pointer">${ntLayerShows(L) ? '👁' : '🚫'}</button>
       <span title="${esc(L.name)}">${esc(L.name)}</span>
       <span style="color:#9a8f78;font:10px ui-monospace,monospace">${data.notes.filter(n => (n.layer || 'L0') === L.id).length}</span></div>`).join('')
    + `</div>`;
}
function ntWireLayers(body) {
  body.querySelectorAll('[data-nl]').forEach(b => b.onclick = () => {
    pushUndo(); ntLayerToggle(b.dataset.nl); draw(); ntRefresh();
  });
}

/* ---- export --------------------------------------------------------------- */

function ntDoc(fmt) {
  const rows = ntOrdered();
  const proj = (typeof B !== 'undefined' && B && B.name) ? B.name : 'Varler Planner';
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');

  if (fmt === 'csv') {
    const q = s => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';
    return '\ufeff' + ['sz;tipus;szoveg;szint;reteg;x;y;rejtett']
      .concat(rows.map((r, k) => [k + 1, NOTEKIND[noteKind(r.n)].n, r.n.text, r.n.level,
        (layerById(r.n.layer || 'L0') || {}).name, Math.round(r.n.x), Math.round(r.n.y),
        r.n.hidden ? 'igen' : ''].map(q).join(';'))).join('\r\n');
  }
  if (fmt === 'txt') {
    return rows.map((r, k) => (k + 1) + '. ' + (r.n.text || '')).join('\n');
  }
  // markdown, the default
  const L = ['# Jegyzetek — ' + proj, '', '_' + stamp + ' · ' + rows.length + ' tétel_', ''];
  let lastLvl = null;
  rows.forEach((r, k) => {
    if (r.n.level !== lastLvl) { lastLvl = r.n.level; L.push('', '## ' + (lastLvl || '—'), ''); }
    const K = NOTEKIND[noteKind(r.n)];
    L.push('**' + (k + 1) + '.** ' + K.ic + ' ' + (r.n.text || '—')
      + (r.n.hidden ? '  _(rejtett)_' : '')
      + '  \n`X' + Math.round(r.n.x) + ' Y' + Math.round(r.n.y) + '`'
      + ' · ' + K.n + ' · ' + ((layerById(r.n.layer || 'L0') || {}).name || ''));
  });
  return L.join('\n');
}

function ntExport(fmt) {
  fmt = fmt || 'md';
  const mime = fmt === 'csv' ? 'text/csv;charset=utf-8' : 'text/plain;charset=utf-8';
  const name = 'jegyzetek-' + new Date().toISOString().slice(0, 10) + '.' + fmt;
  const blob = new Blob([ntDoc(fmt)], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 400);
  if ($('hud')) $('hud').textContent = ntSavedMsg(name);
}
function ntSavedMsg(name) { return data.notes.length + ' jegyzet mentve — ' + name; }

/* ---- actions -------------------------------------------------------------- */

if (typeof registerActions === 'function') registerActions([
  { id: 'note.panel', label: 'Jegyzet beállítások panel', icon: '📝', group: 'Jegyzet',
    alias: 'note panel jegyzet beallitas ikon meret', hint: 'Ikon, méret és átlátszóság a kijelölt jegyzethez.',
    run: () => ntShow('panel') },
  { id: 'note.list', label: 'Jegyzetek listája', icon: '📋', group: 'Jegyzet',
    alias: 'note list jegyzet lista sorszam', hint: 'Számozott lista, húzással átrendezhető, letölthető.',
    run: () => ntShow('list') },
  { id: 'note.export', label: 'Jegyzetek letöltése (Markdown)', icon: '⬇', group: 'Jegyzet',
    alias: 'note export download jegyzet letoltes', run: () => ntExport('md') },
  { id: 'note.export.csv', label: 'Jegyzetek letöltése (CSV)', icon: '⬇', group: 'Jegyzet',
    alias: 'note export csv', run: () => ntExport('csv') },
  { id: 'note.renumber', label: 'Jegyzetek újraszámozása', icon: '🔢', group: 'Jegyzet',
    alias: 'note renumber sorszam', run: () => { pushUndo(); ntRenumber(); draw(); ntRefresh(); } },
  { id: 'note.hideall', label: 'Minden jegyzet elrejtése / mutatása', icon: '👁', group: 'Jegyzet',
    alias: 'note hide all', run: () => {
      pushUndo(); const anyVisible = data.notes.some(n => !n.hidden);
      data.notes.forEach(n => { n.hidden = anyVisible; }); draw(); ntRefresh();
    } }
]);

const NOTES = {
  sym: ntSym, visible: ntVisible, ordered: ntOrdered, number: ntNumber,
  renumber: ntRenumber, reorder: ntReorder, menuItems: ntMenuItems,
  show: ntShow, refresh: ntRefresh, onMode: ntOnMode,
  doc: ntDoc, export: ntExport, def: ntDef, layerToggle: ntLayerToggle
};
if (typeof window !== 'undefined') {
  window.NOTES = NOTES; window.ntSym = ntSym; window.ntVisible = ntVisible;
  window.ntMenuItems = ntMenuItems; window.ntOrdered = ntOrdered; window.ntReorder = ntReorder;
}
