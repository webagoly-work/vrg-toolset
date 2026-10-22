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
| 4 | **H11** | Tour, glossary, installers, Open MCT slot, export, link check | Q12 | done |
| 4 | **H12** | Layer 3 agent init docs per program + `GO HUB` codephrase | — | |
| 5 | **H13** | OneDrive links, 00_START copy, colleague guide, clean-profile verify | your links | |

Cheaper model fine: H0 H1 H8 H9 H12. Strong model: HA H2 H5 H6 H7 H10 + every VERIFY.

## 4. Status

| WP | Status | Date | Note |
|---|---|---|---|
| HA | done | 2026-10-21 | Audit clean (no real secrets); one new finding — `varler-planner` (407 files) + 1 email not covered by the original Q10 draft. See `AUDIT-2026-10-21.md`, HUB-Q10 reopened. |
| H0 | done | 2026-10-21 | Skeleton builds to one 8.8 kB file; tests 4/4, check-hub OK, check-start OK; four themes verified in headless Edge (4 distinct computed backgrounds). START.cmd `H`, VRG-DE.cmd `L5`. |
| H1 | done | 2026-10-21 | topology.json from the seed; kpValidate/ResolveRefs/Visible/LinkFor; tests 12/12; check-hub validates + checks 75 repo paths — 16 are still uncommitted work in the main checkout (docs/research, docs/client-look, BRIDGE/10_media-wall, Firmware/*): warning now, error under `--strict` (H13). |
| H2 | done | 2026-10-21 | Board: layout + renderer + camera + overview; tests 21/21; Edge getBBox audit 0 overflow / 0 collision. Look approved (Q19 A aligned rows, Q20 A width-fit overview). |
| H3 | done | 2026-10-21 | KP_ACT registry (13 RCO items, string-exact vs 03_UI §5), click per kind, popover, drawer + kpMd, Ctrl+K accent-free search + fly, arrow focus, tooltip, favourites; tests 32/32; Edge real-input check all green. Companion / GitHub / log items greyed with their reason until H4–H10. |
| H4 | done | 2026-10-21 | 50-github (token only in browser storage, ETag cache, 401 clears), Belépések modal (5 rows), 5-step token wizard, 3 top-bar dots, L2/L3/L4 🔒 gating, file:// banner (§7 exact); tests 38/38; Edge: locks open on OneDrive tick / mocked GitHub, token never in DOM. Also fixed: `[hidden]` was overridden by the drawer CSS (empty drawer since H3). |
| H5 | done | 2026-10-22 | Signed list live: 2 people (webagoly-work owner, anikovi-work member), owner key at `H:\cwebuser\_admin\keys` (outside repo/OneDrive); verified by hub-sign --verify, check-hub and the page WebCrypto path. kpCanon shared, L1 gate with reasons, tests 46/46. |
| H6 | done | 2026-10-22 | 57-refresh (the WP said 55-, taken by sign-in): topology (validated) · access (verified) · commits per program · branches (compare cached by head pair) · decision files · own version; derived values ETag-cached in kpStore; ⟳ button + auto after 10 min, stale + new-version banners, rate line, ☰ Mi változott?; tests 52/52; Edge with a fake GitHub: 32 → 31 requests, second says "minden friss", Planner L4 14 dated rows + branch + ? 4. Real-token run is the user's (token stays in their browser). |
| H7 | done | 2026-10-22 | 70-edit: ops (set/add/hide/claim/replace) pending in kpStore, live preview + "✎ nem mentett", save = fresh GET → replay → validate → PUT with sha; conflict dialog lists the other user's changes, lost targets reported, 409 retried; editor, Új elem (program/folder/AI doc), claims (badge, Ki min dolgozik?, expired dropped on save), export/import JSON, hidden restore, Előnézet (blob tab + banner). Caps split ghRead / ghWrite. Q11 = A, so no branch+PR path. Tests 59/59; Edge with a fake GitHub: all flows + full regression green. A real save is the user's (own token). |
| H8 | done | 2026-10-22 | 80-personal: L5 own links (kpStore, http(s)/file:/// only, export/import merge by id, Saját row + under their program), L6 target folder (File System Access handle in IndexedDB, permission re-asked on use, test file, path for the companion), personal right-click menu, ☰ entries. Helper named kpDest (kpTarget was taken); inbox() an empty documented stub. Tests 64/64; Edge: real OPFS handle wrote + read back after reload, overlap audit with links 0. |
| H9 | done | 2026-10-22 | 90-log: form (draft every 5 s + on close, cleared after upload), kpLogToMd / kpMdToLog exact §6 template, lossless + extra sections, names date_login_5-word-slug with -2/-3, outputs download · target folder · GitHub Hub/logs (clash → -2) · OneDrive link, import → drawer Napló tab, newest log per user (via Frissítés) in Ki min dolgozik?. Tests 69/69 (byte-exact fixture); Edge with a fake GitHub + OPFS: all flows, full regression green. |
| H10 | done | 2026-10-22 | Hub/companion/server.js (no deps): 127.0.0.1 only, Host + Origin + per-install token (.token, gitignored), whitelisted actions with exact shapes, realpath inside roots (repo + VRG-DE), argument-array detached spawns, folder as cwd (never on a command line), 16 KB limit, KP_DRY_RUN; page: 92-companion (actions alive, ⌨ Terminál, ✳ Claude Code, git pull in ☰, Belépések row with branch/dirty/behind); VRG Kapu.cmd starts it (CRLF, ASCII). Tests 76/76 (real server, random port, dry run); Edge against :8795 dry run green; token never in dist. |
| H11 | done | 2026-10-22 | 97-extras: Első lépések tour (6 steps on real elements, first visit, ?notour for checks), Szótár (25 entries, glossary.json embedded; first occurrence underlined in the drawer), Telepítők, Open MCT long text (§9), Linkellenőrzés (repo paths vs the GitHub tree, local via companion, empty links; red dot), PNG export (theme colours inlined, 1.3 MB at full board) + print (all departments open, restored), Téma, Névjegy, Nyitott kérdések; ☰ grouped. Tests 80/80; Edge checkpoint pass + full regression green. Look approved (Q22 A tour on first visit, Q23 A ⛔ stays on the card). |
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
| Q10 | ~~A~~ → **B** (2026-10-21, after the audit) — anonymise the client job codes before the invite; Q10b A: `varler-planner` is our own name and stays, only `P33`/`NV4` + the e-mail go, via `tools/anonymise.js`. New client jobs only on OneDrive `10_Projektek`, by job code |
| Q19 | A — layer rows stay aligned across the board (H2 look) |
| Q20 | A — "0 / Egész" fits the width: the department overview (H2 look) |
| Q21 | A (default) — before a signed list exists everything stays ⛔ (now moot: the list is signed) |
| Q22 | A — tour on the first visit per browser, then from ☰ (H11 look) |
| Q23 | A — ⛔ stays on the card when signed out (H11 look) |
| Q10c | A — the anonymiser runs on `main` right before the invite (setup step 3a), after `secacc` is merged |
| Q11 | A — both save straight to `main` with a conflict check |
| Q12 | A — Open MCT as a separate slot |
| Q13 | A — the 12 departments + Általános as drafted |
| Q14 | A — English one-word v2 names with a Hungarian subtitle |
| Q15 | A — personal links in the browser + export/import |
| Q16 | A — Munkanapló to `Hub/logs/` in the repo, OneDrive as extra |
| Q17 | A — hub in the repo `Hub/` + OneDrive `00_START` copy |
| Q18 | A — claims on (soft, expiring) |

Still needed from the user later (not decisions): the OneDrive share links (WP-H13).

## 6. After the hub

The v2 programs (`02_BUSINESS-TOPOLOGY.md` §3) each get their own pack later. Suggested first:
Desk (notepad) · Lobby (GDPR) · Picker · Forge.
