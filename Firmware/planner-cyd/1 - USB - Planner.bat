@echo off
title Planner CYD - USB
setlocal
rem This folder is <repo>\Firmware\planner-cyd; the Planner is <repo>\Planner.
for %%I in ("%~dp0..\..\Planner") do set "PLN=%%~fI"
call :findnode
rem The Planner tab talks to the phone relay on port 47291. Start it if nothing answers there.
powershell -NoProfile -Command "try{Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 http://127.0.0.1:47291/whoami | Out-Null; exit 0}catch{exit 1}"
if errorlevel 1 (
  echo   Starting the Planner relay in its own window...
  start "Planner relay" /min "%NODE%" "%PLN%\projects\varler-planner\tools\phone-relay-server.js"
)
rem A bridge may already be running (the macropad, maybe started with Windows): it holds the
rem CYD and finds the relay by itself, so a second one would only fight it for the port.
powershell -NoProfile -Command "try{Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 http://127.0.0.1:8788/api/state | Out-Null; exit 0}catch{exit 1}"
if not errorlevel 1 (
  echo.
  echo   The CYD bridge is already running ^(the macropad^): it picks up the Planner by itself.
  echo   Open the Planner now. This window can be closed.
  pause
  goto :eof
)
echo.
echo   Open the Planner now: it connects to the relay by itself.
echo   Close this window to stop the dashboard.
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
goto :eof

:findnode
set "NODE=%PLN%\..\..\tools\node\node.exe"
if exist "%NODE%" goto :eof
set "NODE=node"
goto :eof
