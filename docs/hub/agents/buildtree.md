# VRG BuildTree — agent init
*For a Claude Code session that will work on VRG BuildTree. Read this, then the files in §3.*
**Felelős:** Charlotte, Finance and Contracts

## 1. What it is
An inventory and device-builder tool for the Varler hardware branch: owned items with invoice data,
an editable stock with a change log, and an Eszköz-builder that turns clicked items into a device
tree, saved to a gallery and downloadable as Markdown.

## 2. Where
- `Modder/vrg-buildtree.html` — the whole tool, one file, no external deps, no localStorage.
- Opened from START key **9**.
- Exports next to it: `Modder/vrg-buildtree-keszlet-2026-10-09.txt`, `vrg-buildtree-adatbazis-2026-10-13.txt`.

## 3. Read first
1. `Modder/VRG-BuildTree-HANDOFF.md`
2. `Modder/vrg-buildtree.html`

## 4. Build / test / check
No build — single file. Open it in a browser.

## 5. Rules and traps
- No silent auto-save: state lives in memory; **Export** writes `vrg-buildtree-state.json`,
  **Import** reads it back (HANDOFF "Persistence model").
- To carry live edits between sessions, the user sends the exported state JSON too (HANDOFF
  "Continuing in a fresh chat").

## 6. Current state
- git 2026-10-27 f058e6f Mélyvíz rollout P3–P4: BuildTree palette, Inventory, Vendor, Kapu, toolbox
- git 2026-10-22 6b7eb03 Anonymise client job codes before the colleague invite (HUB-Q10 B, step 3a)
- git 2026-10-22 3251b88 BuildTree: Modulshop order 2026-10-18 for Board Console panel B
- Open TODOs in HANDOFF: diagram-viewer box, MindMap export, invoice backfill, swarm variant.
  Decision files: none.

## 7. Do not touch
— (nincs leírva)

Forrás: Modder/VRG-BuildTree-HANDOFF.md, launcher/vrg-menu.json, git log main, 2026-10-31
