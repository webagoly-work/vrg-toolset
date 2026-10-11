---
projekt: BRIDGE
alrendszer: BRIDGE-DN
dokumentum: ELO-elosztószekrény terv
verzió: r1
dátum: 2026-07-11
tags: [bridge, bridge-dn, elosztó, villamos]
---

# BRIDGE-DN · elosztószekrény terv

Méretarányos elrendezési terv az ABB Mistral41W 48 modulos (4×12) kiselosztóhoz. 1 modul = 18 mm, szekrény: 320 × 636 mm, IP41, átlátszó ajtó (RF-barát műanyag ház — az SLZB antennája működik mögötte).

## V1 — alap kiépítés (anyaglista szerint)

Csak a megrendelt anyagokból. 14 aktív áramkör + 1 tartalék, a 4. sínsor üresen előkészítve a BRIDGE-DN-nek.

![[BRIDGE_DN_Elosztoszekreny_V1_alap.svg]]

## V2 — bővített, BRIDGE-DN hardverrel

A teljes célállapot: főkapcsoló + SPD, Shelly Pro 3EM, Pro 2, RC-tag, valamint a 4. soron a BRIDGE-mag (HDR-60-5 → RPi 5 → USB hub + SLZB-MR3U).

![[BRIDGE_DN_Elosztoszekreny_V2_bovitett.svg]]

## Áramkörök

| Kör | Funkció | Megszakító |
|---|---|---|
| K1 | sütő | C16 2P |
| K2 | mosógép | C13 2P |
| K3 | mosogatógép | C13 2P |
| K4 | bojler | C13 2P |
| K5 | BRIDGE-DN / RPi táp | C10 2P |
| K6–K9 | világítás (4 kör) | B10 1P |
| K10 | dugalj — konyha | C16 1P |
| K11 | dugalj — nappali | C16 1P |
| K12 | dugalj — hálók | C13 1P |
| K13 | dugalj — egyéb | C13 1P |
| K14 | csengő + vezérlés | B6 1P |
| T | tartalék (bekötve) | C13 1P |

Az áramkör-nevek feltételezésen alapulnak a jelleggörbék szerint — a valós kiosztásra frissítendők.

## Megjegyzések

- Betáp útvonal (V2): HLAK sorkapcsok → főkapcsoló 2P → SPD T2 (leágazás PE-re) → FI 25/2 30 mA A-osztály → fésűs sínek.
- A 2P körök N-pólusa egyenként az N-sínről; az 1P villás fésűs sínen a N-pozíciók fogai kivágva.
- K5 (C10/2P) már a V1-ben bekötésre kerül — később ez táplálja a HDR-60-5-öt, arról az RPi 5-öt (5 V DC).
- Shelly Pro 3EM CT-bilincsek: K1 (sütő), K4 (bojler), K5 (BRIDGE) — tetszés szerint átrendezhető.
- RPi 5 és SLZB-MR3U Ethernetről (2 db keystone az 1. soron); solo dongle-ok a DIN USB 2.0 hubról.
- Pro 2 a világításkörök kapcsolása; RC-tag (100 kΩ + 10 µF MKP) a nyomógombos vezérlőkörhöz.
- V1-ből hiányzó, pótolandó tételek: főkapcsoló 2P, SPD T2 (+ előtétvédelem), keystone adapterek.
- V2-ben mind a 48 modul betelt — DIN dugalj már nem fért be; további bővítéshez külön kisszekrény kell.

## Anyaglista (megrendelt tételek)

| Cikkszám | Megnevezés | Menny. |
|---|---|---|
| EZ9R49225 | FI relé 25/2 30 mA, A osztály, Easy9 PRO | 1 db |
| EZ9F57116 | 1C 16A 6kA kismegszakító | 2 db |
| EZ9F27110 | 1B 10A 6kA kismegszakító | 4 db |
| EZ9F57213 | 2C 13A 6kA kismegszakító | 3 db |
| EZ9F57210 | 2C 10A 6kA kismegszakító | 1 db |
| EZ9F57113 | 1C 13A 6kA kismegszakító | 3 db |
| EZ9F57216 | 2C 16A 6kA kismegszakító | 1 db |
| EZ9F27106 | 1B 6A 6kA kismegszakító | 1 db |
| EZ9A34223 | Easy9 PRO moduláris csengő 230 VAC | 1 db |
| R9XFH112 | fésűs sín 1P villás, 12 modul, 63 A | 4 db |
| 2080184 | HLAK 35-1/6 M2 fővezeték sorkapocs, kék | 1 db |
| 2080183 | HLAK 35-1/6 M2 fővezeték sorkapocs, szürke | 1 db |
| — | H07V-K 1×10 fekete / kék / z-s | 3-3 fm |
| 1SPE007717F0721 | ABB Mistral41W 4/48 kiselosztó, IP41, átlátszó ajtó | 1 db |
