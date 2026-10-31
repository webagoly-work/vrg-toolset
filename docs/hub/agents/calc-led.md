# LED árkalkulátor — agent init
*For a Claude Code session that will work on LED árkalkulátor. Read this, then the files in §3.*
**Felelős:** Charlotte, Finance and Contracts

## 1. What it is
The labour-fee calculator for LED strip installation (the „2–2–6–8" model), built as a survey cheat
sheet for the phone.

## 2. Where
- `Calculator/led_arkalkulator.html` — one file, offline.
- Opened from START key **8**.

## 3. Read first
1. `Calculator/varleraron_kalkulatorok_osszefoglalo.md` — §0, §1, §4
2. `Calculator/led_arkalkulator.html`

## 4. Build / test / check
No build — single file.

## 5. Rules and traps
- The reference job behind the model: 250 000 Ft labour, 42 m strip, 33 joints, 5 power supplies,
  10 dimmer channels (summary §1).
- Every unit price stays editable in place; one file, no dependency; 46 px inputs for gloved,
  phone use (summary §4).

## 6. Current state
- git 2026-10-27 250b235 Mélyvíz rollout P0–P2: shared style, calculators, MindMap
- git 2026-09-17 35305ff Initial import of the VRG toolset
- Decision files: none.

## 7. Do not touch
— (nincs leírva)

Forrás: Calculator/varleraron_kalkulatorok_osszefoglalo.md, launcher/vrg-menu.json, git log main, 2026-10-31
