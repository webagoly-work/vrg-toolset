# VARLER — hordozható munkakörnyezet

Ez a pendrive önmagában elég: böngésző, Node, szerkesztő, forráskód és adat.
Semmi nem támaszkodik a vendéggép telepített programjaira, és semmi nem ír
a vendéggép felhasználói profiljába.

**Indítás:** `START.cmd` a gyökérben.

---

## Mappaszerkezet

```
VARLER/
│  START.cmd                      menü
│  README.md                      ez a fájl
│
├─ apps/                          hordozható programok — NEM megy gitbe
│   ├─ node/                      node-vXX-win-x64.zip kicsomagolva
│   ├─ opera-gx/                  standalone/USB telepítés (launcher.exe)
│   ├─ vscode/                    + data/ mappa mellette = portable mód
│   ├─ git/                       PortableGit
│   └─ 7zip/
│
├─ projects/
│   └─ varler-planner/            EZ A GIT REPÓ
│       ├─ src/                   00-core … 12-boot, a modulok
│       ├─ dist/                  GENERÁLT. kézzel soha ne szerkeszd
│       ├─ tests/
│       ├─ docs/                  ARCHITECTURE.md, DECISIONS.md, 1.1_backlog.md
│       ├─ tools/                 PC-oldali kísérőprogramok (Node)
│       ├─ mobile/                más eszközön futó oldalak (telefon, tablet, ügyfél)
│       ├─ node_modules/          gitignore
│       ├─ build.js
│       └─ package.json
│
├─ data/                          A MUNKÁD. a repón kívül, mindig
│   ├─ projects/                  .vplan.json és .vbundle.json mentések
│   ├─ backgrounds/               alaprajz-szkennek, fotók
│   └─ exports/                   PNG / CSV / nyomtatott PDF
│
└─ scripts/
    _env.cmd  planner.cmd  build.cmd  test.cmd  gyro.cmd  shell.cmd
```

---

## Két szabály, amitől ez működik

**1. Sehol nincs betűjel.** Minden script a `%~dp0`-ból számol, tehát `E:`, `F:`
vagy `D:` teljesen mindegy. Ha új scriptet írsz, az első sora legyen
`call "%~dp0_env.cmd"` — onnantól `%ROOT%`, `%PROJ%`, `%DATA%`, `%NODE%` megvan.

**2. A `data/` a repón kívül van.** A domoszlói rajzot soha nem szabad
összekeverni a kód történetével. A `projects/` mappát bármikor törölheted és
újraklónozhatod anélkül, hogy egyetlen rajz is elveszne.

---

## Hova kerül az új kód?

| Kérdés | Mappa |
|---|---|
| Bekerül a `varler_planner.html`-be? | `src/`, számozott modulként |
| Ezen a gépen fut, a böngészőn kívül? | `tools/` |
| Másik eszközön fut (telefon, tablet, ügyfél)? | `mobile/` |
| A `build.js` állítja elő? | `dist/` — kézzel nem nyúlsz hozzá |

A gyro-vezérlés három fájlja ezért így oszlik el:

| Fájl | Mappa | Miért |
|---|---|---|
| `07b-phone-camera.js` | `src/` | planner-modul; a `NNx` név miatt átszámozás nélkül a helyére sorolódik |
| `phone-relay-server.js` | `tools/` | Node-folyamat a PC-n |
| `phone-sender.html` | `mobile/` | a telefonon fut |

Ugyanez érvényes előre is: a read-only ügyfélnézet → `mobile/`, egy árlista-importáló
script → `tools/`, a Rendezés-gráf → `src/` mint negyedik projekció.

---

## Böngészőváltás — EZT NE HAGYD KI

A planner a projekteket a böngésző `localStorage`-ában tárolja, ami a
**böngészőprofilhoz** tartozik. A hordozható Opera GX új, üres profil: a
projektlista ott üresen indul.

1. Nyisd meg a plannert a **jelenlegi, telepített** Opera GX-ben
2. `🗄 Teljes mentés…` → *Mentés fájlba*
3. A `.vbundle.json`-t tedd ide: `data/projects/`
4. Indítsd a hordozható Opera GX-et, nyisd meg a plannert
5. `🗄 Teljes mentés…` → *Visszatöltés* fül → válaszd a fájlt → *Hozzáadás*

A betűjel változása nem baj: Chromiumban minden `file://` oldal egy origin,
tehát az adat ott marad. **A profil változása a baj** — ezért kell a mentés.

Szokásból: minden nagyobb munkanap végén egy `.vbundle.json` a `data/projects/`-be.

---

## Opera GX hordozhatóan

Az **offline telepítőt** töltsd le, indítsd el, kattints az **Options**-re, és az
**Install for** mezőt állítsd **Standalone / USB**-re, célmappának pedig
`apps\opera-gx`-et. Ez hivatalos opció. A PortableApps-os csomag nem hivatalos
kiadás — ne azt használd.

Amit tudni kell róla: a tanúsítványok a Windows tárolójából jönnek, tehát azok
nem utaznak veled; és standalone telepítéssel az Opera nem állítható be
alapértelmezett böngészőnek. A plannerhez egyik sem számít.

---

## Node

A `.zip` kiadást használd, ne az `.msi`-t: kicsomagolod, és kész — nincs
registry, nincs PATH-módosítás a gépen. A `_env.cmd` az npm gyorsítótárát és
konfigját is a pendrive-ra irányítja.

**Ne futtass `npm install`-t a pendrive-ról.** Több ezer apró fájl, USB-n
fájdalmasan lassú. Telepítsd otthon, és hozd magaddal a `node_modules` mappát.

Mire kell egyáltalán:

| Feladat | Node kell? |
|---|---|
| A planner használata | **nem** |
| `build.js` — dist újraépítése | igen |
| `npm test` | igen |
| `phone-relay-server.js` — gyro relay | igen, futásidőben |

---

## OneDrive

A pendrive a **futtatókörnyezet**, a OneDrive a **másolat**. Ami szinkronizálódjon:
`data/` és egy-egy kiadott `dist/`. Ami **ne**: `apps/`, `node_modules/`, `.git/` —
több ezer apró fájltól a OneDrive megőrül, és egy félbeszakadt szinkron
tönkre is teheti a git repót. Ha két gépen is szerkeszted a forrást, arra git
való, nem fájlszinkron.

---

## Tűzfal (gyro)

A relay a WiFi-interfészen figyel, tehát a Windows rá fog kérdezni a
`node.exe`-re — és az engedélyezés rendszergazdai jog. Saját gépen rendben.
Ügyfélnél lehet, hogy nem kapod meg: ilyenkor telefon-hotspot + a saját laptopod
a megbízható párosítás.
