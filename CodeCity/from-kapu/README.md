# From Kapu — the parked features, waiting for Kódváros

On 2026-10-26 VRG Kapu was cut down to an access page (GitHub sign-in + the signed allowed list,
then START.cmd). Everything else it did moves to **Kódváros**, which is to grow from a viewer into
the main tool for our code work. That move is planned in a later thread; this folder is the
starting material for it.

**This folder is a snapshot, not a working program.** Nothing builds or loads it. It holds the
whole Kapu as it was on `main` at commit `40b7143` (page build `bba2939ad7db`): every source module,
both data files and every test, so a module can be read or lifted with its tests and its data
together. Git history follows the moved files (`git log --follow`).

## What is here

| Path | What it did in Kapu (WP) |
|---|---|
| `src/js/10-model.js` | topology schema, validation, ref resolving, link-for (H1) |
| `src/js/20-layout.js`, `30-board.js` | the business-topology board: layout, SVG render, pan/zoom, overview (H2) |
| `src/js/40-actions.js`, `41-search.js`, `45-drawer.js`, `47-nav.js`, `42-md.js` | click/RCO menu, Ctrl+K search, info drawer, keyboard nav, mini markdown (H3) |
| `src/js/55-signin.js` | the full Belépések modal (GitHub · OneDrive · Claude · list · helper) (H4) |
| `src/js/57-refresh.js` | live topology, commits per program, branches, "Mi változott?" (H6) |
| `src/js/70-edit.js` | editor + save to GitHub for two users, claims, conflict dialog (H7) |
| `src/js/80-personal.js` | own links (L5), local target folder via File System Access (L6) (H8) |
| `src/js/90-log.js` | Munkanapló: form, markdown template, upload (H9) |
| `src/js/92-companion.js` | page side of the helper: terminal, Claude Code, git pull, per-node folders (H10) |
| `src/js/97-extras.js` | tour, glossary, installers, link check, PNG export/print (H11) |
| `src/js/00-core.js`, `50-github.js`, `60-access.js`, `99-boot.js`, `src/css/*`, `src/index.html` | the shell as it was (the first three also live on in `Hub/src/js`) |
| `data/topology.json`, `data/glossary.json` | 13 branches / 55 slots of the business map; 25 glossary entries |
| `test/` | the specs for all of the above; several still reach into `Hub/` and `tools/` by path, so they need re-pointing before they run here. **`spec-95-companion.js` is re-pointed** to `CodeCity/companion.js` (KV-04) and runs in `CodeCity/tools/selftest.js` |
| `companion-server.js` | copy of `Hub/companion/server.js` at the cut (the live one stays in `Hub/`) |

Still in place elsewhere, also Kódváros material: the plan pack `docs/hub/` (architecture, UI
strings, decisions) and the 25 agent init docs in `docs/hub/agents/`.

## Ideas for the move (to discuss in that thread, not decided)

- **The board becomes a district map.** Kapu's departments → programs → folders is the same
  hierarchy Kódváros draws as districts → buildings; one data model (`topology.json` merged into the
  scan) instead of two pictures of the same repo.
- **Claims + Munkanapló on buildings.** "Who works on what" and the day's log attach to the
  buildings they touched, and session replay (C9) shows them over time.
- **Agent init docs as building cards.** Each program's init doc opens from its building; the MCP
  server (C10) can hand the same doc to a Claude session that asks about that part of the city.
- **The helper's actions from the city.** Open folder / terminal / Claude Code / VS Code on a
  building — `Hub/companion/server.js` already has the whitelisted actions.
- **Mi változott?** as a lens: commits since your last visit light up the buildings they touched.
