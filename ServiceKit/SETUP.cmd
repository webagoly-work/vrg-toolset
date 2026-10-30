@echo off
rem ServiceKit - Telepito / Setup
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -STA -File "%~dp0core\setup.ps1" %*
if errorlevel 1 pause
