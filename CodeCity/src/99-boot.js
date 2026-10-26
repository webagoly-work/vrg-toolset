// 09-boot.js — runs last, so every module above is initialised before the first city loads.

onTimeChanged = () => { if (fen.list.length) fenDraw(); tlRender(); lensApply(); roadsRefresh(); followRefresh(); sessRefresh(); if (query.text) showQuery(query.text); writeHashSoon(); if (shownFile) showFile(shownFile); };

if (window.CITY) {
  load(window.CITY);
  liveInit();   // 22-live: "Mi változott?" and, when served, the live stream
  setInterval(hlRibbon, 1500);   // 27-health: the Now ribbon follows sessions, jobs, fences and changes
  landDraw();   // 29-land: the places around the city
  pwDraw();   // 30-power
  worldDraw();   // 32-world: the planet under the Land
  // test hook: #landtest=disk waits for Tárház's walk (served), closes the stream (headless clock), shows the Land
  if (new URLSearchParams(location.hash.slice(1)).get('landtest') === 'disk') live.ready.then(() => new Promise(res => {
    if (land.disk && land.disk.dirs && land.disk.dirs.length && !land.disk.walking) res(); else live.es.addEventListener('disk', res, { once: true }); }))
    .then(() => { live.es.close(); landHome(0); });
  // test hook: #livetest=<path> waits for the live stream's hello (and its catch-up swap), closes the stream so
  // headless time runs again, then feeds one fs event for that path and opens "Mi változott?" (served only).
  // Registered here, not in the timer below: an open stream stops headless Chrome's clock before it fires.
  const lt = new URLSearchParams(location.hash.slice(1)).get('livetest');
  if (lt) live.ready.then(() => { live.es.close(); liveFsEvent({ paths: [{ p: lt, kind: 'módosult' }] }); liveNews(); });
  // test hook: #filetest=<path>[&fileedit=md|diff] opens the file panel (served only; registered here for the same reason);
  // fileedit adds a line and shows the preview or the diff — nothing is saved
  // test hook: #jobstest=<job id> waits for the first port list, closes the stream (headless clock), opens Üzemek
  // with that job's log (start the job through the segéd first)
  // test hook: #metrotest=<branch> opens Metró and runs that branch's merge preview (served; registered before the stream)
  const mtq = new URLSearchParams(location.hash.slice(1)).get('metrotest');
  if (mtq) live.ready.then(async () => {
    live.es.close(); mtToggle(true); await mtLoad();
    const r = await fetch('/api/merge-preview?branch=' + encodeURIComponent(mtq)); mt.preview = await r.json(); mtDraw(); mtPanel();
  });
  const jt = new URLSearchParams(location.hash.slice(1)).get('jobstest');
  if (jt) live.ready.then(() => new Promise(res => { if (jb.ports.length) res(); else live.es.addEventListener('ports', res, { once: true }); }))
    .then(async () => { live.es.close(); await palCatalog(); jb.open = jt; jbToggle(true); });
  const ftq = new URLSearchParams(location.hash.slice(1)), ft = ftq.get('filetest');
  if (ft) live.ready.then(async () => {
    live.es.close();
    await kvFileOpen(ft);
    const fe = ftq.get('fileedit');
    if (fe) { fp.edit = fp.text.replace(/\n## /, '\n## Próba: ez a sor új\n\nKódváros KV-12 próba.\n\n## '); await fpShow(fe === 'diff' ? 'diff' : 'md'); }
  });
  // after the first resize, so the camera has its real aspect
  setTimeout(() => {
    const q = readHash();
    // #tour=auto (or the tour's number in the list) plays on open; &loop=1 repeats it — a wallboard
    const tt = q.get('tour'), t = tt && (tours.list.find(x => x.id === tt) || tours.list[+tt]);
    if (t) playTour(t, q.get('loop') === '1');
    // test hook: #sess=<id>&sessplay=1 plays the linked session from its first step
    if (q.get('sessplay') && sess.s) { sess.k = sess.s.ev.length / 3; sessPlay(); }
    // test hook: #cardtest=1 shows the share card on the page instead of downloading it (tools/shot.js)
    if (q.get('cardtest')) setTimeout(() => { const img = new Image(); img.src = makeCard().toDataURL(); img.id = 'cardtest'; img.style.cssText = 'position:fixed;inset:40px;z-index:9;width:calc(100% - 80px);outline:2px solid #ffcf5a'; document.body.append(img); }, 600);
    // test hook: #pick=0.5,0.6 hovers and clicks at that fraction of the canvas (tools/shot.js)
    const pk = (q.get('pick') || '').split(',').map(Number);
    if (pk.length === 2 && pk.every(Number.isFinite)) {
      const r = canvas.getBoundingClientRect();
      const e = { clientX: r.left + r.width * pk[0], clientY: r.top + r.height * pk[1] };
      onHover(e); onPick(e);
    }
    // test hook: #rco=0.5,0.6 opens the right-click menu there (tools/shot.js; greyed items show their reason)
    const rc = (q.get('rco') || '').split(',').map(Number);
    if (rc.length === 2 && rc.every(Number.isFinite)) {
      const r = canvas.getBoundingClientRect();
      const e = { clientX: r.left + r.width * rc[0], clientY: r.top + r.height * rc[1] };
      onHover(e); onContext(e);
    }
    // test hook: #palq=07a opens Ctrl+K with that text and takes the first row (tools/shot.js)
    if (q.get('palq')) palOpen(q.get('palq')).then(() => palRun(0));
    // test hook: #selp=a|b|c selects those paths; the selection bar carries the Claude link in data-ask
    if (q.get('selp')) selSetPaths(q.get('selp').split('|'));
    // test hook: #droptest=<card>,x,y drops that prompt card on the building at that fraction; the dock
    // carries the prompt in data-last (tools/shot.js --dump-dom)
    // test hook: #termtest=shell opens the embedded terminal on the repo, types an echo on its first output and
    // closes the stream once the echo is back — an open stream holds headless Chrome's virtual time (tools/shot.js)
    if (q.get('termtest')) kvTermOpen('.', 'shell').then(ok => {
      const t = ok && term.tabs[0];
      if (!t) return;
      let seen = '', sent = false;
      t.es.addEventListener('message', e => {
        seen += JSON.parse(e.data);
        if (!sent) { sent = true; kvCall('term-input', { id: t.id, data: 'echo KV-TERM-OK\r' }); }
        else if (/KV-TERM-OK[\s\S]*KV-TERM-OK/.test(seen)) t.es.close();
      });
    });
    // test hook: #agenttest=<path>|<path> — two sessions (one waiting for you), then a read and an edit beam onto
    // those paths, and the City Hall board open (no segéd needed; tools/shot.js)
    if (q.get('agenttest')) {
      const [p1, p2] = q.get('agenttest').split('|'), now = Date.now();
      agentsEvent({ list: [{ id: 'aaaa1111', name: 'Kódváros P4', state: 'working', kind: 'background', inRepo: true, startedAt: now - 600000 },
        { id: 'bbbb2222', name: 'Planner javítás', state: 'blocked', kind: 'interactive', inRepo: true, startedAt: now - 120000 },
        { id: 'cccc3333', name: 'tegnapi munka', state: 'done', kind: 'background', inRepo: false, startedAt: now - 86400000 }] });
      beamEvent({ id: 'aaaa1111', kind: 0, p: p1 }); beamEvent({ id: 'bbbb2222', kind: 2, p: p2 }); beamEvent({ id: 'aaaa1111', kind: 0, outside: true });
      // with hooks (KV-10): an outskirts zone, and a restricted one
      beamEvent({ id: 'aaaa1111', kind: 0, outside: true, zone: 'H:\\cwebuser\\backups', phase: 'pre' });
      beamEvent({ id: 'bbbb2222', kind: 0, outside: true, zone: 'C:\\Users\\webag', restricted: '.ssh', phase: 'pre' });
      agToggle(true);
    }
    // test hook: #fencetest=<path>|<path> — the first fenced by a session and a worktree (a conflict), the second by one session
    if (q.get('fencetest')) {
      const [f1, f2] = q.get('fencetest').split('|');
      fencesEvent({ list: [{ p: f1, owners: [{ kind: 'session', id: 'aaaa1111' }, { kind: 'worktree', id: 'cloudflare-ecosystem' }], conflict: true },
        { p: f2, owners: [{ kind: 'session', id: 'bbbb2222' }], conflict: false }] });
      agToggle(true);
    }
    // test hook: #healthtest=fail|pass — the Kódváros selftest failed (storm over CodeCity, a repair tunnel through the
    // files its output names, a 'needs you' line) or passed (calm); plus one stale build (no segéd needed)
    if (q.get('healthtest')) {
      const fail = q.get('healthtest') === 'fail';
      jb.list = [{ id: 'codecity-selftest', name: 'Kódváros selftest', kind: 'test', state: 'fut', district: 'CodeCity' },
        { id: 'hub-test', name: 'VRG Kapu tesztek', kind: 'test', state: 'kész', district: 'Hub' }];
      jb.logs.set('codecity-selftest', ['ok    scanner', 'FAIL  mcp: city_query uses the page parser', '    at CodeCity/core.js:41:7', '    at CodeCity/src/09-ask.js:88', '    at CodeCity/mcp.js:120']);
      pipesEvent({ list: [{ id: 'hub', name: 'VRG Kapu', out: 'Hub/dist/vrg-kapu.html', job: 'hub-build', src: 'Hub/src', newest: 'Hub/src/js/40-actions.js', stale: true }] });
      jobEvent({ id: 'codecity-selftest', name: 'Kódváros selftest', kind: 'test', state: fail ? 'hiba' : 'kész', code: fail ? 1 : 0, district: 'CodeCity' });
      hlRibbon();
    }
    // test hook: #nettest=up|down feeds one power sample and a station/border/shore state (no segéd needed)
    if (q.get('nettest')) {
      const up = q.get('nettest') === 'up';
      powerEvent({ at: Date.now(), cpu: 92, ramMB: 16250, ramFreeMB: 2250, disk: 35, rx: 2.5e6, tx: 4e5, gpu: 20 });
      netEvent({ at: Date.now(), station: { up: true, ms: 1 }, border: { up: true, ms: 1 }, internet: { up, ms: up ? 3 : 800 }, devices: 3,
        docks: up ? [{ id: 'web', name: 'Web (HTTPS)', n: 29 }, { id: 'ssh', name: 'SSH / git', n: 2 }] : [],
        countries: up ? [{ cc: 'US', n: 20 }, { cc: 'DE', n: 4 }, { cc: 'HU', n: 3 }] : [], dbip: true });
    }
    // test hook: #cargotest=1 — a 120 MB ship on its way, a small .exe plane arrived (customs), stick E: being written
    if (q.get('cargotest')) {
      powerEvent({ at: Date.now(), cpu: 20, ramMB: 16250, ramFreeMB: 6000, disk: 40, rx: 8e6, tx: 2e5, gpu: 5, usb: [{ drive: 'E:', sizeMB: 30000, freeMB: 12000, writeBps: 6e6 }] });
      netEvent({ at: Date.now(), station: { up: true }, border: { up: true }, internet: { up: true }, devices: 2, docks: [{ id: 'web', name: 'Web (HTTPS)', n: 12 }], countries: [], dbip: false });
      cargoEvent({ id: 'c1', kind: 'download', ext: '.iso', size: 120 * 1048576, done: false, from: 'download.example.org' });
      cargoEvent({ id: 'c2', kind: 'download', ext: '.exe', size: 3 * 1048576, done: false });
      cargoEvent({ id: 'c2', kind: 'download', ext: '.exe', size: 3 * 1048576, done: true, customs: { motw: 3, internet: true, exec: true } });
    }
    // test hook: #worldtest=1 jumps out to the GitWorld planet
    if (q.get('worldtest')) { window.KV_INSTANT = true; worldGo(0); }
    // test hook: #landtest=1 jumps to the Land's table view (Home)
    if (q.get('landtest') === '1') landHome(0);
    // test hook: #keytest=<key> presses that key once, after the opening flight (e.g. Home from a building); flights are
    // instant then (rAF barely ticks headless), and <body data-cam="x,z,r side=… at=land|city"> says where it landed
    if (q.get('keytest')) window.KV_INSTANT = true;
    if (q.get('keytest')) setTimeout(() => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: q.get('keytest'), bubbles: true }));
      setTimeout(() => { landUpdate(); document.body.dataset.cam = [orbit.target.x, orbit.target.z, orbit.r].map(v => v.toFixed(1)).join(',') + ' side=' + current.side.toFixed(1) + ' at=' + land.at; }, 400);
    }, 900);
    const dt = (q.get('droptest') || '').split(',');
    if (dt.length === 3) dockToggle(true).then(() => {
      dock.dry = true;
      const r = canvas.getBoundingClientRect(), hit = pickAt({ clientX: r.left + r.width * +dt[1], clientY: r.top + r.height * +dt[2] });
      if (hit) dockSend(dockPrompt({ kind: 'card', name: dt[0] }, { paths: [kvCtx(hit).rel || '.'] }));
    });
    // test hook: #selbox=x0,y0,x1,y1 (fractions of the canvas) draws a Shift+drag box there
    const sb = (q.get('selbox') || '').split(',').map(Number);
    if (sb.length === 4 && sb.every(Number.isFinite)) {
      const r = canvas.getBoundingClientRect(), X = f => r.left + r.width * f, Y = f => r.top + r.height * f;
      selBoxEnd(X(sb[0]), Y(sb[1]), X(sb[2]), Y(sb[3]), false);
    }
  }, 300);
} else $('drop').hidden = false;
