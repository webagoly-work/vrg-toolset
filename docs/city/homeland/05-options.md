# 5. Further options

Everything here extends the same thought. None of it is in the first slice. **Effort:** S = one session · M = 2–3
sessions · L = a phase · XL = several phases. **Data:** A = user mode · B = ETW · C = driver · – = none needed.
★ marks the ones most worth doing first.

## Time: history and replay

| # | Option | What it does | Effort | Data |
|---|---|---|---|---|
| H1 ★ | **Pillanatkép** | Freeze the city now and walk around it while the numbers hold still | S | A |
| H2 ★ | **Mi történt?** | 15-minute memory-only strip: the last spikes as flags on a timeline | M | A |
| H3 ★ | **Fekete doboz** | Scrub back through the ring buffer: replay the city as it was. TMOG's best idea | M | A |
| H4 | **Lassított felvétel** | Press a key before a launch; replay it at 1/10 speed from a 100 ms burst | M | B |
| H5 | **Nap krónikája** | Evening summary: busiest program, hottest hour, peak memory. Saved only with opt-in | M | A |
| H6 | **Alapítás** | The boot replayed as the founding of the state, from the boot performance log | L | B |
| H7 | **Évszakok** | The machine's uptime as seasons; a fresh boot is spring | S | A |
| H8 | **Összevetés** | Two recordings side by side: before and after a change | L | A |

## Game layers: the state as a game

| # | Option | What it does | Effort | Data |
|---|---|---|---|---|
| G1 ★ | **Állami költségvetés** | CPU, RAM, disk and thermal as a one-line budget, with a surplus or deficit | S | A |
| G2 ★ | **Rendeletek** (edicts) | Named actions behind a confirm: close a program, set priority, disable a startup item. Follows CITY-D10 | L | A |
| G3 | **Elégedettség** | A public mood score from responsiveness: hangs, queue, memory pressure | M | A |
| G4 | **Népszámlálás** | A census page: population by class, immigrants this week, emigrants | S | A |
| G5 | **Választások** | Which background program earned its place: votes by use vs resident memory | M | A |
| G6 | **Teljesítmények** | Quiet milestones: 30 days up, first 10 GB copy, zero-crash week | S | A |
| G7 | **Forgatókönyvek** | Stress drills: load a heavy Planner job and see where the state cracks | L | A |
| G8 | **Mentőosztag** | One button closes the worst offender, with a preview of what is regained | M | A |
| G9 | **Kereskedelmi mérleg** | Exports and imports: uploaded vs downloaded this week, by country | M | B |

## Alerts and watchfulness

| # | Option | What it does | Effort | Data |
|---|---|---|---|---|
| A1 ★ | **Riadó** | Memory pressure, a full disk or a hung window raises a siren and a Now-ribbon line | S | A |
| A2 ★ | **Idegen a városban** | A new, unsigned or never-seen program is marked until accepted. A hint, not a verdict | M | A |
| A3 | **Csempész-őrjárat** | Programs starting from Temp or Downloads, or running with Mark-of-the-Web | M | A |
| A4 | **Szivárgás-figyelő** | A stall that only ever grows gets a warning sign: a likely memory leak | M | A |
| A5 | **Éjjeli őr** | What ran while you were away: a morning report | M | A |
| A6 | **Lemez-egészség** | The brick warehouse gets cracks from SMART data | M | C |
| A7 | **Hő-vihar** | A heat storm crosses the city under load | S | A/C |
| A8 | **Kifelé telefonáló** | A program that talks out when nothing should: a light at the pier | M | B |
| A9 | **Két hadsereg** | Defender and Avast both on this PC: show what the double scanning costs | S | A |

## Exploring and zoom

| # | Option | What it does | Effort | Data |
|---|---|---|---|---|
| Z1 ★ | **Függőón** | The plumb line from a building down to its services, drivers and hardware | M | A |
| Z2 ★ | **Telekkönyv** | A program's true address-space strip | M | A |
| Z3 | **Belépés a csarnokba** | Fly into a factory hall: thread lines, kernel vs user, frequency | L | A |
| Z4 | **Szálak útja** | Per-thread view of one program, with wait reasons as "what is it waiting for?" | M | A |
| Z5 | **Betöltött DLL-ek** | Every program's shared stalls: which programs share what | M | A |
| Z6 | **Kérdezz a városról** | The query bar for processes: `legtöbb RAM`, `hálózaton`, `session 0` | M | A |
| Z7 | **Kódváros híd** | Click a process with a repo file open and fly to that building in the Város | M | B |
| Z8 | **Kapcsolati háló** | Who talks to whom locally: named pipes, loopback ports | L | B |
| Z9 | **Séta** | First-person walk through the streets, with labels in place | L | – |

## Scenarios

| # | Option | What it does | Effort | Data |
|---|---|---|---|---|
| S1 ★ | **Program-életút** | Follow one launch from permit to first window with step labels | M | B |
| S2 | **Egy fájlmásolás útja** | Follow one large copy from warehouse to warehouse | M | B |
| S3 | **Egy kattintás útja** | Teaching tour: from the key press through the OS to the monitor. Part scripted, tagged J | L | – |
| S4 | **Egy weblap útja** | DNS, a socket, packets, parsing, drawing | M | B |
| S5 | **Mentés-nap** | BACKUP run shown as a convoy to the backup warehouse | M | A |
| S6 | **Claude-nap** | A full agent session seen from the machine: workshop, contractors, load | M | A |
| S7 | **Oktatófilm** | Tours in the existing Városnézés format: "how a PC works" for a non-technical guest | M | – |

## Mapping further

| # | Option | What it does | Effort | Data |
|---|---|---|---|---|
| M1 | **Föld-kapcsolat** | The Land's Pályaudvar and Határ as foreign ports; other PCs as neighbouring states | M | A |
| M2 | **Router-tartomány** | After OpenWrt: the router as a real neighbour (CITY-D24 re-ask) | L | A |
| M3 | **Telefon-gyarmat** | VRG Mobile as an overseas colony, with a ferry for files | L | A |
| M4 | **ESP-provincia** | ESP32 boards and the CYD as provinces on the USB and Wi-Fi coasts | L | A |
| M5 | **Nyomtató-kiadó** | The printer queue as a print shop | S | A |
| M6 | **Virtuális államok** | WSL or a VM as a state inside a walled enclave | L | A |
| M7 | **Nemzetközi kereskedelem** | Cloud services as trading partners, from DNS names by class | M | B |
| M8 | **Felhő-gyarmat** | The Cloudflare ring (CITY-D29–D33) as an offshore territory | L | A |

## Surfaces

| # | Option | What it does | Effort | Data |
|---|---|---|---|---|
| F1 ★ | **Élő tapéta** | Homeland as the Lively wallpaper at low rate, through the existing `#mode=wallpaper` | S | A |
| F2 | **Fedőréteg** | The Electron overlay opens Homeland on the hotkey | S | A |
| F3 | **CYD-kijelző** | The budget line on the CYD beside the keyboard | M | A |
| F4 | **Telefon** | The state's health on VRG Mobile (M13 relay) | M | A |
| F5 | **Hangkép** | City sound: factories hum with load; off by default | M | A |
| F6 | **Képeslap** | A share card of the city today, with the machine's stats and no process names | S | A |
| F7 | **Falitábla** | Wallboard tour for the second monitor | S | A |

## Back into Kódváros (later, out of scope now)

| # | Option | What it does | Effort | Data |
|---|---|---|---|---|
| K1 | **Archetípus-könyvtár** | The building kit moves to the Város: code by purpose gets its own building types | L | – |
| K2 | **Rétegek a Városban** | Tests, builds and generated files as undercity layers | L | – |
| K3 | **Metaforaszótár** | One shared dictionary for both cities, so a Bank means money in each | M | – |
| K4 | **Igazság-lencse** | The measured/approximate/metaphor rule applied to Kódváros's own visuals | M | – |

## Picked from these: a suggested order after the slice

1. Z2 Telekkönyv, Z1 Függőón: they answer the user's central questions.
2. H1 + H2 + H3: freeze, spike flags, black box.
3. G1 budget, A1 alerts, A2 stranger.
4. S1 program life, then F1 wallpaper.
5. G2 edicts only once the view is trusted.
