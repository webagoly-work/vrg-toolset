# VRG glossary — what things are called in the industry

*U2 of the Desktop unify (2026-11-10). Each term: the industry meaning, one or two well-known products where you meet it,
and what it is in VRG. `CLASSIFICATION.md` applies these to every row of the inventory; `ARCHITECTURE.md` uses them
for the new layout. HU names are the ones the UI shows; EN in italics.*

## 1. Software units — what a thing *is*

| Term | Industry meaning | Well-known examples | In VRG |
|---|---|---|---|
| **Application (app)** | A standalone program an end user opens to do a task, with its own UI, data and lifecycle. | Microsoft Excel, Figma | Varler Planner, Készlet, MindMap, BuildTree, VRG Térkép, Kódváros, Solomon Gömb |
| **Companion app** | An app on a second device that pairs with a main one and extends it (remote, notifications, field use). | Spotify Connect on a phone, the Garmin Connect app | VRG Mobile, Varler Console (field PWA), Planner CYD (a device) |
| **Utility** | A small app for one narrow job, usually no project files of its own. | Windows Calculator, PowerToys Color Picker | the three calculators, Valena választó |
| **Feature** | A user-visible capability *inside* an application; it has no life outside its host. | "Track Changes" in Word, "Auto Layout" in Figma | Planner: Rooms + numbering, Wiring pipeline, Views, Client preview, Simple mode |
| **Feature module** | A feature packaged as its own code unit so the host can add or drop it (Android dynamic feature, a VS Code built-in extension). | Android `feature-*` modules, Chrome's built-in "PDF viewer" | VRG Mobile M0–M17 (`feature-settings`, `feature-net`, …) |
| **Plugin / extension / page** | A unit a host loads through a declared contract (manifest + entry point). | VS Code extensions, WordPress plugins | Varler Console pages (`{manifest, mount}`), Dashboard panes (`VRGPanes[kind]`) |
| **Widget** | A small self-contained display or control unit placed on a dashboard or home screen. | iOS home-screen widgets, Grafana panels | Console clock / timer / compass, the Desktop top strip items |
| **Module** | An internal code unit (file / folder) with an interface; never shown to the user by itself. | a Node package, a Python module | `Dashboard/shell/lib/*.js`, `launcher/*.ps1` parts |
| **Function / routine** | A callable piece of code. "Functionality" is a loose synonym of *feature*: avoid it. | `Array.map`, `printf` | `collect()`, `cpvModel()` |
| **Command / action** | A named, invokable operation with an id, reachable from menus, a palette, hotkeys or scripts. | VS Code commands (`workbench.action.files.save`), macOS menu items | START items (`s:P/B` = Planner build), palette commands |
| **Command family / id scheme** | A prefix that says which registry resolves an id. | URL schemes (`mailto:`), VS Code `command:` URIs | `s:` `srv:` `f:` `cont:` `go:` `job:` `line:` … |
| **CLI tool / script** | A command-line program, run by people, builds or agents. | `git`, `npm` | `tools/*.js`, `stack.js`, `vrg-ctx.js`, `mobile.cmd` |
| **Service / daemon / local server** | A background process that exposes an API or a port and has no window of its own. | the Docker daemon, a local Postgres | Planner dev :8131, Kapu segéd :8795, trace relay :8134, Rétegverem :8806 |
| **Registry / manifest / catalog** | Data that lists what exists and how to reach it; programs read it instead of hard-coding. | the Windows registry's App Paths, `package.json`, the VS Code marketplace | `vrg-menu.json` (how to run), `features.json` (roadmap), **`vrg-catalog.json`** (what exists), `vendor-manifest.json` |
| **Knowledge base / knowledge graph** | Structured, linked reference data that people and tools query. | Confluence, Neo4j-backed graphs, Obsidian vaults | VRG Rétegverem (the Stack), CoreRef, BRIDGE |
| **Document set / document pack** | A versioned set of documents that belong together (spec, decisions, briefs). | an RFC series, an ISO standard family | BRIDGE standards, `docs/*` packs, GO-*.md |
| **Runbook / playbook** | Step-by-step instructions to start or operate something, often read by automation. | SRE runbooks, Ansible playbooks | the GO codephrase files, prompts, Console playbooks |
| **AI agent** | An LLM worker with a role, a tool set and limits, started by a host. | GitHub Copilot coding agent, Claude Code subagents | `.claude/agents/*` (Bernard, Arnold, Elsie, Theresa …), the Council |
| **AI coding assistant** | An AI agent inside the developer's terminal or editor. | Claude Code, Cursor | Claude Code (START C, the embedded Claude terminal) |
| **Hook** | Code that runs on an event raised by another program. | git hooks, React hooks (different sense) | `CodeCity/hook.js`, `tools/council-gate.js` (Claude Code PreToolUse) |
| **MCP server** | A Model Context Protocol tool provider an AI agent can call. | the GitHub MCP server, Playwright MCP | `vrg-stack` (`Stack/mcp`), Kódváros MCP |
| **Prompt template** | Reusable text that starts an AI session for a known task. | ChatGPT custom instructions, LangChain prompt templates | `tools/prompts/*.txt` (START J) |
| **Design system** | Tokens (colours, type, spacing) + components + rules that give products one look. | Material Design, Microsoft Fluent | Mélyvíz, Varler HUD (today "Varler SUI"), Varler Papír |
| **UI component library** | The coded components of a design system. | MUI, Fluent UI React | VRG UI Kit (`shared/vrg-ui-kit`) |
| **Firmware** | Software that runs on a microcontroller or device. | a router's OpenWrt, a keyboard's QMK | planner-cyd, board-console agent, knobpad, servicekit_cyd |
| **Build / test pipeline** | Scripts that produce artifacts and verify them, locally or in CI. | GitHub Actions, `npm run build` | each `build.js`, `Dashboard/test/run.js`, the selftests, Mobile CI |
| **Third-party application** | Software we use but did not write. | Chrome, VS Code | Programok (START A): Chrome, Zen, VLC, 7-Zip … |
| **Runtime / toolchain** | The engines and compilers other software runs on. | Node.js, the JDK | `tools/node`, `tools/electron`, arduino-cli, the Android toolchain |
| **Spike / experiment** | Throwaway code that answers one technical question. | — (a practice, not a product) | the Open MCT spike, `docs/research` |
| **Work package / plan / idea** | Project-management units, not software. | Jira epics, an RFC draft | WP-xx, M-xx, DESK-Qnn, features tier 4–5 |

## 2. UI containers — what a thing *looks like* on screen

| Term | Industry meaning | Well-known examples | In VRG today → in VRG Asztal |
|---|---|---|---|
| **Shell / workbench** | The host program that owns the screen and hosts everything else; apps are guests in it. | the Windows shell (Explorer), the VS Code workbench | the Irányítópult frame → **VRG Asztal** (*VRG Desktop*) |
| **Launcher** | A program whose job is starting other programs. | the Windows Start menu, Alfred, JetBrains Toolbox | START, the Kapu tool list, Toolbox, VRG Mobile Indítópult → START stays as the **fallback** launcher |
| **Gate / sign-in screen** | The authentication step before the shell appears. | the Windows lock screen, an SSO page | Kapu → the **gate** of the boot flow (off for now) |
| **Dashboard** | A read-mostly overview of status, numbers and shortcuts, built from widgets / cards; it answers "what is going on". | Grafana, Home Assistant | the Kezdőlap (D0–D4) → **Irányítópult nézet** (*Dashboard view*) |
| **Desktop / workspace** | A free canvas where windows live, with a dock / taskbar and a top bar; it answers "what am I working on". | the Windows desktop, macOS desktop + Dock + menu bar | → **Asztal nézet** (*Desktop view*) |
| **Primary view** | One of the few top-level screens a shell switches between. | macOS Mission Control ⇄ desktop, Android home ⇄ app drawer | Dashboard view ⇄ Desktop view (double Tab) |
| **Console** | (a) a text terminal; (b) a "management console": an admin UI to monitor and control systems. | (a) Windows Terminal; (b) AWS Management Console | Varler Console is neither: it is a **companion app**; Board Console is a **device web UI**; START is a **text UI (TUI)** |
| **Text UI (TUI)** | A full-screen interface drawn with characters in a terminal. | htop, Midnight Commander | START, BACKUP, OTG (`vrg-ui.ps1`) |
| **Menu** | A list of commands shown on demand: menu bar, context menu, start menu. | the File menu, a right-click menu | START screens, the selection menu, the SUI dial's column |
| **Corner dial / radial launcher** | A launcher anchored to a screen corner that unfolds a short list or arc. | Windows 8 charms, game radial menus | the Planner Simple-mode dial → **Sarokvezérlő** (◣ main menu, ◢ Stack) |
| **Command palette** | A searchable list of every command, opened with a key. | VS Code Ctrl+Shift+P, Slack Ctrl+K | Parancspaletta (Ctrl+K) |
| **Launcher bar / quick bar** | A small global search box that starts things and routes text by prefix. | Spotlight, PowerToys Run | Gyorskereső (global hotkey) |
| **Panel / tool window** | A docked region that hosts one tool's UI inside the shell. | the VS Code Terminal panel, JetBrains tool windows | Dashboard panes: Fájlok, Terminál, Böngésző, Posta, Git … |
| **Pane** | One cell of a split layout. | tmux panes, Explorer's preview pane | `layout.js` splits |
| **Tab** | One of several stacked contents of a pane, picked by a header. | browser tabs | the pane tab strip |
| **View** | One presentation of data, or one top-level screen of an app. | Outlook's Calendar view, Revit views | Planner Views, Topology View, Stack pages, the two primary views |
| **Window** | A movable / resizable container, OS-level or drawn inside the shell. | any OS window; in-app windows in Figma | in-shell windows (UI Kit `wm.js`) for apps opened inside the Asztal |
| **Dialog / modal / sheet** | A focused box that asks or edits one thing, usually blocking the rest. | the Save dialog, macOS sheets | the note dialog, the Testreszabás (customise) sheet |
| **Toast / notification** | A short message that appears and fades; a notification centre keeps them. | Windows notifications, Slack toasts | `toasts.js`, the job queue |
| **Card / tile** | A rectangular unit on a dashboard that summarises one item and opens it. | Windows Start tiles, Trello cards | emblem tiles, the Dashboard view's app tiles |
| **Dock / taskbar** | A bar of pinned and running apps. | the macOS Dock, the Windows taskbar | the Desktop view's bottom bar |
| **Top bar / status area / tray** | A bar or corner of status indicators and quick functions. | the macOS menu bar extras, the Windows system tray | the Desktop view's top strip; the Electron tray icon |
| **HUD** | A translucent overlay of live readouts over the work. | aircraft HUDs, game HUDs | Varler HUD tokens, the UI Kit HUD mode |
| **Overlay** | An always-on-top layer over other windows. | the Xbox Game Bar, Discord overlay | Kódváros Fedőréteg, the Irányítópult Overlay mode |

## 3. Levels

| Term | Meaning | Where it shows |
|---|---|---|
| **User** (*Felhasználó*) | The default layout: what a person needs to do the work. | dock, Dashboard sections Ma · Alkalmazások · Munkák · Állapot, SUI Munka · Alkalmazások · Fájlok · Rendszer |
| **Dev** (*Fejlesztő*) | User + secondary items drawn behind their parent, + six dev roots. | Dashboard adds Fejlesztési vonalak · Rétegverem · Ügynökök · Szerverek · Mérőszámok; SUI adds Fejlesztés |
| **All** (*Minden*) | Dev + everything else, as a flat filterable table. | Dashboard adds Katalógus |
| **Dev root** | A parent for dev items that sit behind no User item. | Repó & Git · Ügynökök & AI · Tudás · Infrastruktúra · Eszközök & hardver · Megjelenés |
