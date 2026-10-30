@echo off
:: vrg-launch.cmd MENU [vrg-ui args] - opens one launcher menu (start / backup / otg) from vrg-menu.json.
:: In the portable Windows Terminal (H:\VRG\Full\tools\terminal, profile VRG) when it is there; in this
:: console when it is not, when already inside a Windows Terminal, with --console or with VRG_CONSOLE=1.
:: H:\VRG\START.cmd / BACKUP.cmd / OTG.cmd and launcher\vrg-start.cmd forward here.
setlocal
:: paths first: shift below also shifts %0, so %~dp0 is only right up to here
set "UI=%~dp0vrg-ui.ps1"
for %%I in ("%~dp0..\..") do set "FULL=%%~fI"
set "MENU=%~1"
if not defined MENU set "MENU=start"
set "REST="
:collect
shift
if "%~1"=="" goto :collected
if /i "%~1"=="--console" (set "VRG_CONSOLE=1") else (set "REST=%REST% %1")
goto :collect
:collected
set "WT=%FULL%\tools\terminal\wt.exe"
if defined WT_SESSION goto :console
if defined VRG_CONSOLE goto :console
if not exist "%WT%" goto :console
start "" "%WT%" -w new -p "VRG" --title "VRG %MENU%" powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%UI%" -Menu %MENU%%REST%
if errorlevel 1 goto :console
exit /b 0

:console
:: QuickEdit off for new console windows: a click into the window otherwise freezes the key input.
reg add "HKCU\Console" /v QuickEdit /t REG_DWORD /d 0 /f >nul 2>&1
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%UI%" -Menu %MENU%%REST%
if errorlevel 1 pause
