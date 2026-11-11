// WP-47 probe (real Electron): the Archívum section of the Dashboard view and the archive app in-shell. At User the section lists the
// VRG entries first with the ice edge (computed style), Egyéb switches to the warm ones; a card opens the archive app on the Desktop
// view at that entry (vrg-app://archive/…#<id>); the shell refuses a path-looking id. The add dialog is never opened (selftest).
// VRG_SHOTS=<folder>: also writes archive-section.png and archive-app.png.
'use strict';
const fs = require('fs'), path = require('path');
module.exports = async function probe({ win }) {
  const errors = [], info = {};
  const { frame } = win.desk;
  const W = frame.webContents;
  const fjs = code => W.executeJavaScript(code);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const wait = async (f, ms = 8000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await f()) return true; } catch (e) {} await sleep(100); } return false; };
  const SHOTS = process.env.VRG_SHOTS || '';
  frame.setPosition(-4000, 0); frame.setSize(1600, 1000); frame.showInactive();
  const shot = async (name, wc) => { if (!SHOTS) return; await sleep(600); fs.mkdirSync(SHOTS, { recursive: true }); const img = await (wc || W).capturePage(); fs.writeFileSync(path.join(SHOTS, name), img.toPNG()); };

  if (!(await wait(() => fjs(`!!(window.VRGDesk && window.VRGDesk.state().ready)`), 12000))) return { ok: false, errors: ['the VRG Asztal did not become ready'] };
  await fjs(`window.VRGDesk.setView('dashboard'); window.VRGDesk.setLevel('user')`);
  if (!(await wait(() => fjs(`document.querySelectorAll('#sec-archivum .arch').length > 0`)))) return { ok: false, errors: ['no Archívum cards at User'] };
  await fjs(`document.getElementById('sec-archivum').scrollIntoView()`);
  const cards = () => fjs(`[...document.querySelectorAll('#sec-archivum .arch')].map(c => ({ id: c.dataset.arch, o: c.classList.contains('o'), edge: getComputedStyle(c).borderLeftColor }))`);
  let c = await cards();
  info.vrg = c.length;
  if (c.some(x => x.o)) errors.push('the VRG tab shows other projects');
  const ice = c[0] && c[0].edge;
  if (ice !== 'rgb(147, 211, 230)') errors.push('a VRG card edge is not ice: ' + ice);
  await shot('archive-section.png');
  await fjs(`document.querySelector('#sec-archivum [data-scope="other"]').click()`);
  await sleep(150);
  c = await cards();
  info.other = c.length;
  if (!c.length || c.some(x => !x.o)) errors.push('Egyéb does not show only the other projects');
  if (c[0] && c[0].edge !== 'rgb(232, 168, 115)') errors.push('an other card edge is not warm: ' + c[0].edge);
  await fjs(`document.querySelector('#sec-archivum [data-scope="vrg"]').click()`);
  await sleep(150);

  const bad = await fjs(`window.vrg.call('archive', 'show', { id: '../x' })`);
  if (bad.ok !== false || bad.err !== 'bad-request') errors.push('a path-looking id was accepted: ' + JSON.stringify(bad));
  const none = await fjs(`window.vrg.archive.show('no-such-entry')`);
  if (none.ok !== false || none.err !== 'not-found') errors.push('an unknown entry was accepted: ' + JSON.stringify(none));
  const add = await fjs(`window.vrg.archive.add({ title: 'x' })`);
  if (add.ok !== false || add.err !== 'selftest') errors.push('add opened a dialog in a selftest: ' + JSON.stringify(add));

  // a card → the archive app on the Desktop view, at that entry
  const id = await fjs(`document.querySelector('#sec-archivum .arch').dataset.arch`);
  await fjs(`document.querySelector('#sec-archivum .arch .am').click()`);
  const appView = () => { const v = win.desk.views && win.desk.views.get ? win.desk.views.get('app:archive') : null; return v && !v.webContents.isDestroyed() ? v.webContents : null; };
  const opened = await wait(() => fjs(`window.VRGDesk.view() === 'desktop'`) && appView() && /^vrg-app:\/\/archive\//.test(appView().getURL()), 10000);
  if (!opened) errors.push('the archive app did not open in-shell');
  else {
    const A = appView();
    info.url = A.getURL();
    if (!A.getURL().endsWith('#' + id)) errors.push('the app did not open at the entry: ' + A.getURL());
    const ok = await wait(() => A.executeJavaScript(`!!(window.VRGArchive && window.VRGArchive.state().sel === ${JSON.stringify(id)} && document.querySelector('.detail h2'))`), 6000);
    if (!ok) errors.push('the archive page did not select ' + id);
    info.items = await A.executeJavaScript(`window.VRGArchive.items().length`).catch(() => 0);
    try { await shot('archive-app.png', A); } catch (e) { info.shot = 'app view not capturable off-screen'; }
  }
  return { ok: !errors.length, errors, info };
};
