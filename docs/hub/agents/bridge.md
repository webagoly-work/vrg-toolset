# BRIDGE okosotthon — agent init
*For a Claude Code session that will work on BRIDGE okosotthon. Read this, then the files in §3.*

## 1. What it is
A complete design for BRIDGE, a smart-home architecture documented to buildable depth. The doctrine
is manual-first, implemented in hardware. P33 is the first real instance (a two-storey flat).

## 2. Where
- `BRIDGE/` in the repo, on `main`. Standards in `BRIDGE/05_standards/`, open items in
  `BRIDGE/_build/`, the tuner in `BRIDGE/_tuner/`.
- No launcher entry — — (nincs leírva).

## 3. Read first
1. `BRIDGE/BRIDGE-PRIMER-001_Session-Handover.md`
2. `BRIDGE/BRIDGE-OUTLINE-001_General-Outline.md`
3. `BRIDGE/05_standards/README.md`
4. `BRIDGE/_build/BRIDGE_infobase.md` — §2 only

## 4. Build / test / check
— (nincs leírva) for the document set. The catalogue has its own build (see `sh-catalogue.md`).

## 5. Rules and traps
- Do not read the `01_`–`04_` source folders; they are already distilled into the standards
  (PRIMER §1). Do not read all standards up front; open one when the task touches it (PRIMER §1).
- Do not re-ask a settled question; decisions carry IDs, records in `_build/BRIDGE-A-002_decisions.md`
  (PRIMER §4).
- Do not propose DALI, per-room battery packs, PoE-powered room switches, layer-in-name ARM
  references, or a chimney above a RoomBox (PRIMER §4).
- Do not claim verification you did not do; reasoned ≠ measured (PRIMER §4, §5).
- Document set in English; Hungarian for physical things (PRIMER §5).
- Indicator language: unify against STD-008 §2 before building any of the three devices (PRIMER §9).

## 6. Current state
- 2026-10-21 Media Wall MW-001 r0
- 2026-10-14 P33-BUILD-001: K33 media wall — R06 upper wall + bedroom unit on the R07 face (§16)
- 2026-10-14 BRIDGE standards: STD-001-A2 Layer Wiring Reference, STD-009 Shading and Passive Climate
- Decision file: `BRIDGE/_tuner/BRIDGE-Q-001.json`. Open items: PRIMER §7.

## 7. Do not touch
- P33 client documents: excluded from version control, they live only at `BRIDGE/07_P33/` on this PC
  (PRIMER §2).
- `*.pdf` — never committed (root CLAUDE.md).

Forrás: BRIDGE/README.md, BRIDGE/BRIDGE-PRIMER-001_Session-Handover.md, git log main, 2026-10-22
