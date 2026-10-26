# Kódváros as a live local workspace: architectures and building blocks

Research date: 2026-10-26. Star counts, licences and last-push dates come from the GitHub REST API or the ecosyste.ms mirror of it, read on 2026-10-26. npm versions come from the npm registry `latest` tag on the same day. "Last push" means the last push to any branch, which is not necessarily a release.

Local context (read from the repo, not a web source): Kódváros (`CodeCity/`) already draws buildings as `THREE.InstancedMesh` and picks them with a `THREE.Raycaster` (`CodeCity/src/03-scene.js` lines 128, 140, 184). It is built from npm `three` (the build stamps `three.js r<N>` into the header, `CodeCity/build.js` line 31). A companion server already exists at `CodeCity/from-kapu/companion-server.js` (196 lines, parked from Kapu). It binds 127.0.0.1, checks Host and Origin against fixed sets, requires a per-install token in an `x-kapu-token` header (compared with `crypto.timingSafeEqual`), allows only whitelisted actions with fixed argument shapes, resolves every path with `realpath` and requires it to sit inside allowed roots, and spawns programs from argument arrays, never from shell strings. It also serves the page itself and injects the token into it, so the page gets a real origin and is not stuck on `file://`.

## Q1. Which architecture: (A) static page + local Node companion, (B) Electron, (C) Tauri, (D) VS Code / code-server as the editor half, (E) PWA?

### Takeaway
Option (A), the companion-server pattern already in the repo, is the cheapest path that delivers every requested feature on Windows 10 offline with portable Node v24. It needs no new toolchain and keeps Kódváros a single HTML file. Electron (B) is the fallback if a real desktop window is wanted, at roughly 100–300 MB. Tauri (C) is smaller but brings Rust and MSVC into a project whose user does not code. VS Code (D) is a strong "editor half" to link to, or a host for Kódváros as a webview, rather than something to embed. A PWA (E) alone cannot launch processes, so it still needs (A).

### Cited Findings
- **Pages on `file://` cannot start web workers.** The Monaco FAQ says "HTML5 does not allow pages loaded on `file://` to create web workers", so Monaco must be served over http(s). — [monaco-editor README/FAQ](https://github.com/microsoft/monaco-editor)
- **Electron**: MIT, 123.6k stars, pushed 2026-10-26; npm `electron` 45.0.0. The npm package is a 1.2 MB launcher that downloads the Chromium-based binary. — [electron/electron](https://github.com/electron/electron), [npm electron](https://www.npmjs.com/package/electron)
- **Electron security checklist**: enable context isolation, enable the renderer sandbox, keep Node integration off for remote content, set a restrictive CSP, limit navigation, validate the IPC sender, prefer a custom protocol over `file://`, and turn off unneeded features with fuses (`runAsNode`, `nodeCliInspect`). — [Electron security tutorial](https://www.electronjs.org/docs/latest/tutorial/security)
- **Tauri**: Apache-2.0, 112.2k stars, pushed 2026-10-26; `@tauri-apps/cli` 2.12.4 (Apache-2.0 OR MIT). — [tauri-apps/tauri](https://github.com/tauri-apps/tauri), [npm @tauri-apps/cli](https://www.npmjs.com/package/@tauri-apps/cli)
- **Tauri on Windows 10** depends on WebView2, which per Tauri's docs ships with Windows 10 (April 2018 release or later) and Windows 11. Installer modes: `downloadBootstrapper` (default, needs internet), `embedBootstrapper` (~1.8 MB), `offlineInstaller` (~127 MB, no internet), `fixedVersion` (~180 MB), `skip`. Tauri officially supports only the MSVC target, and `.msi` builds need WiX, which runs only on Windows. — [Tauri Windows installer docs](https://v2.tauri.app/distribute/windows-installer/)
- **Size comparison**: one same-app benchmark measured Electron at 323 MB and Tauri at 57 MB. Blog estimates put Electron idle memory at 150–300 MB and Tauri at 30–50 MB. Most published figures come from marketing-style posts; the Better Stack test is the only like-for-like measurement found. — [Better Stack: Tauri vs Electron vs Deno vs Electrobun](https://betterstack.com/community/guides/scaling-nodejs/tauri-vs-electron-vs-deno-vs-electrobun/), [OpenReplay comparison](https://blog.openreplay.com/comparing-electron-tauri-desktop-applications/)
- **code-server**: MIT, 79.7k stars, pushed 2026-10-23. It cannot use the Microsoft Marketplace ("Microsoft prohibits the use of any non-Microsoft VS Code from accessing their marketplace") and uses Open VSX instead. It defaults to `bind-addr: 127.0.0.1:8080` with password auth and rate-limited logins. Its webviews need a secure context (HTTPS or localhost) because they use service workers. — [code-server FAQ](https://coder.com/docs/code-server/FAQ), [coder/code-server](https://github.com/coder/code-server)
- **OpenVSCode Server**: MIT, 6.2k stars, pushed 2026-09-24. It is a direct VS Code fork, while code-server pulls VS Code in as a submodule and applies patch files. — [gitpod-io/openvscode-server](https://github.com/gitpod-io/openvscode-server), [code-server FAQ](https://coder.com/docs/code-server/FAQ)
- **VS Code webviews**: local files load only through `asWebviewUri` and within `localResourceRoots`. The guide recommends a CSP starting from `default-src 'none'`. Messaging is JSON `postMessage` through `acquireVsCodeApi()`. `retainContextWhenHidden` has a high memory cost. Panels can be restored after a restart with `registerWebviewPanelSerializer`. Web workers must load from `data:` or `blob:` URIs. — [VS Code Webview API guide](https://code.visualstudio.com/api/extension-guides/webview)
- **VS Code webview UI toolkit** (`microsoft/vscode-webview-ui-toolkit`) was archived (last push 2024-09-24), so it should not be used for new work. — [microsoft/vscode-webview-ui-toolkit](https://github.com/microsoft/vscode-webview-ui-toolkit)
- **Claude Code in VS Code**: the extension registers `vscode://anthropic.claude-code/open`, which opens a Claude Code editor tab. — [Claude Code deep links](https://code.claude.com/docs/en/deep-links)

### Inferences
- **Option (A) companion server — recommended default.** It reuses code the repo already has and tests (`from-kapu/test/spec-95-companion.js`), the portable Node v24 that is already present, and START.cmd as the front door. One `node CodeCity/companion.js` process would serve the page on a real `http://127.0.0.1:<port>` origin, which fixes both the `file://` localStorage problem and the Monaco worker problem. It would add `ws` (or SSE) for live streams, node-pty for terminals, a watcher, and a git wrapper. The static `file://` build can stay as a read-only "view" mode, with live features lighting up only when the companion answers.
- **Option (B) Electron** is worth choosing only if the user wants one desktop icon and one window that behaves like an app (for example, no browser tabs to lose). Everything written for (A) ports almost directly: the companion becomes Electron's main process and the page becomes a sandboxed renderer. The cost is a 100–300 MB runtime and a stream of Chromium security updates.
- **Option (C) Tauri** is smaller, but the Rust and MSVC build chain is a real burden for someone who vibecodes. Spawning node-pty or git from Tauri still needs a Node "sidecar", so the stack ends up as Rust + Node + web.
- **Option (D) VS Code as the editor half.** Two shapes are possible. (D1) Kódváros stays standalone and right-click → "Open in VS Code" uses the portable VS Code at `Planner/apps/vscode`, or `vscode://anthropic.claude-code/open` for a Claude tab. (D2) Kódváros becomes a VS Code extension whose webview is the city, and VS Code's own terminal, git and Claude Code extension do the rest. (D2) gives editor, terminal and git for free, but buries the city inside an IDE chrome that the user finds confusing. Embedding code-server or OpenVSCode in an iframe is heavy (a full VS Code server) and does not reach the Microsoft Marketplace.
- **Option (E) PWA**: a PWA on localhost can be installed as an app window and cache itself offline, but browsers cannot spawn processes. It would therefore be a presentation layer over (A), not an alternative to it.
- **Suggested layering**: (A) now, written so that the companion's action/stream API is the only boundary. Then (B) is a packaging step, not a rewrite.

### Gaps
- Not checked: whether Chrome's "Local Network Access" / Private Network Access restrictions (rolling out in 2025–2026) affect a page served from `http://127.0.0.1` calling the same origin. Same-origin calls should be unaffected, but this was not verified.
- No Windows-specific memory measurement of WebView2 vs Electron was found.
- No source was found that confirms WebGL behaviour inside VS Code webviews; the webview guide does not mention WebGL.

## Q2. Embedded terminal: xterm.js + node-pty (ConPTY), running `claude` inside it

### Takeaway
xterm.js 6 + node-pty 1.1 is the standard, MIT-licensed pair (it is what VS Code uses). node-pty 1.1.0 now ships Windows x64 prebuilt binaries, including its own `conpty.dll` and `OpenConsole.exe`, so portable Node v24 should not need Visual Studio. Claude Code is a native Windows binary that runs in any ConPTY terminal; give it Git Bash via `CLAUDE_CODE_GIT_BASH_PATH`.

### Cited Findings
- **xterm.js**: MIT, 21.3k stars, pushed 2026-10-13. Packages are scoped: `@xterm/xterm` 6.0.0 (released 2025-12-22; the previous release was 5.5.0 in 2024-04), `@xterm/addon-fit` 0.11.0, `@xterm/addon-webgl` 0.19.0, `@xterm/addon-attach` 0.12.0, `@xterm/addon-serialize` 0.14.0, all MIT. — [xtermjs/xterm.js](https://github.com/xtermjs/xterm.js), [npm @xterm/xterm](https://www.npmjs.com/package/@xterm/xterm)
- **node-pty**: Microsoft, 2.1k stars, pushed 2026-10-23. Its `package.json` declares MIT. GitHub reports "NOASSERTION" because the licence file also carries notices from the pty.js fork lineage (Christopher Jeffrey 2012–2015, Daniel Imms 2016, Microsoft 2018). Latest stable is 1.1.0 (2025-12-22); beta is 1.2.0-beta.18. — [microsoft/node-pty](https://github.com/microsoft/node-pty), [npm node-pty](https://www.npmjs.com/package/node-pty)
- **node-pty 1.1.0 prebuilt binaries**: the published package contains `prebuilds/win32-x64/` with `pty.node`, `conpty.node`, `conpty_console_list.node`, `conpty/conpty.dll`, `conpty/OpenConsole.exe` and legacy `winpty.dll`/`winpty-agent.exe`, plus arm64 and darwin builds (63 MB unpacked across all platforms). Its install script is `node scripts/prebuild.js || node-gyp rebuild`, and it depends on `node-addon-api` ^7.1.0. — [unpkg node-pty@1.1.0 listing](https://unpkg.com/node-pty@1.1.0/?meta), [node-pty@1.1.0 package.json](https://unpkg.com/node-pty@1.1.0/package.json)
- **The README still describes building from source on Windows** (Python, a C++ compiler, the Windows SDK and Spectre-mitigated libraries, or the build fails with MSB8040). It needs Windows 10 1809+ for ConPTY, says winpty has been removed, says the library is not thread-safe, says pty processes run with the parent's permissions (and recommends a container for internet-exposed servers), and warns that PowerShell fails with error 8009001d when the `SystemRoot` environment variable is missing. — [microsoft/node-pty README](https://github.com/microsoft/node-pty)
- **Recent Windows fixes in the 1.2.0 beta line**: beta.14 (2026-06-26) surfaces CreateProcessW failures as `exit` instead of an uncaughtException and closes pipe handles when a ConPTY spawn fails. beta.15 (2026-08-03) fixes a ConPTY deadlock when a debugger pauses the conout worker. beta.17 (2026-10-22) moves to Node 24.22.1 and adds `ConptyReparentPseudoConsole` support. — [node-pty releases](https://github.com/microsoft/node-pty/releases)
- **`@lydell/node-pty`** (MIT, 34 stars, 1.2.0-beta.18) is a "smaller distribution of microsoft/node-pty". `homebridge/node-pty-prebuilt-multiarch` (70 stars) is another prebuilt fork. — [lydell/node-pty](https://github.com/lydell/node-pty), [homebridge/node-pty-prebuilt-multiarch](https://github.com/homebridge/node-pty-prebuilt-multiarch)
- **Claude Code on Windows**: supports Windows 10 1809+ and does not need Administrator rights. Without Git for Windows it uses a PowerShell tool; with it, Git Bash powers the Bash and Monitor tools. If Git Bash isn't found, set `"env": {"CLAUDE_CODE_GIT_BASH_PATH": "C:\\...\\bin\\bash.exe"}`. Sandboxing is not supported on native Windows (only in WSL 2). The npm package installs a native binary that "does not itself invoke Node". — [Claude Code advanced setup](https://code.claude.com/docs/en/setup)

### Inferences
- **Why prebuilds should work with Node v24**: node-pty's native code uses `node-addon-api` (Node-API, which is ABI-stable across Node versions). The 1.1.0 Windows prebuilds should therefore load under portable Node v24 without a rebuild. Test this once on this machine before relying on it.
- **Shape of the terminal panel**: the companion holds the `IPty`, and a WebSocket carries the bytes. Use `@xterm/addon-attach` or a hand-rolled bridge, `addon-fit` for resizing (forward `pty.resize(cols, rows)`), `addon-webgl` for speed, and `addon-serialize` so a reconnecting page can replay the scrollback.
- **Running `claude` in the panel**: spawn `claude` (or the repo's `Planner/apps/node/claude.cmd` that Kapu already resolves) with `cwd` set to the building's folder. Pass a full environment that includes `SystemRoot`, or PowerShell breaks. Set `CLAUDE_CODE_GIT_BASH_PATH` to `H:\_desktop\Git\bin\bash.exe` or `Planner\apps\git\bin\bash.exe`.
- **Process ownership**: a pty child dies with the companion unless detached. "Claude terminal" panels should be named sessions (`claude -n <name>`) so that, if the companion restarts, the user can reattach with `claude --resume <name>` rather than lose work.
- **Alternative with no PTY**: launch a real Windows Terminal window via the `claude-cli://open?cwd=...&q=...` deep link (see Q4). This needs no native module at all and is a good first step before the embedded terminal.

### Gaps
- Not verified: whether `prebuild.js` picks the prebuild correctly when npm runs under a portable Node that is not on the system PATH.
- No reports were found on Claude Code's full-screen TUI rendering quirks inside xterm.js on ConPTY specifically; VS Code's integrated terminal is the closest proof that it works, but that was not cited.

## Q3. Embedded editor: Monaco vs CodeMirror 6, diff view, markdown preview

### Takeaway
Both are MIT. Monaco is "VS Code in a box": familiar, with a built-in diff editor, but heavy (the npm package unpacks to 99 MB) and it needs http(s) for its workers. CodeMirror 6 is modular and small, has an official `@codemirror/merge` diff package, and works from `file://`. For a non-coder who mostly reads files, previews markdown and accepts or rejects Claude's edits, CodeMirror 6 + `@codemirror/merge` + `markdown-it` is the lighter choice. Monaco is right if VS Code familiarity matters more than size.

### Cited Findings
- **Monaco**: MIT, 46.9k stars, pushed 2026-10-26; npm `monaco-editor` 0.57.0, 99 MB unpacked. It is generated from VS Code's sources. The AMD build "is deprecated and will be removed in future versions"; ESM lives in `/esm`. Mobile browsers are not supported, VS Code extensions do not run in it, and it needs http(s) for web workers. — [microsoft/monaco-editor](https://github.com/microsoft/monaco-editor), [npm monaco-editor](https://www.npmjs.com/package/monaco-editor)
- **`@monaco-editor/react`** 4.7.0 (MIT, 4.8k stars) is a React wrapper; it is not needed for vanilla JS. — [suren-atoyan/monaco-react](https://github.com/suren-atoyan/monaco-react)
- **CodeMirror 6 has moved off GitHub.** The GitHub mirrors `codemirror/dev` (7.8k stars) and `codemirror/view` were archived on 2026-04-15. codemirror.net says the editor "is being developed on code.haverbeke.berlin". Licence MIT. — [codemirror/dev on GitHub](https://github.com/codemirror/dev), [codemirror.net](https://codemirror.net/)
- **CodeMirror npm packages are still published**: `codemirror` 6.0.2, `@codemirror/view` 6.43.15, `@codemirror/merge` 6.12.3 (179 KB unpacked), `@codemirror/lang-markdown` 6.5.2, all MIT. — [npm @codemirror/merge](https://www.npmjs.com/package/@codemirror/merge), [npm @codemirror/view](https://www.npmjs.com/package/@codemirror/view)
- **`replit/codemirror-vim`** (MIT, 480 stars, pushed 2026-07-29) shows the CM6 plugin ecosystem is still alive. — [replit/codemirror-vim](https://github.com/replit/codemirror-vim)
- **Markdown and diff helpers**: `markdown-it` 15.0.3 (MIT), `marked` 18.1.2 (MIT), `dompurify` 3.4.17 (MPL-2.0 OR Apache-2.0), `diff`/jsdiff 9.0.0 (BSD-3-Clause, 9.2k stars, pushed 2026-10-24), `diff2html` 3.4.56 (MIT, 3.4k stars). — [npm markdown-it](https://www.npmjs.com/package/markdown-it), [npm dompurify](https://www.npmjs.com/package/dompurify), [kpdecker/jsdiff](https://github.com/kpdecker/jsdiff), [rtfpessoa/diff2html](https://github.com/rtfpessoa/diff2html)

### Inferences
- **Monaco's diff editor** (`monaco.editor.createDiffEditor`) is well known but was not re-verified against current docs here. CodeMirror's merge package is the documented alternative.
- **The CodeMirror move does not change the licence or npm, but it does affect vendoring.** The repo's `vendor-manifest.json` rule (pin to a tag) would need to point at code.haverbeke.berlin or at the npm tarball (`source: "npm"` with an integrity digest), not at the archived GitHub mirror.
- **"Diff before it lands" as a Kódváros feature**: a `PreToolUse` hook on `Edit|Write` (Q4) can hand the proposed change to the city. The city then shows a merge view on the building before Claude writes it. This works best with `PermissionRequest` hooks or `--permission-prompt-tool` so the user's click becomes the approval.
- **Markdown preview**: `markdown-it` + DOMPurify is enough. BSD-3 jsdiff requires its notice to be kept (per CLAUDE.md vendoring rules).

### Gaps
- No current size figure was found for a minimal CM6 bundle or a minimal Monaco ESM bundle (npm unpacked size overstates what ships).

## Q4. Claude Code integration: hooks, transcripts, Agent SDK, `claude -p` stream-json, MCP, deep links; showing Claude "reaching addresses on H:" live

### Takeaway
The cleanest live feed is an **HTTP hook**. Claude Code POSTs each `PreToolUse`/`PostToolUse` event (tool name, `tool_input`, `cwd`, `session_id`, `transcript_path`) straight to the companion at `http://127.0.0.1:<port>/hooks`. If the city isn't running, the hook fails non-blocking, so Claude carries on. `claude agents --json` lists the parallel sessions and their states. Deep links (`claude-cli://open`, `claude://code/new`) open a Claude Code terminal or the desktop app from a right-click. Do not parse the transcript JSONL as a stable API.

### Cited Findings
- **Hook events**: Claude Code currently has 33 hook events, including `SessionStart`, `UserPromptSubmit`, `PreToolUse` (can block), `PermissionRequest`, `PostToolUse`, `PostToolUseFailure`, `PostToolBatch`, `SubagentStart`/`SubagentStop`, `TaskCreated`/`TaskCompleted`, `Stop`, `CwdChanged`, `FileChanged`, `WorktreeCreate`/`WorktreeRemove`, `PreCompact`/`PostCompact`, `SessionEnd` and others. — [Claude Code hooks reference](https://code.claude.com/docs/en/hooks)
- **Hook input fields**: every event carries `session_id`, `prompt_id`, `transcript_path`, `cwd`, `scratchpad_dir`, `permission_mode`, `effort`, `hook_event_name`, and `agent_id`/`agent_type` inside subagents. Tool events add `tool_name`, `tool_input`, `tool_use_id`. — [Claude Code hooks reference](https://code.claude.com/docs/en/hooks)
- **Hook types**: `command`, `http` (POSTs the JSON to a `url`, with optional `headers` such as `"Authorization": "Bearer $MY_TOKEN"` and `allowedEnvVars` controlling interpolation), `mcp_tool`, `prompt`, `agent` (experimental). — [Claude Code hooks reference](https://code.claude.com/docs/en/hooks)
- **HTTP hook failures don't block**: non-2xx responses and connection failures are non-blocking errors by default. `"onFailure": "block"` (v2.1.295+) turns failures into blocks. Command hooks can set `"async": true` to run in the background. Exit code 2 blocks; other non-zero codes are non-blocking. — [Claude Code hooks reference](https://code.claude.com/docs/en/hooks)
- **Hook config locations**: `~/.claude/settings.json`, `.claude/settings.json`, `.claude/settings.local.json`, managed policy, plugin `hooks/hooks.json`, and skill or subagent frontmatter. — [Claude Code hooks reference](https://code.claude.com/docs/en/hooks)
- **Transcripts**: stored at `~/.claude/projects/<project>/<session-id>.jsonl`. The docs warn: "The entry format is internal to Claude Code and changes between versions". Recommended script interfaces are `claude -p --output-format json|stream-json`, `claude -p --resume <id>`, the `transcript_path` hook field, and the Agent SDK. Default retention is 30 days (`cleanupPeriodDays`). — [Claude Code sessions](https://code.claude.com/docs/en/sessions)
- **Headless mode**: `claude -p` takes `--output-format text|json|stream-json`. Add `--verbose --include-partial-messages` for token streaming. Subagent messages carry `parent_tool_use_id`, and `--forward-subagent-text` adds their text. The first event is `system/init` (model, tools, MCP servers, plugins, `capabilities`). `--resume <session-id>` continues a session. — [Claude Code headless](https://code.claude.com/docs/en/headless)
- **Headless permissions**: `--allowedTools` and `--permission-mode` (`auto`, `dontAsk`, `acceptEdits`) control what runs. Since v2.1.302, `-p` runs start in Manual mode, and calls that need approval are denied unless a `PermissionRequest` hook or `--permission-prompt-tool` approves them. — [Claude Code headless](https://code.claude.com/docs/en/headless)
- **Bare mode**: `--bare` skips hooks, skills, plugins, MCP and CLAUDE.md, does not read OAuth credentials, and needs `ANTHROPIC_API_KEY`. The docs say it "will become the default for `-p` in a future release". — [Claude Code headless](https://code.claude.com/docs/en/headless)
- **Agent SDK**: TypeScript and Python packages "that run the Claude Code binary", with built-in tools, hooks, subagents, MCP, permissions, sessions and plugins. Terms: Anthropic Commercial Terms of Service. The docs note: "Unless previously approved, Anthropic does not allow third party developers to offer claude.ai login or rate limits for their products, including agents built on the Claude Agent SDK." — [Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview)
- **Agent SDK packages**: npm `@anthropic-ai/claude-agent-sdk` 0.3.310 ("SEE LICENSE IN README.md"); `anthropics/claude-agent-sdk-typescript` has 1.8k stars, pushed 2026-10-23; `anthropics/claude-agent-sdk-python` has 8.3k stars, MIT, pushed 2026-10-21. — [npm @anthropic-ai/claude-agent-sdk](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk), [claude-agent-sdk-python](https://github.com/anthropics/claude-agent-sdk-python)
- **Parallel sessions (agent view)**: `claude agents --json [--all] [--cwd <path>]` is "the supported interface" for session state. Fields: `cwd`, `kind` (`interactive`|`background`), `startedAt`, `id`, `state` (`working`|`blocked`|`done`|`failed`|`stopped`), `pid`, `status` (`busy`|`waiting`|`idle`), `waitingFor` (e.g. `permission prompt`), `sessionId`, `name`. Background sessions start with `claude --bg`; `claude attach|logs|stop|respawn|rm <id>` manage them. Files under `~/.claude/jobs/<id>/` are "not a stable interface". It is a research preview. — [Claude Code agent view](https://code.claude.com/docs/en/agent-view)
- **Background worktrees**: background sessions that start editing move into their own git worktree under `.claude/worktrees/`. Control this with `worktree.bgIsolation`. `claude rm` keeps a worktree that has uncommitted changes, but deleting from agent view (`Ctrl+X` twice) removes it including uncommitted changes. — [Claude Code agent view](https://code.claude.com/docs/en/agent-view)
- **Session handling**: `claude -n <name>` names a session, `claude --resume <name|id|transcript-path>` resumes one, and `/branch` or `--fork-session` branches one. The session picker can widen to all worktrees (`Ctrl+W`) or all projects (`Ctrl+A`). Checkpointing can "rewind code and conversation to an earlier point". — [Claude Code sessions](https://code.claude.com/docs/en/sessions)
- **`claude-cli://` deep link**: `claude-cli://open?cwd=<abs path>&q=<url-encoded prompt>` (or `repo=owner/name`) opens Claude Code in a new terminal. On Windows the terminal order is Windows Terminal, then PowerShell, then cmd. The prompt is pre-filled but never auto-sent, and a `Prompt from an external link` warning is shown. The handler is registered under `HKCU\Software\Classes\claude-cli` on the first interactive prompt; `q` is limited to 5,000 characters; UNC and `..` paths are rejected. Launch from cmd with `start "" "claude-cli://open?..."`. — [Claude Code deep links](https://code.claude.com/docs/en/deep-links)
- **Claude Desktop deep links**: `claude://claude.ai/new?q=`, `claude://code/new?q=<prompt>&folder=<absolute-path>` (opens a Code session in the desktop app; `file` is accepted but not supported yet), and `claude://cowork/new?...`. Linked folders are untrusted and Claude Desktop shows a confirmation dialog. `q` is truncated at about 14,000 characters. — [Open Claude Desktop with a link](https://support.claude.com/en/articles/14729294-open-claude-desktop-with-a-link)
- **Unverified security finding about `claude://` links**: a security vendor report says a crafted `claude://` link could auto-submit a prompt in Desktop. Whether it has been fixed was not verified. — [Oasis Security "PromptFiction" report (PDF)](https://pages.oasis.security/rs/106-PZV-596/images/promptfiction-claude-desktop-technical-report.pdf?version=0)
- **Prior art for a live hook dashboard**: `disler/claude-code-hooks-multi-agent-observability` (1.6k stars, **no licence stated**, last push 2026-02-08) pipes 12 hook events through Python hook scripts → HTTP POST → Bun server → SQLite (WAL) → WebSocket → a Vue client, with per-session colour coding and swim lanes. — [disler/claude-code-hooks-multi-agent-observability](https://github.com/disler/claude-code-hooks-multi-agent-observability)
- **Other web UIs over Claude Code**: `d-kimuson/claude-code-viewer` (MIT, 1.3k stars, pushed 2026-08-18) is a "full-featured web-based Claude Code client". `siteboon/claudecodeui` (CloudCLI, **AGPL-3.0**, 14.2k stars) is another. `sugyan/claude-code-webui` (MIT) and `wbopan/cui` (Apache-2.0) are both **archived**. `simonw/claude-code-transcripts` (Apache-2.0, 1.7k stars) publishes transcripts. — [claude-code-viewer](https://github.com/d-kimuson/claude-code-viewer), [claudecodeui](https://github.com/siteboon/claudecodeui), [claude-code-webui](https://github.com/sugyan/claude-code-webui), [cui](https://github.com/wbopan/cui), [claude-code-transcripts](https://github.com/simonw/claude-code-transcripts)
- **MCP**: `@modelcontextprotocol/sdk` 1.32.2 (MIT on npm). It ships host-header validation middleware for localhost servers (see Q10). — [npm @modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk), [MCP TS SDK hostHeaderValidation](https://ts.sdk.modelcontextprotocol.io/v2/api/@modelcontextprotocol/express/middleware/hostHeaderValidation.html)

### Inferences
- **Showing Claude "reaching addresses on H:" live.** Add one `http` hook on `PreToolUse` and `PostToolUse` (matcher `Read|Edit|Write|Glob|Grep|Bash|PowerShell`), plus `SessionStart`, `SessionEnd`, `SubagentStart`, `SubagentStop`, `Stop` and `WorktreeCreate`, in the user's `~/.claude/settings.json`. Point it at `http://127.0.0.1:<port>/hooks` with an `Authorization` header taken from an env var listed in `allowedEnvVars`.
  - The companion maps the path in `tool_input` to a building.
  - **Pre** lights a "beam" from the session's avatar to the building, and **Post** settles it (green for success; `PostToolUseFailure` turns it red).
  - Paths outside the repo (elsewhere on `H:`) land in an "outskirts" district.
  - It is non-blocking by default, so a closed city never slows Claude.
  - Field names inside `tool_input` (`file_path` for Read/Edit/Write, `command` for Bash, `pattern`/`path` for Grep/Glob) are from general knowledge of the tools reference and should be checked against https://code.claude.com/docs/en/tools-reference before coding.
- **One avatar per session.** `session_id` plus `agent_id`/`agent_type` lets the city draw one avatar per Claude session and a smaller one per subagent. Polling `claude agents --json --all` every few seconds gives `state`/`waitingFor`, so a session that is `blocked` on a `permission prompt` can pulse at its building. This is exactly the "parallel sessions" confusion the user describes.
- **Approving from the city.** A `PermissionRequest` hook of type `http` could even return the user's in-city "allow / deny" decision. That is a write path into Claude's permissions, though, so it should come late, behind the token and an explicit setting.
- **Starting jobs from the city.** Use `claude --bg --name <job> --agent <subagent> "<prompt>"` ("choose an agent for the job") and show the result in agent-view state. Alternatively, run `claude -p --output-format stream-json --verbose` as a child process and stream its events to the city; that is good for short "shortcut prompt" buttons.
- **Agent SDK vs the CLI.** The Agent SDK (TypeScript) is the richer option because it gives in-process hook callbacks and `canUseTool`. However, its auth note restricts *third-party products* from offering claude.ai login. For a personal tool on the user's own machine, driving the user's own installed `claude` CLI (interactive, `--bg` or `-p`) avoids any ambiguity and keeps their subscription login. Bare mode, by contrast, needs an API key.
- **Shortcut prompt library and agent picker.** Store prompts as files (the repo already has `tools/prompts/*.txt`) and fire them either as `claude-cli://open?cwd=…&q=…` (pre-filled, user presses Enter: safest) or as `claude --bg`. Subagents live in `.claude/agents/*.md` and `~/.claude/agents/`; the city can list them as "agents you can hire".
- **Licences of prior art.** Do not copy code from the disler repo (no licence) or claudecodeui (AGPL); take the ideas only. claude-code-viewer (MIT) is fine to read and borrow from with attribution.

### Gaps
- The full per-event `PreToolUse`/`PostToolUse` schemas (beyond the common fields) were not read; the hooks page is 282k characters and only the first 100k were fetched.
- Not checked: whether `http` hooks support `async` like command hooks do. The docs mention `async` only for command hooks.
- Whether the Agent SDK auth restriction applies to a purely personal, non-distributed tool is not stated explicitly.

## Q5. Git made visual and safe: libraries, worktrees/merges/ahead-behind, graph visualizers, undo-friendly flows

### Takeaway
Use **simple-git** (MIT, a wrapper over the real `git.exe`, which the repo already carries portably) for everything, including `git worktree list --porcelain`, `rev-list --left-right --count`, merges and the reflog. isomorphic-git has no worktree, reflog or rebase support and nodegit is a heavy native build, so neither fits. For drawing, gitgraph.js is archived; draw the graph in three.js yourself, and learn from LearnGitBranching and ungit. For safety, lean on Claude Code checkpoints/`/rewind` and git's reflog, and look at jj's operation log for ideas.

### Cited Findings
- **simple-git** (`steveukx/git-js`): MIT, 3.9k stars, pushed 2026-09-26; npm 4.0.2. — [steveukx/git-js](https://github.com/steveukx/git-js), [npm simple-git](https://www.npmjs.com/package/simple-git)
- **isomorphic-git**: MIT, 8.4k stars, pushed 2026-10-26; npm 1.44.5. Its command index lists merge/abortMerge, cherryPick, stash, statusMatrix, findMergeBase and isDescendent, but no worktree, reflog or rebase. — [isomorphic-git command index](https://isomorphic-git.org/docs/en/alphabetic), [isomorphic-git repo](https://github.com/isomorphic-git/isomorphic-git)
- **nodegit** (libgit2): MIT, 5.8k stars, pushed 2026-07-16; npm 0.27.0, 23 MB unpacked. Newer Node-API libgit2 bindings: `es-git` 0.7.0 (MIT), `@napi-rs/simple-git` 1.2.0 (MIT). — [nodegit](https://github.com/nodegit/nodegit), [npm es-git](https://www.npmjs.com/package/es-git), [npm @napi-rs/simple-git](https://www.npmjs.com/package/@napi-rs/simple-git)
- **gitgraph.js** (`nicoespeon/gitgraph.js`): MIT, 3.1k stars, **archived**, last push 2024-07-13; npm `@gitgraph/js` 1.4.0. — [nicoespeon/gitgraph.js](https://github.com/nicoespeon/gitgraph.js)
- **Mermaid** (has a `gitGraph` diagram type): MIT, 90.9k stars, pushed 2026-10-25. — [mermaid-js/mermaid](https://github.com/mermaid-js/mermaid)
- **LearnGitBranching**: MIT, 34.1k stars, pushed 2026-10-13. An "interactive git visualization and tutorial". — [pcottle/learnGitBranching](https://github.com/pcottle/learnGitBranching)
- **ungit**: MIT, 10.6k stars, pushed 2026-09-03. "The easiest way to use git": a Node server with a browser git-graph UI. — [FredrikNoren/ungit](https://github.com/FredrikNoren/ungit)
- **vscode-git-graph**: non-standard licence, 2.5k stars, inactive since 2023-07-08. — [mhutchie/vscode-git-graph](https://github.com/mhutchie/vscode-git-graph)
- **CommitGraph** (`liuliu-dev/CommitGraph`): a React component for commit graphs, Apache-2.0, 29 stars. — [liuliu-dev/CommitGraph](https://github.com/liuliu-dev/CommitGraph)
- **GitButler**: 21.9k stars, non-standard licence (per ecosyste.ms), built with "Tauri/Rust/Svelte". — [gitbutlerapp/gitbutler](https://github.com/gitbutlerapp/gitbutler)
- **Jujutsu (jj)**: Apache-2.0, 32.2k stars, pushed 2026-10-20. "A Git-compatible VCS that is both simple and powerful". — [jj-vcs/jj](https://github.com/jj-vcs/jj)
- **Claude Code worktrees**: background sessions create worktrees under `.claude/worktrees/` and fire `WorktreeCreate`/`WorktreeRemove` hooks. Sessions show their git branch in the picker. — [agent view](https://code.claude.com/docs/en/agent-view), [hooks](https://code.claude.com/docs/en/hooks), [sessions](https://code.claude.com/docs/en/sessions)

### Inferences
- **"GitWorld" data** comes from a few plain git commands run through simple-git or `execFile`:
  - `git worktree list --porcelain` gives the parallel copies; each is a "twin city" or a floating island.
  - `git for-each-ref --format=... refs/heads refs/remotes` gives the branches.
  - `git rev-list --left-right --count main...<branch>` gives ahead/behind, drawn as bridges with traffic.
  - `git log --graph --format=...` or `--parents` gives the graph.
  - `git status --porcelain=v2 -z` gives dirty files: lit windows or scaffolding on buildings.
  - `git reflog` gives the "undo trail".

  The Kapu companion already allows "a few read-only git commands", so this extends an existing whitelist.
- **Safe-by-default rules for a non-coder.** Read-only git queries go into the whitelist; anything that writes (commit, merge, branch delete, worktree remove) goes through confirm dialogs that show a plain-language summary. Better still, the city can hand those jobs to Claude Code as prompts ("merge branch X into main and explain any conflicts") rather than run them itself. That matches the user's working style and CLAUDE.md's GO MAIN discipline.
- **Undo story.** Three layers: (1) Claude Code checkpoints/`/rewind` for Claude's own edits; (2) the git reflog for "where was main 10 minutes ago", visualised as a timeline you can scrub; (3) before any destructive action the companion makes a lightweight safety ref (`refs/vrg-safety/<timestamp>`). Layer (3) is borrowed from jj and GitButler's "operation log" idea. The exact jj/GitButler mechanics were not verified here.
- **Graph rendering.** Draw the graph in three.js: commits as stacked floors or a timeline street, branches as lanes. gitgraph.js is frozen, and Mermaid output is 2D SVG. A pvigier-style "straight branches" layout algorithm is a known reference but was not fetched.

### Gaps
- GitButler's exact licence (possibly a "Fair Source" licence) was not confirmed.
- jj's `op log`/`undo` details were not fetched.
- No maturity data was gathered for `es-git` beyond its npm version.

## Q6. File watching and live updates

### Takeaway
chokidar v6 (Oct 2026) is a rewrite that uses Node's native recursive `fs.watch` on Windows. It is MIT, has one dependency, needs Node 22.22+ and is fine with Node v24. @parcel/watcher (used by VS Code) coalesces bursts like `git checkout` into one batch and can report "changes since last snapshot" even while the app was closed. Either works; debounce to around 200–500 ms and patch the city incrementally.

### Cited Findings
- **chokidar**: MIT, 12.3k stars, pushed 2026-10-19; npm 6.0.0. Version history: v4 (Sep 2024) removed globs and cut dependencies from 13 to 1; v5 (Nov 2025) became ESM-only with Node 20+; v6 (Oct 2026) is a "complete rewrite" with an `fs.watch(recursive)` backend on macOS and Windows and needs Node 22.22+. `atomic` merges an editor's temp-file rename into one `change` within 100 ms. `awaitWriteFinish` waits for file size to settle. Regexes match forward-slash paths on Windows. — [paulmillr/chokidar](https://github.com/paulmillr/chokidar), [npm chokidar](https://www.npmjs.com/package/chokidar)
- **@parcel/watcher**: MIT, 844 stars, pushed 2026-08-04; npm 2.6.0. Uses ReadDirectoryChangesW on Windows. Events are throttled and coalesced in C++, so "`git checkout` or `npm install`" produces one notification, with at most one event per file (create+delete yields nothing). `writeSnapshot` and `getEventsSince` report changes made while the program was not running. Supports `ignore` globs. Used by Parcel 2, VS Code, Tailwind IntelliSense, Nx, Nuxt and others. — [parcel-bundler/watcher](https://github.com/parcel-bundler/watcher)
- **Claude Code `FileChanged` hook**: fires when a watched file changes on disk. — [Claude Code hooks](https://code.claude.com/docs/en/hooks)

### Inferences
- **Watch roots and ignore list.** Watch the repo root, ignoring `.git/objects`, `node_modules`, `Planner/apps`, `Planner/home`, `Planner/data`, `Vendor`, `Inventory/.cache` and `dist`. Watch `.git/HEAD`, `.git/refs`, `.git/worktrees` and `.git/logs/HEAD` separately to trigger a GitWorld refresh.
- **Incremental pipeline.** Watcher event → debounce (~300 ms) → re-scan only the changed files with the existing `scan.js` logic → send `{added, changed, removed}` over the WebSocket. The page then updates instance matrices and colours (`InstancedMesh.setMatrixAt`/`setColorAt`) without rebuilding the city. When a building is added and the instance count is exceeded, reallocate with headroom.
- **"Since you were away".** @parcel/watcher's snapshot feature can open the city with a "what changed since last time" overlay. On Windows its query mode falls back to brute-force traversal, which is acceptable for this repo's size.
- **Native build for @parcel/watcher.** Its README does not mention prebuilds, so check that the npm install fetches a `@parcel/watcher-win32-x64` binary. If it doesn't, chokidar v6 (pure JS) is the zero-native choice.

### Gaps
- Node's `fs.watch` caveats for recursive mode on Windows were not retrieved (the Node docs page was truncated before that section).
- Whether @parcel/watcher ships Windows prebuilds was not confirmed from its README.

## Q7. Launching and supervising processes from the browser; logs as streams

### Takeaway
Use the companion's existing pattern: whitelisted programs from a config file, argument arrays, no shell strings. Add a small in-house supervisor that keeps a ring buffer of output per process and streams it over WebSocket/SSE. Kill whole process trees with `taskkill /T` (or tree-kill), and report CPU and memory with pidusage. PM2 is AGPL-3.0, so use it as an idea, not a dependency.

### Cited Findings
- **PM2**: AGPL-3.0 (npm `pm2` 7.1.1), 43.3k stars, pushed 2026-10-23. — [npm pm2](https://www.npmjs.com/package/pm2), [Unitech/pm2](https://github.com/Unitech/pm2)
- **forever**: MIT, 13.8k stars, last push 2023-05-21 (stale). — [foreversd/forever](https://github.com/foreversd/forever)
- **execa**: MIT, 7.6k stars, pushed 2026-10-18. — [sindresorhus/execa](https://github.com/sindresorhus/execa)
- **tree-kill**: MIT, 1.2.2, repo last pushed 2020-06-17. — [pkrumins/node-tree-kill](https://github.com/pkrumins/node-tree-kill)
- **Process stats and helpers**: `pidusage` 4.1.0 and `ps-list` 9.0.0 (both MIT). `open` (MIT, 3.5k stars) opens "URLs, files, executables" cross-platform. — [npm pidusage](https://www.npmjs.com/package/pidusage), [npm ps-list](https://www.npmjs.com/package/ps-list), [sindresorhus/open](https://github.com/sindresorhus/open)
- **Claude Code's own background jobs**: `claude --bg --exec '<cmd>'` "runs a shell command as a background job, without invoking Claude", and `claude logs <id>` prints recent output. — [agent view](https://code.claude.com/docs/en/agent-view)
- **The existing companion** already starts programs "from argument arrays, never from a shell string built from request data, and detached". Config names the programs (browser, `claudeCmd`, terminal `wt`/`cmd`, VS Code, git), never the request. — local file `CodeCity/from-kapu/companion-server.js` (header comment and `loadConfig`)

### Inferences
- **Two kinds of process.**
  - (a) **Fire-and-forget launches** ("open Paint.NET", "open VS Code here", "open Claude Desktop" via `start "" "claude://code/new?folder=..."`) stay detached, exactly as today.
  - (b) **Supervised jobs** (dev servers such as `node MindMap/serve.js`, builds, tests) are spawned non-detached with piped stdio. Keep the last N KB per job, broadcast lines as `{job, stream, text}`, and show them as smoke or chimneys on the building and a log panel. Use `pidusage` for a CPU/RAM gauge. On stop, run `taskkill /PID <pid> /T /F` so child processes of `cmd` die too.
- **Where the launcher list lives.** Third-party programs belong in `config.json` (user-editable, next to the `.token` file), each entry pinned by absolute path. That respects the CLAUDE.md rule that "a tool that is not in START.cmd does not exist": START.cmd's `T<n>_PATH` registry can be read as the source of the launch list, so the city and START.cmd never disagree.
- **PM2-style persistence.** Restart-on-crash and saved process lists can be re-implemented in about 100 lines. Do not embed PM2 because of its AGPL licence.

### Gaps
- No source compared Windows Job Objects (kill-on-close semantics) with taskkill for Node child trees. A small native helper may be needed if orphaned processes become a problem.

## Q8. Command palette (Ctrl+K) and fuzzy search

### Takeaway
The best-known palettes (cmdk, kbar) are React components, and ninja-keys (a web component, so framework-free) has been idle since 2024. Kódváros is vanilla JS, so a small hand-built palette over **uFuzzy** (MIT, tiny, made for this) for names and paths, plus optional **MiniSearch** (MIT) for full-text over file contents, prompts and commit messages, is the simplest fit.

### Cited Findings
- **cmdk** (`dip/cmdk`, moved from `pacocoursey/cmdk`): MIT, 13.0k stars, last push 2025-10-29, npm 1.1.1. A "Fast, unstyled command menu React component". — [dip/cmdk](https://github.com/dip/cmdk)
- **kbar** (`timc1/kbar`): MIT, 5.3k stars, pushed 2026-08-10, npm 1.0.0. A "cmd+k interface for your site". — [timc1/kbar](https://github.com/timc1/kbar)
- **ninja-keys**: MIT, 1.7k stars, last push 2024-07-14, npm 1.2.2. — [ssleptsov/ninja-keys](https://github.com/ssleptsov/ninja-keys)
- **Fuse.js**: Apache-2.0, 20.5k stars, pushed 2026-08-09, npm 7.5.0. — [krisk/Fuse](https://github.com/krisk/Fuse)
- **uFuzzy**: MIT, 3.0k stars, pushed 2026-09-08, npm `@leeoniya/ufuzzy` 1.0.19 (131 KB unpacked). — [leeoniya/uFuzzy](https://github.com/leeoniya/uFuzzy)
- **MiniSearch**: MIT, 6.2k stars, pushed 2025-09-16, npm 7.2.0. — [lucaong/minisearch](https://github.com/lucaong/minisearch)
- **FlexSearch**: Apache-2.0, 13.8k stars, pushed 2026-06-28, npm 0.8.212. — [nextapps-de/flexsearch](https://github.com/nextapps-de/flexsearch)

### Inferences
- **One palette over every kind of thing**: files and folders (fly the camera to the building), commands (whitelisted companion actions), prompts (`tools/prompts/*.txt`), agents (`.claude/agents`), sessions (`claude agents --json`), branches and worktrees, and START.cmd tools. Prefix filters (`>` for commands, `@` for agents, `#` for branches) keep it learnable.
- **Search engines.** uFuzzy suits short strings (paths). MiniSearch can index file contents in a Web Worker served by the companion, or the companion can run ripgrep and stream hits. Fuse.js is the most popular, but it is Apache-2.0 (permissive, with a NOTICE obligation) and slower on large lists, by general reputation that was not verified here.

### Gaps
- No head-to-head benchmark of the fuzzy libraries was fetched.

## Q9. Multi-select, group actions, outlines and context menus in three.js

### Takeaway
three.js addons already cover box selection (`SelectionBox`/`SelectionHelper`). `SelectionBox` understands `InstancedMesh` and returns instance IDs, which matches how Kódváros draws buildings. For outlines on instanced buildings, per-instance colour or emissive changes, or a second "highlight" InstancedMesh, are simpler than OutlinePass (which outlines whole objects). three-mesh-bvh speeds up raycasting if the city grows. Right-click menus can be plain DOM overlays.

### Cited Findings
- **`SelectionBox` and InstancedMesh**: `examples/jsm/interactive/SelectionBox.js` keeps an `instances` map and, for `object.isInstancedMesh`, pushes each `instanceId` inside the selection frustum. It also handles BatchedMesh. — [three.js SelectionBox.js source](https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/jsm/interactive/SelectionBox.js)
- **Other addons**: `SelectionHelper.js` and `postprocessing/OutlinePass.js` both exist in three.js `examples/jsm`. The demo page is `misc_boxselection`. — [SelectionHelper.js](https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/jsm/interactive/SelectionHelper.js), [OutlinePass.js](https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/jsm/postprocessing/OutlinePass.js), [three.js box selection example](https://threejs.org/examples/misc_boxselection.html)
- **three.js versions**: MIT, 117.0k stars, pushed 2026-10-26; npm `three` 0.186.1, i.e. r186. **Kódváros's r169 is 17 releases behind.** — [mrdoob/three.js](https://github.com/mrdoob/three.js), [npm three](https://www.npmjs.com/package/three)
- **three-mesh-bvh**: MIT, 3.5k stars, pushed 2026-10-22, npm 0.9.16. "A BVH implementation to speed up raycasting and enable spatial queries against three.js meshes". — [gkjohnson/three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh)
- **pmndrs postprocessing** (has an OutlineEffect and selection support): **Zlib licence**, 2.9k stars, pushed 2026-10-05, npm 6.39.5. — [pmndrs/postprocessing](https://github.com/pmndrs/postprocessing)
- **3d-force-graph**: MIT, 6.5k stars, pushed 2026-09-29. A "3D force-directed graph component using ThreeJS/WebGL", useful for a session/agent graph overlay. — [vasturiano/3d-force-graph](https://github.com/vasturiano/3d-force-graph)
- **pmndrs/uikit** (3D UI panels for react-three-fiber): non-standard licence, 3.2k stars; it needs React. — [pmndrs/uikit](https://github.com/pmndrs/uikit)

### Inferences
- **Interaction model.**
  - Click selects one building.
  - Ctrl+click toggles the clicked building in a `Set<instanceId>`.
  - Shift+drag draws a box (`SelectionBox`, with OrbitControls disabled during the drag).
  - Selected instances get a cyan emissive edge. One way: a second InstancedMesh of slightly larger boxes, back-face only, with an additive "Tron" material, at the selected matrices. This avoids an OutlinePass over the whole city.
  - Right-click raycasts and opens a DOM context menu (or a radial menu drawn as an SVG overlay at the cursor) whose entries depend on the selection type (file / folder / multi). Examples: "Open", "Open in VS Code", "Ask Claude about these", "Show history", "Run" (if it is a START.cmd tool).
  - Group actions send the selected paths to the companion; each path is re-validated server-side against the roots.
- **Upgrading three.js.** Moving from r169 to r186 is optional for these features, since `SelectionBox` with instance support predates r169 (not verified exactly when it landed). Re-check `SelectionBox` and `OutlinePass` behaviour after any upgrade. Under the repo's vendoring rules, pin the exact npm version.

### Gaps
- Not checked: the three.js release in which `SelectionBox` gained `InstancedMesh` support, or whether it works with the `BatchedMesh` that a future Kódváros might use.
- No dedicated radial-menu library was evaluated (none stood out as maintained and framework-free).

## Q10. Security of a local server that can run commands

### Takeaway
The repo's companion already follows best practice: loopback bind, Host allowlist, Origin allowlist, per-install token compared in constant time, action whitelist, realpath root checks and argv-only spawning. Three things to add for the live version: (1) WebSocket upgrades must check `Origin` against the same fixed list and authenticate without putting the token in the URL; (2) Origin must be compared to a fixed configured list, never derived from `Host`; (3) anything that writes files or runs commands chosen in the page needs a second, explicit confirmation step.

### Cited Findings
- **DNS rebinding**: an attacker's domain re-resolves to 127.0.0.1, so the browser treats requests to the local service as same-origin. The defence is to validate the Host header against loopback names and addresses, and to check Origin on WebSocket upgrades as well. — [NCC Group Singularity (DNS rebinding framework)](https://github.com/nccgroup/singularity/wiki/%5BAnnouncement-Blog-Post%5D--Singularity-of-Origin:-A-DNS-Rebinding-Attack-Framework), [PentesterLab glossary](https://pentesterlab.com/glossary/dns-rebinding)
- **The MCP TypeScript SDK ships host-header validation middleware**, described as particularly important for servers without authorization or HTTPS, such as localhost servers. — [MCP TS SDK hostHeaderValidation](https://ts.sdk.modelcontextprotocol.io/v2/api/@modelcontextprotocol/express/middleware/hostHeaderValidation.html)
- **Jenkins CVE-2026-33002**: Jenkins computed the expected Origin of its CLI WebSocket from the `Host`/`X-Forwarded-Host` headers, which an attacker controls after rebinding. The lesson is to compare Origin to a fixed list. — [Rapid7 CVE-2026-33002](https://www.rapid7.com/db/vulnerabilities/jenkins-2026-03-18_cve-2026-33002/), [Acunetix CVE-2026-33002](https://www.acunetix.com/vulnerabilities/web/jenkins-reliance-on-reverse-dns-resolution-for-a-security-critical-action-vulnerability-cve-2026-33002/)
- **CVE-2026-97875 (Rojo)**: reportedly accepted requests without validating Host or Origin, which enabled DNS rebinding. NVD status is "deferred", so details are unverified. — [OpenCVE CVE-2026-97875](https://app.opencve.io/cve/CVE-2026-97875)
- **`ws`** (MIT, 22.8k stars, npm 8.22.0) supports a `verifyClient` hook where the Origin can be checked against an allowlist. — [websockets/ws](https://github.com/websockets/ws), [vibe-eval WebSocket Origin pattern](https://vibe-eval.com/patterns/websocket-dns-rebind-audit-log/)
- **node-pty** processes run with the parent process's permissions. — [node-pty README](https://github.com/microsoft/node-pty)
- **Claude Code deep links are safe by design**: they never auto-send the prompt, and Claude Desktop asks before using a linked folder. — [deep links](https://code.claude.com/docs/en/deep-links), [Claude Desktop links](https://support.claude.com/en/articles/14729294-open-claude-desktop-with-a-link)
- **HTTP hooks** take their auth header from env vars allowed via `allowedEnvVars`. — [hooks](https://code.claude.com/docs/en/hooks)

### Inferences
- **WebSocket authentication without a URL token.** Browsers cannot set custom headers on `new WebSocket()`. Two options: send the token as the first message (and drop the socket if it doesn't arrive within ~2 s), or put it in the `Sec-WebSocket-Protocol` subprotocol. Do not put it in the query string, because it would leak into logs and history.
- **A terminal endpoint is remote code execution by design.** It must refuse connections without the token, must only spawn the configured shell or `claude` binary (never a client-supplied executable), and should be off unless the user turns it on.
- **Approval tiers.** read-only (always allowed) → open or launch (token) → write or run (token + an in-page confirmation showing the exact path or command) → git destructive (hand off to Claude Code with a prompt, or a two-step confirm with a safety ref).
- **Hook endpoint.** It should accept only `POST` with the bearer token, accept only JSON of bounded size (the companion's `MAX_BODY` is 16 KB, which may need raising to around 256 KB because `tool_input` for Write can be large), and never execute anything it receives.

### Gaps
- Chrome's 2025–2026 "Local Network Access" permission changes were not researched.

## Q11. Existing "IDE in 3D / spatial IDE / code in VR" projects to learn from

### Takeaway
The research record supports the idea. Code Park (rooms per class, first-person walking) and Code Bubbles (working-set canvases) both measured better code comprehension than a traditional IDE. Haystack is a current canvas IDE built on a VS Code fork, but it is source-available, not open source. Code-city visualizers (gocity, CodeCharta) exist, but none of them are workspaces. No maintained open-source "walk-around IDE" was found that Kódváros could adopt, so this would be new ground.

### Cited Findings
- **Code Park** (Khaloo, Maghoumi, Taranta, Bettner, LaViola; UCF; VISSOFT 2017): the codebase becomes a 3D park, each class a room with its members on the walls. It offers an overview mode and a first-person mode, and user studies found it "significantly helps in code understanding compared to a traditional IDE". The thesis version adds editing, compiling and running. — [arXiv 1708.02174](https://arxiv.org/pdf/1708.02174), [UCF thesis record](https://stars.library.ucf.edu/etd/5511)
- **Code Bubbles** (Brown; Bragdon, Reiss, van Dam; CHI 2010): an IDE built on working sets of editable "bubbles" (function fragments) instead of files. It improved code understanding time and reduced navigation versus a mainstream IDE. Microsoft Research's Debugger Canvas was its industrial follow-up. — [About Code Bubbles](https://cs.brown.edu/people/spr/codebubbles/about.html), [CHI 2010 paper (PDF)](https://www.eecs.ucf.edu/~jjl/pubs/p2503-bragdon.pdf)
- **Haystack**: an infinite-canvas code editor, a VS Code fork showing code as a graph of functions and classes. **PolyForm Strict 1.0.0** (source-available), 1.3k stars, last push 2025-02-17. — [haystackeditor/haystack-editor](https://github.com/haystackeditor/haystack-editor), [Haystack README](https://raw.githubusercontent.com/haystackeditor/haystack-editor/main/README.md)
- **RiftSketch**: a web live-coding environment for VR with three.js; MIT, 895 stars, last push 2024-06-18. — [brianpeiris/RiftSketch](https://github.com/brianpeiris/RiftSketch)
- **Kairon**: a WebXR code editor tested on a Quest 2; no licence, 33 stars, last push 2023. — [felipereigosa/kairon](https://github.com/felipereigosa/kairon)
- **"Building a VR IDE with WebXR"**: a three.js forum thread whose recurring problem is seeing the physical keyboard while in VR. — [three.js forum](https://discourse.threejs.org/t/building-a-vr-ide-with-webxr/61277)
- **gocity**: code-city metaphor for Go, MIT, 1.8k stars, last push 2025-12-05. — [rodrigo-brito/gocity](https://github.com/rodrigo-brito/gocity)
- **CodeCharta**: code-city maps from metrics, BSD-3-Clause, 558 stars, pushed 2026-10-26. — [MaibornWolff/codecharta](https://github.com/MaibornWolff/codecharta)
- **Gource**: animated version-control history, **GPL-3.0**, 13.2k stars, pushed 2026-03-06. Learn the idea; don't copy the code. — [acaudwell/Gource](https://github.com/acaudwell/Gource)

### Inferences
- **Code Park**'s two modes (overview vs first-person) and its finding that novices liked it map directly onto a non-coder user. Kódváros already has the overview. A "walk inside a building" mode that shows the file as wall text, with the editor opening as a panel, is the Code Park move.
- **Code Bubbles' working sets** map well onto Ctrl+click multi-select. A selection can become a named "working set" (a temporary district), which can be handed to Claude as the context for a job.
- **Haystack's licence** forbids reuse, and the reviewer quoted in search results found its canvas "just places tabs on a canvas". The lesson is that spatial layout only helps if it carries meaning (as Kódváros's folder districts do).

### Gaps
- No primary sources were found for "Primitive" (the VR code-visualisation startup) or Dynamicland in this pass.
- Richard Wettel's original CodeCity (the code-city metaphor's origin) has no GitHub repo under the guessed name, so it is uncited here.
- No evaluation data was found for any VR IDE beyond Code Park.

## Q12. Outdated or changed items to flag (late 2026)

### Takeaway
Several libraries the obvious tutorials point to have moved, been archived or changed licence. An implementer should check this list first.

### Cited Findings
- **CodeMirror**: its GitHub repos were archived on 2026-04-15; development continues on code.haverbeke.berlin, and npm packages are still published. — [codemirror/dev](https://github.com/codemirror/dev), [codemirror.net](https://codemirror.net/)
- **gitgraph.js**: archived (2024-07). — [nicoespeon/gitgraph.js](https://github.com/nicoespeon/gitgraph.js)
- **VS Code webview UI toolkit**: archived (2024-09). — [microsoft/vscode-webview-ui-toolkit](https://github.com/microsoft/vscode-webview-ui-toolkit)
- **cmdk** moved from `pacocoursey/cmdk` to `dip/cmdk` and has had no push since 2025-10. — [dip/cmdk](https://github.com/dip/cmdk)
- **ninja-keys**: no push since 2024-07. — [ssleptsov/ninja-keys](https://github.com/ssleptsov/ninja-keys)
- **xterm.js** packages are scoped `@xterm/*` (v6.0.0, Dec 2025); the old unscoped `xterm` package names are legacy. — [npm @xterm/xterm](https://www.npmjs.com/package/@xterm/xterm)
- **node-pty** 1.1.0 ships prebuilds; the README's "build from source with windows-build-tools" advice is outdated (that npm package is deprecated, per the README fetch summary). — [node-pty](https://github.com/microsoft/node-pty), [unpkg listing](https://unpkg.com/node-pty@1.1.0/?meta)
- **chokidar** v5 is ESM-only and v6 needs Node 22.22+. — [chokidar](https://github.com/paulmillr/chokidar)
- **Monaco**'s AMD build is deprecated. — [monaco-editor](https://github.com/microsoft/monaco-editor)
- **Claude Code `claude -p`**: starts in Manual mode since v2.1.302, and `--bare` will become the default for `-p`. The Claude Code SDK was renamed the Claude Agent SDK, and a migration guide exists. — [headless](https://code.claude.com/docs/en/headless), [Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview)
- **Claude Code web UIs**: `sugyan/claude-code-webui` and `wbopan/cui` are archived. — [claude-code-webui](https://github.com/sugyan/claude-code-webui), [cui](https://github.com/wbopan/cui)
- **three.js** is at r186 on npm; Kódváros uses r169. — [npm three](https://www.npmjs.com/package/three)

### Inferences
- The repo's vendoring rule (tags, not branches; npm with integrity) protects against most of this. CodeMirror is the one case where the "source" location itself has moved.

### Gaps
- None beyond those noted under each question.
