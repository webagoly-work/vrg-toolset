# WP-H0 — Scaffold, build, test runner, launcher entry

**Goal:** the empty skeleton every later WP fills: source layout, one-file build, test runner,
checker, a served preview, and a START.cmd / VRG-DE.cmd entry. The built page shows "VRG Kapu" and
the four themes, nothing else.

## Read
`00_CONTRACT.md` · `01_ARCHITECTURE.md` §4 · `Inventory/build/` + `Inventory/package.json` (the toolset's
existing source→single-file pattern; copy its style, not its deps) · `Modder/vrg-buildtree.html` `THEMES`
· `Planner/START.cmd` header + one letter entry (U) · `tools/check-start.js`.

## Build
1. `Hub/src/index.html` (shell: top bar, layer rail, `<svg id="kpBoard">`, drawer, modal root),
   `Hub/src/css/00-themes.css` (the four themes verbatim, as `[data-theme=…]` var sets),
   `Hub/src/css/10-layout.css`, `Hub/src/js/00-core.js` (`kpStore`, `kpEl`, `kpEsc`, `kpFmtDate`),
   `Hub/src/js/99-boot.js`.
2. `tools/build-hub.js`: reads `index.html`, replaces `<!--@css-->`, `<!--@js-->`, and
   `<!--@data-->` (→ `<script type="application/json" id="kpTopology">`, `id="kpAccess"`,
   `id="kpPubkey"`) — files missing in H0 are embedded as `null`. Writes `Hub/dist/vrg-kapu.html`,
   prints size and a sha256 (first 12 hex) that is also embedded as `KP_BUILD`.
3. `Hub/test/run.js`: runs every `Hub/test/spec-*.js` (each exports `[{name, fn}]`, plain asserts),
   prints `n/n`, exit 1 on failure. `Hub/test/spec-00-core.js`: `kpEsc('<a&"')` = `&lt;a&amp;&quot;`;
   `kpStore.get('x', 5)` returns 5 when storage throws (inject a throwing stub).
4. `Hub/test/serve.js`: static server for `Hub/dist` on 127.0.0.1:8796 (dev only, until H10).
5. `tools/check-hub.js`: build exists; dist contains no `ghp_|github_pat_|sk-ant-|BEGIN .*PRIVATE`;
   (later WPs add schema + path checks). Exit 1 on failure.
6. `Hub/VRG Kapu.cmd` (CRLF, ASCII): for now opens `Hub\dist\vrg-kapu.html` in the default browser;
   H10 switches it to the companion.
7. `Planner/START.cmd`: a free **letter** (check the BILLENTYUK section; `H` if free) "VRG Kapu
   (kozponti terkep)" → calls `..\Hub\VRG Kapu.cmd`; dated NOTE line. `VRG-DE.cmd`: an entry in the
   LEAD section. Run `node tools/check-start.js` → must pass.
8. `.claude/launch.json` (repo): config `vrg-kapu` → `node Hub/test/serve.js`, port 8796.
9. `Hub/README.md`: 10 lines — what it is, build, test, where the plan is (`docs/hub`).

## Tests
- `node tools/build-hub.js` → `Hub/dist/vrg-kapu.html` exists, contains `KP_BUILD`.
- `node Hub/test/run.js` → 2/2. `node tools/check-hub.js` → OK. `node tools/check-start.js` → exit 0.
- Browser (:8796): title "VRG Kapu"; switching `data-theme` through the four themes changes
  `getComputedStyle(body).backgroundColor` four times (four distinct values).

## Verify focus
CRLF on the `.cmd`; START.cmd numbers unchanged; no dependency added; dist has no secrets.

## Out of scope
Any board drawing, data loading, network.
