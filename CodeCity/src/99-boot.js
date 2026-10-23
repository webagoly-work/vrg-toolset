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
  }, 300);
} else $('drop').hidden = false;
