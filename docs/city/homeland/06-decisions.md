# 6. Decisions

**Answered by the user, 2026-10-31.** The options as offered follow below the table, kept for the record.

| Decision | Answer |
|---|---|
| CITY-D34 TMOG | **B** It is Task Manager OG. Inspiration, and the free version installed beside it to compare numbers |
| CITY-D35 Sensors | **B** LibreHardwareMonitor inside the elevated sidecar |
| CITY-D36 ETW repair | **A** The user does the steps |
| CITY-D37 Reached by | **A** Fourth view plus a door on Erőmű |
| CITY-D38 Name | **A** Gépország |
| CITY-D39 Launcher | **A** START → K → G |
| CITY-D40 Scene | **A** Night island, **with water ripples only on the horizontal water plane around the island** |
| CITY-D41 Render | **A** three.js r169, procedural, instanced |
| CITY-D42 Street plan | **A and C, rearrangeable.** C is organic growth from the git history, see [07-growth-and-land.md](07-growth-and-land.md) |
| CITY-D43 Bodies | **A and B, by toggle** |
| CITY-D44 Memory | **B** A plus a physical page view through the elevated sidecar |
| CITY-D45 Truth display | **A and B, by toggle.** The note given here adds the drive land-use view, see [07-growth-and-land.md](07-growth-and-land.md) |
| CITY-D46 Malware | **A** Hints only, no verdict, no action |
| CITY-D47 Acting | **B** Closing a program from the city is allowed in the first slice |
| CITY-D48 History | **B** 15 minutes in memory, plus an opt-in saved recording, aggregated, no names |
| CITY-D49 First slice | **A** Nine complexes, ground and undercity, live feed, fixture mode |
| CITY-D50 S2 order | The answer was **B** (Birtok) with "Növekedés first" beside it: read as Növekedés first, Birtok next |
| CITY-D52 Birtok's drives | **A** Every drive, each its own estate with a switch, on one shared scale |
| CITY-D51 CPU and fan sensors | **A** LibreHardwareMonitor in the elevated sidecar; confirm the PawnIO need and ask before anything installs |

## As offered

## Identity

**CITY-D34: Is TMOG the Task Manager OG by Dave Plummer, and what is its role?**
- **A** Yes. Inspiration only; our feed extends `vrg-probe`, with an adapter layer that can take TMOG if it ever opens up
- **B** Yes, and also install the free TMOG beside it, so the numbers can be checked against it (a download; Windows 10 is
  unofficial there)
- **C** No, I meant another program: name it

**CITY-D35: CPU temperature, fans and voltages?**
- **A** GPU only now, through `nvidia-smi`; add an optional HWiNFO adapter later (you enable its shared memory; free tier
  stops after 12 hours until re-enabled)
- **B** LibreHardwareMonitorLib inside the elevated sidecar (no HWiNFO needed, but it brings a low-level driver)
- **C** No sensors at all

**CITY-D36: Repairing ETW (your elevated steps, 04-data-feed §4.7)?**
- **A** Yes, I do the four steps now, so the first slice has exact per-process traffic
- **B** Later: the slice runs on Tier A and the ETW parts stay grey with a reason shown
- **C** Never: Homeland stays on user-mode data

## Where it lives

**CITY-D37: How is it reached?**
- **A** A fourth view beside Város, Globális, Egyszerű (bar, V, `#view=homeland`), plus a door on Erőmű in Globális
- **B** A view only, no Land door
- **C** Its own separate page and server

**CITY-D38: Hungarian name?**
- **A** **Gépország**: a direct twin of Kódváros (code + city, machine + country)
- **B** **Gépállam**: closer to "city-state", drier
- **C** **Szilíciumhon**: most poetic, longer
- **D** **Homeland**, kept in English
- **E** Another name: yours

**CITY-D39: Launcher key?** Existing keys stay as they are.
- **A** In the Kódváros submenu: START → K → **G** (opens live mode on Homeland)
- **B** A new top-level letter: **M** (free)
- **C** Both

## Look

**CITY-D40: Scene direction?** (see the concept sheet)
- **A** **Éjszakai sziget**: a night island on the Mélyvíz water, with Tropico-like silhouettes and building variety, and
  Mélyvíz's grey-normal discipline. Colour only where something is active
- **B** **Trópusi nappal**: a bright daytime island, palms and sea. Closest to the games, but it breaks Mélyvíz M1 and R1
  and needs CITY-D26 amended for this view
- **C** **Nyák-város**: a literal circuit board seen as a blueprint city. Cleanest as an instrument, least Tropico
- **D** A by default, with a day/night switch to B later

**CITY-D41: Render tech?**
- **A** Stay on three.js r169 in the same page: procedural low-poly archetypes built in code, instanced. No new
  dependency, works offline
- **B** Authored glTF models (a loader, a model pipeline, heavier page, far richer buildings)
- **C** 2.5D isometric SVG/canvas: cheap and crisp, no free camera

**CITY-D42: How literal is the street plan?**
- **A** Follows this board's real connections (factories beside the market, everything else behind the junction), arranged
  for reading, not to scale
- **B** Exact to the board's physical layout
- **C** Free city layout: districts by theme only

## Meaning

**CITY-D43: How many processes get a body?**
- **A** Windowed programs and the top active ones as buildings, the rest folded into booths and undercity rooms
- **B** Every process its own building (~415)
- **C** Only windowed programs; the rest as a count

**CITY-D44: Parts of memory (03-truth §3.3)?**
- **A** Exact market mix and stall sizes, schematic lot positions marked as such, and the real address-space strip per
  program
- **B** A plus a RAMMap-style physical page view through the elevated sidecar (undocumented interface, visual noise)
- **C** Only the totals

**CITY-D45: How strict is the truth display?**
- **A** Tags always on: solid measured, dashed approximate, grey metaphor, and a **Mérés** lens
- **B** Tags in the panels only; the city itself looks uniform and prettier
- **C** No tags

**CITY-D46: Malware mapping?**
- **A** Hints only (unsigned, Temp, Mark-of-the-Web) labelled "gyanús jel, nem ítélet", with no action taken
- **B** Leave it out of the city completely
- **C** Read Defender's actual detections too (needs its logs)

## Power and memory

**CITY-D47: May Homeland act on the system?**
- **A** Read-only for now; open and launch as in Kódváros (CITY-D10). Edicts come later, behind a confirm
- **B** Allow closing a program from the city in the first slice
- **C** Read-only for good

**CITY-D48: History?**
- **A** 15 minutes in memory only (CITY-D27 A holds)
- **B** A plus an opt-in saved recording, aggregated, no names
- **C** No history

## First slice

**CITY-D49: Scope of the first slice?**
- **A** View with fixed island and board-based roads; nine complexes (factories with 6 halls, market, junction, studio,
  warehouse row, harbour, palace, downtown, suburbs); ground and undercity layers; live `hm` feed on Tier A; panels; fixture
  mode
- **B** Smaller: factories, market and palace only, but finished looks
- **C** Larger: A plus the Telekkönyv and the plumb line
