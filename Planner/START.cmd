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
::  NOTE: the five Planner actions below (build/test/gyro/VS Code/manifest)
::  are rebuilt from project notes, not copied from your real varler.cmd -
::  that file wasn't available when this was written. If any of the five
::  don't match what varler.cmd actually did, send me that file and I will
::  correct these in place.
:: ==========================================================================

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

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

set "T6_NAME=Vezetekazonosito eszkoz (wire ID)"
set "T6_PATH=projects\wire-id-tool\wire_id_tool.html"

set "T7_NAME=Toolbox (fejlesztes alatt levo kodok, mini eszkozok)"
set "T7_PATH=..\toolbox.html"

set "T8_NAME=LED arkalkulator (varlerAron)"
set "T8_PATH=..\Calculator\led_arkalkulator.html"

set "TOOLCOUNT=8"

:: --------------------- PLANNER PROJECT (folded in from varler.cmd) -------
set "PLANNER_DIR=%ROOT%\projects\varler-planner"
set "NODE_EXE=%ROOT%\apps\node\node.exe"
set "NPM_CMD=%ROOT%\apps\node\npm.cmd"
set "VSCODE_EXE=%ROOT%\apps\vscode\Code.exe"
set "MANIFEST_CMD=%ROOT%\scripts\manifest.cmd"
set "CLAUDE_CMD=%ROOT%\apps\node\claude.cmd"

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
