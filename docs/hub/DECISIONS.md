# VRG Kapu — decisions (A = recommended default)

Answer in one line, e.g. `Q01 A, Q02 A, Q03 B, …`. **Unanswered = A.** Pictures for the visual ones
are in `q/` (open the `.svg` in a browser). Machine-readable copy: `HUB-Q-001.json`.
"Blocks" = the first WP that needs the answer.

## Shape

**Q01 — Name of the Homepage.** *Blocks H0.*
- **A** **VRG Kapu** (`vrg-kapu.html`) — "kapu" = gate, what it is.
- B VRG Központ · C VRG Home · D your own name.

**Q02 — Board layout.** *Blocks H2.* Picture: `q/q02-layout.svg`.
- **A** **Columns under departments**: origin on top, departments as branches, programs side by
  side under them, layers hanging down each column, roadmap growing downward. (What you described.)
  Wide — pan/zoom, collapse, Fókusz on one department.
- B Department rows: one horizontal row per department, programs in it; the layers open in a
  side drawer instead of hanging below. Less wide, but the vertical roadmap is no longer on the board.
- C Radial: departments around the origin like a mind map. Pretty, but the layer stack does not fit.

**Q09 — Text language on the board.** *Blocks H2.*
- **A** **Hungarian UI; node descriptions Hungarian with the English line below in italics** (the
  kit's HU/EN standard; also helps English-speaking AI sessions).
- B Hungarian only. · C Hungarian UI, English descriptions.

**Q13 — The departments.** *Blocks H1.* See `02_BUSINESS-TOPOLOGY.md` §1.
- **A** **Accept the 12 + Általános as drafted.**
- B Merge to ~8 (e.g. Jog into Vezetés, Tudás into TFEJ, Iroda into Vezetés).
- C Change the list — tell me which.

**Q14 — Names of the v2 programs.** *Blocks nothing in the hub (labels only).*
- **A** **English one-word product names (Dispatch, Picker, Desk, Lens…) with a Hungarian subtitle**,
  like Planner / Modder / Inventory today.
- B Hungarian names (Diszpécser, Raktáros…). · C Your own names — tell me.

## Access

**Q03 — Who is the user? (identity for the top layer)** *Blocks H4.* Picture: `q/q03-access.svg`.
- **A** **The GitHub account.** Real check against the repo, works without extra setup. The allowed
  list maps each person's emails to their GitHub login.
- B Google ("Gmail") sign-in. Needs a Google Cloud OAuth client (free) and only works when the hub
  runs through the Kapu segéd. Adds a third account to manage.
- C Both (GitHub for the code layers, Google for the top layer).

**Q04 — How is the allowed list protected?** *Blocks H5.*
- **A** **Signed by your private key** (on your PC only). The colleague can edit everything else but
  cannot add people; a tampered list is ignored.
- B Plain file, honour system (anyone with write access can change it).

**Q07 — OneDrive in v1.** *Blocks H4.*
- **A** **Links only.** The folder links open OneDrive, OneDrive decides who gets in; the hub shows a
  manual "be vagyok jelentkezve" tick. Live folder lists come in v2.
- B Microsoft sign-in + live folder lists now (needs an Azure app registration — free, ~20 minutes
  of your clicking, and the Kapu segéd).

**Q10 — Client data in the shared spaces.** *Blocks the invite (setup step 4); asked again with the
WP-HA audit list.* Today 61 tracked repo files carry "P33" (plans, BRIDGE build figures, calculator data).
- **A** **Share as is** — the colleague is trusted and internal; from now on new client jobs go only
  to OneDrive `10_Projektek`, never into Git, and are referred to by job code.
- B Anonymise before inviting (rename P33 → a neutral code in tracked files; history keeps the old names).
- C Keep client jobs out of both until the GDPR register (v2 *Lobby*) exists.

> **Answered 2026-10-21: B**, then **Q10b = A**. The WP-HA audit had taken `varler-planner` for a
> client name; it is our own (Varler Group = VRG), so it stays. Only the client job codes go:
> `P33`/`PT33` → `CLA`, `NV4` → `CLANV4` (one identifier-safe form everywhere — the codes live in JS
> names, file names and in data the Planner builds file names from), plus the one e-mail address.
> Done by `tools/anonymise.js`; the mapping sits in the gitignored `tools/anonymise.map.json`, since a
> committed mapping would be the leak. Verified on a throwaway copy: 1257 replacements in 215 files,
> 64 `git mv`, a second run changes nothing, Planner 3481 assertions + 70 golden renders green,
> Inventory 201/201, `check-start.js` OK.
> **History is not rewritten** — anyone with repo access can still read the old codes in old commits.
> The client's own documents (`BRIDGE/07_P33/`: blueprints, address, survey) never entered git.
> **When it runs: Q10c below.**

**Q10c — When does the anonymiser run?** *Blocks setup step 3a.* **Answered 2026-10-21: A.**
- **A** **On `main`, just before the invite** (setup step 3a), after `secacc` is merged — one clean
  pass that also catches every code the primary account adds until then, and no clash with the Planner
  work going on in `main` meanwhile.
- B Now, on `secacc` — the 64 renames and 215 edited files then have to merge against everything the
  primary account changes in the same files, and new codes added in `main` slip through anyway.

**Q11 — How does the colleague save edits to the map?** *Blocks H7.*
- **A** **Both save straight to `main`**, with a conflict check (nothing is overwritten silently).
- B The colleague saves to a branch and opens a pull request; you merge.

## Running

**Q05 — Where do programs open from?** *Blocks H3.* Picture: `q/q05-open.svg`.
- **A** **The local copy, the same way START.cmd opens it** (so the tool's saved work is always the
  same one). "Előnézet" can still show the newest GitHub version, marked "do not work here".
- B Always download the newest from GitHub (always current — but saved work splits per origin).
- C From the OneDrive-synced folder.

**Q06 — How does the colleague get the code?** *Blocks setup step 9.*
- **A** **GitHub Desktop** (point-and-click clone and update) + "Frissítés a GitHubról" in the hub.
- B The cwebuser kit (Mode B) + git on the command line.
- C No Git — OneDrive copies only (read-only; the colleague cannot contribute code).

**Q08 — Terminal and Claude Code buttons.** *Blocks H10.* Picture: `q/q08-companion.svg`.
- **A** **Kapu segéd**: a tiny local Node helper (like Board Console) that serves the hub on
  `localhost:8795` and can open only a fixed list of things (tool, folder, terminal, Claude Code,
  VS Code, git status/pull). Also needed for the hub to remember settings.
- B No helper: buttons copy the command, you paste it into a terminal.
- C A `vrg://` link type registered in Windows.

**Q12 — Open MCT.** *Blocks H11.*
- **A** **Separate:** an empty "Konzol (Open MCT)" slot now under Termékfejlesztés, built later as
  its own tool (it is a telemetry console, English-only, needs a server).
- B Build the hub inside Open MCT.

**Q15 — Saját linkek (personal layer) storage.** *Blocks H8.*
- **A** **This browser only, with export/import as a file.**
- B Synced through a private GitHub gist of each user (works across PCs; one more token scope).

**Q16 — Where does a Munkanapló go by default?** *Blocks H9.*
- **A** **Into the repo (`Hub/logs/`)**, shared and searchable; OneDrive as an extra button.
- B OneDrive `90_Naplok` only. · C Download only.

**Q17 — Where does the hub live?** *Blocks H0.*
- **A** **In the repo, `Hub/`**, plus a copy in OneDrive `00_START` for double-click access.
- B Its own repository.

**Q18 — Foglalás (claims: "I am working on this until …").** *Blocks H7.*
- **A** **Yes** — a soft badge on a program, expires by date, locks nothing.
- B No.

## Look (WP-H2, 2026-10-21)

**Q19 — Aligned layer rows?** **Answered: A** — L1–L4 rows line up across the board even when one tall cell leaves gaps elsewhere. (B: each column flows; C: stacks of 2.)

**Q20 — What does "0 / Egész" show?** **Answered: A** — fit the width: the department overview; zoom in to read. (B: fit the height, scroll sideways.)
