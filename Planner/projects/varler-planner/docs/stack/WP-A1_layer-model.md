# WP-A1 — Layer model v2 + schema seed

Status: todo · Wave A · Depends: — · Size: M (~200 new lines, ~40 edited) · Builder: mid tier
Decisions: Q02=A · Q03=A

## Goal
Replace the six sub-layer categories with the sixteen of `01_CATALOGUES §1`, add per-sub-layer
opacity, make layer edits undoable, and seed every collection and global the rest of the pack
needs — so later WPs never touch the save/undo plumbing again. **Nothing visible changes in a
project without new data**: golden must stay identical except the 6 `/session` hashes.

## Read (only these)
- `src/02-state.js` lines 1–30 · `src/02-state.js` ~l.174 (`const data=`)
- `grep -n "layerShows(" src/*.js` — 21 call sites; open each with a 10-line window
- `src/11-controls.js` lines 120–165 (`UKEYS`, `snap_`, `applySnap`, `pushUndo`) and 186–196 (export/import)
- `src/12-boot.js`: `function renderLayers`, `$('addLayer').onclick`, `function hardResetWorkspace`,
  `function applyProjectData`, `function sessionObj`
- `src/01-schema.js` lines 18–40 (`IDPRE`, `ensureIds`)
- `src/05j-circuits.js` lines 1–30 (module header, `cktList()` pattern)

## Build

### 1. `02-state.js` — above `let layers=`
Paste `LAYER_CATS`, `LAYER_CATS_V1`, `layerCatsAll()` from `01_CATALOGUES §1`. Change the default
layer literal to `cats:layerCatsAll()`. Add `let stacks=[];` right after `let layers=…`.
Make `layerShows` category-tolerant (keeps every old caller working):
```js
function layerShows(item,cat){const L=layerById((item&&item.layer)||'L0');cat=lyrCat(item,cat);
  return L.visible&&(L.cats[cat]!==false);}
```

### 2. New module `src/05l-layers.js` (prefix `lyr`)
```js
lyrDevCat(d)            // §1 table: socket/switch/light → itself; ep: LMP,LNR→light, SWI→switch, SOC→socket; else 'device'
lyrCat(item,cat)        // legacy names → v2: 'device'→lyrDevCat(item) (only when item.type exists);
                        // 'build'→ item.type if it is door|window|stairs, else 'floor' if item.poly, else 'roof'.
                        // any other cat is returned unchanged
lyrCatOf(coll,rec)      // §1 "Item → category" table; coll 'walls' for a wall rect
lyrMigrate(L)           // idempotent. v1 keys device/build expand via LAYER_CATS_V1 (each new key takes the
                        // old value), old keys deleted, every LAYER_CATS key present (missing → true).
                        // L.op: keep only known cats, value = round to 0.1, clamp 0.1…1, delete keys equal to 1;
                        // delete L.op when empty. Returns L.
lyrMigrateAll()         // layers.forEach(lyrMigrate)
lyrOp(item,cat)         // number 0.1…1 — layer op for the normalised cat; 1 when absent
lyrOpAttr(item,cat)     // '' when lyrOp===1, else ` opacity="0.6"` (one decimal)
lyrWrap(item,cat,svg)   // svg unchanged when lyrOp===1, else `<g opacity="0.6">`+svg+`</g>`
lyrSetOp(layerId,cat,v) // clamp/round as above, delete at 1, then draw()
lyrPushUndo()           // pushUndo(['__walls','__layers'])
```
Do **not** add getters for the new collections — their owner WPs do (`mrkList` B2, `trcList` B4,
`afillRuns` E3). This WP only seeds the arrays (§3).
End with the test-hooks block: `window.LAYER_CATS=LAYER_CATS` plus every function above.

### 3. Seed — edits at anchors
| file | anchor | edit |
|---|---|---|
| `02-state.js` | `const data={…circuits:[],` | add `marks:[],traces:[],runs:[],` |
| `11-controls.js` | `const UKEYS=[` | append `'marks','traces','runs'` |
| `01-schema.js` | `const IDPRE={` | add `marks:'J',traces:'T',runs:'H'` |
| `12-boot.js` | `sessionObj` return literal | add `stacks` after `layers` |
| `12-boot.js` | `applyProjectData`, line `layers=o.layers\|\|[…]` | default literal uses `cats:layerCatsAll()`; then `stacks=o.stacks\|\|[];lyrMigrateAll();` |
| `12-boot.js` | `$('addLayer').onclick` | `cats:layerCatsAll()` |
| `11-controls.js` | export (`download('villanyterv.json'…`) | add `stacks` next to `layers` |
| `11-controls.js` | import (`if(o.layers)layers=o.layers;`) | add `stacks=o.stacks\|\|[];lyrMigrateAll();` |
| `12-boot.js` | `hardResetWorkspace` | add `stacks=[];` (layers are reset by applyProjectData — leave that) |

### 4. Undo — `11-controls.js` `snap_` / `applySnap`
```js
function snap_(scope){ensureIds(data);
  const sc=(scope&&scope.length)?scope:null, ks=sc?sc.filter(k=>UKEYS.indexOf(k)>=0):[];
  const keys=ks.length?ks:UKEYS;
  const o=keys.reduce((o,k)=>(o[k]=data[k],o),{});
  o.__scope=sc?sc.slice():null;                                 // markers kept → redo is symmetric
  if(!sc||sc.indexOf('__walls')>=0){o.__walls={};for(const l of ORD)o.__walls[l]=WALLS[l]||[];}
  if(sc&&sc.indexOf('__layers')>=0)o.__layers={layers,stacks};  // opt-in only — see CONTRACT §3.1
  o.__noteHide=data.noteHide||{};o.__seq=data.seq||0;o.__v=data.v||SCHEMA_VERSION;
  return JSON.parse(JSON.stringify(o));}
```
In `applySnap`: `const ks=(sn.__scope||UKEYS).filter(k=>UKEYS.indexOf(k)>=0),keys=ks.length?ks:UKEYS;`
and after the walls line:
`if(sn.__layers){layers=sn.__layers.layers;stacks=sn.__layers.stacks||[];if(typeof renderLayers==='function')renderLayers();}`
**Check:** an existing scoped entry such as `['paths']` must behave exactly as before (keys
`['paths']`, no walls) — the spec asserts it.

### 5. Opacity at the draw sites
For every `layerShows(X,cat)` call that **emits scene SVG** in `04-render.js`, `06-wall-editor.js`,
`07-plane-editor.js`, `10b-notes.js`: wrap the string that item appends with
`lyrWrap(X,cat,…)` (or add `lyrOpAttr(X,cat)` to its outermost element when wrapping would break
a `<clipPath>`/`<defs>` structure). `05k-room-auto.js` uses `layerShows` for logic only — leave it.
**Iso 3D walls** go through the depth-sorted face list: if a face record can take a multiplier
cleanly (`f.op`), multiply it; if not, skip iso walls and say so in the report — plan, blueprint,
Wall View and Plane View must honour opacity.

## Tests — `tests/spec-32-layer-model.js`
1. `LAYER_CATS` has 16 entries in the §1 order; `layerCatsAll()` has all 16 true.
2. A v1 layer `{cats:{path:true,device:false,cable:true,wall:true,build:false,object:true}}` migrates
   to socket/switch/light/device = false, door/window/stairs/floor/roof = false, the rest true; no
   `device`/`build` v1 keys remain except `device` as the v2 key; running `lyrMigrate` twice = same JSON.
3. `layerShows(socketDev,'device')` follows `cats.socket`, not `cats.device`; `layerShows(door,'build')`
   follows `cats.door`; `layerShows(floorRec,'build')` follows `cats.floor`.
4. `lyrDevCat`: socket→socket, junction→device, board→device, `{type:'ep',code:'LNR'}`→light.
5. `lyrSetOp(L0,'socket',0.55)` stores 0.6; `0.04` stores 0.1; `1` deletes the key; `lyrOpAttr` gives
   `' opacity="0.6"'` then `''`.
6. With op 0.6 on sockets, the scene SVG of a one-socket project contains `opacity="0.6"` once; at 1
   the scene string equals the string before `lyrSetOp` (byte-identical).
7. `UKEYS` contains marks/traces/runs; `IDPRE` gives J/T/H; a blank project has the three arrays empty;
   `ensureIds` gives a pushed mark the id `J<n>`.
8. `sessionObj()` carries `stacks:[]`; `applyProjectData` of a session without `stacks` yields `[]`.
9. Undo: rename a layer after `lyrPushUndo()`, `doUndo()` restores the name; `doRedo()` re-applies it.
10. Undo isolation: `pushUndo(['devices'])`, move a device, toggle `layers[0].visible=false`,
    `doUndo()` → device back AND `visible` still false.
11. Scoped entry unchanged: `pushUndo(['paths'])` snapshot has no `__walls` and no `__layers`.

## Golden
Must be identical except the six `/session` renders (new keys). Run `--golden-update` once and list
the six names in the report. Any other `CHANGED` line is a defect.

## Browser-only checks (for the human)
Old project opens with every layer button state preserved · opacity 60 % on Dugaljak visibly fades
sockets in plan and in Wall View.

## Verifier focus
TDZ: `LAYER_CATS` must be above `let layers`. Redo symmetry with markers. That `applySnap` never
writes `data['__walls']` or `data['__layers']`. That no call site lost its `layerShows` guard.

## Out of scope
The panel UI (WP-A2), swap/move/duplicate/merge (A2/A3), stacks behaviour (B1).
