# VRG Kapu — the Homepage build pack

*Analysis session 2026-10-21. **Nothing is built yet.** This pack plans the shared front door for the
two users and cuts it into small work packages for another Claude account to build.*

## 1. What is in here

| File | What |
|---|---|
| `01_ARCHITECTURE.md` | **The plan**: board, layers, access model (what really protects what), data, refresh and saving, the local helper, opening programs, Munkanapló, Open MCT verdict, distribution |
| `02_BUSINESS-TOPOLOGY.md` | **The prework**: departments, today's projects mapped into them (v1), the extended vision with new programs and their functions (v2) |
| `hub-seed.json` | The same topology as data — 13 branches, 55 slots (36 today + 19 vision), paths checked against the repo |
| `03_UI.md` | Screen, geometry, node card, click/RCO actions, panels, every Hungarian string, the Munkanapló template |
| `04_SETUP-CHECKLIST.md` | **Your** steps: what to send (usernames + emails only — never passwords), push, invite, OneDrive shares, signing key |
| `00_CONTRACT.md` | Rules every build session follows |
| `wp/WP-*.md` | 15 work packages |
| `DECISIONS.md` · `HUB-Q-001.json` · `q/*.svg` | 18 questions, A = recommended; pictures for the visual ones |
| `PROMPTS.md` | Paste-ready prompts (resolve · audit · build · verify · run in order · parallel lanes) |
| `../../GO-HUB.md` | Codephrase **GO HUB** — one line starts a build session from any account |

## 2. The idea in five lines

1. One HTML file (`Hub/dist/vrg-kapu.html`) is the shared front door; its content (`topology.json`)
   lives in the repo, so both users update it and both see the same map.
2. The board: origin → departments → programs side by side → folders / AI docs / Git hanging below
   → a roadmap growing downward. Every node is a link with a one-sentence explanation under it.
3. The real locks are GitHub and OneDrive permissions; the hub adds a signed allowed list (only your
   key can change it) to decide what it unlocks.
4. A tiny local helper (Kapu segéd, `localhost:8795`) serves the page and opens tools, folders,
   terminals and Claude Code — a fixed list of actions, nothing else.
5. Munkanapló, claims and "Mi változott?" keep two people (and their AI sessions) from colliding.

## 3. Work packages (dependency order)

| Wave | WP | Content | Needs | ⏸ |
|---|---|---|---|---|
| 0 | **HA** | Pre-share audit: secrets, client data, size — working tree + history | — | report |
| 1 | **H0** | Scaffold: `Hub/`, build, tests, checker, START.cmd / VRG-DE.cmd entry | Q01 Q17 | |
| 1 | **H1** | Topology schema, validator, seed → `Hub/data/topology.json` | Q13 | |
| 1 | **H2** | The board drawing, pan/zoom, layers, views, collapse | Q02 Q09 | ⏸ look |
| 2 | **H3** | Click, RCO menu, info drawer, search, favourites | Q05 | |
| 2 | **H4** | Belépések + GitHub identity + token wizard | Q03 Q07 | |
| 2 | **H5** | Signed allowed list + top-layer gate + `hub-sign.js` | Q04 + your list | |
| 2 | **H6** | Frissítés: live topology, roadmap commits, branches, decision files, Mi változott? | — | |
| 3 | **H7** | Editor + save to GitHub (two users) + claims | Q11 Q18 | |
| 3 | **H8** | Saját linkek (L5) + Helyi célmappa (L6) | Q15 | |
| 3 | **H9** | Munkanapló create / save / upload / import | Q16 | |
| 4 | **H10** | Kapu segéd: serve, open tool / folder / terminal / Claude Code, git status/pull | Q08 Q05 | |
| 4 | **H11** | Tour, glossary, installers, Open MCT slot, export, link check | Q12 | ⏸ look |
| 4 | **H12** | Layer 3 agent init docs per program + `GO HUB` codephrase | — | |
| 5 | **H13** | OneDrive links, 00_START copy, colleague guide, clean-profile verify | your links | |

Cheaper model fine: H0 H1 H8 H9 H12. Strong model: HA H2 H5 H6 H7 H10 + every VERIFY.

## 4. Status

| WP | Status | Date | Note |
|---|---|---|---|
| HA | open | | |
| H0 | open | | |
| H1 | open | | |
| H2 | open | | |
| H3 | open | | |
| H4 | open | | |
| H5 | open | | |
| H6 | open | | |
| H7 | open | | |
| H8 | open | | |
| H9 | open | | |
| H10 | open | | |
| H11 | open | | |
| H12 | open | | |
| H13 | open | | |

## 5. Answers

Answered 2026-10-21 by the user: **all A** (the recommended option of every question).

| Id | Answer |
|---|---|
| Q01 | A — VRG Kapu (`vrg-kapu.html`) |
| Q02 | A — columns under departments, layers hang down, roadmap downward |
| Q03 | A — the GitHub account is the identity |
| Q04 | A — allowed list signed with the owner's key |
| Q05 | A — open the local copy the START.cmd way; Előnézet shows GitHub's newest |
| Q06 | A — GitHub Desktop + "Frissítés a GitHubról" |
| Q07 | A — OneDrive links only in v1 |
| Q08 | A — Kapu segéd on localhost:8795 |
| Q09 | A — Hungarian, English below in italics |
| Q10 | A — share as is; new client jobs only on OneDrive `10_Projektek`, by job code |
| Q11 | A — both save straight to `main` with a conflict check |
| Q12 | A — Open MCT as a separate slot |
| Q13 | A — the 12 departments + Általános as drafted |
| Q14 | A — English one-word v2 names with a Hungarian subtitle |
| Q15 | A — personal links in the browser + export/import |
| Q16 | A — Munkanapló to `Hub/logs/` in the repo, OneDrive as extra |
| Q17 | A — hub in the repo `Hub/` + OneDrive `00_START` copy |
| Q18 | A — claims on (soft, expiring) |

Still needed from the user later (not decisions): the two users' GitHub usernames + emails (WP-H5)
and the OneDrive share links (WP-H13).

## 6. After the hub

The v2 programs (`02_BUSINESS-TOPOLOGY.md` §3) each get their own pack later. Suggested first:
Desk (notepad) · Lobby (GDPR) · Picker · Forge.
