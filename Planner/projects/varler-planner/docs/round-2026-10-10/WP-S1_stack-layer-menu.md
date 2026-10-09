# WP-S1 — Stack layer right-click menu + Info

Status: todo · Wave S · Depends: U1 (`hitOk`) · Size: M (~170 lines + the text table) · Spec: 67 ·
Decision: Q-S02

## Goal
*"Add some useful RCO when clicked on a stack layer box, including delete contents on that layer."*
*"RCO on a stack layer box and choose Info to get brief information about that layer's purpose,
device types associated with that layer, where and how many of it should be positioned, what other
layers could it be clustered with."*

"Stack layer box" = a role layer row in the Layers panel (`.lrow`, `05l-layers.js` line 233 →
`lyrLayerMenu`) **and** the same layer's stage button in the rail (`#stageRail .stg[data-k]`,
`05d-shell.js` `renderShell` — no contextmenu today). Both open the same menu.

## Read
`05l-layers.js` lines 223–262 (row menus), 340–360 (`lyrDelete` — the undo pattern with `__layers`),
433–440 (`lyrLayerMenu`) · `05m-stack.js` lines 15–60 (roles, groups, checks, hooks), 241 (`stkMenu`)
· `05t-needs.js` (`needOf`, `needStatus`) · MATERIAL §2.

## Build
1. **Hook** in 05m: `const STK_LAYERMENU=[]; function stkLayerMenu(L, items)` — like `STK_DEVMENU`;
   `lyrLayerMenu` calls it for a layer with `L.stack && L.role`, appending after a `—` separator.
   The rail: `contextmenu` on `.stg[data-k]` resolves the stage key to the role layer
   (`stkLayer(S.id, key)`) and opens `lyrLayerMenu(e, L.id)`.
2. **Items** (every layer with a role; disabled-looking items carry the reason, the registry way):
   | Item (HU) | Action |
   |---|---|
   | `ℹ Info — <role>` | the Info dialog (3) |
   | `Aktiválás` | `state.activeLayer=L.id`, stage follows (as clicking the row does) |
   | `Csak ez látszik` / `Mind látszik` | solo: every other layer of the stack hidden, remembered for undo-free restore |
   | `Kiemelés (Réteg-kiemelés)` | `lyrSpotSet(L.id)` with spotlight on |
   | `Elemek kijelölése (n)` | every visible, unlocked item of the layer into the multi-selection (`addMulti`), Move tool |
   | `Ellenőrzés…` | run `stkCheck` for this role only, list the issues (05c `openModal` pattern, like `help.issues`) |
   | `Helyiség-igények…` | sys:* roles: the 05t needs table filtered to this role |
   | `🗑 Tartalom törlése… (n elem)` | (4) |
   | (construct role / L0) `📐 Falak finomítása ezen a rétegen…` | G2's entry point — leave the slot if G2 is not built |
3. **Info dialog** `rliDialog(roleKey)`: title = icon + role name, a colour chip (`STK_COL`); then
   - **Mire való** — `RLI_TEXT[k].cel`;
   - **Eszköztípusok** — live from `EP_CAT.filter(e=>e.role===k)`: code, name, variants (name,
     default height `h` and `mount`), so it can never drift from the catalogue; for phase-1 roles a
     fixed list (construct: the categories in `STK_ROLES[].cats`; hw: `HW_TYPES`; base: the three units);
   - **Hol és mennyi** — `RLI_TEXT[k].hol`, followed by **this project's count**: per room, how many
     endpoints of this role it has vs what its needs ask (`needOf`) — e.g. `R03 Konyha · 4 / 5`;
   - **Mivel klaszterezhető** — `RLI_TEXT[k].klaszter`.
   Text table `RLI_TEXT` from MATERIAL §2 goes into a **new module `src/13-role-info.js`** (data
   only, loads after 12-boot — every use is inside a function, so the late load is safe; add a
   `window.RLI_TEXT` hook at its bottom and a row to `docs/ARCHITECTURE.md`'s module table). If M1 is
   not built, `sys:DED/SOC/LIGHT` rows are simply unused.
4. **Delete contents** `rliClear(layerId)`: count everything with `layer===L.id` across `UKEYS`
   collections **and** walls (`WALLS[*]`); `confirm('<n> elem törlése a(z) „<név>” rétegről? A réteg
   megmarad. (Visszavonható)')`; one unscoped `pushUndo()`; remove; `pruneLinks()`; wall SNAPs
   recomputed; the circuits' member lists pruned of deleted device ids; `draw()`. The layer itself,
   its role and its stack stay. Q-S02: locked layers refuse with the lock message (A) or unlock-and-ask (B).
5. Register `layer.info` (`Réteg infó`, runs for the active layer) and `layer.clear`
   (`Réteg tartalmának törlése…`) in the registry, so Ctrl+K reaches both.

## Tests — `tests/spec-67-layer-menu.js`
1. `lyrLayerMenu` on a stack role layer → items include Info and Tartalom törlése with the right count;
   on a plain layer → no stack items.
2. `rliClear` on a layer with 3 devices, 1 path, 1 wall, 1 note → all gone, layer present, circuits'
   `members` no longer list the devices; one `doUndo()` → all back, deep-equal.
3. Locked layer → nothing deleted.
4. `rliDialog('sys:SENSOR')` HTML contains every `EP_CAT` sys:SENSOR code and the `RLI_TEXT` purpose.
5. Every `STK_ROLES` key has an `RLI_TEXT` entry (guards future roles).
