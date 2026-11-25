# Tankönyv — Kisokos volume tk (started 2026-11-22)

The electrician's textbook inside the Kisokos: the whole trade, from the first lesson to the master's and
designer's level, in our own words. Lessons are cards (kind `lecke`) in `Kisokos/tankonyv/`; the readable
book is generated into `Kisokos/tankonyv/KISOKOS.md` (`node Kisokos/kisokos.js md`), and the Stack's 3D page
shows each lesson in full. Every lesson links into the other volumes, so the theory points at the materials,
lines, fixtures and rules it uses.

Status: **level 1 written** (10 lessons) and **level 2 lessons 1–10** (2026-11-25); all drafts waiting for review.
The rest is planned below; the plan was aligned on 2026-11-25 with the official requirements of the trade (TK1:
`docs/research/2026-11-25_kisokos-tk1-villanyszerelo-kkk.md`). Our book fits the **Villanyszerelő (4 0713 04 07),
Épületvillamosság** direction.

## 1. The lesson card

`level` (1–3) · `chapter` · `goals[]` · `body[]` (the explanation, paragraph by paragraph) · `formulas[]`
`{ f, mean }` · `example { task, steps[], result }` (worked, with real numbers) · `exercises[] { q, a }` (the
answer always given; the 3D page and the book hide it until opened) · `safety[]` · `links[]` (cards in other
volumes, `<volume>.<id>`) · `prereq[]` (earlier lessons) · `terms` HU / EN / DE · planned: `kkk[]`, the official
requirement points the lesson serves (TK1), so the coverage table can be regenerated.

## 2. The curriculum

### Level 1 · Kezdő (lessons 1–10 written, 11–12 planned after TK1)

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
| 11 | *planned (TK1):* Kondenzátor, mágneses tér, induktivitás; R, XL, XC egyszerű számokkal | |
| 12 | *planned (TK1):* Rajzolvasás és szakrajz: jelképek, egyvonalas és többvonalas rajz, kapcsolási és szerelési rajz (with TK2) | Rajztár |

Planned extensions after TK1: lesson 6 gets fire safety and work at height; lesson 9 gets screw, rivet, soldered and
crimped joints, tightening torque and basic metalwork.

### Level 2 · Szakmunkás (lessons 1–10 written, 11–20 planned; reordered after TK1)

1. ✅ Hálózati rendszerek: TN-C, TN-S, TN-C-S, TT, IT; a PEN szétválasztása; a régi „nullázás” veszélye.
2. ✅ Érintésvédelem: alap-, hiba-, kiegészítő védelem; lekapcsolási idők; Zs · Ia ≤ U0 (B16: ≈ 2,9 Ω); AC, A, F, B típus.
3. ✅ Túláramvédelem: hő- és mágneses kioldó, B / C / D, megszakítóképesség, Ib ≤ In ≤ Iz, szelektivitás alapjai.
4. ✅ Keresztmetszet és feszültségesés: terhelhetőség szerelési mód szerint, 3 % / 5 %, egy- és háromfázisú képlet.
5. ✅ A lakáselosztó: sorrend, áram-védőkapcsoló csoportok, csoportonkénti nullasín, feliratozás, tartalékhely.
6. ✅ Áramkörök kiosztása egy lakásban: saját körös fogyasztók, aljzatmagasságok, szerelési zónák, egy 75 m²-es példa.
7. ✅ Mérőhely és betáplálás: plombált rész, csatlakozási teljesítmény, bővítés, vezérelt áram, kétirányú mérő.
8. ✅ Földelés és EPH: alapföldelő, rúdföldelő, fő és helyi EPH, keresztmetszetek.
9. ✅ Különleges helyiségek a gyakorlatban: egy fürdőszoba végigtervezve, medence, szauna, kültér.
10. ✅ Ellenőrző mérések: sorrend, szigetelés, hurokimpedancia (80 %-os szabály), áram-védőkapcsoló, jegyzőkönyv.
11. Kábelek a gyakorlatban: nyomvonal, fektetés, védőcső, átvezetések, kábelvégelzárás, zsugorkötés (TK1: missing).
12. Villám- és túlfeszültség-védelem: 1., 2., 3. típusú levezetők, és a villámvédelmi rendszer részei: felfogó,
    levezető, földelés (TK1: moved forward).
13. Motorok és transzformátor: aszinkron motor és a forgó mágneses tér, csillag-delta indítás, forgásirányváltás
    mágneskapcsolóval (vizsgafeladat), lágyindító, frekvenciaváltó, a transzformátor alapjai (TK1: extended).
14. Épületautomatizálás alapjai: KNX, DALI, okos szerelvények bekötése és élesztése (TK1: the largest official block,
    moved from level 3; the design side stays in level 3).
15. Fotovoltaikus rendszer telepítői szemmel: string, inverter, DC- és AC-oldali védelem, leválasztás (TK1: the exam
    tests it).
16. Ideiglenes építési elosztó: áram-védőkapcsoló, IP, kábelek, a felvonulási terület (TK1: missing).
17. Gyengeáram a lakásban: strukturált hálózat, TV, kaputelefon (a Kommunikációs vonalakra építve).
18. Világítástechnika a gyakorlatban: lux, lumen, színhőmérséklet, kiosztás (a Világítótestekre építve).
19. Feszültségmentesítés és munkavégzés lépésről lépésre: az öt szabály egy teljes munkán végigvezetve (TK1: the
    exam's safety part weighs 40 %, and an error in shock protection fails the exam).
20. Hibakeresés módszeresen: a tünettől a hibahelyig.

### Level 3 · Mester, tervező (planned)

1. Teljesítményigény és egyidejűség: a lakás és a társasház méretezése.
2. Zárlati áram és szelektivitás: a védelmek összehangolása.
3. Tervdokumentáció: műszaki leírás, rajzok (a Rajztár jeleivel), számítások.
4. Jogosultságok és felelősség: ki tervezhet, ki adhat át, a szolgáltatói ügyintézés.
5. Energiamenedzsment: napelem, akkumulátor, hőszivattyú, autótöltő, terhelésvezérlés (the PV installer basics are level 2, lesson 15).
6. Épületautomatizálás tervezése: KNX, DALI, Matter, okosotthon-központ (the installer basics are level 2, lesson 14).
7. Biztonsági világítás tervezése (az Előírások vészvilágítás-kártyáira építve).
8. Felújítás és régi hálózatok: alumíniumvezeték, TN-C, bővítés, a meglévő állapot felmérése.
9. Árajánlat és vállalkozás: költségvetés, anyaglista, ütemezés (a Workflow Kittel).
10. Átadás és üzemeltetés: dokumentáció, ügyfél betanítása, időszakos felülvizsgálat.

## 3. Order

1. ✅ Level 1 (10 lessons, 2026-11-22).
2. ✅ Level 2, lessons 1–5 (the safety core: networks, protection, cross-section, the distribution board), 2026-11-25.
3. Level 2, lessons 6–20 (✅ 6–10, 2026-11-25); level 1 lessons 11–12 and the extensions of 6 and 9.
4. Level 3.
5. Circuit drawings for the lessons (TK2).

## 4. Open questions

- **TK1** ✅ checked 2026-11-25 against the KKK in force from 2023-11-21 and the 2020 PTT
  (`docs/research/2026-11-25_kisokos-tk1-villanyszerelo-kkk.md`); the curriculum above now includes the gaps it found.
  Still for the H: session: the newest PTT and the KKK amendment effective 2024-08-29 (from the ágazat 04 page on
  ikk.hu), the Szakmajegyzék text, and the Erősáramú elektrotechnikus (5 0713 04 04) KKK.
- **TK2** Circuit drawings (váltókapcsolás, elosztó, hálózati rendszerek): proposal: generate them from the
  Rajztár symbols, like the line and lamp drawings, starting with lesson 1/10.
- **TK3** A quiz view of the exercises (on the phone, VRG Mobile): later, once level 2 exists. With TK1: map the quiz to the four parts of the interactive exam (alkatrész, technológia, számítás, villamos
  biztonság) and add a checklist of the project tasks (mérőhely, főelosztó).

## 5. DevLog entry (paste into `notes/devlog/lines.js` on H:)

```js
{ id: 'kisokos-tankonyv', name: 'Kisokos · Tankönyv', lane: '<the Kisokos lane>',
  status: 'active', from: ['kisokos'],
  brief: 'The electrician textbook in the Kisokos: three levels (kezdő, szakmunkás, mester/tervező), one card per lesson with goals, explanation, formulas, a worked example, exercises with answers, safety and links into the other volumes.',
  milestones: [['11-22', 'curriculum planned (docs/kisokos/tankonyv.md); level 1 written: 10 lessons'],
               ['11-25', 'level 2 lessons 1–5 written: networks, protection, overcurrent, cross-section, distribution board'],
               ['11-25', 'level 2 lessons 6–10 written: circuit layout, metering, earthing and bonding, special rooms, test measurements'],
               ['11-25', 'TK1: curriculum checked against the official KKK/PTT (Villanyszerelő 4 0713 04 07); gaps added, building automation and PV moved to level 2']],
  remaining: ['Founder review of level 1 and level 2 lessons 1–10', 'TK1 follow-up on H: (newest PTT, 2024 KKK amendment)', 'level 1 lessons 11–12 and extensions of 6, 9', 'level 2 lessons 11–20', 'level 3 (10 lessons)', 'TK2 circuit drawings'],
  nextStep: 'Review level 2, 1–10; then level 2 lessons 11–15 (cables, surge and lightning, motors, building automation basics, PV).',
  feeds: [['kisokos']] },
```
