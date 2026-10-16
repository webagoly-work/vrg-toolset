# WP-A3 — Layer operations: duplicate, merge, link, lock

Status: todo · Wave A · Depends: A1, A2 · Size: M (~220 lines) · Builder: mid tier
Decisions: Q04=A · Q05=A · Q06=A · Q07=A

## Goal
The user's words: *"adopt some features of Photoshop like duplicate, link, merge layers."*
Planner meaning of each, fixed here:

| Photoshop | Planner | decision |
|---|---|---|
| Duplicate | a new layer holding a **copy of every item** of the source, with fresh ids; internal links re-pointed at the copies | walls are copied only if ticked [Q06=A: off by default — a copied wall is a second wall on top of the first] |
| Merge | every item of layer B moves to layer A, B is deleted. **Merge down** (into the layer below in the list) and **Merge linked** (all layers of the link group into the topmost) | [Q05=A] both |
| Link | layers in a link group share **visibility, opacity and lock**: toggling one toggles all. Nothing moves together — the Planner has no whole-layer transform | [Q04=A] |
| Lock | a locked layer's items cannot be selected, dragged or deleted; they still draw and snap | [Q07=A] |

## Read (only these)
- `src/01-schema.js` `function copyRecord` (5 lines) — every copy goes through it
- `src/08-interaction.js` `function cloneMulti` — how a copied clip row gets its own `gid`
  (`grep -n "function cloneMulti" -A12 src/08-interaction.js`)
- `src/09-menus.js` `function hitTest(e)` (line ~10) — you add the lock filter there
- `src/05l-layers.js` (yours)

## Build — `05l-layers.js`

### Duplicate
```js
lyrDuplicate(srcId,{walls=false}={})  // → new layer id
```
1. `lyrPushUndo()`. New layer `{id:'L'+Date.now().toString(36), name:L.name+' másolat', visible,
   cats:{…L.cats}, op:{…L.op}, tint:L.tint}` inserted **directly after** the source in `layers`.
2. For every `UKEYS` collection: each record with `layer===srcId` → `copyRecord(coll,rec)`, set
   `layer=newId`, push. Remember `pairs[coll]=[[orig,copy],…]`.
3. Paths: also delete every node `id` of the copy (`copy.nodes.forEach(n=>delete n.id)`) so
   `ensureIds` gives fresh node ids. Then `ensureIds(data)`.
4. **Re-point links inside the layer**: for each device pair, for each link `{p,n,glue}` of the
   ORIGINAL whose path is also on `srcId`: find the path pair, take node index `ni` in the original
   path, push `{p:copyPath.id,n:copyPath.nodes[ni].id,glue}` onto the copy (`addLink`/`setLink` from
   `01-schema.js`). Links to paths on other layers are dropped (as `copyRecord` already did).
5. Clip rows: copied devices that shared a `clip.gid` get one fresh common gid per original gid
   (same idea as `cloneMulti`).
6. `data.circuits` are on no layer — not copied. Path `j` joins (E1) pointing inside the layer are
   re-pointed like links; pointing outside are kept.
7. Walls only with `{walls:true}`: copy rects of `layer===srcId` on every level, `delete id`, push,
   `ensureIds`, rebuild `SNAP`.
8. `renderLayers(); draw();` HUD `'Réteg másolva: <név> (<n> elem)'`.

### Merge
```js
lyrMerge(intoId, fromIds)  // every item of fromIds → intoId; the from layers are removed
lyrMergeDown(id)           // into the next layer BELOW in the list; refuse on the last one
lyrMergeLinked(id)         // all layers with L.link===layers[id].link into the topmost of them
```
`lyrPushUndo()` first. Items: set `layer`. The `into` layer's `cats`/`op` win; a cat hidden on any
merged layer stays as `into` has it. `L0` can be a target but never a source (it is the fallback
layer). A stack layer (B1, `L.stack`) can be merged only into a layer of the same stack — refuse
otherwise with HUD `'Stack réteg csak a saját stackjébe olvasztható.'`. If `state.activeLayer`
was removed → `intoId`.

### Link
```js
lyrLink(ids)        // all get one id 'g'+Date.now().toString(36); a single id → unlink it
lyrUnlink(id)
lyrGroupOf(id)      // [layer…] of its link group, or [itself]
```
Make the panel toggles group-aware: in `renderLayers` handlers, the layer 👁, every sub-layer 👁,
`[−]/[+]` and the lock act on `lyrGroupOf(id)`. Show a 🔗 badge on linked layer rows.

### Lock
`L.lock=true` → 🔒 button in the layer row. Add a filter at the single hit-test entry point:
an item on a locked layer is not hit (so it cannot be selected, dragged or deleted). Snapping
(walls, devices, path nodes) is **not** filtered. HUD on a click that would have hit it:
`'Zárolt réteg: <név>'`.

### Layer RCO (right-click on the layer name row) and actions (group `Réteg`)
| id | label | when |
|---|---|---|
| `layer.duplicate` | `Réteg másolása…` (modal: ☐ falakkal együtt) | always |
| `layer.mergeDown` | `Egyesítés az alatta lévővel` | not last |
| `layer.mergeLinked` | `Csatolt rétegek egyesítése` | layer is linked |
| `layer.link` | `Csatolás…` (modal: checkbox list of layers) | >1 layer |
| `layer.unlink` | `Csatolás bontása` | layer is linked |
| `layer.lock` | `Zárolás be / ki` | always |
The same items appear in the layer row's right-click menu (`ctxMenu`), acting on that row's layer.

## Tests — `tests/spec-34-layer-ops.js`
1. Duplicate a layer with 2 devices, 1 path (3 nodes), device D linked to node 2 (glue) →
   new layer has 2 devices + 1 path, all ids new and unique (`validate()` reports no `id.duplicate`),
   the copied D links the COPIED path's node 2 with `glue:true`; the original link unchanged.
2. Two clipped devices duplicate into a pair sharing a new gid ≠ the old one.
3. Duplicate without walls copies 0 walls; with `{walls:true}` copies them with new `W` ids.
4. One undo step removes the duplicate entirely (layer + items).
5. `lyrMergeDown`: items of the upper layer carry the lower layer's id; the upper layer is gone;
   undo restores both layers and the original `layer` fields.
6. Merging `L0` as a source is refused; merging a stack layer into a non-stack layer is refused.
7. Link L1+L2: hiding L1 hides L2; `[−]` on L1's Dugaljak changes L2's too; unlink → independent.
8. Lock L1: the hit-test returns nothing for an L1 device under the cursor; an L0 device still hits.

## Golden
Identical. No update allowed.

## Browser-only checks (for the human)
Locked items still snap · the 🔗 / 🔒 badges are legible.

## Verifier focus
Node-id deletion before `ensureIds` (else copies share node ids with originals and every link
lookup by `{p,n}` still works — but the next copy-of-a-copy collides). Link re-pointing by node
INDEX, not by id. Merge refusing the stack cross-over.

## Out of scope
Layer reordering by drag (not asked). Stack-aware panel grouping (B1).
