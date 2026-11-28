@echo off
rem Windows Sandbox on this PC. Drop a file or folder on it to open it read-only inside. Optional first word: a profile id.
rem VRG Containment - see README.md. Everything runs in core\contain.ps1.
setlocal
set "KIT=%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%KIT%core\contain.ps1" -Mode sandbox %*
if errorlevel 1 pause
endlocal
