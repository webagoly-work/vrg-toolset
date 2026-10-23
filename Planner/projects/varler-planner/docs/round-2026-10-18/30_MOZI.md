# Házimozi layer — WP-C1 … C7   (answers C1 A · C2 B · C3 open · C4 A+ · C5 B+A · C6 A · C7 B+A · C8 B)

Authority for every number: `src/home-cinema-part1-architectural-base.md` (the guide, §n below). Coordinates as in
guide §1.4: `x` from the screen plane into the room, `y` from the room centreline, `z` above FFL. The Planner converts
with the screen wall's inward normal `nrm` and its midpoint `m`: plan point = `m + nrm·(x_scr + x) + tan·y`.

User's flow, in order:
1. Activate the layer → prompt: **room**, **screen wall** (the wall viewers look at), **x_scr** (distance from that
   wall into the room where the screen plane is).
2. Optional prompt: *Javasoljak elhelyezést a helyiség méretei alapján?* → calculation → suggested positions as 30 %
   markers on the layer's sub-layer.
3. The layer lists every hardware node as a checklist; picking an item switches the device tool to it, ready to place.
   *Kész* at the end of the list moves on.
4. Mark the walls to use (inner faces + the room's outer wall faces); they carry the wall nodes AND give a route to
   the Elosztó for the dedicated circuit(s). Floor / ceiling nodes use the normal Kijelölés rules.
5. The layer holds its own path, node connections, node-to-node wiring, dedicated circuit; it adds a dedicated-circuit
   need to the Dedikált körök layer; cross-layer routing treats it as its own system (like Adat/PoE vs Erősáram).

## WP-C1 — role + standalone layer (module `src/08r-cinema.js`, prefix `cin`)

- `STK_ROLES` entry `{k:'sys:CINEMA', n:'Házimozi', ph:2, fam:'CINEMA', off:true, hint:'Hangszórók, projektor, vászon, rack — saját pálya, saját kör.'}`
  after `sys:MEDIA` (Q-C1 A). `off:true` = not created with a new stack; added on demand.
- Standalone: layer panel ➕ *Házimozi réteg* creates a plain layer `{role:'sys:CINEMA'}` without a stack (Q-N2 logic);
  inside an active stack the same command slots it into the stack at its role position.
- One cinema per layer: `L.cinema = {room, wall, side, xScr, fmt:'5.1'|'7.1', disp:'pj'|'tv', hEye, theta:[30,40],
  calc:{…cached result}, step:'setup'|'suggest'|'place'|'walls'|'route'|'done'}` (layer metadata, saved with layers).
- `STK_ICONS['sys:CINEMA']='🎬'`, `STK_COL` deep violet `#5b3f8c`, family `CINEMA` in 05w fill tables
  (conduit rules from guide §5–6: speaker Ø20, projector spine **Ø40**, LFE Ø25 separate from mains).

## WP-C2 — activation wizard

Modal steps (each Esc-safe, one undo step at the end):
1. *Válaszd ki a helyiséget* — click a room (rooms on the active level highlighted).
2. *Húzd meg a vászon / TV vonalát a helyiségben* (C2 B) — drag a line inside the room. The line snaps parallel to the
   nearest wall (walls are axis-aligned); that wall = the screen wall, its distance = **x_scr** (shown live, mm,
   snapping 50; a line on the wall face = 0, on-wall). The line length is a first guess of the screen width (only used
   by Set B later).
3. *(C3, pending)* the cinema zone of the room — see DECISIONS C3.
4. *Javasoljunk elhelyezést a méretek alapján?* Igen / Nem. Igen → format 5.1 / 7.1 (**7.1 always selectable**; when
   the viability test fails a warning note stays on the layer: *„7.1: a hallgatási pont mögött csak 1,2 m van — a
   hátsó pár 1 m-nél közelebb kerülhet, az 5.1 jobb lehet"*), display (projektor + vászon / TV), szemmagasság
   1150 / 1200, látószög 30°–40°.
   Ceiling height `H_f` = `slbCeil` (WP-S1) minus álmennyezet if any.

## WP-C3 — calculator (module `src/08ra-cinema-calc.js`, pure functions, no DOM)

`cinCalc({L, W, Hf, xScr, hEye, AR, thetaMax, cLens, fmt, t, nSubs}) → {xMLP, D, Ws, Hs, zBot, spk:{L,C,R,Ls,Rs,Lb,Rb},
subs:[…], pj:{x,z}, beam:{…}, ceilBand, checks:[{n, ok, sev:'warn'|'err', msg}]}` — the 7.1 viability
  test and check 7 (rear pair < 1 m) are **warnings**, never a refusal (C4).
- Set A (guide §3.1) for the seat; §3.6 speakers; §3.8 beam + ceiling band; §3.9 subs (L≈W within 10 % → 2 subs at
  side-wall midpoints); §3.10 sweep → `checks` with the HU remedy text.
- Sets B–E later (screen fixed / seat fixed / projector owned / ceiling binding) — the wizard offers only Set A now.

**Test vectors** (guide worked example: L 6.0, W 6.0, H_f 2.60, x_scr 0.50, h_eye 1.15, AR 1.78, θ 40°, c_lens 0.32,
t 0.05, x_MLP = 0.60 L) — `tests/spec-104-cinema-calc.js`, tolerance 0.005 m:

| quantity | expected |
|---|---|
| x_MLP / D | 3.600 / 3.100 |
| W_s angle-limited / height-limited / binding | 2.257 / 3.017 / 2.257 (angle) |
| H_s / z_bot | 1.268 / 0.727 (≥ 0.60 ✓) |
| y_LR (max of W_s/2+0.15 and D·tan22°) / φ | 1.278 / 22.4° (≤ W/2−0.60 = 2.40 ✓) |
| x_S at α 90 / 100 / 110 | 3.600 / 4.120 / 4.674 |
| y_B at β 135 / 140 / 150 (7.1) | ±2.350 / ±1.972 / ±1.357 (|y_B| ≤ 2.50 ✓) |
| z_S = z_B | 1.75 |
| rear clearance / 7.1 viable | 2.40 / yes |
| L ≈ W | yes → 2 subs, check 11 warns "4 ajánlott" |
| f_L / f_H | 28.6 Hz / 66.0 Hz |

## WP-C4 — suggestions on the layer (30 %)

- **Primary (C5 B): a drawing-only overlay** on the cinema layer's mark sub-layer — each computed position drawn at
  30 % opacity with its channel label (L, C, R, Ls, Rs, Lb, Rb, SW1, SW2, PJ, MLP). Nothing selectable, nothing saved
  except `L.cinema.calc`; it redraws when the room or the screen line changes.
- **On demand (C5 + A):** room RCO *🎬 Javasolt helyek létrehozása* turns the overlay into **ideal spots** (06b
  `ideal` mechanism) — right-click one or pick its checklist row to make it a device. One undo step; running it again
  replaces the spots, never devices already placed.
- MLP drawn as a seat marker (not a device); the beam keep-out wedge (guide §3.8: apex at the lens, base W_s at the
  screen, margin 0.25 m) and the usable track-light bands as 12 % fills on the layer's mark sub-layer.
- Failed sweep checks listed in the layer HUD with the guide's remedy; check 12 (doors / park zones / windows /
  radiators) uses the room's openings — a spot inside a door swing is red.

⏸ Look on a real room (CLANV4 or CLA nappali).

## WP-C5 — node checklist → place → Kész

Node catalogue `CIN_NODES` (new endpoint codes on `sys:CINEMA`, added to the 05s catalogue):

| code | n (HU) | mount | from | default count | notes |
|---|---|---|---|---|---|
| `CLR` | Front hangfal (L / C / R) | wall (screen wall) | rack | 3 | C behind AT screen or under it |
| `CSR` | Oldalsó surround (Ls / Rs) | wall | rack | 2 | z = h_eye + 0.60 |
| `CBK` | Hátsó surround (Lb / Rb) | wall (rear) | rack | 2 in 7.1, **pull anyway in 5.1** (§6.3) | |
| `CSW` | Mélysugárzó | floor | rack | 1–4 (§3.9) | LFE + 230 V in the floor (§3.9) |
| `CPJ` | Projektor | ceiling | rack | 1 | Ø40 spine, 230 V AV-3 |
| `CSC` | Motoros vászon | ceiling / screen wall top | rack | 1 | 230 V + trigger pair |
| `CTV` | TV (síkképernyő) | wall | rack | 1 (instead of CPJ+CSC) | |
| `CRK` | AV rack / erősítő | wall / floor | board | 1 | rear wall centreline default (§4.3) |
| `CAT` | Atmos előkészítés (mennyezet) | ceiling | rack | 4 blank boxes (§6.3) | optional |
| `CKP` | Mozi kezelő (ajtó / ülés) | wall | rack | 2 | CAT6A to both (§8.7) |

- The layer panel shows the list as a checklist; clicking a row sets the device tool to that code (the existing
  `epTool` / palette path) with the matching ideal spot highlighted; placing on / near the spot snaps to it.
- *Kész* (end of the list) → step `walls`. Unplaced rows stay listed as ● hiányos.

## WP-C6 — cinema walls, route to the Elosztó, dedicated circuit(s)

- Tool *Mozi falak*: same interaction as Vezethető fal (08h: click whole wall, drag a part, Shift-box); it accepts the
  inner faces and the **outer face** of the room's walls. Marks `{kind:'wall'|'wspan', tags:['cinema'], face:'in'|'out'}`
  — deliberately **without** `vezetheto`, so the general router never sees them.
- **C7 B primary:** the cinema route uses cinema walls only. **C7 A on prompt:** when the route cannot reach the
  Elosztó on cinema walls (or always, once per cinema), a confirmation asks *„A mozi útvonala használhatja az általános
  Vezethető falakat is? (N fal)"* — Igen adds them for this cinema (`L.cinema.useGeneral = true`), nothing is created
  before the answer. Ceiling / floor nodes follow Padló út / Mennyezeti út as everywhere else.
- Route: from each wall node along cinema walls to the rack (CRK) — star per speaker (guide §4.1: every speaker
  home-run), ring + spur pathway geometry (§4.2 default); rack → Elosztó along general allowed walls.
- Dedicated circuits (Q-C6 A): wizard asks 1 / 2 / 3; creates `DED` endpoints `AV-1 rack B16`, `AV-2 erősítő + mély
  C16`, `AV-3 projektor + vászon B16` on `sys:DED` (stack) or on the Erősáram layer (standalone), tag
  `phaseGroup:'AV'` + `rcd:'AV'` → the 05x cabinet puts them on one phase and their own Type A 30 mA RCD; E4 counts
  them as circuits. Sockets per guide §7.4 (rack 2 × dupla, sub positions floor sockets, projector in the hatch).
- *Mozi réteg aktív* → the Dedikált körök layer's room need gets `DED` (05t derived tick `⚙ Házimozi`).

⏸ On a real room: route along the outer wall to the Elosztó, circuit list, cabinet phase grouping.

## WP-C7 — wiring list + routing as its own system

- Cinema lighting (guide §8, LGT-A…E) is **out of this round** (C8 B); only the keypad CAT6A pulls stay.
- Node-to-node needs table (the layer's cable sub-layer) from guide §6.2: L/C/R/Ls/Rs/Lb/Rb → speaker cable sized by
  §6.1 (`A ≥ 0.712·l / Z_min`, same section for every channel), subs → LFE + 230 V, projector → AOC HDMI + CAT6A +
  230 V + spare, screen → 230 V + 2×0.75 trigger, keypads → CAT6A.
- Family `CINEMA` in the fill (05w) with the §5.2 fill factors (0.53 / 0.31 / 0.40) and §5.1 connector rule (HDMI head
  → Ø32 min / Ø40), separation from mains §5.5 as an info check where a cinema run is parallel to a MAINS run
  (< 300 mm unscreened).
- Cross-layer autorouting: the engine runs per family; `CINEMA` gets its own pass after MAINS, its mains feeds stay in
  MAINS. Cabinet (05x): AV circuits listed as their own group.

Out of scope this round: studio render mode, `data.zones` schema (the wedge is drawn from `L.cinema.calc`, not stored
as a zone), plenum cell map, Part 2 of the guide (second fix / calibration).
