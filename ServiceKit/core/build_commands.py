# Builds the command database:
#   launcher/data/commands.js   (used by the Dashboard "Parancsok" page)
#   PARANCSOK.html               (standalone offline page: works from a stick, a PC or a phone)
# Edit the list below, then run:  python core/build_commands.py
#
# Row: (category, shell, flags, command, Hungarian description, English description[, (note hu, note en)])
#   shell: "cmd" = Command Prompt syntax, "ps" = PowerShell, "both" = works in either
#   flags: a = needs admin, d = caution (changes/deletes things), w8 / w10 / w11 = minimum Windows,
#          old = legacy (e.g. wmic, removed from new Windows 11), re = recovery environment (WinRE) only
# Variables {IP} {HOST} {PORT} {USER} {DRIVE} {NAME} {FILE} are filled in from the page's variable bar.
import json, os

CATS = [
    ("info", "Rendszerinformáció", "System info"),
    ("proc", "Folyamatok és szolgáltatások", "Processes & services"),
    ("disk", "Lemez és fájlok", "Disk & files"),
    ("net", "Hálózat", "Network"),
    ("wifi", "Wi-Fi", "Wi-Fi"),
    ("repair", "Javítás", "Repair"),
    ("update", "Frissítés és programok", "Updates & software"),
    ("users", "Felhasználók", "Users"),
    ("power", "Energia és akku", "Power & battery"),
    ("dev", "Eszközök és illesztők", "Devices & drivers"),
    ("print", "Nyomtatás", "Printing"),
    ("sec", "Biztonság", "Security"),
    ("lic", "Licenc és aktiválás", "Licensing"),
    ("event", "Eseménynapló", "Event logs"),
    ("task", "Ütemezett feladatok", "Scheduled tasks"),
    ("reg", "Registry", "Registry"),
    ("boot", "Indítás és helyreállítás", "Boot & recovery"),
    ("remote", "Távoli elérés", "Remote access"),
    ("open", "Gyors megnyitás (Win+R)", "Quick open (Win+R)"),
    ("smart", "Okosotthon", "Smart home"),
    ("devtools", "Fejlesztés", "Development"),
]

VARS = [
    ("IP", "192.168.1.1", "IP-cím", "IP address"),
    ("HOST", "server01", "Gépnév / cím", "Host name"),
    ("PORT", "1883", "Port", "Port"),
    ("USER", "user", "Felhasználó", "User"),
    ("DRIVE", "C:", "Meghajtó", "Drive"),
    ("NAME", "name", "Név (program, szolgáltatás, nyomtató, Wi-Fi)", "Name (process, service, printer, Wi-Fi)"),
    ("FILE", "file.exe", "Fájl", "File"),
]

DEF = r'"%ProgramFiles%\Windows Defender\MpCmdRun.exe"'

C = [
# ---------------------------------------------------------------- info
("info", "both", "", r"systeminfo", "Teljes rendszerinformáció: Windows, telepítés dátuma, memória, frissítések.", "Full system info: Windows, install date, memory, hotfixes."),
("info", "both", "", r"winver", "Windows verzió és build ablakban.", "Windows version and build in a window."),
("info", "both", "", r"msinfo32", "Rendszerinformáció ablak (BIOS mód, Secure Boot, alaplap).", "System Information window (BIOS mode, Secure Boot, board)."),
("info", "cmd", "", r"msinfo32 /report %USERPROFILE%\Desktop\msinfo.txt", "Rendszerinformáció mentése szövegfájlba az Asztalra.", "Save System Information to a text file on the Desktop."),
("info", "ps", "w10", r"Get-ComputerInfo | Select-Object OsName, OsVersion, OsBuildNumber, CsManufacturer, CsModel, BiosSerialNumber", "Gép és Windows összefoglaló.", "Machine and Windows summary."),
("info", "ps", "", r"(Get-CimInstance Win32_BIOS).SerialNumber", "Sorozatszám (a gyártói garanciához).", "Serial number (for the vendor warranty)."),
("info", "cmd", "old", r"wmic bios get serialnumber", "Sorozatszám régi módszerrel.", "Serial number, legacy method.", ("A wmic az új Windows 11-ből hiányozhat.", "wmic may be missing on new Windows 11.")),
("info", "ps", "", r"Get-CimInstance Win32_ComputerSystem | Select-Object Manufacturer, Model, @{n='RAM_GB';e={[math]::Round($_.TotalPhysicalMemory/1GB,1)}}", "Gyártó, modell, memória.", "Manufacturer, model, memory."),
("info", "ps", "", r"Get-CimInstance Win32_PhysicalMemory | Select-Object DeviceLocator, @{n='GB';e={$_.Capacity/1GB}}, Speed, Manufacturer, PartNumber", "Memóriamodulok foglalatonként (bővítés előtt).", "Memory modules per slot (before an upgrade)."),
("info", "ps", "", r"Get-CimInstance Win32_Processor | Select-Object Name, NumberOfCores, NumberOfLogicalProcessors", "Processzor típusa, magok.", "CPU model and cores."),
("info", "ps", "", r"Get-CimInstance Win32_VideoController | Select-Object Name, DriverVersion, DriverDate", "Videokártya és illesztő verzió.", "Graphics card and driver version."),
("info", "ps", "", r"(Get-CimInstance Win32_OperatingSystem).LastBootUpTime", "Utolsó rendszerindítás ideje.", "Last boot time."),
("info", "ps", "", r"Get-HotFix | Sort-Object InstalledOn -Descending | Select-Object -First 10", "A 10 legutóbbi Windows frissítés.", "The 10 most recent Windows updates."),
("info", "ps", "", r"Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion' | Select-Object ProductName, DisplayVersion, CurrentBuild, UBR", "Pontos Windows kiadás (pl. 23H2) és build.", "Exact Windows release (e.g. 23H2) and build."),
("info", "both", "", r"whoami /all", "Bejelentkezett felhasználó, csoportok, jogosultságok.", "Signed-in user, groups, privileges."),
("info", "both", "", r"hostname", "Számítógép neve.", "Computer name."),
("info", "ps", "", r"$PSVersionTable.PSVersion", "PowerShell verzió.", "PowerShell version."),
("info", "cmd", "", r"dxdiag /t %USERPROFILE%\Desktop\dxdiag.txt", "DirectX diagnosztika fájlba (játék, videó, hang hibákhoz).", "DirectX diagnostics to a file (games, video, sound issues)."),

# ---------------------------------------------------------------- processes & services
("proc", "both", "", r"tasklist", "Futó folyamatok listája.", "List running processes."),
("proc", "both", "", r"tasklist /svc", "Folyamatok és a bennük futó szolgáltatások.", "Processes and the services inside them."),
("proc", "both", "d", r"taskkill /im {FILE} /f", "Program kényszerített bezárása név szerint.", "Force-close a program by name."),
("proc", "both", "d", r"taskkill /pid 1234 /t /f", "Folyamat és gyermekei bezárása PID alapján.", "Kill a process and its children by PID."),
("proc", "ps", "", r"Get-Process | Sort-Object CPU -Descending | Select-Object -First 15 Name, Id, CPU, @{n='MB';e={[int]($_.WS/1MB)}}", "Mi eszi a processzort.", "What is using the CPU."),
("proc", "ps", "", r"Get-Process | Sort-Object WS -Descending | Select-Object -First 15 Name, Id, @{n='MB';e={[int]($_.WS/1MB)}}", "Mi eszi a memóriát.", "What is using memory."),
("proc", "ps", "", "Get-CimInstance Win32_Process -Filter \"Name='{FILE}'\" | Select-Object ProcessId, CommandLine", "Egy program teljes parancssora (honnan és mivel indult).", "A program's full command line (where from, with what)."),
("proc", "ps", "", r"Get-Service | Where-Object Status -eq 'Running' | Sort-Object DisplayName", "Futó szolgáltatások.", "Running services."),
("proc", "both", "", r"sc qc {NAME}", "Szolgáltatás beállításai (indítás típusa, elérési út).", "Service configuration (start type, path)."),
("proc", "both", "a", r"net stop {NAME}", "Szolgáltatás leállítása.", "Stop a service."),
("proc", "both", "a", r"net start {NAME}", "Szolgáltatás indítása.", "Start a service."),
("proc", "ps", "a", r"Restart-Service {NAME} -Force", "Szolgáltatás újraindítása.", "Restart a service."),
("proc", "both", "a d", r"sc config {NAME} start= disabled", "Szolgáltatás letiltása (a szóköz a = után kötelező).", "Disable a service (the space after = is required)."),
("proc", "both", "", r"perfmon /rel", "Megbízhatósági figyelő: összeomlások és hibák idővonalon. Ügyfélnek is jól mutatható.", "Reliability Monitor: crashes and errors on a timeline. Easy to show clients."),
("proc", "both", "", r"resmon", "Erőforrás-figyelő: lemez, hálózat, memória folyamatonként.", "Resource Monitor: disk, network, memory per process."),
("proc", "both", "", r"taskmgr", "Feladatkezelő.", "Task Manager."),
("proc", "cmd", "", r"netstat -ano | findstr :{PORT}", "Melyik PID használja a portot.", "Which PID uses the port."),
("proc", "ps", "w8", r"Get-Process -Id (Get-NetTCPConnection -LocalPort {PORT}).OwningProcess", "Melyik program figyel az adott porton.", "Which program listens on the port."),
("proc", "ps", "w8", r"Get-NetTCPConnection -State Listen | Sort-Object LocalPort | Select-Object LocalAddress, LocalPort, OwningProcess", "Minden figyelő port és folyamat.", "All listening ports and processes."),

# ---------------------------------------------------------------- disk & files
("disk", "both", "", r"chkdsk {DRIVE}", "Lemezellenőrzés csak olvasva (nem javít).", "Read-only disk check (no fixes)."),
("disk", "both", "a w8", r"chkdsk {DRIVE} /scan", "Online ellenőrzés futó Windows alatt.", "Online check while Windows runs."),
("disk", "both", "a d", r"chkdsk {DRIVE} /f", "Fájlrendszer javítása (C:-nél a következő indításkor).", "Repair the file system (for C: at next restart)."),
("disk", "both", "a d", r"chkdsk {DRIVE} /r", "Hibás szektorok keresése is. Órákig tarthat; haldokló lemezen ne futtasd!", "Also scans bad sectors. Can take hours; don't run on a dying disk!"),
("disk", "both", "a", r"fsutil dirty query {DRIVE}", "Meg van-e jelölve a kötet ellenőrzésre.", "Whether the volume is flagged for a check."),
("disk", "both", "", r"diskmgmt.msc", "Lemezkezelés.", "Disk Management."),
("disk", "both", "a d", r"diskpart", "Lemezkezelő parancssor: list disk, list volume, select disk N…", "Disk partitioning shell: list disk, list volume, select disk N…", ("Egy rossz select + clean az egész lemezt törli.", "One wrong select + clean wipes the whole disk.")),
("disk", "ps", "w8", r"Get-PhysicalDisk | Select-Object FriendlyName, MediaType, BusType, HealthStatus, @{n='GB';e={[int]($_.Size/1GB)}}", "Lemezek típusa (HDD/SSD) és állapota.", "Disk type (HDD/SSD) and health."),
("disk", "ps", "w8", r"Get-Volume | Sort-Object DriveLetter", "Kötetek, szabad hely.", "Volumes and free space."),
("disk", "both", "", r"cleanmgr", "Lemezkarbantartó.", "Disk Cleanup."),
("disk", "both", "a", r"cleanmgr /sageset:1", "Lemezkarbantartó beállítás mentése (utána /sagerun:1 futtatja).", "Save Disk Cleanup selections (then /sagerun:1 runs them)."),
("disk", "both", "a", r"cleanmgr /sagerun:1", "A mentett takarítás futtatása.", "Run the saved cleanup."),
("disk", "both", "a", r"defrag {DRIVE} /O", "Optimalizálás: HDD-n töredezettségmentesít, SSD-n TRIM.", "Optimize: defrag on HDD, TRIM on SSD."),
("disk", "ps", "a w8", r"Optimize-Volume -DriveLetter C -ReTrim -Verbose", "SSD TRIM kézzel.", "Manual SSD TRIM."),
("disk", "both", "a w10", r"compact /compactos:always", "Windows fájlok tömörítése (2-4 GB hely kis SSD-n).", "Compress Windows files (2-4 GB on small SSDs)."),
("disk", "ps", "", r"Get-ChildItem {DRIVE}\ -Recurse -File -ErrorAction SilentlyContinue | Sort-Object Length -Descending | Select-Object -First 20 FullName, @{n='MB';e={[int]($_.Length/1MB)}}", "A 20 legnagyobb fájl a meghajtón (lassú, de mindenhol fut).", "The 20 largest files on the drive (slow but works everywhere)."),
("disk", "ps", "", r'"{0:N1} GB" -f ((Get-ChildItem "$env:USERPROFILE\Downloads" -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum / 1GB)', "Egy mappa mérete (itt: Letöltések).", "Size of a folder (here: Downloads)."),
("disk", "both", "", r'robocopy "C:\Users\{USER}" "E:\Mentes\{USER}" /E /XJ /R:1 /W:1 /MT:8 /XD AppData /LOG:"E:\Mentes\robocopy.log"', "Felhasználói profil mentése külső lemezre, napló fájllal.", "Back up a user profile to an external disk, with a log file."),
("disk", "both", "d", r'robocopy "D:\Forras" "E:\Cel" /MIR /R:1 /W:1', "Tükrözés: a célban törli, ami a forrásban nincs!", "Mirror: deletes from the target whatever isn't in the source!"),
("disk", "cmd", "d", r"attrib -h -s -r {DRIVE}\*.* /s /d", "Rejtett fájlok visszaállítása vírusos pendrive-on (\"parancsikon vírus\").", "Unhide files on an infected USB stick (\"shortcut virus\")."),
("disk", "both", "a", r'takeown /f "{FILE}"', "Fájl tulajdonjogának átvétele.", "Take ownership of a file."),
("disk", "cmd", "a", r'icacls "{FILE}" /grant %USERNAME%:F', "Teljes jog adása magadnak.", "Grant yourself full control."),
("disk", "both", "a d", r'icacls "C:\Mappa" /reset /t /c /q', "Jogosultságok visszaállítása öröklöttre a mappában.", "Reset permissions to inherited in a folder."),
("disk", "cmd", "", r"dir /s /b {DRIVE}\*{NAME}*", "Fájl keresése név alapján.", "Find a file by name."),
("disk", "ps", "", r'Get-FileHash "{FILE}" -Algorithm SHA256', "Fájl ujjlenyomata (letöltés ellenőrzése, VirusTotal).", "File fingerprint (verify downloads, VirusTotal)."),
("disk", "both", "", r'certutil -hashfile "{FILE}" SHA256', "Ujjlenyomat régi Windowson is.", "Fingerprint, works on old Windows too."),
("disk", "both", "a d", r"format {DRIVE} /fs:ntfs /q /v:Adat", "Gyorsformázás NTFS-re. Minden adat elvész!", "Quick format to NTFS. All data is lost!"),
("disk", "both", "a", r"vssadmin list shadowstorage", "Visszaállítási pontok helyfoglalása.", "Space used by restore points."),
("disk", "both", "", r"tar -xf archive.zip", "Zip kicsomagolása beépített eszközzel (Win10+).", "Extract a zip with the built-in tool (Win10+).", None),

# ---------------------------------------------------------------- network
("net", "both", "", r"ipconfig /all", "IP-cím, átjáró, DNS, MAC minden adapterre.", "IP, gateway, DNS, MAC for every adapter."),
("net", "cmd", "", r"ipconfig /release && ipconfig /renew", "Új IP-cím kérése a routertől.", "Ask the router for a new IP."),
("net", "both", "", r"ipconfig /flushdns", "DNS gyorsítótár ürítése.", "Flush the DNS cache."),
("net", "both", "", r"ping {IP} -t", "Folyamatos ping (Ctrl+C a leállításhoz). Szakadozás kereséséhez.", "Continuous ping (Ctrl+C to stop). For finding dropouts."),
("net", "both", "", r"tracert {HOST}", "Útvonal a célig: hol akad el.", "Route to the target: where it stops."),
("net", "both", "", r"pathping {HOST}", "Csomagvesztés ugrásonként (kb. 5 perc).", "Packet loss per hop (about 5 minutes)."),
("net", "both", "", r"nslookup {HOST}", "Névfeloldás a beállított DNS-sel.", "Name lookup with the configured DNS."),
("net", "both", "", r"nslookup {HOST} 1.1.1.1", "Névfeloldás egy másik DNS-sel (összehasonlításhoz).", "Name lookup with another DNS (to compare)."),
("net", "both", "", r"arp -a", "IP-MAC párok a helyi hálózaton.", "IP-MAC pairs on the local network."),
("net", "cmd", "", r'for /L %i in (1,1,254) do @ping -n 1 -w 200 192.168.1.%i | find "TTL="', "Gyors pingelés az egész /24 hálózaton (élő eszközök).", "Quick ping sweep of the whole /24 (live devices)."),
("net", "both", "", r"route print", "Útválasztási tábla (VPN, több adapter gondjainál).", "Routing table (for VPN or multi-adapter issues)."),
("net", "both", "", r"getmac /v", "MAC-címek adapterenként.", "MAC addresses per adapter."),
("net", "both", "a", r"netsh winsock reset", "Winsock alaphelyzet (újraindítás kell).", "Reset Winsock (restart needed)."),
("net", "both", "a", r"netsh int ip reset", "TCP/IP alaphelyzet (újraindítás kell).", "Reset TCP/IP (restart needed)."),
("net", "both", "", r"netsh interface show interface", "Adapterek nevei és állapota (a további netsh parancsokhoz).", "Adapter names and state (for other netsh commands)."),
("net", "both", "a", r'netsh interface ip set dns "Wi-Fi" static 1.1.1.1', "Kézi DNS beállítása az adapteren.", "Set a manual DNS on the adapter."),
("net", "both", "a", r'netsh interface ip set dns "Wi-Fi" dhcp', "DNS vissza automatikusra.", "DNS back to automatic."),
("net", "both", "", r"netsh winhttp show proxy", "Rendszerszintű proxy.", "System-wide proxy."),
("net", "both", "a", r"netsh winhttp reset proxy", "Rendszerszintű proxy törlése.", "Clear the system-wide proxy."),
("net", "both", "", r"netsh advfirewall show allprofiles state", "Tűzfal állapota profilonként.", "Firewall state per profile."),
("net", "both", "a", r'netsh advfirewall firewall add rule name="MQTT {PORT}" dir=in action=allow protocol=TCP localport={PORT}', "Bejövő port engedélyezése a tűzfalon.", "Allow an inbound port in the firewall."),
("net", "both", "a d", r"netsh advfirewall reset", "Tűzfal vissza gyári beállításra.", "Firewall back to defaults."),
("net", "ps", "w8", r"Test-NetConnection {HOST} -Port {PORT}", "Elérhető-e a port (MQTT, HA, RDP, kamera).", "Is the port reachable (MQTT, HA, RDP, camera)."),
("net", "ps", "w8", r"Test-NetConnection {HOST} -TraceRoute", "Ping és útvonal egyben.", "Ping and route together."),
("net", "ps", "w8", r"Resolve-DnsName {HOST}", "Részletes DNS lekérdezés.", "Detailed DNS lookup."),
("net", "ps", "w8", r"Get-NetIPConfiguration", "Átlátható IP-összefoglaló.", "Readable IP summary."),
("net", "ps", "w8", r"Get-NetAdapter | Select-Object Name, Status, LinkSpeed, MacAddress", "Adapterek és kapcsolati sebesség (100 Mb = rossz kábel?).", "Adapters and link speed (100 Mb = bad cable?)."),
("net", "ps", "a w8", r'Restart-NetAdapter -Name "Ethernet"', "Hálózati adapter újraindítása.", "Restart a network adapter."),
("net", "both", "w10", r"curl ifconfig.me", "Nyilvános IP-cím.", "Public IP address."),
("net", "both", "w10", r"curl -I https://{HOST}", "Webszerver válaszfejléce (működik-e, átirányít-e).", "Web server response headers (up? redirecting?)."),
("net", "both", "", r"nbtstat -A {IP}", "Windows gép neve IP-cím alapján.", "Windows PC name from its IP."),
("net", "both", "", r"net view \\{HOST}", "Megosztott mappák egy gépen.", "Shared folders on a PC."),
("net", "both", "", r"net use Z: \\{HOST}\share /persistent:yes", "Hálózati meghajtó csatlakoztatása.", "Map a network drive."),
("net", "both", "", r"net use", "Csatlakoztatott hálózati meghajtók.", "Mapped network drives."),
("net", "both", "", r"ncpa.cpl", "Hálózati kapcsolatok ablak.", "Network Connections window."),
("net", "both", "a", r"w32tm /resync", "Óra szinkronizálása (rossz idő = HTTPS és aktiválási hibák).", "Sync the clock (wrong time = HTTPS and activation errors)."),
("net", "both", "", r"w32tm /query /status", "Időszinkron állapota.", "Time sync status."),

# ---------------------------------------------------------------- wifi
("wifi", "both", "", r"netsh wlan show interfaces", "Kapcsolódott Wi-Fi: jelerősség, csatorna, sebesség.", "Connected Wi-Fi: signal, channel, speed."),
("wifi", "both", "", r"netsh wlan show profiles", "Mentett Wi-Fi hálózatok.", "Saved Wi-Fi networks."),
("wifi", "both", "", r'netsh wlan show profile name="{NAME}" key=clear', "Mentett Wi-Fi jelszó megjelenítése (Kulcs tartalma sor).", "Show a saved Wi-Fi password (Key Content line)."),
("wifi", "both", "", r"netsh wlan show networks mode=bssid", "Környező hálózatok csatornával és jelerősséggel.", "Nearby networks with channel and signal."),
("wifi", "cmd", "a", r'netsh wlan export profile key=clear folder="%USERPROFILE%\Desktop"', "Minden Wi-Fi profil mentése jelszóval (újratelepítés előtt).", "Export all Wi-Fi profiles with passwords (before a reinstall)."),
("wifi", "both", "", r'netsh wlan add profile filename="Wi-Fi-{NAME}.xml"', "Mentett profil visszatöltése.", "Import a saved profile."),
("wifi", "both", "", r'netsh wlan connect name="{NAME}"', "Csatlakozás mentett hálózathoz.", "Connect to a saved network."),
("wifi", "both", "d", r'netsh wlan delete profile name="{NAME}"', "Mentett hálózat törlése (új jelszónál).", "Delete a saved network (after a password change)."),
("wifi", "both", "a w10", r"netsh wlan show wlanreport", "Wi-Fi diagnosztikai jelentés (C:\\ProgramData\\Microsoft\\Windows\\WlanReport).", "Wi-Fi diagnostic report (C:\\ProgramData\\Microsoft\\Windows\\WlanReport)."),
("wifi", "both", "", r"netsh wlan show drivers", "Wi-Fi kártya képességei (2,4/5 GHz, szabványok).", "Wi-Fi card capabilities (2.4/5 GHz, standards)."),

# ---------------------------------------------------------------- repair
("repair", "both", "a", r"sfc /scannow", "Rendszerfájlok ellenőrzése és javítása.", "Check and repair system files."),
("repair", "both", "a w8", r"DISM /Online /Cleanup-Image /RestoreHealth", "Rendszerkép javítása (SFC előtt; internet kell).", "Repair the system image (before SFC; needs internet)."),
("repair", "both", "a w8", r"DISM /Online /Cleanup-Image /ScanHealth", "Rendszerkép ellenőrzése javítás nélkül.", "Scan the system image without repairing."),
("repair", "both", "a w8", r"DISM /Online /Cleanup-Image /StartComponentCleanup", "Régi frissítési összetevők törlése (helyet szabadít).", "Remove old update components (frees space)."),
("repair", "both", "a w8", r"DISM /Online /Cleanup-Image /AnalyzeComponentStore", "Mennyi hely szabadítható fel az összetevőtárból.", "How much the component store can be cleaned."),
("repair", "both", "a w8", r"DISM /Online /Cleanup-Image /RestoreHealth /Source:wim:D:\sources\install.wim:1 /LimitAccess", "Javítás telepítő USB-ről, internet nélkül (D: = pendrive; esd esetén esd:).", "Repair from install media without internet (D: = stick; use esd: for .esd)."),
("repair", "both", "re", r"sfc /scannow /offbootdir=C:\ /offwindir=C:\Windows", "SFC helyreállítási parancssorból (a betűjel eltérhet!).", "SFC from the recovery prompt (drive letter may differ!)."),
("repair", "cmd", "", r'findstr /c:"[SR]" %windir%\Logs\CBS\CBS.log > "%USERPROFILE%\Desktop\sfc.txt"', "Az SFC eredményei olvasható fájlba.", "SFC results into a readable file."),
("repair", "both", "", r"rstrui", "Rendszer-visszaállítás varázsló.", "System Restore wizard."),
("repair", "ps", "a", r'Checkpoint-Computer -Description "Szerviz" -RestorePointType MODIFY_SETTINGS', "Visszaállítási pont létrehozása.", "Create a restore point."),
("repair", "both", "", r"SystemPropertiesProtection", "Rendszervédelem fül (visszaállítás be/ki, hely).", "System Protection tab (restore on/off, space)."),
("repair", "cmd", "", r"taskkill /f /im explorer.exe & start explorer.exe", "Intéző és tálca újraindítása.", "Restart Explorer and the taskbar."),
("repair", "both", "w10", r"ie4uinit.exe -show", "Ikon gyorsítótár frissítése (rossz ikonok).", "Refresh the icon cache (wrong icons)."),
("repair", "both", "w10", r"wsreset", "Microsoft Store gyorsítótár törlése.", "Reset the Microsoft Store cache."),
("repair", "ps", "a w10", r'Get-AppxPackage -AllUsers Microsoft.WindowsStore | ForEach-Object { Add-AppxPackage -DisableDevelopmentMode -Register "$($_.InstallLocation)\AppXManifest.xml" }', "Microsoft Store újraregisztrálása.", "Re-register the Microsoft Store."),
("repair", "both", "", r"mdsched", "Windows memóriadiagnosztika (újraindítással).", "Windows Memory Diagnostic (restarts)."),
("repair", "both", "", r"mrt", "Microsoft kártevő-eltávolító eszköz.", "Microsoft Malicious Software Removal Tool."),

# ---------------------------------------------------------------- updates & software
("update", "both", "w10", r"winget upgrade", "Frissíthető programok listája.", "Programs with available updates."),
("update", "both", "w10", r"winget upgrade --all --silent --accept-source-agreements --accept-package-agreements", "Minden program frissítése csendben.", "Update all programs silently."),
("update", "both", "w10", r"winget search {NAME}", "Program keresése.", "Search for a program."),
("update", "both", "w10", r"winget install --id {NAME} -e", "Program telepítése pontos azonosítóval.", "Install a program by exact ID."),
("update", "both", "w10", r"winget list", "Telepített programok (Store-osak is).", "Installed programs (Store ones too)."),
("update", "cmd", "w10", r'winget export -o "%USERPROFILE%\Desktop\apps.json"', "Programlista mentése (új gépre áttöltéshez).", "Save the program list (to restore on a new PC)."),
("update", "both", "w10", r"winget import -i apps.json --accept-package-agreements", "Programok telepítése a mentett listából.", "Install programs from the saved list."),
("update", "both", "w10", r"UsoClient StartScan", "Frissítések keresésének indítása.", "Start an update scan."),
("update", "both", "old", r"wuauclt /detectnow", "Frissítések keresése Windows 7-en.", "Check for updates on Windows 7."),
("update", "cmd", "a d", r"net stop wuauserv && net stop bits && ren %windir%\SoftwareDistribution SoftwareDistribution.old && net start bits && net start wuauserv", "Windows Update gyorsítótár alaphelyzetbe.", "Reset the Windows Update cache."),
("update", "ps", "w10", r"Get-WindowsUpdateLog", "WindowsUpdate.log készítése az Asztalra.", "Create WindowsUpdate.log on the Desktop."),
("update", "ps", "", r"Get-ItemProperty HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*, HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\* | Where-Object DisplayName | Sort-Object DisplayName | Select-Object DisplayName, DisplayVersion, Publisher", "Telepített programok (gyors, nem indít javítást mint a Win32_Product).", "Installed programs (fast, doesn't trigger repairs like Win32_Product)."),
("update", "both", "", r"appwiz.cpl", "Programok és szolgáltatások.", "Programs and Features."),
("update", "both", "a", r"dism /online /enable-feature /featurename:NetFx3 /all", ".NET 3.5 bekapcsolása (régi programokhoz).", "Enable .NET 3.5 (for old programs)."),
("update", "both", "", r"optionalfeatures", "Windows szolgáltatások be/ki.", "Turn Windows features on or off."),
("update", "ps", "a w10", r"Enable-WindowsOptionalFeature -Online -FeatureName Containers-DisposableClientVM -All", "Windows Sandbox bekapcsolása (Pro).", "Enable Windows Sandbox (Pro)."),
("update", "both", "a w10", r"wsl --install", "Linux alrendszer telepítése.", "Install the Linux subsystem."),

# ---------------------------------------------------------------- users
("users", "both", "", r"net user", "Helyi felhasználók.", "Local users."),
("users", "both", "", r"net user {USER}", "Felhasználó adatai (utolsó bejelentkezés, csoportok).", "User details (last logon, groups)."),
("users", "both", "a", r"net user {USER} *", "Jelszó beállítása (rákérdez).", "Set a password (prompts)."),
("users", "both", "a", r"net user {USER} /active:yes", "Fiók engedélyezése.", "Enable an account."),
("users", "both", "a d", r"net user {USER} Jelszo123! /add", "Új helyi felhasználó.", "New local user."),
("users", "both", "a d", r"net localgroup administrators {USER} /add", "Rendszergazdává tétel.", "Make a user administrator.", ("Magyar Windowson a csoport neve Rendszergazdák lehet.", "On Hungarian Windows the group may be called Rendszergazdák.")),
("users", "both", "", r"net localgroup administrators", "Ki rendszergazda.", "Who is an administrator."),
("users", "both", "", r"netplwiz", "Felhasználói fiókok (automatikus bejelentkezés).", "User Accounts (automatic sign-in)."),
("users", "both", "", r"lusrmgr.msc", "Helyi felhasználók és csoportok (Home-ban nincs).", "Local Users and Groups (not in Home)."),
("users", "ps", "w10", r"Get-LocalUser | Select-Object Name, Enabled, LastLogon", "Felhasználók és utolsó belépés.", "Users and last logon."),
("users", "both", "", r"query user", "Bejelentkezett munkamenetek.", "Signed-in sessions."),
("users", "both", "", r"runas /user:{USER} cmd", "Parancssor másik felhasználóként.", "Command prompt as another user."),
("users", "both", "", r"rundll32 keymgr.dll,KRShowKeyMgr", "Tárolt hálózati jelszavak (Hitelesítő adatok).", "Stored network credentials."),

# ---------------------------------------------------------------- power
("power", "cmd", "w8", r'powercfg /batteryreport /output "%USERPROFILE%\Desktop\battery.html"', "Akkumulátor jelentés: kopás, ciklusok, előzmények.", "Battery report: wear, cycles, history."),
("power", "cmd", "a", r'powercfg /energy /output "%USERPROFILE%\Desktop\energy.html"', "Energiahatékonysági jelentés (60 mp).", "Power efficiency report (60 s)."),
("power", "both", "a", r"powercfg /requests", "Mi akadályozza az alvást.", "What prevents sleep."),
("power", "both", "", r"powercfg /lastwake", "Mi ébresztette fel a gépet.", "What woke the PC."),
("power", "both", "", r"powercfg /devicequery wake_armed", "Mely eszközök ébreszthetik a gépet.", "Which devices can wake the PC."),
("power", "both", "", r"powercfg /a", "Elérhető alvó állapotok.", "Available sleep states."),
("power", "both", "", r"powercfg /list", "Energiasémák.", "Power plans."),
("power", "both", "", r"powercfg /setactive SCHEME_BALANCED", "Kiegyensúlyozott séma (SCHEME_MIN = nagy teljesítmény).", "Balanced plan (SCHEME_MIN = high performance)."),
("power", "both", "a", r"powercfg /h off", "Hibernálás ki, hiberfil.sys törlődik.", "Hibernation off, removes hiberfil.sys."),
("power", "both", "a", r"powercfg -duplicatescheme e9a42b02-d5df-448d-aa00-03f14749eb61", "Ultimate Performance séma megjelenítése.", "Unhide the Ultimate Performance plan."),
("power", "both", "", r"shutdown /r /t 0", "Újraindítás azonnal.", "Restart now."),
("power", "both", "", r"shutdown /s /t 0", "Leállítás azonnal (teljes, nem gyorsindítás).", "Shut down now (full, not fast startup).", ("A /s nem kapcsolja ki a gyorsindítást; a teljes leállításhoz: shutdown /s /full /t 0", "For a full shutdown bypassing fast startup: shutdown /s /full /t 0")),
("power", "both", "", r"shutdown /a", "Ütemezett leállítás megszakítása.", "Abort a scheduled shutdown."),

# ---------------------------------------------------------------- devices & drivers
("dev", "both", "", r"devmgmt.msc", "Eszközkezelő.", "Device Manager."),
("dev", "both", "w10", r"pnputil /enum-devices /problem", "Hibás eszközök listája.", "Devices with problems."),
("dev", "ps", "w8", r"Get-PnpDevice -PresentOnly | Where-Object Status -ne 'OK'", "Nem megfelelően működő eszközök.", "Devices not working properly."),
("dev", "both", "w10", r"pnputil /enum-drivers", "Telepített harmadik féltől származó illesztők.", "Installed third-party drivers."),
("dev", "both", "a w10", r'pnputil /add-driver "D:\drivers\*.inf" /subdirs /install', "Illesztők telepítése mappából (mentés visszatöltése).", "Install drivers from a folder (restore a backup)."),
("dev", "both", "a w8", r'dism /online /export-driver /destination:"D:\DriverBackup"', "Illesztők mentése újratelepítés előtt.", "Back up drivers before a reinstall."),
("dev", "cmd", "", r'driverquery /v /fo csv > "%USERPROFILE%\Desktop\drivers.csv"', "Illesztőlista Excelbe.", "Driver list for Excel."),
("dev", "both", "", r"mode", "COM portok és beállításaik.", "COM ports and their settings."),
("dev", "ps", "", r"Get-CimInstance Win32_PnPEntity | Where-Object Name -match 'COM\d' | Select-Object Name", "Soros portok chip névvel (CH340, CP210x, FTDI).", "Serial ports with chip names (CH340, CP210x, FTDI)."),
("dev", "ps", "", r"[System.IO.Ports.SerialPort]::GetPortNames()", "COM portok gyors listája.", "Quick list of COM ports."),

# ---------------------------------------------------------------- printing
("print", "cmd", "a d", r"net stop spooler && del /q /f /s %systemroot%\System32\spool\PRINTERS\* && net start spooler", "Elakadt nyomtatási sor ürítése.", "Clear a stuck print queue."),
("print", "both", "", r"control printers", "Eszközök és nyomtatók.", "Devices and Printers."),
("print", "both", "", r'rundll32 printui.dll,PrintUIEntry /k /n "{NAME}"', "Tesztoldal nyomtatása.", "Print a test page."),
("print", "both", "", r"printui /s", "Nyomtatókiszolgáló tulajdonságai (illesztők törlése).", "Print server properties (remove drivers)."),
("print", "ps", "w8", r"Get-Printer | Select-Object Name, DriverName, PortName, PrinterStatus", "Nyomtatók, portok, állapot.", "Printers, ports, status."),
("print", "ps", "a w8", r"Get-Printer | ForEach-Object { Get-PrintJob -PrinterName $_.Name } | Remove-PrintJob", "Minden nyomtatási feladat törlése.", "Delete all print jobs."),
("print", "ps", "a w8", r'Add-PrinterPort -Name "IP_{IP}" -PrinterHostAddress "{IP}"', "Hálózati nyomtató port létrehozása.", "Create a network printer port."),
("print", "ps", "w8", r'Add-Printer -ConnectionName "\\{HOST}\{NAME}"', "Megosztott nyomtató hozzáadása.", "Add a shared printer."),

# ---------------------------------------------------------------- security
("sec", "cmd", "a", DEF + r" -SignatureUpdate", "Defender adatbázis frissítése.", "Update Defender signatures."),
("sec", "cmd", "a", DEF + r" -Scan -ScanType 1", "Defender gyorsvizsgálat.", "Defender quick scan."),
("sec", "cmd", "a", DEF + r" -Scan -ScanType 2", "Defender teljes vizsgálat (órák).", "Defender full scan (hours)."),
("sec", "cmd", "", DEF + r' -Scan -ScanType 3 -File "{FILE}"', "Egy fájl vagy mappa vizsgálata.", "Scan one file or folder."),
("sec", "ps", "w8", r"Get-MpComputerStatus | Select-Object AMServiceEnabled, RealTimeProtectionEnabled, AntivirusSignatureLastUpdated", "Defender állapota.", "Defender status."),
("sec", "ps", "w8", r"Get-MpThreatDetection | Select-Object InitialDetectionTime, ThreatID, Resources", "Defender találatok előzménye.", "Defender detection history."),
("sec", "ps", "a d w10", r"Start-MpWDOScan", "Offline Defender vizsgálat: újraindul és Windows előtt vizsgál.", "Offline Defender scan: restarts and scans before Windows."),
("sec", "ps", "a d w8", r'Add-MpPreference -ExclusionPath "D:\ServiceKit"', "Kivétel a Defenderben (csak saját gépen, a kitre).", "Defender exclusion (own PC only, for the kit)."),
("sec", "both", "a", r"manage-bde -status", "BitLocker állapota.", "BitLocker status."),
("sec", "both", "a", r"manage-bde -protectors -get C:", "BitLocker helyreállítási kulcs (mentsd el javítás előtt!).", "BitLocker recovery key (save it before repairs!)."),
("sec", "cmd", "", r'gpresult /h "%USERPROFILE%\Desktop\gpresult.html"', "Érvényes házirendek jelentése.", "Applied policies report."),
("sec", "both", "", r"gpupdate /force", "Házirendek frissítése.", "Refresh policies."),
("sec", "both", "", r'reg query "HKLM\SOFTWARE\Policies\Google\Chrome"', "Kényszerített Chrome beállítások (eltérítés gyanú).", "Forced Chrome settings (hijack suspicion)."),
("sec", "both", "", r'reg query "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon" /v Shell', "Shell értéke: explorer.exe kell legyen.", "Shell value: should be explorer.exe."),
("sec", "cmd", "", r"type %windir%\System32\drivers\etc\hosts", "Hosts fájl tartalma.", "Hosts file contents."),
("sec", "both", "a", r"notepad %windir%\System32\drivers\etc\hosts", "Hosts fájl szerkesztése.", "Edit the hosts file.", None),
("sec", "ps", "", r'Get-AuthenticodeSignature "{FILE}"', "Digitális aláírás ellenőrzése.", "Check the digital signature."),
("sec", "ps", "", r'Unblock-File "{FILE}"', "Letöltött fájl feloldása (\"internetről származik\" jelzés).", "Unblock a downloaded file (\"came from the internet\" mark)."),
("sec", "both", "", r"wf.msc", "Tűzfal speciális beállítások.", "Firewall advanced settings."),
("sec", "both", "a d", r"cipher /w:C:", "Szabad hely biztonságos felülírása (törölt adatok nyoma). Lassú.", "Securely overwrite free space (traces of deleted data). Slow."),

# ---------------------------------------------------------------- licensing
("lic", "both", "", r"slmgr /xpr", "Aktiválva van-e a Windows.", "Is Windows activated."),
("lic", "both", "", r"slmgr /dli", "Licenc adatai röviden.", "License details, short."),
("lic", "both", "a", r"slmgr /ipk XXXXX-XXXXX-XXXXX-XXXXX-XXXXX", "Termékkulcs beírása.", "Enter a product key."),
("lic", "both", "a", r"slmgr /ato", "Aktiválás most.", "Activate now."),
("lic", "ps", "", r"(Get-CimInstance SoftwareLicensingService).OA3xOriginalProductKey", "BIOS-ba égetett gyári (OEM) kulcs.", "Factory (OEM) key stored in the BIOS."),
("lic", "both", "a w8", r"DISM /Online /Get-CurrentEdition", "Windows kiadás (Home, Pro…).", "Windows edition (Home, Pro…)."),
("lic", "cmd", "", r'cscript "%ProgramFiles%\Microsoft Office\Office16\OSPP.VBS" /dstatus', "Office licenc állapota.", "Office license status.", ("32 bites Office-nál: %ProgramFiles(x86)%", "For 32-bit Office: %ProgramFiles(x86)%")),

# ---------------------------------------------------------------- event logs
("event", "both", "", r"eventvwr.msc", "Eseménynapló.", "Event Viewer."),
("event", "ps", "", r"Get-WinEvent -FilterHashtable @{LogName='System'; Level=1,2; StartTime=(Get-Date).AddDays(-7)} | Select-Object -First 50 TimeCreated, Id, ProviderName, Message", "Rendszerhibák az elmúlt 7 napban.", "System errors in the last 7 days."),
("event", "ps", "", r"Get-WinEvent -FilterHashtable @{LogName='System'; Id=41} -MaxEvents 10", "Váratlan leállások (Kernel-Power 41).", "Unexpected shutdowns (Kernel-Power 41)."),
("event", "ps", "", r"Get-WinEvent -FilterHashtable @{LogName='System'; ProviderName='Microsoft-Windows-WER-SystemErrorReporting'} -MaxEvents 10", "Kék halálok (BugCheck).", "Blue screens (BugCheck)."),
("event", "ps", "", r"Get-WinEvent -FilterHashtable @{LogName='System'; Id=6005,6006,6008} -MaxEvents 20 | Select-Object TimeCreated, Id", "Indítások (6005), leállítások (6006), váratlan leállás (6008).", "Starts (6005), shutdowns (6006), unexpected (6008)."),
("event", "ps", "", r"Get-WinEvent -FilterHashtable @{LogName='Application'; Level=2} -MaxEvents 30 | Select-Object TimeCreated, ProviderName, Message", "Programhibák.", "Application errors."),
("event", "ps", "", r"Get-WinEvent -LogName 'Microsoft-Windows-Diagnostics-Performance/Operational' -FilterXPath '*[System[EventID=100]]' -MaxEvents 5 | Format-List TimeCreated, Message", "Rendszerindítás időtartama.", "Boot duration."),
("event", "ps", "a", r"Get-WinEvent -FilterHashtable @{LogName='Security'; Id=4625} -MaxEvents 20", "Sikertelen bejelentkezések.", "Failed sign-ins."),
("event", "cmd", "", r'wevtutil epl System "%USERPROFILE%\Desktop\System.evtx"', "Rendszernapló exportálása (elemzéshez).", "Export the System log (for analysis)."),

# ---------------------------------------------------------------- scheduled tasks
("task", "both", "", r"taskschd.msc", "Feladatütemező.", "Task Scheduler."),
("task", "ps", "w8", r"Get-ScheduledTask | Where-Object { $_.TaskPath -notlike '\Microsoft\*' } | Select-Object TaskName, TaskPath, State", "Nem Microsoft feladatok (kártevő-ellenőrzés).", "Non-Microsoft tasks (malware check)."),
("task", "both", "", r"schtasks /query /fo LIST /v", "Minden feladat részletesen.", "All tasks in detail."),
("task", "both", "a", r'schtasks /change /tn "{NAME}" /disable', "Feladat letiltása.", "Disable a task."),
("task", "both", "a d", r'schtasks /delete /tn "{NAME}" /f', "Feladat törlése.", "Delete a task."),
("task", "both", "a", r'schtasks /create /tn "Ujrainditas" /tr "shutdown /r /t 0" /sc once /st 03:00', "Egyszeri újraindítás hajnali 3-kor.", "One-off restart at 3 a.m."),

# ---------------------------------------------------------------- registry
("reg", "both", "", r"regedit", "Registry szerkesztő.", "Registry Editor."),
("reg", "both", "", r"reg query HKCU\Software\Microsoft\Windows\CurrentVersion\Run", "Felhasználói indítási elemek.", "User startup entries."),
("reg", "both", "", r"reg query HKLM\Software\Microsoft\Windows\CurrentVersion\Run", "Gépszintű indítási elemek.", "Machine-wide startup entries."),
("reg", "cmd", "", r'reg export "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" "%USERPROFILE%\Desktop\run.reg"', "Kulcs mentése módosítás előtt.", "Back up a key before changing it."),
("reg", "both", "w11", r'reg add "HKCU\Software\Classes\CLSID\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\InprocServer32" /f /ve', "Windows 11: régi (teljes) jobb klikk menü vissza. Utána indítsd újra az Intézőt.", "Windows 11: bring back the classic full context menu. Restart Explorer afterwards."),
("reg", "both", "w11", r'reg delete "HKCU\Software\Classes\CLSID\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}" /f', "Windows 11 új jobb klikk menü vissza.", "Windows 11: back to the new context menu."),
("reg", "both", "a w10", r'reg add "HKLM\SYSTEM\CurrentControlSet\Control\FileSystem" /v LongPathsEnabled /t REG_DWORD /d 1 /f', "260 karakternél hosszabb elérési utak engedélyezése.", "Allow paths longer than 260 characters."),
("reg", "both", "a", r'reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU" /v NoAutoRebootWithLoggedOnUsers /t REG_DWORD /d 1 /f', "Ne induljon újra magától frissítés után, ha valaki be van jelentkezve.", "No automatic restart after updates while someone is signed in."),

# ---------------------------------------------------------------- boot & recovery
("boot", "both", "w8", r"shutdown /r /o /t 0", "Újraindítás a speciális indítási menübe (csökkentett mód, helyreállítás).", "Restart into Advanced Startup (safe mode, recovery)."),
("boot", "both", "a w8", r"shutdown /r /fw /t 0", "Újraindítás egyenesen a BIOS/UEFI beállításokba.", "Restart straight into BIOS/UEFI setup."),
("boot", "both", "a", r"bcdedit /set {default} safeboot minimal", "Következő indítás csökkentett módban (vissza: deletevalue).", "Next boot in safe mode (undo: deletevalue)."),
("boot", "both", "a", r"bcdedit /deletevalue {default} safeboot", "Csökkentett mód kikapcsolása.", "Turn safe mode off again."),
("boot", "both", "a", r"bcdedit /set {current} bootmenupolicy legacy", "F8 indítómenü visszakapcsolása.", "Re-enable the F8 boot menu."),
("boot", "both", "a", r"bcdedit /enum", "Rendszerbetöltő bejegyzések.", "Boot loader entries."),
("boot", "both", "", r"msconfig", "Rendszerkonfiguráció (indítás, csökkentett mód).", "System Configuration (boot, safe mode)."),
("boot", "both", "re d", r"bcdboot C:\Windows", "Rendszerbetöltő újraépítése (helyreállításból; a betűjel eltérhet).", "Rebuild the boot loader (from recovery; letter may differ)."),
("boot", "both", "re d", r"bootrec /rebuildbcd", "BCD újraépítése régi (MBR) gépen.", "Rebuild BCD on an older (MBR) PC."),
("boot", "both", "re", r"notepad", "Helyreállításban: Fájl > Megnyitás ablakkal tallózhatsz és másolhatsz fájlokat.", "In recovery: File > Open lets you browse and copy files.", None),
("boot", "both", "a", r"reagentc /info", "Helyreállítási környezet (WinRE) állapota.", "Recovery environment (WinRE) status."),
("boot", "ps", "a w8", r"Confirm-SecureBootUEFI", "Secure Boot be van-e kapcsolva (Windows 11-hez).", "Is Secure Boot on (for Windows 11)."),
("boot", "ps", "a w8", r"Get-Tpm", "TPM állapota (Windows 11-hez).", "TPM status (for Windows 11)."),
("boot", "both", "a w10", r"mbr2gpt /validate /disk:0 /allowFullOS", "MBR-GPT átalakítás ellenőrzése (Windows 11 előtt).", "Check MBR-to-GPT conversion (before Windows 11)."),
("boot", "both", "a d w10", r"mbr2gpt /convert /disk:0 /allowFullOS", "Átalakítás GPT-re; utána a BIOS-ban UEFI módra kell váltani.", "Convert to GPT; then switch the BIOS to UEFI mode."),

# ---------------------------------------------------------------- remote
("remote", "both", "", r"mstsc /v:{HOST}", "Távoli asztal kapcsolat.", "Remote Desktop connection."),
("remote", "both", "a", r'reg add "HKLM\SYSTEM\CurrentControlSet\Control\Terminal Server" /v fDenyTSConnections /t REG_DWORD /d 0 /f', "Távoli asztal engedélyezése (Pro).", "Enable Remote Desktop (Pro)."),
("remote", "ps", "a w8", r"Enable-NetFirewallRule -Name RemoteDesktop-UserMode-In-TCP", "Távoli asztal tűzfalszabály (nyelvfüggetlen név).", "Remote Desktop firewall rule (language-independent name)."),
("remote", "both", "w10", r"quickassist", "Gyorssegéd: beépített távsegítség.", "Quick Assist: built-in remote help."),
("remote", "both", "", r"ssh {USER}@{IP}", "SSH kapcsolat (Raspberry Pi, router, NAS).", "SSH connection (Raspberry Pi, router, NAS)."),
("remote", "both", "", r'scp "{FILE}" {USER}@{IP}:/tmp/', "Fájl másolása SSH-n.", "Copy a file over SSH."),
("remote", "both", "", r"ssh-keygen -t ed25519", "SSH kulcspár készítése.", "Create an SSH key pair."),
("remote", "cmd", "", r'type %USERPROFILE%\.ssh\id_ed25519.pub | ssh {USER}@{IP} "cat >> ~/.ssh/authorized_keys"', "Nyilvános kulcs feltöltése (utána jelszó nélkül lép be).", "Upload your public key (passwordless login after)."),
("remote", "both", "a", r'shutdown /r /m \\{HOST} /t 60 /c "Szerviz"', "Távoli gép újraindítása 60 mp múlva.", "Restart a remote PC in 60 s."),
("remote", "both", "", r"net use \\{HOST}\C$ /user:{HOST}\{USER}", "Adminisztratív megosztás elérése.", "Open the admin share."),
("remote", "ps", "", r"Enter-PSSession -ComputerName {HOST}", "Távoli PowerShell (WinRM).", "Remote PowerShell (WinRM)."),
("remote", "both", "a", r"winrm quickconfig", "WinRM bekapcsolása a távoli PowerShellhez.", "Enable WinRM for remote PowerShell."),

# ---------------------------------------------------------------- quick open
("open", "both", "w10", r"start ms-settings:windowsupdate", "Windows Update beállítások.", "Windows Update settings."),
("open", "both", "w10", r"start ms-settings:appsfeatures", "Alkalmazások.", "Apps."),
("open", "both", "w10", r"start ms-settings:startupapps", "Indítási alkalmazások.", "Startup apps."),
("open", "both", "w10", r"start ms-settings:storagesense", "Tárterület.", "Storage."),
("open", "both", "w10", r"start ms-settings:network-status", "Hálózat állapota.", "Network status."),
("open", "both", "w10", r"start ms-settings:defaultapps", "Alapértelmezett alkalmazások.", "Default apps."),
("open", "both", "w10", r"start ms-settings:recovery", "Helyreállítás (alaphelyzet, speciális indítás).", "Recovery (reset, advanced startup)."),
("open", "both", "w10", r"start ms-settings:windowsdefender", "Windows Biztonság.", "Windows Security."),
("open", "both", "w10", r"start ms-settings:about", "Névjegy (gépnév, kiadás).", "About (PC name, edition)."),
("open", "both", "", r"explorer shell:startup", "Felhasználó Indítópult mappája.", "User Startup folder."),
("open", "both", "", r'explorer "shell:common startup"', "Közös Indítópult mappa.", "Common Startup folder."),
("open", "both", "", r"explorer shell:sendto", "Küldés menü mappája.", "Send To folder."),
("open", "cmd", "", r"explorer %temp%", "Ideiglenes fájlok mappája.", "Temp folder."),
("open", "cmd", "", r"explorer %appdata%", "AppData\\Roaming.", "AppData\\Roaming."),
("open", "cmd", "", r"explorer %localappdata%", "AppData\\Local.", "AppData\\Local."),
("open", "both", "", r"control", "Vezérlőpult.", "Control Panel."),
("open", "both", "", r"sysdm.cpl", "Rendszer tulajdonságai (gépnév, tartomány).", "System Properties (PC name, domain)."),
("open", "both", "", r"SystemPropertiesAdvanced", "Speciális rendszerbeállítások (környezeti változók).", "Advanced system settings (environment variables)."),
("open", "both", "", r"SystemPropertiesPerformance", "Vizuális effektusok (lassú gépen kikapcsolni).", "Visual effects (turn off on slow PCs)."),
("open", "both", "", r"inetcpl.cpl", "Internetbeállítások (proxy, tanúsítványok).", "Internet Options (proxy, certificates)."),
("open", "both", "", r"firewall.cpl", "Windows tűzfal.", "Windows Firewall."),
("open", "both", "", r"mmsys.cpl", "Hangeszközök.", "Sound devices."),
("open", "both", "", r"main.cpl", "Egér beállítások.", "Mouse settings."),
("open", "both", "", r"powercfg.cpl", "Energiagazdálkodás.", "Power Options."),
("open", "both", "", r"timedate.cpl", "Dátum és idő.", "Date and time."),
("open", "both", "", r"compmgmt.msc", "Számítógép-kezelés (lemezek, szolgáltatások, felhasználók).", "Computer Management."),
("open", "both", "", r"services.msc", "Szolgáltatások.", "Services."),
("open", "both", "", r"gpedit.msc", "Csoportházirend (Home-ban nincs).", "Group Policy (not in Home)."),
("open", "both", "", r"certmgr.msc", "Tanúsítványok.", "Certificates."),
("open", "both", "", r"control /name Microsoft.CredentialManager", "Hitelesítőadat-kezelő.", "Credential Manager."),
("open", "both", "", r"psr", "Lépésrögzítő: az ügyfél rögzítheti, mit csinál a hiba előtt.", "Steps Recorder: the client can record what they do before the fault.", ("Windows 11 újabb kiadásaiból eltávolítva.", "Removed from newer Windows 11 releases.")),
("open", "both", "", r"osk", "Képernyő-billentyűzet.", "On-screen keyboard."),
("open", "both", "", r"dfrgui", "Meghajtók optimalizálása.", "Optimize Drives."),

# ---------------------------------------------------------------- smart home
("smart", "both", "", r"esptool --port COM3 chip-id", "ESP chip azonosítása (működik-e a kapcsolat).", "Identify the ESP chip (is the link working).", ("esptool 4.x-ben aláhúzás: chip_id, read_flash, write_flash.", "esptool 4.x uses underscores: chip_id, read_flash, write_flash.")),
("smart", "both", "", r"esptool --port COM3 read-flash 0 ALL backup.bin", "Gyári firmware mentése flashelés előtt.", "Back up the stock firmware before flashing."),
("smart", "both", "d", r"esptool --port COM3 erase-flash", "Flash törlése.", "Erase the flash."),
("smart", "both", "d", r"esptool --port COM3 write-flash 0x0 firmware.bin", "Firmware írása.", "Write firmware."),
("smart", "both", "w10", r'curl "http://{IP}/cm?cmnd=Status%200"', "Tasmota eszköz teljes állapota.", "Full status of a Tasmota device."),
("smart", "both", "w10", r'curl "http://{IP}/cm?cmnd=Power%20TOGGLE"', "Tasmota relé kapcsolása.", "Toggle a Tasmota relay."),
("smart", "both", "w10", r"curl http://{IP}/rpc/Shelly.GetStatus", "Shelly Gen2/Gen3 állapot.", "Shelly Gen2/Gen3 status."),
("smart", "both", "w10", r"curl http://{IP}/status", "Shelly Gen1 állapot.", "Shelly Gen1 status."),
("smart", "ps", "", r'Invoke-RestMethod -Uri "http://{IP}:8123/api/states" -Headers @{ Authorization = "Bearer TOKEN" }', "Home Assistant entitások állapota REST API-n (TOKEN = hosszú élettartamú token).", "Home Assistant entity states via REST (TOKEN = long-lived token)."),
("smart", "both", "", r"ping homeassistant.local", "Home Assistant elérhető-e mDNS néven.", "Is Home Assistant reachable by its mDNS name."),
("smart", "ps", "w8", r"Test-NetConnection {IP} -Port 1883", "MQTT bróker elérhető-e.", "Is the MQTT broker reachable."),
("smart", "both", "", r'mosquitto_sub -h {IP} -t "#" -v -u user -P jelszo', "Minden MQTT üzenet figyelése (mosquitto kliens kell).", "Watch all MQTT messages (needs the mosquitto client)."),
("smart", "both", "", r'mosquitto_pub -h {IP} -t "cmnd/eszkoz/POWER" -m "TOGGLE" -u user -P jelszo', "MQTT parancs küldése (pl. Tasmota).", "Publish an MQTT command (e.g. Tasmota)."),

# ---------------------------------------------------------------- development
("devtools", "both", "", r"python -m http.server 8000", "Gyors fájlmegosztás a mappából a helyi hálózaton (http://IP:8000).", "Quick file share from the folder on the LAN (http://IP:8000)."),
("devtools", "both", "", r"python -m venv .venv", "Python virtuális környezet.", "Python virtual environment."),
("devtools", "cmd", "", r".venv\Scripts\activate", "Virtuális környezet bekapcsolása (cmd).", "Activate the virtual environment (cmd)."),
("devtools", "ps", "", r".venv\Scripts\Activate.ps1", "Virtuális környezet bekapcsolása (PowerShell).", "Activate the virtual environment (PowerShell)."),
("devtools", "both", "", r"pip install -r requirements.txt", "Függőségek telepítése.", "Install dependencies."),
("devtools", "ps", "", r"Set-ExecutionPolicy -Scope CurrentUser RemoteSigned", "Saját PowerShell szkriptek futtatásának engedélyezése.", "Allow running your own PowerShell scripts."),
("devtools", "ps", "", r'Get-Content "{FILE}" -Wait -Tail 50', "Naplófájl élő követése (mint tail -f).", "Follow a log file live (like tail -f)."),
("devtools", "both", "", r"where {FILE}", "Honnan fut egy parancs (PATH).", "Where a command runs from (PATH)."),
("devtools", "both", "", r"git status", "Git munkamappa állapota.", "Git working tree status."),
("devtools", "both", "", r"git log --oneline -15", "Utolsó 15 commit.", "Last 15 commits."),
("devtools", "cmd", "", r'git config --global user.name "Név" && git config --global user.email "email@example.com"', "Git név és e-mail beállítása.", "Set git name and email."),
("devtools", "cmd", "", r"node -v && npm -v", "Node és npm verzió.", "Node and npm versions."),
("devtools", "both", "", r"code .", "Mappa megnyitása VS Code-ban.", "Open the folder in VS Code."),
("devtools", "both", "w10", r"wsl -l -v", "WSL disztribúciók.", "WSL distributions."),
("devtools", "both", "w10", r"curl -L -o file.zip https://example.com/file.zip", "Fájl letöltése parancssorból.", "Download a file from the command line."),
]

rows = []
cats = {c[0] for c in CATS}
seen = set()
for r in C:
    cat, shell, flags, cmd, hu, en = r[:6]
    note = r[6] if len(r) > 6 else None
    assert cat in cats, cat
    assert shell in ("cmd", "ps", "both"), shell
    key = (cat, cmd)
    assert key not in seen, cmd
    seen.add(key)
    fl = flags.split()
    for f in fl: assert f in ("a", "d", "w8", "w10", "w11", "old", "re"), f
    o = {"c": cat, "s": shell, "x": cmd, "hu": hu, "en": en}
    if fl: o["f"] = fl
    if note: o["n"] = {"hu": note[0], "en": note[1]}
    rows.append(o)

data = {"categories": [{"id": c[0], "hu": c[1], "en": c[2]} for c in CATS],
        "vars": [{"k": v[0], "d": v[1], "hu": v[2], "en": v[3]} for v in VARS],
        "commands": rows}
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
js = "window.KIT_COMMANDS = " + json.dumps(data, ensure_ascii=False) + ";\n"
with open(os.path.join(root, "launcher", "data", "commands.js"), "w", encoding="utf-8") as f:
    f.write("/* Generated by core/build_commands.py */\n" + js)

# Standalone offline page
css = open(os.path.join(root, "launcher", "style.css"), encoding="utf-8").read()
view = open(os.path.join(root, "launcher", "cmdview.js"), encoding="utf-8").read()
tpl = open(os.path.join(root, "core", "cmd_standalone.html"), encoding="utf-8").read()
import re
def safe_script(t): return re.sub(r"</(script)", lambda m: "<\\/" + m.group(1), t, flags=re.I)
page = tpl.replace("/*__CSS__*/", css).replace("/*__DATA__*/", safe_script(js)).replace("/*__VIEW__*/", safe_script(view))
with open(os.path.join(root, "PARANCSOK.html"), "w", encoding="utf-8") as f:
    f.write(page)
print(len(rows), "commands in", len(CATS), "categories")
