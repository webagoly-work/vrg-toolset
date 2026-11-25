# TK1 — Villanyszerelő KKK / PTT vs. our Tankönyv (research notes)

Read on 2026-11-25 (all links below fetched that day). Own wording; official text only as short attributed quotes.
`node tools/vrg-ctx.js q` had no index in this checkout, so the project was checked by reading `docs/kisokos/tankonyv.md`
and the card ids/titles in `Kisokos/tankonyv/1-kezdo.json` and `2-szakmunkas.json`.

## 1. Summary

- The trade is **Villanyszerelő, azonosító 4 0713 04 07**, MKKR/EKKR level 4, ágazat **Elektronika és elektrotechnika**
  (the KKK says "Műszaki ágazati alapoktatás"). Three szakmairány: **Épületvillamosság**, **Villamos hálózat**,
  **Villamos készülék és berendezés**; részszakma: **Villamosipari előkészítő**. Our book is closest to Épületvillamosság.
- Related higher qualification in the same ágazat: **Erősáramú elektrotechnikus, 5 0713 04 04** (technikus level 5).
  The names "Villanyszerelő technikus", "Villamos hálózat-szerelő", "Épületvillamossági szerelő" are **not** separate
  qualifications in the current system: the last two are FEOR job names (7343, 7524) mapped to the trade.
- Publisher: IKK Innovatív Képzéstámogató Központ (the successor of NSZFH for the content). Several KKK versions exist;
  the newest I could read is the one in force from **2023-11-21**. A later amendment took effect **2024-08-29** (renewable
  directive wording, reconstruction/decommissioning competence moved into the common requirements and the written exam).
  I could not fetch the 2024-08-29 text itself.
- Total: **2100 szakmai óra** (3-year szakképző iskola, without közismeret) plus **140 h** (school) / **160 h** (exam-prep only)
  continuous practice. Exam: ágazati alapvizsga (20 %) + szakmai vizsga (80 %).
- Main gaps in our curriculum: machines and drives (transformer, asynchronous motor, starters), cable laying and cable
  termination, building automation and lighting control, PV, surge/lightning protection (planned only), temporary site
  supply, technical drawing/documentation, basic metalwork and fastening skills, semiconductors/electronics, capacitor and
  magnetic field theory. Things we have that the official list lacks: the metering/billing layer (kWh, cos φ), the 75 m² worked
  circuit-layout example, cross-links into the Kisokos volumes, EN/DE terms, full MSZ HD 60364 depth beyond the exam.

## 2. Official documents

| Document | Code / date | URL | Status |
|---|---|---|---|
| KKK, Villanyszerelő szakma (34 pp), PDF title "Villanyszerelő", PDF created 2023-11-15; IKK says in force 2023-11-21 | 4 0713 04 07 | https://api.ikk.hu/v1/media/9733 | fetched and read |
| KKK, earlier version (34 pp), PDF created 2022-08-26 (the 2022-09-12 version) | 4 0713 04 07 | https://api.ikk.hu/v1/media/5695 | fetched, only the header read |
| IKK slide deck "Módosítások az Elektronika-elektrotechnika ágazat szakmáinak KKK-ban" (13 pp, created 2025-02-06): table of the ágazat's qualifications and KKK entry-into-force dates (2020-05-18, 2022-09-12, 2023-11-21, 2024-08-29) | – | https://api.ikk.hu/storage/uploads/files/elektronika_elektrotechnika_agazat_vpdf-1738845394806.pdf | fetched and read (the slides carry a "confidential" footer although the file is public; only dates and codes are used here) |
| Programtanterv (PTT) az 04. Elektronika és elektrotechnika ágazathoz tartozó 4 0713 04 07 Villanyszerelő szakmához (85 pp, PDF title "PTT_Elektronika_Villanyszerelo_2020", created 2020-05-19). It is the **first (2020) version**, hosted by a school, not by IKK | 4 0713 04 07 | https://www.aranykezoktatas.hu/fajlok/dokumentumok/Kepzesi_programok/villanyszerel%C5%91%20programtanterv.pdf | fetched and read (hour tables) |
| School programme built on the PTT, Épületvillamosság, 2024 (55 pp): shows the 2100-hour frame with the same subjects | – | https://www.tmszc.hu/uploads/2/files/Villanyszerelo_epuletvillamossag_szakmairany_Kepzesi_Program_2024_Ady.pdf | fetched, hour table read |
| Programtanterv of a sister trade (Elektronikai műszerész, 4 0713 04 02), on ikk.hu, only as format proof | – | https://api.ikk.hu/v1/media/614 | header read |
| Legal frame cited by the PTT: 12/2020. (II. 7.) Korm. rendelet (Szkr., §13 (4): free band); Act 2019. évi LXXX on vocational training | – | https://njt.jog.gov.hu/jogszabaly/2020-12-20-22 | page is script-heavy, text not read; the Szakmajegyzék annex was **not** verified |

Not confirmed, for the H: session: (a) the **current IKK PTT** for Villanyszerelő (2022/2023/2024 versions) and the
**2024-08-29 KKK**: look on ikk.hu under Szakmai dokumentumok, ágazat 04 Elektronika és elektrotechnika (the ikk.hu
"szakkepzesi-dokumentumok" URL I guessed returned 404; the `api.ikk.hu/v1/media/<n>` number of the newest file has to be taken
from the site); (b) the Szakmajegyzék itself (12/2020 Korm. rendelet 1. melléklet, or the ITM decree that replaced it,
a search snippet mentioned 34/2021 ITM, in force 2024-09-15, unverified); (c) the KKK of Erősáramú elektrotechnikus
(5 0713 04 04), not read.

## 3. Official topic list (condensed, Hungarian)

### 3.1 Ágazati alapoktatás (Műszaki), KKK 6.1–6.2
Műszaki rajz olvasása, vázlatkészítés; gyártási sorrend; kézi megmunkálás, kisgépek (darabolás, reszelés, fúrás, menet);
méretellenőrzés; csavar-, szegecs- és lágyforrasztott kötés; kapcsolási rajz alapján egyszerű áramkör összeállítása és
feszültség-, áram-, ellenállásmérés; hiba- és túláramvédelmi eszközök ismerete; mérési dokumentáció (szövegszerkesztő /
táblázat); munka-, tűz-, baleset- és környezetvédelem.

### 3.2 Szakmairányok közös követelményei, KKK 6.3 (15 pont, rövidítve)
1 villamos és mechanikai kötések; 2 süllyesztett és falon kívüli alapszerelés, szerszám- és anyagjegyzék; 3 lakóépület
csatlakozó vezetéke; 4 fogyasztásmérő hely (szolgáltatói előírás szerint); 5 berendezések kábeles csatlakozó vezetéke,
megvalósulási dokumentáció, szerelői ellenőrzés; 6 kábelösszekötés kisfeszültségű kábelen zsugortechnológiával;
7 váltakozó áramú motor üzembe helyezése (háromfázisú indítás, forgásirányváltás mágneskapcsolóval); 8 fotovoltaikus
berendezés szerelése; 9 hibavédelmi módok szerelői ellenőrzése; 10 túlfeszültség-védelmi eszköz; 11 villámvédelem;
12 feszültségmentesítés (MSZ EN 50110-1 szerint); 13 organizációs bejárás; 14 munkavédelmi eszközök használata;
15 rekonstrukció / megszüntetés során bontás (added in the 2023 version).

### 3.3 Épületvillamosság szakmairány, KKK 6.4.2 (12 pont, rövidítve)
1 épületvillamos erős- és gyengeáramú alapszerelés kiviteli terv szerint, online katalógusból anyagválasztás;
2 intelligens épület (épületautomatika) erős- és gyengeáramú rendszere, jeladók; 3 szerelői ellenőrzés, hibavédelmi
mérések, kiértékelés, digitális dokumentálás; 4 beltéri, biztonsági és vészvilágítás szerelése, lámpatest-választás;
5 vezérlő- és szabályozó berendezések kiválasztása, beépítése, bekötése; 6–7 kábelfektetés (nyomvonal, kábelárok,
átvezetések, víz- és tűzálló átvezetés; MSZ 13207 hivatkozás); 8 kábelvégelzárás zsugortechnológiával;
9 építési munkaterület ideiglenes világítása és energiaellátása; 10 épületvillamos elosztó kialakítása, szerelése, üzembe
helyezése; 11 villámvédelmi és földelési rendszer (TN-S, TN-C-S, N/PE/PEN a hibavédelemben); 12 hibakeresés a védelmi
eszközök jelzései alapján.
(Villamos hálózat irány: szabadvezeték, KIF/KÖF hálózat, transzformátorállomás, közvilágítás, FAM-közeli ismeretek;
Villamos készülék és berendezés irány: motor, transzformátor, frekvenciaváltó, lágyindító, ipari elosztó.)

### 3.4 Tanulási területek, tantárgyak, órák (PTT 2020, Épületvillamosság szakmairány, 2016 h + gyakorlat; the 2024 school
programme uses the same subjects with a 2100 h frame)
| Tanulási terület | Tantárgy (óra) | Témakörök (óra) |
|---|---|---|
| Munkavállalói ismeretek | Munkavállalói ismeretek (18); Munkavállalói idegen nyelv (62) | munkajog, álláskeresés, önéletrajz, interjú |
| Műszaki alapozás | Villamos alapismeretek (288) | villamos áramkör 90, ábrázolás 18, kialakítás 36, villamos biztonságtechnika 36, mérés és dokumentálás 108 |
| | Gépészeti alapismeretek (270) | munkabiztonság 18, műszaki rajz 72, anyag- és gyártásismeret 18, fémipari alapmegmunkálás 72, projektmunka 90 |
| Villamossági alapismeretek | Elektrotechnika (108) | aktív/passzív hálózatok 36, villamos erőtér és kondenzátor 12, mágneses tér 12, váltakozó áramú hálózatok 24, többfázisú hálózatok 24 |
| | Ipari elektronika (36) | félvezetők 12, impulzustechnika 6, egyenirányítók/tápegységek 6, digitális technika alapjai 12 |
| | Villamos dokumentáció (72) | műszaki ábrázolás alapjai 24, villamosipari szakrajz 48 |
| Biztonságtechnika | Villamos biztonságtechnika (72) | alapvédelem 6, hibavédelem 30, szerelői ellenőrzés 8, villámvédelem 8, túlfeszültség-védelem 8, tűzvédelem 6, magasban végzett munka 6 |
| | Munkavédelem (36) | alapismeretek 8, egészséges és biztonságos munkakörnyezet 10, munkakörnyezeti hatások 8, munkaeszköz-használat 10 |
| Épületvillamosság | Épületvillamosság 1. (180) | munka előkészítése 22, vezetékek 18, áramütés elleni védelem 15, épület-villanyszerelési technológiák 53, kapcsolókészülékek és túláramvédelem 36, fogyasztók és világítás 36 |
| | Épületvillamosság 2. (514) | felmérés és alapszerelés 210, vezérlők és szabályozók 106, intelligens épületautomatika 90, villámvédelem 36, túlfeszültség-védelem 36, átadás és ellenőrzés 36 |
| Villamos készülékek és berendezések | Villamos készülékek és berendezések 1. (180) | gépek és elosztók anyagai 12, transzformátor 36, forgó mágneses mező és szinkrongép 9, aszinkrongép 54, egyenáramú és különleges gépek 15, elosztóberendezések 54 |
| Villamos hálózat (only the hálózat irány) | Villamos hálózatok 1. (180) | energia-előállítás 15, hálózatok 25, kábelhálózatok 70, csatlakozóberendezés 70 |
| Egybefüggő gyakorlat | 140 h (school) / 160 h | |

PTT rule (own paraphrase): subject hours and content are binding; topic hours and the year-by-year order are only a
recommendation; at least a stated share of each subject is to be taught in practice.

### 3.5 Vizsga (KKK 7–8, 2023-11-21 version)
- **Ágazati alapvizsga**: írásbeli 90 perc, 30 % (műhelyrajz 15, kapcsolási rajz értelmezése 15, gyártástechnológia 20,
  szakmai számítás 20, mérés-ellenőrzés 20, munkavédelem 10; pass at 40 %); gyakorlati 240 perc, 70 % (mechanikus és villamos
  alkatrészcsoport készítése, kapcsolás, mérési jegyzőkönyv). Counts 20 % in the final result.
- **Szakmai vizsga, Épületvillamosság** (80 % of the final): portfólió leadása legalább 10 nappal előtte.
  - **Központi interaktív vizsga**, 90 perc, 30 %: I alkatrész- és anyagismeret 20 %, II technológiai ismeret 20 %
    (kábelfektetés, motorindítás/forgásirányváltás mágneskapcsolóval, alapszerelés, rekonstrukció), III számítás 20 %
    (csatlakozó vezeték feszültségesés és terhelhetőség; teljesítmény- és energiaigény), IV villamos biztonsági ismeret 40 %
    (feszültségmentesítés, lakóépület szerelői ellenőrzése, villám- és túlfeszültség-védelem, áramütés elleni védelem, PV).
  - **Projektfeladat**, 300 perc, 70 %: I portfólió + szóbeli védés (10 perc) 20 %; II gyakorlati kialakítás (mérőhely, ideiglenes
    ellátás, világításvezérlés, főelosztó védelmekkel, kábelezés, berendezés csatlakoztatása) 40 %; III egy- vagy háromfázisú direkt
    mérés kialakítása 40 %. "Áramütés elleni védelem kialakításában elkövetett hiba érvénytelen vizsgának minősül" (KKK 8.13.5).

## 4. Mapping: official topic -> our lesson

Lesson ids: k01–k10 (level 1), s01–s10 (level 2, written), S11–S15 and L3-1…L3-10 (planned, numbering from `tankonyv.md`).
Status: **covered**, **partial**, **planned** (in our plan but not written), **missing** (not in the plan).

| Official topic (PTT/KKK) | Our lesson | Status |
|---|---|---|
| Villamos áramkör, Ohm, mérés (Villamos alapismeretek) | k01, k03, k07 | covered |
| Teljesítmény, energia | k02 | covered |
| Villamos biztonságtechnika, alapvédelem, hibavédelem | k06, s01, s02 | covered |
| Váltakozó áram, többfázisú hálózat | k04, k05 | covered (no phasor/reactance depth) |
| Aktív/passzív hálózatok (Kirchhoff) | k03 | covered |
| Villamos erőtér, kondenzátor | – | **missing** |
| Mágneses tér, indukció | only mentions in s-cards | **missing** as a lesson |
| Félvezetők, impulzustechnika, egyenirányító, digitális alapok | – | **missing** (low priority for an installer) |
| Műszaki rajz, villamosipari szakrajz, jelképek | TK2 drawings (planned), L3-3 | **planned**, no basics lesson |
| Gépészeti alapok: fémmegmunkálás, csavar-, szegecs-, forrasztott kötés | k09 (wire joints only) | **partial** |
| Szerszámok, mérőműszerek | k07 | covered |
| Vezetékek, kábelek, szerkezetek | k08 | covered |
| Kábelfektetés (nyomvonal, árok, átvezetés), kábelvégelzárás, zsugorkötés | – | **missing** |
| Épület-villanyszerelési technológiák, alapszerelés | k09, k10, s06 | partial (no süllyesztett/falon kívüli technology lesson) |
| Kapcsolókészülékek, túláramvédelem | s03 | covered |
| Fogyasztók és világítás | s06; S12 | planned (lighting) |
| Lakáselosztó, főelosztó | s05 | covered |
| Mérőhely, csatlakozó vezeték, fogyasztásmérő hely | s07 | covered |
| Keresztmetszet, feszültségesés, terhelhetőség | s04 | covered |
| Hálózati rendszerek (TN-S, TN-C-S…) | s01 | covered |
| Földelés, EPH | s08 | covered |
| Szerelői ellenőrzés, mérések, jegyzőkönyv | s10 | covered |
| Különleges helyiségek | s09 | extra (not a separate official subject) |
| Villámvédelem, túlfeszültség-védelem | S13 | **planned** (the exam gives IV. part 40 % to safety, so raise priority) |
| Feszültségmentesítés (MSZ EN 50110-1) | k06 (five rules), s10 | covered, no step-by-step lesson with examples |
| Tűzvédelem, magasban végzett munka, munkakörnyezet | partly k06 | **partial** |
| Motorok, mágneskapcsoló, indítás, forgásirányváltás, frekvenciaváltó | S14 | **planned** |
| Transzformátor, szinkron-/aszinkron-, egyenáramú gép | – | **missing** (S14 only the installer side) |
| Elosztóberendezések (ipari) | s05 (lakás only) | partial |
| Hibakeresés a védelmi jelzések alapján | S15 | **planned** |
| Gyengeáram, strukturált hálózat | S11 | planned |
| Épületautomatika, vezérlők, szabályozók, KNX/DALI | L3-6 | planned (official weight: 196 h in Épületvillamosság 2, so it belongs below level 3) |
| Fotovoltaikus berendezés | L3-5 | planned (exam tests it; installer-level basics needed earlier) |
| Biztonsági/vészvilágítás | L3-7 | planned |
| Ideiglenes (építési) ellátás | – | **missing** |
| Rekonstrukció, megszüntetés, bontás | L3-8 | planned (new in the 2023 KKK) |
| Felmérés, tervdokumentáció, megvalósulási dokumentáció | L3-3 | planned |
| Átadás, ellenőrzés | L3-10, s10 | planned/covered |
| Szabadvezeték, KIF/KÖF, trafóállomás, közvilágítás (Villamos hálózat irány) | – | out of scope (not an Épületvillamosság topic); optional |
| Munkavállalói ismeretek, idegen nyelv | – | out of scope; our terms HU/EN/DE cover some of it |
| Portfólió, munkanapló, projektmunka | – | **missing** (exam-specific) |
| Ours only: Ohm/kWh with real prices, cos φ, 75 m² circuit layout, árajánlat (L3-9), energiamenedzsment (L3-5), jogosultságok (L3-4) | | beyond the official list |

## 5. Proposed additions (for the Founder to decide; none is made here)

1. **Kábelek a gyakorlatban** (level 2, new): kábelfektetés, nyomvonal, védőcső, átvezetések, kábelvégelzárás és
   zsugorkötés; exam parts II and the 12 KKK points name it.
2. **Feszültségmentesítés lépésről lépésre** (level 2, new or an extension of s10): worked example with the five rules, the
   exam's IV. part counts 40 %.
3. **Bring S13 (villám- és túlfeszültség-védelem) forward** and add the lightning protection system parts (fogó, levezető,
   földelés) to the lesson goals.
4. **Motorok és transzformátor alapjai** (extend S14): aszinkron motor, a forgó mágneses mező in one paragraph, csillag-delta
   és forgásirányváltás mágneskapcsolóval (a named exam task), lágyindító, frekvenciaváltó.
5. **Fotovoltaikus rendszer, telepítői alapok** (level 2 short lesson before L3-5): string, inverter, DC/AC védelem,
   leválasztás.
6. **Ideiglenes építési elosztó** (short level 2 lesson): FI, IP fokozat, kábelek, elosztó a felvonulási területen.
7. **Villamos alapok bővítése** (level 1): kondenzátor és erőtér, mágneses tér/induktivitás, a váltakozó áramú
   ellenállások (R, XL, XC) with simple numbers; the PTT gives them 48 h.
8. **Rajzolvasás és szakrajz** (level 1/2): jelképek, egyvonalas és többvonalas rajz, kapcsolási és szerelési rajz
   (ties in with TK2); the exam asks for a diagram reading task.
9. **Kötések és megmunkálás** (extend k09): csavar-, szegecs-, forrasztott és préselt kötés, nyomaték, alapvető fémipari műveletek.
10. **Munkavédelem és tűzvédelem, magasban végzett munka** (extend k06): a short chapter with the PTT's subtopics.
11. **Vizsga-felkészítő nézet** (later, with TK3): quiz mapped to the four interactive-exam parts (alkatrész, technológia,
    számítás, villamos biztonság) and a checklist of the project tasks (mérőhely, főelosztó).
12. Optional: mark every card with the KKK point it serves (field `kkk`) so the coverage table above can be regenerated.

## 6. Limits of this research

- The newest KKK (2024-08-29) and the current PTT were not read; the hour tables are the 2020 PTT (confirmed against the 2024
  school programme, which shows the same subjects and 2100 h). Hours may have shifted slightly.
- Only the Épületvillamosság direction was read in full; Villamos hálózat and Villamos készülék irány were only skimmed.
- The Szakmajegyzék text and the 5 0713 04 04 (Erősáramú elektrotechnikus) KKK were not read; the technikus comparison is
  therefore left open.
- The comparison judges the lessons by their titles, goals and a keyword search, not by reading every body text.
