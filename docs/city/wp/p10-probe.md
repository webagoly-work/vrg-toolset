# P10 · Probe sidecar (Tier A)

Stub (KV-02, 2026-10-26). Plan: `docs/city/README.md` §8; source: the report `docs/research/reports/Kódváros live workspace and GitWorld.md` §6.1.

- **Goal:** `vrg-probe.exe`: windows + WinEvents, Core Audio, GSMTC stadium, Bluetooth, USB tree; open programs as temporary constructs.
- **Done-check:** Spotify playing → the stadium lights; dragging a sound tower changes its volume; Paint raises a construct that dissolves when closed.
- **Files:** CodeCity/probe/ (new), Planner/apps/dotnet
- **Decisions:** D18, D25, D27
- **Prompts:** see PROMPTS-WORKSPACE.md
- **Status:** DONE (KV-21, KV-22) — the check with Spotify itself is the user's (it was not running)

**KV-21 (2026-10-26):** `CodeCity/probe/` (Program.cs, vrg-probe.csproj, NuGet.config with no source = offline build),
`node CodeCity/tools/build-probe.js` → `CodeCity/probe/bin/publish/vrg-probe.exe` (gitignored). JSON lines: hello, windows,
open / close / fg; taskbar windows only (visible, uncloaked, titled, unowned, not a tool window, not the shell); exe +
product name, never a title. The segéd starts it while a page listens, restarts it after 1, 2, 4 … 30 s when it dies,
stops it with the power sampler; stdin closing ends it. Page: `src/33-apps.js` — a frame rises on a ring around Erőmű
(cyan = in front), dissolves up and out when the last window closes; the Land panel lists "Futó programok".
Checks: `spec-probe.js` (fake probe: open, close, crash → restart, no title on the wire) in the selftest; `#appstest=open|close`;
by hand with the real exe and real Paint: the entry arrived ~330 ms after Paint opened and left ~350 ms after it closed.
Open: the self-contained publish (README §5).

**KV-22 (2026-10-26):** the probe grew three threads. `Audio.cs` (Core Audio, default playback device): a tower per program
(volume, mute, active), per-session + device peak meters every 80 ms (sent only when they change; silence sends
nothing), volume/mute from stdin. `Media.cs` (GSMTC through raw WinRT vtables — the C# projection needs a nuget.org
package; ids and slots read from this machine's Windows.Media.winmd): app, status, title, artist, once a second.
`Devices.cs` (SetupAPI, every 2 s): the USB port tree from LocationPaths; paired Bluetooth devices, battery from the
hands-free child node — Windows publishes it only while connected, so battery = connected. Ids are hashed. UWP windows
now name their real app (the child window's process) instead of ApplicationFrameHost.
Segéd: 'audio', 'peaks', 'media', 'bt', 'usb' relayed (last state replayed to a new page); POST probe-volume {key, v} and
probe-mute {key, on}, only for a program that has a tower. Page: `src/34-stadium.js` + the Stadion place (land.json,
slot 0,-1) — floodlights and a scoreboard while something plays (Spotify first), the field glows with its peak; towers
on the field, drag up/down or the Land panel's slider; BT buoys with a battery ring and the USB port board at USB-falu.
Checks: spec-probe (5 cases: + feeds, + volume/mute refused for unknown program, bad value, extra key, no token);
`#stadiumtest=play|pause|drag` (drag from 50 % to 73 %); by hand with the real probe: Opera's video lit the stadium feed,
its tower went 0.92 → 0.90 through POST probe-volume and back. Gotcha: pwDraw has a local `st` — 34-stadium's state is
global `st`, so 30-power calls `stRedraw()` instead of touching it.
