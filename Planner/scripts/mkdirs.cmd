@echo off
rem ---------------------------------------------------------------------------
rem  mkdirs.cmd - create any missing folders in the U100 tree.
rem
rem  Safe to run repeatedly. Nothing is overwritten, duplicated or emptied.
rem  Lives in scripts\ next to _env.cmd.
rem ---------------------------------------------------------------------------

call "%~dp0_env.cmd"

echo.
echo   ROOT = %ROOT%
echo.

if not defined UHOME goto :noenv

echo   Checking folder tree...
echo   ---------------------------------------------------------------

call :ensure "%UHOME%"           "home              portable HOME"
call :ensure "%UHOME%\claude"    "home\claude       Claude Code config"
call :ensure "%UHOME%\.ssh"      "home\.ssh         ssh keys"
call :ensure "%APPS%"            "apps              portable programs"
call :ensure "%APPS%\.npm-cache" "apps\.npm-cache   npm cache"
call :ensure "%DATA%"            "data              plans, scans, exports"
call :ensure "%DATA%\exports"    "data\exports      zip snapshots"
call :ensure "%ROOT%\tmp"        "tmp               scratch"

echo   ---------------------------------------------------------------
echo.
echo   Done. Nothing existing was modified.
echo.
pause
exit /b 0


:noenv
echo   ***************************************************************
echo   *  UHOME is not set.                                          *
echo   *                                                             *
echo   *  scripts\_env.cmd is the OLD version. Replace it with the    *
echo   *  merged one before running this, or the home tree will be    *
echo   *  created in the wrong place.                                *
echo   ***************************************************************
echo.
pause
exit /b 1


rem ---------------------------------------------------------------------------
rem  :ensure  <full path>  <label>
rem  Uses goto rather than if/else blocks, so parentheses or other special
rem  characters in the label cannot break the parser.
rem ---------------------------------------------------------------------------
:ensure
if "%~1"=="" goto :ensure_unset
if exist "%~1\" goto :ensure_ok
md "%~1" 2>nul
if exist "%~1\" goto :ensure_new
echo     [FAIL ] %~2
exit /b 0

:ensure_ok
echo     [ ok  ] %~2
exit /b 0

:ensure_new
echo     [ NEW ] %~2
exit /b 0

:ensure_unset
echo     [unset] %~2   - variable is empty, skipped
exit /b 0
