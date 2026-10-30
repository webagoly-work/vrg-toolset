@echo off
title Planner CYD - USB demo
setlocal
for %%I in ("%~dp0..\..\Planner") do set "PLN=%%~fI"
set "NODE=%PLN%\..\..\tools\node\node.exe"
if not exist "%NODE%" set "NODE=node"
echo.
echo   Demo: a fake Planner tab, no browser or relay needed.
echo.
rem node_modules is not in git: fetch serialport on the first run
if not exist "%~dp0app\bridge\node_modules\serialport" (
  echo   First run: installing serialport...
  pushd "%~dp0app\bridge"
  if exist "%PLN%\..\..\tools\node\npm.cmd" (call "%PLN%\..\..\tools\node\npm.cmd" install --omit=dev) else (call npm install --omit=dev)
  popd
)
cd /d "%~dp0app\bridge"
"%NODE%" bridge.js --demo %*
pause
