/* ServiceKit Phone — the phone acts as the CYD: a touch console that connects to
   the PC bridge (adb reverse over USB, or tethering/Wi-Fi) to run macros, launch
   the kit, mirror status, and deploy the bundled ServiceKit to the PC. Works
   offline too: the command DB and Súgó are bundled. */
(function () {
  'use strict';
  var SUGO = window.KIT_SUGO || { tasks: [], entries: [], categories: [] };

  function lsGet(k, d) { try { var v = localStorage.getItem('skp.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem('skp.' + k, JSON.stringify(v)); } catch (e) {} }

  var S = {
    lang: lsGet('lang', (navigator.language || 'hu').indexOf('hu') === 0 ? 'hu' : 'en'),
    tab: 'connect', mode: lsGet('mode', 'controller'), // 'controller' (no root) | 'rooted' (USB stick + HID)
    host: lsGet('host', '127.0.0.1'), port: lsGet('port', 47814), token: lsGet('token', ''),
    ws: null, connected: false, authed: false, needAuth: false, autoReconnect: false,
    pc: { name: '?', kitPresent: false, kitDrive: '', kitVer: '', allowRun: false, os: '' },
    job: null, pb: null, step: null, macros: [], macLoaded: false, wiz: null, pushPct: -1,
    helpSel: null, sheet: null, pending: {}, cmdId: 1
  };

  var T = {
    hu: {
      tConnect: 'Kapcsolat', tControl: 'Vezérlés', tCmd: 'Parancsok', tHelp: 'Súgó', tDeploy: 'Telepítés',
      noConn: 'nincs kapcsolat', connecting: 'kapcsolódás…', connected: 'kapcsolódva', needAuth: 'párosítás kell',
      connect: 'Kapcsolódás', disconnect: 'Bontás', howTitle: 'Hogyan kapcsolódik a telefon a géphez?',
      howUsb: 'USB-kábellel (ajánlott): a gépen fejlesztői USB-hibakeresés bekapcsolva, és futtasd a kit mellől: ',
      howUsb2: 'Ez a kábelen átvezeti a 47814-es portot, és a telefon a 127.0.0.1-re csatlakozik — token nélkül.',
      howWifi: 'Wi-Fi / USB-megosztás: írd be a gép IP-címét és a hídon megjelenő 6 jegyű tokent. A hidat így indítsd: ',
      host: 'Gép címe', port: 'Port', token: 'Párosító token', tokenHint: 'A hídon megjelenő 6 számjegy (csak Wi-Fi/megosztás esetén)',
      pc: 'Gép', kit: 'Telepítő pendrive', present: 'megvan', absent: 'nincs', runCap: 'Futtatás a gépen', on: 'be', off: 'ki',
      quick: 'Gyorsindítás a gépen', dashboard: 'Dashboard', setup: 'Telepítő', shell: 'Kit Shell', openkit: 'Kit mappa',
      ctrlTitle: 'Makrók', ctrlLede: 'Előre beállított műveletek a gépen. A piros ikonúak megerősítést kérnek. Szerkeszthetők a hídon: bridge/macros.json.',
      runDisabled: 'A futtatás a hidon ki van kapcsolva. Indítsd újra a hidat így: node skphone-bridge.js --allow-run', needPc: 'Ehhez kapcsolódni kell a géphez.',
      mirror: 'Gép állapota', noJob: 'Nincs aktív munka', run: 'Futtatás', running: 'fut…',
      cmdTitle: 'Parancsok', cmdLede: 'CMD és PowerShell parancsok offline. Másolás koppintásra; ha a géphez kapcsolódsz és a futtatás be van kapcsolva, egy koppintással a gépen is lefuttathatod.',
      runOnPc: 'Futtatás a gépen',
      helpTitle: 'Súgó', helpLede: 'Offline hibaelhárító. Válassz tünetet.', symptoms: 'Tünetek', steps: 'Lépések', caution: 'Vigyázz',
      depTitle: 'Telepítés a gépre', depLede: 'A telefon hordozza a teljes ServiceKitet. Kapcsolódás után feltölti a gépre és kicsomagolja (alapból C:\\ServiceKit), majd indítható.',
      bundled: 'Csomagolt kit', pushDeploy: 'Feltöltés és telepítés', pushOnly: 'Csak feltöltés', verify: 'Ellenőrzés', uploading: 'Feltöltés', deploying: 'Telepítés',
      mtpNote: 'Nincs kapcsolat? A telefon USB-n médiaeszközként (MTP) is látszik: másold át a ServiceKit mappát a gépre kézzel.',
      copied: 'Vágólapra másolva', confirm: 'Biztosan?', yes: 'Igen', cancel: 'Mégse', tokenAsk: 'Add meg a hídon megjelenő tokent:',
      dangerRun: 'Ez módosítja a gépet. Futtatod?', started: 'Elindítva', deployed: 'Telepítve', verifyRes: 'Ellenőrzés kész',
      modeTitle: 'Mód', modeCtrl: 'Híd (root nélkül)', modeRoot: 'Rootos (pendrive + HID)',
      modeCtrlHint: 'A telefon a géphez csatlakozik egy kis hídon át — makrók és telepítés a kábelen vagy Wi-Fin.',
      modeRootHint: 'Rootolt telefon: valódi USB-pendrive-ként jelenik meg (a gép simán csatlakoztatja), és USB-billentyűzetként gépeli be a makrókat. Nem kell PC-híd.',
      rootSetup: 'Rootos eszköz beállítása', rootHelper: 'A HID-makrókhoz a telefonon fut a helyi híd; a Vezérlés/Parancsok ugyanúgy működik, de a gépbe gépel.',
      rootConnTitle: 'Helyi HID-híd', rootConnHint: 'Csatlakozás a telefon saját hídjához: 127.0.0.1 : 47815',
      depRootTitle: 'Telepítés rootos módban', depRootLede: 'A telefon MAGA a pendrive — nincs feltöltés. Építsd meg a lemezképet, kapcsold be a tárolót, a gép pedig csatlakoztatja a ServiceKit meghajtót.',
      depRootStep1: '1. Lemezkép a kitből', depRootStep2: '2. Tároló (pendrive) be', depRootStep3: '3. A gépen nyisd meg a ServiceKit meghajtót', depRootOff: 'Tároló le (biztonságos eltávolítás)'
    },
    en: {
      tConnect: 'Connect', tControl: 'Control', tCmd: 'Commands', tHelp: 'Help', tDeploy: 'Deploy',
      noConn: 'not connected', connecting: 'connecting…', connected: 'connected', needAuth: 'pairing needed',
      connect: 'Connect', disconnect: 'Disconnect', howTitle: 'How does the phone reach the PC?',
      howUsb: 'By USB cable (recommended): turn on USB debugging on the PC and run, next to the kit: ',
      howUsb2: 'That tunnels port 47814 down the cable; the phone connects to 127.0.0.1 — no token.',
      howWifi: 'Wi-Fi / USB tethering: enter the PC IP and the 6-digit token the bridge prints. Start the bridge as: ',
      host: 'PC address', port: 'Port', token: 'Pairing token', tokenHint: 'The 6 digits the bridge prints (Wi-Fi/tethering only)',
      pc: 'PC', kit: 'Deployment stick', present: 'present', absent: 'none', runCap: 'Run on PC', on: 'on', off: 'off',
      quick: 'Quick launch on the PC', dashboard: 'Dashboard', setup: 'Setup', shell: 'Kit Shell', openkit: 'Kit folder',
      ctrlTitle: 'Macros', ctrlLede: 'Preset actions on the PC. Red ones ask to confirm. Edit them on the bridge: bridge/macros.json.',
      runDisabled: 'Run-on-PC is disabled. Restart the bridge as: node skphone-bridge.js --allow-run', needPc: 'Connect to the PC first.',
      mirror: 'PC status', noJob: 'No active job', run: 'Run', running: 'running…',
      cmdTitle: 'Commands', cmdLede: 'CMD and PowerShell commands offline. Tap to copy; if connected with run enabled, tap to run it on the PC.',
      runOnPc: 'Run on PC',
      helpTitle: 'Help', helpLede: 'Offline troubleshooting. Pick a symptom.', symptoms: 'Symptoms', steps: 'Steps', caution: 'Caution',
      depTitle: 'Deploy to the PC', depLede: 'The phone carries the whole ServiceKit. Once connected it uploads and extracts it on the PC (default C:\\ServiceKit), ready to run.',
      bundled: 'Bundled kit', pushDeploy: 'Upload and deploy', pushOnly: 'Upload only', verify: 'Verify', uploading: 'Uploading', deploying: 'Deploying',
      mtpNote: 'No connection? The phone also shows over USB as a media device (MTP): copy the ServiceKit folder to the PC by hand.',
      copied: 'Copied', confirm: 'Sure?', yes: 'Yes', cancel: 'Cancel', tokenAsk: 'Enter the token the bridge shows:',
      dangerRun: 'This changes the PC. Run it?', started: 'Started', deployed: 'Deployed', verifyRes: 'Verify done',
      modeTitle: 'Mode', modeCtrl: 'Bridge (no root)', modeRoot: 'Rooted (stick + HID)',
      modeCtrlHint: 'The phone connects to the PC through a small bridge — macros and deploy over the cable or Wi-Fi.',
      modeRootHint: 'Rooted phone: shows up as a real USB stick (the PC just mounts it) and types macros as a USB keyboard. No PC bridge needed.',
      rootSetup: 'Set up the rooted device', rootHelper: 'For HID macros a local bridge runs on the phone; Control/Commands work the same but type into the PC.',
      rootConnTitle: 'Local HID bridge', rootConnHint: "Connect to the phone's own bridge: 127.0.0.1 : 47815",
      depRootTitle: 'Deploy in rooted mode', depRootLede: 'The phone IS the stick — no upload. Build the disk image, switch storage on, and the PC mounts the ServiceKit drive.',
      depRootStep1: '1. Image from the kit', depRootStep2: '2. Storage (stick) on', depRootStep3: '3. On the PC, open the ServiceKit drive', depRootOff: 'Storage off (safe eject)'
    }
  };
  function t(k) { return (T[S.lang] || T.hu)[k] || k; }
  function L(o) { return o ? (typeof o === 'string' ? o : (o[S.lang] || o.hu || o.en || '')) : ''; }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function byId(id) { return document.getElementById(id); }

  // ------------------------------------------------------------------ icons
  var IC = {
    link: '<path d="M10 14l10-10M14 4h6v6"/><path d="M19 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/>',
    grid: '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>',
    term: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3M12 15h5"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14"/><path d="M12 17h.01"/>',
    up: '<path d="M12 20V8M6 14l6-6 6 6"/><path d="M5 4h14"/>',
    play: '<path d="M7 5l12 7-12 7z"/>', check: '<path d="M5 12l4 4 10-10"/>', alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
    doc: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>', folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16M20 20v-4h-4"/>'
  };
  function icon(n) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (IC[n] || IC.grid) + '</svg>'; }
  function statusCls(s) { return ({ ok: 'ok', done: 'ok', warn: 'warn', fail: 'fail', info: 'info', run: 'info' })[s] || 'dim'; }

  // ------------------------------------------------------------------ connection
  function connUrl() { return 'ws://' + S.host + ':' + S.port + '/'; }
  function setConn() {
    var el = byId('conn'), txt = byId('connText');
    el.className = 'conn' + (S.connected && S.authed ? ' on' : (S.connected ? ' mid' : ''));
    txt.textContent = !S.ws ? t('noConn') : (!S.connected ? t('connecting') : (S.needAuth && !S.authed ? t('needAuth') : t('connected')));
  }
  function connect() {
    if (S.ws) { S.autoReconnect = false; try { S.ws.close(); } catch (e) {} S.ws = null; S.connected = S.authed = false; render(); return; }
    lsSet('host', S.host); lsSet('port', S.port);
    var ws;
    try { ws = new WebSocket(connUrl()); } catch (e) { toast('err', e.message); return; }
    S.ws = ws; S.autoReconnect = true; setConn();
    ws.onopen = function () { S.connected = true; setConn(); };
    ws.onclose = function () { S.ws = null; S.connected = S.authed = false; S.macLoaded = false; S.pc.allowRun = false; setConn(); if (S.tab === 'connect' || S.tab === 'control' || S.tab === 'deploy') render(); };
    ws.onerror = function () {};
    var rx = '';
    ws.onmessage = function (ev) { rx += ev.data; var nl; while ((nl = rx.indexOf('\n')) >= 0) { var ln = rx.slice(0, nl).replace(/\r$/, ''); rx = rx.slice(nl + 1); if (ln) onLine(ln); } };
  }
  function send(s) { if (S.ws && S.connected) try { S.ws.send(s + '\n'); } catch (e) {} }
  function cmd() { return S.cmdId++; }

  function onLine(ln) {
    var p = ln.split('|'), tag = p[0];
    if (tag === 'HELLO') { S.pc.name = p[1] || '?'; S.needAuth = (p[3] === 'auth'); if (S.needAuth) { if (S.token) send('AUTH|' + S.token); else askToken(); } else { S.authed = true; } setConn(); render(); }
    else if (tag === 'AUTHOK') { S.authed = true; S.needAuth = true; lsSet('token', S.token); setConn(); send('MACROS'); render(); }
    else if (tag === 'AUTHFAIL') { S.authed = false; toast('err', 'Hibás token'); askToken(); }
    else if (tag === 'HB') { /* keepalive */ }
    else if (tag === 'KIT') { S.pc.kitPresent = p[1] === '1'; S.pc.kitDrive = p[2] || ''; S.pc.kitVer = p[3] || ''; if (S.tab === 'connect' || S.tab === 'deploy') renderSoft(); }
    else if (tag === 'CAPS') { S.pc.allowRun = p[1] === '1'; S.pc.os = p[2] || ''; if (!S.macLoaded) { send('MACROS'); } if (S.tab === 'control' || S.tab === 'connect') renderSoft(); }
    else if (tag === 'JOB') { S.job = (p[1] && p[1] !== '—') || p[2] ? { client: p[1] || '—', computer: p[2] || '', status: p[3] || '', min: +p[4] || 0 } : null; if (S.tab === 'control') renderSoft(); }
    else if (tag === 'PB') { S.pb = { title: p[1], done: +p[2] || 0, total: +p[3] || 0, running: p[4] === '1' }; if (S.tab === 'control') renderSoft(); }
    else if (tag === 'STEP') { S.step = { status: p[1], text: p[2] || '' }; if (S.tab === 'control') renderSoft(); }
    else if (tag === 'MAC') { if (!S.macBatch) { S.macros = []; S.macBatch = 1; } S.macros.push({ id: p[1], label: p[2], danger: p[3] === '1', cat: p[4] || '' }); }
    else if (tag === 'MACEND') { S.macBatch = 0; S.macLoaded = true; if (S.tab === 'control') render(); }
    else if (tag === 'WIZ') { S.wiz = { id: p[1], step: p[2], status: p[3], text: p[4] || '' }; if (p[4]) toast(p[3], p[4]); if (S.tab === 'deploy' || S.tab === 'control') renderSoft(); }
    else if (tag === 'PUSHP') { S.pushPct = +p[1] || 0; if (S.tab === 'deploy') renderSoft(); }
    else if (tag === 'ACK') { var cb = S.pending[p[1]]; if (cb) { delete S.pending[p[1]]; cb(p[2] === '1', p[3] || ''); } }
  }
  function action(actionId, arg, cb) { var id = cmd(); if (cb) S.pending[id] = cb; send('RUN|' + actionId + '|' + (arg || '') + '|' + id); }

  // ------------------------------------------------------------------ pages
  var TABS = [['connect', 'link', 'tConnect'], ['control', 'grid', 'tControl'], ['cmd', 'term', 'tCmd'], ['help', 'help', 'tHelp'], ['deploy', 'up', 'tDeploy']];
  function renderTabs() {
    var h = '';
    for (var i = 0; i < TABS.length; i++) { var x = TABS[i]; h += '<button type="button" class="tab' + (S.tab === x[0] ? ' on' : '') + '" data-act="go" data-tab="' + x[0] + '">' + icon(x[1]) + '<span>' + esc(t(x[2])) + '</span></button>'; }
    byId('tabs').innerHTML = h;
  }
  function show(tab) { S.tab = tab; renderTabs(); var vs = ['connect', 'control', 'cmd', 'help', 'deploy']; for (var i = 0; i < vs.length; i++) byId('view-' + vs[i]).className = 'view' + (vs[i] === tab ? ' active' : ''); render(); try { byId('main').scrollTop = 0; } catch (e) {} }

  function render() {
    byId('langBtn').textContent = S.lang === 'hu' ? 'HU' : 'EN';
    if (S.tab === 'connect') renderConnect();
    else if (S.tab === 'control') renderControl();
    else if (S.tab === 'cmd') renderCmd();
    else if (S.tab === 'help') renderHelp();
    else if (S.tab === 'deploy') renderDeploy();
  }
  function renderSoft() { render(); }

  function pcCard() {
    if (!S.authed) return '';
    var h = '<div class="card pc-card"><div class="row"><span class="k">' + esc(t('pc')) + '</span><b>' + esc(S.pc.name) + '</b></div>' +
      '<div class="row"><span class="k">' + esc(t('kit')) + '</span><span class="' + (S.pc.kitPresent ? 'ok' : 'dim') + '">' + (S.pc.kitPresent ? esc(S.pc.kitDrive + ' v' + S.pc.kitVer) : esc(t('absent'))) + '</span></div>' +
      '<div class="row"><span class="k">' + esc(t('runCap')) + '</span><span class="' + (S.pc.allowRun ? 'ok' : 'warn') + '">' + esc(S.pc.allowRun ? t('on') : t('off')) + '</span></div></div>';
    return h;
  }

  var rooted = function () { return S.mode === 'rooted'; };
  function cmdRow(c) { return '<div class="cmd-code" data-copy="' + esc(c) + '"><code>' + esc(c) + '</code><button type="button" class="copy-btn" data-copy="' + esc(c) + '">' + esc(t('copy')) + '</button></div>'; }

  function renderConnect() {
    var h = '<h1>' + esc(t('tConnect')) + '</h1>';
    // mode selector
    h += '<div class="card"><h2>' + esc(t('modeTitle')) + '</h2><div class="seg">' +
      '<button type="button" class="seg-btn' + (!rooted() ? ' on' : '') + '" data-act="mode" data-mode="controller">' + esc(t('modeCtrl')) + '</button>' +
      '<button type="button" class="seg-btn' + (rooted() ? ' on' : '') + '" data-act="mode" data-mode="rooted">' + esc(t('modeRoot')) + '</button></div>' +
      '<p class="lede" style="margin:10px 0 0">' + esc(rooted() ? t('modeRootHint') : t('modeCtrlHint')) + '</p></div>';
    // connection
    h += '<div class="card"><div class="conn-big ' + (S.authed ? 'on' : (S.connected ? 'mid' : 'off')) + '"><span class="dot"></span>' + esc(!S.ws ? t('noConn') : (!S.connected ? t('connecting') : (S.needAuth && !S.authed ? t('needAuth') : t('connected')))) + '</div>';
    if (rooted()) h += '<p class="lede" style="margin:-6px 0 12px">' + esc(t('rootConnHint')) + '</p>';
    h += '<div class="form"><label class="fld"><span>' + esc(t('host')) + '</span><input id="host" value="' + esc(S.host) + '" autocomplete="off" autocapitalize="none"></label>' +
      '<label class="fld sm"><span>' + esc(t('port')) + '</span><input id="port" value="' + esc(S.port) + '" inputmode="numeric"></label></div>';
    if (!rooted()) h += '<label class="fld"><span>' + esc(t('token')) + '</span><input id="token" value="' + esc(S.token) + '" inputmode="numeric" placeholder="' + esc(t('tokenHint')) + '"></label>';
    h += '<button type="button" class="btn big ' + (S.ws ? 'danger' : 'primary') + '" data-act="connect">' + icon('link') + (S.ws ? esc(t('disconnect')) : esc(t('connect'))) + '</button></div>';
    h += pcCard();
    if (S.authed && (S.pc.kitPresent || rooted())) {
      h += '<div class="card"><h2>' + esc(t('quick')) + '</h2><div class="grid2">' +
        qbtn('dashboard', 'play', 'launch', 'what:dashboard') + qbtn('setup', 'doc', 'launch', 'what:setup') +
        qbtn('shell', 'term', 'launch', 'what:shell') + qbtn('openkit', 'folder', 'openkit', '') + '</div></div>';
    }
    if (rooted()) {
      h += '<details class="card how"><summary>' + esc(t('rootSetup')) + '</summary>' +
        '<p>' + esc(t('rootHelper')) + '</p>' +
        cmdRow('su') + cmdRow('sh skstick.sh both on') + cmdRow('node hid-bridge.js') + '</details>';
    } else {
      h += '<details class="card how"><summary>' + esc(t('howTitle')) + '</summary>' +
        '<p>' + esc(t('howUsb')) + '<code>adb reverse tcp:47814 tcp:47814</code> ' + esc(t('howUsb2')) + '</p>' +
        '<p>' + esc(t('howWifi')) + '<code>node skphone-bridge.js --host 0.0.0.0 --token 123456 --allow-run</code></p></details>';
    }
    byId('view-connect').innerHTML = h;
    bindVal('host', 'host'); bindVal('port', 'port'); bindVal('token', 'token');
  }
  function qbtn(key, ic, act, arg) { return '<button type="button" class="qbtn" data-act="' + act + '" data-arg="' + esc(arg) + '">' + icon(ic) + esc(t(key)) + '</button>'; }

  function renderControl() {
    var h = '<h1>' + esc(t('ctrlTitle')) + '</h1>';
    if (!S.authed) { h += '<div class="empty">' + esc(t('needPc')) + ' <a href="#" data-act="go" data-tab="connect">' + esc(t('tConnect')) + '</a></div>'; byId('view-control').innerHTML = h; return; }
    // status mirror
    h += '<div class="card mirror"><h2>' + esc(t('mirror')) + '</h2>';
    if (S.job || S.pb) {
      if (S.job) h += '<div class="row"><span class="k">' + esc(t('tControl')) + '</span><b>' + esc(S.job.client + ' · ' + S.job.computer) + '</b></div>';
      if (S.pb) h += '<div class="row"><span class="k">' + esc(S.pb.title) + '</span><span class="' + (S.pb.running ? 'warn' : 'ok') + '">' + S.pb.done + '/' + S.pb.total + (S.pb.running ? ' ▶' : '') + '</span></div>';
      if (S.step) h += '<div class="step ' + statusCls(S.step.status) + '">' + esc(S.step.text) + '</div>';
    } else h += '<div class="dim sm">' + esc(t('noJob')) + '</div>';
    h += '</div>';
    if (!S.pc.allowRun) h += '<div class="warnbox">' + esc(t('runDisabled')) + '</div>';
    h += '<p class="lede">' + esc(t('ctrlLede')) + '</p>';
    // macros grouped by cat
    var cats = {}, order = [];
    for (var i = 0; i < S.macros.length; i++) { var m = S.macros[i]; if (!cats[m.cat]) { cats[m.cat] = []; order.push(m.cat); } cats[m.cat].push(m); }
    var catName = { net: 'Hálózat', disk: 'Lemez', diag: 'Diagnosztika', repair: 'Javítás', sec: 'Biztonság', clean: 'Tisztítás', open: 'Megnyitás', '': '' };
    for (var c = 0; c < order.length; c++) {
      h += '<div class="mac-group"><div class="mac-cat">' + esc(catName[order[c]] || order[c]) + '</div>';
      var arr = cats[order[c]];
      for (var j = 0; j < arr.length; j++) { var mm = arr[j]; h += '<button type="button" class="mac' + (mm.danger ? ' danger' : '') + '" data-act="macro" data-id="' + esc(mm.id) + '" data-danger="' + (mm.danger ? 1 : 0) + '">' + (mm.danger ? icon('alert') : icon('play')) + '<span>' + esc(mm.label) + '</span></button>'; }
      h += '</div>';
    }
    byId('view-control').innerHTML = h;
  }

  var cmdView = null, cmdLang = '';
  function renderCmd() {
    var v = byId('view-cmd');
    if (!cmdView || cmdLang !== S.lang) {
      if (!cmdView) { v.innerHTML = '<h1 id="cmdT"></h1><p class="lede" id="cmdL"></p><div id="cmdRoot"></div>'; cmdView = window.CmdView.mount(byId('cmdRoot'), { lang: function () { return S.lang; }, toast: toast, canRun: function () { return S.authed && S.pc.allowRun; }, onRun: runCommand, runLabel: function () { return t('runOnPc'); } }); }
      byId('cmdT').textContent = t('cmdTitle'); byId('cmdL').textContent = t('cmdLede'); cmdLang = S.lang;
    }
    cmdView.render();
  }
  function runCommand(command, shell) {
    if (!(S.authed && S.pc.allowRun)) { toast('warn', t('needPc')); return; }
    confirmSheet(t('dangerRun'), command, function () {
      var b64 = btoa(unescape(encodeURIComponent(command)));
      action('run', 'b64:' + b64 + ';kind:' + (shell === 'ps' ? 'ps' : 'cmd') + ';confirm:1', function (ok, txt) { toast(ok ? 'ok' : 'warn', (ok ? '✓ ' : '') + (txt || (ok ? 'OK' : 'hiba'))); });
    });
  }

  function renderHelp() {
    var v = byId('view-help'), e = S.helpSel && entryById(S.helpSel);
    if (!e) {
      var h = '<h1>' + esc(t('helpTitle')) + '</h1><p class="lede">' + esc(t('helpLede')) + '</p><div class="help-list">';
      for (var i = 0; i < SUGO.entries.length; i++) { var en = SUGO.entries[i]; h += '<button type="button" class="help-item" data-act="help" data-id="' + esc(en.id) + '">' + esc(L(en.title)) + '</button>'; }
      v.innerHTML = h + '</div>';
    } else {
      var h2 = '<button type="button" class="btn ghost back" data-act="help-back">‹ ' + esc(t('helpTitle')) + '</button><h1>' + esc(L(e.title)) + '</h1>';
      var sym = e.sym ? (e.sym[S.lang] || e.sym.hu) : [];
      if (sym && sym.length) { h2 += '<h3>' + esc(t('symptoms')) + '</h3><ul>'; for (var s = 0; s < sym.length; s++) h2 += '<li>' + rich(sym[s]) + '</li>'; h2 += '</ul>'; }
      var st = e.steps[S.lang] || e.steps.hu;
      h2 += '<h3>' + esc(t('steps')) + '</h3><ol class="steps">'; for (var k = 0; k < st.length; k++) h2 += '<li>' + rich(st[k]) + '</li>'; h2 += '</ol>';
      if (e.warn) h2 += '<div class="warnbox"><b>' + esc(t('caution')) + ':</b> ' + rich(L(e.warn)) + '</div>';
      v.innerHTML = h2;
    }
  }
  function entryById(id) { for (var i = 0; i < SUGO.entries.length; i++) if (SUGO.entries[i].id === id) return SUGO.entries[i]; return null; }
  function rich(s) { s = esc(s); s = s.replace(/`([^`]+)`/g, '<code data-copy="$1">$1</code>'); s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>'); return s; }

  function renderDeploy() {
    if (rooted()) { renderDeployRooted(); return; }
    var h = '<h1>' + esc(t('depTitle')) + '</h1><p class="lede">' + esc(t('depLede')) + '</p>';
    h += '<div class="card"><div class="row"><span class="k">' + esc(t('bundled')) + '</span><b>ServiceKit.zip</b></div>';
    if (S.authed) {
      h += '<div class="row"><span class="k">' + esc(t('pc')) + '</span><b>' + esc(S.pc.name) + '</b></div>' +
        '<div class="row"><span class="k">' + esc(t('kit')) + '</span><span class="' + (S.pc.kitPresent ? 'ok' : 'dim') + '">' + (S.pc.kitPresent ? esc(S.pc.kitDrive + ' v' + S.pc.kitVer) : esc(t('absent'))) + '</span></div>' +
        '<div class="row"><span class="k">' + esc(t('runCap')) + '</span><span class="' + (S.pc.allowRun ? 'ok' : 'warn') + '">' + esc(S.pc.allowRun ? t('on') : t('off')) + '</span></div>';
    }
    h += '</div>';
    if (S.pushPct >= 0 && S.pushPct < 100) h += '<div class="pbar"><i style="width:' + S.pushPct + '%"></i></div>';
    if (S.wiz && S.wiz.id === 'push') h += '<div class="step ' + statusCls(S.wiz.status) + '">' + esc(S.wiz.text) + '</div>';
    if (S.authed) {
      h += '<div class="grid1">' +
        '<button type="button" class="btn primary" data-act="push" data-deploy="1">' + icon('up') + esc(t('pushDeploy')) + '</button>' +
        '<button type="button" class="btn" data-act="push" data-deploy="0">' + esc(t('pushOnly')) + '</button>' +
        (S.pc.kitPresent ? '<button type="button" class="btn" data-act="verify">' + icon('check') + esc(t('verify')) + '</button>' : '') +
        '</div>';
    } else h += '<div class="empty">' + esc(t('needPc')) + ' <a href="#" data-act="go" data-tab="connect">' + esc(t('tConnect')) + '</a></div>';
    h += '<div class="note">' + esc(t('mtpNote')) + '</div>';
    byId('view-deploy').innerHTML = h;
  }

  function renderDeployRooted() {
    var h = '<h1>' + esc(t('depRootTitle')) + '</h1><p class="lede">' + esc(t('depRootLede')) + '</p>';
    h += '<div class="card"><h3 style="margin-top:0">' + esc(t('depRootStep1')) + '</h3>' + cmdRow('sh skstick.sh build') +
      '<h3>' + esc(t('depRootStep2')) + '</h3>' + cmdRow('sh skstick.sh stick on') +
      '<h3>' + esc(t('depRootStep3')) + '</h3><p class="sm dim" style="margin:4px 0 0"><code>E:\\ServiceKit\\START.cmd</code></p>' +
      '<h3>' + esc(t('depRootOff')) + '</h3>' + cmdRow('sh skstick.sh stick off') + '</div>';
    h += '<div class="note">' + esc(t('mtpNote')) + '</div>';
    byId('view-deploy').innerHTML = h;
  }

  // ------------------------------------------------------------------ kit push
  function pushKit(deploy) {
    fetch('kit/ServiceKit.zip').then(function (r) { return r.arrayBuffer(); }).then(function (buf) {
      var bytes = new Uint8Array(buf), total = bytes.length, CH = 24000, off = 0, id = cmd();
      S.pushPct = 0; renderSoft();
      S.pending[id] = function (ok, txt) { S.pushPct = -1; toast(ok ? 'ok' : 'warn', ok ? (deploy ? t('deployed') + ': ' + txt : 'OK') : ('hiba: ' + txt)); renderSoft(); };
      // override cmdId used by PUSHE: send PUSHB with our id
      send('PUSHB|' + total + '|' + id);
      function step() {
        if (off >= total) { send('PUSHE|' + (deploy ? '1' : '0')); return; }
        var end = Math.min(total, off + CH), sub = bytes.subarray(off, end), bin = '';
        for (var i = 0; i < sub.length; i++) bin += String.fromCharCode(sub[i]);
        send('PUSHC|' + btoa(bin)); off = end;
        setTimeout(step, 10);
      }
      step();
    }).catch(function (e) { toast('err', 'kit: ' + e.message); });
  }

  // ------------------------------------------------------------------ sheets / toast
  var toastTimer;
  function toast(level, msg) { var el = byId('toast'); el.className = 'toast show ' + statusCls(level); el.textContent = msg; clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.className = 'toast ' + statusCls(level); }, 3000); }
  function sheet(html) { var el = byId('sheet'); if (!html) { el.className = 'sheet'; el.innerHTML = ''; return; } el.innerHTML = '<div class="sheet-card">' + html + '</div>'; el.className = 'sheet open'; }
  function confirmSheet(title, body, onYes) { sheet('<h3>' + esc(title) + '</h3>' + (body ? '<pre class="mono">' + esc(body) + '</pre>' : '') + '<div class="sheet-btns"><button type="button" class="btn ghost" data-act="sheet-cancel">' + esc(t('cancel')) + '</button><button type="button" class="btn primary" data-act="sheet-yes">' + esc(t('yes')) + '</button></div>'); S.sheetYes = onYes; }
  function askToken() { sheet('<h3>' + esc(t('tokenAsk')) + '</h3><input id="askTok" inputmode="numeric" class="sheet-input" value="' + esc(S.token) + '"><div class="sheet-btns"><button type="button" class="btn ghost" data-act="sheet-cancel">' + esc(t('cancel')) + '</button><button type="button" class="btn primary" data-act="sheet-token">OK</button></div>'); setTimeout(function () { var i = byId('askTok'); if (i) i.focus(); }, 50); }

  // ------------------------------------------------------------------ input binding + events
  function bindVal(id, key) { var el = byId(id); if (!el) return; el.oninput = function () { S[key] = key === 'port' ? (+el.value || 47814) : el.value.trim(); }; }

  document.addEventListener('click', function (ev) {
    var el = ev.target; while (el && el !== document && !(el.getAttribute && el.getAttribute('data-act'))) el = el.parentNode;
    var copyEl = ev.target; while (copyEl && copyEl !== document && !(copyEl.getAttribute && copyEl.getAttribute('data-copy'))) copyEl = copyEl.parentNode;
    if (copyEl && copyEl.getAttribute && copyEl.getAttribute('data-copy') && (!el || el === document)) { doCopy(copyEl.getAttribute('data-copy')); return; }
    if (!el || el === document) return;
    var a = el.getAttribute('data-act');
    if (a !== 'connect') ev.preventDefault();
    switch (a) {
      case 'connect': connect(); break;
      case 'go': show(el.getAttribute('data-tab')); break;
      case 'mode': {
        var nm = el.getAttribute('data-mode'); if (nm === S.mode) break;
        S.mode = nm; lsSet('mode', nm);
        // swap the default port if it's still the other mode's default
        if (nm === 'rooted' && (S.port === 47814 || !S.port)) { S.port = 47815; lsSet('port', S.port); }
        if (nm === 'controller' && S.port === 47815) { S.port = 47814; lsSet('port', S.port); }
        if (S.ws) { S.autoReconnect = false; try { S.ws.close(); } catch (e) {} S.ws = null; S.connected = S.authed = false; setConn(); }
        render(); break;
      }
      case 'launch': action('launch', el.getAttribute('data-arg') || '', function (ok) { toast(ok ? 'ok' : 'warn', ok ? t('started') : 'hiba'); }); break;
      case 'openkit': action('openkit', '', function (ok) { toast(ok ? 'ok' : 'warn', ok ? t('started') : 'hiba'); }); break;
      case 'macro': {
        var mid = el.getAttribute('data-id'), danger = el.getAttribute('data-danger') === '1';
        if (!S.pc.allowRun) { toast('warn', t('runDisabled')); break; }
        var run = function () { send('MACRO|' + mid + '|' + (danger ? '1' : '0') + '|' + cmd()); toast('info', t('running')); };
        if (danger) { var m = find(S.macros, mid); confirmSheet(t('dangerRun'), m ? m.label : mid, run); } else run();
        break;
      }
      case 'push': S.wiz = null; pushKit(el.getAttribute('data-deploy') === '1'); break;
      case 'verify': S.wiz = null; action('verify', '', function (ok) { toast(ok ? 'ok' : 'warn', t('verifyRes')); }); break;
      case 'help': S.helpSel = el.getAttribute('data-id'); renderHelp(); try { byId('main').scrollTop = 0; } catch (e) {} break;
      case 'help-back': S.helpSel = null; renderHelp(); break;
      case 'sheet-cancel': sheet(''); break;
      case 'sheet-yes': sheet(''); if (S.sheetYes) S.sheetYes(); break;
      case 'sheet-token': { var i = byId('askTok'); S.token = i ? i.value.trim() : S.token; sheet(''); if (S.connected) send('AUTH|' + S.token); break; }
    }
  });
  function find(arr, id) { for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i]; return null; }
  function doCopy(s) { try { if (navigator.clipboard) navigator.clipboard.writeText(s); else { var ta = document.createElement('textarea'); ta.value = s; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); } toast('ok', t('copied')); } catch (e) {} }

  byId('langBtn').onclick = function () { S.lang = S.lang === 'hu' ? 'en' : 'hu'; lsSet('lang', S.lang); cmdLang = ''; renderTabs(); render(); };

  // ------------------------------------------------------------------ start
  renderTabs(); show('connect');
})();
