@echo off
title Planner CYD - makropad
setlocal
for %%I in ("%~dp0..\..\Planner") do set "PLN=%%~fI"
set "NODE=%PLN%\..\..\tools\node\node.exe"
if not exist "%NODE%" set "NODE=node"
echo.
echo   Makropad: the MAKROK page for everyday Windows use.
echo   Buttons: app\bridge\macros.json  (saved changes load by themselves)
echo   Settings page: http://localhost:8788  (START.cmd ^> K ^> 5)
echo   It picks up the Planner too, as soon as the relay runs (K ^> 1).
echo   Close this window to stop.
echo.
rem node_modules is not in git: fetch serialport on the first run
if not exist "%~dp0app\bridge\node_modules\serialport" (
  echo   First run: installing serialport...
  pushd "%~dp0app\bridge"
  if exist "%PLN%\..\..\tools\node\npm.cmd" (call "%PLN%\..\..\tools\node\npm.cmd" install --omit=dev) else (call npm install --omit=dev)
  popd
)
cd /d "%~dp0app\bridge"
"%NODE%" bridge.js %*
pause
