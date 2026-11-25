# Tankönyv — Kisokos volume tk (started 2026-11-22)

The electrician's textbook inside the Kisokos: the whole trade, from the first lesson to the master's and
designer's level, in our own words. Lessons are cards (kind `lecke`) in `Kisokos/tankonyv/`; the readable
book is generated into `Kisokos/tankonyv/KISOKOS.md` (`node Kisokos/kisokos.js md`), and the Stack's 3D page
shows each lesson in full. Every lesson links into the other volumes, so the theory points at the materials,
lines, fixtures and rules it uses.

Status: **level 1 written** (10 lessons, drafts waiting for review). Levels 2 and 3 are planned below.

## 1. The lesson card

`level` (1–3) · `chapter` · `goals[]` · `body[]` (the explanation, paragraph by paragraph) · `formulas[]`
`{ f, mean }` · `example { task, steps[], result }` (worked, with real numbers) · `exercises[] { q, a }` (the
answer always given; the 3D page and the book hide it until opened) · `safety[]` · `links[]` (cards in other
volumes, `<volume>.<id>`) · `prereq[]` (earlier lessons) · `terms` HU / EN / DE.

## 2. The curriculum

### Level 1 · Kezdő (written)

| # | Lesson | Links out |
|---|---|---|
| 1 | Feszültség, áram, ellenállás (Ohm, a vezeték ellenállása) | Hálózati 50 Hz |
| 2 | Teljesítmény, energia, melegedés (kWh, a laza kötés hője) | Hálózati 50 Hz |
| 3 | Soros és párhuzamos kapcsolás (Kirchhoff, a konyhai kör példája) | Kapcsolt aljzat |
| 4 | Váltakozó áram, fázis, nulla, védővezető (50 Hz, effektív érték, cos φ) | MSZ HD 60364 |
| 5 | A háromfázisú rendszer (400 V, 3 × 16 A ≈ 11 kW, színjelölés) | Csillár |
| 6 | Áramütés és az öt biztonsági szabály (30 mA, MSZ EN 50110-1) | MSZ HD 60364, vezetékkereső |
| 7 | Szerszámok és mérőműszerek (kétpólusú vizsgáló, CAT II–IV, hibakeresés) | vezetékkereső |
| 8 | Vezetékek és kábelek (H07V-U, NYM-J, keresztmetszet, Al–Cu) | Hálózati 50 Hz |
| 9 | Kötéstechnika (rugós és csavaros kötés, érvéghüvely, dobozban kötni) | Gipszkarton |
| 10 | Az első áramkörök (egypólusú, csillár-, váltó-, keresztkapcsolás, impulzusrelé) | Plafonlámpa, Csillár, Kapcsolt aljzat, szerelvények |

### Level 2 · Szakmunkás (planned)

1. Hálózati rendszerek: TN-C, TN-S, TN-C-S, TT, IT, és hogy mit jelent a lakásnak.
2. Érintésvédelem: önműködő lekapcsolás, áram-védőkapcsoló, kettős szigetelés, törpefeszültség.
3. Túláramvédelem: kismegszakító-karakterisztikák (B, C), olvadóbiztosító, szelektivitás alapjai.
4. Keresztmetszet és feszültségesés: terhelhetőség szerelési mód szerint, a 3 %-os gyakorlat.
5. A lakáselosztó: felépítés, sorrend, sínek, feliratozás, tartalékhely.
6. Áramkörök kiosztása egy lakásban: világítás, aljzatkörök, konyha, fürdő, nagy fogyasztók.
7. Mérőhely és betáplálás: a szolgáltató felé, a fogyasztásmérő, a főelosztó.
8. Földelés és egyenpotenciálú összekötés (EPH): alapföldelő, földelő, fő- és helyi EPH.
9. Különleges helyiségek: fürdő, kültér, szauna, medence (az Előírások kártyáira építve).
10. Ellenőrző mérések: folytonosság, szigetelési ellenállás, hurokimpedancia, RCD-próba, jegyzőkönyv.
11. Gyengeáram a lakásban: strukturált hálózat, TV, kaputelefon (a Kommunikációs vonalakra építve).
12. Világítástechnika a gyakorlatban: lux, lumen, színhőmérséklet, kiosztás (a Világítótestekre építve).
13. Túlfeszültség- és villámvédelem alapjai: 1., 2., 3. típusú levezetők.
14. Motorok és nagy fogyasztók: indítás, védelem, háromfázisú bekötés.
15. Hibakeresés módszeresen: a tünettől a hibahelyig.

### Level 3 · Mester, tervező (planned)

1. Teljesítményigény és egyidejűség: a lakás és a társasház méretezése.
2. Zárlati áram és szelektivitás: a védelmek összehangolása.
3. Tervdokumentáció: műszaki leírás, rajzok (a Rajztár jeleivel), számítások.
4. Jogosultságok és felelősség: ki tervezhet, ki adhat át, a szolgáltatói ügyintézés.
5. Energiamenedzsment: napelem, akkumulátor, hőszivattyú, autótöltő, terhelésvezérlés.
6. Épületautomatizálás tervezése: KNX, DALI, Matter, okosotthon-központ.
7. Biztonsági világítás tervezése (az Előírások vészvilágítás-kártyáira építve).
8. Felújítás és régi hálózatok: alumíniumvezeték, TN-C, bővítés, a meglévő állapot felmérése.
9. Árajánlat és vállalkozás: költségvetés, anyaglista, ütemezés (a Workflow Kittel).
10. Átadás és üzemeltetés: dokumentáció, ügyfél betanítása, időszakos felülvizsgálat.

## 3. Order

1. ✅ Level 1 (10 lessons, 2026-11-22).
2. Level 2, lessons 1–5 (the safety core: networks, protection, cross-section, the distribution board).
3. Level 2, lessons 6–15.
4. Level 3.
5. Circuit drawings for the lessons (TK2).

## 4. Open questions

- **TK1** The official Hungarian vocational requirements for the villanyszerelő trade (the training and output
  requirements and the programme curriculum) are public. Proposal: download them in the H: session and check
  this chapter list against them, keeping our own text.
- **TK2** Circuit drawings (váltókapcsolás, elosztó, hálózati rendszerek): proposal: generate them from the
  Rajztár symbols, like the line and lamp drawings, starting with lesson 1/10.
- **TK3** A quiz view of the exercises (on the phone, VRG Mobile): later, once level 2 exists.

## 5. DevLog entry (paste into `notes/devlog/lines.js` on H:)

```js
{ id: 'kisokos-tankonyv', name: 'Kisokos · Tankönyv', lane: '<the Kisokos lane>',
  status: 'active', from: ['kisokos'],
  brief: 'The electrician textbook in the Kisokos: three levels (kezdő, szakmunkás, mester/tervező), one card per lesson with goals, explanation, formulas, a worked example, exercises with answers, safety and links into the other volumes.',
  milestones: [['11-22', 'curriculum planned (docs/kisokos/tankonyv.md); level 1 written: 10 lessons']],
  remaining: ['Founder review of level 1', 'TK1 check against the official requirements', 'level 2 (15 lessons)', 'level 3 (10 lessons)', 'TK2 circuit drawings'],
  nextStep: 'Review level 1; then level 2 lessons 1–5 (networks, protection, cross-section, distribution board).',
  feeds: [['kisokos']] },
```
