@echo off
REM ServiceKit - one-line bootstrap (double-click or run). Pulls the kit from the
REM public repo and sets it up here. No stick, phone or bridge needed.
setlocal
echo [ServiceKit] Fetching and launching the bootstrap...
powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/webagoly-work/vrg-toolset/servicekit/ServiceKit/bootstrap.ps1 ^| iex"
if errorlevel 1 (
  echo.
  echo Bootstrap failed. Check internet access, or run in PowerShell:
  echo   irm https://raw.githubusercontent.com/webagoly-work/vrg-toolset/servicekit/ServiceKit/bootstrap.ps1 ^| iex
)
pause
