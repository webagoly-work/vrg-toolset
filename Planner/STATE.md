# Varler Planner — State of the Project

*Living status doc. Read this to know where things stand right now. Update the date and
the sections below whenever something ships or an open item closes. This is the "what's
true today" file; ARCHITECTURE.md and DECISIONS.md are the "how and why" files.*

**Last updated:** 2026-08-30

---

## Current version

**v1.0.0 — shipped and green.** The 1.0 refactor is complete. Work since 25 Aug has been
additive: four new modules on top of 1.0, none of which touch the drawing.

- **24 source modules** in `src/`, concatenated in filename order by `build.js` into
  `dist/varler_planner.html` (one self-contained offline file).
- Test suite: **828 assertions across 17 suites + 70 golden renders**, unchanged by any of
  the additions below — everything new is UI chrome, transport or export.
- Golden renders cover the **drawing only**, not UI chrome — adding a button doesn't move them.

What 1.0 delivered: versioned document schema with stable ids + migrations + derived
connectivity + validation; one editor surface with two projections (wall elevation +
floor/ceiling plane); two render layers repainting only what changed (idle 117 ms → 5 ms);
scoped undo history; an action registry driving the ⌘K palette, stage rail, inspector and
keyboard; i18n seam (HU/EN) and a standards settings panel.

The **Elevation Editor** (queue item G) and the top-down **Floor/Ceiling Plane Editor** are
both done.

---

## Added since 1.0 (25–30 Aug)

### `07a-link.js` — the 2.0-a transport layer

Owns the socket, the message envelope, the hello handshake, capability negotiation,
reconnect, throttled state broadcast and command routing. Consumers register handlers; the
module never decides what a command *means*. Single top-level name: `PLANNER_LINK`.

**One-way is the floor, not a separate mode.** A client that never sends `hello` is treated
as a legacy one-way sender: it can push orientation and gestures and receives nothing.
One wire format, one code path — the fallback is the *absence* of capabilities.

Harness: `tests/link-smoke.js`, **22/22**. Not in `npm test` — it stubs a socket rather than
booting the app.

### `07b-phone-camera.js` — rewritten as a consumer

No longer owns a socket. Subscribes to `orientation` and `gesture`. `handleControl()` was
deleted; undo/redo/tool now arrive as semantic commands (`edit.undo`, `edit.redo`,
`tool.select`) routed by `07a-link` straight to `PLANNER_CAM`.

**A legacy control bridge is in place and load-bearing.** The shipped
`mobile/phone-sender.html` predates 2.0 and sends bare `{type:'undo'}` etc. Three
`PLANNER_LINK.on(...)` subscriptions map those onto the same `PLANNER_CAM` methods.
**Delete that block only when `phone-sender.html` is rewritten for 2.0-b** — removing it
earlier silently kills the phone's undo/redo buttons and the tool wheel.
Harness: `tests/control-bridge-smoke.js`, **8/8** (both dialects end at the same methods).

### `PLANNER_CAM` — appended to `08-interaction.js`, and patched

`camDraw`, `camSetPitch`, `camSetYaw`, `camPivotAt`, `camIsOverUI`, `camReset`, plus the
25 Aug patch adding `camKey`, `camUndo`, `camRedo`, `camSelectTool`. Verified live in
`dist`. Ends the hot path in `drawSoon()`, not `setPitch`/`setRot`, because a gyro streams
~60 updates/sec.

`setMode()` now carries two one-line hooks: `PLANNER_LINK.pushState(false)` and
`NOTES.onMode(m)`. Both use `window.X` rather than `typeof X` — `PLANNER_LINK` is a `const`,
and `typeof` on a `const` still in its temporal dead zone throws instead of returning
`'undefined'`.

### `05f-qr.js` + `05g-qr-targets.js` — the QR subsystem

Project-agnostic encoder and registry (`05f`) plus the Varler-specific target list (`05g`).
Nine targets across three shapes: STATIC (wifi, url, text), BOUND (device, path, room),
RELAY (phone, cmd, dl).

The relay contract in `05f` was written against an earlier `/whoami` and **would not have
connected at all** — wrong app name, wrong address field, wrong port range. Corrected
30 Aug; both the v1 and v2 shapes are now read.
Harness: `tests/qr-net-smoke.js`, **19/19**.

Menu injection lives in `10-lamps.js`, **not** `09-menus.js` as the design doc said —
`09-menus.js` ends at `doorTypeDialog` and has no `items` arrays. Five seams via a `qrMenu`
wrapper. Harness: `tests/qr-menu-smoke.js`, **16/16**.

### `10b-notes.js` — the Note tool subsystem

Settings panel (icon mode, text size, icon size, opacity — live sliders; edits the selected
note, or the defaults for new notes when nothing is selected), numbered list panel with
drag-to-reorder and Markdown/CSV/TXT export, a fifteen-entry right-click menu where there
was one Delete, and a note sub-layer per layer.

**Golden-render contract:** `ntSym()` returns the 1.0 markup byte for byte whenever a note
carries none of the new fields. Nothing is written to a note until the user changes it, so
old `.vplan.json` files round-trip untouched and the schema spec sees no new keys.
`tests/notes-smoke.js` holds a literal copy of the old template and asserts equality against
it — **41/41**. That test fails before the goldens do.

Requires one hand edit in `04-render.js`: the inline note loop calls `ntSym`/`ntVisible`,
with the original markup kept inline as a fallback if the module is absent.

### `tools/phone-relay-server.js` — v2

Three features merged from three threads:

- **`/whoami`** — a `file://` page cannot discover its own LAN address, so it asks the relay.
  CORS wide open because `file://` sends a null Origin; LAN-only, holds nothing secret.
  Answers **per client**: matches the caller's IP against each interface's netmask and
  returns the address on *that* subnet. The planner probes over loopback, so
  `subnetMatched:false` with `youLoopback:true` is normal, not a fault.
- **Role-aware routing** — a message reaches only clients of a *different* role, so two
  phones or a stale planner tab can't feed each other. Clients that never say hello have no
  role and receive everything, which keeps legacy senders working.
- **Interface ranking** — wireless first, then everything else, virtual adapters
  (VirtualBox / VMware / Hyper-V / vEthernet / WSL / Docker / Tailscale) dead last. Override
  with `RELAY_IFACE=<substring>`. The dev machine is dual-homed on purpose (Ethernet for the
  house LAN, WiFi dongle for the phone link) and the WiFi side is the intended default.

`paths` advertises what the relay actually serves. `/cmd` and `/dl` are **not** served yet —
those targets refuse to encode rather than minting a code that scans fine and 404s on site.

---

## Two bugs worth remembering (both silent, both shared-scope)

1. **Duplicated `PLANNER_CAM` block.** The whole block was pasted twice; the second, older
   copy won, so the object had no `undo`/`redo`/`selectTool` even though the patch had been
   applied correctly to the first. `node --check` passed — redeclaring a `function` is legal
   JavaScript.
2. **`qrInject` name collision, caught before shipping.** A guard wrapper named `qrInject`
   in `10-lamps.js` would have hoisted last, and `05f`'s `window.qrInject = qrInject` would
   then have bound the name to the wrapper, which calls `window.qrInject`. Infinite recursion
   on every right-click. Renamed `qrMenu`; the note hook is `ntMenu` for the same reason.

**Standing check after any paste into `src/`:** every `window.X =` assignment and every
top-level declaration must appear exactly once across the built file. This is the class of
bug `node --check` cannot see.

---

## Open items (in rough priority order)

1. **Gyro still blocked by secure context.** `DeviceOrientationEvent` requires `https://`.
   The Opera GX `opera://flags` route ("Insecure origins treated as secure") was tried and is
   **dead**. Remaining options: self-signed cert, mkcert, Tailscale Funnel. **Parked** — the
   ESP32-S3 pendant sends clean WebSocket events with no browser sensor involved, which may
   remove the need entirely. Don't spend on the certificate until the pendant is tried.

2. **`mobile/phone-sender.html` is still the 1.0 page.** It works through the legacy control
   bridge. Rewriting it for 2.0-b is what unlocks the reactive tool pad, and is the trigger
   for deleting the bridge.

3. **`/cmd` and `/dl` relay endpoints — not built.** Land with 2.0-b. Both QR targets are
   registered and self-disabling until `paths` advertises them.

4. **"N" toggle in the main layer rail.** The note sub-layer works and is togglable from the
   list panel; adding it to `renderLayers` is one line in `11-controls.js` (append `'note'`
   to the `cats` array).

5. **`spec-20-backup.js` conversion — pending.** `tests/backup-smoke.js` (22/22, plain node)
   needs converting to match the runner's convention. Five standalone harnesses now sit
   outside `npm test` for the same reason: link-smoke, control-bridge-smoke, qr-net-smoke,
   qr-menu-smoke, notes-smoke. Worth one decision: do they join the runner, or stay separate
   because they stub the environment rather than boot it?

6. **`boardFor` identity link breaks across a JSON round trip.** In the 1.1 backlog.

7. **PortableGit won't start.** Every invocation at `C:\Planner_VRG\Planner\apps\git` dies
   with `BUG (fork bomb)`. Untried: `post-install.bat`; `git-cmd.exe`; AV exclusion;
   re-extract into a fresh empty folder. Snapshotting = zipping into `data/exports/`.

8. **localStorage rescue.** The new Opera GX profile starts with an empty project list.
   Import the Domoszló `.vplan.json`, then take a first `.vbundle.json` backup.

9. **Opera GX standalone launcher** — `launcher.exe` isn't at the expected path. Minor.

10. **Copy the tree to the pendrive** once git is sorted.

---

## Unconfirmed in a real browser

jsdom cannot exercise pointer capture, real layout, keyboard focus, printing, canvas export
or touch. These pass their logic tests but still need a human pass
(see `browser_verification_checklist.md`):

- v32 wall-view drag pointer-capture fix.
- Elevation editor step-5 keyboard / fullscreen / modal behaviour.
- Floor/ceiling plane editor pointer + keyboard behaviour.
- **QR: SVG/PNG download from `file://` in portable Opera GX** — the most likely first
  failure of the new work. Rendering a code and scanning one are different things; do both.
- **Note list drag-to-reorder** — native HTML5 DnD on the desktop, long-press fallback for
  touch. Neither path is reachable from jsdom.
- **Phone link round trip** — the relay window should print `= planner 2.0` and `= phone`.

Browser verification rounds 1–3 are otherwise complete.

---

## Next up — the 1.1 backlog

1.0 built the abstractions; 1.1 fills the catalogues and UI. Full detail in
`1_1_backlog.md`. Planned order:

**P1** (render toggle normal↔hivatalos) → **P3 + P4** (draw-time overlap ruleset +
dedicated-circuit runs) → **P2** (multi-select → Összerendezés, *sharing P3's Snap
implementation*) → **W1** (Rendezés for wall/floor devices) → **R1 + R3 + R4** (Rendezés
mind-map editor as a **fourth projection**, two-way highlight, Betáp rule) → **R2 + P5 + H2**
(the wire-occupancy layer) → **H1 + H3** (Súgó tool + table of contents).

Earlier queued batch, still open: wall materials + blueprint hatch patterns; the path
**PROFILE** system; arbitrary levels. Older small follow-ups: numeric offset/size entry for a
selected piece, snap-to-other-pieces (edge/face).

**Key design constraint carried into 1.1:** connectivity/occupancy must be first-class
(terminals / segments / runs / circuits alongside the drawn polylines). Backtrack is an
**occupancy** rule, not a geometry rule.

---

## Parked

- **Path auto router** — concept to workshop, not yet scoped. Auto-generate or suggest a
  cable path between two selected terminals instead of manual polyline drawing. Sits on top
  of the terminals/segments/runs connectivity model from the 1.1 batch (P3/R1 territory).
  `ngraph.path` scouted for it. Parking until that model exists to route on.
- Upload the concept for the **Viewer-only** version (customer/showcase: clicking a device
  shows where its cables run).
- The approach to a **read-only client view** without sharing source.

---

## Environment (as of 2026-08-30)

- Root: `C:\Planner_VRG\Planner` (VARLER root; stick copy comes later).
- Portable Node **v24.19.0**, VS Code, PortableGit (broken — see open items).
- Build: 24 modules. `npm test`: 828 assertions / 17 suites / 70 golden renders.
- Relay: ports **47291–47298** with auto-retry, `GYRO_PORT` as the single source of truth,
  `RELAY_IFACE` to pin an interface by name.
- Machine is dual-homed: Ethernet `192.168.0.x` (house LAN), WiFi dongle `192.168.1.x`
  (phone link, the intended default).
- Folder rule: built HTML → `src/` (numbered module); runs on the PC → `tools/`; runs on
  another device → `mobile/`; generated → `dist/` (never hand-edited); drawings/data →
  `data/` (outside the repo).
