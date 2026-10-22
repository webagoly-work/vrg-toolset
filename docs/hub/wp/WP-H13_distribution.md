# WP-H13 — OneDrive links, START_HERE copy, colleague guide, clean-profile verify

**Goal (user):** "THIS IS THE GROUND BASIS OF our work: the first and foremost starter point for the
two current users".

## Depends
H0–H12 done; `04_SETUP-CHECKLIST.md` steps 3–8 done by the user (push, invite, OneDrive shares,
signed list). The OneDrive share links come from the user (paste into the editor, or give the list
to this session).

## Build
1. Fill every empty `url` in `topology.json` that the user has a link for; list the rest in the
   report. Save via the editor (one commit) or a direct edit + commit **only if the user asks**.
2. `tools/build-hub.js --onedrive <folder>`: after building, also copy `vrg-kapu.html` to the
   user's local OneDrive `VRG-Megosztott/00_START/` (path from the flag; never guessed) together with
   `OLVASS_EL.md` (generated, HU + EN italic): what the file is, the two modes, how to start the
   full mode, who to ask.
3. `docs/hub/KOLLEGA-INDULAS.md` (HU first, EN italic below each paragraph): the colleague's first
   hour — GitHub invite → 2FA → GitHub Desktop + clone → Node (or cwebuser kit) → `Hub\VRG Kapu.cmd`
   → token wizard → *Első lépések* → first Munkanapló. One screenshot per step taken in the pane
   (scratch profile), saved in `docs/hub/img/`.
4. **Clean-profile verify**: a fresh browser profile (the pane's new tab with no storage, or a temp
   `--user-data-dir`) → file:// mode banner correct → served mode → token of the **user's own**
   account typed by the user (never by the session) → board unlocks → open Planner via companion →
   Munkanapló download.
5. `docs/hub/README.md` §4: all lines DONE/PARTIAL with dates; §6 "Hogyan tovább" (v2 list from
   `02_BUSINESS-TOPOLOGY.md` §5).

## Tests
- `node tools/check-hub.js` → 0 errors, warnings only for links the user has not given yet.
- the OneDrive copy is byte-identical to `Hub/dist/vrg-kapu.html` (sha256).

## Out of scope
Sending the invite, sharing folders, creating tokens — the user does those (setup checklist).
