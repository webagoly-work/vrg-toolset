@echo off
setlocal EnableDelayedExpansion

:: ==========================================================================
::  VRG Kapu.cmd - opens VRG Kapu (the shared homepage / business map).
::
::  Full mode: the Kapu seged (Hub\companion\server.js) serves the page on
::  http://localhost:8795 - settings are remembered there, and the Terminal /
::  Claude Code / open-tool buttons work. If the seged already runs, this only
::  opens the page. Without Node it falls back to the plain file (links only).
::  Console output stays ASCII.
:: ==========================================================================

set "HUB=%~dp0"
if "%HUB:~-1%"=="\" set "HUB=%HUB:~0,-1%"
set "REPO=%HUB%\.."
set "PAGE=%HUB%\dist\vrg-kapu.html"
set "URL=http://localhost:8795/"
set "STATUS=http://127.0.0.1:8795/api/status"

if exist "%PAGE%" goto HAVE_PAGE
echo.
echo   HIBA: a VRG Kapu meg nincs megepitve.
echo   Futtasd a repo gyokereben:  node tools\build-hub.js
echo.
pause
exit /b 1

:HAVE_PAGE
:: node: the portable one next to the Planner first, then the one on PATH
set "NODE_EXE=%REPO%\Planner\apps\node\node.exe"
if exist "%NODE_EXE%" goto HAVE_NODE
set "NODE_EXE="
for %%N in (node.exe) do set "NODE_EXE=%%~$PATH:N"
if defined NODE_EXE goto HAVE_NODE
echo   Nincs Node.js - a Kapu csak linkek modban nyilik.
start "" "%PAGE%"
exit /b 0

:HAVE_NODE
:: already running? then just open the page
curl.exe -s -o nul -m 2 "%STATUS%" >nul 2>&1
if not errorlevel 1 goto OPEN_ONLY

echo   Kapu seged inditasa...
start "Kapu seged" /min "%NODE_EXE%" "%HUB%\companion\server.js"

set /a "TRIES=0"
:WAIT
set /a "TRIES+=1"
ping -n 2 127.0.0.1 >nul
curl.exe -s -o nul -m 2 "%STATUS%" >nul 2>&1
if not errorlevel 1 goto STARTED
if !TRIES! LSS 10 goto WAIT
echo.
echo   HIBA: a Kapu seged 10 masodperc alatt sem valaszolt.
echo   Nezd meg a "Kapu seged" ablakot (talan foglalt a 8795 port).
echo   Addig a Kapu csak linkek modban nyilik.
echo.
start "" "%PAGE%"
pause
exit /b 1

:STARTED
:: the seged opens the page itself in the configured browser
exit /b 0

:OPEN_ONLY
start "" "%URL%"
exit /b 0
