# Round 2026-10-18 — decisions (A = recommended default)

Answer in one line, e.g. `S1 A, S2 B, …`. Unanswered = A.

## Födém

**Q-S1 — does a födém lower the ceiling of the level below?** Today `LH[l]` = wall height = level step.
- **A** Level step stays `LH`; with a födém the lower level's walls/ceiling end at `LH − t` (clear height shrinks, building height unchanged). Old files without födém render byte-identical.
- B Clear height stays `LH`; the födém is added on top (`step = LH + t`) — the building grows by `t` per level.
- C Draw-only: the slab is a visual box, no height changes anywhere.

**Q-S2 — default thickness.** A **300 mm** (200 monolithic RC + 100 aljzat/burkolat; the engine's Alosztó `slab:300` already uses it) · B 250 · C 200 structural only.

**Q-S3 — where is it switched on?** A **per floor record (`fl.slab`), plus a level default in the Szintek tab and "Födém minden padlóra" in Create Floors**; RCO on a floor toggles it · B level-wide only · C per floor only.

**Q-S4 — the lowest level (pince/földszint on ground).** A **no födém under the lowest level** (it is a padlólemez, not a födém; toggle exists but default off) · B same as other levels.

## Igénylista

**Q-N1 — relation to the existing room needs (05t ☑ Helyiség igényei).** A **one system: the new *Igények* layer owns counted requests; 05t's ticks become "count ≥ 1"** and the old dialog opens the new one · B two separate lists.

**Q-N2 — must the Igények layer work without a BRIDGE stack?** A **yes** — a plain layer `role:'need'` that any project can add (classic Erősáram jobs too); inside a stack it sits right after Jelölés · B stack only.

**Q-N3 — house-wide list (Ház).** A **a separate *Ház* checklist (data.req.house) for building-wide needs** (pl. fogyasztásmérés, túlfeszültség-védelem, kültéri dugalj darabszám, kapukapcsoló) that is not tied to a room · B house = sum of rooms only.

**Q-N4 — lamps → circuits wording.** Draft: "lámpa n db, k kapcsolási körön". A **kapcsolási kör = one switched group (`d.grp`); világítási kör = the protective circuit. The checklist asks n lámpa + k kapcsolási kör; the világítási kör is chosen later by E4** · B also ask which világítási kör now.

**Q-N5 — switch "type set for every count".** A **one row per switch: position hint (ajtó mellett / ágy mellett / egyéb) + type (101, 105, 106, 107, 108, 100 impulzus, redőny)**, default derived from k and the door count (one door + k=1 → 101; two doors → 106 pair…) · B type per row only, no position.

**Q-N6 — fulfilment.** A **soft: a request shows ● hiányos / ● kész by counting devices in the room; nothing is created automatically** (05t Q27 = A, same as today) · B a "Létrehozás" button places the requested devices on the standard spots (WF R4 heights).

## Házimozi

**Q-C1 — stack position.** In `STK_ROLES` the order is …Adat/PoE, KNX, Érzékelők, Rádió, Kezelőfelületek, **Média és hang**, USB… — *Média és hang* and *Adat/PoE* are not neighbours. A **right after Média és hang** (it is a media sub-system) · B right before Adat/PoE · C tell me the order you see on screen.

**Q-C2 — screen wall input.** A **click the wall in the room (inner face); x_scr typed in mm, default 0 (on-wall), with presets 0 / 300 / 500 / 800** · B drag a line in the room.

**Q-C3 — room shape.** Rooms may be L-shaped. A **use the largest rectangle that touches the screen wall (L = depth away from it, W = along it); warn when the room is not a rectangle** · B bounding box · C refuse non-rectangular rooms.

**Q-C4 — format and display default for the calculation.** A **ask in the wizard: 5.1 / 7.1 (7.1 offered only when the viability test passes), projector / flat panel, h_eye 1.15, θ 30–40° (guide defaults)** · B always 5.1 + projector.

**Q-C5 — "30 percent visibility markers".** A **ideal spots (06b ghosts) at 30 % opacity on the cinema layer; right-click or the checklist turns one into a device** · B separate overlay drawing only.

**Q-C6 — dedicated circuits.** Draft: "one more dedicated circuit". The guide (§7.2): 2 minimum, 3 recommended (AV-1 rack B16, AV-2 amp+subs C16, AV-3 projector+screen B16), all **same phase, own RCD Type A**, cinema lighting LGT-1 never on AV. A **ask once: 1 / 2 / 3 circuits, default from the guide (5.1 modest → 2, 7.1 or 2 subs → 3)**, created as `DED` endpoints on `sys:DED` with a `phaseGroup` tag the cabinet (05x) honours · B exactly one, as drafted.

**Q-C7 — cinema walls "outer wallside can be used".** A **the cinema wall tool marks wall faces (inner and the outside face of the room's walls) as `vezetheto` marks tagged `cinema`; the cinema route may use them and every general Vezethető fal; floor/ceiling nodes follow Padló út / Mennyezeti út** · B cinema-only walls, nothing shared.

**Q-C8 — cinema lighting (guide §8, LGT-A…E).** A **in the node list as optional group (off by default); when on, the lamps go on sys:LIGHT with their own kapcsolási kör and the LGT-1 circuit** · B leave lighting out of this round.

## Answers — 2026-10-18 (user)

| Q | Answer | Meaning for the build |
|---|---|---|
| S1 | **B** | `LH[l]` = the room's inner (clear) height only. A common-thickness födém is **added between** two levels: level step = `LH[p] + t`. The building grows by `t` per slab. |
| S2 | A | 300 mm |
| S3 | A | per floor + level default + "födém minden padlóra" |
| S4 | **B** | the lowest level gets a slab too (same as the others) — it hangs below z = 0 |
| N1 | A | one system, counts replace the ticks |
| N2 | A | works without a BRIDGE stack |
| N3 | **B** | no separate house list — *Ház* = the sum of the rooms (an aggregate view, no own data) |
| N4 | **B** | ask the világítási kör now too. **The number of kapcsolási kör in the room is the important part**; pairing each kapcsolási kör to a világítási kör is secondary (optional, welcomed) |
| N5 | **B** | one row per switch, type only (no position) |
| N6 | A | soft status, nothing created |
| C1 | A | right after Média és hang |
| C2 | **B** | drag a line in the room = the screen plane; screen wall = the nearest parallel wall, x_scr = the distance |
| C3 | **D** | the cinema zone = a rectangle the user confirms (starts as A's rectangle, rear + side edges draggable), warning when smaller than the room |
| C4 | **A + change** | ask 5.1 / 7.1 etc.; **7.1 is always allowed**, a failed viability test gives a warning note instead of greying out |
| C5 | **B primary + A on demand** | suggestions are a drawing-only overlay; room RCO *Javasolt helyek létrehozása* turns them into ideal spots / placeable spots like A |
| C6 | A | ask 1 / 2 / 3 from the guide's rule |
| C7 | **B primary, A after a prompt** | cinema-only walls by default; using the general Vezethető fal too is offered with a confirmation prompt before anything is created |
| C8 | **B** | cinema lighting out of this round |

### C3 — open again, with the differences

On a rectangular room all options give the same result; they differ only on L-shaped / open-plan rooms (nappali + étkező).

- **A — largest rectangle on the screen wall.** Takes the leg of the L that faces the screen. Seat, speakers and
  modes are computed for the part people actually sit in. Ignores the alcove (the guide's mode / bass numbers become
  approximate there). Automatic.
- **B — bounding box.** Fills the missing corner as if it were room. Fine for nearly rectangular rooms; on a true L
  it can put the seat or a surround speaker **outside the room** (in the missing corner). Automatic, simplest.
- **C — refuse.** Only rectangular rooms. Safest, but most open-plan living rooms cannot use the layer.
- **D (new, recommended) — the cinema zone is a rectangle you confirm.** The zone starts as A's rectangle, drawn after
  the C2 screen line; you can drag its rear and side edges before the calculation runs. Works for every shape, and
  the HUD warns when the zone is not the whole room ("a mozi zóna kisebb a helyiségnél — a mélyhang számítás
  közelítő").
