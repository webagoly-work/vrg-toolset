@echo off
rem ServiceKit Terminal - portable Claude Code launcher with a phone gate
rem Process-scoped execution policy, the same way as START.cmd; the machine policy is never changed.
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0terminal\terminal.ps1" %*
if errorlevel 1 pause
