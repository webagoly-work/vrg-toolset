// WP-35 probe (real Electron, the 127.0.0.1 fixture): the frame page and the mail read view carry a Content-Security-Policy; a web tab and the
// mail view see no window.vrg, require or process; geolocation is "denied" in a web tab; the frame cannot be navigated to another site.
// The mail view is checked on a hidden window with the same webPreferences and the same rendered document as lib/mail.js builds (the real
// view runs no script at all, WP-28 looks into it through the DevTools protocol). Nothing here leaves 127.0.0.1.
'use strict';
const fs = require('fs'), path = require('path');
const { BrowserWindow } = require('electron');
const { start } = require('../../test/fixtures/web-server.js');

module.exports = async function probe({ win }) {
  const errors = [];
  const { frame, web } = win.desk;
  const wait = async (fn, ms) => {
    const end = Date.now() + ms;
    while (Date.now() < end) { if (await fn()) return true; await new Promise(r => setTimeout(r, 100)); }
    return false;
  };
  const metaCsp = `(() => { const m = document.querySelector('meta[http-equiv]'); return m ? m.getAttribute('http-equiv') + '|' + m.getAttribute('content') : null; })()`;
  const typeofs = `[typeof window.vrg, typeof require, typeof process].join(',')`;
  const srv = await start();
  let mailWin = null, tab = null;
  try {
    // ---- the frame page: CSP present, no remote source in it, and it cannot be sent to another site
    const fc = await frame.webContents.executeJavaScript(metaCsp, true);
    if (!fc || !fc.startsWith('Content-Security-Policy|')) errors.push('frame page has no CSP meta tag: ' + fc);
    else {
      const pol = fc.split('|')[1];
      if (!/(^|;)\s*script-src 'self' file:(;|$)/.test(pol)) errors.push('frame CSP script-src: ' + pol);
      if (/https?:|\*/.test(pol)) errors.push('frame CSP admits a remote source: ' + pol);
    }
    const url0 = frame.webContents.getURL();
    const ev = { prevented: false, preventDefault() { this.prevented = true; } };
    frame.webContents.emit('will-navigate', ev, 'https://example.org/');
    await new Promise(r => setTimeout(r, 300));
    if (!ev.prevented) errors.push('will-navigate to https://example.org was not prevented in the frame');
    if (frame.webContents.getURL() !== url0) errors.push('the frame URL changed: ' + frame.webContents.getURL());

    // ---- the mail read view: rendered document, same preferences
    const mailLib = require(path.join(__dirname, '..', 'lib', 'mail.js'));
    const { webPrefs } = require(path.join(__dirname, '..', 'lib', 'views.js'));
    const template = fs.readFileSync(path.join(__dirname, '..', '..', 'page', 'mailview.html'), 'utf8');
    const doc = mailLib.renderDoc(template, { csp: mailLib.cspFor({}), headers: { subject: 'demo' }, html: '<p>demo</p>', text: '' });
    mailWin = new BrowserWindow({ show: false, width: 400, height: 300, webPreferences: webPrefs('persist:vrg-mail') });
    await mailWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(doc));
    const mc = await mailWin.webContents.executeJavaScript(metaCsp, true);
    if (!mc || !mc.startsWith('Content-Security-Policy|')) errors.push('mail view has no CSP meta tag: ' + mc);
    else if (mc.split('|')[1] !== mailLib.cspFor({})) errors.push('mail view CSP differs from cspFor(): ' + mc);
    else if (!/^default-src 'none';/.test(mc.split('|')[1])) errors.push('mail view CSP does not start with default-src none: ' + mc);
    const mt = await mailWin.webContents.executeJavaScript(typeofs, true);
    if (mt !== 'undefined,undefined,undefined') errors.push('mail view typeof vrg,require,process = ' + mt);
    const mp = mailWin.webContents.getLastWebPreferences();
    if (mp.preload || mp.sandbox !== true || mp.contextIsolation !== true || mp.nodeIntegration !== false) errors.push('mail view webPreferences: ' + JSON.stringify(mp));

    // ---- a web tab: nothing of ours in it, geolocation denied
    const r = web.open({ url: srv.url + '/' });
    if (!r.view) { errors.push('web.open failed: ' + JSON.stringify(r)); return { ok: false, errors }; }
    tab = r.view;
    const titleIs = re => async () => { const wc = web.webContents(tab); return !!wc && re.test(wc.getTitle()); };
    if (!(await wait(titleIs(/^VRG teszt$/), 10000))) { errors.push('fixture page did not load'); return { ok: false, errors }; }
    const wc = web.webContents(tab);
    const wt = await wc.executeJavaScript(typeofs, true);
    if (wt !== 'undefined,undefined,undefined') errors.push('web tab typeof vrg,require,process = ' + wt);
    const geo = await wc.executeJavaScript(`navigator.permissions.query({ name: 'geolocation' }).then(p => p.state, e => 'error:' + e.message)`, true);
    if (geo !== 'denied') errors.push('geolocation permission state in a web tab = ' + geo);
    const wp = wc.getLastWebPreferences();
    if (wp.preload || wp.sandbox !== true || wp.contextIsolation !== true || wp.nodeIntegration !== false) errors.push('web tab webPreferences: ' + JSON.stringify(wp));
  } catch (e) { errors.push('probe error: ' + e.stack); }
  finally {
    try { if (tab) web.close(tab); } catch (e) {}
    try { if (mailWin && !mailWin.isDestroyed()) mailWin.destroy(); } catch (e) {}
    try { await srv.close(); } catch (e) {}
  }
  return { ok: !errors.length, errors };
};
