# P8 · The Land

Stub (KV-02, 2026-10-26). Plan: `docs/city/README.md` §8; source: the report `docs/research/reports/Kódváros live workspace and GitWorld.md` §6.1.

- **Goal:** `land.json` hex slots; nested frames; table view, breadcrumb, Home key; Tárház, Erőmű, Pályaudvar + Határ; shoreline; flows; TCP table + DB-IP Lite; ships, USB-falu and trains.
- **Done-check:** Zoom from the Land to a file floor without jitter; a 100 MB download sails in as a ship; copying to a stick runs a train.
- **Files:** CodeCity/land.json (new), CodeCity/companion.js, CodeCity/src/*
- **Decisions:** D23, D24, D28
- **Prompts:** see PROMPTS-WORKSPACE.md
- **Status:** DONE 2026-10-26 — KV-17 a3b7b5a (Land, breadcrumb, inset, Home, Tárház in memory), KV-18 57e8a07 (Erőmű, station, border, shoreline), KV-19 3fe20ea (ships, planes, trains, customs)

## Open for the user (P8)

- **The real USB check:** plug a stick in, open the city in live mode (START.cmd K → S), copy a big file to the stick:
  USB-falu must rise, a train must run while it copies, and the Land panel must say "Még úton van N kocsi" until the
  writes stop. Built and simulated (`#cargotest=1`), not yet seen with a real stick.
