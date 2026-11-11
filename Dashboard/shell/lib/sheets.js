// sheets.js — the Lapok (Sheets) of the VRG Asztal's workspace (WP-46): pure functions, shared by main (CommonJS) and the frame page
// (classic script, window.VRGSheetsLib). A sheet is a 4 × 4 grid; every window on it has a tile (c, r, w, h in cells) and tiles never
// overlap. One window per sheet may be `max`: it covers all 16 cells and the others wait under it with their tiles unchanged.
//   doc   = { v:1, active, bar, sheets:[sheet], mine:[preset] }      active = a sheet id, '' = the Munkapad (the old split tree)
//   sheet = { id, name, wins:[win], focus }                            bar = where the sheet tabs sit: 'top' | 'bottom'
//   win   = { id, kind, open, state, c, r, w, h, max }                 id = a pane id, unique over all sheets; open = how it was opened
//   preset= { id, name, wins:[{ open, state, c, r, w, h }] }           open = 'pane:<kind>' | 'cat:<catalog id>'
// validate() → { ok:true } | { ok:false, err }. Every op returns a new valid doc, or the SAME doc object when it cannot apply.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VRGSheetsLib = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const N = 4;                                                       // 4 × 4 cells
  const KINDS = ['home', 'empty', 'files', 'term', 'web', 'mail', 'stack', 'chat', 'note', 'git', 'feed', 'app'];   // = layout.js KINDS
  const MAX_SHEETS = 12, MAX_PRESETS = 24, MAX_STATE = 8192, MAX_NAME = 40;
  const SHEET_ID = /^s[0-9]{1,4}$/, PANE_ID = /^[a-z0-9-]{1,40}$/, PRESET_ID = /^[a-z0-9-]{1,24}$/;
  const OPEN = /^(pane:[a-z]{1,10}|cat:[a-z0-9:_./-]{1,80})$/;
  const EDGES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const plain = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const sameKeys = (o, keys) => { const k = Object.keys(o); return k.length === keys.length && keys.every(x => has(o, x)); };
  const clone = v => JSON.parse(JSON.stringify(v));
  const int = (v, a, b) => Number.isInteger(v) && v >= a && v <= b;
  const okName = s => typeof s === 'string' && s.trim().length > 0 && s.length <= MAX_NAME && !/[\u0000-\u001f]/.test(s);
  const okState = s => { if (!plain(s)) return false; try { return JSON.stringify(s).length <= MAX_STATE; } catch (e) { return false; } };

  // ------------------------------------------------------------ tiles
  const okTile = t => int(t.c, 0, N - 1) && int(t.r, 0, N - 1) && int(t.w, 1, N) && int(t.h, 1, N) && t.c + t.w <= N && t.r + t.h <= N;
  const overlap = (a, b) => a.c < b.c + b.w && b.c < a.c + a.w && a.r < b.r + b.h && b.r < a.r + a.h;
  const tileOf = w => ({ c: w.c, r: w.r, w: w.w, h: w.h });
  const sameTile = (a, b) => a.c === b.c && a.r === b.r && a.w === b.w && a.h === b.h;
  const FULL = { c: 0, r: 0, w: N, h: N };
  // the 16 cells → the id of the window whose tile holds it ('' = free); `except` is left out (the window being moved / resized)
  function occupancy(sheet, except) {
    const g = new Array(N * N).fill('');
    for (const w of sheet.wins) {
      if (w.id === except) continue;
      for (let r = w.r; r < w.r + w.h; r++) for (let c = w.c; c < w.c + w.w; c++) g[r * N + c] = w.id;
    }
    return g;
  }
  const fits = (sheet, t, except) => okTile(t) && !sheet.wins.some(w => w.id !== except && overlap(w, t));
  // the cell a new window takes: `prefer` when it is free, else the first free cell row by row; null when the sheet is full
  function freeCell(sheet, prefer) {
    const g = occupancy(sheet);
    if (prefer && int(prefer.c, 0, N - 1) && int(prefer.r, 0, N - 1) && !g[prefer.r * N + prefer.c]) return { c: prefer.c, r: prefer.r };
    const i = g.indexOf('');
    return i < 0 ? null : { c: i % N, r: Math.floor(i / N) };
  }

  // ------------------------------------------------------------ validation
  function validWin(w, ids) {
    if (!plain(w) || !sameKeys(w, ['id', 'kind', 'open', 'state', 'c', 'r', 'w', 'h', 'max'])) return 'win-keys';
    if (typeof w.id !== 'string' || !PANE_ID.test(w.id)) return 'win-id';
    if (ids.has(w.id)) return 'duplicate-id';
    ids.add(w.id);
    if (!KINDS.includes(w.kind)) return 'kind';
    if (typeof w.open !== 'string' || !OPEN.test(w.open)) return 'open';
    if (!okState(w.state)) return 'state';
    if (!okTile(w)) return 'tile';
    if (typeof w.max !== 'boolean') return 'max';
    return '';
  }
  // a preset may name the window that gets the focus when it opens: focus = an index into wins (the Dev/Code browser, ready to type)
  function validPreset(p) {
    if (!plain(p) || !(sameKeys(p, ['id', 'name', 'wins']) || sameKeys(p, ['id', 'name', 'wins', 'focus']))) return 'preset-keys';
    if (typeof p.id !== 'string' || !PRESET_ID.test(p.id) || !okName(p.name) || !Array.isArray(p.wins) || p.wins.length > N * N) return 'preset';
    if (has(p, 'focus') && !(Number.isInteger(p.focus) && p.focus >= 0 && p.focus < p.wins.length)) return 'preset-focus';
    const placed = [];
    for (const w of p.wins) {
      if (!plain(w) || !sameKeys(w, ['open', 'state', 'c', 'r', 'w', 'h']) || typeof w.open !== 'string' || !OPEN.test(w.open) || !okState(w.state) || !okTile(w)) return 'preset-win';
      if (placed.some(t => overlap(t, w))) return 'preset-overlap';
      placed.push(w);
    }
    return '';
  }
  function validate(doc) {
    const bad = err => ({ ok: false, err });
    if (!plain(doc) || !sameKeys(doc, ['v', 'active', 'bar', 'sheets', 'mine']) || doc.v !== 1) return bad('doc');
    if (doc.bar !== 'top' && doc.bar !== 'bottom') return bad('bar');
    if (!Array.isArray(doc.sheets) || doc.sheets.length > MAX_SHEETS) return bad('sheets');
    if (!Array.isArray(doc.mine) || doc.mine.length > MAX_PRESETS) return bad('mine');
    const sids = new Set(), ids = new Set();
    for (const s of doc.sheets) {
      if (!plain(s) || !sameKeys(s, ['id', 'name', 'wins', 'focus'])) return bad('sheet-keys');
      if (typeof s.id !== 'string' || !SHEET_ID.test(s.id) || sids.has(s.id)) return bad('sheet-id');
      sids.add(s.id);
      if (!okName(s.name)) return bad('name');
      if (!Array.isArray(s.wins) || s.wins.length > N * N) return bad('wins');
      for (const w of s.wins) { const e = validWin(w, ids); if (e) return bad(e); }
      for (let i = 0; i < s.wins.length; i++) for (let j = i + 1; j < s.wins.length; j++) if (overlap(s.wins[i], s.wins[j])) return bad('overlap');
      if (s.wins.filter(w => w.max).length > 1) return bad('two-max');
      if (typeof s.focus !== 'string' || (s.focus && !s.wins.some(w => w.id === s.focus))) return bad('focus');
    }
    if (typeof doc.active !== 'string' || (doc.active && !sids.has(doc.active))) return bad('active');
    const pids = new Set();
    for (const p of doc.mine) { const e = validPreset(p); if (e) return bad(e); if (pids.has(p.id)) return bad('preset-id'); pids.add(p.id); }
    return { ok: true };
  }

  // ------------------------------------------------------------ helpers over a doc
  const empty = () => ({ v: 1, active: '', bar: 'top', sheets: [], mine: [] });
  const sheetOf = (doc, sid) => doc.sheets.find(s => s.id === sid) || null;
  function findWin(doc, wid) {
    for (const s of doc.sheets) { const w = s.wins.find(x => x.id === wid); if (w) return { sheet: s, win: w }; }
    return null;
  }
  const wins = doc => doc.sheets.flatMap(s => s.wins);
  // edit a copy of one sheet; `fn(sheet)` returns false when the op does not apply → the same doc comes back
  function edit(doc, sid, fn) {
    const d = clone(doc), s = sheetOf(d, sid);
    if (!s || fn(s, d) === false) return doc;
    return validate(d).ok ? d : doc;
  }
  function editWin(doc, wid, fn) {
    const hit = findWin(doc, wid);
    if (!hit) return doc;
    return edit(doc, hit.sheet.id, s => fn(s.wins.find(w => w.id === wid), s));
  }
  // a pane id no window and no `taken` id uses: w-<kind>-<n>
  function newPaneId(doc, kind, taken) {
    const used = new Set([...wins(doc).map(w => w.id), ...(taken || [])]);
    for (let i = 1; ; i++) { const id = 'w-' + kind + '-' + i; if (!used.has(id)) return id; }
  }
  function newSheetId(doc) {
    const used = new Set(doc.sheets.map(s => s.id));
    for (let i = 1; ; i++) if (!used.has('s' + i)) return 's' + i;
  }
  function uniqueName(doc, name) {
    const base = String(name || 'Lap').trim().slice(0, MAX_NAME - 4) || 'Lap';
    const used = new Set(doc.sheets.map(s => s.name));
    if (!used.has(base)) return base;
    for (let i = 2; ; i++) if (!used.has(base + ' ' + i)) return base + ' ' + i;
  }

  // ------------------------------------------------------------ sheets
  // wins = ready windows (ids, tiles) — e.g. from a preset the page resolved; they are checked like any other
  function addSheet(doc, name, wins0) {
    if (doc.sheets.length >= MAX_SHEETS) return doc;
    const d = clone(doc), id = newSheetId(d);
    d.sheets.push({ id, name: uniqueName(d, name), wins: clone(wins0 || []), focus: '' });
    d.active = id;
    return validate(d).ok ? d : doc;
  }
  function removeSheet(doc, sid) {
    if (!sheetOf(doc, sid)) return doc;
    const d = clone(doc), i = d.sheets.findIndex(s => s.id === sid);
    d.sheets.splice(i, 1);
    if (d.active === sid) d.active = d.sheets.length ? d.sheets[Math.min(i, d.sheets.length - 1)].id : '';
    return d;
  }
  const renameSheet = (doc, sid, name) => (okName(name) ? edit(doc, sid, s => { s.name = name.trim(); }) : doc);
  function activate(doc, sid) {
    if (sid !== '' && !sheetOf(doc, sid)) return doc;
    if (doc.active === sid) return doc;
    const d = clone(doc); d.active = sid; return d;
  }
  function moveSheet(doc, sid, delta) {
    const i = doc.sheets.findIndex(s => s.id === sid), j = i + delta;
    if (i < 0 || j < 0 || j >= doc.sheets.length) return doc;
    const d = clone(doc); d.sheets.splice(j, 0, d.sheets.splice(i, 1)[0]); return d;
  }
  const setBar = (doc, bar) => (bar === 'top' || bar === 'bottom') && bar !== doc.bar ? { ...clone(doc), bar } : doc;

  // ------------------------------------------------------------ windows
  // a new window at `cell` (or the first free cell), one cell big; opened = it covers the sheet (max), as the Founder asked
  function openWin(doc, sid, { id, kind, open, state }, cell, o) {
    const s0 = sheetOf(doc, sid);
    if (!s0 || findWin(doc, id)) return doc;
    const at = freeCell(s0, cell);
    if (!at) return doc;
    const max = !(o && o.max === false);
    return edit(doc, sid, s => {
      if (max) for (const w of s.wins) w.max = false;
      s.wins.push({ id, kind, open, state: state || {}, c: at.c, r: at.r, w: 1, h: 1, max });
      s.focus = id;
    });
  }
  function closeWin(doc, wid) {
    return editWin(doc, wid, (w, s) => { s.wins = s.wins.filter(x => x.id !== wid); if (s.focus === wid) s.focus = s.wins.length ? s.wins[s.wins.length - 1].id : ''; });
  }
  const focusWin = (doc, wid) => editWin(doc, wid, (w, s) => { if (s.focus === wid) return false; s.focus = wid; });
  const maximize = (doc, wid) => editWin(doc, wid, (w, s) => { if (w.max) return false; for (const x of s.wins) x.max = false; w.max = true; s.focus = wid; });
  const restore = (doc, wid) => editWin(doc, wid, w => { if (!w.max) return false; w.max = false; });
  // back to one cell at the tile's top-left (the cell is the window's own, so it is always free)
  const minimize = (doc, wid) => editWin(doc, wid, w => { if (!w.max && w.w === 1 && w.h === 1) return false; w.max = false; w.w = 1; w.h = 1; });
  const toggleMax = (doc, wid) => { const h = findWin(doc, wid); return !h ? doc : h.win.max ? minimize(doc, wid) : maximize(doc, wid); };
  const setState = (doc, wid, state) => (okState(state) ? editWin(doc, wid, w => { if (JSON.stringify(w.state) === JSON.stringify(state)) return false; w.state = clone(state); }) : doc);
  const setKind = (doc, wid, kind, open) => (KINDS.includes(kind) && OPEN.test(open || '') ? editWin(doc, wid, w => { w.kind = kind; w.open = open; w.state = {}; }) : doc);

  // the tile a resize drag asks for: `edge` is the one grabbed (n s e w ne nw se sw), `cell` the cell under the pointer. The edges not
  // grabbed stay put; a grabbed edge goes to the pointer, never past the opposite edge. Cells other windows hold are not taken: of
  // the reachable tiles (each grabbed edge between where it was and where it was pulled) the free one nearest the pull wins, the larger
  // on a tie — so a window stops against its neighbour instead of jumping over it. → a tile, or null when the edge is unknown.
  function resizeTarget(sheet, wid, edge, cell) {
    const w = sheet.wins.find(x => x.id === wid);
    if (!w || !EDGES.includes(edge) || !cell) return null;
    const pc = Math.max(0, Math.min(N - 1, cell.c | 0)), pr = Math.max(0, Math.min(N - 1, cell.r | 0));
    let L = w.c, R = w.c + w.w - 1, T = w.r, B = w.r + w.h - 1;
    const want = { L, R, T, B };
    if (edge.includes('e')) want.R = Math.max(pc, L);
    if (edge.includes('w')) want.L = Math.min(pc, R);
    if (edge.includes('s')) want.B = Math.max(pr, T);
    if (edge.includes('n')) want.T = Math.min(pr, B);
    const span = (a, b) => { const out = []; for (let i = Math.min(a, b); i <= Math.max(a, b); i++) out.push(i); return out; };
    let best = null;
    for (const l of span(L, want.L)) for (const r of span(R, want.R)) for (const t of span(T, want.T)) for (const b of span(B, want.B)) {
      if (r < l || b < t) continue;
      const tile = { c: l, r: t, w: r - l + 1, h: b - t + 1 };
      if (!fits(sheet, tile, wid)) continue;
      const miss = Math.abs(l - want.L) + Math.abs(r - want.R) + Math.abs(t - want.T) + Math.abs(b - want.B), area = tile.w * tile.h;
      if (!best || miss < best.miss || (miss === best.miss && area > best.area)) best = { tile, miss, area };
    }
    return best ? best.tile : tileOf(w);
  }
  function resize(doc, wid, edge, cell) {
    const hit = findWin(doc, wid);
    if (!hit || hit.win.max) return doc;
    const t = resizeTarget(hit.sheet, wid, edge, cell);
    if (!t || sameTile(t, hit.win)) return doc;
    return editWin(doc, wid, w => { Object.assign(w, t); });
  }
  // a move drag: the tile's top-left goes to `cell` (clamped so the tile stays on the grid). Free → it moves. Covered by exactly one
  // window of the same size that fits where this one was → the two swap. Anything else → null (the move is refused).
  function moveTarget(sheet, wid, cell) {
    const w = sheet.wins.find(x => x.id === wid);
    if (!w || !cell) return null;
    const t = { c: Math.max(0, Math.min(N - w.w, cell.c | 0)), r: Math.max(0, Math.min(N - w.h, cell.r | 0)), w: w.w, h: w.h };
    if (sameTile(t, w)) return { tile: t, swap: '' };
    if (fits(sheet, t, wid)) return { tile: t, swap: '' };
    const hit = sheet.wins.filter(x => x.id !== wid && overlap(x, t));
    // the other window is exactly where this one goes and just as big, so it can take this one's tile: tiles never overlap, so that
    // tile is free once both are lifted
    if (hit.length === 1 && sameTile(hit[0], t)) return { tile: t, swap: hit[0].id, back: tileOf(w) };
    return null;
  }
  function move(doc, wid, cell) {
    const hit = findWin(doc, wid);
    if (!hit || hit.win.max) return doc;
    const m = moveTarget(hit.sheet, wid, cell);
    if (!m || (sameTile(m.tile, hit.win) && !m.swap)) return doc;
    return edit(doc, hit.sheet.id, s => {
      const w = s.wins.find(x => x.id === wid);
      if (m.swap) Object.assign(s.wins.find(x => x.id === m.swap), m.back);
      Object.assign(w, m.tile);
    });
  }
  // a window from one sheet to another: it keeps its tile when that is free there, else it takes the first free cell (one cell big)
  function moveToSheet(doc, wid, sid) {
    const hit = findWin(doc, wid), to = sheetOf(doc, sid);
    if (!hit || !to || hit.sheet.id === sid) return doc;
    let tile = tileOf(hit.win);
    if (!fits(to, tile)) { const at = freeCell(to); if (!at) return doc; tile = { c: at.c, r: at.r, w: 1, h: 1 }; }
    const d = clone(doc), from = sheetOf(d, hit.sheet.id), dest = sheetOf(d, sid);
    const w = from.wins.find(x => x.id === wid);
    from.wins = from.wins.filter(x => x.id !== wid);
    if (from.focus === wid) from.focus = from.wins.length ? from.wins[from.wins.length - 1].id : '';
    if (w.max) for (const x of dest.wins) x.max = false;
    dest.wins.push({ ...w, ...tile });
    dest.focus = wid;
    return validate(d).ok ? d : doc;
  }

  // what is drawn: each window's tile on screen (the full grid when max) and whether another max window hides it
  function view(sheet) {
    const top = sheet.wins.find(w => w.max);
    return sheet.wins.map(w => ({ id: w.id, rect: w.max ? { ...FULL } : tileOf(w), max: w.max, covered: !!top && top.id !== w.id }));
  }

  // ------------------------------------------------------------ presets
  // a preset's windows as they are, with fresh pane ids; `resolve(open)` → { kind, open, state } | null (a cat: item the page could not
  // turn into a window is left out). The page resolves cat: items first (it asks main), so this stays pure.
  function fromPreset(doc, preset, resolve, taken) {
    if (validPreset(preset)) return null;
    const out = [], used = new Set(taken || []);
    for (const pw of preset.wins) {
      const r = resolve ? resolve(pw) : (/^pane:/.test(pw.open) ? { kind: pw.open.slice(5), open: pw.open, state: pw.state } : null);
      if (!r || !KINDS.includes(r.kind)) continue;
      const id = newPaneId({ sheets: [{ wins: out }].concat(doc.sheets) }, r.kind, used);
      used.add(id);
      out.push({ id, kind: r.kind, open: r.open || pw.open, state: clone(r.state || pw.state || {}), c: pw.c, r: pw.r, w: pw.w, h: pw.h, max: false });
    }
    return out;
  }
  // the sheet as a preset of the user's own (Mentés sablonként); same id → replaced
  function savePreset(doc, sid, id, name) {
    const s = sheetOf(doc, sid);
    if (!s || !PRESET_ID.test(id || '') || !okName(name)) return doc;
    const p = { id, name: name.trim(), wins: s.wins.map(w => ({ open: w.open, state: clone(w.state), c: w.c, r: w.r, w: w.w, h: w.h })) };
    const fi = s.wins.findIndex(w => w.id === s.focus);
    if (fi >= 0) p.focus = fi;                                           // the focused window comes back focused
    const d = clone(doc);
    const i = d.mine.findIndex(x => x.id === id);
    if (i >= 0) d.mine[i] = p; else { if (d.mine.length >= MAX_PRESETS) return doc; d.mine.push(p); }
    return validate(d).ok ? d : doc;
  }
  // the window of a sheet made by fromPreset that the preset focuses ('' = none): found by its tile, since unresolved items are skipped
  function presetFocus(preset, wins) {
    const pw = preset && Number.isInteger(preset.focus) ? preset.wins[preset.focus] : null;
    const w = pw && wins.find(x => x.c === pw.c && x.r === pw.r);
    return w ? w.id : '';
  }
  const removePreset = (doc, id) => (doc.mine.some(p => p.id === id) ? { ...clone(doc), mine: doc.mine.filter(p => p.id !== id).map(clone) } : doc);

  return {
    N, KINDS, EDGES, MAX_SHEETS, MAX_PRESETS, FULL,
    validate, validPreset, empty, sheetOf, findWin, wins, occupancy, freeCell, fits, overlap, okTile, newPaneId,
    addSheet, removeSheet, renameSheet, activate, moveSheet, setBar,
    openWin, closeWin, focusWin, maximize, restore, minimize, toggleMax, setState, setKind,
    resizeTarget, resize, moveTarget, move, moveToSheet, view,
    fromPreset, presetFocus, savePreset, removePreset,
  };
});
