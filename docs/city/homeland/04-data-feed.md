# 4. Data feed design

## 4.1 What TMOG is

**TMOG = Task Manager OG**, by Dave Plummer, the original author of Windows Task Manager; the Windows build is native
C++/Win32 over a shared C++20 measuring core, with Windows 11, macOS and Linux listed. It is real and recent, though the
repo notes could not identify it.

| Question | Answer | Source |
|---|---|---|
| Licence | Not open source per press coverage, "commercial product license"; free tier stays free, Pro $39.95 once | [tmog.org](https://tmog.org), [Thurrott](https://www.thurrott.com/windows/windows-11/341878/dave-plummer-has-made-the-task-manager-of-your-dreams), [MajorGeeks](https://www.majorgeeks.com/files/details/tmog.html) |
| Windows 10 | **Not officially supported**; MajorGeeks' editor says it worked in testing | [tmog.org](https://tmog.org), [MajorGeeks](https://www.majorgeeks.com/files/details/tmog.html) |
| Plugin API, SDK, CLI, JSON, socket | **None found** in the site or coverage; absence of documentation, not proof | [tmog.org](https://tmog.org) |
| Export | Pro Flight Recorder saves `.tmogtrace`; the format is undocumented | [tmog.org](https://tmog.org) |
| Installed here | No | `H:\VRG\Full\programs` |

**A TMOG plugin cannot be built today:** it is closed, it has no published interface, and it is not officially supported
on this OS. Parsing `.tmogtrace` or scraping its window would be fragile and would need a Pro licence.

**What is worth taking from it, as ideas:** the Summary home page; "what happened when the fans kicked in", which is the
right question for a monitor; the Flight Recorder's scrub-back, which becomes Homeland's replay (option H3); and its
stated stance of sending nothing home.

If TMOG later publishes an interface, the adapter layer below can take it as one more source. The user may mean something
else by "TMOG", so CITY-D34 confirms it.

## 4.2 Sources compared

| Source | Gives | Elevation | Licence, cost | Plug-in surface | Verdict |
|---|---|---|---|---|---|
| **Native Windows APIs** in `vrg-probe` | Processes, threads, sessions, per-core, memory | None | Ours | It is ours | **Primary** |
| **PDH performance counters** | Disk, NIC, memory lists, GPU engines, GPU memory | None | Windows | Library calls | **Primary** |
| **`vrg-etw`** (ETW) | Exact per-process I/O, process tree, faults | Task | Ours | It is ours | **Primary once repaired** |
| **`nvidia-smi`** | GPU temp, fan, clocks, VRAM | None (spike) | Ships with the driver | CLI, CSV | **Use**, at 5 s |
| **HWiNFO** | The richest sensors: CPU temp, fans, voltages | Own driver | Free tier: shared memory off by default, **12-hour limit**, then re-enable; Pro unlimited (as stated in the [HWiNFO forum](https://www.hwinfo.com/forum/threads/important-changes-to-hwinfo64-coming-soon.7092), older posts: recheck the installed version) | Shared memory; already in `programs` | **Optional adapter** |
| **LibreHardwareMonitorLib** | CPU temp, fans, voltages | Admin for some sensors | MPL 2.0, NuGet ([README](https://github.com/LibreHardwareMonitor/LibreHardwareMonitor)) | .NET library | Alternative, inside the elevated sidecar |
| **System Informer** | The deepest process view | Admin for its driver | MIT; plugins are C and third-party plugins get restricted driver access ([repo](https://github.com/winsiderss/systeminformer)) | Plugin SDK | **Study only**: its source is the best reference for the native calls |
| **PresentMon** | Frame rate per app | ETW, elevated or group | MIT | CLI, CSV | Later, for Óriásvászon |
| **WPR / xperf** | Deep recordings | Admin | Windows | Files | Not live; for one-off study |
| **WMI** | The same counters | None | Windows | CIM | **Avoid for 1 Hz:** 80× slower, see [03-truth.md](03-truth.md) §3.6 |
| **TMOG** | See §4.1 | ? | Closed | None found | Inspiration |

## 4.3 Recommendation

**Extend the existing stream; add no parallel collector.** The brief asks for this, and the numbers support it:
`vrg-probe.exe` is already a C#, restart-managed, unelevated sidecar with JSON lines on stdio, and a process snapshot costs
it 7 ms.

"Plugin" then means a **source adapter**: a small unit behind one interface, which any future source can join.

```
                 ┌────────────── companion.js (:8797) ──────────────┐
vrg-probe.exe ──▶│ probeHandle                                      │
  hm: procs,     │     │                                            │
  cores, mem,    │     ▼                                            │
  disks, nics,   │ homeland.js  (new)        normalises to hm.v1,   │── SSE /api/stream ──▶ page
  gpu            │     ▲   ▲   ▲             classifies, folds,     │   hm* events
vrg-etw pipe ───▶│ etwHandle│   │           strips, keeps 15 min   │
nvidia-smi ─────▶│ adapter ─┘   │                                  │
HWiNFO (opt) ───▶│ adapter ─────┘                                  │
                 └──────────────────────────────────────────────────┘
```

| Piece | Change |
|---|---|
| `probe/Program.cs` + new `probe/Homeland.cs` | A `hm` command over stdin turns the 1 Hz feed on and off |
| `companion.js` | Pass `hm` lines through; a `homeland` action from the page; start on demand |
| `CodeCity/homeland.js` (new) | Node module: adapters, normaliser, classes, ring buffer. Testable alone with fixture lines |
| `etw/Program.cs` | More keywords (disk I/O, hard faults, image load) and a by-volume filter, off unless asked. Needs rebuild and the user's reinstall |
| `homeland-classes.json` (new) | Rule file: exe or folder pattern → archetype. No real client names |
| `tools/selftest.js` | Spec for the normaliser, the privacy strip and the fixture mark |

The existing Land keeps its `power`, `apps`, `audio` and `etwcargo` events; Homeland reads them too, so nothing is computed
twice.

## 4.4 The stream (`hm.v1`)

All events go over the existing SSE stream and are sent only while a page has Homeland open.

| Event | Rate | Content |
|---|---|---|
| `hmhw` | Once, then on change | Inventory: board, CPU topology, DIMM slots, disks with volumes, NICs, GPU, audio |
| `hmcores` | 1 Hz | Per logical: user, kernel, idle; frequency; context switches, syscalls, interrupts, DPC |
| `hmmem` | 1 Hz | Physical, commit, pools, Modified, Standby, Free+Zero, faults, hard faults, pagefile |
| `hmprocs` | 1 Hz, diff | `{id, exe, cls, layer, session, parent, cpu, ws, priv, io, n}`, folded by program family |
| `hmproc` | On change | Start or stop, with parent and class |
| `hmio` | 1 Hz | Per disk: read, write, queue, busy. Per NIC: rx, tx. Per GPU engine: load; VRAM |
| `hmsens` | 5 s | Temperatures, fans, whatever the sensor adapters give, each with a source |
| `hmflow` | 1 Hz | ETW only: process → disk, process → dock |
| `hmfeed` | On change | State of each source: on, off, why; `fixture: true` in test mode |

`GET /api/hm/map?id=` returns one process's address-space regions on demand: region kinds and sizes, never contents.

## 4.5 Privacy (CITY-D27 A)

- Process names, parents and sizes stay **in memory**. The ring buffer lives in the companion's RAM and dies with it.
- **Never collected:** command lines, window titles, environment, memory contents, keystrokes.
- ETW file events reach the page as **class and volume**, not as paths, except repo paths that already beam today.
- Client job folders show as Telekkönyv counts, blurred until clicked, as Tárház does.
- `hmproc` carries an exe name only; a path is used for classifying and then dropped.
- Fixtures are hand-written with invented names, and their mode shows a permanent PRÓBAADAT banner. `selftest` fails if a
  fixture contains a real-looking client name, an IP address or a path outside the fixture's own.

## 4.6 Cost budget

| Item | Budget | Basis |
|---|---|---|
| Feed, in the probe | < 0.5 % of one core at 1 Hz | 7 ms snapshot plus PDH |
| Companion normalising | < 0.5 % | One JSON pass per second |
| Page, traffic moving | 60 fps on the 1050 Ti; < 15 % of the GPU | 30 k instances in low-poly, shared materials |
| Homeland closed | 0 | Feed stopped; no sampling while the view is not open |

The system must also **see itself**: the companion, the probe and the page's browser process are all in the feed, so they
are tagged **Megfigyelő** (observer), and their cost shows in the panel. A monitor that hides its own cost is lying.

Rendering (`R11` exception): Homeland runs a capped animation loop only while the view is open, the tab visible and
traffic present. Reduced motion freezes vehicles and shows rates as numbers. The quality tiers in `37-look.js` apply.

## 4.7 Repairing ETW (the user's steps)

Not required for the first slice. It upgrades the grey parts to live.

1. In this repo (normal shell): `node CodeCity/tools/build-etw.js`
2. Elevated PowerShell: `powershell -NoProfile -ExecutionPolicy Bypass -File H:\VRG\Full\Planner_VRG_U100\CodeCity\etw\install-etw.ps1`
3. Task Scheduler → *VRG Kodvaros ETW* → Actions → Edit: Program/script
   `"C:\Program Files\VRG\Kodvaros-ETW\vrg-etw.exe"` with the quotes, and an empty Arguments box.
4. Run the task once; `Get-ChildItem \\.\pipe\ | Where-Object Name -match vrg` should list `vrg-etw`.

## 4.8 How a view becomes a node (read from the code)

- **Város is not a map place.** It is an entry in `VIEWS` in `CodeCity/src/39-views.js`, beside `global` and `simple`,
  chosen by the bar, key **V** and `#view=`. So "a node beside Város" means a **fourth view**.
- **The Land** (`land.json`, `29-land.js`) is a separate thing: hex places around the city, visible only in Globális.
  `eromu` ("ez a gép") is already there, so it becomes the Land's door into Homeland.
- All views share one `scene`, camera and `orbit` (`03-scene.js`). `39-views.js` hides the Land's groups through
  `scene.onBeforeRender`, so Homeland extends that: its own group, with the city's `world.group` hidden.
- A page with no city in it cannot boot (`99-boot.js` needs `window.CITY`), which is fine, because the default build
  loads this repo's data. Homeland itself needs no scan.
- Picking (`pickAt`) only knows buildings and plates, so Homeland adds its own target list.
- Build: new `src/40-hm-*.js` files join the page in filename order, before `99-boot.js`. CSS goes to
  `city.css`, test hooks to `99-boot.js` (`#hmtest=`).
- Timeline, lenses 1–6, Metró and similar bars are hidden with `body[data-view=homeland]`, the same way `simple` does.
