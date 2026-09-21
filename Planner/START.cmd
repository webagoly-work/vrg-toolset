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
::  the number, and increase TOOLCOUNT. Nothing else needs to change.
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

set "T1_NAME=Varler Planner"
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

set "TOOLCOUNT=10"

:: --------------------- PLANNER PROJECT (folded in from varler.cmd) -------
set "PLANNER_DIR=%ROOT%\projects\varler-planner"
set "NODE_EXE=%ROOT%\apps\node\node.exe"
set "NPM_CMD=%ROOT%\apps\node\npm.cmd"
set "VSCODE_EXE=%ROOT%\apps\vscode\Code.exe"
set "MANIFEST_CMD=%ROOT%\scripts\manifest.cmd"
set "CLAUDE_CMD=%ROOT%\apps\node\claude.cmd"

:: --------------------- INVENTORY / VENDOR (repo gyokerben) ---------------
:: Az Inventory sajat npm projekt (fuggosegek nelkul), a fetch-vendor pedig
:: egy fuggetlen Node szkript a repo gyokereben.
set "INVENTORY_DIR=%REPO%\Inventory"
set "FETCH_VENDOR_JS=%REPO%\tools\fetch-vendor.js"

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
    echo   %%i^) !T%%i_NAME!
)
echo.
echo  -- Planner muveletek / Planner actions --
echo   B^) Build          ^(npm run build^)
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
echo.
echo   Q^) Kilepes / Quit
echo.
set /p "CHOICE=Valasztas: "

if /I "%CHOICE%"=="Q" exit /b 0
if /I "%CHOICE%"=="B" goto DO_BUILD
if /I "%CHOICE%"=="T" goto DO_TEST
if /I "%CHOICE%"=="G" goto DO_GYRO
if /I "%CHOICE%"=="V" goto DO_VSCODE
if /I "%CHOICE%"=="M" goto DO_MANIFEST
if /I "%CHOICE%"=="C" goto DO_CLAUDE
if /I "%CHOICE%"=="I" goto DO_INV_BUILD
if /I "%CHOICE%"=="N" goto DO_INV_TEST
if /I "%CHOICE%"=="S" goto DO_INV_SERVE
if /I "%CHOICE%"=="P" goto DO_INV_PRICECHECK
if /I "%CHOICE%"=="L" goto DO_VENDOR_LIST
if /I "%CHOICE%"=="D" goto DO_VENDOR_FETCH
if /I "%CHOICE%"=="R" goto DO_VSCODE_REPO

set "PICKNUM="
for /L %%i in (1,1,%TOOLCOUNT%) do (
    if "%CHOICE%"=="%%i" set "PICKNUM=%%i"
)
if defined PICKNUM goto OPEN_TOOL

echo.
echo   Nem ervenyes valasztas.
pause
goto MENU

:: ============================== OPEN A TOOL =================================
:OPEN_TOOL
set "TNAME=!T%PICKNUM%_NAME!"
set "TPATH=!T%PICKNUM%_PATH!"
set "TFULL=%ROOT%\%TPATH%"

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
echo   0^) Vissza
echo.
set /p "BCHOICE=Bongeszo: "

if "%BCHOICE%"=="0" goto MENU
if "%BCHOICE%"=="1" goto OPEN_CHROME
if "%BCHOICE%"=="2" goto OPEN_OPERAGX
if "%BCHOICE%"=="3" goto OPEN_ZEN
if "%BCHOICE%"=="4" goto OPEN_DEFAULT

echo   Nem ervenyes valasztas.
pause
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

:DO_VSCODE_REPO
if not exist "%VSCODE_EXE%" (
    echo   HIBA: nem talalhato a VS Code: %VSCODE_EXE%
    pause
    goto MENU
)
start "" "%VSCODE_EXE%" "%REPO%"
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
