# WP-D4 — Circuits and control groups inside the stack

Status: todo · Wave D · Depends: D1 · Size: M (~200 lines) · Builder: mid tier
Decisions: Q29 · Q31=A

## Goal
*"Add an option to select devices as path endpoints with a dedicated circuit (the string-connected
power socket line and the switch–lamp wiring logic from NV4)."*
Two groupings feed the fill (E3):
- **circuits** (`data.circuits`, 05j — already built): a socket string = a multi-point circuit; a big
  load = a dedicated circuit. Reused as is.
- **control groups** (new, BRIDGE mode): which lamps a switch controls. In BRIDGE the switch is an
  **input** to the RoomBox's bistable and each lamp group is an **output** — there is **no wire from
  switch to lamp**; NV4's 101/105 wiring schemes apply only to a conventional (non-BRIDGE) plan, which is
  wiring-pipeline slice S6 and out of scope here [Q29].

## Read (only these)
- `src/05j-circuits.js` lines 1–110 (record, `cktList`, `cktCreate`, `cktAssign`, `cktOfDevice`,
  pick mode `cktPickStart/Stop/Toggle`, `cktRingSvg`)
- `src/05s-endpoints.js` (`epEntry`, `epCables`) · `src/05m-stack.js` (`STK_GROUPS`, `STK_TOOLS`, `STK_CTX`)

## Build — `05s-endpoints.js`

### 1. Circuits in the MAINS stage
`STK_GROUPS['+sys:MAINS']=['Áramkör','Vezérlés']` — 05j's actions (group `Áramkör`) then appear in
the MAINS stage with no other change. Defaults applied by the fill (E3), not stored:
- a SOC in no circuit → the room's **implicit socket circuit** (one per room, `'<szám> dugalj'`);
- a DED → always its own dedicated circuit (implicit when the user made none);
- LMP/LNR → the RBX's lighting circuit (`ELO_RULES.lightPerRbx`, one per RBX) — not a 05j record.
```js
epCircuitOf(d)        // 05j circuit id, or an implicit key: 'room:<roomId>:SOC' | 'ded:<devId>' | 'light:<rbxId>'
epCircuits(roomId)    // [{key, name, members:[devIds], dedicated, mcb?, implicit:bool}] for MAINS endpoints in the room
```

### 2. Control groups (BRIDGE)
Field on a SWI device: `d.ctl=[lampDeviceIds]` (LMP, LNR, SHU allowed).
- Pick mode `epCtlPick(sw)` (`STK_TOOLS` `{k:'epCtl'}`): started by RCO `Mit vezérel?…` on a switch or
  action `ep.ctl` (group `Vezérlés`, `Kapcsoló → lámpák`); clicking a lamp toggles it in `ctl`;
  overlay draws dashed lines switch → each controlled device; Enter/Esc ends. `pushUndo(['devices'])` once.
- A lamp may be in several switches' `ctl` (two-way control is just two inputs on one output — no
  105/107 wiring in BRIDGE).
```js
epLampGroups(roomId)  // output groups: lamps grouped by the identical SET of switches controlling them;
                      // lamps no switch controls → one group each. Deterministic order (min device id).
epGroupsFor(roomId,role)  // THE input for E3: [{key, code, topo, members:[devIds], from}] —
                      // chain-topology codes grouped (SOC by epCircuitOf, LMP by epLampGroups,
                      // ACT/KNX one group per room); star codes one group per device
```

### 3. Drawing
Circuit rings already come from `cktRingSvg`. Control lines: only in the pick mode and when a switch
is selected (overlay), 1 px dashed, `#d1493f`.

### 4. Checks — `STK_CHECKS['sys:MAINS']`
`info` SWI with empty `ctl` (`'<ref>: nem vezérel semmit'`) · `info` LMP no switch controls ·
`warn` a dedicated 05j circuit with more than one member.

## Tests — `tests/spec-48-stack-circuits.js`
1. Room with 3 SOC, none in a circuit → `epCircuits` has one implicit `room:<id>:SOC` with 3 members;
   after `cktCreate`+`cktAssign` of two of them → one real circuit (2) + implicit (1).
2. A DED → `ded:<id>` implicit dedicated circuit.
3. Pick mode: SWI1 → L1, L2; SWI2 → L2 → `epLampGroups` = `[[L1],[L2]]` (different switch sets);
   SWI2 → L1 too → `[[L1,L2]]`.
4. `epGroupsFor(room,'sys:MAINS')`: SOC group topo `chain`, LMP groups `chain`, SWI one star group per switch, DED `from:'board'`.
5. `epGroupsFor(room,'sys:SENSOR')`: every SEN alone (`star`).
6. Undo removes a `ctl` edit.

## Golden
Identical.

## Browser-only checks (for the human)
Pick mode feels like the K circuit pick (same gestures).

## Verifier focus
Determinism of group order. `ctl` cleaned when a lamp is deleted (`pruneLinks`-style tidy in a
`VALIDATORS` warn is enough for v1 — say which you did).

## Out of scope
Conventional switch schemes (wiring pipeline S6). MCB sizing (E5).
