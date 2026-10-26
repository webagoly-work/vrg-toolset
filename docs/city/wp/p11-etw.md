# P11 · Elevated ETW (Tier B, optional)

Stub (KV-02, 2026-10-26). Plan: `docs/city/README.md` §8; source: the report `docs/research/reports/Kódváros live workspace and GitWorld.md` §6.1.

- **Goal:** `vrg-etw.exe` (elevated, read-only, named pipe) for exact cargo, Bash file reads and the process tree; the user creates the scheduled task.
- **Done-check:** A `git clone` shows the exact cargo per process; a file read inside a Bash command beams to its roof.
- **Files:** CodeCity/etw/ (new)
- **Decisions:** D17, D23
- **Prompts:** see PROMPTS-WORKSPACE.md
- **Status:** DONE — built 2026-10-26 (KV-23); the user installed it and created the task; checked 2026-10-27

**The check (2026-10-27, the user's task running vrg-etw elevated):** the real companion read `\\.\pipe\vrg-etw`; a
`git clone --depth 1 octocat/Hello-World` came through as `git-remote-https` with its exact bytes (↓7975 ↑58684 B), marked
"started by Claude", dock web, country GB — no address on the stream; `cmd /c type GO-LIVE.md` started from a Claude
session beamed GO-LIVE.md to that session (via cmd, kind read). Found on the way: a project's own `node_modules` deep in the
tree beamed a stream of reads from another session's tests — now skipped at any depth (and `.git`), in the segéd at once
and in vrg-etw from the next install (run install-etw.ps1 again after `node CodeCity/tools/build-etw.js`; optional).

## KV-23: what was built

- `CodeCity/etw/` (Program.cs, vrg-etw.csproj, NuGet.config = nuget.org only, packages.lock.json = every package pinned by
  content hash; `node CodeCity/tools/build-etw.js` restores in locked mode). Library: **Microsoft.Diagnostics.Tracing.TraceEvent
  3.2.8** (MIT, nuget.org, published 2026-09-28; 4.0.0 was 12 days old, so not taken). It is not in vendor-manifest.json
  (that file lists Vendor/ and npm parts; the lock file is the pin here) — add an entry if the manifest should list NuGet too.
- One named ETW session "VRG-Kodvaros-ETW" (never "NT Kernel Logger", so no other tool's trace is stopped): Kernel-Network
  (TCP/UDP, v4 + v6), Kernel-Process (+ the rundown), Kernel-File reads/writes **inside this repo only** (the root is baked
  in at build time; .git, node_modules, Planner/apps, .cache, Vendor skipped), DNS-Client 3008. The session runs only while
  a reader is on the pipe and stops 30 s after the last one left (city closed = ~0 %).
- Out: `\\.\pipe\vrg-etw`, JSON lines: hello + the process tree for each new reader, then `net` (per process per second: bytes,
  top 6 destinations), `file`, `proc`, `dns`. The pipe: your account may read, nobody may write, the network is denied.
  It takes no command and no argument but `--demo` (made-up lines on `vrg-etw-demo`, unelevated).
- It runs from `C:\Program Files\VRG\Kodvaros-ETW` with its own runtime copy in `.\dotnet` (AppHostDotNetSearch=AppRelative):
  an elevated task must never start an exe or load a runtime from a user-writable folder (H:\ is one), or anything running
  as you could swap the file and get admin rights.
- The segéd reads the pipe while a page listens: `etwcargo` (per process: exact bytes by dock and country — the addresses stay
  in the segéd), `etw` on/off; a repo file read or written by a process whose ancestor is a Claude session (by the pid in
  `claude agents --json`) becomes that session's beam (`via`: the exe). claude.exe's own reads are left to its hook.
- Page: `src/35-etw.js` — a manifest board at Határ (a bar pair per process, gold rim = started by Claude) and the Land
  panel's "Pontos rakomány (ETW)".
- Tested here, unelevated: the real mode refuses (exit 2), an unknown argument too (64); the installed layout (into a temp
  folder) starts from its own .\dotnet with no DOTNET_ROOT; `--demo` serves the pipe and a non-admin reader reads it;
  spec-etw.js (3 cases) in the selftest. **Not tested: the kernel session itself — that needs your elevated task.**

## Your steps (CITY-D17 A: you create the task; Claude never does)

1. **Build** (already done once; again after pulling changes): `node CodeCity/tools/build-etw.js`
2. **Install** — Start menu → type *PowerShell* → right-click **Windows PowerShell** → **Run as administrator** → paste:
   `powershell -NoProfile -ExecutionPolicy Bypass -File H:\cwebuser\projects\VRG-DE\Planner_VRG_U100\CodeCity\etw\install-etw.ps1`
   It copies vrg-etw and the .NET runtime into `C:\Program Files\VRG\Kodvaros-ETW` and prints two SHA-256 hashes.
   It creates no task. Run it again after every rebuild.
3. **Create the task** — Start → type *Task Scheduler* → open it → right side **Create Task…** (not "Basic Task"):
   - **General:** Name `VRG Kodvaros ETW` · *Run only when user is logged on* · tick **Run with highest privileges** ·
     Configure for: Windows 10.
   - **Triggers** → New… → Begin the task: **At log on** · Specific user: you → OK.
   - **Actions** → New… → Start a program → Program/script: `"C:\Program Files\VRG\Kodvaros-ETW\vrg-etw.exe"` · no
     arguments → OK.
   - **Conditions:** untick *Start the task only if the computer is on AC power*.
   - **Settings:** untick *Stop the task if it runs longer than 3 days* · If the task is already running: *Do not start a
     new instance* → OK.
   - Right-click the new task → **Run** (so you need not log off). It shows no window.
4. **Check** (then tell Claude "KV-23 check"): START.cmd → K → S (live mode) → Home (the Land). The Land panel shows
   *Pontos rakomány (ETW)*. Then (a) in any folder outside the repo: `git clone https://github.com/git/git-scm.com` — a
   *git-remote-https.exe* line with its exact MB/s and a bar pair at Határ; (b) ask a Claude session in this repo to run
   `cat README.md` in Bash — README.md's roof gets a beam from that session.
5. **Remove** (any time): Task Scheduler → right-click *VRG Kodvaros ETW* → End, then Delete; in an elevated PowerShell:
   `Remove-Item -Recurse "C:\Program Files\VRG\Kodvaros-ETW"`.
