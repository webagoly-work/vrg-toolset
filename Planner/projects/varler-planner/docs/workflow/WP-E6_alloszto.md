# WP-E6 — An Alosztó on every further level (per-floor RCD protection)

Status: **built 2026-10-15, answers built 2026-10-16** (uncommitted) — Q1 A (+ C as a shown suggestion), Q2 A (default), Q3 own, Q4 B · Wave E · Depends: E3, E4, E5 · Spec: spec-99 (38 checks)
Spec: spec-99 (24 checks)

## Goal
The user's answer to E5-Q8: *"new levels get a sub Elosztó, called Alosztó or a DIN rail RBX of a kind to separate RCD
protection floor by floor."*

## What was there already
- the DED endpoint variant `alelo` (Alelosztó betáp, 3 fázis, NYM-J 5×6 in M32; 05s);
- the circuit preset `alelo` (3C 25A, 6 mm²; 08o);
- per-board cabinet schedules (05x `eloSchedule`), where a load belongs to the board on its own level.

## Built
- **`src/08oc-wf-alloszto.js`** (prefix `als`):
  - **The main Elosztó** is the board on the meter's level, otherwise the first board.
  - **Placing a board on another level** (⚡ Alosztó in phase Villamosság, or simply the Elosztó tool there) makes it
    that level's **Alosztó**: `sub:true`, ref AL1…, name *Alosztó — Emelet*. In the same undo step:
    - **its feed point**: on the main level, straight below, a DED `alelo` endpoint at the ceiling (−100), where the
      riser leaves upward; ref AB1…;
    - **the feeder circuit**: dedicated, **3C 25A, NYM-J 5×6**, on the main board.
  - The Alosztó's menu:
    - **Kivitel: szekrény ↔ DIN-sínes RBX** (`d.subKind`);
    - jump to its feed point.
  - **Checks:**
    - an Alosztó without its feed point;
    - a feed point that is not on a wall below (move it there: the riser);
    - an orphan feed point;
    - a circuit with end points on two levels;
    - a level with Erősáram endpoints but no board (info).
- **08n:** a board placement is one undo step with the circuits, and asks 08oc whether it is an Alosztó.
- **08oa (E4):** with more than one board, a board suggests circuits for its own level only.
- **05x:** an Alosztó cabinet gets its own main switch (4P / 2P) and a type-2 surge protector. The type-1 SPD and the bell
  stay in the main Elosztó.
- **08ob (E5 adapter)** — the engine runs per level:
  - the circuits that belong to the level;
  - on an Alosztó's level, `cfg.subFeed` = the feed point;
  - the feeder's own voltage drop (its row on the level below) goes into `cfg.upstreamDropPct`.
- **Engine (`tools/baseline`):**
  - the `subFeed` anchor and the **feed leg**: through the slab (300), up to the trunk, along the trunk tree, into the
    Alosztó;
  - `CIRCUIT_CABLE.alelo = NYM5x6`;
  - `upstreamDropPct` is added to every circuit's ΔU (`dUup` in the row).
  - CLA is unchanged.

## Answers (user, 2026-10-16) — built

| Q | Answer | Built |
|---|---|---|
| E6-Q1 | **A, later C as a shown suggestion** | 3C 25A, NYM-J 5×6 stays. **Betáp-javaslat** (Pályák dialog upstairs + the Alosztó menu): the floor load (its cabinet's ways × 0,6 diversity ⚑, chained floors included) → the breaker (only grows from 25 A) → the smallest NYM-J 5× cross-section that carries it and keeps the feeder ΔU + the floor's worst circuit ≤ 4 % (the E5 figures) |
| E6-Q2 | (not answered — A stays) | straight below, the user moves the feed point onto a wall |
| E6-Q3 | **own:** "main breaker switch only at Villanyóra/Elosztó main point, fő betáp mm² wires in parallel, each starting with its own RCD in the elosztószekrény" | the main switch only in the main Elosztó; every feeder way = **RCD 4P 30 mA A + MCB 3C 25A** (7 modules), never in an RCD group; the Alosztó: no main switch, SPD T2, **plain MCB ways** (the floor's RCD is its feeder's) |
| E6-Q4 | **B** | chained: an Alosztó is fed from the board of the nearest level below that has one (else the main board, from above for a basement); the feeder circuit is on that board (`c.board`); drops add up along the chain |

Also built with the answers:
- **05x** lists the workflow's own (E4, non-RBX) circuits as cabinet ways, on the board of their level; a feeder's load = its floor's ways (× 0,6).
- **Engine:** a run with no door / RBX / szobadoboz in reach may start at the board itself (a one-room level, the Alosztó's room) — a fallback only, CLA unchanged; IZ gets 25 mm² ⚑; a feeder may come from above (basement).

## The choices as asked (kept for the record)
- **E6-Q1, the feeder breaker and cable:**
  - A) 3C 25A, NYM-J 5×6 (built) **(Recommended)**;
  - B) 3C 32A, NYM-J 5×10;
  - C) per Alosztó: from its connected load (the cabinet's kW total) ⚑.
- **E6-Q2, where the riser runs:**
  - A) straight below the Alosztó; the user moves the feed point onto a wall below (built) **(Recommended)**;
  - B) a separate "Felszálló" marker anywhere, and the feeder goes to it on both levels.
- **E6-Q3, selectivity:**
  - A) the main Elosztó keeps the type-1+2 SPD and the RCBOs; the Alosztó gets its own main switch, a type-2 SPD and
    RCBOs (built) **(Recommended)**;
  - B) also a selective (S-type) RCD 100 mA on the feeder in the main Elosztó.
- **E6-Q4, a basement / a third level:** the feeder always starts from the main Elosztó, and the riser passes the
  levels in between:
  - A) yes (built; the feed leg counts one slab — a riser through a middle level is not yet counted ⚑);
  - B) chain the Alosztók (the upper one fed from the lower one).
