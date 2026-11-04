// WP-11 probe (real Electron, temp home set by main.js): a files pane over a temp root injected through machine.json:
// navigate into a/, back, mark two files, read "2 kijelölve"; the folder is walked back by names after a reload.
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
module.exports = async function probe({ win }) {
  const errors = [];
  const { frame } = win.desk;
  const fjs = code => frame.webContents.executeJavaScript(code);
  const wait = async (f, ms = 8000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) { try { if (await f()) return true; } catch (e) {} await new Promise(r => setTimeout(r, 100)); }
    return false;
  };
  const ready = () => wait(() => fjs(`document.body && document.body.dataset.ready === '1'`));

  const base = path.join(os.tmpdir(), 'VRG');
  fs.mkdirSync(base, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(base, 'desk-test-files-'));
  const paths = require('../lib/paths.js');
  const machine = paths.machine();
  const had = fs.existsSync(machine) ? fs.readFileSync(machine) : null;
  try {
    fs.mkdirSync(path.join(tmp, 'a'));
    for (const n of ['x.txt', 'y.txt', 'z.txt']) fs.writeFileSync(path.join(tmp, 'a', n), 'hello');
    fs.writeFileSync(path.join(tmp, 'top.txt'), 'top');
    fs.writeFileSync(machine, JSON.stringify({ roots: [{ id: 'test', hu: 'Teszt', path: tmp }] }));

    const tree = { v: 1, root: { active: 0, items: [{ id: 'files-1', kind: 'files', state: { left: { root: 'root:test', names: [] }, right: { root: 'root:test', names: [] }, active: 'left' } }] } };
    let r = await fjs(`window.vrg.layout.set(${JSON.stringify(tree)})`);
    if (!r || r.ok !== true) return { ok: false, errors: ['layout.set: ' + JSON.stringify(r)] };
    frame.webContents.reload();
    await new Promise(res => setTimeout(res, 300));
    if (!(await ready())) return { ok: false, errors: ['frame not ready'] };

    const rows = side => fjs(`[...document.querySelectorAll('[data-pane="files-1"] [data-side="${side}"] tbody tr')].map(t => t.dataset.name)`);
    const status = side => fjs(`(document.querySelector('[data-pane="files-1"] [data-side="${side}"] [data-role="status"]') || {}).textContent || ''`);
    const key = (k, o = {}) => fjs(`document.querySelector('[data-pane="files-1"]').dispatchEvent(new KeyboardEvent('keydown', Object.assign({ key: ${JSON.stringify(k)}, bubbles: true, cancelable: true }, ${JSON.stringify(o)})))`);
    const is = async (side, want) => wait(async () => JSON.stringify(await rows(side)) === JSON.stringify(want), 5000);

    if (!(await is('left', ['a', 'top.txt']))) errors.push('root listing: ' + JSON.stringify(await rows('left')));
    else {
      if (!(await wait(async () => (await status('left')) === '2 elem'))) errors.push('status at root: ' + await status('left'));
      await key('Enter');
      if (!(await is('left', ['x.txt', 'y.txt', 'z.txt']))) errors.push('inside a/: ' + JSON.stringify(await rows('left')));
      if (JSON.stringify(await rows('right')) !== JSON.stringify(['a', 'top.txt'])) errors.push('right side moved: ' + JSON.stringify(await rows('right')));

      // the folder name survives a reload (walked back by names)
      await fjs(`window.VRGFrame.save()`);
      frame.webContents.reload();
      await new Promise(res => setTimeout(res, 300));
      if (!(await ready())) errors.push('frame not ready after reload');
      else if (!(await is('left', ['x.txt', 'y.txt', 'z.txt']))) errors.push('walk back after reload: ' + JSON.stringify(await rows('left')));

      await key('Backspace');
      if (!(await is('left', ['a', 'top.txt']))) errors.push('after Backspace: ' + JSON.stringify(await rows('left')));
      await key('Enter');
      await is('left', ['x.txt', 'y.txt', 'z.txt']);
      await key(' '); await key(' ');
      const t = await status('left');
      if (!t.startsWith('2 kijelölve')) errors.push('status after marking: ' + t);
      await key('Tab');
      await key('a', { ctrlKey: true });
      if (!(await wait(async () => (await status('right')).startsWith('2 kijelölve')))) errors.push('Ctrl+A on the right side: ' + await status('right'));
    }
  } catch (e) {
    errors.push('probe error: ' + e.message);
  } finally {
    try { if (had) fs.writeFileSync(machine, had); else fs.rmSync(machine, { force: true }); } catch (e) {}
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
    try {
      const lib = require('../lib/layout.js');
      await fjs(`window.vrg.layout.set(${JSON.stringify(lib.defaultTree())})`);
    } catch (e) {}
  }
  return { ok: !errors.length, errors };
};
