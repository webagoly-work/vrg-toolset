# 1. Topology: the PC as a city-state

Every part of this PC and every class of software, mapped to a place, a building archetype or a moving unit, each with
its reason. Names are the proposed Hungarian UI names; the working name of the whole is **Gépország** (CITY-D38).

The tag after each row says how real the live behaviour is: **M** measured, **K** approximate (közelítő), **J** metaphor
only (jelkép). The evidence for each tag is in [03-truth.md](03-truth.md). Tags assume the feed in
[04-data-feed.md](04-data-feed.md), with ETW repaired where a row says ETW.

## 1.1 The ruling idea

Tropico and Cities: Skylines both say one thing that fits a computer unusually well: **a small sovereign state with
scarce land, a power budget, imports, exports and a ruler who issues orders**. The mapping rule is:

> **Hardware is the land and its fixed infrastructure. The operating system is the state. Programs are the population
> and the economy. Data is the cargo.**

So hardware never moves, the state is always present, the economy opens and closes, and cargo is the only thing in
constant motion. A second rule keeps the city honest: **the street plan is the real wiring of this board.** RAM connects
directly to the CPU, so the market sits next to the factories. Disks, USB, LAN and audio all go through the chipset, so
they sit behind one railway junction, and the single line from that junction to the CPU can really jam.

This machine's real parts, read from it on 2026-10-31:

| Part | This PC |
|---|---|
| Board, firmware | Gigabyte B560M DS3H V2, AMI UEFI F4 |
| CPU | Intel Core i5-10400F, 6 cores, 12 threads, 12 MB L3 |
| RAM | **one** 16 GB DIMM at 2666 MT/s, channel B; the second slot is empty |
| GPU | NVIDIA GeForce GTX 1050 Ti, 4 GB, 1920×1080 at 60 Hz, no integrated graphics |
| Storage | Crucial BX500 1 TB (C:) · Samsung 840 120 GB (H:, E:) · ST9250827AS 250 GB HDD (G:, D:) · Seagate M3 1 TB USB (F:) |
| Network | Realtek GbE · Realtek RTL8192CU USB Wi-Fi · Bluetooth PAN |
| Audio | Realtek HD · NVIDIA HDMI audio · virtual: Steam, NVIDIA |
| Population | ~415 processes, ~6 900 threads, 142 running services (105 in svchost), 212 running drivers, 233 PnP devices |

The empty second DIMM slot becomes a real **empty lot beside the market**: a truthful and slightly pointed detail,
because one DIMM means the memory road has a single lane.

## 1.2 Hardware: the land and its complexes

| Part | Place (UI name) | Archetype | Why | Live | Tag |
|---|---|---|---|---|---|
| Motherboard | **Alaplap-sziget**: the island itself | Terrain, street grid | It carries and connects everything and does nothing by itself, like land and roads | Road glow from the buses | M |
| CPU package | **Gyárnegyed** (factory district) | Heavy-industry complex | The place where raw input becomes finished output | Total load = smoke and shift lights | M |
| Each of 6 cores | **Gyárcsarnok 1–6** | Factory hall | One real production unit | Per-core kernel / user / idle | M |
| Each of 12 threads | **Gyártósor** A/B in each hall | Two assembly lines | SMT shares one hall's machines between two lines; that is why 12 "CPUs" do not equal 12 factories | Per-logical load | M |
| CPU frequency | **Műszakrend** | Hall chimney beat | Faster shift, more output, more heat | Clock counter | M |
| L1/L2 cache | **Munkapad** in each hall | Workbench | Tiny and within arm's reach | Not readable; shown as fixed scenery | J |
| L3 cache | **Közös udvar** | Shared yard between halls | Shared by all cores, faster than walking to the market | Not readable without a driver | J |
| Integrated memory controller | **Piackapu** | Toll gate at the end of the factory road | It is inside the CPU, so the road to RAM starts at the factories | Fixed | J |
| Memory bus | **Piac utca** | Single-lane market street | One DIMM, one channel | Bandwidth needs a driver; RAM pressure is shown | K |
| RAM | **Piac** | Open market square with numbered lots | The user's image: empty lots that programs rent. Working memory is temporary, rented and scarce | See §1.5 | M/K |
| Empty DIMM slot | **Üres telek** | Fenced empty lot with a "kiadó" sign | True to this board | Fixed | M |
| Pagefile | **Túlcsorduló raktár** | Tents behind the warehouse | Stock that no longer fits in the market | Pagefile use | M |
| Chipset (PCH) | **Rendező** | Railway marshalling yard | Everything except RAM and the GPU changes trains here | Sum of the disk, USB and LAN flows | K |
| DMI link | **Fővonal** | Double main rail line | The one line between the yard and the factories; it can jam | Inferred from the sum of its traffic | K |
| GPU | **Filmgyár** | Studio complex with sound stages | It paints the picture the city's citizens see | Per-engine load (3D, Copy, Video) | M |
| VRAM | **Kellékraktár** | Prop store inside the studio | The studio's private stock | Dedicated and shared memory, per process | M |
| GPU video engines | **Vágószoba**, **Vetítő** | Editing room, projection room | Encode and decode are separate engines | Per-engine load | M |
| Monitor | **Óriásvászon** | Drive-in screen on the shore | The studio's output, and the frame rate is its pulse | Refresh known; frame rate only with PresentMon | K |
| PCIe x16 | **Filmgyári út** | Private road from the factories | The GPU hangs off the CPU directly, not the chipset | Copy-engine load stands in | K |
| SSD C: (Crucial) | **Nagy Logisztikai Központ** | Automated high-bay warehouse | The system's fast main store | Per-disk read/write, queue | M |
| SSD H: (Samsung) | **Levéltár** | Fortified archive with a vault | Holds the repo and the work: source code in a vault, as the user asked | Per-disk; per-folder only with ETW | M/K |
| HDD G: | **Téglaraktár** | Old brick warehouse with a gantry crane | Slow, mechanical, and seek queues show as a waiting crane | Per-disk queue, % busy | M |
| USB disk F: | **Uszályraktár** | Barge moored at the shore | It comes and goes; it travels over USB | Presence, per-disk rate | M |
| System partitions D:, E: | **Óvóhely** | Sealed bunkers | Recovery and boot; nobody goes in | Size only | M |
| Ethernet NIC | **Tengeri kikötő** | Deep-water harbour | The heavy, reliable connection to the outside | Per-NIC bytes | M |
| USB Wi-Fi | **Rádiótorony** | Mast near the suburbs | Wireless; it really hangs on a USB stub | Per-NIC bytes | M |
| Bluetooth | **Halászmóló** | Small jetty | Short range, small boats. Existing buoys carry over | Paired devices, battery | M |
| Audio (Realtek) | **Hangverseny-terem** | Concert hall with sound towers | Existing per-program sound towers move here | Peak meters per program | M |
| HDMI audio, virtual devices | **Vendégszínpad** | Side stage | Steam and NVIDIA virtual devices are devices that exist only in software | Listed | M |
| USB controller, hubs | **USB-falu** | Village on a branching lane | The real port tree: a village with side streets | Port tree, existing | M |
| Keyboard, mouse | **Küldöncposta** | Messenger post | Input arrives as messages to whoever has the front window | Foreground owner; keystroke content never | K |
| PSU | **Erőmű** | Power station on the edge | Gives the Land's name a literal home | No sensor on this PSU; GPU power reads N/A | J |
| Fans and heat | **Hűtőtornyok** and the weather | Cooling towers; heat haze | Heat is a city-wide budget | GPU temperature now; CPU needs a driver | K |
| Case, sensors, RGB | **Határkő** | Boundary stones | Rarely matters; shown only if a sensor exists | Optional | K |

## 1.3 Firmware and the deep state

| Part | Place | Archetype | Why | Live | Tag |
|---|---|---|---|---|---|
| UEFI/BIOS F4 | **Alapkőletétel** | Foundation stone with an inscription | It ran before anything else existed and hands over once | Version, date | M |
| Boot sequence | **Alapítás** (option) | Replay of the founding | Boot phases exist in the event log | Boot time, phases | K |
| CPU microcode | **Vastörvény** | Iron law tablets under the factories | Rules the factories obey, loaded at boot | Revision if readable | K |
| ACPI, power states | **Éjszakai rend** | Street lamps dimming | Sleep states are the city's night | C-state share needs a driver; idle time is real | K |
| Drivers (212) | **Közműcégek** | Utility companies under the streets | A driver translates between the state and one piece of land, like a water or power company | Listed; per-driver activity only with ETW | K |
| Device tree (233) | **Kataszter** | Land registry | The one complete list of what exists | Listed | M |
| Interrupts, DPC | **Kürtjelek** | Sirens along the streets | Hardware shouting for immediate attention: ~25 000 per second on this PC | Rate, % time | M |
| Kernel | **Palota** | The central palace, the capital building | The state's seat. User: admin control starts here | Kernel CPU time | M |

## 1.4 The state: Windows

| Part | Place | Archetype | Why | Live | Tag |
|---|---|---|---|---|---|
| Scheduler | **Forgalmi Minisztérium** | Tower with a signal mast | It decides which line gets which job; ~34 000 switches per second | Context switches | M |
| Memory manager | **Piacfelügyelet** | Market inspector's office | Assigns lots, evicts, recycles | Page lists, faults | M |
| I/O manager, filesystem | **Vámház** | Customs house at the warehouse row | All file traffic is declared here | Rates | M |
| Registry | **Törvénytár** | Law library in the Palace wing | The state's central rules | Only with ETW | K |
| Event log | **Hivatalos Közlöny** | Official gazette, a newsstand | The state's own record of what happened | Readable | M |
| Task Scheduler | **Kalendárium** | Clock tower | Jobs that wake at set times | Task list and next run | M |
| Services (142) | **Közszolgálat** | Water tower, post, pumping stations | They keep the city running and nobody looks at them | Per-service process CPU | M |
| svchost groups | **Hivatali tömb** | Shared office block | Many services live in one host process: one building, many brass plates | Service → pid | M |
| Explorer | **Városháza** | Town hall facing the main square | Where citizens file requests; it starts most programs | Parent of launches | M |
| Windows Update | **Építésügy** | Scaffolds on state buildings | Changes the state itself | Service state | M |
| Search indexer | **Nyilvántartó** | Clerks with card files | Walks the whole city cataloguing | Process CPU, disk | M |
| Defender, Avast | **Laktanya, őrtornyok** | Barracks and watchtowers | User's mapping: antivirus as military. Two armies stand here, which is a real finding | Their process CPU; a scan shows patrols | M |
| Windows Firewall | **Parti őrség** | Coast guard at the harbour | Decides what may land; extends the Land's Határ | Rules; blocks only with ETW | K |
| UAC, elevation | **Palotaőrség** | Guarded palace gate | An elevated process has passed the gate | Elevation where readable | K |
| cmd, PowerShell, Terminal | **Parancsnoki terem** | Room in the Palace, or a kiosk | User's mapping: elevated command control starts in the Palace. A normal shell is a kiosk on the square | Process; elevation where readable | K |
| Debuggers, Process Explorer, HWiNFO | **Rendőrség** | Police station and patrols | User's mapping: debugging as police. They inspect others | Class list; attached state only for some | K |
| Malware, PUP suspects | **Csempészek** | Smugglers at a dark pier | User's mapping. Never a verdict: "unsigned and from Temp" is a hint, not a finding | Heuristic, never automatic action | J |

## 1.5 RAM as the market

The market square has one lot per fixed unit of memory (proposal: 64 MB, ~255 lots on 16 GB). The **share** of each kind
of lot is real, read from the kernel's page lists. **Which lot** a stall stands on is schematic, because physical
placement is meaningless and shifts constantly. The full reasoning is in [03-truth.md](03-truth.md) §3.

| Lots | Means | Look |
|---|---|---|
| Stalls with an awning | Active working set of a program; colour by owner | Lit, owner's sign |
| Common stalls | Shared pages (DLLs): several programs buy from the same stall | Striped awning |
| State's reserved row | Kernel, nonpaged and paged pool, driver memory | Stone stalls, never rented |
| Crates on the kerb (Modified) | Changed data waiting to go back to disk | Stacked crates, a cart comes |
| Covered stalls (Standby) | Old stock kept in case someone returns | Dim, tarpaulin; first to be cleared |
| Empty lots (Free, Zeroed) | Ready to rent | Bare, swept |

When memory tightens, the market visibly **fills, tarps come off, the tent city behind the warehouse grows**. On this PC
at the time of the survey: 1.9 GB available of 16 GB and 33 GB committed, so this view will be busy from day one.

## 1.6 The population: programs

Software is placed by class, using a small rule file (`CodeCity/homeland-classes.json`: exe or folder pattern →
archetype). An unknown program always lands in the suburbs; nothing is ever dropped. Names here are classes; the concrete
list comes from the running PC, in memory only.

| Class | Place | Archetype | Why | Tag |
|---|---|---|---|---|
| Browser | **Belváros** | Downtown bazaar with many stalls | One program, dozens of processes: tabs as shops in one arcade | M |
| VS Code, editors | **Mérnökiroda** | Drafting office | Where plans are drawn | M |
| Git | **Közjegyző** | Notary | Records, signs and dates every change | M |
| Node, Python, build tools | **Műhelysor** | Workshop row | Short jobs that open and close | M |
| Claude sessions | **Mesterműhely** | A master's workshop with a sign | User's mapping: an agent owns a workshop | M |
| Sub-agents | **Segédek** | Journeymen at the workshop | They come and go, and report back | M |
| Child processes of a session | **Alvállalkozók** | Contractors called in | User's mapping, see §1.8 | M |
| Planner, Inventory, VRG tools | **VRG-ipartelep** | Our own industrial estate | Our tools get a home of their own, connected to the Kódváros | M |
| Workflow Kit, legal | **Ügyvédi iroda** | Lawyer's office | User's mapping | K |
| Quotes, pricing, invoices | **Bank**, **Számvevőszék** | Bank and audit office | User's mapping: money work | K |
| Research, reference, docs | **Könyvtár** | Library, with a reading room | User's mapping | K |
| Historic, archived work | **Múzeum** | Museum at the edge | Parked things stay visible | K |
| Client job folders | **Telekkönyv** | Land office; names blurred (CITY-D27 A) | Client data needs a place, but never a name on a sign | K |
| Media players | **Mozi** | Cinema | Linked to the concert hall and the studio | M |
| Games, Steam | **Vidámpark** | Amusement park | Heavy demand on the studio when it runs | M |
| Office, PDF | **Hivatali negyed** | Office blocks | Ordinary paperwork | M |
| Compression, disk tools | **Csomagoló** | Packing plant | They turn cargo into smaller cargo | M |
| Remote tools, Claude desktop | **Követség** | Embassy | Foreign power on our soil: a local app whose authority is elsewhere | M |
| Virtual drive and bus drivers | **Fantomtelek** | Ghost plots | They claim hardware that does not exist; DAEMON Tools' virtual USB bus is on this PC | M |
| Third-party background tools | **Külváros** | Suburbs | User's mapping: independent contractors at the edge | M |
| Portable programs on H: | **Vándorműhely** | Workshop on wheels | They were never installed | K |

The mapping from a *file's meaning* to an office (legal, bank, library) is **K**: it comes from folder rules. The light
over the lawyer's office means "a program touched a file under the Workflow Kit's legal path", which needs ETW or a
Claude hook event. It does not mean the program is doing legal work.

## 1.7 Moving units

| Unit | Carries | Route | Real signal | Tag |
|---|---|---|---|---|
| **Teherautó** | File read/write | Warehouse ↔ factory or market | Per-disk rate; per-process with ETW | M/K |
| **Vonat** | Bulk transfer through the chipset | Rendező ↔ Fővonal | Disk + USB + LAN sum | K |
| **Csomagfutár** | Network packets, small | Harbour ↔ building | Per-NIC; per-process with ETW | M/K |
| **Hajó, repülő** | Downloads, existing | Sea → harbour | Existing `cargo` | M |
| **Dömper** | Page-in from disk (hard fault) | Warehouse → market | Hard faults per second; per-process with ETW | M/K |
| **Kocsi a piacról** | Modified pages written out | Market → warehouse | Modified list change | K |
| **Busz** | Syscalls | Palace ↔ everywhere, as a constant small flow | System calls per second | K |
| **Tűzoltó** | Interrupts, DPC | Short sprints from the sirens | Interrupt rate | K |
| **Futár** | Input messages | Post → front window's building | Foreground change | K |
| **Mozgóstáb** | GPU copies | Factories ↔ studio | Copy-engine load | K |

Individual vehicles are **samples of a real rate**, never one-to-one: 227 000 system calls per second cannot be drawn.
Density and speed follow the measured rate on a log scale, and the panel shows the true number.

## 1.8 Agents and contractors

This is the user's most specific idea, and it can be measured almost exactly:

1. A Claude session is a **Mesterműhely**, from the existing `agents` feed and the hooks.
2. A sub-agent appears as a **Segéd** in that workshop, from the hook and transcript events.
3. A child process the session starts (git, node, bash) is a real process-tree fact: an **Alvállalkozó** walks from its
   place in the suburbs to the workshop, and a contract line joins them while it runs.
4. If that contractor reads a repo file, the existing beam fires, now seen from the Homeland side.
5. An agent "hiring" a long-lived program opens a standing contract, such as a dev server or a browser under Chrome
   automation.

The process tree needs ETW for exact parents in real time. Without ETW, `InheritedFromUniqueProcessId` from the process
snapshot gives the same parent, at one-second resolution, so short-lived children can be missed.

## 1.9 What the user left open, and how it is closed

| Gap | Closed by |
|---|---|
| Firmware | Foundation stone, iron law, utility companies (§1.3) |
| Network wired and wireless | Harbour, radio mast, jetty (§1.2) |
| Peripherals | Messenger post, USB village (§1.2) |
| Services vs processes | Office block, public service (§1.4), and session-0 rule ([02-layers-signals.md](02-layers-signals.md)) |
| Virtual devices | Ghost plots (§1.6) |
| Power and heat | Power station, cooling towers, weather (§1.2) |
| Who the "ruler" is | **Not a character.** The user at the keyboard is the head of state; the Palace is the office, and the foreground window is where the head of state is looking |
