# WP-E3 — Auto-fill: runs, pipes and conduit sizing per room

Status: todo · Wave E · Depends: E2, D4, D2 · Size: L (~380 lines) · Builder: upper-mid tier
Decisions: Q32=A · Q34=A · Q35=A

## Goal
*"Since every pathway has been established between endpoint–RBX–Base–Elosztó, I could automate filling
up the endpoint-connected path lines with the necessary wireway and cable … a function that scans the
stack's one pathway lines against every layer in a room that is represented with at least one device
… connecting multiple devices within their layer to each other."*
This is wiring-pipeline slices S3 (runs) + S4 (sizing), for the stack. The physics rule that makes it
simple and correct:

> **A pipe can only start and end at a box.** A cable leaves its conduit only at a box (RBX, endpoint
> box, kötődoboz). So every *run leg* — origin → endpoint (star) or member → next member (chain) — is
> its own pipe, running beside the others on a shared route. Two legs share one pipe only when they
> are the **same family** AND run between the **same two boxes** (e.g. 2 × Cat6A to a double data
> point; two MAINS circuits RBX → the same box). Families never share a pipe (A2 rule 1).

## Read (only these)
- `01_CATALOGUES.md §6` (`AFILL_CABLES`, `AFILL_CONDUITS`, `AFILL_RULE`) and `§7` (`AFILL_FAMS`, `AFILL_SHARE`)
- `src/05v-graph.js` (all) · `src/05s-endpoints.js` (`epGroupsFor`, `epCables`, `epEntry`)
- `src/05p-hardware.js` (`hwRoomRbx`) · `src/05t-needs.js` (`stkRooms` via 05m) · `src/05u-arms.js` (`armRef`)
- `docs/wiring_pipeline.md` §3 decisions 3 and 6 only (suggestion vs override; lengths are approximations)

## Build — `05w-fill.js` (prefix `afill`)

`afillRuns()` — lazy getter for `data.runs` (pattern `cktList()`; A1 seeded the array).

### 1. Plan one room — pure: `afillPlanRoom(stackId, roomId)` → plan JSON
```js
{room, rbx, runs:[{role, code, group, fam, cable:'NYM3x15', n, w, from, to, keys, legOf, len}],
 pipes:[{key, fam, from, to, cables:[{c,n}], size, fill, len, segs:[{p,a,b}]}],
 warns:[{sev, code, msg, ref}]}
```
Steps:
1. `rbx` = the room's RBX (`hwRoomRbx`); none → `error 'fill.norbx'`, stop for this room.
2. `G = rgBuild({routes:['arm','channel']})`.
3. For every `sys:*` role (skip `sys:RF`) with ≥ 1 device in the room on that role's layer:
   `epGroupsFor(roomId, role)` → groups. For each group and **each cable** of its variant (`epCables` —
   an endpoint may need several cables in several families, each with its own `from`):
   - origin key: `from:'rbx'` → `'D:'+rbx.id` · `'board'` → the board with the shortest `rgDijkstra`
     distance · `'ssc'` → the SSC device; missing → `error 'fill.noorigin'`;
   - `topo:'star'` → `rgStar` → one run per member; `topo:'chain'` → `rgChain` → one run per leg
     (from = previous member); `topo:'tree'` → `rgSteiner` over origin + members, legs split at
     terminals AND branch nodes; a branch node with no device → `warn 'fill.branch'`
     (`'Elágazás doboz nélkül: kötődoboz kell ide'`, ref = node key) — v1 never adds the box itself;
   - unreachable member → `warn 'fill.unreached'` (`'<ref>: nincs pályán az RBX-ig'`).
   - run `len` = Σ edge `w` along `keys` + `2 × AFILL_RULE.slackPerEnd` (decision 6: approximate).
4. **Pass-through rule:** for runs whose origin is `board` or `ssc`, the RBX's own node is NOT a box
   for them (BRIDGE: big loads never through a RoomBox; security never into a RoomBox) — their pipe
   continues past it. For every other run, a pipe breaks only at its own from/to devices.
5. **Pipes:** group run legs by `(fam, from, to)` — the same family between the same two boxes → one
   pipe; `SPARE` cables always get their own pipe. `segs` = the route segments of the leg.
6. **Sizing** `afillSize(cables, lenMm)` → `{size, fill, why}`:
   - `need` = max over cables of: its `w`, its `minW`, and (single cable only) the smallest conduit
     with `id ≥ AFILL_RULE.single × od`;
   - several cables: the smallest conduit ≥ `need` whose `π/4·id² × k` ≥ Σ `n·π/4·od²`,
     `k = lenMm > AFILL_RULE.longMm ? fillLong : fill`;
   - nothing up to M63 fits → `warn 'fill.overfill'` and return M63 with `fill > k` (v1 does not split);
   - `SPARE` → its `w`, `fill:0`;
   - `why` like `'2×Cat6A U/FTP: 34 % ≤ 40 % → M25'` (wiring_pipeline §7 "auditable").
7. **Route-sharing check:** for every route section, the set of families of pipes crossing it →
   every class pair in `AFILL_SHARE` with `'warn'` → `warn 'fill.share'` with the A2 text, once per section.
8. **Ban check:** pipes on sections of a `sull` route lying along a `ban` wall → `warn 'fill.ban'` (reuse E1's test).

### 2. Apply — `afillApply(plans)`
`pushUndo(['paths','runs'])` once. For each planned room: delete `data.runs` with `stage:'stack'`,
that room, `manual!==true`; push the new runs (`{id, stage:'stack', stack, role, room, code, group,
from, to, via:<segs of keys>, cable, len, pipe:<pipe key>, basis}`); for every section a pipe crosses,
update `sec.cont = {auto:[…], manual: sec.cont&&sec.cont.manual||null, basis}` where every `auto` entry
is `{src:'room:<roomId>', pipe, fam, size, n, fill, cables}`. **A writer replaces only its own `src`
entries** — a section can carry pipes of several rooms (shared corridors) and E4's channel content
(`src:'chn:<routeId>'`); remove this room's old entries everywhere first, then add the new ones.
`basis` = FNV-1a 32-bit hex of `JSON.stringify` of the inputs (route nodes of G's paths, the room's
devices `{id,x,y,h,code,var,layer,links}`, groups) — `afillBasis(roomId)`.

### 3. Stale and manual (wiring_pipeline decision 3)
`afillStale(roomId)` = stored basis ≠ `afillBasis(roomId)`. A section whose `cont.manual` is set is
never overwritten; when its `basis` is stale → `warn 'fill.manual'`
(`'Kézi érték, a bemenet azóta változott'`). Runs with `manual:true` are kept as they are.

### 4. UI
Actions (group `Feltöltés`): `fill.room` `Helyiség feltöltése` (selected room, or room under the RCO) ·
`fill.all` `Teljes stack feltöltése` · `fill.report` `Kábel- és csőlista` · `fill.export` `Feltöltés exportálása (JSON)`.
Room RCO (`STK_CTX`, inside a room while the stack is active): `Helyiség feltöltése…`.
**Preview modal** before applying: per role a line `Erősáram — 6 futás · NYM-J 3×1,5 42 m · M20 × 4 (38 m)`,
then warnings grouped by code with counts, then `Alkalmaz` / `Mégse`. Applying shows HUD totals.
Scene (`STK_SCENE`, while `state.fillShow`, default on in the ARM stage): along every section with
`cont.auto`, one thin line per pipe offset 1.5 px apart, in family colours (D1's role colours),
`lyrWrap` with cat `path`.

### 5. Report — `afillReport(stackId)` → JSON (the Phase 3 seam)
```js
{stack, rbx:[{id, ref, rooms:[…], roles:[{role, endpoints, cables:{<name>:m}, pipes:{<size>:m}}],
  totals:{cables:{…}, pipes:{…}}}], warnings:[…]}
```
Lengths in metres, 1 decimal, cable totals × (1 + `state.waste`/100). Labelled `tájékoztató` in the UI.

### 6. Checks — `STK_CHECKS.arm`
`warn` a room whose fill is stale · `info` a room never filled · every `fill.*` warn of the last plan.

## Tests — `tests/spec-51-fill.js`
Fixture: one room, RBX on the left wall; ARM route RBX → J (junction node, no box) → branches to
SOC1 → SOC2 (chain) and to SEN1; an ETH `2` near the RBX; a DED oven; a board reached through a
channel `mains` route that ends at the RBX.
1. SOC chain: two runs (RBX→SOC1, SOC1→SOC2), two pipes, each NYM-J 3×1,5 → M20.
2. SEN: one star run, its pipe runs beside the SOC pipe on the shared segment (two pipes on that
   section, families MAINS + SENSOR) → one `fill.share` warn for that section.
3. ETH `2`: ONE pipe with 2 × Cat6A → M25 (`fill` 0.34 at 40 %, `why` mentions 34 %).
4. DED: run from the board; its pipe does NOT break at the RBX node (pass-through) — one pipe board→DED.
5. `afillSize` single NYM-J 3×1,5 (od 9) with `w:'M20'` → M20; a lone cable od 9 with `w:'M16'` → M20
   (1.4 × 9 = 12.6 > 10.7); 3 × Cat6A U over 12 m → 33 % rule → M32.
6. A member with no route → `fill.unreached`, no run for it, others still planned.
7. Apply → runs in `data.runs` with `H` ids; sections carry `cont.auto`; undo restores both.
8. A section with `cont.manual` keeps it after a re-fill; moving SEN1 makes the room stale and the
   manual section raises `fill.manual`.
9. `afillReport` totals: NYM-J 3×1,5 metres = Σ run lengths × 1.1 (waste 10).

## Golden
Identical (fixtures have no stack).

## Browser-only checks (for the human)
Preview readable for a whole CLA floor · pipe lines legible at zoom · fill time on CLA < 1 s.

## Verifier focus
Pass-through rule only for board/ssc origins. Pipe grouping key `(fam, from, to)` — not by route.
Families never merged. Manual values never overwritten. Determinism (same input → identical JSON).

## Out of scope
The CHANNEL bundle and the RBX feed (E4). Breakers (E5). Wire labels (wiring pipeline S8).
