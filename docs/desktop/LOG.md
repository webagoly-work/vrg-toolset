# VRG Desktop unify — work log

Branch `desktop/unify` in `H:\VRG\Full\wt-desktop-unify` = `main` (`b4922ab`) + merged `desktop-os/WP-35b` (`5c015d3`).
Plan: `C:\Users\webag\.claude\plans\plan-this-out-in-deep-reddy.md`; prompt: `H:\VRG\Full\notes\desktop-unify\PROMPT.md`.
Run in an attended session on 2026-11-10 (the Founder chose that over the night run).

## U0 — green baseline (2026-11-10)

- START key D collision resolved (DESKU-Q01): UI Kit galéria D → **B**; Irányítópult keeps D.
- `shared/vrg-ui-kit/README.md` row 7 notes the new key. Kapu rebuilt (`node tools/build-hub.js`, kpTools 14).
- Checks: `node Dashboard/test/run.js --all` → 346 pass, 0 fail, selftest ok (343 ids);
  `node tools/check-start.js` → ok (one unlisted page, `Modder/vrg-fenymero.html`, was already there);
  `launcher/test/selftest.ps1` → Rendben.

## U1 — inventory (2026-11-10)

- `Dashboard/tools/inventory.js` (re-runnable, read-only) → `docs/desktop/inventory.json` + `INVENTORY.md`: **526 rows** from 13 sources
  (vrg-menu 153, features 105, dashboard 79, console 51, mobile 19, stack 23, tools 15, prompts 8, agents 17, firmware 4, shared 4, docs 23, folders 25).
- Client codes: 8 features rows held one; the script now swaps codes for their aliases with the anonymise map (the main checkout's copy,
  DESK-Q87 C) and writes nothing without a map. `anonymise.js --check` on the outputs: clean.
- Checks: run.js --all green.

## U2 — glossary + classification (2026-11-10)

- `docs/desktop/GLOSSARY.md`: 30 software-unit terms, 25 UI-container terms, the levels; each with well-known examples and the VRG instance.
- `launcher/vrg-catalog.json` (the decision data, 91 items: 33 user, 52 dev, 6 all) + `Dashboard/tools/classify.js` →
  `docs/desktop/classification.json` + `CLASSIFICATION.md`: all 526 rows typed and levelled (user 118, dev 284, all 124), every
  dev row has a parent in the catalog; 10 naming collisions with proposed names. DESKU-Q02…Q05.
- Checks: classify.js exit 0 (no orphan, no unparented dev row); anonymise --check clean.

## U3 — architecture proposal (2026-11-10)

- `docs/desktop/ARCHITECTURE.md`: why it tangles (7 lists), what VS Code / Windows / macOS / JetBrains Toolbox / Home Assistant–Grafana do,
  the recommended layout, what START / Kapu / Toolbox / hub-seed / Console / Zen become, a 16-row rename table, the migration order.
- DESKU-Q06 … Q12 recorded.

## U4 — the catalog (WP-40, 2026-11-10)

- `Dashboard/shell/lib/catalog.js`: load + validate `launcher/vrg-catalog.json` against `build.collect()` (START acts, servers,
  submenus, features) and the pane kinds; `listFor(level)`, `children(id, level)` (catalog children, START submenu actions, servers),
  `resolve(id)` (act / web / pane / view / frame / start), `appTarget(id)` (the page + the folders vrg-app:// may serve).
- `tools/check-catalog.js` (ASCII, exit 1 on errors; lists START / features apps the catalog does not know: only e6 RL-CYD, personal).
- `Dashboard/test/wp-40.test.js`: 11 tests. Catalog fixes found by the checker: layer ids lowercased (the IPC id type), prompts and
  three items with no opener re-pointed, the map opens its server.
- CLAUDE.md: the catalog rule next to the START rule.
- Checks: run.js --all 357/0, selftest ok; check-start ok; check-catalog ok.
