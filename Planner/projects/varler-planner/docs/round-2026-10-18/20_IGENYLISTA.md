# Igénylista (Szoba + Ház) — WP-N1 … N4   (answers N1 A · N2 A · N3 B · N4 B · N5 B · N6 A)

User's words: *room- and whole-house-based task list / needs checklist — user created/activated, a separate layer
after Jelölés, that holds house-wide, room-specific info about overall needs (fulfilled on different layers while
planning), with room-specific general suggestions selectable for that checklist. RCO to set the checklist of a room;
every selected item can be specified: sockets → how many; lamps → how many on how many kapcsolási kör (several
kapcsolási kör can share one világítási kör); switches → how many (type set for every count). Erősáram first.*

Base: 05t-needs.js (ticks per role × room, defaults by room kind, derived ticks, status). This round turns the tick
into a **counted request** and gives it its own layer.

## WP-N1 — the layer and the data (module `src/08q-req.js`, prefix `req`)

- New role `{k:'need', n:'Igények', ph:1, cats:['mark'], hint:'Helyiség- és házszintű igénylista: mi kell, hány darab.'}`
  inserted in `STK_ROLES` right after `mark` (Q-N2 A: also addable as a plain layer via the layer panel ➕ menu
  *Igénylista réteg*). Icon `☑`, colour from `STK_COL` (new slate `#5d6d7e`).
- Data (no new collection): `rm.req = {v:1, items:{<itemKey>: {...}}}` on the room record (floors and building-model
  rooms, same as `rm.needs`), no house data (N3 B): *Ház* is an aggregate view = the sum of every room, computed on demand (`reqHouseSum()`).
- Only the layer *being active / visible* matters for display; the data lives on rooms so it survives a layer delete.
- `reqOf(rm)`, `reqHouseSum()`, `reqSet(rm, key, spec)` (one undo step, `pushUndo(['floors'])` for floor rooms; building
  -model rooms show the same HUD warning as `needSet`).

## WP-N2 — Erősáram item catalogue + room suggestions

`REQ_ITEMS` (role, code → what the request counts):

| key | n (HU) | role | counts | spec fields |
|---|---|---|---|---|
| `soc` | Dugalj | sys:SOC | SOC devices | `n` (db), `dbl` (ebből dupla), `h` hint (300 / 1100 pult / 1400 borotva) |
| `soc_app` | Készülék dugalj (hűtő, mosógép, mosogatógép…) | sys:SOC | SOC with `var` appliance | `n`, list of appliance names |
| `lmp` | Lámpa | sys:LIGHT | LMP devices | `n`, **`k` kapcsolási kör (≤ n) — the primary number**, `vk` világítási körök száma, optional pairing `pair:[{kk:1, vk:1}, …]` (N4 B) |
| `swi` | Kapcsoló | sys:LIGHT | SWI / switch devices | `rows:[{type:'101'|'105'|'106'|'107'|'108'|'100'|'redony'}]` — type only (N5 B) |
| `shu` | Redőny / árnyékoló | sys:LIGHT | SHU | `n` (default = tagged windows) |
| `ded` | Dedikált fogyasztó | sys:DED | DED | `rows:[{n:'sütő', A:16}, …]` |

House view (N3 B): the sum of the rooms per item (dugalj 42, lámpa 31 on 24 kapcsolási kör, kapcsolók by type …), no own items.

Room-kind suggestions `REQ_SUGGEST[kind]` (from NEED_KINDS; numbers = the WF R4 standards practice, reviewed at ⏸):

| kind | soc | lmp n / k | swi | ded |
|---|---|---|---|---|
| eloszoba | 1 | 1 / 1 | 106 × 2 when 2+ doors, else 101 | — |
| nappali | 6 (2 dupla) | 3 / 2 | 105 at the door | — |
| konyha | 5 pult + app (hűtő, mosogatógép, páraelszívó 1900) | 2 / 2 | 105 | sütő 16 A, főzőlap 3×16 A |
| etkezo | 2 | 1 / 1 | 101 | — |
| halo | 4 (2 ágy mellett) | 1 / 1 | 106 × 2 (ajtó + ágy) | — |
| dolgozo | 4 | 1 / 1 | 101 | — |
| furdo | 1 (1400 borotva) + mosógép | 2 / 2 (tükör külön) | 105 kívül | — |
| wc | 0 | 1 / 1 | 101 | — |
| kozlekedo | 1 | n by length (1 per 3 m) / 1 | 106 / 107 by door count | — |
| gepeszet | 2 | 1 / 1 | 101 | kazán 10 A |
| kulter | 1 IP44 | 1 / 1 | 101 belül | — |

The dialog shows these as *Javaslat* and the user takes them (*Javaslat átvétele*) or edits.

⏸ List review: the user checks the suggestion table above before N3 freezes it.

## WP-N3 — RCO *Igénylista…* dialog

- Room RCO (`STK_ROOMMENU` / `roomMenuItems`): `☑ Igénylista…` (replaces `☑ Helyiség igényei…` under Q-N1 A; the old
  dialog stays reachable as *Rétegenkénti igények* inside it).
- Layout: rows per item; checkbox + count inputs; lamp row = `[n] lámpa · [k] kapcsolási kör · [v] világítási kör`, with
  an optional *Párosítás* table (kapcsolási kör → világítási kör) folded by default; switch row = a list, `+ kapcsoló`
  adds a row with a type select (SWITCH_TYPES labels, 105/106/107/108 exactly as the HU codes). Status chip per row: `van 2 / kell 3`.
- Default switch types (suggestion only): k=1 & 1 door → 101; k=2 → 105; 2 doors → 106 + 106; 3+ doors → 106 + 107… + 106.
- *Ház összesítő…* (read-only sum) in the layer's own menu and the overview.

## WP-N4 — status + hand-off to the other tools

- `needHave` already counts devices by code in a room → `reqStatus(rm,key)` = have ≥ n ? kész : hiányos.
  05t `needOf` under Q-N1 A returns `{code:true}` for every req item with n ≥ 1, so 05t's overview keeps working.
- E4 (circuit suggestion) reads `vk` and the optional pairing as the room's világítási kör split.
- E1 (08l-wf-switches): when a room has `lmp.k`, the *Kapcsolási körök* suggestion starts from k groups and the
  switch rows' types; nothing is overwritten that the user has linked.
- R4 Standards (08j): the count drives nothing automatically (Q-N6 A); B adds *Létrehozás* using the standards spots.
- Overview table gets a third column set: `kell / van` per item for the active room set.

Tests (`tests/spec-103-req.js`): halo suggestion → soc 4, lmp 1/1, swi two 106; a room with 2 SOC devices and soc n 4
→ hiányos, 2/4; `needOf(rm,'sys:SOC')` = {SOC:true}; undo restores rm.req.
