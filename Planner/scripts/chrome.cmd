@echo off
rem ============================================================
rem  VARLER Planner - Chrome for Testing launcher
rem  Lives in:  <ROOT>\scripts\chrome.cmd
rem  Finds ROOT from its own location, so the drive letter
rem  never matters.
rem ============================================================
setlocal

rem --- resolve ROOT (one level up from scripts\) ---------------
pushd "%~dp0.." || (echo Nem talalom a ROOT mappat. & pause & exit /b 1)
set "ROOT=%CD%"
popd

set "CHROME=%ROOT%\apps\chrome\chrome.exe"
set "DIST=%ROOT%\projects\varler-planner\dist\varler_planner.html"
set "PROFILE=%ROOT%\data\browser-profile"

rem --- checks --------------------------------------------------
if not exist "%CHROME%" (
  echo.
  echo   Nincs bongeszo itt:
  echo     %CHROME%
  echo.
  echo   Toltsd le a Chrome for Testing / win64 ZIP-et innen:
  echo     googlechromelabs.github.io/chrome-for-testing
  echo   es a chrome-win64 mappa TARTALMAT masold ide:
  echo     %ROOT%\apps\chrome\
  echo.
  echo   Utana a chrome.exe kozvetlenul ebben a mappaban legyen.
  echo.
  pause
  exit /b 1
)

if not exist "%DIST%" (
  echo.
  echo   Nincs meg a dist fajl:
  echo     %DIST%
  echo   Futtasd eloszor a build-et: START.cmd -^> 2
  echo.
  pause
  exit /b 1
)

if not exist "%PROFILE%" mkdir "%PROFILE%"

rem --- backslash -^> slash for the file:// URL -------------------
set "URL=file:///%DIST:\=/%"

echo   ROOT    = %ROOT%
echo   Chrome  = %CHROME%
echo   Profil  = %PROFILE%
echo   Megnyit = %URL%
echo.

start "" "%CHROME%" ^
 --user-data-dir="%PROFILE%" ^
 --app="%URL%" ^
 --no-first-run ^
 --no-default-browser-check ^
 --disable-background-networking ^
 --disable-component-update ^
 --disable-extensions

exit /b 0
