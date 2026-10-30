@echo off
setlocal EnableDelayedExpansion

:: ==========================================================================
::  Mobile\mobile.cmd - VRG Mobile, whose first feature is VRG Legeger (the phone as a gyro air mouse
::  and a Planner / Kodvaros controller). One place for its actions, so the launcher stays thin:
::    launcher\vrg-menu.json L) -> this file with one action word
::    no argument              -> its own menu
::
::  Actions:  relay  build  install  test  e2e  studio  readme  folder
::  Without an argument it shows the menu below.
::
::  The Android build needs a JDK 17+ and the Android SDK. Neither is part of
::  the portable kit: Android Studio brings both (its bundled JBR is found
::  automatically). The SDK location goes into android\local.properties,
::  which Android Studio writes on first open; when it is missing, this file
::  writes it from ANDROID_HOME / ANDROID_SDK_ROOT / %LOCALAPPDATA%\Android\Sdk.
::
::  2026-10-27 - first version.
::  2026-10-28 - 1) / relay starts the relay with --shots, so the phone can
::  ask for a screenshot of this PC. START.cmd G still starts it without.
:: ==========================================================================

set "AD=%~dp0"
if "%AD:~-1%"=="\" set "AD=%AD:~0,-1%"
for %%I in ("%AD%\..") do set "REPO=%%~fI"
set "ANDROID_DIR=%AD%\android"
set "NODE_EXE=%REPO%\..\tools\node\node.exe"
set "VSCODE_EXE=%REPO%\..\tools\vscode\Code.exe"
set "PLANNER_DIR=%REPO%\Planner\projects\varler-planner"
set "RELAY_JS=%PLANNER_DIR%\tools\phone-relay-server.js"
set "APK=%ANDROID_DIR%\app\build\outputs\apk\debug\app-debug.apk"

set "ONESHOT="
if "%~1"=="" goto MENU
set "ONESHOT=1"
set "ACT=%~1"
if /I "%ACT%"=="relay" goto DO_RELAY
if /I "%ACT%"=="build" goto DO_BUILD
if /I "%ACT%"=="install" goto DO_INSTALL
if /I "%ACT%"=="test" goto DO_TEST
if /I "%ACT%"=="e2e" goto DO_E2E
if /I "%ACT%"=="studio" goto DO_STUDIO
if /I "%ACT%"=="readme" goto DO_README
if /I "%ACT%"=="folder" goto DO_FOLDER
echo   Ismeretlen muvelet: %ACT%
echo   Lehet: relay build install test e2e studio readme folder
pause
exit /b 1

:: ================================ MENU =====================================
:MENU
cls
echo ============================================================
echo   VRG Mobile - tarsalkalmazas ^(elso funkcio: Legeger^)
echo   %AD%
echo ============================================================
echo.
echo   1^) Gyro relay inditasa  ^(kulon ablakban, port 47291, kepernyokeppel a telefonra^)
echo   2^) APK epitese          ^(gradlew assembleDebug - JDK 17 + Android SDK kell^)
echo   3^) Telepites a telefonra ^(adb install - USB hibakereses bekapcsolva^)
echo   4^) Core tesztek         ^(kit-core + airdeck-core - SDK nem kell^)
echo   5^) Relay e2e teszt      ^(Node + Playwright, a 47291 legyen szabad^)
echo   6^) Android Studio - a projekt megnyitasa
echo   7^) Leiras  ^(README.md^)
echo   M^) Mappa megnyitasa  ^(Mobile^)
echo   X^) Vissza
echo.
choice /C 1234567MX /N /M "Valasztas: "
set "LK=%ERRORLEVEL%"
if "%LK%"=="1" goto DO_RELAY
if "%LK%"=="2" goto DO_BUILD
if "%LK%"=="3" goto DO_INSTALL
if "%LK%"=="4" goto DO_TEST
if "%LK%"=="5" goto DO_E2E
if "%LK%"=="6" goto DO_STUDIO
if "%LK%"=="7" goto DO_README
if "%LK%"=="8" goto DO_FOLDER
exit /b 0

:DONE
if defined ONESHOT exit /b 0
goto MENU

:: =============================== ACTIONS ===================================
:DO_RELAY
if not exist "%NODE_EXE%" goto NO_NODE
if not exist "%RELAY_JS%" goto NO_RELAY
:: --shots: the phone may ask for a screenshot of this PC (Legeger camera button).
:: START.cmd G starts the same relay without it.
start "VRG 47291 - Gyro relay" /D "%PLANNER_DIR%" "%NODE_EXE%" "tools\phone-relay-server.js" --shots
echo.
echo   A relay kulon ablakban fut ^(VRG 47291^). A telefonon: Beallitasok -^> Kereses a halozaton.
ping -n 3 127.0.0.1 >nul 2>&1
goto DONE

:DO_BUILD
call :FIND_JAVA || goto DONE_PAUSE
call :FIND_SDK || goto DONE_PAUSE
echo.
echo   APK epitese... ^(az elso futas letolti a Gradle-t es a fuggosegeket^)
echo.
pushd "%ANDROID_DIR%"
call .\gradlew.bat assembleDebug
set "RC=%ERRORLEVEL%"
popd
echo.
if not "%RC%"=="0" echo   HIBA: az epites nem sikerult ^(kod %RC%^).
if "%RC%"=="0" echo   Kesz: !APK!
goto DONE_PAUSE

:DO_INSTALL
if not exist "%APK%" goto NO_APK
call :FIND_ADB || goto DONE_PAUSE
echo.
echo   Csatlakoztatott eszkozok:
"!ADB!" devices
echo   Telepites...
"!ADB!" install -r "%APK%"
goto DONE_PAUSE

:DO_TEST
call :FIND_JAVA || goto DONE_PAUSE
echo.
pushd "%ANDROID_DIR%"
:: kit-core and airdeck-core are plain Kotlin modules; --configure-on-demand keeps the Android
:: module out of it, so this runs without the Android SDK
call .\gradlew.bat --configure-on-demand :kit-core:test :airdeck-core:test
set "RC=%ERRORLEVEL%"
popd
echo.
if "%RC%"=="0" echo   Core tesztek: rendben.
if not "%RC%"=="0" echo   HIBA: core tesztek ^(kod %RC%^) - reszletek: android\kit-core es android\airdeck-core \build\reports\tests
goto DONE_PAUSE

:DO_E2E
if not exist "%NODE_EXE%" goto NO_NODE
if not exist "%PLANNER_DIR%\node_modules\ws" goto NO_WS
pushd "%REPO%"
rem QR pairing (WP M2): Node only, own port 47391, no Playwright needed
"%NODE_EXE%" "Mobile\tests\relay-pair.js"
"%NODE_EXE%" -e "require.resolve('playwright')" >nul 2>&1
if errorlevel 1 goto NO_PLAYWRIGHT
"%NODE_EXE%" "Mobile\tests\relay-e2e.js"
popd
goto DONE_PAUSE
:NO_PLAYWRIGHT
popd
echo.
echo   A Playwright nincs telepitve. A repo gyokereben egyszer:
echo     npm install --no-save playwright  es  npx playwright install chromium
goto DONE_PAUSE

:DO_STUDIO
set "STUDIO="
if exist "%ProgramFiles%\Android\Android Studio\bin\studio64.exe" set "STUDIO=%ProgramFiles%\Android\Android Studio\bin\studio64.exe"
if not defined STUDIO if exist "%LOCALAPPDATA%\Programs\Android Studio\bin\studio64.exe" set "STUDIO=%LOCALAPPDATA%\Programs\Android Studio\bin\studio64.exe"
if not defined STUDIO goto NO_STUDIO
start "" "!STUDIO!" "%ANDROID_DIR%"
goto DONE
:NO_STUDIO
echo.
echo   Az Android Studio nem talalhato. Letoltes: https://developer.android.com/studio
echo   Telepites utan: File -^> Open -^> %ANDROID_DIR%
goto DONE_PAUSE

:DO_README
if exist "%VSCODE_EXE%" start "" "%VSCODE_EXE%" "%AD%\README.md"
if not exist "%VSCODE_EXE%" start "" notepad.exe "%AD%\README.md"
goto DONE

:DO_FOLDER
start "" explorer.exe "%AD%"
goto DONE

:DONE_PAUSE
echo.
pause
goto DONE

:: =============================== ERRORS ====================================
:NO_NODE
echo   HIBA: nem talalhato a hordozhato Node: %NODE_EXE%
goto DONE_PAUSE
:NO_RELAY
echo   HIBA: nem talalhato: %RELAY_JS%
goto DONE_PAUSE
:NO_APK
echo.
echo   Meg nincs APK: %APK%
echo   Elobb: 2^) APK epitese.
goto DONE_PAUSE
:NO_WS
echo.
echo   A Planner node_modules hianyzik ^(ws^). A Planner mappaban egyszer: npm install
echo     %PLANNER_DIR%
goto DONE_PAUSE

:: =============================== FINDERS ===================================
:: No parenthesised blocks below: the candidate paths contain spaces, and a
:: path with a bracket in it would close a block early.

:FIND_JAVA
:: An HTTPS-scanning antivirus (Avast here) re-signs downloads with its own root, which Java's
:: cacerts does not know, so the Gradle download fails PKIX. The Windows store does know it.
if not defined JAVA_TOOL_OPTIONS set "JAVA_TOOL_OPTIONS=-Djavax.net.ssl.trustStoreType=Windows-ROOT"
if defined JAVA_HOME if exist "%JAVA_HOME%\bin\java.exe" exit /b 0
set "JAVA_HOME="
if exist "%ProgramFiles%\Android\Android Studio\jbr\bin\java.exe" set "JAVA_HOME=%ProgramFiles%\Android\Android Studio\jbr"
if not defined JAVA_HOME if exist "%LOCALAPPDATA%\Programs\Android Studio\jbr\bin\java.exe" set "JAVA_HOME=%LOCALAPPDATA%\Programs\Android Studio\jbr"
if not defined JAVA_HOME if exist "%REPO%\..\tools\jdk\bin\java.exe" set "JAVA_HOME=%REPO%\..\tools\jdk"
:: a portable Temurin unzipped next to the SDK, e.g. %LOCALAPPDATA%\Android\jdk-17.0.20.1+1
if not defined JAVA_HOME for /d %%D in ("%LOCALAPPDATA%\Android\jdk-17*") do if exist "%%D\bin\java.exe" set "JAVA_HOME=%%D"
if defined JAVA_HOME exit /b 0
where java >nul 2>&1 && exit /b 0
echo.
echo   HIBA: nincs Java ^(JDK 17+^). Telepitsd az Android Studiot ^(hozza a sajat JDK-jat^),
echo   vagy allitsd be a JAVA_HOME-ot.
exit /b 1

:FIND_SDK
if exist "%ANDROID_DIR%\local.properties" exit /b 0
set "SDK="
if defined ANDROID_HOME if exist "%ANDROID_HOME%\platforms" set "SDK=%ANDROID_HOME%"
if not defined SDK if defined ANDROID_SDK_ROOT if exist "%ANDROID_SDK_ROOT%\platforms" set "SDK=%ANDROID_SDK_ROOT%"
if not defined SDK if exist "%LOCALAPPDATA%\Android\Sdk\platforms" set "SDK=%LOCALAPPDATA%\Android\Sdk"
if not defined SDK goto NO_SDK
set "SDKF=!SDK:\=/!"
> "%ANDROID_DIR%\local.properties" echo sdk.dir=!SDKF!
echo   local.properties megirva: sdk.dir=!SDKF!
exit /b 0
:NO_SDK
echo.
echo   HIBA: nem talalom az Android SDK-t. A legegyszerubb: nyisd meg egyszer az
echo   Android Studioban ^(6^), az letolti az SDK-t es megirja a local.properties-t.
exit /b 1

:FIND_ADB
set "ADB="
if defined ANDROID_HOME if exist "%ANDROID_HOME%\platform-tools\adb.exe" set "ADB=%ANDROID_HOME%\platform-tools\adb.exe"
if not defined ADB if defined ANDROID_SDK_ROOT if exist "%ANDROID_SDK_ROOT%\platform-tools\adb.exe" set "ADB=%ANDROID_SDK_ROOT%\platform-tools\adb.exe"
if not defined ADB if exist "%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
if not defined ADB for /f "delims=" %%A in ('where adb 2^>nul') do if not defined ADB set "ADB=%%A"
if defined ADB exit /b 0
echo.
echo   HIBA: nincs adb. Az Android SDK platform-tools resze ^(Android Studio telepiti^).
echo   Vagy masold at az APK-t a telefonra, es ott nyisd meg: %APK%
exit /b 1
