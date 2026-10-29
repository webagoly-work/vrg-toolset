# Money-path audit — sketch → wireways → quantities → price (2026-10-28)

*Read-only audit of `main` at `fe0d23e`. Nothing in the repo was changed except this file. Scope: the path from a Planner
sketch to a client price, including the wireway / wiring / conduit routing that produces the cable and pipe metres
(`tools/baseline` + the Planner glue `src/08h`, `08n`, `08ob`–`08oh`, `08rb`), the CLI takeoff and the Planner's own
Anyag- és árkimutatás (`src/05-totals.js` `computeBOM`).*

**How it was run.** A cloud container with the repo only: no `H:\`, so no client fixtures, no `Calculator/CLA-baseline/`
(untracked), no Workflow Kit and no `offer.json`. `node_modules` was installed into a scratch folder outside the repo and
used through `NODE_PATH`, as GO-WIRE.md says. `dist/varler_planner.html` was used as committed; a scratch rebuild of `src/`
outside the repo is byte-identical to it, so the dist is current. Every finding below was reproduced on one of these:

- a synthetic plan: spec-100's two rooms, a door and a board, through the engine directly;
- spec-98's two-room Planner plan or spec-105's C6 cinema room, under jsdom;
- the practice apartment `tools/practice/Gyakorlo_lakas_villany.vplan.json`. It is in git and is not client data: 16
  circuits, about 77 m², so CLA-sized. Every wall of its ground floor was marked Vezethető, then ⚒ Pályák and 🧶 Vezetékek
  (Ház) were run.

Two scripts reproduce everything: Appendix A (engine) and Appendix B (Planner). Each line they print starts with the
finding id. Part C (the red team and the `build-dom.js` rebuild) could not run here: see §4.

`ALAPRETEG.md` / `ADATRETEG.md` live in the untracked `Calculator/CLA-baseline/` and were not readable. The engine's rules
were taken from `tools/baseline/README.md` and the code.

Money figures are net, at the v1 unit prices that `tools/baseline/cla.v2.js` lists (`MAT` / `LAB`):

| Item | Unit price |
|---|---|
| NYM-J 3×1,5 / 3×2,5 | 340 / 520 Ft/m |
| Conduit M20 / M25 / M32 / M40 | 170 / 250 / 260 / 480 Ft/m |
| Horizontal chase | 1 900 Ft/m |
| Laying conduit | 660 Ft/m |
| Pulling NYM | 180 Ft/m |
| 2-gang box + setting + pocket | 220 + 840 + 3 400 Ft |

Types with no v1 price are given in metres only.

---

## 0. Headline

1. **The engine's metres are now right where the T0 tests look; the Planner's BOM then garbles them.**
   - After 🧶 Vezetékek, the BOM has one row, `Vezeték undefined mm²`: 611,5 m. The engine has 331,6 m of six types
     (364,8 m with the 10 % waste). That is +68 %, with no cable type.
   - Conduit is one `gégecső` row with no size.
   - Every engine pipe is chased as Ø20 (32×30 mm).
   - The chase rows disappear when the path layer is hidden (MP-1, MP-2, MP-8).
2. **Cables computed outside the engine never reach the BOM.** These are the Házimozi runs and the BRIDGE fill runs
   (`data.runs`). A drawn path that carries two pipes counts once (MP-3).
3. **Some ban marks still carry a route** (MP-4). Each case reproduced:
   - a Padló út across a padlófűtés zone drawn after the line;
   - a ceiling ban zone (látszó beton);
   - any ban zone drawn as a circle.
4. **F9 is still open** (MP-5). A wall added inside a room without redrawing the room lets a run pass straight through it,
   with no crossing and no message.
5. **F2, F4, F5, F6 and the T0 gate are fixed and covered by tests.** F1 is fixed for every quantity. Its only leftover is
   the channel metres that `ALAPRETEG.md` §4 prints, which are still the search cost.
6. **None of MP-1 … MP-18 would be caught by today's nets.**
   - `node tests/run.js`: 110 suites, 3 736 checks, all green.
   - Golden renders: 70 / 70.
   - spec-98 parity: skipped without the CLA data, and the skip prints PASS.

## 1. Findings ranked by money at risk (CLA-sized job)

"Planner BOM" = `computeBOM` → the price table, `bom.json` / `bom.csv`. Whether that table prices a client job is Q1 in §8.
The ranking assumes it does; if not, MP-1, MP-2, MP-3, MP-6, MP-8 and MP-10 drop to "display only".

| # | Id | Finding | Trigger | At risk (practice flat / probe) |
|---|---|---|---|---|
| 1 | MP-1 | BOM cable row `Vezeték undefined mm²`: metres inflated, type lost | always, after 🧶 Vezetékek | +247 m (+68 %) of cable and pulling. Priced at one rate (340 or 520 Ft/m), the row is +79 000 to +189 000 Ft over the engine's 3×1,5 + 3×2,5 metres at their own rates (the other 47 m have no v1 price), plus ≈ 44 000 Ft of pulling |
| 2 | MP-2 | BOM chase rows depend on layer visibility; every engine pipe is chased as Ø20 | path layer hidden at export · always (widths) | 159 m of chase, ≈ 302 000 Ft of labour, gone when hidden; 64 m of M32 / M40 grooves sized 32×30 |
| 3 | MP-3 | `data.runs` cables (Házimozi, BRIDGE fill) never reach the BOM; a path with two pipes counts once | a Házimozi or a filled ARM / channel path | C6 room: 175 m of cable missing (incl. 61,5 m NYM-J 3×2,5, 28 m Cat6A); 30 m (−26 %) of conduit |
| 4 | MP-4 | Ban zones that still carry a route: a later padlófűtés zone, a ceiling ban, circle zones | a mark drawn after the line, on the ceiling, or as a circle | damage risk (drilling a heating loop, exposed concrete, a drain stack), not quantities |
| 5 | MP-5 | F9: a run passes through a wall added after the rooms were drawn | a partition added, rooms not redrawn | wrong metres (the real run goes round through a door) plus an undrawn wall crossing |
| 6 | MP-6 | A szobadoboz gets a second, engine-generated 2-gang box on the same spot; every junction size is one BOM row | any szobadoboz | +1 box per touched face (≈ 4 500 Ft each); 150 / 200 / 140 boxes at one rate |
| 7 | MP-7 | A drawn via path is counted on top of the engine's pipe; editing it, or moving a generated box, leaves the stale flag at 0 | any T6 via; any hand-moved engine box | +4,3 m on a 19,5 m probe (+22 %); a hand fix is lost on the next Pályák |
| 8 | MP-8 | BOM conduit is one row; the engine's M20 / M25 / M32 / M40 split is lost | always | −16 000 to +8 000 Ft on 303 m, depending on the rate typed in |
| 9 | MP-9 | Main feed meter → board is a straight line through rooms and walls | a meter not beside the board | probe: 9,6 m against ≈ 21,5 m along the walls (NYM-J 5×10) |
| 10 | MP-10 | BOM adds per-device drop allowances on top of the engine's own drop legs | always | +36 m of cable, ≈ 19 000 Ft including pulling |
| 11 | MP-11 | CLI: kind-106 switches without a switch group pair up in file order, across rooms | 106s not in `switchGroups` | +32 m NYM-J 4×1,5 per wrong pair, and a wrong two-way |
| 12 | MP-12 | F11: a csillár feeding two ceiling lamps gets NYM-J 3×1,5 risers | a `double` unit on ceiling lamps | not wireable as drawn (needs 4 cores to the first lamp) |
| 13 | MP-13 | F7: the box-overfill warning counts legs, not pipes | a trunk leg with several pipes ending in a box | box under-sized: 8 pipes into a 2-gang box, no warning |
| 14 | MP-14 | F11: the voltage-drop length adds every ceiling leg of the circuit | a lighting circuit over two rooms | conservative; it may suggest an unneeded 2,5 mm² (≈ 7 000 Ft per circuit) |
| 15 | MP-15 | Small metre errors: a drop's members up to 250 mm apart count 0; a drawn chained ceiling leg gets a phantom 400 mm rise; a ceiling hop on an Alosztó feeder loses its rise | as named | ≤ 0,25 m, +0,4 m, −0,55 m per case |
| 16 | MP-16 | Silent no-ops: `cla.config` ids that match nothing; a circuit's 4 / 6 mm² becomes NYM-J 3×2,5 | a re-drawn sketch; `c.mm2` set by a script | silent drift; a 4 mm² circuit priced and built as 2,5 |
| 17 | MP-17 | Opening and display checks: a window without `sill` / `h` checked as 0–1200; door-head runs info only; the ALAPRETEG §4 channel metres are the search cost | windows from older plans; a low ceiling; soft walls | none directly |
| 18 | MP-18 | Shutter (redőny) motors: the engine routes none. CLI with `shutterSwitch: false` stays silent; the Planner says it in an info note | any SHU | per motor a 230 V feed, if no other layer counts it — Q3 |

---

## 2. Part A — routing and wireway logic

### 2.1 The pipeline, step by step

| Step | Owner (file : function / lines) |
|---|---|
| Planner data → engine input (Vezethető marks, kinds, circuits, the redőny / AV exclusions, heights pinned, `cfg.tree` from `d.up` / `d.meet`, Padló út → floor groups, Mennyezeti út → ceiling links, the stale `sig`) | `src/08ob-wf-engine.js` `blInput` :41–106 (tree :84–85, floor groups :91–97, ceiling links :101–103, sig :104) |
| Room faces and the wall each lies on (25 mm) | `geom.js` `load` :15–48 |
| Vezethető intervals | `geom.js` `allowedFromSketch` :51–75 |
| Rule marks per face (ban / minus / előnyben) | `geom.js` `faceMarks` :86–104, `faceSide` :106 |
| Endpoints, standard heights, portals, latch from the door, portal members | `prep.js` `endpoints` :13, `applyHeights` :53, `portals` :59, `doorLatch` :84, `portalMembers` :90 |
| Drop groups (sort, then sweep) | `plan.js` §1 :36–46 |
| Service points and anchors (door L4, RBX, BASE, szobadoboz, board) | `plan.js` §2 :56–72 |
| Wall graph and mark costs (face ×1, minus ×2, előnyben ×0,5, unmarked ×4, ban = no edge, open 0); crossings, floor, ceiling hops | `network.js` `build` :58–100 (costs :84–91); `plan.js` cross :78–79, floor :80–81; `network.js` `ceilLinks` :123–128 |
| `up` → drops (K1): a door / hub / board feed or a chain, else the nearest service point, marked faces first | `plan.js` `fromTree` :120–133, `nearest` :107–116, chain roots :140–146 |
| Up-tree suggestions and editing | `08od` `upSuggest` / `upFill` / `upSet`; `08oe` `ldChains` (Q5); `08og` chain tool; `08oh` via |
| Lamp → switch, circuits, cable per circuit | `plan.js` `inferLamps` :732, `circuits` :789, `cableFor` :791 |
| Home runs (trunk): one tree from the board, +3 m per service point passed, congestion, via | `plan.js` `routeChannels` :194–205 (penalty :184, T1 / T2 :186) |
| Room runs, lamp / switch legs, travellers, motors | `plan.js` §7 :216–307; `P()` strict-first :88–91 |
| Boxes | `plan.js` §8 :311–341 |
| Legs and pipes: per-pipe packing, room runs, spans, trunk runs, drops, ceiling, floor, risers, feeds | `plan.js` §9 :356–540 (`pack` :363, room :398–422, spans :424–436, trunk :442–481, drops :484–490, ceiling :495–509, floor :511–522, feeds :530–540) |
| Unreached, box checks, Iz / ΔU, report | `plan.js` :571–585, :588–593, `cableChecks` :673, `pathReport` :606 |
| Drawn lines shape their legs | `08ob` `blShapeLines` :155–163 |
| Drawing: boxes → junction devices; ONE path per pipe | `08ob` `blApplyRoutes` :177–197 (boxes :185–187, paths :188–192) |
| Cables into the pipes | `08ob` `blApplyWires` :212–223 |
| Metres → price, CLI | `takeoff.js` `build` :21 → `_takeoff.json` / `MENNYISEGEK.md`; `emit.js` §5 → `ALAPRETEG.md`; → the Kit's `offer.json` (outside the repo) |
| Metres → price, Planner | `05-totals.js` `computeBOM` :20–42 → `renderBOM` / `bomJSON` / `bomCSV` (`state.price`, `state.waste`) |

### 2.2 F1–F13 and the T0 items against the current code

Fixed = no reproduction on the original input, and a test covers it. Partly = fixed for the original case, with a leftover
that reproduced.

| Item | Verdict | Evidence (code · input) |
|---|---|---|
| **F1** ×4 metres in quantities · **T0-1** | **Fixed**, display leftover | Edges carry `geo` (`network.js:42`). Legs, spans and trunks sum `geo` (`plan.js:386`, `:415`, `:433`, `:474`). Leftover: `routeChannels` keeps the search cost as `ch.len` (`plan.js:199`, `:202`). `emit.js:133` prints it as "Út az Elosztótól" in ALAPRETEG.md §4. Input: room B unmarked → 36,2 m printed for 10,75 m of trunk (MP-17c). `geoLen` (`plan.js:667`) is plan-only and drops the ceiling-hop rise from an Alosztó feeder (MP-15c) |
| **F2** silent unreached · **T0-2** | **Fixed** (SHU excepted) | `plan.js:571–585`; spec-100 §2. A SHU is skipped always (`:577`). CLI with `shutterSwitch: false`: SHU in a circuit, no leg, no error (MP-18). Planner: an info note (`08ob:52`, `:56`; spec-98) |
| **F3** ban marks ignored · **T0-3** | **Partly** | Wall faces: any `pol:'ban'` (tilos, gáz, kémény, vizes, gépészet, tartófal, szomszéd, üvegfal) = no edge (`geom.js:86–104`, `network.js:84–86`; spec-100 §3; probe E3). Still carrying routes: circle zones (`geom.js:91`, `m.x0 == null`); ceiling ban zones (the plane is not read, ceiling legs are straight lines); a padlófűtés zone drawn after a Padló út (checked only at commit, `08m:62`) (MP-4) |
| **F4** latch | **Fixed** | `prep.js:68–85` (door variant); `08fz` puts `BL.rules.PORTAL_SLOTS` before 08g; spec-100 §4 (2 doors × 4 variants × 2 angles) |
| **F5** wrong wall named · **T0-5** | **Fixed**; some messages lack the place | The soft edge carries its wall (`network.js:91`, `plan.js:349`); spec-100 §5. Still without `{room, at}` or a mutasd link: the diagonal-edge note (`:15`), the traveller failure (`:279`), the Iz / ΔU warnings (`:707`, `:709`), "két áramkörben" (`:817`), the floor-group error (`:249`), the Alosztó feed error (`:532`) |
| **F6** unmarked not a last resort · **T0-3** | **Fixed** | Strict-first for the room runs (`plan.js:87–91`), drop → service point (`:107–111`), chains (`:104–105`) and the trunk (T1 before T2, `:186`, `:196`); spec-100 §3 |
| **F7** door funnel, overfill ignores passing pipes | **Partly** | Congestion term (`plan.js:200`; the Planner uses 0,05, `08ob:22`), masters (T3), and a report row that counts passing pipes (`plan.js:629–631`). The warning still counts legs that end in the box (`plan.js:588–592`): 8 pipes in 2 legs → no warning (MP-13) |
| **F8** openings invisible | **Reported (info)**, with a gap | `pathReport` clashes (`plan.js:643–652`). A window without `sill` / `h` is checked as 0–1200; the Planner draws it 900–2400 (`:646` against `04-render.js:704`). CLA-teszt v1 / v2: 4 of 4 windows lack both (MP-17a). Door-head runs are info only (MP-17b) |
| **F9** geometry cliffs | **Partly** | Room inside its walls → per-drop errors plus a report row (`plan.js:640–642`). A wall added inside a room → a run through it, silent (MP-5) |
| **F10** stale / destructive · **T0-6** | **Partly** | The gate works (`08ob:177–178`); stale by `sig` (`:132–133`); Vezetékek refuses a stale plan (`:215`). The `sig` omits `D.paths` and the engine's own devices (`:45`, `:104`): editing a via path or moving a generated box → stale 0 / n, and the next Pályák puts the box back (MP-7) |
| **F11** electrical gaps | **Open** | A csillár feeding ceiling lamps: 3-core risers (MP-12). ΔU adds every ceiling leg (`plan.js:693`; MP-14). Meter → board is not in ΔU. Reference method fixed at B2 ⚑ |
| **F12** trunk = shortest-path tree | **Open by design** | `plan.js:184–186`; the congestion term only spreads it |
| **F13** O(V²) Dijkstra | **Open** | `network.js:46–52`; performance only, 0 money |
| **T0-4** one slot table | **Fixed** | as F4 |
| **T0-6** report + stale + gate | **Partly** | as F10 |
| **T0-7** order, heights, refs, snaps | **Fixed**; one order-dependence remains in the CLI | Sort-then-sweep (`plan.js:41`); height above ceiling − 100 warns (`:51`, against `cfg.ceiling`, not a room's own lower ceiling); duplicate refs (`:53–54`); stacks (`:599`). Still order-dependent: the 106 pairing in `inferLamps` (`plan.js:751–752`, CLI only; MP-11) |

### 2.3 Up-tree invariants

| Invariant | Holds? | Evidence |
|---|---|---|
| Exactly one upstream per node | yes | one field, `d.up` (`08od:47`) |
| No loops | yes | `upSet` refuses them with the chain spelled out (`08od:44`; spec-101 / 105). A loop loaded from a file is an error in `upCheck` (`08od:122`), and the engine tolerates it: a chain falls back to the nearest service point (`plan.js:142–143`); ceiling lamps break the cycle (`:501`) |
| No revisits | yes | a click on a node already in the chain starts a branch (`08og:28`) |
| Branch = same `up` | yes | by construction |
| Socket chain from the leader socket (Q5) | yes | `ldChains` (`08oe`): per circuit and room, nearest unvisited along the walls; the leader never on a szobadoboz (`08oe:38–42`). The engine follows it per member (`plan.js:121–126`); spec-103 |
| A user's fixed / drawn route is never overwritten | yes for the data | `upFill` skips `fix` (`08od:97–100`); `blInput` keeps `D.paths` with gen ≠ 'bl' (`08ob:45`); `blClear` removes only gen 'bl' (`08ob:171–172`); `viaSet` forces `fix`. But the kept via path is also counted as conduit (MP-7a), and editing it does not mark the drawing stale (MP-7b) |

### 2.4 Mark rules

- **Ban never carries a route.**
  - It holds for wall faces, including drawn and preferred routes:
    - a via along a banned face: no leg there, the via reported below 90 % with a warning (spec-106 §2; also run here on
      spec-100's plan with a tilos side on WR: 0 legs on it, 0 %);
    - a ban over the door's latch face (spec-100's plan, a tilos vstrip on WB side −1, u 8600–10200): no box on it, and
      socket D1 becomes the error "nincs engedélyezett falszakasz a szervizpontig".
  - It does not hold for three cases (MP-4):
    - circle zones;
    - ceiling-plane zones;
    - a floor-heating zone added after a floor line.
- **Costs.**
  - minus ×2 (`network.js:35`, `:90`);
  - előnyben ×0,5, and it opens an unmarked face, as Q-T0-3 = A decided (`:89`);
  - drawn via ×0,25 (`plan.js:162`, `:169`). It multiplies the edge's own weight, so a via over an unmarked face costs ×1
    and over an előnyben face ×0,125. That is consistent with "preferred, never forced", but worth knowing;
  - unmarked ×4, used only when nothing marked reaches, for every search (§2.2 F6).
  - Előnyben beats minus on the same stretch (`network.js:89`).
- **Not read:**
  - hstrip height bands (accepted, Q-T0-4);
  - plane strips (`pstrip`). Not reproduced as a money item, so it is left out of the findings.

### 2.5 Metres

| Quantity | How it is measured | Verdict |
|---|---|---|
| Room run / trunk / span length | geometric edge lengths (`plan.js:386`, `:415`, `:474`) | ✓ (spec-100 §1; run here on its soft-wall plan: 3 legs, 0 off; report 24,6 m geometric vs 36,6 m weighted) |
| Vertical drops | \|box h − device h\| (`plan.js:489`) | ✓; the horizontal offset inside one drop (≤ 250 mm) counts 0 (MP-15a) |
| Box → box allowance | none in the engine. Cable +10 % in takeoff / emit (`takeoff.js:34`, `emit.js:156`); `state.waste` on cable **and** conduit in the Planner BOM (`05-totals.js:26–39`), plus per-device drop allowances (`:18`, `:24`) | double allowance in the BOM (MP-10) |
| Ceiling runs | a straight line + (ceiling − 2450) on the first leg (`plan.js:495–509`); a drawn Mennyezeti út replaces the leg (`08ob:161–163`) | ✓; a phantom rise on drawn chained legs (MP-15b) |
| Floor (Padló út) | down from the box, along the line, up (`08ob:157–160`) | ✓ geometric; ban zones not rechecked (MP-4a) |
| Födém / slab | the Alosztó feeder adds the slab (`plan.js:530–536`) | ✓; a ceiling hop on its path loses the rise (MP-15c) |
| Door latch slots | `PORTAL_SLOTS` L4 at 150 mm beyond the latch jamb (`rules.js:73`, `plan.js:59`) | ✓ |
| Main feed | a straight line meter → board + verticals (`plan.js:538`) | ✗ ignores walls (MP-9) |
| Per pipe vs per chase | per pipe (E5-Q10 = A, `plan.js:683–685`); the report lists circuits per chase (`:625`) | ⚑ for you, below |

**⚑ MSZ HD 60364-5-52 — for you to confirm, not decided here:**

1. Grouping counted per pipe, not per horony (`plan.js:683–685`). The busiest chases in the report carry the per-chase count.
2. `GROUP_K` = IEC 60364-5-52 B.52.17 row 1, including 0,41 for n ≥ 12 (`rules.js:121–122`).
3. `IZ` = reference method B2, 30 °C (`rules.js:117–119`): is B2 the right method for NYM in gégecső in a wall chase?
4. `maxCirc15` = 2: a 1,5 mm² cable shares its pipe with at most one other circuit (`plan.js:360`).
5. ΔU 4 % on the longest branch, ρ = 0,0225 at 70 °C (`rules.js:127`). Meter → board is not included (F11). Ceiling legs
   are all added, not only the longest branch (MP-14).
6. Lighting current = 60 W per point and 150 W per motor (`plan.js:699–700`), instead of the breaker current (`lightCurrent: 'mcb'`).
7. Every NYM5× counts as 3 loaded conductors (`rules.js:124`), including the 2L+2N hob, which is two single-phase circuits.
8. Conduit fill: 40 %, or 33 % over 10 m; one cable needs ID ≥ 1,4 × OD (`rules.js:96`).

### 2.6 Silent routing failures

| Failure | Status |
|---|---|
| Member with no leg / off the wall / outside every room | error with the reason (fixed). Exception: SHU (MP-18) |
| Order-dependent grouping | fixed for drops and pipe packing. Still in the CLI 106 pairing (MP-11) |
| Stale report | the report is recomputed on open. The stale flag misses via path edits and moved engine boxes (MP-7b) |
| Route across a window / opening | info only, by your instruction. Windows without `sill` / `h` are missed (MP-17a); door heads at a 2400 ceiling are info only (MP-17b) |
| Route through a wall | silent when the wall is not on any room outline (MP-5) |
| Route through a ban | silent for circle, ceiling and later padlófűtés zones (MP-4) |
| Overfilled box | the warning counts legs (MP-13); the report's fill row counts pipes |
| Config ids that match nothing | silent (MP-16a) |

---

## 3. Part B — quantities to price

The routing output reaches a price two ways:

| Path | Chain | Assessment |
|---|---|---|
| **CLI** (CLA) | `R.legs` → `takeoff.build` → `_takeoff.json` / `MENNYISEGEK.md` → the Workflow Kit's `offer.json` | Consistent with the engine: conduit per kind × size, cable per type +10 %, boxes per kind, chases as a union of grooves |
| **Planner** | `R` → `blApplyRoutes` (one `data.paths` item per pipe, one junction device per box) → `blApplyWires` (cable text on the sections) → `computeBOM` → the price table and `bom.json` | Where the money findings sit |

| Question | CLI takeoff | Planner BOM |
|---|---|---|
| Units | m to 0,1 (`takeoff.js:7`), boxes db | m to 0,1, devices / boxes db |
| Waste | cable +10 %, conduit none, chases none | `state.waste` (10 %) on cable and conduit; chases none |
| Cable type | per type (`takeoff.js:31–34`) | **lost**: `Vezeték undefined mm²`. The engine writes circuit refs as strings into `sec.circuits` (`08ob:221`); `computeBOM` reads `c.mm2` and `c.count` off them (`05-totals.js:35–36`). A one-circuit pipe also counts twice: `sec.circuit` (id) plus `sec.circuits` (ref) (MP-1) |
| Conduit size | per size | **lost**: one `gégecső` row per build type (`05-totals.js:37`) (MP-8) |
| Chase | union of grooves, horizontal / vertical / ceiling | visible layers only (`06-wall-editor.js:158`, `:212`); width from `sec.dia`, which the engine never writes (it writes `cond`) → Ø20 → 32×30 (`06-wall-editor.js:36–40`, `08ob:190`) (MP-2) |
| Boxes | per kind; a szobadoboz face counted as a 2-gang box unless `spBoxSize` names it | one `Kötődoboz` row for every junction (`05-totals.js:27`); the engine adds a 2-gang box at each szobadoboz face (`plan.js:322–324`, `08ob:185–187`) (MP-6) |
| VAT | not in the repo (takeoff is net; `cla.v2.js` says "net Ft") | not in the repo (`computeBOM` has no VAT) |
| Not verifiable here | `offer.json`, the Kit's norms, VAT and rounding of labour (5 000 Ft steps) — outside the repo | — |

**Double counting across layers.**

- **Erősáram ↔ Házimozi: no double.** The AV circuits are taken out of the engine (`08ob:53`) and routed by the cinema
  (`08rb`). But the cinema's cables live in `data.runs` (`08rb:71–75`, `05w-fill.js:53`), which `computeBOM` never reads.
  Its paths carry two pipes (CINEMA plus a separate MAINS) and are counted once (MP-3). The same holds for the BRIDGE stack
  and channel fill runs.
- **Erősáram ↔ Adat/PoE ↔ LED (CLI): no double.** Data, LED and erősáram are separate sections of the takeoff
  (`takeoff.js:64–69`). Data runs at 2700, so its grooves are counted apart by design.
- **Engine ↔ the user's own lines:**
  - a via path is counted on top of the engine's pipe along it (MP-7a);
  - the per-device drop allowances are counted on top of the engine's drop legs (MP-10).

**Dropped by filters.**

| Filter | Stated? |
|---|---|
| SHU | yes — stated (MP-18) |
| AV circuits | yes — stated |
| A circuit on two levels (only this level's members) | yes — stated |
| `data.runs` (cinema, BRIDGE fill) | **no** — silent |
| Hidden layers in the chase rows | **no** — silent |
| `prepared` routes and `rbx` boxes in the takeoff | yes — explicit |

**`cla.config.js`.** Every key has a reader. But ids that match nothing are silent:

- `fixFace`, `adoptSwitches`, `spBoxSize`, `worktop[].wall`, `edits[].move`, a `switchGroups` lamp.

5 dangling ids → 0 warnings (MP-16a). This matters for acceptance step B (redrawing CLA in the Planner), when ids change.
Reported, not silent:

- an unknown switch in a switch group (an error, `plan.js:739`);
- missing socket-plan members (info, `:800`);
- an unknown floor-group service point (an error, `:249`).

---

## 4. Part C — the red team and the end-to-end rebuild

**Not run in this session.** These live only on your machine under `H:\Dev-VRG\VRG-DE\Planner_projektek_2026-10-16\`:

- `_redteam\h.js`, `t1.js` … `t13.js`;
- `_script\build-dom.js`, `win.js`, `chk.js`;
- `Domoszlo_alap.vplan.json`, `Domoszlo_erosaram_2026-10-18\Domoszlo_erosaram_claude.vplan.json` and its `build-report.json`;
- `Calculator/CLA-baseline/v1_2026-10-12/`.

Nothing was written to `_audit_2026-10\`, and no Part C verdict is claimed here. How to finish it is Q2 in §8. The runbook
for your machine, all outputs into the new folder:

```bat
cd /d H:\cwebuser\projects\VRG-DE\Planner_VRG_U100\Planner\projects\varler-planner
set NODE_PATH=H:\Dev-VRG\VRG-DE\Planner_VRG_U100\Planner\projects\varler-planner\node_modules
set P=H:\Dev-VRG\VRG-DE\Planner_projektek_2026-10-16
mkdir %P%\_audit_2026-10\redteam %P%\_audit_2026-10\dom
rem 8. each red-team script, with the arguments its header names; stdout to a file per script
for /L %i in (1,1,13) do node %P%\_redteam\t%i.js > %P%\_audit_2026-10\redteam\t%i.txt 2>&1
rem 9. the end-to-end rebuild from the base file, then the window and plan checks on the new build
node %P%\_script\build-dom.js dist\varler_planner.html %P%\Domoszlo_alap.vplan.json %P%\_audit_2026-10\dom\
rem    then win.js and chk.js on _audit_2026-10\dom\ (arguments as in their headers)
rem 10. node tests\run.js  (spec-98 runs its parity only when Calculator\CLA-baseline\v1_2026-10-12 exists)
```

What to compare, counts only, against `build-report.json` and the acceptance file:

- legs per kind;
- boxes per kind;
- conduit metres per kind and total;
- cable metres per type;
- warnings / errors.

The last recorded state is audit Part 11: 451,5 m, 105 boxes, two B32 warnings. The red-team expectation per script is the
"After" column of audit Part 5, *The red team, re-run*.

On the new build, also check these. They are the findings above that `Domoszlo_erosaram_claude.vplan.json` can confirm:

| Check | Finding |
|---|---|
| A 2-gang box at each of its three szobadobozok | MP-6 |
| The BOM cable row after Vezetékek | MP-1 |
| The chase rows with the ARM layer hidden | MP-2 |
| The box-fill rows against the overfill warnings | MP-13 |

**Step 10, here:**

| | GO-WIRE baseline (before T0) | after T3 (audit Part 8) | now (`fe0d23e`) |
|---|---|---|---|
| suites | 94 | 98 | **110** |
| checks | 3 290 | 3 400 | **3 736** |
| golden renders | 70 / 70 | 70 / 70 | **70 / 70 byte-identical** |
| spec-98 checks | — | — | 36, of which 2 are "skipped" lines that print PASS |
| spec-98 CLI ↔ Planner parity (CLA v1) | 167 / 167 legs | 171 = 171 (Part 5) | **not run: the CLA v1 sketch is not here** |

---

## 5. Findings in detail

Each finding has its input, the wrong output against the expected one, and the line that reproduces it. Appendix A =
`repro-engine.js`, Appendix B = `repro-planner.js`; each output line starts with the id.

**MP-1 — BOM cable row: inflated, untyped.**
- Where: `08ob-wf-engine.js:221` writes `s.circuits = ['A1']` (refs) and `s.circuit = 'A111'` (an id).
  `05-totals.js:35–36` treats both as circuit-spec objects, so `c.mm2` is undefined and each string counts once.
- Input: the practice flat, all walls Vezethető, ⚒ Pályák, 🧶 Vezetékek (Ház).
- Wrong: `Vezeték undefined mm²: 611,5 m`.
- Expected: per type, NYM-J 3×1,5 170,1 · 3×2,5 114,2 · 4×1,5 30,4 · 3×6 12,4 · 5×10 3,4 · 5×1,5 1,2 m. That is 331,6 m,
  or 364,8 m with the 10 % waste.
- Reproduce: B → `MP-1`.

**MP-2 — BOM chase: visibility-dependent, Ø20 for every pipe.**
- Where: `chaseProject` / `wallElevationData` skip hidden layers (`06-wall-editor.js:158`, `:212`). `chaseDia` reads only
  `sec.dia` (`:36`), and the engine sections carry `cond` (`08ob:190`).
- Input: as MP-1, then hide the engine's path layer.
- Wrong: `Falvésés 32×30 mm 159 m` disappears; conduit stays 302,7 m. With it visible, the 52,4 m of M32 and 12 m of M40
  are chased 32×30.
- Expected: the same rows whatever is visible, and a width from the conduit size.
- Reproduce: B → `MP-2`, `MP-8`.

**MP-3 — `data.runs` cables absent; multi-pipe paths counted once.**
- Where: `computeBOM` reads `data.cables` and `sec.circuits` only (`05-totals.js:20–42`); the cinema writes `data.runs`
  (`08rb:71–75`) and puts two pipes on one path.
- Input: the spec-105 C6 room, `cinRouteAll` (3 AV circuits).
- Wrong: the BOM has `Pálya – gégecső 92,5 m` and no cable rows.
- Expected:
  - cable rows for SPK 2×4 37 · LFE 13,8 · NYM-J 3×2,5 61,5 · AOC 5,3 · Cat6A 28,2 · trigger 14,8 · NYM-J 3×1,5 14,8 m;
  - 113,9 m of pipe, not 84 m (+ waste).
- Reproduce: B → `MP-3`.

**MP-4 — ban zones that still carry a route.**

| Case | Where | Input | Wrong | Expected | Reproduce |
|---|---|---|---|---|---|
| a. Padlófűtés drawn after the line | `08m:62` checks at commit only; `08ob:91–97` builds the floor group without the zones | a Padló út, then a padlófűtés zone over it | floor leg C8 6 180 mm, 0 messages, 0 errors; the same line drawn now is refused | an error (or refusal) naming the zone | B → `MP-4a` |
| b. Ceiling ban zone | `geom.js:91` treats every zone as a floor zone; ceiling legs are straight lines | a látszó beton ceiling zone over a lamp | ceiling leg 3 754 mm through it, no message | avoid, or an error | A → `MP-4b` |
| c. Circle zones | `geom.js:91`: `m.x0 == null` → ignored | the same strang as a rectangle vs a circle | 2 banned edges vs 0 | the same | A → `MP-4c` |

**MP-5 — a run through an undrawn wall (F9).**
- Where: faces come from room outlines only (`geom.js:26–43`); the new wall splits the face but routes along it.
- Input: wall WN (4950–5050 × 0–3000) inside room A, rooms not redrawn.
- Wrong: room run C2 (12,4 m) passes through WN's foot along y = 3000; 0 warnings.
- Expected: an error naming WN ("a wall with no room outline"), or a run through a door.
- Reproduce: A → `MP-5`.

**MP-6 — a second box at every szobadoboz face; one box row.**
- Where: `plan.js:322–324` makes an `sp` 2-gang box at each touched face; `08ob:185–187` turns it into a junction at
  140 mm; the BOM counts every junction as one row (`05-totals.js:27`).
- Input: the practice flat plus one szobadoboz SZD1 (150).
- Wrong: X20 "Szobadoboz SZD1 [szervizpont]" (140) on the same spot; `Kötődoboz 76 db` (1 user + 75 engine).
- Expected: no extra box at a szobadoboz; boxes per size.
- Reproduce: B → `MP-6`.

**MP-7 — via path double-counted; stale flag blind.**
- Where: the via path is an ordinary `data.paths` item (counted by `05-totals.js:33–37`). The `sig` hashes neither
  `D.paths` nor the engine's own devices (`08ob:45`, `:104`).
- Input: the spec-98 two rooms, a drawn path set as via for socket B, Pályák.
- Wrong:
  - BOM conduit 26,2 m = (19,5 engine + 4,3 drawn) × 1,1;
  - after editing the via path: stale 0 / 9; after moving engine box X1 300 mm: stale 0 / 9;
  - Vezetékek applies, and the next Pályák puts the box back (probe F10: X20 3 800 → moved 4 100 → 3 800).
- Expected: the via path not counted as conduit (or the engine's pipe not doubled); stale > 0 after either edit.
- Reproduce: B → `MP-7a`, `MP-7b`.

**MP-8 — conduit size lost.**
- Where: `05-totals.js:37` groups by `sec.build` only.
- Input: as MP-1.
- Wrong: `gégecső 302,7 m`.
- Expected: M20 132,1 · M25 77,9 · M32 52,4 · M40 12 m (+ waste).
- Reproduce: B → `MP-8`.

**MP-9 — main feed straight line.**
- Where: `plan.js:538`.
- Input: a meter in room A, the board in room B.
- Wrong: 9 581 mm (7,38 m plan).
- Expected: along the walls through O1, ≈ 21,5 m plus verticals.
- Reproduce: A → `MP-9`.

**MP-10 — drop allowances on top of the engine's drop legs.**
- Where: `05-totals.js:18`, `:24` add socket 0,3 / switch 1,1 / lamp 0,5 m per device; the engine's drop legs are already
  in the wired paths.
- Input: as MP-1.
- Wrong: `Kábel – Világítás 27,6 m`, `Kábel – Dugalj 8,3 m` added.
- Expected: no allowance where the device has an engine drop leg.
- Reproduce: B → `MP-10`.

**MP-11 — CLI 106 pairing by file order.**
- Where: `plan.js:751–752`.
- Input: four kind-106 switches, two in each room, no switch group.
- Wrong: order a1, b1, a2, b2 → pairs a1+b1 / a2+b2 across rooms, 47,4 m of 4×1,5.
- Expected: the order a1, a2, b1, b2 gives a1+a2 / b1+b2, 15,4 m, and so should every order.
- Planner: not affected. It stores `swType`, and the engine reads `kind`.
- Reproduce: A → `MP-11`.

**MP-12 — csillár risers 3-core (F11).**
- Where: ceiling legs always `NYM3x15` (`plan.js:294–301`).
- Input: one switch, mode `double`, two ceiling lamps.
- Wrong: plate NYM4x15, but box → LB → LA both NYM3x15.
- Expected: 4×1,5 from the box to the first lamp (both switched lines).
- Reproduce: A → `MP-12`.

**MP-13 — overfill counts legs (F7).**
- Where: `plan.js:588–592`.
- Input: 20 dedicated circuits through door O1.
- Wrong: X2 has 8 pipes in 2 legs and no warning.
- Expected: warned, since 8 > 6.
- Reproduce: A → `MP-13`.

**MP-14 — ΔU sums every ceiling leg (F11).**
- Where: `plan.js:693`.
- Input: a lighting circuit, one lamp each in two rooms.
- Wrong: the branch is 31,8 m. One lamp alone gives 19,1 m, and both 6,6 m ceiling legs are added.
- Expected: the longest branch only.
- Reproduce: A → `MP-14`.

**MP-15 — small metre errors.**

| Case | Where | Input | Wrong | Expected | Reproduce |
|---|---|---|---|---|---|
| a. Offset inside a drop | `plan.js:489` | sockets 240 mm apart in one drop | S3 → S4 0 mm | ≈ 240 mm | A → `MP-15a` |
| b. Phantom rise on a drawn chained leg | `08ob:163` adds the rise to every shaped ceiling leg | a drawn line to the 2nd lamp of a chain | 3 088 mm for 2 688 mm of line | 2 688 mm | B → `MP-15b` |
| c. Feeder loses a ceiling hop's rise | `plan.js:534`, `geoLen` | an Alosztó feeder over a ceiling hop | 26 010 mm against its own poly's 26 560 mm | 26 560 mm | A → `MP-15c` |

**MP-16 — silent no-ops.**

| Case | Where | Input | Wrong | Reproduce |
|---|---|---|---|---|
| a. Dangling config ids | `prep.js:23–36`, `:155`; `plan.js:591` (no check that an id exists) | 5 dangling ids | 0 warnings | A → `MP-16a` |
| b. `c.mm2` 4 or 6 | `plan.js:794`: `+c.mm2 >= 2.5 → 'NYM3x25'` | mm2 4 with B20 | NYM3x25, 0 warnings | A → `MP-16b` |

On MP-16b: the Planner's circuit UI has no `mm2` field (05j). `elpApply` (`08oa:98–106`) does not store the suggestion's
mm², so this reaches only plans written by a script (as `build-dom.js` does for one circuit). With mm2 6 and B32, the Iz warning suggests
"6 mm²", which is already set.

**MP-17 — opening and display checks.**

| Case | Where | Input | Wrong | Reproduce |
|---|---|---|---|---|
| a. Window band | `plan.js:646` | a window without `sill` / `h`, dist at 2300 | 0 clashes; 1 with `sill: 900, h: 1500` | A → `MP-17a` |
| b. Door head | `plan.js:643–652` | ceiling 2400 → dist 2000, inside every door band | 2 info rows, 0 warnings | A → `MP-17b` |
| c. ALAPRETEG §4 channel metres | `emit.js:133` prints `ch.len` | room B unmarked | 36 200 mm against 10 750 mm of trunk legs | A → `MP-17c` |

**MP-18 — shutter feeds.**
- Where: `plan.js:577` skips SHU in the unreached check. The Planner drops every SHU before the engine (`08ob:52`, info note).
- Input: a SHU in a lighting circuit, CLI default (`shutterSwitch` off).
- Wrong: 0 legs, 0 errors.
- Expected: per Q3.
- Reproduce: A → `MP-18`.

---

## 6. What the current nets catch

| | `node tests/run.js` (110 suites) | golden renders (70) | spec-98 CLI ↔ Planner parity |
|---|---|---|---|
| What it exercises | engine on synthetic plans (spec-100 … 106); `blApplyWires` metres (spec-98 :107–115) but **never `computeBOM` after it**; `computeBOM` only on hand-drawn paths with object circuits (spec-108 / 109) | `drawNormalGeom`, blueprints, elevations, plane views, `chaseSummary`, on 6 fixtures **without any engine run**; never `draw()` or `computeBOM` | the CLI engine = the bundled engine on the CLA v1 sketch (legs, boxes, checks, warnings), `cornerAll` on, congestion 0. **Skipped, as PASS, without client data** |
| Catches | regressions of F1, F2, F3 (wall faces), F4, F5, F6, the gate, L10–L12, the up-tree, chains, the tray, the chain tool, via | a change to elevation / plan geometry of the fixtures | a CLI ↔ bundle divergence in the engine's R |
| Misses | MP-1 … MP-18, all of them | all of them: no fixture has engine paths, and the chase numbers are for hand paths on visible layers | everything after `R` (draw, wires, BOM, chase); the Planner's defaults (congestion 0,05, `cornerAll` off); everything when the data is absent |

## 7. Tests to add first

1. **BOM after Vezetékek** (MP-1, MP-8, MP-10). Practice flat, all walls Vezethető, Pályák plus Vezetékek (Ház). Assert:
   - `computeBOM` cable rows per type = the engine's cable metres × (1 + waste), within 1 %;
   - conduit rows per size the same;
   - no row name contains `undefined`.
2. **BOM independent of visibility, chase from the pipe size** (MP-2). Hide every layer: the rows stay identical. An M40
   engine pipe is chased wider than 32 mm.
3. **No run through a wall** (MP-5). A wireway invariant on any engine run: no room-run or trunk segment crosses a wall
   rectangle except along a `cross` edge at a service point. Plus a wall added inside a room → an error naming the wall.
4. **Ban zones end to end** (MP-4):
   - padlófűtés drawn after a Padló út → an error, or the floor group refused, naming the zone;
   - a circle strang bans what the rectangle bans;
   - a ceiling ban zone → ceiling legs avoid it, or an error.
5. **Stale and hand edits** (MP-7b, F10). Editing a via path, or moving a generated box, makes `blStale` > 0 and
   Vezetékek refuse.
6. **One box per spot** (MP-6). After Pályák with a szobadoboz: no generated junction within 300 mm of a user junction;
   boxes priced per size.
7. **`data.runs` in the BOM** (MP-3). The spec-105 C6 room: cinema cables appear per type; conduit = Σ path length × pipes.
8. **A quantity golden for the engine.** Practice flat, Planner defaults: pin conduit m per size, cable m per type, boxes per
   kind, error / warning counts and the overfill rows (MP-13 included). Any metre change then shows the way the 70 renders
   show a drawing change. Today no net watches engine quantities in the Planner's own configuration.

## 8. Open questions

1. **Which output prices a job drawn in the Planner?** This sets the severity of MP-1, MP-2, MP-3, MP-6, MP-8 and MP-10.
   - A: the Planner's Anyag- és árkimutatás (`bom.json` / `bom.csv`) feeds the Kit;
   - B: only the CLI takeoff feeds the Kit, and the Planner BOM is informational;
   - C: it depends on the job. Say which jobs.
2. **Part C** (the red team, the `build-dom.js` rebuild, win.js / chk.js, spec-98 parity):
   - A: you run the §4 runbook on the machine and send me the counts (no plan data); I fold them into this file;
   - B: a session on the machine with `H:\` access runs Part C and appends it here;
   - C: leave Part C out of this audit.
3. **Shutter (redőny) 230 V feeds** (MP-18):
   - A: another layer counts them. Name it, and I check its quantities;
   - B: the Erősáram engine should route them as lighting-circuit legs, as the CLI's `shutterSwitch` mode does;
   - C: they are priced as a lump item outside the plan.
4. **A ban zone the route would cross** (MP-4):
   - A: an error that blocks Felrajzolás, like an unreached endpoint;
   - B: a warning in the Pálya-ellenőrzés;
   - C: keep the refusal at draw time only, and add a report row for existing lines.

---

## Appendix A — `repro-engine.js`

Save outside the repo. Run: `node repro-engine.js <…>/Planner/projects/varler-planner`. Pure Node, synthetic plans; each
line printed starts with the finding id.

```js
// repro-engine.js — MONEY-PATH-AUDIT_2026-10 engine findings. Pure Node; synthetic plans only.
// Save outside the repo; run: node repro-engine.js <path to Planner/projects/varler-planner>
'use strict';
const path = require('path'), ROOT = process.argv[2] || '.', B = path.join(ROOT, 'tools', 'baseline');
const geom = require(path.join(B, 'geom')), prep = require(path.join(B, 'prep')), plan = require(path.join(B, 'plan'));
// spec-100's two-room plan: A (top) | door O1 | B (bottom, the board); every wall Vezethető unless listed in o.unmarked
function mk(o = {}) {
  const walls = [['WT', -100, -100, 10100, 0], ['WB', -100, 3000, 10100, 3100], ['WL', -100, 0, 0, 3000], ['WR', 10000, 0, 10100, 3000], ['WB2', -100, 6000, 10100, 6100],
    ['WL2', -100, 3100, 0, 6000], ['WR2', 10000, 3100, 10100, 6000]].map(([id, x0, y0, x1, y1]) => ({ id, x0, y0, x1, y1 })).concat(o.walls || []);
  const marks = walls.filter(w => !(o.unmarked || []).includes(w.id)).map(w => ({ kind: 'wall', wall: w.id, level: 'ground', tags: ['vezetheto'] })).concat(o.marks || []);
  const S = (id, x, y, h, x2) => Object.assign({ id, type: 'socket', code: 'SOC', level: 'ground', x, y, h, layer: 'm', ref: id }, x2 || {});
  const devices = [{ id: 'BRD', type: 'board', level: 'ground', x: 5000, y: 5950, h: 1500, layer: 'hw' }, S('S1', 9000, 0, 300), S('S2', 5000, 6000, 300)].concat(o.devices || []);
  const D = { floors: [{ id: 'A', num: 'A', name: 'A', level: 'ground', poly: [[0, 0], [10000, 0], [10000, 3000], [0, 3000]] }, { id: 'B', num: 'B', name: 'B', level: 'ground', poly: [[0, 3100], [10000, 3100], [10000, 6000], [0, 6000]] }],
    openings: (o.noDoor ? [] : [Object.assign({ id: 'O1', type: 'door', level: 'ground', x: 9000, y: 3050, w: 900 }, o.door || {})]).concat(o.openings || []), marks, paths: o.paths || [], objects: [], devices,
    circuits: o.circuits || [{ ref: 'A1', name: 'dug', mcb: 'C16', members: devices.filter(d => d.layer === 'm').map(d => d.id) }] };
  return { project: { data: D, building: { walls: { ground: walls } }, layers: [{ id: 'm', role: 'sys:MAINS' }, { id: 'hw', role: 'hw' }] } };
}
function run(doc, cfg) {
  cfg = Object.assign({ level: 'ground', ceiling: 2850, maxCablesPerPipe: 3 }, cfg || {});
  const G = geom.load(doc, 'ground'), al = geom.allowedFromSketch(G, []).allowed, E = prep.endpoints(G, cfg); prep.applyHeights(E);
  const PT = prep.portals(G, E); prep.portalMembers(G, PT, E); return plan.plan(G, E, PT, cfg, al);
}
const polyLen = p => p.reduce((a, q, k) => k ? a + Math.hypot(q[0] - p[k - 1][0], q[1] - p[k - 1][1]) + Math.abs(q[2] - p[k - 1][2]) : 0, 0);
const say = (id, txt) => console.log(id.padEnd(7) + txt);
const SOC = (id, x, y, h) => ({ id, type: 'socket', code: 'SOC', level: 'ground', x, y, h: h || 300, layer: 'm', ref: id });
const LMP = (id, x, y) => ({ id, type: 'light', code: 'LMP', level: 'ground', x, y, h: 2850, layer: 'm', ref: id });
const SWI = (id, x, y, o) => Object.assign({ id, type: 'switch', code: 'SWI', var: '230', level: 'ground', x, y, h: 1100, layer: 'm', ref: id }, o || {});
const C = (ms, light) => [{ ref: 'A1', name: 'dug', mcb: 'C16', members: ['S1', 'S2'] }].concat(light ? [{ ref: 'V1', name: 'vil', mcb: 'C10', kind: 'light', members: ms }] : []);

// MP-4b/c — ban zones the router ignores: a CEILING 'beton' zone (ceiling legs run through it); a CIRCLE strang zone
{ const z = { id: 'MZ', kind: 'zone', shape: 'rect', plane: 'ceiling', level: 'ground', x0: 2000, y0: 500, x1: 8000, y1: 2500, pol: 'ban', tags: ['beton'] };
  const r = run(mk({ devices: [SWI('K1', 8000, 3000, { ctl: ['L1'] }), LMP('L1', 5000, 1500)], circuits: C(['K1', 'L1'], 1), marks: [z] }));
  say('MP-4b', `ceiling ban zone over L1: ceiling legs ${r.legs.filter(l => l.kind === 'ceil').map(l => l.id + ' ' + l.len + ' mm').join(', ')}, warnings about it ${r.warn.filter(w => /beton|tilt/.test(w.msg)).length} (expected: no leg through it, or an error)`);
  const rect = run(mk({ marks: [{ id: 'Z1', kind: 'zone', shape: 'rect', level: 'ground', x0: 9700, y0: 2600, x1: 10000, y1: 3000, pol: 'ban', tags: ['strang'] }] }));
  const circ = run(mk({ marks: [{ id: 'Z2', kind: 'zone', shape: 'circle', level: 'ground', cx: 9850, cy: 2850, r: 250, pol: 'ban', tags: ['strang'] }] }));
  say('MP-4c', `strang zone as a rectangle bans ${rect.net.g.banned.length} edges; the same strang drawn as a circle bans ${circ.net.g.banned.length} (expected the same)`); }
// MP-5 (F9) — a wall added inside room A, rooms not redrawn: a run passes through its foot
{ const r = run(mk({ walls: [{ id: 'WN', x0: 4950, y0: 0, x1: 5050, y1: 3000 }], devices: [SOC('S3', 1000, 0)], circuits: [{ ref: 'A1', name: 'dug', mcb: 'C16', members: ['S1', 'S2', 'S3'] }] }));
  const thr = r.legs.filter(l => l.kind === 'dist' && l.poly.some((p, k) => k && p[1] <= 3000 && l.poly[k - 1][1] <= 3000 && Math.min(p[0], l.poly[k - 1][0]) < 5000 && Math.max(p[0], l.poly[k - 1][0]) > 5000));
  say('MP-5', `legs crossing WN: ${thr.map(l => l.id + ' ' + l.len + ' mm').join(', ')}; warnings naming WN ${r.warn.filter(w => /WN/.test(w.msg)).length} (expected: an error, or a run round through the door)`); }
// MP-9 — the main feed meter → board is a straight line through rooms and walls
{ const r = run(mk({ devices: [{ id: 'MT', type: 'meter', level: 'ground', x: 500, y: 100, h: 1500, layer: 'hw' }] })), f = r.legs.find(l => l.kind === 'feed');
  say('MP-9', `main feed ${f.len} mm, plan ${Math.round(Math.hypot(4500, 5850))} mm straight (along the walls through O1 ≈ 21 500 mm + verticals)`); }
// MP-11 — kind-106 switches with no switch group pair two by two in FILE order, across rooms (CLI)
{ const sw = { a1: [1000, 0], b1: [1000, 6000], a2: [6000, 0], b2: [6000, 6000] }, L = [LMP('LA', 3000, 1500), LMP('LB', 3000, 4500)];
  const go = ord => { const ds = ord.map(k => SWI(k, sw[k][0], sw[k][1], { kind: '106' })).concat(L); const r = run(mk({ devices: ds, circuits: C(ds.map(d => d.id), 1) }));
    return r.L.units.filter(u => u.pair).map(u => u.switches.join('+')).join(' ') + ', NYM-J 4×1,5 ' + Math.round(r.legs.reduce((a, l) => a + l.pipes.reduce((s, p) => s + p.cables.filter(c => c.c === 'NYM4x15').reduce((t, c) => t + l.len * c.n, 0), 0), 0)) + ' mm'; };
  say('MP-11', `order a1,b1,a2,b2 → ${go(['a1', 'b1', 'a2', 'b2'])} · order a1,a2,b1,b2 → ${go(['a1', 'a2', 'b1', 'b2'])} (expected: same pairs, same metres)`); }
// MP-12 (F11) — a csillár (one switch, two outputs) to two ceiling lamps: the riser leg is 3-core
{ const r = run(mk({ devices: [SWI('K1', 8000, 3000), LMP('LA', 3000, 1500), LMP('LB', 6000, 1500)], circuits: C(['K1', 'LA', 'LB'], 1) }), { switchGroups: [{ lamps: ['LA', 'LB'], chain: ['K1'], mode: 'double', why: '' }] });
  say('MP-12', `plate ${r.drops.find(d => d.plate).plate.cable}; ceiling legs ${r.legs.filter(l => l.kind === 'ceil').map(l => l.from + '→' + l.to + ' ' + l.pipes[0].cables.map(c => c.c)).join(', ')} (expected 4×1,5 to the first lamp)`); }
// MP-13 (F7) — the box overfill warning counts LEGS: 20 dedicated circuits through door O1
{ const ds = [], cs = [{ ref: 'A1', name: 'dug', mcb: 'C16', members: ['S1', 'S2'] }];
  for (let i = 0; i < 20; i++) { ds.push(SOC('K' + i, 500 + i * 450, 0)); cs.push({ ref: 'C' + i, name: 'd', mcb: 'B16', dedicated: true, members: ['K' + i] }); }
  const r = run(mk({ devices: ds, circuits: cs }));
  r.boxes.forEach(b => { const ls = r.legs.filter(l => l.from === b.id || l.to === b.id), np = ls.reduce((a, l) => a + l.pipes.length, 0);
    if (ls.length <= 6 && np > 6) say('MP-13', `${b.id} ${b.n}: ${np} pipes in ${ls.length} legs, overfill warning: ${r.warn.some(w => w.msg.startsWith(b.id + ' ')) ? 'yes' : 'none'} (expected: warned)`); }); }
// MP-14 (F11) — the voltage drop adds every ceiling leg of the circuit to the longest branch
{ const sg = [{ lamps: ['LA'], chain: ['K1'], mode: 'single', why: '' }, { lamps: ['LB'], chain: ['K2'], mode: 'single', why: '' }];
  const one = run(mk({ devices: [SWI('K1', 8000, 3000), LMP('LA', 2000, 1500)], circuits: C(['K1', 'LA'], 1) }), { switchGroups: sg.slice(0, 1) });
  const two = run(mk({ devices: [SWI('K1', 8000, 3000), SWI('K2', 8000, 6000), LMP('LA', 2000, 1500), LMP('LB', 2000, 4500)], circuits: C(['K1', 'K2', 'LA', 'LB'], 1) }), { switchGroups: sg });
  say('MP-14', `V1 branch length: one lamp ${one.checks.find(c => c.circ === 'V1').Lm} m; a second lamp in the other room ${two.checks.find(c => c.circ === 'V1').Lm} m (both ceiling legs added)`); }
// MP-15 — small metre errors: members of one drop 240 mm apart; a ceiling hop on the Alosztó feeder loses its rise
{ const r = run(mk({ devices: [SOC('S3', 3000, 0), SOC('S4', 3240, 0)], circuits: [{ ref: 'A1', name: 'dug', mcb: 'C16', members: ['S1', 'S2', 'S3', 'S4'] }] }));
  say('MP-15a', r.legs.filter(l => l.kind === 'drop' && /S3|S4/.test(l.to)).map(l => l.from + '→' + l.to + ' ' + l.len + ' mm').join(', ') + ' (S3 and S4 are 240 mm apart)');
  const f = run(mk({ noDoor: true }), { ceilLinks: [{ a: [5000, 2990], b: [5000, 3110], aRoom: 'A', bRoom: 'B', n: 'x' }], subFeed: { x: 1000, y: 10, n: 'Felszálló', cable: 'NYM5x6', slab: 300 } }).legs.find(l => /Felszálló/.test(l.from));
  say('MP-15c', `Alosztó feeder len ${f.len} mm, its own drawn poly ${Math.round(polyLen(f.poly))} mm`); }
// MP-16 — silent no-ops: config ids that match nothing; a circuit's 4 mm² becomes NYM-J 3×2,5
{ const cfg = { fixFace: { X1: 'A' }, adoptSwitches: ['X2'], spBoxSize: { 'X3:A': 150 }, worktop: [{ room: 'A', wall: 'X4', from: 0, to: 1000 }], edits: [{ move: 'X5', x: 1, y: 1, note: '' }] };
  const doc = mk(); prep.applyEdits(doc, cfg); const r = run(doc, cfg);
  say('MP-16a', `5 dangling cla.config ids → ${r.warn.length} warnings`);
  const m = run(mk({ circuits: [{ ref: 'A1', name: 'dug', mcb: 'B20', mm2: 4, members: ['S1', 'S2'] }] }));
  say('MP-16b', `circuit mm2 4, B20 → ${m.C.list[0].cable}, warnings ${m.warn.length}`); }
// MP-17 — opening clashes: a window saved without sill / h is checked as 0–1200 (the Planner draws 900–2400)
{ const go = w => { const r = run(mk({ devices: [SOC('S3', 3000, 0), SOC('S4', 7000, 0)], circuits: [{ ref: 'A1', name: 'dug', mcb: 'C16', members: ['S1', 'S2', 'S3', 'S4'] }], openings: [w] }), { ceiling: 2700 });
    return r.report.clashes.filter(c => c.opening === 'W1').length; };
  const w = { id: 'W1', type: 'window', level: 'ground', x: 5000, y: -50, w: 1200 };
  say('MP-17a', `dist at 2300 across W1: clashes without sill/h ${go(w)}, with sill 900 / h 1500 ${go(Object.assign({ sill: 900, h: 1500 }, w))}`);
  const d = run(mk(), { ceiling: 2400 });
  say('MP-17b', `ceiling 2400 → dist ${d.W.dist}: ${d.report.clashes.filter(c => c.type === 'door').length} door clashes, all info, ${d.warn.filter(x => x.sev !== 'info' && /ajtó/.test(x.msg)).length} warnings`);
  const s = run(mk({ unmarked: ['WB2', 'WL2', 'WR2'] })), ch = Object.values(s.channel).find(c => c.cables.length);
  say('MP-17c', `channel ${ch.sp}: ch.len ${Math.round(ch.len)} mm (printed in ALAPRETEG.md §4) vs its legs' geometry ${Math.round(s.legs.filter(l => l.kind === 'trunk').reduce((a, l) => a + l.len, 0))} mm`); }
// MP-18 — a shutter motor in a lighting circuit, no shutterSwitch mode: no leg, no error
{ const r = run(mk({ devices: [{ id: 'M1', type: 'shutter', code: 'SHU', level: 'ground', x: 5000, y: 1500, h: 2500, layer: 'm', ref: 'M1' }], circuits: C(['M1'], 1) }));
  say('MP-18', `SHU M1 in V1: legs ${r.legs.filter(l => l.dev === 'M1' || l.to === 'M1').length}, errors naming it ${r.warn.filter(w => w.sev === 'err' && (w.ids || []).includes('M1')).length}`); }
```

## Appendix B — `repro-planner.js`

Save outside the repo. Run from `Planner/projects/varler-planner` with `NODE_PATH` set (GO-WIRE.md): `node <…>/repro-planner.js .` — needs jsdom; uses the committed `dist/varler_planner.html` and the practice apartment.

```js
// repro-planner.js — MONEY-PATH-AUDIT_2026-10 Planner findings: dist/varler_planner.html under jsdom.
// Save outside the repo; run from Planner/projects/varler-planner with NODE_PATH set (GO-WIRE.md): node <path>/repro-planner.js .
'use strict';
const { JSDOM } = require('jsdom'), fs = require('fs'), path = require('path'), ROOT = path.resolve(process.argv[2] || '.');
const dom = new JSDOM(fs.readFileSync(path.join(ROOT, 'dist', 'varler_planner.html'), 'utf8'), { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window; w.confirm = () => true; w.alert = () => {};
const say = (id, txt) => console.log(id.padEnd(7) + txt), m1 = v => +(v / 1000).toFixed(1);
const pipeQty = R => { const cab = {}, cond = {}; R.legs.forEach(l => (l.pipes || []).forEach(p => { cond[p.cond] = (cond[p.cond] || 0) + l.len; p.cables.forEach(c => { if (c.c !== 'SPARE') cab[c.c] = (cab[c.c] || 0) + l.len * (c.n || 1); }); })); return { cab, cond }; };
// the practice apartment (tools/practice, in git), every wall of the board's level Vezethető, optionally a szobadoboz
function practice(szoba) {
  const P = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'practice', 'Gyakorlo_lakas_villany.vplan.json'), 'utf8'));
  w.hardResetWorkspace(); w.applyProjectData(w.JSON.parse(JSON.stringify(P.project || P)));
  const D = w.__data, brd = D.devices.find(d => d.type === 'board'), lv = brd.level, WL = w.__getWalls()[lv]; w.__state.active = lv;
  WL.forEach(r => D.marks.push({ kind: 'wall', level: lv, wall: r.id, pol: 'plus', tags: ['vezetheto'] }));
  if (szoba) { const r = WL.slice().sort((a, b) => Math.max(b.x1 - b.x0, b.y1 - b.y0) - Math.max(a.x1 - a.x0, a.y1 - a.y0))[0];
    D.devices.push({ type: 'junction', jb: 'szoba', jbShape: 'rect', jbSize: 150, level: lv, x: (r.x0 + r.x1) / 2, y: r.y1, h: 2450, layer: brd.layer, ref: 'SZD1' }); }
  w.ensureIds(D); const ap = w.blApplyRoutes(w.blRun(lv), { confirm: true }), wr = w.blApplyWires(w.blRun(lv), 'haz');
  return { D, lv, R: ap.run.R, wr, bom: w.computeBOM() };
}
const rows = (bom, re) => bom.filter(r => re.test(r.name)).map(r => r.name + ' ' + r.qty + ' ' + r.unit).join(' · ');
// the spec-98 two-room plan, every wall Vezethető, two lamps on one switch (for MP-4a, MP-7, MP-15b)
function tworoom() {
  w.hardResetWorkspace(); const D = w.__data; w.__state.active = 'ground'; const WL = w.__getWalls(); ['ground', 'upper', 'basement'].forEach(l => WL[l].length = 0);
  WL.ground.push({ x0: -100, y0: -100, x1: 8100, y1: 0, id: 'W1' }, { x0: -100, y0: 0, x1: 0, y1: 3000, id: 'W2' }, { x0: 4000, y0: 0, x1: 4100, y1: 3000, id: 'W3' }, { x0: 8000, y0: 0, x1: 8100, y1: 3000, id: 'W4' }, { x0: -100, y0: 3000, x1: 8100, y1: 3100, id: 'W5' });
  D.floors.length = 0; D.devices.length = 0; D.circuits = []; D.paths.length = 0; D.openings.length = 0; D.marks = [];
  D.floors.push({ level: 'ground', poly: [[0, 0], [4000, 0], [4000, 3000], [0, 3000]], name: 'A', num: 'RA', layer: 'L0' }, { level: 'ground', poly: [[4100, 0], [8000, 0], [8000, 3000], [4100, 3000]], name: 'B', num: 'RB', layer: 'L0' });
  D.openings.push({ type: 'door', level: 'ground', x: 4050, y: 1500, w: 900 });
  ['W1', 'W2', 'W3', 'W4', 'W5'].forEach(id => D.marks.push({ kind: 'wall', wall: id, level: 'ground', tags: ['vezetheto'], pol: 'plus', layer: 'L0' }));
  const dev = (code, x, y, h, o) => { const d = Object.assign({ type: w.epTypeFor(code), code, level: 'ground', x, y, h, layer: 'L0' }, o || {}); D.devices.push(d); return d; };
  D.devices.push({ type: 'board', level: 'ground', x: 1000, y: 60, h: 1600, layer: 'L0' });
  const sA = dev('SOC', 2500, 0, 300), sB = dev('SOC', 6500, 0, 300), l1 = dev('LMP', 5000, 1500, 2700), l2 = dev('LMP', 7000, 1500, 2700); w.ensureIds(D);
  const sw = dev('SWI', 4100, 800, 1100, { ctl: [l1.id, l2.id] }); w.ensureIds(D);
  w.cktCreate({ name: 'Dugalj', mcb: { curve: 'C', amps: 16, poles: 1, n: false }, members: [sA.id, sB.id] });
  const cV = w.cktCreate({ name: 'Világítás', mcb: { curve: 'B', amps: 10, poles: 1, n: false }, members: [l1.id, l2.id, sw.id] }); cV.ref = 'V1'; cV.preset = 'vil'; w.ensureIds(D);
  return { D, sA, sB };
}
setTimeout(() => { try {
  // MP-1, MP-8, MP-10 — the BOM after Pályák + Vezetékek (Ház)
  { const { R, bom } = practice(), q = pipeQty(R), wst = 1 + (+w.__state.waste || 0) / 100;
    say('MP-1', `engine cable ${JSON.stringify(Object.fromEntries(Object.entries(q.cab).map(([k, v]) => [k, m1(v)])))} = ${m1(Object.values(q.cab).reduce((a, b) => a + b, 0))} m (×${wst} = ${m1(Object.values(q.cab).reduce((a, b) => a + b, 0) * wst)} m) · BOM: ${rows(bom, /^Vezeték/)}`);
    say('MP-8', `engine conduit ${JSON.stringify(Object.fromEntries(Object.entries(q.cond).map(([k, v]) => [k, m1(v)])))} · BOM: ${rows(bom, /^Pálya/)} · ${rows(bom, /^Falvésés/)}`);
    say('MP-10', `BOM allowances on top of the engine's drop legs: ${rows(bom, /^Kábel/)}`);
    // MP-2 — hide the engine's path layer: the chase rows go, the conduit row stays
    const L = [...new Set(w.__data.paths.filter(p => p.gen === 'bl').map(p => p.layer))]; L.forEach(id => { w.layerById(id).visible = false; });
    say('MP-2', `engine path layer hidden → ${rows(w.computeBOM(), /^Pálya|^Falvésés/)}`); }
  // MP-6 — a szobadoboz: the engine adds its own 2-gang box at the same spot; every junction is one BOM row
  { const { D, bom } = practice(true), s = D.devices.find(d => d.jb === 'szoba');
    say('MP-6', `boxes within 400 mm of SZD1: ${D.devices.filter(d => d.gen === 'bl' && d.type === 'junction' && Math.hypot(d.x - s.x, d.y - s.y) < 400).map(d => d.ref + ' "' + d.note + '" ' + d.jbSize).join(', ')} · BOM: ${rows(bom, /^Kötődoboz/)}`); }
  // MP-3 — the spec-105 C6 cinema room: its cables (data.runs) never reach the BOM; a path with 2 pipes counts once
  { w.hardResetWorkspace(); const st = w.__state, D = w.__data; st.active = 'ground'; st.exploded = false; const WL = w.__getWalls(); ['ground', 'upper', 'basement'].forEach(l => WL[l].length = 0);
    WL.ground.push({ x0: -100, y0: -100, x1: 9100, y1: 0, id: 'W1' }, { x0: -100, y0: 5000, x1: 9100, y1: 5100, id: 'W2' }, { x0: -100, y0: 0, x1: 0, y1: 5000, id: 'W3' }, { x0: 6000, y0: 0, x1: 6100, y1: 5000, id: 'W4' }, { x0: 9000, y0: 0, x1: 9100, y1: 5000, id: 'W5' });
    D.floors.length = 0; D.openings.length = 0; D.marks = []; D.paths.length = 0; D.devices.length = 0;
    const A = { level: 'ground', poly: [[0, 0], [6000, 0], [6000, 5000], [0, 5000]], name: 'Mozi', kind: 'nappali', layer: 'L0' }; D.floors.push(A, { level: 'ground', poly: [[6100, 0], [9000, 0], [9000, 5000], [6100, 5000]], name: 'E', layer: 'L0' }); w.ensureIds(D);
    const CL = w.cinLayerAdd(); CL.cinema = { room: A.id, level: 'ground', side: 'y0', xScr: 300, zone: { L: 5000, W: 6000, off: 0 }, suggest: true, fmt: '5.1', disp: 'pj', hEye: 1150, theta: 40 }; st.activeLayer = CL.id;
    const mk = (c, x, y, h, mt) => D.devices.push(w.epMake({ level: 'ground', x, y, h, mount: mt || 'wall' }, c, 'sys:CINEMA')), rk = w.cinSpotList(CL).find(p => p.code === 'CRK');
    mk('CRK', rk.x, rk.y, 300); mk('CLR', 1700, 50, 1150); mk('CLR', 4300, 50, 1150); mk('CSR', 50, 3500, 1750); mk('CSW', 50, 2500, 0, 'floor'); mk('CSW', 5950, 2500, 0, 'floor'); mk('CPJ', 3000, 2800, 2500, 'ceiling'); mk('CSC', 3000, 400, 2600, 'ceiling'); mk('CKP', 5950, 4500, 1100); w.ensureIds(D);
    const face = (id, t, u0, u1) => { const r = w.mrkWallById('ground', id), p1 = w.mrkFacePt(r, 1, 10, 0), p2 = w.mrkFacePt(r, -1, 10, 0);
      D.marks.push({ kind: 'vstrip', level: 'ground', wall: id, side: Math.hypot(p1[0] - t[0], p1[1] - t[1]) < Math.hypot(p2[0] - t[0], p2[1] - t[1]) ? 1 : -1, u0: u0 || 0, u1: u1 || w.mrkWallLen(r), pol: 'plus', tags: ['mozi'], layer: 'L0' }); };
    face('W2', [3000, 2500], 0, 6100); face('W3', [3000, 2500]); face('W1', [3000, 2500], 0, 6100); face('W4', [3000, 2500]); face('W4', [7500, 2500]);
    D.marks.push({ kind: 'wall', level: 'ground', wall: 'W1', tags: ['vezetheto'], pol: 'plus', layer: 'L0' }); D.devices.push({ type: 'board', level: 'ground', x: 8000, y: 50, h: 1600, layer: 'L0' }); w.ensureIds(D);
    w.cinRouteAll(CL, { circuits: 3, useGeneral: true });
    const cab = {}; w.afillRuns().filter(r => r.stage === 'cinema').forEach(r => cab[r.cable.c] = (cab[r.cable.c] || 0) + r.len * (r.cable.n || 1));
    const pipeM = D.paths.reduce((a, p) => a + p.sections.reduce((s, x, i) => s + w.sectionLen(p, i) * Math.max(1, ((x.cont || {}).auto || []).length), 0), 0);
    say('MP-3', `cinema cables ${JSON.stringify(Object.fromEntries(Object.entries(cab).map(([k, v]) => [k, m1(v)])))} · pipes ${pipeM.toFixed(1)} m · BOM: ${rows(w.computeBOM(), /^Pálya|^Vezeték|^Kábel/)}`); }
  // MP-4a — a Padló út drawn first, a Padlófűtés zone over it after: the engine still runs the floor leg, no word
  { const { D, sA } = tworoom(); const ok = !!w.clnCommit([[3990, 1500], [2500, 1500], [2500, 10]], { door: D.openings[0].id }, sA, 'floor');
    D.marks.push({ kind: 'zone', shape: 'rect', plane: 'floor', level: 'ground', x0: 2000, y0: 1000, x1: 3500, y1: 2000, pol: 'ban', tags: ['padlofutes'], layer: 'L0' }); w.ensureIds(D);
    const r = w.blRun('ground');
    say('MP-4a', `line accepted before the zone: ${ok}; now: floor legs ${r.R.legs.filter(l => l.kind === 'floor').map(l => l.id + ' ' + l.len + ' mm').join(', ')}, messages naming padló/fűtés ${r.R.warn.filter(x => /padl|fűt/i.test(x.msg)).length}, errors ${r.R.warn.filter(x => x.sev === 'err').length}`); }
  // MP-7 — a via path: counted on top of the engine pipes; editing it, or moving an engine box, leaves blStale at 0
  { const { D, sB } = tworoom(); D.paths.push({ ptype: 'gege', layer: 'L0', nodes: [{ level: 'ground', x: 4100, y: 1950, h: 2300 }, { level: 'ground', x: 4100, y: 0, h: 2300 }, { level: 'ground', x: 6500, y: 0, h: 2300 }], sections: [{ build: 'sull_gege' }, { build: 'sull_gege' }] });
    w.ensureIds(D); const P = D.paths[D.paths.length - 1]; w.blApplyRoutes(w.blRun('ground'), { confirm: true }); w.viaSet(sB.id, P.id); w.blApplyRoutes(w.blRun('ground'), { confirm: true });
    const len = p => p.sections.reduce((s, x, i) => s + w.sectionLen(p, i), 0), eng = D.paths.filter(p => p.gen === 'bl').reduce((a, p) => a + len(p), 0);
    say('MP-7a', `engine pipes ${eng.toFixed(1)} m + the drawn via ${len(P).toFixed(1)} m → BOM ${rows(w.computeBOM(), /^Pálya/)} (waste ${w.__state.waste} %)`);
    P.nodes[1].y = 2950; P.nodes[2].y = 2950; const s1 = w.blStale('ground');
    const b = D.devices.find(d => d.gen === 'bl'); b.x += 300; const s2 = w.blStale('ground');
    say('MP-7b', `after editing the via path: stale ${s1.stale}/${s1.drawn}; after moving engine box ${b.ref}: stale ${s2.stale}/${s2.drawn}; Vezetékek: ${w.blApplyWires(w.blRun('ground'), 'haz').err || 'applied'}`); }
  // MP-15b — a Mennyezeti út drawn to the SECOND lamp of a ceiling chain gets the 400 mm rise of a first leg
  { const { D } = tworoom(), r0 = w.blRun('ground'), ch = r0.R.legs.find(l => l.kind === 'ceil' && l.bends === 0), a = w.byId('devices', ch.from), z = w.byId('devices', ch.to);
    D.marks.push({ kind: 'cline', level: 'ground', pts: [[a.x, a.y], [a.x, a.y + 600], [z.x, z.y]], to: z.id, lamp: z.id, from: { dev: a.id }, h: 2700, void: false, pol: 'plus', tags: ['mennyezet-ut'], layer: 'L0' }); w.ensureIds(D);
    const l1 = w.blRun('ground').R.legs.find(l => l.kind === 'ceil' && l.dev === z.id);
    say('MP-15b', `chained leg ${a.ref || a.id}→${z.ref || z.id}: ${ch.len} mm straight; with the drawn line ${l1.len} mm for ${Math.round(600 + Math.hypot(z.x - a.x, z.y - a.y - 600))} mm of line`); }
} catch (e) { console.log('EXCEPTION ' + e.stack); } process.exit(0); }, 300);
```
