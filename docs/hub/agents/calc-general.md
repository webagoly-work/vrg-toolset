# Általános villanyszerelői kalkulátor — agent init
*For a Claude Code session that will work on Általános villanyszerelői kalkulátor. Read this, then the files in §3.*

## 1. What it is
Itemised calculation of labour and material for general electrical work (topology description).

## 2. Where
- `Calculator/Altalanos_Villanyszerelui_Kalkulator.html` — one file.
- Opened from `Planner/START.cmd` key **3**.

## 3. Read first
1. `Calculator/Villanyszerelesi_Arlista_VarlerAron.md`
2. `Calculator/komplexitas_faktorkonyvtar_v1.md`
3. `Calculator/Altalanos_Villanyszerelui_Kalkulator.html`

## 4. Build / test / check
No build — single file.

## 5. Rules and traps
- The price list is indicative, for private customers, in HUF without VAT; the final price follows
  an on-site survey (Arlista header).
- **Teljes** = the finished service with material; **Munkadíj** = when the customer supplies the
  material (Arlista "Hogyan olvasd").

## 6. Current state
- 2026-09-17 Initial import of the VRG toolset. Decision files: none.

## 7. Do not touch
— (nincs leírva)

Forrás: Calculator/Villanyszerelesi_Arlista_VarlerAron.md, Calculator/komplexitas_faktorkonyvtar_v1.md, Hub/data/topology.json, Planner/START.cmd, 2026-10-22
