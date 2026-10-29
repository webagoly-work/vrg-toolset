@echo off
REM ServiceKit Phone - Wi-Fi / USB-tethering mode. Phone connects to this PC IP
REM with the 6-digit token printed below. Run-on-PC is ON.
setlocal
cd /d "%~dp0"
echo [ServiceKit Phone] This PC on the network:
ipconfig ^| findstr /i "IPv4"
echo.
echo Enter the token shown below on the phone, with this PC IP and port 47814.
node "%~dp0skphone-bridge.js" --host 0.0.0.0 --allow-run
pause
