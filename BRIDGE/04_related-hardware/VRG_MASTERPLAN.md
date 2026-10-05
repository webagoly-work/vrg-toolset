# CHECKPOINT: REFORM 2026-09-05 (rev. B — Claude Code handoff)

# VRG — Multi-project masterplan

**Repo location:** `projects/varler-planner/docs/VRG_MASTERPLAN.md`
**Audience:** Claude Code sessions, and any cold start — human or agent — that has the repo
and nothing else.

**Relationship to the other docs.** `CLAUDE.md` (repo root) is the session preamble: hard rules
and commands, read automatically. `ARCHITECTURE.md` and `DECISIONS.md` are the Planner's *how*
and *why*. `STATE.md` is the Planner's *what's true today*. **This file is the only one that
covers VRG as a whole** — the program family, the shared contracts, the deployment ladder, and
the one ordered queue every branch hangs off. When this file and a Planner-scoped doc disagree
about scope, the Planner doc wins for the Planner; this file wins for anything crossing program
boundaries.

**Revision B folds in everything that shipped 2026-08-25 → 2026-09-05.** Section 1 is the delta.

---

## 0. For the agent — read this before touching anything

### 0.1 Environment

The environment moved off the USB stick. It is now a dedicated internal 100 GB SATA SSD,
volume label **U100**, tree at `<drive>:\Planner_VRG_U100\Planner`.

**Never hardcode the drive letter.** `scripts\_env.cmd` derives `%ROOT%` from `%~dp0` and sets
everything else from it. Every script sources it first.

```
<ROOT>\
  apps\        node\  git\  claude\  vscode\  browser\
  home\        claude\  gitconfig  .ssh\        (HOME, GIT_CONFIG_GLOBAL, CLAUDE_CONFIG_DIR)
  projects\    varler-planner\  ...
  data\        projects\  backgrounds\  exports\   (outside the repo — never committed)
  tmp\
  scripts\     _env.cmd  cc.cmd  mkdirs.cmd  varler.cmd  planner.cmd
```

| Variable | Points at | Why |
|---|---|---|
| `ROOT` | derived from `%~dp0` | drive-letter independence |
| `HOME` | `%ROOT%\home` | `.gitconfig` and `.ssh\` travel with the drive |
| `GIT_CONFIG_GLOBAL` | `%ROOT%\home\gitconfig` | same |
| `NPM_CONFIG_PREFIX` | `%ROOT%\apps\node` | `claude.cmd` lands on the existing PATH |
| `CLAUDE_CONFIG_DIR` | `%ROOT%\home\claude` | credentials stay on the drive. **Undocumented variable — re-verify after any Claude Code upgrade** |
| `GYRO_PORT` | 47291 | single source of truth for the relay |
| `RELAY_IFACE` | *(optional)* | pin the relay to a named interface on the dual-homed machine |

Launchers: `varler.cmd` is the Hungarian menu and the primary entry point. `cc.cmd` loads the
environment, sanity-checks `node` and `git`, `cd`s to the repo and starts Claude Code.

Machine is dual-homed: Ethernet `192.168.0.x` (house LAN), WiFi dongle `192.168.1.x` (phone
link, the intended default). The wireless-first interface ranking in the relay is deliberate.

### 0.2 Commands

```
npm run build           # src/ -> dist/varler_planner.html
npm test                # 828 assertions / 17 suites / 70 golden renders
node build.js --check   # byte-compare a fresh build against the current dist
```

**A change is not done until `npm run build && npm test` is green.** The 70 golden renders are
the primary correctness gate; they cover the drawing only, so UI chrome may change freely.

Five harnesses exist **outside** `npm test` and must be run by hand until T0.3 lands:

| Harness | Result | Covers |
|---|---|---|
| `tests/link-smoke.js` | 22/22 | `07a-link` envelope, handshake, capability negotiation |
| `tests/control-bridge-smoke.js` | 8/8 | legacy and 2.0 command dialects reaching the same `PLANNER_CAM` methods |
| `tests/qr-net-smoke.js` | 19/19 | `/whoami` relay contract, both v1 and v2 shapes |
| `tests/qr-menu-smoke.js` | 16/16 | the five `qrMenu` injection seams |
| `tests/backup-smoke.js` | 22/22 | `.vbundle.json` round trip |

### 0.3 Hard rules — violating any of these breaks the build or the app silently

1. **Single shared scope.** All of `src/` concatenates into one `<script>`. No imports, no
   module boundaries at runtime. **Grep all of `src/` before introducing any top-level name.**
   A collision does not error at build time; it kills the app at boot. This has happened: a
   scope table named `SC` collided with the plan scale factor in `00-core.js`, and `qrInject`
   was caught one step before shipping an infinite recursion.
2. **Every `window.X =` and every top-level declaration appears exactly once in the built
   file.** `node --check` passes silently on scope duplication — it is a *runtime* failure.
   Verify by extracting the script from `dist/` and grepping that, not by reading `src/`.
3. **Module order is filename order.** `build.js` accepts `^\d\d[a-z]?-.*\.js$`. Insert `05b-`
   between `05-` and `06-`; never renumber. The original regex `^\d\d-` silently excluded every
   `NNx` module and the build stayed at 22 files with no error — the guard that now refuses to
   build when a `.js` in `src/` doesn't match the convention exists because of that.
4. **`typeof X` throws on a `const` still in its temporal dead zone.** Use `window.X` for guarded
   cross-module calls. `PLANNER_LINK` is a `const`; `setMode()`'s hooks use `window.PLANNER_LINK`
   and `window.NOTES` for exactly this reason.
5. **Never replace an `<svg>` element during a drag** — it holds the pointer capture. Replace the
   children. This bug has appeared twice, once per editor.
6. **Never hold a wall reference across an undo.** `applySnap` rebuilds every wall object;
   `reselectAfterSnap()` re-resolves the selection after every restore.
7. **`file://` is the floor.** Dependencies must be UMD or IIFE — no ESM, no CDN. Two markdown
   editors cooked together cause parser-dialect conflicts; one parser, one editor shell.
8. **Folder rule.** Built into the HTML → `src/` as a numbered module. Runs on the PC →
   `tools/`. Runs on another device → `mobile/`. Generated → `dist/`, never hand-edited.
   Drawings and data → `data/`, outside the repo.
9. **Deliver runnable scripts as finished files**, never as commands to paste. Any `.cmd`,
   `.ps1`, `.sh` or `.js` derives its own paths from its location, checks every dependency it
   needs and names the missing one, and uses accent-free console strings on Windows (cp852
   mangles `ő`/`ű`).

### 0.4 Hazard register — code that looks safe to change and is not

| Location | Hazard | Trigger |
|---|---|---|
| `07b-phone-camera.js`, legacy control bridge block | Three `PLANNER_LINK.on(...)` subscriptions map the pre-2.0 `{type:'undo'}` dialect onto `PLANNER_CAM`. **Deleting it silently kills the phone's undo/redo and tool wheel.** | Only remove once `mobile/phone-sender.html` is fully 2.0-b |
| `10-lamps.js` | QR menu injection lives here, **not** in `09-menus.js` — that file ends at `doorTypeDialog` and has no `items` arrays | Any work on menus or QR seams |
| `05f-qr.js` relay contract | Was written against an earlier `/whoami` and would not have connected at all — wrong app name, address field and port range. Both v1 and v2 shapes are now read | Any `/whoami` change must keep both shapes |
| `08-interaction.js`, `PLANNER_CAM` | Ends the hot path in `drawSoon()`, **not** `setPitch`/`setRot` — a gyro streams ~60 updates/sec and the synchronous `draw()` would melt | Any camera or hot-path edit |
| `camDrag` / `camDraw` | Near-miss name pair in one scope | Autocomplete typos |
| `snap_` / `snap` | Same | Same |
| `stairsSym_OLD`, `hideCtx2_` | Dead code still in the global scope | Delete when convenient; grep first |
| `UKEYS` | Drives undo, save **and** clearing together. A new collection not added here survives into new projects | Any new top-level data collection |
| `data.seq` | Ids are counter-issued and never reused, including across undo. Random or time-based ids make the golden tests useless | Any id work |
| `phone-relay-server.js` | Carries unmerged edits from two chat threads | Resolve before forking anything off it (T4) |

---

## 1. Delta since the last baseline — what actually shipped

*The mounted project docs describe 2026-08-25. This is the eleven days since.*

### 1.1 Environment and tooling — **T1 is closed**

- **PortableGit fork bomb: FIXED.** Root cause was manual extraction bypassing
  `post-install.bat`. Re-extracted via `PortableGit-*.7z.exe -o "%ROOT%\apps\git" -y`.
  Version control is live: repo initialised, clean baseline commit of **74 files**.
- **Moved off USB** onto the internal U100 SSD (see 0.1). The drive-letter-agnostic script set
  (`_env.cmd`, `cc.cmd`, `mkdirs.cmd`) is in place. `mkdirs.cmd` uses an `:ensure` subroutine
  with `goto` rather than `if/else` blocks, because CMD mis-parses parentheses in nested blocks.
- **Claude Code installed** via npm into `apps\node`, config redirected to `home\claude`.
- **`CLAUDE.md` authored** at the repo root.
- A bug was caught and fixed mid-setup: `_env.cmd` was not actually replaced on disk, leaving
  `%HOME%` and `%CLAUDE_CONFIG_DIR%` unset.

> ### ⚠ H1 — HOTFIX, do this first
> The setup session set **`core.autocrlf`** to `false` in one place and **`true`** in another.
> `true` rewrites line endings on checkout, which will **break `node build.js --check`'s
> byte-identical comparison and can move the 70 golden renders**. The byte-compare is the
> project's primary correctness gate and it must not depend on a checkout setting.
>
> ```
> git config --global core.autocrlf false
> git config core.autocrlf false
> git config --global core.eol lf
> ```
> Then `npm run build && node build.js --check && npm test` and confirm all three are clean.
> If any golden render moved, the working tree already has rewritten endings — re-checkout
> before doing anything else. **Record the decision and its reason in `DECISIONS.md`.**

### 1.2 Planner — six modules added on top of 1.0

The build is now **25 modules** (was 20). None of the additions touch the drawing, so the 828
assertions and 70 golden renders are unchanged.

| Module | What it owns |
|---|---|
| `07a-link.js` | 2.0-a transport: socket, envelope, `hello` handshake, capability negotiation, reconnect, throttled state broadcast, command routing. Single top-level name `PLANNER_LINK`. **One-way is the floor, not a mode** — a client that never sends `hello` is a legacy one-way sender. One wire format, one code path; the fallback is the *absence* of capabilities. Every envelope carries `from`, so a client ignores its own echo |
| `07b-phone-camera.js` | rewritten as a **consumer**, no longer a socket owner. `handleControl()` deleted; undo/redo/tool arrive as semantic commands routed to `PLANNER_CAM` |
| `07c-share.js` | 2.0-c: HTTP publish/download, remote action routing |
| `07d-linkpanel.js` | the connection panel, replacing the corner widget. **This closed the phone-control failure** — the old widget required manual `ws://` entry and failed silently when an `http://` address was pasted |
| `05f-qr.js` + `05g-qr-targets.js` | QR subsystem. `05f` is project-agnostic (Nayuki encoder in its own IIFE, source registry, dialog, relay handshake) and copies into future projects unchanged; `05g` is the Varler target list — nine targets across STATIC / BOUND / RELAY shapes. `qrRegister()` puts an action in the palette, inspector and right-click menu via `qrInject()` |
| `10b-notes.js` | Note tool: settings panel, numbered list panel, drag-to-reorder, export |

Also: `PLANNER_CAM` appended to `08-interaction.js` and patched with `camKey`, `camUndo`,
`camRedo`, `camSelectTool`; `mobile/phone-sender.html` rewritten for 2.0-b with the full envelope
protocol and a dynamic tool pad; `tools/phone-relay-server.js` made dual-homed with a
subnet-aware `/whoami`, role-aware routing, wireless-first interface ranking, and ports
**47291–47298** with auto-retry.

### 1.3 Environment findings that change the plan

- **Browser swap queued: Opera GX → Chrome for Testing.** A plain Chromium ZIP with no
  auto-updater, no first-run flow and no launcher indirection — which also resolves the
  unfindable `launcher.exe`. Invocation flags: `--user-data-dir`, `--app=`, `--no-first-run`,
  `--no-default-browser-check`, `--disable-background-networking`,
  `--disable-component-update`, `--disable-extensions`. **Pin the exact version in
  `DECISIONS.md` as a build dependency.** Firefox stays as a cross-check only — its `file://`
  origin semantics differ.
- **⚠ Sequencing consequence:** a new browser is a new empty profile, so it is another instance
  of the localStorage-is-profile-bound problem. **Do the browser swap before the Domoszló
  import (T0.1)**, or the rescue lands in a profile that is about to be abandoned. Right now
  the swap is free; after the import it costs a second rescue.

### 1.4 The gyro secure-context blocker — solved in principle

The chosen L2 path is a **tunnelled internet URL** via a GL.iNet mini router or a Pi Zero 2 W
running Tailscale Funnel or `cloudflared`. **A tunnel gives real TLS**, which is what
`DeviceOrientationEvent` needs — the Opera-GX-flags hack and the self-signed cert both become
unnecessary.

> **Architectural correction, locked:** ESP32-class boards, **including all WROOM variants,
> cannot run `cloudflared` or `tailscaled`** — those are Linux OS binaries. This is not a
> pin or wiring problem and no amount of firmware work changes it.

This settles **D5**: the ODU splits into two roles. A **Pi-class board** runs the full server
and terminates TLS. An **ESP32-S3** is a peripheral or a static-file SoftAP island, never the
full ODU.

Six-configuration topology matrix, resolved: **config 1** (all devices on the home LAN, tunnel
handling the internet edge) is the daily driver; **config 4** (S3 as a SoftAP island) is the
offline field mode; **configs 5/6** (USB-C wired) are the anchor fallbacks.

### 1.5 Hardware branch

L1–L7 defined. The spine concept is **generalising the phone relay into a typed device bus** so
any ESP32 or phone becomes a first-class Planner peripheral. **Blocker named:** the Planner has
no typed device bus in 1.0, which is why an S3 cannot integrate today except through USB-HID.
That bus is now a first-class queue item (T4b), not a vague future.

PiP-boy v0 is **electronically parts-complete** — terminal half (WROOM LVGL 2.4" touchscreen,
left 18650) and compute half (ESP32-S3, OLED + EC11, microSD, VL6180X ToF, right 18650), linked
by ESP-NOW with no connector across the join, 90×100 mm per half, 35–40 mm stacked. Only the
clamshell enclosure is missing. A physical footprint mismatch is logged: 42-pin S3 vs 38-pin
shields.

`varler-buildtree.html` is the living inventory and build-tree workbench (two tabs, per-item
compatibility colouring against a selected host, conflict detection for voltage mismatch, I²C
address clash and footprint). **It is the source of truth and it is sent to Claude before each
edit session** — no assumed persistent state.

### 1.6 Other programs

- **`varler_mindmd.html` delivered** — canvas mind-map of connectable markdown bubbles, wiki
  links forming graph edges, five node kinds, inspector, `Ctrl+K` palette, undo/redo,
  localStorage autosave, `.mindmd.json` and flat `.md` round trip, print/PDF. Stack:
  `markdown-it` + `EasyMDE`, renderer built as a swappable seam (`MD.render()` / `MD.fence[]`).
  Its own queue: T1 comment layer (CriticMarkup-compatible) → T2 typing triggers (`/` block
  insert, `[[` autocomplete) → T3 paged output.
- **`varler-webdev-vocabulary.md`** — 10-section glossary generated from the real source, all
  516 function names decoded with prefix families and Hungarian glosses.
- **Domoszló** — complete importable `.vplan.json` (67 devices, 39 paths, 12 notes, 6 toggleable
  tier layers), verified through the real `importProjectFile()` under jsdom; 63-line costed
  schedule at ~4.57 M Ft nettó. Grounding resolved; **TN-C-S vs TN-S still unconfirmed** (D8).

### 1.7 The sibling projects — and what they reveal

Named as future Claude Code targets: **ESPBLOK / BRIDGE-DN firmware** (C/C++, PlatformIO), the
**várlerÁron calculator suite**, **AGENTS!** (HTML/PDF generation), and the **Valena Life
planner** (catalog data entry).

> **The várlerÁron suite is the argument of this document, already happening.**
> It is not one Kalkulátor. It is *several HTML files that have drifted apart* — the same
> failure the two editors had before they were unified onto one surface layer. That drift
> occurred with **two** programs and no shared contract. The roster below adds six more.

---

## 2. What VRG is — the layer model

Five systems with different lifetimes, different failure modes and different costs-of-being-wrong.

| Layer | What it is | Cost if changed later | Build cost now |
|---|---|---|---|
| **L0 — Contract** | envelope, project ids, workspace layout, app manifest | **Catastrophic.** Every program rewrites its I/O | ~1 day |
| **L1 — Programs** | Planner, várlerÁron, Builder, Printer, Logger, Database, Notes, Storage | Local. One program | weeks each |
| **L2 — Session** | Work Projects binding programs together | Medium — needs L0 | ~3 days on L0 |
| **L3 — Transport** | `file://` → localhost → LAN → tunnel → ODU → website | Low **if** L0–L2 exist. Ruinous if not | ~4 days for the ladder |
| **L4 — Telemetry** | ESP measurement → project → digital twin | Medium. Blocked on 1.1 and the device bus | after 1.1 |

### The inversion

The vision is described **outside-in**: a website, containing folders, containing programs. That
is the right picture of the destination and the wrong order for the build. Outside-in means
eight retrofits, each touching save/load, each risking the offline property, with deployment
assumptions leaking permanently into program internals.

Built **inside-out**, the website is the last and cheapest rung on a ladder already climbed
locally. The same server serves `localhost`, then the LAN, then the tunnel, then the ODU, then
the public host. Nothing is rewritten; the bind address and the auth posture change.

> **The website is not the foundation. It is L3's last rung.**
> What makes it possible is that every program already writes the same envelope into the same
> workspace.

### The thing that must happen before program #3

Planner and várlerÁron already disagree about format — two programs, one adapter, and the suite
has *already drifted*. Add Builder, Printer, Logger, Database, Notes and Storage each with their
own JSON shape and their own `localStorage` key, and "interconnected work sessions" becomes
**28 pairwise adapters and an eight-way data-rescue problem**. With one envelope and one
workspace it is eight adapters to one bus, and the rescue problem does not exist because the
data is on disk.

---

## 3. The program roster

| Program | Nature | Size | Verdict |
|---|---|---|---|
| **APPS** | a folder of third-party binaries, not a program | trivial | ⚠ licensing — see 3.4 |
| **PLANNER** | 1.0 + six modules; 1.1 in flight | — | reference implementation |
| **VÁRLERÁRON** (Kalkulátor) | **a suite of drifted HTML files** | medium | consolidation job. Second contract adopter |
| **BUILDER** (elosztószekrény) | new, well specified | medium | **best second build** — see 3.1 |
| **ELOSZTÓ PRINTER** | described both as a Builder feature and its own program | small | make it a **program** (D3) |
| **LOGGER** | planned vs actual daily progress | small–medium | needs something to compare to — see 3.2 |
| **DATABASE** | materials, prices, cikkszám, supplier links, standards | **large** | not a program — the **spine**. Ships as data first |
| **NOTES** | notes matched to catalog, generating spreadsheets | medium | scope down hard — see 3.3 |
| **STORAGE** | owned physical assets | small | **a view over DATABASE** (D4) |

### 3.1 BUILDER is the right second program, and not for the obvious reason

Self-contained (one rail, a module list, drag and drop — no geometry engine), it produces data
both Planner and várlerÁron want, and its labels feed Printer. The real reason:

> **Builder cannot be written without deciding what a catalog item is** — module widths
> (1M/2M/3M), MCB curves and ratings, RCD types, part numbers. That forces DATABASE's schema
> into existence at the cheapest possible moment, driven by a concrete need instead of
> speculation.

`DECISIONS.md` already made half the call: type designation, cores, mm², RE/RM and outer
diameter are universal; gyártói cikkszám differs between distributors. DATABASE is where that
per-distributor mapping lives; Builder is what proves the split works.

Builder also cross-checks the Planner: a board drawn with 9 circuits must produce a rail that
physically fits the selected box. That validation is impossible today, and it is exactly the
error that costs a return visit to site.

### 3.2 LOGGER needs something to compare against

No program in the family emits a schedule, and the BOM has quantities but no time dimension.
Three options: **(1) manual planned-progress entry** — ships in days, recommended for v0;
(2) derived from BOM quantities × productivity rates held in DATABASE — realistic for v1;
(3) a real scheduler — out of scope indefinitely. **Logger is a diary with a comparison column.
Do not let it become a scheduler.**

### 3.3 NOTES has one hard part hidden in three easy ones

Capture, catalog matching and spreadsheet generation are straightforward. **Price refresh is
not**, for two separate reasons:

- **Technical.** A browser cannot fetch a webshop page cross-origin. Price refresh **requires**
  L3 rung 1. Notes is therefore the first program with a hard server dependency, must be built
  after the server exists, and must degrade to "open the link, I'll type the number" offline.
- **Conduct.** Automated repeat fetching of a distributor's catalog is scraping and most terms
  forbid it. Keep it **user-initiated, one item at a time, on demand**. A nightly crawler
  refreshing 400 prices is a different thing and should not be built.

"Scanned" notes implying OCR: **park it.** Manual entry with catalog autocomplete is 90 % of the
value for 5 % of the work, and handwriting OCR in a van is not a solved problem.

### 3.4 APPS — the licensing vectors, front-loaded

| Item | Redistributable from a company site? |
|---|---|
| Node.js | Yes — MIT |
| 7-Zip | Yes — LGPL, with source offer |
| PortableGit | Yes — GPL-2.0, with source obligations |
| **Chrome for Testing** | ⚠ Verify. Distributed by Google for testing purposes; read the terms before mirroring rather than assuming |
| **VS Code** (branded Microsoft build) | **No.** The MIT project is `Code — OSS`; the branded binary is proprietary. Use **VSCodium** if a redistributable editor is needed |
| **Opera GX** | **No.** Proprietary |

Safe pattern regardless: **APPS stores links, version pins, checksums and install notes** — not
binaries — for anything not clearly redistributable. That is 95 % of the value (a reproducible
toolchain) with none of the exposure, and it dovetails with the Chrome-for-Testing version pin.

### 3.5 The digital twin is blocked on 1.1 **and** on the device bus

A measured value — insulation resistance, loop impedance, a thermal reading — does not attach to
a polyline. It attaches to **a run, in a circuit, between two terminals**. That model is exactly
the 1.1 connectivity/occupancy work:

```
terminals   device | junction | board
segments    a drawn run between two terminals
runs        a wire pulled through an ORDERED LIST of segments
circuits    a grouping of runs
```

And the ESP side needs the **typed device bus** (1.5) before an instrument can be anything more
than a gyro-shaped special case.

So telemetry is downstream of **both**. This reframes 1.1: not a feature release, the schema
prerequisite for the entire measurement and digital-twin future.

The *transport* half can proceed in parallel — measurements land in `measurements/` as loose
enveloped records. Only the **binding** waits.

### 3.6 IP separation is a build-system property, not a website feature

"Download the build, not the root" was described as a website button. It is not. Decided now it
costs a JSON field:

- Each program's `manifest.json` declares `visibility: public | internal | private`.
- `build.js` gains a `--dist-manifest` step emitting exactly the public set with checksums.
- The download button — ODU or website — serves that manifest and **has no path to anything
  else**.

Decided at website time instead, it means re-auditing eight codebases under time pressure with a
public host already live.

**This is also the parked "Viewer-only / read-only client view".** That stops being a Planner
feature and becomes a VRG-wide concept: one visibility model serving the download button, the
client share link and the showcase view alike.

### 3.7 Liability and data protection — the gate before anything leaves the LAN

- **GDPR.** Measurement records tied to a site address, an owner and dates are personal data. A
  company host processing them needs a lawful basis, a retention position and access control.
- **Professional liability.** A protection calculation, a cable sizing or a quote served from a
  company site reads as a professional statement. Anything published needs a status stamp
  (`piszkozat` / `ellenőrzött` / `kiadott`) and a named author.

**Rule adopted: private-by-default.** Nothing binds to a public interface until D6 is answered.
A Tailscale Funnel restricted to the tailnet, or a `cloudflared` tunnel behind Access, is
*private* — it satisfies the TLS need (1.4) without triggering any of the above. **That is the
right first form of the remote rung.**

### 3.8 The rule that protects the actual product

`DECISIONS.md`: *"The product is one HTML file… That is a feature, not a limitation."*

> **A program may *use* a server. A program may never *require* one.**
> Every program opens from `file://` with full core function. The server adds the workspace,
> cross-program handoff, price fetch and publishing. It never adds "can you draw a wall".

T4's gate tests this.

---

## 4. The contract layer (L0) — specified

### 4.1 The VRG envelope

```json
{
  "vrg": 1,
  "kind": "planner.plan",
  "id": "VRG-2026-0007.planner.plan.1",
  "project": "VRG-2026-0007",
  "app": { "id": "planner", "version": "1.1.0" },
  "created": "2026-09-05T10:14:00+02:00",
  "updated": "2026-09-05T14:02:11+02:00",
  "title": "Domoszló garázs — villamos",
  "status": "piszkozat",
  "payload": { }
}
```

- `vrg` — **envelope** version, independent of the payload's own schema version.
- `kind` — `app.doctype`. The routing key: how the Shell knows Builder can open it.
- `project` — the join. Everything sharing a `project` is one Work Project.
- `payload` — **untouched by the shell.** The existing `.vplan.json` becomes the payload verbatim.

That last point is what makes adoption cheap: **Planner's cost is a wrapper on save, an unwrap on
load, and a reader that still accepts a bare legacy file** — roughly 30 lines, zero migration,
and the 70 golden renders do not move.

### 4.2 Ids

`VRG-YYYY-NNNN`, counter-issued from `registry/seq.json`, never reused — same doctrine as
`data.seq`. Human-readable titles are a separate mutable field.

### 4.3 Workspace layout

```
data/workspace/
  projects/
    VRG-2026-0007/
      project.json         name, client, address, status, dates
      planner/             *.vplan.json (enveloped)
      varleraron/
      builder/
      notes/
      logger/
      measurements/        telemetry drops, enveloped
      exports/             generated PDFs, labels, spreadsheets
  registry/
    apps.json              which programs exist, versions, kinds they own
    seq.json               the project counter
    catalog/               DATABASE's home — shared, not per-project
  storage/                 STORAGE's home — shared, not per-project
```

**The distinction that was implicit and needs stating:** Planner, várlerÁron, Builder, Notes and
Logger are **project-scoped**. DATABASE and STORAGE are **workspace-scoped** — one catalog, one
inventory, referenced by every project. Getting this wrong means duplicated catalog data and
prices that disagree between jobs.

### 4.4 App manifest

```json
{
  "id": "builder",
  "name": "Elosztószekrény Builder",
  "version": "0.1.0",
  "entry": "builder.html",
  "produces": ["builder.board", "printer.labelset"],
  "consumes": ["planner.plan", "catalog.item"],
  "visibility": "internal"
}
```

`produces` / `consumes` is the interconnection diagram, **machine-readable**. The Shell builds
"what can I do next with this?" from it rather than from a hand-maintained menu — adding a
program becomes a file drop, not a Shell edit. Same principle as the action registry generating
the stage rail and inspector.

### 4.5 The shared module

`vrg-envelope.js`, ~120 lines, included by every program: `wrap()`, `unwrap()`, `isLegacy()`,
`newProjectId()`, `kindOf()`. The only code shared between programs, deliberately.

⚠ **Hard rule 1 applies across eight programs now, not one.** Prefix every name `vrg*` so there
is exactly one namespace to grep.

---

## 5. The transport ladder (L3) — one server, six rungs

| Rung | Origin | Unlocks | Status |
|---|---|---|---|
| **0** | `file://` | today's behaviour. Never removed | live |
| **1** | `http://localhost:47291` | secure context, sibling fetch, workspace API, routing | T4 |
| **2** | `http://192.168.x.x:47291` | phone and tablet on site | live (relay) |
| **3** | **tunnel** (Tailscale Funnel / `cloudflared`) | **real TLS → gyro unblocked**; private remote access | new, from 1.4 |
| **4** | Pi-class **ODU** | deployable without internet | T9 |
| **5** | public host | the website | gated on D6 |

Every rung is **the same server**, forked from `phone-relay-server.js` and merged with it so
there is one process, not two. That is the answer to "how do we stack this safely": you write the
server once, at rung 1, and then move it.

### 5.1 What rung 1 fixes that is already broken

- **`localStorage` is browser-profile-bound.** Already burned once, and the Chrome-for-Testing
  swap is about to burn it a second time. Eight programs would mean eight instances. On rung 1,
  `localStorage` becomes a cache and files on disk become the truth.
- **Secure context for the desktop app.** `http://localhost` is potentially-trustworthy by spec.
  The *phone* still needs rung 3's TLS — but there is now exactly **one place to terminate it**.
- **Cross-origin fetch** for Notes price refresh.
- **The relay merge.** `phone-relay-server.js` has unmerged edits blocking the Desktop Controller
  fork. Rung 1 forces the merge and **unblocks B9 as a side effect**.

### 5.2 The constraint rung 4 imposes on rung 1

Per 1.4 the ODU is Pi-class, so a full server is available — but an S3 SoftAP island (config 4)
must still serve the Shell offline from LittleFS.

> **Design constraint, locked:** the workspace API is a **thin file API** over a root —
> `GET /ws/list?prefix=`, `GET /ws/<path>`, `PUT /ws/<path>`, `DELETE /ws/<path>`, plus the
> existing `/whoami`. No query language, no server-side joins, no business logic. All
> intelligence lives in the programs.

This also keeps the offline property honest: if the server is only a filesystem, nothing
important can accidentally migrate into it.

### 5.3 One browser assumption to verify

`showDirectoryPicker` would let a `file://` program write to a real folder with no server. Per
MDN it is secure-context-only, unsupported in Firefox and Safari, and needs transient user
activation. Whether Chromium permits it on a `file://` origin needs a probe in the actual
Chrome-for-Testing build:

```js
console.log('showDirectoryPicker' in window);
// then, from a real button click:
window.showDirectoryPicker({ mode: 'readwrite' })
  .then(h => console.log('OK', h.name))
  .catch(e => console.log(e.name, e.message));
```

**The plan does not depend on the answer.** Rung 1 is taken regardless. A pass is a bonus offline
path for rung 0; a fail changes nothing.

---

## 6. The queue

Lanes: **T** trunk (blocking, ordered) · **B** branch (parallel-safe) · **H** hotfix ·
**P** parked · **D** dead end.

### H — hotfix

| # | Item | Why it jumps |
|---|---|---|
| **H1** | **`core.autocrlf` conflict** (see 1.1) | Threatens the byte-compare gate and the golden renders. Ten minutes |

### T — trunk

| # | Item | Depends on | Gate |
|---|---|---|---|
| **T0.0** | Refresh `STATE.md`, the `ARCHITECTURE.md` module map and `CLAUDE.md` to the real 25-module tree and the U100 paths | H1 | a cold reader gets the current picture from four files. See 8.1 for the `CLAUDE.md` corrections |
| **T0.1a** | **Browser swap to Chrome for Testing**, version pinned in `DECISIONS.md` | — | `planner.cmd` opens the built file in an `--app=` window |
| **T0.1b** | **localStorage rescue** — Domoszló `.vplan.json` into the *new* profile, first `.vbundle.json`, verify west = house side and board z 1600–2400 against the 1800–2000 operating limit | T0.1a | Domoszló opens and looks right; backup in `data\projects\`. **Order matters** — see 1.3 |
| **T0.2** | `backup-smoke.js` → `spec-20-backup.js` | — | 22/22 inside `npm test` |
| **T0.3** | Fold all five harnesses (0.2) into `npm test` | T0.2 | one command, everything green |
| **T0.4** | `boardFor` identity-link round-trip failure | — | round-trip assertion added |
| **T2** | **VRG-CONTRACT v1** — `VRG_CONTRACT.md` + `vrg-envelope.js` | T0 | round-trip spec: legacy `.vplan.json` → wrap → unwrap → **byte-identical payload** |
| **T3** | **Planner adopts the contract** | T2 | 828 + 70 unchanged; Domoszló loads bare **and** enveloped |
| **T4** | **`vrg-server.js`** — merge the relay, static serve, thin workspace API | T2 | `dist/varler_planner.html` behaves **identically** from `file://` and `http://localhost`; a test asserts no server-only path in the offline build |
| **T4b** | **Typed device bus** — generalise `07a-link` roles so any ESP32 is a first-class peripheral | T4 | an S3 pendant registers, appears in `07d-linkpanel`, and drives an action |
| **T5** | **VRG Shell v0** — `index.html`: project list, program list from `apps.json`, open with `?project=` | T4 | open Domoszló in Planner from the Shell |
| **T6** | **Workspace-on-disk migration** | T4, T5 | switch browser profile → projects still there. **The T0.1 class of bug is gone** |
| **T7** | **Planner 1.1** — P1 → P3+P4 → P2 → W1 → R1+R3+R4 → R2+P5+H2 → H1+H3 | T3 | per `1_1_backlog.md` |
| **T8** | **Telemetry binding** — a measurement attaches to a run/circuit | T7, T4b | a measured value survives save/load attached to the right run |
| **T9** | **Tunnel (rung 3) → ODU (rung 4)**, then publication (rung 5) | T6, D6 | ODU serves the Shell with no internet present |

### B — branch (parallel-safe)

| # | Item | Depends on | Note |
|---|---|---|---|
| **B0** | **DATABASE v0 as data** — `registry/catalog/*.json`: module widths, MCB/RCD types, cable table, per-distributor cikkszám | T2 | ships as **files**, not UI |
| **B1** | **BUILDER** | T2, B0 | the second program; proves the contract on a fresh codebase |
| **B2** | **ELOSZTÓ PRINTER** | B1 | ⚠ exact-millimetre browser printing needs a calibration sheet, `@page` sizing and a documented "no scaling" printer setting |
| **B3** | **DATABASE as a program** | B0, T5 | |
| **B4** | **LOGGER** (manual v0) | T5 | |
| **B5** | **NOTES** | T4 | needs the server for price fetch; degrades offline |
| **B6** | **STORAGE** (view over DATABASE) | B3 | |
| **B7** | **várlerÁron consolidation** — pull the drifted files onto one shared dark-amber design and the envelope | T2 | ideal Claude Code job: an agent that sees all the files at once |
| **B8** | **Hardware branch** — L1 pendant, PiP-boy enclosure | — | converges with T4b and T9 |
| **B9** | **Desktop controller (Tier A)** | **T4** | previously blocked on the relay merge — **T4 unblocks it** |
| **B10** | **Studio mode `04b-studio.js`** (`stu`/`STU` namespace) | files upload | Phase A read-only restyling first |
| **B11** | **MindMD** — T1 comment layer → T2 typing triggers → T3 paged output | — | its own sub-queue |
| **B12** | **APPS folder** — links, version pins, checksums (3.4) | — | trivial |
| **B13** | **ESPBLOK / BRIDGE-DN firmware** | — | separate repo; Claude Code + PlatformIO |
| **B14** | **AGENTS!** and **Valena Life** | — | later contract adopters |

### P — parked

Path auto-router (sits on 1.1's terminals/segments model; revisit after T7) · OCR in Notes ·
virtual sandboxes and server-side website content · deep várlerÁron ↔ Planner integration beyond
consuming `planner.bom` · computer-use experiments (**API-billed, not covered by Pro** — budget
separately from the Claude Code work, which does draw on Pro).

**Removed from Parked:** *Viewer-only / read-only client view* — reframed as the `visibility`
model in 3.6, delivered by T2 + T9.

### D — dead ends (documented so they are not re-investigated)

Carried forward: USB autorun · browser pages cannot control host Bluetooth/WiFi · first-ever BT
pairing is chicken-and-egg · WebRTC without a signalling server · pocket MiFi firmware not
user-writable · qr-zip binary codes · polygon-clipping union libraries · block-based WYSIWYG
(incompatible with `file://` and text-as-truth).

**Added by this checkpoint:**
- **`cloudflared` / `tailscaled` on ESP32.** Linux OS binaries. Architectural, not fixable.
- **"Website first."** Costs eight retrofits and permanently leaks deployment assumptions.
- **One `localStorage` per program.** Multiplies a bug that has already cost one rescue and is
  about to cost a second.
- **Server-backed programs (PHP/DB).** Repeals the single-file offline property.
- **Redistributing branded VS Code / Opera GX binaries.** Licence-prohibited.
- **A background price crawler.** Scraping at volume against distributor terms.
- **The Opera-GX-flags gyro workaround and the self-signed cert.** Superseded by the tunnel's
  real TLS.

---

## 7. Decision register

| # | Decision | Status |
|---|---|---|
| **D1** | Envelope: wrap the payload, or a sidecar `.vrg.json`? | **Open.** Recommend **wrap** — one file to move, copy and email; sidecars get separated |
| **D2** | Project ids: `VRG-YYYY-NNNN` or client-derived? | **Open.** Recommend **`VRG-YYYY-NNNN`**, counter-issued; titles separate and mutable |
| **D3** | ELOSZTÓ PRINTER — program or Builder panel? | **Open.** Recommend **program**; labels are needed for boards never drawn in Builder |
| **D4** | STORAGE — own model or a view over DATABASE? | **Open.** Recommend **view**; an asset is a catalog item with a quantity and a location |
| **D5** | ODU target | **RESOLVED 2026-09-05.** Pi-class runs the full server and terminates TLS; ESP32-S3 is a peripheral or static SoftAP island. ESP cannot tunnel |
| **D6** | Public host — when, under what access model? | **Partially resolved.** First form is a **private tunnel** (Funnel / Access), which satisfies TLS without triggering 3.7. A genuinely public host stays gated |
| **D7** | PortableGit | **RESOLVED 2026-09-05.** Fixed — `post-install.bat` was the missing step |
| **D8** | Domoszló supply: TN-C-S or TN-S? | **Open, and it is a field question, not a code one.** Determines the EV circuit protection strategy |
| **D9** | `core.autocrlf` | **Open — H1.** Must be `false`. Record the reason: the byte-compare gate |
| **D10** | Browser: Chrome for Testing version pin | **Open.** Pin the exact build in `DECISIONS.md` before T0.1b |

---

## 8. Next actions

1. **H1** — settle `core.autocrlf`, rebuild, `--check`, `npm test`. Ten minutes, do it first.
2. **T0.1a then T0.1b, in that order.** Swap the browser *before* the Domoszló import.
3. **T0.0** — bring `STATE.md`, `ARCHITECTURE.md` and `CLAUDE.md` current (see 8.1).
4. **Answer D1–D4 and D10.** Cheap now, expensive in three months.
5. **Then `VRG_CONTRACT.md`**, drafted from section 4.

### 8.1 `CLAUDE.md` corrections

The version at the repo root predates this checkpoint and is now wrong or thin in five places:

| Says | Should say |
|---|---|
| "v1.0.0, 20 modules" | **25 modules**; six added 25–30 Aug, none touching the drawing |
| — | the five out-of-suite harnesses (0.2), and that they must be run by hand until T0.3 |
| — | the hazard register (0.4), especially the **07b legacy control bridge** and **QR injection living in `10-lamps.js`** |
| — | hard rule 4 (`window.X`, not `typeof X`, for a `const` in its TDZ) and hard rule 9 (finished scripts, not pasted commands) |
| — | *"For anything crossing program boundaries, read `docs/VRG_MASTERPLAN.md` first."* |

### 8.2 Files for the next working session (T2 / T3)

| # | File | Path | Status | Why |
|---|---|---|---|---|
| 1 | `CLAUDE.md` | repo root | **edit target** | apply 8.1 |
| 2 | `STATE.md` | `docs\` | **edit target** | rewrite to the 25-module tree and the U100 paths |
| 3 | `1_1_backlog.md` | `docs\` | **edit target** | fold the VRG lanes into the existing queue |
| 4 | `11-controls.js` | `src\` | **edit target** | persistence, projects, import/export — where the envelope lands |
| 5 | `01-schema.js` | `src\` | **edit target** | schema and migrations — the unwrap seam |
| 6 | `build.js` | repo root | **edit target** | the `--dist-manifest` / visibility step |
| 7 | `phone-relay-server.js` | `tools\` | **edit target** | fork base for `vrg-server.js`; **unmerged edits must be resolved here** |
| 8 | `07a-link.js` | `src\` | read-only | the role model T4b generalises |
| 9 | várlerÁron files | wherever they live | read-only first | their current formats decide how much D1 costs |

---

## 9. What revision B changed

- **T1 (version control) closed.** PortableGit is fixed and the repo is live — the recommended
  cause was the right one.
- **D5 and D7 resolved; D6 partially resolved.** The ODU splits Pi-class / ESP-peripheral, and
  the first remote rung becomes a private tunnel.
- **Added H1**, a real threat to the byte-compare gate found in the setup transcript.
- **Added rung 3 (tunnel)** to the ladder, which retires the gyro secure-context blocker and
  kills two queued workarounds.
- **Added T4b (typed device bus)** as a named trunk item, having identified it as what blocks S3
  integration.
- **Re-sequenced T0.1** into browser-swap-then-rescue, avoiding a second localStorage rescue.
- **Reclassified KALKULÁTOR as várlerÁron, a drifted suite** — the contract argument already
  demonstrated in the wild, with a consolidation job (B7) attached.
- **Added §0** — environment, commands, hard rules and hazard register — so a Claude Code
  session can start from this file alone.
- **Added B10–B14**: studio mode, MindMD, APPS, ESPBLOK/BRIDGE-DN, AGENTS!/Valena Life.

---

*Next checkpoint: after Phase B closes — Planner on the contract, 828 + 70 unchanged.*
