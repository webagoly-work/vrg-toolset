/*
  SK-CYD UI — the device's screens, drawn to a 320x240 canvas 2D context.
  This is the reference the firmware (firmware/servicekit_cyd) mirrors page for
  page, so the look can be checked without flashing hardware.

  Immediate-mode: each render() clears a touch-zone list and re-adds zones; a
  touch hit-tests the newest zones. The host supplies send(line), led(which,on),
  and a baked `standalone` SD filesystem (works with no PC/bridge).

  Palette nods to the "Mélyvíz" dev look: deep navy, cyan HUD lines, amber accent.
*/
(function () {
  'use strict';
  var W = 320, H = 240, HEAD = 26, FOOT = 22;
  var C = {
    bg: '#071017', panel: '#0d1a24', line: '#13303f',
    cyan: '#4fd6e8', cyanDim: '#2c7f8c', amber: '#f2a93b', text: '#cfe6ee', dim: '#6f94a2',
    ok: '#3fc28b', warn: '#f2a93b', fail: '#ef5a5a', info: '#5aa9ef', sel: '#123042', white: '#eaf6fb'
  };

  function create(g, host) {
    var self = {
      page: 'home', zones: [], footerHint: '',
      pc: { alive: false, name: '?', kit: { present: false, drive: '', ver: '' } },
      job: null, pb: null, step: null, setup: null, wiz: [],
      sd: host.standalone, sdPath: '/',
      pcPath: '', pcEntries: [], pcDrives: [], pcBusy: false, pendingLs: 0,
      text: null, scroll: 0, toast: null, toastT: 0, cmd: 1
    };

    // ---------------------------------------------------------- draw helpers
    function clear(c) { g.fillStyle = c || C.bg; g.fillRect(0, 0, W, H); }
    function rect(x, y, w, h, fill, stroke) { if (fill) { g.fillStyle = fill; g.fillRect(x, y, w, h); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); } }
    function text(s, x, y, color, size, bold, align) {
      g.fillStyle = color || C.text; g.textBaseline = 'middle'; g.textAlign = align || 'left';
      g.font = (bold ? 'bold ' : '') + (size || 12) + "px 'Consolas','DejaVu Sans Mono',monospace";
      g.fillText(s, x, y);
    }
    function clip(s, max) { s = String(s); return s.length > max ? s.slice(0, max - 1) + '…' : s; }
    function zone(x, y, w, h, fn) { self.zones.push({ x: x, y: y, w: w, h: h, fn: fn }); }

    function header(title) {
      rect(0, 0, W, HEAD, C.panel); rect(0, HEAD - 1, W, 1, null, C.line);
      g.strokeStyle = C.cyanDim; g.lineWidth = 1; g.beginPath(); g.moveTo(0, HEAD - 0.5); g.lineTo(W, HEAD - 0.5); g.stroke();
      text(title, 8, HEAD / 2, C.cyan, 13, true);
      // right side: kit + pc + heartbeat
      var hb = self.pc.alive ? C.ok : C.fail;
      g.fillStyle = hb; g.beginPath(); g.arc(W - 10, HEAD / 2, 3, 0, 7); g.fill();
      var kit = self.pc.kit.present ? ('KIT ' + self.pc.kit.drive) : 'nincs KIT';
      text(clip(self.pc.name, 10) + '  ' + kit, W - 20, HEAD / 2, self.pc.kit.present ? C.dim : C.cyanDim, 10, false, 'right');
    }
    function footer(hint) {
      rect(0, H - FOOT, W, FOOT, C.panel); rect(0, H - FOOT, W, 1, null, C.line);
      text(hint || self.footerHint, 8, H - FOOT / 2, C.dim, 10);
    }
    function btn(x, y, w, h, label, fn, opt) {
      opt = opt || {};
      rect(x, y, w, h, opt.fill || '#122430', opt.stroke || C.line);
      if (opt.accent) rect(x, y, 3, h, null), rect(x, y, 3, h, opt.accent);
      text(label, x + (opt.center ? w / 2 : 10), y + h / 2, opt.color || C.text, opt.size || 12, opt.bold, opt.center ? 'center' : 'left');
      if (opt.sub) text(opt.sub, x + w - 8, y + h / 2, C.dim, 10, false, 'right');
      if (fn) zone(x, y, w, h, fn);
    }
    function statusColor(s) { return ({ ok: C.ok, done: C.ok, warn: C.warn, fail: C.fail, info: C.info, skipped: C.dim, run: C.cyan })[s] || C.dim; }
    function go(p) { self.page = p; self.scroll = 0; if (p === 'pc' && !self.pcPath) { self.pcDrives = []; self.lastDrvReq = 0; } render(); host.send('P|' + p); }
    function requestDrivesIfNeeded() {
      if (self.pcPath || self.pcDrives.length) return;
      var now = Date.now(); if (now - (self.lastDrvReq || 0) < 1500) return;
      self.lastDrvReq = now; host.send('DRIVES');
    }
    function toast(level, msg) { self.toast = { level: level, msg: msg }; self.toastT = Date.now(); render(); }

    // ---------------------------------------------------------- pages
    function render() {
      self.zones = [];
      clear();
      if (self.page === 'home') pageHome();
      else if (self.page === 'sd') pageList('SD-kártya', sdEntries(), true);
      else if (self.page === 'pc') pagePc();
      else if (self.page === 'deploy') pageDeploy();
      else if (self.page === 'rescue') pageRescue();
      else if (self.page === 'status') pageStatus();
      else if (self.page === 'text') pageText();
      if (self.toast && Date.now() - self.toastT < 2600) drawToast(); else self.toast = null;
    }

    function pageHome() {
      header('ServiceKit CYD');
      var tiles = [
        ['SD-kártya', 'offline tár', 'sd', C.cyan, true],
        ['Mentő', 'boot · BIOS', 'rescue', C.amber, true],
        ['Telepítő', 'deploy · ellenőrzés', 'deploy', C.cyan, false],
        ['Gép', 'meghajtók', 'pc', C.cyan, false],
        ['Állapot', 'munka · forgatókönyv', 'status', C.cyan, false]
      ];
      var x0 = 8, y0 = HEAD + 8, tw = (W - 8 * 2 - 8) / 2, th = 54, i, col, row;
      for (i = 0; i < tiles.length; i++) {
        col = i % 2; row = (i / 2) | 0;
        var x = x0 + col * (tw + 8), y = y0 + row * (th + 7);
        var t = tiles[i], needPc = !t[4] && t[2] !== 'status' ? false : false;
        var live = (t[2] === 'sd' || t[2] === 'rescue') || self.pc.alive || (t[2] === 'status');
        rect(x, y, tw, th, '#0e212c', live ? C.line : '#10181d');
        rect(x, y, 3, th, null, t[3]);
        text(t[0], x + 10, y + 18, live ? C.white : C.dim, 14, true);
        text(t[1], x + 10, y + 37, C.dim, 10);
        if (!live && t[2] !== 'status') text('PC kell', x + tw - 8, y + 18, C.cyanDim, 9, false, 'right');
        zone(x, y, tw, th, (function (p, l) { return function () { if (l) go(p); else toast('warn', 'Ehhez él PC kell (híd).'); }; })(t[2], live));
      }
      footer(self.pc.alive ? 'Híd kapcsolódva' : 'Önálló mód — SD és Mentő PC nélkül is');
    }

    // generic scrolling list of {label, sub, icon, accent, fn}
    function pageList(title, items, isSd) {
      header(title);
      var rowH = 26, top = HEAD + 2, visible = Math.floor((H - HEAD - FOOT - 2) / rowH);
      var path = isSd ? self.sdPath : self.pcPath;
      // path chip row
      rect(0, top, W, 16, '#0a1922'); text(clip(path || '/', 46), 8, top + 8, C.cyanDim, 10);
      top += 18; visible = Math.floor((H - top - FOOT) / rowH);
      var start = self.scroll, end = Math.min(items.length, start + visible), i;
      for (i = start; i < end; i++) {
        var it = items[i], y = top + (i - start) * rowH;
        rect(6, y + 1, W - 12, rowH - 2, '#0c1d27', C.line);
        var ic = it.icon === 'dir' ? '▸' : (it.icon === 'up' ? '↩' : (it.icon === 'txt' ? '≡' : '·'));
        text(ic, 14, y + rowH / 2, it.accent || (it.icon === 'dir' ? C.amber : C.cyan), 13);
        text(clip(it.label, 30), 30, y + rowH / 2, C.text, 12, it.icon === 'up');
        if (it.sub) text(it.sub, W - 14, y + rowH / 2, C.dim, 10, false, 'right');
        zone(6, y + 1, W - 12, rowH - 2, it.fn);
      }
      scrollbar(top, visible, items.length);
      navFoot(items.length, visible);
    }

    function sdEntries() {
      var node = self.sd.tree[self.sdPath] || { d: [], f: [] }, out = [];
      if (self.sdPath !== '/') out.push({ label: '..', icon: 'up', fn: function () { self.sdPath = parent(self.sdPath); self.scroll = 0; render(); } });
      node.d.forEach(function (d) { out.push({ label: d + '/', icon: 'dir', fn: function () { self.sdPath = join(self.sdPath, d); self.scroll = 0; render(); } }); });
      node.f.forEach(function (f) { out.push({ label: f[0], icon: /\.(txt|md|json|log|cfg|ini)$/i.test(f[0]) ? 'txt' : 'file', sub: f[1] + ' KB', fn: function () { openSdFile(join(self.sdPath, f[0]), f[0]); } }); });
      return out;
    }
    function openSdFile(full, name) {
      var body = self.sd.files[full];
      if (body === undefined) { toast('warn', 'Nincs előnézet.'); return; }
      self.text = { name: name, body: body }; go('text');
    }

    function pagePc() {
      header('Gép — meghajtók');
      if (!self.pc.alive) { centerMsg('Nincs él PC', 'Indítsd a hidat a gépen:', 'node bridge.js --sim'); backOnly(); return; }
      requestDrivesIfNeeded();
      var items = [];
      if (self.pcPath) {
        items.push({ label: '..', icon: 'up', fn: function () { pcLs(parent2(self.pcPath)); } });
        self.pcEntries.forEach(function (e) {
          items.push({ label: e.isDir ? e.name + '/' : e.name, icon: e.isDir ? 'dir' : (/\.(txt|md|log|cmd|ps1|json|ini|cfg)$/i.test(e.name) ? 'txt' : 'file'),
            sub: e.isDir ? '' : (e.sizeKB >= 1024 ? (e.sizeKB / 1024).toFixed(1) + ' MB' : e.sizeKB + ' KB'),
            fn: e.isDir ? function () { pcLs(joinWin(self.pcPath, e.name)); } : function () { host.send('OPEN|' + joinWin(self.pcPath, e.name) + '|' + (self.cmd++)); toast('info', 'Megnyitás a gépen…'); } });
        });
      } else {
        self.pcDrives.forEach(function (d) {
          items.push({ label: d.id + '  ' + (d.label || ''), icon: 'dir', accent: d.kind === 'removable' ? C.amber : C.cyan, sub: d.freeGB + '/' + d.totalGB + ' GB', fn: function () { pcLs(d.id + '/'); } });
        });
      }
      self.pcList = items; pageListInline('Gép — ' + (self.pcPath || 'meghajtók'), items);
    }
    function pcLs(p) { self.pcPath = p; self.pcBusy = true; self.pcEntries = []; self.scroll = 0; host.send('LS|' + p + '|' + (self.cmd++)); render(); }

    function pageListInline(title, items) {
      // same as pageList but items are prebuilt and path header shows pcPath
      header(title);
      var rowH = 26, top = HEAD + 2;
      rect(0, top, W, 16, '#0a1922'); text(clip(self.pcPath || 'meghajtók', 46), 8, top + 8, C.cyanDim, 10);
      if (self.pcBusy) text('…', W - 12, top + 8, C.cyan, 11, false, 'right');
      top += 18; var visible = Math.floor((H - top - FOOT) / rowH);
      var start = self.scroll, end = Math.min(items.length, start + visible), i;
      for (i = start; i < end; i++) {
        var it = items[i], y = top + (i - start) * rowH;
        rect(6, y + 1, W - 12, rowH - 2, '#0c1d27', C.line);
        var ic = it.icon === 'dir' ? '▸' : (it.icon === 'up' ? '↩' : (it.icon === 'txt' ? '≡' : '·'));
        text(ic, 14, y + rowH / 2, it.accent || (it.icon === 'dir' ? C.amber : C.cyan), 13);
        text(clip(it.label, 30), 30, y + rowH / 2, C.text, 12, it.icon === 'up');
        if (it.sub) text(it.sub, W - 14, y + rowH / 2, C.dim, 10, false, 'right');
        zone(6, y + 1, W - 12, rowH - 2, it.fn);
      }
      scrollbar(top, visible, items.length);
      navFoot(items.length, visible);
    }

    function pageDeploy() {
      header('Telepítő');
      if (!self.pc.alive) { centerMsg('Nincs él PC', 'A telepítőhöz a híd kell.', 'node bridge.js --sim'); backOnly(); return; }
      var y = HEAD + 6, bw = W - 16, bh = 30;
      var kit = self.pc.kit;
      rect(8, y, bw, 22, '#0a1922'); text(kit.present ? ('Pendrive: ' + kit.drive + '  v' + (kit.ver || '?')) : 'Nincs ServiceKit pendrive', 14, y + 11, kit.present ? C.ok : C.fail, 11);
      y += 28;
      btn(8, y, bw, bh, 'Ellenőrzés (verify)', function () { self.wiz = []; host.send('RUN|verify||' + (self.cmd++)); toast('info', 'Ellenőrzés…'); }, { accent: C.cyan }); y += bh + 5;
      btn(8, y, bw, bh, 'Dashboard indítása', function () { host.send('RUN|launch|dashboard|' + (self.cmd++)); }, { accent: C.ok }); y += bh + 5;
      btn(8, y, (bw - 5) / 2, bh, 'Telepítő (SETUP)', function () { host.send('RUN|launch|setup|' + (self.cmd++)); }, { accent: C.cyan, center: true });
      btn(8 + (bw - 5) / 2 + 5, y, (bw - 5) / 2, bh, 'Kit Shell', function () { host.send('RUN|launch|shell|' + (self.cmd++)); }, { accent: C.cyan, center: true }); y += bh + 5;
      btn(8, y, (bw - 5) / 2, bh, 'Telepítés C:\\-re', function () { confirmDeploy(); }, { accent: C.amber, center: true });
      btn(8 + (bw - 5) / 2 + 5, y, (bw - 5) / 2, bh, 'Boot pendrive', function () { host.send('RUN|makeboot||' + (self.cmd++)); }, { accent: C.amber, center: true });
      // last wiz line
      if (self.wiz.length) { var w = self.wiz[self.wiz.length - 1]; footer(''); text('• ' + clip(w.text, 42), 8, H - FOOT / 2, statusColor(w.status), 10); }
      else footer('Művelet a hídon fut, az eredmény itt jelenik meg');
      backChip();
    }
    function confirmDeploy() {
      modal('Telepítés C:\\ServiceKit mappába?', 'A pendrive tartalmát a gépre másolja.', function () { self.wiz = []; host.send('RUN|deploy|dest:C:\\ServiceKit;confirm:1|' + (self.cmd++)); toast('info', 'Másolás…'); });
    }

    function pageRescue() {
      header('Mentő — offline');
      var body = self.sd.files['/reference/bios-boot-keys.txt'] || 'Nincs adat az SD-n.';
      var lines = body.split('\n'); drawTextBlock(lines, HEAD + 4);
      footer('BIOS / boot billentyűk — az SD-ről, PC nélkül');
      backChip();
    }

    function pageStatus() {
      header('Állapot');
      var y = HEAD + 8, bw = W - 16;
      function card(label, val, color) { rect(8, y, bw, 26, '#0c1d27', C.line); text(label, 14, y + 13, C.dim, 10); text(val, W - 14, y + 13, color || C.text, 12, true, 'right'); y += 30; }
      if (!self.pc.alive) { centerMsg('Nincs él PC', 'Az állapot a hídról jön.', ''); backOnly(); return; }
      card('Munka', self.job ? (self.job.client + ' · ' + self.job.computer) : '—', self.job ? C.cyan : C.dim);
      if (self.job) card('Eltelt', self.job.min + ' perc', C.text);
      if (self.pb) { card('Forgatókönyv', self.pb.title, C.cyan); card('Lépések', self.pb.done + ' / ' + self.pb.total + (self.pb.running ? '  ▶' : ''), self.pb.running ? C.amber : C.ok); }
      if (self.step) { rect(8, y, bw, 40, '#0c1d27', C.line); rect(8, y, 3, 40, null, statusColor(self.step.status)); wrapText(self.step.text, 16, y + 8, W - 28, 11, C.text, 2); y += 44; }
      if (self.setup) card('Telepítés', self.setup.done + '/' + self.setup.total + ' · ' + self.setup.phase, C.amber);
      if (!self.job && !self.pb && !self.setup) centerMsg('Nincs aktív munka', 'Indíts munkát a gépen.', '');
      backChip();
    }

    function pageText() {
      header(clip(self.text ? self.text.name : 'Fájl', 30));
      var lines = (self.text ? self.text.body : '').split('\n');
      drawTextBlock(lines, HEAD + 4);
      navFoot(lines.length, Math.floor((H - HEAD - FOOT - 8) / 14));
      backChip();
    }

    // ---------------------------------------------------------- shared bits
    function drawTextBlock(lines, top) {
      var lh = 14, visible = Math.floor((H - top - FOOT) / lh), start = self.scroll, i;
      for (i = start; i < Math.min(lines.length, start + visible); i++) {
        var ln = lines[i]; var isHdr = /^[A-ZÁÉÍÓÖŐÚÜŰ0-9 \-\/\.]+$/.test(ln) && ln.length > 2 && ln === ln.toUpperCase() && !/^\d/.test(ln);
        text(clip(ln, 48), 8, top + (i - start) * lh + 7, isHdr ? C.amber : (/^\d\./.test(ln.trim()) ? C.cyan : C.text), 11, isHdr);
      }
      scrollbar(top, visible, lines.length);
    }
    function wrapText(s, x, y, maxw, size, color, maxLines) {
      g.font = size + "px monospace"; var words = String(s).split(' '), lineS = '', yy = y, n = 0;
      for (var i = 0; i < words.length; i++) {
        var test = lineS ? lineS + ' ' + words[i] : words[i];
        if (g.measureText(test).width > maxw && lineS) { text(lineS, x, yy + 6, color, size); lineS = words[i]; yy += size + 3; if (++n >= maxLines - 1) { lineS = clip(lineS + ' …', 40); break; } }
        else lineS = test;
      }
      text(lineS, x, yy + 6, color, size);
    }
    function scrollbar(top, visible, total) {
      if (total <= visible) return;
      var h = H - top - FOOT, th = Math.max(16, h * visible / total), ty = top + (h - th) * self.scroll / Math.max(1, total - visible);
      rect(W - 4, top, 3, h, '#0a1922'); rect(W - 4, ty, 3, th, C.cyanDim);
    }
    function navFoot(total, visible) {
      rect(0, H - FOOT, W, FOOT, C.panel); rect(0, H - FOOT, W, 1, null, C.line);
      var canUp = self.scroll > 0, canDn = self.scroll + visible < total;
      btn(0, H - FOOT, 60, FOOT, '◀ Vissza', function () { back(); }, { center: true, color: C.cyan, size: 11, fill: C.panel, stroke: C.panel });
      if (total > visible) {
        btn(W - 120, H - FOOT, 58, FOOT, '▲', function () { if (canUp) { self.scroll = Math.max(0, self.scroll - visible); render(); } }, { center: true, color: canUp ? C.text : '#2a3a42', fill: C.panel, stroke: C.panel });
        btn(W - 60, H - FOOT, 58, FOOT, '▼', function () { if (canDn) { self.scroll += visible; render(); } }, { center: true, color: canDn ? C.text : '#2a3a42', fill: C.panel, stroke: C.panel });
      }
    }
    function backChip() { btn(0, H - FOOT, 60, FOOT, '◀ Vissza', function () { back(); }, { center: true, color: C.cyan, size: 11, fill: C.panel, stroke: C.panel }); }
    function backOnly() { footer(''); backChip(); }
    function centerMsg(a, b, c) { text(a, W / 2, H / 2 - 16, C.dim, 14, true, 'center'); text(b, W / 2, H / 2 + 4, C.dim, 11, false, 'center'); if (c) text(c, W / 2, H / 2 + 22, C.amber, 11, false, 'center'); }
    function back() {
      if (self.page === 'text') { go(self.textFrom || 'sd'); return; }
      if (self.page === 'pc' && self.pcPath) { if (self.pcPath.length <= 3) { self.pcPath = ''; render(); } else pcLs(parent2(self.pcPath)); return; }
      if (self.page === 'sd' && self.sdPath !== '/') { self.sdPath = parent(self.sdPath); render(); return; }
      go('home');
    }
    function drawToast() {
      var t = self.toast, col = statusColor(t.level); var w = Math.min(W - 20, g.measureText(t.msg).width + 24);
      rect((W - 220) / 2, H - FOOT - 30, 220, 22, '#06222c', col); text(clip(t.msg, 34), W / 2, H - FOOT - 19, C.white, 11, false, 'center');
    }
    var modalFn = null;
    function modal(title, body, fn) {
      modalFn = fn; self.modal = { title: title, body: body }; render();
      // draw over
      rect(0, 0, W, H, 'rgba(0,0,0,0.6)'); rect(20, 70, W - 40, 100, '#0c1d27', C.amber);
      text(title, W / 2, 92, C.white, 13, true, 'center'); text(body, W / 2, 112, C.dim, 10, false, 'center');
      self.zones = [];
      btn(30, 135, 120, 28, 'Mégse', function () { self.modal = null; render(); }, { center: true });
      btn(W - 150, 135, 120, 28, 'Igen', function () { self.modal = null; render(); if (modalFn) modalFn(); }, { center: true, accent: C.amber, color: C.amber });
    }

    function parent(p) { if (p === '/' || !p) return '/'; var i = p.lastIndexOf('/'); return i <= 0 ? '/' : p.slice(0, i); }
    function join(a, b) { return a === '/' ? '/' + b : a + '/' + b; }
    function parent2(p) { p = p.replace(/\/$/, ''); if (p.length <= 2) return ''; var i = p.lastIndexOf('/'); return i <= 2 ? p.slice(0, 2) + '/' : p.slice(0, i); }
    function joinWin(a, b) { return a.replace(/\/$/, '') + '/' + b; }

    // ---------------------------------------------------------- input + bridge
    self.touch = function (x, y) {
      for (var i = self.zones.length - 1; i >= 0; i--) { var z = self.zones[i]; if (x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h) { z.fn(); return; } }
    };
    self.onBridge = function (ln) {
      var p = ln.split('|'), tag = p[0];
      if (tag === 'HELLO') { self.pc.name = p[1] || '?'; self.pc.alive = true; }
      else if (tag === 'HB') { self.pc.alive = p[1] === '1'; }
      else if (tag === 'KIT') { self.pc.kit = { present: p[1] === '1', drive: p[2] || '', ver: p[3] || '' }; }
      else if (tag === 'JOB') { self.job = p[1] && p[1] !== '—' || p[2] ? { client: p[1] || '—', computer: p[2] || '', status: p[3] || '', min: +p[4] || 0 } : null; }
      else if (tag === 'PB') { self.pb = { title: p[1], done: +p[2] || 0, total: +p[3] || 0, running: p[4] === '1' }; }
      else if (tag === 'STEP') { self.step = { status: p[1], text: p[2] || '' }; if (p[1] === 'fail') host.led('r', true); }
      else if (tag === 'SETUP') { self.setup = { done: +p[1] || 0, total: +p[2] || 0, phase: p[3] || '' }; }
      else if (tag === 'DRV') { if (!self._drvBatch) { self.pcDrives = []; self._drvBatch = 1; setTimeout(function () { self._drvBatch = 0; }, 150); } self.pcDrives.push({ id: p[1], label: p[2], freeGB: +p[3], totalGB: +p[4], kind: p[5] }); }
      else if (tag === 'DBEG') { self.pcEntries = []; self.pcBusy = true; }
      else if (tag === 'D') { self.pcEntries.push({ name: p[1], isDir: p[2] === '1', sizeKB: +p[3] || 0, mtime: p[4] || '' }); }
      else if (tag === 'DEND') { self.pcBusy = false; }
      else if (tag === 'WIZ') { self.wiz.push({ step: p[2], status: p[3], text: p[4] || '' }); if (p[3] === 'ok') host.led('g', true), setTimeout(function () { host.led('g', false); }, 1200); if (p[3] === 'fail') host.led('r', true), setTimeout(function () { host.led('r', false); }, 1500); if (p[4]) toast(p[3], p[4]); }
      else if (tag === 'MSG') { toast(p[1], p[2]); }
      else if (tag === 'ACK') { /* could surface */ }
      render();
    };
    self.bridgeDown = function () { self.pc.alive = false; self.pcDrives = []; render(); };
    self.start = function () { render(); setInterval(function () { if (self.toast && Date.now() - self.toastT > 2600) { self.toast = null; render(); } }, 500); };

    return self;
  }
  window.SKCYD = { create: create };
})();
