# WP-R4 — Szabványmagasságok (STANDARDS)

Status: todo · Wave R · Depends: R1 (room kinds), R3 (zones/tags used as context) · Size: M (~220 lines) · Spec: next free ·
Decisions: R04 = B, R05, R06 answered · Q-R09 open · **⏸ after build (show the filled table)**

## Goal
*"Users can set and configure every device, path and relevant feature's standard height, with separate options for
different-purpose but same-type devices (dugalj: usual room height 300, garázs variant 500, éjjeliszekrény, media wall,
konyha dugalj below pult height, ventilator, fürdőszoba dugalj at 1400) — either a separate device item (with sub-type
and height shown), or dugalj is a multi-height device by default that is changed manually with UP/DOWN. (Ponder on that
Standards thing, what would be appropriate candidates?)"*

## Answered: separate catalogue items (Q-R04 = B, 2026-10-14)
Each height variant is **its own item** in the device list: `Dugalj · garázs · 500`, `Borotválkozó dugalj · 1400`,
`Mosogatógép dugalj · 300`… (code stays `SOC`/`DED`, `var` = the variant key, so BOM and colours still group by code).
The Standards table owns every item's height: change a row → every placed item of that kind follows (unless `hFix`).
Context no longer changes a device silently — it raises a **suggestion** (check `std.suggest`, info):
`'<ref>: garázsban áll — Dugalj · garázs (500) javasolt.'` with a one-click "Csere" in the hover/inspector.

## Read
`tools/baseline/rules.js` 9–60 (`LEVEL`, `stdHeight` — the logic to port) · `05s-endpoints.js` 20–45 (`EP_CAT[].h`,
`vars`) · R1010 WP-U4 (what ↑/↓ do on a selected device today: height ±) · MATERIAL §3 (the table).

## Build
1. `STD_H` (new, in `05s-endpoints.js` beside `EP_CAT`): the MATERIAL §3 rows `{code, var, n, h, auto:{kind?, zone?,
   tag?, note?, wall?, maxH?}, src}`. `EP_CAT[].h` stays as the fallback for codes without rows.
2. `stdPick(d)` → `{var, h, why}`: the item the context suggests (room kinds via 05h + R1, zones/tags within 600 mm,
   note words) — port of `stdHeight()`. Used only for the `std.suggest` check and for E5's input, never to rewrite `var`.
   The device palette lists one button per `STD_H` row (grouped under its code, label `n · h`).
3. `stdApply(scope)` — scope `device | room | project`: sets `d.h` = the height of the device's own item (`var`) for every
   device without `hFix`; result table (contract §4) `ref · eszköz · régi → új`, Alkalmaz.
4. Overrides cascade (MATERIAL §3): `data.stdHeights` rows `{code, var, h, scope:'project'|'kind:<k>'|'room:<id>'}`.
5. Panel **Szabványok** (rail): grouped by code, each variant row with its height input (mm) and the auto rule in grey;
   a scope selector `Projekt | Helyiségtípus | Ez a helyiség`. Path and level rows (PATH:trunk 2600, PATH:dist 2450,
   PATH:data 2700, BOX:rbx 2150, LVL:ceiling 2850, worktop 900, lintel 2100) at the bottom.
6. ↑/↓ keep their U4 meaning (height ±). A manual height sets `hFix`.
7. ⚑ rows (MATERIAL §3 / §3b appliance sockets, médiafal, bathroom generic Q-R09) are built with the recommended value and
   listed in the report for the ⏸.

## Tests
1. The palette shows `Dugalj · garázs · 500` as its own button; placed → `{code:'SOC', var:'garazs', h:500}`.
   A plain `Dugalj` placed in the garage → `std.suggest` info naming the garázs item.
2. Every CLA v1 endpoint: `stdPick(d).h` equals what `rules.js stdHeight` gave (read from the v1 vplan output) — except
   rows the user changed in the ⏸ (listed in the spec).
3. Override `kind:furdo` SOC 1400 → a bathroom socket gets 1400, a kitchen one does not.
4. Editing the `garazs` row to 550 + `stdApply('project')` → every garázs socket at 550 except `hFix` ones.
