// WP-46 probe (real Electron, temp home): the Lapok. A blank sheet from the + menu; right-click a cell → the picker, typed search +
// Enter → the window opens over all 16 cells; double-click its header → one cell; drag its south-east corner → 2 × 2; drag a header →
// moved; double-click a small window's header → full; the tabs switch between the Lap and the Munkapad; the doc is saved in main.
// Every gesture is a real input event (sendInputEvent), every size a measured rect. VRG_SHOTS=<folder>: sheet-pick.png,
// sheet-full.png, sheet-tiles.png.
'use strict';
const fs = require('fs'), path = require('path');
module.exports = async function probe({ win }) {
  const errors = [], info = {};
  const { frame } = win.desk;
  const W = frame.webContents;
  const fjs = code => W.executeJavaScript(code);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const wait = async (f, ms = 8000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await f()) return true; } catch (e) {} await sleep(80); } return false; };
  const SHOTS = process.env.VRG_SHOTS || '';
  frame.setPosition(-4000, 0); frame.setSize(1600, 1000); frame.showInactive();
  // an off-screen window is not painted while throttled, so a capture would show an earlier sheet: a shots run paints it always
  // (only then: an ordinary run keeps the throttling, which is what showed the focus-hold race)
  if (SHOTS) { try { W.setBackgroundThrottling(false); } catch (e) {} }
  const shot = async name => { if (!SHOTS) return; await sleep(300); try { W.invalidate(); } catch (e) {} await sleep(500); fs.mkdirSync(SHOTS, { recursive: true }); const img = await W.capturePage(); fs.writeFileSync(path.join(SHOTS, name), img.toPNG()); };
  const rectOf = sel => fjs(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()`);
  const mouse = async (type, x, y, extra) => { W.sendInputEvent({ type, x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1, ...(extra || {}) }); await sleep(30); };
  const click = async (x, y, button = 'left') => { await mouse('mouseDown', x, y, { button }); await mouse('mouseUp', x, y, { button }); };
  const dbl = async (x, y) => { await click(x, y); await mouse('mouseDown', x, y, { clickCount: 2 }); await mouse('mouseUp', x, y, { clickCount: 2 }); await sleep(150); };
  const drag = async (x0, y0, x1, y1) => {
    await mouse('mouseDown', x0, y0);
    for (let i = 1; i <= 8; i++) await mouse('mouseMove', x0 + (x1 - x0) * i / 8, y0 + (y1 - y0) * i / 8, { modifiers: ['leftButtonDown'] });   // the button held
    await mouse('mouseUp', x1, y1); await sleep(200);
  };
  const st = () => fjs(`window.VRGSheets.state()`);
  const near = (a, b, tol = 3) => Math.abs(a - b) <= tol;
  const K_wrapped = k => !!(k && k.wrapped && k.wrapped.length);

  if (!(await wait(() => fjs(`!!(window.VRGDesk && window.VRGDesk.state().ready && window.VRGSheets)`), 12000))) return { ok: false, errors: ['the VRG Asztal did not become ready'] };
  await fjs(`window.VRGDesk.setView('desktop')`);
  await sleep(200);

  // ---- the + in the bar: no sheet yet → '＋ Lap'; the menu lists the presets; Üres lap makes s1
  const plus = await rectOf('[data-role="topstrip"] [data-role="sh-new"]');
  if (!plus) return { ok: false, errors: ['no ＋ Lap button in the top strip'] };
  await click(plus.x + plus.w / 2, plus.y + plus.h / 2);
  if (!(await wait(() => fjs(`!!document.querySelector('[data-role="sh-menu"] [data-item="preset:ures"]')`)))) errors.push('the + menu did not list the presets');
  info.presets = await fjs(`[...document.querySelectorAll('[data-role="sh-menu"] [data-item^="preset:"]')].map(b => b.dataset.item.slice(7))`);
  await fjs(`document.querySelector('[data-role="sh-menu"] [data-item="preset:ures"]').click()`);
  if (!(await wait(async () => (await st()).active === 's1'))) return { ok: false, errors: [...errors, 'no sheet after Üres lap: ' + JSON.stringify(await st())] };
  const vis = await fjs(`({ layer: !document.querySelector('[data-role="sh-layer"]').hidden, root: document.getElementById('root').hidden, mark: document.body.dataset.sheet, cells: document.querySelectorAll('[data-role="sh-cell"][data-free="1"]').length })`);
  if (!vis.layer || !vis.root || vis.mark !== 's1' || vis.cells !== 16) errors.push('an empty sheet should show 16 free cells over a hidden tree: ' + JSON.stringify(vis));

  // ---- right-click cell (2,1) → the picker; type, Enter → a Fájlok window over all 16 cells, its tile = that cell
  const cell = await rectOf('[data-role="sh-cell"][data-c="2"][data-r="1"]');
  const layer = await rectOf('[data-role="sh-layer"]');
  await click(cell.x + cell.w / 2, cell.y + cell.h / 2, 'right');
  if (!(await wait(() => fjs(`!!document.querySelector('[data-role="sh-pick-input"]')`)))) return { ok: false, errors: [...errors, 'right-click on a cell did not open the picker'] };
  info.pickItems = await fjs(`document.querySelectorAll('[data-role="sh-pick-list"] [data-pick]').length`);
  if (info.pickItems < 15) errors.push('the picker lists only ' + info.pickItems + ' things');
  await shot('sheet-pick.png');
  W.insertText('fájlok'); await sleep(250);
  const first = await fjs(`(document.querySelector('[data-role="sh-pick-list"] [data-sel="1"]') || {}).dataset.pick || ''`);
  if (!/files|docs/.test(first)) errors.push('typing "fájlok" should put Fájlok first, got ' + first);
  W.sendInputEvent({ type: 'keyDown', keyCode: 'Return' }); W.sendInputEvent({ type: 'char', keyCode: '\r' }); W.sendInputEvent({ type: 'keyUp', keyCode: 'Return' });
  if (!(await wait(async () => (await st()).wins.length === 1))) return { ok: false, errors: [...errors, 'Enter did not open a window: ' + JSON.stringify(await st())] };
  let s = await st();
  const w1 = s.wins[0];
  info.first = w1;
  if (!(w1.max && w1.c === 2 && w1.r === 1 && w1.w === 1 && w1.h === 1)) errors.push('an opened window is full, its tile the clicked cell: ' + JSON.stringify(w1));
  if (await fjs(`!!document.querySelector('[data-role="sh-pick"]')`)) errors.push('the picker stayed open');
  let wr = await rectOf(`[data-win="${w1.id}"]`);
  const pad = 6;
  if (!(near(wr.w, layer.w - 2 * pad) && near(wr.x, layer.x + pad))) errors.push('a full window covers the sheet: ' + JSON.stringify({ wr, layer }));
  if (!(await wait(() => fjs(`!!document.querySelector('[data-win="${w1.id}"] [data-pane="${w1.id}"][data-kind="files"]')`)))) errors.push('the files pane is not mounted in the window');
  await shot('sheet-full.png');

  // ---- double-click the full window's header → one cell at (2,1)
  let head = await rectOf(`[data-win="${w1.id}"] [data-role="sh-head"] .tab`);
  await dbl(head.x + 20, head.y + head.h / 2);
  s = await st();
  if (!(s.wins[0].max === false && s.wins[0].w === 1 && s.wins[0].h === 1)) errors.push('double-click on a full header → one cell: ' + JSON.stringify(s.wins[0]));
  const c21 = await rectOf('[data-role="sh-cell"][data-c="2"][data-r="1"]');
  wr = await rectOf(`[data-win="${w1.id}"]`);
  if (!(near(wr.x, c21.x) && near(wr.y, c21.y) && near(wr.w, c21.w) && near(wr.h, c21.h))) errors.push('the small window sits on its cell: ' + JSON.stringify({ wr, c21 }));

  // ---- drag the south-east corner into cell (3,2) → 2 × 2
  const c32 = await rectOf('[data-role="sh-cell"][data-c="3"][data-r="2"]');
  await drag(wr.x + wr.w - 2, wr.y + wr.h - 2, c32.x + c32.w / 2, c32.y + c32.h / 2);
  s = await st();
  if (!(s.wins[0].c === 2 && s.wins[0].r === 1 && s.wins[0].w === 2 && s.wins[0].h === 2)) errors.push('corner drag → 2×2: ' + JSON.stringify(s.wins[0]));
  if (await fjs(`!document.querySelector('[data-role="sh-ghost"]').hidden || !!document.body.dataset.shDrag`)) errors.push('the drag ghost stayed');

  // ---- a second window (git) at (0,0) through the api, then minimise it and drag its header to (0,3)
  await fjs(`window.VRGSheets.openKind('git', {}, { cell: { c: 0, r: 0 } })`);
  await wait(async () => (await st()).wins.length === 2);
  s = await st();
  const w2 = s.wins.find(w => w.kind === 'git');
  if (!w2 || !w2.max) errors.push('the second window opens full: ' + JSON.stringify(w2));
  if (await fjs(`!document.querySelector('[data-win="${w1.id}"]').hidden`)) errors.push('a window under a full one is hidden');
  head = await rectOf(`[data-win="${w2.id}"] [data-role="sh-head"] .tab`);
  await dbl(head.x + 20, head.y + head.h / 2);
  head = await rectOf(`[data-win="${w2.id}"] [data-role="sh-head"] .tab`);
  const c03 = await rectOf('[data-role="sh-cell"][data-c="0"][data-r="3"]');
  await drag(head.x + 20, head.y + head.h / 2, c03.x + 20, c03.y + 12);
  s = await st();
  const g = s.wins.find(w => w.kind === 'git');
  if (!(g.c === 0 && g.r === 3 && g.w === 1)) errors.push('header drag moves the window to (0,3): ' + JSON.stringify(g));
  // onto the 2×2 files window: refused (different size)
  head = await rectOf(`[data-win="${w2.id}"] [data-role="sh-head"] .tab`);
  const c22 = await rectOf('[data-role="sh-cell"][data-c="2"][data-r="2"]');
  await drag(head.x + 20, head.y + head.h / 2, c22.x + 20, c22.y + 12);
  s = await st();
  if (s.wins.find(w => w.kind === 'git').r !== 3) errors.push('a move onto a bigger window is refused');
  await shot('sheet-tiles.png');

  // ---- double-click the small window's header → full
  head = await rectOf(`[data-win="${w2.id}"] [data-role="sh-head"] .tab`);
  await dbl(head.x + 20, head.y + head.h / 2);
  if (!(await st()).wins.find(w => w.kind === 'git').max) errors.push('double-click on a small header → full');

  // ---- the tabs: Munkapad shows the tree, the sheet's tab brings it back; the dock lists the sheet's windows
  const tabs = await fjs(`[...document.querySelectorAll('[data-role="topstrip"] [data-role="sh-tab"]')].map(b => b.dataset.sheet)`);
  if (JSON.stringify(tabs) !== JSON.stringify(['', 's1'])) errors.push('sheet tabs: ' + JSON.stringify(tabs));
  await fjs(`document.querySelector('[data-role="sh-tab"][data-sheet=""]').click()`);
  await sleep(200);
  const onTree = await fjs(`({ layer: document.querySelector('[data-role="sh-layer"]').hidden, root: document.getElementById('root').hidden, mark: document.body.dataset.sheet })`);
  if (!onTree.layer || onTree.root || onTree.mark) errors.push('Munkapad tab → the tree: ' + JSON.stringify(onTree));
  const dockWins = await fjs(`[...document.querySelectorAll('[data-role="dock"] button.win')].map(b => b.dataset.pane)`);
  if (!dockWins.includes(w1.id) || !dockWins.includes(w2.id)) errors.push('the dock lists the sheet windows: ' + JSON.stringify(dockWins));
  await fjs(`document.querySelector('[data-role="dock"] button.win[data-pane="${w1.id}"]').click()`);           // a dock button brings its sheet back
  await sleep(250);
  if ((await st()).active !== 's1' || await fjs(`document.querySelector('[data-role="sh-layer"]').hidden`)) errors.push('a dock button of a sheet window brings the sheet back');

  // ---- main saved it
  const saved = await fjs(`window.vrg.sheets.get()`);
  await wait(async () => { const r = await fjs(`window.vrg.sheets.get()`); return r.doc.sheets[0] && r.doc.sheets[0].wins.length === 2; }, 3000);
  const doc = (await fjs(`window.vrg.sheets.get()`)).doc;
  if (!(doc.sheets.length === 1 && doc.sheets[0].wins.length === 2)) errors.push('main has the sheet: ' + JSON.stringify(doc).slice(0, 300));
  if (!(saved.presets || []).some(p => p.id === 'fejlesztes')) errors.push('main serves the presets');
  const refused = await fjs(`window.vrg.sheets.set({ v: 1, active: '', bar: 'top', sheets: [{ id: 's1', name: 'x', focus: '', wins: [{ id: 'a', kind: 'files', open: 'pane:files', state: {}, c: 0, r: 0, w: 2, h: 2, max: false }, { id: 'b', kind: 'files', open: 'pane:files', state: {}, c: 1, r: 1, w: 1, h: 1, max: false }] }], mine: [] })`);
  if (refused.ok !== false) errors.push('main takes overlapping windows: ' + JSON.stringify(refused));

  // ---- Ctrl+W closes the focused window; closing the sheet leaves the Munkapad, nothing pruned there
  await fjs(`window.VRGSheets.close('${w2.id}'); window.VRGSheets.close('${w1.id}')`);
  await sleep(150);
  if (await fjs(`window.VRGFrame.host.has('${w1.id}') || !!document.querySelector('[data-role="sh-win"][data-win="${w1.id}"]')`)) errors.push('a closed window\'s pane is unmounted');
  if (!(await wait(() => fjs(`![...document.querySelectorAll('[data-role="dock"] button.win')].some(b => b.dataset.pane === '${w1.id}')`), 2000))) errors.push('the dock still lists a closed window');
  // ---- a preset with in-shell apps (Iroda: Planner + Kalkulátor panel + Fájlok): the app views live in their windows, a tree save
  // (layout.set) does not prune them, a full window hides the others' views, closing the sheet does
  const { views } = win.desk;
  const sid = await fjs(`window.VRGSheets.newSheet(window.VRGSheets.presets().find(p => p.id === 'iroda'))`);
  if (!(await wait(async () => (await st()).wins.length === 3))) errors.push('the Iroda preset opens 3 windows: ' + JSON.stringify(await st()));
  info.iroda = (await st()).wins.map(w => w.kind + '@' + w.c + ',' + w.r + ' ' + w.w + 'x' + w.h);
  if (!(await wait(() => views.has('app:planner') && views.has('app:calc-panel'), 8000))) errors.push('the preset\'s app views were not made');
  else {
    const pw = (await st()).wins.find(w => w.kind === 'app' && w.w === 3);
    const box = pw && await rectOf(`[data-win="${pw.id}"] [data-role="sh-body"]`);
    await wait(() => { const q = views.rect('app:planner'); return q && q.w > 0; }, 3000);
    const vr = views.rect('app:planner');
    if (!box || !vr || !(near(vr.x, box.x, 4) && near(vr.w, box.w, 4))) errors.push('the Planner view sits in its 3×4 window: ' + JSON.stringify({ vr, box }));
    await fjs(`window.VRGFrame.save()`); await sleep(400);                   // the tree is saved: main prunes by tree + sheets
    if (!views.has('app:planner')) errors.push('a tree save pruned an app view that lives on a sheet');
    const fw = (await st()).wins.find(w => w.kind === 'files');
    await fjs(`window.VRGSheets.focus('${fw.id}')`);
    await fjs(`(() => { const L = window.VRGSheetsLib; return 1; })()`);
    await fjs(`document.querySelector('[data-win="${fw.id}"] [data-act="max"]').click()`);
    if (!(await wait(() => { const q = views.rect('app:planner'); return q && q.w === 0; }, 3000))) errors.push('a full window hides the app views under it: ' + JSON.stringify(views.rect('app:planner')));
    await shot('sheet-iroda.png');
    await fjs(`document.querySelector('[data-win="${fw.id}"] [data-act="max"]').click()`);
    if (!(await wait(() => { const q = views.rect('app:planner'); return q && q.w > 0; }, 3000))) errors.push('restoring shows the app view again');
    await shot('sheet-iroda-tiles.png');
  }
  // ---- the Dev/Code preset: Jegyzet 2×2, the Thread Board (from Full/notes, in-shell) 2×1, Claude Code + Parancssor + PowerShell
  // 1×1 each, a browser 2×3 with the keyboard in its search box. The probe swaps Google for a page on 127.0.0.1 and Claude Code for
  // test/fixtures/fake-claude.js: no network, no real Claude (CONTRACT §4.9). The shipped preset itself is checked by wp-46.test.js.
  const oldBin = process.env.VRG_CLAUDE_BIN;
  process.env.VRG_CLAUDE_BIN = path.join(__dirname, '..', '..', 'test', 'fixtures', 'fake-claude.js');
  const http = require('http');
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end('<!doctype html><title>kereső</title><input autofocus>'); });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const local = 'http://127.0.0.1:' + srv.address().port + '/';
  try {
    const pre = await fjs(`window.VRGSheets.presets().find(p => p.id === 'devcode') || null`);
    if (!pre) errors.push('the Dev/Code preset is served at the Dev level');
    else {
      const P = JSON.parse(JSON.stringify(pre));
      for (const w of P.wins) if (w.open === 'pane:web') w.state.tabs = [local];
      await fjs(`window.VRGSheets.newSheet(${JSON.stringify(P)})`);
      if (!(await wait(async () => (await st()).wins.length === 6))) errors.push('Dev/Code opens 6 windows: ' + JSON.stringify((await st()).wins.map(w => w.open)));
      const s = await fjs(`(() => { const d = window.VRGSheets.doc(); const x = d.sheets.find(q => q.id === d.active); return { focus: x.focus, wins: x.wins }; })()`);   // with pane state
      info.devcode = s.wins.map(w => (w.state && w.state.prof ? w.kind + ':' + w.state.prof : w.kind) + '@' + w.c + ',' + w.r + ' ' + w.w + 'x' + w.h);
      const want = ['note@0,0 2x2', 'web@2,0 2x3', 'app@0,2 2x1', 'term:claude-a@0,3 1x1', 'term:cmd@1,3 1x1', 'term:pwsh@2,3 1x1'];
      if (want.some(x => !info.devcode.includes(x))) errors.push('Dev/Code tiles: ' + JSON.stringify(info.devcode));
      const webWin = s.wins.find(w => w.kind === 'web');
      if (!(await wait(async () => (await fjs(`window.VRGSheets.focused()`)) === webWin.id, 3000))) errors.push('the browser window has the focus: ' + await fjs(`window.VRGSheets.focused()`));
      if (!(await wait(() => fjs(`(() => { const a = document.activeElement; return !!a && a.tagName === 'INPUT' && !!a.closest('[data-win="${webWin.id}"]'); })()`), 3000))) errors.push('the keyboard is in the browser\'s search box: ' + await fjs(`(() => { const a = document.activeElement, w = a && a.closest && a.closest('[data-role="sh-win"]'); return JSON.stringify({ el: a && a.tagName, win: w && w.dataset.win, holding: window.VRGSheets.holding(), focused: window.VRGSheets.focused(), hasFocus: document.hasFocus() }); })()`));
      // panes.css: the browser and the Jegyzet draw in the Mélyvíz look (read as computed styles, not from a screenshot), and the rules
      // stay inside the pane bodies (the Lap window around them carries data-kind too)
      const noteWin = s.wins.find(w => w.kind === 'note');
      info.look = await fjs(`(() => { const cs = (sel, p) => { const e = document.querySelector(sel); return e ? getComputedStyle(e)[p] : null; };
        return { omniBg: cs('[data-win="${webWin.id}"] [data-role="web-omni"]', 'backgroundColor'), omniFont: cs('[data-win="${webWin.id}"] [data-role="web-omni"]', 'fontFamily'),
          tabsBorder: cs('[data-win="${webWin.id}"] [data-role="web-tabs"]', 'borderBottomStyle'), noteDisplay: cs('[data-win="${noteWin.id}"] [data-pane]', 'display'),
          saveColor: cs('[data-win="${noteWin.id}"] [data-role="note-save"]', 'color'), labelFont: cs('[data-win="${noteWin.id}"] [data-role="note-field"] > span', 'textTransform'),
          textH: (document.querySelector('[data-win="${noteWin.id}"] [data-role="note-text"]') || { offsetHeight: 0 }).offsetHeight,
          srcBorder: cs('[data-win="${noteWin.id}"] [data-role="note-source"]', 'borderTopStyle'),
          winDisplay: cs('[data-role="sh-win"][data-win="${noteWin.id}"]', 'display') }; })()`);
      const L = info.look;
      if (L.omniBg !== 'rgb(10, 20, 28)' || !/Cascadia|Consolas|monospace/.test(L.omniFont || '') || L.tabsBorder !== 'solid') errors.push('the browser bar is in the Mélyvíz look: ' + JSON.stringify(L));
      if (L.noteDisplay !== 'grid' || L.saveColor !== 'rgb(147, 211, 230)' || L.labelFont !== 'uppercase' || L.textH < 90 || L.srcBorder !== 'dashed') errors.push('the Jegyzet form is in the Mélyvíz look and its text fills the window: ' + JSON.stringify(L));
      if (L.winDisplay !== 'flex') errors.push('panes.css leaked onto the Lap window (data-kind without data-pane): display ' + L.winDisplay);
      // the Thread Board: an app view on vrg-app://threadboard/BOARD.html, inside its 2×1 window
      if (!(await wait(() => views.has('app:threadboard'), 8000))) errors.push('the Thread Board view was not made');
      else {
        const v = views.get('app:threadboard');
        await wait(() => v.webContents.getURL().startsWith('vrg-app://threadboard/') && !v.webContents.isLoading(), 8000);
        info.board = { url: v.webContents.getURL(), title: v.webContents.getTitle() };
        if (info.board.url !== 'vrg-app://threadboard/BOARD.html' || !/Thread Board/.test(info.board.title)) errors.push('the Thread Board page loads in-shell: ' + JSON.stringify(info.board));
        const above = await v.webContents.executeJavaScript(`fetch('/../features/features.json').then(r => r.status, () => 'refused')`);
        if (above === 200) errors.push('the Thread Board origin reads above its folder');
        const tw = s.wins.find(w => w.kind === 'app');
        const box = await rectOf(`[data-win="${tw.id}"] [data-role="sh-body"]`);
        await wait(() => { const q = views.rect('app:threadboard'); return q && q.w > 0; }, 3000);
        const vr = views.rect('app:threadboard');
        if (!box || !vr || !(near(vr.x, box.x, 4) && near(vr.w, box.w, 4) && near(vr.h, box.h, 4))) errors.push('the Thread Board view sits in its 2×1 window: ' + JSON.stringify({ vr, box }));
      }
      // the three terminals run their own profiles (Claude Code = the fake here)
      const terms = s.wins.filter(w => w.kind === 'term');
      if (!(await wait(() => fjs(`${JSON.stringify(terms.map(t => t.id))}.every(id => !!document.querySelector('[data-win="' + id + '"] .xterm'))`), 8000))) errors.push('the three terminals are drawn');
      else {
        info.termBg = await fjs(`(() => { const i = window.VRGFrame.host.inst('${terms[1].id}'); const t = i && i.term; return t && t.options.theme ? t.options.theme.background : null; })()`);
        if (info.termBg !== '#0a141c') errors.push('the terminal draws in the Mélyvíz colours (term.js THEME): ' + info.termBg);
      }
      // the web view shows the page in its 2×3 window
      if (!(await wait(async () => { return views.ids().some(i => { const wc = views.get(i); return wc && wc.webContents.getURL() === local; }); }, 8000))) errors.push('the browser opened its tab: ' + JSON.stringify(views.ids()));
      await shot('sheet-devcode.png');
    }
  } finally {
    srv.close();
    if (oldBin === undefined) delete process.env.VRG_CLAUDE_BIN; else process.env.VRG_CLAUDE_BIN = oldBin;
  }
  // ---- panes.css on Fájlok and Git: a sheet with both side by side (2×4 each), read as computed styles
  await fjs(`window.VRGSheets.newSheet({ id: 'look', name: 'Fájlok és Git', wins: [{ open: 'pane:files', state: {}, c: 0, r: 0, w: 2, h: 4 }, { open: 'pane:git', state: {}, c: 2, r: 0, w: 2, h: 4 }] })`);
  if (!(await wait(() => fjs(`!!document.querySelector('[data-pane][data-kind="files"] [data-role="roots"] button[data-current="1"]') && !!document.querySelector('[data-pane][data-kind="git"] [data-role="git-checkout"]')`), 8000))) errors.push('Fájlok and Git drew on the look sheet');
  else {
    await wait(() => fjs(`!!(document.querySelector('[data-pane][data-kind="git"] [data-role="git-checkout"]') || {}).textContent`), 5000);
    info.look2 = await fjs(`(() => { const cs = (sel, p) => { const e = document.querySelector(sel); return e ? getComputedStyle(e)[p] : null; };
      const F = '[data-pane][data-kind="files"] ', G = '[data-pane][data-kind="git"] ';
      return { th: cs(F + 'table[data-role="list"] th', 'textTransform'), thPos: cs(F + 'table[data-role="list"] th', 'position'),
        rootOn: cs(F + '[data-role="roots"] button[data-current="1"]', 'color'), sides: cs(F + '[data-role="sides"]', 'display'),
        gitH2: cs(G + 'h2', 'display'), gitSec: cs(G + 'section[data-role="git-files"]', 'borderTopStyle'),
        commit: cs(G + '[data-role="git-commit-btn"]', 'color'), push: cs(G + '[data-role="git-push"]', 'color'),
        branch: cs(G + '[data-role="git-branch"]', 'color'), pushHidden: cs(G + '[data-role="git-pushgo"]', 'display'),
        wrapped: [...document.querySelectorAll('[data-role="topstrip"] > *')].filter(c => c.scrollHeight > c.clientHeight + 1 && c.clientHeight > 0).map(c => c.textContent.slice(0, 24)) }; })()`);
    if (K_wrapped(info.look2)) errors.push('with four sheets the top strip wraps: ' + JSON.stringify(info.look2.wrapped));
    const K = info.look2;
    if (K.th !== 'uppercase' || K.thPos !== 'sticky' || K.rootOn !== 'rgb(147, 211, 230)' || K.sides !== 'flex') errors.push('Fájlok is in the Mélyvíz look: ' + JSON.stringify(K));
    if (K.gitH2 !== 'none' || K.gitSec !== 'solid' || K.commit !== 'rgb(147, 211, 230)' || K.push !== 'rgb(232, 168, 115)' || K.branch !== 'rgb(147, 211, 230)' || K.pushHidden !== 'none') errors.push('Git is in the Mélyvíz look (and hidden stays hidden): ' + JSON.stringify(K));
    await shot('sheet-files-git.png');
  }
  // ---- panes.css on the rest: Rétegverem, Hírek, chat, Posta (2×2 each)
  await fjs(`window.VRGSheets.newSheet({ id: 'look3', name: 'Többi', wins: [{ open: 'pane:stack', state: {}, c: 0, r: 0, w: 2, h: 2 }, { open: 'pane:feed', state: {}, c: 2, r: 0, w: 2, h: 2 }, { open: 'pane:chat', state: {}, c: 0, r: 2, w: 2, h: 2 }, { open: 'pane:mail', state: {}, c: 2, r: 2, w: 2, h: 2 }] })`);
  await wait(() => fjs(`['stack', 'feed', 'chat', 'mail'].every(k => (document.querySelector('[data-pane][data-kind="' + k + '"]') || { children: [] }).children.length > 0)`), 8000);
  info.look3 = await fjs(`(() => { const cs = (sel, p) => { const e = document.querySelector(sel); return e ? getComputedStyle(e)[p] : 'missing'; };
    return { stackGo: cs('[data-pane][data-kind="stack"] [data-role="go"]', 'color'), feedTitle: cs('[data-pane][data-kind="feed"] > [data-role="bar"] > [data-role="title"]', 'color'),
      chatSend: cs('[data-pane][data-kind="chat"] [data-role="send"]', 'borderTopColor'), chatTitle: cs('[data-pane][data-kind="chat"] [data-role="head"] [data-role="title"]', 'textTransform'),
      mailTop: cs('[data-pane][data-kind="mail"] [data-role="mail-top"]', 'backgroundColor') }; })()`);
  const K3 = info.look3, ACC = 'rgb(147, 211, 230)', WARM = 'rgb(232, 168, 115)';
  if (K3.stackGo !== ACC || K3.feedTitle !== WARM || K3.chatSend !== ACC || K3.chatTitle !== 'uppercase' || K3.mailTop !== 'rgb(10, 20, 28)') errors.push('Rétegverem, Hírek, chat and Posta are in the Mélyvíz look: ' + JSON.stringify(K3));
  await shot('sheet-rest.png');
  await fjs(`(() => { for (const s of window.VRGSheets.doc().sheets.slice()) window.VRGSheets.closeSheet(s.id); return 1; })()`);   // through the page: its panes unmount (a live pty at quit hangs the exit)
  if (!(await wait(() => !views.has('app:planner'), 3000))) errors.push('closing the sheet prunes its app views');
  if (!(await wait(() => !views.has('app:threadboard'), 3000))) errors.push('closing the sheet prunes the Thread Board view');
  info.sid = sid;
  await fjs(`window.VRGDesk.setView('dashboard')`);
  info.final = await st();
  return { ok: !errors.length, errors, info };
};
