@echo off
setlocal
call "%~dp0_env.cmd"

if not exist "%NODE%" (
  echo   Nincs hordozhato Node: %NODE%
  echo   Csomagold ki a node-vXX-win-x64.zip tartalmat ide: %NODEDIR%
  pause & exit /b 1
)

cd /d "%PROJ%"
echo   Node: & "%NODE%" -v
echo.
"%NODE%" build.js
echo.
if errorlevel 1 (echo   BUILD HIBA.) else (echo   Kesz: dist\varler_planner.html)
echo.
pause
