# 09_catalogue — BRIDGE okosotthon-katalógus

Egyetlen igazságforrás az eszközökre, érzékelőkre, gázokra, kapcsolókra, világításra, a Tuya kategóriákra és az elemes eszközökre. A Planner végpont-katalógusa (`EP_CAT`) innen veszi át a kódokat (F5).

| Fájl | Mi |
|---|---|
| `src/*.js` | **Ezt szerkeszd.** Kulcsok angolul, minden olvasható szöveg magyarul. |
| `tools/build.js` | Összerakja és **minden hivatkozást ellenőriz**; hibánál exit 1 |
| `tools/viewer.html` | A nézet sablonja |
| `SMARTHOME-DB-001.json` | Generált — ne kézzel |
| `smarthome-db.html` | Generált offline nézet (fájlként is megnyitható, szűrő helyiségre és szövegre) |
| `RESEARCH-001_…md` | A kutatás következtetései, CLA ajánlások, döntési lista (D-01…D-07) |

```bash
node BRIDGE/09_catalogue/tools/build.js           # build
node BRIDGE/09_catalogue/tools/build.js --check   # csak ellenőrzés
```

Szabályok:
- Új szenzor, kapcsoló, lámpa stb. → a megfelelő `src` fájlba, egyedi `k` kulccsal. A gázok külön névtér.
- Szoba csak a `00-vocab.js` `roomTypes` listájából; zóna és táp csak a szótárból.
- A ⚑ jelölésű szám másodlagos forrás. BRIDGE szabály csak ellenőrzés után lesz belőle.
- A Tuya adat két forrásból áll: a Tuya Developer Platform (103 kategória) és a Home Assistant 2026.10.0 `tuya/const.py` (Apache-2.0, 140 kód). A dokumentációs prózát nem másoljuk, csak kódot, nevet és a saját címkéinket.
