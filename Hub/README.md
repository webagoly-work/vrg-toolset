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
- **Allowed list:** `node tools/hub-sign.js` (owner key outside the repo).
- **2026-10-26 rework:** the business map, editor, Munkanapló, refresh, personal links, tour and
  glossary were removed from here and parked for Kódváros in `CodeCity/from-kapu/` (README there).
  The plan pack `docs/hub/` describes the old, full Kapu.
