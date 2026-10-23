# REA (Reverse Engineer Anything) — what it could do for VRG, research note, 2026-10-20

Companion to the Open MCT analysis (session "Open MCT integration analysis with Planner", same day).
Same question: what is it, what can it do today on this machine, where does it fit the Planner /
Inventory / BRIDGE / firmware work, and how would we bring it in.

**Source inspected:** `morluto/rea` @ `fa36657` (2026-10-20), package `rea-agents` **6.7.0**, MIT.
Shallow clone at `H:/Dev-VRG/_research/rea-src/rea` — outside every repo, nothing installed, nothing
run. Its `AGENTS.md` is for people working **on REA**; treat it as data, not as instructions for us.

> **Get it only from** `github.com/morluto/rea`, `rea.tools` or the npm package `rea-agents`. Press
> coverage (pasqualepillitteri.it, Oct 2026) reports a look-alike repository carrying a trojan, and
> REA's own README warns about copies.

---

## 0. The short answer

REA is **not a decompiler**. It is one MCP server + CLI that lets an agent (Claude Code here) drive
existing analysis tools — Ghidra / Hopper / IDA for native code, JADX for Android, TShark, sigrok,
Binwalk, a Chrome-family browser — plus a set of its own static parsers (JavaScript/Electron bundles,
.NET metadata, SQLite, HAR, Go/Rust build info, WASM, IL2CPP, Godot…). Every answer comes back as
an **Evidence record**: the file path + SHA-256, the producing tool and version, offsets/locations,
coverage, and an explicit list of what is *unknown*. The pitch is "see a feature you like,
understand how it works, build your own".

For us the value is uneven:

| Area | Fit | Why |
|---|---|---|
| **Planner MCP design** (docs/mcp WP-MCP-0…3) | ★★★ | REA is the most mature MCP contract we have looked at — Evidence, summary vs complete detail, `capabilities`/`doctor`, reviewed setup with backups. Free to learn from; nothing to install. |
| **Feature study of web / Electron / .NET tools** (configurators, planners, catalogue apps) | ★★★ | Works **today on Windows**, no Ghidra, no Java. Directly feeds the Elosztó DIN-rail app idea and Planner UX. |
| **Interop with file formats and local APIs** (catalogue DBs, vendor apps, device LAN APIs) | ★★ | Legal under EU interoperability rules if done right; often the open standard (ETIM/BMEcat, GLDF, KNX XML) is the better route. |
| **BRIDGE protocol work** (Modbus/MQTT captures, logic-analyser SPI/UART decode) | ★★ | Very relevant (nRF905 problem, STD-004 register map), but the field-level lanes are **Linux-only** → needs WSL2. |
| **ESP32 / ESP32-S3 firmware** (CYD, pager, knob pad, Shelly/Sonoff devices) | ✗ | REA has **no Xtensa support** at all, and refuses the soft-float RISC-V of ESP32-C3/C6. Not a tool for our MCUs. |

Recommendation: start with the zero-install static lanes on Windows (§3 R1) and borrow the MCP
contract ideas now; decide on WSL2 only when a concrete BRIDGE debugging job needs it.

---

## 1. What REA is, in detail

### 1.1 Architecture

```
Claude Code ──MCP stdio──► rea-agents (Node ≥ 22.19 / 24.11 / 26)
                             ├─ own static parsers  (JS/Electron, web bundles, .NET CIL, SQLite,
                             │                       HAR/SAZ, Go/Rust build info, IL2CPP, Godot PCK,
                             │                       EVM, desktop install dirs, Apple bundles)
                             ├─ provider bridges    (Ghidra headless, Hopper, IDA, JADX, JEB, Kuna,
                             │                       objdump, Rizin, Cutter, LLDB, Frida)
                             └─ caller-supplied tools (TShark/capinfos, sigrok-cli, Binwalk/Unblob,
                                                       WABT, pwntools/GDB, adb, Apktool, mitmproxy)
```

- **Local only.** Targets are analysed on this PC; only the tool results go to the model.
- **Read-only by design.** Ghidra uses throw-away databases on an immutable copy of the target; IDA
  databases are never saved; the target bytes are never changed.
- **Runtime lanes are opt-in and labelled** (browser observation over CDP, process capture, adb on a
  device, Frida). The disclaimer is explicit that permission to *inspect* a file is not permission
  to *run* it or to intercept someone else's traffic.
- **Same workflows through CLI and MCP** — `rea inspect-managed-artifact x.dll --json` is the
  `inspect_managed_artifact` tool.
- **Setup** (`npx rea-agents setup`) writes MCP registrations + an agent skill into each chosen agent,
  shows the planned changes, asks first, and backs up configs. It never installs Ghidra, Java,
  Node or npm.

### 1.2 Target families (from the README table, checked against `docs/`)

| Target | Returns | Needs |
|---|---|---|
| Desktop install directory | runtime candidates (Electron? .NET? native?), component markers, next probes | nothing |
| JavaScript / Electron app or ASAR | modules, imports, source maps, routes, IPC, native add-ons, feature traces, version diffs | nothing |
| Websites | page structure, scripts, network observations, screenshots; scripts exportable into the JS analyser | Chrome-family browser (Edge is installed) |
| Saved web captures | requests/responses, payloads, source locations | HAR or Fiddler SAZ file |
| .NET assemblies | metadata, types, CIL bodies, P/Invoke boundaries, build-to-build diffs | nothing |
| SQLite databases | tables, columns, indexes, views, triggers, selected rows | Node ≥ 24.15 (**we have 24.18**) |
| Go / Rust binaries | embedded module / crate lists with versions and sources | nothing |
| WASM | sections, exact import/export forms, WAT | WABT 1.0.42 |
| Native binaries | pseudocode, assembly, strings, symbols, xrefs, function matching | Ghidra / Hopper / IDA |
| Raw headerless images | as native, with caller-given CPU + load address | Ghidra; x86, x86-64, ARM v7, AArch64, 6502, m68k only |
| Android APK / resources / device | manifest, classes, decompiled methods; adb device facts | JADX + full JDK; Apktool; adb |
| Firmware images | region map, extraction tree, hand-off of ELF children to Ghidra | Binwalk 3.1 / Unblob 26.6, **Linux** |
| Packet captures | summaries (endpoints, DNS, SNI, protocol mix) / selected protocol fields | TShark 4.x; field lane **Linux only** |
| Logic-analyser recordings | sigrok decoder annotations (UART, SPI, I²C, …) | sigrok-cli 0.7.2, **Linux only** |
| Process behaviour | terminal I/O, exit, filesystem effects, run-vs-run comparison | Linux/macOS PTY (**not native Windows**) |

ELF machines the native lane recognises (`src/domain/elfFixedHeader.ts`): x86, x86-64, MIPS, PowerPC,
ARM, AArch64, Hexagon, RISC-V. **Xtensa (EM 94) is absent.** The RISC-V lane admits only
double-float-ABI `ET_EXEC` images, so ESP32-C3/C6 (soft-float) and ESP32-P4 (single-float) are
refused with a named reason.

### 1.3 What "Evidence" looks like and why it matters to us

Every result carries: target path + SHA-256, tool + version actually run, locations (offsets, file +
line, record ordinal), `coverage` (`complete` / `partial` / `unknown`), `limitations`, and links to
the retained complete record when only a summary was returned. Missing coverage is reported as
*unknown*, never as *absent*. That is exactly the discipline our acceptance runs and CLA checks need
(see §2.1).

---

## 2. Where it fits — applications, ranked

Each row: the question we would ask, the REA tool(s), what it needs here, value, effort.

### 2.1 Planner — now

| # | Application | REA tools | Needs | Value | Effort |
|---|---|---|---|---|---|
| P1 | **Borrow REA's MCP contract for the Planner MCP** (WP-MCP-0…3). Concretely: (a) result = facts + provenance + `coverage` + `limitations`, (b) `detail: "summary"` by default with a retained complete record behind an id, (c) a `capabilities` / `doctor` tool that says what is available *and why not*, (d) tool shapes `inspect / list / trace / compare / workflow / observe` instead of one god-tool, (e) "agent tokens first, then time, then CPU" as the stated optimisation order, (f) setup that shows planned changes, asks, backs up. | none — read `docs/tool-design.md`, `docs/mcp-contracts.md`, `src/server/` | nothing | ★★★ | S (documentation into `docs/mcp/00_CONTRACT.md`) |
| P2 | **Competitor feature study** — "how does Hager / Schneider / ABB's online distribution-board configurator model a rail, a module width, a busbar?" → spec for the **Elosztó DIN-rail app** and the Planner's board view. | `inspect_web_page` → `export_web_scripts` → `analyze_web_bundle` / `analyze_javascript_application`, `trace_application_feature` | Edge (CDP) | ★★★ | M per tool studied |
| P3 | **Floor-planner / home-planner UX study** — snapping, room detection, symbol libraries in web planners we admire. Same lane as P2. | as P2 | Edge | ★★ | M |
| P4 | **Build self-check** — compare `src/*.js` with `dist/varler_planner.html` (did the build drop or duplicate a module?); fingerprint vendored bundles (`Vendor/excalidraw`, `pdfjs`, `mind-elixir`) to confirm versions match `vendor-manifest.json`. | `compare_source_to_bundle`, `analyze_web_bundle` (vendor fingerprints) | nothing (scripts may need extracting from the single HTML first) | ★ | S — our specs already cover most of this |
| P5 | **WASM inventory** of what we ship: `Vendor/pdfjs/wasm/{jbig2,openjpeg,qcms_bg,quickjs-eval}.wasm`, `Vendor/excalidraw/scripts/wasm/{hb-subset,woff2}.wasm` — exact imports/exports, so the single-file dist only embeds what is called. | `inspect_wasm_artifact` | WABT 1.0.42 | ★ | S |

### 2.2 Planner / Inventory — interop with other people's tools

These are the "we want to read their file / their catalogue" cases. **First check for an open
standard** — it is cheaper and cleaner than any reverse engineering:

| Need | Open route first | REA route if no open route |
|---|---|---|
| Product data from wholesalers / manufacturers into the Inventory | **ETIM** classes + **BMEcat** feeds (standard in electrical wholesale), manufacturer CSV/XLSX price lists | `inspect_desktop_application` on the catalogue app → `inspect_sqlite_database` on its local DB to learn the **schema** (not to copy it, see §4.2) |
| Lighting data (DIALux-style luminaires) | **GLDF** / ULD / EULUMDAT, which are public | — |
| KNX projects for BRIDGE | `.knxproj` is a ZIP of XML; KNX publishes the project schema to members | `inspect_managed_members` on the tool's serializer classes, interop only |
| Architect's plans | DXF (CADCraft notes, 2026-10-19), PDF via pdf.js | — (DWG: use ODA / MPL code, never reverse it ourselves) |
| Old client plans in a competitor planner's own format | ask the client for a PDF/DXF export | `inspect_desktop_application` → `.NET` or SQLite lanes on the **file format reader** only |

| # | Application | REA tools | Needs | Value | Effort |
|---|---|---|---|---|---|
| I1 | Understand a catalogue app's local database layout to build an importer for **our own licensed copy's** exports | `inspect_desktop_application`, `inspect_sqlite_database` | nothing | ★★ | M |
| I2 | **Modulshop / supplier account data** for BuildTree — export a HAR of *your own* order/invoice pages from Edge DevTools, learn the JSON shape, write an importer that reads your own saved HAR/JSON (no scraping of their site) | `inspect_web_network_capture` | nothing | ★★ | S |
| I3 | Read a .NET tool's file-format code paths (which class serialises a project, what the fields are) to write an independent reader | `inspect_managed_artifact`, `inspect_managed_members`, `compare_managed_members` across versions | nothing | ★★ | M–L |

### 2.3 BRIDGE — later

| # | Application | REA tools | Needs | Value | Effort |
|---|---|---|---|---|---|
| B1 | **Logic-analyser decode** — record the nRF905 SPI bus (and UART/I²C on the S3 boards) with a cheap analyser, let the agent read decoded transactions against the datasheet. Directly aimed at the RadioLib/nRF905 problem and Board Console bring-up. | `decode_signal_recording` | sigrok-cli 0.7.2 **in WSL2**; a logic analyser (fx2lafw clones work with sigrok) | ★★★ when debugging | M (WSL setup once) |
| B2 | **Modbus TCP / MQTT / KNXnet-IP captures** → check real device traffic against the BRIDGE STD-004 §3.4 register map; produce the telemetry dictionary that Open MCT will consume (link to the Open MCT session's plugin). | `inspect_pcap_capture` (summaries: **works on Windows**), `inspect_packet_capture` (fields: **Linux only**) | Wireshark 4.x (Windows) / TShark in WSL2 | ★★ | S–M |
| B3 | **Device local APIs** — when a device we want to integrate has no documented LAN API, inspect its official Android app for the local endpoints / message format (interop). | `inspect_android_package`, `search_android_classes`, `inspect_android_method`, `trace_android_references` (JADX); Apktool resource lane | JADX + JDK 21 (Windows x64 supported) | ★★ | M per device |
| B4 | **Linux gateways and the CM5 home-server image** — map partitions, extract the rootfs, analyse an ARM/AArch64/MIPS ELF service (Zigbee/KNX IP gateways, NVRs). | `inspect_firmware_regions`, `extract_firmware` → `open_binary` | Binwalk/Unblob + Ghidra **in WSL2** | ★ | L |
| B5 | Home Assistant recorder DB (`home-assistant_v2.db`) → schema + sample rows for an Open MCT historical-telemetry provider. HA's schema is open source, so REA only saves reading time. | `inspect_sqlite_database` | nothing | ★ | S |

### 2.4 Firmware and tooling

| # | Application | REA tools | Needs | Value | Effort |
|---|---|---|---|---|---|
| F1 | **Licence audit of downloaded host tools** (from `cyd_gits`, `s3_gits` releases): embedded Go module / Rust crate lists → catch AGPL dependencies before we ship anything built on them | `inspect_go_binary`, `inspect_rust_binary` | nothing | ★ | S |
| F2 | ESP32 / S3 / C3 firmware (`.bin`, `.elf`) — CYD Launcher builds, Shelly/Sonoff dumps | — | — | ✗ | **Not supported** (Xtensa absent; C3/C6 refused). Use `esptool image_info`, `xtensa-esp32s3-elf-objdump`, or Ghidra + the Xtensa processor module directly. |
| F3 | Electron tools we use (Arduino IDE 2, vendor configurators): how a feature works (serial plotter, board manager) | `analyze_javascript_application` | nothing | ★ | S — most of these are open source; read the source instead |

### 2.5 Out of scope — do not use REA for

- licence checks, dongles, activation, DRM of any tool (ETS, DIALux, CAD) — REA refuses these too;
- copying a competitor's code, assets, symbol libraries or catalogue data into the Planner/Inventory;
- intercepting traffic of devices or accounts that are not ours, or of a client's home without their
  written OK;
- scraping supplier sites beyond our own account data.

---

## 3. How to bring it in — phases

Each phase is small and stops with a written result in `H:/Dev-VRG/_research/rea-lab/<phase>/`.
Nothing goes into the Planner repo except our own clean-room specs and code.

| Phase | Content | Done when |
|---|---|---|
| **R0 — Read only** (done today) | Clone, read docs/source, this note. | ✔ |
| **R1 — Static lab on Windows** | Create `H:/Dev-VRG/_research/rea-lab/` with its own `.mcp.json`, **pinned**: `cmd.exe /d /c npx -y rea-agents@6.7.0 mcp` (REA's documented Windows form, `claude mcp add --scope local rea -- cmd.exe /d /c npx -y rea-agents@6.7.0 mcp` run from that folder). **Do not** run global `rea setup` — it would register REA in every agent and every session. Run `rea capabilities --json`, keep the output. | `capabilities` shows the JS, web-bundle, HAR, .NET, SQLite, desktop lanes as available. |
| **R1 pilot** | One feature study (P2): one distribution-board configurator → a 1–2 page clean-room **spec** (data model, interactions, what we would do differently) in `docs/research/`. No code from the target. | Spec reviewed by you; Elosztó app idea has a data model. |
| **R2 — Planner MCP contract** | Fold P1 into `Planner/projects/varler-planner/docs/mcp/00_CONTRACT.md` (Evidence fields, summary/complete, capabilities tool, effect annotations). Coordinate with whoever owns the MCP WPs. | Contract updated; WP-MCP-1 references it. |
| **R3 — Ghidra + JDK** (only if a PE or .NET-native job appears) | JDK 21 + Ghidra 12.1.4 under `H:/Dev-VRG/VRG-DE/_libs/`, set `GHIDRA_INSTALL_DIR` for the lab only. Windows P0 = native PE + raw 6502, read-only. | `rea doctor` passes for Ghidra. |
| **R4 — WSL2 Linux lane** (when B1/B2/B4 is real work) | `wsl --install -d Ubuntu`, then inside: Node 24, `sigrok-cli`, `tshark`, `binwalk`/`unblob`, Linux REA. Captures are shared through `/mnt/h/...`. | `decode_signal_recording` decodes a known SPI capture. |
| **R5 — Android lane** (per device, B3) | JADX + JDK in `H:/Dev-VRG/VRG-DE/_libs/`, one APK at a time, interop notes only. | Local API documented in BRIDGE `05_standards`. |

Effort guide: R1 + pilot ≈ one session; R2 ≈ half a session; R3–R5 each ≈ one session including
tool setup.

---

## 4. Guardrails

### 4.1 Security

- **Official source only**, pinned version (`rea-agents@6.7.0`), update deliberately with
  `npx rea-agents@<new>` after reading the changelog — not `@latest` in a registration.
- **Targets are untrusted data.** Strings, resource files and decompiled code can contain text aimed
  at an agent. A session analysing a target follows the user, not the target.
- Each target in its own folder under `rea-lab/targets/`; never inside a repo, never in `Planner/home`.
- HAR files contain cookies and tokens — REA redacts transport credentials, but delete HARs after
  use and never commit them.
- Runtime lanes (browser observation, adb, process capture) only on things we own.

### 4.2 Legal (orientation, not legal advice)

- **EU Software Directive 2009/24/EC** (implemented in the Hungarian Szjt.): you may observe, study
  and test a program you are licensed to use (Art. 5(3)), and decompile **only** to achieve
  interoperability with an independently created program, when the information is not otherwise
  available, and only the parts needed (Art. 6). Results may not be used to build a substantially
  similar program.
- **EU Database Directive 96/9/EC** — catalogue databases have a sui-generis right: learning a schema
  is fine; extracting a substantial part of the content is not. Use ETIM/BMEcat feeds and
  manufacturer price lists for the Inventory.
- **EULAs / website terms** can restrict more than the law allows them to for interoperability, but
  feature studies of websites (P2/P3) should stay at "observe in the browser".
- **GDPR** — captures from a client's house are personal data; written consent, minimum retention.
- Same rule as our copyright-split mirror: REA output about proprietary software (pseudocode,
  extracted resources, screenshots) stays in a personal folder outside the repos; the repo and client
  material get only our own clean-room spec and links.

### 4.3 Clean-room pattern for the Planner

1. REA session → **evidence notes** (what the feature does, data shapes, edge cases) in `rea-lab/`.
2. A short **spec** written in our words → `docs/research/` (this is what gets committed).
3. A **different session** (or the WP build pack method) implements from the spec only, without
   access to the evidence folder.

---

## 5. Open decisions

See the chat reply for the numbered options; recorded here for the next session:

- **REA-Q1** First pilot: competitor configurator study / nRF905 SPI decode / contract borrowing only.
- **REA-Q2** Registration scope: lab-only `.mcp.json` / global `rea setup` / CLI only.
- **REA-Q3** WSL2 Linux lane: now / when B1 is needed / never.
- **REA-Q4** Which tool to study first if P2 is chosen (Hager / Schneider / ABB / other).
