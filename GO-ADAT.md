# GO ADAT — indító prompt (P33: erősáram alapréteg → Adat/PoE + LED-betápok + régi terv)

Másold be ezt egy új Claude Code munkamenetbe (munkakönyvtár: `H:\Dev-VRG\VRG-DE\wt-planner-stack`).

---

Folytatjuk a P33 tervezését ott, ahol az előző munkamenet abbahagyta (2026-10-12). Előbb olvasd el ezeket, és csak utána kezdj dolgozni:

1. `Planner/projects/varler-planner/tools/baseline/README.md` — a motor moduljai és szabályai.
2. `Calculator/P33-baseline/ADATRETEG.md` — az utolsó kör eredménye: összevetés a régi tervvel (78 tétel), 5 LED-betáp, Adat/PoE réteg.
3. `Calculator/P33-baseline/ALAPRETEG.md` — az erősáramú alapréteg (2 jóváhagyási kör, Q-001 és Q-002 beépítve).
4. `Planner/projects/varler-planner/tools/baseline/p33.config.js` — minden eddigi döntésem itt van (edits, switchGroups, floorGroups, data, led, oldPlan…).

**Hol tartunk.** A worktree `H:\Dev-VRG\VRG-DE\wt-planner-stack` (ág: planner-stack). Semmi nincs commitolva: a commitot és a pusht én csinálom, te soha.

Futtatás:

```
node Planner/projects/varler-planner/tools/baseline/run.js "C:/Users/webag/Downloads/P33_teszt_v1_m_solat.vplan(3).json" Calculator/P33-baseline
```

A forrás a vázlatom: `Downloads/P33_teszt_v1_m_solat.vplan(3).json`. Az előző futás 0 figyelmeztetéssel ért véget.

A kimenetek a `Calculator/P33-baseline/` mappába kerülnek:
- `_alapreteg.vplan.json` és `_adatreteg.vplan.json`; mindkettőt a Downloads mappába is másold.
- `ALAPRETEG.md`, `ADATRETEG.md`, `legs.csv`
- lapok: `alap-halozat`, `alap-aramkorok`, `portal-sablon`, `adat-halozat`, `led-betap`, `osszevetes` (.png + .svg)
- a Tuner kérdéscsomagja: `ADATRETEG-Q-001.json`

A Tuner itt van: `H:\Dev-VRG\VRG-DE\Planner_VRG_U100\BRIDGE\_tuner\bridge-tuner.html`. Válaszformátum: `ID=kulcs ~ megjegyzés`.

**A következő lépés.** Beküldöm az `ADATRETEG-Q-001` válaszait (D01–D09 adatréteg, L01–L08 LED, R01–R12 a régi terv nyitott pontjai). Építsd be őket a configba vagy a motorba, futtasd újra, és nézd meg a lapokat. Ha marad nyitott pont, csak arról legyen második kérdéscsomag (mint az ALAPRETEG-Q-002 volt). Utána jön a Planner-munkafolyamat: Elosztó kijelölése → használható falak → alapmagasság → hardvercsomópontok → végpontok → automatikus magasság, útvonal, áramkörjavaslat és bekötés.

**A motor fő szabályai.**
- Vízszintes pálya csak jelölt falon fut. Falon át csak szervizponton lehet vezetni: portálnál, RBX-nél vagy BASE-nél.
- Erősáram:
  - A gerinc 2600-on fut: egy fa az Elosztóból, áramkörönként egy kábel.
  - A leágazó 2450-en fut. Minden leállásnál 2 szerelvényes doboz van, és ugyanilyen doboz kerül minden valódi sarokba és minden pályavégre.
  - Egy csőben legfeljebb 3 kábel lehet.
- Adat:
  - Cat6A, a végpont a legközelebbi RBX-be fut, az RBX 2× Cat6A-val a BASE-be.
  - A vízszintes sáv 2700-on van. Portálnál az adat csak a zsanéroldali fészekben (H0) megy át.
  - Húzódoboz kell 2 falsarok után.
- LED: futásonként egy kezdőpont és egy ⌀68 mélydoboz, a betáphoz közelebbi végen.
- A régi terv képe pixelről mm-re: `vx = 10934 − (834 + (ix−362)/0.1373)`, `vy = 11440 − (2390 + (iy−195)/0.1373)`. A pontos koordináták a régi lap generátorában vannak: `Planner_VRG_U100/BRIDGE/07_P33/blueprints/src/p33-sheets.js`.

**Nyitott megállapítások.**
- LED3 (bemarás a fürdő új falában) ütközik az RBX03-mal: ugyanazon a 200 mm-es falszakaszon vannak, 2100 és 2150 mm-en.
- A lépcsőnyílás (x 3330–3965) megszakítja az étkező falvonalát, ezért a gerinc és az uplinkek a konyhán át kerülnek (D07).
- A D12 és a D13 jegyzete fel van cserélve.
- A szigeten nincs elszívópont.
- Az L16 300 mm-en áll.
- A nappaliban egy redőnymotor van, de a régi terv „alsó + felső” redőnyt jelölt.

**Szabályaim.**
- Minden képen, amit küldesz, minden szám olvasható legyen, és semmi ne kerüljön egymásra. Használd a `labels.js`-t, és küldés előtt nézd meg a PNG-t.
- Felületi szöveg magyarul, kódazonosítók angolul.
- Ne törölj semmit kérdezés nélkül.
- A P33 ügyféladat: a `BRIDGE/07_P33` mappa nem kerül gitbe, és ügyféldokumentum nem hagyhatja el a gépet.
- Soha ne írd, hogy „ajánlat”, hanem „Költségvetési Tervezet”.
- A nagy kéréseket bontsd fázisokra, és közben kérdezz.

Előnézet: a `planner-serve` szerver (port 8131, `tools/serve.js`) a worktree gyökerét szolgálja ki. A Planner itt nyílik: `http://localhost:8131/Planner/projects/varler-planner/dist/varler_planner.html`. Betöltés: `hardResetWorkspace(); applyProjectData(o.project)`.

Ha minden megvan, mondd el röviden, hol tartunk, és várd a Tuner-válaszaimat.
