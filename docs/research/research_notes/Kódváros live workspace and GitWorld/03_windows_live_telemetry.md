# 03 · Windows live telemetry for the Land (Kódváros live workspace)

2026-10-26 · research notes. Nothing was installed or changed. A few **read-only** checks were run on this PC (section 0).
Scope: how a local Node.js process on Windows 10 Pro can **read** live system state, and **control** some of it, to feed the
three.js Land: the repo city, the H: storage, the PC as a compute node, the router as a transport hub, and the "abroad" internet with ships, planes and trains.

> Method note: the deep-research `researcher.md` brief could not be read because the session blocks reads outside the repo
> (`permissions.blockReadsOutsideWorkingDirectories`), so a standard multi-source pass was done instead: primary docs
> (Microsoft Learn, GitHub READMEs, provider manifests, vendor licence pages) first, then secondary sources, plus local measurements.
> Anything marked **(verify)** comes from one secondary source or from memory and has not been tested here.

---

## 0. What this PC actually is (measured today, read-only)

| Fact | Value | Why it matters |
|---|---|---|
| OS | **Windows 10 Pro 21H2 (build 19044)** | 21H2 Home/Pro servicing ended in 2023 (verify the date in MS lifecycle). Windows 10 itself left mainstream support on 2025-10-14. Several 2026 tools now list **Windows 11+** as "Runs on" (see Procmon and Sysmon below). Every API choice here must work on 19044. |
| Shell elevation | the Claude Code shell is **not elevated** | Everything in "Tier A" below was chosen to work without admin. |
| .NET | **.NET 8 runtimes only (8.0.27/8.0.28), no SDK** | .NET 8 LTS support ends **2026-11-10**. .NET 10 (LTS) lists only Win10 21H2 *Enterprise/IoT* and the 1809/1607 LTSC builds as supported. It will very likely run on 21H2 Pro, but "unsupported". A self-contained publish bundles the runtime anyway. |
| Rust | not installed | Rust needs MSVC Build Tools (an admin install of several GB), so it is the harder path for this setup. |
| Node | portable `Planner/apps/node` **v24.19.0** | Prebuilt N-API modules work. Anything that needs node-gyp needs Visual Studio Build Tools, so avoid it. |
| GPU | NVIDIA GeForce GTX 1050 Ti, `nvidia-smi.exe` present in System32 | Per-process GPU % comes from the `GPU Engine` counters. Temperature, clocks and memory come from `nvidia-smi`. |
| `\GPU Engine(*engtype_3D)\Utilization Percentage` | **101 instances**, named `pid_<PID>_luid_…_engtype_3d`. The cold `Get-Counter` call took **~1.9 s** | Per-process GPU works without admin, but a cold PowerShell call costs 1–2 s, so do not spawn one per tick. |
| `Get-NetTCPConnection -State Established` | **103 connections in ~1.3 s**, unelevated | The remote IP and owning PID for each connection are available without admin. Byte counts are not. |
| Bluetooth | adapter present, **26 present PnP entries**, paired devices include an audio device and a fitness band | Bluetooth is worth a district of its own. |
| USB | 12 present USB PnP entries, Intel USB 3.2 xHCI + root hub | Port topology is readable through PnP location properties (section 6). |
| Audio | Audiosrv and AudioEndpointBuilder running. **Equalizer APO is not installed** | The EQ section is optional and needs an install plus admin. |
| Windows Performance Toolkit | `wpr.exe`, `xperf.exe` present | Useful for offline ETW recordings (`.etl`) to explore providers before writing code. |
| CodeCity | `CodeCity/sessions.js` already parses Claude Code transcripts (`~/.claude/projects/*/*.jsonl`) into read/search/edit file events | This is already a working near-live source for "Claude touches files" (section 4). |

Network (from `docs/research/2026-10-26_router-usb-phone-wake.md`): PC `192.168.0.100` wired to a **TP-Link TL-WR1043ND** (`192.168.0.1`).
That router sits behind a **Huawei HG8245H** GPON ONT (`192.168.1.254`, ISP-locked), so this is a **double NAT**. First ISP hop: `91.120.199.243`.

---

## 1. Verdict: recommended stack per data source

Tier A = no admin, nothing installed system-wide. Tier B = needs an elevated helper (one UAC-free scheduled task, see section 11).

| Land feature | Best method | Admin? | Live rate | Licence | Fallback |
|---|---|---|---|---|---|
| CPU / RAM / disk / network totals | PDH counters from a sidecar, or `typeperf -si 1` streamed to Node | No | 1 s | built-in | `systeminformation` (MIT), slow on Windows |
| Per-process CPU / RAM / IO | PDH `\Process(*)\…` + `ID Process`, or `NtQuerySystemInformation` in a sidecar | No | 1 s | built-in | `ps-list` (MIT; pid/name/ppid only on Windows) |
| Per-process GPU | PDH `\GPU Engine(*)\Utilization Percentage`, `\GPU Process Memory(*)\Dedicated Usage` | No | 1 s | built-in | `nvidia-smi --query-gpu … -lms 1000` (totals, temperature) |
| Temperatures, fans, clocks | **LibreHardwareMonitor** remote web server `127.0.0.1:8085/data.json` | **Yes** for motherboard and CPU sensors | 1 s | MPL-2.0 | `nvidia-smi` for the GPU only |
| Per-process network connections + remote host | `GetExtendedTcpTable` / `GetExtendedUdpTable` (iphlpapi) + offline GeoIP | No | 1–2 s poll | built-in + DB-IP Lite (CC BY 4.0) | `Get-NetTCPConnection` |
| Per-process network **bytes** (ships and planes) | **ETW `Microsoft-Windows-Kernel-Network`** (PID, size, addresses, ports per send/recv) | **Yes** | 1–3 s batches | built-in; consumer lib MIT | `GetPerTcpConnectionEStats` (admin as well) |
| Which domain an IP belongs to | ETW `Microsoft-Windows-DNS-Client` (per process) or `Get-DnsClientCache` | ETW yes / cache no | instant / poll | built-in | reverse DNS (slow, leaks) |
| Who reads/writes which file on H: | **ETW `Microsoft-Windows-Kernel-File`** | **Yes** | 1–3 s batches | built-in | `fs.watch` (changes only, no PID) |
| What Claude Code touches | **Claude Code hooks** (`PreToolUse`/`PostToolUse`, `type: "http"` to the local Node server) + transcript tail | No | immediate | n/a | OpenTelemetry events (5 s batches) |
| Open programs / windows | Win32 `EnumWindows` + `SetWinEventHook` in a sidecar with a message loop | No | event-driven | built-in | `get-windows` (MIT), polling |
| Move/resize a window | `SetWindowPos` (sidecar, or koffi in-process) | No (not for elevated windows) | instant | built-in | `node-window-manager` (MIT, stale) |
| Window as a texture on a building | **browser `getDisplayMedia()` → `THREE.VideoTexture`** | No | 30–60 fps | built-in | Windows.Graphics.Capture in a sidecar |
| USB tree + hot-plug | PnP device properties (`DEVPKEY_Device_LocationPaths`, `…LocationInfo`, `…Parent`) + `CM_Register_Notification` / WM_DEVICECHANGE | No | event-driven | built-in | `usb` npm (MIT; libusb LGPL inside) |
| USB stick drive letters | `Get-Disk | Get-Partition | Get-Volume` (BusType USB), `Win32_VolumeChangeEvent` | No | event-driven | built-in | `drivelist` (Apache-2.0, native) |
| Bluetooth devices + battery | WinRT `DeviceWatcher` (`System.Devices.Aep.IsConnected`) + PnP battery property `{104EA319-6EE2-4701-BD47-8DDBF425BBE5} 2` | No | event-driven / minutes | built-in | `Get-PnpDevice -Class Bluetooth` |
| Sound sources, volume, mute, peaks | **Windows Core Audio** (`IAudioSessionManager2`, `ISimpleAudioVolume`, `IAudioMeterInformation`) via NAudio (MIT) in a sidecar | No | 30–60 Hz peaks | built-in, NAudio MIT | NirSoft `svcl.exe` (freeware, closed) |
| Default/per-app output device | undocumented `IPolicyConfig` / `IAudioPolicyConfigFactory` (as in EarTrumpet, MIT-modified) | No | instant | n/a | AudioDeviceCmdlets (MIT, last push 2023) |
| System-wide EQ | **Equalizer APO** (GPL-2.0), edit its `config.txt` text file | **Yes** to install | live reload | GPL-2.0 (only the program is used) | none comparable |
| Now playing (Spotify stadium) | **GSMTC** `GlobalSystemMediaTransportControlsSessionManager` (Win10 1809+) via the sidecar | No | event-driven | built-in | Spotify Web API (online, Premium, strict policy) |
| Router / LAN | ARP (`Get-NetNeighbor`), ping/tracert, SSDP/mDNS discovery, UPnP IGD byte counters on the TP-Link | No | 2–30 s | built-in, node-ssdp MIT | OpenWrt + nlbwmon (router change) |

**Avoid for this project:** Npcap packet capture (licence plus privacy, section 3.4), live Procmon (it does not stream; section 4.5), WinRing0-based monitors (Defender flags them as a vulnerable driver), NodeRT and edge-js (Node-ABI fragility; section 2).

---

## 2. Bridging Win32/WinRT into Node: which way

| Option | What it is | Fits | Robustness for a non-coder, portable setup | Licence |
|---|---|---|---|---|
| **C# sidecar exe, JSON Lines over stdio** (recommended) | `vrg-probe.exe`, `net8.0-windows10.0.19041.0` (or net10) TFM, `dotnet publish -r win-x64 --self-contained -p:PublishSingleFile=true` | WinRT (GSMTC, Bluetooth, Graphics Capture) through the C#/WinRT projection; COM (Core Audio) through NAudio; Win32 P/Invoke; ETW through TraceEvent; a real message loop for WinEvent hooks | **High.** Node spawns it and reads lines. A crash restarts only the sidecar, never Node. No Node ABI coupling. The SDK is a zip that unpacks into `Planner/apps/dotnet` (gitignored), no admin and no Visual Studio. A self-contained exe is ~60–70 MB untrimmed (trimming/AOT shrink it, verify with CsWinRT). | your code; NAudio MIT, TraceEvent MIT, krabsetw MIT |
| Rust sidecar | `windows` crate (MIT/Apache-2.0) + `ferrisetw` 1.2 (MIT/Apache-2.0) | the same coverage, 1–5 MB exes | **Medium.** It needs MSVC Build Tools (admin install). Excellent once built. | MIT/Apache-2.0 |
| **koffi** in-process FFI | npm `koffi` (**MIT**), prebuilt Windows x64 binary in the npm package, Node 16+ | small synchronous Win32 calls: `EnumWindows`, `GetWindowTextW`, `SetWindowPos`, `GetExtendedTcpTable`, `GetIfTable2` | **High for plain C APIs.** Poor for COM (vtables by hand), WinRT (activation, async) and anything that needs a message loop (it would block Node's event loop). | MIT |
| Persistent PowerShell 5.1 child | one long-lived `powershell -NoLogo -NoExit -Command -` fed commands on stdin; `Add-Type` compiles inline C# at runtime; WinRT reachable with `[Type,Assembly,ContentType=WindowsRuntime]` | prototyping: zero toolchain, already on every Windows | **Medium.** Fine at 1 Hz, but slow to start (measured 1–2 s per cold cmdlet), parsing its text output is fragile, and AMSI/Defender scrutinises `Add-Type` scripts. Use it as "Tier 0" while the sidecar does not exist yet. | built-in |
| `systeminformation` | npm, MIT, v5.33.16 (v6 TypeScript rewrite in beta) | quick totals, cross-platform | Windows support is "partial". It shells out to PowerShell/WMI; the docs warn `getAllData()` can take **up to 20 s on Windows**. Good for a one-off inventory, not for 1 Hz. | MIT |
| NodeRT (`@nodert-win10-*`, `@xan105/nodert`) | generated WinRT native addons | GSMTC, Bluetooth | **Low.** It is not N-API, so it must be rebuilt for every Node ABI. The original repo was last pushed in 2024 and needs Visual Studio. | Apache-2.0 |
| edge-js | .NET in-process inside Node | C# code from JS | **Low–medium.** Prebuilds track a set of Node versions, and both runtimes live in one process. | MIT (verify) |

**Recommendation:** one Node server (unelevated, `127.0.0.1` only, WebSocket to the three.js page), plus:
1. `vrg-probe.exe` (C#, unelevated): windows, audio, media, Bluetooth, USB, PDH counters, TCP table.
2. `vrg-etw.exe` (C#, TraceEvent, **elevated**): Kernel-File, Kernel-Network, Kernel-Process, DNS-Client. It is strictly read-only, filters at the source, and talks over a named pipe whose ACL allows only the current user (section 11).
3. koffi only if a few synchronous calls are wanted inside Node (for example `SetWindowPos` while dragging).

Protocol: one JSON object per line, `{"t":"audio.peak","pid":1234,"v":0.42,"ts":…}`. Node → sidecar commands use the same shape (`{"cmd":"audio.setVolume","pid":1234,"v":0.3}`). Version the message names; never pass file contents.

---

## 3. Compute node and network: CPU, RAM, GPU, disk, network

### 3.1 Totals and per-process counters

- **PDH / Performance Counters** (built-in, no admin):
  - `\Processor Information(_Total)\% Processor Utility` (what Task Manager shows), `\Memory\Available MBytes`, `\PhysicalDisk(*)\Disk Read Bytes/sec`, `\LogicalDisk(H:)\% Free Space`, `\Network Interface(*)\Bytes Received/sec`.
  - Per process: `\Process(*)\% Processor Time` (divide by the core count), `\Process(*)\Working Set - Private`, `\Process(*)\IO Read Bytes/sec`, `\Process(*)\ID Process`.
  - **Pitfall:** on Windows 10, `Process` instance names are `chrome`, `chrome#1`, … and **renumber when a process exits**. Always read `ID Process` in the same query and key by PID. (The PID-in-name `Process V2` counter set is Windows 11 only, verify.)
  - **Pitfall:** `IO * Bytes/sec` per process counts *all* I/O (file, network, device), not just disk. Task Manager's per-process Disk column comes from ETW DiskIo.
  - `typeperf "\Processor Information(_Total)\% Processor Utility" "\Memory\Available MBytes" -si 1` **streams CSV to stdout once a second** with no code at all. **Pitfall:** wildcard instances are expanded only at start, so processes started later are missed. Restart it periodically, or use PDH from the sidecar (`PdhExpandWildCardPath` + `PdhCollectQueryData`).
- **GPU per process:** `\GPU Engine(*)\Utilization Percentage` (instances `pid_<PID>_…_engtype_3D|VideoDecode|Copy|…`). Sum per PID over engines of one type; Task Manager shows the max engine. `\GPU Process Memory(*)\Dedicated Usage`. Measured: 101 3D instances here. NVIDIA extras: `nvidia-smi --query-gpu=utilization.gpu,temperature.gpu,memory.used,clocks.gr --format=csv,noheader -lms 1000` streams. nvidia-smi is proprietary but ships with the driver.
- **WMI/CIM:** `Win32_PerfFormattedData_PerfOS_Processor`, `Win32_PerfFormattedData_PerfProc_Process` give the same data as PDH but slower. `wmic` is deprecated (gone by default on Win11 24H2); do not build on it (`pidusage` still uses it on Windows, verify).
- **LibreHardwareMonitor** (MPL-2.0; v0.9.6 2026-02 per a tracker, verify on GitHub):
  - Options → Remote Web Server serves **`http://127.0.0.1:8085/data.json`** (a sensor tree). Set the listen IP to **127.0.0.1**, not the 0.0.0.0 that guides suggest. It can also publish to WMI.
  - Motherboard and CPU sensors need **admin** and a kernel driver. LHM swapped **WinRing0 → PawnIO** (PR #1857). Since 2025 Defender flags WinRing0 as `HackTool:Win32/Winring0` / `VulnerableDriver:WinNT/Winring0` (CVE-2020-14979). **Use only a PawnIO-based build**, never an old one bundling WinRing0.
  - MPL-2.0 is file-level copyleft: using the app or library unmodified is fine. If LHM source files are modified, those files stay MPL.
  - Do not download from `librehardwaremonitor.com`; the project says it is not theirs.
- **ETW for the "Task Manager in 3D" layer:** `Microsoft-Windows-Kernel-Process` gives process start/stop with parent PID. This is how temporary buildings appear and vanish, and how the process tree is drawn (Claude Code → bash.exe → node.exe). It needs admin. The unelevated alternative is to poll the process list once a second and diff it.

### 3.2 Per-process network connections (who talks to whom)

- `GetExtendedTcpTable(TCP_TABLE_OWNER_PID_ALL)` / `GetExtendedUdpTable` (iphlpapi.dll): every socket with its owning PID and remote IP:port. **No admin.** It is cheap via koffi or the sidecar (milliseconds). `Get-NetTCPConnection` returns the same data in ~1.3 s.
- `netstat -abno`: `-b` needs admin. Text parsing is fragile; avoid it.
- Bytes per connection: `GetPerTcpConnectionEStats` (TcpConnectionEstatsData/Bandwidth). Collection must first be switched on with `SetPerTcpConnectionEStats`, which **requires admin**, per connection, and IPv6 is stricter still.

### 3.3 Per-process network bytes: ETW (the real "ships and planes")

- `Microsoft-Windows-Kernel-Network` (GUID `7DD42A49-5329-4832-8DFD-43D979153A88`). Manifest events: TCP DataSent (10), DataReceived (11), ConnectionAttempted (12), Disconnect (13), Retransmit (14), Accepted (15); UDP sent/received (42/43); IPv6 twins (26–34, 58/59). Fields: **`PID`, `size`, `daddr`, `saddr`, `dport`, `sport`, `connid`**. Keywords: IPv4 `0x10`, IPv6 `0x20`.
- This is what Resource Monitor's Network tab is built on. Size → ship (large) or plane (small packet bursts); daddr → GeoIP country → destination port abroad.
- Needs **admin** (or SYSTEM). The Performance Log Users group can control normal sessions, but security tools treat this provider as SYSTEM-only, so plan for elevation.
- `Microsoft-Windows-DNS-Client` ETW gives query name → results per process. It turns `160.79.x.x` into `api.anthropic.com` without any extra lookups (event IDs and fields: verify against the manifest).
- Real-time latency: per the TraceEvent guide, events arrive **at least ~1 s, typically ~3 s** late (buffer flush). Timestamps are exact, so the city can replay with a 2–3 s delay that still looks live. Lower the session `FlushTimer` to 1 s.

### 3.4 Packet capture (Npcap): not needed, licence-restricted

- **Npcap 1.90 (2026-10-21)** free licence: **up to 5 installs, no redistribution**, unlimited only when used with Nmap, Wireshark or Microsoft Defender for Identity. Redistribution or bundling needs the paid **OEM** licence. It cannot be shipped in the VRG toolset.
- ETW already gives PID-attributed byte counts without capturing payloads. Capture would also pull private content (DNS, SNI, plaintext HTTP) into the app. **Skip it.** If ever needed for a one-off investigation, use Wireshark as the user's own tool.

### 3.5 GeoIP: which country "abroad", offline

| Database | Licence | Account | Update | Notes |
|---|---|---|---|---|
| **DB-IP Lite** (country / city / ASN, `.mmdb`) | **CC BY 4.0**, attribution to DB-IP.com with a link | **no** | monthly | best fit: offline, open licence, scripted download |
| MaxMind GeoLite2 | proprietary GeoLite EULA, attribution required, **delete old DBs within 30 days of a new release** | yes (licence key) | twice weekly | more established, more strings attached |
| IP2Location LITE | CC BY-SA 4.0 | yes (verify) | monthly | share-alike |

- Reader: npm `maxmind` / `mmdb-lib` (MIT) read any `.mmdb` (DB-IP ships mmdb). The ASN database names the carrier ("Cloudflare", "Google", "Anthropic"), which is better than the country alone for labelling ports.
- **Never use online geo APIs** (ip-api.com and similar). They would receive the whole connection list. The DB file lives under a gitignored folder, like `Vendor/`, fetched by a script.
- Private ranges (`192.168.x`, `10.x`, `100.64/10` Tailscale, link-local) are "home", not abroad.

---

## 4. File access on H: (and watching Claude Code work)

### 4.1 Comparison

| Method | Sees reads? | Sees writes | Names the process | Admin | Latency | Pitfalls |
|---|---|---|---|---|---|---|
| **Claude Code hooks** (`PreToolUse`/`PostToolUse`) | yes, for Claude's own tools | yes | it *is* Claude (plus `session_id`, `tool_use_id`) | no | immediate (Pre fires before the action) | Bash only gives the command string. Files touched *inside* Bash (cat, node scripts, git) and by subprocesses are invisible, except `bashEditDiff.changedFiles` on PostToolUse (v2.1.269+, git repos, best-effort). The Write input contains the **file content**: drop it in the handler. |
| Transcript tail (`~/.claude/projects/<mangled-cwd>/*.jsonl`, what `CodeCity/sessions.js` already does) | yes (Claude's tools) | yes | Claude, per session | no | ~immediate (append per tool call) | Format is internal and may change. Subagent transcripts are separate files. |
| Claude Code **OpenTelemetry** (`CLAUDE_CODE_ENABLE_TELEMETRY=1`, OTLP `http/json` to a local Node receiver) | `tool_result` events, with `tool_input` only if `OTEL_LOG_TOOL_DETAILS=1` (inputs truncated at 512 chars/value, ~4K total) | same | Claude | no | logs batched every **5 s** (`OTEL_LOGS_EXPORT_INTERVAL`) | Bonus: `claude_code.api_request` carries `input_tokens`/`output_tokens`/`cost_usd`/`duration_ms`, so every model call becomes a departing plane sized by its payload. Keep `OTEL_LOG_USER_PROMPTS` **off**. |
| **ETW `Microsoft-Windows-Kernel-File`** (GUID `EDD08927-9CC4-4E65-B970-C2560FB5C289`) | **yes** (Read, task 15) | yes (Write 16, Create 12, Rename, Delete, CreateNewFile 30) | yes (event header PID/TID) | **yes** | 1–3 s | Read/Write events carry only `FileObject`/`FileKey`, **no name**. Names come from Create/NameCreate events (`FileName`), so keep a FileKey→path map. Keywords: FILENAME `0x10`, FILEIO `0x20`, CREATE `0x80`, READ `0x100`, WRITE `0x200`, DELETE_PATH `0x400`, RENAME `0x800`, CREATE_NEW_FILE `0x1000`. Very noisy (Defender, Search indexer, VS Code, git, OneDrive): filter at the source to `\Device\HarddiskVolumeN\cwebuser\…` and to the Claude process tree. Kernel paths are device paths, so map them with `QueryDosDevice`. Cache hits still show as Read IRPs, but memory-mapped reads do not. |
| ETW NT Kernel Logger FileIO (classic `FileIo` + `FileIoName`) | yes | yes | yes | yes (admin or SYSTEM only, a single global session) | 1–3 s | Conflicts with other tools (Procmon, WPR, Process Hacker) using the one kernel session. Prefer the manifest provider above. |
| `fs.watch` recursive / chokidar | **no** | yes (change, rename) | **no** | no | ~instant | ReadDirectoryChangesW: no PID, buffer overflow on bursts (git checkout) loses events, so rescan on overflow. chokidar 5 is ESM-only and needs Node 20.19+ (fine on v24). Ignore `Planner/apps`, `node_modules`, `.git/objects`. |
| Sysinternals **Process Monitor** | yes | yes | yes | yes (loads a driver) | not live | No streaming API: `/BackingFile x.pml /Quiet /Minimized` … `/Terminate`, then parse the PML (`procmon-parser`, Python, MIT, PML from 3.4.0+). Only workable as "record then replay". The 2026-10-15 Learn page lists **Runs on: Windows 11 and higher**: test on 19044 or keep an older build. Sysinternals EULA: no redistribution. |
| Sysinternals **Sysmon** | **no** (FileCreate 11, FileDelete 23/26 only) | create/delete | yes | yes (boot driver + protected service) | event log, ~instant | Gives NetworkConnect (3) and **DNSEvent (22)** per process, which is neat for the internet side. But it is a permanent system service, and the 2026-09-10 page also lists **Windows 11+**. Optional at most. |
| Security audit 4663 | yes (with a SACL) | yes | yes (ProcessName) | yes, to set the audit policy and SACL and to read the Security log | ~instant | Changes system security settings (the user's decision), floods the Security log. Not recommended. |

### 4.2 Recommended combination for "watch Claude reach file addresses on H:"

1. **Hooks via HTTP** (semantic layer, no admin). In `.claude/settings.local.json` (gitignored; the user approves this change), add one `PreToolUse` and one `PostToolUse` handler, matcher `Read|Write|Edit|MultiEdit|Glob|Grep|NotebookEdit|WebFetch|WebSearch|Bash|mcp__.*`, `"type": "http"`, `"url": "http://127.0.0.1:<port>/claude-hook"`.
   - Fields: `tool_name`, `tool_input.file_path` (always absolute; on Windows with backslashes), `path`/`pattern` for Glob and Grep, `url` for WebFetch, `query` for WebSearch, `command` for Bash, plus `session_id`, `cwd`, `tool_use_id`.
   - A connection failure is non-blocking by default (`onFailure: "continue"`), so Claude keeps working if Kódváros is closed.
   - Pre = "a car leaves for the building", Post = "it arrives". WebFetch/WebSearch = "a plane departs abroad".
2. **Transcript tail** as the zero-config fallback. It is already implemented in `CodeCity/sessions.js`; switch it from batch scan to `fs.watch` + read-from-offset.
3. **ETW Kernel-File, filtered to the Claude process tree** (Tier B) to catch what Bash and subprocesses touch: the "everything" layer. Build the tree from Kernel-Process events (claude.exe → `H:\_desktop\Git\bin\bash.exe` → node.exe …).
4. `fs.watch` for change pulses in the city (no PID, but instant and free).

"Data going upstream, live": Kernel-Network `DataSent` events for the Claude PIDs, with destinations named via DNS-Client. Unelevated approximation: the TCP table shows claude.exe's remote endpoints, and OTel `api_request.input_tokens` gives the cargo size per call. Payloads are TLS-encrypted; **never** try to intercept them (no MITM proxy, no certificate tricks).

---

## 5. Windows and open programs (temporary buildings), Zen browser windows

- **Enumerate:** `EnumWindows` → `IsWindowVisible`, `GetWindowTextW`, `GetWindowThreadProcessId`, `GetClassNameW`, `DwmGetWindowAttribute(DWMWA_EXTENDED_FRAME_BOUNDS)` for the true rectangle. `EnumWindows` returns windows in **z-order, top first**. `GetForegroundWindow` gives the focused window.
  - **Pitfall:** filter **cloaked** windows (`DWMWA_CLOAKED`) or suspended UWP apps and windows on other virtual desktops show up as ghosts.
  - **Pitfall:** call `SetProcessDpiAwarenessContext(PER_MONITOR_AWARE_V2)` first, or coordinates are virtualised on scaled displays.
- **Events:** `SetWinEventHook(…, WINEVENT_OUTOFCONTEXT)` for `EVENT_SYSTEM_FOREGROUND` (focus), `EVENT_OBJECT_CREATE/DESTROY/SHOW/HIDE` (filter `idObject == OBJID_WINDOW`), `EVENT_OBJECT_NAMECHANGE` (title changes, e.g. tab switches), `EVENT_SYSTEM_MINIMIZESTART/END`, `EVENT_SYSTEM_MOVESIZEEND`.
  - **The registering thread must run a message loop**, which is the main reason to use a sidecar rather than koffi.
  - Avoid `EVENT_OBJECT_LOCATIONCHANGE` unless throttled; it fires for every caret and cursor move.
- **npm options:**
  - `get-windows` (successor of `active-win`, **MIT**, ESM-only, native build): `activeWindow()` and `openWindows()` (front-to-back) with title, bounds, owner {name, processId, path}. `url` is **macOS-only**.
  - `node-window-manager` (MIT, C++, last push ~a year ago): `getActiveWindow`, `getBounds`, `setBounds`. Both are polling-only.
- **Move/resize ("lay a browser on a building"):** `SetWindowPos(hwnd, …, SWP_NOACTIVATE)`.
  - **UIPI pitfall:** an unelevated process cannot move or resize windows of elevated processes.
  - Some apps (Chromium-based, games) fight back or snap. Store the original rectangle and restore it.
- **Showing the window *inside* the 3D scene (instead of moving it):**
  1. **`navigator.mediaDevices.getDisplayMedia({video:true})` in the Kódváros page** → `<video>` → `THREE.VideoTexture`. No helper and no admin; the user picks the window in the browser's own picker; works in Chrome and Zen/Firefox. Best first step.
  2. **Windows.Graphics.Capture** (`IGraphicsCaptureItemInterop::CreateForWindow`, Win10 1903+) in the sidecar → frames over WebSocket/WebRTC. Heavier. On Windows 10 the **yellow capture border cannot be turned off** (`IsBorderRequired` is Windows 11).
  3. Later, as an Electron overlay OS: `desktopCapturer`, or real embedded web pages (`WebContentsView`) for URLs.
- **Zen browser** (portable in `Planner/apps/zen-browser`, Firefox-based): window titles come from EnumWindows (title = active tab). For **all tabs**, a small WebExtension (`tabs.query`, `tabs.onActivated`/`onUpdated`) can send tab titles/URLs to `ws://127.0.0.1:<port>`.
  - Release Firefox builds require signed add-ons; a temporary load via `about:debugging` lasts until restart. Whether Zen honours `xpinstall.signatures.required=false`: (verify).
  - Do **not** enable `--remote-debugging-port`/WebDriver BiDi for this; it gives full browser control to anything on localhost.
  - Zen also publishes a media session to GSMTC when it plays media (section 8).
- **Privacy:** window titles are the most sensitive stream (mail subjects, client names in PDF titles, chat previews). Keep them in memory, offer a "blur titles" mode, never log them into the repo.

---

## 6. USB: devices per port, hubs, hot-plug, sticks

- **Topology without drivers:** every PnP node has `DEVPKEY_Device_Parent`, `DEVPKEY_Device_LocationInfo` (e.g. `Port_#0003.Hub_#0001`), `DEVPKEY_Device_LocationPaths` (e.g. `PCIROOT(0)#PCI(1400)#USBROOT(0)#USB(3)#USB(2)`), `DEVPKEY_Device_BusReportedDeviceDesc` (the name the device itself reports).
  - Read via `Get-PnpDeviceProperty` (no admin) or SetupAPI/CfgMgr32 (`CM_Get_DevNode_PropertyW`) in the sidecar.
  - Build the tree by following Parent from each `USB\VID_…` node up to the xHCI controller. This is the "port on the PC's wall" map.
- **Speed and per-port details:** USBView's approach (`IOCTL_USB_GET_NODE_CONNECTION_INFORMATION_EX(_V2)` on each hub; it gives USB 2/3/SuperSpeed per port, including empty ports).
  - USBView source is in `microsoft/Windows-driver-samples` (**MS-PL**; check the repo before copying code; MS-PL requires keeping the notice and is not GPL-compatible).
  - NirSoft **USBDeview** (freeware, closed source, `/scomma` CSV export) also lists *previously* connected devices: a nice "visitors' book". Some AV engines flag NirSoft downloads as PUA.
- **Hot-plug:**
  - `CM_Register_Notification(CM_NOTIFY_FILTER_TYPE_DEVICEINTERFACE, GUID_DEVINTERFACE_USB_DEVICE)` (Win8+, callback, no window needed), or `RegisterDeviceNotification` + `WM_DEVICECHANGE` (`DBT_DEVICEARRIVAL`/`REMOVECOMPLETE`) on a hidden window in the sidecar.
  - WMI alternative: `Register-CimIndicationEvent -ClassName Win32_DeviceChangeEvent` or `__InstanceCreationEvent WITHIN 2 WHERE TargetInstance ISA 'Win32_PnPEntity'` (polling under the hood, coarser).
- **npm `usb`** (node-usb, MIT; the bundled libusb is **LGPL**; prebuilt via prebuildify; development moving to node-usb-rs since v3): `usb.on('attach'|'detach')`, `device.portNumbers`, `device.parent`, `busNumber`, `deviceAddress`.
  - Opening devices needs a WinUSB driver (Zadig), which **replaces the vendor driver**. Never do that for mice, keyboards or audio; use the package only for enumeration and hot-plug.
  - `usb-detection` is deprecated in favour of `usb`.
- **Sticks → drive letters:** `Get-Disk | Where BusType -eq 'USB' | Get-Partition | Get-Volume`, or WMI `Win32_DiskDrive` → `Win32_DiskDriveToDiskPartition` → `Win32_LogicalDiskToPartition`. `Win32_VolumeChangeEvent` (EventType 2 = arrival) for live letters. `drivelist` (Apache-2.0, native) is an alternative.
- **Trains (transfers to the stick):** Kernel-File Write events whose path is on the stick's volume (Tier B), or unelevated `\LogicalDisk(E:)\Disk Write Bytes/sec`, which gives the train's speed without knowing the cargo.

---

## 7. Bluetooth: paired, connected, battery

- **Paired list:** `Get-PnpDevice -Class Bluetooth` (classic devices under `BTHENUM\`, BLE under `BTHLE\`), or WinRT `DeviceInformation.FindAllAsync(BluetoothDevice.GetDeviceSelectorFromPairingState(true))` / `BluetoothLEDevice.GetDeviceSelectorFromPairingState(true)`.
- **Connected/disconnected live:** WinRT `DeviceInformation.CreateWatcher(selector, ["System.Devices.Aep.IsConnected", "System.Devices.Aep.SignalStrength"], DeviceInformationKind.AssociationEndpoint)`. Events Added/Updated/Removed; no admin.
- **Battery:**
  - Many classic HFP headsets report through the PnP property `{104EA319-6EE2-4701-BD47-8DDBF425BBE5} 2`: `Get-PnpDevice -Class Bluetooth | Get-PnpDeviceProperty -KeyName '{104EA319-6EE2-4701-BD47-8DDBF425BBE5} 2'` → `.Data` = percent. Undocumented but widely used; empty for devices that do not report.
  - BLE devices: GATT Battery Service `0x180F` / Battery Level `0x2A19` via `GattDeviceService`. **Pitfall:** HID-over-GATT devices (mice, keyboards) are owned by Windows; reading BAS may fail or need the device connected. Battery values update only every few minutes.
- **noble / @abandonware/noble (MIT):** on Windows it needs a separate adapter driven via WinUSB (Zadig) or a Zephyr HCI dongle. This **takes the adapter away from Windows**, so it is not suitable here. Use WinRT through the sidecar.
- In the Land: devices orbit the PC like boats near a pier; the signal strength (where available) sets the distance; battery is a fuel gauge.

---

## 8. Audio: every sound source, volume/mute, meters, device switching, EQ

- **Windows Core Audio (WASAPI), no admin:**
  - `IMMDeviceEnumerator` → endpoints (+ `IMMNotificationClient` for device add/remove/default change).
  - Per endpoint `IAudioSessionManager2` → `IAudioSessionEnumerator` → per session `IAudioSessionControl2` (**PID**, display name, icon path, state active/inactive/expired), `ISimpleAudioVolume` (**get/set volume and mute per app**), `IAudioMeterInformation` (**peak level per session** and per device, poll at 30–60 Hz for live meters).
  - `IAudioSessionNotification` tells you when a new app starts making sound (a new stand opens in the stadium).
- **NAudio** (MIT) wraps this in C#: `MMDeviceEnumerator`, `AudioSessionManager`, `SimpleAudioVolume`, `AudioMeterInformation`, plus `WasapiLoopbackCapture` (whole-device loopback for a spectrum analyser). It is the shortest path in the sidecar.
- **Per-app spectrum** (not just a peak): `AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK` (capture one process tree). Microsoft lists **build 20348** as the minimum, i.e. officially *not* 19044. GStreamer found it works from 19041; test here before relying on it. The fallback is device loopback + per-session peaks.
- **Default device switching:** the undocumented `IPolicyConfig::SetDefaultEndpoint`. Used by AudioDeviceCmdlets (MIT, `Set-AudioDevice -ID/-Index`, last push April 2023) and by NirSoft SoundVolumeView.
- **Per-app output device:** the undocumented `IAudioPolicyConfigFactory` (`SetPersistedDefaultAudioEndpoint`, RS4/1803+). Reverse-engineered by EarTrumpet (licence: **MIT, modified to exclude three named companies**; read it before copying code). GUIDs and vtable layout vary by build. EarTrumpet notes the persisted routing is not reliably re-applied at app start.
- **NirSoft `svcl.exe`** (SoundVolumeCommandLine, freeware, closed source, v1.26–1.28): `/scomma file.csv /Columns "Name,Command-Line Friendly ID,Volume Percent"`, `/SetVolume`, `/ChangeVolume "Spotify.exe" -10`, `/Mute`, `/GetPercent … /Stdout`. A fine stopgap from Node via `execFile`, but it costs a process per call (no meters) and some AV flag NirSoft downloads.
- **System-wide equalizer: Equalizer APO** (**GPL-2.0**, SourceForge):
  - It installs as an APO into each chosen device via its Configurator. That needs **admin** and registry writes, and may need re-running after big Windows updates.
  - Its filters are a **plain text `config.txt`** (`Preamp: -3 dB`, `Filter 1: ON PK Fc 100 Hz Gain 4 dB Q 1.41`, `Include:` other files). It reloads on save, so Kódváros can drive the EQ by **writing a separate include file** (e.g. `vrg.txt`) that `config.txt` includes. That way the user's own config is never overwritten.
  - Licence: driving the installed program through its config file copies no GPL code, so no licence issue. Never copy its source into the repo.
  - Peace is a GUI on top of APO (licence not found; treat as the user's tool only). Not installed now, so this is optional.
- In the Land: each session is a speaker tower with a peak-driven light column; dragging its slider calls `ISimpleAudioVolume::SetMasterVolume`.

---

## 9. Media now playing and control (Spotify as a stadium)

- **GSMTC** `Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager` (Win10 **1809+**, `windows.dll`).
  - `RequestAsync()`, `GetSessions()`, `GetCurrentSession()`, events `SessionsChanged`, `CurrentSessionChanged`.
  - Per session: `SourceAppUserModelId` (e.g. `Spotify.exe`, browser IDs), `TryGetMediaPropertiesAsync()` (title, artist, album, **thumbnail stream** = album art), `GetPlaybackInfo()`, `GetTimelineProperties()`, `TryPlayAsync/TryPauseAsync/TrySkipNextAsync/TrySkipPreviousAsync`, events `MediaPropertiesChanged`, `PlaybackInfoChanged`, `TimelinePropertiesChanged`.
  - The UWP `globalMediaControl` capability applies to packaged apps. Unpackaged desktop/console apps (the sidecar) call it directly; full-trust apps also get the Changed events, which pure UWP does not (per NPSMLib).
  - **Works offline, no account, no Spotify API terms.** Pitfall: the timeline position updates sporadically (Spotify sends it on seek/pause), so interpolate the progress bar locally.
  - Node-only alternative: `@nodert-win10-19h1/windows.media.control` (Apache-2.0, NodeRT, ABI-fragile).
- **Spotify Web API** (only if online features are wanted):
  - **Feb 2026 Development Mode:** the app owner needs **active Premium** (the app stops when it lapses); new apps get **5 users**; batch, browse and other-user endpoints were removed.
  - **July 2026:** up to 25 Client IDs; quota shared per account; 429 bodies carry `"reason":"QUOTA_EXCEEDED"`. Extended quota is effectively for organisations only.
  - Playback-control endpoints are Premium-only. `audio-features`/`audio-analysis` were closed to new apps in Nov 2024 (verify).
  - **Developer Policy pitfalls for a visualiser:** III.6 "Do not synchronize any sound recordings with any visual media"; III.13 no analysing Spotify Content to create derived metrics; III.14 no ML training; attribution and a link back required when showing metadata or cover art.
  - So **do not drive a beat-reactive stadium from the Spotify API.** GSMTC metadata plus the OS-level peak meter of Spotify.exe's audio session do not use the Spotify Platform at all. That is a personal, local, non-commercial use, but it is the user's judgement call (not legal advice).
- The old Spotify desktop local web helper API is long gone. Do not rely on undocumented localhost ports of the Spotify app.

---

## 10. Router and switch (transport hub), LAN, traceroute "stations"

- **TP-Link TL-WR1043ND, stock firmware** (hardware version still unknown):
  - **UPnP IGD**, if UPnP is enabled: SSDP discovery (`node-ssdp`, MIT), then SOAP `WANCommonInterfaceConfig:1#GetTotalBytesSent/GetTotalBytesReceived` (+ `GetCommonLinkProperties` for link speed) gives total WAN bytes through the TP-Link. Poll every 2–5 s; the router CPU is weak. Whether this firmware implements the counters: (verify). Home Assistant's UPnP integration uses exactly these counters.
  - **Per-IP traffic statistics:** the stock web UI has a statistics page (verify on this unit). Scraping it needs the router login. The user would put those credentials in a gitignored local config themselves; this note does not cover handling them.
  - **SNMP:** not offered by stock consumer TP-Link firmware.
  - **OpenWrt** (v2–v4 hardware only, a router change, optional):
    - `nlbwmon` gives per-host traffic accounting via netlink, with no pcap. Its CLI dumps JSON.
    - `luci-app-statistics`/collectd for graphs.
    - `rpcd`/ubus over HTTP JSON-RPC for scripted reads.
    - `snmpd`/`mini_snmpd` for SNMP (`net-snmp` npm, MIT, on the PC side).
    - Flash space on the WR1043ND is tight.
- **Huawei HG8245H** (ISP ONT): no supported local API. Treat it as a fixed "border station"; ping it for liveness/latency.
- **LAN devices:**
  - `Get-NetNeighbor -AddressFamily IPv4` (ARP cache, no admin; it only holds hosts that talked recently). A gentle ping sweep of `192.168.0.0/24` every few minutes fills it.
  - Vendor from the MAC OUI via the public IEEE OUI list, offline.
  - Names via mDNS (`multicast-dns`/`bonjour-service`, MIT) and SSDP (TVs, printers, Chromecast).
  - The phone over Tailscale `100.x` is a "ferry".
- **Traceroute stations:**
  - `tracert -d -h 15 -w 500 <target>` or `Test-NetConnection -TraceRoute` (no admin). Raw ICMP from Node itself needs admin.
  - Hops: `192.168.0.1` (TP-Link) → `192.168.1.254` (ONT) → `91.120.199.243` (ISP) → … Enrich with GeoIP country and ASN, cache per destination (tracert takes seconds), refresh rarely.
- **Offline:** the ONT stops answering beyond hop 2, so the border closes, ships wait in harbour, and DNS fails. Every local source above keeps working.

---

## 11. Privacy, safety, admin, antivirus

**Needs admin:**
- ETW Kernel-File / Kernel-Network / Kernel-Process / DNS-Client sessions.
- LibreHardwareMonitor motherboard/CPU sensors (driver).
- `SetPerTcpConnectionEStats`.
- Installing Equalizer APO.
- Sysmon/Procmon (drivers).
- Audit policies and reading the Security log.

Everything else in section 1 runs as the normal user.

**How to elevate without a UAC prompt every time:**
- A **Task Scheduler task "Run with highest privileges"** at logon (or on demand from START.cmd via `schtasks /run`) that starts only `vrg-etw.exe`.
- Creating that task is a one-time admin action, and it is a persistent system change, so the user does it themselves.
- The elevated part must stay tiny and read-only:
  - no network listener;
  - a named pipe with an ACL for the current user only;
  - no command that takes paths or executes anything;
  - filters fixed in code.

An elevated process that accepts arbitrary commands from localhost would be a privilege-escalation hole.

**Bind everything to `127.0.0.1`.** Never `0.0.0.0`: not the Node server, not the LHM web server, not an OTLP receiver. The double NAT is not a firewall for the LAN (the phone, IoT devices). Add a random per-session token on the WebSocket so other local pages cannot read it.

**Stays local, never logged into the repo:**
- window titles;
- full file paths outside the repo;
- connection lists with remote IPs;
- DNS names;
- Bluetooth device names and MACs;
- Claude hook payloads (the Write `content` must be dropped at the door);
- now-playing history.

Put any persisted telemetry under a gitignored folder (like `Planner/data/`). Remember `*.pdf` client names show up in window titles and file paths.

**Antivirus and SmartScreen:**
- WinRing0-based tools are flagged as a vulnerable driver; use PawnIO builds.
- Some NirSoft downloads trip PUA heuristics.
- Downloaded unsigned single-file .NET exes can trigger SmartScreen ("unknown publisher") and ML detections. **Building the sidecar locally** avoids the Mark-of-the-Web, so SmartScreen does not prompt. Do not add Defender exclusions; that is a security-setting change and the user's call.
- Keyboard and mouse hooks (`SetWindowsHookEx WH_KEYBOARD_LL`) and screen capture are classic spyware signals. The design above needs neither (WinEvent hooks are not keyloggers).

**Never:**
- packet capture with payloads;
- TLS interception;
- online GeoIP/whois of the connection list;
- remote-debugging ports on browsers;
- replacing device drivers with WinUSB;
- port forwarding.

**OS age:** 21H2 is out of servicing, so the machine no longer gets security fixes on that build (verify the 22H2/ESU path with Microsoft's lifecycle pages). Another reason to keep the telemetry stack local and minimal.

---

## 12. Licence summary

| Component | Licence | Use here |
|---|---|---|
| systeminformation | MIT | ok |
| koffi | MIT | ok |
| get-windows, ps-list, node-window-manager | MIT | ok |
| usb (node-usb) | MIT, bundles **libusb LGPL-2.1** | ok as a dependency (dynamic/unmodified) |
| @abandonware/noble | MIT | not suitable on Windows (adapter takeover) |
| NAudio | MIT | ok, keep the notice if code is copied |
| Microsoft.Diagnostics.Tracing.TraceEvent | MIT | ok |
| krabsetw / Microsoft.O365.Security.Native.ETW | MIT | ok (C++/CLI; x64/ARM64 only) |
| ferrisetw, windows-rs | MIT OR Apache-2.0 | ok |
| EarTrumpet | MIT **modified** (excludes three named companies) | learn from it; copy only with the notice and after reading the clause |
| AudioDeviceCmdlets | MIT (per index; verify LICENSE) | ok as a tool |
| LibreHardwareMonitor | MPL-2.0 (+ third-party notices) | use the app/lib unmodified; modified files stay MPL |
| Equalizer APO | **GPL-2.0** | run it as the user's program and write its config; **never copy its code** |
| USBView sample | MS-PL | learn; copying needs the MS-PL notice, not GPL-compatible |
| Npcap | proprietary: free ≤5 installs, no redistribution; OEM paid | **not used** |
| Sysinternals (Procmon, Sysmon) | Sysinternals EULA, free, no redistribution | the user's own tools only; do not bundle into the repo |
| NirSoft (svcl, USBDeview) | freeware, closed source | the user's own tools only |
| DB-IP Lite | CC BY 4.0 | ok with attribution plus a link to DB-IP.com |
| GeoLite2 | MaxMind GeoLite EULA | possible, but needs an account and the 30-day deletion rule |
| Spotify Web API | Developer Terms + Policy | avoid for visuals; GSMTC instead |

GPL/AGPL code anywhere in this space (Equalizer APO, various ETW/IDS projects): **learn only**, never paste into the MIT-style VRG apps.
Copyright notices travel with any MIT/BSD/MPL code that is copied (repo rule in CLAUDE.md).

---

## 13. Suggested build order (smallest live value first)

1. **Hooks → Node → city** (no admin, minutes of setup): Claude's Read/Edit/Write light up buildings live. Plus a transcript-tail fallback reusing `sessions.js`.
2. **Totals + per-process CPU/RAM/GPU** via `typeperf -si 1` or one persistent PowerShell (Tier 0), then PDH in `vrg-probe.exe`.
3. **TCP table + DB-IP Lite**: connections as routes abroad, coloured by country/ASN (no admin).
4. **`vrg-probe.exe`** (C#, self-contained): windows + WinEvent hooks, Core Audio sessions + meters + volume, GSMTC, Bluetooth watcher, USB tree + hot-plug.
5. **`vrg-etw.exe`** (elevated via scheduled task): Kernel-Network bytes (ships/planes), Kernel-File on H: (everything Bash touches), Kernel-Process tree, DNS names.
6. Optional extras: LHM sensors (PawnIO build), Equalizer APO include file, router UPnP counters, `getDisplayMedia` window textures, Zen WebExtension for tabs.

## 14. Open items to test on this PC

- Does the current Procmon/Sysmon build start on 19044 (the Learn pages say Windows 11+)? Keep an older build if not.
- Process-loopback audio capture on 19044 (officially 20348+).
- Does the TL-WR1043ND stock firmware answer UPnP `GetTotalBytesSent/Received`? Which hardware version is it (sticker)?
- Which Bluetooth devices here expose the battery PnP property?
- .NET: install SDK 8 or 10 portable into `Planner/apps/dotnet`. Decide before 2026-11-10 (.NET 8 end of support); .NET 10 is officially unlisted for 21H2 Pro.
- Kernel-File noise level on H: with Defender, the indexer and VS Code running; choose filters.
- Zen: can an unsigned local WebExtension be installed permanently?

---

## Sources

**Microsoft / primary**
- [GlobalSystemMediaTransportControlsSessionManager (Learn)](https://learn.microsoft.com/en-us/uwp/api/windows.media.control.globalsystemmediatransportcontrolssessionmanager)
- [Process Monitor (Sysinternals, 2026-10-15, "Runs on: Windows 11 and higher")](https://learn.microsoft.com/en-us/sysinternals/downloads/procmon)
- [Sysmon (Sysinternals, 2026-09-10, event IDs, Windows 11+)](https://learn.microsoft.com/en-us/sysinternals/downloads/sysmon)
- [StartTrace / ETW session security (Performance Log Users, NT Kernel Logger admin-only)](https://learn.microsoft.com/en-us/windows/desktop/ETW/starttrace)
- [Controlling Event Tracing Sessions](https://learn.microsoft.com/pl-pl/windows/win32/etw/controlling-event-tracing-sessions)
- [Geoff Chappell: ETW security](https://geoffchappell.com/notes/windows/etw/security.htm)
- [SetPerTcpConnectionEStats (admin)](https://learn.microsoft.com/en-us/windows/desktop/api/iphlpapi/nf-iphlpapi-setpertcpconnectionestats)
- [GetPerTcpConnectionEStats](https://learn.microsoft.com/en-us/windows/win32/api/Iphlpapi/nf-iphlpapi-getpertcpconnectionestats)
- [AUDIOCLIENT_PROCESS_LOOPBACK_PARAMS (build 20348)](https://learn.microsoft.com/en-us/windows/win32/api/audioclientactivationparams/ns-audioclientactivationparams-audioclient_process_loopback_params)
- [GStreamer wasapi2: process loopback on Windows 10](https://git.fasttube.de/FaSTTUBe/GST-Tensordecoder-ov_ep/commit/c98ad6f249f72db4eb6a2bca911f3c57808b197e)
- [Screen capture / Windows.Graphics.Capture (Learn)](https://learn.microsoft.com/en-us/windows/apps/develop/media-authoring-processing/screen-capture)
- [New ways to do screen capture (Windows blog)](https://blogs.windows.com/windowsdeveloper/2019/09/16/new-ways-to-do-screen-capture/)
- [SetWinEventHook (message-loop requirement)](https://learn.microsoft.com/en-us/previous-versions/ms696160(v=vs.85))
- [KB2682659 GetMessage/WinEvent](https://support.microsoft.com/en-us/kb/2682659)
- [.NET 10 supported OS](https://github.com/dotnet/core/blob/main/release-notes/10.0/supported-os.md)
- [TraceEvent Programmer's Guide (elevation, 1–3 s real-time delay)](https://github.com/microsoft/perfview/blob/main/documentation/TraceEvent/TraceEventProgrammersGuide.md)
- [TraceEvent licence (NuGet, MIT)](https://nuget.org/packages/Microsoft.Diagnostics.Tracing.TraceEvent/3.1.0/license)
- [microsoft/krabsetw](https://github.com/microsoft/krabsetw)
- [krabsetw LICENSE (MIT)](https://raw.githubusercontent.com/microsoft/krabsetw/master/LICENSE)

**ETW manifests**
- [Microsoft-Windows-Kernel-File manifest (repnz/etw-providers-docs)](https://github.com/repnz/etw-providers-docs/blob/master/Manifests-Win10-17134/Microsoft-Windows-Kernel-File.xml)
- [Microsoft-Windows-Kernel-Network manifest](https://github.com/repnz/etw-providers-docs/blob/master/Manifests-Win10-17134/Microsoft-Windows-Kernel-Network.xml)
- [Velociraptor Windows.ETW.KernelFile](https://docs.velociraptor.app/artifact_references/pages/windows.etw.kernelfile)
- [Velociraptor Windows.ETW.KernelNetwork](https://docs.velociraptor.app/artifact_references/pages/windows.etw.kernelnetwork)
- [ferrisetw](https://docs.rs/ferrisetw)
- [node-etw (logger only)](https://www.npmjs.org/package/node-etw)

**Claude Code**
- [Hooks reference (events, tool_input schemas, http hooks, async, bashEditDiff, FileChanged)](https://code.claude.com/docs/en/hooks)
- [Monitoring / OpenTelemetry (events, OTEL_LOG_TOOL_DETAILS, export intervals)](https://code.claude.com/docs/en/monitoring-usage)

**Node packages**
- [systeminformation](https://systeminformation.io/) · [general notes (Windows up to 20 s)](https://systeminformation.io/general.html) · [npm](https://npmjs.com/package/systeminformation) · [Debian review (licence)](https://dfsg-new-queue.debian.org/reviews/node-systeminformation/5.31.6-1/090eb552)
- [Koffi (MIT, prebuilt)](https://koffi.dev/) · [Koffi output params / Win32 example](https://koffi.dev/output) · [win32-api (koffi-based)](https://libraries.io/npm/win32-api/9.4.0)
- [get-windows](https://github.com/sindresorhus/get-windows) · [node-window-manager](https://github.com/sentialx/node-window-manager) · [ps-list](https://github.com/sindresorhus/ps-list)
- [node-usb](https://github.com/node-usb/node-usb) · [usb-detection (deprecated)](https://npmjs.com/package/usb-detection)
- [@abandonware/noble](https://github.com/abandonware/noble)
- [NodeRT](https://github.com/m1sta/NodeRT) · [@xan105/nodert](https://www.npmjs.com/package/@xan105/nodert) · [@nodert-win10-19h1/windows.media.control](https://www.jsdelivr.com/package/npm/@nodert-win10-19h1/windows.media.control)
- [edge-js README](https://cdn.jsdelivr.net/npm/edge-js@26.0.0/README.md)
- [chokidar 5.0.0 release](https://newreleases.io/project/npm/chokidar/release/5.0.0)
- [node-ssdp](https://github.com/gkubisa/node-ssdp)
- [node-audio-windows](https://github.com/jlonardi/node-audio-windows)

**Hardware monitor and drivers**
- [LibreHardwareMonitor](https://github.com/LibreHardwareMonitor/LibreHardwareMonitor)
- [lhm-streamdeck (web server 8085 / data.json)](https://github.com/moeilijk/lhm-streamdeck)
- [Home Assistant LHM integration](https://home-assistant.io/integrations/libre_hardware_monitor)
- [Netdata: LHM as collector](https://community.netdata.cloud/t/libre-hardware-monitor-as-collector/3165)
- [Neowin: Windows flags WinRing0](https://www.neowin.net/news/windows-1110-is-flagging-winring0-on-your-pc-monitoring-fan-control-apps-heres-why/)
- [FanControl discussion #3017 (moved to PawnIO)](https://github.com/Rem0o/FanControl.Releases/discussions/3017)
- [Aquacomputer forum on WinRing0 ban](https://forum.aquacomputer.de/weitere-foren/english-forum/p1473106-information-about-windows-defender-warning-hacktool-win32-winring0-aquacomputerservice-sys)
- [OpenRGB PawnIO MR](https://gitlab.com/CalcProgrammer1/OpenRGB/-/merge_requests/2833)
- [Zabbix forum: GPU Engine counters](https://www.zabbix.com/forum/zabbix-help/53205-monitoring-windows-gpu-perf)
- [uberAgent GPU engine types](https://docs.citrix.com/en-us/uberagent/archive/7-1-0/metrics/machine/machine-performance-and-utilization)

**Network, capture, GeoIP**
- [Npcap (1.90, free licence limits)](https://npcap.com/) · [Npcap OEM redistribution](https://npcap.com/oem/redist) · [Npcap OEM internal use](https://npcap.com/oem/internal)
- [DB-IP Lite (CC BY 4.0)](https://db-ip.com/db/lite.php) · [sapics/ip-location-db](https://github.com/sapics/ip-location-db)
- [Netdata: MaxMind GeoLite2 terms](https://learn.netdata.cloud/docs/network-performance-monitoring/network-flows/enrichment-methods/maxmind-geoip-geolite2)
- [UPnP WANCommonInterfaceConfig:1 spec](https://upnp.org/specs/gw/UPnP-gw-WANCommonInterfaceConfig-v1-Service.pdf) · [miniupnpc upnpcommands.h](https://weghos.duckdns.org/godot/Godot/thirdparty/miniupnpc/include/upnpcommands.h.html)
- [OpenWrt nlbwmon package](https://git.openwrt.org/feed/packages/atom/net/nlbwmon/files?h=master) · [OpenWrt forum: per-host realtime stats](https://forum.openwrt.org/t/realtime-stats-network-use-per-host/137583)
- [WinNetFlow (TCPIP provider, admin)](https://docs.guance.com/en/integrations/winnetflow/)

**File tracing tools**
- [procmon-parser (MIT)](https://github.com/eronnen/procmon-parser)
- [Process Monitor (Wikipedia, versions)](https://en.wikipedia.org/wiki/Process_Monitor)

**Audio**
- [EarTrumpet](https://github.com/File-New-Project/EarTrumpet) · [EarTrumpet LICENSE](https://raw.githubusercontent.com/File-New-Project/EarTrumpet/master/LICENSE)
- [Hanselman: EarTrumpet 2.0 and IAudioPolicyConfigFactory](https://www.hanselman.com/blog/EarTrumpet20MakesWindows10sAudioSubsystemEvenBetterandItsFree.aspx)
- [winappaudiorouter docs](https://winappaudiorouter.readthedocs.io/en/stable/)
- [AudioDeviceCmdlets](https://github.com/frgnca/AudioDeviceCmdlets)
- [NirSoft SoundVolumeCommandLine](https://www.nirsoft.net/utils/sound_volume_command_line.html) · [SoundVolumeView](https://www.nirsoft.net/utils/sound_volume_view.html) · [NirSoft volume from command line](https://www.nirsoft.net/articles/increase-decrease-audio-volume-command-line.html)
- [Equalizer APO (SourceForge, GPL-2.0)](https://sourceforge.net/projects/equalizerapo/) · [Peace wiki](https://sourceforge.net/p/peace-equalizer-apo-extension/wiki/How%20to%20use%20Peace) · [EACS (config.txt switching)](https://github.com/psidex/EACS)

**Bluetooth**
- [HyperNylium Get-Bluetooth-Battery](https://github.com/HyperNylium/Get-Bluetooth-Battery-Persentage)
- [Microsoft Q&A: BT battery](https://learn.microsoft.com/en-us/answers/a/1158400) · [Microsoft Q&A: battery script](https://learn.microsoft.com/en-us/answers/a/1277194)
- [Get-PnpDeviceProperty](https://technet.microsoft.com/fr-fr/library/mt130249(v=wps.640))

**Media / Spotify**
- [NPSMLib (GSMTC notes)](https://github.com/ADeltaX/NPSMLib) · [gsmtc crate](https://docs.rs/win-gsmtc)
- [Spotify Feb 2026 migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)
- [Spotify: update on developer access (2026-02-06)](https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security)
- [Spotify: Web API quota updates (2026-07-23)](https://developer.spotify.com/blog/2026-07-23-web-api-quota-updates)
- [Spotify Web API changelog July 2026](https://developer.spotify.com/documentation/web-api/references/changes/july-2026)
- [Spotify Developer Policy](https://developer.spotify.com/policy)
- [Vorp Labs summary (secondary)](https://vorplabs.com/agent-tools/spotify-api-changes)

**Windows lifecycle**
- [TechRepublic ESU cheat sheet](https://www.techrepublic.com/article/news-windows-10-esu-cheat-sheet/)
- [Microsoft Q&A: ESU beyond Oct 2026](https://learn.microsoft.com/en-au/answers/questions/5899411/windows-10-esu-beyond-october-2026)

**Repo context**
- `docs/research/2026-10-26_router-usb-phone-wake.md` (router, double NAT, hops)
- `CodeCity/sessions.js` (transcript → file events)
