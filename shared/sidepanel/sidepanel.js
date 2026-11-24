// sidepanel.js — VRG Oldalpanel: the Planner's side panel lifted out as a stand-alone, framework-free plug-in.
// Origin: the Varler Planner's fixed frame (Planner/projects/varler-planner/src/05db-layout.js:10-22, places that never move,
// only their contents change; PANEL_HOME:51 = which panel lives where; the grid / list switch :62 and :105), its `.side` columns
// of `.grp` sections (src/shell.html:116-126, the Mélyvíz look :387-391, the resizers :329) and Tab for the wide work mode
// (src/05d-shell.js:109). Here those ideas become one reusable piece: a column of **modules** (sections) that any app adds,
// with a collapsed icon rail, a simple / detailed mode, per-section open state, a resize grip and saved state.
//
// Classic script (UMD): <script src="…/shared/sidepanel/sidepanel.js"> sets window.VRGSidePanel; require() in Node gives the pure
// helpers (and create(), which needs a DOM). No innerHTML anywhere: every text goes in through textContent.
//
//   const panel = VRGSidePanel.create(host, { side:'right', title:'Gyors elérés', width:260, collapsed:false,
//                                             modes:['simple','detailed'], mode:'simple', persistKey:'sessions', hotkey:'Alt+\\',
//                                             onEvent:(type, data) => {} });
//   panel.add(module) · remove(id) · get(id) · list() · open(id) · setMode(m) · mode() · toggle(force?) · collapsed()
//   panel.setWidth(px) · refresh(id?) · destroy() · panel.el
//
// A module: { id, title, icon?, order?, level?:'simple'|'detailed', open?, render(el, ctx) → cleanup?, onMode?(mode, el, ctx),
//             controls?: [{ id, kind:'button'|'toggle'|'select'|'slider', label, title?, value?, options?, min?, max?, step?, onChange(value, ctx) }] }
// ctx = { panel, module, mode, el, value(ctlId), setValue(ctlId, v), emit(type, data), setBadge(text) }
// Factories: VRGSidePanel.modules.links(items, o) · toggles(list, o) · notes(o) · status(rows, o)
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.VRGSidePanel = api;
})(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : null), function () {
  'use strict';

  const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/;
  const LEVELS = ['simple', 'detailed'];
  const KINDS = ['button', 'toggle', 'select', 'slider'];
  const MIN_W = 180, MAX_W = 640, RAIL_W = 40;
  const KEY_PREFIX = 'vrg.sidepanel.';
  const MODE_HU = { simple: 'Egyszerű', detailed: 'Részletes' };

  // ------------------------------------------------------------ pure helpers (exported for node --test)
  // a module → a clean copy with defaults, or throws (a bad module is a programming error, not user input)
  function normalizeModule(m) {
    if (!m || typeof m !== 'object') throw new Error('sidepanel: a module must be an object');
    if (typeof m.id !== 'string' || !ID_RE.test(m.id)) throw new Error('sidepanel: bad module id ' + JSON.stringify(m.id));
    if (typeof m.render !== 'function') throw new Error('sidepanel: module ' + m.id + ' has no render()');
    const controls = (Array.isArray(m.controls) ? m.controls : []).map(c => normalizeControl(c, m.id));
    return {
      ...m,
      title: String(m.title == null ? m.id : m.title).slice(0, 80),
      icon: String(m.icon == null ? '' : m.icon).slice(0, 4),
      order: Number.isFinite(m.order) ? m.order : 100,
      level: LEVELS.includes(m.level) ? m.level : 'simple',
      open: m.open !== false,
      controls,
    };
  }
  function normalizeControl(c, modId) {
    if (!c || typeof c.id !== 'string' || !ID_RE.test(c.id)) throw new Error('sidepanel: bad control id in ' + modId);
    if (!KINDS.includes(c.kind)) throw new Error('sidepanel: control ' + c.id + ' has an unknown kind ' + c.kind);
    const out = { ...c, label: String(c.label == null ? c.id : c.label).slice(0, 40), title: c.title ? String(c.title) : '' };
    if (c.kind === 'select') out.options = (Array.isArray(c.options) ? c.options : []).map(o => (typeof o === 'object' && o ? { value: String(o.value), label: String(o.label == null ? o.value : o.label) } : { value: String(o), label: String(o) }));
    if (c.kind === 'slider') { out.min = Number.isFinite(c.min) ? c.min : 0; out.max = Number.isFinite(c.max) ? c.max : 100; out.step = Number.isFinite(c.step) ? c.step : 1; }
    return out;
  }
  // the modules a mode shows, in order: simple shows level 'simple' only, detailed shows everything; ties by id
  function visibleModules(mods, mode) {
    const m = LEVELS.includes(mode) ? mode : 'simple';
    return (Array.isArray(mods) ? mods : []).filter(x => x && (m === 'detailed' || x.level !== 'detailed'))
      .slice().sort((a, b) => (a.order - b.order) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }
  // a control's value: the saved one when it fits the kind, else the declared default
  function controlValue(c, saved) {
    const ok = v => {
      if (c.kind === 'toggle') return typeof v === 'boolean';
      if (c.kind === 'select') return typeof v === 'string' && c.options.some(o => o.value === v);
      if (c.kind === 'slider') return Number.isFinite(v) && v >= c.min && v <= c.max;
      return false;
    };
    if (ok(saved)) return saved;
    if (ok(c.value)) return c.value;
    if (c.kind === 'toggle') return false;
    if (c.kind === 'select') return c.options.length ? c.options[0].value : '';
    if (c.kind === 'slider') return c.min;
    return undefined;
  }
  // every control of a module with its current value: { ctlId: value } (buttons have none)
  function controlState(controls, saved) {
    const out = {};
    for (const c of controls || []) if (c.kind !== 'button') out[c.id] = controlValue(c, saved ? saved[c.id] : undefined);
    return out;
  }
  // persistKey → the storage key, or '' (no saving) when it is missing or odd
  function storageKey(persistKey) {
    return typeof persistKey === 'string' && /^[A-Za-z0-9_.:-]{1,64}$/.test(persistKey) ? KEY_PREFIX + persistKey : '';
  }
  const clampWidth = w => Math.round(Math.min(MAX_W, Math.max(MIN_W, Number.isFinite(w) ? w : 280)));
  // a saved state → a clean one (anything odd is dropped, never trusted)
  function cleanState(s, modes) {
    const st = { collapsed: false, mode: '', width: 0, closed: {}, values: {} };
    if (!s || typeof s !== 'object') return st;
    if (typeof s.collapsed === 'boolean') st.collapsed = s.collapsed;
    if ((modes || LEVELS).includes(s.mode)) st.mode = s.mode;
    if (Number.isFinite(s.width)) st.width = clampWidth(s.width);
    if (s.closed && typeof s.closed === 'object') for (const k of Object.keys(s.closed)) if (ID_RE.test(k) && s.closed[k] === true) st.closed[k] = true;
    if (s.values && typeof s.values === 'object') for (const k of Object.keys(s.values)) {
      const v = s.values[k];
      if (!ID_RE.test(k) || !v || typeof v !== 'object' || Array.isArray(v)) continue;
      const o = {};
      for (const ck of Object.keys(v)) if (ID_RE.test(ck) && ['boolean', 'number', 'string'].includes(typeof v[ck])) o[ck] = typeof v[ck] === 'string' ? v[ck].slice(0, 4000) : v[ck];
      st.values[k] = o;
    }
    return st;
  }
  function loadState(storage, key, modes) {
    if (!key || !storage) return cleanState(null, modes);
    try { return cleanState(JSON.parse(storage.getItem(key) || 'null'), modes); } catch (e) { return cleanState(null, modes); }
  }
  function saveState(storage, key, st) {
    if (!key || !storage) return false;
    try { storage.setItem(key, JSON.stringify(st)); return true; } catch (e) { return false; }   // file:// / blocked storage: no saving, no error
  }
  // "Alt+\\" / "Ctrl+Shift+S" against a keydown event
  function keyMatches(spec, e) {
    if (typeof spec !== 'string' || !spec || !e || typeof e.key !== 'string') return false;
    const parts = spec.split('+'); const key = parts.pop() || '+';
    const want = { ctrl: parts.includes('Ctrl'), alt: parts.includes('Alt'), shift: parts.includes('Shift'), meta: parts.includes('Meta') };
    if (!!e.ctrlKey !== want.ctrl || !!e.altKey !== want.alt || !!e.shiftKey !== want.shift || !!e.metaKey !== want.meta) return false;
    return e.key.length === 1 ? e.key.toLowerCase() === key.toLowerCase() : e.key === key;
  }

  const pure = { normalizeModule, normalizeControl, visibleModules, controlValue, controlState, storageKey, cleanState, loadState, saveState,
    keyMatches, clampWidth, LEVELS, KINDS, MIN_W, MAX_W, RAIL_W, KEY_PREFIX };

  // ------------------------------------------------------------ DOM
  function h(doc, tag, cls, text, title) {
    const e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = String(text);
    if (title) e.title = String(title);
    return e;
  }
  function getStorage(win) { try { return win && win.localStorage ? win.localStorage : null; } catch (e) { return null; } }

  function create(host, opts) {
    if (!host || !host.ownerDocument) throw new Error('sidepanel: create(host) needs a DOM element');
    const o = opts || {};
    const doc = host.ownerDocument, win = doc.defaultView;
    const modes = Array.isArray(o.modes) && o.modes.length ? o.modes.filter(m => LEVELS.includes(m)) : LEVELS.slice();
    const key = storageKey(o.persistKey), storage = getStorage(win);
    const st = loadState(storage, key, modes);
    let mode = st.mode || (modes.includes(o.mode) ? o.mode : modes[0]);
    let found = false;
    if (key && storage) { try { found = storage.getItem(key) != null; } catch (e) { found = false; } }
    let isCollapsed = found ? st.collapsed : o.collapsed === true;     // a saved state wins over the option
    let width = st.width || clampWidth(o.width);
    const side = o.side === 'left' ? 'left' : 'right';
    const hotkey = o.hotkey === undefined ? 'Alt+\\' : o.hotkey;
    const emit = (type, data) => { if (typeof o.onEvent === 'function') { try { o.onEvent(type, data); } catch (e) { /* the host's handler must not break the panel */ } } };
    const save = () => saveState(storage, key, { collapsed: isCollapsed, mode, width, closed: st.closed, values: st.values });

    const mods = new Map();           // id → { m (normalized), sec, body, ctlBox, cleanup, ctx, mounted }
    host.classList.add('vrg-sp-host');
    host.dataset.spSide = side;
    const el = h(doc, 'aside', 'vrg-sp');
    el.dataset.side = side;
    el.setAttribute('aria-label', String(o.title || 'Oldalpanel'));
    const head = h(doc, 'div', 'vrg-sp-head');
    const colBtn = h(doc, 'button', 'vrg-sp-collapse');
    colBtn.type = 'button';
    const title = h(doc, 'span', 'vrg-sp-title', o.title || 'Oldalpanel', o.titleEn || 'Side panel');
    const modeBtn = h(doc, 'button', 'vrg-sp-mode');
    modeBtn.type = 'button';
    modeBtn.hidden = modes.length < 2;
    head.append(colBtn, title, modeBtn);
    const rail = h(doc, 'nav', 'vrg-sp-rail');
    rail.setAttribute('aria-label', 'Modulok');
    const body = h(doc, 'div', 'vrg-sp-body');
    const grip = h(doc, 'div', 'vrg-sp-grip', null, 'Szélesség (húzd) · Width (drag)');
    grip.setAttribute('role', 'separator');
    grip.setAttribute('aria-orientation', 'vertical');
    el.append(head, rail, body, grip);
    if (side === 'left') host.prepend(el); else host.append(el);

    function paint() {
      el.dataset.collapsed = isCollapsed ? '1' : '';
      el.dataset.mode = mode;
      el.style.width = (isCollapsed ? RAIL_W : width) + 'px';
      colBtn.textContent = (side === 'right') === isCollapsed ? '◂' : '▸';
      colBtn.title = isCollapsed ? 'Kinyitás · Expand' + (hotkey ? ' (' + hotkey + ')' : '') : 'Összecsukás · Collapse' + (hotkey ? ' (' + hotkey + ')' : '');
      colBtn.setAttribute('aria-expanded', String(!isCollapsed));
      modeBtn.textContent = MODE_HU[mode] || mode;
      modeBtn.title = 'Nézet: egyszerű ↔ részletes · Simple ↔ detailed';
      modeBtn.setAttribute('aria-pressed', String(mode === 'detailed'));
    }

    function makeCtx(rec) {
      const m = rec.m;
      return {
        panel: api, module: m, get mode() { return mode; }, el: rec.body,
        value: id => (st.values[m.id] || {})[id],
        setValue: (id, v) => { if (!ID_RE.test(id) || !['boolean', 'number', 'string'].includes(typeof v)) return; st.values[m.id] = { ...(st.values[m.id] || {}), [id]: typeof v === 'string' ? v.slice(0, 4000) : v }; save(); },
        emit: (type, data) => emit(type, { module: m.id, ...(data || {}) }),
        setBadge: text => { rec.badge.textContent = text == null ? '' : String(text).slice(0, 12); rec.badge.hidden = !rec.badge.textContent; rec.railBadge.textContent = rec.badge.textContent; rec.railBadge.hidden = rec.badge.hidden; },
      };
    }

    function buildControls(rec) {
      const m = rec.m;
      rec.ctlBox.replaceChildren();
      rec.ctlBox.hidden = !m.controls.length;
      const values = controlState(m.controls, st.values[m.id]);
      for (const c of m.controls) {
        const fire = v => { try { if (typeof c.onChange === 'function') c.onChange(v, rec.ctx); } catch (e) { emit('error', { module: m.id, control: c.id, message: String(e && e.message || e) }); } emit('change', { module: m.id, control: c.id, value: v }); };
        const store = v => { st.values[m.id] = { ...(st.values[m.id] || {}), [c.id]: v }; save(); };
        let ctl;
        if (c.kind === 'button') {
          ctl = h(doc, 'button', 'vrg-sp-ctl', c.label, c.title); ctl.type = 'button';
          ctl.addEventListener('click', () => fire(undefined));
        } else if (c.kind === 'toggle') {
          ctl = h(doc, 'button', 'vrg-sp-ctl vrg-sp-toggle', c.label, c.title); ctl.type = 'button';
          ctl.setAttribute('aria-pressed', String(values[c.id]));
          ctl.addEventListener('click', () => { const v = ctl.getAttribute('aria-pressed') !== 'true'; ctl.setAttribute('aria-pressed', String(v)); store(v); fire(v); });
        } else if (c.kind === 'select') {
          ctl = h(doc, 'label', 'vrg-sp-ctl vrg-sp-select', null, c.title);
          const s = h(doc, 'select');
          for (const op of c.options) { const x = h(doc, 'option', null, op.label); x.value = op.value; s.append(x); }
          s.value = values[c.id];
          s.setAttribute('aria-label', c.label);
          s.addEventListener('change', () => { store(s.value); fire(s.value); });
          ctl.append(h(doc, 'span', null, c.label), s);
        } else {
          ctl = h(doc, 'label', 'vrg-sp-ctl vrg-sp-slider', null, c.title);
          const r = h(doc, 'input'); r.type = 'range'; r.min = c.min; r.max = c.max; r.step = c.step; r.value = values[c.id];
          const out = h(doc, 'output', null, values[c.id]);
          r.setAttribute('aria-label', c.label);
          r.addEventListener('input', () => { out.textContent = r.value; });
          r.addEventListener('change', () => { const v = Number(r.value); store(v); fire(v); });
          ctl.append(h(doc, 'span', null, c.label), r, out);
        }
        ctl.dataset.ctl = c.id;
        rec.ctlBox.append(ctl);
      }
    }

    function mount(rec) {
      if (rec.mounted) return;
      rec.mounted = true;
      rec.body.replaceChildren();
      buildControls(rec);
      try { const c = rec.m.render(rec.body, rec.ctx); rec.cleanup = typeof c === 'function' ? c : null; }
      catch (e) { rec.body.replaceChildren(h(doc, 'p', 'vrg-sp-err', 'Hiba: ' + String(e && e.message || e))); emit('error', { module: rec.m.id, message: String(e && e.message || e) }); }
    }
    function unmount(rec) {
      if (!rec.mounted) return;
      rec.mounted = false;
      if (rec.cleanup) { try { rec.cleanup(); } catch (e) { /* ignore */ } }
      rec.cleanup = null;
      rec.body.replaceChildren();
    }
    function setOpen(rec, open) {
      if (open) delete st.closed[rec.m.id]; else st.closed[rec.m.id] = true;
      rec.sec.dataset.open = open ? '1' : '';
      rec.headBtn.setAttribute('aria-expanded', String(open));
      rec.inner.hidden = !open;
    }

    // put the sections and rail icons in mode order; mount the visible ones, unmount the hidden ones
    function layout() {
      const vis = visibleModules([...mods.values()].map(r => r.m), mode);
      const ids = new Set(vis.map(m => m.id));
      for (const rec of mods.values()) if (!ids.has(rec.m.id)) { unmount(rec); rec.sec.remove(); rec.railBtn.remove(); }
      for (const m of vis) {
        const rec = mods.get(m.id);
        body.append(rec.sec); rail.append(rec.railBtn);
        mount(rec);
        if (typeof m.onMode === 'function') { try { m.onMode(mode, rec.body, rec.ctx); } catch (e) { emit('error', { module: m.id, message: String(e && e.message || e) }); } }
      }
      body.dataset.empty = vis.length ? '' : '1';
    }

    function add(module) {
      const m = normalizeModule(module);
      if (mods.has(m.id)) remove(m.id);
      const rec = { m, mounted: false, cleanup: null };
      rec.sec = h(doc, 'section', 'vrg-sp-mod');
      rec.sec.dataset.mod = m.id;
      rec.sec.dataset.level = m.level;
      rec.headBtn = h(doc, 'button', 'vrg-sp-modhead', null, m.title);
      rec.headBtn.type = 'button';
      rec.badge = h(doc, 'span', 'vrg-sp-badge'); rec.badge.hidden = true;
      rec.headBtn.append(h(doc, 'span', 'vrg-sp-icon', m.icon || m.title.slice(0, 1)), h(doc, 'span', 'vrg-sp-modtitle', m.title), rec.badge, h(doc, 'span', 'vrg-sp-chev', '▾'));
      rec.inner = h(doc, 'div', 'vrg-sp-inner');
      rec.ctlBox = h(doc, 'div', 'vrg-sp-ctls');
      rec.body = h(doc, 'div', 'vrg-sp-content');
      rec.inner.append(rec.ctlBox, rec.body);
      rec.sec.append(rec.headBtn, rec.inner);
      rec.railBtn = h(doc, 'button', 'vrg-sp-railbtn', null, m.title);
      rec.railBtn.type = 'button';
      rec.railBtn.dataset.mod = m.id;
      rec.railBadge = h(doc, 'span', 'vrg-sp-badge'); rec.railBadge.hidden = true;
      rec.railBtn.append(h(doc, 'span', 'vrg-sp-icon', m.icon || m.title.slice(0, 1)), rec.railBadge);
      rec.headBtn.addEventListener('click', () => { setOpen(rec, rec.inner.hidden); save(); emit('section', { module: m.id, open: !rec.inner.hidden }); });
      rec.railBtn.addEventListener('click', () => open(m.id));
      rec.ctx = makeCtx(rec);
      mods.set(m.id, rec);
      setOpen(rec, st.closed[m.id] ? false : m.open);
      layout();
      return api;
    }
    function remove(id) {
      const rec = mods.get(id);
      if (!rec) return false;
      unmount(rec); rec.sec.remove(); rec.railBtn.remove(); mods.delete(id);
      layout();
      return true;
    }
    // expand the panel, open that section and bring it into view (also switches to detailed when the module needs it)
    function open(id) {
      const rec = mods.get(id);
      if (!rec) return false;
      if (rec.m.level === 'detailed' && mode !== 'detailed' && modes.includes('detailed')) setMode('detailed');
      if (isCollapsed) toggle(false);
      setOpen(rec, true); save();
      if (rec.sec.scrollIntoView) { try { rec.sec.scrollIntoView({ block: 'nearest' }); } catch (e) { /* jsdom */ } }
      rec.headBtn.focus();
      return true;
    }
    function setMode(m) {
      if (!modes.includes(m) || m === mode) return mode;
      mode = m; paint(); layout(); save(); emit('mode', { mode });
      return mode;
    }
    function toggle(force) {
      const next = typeof force === 'boolean' ? force : !isCollapsed;
      if (next === isCollapsed) return isCollapsed;
      isCollapsed = next; paint(); save(); emit('collapse', { collapsed: isCollapsed });
      return isCollapsed;
    }
    function setWidth(px) { width = clampWidth(px); paint(); save(); emit('width', { width }); return width; }
    function refresh(id) {
      for (const rec of id ? [mods.get(id)].filter(Boolean) : mods.values()) if (rec.mounted) { unmount(rec); mount(rec); }
    }

    colBtn.addEventListener('click', () => toggle());
    modeBtn.addEventListener('click', () => setMode(modes[(modes.indexOf(mode) + 1) % modes.length]));
    // the hotkey works while the focus is inside the host (so two panels in two panes never fight); Escape in the panel collapses it
    const onKey = e => {
      if (!host.contains(doc.activeElement) && doc.activeElement !== doc.body) return;
      if (doc.activeElement === doc.body && !o.globalHotkey) return;
      if (hotkey && keyMatches(hotkey, e)) { e.preventDefault(); toggle(); if (!isCollapsed) { const f = body.querySelector('button, select, input, textarea'); if (f) f.focus(); } else colBtn.focus(); }
    };
    const onPanelKey = e => { if (e.key === 'Escape' && !isCollapsed && !(e.target && /^(TEXTAREA|INPUT|SELECT)$/.test(e.target.tagName))) { e.stopPropagation(); toggle(true); colBtn.focus(); } };
    doc.addEventListener('keydown', onKey);
    el.addEventListener('keydown', onPanelKey);
    // resize: drag the grip on the inner edge
    let drag = null;
    const onMove = e => { if (!drag) return; const dx = e.clientX - drag.x; setWidth(drag.w + (side === 'right' ? -dx : dx)); };
    const onUp = () => { if (!drag) return; drag = null; el.dataset.drag = ''; doc.removeEventListener('pointermove', onMove); doc.removeEventListener('pointerup', onUp); };
    grip.addEventListener('pointerdown', e => {
      if (isCollapsed || e.button !== 0) return;
      e.preventDefault(); drag = { x: e.clientX, w: width }; el.dataset.drag = '1';
      doc.addEventListener('pointermove', onMove); doc.addEventListener('pointerup', onUp);
    });
    grip.addEventListener('dblclick', () => setWidth(clampWidth(o.width)));

    function destroy() {
      for (const rec of mods.values()) unmount(rec);
      mods.clear();
      doc.removeEventListener('keydown', onKey);
      onUp();
      el.remove();
      host.classList.remove('vrg-sp-host');
      delete host.dataset.spSide;
    }

    const api = {
      el, add, remove, open, setMode, toggle, setWidth, refresh, destroy,
      get: id => (mods.get(id) ? mods.get(id).m : null),
      list: () => visibleModules([...mods.values()].map(r => r.m), 'detailed').map(m => m.id),
      mode: () => mode,
      collapsed: () => isCollapsed,
      width: () => width,
    };
    paint();
    for (const m of Array.isArray(o.modules) ? o.modules : []) add(m);
    return api;
  }

  // ------------------------------------------------------------ built-in module factories
  const modules = {
    // quick-access buttons: items [{ id, label, icon?, title?, level?, disabled?, run(item, ctx) }]; level 'detailed' items show in detailed mode only
    links(items, o) {
      const opt = o || {};
      let list = Array.isArray(items) ? items.slice() : [];
      let drawn = null;
      const mod = {
        id: opt.id || 'links', title: opt.title || 'Gyors elérés', icon: opt.icon || '⚡', order: opt.order, level: opt.level, open: opt.open,
        controls: opt.controls,
        render(el, ctx) { drawn = { el, ctx }; draw(); return () => { drawn = null; }; },
        onMode() { draw(); },
        set(next) { list = Array.isArray(next) ? next.slice() : []; draw(); },
      };
      function draw() {
        if (!drawn) return;
        const { el, ctx } = drawn, doc = el.ownerDocument;
        const grid = h(doc, 'div', 'vrg-sp-links');
        grid.dataset.layout = opt.layout === 'list' ? 'list' : 'grid';
        for (const it of list) {
          if (!it || typeof it.id !== 'string' || (it.level === 'detailed' && ctx.mode !== 'detailed')) continue;
          const b = h(doc, 'button', 'vrg-sp-link', null, it.title || it.label);
          b.type = 'button'; b.dataset.link = it.id; b.disabled = it.disabled === true;
          b.append(h(doc, 'span', 'vrg-sp-icon', it.icon || '•'), h(doc, 'span', 'vrg-sp-linklabel', it.label || it.id));
          b.addEventListener('click', async () => {
            ctx.emit('run', { link: it.id });
            try { if (typeof it.run === 'function') await it.run(it, ctx); }
            catch (e) { ctx.emit('error', { link: it.id, message: String(e && e.message || e) }); }
          });
          grid.append(b);
        }
        el.replaceChildren(grid);
      }
      return mod;
    },
    // switches: list [{ id, label, title?, value?, onChange(value, ctx) }], saved per panel
    toggles(list, o) {
      const opt = o || {};
      return {
        id: opt.id || 'toggles', title: opt.title || 'Kapcsolók', icon: opt.icon || '◐', order: opt.order, level: opt.level, open: opt.open,
        render(el, ctx) {
          const doc = el.ownerDocument, box = h(doc, 'div', 'vrg-sp-toggles');
          for (const t of Array.isArray(list) ? list : []) {
            if (!t || typeof t.id !== 'string' || !ID_RE.test(t.id)) continue;
            const saved = ctx.value(t.id);
            const on = typeof saved === 'boolean' ? saved : t.value === true;
            const b = h(doc, 'button', 'vrg-sp-switch', null, t.title || t.label);
            b.type = 'button'; b.dataset.toggle = t.id; b.setAttribute('role', 'switch'); b.setAttribute('aria-checked', String(on));
            b.append(h(doc, 'span', 'vrg-sp-knob'), h(doc, 'span', 'vrg-sp-switchlabel', t.label || t.id));
            b.addEventListener('click', () => {
              const v = b.getAttribute('aria-checked') !== 'true';
              b.setAttribute('aria-checked', String(v)); ctx.setValue(t.id, v);
              try { if (typeof t.onChange === 'function') t.onChange(v, ctx); } catch (e) { ctx.emit('error', { toggle: t.id, message: String(e && e.message || e) }); }
              ctx.emit('change', { toggle: t.id, value: v });
            });
            box.append(b);
          }
          el.replaceChildren(box);
        },
      };
    },
    // a free-text note kept with the panel's saved state (≤ 4000 characters)
    notes(o) {
      const opt = o || {};
      return {
        id: opt.id || 'notes', title: opt.title || 'Jegyzet', icon: opt.icon || '✎', order: opt.order, level: opt.level, open: opt.open,
        render(el, ctx) {
          const doc = el.ownerDocument, ta = h(doc, 'textarea', 'vrg-sp-notes');
          ta.maxLength = 4000; ta.rows = opt.rows || 5; ta.placeholder = opt.placeholder || 'Jegyzet…';
          ta.value = typeof ctx.value('text') === 'string' ? ctx.value('text') : '';
          let t = 0;
          const flush = () => { clearTimeout(t); ctx.setValue('text', ta.value); ctx.setBadge(ta.value.trim() ? '●' : ''); };
          ta.addEventListener('input', () => { clearTimeout(t); t = setTimeout(flush, 400); });
          ta.addEventListener('blur', flush);
          el.replaceChildren(ta);
          ctx.setBadge(ta.value.trim() ? '●' : '');
          return () => { clearTimeout(t); ctx.setValue('text', ta.value); };
        },
      };
    },
    // label / value rows with a tone (ok | warn | crit | dim); rows may be a function; module.update(rows) redraws
    status(rows, o) {
      const opt = o || {};
      let src = rows, drawn = null;
      const mod = {
        id: opt.id || 'status', title: opt.title || 'Állapot', icon: opt.icon || '◉', order: opt.order, level: opt.level, open: opt.open,
        render(el, ctx) { drawn = { el, ctx }; draw(); return () => { drawn = null; }; },
        update(next) { src = next; draw(); },
      };
      function draw() {
        if (!drawn) return;
        const { el, ctx } = drawn, doc = el.ownerDocument;
        let list = [];
        try { list = typeof src === 'function' ? src() : src; } catch (e) { list = [{ label: 'Hiba', value: String(e && e.message || e), tone: 'crit' }]; }
        const dl = h(doc, 'dl', 'vrg-sp-status');
        let worst = '';
        for (const r of Array.isArray(list) ? list : []) {
          if (!r) continue;
          const tone = ['ok', 'warn', 'crit', 'dim'].includes(r.tone) ? r.tone : '';
          if (tone === 'crit' || (tone === 'warn' && worst !== 'crit')) worst = tone;
          const dt = h(doc, 'dt', null, r.label), dd = h(doc, 'dd', null, r.value == null ? '—' : r.value);
          if (tone) dd.dataset.tone = tone;
          dl.append(dt, dd);
        }
        el.replaceChildren(dl);
        ctx.setBadge(worst === 'crit' ? '!' : worst === 'warn' ? '•' : '');
      }
      return mod;
    },
  };

  return { create, modules, ...pure };
});
