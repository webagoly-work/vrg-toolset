# WP-MCP-3 — file tools behind an allowlist, `.mcp.json`, the "drive the Planner" skill

Status: todo · Depends: MCP-2 (MCP-1 is enough for the headless half) · Size: M (~300 lines `tools/`,
skill ~150 lines, ~250 specs) · Specs: 125, 126 · Decisions: Q-14, Q-15, Q-16, Q-17, Q-18

## Goal

Let an agent open a plan, save it and write its exports — and nothing else on the disk. Then make the
server one line away for every session (`.mcp.json`) and teach agents the Planner (a skill), so the next
P33 job is "use the planner tools", not a page of jsdom setup.

## What exists

- Plan files: `Calculator/*.vplan.json` (P33-teszt v1 / v2 / v2_butor …) in the `downloadProject` format
  `{format:'varler-planner', version:1, name, saved, project}` (`src/12-boot.js:274`); older files are a
  bare `sessionObj()` payload — `applyProjectData(o.project || o)` takes both.
- **`Calculator/` also holds client PDFs** (quotes with names and addresses; `*.pdf` is git-ignored for
  that reason). A folder allowlist alone would hand them to an agent — hence the extension rule below.
- Export actions that end in `download(...)`: `proj.export`, `portal.export`, `need.export`, `fill.export`,
  `elo.export`; picture exports through `svgToPng` / the `vexp*` sheet. MCP-0 already captures all of
  them per call (`files`).
- This machine's traps: `H:\_desktop` is a **junction** (repo `CLAUDE.md`), `Planner/home` holds a
  browser profile and `.credentials.json`, `H:\` holds `.ssh`, and `Planner/apps` holds portable programs.
- SolidCraft's allowlist rules (`Vendor/solidcraft/docs/mcp.md`, "Which files the agent can reach") —
  the reference; reimplement in JS, do not port.

## Build

1. **`tools/mcp/paths.js`** — `allowPath(p, {write, ext})` → `{ok, real}` or `{ok:false, code:'path-refused', why}`.
   Refuse **before** any file-system call:
   - not absolute; UNC / device / NT spellings (`\\server\x`, `//server/x`, `\\?\UNC\…`, `\??\…`, `\\.\…`);
     drive-relative (`C:file`); a `:` after the drive (alternate data streams); reserved device names with
     any extension (`NUL`, `CON`, `PRN`, `AUX`, `COM1`–`COM9`, `LPT1`–`LPT9`); 8.3 short names (`~\d` in a
     segment);
   - any segment starting with `.` (dotfiles and dot-folders) unless the folder itself was given with
     `--allow-path`.
   Then resolve with `fs.realpathSync.native` (the parent for a new file; the parent must exist — never
   create folders) and check the **real** path is inside one allowed root, compared case-insensitively on
   Windows with a trailing separator (so `Calculator-old` is not inside `Calculator`).
   Allowed roots (Q-14 A): `<repo>/Calculator`, the folder of `--in`, the server's scratch folder
   (`fs.mkdtempSync(os.tmpdir()+'/planner-mcp-')`, spelled with its long name), every `--allow-path DIR`.
   **Never**, even if listed: a drive root, `H:\`, `<repo>` itself, `Planner/home`, `Planner/apps`,
   `Planner/data`, any path containing `.credentials.json`, `.ssh`, `.git`.
   Extension rule: read `.json`; write `.json`, `.svg`, `.png`, `.csv`; **never `.pdf`** in either direction.
   `--allow-any-path` exists (SolidCraft has it) but prints a warning line on every start.
   stderr lists the effective roots at start-up.
2. **`open_project {path}`** → read (≤ 32 MB), `JSON.parse`, send `doc.load {project}`; in the tab
   `doc.load` does `hardResetWorkspace(); applyProjectData(o.project || o); draw()` and returns the
   `plan.inspect` `doc` + `counts` sections. Bridged: **the file is read by the server**, the tab only
   receives JSON — the browser never touches the disk. Destructive (replaces the open plan): in bridged
   mode the tab asks the user `confirm()` unless the plan is unchanged since its last save — the one
   place where the agent cannot answer the confirm itself.
3. **`save_project {path, name?, overwrite?}`** → `doc.save` returns `sessionObj()`; the server wraps it in
   the `downloadProject` envelope and writes it. Existing file → refused unless `overwrite:true` (Q-15 A);
   with overwrite the old file is first copied to `<name>.bak.json` (one generation).
4. **`export {kind, path, overwrite?, …}`** → `kind`: `'svg' | 'png'` (= `render` written to disk),
   `'project-json'`, `'portal' | 'needs' | 'fill' | 'elo-presets'` (run the matching registered export
   action and write the captured file). The tab returns the content; the server writes it.
5. Annotations for the three: not readOnly, `destructiveHint:true`, `openWorldHint:true`.
6. **`.mcp.json` at the repo root** (Q-16 A):
   ```json
   {
     "mcpServers": {
       "planner": {
         "command": "node",
         "args": ["Planner/projects/varler-planner/tools/planner-mcp.js"],
         "env": { "NODE_PATH": "H:/Dev-VRG/VRG-DE/Planner_VRG_U100/Planner/projects/varler-planner/node_modules" }
       },
       "planner-live": {
         "command": "node",
         "args": ["Planner/projects/varler-planner/tools/planner-mcp.js", "--connect", "ws://127.0.0.1:47291"],
         "env": { "NODE_PATH": "H:/Dev-VRG/VRG-DE/Planner_VRG_U100/Planner/projects/varler-planner/node_modules" }
       }
     }
   }
   ```
   Relative `args` resolve against the session's project root, so a session in the `wt-planner-stack`
   worktree gets that worktree's server and build; `NODE_PATH` is absolute because only the main checkout
   has `node_modules` (PRIMER §1). Claude Code asks once before using a project MCP server — that prompt
   is the user's, do not pre-approve it in settings.
7. **The skill — `.claude/skills/planner-drive/SKILL.md`** (Q-17 A). Frontmatter `name`, `description`
   ("Use when driving the Varler Planner through its MCP tools: loading a plan, finding and running
   actions, checks, renders, exports."). Body, in English with the Hungarian labels quoted as they appear:
   - the two servers and when to use which (batch jobs headless; showing the user → live);
   - the loop: `inspect_plan` → `list_actions {filter}` → `select` → `run_action` → `run_checks` → `render`;
   - the non-`done` replies and what to do: `status:'dialog'` (the dialog is open — read its fields, then
     `dialog_submit` or `dialog_cancel`; nothing else works until then: `dialog-open`), `dialog-gone` (the
     user closed it or another replaced it — re-read the plan, run the action again), `tool-started` (needs
     pointer input — not available; say so), `needs-confirm` (ask the user, then `confirm:true`);
   - a short map of action groups (Eszköz, Nézet, Réteg, Stack, Végpont, Áramkör, Feltöltés…) with 2–3
     ids each, generated once from `list_actions` and dated — not a full copy of the registry;
   - the P33 recipe: open `Calculator/P33-teszt_v2.vplan.json`, `run_checks`, device counts per room,
     render the ground floor;
   - traps: ids not indices; never hold a wall id across a geometry change without re-reading; the plan
     in a live tab is the user's — `batch` with rollback for multi-step edits; no file outside the allowlist.
8. **Launcher (Q-18 A).** The relay already has launcher entries (`VRG-DE.cmd` "S) Relay szerver
   inditasa", line ≈ 257; `START.cmd` "G) Gyro relay szerver inditasa", line ≈ 209) — reuse them, do not
   add a second relay item. Add one item to `VRG-DE.cmd`'s Planner submenu: "MCP onteszt" (runs
   `node tests/spec-122-mcp-headless.js` with `NODE_PATH`, then prints one line on how a session gets the
   `planner` / `planner-live` servers). CRLF line endings; ASCII console text; no `goto` out of a
   `for` block (repo `CLAUDE.md`). `START.cmd`'s tool registry is unchanged — the MCP is not a page — so
   `node tools/check-start.js` must still exit 0.
9. Update `docs/research/2026-10-19_cad-sources-and-mcp.md` §4 "Status" to point at this pack and the
   built state, and add a `## MCP` paragraph to the project `CLAUDE.md`'s Commands block
   (`node tools/planner-mcp.js [--in plan] [--connect ws://…]`).

## Tests

`tests/spec-125-mcp-paths.js` — pure unit tests of `allowPath` (no server):
1. Allowed: a file in `Calculator/`, in the `--in` folder, in scratch, in an `--allow-path` folder.
2. Refused, each with its `why`: `H:\`, `H:\.ssh\id_rsa`, `H:\_desktop\Git\bin\bash.exe` (junction → real
   path outside), `<repo>\Planner\home\…`, `…\.credentials.json`, `<repo>\.git\config`, `Calculator\x.pdf`,
   `\\server\share\a.json`, `//server/share/a.json`, `\\?\UNC\s\a.json`, `\\.\NUL`, `C:a.json`,
   `Calculator\a.json:evil`, `Calculator\CON.json`, `Calculator\PROGRA~1\a.json`,
   `Calculator\..\CLAUDE.md`, `Calculator-old\a.json` (prefix trap), a new file in a missing sub-folder.
3. A symlink / junction created by the test inside scratch that points to `os.homedir()` → refused (skip
   with a note if the test cannot create links without elevation).

`tests/spec-126-mcp-files.js` — headless server with a scratch `--allow-path`:
1. `open_project` P33-teszt_v2 → counts as in spec-122.
2. `save_project` to scratch → the file parses, `format==='varler-planner'`, re-`open_project` gives the
   same counts; saving again without `overwrite` → `path-refused`/exists; with `overwrite` → a `.bak.json`
   appears.
3. `export {kind:'svg'}` → a file starting `<svg`; `export {kind:'elo-presets'}` → the JSON `elo.export`
   produces in the UI.
4. `.mcp.json` parses; every `args[0]` resolves to an existing file relative to the repo root.
5. The skill file exists and its frontmatter has `name` and `description`.

## Verifier focus

Path checks happen on the **resolved** path and before any write. Grep the server for `fs.write*` /
`fs.copyFile*` / `fs.rename*` — every call site goes through `allowPath`. Nothing in `tools/mcp/` writes
outside scratch when no file tool is called (run spec-122 and diff the repo's `git status` before/after).

## Live check (owed)

A fresh Claude Code session in the repo: it offers the `planner` server from `.mcp.json`; ask it to open
P33-teszt_v2, list the validation errors and save a copy to scratch. Then with the live server: the same
session drives the open tab while the user watches.
