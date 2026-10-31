# 2. Layers and live signals

## 2.1 Five layers, one vertical axis

The layers are the map's third dimension, and they answer "how far from the user is this?". The sort is not a judgement
call: **the kernel's own session number decides it.** Session 0 is where services and system processes live; session 1
is the logged-in user. The process snapshot reports this for all ~415 processes, unelevated, including the 154 this
account cannot open.

| # | Layer | Height | Shows | Rule |
|---|---|---|---|---|
| +1 | **Égbolt** (sky) | above roofs | Network in the air, heat as weather, alerts | Network and thermal feeds |
| 0 | **Felszín** (ground) | buildings | User programs | Session ≥ 1 with a visible window, or a registered class |
| −1 | **Utcaszint** (streets) | road surface | Small constant traffic of the OS and of session-1 helpers | Session 1 without a window: tray apps, updaters, helpers |
| −2 | **Alváros** (undercity) | below the plate | Services, the office block, utility tunnels | Session 0 processes |
| −3 | **Mélyút** (deep road) | deeper | Kernel, drivers, interrupts, the buses | System process, driver list, DPC and interrupt counters |
| −4 | **Alapkő** (bedrock) | bottom | Firmware, board traces, the fixed hardware | Static inventory |

**Reading the layers.** The city plate is the only thing between the surface and the undercity, so a single control peels
it: **PgDn/PgUp** (and a side rail) step down one layer at a time. Layers above the chosen one fade to outlines; they do
not vanish, so a surface building keeps its vertical link down to its services, drivers and hardware. Selecting a
building draws that **plumb line**: Chrome → its GPU process → the driver → the Filmgyár. This single gesture is the
closest the view comes to the user's "how a program contacts parts of the system".

## 2.2 How many things get a body

~415 processes and ~6 900 threads cannot each be a detailed building, and most are not interesting.

| Population | Body | Count here |
|---|---|---|
| Program with a window | Full building by archetype | 10–30 |
| Program family (browser, Electron) | One building; its child processes are floors | Folded by parent and exe |
| Session 1 without a window | Small roadside booth or a road vehicle | ~100 |
| Session 0 | Undercity room; office block for svchost | ~250 |
| Threads | Never a body; the panel lists a count | ~6 900 |

The **top N by activity** always get a body regardless of class, so a busy background task can never hide. The rendering
budget (instancing and low-poly) is in [04-data-feed.md](04-data-feed.md) §4.6.

## 2.3 Signals → what the city does

Tags as in the topology: **M** measured, **K** approximate, **J** metaphor. "ETW" marks a signal that needs the elevated
sidecar; without it, the listed fallback runs instead.

### Program launch

| Step | City | Real signal | Tag |
|---|---|---|---|
| 1 | A permit leaves the Town Hall (or a workshop) | Process start, parent | M (ETW), else 1 s poll |
| 2 | A plot lights up in the class district | Exe class lookup | M |
| 3 | Dump trucks run from the warehouse to the market | Hard faults, disk read | M per disk; per process with ETW |
| 4 | Stalls open with its colour; the building rises as they do | Working set growth | M |
| 5 | Utility hookups flash at the base | DLL load | ETW only, otherwise skipped |
| 6 | First window: lights on | `apps` open event | M |
| 7 | First socket: a road or packet line to the harbour | Per-process network | M (ETW), otherwise skipped |
| 8 | The building settles; the label appears | Rate falls | M |

The whole launch plays in real time, and the second launch of the same program is visibly shorter, because the standby
cache needs no trucks. That is a real effect, and a good one to see.

### Memory reached

| What the user sees | Real signal | Tag |
|---|---|---|
| Stalls grow and shrink for a program | Working set, per process per second | M |
| Private vs shared stall stripes | Private bytes vs working set; shared by `QueryWorkingSetEx` for own processes | M/K |
| The market's mix of lots | Page-list counters | M |
| Dump truck for a program | Hard faults | M with ETW |
| Selected program: **Telekkönyv** panel, its address-space map | `VirtualQueryEx`: real regions, image / mapped / private / reserved | M where openable |
| Which physical lot | Not shown as fact. See [03-truth.md](03-truth.md) §3 | J |

### Disk

| What the user sees | Real signal | Tag |
|---|---|---|
| Trucks at each warehouse, by rate | Per-disk bytes per second | M |
| Crane waiting at the brick warehouse | Per-disk queue, % busy | M |
| A truck labelled by owner | Per process I/O bytes (includes non-disk I/O), or exact with ETW | K / M |
| Which warehouse for which program | ETW only; without it the truck leaves from Vámház with no destination | M (ETW) |

### Network

| What the user sees | Real signal | Tag |
|---|---|---|
| Traffic at harbour and mast | Per-NIC bytes | M |
| Packet courier to a building | Per-process bytes (ETW) | M |
| Ship, plane, customs | Existing `cargo` | M |
| Country buoys | Existing `net`, DB-IP | M |
| Without ETW: named connections | TCP table gives the owner, not the bytes | K |

### CPU and heat

| What the user sees | Real signal | Tag |
|---|---|---|
| Hall lines lit | Per-logical load | M |
| A building's owner working in a hall | Per-process CPU is real; which hall is not, so the link goes to the district, not to a hall | K |
| Chimney beat | CPU frequency counter | M |
| Studio heat, cooling towers | `nvidia-smi` | M |
| CPU heat | Needs a driver path, CITY-D35 | K |

### State and agents

| What the user sees | Real signal | Tag |
|---|---|---|
| Palace lit by kernel time | Kernel vs user CPU | M |
| Minister's signal mast | Context switches per second | M |
| Sirens | Interrupts, DPC | M |
| Barracks patrol during a scan | Defender and Avast process activity | K |
| Workshop, journeymen, contractors, contract lines | Topology §1.8 | M |

## 2.4 Honest display: the truth lens

A view that mixes facts and metaphor must not let one pass as the other. Each element carries its tag, and the page keeps
one rule, visible in the legend:

- **Solid and warm** = measured now.
- **Dashed or pulsing outline** = approximate or inferred.
- **Grey and static** = metaphor, never animated by data.
- **PRÓBAADAT banner** across the top in fixture mode, and no way to turn it off in that mode.
- **`Mérés` lens** (key **M**): strips the city to measured elements only.

Every panel's number states its source ("forrás: NtQuerySystemInformation · 1 s"). When a feed is off, its elements go
grey and the panel states why; the city never invents motion to fill the gap.

## 2.5 Mélyvíz

M1 keeps its meaning here: ice = the instrument and you; warm light = activity. Grey-normal (R1) stays: the city is calm
and only activity carries colour. The island sits on the existing water; M2's click-to-wave and M3's on-demand water hold.
R11 (an idle city costs nothing) needs one change: traffic animates only while Homeland is open, and it stops with the
tab hidden. See [04-data-feed.md](04-data-feed.md) §4.6.
