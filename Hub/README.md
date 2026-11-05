# VRG Kapu

The access page of the VRG toolset: sign in with GitHub, the signed allowed list decides whether the
Kapu opens, and then it hands over to `Planner/START.cmd` — the front door until the shared dashboard
exists. It also lists START.cmd's tools (same keys) with **Megnyitás** and **Mappa** for each.
A single offline HTML file, `Hub/dist/vrg-kapu.html`; open it with `Hub\VRG Kapu.cmd`, START.cmd `H`
or VRG-DE.cmd `L5`.

- **Build:** `node tools/build-hub.js` (sources in `Hub/src/`, the allowed list in `Hub/data/`, the
  tool list read from START.cmd's TOOL REGISTRY at build time — rebuild after changing the registry);
  `--onedrive <…\VRG-Megosztott\00_START>` also copies the page there with `OLVASS_EL.md`
- **Test:** `node Hub/test/run.js` · `node tools/check-hub.js`
- **Full mode:** `Hub\VRG Kapu.cmd` starts the Kapu segéd (`Hub/companion/server.js`, localhost:8795):
  START.cmd, tools and folders open from the page. From `file://` it is links-only.
- **Allowed list:** `node tools/hub-sign.js` (owner key outside the repo). Day to day use the admin page
  `node tools/hub-admin/server.js` (START → O → M, http://127.0.0.1:8798): add / remove a person or change
  their layers, then it signs, verifies, rebuilds (+ the OneDrive copy once its folder is set) and runs
  check-hub in one go, puts the old list back if a step fails, and writes the Hungarian welcome message.
  The GitHub repo invite stays a click on GitHub (the page opens Collaborators); no token is stored.
- **Look (2026-11-04):** the VRG UI Kit (`shared/vrg-ui-kit`) is inlined into `Hub/src/index.html` between
  `<!-- vk:begin … -->` and `<!-- vk:end -->`; the marker lists the components. Refresh after a kit change with
  `node shared/vrg-ui-kit/inline.js --sync-app Hub/src/index.html`, then rebuild. `Hub/test/spec-15-kit.js` fails
  when the region has drifted. Themes are the kit's: Mélyvíz (default), Éj, Papír, Kontraszt. A remembered
  pre-kit theme maps to the nearest one. Ctrl+K opens the command palette: every tool, START, theme and sign-out.
  Each tool row has two MINIs, Megnyitás and Mappa, which spin while the Kapu segéd works.
- **2026-10-26 rework:** the business map, editor, Munkanapló, refresh, personal links, tour and
  glossary were removed from here and parked for Kódváros in `CodeCity/from-kapu/` (README there).
  The plan pack `docs/hub/` describes the old, full Kapu.
