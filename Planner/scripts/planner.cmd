@echo off
setlocal
call "%~dp0_env.cmd"

if not exist "%PLANNER%" (
  echo.
  echo   Nincs meg a dist fajl:
  echo     %PLANNER%
  echo   Futtasd eloszor a Build-et ^(START.cmd -^> 2^).
  echo.
  pause
  exit /b 1
)

if not exist "%BROWSER%" (
  echo.
  echo   Nincs meg a hordozhato bongeszo:
  echo     %APPS%\opera-gx\launcher.exe
  echo   Megnyitom az alapertelmezett bongesziben helyette.
  echo   FIGYELEM: a projektek a bongeszoprofilban vannak - masik bongeszo, masik lista.
  echo.
  timeout /t 3 >nul
  start "" "%PLANNER%"
  exit /b 0
)

start "" "%BROWSER%" "%PLANNER%"
exit /b 0
