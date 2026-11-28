@echo off
rem Portable QEMU VM (Debian Live), no install. Drop a file or folder on it to see it read-only inside.
rem VRG Containment - see README.md. Everything runs in core\contain.ps1.
setlocal
set "KIT=%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%KIT%core\contain.ps1" -Mode stick %*
if errorlevel 1 pause
endlocal
