// transparency-test.js — does a transparent Electron window really show what is behind it on this GPU? (KV-25, report §1.5:
// electron#40515 — transparent windows render black on some GPUs with hardware acceleration).
//   ..\tools\electron\electron.exe CodeCity\shell\transparency-test.js [--disable-gpu]
// An opaque magenta window is put on screen, a transparent frameless window over it (left half a 50 % white veil, right
// half nothing); the screen is captured and three points are read. Pass = right half magenta, left half pink. Prints JSON.
const { app, BrowserWindow, desktopCapturer, screen } = require('electron');
if (process.argv.includes('--disable-gpu')) app.disableHardwareAcceleration();

const page = c => 'data:text/html,' + encodeURIComponent(`<!doctype html><html><body style="margin:0;background:${c}">${c === 'transparent'
  ? '<div style="position:fixed;left:0;top:0;width:50%;height:100%;background:rgba(255,255,255,.5)"></div>' : ''}</body></html>`);
const wait = ms => new Promise(r => setTimeout(r, ms));

app.whenReady().then(async () => {
  const d = screen.getPrimaryDisplay(), s = d.scaleFactor;
  const box = { x: d.workArea.x + 80, y: d.workArea.y + 80, width: 480, height: 240 };
  const back = new BrowserWindow({ ...box, frame: false, show: false, skipTaskbar: true, backgroundColor: '#ff00ff' });
  await back.loadURL(page('#ff00ff')); back.showInactive();
  const top = new BrowserWindow({ ...box, frame: false, show: false, skipTaskbar: true, transparent: true, alwaysOnTop: true, hasShadow: false, focusable: false });
  await top.loadURL(page('transparent')); top.showInactive();
  await wait(900);
  const [src] = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: Math.round(d.bounds.width * s), height: Math.round(d.bounds.height * s) } });
  const img = src.thumbnail, sz = img.getSize(), bmp = img.toBitmap();     // BGRA
  const px = (x, y) => { const X = Math.round((x - d.bounds.x) * s), Y = Math.round((y - d.bounds.y) * s), o = (Y * sz.width + X) * 4; return [bmp[o + 2], bmp[o + 1], bmp[o]]; };
  const right = px(box.x + box.width * 0.75, box.y + box.height / 2), left = px(box.x + box.width * 0.25, box.y + box.height / 2);
  const near = (c, t) => c.every((v, i) => Math.abs(v - t[i]) < 40);
  const gpu = await app.getGPUInfo('basic').catch(() => ({}));
  const dev = (gpu.gpuDevice || []).find(g => g.active) || (gpu.gpuDevice || [])[0] || {};
  const out = {
    electron: process.versions.electron, chrome: process.versions.chrome, hardwareAcceleration: !process.argv.includes('--disable-gpu'),
    gpu: dev.deviceString || `vendor 0x${(dev.vendorId || 0).toString(16)} device 0x${(dev.deviceId || 0).toString(16)}`, driver: dev.driverVersion,
    gpuFeatures: app.getGPUFeatureStatus(), scale: s,
    rightHalfRGB: right, leftHalfRGB: left,
    transparentShowsBehind: near(right, [255, 0, 255]), veilBlends: near(left, [255, 128, 255]),
    blackBug: near(right, [0, 0, 0]),
  };
  out.pass = out.transparentShowsBehind && out.veilBlends;
  console.log(JSON.stringify(out, null, 1));
  app.exit(out.pass ? 0 : 2);
});
