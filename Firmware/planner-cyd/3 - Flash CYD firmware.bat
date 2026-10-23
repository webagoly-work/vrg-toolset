@echo off
title Planner CYD - flash firmware
setlocal
rem The portable arduino-cli lives next to the repo: <VRG-DE>\_libs\arduino-cli.
for %%I in ("%~dp0..\..\..\_libs\arduino-cli") do set "AC=%%~fI"
set "CLI=%AC%\bin\arduino-cli.exe"
set "CFG=%AC%\arduino-cli.yaml"
set "FQBN=esp32:esp32:esp32"
if not exist "%CLI%" (echo   arduino-cli not found: %CLI% & pause & exit /b 1)
echo.
echo   This REPLACES the firmware on the CYD (e.g. the Rocket League dashboard).
echo   Close any bridge or serial monitor that uses the port first.
echo   The RL firmware goes back with H:\others\RL-CYD-v2\Flash CYD firmware.bat
echo.
set "PORT=COM19"
set /p "PORT=  COM port [COM19]: "
if "%PORT%"=="" set "PORT=COM19"
echo.
echo   Compiling...
"%CLI%" compile --config-file "%CFG%" --fqbn %FQBN% --build-path "%AC%\build\planner_cyd" --output-dir "%~dp0firmware" "%~dp0source\planner_cyd"
if errorlevel 1 (echo. & echo   Compile failed. & pause & exit /b 1)
echo   Uploading to %PORT%...
"%CLI%" upload --config-file "%CFG%" --fqbn %FQBN% -p %PORT% --input-dir "%~dp0firmware" "%~dp0source\planner_cyd"
if errorlevel 1 (echo. & echo   Upload failed. Is the port right, and free?) else (echo. & echo   Done. The CYD restarts by itself.)
pause
