# Round 2026-10-18 — Födém · Igénylista · Házimozi

Build pack for the user's 2026-10-18 draft (three features). **Analysis only — nothing is built yet.**
Answers recorded in `DECISIONS.md` (2026-10-18); only C3 is open — it blocks C2 step 3, nothing else.

Sources (copied into `src/`): `home-cinema-part1-architectural-base.md` = **the authority** for every cinema
number; `planner-integration-notes-SECONDARY.md` = leads only (written against 2026-08/09 docs, never checked
against code — its `studio` render mode and `data.zones` are out of scope here except where WP-C4 reuses the
zone idea).

## What already exists (checked in `src/` on main, c421d4e)

| Need in the draft | What the Planner has today | Consequence |
|---|---|---|
| Födém (3D slab) | No slab thickness at all. `LH[l]` is both the wall height and the level step (`floorRealZ`), so the ceiling of a level IS the floor of the next. `data.floors[]` draw as flat polygons at `fz + fl.z` (04-render.js:106). Ref buildings have `slabs` (flat). | New: `fl.slab` + a global `SLAB_T`. Answered S1 B: `LH` = inner height, the slab is added between levels. |
| Paths between levels | Path nodes carry `h` (mm above the level's floor); a path belongs to one level. Engine has `cfg.subFeed` (`slab:300`) for the Alosztó riser; Jelölés has a `felszallo` mark kind. | WP-S3: a node may sit on the slab underside (`h = −t` from the upper level = lower ceiling) and snaps to the lower level. |
| Room checklist | **05t-needs.js already is one**: per room × per stack role, a set of ticked endpoint codes, defaults from room kind (`NEED_DEFAULTS`), derived ticks from Jelölés, status ki/nincs/hiányos/kész, `☑ Helyiség igényei…` in the room menu, overview table. Ticks only — **no counts**, only inside a BRIDGE stack, no house-wide list. | Extend, don't duplicate: a new `need` role (layer *Igények*, after *Jelölés*) that owns **counted** items; 05t's status logic reads counts instead of booleans. |
| Lamps on switching circuits | WF E1 (08l-wf-switches.js): lamp legs `d.grp`, `sw.ctl` links, switch type derived (100…108). | The checklist's "n lámpa / k kapcsolási kör" is the *intent* that E1 later fulfils — the same words, and E1 can read it. |
| Home cinema endpoints | 05s catalogue has `SPK`, `SCR`, `AVP` on `sys:MEDIA`; `DED` on `sys:DED` (star from the board). | Cinema nodes = new codes on a new role `sys:CINEMA` (catalogue in WP-C2). |
| 30 % "ideal place" markers | 06b-clusters.js *ideal spots*: dashed ghosts, right-click → becomes a device, ✦ toggle per layer. | Reuse it — cinema suggestions are ideal spots of the cinema layer. |
| Sub-layers | 05l: sixteen categories per layer (device / path / mark…), per-category opacity, swap/move. | The cinema "sublayer" = the cinema layer's own path / cable / mark categories. No new mechanism. |
| Kijelölés rules for floor / ceiling nodes | 08h *Vezethető fal* (`rwlAllowed`), Padló út, Mennyezeti út (`cross:true`). | Cinema routing reads the same marks, plus its own *cinema walls* (WP-C5). |
| Separate routing per system | Engine (08ob) runs Erősáram; Adat/PoE is a separate family (`fam:'DATA'`). | `sys:CINEMA` gets `fam:'CINEMA'` → own conduits, own fill; mains of the dedicated circuit stays `MAINS`. |

## Phases (dependency order)

| Wave | WP | Content | Checkpoint |
|---|---|---|---|
| 1 | **S1** | Födém data + RCO + Floors tabs (on/off, thickness, per level default) | |
| 1 | **S2** | Födém render: 3D slab prism under the floor, all styles; level step = LH (belmagasság) + t (S1 B) | ⏸ look on P33 |
| 1 | **S3** | Path nodes through the slab: lower-ceiling spot = lowest point of the upper level | ⏸ feel |
| 2 | **N1** | *Igények* layer (role `need`) after Jelölés; room lists (`rm.req`) + Ház összesítő = sum of rooms (N3 B) | |
| 2 | **N2** | Erősáram catalogue of request items + room-kind suggestions | ⏸ list review |
| 2 | **N3** | RCO *Igénylista…* dialog with counts (dugalj n · lámpa n / k kapcsolási kör / v világítási kör · kapcsoló n × típus) | |
| 2 | **N4** | Status: 05t `needStatus` reads counts; E1 / Standards read the request as defaults | |
| 3 | **C1** | `sys:CINEMA` role + standalone cinema layer (works with or without a BRIDGE stack) | |
| 3 | **C2** | Activation wizard: room → screen line (wall + x_scr) → zone (C3) → "javaslat?" | |
| 3 | **C3** | Calculator (guide §3, Set A + sweep §3.10) as pure functions, tests from the worked example | |
| 3 | **C4** | Suggestions = 30 % drawing-only overlay; RCO turns them into ideal spots (C5) | ⏸ look |
| 3 | **C5** | Node checklist → tool auto-switch → place → *Kész* | |
| 3 | **C6** | Cinema walls (inner + outer face), route to Elosztó, dedicated circuit(s) on `sys:DED` | ⏸ P33/NV4 room |
| 3 | **C7** | Node-to-node wiring list + own family in fill / engine / cabinet | |
| — | **X** | `40_INTEGRATION.md` — how other layers join the Igénylista later (suggestions only) | |

Waves are independent of each other except: C6 needs S-nothing but uses N's house list if present; N4 touches 05t
which C1 also touches (`NEED_DEFAULTS`) — build N before C or merge carefully.

## Files of the pack

- `DECISIONS.md` — 18 questions, A recommended.
- `10_FODEM.md` — WP-S1…S3.
- `20_IGENYLISTA.md` — WP-N1…N4 + the Erősáram item catalogue.
- `30_MOZI.md` — WP-C1…C7 + cinema node catalogue + test vectors.
- `40_INTEGRATION.md` — suggestions for the other layers.

## Conventions (same as every round)

Single global scope (grep new names against `dist/varler_planner.html`, `tools/check-globals.js`); new modules
`08p-slab.js` (prefix `slb`), `08q-req.js` (prefix `req`), `08r-cinema.js` + `08ra-cinema-calc.js` (prefix `cin`);
ids from `data.seq`; one undo step per user action; HU UI strings; src is LF; worktree tests need `NODE_PATH`;
golden 70/70 must stay identical except S2 if Q-S1 = A moves wall heights (it should not — see Q-S1).

## Status

| WP | State | Notes |
|---|---|---|
| S1 | **built 2026-10-18** (uncommitted) | `SLABS` / `slbT` / `slbStep` in 00-core (floorRealZ / floorDispZ add the slab); `src/08p-slab.js`; save/load only writes `SLABS` when one is on; undo opts in with `pushUndo(['__slabs'])`; Szintek row *Födém a(z) … alatt* (active level), ▬ Födém tool in Alapozás (dialog for all levels), room RCO items. Default for new documents = **off** (an on-by-default would move every old file and golden capture) — turn on with *Födém minden szintre*. |
| S2 | **built** (3D side faces only) | union of floors + walls on a cell grid, merged outline edges, holes = `fl.slab:false`; the client preview uses the real slab when one is on. ⏸ look on P33 done in the browser (ground + a cloned upper level). Leftovers built the same day: wall elevation = hatched band *Födém 300 mm* above a full-height wall (capped at 40 px); Alaprajz = a hole in the own floor drawn as outline + void cross, a hole in the slab above as dashed outline + dashed cross, drawn over the walls (a room-sized hole hides its outline in the wall faces); Mennyezet caption names the upper slab. |
| S3 | **built** | pseudo guide *Födém alja (alsó mennyezet)* = −t in the height list / drawing-height select (never stored in GUIDES); free height reaches −t; `slbThru()` pairs nodes of adjacent levels at the same world point; validators `slb.thru` (info, no felszálló strip nearby) and `slb.deep` (error, below the slab). The lower room's Mennyezet plane shows the upper level's through-slab nodes ("Emelet ⇣" = reaches this ceiling, "Emelet −120" = stops inside the slab; display only). Not yet: the 05v graph joining the pair. |

| N1 | **built 2026-10-18** (uncommitted) | `src/08q-req.js`: role `need` (*Igények*) right after Jelölés, `opt:true` (a new stack does not get it — `req.layer` action / Jelölés layer menu adds it), plain `{req:true}` layer without a stack; data `rm.req = {v:1, items}`; `reqSet` (clamps, one undo step), `reqTake` (keep), `reqClear`, `reqHouseSum()` (N3 B). Info text in 13-role-info. |
| N2 | **built, reviewed 2026-10-18** (R1 B: Háló = one 106 + 107 + 106 string door → both bed sides; option per bedside: dugalj + 101 + olvasólámpa = item `read`; R2–R5 = A; **R6 open** for the next housekeeping) | `REQ_ITEMS` (6 Erősáram items), `REQ_SUGGEST` per room kind, `reqSwAuto`, `reqSuggest`. Table + R1–R6 in `N2_REVIEW.md`. |
| N3 | **built** | room RCO *☑ Igénylista… (darabszámok)*: one row per item, javaslat hints, lamp row n / **kapcsolási kör** / világítási kör + optional Párosítás, switch rows by type (+ sor / ✕), Javaslat átvétele / a hiányzókra / Lista törlése, kell / van table; the 05t tick dialog is renamed *Rétegenkénti igények (pipák)* and linked from it. |
| N4 | **built** | `reqTotals` / `reqHave` (devices standing in the room, any layer; kör = distinct lamp `grp`) / `reqStatus` (hiányos / kész; kör + types are soft rows); 05t `needOf` reads the counts when a room has a list; *Ház összesítő* (`req.house`). Not yet: E1 starting from k, E4 reading the pairing. |
| C1 | **built 2026-10-18** (uncommitted) | `src/08r-cinema.js`: role `sys:CINEMA` after Média és hang, `off:true`; *Házimozi réteg* action (stack layer after Média és hang, or a plain layer); 8 node codes CLR CSR CBK CSW CPJ CSC CTV CRK in EP_CAT (cables on MEDIA until C7 brings the CINEMA family). |
| C2 | **built** | room pick → drag the screen line (snaps to the nearest parallel wall, x_scr live in the HUD, 50 mm) → setup dialog: x_scr, the zone L / W / offset (C3 D, starts as A), *Javasoljunk elhelyezést?*, 5.1 / 7.1, projektor / TV, szemmagasság, látószög. Room RCO *Házimozi ebben a helyiségben…*. |
| C3 | **built** | `src/08ra-cinema-calc.js` `cinCalc` (Set A, §3.1–3.10, metres); reproduces the guide's worked example. Sets B–E not yet. |
| C4 | **built, ⏸ look** | overlay: zone, screen line, beam keep-out (red 12 %), track-light bands (green 12 %), markers at 30 % (L C R Ls Rs Lb Rb SW1 SW2 PJ AV, MLP ring); *Mozi ellenőrzés* (§3.10 + 12 doors/windows); RCO *Javasolt helyek létrehozása* → 06b ideal spots. Frame: t = the viewer's left. |
| C4 look | **approved 2026-10-18** (LC1–LC4 = A) | |
| C5 | **built** | floating *Mozi elemek* list (bottom right of the stage, while the cinema layer is active): one row per node with placed / needed; a row starts the device tool for that code; the ghost snaps to its suggestion within 700 mm (Alt: free); *Kész → falak*. New code CKP (Mozi kezelő, Cat6A). |
| C6 | **built, ⏸ feel** | *Mozi fal* ink on the marker pen (per FACE — inner and outer side, purple, no per-piece label); router over the face net: marked faces (+ general Vezethető fal after one confirm, C7 B+A), straight through a wall STACK (P33's 3-layer walls, ≤ 700 mm solid), around wall end caps; wall devices / board must sit ≤ 600 mm from a marked face, ceiling / floor nodes join anywhere. *Útvonal + kör*: AV-1 rack B16 · AV-2 C16 · AV-3 projector B16 (default from §7.2), DED endpoints tagged phaseGroup / rcd AV; rack → Elosztó feed + every node → rack as paths on the cinema layer (re-run replaces, one undo). 05t: a cinema room asks for DED. P33 Nappali → Előszoba Elosztó: 10 paths, 61 m, 0 missing. Not yet: the 05x cabinet honouring the AV group (C7). |
| C7 | **built 2026-10-18** (uncommitted) | `src/08rb-cinema-wire.js`: *🎬 Kábellista…* (layer menu, action `cinema.wiring`): one row per node — speakers share one section by §6.1 (A ≥ 0.712·l/Z_min, longest run, Z_min 4 / 8 Ω), LFE coax ≥ M25, projector AOC + Cat6A + spare in Ø40 (§5.1), screen trigger 2×0.75 + Cat6A, keypad Cat6A; the 230 V in its OWN pipe (AV-1/2/3 per §7.2/§7.4); the rack feed = n × NYM-J 3×2,5. Signal conduits by the guide's §5.2 fill (53 / 31 / 40 %). Family **CINEMA** (05w AFILL_FAMS, cls sig); the pipes go into the cinema paths' `sec.cont` (src `cin:<layer>`) and `data.runs` stage `cinema` — written by *Útvonal + kör* in the same undo step, *Csövekbe írás* re-applies. §5.5 separation: info note when a signal run is parallel (≤ 10°, ≥ 0.5 m) to an Erősáram path closer than 300 mm (screened only: 150). LFE lengths differing > 1 m → info. Cabinet (05x): AV ways = own group *AV körök*, one phase (balanced as one load), RCD mode → own RCD, RCBO mode → RCBO per way + the §7.2 note; the DED check accepts the cinema feed. Engine (08ob): the AV DEDs are left out with a note (the cinema routes them). Also fixed: 05x `eloLoadKw` — the AVP line was inside a comment (AVP counted 2.0 kW instead of 0.5). |

Tests: `tests/spec-105-cinema-wire.js` (30); `tests/spec-104-cinema.js` (45); `tests/spec-103-req.js` (45); `tests/spec-102-slab.js` (38); full suite 99 suites / 3464 checks green, golden 70/70 unchanged.
