# P9 · GitWorld planet

Stub (KV-02, 2026-10-26). Plan: `docs/city/README.md` §8; source: the report `docs/research/reports/Kódváros live workspace and GitWorld.md` §6.1.

- **Goal:** `CodeCity/world.js` fetcher (ETag cache) from `vendor-manifest.json` + metadata; own sphere; continents; globe → Land morph.
- **Done-check:** The vendored repos sit as foreign cities on their continents with licence colours; offline, the planet renders from the snapshot.
- **Files:** CodeCity/world.js (new), vendor-manifest.json
- **Decisions:** D21, D22
- **Prompts:** see PROMPTS-WORKSPACE.md
- **Status:** DONE 2026-10-26 — KV-20 1bec540 (world.js snapshot, globe with the Land on its pole, continents, licence colours, offline)

## Notes (KV-20)

- The globe → Land morph is real geometry: the planet is ~12× the Land and the Land sits on its north pole, so the
  surface curves away like a horizon. No morph shader, no seam; float32 is still exact at this size.
- Left for later: the Map of GitHub as a faint background (anvaka; code MIT, data "please attribute") — own data file.
- Refresh: `node CodeCity/world.js` then `node CodeCity/build.js`; unauthenticated, ~40 requests of the 60/h.
