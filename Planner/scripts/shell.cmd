@echo off
call "%~dp0_env.cmd"
cd /d "%PROJ%"
title Varler - node + git
echo.
echo   ROOT = %ROOT%
node -v 2>nul && git --version 2>nul
echo.
cmd /k
