// WP-07 probe (real Electron, temp home set by main.js): the frame loads, the Kezdőlap view exists with ≥ 30 act ids,
// the frame reports its rect, layout.set → reload gives the same tree, bad trees are refused, a closed Kezdőlap pane removes its view.
'use strict';
module.exports = async function probe({ win }) {
  const errors = [];
  const { frame, views } = win.desk;
  const fjs = code => frame.webContents.executeJavaScript(code);
  const wait = async (f, ms = 8000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) { try { if (await f()) return true; } catch (e) {} await new Promise(r => setTimeout(r, 100)); }
    return false;
  };
  const ready = () => wait(() => fjs(`document.body && document.body.dataset.ready === '1'`));
  const reload = async () => { frame.webContents.reload(); await new Promise(r => setTimeout(r, 300)); return ready(); };

  if (!(await ready())) return { ok: false, errors: ['frame did not become ready'] };

  const n = await fjs(`({ groups: document.querySelectorAll('[data-role="group"]').length, tabs: document.querySelectorAll('[data-role="tabs"]').length,
    home: !!document.querySelector('[data-pane="home"][data-kind="home"]'), wbar: !!document.querySelector('[data-role="wbar"]') })`);
  if (n.groups !== 2 || n.tabs !== 2 || !n.home || !n.wbar) errors.push('frame structure: ' + JSON.stringify(n));

  const home = views.get('home');
  if (!home) errors.push('no Kezdőlap view');
  else {
    const hw = home.webContents;
    const acts = async () => { try { return await hw.executeJavaScript(`document.querySelectorAll('[data-act]').length`); } catch (e) { return 0; } };
    if (!(await wait(async () => (await acts()) >= 30))) errors.push('Kezdőlap data-act count ' + await acts() + ' < 30');
    if (await hw.executeJavaScript(`typeof window.vrg && typeof window.vrg.layout`) !== 'object') errors.push('Kezdőlap view lacks vrg.layout');
  }
  if (!(await wait(() => { const r = views.rect('home'); return r && r.w > 100 && r.h > 100; }))) errors.push('frame did not report a rect: ' + JSON.stringify(views.rect('home')));

  // layout.set, reload → the same tree
  const custom = { v: 1, root: { dir: 'v', ratio: 0.3,
    a: { active: 1, items: [{ id: 'p1', kind: 'empty', state: {} }, { id: 'home', kind: 'home', state: {} }] },
    b: { active: 0, items: [{ id: 'empty-9', kind: 'empty', state: { k: 'v' } }] } } };
  let r = await fjs(`window.vrg.layout.set(${JSON.stringify(custom)})`);
  if (!r || r.ok !== true) errors.push('layout.set: ' + JSON.stringify(r));
  if (!(await reload())) errors.push('frame not ready after reload');
  else {
    r = await fjs(`window.vrg.layout.get()`);
    if (!r || r.ok !== true || JSON.stringify(r.tree) !== JSON.stringify(custom)) errors.push('tree changed over reload: ' + JSON.stringify(r));
  }

  // bad trees never reach the settings
  r = await fjs(`window.vrg.layout.set({ v: 1, root: { active: 0, items: [{ id: 'a', kind: 'nope', state: {} }] } })`);
  if (!r || r.ok !== false || r.err !== 'bad-request') errors.push('bad tree accepted: ' + JSON.stringify(r));
  r = await fjs(`window.vrg.layout.bounds('evil', { x: 0, y: 0, w: 1, h: 1 })`);
  if (!r || r.ok !== false) errors.push('unknown view accepted: ' + JSON.stringify(r));
  r = await fjs(`window.vrg.layout.bounds('home', { x: 0, y: 0, w: 1, h: 1, extra: 1 })`);
  if (!r || r.ok !== false) errors.push('bad rect accepted: ' + JSON.stringify(r));

  // the Kezdőlap pane closes → its view is removed
  const noHome = { v: 1, root: { active: 0, items: [{ id: 'empty-1', kind: 'empty', state: {} }] } };
  r = await fjs(`window.vrg.layout.set(${JSON.stringify(noHome)})`);
  if (!r || r.ok !== true) errors.push('layout.set (no home): ' + JSON.stringify(r));
  if (views.has('home')) errors.push('the view survived its pane');

  // leave the temp home with the default tree and the view back
  const lib = require('../lib/layout.js');
  r = await fjs(`window.vrg.layout.set(${JSON.stringify(lib.defaultTree())})`);
  if (!r || r.ok !== true) errors.push('layout.set (default): ' + JSON.stringify(r));
  if (!(await reload())) errors.push('frame not ready after the final reload');
  else if (!(await wait(() => views.has('home')))) errors.push('the view did not come back with its pane');
  return { ok: !errors.length, errors };
};
