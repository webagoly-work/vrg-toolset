// 09-boot.js — runs last, so every module above is initialised before the first city loads.

onTimeChanged = () => { tlRender(); lensApply(); writeHashSoon(); if (shownFile) showFile(shownFile); };

if (window.CITY) {
  load(window.CITY);
  // after the first resize, so the camera has its real aspect
  setTimeout(() => {
    const q = readHash();
    // test hook: #pick=0.5,0.6 hovers and clicks at that fraction of the canvas (tools/shot.js)
    const pk = (q.get('pick') || '').split(',').map(Number);
    if (pk.length === 2 && pk.every(Number.isFinite)) {
      const r = canvas.getBoundingClientRect();
      const e = { clientX: r.left + r.width * pk[0], clientY: r.top + r.height * pk[1] };
      onHover(e); onPick(e);
    }
  }, 300);
} else $('drop').hidden = false;
