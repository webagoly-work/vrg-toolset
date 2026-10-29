// selftest.js — `electron CodeCity/shell --selftest` (KV-25 check) against the running segéd, on the real desktop and GPU:
// 1. the page is live in every overlay window;  2. summon ×5 through show(), then once through the REAL hotkey (a key
// press injected with user32 keybd_event) — each timed from the call to the second painted frame;  3. the sky is
// transparent: corner pixels of the screen are the same with the overlay shown and hidden;  4. click-through: a move over
// the empty sky reports "not solid", over the city "solid";  5. hidden: the page is hidden (stream closed) and the shell's
// processes use ~0 % CPU over 30 s.  Prints one JSON line, exit 0 = pass. Windows appear on screen for ~a minute.
const { BrowserWindow, desktopCapturer, screen, ipcMain } = require('electron');
const { spawn } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms));

module.exports = async ({ state, show, hide, log }) => {
  const out = { monitors: state.wins.length, hotkey: state.hotkey };
  const js = (w, code) => w.webContents.executeJavaScript(code);
  const main = () => state.wins.find(w => w.isVisible()) || state.wins[0];
  try {
    // 1. live: the page connected its stream (the ● élő badge shows)
    for (let i = 0; i < 60 && !(await Promise.all(state.wins.map(w => js(w, "!document.getElementById('live-dot').hidden").catch(() => false)))).every(Boolean); i++) await wait(500);
    out.live = (await Promise.all(state.wins.map(w => js(w, "!document.getElementById('live-dot').hidden")))).every(Boolean);
    await show(); await wait(2500);   // first show: the scene builds its GPU buffers
    hide(); await wait(800);

    // 2. summon timing
    for (let i = 0; i < 5; i++) { await show(); await wait(600); hide(); await wait(900); }
    const n0 = state.summonMs.length;
    const key = `Add-Type -Namespace K -Name U -MemberDefinition '[DllImport("user32.dll")] public static extern void keybd_event(byte k, byte s, uint f, System.UIntPtr e);';
      foreach ($k in 0x11,0x12,0x4B) { [K.U]::keybd_event($k,0,0,[UIntPtr]::Zero) }; Start-Sleep -Milliseconds 60;
      foreach ($k in 0x4B,0x12,0x11) { [K.U]::keybd_event($k,0,2,[UIntPtr]::Zero) }`;
    if (state.hotkey === 'Control+Alt+K') {
      spawn('powershell.exe', ['-NoProfile', '-Command', key], { stdio: 'ignore' });
      for (let i = 0; i < 40 && state.summonMs.length === n0; i++) await wait(250);
      out.realHotkey = state.summonMs.length > n0;
    } else out.realHotkey = 'skipped (fallback hotkey)';
    const ms = state.summonMs.slice(1);   // the first show is the cold one
    out.summonMs = ms.map(x => Math.round(x));
    out.summonMax = Math.round(Math.max(...ms));
    if (!state.shown) await show();
    await wait(1200);

    // 3. transparency with the real page: a magenta window behind the overlay; where the sky is empty the screen must be magenta
    const d = screen.getPrimaryDisplay(), s = d.scaleFactor;
    const back = new BrowserWindow({ ...d.bounds, frame: false, show: false, skipTaskbar: true, focusable: false, backgroundColor: '#ff00ff' });
    await back.loadURL('data:text/html,<body style="margin:0;background:%23ff00ff">'); back.showInactive(); await wait(500);
    for (const x of state.wins) x.moveTop();
    await wait(700);
    const grab = async () => { const all = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: Math.round(d.bounds.width * s), height: Math.round(d.bounds.height * s) } }); const src = all.find(x => x.display_id === String(d.id)) || all[0]; return { bmp: src.thumbnail.toBitmap(), w: src.thumbnail.getSize().width, png: () => src.thumbnail.toPNG() }; };
    const rgb = (g, [x, y]) => { const o = (y * g.w + x) * 4; return [g.bmp[o + 2], g.bmp[o + 1], g.bmp[o]]; };
    const on = await grab(); hide(); back.destroy(); await wait(500);
    const shotAt = process.argv.indexOf('--shot');   // --shot <file.png>: keep the capture for a look
    if (shotAt > 0) require('fs').writeFileSync(process.argv[shotAt + 1], on.png());
    // the whole screen below the bar and above the taskbar, every 6th pixel: clear sky = pure magenta, veiled = magenta
    // under a plate or the fog, black = what electron#40515 would give
    let pure = 0, veil = 0, black = 0, tot = 0;
    for (let y = Math.round(40 * s); y < Math.round((d.bounds.height - 50) * s); y += 6) for (let x = 0; x < on.w; x += 6) {
      const [r, g, bl] = rgb(on, [x, y]); tot++;
      if (r > 235 && g < 20 && bl > 235) pure++; else if (r > g + 60 && bl > g + 60) veil++; else if (r + g + bl < 15) black++;
    }
    out.screen = { clearSkyPct: +(100 * pure / tot).toFixed(1), veiledPct: +(100 * veil / tot).toFixed(1), blackPct: +(100 * black / tot).toFixed(1) };
    out.skyTransparent = pure / tot > 0.1;
    out.blackBug = black / tot > 0.3;

    // 4. click-through: synthetic moves over the sky and over the city centre
    await show(); await wait(800);
    const w = main(), b = w.getBounds();
    let last;   // the page reports only changes, so the last report is the current state
    const rec = (e, solid) => { if (e.sender === w.webContents) last = solid; };
    ipcMain.on('kv-solid', rec);
    const move = async (x, y) => { w.webContents.sendInputEvent({ type: 'mouseMove', x, y }); await wait(300); return last; };
    let skyFalls = false;   // some sky point clear of the scene, the lenses and the legend
    for (const [fx, fy] of [[0.97, 0.2], [0.03, 0.2], [0.97, 0.45], [0.03, 0.45], [0.97, 0.7]]) if (await move(Math.round(b.width * fx), Math.round(b.height * fy)) === false) { skyFalls = true; break; }
    out.skyFallsThrough = skyFalls;
    let cityCatches = false;
    for (const [fx, fy] of [[0.5, 0.55], [0.5, 0.5], [0.48, 0.58], [0.52, 0.52]]) if (await move(Math.round(b.width * fx), Math.round(b.height * fy))) { cityCatches = true; break; }
    out.cityCatches = cityCatches;
    out.barCatches = await move(Math.round(b.width * 0.5), 12) === true;
    ipcMain.removeListener('kv-solid', rec);

    // 5. hidden: page hidden, then idle CPU of every shell process over 30 s
    hide(); await wait(1500);
    out.pageHidden = (await Promise.all(state.wins.map(x => js(x, 'document.visibilityState')))).every(v => v === 'hidden');
    await wait(10000);
    const { app } = require('electron');
    app.getAppMetrics();   // percentCPUUsage counts from the previous call
    await wait(30000);
    const m = app.getAppMetrics();
    out.idleCpuPctOfOneCore = +m.reduce((a, p) => a + p.cpu.percentCPUUsage, 0).toFixed(2);
    out.idleByProcess = m.map(p => `${p.type} ${p.cpu.percentCPUUsage.toFixed(2)}`);
    out.memoryMB = Math.round(m.reduce((a, p) => a + p.memory.workingSetSize, 0) / 1024);

    out.pass = out.live && out.realHotkey !== false && out.summonMax < 150 && out.skyTransparent && !out.blackBug
      && out.skyFallsThrough && out.cityCatches && out.barCatches && out.pageHidden && out.idleCpuPctOfOneCore < 1;
  } catch (e) { out.pass = false; out.error = String(e && e.stack || e); }
  console.log('KV-SHELL-SELFTEST ' + JSON.stringify(out));
  require('electron').app.exit(out.pass ? 0 : 2);
};
