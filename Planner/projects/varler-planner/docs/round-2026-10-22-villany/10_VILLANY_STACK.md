# 10 — Villany Stack: work packages V1–V8

Anchors are on `main` as of 2026-10-22 (after `2f08529`). Recommended answers from `DECISIONS.md` are assumed;
where a WP depends on an open question it says so.

## V1 — stack kind in the model (05m-stack.js)

- Stack record: `{…, kind:'elec'|'bridge'}`. `stkCreate(opts)` reads `opts.kind`, **default `'bridge'`** (keeps
  every existing test and saved plan as it is; no migration needed — the field is already written as `'bridge'`).
- `STK_ROLES` entries gain `kinds:['elec','bridge']` (absent = `['bridge']`), and optionally `ne:'…'` = the name
  in an elec stack. Helpers: `stkKindOf(S)`, `stkRolesOf(kind)`, `stkRoleName(k,kind)`.
- `stkCreate` builds layers from `stkRolesOf(kind)` instead of `STK_ROLES`: phase 1 = every role of the kind
  without `opt`; phase 2 = `opts.roles` or every non-`off` phase-2 role **of the kind**.
- `stkShort(S)` → `V1`, `V2`… for elec stacks (layer names read `V1 · Dugaljak`), `B1`… unchanged for BRIDGE.
- Roles for elec (`kinds` includes `'elec'`): `construct`, `mark`, `need` (opt), `exist` (new), `hw` (name
  *Betáplálás és elosztás*, Q-V02 A), `sys:DED`, `sys:SOC`, `sys:LIGHT`, `sys:WEAK` (new), `sys:BOND` (new, off),
  `sys:SMARTREADY` (new, off), `route` (new), `sys:CINEMA` (opt, 08r keeps adding it on demand). Kültér per Q-V05.
  `need` and `sys:CINEMA` are spliced into `STK_ROLES` by 08q:19 and 08r:17 — their entries get `kinds` there.
- New colours / icons / print entries (STK_COL, STK_ICONS, STK_PRINT — pick free L* slots in the grey-safe table):
  `exist` grey-brown, `sys:WEAK` teal-blue, `sys:BOND` green-yellow (the PE colour), `sys:SMARTREADY` muted violet,
  `route` the Csatorna lilac family.
- Tests: new `spec-108-villany-stack.js` — kinds, role sets per kind, names, default kind = bridge, old plan loads.

## V2 — wizard and the workflow bar

- `stkWizard()`: first row *Típus* — **Villany** (default) · BRIDGE (okosotthon). The phase-2 checkbox list and the
  explanatory footnote re-render on change. Title becomes *Új stack*.
- `wfStack()` (08k-wf-bar.js:20) creates `{kind:'elec', name:'Villany'}`. The action label/hint at 08k:50 drops
  "BRIDGE stack". Existing BRIDGE stacks are still found and used as before.
- Action `stack.create` label: *Új stack…*; hint names both kinds.
- ⏸ look: the wizard on CLA.

## V3 — Meglévő / bontás (`exist`)

- Any device or path on the `exist` layer carries `ex:'keep'|'remove'|'replace'` (default `keep`). RCO on an item:
  *Megmarad · Bontandó · Cserélendő*. Placement uses the ordinary endpoint tools (any code).
- Render (scene, both plan and Wall View): keep = 50 % grey, remove = red diagonal cross over the symbol / dashed
  red path, replace = orange outline. Computed colours, verified by computed style in the browser (repo rule).
- *Bontási terv*: RCO on the layer → solo + print palette + legend (`prnLegendSvg` gets the three states).
- Totals (05-totals): Q-V04 A — `keep`/`remove` never material; `remove` and `replace` give a *Bontás* labour row
  per code; `replace` also counts as new material.
- Check: a `replace` item with no new item of the same code within 300 mm on a design layer → info.

## V4 — Gyengeáram (`sys:WEAK`)

- The layer accepts endpoints whose catalogue entry lists `sys:WEAK` in a new field `alt:[…]` (an endpoint keeps
  its own `role`, which is its purpose and its BRIDGE target). `epOfRole('sys:WEAK')` returns those entries.
- Entries: existing **ETH** (adataljzat), **SMK** (füstérzékelő), **DBL** (kaputelefon / csengő), **SCR** / **AVP**;
  new **TVA** TV/SAT aljzat (role `sys:MEDIA`, h 300), **BEL** csengőnyomó (role `sys:SECURITY`, h 1300),
  **ICM** kaputelefon beltéri egység (role `sys:SECURITY`, h 1500). ⏸ list review with the user.
- `epRoleOf(d)` stays the purpose → symbol colour by purpose (Q-V01 A); the layer row and legend header show the
  Gyengeáram colour.
- Fill / conduit family: by purpose (`fam` of the endpoint's role), so weak current never shares a conduit with
  MAINS — the existing rule, unchanged.
- Room needs (05t `NEED_DEFAULTS`): living room TVA + ETH, bedroom TVA, hall BEL + ICM, every room SMK — as
  suggestions, through the Igények layer when present.

## V5 — EPH and Okos előkészítés

- `sys:BOND` endpoints: **EPB** EPH-csatlakozás (pipe / bath / metal frame, h per object), **PEB** helyi EPH
  sín. Check: a bathroom room (kind) with no EPB → warn.
- `sys:SMARTREADY` endpoints: **NUT** nullás kapcsolódoboz (marks an SWI box as neutral-carrying), **DPB** mély
  doboz, **RSV** tartalék védőcső-végpont. On promotion they stay; in BRIDGE they read as provisioned endpoints
  (same idea as `sys:EXTRA`).
- Kültér: Q-V05 B — a room kind *kültér* (00-core room kinds) giving the IP44 variant of SOC / LMP / SWI by default.

## V6 — route layer and the engine

- New role `route` (ph 2, cats `['path']`, groups `['Csatorna','Feltöltés']`).
- 08ob-wf-engine.js:153 `lay(k)`: in an elec stack `channel` and `arm` both resolve to `route`; the board stays on
  `hw`. Junction boxes (`box`) keep going to `sys:SOC` as today.
- The Csatorna / ARM drawing tools (05r `chnToolStart`, 05u `armToolStart`, 06a `railToolStart`) target `route`
  when the stack is elec; their `when` conditions accept it.
- Every `stkLayer(S.id,'channel'|'arm')` call gets the elec fallback — on 2026-10-22: 05r-channel.js:86,
  05u-arms.js:24 and :113, 06a-portals.js:125, 08ob-wf-engine.js:153. Best as one helper `vstPathLayer(S,k)`.
  Fill (05w:69) walks the `sys:*` roles of the stack and needs no change.

## V7 — Áramkörök és védelem stage

- A rail stage `stk:circuits` shown only in elec stacks, after `route`. Not a layer: `stkStages` gets one synthetic
  entry. Its inspector groups: the existing 05j circuit actions, the 05x cabinet view, the board schedule.
- Check (`STK_CHECKS['stk:circuits']`): a SOC/LIGHT/DED endpoint in no circuit → warn; a wet-room circuit with no
  30 mA RCD → error.

## V8 — one-click promotion to BRIDGE

- Stack menu (`stkMenu`) and action `stack.promote`: *Bővítés BRIDGE Stackké* — elec stacks only. One undo step.
1. `S.kind='bridge'`, `stkShort` letters change (`V1` → `B1` in layer names that still carry the prefix).
2. Add the missing BRIDGE phase-1 roles (`base`, `channel`) and the default phase-2 roles, in `STK_ROLES` order.
3. `sys:WEAK` → devices move by `role` to their BRIDGE layer (Q-V07 A, the `stkMigrateRoles` pattern); empty → removed.
4. `route` → paths split by kind (Q-V06 A); boxes stay.
5. `exist`, `sys:BOND`, `sys:SMARTREADY`, `hw`, the three mains layers: untouched.
- Tests in spec-108: a plan with one item on every elec layer → promote → every item on the expected layer, ids
  unchanged, Ctrl+Z restores the elec stack byte-identically.
- ⏸ try it on a real plan with the user.

## Not in this round

- Demotion BRIDGE → Villany.
- Automatic cable sizing / voltage-drop calculation (the V7 stage only reads what 05j already has).
- Lightning protection (villámvédelem) — a later `sys:LPS` role if wanted.
