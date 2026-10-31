# Claude Code sessions — share a GO file, not a link

A Claude Code session link works **only for the account that made it**. The other person opening
it sees nothing, and a session cannot be handed from one account to another. To let someone (or a
fresh session on another account) continue a piece of work, write a **GO file** instead: one
Markdown file at the repo root that is the whole briefing, depending on no memory note. Start a
session with its codephrase, e.g. `GO HUB`; the root `CLAUDE.md` maps each codephrase to its file.

For a single program without a running job, the program's file in this folder is enough
(see `README.md`).

## Live GO files

All run in the main checkout `H:\VRG\Full\Planner_VRG_U100`, branch `main`.

| Codephrase | File | Department | What it starts |
|---|---|---|---|
| `GO MAIN` | `GO-MAIN.md` | Bernard | The overall entry point: the state of every line, the standing rules. |
| `GO PLANNER` | `GO-PLANNER.md` | Arnold | The open Planner work except wiring. |
| `GO ROUTE` | `GO-ROUTE.md` | Arnold | Wiring features, the PCB-style router, the Topology View. Starts by asking the user. |
| `GO CLA` | `GO-CLA.md` | Arnold | The CLA job thread: v1 and v2 delivered, open design questions only. |
| `GO HUB` | `GO-HUB.md` | Elsie | VRG Kapu: setup steps, guest mode, shared folders. |
| `GO CITY` | `GO-CITY.md` | Elsie | Kódváros: parked tuning, deferred checks, the Cloudflare ring. |
| `GO MOBILE` | `GO-MOBILE.md` | Elsie | VRG Mobile, one WP at a time from `docs/mobile/`. |
| `GO OPENWRT` | `GO-OPENWRT.md` | Elsie | OpenWrt on the TL-WR1043ND. The user flashes; Claude never touches the router. |

**Waiting:** `GO TNT` lives on branch `docs/go-tnt` and may merge only when the list in `GO-MAIN.md` §4 is finished and
the user says so. It is Charlotte's line.

Old phrases and every archived file: `docs/go-archive/README.md`.

Source: the root `CLAUDE.md` "Codephrases" and `docs/council/ROSTER.md`, 2026-10-31.
