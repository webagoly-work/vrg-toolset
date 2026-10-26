# P1 · Companion server

Stub (KV-02, 2026-10-26). Plan: `docs/city/README.md` §8; source: the report `docs/research/reports/Kódváros live workspace and GitWorld.md` §6.1.

- **Goal:** `CodeCity/companion.js` from the Kapu server: serves the city on 127.0.0.1 with token, Host/Origin, whitelist and realpath rules; the `file://` build keeps working; START.cmd entry; Kapu companion tests re-pointed.
- **Done-check:** `node tools/check-start.js` passes; the page opens from START.cmd served and still from `file://`; selftest green.
- **Files:** CodeCity/companion.js, CodeCity/from-kapu/companion-server.js, CodeCity/from-kapu/test/spec-95-companion.js, CodeCity/tools/selftest.js, START.cmd, VRG-DE.cmd
- **Decisions:** D9, D10
- **Prompts:** KV-03, KV-04
- **Status:** open
