@echo off
rem ===========================================================================
rem  snapshot.cmd  -  write a readable listing of the whole VARLER folder
rem
rem  Put this in C:\VARLER and double-click it. It writes SNAPSHOT.txt in the
rem  same folder and opens it in Notepad. Select all, copy, paste into the chat.
rem
rem  Needs nothing installed - no Node, no git. Works even on a half-built stick.
rem  Skips apps\ internals, node_modules and .git, which are thousands of files
rem  and tell you nothing.
rem ===========================================================================
setlocal enabledelayedexpansion
cd /d "%~dp0"
set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
set "OUT=%ROOT%\SNAPSHOT.txt"

echo.
echo   Scanning %ROOT% ...
echo.

> "%OUT%" echo VARLER SNAPSHOT
>>"%OUT%" echo Root : %ROOT%
>>"%OUT%" echo Date : %DATE% %TIME%
>>"%OUT%" echo.

rem --- portable apps: presence only, not contents ----------------------------
>>"%OUT%" echo == apps ^(installed portables^) ==
set "ANY="
for /d %%D in ("%ROOT%\apps\*") do (
  set "ANY=1"
  set "MARK=empty"
  dir /b "%%D" >nul 2>&1 && for /f %%N in ('dir /b "%%D" 2^>nul ^| find /c /v ""') do set "MARK=%%N items"
  >>"%OUT%" echo    %%~nxD\   !MARK!
)
if not defined ANY >>"%OUT%" echo    ^(none^)

rem --- key files: are they where they should be? -----------------------------
>>"%OUT%" echo.
>>"%OUT%" echo == key files ==
call :chk "apps\node\node.exe"
call :chk "apps\opera-gx\launcher.exe"
call :chk "apps\vscode\Code.exe"
call :chk "apps\git\cmd\git.exe"
call :chk "START.cmd"
call :chk "scripts\_env.cmd"
call :chk "projects\varler-planner\build.js"
call :chk "projects\varler-planner\package.json"
call :chk "projects\varler-planner\src\shell.html"
call :chk "projects\varler-planner\dist\varler_planner.html"
call :chk "projects\varler-planner\node_modules\ws"

rem --- module count ----------------------------------------------------------
>>"%OUT%" echo.
set "NMOD=0"
for %%F in ("%ROOT%\projects\varler-planner\src\*.js") do set /a NMOD+=1
>>"%OUT%" echo == src modules: !NMOD! .js files ==

rem --- the actual tree -------------------------------------------------------
call :walk "%ROOT%\projects"
call :walk "%ROOT%\data"
call :walk "%ROOT%\scripts"
call :walk "%ROOT%\docs"

rem --- loose files in the root ----------------------------------------------
>>"%OUT%" echo.
>>"%OUT%" echo == \ ^(root^) ==
set "ANY="
for %%F in ("%ROOT%\*") do (
  set "ANY=1"
  >>"%OUT%" echo    %%~nxF ^| %%~zF B ^| %%~tF
)
if not defined ANY >>"%OUT%" echo    ^(empty^)

>>"%OUT%" echo.
>>"%OUT%" echo -- end --

echo   Written: %OUT%
echo.
start "" notepad "%OUT%"
exit /b 0

rem ===========================================================================
:chk
if exist "%ROOT%\%~1" (
  >>"%OUT%" echo    [x] %~1
) else (
  >>"%OUT%" echo    [ ] %~1     MISSING
)
exit /b

:walk
if not exist "%~1\" exit /b
call :dump "%~1"
for /d /r "%~1" %%D in (*) do (
  echo %%D| findstr /i /c:"\node_modules" /c:"\.git" >nul || call :dump "%%D"
)
exit /b

:dump
set "REL=%~1"
set "REL=!REL:%ROOT%=!"
>>"%OUT%" echo.
>>"%OUT%" echo == !REL! ==
set "ANY="
for %%F in ("%~1\*") do (
  set "ANY=1"
  >>"%OUT%" echo    %%~nxF ^| %%~zF B ^| %%~tF
)
if not defined ANY >>"%OUT%" echo    ^(empty^)
exit /b
