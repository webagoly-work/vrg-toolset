# WP-E4 — Channel fill: the CHANNEL bundle, RBX feeds, trunks

Status: todo · Wave E · Depends: E3, C5 · Size: M (~260 lines) · Builder: upper-mid tier
Decisions: Q37 · Q38

## Goal
*"The wired-up RBXs now have an exact set of cables, which automates (or an RCO on a finished RBX) to
fill up the one-line pathway topology of the Hardware Channel with the wireway + cable requirement of
the RBX / heavy-load endpoints toward the hardware units."*
E3 already carries board-origin (big loads) and SSC-origin (security) runs through channel routes.
E4 adds what feeds **the RoomBox itself**: the CHANNEL bundle from BASE and the MAINS room circuits
from the board — plus the fixed content of the other carriers.

## Read (only these)
- `01_CATALOGUES.md §10` (`CHN_CARRIERS`, `CHN_BUNDLE`), `§6`, `§12` (`ELO_RULES` — lightPerRbx, sys)
- `src/05r-channel.js` (`chnRoutes`, `chnEnds`, `chnCarrier`, `chnTree`, `chnGraph`)
- `src/05w-fill.js` (yours from E3: `afillSize`, the `sec.cont` writer, `src` rule, `afillBasis`)
- `src/05s-endpoints.js` `epCircuits`

## Build — `05w-fill.js`

### 1. Content per carrier — `afillChannelPlan(stackId)` → `{routes:[{p, carrier, pipes:[…]}], runs:[…], warns:[…]}`
| carrier | pipes on that route |
|---|---|
| `channel` (BASE→RBX, RBX→RBX) | the six `CHN_BUNDLE` pipes, fixed `w`, in C1…C5 order. **Day-one cables of the far RBX AND of every RBX downstream of it** (`chnTree`: physical chain, logical star — STD-001 §3.1 / RB-H ZT pass-through) go into C1, C2, C3, C4b; C4 and C5 stay empty spares |
| `mains` (board→RBX) | one cable per MAINS circuit fed through this RBX: `lightPerRbx` × NYM-J 3×1,5 plus one per socket circuit of its rooms (`epCircuits`: variant `s04` → NYM3x15, `25` → NYM3x25). **Packing:** first-fit decreasing by area into pipes whose capacity is M32 at 40 % (185.5 mm² — A2's largest MAINS group: "two S04 circuits on one route → M32"); then each pipe sized by `afillSize` with a **minimum of M25** (STD-001 §3.1 "M25 per circuit group") [Q38=A] |
| `panel` (board↔BASE) | `ELO_RULES.sys.base` × NYM-J 3×1,5 in one M25 /*r*/ + PANEL LINK 1 × Cat6A S/FTP in its own M20 /*r*/ — a mains+signal route by design, so the `fill.share` warn is expected: emit it as `info` here |
| `security` (SSC↔RBX) | **trunk**: every SECURITY pipe E3 put on this route's sections is replaced by ONE trunk pipe holding all their cables, sized by `afillSize` with minimum M25 (A2 step 13: "provider's trunk, several cables, M25") |
| `data` (BASE↔SSC) | 1 × Cat6A U/FTP, M20 (VLAN 50) |
| `isp` (entry→NET) | one empty M25 + draw cord (`SPARE`) /*r*/ — the provider's cable is theirs |
| `feed` (meter→board) | **not computed**: note `'A betáp a szolgáltató szabályai szerint (A08).'` (BUILD-001 §14.4) |

**Bundle capacity check — an open standards gap [Q37].** STD-001 fixes C1 at M25, which holds two
Cat6A at 40 %. A chain node passing a downstream room's uplinks through needs more. Default [Q37=A]:
fill the bundle as specified, compute `fill`, and when a C-pipe exceeds the rule raise
`warn 'chn.overfill'` (`'C1 túltelítve: 4 × Cat6A (67 %) — STD-001 nem szabályozza a láncolt köteget;
döntés kell: párhuzamos köteg vagy nagyobb cső.'`). Never upsize silently.

### 2. Runs for the bundle
For every RBX reached from BASE: one run per day-one cable,
`{stage:'channel', carrier:'channel', code:'C1'…, from:<BASE id>, to:<rbx id>, via:<chnTree path segs>, cable, len}`
— the cable list then knows its length through every chain node. MAINS feed runs likewise from the board.

### 3. Apply — RCO and actions
RCO on an RBX (`STK_CTX`): `Csatorna feltöltése (ez az RBX)` → plans the routes on this RBX's path to
BASE and its board route only. Actions (group `Feltöltés`): `fill.channel` `Csatornák feltöltése`
(all). Preview modal like E3 (per route: carrier, pipes `C1 M25 · 2×Cat6A …`, warnings) → `Alkalmaz`:
`pushUndo(['paths','runs'])`, replace runs with `stage:'channel'` (non-manual) and `sec.cont.auto`
entries with `src:'chn:<routeId>'` (the E3 `src` rule — never touch `room:` entries, except the
SECURITY trunk merge, which removes the merged `room:` security entries on THAT route's sections and
records them in the trunk's `merged:[pipe keys]`).

### 4. Report
`afillReport` (E3) gains per RBX `channel:{bundle:[{k, size, cables, fill}], mains:{pipes, cables}}` and
a `channels:[{name, carrier, len, pipes}]` list.

### 5. Checks — `STK_CHECKS.channel`
`warn` `chn.overfill` · `info` channel never filled · `warn` stale (basis over the channel graph + the
RBX day-one sets).

## Tests — `tests/spec-52-fill-channel.js`
Fixture: board, BASE, RBX1 (direct), RBX2 chained behind RBX1, SSC; routes BASE→RBX1, RBX1→RBX2,
board→RBX1, board→RBX2, SSC→RBX1; room of RBX1 with 2 socket circuits + lights; 2 SEC endpoints.
1. BASE→RBX1 carries six pipes C1…C5+C4b in order with fixed sizes; C1 holds 4 × Cat6A (RBX1 + RBX2)
   → `chn.overfill` warn (4 × 44.2 = 177 mm² > 105 mm²); RBX1→RBX2 C1 holds 2 → no warn.
2. board→RBX1: 1 lighting + 2 socket cables, all NYM-J 3×1,5 (od 9 → 63.6 mm² each). FFD into
   185.5 mm² bins: pipe 1 gets two (127.2), the third would make 190.9 → pipe 2. Sized: pipe 1 →
   M32 (127.2 ≤ 185.5; M25's 105.2 is too small), pipe 2 → M25 (single cable needs M20, the group
   minimum lifts it to M25). Assert exactly `[M32 ×2 cables, M25 ×1 cable]`.
3. SSC→RBX1: the two SEC M16 pipes from E3 become ONE trunk pipe ≥ M25 holding both cables; the
   room's other pipes untouched.
4. `panel`: the share warning is `info`, not `warn`.
5. `feed`: no pipes, the A08 note present.
6. Re-applying replaces only `chn:` entries; a room's `room:` entries on the same section survive.
7. Runs: RBX2's C3 cable run passes through RBX1's route (`via` covers both routes); length = sum.

## Golden
Identical.

## Browser-only checks (for the human)
Channel labels show C1…C5 in order; overfill warnings understandable.

## Verifier focus
Downstream accumulation along `chnTree` (a deeper chain adds to every upstream bundle). The `src`
ownership rule. The SECURITY trunk merge only on `security` carrier routes.

## Out of scope
Cabinet ways (E5). Feed sizing (DSO's rules).
