# VRG Kapu — agent init
*For a Claude Code session that will work on VRG Kapu. Read this, then the files in §3.*
**Felelős:** Elsie, Behaviour Lab · **Indító:** GO HUB

## 1. What it is
The shared homepage of the VRG toolset: one map of every department, program, folder and agent doc,
for both users. A single offline HTML file built from modular sources.

## 2. Where
- Sources `Hub/src/`, data `Hub/data/`, tests `Hub/test/`, companion `Hub/companion/` →
  `Hub/dist/vrg-kapu.html`. The plan: `docs/hub/`.
- Opened with `Hub\VRG Kapu.cmd` or START key **H**. On `main` in the main checkout.

## 3. Read first
1. `GO-HUB.md`
2. `docs/hub/00_CONTRACT.md`
3. `docs/hub/README.md` — §3 order, §4 status, §5 answers
4. The next open WP file in `docs/hub/wp/`

## 4. Build / test / check
```bash
node tools/build-hub.js
node Hub/test/run.js
node tools/check-hub.js          # --strict before handing the hub out (WP-H13)
```

## 5. Rules and traps
- Never ask for, type or store a password or token; each user enters their own in their own browser
  (GO-HUB.md §4).
- Questions to the user as numbered items with the DECISIONS id and lettered options, A recommended
  (GO-HUB.md §4).
- Commit after each WP as `Kapu WP-Hn: …`; never push, merge or switch branch (GO-HUB.md §1).
- Hungarian UI text, English code (GO-HUB.md §4).

## 6. Current state
- git 2026-10-30 60498ca Kapu: admin page, helper follow-ups, setup checklist and colleague guide for the acce
- git 2026-10-27 f058e6f Mélyvíz rollout P3–P4: BuildTree palette, Inventory, Vendor, Kapu, toolbox
- git 2026-10-26 87f2fca Kapu: access page only; START.cmd folder option and localhost menu
- `docs/hub/hub-seed.json` has no Mobile, Kódváros, ServiceKit or OpenWrt yet.
- H0–H12 done; H13 (distribution) open, waiting for the OneDrive share links (docs/hub/README.md §4).
- Decision files: `docs/hub/DECISIONS.md`, `docs/hub/HUB-Q-001.json`.

## 7. Do not touch
- The private signing key outside the repo (docs/hub/README.md §4 H5).
- `Hub/dist/` by hand; rebuild instead (Hub/README.md).

Forrás: GO-HUB.md, Hub/README.md, docs/hub/README.md, 2026-10-31
