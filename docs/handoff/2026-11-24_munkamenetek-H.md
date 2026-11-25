# Prompt for the local H: session: Munkamenetek, the session board, the Vezérlő and the Előszűrő (WP-50 … WP-53), the local half

*Paste everything between the two lines into a Claude Code session started in `H:\VRG\Full\Planner_VRG_U100`.*
*Updated 2026-11-25: covers everything on the branch up to commit 295471e.*

---

A cloud session built four work packages for the VRG Asztal on branch `claude/charming-goodall-dc1ol8`. It wrote and ran the unit
tests on Linux, and drew the panes in Chromium with stub data. It had no Electron, no real `claude` binary, no H: drive and no VRG
Stack database. The local half is yours.

What is on the branch (details: `docs/desktop/LOG.md` § WP-50 … WP-53, decisions DESKU-Q25 … Q27):
- **WP-50 Munkamenetek** (pane `sessions`): lists the local Claude Code sessions of account A and B, newest first. Its buttons:
  - Folytatás: continue a session (`--resume`);
  - Erősebb modellel: continue it on opus (`--resume --model opus`);
  - Másolat: continue a copy (`--fork-session`);
  - Távvezérlés: continue it with `/remote-control`;
  - Vászon: open the Munkavászon at `#s=<id>`.

  The bar's Felhő button opens claude.ai/code in a browser pane, and Áthozás pulls a cloud session down (`--teleport`).
  The Gyors elérés side panel links 14 related tools.
- **WP-51 the session board:** board labels on any Lap:
  - the origin chip and colour frame: Helyi · A/B (ice), Felhő (violet), Gép: \<név\> (warm);
  - the session title above the window, a note below it.

  The four are switched per Lap (sheet tab → Tábla-címkék…) and overridden per window by right-click. Munkamenetek → Tábla opens
  the board: the Vezérlő across the top, the list on the left.
- **`shared/sidepanel/`:** the Planner's side panel as a reusable plug-in.
- **WP-52 Vezérlő** (pane `controller`): one prompt box in Egyszerű (simple) or Részletes (detailed) mode. Its attach options:
  browse, recent, preset folder, gallery, photo and QR. Every prompt goes through the **Előszűrő** (`Prefilter/`, offline), which
  judges it context / unsure / independent and dresses it. A new session then starts with `--model`:
  - an independent prompt starts in `Full\home\claude-free` (no CLAUDE.md);
  - anything else starts in the repo.
- **WP-53:**
  - the Előszűrő as a Claude Code `UserPromptSubmit` hook (`Prefilter/hook.js`, **not installed**);
  - negation ("ne a Plannerről");
  - work-line memory: a bare "folytasd" takes the latest session's anchors;
  - an evaluation tool (`Prefilter/eval.js`) with a 44-prompt seed set: 0.886 accuracy, no context → independent mistake;
  - forced routes in the Vezérlő are saved as labels.

Work step by step, show me each result, and stop to ask me before any commit, push, merge, settings change or hook install.

1. **Where you are.**
   - `git rev-parse --show-toplevel` must print `H:/VRG/Full/Planner_VRG_U100`. Never work in the bare `Backup\code` repo.
   - Run `git fetch origin claude/charming-goodall-dc1ol8`. Check the branch out into a worktree or a local branch, unless it is
     already merged into `main`; then `git pull --ff-only` on `main`.
   - Read `docs/desktop/LOG.md` § WP-50 … WP-53, then `Dashboard/shell/lib/sessions.js`, `gate.js` and `Prefilter/README.md`.

2. **The automated checks the cloud could not run.**
   - `node Dashboard/test/run.js WP-50`, `WP-51`, `WP-52`, `WP-35`, `WP-46` and `WP-24`. The Electron probe
     `Dashboard/shell/selftest/wp-50.js` has never run anywhere. It now expects the idle row's buttons as
     `resume,stronger,fork,remote,canvas`. Fix it until it is green, and tell me what you changed.
   - `node --test Prefilter/test/prefilter.test.js Prefilter/test/next.test.js shared/sidepanel/test/sidepanel.test.js` (18 in
     the cloud).
   - `node Dashboard/test/run.js --all`: compare with `main` before the branch, and list only the new failures. In the cloud the
     unit suite gave 321 pass and the same 68 failures as before; all 68 came from the missing H: and Electron.
   - `node tools/check-start.js` and `node tools/check-catalog.js` must both exit 0. The catalog gained `sessions` and
     `controller`; START did not change.

3. **The Claude Code behaviour all this relies on.** The cloud wrote these from the documentation and did not run them. Try each
   one in a throwaway session, not one that matters. Use account A first, then B
   (`CLAUDE_CONFIG_DIR=H:\VRG\Full\home\claude-account-b`).
   - `claude --resume <id>`, started in the session's own folder (the transcript's `cwd`), comes back with its history.
   - `claude --resume <id> --fork-session` makes a **new** session ID and leaves the old transcript untouched.
   - `claude --resume <id> --model opus` continues the same session on opus. This is what Erősebb modellel does.
   - `claude --resume <id> "/remote-control"`:
     - does a slash command given as the first prompt run, or does Claude get it as text?
     - does the session then show up at claude.ai/code?
     - if it doesn't run, find the right way (a flag, or typing it) and change the `remote` option in `sessions.js` and its test.
   - `claude --teleport` from the repo folder: does it list my cloud sessions and pull one down? What does it need: a clean
     working tree, the same branch?
   - `claude --model haiku "<about 2 000 characters>"`: confirm that a dressed first prompt of that length works as one argument on
     Windows, with the accents intact.
   - **Is a session running right now?** WP-50 guesses this from the file's age (written in the last 2 minutes = live). Look in
     the config folder for a reliable marker (a pid file or a lock), and tell me what you find before you change the guess.

4. **Munkamenetek in the real app.** Rebuild with START → F, start the VRG Asztal (START → D) at the Dev level, and open
   Munkamenetek from the Irányítópult's Ügynökök section and from a free cell's picker. Check:
   - the list:
     - both accounts' sessions are listed, newest first, with title, project and branch;
     - the filter works;
   - the buttons:
     - Folytatás on an idle session opens a Claude terminal in the right folder;
     - on a live one Folytatás is missing, and Másolat works;
     - Erősebb modellel starts the session on opus;
     - Vászon opens the canvas **on that session**, not the newest one;
   - Felhő and the browser pane:
     - Felhő opens claude.ai/code in a Böngésző pane;
     - sign in there once (use the email code if Google refuses sign-in in an embedded browser);
     - open one cloud session, paste a file into it, and tell me which permission questions the pane asked;
   - Gyors elérés: the six links of the simple mode open their tools, and Részletes shows 14;
   - in a narrow column the panel starts folded to its icon rail.

5. **The session board.** Munkamenetek → Tábla. Check:
   - **The board itself:** a Lap called Munkamenetek opens with the Vezérlő across the top and the list on the left; the button now
     says Lista and takes you back.
   - **Automatic labels:** a session opened from the list lands on the board with Helyi · A (or B), its title above, and an ice
     frame.
   - **Cloud windows:** a claude.ai/code tab in a browser window there shows Felhő and a violet frame.
   - **The right-click label menu:** Cím…, Megjegyzés…, Eredet → Másik gép… (type "Laptop"; the frame turns warm), Szín, and Ennél
     az ablaknál (cycle one item: tábla szerint → mindig → soha).
   - **The sheet tab:** Tábla-címkék… switches each of the four labels for the whole Lap.
   - **Native views:** the browser window's page moves when a label bar appears or disappears, and never covers the bar.
   - Take one screenshot of the board and save it in `Full\_share`.

6. **The Vezérlő and the Előszűrő.**
   - Rebuild the index with the H: sources: `node Prefilter/cli.js --rebuild --stats "GO MOBILE folytasd"`. With the Stack, the jobs
     and the features it should be much bigger than the cloud's 445 entities. If `node:sqlite` is missing in this Node or in
     Electron, tell me: the Stack source is then silently skipped.
   - Run `node Prefilter/eval.js run --set seed --misses`. The cloud got 0.886, with the 5 misses all on unsure. Then try 10 of my
     real first prompts from the Munkamenetek list with `node Prefilter/cli.js "<prompt>"`. Show me the verdicts. Propose
     threshold changes but do not make them.
   - In the app, on the board:
     - Send "írj egy verset a télről": it must start in `Full\home\claude-free` with `--model haiku`, labelled "Előszűrő: önálló".
     - Send "GO MOBILE hol tartunk?": it must start in the repo with sonnet.
     - Send "folytasd": the Részletes preview must say which earlier session it took ("folytatás → az előző munkamenet: …").
     - Force Önálló on a context prompt and check that a line appeared in `Prefilter/.cache/eval/labels.jsonl` with source
       `override`.
   - The attach options:
     - Tallózás, Legutóbbiak (after one attach), Mappa (the roots.json folders) and Galéria;
     - the attached paths appear only at the end of the started session's first prompt, never in the pane.

7. **Camera, QR and the frame page's permissions.**
   - Fotó: it must ask nothing and work, because the frame page has no permission handler and Electron allows by default. The
     photo lands in `Full\inbox\vezerlo` and is attached.
   - Tell me whether that same default also lets the frame page use the microphone, notifications, geolocation or other
     permissions. Then propose a handler that allows only video, and only for the Vezérlő. Do not change it without asking.
   - QR: say whether `BarcodeDetector` exists in this Electron. If it doesn't, the pane says so and points to VRG Mobile.

8. **The hook and my own labels. I decide these two.**
   - Run `node Prefilter/hook.js --test "GO MOBILE hol tartunk?"`, once from the repo and once from `Full\home\claude-free`.
     Then try a short sequence with `--session t1`:
     - "GO MOBILE hol tartunk?" must get the full dressing;
     - "folytasd" must add nothing;
     - "nézzük a Kapu belépést" must add a two-line "új horgony" note;
     - the next mention of Kapu must add nothing.
   - Run `node Prefilter/eval.js extract`. Then start `node Prefilter/eval.js label` for me in a terminal and leave it to me
     (c = context, i = independent, s = skip, q = quit). Afterwards run `node Prefilter/eval.js fit --set all` and show me the
     suggestion; on the seed set alone it was context ≥ 0.35. Do not `--write` it.
   - Show me `node Prefilter/hook.js --install --dry`. Install it, in the repo or with `--user`, only when I say so. Then:
     - send one prompt in a new session and check that the added context arrived (`Prefilter/.cache/log.jsonl` has a `first`
       line);
     - check that a prompt still goes through with `VRG_PREFILTER_OFF=1`;
     - check that a broken index (rename `Prefilter/.cache` for a moment) never blocks a prompt.

9. **Then report** what passed, what you fixed and what is still open. Make no commit or push unless I ask. When I do:
   - first run `node Dashboard/tools/inventory.js` and `node Dashboard/tools/classify.js` (the cloud could not refresh the
     inventory: it had no anonymise map);
   - commit on the branch above;
   - add the results to `docs/desktop/LOG.md` under the WP they belong to.

   Never commit `Prefilter/.cache/`: it is gitignored and holds my prompts, labels and job codes. START did not change, so the
   Kapu needs no rebuild.

---
