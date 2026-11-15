// WP-49 probe (real Electron): the 📱 Telefon panel. The button sits in the Dashboard view's head and in the top strip (whatever the saved
// strip holds); a click opens the panel, the real radio scan fills Rádiók, the phone servers are listed with a hover icon and a QR toggle,
// the relay row and the auto switch are there; "Mind indítása" is a dry run in a selftest (nothing starts); Esc closes it and the native
// views come back. The shell refuses a path-looking server id and an address that is not text. When a relay with --ports answers on the
// registry port, a QR is shown inline and checked to be an <img> of an SVG. VRG_SHOTS=<folder>: also writes phone-panel.png.
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
  frame.setPosition(-4000, 0); frame.setSize(1400, 950); frame.showInactive();
  const shot = async name => { if (!SHOTS) return; await sleep(600); fs.mkdirSync(SHOTS, { recursive: true }); const img = await W.capturePage(); fs.writeFileSync(path.join(SHOTS, name), img.toPNG()); };

  if (!(await wait(() => fjs(`!!(window.VRGDesk && window.VRGDesk.state().ready)`), 12000))) return { ok: false, errors: ['the VRG Asztal did not become ready'] };
  await fjs(`window.VRGDesk.setView('dashboard'); window.VRGDesk.setLevel('user')`);
  await sleep(200);
  if (!(await fjs(`!!document.querySelector('[data-role="dash-head"] [data-role="phone-open"]')`))) errors.push('no 📱 button in the Dashboard head');
  await shot('phone-dash.png');
  await fjs(`window.VRGDesk.setView('desktop')`);
  await sleep(150);
  const vis = await fjs(`(() => { const b = document.querySelector('[data-role="topstrip"] [data-role="phone-open"]').getBoundingClientRect(), t = document.querySelector('[data-role="topstrip"]').getBoundingClientRect(); return b.width > 40 && b.right <= t.right - 40; })()`);
  if (!vis) errors.push('the top-strip button is not fully visible');
  await shot('phone-strip.png');
  if (!(await fjs(`!!document.querySelector('[data-role="topstrip"] [data-role="phone-open"]')`))) errors.push('no 📱 button in the top strip');
  const col = await fjs(`getComputedStyle(document.querySelector('[data-role="topstrip"] [data-role="phone-open"]')).color`);
  if (col !== 'rgb(147, 211, 230)') errors.push('the top-strip button is not ice: ' + col);

  await fjs(`document.querySelector('[data-role="topstrip"] [data-role="phone-open"]').click()`);
  if (!(await wait(() => fjs(`!!document.querySelector('[data-role="phone"]')`), 3000))) return { ok: false, errors: errors.concat('the panel did not open') };
  if (!(await wait(() => fjs(`document.querySelectorAll('[data-role="phone"] [data-radio]').length > 0`), 25000))) errors.push('the radio scan never filled the panel');
  const st = await fjs(`(() => { const p = document.querySelector('[data-role="phone"]'); return {
    radios: [...p.querySelectorAll('[data-radio]')].map(r => r.dataset.radio), servers: [...p.querySelectorAll('[data-phone-server]')].map(r => r.dataset.phoneServer),
    hover: p.querySelectorAll('[data-qr-hover]').length, toggles: p.querySelectorAll('[data-qr-toggle]').length, relay: !!p.querySelector('[data-role="relay"]'),
    auto: !!p.querySelector('[data-role="phone-auto"]'), start: !!p.querySelector('[data-role="phone-start"]'), ip: (window.VRGPhone.state() || {}).ip,
    addrs: ((window.VRGPhone.state().scan || {}).addresses || []).length, wireless: (window.VRGPhone.state().scan || {}).wireless }; })()`);
  Object.assign(info, st);
  if (!st.radios.includes('wifi') || !st.radios.includes('bt')) errors.push('Wi-Fi and Bluetooth rows are not both shown: ' + st.radios.join(','));
  if (!st.servers.includes('gyro') || !st.servers.includes('mindmap')) errors.push('the relay or MindMap is missing from the server list');
  if (['cyd-settings', 'board', 'city', 'hub-admin'].some(x => st.servers.includes(x))) errors.push('an excluded server is listed');
  if (st.hover !== st.servers.length || st.toggles < st.servers.length) errors.push('not every server has its hover icon and QR toggle');
  if (!st.relay || !st.auto || !st.start) errors.push('the relay row, the auto switch or Mind indítása is missing');

  const dry = await fjs(`window.vrg.call('desktop', 'phoneStart', {})`);
  if (!dry || !Array.isArray(dry.started)) errors.push('phoneStart did not answer: ' + JSON.stringify(dry));
  info.dryStarted = (dry && dry.started || []).length;
  const bad = await fjs(`window.vrg.call('desktop', 'phoneQr', { id: '../x' })`);
  if (bad.ok !== false || bad.err !== 'bad-request') errors.push('a path-looking id was accepted: ' + JSON.stringify(bad));
  const badIp = await fjs(`window.vrg.call('desktop', 'phoneQr', { id: 'mindmap', ip: 5 })`);
  if (badIp.ok !== false || badIp.err !== 'bad-request') errors.push('a non-text address was accepted: ' + JSON.stringify(badIp));

  // a live relay with --ports on the registry port: one QR inline
  const rl = await fjs(`(window.VRGPhone.state().scan || {}).relay || {}`);
  info.relay = rl;
  if (rl.up && rl.ports) {
    const first = await fjs(`(() => { const b = [...document.querySelectorAll('[data-role="phone"] [data-phone-server] [data-qr-toggle]')].find(x => x.dataset.qrToggle !== 'gyro' && !x.disabled); if (b) b.click(); return b ? b.dataset.qrToggle : ''; })()`);
    info.firstQr = first;
    if (first && !(await wait(() => fjs(`!!document.querySelector('[data-role="phone"] [data-qr-box] img.qr')`), 6000))) errors.push('no QR image for ' + first);
    else if (first) info.qrSrc = (await fjs(`document.querySelector('[data-role="phone"] [data-qr-box] img.qr').src.slice(0, 26)`));
  }
  // WP-49b: the VRG Mobile download row; with a live relay its QR
  if (!(await fjs(`!!document.querySelector('[data-role="phone"] [data-role="app-row"] [data-qr-toggle="app"]')`))) errors.push('no VRG Mobile download row');
  if (rl.up) {
    const clicked = await fjs(`(() => { const b = document.querySelector('[data-role="phone"] [data-qr-toggle="app"]'); if (b) b.click(); return !!b; })()`);
    if (!clicked) errors.push('the download button vanished before it could be clicked');
    if (!(await wait(() => fjs(`!!document.querySelector('[data-role="phone"] [data-qr-box="app"] img.qr, [data-role="phone"] [data-qr-box="app"] .warn')`), 6000))) errors.push('the download QR box stayed empty');
    info.app = await fjs(`(document.querySelector('[data-role="phone"] [data-qr-box="app"] code') || {}).textContent || (document.querySelector('[data-role="phone"] [data-qr-box="app"] .warn') || {}).textContent || ''`);
    await fjs(`(document.querySelector('[data-role="phone"] [data-qr-box="app"]') || document.body).scrollIntoView()`);
  }
  await shot('phone-panel.png');

  await fjs(`document.querySelector('[data-role="phone"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
  await sleep(150);
  if (await fjs(`!!document.querySelector('[data-role="phone"]')`)) errors.push('Esc did not close the panel');
  // the catalog item opens it too (palette, Sarokvezérlő)
  await fjs(`window.VRGDesk.open('phone')`);
  if (!(await wait(() => fjs(`!!document.querySelector('[data-role="phone"]')`), 3000))) errors.push('the catalog item phone did not open the panel');
  await fjs(`window.VRGPhone.close()`);

  // WP-49b: the title bar's corner metrics (a selftest gets main's fixed sample: no internet is touched)
  if (!(await wait(() => fjs(`document.querySelectorAll('[data-role="wbar"] [data-role="netbar"] [data-metric]').length > 0`), 6000))) errors.push('no corner metrics in the title bar');
  await wait(() => fjs(`(document.querySelector('[data-metric="ping"] .v') || {}).textContent === '24 ms'`), 6000);
  const nb = await fjs(`(() => { const r = [...document.querySelectorAll('[data-role="netbar"] [data-metric]')]; return { ids: r.map(x => x.dataset.metric), text: r.map(x => x.querySelector('.v').textContent),
    grades: r.map(x => x.dataset.grade), ping: getComputedStyle(document.querySelector('[data-metric="ping"] .v')).color, down: getComputedStyle(document.querySelector('[data-metric="down"] .v')).color }; })()`);
  info.netbar = nb;
  if (nb.ids.join(',') !== 'wifi,ping,loss,down,up') errors.push('the default metrics are not wifi, ping, loss, down, up: ' + nb.ids.join(','));
  if (nb.ping !== 'rgb(139, 204, 161)') errors.push('a good ping is not green: ' + nb.ping);
  if (nb.down !== 'rgb(147, 211, 230)') errors.push('traffic is not drawn as information (ice): ' + nb.down);
  await fjs(`document.querySelector('[data-role="net-menu"]').click()`);
  await sleep(150);
  const menu = await fjs(`document.querySelectorAll('[data-role="net-menu-box"] [data-choice]').length`);
  if (menu !== 10) errors.push('the metrics menu does not list all 10: ' + menu);
  await fjs(`document.querySelector('[data-role="net-menu-box"] [data-choice="cpu"] input').click()`);
  await fjs(`document.querySelector('[data-role="net-menu-box"] [data-choice="ram"] input').click()`);
  await fjs(`document.querySelector('[data-role="net-menu-box"] [data-choice="dns"] input').click()`);
  await sleep(300);
  const ids2 = await fjs(`[...document.querySelectorAll('[data-role="netbar"] [data-metric]')].map(x => x.dataset.metric).join(',')`);
  if (ids2 !== 'wifi,ping,loss,down,up,cpu,ram,dns') errors.push('switching metrics on did not add them in order: ' + ids2);
  const saved = await fjs(`window.vrg.call('app', 'setting', { k: 'net.metrics' })`);
  if (!saved || (saved.v || []).join(',') !== 'wifi,ping,loss,down,up,cpu,ram,dns') errors.push('net.metrics was not saved: ' + JSON.stringify(saved));
  await shot('netbar-menu.png');
  await fjs(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
  await sleep(150);
  if (await fjs(`!!document.querySelector('[data-role="net-menu-box"]')`)) errors.push('Esc did not close the metrics menu');
  await fjs(`document.querySelector('[data-role="net-toggle"]').click()`);
  await sleep(200);
  if (await fjs(`document.querySelectorAll('[data-role="netbar"] [data-metric]').length`)) errors.push('◉ did not hide the metrics');
  await fjs(`document.querySelector('[data-role="net-toggle"]').click()`);
  await sleep(200);
  await fjs(`window.vrg.call('app', 'setting', { k: 'net.metrics', v: ['wifi', 'ping', 'loss', 'down', 'up'] })`);
  return { ok: !errors.length, errors, info };
};
