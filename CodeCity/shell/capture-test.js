// capture-test.js — which way of capturing one window works in this Electron on this PC? (KV-26: getUserMedia with
// chromeMediaSource 'desktop' failed with NotReadableError, WGC CreateForWindow E_ACCESSDENIED.)
//   Planner\apps\electron\electron.exe CodeCity\shell\capture-test.js <exe-name> [--no-wgc]
// Tries, for the first window of that program: A) getUserMedia 'desktop' in a sandboxed page, B) the same unsandboxed,
// C) getDisplayMedia answered by setDisplayMediaRequestHandler with that source. Each: does a frame arrive, is it not black.
const { app, BrowserWindow, desktopCapturer, session } = require('electron');
const want = String(process.argv.slice(2).find(a => /\.exe$/i.test(a)) || 'notepad.exe').toLowerCase();
if (process.argv.includes('--no-wgc')) app.commandLine.appendSwitch('disable-features', 'AllowWgcWindowCapturer,AllowWgcScreenCapturer,AllowWgcDesktopCapturer');

const probeJs = how => `(async () => {
  try {
    const s = await Promise.race([(async () => ${how})(), new Promise((_, no) => setTimeout(() => no(new Error('no answer in 8 s')), 8000))]);
    const v = Object.assign(document.createElement('video'), { muted: true, srcObject: s }); await v.play();
    await new Promise(r => setTimeout(r, 800));
    const c = Object.assign(document.createElement('canvas'), { width: 64, height: 40 }), x = c.getContext('2d'); x.drawImage(v, 0, 0, 64, 40);
    const d = x.getImageData(0, 0, 64, 40).data; let lit = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 30) lit++;
    s.getTracks().forEach(t => t.stop());
    return { ok: true, size: v.videoWidth + 'x' + v.videoHeight, litPct: Math.round(100 * lit / (64 * 40)) };
  } catch (e) { return { ok: false, error: e.name + ': ' + e.message }; }
})()`;

app.whenReady().then(async () => {
  const srcs = await desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width: 0, height: 0 } });
  // match by title is not possible without titles; the caller passes the exe, so ask the OS for its windows' handles
  const { execFileSync } = require('child_process');
  const hs = String(execFileSync('powershell.exe', ['-NoProfile', '-Command', `Get-Process ${want.replace(/\.exe$/, '')} -EA SilentlyContinue | % { $_.MainWindowHandle }`])).split(/\s+/).filter(x => x && x !== '0');
  const src = srcs.find(s => hs.includes(s.id.split(':')[1]));
  if (!src) { console.log(JSON.stringify({ error: `no capture source for ${want}` })); app.exit(1); return; }
  const out = { exe: want, source: src.id, wgcDisabled: process.argv.includes('--no-wgc') };
  // a secure context (127.0.0.1), as the overlay has — data: pages get no navigator.mediaDevices
  const srv = require('http').createServer((q, r) => r.end('<!doctype html><body>')); await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const page = async sandbox => { const w = new BrowserWindow({ show: false, webPreferences: { sandbox, contextIsolation: true } }); await w.loadURL(`http://127.0.0.1:${srv.address().port}/`); return w; };
  const gum = `navigator.mediaDevices.getUserMedia({ audio: false, video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: '${src.id}', maxWidth: 1280, maxHeight: 800 } } })`;
  const step = (k, v) => { out[k] = v; console.log(k, JSON.stringify(v)); };
  let w = await page(true); step('A_getUserMedia_sandboxed', await w.webContents.executeJavaScript(probeJs(gum))); w.destroy();
  w = await page(false); step('B_getUserMedia_unsandboxed', await w.webContents.executeJavaScript(probeJs(gum))); w.destroy();
  session.defaultSession.setDisplayMediaRequestHandler((req, cb) => cb({ video: src }));
  w = await page(true); step('C_getDisplayMedia_handler', await w.webContents.executeJavaScript(probeJs('navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })'), true)); w.destroy();
  console.log(JSON.stringify(out, null, 1));
  app.exit(0);
});
