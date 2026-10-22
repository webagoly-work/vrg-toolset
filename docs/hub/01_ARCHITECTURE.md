# VRG Kapu — architecture (how the Homepage works)

*Working name **VRG Kapu** ("gate"), file `Hub/dist/vrg-kapu.html`. The name is decision HUB-Q01.*
*This file is the plan. The WPs in `wp/` build it; `DECISIONS.md` holds the open choices (A = recommended).*

---

## 1. What it is, in one paragraph

One HTML file that both users open first, every day. It shows the whole business as one map (the
**Business Topology**): an origin node, the departments branching from it, and under every department
its programs side by side. Under each program hang its layers — shared folders, AI documents, Git
code and a downward roadmap. Every node is a link that opens in a new tab, and every node has a
one-sentence beginner explanation printed under it. The page reads its content from the shared Git
repo, so either user can update it, and it falls back to the copy baked into the file when offline.

## 2. The board (what the user sees)

```
                                  ┌──────────┐
                                  │   VRG    │  origin
                                  └────┬─────┘
       ┌───────────────┬──────────────┼───────────────┬───────────────┐
  [Általános]     [Tervezés]      [Kalkuláció]     [Beszerzés]   … departments (branches)
       │          │        │       │      │          │      │
 L1  Repo·Drive   Planner  Valena  Panel  LED …     Invent. BuildTree   programs, side by side
       │           │        │       │                  │                 (dashed = planned / empty)
 L2  ☁ folders    ☁ Planner_projektek  ☁ CLA_ajanlat …                    shared OneDrive folders
       │           │
 L3  🤖 docs      🤖 PRIMER · CLAUDE.md · GO-R1018 · "Claude Code-ban" button   AI / agent documents
       │           │
 L4  ⎇ Git        ⎇ Planner/projects/varler-planner  (branch main)          Git code location
                   │
                   ● 2026-10-18 Födém · Igénylista · Mozi                   roadmap, newest first,
                   ● 2026-10-16 planner-stack merged                        growing downward
                   ● 2026-10-14 Views V1–V7 …
 ─────────────────────────────────────────────────────────────────────────
 L5  ★ Saját linkek (only me)      L6  📁 Helyi célmappa (only me, this PC)
```

- **Layer 1 – Programok** (top): the end products — single-file HTML tools, third-party apps, or an
  empty dashed slot for something planned.
- **Layer 2 – Megosztott mappák**: OneDrive share links (large files, job folders, renders, installers).
- **Layer 3 – AI dokumentumok**: the init/primer docs an AI agent reads first (CLAUDE.md, PRIMER.md,
  GO-*.md codephrase briefs, DECISIONS), plus a "Claude Code-ban" button that copies the right
  starting prompt and opens Claude Code.
- **Layer 4 – Git**: the folder in the `vrg-toolset` repo, its branch, and below it the **roadmap**
  (dated milestones from the seed + the latest commits for that path, fetched live).
- **Layer 5 – Saját linkek**: each user's own links. Only that user sees them.
- **Layer 6 – Helyi célmappa**: a folder on the user's own PC where exports (work logs now, AI
  session exports later) can be written.

Two views of the same data, one toggle: **Jelenlegi** (what exists + ideas already named) and
**Bővített jövőkép** (adds the v2 programs of `02_BUSINESS-TOPOLOGY.md` §3 as empty slots).
Departments collapse to a single header; "Fókusz" shows one department full width.
Layout alternatives are HUB-Q02 (picture: `q/q02-layout.svg`).

## 3. Access model — what really protects what

**The honest rule: a static HTML file cannot keep a secret.** Anyone who has the file can read
everything inside it. So the page never holds anything secret, and the real locks are the platforms:

| Layer | Real lock (cannot be bypassed) | What the page does |
|---|---|---|
| L1 programs | GitHub: only repo collaborators can read the code / dist files. OneDrive: only people the folder is shared with. | Shows programs unlocked only when the user's identity is on the **signed allowed list** (§3.2). |
| L2 folders | OneDrive "Specific people" share links | Opens the link; OneDrive asks for sign-in and refuses others. |
| L3 AI docs | GitHub collaborator access | Opens on github.com; live text fetched with the user's GitHub token. |
| L4 Git | GitHub collaborator access | Same. Roadmap commits come from the API. |
| L5 / L6 | The user's own browser / PC | Stored only in that browser; export/import as a file. |

### 3.1 Identity — who is looking (HUB-Q03)
Recommended: **the GitHub account is the identity.** Each user creates their own fine-grained
GitHub token once (read access to `webagoly-work/vrg-toolset`, plus write for saving), pastes it into
the page's *Belépések* panel, and the page asks `api.github.com/user` who they are and
`/repos/webagoly-work/vrg-toolset` whether they have access. The GitHub API allows calls from any
origin, so the check itself would even run from a double-clicked file — **but remembering the token
does not**: the repo's own CLAUDE.md records that `localStorage` fails silently from `file://` in
this setup. So the full hub runs **served by the local companion at `http://localhost:8795/`** (§6),
and a double-clicked copy runs in **"csak linkek" mode** (everything clickable, nothing remembered,
a banner says how to start the full mode). The token stays in that browser's storage only — never
in the repo, never in the file.

A Google ("Gmail") sign-in is possible but needs a registered web origin, so it only works when the
page is served by the local companion (§6) and after a Google Cloud OAuth client is set up — that is
option B, parked for v2.

### 3.2 The allowed list — editable only by the owner (HUB-Q04)
`Hub/data/access.json` lists the people (name, emails, GitHub login, role `owner|member`, which
layers). Both users can push to the repo (private repos on GitHub Free have no branch protection),
so "only I can edit it" is enforced by a **signature**, not by permissions:

1. Once, the owner runs `node tools/hub-sign.js --init`. It makes an ECDSA P-256 key pair; the
   **private key goes to `H:\cwebuser\_admin\keys\hub-access.pem`** (outside the repo and outside
   OneDrive), the public key is written into `Hub/src/access-pubkey.json` (committed).
2. After every edit the owner runs `node tools/hub-sign.js` → it writes `sig` into `access.json`
   (signature over the canonical JSON of `body`, `dsaEncoding: 'ieee-p1363'` so WebCrypto can verify).
3. The page verifies with `crypto.subtle.verify` and the embedded public key. A list that does not
   verify is ignored and the page says so ("A hozzáférési lista aláírása érvénytelen").

The colleague can change anything else (topology, logs, their own layers) but cannot add people.

### 3.3 Sign-in buttons per layer ("Belépések" panel)
One row per platform, each with a status dot and a **"Bejelentkezés (új ablak)"** button:

| Row | Button opens | Status check |
|---|---|---|
| GitHub | `https://github.com/login` + token wizard | real (API) |
| OneDrive / Microsoft | `https://onedrive.live.com/` (or the org's `…-my.sharepoint.com`) | v1: manual "be vagyok jelentkezve" tick; v2: Microsoft sign-in via the companion origin (HUB-Q07) |
| Claude | `https://claude.ai/code` | none possible — shown as "saját fiók" |
| Google (optional) | `https://accounts.google.com/` | only with companion + OAuth client (HUB-Q03 B) |

## 4. Data — one shared file, one owner-only file, per-user local state

```
Hub/
  src/                      page source (html, css, js modules)
  data/topology.json        THE content: departments, programs, layer nodes, roadmap seeds
  data/access.json          allowed list, signed by the owner
  logs/YYYY-MM-DD_<login>_<slug>.md   work logs (Munkanapló)
  companion/server.js       optional local helper (§6)
  dist/vrg-kapu.html        the single built file (topology + access baked in as the offline snapshot)
tools/build-hub.js · tools/hub-sign.js · tools/check-hub.js
```

`topology.json` schema `vrg-hub/1` (seed: `docs/hub/hub-seed.json`, full field list in WP-H1):

```jsonc
{ "schema": "vrg-hub/1", "rev": 1, "updated": "2026-10-21", "updatedBy": "webagoly-work",
  "repo": { "owner": "webagoly-work", "name": "vrg-toolset", "branch": "main" },
  "onedrive": { "root": "" },                        // share link of the shared root folder
  "departments": [ { "id": "TERV", "t": "Tervezés és mérnökség", "tEn": "…", "d": "…", "dEn": "…", "hue": "teal" } ],
  "programs": [ {
      "id": "planner", "dept": "TERV", "t": "Varler Planner", "status": "live|dev|idea|v2",
      "d": "one simple sentence (HU)", "dEn": "…", "long": "longer HU text (markdown)", "longEn": "…",
      "open": { "repo": "Planner/projects/varler-planner/dist/varler_planner.html", "url": "" },
      "folders": [ { "t": "…", "d": "…", "url": "" } ],
      "agent":   [ { "t": "PRIMER.md", "d": "…", "repo": "…/docs/PRIMER.md" } ],
      "git":     { "paths": ["Planner/projects/varler-planner"], "branch": "main" },
      "roadmap": [ { "date": "2026-10-18", "t": "Födém · Igénylista · Házimozi" } ],
      "claim":   null                                 // { "by": "login", "until": "2026-10-25", "note": "…" }
  } ],
  "general": [ /* the Általános branch: repo, OneDrive root, installers, kit, glossary … */ ] }
```

Per-user state (never shared, never committed): GitHub token, OneDrive tick, theme, collapsed
departments, L5 links, the L6 folder handle, "last visit" time — all in `localStorage` / IndexedDB
under the prefix `vrgKapu.`, each read wrapped in try/catch.

## 5. Updating — "Frissítés" and saving

**Frissítés** (refresh button, and automatically on open when online + token present):
1. `GET /repos/{o}/{r}/contents/Hub/data/topology.json?ref=main` (raw) → replaces the baked snapshot.
2. Same for `access.json` → verify signature.
3. For each program's `git.paths[0]`: `GET /commits?path=…&per_page=8` → the live part of the roadmap.
   Sent with `If-None-Match` (ETag) — a 304 costs no rate limit. ~30 calls on a cold refresh; the
   token limit is 5 000/hour.
4. `GET /branches` → active branches shown under L4 as "fejlesztés alatt".
5. Tree search for `**/DECISIONS*.md` + `**/*-Q-*.json` → a "Nyitott kérdések" count per program.
6. The hub's own `Hub/dist/vrg-kapu.html` blob sha vs the running build → "Új Kapu verzió elérhető".
Everything is cached, so the page opens instantly offline with the last known state and says
"Utolsó frissítés: …".

**Saving edits (both users, separately):** the in-page editor changes a working copy of the topology;
**"Mentés GitHubra"** does `PUT /contents/Hub/data/topology.json` with the `sha` it loaded. If the
other user saved in between, GitHub answers 409 → the page reloads theirs, re-applies the local edit
list on top (edits are stored as small operations, not as a whole file), shows what changed, and asks
to save again. The commit message names the user and the nodes touched. HUB-Q11 B (colleague
proposes via branch + PR instead) is the stricter alternative.

**Foglalás (claims, HUB-Q18):** a program can carry `claim: {by, until, note}` — "I am working on this
until Friday". Shown as a coloured badge; it is advisory, it locks nothing. It is the cheapest way to
stop two people (or their two Claude sessions) building in the same files.

## 6. The local companion — for Terminal and Claude Code buttons (HUB-Q08)

A web page cannot start programs on the PC. Three ways around it:

- **A (recommended) — companion**: `Hub/companion/server.js`, plain Node, no dependencies, the same
  pattern as Board Console (:8790). Started from START.cmd / VRG-DE.cmd and by `VRG Kapu.cmd`
  (which also opens the browser). It listens **only on 127.0.0.1:8795** and serves the hub itself at
  `http://localhost:8795/`, so the page and its API share one origin and browser storage works. It runs
  **only whitelisted actions** — never a command typed into the page:
  `open-tool {id}` (the same browser + file path START.cmd uses, so the tool's saved work is the
  same as always) · `open-terminal {dir}` · `open-claude {dir}` (a console → `claude` in that folder,
  like START.cmd's Claude Code action) · `open-folder {dir}` · `open-vscode {dir}` · `git-status` ·
  `git-pull` (fast-forward only) · `worktrees` · `check-paths`. `dir` must resolve inside the repo or a folder listed in its config.
  Every request needs the per-install token the server writes into the page it serves, and the
  server rejects any `Host`/`Origin` other than `localhost:8795` / `127.0.0.1:8795` (stops other
  websites and DNS-rebinding tricks from driving it).
- **B — no helper**: the buttons copy the command ("cd /d … && claude") and say where to paste it.
  The page always falls back to this when the companion is not running.
- **C — a `vrg://` link protocol** registered in the Windows registry. Works without a server, but
  any website could fire those links; more fragile and harder to explain.

Claude Code buttons: **"Claude Code (web)"** → `https://claude.ai/code` (each user's own account;
they pick the repo there) · **"Claude Code (helyi)"** → companion `open-claude` in the node's folder ·
**"Indító prompt másolása"** → copies the node's codephrase brief (e.g. "GO R1018 — read GO-R1018.md").

## 7. Opening programs — where the HTML comes from (HUB-Q05)

The trap: the tools keep their work in browser storage, and the browser keys that storage by
*where the file was opened from*. A Planner opened once from a clone and once from a GitHub download
shows two different workspaces — work "disappears". So:

- **A (recommended)**: **Megnyitás** opens the **local copy** exactly the way START.cmd does
  (companion `open-tool`: same browser, same `file:///…` path in the user's clone), so the tool's
  saved work is the one the user always sees. Without the companion, the page offers the
  `file:///` link (built from the *Helyi repó mappa* setting) to copy into the browser.
  **Előnézet (legfrissebb)** fetches the newest file from GitHub and opens it as a throw-away preview,
  with a banner: "Előnézet — itt ne dolgozz, nem marad meg".
- B: always fetch the latest from GitHub (always current, but storage splits).
- C: open from the OneDrive-synced folder (no Git needed, but OneDrive becomes the code channel).

The colleague keeps the clone current with **"Frissítés a GitHubról"** (companion `git-pull`) or
GitHub Desktop (HUB-Q06).

## 8. Munkanapló — the markdown progress document

A form (who, date, program(s), what I did, what is half-done, next step, open questions, links) →
a `.md` file in a fixed template (`03_UI.md` §6). Then one or more of: **Letöltés** · **Mentés a
célmappába** (L6) · **Feltöltés GitHubra** (`Hub/logs/…`, HUB-Q16) · **OneDrive mappa megnyitása**
(to drop it in by hand). **Importálás**: drop any earlier log `.md` → it is parsed and listed under
the programs it names. The latest log per user feeds the "Ki min dolgozik?" strip at the top.

## 9. Open MCT — inside or beside? (HUB-Q12)

Recommendation: **beside, as an empty button now.** From the 2026-10-20 study
(`docs/research/2026-10-20_openmct-planner-bridge.md`): Open MCT is a telemetry console — time
series, plots, limits, fault lists. It has no Hungarian (no i18n), needs an HTTP server, is heavy,
and its strength is live BRIDGE device data, not a link map for beginners. So the hub gets a
**"Konzol (Open MCT)"** program slot under Termékfejlesztés, status `idea`, pointing at the spike
for now and at `Console/` once OM-2 is built. Building the hub inside Open MCT would cost more and
give a harder first screen.

## 10. Other useful functions (my additions)

- **Kereső** (Ctrl+K): every node, description and log, jump-to + highlight.
- **Mi változott?**: commits, topology edits and new logs since my last visit.
- **Ki min dolgozik?**: latest log + claims per user, at the top.
- **Nyitott kérdések**: count of unanswered decision questions per program (from the DECISIONS files).
- **Szótár**: 25 words a beginner meets (repó, commit, branch, worktree, dist, PR, token, megosztási link, agent, CLAUDE.md, codephrase…), one line each.
- **Első lépések**: a 6-step first-run tour, re-openable from the help button.
- **Linkellenőrzés**: dead repo paths (API) and dead local paths (companion) marked red.
- **Kedvencek**: pin up to 8 nodes to a top strip.
- **Telepítők**: the download button → the OneDrive installers folder (and the cwebuser kit).
- **Export**: board as PNG / print, topology as JSON.
- **Témák**: the four VRG themes from `Modder/vrg-buildtree.html`.

## 11. Distribution — how the colleague gets it

1. Owner pushes `main` (today 2 commits ahead of origin) after the pre-share audit (WP-HA).
2. Owner invites the colleague on GitHub (Settings → Collaborators) and shares the OneDrive folders.
3. Colleague installs GitHub Desktop (or the cwebuser kit) and clones the repo (HUB-Q06).
4. `vrg-kapu.html` is also copied to the OneDrive `00_START` folder, so a double-click works even
   before the clone exists — it then works in "csak linkek" mode.
5. In the clone, `Hub/VRG Kapu.cmd` starts the companion and opens `http://localhost:8795/`
   (needs Node — the colleague gets it with the cwebuser kit or a normal Node install).
6. First run: *Első lépések* tour → GitHub token wizard → allowed-list check → board unlocks.

Relation to the launchers: `VRG-DE.cmd` / `START.cmd` stay (the user's front door and muscle
memory). The hub is their web-shaped sibling: same tools, plus folders, docs, roadmap and two users.
Both get an entry that starts the hub; the hub's "Indítópult" node points back at them.

## 12. Later (v2, parked)

Microsoft sign-in + live OneDrive folder listing (Graph, via the companion origin) · Google sign-in ·
private gist sync of L5 · AI exports into L6 · the v2 programs themselves (each its own pack).
