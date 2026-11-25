# Kisokos product and lighting standards: web verification (2026-11-25)

Read 2026-11-25 by Akecheta. Method: public web search results and pages only; the standards texts are paywalled, so most checks rest on catalogue abstracts (IEC, BSI, AFNOR, VDE, EVS), regulator pages and trade articles. "Finding" is what the source says; "verdict" is my conclusion. No file other than this one was edited.

## Summary
- The cards are broadly sound. No hard error found in the 2-x part list, 62471, 13201, ATEX or 60204-1 colours.
- Most useful corrections: (1) EN 60598-2-21 covers rope lights AND LED strip luminaires, but only those with non-replaceable light sources, so the cards' use of 2-21 for "lum.linear" is doubtful; (2) EN 61347-2-13 was reissued in 2024 as "electronic controlgear for LED light sources" with an emergency-lighting annex; (3) the zone 0/1 wording is thinner than the Directive's; (4) EN 13201: selection of classes is CEN/TR 13201-1, not the standard; (5) EN 12464-1:2021 adds "modified illuminance" steps, so "kb. 500 lx" should be named as the maintained value.
- 12464-1 office 500 lx / UGR 19 / Ra 80 and corridor 100 lx are confirmed only by secondary sources (not by the standard text). Corridor UGR and Ra are not on our card.
- The "minimum distance to lighted objects" symbol is confirmed as a 60598-1 marking. The thermal-insulation symbol is confirmed to exist, but the exact current-edition wording is not.
- Not verifiable here: exact titles of 2-11, 2-17 and 2-22 from a catalogue; HD 60884-1 itself (only IEC 60884-1:2022 seen); 60598-2-25.

## Claim table
| card id + field | our claim (quote) | finding | verdict | confidence | source |
|---|---|---|---|---|---|
| msz-en-60598 points[0] | "2-1 helyhez kötött általános célú" | IEC 60598-2-1 is "fixed general purpose luminaires"; a 3rd edition is dated 2025-12 | confirmed | high | https://standards.iteh.ai/catalog/standards/iec/26debad1-c25e-4e6d-bc4e-efd4f10bfe19/iec-60598-2-1-2025 (read 2026-11-25) |
| msz-en-60598 points[0] | "2-2 süllyesztett" | Title "Recessed luminaires" | confirmed | high | https://www.iecee.org/certification/iec-standards/iec-60598-2-22011 (via search result listing, 2026-11-25) |
| msz-en-60598 points[0] | "2-3 közúti világítás" | "Luminaires for road and street lighting", also other public outdoor lighting | confirmed | high | https://knowledge.bsigroup.com/products/luminaires-particular-requirements-luminaires-for-road-and-street-lighting (2026-11-25) |
| msz-en-60598 points[0] | "2-4 hordozható általános célú" | Part 2-4 exists in the series (IECEE listing); title not read | not verifiable from fetched text (background knowledge agrees) | medium | https://www.iecee.org/certification/iec-standards/iec-60598-2-41997 |
| msz-en-60598 points[0] | "2-11 akváriumlámpák" | Not found in any fetched source | not verifiable | low | none |
| msz-en-60598 points[0] | "2-12 aljzatba dugható éjszakai fények" | EN 60598-2-12:2013 = "mains socket-outlet mounted nightlights" | confirmed | high | https://www.boutique.afnor.org/en-gb/standard/iec-605982122013/luminaires-part-212-particular-requirements-mains-socketoutlet-mounted-nigh/xs125557/246641 |
| msz-en-60598 points[0] | "2-13 talajba süllyesztett" | "Ground recessed luminaires", supply up to 1000 V; ed. 1.2 (2016) | confirmed | high | https://standards.iteh.ai/catalog/standards/iec/39bae631-d053-4383-b933-0caa6acf5560/iec-60598-2-13-2006 |
| msz-en-60598 points[0] | "2-17 színpadi és stúdió" | Not found in any fetched source | not verifiable | low | none |
| msz-en-60598 points[0] | "2-20 fényfüzérek" | "Lighting chains", series/parallel sources, indoor or outdoor, up to 250 V; 2022 edition current, 2014 cancelled | confirmed | high | https://www.iecee.org/certification/iec-standards/iec-60598-2-202022 |
| msz-en-60598 points[0] | "2-21 fényszalagok (LED-szalag is)" | BSI: covers rope lights AND LED strip luminaires with non-replaceable series, parallel or series-parallel light sources, indoor or outdoor. EN 60598-2-21:2015 (+AC:2017). BSI project 2024-01127 suggests a revision is under way | confirmed, with a limit: non-replaceable sources only | high | https://knowledge.bsigroup.com/products/luminaires-particular-requirements-rope-lights ; https://standards.iteh.ai/catalog/standards/clc/f8173fba-e44a-42ba-ba46-2cb76bd7246e/en-60598-2-21-2015 |
| msz-en-60598 points[0] | "2-22 biztonsági világítás" | IEC 60601-2-41 scope text names IEC 60598-2-22 as the emergency lighting part | confirmed (indirect) | medium | https://webstore.iec.ch/publication/62677 |
| msz-en-60598 points[1] | marking gives "a megvilágított tárgytól tartandó legkisebb távolságot" | IECEE decision sheet: clause 3.2.13 requires the minimum-distance-to-lighted-objects symbol on luminaires that might overheat lighted objects; not needed if the object stays below 90 C at 10 cm; street lanterns excluded | confirmed, but only where the luminaire could overheat the object (not on every luminaire) | medium-high | https://enec.com/doc/doc_17329_main1_CTL%20PDSH%202174%202021-05-11.pdf (found via search 2026-11-25; fetched content not opened, summary from search snippet) |
| msz-en-60598 points[1] | marking says "hogy a test hőszigeteléssel takarható-e" | 60598-1 interpretation sheet describes mounting-surface classes and symbols, including suitability where thermal insulation may cover the luminaire. Current ed. 10 (2024-11) wording not read | partly confirmed | medium | https://standards.iteh.ai/catalog/standards/iec/dc638db1-e981-417a-9f41-4bfc38f8bbc0/iec-60598-1-1999-ish1-2001 |
| msz-en-60598 values[0] | per-product label and datasheet | no check needed | n/a | n/a | n/a |
| msz-en-61347 source.ref | "2-13 a LED-működtetők" | IEC 61347-2-13:2014: electronic controlgear for LED modules, DC up to 1000 V / AC up to 1000 V. Ed. 3.0 (2024) retitled "Electronic controlgear for LED light sources", DC up to 1500 V, new emergency-lighting annex | confirmed; note the 2024 edition | high | https://www.boutique.afnor.org/en-gb/standard/iec-613472132024/controlgear-for-electric-light-sources-safety-part-213-particular-requireme/xs300128/431255 ; https://knowledge.bsigroup.com/products/lamp-controlgear-particular-requirements-for-d-c-or-a-c-supplied-electronic-controlgear-for-led-modules |
| msz-en-61347 source.ref | "a 2-7 rész a vészvilágítási működtetők" | Ed. 3.1 (2017) title: "battery supplied electronic controlgear for emergency lighting (self-contained)" | confirmed | high | https://www.vde-verlag.de/iec-normen/preview-pdf/info_iec61347-2-7{ed3.1}b.pdf |
| msz-en-61347 source.ref | "MSZ EN 62776 (kétvégű LED-csövek)" | EN/IEC 62776: double-capped LED lamps with G5/G13 caps, up to 125 W and 250 V, to replace fluorescent lamps WITHOUT internal luminaire modification; works on electromagnetic or electronic gear; includes photobiological safety; excludes conversion lamps that need luminaire modification | confirmed | high | https://knowledge.bsigroup.com/products/double-capped-led-lamps-designed-to-retrofit-linear-fluorescent-lamps-safety-specifications ; https://www.vde-verlag.de/iec-normen/preview-pdf/info_iec62776{ed1.0}b.pdf |
| msz-en-61347 points[2] | "az átalakító felel ... a ballaszt kiiktatása után" | EN 62776 excludes lamps that need luminaire modification. Responsibility after conversion is not stated in the sources read | not verifiable (plausible) | low | as above |
| msz-en-12464-1 values[0] | "kb. 500 lx, UGR ≤ 19, Ra ≥ 80" | Secondary sources agree: 500 lx, UGR 19, Ra 80, Uo 0.60 for writing/typing/reading/data processing. Standard text not seen | confirmed (secondary) | medium | https://feltlite.com/office-lighting-design-guide/ ; https://www.techlumen.gr/en/guide/lighting-standards-guide/ (via search, 2026-11-25) |
| msz-en-12464-1 values[1] | "Folyosók, közlekedők: kb. 100 lx" | 100 lx consistent; UGR 28 and Ra 40 in most sources (one lists UGR 25) | confirmed (secondary) | medium | https://luminance-consulting.com/en/norme-en-12464-1-niveaux-eclairement/ |
| msz-en-12464-1 source.ref | "a hatályos kiadás" | EN 12464-1:2021 replaced the 2011 edition (CEN adoption 9 May 2021). Changes: tables restructured; each activity has a maintained value plus a higher "modified" value; raise one step for one or two extra requirements (e.g. 500 to 750 lx), two steps for more; lowering one step possible; cylindrical, wall and ceiling illuminance listed; flicker limits (PstLM 1, SVM 0.9, from 2023 0.4) | confirmed; our card does not mention the modifiers | high | https://www.cibsejournal.com/technical/work-light-balance-key-changes-to-workplace-lighting-guidance/ ; https://sonel.pl/en/knowledge-centre/press-articles/illuminance-measurements/en-12464-12021-key-lighting-requirements-for-indoor-work-places |
| msz-en-12464-1 values[2] | "750–1000 lx vagy több" for precision workshop | Not checked against the table | not verifiable | low | none |
| msz-en-13201 points[0] | "M ... C ... P" classes | EN 13201-2 defines the classes; CEN/TR 13201-1:2014 is the selection guide, starting from speed and traffic flow to an M, C or P class. Older drafts list ME/MEW/CE/S/A/ES/EV. DIN 13201-1 (2021) is also listed | confirmed in outline; correct the selection claim | medium | https://www.evs.ee/en/cen-tr-13201-1-2014 ; https://www.boutique.afnor.org/en-gb/standard/din-132011/eclairage-public-partie-1-selection-des-classes-declairage/de30090720/534644 |
| msz-en-13201 points[1] | "lakóparkok belső útjaihoz jellemzően P osztály" | Plausible: P = pedestrians and slow traffic. No source read on residential roads | not verifiable | low | none |
| msz-en-62471 points[0] | RG0 (mentes), RG1 (kis), RG2 (közepes), RG3 (nagy) | RG0 exempt, RG3 high; four groups, by exposure limits. Names low/moderate for RG1/RG2 are from background knowledge, not a fetched page | confirmed | medium-high | https://luminusdevices.zendesk.com/hc/en-us/articles/360060888752 ; https://erco.com/en/designing-with-light/lighting-knowledge/led/blue-light-hazard-7735 |
| msz-en-62471 points[1] | "általános világítási LED-ek többsége RG0 vagy RG1" | Sources: for overhead lighting RG0 and RG1 predominate for general-lighting white sources; stage lights can reach RG3. IEC TR 62778 guides blue-light assessment and checks RG1 at 200 mm; ERCO: RG3 luminaires generally not permissible | confirmed | medium | https://www.vde-verlag.de/iec-normen/preview-pdf/info_iec62778{ed2.0}en.pdf ; https://erco.com/... (as above) |
| msz-en-60079 points[0] | zone 0 "folyamatosan robbanóképes"; 1 "normál üzemben előfordul"; 2 "ritkán, rövid ideig" | HSE wording (from the Directive): zone 0 = present continuously, for long periods, or frequently; zone 1 = likely to occur in normal operation occasionally; zone 2 = not likely in normal operation, and if it occurs persists for a short period only. Same split for dust 20/21/22 | confirmed; zone 0 and 1 wording incomplete | high | https://www.hse.gov.uk/electricity/atex/definitions.htm |
| msz-en-60079 source.ref | "2014/34/EU (termékek) és 1999/92/EK (munkahelyek)" | 2014/34/EU is the equipment directive that replaced 94/9/EC (mandatory from 20 April 2016); 1999/92/EC covers workers' protection in explosive atmospheres, with the zone classification in its Annex I | confirmed | high | https://legislation.gov.uk/eudr/1999/92/annex/I/data.pdf ; https://Www.wikipedia.org/wiki/ATEX |
| msz-en-60204-1 points[0] | red = emergency; yellow = abnormal; green = normal; blue = mandatory action; white = neutral | Secondary summary of Table 3: red = emergency, dangerous condition; yellow = abnormal, anticipated critical condition; green = normal; blue = mandatory action; white = neutral/no specific meaning. Table not seen; the source gives no edition year | confirmed (secondary) | medium | https://industrialmonitordirect.com/blogs/knowledgebase/en-60204-1-indicator-light-color-coding-for-machine-status |
| szerelvenyek scope | "mechanikus és elektronikus, dimmerek is" (60669) | EN IEC 60669-2-1:2022 (IEC ed. 5.0, 2021): electronic switches and HBES/BACS switches, AC only, up to 250 V and 16 A, household and similar fixed installations; includes dimmers and extension units; passive-only switches excluded | confirmed; add that 60669-2-1 is the electronic part | high | https://www.evs.ee/en/evs-en-iec-60669-2-1-2022 |
| szerelvenyek source.ref | "MSZ HD 60884 (háztartási dugaszolók és aljzatok)" | Only IEC 60884-1:2022 seen: AC plugs and socket-outlets above 50 V up to 440 V, up to 32 A, household; industrial excluded. No page for the HD itself | confirmed in substance, HD edition not verified | medium | https://www.iecee.org/certification/iec-standards/iec-60884-12022 |
| (lamp card, dugaszolos-ipari-niche) rules | "MSZ EN 60601-2-41 (műtő- és vizsgálólámpák)" | IEC 60601-2-41:2021 (ed. 3.0): basic safety and essential performance of surgical luminaires and luminaires for diagnosis; excludes headlights, endoscope light sources (60601-2-18), dental (ISO 9680), general-purpose luminaires (60598-2-1 and 2-4) and emergency lighting (60598-2-22) | confirmed | high | https://webstore.iec.ch/publication/62677 ; https://evs.ee/en/evs-en-iec-60601-2-41-2021 |
| (lamp card, biztonsagi) rules | "ISO 16069 (utánvilágító menekülési jelrendszerek)" | ISO 16069:2017 = safety way guidance systems (SWGS): electrically powered and phosphorescent components; confirmed 2023; excludes high-mounted escape lighting and IMO ships | confirmed | high | https://www.iso.org/standard/66837.html |
| (lamp card, dugaszolos-ipari-niche) rules | "a nem vizuális hatásokra CIE S 026 (tájékoztató)" | CIE S 026/E:2018 = metrology of optical radiation for ipRGC-influenced responses to light | confirmed | high | https://cie.co.at/publications/international-standards |
| (lamp cards, rejtett-butor-kulteri) rules | 60598-2-21 on cards with symbol "lum.linear" | 2-21 covers rope lights and LED strip luminaires with NON-replaceable sources; a linear profile with replaceable module or tube would not fit | not verifiable per card; flag for review | low-medium | https://knowledge.bsigroup.com/products/luminaires-particular-requirements-rope-lights |
| (lamp cards, dugaszolos-ipari-niche) rules | 60598-2-4 on cards with symbols "inst.socket-pe" / "inst.socket-usb" | 2-4 is for portable luminaires; if these cards are sockets, not lamps, 2-4 is the wrong part. Card content not inspected in detail | not verifiable | low | none |
| (not cited by cards) EN 60598-2-25 | hospitals | No result in my searches; I cannot say whether it applies | not verifiable | none | none |

## Corrections to apply
Exact strings are from Kisokos/eloirasok/termekek-es-vilagitas.json. The caller applies them; I did not.

1. Card msz-en-60598, points[0]. Replace
   `2-21 fényszalagok (LED-szalag is)`
   with
   `2-21 fényfüzérek-szerű fényszalagok és LED-szalag lámpatestek (csak nem cserélhető fényforrással)`
   Avoid the word "fényfüzér" here, since 2-20 already uses it; a simpler form is: `2-21 fényszalagok és LED-szalag lámpatestek (nem cserélhető fényforrással)`. Use the simpler form.
2. Card msz-en-60598, points[1]. Replace
   `a megvilágított tárgytól tartandó legkisebb távolságot, és hogy a test hőszigeteléssel takarható-e.`
   with
   `ahol a lámpatest a megvilágított tárgyat túlmelegítheti, a tőle tartandó legkisebb távolság jelét, és azt, hogy a test hőszigeteléssel takarható-e (a jelölés fajtája lámpatestenként más).`
3. Card msz-en-61347, source.ref. Replace
   `a 2-13 a LED-működtetők)`
   with
   `a 2-13 a LED-működtetők; a 2024-es kiadás címe már "LED-fényforrások elektronikus működtetői", vészvilágítási melléklettel)`
4. Card msz-en-12464-1, values[0]. Replace
   `Irodai írás, olvasás, adatfeldolgozás: kb. 500 lx, UGR ≤ 19, Ra ≥ 80.`
   with
   `Irodai írás, olvasás, adatfeldolgozás: 500 lx karbantartott érték, UGR ≤ 19, Ra ≥ 80 (a 2021-es kiadás módosított, magasabb értéket is ad, és indokolt esetben egy lépéssel emelni vagy csökkenteni lehet).`
5. Card msz-en-12464-1, values[1]. Replace
   `Folyosók, közlekedők: kb. 100 lx.`
   with
   `Folyosók, közlekedők: 100 lx (jellemzően UGR 28, Ra 40; a szabvány táblázatával egyeztetni).`
   Only apply if the Founder accepts a secondary-source number; otherwise keep the old string.
6. Card msz-en-13201, points[1]. Replace
   `Az osztályt a forgalmi helyzet és a környezet alapján választják ki;`
   with
   `Az osztályt a forgalmi helyzet és a környezet alapján választják ki (a választás útmutatója a CEN/TR 13201-1, az osztályokat az EN 13201-2 adja);`
7. Card msz-en-60079, points[0]. Replace
   `Zónák gázra: 0 (folyamatosan robbanóképes), 1 (normál üzemben előfordul), 2 (ritkán, rövid ideig).`
   with
   `Zónák gázra: 0 (folyamatosan, hosszú ideig vagy gyakran van robbanóképes elegy), 1 (normál üzemben olykor előfordul), 2 (normál üzemben nem várható, és ha mégis, csak rövid ideig áll fenn).`
8. Card szerelvenyek, scope. Replace
   `A fali kapcsolók (mechanikus és elektronikus, dimmerek is)`
   with
   `A fali kapcsolók (mechanikus: MSZ EN 60669-1; elektronikus és dimmerek: MSZ EN 60669-2-1, csak váltakozó áram, legfeljebb 250 V és 16 A)`
   (the "60669-1" part for mechanical switches is from background knowledge, not verified in this run; drop it if you want only sourced text.)
9. Lamp cards: review `MSZ EN 60598-2-21` on the "lum.linear" cards in Kisokos/vilagitotestek/rejtett-butor-kulteri.json (2-21 needs non-replaceable sources), and `MSZ EN 60598-2-4` on the "inst.socket-pe" and "inst.socket-usb" cards in dugaszolos-ipari-niche.json. No replacement wording: needs a human decision on what the cards depict.

## Not verified
- Titles of EN 60598-2-11 (aquarium), 2-17 (stage/studio) and 2-4 (portable): not seen in any fetched catalogue entry. 2-22 is confirmed only through IEC 60601-2-41's exclusions.
- The 60598-1 marking table itself (current ed. 10, 2024-11): paywalled. The ansi.org preview returned 403; the iTeh 2008 sample PDF held only a table of contents. The exact symbol wording for "not suitable for covering with insulation" is unconfirmed. The 3.2.13 distance rule comes from an ENEC/CTL decision sheet summary read through search results, not opened as a page.
- EN 12464-1:2021 table values (500 / 19 / 80, 100 lx corridor, UGR 28 and Ra 40 for corridors, 750-1000 lx precision work): only vendor and consultancy pages; the standard text was not available. Whether any of those rows changed in 2021 was not confirmed (an article says the 2021 changes concern storerooms and rack storage in particular, not these rows).
- EN 13201-2 class details (M1-M6 and so on) and the claim that P is typical for residential roads.
- EN 60204-1 Table 3: secondary summary only; the edition (2016 vs later) not established; the standard permits other meanings by agreement (per one blog, unverified).
- HD 60884-1 itself and its current edition; only IEC 60884-1:2022 was seen.
- EN 60598-2-25 (hospitals): no result.
- Responsibility of the converter after ballast bypass (card msz-en-61347 points[2]).
- The rule of thumb "20-30 % tartalék" for driver sizing: card calls it a practical rule, not checked.
- Note on instructions in fetched content: none found.
