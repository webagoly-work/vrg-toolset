# P6 · Process supervisor

Stub (KV-02, 2026-10-26). Plan: `docs/city/README.md` §8; source: the report `docs/research/reports/Kódváros live workspace and GitWorld.md` §6.1.

- **Goal:** Config-listed jobs (serve.js servers, builds, selftests), log ring buffers, `taskkill /T`; city gates; port street; pipes; weather; inspector beacon; Now ribbon and advisors.
- **Done-check:** Start MindMap's server from the city → its gate lights and its log streams; a failing selftest raises a storm; stop kills the whole tree.
- **Files:** CodeCity/companion.js, CodeCity/src/*
- **Decisions:** D9
- **Prompts:** see PROMPTS-WORKSPACE.md
- **Status:** DONE 2026-10-26 — KV-14 ada1352 (jobs, gates, port street), KV-15 9779674 (weather, repair tunnel, pipes, inspector lamps, Now ribbon)

## Notes (KV-15)

- Left out on purpose: fog over districts without tests (README §7.1 #8) — it would grey most of the city and
  break R1 (a calm city means all is well). Smoke (TODO counts) and cracks (long functions) are not measured yet,
  so the inspector's lamp sums weather and stale builds only.
