# Okosotthon katalógus — agent init
*For a Claude Code session that will work on Okosotthon katalógus. Read this, then the files in §3.*
**Felelős:** Elsie, Behaviour Lab

## 1. What it is
The single source of truth for BRIDGE devices, sensors, gases, switches, lighting, Tuya categories and
battery devices. The Planner's endpoint catalogue (`EP_CAT`) takes its codes from here.

## 2. Where
- Source `BRIDGE/09_catalogue/src/*.js` → generated `SMARTHOME-DB-001.json` + `smarthome-db.html`
  (offline view, opens as a file).
- No launcher entry — — (nincs leírva).

## 3. Read first
1. `BRIDGE/09_catalogue/README.md`
2. `BRIDGE/09_catalogue/RESEARCH-001_room-tech-sensing-and-lighting.md`
3. `BRIDGE/09_catalogue/src/00-vocab.js`

## 4. Build / test / check
```bash
node BRIDGE/09_catalogue/tools/build.js           # build; checks every reference, exit 1 on error
node BRIDGE/09_catalogue/tools/build.js --check   # check only
```

## 5. Rules and traps
- Edit `src/*.js` only; the JSON and the HTML are generated (README).
- New item → the matching `src` file with a unique `k` key; gases are a separate namespace (README).
- Rooms only from `00-vocab.js` `roomTypes`; zone and power only from the vocabulary (README).
- A ⚑ number is a secondary source; it becomes a BRIDGE rule only after checking (README).
- Tuya data: code, name and our own labels only, never documentation prose (README).

## 6. Current state
- git 2026-10-27 4da1fe6 Mélyvíz rollout P5: BRIDGE tuner, catalogue viewer, ESPBLOK builders (chrome only)
- git 2026-10-22 6b7eb03 Anonymise client job codes before the colleague invite (HUB-Q10 B, step 3a)
- git 2026-10-14 c0b0cd3 BRIDGE: smart-home catalogue (09_catalogue) — SMARTHOME-DB-001 + RESEARCH-001
- Decision list D-01…D-07 in RESEARCH-001. Decision files: none.

## 7. Do not touch
- `SMARTHOME-DB-001.json`, `smarthome-db.html` by hand (README).

Forrás: BRIDGE/09_catalogue/README.md, git log main, 2026-10-31
