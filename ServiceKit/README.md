# ServiceKit

Hordozható szervizkészlet Windowshoz. A programokat a hivatalos forrásukból tölti le egy mappába, és egy
Irányítópultot ad hozzájuk: élő állapot, offline Súgó, biztonságos futtatás.

*Portable Windows service toolkit. It downloads the tools from their official sources into one folder and gives
them a Dashboard with live status, an offline troubleshooting guide (Súgó) and safe ways to run things.
English section below.*

## Gyors indulás

1. Csomagold ki a pendrive-ra (pl. `E:\ServiceKit`). Kicsomagolás előtt a zip-en: jobb klikk > Tulajdonságok > **Feloldás**.
2. Futtasd a **SETUP.cmd**-t. Az **Alap** gomb az ajánlott készletet jelöli ki, a **Mind** mindent.
   Régi gépekhez a *Cél Windows* mezőben válaszd a Windows 7 / 8.1-et.
3. Futtasd a **START.cmd**-t: megnyílik az Irányítópult. A mellette induló kis PowerShell ablakot hagyd nyitva.

| Fájl | Mire való |
|---|---|
| `START.cmd` | Irányítópult élő állapottal: futó programok CPU/RAM, telepítési folyamat, indítás |
| `SETUP.cmd` | Telepítő: kiválasztás, letöltés, frissítés. Bármikor újrafuttatható. |
| `KITSHELL.cmd` | Hordozható parancssor (Git, Node, Python, PowerShell 7, Sysinternals a PATH-on) |
| `PARANCSOK.html` | Offline parancsgyűjtemény, kattintásra másolás (telefonra is másolható) |
| `OFFLINE-SUGO.cmd` | Az útmutató és a Súgó szerver nélkül, ha a PowerShell tiltva van |

## Mappák

- `tools\` – a programok, csomagonként egy mappa
- `tools\_inbox\` – ide tedd a kézzel letöltött fájlokat; a Telepítő felismeri és a helyére teszi
- `data\` – a Kit Shell beállításai (git, npm, pip, Claude Code), ügyfelek, munkák, jelentések
- `docs\` – saját dokumentumok (adatlapok, bekötési rajzok, kézikönyvek)
- `envs\` – Python virtuális környezetek
- `exchange\` – írható csatorna a Windows Sandbox felé
- `logs\`, `state\` – naplók és a kit állapota
- `core\` – a kit szkriptjei és a programkatalógus (`catalog.json`)

## Biztonságos tér

1. **Kit Shell** – tiszta, hordozható munkakörnyezet. Nem biztonsági határ.
2. **Sandboxie-Plus** – programok dobozban; a változásaik egy kattintással törölhetők (Win7–11, egyszeri telepítés).
3. **Windows Sandbox** – eldobható teljes Windows (Win10/11 Pro, Enterprise, Education). A `tools` mappa csak olvasható benne.

## Munkák és ügyfél jelentés

Az Irányítópult **Munkák** oldalán:

1. **Új munka**: ügyfél (meglévő vagy új), számítógép, feladat. Indításkor a kit *előtte*-pillanatképet készít
   (indítási elemek, telepített programok, szabad hely, ideiglenes fájlok, memória, rendszerindítási idő).
2. Munka közben jegyzetelj; a kitből indított programok maguktól bekerülnek a naplóba.
3. **Lezárás és jelentés**: *utána*-pillanatkép, gépleltár (gyártó, sorozatszám, CPU, RAM foglalatok, lemezek és SMART,
   vírusvédelem, frissítések, akkumulátor kopás, összeomlások), automatikus javaslatok és előtte/utána összevetés.
   A jelentés HTML-ben és PDF-ben készül (a PDF-hez Edge vagy Chrome kell a gépen).

A jelentések a `data\reports`, a lezárt munkák listája a `data\jobs.csv` fájlban van (Excelben megnyitható, számlázáshoz).
A jelentés fejlécére kerülő adataidat a *Szerviz adatai* panelen adhatod meg.
**A pendrive így ügyféladatokat tárol: titkosítsd BitLocker To Go-val.**

## Saját dokumentumok és integritás

- `docs\` – adatlapok, bekötési rajzok, Modbus regisztertáblák. Az Eszközök oldal tetején jelennek meg.
- A Telepítő minden program SHA256 ujjlenyomatát és aláírását elmenti. *Telepítő > Integritás-ellenőrzés*
  jelzi, ha egy fájl megváltozott vagy eltűnt (pl. idegen gépen való használat után).

## Forgatókönyvek

Lépésenkénti rutinok, amelyek el is végzik a munkát (Irányítópult > **Forgatókönyvek**). Az ellenőrzések maguktól futnak,
a módosító lépések előtt rákérdeznek, a kézi lépéseknél megnyitják a programot és megvárják, hogy jelezd: kész.
Minden eredmény bekerül az aktív munka naplójába és az ügyfél jelentésbe.

| Forgatókönyv | Mire |
|---|---|
| Gyors állapotfelmérés | Csak olvas: lemez, vírusvédelem, frissítés, összeomlások, terhelés, akku, aktiválás |
| Karbantartás és gyorsítás | Visszaállítási pont, takarítás, indítási elemek, programok, frissítések |
| Rendszerjavítás | DISM, SFC, chkdsk |
| Kártevő-irtás | Gyanús indítási elemek és feladatok, böngésző-eltérítés, proxy, hosts, Defender, KVRT |
| Hálózati hibaelhárítás | Megmondja, hol akad el (router, internet, DNS, proxy), majd javít |
| Windows Update javítás | Összetevők alaphelyzetbe, rendszerkép-javítás |
| Újratelepítés előtti mentés | Kulcsok, Wi-Fi jelszavak, illesztők, programlista, könyvjelzők |
| Lassú gép diagnózis | Terhelés, memória, lemez, hő, indítási elemek |
| Nyomtató javítás | Nyomtatási sor, nyomtatásvezérlő |
| Új gép beüzemelése | Aktiválás, védelem, visszaállítás, kéretlen programok, alapprogramok |
| Havi ellenőrzés | Rendszeres karbantartás (rokon, visszatérő ügyfél) |
| Okosotthon helyszíni felmérés | Eszközök gyártótippel, Wi-Fi csatornák, nyitott portok, CSV-be |

A rendszergazdai lépések UAC jóváhagyást kérnek; a **Rendszergazdai mód** gombbal az Irányítópult egyszer újraindul
rendszergazdaként. A mentések a `data\backups` mappába kerülnek (bizalmas adat!). Saját forgatókönyv: `core\build_playbooks.py`.

## Parancsok

Kb. 330 CMD és PowerShell parancs 21 kategóriában (Irányítópult > **Parancsok**, vagy önállóan a **PARANCSOK.html**,
ami szerver nélkül, telefonon is működik). Kereső, kategória- és shell-szűrő, kedvencek, kattintásra másolás,
és változók ({IP}, {HOST}, {PORT}, {USER}, {DRIVE}, {NAME}, {FILE}), amelyek a parancsokba kerülnek.
Bővítés: `core\build_commands.py`, majd `python core\build_commands.py`.

## Kézi letöltések

Néhány gyártó nem enged közvetlen letöltést (tükörválasztó oldal, kattintás). Ezeket a Telepítő megjelöli:
töltsd le a **Hivatalos oldal** gombbal, tedd a fájlt a `tools\_inbox` mappába, és futtasd újra a Telepítőt.
Ugyanez a megoldás, ha egy gyártó megváltoztatja a letöltőoldalát, és az automatikus letöltés hibát ad.

## Windows 7 / 8.1

Az Irányítópult és a Telepítő PowerShell 2.0-val is fut. Windows 7-en a modern HTTPS-hez .NET 4.8 kell,
ezért egyszerűbb a kitet egy újabb gépen feltölteni *Cél: Windows 7 / 8.1* beállítással, és átvinni a pendrive-ot.

## Fontos

- Minden program a saját licence alatt, a hivatalos forrásból töltődik le; a kit nem terjeszti őket.
- Néhány vírusirtó tévesen jelzi a NirSoft eszközöket (jelszó- és kulcskiolvasók). Ez ismert hamis riasztás.
- Az emulátorokhoz a kit nem tölt le BIOS-t, ROM-ot vagy régi Windows telepítőt: ezek saját, jogtiszta példányok kell legyenek.
- A Súgó szövegét a `core\build_sugo.py` fájlban szerkesztheted; `python core\build_sugo.py` újragenerálja.
- A programlistát a `core\catalog.json` írja le: új program hozzáadásához elég egy új bejegyzés.

---

## English

1. Extract to a USB stick (unblock the zip first: right-click > Properties > **Unblock**).
2. Run **SETUP.cmd** and pick a set (**Core** or **All**); choose *Target Windows: 7 / 8.1* for old machines.
3. Run **START.cmd** to open the Dashboard and keep the small PowerShell window open.

The Dashboard shows which kit programs are running with live CPU and memory, install progress, a searchable tool list
with launch buttons (normal, admin, in a Sandboxie box, in Windows Sandbox), the Safe space panel (Kit Shell, Python venvs,
Sandboxie, Windows Sandbox) and the offline Súgó troubleshooting database in Hungarian and English.

For programs that need a manual download, use **Official page**, drop the file into `tools\_inbox`, and run Setup again.
**Jobs and client reports.** On the Dashboard *Jobs* page, start a job (client, computer, task): the kit takes a *before* snapshot.
Notes and launched tools are logged. *Close and report* takes an *after* snapshot plus a hardware inventory, builds recommendations
and a before/after comparison, and saves the report as HTML and PDF in `data\reports`; `data\jobs.csv` lists closed jobs for invoicing.
Put datasheets and wiring diagrams in `docs\`. *Setup > Integrity check* compares every program against its stored SHA256 fingerprint.

**Playbooks.** Twelve step-by-step routines (health check, tune-up, system repair, malware sweep, network fix, Windows Update fix,
pre-reinstall backup, slow-PC diagnosis, printer fix, new PC setup, monthly check-up, smart-home site survey). Checks run on their own,
changes ask first, manual steps open the tool and wait for Done. Results go into the job log and the client report.

**Commands.** About 330 CMD and PowerShell commands with search, filters, favourites, click-to-copy and fill-in variables,
in the Dashboard and as the standalone `PARANCSOK.html`.

The local Dashboard server listens on 127.0.0.1 only, needs no admin rights, and requires a per-session token for actions.

## Programlista / Tool list

| Kategória | Program | Készlet | Letöltés | Win7 | Leírás |
|---|---|---|---|---|---|
| Diagnosztika | Sysinternals Suite | alap | auto | részben | A Microsoft hivatalos diagnosztikai csomagja. |
| Diagnosztika | HWiNFO64 | alap | auto | ✓ | Hőmérsékletek, feszültségek, ventilátorok és teljes hardverleltár. |
| Diagnosztika | CrystalDiskInfo | alap | auto | ✓ | Meghajtó-egészség (SMART). Régi gépen ezzel kezdj. |
| Diagnosztika | CrystalDiskMark | kiegészítő | auto | ✓ | Lemezsebesség mérése: HDD, SSD, pendrive. SSD-csere előtt és után. |
| Diagnosztika | BatteryInfoView (NirSoft) | kiegészítő | auto | ✓ | Laptop akkumulátor kopása: tervezett és valós kapacitás, töltési ciklusok. |
| Diagnosztika | LibreHardwareMonitor | kiegészítő | auto | részben | Nyílt forrású hőmérséklet- és terhelésfigyelő, HWiNFO helyett vagy mellett. |
| Diagnosztika | CPU-Z | kiegészítő | auto | ✓ | Processzor, alaplap, memória pontos típusa. |
| Diagnosztika | GPU-Z | kiegészítő | kézi | ✓ | Videokártya adatai és szenzorai. Kézi letöltés (tükörválasztó oldal). |
| Diagnosztika | BlueScreenView (NirSoft) | alap | auto | ✓ | Kék halál memóriaképek elemzése: melyik illesztőprogram okozta. |
| Diagnosztika | WhoCrashed | kiegészítő | kézi | ✓ | Kék halál magyarázata közérthetően. Telepítőt igényel. |
| Diagnosztika | LatencyMon | kiegészítő | kézi | ✓ | Recsegő hang, akadozás: megtalálja a késleltető illesztőprogramot. |
| Diagnosztika | OCCT | kiegészítő | kézi | ✗ | Terheléses teszt CPU-ra, RAM-ra, tápra. Instabil, melegedő géphez. |
| Diagnosztika | FurMark | kiegészítő | kézi | részben | Videokártya terheléses teszt. Kézi letöltés. |
| Tisztítás és lemez | WizTree | alap | auto | ✓ | Másodpercek alatt megmutatja, mi tölti meg a lemezt. |
| Tisztítás és lemez | Bulk Crap Uninstaller | alap | auto | részben | Kéretlen programok tömeges eltávolítása, maradékokkal együtt. |
| Tisztítás és lemez | BleachBit | alap | auto | részben | Ideiglenes fájlok és gyorsítótárak törlése. |
| Tisztítás és lemez | Everything | alap | auto | ✓ | Azonnali fájlkeresés az egész gépen. |
| Vírusirtás | Emsisoft Emergency Kit | alap | auto | részben | Második véleményes vírusirtó, telepítés nélkül. |
| Vírusirtás | Kaspersky Virus Removal Tool | alap | auto | ✓ | Ingyenes egyszeri vírusellenőrzés. Friss adatbázis kell, ezért minden telepítéskor újratöltődik. |
| Vírusirtás | Microsoft Safety Scanner | alap | auto | ✓ | A Microsoft hivatalos egyszeri vírusellenőrzője. |
| Frissítés és illesztőprogram | Patch My PC Home Updater | alap | auto | részben | Gyakori programok tömeges frissítése egy kattintással. |
| Frissítés és illesztőprogram | Snappy Driver Installer Origin | alap | auto | ✓ | Illesztőprogramok offline is. A meghajtócsomagokat külön tölti le. |
| Windows javítás | ShellExView + ShellMenuView | kiegészítő | auto | ✓ | Lassú jobb klikk, hibás helyi menü javítása. |
| Windows javítás | ProduKey (NirSoft) | alap | auto | ✓ | Windows és Office termékkulcsok kiolvasása újratelepítés előtt. |
| Windows javítás | ShowKeyPlus | kiegészítő | auto | ✓ | Windows kiadás és BIOS-ba égetett (OEM) kulcs. |
| Windows javítás | O&O ShutUp10++ | kiegészítő | auto | ✗ | Adatvédelmi és telemetria-beállítások Windows 10/11-en. |
| Adatmentés | TestDisk & PhotoRec | kiegészítő | auto | ✓ | Elveszett partíciók és törölt fájlok visszaállítása. |
| Adatmentés | DiskGenius | kiegészítő | kézi | ✓ | Partíciókezelés és adatmentés grafikus felülettel. Kézi letöltés (hordozható zip). |
| Hálózat és távsegítség | RustDesk | alap | auto | régebbi verzió | Nyílt forrású távsegítség; telepítés nélkül is fut. |
| Hálózat és távsegítség | WinSCP | alap | auto | ✓ | Fájlátvitel SFTP/FTP/SCP-n: NAS, szerver, Raspberry Pi. |
| Hálózat és távsegítség | PuTTY | alap | auto | ✓ | SSH és soros konzol (pl. routerek, ESP-k, Raspberry Pi). |
| Hálózat és távsegítség | WinMTR (Redux) | alap | auto | ✓ | Ping + traceroute egyben: hol vész el a csomag. |
| Hálózat és távsegítség | WifiInfoView (NirSoft) | kiegészítő | auto | ✓ | Környező Wi-Fi hálózatok, csatornák és jelerősség. Okosotthon telepítés előtti felméréshez. |
| Hálózat és távsegítség | Nmap + Zenmap | kiegészítő | auto | részben | Hálózati eszközök és nyitott portok felderítése (kamerák, NVR-ek, okos eszközök). |
| Hálózat és távsegítség | iperf3 | kiegészítő | auto | régebbi verzió | Valós hálózati sebesség két gép között (Wi-Fi, kábel, PoE-ellenőrzés). |
| Hálózat és távsegítség | Advanced IP Scanner | kiegészítő | kézi | ✓ | Eszközök keresése a helyi hálózaton. A telepítőben választható a "Futtatás" (hordozható). |
| Hálózat és távsegítség | Wireshark Portable | kiegészítő | kézi | részben | Csomagelemzés, ha valami tényleg furcsa. Kézi letöltés (PortableApps változat). |
| Fejlesztés | Git (PortableGit) | alap | auto | régebbi verzió | Git és Git Bash. A Claude Code-nak is kell. |
| Fejlesztés | Node.js (LTS, zip) | alap | auto | régebbi verzió | JavaScript futtatókörnyezet és npm, a Kit Shellből elérhető. |
| Fejlesztés | Python 3.12 (teljes, hordozható) | alap | auto | régebbi verzió | Python, pip, venv. Virtuális környezetek a Biztonságos tér panelen. |
| Fejlesztés | VS Code (portable) | alap | auto | régebbi verzió | Kódszerkesztő, beállítások és bővítmények a kiten belül (data mappa). |
| Fejlesztés | Notepad++ | alap | auto | részben | Gyors szövegszerkesztő naplókhoz, konfigokhoz. |
| Fejlesztés | PowerShell 7 | alap | auto | ✗ | Modern PowerShell, a Kit Shellből elérhető. |
| Segédeszközök | 7-Zip | alap | auto | ✓ | Tömörítés és kicsomagolás, telepítés nélkül. |
| Segédeszközök | ShareX | kiegészítő | auto | ✗ | Képernyőkép és felvétel a javítás dokumentálásához. |
| Segédeszközök | SumatraPDF | kiegészítő | auto | ✓ | Könnyű PDF-olvasó (kapcsolási rajzok, kézikönyvek). |
| Segédeszközök | KeePassXC | kiegészítő | auto | ✗ | Ügyféljelszavak titkosítva a kiten. Erős mesterjelszót használj! |
| Okosotthon | MQTT Explorer | kiegészítő | auto | részben | MQTT forgalom: Home Assistant, Zigbee2MQTT, Tasmota. |
| Okosotthon | esptool | kiegészítő | auto | részben | ESP32/ESP8266 flashelés a helyszínen (Tasmota, ESPHome bin). |
| Okosotthon | Zadig | kiegészítő | auto | ✓ | USB illesztőprogram csere (WinUSB): Zigbee stickek, SDR-ek, firmware-író eszközök. |
| Okosotthon | QModMaster (Modbus) | kiegészítő | auto | ✓ | Modbus RTU/TCP mester: fogyasztásmérők, inverterek, hőszivattyúk regisztereinek olvasása. |
| Indítólemez | Rufus | alap | auto | régebbi verzió | Rendszerindító USB készítése ISO-ból, a helyszínen. |
| Indítólemez | Ventoy | alap | auto | ✓ | Több ISO egy pendrive-on: csak rá kell másolni őket. |
| Indítólemez | Hiren's BootCD PE (ISO) | kiegészítő | auto | ✓ | Mentő Windows PE pendrive-ra (Ventoyjal). Nagy: kb. 3 GB. |
| Indítólemez | MemTest86 (USB image) | kiegészítő | auto | ✓ | Memóriateszt rendszerindításkor. Kék halál és véletlen fagyás esetén. |
| Indítólemez | Clonezilla Live (ISO) | kiegészítő | auto | ✓ | Lemez klónozása és lemezkép mentése rendszerindításkor (HDD → SSD csere). Ventoyra másold. |
| Indítólemez | GParted Live (ISO) | kiegészítő | auto | ✓ | Partíciók átméretezése, mozgatása rendszerindításkor. Ventoyra másold. |
| Emulátorok és retró | RetroArch | kiegészítő | auto | ✓ | Sok rendszer egy felületen (NES, SNES, Mega Drive, Game Boy, PS1 és még sok más). |
| Emulátorok és retró | DuckStation (PS1) | kiegészítő | auto | ✗ | PlayStation 1 emulátor. Saját BIOS kell (a konzolodból mentve). |
| Emulátorok és retró | PCSX2 (PS2) | kiegészítő | auto | ✗ | PlayStation 2 emulátor. Saját BIOS kell. |
| Emulátorok és retró | PPSSPP (PSP) | kiegészítő | auto | részben | PSP emulátor, BIOS nem kell. |
| Emulátorok és retró | Dolphin (GameCube/Wii) | kiegészítő | kézi | ✗ | GameCube és Wii emulátor. Kézi letöltés (7z). |
| Emulátorok és retró | MAME (arcade) | kiegészítő | auto | részben | Játékterem-gépek és régi számítógépek emulátora. |
| Emulátorok és retró | 86Box (régi PC-k és Windowsok) | kiegészítő | auto | részben | Korhű PC-hardver: 486, Pentium, régi videokártyák. Windows 3.1, 95, 98, XP saját telepítőlemezzel. |
| Emulátorok és retró | DOSBox-X | kiegészítő | auto | régebbi verzió | DOS és Windows 3.x/9x futtatása; régi üzleti és ipari programokhoz is. |
| Emulátorok és retró | DOSBox Staging | kiegészítő | auto | ✗ | Modern DOSBox régi DOS-os játékokhoz. |
| Emulátorok és retró | ScummVM | kiegészítő | kézi | ✓ | Klasszikus kalandjátékok (LucasArts, Sierra). Kézi letöltés (zip). |
| Emulátorok és retró | VirtualBox | kiegészítő | kézi | részben | Teljes virtuális gépek: régi Windows, Linux, tesztkörnyezet. |
| Emulátorok és retró | QEMU | kiegészítő | auto | ✗ | Sokplatformos gépemulátor (x86, ARM, MIPS). Haladó, parancssoros. |
| Biztonságos tér | Sandboxie-Plus | kiegészítő | auto | részben | Bármely programot dobozban futtat: a változtatásai törölhetők. |
