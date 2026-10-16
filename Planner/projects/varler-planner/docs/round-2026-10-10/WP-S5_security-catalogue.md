# WP-S5 — Security layer: Home Assistant / ESPHome device types

Status: todo · Wave S · Depends: — (S1 shows the result) · Size: M (~150 lines, mostly data + icons) ·
Spec: 71 · Answers: S01 = two tiers (Alap = mixed default, Prémium = star) · S06 = A · S07 = B (KPD
and the HMI panel's entry variant both stay)

## Goal
*"Fill up the Security layer's possible device types to use them for another purpose: a Home
Assistant based home security system — based on ESPHome solutions, and security-focused smart devices
that cover our basics (location preference given by the original Sec layer)."*

## Spec
**MATERIAL §3** — the 10 new codes (MOT DWC GLB SRN KPD PNC LCK SMK COA DBL) with variants, cables,
heights, the topology choice, the `NEED_DEFAULTS` and `needDerived` additions, the placement hints,
and the CoreRef grounding. The existing `SEC` code stays (third-party systems).

## Build
1. Append the §3 block to `EP_CAT` (05s, after `SEC`). `new:true` marks codes STD-004 does not have
   yet (the Q36 finding of the stack round — list the 10 new codes in the report so the user can add
   them to STD-004).
2. **Empty cable lists** (battery Zigbee / Thread variants): make `cab:[]` legal everywhere —
   grep the users of `.cab` (05s, 05w fill, 05t needs, 05z symbols); a variant with no cable produces
   no run and no conduit, and the endpoint still counts as placed for the room needs.
3. **Symbols** (05z): one mark per new code on the existing security body — short, legible at screen
   tier: MOT a fan of 3 rays · DWC two bars (reed + magnet) · GLB a cracked pane · SRN a horn · KPD a
   3×3 dot grid · PNC "!" · LCK a padlock · SMK a ring with 3 dots · COA "CO" · DBL a bell. Spec-57
   protects the symbol set — extend it with the new codes.
4. `NEED_DEFAULTS` and `needDerived` (05t) exactly as §3.
5. Placement suggestions (05t `sug*`): DWC on the opening frame top, latch side (`sugDoorPt`); KPD
   inside the entrance, latch side, 1450; MOT in the corner covering the most doors; SRN kul outer face
   at 2800.
6. The Info text for `sys:SECURITY` (S1's `RLI_TEXT`) is already written for this catalogue.
7. **Tiers** (answer S01): `S.secTier` `'alap'` (default) / `'premium'` on the stack record (undo with
   `__layers`, like other stack settings); `epFromOf(entry, d)` per the MATERIAL §3 table — every
   place that reads `entry.from` for a SECURITY code (05w fill, 05t suggestions) calls it instead.
   The select lives in the Security layer's Info dialog (S1) and in the SSC inspector.
8. **SSC** (Q-S06): the SSC hardware node (`HW_DEF.ssc`) gets a `kind`: `'ha'` (ESPHome riasztó-
   csomópont: Ethernet, akku, opcionális GSM — default) or `'3p'` (third-party panel). Label and Info
   only; no new geometry.

## Tests — `tests/spec-71-security.js`
1. `epEntry('MOT','sys:SECURITY').vars.length===4`; every new code has a role, `from`, `h` or
   `mount:'ceiling'`, and every cable code it uses exists in the 05w cable table.
2. A room of kind `eloszoba` → needs `['DWC','KPD','SRN','MOT']` on sys:SECURITY.
3. A door tagged `bejarat` → derived `DWC`, `KPD`, `DBL`.
4. A DWC `zb` endpoint: the fill creates no run for it and raises no `fill.unreached`.
5. Symbols: each new code renders a non-empty, distinct symbol string.
6. Tier: a MOT in R06 with no `secTier` → its run starts at the room's RBX; `secTier='premium'` → at
   the SSC; a DWC starts at the SSC in both.

## Verifier focus
Life-safety wording (SMK / COA: certified standalone first — never imply the ESPHome node is the
alarm); `from:'ssc'` endpoints with no SSC placed produce the honest `fill.unreached` (not a crash).
