# Licenc nyilvántartás — agent init
*For a Claude Code session that will work on Licenc nyilvántartás. Read this, then the files in §3.*
**Felelős:** Charlotte, Finance and Contracts

## 1. What it is
Every outside source recorded with its licence, so the licence travels with the code
(topology description). The record is `vendor-manifest.json`.

## 2. Where
- `vendor-manifest.json` at the repo root (26 components). Shown by `vrg-vendor.html`.

## 3. Read first
1. `CLAUDE.md` (root) — "Vendored third-party code"
2. `vendor-manifest.json`
3. `CoreRef/README.md` — "The licence rule"

## 4. Build / test / check
`node tools/fetch-vendor.js --all` re-fetches and checks every entry (network).

## 5. Rules and traps
- Pin to a tag (`refType: "tag"`), never a branch; npm entries pin an exact version + sha512
  (root CLAUDE.md).
- MIT and BSD-3 notices travel with copied code; BSD-3 adds a no-endorsement clause (root CLAUDE.md).
- CC-BY-NC-SA documentation never goes into the repo (CoreRef/README.md).

## 6. Current state
- git 2026-10-30 3932351 Re-root: rewrite old paths to H:\VRG\Full
- git 2026-10-27 1419e33 Kódváros KV-25 (P12 L2): Electron overlay spike - the city over the desktop on Ctrl+A
- git 2026-10-26 b5ab297 Kódváros KV-12 (P5): file panel - view, markdown preview, edit, diff before saving
- Decision files: none.

## 7. Do not touch
- `Vendor/` — never committed (root CLAUDE.md).

Forrás: CLAUDE.md, vendor-manifest.json, CoreRef/README.md, git log main, 2026-10-31
