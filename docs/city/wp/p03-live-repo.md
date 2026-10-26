# P3 · Live repo stream

Stub (KV-02, 2026-10-26). Plan: `docs/city/README.md` §8; source: the report `docs/research/reports/Kódváros live workspace and GitWorld.md` §6.1.

- **Goal:** Watcher → incremental rescan → SSE (`/api/stream`); `.git` refs watch; "Mi változott?" since the last visit.
- **Done-check:** Edit a file in VS Code → its building pulses within ~1 s; a commit updates the timeline without reload.
- **Files:** CodeCity/companion.js, CodeCity/scan.js, CodeCity/src/*
- **Decisions:** D9
- **Prompts:** KV-08
- **Status:** DONE 2026-10-26 — KV-08 a62235f (watch + SSE + /api/city, pulses, in-place swap, Mi változott?)
