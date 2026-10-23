@echo off
title Board Console
setlocal
rem Board Console: the control page for the universal ESP32-S3 dev board (layout, connectors,
rem setups, firmware library + flasher, live agent link). Starts the local server on port 8790
rem and opens the browser; if it is already running, it only opens the browser.
where node >/dev/null 2>nul
if errorlevel 1 (
  echo   Node.js was not found. Install it, or start this from START.cmd.
  pause
  exit /b 1
)
rem First run: the live link needs the serialport package (app\node_modules, not in git).
if not exist "%~dp0app\node_modules\serialport" (
  echo   First run: installing serialport into app\node_modules ...
  pushd "%~dp0app"
  call npm install --no-audit --no-fund
  popd
)
node "%~dp0app\server.js" %*
if errorlevel 1 pause
