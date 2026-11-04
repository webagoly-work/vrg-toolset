// WP-08 probe (real Electron, temp home set by main.js): Ctrl+Shift+P opens the palette, typing "planner" gives a first row that is
// the one the matcher picks from the real index, the views are hidden while it is open and shown after Esc, a refused id stays refused.
'use strict';
module.exports = async function probe({ win }) {
  const errors = [];
  const { frame, views, palette } = win.desk;
  const lib = require('../lib/palette.js');
  const fjs = code => frame.webContents.executeJavaScript(code);
  const wait = async (f, ms = 8000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) { try { if (await f()) return true; } catch (e) {} await new Promise(r => setTimeout(r, 50)); }
    return false;
  };
  if (!(await wait(() => fjs(`document.body && document.body.dataset.ready === '1' && !!window.VRGPalette`)))) return { ok: false, errors: ['frame did not become ready'] };
  if (!(await wait(() => views.has('home')))) errors.push('no Kezdőlap view to hide');
  const isOpen = () => fjs(`!!window.VRGPalette && VRGPalette.isOpen()`);

  if (views.isHidden()) errors.push('views hidden before the palette opened');
  await fjs(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'P', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true }))`);
  if (!(await wait(isOpen))) return { ok: false, errors: [...errors, 'Ctrl+Shift+P did not open the palette'] };
  if (!(await wait(() => views.isHidden()))) errors.push('the views were not hidden while the palette was open');

  // wait for the index, then type
  if (!(await wait(() => fjs(`document.querySelectorAll('[data-role="palette-list"] li').length >= 30`)))) errors.push('the palette list stayed under 30 rows');
  await fjs(`(() => { const i = document.querySelector('[data-role="palette-input"]'); i.value = 'planner'; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  const first = await fjs(`(() => { const li = document.querySelector('[data-role="palette-list"] li'); return li ? li.dataset.id : ''; })()`);
  const want = lib.search(palette.index(), 'planner', palette.recent())[0];
  if (!first) errors.push('no row for "planner"');
  else if (!want || want.id !== first) errors.push('first row ' + first + ' != matcher ' + JSON.stringify(want && want.id));
  const placeholder = await fjs(`document.querySelector('[data-role="palette-input"]').placeholder`);
  if (placeholder !== 'Parancs keresése…') errors.push('placeholder: ' + placeholder);

  // nothing found → the Hungarian line
  await fjs(`(() => { const i = document.querySelector('[data-role="palette-input"]'); i.value = 'klod'; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  const none = await fjs(`document.querySelector('[data-role="palette-status"]').textContent`);
  if (none !== 'Nincs találat') errors.push('empty result text: ' + none);

  // Esc closes and the views come back
  await fjs(`document.querySelector('[data-role="palette-input"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))`);
  if (!(await wait(async () => !(await isOpen())))) errors.push('Esc did not close the palette');
  if (!(await wait(() => !views.isHidden()))) errors.push('the views stayed hidden after the palette closed');

  // the channels: a refused id, and a pane command reaching the frame
  let r = await fjs(`window.vrg.layout.run('x:y')`);
  if (!r || r.ok !== false) errors.push('run(x:y) not refused: ' + JSON.stringify(r));
  r = await fjs(`window.vrg.layout.run('pane:nope')`);
  if (!r || r.ok !== false) errors.push('run(pane:nope) not refused: ' + JSON.stringify(r));
  const before = await fjs(`VRGFrame.panes().length`);
  r = await fjs(`window.vrg.layout.run('pane:files')`);
  if (!r || r.ok !== true) errors.push('run(pane:files): ' + JSON.stringify(r));
  else if (!(await wait(async () => (await fjs(`VRGFrame.panes().length`)) === before + 1))) errors.push('pane:files did not open a pane');
  r = await fjs(`window.vrg.layout.palette()`);
  if (!r || r.ok !== true || !r.keymap || r.keymap.palette !== 'Ctrl+Shift+P' || !Array.isArray(r.items) || r.items.length < 30) errors.push('palette(): ' + JSON.stringify(r && { ok: r.ok, keymap: r.keymap, n: r.items && r.items.length }));

  // leave the temp home with the default tree
  const L = require('../lib/layout.js');
  await fjs(`window.vrg.layout.set(${JSON.stringify(L.defaultTree())})`);
  return { ok: !errors.length, errors };
};
