@echo off
setlocal EnableDelayedExpansion

:: ==========================================================================
::  VRG-DE.cmd - VRG Digital Environment
::
::  Egy kozponti belepesi pont mindenhez, ami a VARLER digitalis munkajahoz
::  tartozik. Nem a Planner a fo elem tobbe: a Planner egy projekt a sok
::  kozul, a VRG-DE az esernyo folottuk.
::
::  Szerkezet:
::    LEAD projektek     - amik keszek es hasznalatban vannak
::    UNDER-DEV          - amik meg formalodnak
::    Fejlesztoi eszkozok- amivel egy munkamenet elindul
::    Onallo programok   - minden telepitett/lefoglalt program a H: gyokerrol
::    Prompt konyvtar    - amit egy uj fejlesztonek kezre kell esnie
::
::  A muveletek (build, teszt, szerver) NEM kulon listaban vannak, hanem a
::  sajat projektjuk almenujeben, ahova tartoznak.
::
::  Drive-fuggetlen: minden utvonal ebbol a fajlbol szarmazik, igy ugyanugy
::  mukodik C:\VARLER alol vagy egy pendrive-rol.
::
::  Ez a fajl NEM valtja le a Planner\START.cmd-t, csak fole kerul. A regi
::  inditopult valtozatlanul mukodik; ha ez bevalik, a H:\Start.lnk
::  atiranyithato erre.
::
::  2026-09-21 - elso valtozat.
:: ==========================================================================

:: ------------------------------- GYOKEREK ---------------------------------
:: DE   = a VRG Digital Environment gyokere (ahol ez a fajl van)
:: APPS = a hordozhato programok
:: HROOT= a meghajto gyokere, egy szinttel feljebb (itt vannak a kulso mappak)
set "DE=%~dp0"
if "%DE:~-1%"=="\" set "DE=%DE:~0,-1%"
for %%I in ("%DE%\..") do set "HROOT=%%~fI"
:: a meghajto gyokere "H:\" alakban jon vissza, a zaro backslash-sel egyutt -
:: levagjuk, kulonben minden osszefuzes "H:\\_installers" lenne
if "%HROOT:~-1%"=="\" set "HROOT=%HROOT:~0,-1%"
set "PLANNER_DIR=%DE%\Planner\projects\varler-planner"
set "APPS=%DE%\Planner\apps"

:: ------------------------- KONZOL KELLEMETLENSEG --------------------------
:: A Windows konzol "mark" modba lep, ha belekattintasz, es onnantol a
:: billentyuk nem jutnak el a szkripthez. Ez kikapcsolja a QuickEdit-et a
:: kesobb nyilo ablakokra.
reg add "HKCU\Console" /v QuickEdit /t REG_DWORD /d 0 /f >nul 2>&1

:: ---------------------------- PROGRAM UTVONALAK ---------------------------
set "CHROME_EXE=%APPS%\chrome\chrome.exe"
set "OPERAGX_EXE=%APPS%\opera-gx\opera.exe"
set "ZEN_EXE=%APPS%\zen-browser\zen.exe"
set "VSCODE_EXE=%APPS%\vscode\Code.exe"
set "NODE_EXE=%APPS%\node\node.exe"
set "NPM_CMD=%APPS%\node\npm.cmd"
set "CLAUDE_CMD=%APPS%\node\claude.cmd"
set "GIT_EXE=%APPS%\git\bin\git.exe"
set "GITBASH_EXE=%APPS%\git\git-bash.exe"
set "KEYTWEAK_EXE=%APPS%\keytweak\KeyTweak.exe"
set "SEVENZIP_EXE=%APPS%\7zip\7zFM.exe"
set "CHROMEDRIVER_EXE=%APPS%\chromedriver\chromedriver.exe"

:: ------------------------------ ONLINE HELYEK -----------------------------
set "REPO_URL=https://github.com/webagoly-work/vrg-toolset"
set "REPO_ACCOUNT=webagoly-work"
set "GMAIL_URL=https://mail.google.com"
set "CLAUDE_URL=https://claude.ai/code"

:: ============================ PROJEKT REGISZTER ============================
:: Minden projekt: NEV, PATH (a DE gyokerhez kepest), es egy MENU cimke, ami
:: megmondja, melyik almenu tartozik hozza. Uj projekt felvetele: masold egy
:: blokkot, emeld a szamot, es novel a LEADCOUNT/DEVCOUNT erteket.

:: -- LEAD --
set "L1_NAME=Varler Planner"
set "L1_PATH=Planner\projects\varler-planner\dist\varler_planner.html"
set "L1_MENU=PLANNER"

set "L2_NAME=VRG MindMap"
set "L2_PATH=MindMap\vrg_mindmap.html"
set "L2_MENU=MINDMAP"

set "L3_NAME=VRG Keszlet / Inventory"
set "L3_PATH=Inventory\dist\vrg-inventory.html"
set "L3_MENU=INVENTORY"

set "L4_NAME=VRG BuildTree (modder)"
set "L4_PATH=Modder\vrg-buildtree.html"
set "L4_MENU=PLAIN"

set "LEADCOUNT=4"

:: -- UNDER-DEV --
set "D1_NAME=Kalkulator (osszevonas alatt)"
set "D1_PATH="
set "D1_MENU=CALC"

set "D2_NAME=Valena termekcsalad valaszto"
set "D2_PATH=Toolbox\valena-life-szerelvenytervezo.html"
set "D2_MENU=VALENA"

set "D3_NAME=Gyro relay szerver"
set "D3_PATH="
set "D3_MENU=GYRO"

set "D4_NAME=Toolbox (mini eszkozok, kiserletek)"
set "D4_PATH=toolbox.html"
set "D4_MENU=PLAIN"

set "D5_NAME=VRG Vendor (kulso komponensek)"
set "D5_PATH=vrg-vendor.html"
set "D5_MENU=VENDOR"

set "DEVCOUNT=5"

:: -- a Kalkulator reszei, amig kulon fajlok --
set "C1_NAME=Panel anyagar kalkulator (varlerAron)"
set "C1_PATH=Calculator\panel_anyagar_kalkulator.html"
set "C2_NAME=Altalanos villanyszereloi kalkulator"
set "C2_PATH=Calculator\Altalanos_Villanyszerelui_Kalkulator.html"
set "C3_NAME=LED arkalkulator (varlerAron)"
set "C3_PATH=Calculator\led_arkalkulator.html"
set "CALCCOUNT=3"

goto MAIN

:: ================================ FOMENU ===================================
:MAIN
cls
echo ===============================================================
echo    V R G   D I G I T A L   E N V I R O N M E N T
echo    %DE%
echo ===============================================================
echo.
echo  -- LEAD projektek --
for /L %%i in (1,1,%LEADCOUNT%) do echo    L%%i^) !L%%i_NAME!
echo.
echo  -- UNDER-DEV projektek --
for /L %%i in (1,1,%DEVCOUNT%) do echo    D%%i^) !D%%i_NAME!
echo.
echo  -- Fejlesztoi eszkozok / munkamenet --
echo    C^) Claude Code inditasa           V^) VS Code
echo    G^) GitHub megnyitasa              N^) Naplo ^(utolso valtozasok^)
echo    R^) Repo ellenorzes + pull request
echo    Z^) Zen munkamenet ^(elore nyitott lapokkal^)
echo.
echo  -- Egyeb --
echo    P^) Onallo programok               K^) Prompt konyvtar
echo    X^) VRG-DE ellenorzes ^(minden utvonal^)
echo.
echo    Q^) Kilepes
echo.
set /p "CH=Valasztas: "

if /I "%CH%"=="Q" exit /b 0
if /I "%CH%"=="C" goto DEV_CLAUDE
if /I "%CH%"=="V" goto DEV_VSCODE
if /I "%CH%"=="G" goto DEV_GITHUB
if /I "%CH%"=="N" goto DEV_LOG
if /I "%CH%"=="R" goto DEV_REPO
if /I "%CH%"=="Z" goto DEV_ZEN
if /I "%CH%"=="P" goto PROGRAMS
if /I "%CH%"=="K" goto PROMPTS
if /I "%CH%"=="X" goto SELFCHECK

:: FIGYELEM: a goto SOHA nem ugrik ki egy for-blokkbol ebben a fajlban.
:: A cmd ilyenkor elveszti a fajlban a helyet, es kesobb "The system cannot
:: find the batch label specified" hibaval all meg egy olyan cimkere, ami
:: pedig letezik. Ezert a ciklus csak beallit egy jelzot, es az ugras utana
:: tortenik, a blokkon kivul.
set "SEL_FOUND="
for /L %%i in (1,1,%LEADCOUNT%) do (
    if /I "%CH%"=="L%%i" (
        set "SEL_NAME=!L%%i_NAME!"
        set "SEL_PATH=!L%%i_PATH!"
        set "SEL_MENU=!L%%i_MENU!"
        set "SEL_TAG=LEAD"
        set "SEL_FOUND=1"
    )
)
if defined SEL_FOUND goto PROJECT

for /L %%i in (1,1,%DEVCOUNT%) do (
    if /I "%CH%"=="D%%i" (
        set "SEL_NAME=!D%%i_NAME!"
        set "SEL_PATH=!D%%i_PATH!"
        set "SEL_MENU=!D%%i_MENU!"
        set "SEL_TAG=UNDER-DEV"
        set "SEL_FOUND=1"
    )
)
if defined SEL_FOUND goto PROJECT

echo.
echo   Nem ervenyes valasztas.
ping -n 2 127.0.0.1 >/dev/null 2>&1
goto MAIN

:: ============================ PROJEKT ALMENU ===============================
:: Itt jelennek meg a muveletek, a sajat projektjuk alatt - nem egy kozos
:: listaban a menu aljan.
:PROJECT
cls
echo ===============================================================
echo    %SEL_NAME%
echo    [%SEL_TAG%]
echo ===============================================================
echo.
if defined SEL_PATH (
    if exist "%DE%\%SEL_PATH%" (
        echo    O^) Megnyitas bongeszoben
    ) else (
        echo    ^(!^) A fajl nem talalhato: %SEL_PATH%
    )
)

if "%SEL_MENU%"=="PLANNER" (
    echo    B^) Build          ^(npm run build^)
    echo    T^) Teszt          ^(npm test^)
    echo    M^) Manifest iras  ^(docs\MANIFEST.md^)
    echo    E^) Projekt megnyitasa VS Code-ban
)
if "%SEL_MENU%"=="INVENTORY" (
    echo    B^) Build          ^(npm run build^)
    echo    T^) Teszt          ^(npm test^)
    echo    S^) Helyi szerver  ^(npm run serve - 8123^)
    echo    A^) Arellenorzes   ^(npm run pricecheck - halozat kell^)
    echo    E^) Projekt megnyitasa VS Code-ban
)
if "%SEL_MENU%"=="MINDMAP" (
    echo    S^) Helyi szerver  ^(8124 - localStorage teszteleshez kell^)
    echo    E^) Mappa megnyitasa VS Code-ban
)
if "%SEL_MENU%"=="VENDOR" (
    echo    L^) Komponensek listazasa
    echo    F^) Komponensek letoltese ^(halozat kell^)
    echo    Y^) Oldal szinkronizalasa a manifesttel
)
if "%SEL_MENU%"=="CALC" (
    echo    Ez a projekt meg nem egy program, hanem harom kulon fajl.
    echo    A cel: egy Kalkulator, ami mindharmat magaba olvasztja.
    echo.
    for /L %%i in (1,1,%CALCCOUNT%) do echo    %%i^) !C%%i_NAME!
    echo.
    echo    JEGYZET: az osszevonas elott ossze kell hasonlitani mas online
    echo    kalkulatorokkal, es a chat-ben folyo kutatast is be kell emelni.
)
if "%SEL_MENU%"=="VALENA" (
    echo.
    echo    JEGYZET: ebbol onallo szerelvenytervezo lesz. A cel, hogy tobb
    echo    gyarto termekeit tudja importalni gyartoi cikkszam alapjan, a
    echo    specifikaciokkal egyutt - ez kesobb a Planner es az Inventory
    echo    tetelkezeleset is javitja. Addig UNDER-DEV.
)
if "%SEL_MENU%"=="GYRO" (
    echo    S^) Relay szerver inditasa
    echo.
    echo    JEGYZET: a telefon giroszkopjat koti a Plannerhez. Amig nincs
    echo    stabil, UNDER-DEV.
)
echo.
echo    0^) Vissza a fomenube
echo.
set /p "PCH=Valasztas: "

if "%PCH%"=="0" goto MAIN
if /I "%PCH%"=="O" (
    if defined SEL_PATH ( call :OPEN_IN_BROWSER "%DE%\%SEL_PATH%" "%SEL_NAME%" ) else ( call :NOFILE )
    goto PROJECT
)

if "%SEL_MENU%"=="PLANNER" (
    if /I "%PCH%"=="B" ( call :RUN_NPM "%PLANNER_DIR%" run build & goto PROJECT )
    if /I "%PCH%"=="T" ( call :RUN_NPM "%PLANNER_DIR%" test & goto PROJECT )
    if /I "%PCH%"=="M" ( call :DO_MANIFEST & goto PROJECT )
    if /I "%PCH%"=="E" ( call :OPEN_VSCODE "%PLANNER_DIR%" & goto PROJECT )
)
if "%SEL_MENU%"=="INVENTORY" (
    if /I "%PCH%"=="B" ( call :RUN_NPM "%DE%\Inventory" run build & goto PROJECT )
    if /I "%PCH%"=="T" ( call :RUN_NPM "%DE%\Inventory" test & goto PROJECT )
    if /I "%PCH%"=="S" ( call :RUN_SERVER "%DE%\Inventory" "npm run serve" & goto PROJECT )
    if /I "%PCH%"=="A" ( call :RUN_NPM "%DE%\Inventory" run pricecheck & goto PROJECT )
    if /I "%PCH%"=="E" ( call :OPEN_VSCODE "%DE%\Inventory" & goto PROJECT )
)
if "%SEL_MENU%"=="MINDMAP" (
    if /I "%PCH%"=="S" ( call :RUN_NODE_SERVER "%DE%" "MindMap\serve.js" 8124 & goto PROJECT )
    if /I "%PCH%"=="E" ( call :OPEN_VSCODE "%DE%\MindMap" & goto PROJECT )
)
if "%SEL_MENU%"=="VENDOR" (
    if /I "%PCH%"=="L" ( call :VENDOR_RUN --list & goto PROJECT )
    if /I "%PCH%"=="F" ( call :VENDOR_RUN --all & goto PROJECT )
    if /I "%PCH%"=="Y" ( call :VENDOR_RUN --sync-page & goto PROJECT )
)
if "%SEL_MENU%"=="GYRO" (
    if /I "%PCH%"=="S" ( call :DO_GYRO & goto PROJECT )
)
if "%SEL_MENU%"=="CALC" (
    set "CSEL="
    for /L %%i in (1,1,%CALCCOUNT%) do if "%PCH%"=="%%i" (
        set "CSEL_PATH=!C%%i_PATH!"
        set "CSEL_NAME=!C%%i_NAME!"
        set "CSEL=1"
    )
)
if defined CSEL (
    call :OPEN_IN_BROWSER "%DE%\%CSEL_PATH%" "%CSEL_NAME%"
    set "CSEL="
    goto PROJECT
)

echo   Nem ervenyes valasztas.
ping -n 2 127.0.0.1 >/dev/null 2>&1
goto PROJECT

:: ========================= FEJLESZTOI ESZKOZOK =============================
:DEV_CLAUDE
cls
echo   Claude Code inditasa
echo.
if not exist "%CLAUDE_CMD%" (
    echo   HIBA: nem talalhato: %CLAUDE_CMD%
    pause
    goto MAIN
)
echo   Melyik mappaban induljon?
echo     1^) VRG-DE gyoker ^(%DE%^)   - ajanlott, latja az egeszet
echo     2^) Planner projekt
echo     3^) Inventory projekt
echo     0^) Vissza
echo.
set /p "CC=Valasztas: "
if "%CC%"=="0" goto MAIN
set "CDIR="
if "%CC%"=="1" set "CDIR=%DE%"
if "%CC%"=="2" set "CDIR=%PLANNER_DIR%"
if "%CC%"=="3" set "CDIR=%DE%\Inventory"
if not defined CDIR goto DEV_CLAUDE
start "Claude Code" /D "%CDIR%" cmd /k call "%CLAUDE_CMD%"
goto MAIN

:DEV_VSCODE
cls
echo   VS Code
echo.
echo     1^) Teljes VRG-DE ^(repo gyoker^)
echo     2^) Planner projekt
echo     3^) Inventory projekt
echo     0^) Vissza
echo.
set /p "VC=Valasztas: "
if "%VC%"=="0" goto MAIN
if "%VC%"=="1" call :OPEN_VSCODE "%DE%"
if "%VC%"=="2" call :OPEN_VSCODE "%PLANNER_DIR%"
if "%VC%"=="3" call :OPEN_VSCODE "%DE%\Inventory"
goto MAIN

:DEV_GITHUB
cls
echo   GitHub
echo.
echo   Repo:   %REPO_URL%
echo   Fiok:   %REPO_ACCOUNT%
echo.
echo   Ezt a repot a masodik GitHub fiokoddal tartod karban, nem a
echo   szemelyes fiokkal. A hitelesites egy fine-grained PAT-tal megy
echo   ^(Contents: read/write^), amit a Git Credential Manager tarol.
echo   Ha a push jelszot ker, az a PAT - nem a GitHub jelszavad.
echo.
echo     1^) Repo megnyitasa bongeszoben
echo     2^) Pull requestek listaja
echo     3^) Git Bash a repo gyokereben
echo     0^) Vissza
echo.
set /p "GC=Valasztas: "
if "%GC%"=="0" goto MAIN
if "%GC%"=="1" start "" "%REPO_URL%"
if "%GC%"=="2" start "" "%REPO_URL%/pulls"
if "%GC%"=="3" (
    if exist "%GITBASH_EXE%" ( start "" "%GITBASH_EXE%" --cd="%DE%" ) else ( echo   HIBA: nincs git-bash.exe & pause )
)
goto MAIN

:DEV_LOG
cls
echo ===============================================================
echo    NAPLO - mi tortent utoljara a VRG-DE-ben
echo ===============================================================
echo.
call :CHECK_GIT || goto MAIN
pushd "%DE%"
"%GIT_EXE%" log -n 15 --date=short --pretty=format:"  %%ad  %%s"
echo.
echo.
echo   --- Ami meg nincs elmentve ^(working tree^) ---
"%GIT_EXE%" status --short
popd
echo.
pause
goto MAIN

:DEV_REPO
cls
echo ===============================================================
echo    REPO ELLENORZES
echo ===============================================================
echo.
call :CHECK_GIT || goto MAIN
pushd "%DE%"
echo   Aktualis ag:
for /f "delims=" %%B in ('"%GIT_EXE%" rev-parse --abbrev-ref HEAD') do set "BRANCH=%%B"
echo     !BRANCH!
echo.
echo   Frissites a tavoli allapotrol...
"%GIT_EXE%" fetch --quiet origin
echo.
echo   Eltres a tavolihoz kepest ^(ahead / behind^):
"%GIT_EXE%" rev-list --left-right --count origin/!BRANCH!...!BRANCH! 2>nul
echo     ^(bal = tavoli elonye, jobb = helyi elonye^)
echo.
echo   Nem mentett valtozasok:
"%GIT_EXE%" status --short
echo.
echo   Eszkoz-regiszter ellenorzes:
if exist "%NODE_EXE%" ( "%NODE_EXE%" "%DE%\tools\check-start.js" ) else ( echo     ^(nincs node^) )
popd
echo.
echo ---------------------------------------------------------------
echo     1^) Helyi commitok feltoltese ^(git push^)
echo     2^) Pull request nyitasa ehhez az aghoz ^(bongeszo^)
echo     0^) Vissza
echo.
set /p "RC=Valasztas: "
if "%RC%"=="0" goto MAIN
if "%RC%"=="1" (
    pushd "%DE%"
    "%GIT_EXE%" push origin !BRANCH!
    popd
    echo.
    pause
    goto DEV_REPO
)
if "%RC%"=="2" (
    if /I "!BRANCH!"=="main" (
        echo.
        echo   A main agon vagy - pull requestet agrol szokas nyitni.
        echo   Elobb hozz letre egy agat:  git checkout -b valami-nev
        echo.
        pause
        goto DEV_REPO
    )
    start "" "%REPO_URL%/compare/main...!BRANCH!?expand=1"
    goto DEV_REPO
)
goto DEV_REPO

:: --------------------------- ZEN MUNKAMENET -------------------------------
:DEV_ZEN
cls
echo ===============================================================
echo    ZEN MUNKAMENET
echo ===============================================================
echo.
if not exist "%ZEN_EXE%" (
    echo   HIBA: nem talalhato a Zen: %ZEN_EXE%
    pause
    goto MAIN
)
echo   MEGJEGYZES: a Zen mappait ^(tab folders^) nem lehet parancssorbol
echo   letrehozni - az a felulet sajatja. Amit itt kapsz: kulon ABLAK
echo   csoportonkent, a lapok mar megnyitva benne. A Zen-ben utana egy
echo   mozdulattal mappaba huzhatod oket.
echo.
echo     1^) Online munkahely  ^(Gmail + GitHub + Claude^)
echo     2^) LEAD projektek elonezete   ^(4 lap egy ablakban^)
echo     3^) UNDER-DEV elonezet         ^(kulon ablakban^)
echo     4^) Mind a harom egyszerre
echo     0^) Vissza
echo.
set /p "ZC=Valasztas: "
if "%ZC%"=="0" goto MAIN
if "%ZC%"=="1" ( call :ZEN_ONLINE & goto MAIN )
if "%ZC%"=="2" ( call :ZEN_LEAD & goto MAIN )
if "%ZC%"=="3" ( call :ZEN_DEV & goto MAIN )
if "%ZC%"=="4" (
    call :ZEN_ONLINE
    call :ZEN_LEAD
    call :ZEN_DEV
    goto MAIN
)
goto DEV_ZEN

:ZEN_ONLINE
echo   Online lapok nyitasa...
start "" "%ZEN_EXE%" -new-window "%GMAIL_URL%"
call :ZWAIT
start "" "%ZEN_EXE%" -new-tab "%REPO_URL%"
start "" "%ZEN_EXE%" -new-tab "%CLAUDE_URL%"
exit /b 0

:ZEN_LEAD
echo   LEAD elonezet nyitasa...
set "FIRST=1"
for /L %%i in (1,1,%LEADCOUNT%) do (
    if exist "%DE%\!L%%i_PATH!" (
        if "!FIRST!"=="1" (
            start "" "%ZEN_EXE%" -new-window "%DE%\!L%%i_PATH!"
            set "FIRST=0"
            call :ZWAIT
        ) else (
            start "" "%ZEN_EXE%" -new-tab "%DE%\!L%%i_PATH!"
        )
    )
)
exit /b 0

:ZEN_DEV
echo   UNDER-DEV elonezet nyitasa...
set "FIRST=1"
for /L %%i in (1,1,%DEVCOUNT%) do (
    if defined D%%i_PATH (
        if exist "%DE%\!D%%i_PATH!" (
            if "!FIRST!"=="1" (
                start "" "%ZEN_EXE%" -new-window "%DE%\!D%%i_PATH!"
                set "FIRST=0"
                call :ZWAIT
            ) else (
                start "" "%ZEN_EXE%" -new-tab "%DE%\!D%%i_PATH!"
            )
        )
    )
)
:: a Kalkulator reszei is ide tartoznak, amig kulon fajlok
for /L %%i in (1,1,%CALCCOUNT%) do (
    if exist "%DE%\!C%%i_PATH!" start "" "%ZEN_EXE%" -new-tab "%DE%\!C%%i_PATH!"
)
exit /b 0

:: A Zen-nek kell egy pillanat, amig az elso ablak felall; addig a
:: -new-tab hivasok elvesznenek.
:ZWAIT
ping -n 4 127.0.0.1 >/dev/null 2>&1
exit /b 0

:: =========================== ONALLO PROGRAMOK ==============================
:PROGRAMS
cls
echo ===============================================================
echo    ONALLO PROGRAMOK
echo    %APPS%
echo ===============================================================
echo.
call :PLINE 1 "Chrome"            "%CHROME_EXE%"
call :PLINE 2 "Opera GX"          "%OPERAGX_EXE%"
call :PLINE 3 "Zen browser"       "%ZEN_EXE%"
call :PLINE 4 "VS Code"           "%VSCODE_EXE%"
call :PLINE 5 "Git Bash"          "%GITBASH_EXE%"
call :PLINE 6 "KeyTweak"          "%KEYTWEAK_EXE%"
call :PLINE 7 "7-Zip"             "%SEVENZIP_EXE%"
call :PLINE 8 "Node (konzol)"      "%NODE_EXE%"
call :PLINE 9 "ChromeDriver"      "%CHROMEDRIVER_EXE%"
echo.
echo    I^) Telepitok mappa ^(%HROOT%\_installers^)
echo    W^) wifi-heatmapper mappa
echo    0^) Vissza
echo.
set /p "PR=Valasztas: "
if "%PR%"=="0" goto MAIN
if "%PR%"=="1" call :LAUNCH "%CHROME_EXE%"
if "%PR%"=="2" call :LAUNCH "%OPERAGX_EXE%"
if "%PR%"=="3" call :LAUNCH "%ZEN_EXE%"
if "%PR%"=="4" call :LAUNCH "%VSCODE_EXE%"
if "%PR%"=="5" call :LAUNCH "%GITBASH_EXE%"
if "%PR%"=="6" call :LAUNCH "%KEYTWEAK_EXE%"
if "%PR%"=="7" call :LAUNCH "%SEVENZIP_EXE%"
if "%PR%"=="8" (
    if exist "%NODE_EXE%" ( start "Node" cmd /k ""%NODE_EXE%" --version & echo Node konzol. Kilepes: exit" ) else ( call :NOPROG )
)
if "%PR%"=="9" call :LAUNCH "%CHROMEDRIVER_EXE%"
if /I "%PR%"=="I" start "" explorer "%HROOT%\_installers"
if /I "%PR%"=="W" start "" explorer "%HROOT%\wifi-heatmapper"
goto PROGRAMS

:: Egy sor a programlistaban, a tenyleges allapottal.
:: Ugyanaz a zarojel-csapda, mint a :CKLINE-nal - lasd az ottani megjegyzest.
:PLINE
set "_i=%~1"
set "_n=%~2"
if exist "%~3" goto PLINE_OK
echo    !_i!^) !_n!   [nincs telepitve - lefoglalt hely]
exit /b 0
:PLINE_OK
echo    !_i!^) !_n!
exit /b 0

:LAUNCH
if not exist "%~1" ( call :NOPROG & exit /b 0 )
start "" "%~1"
exit /b 0

:NOPROG
echo.
echo   Ez a program nincs telepitve, csak a helye van fenntartva.
echo   A telepitok itt vannak: %HROOT%\_installers
echo.
pause
exit /b 0

:: ============================ PROMPT KONYVTAR ==============================
:PROMPTS
cls
echo ===============================================================
echo    PROMPT KONYVTAR
echo    Amit erdemes kezre esnie egy munkamenet kozben.
echo ===============================================================
echo.
set "PDIR=%DE%\tools\prompts"
if not exist "%PDIR%" (
    echo   HIBA: nincs meg a prompt mappa: %PDIR%
    pause
    goto MAIN
)
set "PN=0"
for %%F in ("%PDIR%\*.txt") do (
    set /a PN+=1
    set "P!PN!_FILE=%%~fF"
    set "P!PN!_NAME=%%~nF"
    echo    !PN!^) %%~nF
)
echo.
echo    A valasztott prompt megjelenik, es a vagolapra is kerul.
echo    0^) Vissza
echo.
set /p "PC=Valasztas: "
if "%PC%"=="0" goto MAIN
:: a valasztast a ciklus csak kijeloli; az ugras a blokkon kivul tortenik
set "PFILE="
for /L %%i in (1,1,%PN%) do if "%PC%"=="%%i" set "PFILE=!P%%i_FILE!"
if not defined PFILE goto PROMPTS
cls
type "%PFILE%"
echo.
echo ---------------------------------------------------------------
type "%PFILE%" | clip
echo   [a vagolapra masolva]
echo.
pause
goto PROMPTS

:: ============================== ONELLENORZES ===============================
:SELFCHECK
cls
echo ===============================================================
echo    VRG-DE ELLENORZES
echo ===============================================================
echo.
echo   LEAD projektek:
for /L %%i in (1,1,%LEADCOUNT%) do call :CKLINE "!L%%i_NAME!" "!L%%i_PATH!"
echo.
echo   UNDER-DEV projektek:
for /L %%i in (1,1,%DEVCOUNT%) do call :CKLINE "!D%%i_NAME!" "!D%%i_PATH!"
echo.
echo   Kalkulator reszei:
for /L %%i in (1,1,%CALCCOUNT%) do call :CKLINE "!C%%i_NAME!" "!C%%i_PATH!"
echo.
echo   Programok:
call :CKPROG "Chrome" "%CHROME_EXE%"
call :CKPROG "Opera GX" "%OPERAGX_EXE%"
call :CKPROG "Zen" "%ZEN_EXE%"
call :CKPROG "VS Code" "%VSCODE_EXE%"
call :CKPROG "Node" "%NODE_EXE%"
call :CKPROG "Git" "%GIT_EXE%"
call :CKPROG "Claude Code" "%CLAUDE_CMD%"
echo.
echo   A regi inditopult ^(Planner\START.cmd^) kulon ellenorzese:
if exist "%NODE_EXE%" ( "%NODE_EXE%" "%DE%\tools\check-start.js" ) else ( echo     ^(nincs node^) )
echo.
pause
goto MAIN

:: FIGYELEM: ezek a segedek NEM hasznalnak zarojeles blokkot, es a nevet
:: !valtozobol! irjak ki, nem %~1-bol. Egy nev, amiben zarojel van - mint a
:: "VRG BuildTree (modder)" - a %~1 behelyettesitesekor bezarna a blokkot,
:: mert az a blokk ertelmezese ELOTT tortenik. A !delayed! kifejtes utana
:: jon, ezert az biztonsagos.
:CKLINE
set "_n=%~1"
set "_p=%~2"
if not defined _p goto CKLINE_NONE
if exist "%DE%\%_p%" goto CKLINE_OK
echo     HIANYZIK !_n!  -^> !_p!
exit /b 0
:CKLINE_OK
echo     ok       !_n!
exit /b 0
:CKLINE_NONE
echo     -        !_n!   [nincs onallo fajlja]
exit /b 0

:CKPROG
set "_n=%~1"
if exist "%~2" goto CKPROG_OK
echo     nincs    !_n!
exit /b 0
:CKPROG_OK
echo     ok       !_n!
exit /b 0

:: ================================ SEGEDEK ==================================
:OPEN_IN_BROWSER
:: %1 = teljes utvonal, %2 = megjelenito nev
set "TFULL=%~1"
set "TNAME=%~2"
if not exist "%TFULL%" ( call :NOFILE & exit /b 0 )
:BROWSER_MENU
cls
echo   Megnyitas: %TNAME%
echo   %TFULL%
echo.
echo     1^) Chrome        2^) Opera GX      3^) Zen
echo     4^) Rendszer alapertelmezett
echo     0^) Vissza
echo.
set /p "BC=Bongeszo: "
if "%BC%"=="0" exit /b 0
if "%BC%"=="1" ( call :BOPEN "%CHROME_EXE%" "--new-window" & exit /b 0 )
if "%BC%"=="2" ( call :BOPEN "%OPERAGX_EXE%" "" & exit /b 0 )
if "%BC%"=="3" ( call :BOPEN "%ZEN_EXE%" "-new-window" & exit /b 0 )
if "%BC%"=="4" ( start "" "%TFULL%" & exit /b 0 )
goto BROWSER_MENU

:BOPEN
if not exist "%~1" (
    echo.
    echo   HIBA: nem talalhato a bongeszo: %~1
    echo.
    pause
    exit /b 0
)
if "%~2"=="" ( start "" "%~1" "%TFULL%" ) else ( start "" "%~1" %~2 "%TFULL%" )
exit /b 0

:NOFILE
echo.
echo   Ehhez a bejegyzeshez nincs megnyithato fajl.
echo   Ha ez hibanak tunik, futtasd a fomenubol az X^) ellenorzest.
echo.
pause
exit /b 0

:OPEN_VSCODE
if not exist "%VSCODE_EXE%" (
    echo   HIBA: nem talalhato a VS Code: %VSCODE_EXE%
    pause
    exit /b 0
)
if not exist "%~1" (
    echo   HIBA: nem talalhato a mappa: %~1
    pause
    exit /b 0
)
start "" "%VSCODE_EXE%" "%~1"
exit /b 0

:CHECK_NODE
if not exist "%NODE_EXE%" ( echo   HIBA: nincs hordozhato Node: %NODE_EXE% & pause & exit /b 1 )
if not exist "%NPM_CMD%" ( echo   HIBA: nincs npm: %NPM_CMD% & pause & exit /b 1 )
exit /b 0

:CHECK_GIT
if not exist "%GIT_EXE%" ( echo   HIBA: nincs git: %GIT_EXE% & pause & exit /b 1 )
exit /b 0

:: npm parancs futtatasa egy mappaban. Hasznalat: call :RUN_NPM "<mappa>" run build
:RUN_NPM
call :CHECK_NODE || exit /b 0
set "WDIR=%~1"
if not exist "%WDIR%\package.json" (
    echo   HIBA: nincs package.json itt: %WDIR%
    pause
    exit /b 0
)
shift
pushd "%WDIR%"
call "%NPM_CMD%" %1 %2 %3
popd
echo.
pause
exit /b 0

:RUN_SERVER
call :CHECK_NODE || exit /b 0
echo.
echo   Szerver indul. Leallitas: Ctrl+C.
echo.
pushd "%~1"
call "%NPM_CMD%" run serve
popd
echo.
pause
exit /b 0

:RUN_NODE_SERVER
:: %1 = munkamappa, %2 = szkript, %3 = port
call :CHECK_NODE || exit /b 0
if not exist "%~1\%~2" (
    echo   HIBA: nincs meg a szkript: %~1\%~2
    pause
    exit /b 0
)
echo.
echo   Szerver indul a http://localhost:%~3 cimen. Leallitas: Ctrl+C.
echo   ^(localStorage csak igazi origin alatt mukodik, file:// alol nem^)
echo.
pushd "%~1"
"%NODE_EXE%" "%~2"
popd
echo.
pause
exit /b 0

:VENDOR_RUN
call :CHECK_NODE || exit /b 0
set "FV=%DE%\tools\fetch-vendor.js"
if not exist "%FV%" ( echo   HIBA: nincs meg: %FV% & pause & exit /b 0 )
echo.
if "%~1"=="--all" (
    echo   Halozati muvelet: letolti a manifestben felsorolt komponenseket a
    echo   Vendor mappaba. A Vendor nincs verziokezelve, barmikor ujrahuzhato.
    echo.
)
pushd "%DE%"
"%NODE_EXE%" "%FV%" %1
popd
echo.
pause
exit /b 0

:DO_GYRO
call :CHECK_NODE || exit /b 0
set "GJS=%PLANNER_DIR%\tools\phone-relay-server.js"
if not exist "%GJS%" ( echo   HIBA: nincs meg: %GJS% & pause & exit /b 0 )
echo.
echo   Gyro relay szerver indul. Leallitas: Ctrl+C.
echo.
pushd "%PLANNER_DIR%"
"%NODE_EXE%" "tools\phone-relay-server.js"
popd
echo.
pause
exit /b 0

:DO_MANIFEST
set "MCMD=%DE%\Planner\scripts\manifest.cmd"
if exist "%MCMD%" (
    call "%MCMD%"
) else (
    call :CHECK_NODE || exit /b 0
    if not exist "%PLANNER_DIR%\tools\manifest.js" (
        echo   HIBA: sem scripts\manifest.cmd, sem tools\manifest.js nincs meg.
        pause
        exit /b 0
    )
    pushd "%PLANNER_DIR%"
    "%NODE_EXE%" "tools\manifest.js"
    popd
)
echo.
pause
exit /b 0
