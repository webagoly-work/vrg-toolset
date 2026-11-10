// WP-17 probe (real Electron, the 127.0.0.1 fixture): a web tab has no window.vrg and no require; a _blank link makes a tab, not a window;
// a file: link does not navigate; geolocation is denied without asking; a download is asked, "no" writes nothing, "yes" lands in the (temp) downloads root.
'use strict';
const fs = require('fs'), path = require('path');
const { start } = require('../../test/fixtures/web-server.js');

module.exports = async function probe({ win }) {
  const errors = [];
  const { web } = win.desk;
  const srv = await start();
  const events = [];
  web.on((type, data) => events.push([type, data]));
  const wait = async (fn, ms) => {
    const end = Date.now() + ms;
    while (Date.now() < end) { if (await fn()) return true; await new Promise(r => setTimeout(r, 100)); }
    return false;
  };
  const js = (view, code) => web.webContents(view).executeJavaScript(code, true);
  const titleIs = (view, re) => async () => { const wc = web.webContents(view); return !!wc && re.test(wc.getTitle()); };
  try {
    const r = web.open({ url: srv.url + '/' });
    if (!r.view) { errors.push('open failed: ' + JSON.stringify(r)); return { ok: false, errors }; }
    const view = r.view;
    if (!(await wait(titleIs(view, /^VRG teszt$/), 10000))) { errors.push('fixture page did not load'); return { ok: false, errors }; }

    const vrgType = await js(view, 'typeof window.vrg'), reqType = await js(view, 'typeof require');
    if (vrgType !== 'undefined') errors.push('typeof window.vrg in the tab = ' + vrgType);
    if (reqType !== 'undefined') errors.push('typeof require in the tab = ' + reqType);
    if (await js(view, '(typeof process) + "/" + (typeof module)') !== 'undefined/undefined') errors.push('process / module visible in the tab');
    const ua = await js(view, 'navigator.userAgent');
    if (/Electron\//.test(ua)) errors.push('user agent still has the Electron token: ' + ua);

    // _blank link → a second tab, not a window
    const before = web.ids().length;
    await js(view, 'document.getElementById("blank").click()');
    if (!(await wait(async () => web.ids().length === before + 1, 5000))) errors.push('the _blank link did not open a second tab');
    else {
      const second = web.ids().find(i => i !== view);
      if (!(await wait(titleIs(second, /^Masodik$/), 5000))) errors.push('the second tab did not load /second');
      web.close(second);
    }

    // file: link → URL unchanged
    const url0 = web.webContents(view).getURL();
    await js(view, 'document.getElementById("file").click()');
    await new Promise(r => setTimeout(r, 800));
    if (web.webContents(view).getURL() !== url0) errors.push('file: link navigated to ' + web.webContents(view).getURL());

    // geolocation → denied, no ask
    const p = web.open({ url: srv.url + '/perm' });
    if (!p.view) errors.push('could not open /perm');
    else {
      if (!(await wait(titleIs(p.view, /^(denied:\d|granted)$/), 8000))) errors.push('geolocation request never finished');
      else if (web.webContents(p.view).getTitle() !== 'denied:1') errors.push('geolocation outcome: ' + web.webContents(p.view).getTitle());
      if (events.some(e => e[0] === 'ask')) errors.push('geolocation raised a web.ask');
      web.close(p.view);
    }

    // downloads
    const dir = web.downloadsDir();
    const left = () => fs.readdirSync(dir);
    const dlTab = web.open({ url: srv.url + '/' }).view;
    await wait(titleIs(dlTab, /^VRG teszt$/), 8000);
    const nDl = () => events.filter(e => e[0] === 'download').length;
    const startDl = async () => {
      const n = nDl();
      web.webContents(dlTab).loadURL(srv.url + '/dl').catch(() => {});
      return (await wait(async () => nDl() > n, 8000)) ? events.filter(e => e[0] === 'download').pop()[1] : null;
    };
    const d1 = await startDl();
    if (!d1) errors.push('/dl raised no web.download');
    else {
      if (d1.name !== 'data.bin' || d1.size !== 10 || d1.view !== dlTab) errors.push('web.download payload: ' + JSON.stringify(d1));
      web.answer(d1.ask, false);
      await new Promise(r => setTimeout(r, 1000));
      if (left().length) errors.push('"no" left files in the downloads root: ' + left().join(', '));
    }
    for (const want of ['data.bin', 'data (2).bin']) {
      const d = await startDl();
      if (!d) { errors.push('/dl raised no web.download (yes round)'); break; }
      web.answer(d.ask, true);
      if (!(await wait(async () => left().includes(want), 8000))) errors.push('"yes" did not write ' + want + ' (jobs: ' + JSON.stringify(win.desk.jobs.list()) + ')');
      else if (fs.readFileSync(path.join(dir, want), 'utf8') !== '0123456789') errors.push(want + ' has the wrong content');
    }
    web.close(dlTab);
    web.close(view);
    for (const f of left()) fs.rmSync(path.join(dir, f), { force: true });          // only what this probe made, in the temp root
  } catch (e) { errors.push('probe error: ' + e.stack); }
  finally { await srv.close(); web.closeAll(); }
  return { ok: !errors.length, errors };
};
