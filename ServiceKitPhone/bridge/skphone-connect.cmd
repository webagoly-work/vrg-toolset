@echo off
REM ServiceKit Phone - USB connect (adb reverse). Phone reaches the PC at 127.0.0.1:47814
REM over the cable, no token. Needs: USB debugging ON, and adb on PATH (or next to this file).
setlocal
cd /d "%~dp0"
set ADB=adb
where adb >nul 2>&1 || set ADB=%~dp0platform-tools\adb.exe
echo [ServiceKit Phone] Setting up USB tunnel...
"%ADB%" reverse tcp:47814 tcp:47814
if errorlevel 1 (
  echo.
  echo Could not set up adb reverse. Check: phone plugged in, USB debugging ON,
  echo "Allow USB debugging" accepted on the phone, and adb installed.
  echo Falling back to Wi-Fi/tethering mode needs skphone-wifi.cmd instead.
  pause
  exit /b 1
)
echo [ServiceKit Phone] Tunnel ready. Starting bridge (loopback, run-on-PC ON)...
node "%~dp0skphone-bridge.js" --allow-run
pause
