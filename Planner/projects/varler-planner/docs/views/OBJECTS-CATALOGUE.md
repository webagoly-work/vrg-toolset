# Objects catalogue: the extended object list (proposal for V7 / V8)

*Draft 2026-10-11 for the user to edit: strike, add, or correct sizes, then V7 pastes it into
`OBJLIB` (`src/02-state.js`). Sizes are typical w × d × h in mm (w = across the front, d = depth).
V8 draws our own line-art for each: **F**ront, **L**eft, **R**ight, **T**op.*

Key: **✓** = already in `OBJLIB` (name kept exactly; saved projects reference it) · **P33** = used
in the P33 furnished plan (`tools/p33-furniture.js`) · **art** = the views V8 draws (F L R T; L/R
are mirrored when the object is symmetric) · **prio** 1 = first line-art batch, 2 = next, 3 = later.

## Nappali (living room)

| name (HU) | w × d × h | flags | art | prio |
|---|---|---|---|---|
| Kanapé 3ü | 2200 × 900 × 850 | ✓ P33 | F L T | 1 |
| Kanapé 2ü | 1600 × 900 × 850 | | F L T | 2 |
| Sarokkanapé L | 2700 × 1700 × 850 | | F L R T | 2 |
| Fotel | 800 × 800 × 850 | ✓ P33 | F L T | 1 |
| Dohányzóasztal | 1100 × 600 × 420 | ✓ P33 | F L T | 2 |
| Kisasztal Ø50 | 500 × 500 × 600 | P33 | F T | 2 |
| TV szekrény | 1600 × 400 × 500 | ✓ P33 | F L T | 1 |
| TV 65" (falon) | 1450 × 60 × 830 | | F L T | 1 |
| Médiafal / beépített | 3000 × 450 × 2400 | | F L T | 2 |
| Könyvespolc | 800 × 300 × 1800 | ✓ | F L T | 2 |
| Komód / polc | 2800 × 300 × 800 | P33 | F L T | 2 |
| Polc | 800 × 300 × 800 | P33 | F L T | 3 |
| Vitrin | 900 × 400 × 1900 | | F L T | 3 |
| Állólámpa | 400 × 400 × 1600 | | F T | 2 |
| Hangfal álló | 250 × 300 × 1000 | | F L T | 2 |
| Kandalló | 900 × 500 × 1200 | ✓ | F L T | 3 |
| Zongora (pianínó) | 1500 × 600 × 1250 | | F L T | 3 |

## Hálószoba (bedroom)

| name (HU) | w × d × h | flags | art | prio |
|---|---|---|---|---|
| Ágy 200×160 | 1600 × 2000 × 550 | ✓ P33 | F L T | 1 |
| Ágy 200×180 | 1800 × 2000 × 550 | | F L T | 2 |
| Ágy 200×90 | 900 × 2000 × 550 | ✓ | F L T | 2 |
| Ágy fejvéggel (1100) | 1700 × 2100 × 1100 | | F L T | 2 |
| Éjjeliszekrény | 450 × 400 × 550 | ✓ | F L T | 1 |
| Szekrény 120 | 1200 × 600 × 2100 | ✓ | F L T | 2 |
| Gardrób 240 | 2400 × 600 × 2400 | ✓ | F L T | 2 |
| Tolóajtós gardrób 300 | 3000 × 650 × 2600 | | F L T | 3 |
| Komód | 1000 × 450 × 800 | ✓ | F L T | 2 |
| Fésülködőasztal | 1000 × 450 × 750 | | F L T | 3 |
| Tükör álló | 600 × 50 × 1700 | | F L | 3 |

## Gyerekszoba (children's room)

| name (HU) | w × d × h | flags | art | prio |
|---|---|---|---|---|
| Emeletes ágy | 1000 × 2000 × 1600 | | F L T | 3 |
| Kiságy | 700 × 1300 × 900 | | F L T | 3 |
| Pelenkázó | 900 × 550 × 950 | | F L T | 3 |
| Játéktároló | 1000 × 400 × 900 | | F L T | 3 |

## Dolgozó (study)

| name (HU) | w × d × h | flags | art | prio |
|---|---|---|---|---|
| Íróasztal | 1400 × 700 × 750 | ✓ | F L T | 1 |
| Állítható íróasztal | 1600 × 800 × 650–1250 | | F L T | 3 |
| Irodai szék | 650 × 650 × 1100 | | F L T | 2 |
| Monitor 27" | 620 × 200 × 520 | | F L T | 2 |
| Iratszekrény | 800 × 400 × 1200 | | F L T | 3 |

## Étkező (dining)

| name (HU) | w × d × h | flags | art | prio |
|---|---|---|---|---|
| Étkezőasztal 160 | 1600 × 900 × 750 | ✓ | F L T | 2 |
| Étkezőasztal 120 | 1200 × 800 × 750 | P33 | F L T | 1 |
| Kerek asztal Ø110 | 1100 × 1100 × 750 | | F T | 3 |
| Szék | 450 × 450 × 900 | ✓ P33 | F L T | 1 |
| Bárszék | 400 × 400 × 750 | | F L T | 2 |
| Tálalószekrény | 1600 × 450 × 850 | | F L T | 3 |
| Függeszték (asztal fölé) | 1200 × 300 × 600 | | F L T | 2 |

## Konyha (kitchen)

| name (HU) | w × d × h | flags | art | prio |
|---|---|---|---|---|
| Konyhapult 60 | 600 × 600 × 900 | ✓ | F L T | 1 |
| Konyhapult 120 | 1200 × 600 × 900 | ✓ | F L T | 1 |
| Konyhapult | 1100 × 600 × 900 | P33 | F L T | 1 |
| Konyhapult (sarok) | 600 × 600 × 900 | P33 | F L R T | 2 |
| Fiókos alsó 60 | 600 × 600 × 900 | | F L T | 2 |
| Felsőszekrény | 600 × 350 × 700 | ✓ | F L T | 1 |
| Magas szekrény (beépítő) | 600 × 600 × 2200 | | F L T | 2 |
| Kamrapolc | 860 × 400 × 1800 | P33 | F L T | 3 |
| Konyhasziget | 1800 × 900 × 900 | | F L R T | 2 |
| Mosogató | 600 × 500 × 900 | ✓ P33 | F L T | 1 |
| Tűzhely 60 | 600 × 600 × 900 | ✓ P33 | F L T | 1 |
| Indukciós főzőlap (sziget) | 770 × 520 × 60 | | F T | 2 |
| Sütő beépített | 600 × 600 × 600 | ✓ | F L T | 2 |
| Mikró beépített | 600 × 400 × 380 | | F L T | 3 |
| Hűtő 60 | 600 × 650 × 1850 | ✓ P33 | F L T | 1 |
| Amerikai hűtő | 900 × 700 × 1780 | | F L T | 3 |
| Mosogatógép 60 | 600 × 600 × 850 | ✓ | F L T | 2 |
| Páraelszívó | 600 × 500 × 600 | ✓ | F L T | 2 |
| Kávégép (pult) | 300 × 450 × 380 | | F L T | 3 |

## Fürdő / WC (bathroom)

| name (HU) | w × d × h | flags | art | prio |
|---|---|---|---|---|
| WC csésze | 400 × 700 × 800 | ✓ P33 | F L T | 1 |
| Fali WC + tartály (beépített) | 360 × 540 × 400 (keret 1120) | | F L T | 2 |
| Bidé | 400 × 600 × 400 | ✓ | F L T | 3 |
| Mosdó 60 | 600 × 450 × 850 | ✓ P33 | F L T | 1 |
| Mosdó 40 | 350 × 400 × 850 | P33 | F L T | 2 |
| Kézmosó | 450 × 300 × 850 | P33 | F L T | 2 |
| Mosdószekrény 80 | 800 × 460 × 850 | | F L T | 2 |
| Tükrös szekrény | 800 × 150 × 700 | | F L T | 2 |
| Kád 170×75 | 1700 × 750 × 600 | ✓ P33 | F L T | 1 |
| Zuhanytálca 90×90 | 900 × 900 × 150 | ✓ | F T | 2 |
| Zuhanytálca 80×80 | 800 × 800 × 150 | P33 | F T | 2 |
| Zuhanyfal (walk-in) | 1200 × 10 × 2000 | | F L T | 2 |
| Mosógép 60 | 600 × 600 × 850 | ✓ | F L T | 1 |
| Szárítógép 60 | 600 × 600 × 850 | ✓ | F L T | 2 |
| Törölközőradiátor | 500 × 100 × 1200 | ✓ | F L | 2 |

## Előszoba (hall)

| name (HU) | w × d × h | flags | art | prio |
|---|---|---|---|---|
| Cipősszekrény | 1400 × 300 × 900 | P33 | F L T | 1 |
| Fogas / előszobafal | 1200 × 350 × 1900 | | F L T | 2 |
| Pad | 1000 × 350 × 450 | | F L T | 3 |

## Gépészet / BRIDGE (building services)

| name (HU) | w × d × h | flags | art | prio |
|---|---|---|---|---|
| Elosztószekrény | 600 × 150 × 800 | ✓ | F L T | 1 |
| BASE szekrény (NET/COMP/MEDIA) | 600 × 400 × 900 | | F L T | 1 |
| RBX doboz | 400 × 120 × 300 | | F L T | 1 |
| Rack 19" 12U (fali) | 600 × 450 × 640 | | F L T | 2 |
| Villanyóra szekrény | 400 × 200 × 600 | ✓ | F L T | 2 |
| Kazán fali | 450 × 350 × 800 | ✓ | F L T | 2 |
| HMV tároló 200l | 600 × 600 × 1500 | ✓ | F L T | 3 |
| Hőszivattyú kültéri | 1000 × 400 × 900 | ✓ | F L T | 2 |
| Klíma beltéri | 900 × 220 × 300 | | F L T | 1 |
| Klíma kültéri | 800 × 300 × 550 | | F L T | 2 |
| Szellőzőgép | 800 × 600 × 1200 | ✓ | F L T | 3 |
| Radiátor 1000 | 1000 × 100 × 600 | ✓ | F L T | 2 |
| Padlófűtés osztó | 600 × 110 × 450 | | F L T | 3 |
| Napelem inverter | 450 × 200 × 600 | | F L T | 3 |
| Akkumulátor (otthoni) | 600 × 200 × 1000 | | F L T | 3 |

## Kültér / terasz (outdoor)

| name (HU) | w × d × h | flags | art | prio |
|---|---|---|---|---|
| Kerti asztal 70×70 | 700 × 700 × 740 | P33 | F L T | 2 |
| Kerti szék | 450 × 450 × 850 | P33 | F L T | 2 |
| Napozóágy | 700 × 1900 × 350 | | F L T | 3 |
| Növény (cserepes) | 500 × 500 × 1200 | | F T | 2 |
| Kaputelefon kültéri | 120 × 40 × 300 | | F L | 2 |

## Építészeti / egyéb (architectural / other)

| name (HU) | w × d × h | flags | art | prio |
|---|---|---|---|---|
| Egyedi méret… | 1000 × 600 × 800 | ✓ | — (box) | — |
| Oszlop 30×30 | 300 × 300 × 2700 | ✓ | F T | 3 |
| Beépített szekrény | 2000 × 600 × 2700 | ✓ | F L T | 2 |
| Doboz / raklap | 1200 × 800 × 1000 | ✓ | F T | 3 |
| Függöny / roló (ablak) | 1400 × 100 × 2400 | | F L | 2 |

---

## What V7 adds to each `OBJLIB` item

```js
{n:'Kanapé 3ü', w:2200, d:900, h:850,       // as today: name is the key saved projects use
 room:'Nappali',                             // new: the catalogue group (for a room-filtered picker)
 art:['F','L','T'],                          // new: which line-art views exist (V8 fills OBJART)
 sym:true}                                   // new: L = mirrored R (symmetric object)
```

P33 names that are not in `OBJLIB` today (they came from `p33-furniture.js` as custom objects)
become real catalogue items, so a re-furnished P33 matches the library.

**Count:** 106 items (56 already in `OBJLIB` or P33, 50 new). 25 of them are prio 1, which is the
first line-art batch after V8's first five.
