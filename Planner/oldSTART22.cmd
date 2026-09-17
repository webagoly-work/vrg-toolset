@echo off
setlocal
title Varler
cd /d "%~dp0"

:menu
cls
echo.
echo   VARLER  -  %~d0  (%CD%)
echo   ---------------------------------------------
echo.
echo    1   Planner megnyitasa        (Opera GX portable)
echo    2   Build                     (src -^> dist)
echo    3   Tesztek
echo    4   Gyro relay + telefon cim
echo    5   VS Code
echo    6   Parancssor (node + git a PATH-on)
echo.
echo    0   Kilepes
echo.
set "c="
set /p c=Valassz:

if "%c%"=="1" call "%~dp0scripts\planner.cmd" & goto menu
if "%c%"=="2" call "%~dp0scripts\build.cmd"   & goto menu
if "%c%"=="3" call "%~dp0scripts\test.cmd"    & goto menu
if "%c%"=="4" call "%~dp0scripts\gyro.cmd"    & goto menu
if "%c%"=="5" start "" "%~dp0apps\vscode\Code.exe" "%~dp0projects\varler-planner" & goto menu
if "%c%"=="6" call "%~dp0scripts\shell.cmd"   & goto menu
if "%c%"=="0" exit /b 0
goto menu
