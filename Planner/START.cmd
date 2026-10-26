@echo off
setlocal EnableDelayedExpansion

:: ==========================================================================
::  START.cmd - VARLER master launcher
::  Single entry point for every VRG tool: the Planner, the calculators,
::  MindMap, and anything else that has grown into its own file.
::
::  Drive-letter independent: everything is derived from this file's own
::  location, so it works the same from C:\VARLER or a USB stick.
::
::  TO ADD A TOOL: copy a block in the TOOL REGISTRY section below, bump
::  the number, and increase TOOLCOUNT. Nothing else needs to change - up
::  to ten tools. The menu reads ONE keypress, so each tool holds one key:
::  1-9, and the tenth is 0. An eleventh tool needs a letter of its own in
::  the BILLENTYUK section and a line in the dispatch; the launcher says so
::  on startup rather than quietly hiding it.
::
::  TO FIX A BROWSER PATH: edit the BROWSER PATHS section below.
::
::  NOTE: the Planner actions below (build/test/gyro/VS Code/manifest) were
::  rebuilt from project notes, not copied from the original varler.cmd.
::
::  2026-09-21 - brought up to date with the current toolset: the Inventory
::  item database (tool 6, with its own build/test/serve/price-check
::  actions), the BuildTree modder (9) and the VRG Vendor component page
::  (10, with the fetch-vendor tool behind L and D). Slot 6 previously held
::  a "wire ID tool" whose path was only ever a placeholder - no such file
::  has ever existed on disk - so Inventory took that slot. Tools 1-5, 7
::  and 8 are unchanged, so the numbers you already know still work.
::
::  2026-09-21 - registry reconciled with tools\check-start.js: all 10 entries
::  resolve. Run that script whenever a tool is added, renamed or moved -
::  it also lists pages in the repo that are missing from this registry.
::
::  2026-09-22 - both menus moved from set /p to choice, because the prompt
::  kept snapping back to the previous entry. Two separate causes: set /p
::  does not blank its variable on an empty Enter (so a keystroke that did
::  not land re-ran the last pick), and the console line editor keeps the
::  previous line in a template buffer that reappears at the first
::  character. choice reads one keypress and has neither problem. QuickEdit
::  was investigated and ruled out - it is already off, and Start.lnk
::  carries no console properties that would override that.
::
::  2026-10-09 - W) added: build and open the Planner from the planner-stack
::  git worktree, which sits NEXT TO the repo (<Dev-VRG\VRG-DE>\wt-planner-stack)
::  and is where the BRIDGE Stack and the current visual work live. It is not
::  a tool entry - the numbered slots are full at ten - so it sits with the
::  Planner actions and reuses the same browser chooser. That folder is
::  outside the repo and disappears once the branch is merged, so the action
::  checks for it and explains itself instead of failing.
::
::  2026-10-10 - E) added: the same worktree build, then tools\make-preload.js
::  bakes CLA teszt v1 + v2 into dist\varler_planner_CLA.html (blueprint,
::  marks and endpoints; of the hardware only the Eloszto) and opens that.
::  A letter again, for the same reason as W). check-start.js now counts a
::  page an action opens (set "TFULL=%WT_DIR%\...") as registered.
::
::  2026-10-16 - planner-stack merged into main (e37f856): tool 1 now opens the
::  full working version - the workflow phases, the UI tidy (T1-T8), the marker
::  pen, circuit suggestions, the Erosaram engine (Palyak / Vezetekek buttons)
::  and the Aloszto per level. Same file, same key 1 (projects\varler-planner\dist).
::  W) and E) still work while the worktree exists.
::
::  2026-10-17 - Y) added (was K until 2026-10-22, see below): the Planner CYD desk dashboard (Firmware\planner-cyd).
::  Not a tool page but three launchers - the bridge with the Planner, the
::  demo, and flashing the CYD - so it is a letter with a small submenu.
::  Later the same day: 4) the macropad (also picks up the Planner), 5) its settings page
::  (http://localhost:8788: buttons, preset library, start with Windows).
::
::  2026-10-18 - U) added: Board Console (Firmware\board-console), the control page for
::  the universal ESP32-S3 dev board at http://localhost:8790 (phase 1: layout, connectors,
::  setups, board_pins.h). It reads the board model from H:\VRG_Visual_Base\...\Topology_Starter.
::
::  2026-10-21 - H) added: VRG Kapu, the shared homepage / business map
::  (Hub\VRG Kapu.cmd -> Hub\dist\vrg-kapu.html, built by tools\build-hub.js).
::  A letter, not a number: the numbered slots are full at ten. Tool numbers
::  1-10 unchanged. Built on the secacc branch (docs\hub, WP-H0).
::
::  2026-10-22 - tool 11: VRG Kodvaros (the codebase as a 3D city, CodeCity\dist).
::  The first tool beyond ten, so it is the first with a LETTER: K. TOOLKEYS,
::  the menu line and the dispatch each map 11 -> K; a twelfth tool would need
::  the same three touches (see BILLENTYUK).
::
::  2026-10-22 - the CYD desk dashboard moved from K) to Y): K is taken by tool 11
::  (VRG Kodvaros, branch worktree-codecity). Board Console stays on U).
::
::  2026-10-24 - consolidated into main (GO MAIN); no tool moved.
::
::  2026-10-25 - tool 11 (K) opens on this repo by default: OPEN_TOOL rescans it
::  into CodeCity\dist\vrg-codecity.data.js, which the empty page loads. Path unchanged.
::
::  2026-10-26 - every tool's browser chooser has M) Mappa megnyitasa: Explorer
::  opens the folder that holds the tool's file, with the file selected. The
::  Y) CYD submenu got the same M). H) VRG Kapu is now only the access page
::  (GitHub sign-in + allowed list, then it starts this START.cmd and lists the
::  tools below); its map/editor/log features are parked for Kodvaros
::  (CodeCity\from-kapu). No tool number moved.
::
::  2026-10-26 - O) Helyi szerverek: every localhost address in the repo in one
::  list (HELYI SZERVEREK section, LH<n>_*), each marked FUT / nem fut. Picking
::  one opens it; one that is not running is started first (minimised window
::  "VRG <port>"). A) opens every running one.
:: ==========================================================================

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

:: REPO is the VRG toolset root, one level above this Planner folder. The
:: Calculator, Inventory, MindMap, Modder, Toolbox and Vendor folders all
:: live there, so anything outside the Planner project is reached from it.
for %%I in ("%ROOT%\..") do set "REPO=%%~fI"

:: -------------------------- CONSOLE QUIRKS FIX ----------------------------
:: Windows puts a console into text-selection ("mark") mode as soon as you
:: click inside it (QuickEdit Mode). While it's in that mode your keystrokes
:: don't reach the running script - you just get a beep and nothing appears.
:: This turns QuickEdit off for future console windows (per-user setting).
:: It won't change the window you're looking at right now - only ones
:: created after this line runs, including every window this launcher opens
:: from here on, and this same window the next time you start it.
reg add "HKCU\Console" /v QuickEdit /t REG_DWORD /d 0 /f >nul 2>&1

:: -------------------------- BROWSER PATHS ---------------------------------
set "CHROME_EXE=%ROOT%\apps\chrome\chrome.exe"
set "OPERAGX_EXE=%ROOT%\apps\opera-gx\opera.exe"
set "ZEN_EXE=%ROOT%\apps\zen-browser\zen.exe"

:: -------------------------- TOOL REGISTRY ---------------------------------
:: PATH values are relative to this file's own folder (ROOT). Paths below
:: are best-guess placeholders following the existing project/dist folder
:: convention - fix any that don't match reality, the launcher will tell
:: you exactly which one is wrong and where it looked.

set "T1_NAME=Varler Planner (munkaverzio 2026-10-16)"
set "T1_PATH=projects\varler-planner\dist\varler_planner.html"

set "T2_NAME=Panel anyagar kalkulator (varlerAron)"
set "T2_PATH=..\Calculator\panel_anyagar_kalkulator.html"

set "T3_NAME=Altalanos villanyszereloi kalkulator"
set "T3_PATH=..\Calculator\Altalanos_Villanyszerelui_Kalkulator.html"

set "T4_NAME=VRG MindMap"
set "T4_PATH=..\MindMap\vrg_mindmap.html"

set "T5_NAME=Valena termekcsalad valaszto"
set "T5_PATH=..\Toolbox\valena-life-szerelvenytervezo.html"

set "T6_NAME=VRG Keszlet / Inventory (anyag adatbazis)"
set "T6_PATH=..\Inventory\dist\vrg-inventory.html"

set "T7_NAME=Toolbox (fejlesztes alatt levo kodok, mini eszkozok)"
set "T7_PATH=..\toolbox.html"

set "T8_NAME=LED arkalkulator (varlerAron)"
set "T8_PATH=..\Calculator\led_arkalkulator.html"

set "T9_NAME=VRG BuildTree (modder)"
set "T9_PATH=..\Modder\vrg-buildtree.html"

set "T10_NAME=VRG Vendor (kulso komponensek katalogusa)"
set "T10_PATH=..\vrg-vendor.html"

set "T11_NAME=VRG Kodvaros (a kodbazis 3D varoskent)"
set "T11_PATH=..\CodeCity\dist\vrg-codecity.html"

set "TOOLCOUNT=11"

:: ------------------------- BILLENTYUK / MENU KEYS -------------------------
:: A menu egy billentyure reagal (choice.exe), nem sort olvas. Ezert minden
:: eszkoz egy karaktert kap: 1-9, a tizedik pedig 0. Ha egyszer 10-nel tobb
:: eszkoz lesz, a 11. sajat betujelet igenyel itt es a DISPATCH reszben is.
set "TOOLKEYS="
for /L %%i in (1,1,%TOOLCOUNT%) do (
    if %%i LSS 10 ( set "TOOLKEYS=!TOOLKEYS!%%i" ) else if %%i EQU 10 ( set "TOOLKEYS=!TOOLKEYS!0" ) else if %%i EQU 11 ( set "TOOLKEYS=!TOOLKEYS!K" )
)
set "ACTIONKEYS=BWETGVMCINSPLDRYUHOQ"
set "MENUKEYS=!TOOLKEYS!%ACTIONKEYS%"

if %TOOLCOUNT% GTR 11 (
    echo.
    echo   FIGYELEM: a menu egy billentyus valasztast hasznal, igy 11 eszkozt
    echo   tud kezelni ^(1-9, 0 es K^). A TOOLCOUNT jelenleg %TOOLCOUNT%, tehat a
    echo   11. feletti eszkozok nem valaszthatok, amig nem kapnak sajat
    echo   betujelet. Lasd a BILLENTYUK reszt a START.cmd elejen.
    echo.
    pause
)

:: --------------------- PLANNER PROJECT (folded in from varler.cmd) -------
set "PLANNER_DIR=%ROOT%\projects\varler-planner"
set "NODE_EXE=%ROOT%\apps\node\node.exe"
set "NPM_CMD=%ROOT%\apps\node\npm.cmd"
set "VSCODE_EXE=%ROOT%\apps\vscode\Code.exe"
set "MANIFEST_CMD=%ROOT%\scripts\manifest.cmd"
set "CLAUDE_CMD=%ROOT%\apps\node\claude.cmd"

:: --------------------- FEJLESZTOI AG / dev branch worktree ---------------
:: A folyamatban levo munka kulon git worktree-ben all, a repo MELLETT:
::   <Dev-VRG\VRG-DE>\wt-planner-stack   (planner-stack ag)
:: Ez nem resze a reponak, ezert a W) muvelet eloszor megnezi, hogy megvan-e.
:: REPO a Planner_VRG_U100, egy szinttel feljebb van a VRG-DE gyoker.
for %%I in ("%REPO%\..") do set "DEROOT=%%~fI"
set "WT_DIR=%DEROOT%\wt-planner-stack\Planner\projects\varler-planner"

:: --------------------- INVENTORY / VENDOR (repo gyokerben) ---------------
:: Az Inventory sajat npm projekt (fuggosegek nelkul), a fetch-vendor pedig
:: egy fuggetlen Node szkript a repo gyokereben.
set "INVENTORY_DIR=%REPO%\Inventory"
set "FETCH_VENDOR_JS=%REPO%\tools\fetch-vendor.js"

:: --------------------- PLANNER CYD (asztali kijelzo) ----------------------
:: Sajat inditofajlok a Firmware\planner-cyd mappaban; a Y) menu csak ezeket hivja.
set "CYD_DIR=%REPO%\Firmware\planner-cyd"
set "BOARD_DIR=%REPO%\Firmware\board-console"

:: --------------------- HELYI SZERVEREK / LOCALHOST (O menu) ----------------
:: Every local web address in the repo, in one list. Per entry: NAME, PORT,
:: PATH (what to open on that port) and how to start it when it is not
:: running - JS (+ARGS) is a Node script run with the portable Node, BAT a
:: launcher of its own. SELF=1: that launcher opens the browser itself.
:: Paths are relative to REPO. Up to ten entries (keys 1-9, 0).
set "LH1_NAME=Varler Planner - dev szerver"
set "LH1_PORT=8131"
set "LH1_PATH=/Planner/projects/varler-planner/dist/varler_planner.html"
set "LH1_JS=Planner\projects\varler-planner\tools\serve.js"

set "LH2_NAME=VRG Keszlet / Inventory"
set "LH2_PORT=8123"
set "LH2_PATH=/"
set "LH2_JS=Inventory\build\serve.js"

set "LH3_NAME=VRG MindMap"
set "LH3_PORT=8124"
set "LH3_PATH=/"
set "LH3_JS=MindMap\serve.js"

set "LH4_NAME=VRG Kapu - Kapu seged"
set "LH4_PORT=8795"
set "LH4_PATH=/"
set "LH4_JS=Hub\companion\server.js"
set "LH4_ARGS=--no-open"

set "LH5_NAME=Planner CYD - makropad beallitasa"
set "LH5_PORT=8788"
set "LH5_PATH=/"
set "LH5_BAT=Firmware\planner-cyd\5 - Makropad beallitasa.bat"
set "LH5_SELF=1"

set "LH6_NAME=Board Console - fejlesztolap"
set "LH6_PORT=8790"
set "LH6_PATH=/"
set "LH6_BAT=Firmware\board-console\Board Console.bat"
set "LH6_SELF=1"

set "LH7_NAME=Gyro relay - telefon"
set "LH7_PORT=47291"
set "LH7_PATH=/"
set "LH7_JS=Planner\projects\varler-planner\tools\phone-relay-server.js"

set "LH8_NAME=Knob pad - proba szerver"
set "LH8_PORT=8177"
set "LH8_PATH=/"
set "LH8_JS=Firmware\knobpad\mock-server.js"

set "LH9_NAME=Open MCT - kiserlet"
set "LH9_PORT=8150"
set "LH9_PATH=/"
set "LH9_JS=docs\research\openmct-spike\serve.js"

set "LH10_NAME=VRG Kapu - statikus dev"
set "LH10_PORT=8796"
set "LH10_PATH=/"
set "LH10_JS=Hub\test\serve.js"

set "LHCOUNT=10"

goto MENU

:: ================================ MENU =====================================
:MENU
cls
echo ============================================================
echo   VARLER - inditopult / master launcher
echo   Gyoker / Root: %ROOT%
echo ============================================================
echo.
echo  -- Eszkozok / Tools --
for /L %%i in (1,1,%TOOLCOUNT%) do (
    if %%i LSS 10 (
        echo   %%i^) !T%%i_NAME!
    ) else if %%i EQU 10 (
        echo   0^) !T%%i_NAME!
    ) else (
        echo   K^) !T%%i_NAME!
    )
)
echo.
echo  -- Planner muveletek / Planner actions --
echo   B^) Build          ^(npm run build^)
echo   W^) Build + megnyitas - fejlesztoi ag ^(wt-planner-stack^)
echo   E^) CLA elotoltve - fejlesztoi ag ^(v1 + v2, csak az Eloszto^)
echo   T^) Test           ^(npm test^)
echo   G^) Gyro relay szerver inditasa
echo   V^) Planner projekt megnyitasa VS Code-ban
echo   M^) Manifest irasa  ^(docs\MANIFEST.md^)
echo   C^) Claude Code inditasa  ^(AI fejlesztoi asszisztens, uj ablakban^)
echo.
echo  -- Keszlet muveletek / Inventory actions --
echo   I^) Build          ^(npm run build - dist\vrg-inventory.html^)
echo   N^) Test           ^(npm test^)
echo   S^) Helyi szerver  ^(npm run serve^)
echo   P^) Arellenorzes   ^(npm run pricecheck - halozat kell^)
echo.
echo  -- Vendor komponensek / Vendor components --
echo   L^) Komponensek listazasa  ^(mi van a manifestben^)
echo   D^) Komponensek letoltese  ^(Vendor mappa + oldal, halozat kell^)
echo.
echo  -- Egyeb / Other --
echo   R^) Teljes VRG toolset megnyitasa VS Code-ban  ^(repo gyoker^)
echo   H^) VRG Kapu  ^(belepes GitHubbal - utana innen indul minden^)
echo   O^) Helyi szerverek  ^(minden localhost cim egy helyen - fut / nem fut^)
echo.
echo  -- Hardver / Hardware --
echo   Y^) Planner CYD asztali kijelzo  ^(USB, Firmware\planner-cyd^)
echo   U^) Board Console - univerzalis fejlesztolap  ^(http://localhost:8790^)
echo.
echo   Q^) Kilepes / Quit
echo.
:: WHY choice AND NOT set /p:
:: set /p reads a whole LINE through the console line editor, and that editor
:: keeps the previous line in a template buffer - the old F1/F3/right-arrow
:: recall. At the next prompt the old entry shows up again at the first
:: character and the right-arrow key types it back in one character at a
:: time, so the menu looked like it was snapping back to the last entry.
:: set /p also leaves its variable untouched on an empty Enter, so a
:: keystroke that did not land re-ran the previous pick.
:: choice reads a single keypress with no line editor at all: no template
:: buffer, no history, no empty input, and nothing to press Enter on.
choice /C %MENUKEYS% /N /M "Valasztas: "
set /a "KIDX=%ERRORLEVEL%-1"
set "K="
if %KIDX% GEQ 0 set "K=!MENUKEYS:~%KIDX%,1!"
if not defined K goto MENU

if /I "%K%"=="Q" exit /b 0
if /I "%K%"=="B" goto DO_BUILD
if /I "%K%"=="W" goto DO_WT_BUILD
if /I "%K%"=="E" goto DO_WT_CLA
if /I "%K%"=="T" goto DO_TEST
if /I "%K%"=="G" goto DO_GYRO
if /I "%K%"=="V" goto DO_VSCODE
if /I "%K%"=="M" goto DO_MANIFEST
if /I "%K%"=="C" goto DO_CLAUDE
if /I "%K%"=="I" goto DO_INV_BUILD
if /I "%K%"=="N" goto DO_INV_TEST
if /I "%K%"=="S" goto DO_INV_SERVE
if /I "%K%"=="P" goto DO_INV_PRICECHECK
if /I "%K%"=="L" goto DO_VENDOR_LIST
if /I "%K%"=="D" goto DO_VENDOR_FETCH
if /I "%K%"=="R" goto DO_VSCODE_REPO
if /I "%K%"=="Y" goto DO_CYD
if /I "%K%"=="U" goto DO_BOARD
if /I "%K%"=="H" goto DO_HUB
if /I "%K%"=="O" goto LOCALHOST_MENU

:: Only keys in MENUKEYS can get this far, so a digit here is always a real
:: tool: 1-9 as printed, and 0 meaning the tenth entry.
set "PICKNUM="
if /I "%K%"=="K" set "PICKNUM=11"
if "%K%"=="0" (
    set "PICKNUM=10"
) else (
    for /L %%i in (1,1,9) do if "%K%"=="%%i" set "PICKNUM=%%i"
)
if defined PICKNUM goto OPEN_TOOL
goto MENU

:: ============================== OPEN A TOOL =================================
:OPEN_TOOL
set "TNAME=!T%PICKNUM%_NAME!"
set "TPATH=!T%PICKNUM%_PATH!"
set "TFULL=%ROOT%\%TPATH%"

:: Tool 11 (Kodvaros) opens on this repo: refresh the data file its empty page
:: loads first (CodeCity\dist\vrg-codecity.data.js, scan.js --js). No Node or
:: git -> the last scan stays, or the page shows its file picker.
if "%PICKNUM%"=="11" if exist "%NODE_EXE%" (
    echo   Kodvaros: a repo beolvasasa...
    "%NODE_EXE%" "%REPO%\CodeCity\scan.js" "%REPO%" --js "%REPO%\CodeCity\dist\vrg-codecity.data.js" >nul || echo   Kodvaros: a beolvasas nem sikerult, a legutobbi adat marad.
)

if not exist "%TFULL%" (
    echo.
    echo   HIBA: nem talalhato a fajl:
    echo     %TFULL%
    echo   Ellenorizd az utvonalat a START.cmd TOOL REGISTRY reszeben ^(T%PICKNUM%_PATH^).
    echo.
    pause
    goto MENU
)

:BROWSER_MENU
cls
echo   Megnyitas: %TNAME%
echo   %TFULL%
echo.
echo   1^) Chrome
echo   2^) Opera GX
echo   3^) Zen browser
echo   4^) Rendszer alapertelmezett bongeszo
echo.
echo   M^) Mappa megnyitasa  ^(Explorer, ahol a fajl van^)
echo   0^) Vissza
echo.
:: Egy billentyu, mint a fomenuben - lasd az ottani magyarazatot.
:: Az errorlevel a /C listaban elfoglalt helyet adja vissza, ezert a
:: vizsgalat csokkeno sorrendben all: az "if errorlevel N" azt jelenti,
:: hogy "N vagy nagyobb".
choice /C 1234M0 /N /M "Bongeszo / mappa: "
if errorlevel 6 goto MENU
if errorlevel 5 goto OPEN_FOLDER
if errorlevel 4 goto OPEN_DEFAULT
if errorlevel 3 goto OPEN_ZEN
if errorlevel 2 goto OPEN_OPERAGX
if errorlevel 1 goto OPEN_CHROME
goto BROWSER_MENU

:OPEN_CHROME
if not exist "%CHROME_EXE%" (
    echo.
    echo   HIBA: Chrome nem talalhato itt:
    echo     %CHROME_EXE%
    echo   Javitsd a CHROME_EXE erteket a START.cmd elejen.
    echo.
    pause
    goto BROWSER_MENU
)
start "" "%CHROME_EXE%" --new-window "%TFULL%"
goto MENU

:OPEN_OPERAGX
if not exist "%OPERAGX_EXE%" (
    echo.
    echo   HIBA: Opera GX nem talalhato itt:
    echo     %OPERAGX_EXE%
    echo   Javitsd az OPERAGX_EXE erteket a START.cmd elejen.
    echo.
    pause
    goto BROWSER_MENU
)
start "" "%OPERAGX_EXE%" "%TFULL%"
goto MENU

:OPEN_ZEN
if not exist "%ZEN_EXE%" (
    echo.
    echo   HIBA: Zen browser nem talalhato itt:
    echo     %ZEN_EXE%
    echo   Ez az utvonal meg nincs megerositve - ird be a tenyleges telepitesi
    echo   helyet a START.cmd elejen, a ZEN_EXE sorban.
    echo.
    pause
    goto BROWSER_MENU
)
start "" "%ZEN_EXE%" "%TFULL%"
goto MENU

:OPEN_DEFAULT
start "" "%TFULL%"
goto MENU

:: M) the folder that holds the tool's file, with the file selected
:OPEN_FOLDER
for %%F in ("%TFULL%") do set "TFILE=%%~fF"
start "" explorer.exe /select,"%TFILE%"
goto MENU

:: ============================ PLANNER ACTIONS ================================
:DO_BUILD
call :CHECK_NODE || goto MENU
if not exist "%PLANNER_DIR%" (
    echo   HIBA: nem talalhato a planner projekt mappa: %PLANNER_DIR%
    pause
    goto MENU
)
pushd "%PLANNER_DIR%"
call "%NPM_CMD%" run build
popd
echo.
pause
goto MENU

:DO_WT_BUILD
call :CHECK_NODE || goto MENU
if not exist "%WT_DIR%" (
    echo.
    echo   Nincs ilyen mappa:
    echo     %WT_DIR%
    echo   A fejlesztoi ag kulon git worktree-ben all a repo mellett. Ha a
    echo   planner-stack ag mar be lett olvasztva a main-be, ez az elem
    echo   felesleges: hasznald a B^) Build-ot es utana az 1^) eszkozt.
    echo.
    pause
    goto MENU
)
pushd "%WT_DIR%"
call "%NPM_CMD%" run build
set "RC=%ERRORLEVEL%"
popd
if not "%RC%"=="0" (
    echo.
    echo   A build hibaval allt le ^(kod %RC%^) - a fajl nem frissult.
    echo.
    pause
    goto MENU
)
set "TNAME=Varler Planner - fejlesztoi ag (wt-planner-stack)"
set "TFULL=%WT_DIR%\dist\varler_planner.html"
if not exist "%TFULL%" (
    echo.
    echo   HIBA: a build lefutott, de nincs fajl itt:
    echo     %TFULL%
    echo.
    pause
    goto MENU
)
goto BROWSER_MENU

:: E) the worktree build with the CLA plans baked in (tools\make-preload.js)
:DO_WT_CLA
call :CHECK_NODE || goto MENU
if not exist "%WT_DIR%\tools\make-preload.js" (
    echo.
    echo   Nincs ilyen fajl:
    echo     %WT_DIR%\tools\make-preload.js
    echo   Az elotoltott CLA build a planner-stack worktree-ben keszul. Ha az ag
    echo   mar be lett olvasztva, ez az elem felesleges.
    echo.
    pause
    goto MENU
)
pushd "%WT_DIR%"
call "%NPM_CMD%" run build
set "RC=%ERRORLEVEL%"
if "%RC%"=="0" (
    "%NODE_EXE%" tools\make-preload.js
    set "RC=!ERRORLEVEL!"
)
popd
if not "%RC%"=="0" (
    echo.
    echo   A build vagy az elotoltes hibaval allt le ^(kod %RC%^) - a fajl nem frissult.
    echo.
    pause
    goto MENU
)
set "TNAME=Varler Planner - CLA elotoltve (wt-planner-stack)"
set "TFULL=%WT_DIR%\dist\varler_planner_CLA.html"
if not exist "%TFULL%" (
    echo.
    echo   HIBA: lefutott, de nincs fajl itt:
    echo     %TFULL%
    echo.
    pause
    goto MENU
)
goto BROWSER_MENU

:DO_TEST
call :CHECK_NODE || goto MENU
if not exist "%PLANNER_DIR%" (
    echo   HIBA: nem talalhato a planner projekt mappa: %PLANNER_DIR%
    pause
    goto MENU
)
pushd "%PLANNER_DIR%"
call "%NPM_CMD%" test
popd
echo.
pause
goto MENU

:DO_GYRO
call :CHECK_NODE || goto MENU
set "GYRO_JS=%PLANNER_DIR%\tools\phone-relay-server.js"
if not exist "%GYRO_JS%" (
    echo   HIBA: nem talalhato: %GYRO_JS%
    pause
    goto MENU
)
pushd "%PLANNER_DIR%"
"%NODE_EXE%" tools\phone-relay-server.js
popd
pause
goto MENU

:DO_VSCODE
if not exist "%VSCODE_EXE%" (
    echo   HIBA: nem talalhato a VS Code: %VSCODE_EXE%
    pause
    goto MENU
)
if not exist "%PLANNER_DIR%" (
    echo   HIBA: nem talalhato a planner projekt mappa: %PLANNER_DIR%
    pause
    goto MENU
)
start "" "%VSCODE_EXE%" "%PLANNER_DIR%"
goto MENU

:DO_MANIFEST
if exist "%MANIFEST_CMD%" (
    call "%MANIFEST_CMD%"
) else (
    set "MANIFEST_JS=%PLANNER_DIR%\tools\manifest.js"
    if not exist "!MANIFEST_JS!" (
        echo   HIBA: sem scripts\manifest.cmd, sem tools\manifest.js nem talalhato.
        pause
        goto MENU
    )
    call :CHECK_NODE || goto MENU
    pushd "%PLANNER_DIR%"
    "%NODE_EXE%" tools\manifest.js
    popd
)
echo.
pause
goto MENU

:DO_CLAUDE
if not exist "%CLAUDE_CMD%" (
    echo   HIBA: nem talalhato a Claude Code: %CLAUDE_CMD%
    echo   Javitsd a CLAUDE_CMD erteket a START.cmd elejen.
    pause
    goto MENU
)
if not exist "%PLANNER_DIR%" (
    echo   HIBA: nem talalhato a planner projekt mappa: %PLANNER_DIR%
    pause
    goto MENU
)
start "Claude Code" /D "%PLANNER_DIR%" cmd /k call "%CLAUDE_CMD%"
goto MENU

:DO_HUB
if exist "%REPO%\Hub\VRG Kapu.cmd" goto DO_HUB_RUN
echo   HIBA: nem talalhato: Hub\VRG Kapu.cmd
pause
goto MENU
:DO_HUB_RUN
call "%REPO%\Hub\VRG Kapu.cmd"
goto MENU

:DO_VSCODE_REPO
if not exist "%VSCODE_EXE%" (
    echo   HIBA: nem talalhato a VS Code: %VSCODE_EXE%
    pause
    goto MENU
)
start "" "%VSCODE_EXE%" "%REPO%"
goto MENU

:: ======================= HELYI SZERVEREK / LOCALHOST ========================
:: The status is a 1-second curl to 127.0.0.1:<port>: any HTTP answer counts as
:: running (no -f, so a 404 does too). Without curl.exe every entry says
:: "nem fut", and starting one still works.
:LOCALHOST_MENU
cls
echo ============================================================
echo   Helyi szerverek / localhost
echo ============================================================
echo.
for /L %%i in (1,1,%LHCOUNT%) do (
    set "LHST=nem fut"
    curl.exe -s -o nul -m 1 "http://127.0.0.1:!LH%%i_PORT!/" >nul 2>&1 && set "LHST=FUT    "
    set "LHKEY=%%i"
    if %%i EQU 10 set "LHKEY=0"
    echo   !LHKEY!^) [!LHST!]  http://localhost:!LH%%i_PORT!   !LH%%i_NAME!
)
echo.
echo   A^) Minden futo megnyitasa
echo   X^) Vissza
echo.
echo   Ami nem fut, azt a szamara elinditja, aztan megnyitja.
echo.
choice /C 1234567890AX /N /M "Valasztas: "
set "LHPICK=%ERRORLEVEL%"
if "%LHPICK%"=="12" goto MENU
if "%LHPICK%"=="11" goto LH_OPEN_ALL
if %LHPICK% GTR %LHCOUNT% goto LOCALHOST_MENU

set "LHNAME=!LH%LHPICK%_NAME!"
set "LHPORT=!LH%LHPICK%_PORT!"
set "LHURL=http://localhost:!LH%LHPICK%_PORT!!LH%LHPICK%_PATH!"
set "LHSELF=!LH%LHPICK%_SELF!"
curl.exe -s -o nul -m 1 "http://127.0.0.1:%LHPORT%/" >nul 2>&1
if not errorlevel 1 goto LH_OPEN

call :LH_START %LHPICK% || goto LOCALHOST_MENU
:: its own launcher opens the browser - nothing to wait for here
if "%LHSELF%"=="1" goto LOCALHOST_MENU
echo   Inditas: %LHNAME% ^(port %LHPORT%^)...
set /a "LHTRY=0"
:LH_WAIT
set /a "LHTRY+=1"
ping -n 2 127.0.0.1 >nul
curl.exe -s -o nul -m 1 "http://127.0.0.1:%LHPORT%/" >nul 2>&1
if not errorlevel 1 goto LH_OPEN
if !LHTRY! LSS 10 goto LH_WAIT
echo.
echo   A szerver 10 masodperc alatt sem valaszolt.
echo   Nezd meg a "VRG %LHPORT%" ablakot ^(talcan, kis meretben^).
echo.
pause
goto LOCALHOST_MENU

:LH_OPEN
start "" "%LHURL%"
goto LOCALHOST_MENU

:LH_OPEN_ALL
for /L %%i in (1,1,%LHCOUNT%) do (
    curl.exe -s -o nul -m 1 "http://127.0.0.1:!LH%%i_PORT!/" >nul 2>&1 && start "" "http://localhost:!LH%%i_PORT!!LH%%i_PATH!"
)
goto LOCALHOST_MENU

:: Starts entry %1 minimised in a window titled "VRG <port>". exit 1 = could not.
:LH_START
set "LHN=%~1"
set "LHJS=!LH%LHN%_JS!"
set "LHBAT=!LH%LHN%_BAT!"
set "LHARGS=!LH%LHN%_ARGS!"
set "LHP=!LH%LHN%_PORT!"
if defined LHBAT goto LH_START_BAT
if not exist "%NODE_EXE%" goto LH_NO_NODE
if not exist "%REPO%\%LHJS%" goto LH_NO_FILE
start "VRG %LHP%" /min "%NODE_EXE%" "%REPO%\%LHJS%" %LHARGS%
exit /b 0
:LH_START_BAT
set "LHJS=%LHBAT%"
if not exist "%REPO%\%LHBAT%" goto LH_NO_FILE
start "VRG %LHP%" /min "%REPO%\%LHBAT%"
exit /b 0
:LH_NO_NODE
echo   HIBA: nem talalhato a hordozhato Node: %NODE_EXE%
pause
exit /b 1
:LH_NO_FILE
echo   HIBA: nem talalhato: %REPO%\%LHJS%
echo   Javitsd a LH%LHN% bejegyzest a START.cmd HELYI SZERVEREK reszeben.
pause
exit /b 1

:: ========================= PLANNER CYD KIJELZO ==============================
:: Mindharom a sajat uj ablakaban fut, a menu itt marad.
:DO_BOARD
if not exist "%BOARD_DIR%\Board Console.bat" (
    echo   HIBA: nem talalhato: %BOARD_DIR%
    pause
    goto MENU
)
start "Board Console" /min "%BOARD_DIR%\Board Console.bat"
goto MENU

:DO_CYD
if not exist "%CYD_DIR%" (
    echo   HIBA: nem talalhato: %CYD_DIR%
    pause
    goto MENU
)
echo.
echo   1^) Inditas a Plannerrel  ^(relay + bridge, utana nyisd meg a Plannert^)
echo   2^) Demo  ^(kitalalt Planner, bongeszo nelkul^)
echo   3^) CYD firmware feltoltese  ^(lecsereli a Rocket League kijelzot^)
echo   4^) Makropad  ^(MAKROK oldal Windowshoz; a Plannert is felveszi^)
echo   5^) Makropad beallitasa  ^(gombok, gyujtemeny, inditas a Windowszal^)
echo   M^) Mappa megnyitasa  ^(Firmware\planner-cyd^)
echo   X^) Vissza
choice /C 12345MX /N /M "Valasztas: "
set "CK=%ERRORLEVEL%"
if "%CK%"=="1" start "Planner CYD" "%CYD_DIR%\1 - USB - Planner.bat"
if "%CK%"=="2" start "Planner CYD demo" "%CYD_DIR%\2 - USB - Demo.bat"
if "%CK%"=="3" start "Planner CYD flash" "%CYD_DIR%\3 - Flash CYD firmware.bat"
if "%CK%"=="4" start "Planner CYD makropad" "%CYD_DIR%\4 - USB - Makropad.bat"
if "%CK%"=="5" start "Planner CYD makropad settings" "%CYD_DIR%\5 - Makropad beallitasa.bat"
if "%CK%"=="6" start "" explorer.exe "%CYD_DIR%"
goto MENU

:: ====================== KESZLET / INVENTORY MUVELETEK ========================
:: Mindegyik a RUN_INV segedet hivja, az pedig az Inventory mappaban futtatja
:: a megadott npm parancsot. Az Inventory-nak nincs fuggosege, igy nem kell
:: npm install elotte.

:DO_INV_BUILD
call :RUN_INV run build
goto MENU

:DO_INV_TEST
call :RUN_INV test
goto MENU

:DO_INV_PRICECHECK
echo.
echo   Halozati muvelet: lekeri a jelenlegi polci arakat, es a talalatokat
echo   a price-check-^<datum^>.json fajlba irja az Inventory mappaba.
echo   Megszakitas: Ctrl+C.
echo.
call :RUN_INV run pricecheck
goto MENU

:DO_INV_SERVE
call :CHECK_INV || goto MENU
echo.
echo   Helyi szerver indul. Leallitas: Ctrl+C.
echo.
pushd "%INVENTORY_DIR%"
call "%NPM_CMD%" run serve
popd
echo.
pause
goto MENU

:: ========================= VENDOR KOMPONENSEK ================================
:DO_VENDOR_LIST
call :CHECK_VENDOR_TOOL || goto MENU
pushd "%REPO%"
"%NODE_EXE%" "%FETCH_VENDOR_JS%" --list
popd
echo.
pause
goto MENU

:DO_VENDOR_FETCH
call :CHECK_VENDOR_TOOL || goto MENU
echo.
echo   Halozati muvelet: letolti a vendor-manifest.json-ban felsorolt
echo   komponenseket a Vendor mappaba, majd frissiti a vrg-vendor.html
echo   oldalt. A Vendor mappa nincs verziokezelve - barmikor ujrahuzhato.
echo   Megszakitas: Ctrl+C.
echo.
pushd "%REPO%"
"%NODE_EXE%" "%FETCH_VENDOR_JS%" --all
"%NODE_EXE%" "%FETCH_VENDOR_JS%" --sync-page
popd
echo.
pause
goto MENU

:: ================================ HELPERS ====================================
:CHECK_NODE
if not exist "%NODE_EXE%" (
    echo   HIBA: nem talalhato a hordozhato Node: %NODE_EXE%
    pause
    exit /b 1
)
if not exist "%NPM_CMD%" (
    echo   HIBA: nem talalhato az npm: %NPM_CMD%
    pause
    exit /b 1
)
exit /b 0

:CHECK_INV
call :CHECK_NODE || exit /b 1
if not exist "%INVENTORY_DIR%\package.json" (
    echo.
    echo   HIBA: nem talalhato az Inventory projekt:
    echo     %INVENTORY_DIR%
    echo   Ellenorizd az INVENTORY_DIR erteket a START.cmd elejen.
    echo.
    pause
    exit /b 1
)
exit /b 0

:: Futtat egy npm parancsot az Inventory mappaban. Hasznalat: call :RUN_INV run build
:RUN_INV
call :CHECK_INV || exit /b 1
pushd "%INVENTORY_DIR%"
call "%NPM_CMD%" %*
popd
echo.
pause
exit /b 0

:CHECK_VENDOR_TOOL
call :CHECK_NODE || exit /b 1
if not exist "%FETCH_VENDOR_JS%" (
    echo.
    echo   HIBA: nem talalhato a vendor letolto szkript:
    echo     %FETCH_VENDOR_JS%
    echo   Ellenorizd a FETCH_VENDOR_JS erteket a START.cmd elejen.
    echo.
    pause
    exit /b 1
)
exit /b 0
