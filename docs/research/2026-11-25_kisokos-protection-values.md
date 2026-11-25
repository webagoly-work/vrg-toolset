# Kisokos: protection, sizing and test values checked against public sources

Date read: 2026-11-25. Researcher: Akecheta. No Kisokos file was edited.
Budget stopped early on the coordinator's instruction. Claims 8-11 and parts of 3, 6, 7 were not fully checked (see table).

## Summary

- One real error: the 0.4 s / 0.2 s table applies to final circuits up to **63 A with socket-outlets** and up to **32 A with only fixed equipment** (HD 60364-4-41:2017 cl. 411.3.2.2). Lesson s02 says "legfeljebb 32 A-es végáramkörök".
- Confirmed from the HD / IEC text previews: disconnection times (0.4/0.2 s, 5/1 s), 30 mA RCD scope incl. new 411.3.4 for lighting in single-household premises, insulation resistance table (500 V/1 MΩ, 250 V/0.5 MΩ).
- Confirmed but from secondary sources only: B/C/D ranges, RCD 300 ms / 40 ms, main bonding 6 mm² / half / 25 mm², voltage drop 3 % / 5 %.
- The "0.8 x limit" rule is a UK (BS 7671 Appendix 3 / IET GN3) practice, not in HD 60364. Lesson says "elterjedt szabály": acceptable, but attribute it.
- Not verified at all: ampacity numbers (claim 8), RCD type table (9), IEC 60479-1 and EN 50110-1 wording (10), copper resistivity (11). Notes from memory are marked "memory" and must not be treated as sourced.
- Hungarian national adoption (MSZ HD 60364-4-41 edition in force, national deviations) was not checked.

## Table

Confidence: H = primary text read; M = manufacturer / institution page or search snippet; L = forum/blog/memory.

| # | Lesson / card + field | Our claim | Finding | Verdict | Conf. | Source |
|---|---|---|---|---|---|---|
| 1a | s02 body[2] | "legfeljebb 32 A-es végáramkörök: TN 0,4 s, TT 0,2 s" | Table 41.1, 120 V < U0 <= 230 V: TN 0.4 s, TT 0.2 s (a.c.). Scope in 2017 edition: final circuits <= 63 A with one or more socket-outlets, and <= 32 A supplying only fixed current-using equipment. The "32 A" alone is the old wording. Also: in TT, where an overcurrent device disconnects and protective bonding connects all extraneous parts, the TN times may be used. | corrected (scope) | H | https://cdn.standards.iteh.ai/samples/60900/a918c00f3a904c6c97fee89ce52498e7/SIST-HD-60364-4-41-2017.pdf (read 2026-11-25) |
| 1b | s02 body[2] | "elosztó áramkörökben TN-ben 5 s, TT-ben 1 s" | 411.3.2.3 (TN 5 s) and 411.3.2.4 (TT 1 s) for distribution circuits and circuits not covered by 411.3.2.2. | confirmed | H | same as above |
| 2 | msz-hd-60364 values[0]; s02 body[0] | 30 mA RCD for lay-used socket-outlets <= 32 A, outdoor mobile equipment, "az újabb kiadás szerint a lakások világítási áramköreire is" | 411.3.3: a.c. socket-outlets <= 32 A liable to be used by ordinary persons for general use, and a.c. mobile equipment <= 32 A for outdoor use; not applied in IT where first-fault current <= 15 mA. New 411.3.4: in premises for a single household, a.c. final circuits supplying luminaires. The 2017 HD summary says the socket range was "extended up to 32 A" (older edition had a lower limit). The card wording "kültéri hordozható készülékek köreire" fits. Hungarian national status of 411.3.4 not checked. | confirmed (add precision) | H (HD text); national adoption not verified | same HD 60364-4-41:2017 preview; also https://www.electrical-installation.org/enwiki/Additional_protection:_High_sensitivity_RCDs (search snippet, M) |
| 3a | s03 body[1]; s02 formulas[1] | B 3-5 In, C 5-10 In, D 10-20 In | EN/IEC 60898-1 bands: B above 3 In up to 5 In, C above 5 In up to 10 In, D above 10 In up to 20 In (trip < 0.1 s). Seen via search results quoting Lovato catalogue and Schneider FAQ; not opened in full. | confirmed | M | https://datasheet.lovatoelectric.com/DOWNLOAD/Catalogue/CATALOGO%20INGLESE%202024/17%20-%20Miniature%20and%20residual%20circuit%20breakers.pdf ; https://assets1.sc.hager.com/exports/files/19en_imc_catafr_web_289_chapters_446-561.pdf (snippets only) |
| 3b | s02 example, exercises | B16: 230/80 = ~2.9 ohm; C16: 230/160 = 1.44 ohm | Arithmetic: 230/80 = 2.875 (tables print 2.87 truncated, 2.88 if rounded); 230/160 = 1.4375 (1.44). Using Ia = 5 In (B) and 10 In (C), the upper end of the range, is the standard way to guarantee instantaneous trip. UK tables apply Cmin 0.95 (so 2.73 ohm for B16) - a BS 7671 choice, not HD. 2.87 itself was not located in a source; computed. | confirmed (arithmetic); source for 2.87 not found | M/L | https://electrical.theiet.org/wiring-matters/years/2024/100-may-2024/why-are-the-values-of-maximum-earth-fault-loop-impedance-different/ (Cmin 0.95 only) |
| 3c | s10 body[3], formulas[0], example | measured Zs <= 0.8 x U0/Ia, "gyakorlatban elterjedt szabály" | The 0.8 factor is recommended by the IET (Guidance Note 3 / BS 7671 Appendix 3, equation with 0.8) and NICEIC: table values are for conductors at operating temperature, measured cold value must not exceed 0.8 x table value (equivalently measured x 1.25 <= limit). IET article presents it as part of the Appendix 3 equation, not as a "rule of thumb". Not found in HD 60364 text. Hungarian practice not checked. | confirmed as UK-origin practice; attribution to add | M | https://electrical.theiet.org/wiring-matters/years/2024/100-may-2024/why-are-the-values-of-maximum-earth-fault-loop-impedance-different/ ; https://issuu.com/niceic/docs/niceicapril11/s/11679434 (snippet) |
| 4 | s10 body[2] | 500 V DC / >= 1 MOhm up to 500 V; SELV/PELV 250 V / >= 0.5 MOhm | IEC 60364-6:2016 Table 6.1 and HD 60364-6:2007 Table 6A: SELV and PELV 250 V, 0.5 MOhm; up to 500 V incl. FELV 500 V, 1 MOhm; above 500 V 1000 V, 1 MOhm. Where SPDs cannot be disconnected the test voltage may drop to 250 V but >= 1 MOhm is required. Also: neutral disconnected from MET for the test. | confirmed (add SPD note) | H | https://cdn.standards.iteh.ai/samples/21340/5b6773dd9a0c417e97501490c483a487/IEC-60364-6-2016.pdf ; https://cdn.standards.iteh.ai/samples/15432/ce589b1c7b1649d59a3ae12c84b06d40/SIST-HD-60364-6-2007-EN-.pdf |
| 5 | s10 body[4] | general type: <= 300 ms at IDn, <= 40 ms at 5 x IDn | IET testing guidance and Hager: 300 ms at x1, 40 ms at x5 for general (non-delay) RCDs; S-type x1 130-500 ms (Fluke table). Nuance: IEC 61008/61009 let a 30 mA device meet 40 ms at 250 mA instead of 5 x IDn. Product-standard values, not in HD 60364-6 itself. Not in a Hungarian source. | confirmed (add nuance) | M | https://electrical.theiet.org/media/1627/17th-edition-requirements-for-the-testing-of-rcds.pdf ; https://hager.com/uk/support/regulations-18th-edition/updated-rccb-testing |
| 6a | s08 body[3] | main bonding: >= half largest PE, >= 6 mm2 Cu, need not exceed 25 mm2 Cu | 6 mm2 Cu / 16 Al / 50 steel minimum confirmed in Hungarian course slides on MSZ HD 60364-5-54. Half-of-PE and 25 mm2 cap seen only in BS 7671 544.1.1 wording (half of earthing conductor; PME exception) via DIYnot wiki; IEC/HD text not read (preview did not include clause 544). | partly confirmed | M/L | https://hobbielektronika.hu/forum/getfile.php?id=410112 ; https://diynot.com/wiki/Electrics:Regulation-544.1.1 |
| 6b | s08 body[3] | supplementary bonding 2.5 mm2 protected / 4 mm2 unprotected | The 2.5 / 4 mm2 values are in HD 60364-5-54 cl. 543.1.3 for protective conductors not part of a cable, per Schneider's reproduction and the Hungarian slides. BS 7671 544.2.3 applies them to supplementary bonding between two extraneous parts; exposed-to-exposed and exposed-to-extraneous have separate rules (conductance of smaller PE; half of PE). Lesson says "jellemzően": acceptable but incomplete. | partly confirmed | M | https://productinfo.se.com/galaxyvs_iec/990-95151-galaxy-vs-earthing-principles/English/990-95151%20Galaxy%20VS%20IEC%20Earthing%20Principles_0000936982.xml/$/Dimensioning_GVSGrounding_0000939100 ; https://www.voltimum.co.uk/news/can-you-explain-requirements-bs-7671 (snippet) |
| 7 | s04 body[2] | 3 % lighting / 5 % other, public LV supply, HD 60364-5-52 informative annex | Annex G (informative) "Voltage drop in consumers' installations", Table G.52.1: public LV supply lighting 3 %, other 5 %; private LV supply 6 % / 8 %. Seen in Electrical Installation Guide and a Google Sites copy of the table; the table itself not read. HD 60364-5-52:2011 clause 525 refers to "the relevant annex" (read in the HD preview foreword). A lighting maker cites a 4 % limit under HD 60364-52: unresolved disagreement. | confirmed, low-medium confidence | M/L | https://www.electrical-installation.org/enwiki/Maximum_voltage_drop (snippet) ; https://sites.google.com/view/etoolsbox/electrical/voltage-drop-iec ; https://cdn.standards.iteh.ai/samples/21898/ea7160bbe25341de8272c97fd3d229a0/SIST-HD-60364-5-52-2011.pdf |
| 8 | s03 example; s03 exercises | 2.5 mm2 Cu PVC ~19-24 A; 1.5 mm2 ~14.5-17.5 A | Table numbers were not found in any source I read. Memory only: these match UK BS 7671 Table 4D2A (methods A to B, 2 loaded) and IEC 60364-5-52 Annex B figures; German VDE 0298-4 values differ. | not verified | L | none |
| 9 | s02 body[4]; s05, s09 | AC / A / F / B: F for single-phase inverter appliances; B for EV chargers and 3-phase inverters unless charger has 6 mA DC detection | Not researched. | not verified | - | none |
| 10 | k06 body[1], body[3] | 0.5 mA / 10 mA / tens of mA; five rules per EN 50110-1 in the order given | Not researched. Memory only: 0.5 mA threshold of perception and ~10 mA let-go are the usual IEC 60479-1 figures; the five rules are usually listed disconnect fully, secure against re-closing, verify dead, earth and short-circuit, protect against adjacent live parts. Wording and order unchecked. | not verified | L | none |
| 11 | k0x formulas; s04 | rho = 0.0178 ohm mm2/m | Not researched. Memory only: 0.0175 (Cu at 20 C, ~1/57) is the textbook value; ~0.0178 is a 30 C or "calculation" value. Unchecked. | not verified | L | none |

## Corrections to apply

1. **s02-erintesvedelem body[2]** (confirmed error). Replace
   "Lekapcsolási idők (tájékoztató, 230 V, legfeljebb 32 A-es végáramkörök): TN rendszerben 0,4 s, TT rendszerben 0,2 s; elosztó áramkörökben TN-ben 5 s, TT-ben 1 s."
   with
   "Lekapcsolási idők (tájékoztató, 230 V / 400 V hálózat, MSZ HD 60364-4-41): TN rendszerben 0,4 s, TT rendszerben 0,2 s. Ez a legfeljebb 63 A-es, aljzatot tartalmazó végáramkörökre és a legfeljebb 32 A-es, csak fixen bekötött készüléket tápláló végáramkörökre vonatkozik; elosztó áramkörökben TN-ben legfeljebb 5 s, TT-ben legfeljebb 1 s."
   Optional addition: "TT rendszerben, ha túláramvédelem old le és minden idegen vezetőképes rész be van kötve az egyenpotenciálú összekötésbe, a TN idők is használhatók."

2. **msz-hd-60364 values[0]** (precision). Replace the lighting clause with
   "... és (a 2017-es kiadástól) az egyetlen háztartás befogadására szolgáló épületek világítási végáramköreire is (a hazai átvétel részleteit ellenőrizni kell)."
   Add: "Nem kell alkalmazni olyan IT rendszerben, ahol az első hibánál a hibaáram legfeljebb 15 mA."

3. **s10-ellenorzo-meresek body[3]** (attribution). Replace "a gyakorlatban elterjedt szabály, hogy a mért érték ne haladja meg a határ kb. 80 %-át"
   with
   "a gyakorlatban elterjedt (az angol BS 7671 / IET útmutatókból származó) szabály, hogy a hidegen mért érték ne haladja meg a táblázati határ 80 %-át, mert a határ az üzemi hőmérsékletű vezetékre vonatkozik; az MSZ HD 60364 szövege ezt nem írja elő".

4. **s10-ellenorzo-meresek body[2]** (add SPD exception). Append:
   "Ha a túlfeszültség-levezetőt vagy más készüléket nem lehet leválasztani (pl. levezetős aljzat), a vizsgálófeszültség az adott körre 250 V-ra csökkenthető, de legalább 1 MΩ szükséges."

5. **s10-ellenorzo-meresek body[4]** (nuance). Append:
   "Egyes 30 mA-es készülékeknél a gyártó a 40 ms-ot 5 x IΔn helyett 250 mA-nél garantálja; ilyenkor a műszeres próbát a gyártói adat szerint kell értékelni."

6. **s08-foldeles-eph body[3]** (incomplete). Replace the supplementary-bonding clause with
   "a kiegészítő összekötő vezető két idegen vezetőképes rész között legalább 2,5 mm² (mechanikai védelemmel) vagy 4 mm² (védelem nélkül) réz; test és idegen rész között legalább a hozzá csatlakozó védővezető fele, két test között legalább a kisebbik védővezető vezetőképessége". Check against the MSZ text before publishing.

Not corrected (not verified, leave as is until checked): claims 8, 9, 10, 11 and the national Hungarian wording of claims 2, 6a, 7.

## What I could not confirm

- Full clause text of HD 60364-5-54 cl. 544.1.1 / 544.2 (previews cut it off); the 25 mm2 cap and half-of-PE rule rest on BS 7671 text.
- The Table G.52.1 values from the standard itself; the 4 % disagreement.
- Any Fluke / Megger / Metrel / Gossen guide for loop-impedance limits or RCD times (only IET, Hager, Fluke manual snippet).
- Claims 8-11 (ampacity tables, RCD type table, IEC 60479-1, EN 50110-1, copper resistivity).
- Which edition of MSZ HD 60364-4-41 is in force in Hungary and any Hungarian deviations.
- Note: `node tools/vrg-ctx.js q` returned "No index yet", so the project context was not consulted.

Instructions met in fetched files: none (all data only).
