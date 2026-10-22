@echo off
title Planner CYD - makropad settings
setlocal
rem Opens the MAKROK settings page. The page lives in the bridge, so start the macropad first
rem if no bridge answers on port 8788.
powershell -NoProfile -Command "try{Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 http://127.0.0.1:8788/api/state | Out-Null; exit 0}catch{exit 1}"
if errorlevel 1 (
  echo   Starting the macropad first...
  start "Planner CYD makropad" /min "%~dp04 - USB - Makropad.bat"
  ping -n 5 127.0.0.1 >nul
)
start "" "http://localhost:8788"
