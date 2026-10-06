# WP-B1 — BRIDGE Stack: model, wizard, panel group, stage rail

Status: todo · Wave B · Depends: A1, A2, A3 · Size: L (~320 lines) · Builder: upper-mid tier
Decisions: Q10=A · Q11=A · Q12=A · Q13=A · Q26=A

## Goal
*"A function to create a new BRIDGE Stack — a preset group of layers stacked on top of each other
… the option should allow existing layers to be set as one of the stack layers."*
A stack is **metadata over ordinary layers** [Q10=A]: each stack layer is a normal layer with
`L.stack` and `L.role`; every existing tool keeps working on it. While a stack is active, the left
stage rail shows the stack's steps instead of the general stages [Q11=A].

## Read (only these)
- `01_CATALOGUES.md §2` (STK_ROLES)
- `src/05d-shell.js` lines 1–110 (`STAGES`, `stageByKey`, `setStage`, `renderShell` rail part)
- `src/01-schema.js` `function ensureIds` and `function validate`
- `src/05l-layers.js` (`renderLayers`, `lyrMerge`, `lyrMoveCat`, `lyrPushUndo`)
- `src/10-lamps.js` `function allRooms` (2 lines)

## Build

### 1. `05m-stack.js` — model
Paste `STK_ROLES`. Record (CONTRACT §3.1): `{id, name, kind:'bridge', scale:'S-C', layers:[…], phase}`.
```js
stkById(id) · stkOfLayer(layerId) · stkActive()        // stkActive = stack of state.activeLayer, else state.stack's
stkLayer(stackId,roleKey)  // the layer record with that role, or null
stkRole(k)                 // STK_ROLES entry
stkCreate(opts)            // see wizard; returns the stack. lyrPushUndo() first
stkAdopt(stackId,roleKey,layerIds,{merge})  // existing layers take a role [Q12=A: reference, not copy]
                           // several ids + merge → lyrMerge into the first, then reference it
stkDissolve(id)            // remove the stack record and L.stack/L.role; layers and items stay
stkRoomId(entry)           // entry from allRooms(): entry.rm.id (ensureIds guarantees one)
stkRooms(level)            // allRooms(level) mapped to {id,name,num,kind,poly,rm}
```
New layers are named `<stack short> · <role n>`, short = `'B'+(index+1)` (B1, B2…).
Roles with `off:true` (KNX) are created only when ticked. Stack layers are inserted into `layers`
as one contiguous block in `STK_ROLES` order, after the last existing layer.

### 2. Room ids — `01-schema.js` `ensureIds`
After the walls loop add the same for building rooms: `for(const l of ORD)(ROOMSB[l]||[]).forEach(rm=>{if(rm&&!rm.id)rm.id=next('Y');});`
and include them in the `seq` max scan (mirror the walls line above it). They persist because
`sessionObj` already writes `B.rooms[l]=ROOMSB[l]` [Q13=A]. `data.floors` already have `F` ids.

### 3. Validation hook — `01-schema.js`
Add `const VALIDATORS=[];` above `function validate` and, at the end of `validate()` before
`return out;`: `VALIDATORS.forEach(v=>{try{(v.run()||[]).forEach(x=>out.push(x));}catch(_){}});`
(This is the hook CONTRACT §4 promises every later WP.)

### 4. Wizard — action `stack.create` (group `Stack`, label `Új BRIDGE Stack…`, icon `▤`)
`openModal('Új BRIDGE Stack', …)`:
- `Név` (default `BRIDGE Stack <n>`)
- **Szerkezet**: radio `Új, üres réteg` / `Meglévő réteg(ek)` + checkbox list of non-stack layers +
  ☐ `egyesítés egy rétegbe` (shown when ≥2 ticked)
- **2. fázis rétegek**: one checkbox per `ph:2` role, all ticked except `off:true` ones
- OK → `stkCreate`. Phase-1 roles are always created. `state.activeLayer` = the Szerkezet layer.

After adoption, if the Szerkezet layer holds items of non-construct cats (`STK_ROLES[0].cats`
excludes them), HUD: `'A Szerkezet rétegen <n> nem szerkezeti elem is van — áthelyezheted
(jobb klikk a rétegen).'` and the layer RCO gains `Nem szerkezeti elemek áthelyezése új rétegre`
(→ new layer + `lyrMoveCat` per offending cat).

### 5. Panel group — extend `renderLayers`
Stack layers render inside a stack header block:
```
▾ ▤ B1 · BRIDGE Stack 1   [1. fázis]   ⋯
   (role layers, indented 10 px, role name shown as a small caption under the layer name)
```
Header RCO / `⋯`: `Stack aktiválása` · `Átnevezés…` · `Fázis: 1 / 2` · `Meglévő réteg felvétele szerepbe…`
(role select + layer select → `stkAdopt`) · `Stack feloldása (rétegek maradnak)`.
Non-stack layers render below the stack blocks, as today.

### 6. Stage rail [Q11=A] — `05d-shell.js`, minimal edit
Replace the rail's read of `STAGES` with `shellStages()`:
```js
function shellStages(){const S=(typeof stkActive==='function')?stkActive():null;
  return S?stkStages(S):STAGES;}
```
`stkStages(S)` (05m) maps the stack's roles to stage objects
`{k:'stk:'+role, n:role.n, icon, groups:[…], hint:role.hint, check:()=>stkCheck(S,role.k)}`.
`setStage('stk:<role>')` also sets `state.activeLayer` to that role's layer. Groups per role live in
an extensible table (later WPs push into it):
```js
const STK_GROUPS={construct:['Fal','Nyílászáró','Szint','Rajz','Helyiség'],mark:['Jelölés'],hw:['Hardver','Rádió'],
  base:['Hardver'],channel:['Csatorna'],arm:['ARM','Feltöltés'],'sys:*':['Végpont','Szükséglet']};
function stkGroupsOf(roleKey){return STK_GROUPS[roleKey]||(roleKey.indexOf('sys:')===0?STK_GROUPS['sys:*'].concat(STK_GROUPS['+'+roleKey]||[]):[]);}
```
(A WP adding groups to one system role pushes into `STK_GROUPS['+sys:MAINS']` etc. Groups that do
not exist yet simply show nothing.)
A rail button `◂ Általános` returns to `STAGES` (sets `state.stack=null` and the active layer to a
non-stack layer, else L0).

### 7. Shared hooks — the only render/pointer edits any later WP needs
Define in `05m-stack.js`:
```js
const STK_SCENE=[];    // fn() → svg string, appended to the SCENE (persisted drawing: marks, traces, zones)
const STK_OVERLAY=[];  // fn() → svg string, appended to the OVERLAY (ghosts, coverage, pick highlights)
const STK_TOOLS=[];    // {k, active()→bool, down(e)?, move(e)?, up(e)?, key(e)?} — first active tool that returns true eats the event
const STK_CTX=[];      // fn(e) → [{label,act}…] or null — first non-null wins the stage right-click
const STK_WV=[];       // fn(WV) → svg in Wall View elevation coords (u,v mm) — B2 adds the anchor in 06
const STK_PV=[];       // fn(PV) → svg in Plane View coords — B3 adds the anchor in 07
const STK_CHECKS={};   // roleKey → [fn(stack) → [{sev,msg}]]   (see §8)
function stkHookSvg(list){let s='';for(const f of list){try{s+=f()||'';}catch(_){}}return s;}
function stkToolEvent(ph,e){for(const t of STK_TOOLS){try{if(t.active()&&t[ph]&&t[ph](e))return true;}catch(_){}}return false;}
```
Edits (one line each, guarded with `typeof`):
| file | anchor | line |
|---|---|---|
| `04-render.js` | `const changed=paintLayers(s,ov);` | insert before it: `if(typeof stkHookSvg==='function'){s+=stkHookSvg(STK_SCENE);ov+=stkHookSvg(STK_OVERLAY);}` |
| `08-interaction.js` | first line inside `stage.addEventListener('pointerdown',e=>{` | after `lampHoverHide();hideCtx();` add `if(typeof stkToolEvent==='function'&&stkToolEvent('down',e))return;` |
| `08-interaction.js` | `stage.addEventListener('pointermove',e=>{lastPtr=[…];` | add `if(typeof stkToolEvent==='function'&&stkToolEvent('move',e))return;` |
| `08-interaction.js` | `stage.addEventListener('pointerup',()=>{` | change to `(e)=>{` and add `if(typeof stkToolEvent==='function'&&stkToolEvent('up',e))return;` |
| `08-interaction.js` | window keydown, after the `tag==='INPUT'…return;` line | `if(typeof stkToolEvent==='function'&&stkToolEvent('key',e))return;` |
| `10-lamps.js` | `stage.addEventListener('contextmenu',e=>{e.preventDefault();if(ctxSuppress){…return;}` | after that guard: `if(typeof stkCtxItems==='function'){const it=stkCtxItems(e);if(it){ctxMenu(e,it);return;}}` with `function stkCtxItems(e){for(const f of STK_CTX){try{const r=f(e);if(r&&r.length)return r;}catch(_){}}return null;}` in 05m |

In the Escape branch of that keydown, before `draft=null;`, add
`if(typeof stkToolEvent==='function')stkToolEvent('esc',e);` — tools stop on Esc, never discard data.

Projection helpers later WPs use (all existing): `planToBase(x,y,z)` → base coords, `p2b(pts)` →
SVG points string, `dz(level,h)` → z for a height, `clientToBase(e)`, `baseToPlan(bx,by,z)`.
**Check every `state.style`** (normal, plan, blueprint): if the blueprint draws with its own paper
projection, hook output must be skipped there — report which styles align.

### 8. Checks — `stkCheck(S,roleKey)` → `[{sev,msg}]`
`construct`: no walls on this layer's levels → info · a room without a name → warn · a room without
`F`/`Y` id → error (should not happen after §2) · no door → info.
Other roles: `[]` here — their WPs add checks by pushing into `STK_CHECKS[roleKey]`
(`(STK_CHECKS[k]=STK_CHECKS[k]||[]).push(fn)`); `stkCheck` concatenates construct's own checks and
every `fn(S)` result.

## Tests — `tests/spec-35-stack-core.js`
1. `stkCreate({name:'T'})` creates 5 phase-1 + 12 phase-2 layers (KNX off) in `STK_ROLES` order,
   each with `stack` and `role`; `stacks.length===1`; one undo removes all of it.
2. Adoption: existing layer `L0`-sibling `X` with walls adopted as `construct` → no new Szerkezet
   layer, `X.role==='construct'`; two layers + merge → one layer holding both sets.
3. Building rooms get `Y` ids via `ensureIds`; ids survive `sessionObj` → `applyProjectData`.
4. `VALIDATORS.push({run:()=>[{sev:'info',code:'t',msg:'x'}]})` → `validate()` contains it.
5. With the stack active, the rail renders 17 buttons with the role names; `setStage('stk:mark')`
   makes the Jelölés layer active; `◂ Általános` restores `STAGES`.
6. `stkDissolve` keeps all layers and items, clears `stack`/`role`.
7. Merging a stack layer into a non-stack layer is refused (A3 rule) — regression check.
8. Hooks: with `STK_SCENE`/`STK_OVERLAY`/`STK_TOOLS` empty the scene string of a fixture equals the
   string before this WP; a pushed scene fn's `<g id="t"/>` appears in the scene; a tool whose
   `down` returns true stops the select mode from selecting the device under the pointer.

## Golden
Identical (no stack in fixtures). The shell test (`spec-18`) must stay green — if it counted rail
buttons, it still sees `STAGES` because no stack is active.

## Browser-only checks (for the human)
Wizard readable · rail switch feels right · indented stack block in the layer panel.

## Verifier focus
`shellStages()` must be the ONLY change to the rail's data source. `ensureIds` seq scan includes
`Y` rooms (else an id is reissued). Stack layers stay contiguous after add/merge/dissolve.

## Out of scope
Anything a role does (B2 onward). Drawing on the stack as one layer (E1).
