# WP-S3 — Menu tree, generators, new actions

**Goal (user):** "every feature integrated to branch out as sub menus."

**Read:**
- 02_MENU-TREE in full (it is the spec);
- `src/08k-wf-bar.js:17-28` (`WF_PHASES`, the room-type button text, `wfLayer`);
- `src/08i-wf-rules.js:21-42` (`RB_PRESETS`) and `:69` (`rbPick`);
- `src/05s-endpoints.js`: search for `epEntry` and the `ep.place.` registration loop, to see how roles are known;
- `src/05l-layers.js:143` (`layers`, `lyrLayer`), `renderLayers`;
- `src/12-boot.js:212`, `:236` (`loadProjIndex`, `loadProject`).

## Build (in `src/11u-sm-tree.js`)

1. **NEW actions** (registered here, group in brackets). **Update 2026-10-15:** wf.roomType, wf.stairs and
   wf.layer.SOC / LIGHT / DED already exist (src/05db-layout.js, the main session's T3), so register only the
   `wf.rule.<k>` ones; the spec still checks that all of them resolve. Each `run` calls only the public function named in
   02_MENU-TREE §2:
   - `wf.roomType` (Helyiség);
   - `wf.stairs` (Nyílászáró);
   - `wf.layer.SOC`, `wf.layer.LIGHT`, `wf.layer.DED` (Készülék; labels: `Dugaljak réteg`, `Lámpák + kapcsolók réteg`,
     `Dedikált réteg`);
   - `wf.rule.<k>` ×20 (Véset; label = the preset's `n`; `run:()=>rbPick(k)`).

   `ui.normal` already exists (S0).
2. **`SM_TREE`** exactly as §2. Root order: Épület, Villamosság, Eszközök, Rendszer.
   - Leaves carry `kind` from the Kind column.
   - The icons for submenus: Épület 🧱, Villamosság ⚡, Eszközök 🛠, Rendszer ⚙, Helyiségek ⬚, Nyílászárók 🚪,
     Szabályok 📐, Szintek ☰, Végpontok ◉, Kapcsolás 🔗, Dobozok és körök ▣, Pályák 〰, Nézet 👁, Projekt 📁,
     Kimenet 📄, Beállítások ⚙.
   - Labels are normal case in the source (CSS makes them upper).
3. **Generators**, `SM_GEN.rules|endpoints|layers|projects|other`, per §3.
   - `other` needs **`smReachCurated()`**: walk `SM_TREE`, expanding every generator except `other`, and collect `a`
     ids. Then `other` = `ACTIONS` minus that set, grouped by `group` (a node per group, label = the group, sorted
     hu-HU).
4. **`smReach()`** = `smReachCurated()` ∪ the ids under `other`.

## Tests — `tests/spec-s3-sm-tree.js`

1. Every `a:` in `SM_TREE` resolves with `actionById` (list the missing ones in the fail message).
2. The root slots read `Épület, Villamosság, Eszközök, Rendszer, Bezár`.
3. Épület › Nyílászárók reads `Ajtó, Ablak, Lépcső, Portál, Vissza`.
4. Activating `wf.stairs` → `state.mode==='build'` and `state.buildType==='stairs'`; the menu is closed.
5. `wf.layer.LIGHT` with a stack present → the active layer's role is `sys:LIGHT`, and the menu is **still open**
   (stay).
6. Rules:
   - the sections read `Fal, Nyílászáró, Egyéb területek, Vissza`;
   - Fal has 3 pages with sizes 3 / 3 / 4;
   - `Tilos` is on page 2;
   - activating it gives `RB.on===true`, `RB.preset==='tilos'`, and the menu is closed.
7. Endpoints: every `ep.place.<CODE>` action except the plain `ep.place` appears **exactly once** under Minden végpont.
8. Coverage:
   - `smReach()` ⊇ every `ACTIONS` id;
   - `other` holds ≤ 150 ids; print the count;
   - no rendered level of the real tree, walked to depth 6 including every page, has more than 5 slots.
9. Every row marked *tool* in §2 has `kind:'tool'`. Check it against a literal list of ids copied from §2.
10. Layers: with 3 layers, the generator gives 3 leaves (paged as needed). Activating the 2nd one sets
    `state.activeLayer` to its id.

## Verifier focus

- The NEW actions only call public functions.
- No WF file edited.
- `node tools/check-globals.js --prefix sm` is clean.

## Out of scope

Search (S4); sheets for Szabványok / Szabályok (S7). Until S7, `wf.standards` opens the panel, which simple mode hides —
note it in the report, don't work around it.
