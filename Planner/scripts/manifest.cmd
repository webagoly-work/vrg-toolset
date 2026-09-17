@echo off
setlocal
call "%~dp0_env.cmd"

if not exist "%NODE%" (echo   Nincs hordozhato Node: %NODE% & pause & exit /b 1)
if not exist "%PROJ%\tools\manifest.js" (echo   Nincs meg: %PROJ%\tools\manifest.js & pause & exit /b 1)

"%NODE%" "%PROJ%\tools\manifest.js" "%ROOT%"

echo.
echo   A MANIFEST.md a docs\ mappaban van - ezt masold be a beszelgetes elejere.
echo.
set "yn="
set /p yn=Megnyissam most? [i/N]:
if /i "%yn%"=="i" start "" notepad "%PROJ%\docs\MANIFEST.md"
