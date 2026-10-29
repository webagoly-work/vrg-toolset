@echo off
rem ServiceKit Kit Shell - portable environment.
rem Tools run from the kit and keep their caches and settings inside <kit>\data.
rem This is for clean working, NOT a security boundary. Use Sandboxie or Windows Sandbox for that.

set "KIT=%~dp0.."
for %%I in ("%KIT%") do set "KIT=%%~fI"
set "T=%KIT%\tools"
set "KITDATA=%KIT%\data"

if not exist "%KITDATA%\home" mkdir "%KITDATA%\home" >nul 2>&1
if not exist "%KITDATA%\npm-global" mkdir "%KITDATA%\npm-global" >nul 2>&1

set "HOME=%KITDATA%\home"
set "GIT_CONFIG_GLOBAL=%KITDATA%\home\.gitconfig"
set "npm_config_cache=%KITDATA%\npm-cache"
set "npm_config_prefix=%KITDATA%\npm-global"
set "PIP_CACHE_DIR=%KITDATA%\pip-cache"
set "PYTHONUSERBASE=%KITDATA%\python-user"
set "PYTHONDONTWRITEBYTECODE=1"
set "CLAUDE_CONFIG_DIR=%KITDATA%\claude"

set "KP=%KIT%\core\bin;%KITDATA%\npm-global"
for %%D in (
  "%T%\portablegit\cmd"
  "%T%\portablegit\mingw64\bin"
  "%T%\portablegit\usr\bin"
  "%T%\node"
  "%T%\python\tools"
  "%T%\python\tools\Scripts"
  "%T%\pwsh"
  "%T%\vscode\bin"
  "%T%\notepadpp"
  "%T%\sevenzip"
  "%T%\sysinternals"
  "%T%\putty"
  "%T%\esptool"
  "%T%\iperf3"
  "%T%\winmtr"
  "%T%\nirsoft-bsod"
  "%T%\produkey"
  "%T%\testdisk"
  "%T%\dosboxx"
) do if exist "%%~D\" call set "KP=%%KP%%;%%~D"

set "PATH=%KP%;%PATH%"
set "PROMPT=[ServiceKit] $P$G"
title ServiceKit Kit Shell
cd /d "%KIT%"

echo.
echo   ServiceKit Kit Shell   %KIT%
echo   ---------------------------------------------------------------
where git  >nul 2>&1 && echo   git      OK
where node >nul 2>&1 && echo   node/npm OK
where python >nul 2>&1 && echo   python   OK
where pwsh >nul 2>&1 && echo   pwsh     OK
where 7za  >nul 2>&1 && echo   7za      OK
echo   Settings and caches stay in: %KITDATA%
echo   Python venv:  python -m venv envs\name   then   envs\name\Scripts\activate
echo.
