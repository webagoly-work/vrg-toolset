@echo off
setlocal

:: ==========================================================================
::  VRG Kapu.cmd - opens the VRG Kapu (the shared homepage / business map).
::  For now it opens the built file in the default browser. WP-H10 switches
::  this to the Kapu seged (local helper on 127.0.0.1:8795).
::  Console output stays ASCII.
:: ==========================================================================

set "HUB=%~dp0"
set "PAGE=%HUB%dist\vrg-kapu.html"

if exist "%PAGE%" goto OPEN
echo.
echo   HIBA: a VRG Kapu meg nincs megepitve.
echo   Futtasd a repo gyokereben:  node tools\build-hub.js
echo.
pause
exit /b 1

:OPEN
start "" "%PAGE%"
exit /b 0
