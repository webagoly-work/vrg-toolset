# Portable dev tools installed 2026-11 (Playwright, JDK 21, Ghidra, JADX)

Installed 2026-11-18 into `H:\VRG\Full\tools`, portable: no admin rights, nothing system-wide, no
`JAVA_HOME` / `GHIDRA_INSTALL_DIR` / `NODE_PATH` set machine-wide or per-user (checked: all empty). Every
zip is kept in `H:\VRG\Backup\installers\zipped`; START → BACKUP → 5 lists them (`installerRules` in
`launcher/vrg-menu.json`). Nothing was analysed with Ghidra or JADX.

| Tool | Version | Folder | Source | Published hash | Verified |
|---|---|---|---|---|---|
| Playwright (npm) | 1.64.1, exact pin | `tools\playwright` | `https://registry.npmjs.org/playwright/-/playwright-1.64.1.tgz` | sha512 `HCrVhHr5QQuwYoswEUGTb7gGp522yflbv/ST8nF4sFWGuLjQCt17Q/EubpGGSNKYn1tsTCPZxqHhHCfVURu7UA==` (npm `dist.integrity`) | npm checks it on install; lockfile = registry |
| playwright-core (npm, dependency) | 1.64.1 | `tools\playwright\node_modules` | `https://registry.npmjs.org/playwright-core/-/playwright-core-1.64.1.tgz` | sha512 `BC4s8y6SEVA6Q1rSxZTto8hI1KUI3xXlHGZgvGqP4IqPdI/a6FX9H29IDNz7vKo9l21b6LfYosScPL6M3xxyDQ==` | as above |
| Chromium for Playwright | chromium-1248, chromium_headless_shell-1248 (156.0.8078.4), ffmpeg-1013, winldd-1007 | `tools\playwright\browsers` | `cdn.playwright.dev`, via `playwright install chromium` | **none published** by Playwright for its browser builds | not verifiable |
| Eclipse Temurin JDK | 21.0.13+9 (LTS), x64 Windows zip | `tools\jdk-21` | `https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.13%2B9/OpenJDK21U-jdk_x64_windows_hotspot_21.0.13_9.zip` (found through `api.adoptium.net`) | sha256 `a4dbaa05fca4bd89d84584e58c459bd732efebb1722af80ab13c6516832004f9` (`.sha256.txt` next to the zip, kept too) | match |
| Ghidra | 12.1.4 (`ghidra_12.1.4_PUBLIC_20260921.zip`) | `tools\ghidra` | `https://github.com/NationalSecurityAgency/ghidra/releases/download/Ghidra_12.1.4_build/ghidra_12.1.4_PUBLIC_20260921.zip` | sha256 `ddac49f903da9d5bac833e5cc79395098b9c33cfd3279be5f31bd00387d2d4db` (release notes) | match |
| JADX | 1.5.6, plain `jadx-1.5.6.zip` (no bundled JRE) | `tools\jadx` | `https://github.com/skylot/jadx/releases/download/v1.5.6/jadx-1.5.6.zip` | **the project publishes no checksum**; GitHub's own asset digest: sha256 `545ea2be9c242511bc145755cf4bda2485ade42966e096f8b4d3da2a230e8974` | matches GitHub's digest |

Playwright 1.64.1 rather than the newest 1.65.1: 1.65.1 was five days old on install day; 1.64.1 had been
out a month.

## Use

**Playwright.** `Mobile/tests/relay-e2e.js` loads `playwright` normally and otherwise falls back to
`<repo>\..\tools\playwright\node_modules\playwright`, setting `PLAYWRIGHT_BROWSERS_PATH` to
`tools\playwright\browsers` when it is unset. `Mobile\mobile.cmd e2e` sets `NODE_PATH` and
`PLAYWRIGHT_BROWSERS_PATH` the same way. The fallback is relative to the repo, so it works from the main
checkout, not from a worktree under `.claude\worktrees` (set `NODE_PATH` there).

Reinstall from the kept lockfile (`installers\zipped\playwright-1.64.1\`):

```bat
cd /d H:\VRG\Full\tools\playwright
copy ...\playwright-1.64.1-package.json package.json & copy ...\playwright-1.64.1-package-lock.json package-lock.json
..\node\npm.cmd ci
set PLAYWRIGHT_BROWSERS_PATH=H:\VRG\Full\tools\playwright\browsers
..\node\node.exe node_modules\playwright\cli.js install chromium
```

**JDK 21, Ghidra, JADX** (REA phase R3 / R5, `docs/research/2026-10-20_rea-reverse-engineer-anything.md`):
set Java in that one shell only.

```bat
set "JAVA_HOME=H:\VRG\Full\tools\jdk-21" & set "PATH=%JAVA_HOME%\bin;%PATH%"
H:\VRG\Full\tools\jadx\bin\jadx.bat --version
H:\VRG\Full\tools\ghidra\support\analyzeHeadless.bat -help
```

For REA set `GHIDRA_INSTALL_DIR=H:\VRG\Full\tools\ghidra` the same way, per shell.

## Checks on install day

- `java -version` (JDK 21 shell): `openjdk version "21.0.13" 2026-10-20 LTS`, Temurin-21.0.13+9.
- `jadx.bat --version`: `1.5.6`, exit 0.
- `analyzeHeadless.bat -help`: prints the Headless Analyzer usage (exit 1 is its normal usage exit).
- The Android build's JDK is unchanged: `Mobile\mobile.cmd`'s `:FIND_JAVA`, run verbatim, still picks
  `...\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Local\Android\jdk-17.0.20.1+1` (Temurin 17.0.20.1). JDK 21
  went to `tools\jdk-21`, which is none of its candidates (`tools\jdk` is one: do not rename it to that).
  Note: that JDK 17 is only seen through the Claude desktop app's `%LOCALAPPDATA%` redirect; from a plain
  shell (this CLI session, the user's own window) `:FIND_JAVA` finds no Java at all. That was so before.
- `node Mobile/tests/relay-e2e.js` (main checkout, no `NODE_PATH`): Playwright and Chromium load and the
  page runs; 21 ok, **1 FAIL: "unknown command is nacked"** (the phone gets no `ack` with `ok:false` /
  `unknown` from Kódváros for `edit.undo`). Not a Playwright problem; open. The "did not run: Playwright is
  not installed" lines in WP M7, M8, M11 and M12 are therefore left as they were.
