# WP-C5 — Channel pathway topology between hardware nodes

Status: todo · Wave C · Depends: C1, C4 · Size: M (~250 lines) · Builder: mid tier
Decisions: Q25=A · Q37

## Goal
*"Using a variant of the Path tool, we create geometry-based connections between any two points of
hardware nodes … each is just a single path, representing the physical connection (of any kind) …
contents are sorted by the next steps … multiple pathways between two points on different routes if
needed. Every path connecting two nodes can be set a general rule of flush mounted or cable trunking."*
What a route carries is **derived from the pair of node types** [Q25=A] (`CHN_CARRIERS`), overridable.
This is also wiring-pipeline slice S2's "explicit route-end links", for the stack.

## Read (only these)
- `01_CATALOGUES.md §10` (`CHN_CARRIERS`, `CHN_BUNDLE`)
- `src/08-interaction.js` `function finishPath` (l.~473, 6 lines) and where `pathDraft` is created
  (`grep -n "pathDraft={" src/08-interaction.js`)
- `src/05k-room-auto.js` lines 266–285 (`devAtBase`, `placeSnapAt`) — node-on-device snapping and linking
- `src/02-state.js` `const BUILDS` (sull_gege / kv_csat_szeles keys)
- `src/05p-hardware.js` (`HW_TYPES`, `hwServes`)

## Build — `05r-channel.js` (prefix `chn`)

### 1. Tool
`CHN_T={on:false, rule:'sull'}`. Action `chn.route` (group `Csatorna`, `Csatorna-útvonal`, icon `⇋`):
sets `state.activeLayer` = the stack's channel layer, `setMode('path')`, `CHN_T.on=true`,
`state.pathType = rule==='csat'?'csat':'gege'`. `Tab` while drawing flips the rule (HUD
`Süllyesztett` / `Kábelcsatorna`). Leaving path mode or `Esc` clears `CHN_T.on`.
Node snapping on devices already exists (`placeSnapAt` → `p.dev` → `linkMarkedNodes`); hardware
devices are devices, so ends link with no new snapping code — **verify** with a test.

Hook list for routes finished by the path tool (E1 uses it too):
```js
const CHN_PATH_HOOKS=[];
function chnPathFinished(p){CHN_PATH_HOOKS.forEach(f=>{try{f(p);}catch(_){}});}
```
`08-interaction.js` `finishPath`: after `data.paths.push(pathDraft);linkMarkedNodes(pathDraft);` add
`if(typeof chnPathFinished==='function')chnPathFinished(pathDraft);`.
Own hook: when `CHN_T.on` → `p.route='channel'`, `p.rule=CHN_T.rule`, every section's `build` =
`'sull_gege'` or `'kv_csat_szeles'`, `p.color` = carrier colour (below) once ends are known.

### 2. Derived
```js
chnRoutes()          // data.paths with route==='channel'
chnEnds(p)           // [devA, devB]: hardware devices linked (devLinks) to the first and the last node; null per missing end
chnCarrier(p)        // p.carrier || CHN_CARRIERS match on the two types (order-free) → k, else 'ismeretlen'
chnOrder(d)          // naming rank: meter 0, entry 1, board 2, base 3, ssc 4, rbx 5 (then by ref)
chnName(p)           // '<refA>~<refB>' lower rank first; the 2nd, 3rd … route between the same pair gets
                     // '/b', '/c' by route id order (wiring pipeline decision 7)
chnGraph()           // {nodes: hw device ids, edges:[{a,b,p,carrier,len}]}; len = Σ 3D section lengths
chnTree()            // BFS from BASE devices over carrier 'channel' edges → {<rbxId>:{parent, hops, len}}
chnLenToBase(rbxId)  // chnTree()[id].len or null — read by C4's cat6a rule
chnChain(rbxId)      // 'direct' (parent is a BASE) | 'chained' (parent is an RBX) | null (unreached)
```
Carrier colours: channel `#2f6fb0` · mains `#d1493f` · panel `#7a5cc0` · security `#555555` ·
feed `#8a3a2a` · isp `#16a085` · data `#16a085`.

### 3. Drawing
Routes draw as ordinary paths (they are). Add via `STK_OVERLAY` while the channel stage is active or
`state.chnLabels`: the name and carrier at each route's longest segment midpoint, 9 px haloed.

### 4. Right-click on a channel route (`STK_CTX`)
`Szabály: süllyesztett` · `Szabály: kábelcsatorna` · `Hordozó: automatikus` + one `Hordozó: <n>` per
distinct carrier · `Tartalom megjelenítése` (HUD/modal: for `channel` the CHN_BUNDLE lines C1…C5;
others: `A tartalmat a Feltöltés (E4) számolja.`) · `Törlés`.

### 5. Checks — `STK_CHECKS.channel`
`warn` a channel route with an end not on a hardware device (`'Nyitott végű csatorna: <név>'`) ·
`warn` an RBX not reached from a BASE over `channel` routes · `warn` an RBX with no `mains` route
from a board · `info` no `feed` (meter→board) · `info` no `isp` (entry→NET BASE) ·
`error` (via C4 rule) a reached RBX with `chnLenToBase` > 90 000 mm ·
`info` an RBX chained behind another whose class is not RB-H (STD-001: a chain node carrying
another room's pass-through is RB-H) [Q37].

## Tests — `tests/spec-44-channel.js`
Fixture: board, BASE, two RBX (R1 near, R2 far), SSC; routes drawn with the path tool helpers.
1. A route from BASE to R1 with snapped ends: both links exist, `route==='channel'`, `chnCarrier==='channel'`.
2. Board→R1: carrier `mains`; R1→R2: `channel` and `chnChain(R2)==='chained'`, `chnChain(R1)==='direct'`.
3. A second BASE→R1 route is named `…/b`; names put the board/BASE side first.
4. Override carrier to `data` sticks; `auto` restores the derived one.
5. `chnLenToBase(R2)` = len(BASE→R1) + len(R1→R2) (±1 mm).
6. Checks: removing R1→R2 → R2 "not reached" warn; an open-ended route → warn.
7. `Tab` flips the rule; sections' `build` follow (`sull_gege` ↔ `kv_csat_szeles`).

## Golden
Identical (no new drawing for ordinary paths; the hook only acts when `CHN_T.on`).

## Browser-only checks (for the human)
Drawing a route feels exactly like the Path tool · labels readable · Tab does not break typing.

## Verifier focus
`finishPath` hook placed AFTER `linkMarkedNodes` (links must exist when the hook reads ends).
`CHN_T.on` reset on every mode change. No change to ordinary path drawing (golden + spec-04/spec-30).

## Out of scope
What cables/conduits each route gets (E4). The ARM routes inside rooms (E1).
