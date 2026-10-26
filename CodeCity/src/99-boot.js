// 09-boot.js — runs last, so every module above is initialised before the first city loads.

onTimeChanged = () => { tlRender(); lensApply(); roadsRefresh(); followRefresh(); sessRefresh(); if (query.text) showQuery(query.text); writeHashSoon(); if (shownFile) showFile(shownFile); };

if (window.CITY) {
  load(window.CITY);
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
