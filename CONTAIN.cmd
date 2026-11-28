@echo off
rem The menu: both modes, setup, status, copy to a stick, autostart.
rem VRG Containment - see README.md. Everything runs in core\contain.ps1.
setlocal
set "KIT=%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%KIT%core\contain.ps1" -Mode menu %*
if errorlevel 1 pause
endlocal
