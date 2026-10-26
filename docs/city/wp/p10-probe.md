# P10 · Probe sidecar (Tier A)

Stub (KV-02, 2026-10-26). Plan: `docs/city/README.md` §8; source: the report `docs/research/reports/Kódváros live workspace and GitWorld.md` §6.1.

- **Goal:** `vrg-probe.exe`: windows + WinEvents, Core Audio, GSMTC stadium, Bluetooth, USB tree; open programs as temporary constructs.
- **Done-check:** Spotify playing → the stadium lights; dragging a sound tower changes its volume; Paint raises a construct that dissolves when closed.
- **Files:** CodeCity/probe/ (new), Planner/apps/dotnet
- **Decisions:** D18, D25, D27
- **Prompts:** see PROMPTS-WORKSPACE.md
- **Status:** open — KV-21 done (sidecar spike), KV-22 next

**KV-21 (2026-10-26):** `CodeCity/probe/` (Program.cs, vrg-probe.csproj, NuGet.config with no source = offline build),
`node CodeCity/tools/build-probe.js` → `CodeCity/probe/bin/publish/vrg-probe.exe` (gitignored). JSON lines: hello, windows,
open / close / fg; taskbar windows only (visible, uncloaked, titled, unowned, not a tool window, not the shell); exe +
product name, never a title. The segéd starts it while a page listens, restarts it after 1, 2, 4 … 30 s when it dies,
stops it with the power sampler; stdin closing ends it. Page: `src/33-apps.js` — a frame rises on a ring around Erőmű
(cyan = in front), dissolves up and out when the last window closes; the Land panel lists "Futó programok".
Checks: `spec-probe.js` (fake probe: open, close, crash → restart, no title on the wire) in the selftest; `#appstest=open|close`;
by hand with the real exe and real Paint: the entry arrived ~330 ms after Paint opened and left ~350 ms after it closed.
Open: the self-contained publish (README §5); ApplicationFrameHost.exe stands for every UWP app (Settings, Calculator…) —
resolve the real app in KV-22.
