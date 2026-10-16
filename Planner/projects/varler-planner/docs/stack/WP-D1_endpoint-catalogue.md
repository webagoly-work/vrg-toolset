# WP-D1 — Endpoint catalogue: BRIDGE type codes as placeable devices

Status: todo · Wave D · Depends: B1 · Size: M (~230 lines) · Builder: mid tier (the table is copy-paste)
Decisions: Q29 (SWI default variant) · Q36 (new codes) · Q26=A

## Goal
Every system layer of the stack places **endpoints** identified by BRIDGE three-letter codes
(STD-004 §1.2), each with a variant that fixes its cable(s) and conduit (STD-001-A2). The classic
socket/switch/light types keep their own renderers; every other code is one generic device type `ep`.

## Read (only these)
- `01_CATALOGUES.md §5` (`EP_CAT`) and `§1` (cat mapping)
- `src/05k-room-auto.js` `function placeDevice` (the Device tool's click) — how a device is created
- `src/04-render.js` device symbol assembly (`grep -n "cktRingSvg" src/04-render.js`, ±15 lines)
- `src/05l-layers.js` `lyrDevCat` · `src/05m-stack.js` `stkLayer`, `STK_TOOLS`

## Build — `05s-endpoints.js` (prefix `ep`)

### 1. Catalogue
Paste `EP_CAT`. Helpers:
```js
epEntry(code,role)      // the EP_CAT entry for that code on that role (LMP, LNR, POR exist on two roles)
epOfRole(role)          // entries placeable on a role, in catalogue order
epVar(d)                // the variant record of a device (d.var, else the entry's first)
epCables(d)             // [{c,w,fam,n,from}] with defaults filled: fam = role's fam, n = 1, from = entry.from
epTypeFor(code)         // 'light' for LMP, 'switch' for SWI, 'socket' for SOC, else 'ep'
epRef(d)                // the display code: '<code><n>' — n = running number of that code in its room (derived)
```
`lyrDevCat` (A1) already maps `ep`+code; extend nothing there.

### 2. Placing — the endpoint tool (`STK_TOOLS` `{k:'epPlace'}`)
Action `ep.place` (group `Végpont`, `Végpont elhelyezése…`, icon `⊕`): opens a picker listing
`epOfRole(role of the active stack layer)` — code, name, variants as radio buttons. While a stack
`sys:*` stage is active the stage's inspector shows the same list as one-click buttons (register one
action per entry of that role with `many`-style generation, or one action with a picker — follow
what `05d-shell.js` can render; prefer one action per code: `ep.place.<role>.<code>`).
Placement:
- `mount:'wall'` → `snapWall` ghost at `h` (entry default); `mount:'ceiling'` → plan point at
  `LH[level]` (or the room's drop ceiling); `mount:'floor'` → plan point at 0.
- Create `{type:epTypeFor(code), code, var, level,x,y,h,side?, layer:stkLayer(S,role).id}` —
  **always on the code's role layer**, whatever layer is active (the user's "layer by layer" model;
  this is also what makes stack drawing in E1 work). For `LMP`/`SWI`/`SOC` keep the existing
  type-specific fields the classic tool sets (call the same creation path as `placeDevice` if it can
  take a preset type; otherwise copy the minimal fields and say so in the report).
- `pushUndo(['devices'])`, `ensureIds`, HUD `'<code> · <név> · <variáns>'`. Tool stays on; `Esc` ends.

### 3. Symbol for `ep`
One guarded line next to the C1 hook: `if(typeof epSymbol==='function'&&d.type==='ep')sym=epSymbol(d,x,y,k,back);`
`epSymbol`: rounded square 14×14 (scaled by `k` like other symbols) + the code in 7 px bold; colour by
role: MAINS `#d1493f` LV `#e6a800` BUSB `#b07a2a` CONTROL `#7a5cc0` DATA `#16a085` KNX `#2e7d32`
SENSOR `#2f79c9` HMI `#5470b0` MEDIA `#c2638a` USB `#607d8b` SECURITY `#444`. Wall View: a 70×70
box like a szerelvénydoboz with the code inside (mirror how `box` devices are drawn there).

### 4. Right-click on an endpoint (`STK_CTX`)
`Variáns ▸ <each variant n>` (flat) · `Kábelek` (HUD: `NYM-J 3×1,5 · M20` per cable) · `Áthelyezés a
szerep rétegére` (when a device sits on the wrong layer — after manual moves) · `Törlés`.

### 5. Validation
`ep.role` (warn): an `ep` device whose layer's role differs from its code's role (e.g. after a sub-layer
move) — `'<ref>: rossz rétegen (<role>)'`. `ep.code` (error): unknown code.

## Tests — `tests/spec-45-endpoints.js`
1. `epOfRole('sys:MAINS')` codes in order `LMP SWI SOC DED SHU`; `epEntry('LMP','sys:BUSB').vars[0].k==='b'`.
2. `epCables` of a `SCR/aoc` device → two cables, the second with `fam:'DATA'`; of `AVP` → the MAINS
   cable has `from:'board'`.
3. Placing `SEN` while the MAINS layer is active creates it on the SENSOR role layer.
4. A placed `LMP` has `type:'light'` and `code:'LMP'`; a placed `ACP` has `type:'ep'`.
5. `epRef` numbers per room: two SEN in room 1 → `SEN1`,`SEN2`; one in room 2 → `SEN1`.
6. Scene contains the code text for an `ep` device; `lyrDevCat` puts `LNR` under Lámpák.
7. Variant change via RCO updates `d.var` and `epCables`; undo restores.

## Golden
Identical.

## Browser-only checks (for the human)
Picker fits the inspector; symbols legible at plan zoom; Wall View boxes at real size.

## Verifier focus
Role-layer assignment independent of the active layer. Classic types keep every field their own
renderer and reports expect (sockets in the BOM, switch `swType`).

## Out of scope
Needs/checklists (D2), suggestions (D3), circuits (D4), cable runs (E3).
