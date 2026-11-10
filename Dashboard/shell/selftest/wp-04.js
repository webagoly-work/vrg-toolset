// WP-04 probe: the three modes on the hidden selftest window, read back; autostart gates. No global hotkey, no setLoginItemSettings.
'use strict';
module.exports = async function probe({ win }) {
  const errors = [];
  const js = code => win.webContents.executeJavaScript(code);
  const wait = async (fn, ms = 3000) => { const t = Date.now(); while (Date.now() - t < ms) { if (fn()) return true; await new Promise(r => setTimeout(r, 50)); } return fn(); };

  let r = await js(`window.vrg.app.mode({ m: 'overlay' })`);
  if (!r || r.ok !== true || r.mode !== 'overlay') errors.push('overlay reply: ' + JSON.stringify(r));
  if (!(await wait(() => win.isAlwaysOnTop() === true))) errors.push('overlay: isAlwaysOnTop false');
  if (win.isFullScreen()) errors.push('overlay: isFullScreen true');

  r = await js(`window.vrg.app.mode({ m: 'munka' })`);
  if (!r || r.ok !== true || r.mode !== 'munka') errors.push('munka reply: ' + JSON.stringify(r));
  if (!(await wait(() => win.isFullScreen() === true))) errors.push('munka: isFullScreen false');
  if (win.isAlwaysOnTop()) errors.push('munka: isAlwaysOnTop true');

  r = await js(`window.vrg.app.mode({ m: 'ablak' })`);
  if (!r || r.ok !== true || r.mode !== 'ablak') errors.push('ablak reply: ' + JSON.stringify(r));
  if (!(await wait(() => win.isFullScreen() === false))) errors.push('ablak: isFullScreen true');
  if (win.isAlwaysOnTop()) errors.push('ablak: isAlwaysOnTop true');

  r = await js(`window.vrg.app.mode({ m: 'kiosk' })`);
  if (!r || r.ok !== false || r.err !== 'bad-request') errors.push('unknown mode: ' + JSON.stringify(r));
  r = await js(`window.vrg.app.autostart({ on: true })`);
  if (!r || r.ok !== false || r.err !== 'forbidden') errors.push('autostart without gesture: ' + JSON.stringify(r));
  r = await js(`window.vrg.app.autostart({ on: true, userGesture: true })`);       // selftest window is hidden, so never focused
  if (!r || r.ok !== false || r.err !== 'forbidden') errors.push('autostart unfocused: ' + JSON.stringify(r));
  r = await js(`window.vrg.app.autostart({})`);
  if (!r || r.ok !== true || typeof r.on !== 'boolean') errors.push('autostart read: ' + JSON.stringify(r));
  for (const f of ['mode', 'toggleOverlay', 'autostart']) {
    if (await js(`typeof window.vrg.app.${f}`) !== 'function') errors.push('vrg.app.' + f + ' missing');
  }
  return { ok: !errors.length, errors };
};
