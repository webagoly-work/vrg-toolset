# VRG Inventory — agent init
*For a Claude Code session that will work on VRG Inventory. Read this, then the files in §3.*
**Felelős:** Charlotte, Finance and Contracts

## 1. What it is
A vendor-independent core database of the electrical installation material VARLER GROUP orders,
built from the DANIELLA e-mail archive, with DANIELLA as only one vendor among many. The app imports
a Planner drawing, shows what it needs, builds order lists, and exports, price-checks or QRs them.

## 2. Where
- `Inventory/src/` + `Inventory/data/` → `Inventory/dist/vrg-inventory.html` (no server needed)
- Opened from START key **6**. Submenu **I**: **B** build, **T** test, **S** local server, **P** price check.

## 3. Read first
1. `Inventory/README.md`
2. `Inventory/docs/AI-CONTEXT.md` (before touching `data/`)
3. `Inventory/docs/DEV-PLAN.md`
4. `Inventory/docs/SOURCES.md`

## 4. Build / test / check
```bash
cd Inventory
npm test            # node --test, no dependencies
npm run build       # src/ + data/ -> dist/vrg-inventory.html
npm run check       # test + build
npm run serve       # http://localhost:8123 (localStorage needs a real origin)
npm run data        # re-extract from the raw documents (VRG_RAW_DIR)
npm run pricecheck  # network
```

## 5. Rules and traps
- The vendor rule: vendor-specific values live only in `vendors.<id>`; `src/core/schema.js` throws on a
  direct `vendors.*` read, everything goes through `src/core/vendors.js` (README "The vendor rule").
- `vrg_id` is neutral and append-only in `data/vrg-id-registry.json`; never change a handed-out id
  (AI-CONTEXT.md "Identifiers").
- Look items up by `legacy_id` only through `store.getByLegacy()` (AI-CONTEXT.md).
- The user's own data is a separate document; `npm run data` must never touch it (README "Your own data").
- `file://` and `data:` get no localStorage; test persistence via `npm run serve` (README).

## 6. Current state
- git 2026-10-27 f058e6f Mélyvíz rollout P3–P4: BuildTree palette, Inventory, Vendor, Kapu, toolbox
- git 2026-10-22 6b7eb03 Anonymise client job codes before the colleague invite (HUB-Q10 B, step 3a)
- git 2026-09-20 6a2ddc7 Inventory: vendor-independent core item database, phases 0-10
- Decision files: none. README: "Phase 10 complete — the last planned phase."

## 7. Do not touch
- `Inventory/.cache/`, `Inventory/price-check-*.json` — regenerable, never committed (root CLAUDE.md).
- `dist/` by hand; rebuild instead.
- `data/vrg-id-registry.json` entries already handed out.

Forrás: Inventory/README.md, Inventory/package.json, Inventory/docs/AI-CONTEXT.md, launcher/vrg-menu.json, git log main, 2026-10-31
