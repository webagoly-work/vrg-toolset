@echo off
rem VRG Desktop (VRG Asztal): the frameless Electron window with the Dashboard and Desktop views.
rem Prefers the packaged "VRG Desktop.exe" (node Dashboard\tools\package.js builds it into ..\build\vrg-desktop);
rem without it, the portable electron.exe runs the same shell. Either way this checkout is the one that runs.
set "REPO=%~dp0.."
set "EXE=%~dp0..\..\build\vrg-desktop\VRG Desktop.exe"
if exist "%EXE%" (
  start "" "%EXE%" --repo "%REPO%" %*
  exit /b 0
)
set "EL=%~dp0..\..\tools\electron\electron.exe"
if not exist "%EL%" (
  echo Nincs Electron: %EL%
  echo START - K - F letolti. / Run START, K, F once to download it.
  pause
  exit /b 1
)
start "" "%EL%" "%~dp0shell" %*
