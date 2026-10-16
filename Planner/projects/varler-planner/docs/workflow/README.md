# Workflow round (WF) — the P33 way of working, built into the Planner

*Build pack for the user's dev log of 2026-10-14: "take the quickened progress of P33 and weave it into the standard
workflow of blueprint creation". **Analysis only — nothing here is built.** Priority: **top, after the current
threads close** (Views V9b…, R1010 M2). Written against `planner-stack` head `87aa5ba` plus the uncommitted Views V8a/V9a
work in the same worktree; every anchor below was read in that tree.*

The draft ends with "(CONT:)" — **sections 4+ (the layers after Erősáram) are still to come from the user.** This pack
covers sections 1–3: Alapozás, Nyílászárók, Szabályok, Villamosság / Erősáram.

Read in this order: `00_CONTRACT.md` → this README (§2 the map, §3 the order) → the WP you build → `01_MATERIAL.md` only
for the sections the WP names. `WF-Q-001.json` holds the open decisions, each with a recommended default; a WP builds
the default unless §5 "Answers" says otherwise.

| File | What |
|---|---|
| `README.md` | this — how P33 was really made, the map, the order, checkpoints, status |
| `00_CONTRACT.md` | where / how to work, data additions, golden policy, report format |
| `01_MATERIAL.md` | paste-ready content: control model · room-type wheels · Standards table · door/portal slots · switch-type rule · circuit policy · rules palette |
| `WP-F1…F4`, `WP-O1…O2`, `WP-R1…R4`, `WP-E0…E5` | one small file per work package (16) |
| `WF-Q-001.json` | the decision pack (tuner format), 22 questions |
| `PROMPTS.md` | build-all / build-one / verify / resolve / status prompts |

---

## 1. How P33 was really made — and where it left the Planner's expected steps

The Planner's intended path (PRIMER, the BRIDGE Stack pack): draw walls with the 2-click axis-aligned Wall tool or the
rectangle "Helyiség létrehozása" dialog → Szerkezet → Jelölés → Hardver → BASE → Csatorna → place every endpoint **with
its height** → draw routes by hand (or ghost) → `05w` fill. What actually happened on P33 (2026-10-09 … 10-12):

| # | Expected step | What the user did on P33 | What did the work | Lesson for the workflow |
|---|---|---|---|---|
| 1 | Draw walls, then rooms | Geometry came in pre-made (test plan generator `tools/testplans/p33-teszt*.js`, remodel applied) | a script | Drawing a floor must be as fast as the generator was → **F1–F4** (room pen, Create Walls/Floors) |
| 2 | Doors as plain openings, portals later | Portals were marked **on the doors** (Jelölés opening tags `portal p0/p1/p2`, `bejarat`, `technikai`, `redony`) | 21 marks | The door already *is* the portal: its slots exist from placement → **O2** |
| 3 | Jelölés as notes | Marks used as **rules**: `wall/plus belso` ×3, `side/plus lforma` ×4, zones `agy`, `folyoso`, `folyoso+padlofutes = ban` | the engine read them | The colour-coded marks are the rules language → **R2, R3** |
| 4 | Channel = drawn route | 24 loose `gege` lines on the Csatorna layer meaning **"horizontal routing allowed on this wall"**, 6 off-wall lines meaning **"ceiling reach to a lamp"** | `geom.js` (±500 mm tolerance) | Draw only the horizontal intent by hand; nothing else → **R2** (routing walls), **E2** (ceiling reach) |
| 5 | Place devices with heights | 142 endpoints placed as **stickers** (no care for height) + 38 cluster points | `rules.js stdHeight()` set every height from context (bed, worktop, wet, window…) | Heights are a *standard*, not a per-device chore → **R4** |
| 6 | RBX / BASE as hardware | 3 RBX + BASE placed as **service points** (wall crossings), purpose written in `ref` | `plan.js` service-point tree | Junction points are where walls are crossed → **E3** |
| 7 | Circuits by hand in 05j | Circuits **suggested by policy** (bedroom separate, 1–2 socket circuits per large room, V1 day / V2 night lighting) and **approved as a table** | `plan.js` + Q-001/Q-002 packs | Suggest → tick → done → **E4** |
| 8 | Lamp↔switch by hand | `ctl` **inferred** (nearest door, wet-room lamps to the dry side, two-way pairs) and approved as a table | `plan.js` switchGroups | Link lamps → switches; switch type follows from the links → **E1** |
| 9 | Routes drawn / 05w fill | Trunk 2600 (one tree from the Elosztó), distribution 2450, 2-gang box at every drop/corner/end, ≤ 3 cables per pipe, pipe sizing | `network.js` + `plan.js` (1 267 lines, Node, outside the Planner) | The engine must run **inside** the Planner, behind two buttons → **E5** |
| 10 | Output = drawing | Output = vplan + approval tables + sheets + takeoff → pricing kit | `emit*.js`, `takeoff.js` | Keep: every automatic step ends in a reviewable table (contract §4) |

**The one-line reading:** the user drew *intent* (rooms, doors, allowed walls, stickers) and the machine did *the
derivable* (heights, boxes, circuits, wiring) — with every automatic result shown as a table to approve. The Planner's
mechanics stay; the WF round adds (a) faster foundation tools, (b) a rules step, (c) the P33 engine behind buttons, and
(d) **a workflow bar** — an overlay that walks the four phases and switches the existing tools for you (**E0**).

**Overlay vs code change** (the user asked me to decide): overlay = the phase bar, the rules palette, the wheel, the
Standards table (they drive existing tools and data). Code change = the room pen + Create Walls (the wall model), door
slots (06a), lamp groups (10-lamps), and the engine port (E5).

---

## 2. The draft, item by item → work package

| Draft § | The user's item (short) | WP | Size | Notes |
|---|---|---|---|---|
| 1.1 | Room pen: click nodes, 45° lock, 100 mm ticks, close on first node → room with Kerület / Terület; drag-box select | **F1** | M | the Floor tool already does point-by-point + live area — extend it |
| 1.1 | Nodes on another room's line = shared wall; drag shared lines (Sims); split a room with two new nodes | **F2** | M | shared edges derived from geometry, not stored |
| 1.1 | Lines = wall centrelines, but users measure inner-to-inner; "Create Walls", 20/30 cm symmetric, 90° joints define inner corners | **F3** | L | ⚑ Q-F01 (inner vs centre), Q-F02 (45° walls) |
| 1.1 | "Create Floors" fills inside the walls; slight room-type tint, toggle | **F4** | S | |
| 2.1 | Doors / windows as own feature; ←/→ type with ghost, ↑/↓ the four opening sides | **O1** | S | door `variant` 0–3 already = the four sides |
| 2.2–2.3 | Door = portal from placement: latch side 230 V, hinge side LV, middle; window side slot for redőny feed (dormant until the room has redőny) | **O2** | M | slots from `PORTAL_SLOTS` (rules.js) |
| R | Room type: LMB on a room → 8-sector wheel (7 types + South = more), multi-type toggle; RMB = advanced room settings | **R1** | M | mouse port of the gamepad wheel |
| R | New tool: walls allowed for routing — LMB whole wall (both sides), hold-drag = part | **R2** | M | **the key feature** |
| R | Granular colour-coded wall rules (the P33 marks), half-side by default; Floor rules = placeholder | **R3** | S | palette over 05n marks |
| R | STANDARDS: every device / path standard height, variants (garázs dugalj 500, fürdő 1400…), project / room / selected | **R4** | M | ⚑ Q-R04 (one device + variants) — candidates in MATERIAL §3 |
| 3.1 | Electronics starts → first electrical layer Erősáram (dugalj vs kapcsoló+lámpa) | **E0** | S | + the workflow bar; M1 split already built |
| 3.1 | Lamps ↔ switches: switches untyped, lamp(s) → portal slot(s) or custom spots; group lamps first | **E1** | M | switch type derived (MATERIAL §5) |
| 3.1 | Button → Rules tool variant: draw ceiling lines from a wall/portal to the lamps; above the álmennyezet if set | **E2** | S | |
| 3.2 | Elosztó, portal boxes, pre-RBX kötődoboz (10×10 / 15×10 min) = wall crossings + meeting points; "Kötődoboz ehhez a kapcsoláshoz" | **E3** | M | |
| 3.2 | Click the Elosztó → suggested circuits list, tick, add more | **E4** | M | builds on R1010 **M2** (circuit presets) |
| 3.2 | Finish Erősáram: button 1 wireways, button 2 wiring (device / room / house); redőny control moves to another layer | **E5** | L | the baseline engine inside the Planner ⚑ Q-E05 |
| 4+ | "(CONT:)" — the second layer onward | — | — | waits for the user's next part |

### Build order

```
Wave F  F1 PEN → F2 SHARED → F3 WALLS ⏸ → F4 FLOORS          (foundation; F3 is the only golden mover)
Wave O  O1 OPENING-KEYS → O2 DOOR-SLOTS
Wave R  R1 WHEEL → R2 ROUTING-WALLS → R3 PALETTE → R4 STANDARDS ⏸
Wave E  E0 BAR → E1 LINKS → E2 CEILING → E3 BOXES → E4 CIRCUITS (needs M2) → E5 ENGINE ⏸ P33
```

F before O (openings sit on walls F3 makes). R2 before E2 (E2 is R2's ceiling variant). R4 before E5 (the engine reads
heights from the Standards table instead of `rules.js`). E0 can be built any time after R1 — it only switches tools.

### ⏸ Checkpoints

| Before / after | Show | Why |
|---|---|---|
| **F3** before build | the inner-size rule on a 2-room sketch: what you typed vs what the walls give, both Q-F01 options | the single biggest look-and-feel decision of the round |
| **R4** after build | the Standards table filled from MATERIAL §3, every ⚑ row listed | heights are the user's trade knowledge, not mine |
| **E5** after build | P33 redrawn with F–E tools → engine in the Planner → diff against `Calculator/P33-baseline/v1_2026-10-12` (16 circuits, 111 endpoints, trunk tree) | acceptance: same result as the offline engine |

---

## 3. Findings worth not re-deriving

- **Walls are axis-aligned boxes** (`WALLS[level]` = `{x0,y0,x1,y1}`, `wr()` 00-core.js:183, `wallInfo` 03-geometry.js:60).
  The Views grid painter, marks, wall editor and `deviceHostWall` all depend on it. A 45° wall is a model change, not a
  tool change → Q-F02.
- **A room is a named polygon in `data.floors`** (`createRoom` 03-geometry.js:352 pushes a floor + `rectWalls`);
  `allRooms(level)` (10-lamps.js:356) = `ROOMSB[level]` + `data.floors`. Room membership is derived (05h "never
  stored"). So the room pen can create the floor record at once (stage `outline`) and everything downstream works.
- **The Floor tool is already the Maps-style pen** (`floorDraft`, render 04-render.js:965, hint "pont után pont… élő
  Terület/Kerület", close on the first point, Backspace undo). F1 extends it; it does not start from zero.
- **Door `variant` bits** (04-render.js:238): bit1 = hinge at the far jamb, bit0 = which side it opens to → 4 values =
  the user's "four possible opening sides". **Portals already exist** as `type:'portal'` devices bound to a door
  (`ptOf(doorId,face)`, `ptAuto`, `ptDoorGeo` in 06a-portals.js); O2 adds the slots, not the portal.
- **Room kinds**: `NEED_KINDS` (05t-needs.js:18, 13 kinds, regex on name) and a single `rm.kind` override. Multi-type
  needs `rm.kinds[]` (R1).
- **The gamepad wheel** (08b-gamepad.js:214–372) is the radial the user means: 8 sectors, sector 0 up, clockwise, rings
  with sub-rings, drawn into `#gpWheel`. It lives inside the GP closure → R1 lifts the drawing into a shared helper.
- **Marks** (05n-marks.js): polarity `plus/minus/ban/none` (green / orange / red / grey) = the colour code; kinds
  wall/side/vstrip/hstrip/hband/opening/zone. P33 used `opening` tags on doors, `wall`/`side` plus, `zone` for bed and
  corridor. R2/R3 add tags, not a new store.
- **Two auto-fill engines exist**: the Planner's `05w-fill` (stack E3/E4) and the offline `tools/baseline` (P33,
  1 267 lines CommonJS, no DOM). E5 bundles the latter via build.js (Q-E05).
- **Heights live in code** (`stdHeight()` tools/baseline/rules.js:12 and `EP_CAT[].h` 05s-endpoints.js). R4 turns them
  into one data table both read.
- **Conflicts to settle** (in the decision pack): fürdő dugalj 1400 (draft) vs 1100 (rules.js ⚑ 701); one lighting
  "string" circuit (WORKSHOP-001) vs V1 day / V2 night (P33 decision); switch 1100 vs the user's old 1300.

---

## 4. Status

| WP | Status | Spec | Note |
|---|---|---|---|
| F1 F2 | **built 2026-10-14** (uncommitted) | spec-82 (31) | `src/08c-wf-pen.js`; pen, rectangle, snapping, Sims drag + clamp, split; browser-checked with real mouse |
| F3 F4 | **built 2026-10-14** (uncommitted) | spec-83 (37) | `src/08d-wf-walls.js`; rigid shift (sizes kept) + step report, exact joints, re-run, tint; ⏸ = look at the result (Q-F01 was answered A) |
| O1 | **built 2026-10-14** (uncommitted) | spec-84 (17) | `src/08e-wf-openings.js`; Ajtó / Ablak buttons, ←/→ type (DOORTYPE + new OPN_WINTYPE: 5 window types with size + sill), ↑/↓ side 0→1→3→2; two one-token hooks in 08-interaction (ghost + placement); browser-checked |
| O2 | **built 2026-10-14** (uncommitted) | spec-86 (15) | `src/08g-wf-slots.js`; PT_SLOTS = engine table (spec-checked), ptSlots / ptWinSlot / ptSlotAt, auto-portal SF-0 on both faces in the door's undo step, faint slot dots by the active layer's families. **Finding:** 06a's PT_OFF is 200 mm, the engine's slots 150 — slots use 150 |
| R1 | **built 2026-10-14** (uncommitted) | spec-85 (27) | `src/08f-wf-wheel.js`; pen click inside a room → wheel, toggle multi-type, auto name, tint follows; 3 new explicit-only kinds. **Deviations:** the wheel drawing is a copy of the gamepad's (08b untouched, not lifted); the Select-mode trigger is not built — Alt+click there already cycles overlapping items → Q-R10 |
| R2 | **built 2026-10-14** (uncommitted) | spec-87 (21) | `src/08h-wf-routewalls.js`; 🟩 button, click = whole wall, drag = span, Shift+box; `rwlAllowed` / `rwlCovers`; Create Walls re-run now keeps wall ids so the marks survive. Not yet: the P33 sketch-line converter test (WP test 4) — belongs with E5 |
| R3 | **built 2026-10-14** (uncommitted) | spec-88 (28) | `src/08i-wf-rules.js`; 📐 Szabályok panel: Fal · Nyílászáró · Egyéb területek · Padló (placeholder), 20 one-click presets writing plain Jelölés marks; face click = one face, drag = part of it, second click removes; Vezethető fal hands over to R2; live counts. Reused tags: munkalap → `pult`, fűtőtest → `radiator`, vizes → `vizes`; new: kerulendo, tilos, gaz, sziget, strang. Browser-checked |
| R4 | **built 2026-10-14** (uncommitted) — ⏸ answered: 1B 2A 3A 4A, elszívó dugalj 1900 | spec-89 (31) | `src/08j-wf-standards.js` + `src/11c-wf-keys.js`; 📏 Szabványok panel: 49 rows (devices, appliance sockets, paths, boxes, levels), scope Projekt / Helyiségtípus / Ez a helyiség, ＋ places the row as its own item (`d.hVar`, R04 B; `d.var` stays electrical), suggestions + Csere, Alkalmaz (only item devices, hand-moved ones stay via `hStd`). **Golden:** the 6 `/session` captures re-baselined (+16 chars each = `"stdHeights":[]` in the saved document); all 64 drawings identical. Not done: the P33 equivalence test vs rules.js (needs p33.config contexts → E5) |
| E0 | **built 2026-10-14** (uncommitted) | spec-90 (20) | `src/08k-wf-bar.js`; 🧭 bar over the canvas: 1 Alapozás › 2 Nyílászárók › 3 Szabályok › 4 Villamosság, each with its tools + a live check; Villamosság creates a BRIDGE stack adopting the rooms' layer (nothing copied) and activates Erősáram · Dugaljak; Lámpák + kapcsolók / Dedikált switch layers; 4.2–4.5 greyed; sits right of the mode hint; browser-checked |
| E1 | **built 2026-10-14** (uncommitted) | spec-91 (29) | `src/08l-wf-switches.js`; Kapcsolások tool (click lamps → C = one leg → click a door L1 slot / a switch / Alt + wall: the switch is created there), type from the links on the existing `swType`, slot switches follow their door, ✨ Kapcsolások javaslata (one leg per room → every room door's L1; wet room → dry face), lsw.none check; bar 4.2 live. **Fixed on the way:** the Planner's SWITCH_TYPES had the Hungarian codes wrong (103 csillár / 105 váltó…) — now 105 csillár · 106 váltó · 107 kereszt · 108 dupla váltó, with a do-not-change note and a one-time migration of saved keys (`swNumMigrate`, `swNum:2`) |
| E2 | **built 2026-10-14** (uncommitted) | spec-92 (29) | `src/08m-wf-ceiling.js`; **+ ▭ Padló út** (user, same mechanics: to any endpoint that is not a ceiling lamp, h 0, refused across a Padlófűtés zone; brown, ceiling blue; `flineFor`); 〰 Mennyezeti út: start on a Vezethető fal point / door MAINS slot / box / switch, bends (45°), finish on a ceiling lamp; one line per lamp (replace = one undo step); height = the room ceiling, void:true above an álmennyezet; cln.none check; `clineFor(lamp)` for E5. **Deviation:** click-click like the room pen instead of press-drag |
| E3 | **built 2026-10-14** (uncommitted) | spec-93 (25) | `src/08n-wf-boxes.js`; Szobadoboz (d.jb szoba, 2150; jobs feed / crossing / switching → 150 or 200, sizeFix), Kötődoboz (100), Elosztó (board); `jbServicePoints` (Elosztó + portal boxes + szobadobozok + RBX/BASE), `jbMeet` (chosen → szobadoboz → switch's portal box; sockets = classic chain), ⊙ Kötődoboz ehhez a kapcsoláshoz (⌀80 on the leg's ceiling line, pins the leg), jb.none check; bar 4.3 live. **Deviation:** the portal box is DERIVED (L4 of a door face with an Erősáram device in a slot) — E5 materialises it with the wiring |
| E4 | **built** 2026-10-15 | spec-97 | 08oa-wf-eloplan.js — click the Elosztó (Villamosság) → the table → Alkalmaz |
| E5 | **built 2026-10-15** (uncommitted) — P33 acceptance A passed (167/167 legs, 97/97 boxes; E5_ENGINE_REVIEW §9), B (redraw) open | spec-98 (39) | engine fixes in `tools/baseline` (E5_ENGINE_REVIEW §6–7, Q1–Q11); bundled by `build.js` into `src/08ob-wf-engine.js` (`BL`, `blInput`, `blRun`); ⚙ Pályák kiszámítása + 🧵 Vezetékek (Eszköz / Helyiség / Ház) in phase 5; gen:'bl' paths + boxes; checks table. Bundle = CLI on P33 exactly. Next: E5-Q12, then WP-E6 Alosztó |
| E6 | **built 2026-10-15/16** (uncommitted) — answered Q1 A+C (suggestion), Q3 own (feeder RCDs, one main switch), Q4 B (chained) | spec-99 (38) | `src/08oc-wf-alloszto.js`: a board on another level = Alosztó (AL1…) + its feed point below (DED alelo) + the 3C 25A / NYM-J 5×6 feeder circuit, one undo; per-level circuit suggestions; Alosztó cabinet (own main switch, SPD T2); engine per level from the Alosztó (feed leg through the slab), the feeder ΔU added upstairs; kivitel szekrény / DIN-sínes RBX. WP-E6_alloszto.md |

### Session log — 2026-10-14 build (one hour, the user's request)

Built F1 F2 F3 F4 O1 O2 R1 R2 in new modules `08c…08h` (hooks only: STK_TOOLS / STK_SCENE / STK_OVERLAY); shared-file edits
are small guards — `04-render.js` / `06e-view-plan.js` skip `stage:'outline'` floors (4 sites), `08-interaction.js` two
`opnPickOf` hooks, `shell.html` 6 buttons. Specs 82–87 (143 assertions). Full suite green, golden 70/70 identical.
Browser-checked with the real mouse in the pane: pen + rectangle, Sims drag, Create Walls dialog + walls + tinted floors on
a 4-room flat, door keys + placement, the wheel, routing walls. **Design change found while building:** F3's expansion
is a rigid shift per room, not a grid-line expansion (MATERIAL §8). Next in order: R3 → R4 ⏸ → E0 …

## 5. Answers

**r1, answered by the user 2026-10-14** — all recommended (A) except:

- **R04 = B** ("not sure, go with B"): **separate catalogue items** — `Dugalj · garázs · 500` is its own entry in the
  device list. The Standards table still holds every item's height (edit once, every placed item of that kind follows
  unless `hFix`). Auto-pick from context becomes a *suggestion check* (`'<ref>: garázsban — Dugalj · garázs (500)?'`),
  not a silent change. WP-R4 updated.
- **R05** — "above pult height" = the worktop socket **1100**. *Below* the worktop are **appliance sockets**
  (kitchen / bathroom / laundry) for a designated device or one dedicated device (hűtő, mosogatógép, mosógép, szárító,
  sütő…) — their own items, MATERIAL §3b.
- **R06** — **1400 = borotválkozó dugalj** (mirror / sink adjacent). Other bathroom sockets keep 1100 ⚑ (MATERIAL §3).
- **R07 = A +** the **non-electrical areas** as rules too (wet walls, pipes, heating, gas, chimney, furniture runs) —
  MATERIAL §7b, built in R3.
- **E06 = own answer — the "szobadoboz" (pre-evolution RBX)**: bigger than a 10×10 box, smaller than an RBX. It does
  wall crossing (faláttörés), room feed (szoba betáplálás) and lamp ↔ switch interconnection — **not** socket circuit
  distribution. With room socket circuits + V1 (or V1+V2) lighting in place, sockets chain **Elosztó → first room socket
  → … → last room socket** (single-layer classic, non-BRIDGE). WP-E3 / E5 updated; size → Q-E08.

New questions opened by the answers (r1, recommended default built if unanswered): **Q-E08** szobadoboz size and name,
**Q-R09** the generic bathroom socket height. Opened by the build: **Q-R10** the wheel in the Select tool (Alt is taken).

**r2 (2026-10-14):** Q-E08 = **C** — the szobadoboz comes in two sizes: 150×150 when it does one function, 200×200 when it
does several (crossing + feed + switching); E3 picks by function count, the user can override. Q-R09 = **A** — other bathroom
sockets 1100. Q-R10 = **A** — in Select, a double-click on a room's empty floor opens the type wheel (built, spec-85).
- 2026-10-15 (user review of the first test):
  - **O2 Q-O02 withdrawn:** a new door gets no portal devices and the slot dots are gone. The slots stay derived, and
    a wall endpoint within 300 mm of a slot that takes its code snaps into it (08g `ptSlotSnap`).
  - **R3 colour coding** per the user (05n `MRK_STYLE`); Belső fal became Külső fal.
  - **WP-R5 Jelölő toll** (marker pen on a wall-line network) is planned; the R5-Q decisions are open.
  - Mennyezeti út / Padló út moved to phase 3.
- 2026-10-15: **R5 built** (all A). The marker pen replaces the R2 / R3 click tools for wall, face and route inks. spec-96.
  Full suite: 90 suites, 3164 checks, golden 70/70.
- 2026-10-15: **E4 built** (Q-E04 = A). The Elosztó suggests circuits from the unassigned endpoints, and the user ticks
  them in a table. Full suite: 91 suites, 3183 checks, golden 70/70.
