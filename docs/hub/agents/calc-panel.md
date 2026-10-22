# Panel anyagár kalkulátor — agent init
*For a Claude Code session that will work on Panel anyagár kalkulátor. Read this, then the files in §3.*

## 1. What it is
The material-cost calculator for a partial panel-flat renovation, the pair of the labour calculator.
It can take the labour fee from the other tool and shows the material share of the total.

## 2. Where
- `Calculator/panel_anyagar_kalkulator.html` — one file, offline.
- Opened from `Planner/START.cmd` key **2**.

## 3. Read first
1. `Calculator/varleraron_kalkulatorok_osszefoglalo.md` — §0, §3, §4
2. `Calculator/panel_anyagar_kalkulator.html`

## 4. Build / test / check
No build — single file.

## 5. Rules and traps
- The cable section has a two-level logic — "ez a kulcsrész" (summary §3).
- The reserve is built into the item prices; the percentage itself never appears in the export (§3 Export).
- „Nullázás" clears only the quantities and keeps every calibrated unit price (§3).
- Every unit price stays editable in place, never burnt in; one file, no dependency (§4).

## 6. Current state
- 2026-09-17 Initial import of the VRG toolset. Decision files: none.

## 7. Do not touch
— (nincs leírva)

Forrás: Calculator/varleraron_kalkulatorok_osszefoglalo.md, Planner/START.cmd, git log main, 2026-10-22
