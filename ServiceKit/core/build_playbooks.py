# Builds core/playbooks.json (for the server) and launcher/data/playbooks.js (for the Dashboard).
# Edit here, then run:  python core/build_playbooks.py
#
# Step kinds:
#   check   - read-only routine, runs without asking
#   action  - changes the PC, asks for confirmation first
#   manual  - you do something (a kit program opens, a settings page opens, or just an instruction), then Done/Skip
# Routines live in core/playbook.ps1 as functions named R-<routine>.
import json, os

ROUTINES = {
    # routine: (admin, long-running)
    "sys-overview": (False, False), "disk-health": (False, False), "av-status": (False, False), "update-status": (False, False),
    "crash-events": (False, False), "startup-review": (False, False), "sched-tasks-check": (False, False),
    "browser-policy-check": (False, False), "hosts-check": (False, False), "proxy-check": (False, False), "net-diag": (False, False),
    "perf-snapshot": (False, False), "battery-check": (False, False), "temp-size": (False, False), "printer-status": (False, False),
    "activation-check": (False, False), "restore-status": (False, False), "lan-scan": (False, True), "wifi-survey": (False, False),
    "port-check": (False, False), "programs-export": (False, False), "user-folders-size": (False, True),
    "restore-point": (True, False), "enable-restore": (True, False), "temp-cleanup": (True, False), "recycle-empty": (False, False),
    "do-cache-clean": (True, False), "dism-component-cleanup": (True, True), "dism-restore": (True, True), "sfc": (True, True),
    "chkdsk-scan": (True, True), "chkdsk-schedule": (True, False), "net-reset": (True, False), "dns-flush": (False, False),
    "time-sync": (True, False), "wu-reset": (True, False), "defender-update": (True, False), "defender-scan": (True, True),
    "spooler-reset": (True, False), "hibernate-off": (True, False), "power-balanced": (False, False), "winget-upgrade": (False, True),
    "winget-install": (False, True), "driver-export": (True, True), "wifi-export": (True, False), "keys-export": (False, False),
    "bookmarks-backup": (False, False), "explorer-restart": (False, False),
}

def T(hu, en): return {"hu": hu, "en": en}

def chk(routine, hu, en, **kw):
    a, l = ROUTINES[routine]
    s = {"kind": "check", "routine": routine, "title": T(hu, en), "admin": a, "long": l, "default": True}
    s.update(kw); return s

def act(routine, hu, en, **kw):
    a, l = ROUTINES[routine]
    s = {"kind": "action", "routine": routine, "title": T(hu, en), "admin": a, "long": l, "default": True, "confirm": True}
    s.update(kw); return s

def man(hu, en, dhu="", den="", **kw):
    s = {"kind": "manual", "title": T(hu, en), "default": True}
    if dhu: s["desc"] = T(dhu, den)
    s.update(kw); return s

def warn(hu, en): return T(hu, en)

WU_OPEN = {"open": {"file": "ms-settings:windowsupdate"}, "openLegacy": {"file": "control.exe", "args": "/name Microsoft.WindowsUpdate"}}

PLAYBOOKS = [
  {"id": "health", "icon": "pulse", "risk": "safe", "minutes": 3,
   "title": T("Gyors állapotfelmérés", "Quick health check"),
   "desc": T("Csak olvas, semmit nem változtat. Minden munka elején érdemes lefuttatni: a jelentésbe kerül.",
             "Read-only, changes nothing. Worth running at the start of every job: it goes into the report."),
   "steps": [
     chk("sys-overview", "Rendszer, üzemidő, függő újraindítás", "System, uptime, pending restart"),
     chk("disk-health", "Lemezek állapota és szabad hely", "Disk health and free space", params={"smart": "true"}),
     chk("av-status", "Vírusvédelem", "Antivirus"),
     chk("update-status", "Windows frissítések", "Windows updates"),
     chk("crash-events", "Összeomlások és hardverhibák (30 nap)", "Crashes and hardware errors (30 days)"),
     chk("perf-snapshot", "Terhelés, memória, energiaséma", "Load, memory, power plan"),
     chk("startup-review", "Indítási elemek", "Startup items"),
     chk("temp-size", "Ideiglenes fájlok mérete", "Temporary file size"),
     chk("battery-check", "Akkumulátor", "Battery"),
     chk("restore-status", "Visszaállítási pontok", "Restore points"),
     chk("activation-check", "Windows aktiválás", "Windows activation"),
   ]},

  {"id": "tuneup", "icon": "broom", "risk": "changes", "minutes": 20,
   "title": T("Karbantartás és gyorsítás", "Tune-up"),
   "desc": T("Visszaállítási pont, takarítás, indítási elemek és programok rendbetétele, frissítések.",
             "Restore point, cleanup, startup and program review, updates."),
   "steps": [
     act("restore-point", "Visszaállítási pont", "Restore point"),
     chk("temp-size", "Takarítható hely felmérése", "Measure cleanable space"),
     act("temp-cleanup", "Ideiglenes fájlok törlése (24 óránál régebbiek)", "Delete temporary files (older than 24 h)"),
     act("do-cache-clean", "Frissítési gyorsítótár törlése", "Clear the update cache"),
     act("recycle-empty", "Lomtár ürítése", "Empty the Recycle Bin", default=False,
         warn=warn("Előtte kérdezd meg az ügyfelet, nincs-e a Lomtárban szükséges fájl.", "Ask the client first whether the Recycle Bin holds anything needed.")),
     man("Indítási elemek átnézése (Autoruns)", "Review startup items (Autoruns)",
         "Logon és Scheduled Tasks fül: vedd ki a pipát a felesleges, nem Microsoft elemekből. Ne törölj.",
         "Logon and Scheduled Tasks tabs: untick unneeded non-Microsoft items. Don't delete.", app="autoruns", mode="admin"),
     man("Felesleges programok eltávolítása (BCU)", "Remove unneeded programs (BCU)",
         "Egyeztesd az ügyféllel, mit lehet eltávolítani.", "Agree with the client what can be removed.", app="bcu", mode="admin"),
     act("dism-component-cleanup", "Windows összetevő-tisztítás (DISM)", "Windows component cleanup (DISM)", default=False),
     act("hibernate-off", "Hibernálás kikapcsolása (helyet szabadít)", "Turn off hibernation (frees space)", default=False,
         warn=warn("Laptopon a hibernálás hasznos lehet; csak asztali gépen javasolt.", "Hibernation can be useful on laptops; suggested for desktops only.")),
     act("power-balanced", "Kiegyensúlyozott energiaséma", "Balanced power plan", default=False, confirm=False, admin=False),
     act("winget-upgrade", "Programok frissítése (winget)", "Update programs (winget)", default=False),
     man("Programok frissítése (Patch My PC)", "Update programs (Patch My PC)", "Csak azt pipáld, amit tényleg frissítenél.", "Tick only what you really want updated.", app="patchmypc", mode="admin"),
     chk("perf-snapshot", "Ellenőrzés a végén", "Final check"),
   ]},

  {"id": "repair", "icon": "wrench", "risk": "repair", "minutes": 45,
   "title": T("Rendszerjavítás", "System repair"),
   "desc": T("DISM és SFC a sérült rendszerfájlokra, fájlrendszer-ellenőrzés. Internet kell hozzá, és sokáig tart.",
             "DISM and SFC for corrupt system files, file system check. Needs internet and takes a while."),
   "steps": [
     chk("sys-overview", "Függő újraindítás ellenőrzése", "Check for pending restart"),
     act("restore-point", "Visszaállítási pont", "Restore point"),
     act("dism-restore", "Rendszerkép javítása (DISM RestoreHealth)", "Repair the system image (DISM RestoreHealth)", confirm=False),
     act("sfc", "Rendszerfájlok ellenőrzése (SFC)", "Check system files (SFC)", confirm=False),
     act("chkdsk-scan", "Fájlrendszer ellenőrzése (online)", "Check the file system (online)", confirm=False),
     act("chkdsk-schedule", "Lemezjavítás ütemezése újraindításra", "Schedule a disk repair at restart", default=False),
     man("Indítsd újra a gépet", "Restart the PC", "Az SFC és DISM javításai újraindítás után lépnek életbe.", "SFC and DISM repairs take effect after a restart."),
   ]},

  {"id": "malware", "icon": "shield", "risk": "changes", "minutes": 40,
   "title": T("Kártevő-irtás", "Malware sweep"),
   "desc": T("Gyanús indítási elemek, ütemezett feladatok, böngésző-eltérítés, proxy és hosts, majd két vírusirtó.",
             "Suspicious startup items, scheduled tasks, browser hijacks, proxy and hosts, then two scanners."),
   "warn": T("Zsarolóvírus gyanújánál előbb húzd ki a hálózatot, és ne indítsd újra a gépet.", "If you suspect ransomware, unplug the network first and don't restart the PC."),
   "steps": [
     chk("av-status", "Vírusvédelem állapota", "Antivirus status"),
     chk("startup-review", "Gyanús indítási elemek", "Suspicious startup items"),
     chk("sched-tasks-check", "Gyanús ütemezett feladatok", "Suspicious scheduled tasks"),
     chk("browser-policy-check", "Böngésző-eltérítés (házirendek)", "Browser hijack (policies)"),
     chk("proxy-check", "Proxy beállítások", "Proxy settings"),
     chk("hosts-check", "Hosts fájl", "Hosts file"),
     act("defender-update", "Defender adatbázis frissítése", "Update Defender signatures", confirm=False),
     act("defender-scan", "Defender gyorsvizsgálat", "Defender quick scan", confirm=False),
     man("Második vélemény: Kaspersky VRT", "Second opinion: Kaspersky VRT", "Teljes vizsgálat, a találatokat töröltesd.", "Full scan, let it remove what it finds.", app="kvrt", mode="admin"),
     man("Emsisoft Emergency Kit", "Emsisoft Emergency Kit", "Ha a KVRT talált valamit, fuss még egy kört ezzel.", "If KVRT found something, do another pass with this.", app="eek", default=False),
     man("Autoruns átnézése (aláíratlan elemek)", "Review Autoruns (unsigned items)", "Options > Scan Options > Check VirusTotal.com; a piros sorokat vizsgáld meg.", "Options > Scan Options > Check VirusTotal.com; examine the red rows.", app="autoruns", mode="admin"),
     man("Böngésző bővítmények átnézése", "Review browser extensions", "Távolíts el mindent, amit az ügyfél nem ismer fel; ellenőrizd a kezdőlapot és a keresőt.", "Remove anything the client doesn't recognise; check the home page and search engine."),
     man("Jelszavak cseréje", "Change passwords", "Kérd meg az ügyfelet, hogy egy MÁSIK, tiszta eszközről cserélje az e-mail és banki jelszavait.", "Ask the client to change email and banking passwords from a DIFFERENT, clean device."),
   ]},

  {"id": "network", "icon": "network", "risk": "changes", "minutes": 10,
   "title": T("Hálózati hibaelhárítás", "Network troubleshooting"),
   "desc": T("Lépésenként megmondja, hol akad el a kapcsolat (router, internet, DNS, proxy), majd javít.",
             "Finds where the connection breaks (router, internet, DNS, proxy), then fixes it."),
   "steps": [
     chk("net-diag", "Kapcsolat diagnózis", "Connection diagnosis"),
     chk("proxy-check", "Proxy", "Proxy"),
     chk("hosts-check", "Hosts fájl", "Hosts file"),
     act("dns-flush", "DNS gyorsítótár ürítése", "Flush DNS cache", confirm=False),
     act("time-sync", "Óra szinkronizálása (rossz idő = HTTPS hibák)", "Sync the clock (wrong time = HTTPS errors)", confirm=False),
     act("net-reset", "Hálózati beállítások alaphelyzetbe (újraindítás kell)", "Reset the network stack (restart needed)", default=False,
         warn=warn("Statikus IP vagy VPN beállítás elveszhet. Előtte jegyezd fel az ipconfig /all kimenetét.", "Static IP or VPN settings may be lost. Note down ipconfig /all first.")),
     man("Csomagvesztés mérése (WinMTR)", "Measure packet loss (WinMTR)", "Cél: 8.8.8.8, 1-2 percig.", "Target 8.8.8.8 for 1-2 minutes.", app="winmtr", default=False),
     chk("net-diag", "Újraellenőrzés", "Re-check"),
   ]},

  {"id": "wufix", "icon": "refresh", "risk": "repair", "minutes": 40,
   "title": T("Windows Update javítás", "Windows Update fix"),
   "desc": T("Elakadt vagy hibakóddal leálló frissítésekhez: alaphelyzetbe állítás és rendszerkép-javítás.",
             "For stuck or failing updates: component reset and system image repair."),
   "steps": [
     chk("update-status", "Frissítési előzmények és hibák", "Update history and failures"),
     chk("disk-health", "Szabad hely (min. 20 GB kell)", "Free space (20 GB needed)", params={"smart": "false"}),
     act("restore-point", "Visszaállítási pont", "Restore point"),
     act("wu-reset", "Windows Update összetevők alaphelyzetbe", "Reset Windows Update components"),
     act("dism-restore", "Rendszerkép javítása (DISM)", "Repair the system image (DISM)", confirm=False),
     act("time-sync", "Óra szinkronizálása", "Sync the clock", confirm=False),
     man("Frissítések keresése", "Check for updates", "Nyomd meg a Frissítések keresése gombot, és várd meg a telepítést.", "Press Check for updates and wait for the install.", **WU_OPEN),
   ]},

  {"id": "backup", "icon": "drive", "risk": "safe", "minutes": 20,
   "title": T("Újratelepítés előtti mentés", "Pre-reinstall backup"),
   "desc": T("Kulcsok, Wi-Fi jelszavak, illesztőprogramok, programlista és könyvjelzők mentése a kit data\\backups mappájába.",
             "Saves keys, Wi-Fi passwords, drivers, program list and bookmarks into the kit's data\\backups folder."),
   "warn": T("A mentés bizalmas adatot tartalmaz (jelszavak, kulcsok). A munka után töröld, vagy tartsd titkosított pendrive-on.",
             "The backup holds confidential data (passwords, keys). Delete it after the job or keep it on an encrypted stick."),
   "steps": [
     chk("user-folders-size", "Felhasználói mappák mérete", "User folder sizes"),
     act("keys-export", "Termékkulcsok (Windows, Office)", "Product keys (Windows, Office)", confirm=False),
     act("wifi-export", "Wi-Fi profilok jelszóval", "Wi-Fi profiles with passwords"),
     act("driver-export", "Illesztőprogramok mentése", "Export drivers",
         warn=warn("1-3 GB is lehet. Ellenőrizd, van-e elég hely a pendrive-on.", "Can be 1-3 GB. Check there's room on the stick.")),
     act("programs-export", "Telepített programok listája", "Installed program list", confirm=False),
     act("bookmarks-backup", "Böngésző könyvjelzők", "Browser bookmarks", confirm=False),
     man("Felhasználói adatok másolása", "Copy user data", "Asztal, Dokumentumok, Képek, Letöltések, e-mail fiókok: külső lemezre. A mentés mappája megnyílik.",
         "Desktop, Documents, Pictures, Downloads, email accounts: to an external disk. The backup folder opens.", folder="backups"),
   ]},

  {"id": "slowpc", "icon": "slow", "risk": "safe", "minutes": 10,
   "title": T("Lassú gép diagnózis", "Slow PC diagnosis"),
   "desc": T("Megkeresi a lassulás okát: terhelés, memória, lemez, hő, indítási elemek. Nem változtat semmin.",
             "Finds the cause of slowness: load, memory, disk, heat, startup items. Changes nothing."),
   "steps": [
     chk("perf-snapshot", "Mi terheli a gépet", "What loads the PC"),
     chk("disk-health", "Lemez állapota és típusa", "Disk health and type"),
     chk("startup-review", "Indítási elemek", "Startup items"),
     chk("temp-size", "Ideiglenes fájlok", "Temporary files"),
     chk("crash-events", "Hibák az eseménynaplóban", "Errors in the event log"),
     man("Hőmérsékletek (HWiNFO)", "Temperatures (HWiNFO)", "Sensors-only mód; 90 °C feletti CPU lassítja magát.", "Sensors-only mode; a CPU above 90 °C throttles itself.", app="hwinfo"),
     man("Folyamatok részletesen (Process Explorer)", "Processes in detail (Process Explorer)", "", "", app="procexp", default=False),
     man("Lemezsebesség mérése (CrystalDiskMark)", "Measure disk speed (CrystalDiskMark)", "SSD-csere előtt és után is mérd, a jelentésbe írd be.", "Measure before and after an SSD swap; note it for the report.", app="crystaldiskmark", default=False),
   ]},

  {"id": "printer", "icon": "doc", "risk": "changes", "minutes": 5,
   "title": T("Nyomtató javítás", "Printer fix"),
   "desc": T("Elakadt nyomtatási sor, offline nyomtató, nem induló nyomtatásvezérlő.",
             "Stuck print queue, offline printer, spooler that won't start."),
   "steps": [
     chk("printer-status", "Nyomtatók és nyomtatási sor", "Printers and print queue"),
     act("spooler-reset", "Nyomtatási sor ürítése, szolgáltatás újraindítása", "Clear the queue and restart the spooler"),
     chk("printer-status", "Újraellenőrzés", "Re-check"),
     man("Tesztoldal nyomtatása", "Print a test page", "Nyomtató tulajdonságai > Tesztoldal nyomtatása. Hálózati nyomtatónál pingeld az IP-címét.",
         "Printer properties > Print test page. For a network printer ping its IP.", open={"file": "control.exe", "args": "printers"}),
   ]},

  {"id": "newpc", "icon": "power", "risk": "changes", "minutes": 30,
   "title": T("Új gép beüzemelése", "New PC setup"),
   "desc": T("Aktiválás, frissítések, védelem, visszaállítás bekapcsolása, gyári kéretlen programok, alapprogramok.",
             "Activation, updates, protection, restore points, OEM bloat, basic programs."),
   "steps": [
     chk("sys-overview", "Rendszer áttekintése", "System overview"),
     chk("activation-check", "Aktiválás", "Activation"),
     chk("av-status", "Vírusvédelem", "Antivirus"),
     act("enable-restore", "Rendszervédelem bekapcsolása", "Turn on System Protection"),
     act("restore-point", "Első visszaállítási pont", "First restore point", confirm=False),
     man("Gyári kéretlen programok (BCU)", "OEM bloatware (BCU)", "Próbaverziós vírusirtók, gyártói segédprogramok.", "Trial antivirus, vendor utilities.", app="bcu", mode="admin"),
     man("Adatvédelmi beállítások (ShutUp10++)", "Privacy settings (ShutUp10++)", "Csak az ajánlott (zöld) beállítások.", "Recommended (green) settings only.", app="shutup10", mode="admin", default=False),
     act("winget-install", "Alapprogramok telepítése (winget)", "Install basic programs (winget)", default=False,
         params={"packages": "7zip.7zip VideoLAN.VLC SumatraPDF.SumatraPDF"},
         inputs=[{"key": "packages", "label": T("winget azonosítók szóközzel", "winget IDs, space separated")}]),
     act("keys-export", "OEM kulcs mentése a nyilvántartásba", "Save the OEM key for your records", default=False, confirm=False),
     man("Windows frissítések", "Windows updates", "Telepíts minden elérhető frissítést, majd indítsd újra.", "Install all available updates, then restart.", **WU_OPEN),
   ]},

  {"id": "monthly", "icon": "home", "risk": "changes", "minutes": 25,
   "title": T("Havi ellenőrzés", "Monthly check-up"),
   "desc": T("Rendszeres karbantartás rokon vagy visszatérő ügyfél gépén, akár távsegítséggel is.",
             "Routine maintenance for a relative's or regular client's PC, also over remote help."),
   "steps": [
     chk("sys-overview", "Rendszer", "System"),
     chk("disk-health", "Lemezek", "Disks"),
     chk("av-status", "Vírusvédelem", "Antivirus"),
     chk("update-status", "Frissítések", "Updates"),
     chk("crash-events", "Hibák", "Errors"),
     chk("battery-check", "Akkumulátor", "Battery"),
     act("defender-update", "Defender frissítés", "Defender update", confirm=False),
     act("defender-scan", "Defender gyorsvizsgálat", "Defender quick scan", confirm=False),
     act("temp-cleanup", "Ideiglenes fájlok törlése", "Delete temporary files"),
     act("restore-point", "Visszaállítási pont", "Restore point", default=False),
     man("Programok frissítése (Patch My PC)", "Update programs (Patch My PC)", "", "", app="patchmypc", mode="admin", default=False),
   ]},

  {"id": "survey", "icon": "wifi", "risk": "safe", "minutes": 10,
   "title": T("Okosotthon helyszíni felmérés", "Smart-home site survey"),
   "desc": T("A saját laptopodon fut: hálózat, eszközlista gyártótippel, Wi-Fi csatornák, nyitott portok. Az eredmény CSV-ben a jelentés mellé kerül.",
             "Runs on your own laptop: network, device list with vendor hints, Wi-Fi channels, open ports. Results are saved as CSV next to the report."),
   "warn": T("Csak a saját vagy az ügyfél által engedélyezett hálózatot mérd fel.", "Only survey networks you own or the client has authorised."),
   "steps": [
     chk("net-diag", "Hálózat és internet", "Network and internet"),
     chk("lan-scan", "Eszközök a hálózaton", "Devices on the network"),
     chk("wifi-survey", "Wi-Fi hálózatok és csatornák", "Wi-Fi networks and channels"),
     chk("port-check", "Nyitott portok (router, HA, MQTT, Modbus, kamerák)", "Open ports (router, HA, MQTT, Modbus, cameras)",
         params={"hosts": "", "ports": "22,80,443,502,554,1883,8080,8123"},
         inputs=[{"key": "hosts", "label": T("Címek (üresen: router)", "Addresses (empty: router)")}, {"key": "ports", "label": T("Portok", "Ports")}]),
     man("Bejárás jelerősséggel (WifiInfoView)", "Walk-through with signal (WifiInfoView)", "Járd végig a leendő eszközhelyeket; -67 dBm vagy jobb kell.", "Walk the planned device spots; aim for -67 dBm or better.", app="wifiinfoview"),
     man("Részletes szkennelés (Advanced IP Scanner)", "Detailed scan (Advanced IP Scanner)", "", "", app="advancedip", default=False),
     man("Eredmények rögzítése", "Record the findings", "Írd a munka jegyzetei közé: router helye, gyenge pontok, javasolt AP-k és csatorna.",
         "Add to the job notes: router location, weak spots, suggested APs and channel."),
   ]},
]

# Súgó entries that get a "run playbook" button
SUGO_LINKS = {
    "slow-pc": ["slowpc", "tuneup"], "slow-boot": ["tuneup"], "bsod": ["health", "repair"], "random-freeze": ["health"],
    "malware-suspect": ["malware"], "browser-hijack": ["malware"], "no-internet": ["network"], "dns": ["network"],
    "slow-wifi": ["survey"], "system-files": ["repair"], "update-stuck": ["wufix"], "no-boot": [], "printer": ["printer"],
    "before-reinstall": ["backup"], "update-apps": ["tuneup"], "disk-full": ["tuneup"], "battery-health": ["health"],
    "wifi-survey": ["survey"], "lan-devices": ["survey"], "network-scan": ["survey"], "disk-failing": ["health"],
}

ids = set()
for pb in PLAYBOOKS:
    assert pb["id"] not in ids; ids.add(pb["id"])
    for s in pb["steps"]:
        if s["kind"] != "manual": assert s["routine"] in ROUTINES, s["routine"]
for k, v in SUGO_LINKS.items():
    for x in v: assert x in ids, x

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = {"version": 1, "playbooks": PLAYBOOKS, "sugoLinks": SUGO_LINKS}
with open(os.path.join(root, "core", "playbooks.json"), "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=1)
with open(os.path.join(root, "launcher", "data", "playbooks.js"), "w", encoding="utf-8") as f:
    f.write("/* Generated by core/build_playbooks.py */\nwindow.KIT_PLAYBOOKS = " + json.dumps(out, ensure_ascii=False) + ";\n")
print(len(PLAYBOOKS), "playbooks,", sum(len(p["steps"]) for p in PLAYBOOKS), "steps")
