// city-phone.js — VRG Mobile, WP M5 (Kódváros online): a phone layout for Kódváros inside the phone's WebView.
//
// Kódváros (CodeCity/src) is laid out for a PC screen: a header bar with the search and a dozen buttons, the lens
// tabs, the legend, the board ("MOST · <sha>"), the breadcrumb, the minimap and the timeline all float over the
// canvas. On a phone they pile up on each other and run off the right edge. This script leaves CodeCity's own
// files alone and, only on a phone-sized WebView, rearranges the same elements (their ids, listeners and the
// code that updates them stay as they are):
//   - one 48 px row on top: "☰" (opens the sheet), a two-line status (the board's text, then where you are:
//     the breadcrumb), and the timeline's ▶ (in landscape also ⏮ ⏭); the rest of the screen is the city
//   - the sheet (portrait: drops down from the row, at most 72 % high; landscape: a side sheet on the left, so
//     the city stays visible beside it) holds, moved there from the page: the breadcrumb, the search, the lens
//     tabs, the timeline, the legend, the health ribbon and the header bar's remaining buttons
//   - every button, select and input in the row and the sheet is at least 44 x 44 px
//   - hidden on the phone: the board itself (its text is in the row), the minimap, the help line, and the header
//     buttons that need the PC (Megnyitás… file picker, Kép download, Dokk prompt cards)
//   - a tap on the city while the sheet is open only closes the sheet (no orbit, no pick); in portrait, choosing a
//     lens, a view, a search result or a breadcrumb step closes it too, so the result is visible
// "Phone-sized" = the shorter side of the window or of the screen is at most 600 px (html.vrg-phone; html.vrg-land
// in landscape).
// On a wider window (a tablet, or the test resizing) everything goes back where it came from.
// FeatureCity injects it before city-touch.js when a page has loaded (this one must come first: its capture
// listener that closes the sheet has to run before the touch adapter takes the finger).
// Mobile/tests/city-phone.js checks the boxes in headless Chromium at 412x915 and 915x412.
(() => {
  if (window.__vrgPhone) return;
  const stage = document.getElementById('stage'), bar = document.getElementById('bar');
  if (!stage || !bar) return;
  const $ = id => document.getElementById(id);
  const root = document.documentElement;

  const CSS = `
html.vrg-phone #bar > b, html.vrg-phone #title, html.vrg-phone #help, html.vrg-phone #board, html.vrg-phone #inset,
html.vrg-phone #dock-btn, html.vrg-phone #card-btn, html.vrg-phone #bar label.btn { display: none !important; }
#vp-top, #vp-sheet { display: none; }
html.vrg-phone #vp-top { display: flex; flex: 0 0 48px; height: 48px; align-items: center; gap: 4px; padding: 0 2px;
  border-bottom: 1px solid var(--line, #333); background: var(--panel-solid, #121c24); position: relative; z-index: 7; }
html.vrg-phone #vp-top button { flex: 0 0 auto; min-width: 44px; height: 44px; margin: 0; padding: 0 6px; border: 1px solid transparent;
  background: none; color: var(--text, #eee); font: 18px/1 var(--font, monospace); cursor: pointer; }
html.vrg-phone #vp-top button[hidden] { display: none !important; }
html.vrg-phone #vp-menu { color: var(--accent, #9cf) !important; font-size: 22px !important; }
html.vrg-phone.vrg-open #vp-menu { border-color: var(--accent, #9cf) !important; background: var(--accent-soft, #9cf2) !important; }
html.vrg-phone #vp-status { flex: 1 1 auto !important; min-width: 0 !important; display: flex; flex-direction: column; justify-content: center;
  align-items: stretch; text-align: left; padding: 0 4px !important; font-size: 12px !important; line-height: 1.3 !important; }
html.vrg-phone #vp-status > * { display: block; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
html.vrg-phone #vp-l1 { color: var(--accent, #9cf); font-weight: bold; letter-spacing: .04em; }
html.vrg-phone #vp-l2 { color: var(--dim, #aaa); font-weight: normal; }
html.vrg-phone.vrg-land #vp-status { flex-direction: row; align-items: center; gap: 12px; }
html.vrg-phone.vrg-land #vp-l1 { flex: 0 1 auto; } html.vrg-phone.vrg-land #vp-l2 { flex: 1 1 0; }
html.vrg-phone:not(.vrg-land) #vp-back, html.vrg-phone:not(.vrg-land) #vp-step { display: none !important; }

html.vrg-phone #vp-sheet { position: fixed; z-index: 6; top: 48px; left: 0; right: 0; max-height: 72%; overflow-x: hidden; overflow-y: auto;
  overscroll-behavior: contain; flex-direction: column; gap: 12px; padding: 10px 10px 14px; box-sizing: border-box;
  background: var(--panel-solid, #121c24); border-bottom: 1px solid var(--line-strong, #555); box-shadow: 0 8px 24px #000a; }
html.vrg-phone.vrg-land #vp-sheet { right: auto; bottom: 0; width: min(400px, 55%); max-height: none; border-bottom: 0;
  border-right: 1px solid var(--line-strong, #555); }
html.vrg-phone.vrg-open #vp-sheet { display: flex; }
html.vrg-phone #vp-sheet > * { position: static !important; transform: none !important; inset: auto !important; margin: 0 !important;
  width: auto !important; max-width: none !important; min-width: 0 !important; max-height: none !important; flex: 0 0 auto;
  box-shadow: none !important; z-index: auto !important; }
html.vrg-phone #vp-sheet > [hidden], html.vrg-phone #vp-sheet > :empty:not(#qwrap) { display: none !important; }
html.vrg-phone #vp-sheet .btn, html.vrg-phone #vp-sheet select, html.vrg-phone #vp-sheet #q {
  min-height: 44px; min-width: 44px; font-size: 13px; padding: 4px 10px; box-sizing: border-box; }
html.vrg-phone #vp-sheet h5 { margin: 0 0 -6px; font: 10px/1.2 var(--font, monospace); color: var(--dim, #aaa);
  text-transform: uppercase; letter-spacing: .08em; }
html.vrg-phone #vp-sheet #crumb { display: flex; flex-wrap: wrap; align-items: center; padding: 0 4px; white-space: normal; overflow: visible; }
html.vrg-phone #vp-sheet #crumb span { display: inline-block; min-width: 44px; min-height: 44px; line-height: 44px; padding: 0 6px; text-align: center; box-sizing: border-box; }
html.vrg-phone #vp-sheet #crumb i { margin: 0 2px; }
html.vrg-phone #vp-sheet #qwrap { flex: 0 0 auto; min-width: 0; }
html.vrg-phone #vp-sheet #q { width: 100%; font-size: 16px; }
html.vrg-phone #vp-sheet #qres { position: static; margin-top: 4px; max-height: none; }
html.vrg-phone #vp-sheet #qres li { min-height: 44px; align-items: center; }
html.vrg-phone #vp-sheet #lenses { display: flex; flex-direction: row; flex-wrap: wrap; align-items: flex-start; gap: 8px 14px; padding: 8px; }
html.vrg-phone #vp-sheet #lenses .grp { display: flex; flex-wrap: wrap; gap: 4px 6px; align-items: center; max-width: 100%; }
html.vrg-phone #vp-sheet #lenses small { display: block; flex: 0 0 100%; margin: 0; }
html.vrg-phone #vp-sheet #lenses kbd { display: none; }
html.vrg-phone #vp-sheet #timeline { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px; border: 1px solid var(--line, #333); }
html.vrg-phone #vp-sheet #timeline[hidden] { display: none !important; }
html.vrg-phone #vp-sheet #timeline select { max-width: 100%; }
html.vrg-phone #vp-sheet #tl-track { flex: 1 0 100%; height: 44px; }
html.vrg-phone #vp-sheet #tl-pos { display: inline; min-width: 0; text-align: left; }
html.vrg-phone #vp-sheet #legend { padding: 8px 10px; }
html.vrg-phone #vp-sheet #legend .ramp { max-width: 100%; }
html.vrg-phone #vp-sheet #now .l { white-space: normal; }
html.vrg-phone #vp-sheet #bar { display: flex; flex-wrap: wrap; gap: 6px; padding: 0; border: 0; }
html.vrg-phone #vp-sheet #views { display: flex; flex-wrap: wrap; gap: 6px; }
html.vrg-phone #vp-sheet #fresh { align-self: center; }

html.vrg-phone #hud { left: 10px; right: 10px; bottom: 8px; max-width: none; white-space: nowrap; overflow: hidden;
  text-overflow: ellipsis; font-size: 11px; pointer-events: none; }
html.vrg-phone.vrg-land.vrg-open #hud { left: calc(min(400px, 55%) + 10px); }
html.vrg-phone #panel { top: 8px; right: 8px; width: min(340px, calc(100% - 16px)); max-height: calc(100% - 16px); overflow-y: auto; }
html.vrg-phone #panel .x, html.vrg-phone #tours .x, html.vrg-phone #sess-now .x { top: 0; right: 0; min-width: 44px; min-height: 44px;
  display: flex; align-items: center; justify-content: center; }
html.vrg-phone #tours { top: 8px; left: 8px; width: min(320px, calc(100% - 16px)); max-height: calc(100% - 16px); overflow-y: auto; }
html.vrg-phone #landinfo { left: 8px; bottom: 30px; width: min(380px, calc(100% - 16px)); max-height: 40%; }
html.vrg-phone #caption { bottom: 30px; width: calc(100% - 16px); }
html.vrg-phone #sess-now { top: 8px; left: 8px; width: calc(100% - 16px); }
html.vrg-phone #sel-bar { top: 56px; max-width: calc(100% - 16px); flex-wrap: wrap; }
html.vrg-phone #filep { top: 56px; left: 0; right: 0; bottom: 0; width: 100%; }
html.vrg-phone #kv-menu { max-width: calc(100% - 16px); }
`;
  const style = document.createElement('style');
  style.id = 'vp-style';
  style.textContent = CSS;
  document.head.append(style);

  // ---- the row and the sheet ------------------------------------------------------------------------------
  const top = document.createElement('div');
  top.id = 'vp-top';
  top.innerHTML = '<button id="vp-menu" type="button" aria-label="Menü: keresés, nézetek, idővonal" aria-expanded="false">☰</button>'
    + '<button id="vp-status" type="button" aria-label="Menü"><b id="vp-l1"></b><span id="vp-l2"></span></button>'
    + '<button id="vp-back" type="button" aria-label="Előző commit">⏮</button>'
    + '<button id="vp-play" type="button" aria-label="Lejátszás">▶</button>'
    + '<button id="vp-step" type="button" aria-label="Következő commit">⏭</button>';
  const sheet = document.createElement('div');
  sheet.id = 'vp-sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-label', 'Kódváros menü');
  bar.before(top);
  document.body.append(sheet);

  // what moves into the sheet, in this order, with a heading before some of them
  const MOVE = [['crumb', ''], ['qwrap', ''], ['lenses', 'Nézetek'], ['timeline', 'Idővonal'], ['legend', ''], ['now', ''], ['bar', 'Eszközök']];
  const homes = new Map();   // id -> the comment left at its old place
  const heads = new Map();
  for (const [id, h] of MOVE) {
    if (!h) continue;
    const e = document.createElement('h5'); e.textContent = h; e.dataset.for = id; heads.set(id, e);
  }
  function moveIn() {
    for (const [id] of MOVE) {
      const el = $(id);
      if (!el || el.parentNode === sheet) continue;
      if (!homes.has(id) || !homes.get(id).isConnected) {
        const mark = document.createComment('vrg-phone:' + id);
        el.before(mark);
        homes.set(id, mark);
      }
      sheet.append(...(heads.has(id) ? [heads.get(id), el] : [el]));
    }
    // keep the sheet's order whatever came late (the crumb and the ribbon are made after the first frames)
    for (const [id] of MOVE) { const el = $(id); if (el && el.parentNode === sheet) sheet.append(...(heads.has(id) ? [heads.get(id), el] : [el])); }
    syncHeads();
  }
  function moveOut() {
    for (const [id, mark] of homes) {
      const el = $(id);
      if (el && mark.isConnected) mark.replaceWith(el);
      else mark.remove();
    }
    homes.clear();
    for (const h of heads.values()) h.remove();
  }
  // a heading only shows when its section does
  function syncHeads() {
    for (const [id, h] of heads) { const el = $(id); put(h, 'hidden', !el || el.hidden || el.parentNode !== sheet); }
  }
  // change a property only when it differs: every write is a mutation the observer below would see again
  function put(el, key, v) { if (el[key] !== v) el[key] = v; }

  // ---- open / close ----------------------------------------------------------------------------------------
  const isOpen = () => root.classList.contains('vrg-open');
  function setOpen(on) {
    if (on === isOpen()) return;
    root.classList.toggle('vrg-open', on);
    $('vp-menu').setAttribute('aria-expanded', String(on));
    if (on) { syncHeads(); requestAnimationFrame(() => dispatchEvent(new Event('resize'))); }   // the timeline strip redraws at its new width
    else if (document.activeElement && sheet.contains(document.activeElement)) document.activeElement.blur();
  }
  $('vp-menu').addEventListener('click', () => setOpen(!isOpen()));
  $('vp-status').addEventListener('click', () => setOpen(!isOpen()));
  const mirror = (ours, theirs) => $(ours).addEventListener('click', () => { const b = $(theirs); if (b) b.click(); });
  mirror('vp-back', 'tl-back'); mirror('vp-play', 'tl-play'); mirror('vp-step', 'tl-step');

  // a finger (or a click) outside the row and the sheet closes it and does nothing else
  addEventListener('pointerdown', e => {
    if (!isOpen() || !root.classList.contains('vrg-phone')) return;
    if (top.contains(e.target) || sheet.contains(e.target)) return;
    if (e.target.closest && e.target.closest('#panel, #tours, #kv-menu, #pal, #filep, #kv-toast')) return;
    setOpen(false);
    e.stopImmediatePropagation();
    if (e.cancelable) e.preventDefault();
  }, true);
  addEventListener('keydown', e => { if (e.key === 'Escape' && isOpen()) setOpen(false); }, true);
  // in portrait the sheet covers the city: a choice that changes the view closes it so the change is visible
  sheet.addEventListener('click', e => {
    if (root.classList.contains('vrg-land')) return;
    const t = e.target;
    if (t.closest('#lenses button, #views button, #qres li, #crumb span, #plan-btn, #tour-btn, #news-btn, #metro-btn, #jobs-btn, #hall-btn')) setTimeout(() => setOpen(false), 0);
  });

  // ---- the status row ----------------------------------------------------------------------------------------
  const txt = el => (el && (el.dataset.text || el.textContent) || '').trim();
  let queued = 0;
  function status() {
    queued = 0;
    const a = txt($('board-1')), b = txt($('board-2'));
    put($('vp-l1'), 'textContent', [a, b].filter(Boolean).join(' · ') || 'Kódváros');
    const c = $('crumb');
    const parts = c ? [...c.querySelectorAll('span')].map(s => s.textContent.trim()).filter(Boolean) : [];
    put($('vp-l2'), 'textContent', parts.length > 3 ? '… › ' + parts.slice(-3).join(' › ') : parts.join(' › '));
    const tl = $('timeline'), play = $('tl-play');
    const noTl = !tl || tl.hidden || !play || play.hidden;
    for (const id of ['vp-back', 'vp-play', 'vp-step']) put($(id), 'hidden', noTl);
    if (play) { put($('vp-play'), 'textContent', play.textContent.trim() || '▶'); put($('vp-play'), 'title', play.title || ''); }
    syncHeads();
  }
  const later = () => { if (!queued) queued = requestAnimationFrame(status); };
  const watch = new MutationObserver(recs => {
    recs = recs.filter(r => !top.contains(r.target) && !(r.target.parentNode === sheet && r.target.tagName === 'H5'));
    if (!recs.length) return;
    // a child of <body> made later (the breadcrumb, the ribbon): into the sheet with it
    if (root.classList.contains('vrg-phone') && recs.some(r => r.type === 'childList' && r.target === document.body
      && [...r.addedNodes].some(n => n.id && MOVE.some(m => m[0] === n.id)))) moveIn();
    later();
  });
  watch.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['data-text', 'hidden'] });

  // ---- phone or not ------------------------------------------------------------------------------------------
  // The window's size alone is not enough: a mobile browser whose page is wider than the screen zooms out
  // and reports the page's width (Kódváros's header made it 1144 px on a 412 px phone), so the screen counts too.
  function layout() {
    const sw = screen.width || innerWidth, sh = screen.height || innerHeight;
    const phone = Math.min(innerWidth, innerHeight) <= 600 || Math.min(sw, sh) <= 600;
    const was = root.classList.contains('vrg-phone');
    root.classList.toggle('vrg-phone', phone);
    // on a phone the screen says which way it is held: the keyboard opening for the search shrinks the window
    // until it looks wider than high, and the sheet must not jump to the side under the finger
    root.classList.toggle('vrg-land', phone && (Math.min(sw, sh) <= 600 ? sw > sh : innerWidth > innerHeight));
    if (phone && !was) moveIn();
    if (!phone && was) { setOpen(false); moveOut(); }
    status();
  }
  addEventListener('resize', layout);
  layout();
  // the app's Back: closes the sheet when it is open (true), otherwise leaves Back to the app (false)
  const back = () => { if (!isOpen()) return false; setOpen(false); return true; };
  window.__vrgPhone = { version: 1, open: setOpen, layout, back };
})();
