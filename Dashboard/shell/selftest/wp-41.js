// WP-41 … WP-43 probe (real Electron, temp home set by main.js): the VRG Asztal's two primary views.
//   Dashboard view at User / Dev / All (sections, dev items attached under their parent tile), the level switch, double Tab
//   (sent as real key events) toggles the views and is ignored in a text field, the Desktop view (top strip, dock, ◣ and ◢ dials),
//   an HTML app opened in-shell on vrg-app:// with working localStorage and a refused path outside its folder, the boot flow.
// VRG_SHOTS=<folder>: also writes the screenshots there (dash-user.png, dash-dev.png, dash-all.png, desk-sui.png, desk-stack.png,
// desk-app.png + app-view.png). Colours are read from computed styles, not from the pictures.
'use strict';
const fs = require('fs'), path = require('path');
module.exports = async function probe({ win }) {
  const errors = [], info = {};
  const { frame, views } = win.desk;
  const W = frame.webContents;
  const fjs = code => W.executeJavaScript(code);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const wait = async (f, ms = 8000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await f()) return true; } catch (e) {} await sleep(100); } return false; };
  const SHOTS = process.env.VRG_SHOTS || '';
  const real = typeof win.setPosition === 'function' ? win : frame;            // the window itself, not the Proxy's page
  frame.setPosition(-4000, 0); frame.setSize(1600, 1000); frame.showInactive(); // shown off-screen: CSS animations and repaints run
  const shot = async name => { if (!SHOTS) return; await sleep(450); fs.mkdirSync(SHOTS, { recursive: true }); const img = await W.capturePage(); fs.writeFileSync(path.join(SHOTS, name), img.toPNG()); };
  const tab2 = async () => { for (let i = 0; i < 2; i++) { W.sendInputEvent({ type: 'keyDown', keyCode: 'Tab' }); W.sendInputEvent({ type: 'keyUp', keyCode: 'Tab' }); await sleep(60); } await sleep(500); };

  if (!(await wait(() => fjs(`!!(window.VRGDesk && window.VRGDesk.state().ready)`), 12000))) return { ok: false, errors: ['the VRG Asztal did not become ready: ' + JSON.stringify(await fjs(`window.VRGDesk && window.VRGDesk.state()`).catch(() => null))] };
  const st0 = await fjs(`window.VRGDesk.state()`);
  if (st0.auth !== false || st0.boot !== 'ready') errors.push('boot with auth off should go straight to ready: ' + JSON.stringify(st0));
  if (await fjs(`!document.querySelector('[data-role="boot"]').hidden`)) errors.push('the boot screen is still shown');

  // ---- Dashboard view at User
  await fjs(`window.VRGDesk.setView('dashboard'); window.VRGDesk.setLevel('user')`);
  await wait(() => fjs(`document.body.dataset.level === 'user' && !!document.querySelector('#sec-apps')`));
  const secs = () => fjs(`[...document.querySelectorAll('.dash-sec')].map(s => s.dataset.section)`);
  let s = await secs();
  if (JSON.stringify(s) !== JSON.stringify(['ma', 'apps', 'programok', 'munkak', 'allapot'])) errors.push('user sections: ' + JSON.stringify(s));
  const userTiles = await fjs(`[...document.querySelectorAll('#sec-apps .tile')].map(t => t.dataset.id)`);
  for (const id of ['planner', 'inventory', 'calc-panel', 'files', 'web', 'mail', 'console']) if (!userTiles.includes(id)) errors.push('user tile missing: ' + id);
  for (const id of ['codecity', 'stack', 'term', 'git']) if (userTiles.includes(id)) errors.push('dev tile at user level: ' + id);
  if (await fjs(`!!document.querySelector('.tile[data-id="planner"] [data-act="s:P/B"]')`)) errors.push('Planner build shown at user level');
  info.userTiles = userTiles.length;
  const look = await fjs(`(() => { const c = s => getComputedStyle(document.querySelector(s)); return { bg: c('[data-role="dashboard"]').backgroundColor, h2: c('#sec-apps > h2').color, tile: c('.tile').borderTopStyle }; })()`);
  if (look.bg !== 'rgb(10, 20, 28)') errors.push('dashboard background is not --mv-bg: ' + look.bg);
  if (look.h2 !== 'rgb(147, 211, 230)') errors.push('section heading is not --mv-accent: ' + look.h2);
  info.look = look;
  await shot('dash-user.png');

  // ---- Dev: more sections, dev items attached under their parent
  await fjs(`window.VRGDesk.setLevel('dev')`);
  await wait(() => fjs(`document.body.dataset.level === 'dev' && !!document.querySelector('#sec-vonalak')`));
  s = await secs();
  for (const id of ['vonalak', 'stack', 'ugynokok', 'szerverek', 'meroszamok']) if (!s.includes(id)) errors.push('dev section missing: ' + id);
  if (s.includes('katalogus')) errors.push('catalog section at dev level');
  const att = await fjs(`[...document.querySelectorAll('.tile[data-id="planner"] [data-role="attached"] [data-act], .tile[data-id="planner"] [data-role="attached"] [data-server], .tile[data-id="planner"] [data-role="attached"] [data-child]')].map(b => b.dataset.act || b.dataset.server || b.dataset.child)`);
  for (const a of ['s:P/B', 's:P/T', 'planner', 'gyro', 'client-preview']) if (!att.includes(a)) errors.push('Planner attached row missing at dev: ' + a + ' in ' + JSON.stringify(att));
  if (await fjs(`getComputedStyle(document.querySelector('#sec-stack .tile')).borderTopStyle`) !== 'dashed') errors.push('a dev tile is not dashed');
  await shot('dash-dev.png');

  // ---- All: the catalog table, filterable
  await fjs(`window.VRGDesk.setLevel('all')`);
  await wait(() => fjs(`!!document.querySelector('#sec-katalogus table.cat')`));
  const rows = await fjs(`document.querySelectorAll('#sec-katalogus tbody tr').length`);
  if (rows < 80) errors.push('catalog rows ' + rows);
  await fjs(`(() => { const i = document.querySelector('[data-role="catalog-filter"]'); i.value = 'kalkulator'; i.dispatchEvent(new Event('input')); })()`);
  const filtered = await fjs(`[...document.querySelectorAll('#sec-katalogus tbody tr')].map(r => r.dataset.id)`);
  if (!filtered.includes('calc-panel') || filtered.length > 6) errors.push('catalog filter "kalkulator": ' + JSON.stringify(filtered));
  await fjs(`(() => { const i = document.querySelector('[data-role="catalog-filter"]'); i.value = ''; i.dispatchEvent(new Event('input')); document.querySelector('#sec-katalogus').scrollIntoView(); })()`);
  await shot('dash-all.png');
  await fjs(`document.querySelector('[data-role="dashboard"]').scrollTop = 0; window.VRGDesk.setLevel('user')`);
  await wait(() => fjs(`document.body.dataset.level === 'user'`));

  // ---- double Tab toggles (real key events through before-input-event), but not in a text field
  await fjs(`window.VRGDesk.setView('dashboard'); document.activeElement && document.activeElement.blur && document.activeElement.blur(); 1`);
  await tab2();
  if (await fjs(`window.VRGDesk.view()`) !== 'desktop') errors.push('double Tab did not switch to the Desktop view');
  await tab2();
  if (await fjs(`window.VRGDesk.view()`) !== 'dashboard') errors.push('double Tab did not switch back');
  await fjs(`window.VRGDesk.setLevel('all')`); await sleep(300);
  await fjs(`document.querySelector('[data-role="catalog-filter"]').focus()`);
  await tab2();
  if (await fjs(`window.VRGDesk.view()`) !== 'dashboard') errors.push('double Tab in a text field toggled the view');
  await fjs(`document.activeElement.blur(); window.VRGDesk.setLevel('user')`); await sleep(300);
  // slow taps (> 350 ms apart) do nothing
  W.sendInputEvent({ type: 'keyDown', keyCode: 'Tab' }); W.sendInputEvent({ type: 'keyUp', keyCode: 'Tab' }); await sleep(500);
  W.sendInputEvent({ type: 'keyDown', keyCode: 'Tab' }); W.sendInputEvent({ type: 'keyUp', keyCode: 'Tab' }); await sleep(400);
  if (await fjs(`window.VRGDesk.view()`) !== 'dashboard') errors.push('two slow Tabs toggled the view');
  // the corner toggle
  await fjs(`document.querySelector('[data-role="view-toggle"]').click()`);
  if (await fjs(`window.VRGDesk.view()`) !== 'desktop') errors.push('the corner toggle did not switch');

  // ---- Desktop view: top strip, dock, dials
  const d = await fjs(`({ top: [...document.querySelectorAll('[data-role="topstrip"] [data-w]')].map(e => e.dataset.w), dock: [...document.querySelectorAll('[data-role="dock"] button[data-id]')].map(b => b.dataset.id),
    left: !!document.querySelector('.sui[data-side="left"] .sui-dial'), right: !!document.querySelector('.sui[data-side="right"] .sui-dial'),
    dialBox: (() => { const r = document.querySelector('.sui[data-side="left"]').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), Math.round(r.left), Math.round(innerHeight - r.bottom)]; })() })`);
  for (const w of ['w:clock', 'w:search', 'w:servers', 'w:git', 'w:backup']) if (!d.top.includes(w)) errors.push('top strip missing ' + w);
  for (const id of ['planner', 'files', 'web']) if (!d.dock.includes(id)) errors.push('dock missing ' + id);
  if (d.dock.includes('term')) errors.push('dev item in the user dock');
  if (!d.left || !d.right) errors.push('a corner dial is missing');
  if (JSON.stringify(d.dialBox) !== '[88,88,0,0]') errors.push('left dial box (w,h,left,bottom) = ' + JSON.stringify(d.dialBox));
  info.desktop = d;
  info.bottom = await fjs(`(() => { const e = document.elementFromPoint(800, innerHeight - 4); return { tag: e && e.tagName, role: e && (e.dataset.role || e.id || e.className), ih: innerHeight, sh: document.documentElement.scrollHeight, bh: document.body.getBoundingClientRect().height, desk: Math.round(document.querySelector('[data-role="desktop"]').getBoundingClientRect().bottom) }; })()`);
  // ◣ open: ≤ 5 rows, the root shows the function groups + Bezár; 1 enters Munka
  await fjs(`document.querySelector('.sui[data-side="left"] .sui-dial').click()`);
  let sui = await fjs(`window.VRGDesk.sui.state()`);
  if (!sui.open || sui.rows.length > 5 || sui.rows[sui.rows.length - 1] !== '✕ BEZÁR') errors.push('sui root: ' + JSON.stringify(sui));
  if (JSON.stringify(sui.rows.slice(0, 4)) !== JSON.stringify(['Munka', 'Alkalmazások', 'Fájlok', 'Rendszer'])) errors.push('sui root groups (user): ' + JSON.stringify(sui.rows));
  await fjs(`window.VRGDesk.sui.key('1')`);
  sui = await fjs(`window.VRGDesk.sui.state()`);
  if (sui.depth !== 1 || sui.path[0] !== 'Munka') errors.push('sui key 1: ' + JSON.stringify(sui));
  info.suiMunka = sui.rows;
  const look2 = await fjs(`(() => { const i = document.querySelector('.sui-item'); const c = getComputedStyle(i); return { h: Math.round(i.getBoundingClientRect().height), w: Math.round(i.getBoundingClientRect().width), ink: c.color }; })()`);
  if (look2.h < 48 || look2.w !== 248 || look2.ink !== 'rgb(28, 40, 51)') errors.push('sui item geometry / ink: ' + JSON.stringify(look2));
  await shot('desk-sui.png');
  // type-to-search
  await fjs(`window.VRGDesk.sui.key('Escape'); window.VRGDesk.sui.key('k'); window.VRGDesk.sui.key('a'); window.VRGDesk.sui.key('l')`);
  sui = await fjs(`window.VRGDesk.sui.state()`);
  if (sui.query !== 'kal' || !sui.rows.some(r => /kalkulátor/i.test(r))) errors.push('sui search "kal": ' + JSON.stringify(sui));
  await fjs(`window.VRGDesk.sui.close()`);
  // ◢ the Stack dial: User shows F, I, Q + Keresés
  await fjs(`document.querySelector('.sui[data-side="right"] .sui-dial').click()`);
  const stk = await fjs(`window.VRGDesk.stack.state()`);
  if (!stk.open || !/^F ·/.test(stk.rows[0]) || !/^I ·/.test(stk.rows[1]) || !/^Q ·/.test(stk.rows[2])) errors.push('stack dial (user): ' + JSON.stringify(stk));
  const right = await fjs(`(() => { const r = document.querySelector('.sui[data-side="right"] .sui-col').getBoundingClientRect(); return Math.round(innerWidth - r.right); })()`);
  if (right !== 20) errors.push('stack column not mirrored to the right (gap ' + right + ')');
  await shot('desk-stack.png');
  await fjs(`window.VRGDesk.stack.close(); window.VRGDesk.setLevel('dev')`); await sleep(300);
  await fjs(`window.VRGDesk.stack.open()`);
  const stkDev = await fjs(`window.VRGDesk.stack.state()`);
  info.stackDev = stkDev.rows;
  if (!stkDev.rows.includes('TOVÁBB ›')) errors.push('stack dial (dev) should page the ten layers: ' + JSON.stringify(stkDev.rows));
  await fjs(`window.VRGDesk.stack.close(); window.VRGDesk.setLevel('user')`); await sleep(300);

  // ---- an HTML app in-shell on vrg-app://, localStorage works, nothing outside its folder is served
  let r = await fjs(`window.vrg.desktop.open('calc-panel')`);
  if (!r || r.do !== 'app' || r.id !== 'calc-panel') errors.push('open calc-panel: ' + JSON.stringify(r));
  await fjs(`window.VRGDesk.open('calc-panel')`);
  if (!(await wait(() => views.has('app:calc-panel'), 6000))) errors.push('no app view');
  else {
    const av = views.get('app:calc-panel').webContents;
    await wait(() => !av.isLoading(), 8000);
    const a = await av.executeJavaScript(`(() => { try { localStorage.setItem('vrg-probe', '1'); return { origin: location.origin, url: location.href, ls: localStorage.getItem('vrg-probe'), title: document.title, vrg: typeof window.vrg }; } catch (e) { return { err: String(e) }; } })()`);
    info.app = a;
    if (a.origin !== 'vrg-app://calc-panel' || a.ls !== '1') errors.push('app origin / localStorage: ' + JSON.stringify(a));
    if (a.vrg !== 'undefined') errors.push('the app view has window.vrg');
    const fetchCode = u => `fetch(${JSON.stringify(u)}).then(r => r.status).catch(e => 'ERR')`;
    const inside = await av.executeJavaScript(fetchCode('vrg-app://calc-panel/shared/melyviz.css'));
    const outside = await av.executeJavaScript(fetchCode('vrg-app://calc-panel/launcher/vrg-menu.json'));
    const up = await av.executeJavaScript(fetchCode('vrg-app://calc-panel/Calculator/../tools/anonymise.js'));
    if (inside !== 200) errors.push('shared/ not served to the app: ' + inside);
    if (outside === 200 || up === 200) errors.push('served outside the app folder: ' + outside + ' / ' + up);
    const rect = views.rect('app:calc-panel');
    if (!rect || rect.w < 400 || rect.h < 300) errors.push('app view rect ' + JSON.stringify(rect));
    const dockApp = await fjs(`!!document.querySelector('[data-role="dock"] button.win') && document.querySelector('[data-role="dock"] button[data-id="calc-panel"]') && document.querySelector('[data-role="dock"] button[data-id="calc-panel"]').dataset.running === '1'`);
    if (!dockApp) errors.push('the dock does not show the running app');
    await shot('desk-app.png');
    if (SHOTS) { try { const img = await av.capturePage(); fs.writeFileSync(path.join(SHOTS, 'app-view.png'), img.toPNG()); } catch (e) { info.appShot = 'not captured off-screen: ' + e.message; } }
    // double Tab over the app view (main's before-input-event path, not the frame's): Desktop → Dashboard, then back
    for (let i = 0; i < 2; i++) { av.sendInputEvent({ type: 'keyDown', keyCode: 'Tab' }); av.sendInputEvent({ type: 'keyUp', keyCode: 'Tab' }); await sleep(60); }
    if (!(await wait(() => fjs(`window.VRGDesk.view() === 'dashboard'`), 2000))) errors.push('double Tab over the app view did not toggle');
    await fjs(`window.VRGDesk.setView('desktop')`); await sleep(200);
    // ...but not while the app's focus is in a text field (the isolated-world recorder notes it before Tab moves the focus)
    const hasInput = await av.executeJavaScript(`(function(){var i=document.querySelector('input[type=number],input[type=text],input:not([type]),textarea');if(!i)return false;i.focus();return document.activeElement===i;})()`).catch(() => false);
    info.appInput = hasInput;
    if (hasInput) {
      for (let i = 0; i < 2; i++) { av.sendInputEvent({ type: 'keyDown', keyCode: 'Tab' }); av.sendInputEvent({ type: 'keyUp', keyCode: 'Tab' }); await sleep(60); }
      await sleep(500);
      if ((await fjs(`window.VRGDesk.view()`)) !== 'desktop') { errors.push('double Tab from a text field in the app view toggled'); await fjs(`window.VRGDesk.setView('desktop')`); await sleep(200); }
    }
    // the Dashboard view covers the workspace: the app view gets a zero rect
    await fjs(`window.VRGDesk.setView('dashboard')`);
    if (!(await wait(() => { const q = views.rect('app:calc-panel'); return q && q.w === 0; }, 3000))) errors.push('app view still shown over the Dashboard: ' + JSON.stringify(views.rect('app:calc-panel')));
    await fjs(`window.VRGDesk.setView('desktop')`);
  }
  // a catalog id that is not an app, an unknown id, a dev root
  r = await fjs(`window.vrg.desktop.open('files')`);
  if (!r || r.do !== 'pane' || r.kind !== 'files') errors.push('open files: ' + JSON.stringify(r));
  r = await fjs(`window.vrg.desktop.open('../../Windows')`);
  if (!r || r.ok !== false) errors.push('a path was accepted as a catalog id: ' + JSON.stringify(r));
  r = await fjs(`window.vrg.desktop.open('dev:repo')`);
  if (!r || r.ok !== false) errors.push('a dev root opened: ' + JSON.stringify(r));
  r = await fjs(`window.vrg.layout.bounds('app:nope', { x: 0, y: 0, w: 10, h: 10 })`);
  if (!r || r.ok !== false) errors.push('unknown app view accepted: ' + JSON.stringify(r));
  r = await fjs(`window.vrg.layout.bounds('app:client-preview', { x: 0, y: 0, w: 10, h: 10 })`);
  if (!r || r.ok !== false) errors.push('a non-owner app id got its own origin: ' + JSON.stringify(r));
  r = await fjs(`window.vrg.call('app', 'setting', { k: 'auth.enabled', v: true })`);
  if (!r || r.ok !== false || r.err !== 'forbidden') errors.push('the page switched the gate on: ' + JSON.stringify(r));
  // the palette knows the desk commands
  const pal = await fjs(`window.vrg.layout.palette().then(r => r.items.filter(i => i.kind === 'desk').map(i => i.id))`);
  if (!pal.includes('desk:toggle') || !pal.includes('desk:level:dev')) errors.push('palette desk commands: ' + JSON.stringify(pal));
  await fjs(`window.vrg.layout.palette({ open: false })`);
  r = await fjs(`window.vrg.layout.run('desk:view:dashboard')`); await sleep(300);
  if (await fjs(`window.VRGDesk.view()`) !== 'dashboard') errors.push('desk:view:dashboard did not switch: ' + JSON.stringify(r));

  // ---- the gate stub: with auth on the boot stops at the gate, TOVÁBB goes on
  await fjs(`(() => { const D = window.VRGDeskLib; return JSON.stringify([D.boot({ authEnabled: false }), D.boot({ authEnabled: true })]); })()`).then(v => { if (v !== '[["splash","ready"],["splash","gate","ready"]]') errors.push('boot steps ' + v); });

  // leave the temp home tidy
  await fjs(`window.vrg.layout.set(window.VRGLayoutLib.defaultTree())`);
  await fjs(`window.vrg.call('app', 'setting', { k: 'desk.view', v: 'dashboard' })`);
  return { ok: !errors.length, errors, info };
};
