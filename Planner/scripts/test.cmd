@echo off
setlocal
call "%~dp0_env.cmd"

if not exist "%NODE%" (echo   Nincs hordozhato Node: %NODE% & pause & exit /b 1)

cd /d "%PROJ%"

if not exist "node_modules" (
  echo.
  echo   Nincs node_modules. Az npm install pendrive-on nagyon lassu -
  echo   futtasd inkabb otthon, gepen, es masold at a mappat.
  echo.
  set "yn="
  set /p yn=Azert most telepitsek? [i/N]:
  if /i not "%yn%"=="i" exit /b 1
  call "%NPM%" install
)

call "%NPM%" test
echo.
pause
