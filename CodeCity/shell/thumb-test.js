// thumb-test.js — are desktopCapturer thumbnails real pictures of the windows, and what does one scan cost? (KV-26: the
// live WebRTC capture is refused on this PC, so the screens may have to be refreshed thumbnails.)
//   Planner\apps\electron\electron.exe CodeCity\shell\thumb-test.js
// Prints, per window: the handle, the thumbnail size and how much of it is not black; then the scan times at two sizes.
const { app, desktopCapturer } = require('electron');
app.whenReady().then(async () => {
  const lit = img => { const b = img.toBitmap(), n = b.length / 4; let k = 0; for (let i = 0; i < b.length; i += 4) if (b[i] + b[i + 1] + b[i + 2] > 30) k++; return n ? Math.round(100 * k / n) : 0; };
  const t = async (w, h) => { const t0 = Date.now(); const s = await desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width: w, height: h }, fetchWindowIcons: false }); return { ms: Date.now() - t0, s }; };
  await t(480, 300);   // warm
  const a = await t(480, 300), b = await t(960, 600), c = await t(960, 600);
  console.log(JSON.stringify({
    scan480ms: a.ms, scan960ms: [b.ms, c.ms], windows: a.s.length,
    perWindow: b.s.map(s => ({ h: s.id.split(':')[1], size: s.thumbnail.getSize(), litPct: lit(s.thumbnail) })),
  }, null, 1));
  app.exit(0);
});
