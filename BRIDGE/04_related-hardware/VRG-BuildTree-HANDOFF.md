# VRG BuildTree — Project handoff

Self-contained inventory + device-builder tool for the Varler hardware branch. This doc is the
seed for **moving it into its own claude.ai Project** so it develops independently of the Planner chat.

## Files in this set

- **`vrg-buildtree.html`** — the whole tool, single self-contained file (no external deps, no
  localStorage). Open in any browser. This is the source of truth.
- **`VRG-BuildTree-HANDOFF.md`** — this file. Put it in the new Project's knowledge.

## What it does

- **Készlet (inventory):** every owned item with role, specs, buses, and — new — **invoice
  metadata** (számlaszám · purchase date · bruttó Ft/db), looked up by cikkszám.
- **Editable stock:** each item has a `− [n] +` stepper. Any change is written to the
  **change log** at the bottom:
  - *decrease* → a **reason** textbox (where did the parts go).
  - *increase* → flagged **"hiányzó számla"**; type a **Számlaszám code** (e.g. `SZ12585`) to resolve it.
- **Eszköz-builder (new interaction):** the **first item you click becomes the Alap** (base);
  each further click attaches as a node, auto-labelled with the connection bus and coloured by
  compatibility. A **floating panel** on the right (sticky, follows scroll) shows the growing tree
  + a **mini connection diagram**. **Kész ✓** saves it to the **gallery at the top** with a
  subtle colour code; you can build **multiple Eszköz** from the remaining list. Each saved Eszköz
  **downloads as Markdown** (for the MindMap later).
- **Buttons:** Undo / Redo / Ürít (clear current), per-device **.md** + Töröl, and global
  **Export / Import / Reset**.
- **Themes:** four swatches top-right (amber / light / slate / green).
- **Bővítéshez rendelhető tételek:** a generous, category-organised catalogue (power, connectors,
  network/server, radio, sensor, display, storage, actuation, protection, enclosure) covering gaps,
  future-proofing, and bridges between what's already owned.
- **Dokumentált variánsok:** the hand-authored PiP-boy v0 (layout, pin map, ESP-NOW).

## Persistence model

No silent auto-save (keeps it portable + sandbox-safe). State (stock overrides, change log, saved
devices, theme) lives in memory; **Export** writes `vrg-buildtree-state.json`, **Import** reads it
back. That JSON is the "later-importable format" — it's how state migrates between machines/chats.

## Open TODOs (for the new Project)

1. **Diagram-viewer box (top of doc):** currently an empty placeholder. Intended home for the
   reworked **ESPBLOK builder visualization** HTML we built earlier — review it, adapt to the VRG
   theme variables, and drop it in. *(You asked me to make time to review that.)*
2. **START.cmd hook:** wire VRG BuildTree into the master launcher as its own entry.
   *(You asked to be reminded — here's the reminder.)*
3. **MindMap export:** the per-device `.md` is MindMap-ready; connect it to the Varler MindMD lane.
4. **Backfill invoice metadata** for the few early items that predate cikkszám tracking
   (e.g. VL6180X 2-3-30) once their számla surfaces.
5. **Swarm variant:** seed a documented variant for the C3-Zero ×6 ESP-NOW swarm.

## Continuing in a fresh chat

Attach `vrg-buildtree.html` + this handoff to the new Project. To edit, send me the current
`vrg-buildtree.html`; I edit that copy and return it. To carry your live edits (stock, devices),
also send the exported `vrg-buildtree-state.json`.
