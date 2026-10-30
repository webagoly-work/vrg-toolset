/* ServiceKit launcher (ES5 so it runs in Internet Explorer 11 on Windows 7 too).
   Live mode: served by core/server.ps1, polls /api/state.
   Offline mode: opened from disk, works as a guide and Súgó without live status. */
(function () {
  'use strict';

  var CAT = window.KIT_CATALOG || { categories: [], packages: [] };
  var SUGO = window.KIT_SUGO || { tasks: [], entries: [] };

  function meta(n) { var m = document.querySelector('meta[name="' + n + '"]'); return m ? m.getAttribute('content') : ''; }
  var TOKEN = meta('kit-token');
  var SERVER = TOKEN && TOKEN.indexOf('__') !== 0;

  // ------------------------------------------------------------------ storage (may be unavailable)
  function lsGet(k, d) { try { var v = window.localStorage.getItem('sk.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }
  function lsSet(k, v) { try { window.localStorage.setItem('sk.' + k, JSON.stringify(v)); } catch (e) { } }

  var S = {
    lang: lsGet('lang', 'hu'), theme: lsGet('theme', 'dark'), view: 'dash',
    live: false, fails: 0, data: null,
    installed: window.KIT_INSTALLED || {}, apps: {}, running: [],
    toolCat: 'all', toolStatus: 'all',
    helpSel: null, helpQ: '', helpCat: 'all',
    wsbNet: false, launches: lsGet('launches', {}),
    sigTools: '', sigRun: '', sigProg: '',
    pbSel: '', pbInc: {}, pbInputs: {}, pbAuto: false, pbResume: false, pbFocus: -1, pbOpen: {}, pbStarting: -1, pbSig: '',
    jobs: null, jobDetail: null, jobSig: '', form: { clientId: '', smart: true, keys: false }, noteDraft: '', docs: null, lastJobId: '', clientFilter: ''
  };

  // ------------------------------------------------------------------ indexes
  var PKG = {}, APP = {}, CATS = {};
  (function () {
    var i, j, p;
    for (i = 0; i < CAT.categories.length; i++) CATS[CAT.categories[i].id] = CAT.categories[i];
    for (i = 0; i < CAT.packages.length; i++) {
      p = CAT.packages[i]; PKG[p.id] = p;
      for (j = 0; j < p.apps.length; j++) APP[p.apps[j].id] = { pkg: p, app: p.apps[j] };
    }
  })();
  var ENTRY = {};
  (function () { for (var i = 0; i < SUGO.entries.length; i++) ENTRY[SUGO.entries[i].id] = SUGO.entries[i]; })();

  // ------------------------------------------------------------------ text
  var I = {
    hu: {
      live: 'Élő kapcsolat', offline: 'Offline útmutató', connecting: 'Kapcsolódás…',
      search: 'Keresés: program, hiba, tünet…', srTools: 'Programok', srHelp: 'Súgó', srNone: 'Nincs találat',
      cpu: 'CPU', ram: 'Memória', disk: 'Kit lemez', free: 'szabad',
      navDash: 'Irányítópult', navTools: 'Eszközök', navHelp: 'Súgó', navSafe: 'Biztonságos tér', navSetup: 'Telepítő',
      dashTitle: 'Irányítópult', dashLede: 'Mi fut most a kitből, mi töltődik le, és honnan érdemes indulni.',
      running: 'Futó programok', runEmpty: 'Most nem fut kit-program', runEmptySub: 'Indíts egyet lent, vagy válassz egy problémát.',
      offlineRun: 'Az élő állapothoz indítsd a START.cmd-t.',
      pid: 'PID', uptime: 'fut', stop: 'Leállítás', folder: 'Mappa',
      problems: 'Mi a gond?', problemsAside: 'Lépésről lépésre, offline',
      quick: 'Gyorsindítás', quickEmpty: 'Még nincs telepített program. Nyisd meg a Telepítőt.',
      progTitle: 'Telepítés folyamatban', progDone: 'Telepítés kész', progOf: '{0} / {1} csomag',
      phase_resolve: 'forrás keresése', phase_download: 'letöltés', phase_extract: 'kicsomagolás',
      st_queued: 'vár', st_working: 'folyamatban', st_ok: 'kész', st_error: 'hiba', st_manual: 'kézi', st_skipped: 'kihagyva',
      toolsTitle: 'Eszközök', toolsLede: 'Minden program a kit tools mappájából fut, telepítés nélkül. A sárga címke kézi letöltést jelent.',
      all: 'Mind', installed: 'Telepítve', missing: 'Hiányzik', runningB: 'Fut', manualB: 'Kézi letöltés',
      w7no: 'Win7-en nem fut', w7part: 'Win7: részben', w7legacy: 'Win7: régebbi verzió',
      launch: 'Indítás', launchAdmin: 'Indítás (admin)', admin: 'Admin', inBox: 'Dobozban', inWsb: 'Sandboxban',
      install: 'Letöltés', reinstall: 'Frissítés', page: 'Hivatalos oldal', inShell: 'A Kit Shellből érhető el',
      openShell: 'Kit Shell', isoHint: 'Fájl a mappában (Ventoyhoz másold)',
      noApps: 'Nincs találat ezekkel a szűrőkkel.',
      helpTitle: 'Súgó', helpLede: 'Offline hibaelhárító adatbázis. Válassz tünetet; a lépések mellett a hozzá való programot egy kattintással indíthatod.',
      helpSearch: 'Szűrés a Súgóban…', symptoms: 'Tünetek', steps: 'Lépések', tools: 'Hozzá való programok', caution: 'Vigyázz',
      helpAll: 'Mind', copy: 'másol', copied: 'Vágólapra másolva',
      safeTitle: 'Biztonságos tér', safeLede: 'Három szint, attól függően, mennyire bízol a programban. A Kit Shell csak tiszta munkakörnyezet; valódi elszigetelést a 2. és 3. szint ad.',
      l1t: 'Kit Shell – hordozható környezet', l1d: 'Parancssor, amelyben a Git, Node, Python, PowerShell 7 és a kit eszközei a pendrive-ról futnak. A beállítások és gyorsítótárak a kit data mappájában maradnak, a gépen nem marad nyom. Nem biztonsági határ.',
      l1venv: 'Python virtuális környezetek', venvName: 'környezet neve', venvNew: 'Új venv', venvOpen: 'Megnyitás', venvDel: 'Törlés', venvNoPy: 'Előbb telepítsd a Pythont.',
      l2t: 'Sandboxie-Plus – programok dobozban', l2d: 'A dobozban futó program fájl- és registry-módosításai elkülönítve maradnak, és egy kattintással törölhetők. Windows 7–11, egyszeri telepítés rendszergazdaként.',
      l2missing: 'Nincs telepítve. Töltsd le, majd futtasd a telepítőjét.', l2wipe: 'Doboz kiürítése', l2open: 'Sandboxie kezelő',
      l3t: 'Windows Sandbox – eldobható Windows', l3d: 'Teljes, elszigetelt Windows, ami bezáráskor mindenestül törlődik. A kit tools mappája csak olvasható, az exchange mappa írható csatornaként jelenik meg benne.',
      l3start: 'Sandbox indítása', l3net: 'Hálózat a sandboxban', l3enable: 'Funkció bekapcsolása', l3exchange: 'Exchange mappa',
      l3no: 'Ezen a gépen nem elérhető: Windows 10/11 Pro, Enterprise vagy Education kell, és bekapcsolt virtualizáció.',
      l3off: 'Elérhető, de nincs bekapcsolva. Bekapcsolás után újraindítás kell.',
      l3virt: 'A virtualizáció a BIOS-ban ki van kapcsolva.',
      needServer: 'Ehhez az Irányítópult kell: indítsd a START.cmd-t.',
      setupTitle: 'Telepítő', setupLede: 'A programokat mindig a hivatalos forrásukból tölti le. Bármikor újrafuttatható frissítéshez.',
      sInstalled: 'telepítve', sMissing: 'hiányzik', sManual: 'kézi letöltés', sTotal: 'csomag összesen',
      openSetup: 'Választó ablak megnyitása', setupCore: 'Alapcsomag letöltése', setupUpdate: 'Telepítettek frissítése',
      manualTitle: 'Kézi letöltést igénylő programok', manualHelp: 'Töltsd le a hivatalos oldalról, tedd a fájlt a tools\\_inbox mappába, és futtasd újra a Telepítőt: felismeri és a helyére teszi.',
      openInbox: 'Inbox mappa', openLogs: 'Naplók', kitFolder: 'Kit mappa', started: 'Elindítva', failed: 'Nem sikerült', setupStarted: 'A Telepítő elindult egy új ablakban.',
      e_not_installed: 'Ez a program még nincs letöltve.', e_sbie_missing: 'A Sandboxie-Plus nincs telepítve.', e_wsb_missing: 'A Windows Sandbox nincs bekapcsolva.',
      e_wsb_running: 'Már fut egy Windows Sandbox (egyszerre csak egy lehet).', e_python_missing: 'A Python nincs letöltve.', e_bad_name: 'Csak betű, szám, - és _ lehet a névben.',
      confirmStop: 'Biztosan leállítod: {0}?', confirmDel: 'Törlöd a(z) {0} környezetet?', confirmWipe: 'Kiüríted a Sandboxie dobozt? A benne lévő változások elvesznek.',
      navPb: 'Forgatókönyvek', navCmd: 'Parancsok', cmdTitle: 'Parancsok', cmdLede: 'CMD és PowerShell parancsok offline, kattintásra másolva. A változókat (IP, gépnév…) egyszer állítsd be. Önállóan is megvan: PARANCSOK.html a kit gyökerében.', pbTitle: 'Forgatókönyvek', pbLede: 'Lépésenkénti rutinok, amelyek el is végzik a munkát. Az ellenőrzések maguktól futnak, a változtatás előtt rákérdeznek, a kézi lépéseknél te jelzed, ha kész. Minden eredmény bekerül az aktív munka naplójába és a jelentésbe.',
      risk_safe: 'csak olvas', risk_changes: 'módosít', risk_repair: 'javít', kind_check: 'ellenőrzés', kind_action: 'művelet', kind_manual: 'kézi', longStep: 'hosszú',
      pbPrepare: 'Előkészítés', back: 'Vissza', pbNoJob: 'Nincs aktív munka: az eredmények így nem kerülnek jelentésbe. Indíts munkát:', pbStart: 'Forgatókönyv indítása',
      pbActive: 'Futó forgatókönyv', pbRunAll: 'Automatikus futtatás', pbPause: 'Szünet', pbFinish: 'Befejezés', pbAbort: 'Megszakítás', elevate: 'Rendszergazdai mód',
      elevateTip: 'Az Irányítópult újraindul rendszergazdaként, így nem kér minden lépésnél UAC jóváhagyást.', uacHint: 'A rendszergazdai lépések UAC jóváhagyást kérnek. Rendszergazdai módban csak egyszer kell jóváhagyni.',
      st_warn: 'figyelem', st_fail: 'hiba', st_info: 'tipp', st_done: 'kész', st_running: 'fut', st_pending: 'vár', pbLong: 'Ez a lépés sokáig tarthat (akár 30 perc).', pbWorking: 'Folyamatban…',
      showDetails: 'Részletek', hideDetails: 'Részletek elrejtése', pbDone: 'Kész', pbSkip: 'Kihagy', pbRunStep: 'Futtatás', pbAgain: 'Újra',
      pbConfirm: 'Ez a lépés módosítja a gépet. Futtatod?', pbManualWait: 'Kézi lépés következik: végezd el, majd nyomd meg a Kész gombot.', pbAllDone: 'A forgatókönyv lefutott.',
      pbNotePrompt: 'Megjegyzés a naplóba (nem kötelező):', confirmPbClose: 'Lezárod a forgatókönyvet? A hátralévő lépések nem futnak le.', elevating: 'Újraindulás rendszergazdaként…',
      runPlaybook: 'Forgatókönyv', e_step_running: 'Egy lépés még fut.', e_uac_declined: 'A rendszergazdai jóváhagyás elmaradt.', e_manual_step: 'Ez kézi lépés.',
      navJobs: 'Munkák', jobsTitle: 'Munkák és jelentések', jobsLede: 'Munka indításakor a kit pillanatképet készít a gépről. Lezáráskor újat, és a kettőből ügyfélnek szóló jelentés készül (HTML és PDF).',
      activeJob: 'Aktív munka', newJob: 'Új munka', client: 'Ügyfél', newClient: '+ Új ügyfél', cName: 'Név', cPhone: 'Telefon', cEmail: 'E-mail', cAddress: 'Cím',
      computer: 'Számítógép', taskLbl: 'Feladat, hibaleírás', smartOpt: 'Lemez SMART adatok a jelentésbe (rendszergazdai jóváhagyást kér)', keysOpt: 'OEM termékkulcs a jelentésbe',
      startJob: 'Munka indítása', addNote: 'Jegyzet hozzáadása', notePh: 'Mit csináltál? Pl. ventilátor tisztítás, 3 program eltávolítva…',
      interim: 'Közbenső jelentés', closeJob: 'Lezárás és jelentés', discard: 'Elvetés', confirmClose: 'Lezárod a munkát? Utána-pillanatkép és végleges jelentés készül.',
      confirmDiscard: 'Elveted az aktív munkát? A jegyzetek és pillanatképek törlődnek.', snapBefore: 'Előtte-pillanatkép', snapRunning: 'készül…', snapDone: 'kész', snapErr: 'hiba',
      taskRun_snapshot: 'Pillanatkép készül', taskRun_report: 'Jelentés készül', taskRun_close: 'Lezárás: pillanatkép és jelentés', taskRun_verify: 'Integritás-ellenőrzés',
      timeline: 'Napló', noTimeline: 'Még nincs bejegyzés. A kitből indított programok automatikusan ide kerülnek.',
      tech: 'Szerviz adatai (a jelentés fejlécén)', tName: 'Szerelő neve', tCompany: 'Cég', save: 'Mentés', saved: 'Elmentve',
      history: 'Korábbi munkák', allClients: 'Minden ügyfél', noJobs: 'Még nincs lezárt munka.', open: 'Megnyitás', pdf: 'PDF', reportReady: 'A jelentés elkészült.',
      csv: 'Munkalista (CSV)', reportsFolder: 'Jelentések mappa', st_open: 'folyamatban', st_closing: 'lezárás…', st_closed: 'lezárva',
      bannerJob: 'Aktív munka', bannerOpen: 'Megnyitás', e_job_active: 'Már van aktív munka.', e_task_busy: 'Egy háttérfeladat még fut, várj egy kicsit.', e_client_name: 'Add meg az ügyfél nevét.',
      e_no_active_job: 'Nincs aktív munka.', e_empty: 'Üres jegyzet.',
      integrity: 'Integritás-ellenőrzés', integrityLede: 'A Telepítő minden program SHA256 ujjlenyomatát elmenti. Az ellenőrzés jelzi, ha egy fájl azóta megváltozott vagy eltűnt.',
      verifyNow: 'Ellenőrzés most', iOk: 'rendben', iChanged: 'megváltozott', iMissing: 'hiányzik', iNone: 'Még nem futott ellenőrzés.', iSigned: 'aláíró', iUnsigned: 'aláíratlan',
      docs: 'Saját dokumentumok', docsLede: 'Adatlapok, bekötési rajzok, kézikönyvek: tedd őket a kit docs mappájába.', docsEmpty: 'A docs mappa üres.', docsFolder: 'docs mappa',
      theme: 'Téma', w7warn: 'Windows 7 / 8.1 gép: néhány program helyett régebbi verzió töltődik le, néhány pedig nem fut.'
    },
    en: {
      live: 'Live', offline: 'Offline guide', connecting: 'Connecting…',
      search: 'Search: program, error, symptom…', srTools: 'Programs', srHelp: 'Súgó (help)', srNone: 'No results',
      cpu: 'CPU', ram: 'Memory', disk: 'Kit disk', free: 'free',
      navDash: 'Dashboard', navTools: 'Tools', navHelp: 'Súgó (help)', navSafe: 'Safe space', navSetup: 'Setup',
      dashTitle: 'Dashboard', dashLede: 'What is running from the kit, what is downloading, and where to start.',
      running: 'Running programs', runEmpty: 'No kit program is running', runEmptySub: 'Start one below or pick a problem.',
      offlineRun: 'Start START.cmd for live status.',
      pid: 'PID', uptime: 'up', stop: 'Stop', folder: 'Folder',
      problems: 'What is the problem?', problemsAside: 'Step by step, offline',
      quick: 'Quick launch', quickEmpty: 'Nothing installed yet. Open Setup.',
      progTitle: 'Installing', progDone: 'Setup finished', progOf: '{0} / {1} packages',
      phase_resolve: 'finding source', phase_download: 'downloading', phase_extract: 'extracting',
      st_queued: 'queued', st_working: 'working', st_ok: 'done', st_error: 'error', st_manual: 'manual', st_skipped: 'skipped',
      toolsTitle: 'Tools', toolsLede: 'Every program runs from the kit tools folder without installing. A yellow tag means manual download.',
      all: 'All', installed: 'Installed', missing: 'Missing', runningB: 'Running', manualB: 'Manual download',
      w7no: 'Not on Win7', w7part: 'Win7: partial', w7legacy: 'Win7: older version',
      launch: 'Launch', launchAdmin: 'Launch (admin)', admin: 'Admin', inBox: 'In box', inWsb: 'In Sandbox',
      install: 'Download', reinstall: 'Update', page: 'Official page', inShell: 'Available in Kit Shell',
      openShell: 'Kit Shell', isoHint: 'File in the folder (copy it to Ventoy)',
      noApps: 'Nothing matches these filters.',
      helpTitle: 'Súgó', helpLede: 'Offline troubleshooting database. Pick a symptom; launch the matching program right next to the steps.',
      helpSearch: 'Filter the Súgó…', symptoms: 'Symptoms', steps: 'Steps', tools: 'Programs for this', caution: 'Caution',
      helpAll: 'All', copy: 'copy', copied: 'Copied to clipboard',
      safeTitle: 'Safe space', safeLede: 'Three levels, depending on how much you trust a program. Kit Shell is only a clean workspace; levels 2 and 3 give real isolation.',
      l1t: 'Kit Shell – portable environment', l1d: 'A command line where Git, Node, Python, PowerShell 7 and the kit tools run from the stick. Settings and caches stay in the kit data folder; nothing is left on the PC. Not a security boundary.',
      l1venv: 'Python virtual environments', venvName: 'environment name', venvNew: 'New venv', venvOpen: 'Open', venvDel: 'Delete', venvNoPy: 'Install Python first.',
      l2t: 'Sandboxie-Plus – programs in a box', l2d: 'A boxed program\'s file and registry changes stay separate and can be wiped with one click. Windows 7–11, one-time admin install.',
      l2missing: 'Not installed. Download it, then run its installer.', l2wipe: 'Empty the box', l2open: 'Sandboxie manager',
      l3t: 'Windows Sandbox – disposable Windows', l3d: 'A full, isolated Windows that is deleted completely when closed. The kit tools folder appears read-only inside it, and the exchange folder is a writable channel.',
      l3start: 'Start Sandbox', l3net: 'Network in sandbox', l3enable: 'Enable feature', l3exchange: 'Exchange folder',
      l3no: 'Not available on this PC: needs Windows 10/11 Pro, Enterprise or Education with virtualization on.',
      l3off: 'Available but not enabled. A restart is needed after enabling.',
      l3virt: 'Virtualization is disabled in the BIOS.',
      needServer: 'This needs the Dashboard: start START.cmd.',
      setupTitle: 'Setup', setupLede: 'Programs always come from their official source. Re-run any time to update.',
      sInstalled: 'installed', sMissing: 'missing', sManual: 'manual download', sTotal: 'packages in total',
      openSetup: 'Open selection window', setupCore: 'Download core set', setupUpdate: 'Update installed',
      manualTitle: 'Programs that need a manual download', manualHelp: 'Download from the official page, put the file in tools\\_inbox and run Setup again: it recognises the file and installs it.',
      openInbox: 'Inbox folder', openLogs: 'Logs', kitFolder: 'Kit folder', started: 'Started', failed: 'Failed', setupStarted: 'Setup started in a new window.',
      e_not_installed: 'This program is not downloaded yet.', e_sbie_missing: 'Sandboxie-Plus is not installed.', e_wsb_missing: 'Windows Sandbox is not enabled.',
      e_wsb_running: 'A Windows Sandbox is already running (only one at a time).', e_python_missing: 'Python is not downloaded.', e_bad_name: 'Use only letters, digits, - and _.',
      confirmStop: 'Stop {0}?', confirmDel: 'Delete the {0} environment?', confirmWipe: 'Empty the Sandboxie box? Changes inside it are lost.',
      navPb: 'Playbooks', navCmd: 'Commands', cmdTitle: 'Commands', cmdLede: 'CMD and PowerShell commands offline, copied with a click. Set the variables (IP, host…) once. Also available standalone: PARANCSOK.html in the kit root.', pbTitle: 'Playbooks', pbLede: 'Step-by-step routines that do the work. Checks run on their own, changes ask first, and manual steps wait for you. Every result goes into the active job log and the report.',
      risk_safe: 'read-only', risk_changes: 'changes', risk_repair: 'repairs', kind_check: 'check', kind_action: 'action', kind_manual: 'manual', longStep: 'long',
      pbPrepare: 'Prepare', back: 'Back', pbNoJob: 'No active job: results won\'t go into a report. Start a job:', pbStart: 'Start playbook',
      pbActive: 'Running playbook', pbRunAll: 'Run automatically', pbPause: 'Pause', pbFinish: 'Finish', pbAbort: 'Abort', elevate: 'Admin mode',
      elevateTip: 'Restarts the Dashboard as administrator so admin steps stop asking for UAC approval each time.', uacHint: 'Admin steps ask for UAC approval. In admin mode you approve only once.',
      st_warn: 'attention', st_fail: 'failed', st_info: 'tip', st_done: 'done', st_running: 'running', st_pending: 'waiting', pbLong: 'This step can take a while (up to 30 minutes).', pbWorking: 'Working…',
      showDetails: 'Details', hideDetails: 'Hide details', pbDone: 'Done', pbSkip: 'Skip', pbRunStep: 'Run', pbAgain: 'Again',
      pbConfirm: 'This step changes the PC. Run it?', pbManualWait: 'Manual step next: do it, then press Done.', pbAllDone: 'The playbook has finished.',
      pbNotePrompt: 'Note for the log (optional):', confirmPbClose: 'Close the playbook? Remaining steps will not run.', elevating: 'Restarting as administrator…',
      runPlaybook: 'Playbook', e_step_running: 'A step is still running.', e_uac_declined: 'Administrator approval was declined.', e_manual_step: 'This is a manual step.',
      navJobs: 'Jobs', jobsTitle: 'Jobs and reports', jobsLede: 'Starting a job takes a snapshot of the PC. Closing it takes another and builds a client report from the two (HTML and PDF).',
      activeJob: 'Active job', newJob: 'New job', client: 'Client', newClient: '+ New client', cName: 'Name', cPhone: 'Phone', cEmail: 'Email', cAddress: 'Address',
      computer: 'Computer', taskLbl: 'Task, fault description', smartOpt: 'Disk SMART data in the report (asks for admin approval)', keysOpt: 'OEM product key in the report',
      startJob: 'Start job', addNote: 'Add note', notePh: 'What did you do? E.g. cleaned fan, removed 3 programs…',
      interim: 'Interim report', closeJob: 'Close and report', discard: 'Discard', confirmClose: 'Close the job? An after-snapshot and the final report will be made.',
      confirmDiscard: 'Discard the active job? Notes and snapshots are deleted.', snapBefore: 'Before snapshot', snapRunning: 'running…', snapDone: 'done', snapErr: 'error',
      taskRun_snapshot: 'Taking snapshot', taskRun_report: 'Building report', taskRun_close: 'Closing: snapshot and report', taskRun_verify: 'Integrity check',
      timeline: 'Log', noTimeline: 'No entries yet. Programs launched from the kit are logged here automatically.',
      tech: 'Technician details (report header)', tName: 'Technician name', tCompany: 'Company', save: 'Save', saved: 'Saved',
      history: 'Past jobs', allClients: 'All clients', noJobs: 'No closed jobs yet.', open: 'Open', pdf: 'PDF', reportReady: 'The report is ready.',
      csv: 'Job list (CSV)', reportsFolder: 'Reports folder', st_open: 'in progress', st_closing: 'closing…', st_closed: 'closed',
      bannerJob: 'Active job', bannerOpen: 'Open', e_job_active: 'A job is already active.', e_task_busy: 'A background task is still running, wait a moment.', e_client_name: 'Enter the client name.',
      e_no_active_job: 'No active job.', e_empty: 'Empty note.',
      integrity: 'Integrity check', integrityLede: 'Setup stores a SHA256 fingerprint of every program. The check flags files that changed or disappeared since.',
      verifyNow: 'Check now', iOk: 'ok', iChanged: 'changed', iMissing: 'missing', iNone: 'No check has run yet.', iSigned: 'signer', iUnsigned: 'unsigned',
      docs: 'Your documents', docsLede: 'Datasheets, wiring diagrams, manuals: put them in the kit docs folder.', docsEmpty: 'The docs folder is empty.', docsFolder: 'docs folder',
      theme: 'Theme', w7warn: 'Windows 7 / 8.1 PC: some programs download an older version and some do not run.'
    }
  };
  function t(k) { var d = I[S.lang] || I.hu; return d[k] !== undefined ? d[k] : (I.hu[k] !== undefined ? I.hu[k] : k); }
  function fmt(s) { var a = arguments; return String(s).replace(/\{(\d)\}/g, function (m, n) { return a[+n + 1]; }); }
  function L(o) { if (!o) return ''; if (typeof o === 'string') return o; return o[S.lang] || o.hu || o.en || ''; }
  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function norm(s) {
    s = String(s || '').toLowerCase();
    var from = 'áéíóöőúüűàâäãåçèêëìîïñòôõùûýÿ', to = 'aeiooouuuaaaaaceeeiiinooouuyy';
    var out = '';
    for (var i = 0; i < s.length; i++) { var k = from.indexOf(s.charAt(i)); out += k >= 0 ? to.charAt(k) : s.charAt(i); }
    return out;
  }
  function byId(id) { return document.getElementById(id); }
  function hasClass(el, c) { return (' ' + el.className + ' ').indexOf(' ' + c + ' ') >= 0; }
  function setClass(el, c, on) {
    if (!el) return;
    var has = hasClass(el, c);
    if (on && !has) el.className = (el.className + ' ' + c).replace(/^\s+/, '');
    if (!on && has) el.className = (' ' + el.className + ' ').replace(' ' + c + ' ', ' ').replace(/^\s+|\s+$/g, '');
  }

  // ------------------------------------------------------------------ icons (stroke paths, 24x24)
  var IC = {
    pulse: '<path d="M3 12h4l2-6 4 12 2-6h6"/>',
    broom: '<path d="M14 4l6 6"/><path d="M11 7l6 6-5 7H4v-1l2-6z"/><path d="M8 20l2-5"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.5-4.5L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.5 4.5L20 16"/><path d="M20 20v-4h-4"/>',
    wrench: '<path d="M14.5 6.5a4 4 0 0 0 5 5L13 18a2.8 2.8 0 0 1-4-4z"/><path d="M14.5 6.5L17 4l3 3-2.5 2.5"/>',
    drive: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 14h.01M11 14h6"/>',
    network: '<rect x="9" y="3" width="6" height="5" rx="1"/><rect x="3" y="16" width="6" height="5" rx="1"/><rect x="15" y="16" width="6" height="5" rx="1"/><path d="M12 8v4M6 16v-4h12v4"/>',
    code: '<path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13 6l-2 12"/>',
    box: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>',
    home: '<path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-5h4v5"/>',
    usb: '<path d="M12 3v14"/><circle cx="12" cy="19" r="2"/><path d="M12 13l-4-3V7M12 11l4-2V6"/><rect x="6.5" y="5" width="3" height="2"/><circle cx="16" cy="5" r="1.2"/>',
    gamepad: '<rect x="2.5" y="7" width="19" height="11" rx="5"/><path d="M7 11v3M5.5 12.5h3"/><circle cx="15.5" cy="11.5" r=".8"/><circle cx="17.5" cy="13.5" r=".8"/>',
    lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><path d="M12 14v2"/>',
    dash: '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="5" rx="1.5"/><rect x="13" y="10" width="8" height="11" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/>',
    tools: '<path d="M14.5 6.5a4 4 0 0 0 5 5L13 18a2.8 2.8 0 0 1-4-4z"/><path d="M4 4l6 6"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14"/><path d="M12 17h.01"/>',
    setup: '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 17v3h16v-3"/>',
    play: '<path d="M7 5l12 7-12 7z"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="1.5"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    link: '<path d="M10 14l10-10M14 4h6v6"/><path d="M19 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/>',
    terminal: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3M12 15h5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    slow: '<circle cx="12" cy="13" r="8"/><path d="M12 13l3-3M12 5V3"/>',
    alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
    wifi: '<path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><path d="M12 19.5h.01"/>',
    bug: '<rect x="7" y="8" width="10" height="12" rx="5"/><path d="M12 8V5M9 5l1.5 2M15 5l-1.5 2M3 13h4M17 13h4M4 19l3-2M20 19l-3-2M4 7l3 2M20 7l-3 2"/>',
    power: '<path d="M12 3v8"/><path d="M6.3 6.3a8 8 0 1 0 11.4 0"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
    doc: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
    check: '<path d="M5 12l4 4 10-10"/>',
    note: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 5l1 1 2-2M4 11l1 1 2-2M4 17l1 1 2-2"/>'
  };
  function icon(name, cls) { return '<svg viewBox="0 0 24 24"' + (cls ? ' class="' + cls + '"' : '') + ' aria-hidden="true">' + (IC[name] || IC.box) + '</svg>'; }

  // ------------------------------------------------------------------ server calls
  function xhr(method, url, body, cb) {
    var r = new XMLHttpRequest();
    r.open(method, url, true);
    r.timeout = 8000;
    if (method === 'POST') { r.setRequestHeader('Content-Type', 'application/json'); r.setRequestHeader('X-Kit-Token', TOKEN); }
    r.onreadystatechange = function () {
      if (r.readyState !== 4) return;
      var d = null; try { d = JSON.parse(r.responseText); } catch (e) { }
      cb(r.status === 200 && d && d.ok !== false ? null : ((d && d.error) || ('http-' + r.status)), d);
    };
    r.ontimeout = function () { };
    r.send(body ? JSON.stringify(body) : null);
  }
  function act(path, body, okMsg, cb) {
    if (!SERVER || !S.live) { toast(t('needServer'), true); return; }
    xhr('POST', path, body || {}, function (err, d) {
      if (err === 'bad-token') { window.location.reload(); return; }
      if (err) {
        var k = 'e_' + String(err).replace(/-/g, '_');
        toast(I[S.lang][k] || I.hu[k] || (t('failed') + ': ' + err), true);
      } else if (okMsg) toast(okMsg);
      if (cb) cb(err, d);
      setTimeout(poll, 400);
    });
  }

  var pollTimer = null;
  function poll() {
    if (!SERVER) return;
    clearTimeout(pollTimer);
    xhr('GET', '/api/state', null, function (err, d) {
      if (err) {
        S.fails++;
        if (S.fails >= 2 && S.live) { S.live = false; renderLink(); renderAll(); }
      } else {
        var wasLive = S.live;
        S.fails = 0; S.live = true; S.data = d;
        S.installed = d.installed || {}; S.apps = d.apps || {}; S.running = d.running || [];
        if (!wasLive && d.settings && d.settings.lang && !lsGet('langSet', false)) { S.lang = d.settings.lang; }
        renderLink(); renderMeters();
        if (!wasLive) renderAll(); else renderLiveBits();
      }
      pollTimer = setTimeout(poll, S.live ? 1500 : 4000);
    });
  }

  // ------------------------------------------------------------------ helpers on state
  function isInstalled(pkgId) { return !!S.installed[pkgId]; }
  function appReady(appId) { return S.live ? !!S.apps[appId] : isInstalled(APP[appId] ? APP[appId].pkg.id : ''); }
  function runningOf(appId) { var r = []; for (var i = 0; i < S.running.length; i++) if (S.running[i].app === appId) r.push(S.running[i]); return r; }
  function isManual(p) { var s = p.source; return s && !s.length && s.type === 'manual'; }
  function isLegacy() { return !!(S.data && S.data.os && S.data.os.legacy); }
  function safe() { return (S.data && S.data.safe) || {}; }
  function parseIso(s) {
    var m = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)/.exec(s || '');
    return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : null;
  }
  function since(s) {
    var d = parseIso(s); if (!d) return '';
    var sec = Math.max(0, Math.floor((new Date() - d) / 1000));
    if (sec < 60) return sec + ' s';
    if (sec < 3600) return Math.floor(sec / 60) + ' min';
    return Math.floor(sec / 3600) + ' h ' + Math.floor((sec % 3600) / 60) + ' min';
  }
  function mb(n) { return n >= 1024 ? (n / 1024).toFixed(1) + ' GB' : Math.round(n) + ' MB'; }

  // ------------------------------------------------------------------ chrome
  var NAV = [
    { id: 'dash', icon: 'dash', key: 'navDash' }, { id: 'jobs', icon: 'briefcase', key: 'navJobs' }, { id: 'pb', icon: 'list', key: 'navPb' }, { id: 'tools', icon: 'tools', key: 'navTools' },
    { id: 'help', icon: 'help', key: 'navHelp' }, { id: 'cmd', icon: 'terminal', key: 'navCmd' }, { id: 'safe', icon: 'lock', key: 'navSafe' }, { id: 'setup', icon: 'setup', key: 'navSetup' }
  ];
  function renderNav() {
    var h = '', i, n, cnt;
    for (i = 0; i < NAV.length; i++) {
      n = NAV[i]; cnt = '';
      if (n.id === 'dash' && S.running.length) cnt = '<span class="count live">' + S.running.length + '</span>';
      if (n.id === 'jobs' && S.data && S.data.job) cnt = '<span class="count live">1</span>';
      if (n.id === 'pb' && pbRun() && !pbRun().closed) { var pc = pbCounts(pbRun()); cnt = '<span class="count live">' + pc.done + '/' + pc.total + '</span>'; }
      if (n.id === 'cmd' && window.KIT_COMMANDS) cnt = '<span class="count">' + window.KIT_COMMANDS.commands.length + '</span>';
      if (n.id === 'help') cnt = '<span class="count">' + SUGO.entries.length + '</span>';
      if (n.id === 'tools') cnt = '<span class="count">' + countInstalled() + '/' + CAT.packages.length + '</span>';
      h += '<button type="button" class="nav-btn' + (S.view === n.id ? ' active' : '') + '" data-act="view" data-view="' + n.id + '">' + icon(n.icon) + '<span class="lbl">' + esc(t(n.key)) + '</span>' + cnt + '</button>';
      if (n.id === 'cmd') h += '<div class="nav-sep"></div>';
    }
    h += '<div class="nav-sep"></div><button type="button" class="nav-btn" data-act="shell">' + icon('terminal') + '<span class="lbl">Kit Shell</span></button>';
    h += '<div class="nav-foot mono">' + esc(S.data ? S.data.kit : 'ServiceKit ' + (CAT.version || '')) + '</div>';
    byId('nav').innerHTML = h;
    var views = ['dash', 'jobs', 'pb', 'tools', 'help', 'cmd', 'safe', 'setup'];
    for (i = 0; i < views.length; i++) setClass(byId('view-' + views[i]), 'active', S.view === views[i]);
  }
  function countInstalled() { var n = 0; for (var k in S.installed) if (S.installed.hasOwnProperty(k) && PKG[k]) n++; return n; }

  function renderLink() {
    var el = byId('linkState');
    setClass(el, 'live', S.live); setClass(el, 'offline', !S.live);
    byId('linkText').innerHTML = esc(S.live ? t('live') : (SERVER ? t('connecting') : t('offline')));
  }

  function meterHtml(label, valText, pct) {
    var cls = pct > 90 ? 'hot' : (pct > 75 ? 'warn' : '');
    return '<div class="meter"><div class="meter-top"><span>' + esc(label) + '</span><b>' + esc(valText) + '</b></div><div class="meter-bar"><i class="' + cls + '" style="width:' + Math.max(0, Math.min(100, pct)) + '%"></i></div></div>';
  }
  function renderMeters() {
    var s = S.data && S.data.sys, h = '';
    if (s) {
      if (s.cpu !== null && s.cpu !== undefined) h += meterHtml(t('cpu'), s.cpu + '%', s.cpu);
      if (s.memTotalMB) { var used = s.memTotalMB - s.memFreeMB; h += meterHtml(t('ram'), Math.round(100 * used / s.memTotalMB) + '%', 100 * used / s.memTotalMB); }
      if (s.diskTotalGB) h += meterHtml(t('disk'), s.diskFreeGB + ' GB ' + t('free'), 100 - 100 * s.diskFreeGB / s.diskTotalGB);
    }
    byId('meters').innerHTML = h;
  }

  function renderChrome() {
    document.documentElement.setAttribute('lang', S.lang);
    document.body.className = S.theme === 'light' ? 'light' : 'dark';
    byId('langBtn').innerHTML = S.lang === 'hu' ? 'HU · <span style="opacity:.5">EN</span>' : '<span style="opacity:.5">HU</span> · EN';
    byId('themeBtn').innerHTML = icon(S.theme === 'light' ? 'moon' : 'sun');
    byId('themeBtn').setAttribute('title', t('theme'));
    byId('search').setAttribute('placeholder', t('search'));
    renderLink(); renderMeters(); renderNav();
  }

  // ------------------------------------------------------------------ buttons for an app
  function launchButtons(appId, compact) {
    var a = APP[appId]; if (!a) return '';
    var ready = appReady(appId), h = '';
    if (!ready) {
      if (isManual(a.pkg)) return '<button type="button" class="btn" data-act="page" data-pkg="' + a.pkg.id + '">' + icon('link') + esc(t('page')) + '</button>';
      return '<button type="button" class="btn" data-act="install" data-pkg="' + a.pkg.id + '">' + icon('setup') + esc(t('install')) + '</button>';
    }
    var adminFirst = !!a.app.admin;
    h += '<button type="button" class="btn primary" data-act="launch" data-app="' + appId + '" data-mode="' + (adminFirst ? 'admin' : 'normal') + '">' + icon('play') + esc(adminFirst ? t('launchAdmin') : t('launch')) + '</button>';
    if (compact) return h;
    if (!adminFirst) h += '<button type="button" class="btn" data-act="launch" data-app="' + appId + '" data-mode="admin" title="Run as administrator">' + esc(t('admin')) + '</button>';
    var sf = safe();
    if (sf.sbie && !a.app.installed) h += '<button type="button" class="btn" data-act="launch" data-app="' + appId + '" data-mode="sbie">' + icon('box') + esc(t('inBox')) + '</button>';
    if (sf.wsb && !a.app.installed) h += '<button type="button" class="btn" data-act="wsb" data-app="' + appId + '">' + icon('lock') + esc(t('inWsb')) + '</button>';
    return h;
  }

  // ------------------------------------------------------------------ dashboard
  function renderDash() {
    var h = '<h1>' + esc(t('dashTitle')) + '</h1><p class="lede">' + esc(t('dashLede')) + '</p>';
    if (!SERVER) h += '<div class="offline-note">' + esc(t('offlineRun')) + '</div>';
    else if (isLegacy()) h += '<div class="offline-note">' + esc(t('w7warn')) + '</div>';
    h += '<div id="jobBanner"></div><div id="progressBox"></div>';
    h += '<div class="section"><div class="section-head"><h2>' + esc(t('running')) + '</h2><span class="aside" id="runAside"></span></div><div id="runBox"></div></div>';
    h += '<div class="section"><div class="section-head"><h2>' + esc(t('problems')) + '</h2><span class="aside">' + esc(t('problemsAside')) + '</span></div><div class="cards">';
    for (var i = 0; i < SUGO.tasks.length; i++) {
      var tk = SUGO.tasks[i];
      h += '<button type="button" class="tile" data-act="help" data-id="' + esc(tk.entries[0]) + '">' + icon(tk.icon) + '<b>' + esc(L(tk.title)) + '</b><small>' + esc(L(tk.sub)) + '</small></button>';
    }
    h += '</div></div>';
    h += '<div class="section"><div class="section-head"><h2>' + esc(t('quick')) + '</h2></div><div id="quickBox"></div></div>';
    byId('view-dash').innerHTML = h;
    S.sigRun = '';
    renderRunning(); renderProgress(); renderQuick(); renderJobBanner();
  }

  function renderRunning() {
    var box = byId('runBox'); if (!box) return;
    var list = S.running, i, r, sig = '';
    for (i = 0; i < list.length; i++) sig += list[i].pid + ',';
    byId('runAside').innerHTML = S.live ? esc(list.length + ' ' + t('runningB').toLowerCase()) : '';
    if (sig === S.sigRun && sig !== '') {
      for (i = 0; i < list.length; i++) {
        r = list[i];
        var c = byId('cpu-' + r.pid), m = byId('mem-' + r.pid);
        if (c) { c.style.width = Math.min(100, r.cpu) + '%'; byId('cpuv-' + r.pid).innerHTML = r.cpu.toFixed(1) + '%'; }
        if (m) { m.style.width = Math.min(100, 100 * r.memMB / memScale()) + '%'; byId('memv-' + r.pid).innerHTML = mb(r.memMB); }
        var u = byId('up-' + r.pid); if (u) u.innerHTML = esc(since(r.started));
      }
      return;
    }
    S.sigRun = sig;
    if (!list.length) {
      box.innerHTML = '<div class="empty"><b>' + esc(t('runEmpty')) + '</b>' + esc(S.live ? t('runEmptySub') : (SERVER ? t('connecting') : t('offlineRun'))) + '</div>';
      return;
    }
    var h = '<div class="cards">';
    for (i = 0; i < list.length; i++) {
      r = list[i];
      var name = r.app && APP[r.app] ? APP[r.app].app.name : r.exe;
      h += '<div class="run-card"><div class="run-top"><span class="pulse"></span><span class="run-name" title="' + esc(r.path) + '">' + esc(name) + '</span></div>' +
        '<div class="run-meta mono">' + esc(t('pid')) + ' ' + r.pid + ' · ' + esc(t('uptime')) + ' <span id="up-' + r.pid + '">' + esc(since(r.started)) + '</span></div>' +
        '<div class="stat"><label>CPU</label><span class="bar"><i id="cpu-' + r.pid + '" style="width:' + Math.min(100, r.cpu) + '%"></i></span><span class="val mono" id="cpuv-' + r.pid + '">' + r.cpu.toFixed(1) + '%</span></div>' +
        '<div class="stat"><label>RAM</label><span class="bar"><i class="mem" id="mem-' + r.pid + '" style="width:' + Math.min(100, 100 * r.memMB / memScale()) + '%"></i></span><span class="val mono" id="memv-' + r.pid + '">' + mb(r.memMB) + '</span></div>' +
        '<div class="run-actions"><button type="button" class="btn danger" data-act="stop" data-pid="' + r.pid + '" data-name="' + esc(name) + '">' + icon('stop') + esc(t('stop')) + '</button>' +
        '<button type="button" class="btn ghost" data-act="folder" data-pkg="' + esc(r.pkg) + '">' + icon('folder') + esc(t('folder')) + '</button></div></div>';
    }
    box.innerHTML = h + '</div>';
  }
  function memScale() { var s = S.data && S.data.sys; return (s && s.memTotalMB) ? s.memTotalMB / 4 : 2048; }

  function renderProgress() {
    var boxes = [byId('progressBox'), byId('progressBox2')];
    var p = S.data && S.data.progress;
    var fresh = p && (p.running || (p.finished && (new Date() - (parseIso(p.finished) || 0)) < 10 * 60 * 1000));
    var sig = (p && fresh) ? JSON.stringify(p) : '';
    var b0 = boxes[0] && boxes[0].getAttribute('data-sig'), b1 = boxes[1] && boxes[1].getAttribute('data-sig');
    if ((!boxes[0] || b0 === sig) && (!boxes[1] || b1 === sig)) return;
    if (!sig) { for (var z = 0; z < 2; z++) if (boxes[z]) { boxes[z].innerHTML = ''; boxes[z].setAttribute('data-sig', ''); } return; }
    var pct = p.total ? Math.round(100 * p.done / p.total) : 0, h, c = p.current;
    if (c && c.phase === 'download' && c.size > 0) pct = Math.round(100 * (p.done + c.bytes / c.size) / p.total);
    h = '<div class="panel progress-panel"><div class="prog-head"><h2>' + esc(p.running ? t('progTitle') : t('progDone')) + '</h2><span class="aside">' + esc(fmt(t('progOf'), p.done, p.total)) + '</span></div>';
    h += '<div class="pbar' + (p.running ? '' : ' done') + '"><i style="width:' + pct + '%"></i></div>';
    if (c) {
      var name = PKG[c.id] ? PKG[c.id].name : c.id, sub = t('phase_' + c.phase);
      if (c.phase === 'download' && c.size > 0) sub += ' · ' + mb(c.bytes / 1048576) + ' / ' + mb(c.size / 1048576);
      h += '<div style="display:flex;font-size:13px;margin-bottom:6px"><b>' + esc(name) + '</b><span style="margin-left:auto;color:#8b949e">' + esc(sub) + '</span></div>';
      if (c.phase === 'download' && c.size > 0) h += '<div class="pbar small"><i style="width:' + Math.round(100 * c.bytes / c.size) + '%"></i></div>';
    }
    h += '<div class="chips">';
    for (var k in p.items) if (p.items.hasOwnProperty(k)) {
      var it = p.items[k];
      h += '<span class="chip ' + esc(it.status) + '" title="' + esc(it.msg || '') + '">' + esc(PKG[k] ? PKG[k].name : k) + ' · ' + esc(t('st_' + it.status)) + '</span>';
    }
    h += '</div>';
    if (p.log && p.log.length) h += '<div class="logbox mono">' + esc(p.log.slice(-6).join('\n')) + '</div>';
    h += '</div>';
    for (var y = 0; y < 2; y++) if (boxes[y]) { boxes[y].innerHTML = h; boxes[y].setAttribute('data-sig', sig); }
  }

  function renderQuick() {
    var box = byId('quickBox'); if (!box) return;
    var ids = [], k, i, p, j;
    for (k in S.launches) if (S.launches.hasOwnProperty(k) && APP[k] && appReady(k)) ids.push(k);
    ids.sort(function (a, b) { return S.launches[b] - S.launches[a]; });
    for (i = 0; i < CAT.packages.length && ids.length < 8; i++) {
      p = CAT.packages[i];
      if (p.tier !== 1) continue;
      for (j = 0; j < p.apps.length && ids.length < 8; j++) if (appReady(p.apps[j].id) && ids.indexOf(p.apps[j].id) < 0) ids.push(p.apps[j].id);
    }
    ids = ids.slice(0, 8);
    if (!ids.length) { box.innerHTML = '<div class="empty">' + esc(t('quickEmpty')) + ' <a href="#" data-act="view" data-view="setup">' + esc(t('navSetup')) + '</a></div>'; return; }
    var h = '<div class="panel" style="padding:0">';
    for (i = 0; i < ids.length; i++) {
      var a = APP[ids[i]], runs = runningOf(ids[i]).length;
      h += '<div class="app-row"><div class="app-text"><span class="app-name">' + esc(a.app.name) + '</span>' + (runs ? ' <span class="badge run">' + esc(t('runningB')) + '</span>' : '') +
        '<div class="app-tip">' + esc(L(a.app.desc)) + '</div></div><div class="app-actions">' + launchButtons(ids[i], true) + '</div></div>';
    }
    box.innerHTML = h + '</div>';
  }

  // ------------------------------------------------------------------ tools
  function pkgStatus(p) {
    if (isInstalled(p.id)) return 'installed';
    return 'missing';
  }
  function pkgRunning(p) { for (var i = 0; i < p.apps.length; i++) if (runningOf(p.apps[i].id).length) return true; return false; }

  function renderTools() {
    var sig = S.lang + S.toolCat + S.toolStatus + JSON.stringify(S.installed) + JSON.stringify(S.apps) + (S.live ? 1 : 0) + JSON.stringify(safe()) + runSig();
    if (sig === S.sigTools && byId('view-tools').innerHTML) return;
    S.sigTools = sig;
    var h = '<h1>' + esc(t('toolsTitle')) + '</h1><p class="lede">' + esc(t('toolsLede')) + '</p>';
    h += '<div class="toolbar">';
    h += '<button type="button" class="filter' + (S.toolCat === 'all' ? ' on' : '') + '" data-act="tcat" data-v="all">' + esc(t('all')) + '</button>';
    for (var i = 0; i < CAT.categories.length; i++) {
      var c = CAT.categories[i];
      h += '<button type="button" class="filter' + (S.toolCat === c.id ? ' on' : '') + '" data-act="tcat" data-v="' + c.id + '">' + esc(L(c)) + '</button>';
    }
    h += '</div><div class="toolbar">';
    var sts = [['all', 'all'], ['installed', 'installed'], ['missing', 'missing'], ['running', 'runningB']];
    for (i = 0; i < sts.length; i++) h += '<button type="button" class="filter' + (S.toolStatus === sts[i][0] ? ' on' : '') + '" data-act="tstatus" data-v="' + sts[i][0] + '">' + esc(t(sts[i][1])) + '</button>';
    h += '<span class="spacer"></span><button type="button" class="btn" data-act="folder" data-what="inbox">' + icon('folder') + esc(t('openInbox')) + '</button></div>';

    var any = false;
    if (S.toolCat === 'all' && S.toolStatus === 'all') h += docsHtml();
    for (i = 0; i < CAT.categories.length; i++) {
      var cat = CAT.categories[i];
      if (S.toolCat !== 'all' && S.toolCat !== cat.id) continue;
      var block = '';
      for (var j = 0; j < CAT.packages.length; j++) {
        var p = CAT.packages[j];
        if (p.cat !== cat.id) continue;
        var st = pkgStatus(p), run = pkgRunning(p);
        if (S.toolStatus === 'installed' && st !== 'installed') continue;
        if (S.toolStatus === 'missing' && st === 'installed') continue;
        if (S.toolStatus === 'running' && !run) continue;
        block += pkgHtml(p, st, run);
      }
      if (block) { any = true; h += '<div class="cat-block"><div class="cat-title">' + icon(cat.icon) + esc(L(cat)) + '</div>' + block + '</div>'; }
    }
    if (!any) h += '<div class="empty">' + esc(t('noApps')) + '</div>';
    byId('view-tools').innerHTML = h;
  }
  function runSig() { var s = ''; for (var i = 0; i < S.running.length; i++) s += S.running[i].app + ','; return s; }

  function pkgHtml(p, st, run) {
    var badges = '';
    if (run) badges += '<span class="badge run">' + esc(t('runningB')) + '</span>';
    badges += st === 'installed' ? '<span class="badge ok">' + esc(t('installed')) + '</span>' : (isManual(p) ? '<span class="badge manual">' + esc(t('manualB')) + '</span>' : '<span class="badge miss">' + esc(t('missing')) + '</span>');
    if (p.win7 === 'no') badges += '<span class="badge' + (isLegacy() ? ' warn' : '') + '">' + esc(t('w7no')) + '</span>';
    else if (p.win7 === 'legacy') badges += '<span class="badge">' + esc(t('w7legacy')) + '</span>';
    else if (p.win7 === 'partial') badges += '<span class="badge">' + esc(t('w7part')) + '</span>';
    var links = '';
    if (st === 'installed') links += '<button type="button" class="btn ghost" data-act="folder" data-pkg="' + p.id + '">' + icon('folder') + esc(t('folder')) + '</button>';
    if (!isManual(p)) links += '<button type="button" class="btn ghost" data-act="install" data-pkg="' + p.id + '">' + icon('setup') + esc(st === 'installed' ? t('reinstall') : t('install')) + '</button>';
    links += '<a class="btn ghost" href="' + esc(p.page) + '" target="_blank" rel="noopener" data-act="page" data-pkg="' + p.id + '">' + icon('link') + esc(t('page')) + '</a>';
    var h = '<div class="pkg" id="pkg-' + p.id + '"><div class="pkg-head"><div class="pkg-info"><div class="pkg-name">' + esc(p.name) + '</div><div class="pkg-desc">' + esc(L(p.desc)) + '</div>' +
      (p.note ? '<div class="pkg-note">' + esc(L(p.note)) + '</div>' : '') + '</div><div class="pkg-side">' + badges + '<div class="pkg-links">' + links + '</div></div></div>';
    if (!p.apps.length) {
      h += '<div class="app-row"><div class="app-text"><div class="app-tip">' + esc(p.format === 'iso' ? t('isoHint') : t('inShell')) + '</div></div><div class="app-actions">' +
        (p.format === 'iso' ? '' : '<button type="button" class="btn" data-act="shell">' + icon('terminal') + esc(t('openShell')) + '</button>') + '</div></div>';
    }
    for (var k = 0; k < p.apps.length; k++) {
      var a = p.apps[k];
      h += '<div class="app-row"><div class="app-text"><span class="app-name">' + esc(a.name) + '</span>' + (runningOf(a.id).length ? ' <span class="badge run">' + esc(t('runningB')) + '</span>' : '') +
        '<div class="app-tip">' + esc(L(a.desc)) + '</div></div><div class="app-actions">' + (st === 'installed' || appReady(a.id) ? launchButtons(a.id) : '') + '</div></div>';
    }
    return h + '</div>';
  }

  // ------------------------------------------------------------------ Súgó
  function richText(s) {
    s = esc(s);
    s = s.replace(/`([^`]+)`/g, function (m, c) { return '<code>' + c + '</code><button type="button" class="copy-btn" data-act="copy" data-text="' + c + '">' + esc(t('copy')) + '</button>'; });
    s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    return s;
  }
  function helpMatches(e, q) {
    if (S.helpCat !== 'all' && e.cat !== S.helpCat) return false;
    if (!q) return true;
    var hay = norm(L(e.title) + ' ' + (e.sym ? (e.sym.hu || []).join(' ') + ' ' + (e.sym.en || []).join(' ') : '') + ' ' + (e.tags || '') + ' ' + (e.title.en || ''));
    var words = norm(q).split(/\s+/);
    for (var i = 0; i < words.length; i++) if (words[i] && hay.indexOf(words[i]) < 0) return false;
    return true;
  }
  function renderHelp() {
    var v = byId('view-help');
    if (!byId('helpList')) {
      var h = '<h1>' + esc(t('helpTitle')) + '</h1><p class="lede">' + esc(t('helpLede')) + '</p>';
      h += '<div class="toolbar"><div class="search" style="max-width:340px;margin-right:12px"><input id="helpSearch" type="text" autocomplete="off" placeholder="' + esc(t('helpSearch')) + '" value="' + esc(S.helpQ) + '"></div></div>';
      h += '<div class="toolbar" id="helpCats"></div>';
      h += '<div class="help"><div class="help-list" id="helpList"></div><div class="help-body" id="helpBody"></div></div>';
      v.innerHTML = h;
      byId('helpSearch').onkeyup = function () { S.helpQ = this.value; renderHelpList(); };
    }
    var cats = SUGO.categories || [], ch = '<button type="button" class="filter' + (S.helpCat === 'all' ? ' on' : '') + '" data-act="hcat" data-v="all">' + esc(t('helpAll')) + '</button>';
    for (var i = 0; i < cats.length; i++) ch += '<button type="button" class="filter' + (S.helpCat === cats[i].id ? ' on' : '') + '" data-act="hcat" data-v="' + cats[i].id + '">' + esc(L(cats[i])) + '</button>';
    byId('helpCats').innerHTML = ch;
    renderHelpList(); renderHelpBody();
  }
  function renderHelpList() {
    var h = '', first = null;
    for (var i = 0; i < SUGO.entries.length; i++) {
      var e = SUGO.entries[i];
      if (!helpMatches(e, S.helpQ)) continue;
      if (!first) first = e.id;
      var cat = null; for (var c = 0; c < (SUGO.categories || []).length; c++) if (SUGO.categories[c].id === e.cat) cat = SUGO.categories[c];
      h += '<button type="button" class="help-item' + (S.helpSel === e.id ? ' active' : '') + '" data-act="help" data-id="' + e.id + '">' + esc(L(e.title)) + '<small>' + esc(cat ? L(cat) : '') + '</small></button>';
    }
    byId('helpList').innerHTML = h || '<div class="empty">' + esc(t('srNone')) + '</div>';
    if (!S.helpSel && first) { S.helpSel = first; renderHelpBody(); renderHelpList(); }
  }
  function renderHelpBody() {
    var e = ENTRY[S.helpSel], box = byId('helpBody'); if (!box) return;
    if (!e) { box.innerHTML = ''; return; }
    var h = '<div class="help-card"><h1>' + esc(L(e.title)) + '</h1>', i, list;
    list = e.sym ? (e.sym[S.lang] || e.sym.hu) : [];
    if (list && list.length) { h += '<h3>' + esc(t('symptoms')) + '</h3><ul class="sym">'; for (i = 0; i < list.length; i++) h += '<li>' + richText(list[i]) + '</li>'; h += '</ul>'; }
    list = e.steps[S.lang] || e.steps.hu;
    h += '<h3>' + esc(t('steps')) + '</h3><ol class="steps">'; for (i = 0; i < list.length; i++) h += '<li>' + richText(list[i]) + '</li>'; h += '</ol>';
    if (e.tools && e.tools.length) {
      h += '<h3>' + esc(t('tools')) + '</h3>';
      for (i = 0; i < e.tools.length; i++) {
        var a = APP[e.tools[i]]; if (!a) continue;
        h += '<div class="app-row" style="padding-left:0;padding-right:0"><div class="app-text"><span class="app-name">' + esc(a.app.name) + '</span><div class="app-tip">' + esc(L(a.app.desc)) + '</div></div><div class="app-actions">' + launchButtons(e.tools[i], true) + '</div></div>';
      }
    }
    var pl = (PBD.sugoLinks || {})[e.id] || [];
    if (pl.length) { h += '<h3>' + esc(t('navPb')) + '</h3><div class="level-actions">'; for (i = 0; i < pl.length; i++) if (PB[pl[i]]) h += '<button type="button" class="btn" data-act="pb-goto" data-id="' + pl[i] + '">' + icon('list') + esc(L(PB[pl[i]].title)) + '</button>'; h += '</div>'; }
    if (e.warn) h += '<div class="warnbox"><b>' + esc(t('caution')) + ':</b> ' + richText(L(e.warn)) + '</div>';
    box.innerHTML = h + '</div>';
  }

  // ------------------------------------------------------------------ safe space
  function shieldMeter(n) { var h = '<span class="shield-meter">'; for (var i = 1; i <= 3; i++) h += '<i' + (i <= n ? ' class="on"' : '') + '></i>'; return h + '</span>'; }
  function renderSafe() {
    var sf = safe(), h = '<h1>' + esc(t('safeTitle')) + '</h1><p class="lede">' + esc(t('safeLede')) + '</p>', i;
    if (!S.live) h += '<div class="offline-note">' + esc(t('needServer')) + '</div>';
    h += '<div class="level"><div class="level-num">1</div><div class="level-body"><h2>' + esc(t('l1t')) + shieldMeter(0) + '</h2><p>' + esc(t('l1d')) + '</p>' +
      '<div class="level-actions"><button type="button" class="btn primary" data-act="shell">' + icon('terminal') + 'Kit Shell</button></div>' +
      '<h2 style="margin-top:14px">' + esc(t('l1venv')) + '</h2>';
    if (S.live && !sf.python) h += '<p>' + esc(t('venvNoPy')) + ' <button type="button" class="btn" data-act="install" data-pkg="python">' + icon('setup') + 'Python</button></p>';
    else {
      h += '<div class="inline-form"><input id="venvName" type="text" placeholder="' + esc(t('venvName')) + '" maxlength="40"><button type="button" class="btn" data-act="venv-new">' + esc(t('venvNew')) + '</button></div><div class="envs">';
      var envs = sf.envs || [];
      for (i = 0; i < envs.length; i++) h += '<span class="env mono">' + esc(envs[i]) + '<button type="button" class="btn" data-act="venv-open" data-name="' + esc(envs[i]) + '">' + esc(t('venvOpen')) + '</button><button type="button" class="btn danger" data-act="venv-del" data-name="' + esc(envs[i]) + '">' + esc(t('venvDel')) + '</button></span>';
      h += '</div>';
    }
    h += '</div></div>';

    h += '<div class="level"><div class="level-num">2</div><div class="level-body"><h2>' + esc(t('l2t')) + shieldMeter(2) + '</h2><p>' + esc(t('l2d')) + '</p><div class="level-actions">';
    if (sf.sbie) h += launchButtons('sandboxie', true) + '<button type="button" class="btn danger" data-act="sbie-wipe">' + esc(t('l2wipe')) + '</button>';
    else h += '<p>' + esc(t('l2missing')) + '</p>' + launchButtons('sandboxie', true);
    h += '</div></div></div>';

    h += '<div class="level"><div class="level-num">3</div><div class="level-body"><h2>' + esc(t('l3t')) + shieldMeter(3) + '</h2><p>' + esc(t('l3d')) + '</p><div class="level-actions">';
    if (sf.wsb) {
      h += '<label class="toggle"><input type="checkbox" id="wsbNet"' + (S.wsbNet ? ' checked' : '') + '>' + esc(t('l3net')) + '</label>' +
        '<button type="button" class="btn primary" data-act="wsb">' + icon('lock') + esc(t('l3start')) + '</button>' +
        '<button type="button" class="btn" data-act="folder" data-what="exchange">' + icon('folder') + esc(t('l3exchange')) + '</button>';
    } else if (sf.wsbPossible) {
      h += '<p>' + esc(t('l3off')) + (sf.virtualization === false ? ' ' + esc(t('l3virt')) : '') + '</p><button type="button" class="btn" data-act="wsb-enable">' + esc(t('l3enable')) + '</button>';
    } else h += '<p>' + esc(t('l3no')) + '</p>';
    h += '</div></div></div>';
    byId('view-safe').innerHTML = h;
    var cb = byId('wsbNet'); if (cb) cb.onclick = function () { S.wsbNet = this.checked; };
  }

  // ------------------------------------------------------------------ setup
  function renderSetup() {
    var ins = 0, man = 0, miss = 0, i, p, manualH = '';
    for (i = 0; i < CAT.packages.length; i++) {
      p = CAT.packages[i];
      if (isInstalled(p.id)) ins++; else if (isManual(p)) { man++; } else miss++;
      if (isManual(p) && !isInstalled(p.id)) manualH += '<div class="manual-row"><div class="app-text"><span class="app-name">' + esc(p.name) + '</span><div class="app-tip">' + esc(L(p.desc)) + '</div></div>' +
        '<a class="btn" href="' + esc(p.page) + '" target="_blank" rel="noopener" data-act="page" data-pkg="' + p.id + '">' + icon('link') + esc(t('page')) + '</a></div>';
    }
    var h = '<h1>' + esc(t('setupTitle')) + '</h1><p class="lede">' + esc(t('setupLede')) + '</p>';
    h += '<div class="summary-row"><div class="summary"><b>' + ins + '</b><span>' + esc(t('sInstalled')) + '</span></div><div class="summary"><b>' + miss + '</b><span>' + esc(t('sMissing')) + '</span></div>' +
      '<div class="summary"><b>' + man + '</b><span>' + esc(t('sManual')) + '</span></div><div class="summary"><b>' + CAT.packages.length + '</b><span>' + esc(t('sTotal')) + '</span></div></div>';
    h += '<div class="level-actions" style="margin-bottom:22px"><button type="button" class="btn primary" data-act="setup-gui">' + icon('setup') + esc(t('openSetup')) + '</button>' +
      '<button type="button" class="btn" data-act="setup-core">' + esc(t('setupCore')) + '</button><button type="button" class="btn" data-act="setup-update">' + icon('refresh') + esc(t('setupUpdate')) + '</button>' +
      '<button type="button" class="btn ghost" data-act="folder" data-what="kit">' + icon('folder') + esc(t('kitFolder')) + '</button><button type="button" class="btn ghost" data-act="folder" data-what="logs">' + icon('folder') + esc(t('openLogs')) + '</button></div>';
    h += '<div id="progressBox2"></div>';
    if (manualH) h += '<div class="section"><div class="section-head"><h2>' + esc(t('manualTitle')) + '</h2><button type="button" class="btn" style="margin-left:auto" data-act="folder" data-what="inbox">' + icon('folder') + esc(t('openInbox')) + '</button></div>' +
      '<p class="lede">' + esc(t('manualHelp')) + '</p><div class="panel">' + manualH + '</div></div>';
    if (S.live) h += integrityHtml();
    byId('view-setup').innerHTML = h;
    renderProgress();
  }

  // ------------------------------------------------------------------ jobs
  function call(path, body, cb) {
    if (!SERVER || !S.live) { cb('offline', null); return; }
    xhr('POST', path, body || {}, cb);
  }
  function errText(err) { var k = 'e_' + String(err).replace(/-/g, '_'); return I[S.lang][k] || I.hu[k] || (t('failed') + ': ' + err); }
  function fmtTime(iso, withDate) {
    var d = parseIso(iso); if (!d) return '';
    function p2(n) { return (n < 10 ? '0' : '') + n; }
    var tm = p2(d.getHours()) + ':' + p2(d.getMinutes());
    return withDate ? d.getFullYear() + '.' + p2(d.getMonth() + 1) + '.' + p2(d.getDate()) + '. ' + tm : tm;
  }
  function durMin(a, b) { var x = parseIso(a), y = b ? parseIso(b) : new Date(); return (x && y) ? Math.max(0, Math.round((y - x) / 60000)) : 0; }
  function durTxt(m) { return m >= 60 ? Math.floor(m / 60) + ' h ' + (m % 60) + ' min' : m + ' min'; }
  function activeJob() { return S.data && S.data.job; }
  function curTask() { return S.data && S.data.task; }
  function taskRunning(jobId) { var k = curTask(); return !!(k && k.phase === 'running' && (!jobId || k.job === jobId)); }

  function loadJobs(then) {
    call('/api/jobs', {}, function (err, d) { if (!err) S.jobs = d; if (then) then(); else if (S.view === 'jobs') renderJobs(true); });
  }
  function loadJobDetail(id, then) {
    call('/api/job-get', { id: id }, function (err, d) { if (!err) S.jobDetail = d.job; if (then) then(); else if (S.view === 'jobs') renderJobs(true); });
  }

  function renderJobBanner() {
    var box = byId('jobBanner'); if (!box) return;
    var j = activeJob();
    if (!j) { box.innerHTML = ''; return; }
    box.innerHTML = '<div class="job-banner">' + icon('briefcase') + '<div class="jb-text"><b>' + esc(t('bannerJob')) + '</b> · ' + esc(j.client) + ' · <span class="mono">' + esc(j.computer) + '</span> · <span id="jbTimer">' + esc(durTxt(durMin(j.started))) + '</span>' +
      (taskRunning(j.id) ? ' · <span class="spin"></span> ' + esc(t('taskRun_' + curTask().action)) : '') + '</div>' +
      '<button type="button" class="btn" data-act="view" data-view="jobs">' + icon('note') + esc(t('bannerOpen')) + '</button></div>';
  }

  function field(id, label, value, type) {
    return '<label class="fld"><span>' + esc(label) + '</span><input id="' + id + '" data-bind="' + id + '" type="' + (type || 'text') + '" value="' + esc(value || '') + '"></label>';
  }

  function renderJobs(force) {
    var v = byId('view-jobs'); if (!v) return;
    var j = activeJob(), k = curTask();
    var sig = S.lang + '|' + (S.live ? 1 : 0) + '|' + (j ? j.id + j.status + j.notes + j.actions : '-') + '|' + (k ? k.action + k.phase + k.job + k.msg : '') + '|' + (S.jobs ? S.jobs.jobs.length : -1) + '|' + (S.jobDetail ? S.jobDetail.id + (S.jobDetail.notes || []).length + (S.jobDetail.actions || []).length : '');
    if (!force && sig === S.jobSig) { var tm = byId('jobTimer'); if (tm && j) tm.innerHTML = esc(durTxt(durMin(j.started))); return; }
    S.jobSig = sig;
    var h = '<h1>' + esc(t('jobsTitle')) + '</h1><p class="lede">' + esc(t('jobsLede')) + '</p>';
    if (!S.live) { v.innerHTML = h + '<div class="offline-note">' + esc(t('needServer')) + '</div>'; return; }
    if (!S.jobs) { v.innerHTML = h + '<div class="empty">' + esc(t('connecting')) + '</div>'; loadJobs(); return; }

    if (j) {
      if (!S.jobDetail || S.jobDetail.id !== j.id || (S.jobDetail.notes || []).length !== j.notes || (S.jobDetail.actions || []).length !== j.actions) { loadJobDetail(j.id); }
      var jd = S.jobDetail && S.jobDetail.id === j.id ? S.jobDetail : null;
      var snap = j.before ? '<span class="chip ok">' + esc(t('snapBefore')) + ' · ' + esc(t('snapDone')) + '</span>' :
        (taskRunning(j.id) && k.action === 'snapshot' ? '<span class="chip working"><span class="spin"></span>' + esc(t('snapBefore')) + ' · ' + esc(t('snapRunning')) + '</span>' :
          (k && k.job === j.id && k.phase === 'error' ? '<span class="chip error" title="' + esc(k.msg) + '">' + esc(t('snapBefore')) + ' · ' + esc(t('snapErr')) + '</span>' : ''));
      h += '<div class="panel job-active"><div class="ja-head"><div><div class="ja-label">' + esc(t('activeJob')) + ' · <span class="mono">' + esc(j.id) + '</span></div>' +
        '<div class="ja-title">' + esc(j.client) + ' <span class="muted">· ' + esc(j.computer) + '</span></div>' +
        (j.task ? '<div class="ja-task">' + esc(j.task) + '</div>' : '') + '</div><div class="ja-timer"><span id="jobTimer">' + esc(durTxt(durMin(j.started))) + '</span><small>' + esc(fmtTime(j.started)) + ' –</small></div></div>';
      h += '<div class="chips">' + snap + '<span class="chip">' + esc(t('st_' + j.status)) + '</span></div>';
      if (taskRunning(j.id)) h += '<div class="task-run"><span class="spin"></span>' + esc(t('taskRun_' + k.action)) + (k.msg && k.msg !== 'starting' ? ' · ' + esc(k.msg) : '') + '<div class="pbar small"><i class="indet"></i></div></div>';
      else if (k && k.job === j.id && k.phase === 'error') h += '<div class="warnbox">' + esc(t('failed')) + ': ' + esc(k.msg) + '</div>';
      h += '<div class="note-form"><textarea id="noteText" data-bind="noteDraft" rows="2" placeholder="' + esc(t('notePh')) + '">' + esc(S.noteDraft) + '</textarea>' +
        '<button type="button" class="btn primary" data-act="job-note">' + icon('note') + esc(t('addNote')) + '</button></div>';
      h += '<h2 style="margin-top:16px">' + esc(t('timeline')) + '</h2>';
      var items = [], i;
      if (jd) {
        for (i = 0; i < (jd.notes || []).length; i++) items.push({ t: jd.notes[i].t, html: esc(jd.notes[i].text), note: 1 });
        for (i = 0; i < (jd.actions || []).length; i++) { var ac = jd.actions[i]; items.push({ t: ac.t, html: '<span class="muted">' + esc(ac.name || ac.app) + ' · ' + esc(t('started').toLowerCase()) + (ac.mode && ac.mode !== 'normal' ? ' (' + esc(ac.mode) + ')' : '') + '</span>' }); }
      }
      items.sort(function (a, b) { return a.t < b.t ? -1 : 1; });
      if (!items.length) h += '<div class="empty small">' + esc(t('noTimeline')) + '</div>';
      else { h += '<ul class="timeline">'; for (i = 0; i < items.length; i++) h += '<li' + (items[i].note ? ' class="is-note"' : '') + '><span class="tl-t mono">' + esc(fmtTime(items[i].t)) + '</span>' + items[i].html + '</li>'; h += '</ul>'; }
      var busy = taskRunning() ? ' disabled' : '';
      h += '<div class="level-actions" style="margin-top:14px"><button type="button" class="btn primary" data-act="job-close"' + busy + '>' + icon('check') + esc(t('closeJob')) + '</button>' +
        '<button type="button" class="btn" data-act="job-report"' + busy + '>' + icon('doc') + esc(t('interim')) + '</button>';
      var cur = null; for (i = 0; i < S.jobs.jobs.length; i++) if (S.jobs.jobs[i].id === j.id) cur = S.jobs.jobs[i];
      if (cur && cur.html) h += '<button type="button" class="btn" data-act="open-file" data-path="' + esc(cur.html) + '">' + esc(t('open')) + '</button>';
      h += '<button type="button" class="btn danger" style="margin-left:auto" data-act="job-discard">' + esc(t('discard')) + '</button></div></div>';
    } else {
      var f = S.form, clients = S.jobs.clients || [], opts = '<option value="">' + esc(t('newClient')) + '</option>';
      for (var c = 0; c < clients.length; c++) if (clients[c]) opts += '<option value="' + esc(clients[c].id) + '"' + (f.clientId === clients[c].id ? ' selected' : '') + '>' + esc(clients[c].name) + '</option>';
      h += '<div class="panel"><h2>' + esc(t('newJob')) + '</h2><div class="form-grid">';
      h += '<label class="fld"><span>' + esc(t('client')) + '</span><select id="clientSel" data-bind="clientId">' + opts + '</select></label>';
      h += field('computer', t('computer'), f.computer !== undefined ? f.computer : (S.data && S.data.computer) || '');
      if (!f.clientId) h += field('cName', t('cName'), f.cName) + field('cPhone', t('cPhone'), f.cPhone, 'tel') + field('cEmail', t('cEmail'), f.cEmail, 'email') + field('cAddress', t('cAddress'), f.cAddress);
      h += '</div><label class="fld wide"><span>' + esc(t('taskLbl')) + '</span><textarea id="task" data-bind="task" rows="2">' + esc(f.task || '') + '</textarea></label>';
      h += '<label class="toggle"><input type="checkbox" data-bind="smart"' + (f.smart ? ' checked' : '') + '>' + esc(t('smartOpt')) + '</label>';
      h += '<label class="toggle"><input type="checkbox" data-bind="keys"' + (f.keys ? ' checked' : '') + '>' + esc(t('keysOpt')) + '</label>';
      h += '<div class="level-actions" style="margin-top:12px"><button type="button" class="btn primary" data-act="job-start"' + (taskRunning() ? ' disabled' : '') + '>' + icon('play') + esc(t('startJob')) + '</button></div></div>';
    }

    // history
    var jobs = S.jobs.jobs || [], rows = '', n = 0, cf = S.clientFilter, copts = '<option value="">' + esc(t('allClients')) + '</option>', seen = {};
    for (var q = 0; q < jobs.length; q++) {
      var jb = jobs[q];
      if (jb.clientId && !seen[jb.clientId]) { seen[jb.clientId] = 1; copts += '<option value="' + esc(jb.clientId) + '"' + (cf === jb.clientId ? ' selected' : '') + '>' + esc(jb.client) + '</option>'; }
      if (jb.status === 'open' || jb.status === 'closing') continue;
      if (cf && jb.clientId !== cf) continue;
      n++;
      rows += '<tr><td class="mono small">' + esc(fmtTime(jb.started, true)) + '</td><td><b>' + esc(jb.client) + '</b><div class="small muted">' + esc(jb.task) + '</div></td><td class="mono small">' + esc(jb.computer) + '</td><td class="small">' + esc(durTxt(durMin(jb.started, jb.ended))) + '</td><td class="row-actions">' +
        (jb.html ? '<button type="button" class="btn" data-act="open-file" data-path="' + esc(jb.html) + '">' + icon('doc') + 'HTML</button>' : '') +
        (jb.pdf ? '<button type="button" class="btn" data-act="open-file" data-path="' + esc(jb.pdf) + '">' + esc(t('pdf')) + '</button>' : '') +
        '<button type="button" class="btn ghost" data-act="folder" data-what="job" data-job="' + esc(jb.id) + '">' + icon('folder') + '</button></td></tr>';
    }
    h += '<div class="section" style="margin-top:26px"><div class="section-head"><h2>' + esc(t('history')) + '</h2><span class="aside"><select id="clientFilter" data-bind="clientFilter" class="sel">' + copts + '</select></span></div>';
    h += n ? '<div class="panel" style="padding:4px 12px"><table class="jobs-table">' + rows + '</table></div>' : '<div class="empty">' + esc(t('noJobs')) + '</div>';
    h += '<div class="level-actions" style="margin-top:10px"><button type="button" class="btn" data-act="open-file" data-path="data/jobs.csv">' + icon('doc') + esc(t('csv')) + '</button>' +
      '<button type="button" class="btn ghost" data-act="folder" data-what="reports">' + icon('folder') + esc(t('reportsFolder')) + '</button></div></div>';

    // technician
    var tc = S.jobs.tech || {};
    h += '<details class="panel tech"' + (tc.name ? '' : ' open') + '><summary>' + esc(t('tech')) + '</summary><div class="form-grid" style="margin-top:12px">' +
      field('tName', t('tName'), tc.name) + field('tCompany', t('tCompany'), tc.company) + field('tPhone', t('cPhone'), tc.phone, 'tel') + field('tEmail', t('cEmail'), tc.email, 'email') +
      '</div><button type="button" class="btn" data-act="tech-save">' + esc(t('save')) + '</button></details>';
    v.innerHTML = h;
  }

  function formVal(id) { var el = byId(id); return el ? el.value : ''; }

  function jobsTick() {
    var j = activeJob();
    // A job just finished closing: refresh the list and open the report.
    if (S.lastJobId && !j) {
      var closedId = S.lastJobId; S.lastJobId = '';
      loadJobs(function () {
        var list = (S.jobs && S.jobs.jobs) || [];
        for (var i = 0; i < list.length; i++) if (list[i].id === closedId && list[i].status === 'closed') {
          toast(t('reportReady'));
          var p = list[i].pdf || list[i].html; if (p) call('/api/open-file', { path: p }, function () { });
        }
        if (S.view === 'jobs') renderJobs(true);
      });
    }
    if (j) S.lastJobId = j.status === 'closing' ? j.id : S.lastJobId;
    var k = curTask();
    if (k && k.action === 'report' && k.phase === 'done' && S.lastReportAt !== k.finished) {
      if (S.lastReportAt) { loadJobs(); toast(t('reportReady')); }
      S.lastReportAt = k.finished;
    }
    renderJobBanner();
    if (S.view === 'jobs') renderJobs(false);
    var tm = byId('jbTimer'); if (tm && j) tm.innerHTML = esc(durTxt(durMin(j.started)));
  }

  // ------------------------------------------------------------------ integrity & docs
  function integrityHtml() {
    var g = S.data && S.data.integrity, k = curTask(), h = '<div class="section"><div class="section-head"><h2>' + esc(t('integrity')) + '</h2>' +
      '<button type="button" class="btn" style="margin-left:auto" data-act="verify"' + (taskRunning() ? ' disabled' : '') + '>' + icon('shield') + esc(t('verifyNow')) + '</button></div><p class="lede">' + esc(t('integrityLede')) + '</p>';
    if (!g) return h + '<div class="empty">' + esc(t('iNone')) + '</div></div>';
    var ok = 0, bad = [], i, r;
    for (i = 0; i < (g.results || []).length; i++) { r = g.results[i]; if (r.status === 'ok') ok++; else bad.push(r); }
    h += '<div class="panel">';
    if (g.running) h += '<div class="pbar"><i style="width:' + (g.total ? Math.round(100 * g.done / g.total) : 0) + '%"></i></div>';
    h += '<div class="chips"><span class="chip ok">' + ok + ' ' + esc(t('iOk')) + '</span>';
    var ch = 0, mi = 0; for (i = 0; i < bad.length; i++) { if (bad[i].status === 'missing') mi++; else ch++; }
    if (ch) h += '<span class="chip error">' + ch + ' ' + esc(t('iChanged')) + '</span>';
    if (mi) h += '<span class="chip manual">' + mi + ' ' + esc(t('iMissing')) + '</span>';
    h += '<span class="chip">' + esc(fmtTime(g.finished || g.started, true)) + '</span></div>';
    for (i = 0; i < bad.length; i++) {
      r = bad[i];
      h += '<div class="manual-row"><div class="app-text"><span class="app-name">' + esc(APP[r.app] ? APP[r.app].app.name : r.app) + '</span> <span class="badge ' + (r.status === 'missing' ? 'manual' : 'warn') + '">' + esc(t(r.status === 'missing' ? 'iMissing' : 'iChanged')) + '</span>' +
        '<div class="app-tip mono">' + esc(r.path) + ' · ' + esc(r.signer ? t('iSigned') + ': ' + r.signer + ' (' + r.sigStatus + ')' : t('iUnsigned')) + '</div></div>' +
        (r.pkg ? '<button type="button" class="btn" data-act="install" data-pkg="' + esc(r.pkg) + '">' + icon('setup') + esc(t('reinstall')) + '</button>' : '') + '</div>';
    }
    return h + '</div></div>';
  }

  function docsHtml() {
    if (!S.live) return '';
    if (!S.docs) { call('/api/docs', {}, function (err, d) { S.docs = err ? [] : d.docs; S.sigTools = ''; if (S.view === 'tools') renderTools(); }); return ''; }
    var h = '<div class="cat-block"><div class="cat-title">' + icon('doc') + esc(t('docs')) + '<button type="button" class="btn ghost" style="margin-left:auto" data-act="folder" data-what="docs">' + icon('folder') + esc(t('docsFolder')) + '</button></div>';
    if (!S.docs.length) return h + '<div class="empty small">' + esc(t('docsLede')) + '</div></div>';
    h += '<div class="panel docs">';
    for (var i = 0; i < S.docs.length; i++) {
      var d = S.docs[i];
      h += '<button type="button" class="doc" data-act="open-file" data-path="' + esc('docs/' + d.path) + '">' + icon('doc') + '<span>' + esc(d.path) + '</span><small>' + (d.kb >= 1024 ? (d.kb / 1024).toFixed(1) + ' MB' : d.kb + ' KB') + '</small></button>';
    }
    return h + '</div></div>';
  }

  // ------------------------------------------------------------------ playbooks
  var PBD = window.KIT_PLAYBOOKS || { playbooks: [], sugoLinks: {} };
  var PB = {}; (function () { for (var i = 0; i < PBD.playbooks.length; i++) PB[PBD.playbooks[i].id] = PBD.playbooks[i]; })();
  var ST_ICON = { ok: 'check', done: 'check', info: 'help', warn: 'alert', fail: 'alert', skipped: 'stop', running: 'refresh', pending: 'play' };

  function pbRun() { return S.data && S.data.playbook; }
  function pbRunning(run) { if (!run) return -1; for (var i = 0; i < run.steps.length; i++) if (run.steps[i].status === 'running') return i; return -1; }
  function pbCounts(run) {
    var c = { total: 0, done: 0, warn: 0, fail: 0 };
    for (var i = 0; i < run.steps.length; i++) {
      var s = run.steps[i]; if (!s.include) continue; c.total++;
      if (s.status !== 'pending' && s.status !== 'running') c.done++;
      if (s.status === 'warn') c.warn++; if (s.status === 'fail') c.fail++;
    }
    return c;
  }
  function riskBadge(r) { return '<span class="badge ' + (r === 'safe' ? 'ok' : (r === 'repair' ? 'warn' : 'manual')) + '">' + esc(t('risk_' + r)) + '</span>'; }
  function kindBadges(s) {
    var h = '<span class="badge kind-' + s.kind + '">' + esc(t('kind_' + s.kind)) + '</span>';
    if (s.admin) h += '<span class="badge">' + esc(t('admin')) + '</span>';
    if (s['long']) h += '<span class="badge">' + esc(t('longStep')) + '</span>';
    return h;
  }

  function renderPb(force) {
    var v = byId('view-pb'); if (!v) return;
    var run = pbRun();
    var sig = S.lang + (S.live ? 1 : 0) + JSON.stringify(run) + S.pbSel + (S.pbAuto ? 1 : 0) + (S.data && S.data.os ? S.data.os.admin : '') + JSON.stringify(S.pbOpen);
    if (!force && sig === S.pbSig) return;
    S.pbSig = sig;
    var h = '<h1>' + esc(t('pbTitle')) + '</h1><p class="lede">' + esc(t('pbLede')) + '</p>';
    if (!S.live) h += '<div class="offline-note">' + esc(t('needServer')) + '</div>';
    if (run && !run.closed) h += pbRunHtml(run);
    else if (S.pbSel && PB[S.pbSel]) h += pbPickHtml(PB[S.pbSel]);
    else h += pbListHtml();
    v.innerHTML = h;
  }

  function pbListHtml() {
    var h = '<div class="cards pb-cards">';
    for (var i = 0; i < PBD.playbooks.length; i++) {
      var p = PBD.playbooks[i];
      h += '<button type="button" class="pb-card" data-act="pb-select" data-id="' + p.id + '"><div class="pb-top">' + icon(p.icon) + riskBadge(p.risk) + '</div>' +
        '<b>' + esc(L(p.title)) + '</b><small>' + esc(L(p.desc)) + '</small><span class="pb-meta">' + p.steps.length + ' ' + esc(t('steps').toLowerCase()) + ' · ~' + p.minutes + ' min</span></button>';
    }
    return h + '</div>';
  }

  function pbPickHtml(p) {
    var h = '<div class="panel pb-pick"><div class="ja-head"><div><div class="ja-label">' + esc(t('pbPrepare')) + '</div><div class="ja-title">' + esc(L(p.title)) + ' ' + riskBadge(p.risk) + '</div>' +
      '<div class="ja-task">' + esc(L(p.desc)) + '</div></div><button type="button" class="btn ghost" data-act="pb-back">' + esc(t('back')) + '</button></div>';
    if (p.warn) h += '<div class="warnbox" style="margin:0 0 12px">' + esc(L(p.warn)) + '</div>';
    if (!activeJob()) h += '<div class="offline-note small">' + esc(t('pbNoJob')) + ' <a href="#" data-act="view" data-view="jobs">' + esc(t('navJobs')) + '</a></div>';
    h += '<ol class="pb-steps">';
    for (var i = 0; i < p.steps.length; i++) {
      var s = p.steps[i], on = S.pbInc[i] !== undefined ? S.pbInc[i] : s['default'] !== false;
      h += '<li><label class="pb-inc"><input type="checkbox" data-pbinc="' + i + '"' + (on ? ' checked' : '') + '><span><b>' + esc(L(s.title)) + '</b> ' + kindBadges(s) +
        (s.desc ? '<small>' + esc(L(s.desc)) + '</small>' : '') + (s.warn ? '<small class="pb-warn">' + esc(L(s.warn)) + '</small>' : '') + '</span></label>';
      if (s.inputs) for (var k = 0; k < s.inputs.length; k++) {
        var inp = s.inputs[k], key = i + '.' + inp.key, val = S.pbInputs[key] !== undefined ? S.pbInputs[key] : ((s.params || {})[inp.key] || '');
        h += '<label class="fld pb-input"><span>' + esc(L(inp.label)) + '</span><input type="text" data-pbinput="' + esc(key) + '" value="' + esc(val) + '"></label>';
      }
      h += '</li>';
    }
    h += '</ol><div class="level-actions"><button type="button" class="btn primary" data-act="pb-start"' + (S.live ? '' : ' disabled') + '>' + icon('play') + esc(t('pbStart')) + '</button></div></div>';
    return h;
  }

  function pbRunHtml(run) {
    var p = PB[run.pb] || { title: run.title, icon: 'play' }, c = pbCounts(run), busy = pbRunning(run) >= 0, i, s;
    var needAdmin = false; for (i = 0; i < run.steps.length; i++) if (run.steps[i].include && run.steps[i].admin && run.steps[i].status === 'pending') needAdmin = true;
    var isAdmin = S.data && S.data.os && S.data.os.admin;
    var h = '<div class="panel pb-run"><div class="ja-head"><div><div class="ja-label">' + esc(t('pbActive')) + (run.job ? ' · <span class="mono">' + esc(run.job) + '</span>' : '') + '</div>' +
      '<div class="ja-title">' + esc(L(run.title)) + '</div></div><div class="ja-timer">' + c.done + '/' + c.total + '<small>' + esc(t('steps').toLowerCase()) + '</small></div></div>';
    h += '<div class="pbar' + (c.done === c.total ? ' done' : '') + '"><i style="width:' + (c.total ? Math.round(100 * c.done / c.total) : 0) + '%"></i></div>';
    h += '<div class="level-actions">';
    if (c.done < c.total) h += S.pbAuto ? '<button type="button" class="btn" data-act="pb-auto" data-on="0">' + icon('stop') + esc(t('pbPause')) + '</button>' :
      '<button type="button" class="btn primary" data-act="pb-auto" data-on="1"' + (S.live ? '' : ' disabled') + '>' + icon('play') + esc(t('pbRunAll')) + '</button>';
    if (needAdmin && !isAdmin && S.live) h += '<button type="button" class="btn" data-act="elevate" title="' + esc(t('elevateTip')) + '">' + icon('shield') + esc(t('elevate')) + '</button>';
    h += '<button type="button" class="btn ghost" data-act="pb-close"' + (busy ? ' disabled' : '') + '>' + esc(c.done === c.total ? t('pbFinish') : t('pbAbort')) + '</button>';
    if (c.done) h += '<span class="pb-sum">' + (c.fail ? '<span class="chip error">' + c.fail + ' ' + esc(t('st_fail')) + '</span>' : '') + (c.warn ? '<span class="chip manual">' + c.warn + ' ' + esc(t('st_warn')) + '</span>' : '') + '</span>';
    h += '</div>';
    if (needAdmin && !isAdmin) h += '<p class="small muted" style="margin:0 0 8px">' + esc(t('uacHint')) + '</p>';
    h += '<ol class="pb-steps run">';
    for (i = 0; i < run.steps.length; i++) {
      s = run.steps[i];
      if (!s.include) continue;
      var st = s.status || 'pending', open = S.pbOpen[i];
      h += '<li class="st-' + st + (S.pbFocus === i ? ' focus' : '') + '" id="pbstep-' + i + '"><div class="pb-row"><span class="pb-ic">' + (st === 'running' ? '<span class="spin"></span>' : icon(ST_ICON[st] || 'play')) + '</span>' +
        '<div class="pb-body"><b>' + esc(L(s.title)) + '</b> ' + kindBadges(s) + (st !== 'pending' && st !== 'running' ? ' <span class="badge st-' + st + '">' + esc(t('st_' + st)) + '</span>' : '');
      if (s.summary) h += '<div class="pb-summary">' + esc(L(s.summary)) + '</div>';
      else if (st === 'pending' && s.desc) h += '<div class="small muted">' + esc(L(s.desc)) + '</div>';
      if (st === 'running') h += '<div class="small muted">' + esc(s['long'] ? t('pbLong') : t('pbWorking')) + '</div>';
      if (s.files && s.files.length) { h += '<div class="pb-files">'; for (var f = 0; f < s.files.length; f++) h += '<button type="button" class="btn" data-act="open-file" data-path="' + esc(s.files[f]) + '">' + icon('doc') + esc(s.files[f].split('/').pop()) + '</button>'; h += '</div>'; }
      if (s.details && s.details.length) {
        h += '<button type="button" class="linkbtn" data-act="pb-toggle" data-i="' + i + '">' + esc(open ? t('hideDetails') : t('showDetails')) + ' (' + s.details.length + ')</button>';
        if (open) h += '<pre class="logbox mono">' + esc(s.details.join('\n')) + '</pre>';
      }
      h += '</div><div class="pb-act">';
      if (st === 'pending' || (st !== 'running' && s.kind !== 'manual')) {
        if (s.kind === 'manual') {
          if (s.app) h += '<button type="button" class="btn" data-act="pb-manual" data-i="' + i + '" data-what="launch">' + icon('play') + esc(appReady(s.app) ? t('launch') : t('install')) + '</button>';
          if (s.open) h += '<button type="button" class="btn" data-act="pb-manual" data-i="' + i + '" data-what="open">' + icon('link') + esc(t('open')) + '</button>';
          if (s.folder) h += '<button type="button" class="btn" data-act="pb-manual" data-i="' + i + '" data-what="folder">' + icon('folder') + esc(t('folder')) + '</button>';
          h += '<button type="button" class="btn primary" data-act="pb-done" data-i="' + i + '">' + icon('check') + esc(t('pbDone')) + '</button>';
          h += '<button type="button" class="btn ghost" data-act="pb-skip" data-i="' + i + '">' + esc(t('pbSkip')) + '</button>';
        } else if (st === 'pending') {
          h += '<button type="button" class="btn' + (s.kind === 'action' ? '' : ' primary') + '" data-act="pb-run" data-i="' + i + '"' + (busy || !S.live ? ' disabled' : '') + '>' + icon('play') + esc(t('pbRunStep')) + '</button>';
          h += '<button type="button" class="btn ghost" data-act="pb-skip" data-i="' + i + '"' + (busy ? ' disabled' : '') + '>' + esc(t('pbSkip')) + '</button>';
        } else {
          h += '<button type="button" class="btn ghost" data-act="pb-run" data-i="' + i + '"' + (busy || !S.live ? ' disabled' : '') + '>' + icon('refresh') + esc(t('pbAgain')) + '</button>';
        }
      }
      h += '</div></div></li>';
    }
    return h + '</ol></div>';
  }

  function pbConfirm(s) {
    var msg = L(s.title) + '\n\n' + t('pbConfirm');
    if (s.warn) msg += '\n\n' + t('caution') + ': ' + L(s.warn);
    return window.confirm(msg);
  }
  function pbStepRun(i, ask) {
    var run = pbRun(); if (!run) return;
    var s = run.steps[i];
    if (ask && s.kind === 'action' && s.confirm && !pbConfirm(s)) { S.pbAuto = false; renderPb(true); return; }
    var params = null;
    if (s.inputs) { params = {}; for (var k = 0; k < s.inputs.length; k++) params[s.inputs[k].key] = (s.params || {})[s.inputs[k].key] || ''; }
    S.pbStarting = i; S.pbStartAt = new Date().getTime();
    act('/api/pb-step', { run: run.id, step: i, params: params }, null, function (err) { if (err) { S.pbAuto = false; S.pbStarting = -1; } });
  }
  function pbTick() {
    var run = pbRun();
    if (S.view === 'pb') renderPb(false);
    if (!run || run.closed || !S.pbAuto || !S.live) return;
    if (pbRunning(run) >= 0) { S.pbStarting = -1; return; }
    if (S.pbStarting >= 0) {
      var st = run.steps[S.pbStarting] && run.steps[S.pbStarting].status;
      if (st === 'pending' && new Date().getTime() - S.pbStartAt < 6000) return;
      S.pbStarting = -1;
    }
    for (var i = 0; i < run.steps.length; i++) {
      var s = run.steps[i];
      if (!s.include || s.status !== 'pending') continue;
      if (s.kind === 'manual') {
        S.pbAuto = false; S.pbResume = true; S.pbFocus = i; renderPb(true);
        var el = byId('pbstep-' + i); if (el && el.scrollIntoView) el.scrollIntoView();
        toast(t('pbManualWait'));
        return;
      }
      S.pbFocus = i;
      pbStepRun(i, true);
      return;
    }
    S.pbAuto = false; renderPb(true); toast(t('pbAllDone'));
  }

  // ------------------------------------------------------------------ commands
  var cmdView = null, cmdLang = '';
  function renderCmd() {
    var v = byId('view-cmd'); if (!v || !window.CmdView) return;
    if (!cmdView || cmdLang !== S.lang) {
      if (!cmdView) { v.innerHTML = '<h1 id="cmdTitle"></h1><p class="lede" id="cmdLede"></p><div id="cmdRoot"></div>'; cmdView = window.CmdView.mount(byId('cmdRoot'), { lang: function () { return S.lang; }, toast: toast }); }
      byId('cmdTitle').innerHTML = esc(t('cmdTitle')); byId('cmdLede').innerHTML = esc(t('cmdLede'));
      cmdLang = S.lang;
    }
    cmdView.render();
  }

  // ------------------------------------------------------------------ global search
  var srIndex = -1;
  function runSearch(q) {
    var box = byId('searchResults');
    if (!q || q.length < 2) { setClass(box, 'open', false); return; }
    var nq = norm(q), words = nq.split(/\s+/), apps = [], helps = [], k, i, hay, ok;
    for (k in APP) if (APP.hasOwnProperty(k)) {
      var a = APP[k];
      hay = norm(a.app.name + ' ' + a.pkg.name + ' ' + L(a.app.desc) + ' ' + L(a.pkg.desc) + ' ' + (a.pkg.desc.en || ''));
      ok = true; for (i = 0; i < words.length; i++) if (words[i] && hay.indexOf(words[i]) < 0) ok = false;
      if (ok) apps.push(k);
    }
    for (i = 0; i < SUGO.entries.length; i++) { var saveCat = S.helpCat; S.helpCat = 'all'; if (helpMatches(SUGO.entries[i], q)) helps.push(SUGO.entries[i].id); S.helpCat = saveCat; }
    var h = '';
    if (helps.length) { h += '<div class="sr-group">' + esc(t('srHelp')) + '</div>'; for (i = 0; i < Math.min(6, helps.length); i++) h += '<button type="button" class="sr-item" data-act="help" data-id="' + helps[i] + '">' + esc(L(ENTRY[helps[i]].title)) + '</button>'; }
    if (apps.length) { h += '<div class="sr-group">' + esc(t('srTools')) + '</div>'; for (i = 0; i < Math.min(8, apps.length); i++) h += '<button type="button" class="sr-item" data-act="goto-app" data-app="' + apps[i] + '">' + esc(APP[apps[i]].app.name) + '<small>' + esc(L(APP[apps[i]].app.desc)) + '</small></button>'; }
    if (!h) h = '<div class="sr-group">' + esc(t('srNone')) + '</div>';
    box.innerHTML = h; srIndex = -1;
    setClass(box, 'open', true);
  }

  // ------------------------------------------------------------------ render orchestration
  function renderAll() {
    renderChrome();
    renderDash(); renderTools(); renderSetup(); renderSafe(); renderJobs(true); renderPb(true); renderCmd();
    var hv = byId('view-help'); hv.innerHTML = ''; renderHelp();
  }
  function renderLiveBits() {
    renderNav();
    renderRunning(); renderProgress();
    if (S.view === 'dash') renderQuickIfChanged();
    if (S.view === 'tools') renderTools();
    if (S.view === 'safe' && JSON.stringify(safe()) !== S.sigSafe) { S.sigSafe = JSON.stringify(safe()); renderSafe(); }
    if (S.view === 'setup') { var ig = JSON.stringify((S.data && S.data.integrity) || null) + (taskRunning() ? 1 : 0); if (ig !== S.sigInt) { S.sigInt = ig; renderSetup(); } }
    jobsTick();
    pbTick();
  }
  var quickSig = '';
  function renderQuickIfChanged() { var s = JSON.stringify(S.apps) + runSig(); if (s !== quickSig) { quickSig = s; renderQuick(); } }

  function go(view) {
    S.view = view; renderNav();
    if (view === 'tools') renderTools();
    if (view === 'safe') renderSafe();
    if (view === 'setup') renderSetup();
    if (view === 'jobs') { renderJobs(true); loadJobs(); }
    if (view === 'pb') renderPb(true);
    if (view === 'cmd') renderCmd();
    if (view === 'tools') { S.docs = null; S.sigTools = ''; renderTools(); }
    try { byId('main').scrollTop = 0; } catch (e) { }
  }

  var toastTimer;
  function toast(msg, err) {
    var el = byId('toast'); el.innerHTML = esc(msg); el.className = 'toast show' + (err ? ' err' : '');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.className = 'toast' + (err ? ' err' : ''); }, 3200);
  }
  function copyText(s) {
    try {
      if (window.clipboardData) { window.clipboardData.setData('Text', s); toast(t('copied')); return; }
      var ta = document.createElement('textarea'); ta.value = s; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); toast(t('copied'));
    } catch (e) { }
  }
  function unesc(s) { var d = document.createElement('div'); d.innerHTML = s; return d.textContent || d.innerText || ''; }

  // ------------------------------------------------------------------ events
  document.onclick = function (ev) {
    ev = ev || window.event;
    var el = ev.target || ev.srcElement;
    while (el && el !== document && !(el.getAttribute && el.getAttribute('data-act'))) el = el.parentNode;
    if (!el || el === document) {
      if (!hasClass(ev.target || ev.srcElement, 'search')) setClass(byId('searchResults'), 'open', false);
      return;
    }
    var a = el.getAttribute('data-act'), d = function (k) { return el.getAttribute('data-' + k); };
    var keepDefault = (a === 'page' && (!SERVER || !S.live));
    if (!keepDefault && ev.preventDefault) ev.preventDefault();
    if (!keepDefault) ev.returnValue = false;
    setClass(byId('searchResults'), 'open', false);
    switch (a) {
      case 'view': go(d('view')); break;
      case 'help':
        S.helpSel = d('id'); if (S.view !== 'help') go('help');
        if (!byId('helpList')) renderHelp(); else { renderHelpList(); renderHelpBody(); }
        try { byId('main').scrollTop = 0; } catch (e) { }
        break;
      case 'goto-app':
        var ap = APP[d('app')]; if (!ap) break;
        S.toolCat = ap.pkg.cat; S.toolStatus = 'all'; go('tools');
        var node = byId('pkg-' + ap.pkg.id); if (node && node.scrollIntoView) node.scrollIntoView();
        break;
      case 'tcat': S.toolCat = d('v'); renderTools(); break;
      case 'tstatus': S.toolStatus = d('v'); renderTools(); break;
      case 'hcat': S.helpCat = d('v'); S.helpSel = null; renderHelp(); break;
      case 'launch':
        var id = d('app');
        S.launches[id] = (S.launches[id] || 0) + 1; lsSet('launches', S.launches);
        act('/api/launch', { app: id, mode: d('mode') }, t('started') + ': ' + (APP[id] ? APP[id].app.name : id));
        break;
      case 'stop':
        if (window.confirm(fmt(t('confirmStop'), d('name')))) act('/api/stop', { pid: +d('pid') });
        break;
      case 'folder':
        if (!S.live) { if (d('pkg')) window.open('../tools/' + d('pkg') + '/'); else toast(t('needServer'), true); break; }
        act('/api/folder', { pkg: d('pkg') || '', what: d('what') || '', job: d('job') || '' });
        break;
      case 'page': if (SERVER && S.live) act('/api/page', { pkg: d('pkg') }); break;
      case 'install': act('/api/setup', { ids: [d('pkg')], lang: S.lang }, t('setupStarted')); break;
      case 'setup-gui': act('/api/setup', { lang: S.lang }, t('setupStarted')); break;
      case 'setup-core': (function () { var ids = []; for (var i = 0; i < CAT.packages.length; i++) { var p = CAT.packages[i]; if (p.tier === 1 && !isInstalled(p.id) && !isManual(p) && !(isLegacy() && p.win7 === 'no')) ids.push(p.id); } if (ids.length) act('/api/setup', { ids: ids, lang: S.lang }, t('setupStarted')); })(); break;
      case 'setup-update': (function () { var ids = []; for (var k in S.installed) if (S.installed.hasOwnProperty(k) && PKG[k] && !isManual(PKG[k])) ids.push(k); if (ids.length) act('/api/setup', { ids: ids, lang: S.lang }, t('setupStarted')); })(); break;
      case 'shell': act('/api/shell', {}, t('started') + ': Kit Shell'); break;
      case 'venv-new': var nm = (byId('venvName') || {}).value || ''; act('/api/venv', { name: nm }, t('started') + ': venv ' + nm, function (err) { if (!err) setTimeout(renderSafe, 1500); }); break;
      case 'venv-open': act('/api/venv', { name: d('name') }, t('started') + ': venv ' + d('name')); break;
      case 'venv-del': if (window.confirm(fmt(t('confirmDel'), d('name')))) act('/api/venv-delete', { name: d('name') }, null, function () { setTimeout(renderSafe, 300); }); break;
      case 'wsb': act('/api/wsb', { app: d('app') || '', net: d('app') ? true : S.wsbNet }, t('started') + ': Windows Sandbox'); break;
      case 'wsb-enable': act('/api/wsb-enable', {}); break;
      case 'sbie-wipe': if (window.confirm(t('confirmWipe'))) act('/api/sbie-wipe', {}); break;
      case 'copy': copyText(unesc(d('text'))); break;
      case 'open-file': act('/api/open-file', { path: d('path') }); break;
      case 'pb-select': S.pbSel = d('id'); S.pbInc = {}; S.pbInputs = {}; renderPb(true); try { byId('main').scrollTop = 0; } catch (e1) { } break;
      case 'pb-goto': S.pbSel = d('id'); S.pbInc = {}; S.pbInputs = {}; go('pb'); break;
      case 'pb-back': S.pbSel = ''; renderPb(true); break;
      case 'pb-start':
        (function () {
          var p = PB[S.pbSel]; if (!p) return;
          var inc = [], inputs = {}, i, k;
          for (i = 0; i < p.steps.length; i++) if (S.pbInc[i] !== undefined ? S.pbInc[i] : p.steps[i]['default'] !== false) inc.push(i);
          for (k in S.pbInputs) if (S.pbInputs.hasOwnProperty(k)) { var dot = k.indexOf('.'), si = k.substring(0, dot); inputs[si] = inputs[si] || {}; inputs[si][k.substring(dot + 1)] = S.pbInputs[k]; }
          act('/api/pb-start', { id: p.id, include: inc, inputs: inputs }, null, function (err) { if (!err) { S.pbSel = ''; S.pbAuto = false; S.pbOpen = {}; S.pbFocus = -1; } });
        })();
        break;
      case 'pb-auto': S.pbAuto = d('on') === '1'; S.pbResume = false; renderPb(true); if (S.pbAuto) setTimeout(pbTick, 50); break;
      case 'pb-run': pbStepRun(+d('i'), true); break;
      case 'pb-toggle': S.pbOpen[d('i')] = !S.pbOpen[d('i')]; renderPb(true); break;
      case 'pb-done': case 'pb-skip':
        (function () {
          var run = pbRun(); if (!run) return;
          var note = '';
          if (a === 'pb-done') { note = window.prompt(t('pbNotePrompt'), ''); if (note === null) return; }
          act('/api/pb-mark', { run: run.id, step: +d('i'), status: a === 'pb-done' ? 'done' : 'skipped', note: note }, null, function (err) {
            if (!err && S.pbResume) { S.pbResume = false; S.pbAuto = true; setTimeout(pbTick, 1600); }
          });
        })();
        break;
      case 'pb-manual':
        (function () {
          var run = pbRun(); if (!run) return;
          var s = run.steps[+d('i')];
          if (d('what') === 'launch' && s.app && !appReady(s.app)) { act('/api/setup', { ids: [APP[s.app].pkg.id], lang: S.lang }, t('setupStarted')); return; }
          act('/api/pb-manual', { run: run.id, step: +d('i'), what: d('what') }, d('what') === 'launch' ? t('started') : null);
        })();
        break;
      case 'pb-close': if (window.confirm(t('confirmPbClose'))) { S.pbAuto = false; act('/api/pb-close', {}); } break;
      case 'elevate': if (window.confirm(t('elevateTip'))) act('/api/elevate', {}, t('elevating')); break;
      case 'verify': act('/api/verify', {}, t('started') + ': ' + t('integrity')); break;
      case 'job-start':
        (function () {
          var f = S.form, body = { clientId: f.clientId || '', computer: f.computer !== undefined ? f.computer : ((S.data && S.data.computer) || ''), task: f.task || '', smart: !!f.smart, includeKeys: !!f.keys,
            client: { name: f.cName || '', phone: f.cPhone || '', email: f.cEmail || '', address: f.cAddress || '' } };
          if (!body.clientId && !body.client.name) { toast(t('e_client_name'), true); var cn = byId('cName'); if (cn) cn.focus(); return; }
          act('/api/job-start', body, t('started') + ': ' + t('activeJob'), function (err) { if (!err) { S.form = { clientId: '', smart: true, keys: false }; S.jobDetail = null; loadJobs(); } });
        })();
        break;
      case 'job-note':
        if (!S.noteDraft.replace(/\s+/g, '')) { toast(t('e_empty'), true); break; }
        act('/api/job-note', { text: S.noteDraft }, null, function (err) { if (!err) { S.noteDraft = ''; var a = activeJob(); if (a) loadJobDetail(a.id); } });
        break;
      case 'job-report': act('/api/job-report', {}, t('taskRun_report')); break;
      case 'job-close': if (window.confirm(t('confirmClose'))) act('/api/job-close', {}, t('taskRun_close'), function (err) { if (!err) { var a = activeJob(); if (a) S.lastJobId = a.id; } }); break;
      case 'job-discard': if (window.confirm(t('confirmDiscard'))) act('/api/job-discard', {}, null, function () { S.jobDetail = null; S.noteDraft = ''; loadJobs(); }); break;
      case 'tech-save':
        act('/api/tech-save', { name: formVal('tName'), company: formVal('tCompany'), phone: formVal('tPhone'), email: formVal('tEmail') }, t('saved'), function () { loadJobs(); });
        break;
    }
    return false;
  };

  function onBind(ev) {
    ev = ev || window.event;
    var el = ev.target || ev.srcElement, key = el && el.getAttribute && el.getAttribute('data-bind');
    if (el && el.getAttribute) {
      var pi = el.getAttribute('data-pbinc'); if (pi !== null && pi !== undefined && pi !== '') { S.pbInc[pi] = el.checked; return; }
      var pk = el.getAttribute('data-pbinput'); if (pk) { S.pbInputs[pk] = el.value; return; }
    }
    if (!key) return;
    var val = el.type === 'checkbox' ? el.checked : el.value;
    if (key === 'noteDraft') { S.noteDraft = val; return; }
    if (key === 'clientFilter') { S.clientFilter = val; renderJobs(true); return; }
    if (key.charAt(0) === 't' && /^t(Name|Company|Phone|Email)$/.test(key)) return;
    S.form[key] = val;
    if (key === 'clientId') renderJobs(true);
  }
  document.oninput = onBind;
  document.onchange = onBind;
  document.onkeyup = function (ev) { ev = ev || window.event; var el = ev.target || ev.srcElement; if (el && el.getAttribute && el.getAttribute('data-bind') && !('oninput' in el)) onBind(ev); };

  byId('langBtn').onclick = function () {
    S.lang = S.lang === 'hu' ? 'en' : 'hu'; lsSet('lang', S.lang); lsSet('langSet', true);
    if (SERVER && S.live) xhr('POST', '/api/settings', { lang: S.lang }, function () { });
    S.sigTools = ''; renderAll();
  };
  byId('themeBtn').onclick = function () { S.theme = S.theme === 'light' ? 'dark' : 'light'; lsSet('theme', S.theme); renderChrome(); };

  var sInput = byId('search');
  sInput.onkeyup = function (ev) {
    ev = ev || window.event;
    var box = byId('searchResults'), items = box.getElementsByTagName('button');
    if (ev.keyCode === 40 || ev.keyCode === 38) {
      if (!items.length) return;
      if (srIndex >= 0 && items[srIndex]) setClass(items[srIndex], 'active', false);
      srIndex = (srIndex + (ev.keyCode === 40 ? 1 : -1) + items.length) % items.length;
      setClass(items[srIndex], 'active', true); return;
    }
    if (ev.keyCode === 13) { var it = items[srIndex >= 0 ? srIndex : 0]; if (it) it.click(); sInput.blur(); return; }
    if (ev.keyCode === 27) { setClass(box, 'open', false); return; }
    if (!('oninput' in sInput)) runSearch(sInput.value);
  };
  sInput.oninput = function () { runSearch(sInput.value); };
  sInput.onfocus = function () { if (sInput.value.length >= 2) runSearch(sInput.value); };
  document.onkeydown = function (ev) {
    ev = ev || window.event;
    var tag = (ev.target || ev.srcElement).tagName;
    if ((ev.keyCode === 191 || (ev.ctrlKey && ev.keyCode === 75)) && tag !== 'INPUT') { sInput.focus(); if (ev.preventDefault) ev.preventDefault(); return false; }
  };

  // ------------------------------------------------------------------ start
  renderAll();
  if (SERVER) poll();
})();
