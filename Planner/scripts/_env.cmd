@echo off
rem ---------------------------------------------------------------------------
rem  _env.cmd - shared setup. Called by every other script, never run directly.
rem  Everything is derived from %~dp0 so the drive letter can be anything.
rem ---------------------------------------------------------------------------

for %%I in ("%~dp0..") do set "ROOT=%%~fI"

set "APPS=%ROOT%\apps"
set "PROJ=%ROOT%\projects\varler-planner"
set "DATA=%ROOT%\data"
set "UHOME=%ROOT%\home"

set "NODEDIR=%APPS%\node"
set "NODE=%NODEDIR%\node.exe"
set "NPM=%NODEDIR%\npm.cmd"
set "GITDIR=%APPS%\git\cmd"

rem portable node + git first on PATH, so npm and any tool that shells out finds them
set "PATH=%NODEDIR%;%GITDIR%;%PATH%"

rem keep npm's cache and config on the stick instead of the host's user profile
set "NPM_CONFIG_CACHE=%ROOT%\apps\.npm-cache"
set "NPM_CONFIG_USERCONFIG=%ROOT%\apps\.npmrc"
set "NPM_CONFIG_PREFIX=%NODEDIR%"

rem ---------------------------------------------------------------------------
rem  portable HOME
rem  Git reads .gitconfig, .ssh\ and bash history from HOME. Pointing it here
rem  keeps config and keys on the stick instead of C:\Users\<whoever>.
rem  Nothing inside apps\git is modified, so upgrading git changes nothing.
rem ---------------------------------------------------------------------------
if not exist "%UHOME%" md "%UHOME%"
set "HOME=%UHOME%"

rem ---------------------------------------------------------------------------
rem  Claude Code
rem  Auth token, session history and settings. Set explicitly rather than
rem  relying on HOME, because the CLI resolves its own config path separately.
rem ---------------------------------------------------------------------------
set "CLAUDE_CONFIG_DIR=%UHOME%\claude"
if not exist "%CLAUDE_CONFIG_DIR%" md "%CLAUDE_CONFIG_DIR%"

rem the browser: standalone Opera GX drops launcher.exe next to opera.exe
set "BROWSER=%APPS%\opera-gx\launcher.exe"
if not exist "%BROWSER%" set "BROWSER=%APPS%\opera-gx\opera.exe"

set "PLANNER=%PROJ%\dist\varler_planner.html"

rem gyro relay - change this if your relay listens somewhere else
set "GYRO_PORT=47291"

exit /b 0
