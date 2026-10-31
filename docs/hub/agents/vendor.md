# VRG Vendor — agent init
*For a Claude Code session that will work on VRG Vendor. Read this, then the files in §3.*
**Felelős:** Elsie, Behaviour Lab

## 1. What it is
The catalogue of brought-in third-party components: `vendor-manifest.json` plus
`tools/fetch-vendor.js` own everything under `Vendor/`, and `vrg-vendor.html` shows it.

## 2. Where
- `vrg-vendor.html` (repo root), `vendor-manifest.json`, `tools/fetch-vendor.js`, `Vendor/` (not in git).
- Opened from START key **0**. Submenu **V**: **L** lists, **D** downloads components, **Y** syncs the page.

## 3. Read first
1. `CLAUDE.md` (root) — "Vendored third-party code"
2. `vendor-manifest.json`
3. `tools/fetch-vendor.js`

## 4. Build / test / check
```bash
node tools/fetch-vendor.js --all     # rebuild Vendor/ (network)
node tools/fetch-vendor.js three     # one component
```

## 5. Rules and traps
- Source to be read or adapted is pinned to a tag, never a branch (root CLAUDE.md).
- npm components pin an exact version; their sha512 is checked before extraction (root CLAUDE.md).
- Copied code keeps its copyright notice (MIT, BSD-3) (root CLAUDE.md).
- `Vendor/pdfjs` must load from `legacy/build/pdf.mjs` (root CLAUDE.md).

## 6. Current state
- git 2026-10-30 3932351 Re-root: rewrite old paths to H:\VRG\Full
- git 2026-10-27 f058e6f Mélyvíz rollout P3–P4: BuildTree palette, Inventory, Vendor, Kapu, toolbox
- git 2026-10-27 1419e33 Kódváros KV-25 (P12 L2): Electron overlay spike - the city over the desktop on Ctrl+A
- Decision files: none.

## 7. Do not touch
- `Vendor/` — never committed (root CLAUDE.md).

Forrás: CLAUDE.md, vendor-manifest.json, launcher/vrg-menu.json, git log main, 2026-10-31
