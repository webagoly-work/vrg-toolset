// WP-45 probe (real Electron): the Programok section of the Dashboard view. At User the short set shows, ghosts are dashed and
// installed ones solid (computed styles), a click on a ghost ticks it and the Telepítés button counts it; page entries are not
// tickable; at Dev every program shows; the shell refuses an install above the saved level. Nothing is downloaded: a selftest's
// fetch refuses, and the probe never presses Telepítés. VRG_SHOTS=<folder>: also writes prog-user.png and prog-dev.png.
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
  const shot = async name => { if (!SHOTS) return; await sleep(450); fs.mkdirSync(SHOTS, { recursive: true }); const img = await W.capturePage(); fs.writeFileSync(path.join(SHOTS, name), img.toPNG()); };

  if (!(await wait(() => fjs(`!!(window.VRGDesk && window.VRGDesk.state().ready)`), 12000))) return { ok: false, errors: ['the VRG Asztal did not become ready'] };
  await fjs(`window.VRGDesk.setView('dashboard'); window.VRGDesk.setLevel('user')`);
  if (!(await wait(() => fjs(`document.querySelectorAll('#sec-programok .prog').length > 0`)))) return { ok: false, errors: ['no Programok cards at User'] };
  await fjs(`document.getElementById('sec-programok').scrollIntoView()`);

  const cards = () => fjs(`[...document.querySelectorAll('#sec-programok .prog')].map(c => ({ id: c.dataset.prog, st: c.dataset.state, lv: c.dataset.level }))`);
  let c = await cards();
  info.user = c.length;
  const want = ['sevenzip', 'notepadpp', 'everything', 'wiztree', 'crystaldiskinfo', 'hwinfo', 'sumatra', 'sharex', 'keepassxc', 'vlc', 'zen', 'operagx'];
  for (const id of want) if (!c.some(x => x.id === id)) errors.push('user program missing: ' + id);
  if (c.length !== want.length) errors.push('user shows ' + c.length + ' programs, expected ' + want.length);
  if (c.some(x => x.lv !== 'user')) errors.push('a dev program at User');
  const ghost = c.find(x => x.st === 'ghost'), page = c.find(x => x.st === 'page'), inst = c.find(x => x.st === 'installed');
  info.states = c.reduce((o, x) => ((o[x.st] = (o[x.st] || 0) + 1), o), {});
  if (!ghost) errors.push('no ghost at User (is everything installed?)');
  const style = id => fjs(`(() => { const e = document.querySelector('.prog[data-prog="${id}"]'); const s = getComputedStyle(e); return { b: s.borderTopStyle, o: getComputedStyle(e.querySelector('.pm')).opacity }; })()`);
  if (ghost) {
    const g = await style(ghost.id);
    if (g.b !== 'dashed' || Number(g.o) > 0.7) errors.push('a ghost is not drawn as a ghost: ' + JSON.stringify(g));
    await fjs(`document.querySelector('.prog[data-prog="${ghost.id}"] .pm').click()`);
    await sleep(150);
    const after = await fjs(`({ sel: document.querySelector('.prog[data-prog="${ghost.id}"]').dataset.selected, btn: document.querySelector('[data-role="prog-install"]').textContent, dis: document.querySelector('[data-role="prog-install"]').disabled, b: getComputedStyle(document.querySelector('.prog[data-prog="${ghost.id}"]')).borderTopStyle })`);
    if (after.sel !== '1' || after.btn !== 'Telepítés (1)' || after.dis || after.b !== 'solid') errors.push('ticking a ghost: ' + JSON.stringify(after));
    await shot('prog-user.png');
    await fjs(`document.querySelector('[data-role="prog-none"]').click()`);
    await sleep(100);
    if (await fjs(`document.querySelector('[data-role="prog-install"]').textContent`) !== 'Telepítés (0)') errors.push('Törlés did not clear the selection');
  }
  if (inst) { const s = await style(inst.id); if (s.b !== 'solid') errors.push('an installed program is not solid: ' + JSON.stringify(s)); }
  if (page) {
    if (await fjs(`document.querySelector('.prog[data-prog="${page.id}"] .pm').getAttribute('aria-pressed')`) !== null) errors.push('a page entry is tickable');
  }
  // the shell gates on the saved level: at User a dev program is refused
  const r = await fjs(`window.vrg.programs.install(['wireshark', 'rufus', 'nope'])`);
  if ((r.started || []).length || (r.skipped || []).map(s => s.why).join() !== 'unknown,unknown,unknown') errors.push('install above the level: ' + JSON.stringify(r));
  const bad = await fjs(`window.vrg.call('programs', 'install', { ids: ['../x'] })`);
  if (bad.ok !== false || bad.err !== 'bad-request') errors.push('a path-looking id was accepted: ' + JSON.stringify(bad));

  // Dev: everything
  await fjs(`window.VRGDesk.setLevel('dev')`);
  await wait(() => fjs(`document.querySelectorAll('#sec-programok .prog').length > ${want.length}`));
  c = await cards();
  info.dev = c.length;
  if (c.length < 70) errors.push('dev shows only ' + c.length + ' programs');
  for (const id of ['portablegit', 'node', 'vscode', 'pwsh', 'esptool', 'wireshark']) if (!c.some(x => x.id === id)) errors.push('dev program missing: ' + id);
  await fjs(`document.getElementById('sec-programok').scrollIntoView()`);
  await shot('prog-dev.png');

  await fjs(`window.VRGDesk.setLevel('user')`);
  return { ok: !errors.length, errors, info };
};
