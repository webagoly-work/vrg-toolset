// portaltest.js — `electron CodeCity/shell --portal-test` (KV-26 check) against the running segéd, with Zen open: the
// overlay comes up, Zen's construct gets its screen; then three times in a row: the hand-off (the page flies in and asks
// the probe to move Zen onto the screen's rectangle, the overlay hides) and the return (a REAL Esc key press injected with
// keybd_event: the overlay comes back, Zen goes back to where it was). Prints one JSON line, exit 0 = pass.
const { spawn } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms));
const until = async (f, ms) => { const t = Date.now(); while (Date.now() - t < ms) { const v = await f().catch(() => null); if (v) return v; await wait(150); } return null; };
const ESC = `Add-Type -Namespace K -Name U -MemberDefinition '[DllImport("user32.dll")] public static extern void keybd_event(byte k, byte s, uint f, System.UIntPtr e);';
  [K.U]::keybd_event(0x1B,0,0,[UIntPtr]::Zero); Start-Sleep -Milliseconds 40; [K.U]::keybd_event(0x1B,0,2,[UIntPtr]::Zero)`;

module.exports = async ({ state, show, log }) => {
  const ai = process.argv.indexOf('--app'), APP = ai > 0 ? String(process.argv[ai + 1]).toLowerCase() : 'zen.exe';   // another program for a dry run
  const out = { app: APP, rounds: [] };
  const js = (w, code) => w.webContents.executeJavaScript(code);
  try {
    await until(async () => (await Promise.all(state.wins.map(w => js(w, "!document.getElementById('live-dot').hidden")))).every(Boolean), 30000);
    await show();
    const main = state.wins.find(w => w.isFocused()) || state.wins[0];
    out.zenScreen = !!await until(() => js(main, `window.kvPortalTest && kvPortalTest.screens().includes(${JSON.stringify(APP)})`), 20000);
    await js(main, `kvPortalTest.prefer(${JSON.stringify(APP)})`);
    await wait(2500);
    out.screens = await js(main, 'kvPortalTest.screens()');
    out.live = await js(main, 'kvPortalTest.live()'); 
    if (!out.zenScreen) throw new Error(`no screen for ${APP} — is it open?`);
    for (let i = 0; i < 3; i++) {
      const r = {};
      const t0 = Date.now();
      js(main, `kvPortalTest.go(${JSON.stringify(APP)})`);
      r.handedOff = !!await until(async () => state.portal && !state.shown, 5000);
      r.handoffMs = Date.now() - t0;
      r.placed = await until(async () => { const v = await js(main, 'document.body.dataset.portalLast || ""'); return /^placed ok/.test(v) ? v : null; }, 5000);
      r.asked = await js(main, 'document.body.dataset.portal');
      await wait(1200);   // Zen on the facade, the overlay gone: a moment to look at it
      spawn('powershell.exe', ['-NoProfile', '-Command', ESC], { stdio: 'ignore' });
      r.back = !!await until(async () => state.shown && !state.portal, 8000);
      r.unplaced = await until(async () => { const v = await js(main, 'document.body.dataset.portalLast || ""'); return /^unplaced ok/.test(v) ? v : null; }, 5000);
      r.pageState = await js(main, 'document.body.dataset.portal');
      r.ok = r.handedOff && !!r.placed && r.back && !!r.unplaced && r.pageState === 'returned';
      out.rounds.push(r);
      log(`round ${i + 1}: ${r.ok ? 'ok' : 'FAIL'} (${r.placed} → ${r.unplaced})`);
      await wait(1500);
    }
    // back means back: every return puts Zen on the same rectangle, which is not the facade's
    const backs = out.rounds.map(r => String(r.unplaced).split(' ')[2]), facades = out.rounds.map(r => String(r.placed).split(' ')[2]);
    out.sameHomeEachTime = backs.every(b => b === backs[0]) && !facades.includes(backs[0]);
    out.pass = out.rounds.length === 3 && out.rounds.every(r => r.ok) && out.sameHomeEachTime;
  } catch (e) { out.pass = false; out.error = String(e && e.message || e); }
  console.log('KV-PORTAL-TEST ' + JSON.stringify(out));
  require('electron').app.exit(out.pass ? 0 : 2);
};
