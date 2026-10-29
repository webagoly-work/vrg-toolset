@echo off
rem ServiceKit - Iranyitopult / Dashboard
cd /d "%~dp0"
start "ServiceKit Dashboard" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0core\server.ps1"
if errorlevel 1 (
  echo PowerShell could not start. Opening the offline guide instead.
  start "" "%~dp0launcher\index.html"
)
