@echo off
rem VRG Desktop Dashboard (D1): the frameless Electron window. D5 gives it a START key, a tray icon and a hotkey.
set "EL=%~dp0..\..\tools\electron\electron.exe"
if not exist "%EL%" (
  echo Nincs Electron: %EL%
  echo START - K - F letolti. / Run START, K, F once to download it.
  pause
  exit /b 1
)
start "" "%EL%" "%~dp0shell"
