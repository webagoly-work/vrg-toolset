# WP-M2 — Circuit presets: Elosztó list, szerelvénydoboz menu, rooms, export / import

Status: todo · catalogue accepted 2026-10-10 · Wave M · Depends: M1 (soft) ·
Size: L (~280 lines) · Spec: 73 · Answers: M06 = C curve default + CLANV4 sample + klíma 1–2 expected ·
M07 = A with Esc → B · M08 = A

## Goal
*"(Picture 2, the Áramkörök panel) — an additional option besides that: create an Áramkör with RCO on
the szerelvénydoboz — users can select from an array of usual circuit types to be active, waiting for
its endpoint. RCO on the Elosztó shows a simple list of circuit types with name and B / C, 6-10-13 A,
usual in every home, starting from a basic set towards additional, more special circuits (this list
also works as a reminder in case something is missing circuit-wise) — chosen and activated circuits
can have rooms linked to them (or house-wide), so that later, in the room-wide configuration, the room
reminds the user (it will expect it). Elosztó circuit presets can also be saved / imported / exported
with the blueprint, and exported from the Elosztó circuit box to create presets for later."*

Today there are three circuit notions — know which one this extends: (a) legacy route-section
circuits (the sidebar "Áramkörök" panel of picture 2, `renderCircuitList` / `collectCircuits` in
02-state line 91); (b) **05j `data.circuits`** — name, colour, dedikált, `mcb`, `members` (device
ids), the K pick mode; (c) the stack's implicit circuits (05s `epCircuitOf`). **This WP extends (b)**
and leaves (a) alone; the picture-2 panel gets one line pointing to the new list.

## Data (CONTRACT §3)
- `data.circuits[]` gains `preset` (catalogue key), `rooms` (`[roomId]` or `['*']`). "Waiting for its
  endpoint" is **derived** (`members.length===0`), not stored.
- `data.eloPresets[]` — the project's own list (ids `E…`): absent → the built-in `CPR_CAT`
  (MATERIAL §5); the first edit copies the catalogue in. Custom rows carry `custom:true`.
- `UKEYS` + `IDPRE` updated (CONTRACT §3 — an array, prefix `E`).

## Build — `05j-circuits.js` (it owns circuits) + menus
1. `CPR_CAT` (MATERIAL §5) and `cprList()` (project list or catalogue).
2. **Elosztó right-click** (board device menu — `STK_DEVMENU` / `deviceExtraItems`, 10-lamps):
   `⚡ Áramkör-lista…` → `cprDialog(boardId)`:
   - three collapsible groups **Alap · Kiegészítő · Speciális** (tier 1 / 2 / 3);
   - per row: `☐ aktív` · name (editable for custom rows) · **MCB**: curve `B | C` toggle + amps select
     `6 · 10 · 13 · 16 · 20 · 25 · 32` + poles (`1 · 1P-N · 3`) → written through `mcbParse` /
     `mcbText` · mm² · scope: `Ház` or a room multi-select (pre-ticked from the preset's `kinds` via
     `needKind`) · endpoints `n` · status (`cktStatus`: `nincs végpont` = waiting);
   - ticking `aktív` creates a 05j circuit (`cktCreate({name, mcb, dedicated: kind==='ded'})`,
     `preset`, `rooms`); unticking a circuit **with members** asks first and only deactivates (keeps
     the record, members released) — never silently deletes wiring decisions;
   - **reminder**: tier-1 rows that are not active and not explicitly dismissed show
     `⚠ alapkör — nincs aktiválva`; a dismiss (`×`) stores `dismissed:true` on the project row;
   - `+ Saját kör` adds a custom row; `⬇ Export` downloads `vrg-elo-presets` v1 (MATERIAL §5 format,
     same mechanism as `cktExport`, 05j line 170); `📥 Import` reads that file and **merges** by `key`
     (asks on conflicts: keep / replace — a conflict is same key **and** same name; same key with a
     different name is a second circuit of that type, e.g. three klíma);
   - `Minta betöltése` loads a bundled sample set — the CLANV4 one (`samples/CLANV4-minta…json`, inlined at
     build time as a constant) — through the same import path.
3. **Szerelvénydoboz right-click** (device `type==='box'`, and any endpoint without a circuit):
   `⚡ Áramkör ehhez…` submenu: first the active circuits whose `rooms` include this box's room (or
   `*`), then `— Új a listából —` the presets not yet active that fit the room's kind. Choosing one:
   activate if needed, `cktAssign(c, box)`, and (Q-M07 A) enter the K pick mode for that circuit
   (`cktPickStart`) so the next clicks add its other endpoints — the HUD says so; K ends normally.
   **Esc falls back to B** (answer M07): if Esc is pressed before any further endpoint was clicked,
   the box is released again and the circuit stays active, waiting for its endpoint; the HUD says
   `'A(z) „<kör>” aktív, végpontra vár — a doboz nem lett hozzárendelve.'` Esc after further clicks
   keeps everything (Esc never discards work).
4. **Rooms remind** — 05t: the room needs table and `STK_CHECKS` gain one line per active circuit
   linked to the room that has no endpoint in that room:
   `'<szám> <név>: a „<kör>” kör vár végpontra'` (warn); house-wide circuits are checked once.
   The 05h room inspector shows the linked circuits with their status.
5. The picture-2 panel (`circList`, shell.html line ≈ 303): add a line under the heading
   `'Elosztó-szintű áramkörök: jobb klikk az Elosztón → Áramkör-lista.'` and a button that opens
   `cprDialog` for the first board.
6. Registry: `circuit.presets` (`Áramkör-lista (Elosztó)…`), `circuit.presetsExport`,
   `circuit.presetsImport`.

## Tests — `tests/spec-73-circuit-presets.js`
1. No `eloPresets` → `cprList()` = catalogue (length = MATERIAL §5 count); editing a row copies the
   catalogue into `data.eloPresets` with ids `E1…`; undo restores the empty state.
2. Activate `konyhaA` → a 05j circuit with `preset:'konyhaA'`, `mcb` parsed `{curve:'C',amps:16,poles:1}`,
   rooms pre-filled with the kitchen; toggle B → `mcbText` `1B 16A`.
3. Box menu on a box in R03 Konyha lists `konyhaA` first; choosing it → the box is a member, pick mode on.
4. An active room-linked circuit with no endpoint in its room → the room's check line appears; after
   assigning an endpoint it disappears.
5. Export → JSON parses, `format:'vrg-elo-presets'`, v 1; import into an empty project → same rows;
   import with a conflicting key and "keep" → unchanged.
6. Deactivating a circuit with members asks (stub `confirm`), keeps the record, releases the members.
7. Box menu → choose → Esc at once → the box is not a member, the circuit is active with 0 members;
   choose → click one more box → Esc → both stay members.
8. Import `samples/CLANV4-minta.vrg-elo-presets.json` → 13 rows, `vil` parses as `1B 10A`; three
   `klima` rows active → no klíma reminder; one `klima` → none; zero → the `⚠ alapkör` line.
9. Duplicate keys in an import (CLANV4 has three `szobakor` and three `klima`) are kept as separate rows
   (merge-by-key applies only to rows whose key **and** name match).

## Verifier focus
`mcbParse` round-trips every catalogue `mcb` string (`1P-N C16A`, `3C 25A`, `1B 6A`); cabinet (05x)
ways must not double count a preset circuit that is also an implicit stack circuit — check how
`eloWays` reads `data.circuits` before saying done (out of scope to change; report if it double counts).
