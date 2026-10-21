# VRG Kapu

The shared homepage of the VRG toolset: one map of every department, program, folder and agent
doc, for both users. A single offline HTML file, `Hub/dist/vrg-kapu.html`; open it with
`Hub\VRG Kapu.cmd`, START.cmd `H` or VRG-DE.cmd `L5`.

- **Build:** `node tools/build-hub.js` (sources in `Hub/src/`, data in `Hub/data/`)
- **Test:** `node Hub/test/run.js` · `node tools/check-hub.js`
- **Preview with storage:** `node Hub/test/serve.js` → http://127.0.0.1:8796 (launch config `vrg-kapu`)
- **The plan:** `docs/hub/` — README §3 work packages, §4 status, `00_CONTRACT.md` rules.
