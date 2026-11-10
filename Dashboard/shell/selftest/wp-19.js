// WP-19 probe (real Electron): select "Kapu" in the frame, vrg.sel.menu with dryRun returns the labels; picking Google makes the frame
// open a web tab on a search for it. The search provider is on the internet, so the web session cancels every request that is not 127.0.0.1.
'use strict';
const { session } = require('electron');

const EXPECT = [
  { label: 'Másolás', enabled: true }, { separator: true },
  { label: 'Belső keresés', enabled: true }, { label: 'Google', enabled: true }, { label: 'AI keresés', enabled: true }, { separator: true },
  { label: 'Claude oldalchat', enabled: true }, { label: 'Mentés fejlesztői jegyzetként', enabled: true }, { separator: true },
  { label: 'Csomaghoz adás', enabled: true },          // WP-25a: every item is built (DESK-Q54/56/62 A)
];

module.exports = async function probe({ win }) {
  const errors = [];
  const { frame, web, selMenu } = win.desk;
  const wait = async (fn, ms) => {
    const end = Date.now() + ms;
    while (Date.now() < end) { if (await fn()) return true; await new Promise(r => setTimeout(r, 100)); }
    return false;
  };
  const ses = session.fromPartition('persist:vrg-web');
  ses.webRequest.onBeforeRequest((d, cb) => cb({ cancel: !/^(http:\/\/127\.0\.0\.1[:/]|data:|devtools:)/.test(d.url) }));
  let opened = [];
  try {
    const wc = frame.webContents;
    const r = await wc.executeJavaScript(`(async () => {
      const s = document.createElement('span'); s.id = 'selprobe'; s.textContent = 'Kapu'; document.body.append(s);
      const g = window.getSelection(); g.removeAllRanges(); const rg = document.createRange(); rg.selectNodeContents(s); g.addRange(rg);
      return await window.vrg.sel.menu(String(g), 'frame', { dryRun: true });
    })()`, true);
    if (!r || r.ok === false || !Array.isArray(r.template)) errors.push('dryRun answer: ' + JSON.stringify(r));
    else if (JSON.stringify(r.template) !== JSON.stringify(EXPECT)) errors.push('labels: ' + JSON.stringify(r.template));

    const e = await wc.executeJavaScript('window.vrg.sel.menu("   ", "frame", { dryRun: true })', true);
    if (!e || e.template !== null) errors.push('empty selection must give no template: ' + JSON.stringify(e));
    const bad = await wc.executeJavaScript('window.vrg.sel.menu("x", "web", { dryRun: true })', true);
    if (!bad || bad.ok !== false || bad.err !== 'bad-request') errors.push('origin web from the page must be refused: ' + JSON.stringify(bad));

    selMenu.pick('google', 'Kapu');                                // what a click on "Google" does: sel.pick to the frame, the frame opens the tab
    const found = () => { opened = web.list(); return opened.some(t => /[?&]q=Kapu(&|$)/.test(t.url)); };
    if (!(await wait(found, 15000))) errors.push('no web tab with q=Kapu: ' + JSON.stringify(opened.map(t => t.url)));
  } catch (e) { errors.push('probe error: ' + e.stack); }
  finally {
    try { web.closeAll(); } catch (e) {}
    try { ses.webRequest.onBeforeRequest(null); } catch (e) {}
  }
  return { ok: !errors.length, errors };
};
