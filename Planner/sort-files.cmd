@echo off
rem ===========================================================================
rem  sort-files.cmd  -  put downloaded files where they belong
rem
rem  Put this file in C:\VARLER and run it. It asks for the folder your
rem  downloads are in, then COPIES each file to its correct place.
rem
rem  It copies, never moves - your download folder stays untouched, so you can
rem  run it again, or run it once per download folder.
rem
rem  Anything it doesn't recognise is listed at the end instead of guessed at.
rem ===========================================================================
setlocal enabledelayedexpansion
cd /d "%~dp0"
set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
set "PROJ=%ROOT%\projects\varler-planner"

if not exist "%PROJ%\src" (
  echo.
  echo   Can't find %PROJ%\src
  echo   Is sort-files.cmd in the VARLER root folder?
  echo.
  pause & exit /b 1
)

rem --- where are the downloads? ---------------------------------------------
set "SRC=%~1"
if "%SRC%"=="" (
  echo.
  echo   Drag the folder containing your downloaded files onto this window,
  echo   then press Enter. ^(Or type the full path.^)
  echo.
  set /p SRC=Folder:
)
set "SRC=%SRC:"=%"
if "%SRC:~-1%"=="\" set "SRC=%SRC:~0,-1%"

if not exist "%SRC%\" (
  echo.
  echo   Not a folder: %SRC%
  echo.
  pause & exit /b 1
)

echo.
echo   From: %SRC%
echo   To:   %ROOT%
echo.
set "go="
set /p go=Copy the files now? [y/N]:
if /i not "%go%"=="y" exit /b 0
echo.

set "LOG=%ROOT%\sort-files-log.txt"
> "%LOG%" echo sort-files  %DATE% %TIME%
>> "%LOG%" echo from: %SRC%
>> "%LOG%" echo.

set /a COPIED=0

rem --- 1. planner modules: every .js starting with a digit --------------------
call :grab "0*.js"  "%PROJ%\src"
call :grab "1*.js"  "%PROJ%\src"

rem --- 2. the HTML shell and the split metadata ------------------------------
call :grab "shell.html"   "%PROJ%\src"
call :grab "modules.json" "%PROJ%\src"

rem --- 3. the built app ------------------------------------------------------
call :grab "varler_planner.html" "%PROJ%\dist"

rem --- 4. tests --------------------------------------------------------------
call :grab "spec-*.js"        "%PROJ%\tests"
call :grab "run.js"           "%PROJ%\tests"
call :grab "fixtures.js"      "%PROJ%\tests"
call :grab "golden.js"        "%PROJ%\tests"
call :grab "golden.json"      "%PROJ%\tests"
call :grab "backup-smoke.js"  "%PROJ%\tests"

rem --- 5. docs ---------------------------------------------------------------
call :grab "ARCHITECTURE.md"                  "%PROJ%\docs"
call :grab "DECISIONS.md"                     "%PROJ%\docs"
call :grab "1.1_backlog.md"                   "%PROJ%\docs"
call :grab "browser_verification_checklist.md" "%PROJ%\docs"
call :grab "planner_1.0_review.md"            "%PROJ%\docs"
call :grab "CHANGELOG.md"                     "%PROJ%"

rem --- 6. PC-side tools and phone pages --------------------------------------
call :grab "manifest.js"            "%PROJ%\tools"
call :grab "phone-relay-server.js"  "%PROJ%\tools"
call :grab "phone-sender.html"      "%PROJ%\mobile"

rem --- 7. launchers ----------------------------------------------------------
call :grab "_env.cmd"     "%ROOT%\scripts"
call :grab "planner.cmd"  "%ROOT%\scripts"
call :grab "build.cmd"    "%ROOT%\scripts"
call :grab "test.cmd"     "%ROOT%\scripts"
call :grab "gyro.cmd"     "%ROOT%\scripts"
call :grab "shell.cmd"    "%ROOT%\scripts"
call :grab "manifest.cmd" "%ROOT%\scripts"
call :grab "START.cmd"    "%ROOT%"
call :grab "SETUP.md"     "%ROOT%"

rem --- 8. the three files that need telling apart ----------------------------
rem  build.js: keep only the one with the NNx-aware module pattern
if exist "%SRC%\build.js" (
  findstr /m /c:"MODULE_RE" "%SRC%\build.js" >nul 2>&1
  if errorlevel 1 (
    echo   SKIP  build.js          - old version, superseded
    >> "%LOG%" echo SKIP build.js  ^(old version^)
  ) else (
    call :one "build.js" "%PROJ%"
  )
)

rem  package.json: keep the one that lists the ws dependency
if exist "%SRC%\package.json" (
  findstr /m /c:"\"ws\"" "%SRC%\package.json" >nul 2>&1
  if errorlevel 1 (
    echo   SKIP  package.json      - old version, superseded
    >> "%LOG%" echo SKIP package.json  ^(old version^)
  ) else (
    call :one "package.json" "%PROJ%"
  )
)

rem  README.md: the pendrive one mentions the pendrive; the other is the repo's
if exist "%SRC%\README.md" (
  findstr /m /i /c:"pendrive" "%SRC%\README.md" >nul 2>&1
  if errorlevel 1 (
    call :one "README.md" "%PROJ%"
  ) else (
    call :one "README.md" "%ROOT%"
  )
)

rem --- 9. what didn't get used ----------------------------------------------
echo.
echo   ---------------------------------------------
echo   Copied !COPIED! files.
echo.
echo   Not recognised ^(left alone^):
set "ANY="
for %%F in ("%SRC%\*") do (
  findstr /x /c:"%%~nxF" "%LOG%" >nul 2>&1
  if errorlevel 1 (
    echo      %%~nxF
    set "ANY=1"
  )
)
if not defined ANY echo      ^(none - everything had a home^)

echo.
echo   Now check the module count:
echo      cd projects\varler-planner
echo      node build.js --list
echo.
pause
exit /b 0

rem ===========================================================================
:grab
rem  %1 = wildcard, %2 = destination folder
for %%F in ("%SRC%\%~1") do (
  if exist "%%F" call :one "%%~nxF" "%~2"
)
exit /b

:one
rem  %1 = filename, %2 = destination folder
if not exist "%~2\" mkdir "%~2" >nul 2>&1
if exist "%~2\%~1" (
  fc /b "%SRC%\%~1" "%~2\%~1" >nul 2>&1
  if not errorlevel 1 (
    echo   same  %~1
    >> "%LOG%" echo %~1
    exit /b
  )
  echo   OVERWRITE  %~1  ^(different version already there^)
)
copy /y "%SRC%\%~1" "%~2\" >nul
if errorlevel 1 (
  echo   FAILED  %~1
  >> "%LOG%" echo FAILED %~1
  exit /b
)
echo   ok    %~1
>> "%LOG%" echo %~1
set /a COPIED+=1
exit /b
