@echo off
setlocal
call "%~dp0_env.cmd"
title Gyro relay

set "RELAY=%PROJ%\tools\phone-relay-server.js"
if not exist "%RELAY%" (echo   Nincs meg a relay: %RELAY% & pause & exit /b 1)
if not exist "%NODE%" (echo   Nincs hordozhato Node: %NODE% & pause & exit /b 1)
if not exist "%PROJ%\node_modules\ws" (
  echo.
  echo   Hianyzik a 'ws' csomag. A relay enelkul nem indul.
  echo   Futtasd: npm install
  echo.
  pause & exit /b 1
)
if not exist "%PROJ%\mobile\phone-sender.html" (
  echo.
  echo   FIGYELEM: nincs mobile\phone-sender.html - a telefon ures oldalt kap.
  echo.
)

echo.
echo   Ha a Windows tuzfal rakerdez: ENGEDELYEZD a node.exe-t,
echo   es pipald be a MAGAN halozatot.
echo.

cd /d "%PROJ%"
"%NODE%" "%RELAY%"

echo.
pause
