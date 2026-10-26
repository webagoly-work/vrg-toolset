# Round 2026-10-22 — Villany Stack (the stack for normal electrical work)

Build pack. Answers in `DECISIONS.md`; work packages in `10_VILLANY_STACK.md`.

**Status 2026-10-26: V1–V6 and V8 built** (`05m` kinds and roles, `05s` codes, `05p` hubs, `05w` cables and families,
`08s-villany.js`, spec-109). Not built: **V7** (the Áramkörök és védelem stage); in V3 the path states and the printed
Bontási terv legend (the layer menu offers the solo view); in V5 the IP44 default for *kültér*; in V4 the room-need
suggestions (TVA, BEL, ICM in NEED_DEFAULTS); Q-V10's per-project fire-resistant cable switch. The ⏸ looks (the wizard on
CLA, the V4 list review, promotion on a real plan) are the user's. Worked example: `tools/practice/` (Gyakorló lakás).

## Why

The Planner is mainly a tool for normal electrical work (villanyszerelés). Its only layer stack is the BRIDGE Stack
(`05m-stack.js`, `kind:'bridge'`), whose phase 1 is smart-home infrastructure: Hardver with RBX/SSC/portal,
BASE (NET · COMP · MEDIA), Csatorna between hardware points, then Klaszter and ARM. The workflow bar creates one
silently the moment the user enters Villamosság (`wfStack()`, 08k-wf-bar.js:20) — so every ordinary job today
lands in a smart-home stack.

The fix: a second stack kind, **Villany Stack** (`kind:'elec'`), which becomes the default for new work. BRIDGE
stays, and an existing Villany Stack is promoted to BRIDGE with **one click** (D4).

## The stack

| # | Role key | Name (UI) | Ph | Default | Contents |
|---|---|---|---|---|---|
| 1 | `construct` | Szerkezet | 1 | always | as today |
| 2 | `mark` | Jelölés | 1 | always | as today; electrical marks matter most: bathroom zones 0/1/2 (MSZ HD 60364-7-701), floor heating / pipes, beams, no-chase zones |
| — | `need` | Igények | 1 | opt-in | as today (08q) |
| 3 | `exist` **new** | Meglévő / bontás | 1 | always | existing points and cables, each `keep · remove · replace` (D1) |
| 4 | `hw` | **Betáplálás és elosztás** (elec name) | 1 | always | meter, board, sub-boards, EPH bar, earth electrode. Same key as BRIDGE's Hardver, offers only the electrical types |
| 5 | `sys:DED` | Dedikált körök | 2 | on | as today |
| 6 | `sys:SOC` | Dugaljak | 2 | on | as today |
| 7 | `sys:LIGHT` | Világítás | 2 | on | as today |
| 8 | `sys:WEAK` **new** | Gyengeáram | 2 | **on** (D3) | one layer; the endpoint code decides the purpose (D2) |
| 9 | `sys:BOND` **new** | Érintésvédelem / EPH | 2 | off | protective + supplementary bonding |
| 10a | `sys:ALARM` **new** | Riasztó | 2 | off | cablework only: panel → detector points (Q-V08) |
| 10b | `sys:FIRE` **new** | Tűzvédelem | 2 | off | cable only, dedicated red pairs, own conduit family (Q-V09, Q-V10) |
| — | (room kind) | Kültér | — | — | not a layer (D5): room kind *kültér*, IP44 variants, suggested 2-pole MCB |
| 11 | `route` **new** | Nyomvonal és dobozok | 2 | always | chases, conduit, junction boxes — what the engine writes to `channel` + `arm` in BRIDGE |
| 12 | `sys:SMARTREADY` **new** | Okos előkészítés | 2 | off | neutral in switch boxes, deep boxes, reserve conduit — carries over to BRIDGE unchanged |
| — | (stage) | Áramkörök és védelem | — | — | **not a layer**: RCD grouping, MCB, cross-section over `data.circuits` (05j) |

The role keys `sys:DED/SOC/LIGHT`, `construct`, `mark`, `need`, `hw` are **the same keys** as in BRIDGE, with the
same fixed colours. That is what makes promotion one click: no migration of those layers, only new ones added.

## Phases (dependency order)

| Wave | WP | Content | Checkpoint |
|---|---|---|---|
| 1 | **V1** | `kind` on the stack record; `STK_ROLES` gets `kinds:[…]` per role; per-kind name; `stkCreate({kind})`; old plans stay `bridge` | |
| 1 | **V2** | Wizard: kind choice first (Villany default), role list per kind; `wfStack()` creates `elec` | ⏸ look |
| 2 | **V3** | `exist` layer: status per item, render (keep grey · remove red cross · replace orange), Bontási terv sheet, totals | ⏸ look on CLA |
| 2 | **V4** | `sys:WEAK`: endpoint catalogue (reuse ETH, SMK, DBL…; new TVA, BEL, ICM), symbol colour by purpose | ⏸ list review |
| 2 | **V5** | `sys:BOND`, `sys:OUT`, `sys:SMARTREADY` roles + their endpoint lists and checks | |
| 3 | **V6** | `route` layer: the engine's `lay('channel')` / `lay('arm')` fall back to `route` in an elec stack | |
| 3 | **V7** | Áramkörök és védelem as a stage of the elec rail (reads 05j, writes nothing new) | |
| 4 | **V8** | One-click promotion → BRIDGE (one undo step) + its tests | ⏸ try on a real plan |

## Conventions (same as every round)

Single global scope (grep new names against `dist/varler_planner.html`, `tools/check-globals.js`); new prefix
`vst` for this round's own functions; ids from `data.seq`; one undo step per user action; HU UI strings; src is LF.
`stkCreate()` **without** `kind` keeps creating `bridge` — the 21 calls in spec-35 and the rest of the suites must
stay green untouched, golden 70/70 byte-identical (no fixture has a stack kind).
