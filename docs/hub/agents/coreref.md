# CoreRef — agent init
*For a Claude Code session that will work on CoreRef. Read this, then the files in §3.*
**Felelős:** Elsie, Behaviour Lab

## 1. What it is
The offline, link-out reference database for ESPHome and Home Assistant, pinned at a known release
so a refresh can diff what moved upstream. A copy is meant to ship with a BRIDGE install.

## 2. Where
- `CoreRef/`: `coreref-sources.json`, `tools/harvest.js` (+ `tools/lib/`), `docs/`.
- `data/` and `db/coreref.sqlite` are gitignored and regenerable.
- No launcher entry — — (nincs leírva).

## 3. Read first
1. `CoreRef/README.md`
2. `CoreRef/docs/COREREF-PLAN-001_Scope-and-Work-Packages.md`
3. `CoreRef/docs/PHASE-0-REPORT.md`
4. `CoreRef/coreref-sources.json`

## 4. Build / test / check
```bash
node CoreRef/tools/harvest.js            # about 8 min, ~2,300 requests
node CoreRef/tools/harvest.js --limit 20 # a quick slice; also --esphome / --ha, --concurrency N
```

## 5. Rules and traps
- The licence rule: restricted sources (esphome.io, home-assistant.io, developers.home-assistant.io,
  CC-BY-NC-SA 4.0) never go into the repo; `assertRepoSafe()` in `harvest.js` refuses (README).
- Pins resolve to the latest release tag, never a branch (README).
- The database is rebuilt from scratch each run (README "Run it").

## 6. Current state
- git 2026-10-14 c815fb0 CoreRef: offline ESPHome / Home Assistant core reference — harvester, manifest, plan,
- Not yet built: reader UI, refresh diff report, catalogue layers (README). Decision files: none.

## 7. Do not touch
- `../_refmirror` (personal reading mirror, outside the repo) — never copy it in (README).

Forrás: CoreRef/README.md, git log main, 2026-10-31
